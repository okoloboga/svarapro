# Stage 1: Build frontend
FROM node:18.20.4-alpine AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --legacy-peer-deps
COPY client/ ./
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine
COPY --from=frontend-build /app/client/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
