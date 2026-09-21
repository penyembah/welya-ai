import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { addDays, addWeeks, set, startOfWeek } from "date-fns"
import type { FastifyBaseLogger } from "fastify"
import { db, schema } from "../db/client.js"
import { loadUserData, type UserData } from "./data.js"
import { S, type ToolDef } from "./llm.js"
import { deleteEventRemote, deleteTaskRemote, pushEvent, pushTask } from "./google-push.js"
import { activity } from "./notify.js"
import { buildPlan, cleanTaskTitle, planRange } from "./welya-ai.js"

/**
 * Tools the assistant can call during a chat turn. They write straight to the database (and mirror to
 * Google when connected), then return what actually happened so the model's confirmation is truthful.
 */

const PRIORITIES = ["high", "medium", "low"] as const
const STATUSES = ["todo", "in-progress", "done"] as const
const EVENT_TYPES = ["class", "meeting", "reminder", "work-session", "deadline"] as const

const nnum = (description: string) => ({ type: ["number", "null"], description })
const nenum = (values: readonly string[], description: string) => ({ type: ["string", "null"], enum: [...values, null], description })

export const TOOLS: ToolDef[] = [
  {
    name: "create_task",
    description: "Create a task (assignment, report, reading, exam prep) for the student. Call once per task.",
    parameters: S.obj({
      title: S.str("Short syllabus-style title naming the deliverable, e.g. \"Landing Page Pemrograman Web\". Never the student's sentence; no leading verbs; no course name when courseId is set."),
      description: S.nstr("One or two sentences describing the deliverable, else null"),
      courseId: S.nstr("Exact course id from CONTEXT when the task belongs to a course, else null"),
      deadline: S.str("Deadline as ISO-8601 with timezone offset, e.g. 2026-09-25T23:59:00+07:00. Default 23:59 when only a day is given."),
      priority: S.enum([...PRIORITIES], "high only when urgent and important"),
      estimatedMinutes: nnum("Realistic effort in minutes, else null (defaults to 60)"),
      subtasks: S.arr(S.str(), "3–6 concrete steps for non-trivial tasks, in order; empty array for small tasks"),
    }),
  },
  {
    name: "update_task",
    description: "Change an existing task: title, description, course, deadline, priority, status (mark done), progress or estimate. Use the id from CONTEXT. Only non-null fields are changed.",
    parameters: S.obj({
      id: S.str("Task id from CONTEXT"),
      title: S.nstr(),
      description: S.nstr(),
      courseId: S.nstr("Course id from CONTEXT, else null"),
      deadline: S.nstr("ISO-8601 with offset, else null"),
      priority: nenum(PRIORITIES, "else null"),
      status: nenum(STATUSES, "\"done\" marks the task complete; else null"),
      progress: nnum("0–100, else null"),
      estimatedMinutes: nnum("else null"),
    }),
  },
  { name: "delete_task", description: "Delete a task permanently. Use the id from CONTEXT. Only when the student clearly asks to delete/remove it.", parameters: S.obj({ id: S.str("Task id from CONTEXT") }) },
  {
    name: "add_subtasks",
    description: "Append subtasks (concrete steps) to an existing task.",
    parameters: S.obj({ id: S.str("Task id from CONTEXT"), titles: S.arr(S.str(), "Subtask titles in order") }),
  },
  {
    name: "create_event",
    description: "Add one calendar event: meeting, thesis supervision (bimbingan), exam, appointment, study session. One call per event.",
    parameters: S.obj({
      title: S.str("Event title, e.g. \"Bimbingan Skripsi dengan Pak Anggit\""),
      type: S.enum([...EVENT_TYPES], "meeting for consultations/supervision, class for lectures, reminder for point-in-time notes"),
      start: S.str("Start as ISO-8601 with timezone offset, e.g. 2026-09-22T14:00:00+07:00"),
      end: S.nstr("End as ISO-8601 with offset; null = one hour after start"),
      location: S.nstr("Room/campus/online link, else null"),
      courseId: S.nstr("Course id from CONTEXT when related to a course, else null"),
    }),
  },
  {
    name: "update_event",
    description: "Change an existing calendar event's title, time or location. Use the id from CONTEXT. Only non-null fields are changed.",
    parameters: S.obj({ id: S.str("Event id from CONTEXT"), title: S.nstr(), start: S.nstr("ISO-8601 with offset"), end: S.nstr("ISO-8601 with offset"), location: S.nstr() }),
  },
  { name: "delete_event", description: "Remove a calendar event. Use the id from CONTEXT.", parameters: S.obj({ id: S.str("Event id from CONTEXT") }) },
  {
    name: "plan_work_sessions",
    description: "Schedule focused work sessions for open tasks into the student's free time (08:00–18:00 between events) and add them to the calendar. scope=day plans one day, scope=week plans the next five weekdays.",
    parameters: S.obj({ scope: S.enum(["day", "week"]), date: S.nstr("ISO date of the day to plan for scope=day, else null (today)") }),
  },
  {
    name: "add_class_schedule",
    description: "Add a recurring weekly class timetable to the calendar (one event per class per week for the rest of the semester). Use when the student gives their lecture schedule.",
    parameters: S.obj({
      rows: S.arr(
        S.obj({
          courseId: S.nstr("Course id from CONTEXT if it matches an existing course, else null"),
          title: S.str("Course name as shown on the calendar"),
          day: S.str("Weekday in Indonesian or English, e.g. Selasa or Tuesday"),
          start: S.str("HH:mm"),
          end: S.str("HH:mm"),
          location: S.nstr("Room, else null"),
        })
      ),
      weeks: nnum("How many weeks ahead to schedule, else null (16)"),
    }),
  },
]

export type Effects = {
  tasksCreated: Array<{ id: string; title: string }>
  tasksUpdated: Array<{ id: string; title: string }>
  tasksDeleted: string[]
  eventsCreated: Array<{ id: string; title: string; start: string }>
  eventsUpdated: string[]
  eventsDeleted: string[]
  sessionsAdded: number
  classEventsAdded: number
}

const emptyEffects = (): Effects => ({ tasksCreated: [], tasksUpdated: [], tasksDeleted: [], eventsCreated: [], eventsUpdated: [], eventsDeleted: [], sessionsAdded: 0, classEventsAdded: 0 })

export const hasEffects = (e: Effects) => e.tasksCreated.length + e.tasksUpdated.length + e.tasksDeleted.length + e.eventsCreated.length + e.eventsUpdated.length + e.eventsDeleted.length + e.sessionsAdded + e.classEventsAdded > 0

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const parseDate = (v: unknown): Date | null => {
  const s = str(v)
  if (!s) return null
  const d = new Date(s.replace(" ", "T"))
  return Number.isNaN(d.getTime()) ? null : d
}
const strings = (v: unknown, max = 30) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean).slice(0, max) : [])

const DAY_INDEX: Record<string, number> = { senin: 0, monday: 0, mon: 0, selasa: 1, tuesday: 1, tue: 1, rabu: 2, wednesday: 2, wed: 2, kamis: 3, thursday: 3, thu: 3, jumat: 4, "jum'at": 4, friday: 4, fri: 4, sabtu: 5, saturday: 5, sat: 5, minggu: 6, sunday: 6, sun: 6 }
const parseClock = (v: unknown): [number, number] | null => {
  const m = str(v).match(/^(\d{1,2})[.:](\d{2})$/)
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2])
  return h >= 0 && h < 24 && min >= 0 && min < 60 ? [h, min] : null
}

export function createToolRunner(uid: string, initial: UserData, log?: FastifyBaseLogger) {
  const effects = emptyEffects()
  let data = initial
  const courseId = (v: unknown) => {
    const id = str(v)
    return id && data.courses.some((c) => c.id === id) ? id : null
  }
  const own = <T extends { id: string }>(rows: T[], id: string) => rows.find((r) => r.id === id)
  const refresh = async () => { data = await loadUserData(uid) }

  async function run(name: string, a: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case "create_task": {
        const title = cleanTaskTitle(str(a.title))
        if (!title) return { ok: false, error: "title is required" }
        const deadline = parseDate(a.deadline) ?? set(addDays(new Date(), 7), { hours: 23, minutes: 59, seconds: 0, milliseconds: 0 })
        const minutes = Number(a.estimatedMinutes)
        const subtasks = strings(a.subtasks, 12).map((t) => ({ id: randomUUID(), title: t, done: false }))
        const [row] = await db
          .insert(schema.tasks)
          .values({
            id: randomUUID(),
            userId: uid,
            title,
            description: str(a.description),
            courseId: courseId(a.courseId),
            deadline: deadline.toISOString(),
            priority: PRIORITIES.includes(a.priority as never) ? String(a.priority) : "medium",
            estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 60,
            subtasks,
            source: { type: "assistant", label: "Created from AI Assistant" },
          })
          .returning()
        void pushTask(uid, row, log)
        activity.taskCreated(uid, row, "Welya", log)
        effects.tasksCreated.push({ id: row.id, title: row.title })
        return { ok: true, task: { id: row.id, title: row.title, course: data.courses.find((c) => c.id === row.courseId)?.name ?? null, deadline: row.deadline, priority: row.priority, estimatedMinutes: row.estimatedMinutes, subtasks: subtasks.map((s) => s.title) } }
      }
      case "update_task": {
        const task = own(data.tasks, str(a.id))
        if (!task) return { ok: false, error: "Task not found" }
        const patch: Partial<typeof schema.tasks.$inferInsert> = {}
        if (str(a.title)) patch.title = cleanTaskTitle(str(a.title)) || task.title
        if (typeof a.description === "string") patch.description = a.description
        if (a.courseId !== null && a.courseId !== undefined) patch.courseId = courseId(a.courseId)
        const deadline = parseDate(a.deadline)
        if (deadline) patch.deadline = deadline.toISOString()
        if (PRIORITIES.includes(a.priority as never)) patch.priority = String(a.priority)
        if (STATUSES.includes(a.status as never)) {
          patch.status = String(a.status)
          if (a.status === "done") { patch.progress = 100; patch.completedAt = new Date().toISOString() }
          else if (task.status === "done") { patch.completedAt = null; patch.progress = Math.min(Number(task.progress) || 0, 99) }
        }
        const progress = Number(a.progress)
        if (a.progress !== null && Number.isFinite(progress)) patch.progress = Math.max(0, Math.min(100, Math.round(progress)))
        const minutes = Number(a.estimatedMinutes)
        if (a.estimatedMinutes !== null && Number.isFinite(minutes) && minutes > 0) patch.estimatedMinutes = Math.round(minutes)
        if (!Object.keys(patch).length) return { ok: false, error: "Nothing to change" }
        const [row] = await db.update(schema.tasks).set(patch).where(and(eq(schema.tasks.id, task.id), eq(schema.tasks.userId, uid))).returning()
        void pushTask(uid, row, log)
        activity.taskUpdated(uid, task, row, patch, "Welya", log)
        effects.tasksUpdated.push({ id: row.id, title: row.title })
        return { ok: true, task: { id: row.id, title: row.title, status: row.status, deadline: row.deadline, priority: row.priority, progress: row.progress } }
      }
      case "delete_task": {
        const task = own(data.tasks, str(a.id))
        if (!task) return { ok: false, error: "Task not found" }
        const [row] = await db.delete(schema.tasks).where(and(eq(schema.tasks.id, task.id), eq(schema.tasks.userId, uid))).returning({ id: schema.tasks.id, externalId: schema.tasks.externalId })
        if (row) void deleteTaskRemote(uid, row, log)
        activity.taskDeleted(uid, task.title, "Welya", log)
        effects.tasksDeleted.push(task.id)
        return { ok: true, deleted: task.title }
      }
      case "add_subtasks": {
        const task = own(data.tasks, str(a.id))
        if (!task) return { ok: false, error: "Task not found" }
        const existing = new Set(task.subtasks.map((s) => s.title.toLowerCase()))
        const titles = strings(a.titles, 12).filter((t) => !existing.has(t.toLowerCase()))
        if (!titles.length) return { ok: false, error: "No new subtasks" }
        const subtasks = [...task.subtasks, ...titles.map((t) => ({ id: randomUUID(), title: t, done: false }))]
        const [row] = await db.update(schema.tasks).set({ subtasks }).where(and(eq(schema.tasks.id, task.id), eq(schema.tasks.userId, uid))).returning()
        activity.taskUpdated(uid, task, row, { subtasks }, "Welya", log)
        effects.tasksUpdated.push({ id: row.id, title: row.title })
        return { ok: true, added: titles, total: subtasks.length }
      }
      case "create_event": {
        const title = str(a.title).slice(0, 200)
        const start = parseDate(a.start)
        if (!title || !start) return { ok: false, error: "title and a valid ISO start are required" }
        const endParsed = parseDate(a.end)
        const end = endParsed && endParsed > start ? endParsed : new Date(start.getTime() + 60 * 60_000)
        const dup = data.events.find((e) => e.title.toLowerCase() === title.toLowerCase() && new Date(e.start).getTime() === start.getTime())
        if (dup) return { ok: true, event: { id: dup.id, title: dup.title, start: dup.start, end: dup.end }, note: "Already on the calendar" }
        const [row] = await db
          .insert(schema.events)
          .values({ id: randomUUID(), userId: uid, title, type: EVENT_TYPES.includes(a.type as never) ? String(a.type) : "meeting", start: start.toISOString(), end: end.toISOString(), location: str(a.location) || null, courseId: courseId(a.courseId), aiPlanned: false })
          .returning()
        void pushEvent(uid, row, log)
        activity.eventCreated(uid, row, "Welya", log)
        effects.eventsCreated.push({ id: row.id, title: row.title, start: row.start })
        return { ok: true, event: { id: row.id, title: row.title, type: row.type, start: row.start, end: row.end, location: row.location } }
      }
      case "update_event": {
        const ev = own(data.events, str(a.id))
        if (!ev) return { ok: false, error: "Event not found" }
        const patch: Partial<typeof schema.events.$inferInsert> = {}
        if (str(a.title)) patch.title = str(a.title).slice(0, 200)
        const start = parseDate(a.start), end = parseDate(a.end)
        if (start) patch.start = start.toISOString()
        if (end) patch.end = end.toISOString()
        if (start && !end && new Date(ev.end) <= start) patch.end = new Date(start.getTime() + (new Date(ev.end).getTime() - new Date(ev.start).getTime() || 3_600_000)).toISOString()
        if (typeof a.location === "string") patch.location = a.location.trim() || null
        if (!Object.keys(patch).length) return { ok: false, error: "Nothing to change" }
        const [row] = await db.update(schema.events).set(patch).where(and(eq(schema.events.id, ev.id), eq(schema.events.userId, uid))).returning()
        void pushEvent(uid, row, log)
        activity.eventUpdated(uid, row, "Welya", log)
        effects.eventsUpdated.push(row.id)
        return { ok: true, event: { id: row.id, title: row.title, start: row.start, end: row.end, location: row.location } }
      }
      case "delete_event": {
        const ev = own(data.events, str(a.id))
        if (!ev) return { ok: false, error: "Event not found" }
        const [row] = await db.delete(schema.events).where(and(eq(schema.events.id, ev.id), eq(schema.events.userId, uid))).returning({ id: schema.events.id, externalId: schema.events.externalId })
        if (row) void deleteEventRemote(uid, row, log)
        activity.eventDeleted(uid, ev.title, "Welya", log)
        effects.eventsDeleted.push(ev.id)
        return { ok: true, deleted: ev.title }
      }
      case "plan_work_sessions": {
        await refresh()
        const from = parseDate(a.date) ?? new Date()
        const plan = a.scope === "week" ? planRange(data, "week", from) : (() => { const p = buildPlan(from, data); return { sessions: p.sessions, totalFree: p.totalFree } })()
        if (!plan.sessions.length) return { ok: false, error: "No free hour-long slots or nothing left to schedule" }
        const rows = await db.insert(schema.events).values(plan.sessions.map((s) => ({ ...s, id: randomUUID(), userId: uid }))).returning()
        for (const row of rows) void pushEvent(uid, row, log)
        activity.eventsCreated(uid, rows, "Welya", log)
        effects.sessionsAdded += rows.length
        return { ok: true, sessions: rows.map((r) => ({ title: r.title.replace("Work on: ", ""), start: r.start, end: r.end })) }
      }
      case "add_class_schedule": {
        await refresh()
        const rowsIn = Array.isArray(a.rows) ? (a.rows as Array<Record<string, unknown>>) : []
        const weeksN = Number(a.weeks)
        const weeks = Number.isFinite(weeksN) && weeksN > 0 ? Math.min(Math.round(weeksN), 26) : 16
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
        const existing = new Set(data.events.filter((e) => e.type === "class").map((e) => `${e.title.toLowerCase()}:${e.start}`))
        const values: Array<typeof schema.events.$inferInsert> = []
        for (const r of rowsIn) {
          const title = str(r.title).slice(0, 200)
          const day = DAY_INDEX[str(r.day).toLowerCase()]
          const s = parseClock(r.start), e = parseClock(r.end)
          if (!title || day == null || !s || !e) continue
          const cId = courseId(r.courseId) ?? data.courses.find((c) => c.name.toLowerCase() === title.toLowerCase())?.id ?? null
          for (let w = 0; w < weeks; w++) {
            const date = addDays(addWeeks(weekStart, w), day)
            const start = set(date, { hours: s[0], minutes: s[1], seconds: 0, milliseconds: 0 })
            const end = set(date, { hours: e[0], minutes: e[1], seconds: 0, milliseconds: 0 })
            if (end <= new Date() || end <= start) continue
            const key = `${title.toLowerCase()}:${start.toISOString()}`
            if (existing.has(key)) continue
            existing.add(key)
            values.push({ id: randomUUID(), userId: uid, title, type: "class", start: start.toISOString(), end: end.toISOString(), courseId: cId, location: str(r.location) || null, aiPlanned: false })
          }
        }
        if (!values.length) return { ok: false, error: "No valid rows, or those classes are already on the calendar" }
        const rows = await db.insert(schema.events).values(values).returning()
        for (const row of rows) void pushEvent(uid, row, log)
        activity.eventsCreated(uid, rows, "Welya", log)
        effects.classEventsAdded += rows.length
        return { ok: true, added: rows.length, classes: [...new Set(rows.map((r) => r.title))] }
      }
      default:
        return { ok: false, error: `Unknown tool: ${name}` }
    }
  }

  return { run, effects, tools: TOOLS }
}
