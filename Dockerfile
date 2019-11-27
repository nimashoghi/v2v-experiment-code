FROM node:alpine as builder

WORKDIR /app
COPY . .
RUN yarn && yarn build

CMD node dist/index.js
