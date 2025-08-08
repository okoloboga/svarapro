# Stage 1: Install dependencies
FROM node:20.17.0-alpine AS deps

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# Stage 2: Build applications
FROM node:20.17.0-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY server/ ./server/
COPY bot/ ./bot/

RUN pnpm run build

# Stage 3: Final image
FROM node:20.17.0-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/bot/dist ./bot/dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ecosystem.config.js ./

EXPOSE 3000

CMD ["pnpm", "start"]
