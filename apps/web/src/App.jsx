import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import * as React from "react"
import { toast } from "sonner"
import { ThemeProvider } from "next-themes"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { AppStoreProvider, useAppStore } from "@/store/app-store"
import { AuthProvider, useAuth } from "@/store/auth"
import { AppShell } from "@/components/layout/AppShell"
import { AuthLayout } from "@/components/layout/AuthLayout"
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage, AuthCallbackPage } from "@/pages/auth/AuthPages"
import { EmptyState, ErrorState } from "@/components/welya/page-primitives"
import HomePage from "@/pages/HomePage"
import InboxPage from "@/pages/InboxPage"
import TasksPage from "@/pages/TasksPage"
import CalendarPage from "@/pages/CalendarPage"
import CoursesPage from "@/pages/CoursesPage"
import CourseDetailPage from "@/pages/CourseDetailPage"
import { WorkspacesPage, WorkspaceDetailPage } from "@/pages/WorkspacesPage"
import AssistantPage from "@/pages/AssistantPage"
import DocumentsPage from "@/pages/DocumentsPage"
import NotificationsPage from "@/pages/NotificationsPage"
import ReviewPage from "@/pages/ReviewPage"
import { SettingsLayout, AccountSettings, AISettings, NotificationSettings, AppearanceSettings, PrivacySettings, IntegrationsSettings } from "@/pages/SettingsPage"
import { listenDeepLinks } from "@/lib/tauri"
import { CompassIcon } from "lucide-react"
import "./App.css"

function NotFound() {
  return (
    <EmptyState
      icon={CompassIcon}
      title="Page not found"
      description="Welya couldn't find that page."
      action={<Button size="sm" render={<Link to="/" />}>Back to Home</Button>}
      className="min-h-[50vh]"
    />
  )
}

function FullScreenSpinner({ label }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Spinner className="size-5" />
      {label}
    </div>
  )
}

function RequireAuth({ children }) {
  const { isAuthenticated, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <FullScreenSpinner label="Checking your session…" />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

const OAUTH_ERRORS = { google_denied: "You cancelled the Google sign-in.", google_state: "The sign-in link expired. Please try again.", google_email: "Google didn't share an email address.", google: "Google sign-in failed. Please try again." }

// Desktop only: the OAuth flow finishes in the system browser and comes back as welya://auth/callback or welya://integrations/callback
function DeepLinkListener() {
  const { exchangeDesktopCode } = useAuth()
  const navigate = useNavigate()
  React.useEffect(() => {
    let unlisten = () => {}
    listenDeepLinks((url) => {
      const route = `${url.hostname}${url.pathname}`.replace(/\/+$/, "")
      const p = url.searchParams
      if (route === "auth/callback") {
        const code = p.get("code")
        if (!code) return toast.error("Sign-in didn't complete", { description: OAUTH_ERRORS[p.get("error")] ?? OAUTH_ERRORS.google })
        exchangeDesktopCode(code)
          .then(() => { toast.success("Signed in with Google"); navigate("/", { replace: true }) })
          .catch((e) => toast.error("Sign-in didn't complete", { description: e.message }))
      } else if (route === "integrations/callback") {
        navigate(`/settings/integrations?${p}`, { replace: true })
      }
    }).then((fn) => { unlisten = fn })
    return () => unlisten()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

// Blocks the shell until the first bootstrap payload arrives; shows a retry if the API is down
function RequireData({ children }) {
  const { isLoading, isError, error, refetch, tasks } = useAppStore()
  if (isLoading) return <FullScreenSpinner label="Loading your workspace…" />
  if (isError && !tasks.length) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-md">
          <ErrorState title="Couldn't reach the Welya API" description={error?.message} onRetry={() => refetch()} />
        </div>
      </div>
    )
  }
  return children
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppStoreProvider>
          <TooltipProvider>
            <BrowserRouter>
              <DeepLinkListener />
              <Routes>
                <Route element={<AuthLayout />}>
                  <Route path="login" element={<LoginPage />} />
                  <Route path="register" element={<RegisterPage />} />
                  <Route path="forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="reset-password" element={<ResetPasswordPage />} />
                  <Route path="verify-email" element={<VerifyEmailPage />} />
                  <Route path="auth/callback" element={<AuthCallbackPage />} />
                </Route>
                <Route
                  element={
                    <RequireAuth>
                      <RequireData>
                        <AppShell />
                      </RequireData>
                    </RequireAuth>
                  }
                >
                <Route index element={<HomePage />} />
                <Route path="inbox" element={<InboxPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="courses" element={<CoursesPage />} />
                <Route path="courses/:id" element={<CourseDetailPage />} />
                <Route path="workspaces" element={<WorkspacesPage />} />
                <Route path="workspaces/:id" element={<WorkspaceDetailPage />} />
                <Route path="assistant" element={<AssistantPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="review" element={<ReviewPage />} />
                <Route path="settings" element={<SettingsLayout />}>
                  <Route index element={<AccountSettings />} />
                  <Route path="ai" element={<AISettings />} />
                  <Route path="notifications" element={<NotificationSettings />} />
                  <Route path="appearance" element={<AppearanceSettings />} />
                  <Route path="privacy" element={<PrivacySettings />} />
                  <Route path="integrations" element={<IntegrationsSettings />} />
                </Route>
                <Route path="home" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </AppStoreProvider>
      </AuthProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />}
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App;
