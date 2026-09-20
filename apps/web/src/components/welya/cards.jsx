import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/store/app-store"
import { colorOf } from "@/components/welya/meta"
import { isOverdue, relativeDeadline } from "@/lib/dates"
import {
  ArrowRightIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CalendarIcon,
  ClockIcon,
  FileTextIcon,
  GraduationCapIcon,
  HeartIcon,
  LayoutListIcon,
  MapPinIcon,
  UsersIcon,
} from "lucide-react"

export function DeadlineCard({ task, onOpen, className }) {
  const { courseById } = useAppStore()
  const course = courseById[task.courseId]
  const overdue = isOverdue(task)
  return (
    <button
      type="button"
      onClick={() => onOpen?.(task)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-sm transition-colors hover:bg-muted/50",
        overdue && "border-destructive/30 bg-destructive/5",
        className
      )}
    >
      <div className={cn("flex h-10 w-1 shrink-0 rounded-full", course ? colorOf(course.color).bar : "bg-muted-foreground/30")} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{task.title}</p>
        <p className="truncate text-xs text-muted-foreground">{course?.name ?? "No course"}</p>
      </div>
      <div className="text-right">
        <p className={cn("text-xs font-medium", overdue && "text-destructive")}>{relativeDeadline(task.deadline)}</p>
        <p className="text-[11px] text-muted-foreground">{task.progress}% done</p>
      </div>
    </button>
  )
}

export function CourseCard({ course, className }) {
  const { tasks } = useAppStore()
  const open = tasks.filter((t) => t.courseId === course.id && t.status !== "done")
  const next = open.sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0]
  const c = colorOf(course.color)
  return (
    <Card className={cn("group/course relative gap-3 transition-shadow hover:shadow-md", className)}>
      <div className={cn("absolute inset-x-0 top-0 h-1", c.bar)} />
      <CardHeader className="pt-1">
        <CardTitle className="flex items-center gap-2">
          <Link to={`/courses/${course.id}`} className="truncate hover:underline">
            {course.name}
          </Link>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-2">
          <span className="font-mono text-xs">{course.code}</span>
          <span>·</span>
          <span className="truncate">{course.lecturer}</span>
        </CardDescription>
        <CardAction>
          <Badge variant="secondary" className={c.soft}>
            {course.credits} SKS
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1 text-xs text-muted-foreground">
          {course.schedule.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <CalendarIcon className="size-3" />
              <span className="w-8 font-medium text-foreground">{s.day}</span>
              <span>
                {s.start}–{s.end}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-3" /> {s.room}
              </span>
              <span className="ml-auto">{s.type}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <LayoutListIcon className="size-3" /> {open.length} open task{open.length === 1 ? "" : "s"}
          </span>
          {next ? (
            <span className={cn("inline-flex items-center gap-1", isOverdue(next) ? "text-destructive" : "text-muted-foreground")}>
              <ClockIcon className="size-3" /> {relativeDeadline(next.deadline)}
            </span>
          ) : (
            <span className="text-muted-foreground">No upcoming deadline</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Progress value={course.progress} className="flex-1" />
          <span className="text-xs tabular-nums text-muted-foreground">{course.progress}%</span>
        </div>
      </CardContent>
      <CardFooter className="justify-between py-2.5">
        <span className="text-xs text-muted-foreground">Semester progress</span>
        <Button size="sm" variant="ghost" render={<Link to={`/courses/${course.id}`} />}>
          Open <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  )
}

export function CourseCardSkeleton() {
  return (
    <Card className="gap-3">
      <CardHeader>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3.5 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-1.5 w-full" />
      </CardContent>
    </Card>
  )
}

export const WORKSPACE_ICONS = { GraduationCap: GraduationCapIcon, Users: UsersIcon, BookOpen: BookOpenIcon, Briefcase: BriefcaseIcon, Heart: HeartIcon }

export function WorkspaceCard({ workspace, onEdit, className }) {
  const { tasks, documents } = useAppStore()
  const wsTasks = tasks.filter((t) => t.workspaceId === workspace.id)
  const open = wsTasks.filter((t) => t.status !== "done")
  const done = wsTasks.length - open.length
  const docs = documents.filter((d) => d.workspaceId === workspace.id)
  const Icon = WORKSPACE_ICONS[workspace.icon] ?? BriefcaseIcon
  const c = colorOf(workspace.color)
  const pct = wsTasks.length ? Math.round((done / wsTasks.length) * 100) : 0

  return (
    <Card className={cn("gap-3 transition-shadow hover:shadow-md", className)}>
      <CardHeader>
        <div className={cn("mb-1 flex size-9 items-center justify-center rounded-lg", c.soft)}>
          <Icon className="size-4" />
        </div>
        <CardTitle>
          <Link to={`/workspaces/${workspace.id}`} className="hover:underline">
            {workspace.name}
          </Link>
        </CardTitle>
        <CardDescription className="line-clamp-2">{workspace.description}</CardDescription>
        <CardAction>
          <Badge variant="outline">{workspace.type}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <LayoutListIcon className="size-3" /> {open.length} open
          </span>
          <span className="inline-flex items-center gap-1">
            <FileTextIcon className="size-3" /> {docs.length} docs
          </span>
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="size-3" /> {workspace.members}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={pct} className="flex-1" />
          <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
        </div>
      </CardContent>
      <CardFooter className="justify-between py-2.5">
        <Button size="sm" variant="ghost" onClick={() => onEdit?.(workspace)}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" render={<Link to={`/workspaces/${workspace.id}`} />}>
          Open <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  )
}
