# nginx/Dockerfile
# Stage 1: Build frontend
FROM node:18 AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --legacy-peer-deps
COPY client .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=frontend-build /app/client/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
