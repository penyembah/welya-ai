import * as React from "react"
import { useSearchParams } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import { useAppStore } from "@/store/app-store"
import { useSimulatedLoading, useAsyncAction } from "@/hooks/use-simulated-loading"
import { useIsMobile } from "@/hooks/use-mobile"
import { PageHeader, EmptyState, ErrorState } from "@/components/welya/page-primitives"
import { InboxItem, InboxItemSkeleton, AIActionPanel } from "@/components/welya/InboxItem"
import { SOURCE_META } from "@/components/welya/meta"
import { UploadDialog } from "@/components/welya/UploadDialog"
import { toast } from "sonner"
import { CheckCheckIcon, InboxIcon, PencilLineIcon, SearchIcon, SparklesIcon, StarIcon, UploadIcon } from "lucide-react"

const SOURCES = ["email", "message", "pdf", "screenshot", "document", "manual"]

function ManualInputDialog({ open, onOpenChange }) {
  const { dispatch } = useAppStore()
  const [text, setText] = React.useState("")
  const [pending, run] = useAsyncAction()
  const submit = () =>
    run(async () => {
      // No `ai` field: the API interprets the text and assigns a course on insert
      await dispatch({
        type: "inbox/add",
        item: { source: "manual", sender: "You", subject: text.split("\n")[0].slice(0, 60), preview: text.slice(0, 100), body: text, courseId: null, ai: {} },
      })
      toast.success("Added to inbox", { description: "Welya has interpreted it — open it to confirm." })
      setText("")
      onOpenChange(false)
    })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Paste or type information</DialogTitle>
          <DialogDescription>Paste an announcement, a chat message, or anything academic. Welya will figure out what it is.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="manual-text">Content</FieldLabel>
          <Textarea id="manual-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Laporan praktikum dikumpulkan Jumat pukul 23.59." />
        </Field>
        <DialogFooter showCloseButton>
          <Button onClick={submit} disabled={pending || text.trim().length < 5}>
            <SparklesIcon data-icon="inline-start" /> Send to Welya
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function InboxPage() {
  const { inboxItems, courses, dispatch } = useAppStore()
  const [params, setParams] = useSearchParams()
  const loading = useSimulatedLoading(500)
  const isMobile = useIsMobile()
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState("unprocessed")
  const [sources, setSources] = React.useState([])
  const [courseFilter, setCourseFilter] = React.useState(null)
  const [importantOnly, setImportantOnly] = React.useState(false)
  const [manualOpen, setManualOpen] = React.useState(false)
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const [error, setError] = React.useState(false)

  const selectedId = params.get("item")
  const selected = inboxItems.find((i) => i.id === selectedId)
  const select = (item) => setParams(item ? { item: item.id } : {})

  const counts = {
    unprocessed: inboxItems.filter((i) => i.status === "unprocessed").length,
    processed: inboxItems.filter((i) => i.status === "processed").length,
    ignored: inboxItems.filter((i) => i.status === "ignored").length,
    important: inboxItems.filter((i) => i.importance === "high" && i.status !== "ignored").length,
  }

  const filtered = inboxItems
    .filter((i) => (status === "all" ? true : i.status === status))
    .filter((i) => (sources.length ? sources.includes(i.source) : true))
    .filter((i) => (courseFilter ? i.courseId === courseFilter : true))
    .filter((i) => (importantOnly ? i.importance === "high" : true))
    .filter((i) => (query ? `${i.subject} ${i.sender} ${i.preview}`.toLowerCase().includes(query.toLowerCase()) : true))
    .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))

  const processAll = () => {
    const un = inboxItems.filter((i) => i.status === "unprocessed" && (i.ai?.confidence ?? 0) >= 0.9)
    if (!un.length) return toast.info("No high-confidence items to auto-confirm.")
    un.forEach((i) => dispatch({ type: "inbox/set-status", id: i.id, status: "processed" }))
    toast.success(`${un.length} high-confidence item${un.length > 1 ? "s" : ""} confirmed`, { description: "Lower-confidence items are still waiting for your review." })
  }

  const panel = selected && <AIActionPanel key={selected.id} item={selected} onDone={() => isMobile && select(null)} />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox"
        description="Everything that reaches you — emails, messages, files — lands here first. Welya reads it and proposes what to do."
        actions={
          <>
            <Button variant="outline" onClick={() => setUploadOpen(true)}>
              <UploadIcon data-icon="inline-start" /> Upload
            </Button>
            <Button variant="outline" onClick={() => setManualOpen(true)}>
              <PencilLineIcon data-icon="inline-start" /> Paste text
            </Button>
            <Tooltip>
              <TooltipTrigger render={<Button onClick={processAll} disabled={!counts.unprocessed} />}>
                <SparklesIcon data-icon="inline-start" /> Auto-confirm
              </TooltipTrigger>
              <TooltipContent>Confirm items Welya is ≥90% sure about</TooltipContent>
            </Tooltip>
          </>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="unprocessed">
              Needs review <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{counts.unprocessed}</Badge>
            </TabsTrigger>
            <TabsTrigger value="processed">
              Processed <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{counts.processed}</Badge>
            </TabsTrigger>
            <TabsTrigger value="ignored">Ignored</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full md:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sender, subject…" className="pl-8" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup multiple variant="outline" size="sm" value={sources} onValueChange={setSources} className="flex-wrap">
          {SOURCES.map((s) => {
            const M = SOURCE_META[s]
            return (
              <ToggleGroupItem key={s} value={s} aria-label={M.label}>
                <M.Icon /> {M.label}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <ToggleGroup variant="outline" size="sm" value={courseFilter ? [courseFilter] : []} onValueChange={(v) => setCourseFilter(v[0] ?? null)} className="flex-wrap">
          {courses.map((c) => (
            <ToggleGroupItem key={c.id} value={c.id}>
              {c.code}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button size="sm" variant={importantOnly ? "secondary" : "ghost"} onClick={() => setImportantOnly((v) => !v)} className="ml-auto">
          <StarIcon data-icon="inline-start" className={cn(importantOnly && "fill-amber-400 text-amber-500")} /> Important ({counts.important})
        </Button>
      </div>

      {error ? (
        <ErrorState title="Couldn't sync your inbox" description="The connection to your mail provider timed out." onRetry={() => setError(false)} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5 2xl:grid-cols-7">
          <div className={cn("overflow-hidden rounded-xl border bg-card lg:col-span-2 2xl:col-span-3", selected && !isMobile && "lg:col-span-2")}>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <InboxItemSkeleton key={i} />)
            ) : filtered.length === 0 ? (
              <EmptyState
                className="border-0"
                icon={status === "unprocessed" ? CheckCheckIcon : InboxIcon}
                title={status === "unprocessed" ? "Inbox zero" : "Nothing here"}
                description={status === "unprocessed" ? "Everything has been understood and organized. New emails and messages will appear here." : "Try a different filter or search."}
                action={
                  status === "unprocessed" && (
                    <Button size="sm" variant="outline" onClick={() => setManualOpen(true)}>
                      <PencilLineIcon data-icon="inline-start" /> Add something manually
                    </Button>
                  )
                }
              />
            ) : (
              filtered.map((item) => <InboxItem key={item.id} item={item} selected={item.id === selectedId} onSelect={select} />)
            )}
          </div>

          <div className="hidden min-h-[560px] overflow-hidden rounded-xl border bg-card lg:col-span-3 lg:block 2xl:col-span-4">
            {selected ? (
              panel
            ) : (
              <EmptyState
                className="h-full border-0"
                icon={SparklesIcon}
                title="Select an item to see Welya's interpretation"
                description="Welya identifies the type, course, dates and the best next action for every item — you only confirm."
              />
            )}
          </div>
        </div>
      )}

      {isMobile && (
        <Sheet open={!!selected} onOpenChange={(o) => !o && select(null)}>
          <SheetContent side="bottom" className="h-[90dvh] gap-0 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Inbox item</SheetTitle>
              <SheetDescription>AI interpretation and actions</SheetDescription>
            </SheetHeader>
            {panel}
          </SheetContent>
        </Sheet>
      )}

      <ManualInputDialog open={manualOpen} onOpenChange={setManualOpen} />
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  )
}
