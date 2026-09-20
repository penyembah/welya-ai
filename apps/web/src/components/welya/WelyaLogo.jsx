import { cn } from "@/lib/utils"

export function WelyaLogo({ className, ...props }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className={cn("size-5", className)} {...props}>
      <path d="M8 16l9 32 10-20" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M27 28l10 20 9-32" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      <path d="M56 16h0" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}
