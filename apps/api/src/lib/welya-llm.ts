import { format, isSameDay } from "date-fns"
import type { FastifyBaseLogger } from "fastify"
import { loadUserData, type UserData } from "./data.js"
import { llmJson, llmWithTools, S } from "./llm.js"
import { llmEnabled } from "../env.js"
import * as rules from "./welya-ai.js"
import type { ChatContext, Reply } from "./welya-ai.js"
import { createToolRunner, hasEffects, type Effects } from "./welya-tools.js"

/**
 * LLM-backed implementations (Azure AI Foundry). Each function degrades to the
 * deterministic rule engine when the model is unavailable or returns junk.
 */

export type WithSource<T> = T & { source: "llm" | "rules" }

const PERSONA = `You are Welya, an AI academic secretary for a university student. You are concise, warm and practical.
You only know what is in the CONTEXT block; never invent tasks, courses, dates or files that are not listed.
All dates/times in the context are already in the student's local time in a human format (e.g. "Sat 20 Sep 23:59") — quote them like that, never as ISO timestamps or with timezone suffixes. Answer in the same language the user writes in (Indonesian or English).
Format replies in GitHub-flavoured Markdown: short paragraphs, "-" bullet lists for multiple items, **bold** for task names and times, a small table only when comparing several items. No headings larger than ###. Never wrap the whole answer in a code block. Never print internal ids or UUIDs (like [t4] or 1ddbb32a-…) and never add a "References" line — the app shows links itself.`

type Task = UserData["tasks"][number]

// Human, local-time dates for the prompt; raw ISO leaks into replies otherwise
const hd = (iso: string) => format(new Date(iso), "EEE d MMM HH:mm")

function contextBlock(data: UserData, ctx: ChatContext = {}) {
  const now = new Date()
  const open = data.tasks.filter((t) => t.status !== "done").sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  const scoped = ctx.courseId ? open.filter((t) => t.courseId === ctx.courseId) : ctx.workspaceId ? open.filter((t) => t.workspaceId === ctx.workspaceId) : open
  const course = (id: string | null) => data.courses.find((c) => c.id === id)?.name ?? null
  const fmtTask = (t: Task) => `- [${t.id}] "${t.title}" | course: ${course(t.courseId) ?? "-"} | due: ${hd(t.deadline)} (${rules.relativeDeadline(t.deadline)}) | priority: ${t.priority} | status: ${t.status} | progress: ${t.progress}% | est: ${t.estimatedMinutes}m${t.subtasks.length ? ` | subtasks: ${t.subtasks.map((s) => `${s.done ? "[x]" : "[ ]"} ${s.title}`).join("; ")}` : ""}`
  const todayEvents = data.events.filter((e) => isSameDay(new Date(e.start), now)).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  const week = data.events.filter((e) => { const d = new Date(e.start); return d > now && d.getTime() - now.getTime() < 7 * 86_400_000 }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()).slice(0, 25)
  const inbox = data.inboxItems.filter((i) => i.status === "unprocessed").slice(0, 8)
  const doc = ctx.documentId ? data.documents.find((d) => d.id === ctx.documentId) : null
  const freeToday = rules.freeSlotsFor(now, data.events).map((s) => `${format(s.start, "HH:mm")}–${format(s.end, "HH:mm")}`)

  return [
    `CONTEXT`,
    `Now: ${format(now, "EEEE, d MMMM yyyy HH:mm")} (local time, UTC${format(now, "xxx")}; all times below are local — use this offset in ISO timestamps)`,
    `Student: ${data.user.name}, ${data.user.program} semester ${data.user.semester}, ${data.user.university}`,
    ctx.courseId ? `Focus course: ${course(ctx.courseId)}` : ctx.workspaceId ? `Focus workspace: ${data.workspaces.find((w) => w.id === ctx.workspaceId)?.name}` : "",
    doc ? `Focus document [${doc.id}] "${doc.title}" (${doc.type}, ${course(doc.courseId) ?? "no course"}): ${doc.content ?? doc.summary}` : "",
    `Courses: ${data.courses.map((c) => `[${c.id}] ${c.name} (${c.code}, ${c.lecturer}; ${c.schedule.map((s) => `${s.day} ${s.start}-${s.end} ${s.room}`).join(", ")})`).join(" | ")}`,
    `Open tasks (${scoped.length}):\n${scoped.slice(0, 20).map(fmtTask).join("\n") || "- none"}`,
    `Recently completed: ${data.tasks.filter((t) => t.status === "done").slice(0, 5).map((t) => `"${t.title}"`).join(", ") || "none"}`,
    `Today's events:\n${todayEvents.map((e) => `- [${e.id}] ${format(new Date(e.start), "HH:mm")}-${format(new Date(e.end), "HH:mm")} ${e.title} (${e.type}${e.location ? `, ${e.location}` : ""})`).join("\n") || "- none"}`,
    `Free slots today (08:00–18:00): ${freeToday.join(", ") || "none"}`,
    `Upcoming events (7 days):\n${week.map((e) => `- [${e.id}] ${hd(e.start)} ${e.title} (${e.type}${e.location ? `, ${e.location}` : ""})`).join("\n") || "- none"}`,
    `Unprocessed inbox (${inbox.length}):\n${inbox.map((i) => `- [${i.id}] from ${i.sender}: "${i.subject}" → ${(i.ai as { type?: string }).type ?? "?"}: ${(i.ai as { suggestion?: string }).suggestion ?? ""}`).join("\n") || "- none"}`,
    `Documents: ${data.documents.slice(0, 15).map((d) => `[${d.id}] ${d.title}`).join(", ") || "none"}`,
  ].filter(Boolean).join("\n")
}

/* ------------------------------------------------------------------ chat */

const fallbackConversationTitle = (prompt: string) => {
  const clean = prompt.replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim()
  if (!clean) return "New conversation"
  const title = clean.length > 52 ? `${clean.slice(0, 49).trimEnd()}…` : clean
  return title.charAt(0).toUpperCase() + title.slice(1)
}

export async function conversationTitle(prompt: string): Promise<string> {
  if (!llmEnabled) return fallbackConversationTitle(prompt)
  try {
    const out = await llmJson<{ title: string }>({
      name: "welya_conversation_title",
      schema: S.obj({ title: S.str("A concise 3–7 word title for this conversation") }),
      instructions: "Create a concise conversation title from the student's first message. Use the same language as the message. Return only the title, without quotes, punctuation at the end, Markdown, or emojis.",
      input: prompt.slice(0, 1000),
      effort: "minimal",
      maxOutputTokens: 40,
    })
    const title = out.title.replace(/[\r\n]+/g, " ").replace(/^['\"]|['\"]$/g, "").trim()
    if (!title) throw new Error("empty title")
    return title.slice(0, 80)
  } catch (e) {
    return fallbackConversationTitle(prompt)
  }
}

const ACTION_KINDS = ["navigate", "open-task", "plan", "plan-week", "schedule-courses", "create-task", "create-event", "breakdown", "prompt"]

const CALENDAR_WORDS = /kalender|calendar|jadwal|schedule|acara|event|tambah|add|masukkan|insert|\bya\b|yes/i
const NEGATIVE_WORDS = /jangan|belum|tidak|nanti|dulu|detail|koreksi|perbaiki|correct|fix|don't|do not|\bnot\b|ubah|change|edit|hapus|delete|remove/i

// Strips nulls, drops phantom ids, and guarantees schedule-courses carries concrete rows (from the model, else parsed from the reply/history).
function finalizeActions(rawActions: Array<Record<string, unknown>>, content: string, prompt: string, history: Array<{ role: string; content: string }>, taskIds: Set<string>, courseIds?: Set<string>) {
  const rows = [content, prompt, ...[...history].reverse().map((m) => m.content)].map((t) => rules.extractScheduleRows(t)).find((r) => r.length) ?? []
  const actions = rawActions
    .filter((a) => ACTION_KINDS.includes(a.kind as string))
    .filter((a) => !(["open-task", "breakdown"].includes(a.kind as string) && !taskIds.has(a.targetId as string)))
    .map((a) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0))))
    .map((a) => (a.kind === "create-task" ? normalizeTaskAction(a, courseIds) : a))
    .filter((a) => a.kind !== "create-task" || a.title)
    .map((a) => (a.kind === "create-event" ? normalizeEventAction(a, courseIds) : a))
    .filter((a) => a.kind !== "create-event" || a.title)
    // An affirmative "prompt" about adding the timetable is really a schedule-courses action; negative/edit prompts stay prompts
    .map((a) => (a.kind === "prompt" && rows.length && CALENDAR_WORDS.test(`${a.label ?? ""} ${a.prompt ?? ""}`) && !NEGATIVE_WORDS.test(`${a.label ?? ""} ${a.prompt ?? ""}`) ? { label: a.label, kind: "schedule-courses" } : a))
    .map((a) => (a.kind === "schedule-courses" && !Array.isArray(a.schedule) && rows.length ? { ...a, schedule: rows } : a))
    .filter((a) => a.kind !== "schedule-courses" || Array.isArray(a.schedule))
  // If the reply lists a timetable but offers no way to add it, add the button ourselves
  if (rows.length && !actions.some((a) => a.kind === "schedule-courses")) actions.unshift({ label: "Add to calendar", kind: "schedule-courses", schedule: rows })
  return actions.slice(0, 3)
}

// The model writes deadlines like "2026-09-24 23:59" or "24 Sep 2026"; the tasks API needs strict ISO with offset.
export function toIsoDeadline(value: unknown, fallbackDays = 7): string {
  const fallback = () => {
    const d = new Date(Date.now() + fallbackDays * 86_400_000)
    d.setHours(23, 59, 0, 0)
    return d.toISOString()
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? fallback() : value.toISOString()
  if (typeof value !== "string" || !value.trim()) return fallback()
  const s = value.trim()
  const candidates = [s, s.replace(" ", "T"), /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T23:59:00` : "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? `${s}:00` : ""].filter(Boolean)
  for (const c of candidates) {
    const d = new Date(c)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return fallback()
}

function normalizeTaskAction(a: Record<string, unknown>, courseIds?: Set<string>): Record<string, unknown> {
  const minutes = Number(a.estimatedMinutes)
  const priority = ["high", "medium", "low"].includes(String(a.priority)) ? String(a.priority) : "medium"
  const courseId = typeof a.courseId === "string" && (!courseIds || courseIds.has(a.courseId)) ? a.courseId : undefined
  return {
    ...a,
    title: rules.cleanTaskTitle(String(a.title ?? "")),
    description: typeof a.description === "string" ? a.description.slice(0, 2000) : "",
    deadline: toIsoDeadline(a.deadline),
    estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 60,
    priority,
    ...(courseId ? { courseId } : {}),
  }
}

const EVENT_TYPES = ["class", "meeting", "reminder", "work-session", "deadline"]

function normalizeEventAction(a: Record<string, unknown>, courseIds?: Set<string>): Record<string, unknown> {
  const title = String(a.title ?? "").replace(/\s+/g, " ").trim().slice(0, 200)
  const startMs = new Date(String(a.start ?? "")).getTime()
  if (!title || Number.isNaN(startMs)) return { ...a, title: "" }
  const endMs = new Date(String(a.end ?? "")).getTime()
  const end = Number.isNaN(endMs) || endMs <= startMs ? startMs + 60 * 60_000 : endMs
  const courseId = typeof a.courseId === "string" && (!courseIds || courseIds.has(a.courseId)) ? a.courseId : undefined
  return {
    label: a.label,
    kind: "create-event",
    title,
    eventType: EVENT_TYPES.includes(String(a.eventType)) ? String(a.eventType) : "meeting",
    start: new Date(startMs).toISOString(),
    end: new Date(end).toISOString(),
    ...(typeof a.location === "string" && a.location.trim() ? { location: a.location.trim().slice(0, 200) } : {}),
    ...(courseId ? { courseId } : {}),
  }
}


const replySchema = S.obj({
  content: S.str("The reply to the student in Markdown. 1–6 sentences, or a short bullet list when listing tasks/times."),
  references: S.arr(S.obj({ type: S.enum(["task", "inbox", "document"]), id: S.str("Exact id from the context"), label: S.str() }), "Items you mention. Only ids that exist in CONTEXT."),
  actions: S.arr(
    S.obj({
      label: S.str("Short button label"),
      kind: S.enum(ACTION_KINDS),
      targetId: S.nstr("Task id for open-task / breakdown, else null"),
      to: S.nstr("App route for navigate: /tasks, /tasks?view=overdue, /calendar, /inbox, /documents, /courses, else null"),
      date: S.nstr("ISO date for plan (which day to plan), else null"),
      prompt: S.nstr("Follow-up question text for kind=prompt, else null"),
      title: S.nstr("Task title for kind=create-task, else null. A clean, specific noun phrase like an assignment name (e.g. \"Landing Page Pemrograman Web\", \"Laporan Praktikum Modul 4\"), 3–8 words, capitalised, in the student's language. Never copy the request verbatim; no leading verbs like buat/membuat/create, no 'tugas'/'task' prefix, no course name if courseId is set."),
      courseId: S.nstr("Exact course id from CONTEXT for kind=create-task when the task belongs to a course, else null"),
      deadline: S.nstr("Deadline for kind=create-task as a full ISO-8601 datetime with timezone offset, e.g. 2026-09-24T23:59:00+07:00; else null"),
      description: S.nstr("Task description for kind=create-task: one or two sentences describing the deliverable (what, for which course, any details the student gave), else null"),
      estimatedMinutes: { type: ["number", "null"], description: "Estimated task duration in minutes for kind=create-task, else null" },
      priority: { type: ["string", "null"], enum: ["high", "medium", "low", null], description: "Task priority for kind=create-task, else null" },
      start: S.nstr("Event start for kind=create-event as a full ISO-8601 datetime with timezone offset, e.g. 2026-09-22T14:00:00+07:00; else null"),
      end: S.nstr("Event end for kind=create-event as a full ISO-8601 datetime with timezone offset; else null"),
      location: S.nstr("Event location for kind=create-event, else null"),
      eventType: { type: ["string", "null"], enum: ["class", "meeting", "reminder", "work-session", "deadline", null], description: "Event type for kind=create-event (meeting for consultations/thesis supervision), else null" },
      schedule: {
        type: "array",
        description: "Extracted weekly class rows for kind=schedule-courses, else an empty array",
        items: S.obj({
          title: S.str("Course name"),
          day: S.str("Weekday in Indonesian or English"),
          start: S.str("Start time, HH:mm or HH.mm"),
          end: S.str("End time, HH:mm or HH.mm"),
          location: S.nstr("Room or location, else null"),
        }),
      },
    }),
    "0–3 suggested actions the app can execute"
  ),
})

const CHAT_INSTRUCTIONS = `${PERSONA}
You manage the student's data through TOOLS. When the student asks to create, change, complete, delete or schedule something, you MUST call the matching tool — never claim something was recorded without a tool call, and never describe what a button will do (there are no buttons). Use ids from CONTEXT for updates/deletes. Compute ISO-8601 timestamps from "Now" using the stated UTC offset.
Act as soon as you have a title and a date/time; assume sensible defaults instead of asking (deadline 23:59, events 1 hour, priority medium) and mention the assumption in one short clause. Ask a question only when something essential is genuinely missing (e.g. no date at all). Per-event reminders do not exist — do not offer them.
Task titles: short syllabus-style noun phrases naming the deliverable (e.g. "Landing Page Pemrograman Web", "Laporan Praktikum Modul 4"), never the student's sentence, no leading verbs. Link tasks/events to the matching course id. For non-trivial tasks include 3–6 concrete subtasks.
After tools run, confirm in one or two sentences using the tool RESULT (real titles, dates, counts). If a tool returns ok=false, say so honestly and suggest what to do. If "note" says it already exists, tell the student it was already there.
CONTEXT is the only source of truth; anything mentioned in earlier messages but missing from CONTEXT has been deleted. For questions (what's due, what to focus on) answer from CONTEXT, prioritising by deadline then priority, and mention concrete free slots when relevant.`

function actionsFromEffects(effects: Effects, data: UserData): { actions: Array<Record<string, unknown>>; references: Reply["references"] } {
  const actions: Array<Record<string, unknown>> = []
  const references: Reply["references"] = []
  for (const t of [...effects.tasksCreated, ...effects.tasksUpdated].slice(0, 3)) {
    if (!references.some((r) => r.id === t.id)) references.push({ type: "task", id: t.id, label: t.title })
  }
  const firstTask = effects.tasksCreated[0] ?? effects.tasksUpdated[0]
  if (firstTask && data.tasks.some((t) => t.id === firstTask.id)) actions.push({ label: "Open task", kind: "open-task", targetId: firstTask.id })
  else if (firstTask) actions.push({ label: "Open tasks", kind: "navigate", to: "/tasks" })
  if (effects.eventsCreated.length || effects.eventsUpdated.length || effects.sessionsAdded || effects.classEventsAdded) {
    actions.push({ label: "Open calendar", kind: "navigate", to: effects.classEventsAdded ? "/calendar?view=month" : "/calendar?view=week" })
  }
  return { actions, references }
}

// Models occasionally echo ids from CONTEXT; the UI renders references as chips instead.
const UUID = /\[?\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b\]?/gi
function scrubIds(text: string) {
  return text
    .split("\n")
    .filter((line) => !/^\s*(references?|referensi|id acara|id tugas)\s*:/i.test(line))
    .join("\n")
    .replace(UUID, "")
    .replace(/\(\s*\)|\[\s*\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export async function chat(prompt: string, data: UserData, ctx: ChatContext = {}, history: Array<{ role: string; content: string }> = [], log?: FastifyBaseLogger): Promise<WithSource<Reply> & { effects?: Effects }> {
  if (!llmEnabled) return { ...rules.generateReply(prompt, data, ctx, history), source: "rules" }
  const runner = createToolRunner(data.user.id, data, log)
  try {
    const { text, calls } = await llmWithTools({
      instructions: CHAT_INSTRUCTIONS,
      tools: runner.tools,
      execute: runner.run,
      input: [
        { role: "developer", content: contextBlock(data, ctx) },
        ...history.slice(-8).map((m) => ({ role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant", content: m.content })),
        { role: "user", content: prompt },
      ],
      effort: "minimal",
      maxOutputTokens: 1500,
    })
    log?.info({ tools: calls.map((c) => ({ name: c.name, ok: (c.result as { ok?: boolean })?.ok })) }, "chat tools")
    const changed = hasEffects(runner.effects)
    // Reload so buttons/references point at the rows that now exist
    const fresh = changed ? await loadUserData(data.user.id) : data
    const { actions, references } = actionsFromEffects(runner.effects, fresh)
    const rows = rules.extractScheduleRows(text)
    if (rows.length && !runner.effects.classEventsAdded) actions.unshift({ label: "Add to calendar", kind: "schedule-courses", schedule: rows })
    return { content: scrubIds(text), references, actions: actions.slice(0, 3), source: "llm", ...(changed ? { effects: runner.effects } : {}) }
  } catch (e) {
    // Tools may already have run before the failure; never pretend nothing happened
    if (hasEffects(runner.effects)) {
      const { actions, references } = actionsFromEffects(runner.effects, data)
      const done = [
        runner.effects.tasksCreated.length && `created ${runner.effects.tasksCreated.map((t) => `**${t.title}**`).join(", ")}`,
        runner.effects.tasksUpdated.length && `updated ${runner.effects.tasksUpdated.length} task(s)`,
        runner.effects.tasksDeleted.length && `deleted ${runner.effects.tasksDeleted.length} task(s)`,
        runner.effects.eventsCreated.length && `added ${runner.effects.eventsCreated.map((ev) => `**${ev.title}**`).join(", ")} to the calendar`,
        runner.effects.sessionsAdded && `planned ${runner.effects.sessionsAdded} work session(s)`,
        runner.effects.classEventsAdded && `added ${runner.effects.classEventsAdded} class events`,
      ].filter(Boolean).join("; ")
      return { content: `Done — ${done}.`, references, actions, source: "llm", effects: runner.effects, ...debug(e) }
    }
    return { ...rules.generateReply(prompt, data, ctx, history), source: "rules", ...debug(e) }
  }
}

export async function chatWithImage(prompt: string, imageDataUrl: string, data: UserData, ctx: ChatContext = {}, history: Array<{ role: string; content: string }> = []): Promise<WithSource<Reply>> {
  if (!llmEnabled) return { ...rules.generateReply(`${prompt}\n[An image was attached, but vision is not configured.]`, data, ctx), source: "rules" }
  try {
    const raw = await llmJson<Reply>({
      name: "welya_vision_reply",
      schema: replySchema,
      instructions: `${PERSONA}
The student attached an image. Read it carefully using vision. It may be a class timetable, assignment screenshot, exam announcement or academic document. Extract visible course names, weekdays, dates, times and locations without guessing hidden or unreadable details. When the image contains a timetable, present the schedule clearly in Markdown and include the same rows in the schedule field of the schedule-courses action. Never claim that an event was added unless the student confirms it through an app action.`,
      input: [
        { role: "developer", content: contextBlock(data, ctx) },
        ...history.slice(-6).map((m) => ({ role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant", content: m.content })),
        { role: "user", content: [{ type: "input_text", text: prompt || "Analyze this academic image and explain what I should add to my calendar." }, { type: "input_image", image_url: imageDataUrl }] },
      ],
      effort: "low",
      maxOutputTokens: 1200,
    })
    const ids = { task: new Set(data.tasks.map((t) => t.id)), inbox: new Set(data.inboxItems.map((i) => i.id)), document: new Set(data.documents.map((d) => d.id)) }
    const references = (raw.references ?? []).filter((r) => ids[r.type as keyof typeof ids]?.has(r.id)).slice(0, 5)
    return { content: raw.content, references, actions: finalizeActions(raw.actions ?? [], raw.content, prompt, history, ids.task), source: "llm" }
  } catch (e) {
    return { ...rules.generateReply(prompt || "Analyze the attached academic image.", data, ctx, history), source: "rules", ...debug(e) }
  }
}

/* ------------------------------------------------------------------ inbox interpretation */

const PRIMARY = ["Create Task", "Create Event", "Create Reminder", "Save as Note", "Update Task"]

const interpretSchema = S.obj({
  type: S.enum(["Academic Task", "Schedule Change", "Exam Announcement", "Deadline Update", "Assignment", "Lecture Material", "Administrative", "Personal Note", "Uploaded Document", "Screenshot", "Other"]),
  confidence: S.num("0–1"),
  courseId: S.nstr("Course id from the list if the message clearly belongs to one, else null"),
  importance: S.enum(["high", "normal", "low"]),
  fields: S.arr(S.obj({ label: S.str("e.g. Course, Task, Date, Time, Location, Deadline, Scope, Action"), value: S.str() }), "3–6 key facts extracted from the text"),
  suggestion: S.str("One sentence: what Welya proposes to do"),
  primaryAction: S.enum(PRIMARY),
})

export async function interpret(text: string, source: string, data: Pick<UserData, "courses">): Promise<WithSource<ReturnType<typeof rules.interpret>>> {
  if (!llmEnabled) return { ...rules.interpret(text, source, data.courses), source: "rules" }
  try {
    const out = await llmJson<{ type: string; confidence: number; courseId: string | null; importance: "high" | "normal" | "low"; fields: Array<{ label: string; value: string }>; suggestion: string; primaryAction: string }>({
      name: "welya_interpret",
      schema: interpretSchema,
      instructions: `${PERSONA}
Read one incoming message (email, chat, PDF text, screenshot OCR or manual note) and extract what matters for the student's planner.
Today is ${format(new Date(), "EEEE, d MMMM yyyy HH:mm")} (local). If the text names a weekday or relative day, keep it as written in the Date field (e.g. "Thursday", "Friday 23:59"). Use the course list to map to a courseId; null if unsure.
Courses: ${data.courses.map((c) => `[${c.id}] ${c.name} (${c.code})`).join(", ") || "none"}`,
      input: `Source: ${source}\n\n${text.slice(0, 6000)}`,
      effort: "minimal",
      maxOutputTokens: 600,
    })
    const courseId = data.courses.some((c) => c.id === out.courseId) ? out.courseId : null
    return {
      ai: { type: out.type, confidence: Math.max(0, Math.min(1, out.confidence)), fields: out.fields.slice(0, 8), suggestion: out.suggestion, primaryAction: PRIMARY.includes(out.primaryAction) ? out.primaryAction : "Save as Note" },
      courseId,
      importance: out.importance,
      source: "llm",
    }
  } catch (e) {
    return { ...rules.interpret(text, source, data.courses), source: "rules", ...debug(e) }
  }
}

/* ------------------------------------------------------------------ breakdown */

export async function breakdown(task: Task, data: UserData): Promise<WithSource<{ suggestions: string[] }>> {
  const existing = task.subtasks.map((s) => s.title)
  if (!llmEnabled) return { suggestions: rules.breakdownFor(task, existing), source: "rules" }
  try {
    const out = await llmJson<{ steps: string[] }>({
      name: "welya_breakdown",
      schema: S.obj({ steps: S.arr(S.str(), "3–8 concrete, ordered steps; each ≤ 60 characters; do not repeat existing subtasks") }),
      instructions: `${PERSONA}\nBreak an academic task into concrete subtasks a student can tick off. Order them chronologically. Match the language of the task title.`,
      input: `Task: "${task.title}"\nDescription: ${task.description || "-"}\nCourse: ${data.courses.find((c) => c.id === task.courseId)?.name ?? "-"}\nDeadline: ${hd(task.deadline)}\nEstimated: ${task.estimatedMinutes} minutes\nExisting subtasks: ${existing.join("; ") || "none"}\nAttachments: ${task.attachments.join(", ") || "none"}`,
      effort: "minimal",
      maxOutputTokens: 400,
    })
    const has = new Set(existing.map((s) => s.toLowerCase()))
    const steps = out.steps.map((s) => s.trim()).filter((s) => s && !has.has(s.toLowerCase())).slice(0, 8)
    if (!steps.length) throw new Error("empty")
    return { suggestions: steps, source: "llm" }
  } catch (e) {
    return { suggestions: rules.breakdownFor(task, existing), source: "rules", ...debug(e) }
  }
}

/* ------------------------------------------------------------------ documents */

type DocResult = ReturnType<typeof rules.analyzeDocument>

export async function analyzeDocument(doc: UserData["documents"][number], data: UserData, action: "summarize" | "tasks" | "deadlines"): Promise<WithSource<DocResult>> {
  if (!llmEnabled) return { ...rules.analyzeDocument(doc, data, action), source: "rules" }
  const body = doc.content ?? doc.summary
  if (!body?.trim()) return { ...rules.analyzeDocument(doc, data, action), source: "rules" }
  try {
    const out = await llmJson<{ title: string; lines: string[]; suggestedTask: { title: string } | null }>({
      name: "welya_document",
      schema: S.obj({
        title: S.str("Short heading for the result"),
        lines: S.arr(S.str(), "2–6 bullet lines in Markdown (bold the key term; no leading numbers or dashes — the UI adds bullets)"),
        suggestedTask: { anyOf: [S.obj({ title: S.str("Task title the student could create") }), { type: "null" }] },
      }),
      instructions: `${PERSONA}\nAnalyze a course document. Action "summarize": key points. "tasks": concrete tasks/deliverables it implies (suggestedTask = the most important one not already tracked, else null). "deadlines": every date/deadline mentioned with what it is for; suggestedTask null.\nAlready tracked tasks: ${data.tasks.filter((t) => doc.linkedTaskIds.includes(t.id)).map((t) => `"${t.title}" due ${hd(t.deadline)}`).join("; ") || "none"}`,
      input: `Action: ${action}\nDocument: "${doc.title}" (${doc.type}, course: ${data.courses.find((c) => c.id === doc.courseId)?.name ?? "-"})\n\n${body.slice(0, 8000)}`,
      effort: "minimal",
      maxOutputTokens: 600,
    })
    return { title: out.title, lines: out.lines.slice(0, 8), suggestedTask: out.suggestedTask ? { title: out.suggestedTask.title, courseId: doc.courseId, workspaceId: doc.workspaceId } : null, source: "llm" }
  } catch (e) {
    return { ...rules.analyzeDocument(doc, data, action), source: "rules", ...debug(e) }
  }
}

/* ------------------------------------------------------------------ weekly review */

export async function weeklyReview(data: UserData): Promise<WithSource<ReturnType<typeof rules.weeklyReview>>> {
  const base = rules.weeklyReview(data)
  if (!llmEnabled) return { ...base, source: "rules" }
  try {
    const out = await llmJson<{ paragraphs: string[] }>({
      name: "welya_review",
      schema: S.obj({ paragraphs: S.arr(S.str(), "Exactly 3 short Markdown paragraphs: what happened, what's coming, one concrete suggestion. Bold task names and dates.") }),
      instructions: `${PERSONA}\nWrite a personal weekly academic review. Use the exact numbers from STATS. Encouraging but honest; no corporate tone.`,
      input: `${contextBlock(data)}\n\nSTATS: ${JSON.stringify(base.stats)}`,
      effort: "minimal",
      maxOutputTokens: 500,
    })
    if (!out.paragraphs?.length) throw new Error("empty")
    return { ...base, paragraphs: out.paragraphs.slice(0, 3), source: "llm" }
  } catch (e) {
    return { ...base, source: "rules", ...debug(e) }
  }
}

// Surfaces the fallback reason in dev without leaking to production clients
function debug(e: unknown) {
  return process.env.NODE_ENV === "production" ? {} : { fallbackReason: (e as Error).message }
}
