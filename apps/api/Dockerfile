# Welya API — multi-stage build from the monorepo root:
#   docker build -f apps/api/Dockerfile -t welya-api .
# Runs the committed Drizzle migrations, then starts Fastify on $PORT (default 4000).

# ---------- deps: install the whole workspace once (needed for hoisted node_modules) ----------
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/landing/package.json apps/landing/
RUN npm ci --workspace=@welya/api --include-workspace-root --ignore-scripts

# ---------- build: compile TypeScript ----------
FROM deps AS build
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src
RUN npm run build -w @welya/api

# ---------- prod deps only ----------
FROM node:22-alpine AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/landing/package.json apps/landing/
RUN npm ci --workspace=@welya/api --include-workspace-root --omit=dev --ignore-scripts && npm cache clean --force \
 # npm nests packages under the workspace when versions conflict with the root; make sure the dir exists so COPY never fails
 && mkdir -p apps/api/node_modules

# ---------- runtime ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    UPLOAD_DIR=/data/uploads
WORKDIR /repo/apps/api
RUN apk add --no-cache tini \
 && addgroup -S welya && adduser -S welya -G welya \
 && mkdir -p /data/uploads && chown -R welya:welya /data
COPY --from=prod-deps --chown=welya:welya /repo/node_modules /repo/node_modules
COPY --from=prod-deps --chown=welya:welya /repo/apps/api/node_modules ./node_modules
COPY --from=prod-deps --chown=welya:welya /repo/package.json /repo/package.json
COPY --from=build     --chown=welya:welya /repo/apps/api/dist ./dist
COPY --chown=welya:welya apps/api/package.json ./package.json
COPY --chown=welya:welya apps/api/drizzle ./drizzle
USER welya
EXPOSE 4000
VOLUME ["/data/uploads"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
# Migrate first so a fresh database is ready before the API accepts traffic
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
