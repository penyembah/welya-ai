import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { api, tokenStore, refreshSession, API_URL } from "@/lib/api"
import { isTauri, openExternal } from "@/lib/tauri"

const AuthContext = React.createContext(null)

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [token, setToken] = React.useState(null)
  const [user, setUser] = React.useState(null)
  const [ready, setReady] = React.useState(false)

  const signOut = React.useCallback(() => {
    void api.post("/auth/logout", {}, { auth: false }).catch(() => {})
    tokenStore.clear()
    setToken(null)
    setUser(null)
    setReady(true)
    queryClient.clear()
  }, [queryClient])

  // Restore the short-lived access token from the httpOnly refresh cookie.
  // refreshSession() is single-flight, so StrictMode's double effect shares one rotation.
  React.useEffect(() => {
    let cancelled = false
    refreshSession()
      .then((r) => !cancelled && establish(r))
      .catch(() => !cancelled && tokenStore.clear())
      .finally(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    window.addEventListener("welya:unauthorized", signOut)
    return () => window.removeEventListener("welya:unauthorized", signOut)
  }, [signOut])

  const establish = ({ token: t, user: u }) => {
    tokenStore.set(t)
    setToken(t)
    setUser(u)
    setReady(true)
  }

  const login = async ({ email, password }) => {
    try {
      establish(await api.post("/auth/login", { email, password }, { auth: false }))
    } catch (e) {
      if (e.code === "unverified") {
        const err = new Error(e.message)
        err.code = "unverified"
        throw err
      }
      throw e
    }
  }

  const register = (payload) => api.post("/auth/register", payload, { auth: false })
  const verifyEmail = async ({ email, code }) => establish(await api.post("/auth/verify", { email, code }, { auth: false }))
  const resendCode = ({ email }) => api.post("/auth/resend", { email }, { auth: false })
  const requestPasswordReset = ({ email }) => api.post("/auth/forgot", { email }, { auth: false })
  const resetPassword = ({ token: t, password }) => api.post("/auth/reset", { token: t, password }, { auth: false })
  const updateUser = (patch) => setUser((u) => ({ ...u, ...patch }))

  // Google OAuth. Web: the API redirects to Google and back to /auth/callback#token=…
  // Desktop: Google refuses embedded webviews, so the flow runs in the system browser and returns via welya://auth/callback?code=…
  const loginWithGoogle = () => openExternal(`${API_URL}/api/auth/google${isTauri() ? "?client=desktop" : ""}`)
  const completeOAuth = async (t) => {
    tokenStore.set(t)
    try {
      const r = await api.get("/auth/me")
      establish({ token: t, user: r.user })
    } catch (e) {
      tokenStore.clear()
      throw e
    }
  }
  const exchangeDesktopCode = async (code) => establish(await api.post("/auth/exchange", { code }, { auth: false }))

  const value = React.useMemo(
    () => ({ session: user, user, token, ready, isAuthenticated: !!token, login, register, verifyEmail, resendCode, requestPasswordReset, resetPassword, loginWithGoogle, completeOAuth, exchangeDesktopCode, logout: signOut, updateUser }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, token, ready, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
