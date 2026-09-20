// Smoke test: two concurrent refreshes with the same cookie must both succeed (rotation + grace).
const API = process.env.API_URL ?? "http://localhost:4000"
const login = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "nadia.putri@student.univ.ac.id", password: "welya123" }) })
const cookie = login.headers.getSetCookie().find((c) => c.startsWith("welya.refresh="))?.split(";")[0]
console.log(`login=${login.status} cookie=${cookie ? "set" : "MISSING"}`)
const refresh = () => fetch(`${API}/api/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: "{}" })
const [a, b] = await Promise.all([refresh(), refresh()])
console.log(`parallel refresh: ${a.status} ${b.status}`)
// A third call with the OLD cookie after grace would fail; with the NEW cookie it must work
const newCookie = [a, b].flatMap((r) => r.headers.getSetCookie()).find((c) => c.startsWith("welya.refresh=") && !c.includes("Max-Age=0"))?.split(";")[0]
const c = await fetch(`${API}/api/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: newCookie }, body: "{}" })
console.log(`refresh with rotated cookie: ${c.status}`)
const ok = a.status === 200 && b.status === 200 && c.status === 200
console.log(ok ? "PASS" : "FAIL")
process.exitCode = ok ? 0 : 1
