    FROM node:lts-alpine
    WORKDIR /app
    COPY package.json package-lock.json ./
    RUN npm install
    COPY . .
    RUN test -f /app/game/index.html && test -f /app/game/cow.js && test -f /app/game/ui.js || (echo "ERROR: game/ files missing - check build context" && exit 1)
    EXPOSE 6060
    CMD ["node", "server.js"]
