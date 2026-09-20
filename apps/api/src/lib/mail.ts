import nodemailer from "nodemailer"
import { env, mailEnabled } from "../env.js"

// Hex approximations of the app's dark "mist" palette (email clients don't support oklch)
const C = {
  bg: "#151b1d",
  card: "#1e272b",
  border: "#2b3539",
  text: "#f4f7f7",
  muted: "#a2adb2",
  primary: "#e3e8ea",
  primaryText: "#1e272b",
  accentSoft: "#26343a",
  danger: "#f4a3a3",
}

const FONT = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const transporter = mailEnabled
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)

function logoMark() {
  // Layered "W" mark rendered with tables so it survives image blocking
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr>
      <td style="width:44px;height:44px;border-radius:12px;background:${C.primary};text-align:center;vertical-align:middle;font-family:${FONT};font-weight:700;font-size:22px;line-height:44px;color:${C.primaryText};letter-spacing:-0.5px;">W</td>
      <td style="padding-left:12px;font-family:${FONT};font-size:20px;font-weight:600;color:${C.text};letter-spacing:-0.3px;">Welya</td>
    </tr>
  </table>`
}

function button(label: string, href: string) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr>
      <td style="border-radius:10px;background:${C.primary};">
        <a href="${href}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:${C.primaryText};text-decoration:none;border-radius:10px;">${escape(label)}</a>
      </td>
    </tr>
  </table>`
}

function codeBlock(code: string) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr>
      <td style="border-radius:12px;background:${C.accentSoft};border:1px solid ${C.border};padding:18px 30px;font-family:'Geist Mono','SFMono-Regular',Menlo,Consolas,monospace;font-size:34px;font-weight:600;letter-spacing:10px;color:${C.text};text-align:center;">${escape(code)}</td>
    </tr>
  </table>`
}

function layout({ preheader, title, intro, body, footnote }: { preheader: string; title: string; intro: string; body: string; footnote: string }) {
  const year = new Date().getFullYear()
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escape(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <tr><td style="padding-bottom:28px;">${logoMark()}</td></tr>
          <tr>
            <td style="background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:36px 32px;">
              <h1 style="margin:0 0 12px;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:600;color:${C.text};letter-spacing:-0.3px;text-align:center;">${escape(title)}</h1>
              <p style="margin:0 0 26px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.muted};text-align:center;">${intro}</p>
              ${body}
              <p style="margin:26px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted};text-align:center;">${footnote}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};text-align:center;">
              Welya AI · The AI secretary for university students<br>
              You're receiving this because an action was requested for your Welya account. If it wasn't you, you can safely ignore this email.<br>
              <span style="color:#6b767b;">© ${year} Welya</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

type Mail = { to: string; subject: string; html: string; text: string }

async function deliver(mail: Mail) {
  if (!transporter) return false
  await transporter.sendMail({ from: env.SMTP_FROM, ...mail })
  return true
}

const firstName = (name: string) => escape(name.trim().split(/\s+/)[0] || "there")

export const mailer = {
  enabled: mailEnabled,

  verifyEmail(to: string, name: string, code: string) {
    return deliver({
      to,
      subject: `${code} is your Welya verification code`,
      text: `Hi ${name},\n\nYour Welya verification code is ${code}. It expires in 15 minutes.\n\nIf you didn't create a Welya account, ignore this email.`,
      html: layout({
        preheader: `Your verification code is ${code}`,
        title: "Verify your email",
        intro: `Hi ${firstName(name)}, welcome to Welya. Enter this code in the app to finish setting up your account.`,
        body: codeBlock(code),
        footnote: "This code expires in <strong style=\"color:" + C.text + "\">15 minutes</strong>. Never share it with anyone — Welya will never ask you for it.",
      }),
    })
  },

  resetPassword(to: string, name: string, token: string) {
    const link = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`
    return deliver({
      to,
      subject: "Reset your Welya password",
      text: `Hi ${name},\n\nWe received a request to reset your Welya password. Open this link to choose a new one (valid for 30 minutes):\n${link}\n\nIf you didn't request this, you can ignore this email — your password won't change.`,
      html: layout({
        preheader: "Choose a new password for your Welya account",
        title: "Reset your password",
        intro: `Hi ${firstName(name)}, we received a request to reset the password for this account. Click below to choose a new one.`,
        body: `${button("Choose a new password", link)}
          <p style="margin:22px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};text-align:center;word-break:break-all;">Or paste this link into your browser:<br><a href="${link}" style="color:${C.primary};text-decoration:underline;">${link}</a></p>`,
        footnote: "The link is valid for <strong style=\"color:" + C.text + "\">30 minutes</strong> and can only be used once. If you didn't request a reset, your password will stay the same.",
      }),
    })
  },

  passwordChanged(to: string, name: string) {
    return deliver({
      to,
      subject: "Your Welya password was changed",
      text: `Hi ${name},\n\nThe password for your Welya account was just changed. If this was you, no action is needed. If not, reset your password immediately at ${env.APP_URL}/forgot-password.`,
      html: layout({
        preheader: "Your password was just changed",
        title: "Password changed",
        intro: `Hi ${firstName(name)}, the password for your Welya account was just updated. If this was you, you're all set.`,
        body: button("Open Welya", `${env.APP_URL}/login`),
        footnote: `Didn't do this? <a href="${env.APP_URL}/forgot-password" style="color:${C.primary};text-decoration:underline;">Reset your password</a> right away and contact us.`,
      }),
    })
  },

  // Sent to the NEW address with the confirmation code
  emailChangeCode(to: string, name: string, code: string) {
    return deliver({
      to,
      subject: `${code} — confirm your new Welya email`,
      text: `Hi ${name},\n\nEnter this code in Welya to confirm ${to} as your new sign-in email: ${code}. It expires in 15 minutes.\n\nIf you didn't request this, ignore this email.`,
      html: layout({
        preheader: `Your confirmation code is ${code}`,
        title: "Confirm your new email",
        intro: `Hi ${firstName(name)}, enter this code in Settings → Account to make <strong style="color:${C.text}">${escape(to)}</strong> your sign-in email.`,
        body: codeBlock(code),
        footnote: "This code expires in <strong style=\"color:" + C.text + "\">15 minutes</strong>. If you didn't request an email change, you can ignore this.",
      }),
    })
  },

  // Sent to the OLD address so a hijack attempt is visible
  emailChanged(to: string, name: string, newEmail: string) {
    return deliver({
      to,
      subject: "Your Welya sign-in email was changed",
      text: `Hi ${name},\n\nThe sign-in email for your Welya account was changed to ${newEmail}. If this wasn't you, contact us immediately.`,
      html: layout({
        preheader: `Sign-in email changed to ${newEmail}`,
        title: "Sign-in email changed",
        intro: `Hi ${firstName(name)}, your Welya account now signs in with <strong style="color:${C.text}">${escape(newEmail)}</strong>. All other devices were signed out.`,
        body: button("Open Welya", `${env.APP_URL}/login`),
        footnote: "Didn't do this? Reply to this email right away so we can secure your account.",
      }),
    })
  },

  welcome(to: string, name: string) {
    const steps = [
      ["Forward a lecturer email or paste a class-group message", "Welya reads it and tells you what it is: assignment, schedule change, exam."],
      ["Confirm with one click", "It becomes a task, event, reminder or note — linked to the right course."],
      ["Press “Plan my week”", "Welya finds the gaps between your classes and schedules focused sessions."],
    ]
    const list = steps
      .map(
        ([t, d], i) => `
        <tr>
          <td style="padding:0 0 14px;vertical-align:top;width:34px;">
            <div style="width:26px;height:26px;border-radius:8px;background:${C.accentSoft};border:1px solid ${C.border};text-align:center;line-height:26px;font-family:${FONT};font-size:12px;font-weight:600;color:${C.text};">${i + 1}</div>
          </td>
          <td style="padding:0 0 14px 10px;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.text};">
            <strong>${escape(t)}</strong><br><span style="color:${C.muted};">${escape(d)}</span>
          </td>
        </tr>`,
      )
      .join("")
    return deliver({
      to,
      subject: "Welcome to Welya — your AI secretary is ready",
      text: `Hi ${name},\n\nYour Welya account is verified. Start by forwarding a lecturer email or pasting a class-group message into the Inbox, confirm what Welya found, then press "Plan my week".\n\nOpen Welya: ${env.APP_URL}`,
      html: layout({
        preheader: "Your account is verified — here's how to start",
        title: "You're in",
        intro: `Hi ${firstName(name)}, your email is verified and Welya is ready to take the secretarial work off your plate. Three ways to start:`,
        body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">${list}</table>${button("Open Welya", env.APP_URL)}`,
        footnote: "Welya is completely free for students. Reply to this email any time — a human reads it.",
      }),
    })
  },

  /* ---------- proactive briefings sent by the reminder scheduler ---------- */

  deadlineReminder(to: string, name: string, task: { id: string; title: string; deadline: string; progress: number; course?: string | null }, leadLabel: string) {
    const when = fmtDate(task.deadline)
    return deliver({
      to,
      subject: `Due ${leadLabel}: ${task.title}`,
      text: `Hi ${name},\n\n"${task.title}"${task.course ? ` (${task.course})` : ""} is due ${when}. You're ${task.progress}% done.\n\nOpen it: ${env.APP_URL}/tasks?task=${task.id}`,
      html: layout({
        preheader: `${task.title} is due ${when}`,
        title: `Due ${leadLabel}`,
        intro: `Hi ${firstName(name)}, a quick heads-up from your secretary.`,
        body: `${infoCard([[task.title, task.course ?? "No course"], ["Deadline", when], ["Progress", `${task.progress}% done`]])}${button("Open task", `${env.APP_URL}/tasks?task=${encodeURIComponent(task.id)}`)}`,
        footnote: "You can change how early Welya reminds you in Settings → Notifications.",
      }),
    })
  },

  dailySummary(to: string, name: string, s: { date: string; classes: Array<{ title: string; start: string; location?: string | null }>; dueToday: Array<{ title: string; deadline: string }>; overdue: number; freeMinutes: number; topTask?: { title: string; deadline: string } | null }) {
    const classLines = s.classes.length ? s.classes.map((c) => `${fmtTime(c.start)} ${c.title}${c.location ? ` · ${c.location}` : ""}`) : ["No classes today"]
    const dueLines = s.dueToday.length ? s.dueToday.map((t) => `${t.title} · ${fmtTime(t.deadline)}`) : ["Nothing due today"]
    const text = `Good morning ${name},\n\nClasses:\n${classLines.map((l) => `- ${l}`).join("\n")}\n\nDue today:\n${dueLines.map((l) => `- ${l}`).join("\n")}${s.overdue ? `\n\n${s.overdue} overdue task${s.overdue > 1 ? "s" : ""} need attention.` : ""}${s.freeMinutes >= 60 ? `\n\nYou have about ${Math.round(s.freeMinutes / 60)}h free between 08:00–18:00${s.topTask ? ` — a good slot for "${s.topTask.title}".` : "."}` : ""}\n\n${env.APP_URL}`
    return deliver({
      to,
      subject: `Your ${s.date} at a glance`,
      text,
      html: layout({
        preheader: `${s.classes.length} class${s.classes.length === 1 ? "" : "es"} · ${s.dueToday.length} due today${s.overdue ? ` · ${s.overdue} overdue` : ""}`,
        title: `Good morning, ${firstName(name)}`,
        intro: `Here's ${s.date} — what's on, what's due, and where the free time is.`,
        body: `${section("Classes", classLines)}${section("Due today", dueLines)}${s.overdue ? section("Needs attention", [`${s.overdue} overdue task${s.overdue > 1 ? "s" : ""}`], C.danger) : ""}${s.freeMinutes >= 60 ? section("Free time", [`About ${Math.round(s.freeMinutes / 60)}h between 08:00–18:00${s.topTask ? ` — try “${escape(s.topTask.title)}”` : ""}`]) : ""}${button("Plan my day", `${env.APP_URL}/calendar?view=day`)}`,
        footnote: "Daily summaries can be turned off or rescheduled in Settings → Notifications.",
      }),
    })
  },

  weeklyReview(to: string, name: string, r: { paragraphs: string[]; stats: { completed: number; remaining: number; overdue: number; dueThisWeek: number } }) {
    const stats: Array<[string, string]> = [["Completed", String(r.stats.completed)], ["Remaining", String(r.stats.remaining)], ["Overdue", String(r.stats.overdue)], ["Due this week", String(r.stats.dueThisWeek)]]
    return deliver({
      to,
      subject: "Your weekly review is ready",
      text: `Hi ${name},\n\n${r.paragraphs.map(stripMarkdown).join("\n\n")}\n\nSee the full review: ${env.APP_URL}/review`,
      html: layout({
        preheader: `${r.stats.completed} completed · ${r.stats.dueThisWeek} due this week`,
        title: "Your week in review",
        intro: `Hi ${firstName(name)}, here's how last week went and what's coming.`,
        body: `${statGrid(stats)}${r.paragraphs.map((p) => `<p style="margin:0 0 12px;font-family:${FONT};font-size:14px;line-height:1.65;color:${C.text};">${inlineMarkdown(p)}</p>`).join("")}${button("Open the full review", `${env.APP_URL}/review`)}`,
        footnote: "Weekly reviews arrive every Sunday evening. Turn them off in Settings → Notifications.",
      }),
    })
  },
}

/* ---------- small building blocks for the briefing emails ---------- */

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const stripMarkdown = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`(.+?)`/g, "$1")
const inlineMarkdown = (s: string) => escape(s).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.text}">$1</strong>`)

function section(title: string, lines: string[], color = C.text) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
    <tr><td style="padding:0 0 6px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${C.muted};">${escape(title)}</td></tr>
    ${lines.map((l) => `<tr><td style="padding:6px 0;border-top:1px solid ${C.border};font-family:${FONT};font-size:14px;line-height:1.5;color:${color};">${l}</td></tr>`).join("")}
  </table>`
}

function infoCard(rows: Array<[string, string]>) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;border:1px solid ${C.border};border-radius:12px;background:${C.accentSoft};">
    ${rows.map(([k, v], i) => `<tr><td style="padding:${i === 0 ? "14px" : "8px"} 16px ${i === rows.length - 1 ? "14px" : "0"};font-family:${FONT};font-size:${i === 0 ? "16px" : "13px"};font-weight:${i === 0 ? 600 : 400};color:${i === 0 ? C.text : C.muted};">${escape(k)}${i === 0 ? "" : `: <span style="color:${C.text}">${escape(v)}</span>`}</td></tr>${i === 0 ? `<tr><td style="padding:2px 16px 0;font-family:${FONT};font-size:13px;color:${C.muted};">${escape(v)}</td></tr>` : ""}`).join("")}
  </table>`
}

function statGrid(stats: Array<[string, string]>) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
    <tr>${stats.map(([k, v]) => `<td style="width:25%;padding:12px 6px;border:1px solid ${C.border};border-radius:10px;background:${C.accentSoft};text-align:center;"><div style="font-family:${FONT};font-size:22px;font-weight:600;color:${C.text};">${escape(v)}</div><div style="font-family:${FONT};font-size:11px;color:${C.muted};">${escape(k)}</div></td>`).join("")}</tr>
  </table>`
}

export type Mailer = typeof mailer
