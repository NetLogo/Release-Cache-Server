FROM ubuntu:latest

RUN apt update && \
    apt install -y curl

SHELL [ "/bin/bash", "-c" ]

ENV NVM_DIR=/usr/local/nvm
ENV NODE_VERSION=24.13.0

RUN mkdir -p "$NVM_DIR"

RUN curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh" | bash && \
    source "$NVM_DIR/nvm.sh" && \
    nvm install "$NODE_VERSION" && \
    npm -g install serve

ENV PATH="$PATH:$NVM_DIR/versions/node/v$NODE_VERSION/bin"

COPY src /src
COPY package-lock.json package.json tsconfig.json /

RUN npm install && \
    npm run build

COPY versions /versions

EXPOSE 4242

ENTRYPOINT [ "npm", "run", "serve" ]
