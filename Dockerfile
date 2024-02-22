# Needed for DynamoDB Local, which is used for unit tests
FROM amazoncorretto:20-alpine3.18

# And our own stuff goes here
WORKDIR /usr/app
COPY . ./
RUN addgroup -S nonroot \
    && adduser -S nonroot -G nonroot
USER nonroot
RUN apk add --update \
    yarn \
    build-base \
    nodejs \
    npm
