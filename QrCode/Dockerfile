FROM mohaseeb/raspberrypi3-python-opencv

RUN pip install pyzbar socketio

RUN apt-get update && apt-get install --yes --no-install-recommends libzbar-dev

RUN pip install python-socketio[client]

WORKDIR /app
COPY ./detect.py ./detect.py

CMD python detect.py -n client -v /app/vid.mov
