FROM node:24-alpine

# alpine components
RUN set -xe && apk update && apk add --no-cache \
    shadow \
    bash

WORKDIR /app
