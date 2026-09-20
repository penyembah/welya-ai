import * as React from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useAppStore } from "@/store/app-store"
import { useBreakdownMutation } from "@/hooks/use-welya-api"
import { CheckIcon, PlusIcon, SparklesIcon, XIcon } from "lucide-react"

export function TaskBreakdown({ task, className }) {
  const { dispatch } = useAppStore()
  const breakdown = useBreakdownMutation()
  const [suggestions, setSuggestions] = React.useState(null)
  const state = breakdown.isPending ? "generating" : suggestions ? "preview" : "idle"

  const generate = async () => {
    try {
      const { suggestions: list } = await breakdown.mutateAsync(task.id)
      setSuggestions(list.map((t) => ({ title: t, keep: true })))
    } catch (e) {
      toast.error("Couldn't generate a breakdown", { description: e.message })
    }
  }

  const accept = () => {
    const titles = suggestions.filter((s) => s.keep).map((s) => s.title)
    if (titles.length) {
      dispatch({ type: "subtask/add-many", taskId: task.id, titles })
      toast.success(`${titles.length} subtasks added`, { description: task.title })
    }
    setSuggestions(null)
  }

  return (
    <div className={cn("rounded-xl border border-primary/20 bg-primary/5 p-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <SparklesIcon className="size-3.5" />
          </div>
          <div>
            <p className="text-sm font-medium">Break this task down</p>
            <p className="text-xs text-muted-foreground">Welya splits large assignments into concrete steps based on the course and deadline.</p>
          </div>
        </div>
        {state === "idle" && (
          <Button size="sm" onClick={generate}>
            Generate
          </Button>
        )}
      </div>

      {state === "generating" && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-3" /> Reading the description and attachments…
          </div>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-full rounded-md" />
          ))}
        </div>
      )}

      {state === "preview" && (
        <div className="mt-3 space-y-2">
          {suggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground">This task already has all the steps I would suggest.</p>
          ) : (
            <ul className="space-y-1">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-sm">
                  <Checkbox checked={s.keep} onCheckedChange={(v) => setSuggestions((arr) => arr.map((x, j) => (j === i ? { ...x, keep: !!v } : x)))} />
                  <span className={cn("flex-1", !s.keep && "text-muted-foreground line-through")}>
                    {i + 1}. {s.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSuggestions(null)}>
              <XIcon data-icon="inline-start" /> Dismiss
            </Button>
            <Button size="sm" onClick={accept} disabled={!suggestions.some((s) => s.keep)}>
              <CheckIcon data-icon="inline-start" /> Add {suggestions.filter((s) => s.keep).length} subtasks
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function SubtaskList({ task, className }) {
  const { dispatch } = useAppStore()
  const [adding, setAdding] = React.useState("")
  return (
    <div className={cn("space-y-1", className)}>
      {task.subtasks.length === 0 && <p className="text-xs text-muted-foreground">No subtasks yet.</p>}
      {task.subtasks.map((s) => (
        <label key={s.id} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/50">
          <Checkbox checked={s.done} onCheckedChange={() => dispatch({ type: "subtask/toggle", taskId: task.id, subtaskId: s.id })} />
          <span className={cn(s.done && "text-muted-foreground line-through")}>{s.title}</span>
        </label>
      ))}
      <form
        className="flex items-center gap-2 pt-1"
        onSubmit={(e) => {
          e.preventDefault()
          if (!adding.trim()) return
          dispatch({ type: "subtask/add-many", taskId: task.id, titles: [adding.trim()] })
          setAdding("")
        }}
      >
        <PlusIcon className="size-3.5 text-muted-foreground" />
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="Add a subtask…"
          className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </form>
    </div>
  )
}
