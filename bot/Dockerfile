# 1. Этап зависимостей
FROM localhost:5000/node:18.20.4-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# 2. Этап сборки
FROM localhost:5000/node:18.20.4-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3. Финальный этап
FROM localhost:5000/node:18.20.4-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

CMD ["npm", "start"]
