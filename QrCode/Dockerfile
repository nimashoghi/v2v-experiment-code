FROM mohaseeb/raspberrypi3-python-opencv

RUN pip install opencv-python pyzbar socketio

WORKDIR /app
COPY ./detect.py ./detect.py

CMD python detect.py
