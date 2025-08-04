# 1. Этап зависимостей
FROM node:20.17.0-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# 2. Этап сборки
FROM node:20.17.0-alpine AS builder
WORKDIR /app
# Копируем зависимости из предыдущего этапа
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Эта команда будет кэшироваться, если не менялись исходники
RUN npm run build

# 3. Финальный этап
FROM node:20.17.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Копируем только нужные для запуска артефакты
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["node", "dist/main.js"]
