FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Ustawienie rejestru i timeoutów dla sieci
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retry-maxtimeout 600000 && \
    npm install --dns-result-order=ipv4first

COPY . .

EXPOSE 3000

CMD ["node", "test2.js"]
