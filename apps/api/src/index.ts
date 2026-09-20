import Fastify from "fastify"
import cors from "@fastify/cors"
import cookie from "@fastify/cookie"
import sensible from "@fastify/sensible"
import multipart from "@fastify/multipart"
import rateLimit from "@fastify/rate-limit"
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod"
import { env, corsOrigins } from "./env.js"
import authPlugin from "./plugins/auth.js"
import { authRoutes } from "./routes/auth.js"
import { resourceRoutes } from "./routes/resources.js"
import { aiRoutes } from "./routes/ai.js"
import { fileRoutes, avatarRoute } from "./routes/files.js"
import { googleRoutes } from "./routes/google.js"
import { sql } from "./db/client.js"
import { normalize } from "./lib/serialize.js"
import { startGoogleSyncScheduler } from "./lib/google-scheduler.js"
import { startReminderScheduler } from "./lib/reminder-scheduler.js"

const app = Fastify({
  // Honour X-Forwarded-For only behind a reverse proxy, otherwise clients could spoof their IP for rate limiting
  trustProxy: env.TRUST_PROXY,
  logger: { level: env.NODE_ENV === "production" ? "info" : "debug", transport: env.NODE_ENV === "production" ? undefined : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" } } },
}).withTypeProvider<ZodTypeProvider>()

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

await app.register(cors, { origin: corsOrigins, credentials: true, methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization", "Accept"] })
await app.register(cookie)
// Baseline per-IP ceiling for every route; sensitive routes tighten this via `config.rateLimit` (see lib/rate-limits.ts)
await app.register(rateLimit, {
  global: true,
  max: env.RATE_LIMIT_MAX,
  timeWindow: "1 minute",
  allowList: (req) => req.method === "OPTIONS",
  errorResponseBuilder: (_req, ctx) => ({ statusCode: 429, code: "rate_limited", message: `Too many requests. Try again in ${ctx.after}.` }),
})
await app.register(sensible)
await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 1 } })
await app.register(authPlugin)

app.addHook("preSerialization", async (_req, _reply, payload) => normalize(payload))

app.get("/health", { config: { rateLimit: false } }, async () => {
  await sql`select 1`
  return { ok: true, service: "welya-api", time: new Date().toISOString() }
})

await app.register(authRoutes, { prefix: "/api" })
await app.register(resourceRoutes, { prefix: "/api" })
await app.register(aiRoutes, { prefix: "/api" })
await app.register(fileRoutes, { prefix: "/api" })
await app.register(avatarRoute, { prefix: "/api" })
// OAuth callbacks live at the exact paths registered with Google (see GOOGLE_*_REDIRECT_URI), so no prefix here
await app.register(googleRoutes)

app.setErrorHandler((error, _req, reply) => {
  const err = error as Error & { statusCode?: number; validation?: unknown; issues?: unknown; code?: string }
  // Zod / fastify validation errors → 400 with a readable message
  if (err.validation || err.name === "ZodError") {
    return reply.code(400).send({ message: "Invalid request", issues: err.validation ?? err.issues })
  }
  const status = err.statusCode ?? 500
  if (status >= 500) app.log.error(err)
  return reply.code(status).send({ message: status >= 500 ? "Internal server error" : err.message, ...(err.code ? { code: err.code } : {}) })
})

let stopGoogleSyncScheduler = () => {}
let stopReminderScheduler = () => {}
const close = async () => {
  stopGoogleSyncScheduler()
  stopReminderScheduler()
  await app.close()
  await sql.end()
  process.exit(0)
}
process.on("SIGINT", close)
process.on("SIGTERM", close)

await app.listen({ port: env.PORT, host: "0.0.0.0" })
stopGoogleSyncScheduler = startGoogleSyncScheduler(app.log)
stopReminderScheduler = startReminderScheduler(app.log)
