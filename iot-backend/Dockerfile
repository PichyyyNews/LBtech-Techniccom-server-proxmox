FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

CMD ["node", "server.js"]
