import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { db, schema } from "../db/client.js"
import { env, googleEnabled } from "../env.js"
import { provisionDefaults } from "../lib/provision.js"
import { mailer } from "../lib/mail.js"
import { authorizationUrl, decodeState, encodeState, exchangeCode, fetchProfile, INTEGRATION_SCOPES, saveTokens } from "../lib/google.js"
import { SYNCERS } from "../lib/google-sync.js"
import { LIMITS } from "../lib/rate-limits.js"
import { createSession } from "../lib/sessions.js"

const callbackQuery = z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() })
const pathOf = (url: string) => new URL(url).pathname

export const DESKTOP_SCHEME = "welya"
const deepLink = (path: string, params: Record<string, string>) => `${DESKTOP_SCHEME}://${path}?${new URLSearchParams(params)}`

// Browsers only open custom schemes from a page, not from a 302, so hand the desktop app its deep link via a tiny page.
function deepLinkPage(url: string, ok: boolean) {
  const safe = url.replace(/"/g, "&quot;")
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Welya AI</title><meta name="color-scheme" content="dark">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#151b1d;color:#e6ecee;font:15px/1.5 system-ui,Segoe UI,Roboto,sans-serif}main{max-width:26rem;padding:2rem;text-align:center}h1{font-size:1.25rem;margin:0 0 .5rem}p{margin:0 0 1.25rem;color:#9fb0b5}a{display:inline-block;padding:.6rem 1.1rem;border-radius:.6rem;background:#e6ecee;color:#151b1d;font-weight:600;text-decoration:none}</style></head>
<body><main><h1>${ok ? "Returning to Welya AI…" : "Sign-in didn't complete"}</h1><p>${ok ? "You can close this tab once the app opens." : "Go back to the app and try again."}</p><a href="${safe}">Open Welya AI</a></main>
<script>location.replace("${safe}")</script></body></html>`
}

// Public OAuth endpoints. Callback paths come from the redirect URIs registered in Google Cloud Console.
export const googleRoutes: FastifyPluginAsyncZod = async (app) => {
  const toApp = (path: string, params: Record<string, string>) => `${env.APP_URL}${path}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`

  /* ---------- Sign in / sign up with Google ---------- */

  app.get("/api/auth/google", { config: LIMITS.oauth, schema: { querystring: z.object({ client: z.enum(["desktop"]).optional() }) } }, async (req, reply) => {
    if (!googleEnabled) return reply.code(503).send({ message: "Google sign-in is not configured on this server." })
    const state = encodeState({ purpose: "login", ...(req.query.client ? { client: req.query.client } : {}) })
    return reply.redirect(authorizationUrl({ scopes: [], state, redirectUri: env.GOOGLE_REDIRECT_URI }))
  })

  app.get(pathOf(env.GOOGLE_REDIRECT_URI), { config: LIMITS.oauth, schema: { querystring: callbackQuery } }, async (req, reply) => {
    const { code, state: rawState, error } = req.query
    const state = rawState ? decodeState(rawState) : null
    const desktop = state?.client === "desktop"
    const fail = (reason: string) => (desktop ? reply.type("text/html").send(deepLinkPage(deepLink("auth/callback", { error: reason }), false)) : reply.redirect(toApp("/login", { error: reason })))
    if (error) return fail(error === "access_denied" ? "google_denied" : "google")
    if (!code || !state || state.purpose !== "login") return fail("google_state")

    try {
      const tokens = await exchangeCode(code, env.GOOGLE_REDIRECT_URI)
      const profile = await fetchProfile(tokens.access_token)
      if (!profile.email) return fail("google_email")
      const email = profile.email.toLowerCase()

      let [user] = await db.select().from(schema.users).where(eq(schema.users.googleId, profile.sub))
      if (!user) {
        // Link to an existing password account with the same verified address, otherwise create one
        const [byEmail] = await db.select().from(schema.users).where(eq(schema.users.email, email))
        if (byEmail) {
          ;[user] = await db.update(schema.users).set({ googleId: profile.sub, verified: true, avatar: byEmail.avatar || profile.picture || "" }).where(eq(schema.users.id, byEmail.id)).returning()
        } else {
          const id = randomUUID()
          ;[user] = await db.insert(schema.users).values({ id, email, name: profile.name?.trim() || email.split("@")[0], googleId: profile.sub, passwordHash: null, avatar: profile.picture ?? "", verified: true }).returning()
          await provisionDefaults(id)
          void mailer.welcome(email, user.name).catch((err) => app.log.error({ err }, "welcome email failed"))
        }
      }

      if (desktop) {
        // The system browser can't hand the app a cookie, so it gets a 2-minute one-time code to swap for a session in-app
        const oneTime = randomUUID().replace(/-/g, "")
        await db.insert(schema.verificationCodes).values({ id: randomUUID(), userId: user.id, type: "desktop-login", code: oneTime, expiresAt: new Date(Date.now() + 2 * 60_000).toISOString() })
        return reply.type("text/html").send(deepLinkPage(deepLink("auth/callback", { code: oneTime }), true))
      }

      const token = await createSession(app, user, req, reply)
      // Fragment keeps the token out of server logs and Referer headers
      return reply.redirect(`${env.APP_URL}/auth/callback#token=${encodeURIComponent(token)}`)
    } catch (err) {
      req.log.error({ err }, "google sign-in failed")
      return fail("google")
    }
  })

  /* ---------- Connect Gmail / Calendar / Drive ---------- */

  app.get(pathOf(env.GOOGLE_INTEGRATION_REDIRECT_URI), { config: LIMITS.oauth, schema: { querystring: callbackQuery } }, async (req, reply) => {
    const { code, state: rawState, error } = req.query
    const state = rawState ? decodeState(rawState) : null
    const integration = state?.purpose === "integration" ? state.integration : "google"
    const desktop = state?.client === "desktop"
    const back = (params: Record<string, string>, ok: boolean) => (desktop ? reply.type("text/html").send(deepLinkPage(deepLink("integrations/callback", params), ok)) : reply.redirect(toApp("/settings/integrations", params)))
    const fail = (reason: string) => back({ error: reason, integration }, false)
    if (error) return fail(error === "access_denied" ? "denied" : "google")
    if (!code || !state || state.purpose !== "integration" || !(state.integration in INTEGRATION_SCOPES)) return fail("state")

    try {
      const tokens = await exchangeCode(code, env.GOOGLE_INTEGRATION_REDIRECT_URI)
      const wanted = INTEGRATION_SCOPES[state.integration]
      if (!wanted.every((s) => tokens.scope.split(" ").includes(s))) return fail("scope")
      const profile = await fetchProfile(tokens.access_token)
      await saveTokens(state.userId, profile.email, tokens)
      const where = and(eq(schema.integrations.userId, state.userId), eq(schema.integrations.id, state.integration))
      await db.update(schema.integrations).set({ status: "connected", account: profile.email, lastSync: null }).where(where)

      // First import runs in the background so the redirect is instant
      const sync = SYNCERS[state.integration]
      void sync(state.userId)
        .then((r) => db.update(schema.integrations).set({ lastSync: new Date().toISOString() }).where(where).then(() => app.log.info({ integration: state.integration, ...r }, "initial google sync")))
        .catch((err) => app.log.error({ err, integration: state.integration }, "initial google sync failed"))

      return back({ connected: state.integration }, true)
    } catch (err) {
      req.log.error({ err }, "google integration connect failed")
      return fail("google")
    }
  })
}
