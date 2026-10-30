FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV TZ=America/New_York

CMD ["npm", "start"]
