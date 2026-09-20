import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSimulatedLoading } from "@/hooks/use-simulated-loading"
import { PageHeader, StatCard, StatCardSkeleton } from "@/components/welya/page-primitives"
import { WeeklyReview, WorkloadChart, CourseActivityList, useWeeklyStats } from "@/components/welya/WeeklyReview"
import { TaskRowCompact } from "@/components/welya/TaskCard"
import { TaskDetailSheet } from "@/components/welya/TaskDetailSheet"
import { formatDuration } from "@/lib/dates"
import { AlertTriangleIcon, CheckCircle2Icon, ClockIcon, LayoutListIcon } from "lucide-react"

export default function ReviewPage() {
  const s = useWeeklyStats()
  const loading = useSimulatedLoading(500)
  const [taskId, setTaskId] = React.useState(null)
  const completed = s.completedLastWeek.length + s.completedThisWeek.length

  return (
    <div className="space-y-5">
      <PageHeader title="Weekly review" description="A personal look back at your week — not a dashboard, just what matters for your studies." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : (
          <>
            <StatCard label="Completed" value={completed} hint="Last 7 days" icon={CheckCircle2Icon} tone="success" />
            <StatCard label="Remaining" value={s.remaining.length} hint="Open tasks" icon={LayoutListIcon} />
            <StatCard label="Overdue" value={s.overdue.length} icon={AlertTriangleIcon} tone={s.overdue.length ? "destructive" : "default"} />
            <StatCard label="Due this week" value={s.dueThisWeek.length} hint={`${formatDuration(Math.round(s.plannedMinutes))} planned`} icon={ClockIcon} tone="primary" />
          </>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <WeeklyReview className="lg:col-span-2" />
        <Card>
          <CardHeader><CardTitle>Planned vs completed</CardTitle><CardDescription>This week</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between"><div><p className="text-xs text-muted-foreground">Planned</p><p className="font-heading text-2xl font-semibold">{formatDuration(Math.round(s.plannedMinutes))}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Completed</p><p className="font-heading text-2xl font-semibold">{formatDuration(Math.round(s.completedMinutes))}</p></div></div>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              <div className="bg-primary" style={{ width: `${Math.min(100, (s.completedMinutes / Math.max(1, s.plannedMinutes + s.completedMinutes)) * 100)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Welya schedules planned sessions in your free time; completed time comes from finished tasks.</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Weekly workload</CardTitle><CardDescription>Classes, work sessions and deadlines per day.</CardDescription></CardHeader>
          <CardContent><WorkloadChart days={s.days} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Course activity</CardTitle><CardDescription>Completed tasks per course.</CardDescription></CardHeader>
          <CardContent><CourseActivityList perCourse={s.perCourse} /></CardContent>
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Coming up this week</CardTitle></CardHeader>
          <CardContent className="space-y-0.5">{s.dueThisWeek.length === 0 ? <p className="text-sm text-muted-foreground">No deadlines this week.</p> : s.dueThisWeek.map((t) => <TaskRowCompact key={t.id} task={t} onOpen={(x) => setTaskId(x.id)} />)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recently completed</CardTitle></CardHeader>
          <CardContent className="space-y-0.5">{[...s.completedLastWeek, ...s.completedThisWeek].length === 0 ? <p className="text-sm text-muted-foreground">Nothing completed yet.</p> : [...s.completedThisWeek, ...s.completedLastWeek].map((t) => <TaskRowCompact key={t.id} task={t} onOpen={(x) => setTaskId(x.id)} />)}</CardContent>
        </Card>
      </div>
      <TaskDetailSheet taskId={taskId} open={!!taskId} onOpenChange={(o) => !o && setTaskId(null)} />
    </div>
  )
}
