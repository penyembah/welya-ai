import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useAppStore } from "@/store/app-store"
import { CourseDot } from "@/components/welya/meta"
import { ErrorState } from "@/components/welya/page-primitives"
import { useWeeklyReviewQuery } from "@/hooks/use-welya-api"
import { Markdown } from "@/components/welya/Markdown"
import { WEEKDAYS, weekStart } from "@/lib/dates"
import { addDays, isSameDay, isWithinInterval, subDays } from "date-fns"
import { SparklesIcon } from "lucide-react"

export function useWeeklyStats() {
  const { tasks, events, courses } = useAppStore()
  return React.useMemo(() => {
    const now = new Date()
    const lastWeekStart = subDays(weekStart(now), 7)
    const lastWeekEnd = subDays(weekStart(now), 1)
    const thisWeekStart = weekStart(now)
    const thisWeekEnd = addDays(thisWeekStart, 6)

    const completedLastWeek = tasks.filter((t) => t.completedAt && isWithinInterval(new Date(t.completedAt), { start: lastWeekStart, end: addDays(lastWeekEnd, 1) }))
    const completedThisWeek = tasks.filter((t) => t.completedAt && new Date(t.completedAt) >= thisWeekStart)
    const remaining = tasks.filter((t) => t.status !== "done")
    const overdue = remaining.filter((t) => new Date(t.deadline) < now)
    const dueThisWeek = remaining.filter((t) => isWithinInterval(new Date(t.deadline), { start: now, end: addDays(thisWeekEnd, 1) }))

    const days = WEEKDAYS.map((label, i) => {
      const date = addDays(thisWeekStart, i)
      const classes = events.filter((e) => e.type === "class" && isSameDay(new Date(e.start), date)).length
      const sessions = events.filter((e) => e.type === "work-session" && isSameDay(new Date(e.start), date)).length
      const deadlines = tasks.filter((t) => isSameDay(new Date(t.deadline), date) && t.status !== "done").length
      const load = Math.min(100, classes * 25 + sessions * 20 + deadlines * 30)
      return { label, date, classes, sessions, deadlines, load, isToday: isSameDay(date, now) }
    })

    const perCourse = courses.map((c) => {
      const ct = tasks.filter((t) => t.courseId === c.id)
      const done = ct.filter((t) => t.status === "done").length
      return { course: c, total: ct.length, done, open: ct.length - done, pct: ct.length ? Math.round((done / ct.length) * 100) : 0 }
    })

    const plannedMinutes = events.filter((e) => e.type === "work-session" && new Date(e.start) >= thisWeekStart).reduce((a, e) => a + (new Date(e.end) - new Date(e.start)) / 60000, 0)
    const completedMinutes = completedThisWeek.reduce((a, t) => a + (t.estimatedMinutes || 0), 0) + completedLastWeek.reduce((a, t) => a + (t.estimatedMinutes || 0), 0)

    return { completedLastWeek, completedThisWeek, remaining, overdue, dueThisWeek, days, perCourse, plannedMinutes, completedMinutes }
  }, [tasks, events, courses])
}

export function WeeklyReview({ className }) {
  const { data, isLoading, isError, refetch } = useWeeklyReviewQuery()
  const paragraphs = data?.paragraphs ?? []

  return (
    <Card className={cn("border-primary/20 bg-linear-to-br from-primary/5 to-transparent", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-primary" /> Welya's weekly review
        </CardTitle>
        <CardDescription>A short read on how your week went and what's coming.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : isError ? (
          <ErrorState title="Couldn't generate your review" onRetry={() => refetch()} />
        ) : (
          paragraphs.map((p, i) => (
            <Markdown key={i} className={cn(i === paragraphs.length - 1 && "text-muted-foreground")}>
              {p}
            </Markdown>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function WorkloadChart({ days, className }) {
  return (
    <div className={cn("grid grid-cols-7 gap-2", className)}>
      {days.map((d) => (
        <div key={d.label} className="flex flex-col items-center gap-1.5">
          <div className="flex h-28 w-full items-end rounded-md bg-muted/50 p-1">
            <div
              className={cn("w-full rounded-sm transition-all", d.isToday ? "bg-primary" : "bg-primary/40")}
              style={{ height: `${Math.max(6, d.load)}%` }}
              title={`${d.classes} classes · ${d.sessions} sessions · ${d.deadlines} deadlines`}
            />
          </div>
          <span className={cn("text-[11px]", d.isToday ? "font-semibold text-foreground" : "text-muted-foreground")}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export function CourseActivityList({ perCourse, className }) {
  return (
    <div className={cn("space-y-3", className)}>
      {perCourse.map(({ course, total, done, pct }) => (
        <div key={course.id} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2">
              <CourseDot color={course.color} /> {course.name}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {done}/{total} done
            </span>
          </div>
          <Progress value={pct}>
            <span className="sr-only">{pct}%</span>
          </Progress>
        </div>
      ))}
    </div>
  )
}
