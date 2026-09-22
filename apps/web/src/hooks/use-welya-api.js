import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, http } from "@/lib/api"
import { BOOTSTRAP_KEY } from "@/store/app-store"

export const aiKeys = {
  recommendations: ["ai", "recommendations"],
  review: ["ai", "review"],
  status: ["ai", "status"],
}

export function useAIStatusQuery() {
  return useQuery({ queryKey: aiKeys.status, queryFn: () => api.get("/ai/status"), staleTime: 5 * 60_000 })
}

export function useRecommendationsQuery(options = {}) {
  return useQuery({ queryKey: aiKeys.recommendations, queryFn: () => api.get("/ai/recommendations"), staleTime: 60_000, ...options })
}

export function useWeeklyReviewQuery() {
  return useQuery({ queryKey: aiKeys.review, queryFn: () => api.get("/ai/review"), staleTime: 60_000 })
}

export function usePlanMutation() {
  return useMutation({ mutationFn: ({ scope = "day", date } = {}) => api.post("/ai/plan", { scope, date }) })
}

export function useBreakdownMutation() {
  return useMutation({ mutationFn: (taskId) => api.post("/ai/breakdown", { taskId }) })
}

export function useDocumentAIMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ documentId, action }) => api.post("/ai/document", { documentId, action }),
    onSuccess: (_d, vars) => vars.action === "notes" && qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY }),
  })
}

export function useChatMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ message, conversationId, context, persist = true }) => api.post("/ai/chat", { message, conversationId, context, persist }),
    // The assistant may have created/changed tasks or events server-side
    onSuccess: (data) => (data.conversation || data.changed) && qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY }),
  })
}

export function useChatImageMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, message, conversationId, context, persist = true }) => {
      const form = new FormData()
      form.append("message", message ?? "")
      form.append("conversationId", conversationId ?? "")
      form.append("context", JSON.stringify(context ?? {}))
      form.append("persist", String(persist))
      form.append("file", file)
      return http.post("/ai/chat/image", form)
    },
    onSuccess: (data) => data.conversation && qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY }),
  })
}

export function useUploadMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, courseId, workspaceId, onProgress }) => {
      const form = new FormData()
      if (courseId) form.append("courseId", courseId)
      if (workspaceId) form.append("workspaceId", workspaceId)
      form.append("file", file)
      return http.post("/documents/upload", form, { onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: aiKeys.recommendations })
    },
  })
}

export function useAvatarMutation() {
  return useMutation({
    mutationFn: (file) => {
      const form = new FormData()
      form.append("file", file)
      return http.post("/me/avatar", form)
    },
  })
}

export function useIntegrationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, body }) => api.post(`/integrations/${id}/${action}`, body ?? {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY }),
  })
}

export async function downloadExport() {
  const data = await api.get("/me/export")
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `welya-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
