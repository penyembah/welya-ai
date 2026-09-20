import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { format, parseISO, set } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldError, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Spinner } from "@/components/ui/spinner"
import { useAppStore } from "@/store/app-store"
import { useAsyncAction } from "@/hooks/use-simulated-loading"
import { CourseDot } from "@/components/welya/meta"
import { CalendarIcon, SparklesIcon } from "lucide-react"

const NONE = "none"

const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hour = Math.floor(index / 4).toString().padStart(2, "0")
  const minute = ((index % 4) * 15).toString().padStart(2, "0")
  return `${hour}:${minute}`
})

function DatePicker({ value, onChange, placeholder = "Pick a date" }) {
  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-start font-normal" />}>
        <CalendarIcon data-icon="inline-start" className="text-muted-foreground" />
        {value ? format(value, "PPP") : <span className="text-muted-foreground">{placeholder}</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
      </PopoverContent>
    </Popover>
  )
}

function TimeSelect({ value, onChange, className }) {
  return (
    <Select items={Object.fromEntries(TIME_OPTIONS.map((time) => [time, time]))} value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? "w-full"}><SelectValue placeholder="Select time" /></SelectTrigger>
      <SelectContent>{TIME_OPTIONS.map((time) => <SelectItem key={time} value={time}>{time}</SelectItem>)}</SelectContent>
    </Select>
  )
}

function DateTimePicker({ value, onChange }) {
  const time = value ? format(value, "HH:mm") : "23:59"
  const updateDate = (next) => {
    if (!next) return onChange(next)
    const current = value ?? new Date()
    onChange(set(next, { hours: current.getHours(), minutes: current.getMinutes(), seconds: 0, milliseconds: 0 }))
  }
  const updateTime = (next) => {
    const [hours, minutes] = next.split(":").map(Number)
    onChange(set(value ?? new Date(), { hours, minutes, seconds: 0, milliseconds: 0 }))
  }
  return (
    <div className="grid grid-cols-[1fr_7.5rem] gap-2">
      <DatePicker value={value} onChange={updateDate} />
      <TimeSelect value={time} onChange={updateTime} />
    </div>
  )
}

const asDate = (value, fallback = new Date()) => value instanceof Date ? value : value ? parseISO(`${value}T12:00:00`) : fallback

export function CourseSelect({ value, onChange, allowNone = true, className, size }) {
  const { courses } = useAppStore()
  const items = Object.fromEntries([[NONE, "No course"], ...courses.map((c) => [c.id, c.name])])
  return (
    <Select items={items} value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className={className ?? "w-full"} size={size}>
        <SelectValue placeholder="Select course" />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>No course</SelectItem>}
        {courses.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <CourseDot color={c.color} /> {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function WorkspaceSelect({ value, onChange, className, size, allowNone = false }) {
  const { workspaces } = useAppStore()
  const items = Object.fromEntries([[NONE, "No workspace"], ...workspaces.map((w) => [w.id, w.name])])
  return (
    <Select items={items} value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className={className ?? "w-full"} size={size}>
        <SelectValue placeholder="Select workspace" />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>No workspace</SelectItem>}
        {workspaces.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            <CourseDot color={w.color} /> {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const PRIORITY_ITEMS = { high: "High", medium: "Medium", low: "Low" }

export function PrioritySelect({ value, onChange, className, size }) {
  return (
    <Select items={PRIORITY_ITEMS} value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? "w-full"} size={size}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(PRIORITY_ITEMS).map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const taskSchema = z.object({
  title: z.string().min(3, "Give the task a clear title"),
  description: z.string().optional(),
  courseId: z.string().nullable(),
  workspaceId: z.string().nullable(),
  deadline: z.date({ error: "Pick a deadline" }),
  priority: z.enum(["high", "medium", "low"]),
  estimatedMinutes: z.coerce.number().min(5, "At least 5 minutes").max(1440),
})

export function TaskDialog({ open, onOpenChange, defaults = {}, onCreated }) {
  const { dispatch, workspaces } = useAppStore()
  const [pending, run] = useAsyncAction()
  const form = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      courseId: null,
      workspaceId: workspaces[0]?.id ?? null,
      deadline: set(new Date(Date.now() + 86400000), { hours: 23, minutes: 59, seconds: 0, milliseconds: 0 }),
      priority: "medium",
      estimatedMinutes: 60,
      ...defaults,
    },
  })

  React.useEffect(() => {
    if (open) form.reset({ ...form.formState.defaultValues, ...defaults })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = (values) =>
    run(async () => {
      await dispatch({
        type: "task/add",
        task: { ...values, deadline: values.deadline.toISOString(), source: defaults.source ?? { type: "manual", label: "Added manually" } },
      })
      toast.success("Task created", { description: values.title })
      onOpenChange(false)
      onCreated?.()
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>Welya will link it to your course, calendar and reminders.</DialogDescription>
        </DialogHeader>
        <form id="task-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!form.formState.errors.title}>
              <FieldLabel htmlFor="task-title">Title</FieldLabel>
              <Input id="task-title" placeholder="e.g. Database practicum report – Module 5" {...form.register("title")} aria-invalid={!!form.formState.errors.title} />
              <FieldError errors={[form.formState.errors.title]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="task-desc">Description</FieldLabel>
              <Textarea id="task-desc" rows={3} placeholder="What needs to be done?" {...form.register("description")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Course</FieldLabel>
                <Controller control={form.control} name="courseId" render={({ field }) => <CourseSelect value={field.value} onChange={field.onChange} />} />
              </Field>
              <Field>
                <FieldLabel>Workspace</FieldLabel>
                <Controller control={form.control} name="workspaceId" render={({ field }) => <WorkspaceSelect value={field.value} onChange={field.onChange} />} />
              </Field>
              <Field data-invalid={!!form.formState.errors.deadline}>
                <FieldLabel>Deadline</FieldLabel>
                <Controller control={form.control} name="deadline" render={({ field }) => <DateTimePicker value={field.value} onChange={field.onChange} />} />
                <FieldError errors={[form.formState.errors.deadline]} />
              </Field>
              <Field>
                <FieldLabel>Priority</FieldLabel>
                <Controller control={form.control} name="priority" render={({ field }) => <PrioritySelect value={field.value} onChange={field.onChange} />} />
              </Field>
              <Field data-invalid={!!form.formState.errors.estimatedMinutes} className="sm:col-span-2">
                <FieldLabel htmlFor="task-est">Estimated duration (minutes)</FieldLabel>
                <Input id="task-est" type="number" min={5} step={5} {...form.register("estimatedMinutes")} />
                <FieldDescription>Welya uses this to find a slot in your calendar.</FieldDescription>
                <FieldError errors={[form.formState.errors.estimatedMinutes]} />
              </Field>
            </div>
          </FieldGroup>
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="task-form" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const eventSchema = z.object({
  title: z.string().min(2, "Give the event a title"),
  type: z.enum(["class", "meeting", "reminder", "work-session", "deadline"]),
  courseId: z.string().nullable(),
  date: z.date({ error: "Pick a date" }),
  start: z.string().min(1, "Start time"),
  end: z.string().min(1, "End time"),
  location: z.string().optional(),
})

const EVENT_TYPE_ITEMS = { class: "Class", meeting: "Meeting", reminder: "Reminder", "work-session": "Work session", deadline: "Deadline" }

export function EventDialog({ open, onOpenChange, defaults = {} }) {
  const { dispatch } = useAppStore()
  const [pending, run] = useAsyncAction()
  const normalizedDefaults = { ...defaults, ...(defaults.date ? { date: asDate(defaults.date) } : {}) }
  const form = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      type: "meeting",
      courseId: null,
      date: new Date(),
      start: "14:00",
      end: "15:00",
      location: "",
      ...normalizedDefaults,
    },
  })

  React.useEffect(() => {
    if (open) form.reset({ ...form.formState.defaultValues, ...normalizedDefaults })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = (values) =>
    run(async () => {
      await dispatch({
        type: "event/add",
        event: {
          title: values.title,
          type: values.type,
          courseId: values.courseId,
          location: values.location,
          start: new Date(`${format(values.date, "yyyy-MM-dd")}T${values.start}`).toISOString(),
          end: new Date(`${format(values.date, "yyyy-MM-dd")}T${values.end}`).toISOString(),
        },
      })
      toast.success("Event added to calendar", { description: values.title })
      onOpenChange(false)
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
          <DialogDescription>Add a class, meeting or reminder to your calendar.</DialogDescription>
        </DialogHeader>
        <form id="event-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!form.formState.errors.title}>
              <FieldLabel htmlFor="ev-title">Title</FieldLabel>
              <Input id="ev-title" placeholder="e.g. Thesis supervisor meeting" {...form.register("title")} />
              <FieldError errors={[form.formState.errors.title]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Type</FieldLabel>
                <Controller control={form.control} name="type" render={({ field }) => (
                  <Select items={EVENT_TYPE_ITEMS} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(EVENT_TYPE_ITEMS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </Field>
              <Field>
                <FieldLabel>Course</FieldLabel>
                <Controller control={form.control} name="courseId" render={({ field }) => <CourseSelect value={field.value} onChange={field.onChange} />} />
              </Field>
              <Field className="sm:col-span-2" data-invalid={!!form.formState.errors.date}>
                <FieldLabel>Date</FieldLabel>
                <Controller control={form.control} name="date" render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />} />
                <FieldError errors={[form.formState.errors.date]} />
              </Field>
              <Field>
                <FieldLabel>Start</FieldLabel>
                <Controller control={form.control} name="start" render={({ field }) => <TimeSelect value={field.value} onChange={field.onChange} />} />
              </Field>
              <Field>
                <FieldLabel>End</FieldLabel>
                <Controller control={form.control} name="end" render={({ field }) => <TimeSelect value={field.value} onChange={field.onChange} />} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="ev-loc">Location</FieldLabel>
                <Input id="ev-loc" placeholder="Room or link" {...form.register("location")} />
              </Field>
            </div>
          </FieldGroup>
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="event-form" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Add event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const noteSchema = z.object({
  title: z.string().min(2, "Give the note a title"),
  content: z.string().min(3, "Write something"),
  courseId: z.string().nullable(),
  workspaceId: z.string().nullable(),
})

export function NoteDialog({ open, onOpenChange, defaults = {} }) {
  const { dispatch, workspaces } = useAppStore()
  const [pending, run] = useAsyncAction()
  const form = useForm({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: "", content: "", courseId: null, workspaceId: workspaces[0]?.id ?? null, ...defaults },
  })

  React.useEffect(() => {
    if (open) form.reset({ ...form.formState.defaultValues, ...defaults })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = (values) =>
    run(async () => {
      await dispatch({
        type: "document/add",
        document: { ...values, type: "note", size: "—", summary: values.content.slice(0, 120), tags: ["notes"] },
      })
      toast.success("Note saved", { description: values.title })
      onOpenChange(false)
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New note</DialogTitle>
          <DialogDescription>Notes are searchable and can be linked to courses and tasks.</DialogDescription>
        </DialogHeader>
        <form id="note-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!form.formState.errors.title}>
              <FieldLabel htmlFor="note-title">Title</FieldLabel>
              <Input id="note-title" placeholder="e.g. Lecture notes – normalization" {...form.register("title")} />
              <FieldError errors={[form.formState.errors.title]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.content}>
              <FieldLabel htmlFor="note-content">Content</FieldLabel>
              <Textarea id="note-content" rows={5} placeholder="Write your note…" {...form.register("content")} />
              <FieldError errors={[form.formState.errors.content]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Course</FieldLabel>
                <Controller control={form.control} name="courseId" render={({ field }) => <CourseSelect value={field.value} onChange={field.onChange} />} />
              </Field>
              <Field>
                <FieldLabel>Workspace</FieldLabel>
                <Controller control={form.control} name="workspaceId" render={({ field }) => <WorkspaceSelect value={field.value} onChange={field.onChange} />} />
              </Field>
            </div>
          </FieldGroup>
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="note-form" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const workspaceSchema = z.object({
  name: z.string().min(2, "Name your workspace"),
  description: z.string().optional(),
  type: z.enum(["Academic", "Organization", "Research", "Project", "Personal"]),
  color: z.enum(["teal", "sky", "violet", "amber", "rose"]),
})

const WS_TYPE_ITEMS = { Academic: "Academic", Organization: "Organization", Research: "Research", Project: "Project", Personal: "Personal" }
const WS_COLOR_ITEMS = { teal: "Teal", sky: "Sky", violet: "Violet", amber: "Amber", rose: "Rose" }
const WS_ICON = { Academic: "GraduationCap", Organization: "Users", Research: "BookOpen", Project: "Briefcase", Personal: "Heart" }

export function WorkspaceDialog({ open, onOpenChange, workspace }) {
  const { dispatch } = useAppStore()
  const [pending, run] = useAsyncAction()
  const editing = !!workspace
  const form = useForm({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: "", description: "", type: "Project", color: "teal" },
  })

  React.useEffect(() => {
    if (open) form.reset(workspace ? { name: workspace.name, description: workspace.description, type: workspace.type, color: workspace.color } : { name: "", description: "", type: "Project", color: "teal" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspace])

  const onSubmit = (values) =>
    run(async () => {
      if (editing) {
        await dispatch({ type: "workspace/update", id: workspace.id, patch: { ...values, icon: WS_ICON[values.type] } })
        toast.success("Workspace updated")
      } else {
        await dispatch({ type: "workspace/add", workspace: { ...values, icon: WS_ICON[values.type] } })
        toast.success("Workspace created", { description: values.name })
      }
      onOpenChange(false)
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit workspace" : "New workspace"}</DialogTitle>
          <DialogDescription>Group tasks, notes and documents around a semester, organization or project.</DialogDescription>
        </DialogHeader>
        <form id="ws-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="ws-name">Name</FieldLabel>
              <Input id="ws-name" placeholder="e.g. Semester 6" {...form.register("name")} />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ws-desc">Description</FieldLabel>
              <Textarea id="ws-desc" rows={2} {...form.register("description")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Type</FieldLabel>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select items={WS_TYPE_ITEMS} value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(WS_TYPE_ITEMS).map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel>Color</FieldLabel>
                <Controller
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <Select items={WS_COLOR_ITEMS} value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(WS_COLOR_ITEMS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            <CourseDot color={v} /> {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
          </FieldGroup>
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="ws-form" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {editing ? "Save changes" : "Create workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
