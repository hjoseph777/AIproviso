FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.mjs ./
COPY validate-sql.mjs ./

EXPOSE 5100

CMD ["npm", "run", "start"]