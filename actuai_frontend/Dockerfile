# ---- ActuAI frontend image -----------------------------------------------
# Build the React app, then serve the static files with a tiny nginx.
# (A minimal Vite scaffold is assumed; package.json/index.html live alongside.)

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
