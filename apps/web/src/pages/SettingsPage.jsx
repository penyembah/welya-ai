import * as React from "react"
import { NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { useAppStore } from "@/store/app-store"
import { useAuth } from "@/store/auth"
import { useAsyncAction } from "@/hooks/use-simulated-loading"
import { useAvatarMutation, useIntegrationMutation, downloadExport } from "@/hooks/use-welya-api"
import { api, API_URL } from "@/lib/api"
import { isTauri, openExternal } from "@/lib/tauri"
import { PageHeader } from "@/components/welya/page-primitives"
import { relativeTime, fmtDate } from "@/lib/dates"
import { BellIcon, CalendarIcon, CheckCircle2Icon, KeyRoundIcon, LinkIcon, ListChecksIcon, LogOutIcon, MailIcon, MonitorIcon, MoonIcon, PaletteIcon, PlugIcon, RefreshCwIcon, SchoolIcon, ShieldIcon, SparklesIcon, SunIcon, UserIcon } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PasswordInput, PasswordStrength } from "@/components/layout/AuthLayout"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"

const NAV = [
  { to: "/settings", label: "Account", icon: UserIcon, end: true },
  { to: "/settings/ai", label: "AI Preferences", icon: SparklesIcon },
  { to: "/settings/notifications", label: "Notifications", icon: BellIcon },
  { to: "/settings/appearance", label: "Appearance", icon: PaletteIcon },
  { to: "/settings/privacy", label: "Privacy", icon: ShieldIcon },
  { to: "/settings/integrations", label: "Integrations", icon: PlugIcon },
]

export function SettingsLayout() {
  const { pathname } = useLocation()
  const current = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Your account, how Welya behaves, and what it's allowed to see." />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted", isActive && "bg-muted font-medium")}>
              <n.icon className="size-4 text-muted-foreground" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 space-y-5">
          <h2 className="font-heading text-lg font-medium lg:hidden">{current?.label}</h2>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

function SwitchRow({ label, description, checked, onChange }) {
  return (
    <Field orientation="horizontal">
      <FieldContent><FieldTitle>{label}</FieldTitle>{description && <FieldDescription>{description}</FieldDescription>}</FieldContent>
      <Switch checked={checked} onCheckedChange={onChange} />
    </Field>
  )
}

export function AccountSettings() {
  const { user, dispatch } = useAppStore()
  const [form, setForm] = React.useState(user)
  const [pending, run] = useAsyncAction()
  const avatarMutation = useAvatarMutation()
  const fileRef = React.useRef(null)
  // Only the editable profile fields count as "dirty" (email/password live in Security below)
  const editable = ({ name, university, program, semester }) => ({ name, university, program, semester })
  const dirty = JSON.stringify(editable(form)) !== JSON.stringify(editable(user))
  React.useEffect(() => {
    if (!dirty) setForm(user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])
  // Google profile pictures are absolute URLs; uploaded avatars are served by the API
  const avatarSrc = user.avatar ? (/^https?:\/\//.test(user.avatar) ? user.avatar : `${API_URL}${user.avatar}`) : null

  const uploadAvatar = async (file) => {
    if (!file) return
    try {
      const { avatar } = await avatarMutation.mutateAsync(file)
      dispatch({ type: "user/update", patch: { avatar } })
      toast.success("Avatar updated")
    } catch (e) {
      toast.error("Couldn't upload avatar", { description: e.message })
    }
  }

  return (
    <div className="space-y-5">
    <Card>
      <CardHeader><CardTitle>Profile</CardTitle><CardDescription>How Welya addresses you and where it sends summaries.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar size="lg" className="size-16">
            {avatarSrc && <AvatarImage src={avatarSrc} alt={user.name} />}
            <AvatarFallback className="bg-primary/10 text-lg font-medium text-primary">{user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
            <Button size="sm" variant="outline" disabled={avatarMutation.isPending} onClick={() => fileRef.current?.click()}>{avatarMutation.isPending && <Spinner data-icon="inline-start" />} Change avatar</Button>
            <p className="text-xs text-muted-foreground">PNG or JPG, up to 2 MB.</p>
          </div>
        </div>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor="name">Full name</FieldLabel><Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" value={user.email} readOnly className="text-muted-foreground" />
              <FieldDescription>Change it in the Security section below — the new address needs a confirmation code.</FieldDescription>
            </Field>
            <Field><FieldLabel htmlFor="uni">University</FieldLabel><Input id="uni" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} /></Field>
            <Field><FieldLabel htmlFor="prog">Program</FieldLabel><Input id="prog" value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} /></Field>
            <Field><FieldLabel htmlFor="sem">Semester</FieldLabel><Input id="sem" type="number" min={1} max={14} value={form.semester} onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })} /></Field>
          </div>
        </FieldGroup>
        <Separator />
        <div className="space-y-2 text-sm">
          <p className="font-medium">Account</p>
          <div className="flex items-center justify-between rounded-lg border p-3"><div><p>Plan</p><p className="text-xs text-muted-foreground">Free for students · every feature included</p></div><Badge>Free</Badge></div>
          <div className="flex items-center justify-between rounded-lg border p-3"><div><p>Sign-in</p><p className="text-xs text-muted-foreground">{user.googleLinked ? `Google${user.hasPassword ? " + password" : ""}` : "Email and password"}</p></div>{user.googleLinked && <Badge variant="secondary">Google linked</Badge>}</div>
          <div className="flex items-center justify-between rounded-lg border p-3"><div><p>Member since</p><p className="text-xs text-muted-foreground">{user.createdAt ? fmtDate(user.createdAt, "MMMM yyyy") : "—"}</p></div></div>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" disabled={!dirty} onClick={() => setForm(user)}>Reset</Button>
        <Button disabled={!dirty || pending} onClick={() => run(async () => { await dispatch({ type: "user/update", patch: editable(form) }); toast.success("Profile saved") })}>{pending && <Spinner data-icon="inline-start" />} Save changes</Button>
      </CardFooter>
    </Card>
    <SecuritySettings />
    </div>
  )
}

/* ------------------------------------------------------------------ security */

function PasswordDialog({ open, onOpenChange, hasPassword }) {
  const { dispatch, refetch } = useAppStore()
  const [current, setCurrent] = React.useState("")
  const [next, setNext] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [error, setError] = React.useState(null)
  const [pending, run] = useAsyncAction()
  const valid = next.length >= 8 && /[A-Z]/.test(next) && /[0-9]/.test(next) && next === confirm && (!hasPassword || current)

  React.useEffect(() => {
    if (open) { setCurrent(""); setNext(""); setConfirm(""); setError(null) }
  }, [open])

  const submit = () => run(async () => {
    setError(null)
    try {
      const res = await api.post("/me/password", { currentPassword: hasPassword ? current : undefined, newPassword: next })
      dispatch({ type: "user/update", patch: { hasPassword: true } })
      refetch?.()
      toast.success(hasPassword ? "Password changed" : "Password set", { description: "Other devices were signed out." })
      onOpenChange(false)
      return res
    } catch (e) {
      setError(e.message)
    }
  }, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{hasPassword ? "Change password" : "Set a password"}</DialogTitle>
          <DialogDescription>{hasPassword ? "You'll stay signed in here; every other device is signed out." : "Adds email + password sign-in alongside Google."}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(e) => { e.preventDefault(); if (valid) submit() }}>
          <FieldGroup className="gap-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {hasPassword && <Field><FieldLabel htmlFor="pw-current">Current password</FieldLabel><PasswordInput id="pw-current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>}
            <Field><FieldLabel htmlFor="pw-next">New password</FieldLabel><PasswordInput id="pw-next" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /><PasswordStrength value={next} /></Field>
            <Field data-invalid={confirm && confirm !== next}><FieldLabel htmlFor="pw-confirm">Confirm new password</FieldLabel><PasswordInput id="pw-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={confirm && confirm !== next} />{confirm && confirm !== next && <FieldDescription className="text-destructive">Passwords don't match</FieldDescription>}</Field>
          </FieldGroup>
        </form>
        <DialogFooter showCloseButton>
          <Button onClick={submit} disabled={!valid || pending}>{pending && <Spinner data-icon="inline-start" />} {hasPassword ? "Change password" : "Set password"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EmailDialog({ open, onOpenChange, user }) {
  const { refetch } = useAppStore()
  const { completeOAuth } = useAuth()
  const [step, setStep] = React.useState(user.pendingEmail ? "confirm" : "request")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [code, setCode] = React.useState("")
  const [hint, setHint] = React.useState(null)
  const [error, setError] = React.useState(null)
  const [pending, run] = useAsyncAction()
  const target = user.pendingEmail ?? email

  React.useEffect(() => {
    if (open) { setStep(user.pendingEmail ? "confirm" : "request"); setEmail(""); setPassword(""); setCode(""); setHint(null); setError(null) }
  }, [open, user.pendingEmail])

  const request = () => run(async () => {
    setError(null)
    try {
      const res = await api.post("/me/email", { email, password: user.hasPassword ? password : undefined })
      if (res.devCode) setHint(res.devCode)
      refetch?.()
      setStep("confirm")
      toast.success("Code sent", { description: `Check ${email} for a 6-digit code.` })
    } catch (e) { setError(e.message) }
  }, 0)

  const confirm = () => run(async () => {
    setError(null)
    try {
      const res = await api.post("/me/email/confirm", { code })
      // Fresh token: the JWT email claim changed and other sessions were revoked
      await completeOAuth(res.token)
      refetch?.()
      toast.success("Email updated", { description: `You now sign in with ${res.user.email}.` })
      onOpenChange(false)
    } catch (e) { setError(e.message) }
  }, 0)

  const cancel = () => run(async () => {
    try {
      await api.delete("/me/email")
      refetch?.()
      setStep("request")
      setCode("")
      toast("Email change cancelled")
    } catch (e) { toast.error("Couldn't cancel the email change", { description: e.message }) }
  }, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change sign-in email</DialogTitle>
          <DialogDescription>{step === "request" ? "We'll send a 6-digit code to the new address. Your current email keeps working until you confirm." : <>Enter the code we sent to <span className="font-medium text-foreground">{target}</span>.</>}</DialogDescription>
        </DialogHeader>
        {step === "request" ? (
          <form noValidate onSubmit={(e) => { e.preventDefault(); request() }}>
            <FieldGroup className="gap-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Field><FieldLabel htmlFor="new-email">New email</FieldLabel><Input id="new-email" type="email" autoComplete="email" placeholder="you@student.univ.ac.id" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              {user.hasPassword && <Field><FieldLabel htmlFor="email-pw">Current password</FieldLabel><PasswordInput id="email-pw" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>}
            </FieldGroup>
          </form>
        ) : (
          <div className="space-y-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={confirm} containerClassName="justify-center">
              <InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /></InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup>
            </InputOTP>
            {hint && <p className="text-center text-xs text-muted-foreground">Dev code: <span className="font-mono">{hint}</span></p>}
            <Button variant="link" size="sm" className="w-full text-muted-foreground" onClick={cancel} disabled={pending}>Use a different address</Button>
          </div>
        )}
        <DialogFooter showCloseButton>
          {step === "request"
            ? <Button onClick={request} disabled={pending || !/^\S+@\S+\.\S+$/.test(email) || (user.hasPassword && !password)}>{pending && <Spinner data-icon="inline-start" />} Send code</Button>
            : <Button onClick={confirm} disabled={pending || code.length !== 6}>{pending && <Spinner data-icon="inline-start" />} Confirm</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SecuritySettings() {
  const { user } = useAppStore()
  const { logout } = useAuth()
  const qc = useQueryClient()
  const [pwOpen, setPwOpen] = React.useState(false)
  const [emailOpen, setEmailOpen] = React.useState(false)
  const sessions = useQuery({ queryKey: ["me", "sessions"], queryFn: () => api.get("/me/sessions"), staleTime: 15_000 })
  const [busy, setBusy] = React.useState(null)

  const revoke = async (s) => {
    setBusy(s.id)
    try {
      await api.delete(`/me/sessions/${s.id}`)
      if (s.current) return logout()
      toast(`Signed out ${s.device}`)
      qc.invalidateQueries({ queryKey: ["me", "sessions"] })
    } catch (e) { toast.error("Couldn't sign out that device", { description: e.message }) } finally { setBusy(null) }
  }
  const revokeOthers = async () => {
    setBusy("others")
    try {
      const { revoked } = await api.post("/me/sessions/revoke-others", {})
      toast.success(revoked ? `Signed out ${revoked} other device${revoked > 1 ? "s" : ""}` : "No other devices were signed in")
      qc.invalidateQueries({ queryKey: ["me", "sessions"] })
    } catch (e) { toast.error("Couldn't sign out other devices", { description: e.message }) } finally { setBusy(null) }
  }

  const list = sessions.data?.sessions ?? []
  return (
    <Card>
      <CardHeader><CardTitle>Security</CardTitle><CardDescription>Password, sign-in email and the devices that are currently signed in.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex items-start gap-3"><KeyRoundIcon className="mt-0.5 size-4 text-muted-foreground" /><div><p>Password</p><p className="text-xs text-muted-foreground">{user.hasPassword ? "Set · changing it signs out every other device" : "Not set · you sign in with Google only"}</p></div></div>
            <Button size="sm" variant="outline" onClick={() => setPwOpen(true)}>{user.hasPassword ? "Change" : "Set password"}</Button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex items-start gap-3"><MailIcon className="mt-0.5 size-4 text-muted-foreground" /><div><p>Sign-in email</p><p className="text-xs text-muted-foreground">{user.email}{user.pendingEmail && <> · <span className="text-amber-600 dark:text-amber-300">change to {user.pendingEmail} pending confirmation</span></>}</p></div></div>
            <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>{user.pendingEmail ? "Enter code" : "Change"}</Button>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Active sessions</p>
            <Button size="sm" variant="ghost" disabled={busy === "others" || list.filter((s) => !s.current).length === 0} onClick={revokeOthers}>{busy === "others" ? <Spinner data-icon="inline-start" /> : <LogOutIcon data-icon="inline-start" />} Sign out other devices</Button>
          </div>
          {sessions.isLoading ? (
            <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg border bg-muted/40" />)}</div>
          ) : (
            <div className="space-y-2">
              {list.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div className="flex items-start gap-3">
                    <MonitorIcon className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <p className="flex items-center gap-2">{s.device}{s.current && <Badge variant="secondary" className="h-5">This device</Badge>}</p>
                      <p className="text-xs text-muted-foreground">{s.ip} · signed in {relativeTime(s.createdAt)} · expires {fmtDate(s.expiresAt, "d MMM")}</p>
                    </div>
                  </div>
                  <Button size="sm" variant={s.current ? "outline" : "ghost"} disabled={busy === s.id} onClick={() => revoke(s)}>{busy === s.id ? <Spinner /> : s.current ? "Sign out" : "Revoke"}</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <PasswordDialog open={pwOpen} onOpenChange={setPwOpen} hasPassword={user.hasPassword} />
      <EmailDialog open={emailOpen} onOpenChange={setEmailOpen} user={user} />
    </Card>
  )
}

const TONE_ITEMS = { concise: "Concise", friendly: "Friendly", formal: "Formal" }

export function AISettings() {
  const { settings, dispatch } = useAppStore()
  const ai = settings.ai
  const set = (patch) => dispatch({ type: "settings/update", section: "ai", patch })
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>How Welya behaves</CardTitle><CardDescription>Control how proactive your secretary is.</CardDescription></CardHeader>
        <CardContent><FieldGroup className="gap-5">
          <SwitchRow label="Automatically interpret inbox items" description="Welya reads new emails, messages and files as soon as they arrive." checked={ai.autoProcessInbox} onChange={(v) => set({ autoProcessInbox: v })} />
          <SwitchRow label="Ask before creating tasks or events" description="When off, high-confidence items (≥90%) are added without confirmation." checked={ai.confirmBeforeCreating} onChange={(v) => set({ confirmBeforeCreating: v })} />
          <SwitchRow label="Suggest plans for free time" description="Show 'Plan my day' recommendations on Home and Calendar." checked={ai.suggestPlans} onChange={(v) => set({ suggestPlans: v })} />
        </FieldGroup></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Task breakdown style</CardTitle><CardDescription>How detailed should generated subtasks be?</CardDescription></CardHeader>
        <CardContent>
          <RadioGroup value={ai.breakdownStyle} onValueChange={(v) => set({ breakdownStyle: v })} className="gap-3">
            {[["brief", "Brief", "3–4 high-level steps"], ["detailed", "Detailed", "6–8 concrete steps with time estimates"], ["checklist", "Checklist", "Many small, checkable items"]].map(([v, l, d]) => (
              <FieldLabel key={v} htmlFor={`bd-${v}`}><Field orientation="horizontal"><FieldContent><FieldTitle>{l}</FieldTitle><FieldDescription>{d}</FieldDescription></FieldContent><RadioGroupItem id={`bd-${v}`} value={v} /></Field></FieldLabel>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Tone</CardTitle><CardDescription>How Welya writes summaries and replies.</CardDescription></CardHeader>
        <CardContent>
          <Select items={TONE_ITEMS} value={ai.tone} onValueChange={(v) => set({ tone: v })}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TONE_ITEMS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
        </CardContent>
      </Card>
    </div>
  )
}

const LEAD_ITEMS = { "2": "2 hours before", "12": "12 hours before", "24": "1 day before", "48": "2 days before" }
const TIME_ITEMS = { "06:00": "06:00", "07:00": "07:00", "08:00": "08:00", "20:00": "20:00 (evening before)" }

export function NotificationSettings() {
  const { settings, dispatch } = useAppStore()
  const n = settings.notifications
  const set = (patch) => dispatch({ type: "settings/update", section: "notifications", patch })
  return (
    <Card>
      <CardHeader><CardTitle>Notifications</CardTitle><CardDescription>Choose what Welya reminds you about.</CardDescription></CardHeader>
      <CardContent><FieldGroup className="gap-5">
        <SwitchRow label="Deadline reminders" description="Get notified before a task is due." checked={n.deadlineReminders} onChange={(v) => set({ deadlineReminders: v })} />
        {n.deadlineReminders && (
          <Field orientation="horizontal" className="pl-4"><FieldContent><FieldTitle>Remind me</FieldTitle></FieldContent>
            <Select items={LEAD_ITEMS} value={n.deadlineLeadHours} onValueChange={(v) => set({ deadlineLeadHours: v })}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(LEAD_ITEMS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
          </Field>
        )}
        <Separator />
        <SwitchRow label="Daily summary" description="A morning briefing of classes, deadlines and recommendations." checked={n.dailySummary} onChange={(v) => set({ dailySummary: v })} />
        {n.dailySummary && (
          <Field orientation="horizontal" className="pl-4"><FieldContent><FieldTitle>Send at</FieldTitle></FieldContent>
            <Select items={TIME_ITEMS} value={n.dailySummaryTime} onValueChange={(v) => set({ dailySummaryTime: v })}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TIME_ITEMS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
          </Field>
        )}
        <SwitchRow label="Weekly review" description="Every Sunday evening, a recap of the week and a look ahead." checked={n.weeklyReview} onChange={(v) => set({ weeklyReview: v })} />
        <Separator />
        <SwitchRow label="Calendar reminders" description="30 minutes before classes and meetings." checked={n.calendarReminders} onChange={(v) => set({ calendarReminders: v })} />
        <SwitchRow label="Inbox alerts" description="When Welya finds something important in a new message." checked={n.inboxAlerts} onChange={(v) => set({ inboxAlerts: v })} />
      </FieldGroup></CardContent>
    </Card>
  )
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const options = [["light", "Light", SunIcon], ["dark", "Dark", MoonIcon], ["system", "System", MonitorIcon]]
  return (
    <Card>
      <CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Welya is dark by default. Pick what suits you.</CardDescription></CardHeader>
      <CardContent>
        <RadioGroup value={theme ?? "system"} onValueChange={setTheme} className="grid-cols-1 gap-3 sm:grid-cols-3">
          {options.map(([v, l, Icon]) => (
            <FieldLabel key={v} htmlFor={`theme-${v}`}>
              <Field orientation="horizontal"><FieldContent className="flex-row items-center gap-2"><Icon className="size-4 text-muted-foreground" /><FieldTitle>{l}</FieldTitle></FieldContent><RadioGroupItem id={`theme-${v}`} value={v} /></Field>
            </FieldLabel>
          ))}
        </RadioGroup>
        <p className="mt-4 text-xs text-muted-foreground">Accent color and typography follow the Welya theme (teal · Geist).</p>
      </CardContent>
    </Card>
  )
}

export function PrivacySettings() {
  const { settings, dispatch, integrations, user } = useAppStore()
  const { logout } = useAuth()
  const hasPassword = user.hasPassword !== false
  const p = settings.privacy
  const set = (patch) => dispatch({ type: "settings/update", section: "privacy", patch })
  const [confirm, setConfirm] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const [deleteError, setDeleteError] = React.useState(null)
  const [exporting, runExport] = useAsyncAction()
  const [deleting, runDelete] = useAsyncAction()
  const connected = integrations.filter((i) => i.status === "connected")

  const deleteAccount = () =>
    runDelete(async () => {
      setDeleteError(null)
      try {
        await api.delete("/me", { data: { password } })
        toast.success("Your account and all data were deleted")
        logout()
      } catch (e) {
        setDeleteError(e.message)
      }
    }, 0)
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>AI processing</CardTitle><CardDescription>What Welya is allowed to read to understand your academic life.</CardDescription></CardHeader>
        <CardContent><FieldGroup className="gap-5">
          <SwitchRow label="Process emails" description="Read lecturer and campus emails from connected accounts." checked={p.allowEmailProcessing} onChange={(v) => set({ allowEmailProcessing: v })} />
          <SwitchRow label="Process documents" description="Read uploaded PDFs, slides and screenshots." checked={p.allowDocumentProcessing} onChange={(v) => set({ allowDocumentProcessing: v })} />
          <SwitchRow label="Keep conversation history" description="Store chats with Welya so it can refer back to them." checked={p.retainConversations} onChange={(v) => set({ retainConversations: v })} />
          <SwitchRow label="Share anonymous usage statistics" description="Helps improve Welya. Never includes your content." checked={p.shareUsageStats} onChange={(v) => set({ shareUsageStats: v })} />
        </FieldGroup></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Connected services</CardTitle><CardDescription>{connected.length ? `${connected.length} service${connected.length > 1 ? "s" : ""} can share data with Welya.` : "No services connected."}</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {connected.map((i) => <div key={i.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><div><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{i.account}</p></div><Button size="sm" variant="ghost" render={<NavLink to="/settings/integrations" />}>Manage</Button></div>)}
        </CardContent>
      </Card>
      <Card className="border-destructive/30">
        <CardHeader><CardTitle>Your data</CardTitle><CardDescription>Export or delete everything Welya has stored.</CardDescription></CardHeader>
        <CardFooter className="justify-between gap-2">
          <Button variant="outline" disabled={exporting} onClick={() => runExport(async () => { try { await downloadExport(); toast.success("Export downloaded") } catch (e) { toast.error("Couldn't export your data", { description: e.message }) } }, 0)}>{exporting && <Spinner data-icon="inline-start" />} Export data</Button>
          <Button variant="destructive" onClick={() => setConfirm(true)}>Delete account</Button>
        </CardFooter>
      </Card>
      <AlertDialog open={confirm} onOpenChange={(o) => { setConfirm(o); if (!o) { setPassword(""); setDeleteError(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete your account?</AlertDialogTitle><AlertDialogDescription>Tasks, notes, documents and conversations will be permanently removed.{hasPassword ? " Enter your password to confirm." : ""}</AlertDialogDescription></AlertDialogHeader>
          {hasPassword && (
            <div className="space-y-2">
              <Input type="password" autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!deleteError} />
              {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            </div>
          )}
          {!hasPassword && deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={(hasPassword && !password) || deleting} onClick={deleteAccount}>{deleting && <Spinner data-icon="inline-start" />} Delete everything</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const INTEGRATION_ICON = { "google-calendar": CalendarIcon, "google-tasks": ListChecksIcon, gmail: MailIcon, lms: SchoolIcon }
const STATUS = {
  connected: { label: "Connected", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  disconnected: { label: "Not connected", className: "bg-muted text-muted-foreground" },
  "coming-soon": { label: "Coming soon", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  error: { label: "Needs attention", className: "bg-destructive/10 text-destructive" },
}

const GOOGLE_IDS = new Set(["gmail", "google-calendar", "google-tasks"])
const describeSync = (r) => {
  if (!r) return undefined
  const parts = []
  if (r.imported) parts.push(`${r.imported} new`)
  if (r.updated) parts.push(`${r.updated} updated`)
  if (r.pushed) parts.push(`${r.pushed} sent to Google`)
  return parts.length ? parts.join(" · ") : "Everything was already in sync"
}

function IntegrationCard({ integration }) {
  const action = useIntegrationMutation()
  const [connectOpen, setConnectOpen] = React.useState(false)
  const [manageOpen, setManageOpen] = React.useState(false)
  const Icon = INTEGRATION_ICON[integration.id] ?? LinkIcon
  const s = STATUS[integration.status]
  const pending = action.isPending
  const isGoogle = GOOGLE_IDS.has(integration.id)

  const run = async (kind, onOk, body) => {
    try {
      const res = await action.mutateAsync({ id: integration.id, action: kind, body })
      onOk?.(res)
    } catch (e) {
      toast.error(`Couldn't ${kind} ${integration.name}`, { description: e.message })
    }
  }
  // Google returns an OAuth URL. Web: leave the app and come back to /settings/integrations.
  // Desktop: open the system browser; the API deep-links back to welya://integrations/callback.
  const connect = () =>
    run("connect", (res) => {
      if (res?.authUrl) {
        if (isTauri()) toast.info("Continue in your browser", { description: "Finish connecting Google there; Welya will pick it up automatically." })
        return openExternal(res.authUrl)
      }
      toast.success(`${integration.name} connected`, { description: "Importing in the background…" })
      setConnectOpen(false)
    }, isTauri() ? { client: "desktop" } : undefined)
  const disconnect = () => run("disconnect", () => { toast(`${integration.name} disconnected`); setManageOpen(false) })
  const sync = () => run("sync", (res) => toast.success(`${integration.name} synced`, { description: describeSync(res?.result) }))
  const waitlist = () => run("waitlist", () => toast.success("We'll let you know", { description: `You're on the waitlist for ${integration.name}.` }))

  return (
    <Card className="gap-3">
      <CardHeader>
        <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-muted"><Icon className="size-5" /></div>
        <CardTitle>{integration.name}</CardTitle>
        <CardDescription>{integration.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Badge variant="secondary" className={s.className}>{integration.status === "connected" && <CheckCircle2Icon />}{s.label}</Badge>
        {integration.status === "connected" && <p className="text-xs text-muted-foreground">{integration.account} · {integration.lastSync ? `synced ${relativeTime(integration.lastSync)}` : "first import running…"}</p>}
        {integration.status === "error" && <p className="text-xs text-destructive">Google access expired or was revoked. Reconnect to continue syncing.</p>}
        {integration.scopes.length > 0 && <p className="text-xs text-muted-foreground">Permissions: {integration.scopes.join(", ")}</p>}
      </CardContent>
      <CardFooter className="justify-end gap-2 py-2.5">
        {integration.status === "connected" ? (
          <>
            <Tooltip><TooltipTrigger render={<Button size="sm" variant="ghost" onClick={sync} disabled={pending} />}>{pending ? <Spinner /> : <RefreshCwIcon />}</TooltipTrigger><TooltipContent>Sync now</TooltipContent></Tooltip>
            <Button size="sm" variant="outline" onClick={() => setManageOpen(true)}>Manage</Button>
          </>
        ) : integration.status === "coming-soon" ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={waitlist}>Notify me</Button>
        ) : integration.status === "error" ? (
          <Button size="sm" disabled={pending} onClick={connect}>{pending && <Spinner data-icon="inline-start" />} Reconnect</Button>
        ) : (
          <Button size="sm" onClick={() => setConnectOpen(true)}><LinkIcon data-icon="inline-start" /> Connect</Button>
        )}
      </CardFooter>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Connect {integration.name}</DialogTitle>
            <DialogDescription>{isGoogle ? (integration.id === "gmail" ? "You'll be sent to Google to choose an account and grant read-only access to your mail. You can disconnect at any time." : "You'll be sent to Google to choose an account. Welya will keep this in sync both ways: changes you make in Welya appear in Google, and changes in Google appear here. You can disconnect at any time.") : "Connecting links this service to your Welya account. You can disconnect at any time."}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-sm">{integration.scopes.map((sc) => <li key={sc} className="flex items-center gap-2"><CheckCircle2Icon className="size-4 text-primary" /> {sc}</li>)}</ul>
          <DialogFooter showCloseButton><Button onClick={connect} disabled={pending}>{pending && <Spinner data-icon="inline-start" />} {isGoogle ? "Continue with Google" : "Continue"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{integration.name}</DialogTitle><DialogDescription>Connected as {integration.account}</DialogDescription></DialogHeader>
          <div className="space-y-2 text-sm"><p className="text-muted-foreground">Last sync: {integration.lastSync ? relativeTime(integration.lastSync) : "never"}</p><p className="text-muted-foreground">Permissions: {integration.scopes.join(", ")}</p></div>
          <DialogFooter showCloseButton><Button variant="destructive" onClick={disconnect} disabled={pending}>Disconnect</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

const CONNECT_ERRORS = {
  denied: "You cancelled the Google authorisation.",
  scope: "Google didn't grant the permission Welya needs. Tick the checkbox on the consent screen and try again.",
  state: "That authorisation link expired. Please try again.",
  google: "Google didn't complete the connection. Please try again.",
}

export function IntegrationsSettings() {
  const { integrations, refetch } = useAppStore()
  const [params, setParams] = useSearchParams()
  const connected = integrations.filter((i) => i.status === "connected").length

  // Back from the Google consent screen (see apps/api routes/google.ts). On desktop the deep-link listener in App.jsx puts the same params in the URL.
  React.useEffect(() => {
    const ok = params.get("connected")
    const err = params.get("error")
    if (!ok && !err) return
    const name = integrations.find((i) => i.id === (ok ?? params.get("integration")))?.name ?? "Google"
    if (ok) {
      toast.success(`${name} connected`, { description: "Welya is importing your data in the background. This can take a minute." })
      refetch?.()
      const t = setTimeout(() => refetch?.(), 8000)
      setParams({}, { replace: true })
      return () => clearTimeout(t)
    }
    toast.error(`Couldn't connect ${name}`, { description: CONNECT_ERRORS[err] ?? CONNECT_ERRORS.google })
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return (
    <div className="space-y-4">
      <div><h2 className="font-heading text-lg font-medium">Integrations</h2><p className="text-sm text-muted-foreground">{connected} of {integrations.filter((i) => i.status !== "coming-soon").length} available services connected. Connected services feed your Inbox, Calendar and Documents; press sync any time to pull the latest.</p></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{integrations.map((i) => <IntegrationCard key={i.id} integration={i} />)}</div>
    </div>
  )
}
