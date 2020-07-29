FROM node:12.16.1-alpine
RUN apk add --no-cache git
WORKDIR /usr/app
COPY . ./