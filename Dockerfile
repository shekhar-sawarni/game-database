# syntax=docker/dockerfile:1
FROM node:18-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY README.md ./README.md

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

CMD ["node", "src/index.js"]


