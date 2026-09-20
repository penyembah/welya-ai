import * as React from "react"
import { Input } from "@/components/ui/input"
import { useAppStore } from "@/store/app-store"
import { useSimulatedLoading } from "@/hooks/use-simulated-loading"
import { PageHeader, EmptyState, StatCard, StatCardSkeleton } from "@/components/welya/page-primitives"
import { CourseCard, CourseCardSkeleton } from "@/components/welya/cards"
import { todayWeekday } from "@/lib/dates"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useAsyncAction } from "@/hooks/use-simulated-loading"
import { toast } from "sonner"
import { z } from "zod"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { BookOpenIcon, ClockIcon, LayoutListIcon, PlusIcon, SearchIcon } from "lucide-react"

const courseSchema = z.object({
  code: z.string().trim().min(2, "Enter the course code"),
  name: z.string().trim().min(2, "Enter the course name"),
  lecturer: z.string().trim().optional(),
  room: z.string().trim().optional(),
  credits: z.coerce.number().int().min(1).max(10),
  color: z.enum(["teal", "sky", "violet", "amber", "rose"]),
})

function AddCourseDialog({ open, onOpenChange }) {
  const { dispatch } = useAppStore()
  const [pending, run] = useAsyncAction()
  const form = useForm({ resolver: zodResolver(courseSchema), defaultValues: { code: "", name: "", lecturer: "", room: "", credits: 3, color: "teal" } })

  React.useEffect(() => {
    if (open) form.reset()
  }, [open])

  const submit = (values) => run(async () => {
    await dispatch({ type: "course/add", course: { ...values, code: values.code.toUpperCase(), lecturer: values.lecturer ?? "", room: values.room ?? "", schedule: [] } })
    toast.success("Course added", { description: `${values.code.toUpperCase()} · ${values.name}` })
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add course</DialogTitle>
          <DialogDescription>Add your real course details. You can add the class schedule to Calendar afterward.</DialogDescription>
        </DialogHeader>
        <form id="course-form" noValidate onSubmit={form.handleSubmit(submit)}>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!form.formState.errors.code}>
                <FieldLabel htmlFor="course-code">Course code</FieldLabel>
                <Input id="course-code" placeholder="e.g. IF3201" {...form.register("code")} />
                <FieldError errors={[form.formState.errors.code]} />
              </Field>
              <Field data-invalid={!!form.formState.errors.credits}>
                <FieldLabel htmlFor="course-credits">Credits</FieldLabel>
                <Input id="course-credits" type="number" min={1} max={10} {...form.register("credits")} />
                <FieldError errors={[form.formState.errors.credits]} />
              </Field>
            </div>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="course-name">Course name</FieldLabel>
              <Input id="course-name" placeholder="e.g. Operating Systems" {...form.register("name")} />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="course-lecturer">Lecturer</FieldLabel><Input id="course-lecturer" placeholder="Optional" {...form.register("lecturer")} /></Field>
              <Field><FieldLabel htmlFor="course-room">Room</FieldLabel><Input id="course-room" placeholder="Optional" {...form.register("room")} /></Field>
            </div>
            <Field>
              <FieldLabel>Course color</FieldLabel>
              <Controller control={form.control} name="color" render={({ field }) => (
                <Select items={{ teal: "Teal", sky: "Sky", violet: "Violet", amber: "Amber", rose: "Rose" }} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["teal", "sky", "violet", "amber", "rose"].map((color) => <SelectItem key={color} value={color}>{color[0].toUpperCase() + color.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="course-form" disabled={pending}>{pending && <Spinner data-icon="inline-start" />} Add course</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function CoursesPage() {
  const { courses, tasks } = useAppStore()
  const loading = useSimulatedLoading(500)
  const [query, setQuery] = React.useState("")
  const [addOpen, setAddOpen] = React.useState(false)
  const filtered = courses.filter((c) => `${c.name} ${c.code} ${c.lecturer}`.toLowerCase().includes(query.toLowerCase()))
  const open = tasks.filter((t) => t.status !== "done" && t.courseId)
  const todayClasses = courses.filter((c) => c.schedule.some((s) => s.day === todayWeekday()))
  const credits = courses.reduce((a, c) => a + c.credits, 0)

  return (
    <div className="space-y-5">
      <PageHeader title="Courses" description="The academic context Welya uses to understand your emails, tasks and deadlines." actions={<Button onClick={() => setAddOpen(true)}><PlusIcon data-icon="inline-start" /> Add course</Button>} />
      <div className="grid gap-3 sm:grid-cols-3">
        {loading ? Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />) : (
          <>
            <StatCard label="Enrolled courses" value={courses.length} hint={`${credits} SKS this semester`} icon={BookOpenIcon} tone="primary" />
            <StatCard label="Open course tasks" value={open.length} icon={LayoutListIcon} />
            <StatCard label="Classes today" value={todayClasses.length} hint={todayClasses.map((c) => c.code).join(", ") || "Free day"} icon={ClockIcon} />
          </>
        )}
      </div>
      <div className="relative w-full sm:w-72">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search courses…" className="pl-8" />
      </div>
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 5 }).map((_, i) => <CourseCardSkeleton key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpenIcon} title="No courses found" description="Try another name or code." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filtered.map((c) => <CourseCard key={c.id} course={c} />)}</div>
      )}
      <AddCourseDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
