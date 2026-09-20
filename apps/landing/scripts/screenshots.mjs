// Captures marketing screenshots of the running Welya web app using the locally installed Chrome.
// Usage: node scripts/screenshots.mjs  (needs API on :4000 and web on :1420)
import { chromium } from "playwright"
import { mkdir } from "node:fs/promises"
import path from "node:path"

const WEB = process.env.WEB_URL ?? "http://127.0.0.1:1420"
const API = process.env.API_URL ?? "http://localhost:4000"
const EMAIL = process.env.DEMO_EMAIL ?? "nadia.putri@student.univ.ac.id"
const PASSWORD = process.env.DEMO_PASSWORD ?? "welya123"
const OUT = path.resolve("public/screenshots")

const SHOTS = [
  { name: "dashboard", path: "/", wait: 2500 },
  { name: "inbox", path: "/inbox?item=i1", wait: 2500 },
  { name: "calendar", path: "/calendar", wait: 2500 },
  { name: "tasks", path: "/tasks?task=t1", wait: 2500 },
  { name: "course", path: "/courses/c1", wait: 2500 },
  { name: "assistant", path: "/assistant", wait: 2500 },
  { name: "documents", path: "/documents", wait: 2500 },
  { name: "review", path: "/review", wait: 8000 },
]

async function login() {
  const res = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })
  if (!res.ok) throw new Error(`Login failed: ${res.status}`)
  return (await res.json()).token
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const token = await login()
  const browser = await chromium.launch({ channel: "chrome", headless: true })

  for (const theme of ["dark", "light"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: theme })
    await ctx.addInitScript(({ token, theme }) => {
      localStorage.setItem("welya.token", token)
      localStorage.setItem("theme", theme)
    }, { token, theme })
    const page = await ctx.newPage()
    const list = theme === "dark" ? SHOTS : SHOTS.slice(0, 2)
    for (const s of list) {
      await page.goto(WEB + s.path, { waitUntil: "networkidle" })
      await page.waitForTimeout(s.wait)
      await page.screenshot({ path: path.join(OUT, `${s.name}-${theme}.png`), type: "png" })
      console.log(`✓ ${s.name}-${theme}.png`)
    }
    if (theme === "dark") {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(WEB + "/", { waitUntil: "networkidle" })
      await page.waitForTimeout(2500)
      await page.screenshot({ path: path.join(OUT, "mobile-dark.png"), type: "png" })
      console.log("✓ mobile-dark.png")
    }
    await ctx.close()
  }
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
