import type { FastifyRequest } from "fastify"
import type { RateLimitOptions } from "@fastify/rate-limit"

// Route-level presets for `config: { rateLimit }`. Public routes are keyed by IP; authenticated
// routes are keyed by user id (checked in preHandler, after `authenticate` has verified the JWT).
export const perIp = (max: number, timeWindow: string): { rateLimit: RateLimitOptions } => ({ rateLimit: { max, timeWindow } })

export const perUser = (max: number, timeWindow: string): { rateLimit: RateLimitOptions } => ({
  rateLimit: {
    max,
    timeWindow,
    hook: "preHandler",
    keyGenerator: (req: FastifyRequest) => (req.user as { sub?: string } | undefined)?.sub ?? req.ip,
  },
})

export const LIMITS = {
  // auth (per IP)
  register: perIp(5, "15 minutes"),
  login: perIp(10, "1 minute"),
  verify: perIp(10, "15 minutes"),
  resend: perIp(3, "15 minutes"),
  forgot: perIp(3, "15 minutes"),
  reset: perIp(10, "15 minutes"),
  oauth: perIp(20, "1 minute"),
  // account (per user)
  deleteAccount: perUser(5, "15 minutes"),
  export: perUser(5, "15 minutes"),
  changePassword: perUser(5, "15 minutes"),
  changeEmail: perUser(3, "15 minutes"),
  sessions: perUser(30, "1 minute"),
  // AI (per user) — these cost Azure tokens
  aiChat: perUser(20, "1 minute"),
  aiAction: perUser(30, "1 minute"),
  aiRead: perUser(60, "1 minute"),
  // files & integrations (per user)
  upload: perUser(20, "1 minute"),
  avatar: perUser(10, "1 minute"),
  inboxCreate: perUser(30, "1 minute"),
  sync: perUser(6, "1 minute"),
  connect: perUser(10, "1 minute"),
}
