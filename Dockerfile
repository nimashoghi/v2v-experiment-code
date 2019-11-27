FROM arm32v7/node:alpine

WORKDIR /app
COPY . .
RUN yarn && yarn build

CMD node dist/index.js
