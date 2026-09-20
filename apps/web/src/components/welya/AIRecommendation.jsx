import * as React from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useWelyaActions } from "@/components/welya/AIChat"
import { useRecommendationsQuery } from "@/hooks/use-welya-api"
import { ErrorState } from "@/components/welya/page-primitives"
import { AlertTriangleIcon, CalendarClockIcon, CheckIcon, InboxIcon, SparklesIcon, XIcon } from "lucide-react"

const ICONS = { CalendarClock: CalendarClockIcon, AlertTriangle: AlertTriangleIcon, Inbox: InboxIcon }

export function useRecommendations() {
  const query = useRecommendationsQuery()
  return { ...query, recommendations: query.data?.recommendations ?? [] }
}

const TONE = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  destructive: "bg-destructive/10 text-destructive",
  default: "bg-muted text-muted-foreground",
}

export function AIRecommendation({ rec, onDismiss, className }) {
  const run = useWelyaActions()
  const [done, setDone] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const Icon = ICONS[rec.icon] ?? SparklesIcon
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border bg-card p-3", className)}>
      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TONE[rec.tone])}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium leading-snug">{rec.title}</p>
        <p className="text-xs text-muted-foreground">{rec.body}</p>
        <div className="flex items-center gap-1.5 pt-1">
          <Button
            size="xs"
            variant={rec.tone === "primary" ? "default" : "outline"}
            disabled={done || busy}
            onClick={async () => {
              setBusy(true)
              try {
                await run(rec.action)
                if (rec.action.kind === "plan") setDone(true)
              } finally {
                setBusy(false)
              }
            }}
          >
            {done && <CheckIcon data-icon="inline-start" />}
            {rec.action.label}
          </Button>
          {onDismiss && (
            <Button size="xs" variant="ghost" onClick={() => onDismiss(rec.id)}>
              Dismiss
            </Button>
          )}
        </div>
      </div>
      {onDismiss && (
        <Button size="icon-xs" variant="ghost" className="-mr-1 -mt-1" aria-label="Dismiss" onClick={() => onDismiss(rec.id)}>
          <XIcon />
        </Button>
      )}
    </div>
  )
}

export function AIRecommendationsCard({ limit = 4, className }) {
  const { recommendations: recs, isLoading, isError, refetch } = useRecommendations()
  const [dismissed, setDismissed] = React.useState([])
  const navigate = useNavigate()
  const visible = recs.filter((r) => !dismissed.includes(r.id)).slice(0, limit)

  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-primary" /> Welya recommends
        </CardTitle>
        <CardDescription>Based on your deadlines, classes and free time.</CardDescription>
        <CardAction>
          <Button size="sm" variant="ghost" onClick={() => navigate("/assistant")}>
            Ask Welya
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <>
            <AIRecommendationSkeleton />
            <AIRecommendationSkeleton />
          </>
        ) : isError ? (
          <ErrorState title="Couldn't load recommendations" onRetry={() => refetch()} />
        ) : visible.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            <CheckIcon className="size-4 text-emerald-500" /> Nothing needs your attention right now.
            <Button size="xs" variant="link" className="ml-auto" onClick={() => setDismissed([])}>
              Show all
            </Button>
          </div>
        ) : (
          visible.map((rec) => (
            <AIRecommendation
              key={rec.id}
              rec={rec}
              onDismiss={(id) => {
                setDismissed((d) => [...d, id])
                toast("Recommendation dismissed")
              }}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function AIRecommendationSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      <Skeleton className="size-8 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-6 w-24 rounded-md" />
      </div>
    </div>
  )
}
