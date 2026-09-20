import * as React from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel } from "@/components/ui/field"
import { useAppStore } from "@/store/app-store"
import { useUploadMutation } from "@/hooks/use-welya-api"
import { CourseSelect, WorkspaceSelect } from "@/components/welya/forms"
import { CheckCircle2Icon, FileTextIcon, ImageIcon, SparklesIcon, UploadCloudIcon } from "lucide-react"

export function UploadDialog({ open, onOpenChange, defaults = {} }) {
  const { workspaces } = useAppStore()
  const upload = useUploadMutation()
  const [file, setFile] = React.useState(null)
  const [courseId, setCourseId] = React.useState(defaults.courseId ?? null)
  const [workspaceId, setWorkspaceId] = React.useState(defaults.workspaceId ?? workspaces[0]?.id ?? null)
  const [stage, setStage] = React.useState("pick") // pick | uploading | analyzing | done
  const [progress, setProgress] = React.useState(0)
  const [error, setError] = React.useState(null)
  const inputRef = React.useRef(null)

  React.useEffect(() => {
    if (!open) {
      setFile(null)
      setStage("pick")
      setProgress(0)
      setError(null)
      setCourseId(defaults.courseId ?? null)
      setWorkspaceId(defaults.workspaceId ?? workspaces[0]?.id ?? null)
    }
  }, [open, defaults.courseId, defaults.workspaceId, workspaces])

  const start = async () => {
    if (!file) return
    setError(null)
    setStage("uploading")
    try {
      await upload.mutateAsync({
        file,
        courseId,
        workspaceId,
        onProgress: (p) => {
          setProgress(p)
          if (p >= 100) setStage("analyzing")
        },
      })
      setStage("done")
    } catch (e) {
      setError(e.message)
      setStage("pick")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>PDFs, slides and screenshots. Welya extracts tasks, deadlines and notes automatically.</DialogDescription>
        </DialogHeader>

        {stage === "pick" && (
          <div className="space-y-4">
            {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) setFile(f)
              }}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors hover:bg-muted/50",
                file && "border-primary/40 bg-primary/5"
              )}
            >
              {file ? (
                <>
                  {file.type.startsWith("image/") ? <ImageIcon className="size-6 text-primary" /> : <FileTextIcon className="size-6 text-primary" />}
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB · click to change</p>
                </>
              ) : (
                <>
                  <UploadCloudIcon className="size-6 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop a file here or click to browse</p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX, PNG, JPG up to 25 MB</p>
                </>
              )}
            </button>
            <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Course</FieldLabel>
                <CourseSelect value={courseId} onChange={setCourseId} />
              </Field>
              <Field>
                <FieldLabel>Workspace</FieldLabel>
                <WorkspaceSelect value={workspaceId} onChange={setWorkspaceId} />
              </Field>
            </div>
          </div>
        )}

        {(stage === "uploading" || stage === "analyzing") && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              {stage === "uploading" ? <UploadCloudIcon className="size-4 text-muted-foreground" /> : <SparklesIcon className="size-4 animate-pulse text-primary" />}
              <span>{stage === "uploading" ? `Uploading ${file?.name}…` : "Welya is reading the document…"}</span>
            </div>
            <Progress value={stage === "uploading" ? progress : 100} />
            {stage === "analyzing" && <p className="text-xs text-muted-foreground">Looking for deadlines, assignment requirements and course references.</p>}
          </div>
        )}

        {stage === "done" && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2Icon className="size-8 text-emerald-500" />
            <p className="font-medium">Document added</p>
            <p className="text-sm text-muted-foreground">It's saved in Notes & Documents and waiting in your Inbox for AI processing.</p>
            <Badge variant="secondary">
              <SparklesIcon /> 1 inbox item created
            </Badge>
          </div>
        )}

        <DialogFooter showCloseButton={stage !== "done"}>
          {stage === "pick" && (
            <Button onClick={start} disabled={!file}>
              <SparklesIcon data-icon="inline-start" /> Upload & analyze
            </Button>
          )}
          {stage === "done" && (
            <Button
              onClick={() => {
                onOpenChange(false)
                toast.success("Ready in your inbox")
              }}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
