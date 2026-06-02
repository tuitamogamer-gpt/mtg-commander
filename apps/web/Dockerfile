# Build context must be the repo ROOT (pnpm workspace):
#   docker build -f apps/web/Dockerfile -t mtgc-web .
# syntax=docker/dockerfile:1

# ---- build stage: produce the static Vite bundle --------------------------
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mtgc/shared build && pnpm --filter @mtgc/web build

# ---- serve stage: nginx static host + reverse proxy to the API ------------
FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
