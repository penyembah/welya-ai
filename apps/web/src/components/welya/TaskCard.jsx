import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAppStore } from "@/store/app-store"
import { CourseChip, PriorityBadge, StatusBadge, SourceIcon } from "@/components/welya/meta"
import { formatDuration, isOverdue, relativeDeadline } from "@/lib/dates"
import { CalendarIcon, ClockIcon, ListChecksIcon, MoreHorizontalIcon, PaperclipIcon, SparklesIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

export function TaskCard({ task, onOpen, onBreakdown, compact = false, selected = false, className }) {
  const { courseById, dispatch } = useAppStore()
  const course = courseById[task.courseId]
  const overdue = isOverdue(task)
  const done = task.status === "done"
  const subDone = task.subtasks.filter((s) => s.done).length

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen?.(task)
        }
      }}
      className={cn(
        "group/task flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left text-sm transition-colors outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "border-primary/40 bg-primary/5",
        done && "opacity-70",
        className
      )}
    >
      <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
        <Checkbox
          checked={done}
          onCheckedChange={() => {
            dispatch({ type: "task/toggle-done", id: task.id })
            if (!done) toast.success("Task completed", { description: task.title })
          }}
          aria-label={done ? "Mark as not done" : "Mark as done"}
        />
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("truncate font-medium", done && "line-through")}>{task.title}</p>
          <div className="flex shrink-0 items-center gap-1">
            <PriorityBadge priority={task.priority} />
            {!compact && <StatusBadge status={task.status} className="hidden sm:inline-flex" />}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <CourseChip course={course} className="max-w-40" />
          <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-destructive")}>
            <CalendarIcon className="size-3" />
            {relativeDeadline(task.deadline)}
          </span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="size-3" />
            {formatDuration(task.estimatedMinutes)}
          </span>
          {task.subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecksIcon className="size-3" />
              {subDone}/{task.subtasks.length}
            </span>
          )}
          {task.attachments?.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <PaperclipIcon className="size-3" />
              {task.attachments.length}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex items-center gap-1" />}>
              <SourceIcon source={task.source?.type} className="size-3" />
            </TooltipTrigger>
            <TooltipContent>{task.source?.label}</TooltipContent>
          </Tooltip>
        </div>

        {!compact && !done && (task.progress > 0 || task.subtasks.length > 0) && (
          <div className="flex items-center gap-2">
            <Progress value={task.progress} className="flex-1" />
            <span className="text-[11px] text-muted-foreground tabular-nums">{task.progress}%</span>
          </div>
        )}
      </div>

      <span onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-xs" className="opacity-0 group-hover/task:opacity-100 data-[popup-open]:opacity-100 focus-visible:opacity-100" aria-label="Task actions" />}
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpen?.(task)}>Open details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBreakdown?.(task)}>
              <SparklesIcon /> Break this task down
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => dispatch({ type: "task/update", id: task.id, patch: { priority: task.priority === "high" ? "medium" : "high" } })}>
              {task.priority === "high" ? "Lower priority" : "Mark as high priority"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                dispatch({ type: "task/delete", id: task.id })
                toast("Task deleted", { description: task.title })
              }}
            >
              <Trash2Icon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  )
}

export function TaskRowCompact({ task, onOpen }) {
  const { courseById } = useAppStore()
  const overdue = isOverdue(task)
  return (
    <button
      type="button"
      onClick={() => onOpen?.(task)}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/50"
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", task.priority === "high" ? "bg-destructive" : task.priority === "medium" ? "bg-amber-500" : "bg-muted-foreground/40")} />
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      <CourseChip course={courseById[task.courseId]} className="hidden max-w-28 md:inline-flex" />
      <Badge variant={overdue ? "destructive" : "outline"} className="shrink-0">
        {relativeDeadline(task.deadline)}
      </Badge>
    </button>
  )
}
