import { randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, stat, writeFile, unlink } from "node:fs/promises"
import path from "node:path"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { db, schema } from "../db/client.js"
import { env, llmEnabled } from "../env.js"
import { interpret } from "../lib/welya-llm.js"
import { extractText } from "../lib/extract-text.js"
import { LIMITS } from "../lib/rate-limits.js"

const MAX_BYTES = 25 * 1024 * 1024
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"])

const typeOf = (mime: string, name: string) => (mime.startsWith("image/") ? "image" : mime === "application/pdf" || name.toLowerCase().endsWith(".pdf") ? "pdf" : "doc")
const humanSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`)

export const fileRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", app.authenticate)
  await mkdir(env.UPLOAD_DIR, { recursive: true })

  // multipart: file + optional courseId / workspaceId fields → document + inbox item
  app.post("/documents/upload", { config: LIMITS.upload }, async (req, reply) => {
    const part = await req.file({ limits: { fileSize: MAX_BYTES } })
    if (!part) return reply.badRequest("No file uploaded")
    if (!ALLOWED.has(part.mimetype)) return reply.badRequest("Unsupported file type")
    const fields = part.fields as Record<string, { value?: string } | undefined>
    const courseId = fields.courseId?.value || null
    const workspaceId = fields.workspaceId?.value || null

    const buffer = await part.toBuffer()
    if (part.file.truncated) return reply.badRequest("File is larger than 25 MB")
    const id = randomUUID()
    const ext = path.extname(part.filename).slice(0, 10)
    const storedName = `${id}${ext}`
    await writeFile(path.join(env.UPLOAD_DIR, storedName), buffer)

    const kind = typeOf(part.mimetype, part.filename)
    const { text: extractedText, pages } = await extractText(buffer, part.mimetype, part.filename)
    const courses = await db.select().from(schema.courses).where(eq(schema.courses.userId, req.user.sub))
    const understood = await interpret(`${part.filename}\n${extractedText.slice(0, 6000)}`, kind === "image" ? "screenshot" : "document", { courses })
    if (understood.source === "rules" && llmEnabled) req.log.warn({ reason: (understood as { fallbackReason?: string }).fallbackReason }, "upload interpretation fell back to rules")

    const summary = extractedText ? understood.ai.suggestion : kind === "image" ? "Screenshot uploaded. Text extraction for images isn't available yet — add a note describing it." : "No readable text could be extracted from this file."
    const [doc] = await db
      .insert(schema.documents)
      .values({
        id,
        userId: req.user.sub,
        title: part.filename,
        type: kind,
        courseId: courseId ?? understood.courseId,
        workspaceId,
        size: humanSize(buffer.length),
        pages,
        summary,
        tags: ["uploaded"],
        // Keep a bounded copy of the text so AI actions can read the document later
        content: extractedText ? extractedText.slice(0, 20_000) : null,
      })
      .returning()

    const [inbox] = await db
      .insert(schema.inboxItems)
      .values({
        id: randomUUID(),
        userId: req.user.sub,
        source: kind === "image" ? "screenshot" : "document",
        sender: "You (upload)",
        subject: part.filename,
        preview: extractedText ? extractedText.slice(0, 120).replace(/\s+/g, " ") : `Uploaded ${part.filename} (${humanSize(buffer.length)}).`,
        body: extractedText ? extractedText.slice(0, 4000) : `Uploaded ${part.filename} (${humanSize(buffer.length)}).`,
        courseId: courseId ?? understood.courseId,
        importance: understood.importance,
        ai: { ...understood.ai, source: understood.source, fields: [{ label: "File", value: part.filename }, ...understood.ai.fields] },
        resultDocumentId: doc.id,
      })
      .returning()

    return reply.code(201).send({ document: doc, inboxItem: inbox })
  })

  app.get("/files/:id", { schema: { params: z.object({ id: z.string() }) } }, async (req, reply) => {
    const [doc] = await db.select().from(schema.documents).where(and(eq(schema.documents.id, req.params.id), eq(schema.documents.userId, req.user.sub)))
    if (!doc) return reply.notFound()
    const ext = path.extname(doc.title).slice(0, 10)
    const filePath = path.join(env.UPLOAD_DIR, `${doc.id}${ext}`)
    try {
      await stat(filePath)
    } catch {
      return reply.notFound("File is not stored on this server")
    }
    reply.header("Content-Disposition", `inline; filename="${encodeURIComponent(doc.title)}"`)
    return reply.send(createReadStream(filePath))
  })

  app.delete("/files/:id", { schema: { params: z.object({ id: z.string() }) } }, async (req) => {
    const [doc] = await db.select().from(schema.documents).where(and(eq(schema.documents.id, req.params.id), eq(schema.documents.userId, req.user.sub)))
    if (doc) {
      await unlink(path.join(env.UPLOAD_DIR, `${doc.id}${path.extname(doc.title).slice(0, 10)}`)).catch(() => {})
      await db.delete(schema.documents).where(eq(schema.documents.id, doc.id))
    }
    return { ok: true }
  })

  app.post("/me/avatar", { config: LIMITS.avatar }, async (req, reply) => {
    const part = await req.file({ limits: { fileSize: 2 * 1024 * 1024 } })
    if (!part || !part.mimetype.startsWith("image/")) return reply.badRequest("Upload a PNG or JPG")
    const buffer = await part.toBuffer()
    if (part.file.truncated) return reply.badRequest("Image is larger than 2 MB")
    const name = `avatar-${req.user.sub}${path.extname(part.filename) || ".png"}`
    await writeFile(path.join(env.UPLOAD_DIR, name), buffer)
    const avatar = `/api/files/avatar/${req.user.sub}?v=${Date.now()}`
    await db.update(schema.users).set({ avatar }).where(eq(schema.users.id, req.user.sub))
    return { avatar }
  })
}

// Public-by-id avatar route (no secrets; avatars are shown to the owner only anyway)
export const avatarRoute: FastifyPluginAsyncZod = async (app) => {
  app.get("/files/avatar/:userId", { schema: { params: z.object({ userId: z.string() }) } }, async (req, reply) => {
    for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
      const p = path.join(env.UPLOAD_DIR, `avatar-${req.params.userId}${ext}`)
      try {
        await stat(p)
        return reply.send(createReadStream(p))
      } catch {
        /* try next */
      }
    }
    return reply.notFound()
  })
}
