import { db, schema } from "../db/client.js"

export const DEFAULT_SETTINGS = {
  ai: { autoProcessInbox: true, confirmBeforeCreating: true, suggestPlans: true, breakdownStyle: "detailed", tone: "concise" },
  notifications: { deadlineReminders: true, deadlineLeadHours: "24", dailySummary: true, dailySummaryTime: "07:00", weeklyReview: true, calendarReminders: true, inboxAlerts: true },
  privacy: { allowEmailProcessing: true, allowDocumentProcessing: true, retainConversations: true, shareUsageStats: false },
}

export const DEFAULT_INTEGRATIONS = [
  { id: "google-calendar", name: "Google Calendar", description: "Two-way sync: classes, deadlines and planned work sessions appear in both calendars.", scopes: ["Read events", "Create and update events"], status: "disconnected" },
  { id: "google-tasks", name: "Google Tasks", description: "Two-way sync: tasks created in Welya show up in Google Tasks and vice versa, including completion.", scopes: ["Read tasks", "Create and update tasks"], status: "disconnected" },
  { id: "gmail", name: "Gmail", description: "Let Welya read recent lecturer emails and turn them into inbox items.", scopes: ["Read mail"], status: "disconnected" },
  { id: "lms", name: "Campus LMS", description: "Import assignments and announcements from the university LMS.", scopes: [], status: "coming-soon" },
]

// Every account gets settings + the integration catalogue so the UI has something to render
export async function provisionDefaults(userId: string) {
  await db.insert(schema.settings).values({ userId, ...DEFAULT_SETTINGS }).onConflictDoNothing()
  await db
    .insert(schema.integrations)
    .values(DEFAULT_INTEGRATIONS.map((i) => ({ ...i, userId })))
    .onConflictDoNothing()
}
