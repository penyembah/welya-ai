import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  FileTextIcon,
  ImageIcon,
  MailIcon,
  MessageSquareIcon,
  PencilLineIcon,
  FileIcon,
  StickyNoteIcon,
  CalendarIcon,
} from "lucide-react"

export const COLOR_CLASSES = {
  teal: { dot: "bg-teal-500", soft: "bg-teal-500/10 text-teal-700 dark:text-teal-300", ring: "ring-teal-500/30", bar: "bg-teal-500" },
  sky: { dot: "bg-sky-500", soft: "bg-sky-500/10 text-sky-700 dark:text-sky-300", ring: "ring-sky-500/30", bar: "bg-sky-500" },
  violet: { dot: "bg-violet-500", soft: "bg-violet-500/10 text-violet-700 dark:text-violet-300", ring: "ring-violet-500/30", bar: "bg-violet-500" },
  amber: { dot: "bg-amber-500", soft: "bg-amber-500/10 text-amber-700 dark:text-amber-300", ring: "ring-amber-500/30", bar: "bg-amber-500" },
  rose: { dot: "bg-rose-500", soft: "bg-rose-500/10 text-rose-700 dark:text-rose-300", ring: "ring-rose-500/30", bar: "bg-rose-500" },
  slate: { dot: "bg-slate-400", soft: "bg-slate-500/10 text-slate-700 dark:text-slate-300", ring: "ring-slate-500/30", bar: "bg-slate-400" },
}

export function colorOf(color) {
  return COLOR_CLASSES[color] ?? COLOR_CLASSES.slate
}

export function CourseDot({ color, className }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", colorOf(color).dot, className)} />
}

export function CourseChip({ course, className }) {
  if (!course) return null
  return (
    <span className={cn("inline-flex items-center gap-1.5 truncate text-xs text-muted-foreground", className)}>
      <CourseDot color={course.color} />
      <span className="truncate">{course.name}</span>
    </span>
  )
}

const PRIORITY = {
  high: { label: "High", className: "bg-destructive/10 text-destructive" },
  medium: { label: "Medium", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
}

export function PriorityBadge({ priority, className }) {
  const p = PRIORITY[priority] ?? PRIORITY.low
  return (
    <Badge variant="secondary" className={cn(p.className, className)}>
      {p.label}
    </Badge>
  )
}

const STATUS = {
  todo: { label: "To do", variant: "outline" },
  "in-progress": { label: "In progress", className: "bg-primary/10 text-primary" },
  done: { label: "Done", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
}

export function StatusBadge({ status, className }) {
  const s = STATUS[status] ?? STATUS.todo
  return (
    <Badge variant={s.variant ?? "secondary"} className={cn(s.className, className)}>
      {s.label}
    </Badge>
  )
}

export const SOURCE_META = {
  email: { label: "Email", Icon: MailIcon },
  message: { label: "Message", Icon: MessageSquareIcon },
  pdf: { label: "PDF", Icon: FileTextIcon },
  screenshot: { label: "Screenshot", Icon: ImageIcon },
  document: { label: "Document", Icon: FileIcon },
  manual: { label: "Manual", Icon: PencilLineIcon },
  note: { label: "Note", Icon: StickyNoteIcon },
  image: { label: "Image", Icon: ImageIcon },
  doc: { label: "Document", Icon: FileIcon },
  calendar: { label: "Calendar", Icon: CalendarIcon },
}

export function SourceIcon({ source, className }) {
  const meta = SOURCE_META[source] ?? SOURCE_META.manual
  return <meta.Icon className={cn("size-4", className)} aria-label={meta.label} />
}

export function SourceBadge({ source, className }) {
  const meta = SOURCE_META[source] ?? SOURCE_META.manual
  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <meta.Icon data-icon="inline-start" />
      {meta.label}
    </Badge>
  )
}

export const EVENT_TYPE_META = {
  class: { label: "Class", className: "bg-primary/10 text-primary border-primary/20" },
  deadline: { label: "Deadline", className: "bg-destructive/10 text-destructive border-destructive/20" },
  meeting: { label: "Meeting", className: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20" },
  reminder: { label: "Reminder", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" },
  "work-session": { label: "Work session", className: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20" },
  free: { label: "Free time", className: "bg-muted/60 text-muted-foreground border-dashed" },
}
