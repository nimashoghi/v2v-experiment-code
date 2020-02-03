import SerialPort from "serialport"

const connection = new SerialPort(
    process.env.ROBOT_SERIAL ?? "/dev/ttyUSB0",
    {
        baudRate: parseInt(process.env.ROBOT_BAUD ?? "115200"),
    },
    error => {
        if (error) {
            console.error(
                `Got the following error when intializing SerialPort: ${error}`,
            )
            return
        }

        connection.write([0x84]) // FULL mode
    },
)

export const executeCommand = async (command: string | Buffer) =>
    await new Promise<number>((resolve, reject) =>
        connection.write(
            typeof command === "string"
                ? Buffer.from(command, "base64")
                : command,
            (error, bytesWritten) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(bytesWritten)
                }
            },
        ),
    )
