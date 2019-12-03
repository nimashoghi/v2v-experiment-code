import os
import serial
import socketio

connection = serial.Serial(os.environ[""], baudrate=115200, timeout=1)
sio = socketio.Client()
sio.connect(os.environ["SOCKET_IO_URL"])

# sendCommandRaw takes a string interpreted as a byte array
def sendCommandRaw(self, command):
    global connection
    sio.emit("commands", {"command": command})

    try:
        if connection is not None:
            connection.write(command)
        else:
            print "Not connected."
    except serial.SerialException:
        print "Lost connection"
        connection = None

    print ' '.join([ str(ord(c)) for c in command ])
