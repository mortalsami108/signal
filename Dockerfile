FROM eclipse-temurin:21-jdk

RUN apt-get update && apt-get install -y curl xz-utils \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y nodejs \
 && rm -rf /var/lib/apt/lists/*

RUN VERSION=$(curl -Ls -o /dev/null -w %{url_effective} https://github.com/AsamK/signal-cli/releases/latest | sed -e 's/^.*\/v//') \
 && curl -L -o /tmp/s.tar.gz https://github.com/AsamK/signal-cli/releases/download/v${VERSION}/signal-cli-${VERSION}.tar.gz \
 && tar xf /tmp/s.tar.gz -C /opt \
 && ln -sf /opt/signal-cli-${VERSION}/bin/signal-cli /usr/local/bin/signal-cli \
 && rm /tmp/s.tar.gz \
 && signal-cli --version

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["node", "linkserver.js"]
