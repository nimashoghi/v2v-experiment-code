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

export const mqttHost = ""
