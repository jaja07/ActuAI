# ---- ActuAI frontend image -----------------------------------------------
# Multi-stage: build the React app with Node, then serve the static files with
# a tiny nginx. The result is a small, dependency-free runtime image.

FROM node:20-alpine AS build
WORKDIR /app
# Install deps from the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci
# Copy the source (node_modules/dist excluded via .dockerignore) and build.
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# SPA-aware server config + the compiled assets.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
