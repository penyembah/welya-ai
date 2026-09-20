import * as React from "react"
import { useAppStore } from "@/store/app-store"

// Reflects the real bootstrap fetch; pages keep their skeleton states without a fake timer.
export function useSimulatedLoading() {
  const { isLoading } = useAppStore()
  return isLoading
}

// Tracks a pending submit; persistence itself happens via dispatch / mutations.
export function useAsyncAction() {
  const [pending, setPending] = React.useState(false)
  const run = React.useCallback(async (fn, ms = 0) => {
    setPending(true)
    if (ms) await new Promise((r) => setTimeout(r, ms))
    try {
      return await fn()
    } finally {
      setPending(false)
    }
  }, [])
  return [pending, run]
}
