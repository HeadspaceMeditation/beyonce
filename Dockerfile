# Java JDK is needed for DynamoDB Local, which is used for unit tests
FROM amazoncorretto:18-alpine3.15

# And our own stuff goes here
WORKDIR /usr/app
COPY . ./
RUN apk add --update \
    yarn \
    python3 \
    python3-dev \
    py-pip \
    build-base \
    nodejs \
    npm
