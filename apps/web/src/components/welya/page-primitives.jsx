import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangleIcon, RefreshCwIcon, SparklesIcon } from "lucide-react"

export function PageHeader({ title, description, eyebrow, actions, className, children }) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-start md:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{eyebrow}</p>}
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default", className }) {
  return (
    <Card size="sm" className={cn("gap-2", className)}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-heading text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              tone === "primary" && "bg-primary/10 text-primary",
              tone === "destructive" && "bg-destructive/10 text-destructive",
              tone === "success" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
              tone === "default" && "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="size-4" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function StatCardSkeleton() {
  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-12" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  )
}

export function EmptyState({ icon: Icon = SparklesIcon, title, description, action, className }) {
  return (
    <Empty className={cn("border py-10", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}

export function ErrorState({ title = "Something went wrong", description, onRetry, className }) {
  return (
    <Alert variant="destructive" className={cn(className)}>
      <AlertTriangleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description ?? "Welya couldn't load this section. Try again in a moment."}</AlertDescription>
      {onRetry && (
        <AlertAction>
          <Button size="xs" variant="outline" onClick={onRetry}>
            <RefreshCwIcon data-icon="inline-start" />
            Retry
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}

export function ListSkeleton({ rows = 4, className }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
          <Skeleton className="size-8 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function SectionTitle({ title, description, action, className }) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <div>
        <h2 className="font-heading text-base font-medium">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
