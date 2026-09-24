import * as React from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAppStore } from "@/store/app-store"
import { CourseChip, SourceBadge, SourceIcon } from "@/components/welya/meta"
import { CourseSelect, TaskDialog } from "@/components/welya/forms"
import { relativeTime, fmtDateTime } from "@/lib/dates"
import {
  AlertCircleIcon,
  BellPlusIcon,
  BookmarkIcon,
  CalendarPlusIcon,
  CheckCircle2Icon,
  CheckIcon,
  EyeOffIcon,
  ListPlusIcon,
  MoreHorizontalIcon,
  SparklesIcon,
  StarIcon,
  UndoIcon,
} from "lucide-react"

const STATUS_META = {
  unprocessed: { label: "Needs review", className: "bg-primary/10 text-primary" },
  processed: { label: "Processed", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  ignored: { label: "Ignored", className: "bg-muted text-muted-foreground" },
}

export function InboxStatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.unprocessed
  return (
    <Badge variant="secondary" className={m.className}>
      {status === "processed" && <CheckIcon />}
      {m.label}
    </Badge>
  )
}

export function InboxItem({ item, selected, onSelect, className }) {
  const { courseById, dispatch } = useAppStore()
  const course = courseById[item.courseId]
  const unread = item.status === "unprocessed"
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(item)}
      className={cn(
        "group/inbox flex w-full items-start gap-3 border-b px-3 py-3 text-left text-sm transition-colors outline-none last:border-b-0 hover:bg-muted/40 focus-visible:bg-muted/40",
        selected && "bg-primary/5 hover:bg-primary/5",
        item.status === "ignored" && "opacity-60",
        className
      )}
    >
      <div className="relative">
        <Avatar>
          <AvatarFallback className="bg-muted">
            <SourceIcon source={item.source} className="size-4 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        {unread && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("truncate text-xs text-muted-foreground", unread && "font-medium text-foreground")}>{item.sender}</p>
          <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(item.receivedAt)}</span>
        </div>
        <p className={cn("truncate", unread ? "font-semibold" : "font-medium")}>{item.subject}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{item.preview}</p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Badge variant="outline" className="gap-1 text-[10px]">
            <SparklesIcon className="text-primary" /> {item.ai?.type ?? "Analyzing…"}
          </Badge>
          {course && <CourseChip course={course} className="max-w-36" />}
          {item.importance === "high" && (
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <StarIcon className="size-3.5 fill-amber-400 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent>Important</TooltipContent>
            </Tooltip>
          )}
          <span className="ml-auto">
            <InboxStatusBadge status={item.status} />
          </span>
        </div>
      </div>
      <span onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" className="opacity-0 group-hover/inbox:opacity-100 data-[popup-open]:opacity-100" aria-label="Actions" />}>
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSelect(item)}>Open</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { const restore = item.status === "ignored"; dispatch({ type: "inbox/set-status", id: item.id, status: restore ? "unprocessed" : "ignored" }); toast(restore ? "Moved back to review" : "Ignored", { description: item.subject }) }}>
              {item.status === "ignored" ? <UndoIcon /> : <EyeOffIcon />}
              {item.status === "ignored" ? "Restore" : "Ignore"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { const high = item.importance !== "high"; dispatch({ type: "inbox/set-status", id: item.id, status: item.status, patch: { importance: high ? "high" : "normal" } }); toast(high ? "Marked as important" : "Importance removed", { description: item.subject }) }}>
              <StarIcon /> {item.importance === "high" ? "Remove importance" : "Mark important"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  )
}

export function InboxItemSkeleton() {
  return (
    <div className="flex items-start gap-3 border-b px-3 py-3">
      <Skeleton className="size-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  )
}

export function AIActionPanel({ item, onDone, className }) {
  const store = useAppStore()
  const { courseById, dispatch, taskById } = store
  const navigate = useNavigate()
  const [taskOpen, setTaskOpen] = React.useState(false)
  const [courseId, setCourseId] = React.useState(item.courseId)
  // Interpretation is produced server-side when the item is created; until it arrives we show the analyzing state
  const ai = item.ai && item.ai.type ? item.ai : { type: "", confidence: 0, fields: [], suggestion: "", primaryAction: "Save as Note" }
  const analyzing = !item.ai || !item.ai.type

  React.useEffect(() => {
    setCourseId(item.courseId)
  }, [item.id, item.courseId])

  const complete = (label, patch = {}) => {
    dispatch({ type: "inbox/set-status", id: item.id, status: "processed", patch: { courseId, ...patch } })
    dispatch({
      type: "notification/add",
      notification: { type: "inbox", title: `${label}: ${item.subject}`, message: ai.suggestion, link: "/inbox" },
    })
    toast.success(label, { description: item.subject })
    onDone?.()
  }

  const field = (label) => ai.fields.find((f) => f.label.toLowerCase() === label.toLowerCase())?.value

  // Resolve "Thursday", "tomorrow", "Jumat" + "13:00" from the interpretation into a concrete start time
  const resolveWhen = (fallbackDays, fallbackHour) => {
    const dayText = (field("Date") ?? "").toLowerCase()
    const timeText = field("Time") ?? ""
    const days = { sunday: 0, minggu: 0, monday: 1, senin: 1, tuesday: 2, selasa: 2, wednesday: 3, rabu: 3, thursday: 4, kamis: 4, friday: 5, jumat: 5, "jum'at": 5, saturday: 6, sabtu: 6 }
    const when = new Date()
    if (/tomorrow|besok/.test(dayText)) when.setDate(when.getDate() + 1)
    else if (/today|hari ini/.test(dayText)) {
      /* keep today */
    } else {
      const key = Object.keys(days).find((k) => dayText.includes(k))
      if (key !== undefined) {
        let diff = (days[key] - when.getDay() + 7) % 7
        if (diff === 0 || /next|depan/.test(dayText)) diff += 7
        when.setDate(when.getDate() + diff)
      } else when.setDate(when.getDate() + fallbackDays)
    }
    const m = /^(\d{1,2}):(\d{2})/.exec(timeText)
    when.setHours(m ? Number(m[1]) : fallbackHour, m ? Number(m[2]) : 0, 0, 0)
    return when
  }

  const createEvent = () => {
    const start = resolveWhen(1, 13)
    const end = new Date(start.getTime() + 100 * 60000)
    const title = ai.type === "Schedule Change" && courseById[courseId] ? `${courseById[courseId].name} (rescheduled)` : item.subject
    dispatch({ type: "event/add", event: { title, type: ai.type === "Schedule Change" ? "class" : "meeting", start: start.toISOString(), end: end.toISOString(), courseId, location: field("Location") ?? null } })
    complete("Event created")
  }

  const createReminder = () => {
    const when = resolveWhen(1, 8)
    dispatch({ type: "event/add", event: { title: `Reminder: ${item.subject}`, type: "reminder", start: when.toISOString(), end: when.toISOString(), courseId } })
    complete("Reminder created")
  }

  const saveNote = () => {
    const workspaceId = store.workspaces.find((w) => w.type === "Academic")?.id ?? store.workspaces[0]?.id ?? null
    dispatch({ type: "document/add", document: { title: item.subject, type: "note", courseId, workspaceId, size: "—", summary: item.preview, content: item.body, tags: ["from-inbox", item.source] } })
    complete("Saved as note")
  }

  const updateTask = () => {
    const named = field("Task")
    const target =
      Object.values(taskById).find((t) => t.status !== "done" && named && t.title.toLowerCase().includes(named.toLowerCase().split(" – ")[0])) ??
      Object.values(taskById).find((t) => t.courseId === courseId && t.status !== "done")
    if (target) {
      const subtask = field("Extra requirement") ?? field("Action") ?? ai.suggestion
      dispatch({ type: "subtask/add-many", taskId: target.id, titles: [subtask] })
      complete("Task updated", { resultTaskId: target.id })
    } else {
      setTaskOpen(true)
    }
  }

  const primary = ai.primaryAction
  const primaryHandler = {
    "Create Task": () => setTaskOpen(true),
    "Create Event": createEvent,
    "Create Reminder": createReminder,
    "Save as Note": saveNote,
    "Update Task": updateTask,
  }[primary]

  const confidence = Math.round((ai.confidence ?? 0) * 100)

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <SourceBadge source={item.source} />
              <InboxStatusBadge status={item.status} />
              {item.importance === "high" && (
                <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  <StarIcon /> Important
                </Badge>
              )}
            </div>
            <h2 className="font-heading text-lg font-semibold leading-snug">{item.subject}</h2>
            <p className="text-xs text-muted-foreground">
              From <span className="font-medium text-foreground">{item.sender}</span>
              {item.senderEmail && <span> · {item.senderEmail}</span>} · {fmtDateTime(item.receivedAt)}
            </p>
          </div>

          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Original</p>
            <p className="text-sm leading-relaxed whitespace-pre-line">{item.body}</p>
          </div>

          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <SparklesIcon className="size-4 text-primary" /> Welya's interpretation
              </p>
              {!analyzing && (
                <Tooltip>
                  <TooltipTrigger render={<span className="text-xs text-muted-foreground" />}>{confidence}% confident</TooltipTrigger>
                  <TooltipContent>How sure Welya is about this reading</TooltipContent>
                </Tooltip>
              )}
            </div>

            {analyzing ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner className="size-3" /> Understanding the message…
                </div>
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Progress value={60} className="mt-2" />
              </div>
            ) : (
              <>
                <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[120px_1fr]">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd>
                    <Badge>{ai.type}</Badge>
                  </dd>
                  {ai.fields.map((f) => (
                    <React.Fragment key={f.label}>
                      <dt className="text-muted-foreground">{f.label}</dt>
                      <dd className="font-medium">{f.value}</dd>
                    </React.Fragment>
                  ))}
                </dl>
                <Separator className="my-3" />
                <p className="text-sm">
                  <span className="text-muted-foreground">Suggestion: </span>
                  {ai.suggestion}
                </p>
                {confidence < 85 && item.status === "unprocessed" && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                    <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" /> Lower confidence — double-check the course and date before confirming.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Assign course</p>
            <CourseSelect value={courseId} onChange={setCourseId} />
          </div>

          {item.status === "processed" && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
              <CheckCircle2Icon className="size-4 text-emerald-600" />
              <span className="flex-1">Already processed.</span>
              {item.resultTaskId && (
                <Button size="xs" variant="outline" onClick={() => navigate(`/tasks?task=${item.resultTaskId}`)}>
                  View task
                </Button>
              )}
              {item.resultDocumentId && (
                <Button size="xs" variant="outline" onClick={() => navigate(`/documents?doc=${item.resultDocumentId}`)}>
                  View document
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="space-y-2 border-t bg-background p-3">
        {item.status === "unprocessed" ? (
          <>
            <Button className="w-full" disabled={analyzing} onClick={primaryHandler}>
              <SparklesIcon data-icon="inline-start" /> Confirm: {primary}
            </Button>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              <Button size="sm" variant="outline" disabled={analyzing} onClick={() => setTaskOpen(true)}>
                <ListPlusIcon data-icon="inline-start" /> Task
              </Button>
              <Button size="sm" variant="outline" disabled={analyzing} onClick={createEvent}>
                <CalendarPlusIcon data-icon="inline-start" /> Event
              </Button>
              <Button size="sm" variant="outline" disabled={analyzing} onClick={createReminder}>
                <BellPlusIcon data-icon="inline-start" /> Reminder
              </Button>
              <Button size="sm" variant="outline" disabled={analyzing} onClick={saveNote}>
                <BookmarkIcon data-icon="inline-start" /> Note
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="col-span-2 sm:col-span-2"
                onClick={() => {
                  dispatch({ type: "inbox/set-status", id: item.id, status: "ignored" })
                  toast("Ignored", { description: item.subject })
                  onDone?.()
                }}
              >
                <EyeOffIcon data-icon="inline-start" /> Ignore
              </Button>
            </div>
          </>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => { dispatch({ type: "inbox/set-status", id: item.id, status: "unprocessed" }); toast("Moved back to review", { description: item.subject }) }}>
            <UndoIcon data-icon="inline-start" /> Move back to review
          </Button>
        )}
      </div>

      <TaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        defaults={{
          title: ai.fields.find((f) => f.label === "Task")?.value ?? item.subject,
          description: item.body,
          courseId,
          priority: item.importance === "high" ? "high" : "medium",
          source: { type: item.source, label: `${item.sender} · ${item.subject}`, inboxId: item.id },
        }}
        onCreated={() => complete("Task created")}
      />
    </div>
  )
}
