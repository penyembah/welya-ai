# Welya AI

AI secretary for university students. Monorepo (npm workspaces):

| Package          | Path           | Stack                                                                                              |
| ---------------- | -------------- | -------------------------------------------------------------------------------------------------- |
| `@welya/web`     | `apps/web`     | React 19 · Vite · Tailwind v4 · shadcn/ui (base-nova) · React Query · axios · Tauri 2              |
| `@welya/api`     | `apps/api`     | Fastify 5 · Drizzle ORM · PostgreSQL 17 · zod · JWT                                                |
| `@welya/landing` | `apps/landing` | Next.js 16 (App Router) · shadcn/ui · marketing site: metadata, sitemap, robots, OG image, JSON-LD |

## Getting started

```bash
npm install                 # installs both workspaces
cp apps/api/.env.example apps/api/.env
npm run db:up               # Postgres 17 in Docker (localhost:5433)
npm run db:migrate          # apply committed SQL migrations
npm run db:seed             # demo user + sample academic data
npm run dev                 # API on :4000 + web on :1420 + landing on :3000
```

For a new database, `db:migrate` creates the complete schema. If you have an older local database created with `db:push`, keep its data and run `db:push` once, then run `npm run db:baseline` once to record the existing schema as the baseline; use `db:migrate` for all future schema changes. Production databases should start empty and use only committed migrations.

Demo account: `nadia.putri@student.univ.ac.id` / `welya123`.

## Docker (API + web)

The landing site deploys to Vercel; the API and the Vite web app ship as containers built from the repo root.

```bash
cp .env.docker.example .env.docker   # set POSTGRES_PASSWORD, JWT_SECRET, CORS_ORIGIN, APP_URL, PUBLIC_API_URL (+ optional AI/SMTP/Google)
npm run docker:up                     # builds welya-api + welya-web, starts Postgres, runs migrations, serves web on :8080 and API on :4000
npm run docker:logs
npm run docker:down
```

- `apps/api/Dockerfile` — multi-stage (deps → tsc build → prod deps → `node:22-alpine` runtime as non-root, `tini`, healthcheck on `/health`). On start it runs the committed migrations (`dist/db/migrate.js`, no drizzle-kit at runtime) and then the server. Uploads live in the `welya-uploads` volume (`UPLOAD_DIR=/data/uploads`).
- `apps/web/Dockerfile` — Vite build served by `nginx:alpine` with SPA fallback, gzip, immutable caching for `/assets`, and `/healthz`. The API URL is **injected at container start** from `VITE_API_URL` into `/config.js` (read by `apps/web/src/lib/api.js` as `window.__WELYA_CONFIG__.apiUrl`), so the same image works in any environment.
- `docker-compose.prod.yml` wires `db` → `api` → `web` with `TRUST_PROXY=true` and `COOKIE_SECURE=true`; terminate TLS with a reverse proxy (Caddy/nginx/Traefik) in front of `web:80` and `api:4000`. Because the refresh cookie is `SameSite=Lax`, serve web and API under the same registrable domain (e.g. `app.welya.biz.id` + `api.welya.biz.id`).
- Build manually: `docker build -f apps/api/Dockerfile -t welya-api .` / `docker build -f apps/web/Dockerfile -t welya-web .` (context must be the repo root). Smoke scripts: `scripts/docker-smoke-api.ps1`, `scripts/docker-smoke-web.ps1`.

## Scripts

| Command                                       | What it does                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run dev`                                 | Run API, web and landing together                                                              |
| `npm run dev:api` / `dev:web` / `dev:landing` | Run one side                                                                                   |
| `npm run screenshots`                         | Re-capture app screenshots for the landing page (API + web must be running; uses local Chrome) |
| `npm run tauri dev`                           | Desktop app (runs the web dev server itself)                                                   |
| `npm run db:up` / `db:down`                   | Start/stop Postgres container                                                                  |
| `npm run db:migrate`                          | Apply committed SQL migrations from `apps/api/drizzle`                                         |
| `npm run db:generate`                         | Generate a migration after changing `apps/api/src/db/schema.ts`                                |
| `npm run db:baseline`                         | Record the initial migration for an existing `db:push` database (one-time only)                |
| `npm run db:push`                             | Local prototyping only; do not use for production                                              |
| `npm run db:seed`                             | Reset the demo user's data                                                                     |
| `npm run db:studio`                           | Drizzle Studio                                                                                 |

## How data flows

- The web app loads everything with one `GET /api/bootstrap` query (React Query key `["bootstrap"]`).
- UI code calls `dispatch(action)` from `useAppStore()`. The action is applied optimistically to the cached bootstrap data, mapped to a REST call in `apps/web/src/store/persist-action.js`, then the query is invalidated. On failure the cache rolls back and a toast is shown.
- Auth: short-lived JWT bearer token held in memory by the axios instance in `apps/web/src/lib/api.js`. "Continue with Google" goes to `GET /api/auth/google` → Google → `GET /auth/google/callback` → `APP_URL/auth/callback#token=…`. Google-only accounts have no password (`user.hasPassword`).
- Auth sessions: access JWTs expire after `ACCESS_TOKEN_TTL` (default 15 minutes); the browser keeps only an httpOnly `welya.refresh` cookie. Refresh sessions are hashed, stored in `sessions`, rotated on `/api/auth/refresh`, and revoked on logout, password reset, and account deletion. Set `COOKIE_SECURE=true` in HTTPS production.
- Account security (Settings → Account → Security): `POST /api/me/password` (change, or set a first password for Google-only accounts; signs out other devices), `POST /api/me/email` → 6-digit code to the new address → `POST /api/me/email/confirm` (returns a fresh token; old address is notified; other devices signed out), `GET /api/me/sessions`, `DELETE /api/me/sessions/:id`, `POST /api/me/sessions/revoke-others`. `PATCH /api/me` no longer accepts `email`.
- Proactive reminders (`apps/api/src/lib/reminder-scheduler.ts`, tick every `REMINDER_TICK_SECONDS`): deadline reminders N hours before (per user `deadlineLeadHours`), class/meeting reminders 30 min before, daily summary at `dailySummaryTime`, weekly review on `WEEKLY_REVIEW_DAY`/`WEEKLY_REVIEW_TIME`, and a free-time nudge when a ≥1h gap is about to start. Each fires once thanks to `notifications.dedupe_key`; daily/weekly also send a themed email. Preview them in dev with `POST /api/ai/briefing/daily|weekly`.
- API rate limiting: `@fastify/rate-limit` applies a global per-IP ceiling (`RATE_LIMIT_MAX`, default 300 requests/minute) and tighter route limits for auth, OAuth, AI, uploads, inbox creation and Google sync. Set `TRUST_PROXY=true` only when the API is behind a trusted reverse proxy.
- Email (verification code, password reset, welcome, password-changed) is sent through the Brevo SMTP relay (`apps/api/src/lib/mail.ts`, dark-themed HTML templates). Preview them with `npm run mail:preview -w @welya/api -- you@example.com`. While `DEV_EXPOSE_CODES=true` the codes/tokens are also returned in API responses.
- Google integrations use real OAuth: `POST /api/integrations/:id/connect` returns an `authUrl`, the consent screen redirects to `GET /integrations/google/callback`, tokens are stored in `oauth_tokens` (one Google account per user, scopes accumulate). **Gmail** (`gmail.readonly`) → inbox items interpreted by the AI. **Google Calendar** (`calendar.events`) and **Google Tasks** (`tasks`) sync **both ways**: `POST /api/integrations/:id/sync` pulls Google changes (create/update/delete) and pushes any Welya rows not yet mirrored; task/event writes through the REST API are mirrored to Google immediately (`apps/api/src/lib/google-push.ts`). Links are kept in `external_id` (`gcal:<id>`, `gtask:<list>:<id>`), so syncs are idempotent. The scheduler (`google-scheduler.ts`) runs the same sync every `GOOGLE_SYNC_INTERVAL_MINUTES`. Disconnecting the last Google service revokes the grant.
- Periodic Google sync runs inside the API after a 30-second startup delay and every 15 minutes (`GOOGLE_SYNC_INTERVAL_MINUTES`). It discovers connected user integrations, runs the same idempotent importers as manual Sync, updates `lastSync`, retries transient failures with exponential backoff up to six hours, and marks revoked/insufficient Google grants as `error` with an in-app reconnect notification. Set `GOOGLE_SYNC_INTERVAL_MINUTES` and `GOOGLE_SYNC_INITIAL_DELAY_SECONDS` to tune it.
- Everything "AI" runs on the server. With `AZURE_OPENAI_*` set, chat, inbox interpretation, task breakdown, document analysis and the weekly review are generated by the Foundry model (`apps/api/src/lib/welya-llm.ts`, strict JSON schemas, grounded in the user's data); planning/free-time is algorithmic (`welya-ai.ts`). Without credentials — or if a call fails — the same endpoints fall back to the built-in rule engine and responses carry `source: "rules"`. `GET /api/ai/status` reports which is active.
- Endpoints: `GET /api/ai/recommendations`, `GET /api/ai/review`, `POST /api/ai/chat`, `POST /api/ai/plan`, `POST /api/ai/breakdown`, `POST /api/ai/document`. New inbox items without an interpretation are interpreted on insert; uploaded PDFs/text are extracted (`pdf-parse`) before interpretation.
- Files: `POST /api/documents/upload` (multipart, stored under `UPLOAD_DIR`), `GET /api/files/:id`, `POST /api/me/avatar`. Account: `GET /api/me/export`, `DELETE /api/me`.
- Web-side hooks for these live in `apps/web/src/hooks/use-welya-api.js`.

## Environment

`apps/api/.env`

```
DATABASE_URL=postgres://welya:welya@localhost:5433/welya
JWT_SECRET=<long random string>
PORT=4000
CORS_ORIGIN=http://localhost:1420,http://127.0.0.1:1420,tauri://localhost,http://tauri.localhost
DEV_EXPOSE_CODES=true
UPLOAD_DIR=./uploads
# Azure AI Foundry (Azure OpenAI v1 Responses API) — optional
AZURE_OPENAI_ENDPOINT=https://<resource>.services.ai.azure.com/openai/v1/responses
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_DEPLOYMENT=gpt-5-mini
AI_TIMEOUT_MS=45000
# Brevo SMTP relay — optional (emails are skipped without it)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<brevo smtp login>
SMTP_PASS=<brevo smtp key>
SMTP_FROM=Welya AI <noreply@yourdomain>
APP_URL=http://localhost:1420
# Google OAuth — optional. Register both redirect URIs on a "Web application" client and enable the Gmail, Google Calendar and Google Tasks APIs.
GOOGLE_CLIENT_ID=<client id>
GOOGLE_CLIENT_SECRET=<client secret>
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback
GOOGLE_INTEGRATION_REDIRECT_URI=http://localhost:4000/integrations/google/callback
```

`apps/web/.env`

```
VITE_API_URL=http://localhost:4000
```
