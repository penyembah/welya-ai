import * as React from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { format, isSameDay } from "date-fns"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAppStore } from "@/store/app-store"
import { CourseDot, EVENT_TYPE_META, PriorityBadge, StatusBadge } from "@/components/welya/meta"
import { EventDialog } from "@/components/welya/forms"
import { fmtDateTime, fmtTime, formatDuration, relativeDeadline } from "@/lib/dates"
import { BookOpenIcon, CalendarIcon, ClockIcon, LayoutListIcon, MapPinIcon, PencilIcon, SparklesIcon, Trash2Icon } from "lucide-react"

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-2 text-sm">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        {Icon && <Icon className="size-3.5" />} {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// `event` may be a real calendar event or a virtual task-deadline item (id "deadline-<taskId>", virtual: true).
export function EventDetailSheet({ event, open, onOpenChange }) {
  const { courseById, taskById, dispatch } = useAppStore()
  const [editOpen, setEditOpen] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  if (!event) return null

  const meta = EVENT_TYPE_META[event.type] ?? EVENT_TYPE_META.reminder
  const course = courseById[event.courseId]
  const task = taskById[event.taskId]
  const start = new Date(event.start)
  const end = new Date(event.end)
  const isPoint = event.type === "deadline" || event.type === "reminder" || end <= start
  const minutes = Math.round((end - start) / 60000)
  const sameDay = isSameDay(start, end)
  const isVirtualDeadline = Boolean(event.virtual)
  const past = end < new Date()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="gap-2 border-b pr-12">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn(meta.className)}>{meta.label}</Badge>
            {event.aiPlanned && <Badge variant="secondary" className="gap-1"><SparklesIcon className="size-3" /> Planned by Welya</Badge>}
            {past && !isVirtualDeadline && <Badge variant="secondary">Past</Badge>}
          </div>
          <SheetTitle className="text-lg leading-snug">{event.title}</SheetTitle>
          <SheetDescription>
            {format(start, "EEEE, d MMMM yyyy")}
            {isPoint ? ` · ${fmtTime(event.start)}` : ` · ${fmtTime(event.start)}–${sameDay ? fmtTime(event.end) : fmtDateTime(event.end)}`}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-4">
          <div className="flex flex-wrap gap-2">
            {isVirtualDeadline ? (
              <Button size="sm" render={<Link to={`/tasks?task=${event.taskId}`} />}>
                <LayoutListIcon data-icon="inline-start" /> Open task
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <PencilIcon data-icon="inline-start" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2Icon data-icon="inline-start" /> Delete
                </Button>
              </>
            )}
          </div>

          <div className="space-y-2.5 rounded-xl border p-3">
            <InfoRow icon={CalendarIcon} label="When">
              <div>{fmtDateTime(event.start)}</div>
              {!isPoint && <div className="text-muted-foreground">until {sameDay ? fmtTime(event.end) : fmtDateTime(event.end)}</div>}
              <div className="text-xs text-muted-foreground">{relativeDeadline(event.start)}</div>
            </InfoRow>
            {!isPoint && (
              <InfoRow icon={ClockIcon} label="Duration">
                {formatDuration(minutes)}
              </InfoRow>
            )}
            <InfoRow icon={MapPinIcon} label="Location">
              {event.location ? <span>{event.location}</span> : <span className="text-muted-foreground">—</span>}
            </InfoRow>
            <InfoRow icon={BookOpenIcon} label="Course">
              {course ? (
                <Link to={`/courses/${course.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                  <CourseDot color={course.color} /> {course.name}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </InfoRow>
          </div>

          {task && (
            <div className="space-y-2 rounded-xl border p-3">
              <p className="text-xs font-medium text-muted-foreground">Linked task</p>
              <Link to={`/tasks?task=${task.id}`} className="block rounded-lg border p-2.5 text-sm hover:bg-muted/50">
                <p className="truncate font-medium">{task.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                  <span className="text-xs text-muted-foreground">{task.progress}% done · due {fmtDateTime(task.deadline)}</span>
                </div>
              </Link>
            </div>
          )}

          {isVirtualDeadline && <p className="text-xs text-muted-foreground">This item is the task's deadline. Change the deadline from the task itself.</p>}
        </div>

        {!isVirtualDeadline && <EventDialog open={editOpen} onOpenChange={setEditOpen} event={event} />}

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this event?</AlertDialogTitle>
              <AlertDialogDescription>“{event.title}” will be removed from your calendar{event.externalId ? " and from Google Calendar" : ""}.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  dispatch({ type: "event/delete", id: event.id })
                  setConfirmDelete(false)
                  onOpenChange(false)
                  toast("Event deleted", { description: event.title })
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
