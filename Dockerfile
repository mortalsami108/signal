FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && VERSION=$(curl -Ls -o /dev/null -w %{url_effective} https://github.com/AsamK/signal-cli/releases/latest | sed -e 's/^.*\/v//') \
 && curl -L -o /tmp/s.tar.gz https://github.com/AsamK/signal-cli/releases/download/v${VERSION}/signal-cli-${VERSION}-Linux-native.tar.gz \
 && tar xf /tmp/s.tar.gz -C /opt \
 && ln -sf /opt/signal-cli /usr/local/bin/signal-cli \
 && rm /tmp/s.tar.gz \
 && rm -rf /var/lib/apt/lists/* \
 && signal-cli --version

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["node", "linkserver.js"]
