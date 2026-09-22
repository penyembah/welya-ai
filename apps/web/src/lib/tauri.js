// Desktop (Tauri) helpers. Every function is a no-op or falls back to browser behaviour on the web.

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

// OAuth must happen in the system browser: Google blocks sign-in inside embedded webviews.
export async function openExternal(url) {
  if (!isTauri()) return window.location.assign(url)
  const { openUrl } = await import("@tauri-apps/plugin-opener")
  await openUrl(url)
}

// Calls `handler(URL)` for every welya:// link that opens the app, including the one that launched it.
export async function listenDeepLinks(handler) {
  if (!isTauri()) return () => {}
  const { onOpenUrl, getCurrent } = await import("@tauri-apps/plugin-deep-link")
  const deliver = (urls) => {
    for (const raw of urls ?? []) {
      try {
        handler(new URL(raw))
      } catch {
        /* ignore malformed links */
      }
    }
  }
  deliver(await getCurrent().catch(() => null))
  return onOpenUrl(deliver)
}
