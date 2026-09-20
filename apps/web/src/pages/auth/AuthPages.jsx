import * as React from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from "@/components/ui/empty"
import { useAuth } from "@/store/auth"
import { AuthHeading, PasswordInput, PasswordStrength } from "@/components/layout/AuthLayout"
import { AlertCircleIcon, ArrowLeftIcon, CheckCircle2Icon, KeyRoundIcon, MailCheckIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react"

const email = z.string().trim().min(1, "Email is required").email("Enter a valid email address")
const password = z.string().min(8, "At least 8 characters").regex(/[A-Z]/, "Add an uppercase letter").regex(/[0-9]/, "Add a number")

function GoogleMark({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#EA4335" d="M12 5.4c1.7 0 3.1.6 4.2 1.6l3.1-3.1C17.4 2.1 14.9 1 12 1 7.7 1 4 3.5 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
      <path fill="#4285F4" d="M23 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h6.2c-.3 1.4-1.1 2.6-2.3 3.4l3.5 2.7c2.1-1.9 3.6-4.8 3.6-8.2Z" />
      <path fill="#FBBC05" d="M5.8 14.1A6.7 6.7 0 0 1 5.4 12c0-.7.1-1.4.4-2.1L2.2 7.1A11 11 0 0 0 1 12c0 1.8.4 3.4 1.2 4.9l3.6-2.8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.2 1-3.8 1-2.9 0-5.3-1.9-6.2-4.5l-3.6 2.8C4 20.5 7.7 23 12 23Z" />
    </svg>
  )
}

function SocialButtons() {
  const { loginWithGoogle } = useAuth()
  return (
    <>
      <Button type="button" variant="outline" className="w-full" onClick={loginWithGoogle}>
        <GoogleMark className="size-4" data-icon="inline-start" /> Continue with Google
      </Button>
      <div className="relative my-5">
        <Separator />
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">or</span>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

const loginSchema = z.object({ email, password: z.string().min(1, "Password is required"), remember: z.boolean() })

const OAUTH_ERRORS = {
  google: "Google sign-in didn't complete. Please try again.",
  google_denied: "You cancelled the Google sign-in.",
  google_state: "That sign-in link expired. Please try again.",
  google_email: "Google didn't share an email address for that account.",
}

export function LoginPage() {
  const { login, demo, resendCode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [error, setError] = React.useState(() => OAUTH_ERRORS[params.get("error")] ?? null)
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "", remember: true } })
  const { isSubmitting, errors } = form.formState
  const from = location.state?.from ?? "/"

  React.useEffect(() => {
    if (params.has("error")) setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (values) => {
    setError(null)
    try {
      await login(values)
      toast.success("Welcome back")
      navigate(from, { replace: true })
    } catch (e) {
      if (e.code === "unverified") {
        await resendCode({ email: values.email }).catch(() => {})
        return navigate(`/verify-email?email=${encodeURIComponent(values.email)}`)
      }
      setError(e.message)
    }
  }

  return (
    <>
      <AuthHeading title="Welcome back" description="Sign in to pick up where you left off." />
      <SocialButtons />
      <form onSubmit={form.handleSubmit(submit)} noValidate>
        <FieldGroup className="gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Couldn't sign you in</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" autoComplete="email" placeholder="you@student.univ.ac.id" aria-invalid={!!errors.email} {...form.register("email")} />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={!!errors.password}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                Forgot password?
              </Link>
            </div>
            <PasswordInput id="password" placeholder="••••••••" aria-invalid={!!errors.password} {...form.register("password")} />
            <FieldError errors={[errors.password]} />
          </Field>
          <Controller
            control={form.control}
            name="remember"
            render={({ field }) => (
              <FieldLabel htmlFor="remember" className="font-normal">
                <Checkbox id="remember" checked={field.value} onCheckedChange={field.onChange} /> Keep me signed in on this device
              </FieldLabel>
            )}
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />} Sign in
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={isSubmitting}
            onClick={() => {
              form.setValue("email", demo.email)
              form.setValue("password", demo.password)
              form.handleSubmit(submit)()
            }}
          >
            <SparklesIcon data-icon="inline-start" /> Try the demo account
          </Button>
        </FieldGroup>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Welya?{" "}
        <Link to="/register" className="font-medium text-foreground hover:underline">
          Create an account
        </Link>
      </p>
    </>
  )
}

/* ------------------------------------------------------------------ */

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Tell us your name"),
    email,
    university: z.string().trim().min(2, "Which university are you at?"),
    password,
    confirm: z.string(),
    terms: z.boolean().refine((v) => v, "You need to accept the terms to continue"),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match" })

export function RegisterPage() {
  const { register: registerAccount } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = React.useState(null)
  const form = useForm({ resolver: zodResolver(registerSchema), defaultValues: { name: "", email: "", university: "", password: "", confirm: "", terms: false } })
  const { isSubmitting, errors } = form.formState
  const pw = form.watch("password")

  const submit = async (values) => {
    setError(null)
    try {
      const res = await registerAccount(values)
      toast.success("Account created", { description: res?.devCode ? `Dev verification code: ${res.devCode}` : "We sent a verification code to your email." })
      navigate(`/verify-email?email=${encodeURIComponent(values.email)}${res?.devCode ? `&code=${res.devCode}` : ""}`)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <AuthHeading title="Create your account" description="Free for students. Set up takes about a minute." />
      <SocialButtons />
      <form onSubmit={form.handleSubmit(submit)} noValidate>
        <FieldGroup className="gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Couldn't create account</AlertTitle>
              <AlertDescription>
                {error}{" "}
                <Link to="/login" className="underline">
                  Sign in instead
                </Link>
              </AlertDescription>
            </Alert>
          )}
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">Full name</FieldLabel>
            <Input id="name" autoComplete="name" placeholder="Nadia Putri" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="r-email">Email</FieldLabel>
            <Input id="r-email" type="email" autoComplete="email" placeholder="you@student.univ.ac.id" aria-invalid={!!errors.email} {...form.register("email")} />
            <FieldDescription>Use your campus email so Welya can recognise lecturer messages.</FieldDescription>
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={!!errors.university}>
            <FieldLabel htmlFor="university">University</FieldLabel>
            <Input id="university" autoComplete="organization" placeholder="Universitas Teknologi Nusantara" aria-invalid={!!errors.university} {...form.register("university")} />
            <FieldError errors={[errors.university]} />
          </Field>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="r-password">Password</FieldLabel>
            <PasswordInput id="r-password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
            <PasswordStrength value={pw} />
            <FieldError errors={[errors.password]} />
          </Field>
          <Field data-invalid={!!errors.confirm}>
            <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
            <PasswordInput id="confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} {...form.register("confirm")} />
            <FieldError errors={[errors.confirm]} />
          </Field>
          <Controller
            control={form.control}
            name="terms"
            render={({ field }) => (
              <Field data-invalid={!!errors.terms}>
                <FieldLabel htmlFor="terms" className="items-start font-normal">
                  <Checkbox id="terms" className="mt-0.5" checked={field.value} onCheckedChange={field.onChange} aria-invalid={!!errors.terms} />
                  <span>
                    I agree to the{" "}
                    <Link to="/terms" className="underline">
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" className="underline">
                      Privacy Policy
                    </Link>
                    , including AI processing of my academic emails and documents.
                  </span>
                </FieldLabel>
                <FieldError errors={[errors.terms]} />
              </Field>
            )}
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />} Create account
          </Button>
        </FieldGroup>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}

/* ------------------------------------------------------------------ */

// Landing point after Google OAuth: the API puts the session token in the URL fragment
export function AuthCallbackPage() {
  const { completeOAuth } = useAuth()
  const navigate = useNavigate()
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    const token = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token")
    window.history.replaceState(null, "", window.location.pathname)
    if (!token) return setFailed(true)
    completeOAuth(token)
      .then(() => {
        toast.success("Signed in with Google")
        navigate("/", { replace: true })
      })
      .catch(() => setFailed(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (failed) {
    return (
      <Empty className="border-0 p-0 text-left items-start">
        <EmptyHeader className="items-start text-left">
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <AlertCircleIcon />
          </EmptyMedia>
          <EmptyTitle className="text-2xl">Sign-in didn't complete</EmptyTitle>
          <EmptyDescription>We couldn't finish signing you in with Google. Please try again.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="items-stretch">
          <Button render={<Link to="/login" />}>
            <ArrowLeftIcon data-icon="inline-start" /> Back to sign in
          </Button>
        </EmptyContent>
      </Empty>
    )
  }
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-foreground">
      <Spinner className="size-5" /> Finishing sign-in…
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [sent, setSent] = React.useState(null)
  const form = useForm({ resolver: zodResolver(z.object({ email })), defaultValues: { email: "" } })
  const { isSubmitting, errors } = form.formState

  const submit = async (values) => {
    const res = await requestPasswordReset(values)
    setSent({ email: values.email, token: res?.devToken ?? null })
  }

  if (sent) {
    return (
      <Empty className="border-0 p-0 text-left items-start">
        <EmptyHeader className="items-start text-left">
          <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
            <MailCheckIcon />
          </EmptyMedia>
          <EmptyTitle className="text-2xl">Check your email</EmptyTitle>
          <EmptyDescription>
            If an account exists for <span className="font-medium text-foreground">{sent.email}</span>, we've sent a link to reset your password. The link expires in 30 minutes.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="items-stretch">
          {sent.token && (
            <Button render={<Link to={`/reset-password?token=${sent.token}`} />}>
              <KeyRoundIcon data-icon="inline-start" /> Open reset link (dev)
            </Button>
          )}
          <Button variant="ghost" onClick={() => setSent(null)}>
            Didn't get it? Try another email
          </Button>
          <Button variant="link" className="text-muted-foreground" render={<Link to="/login" />}>
            <ArrowLeftIcon data-icon="inline-start" /> Back to sign in
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <>
      <AuthHeading title="Reset your password" description="Enter the email you use for Welya and we'll send you a reset link." />
      <form onSubmit={form.handleSubmit(submit)} noValidate>
        <FieldGroup className="gap-4">
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="f-email">Email</FieldLabel>
            <Input id="f-email" type="email" autoComplete="email" placeholder="you@student.univ.ac.id" aria-invalid={!!errors.email} {...form.register("email")} />
            <FieldError errors={[errors.email]} />
          </Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />} Send reset link
          </Button>
        </FieldGroup>
      </form>
      <Button variant="link" className="mt-4 w-full text-muted-foreground" render={<Link to="/login" />}>
        <ArrowLeftIcon data-icon="inline-start" /> Back to sign in
      </Button>
    </>
  )
}

/* ------------------------------------------------------------------ */

const resetSchema = z.object({ password, confirm: z.string() }).refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match" })

export function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const [params] = useSearchParams()
  const token = params.get("token")
  const [state, setState] = React.useState(token ? "form" : "invalid")
  const [error, setError] = React.useState(null)
  const form = useForm({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } })
  const { isSubmitting, errors } = form.formState
  const pw = form.watch("password")

  const submit = async (values) => {
    setError(null)
    try {
      await resetPassword({ token, password: values.password })
      setState("done")
    } catch (e) {
      setError(e.message)
    }
  }

  if (state === "invalid") {
    return (
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <AlertCircleIcon />
          </EmptyMedia>
          <EmptyTitle className="text-2xl">This link isn't valid</EmptyTitle>
          <EmptyDescription>Reset links expire after 30 minutes and can only be used once. Request a new one to continue.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link to="/forgot-password" />}>Request a new link</Button>
        </EmptyContent>
      </Empty>
    )
  }

  if (state === "done") {
    return (
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <CheckCircle2Icon />
          </EmptyMedia>
          <EmptyTitle className="text-2xl">Password updated</EmptyTitle>
          <EmptyDescription>You can now sign in with your new password. We've also signed you out of other devices.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link to="/login" />}>Continue to sign in</Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <>
      <AuthHeading title="Choose a new password" description="Make it something you don't use anywhere else." />
      <form onSubmit={form.handleSubmit(submit)} noValidate>
        <FieldGroup className="gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="n-password">New password</FieldLabel>
            <PasswordInput id="n-password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
            <PasswordStrength value={pw} />
            <FieldError errors={[errors.password]} />
          </Field>
          <Field data-invalid={!!errors.confirm}>
            <FieldLabel htmlFor="n-confirm">Confirm new password</FieldLabel>
            <PasswordInput id="n-confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} {...form.register("confirm")} />
            <FieldError errors={[errors.confirm]} />
          </Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />} Update password
          </Button>
        </FieldGroup>
      </form>
    </>
  )
}

/* ------------------------------------------------------------------ */

export function VerifyEmailPage() {
  const { verifyEmail, resendCode } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const emailParam = params.get("email") ?? ""
  const devCode = params.get("code")
  const [code, setCode] = React.useState("")
  const [hint, setHint] = React.useState(devCode)
  const [error, setError] = React.useState(null)
  const [pending, setPending] = React.useState(false)
  const [cooldown, setCooldown] = React.useState(0)

  React.useEffect(() => {
    if (!cooldown) return
    const id = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  const submit = async (value = code) => {
    if (value.length < 6) return
    setPending(true)
    setError(null)
    try {
      await verifyEmail({ email: emailParam, code: value })
      toast.success("Email verified", { description: "Welcome to Welya." })
      navigate("/", { replace: true })
    } catch (e) {
      setError(e.message)
      setCode("")
    } finally {
      setPending(false)
    }
  }

  const resend = async () => {
    setCooldown(30)
    const res = await resendCode({ email: emailParam })
    if (res?.devCode) setHint(res.devCode)
    toast.success("Code sent", { description: `A new code is on its way to ${emailParam}.` })
  }

  return (
    <>
      <AuthHeading title="Verify your email" description={<>Enter the 6-digit code we sent to <span className="font-medium text-foreground">{emailParam || "your email"}</span>.</>} />
      <div className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={submit} disabled={pending} autoFocus>
            <InputOTPGroup>
              <InputOTPSlot index={0} className="size-11 text-lg" />
              <InputOTPSlot index={1} className="size-11 text-lg" />
              <InputOTPSlot index={2} className="size-11 text-lg" />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} className="size-11 text-lg" />
              <InputOTPSlot index={4} className="size-11 text-lg" />
              <InputOTPSlot index={5} className="size-11 text-lg" />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="w-full" disabled={pending || code.length < 6} onClick={() => submit()}>
          {pending ? <Spinner data-icon="inline-start" /> : <ShieldCheckIcon data-icon="inline-start" />} Verify
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Didn't get a code?{" "}
          <button type="button" className="font-medium text-foreground disabled:text-muted-foreground disabled:no-underline hover:underline" disabled={cooldown > 0} onClick={resend}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"}
          </button>
        </p>
        {hint && <p className="text-center text-xs text-muted-foreground">Dev mode — your code is <span className="font-mono font-medium text-foreground">{hint}</span>.</p>}
      </div>
      <Button variant="link" className="mt-4 w-full text-muted-foreground" render={<Link to="/login" />}>
        <ArrowLeftIcon data-icon="inline-start" /> Back to sign in
      </Button>
    </>
  )
}
