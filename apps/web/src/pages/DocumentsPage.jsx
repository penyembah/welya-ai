import * as React from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAppStore } from "@/store/app-store"
import { useSimulatedLoading } from "@/hooks/use-simulated-loading"
import { PageHeader, EmptyState, ListSkeleton } from "@/components/welya/page-primitives"
import { CourseSelect, WorkspaceSelect, NoteDialog, TaskDialog } from "@/components/welya/forms"
import { UploadDialog } from "@/components/welya/UploadDialog"
import { AIChat } from "@/components/welya/AIChat"
import { Markdown } from "@/components/welya/Markdown"
import { CourseChip, SourceIcon } from "@/components/welya/meta"
import { fmtDate } from "@/lib/dates"
import { useDocumentAIMutation } from "@/hooks/use-welya-api"
import { http } from "@/lib/api"
import { CalendarPlusIcon, FileTextIcon, ListPlusIcon, MessageSquareIcon, SearchIcon, SparklesIcon, StickyNoteIcon, UploadIcon } from "lucide-react"

const TYPES = { all: "All", pdf: "PDFs", note: "Notes", image: "Screenshots", doc: "Files" }
const SORT = { newest: "Newest first", oldest: "Oldest first", name: "Name" }

// Files are behind auth, so fetch as a blob and open the object URL
async function openFile(id) {
  try {
    const blob = await http.get(`/files/${id}`, { responseType: "blob" })
    window.open(URL.createObjectURL(blob), "_blank", "noopener")
  } catch (e) {
    toast.error("Couldn't open file", { description: e.message })
  }
}

function DocumentPanel({ doc, onClose }) {
  const { courseById, workspaceById, taskById } = useAppStore()
  const docAI = useDocumentAIMutation()
  const [aiState, setAiState] = React.useState(null) // null | "summarize" | "tasks" | "deadlines" | "chat"
  const [aiOutput, setAiOutput] = React.useState(null)
  const [taskOpen, setTaskOpen] = React.useState(false)
  const course = courseById[doc.courseId]
  const ws = workspaceById[doc.workspaceId]
  const linked = (doc.linkedTaskIds ?? []).map((id) => taskById[id]).filter(Boolean)
  const isUploaded = doc.tags?.includes("uploaded")

  const runAI = async (kind) => {
    setAiState(kind)
    setAiOutput(null)
    try {
      const res = await docAI.mutateAsync({ documentId: doc.id, action: kind })
      if (kind === "notes") {
        toast.success("Notes created", { description: res.note?.title })
        setAiState(null)
        return
      }
      setAiOutput({ ...res, action: res.suggestedTask ? "task" : null })
    } catch (e) {
      toast.error("Welya couldn't analyze this document", { description: e.message })
      setAiState(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted"><SourceIcon source={doc.type} className="size-5 text-muted-foreground" /></div>
            <div className="min-w-0 space-y-1">
              <h2 className="font-heading text-lg font-semibold leading-snug break-all">{doc.title}</h2>
              <p className="text-xs text-muted-foreground">{doc.size}{doc.pages ? ` · ${doc.pages} pages` : ""} · Added {fmtDate(doc.uploadedAt)}</p>
              {isUploaded && (
                <Button size="xs" variant="outline" onClick={() => openFile(doc.id)}>
                  <FileTextIcon data-icon="inline-start" /> Open file
                </Button>
              )}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {course && <CourseChip course={course} />}
                {ws && <Badge variant="outline">{ws.name}</Badge>}
                {doc.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-line">{doc.content ?? doc.summary}</div>

          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase"><SparklesIcon className="size-3 text-primary" /> Ask Welya to</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Button size="sm" variant="outline" onClick={() => runAI("summarize")}>Summarize</Button>
              <Button size="sm" variant="outline" onClick={() => runAI("tasks")}><ListPlusIcon data-icon="inline-start" /> Extract tasks</Button>
              <Button size="sm" variant="outline" onClick={() => runAI("deadlines")}><CalendarPlusIcon data-icon="inline-start" /> Extract deadlines</Button>
              <Button size="sm" variant="outline" onClick={() => runAI("notes")}><StickyNoteIcon data-icon="inline-start" /> Create notes</Button>
              <Button size="sm" className="col-span-2" onClick={() => setAiState("chat")}><MessageSquareIcon data-icon="inline-start" /> Ask about this document</Button>
            </div>
          </div>

          {aiState && aiState !== "chat" && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
              {!aiOutput ? (
                <div className="space-y-2"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner className="size-3" /> Reading {doc.title}…</div><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-3/4" /></div>
              ) : (
                <div className="space-y-2 text-sm">
                  <p className="font-medium">{aiOutput.title}</p>
                  <ul className="list-disc space-y-1 pl-4 text-muted-foreground">{aiOutput.lines.map((l, i) => <li key={i}><Markdown className="text-muted-foreground">{l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")}</Markdown></li>)}</ul>
                  {aiOutput.action === "task" && aiOutput.suggestedTask && <Button size="xs" onClick={() => setTaskOpen(true)}>Create task from this</Button>}
                </div>
              )}
            </div>
          )}

          {linked.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase">Linked tasks</p>
                {linked.map((t) => <Link key={t.id} to={`/tasks?task=${t.id}`} className="flex items-center justify-between rounded-lg border px-2.5 py-2 text-sm hover:bg-muted/40"><span className="truncate">{t.title}</span><Badge variant="outline">{t.progress}%</Badge></Link>)}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
      {aiState === "chat" && (
        <div className="h-80 border-t">
          <AIChat context={{ courseId: doc.courseId, documentId: doc.id }} emptyTitle={`Ask about ${doc.title}`} emptyDescription="Welya has read this document and its linked course." suggestions={["Summarize this", "What should I do with this?", "What deadlines are in here?"]} />
        </div>
      )}
      <TaskDialog open={taskOpen} onOpenChange={setTaskOpen} defaults={{ title: `Review: ${doc.title}`, courseId: doc.courseId, workspaceId: doc.workspaceId, source: { type: "document", label: `Extracted from ${doc.title}` } }} onCreated={onClose} />
    </div>
  )
}

export default function DocumentsPage() {
  const { documents } = useAppStore()
  const [params, setParams] = useSearchParams()
  const loading = useSimulatedLoading(450)
  const [query, setQuery] = React.useState("")
  const [type, setType] = React.useState("all")
  const [courseId, setCourseId] = React.useState(null)
  const [workspaceId, setWorkspaceId] = React.useState(null)
  const [sort, setSort] = React.useState("newest")
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const [noteOpen, setNoteOpen] = React.useState(false)
  const selected = documents.find((d) => d.id === params.get("doc"))

  const filtered = documents
    .filter((d) => (type === "all" ? true : d.type === type))
    .filter((d) => (courseId ? d.courseId === courseId : true))
    .filter((d) => (workspaceId ? d.workspaceId === workspaceId : true))
    .filter((d) => (query ? `${d.title} ${d.summary} ${d.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()) : true))
    .sort((a, b) => (sort === "name" ? a.title.localeCompare(b.title) : sort === "oldest" ? new Date(a.uploadedAt) - new Date(b.uploadedAt) : new Date(b.uploadedAt) - new Date(a.uploadedAt)))

  return (
    <div className="space-y-5">
      <PageHeader title="Notes & Documents" description="Lecture slides, PDFs, screenshots and your own notes — indexed by Welya and linked to courses and tasks." actions={<><Button variant="outline" onClick={() => setNoteOpen(true)}><StickyNoteIcon data-icon="inline-start" /> New note</Button><Button onClick={() => setUploadOpen(true)}><UploadIcon data-icon="inline-start" /> Upload</Button></>} />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={type} onValueChange={setType}><TabsList>{Object.entries(TYPES).map(([v, l]) => <TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}</TabsList></Tabs>
        <div className="relative w-full md:w-72"><SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents…" className="pl-8" /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CourseSelect value={courseId} onChange={setCourseId} className="w-44" />
        <WorkspaceSelect value={workspaceId} onChange={setWorkspaceId} className="w-44" allowNone />
        <Select items={SORT} value={sort} onValueChange={setSort}><SelectTrigger className="ml-auto w-40"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SORT).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
      </div>

      {loading ? <ListSkeleton rows={5} /> : filtered.length === 0 ? (
        <EmptyState icon={FileTextIcon} title="No documents" description="Upload a file or write a note to get started." action={<Button size="sm" onClick={() => setUploadOpen(true)}><UploadIcon data-icon="inline-start" /> Upload</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((d) => <DocumentCard key={d.id} doc={d} selected={d.id === selected?.id} onOpen={() => setParams({ doc: d.id })} />)}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setParams({})}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="sr-only"><SheetTitle>Document</SheetTitle><SheetDescription>Document details and AI actions</SheetDescription></SheetHeader>
          {selected && <DocumentPanel key={selected.id} doc={selected} onClose={() => setParams({})} />}
        </SheetContent>
      </Sheet>
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <NoteDialog open={noteOpen} onOpenChange={setNoteOpen} />
    </div>
  )
}

function DocumentCard({ doc, selected, onOpen }) {
  const { courseById } = useAppStore()
  return (
    <Card size="sm" className={cn("cursor-pointer gap-2 transition-colors hover:bg-muted/30", selected && "ring-primary/40")} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}>
      <div className="flex items-start gap-3 px-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><SourceIcon source={doc.type} className="text-muted-foreground" /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{doc.title}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{doc.summary}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 text-[11px] text-muted-foreground">
        <CourseChip course={courseById[doc.courseId]} className="max-w-40" />
        <span>{fmtDate(doc.uploadedAt)}</span>
      </div>
    </Card>
  )
}
