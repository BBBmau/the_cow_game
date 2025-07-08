    FROM node:lts-alpine
    COPY package.json package-lock.json ./
    RUN npm install
    COPY . .
    EXPOSE 8080 
    CMD ["node", "server.js"]
