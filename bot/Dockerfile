# 1. Этап зависимостей
FROM node:18 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# 2. Этап сборки
FROM node:18 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3. Финальный этап
FROM node:18 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

CMD ["npm", "start"]