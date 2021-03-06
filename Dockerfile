FROM    node:8-alpine AS builder

RUN     apk add --no-cache python curl automake autoconf libtool git alpine-sdk postgresql-dev

WORKDIR /home/ddk

RUN     mkdir -p /home/ddk && chmod -R 777 /home/ddk
COPY    ./package*.json /home/ddk/

RUN     npm install --global npm@latest && \
        npm install --global node-gyp@latest

RUN     npm install

FROM    node:8-alpine

RUN     apk add --no-cache curl bash

RUN     addgroup ddk -g 1100 && \
        adduser -D -u 1100 ddk -G ddk

WORKDIR /home/ddk

USER    ddk

RUN     mkdir -p /home/ddk && \
        chmod -R 777 /home/ddk && \
        mkdir -p /home/ddk/logs && \
        mkdir -p /home/ddk/public/images/dapps/logs && \
        mkdir -p /home/ddk/public/images/dapps/pids && \
        mkdir -p /home/ddk/public/images/dapps/public && \
        touch /home/ddk/LICENSE

COPY    --chown=ddk . /home/ddk
COPY    --from=builder --chown=ddk /home/ddk /home/ddk
COPY    --chown=ddk docker-entrypoint.sh /home/ddk/docker-entrypoint.sh

USER    root

RUN     npm install --global wait-port@latest
RUN     chmod +x /home/ddk/docker-entrypoint.sh

USER    ddk

ENTRYPOINT ["/bin/bash", "/home/ddk/docker-entrypoint.sh"]