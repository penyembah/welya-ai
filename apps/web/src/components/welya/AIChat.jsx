import * as React from "react"
import { useNavigate } from "react-router-dom"
import { addDays, addWeeks, set, startOfWeek } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import { useAppStore } from "@/store/app-store"
import { WelyaLogo } from "@/components/welya/WelyaLogo"
import { Markdown } from "@/components/welya/Markdown"
import { useBreakdownMutation, useChatImageMutation, useChatMutation, usePlanMutation } from "@/hooks/use-welya-api"
import { fmtDateTime, fmtTime } from "@/lib/dates"
import { extractScheduleRows, DAY_INDEX, parseClock } from "@/lib/schedule-rows"
import { ArrowUpIcon, CalendarPlusIcon, CheckIcon, FileTextIcon, ImageIcon, InboxIcon, LayoutListIcon, SparklesIcon, XIcon } from "lucide-react"

export function useWelyaActions() {
  const { dispatch, taskById, courses, events } = useAppStore()
  const navigate = useNavigate()
  const plan = usePlanMutation()
  const breakdown = useBreakdownMutation()

  return React.useCallback(
    async (action) => {
      switch (action.kind) {
        case "navigate":
          navigate(action.to)
          return
        case "open-task":
          navigate(`/tasks?task=${action.targetId}`)
          return
        case "plan": {
          const { sessions } = await plan.mutateAsync({ scope: "day", date: action.date })
          if (!sessions.length) {
            toast.info("No free slots available on that day.")
            return false
          }
          dispatch({ type: "event/add-many", events: sessions })
          toast.success(`Added ${sessions.length} work session${sessions.length > 1 ? "s" : ""} to your calendar`, {
            description: sessions.map((s) => `${fmtTime(s.start)} ${s.title.replace("Work on: ", "")}`).join(" · "),
          })
          return true
        }
        case "plan-week": {
          const { sessions } = await plan.mutateAsync({ scope: "week" })
          if (!sessions.length) {
            toast.info("Nothing left to schedule next week.")
            return false
          }
          dispatch({ type: "event/add-many", events: sessions })
          toast.success(`Planned ${sessions.length} work sessions for next week`)
          navigate("/calendar?view=week")
          return true
        }
        case "schedule-courses": {
          const valid = (item) => item?.title && item?.day && item?.start && item?.end
          // Rows come from the action payload; older replies only have them in the Markdown text
          const fromAction = Array.isArray(action.schedule) ? action.schedule.filter(valid) : []
          const extracted = fromAction.length ? fromAction : extractScheduleRows(action.messageContent).filter(valid)
          const scheduledCourses = courses.flatMap((course) => {
            const schedule = Array.isArray(course.schedule) ? course.schedule : course.schedule ? [course.schedule] : []
            return schedule.length ? schedule.map((item) => ({ ...item, title: course.name, courseId: course.id, location: item.room || course.room || null })) : []
          })
          const scheduleItems = extracted.length ? extracted.map((item) => ({ ...item, courseId: courses.find((c) => c.name.toLowerCase() === String(item.title).toLowerCase())?.id ?? null, location: item.location || null })) : scheduledCourses
          const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
          const existing = new Set(events.filter((event) => event.type === "class").flatMap((event) => [`${event.courseId}:${event.start}`, `${event.title.toLowerCase()}:${event.start}`]))
          const dayIndexes = DAY_INDEX
          const generated = []
          for (let week = 0; week < 16; week += 1) {
            for (const item of scheduleItems) {
                const dayIndex = dayIndexes[String(item.day ?? "").trim().toLowerCase()]
                if (dayIndex == null) continue
                const startClock = parseClock(item.start)
                const endClock = parseClock(item.end)
                if (!startClock || !endClock) continue
                const [startHour, startMinute] = startClock
                const [endHour, endMinute] = endClock
                const date = addDays(addWeeks(weekStart, week), dayIndex)
                const start = set(date, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 })
                const end = set(date, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 })
                if (end <= new Date()) continue
                const key = item.courseId ? `${item.courseId}:${start.toISOString()}` : `${String(item.title).toLowerCase()}:${start.toISOString()}`
                if (existing.has(key)) continue
                existing.add(key)
                generated.push({ title: item.title, type: "class", start: start.toISOString(), end: end.toISOString(), courseId: item.courseId, location: item.location || null, aiPlanned: false })
            }
          }
          if (!generated.length) {
            toast.info(extracted.length || scheduledCourses.length ? "Those course schedules are already on your calendar." : "No readable course schedule was available to add.")
            return false
          }
          await dispatch({ type: "event/add-many", events: generated })
          toast.success(`${generated.length} class events added`, { description: "No reminders were created." })
          navigate("/calendar?view=month")
          return true
        }
        case "breakdown": {
          const task = taskById[action.targetId]
          if (!task) return
          const { suggestions } = await breakdown.mutateAsync(task.id)
          if (!suggestions.length) return toast.info("This task already has all the steps I would suggest.")
          dispatch({ type: "subtask/add-many", taskId: task.id, titles: suggestions })
          toast.success(`${suggestions.length} subtasks added`, { description: task.title })
          return true
        }
        case "create-task": {
          if (!action.title) {
            navigate("/tasks")
            return false
          }
          // Older messages may carry model-formatted dates; the API needs strict ISO
          const parsedDeadline = new Date(String(action.deadline ?? "").replace(" ", "T"))
          const deadline = Number.isNaN(parsedDeadline.getTime()) ? new Date(new Date().setHours(23, 59, 0, 0) + 7 * 86_400_000).toISOString() : parsedDeadline.toISOString()
          await dispatch({
            type: "task/add",
            task: {
              title: action.title,
              description: action.description ?? "",
              deadline,
              estimatedMinutes: Number.isFinite(action.estimatedMinutes) ? action.estimatedMinutes : 360,
              priority: ["high", "medium", "low"].includes(action.priority) ? action.priority : "medium",
              courseId: courses.some((c) => c.id === action.courseId) ? action.courseId : null,
              workspaceId: null,
              source: { type: "assistant", label: "Created from AI Assistant" },
            },
          })
          toast.success("Task created", { description: action.title })
          navigate("/tasks")
          return true
        }
        case "create-event": {
          const start = new Date(action.start)
          if (!action.title || Number.isNaN(start.getTime())) {
            navigate("/calendar")
            return false
          }
          const endParsed = new Date(action.end)
          const end = Number.isNaN(endParsed.getTime()) || endParsed <= start ? new Date(start.getTime() + 60 * 60_000) : endParsed
          const duplicate = events.some((e) => e.title.toLowerCase() === action.title.toLowerCase() && new Date(e.start).getTime() === start.getTime())
          if (duplicate) {
            toast.info("That event is already on your calendar.")
            return true
          }
          await dispatch({
            type: "event/add",
            event: {
              title: action.title,
              type: action.eventType ?? "meeting",
              start: start.toISOString(),
              end: end.toISOString(),
              location: action.location ?? null,
              courseId: courses.some((c) => c.id === action.courseId) ? action.courseId : null,
              aiPlanned: false,
            },
          })
          toast.success("Event added to your calendar", { description: `${action.title} · ${fmtDateTime(start.toISOString())}` })
          navigate("/calendar?view=week")
          return true
        }
        default:
          return
      }
    },
    [courses, dispatch, events, navigate, taskById, plan, breakdown]
  )
}

export function useWelyaChat({ context, conversationId = null, persist = false, initialMessages = [], onMessages } = {}) {
  const [messages, setMessages] = React.useState(initialMessages)
  const chat = useChatMutation()
  const imageChat = useChatImageMutation()

  const send = React.useCallback(
    async (text) => {
      const content = text.trim()
      if (!content) return
      const optimistic = { id: `u-${Date.now()}`, role: "user", content, time: new Date().toISOString() }
      setMessages((m) => [...m, optimistic])
      try {
        const res = await chat.mutateAsync({ message: content, conversationId, context, persist })
        setMessages((m) => {
          const next = [...m.filter((x) => x.id !== optimistic.id), ...res.messages]
          onMessages?.(res, next)
          return next
        })
      } catch (e) {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id))
        toast.error("Welya couldn't answer", { description: e.message })
      }
    },
    [chat, conversationId, context, persist, onMessages]
  )

  const sendImage = React.useCallback(async (file, text) => {
    const prompt = text.trim() || "Analyze this academic image and explain what I should add to my calendar."
    const optimistic = { id: `u-${Date.now()}`, role: "user", content: prompt, imagePreview: URL.createObjectURL(file), imageName: file.name, time: new Date().toISOString() }
    setMessages((m) => [...m, optimistic])
    try {
      const res = await imageChat.mutateAsync({ file, message: prompt, conversationId, context, persist })
      setMessages((m) => {
        const next = [...m.filter((x) => x.id !== optimistic.id), ...res.messages.map((message) => message.role === "user" ? { ...message, imagePreview: optimistic.imagePreview, imageName: file.name } : message)]
        onMessages?.(res, next)
        return next
      })
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id))
      toast.error("Welya couldn't read that image", { description: e.message })
    }
  }, [conversationId, context, imageChat, onMessages, persist])

  return { messages, setMessages, send, sendImage, thinking: chat.isPending || imageChat.isPending }
}

const REF_ICON = { task: LayoutListIcon, inbox: InboxIcon, document: FileTextIcon }

function ReferenceChip({ reference }) {
  const navigate = useNavigate()
  const Icon = REF_ICON[reference.type] ?? LayoutListIcon
  const target =
    reference.type === "task" ? `/tasks?task=${reference.id}` : reference.type === "inbox" ? `/inbox?item=${reference.id}` : `/documents?doc=${reference.id}`
  return (
    <Badge variant="outline" className="h-6 max-w-full cursor-pointer gap-1 hover:bg-muted" render={<button type="button" onClick={() => navigate(target)} />}>
      <Icon />
      <span className="truncate">{reference.label}</span>
    </Badge>
  )
}

export function ChatMessage({ message, onAction, onPrompt }) {
  const isUser = message.role === "user"
  const [done, setDone] = React.useState({})
  const visibleContent = message.content?.replace(/\n\n\[Image attached: .*\]$/, "")
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {!isUser && (
        <Avatar size="sm" className="mt-0.5">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <WelyaLogo className="size-3.5" />
          </AvatarFallback>
        </Avatar>
      )}
      <div className={cn("flex max-w-[85%] flex-col gap-2", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            isUser ? "rounded-tr-md bg-primary text-primary-foreground whitespace-pre-line" : "rounded-tl-md bg-muted"
          )}
        >
          {isUser && message.imagePreview && <img src={message.imagePreview} alt={message.imageName ?? "Attached academic image"} className="mb-2 max-h-56 max-w-full rounded-lg object-contain" />}
          {isUser ? visibleContent : <Markdown>{message.content}</Markdown>}
        </div>
        {message.references?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.references.map((r) => (
              <ReferenceChip key={`${r.type}-${r.id}`} reference={r} />
            ))}
          </div>
        )}
        {message.actions?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.actions.map((a, i) => (
              <Button
                key={i}
                size="sm"
                variant={i === 0 ? "default" : "outline"}
                disabled={done[i]}
                onClick={() => {
                  if (a.kind === "prompt") return onPrompt?.(a.label ?? a.prompt)
                  Promise.resolve(onAction?.({ ...a, messageContent: message.content })).then((completed) => {
                    if (completed !== false && ["plan", "plan-week", "schedule-courses", "create-task", "create-event", "breakdown"].includes(a.kind)) setDone((d) => ({ ...d, [i]: true }))
                  }).catch((error) => toast.error("Welya couldn't complete that action", { description: error.message }))
                }}
              >
                {done[i] ? <CheckIcon data-icon="inline-start" /> : a.kind?.startsWith("plan") ? <CalendarPlusIcon data-icon="inline-start" /> : null}
                {a.label}
              </Button>
            ))}
          </div>
        )}
        <span className="text-[10px] text-muted-foreground">{fmtTime(message.time)}</span>
      </div>
    </div>
  )
}

export function ThinkingBubble() {
  return (
    <div className="flex gap-3">
      <Avatar size="sm" className="mt-0.5">
        <AvatarFallback className="bg-primary text-primary-foreground">
          <WelyaLogo className="size-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
        <Spinner className="size-3.5" /> Welya is checking your tasks and calendar…
      </div>
    </div>
  )
}

export function ChatComposer({ onSend, onSendImage, disabled, placeholder = "Ask Welya anything about your academic life…", autoFocus }) {
  const [value, setValue] = React.useState("")
  const [file, setFile] = React.useState(null)
  const fileRef = React.useRef(null)
  const submit = () => {
    if (disabled) return
    if (file) {
      onSendImage?.(file, value)
      setFile(null)
      setValue("")
      return
    }
    if (!value.trim()) return
    onSend(value)
    setValue("")
  }
  return (
    <div className="rounded-xl border bg-background p-2 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      <Textarea
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder}
        rows={2}
        className="min-h-0 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      {file && (
        <div className="px-1 pb-1">
          <Badge variant="secondary" className="max-w-full gap-1.5 rounded-md border bg-muted/70 pr-1 text-xs font-normal">
            <ImageIcon className="size-3.5 shrink-0 text-primary" />
            <span className="min-w-0 truncate">{file.name}</span>
            <Button type="button" size="icon-xs" variant="ghost" className="ml-0.5 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setFile(null)} aria-label="Remove attached image" title="Remove attached image">
              <XIcon />
            </Button>
          </Badge>
        </div>
      )}
      <div className="flex items-center justify-between pt-1">
        <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
          <Kbd>Enter</Kbd> to send · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> new line
        </span>
        <div className="flex items-center gap-1">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => fileRef.current?.click()} disabled={disabled} aria-label="Attach image" title="Attach image"><ImageIcon /></Button>
          <Button size="icon-sm" onClick={submit} disabled={disabled || (!value.trim() && !file)} aria-label="Send">
          <ArrowUpIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AIChat({ context, conversationId = null, persist = false, initialMessages, suggestions, onMessages, className, emptyTitle = "Ask Welya", emptyDescription }) {
  const { suggestedPrompts } = useAppStore()
  const chips = suggestions ?? suggestedPrompts ?? []
  const { messages, send, sendImage, thinking } = useWelyaChat({ context, conversationId, persist, initialMessages, onMessages })
  const runAction = useWelyaActions()
  const bottomRef = React.useRef(null)

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, thinking])

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <WelyaLogo className="size-6" />
              </div>
              <div>
                <p className="font-heading font-medium">{emptyTitle}</p>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                  {emptyDescription ?? "Welya knows your tasks, classes, inbox and documents. Ask about anything, or pick a suggestion."}
                </p>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} onAction={runAction} onPrompt={send} />
          ))}
          {thinking && <ThinkingBubble />}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="space-y-2 border-t p-3">
        {chips.length > 0 && (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
            {chips.map((s) => (
              <Button key={s} size="xs" variant="outline" className="shrink-0 rounded-full" onClick={() => send(s)} disabled={thinking}>
                {s}
              </Button>
            ))}
          </div>
        )}
        <ChatComposer onSend={send} onSendImage={sendImage} disabled={thinking} />
      </div>
    </div>
  )
}
