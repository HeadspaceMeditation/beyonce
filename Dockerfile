# Needed for DynamoDB Local, which is used for unit tests
FROM openjdk:15-alpine3.11

# And our own stuff goes here
WORKDIR /usr/app
COPY . ./
RUN apk add --update \
    python \
    python-dev \
    py-pip \
    build-base \
    nodejs=12.15.0-r1 \
    npm=12.15.0-r1