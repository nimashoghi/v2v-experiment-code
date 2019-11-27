import {Observable} from "rxjs"
import {tap} from "rxjs/operators"
import io from "socket.io"
import {sensingThreshold} from "./settings"
import {ObjectLocation} from "./types"

export interface QrCode {
    location: ObjectLocation
    publicKey: string
}

export interface SocketMessage {
    codes: QrCode[]
}

const sensed: {[code: string]: [number, ObjectLocation]} = {}

const getQrCodeObs = () =>
    new Observable<QrCode>(observer => {
        const server = io()
        console.log("opened qr code server on port 8080")

        server.on("connection", socket => {
            console.log("connection")
            socket.on("qr-codes", ({codes}: SocketMessage) => {
                console.log({codes})
                for (const code of codes) {
                    observer.next(code)
                }
            })
        })
        server.listen(8080)
        // ;(async () => {
        //     const {publicKey} = await loadKeyPair("./")
        //     await sleep(2500)
        //     observer.next({
        //         publicKey: publicKey
        //             .export({format: "pem", type: "pkcs1"})
        //             .toString(),
        //     })
        // })()
    }).pipe(tap(qr => console.log({qr})))

export const subscribeToQrCode = () => {
    getQrCodeObs().subscribe(({location, publicKey}) => {
        console.log(`Received the following publicKey: ${publicKey}`)
        sensed[publicKey] = [Date.now(), location]
    })
}

export const sensedQrCode = (code: string, timestamp: number) =>
    (sensed[code]?.[0] ?? 0) + sensingThreshold > timestamp

export const getQrCodeLocation = (code: string) =>
    sensed[code] ? sensed[code][1] : undefined
