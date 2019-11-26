import * as MQTT from "async-mqtt"
import {Observable} from "rxjs"
import {mqttHost} from "./settings"
import {Packet} from "./types"
import {assert, runAsync} from "./util"

// TODO: Implement getAllClients
export const getAllClients = async () => ["someClient"]

export const getMyTopicName = () => ""

export const createClient = async (host = mqttHost) =>
    await MQTT.connectAsync(host)

export const broadcastMessage = async (
    client: MQTT.AsyncMqttClient,
    packet: Packet,
) => {
    await client.publish(getMyTopicName(), JSON.stringify(packet))
}

// TODO: Implement topicNameMatchesPacketId
const topicNameMatchesPacketId = (topic: string, packet: Packet) => true

export const getReceivedPacketsObservable = (client: MQTT.AsyncMqttClient) =>
    new Observable<Packet>(observer => {
        let topics: string[] = []
        runAsync(async () => {
            topics = await getAllClients()
            client.on("message", (topic, payload) => {
                const packet: Packet = JSON.parse(payload.toString())
                // TODO: do some sort of validation on the packet itself
                assert(topicNameMatchesPacketId(topic, packet))
                observer.next(packet)
            })
            await client.subscribe(topics)
        })
        return () =>
            runAsync(async () => void (await client.unsubscribe(topics)))
    })
