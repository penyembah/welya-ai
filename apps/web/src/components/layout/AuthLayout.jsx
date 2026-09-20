import * as React from "react"
import { Link, Navigate, Outlet, useLocation } from "react-router-dom"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { WelyaLogo } from "@/components/welya/WelyaLogo"
import { useAuth } from "@/store/auth"
import { EyeIcon, EyeOffIcon, MoonIcon, SunIcon } from "lucide-react"

const HIGHLIGHTS = [
  { title: "Capture everything", body: "Emails, chat messages, PDFs and screenshots land in one inbox." },
  { title: "Welya understands it", body: "Deadlines, schedule changes and announcements become tasks and events." },
  { title: "Plan around your classes", body: "Free time between lectures is turned into focused work sessions." },
]

export function AuthLayout() {
  const { isAuthenticated } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const location = useLocation()
  // OAuth callback must run even when a session exists (e.g. switching Google accounts)
  if (isAuthenticated && !location.pathname.startsWith("/verify-email") && !location.pathname.startsWith("/auth/callback")) return <Navigate to="/" replace />

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="pointer-events-none absolute -top-40 -left-40 size-[520px] rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 -bottom-40 size-[520px] rounded-full bg-primary/5 blur-3xl" />
        <Link to="/login" className="relative flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <WelyaLogo className="size-5" />
          </span>
          <span className="font-heading text-lg font-semibold">Welya AI</span>
        </Link>
        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <h2 className="font-heading text-3xl font-semibold tracking-tight">Your academic life, understood and organized.</h2>
            <p className="text-muted-foreground">Welya is an AI secretary built for university students — it reads what your lecturers send, and turns it into a plan.</p>
          </div>
          <ol className="space-y-4">
            {HIGHLIGHTS.map((h, i) => (
              <li key={h.title} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium">{h.title}</p>
                  <p className="text-sm text-muted-foreground">{h.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <blockquote className="rounded-xl border bg-card p-4 text-sm">
            <p>“Laporan praktikum dikumpulkan Jumat pukul 23.59.”</p>
            <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
              <WelyaLogo className="size-3.5 text-primary" /> Task created · Database Systems · Fri 23:59 · reminder set
            </p>
          </blockquote>
        </div>
        <p className="relative text-xs text-muted-foreground">© 2026 Welya AI · Made for students</p>
      </aside>

      <main className="relative flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/login" className="flex items-center gap-2 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <WelyaLogo className="size-4.5" />
            </span>
            <span className="font-heading font-semibold">Welya AI</span>
          </Link>
          <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={() => setTheme((resolvedTheme ?? theme) === "dark" ? "light" : "dark")}>
            <SunIcon className="dark:hidden" />
            <MoonIcon className="hidden dark:block" />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}

export function AuthHeading({ title, description, className }) {
  return (
    <div className={cn("mb-6 space-y-1.5", className)}>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}

export const PasswordInput = React.forwardRef(function PasswordInput({ className, ...props }, ref) {
  const [show, setShow] = React.useState(false)
  return (
    <InputGroup className={className}>
      <InputGroupInput ref={ref} type={show ? "text" : "password"} autoComplete={props.autoComplete ?? "current-password"} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)}>
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
})

export function PasswordStrength({ value = "" }) {
  const checks = [value.length >= 8, /[A-Z]/.test(value), /[0-9]/.test(value), /[^A-Za-z0-9]/.test(value)]
  const score = checks.filter(Boolean).length
  const label = ["", "Weak", "Fair", "Good", "Strong"][score]
  if (!value) return null
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full bg-muted transition-colors", i <= score && (score <= 1 ? "bg-destructive" : score === 2 ? "bg-amber-500" : "bg-emerald-500"))} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{label} · 8+ characters, an uppercase letter, a number and a symbol</p>
    </div>
  )
}
