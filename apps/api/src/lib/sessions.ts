import { createHash, randomBytes, randomUUID } from "node:crypto"
import { and, eq, gt, inArray, isNull } from "drizzle-orm"
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import { db, schema } from "../db/client.js"
import { env } from "../env.js"

export const REFRESH_COOKIE = "welya.refresh"
const cookiePath = "/api/auth"

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")
const maxAge = env.SESSION_TTL_DAYS * 24 * 60 * 60

export function accessToken(app: FastifyInstance, user: { id: string; email: string }) {
  return app.jwt.sign({ sub: user.id, email: user.email })
}

export async function createSession(app: FastifyInstance, user: { id: string; email: string }, req: FastifyRequest, reply: FastifyReply) {
  const raw = randomBytes(48).toString("base64url")
  await db.insert(schema.sessions).values({
    id: randomUUID(),
    userId: user.id,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + maxAge * 1000).toISOString(),
    userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
    ip: req.ip,
  })
  reply.setCookie(REFRESH_COOKIE, raw, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: cookiePath,
    maxAge,
  })
  return accessToken(app, user)
}

// A refresh token that was rotated within this window is still honoured (no second rotation, no new cookie)
// so parallel refreshes from the same browser don't log the user out. Older revoked tokens stay rejected.
const ROTATION_GRACE_MS = 30_000

export async function rotateSession(app: FastifyInstance, req: FastifyRequest, reply: FastifyReply) {
  const raw = req.cookies[REFRESH_COOKIE]
  if (!raw) return null
  const [session] = await db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, hashToken(raw)), gt(schema.sessions.expiresAt, new Date().toISOString())))
    .limit(1)
  if (!session) return null

  const { revokedAt } = session.session
  if (revokedAt) {
    const withinGrace = Date.now() - new Date(revokedAt).getTime() < ROTATION_GRACE_MS
    if (!withinGrace) return null
    // The browser already holds the successor cookie from the first rotation; just mint an access token.
    return { token: accessToken(app, session.user), user: session.user }
  }

  await db.update(schema.sessions).set({ revokedAt: new Date().toISOString() }).where(eq(schema.sessions.id, session.session.id))
  const token = await createSession(app, session.user, req, reply)
  return { token, user: session.user }
}

export async function revokeSession(req: FastifyRequest, reply: FastifyReply) {
  const raw = req.cookies[REFRESH_COOKIE]
  if (raw) await db.update(schema.sessions).set({ revokedAt: new Date().toISOString() }).where(eq(schema.sessions.tokenHash, hashToken(raw)))
  reply.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax", path: cookiePath })
}

export async function revokeUserSessions(userId: string) {
  await db.update(schema.sessions).set({ revokedAt: new Date().toISOString() }).where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)))
}

/* ---------- active-sessions management (Settings → Account → Security) ---------- */

const currentSessionHash = (req: FastifyRequest) => {
  const raw = req.cookies[REFRESH_COOKIE]
  return raw ? hashToken(raw) : null
}

export async function listSessions(userId: string, req: FastifyRequest) {
  const mine = currentSessionHash(req)
  const rows = await db
    .select({ id: schema.sessions.id, tokenHash: schema.sessions.tokenHash, createdAt: schema.sessions.createdAt, expiresAt: schema.sessions.expiresAt, userAgent: schema.sessions.userAgent, ip: schema.sessions.ip })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt), gt(schema.sessions.expiresAt, new Date().toISOString())))
  return rows
    .map(({ tokenHash, ...s }) => ({ ...s, current: tokenHash === mine, device: describeUserAgent(s.userAgent) }))
    .sort((a, b) => Number(b.current) - Number(a.current) || b.createdAt.localeCompare(a.createdAt))
}

export async function revokeSessionById(userId: string, sessionId: string) {
  const [row] = await db.update(schema.sessions).set({ revokedAt: new Date().toISOString() }).where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt))).returning({ id: schema.sessions.id })
  return Boolean(row)
}

// Revoke every session except the one making the request
export async function revokeOtherSessions(userId: string, req: FastifyRequest) {
  const mine = currentSessionHash(req)
  const rows = await db.select({ id: schema.sessions.id, tokenHash: schema.sessions.tokenHash }).from(schema.sessions).where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)))
  const others = rows.filter((r) => r.tokenHash !== mine).map((r) => r.id)
  if (others.length) await db.update(schema.sessions).set({ revokedAt: new Date().toISOString() }).where(inArray(schema.sessions.id, others))
  return others.length
}

// "Chrome on Windows" from a UA string; good enough for a sessions list without a UA-parser dependency
function describeUserAgent(ua: string) {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Tauri|wry/i.test(ua) ? "Welya desktop" : "Unknown browser"
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "unknown OS"
  return `${browser} on ${os}`
}
