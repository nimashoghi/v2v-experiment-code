export const settings = {
    algorithm: "RSA-SHA512",
    encoding: "utf8",
    keyLength: 2048,
    keyType: "rsa",
    keyExportFormat: "pem",
    keyExportType: "pkcs1",
} as const

export const appSettings = {
    debounceTime: 2500,
}

export const mqttHost = process.env.MQTT_HOST

// how long to keep the cache for something that is sensed already
export const sensingThreshold = 5000

// number of retries of processing a message
export const maxNumRetries = 5

export const confidenceThreshold = 1.0

export const qrCodeServerPort = 3000

// how long after a packet's timestamp can we trust it for
// def: 10 seconds
export const packetExpirationDuration = 15000
