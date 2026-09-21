import { randomUUID } from "node:crypto"
import { format } from "date-fns"
import type { FastifyBaseLogger } from "fastify"
import { db, schema } from "../db/client.js"

/**
 * In-app activity notifications: one row per successful create/update/delete, written
 * fire-and-forget so the request that caused it never waits on (or fails because of) it.
 */

export type NotifyInput = { type: "task" | "calendar" | "class" | "ai" | "inbox" | "deadline"; title: string; message?: string; link?: string | null }

export function notify(userId: string, n: NotifyInput, log?: FastifyBaseLogger) {
  void db
    .insert(schema.notifications)
    .values({ id: randomUUID(), userId, type: n.type, title: n.title, message: n.message ?? "", link: n.link ?? null })
    .catch((err) => log?.warn({ err }, "notification insert failed"))
}

const when = (iso: string) => format(new Date(iso), "EEE d MMM HH:mm")
const by = (actor?: string) => (actor ? ` by ${actor}` : "")

type TaskRow = Pick<typeof schema.tasks.$inferSelect, "id" | "title" | "deadline" | "status" | "subtasks" | "progress">
type EventRow = Pick<typeof schema.events.$inferSelect, "id" | "title" | "type" | "start" | "end" | "location">

export const activity = {
  taskCreated: (uid: string, t: TaskRow, actor?: string, log?: FastifyBaseLogger) =>
    notify(uid, { type: "task", title: `Task created${by(actor)}`, message: `${t.title} · due ${when(t.deadline)}`, link: `/tasks?task=${t.id}` }, log),

  taskUpdated: (uid: string, before: TaskRow | undefined, t: TaskRow, patch: Record<string, unknown>, actor?: string, log?: FastifyBaseLogger) => {
    const keys = Object.keys(patch)
    let title = `Task updated${by(actor)}`
    let message = t.title
    if (patch.status === "done" && before?.status !== "done") { title = "Task completed"; message = `${t.title} · nice work` }
    else if (patch.status && patch.status !== "done" && before?.status === "done") { title = "Task reopened" }
    else if (keys.length === 1 && keys[0] === "notes") { title = "Notes saved" }
    else if (keys.every((k) => ["subtasks", "progress", "status"].includes(k))) {
      const done = (t.subtasks ?? []).filter((s) => s.done).length
      title = "Subtasks updated"
      message = `${t.title} · ${done}/${(t.subtasks ?? []).length} done · ${t.progress}%`
    } else if (patch.deadline && before && patch.deadline !== before.deadline) { title = "Deadline changed"; message = `${t.title} · now due ${when(t.deadline)}` }
    notify(uid, { type: "task", title, message, link: `/tasks?task=${t.id}` }, log)
  },

  taskDeleted: (uid: string, title: string, actor?: string, log?: FastifyBaseLogger) => notify(uid, { type: "task", title: `Task deleted${by(actor)}`, message: title, link: "/tasks" }, log),

  eventCreated: (uid: string, e: EventRow, actor?: string, log?: FastifyBaseLogger) =>
    notify(uid, { type: e.type === "class" ? "class" : "calendar", title: `${e.type === "class" ? "Class" : e.type === "work-session" ? "Work session" : "Event"} added${by(actor)}`, message: `${e.title} · ${when(e.start)}${e.location ? ` · ${e.location}` : ""}`, link: "/calendar?view=week" }, log),

  eventsCreated: (uid: string, rows: EventRow[], actor?: string, log?: FastifyBaseLogger) => {
    if (rows.length === 1) return activity.eventCreated(uid, rows[0], actor, log)
    const classes = rows.every((r) => r.type === "class")
    const sessions = rows.every((r) => r.type === "work-session")
    const titles = [...new Set(rows.map((r) => r.title.replace("Work on: ", "")))]
    notify(uid, {
      type: classes ? "class" : "calendar",
      title: classes ? `${rows.length} class events added${by(actor)}` : sessions ? `${rows.length} work sessions planned${by(actor)}` : `${rows.length} events added${by(actor)}`,
      message: titles.slice(0, 4).join(", ") + (titles.length > 4 ? ` +${titles.length - 4} more` : ""),
      link: classes ? "/calendar?view=month" : "/calendar?view=week",
    }, log)
  },

  eventUpdated: (uid: string, e: EventRow, actor?: string, log?: FastifyBaseLogger) => notify(uid, { type: "calendar", title: `Event updated${by(actor)}`, message: `${e.title} · ${when(e.start)}${e.location ? ` · ${e.location}` : ""}`, link: "/calendar?view=week" }, log),
  eventDeleted: (uid: string, title: string, actor?: string, log?: FastifyBaseLogger) => notify(uid, { type: "calendar", title: `Event removed${by(actor)}`, message: title, link: "/calendar" }, log),

  courseCreated: (uid: string, c: { id: string; name: string; code: string }, log?: FastifyBaseLogger) => notify(uid, { type: "class", title: "Course added", message: `${c.name} (${c.code})`, link: `/courses/${c.id}` }, log),
  courseUpdated: (uid: string, c: { id: string; name: string }, log?: FastifyBaseLogger) => notify(uid, { type: "class", title: "Course updated", message: c.name, link: `/courses/${c.id}` }, log),
  courseDeleted: (uid: string, name: string, log?: FastifyBaseLogger) => notify(uid, { type: "class", title: "Course removed", message: name, link: "/courses" }, log),

  workspaceCreated: (uid: string, w: { id: string; name: string }, log?: FastifyBaseLogger) => notify(uid, { type: "ai", title: "Workspace created", message: w.name, link: `/workspaces/${w.id}` }, log),
  workspaceUpdated: (uid: string, w: { id: string; name: string }, log?: FastifyBaseLogger) => notify(uid, { type: "ai", title: "Workspace updated", message: w.name, link: `/workspaces/${w.id}` }, log),
  workspaceDeleted: (uid: string, name: string, log?: FastifyBaseLogger) => notify(uid, { type: "ai", title: "Workspace deleted", message: name, link: "/workspaces" }, log),

  documentCreated: (uid: string, d: { id: string; title: string; type: string }, log?: FastifyBaseLogger) => notify(uid, { type: "inbox", title: d.type === "note" ? "Note created" : "Document added", message: d.title, link: `/documents?doc=${d.id}` }, log),
  documentDeleted: (uid: string, title: string, log?: FastifyBaseLogger) => notify(uid, { type: "inbox", title: "Document removed", message: title, link: "/documents" }, log),

  inboxCreated: (uid: string, i: { id: string; subject: string; sender: string }, log?: FastifyBaseLogger) => notify(uid, { type: "inbox", title: "Added to inbox", message: `${i.subject} · from ${i.sender}`, link: `/inbox?item=${i.id}` }, log),
}
