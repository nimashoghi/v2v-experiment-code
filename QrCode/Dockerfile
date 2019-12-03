FROM mohaseeb/raspberrypi3-python-opencv

RUN apt-get update && apt-get install --yes --no-install-recommends libzbar-dev

WORKDIR /app
COPY . .
RUN pip install -r requirements.txt

CMD python detect.py -n client -v /app/vid.mov
