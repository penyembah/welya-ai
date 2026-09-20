import { NavLink, useLocation } from "react-router-dom"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAppStore } from "@/store/app-store"
import { useAuth } from "@/store/auth"
import { toast } from "sonner"
import { WelyaLogo } from "@/components/welya/WelyaLogo"
import {
  BellIcon,
  BookOpenIcon,
  CalendarIcon,
  ChevronsUpDownIcon,
  FilesIcon,
  FolderKanbanIcon,
  HomeIcon,
  InboxIcon,
  LayoutListIcon,
  LineChartIcon,
  LogOutIcon,
  PlugIcon,
  SettingsIcon,
  SparklesIcon,
  UserIcon,
} from "lucide-react"

const primaryNav = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/inbox", label: "Inbox", icon: InboxIcon, badge: "inbox" },
  { to: "/tasks", label: "Tasks", icon: LayoutListIcon, badge: "tasks" },
  { to: "/calendar", label: "Calendar", icon: CalendarIcon },
  { to: "/courses", label: "Courses", icon: BookOpenIcon },
  { to: "/workspaces", label: "Workspaces", icon: FolderKanbanIcon },
  { to: "/assistant", label: "AI Assistant", icon: SparklesIcon },
]

const secondaryNav = [
  { to: "/documents", label: "Notes & Documents", icon: FilesIcon },
  { to: "/review", label: "Review", icon: LineChartIcon },
  { to: "/notifications", label: "Notifications", icon: BellIcon, badge: "notifications" },
  { to: "/settings/integrations", label: "Integrations", icon: PlugIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon, end: true },
]

function initials(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

export function AppSidebar() {
  const { user, inboxItems, tasks, notifications } = useAppStore()
  const { logout } = useAuth()
  const location = useLocation()

  const counts = {
    inbox: inboxItems.filter((i) => i.status === "unprocessed").length,
    tasks: tasks.filter((t) => t.status !== "done" && new Date(t.deadline) <= new Date(new Date().setHours(23, 59, 59, 999))).length,
    notifications: notifications.filter((n) => !n.read).length,
  }

  const isActive = (item) =>
    item.end ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(item.to + "/")

  const renderItems = (items) =>
    items.map((item) => {
      const active = isActive(item)
      const count = item.badge ? counts[item.badge] : 0
      return (
        <SidebarMenuItem key={item.to}>
          <SidebarMenuButton
            isActive={active}
            tooltip={item.label}
            render={<NavLink to={item.to} end={item.end} />}
          >
            <item.icon />
            <span>{item.label}</span>
          </SidebarMenuButton>
          {count > 0 && (
            <SidebarMenuBadge className="rounded-full bg-primary/10 text-primary">{count}</SidebarMenuBadge>
          )}
        </SidebarMenuItem>
      )
    })

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<NavLink to="/" />} className="group-data-[collapsible=icon]:justify-center">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <WelyaLogo className="size-5" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-heading font-semibold">Welya AI</span>
                <span className="truncate text-xs text-muted-foreground">Your academic secretary</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(primaryNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>More</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(secondaryNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton size="lg" className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground" />
                }
              >
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">{initials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">Semester {user.semester} · {user.program}</span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-(--anchor-width) min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate font-normal">{user.email}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<NavLink to="/settings" />}>
                  <UserIcon /> Account
                </DropdownMenuItem>
                <DropdownMenuItem render={<NavLink to="/settings/integrations" />}>
                  <PlugIcon /> Integrations
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    logout()
                    toast("Signed out", { description: "See you next time." })
                  }}
                >
                  <LogOutIcon /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
