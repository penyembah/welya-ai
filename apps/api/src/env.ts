import { z } from "zod"

const schema = z.object({
  DATABASE_URL: z.string().default("postgres://welya:welya@localhost:5433/welya"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:1420"),
  DEV_EXPOSE_CODES: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  NODE_ENV: z.string().default("development"),
  // Set true when running behind nginx/Caddy/etc. so rate limiting sees the real client IP
  TRUST_PROXY: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  // Global per-IP ceiling (requests per minute); sensitive routes have their own tighter limits
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  UPLOAD_DIR: z.string().default("./uploads"),
  // Azure AI Foundry / Azure OpenAI — optional; without it Welya falls back to the rule engine
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().default("gpt-5-mini"),
  AI_TIMEOUT_MS: z.coerce.number().default(45_000),
  // Transactional email (Brevo SMTP relay) — optional; without it codes are only exposed in dev
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("Welya <no-reply@welya.app>"),
  // Public URL of the web app, used for links inside emails
  APP_URL: z.string().url().default("http://localhost:1420"),
  // Google OAuth — sign-in + Gmail / Calendar / Drive integrations. Optional.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().default("http://localhost:4000/auth/google/callback"),
  GOOGLE_INTEGRATION_REDIRECT_URI: z.string().url().default("http://localhost:4000/integrations/google/callback"),
  GOOGLE_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(15),
  GOOGLE_SYNC_INITIAL_DELAY_SECONDS: z.coerce.number().int().nonnegative().default(30),
  // Proactive reminders (deadlines, class reminders, daily summary, weekly review, free-time nudges)
  REMINDER_SCHEDULER_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v !== "false"),
  REMINDER_TICK_SECONDS: z.coerce.number().int().min(15).default(60),
  WEEKLY_REVIEW_DAY: z.coerce.number().int().min(0).max(6).default(0), // 0 = Sunday
  WEEKLY_REVIEW_TIME: z.string().regex(/^\d{2}:\d{2}$/).default("19:00"),
})

export const env = schema.parse(process.env)
export const corsOrigins = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
export const llmEnabled = Boolean(env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_API_KEY)
export const mailEnabled = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
