import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useTheme } from "next-themes"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAppStore } from "@/store/app-store"
import { CommandSearch } from "@/components/layout/CommandSearch"
import { AIChat } from "@/components/welya/AIChat"
import { relativeTime } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { BellIcon, CheckCheckIcon, MoonIcon, SearchIcon, SparklesIcon, SunIcon } from "lucide-react"

const TITLES = {
  "": "Home",
  inbox: "Inbox",
  tasks: "Tasks",
  calendar: "Calendar",
  courses: "Courses",
  workspaces: "Workspaces",
  assistant: "AI Assistant",
  documents: "Notes & Documents",
  notifications: "Notifications",
  review: "Review",
  settings: "Settings",
  integrations: "Integrations",
  ai: "AI Preferences",
  appearance: "Appearance",
  privacy: "Privacy",
}

function useCrumbs() {
  const { pathname } = useLocation()
  const { courseById, workspaceById } = useAppStore()
  const parts = pathname.split("/").filter(Boolean)
  if (!parts.length) return [{ label: "Home" }]
  return parts.map((p, i) => {
    const to = "/" + parts.slice(0, i + 1).join("/")
    let label = TITLES[p]
    if (!label) label = courseById[p]?.name ?? workspaceById[p]?.name ?? p
    return { label, to: i < parts.length - 1 ? to : undefined }
  })
}

export function AppHeader() {
  const crumbs = useCrumbs()
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [askOpen, setAskOpen] = React.useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { notifications, dispatch } = useAppStore()
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !n.read)

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur supports-backdrop-filter:bg-background/60 md:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4!" />
      <Breadcrumb className="hidden min-w-0 sm:block">
        <BreadcrumbList>
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {c.to ? <BreadcrumbLink render={<Link to={c.to} />}>{c.label}</BreadcrumbLink> : <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <span className="truncate font-medium sm:hidden">{crumbs[crumbs.length - 1].label}</span>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="hidden w-56 justify-start text-muted-foreground md:flex" onClick={() => setSearchOpen(true)}>
          <SearchIcon data-icon="inline-start" />
          <span className="flex-1 text-left">Search…</span>
          <Kbd>⌘K</Kbd>
        </Button>
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setSearchOpen(true)} aria-label="Search">
          <SearchIcon />
        </Button>

        <Button size="sm" onClick={() => setAskOpen(true)} className="hidden sm:inline-flex">
          <SparklesIcon data-icon="inline-start" />
          Ask Welya
        </Button>
        <Button size="icon-sm" onClick={() => setAskOpen(true)} className="sm:hidden" aria-label="Ask Welya">
          <SparklesIcon />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications" />}>
            <BellIcon />
            {unread.length > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-destructive ring-2 ring-background" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                {unread.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    {unread.length} new
                  </Badge>
                )}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup className="max-h-80 overflow-y-auto">
              {notifications.slice(0, 5).map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className="items-start gap-2 py-2"
                  onClick={() => {
                    dispatch({ type: "notification/read", id: n.id })
                    navigate(n.link ?? "/notifications")
                  }}
                >
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm", !n.read && "font-medium")}>{n.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{relativeTime(n.time)}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => dispatch({ type: "notification/read-all" })} disabled={!unread.length}>
              <CheckCheckIcon /> Mark all as read
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/notifications" />}>View all notifications</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Toggle theme"
                onClick={() => setTheme((resolvedTheme ?? theme) === "dark" ? "light" : "dark")}
              />
            }
          >
            <SunIcon className="dark:hidden" />
            <MoonIcon className="hidden dark:block" />
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>
      </div>

      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <Sheet open={askOpen} onOpenChange={setAskOpen}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-primary" /> Ask Welya
            </SheetTitle>
            <SheetDescription>Quick questions about your day, deadlines and inbox.</SheetDescription>
          </SheetHeader>
          <AIChat className="flex-1" />
        </SheetContent>
      </Sheet>
    </header>
  )
}
