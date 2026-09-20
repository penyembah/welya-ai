// Smoke test for the reminder scheduler: trigger the daily + weekly briefings for the demo user
// and confirm notifications were written (emails go out through Brevo when SMTP is configured).
const API = process.env.API_URL ?? "http://localhost:4000"
const json = async (path, init = {}, token) => {
  const res = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}
const login = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "nadia.putri@student.univ.ac.id", password: "welya123" }) })
const token = login.body.token
const before = (await json("/api/bootstrap", {}, token)).body.notifications.length

const daily = await json("/api/ai/briefing/daily", { method: "POST", body: "{}" }, token)
const weekly = await json("/api/ai/briefing/weekly", { method: "POST", body: "{}" }, token)
console.log(`daily → ${daily.status} ${JSON.stringify(daily.body)}`)
console.log(`weekly → ${weekly.status} ${JSON.stringify(weekly.body)}`)

const boot = (await json("/api/bootstrap", {}, token)).body
const added = boot.notifications.length - before
console.log(`notifications: ${before} → ${boot.notifications.length} (+${added})`)
for (const n of boot.notifications.slice(0, 2)) console.log(`  [${n.type}] ${n.title} — ${n.message}`)
const ok = daily.status === 200 && weekly.status === 200 && added === 2
console.log(ok ? "PASS" : "FAIL")
process.exitCode = ok ? 0 : 1
