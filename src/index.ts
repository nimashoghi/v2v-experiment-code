// const generateLocationChain = (packets: [SignedPacket, ObjectLocation][]) => {
//     let [packet, location] = assertDefined(
//         packets.find(([{type}]) => type === "broadcast"),
//     )
//     let chain: ObjectLocation[] = []
//     while (true) {
//         const [parent, location] = packets.find(
//             ([p]) => JSON.stringify(p) === JSON.stringify(packet),
//         ) ?? [undefined, undefined]
//         if (!parent) {
//             return chain
//         }
//         chain = [...chain, location]
//     }
// }
import crypto from "crypto"
import {MonoTypeOperatorFunction, range, timer} from "rxjs"
import {
    debounceTime,
    filter,
    groupBy,
    map,
    mergeMap,
    retryWhen,
    scan,
    switchMap,
    tap,
    withLatestFrom,
    zip,
} from "rxjs/operators"
import uuid from "uuid/v4"
import {loadKeyPair, verify} from "./crypto"
import {broadcastSignedMessage, packets} from "./mqtt"
import {getQrCodeLocation, QrCodeRegistry, qrCodes, sensedQrCode} from "./qr"
import {confidenceThreshold} from "./settings"
import {
    BroadcastPacket,
    Packet,
    RebroadcastPacket,
    Signed,
    SignedPacket,
} from "./types"
import {assert, removeDuplicates, runAsync, unreachable} from "./util"

const verifyPacket = ({signature, ...packet}: SignedPacket) =>
    verify(JSON.stringify(packet), signature, packet.source.publicKey)

const getOriginalPacket = (
    packet: Signed<RebroadcastPacket>,
): Signed<BroadcastPacket> => {
    assert(verifyPacket(packet))

    switch (packet.original.type) {
        case "broadcast":
            return packet.original
        case "rebroadcast":
            return getOriginalPacket(packet.original)
        default:
            return unreachable()
    }
}

const packetIdCalculator = (packet: SignedPacket) => {
    const groupingPacket =
        packet.type === "broadcast" ? packet : getOriginalPacket(packet)
    return `${groupingPacket.type}-${JSON.stringify(groupingPacket.source)}`
}

const getOriginalPacketFromList = ([...packets]: SignedPacket[]) => {
    const [packet, index] = packets
        .map((packet, i) => [packet, i] as const)
        .find(([packet]) => packet.type === "broadcast") ?? [undefined, 0]
    assert(packet?.type === "broadcast")
    packets.splice(index, 1)
    assert(packets.every(packet_ => packet_.type === "rebroadcast"))

    return [packet, packets as Signed<RebroadcastPacket>[]] as const
}

const retryProcessing = <T>(): MonoTypeOperatorFunction<T> =>
    retryWhen(attempts =>
        range(1, 5).pipe(
            zip(attempts, i => {
                return i
            }),
            mergeMap(i => {
                console.log("waiting for 1 second and retrying")
                return timer(1000)
            }),
        ),
    )

const verifiedPackets = packets.pipe(
    tap(packet => console.log({packet})),
    filter(packet => verifyPacket(packet)),
)
const legitimatePackets = verifiedPackets.pipe(
    groupBy(packetIdCalculator, undefined, grouped =>
        grouped.pipe(debounceTime(1500)),
    ),
    switchMap(obs =>
        obs.pipe(
            scan(
                (acc, packet) => [...acc, packet] as SignedPacket[],
                [] as SignedPacket[],
            ),
        ),
    ),
    // remove duplicate entries in groups
    map(packets =>
        removeDuplicates(packets, packet => packetIdCalculator(packet)),
    ),
    withLatestFrom(qrCodes),
    map(([packets, registry]) => {
        const [packet, rebroadcasts] = getOriginalPacketFromList(packets)
        return [
            packet,
            rebroadcasts,
            calculateConfidenceScore(packet, packets, registry),
        ] as const
    }),
    // tap(([packet, , rebroadcasts]) => {
    //     const packetId = packetIdCalculator(packet)
    //     if (
    //         !rebroadcasts.every(
    //             packet_ => packetIdCalculator(packet_) === packetId,
    //         )
    //     ) {
    //         console.log(
    //             "We were unable to get a consensus between all the rebroadcast packets!",
    //         )
    //     }
    // }),
    filter(([, , [score, unsensed]]) => {
        if (score < confidenceThreshold) {
            if (unsensed) {
                console.log(
                    `Received packet with low confidence, but we have not verified all QR codes. Waiting...`,
                )
                throw new Error()
            }

            console.log(`Received packet with low confidence. Ignoring`)
            return false
        }
        return true
    }),
    retryProcessing(),
)

const dumpSignature = <T extends Packet>({
    signature,
    ...packet
}: Signed<T>): T => (packet as unknown) as T

const stringify = (packet: Packet | SignedPacket): string => {
    if ("signature" in packet) {
        return stringify(dumpSignature(packet))
    }
    return JSON.stringify(packet, undefined, 4)
}

const onNewPacket = (
    packet: Signed<BroadcastPacket>,
    _: Signed<RebroadcastPacket>[],
) => {
    const duration = Date.now() - packet.source.timestamp
    console.log(
        `Received packet ${packet.source.id} ${duration /
            1000} seconds after it was posted.`,
    )
    console.log(`Received verified packet: ${stringify(packet)}`)
}

const getDepth = (message: SignedPacket): number =>
    message.type === "broadcast" ? 1 : 1 + getDepth(message.original)

const calculateConfidenceScore = (
    originalPacket: Signed<BroadcastPacket>,
    values: SignedPacket[],
    registry: QrCodeRegistry,
) => {
    const originalPacketId = packetIdCalculator(originalPacket)
    return values
        .filter(packet => {
            if (packetIdCalculator(packet) !== originalPacketId) {
                console.log(
                    `The id of packet ${packet} did not match the original broadcast ID. Skipping in confidence score calculation.`,
                )
                return false
            }
            return true
        })
        .map(message => {
            if (
                !sensedQrCode(
                    registry,
                    message.source.publicKey,
                    message.source.timestamp,
                )
            ) {
                return [0, true] as const
            }
            return [1 / getDepth(message), false] as const
        })
        .reduce(
            ([accScore, accUnsensed], [currScore, currUnsensed]) =>
                [accScore + currScore, accUnsensed || currUnsensed] as [
                    number,
                    boolean,
                ],
            [0, false] as [number, boolean],
        )
}

const newSource = (publicKey: string) => ({
    id: uuid(),
    publicKey,
    timestamp: Date.now(),
})

const isRebroadcastOfMyPacket = (packet: SignedPacket, publicKey: string) =>
    packet.type === "rebroadcast" &&
    crypto.createPublicKey(packet.original.source.publicKey) ===
        crypto.createPublicKey(publicKey)

const main = async () => {
    console.log(`Started`)

    const {privateKey, publicKey} = await loadKeyPair()

    verifiedPackets
        .pipe(
            // filter out messages that are rebroadcasts of packets from me
            filter(packet => !isRebroadcastOfMyPacket(packet, publicKey)),
            withLatestFrom(qrCodes),
            filter(([packet, registry]) => {
                if (
                    !sensedQrCode(
                        registry,
                        packet.source.publicKey,
                        packet.source.timestamp,
                    )
                ) {
                    console.log("not sensed. throwing")
                    throw new Error()
                }
                return true
            }),
            retryProcessing(),
        )
        .subscribe(([original, registry]) =>
            runAsync(async () => {
                const location = getQrCodeLocation(
                    registry,
                    original.source.publicKey,
                )
                if (!location) {
                    console.log(
                        `Could not get location for QR code ${original.source.publicKey}`,
                    )
                    return
                }
                await broadcastSignedMessage(
                    {
                        source: newSource(publicKey),
                        type: "rebroadcast",
                        location,
                        original,
                    },
                    privateKey,
                )
            }),
        )

    const processed = new Set<string>()
    legitimatePackets.subscribe(
        ([packet, rebroadcasts]) => {
            console.log(packet)
            const packetId = packetIdCalculator(packet)
            if (processed.has(packetId)) {
                console.log(
                    `Received a packet with id ${packetId} that has already been processed. Ignoring...`,
                )
                return
            }
            processed.add(packetId)

            onNewPacket(packet, rebroadcasts)
        },
        error => console.log({error}),
    )

    // await setupMockData()
}

main().catch(console.error)
