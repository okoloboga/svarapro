# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build || { cat /app/npm-debug.log; exit 1; }

# Final stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"]
