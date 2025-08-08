# Stage 1: Install dependencies
FROM node:20.17.0-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

# Stage 2: Setup production dependencies
FROM base AS production-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Stage 3: Setup development dependencies and build
FROM base AS development-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Stage 4: Final image
FROM node:20.17.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=development-deps /app/server/dist ./server/dist
COPY --from=development-deps /app/bot/dist ./bot/dist
COPY package.json ecosystem.config.js ./
EXPOSE 3000
CMD ["pnpm", "start"]