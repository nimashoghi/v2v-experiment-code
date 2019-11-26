import crypto, {KeyObject} from "crypto"
import fs from "fs"
import {settings} from "../src/settings"

const {privateKey, publicKey} = crypto.generateKeyPairSync(settings.keyType, {
    modulusLength: settings.keyLength,
})

exportKey(privateKey, "./private.pem")
exportKey(publicKey, "./public.pem")

function exportKey(key: KeyObject, path: string) {
    fs.writeFileSync(
        path,
        key.export({
            format: settings.keyExportFormat,
            type: settings.keyExportType,
        }),
    )
}
