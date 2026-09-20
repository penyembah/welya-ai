# Welya web (Vite + React) — multi-stage build from the monorepo root:
#   docker build -f apps/web/Dockerfile -t welya-web .
# Serves the static bundle with nginx; the API URL is injected at container start via VITE_API_URL.

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/landing/package.json apps/landing/
RUN npm ci --workspace=@welya/web --include-workspace-root --ignore-scripts

# ---------- build ----------
FROM deps AS build
# Build-time fallback only; the runtime entrypoint overrides it through /config.js
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
COPY apps/web/index.html apps/web/vite.config.js apps/web/jsconfig.json apps/web/components.json apps/web/
COPY apps/web/public apps/web/public
COPY apps/web/src apps/web/src
RUN npm run build -w @welya/web

# ---------- runtime ----------
FROM nginx:1.27-alpine AS runtime
ENV VITE_API_URL=http://localhost:4000
COPY apps/web/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/docker/entrypoint.sh /docker-entrypoint.d/40-welya-config.sh
RUN chmod +x /docker-entrypoint.d/40-welya-config.sh
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
