import crypto from "crypto"
import {promises as fs} from "fs"
import {settings} from "./settings"
import {Packet, Signed} from "./types"

export const loadKeyPair = async () => {
    const [privateKey, publicKey] = await Promise.all([
        fs
            .readFile(
                process.env.PRIVATE_KEY_LOCATION ?? "./keys/private-4.pem",
            )
            .then(crypto.createPrivateKey)
            .then(key => key.export({format: "pem", type: "pkcs1"}).toString()),
        fs
            .readFile(process.env.PUBLIC_KEY_LOCATION ?? "./keys/public-4.pem")
            .then(crypto.createPublicKey)
            .then(key => key.export({format: "pem", type: "pkcs1"}).toString()),
    ])
    return {privateKey, publicKey}
}

const encodeMessage = (message: string) =>
    Buffer.from(message, settings.encoding)

export type KeyInput = string | crypto.KeyObject
const convertKeyInput = (input: KeyInput, type: "private" | "public") => {
    if (typeof input === "string") {
        return type === "private"
            ? crypto.createPrivateKey(input)
            : crypto.createPublicKey(input)
    }
    return input
}

export const sign = (message: string, key: KeyInput) =>
    crypto.sign(
        settings.algorithm,
        encodeMessage(message),
        convertKeyInput(key, "private"),
    )

export const signPacket = <T extends Packet>(
    original: T,
    privateKey: KeyInput,
): Signed<T> => ({
    ...original,
    signature: sign(JSON.stringify(original), privateKey),
})

export const verify = (message: string, signature: Buffer, key: KeyInput) =>
    !!crypto.verify(
        settings.algorithm,
        encodeMessage(message),
        convertKeyInput(key, "public"),
        signature,
    )
