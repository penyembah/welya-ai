import { randomUUID, randomInt } from "node:crypto"
import { and, eq, gt, isNull } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { z } from "zod"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { db, schema } from "../db/client.js"
import { env } from "../env.js"
import { provisionDefaults } from "../lib/provision.js"
import { loadUserData } from "../lib/data.js"
import { mailer } from "../lib/mail.js"
import { LIMITS } from "../lib/rate-limits.js"
import { createSession, listSessions, revokeOtherSessions, revokeSession, revokeSessionById, revokeUserSessions, rotateSession } from "../lib/sessions.js"

const emailSchema = z.string().trim().toLowerCase().email()
const passwordSchema = z.string().min(8).max(200)

const publicUser = (u: typeof schema.users.$inferSelect) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  university: u.university,
  program: u.program,
  semester: u.semester,
  avatar: u.avatar,
  verified: u.verified,
  createdAt: u.createdAt,
  hasPassword: Boolean(u.passwordHash),
  googleLinked: Boolean(u.googleId),
  pendingEmail: u.pendingEmail ?? null,
})

async function issueCode(userId: string, type: "verify" | "reset" | "email-change", ttlMinutes: number) {
  const code = type === "reset" ? randomUUID().replace(/-/g, "") : String(randomInt(0, 1_000_000)).padStart(6, "0")
  await db.insert(schema.verificationCodes).values({
    id: randomUUID(),
    userId,
    type,
    code,
    expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
  })
  return code
}

async function consumeCode(userId: string | null, type: "verify" | "reset" | "email-change" | "desktop-login", code: string) {
  const conditions = [eq(schema.verificationCodes.type, type), eq(schema.verificationCodes.code, code), isNull(schema.verificationCodes.usedAt), gt(schema.verificationCodes.expiresAt, new Date().toISOString())]
  if (userId) conditions.push(eq(schema.verificationCodes.userId, userId))
  const [row] = await db.select().from(schema.verificationCodes).where(and(...conditions)).limit(1)
  if (!row) return null
  await db.update(schema.verificationCodes).set({ usedAt: new Date().toISOString() }).where(eq(schema.verificationCodes.id, row.id))
  return row
}

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // Email delivery must never block or fail the auth request
  const send = (kind: string, p: Promise<boolean>) =>
    p.then((sent) => sent && app.log.info({ kind }, "email sent")).catch((err) => app.log.error({ err, kind }, "email failed"))

  app.post("/auth/register", { config: LIMITS.register, schema: { body: z.object({ name: z.string().trim().min(2), email: emailSchema, password: passwordSchema, university: z.string().trim().default("") }) } }, async (req, reply) => {
    const { name, email, password, university } = req.body
    const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email))
    if (exists) return reply.conflict("An account with this email already exists.")
    const id = randomUUID()
    await db.insert(schema.users).values({ id, name, email, university, passwordHash: await bcrypt.hash(password, 10) })
    await provisionDefaults(id)
    const code = await issueCode(id, "verify", 15)
    void send("verify", mailer.verifyEmail(email, name, code))
    return reply.code(201).send({ ok: true, ...(env.DEV_EXPOSE_CODES ? { devCode: code } : {}) })
  })

  app.post("/auth/login", { config: LIMITS.login, schema: { body: z.object({ email: emailSchema, password: z.string().min(1) }) } }, async (req, reply) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, req.body.email))
    if (!user || !user.passwordHash) return reply.unauthorized(user ? "This account uses Google sign-in. Continue with Google or reset your password to set one." : "Email or password is incorrect.")
    if (!(await bcrypt.compare(req.body.password, user.passwordHash))) return reply.unauthorized("Email or password is incorrect.")
    if (!user.verified) return reply.code(403).send({ message: "Please verify your email first.", code: "unverified" })
    const token = await createSession(app, user, req, reply)
    return { token, user: publicUser(user) }
  })

  app.post("/auth/verify", { config: LIMITS.verify, schema: { body: z.object({ email: emailSchema, code: z.string().length(6) }) } }, async (req, reply) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, req.body.email))
    if (!user) return reply.badRequest("That code isn't right.")
    const row = await consumeCode(user.id, "verify", req.body.code)
    if (!row) return reply.badRequest("That code isn't right or has expired.")
    const [updated] = await db.update(schema.users).set({ verified: true }).where(eq(schema.users.id, user.id)).returning()
    void send("welcome", mailer.welcome(user.email, user.name))
    const token = await createSession(app, updated, req, reply)
    return { token, user: publicUser(updated) }
  })

  app.post("/auth/refresh", { config: LIMITS.login }, async (req, reply) => {
    const session = await rotateSession(app, req, reply)
    if (!session) return reply.unauthorized("Your session has expired. Please sign in again.")
    return { token: session.token, user: publicUser(session.user) }
  })

  // Desktop app: swap the one-time code from the welya://auth/callback deep link for a real session (sets the refresh cookie in the webview)
  app.post("/auth/exchange", { config: LIMITS.login, schema: { body: z.object({ code: z.string().min(16).max(64) }) } }, async (req, reply) => {
    const row = await consumeCode(null, "desktop-login", req.body.code)
    if (!row) return reply.unauthorized("This sign-in link has expired. Please try again.")
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, row.userId))
    if (!user) return reply.unauthorized("Account not found.")
    const token = await createSession(app, user, req, reply)
    return { token, user: publicUser(user) }
  })

  app.post("/auth/logout", async (req, reply) => {
    await revokeSession(req, reply)
    return { ok: true }
  })

  app.post("/auth/resend", { config: LIMITS.resend, schema: { body: z.object({ email: emailSchema }) } }, async (req) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, req.body.email))
    if (!user || user.verified) return { ok: true }
    const code = await issueCode(user.id, "verify", 15)
    void send("verify", mailer.verifyEmail(user.email, user.name, code))
    return { ok: true, ...(env.DEV_EXPOSE_CODES ? { devCode: code } : {}) }
  })

  app.post("/auth/forgot", { config: LIMITS.forgot, schema: { body: z.object({ email: emailSchema }) } }, async (req) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, req.body.email))
    // Always respond ok to avoid leaking which emails exist
    if (!user) return { ok: true }
    const token = await issueCode(user.id, "reset", 30)
    void send("reset", mailer.resetPassword(user.email, user.name, token))
    return { ok: true, ...(env.DEV_EXPOSE_CODES ? { devToken: token } : {}) }
  })

  app.post("/auth/reset", { config: LIMITS.reset, schema: { body: z.object({ token: z.string().min(10), password: passwordSchema }) } }, async (req, reply) => {
    const row = await consumeCode(null, "reset", req.body.token)
    if (!row) return reply.badRequest("This reset link is invalid or has expired.")
    const [user] = await db.update(schema.users).set({ passwordHash: await bcrypt.hash(req.body.password, 10) }).where(eq(schema.users.id, row.userId)).returning()
    if (user) {
      await revokeUserSessions(user.id)
      void send("password-changed", mailer.passwordChanged(user.email, user.name))
    }
    return { ok: true }
  })

  app.get("/auth/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.user.sub))
    if (!user) return reply.unauthorized()
    return { user: publicUser(user) }
  })

  // Email is changed through /me/email (needs re-verification), never here
  app.patch("/me", { preHandler: [app.authenticate], schema: { body: z.object({ name: z.string().trim().min(1).optional(), university: z.string().optional(), program: z.string().optional(), semester: z.coerce.number().int().min(1).max(14).optional(), avatar: z.string().optional() }) } }, async (req) => {
    const [user] = await db.update(schema.users).set(req.body).where(eq(schema.users.id, req.user.sub)).returning()
    return { user: publicUser(user) }
  })

  /* ---------- account security ---------- */

  // Change password (requires current) or set a first password for Google-only accounts (no current)
  app.post("/me/password", { preHandler: [app.authenticate], config: LIMITS.changePassword, schema: { body: z.object({ currentPassword: z.string().optional(), newPassword: passwordSchema }) } }, async (req, reply) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.user.sub))
    if (!user) return reply.unauthorized()
    if (user.passwordHash) {
      if (!req.body.currentPassword || !(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) return reply.unauthorized("Current password is incorrect.")
      if (await bcrypt.compare(req.body.newPassword, user.passwordHash)) return reply.badRequest("Choose a password you haven't used before.")
    }
    const [updated] = await db.update(schema.users).set({ passwordHash: await bcrypt.hash(req.body.newPassword, 10) }).where(eq(schema.users.id, user.id)).returning()
    // Sign out every other device; keep this one
    await revokeOtherSessions(user.id, req)
    void send("password-changed", mailer.passwordChanged(user.email, user.name))
    return { user: publicUser(updated) }
  })

  // Step 1: request a change — code goes to the NEW address
  app.post("/me/email", { preHandler: [app.authenticate], config: LIMITS.changeEmail, schema: { body: z.object({ email: emailSchema, password: z.string().optional() }) } }, async (req, reply) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.user.sub))
    if (!user) return reply.unauthorized()
    if (req.body.email === user.email) return reply.badRequest("That's already your email.")
    if (user.passwordHash && !(await bcrypt.compare(req.body.password ?? "", user.passwordHash))) return reply.unauthorized("Password is incorrect.")
    const [taken] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, req.body.email))
    if (taken) return reply.conflict("An account with this email already exists.")
    await db.update(schema.users).set({ pendingEmail: req.body.email }).where(eq(schema.users.id, user.id))
    const code = await issueCode(user.id, "email-change", 15)
    void send("email-change", mailer.emailChangeCode(req.body.email, user.name, code))
    return { ok: true, pendingEmail: req.body.email, ...(env.DEV_EXPOSE_CODES ? { devCode: code } : {}) }
  })

  // Step 2: confirm with the code; other sessions are signed out and the old address is notified
  app.post("/me/email/confirm", { preHandler: [app.authenticate], config: LIMITS.changeEmail, schema: { body: z.object({ code: z.string().length(6) }) } }, async (req, reply) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.user.sub))
    if (!user?.pendingEmail) return reply.badRequest("No email change is pending.")
    const row = await consumeCode(user.id, "email-change", req.body.code)
    if (!row) return reply.badRequest("That code isn't right or has expired.")
    const [taken] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, user.pendingEmail))
    if (taken) return reply.conflict("An account with this email already exists.")
    const oldEmail = user.email
    const [updated] = await db.update(schema.users).set({ email: user.pendingEmail, pendingEmail: null, verified: true }).where(eq(schema.users.id, user.id)).returning()
    await revokeOtherSessions(user.id, req)
    void send("email-changed", mailer.emailChanged(oldEmail, user.name, updated.email))
    // The JWT carries the email claim, so hand back a fresh one
    const token = await createSession(app, updated, req, reply)
    return { token, user: publicUser(updated) }
  })

  app.delete("/me/email", { preHandler: [app.authenticate], config: LIMITS.changeEmail }, async (req) => {
    await db.update(schema.users).set({ pendingEmail: null }).where(eq(schema.users.id, req.user.sub))
    return { ok: true }
  })

  app.get("/me/sessions", { preHandler: [app.authenticate], config: LIMITS.sessions }, async (req) => ({ sessions: await listSessions(req.user.sub, req) }))

  app.delete("/me/sessions/:id", { preHandler: [app.authenticate], config: LIMITS.sessions, schema: { params: z.object({ id: z.string() }) } }, async (req, reply) => {
    const ok = await revokeSessionById(req.user.sub, req.params.id)
    return ok ? { ok: true } : reply.notFound()
  })

  app.post("/me/sessions/revoke-others", { preHandler: [app.authenticate], config: LIMITS.sessions }, async (req) => ({ revoked: await revokeOtherSessions(req.user.sub, req) }))

  app.get("/me/export", { preHandler: [app.authenticate], config: LIMITS.export }, async (req, reply) => {
    const data = await loadUserData(req.user.sub)
    reply.header("Content-Disposition", `attachment; filename="welya-export-${new Date().toISOString().slice(0, 10)}.json"`)
    return { exportedAt: new Date().toISOString(), ...data }
  })

  app.delete("/me", { preHandler: [app.authenticate], config: LIMITS.deleteAccount, schema: { body: z.object({ password: z.string().optional() }) } }, async (req, reply) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.user.sub))
    if (!user) return reply.unauthorized()
    // Google-only accounts have no password to confirm with; the JWT is the proof of ownership
    if (user.passwordHash && !(await bcrypt.compare(req.body.password ?? "", user.passwordHash))) return reply.unauthorized("Password is incorrect.")
    await revokeUserSessions(user.id)
    await db.delete(schema.users).where(eq(schema.users.id, user.id)) // cascades to all user data
    return { ok: true }
  })
}
