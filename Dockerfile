FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN mkdir /data && chown node:node /data

COPY package.json ./
COPY src ./src
COPY public ./public
COPY data ./data

USER node
EXPOSE 3000
CMD ["node", "src/serveur.js"]
