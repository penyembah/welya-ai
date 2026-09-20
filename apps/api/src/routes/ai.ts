import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { db, schema } from "../db/client.js"
import { loadUserData } from "../lib/data.js"
import { buildPlan, planRange, recommendations, suggestedPrompts } from "../lib/welya-ai.js"
import * as llm from "../lib/welya-llm.js"
import { env, llmEnabled } from "../env.js"
import { LIMITS } from "../lib/rate-limits.js"
import { runRemindersOnce } from "../lib/reminder-scheduler.js"

const iso = z.string().datetime({ offset: true })
const context = z.object({ courseId: z.string().nullable().optional(), workspaceId: z.string().nullable().optional(), taskId: z.string().nullable().optional(), documentId: z.string().nullable().optional() }).optional()

function usablePlanningActions(actions: Array<Record<string, unknown>>, data: Awaited<ReturnType<typeof loadUserData>>) {
  return actions.filter((action) => {
    if (action.kind === "plan-week") return planRange(data, "week").sessions.length > 0
    if (action.kind === "plan") return buildPlan(new Date(), data).sessions.length > 0
    return true
  })
}

function conversationHistory(messages: Array<Record<string, unknown>>) {
  return messages.map((message) => {
    const actions = Array.isArray(message.actions) ? message.actions as Array<Record<string, unknown>> : []
    const scheduleAction = actions.find((action) => action.kind === "schedule-courses" && Array.isArray(action.schedule))
    const scheduleContext = scheduleAction ? `\n[SCHEDULE_DATA:${JSON.stringify(scheduleAction.schedule)}]` : ""
    return { role: String(message.role), content: `${String(message.content ?? "")}${scheduleContext}` }
  })
}

export const aiRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", app.authenticate)

  app.post("/ai/chat/image", { config: LIMITS.aiChat }, async (req, reply) => {
    const part = await req.file({ limits: { fileSize: 10 * 1024 * 1024 } })
    if (!part) return reply.badRequest("Attach an image first.")
    if (!part.mimetype.startsWith("image/")) return reply.badRequest("Only PNG, JPG or WebP images are supported.")
    if (part.file.truncated) return reply.badRequest("Image is larger than 10 MB.")

    const fields = part.fields as Record<string, { value?: string } | undefined>
    const message = fields.message?.value?.trim() || "Analyze this academic image and explain what I should add to my calendar."
    const conversationId = fields.conversationId?.value || null
    const persist = fields.persist?.value !== "false"
    let requestContext: import("../lib/welya-ai.js").ChatContext = {}
    try {
      requestContext = fields.context?.value ? JSON.parse(fields.context.value) : {}
    } catch {
      return reply.badRequest("Invalid chat context.")
    }

    const uid = req.user.sub
    const data = await loadUserData(uid)
    let current: typeof schema.conversations.$inferSelect | null = null
    if (persist && conversationId) {
      const [row] = await db.select().from(schema.conversations).where(and(eq(schema.conversations.id, conversationId), eq(schema.conversations.userId, uid)))
      if (!row) return reply.notFound()
      current = row
    }
    const history = conversationHistory((current?.messages ?? []) as Array<Record<string, unknown>>)
    const imageDataUrl = `data:${part.mimetype};base64,${(await part.toBuffer()).toString("base64")}`
    const out = await llm.chatWithImage(message, imageDataUrl, data, requestContext, history)
    if (out.source === "rules" && llmEnabled) req.log.warn({ reason: (out as { fallbackReason?: string }).fallbackReason }, "vision chat fell back to rules")

    const now = new Date().toISOString()
    const userMsg = { id: `u-${randomUUID()}`, role: "user", content: `${message}\n\n[Image attached: ${part.filename}]`, time: now }
    const aiMsg = { id: `a-${randomUUID()}`, role: "assistant", time: now, source: out.source, content: out.content, references: out.references, actions: usablePlanningActions(out.actions ?? [], data) }
    if (!persist) return { conversation: null, messages: [userMsg, aiMsg] }

    if (current) {
      const title = current.messages.length === 0 ? await llm.conversationTitle(message) : current.title
      const [row] = await db.update(schema.conversations).set({ title, messages: [...current.messages, userMsg, aiMsg], updatedAt: now }).where(eq(schema.conversations.id, current.id)).returning()
      return { conversation: row, messages: [userMsg, aiMsg] }
    }
    const title = await llm.conversationTitle(message)
    const [row] = await db.insert(schema.conversations).values({ id: randomUUID(), userId: uid, title, messages: [userMsg, aiMsg], updatedAt: now }).returning()
    return { conversation: row, messages: [userMsg, aiMsg] }
  })

  app.get("/ai/status", async () => ({ provider: llmEnabled ? "azure-openai" : "rules", model: llmEnabled ? process.env.AZURE_OPENAI_DEPLOYMENT : null }))

  // Dev-only: send yourself today's summary or the weekly review right now to preview the briefing emails
  app.post("/ai/briefing/:kind", { config: LIMITS.aiAction, schema: { params: z.object({ kind: z.enum(["daily", "weekly"]) }) } }, async (req, reply) => {
    if (env.NODE_ENV === "production") return reply.notFound()
    return runRemindersOnce(req.log, { userId: req.user.sub, force: req.params.kind })
  })

  app.get("/ai/recommendations", { config: LIMITS.aiRead }, async (req) => {
    const data = await loadUserData(req.user.sub)
    return { recommendations: recommendations(data), suggestedPrompts: suggestedPrompts(data) }
  })

  app.post("/ai/plan", { config: LIMITS.aiRead, schema: { body: z.object({ scope: z.enum(["day", "week"]).default("day"), date: iso.optional() }) } }, async (req) => {
    const data = await loadUserData(req.user.sub)
    const from = req.body.date ? new Date(req.body.date) : new Date()
    if (req.body.scope === "day") {
      const plan = buildPlan(from, data)
      return { days: [{ date: from.toISOString(), ...plan }], sessions: plan.sessions, totalFree: plan.totalFree }
    }
    return planRange(data, "week", from)
  })

  app.post("/ai/breakdown", { config: LIMITS.aiAction, schema: { body: z.object({ taskId: z.string() }) } }, async (req, reply) => {
    const data = await loadUserData(req.user.sub)
    const task = data.tasks.find((t) => t.id === req.body.taskId)
    if (!task) return reply.notFound()
    const out = await llm.breakdown(task, data)
    if (out.source === "rules" && llmEnabled) req.log.warn({ reason: (out as { fallbackReason?: string }).fallbackReason }, "breakdown fell back to rules")
    return out
  })

  app.post("/ai/document", { config: LIMITS.aiAction, schema: { body: z.object({ documentId: z.string(), action: z.enum(["summarize", "tasks", "deadlines", "notes"]) }) } }, async (req, reply) => {
    const data = await loadUserData(req.user.sub)
    const doc = data.documents.find((d) => d.id === req.body.documentId)
    if (!doc) return reply.notFound()
    if (req.body.action === "notes") {
      const [note] = await db
        .insert(schema.documents)
        .values({ id: randomUUID(), userId: req.user.sub, title: `Notes – ${doc.title}`, type: "note", courseId: doc.courseId, workspaceId: doc.workspaceId, size: "—", summary: doc.summary, content: `Auto-generated from ${doc.title}:\n\n${doc.summary}`, tags: ["ai-notes"], linkedTaskIds: doc.linkedTaskIds })
        .returning()
      return { title: "Notes created", lines: [note.title], note }
    }
    const out = await llm.analyzeDocument(doc, data, req.body.action)
    if (out.source === "rules" && llmEnabled) req.log.warn({ reason: (out as { fallbackReason?: string }).fallbackReason }, "document analysis fell back to rules")
    return out
  })

  app.get("/ai/review", { config: LIMITS.aiAction }, async (req) => {
    const out = await llm.weeklyReview(await loadUserData(req.user.sub))
    if (out.source === "rules" && llmEnabled) req.log.warn({ reason: (out as { fallbackReason?: string }).fallbackReason }, "review fell back to rules")
    return out
  })

  app.post("/ai/chat", { config: LIMITS.aiChat, schema: { body: z.object({ message: z.string().trim().min(1).max(2000), conversationId: z.string().nullable().optional(), context, persist: z.boolean().default(true) }) } }, async (req, reply) => {
    const uid = req.user.sub
    const data = await loadUserData(uid)
    const now = new Date().toISOString()
    const userMsg = { id: `u-${randomUUID()}`, role: "user", content: req.body.message, time: now }

    let conversationId = req.body.conversationId ?? null
    let current: typeof schema.conversations.$inferSelect | null = null
    if (req.body.persist && conversationId) {
      const [row] = await db.select().from(schema.conversations).where(and(eq(schema.conversations.id, conversationId), eq(schema.conversations.userId, uid)))
      if (!row) return reply.notFound()
      current = row
    }
    const history = conversationHistory((current?.messages ?? []) as Array<Record<string, unknown>>)
    const { source, fallbackReason, ...answer } = (await llm.chat(req.body.message, data, req.body.context ?? {}, history)) as llm.WithSource<import("../lib/welya-ai.js").Reply> & { fallbackReason?: string }
    if (source === "rules" && llmEnabled) req.log.warn({ reason: fallbackReason }, "chat fell back to rules")
    const aiMsg = { id: `a-${randomUUID()}`, role: "assistant", time: new Date().toISOString(), source, ...answer, actions: usablePlanningActions(answer.actions ?? [], data) }

    if (!req.body.persist) return { conversation: null, messages: [userMsg, aiMsg] }

    if (current) {
      const title = current.messages.length === 0 ? await llm.conversationTitle(req.body.message) : current.title
      const [row] = await db.update(schema.conversations).set({ title, messages: [...current.messages, userMsg, aiMsg], updatedAt: now }).where(eq(schema.conversations.id, current.id)).returning()
      return { conversation: row, messages: [userMsg, aiMsg] }
    }
    const title = await llm.conversationTitle(req.body.message)
    const [row] = await db.insert(schema.conversations).values({ id: randomUUID(), userId: uid, title, messages: [userMsg, aiMsg], updatedAt: now }).returning()
    return { conversation: row, messages: [userMsg, aiMsg] }
  })
}
