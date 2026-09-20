# Welya AI — TODO

Prioritised backlog from the gap review on 2026-09-20. Tick items as they land; keep the order roughly as the recommended sequence.

## P0 — Before anyone else uses it

- [ ] **Rotate leaked secrets**: Azure OpenAI key, Brevo SMTP key, Google client secret. Confirm `apps/api/.env` is git-ignored and never pasted into chats/issues again.
- [x] **Rate limiting** with `@fastify/rate-limit`: global per-IP ceiling plus tighter limits for auth, OAuth, AI, uploads, inbox creation and Google sync/connect. Configure `RATE_LIMIT_MAX` and `TRUST_PROXY` in the API environment.
- [x] **Session hardening**: short-lived access token (15 min default) + httpOnly refresh-token cookie; hashed server-side sessions rotate and revoke on logout / password change / account delete; access token removed from `localStorage`.
- [ ] **Encrypt Google refresh tokens at rest** (AES-256-GCM, key from `TOKEN_ENCRYPTION_KEY` env) in `oauth_tokens`.
- [x] **DB migrations**: switch from `drizzle-kit push` to `drizzle-kit generate` + committed `drizzle/` folder; `npm run db:migrate`. Existing `db:push` databases need a one-time baseline transition.
- [x] **Deployment**: Dockerfiles for `apps/api` (migrate-then-start, non-root, healthcheck) and `apps/web` (nginx, runtime-injected API URL), `docker-compose.prod.yml` + `.env.docker.example`, production logging via `NODE_ENV=production`, health checks. Landing stays on Vercel. Still to do: put a TLS reverse proxy in front (Caddy/Traefik) on the server.
- [ ] **CI** (GitHub Actions): install → typecheck → lint → tests → build for all three apps.

## P1 — Tests

- [ ] Unit tests for the rule engine in `apps/api/src/lib/welya-ai.ts` (freeSlotsFor, buildPlan, planRange, breakdownFor, interpret fallback).
- [ ] Unit tests for `google-sync.ts` helpers: Gmail body extraction/HTML stripping, `parseFrom`, `classifyEvent`, all-day handling.
- [ ] Unit tests for `google.ts` state signing (tamper / expiry) and `mail.ts` template escaping.
- [ ] Integration tests for auth routes (register → verify → login → forgot → reset; Google-only account cannot password-login) against a test Postgres (Testcontainers or `docker-compose.test.yml`).
- [ ] Web: component tests for `AuthCallbackPage`, `IntegrationCard` (authUrl redirect, sync toast), forms (`noValidate` paths).
- [ ] Playwright e2e smoke: login → inbox → create task → plan day → calendar shows session.

## P2 — Make Welya proactive (the "secretary that comes to you")

- [x] **Scheduler** in the API (`reminder-scheduler.ts`, setTimeout tick, DB-backed dedupe — no Redis needed at this scale):
  - [x] Deadline reminders using `settings.notifications.deadlineLeadHours`.
  - [x] Daily summary at `dailySummaryTime` (in-app notification + email template).
  - [x] Weekly review generation every Sunday evening (+ email).
  - [x] "Free time detected" suggestion when a ≥1h gap opens today.
  - [x] Class/meeting reminders 30 minutes before (`calendarReminders`).
- [x] **Periodic Google sync** (every 15 min per connected user) with exponential backoff on transient failures and reconnect notifications for `reauth_required`; later Gmail push via Pub/Sub watch.
- [ ] **Auto-confirm high-confidence inbox items** when `settings.ai.confirmBeforeCreating` is off (≥ 0.9 → create task/event directly, still logged in Inbox as processed).
- [x] **Email briefing templates** in `mail.ts` (daily summary, weekly review, deadline reminder) reusing the dark layout.

## P3 — Half-finished features

- [ ] **Image OCR/understanding**: send uploaded screenshots to the Foundry model (vision) for text extraction + interpretation; remove the "text extraction for images isn't available" placeholder.
- [ ] **Full-text search**: Postgres `tsvector` over inbox bodies, documents, tasks, notes; `GET /api/search?q=`; wire into Cmd+K.
- [ ] **Timezone support**: `users.timezone`, use it in `hd()`, planner windows, calendar sync and email templates.
- [ ] **Forward-to-inbox address** per user (`u-<id>@inbox.welya.app`) via Brevo inbound parsing → covers LMS/other forwarding. (WhatsApp and Google Drive integrations were dropped by decision on 2026-09-21.)
- [ ] **Workspace collaboration**: invites by email, membership table, shared tasks/notes; make `members` a real count.
- [ ] **LMS import**: start with iCal/ICS URL import (most Moodle/Canvas instances expose one) before any scraping.
- [ ] Pages suggested earlier: **Focus** (Pomodoro tied to work sessions), **Exams** (study plans from exam announcements), **Grades/GPA** tracker per course.

## P4 — Quality, UX, ops

- [ ] React **error boundaries** per route + friendly retry; offline banner; Tauri: cache last bootstrap for read-only offline view.
- [ ] **i18n**: English/Indonesian switch (UI strings + AI reply language preference in Settings).
- [ ] **Accessibility pass**: keyboard traversal of dialogs/command palette, focus rings, aria-labels on icon buttons, colour contrast in dark theme.
- [ ] **Observability**: Sentry (API + web + landing), request IDs, per-user token/cost metrics for Azure calls, alert on `source: "rules"` fallback rate.
- [ ] **Performance**: paginate `/bootstrap` sections that grow (inbox, notifications, conversations); virtualise long lists.
- [x] **Desktop release pipeline**: `.github/workflows/release.yml` (tauri-action) builds Windows/macOS/Linux installers on `v*` tags and publishes a GitHub Release.
- [ ] **Tauri desktop**: OAuth via system browser + deep link (`welya://auth/callback`) since Google blocks embedded webviews; auto-updater; signed builds.
- [x] **Account**: change password / set password for Google-only accounts, change email with re-verification (code to the new address, old address notified, other sessions revoked), active sessions list with per-device revoke and "sign out other devices".

## P5 — Landing site

- [ ] Blog as MDX files (or CMS) instead of `site.ts` array; RSS feed.
- [ ] Working contact form (API endpoint → Brevo transactional mail) instead of `mailto:`.
- [x] Download page linking to real Tauri release artifacts (GitHub Releases) — resolves latest release assets server-side (`apps/landing/src/lib/releases.ts`). Still to do: OS auto-detect on the client.
- [ ] Privacy-friendly analytics (Plausible/Umami); Search Console + sitemap submission.
- [ ] Refresh screenshots automatically in CI (`npm run screenshots`) on release.

## Done (for reference)

- [x] Monorepo: web (Vite/React/Tauri), api (Fastify/Drizzle/Postgres), landing (Next.js)
- [x] Auth (register/verify/login/forgot/reset), Google sign-in
- [x] Real API everywhere, no mock data
- [x] Azure AI Foundry LLM with rule-engine fallback, Markdown replies
- [x] Brevo transactional emails with themed templates
- [x] Gmail read-only import; Google Calendar and Google Tasks **two-way** sync (pull + immediate push from task/event routes + backfill on sync), idempotent via `external_id`
- [x] Landing page with SEO (metadata, sitemap, robots, OG image, JSON-LD), all free — no pricing
- [x] Dark theme by default on web, desktop and landing
