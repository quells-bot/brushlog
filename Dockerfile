# syntax=docker/dockerfile:1

# ── build ────────────────────────────────────────────────────────────────────
FROM public.ecr.aws/docker/library/node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ── deploy ───────────────────────────────────────────────────────────────────
FROM public.ecr.aws/docker/library/nginx:alpine AS deploy

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 8080
