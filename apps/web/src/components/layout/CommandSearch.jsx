import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useAppStore } from "@/store/app-store"
import { CourseDot } from "@/components/welya/meta"
import {
  BookOpenIcon,
  CalendarIcon,
  FileTextIcon,
  FolderKanbanIcon,
  HomeIcon,
  InboxIcon,
  LayoutListIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react"

const pages = [
  { label: "Home", to: "/", icon: HomeIcon },
  { label: "Inbox", to: "/inbox", icon: InboxIcon },
  { label: "Tasks", to: "/tasks", icon: LayoutListIcon },
  { label: "Calendar", to: "/calendar", icon: CalendarIcon },
  { label: "Courses", to: "/courses", icon: BookOpenIcon },
  { label: "Workspaces", to: "/workspaces", icon: FolderKanbanIcon },
  { label: "AI Assistant", to: "/assistant", icon: SparklesIcon },
  { label: "Settings", to: "/settings", icon: SettingsIcon },
]

export function CommandSearch({ open, onOpenChange }) {
  const navigate = useNavigate()
  const { tasks, courses, documents, inboxItems } = useAppStore()

  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  const go = (to) => {
    onOpenChange(false)
    navigate(to)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search Welya" description="Search tasks, courses, documents and pages" className="sm:max-w-lg">
      <Command>
        <CommandInput placeholder="Search tasks, courses, documents…" />
        <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map((p) => (
            <CommandItem key={p.to} value={`page ${p.label}`} onSelect={() => go(p.to)}>
              <p.icon />
              {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Tasks">
          {tasks
            .filter((t) => t.status !== "done")
            .slice(0, 6)
            .map((t) => (
              <CommandItem key={t.id} value={`task ${t.title}`} onSelect={() => go(`/tasks?task=${t.id}`)}>
                <LayoutListIcon />
                <span className="truncate">{t.title}</span>
                <CommandShortcut className="capitalize">{t.priority}</CommandShortcut>
              </CommandItem>
            ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Courses">
          {courses.map((c) => (
            <CommandItem key={c.id} value={`course ${c.name} ${c.code}`} onSelect={() => go(`/courses/${c.id}`)}>
              <CourseDot color={c.color} className="ml-1 mr-1" />
              {c.name}
              <CommandShortcut>{c.code}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Inbox">
          {inboxItems
            .filter((i) => i.status === "unprocessed")
            .slice(0, 4)
            .map((i) => (
              <CommandItem key={i.id} value={`inbox ${i.subject} ${i.sender}`} onSelect={() => go(`/inbox?item=${i.id}`)}>
                <InboxIcon />
                <span className="truncate">{i.subject}</span>
              </CommandItem>
            ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Documents">
          {documents.slice(0, 5).map((d) => (
            <CommandItem key={d.id} value={`document ${d.title}`} onSelect={() => go(`/documents?doc=${d.id}`)}>
              <FileTextIcon />
              <span className="truncate">{d.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
