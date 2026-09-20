import { randomUUID } from "node:crypto"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { format } from "date-fns"
import { db, schema } from "../db/client.js"
import { interpret } from "./welya-llm.js"
import { googleFetch } from "./google.js"
import { toGoogleEvent, toGoogleTask, GOOGLE_TASKS, CALENDAR } from "./google-push.js"

export type SyncResult = { imported: number; updated: number; skipped: number; pushed?: number }

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me"

const chunk = <T>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

/* =========================================================================
   Gmail → Inbox items
   ========================================================================= */

type GmailHeader = { name: string; value: string }
type GmailPart = { mimeType: string; body?: { data?: string; size?: number }; parts?: GmailPart[] }
type GmailMessage = { id: string; threadId: string; internalDate: string; snippet?: string; payload: GmailPart & { headers: GmailHeader[] } }

const decodeB64 = (data: string) => Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")

const stripHtml = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

function bodyOf(part: GmailPart): string {
  const find = (p: GmailPart, mime: string): string | null => {
    if (p.mimeType === mime && p.body?.data) return decodeB64(p.body.data)
    for (const c of p.parts ?? []) {
      const hit = find(c, mime)
      if (hit) return hit
    }
    return null
  }
  return find(part, "text/plain") ?? (find(part, "text/html") ? stripHtml(find(part, "text/html")!) : "")
}

const parseFrom = (from: string) => {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/)
  return m ? { name: m[1].trim() || m[2], email: m[2].trim() } : { name: from.trim(), email: from.trim() }
}

export async function syncGmail(userId: string): Promise<SyncResult> {
  const q = encodeURIComponent("newer_than:14d -in:spam -in:trash -category:promotions -category:social")
  const list = await googleFetch<{ messages?: Array<{ id: string }> }>(userId, `${GMAIL}/messages?q=${q}&maxResults=30`)
  const ids = (list.messages ?? []).map((m) => m.id)
  if (!ids.length) return { imported: 0, updated: 0, skipped: 0 }

  const externalIds = ids.map((id) => `gmail:${id}`)
  const existing = await db.select({ externalId: schema.inboxItems.externalId }).from(schema.inboxItems).where(and(eq(schema.inboxItems.userId, userId), inArray(schema.inboxItems.externalId, externalIds)))
  const seen = new Set(existing.map((e) => e.externalId))
  const fresh = ids.filter((id) => !seen.has(`gmail:${id}`)).slice(0, 15)
  if (!fresh.length) return { imported: 0, updated: 0, skipped: ids.length }

  const [courses, me] = await Promise.all([db.select().from(schema.courses).where(eq(schema.courses.userId, userId)), db.select({ email: schema.oauthTokens.email }).from(schema.oauthTokens).where(eq(schema.oauthTokens.userId, userId))])
  const myEmail = me[0]?.email?.toLowerCase()

  let imported = 0
  for (const group of chunk(fresh, 5)) {
    const messages = await Promise.all(group.map((id) => googleFetch<GmailMessage>(userId, `${GMAIL}/messages/${id}?format=full`)))
    await Promise.all(
      messages.map(async (msg) => {
        const header = (n: string) => msg.payload.headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? ""
        const from = parseFrom(header("From"))
        if (myEmail && from.email.toLowerCase() === myEmail) return // skip mail I sent to myself
        const subject = header("Subject") || "(no subject)"
        const body = (bodyOf(msg.payload) || msg.snippet || "").slice(0, 8000)
        const understood = await interpret(`From: ${from.name}\nSubject: ${subject}\n\n${body.slice(0, 6000)}`, "email", { courses })
        await db
          .insert(schema.inboxItems)
          .values({
            id: randomUUID(),
            userId,
            source: "email",
            sender: from.name,
            senderEmail: from.email,
            subject,
            receivedAt: new Date(Number(msg.internalDate)).toISOString(),
            preview: (msg.snippet || body).slice(0, 140).replace(/\s+/g, " "),
            body,
            courseId: understood.courseId,
            importance: understood.importance,
            ai: { ...understood.ai, source: understood.source },
            externalId: `gmail:${msg.id}`,
          })
          .onConflictDoNothing()
        imported++
      }),
    )
  }
  return { imported, updated: 0, skipped: ids.length - fresh.length }
}


/* =========================================================================
   Google Calendar ⇄ Events (pull changes from Google, then push unlinked Welya events)
   ========================================================================= */

type GEvent = { id: string; status: string; summary?: string; description?: string; location?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string }; extendedProperties?: { private?: Record<string, string> } }

function classifyEvent(title: string, courses: Array<{ id: string; name: string; code: string }>) {
  const t = title.toLowerCase()
  const course = courses.find((c) => t.includes(c.name.toLowerCase()) || (c.code && t.includes(c.code.toLowerCase())))
  if (/\b(due|deadline|submit|submission|dikumpul|pengumpulan)\b/.test(t)) return { type: "deadline", courseId: course?.id ?? null }
  if (/\b(exam|uts|uas|quiz|kuis|ujian|midterm|final)\b/.test(t)) return { type: "deadline", courseId: course?.id ?? null }
  if (course || /\b(lecture|class|kuliah|praktikum|practicum|lab)\b/.test(t)) return { type: "class", courseId: course?.id ?? null }
  if (/\b(meeting|sync|call|bimbingan|rapat|discussion)\b/.test(t)) return { type: "meeting", courseId: null }
  return { type: "reminder", courseId: null }
}

export async function syncCalendar(userId: string): Promise<SyncResult> {
  const timeMin = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const timeMax = new Date(Date.now() + 28 * 86_400_000).toISOString()
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250", showDeleted: "true" })
  const res = await googleFetch<{ items?: GEvent[] }>(userId, `${CALENDAR}/calendars/primary/events?${params}`)
  const items = res.items ?? []

  const courses = await db.select({ id: schema.courses.id, name: schema.courses.name, code: schema.courses.code }).from(schema.courses).where(eq(schema.courses.userId, userId))
  const existing = items.length ? await db.select().from(schema.events).where(and(eq(schema.events.userId, userId), inArray(schema.events.externalId, items.map((e) => `gcal:${e.id}`)))) : []
  const byExternal = new Map(existing.map((e) => [e.externalId, e]))

  let imported = 0
  let updated = 0
  for (const ev of items) {
    const externalId = `gcal:${ev.id}`
    const current = byExternal.get(externalId)
    if (ev.status === "cancelled") {
      if (current) await db.delete(schema.events).where(eq(schema.events.id, current.id))
      continue
    }
    const title = ev.summary?.trim() || "(untitled)"
    // All-day events become a morning reminder block instead of a 24h span
    const allDay = !ev.start.dateTime
    const start = allDay ? new Date(`${ev.start.date}T08:00:00`).toISOString() : new Date(ev.start.dateTime!).toISOString()
    const end = allDay ? new Date(`${ev.start.date}T08:30:00`).toISOString() : new Date(ev.end.dateTime!).toISOString()
    // Events Welya created keep their original type; foreign events are classified from the title
    const welyaType = ev.extendedProperties?.private?.welyaType
    const classified = classifyEvent(title, courses)
    const values = { title, type: current?.type ?? welyaType ?? classified.type, start, end, location: ev.location ?? null, courseId: current?.courseId ?? classified.courseId }
    if (current) {
      if (current.title !== title || current.start !== start || current.end !== end || current.location !== values.location) {
        await db.update(schema.events).set(values).where(eq(schema.events.id, current.id))
        updated++
      }
    } else {
      await db.insert(schema.events).values({ id: randomUUID(), userId, externalId, ...values }).onConflictDoNothing()
      imported++
    }
  }

  // Push: Welya events not yet mirrored (created before connecting, or a failed earlier push)
  const unlinked = await db.select().from(schema.events).where(and(eq(schema.events.userId, userId), isNull(schema.events.externalId)))
  let pushed = 0
  for (const group of chunk(unlinked.filter((e) => new Date(e.end) >= new Date(timeMin)), 5)) {
    await Promise.all(
      group.map(async (e) => {
        const created = await googleFetch<{ id: string }>(userId, `${CALENDAR}/calendars/primary/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toGoogleEvent(e)) })
        await db.update(schema.events).set({ externalId: `gcal:${created.id}` }).where(eq(schema.events.id, e.id))
        pushed++
      }),
    )
  }
  return { imported, updated, skipped: items.length - imported - updated, pushed }
}

/* =========================================================================
   Google Tasks ⇄ Tasks
   ========================================================================= */

type GTaskList = { id: string; title: string }
type GTask = { id: string; title?: string; notes?: string; status: "needsAction" | "completed"; due?: string; completed?: string; updated: string; deleted?: boolean; hidden?: boolean }

// Google stores `due` as a date at 00:00Z; Welya deadlines are end-of-day local
const dueToDeadline = (due: string) => {
  const d = new Date(`${due.slice(0, 10)}T23:59:00`)
  return d.toISOString()
}

export async function syncTasks(userId: string): Promise<SyncResult> {
  const lists = (await googleFetch<{ items?: GTaskList[] }>(userId, `${GOOGLE_TASKS}/users/@me/lists?maxResults=20`)).items ?? []
  const remote: Array<{ listId: string; task: GTask }> = []
  for (const list of lists) {
    const params = new URLSearchParams({ showCompleted: "true", showHidden: "true", showDeleted: "true", maxResults: "100" })
    const res = await googleFetch<{ items?: GTask[] }>(userId, `${GOOGLE_TASKS}/lists/${encodeURIComponent(list.id)}/tasks?${params}`)
    for (const task of res.items ?? []) remote.push({ listId: list.id, task })
  }

  const externalIds = remote.map(({ listId, task }) => `gtask:${listId}:${task.id}`)
  const existing = externalIds.length ? await db.select().from(schema.tasks).where(and(eq(schema.tasks.userId, userId), inArray(schema.tasks.externalId, externalIds))) : []
  const byExternal = new Map(existing.map((t) => [t.externalId, t]))

  let imported = 0
  let updated = 0
  let skipped = 0
  for (const { listId, task } of remote) {
    const externalId = `gtask:${listId}:${task.id}`
    const current = byExternal.get(externalId)
    if (task.deleted) {
      if (current) await db.delete(schema.tasks).where(eq(schema.tasks.id, current.id))
      continue
    }
    const title = task.title?.trim()
    // Welya requires a deadline; Google tasks without a due date are left alone
    if (!title || !task.due) {
      skipped++
      continue
    }
    const done = task.status === "completed"
    const values = {
      title,
      description: task.notes ?? "",
      deadline: dueToDeadline(task.due),
      status: done ? "done" : current && current.status === "in-progress" ? "in-progress" : "todo",
      progress: done ? 100 : current?.progress ?? 0,
      completedAt: done ? new Date(task.completed ?? Date.now()).toISOString() : null,
    }
    if (current) {
      const sameDay = format(new Date(current.deadline), "yyyy-MM-dd") === format(new Date(values.deadline), "yyyy-MM-dd")
      if (current.title !== title || (current.status === "done") !== done || !sameDay || (current.description ?? "") !== values.description) {
        await db.update(schema.tasks).set({ ...values, deadline: sameDay ? current.deadline : values.deadline }).where(eq(schema.tasks.id, current.id))
        updated++
      }
    } else {
      await db.insert(schema.tasks).values({ id: randomUUID(), userId, externalId, ...values, source: { type: "google-tasks", label: "Imported from Google Tasks" } }).onConflictDoNothing()
      imported++
    }
  }

  // Push: Welya tasks not yet mirrored
  const unlinked = await db.select().from(schema.tasks).where(and(eq(schema.tasks.userId, userId), isNull(schema.tasks.externalId)))
  const defaultList = lists[0]?.id
  let pushed = 0
  if (defaultList) {
    for (const group of chunk(unlinked, 5)) {
      await Promise.all(
        group.map(async (t) => {
          const created = await googleFetch<{ id: string }>(userId, `${GOOGLE_TASKS}/lists/${encodeURIComponent(defaultList)}/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toGoogleTask(t)) })
          await db.update(schema.tasks).set({ externalId: `gtask:${defaultList}:${created.id}` }).where(eq(schema.tasks.id, t.id))
          pushed++
        }),
      )
    }
  }
  return { imported, updated, skipped, pushed }
}

export const SYNCERS: Record<string, (userId: string) => Promise<SyncResult>> = {
  gmail: syncGmail,
  "google-calendar": syncCalendar,
  "google-tasks": syncTasks,
}
