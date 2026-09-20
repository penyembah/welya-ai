import { and, eq } from "drizzle-orm"
import { format } from "date-fns"
import type { FastifyBaseLogger } from "fastify"
import { db, schema } from "../db/client.js"
import { getGoogleTokens, googleFetch, GoogleError, hasScopes, INTEGRATION_SCOPES } from "./google.js"

/**
 * Welya → Google mirror for Calendar events and Tasks. Every function is safe to call
 * fire-and-forget from a route: it no-ops unless the integration is connected with the
 * right scope, and never throws (errors are logged by the caller-provided logger).
 */

export const CALENDAR = "https://www.googleapis.com/calendar/v3"
export const GOOGLE_TASKS = "https://tasks.googleapis.com/tasks/v1"

type EventRow = typeof schema.events.$inferSelect
type TaskRow = typeof schema.tasks.$inferSelect

const TYPE_LABEL: Record<string, string> = { class: "Class", deadline: "Deadline", meeting: "Meeting", reminder: "Reminder", "work-session": "Work session" }

async function connectedWithScope(userId: string, integration: string) {
  const [row] = await db.select({ status: schema.integrations.status }).from(schema.integrations).where(and(eq(schema.integrations.userId, userId), eq(schema.integrations.id, integration)))
  if (row?.status !== "connected") return false
  const tokens = await getGoogleTokens(userId)
  return Boolean(tokens && hasScopes(tokens.scope, INTEGRATION_SCOPES[integration]))
}

/* ---------- Calendar ---------- */

export function toGoogleEvent(ev: Pick<EventRow, "title" | "type" | "start" | "end" | "location"> & { id?: string }) {
  const start = new Date(ev.start)
  // Google rejects end <= start; zero-length deadlines/reminders become 15-minute blocks
  const end = new Date(Math.max(new Date(ev.end).getTime(), start.getTime() + 15 * 60_000))
  return {
    summary: ev.title,
    description: `${TYPE_LABEL[ev.type] ?? ev.type} · created in Welya`,
    location: ev.location ?? undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: { private: { welyaId: ev.id ?? "", welyaType: ev.type } },
  }
}

const gcalId = (externalId: string | null) => (externalId?.startsWith("gcal:") ? externalId.slice(5) : null)

export async function pushEvent(userId: string, ev: EventRow, log?: FastifyBaseLogger) {
  try {
    if (!(await connectedWithScope(userId, "google-calendar"))) return
    const remoteId = gcalId(ev.externalId)
    if (remoteId) {
      await googleFetch(userId, `${CALENDAR}/calendars/primary/events/${encodeURIComponent(remoteId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toGoogleEvent(ev)) })
      return
    }
    const created = await googleFetch<{ id: string }>(userId, `${CALENDAR}/calendars/primary/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toGoogleEvent(ev)) })
    await db.update(schema.events).set({ externalId: `gcal:${created.id}` }).where(eq(schema.events.id, ev.id))
  } catch (err) {
    if (err instanceof GoogleError && err.code === "api_error" && /404/.test(err.message)) {
      // Deleted on Google's side: drop the link so the next push recreates it
      await db.update(schema.events).set({ externalId: null }).where(eq(schema.events.id, ev.id)).catch(() => {})
    }
    log?.warn({ err, eventId: ev.id }, "google calendar push failed")
  }
}

export async function deleteEventRemote(userId: string, ev: Pick<EventRow, "id" | "externalId">, log?: FastifyBaseLogger) {
  const remoteId = gcalId(ev.externalId)
  if (!remoteId) return
  try {
    if (!(await connectedWithScope(userId, "google-calendar"))) return
    await googleFetch(userId, `${CALENDAR}/calendars/primary/events/${encodeURIComponent(remoteId)}`, { method: "DELETE" })
  } catch (err) {
    log?.warn({ err, eventId: ev.id }, "google calendar delete failed")
  }
}

/* ---------- Tasks ---------- */

// Google Tasks keeps only the date part of `due`; we send the local calendar day at midnight UTC as the API expects.
export function toGoogleTask(t: Pick<TaskRow, "title" | "description" | "deadline" | "status" | "completedAt" | "notes">) {
  const done = t.status === "done"
  return {
    title: t.title,
    notes: [t.description, t.notes].filter(Boolean).join("\n\n") || undefined,
    due: `${format(new Date(t.deadline), "yyyy-MM-dd")}T00:00:00.000Z`,
    status: done ? "completed" : "needsAction",
    completed: done ? new Date(t.completedAt ?? Date.now()).toISOString() : null,
  }
}

const gtaskRef = (externalId: string | null) => {
  const m = externalId?.match(/^gtask:([^:]+):(.+)$/)
  return m ? { listId: m[1], taskId: m[2] } : null
}

export async function pushTask(userId: string, t: TaskRow, log?: FastifyBaseLogger) {
  try {
    if (!(await connectedWithScope(userId, "google-tasks"))) return
    const ref = gtaskRef(t.externalId)
    if (ref) {
      await googleFetch(userId, `${GOOGLE_TASKS}/lists/${encodeURIComponent(ref.listId)}/tasks/${encodeURIComponent(ref.taskId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toGoogleTask(t)) })
      return
    }
    const created = await googleFetch<{ id: string }>(userId, `${GOOGLE_TASKS}/lists/@default/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toGoogleTask(t)) })
    // "@default" is an alias; resolve the real list id so later PATCH/DELETE calls and the pull dedupe agree
    const lists = await googleFetch<{ items?: Array<{ id: string }> }>(userId, `${GOOGLE_TASKS}/users/@me/lists?maxResults=1`)
    const listId = lists.items?.[0]?.id ?? "@default"
    await db.update(schema.tasks).set({ externalId: `gtask:${listId}:${created.id}` }).where(eq(schema.tasks.id, t.id))
  } catch (err) {
    if (err instanceof GoogleError && err.code === "api_error" && /404/.test(err.message)) {
      await db.update(schema.tasks).set({ externalId: null }).where(eq(schema.tasks.id, t.id)).catch(() => {})
    }
    log?.warn({ err, taskId: t.id }, "google tasks push failed")
  }
}

export async function deleteTaskRemote(userId: string, t: Pick<TaskRow, "id" | "externalId">, log?: FastifyBaseLogger) {
  const ref = gtaskRef(t.externalId)
  if (!ref) return
  try {
    if (!(await connectedWithScope(userId, "google-tasks"))) return
    await googleFetch(userId, `${GOOGLE_TASKS}/lists/${encodeURIComponent(ref.listId)}/tasks/${encodeURIComponent(ref.taskId)}`, { method: "DELETE" })
  } catch (err) {
    log?.warn({ err, taskId: t.id }, "google tasks delete failed")
  }
}
