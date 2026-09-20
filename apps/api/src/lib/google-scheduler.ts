import { randomUUID } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import type { FastifyBaseLogger } from "fastify"
import { db, schema } from "../db/client.js"
import { env, googleEnabled } from "../env.js"
import { GOOGLE_INTEGRATIONS, GoogleError } from "./google.js"
import { SYNCERS } from "./google-sync.js"

const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000

type Failure = { count: number; nextAttemptAt: number }

export function startGoogleSyncScheduler(log: FastifyBaseLogger) {
  if (!googleEnabled) {
    log.info("Google sync scheduler disabled: Google OAuth is not configured")
    return () => {}
  }

  const intervalMs = env.GOOGLE_SYNC_INTERVAL_MINUTES * 60_000
  const failures = new Map<string, Failure>()
  let running = false
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const schedule = (delay: number) => {
    if (!stopped) timer = setTimeout(run, delay)
  }

  const markReauthenticationRequired = async (userId: string, integration: string, error: GoogleError) => {
    await db
      .update(schema.integrations)
      .set({ status: "error" })
      .where(and(eq(schema.integrations.userId, userId), eq(schema.integrations.id, integration)))
    await db.insert(schema.notifications).values({
      id: randomUUID(),
      userId,
      type: "integration",
      title: `${integration} needs to be reconnected`,
      message: error.message,
      link: "/settings/integrations",
    })
  }

  const syncOne = async (userId: string, integration: string) => {
    const key = `${userId}:${integration}`
    const failure = failures.get(key)
    if (failure && failure.nextAttemptAt > Date.now()) return

    const sync = SYNCERS[integration]
    if (!sync) return

    try {
      const result = await sync(userId)
      await db
        .update(schema.integrations)
        .set({ lastSync: new Date().toISOString(), status: "connected" })
        .where(and(eq(schema.integrations.userId, userId), eq(schema.integrations.id, integration)))
      failures.delete(key)
      log.info({ userId, integration, ...result }, "scheduled Google sync completed")
    } catch (error) {
      if (error instanceof GoogleError && (error.code === "reauth_required" || error.code === "not_connected" || error.code === "insufficient_scope")) {
        failures.delete(key)
        await markReauthenticationRequired(userId, integration, error)
        log.warn({ userId, integration, code: error.code }, "scheduled Google sync needs reauthentication")
        return
      }

      const count = (failure?.count ?? 0) + 1
      const delay = Math.min(intervalMs * 2 ** Math.min(count - 1, 8), MAX_BACKOFF_MS)
      failures.set(key, { count, nextAttemptAt: Date.now() + delay })
      log.error({ err: error, userId, integration, retryInMs: delay }, "scheduled Google sync failed")
    }
  }

  async function run() {
    if (stopped) return
    if (running) {
      schedule(intervalMs)
      return
    }
    running = true
    try {
      const connected = await db
        .select({ userId: schema.integrations.userId, integration: schema.integrations.id })
        .from(schema.integrations)
        .where(and(eq(schema.integrations.status, "connected"), inArray(schema.integrations.id, GOOGLE_INTEGRATIONS)))
      await Promise.all(connected.map(({ userId, integration }) => syncOne(userId, integration)))
    } catch (error) {
      log.error({ err: error }, "scheduled Google sync discovery failed")
    } finally {
      running = false
      schedule(intervalMs)
    }
  }

  schedule(env.GOOGLE_SYNC_INITIAL_DELAY_SECONDS * 1000)
  log.info({ intervalMinutes: env.GOOGLE_SYNC_INTERVAL_MINUTES }, "Google sync scheduler started")

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    failures.clear()
    log.info("Google sync scheduler stopped")
  }
}
