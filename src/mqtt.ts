import * as MQTT from "async-mqtt"
import {ReplaySubject} from "rxjs"
import {KeyInput, signPacket} from "./crypto"
import {mqttHost} from "./settings"
import {Packet, SignedPacket} from "./types"
import {assert} from "./util"

// TODO: Implement getAllClients
export const getAllClients = () => {
    assert(process.env.ALL_CLIENTS)
    return process.env.ALL_CLIENTS.split(",")
}

export const getMyTopicName = () => {
    assert(process.env.MY_TOPIC)
    return process.env.MY_TOPIC
}

const client = MQTT.connect(mqttHost)

export const broadcastMessage = async (packet: SignedPacket) => {
    await client.publish(getMyTopicName(), JSON.stringify(packet))
}
export const broadcastSignedMessage = async <T extends Packet>(
    original: T,
    privateKey: KeyInput,
) => await broadcastMessage(signPacket<T>(original, privateKey) as SignedPacket)

// TODO: Implement topicNameMatchesPacketId
// const topicNameMatchesPacketId = (topic: string, packet: SignedPacket) => true

export const hookUpMqttToSubject = async (
    subject: ReplaySubject<SignedPacket>,
) => {
    const topics = getAllClients()
    client.on("message", (_, payload) =>
        subject.next(JSON.parse(payload.toString())),
    )
    await client.subscribe(topics)
}
