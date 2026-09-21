import * as React from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { useAppStore } from "@/store/app-store"
import { useSimulatedLoading } from "@/hooks/use-simulated-loading"
import { PageHeader, EmptyState, ListSkeleton, StatCard } from "@/components/welya/page-primitives"
import { TaskCard } from "@/components/welya/TaskCard"
import { TaskDetailSheet } from "@/components/welya/TaskDetailSheet"
import { AIChat } from "@/components/welya/AIChat"
import { InboxItem } from "@/components/welya/InboxItem"
import { TimelineItem } from "@/components/welya/ScheduleTimeline"
import { QuickActions } from "@/pages/HomePage"
import { colorOf, SourceIcon } from "@/components/welya/meta"
import { fmtDate, relativeDeadline, isOverdue } from "@/lib/dates"
import { withDeadlines } from "@/lib/schedule"
import { ArrowLeftIcon, BookOpenIcon, CalendarIcon, ClockIcon, FileTextIcon, LayoutListIcon, MapPinIcon, SparklesIcon, UserIcon } from "lucide-react"

const TABS = ["overview", "tasks", "materials", "notes", "announcements", "calendar", "ai"]

export default function CourseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { courseById, tasks, documents, inboxItems, events } = useAppStore()
  const loading = useSimulatedLoading(450, [id])
  const [taskId, setTaskId] = React.useState(null)
  const course = courseById[id]
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "overview"

  if (!course) {
    return (
      <EmptyState icon={BookOpenIcon} title="Course not found" description="This course may have been removed." action={<Button size="sm" variant="outline" render={<Link to="/courses" />}><ArrowLeftIcon data-icon="inline-start" /> Back to courses</Button>} />
    )
  }

  const c = colorOf(course.color)
  const courseTasks = tasks.filter((t) => t.courseId === id).sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
  const open = courseTasks.filter((t) => t.status !== "done")
  const materials = documents.filter((d) => d.courseId === id && d.type !== "note")
  const notes = documents.filter((d) => d.courseId === id && d.type === "note")
  const announcements = inboxItems.filter((i) => i.courseId === id).sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
  const courseEvents = withDeadlines(events, tasks).filter((e) => e.courseId === id && new Date(e.start) >= new Date()).sort((a, b) => new Date(a.start) - new Date(b.start))
  const next = open[0]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<span className="font-mono">{course.code}</span>}
        title={course.name}
        actions={<><Button variant="outline" onClick={() => setParams({ tab: "ai" })}><SparklesIcon data-icon="inline-start" /> Ask about this course</Button><QuickActions courseId={id} /></>}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><UserIcon className="size-3.5" /> {course.lecturer}</span>
          <span className="inline-flex items-center gap-1.5"><MapPinIcon className="size-3.5" /> {course.room}</span>
          <Badge variant="secondary" className={c.soft}>{course.credits} SKS</Badge>
        </div>
      </PageHeader>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{open.length}</Badge></TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="ai"><SparklesIcon /> AI</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5 pt-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Open tasks" value={open.length} hint={`${courseTasks.length - open.length} completed`} icon={LayoutListIcon} tone="primary" />
            <StatCard label="Next deadline" value={next ? relativeDeadline(next.deadline) : "—"} hint={next?.title} icon={ClockIcon} tone={next && isOverdue(next) ? "destructive" : "default"} />
            <StatCard label="Materials" value={materials.length + notes.length} hint={`${notes.length} notes`} icon={FileTextIcon} />
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Weekly schedule</CardTitle><CardDescription>Regular sessions for this course.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {course.schedule.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                    <div className={cn("w-1 self-stretch rounded-full", c.bar)} />
                    <span className="w-10 font-medium">{s.day}</span>
                    <span className="text-muted-foreground">{s.start}–{s.end}</span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPinIcon className="size-3" /> {s.room}</span>
                    <Badge variant="outline" className="ml-auto">{s.type}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Progress</CardTitle><CardDescription>Semester completion</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end justify-between"><span className="font-heading text-3xl font-semibold">{course.progress}%</span><span className="text-xs text-muted-foreground">of syllabus</span></div>
                <Progress value={course.progress} />
                {next && <p className="text-xs text-muted-foreground">Up next: <button className="text-foreground underline-offset-2 hover:underline" onClick={() => setTaskId(next.id)}>{next.title}</button></p>}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Upcoming deadlines</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {loading ? <ListSkeleton rows={2} /> : open.length === 0 ? <p className="text-sm text-muted-foreground">No open tasks for this course.</p> : open.slice(0, 3).map((t) => <TaskCard key={t.id} task={t} compact onOpen={(x) => setTaskId(x.id)} onBreakdown={(x) => setTaskId(x.id)} />)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-2 pt-3">
          {loading ? <ListSkeleton rows={3} /> : courseTasks.length === 0 ? <EmptyState icon={LayoutListIcon} title="No tasks yet" description="Tasks from lecturer emails and announcements will appear here." /> : courseTasks.map((t) => <TaskCard key={t.id} task={t} onOpen={(x) => setTaskId(x.id)} onBreakdown={(x) => setTaskId(x.id)} />)}
        </TabsContent>

        <TabsContent value="materials" className="pt-3">
          {materials.length === 0 ? <EmptyState icon={FileTextIcon} title="No materials" description="Upload slides or PDFs and Welya will link them here." /> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {materials.map((d) => (
                <Link key={d.id} to={`/documents?doc=${d.id}`} className="flex items-start gap-3 rounded-xl border p-3 text-sm hover:bg-muted/40">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted"><SourceIcon source={d.type} className="text-muted-foreground" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{d.title}</p><p className="line-clamp-2 text-xs text-muted-foreground">{d.summary}</p><p className="mt-1 text-[11px] text-muted-foreground">{d.size} · {fmtDate(d.uploadedAt)}</p></div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="pt-3">
          {notes.length === 0 ? <EmptyState icon={FileTextIcon} title="No notes" description="Notes you write or save from the inbox for this course show up here." /> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {notes.map((d) => (
                <Link key={d.id} to={`/documents?doc=${d.id}`} className="rounded-xl border p-3 text-sm hover:bg-muted/40">
                  <p className="font-medium">{d.title}</p>
                  <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{d.content ?? d.summary}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">{fmtDate(d.uploadedAt)}</p>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="announcements" className="pt-3">
          {announcements.length === 0 ? <EmptyState icon={SparklesIcon} title="No announcements" description="Emails and messages tagged with this course will appear here." /> : (
            <div className="overflow-hidden rounded-xl border">{announcements.map((i) => <InboxItem key={i.id} item={i} onSelect={(it) => navigate(`/inbox?item=${it.id}`)} />)}</div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="space-y-1.5 pt-3">
          {courseEvents.length === 0 ? <EmptyState icon={CalendarIcon} title="Nothing scheduled" /> : courseEvents.slice(0, 12).map((e) => <div key={e.id} className="grid gap-1 sm:grid-cols-[110px_1fr]"><span className="pt-2 text-xs text-muted-foreground">{fmtDate(e.start)}</span><TimelineItem item={e} /></div>)}
        </TabsContent>

        <TabsContent value="ai" className="pt-3">
          <Card className="h-[560px] gap-0 py-0">
            <AIChat
              context={{ courseId: id }}
              emptyTitle={`Ask Welya about ${course.name}`}
              emptyDescription="Welya knows this course's tasks, materials, announcements and schedule."
              suggestions={["What assignments do I have for this course?", "Summarize the latest announcements.", "What is the next deadline?", "Create a study plan for this course."]}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <TaskDetailSheet taskId={taskId} open={!!taskId} onOpenChange={(o) => !o && setTaskId(null)} />
    </div>
  )
}
