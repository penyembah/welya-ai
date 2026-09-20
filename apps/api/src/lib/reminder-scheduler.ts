import { randomUUID } from "node:crypto"
import { format, isSameDay } from "date-fns"
import { and, eq, gt, inArray, lte, ne } from "drizzle-orm"
import type { FastifyBaseLogger } from "fastify"
import { db, schema } from "../db/client.js"
import { env } from "../env.js"
import { loadUserData } from "./data.js"
import { mailer } from "./mail.js"
import { DEFAULT_SETTINGS } from "./provision.js"
import { buildPlan, formatDuration, isOverdue } from "./welya-ai.js"
import * as llm from "./welya-llm.js"

/**
 * Proactive reminder scheduler. Ticks every REMINDER_TICK_SECONDS and, per user, decides
 * which notifications are due based on their Settings → Notifications preferences.
 * Every notification carries a dedupe_key (unique per user) so restarts and overlapping
 * ticks never double-notify; the DB is the source of truth, not in-memory state.
 *
 * Jobs:
 *  - deadline reminders      N hours before a task is due (settings.notifications.deadlineLeadHours)
 *  - class reminders         30 minutes before a class/meeting (calendarReminders)
 *  - daily summary           at dailySummaryTime (dailySummary) — in-app + email
 *  - weekly review           WEEKLY_REVIEW_DAY at WEEKLY_REVIEW_TIME (weeklyReview) — in-app + email
 *  - free-time nudge         when a ≥1h gap starts within the next 15 minutes and open tasks exist (suggestPlans)
 */

type NotificationPrefs = typeof DEFAULT_SETTINGS.notifications
type AiPrefs = typeof DEFAULT_SETTINGS.ai

const CLASS_LEAD_MS = 30 * 60_000
const FREE_TIME_LOOKAHEAD_MS = 15 * 60_000

async function notify(userId: string, dedupeKey: string, n: { type: string; title: string; message: string; link?: string | null }) {
  const [row] = await db
    .insert(schema.notifications)
    .values({ id: randomUUID(), userId, dedupeKey, type: n.type, title: n.title, message: n.message, link: n.link ?? null })
    .onConflictDoNothing({ target: [schema.notifications.userId, schema.notifications.dedupeKey] })
    .returning({ id: schema.notifications.id })
  return Boolean(row) // false → already sent (idempotent)
}

const hhmmToToday = (hhmm: string, now: Date) => {
  const [h, m] = hhmm.split(":").map(Number)
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  return d
}
// "Is `target` in the window (now - tick, now]?" — ensures a scheduled time fires exactly once even if a tick is late
const justPassed = (target: Date, now: Date, tickMs: number) => target <= now && now.getTime() - target.getTime() < Math.max(tickMs * 2, 120_000)

export function startReminderScheduler(log: FastifyBaseLogger) {
  if (!env.REMINDER_SCHEDULER_ENABLED) {
    log.info("Reminder scheduler disabled (REMINDER_SCHEDULER_ENABLED=false)")
    return () => {}
  }
  const tickMs = env.REMINDER_TICK_SECONDS * 1000
  let running = false
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const schedule = () => {
    if (!stopped) timer = setTimeout(tick, tickMs)
  }

  async function tick() {
    if (stopped) return
    if (running) return schedule()
    running = true
    const now = new Date()
    try {
      const users = await db.select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, verified: schema.users.verified }).from(schema.users).where(eq(schema.users.verified, true))
      for (const user of users) {
        try {
          await runForUser(user, now)
        } catch (err) {
          log.error({ err, userId: user.id }, "reminder tick failed for user")
        }
      }
    } catch (err) {
      log.error({ err }, "reminder tick failed")
    } finally {
      running = false
      schedule()
    }
  }

  async function runForUser(user: { id: string; email: string; name: string }, now: Date) {
    const [settingsRow] = await db.select().from(schema.settings).where(eq(schema.settings.userId, user.id))
    const prefs = { ...DEFAULT_SETTINGS.notifications, ...((settingsRow?.notifications ?? {}) as Partial<NotificationPrefs>) }
    const ai = { ...DEFAULT_SETTINGS.ai, ...((settingsRow?.ai ?? {}) as Partial<AiPrefs>) }
    const send = (kind: string, p: Promise<boolean>) => p.then((ok) => ok && log.debug({ userId: user.id, kind }, "reminder email sent")).catch((err) => log.warn({ err, userId: user.id, kind }, "reminder email failed"))

    /* ---- deadline reminders: fire once when we enter the lead window ---- */
    if (prefs.deadlineReminders) {
      const leadMs = Number(prefs.deadlineLeadHours || 24) * 3_600_000
      const windowEnd = new Date(now.getTime() + leadMs).toISOString()
      const due = await db
        .select({ id: schema.tasks.id, title: schema.tasks.title, deadline: schema.tasks.deadline, progress: schema.tasks.progress, courseId: schema.tasks.courseId })
        .from(schema.tasks)
        .where(and(eq(schema.tasks.userId, user.id), ne(schema.tasks.status, "done"), gt(schema.tasks.deadline, now.toISOString()), lte(schema.tasks.deadline, windowEnd)))
      if (due.length) {
        const courses = await db.select({ id: schema.courses.id, name: schema.courses.name }).from(schema.courses).where(eq(schema.courses.userId, user.id))
        const courseName = (id: string | null) => courses.find((c) => c.id === id)?.name ?? null
        const leadLabel = leadMs >= 47 * 3_600_000 ? "in 2 days" : leadMs >= 23 * 3_600_000 ? "tomorrow" : `in ${Math.round(leadMs / 3_600_000)}h`
        for (const t of due) {
          const created = await notify(user.id, `deadline:${t.id}:${prefs.deadlineLeadHours}`, {
            type: "deadline",
            title: `${t.title} is due ${leadLabel}`,
            message: `${courseName(t.courseId) ? `${courseName(t.courseId)} · ` : ""}${format(new Date(t.deadline), "EEE d MMM HH:mm")} · ${t.progress}% done`,
            link: `/tasks?task=${t.id}`,
          })
          if (created) void send("deadline", mailer.deadlineReminder(user.email, user.name, { ...t, course: courseName(t.courseId) }, leadLabel))
        }
      }
    }

    /* ---- class / meeting reminders 30 min before ---- */
    if (prefs.calendarReminders) {
      const soon = await db
        .select({ id: schema.events.id, title: schema.events.title, type: schema.events.type, start: schema.events.start, location: schema.events.location, courseId: schema.events.courseId })
        .from(schema.events)
        .where(and(eq(schema.events.userId, user.id), inArray(schema.events.type, ["class", "meeting"]), gt(schema.events.start, now.toISOString()), lte(schema.events.start, new Date(now.getTime() + CLASS_LEAD_MS).toISOString())))
      for (const e of soon) {
        await notify(user.id, `event:${e.id}`, {
          type: e.type === "class" ? "class" : "calendar",
          title: `${e.title} starts in ${Math.max(1, Math.round((new Date(e.start).getTime() - now.getTime()) / 60_000))} minutes`,
          message: `${format(new Date(e.start), "HH:mm")}${e.location ? ` · ${e.location}` : ""}`,
          link: e.courseId ? `/courses/${e.courseId}` : "/calendar?view=day",
        })
      }
    }

    /* ---- daily summary at the user's chosen time ---- */
    if (prefs.dailySummary && justPassed(hhmmToToday(prefs.dailySummaryTime || "07:00", now), now, tickMs)) {
      const dayKey = format(now, "yyyy-MM-dd")
      const data = await loadUserData(user.id)
      const open = data.tasks.filter((t) => t.status !== "done")
      const classes = data.events.filter((e) => e.type === "class" && isSameDay(new Date(e.start), now)).sort((a, b) => a.start.localeCompare(b.start))
      const dueToday = open.filter((t) => isSameDay(new Date(t.deadline), now)).sort((a, b) => a.deadline.localeCompare(b.deadline))
      const overdue = open.filter(isOverdue).length
      const plan = buildPlan(now, data)
      const topTask = [...open].sort((a, b) => a.deadline.localeCompare(b.deadline))[0] ?? null
      const created = await notify(user.id, `daily:${dayKey}`, {
        type: "ai",
        title: `Today: ${classes.length} class${classes.length === 1 ? "" : "es"}, ${dueToday.length} due${overdue ? `, ${overdue} overdue` : ""}`,
        message: plan.totalFree >= 60 ? `About ${formatDuration(Math.round(plan.totalFree))} free between 08:00–18:00${topTask ? ` — a good slot for “${topTask.title}”.` : "."}` : "Your day is fully booked between 08:00–18:00.",
        link: "/",
      })
      if (created) void send("daily", mailer.dailySummary(user.email, user.name, { date: format(now, "EEEE, d MMMM"), classes, dueToday, overdue, freeMinutes: plan.totalFree, topTask }))
    }

    /* ---- weekly review (Sunday evening by default) ---- */
    if (prefs.weeklyReview && now.getDay() === env.WEEKLY_REVIEW_DAY && justPassed(hhmmToToday(env.WEEKLY_REVIEW_TIME, now), now, tickMs)) {
      const weekKey = format(now, "RRRR-'W'II")
      const data = await loadUserData(user.id)
      const review = await llm.weeklyReview(data)
      const created = await notify(user.id, `weekly:${weekKey}`, {
        type: "ai",
        title: "Your weekly review is ready",
        message: `${review.stats.completed} completed · ${review.stats.dueThisWeek} due this week${review.stats.overdue ? ` · ${review.stats.overdue} overdue` : ""}`,
        link: "/review",
      })
      if (created) void send("weekly", mailer.weeklyReview(user.email, user.name, review))
    }

    /* ---- free-time nudge: a ≥1h gap is about to start and there is work to do ---- */
    if (ai.suggestPlans && now.getHours() >= 7 && now.getHours() < 18) {
      const data = await loadUserData(user.id)
      const open = data.tasks.filter((t) => t.status !== "done")
      if (open.length) {
        const plan = buildPlan(now, data)
        const upcoming = plan.slots.map((s) => ({ start: new Date(s.start), end: new Date(s.end) })).find((s) => s.start > now && s.start.getTime() - now.getTime() <= FREE_TIME_LOOKAHEAD_MS)
        if (upcoming) {
          const top = [...open].sort((a, b) => a.deadline.localeCompare(b.deadline))[0]
          await notify(user.id, `free:${format(upcoming.start, "yyyy-MM-dd'T'HH:mm")}`, {
            type: "ai",
            title: `Free time from ${format(upcoming.start, "HH:mm")}`,
            message: `${formatDuration(Math.round((upcoming.end.getTime() - upcoming.start.getTime()) / 60_000))} until ${format(upcoming.end, "HH:mm")}. Welya suggests working on “${top.title}”.`,
            link: "/calendar?view=day",
          })
        }
      }
    }
  }

  schedule()
  log.info({ tickSeconds: env.REMINDER_TICK_SECONDS, weeklyReview: `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][env.WEEKLY_REVIEW_DAY]} ${env.WEEKLY_REVIEW_TIME}` }, "Reminder scheduler started")

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    log.info("Reminder scheduler stopped")
  }
}

// Exposed for tests/manual triggering: run one full pass now (ignores tick timing for summaries/reviews when `force` is set).
export async function runRemindersOnce(log: FastifyBaseLogger, opts: { userId?: string; force?: "daily" | "weekly" } = {}) {
  const now = new Date()
  const users = await db.select({ id: schema.users.id, email: schema.users.email, name: schema.users.name }).from(schema.users).where(and(eq(schema.users.verified, true), ...(opts.userId ? [eq(schema.users.id, opts.userId)] : [])))
  let sent = 0
  for (const user of users) {
    const data = await loadUserData(user.id)
    if (opts.force === "daily") {
      const open = data.tasks.filter((t) => t.status !== "done")
      const classes = data.events.filter((e) => e.type === "class" && isSameDay(new Date(e.start), now))
      const dueToday = open.filter((t) => isSameDay(new Date(t.deadline), now))
      const plan = buildPlan(now, data)
      const created = await notify(user.id, `daily:${format(now, "yyyy-MM-dd")}:manual:${Date.now()}`, { type: "ai", title: `Today: ${classes.length} classes, ${dueToday.length} due`, message: `About ${formatDuration(Math.round(plan.totalFree))} free.`, link: "/" })
      if (created) {
        await mailer.dailySummary(user.email, user.name, { date: format(now, "EEEE, d MMMM"), classes, dueToday, overdue: open.filter(isOverdue).length, freeMinutes: plan.totalFree, topTask: open[0] ?? null }).catch((err) => log.warn({ err }, "manual daily email failed"))
        sent++
      }
    }
    if (opts.force === "weekly") {
      const review = await llm.weeklyReview(data)
      const created = await notify(user.id, `weekly:manual:${Date.now()}`, { type: "ai", title: "Your weekly review is ready", message: `${review.stats.completed} completed · ${review.stats.dueThisWeek} due this week`, link: "/review" })
      if (created) {
        await mailer.weeklyReview(user.email, user.name, review).catch((err) => log.warn({ err }, "manual weekly email failed"))
        sent++
      }
    }
  }
  return { users: users.length, sent }
}
