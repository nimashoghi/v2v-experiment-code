import {Observable, ReplaySubject} from "rxjs"
import {scan, tap, startWith} from "rxjs/operators"
import io from "socket.io"
import {qrCodeServerPort, sensingThreshold} from "./settings"
import {ObjectLocation} from "./types"

export interface QrCode {
    location: ObjectLocation
    publicKey: string
}

export interface SocketMessage {
    codes: QrCode[]
}

export interface QrCodeInformation extends QrCode {
    sensedAt: number
}

export interface QrCodeRegistry {
    [qrCode: string]: QrCodeInformation | undefined
}

export const qrCodesSubject = new ReplaySubject<QrCode>()
export const qrCodes = qrCodesSubject.pipe(
    tap(qr => console.log({qr})),
    scan(
        (acc, curr) => ({
            ...acc,
            [curr.publicKey]: {...curr, sensedAt: Date.now()},
        }),
        {} as QrCodeRegistry,
    ),
    startWith({}),
)

const server = io()
server.on("connection", socket => {
    console.log("connection")
    socket.on("qr-codes", ({codes}: SocketMessage) => {
        console.log({codes})
        for (const code of codes) {
            qrCodesSubject.next(code)
        }
    })
})

server.listen(qrCodeServerPort)
console.log(`opened qr code server on port ${qrCodeServerPort}`)

// export const subscribeToQrCode = () => {
//     getQrCodeObs().subscribe(({location, publicKey}) => {
//         console.log(`Received the following publicKey: ${publicKey}`)
//         sensed[publicKey] = [Date.now(), location]
//     })
// }

export const sensedQrCode = (
    registry: QrCodeRegistry,
    code: string,
    timestamp: number,
) => (registry[code]?.sensedAt ?? 0) + sensingThreshold > timestamp

export const getQrCodeLocation = (registry: QrCodeRegistry, code: string) =>
    registry[code]?.location
