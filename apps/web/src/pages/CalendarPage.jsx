import * as React from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useAppStore } from "@/store/app-store"
import { useSimulatedLoading } from "@/hooks/use-simulated-loading"
import { PageHeader } from "@/components/welya/page-primitives"
import { ScheduleTimeline, TimelineItem } from "@/components/welya/ScheduleTimeline"
import { EVENT_TYPE_META, CourseDot } from "@/components/welya/meta"
import { EventDialog } from "@/components/welya/forms"
import { EventDetailSheet } from "@/components/welya/EventDetailSheet"
import { usePlanMutation } from "@/hooks/use-welya-api"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { fmtTime, formatDuration, weekStart } from "@/lib/dates"
import { withDeadlines } from "@/lib/schedule"
import { CalendarIcon, CalendarPlusIcon, ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from "lucide-react"

const VIEWS = ["day", "week", "month", "agenda"]

function PlanDialog({ open, onOpenChange, mode, date }) {
  const { dispatch, taskById } = useAppStore()
  const planMutation = usePlanMutation()
  const [plan, setPlan] = React.useState([])
  const [error, setError] = React.useState(null)
  const stage = planMutation.isPending ? "thinking" : "preview"

  React.useEffect(() => {
    if (!open) return
    setPlan([])
    setError(null)
    planMutation
      .mutateAsync({ scope: mode, date: mode === "day" ? date?.toISOString() : undefined })
      .then((res) => setPlan(res.days.flatMap((d) => d.sessions.map((s) => ({ ...s, keep: true, date: new Date(d.date) })))))
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  const kept = plan.filter((p) => p.keep)
  const total = kept.reduce((a, s) => a + (new Date(s.end) - new Date(s.start)) / 60000, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-primary" /> {mode === "week" ? "Plan my week" : "Plan my day"}
          </DialogTitle>
          <DialogDescription>Welya looked at your classes, deadlines, task durations and free time.</DialogDescription>
        </DialogHeader>
        {stage === "thinking" ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="size-3.5" /> Finding free slots between classes…</div>
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <p className="py-4 text-sm text-destructive">{error}</p>
        ) : plan.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No free slots of at least an hour were found, or there is nothing left to schedule.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">
              You have time for <span className="font-medium">{formatDuration(Math.round(total))}</span> of focused work across {kept.length} session{kept.length === 1 ? "" : "s"}. Untick anything you don't want.
            </p>
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {plan.map((s, i) => {
                const t = taskById[s.taskId]
                return (
                  <label key={i} className={cn("flex items-center gap-3 rounded-lg border p-2.5 text-sm", !s.keep && "opacity-50")}>
                    <Checkbox checked={s.keep} onCheckedChange={(v) => setPlan((p) => p.map((x, j) => (j === i ? { ...x, keep: !!v } : x)))} />
                    <div className="w-24 shrink-0 text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">{format(s.date, "EEE d MMM")}</div>
                      {fmtTime(s.start)}–{fmtTime(s.end)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{t?.title}</p>
                      <p className="text-xs text-muted-foreground">{t?.progress}% done · {t?.priority} priority</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}
        <DialogFooter showCloseButton>
          <Button
            disabled={stage !== "preview" || !kept.length}
            onClick={() => {
              dispatch({ type: "event/add-many", events: kept.map(({ keep, date, ...s }) => s) })
              toast.success(`${kept.length} work session${kept.length > 1 ? "s" : ""} added`)
              onOpenChange(false)
            }}
          >
            <CalendarPlusIcon data-icon="inline-start" /> Add to calendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MonthView({ date, onPickDay, events, onOpen }) {
  const start = weekStart(startOfMonth(date))
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start, end })
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const dayEvents = events.filter((e) => isSameDay(new Date(e.start), d)).sort((a, b) => new Date(a.start) - new Date(b.start))
          return (
            <div
              key={d.toISOString()}
              role="button"
              tabIndex={0}
              onClick={() => onPickDay(d)}
              onKeyDown={(e) => e.key === "Enter" && onPickDay(d)}
              className={cn("flex min-h-24 cursor-pointer flex-col gap-1 border-r border-b p-1.5 text-left transition-colors hover:bg-muted/40 [&:nth-child(7n)]:border-r-0", !isSameMonth(d, date) && "bg-muted/20 text-muted-foreground")}
            >
              <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs", isToday(d) && "bg-primary font-semibold text-primary-foreground")}>{format(d, "d")}</span>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    title={`${fmtTime(e.start)} ${e.title}`}
                    onClick={(ev) => { ev.stopPropagation(); onOpen(e) }}
                    className={cn("truncate rounded px-1 text-left text-[10px] leading-4 hover:brightness-95 dark:hover:brightness-110", EVENT_TYPE_META[e.type]?.className)}
                  >
                    {e.title}
                  </button>
                ))}
                {dayEvents.length > 3 && <span className="px-1 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({ date, events, onPickDay, onOpen }) {
  const start = weekStart(date)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((d) => {
        const dayEvents = events.filter((e) => isSameDay(new Date(e.start), d)).sort((a, b) => new Date(a.start) - new Date(b.start))
        return (
          <div key={d.toISOString()} className={cn("rounded-xl border p-2", isToday(d) && "border-primary/40 bg-primary/5")}>
            <button type="button" onClick={() => onPickDay(d)} className="mb-2 flex w-full items-baseline justify-between text-left">
              <span className="text-xs font-medium text-muted-foreground">{format(d, "EEE")}</span>
              <span className={cn("text-sm font-semibold", isToday(d) && "text-primary")}>{format(d, "d")}</span>
            </button>
            <div className="space-y-1">
              {dayEvents.length === 0 && <p className="py-3 text-center text-[11px] text-muted-foreground">—</p>}
              {dayEvents.map((e) => (
                <button key={e.id} type="button" onClick={() => onOpen(e)} className={cn("block w-full rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight hover:brightness-95 dark:hover:brightness-110", EVENT_TYPE_META[e.type]?.className)}>
                  <div className="flex items-center gap-1 font-medium">{fmtTime(e.start)} {e.aiPlanned && <SparklesIcon className="size-2.5" />}</div>
                  <div className="truncate">{e.title}</div>
                  {e.location && <div className="truncate opacity-70">{e.location}</div>}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AgendaView({ date, events, onOpen }) {
  const days = Array.from({ length: 10 }, (_, i) => addDays(date, i))
  return (
    <div className="space-y-4">
      {days.map((d) => {
        const dayEvents = events.filter((e) => isSameDay(new Date(e.start), d)).sort((a, b) => new Date(a.start) - new Date(b.start))
        if (!dayEvents.length) return null
        return (
          <div key={d.toISOString()} className="grid gap-2 md:grid-cols-[140px_1fr]">
            <div className={cn("text-sm font-medium", isToday(d) && "text-primary")}>{isToday(d) ? "Today" : format(d, "EEEE")}<div className="text-xs font-normal text-muted-foreground">{format(d, "d MMMM")}</div></div>
            <div className="space-y-1.5">{dayEvents.map((e) => <TimelineItem key={e.id} item={e} onOpen={onOpen} />)}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function CalendarPage() {
  const { events, tasks, courses } = useAppStore()
  const [params, setParams] = useSearchParams()
  const loading = useSimulatedLoading()
  const view = VIEWS.includes(params.get("view")) ? params.get("view") : "month"
  const [date, setDate] = React.useState(new Date())
  const [eventOpen, setEventOpen] = React.useState(false)
  const [planMode, setPlanMode] = React.useState(null)
  const [typeFilter, setTypeFilter] = React.useState(null)
  const [selectedId, setSelectedId] = React.useState(null)

  const setView = (v) => setParams({ view: v })
  const shift = (dir) => setDate((d) => (view === "month" ? addMonths(d, dir) : view === "week" ? addWeeks(d, dir) : addDays(d, dir)))
  const allItems = React.useMemo(() => withDeadlines(events, tasks), [events, tasks])
  const visible = typeFilter ? allItems.filter((e) => e.type === typeFilter) : allItems
  // Look the selection up by id so the sheet reflects edits/deletes made while it is open
  const selected = allItems.find((e) => e.id === selectedId) ?? null
  const openEvent = (e) => setSelectedId(e.id)
  // Day view asks the planner what it would do with this day's free time
  const dayKey = format(date, "yyyy-MM-dd")
  const planQuery = useQuery({ queryKey: ["ai", "plan", dayKey, events.length], queryFn: () => api.post("/ai/plan", { scope: "day", date: date.toISOString() }), enabled: view === "day", staleTime: 30_000 })
  const todayPlan = planQuery.data?.days?.[0] ?? { slots: [], sessions: [], totalFree: 0 }
  const label = view === "month" ? format(date, "MMMM yyyy") : view === "week" ? `${format(weekStart(date), "d MMM")} – ${format(addDays(weekStart(date), 6), "d MMM yyyy")}` : format(date, "EEEE, d MMMM yyyy")

  return (
    <div className="space-y-5">
      <PageHeader
        title="Calendar"
        description="Classes, deadlines and planned work in one place. Welya turns your free time into progress."
        actions={
          <>
            <Button variant="outline" onClick={() => setEventOpen(true)}><CalendarPlusIcon data-icon="inline-start" /> Add event</Button>
            <Button variant="outline" onClick={() => setPlanMode("day")}><SparklesIcon data-icon="inline-start" /> Plan my day</Button>
            <Button onClick={() => setPlanMode("week")}><SparklesIcon data-icon="inline-start" /> Plan my week</Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-1.5">
          <Button size="icon-sm" variant="outline" onClick={() => shift(-1)} aria-label="Previous"><ChevronLeftIcon /></Button>
          <Button size="icon-sm" variant="outline" onClick={() => shift(1)} aria-label="Next"><ChevronRightIcon /></Button>
          <Button size="sm" variant="ghost" onClick={() => setDate(new Date())}>Today</Button>
          <Popover>
            <PopoverTrigger render={<Button size="sm" variant="ghost" className="font-heading text-base font-medium" />}>
              <CalendarIcon data-icon="inline-start" className="text-muted-foreground" /> {label}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
            </PopoverContent>
          </Popover>
        </div>
        <Tabs value={view} onValueChange={setView}>
          <TabsList>{VIEWS.map((v) => <TabsTrigger key={v} value={v} className="capitalize">{v}</TabsTrigger>)}</TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {Object.entries(EVENT_TYPE_META).filter(([k]) => k !== "free").map(([k, m]) => (
          <Badge key={k} variant="outline" className={cn("cursor-pointer", typeFilter === k ? m.className : "hover:bg-muted")} render={<button type="button" onClick={() => setTypeFilter(typeFilter === k ? null : k)} />}>
            {m.label}
          </Badge>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
        {courses.map((c) => <span key={c.id} className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CourseDot color={c.color} /> {c.code}</span>)}
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : view === "month" ? (
        <MonthView date={date} events={visible} onPickDay={(d) => { setDate(d); setView("day") }} onOpen={openEvent} />
      ) : view === "week" ? (
        <WeekView date={date} events={visible} onPickDay={(d) => { setDate(d); setView("day") }} onOpen={openEvent} />
      ) : view === "agenda" ? (
        <AgendaView date={date} events={visible} onOpen={openEvent} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{isToday(date) ? "Today" : format(date, "EEEE")}</CardTitle>
              <CardDescription>{format(date, "d MMMM yyyy")}</CardDescription>
            </CardHeader>
            <CardContent><ScheduleTimeline date={date} onOpen={openEvent} /></CardContent>
          </Card>
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><SparklesIcon className="size-4 text-primary" /> Free time</CardTitle>
              <CardDescription>{planQuery.isLoading ? "Checking your free time…" : todayPlan.slots.length ? `${formatDuration(Math.round(todayPlan.totalFree))} available between 08:00–18:00.` : "No free hour-long slots on this day."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {planQuery.isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
              {todayPlan.slots.map((s, i) => <div key={i} className="flex items-center justify-between rounded-md border border-dashed bg-background px-2.5 py-1.5"><span>{fmtTime(s.start)}–{fmtTime(s.end)}</span><span className="text-xs text-muted-foreground">{formatDuration(Math.round((new Date(s.end) - new Date(s.start)) / 60000))}</span></div>)}
              {todayPlan.sessions.length > 0 && (
                <>
                  <p className="pt-2 text-xs text-muted-foreground">Welya recommends:</p>
                  {todayPlan.sessions.map((s, i) => <p key={i} className="text-xs">• {fmtTime(s.start)}–{fmtTime(s.end)} {s.title.replace("Work on: ", "")}</p>)}
                  <Button size="sm" className="mt-2 w-full" onClick={() => setPlanMode("day")}><SparklesIcon data-icon="inline-start" /> Plan this day</Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <EventDialog open={eventOpen} onOpenChange={setEventOpen} defaults={{ date }} />
      <EventDetailSheet event={selected} open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)} />
      <PlanDialog open={!!planMode} onOpenChange={(o) => !o && setPlanMode(null)} mode={planMode} date={date} />
    </div>
  )
}
