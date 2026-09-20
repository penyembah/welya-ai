import { addDays, differenceInCalendarDays, format, isPast, isSameDay, isToday, isTomorrow } from "date-fns"
import type { UserData } from "./data.js"

/**
 * Welya's reasoning layer. Rule-based today so behaviour is deterministic and testable;
 * every function has the shape an LLM-backed implementation would need later.
 */

type Task = UserData["tasks"][number]
type Ev = UserData["events"][number]
type Course = UserData["courses"][number]

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }
const d = (iso: string) => new Date(iso)

export const fmtTime = (x: string | Date) => format(new Date(x), "HH:mm")
export const fmtDateTime = (x: string | Date) => format(new Date(x), "EEE, d MMM · HH:mm")

export function relativeDeadline(iso: string) {
  const date = d(iso)
  if (isToday(date)) return `Today · ${fmtTime(iso)}`
  if (isTomorrow(date)) return `Tomorrow · ${fmtTime(iso)}`
  const diff = differenceInCalendarDays(date, new Date())
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff < 7) return `In ${diff} days`
  return format(date, "EEE, d MMM")
}

export function formatDuration(minutes: number) {
  if (!minutes) return "—"
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export const isOverdue = (t: Task) => t.status !== "done" && isPast(d(t.deadline))
export const isDueToday = (t: Task) => isToday(d(t.deadline))
const openTasks = (data: UserData) => data.tasks.filter((t) => t.status !== "done")
const byUrgency = (a: Task, b: Task) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || d(a.deadline).getTime() - d(b.deadline).getTime()
const courseName = (data: UserData, id: string | null) => data.courses.find((c) => c.id === id)?.name

/* ------------------------------------------------------------------ planning */

export function freeSlotsFor(date: Date, events: Ev[], dayStart = 8, dayEnd = 18) {
  const dayEvents = events.filter((e) => isSameDay(d(e.start), date) && e.type !== "deadline" && e.type !== "reminder").sort((a, b) => d(a.start).getTime() - d(b.start).getTime())
  const slots: Array<{ start: Date; end: Date }> = []
  let cursor = new Date(date)
  cursor.setHours(dayStart, 0, 0, 0)
  const end = new Date(date)
  end.setHours(dayEnd, 0, 0, 0)
  for (const e of dayEvents) {
    const s = d(e.start)
    if (s.getTime() - cursor.getTime() >= 3_600_000) slots.push({ start: new Date(cursor), end: s })
    const eEnd = d(e.end)
    if (eEnd > cursor) cursor = eEnd
  }
  if (end.getTime() - cursor.getTime() >= 3_600_000) slots.push({ start: new Date(cursor), end })
  return slots
}

export function buildPlan(date: Date, data: UserData, opts: { skipTaskIds?: Set<string> } = {}) {
  const slots = freeSlotsFor(date, data.events)
  const candidates = openTasks(data).filter((t) => !opts.skipTaskIds?.has(t.id)).sort(byUrgency)
  const sessions: Array<{ title: string; type: "work-session"; start: string; end: string; courseId: string | null; taskId: string; aiPlanned: true }> = []
  let ti = 0
  for (const slot of slots) {
    let cursor = new Date(slot.start)
    while (ti < candidates.length && slot.end.getTime() - cursor.getTime() >= 3_600_000) {
      const task = candidates[ti]
      const remaining = Math.max(30, Math.round((task.estimatedMinutes || 60) * (1 - (task.progress || 0) / 100)))
      const length = Math.min(remaining, Math.min(120, (slot.end.getTime() - cursor.getTime()) / 60000))
      const sEnd = new Date(cursor.getTime() + length * 60000)
      sessions.push({ title: `Work on: ${task.title}`, type: "work-session", start: cursor.toISOString(), end: sEnd.toISOString(), courseId: task.courseId, taskId: task.id, aiPlanned: true })
      cursor = new Date(sEnd.getTime() + 15 * 60000)
      ti++
    }
  }
  const totalFree = slots.reduce((acc, s) => acc + (s.end.getTime() - s.start.getTime()) / 60000, 0)
  return { slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })), sessions, totalFree }
}

export function planRange(data: UserData, scope: "day" | "week", from = new Date()) {
  const offsets = scope === "week" ? [1, 2, 3, 4, 5] : [0]
  const planned = new Set<string>()
  const days = offsets.map((o) => {
    const date = addDays(from, o)
    const plan = buildPlan(date, data, { skipTaskIds: planned })
    plan.sessions.forEach((s) => planned.add(s.taskId))
    return { date: date.toISOString(), ...plan }
  })
  return { days, sessions: days.flatMap((x) => x.sessions), totalFree: days.reduce((a, x) => a + x.totalFree, 0) }
}

/* ------------------------------------------------------------------ breakdown */

export function breakdownFor(task: Task, existing: string[] = []) {
  const title = task.title.toLowerCase()
  let steps: string[]
  if (title.includes("report") || title.includes("laporan")) steps = ["Collect experiment results", "Organize data", "Create report structure", "Write analysis", "Add references", "Review report", "Submit assignment"]
  else if (title.includes("api") || title.includes("app") || title.includes("page") || title.includes("web")) steps = ["Review specification", "Set up project structure", "Implement core features", "Write tests", "Write README / docs", "Final review & submit"]
  else if (title.includes("read") || title.includes("paper") || title.includes("chapter")) steps = ["Skim headings and summary", "Read carefully and highlight", "Write a one-page summary", "Note questions for the lecturer"]
  else if (title.includes("proposal") || title.includes("plan")) steps = ["Define objectives", "Draft outline", "Fill in details & budget", "Get feedback from team", "Finalize and share"]
  else if (title.includes("exam") || title.includes("uts") || title.includes("uas") || title.includes("quiz")) steps = ["List the chapters in scope", "Review lecture slides", "Redo practice problems", "Make a one-page cheat sheet", "Mock test under time"]
  else steps = ["Understand requirements", "Gather materials", "Do the main work", "Review", "Submit"]
  const has = new Set(existing.map((s) => s.toLowerCase()))
  return steps.filter((s) => !has.has(s.toLowerCase()))
}

/* ------------------------------------------------------------------ recommendations */

export type Recommendation = { id: string; icon: string; tone: "primary" | "warning" | "destructive" | "default"; title: string; body: string; action: Record<string, unknown> }

export function recommendations(data: UserData): Recommendation[] {
  const recs: Recommendation[] = []
  const open = openTasks(data)
  const now = new Date()
  const plan = buildPlan(now, data)
  const upcomingSlot = plan.slots.map((s) => ({ start: d(s.start), end: d(s.end) })).find((s) => s.end > now)
  if (upcomingSlot && open.length) {
    const top = [...open].sort((a, b) => d(a.deadline).getTime() - d(b.deadline).getTime())[0]
    const from = new Date(Math.max(upcomingSlot.start.getTime(), now.getTime()))
    recs.push({
      id: "free-time",
      icon: "CalendarClock",
      tone: "primary",
      title: `You have ${formatDuration(Math.round((upcomingSlot.end.getTime() - from.getTime()) / 60000))} free from ${fmtTime(from)}`,
      body: `Consider working on “${top.title}”${courseName(data, top.courseId) ? ` for ${courseName(data, top.courseId)}` : ""} — it's ${relativeDeadline(top.deadline).toLowerCase()}.`,
      action: { label: "Plan my day", kind: "plan" },
    })
  }
  const soon = open.filter((t) => d(t.deadline) <= addDays(now, 1) && d(t.deadline) > now)
  if (soon.length) recs.push({ id: "due-soon", icon: "AlertTriangle", tone: "warning", title: `${soon.length} deadline${soon.length > 1 ? "s" : ""} within 24 hours`, body: soon.map((t) => `${t.title} (${t.progress}% done)`).join(" · "), action: { label: "Open task", kind: "open-task", targetId: soon[0].id } })
  const overdue = open.filter(isOverdue)
  if (overdue.length) recs.push({ id: "overdue", icon: "AlertTriangle", tone: "destructive", title: `${overdue.length} unfinished task${overdue.length > 1 ? "s" : ""} past the deadline`, body: `“${overdue[0].title}” was due ${relativeDeadline(overdue[0].deadline).toLowerCase()}. Reschedule it or ask the lecturer for an extension.`, action: { label: "Review overdue", kind: "navigate", to: "/tasks?view=overdue" } })
  const unprocessed = data.inboxItems.filter((i) => i.status === "unprocessed")
  if (unprocessed.length) {
    const ai = unprocessed[0].ai as { type?: string; suggestion?: string }
    recs.push({ id: "inbox", icon: "Inbox", tone: "default", title: `${unprocessed.length} inbox item${unprocessed.length > 1 ? "s" : ""} understood, waiting for your confirmation`, body: `${ai.type ?? "Item"}: “${unprocessed[0].subject}” — ${ai.suggestion ?? ""}`, action: { label: "Process inbox", kind: "navigate", to: "/inbox" } })
  }
  return recs
}

export function suggestedPrompts(data: UserData) {
  const open = openTasks(data)
  const prompts = ["What should I do today?", "What deadlines are coming?", "Plan my week", "Summarize my inbox"]
  if (open.some(isOverdue)) prompts.push("What tasks are overdue?")
  if (open.some((t) => t.priority === "high")) prompts.push("Help me organize this assignment")
  return prompts
}

/* ------------------------------------------------------------------ chat */

export type ChatContext = { courseId?: string | null; workspaceId?: string | null; taskId?: string | null; documentId?: string | null }
export type Reply = { content: string; references: Array<{ type: string; id: string; label: string }>; actions: Array<Record<string, unknown>> }

const listTasks = (data: UserData, tasks: Task[]) => tasks.map((t) => `• ${t.title}${courseName(data, t.courseId) ? ` (${courseName(data, t.courseId)})` : ""} — ${relativeDeadline(t.deadline)}`).join("\n")
const refs = (list: Task[]) => list.slice(0, 4).map((t) => ({ type: "task", id: t.id, label: t.title }))

const historyText = (history: Array<{ role: string; content: string }>) => history.map((message) => message.content).join("\n")

export type ScheduleRow = { title: string; day: string; start: string; end: string; location: string | null }

const DAY_WORDS = "senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun"
const TIME = "\\d{1,2}[.:]\\d{2}"
const RANGE = new RegExp(`(${TIME})\\s*[–—-]\\s*(${TIME})`, "i")
const DAY_ONLY = new RegExp(`^(${DAY_WORDS})$`, "i")
const DAY_LEAD = new RegExp(`^(${DAY_WORDS})\\b[\\s:,-]*`, "i")

// Pulls "Selasa 10.00–12.00 — Course (Lecturer)" style rows out of Markdown; also handles a day heading followed by time-only rows.
export function extractScheduleRows(text: string): ScheduleRow[] {
  const rows: ScheduleRow[] = []
  let currentDay: string | null = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\*\*|__|`/g, "").replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()
    if (!line) continue
    if (DAY_ONLY.test(line)) {
      currentDay = line
      continue
    }
    const range = RANGE.exec(line)
    if (!range) continue
    let day = currentDay
    const lead = DAY_LEAD.exec(line)
    if (lead && line.indexOf(lead[1]) < range.index) day = lead[1]
    if (!day) continue
    let rest = line.slice(range.index + range[0].length).replace(/^[\s—–:,-]+/, "")
    // Drop trailing lecturer/parenthetical notes: "Course (Prof. X)" or "Course — Prof. X"
    rest = rest.split(/\s+[—–]\s+/)[0].replace(/\s*\([^)]*\)\s*$/, "").trim()
    if (!rest) continue
    const location = /\b(?:ruang|room|lab|r\.)\s*[\w.\-]+/i.exec(line)?.[0] ?? null
    rows.push({ title: rest, day, start: range[1], end: range[2], location })
  }
  return rows
}

const scheduleFromHistory = (history: Array<{ role: string; content: string }>) => {
  const text = historyText(history)
  const dataMatch = text.match(/\[SCHEDULE_DATA:(\[[\s\S]*?\])\]/)
  if (dataMatch) {
    try {
      const rows = JSON.parse(dataMatch[1])
      if (Array.isArray(rows) && rows.length) return rows as ScheduleRow[]
    } catch {
      // Continue with Markdown extraction below.
    }
  }
  // Use the most recent message (either side) that contains a timetable
  for (const message of [...history].reverse()) {
    const rows = extractScheduleRows(message.content)
    if (rows.length) return rows
  }
  return []
}

function taskDraftFromConversation(prompt: string, history: Array<{ role: string; content: string }>) {
  const all = `${historyText(history)}\n${prompt}`
  const titleMatch = all.match(/(?:task|tugas)\s+(?:tugas\s+)?(.+?)(?=\s+(?:deadline|due|satu minggu|minggu depan|dengan)|[\n,.]|$)/i)
  const title = titleMatch?.[1]?.trim() || "New academic task"
  const dateMatch = all.match(/(?:deadline|due)\s+(?:tanggal\s+)?(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/i)
  let deadline = addDays(new Date(), 7)
  if (dateMatch) {
    const parsed = new Date(`${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3] ?? new Date().getFullYear()} 23:59`)
    if (!Number.isNaN(parsed.getTime())) deadline = parsed
  }
  const durationMatch = all.match(/(\d+)\s*(?:jam|hours?)/i)
  const estimatedMinutes = durationMatch ? Number(durationMatch[1]) * 60 : 360
  return { title: title.charAt(0).toUpperCase() + title.slice(1), deadline: deadline.toISOString(), estimatedMinutes }
}

export function generateReply(prompt: string, data: UserData, context: ChatContext = {}, history: Array<{ role: string; content: string }> = []): Reply {
  const q = prompt.toLowerCase()
  const open = openTasks(data)
  const scoped = context.courseId ? open.filter((t) => t.courseId === context.courseId) : context.workspaceId ? open.filter((t) => t.workspaceId === context.workspaceId) : open
  const doc = context.documentId ? data.documents.find((x) => x.id === context.documentId) : null

  if ((q.includes("buat") || q.includes("create") || q.includes("gunakan default") || q.includes("use default")) && (q.includes("task") || q.includes("tugas") || historyText(history).toLowerCase().includes("task") || historyText(history).toLowerCase().includes("tugas"))) {
    const draft = taskDraftFromConversation(prompt, history)
    return { content: `I can create **${draft.title}** with a deadline of **${format(new Date(draft.deadline), "EEE, d MMM yyyy HH:mm")}** and an estimated duration of **${Math.round(draft.estimatedMinutes / 60)} hours**.`, references: [], actions: [{ label: "Create task", kind: "create-task", title: draft.title, deadline: draft.deadline, estimatedMinutes: draft.estimatedMinutes, priority: "medium", description: "Created from the conversation." }] }
  }

  if (doc && (q.includes("summar") || q.includes("this") || q.includes("document"))) {
    const linked = data.tasks.filter((t) => doc.linkedTaskIds.includes(t.id))
    return {
      content: `${doc.summary}${linked.length ? `\n\nIt's linked to: ${linked.map((t) => t.title).join(", ")}.` : ""}${courseName(data, doc.courseId) ? ` Part of ${courseName(data, doc.courseId)}.` : ""}`,
      references: linked.slice(0, 3).map((t) => ({ type: "task", id: t.id, label: t.title })),
      actions: linked.length ? [{ label: "Open task", kind: "open-task", targetId: linked[0].id }] : [{ label: "Extract tasks", kind: "prompt", prompt: "What should I do with this?" }],
    }
  }

  if (q.includes("overdue")) {
    const od = scoped.filter(isOverdue)
    if (!od.length) return { content: "Good news — nothing is overdue right now. Keep it up.", references: [], actions: [] }
    return { content: `You have ${od.length} overdue task${od.length > 1 ? "s" : ""}:\n${listTasks(data, od)}\n\nWant me to reschedule ${od.length > 1 ? "them" : "it"} into your next free slot?`, references: refs(od), actions: [{ label: "Reschedule into free time", kind: "plan" }, { label: "Open overdue tasks", kind: "navigate", to: "/tasks?view=overdue" }] }
  }

  if (q.includes("deadline") || q.includes("due") || q.includes("upcoming")) {
    const soon = scoped.filter((t) => d(t.deadline) <= addDays(new Date(), 7)).sort((a, b) => d(a.deadline).getTime() - d(b.deadline).getTime())
    if (!soon.length) return { content: "No deadlines in the next 7 days. A good moment to get ahead on reading.", references: [], actions: [] }
    return { content: `Here are your deadlines for the next 7 days:\n${listTasks(data, soon)}\n\nThe closest one is “${soon[0].title}” — ${relativeDeadline(soon[0].deadline)}.`, references: refs(soon), actions: [{ label: "Plan my week", kind: "plan-week" }, { label: "Open upcoming tasks", kind: "navigate", to: "/tasks?view=upcoming" }] }
  }

  if (q.includes("inbox") || q.includes("announcement") || q.includes("summar")) {
    const items = (context.courseId ? data.inboxItems.filter((i) => i.courseId === context.courseId) : data.inboxItems.filter((i) => i.status === "unprocessed")).sort((a, b) => d(b.receivedAt).getTime() - d(a.receivedAt).getTime())
    if (!items.length) return { content: context.courseId ? "There are no announcements for this course in your inbox yet." : "Your inbox is clear — nothing waiting for review.", references: [], actions: [] }
    const ai = items[0].ai as { type?: string; suggestion?: string }
    const types = [...new Set(items.map((i) => (i.ai as { type?: string }).type ?? "item"))]
    return { content: `${context.courseId ? `For this course I found ${items.length} item${items.length > 1 ? "s" : ""}` : `You have ${items.length} unprocessed inbox items`}: ${types.join(", ").toLowerCase()}.\n\nMost recent: “${items[0].subject}” from ${items[0].sender}. ${ai.suggestion ?? ""}`, references: items.slice(0, 3).map((i) => ({ type: "inbox", id: i.id, label: i.subject })), actions: [{ label: "Open inbox", kind: "navigate", to: `/inbox?item=${items[0].id}` }] }
  }

  if (q.includes("plan") && q.includes("week")) {
    const plan = planRange(data, "week")
    if (!open.length) return { content: "There are no open tasks to schedule next week yet. Add a task with a deadline first, then I can place focused work sessions in your free calendar slots.", references: [], actions: [{ label: "Open tasks", kind: "navigate", to: "/tasks" }, { label: "Open calendar", kind: "navigate", to: "/calendar?view=week" }] }
    if (!plan.sessions.length) return { content: `Your calendar has no available one-hour work slots next week between 08:00 and 18:00. I found ${formatDuration(Math.round(plan.totalFree))} of free time, but it is split into shorter gaps or blocked by existing events.`, references: refs(open), actions: [{ label: "Open calendar", kind: "navigate", to: "/calendar?view=week" }] }
    return { content: `Next week you have about ${formatDuration(Math.round(plan.totalFree))} of free time across weekdays. I can schedule ${plan.sessions.length} focused work sessions around your classes, prioritising ${open.sort(byUrgency)[0]?.title ?? "your top task"} first. Shall I add them to your calendar?`, references: refs(open), actions: [{ label: "Add sessions to calendar", kind: "plan-week" }, { label: "Open calendar", kind: "navigate", to: "/calendar?view=week" }] }
  }

  const extractedSchedule = scheduleFromHistory(history)
  if (((q.includes("jadwal") || q.includes("schedule") || q.includes("class")) && (q.includes("calendar") || q.includes("kalender") || q.includes("tambahkan") || q.includes("add"))) || (extractedSchedule.length && (q.includes("calendar") || q.includes("kalender") || q.includes("tambahkan") || q.includes("add")))) {
    const extracted = extractedSchedule
    if (extracted.length) return { content: `I found ${extracted.length} class schedule${extracted.length > 1 ? "s" : ""} from the image. I can add them as recurring calendar events without reminders.`, references: [], actions: [{ label: "Add course schedules", kind: "schedule-courses", schedule: extracted }, { label: "Open calendar", kind: "navigate", to: "/calendar?view=month" }] }
    const available = data.courses.filter((course) => course.schedule?.length)
    if (!available.length) return { content: "I couldn't find weekly class schedules on your courses yet. Add a schedule to a course first, then I can add the classes to your calendar.", references: [], actions: [{ label: "Open courses", kind: "navigate", to: "/courses" }] }
    return { content: `I found weekly schedules for ${available.length} course${available.length > 1 ? "s" : ""}. I can add the class events to your calendar without reminders.`, references: [], actions: [{ label: "Add course schedules", kind: "schedule-courses" }, { label: "Open calendar", kind: "navigate", to: "/calendar?view=month" }] }
  }

  if (q.includes("plan") || q.includes("schedule") || q.includes("free")) {
    const target = q.includes("tomorrow") ? addDays(new Date(), 1) : new Date()
    const plan = buildPlan(target, data)
    const when = q.includes("tomorrow") ? "Tomorrow" : "Today"
    if (!plan.slots.length) return { content: `${when} looks fully booked between 08:00 and 18:00. Want me to look at the next day instead?`, references: [], actions: [{ label: "Plan my week", kind: "plan-week" }] }
    return { content: `${when} you have ${formatDuration(Math.round(plan.totalFree))} free (${plan.slots.map((s) => `${fmtTime(s.start)}–${fmtTime(s.end)}`).join(", ")}). I'd use it like this:\n${plan.sessions.map((s) => `• ${fmtTime(s.start)}–${fmtTime(s.end)} ${s.title.replace("Work on: ", "")}`).join("\n")}\n\nWould you like me to add these sessions to your calendar?`, references: plan.sessions.map((s) => ({ type: "task", id: s.taskId, label: s.title.replace("Work on: ", "") })), actions: [{ label: "Add to calendar", kind: "plan", date: target.toISOString() }] }
  }

  if (q.includes("break") || q.includes("organize") || q.includes("organise") || q.includes("assignment") || q.includes("project")) {
    const t = context.taskId ? data.tasks.find((x) => x.id === context.taskId) : scoped.find((x) => x.priority === "high") ?? scoped[0]
    if (!t) return { content: "Tell me which assignment you'd like to organise and I'll break it into steps.", references: [], actions: [] }
    const steps = breakdownFor(t, t.subtasks.map((s) => s.title))
    return { content: `Let's break “${t.title}” down. Based on similar ${courseName(data, t.courseId) ?? "academic"} tasks, I suggest:\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nI can add these as subtasks and reserve time before the deadline (${relativeDeadline(t.deadline)}).`, references: [{ type: "task", id: t.id, label: t.title }], actions: [{ label: "Add subtasks", kind: "breakdown", targetId: t.id }, { label: "Open task", kind: "open-task", targetId: t.id }] }
  }

  if (q.includes("study") || q.includes("exam") || q.includes("uts") || q.includes("uas")) {
    return { content: "Here's a study plan idea: five 60-minute review sessions over the next two weeks, one per chapter, ending with a mock test two days before the exam. I'll place them in your free slots after classes.", references: [], actions: [{ label: "Plan my week", kind: "plan-week" }] }
  }

  if (q.includes("class") || q.includes("today") || q.includes("finish") || q.includes("what should i do") || q.includes("left")) {
    const today = scoped.filter((t) => isDueToday(t) || isOverdue(t))
    const classes = data.events.filter((e) => e.type === "class" && isSameDay(d(e.start), new Date()))
    const top = [...scoped].sort((a, b) => d(a.deadline).getTime() - d(b.deadline).getTime())[0]
    return { content: `${classes.length ? `You have ${classes.length} class${classes.length > 1 ? "es" : ""} today (${classes.map((c) => `${c.title} at ${fmtTime(c.start)}`).join(", ")}). ` : "No classes today. "}${today.length ? `${today.length} task${today.length > 1 ? "s" : ""} need${today.length > 1 ? "" : "s"} attention:\n${listTasks(data, today)}` : top ? `Your next deadline is “${top.title}” — ${relativeDeadline(top.deadline)}.` : "You're all caught up."}\n\nI'd start with ${top?.title ?? "reviewing your notes"} — it's the most urgent.`, references: refs(today.length ? today : top ? [top] : []), actions: [{ label: "Plan my day", kind: "plan" }, ...(top ? [{ label: "Open task", kind: "open-task", targetId: top.id }] : [])] }
  }

  return { content: `I understand you're asking about “${prompt}”. I can help with your tasks, deadlines, calendar, inbox and course materials. Try “What deadlines are coming?”, “Plan my day”, or “Summarize my inbox”.`, references: [], actions: [{ label: "Plan my day", kind: "plan" }, { label: "Show deadlines", kind: "prompt", prompt: "What deadlines are coming?" }] }
}

/* ------------------------------------------------------------------ inbox interpretation */

export function interpret(text: string, source: string, courses: Course[]) {
  const t = text.toLowerCase()
  const course = courses.find((c) => t.includes(c.name.toLowerCase()) || t.includes(c.code.toLowerCase()) || c.name.toLowerCase().split(" ").some((w) => w.length > 4 && t.includes(w)))
  const fields: Array<{ label: string; value: string }> = []
  if (course) fields.push({ label: "Course", value: course.name })
  const time = /(\d{1,2})[.:](\d{2})/.exec(t)
  const day = /(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|monday|tuesday|wednesday|thursday|friday|saturday|sunday|besok|tomorrow|today|hari ini)/.exec(t)
  if (day) fields.push({ label: "Date", value: day[1].charAt(0).toUpperCase() + day[1].slice(1) })
  if (time) fields.push({ label: "Time", value: `${time[1].padStart(2, "0")}:${time[2]}` })

  let type = "Personal Note"
  let primaryAction = "Save as Note"
  let suggestion = "Save this as a note so Welya can refer back to it."
  let confidence = 0.6
  if (/dikumpul|deadline|due|submit|kumpul|tugas|assignment|laporan|report/.test(t)) {
    type = "Academic Task"
    primaryAction = "Create Task"
    suggestion = `Create a task${course ? ` for ${course.name}` : ""}${day || time ? ` with the deadline ${day?.[1] ?? ""} ${time ? `${time[1]}:${time[2]}` : ""}`.trimEnd() : ""} and set a reminder a day before.`
    confidence = 0.86
  } else if (/dipindah|pindah|moved|reschedul|jadwal|schedule|diganti|change/.test(t)) {
    type = "Schedule Change"
    primaryAction = "Create Event"
    suggestion = "Update the calendar with the new time and notify you the morning of."
    confidence = 0.84
  } else if (/uts|uas|ujian|exam|quiz|kuis/.test(t)) {
    type = "Exam Announcement"
    primaryAction = "Create Task"
    suggestion = "Create a study plan with review sessions spread over the coming weeks."
    confidence = 0.8
  } else if (/krs|pembayaran|payment|administras|biro/.test(t)) {
    type = "Administrative"
    primaryAction = "Create Reminder"
    suggestion = "Save as a reminder for the administrative window."
    confidence = 0.75
  } else if (source === "pdf" || source === "document" || source === "screenshot") {
    type = source === "screenshot" ? "Screenshot" : "Uploaded Document"
    primaryAction = "Save as Note"
    suggestion = "Review the extracted content and decide whether to create tasks from it."
    confidence = 0.7
  }
  fields.push({ label: "Detected from", value: source.charAt(0).toUpperCase() + source.slice(1) })
  return { ai: { type, confidence, fields, suggestion, primaryAction }, courseId: course?.id ?? null, importance: confidence >= 0.84 ? "high" : "normal" }
}

/* ------------------------------------------------------------------ documents */

export function analyzeDocument(doc: UserData["documents"][number], data: UserData, action: "summarize" | "tasks" | "deadlines") {
  const linked = data.tasks.filter((t) => doc.linkedTaskIds.includes(t.id))
  const cn = courseName(data, doc.courseId)
  if (action === "summarize") return { title: "Summary", lines: [doc.summary || "No text could be extracted from this file yet.", doc.tags.length ? `Key points: ${doc.tags.join(", ")}.` : null, cn ? `Relevant to ${cn}.` : "Not linked to a course yet."].filter(Boolean) as string[], suggestedTask: null }
  if (action === "tasks") return { title: "Tasks found", lines: linked.length ? linked.map((t) => `Already tracked: ${t.title}`) : [`Prepare a summary of ${doc.title}`, "Review key sections before the next class"], suggestedTask: linked.length ? null : { title: `Review: ${doc.title}`, courseId: doc.courseId, workspaceId: doc.workspaceId } }
  return { title: "Deadlines found", lines: linked.length ? linked.map((t) => `${t.title} — ${fmtDateTime(t.deadline)}`) : ["No explicit dates were found in this document."], suggestedTask: null }
}

/* ------------------------------------------------------------------ weekly review */

export function weeklyReview(data: UserData) {
  const now = new Date()
  const weekAgo = addDays(now, -7)
  const completed = data.tasks.filter((t) => t.completedAt && d(t.completedAt) >= weekAgo)
  const remaining = openTasks(data)
  const overdue = remaining.filter(isOverdue)
  const dueThisWeek = remaining.filter((t) => d(t.deadline) > now && d(t.deadline) <= addDays(now, 7))
  const minutes = completed.reduce((a, t) => a + (t.estimatedMinutes || 0), 0)
  const perCourse = data.courses.map((c) => ({ course: c, open: remaining.filter((t) => t.courseId === c.id).length })).sort((a, b) => b.open - a.open)[0]
  const loadByDay = [1, 2, 3, 4, 5, 6, 7].map((o) => {
    const date = addDays(now, o)
    const classes = data.events.filter((e) => e.type === "class" && isSameDay(d(e.start), date)).length
    const deadlines = remaining.filter((t) => isSameDay(d(t.deadline), date)).length
    return { label: format(date, "EEEE"), classes, deadlines, load: classes * 25 + deadlines * 30 }
  })
  const busiest = [...loadByDay].sort((a, b) => b.load - a.load)[0]
  const paragraphs = [
    `Last week you completed ${completed.length} task${completed.length === 1 ? "" : "s"}${minutes ? ` (about ${Math.round(minutes / 60)} hours of work)` : ""}. You still have ${remaining.length} unfinished${overdue.length ? `, ${overdue.length} overdue` : ""}, and ${dueThisWeek.length} deadline${dueThisWeek.length === 1 ? "" : "s"} approaching this week.`,
    [busiest && busiest.load > 0 ? `${busiest.label} looks like your busiest day (${busiest.classes} class${busiest.classes === 1 ? "" : "es"}${busiest.deadlines ? `, ${busiest.deadlines} deadline${busiest.deadlines > 1 ? "s" : ""}` : ""}).` : null, perCourse && perCourse.open > 0 ? `Most of your open work is in ${perCourse.course.name} (${perCourse.open} task${perCourse.open > 1 ? "s" : ""}).` : null].filter(Boolean).join(" "),
    `Suggestion: reserve two focused sessions early in the week for ${perCourse?.course.name ?? "your top course"} so the end of the week stays light.`,
  ].filter(Boolean)
  return { paragraphs, stats: { completed: completed.length, remaining: remaining.length, overdue: overdue.length, dueThisWeek: dueThisWeek.length, completedMinutes: minutes } }
}
