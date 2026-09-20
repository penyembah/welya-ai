import * as React from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useAppStore } from "@/store/app-store"
import { useSimulatedLoading } from "@/hooks/use-simulated-loading"
import { PageHeader, EmptyState, ListSkeleton, StatCard } from "@/components/welya/page-primitives"
import { WorkspaceCard, WORKSPACE_ICONS } from "@/components/welya/cards"
import { WorkspaceDialog } from "@/components/welya/forms"
import { TaskCard } from "@/components/welya/TaskCard"
import { TaskDetailSheet } from "@/components/welya/TaskDetailSheet"
import { AIChat } from "@/components/welya/AIChat"
import { TimelineItem } from "@/components/welya/ScheduleTimeline"
import { QuickActions } from "@/pages/HomePage"
import { colorOf, SourceIcon } from "@/components/welya/meta"
import { fmtDate } from "@/lib/dates"
import { ArrowLeftIcon, BriefcaseIcon, CalendarIcon, FileTextIcon, FolderKanbanIcon, LayoutListIcon, PencilIcon, PlusIcon, SparklesIcon, Trash2Icon, UsersIcon } from "lucide-react"

export function WorkspacesPage() {
  const { workspaces } = useAppStore()
  const loading = useSimulatedLoading(450)
  const [dialog, setDialog] = React.useState({ open: false, workspace: null })
  return (
    <div className="space-y-5">
      <PageHeader title="Workspaces" description="Group tasks, notes and documents around a semester, organization, thesis or side project." actions={<Button onClick={() => setDialog({ open: true, workspace: null })}><PlusIcon data-icon="inline-start" /> New workspace</Button>} />
      {loading ? <ListSkeleton rows={3} /> : workspaces.length === 0 ? (
        <EmptyState icon={FolderKanbanIcon} title="No workspaces yet" description="Create one to keep different parts of your life organized." action={<Button size="sm" onClick={() => setDialog({ open: true, workspace: null })}>Create workspace</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{workspaces.map((w) => <WorkspaceCard key={w.id} workspace={w} onEdit={(ws) => setDialog({ open: true, workspace: ws })} />)}</div>
      )}
      <WorkspaceDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} workspace={dialog.workspace} />
    </div>
  )
}

export function WorkspaceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { workspaceById, tasks, documents, events, dispatch } = useAppStore()
  const loading = useSimulatedLoading(400, [id])
  const [taskId, setTaskId] = React.useState(null)
  const [editOpen, setEditOpen] = React.useState(false)
  const [confirm, setConfirm] = React.useState(false)
  const ws = workspaceById[id]
  const tab = ["tasks", "notes", "documents", "calendar", "ai"].includes(params.get("tab")) ? params.get("tab") : "tasks"

  if (!ws) return <EmptyState icon={FolderKanbanIcon} title="Workspace not found" action={<Button size="sm" variant="outline" render={<Link to="/workspaces" />}><ArrowLeftIcon data-icon="inline-start" /> Back</Button>} />

  const Icon = WORKSPACE_ICONS[ws.icon] ?? BriefcaseIcon
  const c = colorOf(ws.color)
  const wsTasks = tasks.filter((t) => t.workspaceId === id).sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
  const open = wsTasks.filter((t) => t.status !== "done")
  const docs = documents.filter((d) => d.workspaceId === id && d.type !== "note")
  const notes = documents.filter((d) => d.workspaceId === id && d.type === "note")
  const taskIds = new Set(wsTasks.map((t) => t.id))
  const wsEvents = events.filter((e) => e.workspaceId === id || taskIds.has(e.taskId)).filter((e) => new Date(e.start) >= new Date()).sort((a, b) => new Date(a.start) - new Date(b.start))

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={ws.type}
        title={<span className="inline-flex items-center gap-2"><span className={`flex size-8 items-center justify-center rounded-lg ${c.soft}`}><Icon className="size-4" /></span>{ws.name}</span>}
        description={ws.description}
        actions={<><Button variant="outline" onClick={() => setEditOpen(true)}><PencilIcon data-icon="inline-start" /> Edit</Button><Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirm(true)}><Trash2Icon /></Button><QuickActions workspaceId={id} /></>}
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Open tasks" value={open.length} hint={`${wsTasks.length - open.length} completed`} icon={LayoutListIcon} tone="primary" />
        <StatCard label="Documents" value={docs.length} icon={FileTextIcon} />
        <StatCard label="Notes" value={notes.length} icon={FileTextIcon} />
        <StatCard label="Members" value={ws.members} icon={UsersIcon} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="ai"><SparklesIcon /> AI</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="space-y-2 pt-3">
          {loading ? <ListSkeleton rows={3} /> : wsTasks.length === 0 ? <EmptyState icon={LayoutListIcon} title="No tasks in this workspace" /> : wsTasks.map((t) => <TaskCard key={t.id} task={t} onOpen={(x) => setTaskId(x.id)} onBreakdown={(x) => setTaskId(x.id)} />)}
        </TabsContent>
        <TabsContent value="notes" className="pt-3">
          {notes.length === 0 ? <EmptyState icon={FileTextIcon} title="No notes" /> : <div className="grid gap-2 sm:grid-cols-2">{notes.map((d) => <Link key={d.id} to={`/documents?doc=${d.id}`} className="rounded-xl border p-3 text-sm hover:bg-muted/40"><p className="font-medium">{d.title}</p><p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{d.content ?? d.summary}</p></Link>)}</div>}
        </TabsContent>
        <TabsContent value="documents" className="pt-3">
          {docs.length === 0 ? <EmptyState icon={FileTextIcon} title="No documents" /> : <div className="grid gap-2 sm:grid-cols-2">{docs.map((d) => <Link key={d.id} to={`/documents?doc=${d.id}`} className="flex items-start gap-3 rounded-xl border p-3 text-sm hover:bg-muted/40"><div className="flex size-9 items-center justify-center rounded-lg bg-muted"><SourceIcon source={d.type} className="text-muted-foreground" /></div><div className="min-w-0"><p className="truncate font-medium">{d.title}</p><p className="text-[11px] text-muted-foreground">{d.size} · {fmtDate(d.uploadedAt)}</p></div></Link>)}</div>}
        </TabsContent>
        <TabsContent value="calendar" className="space-y-1.5 pt-3">
          {wsEvents.length === 0 ? <EmptyState icon={CalendarIcon} title="Nothing scheduled" /> : wsEvents.map((e) => <div key={e.id} className="grid gap-1 sm:grid-cols-[110px_1fr]"><span className="pt-2 text-xs text-muted-foreground">{fmtDate(e.start)}</span><TimelineItem item={e} /></div>)}
        </TabsContent>
        <TabsContent value="ai" className="pt-3">
          <Card className="h-[560px] gap-0 py-0">
            <AIChat context={{ workspaceId: id }} emptyTitle={`Ask Welya about ${ws.name}`} suggestions={["What's left to do here?", "What deadlines are coming?", "Plan my week", "Help me organize this project"]} />
          </Card>
        </TabsContent>
      </Tabs>

      <TaskDetailSheet taskId={taskId} open={!!taskId} onOpenChange={(o) => !o && setTaskId(null)} />
      <WorkspaceDialog open={editOpen} onOpenChange={setEditOpen} workspace={ws} />
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete workspace?</AlertDialogTitle><AlertDialogDescription>Tasks and documents stay, but they will no longer be grouped under “{ws.name}”.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { dispatch({ type: "workspace/delete", id }); toast("Workspace deleted"); navigate("/workspaces") }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
