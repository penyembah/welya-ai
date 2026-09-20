import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAppStore } from "@/store/app-store"
import { useSimulatedLoading } from "@/hooks/use-simulated-loading"
import { PageHeader, StatCard, StatCardSkeleton, EmptyState, ListSkeleton } from "@/components/welya/page-primitives"
import { ScheduleTimeline, ScheduleTimelineSkeleton } from "@/components/welya/ScheduleTimeline"
import { TaskCard } from "@/components/welya/TaskCard"
import { TaskDetailSheet } from "@/components/welya/TaskDetailSheet"
import { AIRecommendationsCard } from "@/components/welya/AIRecommendation"
import { DeadlineCard } from "@/components/welya/cards"
import { TaskDialog, EventDialog, NoteDialog } from "@/components/welya/forms"
import { UploadDialog } from "@/components/welya/UploadDialog"
import { isDueToday, isOverdue } from "@/lib/dates"
import { addDays, isSameDay } from "date-fns"
import {
  ArrowRightIcon,
  BookOpenIcon,
  CalendarPlusIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClockIcon,
  InboxIcon,
  LayoutListIcon,
  PlusIcon,
  SparklesIcon,
  StickyNoteIcon,
  TimerIcon,
  UploadIcon,
} from "lucide-react"

function greeting() {
  const h = new Date().getHours()
  if (h < 11) return "Good morning"
  if (h < 15) return "Good afternoon"
  if (h < 19) return "Good evening"
  return "Good night"
}

export function QuickActions({ courseId, workspaceId }) {
  const navigate = useNavigate()
  const [dialog, setDialog] = React.useState(null)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" /> Quick add <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setDialog("task")}>
            <LayoutListIcon /> Add task
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("note")}>
            <StickyNoteIcon /> Add note
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("event")}>
            <CalendarPlusIcon /> Add event
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("upload")}>
            <UploadIcon /> Upload document
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/inbox")}>
            <InboxIcon /> Process inbox
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/assistant")}>
            <SparklesIcon /> Ask Welya
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TaskDialog open={dialog === "task"} onOpenChange={(o) => !o && setDialog(null)} defaults={{ courseId: courseId ?? null, ...(workspaceId ? { workspaceId } : {}) }} />
      <NoteDialog open={dialog === "note"} onOpenChange={(o) => !o && setDialog(null)} defaults={{ courseId: courseId ?? null, ...(workspaceId ? { workspaceId } : {}) }} />
      <EventDialog open={dialog === "event"} onOpenChange={(o) => !o && setDialog(null)} defaults={{ courseId: courseId ?? null }} />
      <UploadDialog open={dialog === "upload"} onOpenChange={(o) => !o && setDialog(null)} defaults={{ courseId, workspaceId }} />
    </>
  )
}

export default function HomePage() {
  const { user, tasks, events, inboxItems } = useAppStore()
  const loading = useSimulatedLoading(600)
  const [taskId, setTaskId] = React.useState(null)
  const navigate = useNavigate()

  const today = new Date()
  const open = tasks.filter((t) => t.status !== "done")
  const dueToday = open.filter(isDueToday)
  const overdue = open.filter(isOverdue)
  const completedToday = tasks.filter((t) => t.completedAt && isSameDay(new Date(t.completedAt), today))
  const classesToday = events.filter((e) => e.type === "class" && isSameDay(new Date(e.start), today))
  const upcoming = open.filter((t) => new Date(t.deadline) > today && new Date(t.deadline) <= addDays(today, 7)).sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
  const priority = [...open].sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 }
    return p[a.priority] - p[b.priority] || new Date(a.deadline) - new Date(b.deadline)
  })
  const unprocessed = inboxItems.filter((i) => i.status === "unprocessed").length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={format(today, "EEEE, d MMMM yyyy")}
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        description={
          loading
            ? undefined
            : `${dueToday.length ? `${dueToday.length} task${dueToday.length > 1 ? "s" : ""} due today` : "No tasks due today"}, ${classesToday.length} class${classesToday.length === 1 ? "" : "es"}${unprocessed ? `, and ${unprocessed} inbox item${unprocessed > 1 ? "s" : ""} waiting for review` : ""}.`
        }
        actions={
          <>
            <Button variant="outline" render={<Link to="/inbox" />}>
              <InboxIcon data-icon="inline-start" /> Inbox
              {unprocessed > 0 && (
                <Badge className="ml-1 h-4 px-1.5 text-[10px]" variant="secondary">
                  {unprocessed}
                </Badge>
              )}
            </Button>
            <QuickActions />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Due today" value={dueToday.length} hint={overdue.length ? `${overdue.length} overdue` : "Nothing overdue"} icon={TimerIcon} tone={dueToday.length ? "primary" : "default"} />
            <StatCard label="Upcoming deadlines" value={upcoming.length} hint="Next 7 days" icon={ClockIcon} />
            <StatCard label="Classes today" value={classesToday.length} hint={classesToday[0] ? `First at ${format(new Date(classesToday[0].start), "HH:mm")}` : "Free day"} icon={BookOpenIcon} />
            <StatCard label="Completed" value={completedToday.length} hint="Today" icon={CheckCircle2Icon} tone="success" />
            <StatCard label="Remaining" value={open.length} hint="Open tasks" icon={LayoutListIcon} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Today's schedule</CardTitle>
              <CardDescription>Classes, deadlines and the time Welya has planned for you.</CardDescription>
              <CardAction>
                <Button size="sm" variant="ghost" render={<Link to="/calendar" />}>
                  Calendar <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>{loading ? <ScheduleTimelineSkeleton /> : <ScheduleTimeline date={today} emptyText="Nothing on the calendar today. A good day for deep work." />}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Priority tasks</CardTitle>
              <CardDescription>What deserves your attention first.</CardDescription>
              <CardAction>
                <Button size="sm" variant="ghost" render={<Link to="/tasks" />}>
                  All tasks <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <ListSkeleton rows={3} />
              ) : priority.length === 0 ? (
                <EmptyState icon={CheckCircle2Icon} title="All caught up" description="No open tasks. Welya will add new ones as they arrive in your inbox." />
              ) : (
                priority.slice(0, 4).map((t) => <TaskCard key={t.id} task={t} onOpen={(task) => setTaskId(task.id)} onBreakdown={(task) => setTaskId(task.id)} />)
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <AIRecommendationsCard />

          <Card>
            <CardHeader>
              <CardTitle>Upcoming deadlines</CardTitle>
              <CardDescription>Next 7 days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <ListSkeleton rows={3} />
              ) : upcoming.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No deadlines this week.</p>
              ) : (
                upcoming.slice(0, 5).map((t) => <DeadlineCard key={t.id} task={t} onOpen={(task) => setTaskId(task.id)} />)
              )}
            </CardContent>
          </Card>

          <Card size="sm" className="border-dashed">
            <CardContent className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <SparklesIcon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Ask Welya</p>
                <p className="truncate text-xs text-muted-foreground">“What should I focus on this afternoon?”</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/assistant")}>
                Open
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <TaskDetailSheet taskId={taskId} open={!!taskId} onOpenChange={(o) => !o && setTaskId(null)} />
    </div>
  )
}
