import axios from "axios"

let accessToken = null

// Resolution order: runtime config injected by the Docker entrypoint (window.__WELYA_CONFIG__), then the
// Vite build-time variable, then the local API. Lets one image serve any environment.
export const API_URL = (globalThis.__WELYA_CONFIG__?.apiUrl || import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "")

export const tokenStore = {
  get: () => accessToken,
  set: (t) => { accessToken = t },
  clear: () => { accessToken = null },
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
    this.code = body?.code
  }
}

export const http = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  withCredentials: true,
  headers: { Accept: "application/json" },
})

// Attach bearer token unless the call opted out with `skipAuth: true`
http.interceptors.request.use((config) => {
  if (!config.skipAuth) {
    const token = tokenStore.get()
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Normalise every failure into ApiError and broadcast expired sessions
http.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    if (!error.response) {
      return Promise.reject(new ApiError("Can't reach the Welya server. Is the API running?", 0))
    }
    const { status, data, config } = error.response
    if (status === 401 && !config?.skipAuth && !config?._retry && !config?.url?.endsWith("/auth/refresh")) {
      config._retry = true
      try {
        const refreshed = await refreshSession()
        config.headers.Authorization = `Bearer ${refreshed.token}`
        return http(config)
      } catch {
        tokenStore.clear()
        window.dispatchEvent(new Event("welya:unauthorized"))
      }
    }
    return Promise.reject(new ApiError(data?.message ?? error.message, status, data))
  }
)

// The refresh cookie rotates on every use, so concurrent callers (StrictMode double effects,
// several 401s at once) must share one in-flight request or the second one hits a revoked token.
let refreshInFlight = null
export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = http
      .post("/auth/refresh", {}, { skipAuth: true })
      .then((r) => {
        tokenStore.set(r.token)
        return r
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

const opts = (o) => (o && o.auth === false ? { skipAuth: true } : undefined)

export const api = {
  get: (path, o) => http.get(path, opts(o)),
  post: (path, body, o) => http.post(path, body, opts(o)),
  patch: (path, body, o) => http.patch(path, body, opts(o)),
  delete: (path, o) => http.delete(path, opts(o)),
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
