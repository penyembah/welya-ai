import * as React from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { CourseDot, PriorityBadge, SourceBadge, StatusBadge } from "@/components/welya/meta"
import { PrioritySelect, TaskDialog } from "@/components/welya/forms"
import { TaskBreakdown, SubtaskList } from "@/components/welya/TaskBreakdown"
import { fmtDateTime, formatDuration, isOverdue, relativeDeadline } from "@/lib/dates"
import { usePlanMutation } from "@/hooks/use-welya-api"
import { addDays } from "date-fns"
import { CalendarPlusIcon, CheckIcon, ClockIcon, FileTextIcon, PaperclipIcon, PencilIcon, Trash2Icon, UndoIcon } from "lucide-react"

function InfoRow({ label, children }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function TaskDetailSheet({ taskId, open, onOpenChange }) {
  const { taskById, courseById, workspaceById, documents, dispatch } = useAppStore()
  const task = taskById[taskId]
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const plan = usePlanMutation()

  if (!task) return null
  const course = courseById[task.courseId]
  const workspace = workspaceById[task.workspaceId]
  const done = task.status === "done"
  const relatedDocs = documents.filter((d) => d.linkedTaskIds?.includes(task.id))

  // Ask the planner for the next free slot (today first, then the coming days) and book this task into it
  const scheduleTime = async () => {
    try {
      for (let d = 0; d < 7; d++) {
        const date = addDays(new Date(), d)
        const { days } = await plan.mutateAsync({ scope: "day", date: date.toISOString() })
        const slot = days[0]?.slots.find((s) => new Date(s.end) - new Date(s.start) >= 60 * 60 * 1000 && new Date(s.end) > new Date())
        if (slot) {
          const len = Math.min(120, Math.max(30, (task.estimatedMinutes || 60) * (1 - (task.progress || 0) / 100)))
          const start = new Date(Math.max(new Date(slot.start), new Date()))
          const end = new Date(start.getTime() + len * 60000)
          dispatch({ type: "event/add", event: { title: `Work on: ${task.title}`, type: "work-session", start: start.toISOString(), end: end.toISOString(), courseId: task.courseId, taskId: task.id, aiPlanned: true } })
          toast.success("Work session scheduled", { description: fmtDateTime(start.toISOString()) })
          return
        }
      }
      toast.info("No free slot found this week.")
    } catch (e) {
      toast.error("Couldn't find a slot", { description: e.message })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="gap-2 border-b pr-12">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {isOverdue(task) && <Badge variant="destructive">Overdue</Badge>}
            <SourceBadge source={task.source?.type} />
          </div>
          <SheetTitle className={cn("text-lg leading-snug", done && "text-muted-foreground line-through")}>{task.title}</SheetTitle>
          <SheetDescription>{task.description || "No description."}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 p-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={done ? "outline" : "default"} onClick={() => { dispatch({ type: "task/toggle-done", id: task.id }); toast.success(done ? "Task reopened" : "Task completed", { description: task.title }) }}>
                {done ? <UndoIcon data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
                {done ? "Mark as not done" : "Mark as done"}
              </Button>
              {!done && (
                <Button size="sm" variant="outline" onClick={scheduleTime} disabled={plan.isPending}>
                  <CalendarPlusIcon data-icon="inline-start" /> {plan.isPending ? "Finding a slot…" : "Schedule time"}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <PencilIcon data-icon="inline-start" /> Edit
              </Button>
              <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2Icon data-icon="inline-start" /> Delete
              </Button>
            </div>

            <div className="space-y-2.5 rounded-xl border p-3">
              <InfoRow label="Course">
                {course ? (
                  <Link to={`/courses/${course.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                    <CourseDot color={course.color} /> {course.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </InfoRow>
              <InfoRow label="Workspace">
                {workspace ? (
                  <Link to={`/workspaces/${workspace.id}`} className="hover:underline">
                    {workspace.name}
                  </Link>
                ) : (
                  "—"
                )}
              </InfoRow>
              <InfoRow label="Deadline">
                <span className={cn(isOverdue(task) && "text-destructive")}>
                  {fmtDateTime(task.deadline)} <span className="text-muted-foreground">· {relativeDeadline(task.deadline)}</span>
                </span>
              </InfoRow>
              <InfoRow label="Priority">
                <PrioritySelect size="sm" className="w-32" value={task.priority} onChange={(v) => dispatch({ type: "task/update", id: task.id, patch: { priority: v } })} />
              </InfoRow>
              <InfoRow label="Estimated">
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="size-3.5 text-muted-foreground" /> {formatDuration(task.estimatedMinutes)}
                </span>
              </InfoRow>
              <InfoRow label="Progress">
                <div className="flex items-center gap-2">
                  <Progress value={task.progress} className="flex-1" />
                  <span className="text-xs tabular-nums text-muted-foreground">{task.progress}%</span>
                </div>
              </InfoRow>
              <InfoRow label="Source">
                <span className="text-muted-foreground">{task.source?.label}</span>
                {task.source?.inboxId && (
                  <Link to={`/inbox?item=${task.source.inboxId}`} className="ml-2 text-xs text-primary hover:underline">
                    View in inbox
                  </Link>
                )}
              </InfoRow>
            </div>

            {!done && <TaskBreakdown task={task} />}

            <Tabs defaultValue="subtasks">
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="subtasks">Subtasks ({task.subtasks.length})</TabsTrigger>
                <TabsTrigger value="attachments">Attachments ({(task.attachments?.length ?? 0) + relatedDocs.length})</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>
              <TabsContent value="subtasks" className="pt-2">
                <SubtaskList task={task} />
              </TabsContent>
              <TabsContent value="attachments" className="pt-2">
                <div className="space-y-1.5">
                  {task.attachments?.map((a) => (
                    <div key={a} className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm">
                      <PaperclipIcon className="size-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{a}</span>
                    </div>
                  ))}
                  {relatedDocs.map((d) => (
                    <Link key={d.id} to={`/documents?doc=${d.id}`} className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm hover:bg-muted/50">
                      <FileTextIcon className="size-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{d.title}</span>
                      <Badge variant="outline">Document</Badge>
                    </Link>
                  ))}
                  {!task.attachments?.length && !relatedDocs.length && <p className="text-xs text-muted-foreground">No attachments.</p>}
                </div>
              </TabsContent>
              <TabsContent value="notes" className="pt-2">
                <Textarea
                  defaultValue={task.notes}
                  rows={5}
                  placeholder="Add notes for this task…"
                  onBlur={(e) => e.target.value !== task.notes && dispatch({ type: "task/update", id: task.id, patch: { notes: e.target.value } })}
                />
                <p className="mt-1 text-xs text-muted-foreground">Saved automatically when you leave the field.</p>
              </TabsContent>
            </Tabs>

            <Separator />
            <p className="text-xs text-muted-foreground">
              {done && task.completedAt ? `Completed ${fmtDateTime(task.completedAt)}` : "Welya will remind you 24 hours before the deadline."}
            </p>
          </div>
        </ScrollArea>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this task?</AlertDialogTitle>
              <AlertDialogDescription>“{task.title}” and its subtasks will be removed. This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  dispatch({ type: "task/delete", id: task.id })
                  setConfirmDelete(false)
                  onOpenChange(false)
                  toast("Task deleted", { description: task.title })
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <TaskDialog open={editOpen} onOpenChange={setEditOpen} task={task} />
      </SheetContent>
    </Sheet>
  )
}
