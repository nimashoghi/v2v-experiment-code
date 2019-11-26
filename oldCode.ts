import {verify} from "./src/crypto"
import {
    Packet,
    SignedPacketBase,
    RebroadcastPacket,
    SignaturePacket,
} from "./src/types"
import {unreachable} from "./src/util"

const savedDataPackets = new Map<string, Exclude<Packet, SignaturePacket>[]>()
const savedSignaturePackets = new Map<string, SignaturePacket[]>()

const onNewPacket0 = async (packet: Packet) => {
    const calculatedPacketId = generatePacketId(packet)
    switch (packet.type) {
        case "broadcast":
        case "rebroadcast": {
            savedDataPackets.set(calculatedPacketId, [
                ...(savedDataPackets.get(calculatedPacketId) ?? []),
                packet,
            ])

            const savedPackets =
                savedSignaturePackets.get(calculatedPacketId) ?? []
            if (savedPackets.length === 0) {
                return
            }
            savedSignaturePackets.delete(calculatedPacketId)

            if (
                savedPackets.some(
                    savedPacket => !isValidSignature(packet, savedPacket),
                )
            ) {
                console.error(
                    `Found invalid signatures: ${packet} and ${savedPackets}`,
                )
                return
            }

            // if (packet.type === "broadcast") {
            //     onBroadcastPaired(packet, savedPacket)
            // } else {
            //     onRebroadcastPaired(packet, savedPacket)
            // }
            break
        }
        case "signature": {
            break
        }
        default:
            unreachable()
    }
}

const samePacket = (lhs: SignedPacketBase, rhs: SignedPacketBase) =>
    lhs.id === rhs.id &&
    lhs.timestamp === rhs.timestamp &&
    lhs.publicKey === rhs.publicKey

const isValidSignature = (
    unencrypted: Exclude<Packet, SignaturePacket>,
    signature: SignaturePacket,
) =>
    samePacket(unencrypted, signature) &&
    verify(
        JSON.stringify(unencrypted),
        signature.signature,
        signature.publicKey,
    )

const onNewVerifiedPacket = (
    packet: Exclude<Packet, RebroadcastPacket | SignaturePacket>,
) => {
    console.log(`Received the following packet:`)
    console.log(packet)
}

let onNewPacket: (packet: Packet) => void
const packets = new Observable<Packet>(observer => {
    onNewPacket = (packet: Packet) => observer.next(packet)
})
packets
    .pipe(filter(packet => verifyPacket(packet)))
    .subscribe(packet => console.log({packet}))
// const packetsFiltered = packets.pipe(
//     switchMap(originalPacket => {
//         const originalPacketId = generatePacketId(originalPacket)
//         const filteredPackets = packets.pipe(
//             filter(
//                 newPacket => originalPacketId === generatePacketId(newPacket),
//             ),
//         )
//         return concat(of(originalPacket), filteredPackets).pipe(
//             scan((acc, packet) => [...acc, packet], [] as Packet[]),
//         )
//     }),
// )
// packetsFiltered.subscribe(packets => console.log({packets}))

// const packetStream = verifiedPackets.pipe(
//     switchMap(first => {
//         const relatedPackets = verifiedPackets.pipe(
//             filter(
//                 newPacket =>
//                     !areSamePacket(first, newPacket) &&
//                     areRelatedPackets(first, newPacket),
//             ),
//         )

//         return concat(of(first), relatedPackets).pipe(
//             takeUntil(timer(1500)),
//             scan((acc, packet) => [...acc, packet], [] as Packet[]),
//         )
//     }),
// )
