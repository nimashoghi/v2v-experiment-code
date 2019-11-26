export type BroadcastEvent = any

export interface PacketSource {
    id: string
    timestamp: number
    publicKey: string
}

export interface PacketBase {
    source: PacketSource
}

export type Unsigned<T extends PacketBase & {signature: Buffer}> = Omit<
    T,
    "signature"
>
export type Signed<T extends PacketBase> = T & {signature: Buffer}

export interface BroadcastPacket extends PacketBase {
    type: "broadcast"
    event: BroadcastEvent
}

export interface RebroadcastPacket extends PacketBase {
    type: "rebroadcast"
    original: SignedPacket
}

export type Packet = BroadcastPacket | RebroadcastPacket
export type SignedPacket = Signed<BroadcastPacket> | Signed<RebroadcastPacket>
