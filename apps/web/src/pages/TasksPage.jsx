import * as React from "react"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAppStore } from "@/store/app-store"
import { useSimulatedLoading } from "@/hooks/use-simulated-loading"
import { PageHeader, EmptyState, ListSkeleton, StatCard, StatCardSkeleton } from "@/components/welya/page-primitives"
import { TaskCard } from "@/components/welya/TaskCard"
import { TaskDetailSheet } from "@/components/welya/TaskDetailSheet"
import { TaskDialog, CourseSelect, WorkspaceSelect } from "@/components/welya/forms"
import { isDueToday, isOverdue } from "@/lib/dates"
import { addDays } from "date-fns"
import { AlertTriangleIcon, CheckCircle2Icon, LayoutListIcon, PlusIcon, SearchIcon, TimerIcon, XIcon } from "lucide-react"

const VIEWS = ["all", "today", "upcoming", "overdue", "completed"]
const ANY = "any"
const PRIORITY_ITEMS = { [ANY]: "Any priority", high: "High", medium: "Medium", low: "Low" }
const STATUS_ITEMS = { [ANY]: "Any status", todo: "To do", "in-progress": "In progress", done: "Done" }
const SORT_ITEMS = { deadline: "Sort: deadline", priority: "Sort: priority", progress: "Sort: progress" }

export default function TasksPage() {
  const { tasks } = useAppStore()
  const [params, setParams] = useSearchParams()
  const loading = useSimulatedLoading(500)
  const [query, setQuery] = React.useState("")
  const [courseId, setCourseId] = React.useState(null)
  const [workspaceId, setWorkspaceId] = React.useState(null)
  const [priority, setPriority] = React.useState(ANY)
  const [status, setStatus] = React.useState(ANY)
  const [sort, setSort] = React.useState("deadline")
  const [newOpen, setNewOpen] = React.useState(false)

  const view = VIEWS.includes(params.get("view")) ? params.get("view") : "all"
  const selectedTaskId = params.get("task")
  const setView = (v) => setParams((p) => { p.set("view", v); p.delete("task"); return p })
  const openTask = (t) => setParams((p) => { p.set("task", t.id); return p })
  const closeTask = () => setParams((p) => { p.delete("task"); return p })

  const open = tasks.filter((t) => t.status !== "done")
  const byView = {
    today: open.filter((t) => isDueToday(t) || isOverdue(t)),
    upcoming: open.filter((t) => new Date(t.deadline) > new Date() && !isDueToday(t)),
    overdue: open.filter(isOverdue),
    completed: tasks.filter((t) => t.status === "done"),
    all: tasks,
  }
  const counts = Object.fromEntries(Object.entries(byView).map(([k, v]) => [k, v.length]))

  const filtered = byView[view]
    .filter((t) => (courseId ? t.courseId === courseId : true))
    .filter((t) => (workspaceId ? t.workspaceId === workspaceId : true))
    .filter((t) => (priority !== ANY ? t.priority === priority : true))
    .filter((t) => (status !== ANY ? t.status === status : true))
    .filter((t) => (query ? `${t.title} ${t.description}`.toLowerCase().includes(query.toLowerCase()) : true))
    .sort((a, b) => {
      if (sort === "priority") {
        const p = { high: 0, medium: 1, low: 2 }
        return p[a.priority] - p[b.priority] || new Date(a.deadline) - new Date(b.deadline)
      }
      if (sort === "progress") return b.progress - a.progress
      return new Date(a.deadline) - new Date(b.deadline)
    })

  const hasFilters = courseId || workspaceId || priority !== ANY || status !== ANY || query
  const clear = () => { setCourseId(null); setWorkspaceId(null); setPriority(ANY); setStatus(ANY); setQuery("") }
  const thisWeek = open.filter((t) => new Date(t.deadline) <= addDays(new Date(), 7)).length

  const emptyCopy = {
    today: ["Nothing due today", "Enjoy the breathing room — or get ahead on upcoming work."],
    upcoming: ["No upcoming tasks", "New assignments from your inbox will show up here."],
    overdue: ["Nothing overdue", "You're on top of every deadline."],
    completed: ["No completed tasks yet", "Finish a task and it will be recorded here."],
    all: ["No tasks", "Create your first task or let Welya extract one from your inbox."],
  }[view]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        description="Every assignment, reading and to-do — understood by Welya, linked to your courses and calendar."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <PlusIcon data-icon="inline-start" /> New task
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Due today" value={counts.today - counts.overdue} icon={TimerIcon} tone="primary" />
            <StatCard label="Overdue" value={counts.overdue} icon={AlertTriangleIcon} tone={counts.overdue ? "destructive" : "default"} />
            <StatCard label="Due this week" value={thisWeek} icon={LayoutListIcon} />
            <StatCard label="Completed" value={counts.completed} icon={CheckCircle2Icon} tone="success" />
          </>
        )}
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          {VIEWS.map((v) => (
            <TabsTrigger key={v} value={v} className="capitalize">
              {v}
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{counts[v]}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks…" className="pl-8" />
        </div>
        <CourseSelect value={courseId} onChange={setCourseId} className="w-44" />
        <WorkspaceSelect value={workspaceId} onChange={setWorkspaceId} className="w-44" allowNone />
        <Select items={PRIORITY_ITEMS} value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(PRIORITY_ITEMS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select items={STATUS_ITEMS} value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(STATUS_ITEMS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select items={SORT_ITEMS} value={sort} onValueChange={setSort}>
          <SelectTrigger className="ml-auto w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(SORT_ITEMS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clear}>
            <XIcon data-icon="inline-start" /> Clear
          </Button>
        )}
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={view === "completed" ? CheckCircle2Icon : LayoutListIcon}
          title={hasFilters ? "No tasks match these filters" : emptyCopy[0]}
          description={hasFilters ? "Try clearing a filter or two." : emptyCopy[1]}
          action={hasFilters ? <Button size="sm" variant="outline" onClick={clear}>Clear filters</Button> : <Button size="sm" onClick={() => setNewOpen(true)}><PlusIcon data-icon="inline-start" /> New task</Button>}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <TaskCard key={t.id} task={t} selected={t.id === selectedTaskId} onOpen={openTask} onBreakdown={openTask} />
          ))}
        </div>
      )}

      <TaskDetailSheet taskId={selectedTaskId} open={!!selectedTaskId} onOpenChange={(o) => !o && closeTask()} />
      <TaskDialog open={newOpen} onOpenChange={setNewOpen} defaults={{ courseId }} />
    </div>
  )
}
