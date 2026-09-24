import * as React from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAppStore } from "@/store/app-store"
import { useSimulatedLoading } from "@/hooks/use-simulated-loading"
import { PageHeader, EmptyState, ListSkeleton } from "@/components/welya/page-primitives"
import { relativeTime } from "@/lib/dates"
import { AlertTriangleIcon, BellIcon, BellOffIcon, BookOpenIcon, CalendarIcon, CheckCheckIcon, ClockIcon, InboxIcon, LayoutListIcon, LinkIcon, SparklesIcon } from "lucide-react"

const TYPE_META = {
  task: { label: "Tasks", Icon: LayoutListIcon, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  deadline: { label: "Deadline", Icon: ClockIcon, className: "bg-primary/10 text-primary" },
  missed: { label: "Missed", Icon: AlertTriangleIcon, className: "bg-destructive/10 text-destructive" },
  class: { label: "Class", Icon: BookOpenIcon, className: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  calendar: { label: "Calendar", Icon: CalendarIcon, className: "bg-muted text-muted-foreground" },
  ai: { label: "Welya", Icon: SparklesIcon, className: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  inbox: { label: "Inbox", Icon: InboxIcon, className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  integration: { label: "Integrations", Icon: LinkIcon, className: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
}

export default function NotificationsPage() {
  const { notifications, dispatch } = useAppStore()
  const navigate = useNavigate()
  const loading = useSimulatedLoading(400)
  const [filter, setFilter] = React.useState("all")
  const [read, setRead] = React.useState("all")
  const unread = notifications.filter((n) => !n.read).length

  const filtered = notifications
    .filter((n) => (filter === "all" ? true : n.type === filter))
    .filter((n) => (read === "all" ? true : read === "unread" ? !n.read : n.read))
    .sort((a, b) => new Date(b.time) - new Date(a.time))

  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" description="Deadlines, class reminders, inbox updates and Welya's suggestions." actions={<Button variant="outline" disabled={!unread} onClick={() => { dispatch({ type: "notification/read-all" }); toast("All notifications marked as read") }}><CheckCheckIcon data-icon="inline-start" /> Mark all as read</Button>} />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">All</TabsTrigger>
            {Object.entries(TYPE_META).map(([k, m]) => <TabsTrigger key={k} value={k}>{m.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <Tabs value={read} onValueChange={setRead}>
          <TabsList variant="line"><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="unread">Unread <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{unread}</Badge></TabsTrigger><TabsTrigger value="read">Read</TabsTrigger></TabsList>
        </Tabs>
      </div>

      {loading ? <ListSkeleton rows={5} /> : filtered.length === 0 ? (
        <EmptyState icon={read === "unread" ? CheckCheckIcon : BellOffIcon} title={read === "unread" ? "You're all caught up" : "No notifications"} description="Welya will let you know when something needs your attention." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {filtered.map((n) => {
            const m = TYPE_META[n.type] ?? TYPE_META.calendar
            return (
              <button key={n.id} type="button" onClick={() => { dispatch({ type: "notification/read", id: n.id }); navigate(n.link ?? "/") }} className={cn("flex w-full items-start gap-3 border-b p-3 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/40", !n.read && "bg-primary/[0.03]")}>
                <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", m.className)}><m.Icon className="size-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><p className={cn("truncate", !n.read && "font-semibold")}>{n.title}</p>{!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}</div>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{m.label} · {relativeTime(n.time)}</p>
                </div>
                <BellIcon className="mt-1 size-3.5 shrink-0 text-muted-foreground/50" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
