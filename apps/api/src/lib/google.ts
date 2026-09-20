import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.js"
import { env, googleEnabled } from "../env.js"

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const REVOKE_URL = "https://oauth2.googleapis.com/revoke"
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

export const IDENTITY_SCOPES = ["openid", "email", "profile"]

// Scopes requested per Welya integration id. Gmail is read-only; Calendar and Tasks sync both ways.
export const INTEGRATION_SCOPES: Record<string, string[]> = {
  gmail: ["https://www.googleapis.com/auth/gmail.readonly"],
  "google-calendar": ["https://www.googleapis.com/auth/calendar.events"],
  "google-tasks": ["https://www.googleapis.com/auth/tasks"],
}
export const GOOGLE_INTEGRATIONS = Object.keys(INTEGRATION_SCOPES)
export const isGoogleIntegration = (id: string) => id in INTEGRATION_SCOPES

/* ---------- signed state (CSRF protection for the OAuth round trip) ---------- */

type LoginState = { purpose: "login"; nonce: string; exp: number }
type IntegrationState = { purpose: "integration"; userId: string; integration: string; nonce: string; exp: number }
export type OAuthState = LoginState | IntegrationState

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url")
const sign = (payload: string) => createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url")

export function encodeState(state: Omit<LoginState, "nonce" | "exp"> | Omit<IntegrationState, "nonce" | "exp">) {
  const payload = b64(JSON.stringify({ ...state, nonce: randomBytes(8).toString("hex"), exp: Date.now() + 10 * 60_000 }))
  return `${payload}.${sign(payload)}`
}

export function decodeState(raw: string): OAuthState | null {
  const [payload, sig] = raw.split(".")
  if (!payload || !sig) return null
  const expected = sign(payload)
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString()) as OAuthState
    return state.exp > Date.now() ? state : null
  } catch {
    return null
  }
}

/* ---------- OAuth endpoints ---------- */

export function authorizationUrl({ scopes, state, redirectUri, loginHint, consent = false }: { scopes: string[]; state: string; redirectUri: string; loginHint?: string; consent?: boolean }) {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [...new Set([...IDENTITY_SCOPES, ...scopes])].join(" "),
    state,
    access_type: "offline",
    include_granted_scopes: "true",
    // Google only returns a refresh token on consent; force it when we need offline access
    prompt: consent ? "consent" : "select_account",
  })
  if (loginHint) params.set("login_hint", loginHint)
  return `${AUTH_URL}?${params}`
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope: string; id_token?: string; token_type: string }

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, ...body }) })
  const json = (await res.json()) as TokenResponse & { error?: string; error_description?: string }
  if (!res.ok) throw new GoogleError(json.error ?? "token_error", json.error_description ?? `Google token endpoint returned ${res.status}`)
  return json
}

export const exchangeCode = (code: string, redirectUri: string) => tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" })
const refreshAccessToken = (refreshToken: string) => tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" })

export async function revokeToken(token: string) {
  await fetch(REVOKE_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) }).catch(() => {})
}

export type GoogleProfile = { sub: string; email: string; email_verified?: boolean; name?: string; picture?: string }
export async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new GoogleError("userinfo_failed", `Google userinfo returned ${res.status}`)
  return (await res.json()) as GoogleProfile
}

export class GoogleError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

/* ---------- token storage + authorized fetch ---------- */

export async function saveTokens(userId: string, email: string, t: TokenResponse) {
  const [existing] = await db.select().from(schema.oauthTokens).where(and(eq(schema.oauthTokens.userId, userId), eq(schema.oauthTokens.provider, "google")))
  const scope = [...new Set([...(existing?.scope.split(" ") ?? []), ...t.scope.split(" ")])].filter(Boolean).join(" ")
  const values = {
    userId,
    provider: "google",
    email,
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? existing?.refreshToken ?? null,
    expiresAt: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    scope,
    updatedAt: new Date().toISOString(),
  }
  await db.insert(schema.oauthTokens).values(values).onConflictDoUpdate({ target: [schema.oauthTokens.userId, schema.oauthTokens.provider], set: values })
  return values
}

export async function getGoogleTokens(userId: string) {
  const [row] = await db.select().from(schema.oauthTokens).where(and(eq(schema.oauthTokens.userId, userId), eq(schema.oauthTokens.provider, "google")))
  return row ?? null
}

export const deleteGoogleTokens = (userId: string) => db.delete(schema.oauthTokens).where(and(eq(schema.oauthTokens.userId, userId), eq(schema.oauthTokens.provider, "google")))

export const hasScopes = (granted: string, wanted: string[]) => wanted.every((s) => granted.split(" ").includes(s))

// Returns a valid access token, refreshing it when it is about to expire
export async function getAccessToken(userId: string) {
  const row = await getGoogleTokens(userId)
  if (!row) throw new GoogleError("not_connected", "Google account is not connected.")
  if (new Date(row.expiresAt).getTime() - Date.now() > 60_000) return row.accessToken
  if (!row.refreshToken) throw new GoogleError("reauth_required", "Google session expired — reconnect the integration.")
  try {
    const t = await refreshAccessToken(row.refreshToken)
    const saved = await saveTokens(userId, row.email, t)
    return saved.accessToken
  } catch (e) {
    // invalid_grant = user revoked access in their Google account; force a fresh connect
    if (e instanceof GoogleError && e.code === "invalid_grant") {
      await deleteGoogleTokens(userId)
      await db.update(schema.integrations).set({ status: "error" }).where(and(eq(schema.integrations.userId, userId)))
      throw new GoogleError("reauth_required", "Google access was revoked — reconnect the integration.")
    }
    throw e
  }
}

export async function googleFetch<T>(userId: string, url: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken(userId)
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new GoogleError(res.status === 401 ? "reauth_required" : res.status === 403 ? "insufficient_scope" : "api_error", `Google API ${res.status}: ${text.slice(0, 300)}`)
  }
  // DELETE and some PATCH calls answer 204 with an empty body
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export async function googleFetchRaw(userId: string, url: string) {
  const token = await getAccessToken(userId)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new GoogleError("api_error", `Google API ${res.status}`)
  return res
}

export { googleEnabled }
