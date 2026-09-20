// Smoke test for account security: sessions list/revoke, password change, email change with code.
// Uses a throwaway user so the demo account is untouched.
const API = process.env.API_URL ?? "http://localhost:4000"
const jar = new Map()
const req = async (path, init = {}, token) => {
  const res = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(jar.size ? { Cookie: [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ") } : {}), ...(init.headers ?? {}) } })
  for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const [k, v] = kv.split("="); if (/Max-Age=0/.test(c)) jar.delete(k); else jar.set(k, v) }
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}
const step = (label, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`); if (!ok) process.exitCode = 1 }

const stamp = Date.now()
const email = `sec-${stamp}@example.test`
const pw1 = "Password1A", pw2 = "Password2B"

// register + verify (dev code exposed)
const reg = await req("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Sec Test", email, password: pw1, university: "UT" }) })
const ver = await req("/api/auth/verify", { method: "POST", body: JSON.stringify({ email, code: reg.body.devCode }) })
let token = ver.body.token
step("register+verify", ver.status === 200 && !!token)

// second session from "another device"
jar.clear()
const login2 = await req("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: pw1 }), headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) Chrome/128" } })
const token2 = login2.body.token
const s = await req("/api/me/sessions", {}, token2)
step("sessions list", s.status === 200 && s.body.sessions.length === 2 && s.body.sessions.some((x) => x.current), `count=${s.body.sessions?.length} devices=${s.body.sessions?.map((x) => x.device).join(" | ")}`)

// revoke others from device 2 → device 1's cookie is dead
const ro = await req("/api/me/sessions/revoke-others", { method: "POST", body: "{}" }, token2)
step("revoke others", ro.status === 200 && ro.body.revoked === 1)

// change password (needs current); wrong current is rejected
const bad = await req("/api/me/password", { method: "POST", body: JSON.stringify({ currentPassword: "nope", newPassword: pw2 }) }, token2)
const good = await req("/api/me/password", { method: "POST", body: JSON.stringify({ currentPassword: pw1, newPassword: pw2 }) }, token2)
step("change password", bad.status === 401 && good.status === 200 && good.body.user.hasPassword === true)
jar.clear()
const relogin = await req("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: pw2 }) })
step("login with new password", relogin.status === 200)
token = relogin.body.token

// email change: request → code to new address (dev) → confirm → new token/email
const newEmail = `sec-${stamp}-new@example.test`
const er = await req("/api/me/email", { method: "POST", body: JSON.stringify({ email: newEmail, password: pw2 }) }, token)
step("email change request", er.status === 200 && er.body.pendingEmail === newEmail && !!er.body.devCode)
const me1 = await req("/api/auth/me", {}, token)
step("pendingEmail visible", me1.body.user.pendingEmail === newEmail)
const badCode = await req("/api/me/email/confirm", { method: "POST", body: JSON.stringify({ code: "000000" }) }, token)
const ec = await req("/api/me/email/confirm", { method: "POST", body: JSON.stringify({ code: er.body.devCode }) }, token)
step("email change confirm", badCode.status === 400 && ec.status === 200 && ec.body.user.email === newEmail && ec.body.user.pendingEmail === null && !!ec.body.token)
jar.clear()
const loginNew = await req("/api/auth/login", { method: "POST", body: JSON.stringify({ email: newEmail, password: pw2 }) })
const loginOld = await req("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: pw2 }) })
step("login with new email only", loginNew.status === 200 && loginOld.status === 401)

// PATCH /me must not accept email any more
const patch = await req("/api/me", { method: "PATCH", body: JSON.stringify({ email: "hijack@example.test", name: "Sec Test 2" }) }, loginNew.body.token)
const me2 = await req("/api/auth/me", {}, loginNew.body.token)
step("PATCH /me ignores email", me2.body.user.email === newEmail && me2.body.user.name === "Sec Test 2", `patch=${patch.status}`)

// cleanup
await req("/api/me", { method: "DELETE", body: JSON.stringify({ password: pw2 }) }, loginNew.body.token)
console.log(process.exitCode ? "SOME CHECKS FAILED" : "ALL PASS")
