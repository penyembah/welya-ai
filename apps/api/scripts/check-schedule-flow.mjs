// Smoke test: timetable in chat → confirmation → schedule-courses action must carry rows.
// Usage: node scripts/check-schedule-flow.mjs   (API on :4000, demo user seeded)
const API = process.env.API_URL ?? "http://localhost:4000"
const json = async (path, init = {}, token) => {
  const res = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

const login = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "nadia.putri@student.univ.ac.id", password: "welya123" }) })
const token = login.body.token
const timetable = "Berikut jadwal semester I yang terlihat di gambar:\n\n- **Selasa 10.00–12.00** — Pengembangan Sistem Informasi (Prof. Mustafid)\n- **Rabu 07.30–10.00** — Interaksi Manusia dan Komputer (Dr. Gernowo)\n\nMau aku tambahkan ke kalendermu?"

const first = await json("/api/ai/chat", { method: "POST", body: JSON.stringify({ message: timetable, conversationId: null, persist: true }) }, token)
const cid = first.body.conversation.id
const show = (label, r) => {
  const ai = r.body.messages.find((m) => m.role === "assistant")
  console.log(`${label}: source=${ai.source}`)
  for (const a of ai.actions ?? []) console.log(`  kind=${a.kind} label=${JSON.stringify(a.label)} rows=${Array.isArray(a.schedule) ? a.schedule.length : 0}`)
  return ai
}
show("FIRST", first)
const second = await json("/api/ai/chat", { method: "POST", body: JSON.stringify({ message: "Ya, tambahkan ke kalender", conversationId: cid, persist: true }) }, token)
const ai2 = show("SECOND", second)
const ok = (ai2.actions ?? []).some((a) => a.kind === "schedule-courses" && Array.isArray(a.schedule) && a.schedule.length === 2)
console.log(ok ? "PASS: schedule-courses action carries 2 rows" : "FAIL: no schedule-courses action with rows")
await json(`/api/conversations/${cid}`, { method: "DELETE" }, token)
process.exitCode = ok ? 0 : 1
