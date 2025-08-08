# Stage 1: Install all dependencies
FROM node:20.17.0-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY bot/package.json ./bot/
RUN pnpm install --frozen-lockfile

# Stage 2: Build client
FROM node:20.17.0-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY client/ ./
RUN pnpm run build

# Stage 3: Serve with Nginx
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]