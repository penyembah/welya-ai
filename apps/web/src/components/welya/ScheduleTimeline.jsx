import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAppStore } from "@/store/app-store"
import { EVENT_TYPE_META, CourseDot } from "@/components/welya/meta"
import { fmtTime } from "@/lib/dates"
import { freeSlotsFor, withDeadlines } from "@/lib/schedule"
import { isSameDay } from "date-fns"
import { MapPinIcon, SparklesIcon } from "lucide-react"

export function useDayTimeline(date) {
  const { events, tasks } = useAppStore()
  const dayEvents = withDeadlines(events, tasks).filter((e) => isSameDay(new Date(e.start), date)).sort((a, b) => new Date(a.start) - new Date(b.start))
  const free = freeSlotsFor(date, events).map((s) => ({
    id: `free-${s.start.getTime()}`,
    type: "free",
    title: "Free time",
    start: s.start.toISOString(),
    end: s.end.toISOString(),
  }))
  return [...dayEvents, ...free].sort((a, b) => new Date(a.start) - new Date(b.start))
}

export function TimelineItem({ item, compact, onOpen }) {
  const { courseById, taskById } = useAppStore()
  const meta = EVENT_TYPE_META[item.type] ?? EVENT_TYPE_META.reminder
  const course = courseById[item.courseId]
  const now = new Date()
  const isNow = new Date(item.start) <= now && new Date(item.end) >= now
  const isPastItem = new Date(item.end) < now
  const isPoint = item.type === "deadline" || item.type === "reminder"
  const clickable = item.type !== "free"
  const target = item.taskId ? `/tasks?task=${item.taskId}` : course ? `/courses/${course.id}` : null

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
        meta.className,
        item.type === "free" && "border-dashed bg-transparent",
        isPastItem && item.type !== "deadline" && "opacity-60",
        isNow && "ring-2 ring-primary/30",
        clickable && (onOpen || target) && "hover:brightness-95 dark:hover:brightness-110"
      )}
    >
      <div className="w-12 shrink-0 text-xs font-medium tabular-nums">
        {fmtTime(item.start)}
        {!isPoint && <div className="text-[10px] font-normal opacity-70">{fmtTime(item.end)}</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-medium">{item.title}</p>
          {item.aiPlanned && (
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <SparklesIcon className="size-3 text-primary" />
              </TooltipTrigger>
              <TooltipContent>Planned by Welya</TooltipContent>
            </Tooltip>
          )}
          {isNow && <Badge className="h-4 px-1.5 text-[10px]">Now</Badge>}
        </div>
        {!compact && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs opacity-80">
            <span>{meta.label}</span>
            {course && (
              <span className="inline-flex items-center gap-1">
                <CourseDot color={course.color} /> {course.code}
              </span>
            )}
            {item.location && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-3" /> {item.location}
              </span>
            )}
            {item.taskId && taskById[item.taskId] && <span>{taskById[item.taskId].progress}% done</span>}
          </div>
        )}
      </div>
    </div>
  )

  if (clickable && onOpen) {
    return (
      <button type="button" className="block w-full text-left" onClick={() => onOpen(item)}>
        {content}
      </button>
    )
  }
  return target ? (
    <Link to={target} className="block">
      {content}
    </Link>
  ) : (
    content
  )
}

export function ScheduleTimeline({ date = new Date(), compact = false, className, emptyText = "Nothing scheduled.", onOpen }) {
  const items = useDayTimeline(date)
  return (
    <div className={cn("relative space-y-1.5", className)}>
      {items.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p> : items.map((item) => <TimelineItem key={item.id} item={item} compact={compact} onOpen={onOpen} />)}
    </div>
  )
}

export function ScheduleTimelineSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2">
          <Skeleton className="h-4 w-10" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
