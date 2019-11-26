import {Observable} from "rxjs"
import {
    debounceTime,
    endWith,
    filter,
    groupBy,
    map,
    scan,
    switchMap,
} from "rxjs/operators"
import {loadKeyPair, signPacket, verify} from "./crypto"
import {
    BroadcastPacket,
    Packet,
    RebroadcastPacket,
    Signed,
    SignedPacket,
} from "./types"
import {assert, sleep, unreachable} from "./util"

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

let onNewPacket: (packet: SignedPacket) => void
const packets = new Observable<SignedPacket>(observer => {
    onNewPacket = (packet: SignedPacket) => observer.next(packet)
})

const packetStream = packets.pipe(
    filter(packet => verifyPacket(packet)),
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
)

packetStream.subscribe(([packet, confidence, packets]) => {
    console.log({
        packet,
        confidence,
        packets,
    })
})

const sensedQRCode = (s: any) => true

const getDepth = (message: SignedPacket): number =>
    message.type === "broadcast" ? 1 : 1 + getDepth(message.original)

const calculateConfidenceScore = (values: SignedPacket[]) =>
    values
        .map(message => (sensedQRCode(message) ? 1 / getDepth(message) : 0))
        .reduce((acc, curr) => acc + curr, 0)

const main = async () => {
    console.log(`Started`)

    const {privateKey, publicKey} = await loadKeyPair("./")
    const source: SignedPacket["source"] = {
        id: "fhdiso",
        publicKey: publicKey.export({
            format: "pem",
            type: "pkcs1",
        }) as string,
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

    onNewPacket(packet)
    await sleep(1000)

    const rebroadcastPacket = signPacket(
        {type: "rebroadcast", original: packet, source},
        privateKey,
    )
    onNewPacket(rebroadcastPacket)
    await sleep(1000)

    const rebroadcastRebroadcastPacket = signPacket(
        {type: "rebroadcast", original: rebroadcastPacket, source},
        privateKey,
    )
    onNewPacket(rebroadcastRebroadcastPacket)
    await sleep(1000)

    onNewPacket(rebroadcastPacket)
    await sleep(1000)

    while (true) {
        await sleep(500)
    }
}

main().catch(console.error)
