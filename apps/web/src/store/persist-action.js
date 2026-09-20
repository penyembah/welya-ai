import { api } from "@/lib/api"

// Translates reducer actions into REST calls. Returns a promise; callers invalidate on settle.
export function persistAction(action, before, after) {
  switch (action.type) {
    case "task/add": {
      const task = after.tasks.find((t) => !before.tasks.some((b) => b.id === t.id))
      return task ? api.post("/tasks", task) : null
    }
    case "task/update":
      return api.patch(`/tasks/${action.id}`, action.patch)
    case "task/toggle-done": {
      const t = after.tasks.find((x) => x.id === action.id)
      return t ? api.patch(`/tasks/${t.id}`, { status: t.status, progress: t.progress, completedAt: t.completedAt ?? null }) : null
    }
    case "task/delete":
      return api.delete(`/tasks/${action.id}`)
    case "subtask/toggle":
    case "subtask/add-many": {
      const t = after.tasks.find((x) => x.id === action.taskId)
      return t ? api.patch(`/tasks/${t.id}`, { subtasks: t.subtasks, progress: t.progress, status: t.status }) : null
    }
    case "event/add": {
      const ev = after.events.find((e) => !before.events.some((b) => b.id === e.id))
      return ev ? api.post("/events", ev) : null
    }
    case "event/add-many": {
      const evs = after.events.filter((e) => !before.events.some((b) => b.id === e.id))
      return evs.length ? api.post("/events", evs) : null
    }
    case "inbox/set-status":
      return api.patch(`/inbox/${action.id}`, { status: action.status, ...(action.patch ?? {}) })
    case "inbox/add": {
      const item = after.inboxItems.find((i) => !before.inboxItems.some((b) => b.id === i.id))
      return item ? api.post("/inbox", item) : null
    }
    case "document/add": {
      const doc = after.documents.find((d) => !before.documents.some((b) => b.id === d.id))
      return doc ? api.post("/documents", doc) : null
    }
    case "notification/read":
      return api.patch(`/notifications/${action.id}`, { read: true })
    case "notification/read-all":
      return api.post("/notifications/read-all", {})
    case "notification/add": {
      const n = after.notifications.find((x) => !before.notifications.some((b) => b.id === x.id))
      return n ? api.post("/notifications", n) : null
    }
    case "workspace/add": {
      const w = after.workspaces.find((x) => !before.workspaces.some((b) => b.id === x.id))
      return w ? api.post("/workspaces", w) : null
    }
    case "workspace/update":
      return api.patch(`/workspaces/${action.id}`, action.patch)
    case "workspace/delete":
      return api.delete(`/workspaces/${action.id}`)
    case "course/add": {
      const course = after.courses.find((c) => !before.courses.some((b) => b.id === c.id))
      return course ? api.post("/courses", course) : null
    }
    case "course/update":
      return api.patch(`/courses/${action.id}`, action.patch)
    case "course/delete":
      return api.delete(`/courses/${action.id}`)
    case "integration/set":
      return api.patch(`/integrations/${action.id}`, action.patch)
    case "settings/update":
      return api.patch("/settings", { section: action.section, patch: action.patch })
    case "user/update":
      return api.patch("/me", action.patch)
    case "conversation/add":
      return api.post("/conversations", action.conversation)
    case "conversation/append":
      return api.patch(`/conversations/${action.id}`, { append: action.messages })
    case "conversation/rename":
      return api.patch(`/conversations/${action.id}`, { title: action.title })
    case "conversation/delete":
      return api.delete(`/conversations/${action.id}`)
    default:
      return null
  }
}
