# Stage 1: Build frontend
FROM node:18 AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client .
RUN npm run build

# Stage 2: Build backend
FROM node:18 AS backend-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server .
RUN npm run build

# Stage 3: Serve with Nginx
FROM nginx:alpine
COPY --from=frontend-build /app/client/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=backend-build /app/server/dist /app/server
COPY --from=backend-build /app/server/node_modules /app/server/node_modules
WORKDIR /app/server
EXPOSE 80
CMD ["sh", "-c", "node main.js & nginx -g 'daemon off;'"]
