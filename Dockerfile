FROM arm32v7/node:alpine

RUN apk add --no-cache alpine-sdk linux-headers python-dev

WORKDIR /app
COPY . .
RUN yarn && yarn build

CMD node dist/index.js
