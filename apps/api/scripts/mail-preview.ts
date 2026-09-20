// Sends one of every email template to an address so the design can be checked in a real inbox.
// Usage: npm run mail:preview -w @welya/api -- you@example.com
import { mailer } from "../src/lib/mail.js"

const to = process.argv[2]
if (!to) {
  console.error("Usage: npm run mail:preview -- you@example.com")
  process.exit(1)
}
if (!mailer.enabled) {
  console.error("SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing in apps/api/.env)")
  process.exit(1)
}

const name = "Nadia Putri"
await mailer.verifyEmail(to, name, "482913")
await mailer.resetPassword(to, name, "previewtoken0123456789abcdef0123456789")
await mailer.welcome(to, name)
await mailer.passwordChanged(to, name)
console.log(`Sent 4 preview emails to ${to}`)
