import {MonoTypeOperatorFunction, range, ReplaySubject, timer} from "rxjs"
import {
    debounceTime,
    filter,
    groupBy,
    map,
    mergeMap,
    retryWhen,
    scan,
    switchMap,
    zip,
} from "rxjs/operators"
import uuid from "uuid/v4"
import {loadKeyPair, signPacket, verify} from "./crypto"
import {broadcastSignedMessage} from "./mqtt"
import {getQrCodeLocation, sensedQrCode, subscribeToQrCode} from "./qr"
import {confidenceThreshold} from "./settings"
import {BroadcastPacket, RebroadcastPacket, Signed, SignedPacket} from "./types"
import {assert, runAsync, sleep, unreachable} from "./util"

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
    const packet = packets.find(packet => packet.type === "broadcast")

    assert(packet?.type === "broadcast")
    const packetId = packetIdCalculator(packet)
    assert(packets.every(packet_ => packetIdCalculator(packet_) === packetId))

    return packet
}

// let onNewPacket: (packet: SignedPacket) => void
// const packets = new Observable<SignedPacket>(observer => {
//     onNewPacket = (packet: SignedPacket) => observer.next(packet)
// })
const packets = new ReplaySubject<SignedPacket>()

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

const verifiedPackets = packets.pipe(filter(packet => verifyPacket(packet)))
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
    map(
        packets =>
            [
                getOriginalPacketFromList(packets),
                calculateConfidenceScore(packets),
                packets,
            ] as const,
    ),
    filter(([, [score, unsensed]]) => {
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

const onNewPacket = (packet: SignedPacket) => {
    console.log(`Received verified packet: ${packet}`)
}

const getDepth = (message: SignedPacket): number =>
    message.type === "broadcast" ? 1 : 1 + getDepth(message.original)

const calculateConfidenceScore = (values: SignedPacket[]) =>
    values
        .map(message => {
            if (
                !sensedQrCode(
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

const newSource = (publicKey: string) => ({
    id: uuid(),
    publicKey,
    timestamp: Date.now(),
})

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

const main = async () => {
    console.log(`Started`)

    const {privateKey, publicKey} = await loadKeyPair()

    subscribeToQrCode()
    // await hookUpMqttToSubject(packets)

    verifiedPackets
        .pipe(
            filter(packet => {
                if (
                    !sensedQrCode(
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
        .subscribe(original =>
            runAsync(async () => {
                const location = getQrCodeLocation(original.source.publicKey)
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
        ([packet]) => {
            console.log(packet)
            const packetId = packetIdCalculator(packet)
            if (processed.has(packetId)) {
                return
            }
            processed.add(packetId)

            onNewPacket(packet)
        },
        error => console.log({error}),
    )

    const source: SignedPacket["source"] = {
        id: "fhdiso",
        publicKey,
        timestamp: 41421321,
    }
    const packet = signPacket(
        {
            type: "broadcast",
            event: "fdshofisd",
            source,
        },
        privateKey,
    )

    packets.next(packet)
    await sleep(6000)

    packets.next(packet)

    // const rebroadcastPacket = signPacket(
    //     {
    //         type: "rebroadcast",
    //         original: packet,
    //         location: "CENTER",
    //         source,
    //     },
    //     privateKey,
    // )
    // packets.next(rebroadcastPacket)
    // await sleep(1000)

    // const rebroadcastRebroadcastPacket = signPacket(
    //     {
    //         type: "rebroadcast",
    //         original: rebroadcastPacket,
    //         location: "CENTER",
    //         source,
    //     },
    //     privateKey,
    // )
    // packets.next(rebroadcastRebroadcastPacket)
    // await sleep(1000)

    // packets.next(rebroadcastPacket)
    // await sleep(1000)

    while (true) {
        await sleep(500)
    }

    await sleep(10000)
}

main().catch(console.error)
