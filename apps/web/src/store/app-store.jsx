import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api, newId } from "@/lib/api"
import { useAuth } from "@/store/auth"
import { persistAction } from "@/store/persist-action"

const AppStoreContext = React.createContext(null)
export const BOOTSTRAP_KEY = ["bootstrap"]

const EMPTY = {
  user: { name: "", email: "", university: "", program: "", semester: 1, avatar: "" },
  courses: [],
  workspaces: [],
  tasks: [],
  events: [],
  inboxItems: [],
  documents: [],
  notifications: [],
  integrations: [],
  conversations: [],
  settings: { ai: {}, notifications: {}, privacy: {} },
}

const uid = () => newId()

// Pure optimistic reducer — the server is the source of truth after refetch
export function reducer(state, action) {
  switch (action.type) {
    case "task/add": {
      const task = {
        id: uid(),
        status: "todo",
        progress: 0,
        subtasks: [],
        attachments: [],
        notes: "",
        priority: "medium",
        estimatedMinutes: 60,
        source: { type: "manual", label: "Added manually" },
        ...action.task,
      }
      return { ...state, tasks: [task, ...state.tasks] }
    }
    case "task/update":
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)) }
    case "task/toggle-done":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? t.status === "done"
              ? { ...t, status: "todo", progress: t.subtasks.length ? t.progress : 0, completedAt: null }
              : { ...t, status: "done", progress: 100, completedAt: new Date().toISOString() }
            : t
        ),
      }
    case "task/delete":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) }
    case "subtask/toggle":
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== action.taskId) return t
          const subtasks = t.subtasks.map((s) => (s.id === action.subtaskId ? { ...s, done: !s.done } : s))
          const done = subtasks.filter((s) => s.done).length
          const progress = subtasks.length ? Math.round((done / subtasks.length) * 100) : t.progress
          return { ...t, subtasks, progress, status: progress === 100 ? "done" : progress > 0 ? "in-progress" : t.status === "done" ? "todo" : t.status }
        }),
      }
    case "subtask/add-many":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.taskId ? { ...t, subtasks: [...t.subtasks, ...action.titles.map((title) => ({ id: uid(), title, done: false }))] } : t)),
      }
    case "event/add":
      return { ...state, events: [...state.events, { id: uid(), type: "reminder", ...action.event }] }
    case "event/add-many":
      return { ...state, events: [...state.events, ...action.events.map((e) => ({ id: uid(), ...e }))] }
    case "inbox/set-status":
      return { ...state, inboxItems: state.inboxItems.map((i) => (i.id === action.id ? { ...i, status: action.status, ...action.patch } : i)) }
    case "inbox/add":
      return { ...state, inboxItems: [{ id: uid(), status: "unprocessed", importance: "normal", receivedAt: new Date().toISOString(), ...action.item }, ...state.inboxItems] }
    case "document/add":
      return { ...state, documents: [{ id: uid(), uploadedAt: new Date().toISOString(), linkedTaskIds: [], tags: [], ...action.document }, ...state.documents] }
    case "notification/read":
      return { ...state, notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)) }
    case "notification/read-all":
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) }
    case "notification/add":
      return { ...state, notifications: [{ id: uid(), read: false, time: new Date().toISOString(), ...action.notification }, ...state.notifications] }
    case "workspace/add":
      return { ...state, workspaces: [...state.workspaces, { id: uid(), members: 1, ...action.workspace }] }
    case "workspace/update":
      return { ...state, workspaces: state.workspaces.map((w) => (w.id === action.id ? { ...w, ...action.patch } : w)) }
    case "workspace/delete":
      return { ...state, workspaces: state.workspaces.filter((w) => w.id !== action.id) }
    case "course/add":
      return { ...state, courses: [{ id: uid(), progress: 0, credits: 3, color: "teal", schedule: [], ...action.course }, ...state.courses] }
    case "course/update":
      return { ...state, courses: state.courses.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)) }
    case "course/delete":
      return { ...state, courses: state.courses.filter((c) => c.id !== action.id) }
    case "integration/set":
      return { ...state, integrations: state.integrations.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i)) }
    case "settings/update":
      return { ...state, settings: { ...state.settings, [action.section]: { ...state.settings[action.section], ...action.patch } } }
    case "user/update":
      return { ...state, user: { ...state.user, ...action.patch } }
    case "conversation/add":
      return { ...state, conversations: [action.conversation, ...state.conversations] }
    case "conversation/append":
      return { ...state, conversations: state.conversations.map((c) => (c.id === action.id ? { ...c, updatedAt: new Date().toISOString(), messages: [...c.messages, ...action.messages] } : c)) }
    case "conversation/rename":
      return { ...state, conversations: state.conversations.map((c) => (c.id === action.id ? { ...c, title: action.title } : c)) }
    case "conversation/delete":
      return { ...state, conversations: state.conversations.filter((c) => c.id !== action.id) }
    default:
      return state
  }
}

export function AppStoreProvider({ children }) {
  const queryClient = useQueryClient()
  const { isAuthenticated, updateUser } = useAuth()

  const query = useQuery({
    queryKey: BOOTSTRAP_KEY,
    queryFn: () => api.get("/bootstrap"),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  const dispatch = React.useCallback(
    (action) => {
      const before = queryClient.getQueryData(BOOTSTRAP_KEY)
      if (!before) return Promise.resolve()
      const after = reducer(before, action)
      queryClient.setQueryData(BOOTSTRAP_KEY, after)
      if (action.type === "user/update") updateUser(action.patch)

      const promise = persistAction(action, before, after)
      if (!promise) return Promise.resolve()
      return promise
        .then((res) => {
          queryClient.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
          queryClient.invalidateQueries({ queryKey: ["ai"] })
          return res
        })
        .catch((err) => {
          queryClient.setQueryData(BOOTSTRAP_KEY, before)
          toast.error("Couldn't save your change", { description: err.message })
          throw err
        })
    },
    [queryClient, updateUser]
  )

  const state = query.data ?? EMPTY

  const value = React.useMemo(() => {
    const courseById = Object.fromEntries(state.courses.map((c) => [c.id, c]))
    const workspaceById = Object.fromEntries(state.workspaces.map((w) => [w.id, w]))
    const taskById = Object.fromEntries(state.tasks.map((t) => [t.id, t]))
    return {
      ...state,
      dispatch,
      courseById,
      workspaceById,
      taskById,
      uid,
      isLoading: query.isLoading,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
    }
  }, [state, dispatch, query.isLoading, query.isError, query.error, query.refetch])

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore() {
  const ctx = React.useContext(AppStoreContext)
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider")
  return ctx
}
