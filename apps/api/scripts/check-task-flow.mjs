// Smoke test: "Buatkan tugas … due Jumat" → create-task action must carry a strict ISO deadline that POST /tasks accepts.
const API = process.env.API_URL ?? "http://localhost:4000"
const json = async (path, init = {}, token) => {
  const res = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}
const login = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "nadia.putri@student.univ.ac.id", password: "welya123" }) })
const token = login.body.token

const r = await json("/api/ai/chat", { method: "POST", body: JSON.stringify({ message: "Buatkan tugas Baca Bab 7 Rekayasa Perangkat Lunak, due Jumat", conversationId: null, persist: false }) }, token)
const ai = r.body.messages.find((m) => m.role === "assistant")
console.log(`source=${ai.source}`)
const task = (ai.actions ?? []).find((a) => a.kind === "create-task")
for (const a of ai.actions ?? []) console.log(`  kind=${a.kind} label=${JSON.stringify(a.label)}${a.kind === "create-task" ? ` deadline=${a.deadline} minutes=${a.estimatedMinutes} priority=${a.priority}` : ""}`)
if (!task) {
  console.log("FAIL: no create-task action")
  process.exit(1)
}
const isoOk = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(task.deadline)
console.log(isoOk ? "deadline is strict ISO" : `FAIL: deadline not ISO: ${task.deadline}`)

const created = await json("/api/tasks", { method: "POST", body: JSON.stringify({ title: task.title, description: task.description ?? "", deadline: task.deadline, estimatedMinutes: task.estimatedMinutes, priority: task.priority, courseId: null, workspaceId: null, source: { type: "assistant", label: "smoke" } }) }, token)
console.log(`POST /tasks → ${created.status}`)
if (created.status === 201) await json(`/api/tasks/${created.body.id}`, { method: "DELETE" }, token)
process.exitCode = isoOk && created.status === 201 ? 0 : 1
console.log(process.exitCode === 0 ? "PASS" : "FAIL")
