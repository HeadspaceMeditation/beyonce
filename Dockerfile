# Needed for DynamoDB Local, which is used for unit tests
FROM openjdk:15-alpine3.11

# And our own stuff goes here
WORKDIR /usr/app
COPY . ./
RUN apk add --update \
    yarn \
    python \
    python-dev \
    py-pip \
    build-base \
    nodejs \
    npm