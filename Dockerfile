    FROM node:lts-alpine
    WORKDIR /app
    COPY package.json package-lock.json ./
    RUN npm install
    COPY . .
    EXPOSE 6060
    CMD ["node", "server.js"]
