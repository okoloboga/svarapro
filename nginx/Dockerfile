# nginx/Dockerfile
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --legacy-peer-deps
COPY client/ ./
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=frontend-build /app/client/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
# Очистка всех конфигурационных файлов в /etc/nginx/conf.d/
RUN rm -rf /etc/nginx/conf.d/*
# Проверка содержимого /etc/nginx/ для отладки
RUN ls -la /etc/nginx/ > /tmp/nginx_files.log
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
