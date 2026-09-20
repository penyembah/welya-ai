import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/store/app-store"
import { useIsMobile } from "@/hooks/use-mobile"
import { AIChat } from "@/components/welya/AIChat"
import { PageHeader } from "@/components/welya/page-primitives"
import { useAIStatusQuery } from "@/hooks/use-welya-api"
import { relativeTime, isOverdue, isDueToday } from "@/lib/dates"
import { BookOpenIcon, CalendarIcon, FileTextIcon, InboxIcon, LayoutListIcon, MessageSquarePlusIcon, SparklesIcon, Trash2Icon } from "lucide-react"

export default function AssistantPage() {
  const { conversations, tasks, inboxItems, events, courses, documents, dispatch } = useAppStore()
  const isMobile = useIsMobile()
  const { data: status } = useAIStatusQuery()
  const [activeId, setActiveId] = React.useState(() => [...conversations].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]?.id ?? null)
  const [draft, setDraft] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState(null)
  const active = draft ? null : conversations.find((c) => c.id === activeId)
  const sorted = [...conversations].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))

  // A new conversation only exists on the server once the first message is sent
  const newConversation = () => {
    setDraft(true)
    setActiveId(null)
  }

  const deleteConversation = async () => {
    if (!deleteTarget) return
    try {
      await dispatch({ type: "conversation/delete", id: deleteTarget.id })
      if (activeId === deleteTarget.id) {
        const next = sorted.find((conversation) => conversation.id !== deleteTarget.id)
        setActiveId(next?.id ?? null)
        setDraft(false)
      }
      setDeleteTarget(null)
    } catch {
      // dispatch already restores the optimistic state and shows the save error
    }
  }

  const open = tasks.filter((t) => t.status !== "done")
  const context = [
    { icon: LayoutListIcon, label: "Tasks", value: `${open.length} open · ${open.filter(isOverdue).length} overdue · ${open.filter(isDueToday).length} due today` },
    { icon: InboxIcon, label: "Inbox", value: `${inboxItems.filter((i) => i.status === "unprocessed").length} waiting for review` },
    { icon: CalendarIcon, label: "Calendar", value: `${events.filter((e) => e.type === "class").length} classes · ${events.filter((e) => e.aiPlanned).length} planned sessions` },
    { icon: BookOpenIcon, label: "Courses", value: `${courses.length} enrolled` },
    { icon: FileTextIcon, label: "Documents", value: `${documents.length} indexed` },
  ]

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[520px] flex-col gap-4">
      <PageHeader title="AI Assistant" description="Welya is your academic secretary — it reads your inbox, knows your schedule and acts on your tasks." actions={<Button variant="outline" onClick={newConversation}><MessageSquarePlusIcon data-icon="inline-start" /> New conversation</Button>} />
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-4">
        {!isMobile && (
          <Card className="hidden min-h-0 gap-0 py-0 lg:flex lg:flex-col">
            <div className="border-b p-3"><p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Conversations</p></div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-0.5 p-2">
                {sorted.map((c) => (
                  <div key={c.id} className={cn("group flex items-start gap-1 rounded-lg transition-colors hover:bg-muted/60", !draft && c.id === activeId && "bg-muted")}>
                    <button type="button" onClick={() => { setDraft(false); setActiveId(c.id) }} className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left text-sm">
                      <p className="truncate">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground">{relativeTime(c.updatedAt)} · {c.messages.length} messages</p>
                    </button>
                    <Button size="icon-xs" variant="ghost" className="mt-1.5 mr-1 opacity-0 transition-opacity group-hover:opacity-100" aria-label={`Delete ${c.title}`} onClick={() => setDeleteTarget(c)}><Trash2Icon /></Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Separator />
            <div className="space-y-2 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase"><SparklesIcon className="size-3 text-primary" /> Welya can see</p>
              {context.map((c) => (
                <div key={c.label} className="flex items-start gap-2 text-xs"><c.icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /><div><span className="font-medium">{c.label}</span><span className="text-muted-foreground"> — {c.value}</span></div></div>
              ))}
              <p className="pt-1 text-[11px] text-muted-foreground">{status?.provider === "azure-openai" ? `Model: ${status.model} via Azure AI Foundry` : "Model: built-in rule engine"}</p>
            </div>
          </Card>
        )}
        <Card className="min-h-0 gap-0 py-0 lg:col-span-3">
          {active || draft ? (
            <AIChat
              key={active?.id ?? "draft"}
              className="h-full"
              persist
              conversationId={active?.id ?? null}
              initialMessages={active?.messages ?? []}
              onMessages={(res) => {
                if (res.conversation && draft) {
                  setDraft(false)
                  setActiveId(res.conversation.id)
                }
              }}
              emptyTitle="What can Welya do for you today?"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <Badge variant="secondary"><SparklesIcon /> Welya AI</Badge>
              <p className="text-sm text-muted-foreground">Start a new conversation to begin.</p>
              <Button onClick={newConversation}>New conversation</Button>
            </div>
          )}
        </Card>
      </div>
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes “{deleteTarget?.title}” and its messages.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteConversation}>Delete conversation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
