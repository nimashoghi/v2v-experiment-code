import {Observable} from "rxjs"
import {
    debounceTime,
    endWith,
    filter,
    groupBy,
    scan,
    switchMap,
} from "rxjs/operators"
import {loadKeyPair, signPacket, verify} from "./crypto"
import {
    BroadcastPacket,
    Packet,
    RebroadcastPacket,
    Signed,
    UnsignedPacket,
} from "./types"
import {assert, sleep, unreachable} from "./util"

const ENDED = Symbol("ENDED")

const verifyPacket = ({signature, ...packet}: Packet) =>
    verify(JSON.stringify(packet), signature, packet.source.publicKey)

const packetGroupingKey = (packet: Packet) =>
    `${packet.type}-${JSON.stringify(packet.source)}`

const areSamePacket = (lhs: UnsignedPacket, rhs: UnsignedPacket) =>
    JSON.stringify(lhs) === JSON.stringify(rhs)

const areRelatedPackets = (...packets: Packet[]) => {
    if (packets.length === 0) {
        return true
    }
    const [first, ...rest] = packets.map(packet =>
        packet.type === "broadcast" ? packet : getOriginalPacket(packet),
    )
    return rest.every(packet => areSamePacket(packet, first))
}

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
            unreachable()
    }
}

const groupBySelector = (packet: Packet) =>
    packetGroupingKey(
        packet.type === "broadcast" ? packet : getOriginalPacket(packet),
    )

let onNewPacket: (packet: Packet) => void
const packets = new Observable<Packet>(observer => {
    onNewPacket = (packet: Packet) => observer.next(packet)
})

type StreamValueType = Packet | typeof ENDED
const packetStream = packets.pipe(
    filter(packet => verifyPacket(packet)),
    groupBy(groupBySelector, undefined, grouped =>
        grouped.pipe(debounceTime(1500)),
    ),
    switchMap(obs =>
        obs.pipe(
            endWith(ENDED),
            scan(
                (acc, packet) => [...acc, packet] as StreamValueType[],
                [] as StreamValueType[],
            ),
        ),
    ),
)

let last = Date.now()
packetStream.subscribe(packets => {
    console.log({
        packets,
        confidence: calculateConfidenceScore(packets),
        dateDiff: Date.now() - last,
    })
    last = Date.now()
})

const sensedQRCode = (s: any) => true

const getDepth = (message: Packet): number =>
    message.type === "broadcast" ? 1 : 1 + getDepth(message.original)

const calculateConfidenceScore = (values: StreamValueType[]) =>
    values
        .map(message => {
            if (message === ENDED) {
                return 0
            }

            if (!sensedQRCode(message)) {
                return 0
            }

            return 1 / getDepth(message)
        })
        .reduce((acc, curr) => acc + curr, 0)

const main = async () => {
    console.log(`Started`)

    const {privateKey, publicKey} = await loadKeyPair("./")
    const source: Packet["source"] = {
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
