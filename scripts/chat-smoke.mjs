// Smoke test: login as the demo user and send tool-triggering prompts to /api/ai/chat.
const API = process.env.API_URL ?? "http://localhost:4000"
const prompts = process.argv.slice(2).length ? process.argv.slice(2) : ["Buatkan event Bimbingan Skripsi dengan Pak Anggit hari Selasa minggu ini jam 2 siang sampai jam 4 sore di Kampus 2 UHB", "apakah di kalender sudah ada?"]

const login = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "nadia.putri@student.univ.ac.id", password: "welya123" }) })
if (!login.ok) throw new Error(`login failed ${login.status}: ${await login.text()}`)
const { token } = await login.json()

let conversationId = null
for (const message of prompts) {
  const t0 = Date.now()
  const res = await fetch(`${API}/api/ai/chat`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ message, conversationId, persist: true }) })
  const body = await res.json()
  conversationId = body.conversation?.id ?? conversationId
  const ai = body.messages?.at(-1)
  console.log(`\n> ${message}\n[${res.status} ${Date.now() - t0}ms source=${ai?.source} changed=${body.changed}]\n${ai?.content}\nactions: ${JSON.stringify(ai?.actions)}\nrefs: ${JSON.stringify(ai?.references)}`)
}
