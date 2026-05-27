FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY worker.mjs ./
COPY dispatch-timer-event.mjs ./

CMD ["npm", "run", "start"]