# Default: game server. Use -f Dockerfile.web to build web image.
FROM node:lts-alpine
WORKDIR /app
COPY game/package.json ./package.json
RUN npm install
COPY db ./db
COPY game ./game
EXPOSE 6060
CMD ["node", "game/gameServer.js"]
