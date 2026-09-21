import { and, eq } from "drizzle-orm"
import { z } from "zod"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { db, schema } from "../db/client.js"
import { DEFAULT_SETTINGS } from "../lib/provision.js"
import { loadUserData } from "../lib/data.js"
import { suggestedPrompts } from "../lib/welya-ai.js"
import { interpret } from "../lib/welya-llm.js"
import { env, llmEnabled, googleEnabled } from "../env.js"
import { authorizationUrl, deleteGoogleTokens, encodeState, getGoogleTokens, GoogleError, hasScopes, INTEGRATION_SCOPES, isGoogleIntegration, revokeToken } from "../lib/google.js"
import { SYNCERS } from "../lib/google-sync.js"
import { deleteEventRemote, deleteTaskRemote, pushEvent, pushTask } from "../lib/google-push.js"
import { activity } from "../lib/notify.js"
import { LIMITS } from "../lib/rate-limits.js"

const iso = z.string().datetime({ offset: true })
const id = z.string().min(1).max(64)
const nullableId = id.nullable().optional()

const subtask = z.object({ id, title: z.string(), done: z.boolean() })

const taskInput = z.object({
  id: id.optional(),
  title: z.string().trim().min(1),
  description: z.string().optional(),
  courseId: nullableId,
  workspaceId: nullableId,
  deadline: iso,
  priority: z.enum(["high", "medium", "low"]).optional(),
  status: z.enum(["todo", "in-progress", "done"]).optional(),
  estimatedMinutes: z.coerce.number().int().min(0).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  subtasks: z.array(subtask).optional(),
  attachments: z.array(z.string()).optional(),
  source: z.object({ type: z.string(), label: z.string(), inboxId: z.string().optional() }).optional(),
  notes: z.string().optional(),
  completedAt: iso.nullable().optional(),
})

const eventInput = z.object({
  id: id.optional(),
  title: z.string().trim().min(1),
  type: z.string().optional(),
  start: iso,
  end: iso,
  courseId: nullableId,
  workspaceId: nullableId,
  taskId: nullableId,
  location: z.string().nullable().optional(),
  aiPlanned: z.boolean().optional(),
})

const inboxInput = z.object({
  id: id.optional(),
  source: z.string(),
  sender: z.string(),
  senderEmail: z.string().nullable().optional(),
  subject: z.string(),
  receivedAt: iso.optional(),
  preview: z.string().optional(),
  body: z.string().optional(),
  status: z.string().optional(),
  courseId: nullableId,
  importance: z.string().optional(),
  ai: z.record(z.string(), z.unknown()).optional(),
  resultTaskId: z.string().nullable().optional(),
  resultDocumentId: z.string().nullable().optional(),
})

const documentInput = z.object({
  id: id.optional(),
  title: z.string().trim().min(1),
  type: z.string().optional(),
  courseId: nullableId,
  workspaceId: nullableId,
  size: z.string().optional(),
  uploadedAt: iso.optional(),
  pages: z.number().int().nullable().optional(),
  summary: z.string().optional(),
  content: z.string().nullable().optional(),
  linkedTaskIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
})

const workspaceInput = z.object({
  id: id.optional(),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  type: z.string().optional(),
  members: z.number().int().optional(),
})

const courseInput = z.object({
  id: id.optional(),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  lecturer: z.string().optional(),
  room: z.string().optional(),
  color: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  credits: z.number().int().optional(),
  schedule: z.array(z.object({ day: z.string(), start: z.string(), end: z.string(), room: z.string(), type: z.string() })).optional(),
})

const notificationInput = z.object({
  id: id.optional(),
  type: z.string(),
  title: z.string(),
  message: z.string().optional(),
  time: iso.optional(),
  read: z.boolean().optional(),
  link: z.string().nullable().optional(),
})

const conversationInput = z.object({
  id: id.optional(),
  title: z.string(),
  updatedAt: iso.optional(),
  messages: z.array(z.record(z.string(), z.unknown())).optional(),
})

const newId = () => crypto.randomUUID()

export const resourceRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", app.authenticate)

  /* ---------- bootstrap: everything the client needs in one round trip ---------- */
  app.get("/bootstrap", async (req) => {
    const data = await loadUserData(req.user.sub)
    return { ...data, suggestedPrompts: suggestedPrompts(data) }
  })

  /* ---------- tasks (mirrored to Google Tasks when connected) ---------- */
  app.post("/tasks", { schema: { body: taskInput } }, async (req, reply) => {
    const [row] = await db.insert(schema.tasks).values({ ...req.body, id: req.body.id ?? newId(), userId: req.user.sub }).returning()
    void pushTask(req.user.sub, row, req.log)
    activity.taskCreated(req.user.sub, row, row.source?.type === "assistant" ? "Welya" : undefined, req.log)
    return reply.code(201).send(row)
  })
  app.patch("/tasks/:id", { schema: { params: z.object({ id }), body: taskInput.partial() } }, async (req, reply) => {
    const [before] = await db.select().from(schema.tasks).where(and(eq(schema.tasks.id, req.params.id), eq(schema.tasks.userId, req.user.sub)))
    const [row] = await db.update(schema.tasks).set(req.body).where(and(eq(schema.tasks.id, req.params.id), eq(schema.tasks.userId, req.user.sub))).returning()
    if (!row) return reply.notFound()
    void pushTask(req.user.sub, row, req.log)
    activity.taskUpdated(req.user.sub, before, row, req.body, undefined, req.log)
    return row
  })
  app.delete("/tasks/:id", { schema: { params: z.object({ id }) } }, async (req) => {
    const [row] = await db.delete(schema.tasks).where(and(eq(schema.tasks.id, req.params.id), eq(schema.tasks.userId, req.user.sub))).returning({ id: schema.tasks.id, title: schema.tasks.title, externalId: schema.tasks.externalId })
    if (row) {
      void deleteTaskRemote(req.user.sub, row, req.log)
      activity.taskDeleted(req.user.sub, row.title, undefined, req.log)
    }
    return { ok: true }
  })

  /* ---------- events (mirrored to Google Calendar when connected) ---------- */
  app.post("/events", { schema: { body: z.union([eventInput, z.array(eventInput)]) } }, async (req, reply) => {
    const list = Array.isArray(req.body) ? req.body : [req.body]
    if (!list.length) return reply.code(201).send([])
    const rows = await db.insert(schema.events).values(list.map((e) => ({ ...e, id: e.id ?? newId(), userId: req.user.sub }))).returning()
    for (const row of rows) void pushEvent(req.user.sub, row, req.log)
    activity.eventsCreated(req.user.sub, rows, rows.every((r) => r.aiPlanned) ? "Welya" : undefined, req.log)
    return reply.code(201).send(Array.isArray(req.body) ? rows : rows[0])
  })
  app.patch("/events/:id", { schema: { params: z.object({ id }), body: eventInput.partial() } }, async (req, reply) => {
    const [row] = await db.update(schema.events).set(req.body).where(and(eq(schema.events.id, req.params.id), eq(schema.events.userId, req.user.sub))).returning()
    if (!row) return reply.notFound()
    void pushEvent(req.user.sub, row, req.log)
    activity.eventUpdated(req.user.sub, row, undefined, req.log)
    return row
  })
  app.delete("/events/:id", { schema: { params: z.object({ id }) } }, async (req) => {
    const [row] = await db.delete(schema.events).where(and(eq(schema.events.id, req.params.id), eq(schema.events.userId, req.user.sub))).returning({ id: schema.events.id, title: schema.events.title, externalId: schema.events.externalId })
    if (row) {
      void deleteEventRemote(req.user.sub, row, req.log)
      activity.eventDeleted(req.user.sub, row.title, undefined, req.log)
    }
    return { ok: true }
  })

  /* ---------- inbox ---------- */
  app.post("/inbox", { config: LIMITS.inboxCreate, schema: { body: inboxInput } }, async (req, reply) => {
    let values = { ...req.body }
    // Manual / forwarded items arrive without an interpretation: Welya reads them here
    if (!values.ai || !Object.keys(values.ai).length) {
      const courses = await db.select().from(schema.courses).where(eq(schema.courses.userId, req.user.sub))
      const understood = await interpret(`${values.subject}\n${values.body ?? ""}`, values.source, { courses })
      if (understood.source === "rules" && llmEnabled) req.log.warn({ reason: (understood as { fallbackReason?: string }).fallbackReason }, "inbox interpretation fell back to rules")
      values = { ...values, ai: { ...understood.ai, source: understood.source }, courseId: values.courseId ?? understood.courseId, importance: values.importance ?? understood.importance, preview: values.preview ?? (values.body ?? "").slice(0, 100) }
    }
    const [row] = await db.insert(schema.inboxItems).values({ ...values, id: values.id ?? newId(), userId: req.user.sub }).returning()
    activity.inboxCreated(req.user.sub, row, req.log)
    return reply.code(201).send(row)
  })
  app.patch("/inbox/:id", { schema: { params: z.object({ id }), body: inboxInput.partial() } }, async (req, reply) => {
    const [row] = await db.update(schema.inboxItems).set(req.body).where(and(eq(schema.inboxItems.id, req.params.id), eq(schema.inboxItems.userId, req.user.sub))).returning()
    return row ?? reply.notFound()
  })

  /* ---------- documents ---------- */
  app.post("/documents", { schema: { body: documentInput } }, async (req, reply) => {
    const [row] = await db.insert(schema.documents).values({ ...req.body, id: req.body.id ?? newId(), userId: req.user.sub }).returning()
    activity.documentCreated(req.user.sub, row, req.log)
    return reply.code(201).send(row)
  })
  app.patch("/documents/:id", { schema: { params: z.object({ id }), body: documentInput.partial() } }, async (req, reply) => {
    const [row] = await db.update(schema.documents).set(req.body).where(and(eq(schema.documents.id, req.params.id), eq(schema.documents.userId, req.user.sub))).returning()
    return row ?? reply.notFound()
  })
  app.delete("/documents/:id", { schema: { params: z.object({ id }) } }, async (req) => {
    const [row] = await db.delete(schema.documents).where(and(eq(schema.documents.id, req.params.id), eq(schema.documents.userId, req.user.sub))).returning({ title: schema.documents.title })
    if (row) activity.documentDeleted(req.user.sub, row.title, req.log)
    return { ok: true }
  })

  /* ---------- notifications ---------- */
  app.post("/notifications", { schema: { body: notificationInput } }, async (req, reply) => {
    const [row] = await db.insert(schema.notifications).values({ ...req.body, id: req.body.id ?? newId(), userId: req.user.sub }).returning()
    return reply.code(201).send(row)
  })
  app.patch("/notifications/:id", { schema: { params: z.object({ id }), body: z.object({ read: z.boolean() }) } }, async (req, reply) => {
    const [row] = await db.update(schema.notifications).set(req.body).where(and(eq(schema.notifications.id, req.params.id), eq(schema.notifications.userId, req.user.sub))).returning()
    return row ?? reply.notFound()
  })
  app.post("/notifications/read-all", async (req) => {
    await db.update(schema.notifications).set({ read: true }).where(eq(schema.notifications.userId, req.user.sub))
    return { ok: true }
  })

  /* ---------- workspaces ---------- */
  app.post("/workspaces", { schema: { body: workspaceInput } }, async (req, reply) => {
    const [row] = await db.insert(schema.workspaces).values({ ...req.body, id: req.body.id ?? newId(), userId: req.user.sub }).returning()
    activity.workspaceCreated(req.user.sub, row, req.log)
    return reply.code(201).send(row)
  })
  app.patch("/workspaces/:id", { schema: { params: z.object({ id }), body: workspaceInput.partial() } }, async (req, reply) => {
    const [row] = await db.update(schema.workspaces).set(req.body).where(and(eq(schema.workspaces.id, req.params.id), eq(schema.workspaces.userId, req.user.sub))).returning()
    if (row) activity.workspaceUpdated(req.user.sub, row, req.log)
    return row ?? reply.notFound()
  })
  app.delete("/workspaces/:id", { schema: { params: z.object({ id }) } }, async (req) => {
    const [row] = await db.delete(schema.workspaces).where(and(eq(schema.workspaces.id, req.params.id), eq(schema.workspaces.userId, req.user.sub))).returning({ name: schema.workspaces.name })
    if (row) activity.workspaceDeleted(req.user.sub, row.name, req.log)
    return { ok: true }
  })

  /* ---------- courses ---------- */
  app.post("/courses", { schema: { body: courseInput } }, async (req, reply) => {
    const [row] = await db.insert(schema.courses).values({ ...req.body, id: req.body.id ?? newId(), userId: req.user.sub }).returning()
    activity.courseCreated(req.user.sub, row, req.log)
    return reply.code(201).send(row)
  })
  app.patch("/courses/:id", { schema: { params: z.object({ id }), body: courseInput.partial() } }, async (req, reply) => {
    const [row] = await db.update(schema.courses).set(req.body).where(and(eq(schema.courses.id, req.params.id), eq(schema.courses.userId, req.user.sub))).returning()
    if (row) activity.courseUpdated(req.user.sub, row, req.log)
    return row ?? reply.notFound()
  })
  app.delete("/courses/:id", { schema: { params: z.object({ id }) } }, async (req) => {
    const [row] = await db.delete(schema.courses).where(and(eq(schema.courses.id, req.params.id), eq(schema.courses.userId, req.user.sub))).returning({ name: schema.courses.name })
    if (row) activity.courseDeleted(req.user.sub, row.name, req.log)
    return { ok: true }
  })

  /* ---------- integrations ---------- */
  const integrationWhere = (userId: string, id: string) => and(eq(schema.integrations.id, id), eq(schema.integrations.userId, userId))

  app.patch("/integrations/:id", { schema: { params: z.object({ id }), body: z.object({ status: z.string().optional(), account: z.string().nullable().optional(), lastSync: iso.nullable().optional() }) } }, async (req, reply) => {
    const [row] = await db.update(schema.integrations).set(req.body).where(integrationWhere(req.user.sub, req.params.id)).returning()
    return row ?? reply.notFound()
  })
  // Google services: returns an OAuth URL the client must navigate to. The callback in routes/google.ts finishes the connection.
  app.post("/integrations/:id/connect", { config: LIMITS.connect, schema: { params: z.object({ id }), body: z.object({ account: z.string().email().optional() }).nullable().optional() } }, async (req, reply) => {
    const [current] = await db.select().from(schema.integrations).where(integrationWhere(req.user.sub, req.params.id))
    if (!current) return reply.notFound()
    if (current.status === "coming-soon") return reply.badRequest("This integration isn't available yet.")
    if (!isGoogleIntegration(current.id)) return reply.badRequest("This integration has no connector yet.")
    if (!googleEnabled) return reply.code(503).send({ message: "Google integrations aren't configured on this server." })

    // Already authorised for these scopes (e.g. Gmail connected earlier) → no second consent screen needed
    const tokens = await getGoogleTokens(req.user.sub)
    if (tokens?.refreshToken && hasScopes(tokens.scope, INTEGRATION_SCOPES[current.id])) {
      const [row] = await db.update(schema.integrations).set({ status: "connected", account: tokens.email, lastSync: null }).where(integrationWhere(req.user.sub, current.id)).returning()
      void SYNCERS[current.id](req.user.sub)
        .then(() => db.update(schema.integrations).set({ lastSync: new Date().toISOString() }).where(integrationWhere(req.user.sub, current.id)))
        .catch((err) => req.log.error({ err }, "initial sync failed"))
      return row
    }
    const state = encodeState({ purpose: "integration", userId: req.user.sub, integration: current.id })
    const authUrl = authorizationUrl({ scopes: INTEGRATION_SCOPES[current.id], state, redirectUri: env.GOOGLE_INTEGRATION_REDIRECT_URI, loginHint: tokens?.email ?? req.user.email, consent: true })
    return { ...current, authUrl }
  })
  app.post("/integrations/:id/disconnect", { schema: { params: z.object({ id }) } }, async (req, reply) => {
    const [row] = await db.update(schema.integrations).set({ status: "disconnected", account: null, lastSync: null }).where(integrationWhere(req.user.sub, req.params.id)).returning()
    if (!row) return reply.notFound()
    // Revoke the Google grant only once no other Google service still depends on it
    if (isGoogleIntegration(row.id)) {
      const others = await db.select({ id: schema.integrations.id }).from(schema.integrations).where(and(eq(schema.integrations.userId, req.user.sub), eq(schema.integrations.status, "connected")))
      if (!others.some((o) => isGoogleIntegration(o.id))) {
        const tokens = await getGoogleTokens(req.user.sub)
        if (tokens) {
          await revokeToken(tokens.refreshToken ?? tokens.accessToken)
          await deleteGoogleTokens(req.user.sub)
        }
      }
    }
    return row
  })
  app.post("/integrations/:id/sync", { config: LIMITS.sync, schema: { params: z.object({ id }) } }, async (req, reply) => {
    const [current] = await db.select().from(schema.integrations).where(integrationWhere(req.user.sub, req.params.id))
    if (!current) return reply.notFound()
    if (current.status !== "connected") return reply.badRequest("Connect the integration first.")
    const sync = SYNCERS[current.id]
    if (!sync) return reply.badRequest("Nothing to sync for this integration.")
    try {
      const result = await sync(req.user.sub)
      const [row] = await db.update(schema.integrations).set({ lastSync: new Date().toISOString() }).where(integrationWhere(req.user.sub, current.id)).returning()
      return { ...row, result }
    } catch (err) {
      if (err instanceof GoogleError && (err.code === "reauth_required" || err.code === "not_connected" || err.code === "insufficient_scope")) {
        await db.update(schema.integrations).set({ status: "error" }).where(integrationWhere(req.user.sub, current.id))
        return reply.code(409).send({ message: "Google access expired or was revoked. Reconnect the integration.", code: err.code })
      }
      throw err
    }
  })
  app.post("/integrations/:id/waitlist", { schema: { params: z.object({ id }) } }, async (req, reply) => {
    const [current] = await db.select().from(schema.integrations).where(and(eq(schema.integrations.id, req.params.id), eq(schema.integrations.userId, req.user.sub)))
    if (!current) return reply.notFound()
    await db.insert(schema.notifications).values({ id: newId(), userId: req.user.sub, type: "ai", title: `You're on the waitlist for ${current.name}`, message: "Welya will notify you as soon as this integration is available.", link: "/settings/integrations" })
    return { ok: true }
  })

  /* ---------- settings ---------- */
  app.patch("/settings", { schema: { body: z.object({ section: z.enum(["ai", "notifications", "privacy"]), patch: z.record(z.string(), z.unknown()) }) } }, async (req) => {
    const [current] = await db.select().from(schema.settings).where(eq(schema.settings.userId, req.user.sub))
    const base = current ?? { userId: req.user.sub, ...DEFAULT_SETTINGS }
    const merged = { ...(base[req.body.section] as Record<string, unknown>), ...req.body.patch }
    const [row] = await db
      .insert(schema.settings)
      .values({ ...base, [req.body.section]: merged })
      .onConflictDoUpdate({ target: schema.settings.userId, set: { [req.body.section]: merged } })
      .returning()
    return { ai: row.ai, notifications: row.notifications, privacy: row.privacy }
  })

  /* ---------- conversations ---------- */
  app.post("/conversations", { schema: { body: conversationInput } }, async (req, reply) => {
    const [row] = await db.insert(schema.conversations).values({ ...req.body, id: req.body.id ?? newId(), userId: req.user.sub }).returning()
    return reply.code(201).send(row)
  })
  app.patch("/conversations/:id", { schema: { params: z.object({ id }), body: z.object({ title: z.string().optional(), append: z.array(z.record(z.string(), z.unknown())).optional() }) } }, async (req, reply) => {
    const [current] = await db.select().from(schema.conversations).where(and(eq(schema.conversations.id, req.params.id), eq(schema.conversations.userId, req.user.sub)))
    if (!current) return reply.notFound()
    const [row] = await db
      .update(schema.conversations)
      .set({ title: req.body.title ?? current.title, messages: req.body.append ? [...current.messages, ...req.body.append] : current.messages, updatedAt: new Date().toISOString() })
      .where(eq(schema.conversations.id, req.params.id))
      .returning()
    return row
  })
  app.delete("/conversations/:id", { schema: { params: z.object({ id }) } }, async (req, reply) => {
    const [row] = await db.delete(schema.conversations).where(and(eq(schema.conversations.id, req.params.id), eq(schema.conversations.userId, req.user.sub))).returning({ id: schema.conversations.id })
    if (!row) return reply.notFound()
    return { ok: true }
  })
}
