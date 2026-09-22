import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" })

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    // Null for accounts created through Google sign-in that never set a password
    passwordHash: text("password_hash"),
    googleId: text("google_id"),
    university: text("university").default("").notNull(),
    program: text("program").default("").notNull(),
    semester: integer("semester").default(1).notNull(),
    avatar: text("avatar").default("").notNull(),
    verified: boolean("verified").default(false).notNull(),
    // Set while an email change awaits the code sent to the new address
    pendingEmail: text("pending_email"),
    createdAt: ts("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_google_id_idx").on(t.googleId)]
)

// One Google account per user; scopes accumulate as more Google integrations are connected
export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    email: text("email").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: ts("expires_at").notNull(),
    scope: text("scope").default("").notNull(),
    updatedAt: ts("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })]
)

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").defaultNow().notNull(),
    revokedAt: ts("revoked_at"),
    userAgent: text("user_agent").default("").notNull(),
    ip: text("ip").default("").notNull(),
  },
  (t) => [uniqueIndex("sessions_token_hash_idx").on(t.tokenHash), index("sessions_user_idx").on(t.userId)]
)

export const verificationCodes = pgTable("verification_codes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<"verify" | "reset" | "email-change" | "desktop-login">().notNull(),
  code: text("code").notNull(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
})

export const courses = pgTable("courses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  lecturer: text("lecturer").default("").notNull(),
  room: text("room").default("").notNull(),
  color: text("color").default("teal").notNull(),
  progress: integer("progress").default(0).notNull(),
  credits: integer("credits").default(3).notNull(),
  schedule: jsonb("schedule").$type<Array<{ day: string; start: string; end: string; room: string; type: string }>>().default([]).notNull(),
})

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").default("").notNull(),
  color: text("color").default("teal").notNull(),
  icon: text("icon").default("Briefcase").notNull(),
  type: text("type").default("Project").notNull(),
  members: integer("members").default(1).notNull(),
})

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    courseId: text("course_id").references(() => courses.id, { onDelete: "set null" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    deadline: ts("deadline").notNull(),
    priority: text("priority").default("medium").notNull(),
    status: text("status").default("todo").notNull(),
    estimatedMinutes: integer("estimated_minutes").default(60).notNull(),
    progress: integer("progress").default(0).notNull(),
    subtasks: jsonb("subtasks").$type<Array<{ id: string; title: string; done: boolean }>>().default([]).notNull(),
    attachments: jsonb("attachments").$type<string[]>().default([]).notNull(),
    source: jsonb("source").$type<{ type: string; label: string; inboxId?: string }>().default({ type: "manual", label: "Added manually" }).notNull(),
    notes: text("notes").default("").notNull(),
    completedAt: ts("completed_at"),
    createdAt: ts("created_at").defaultNow().notNull(),
    // "gtask:<listId>:<taskId>" when mirrored in Google Tasks
    externalId: text("external_id"),
  },
  (t) => [uniqueIndex("tasks_external_idx").on(t.userId, t.externalId)]
)

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: text("type").default("reminder").notNull(),
    start: ts("start").notNull(),
    end: ts("end").notNull(),
    courseId: text("course_id").references(() => courses.id, { onDelete: "set null" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    location: text("location"),
    aiPlanned: boolean("ai_planned").default(false).notNull(),
    externalId: text("external_id"),
  },
  (t) => [uniqueIndex("events_external_idx").on(t.userId, t.externalId)]
)

export const inboxItems = pgTable(
  "inbox_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    sender: text("sender").notNull(),
    senderEmail: text("sender_email"),
    subject: text("subject").notNull(),
    receivedAt: ts("received_at").defaultNow().notNull(),
    preview: text("preview").default("").notNull(),
    body: text("body").default("").notNull(),
    status: text("status").default("unprocessed").notNull(),
    courseId: text("course_id").references(() => courses.id, { onDelete: "set null" }),
    importance: text("importance").default("normal").notNull(),
    ai: jsonb("ai").$type<Record<string, unknown>>().default({}).notNull(),
    resultTaskId: text("result_task_id"),
    resultDocumentId: text("result_document_id"),
    externalId: text("external_id"),
  },
  (t) => [uniqueIndex("inbox_external_idx").on(t.userId, t.externalId)]
)

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: text("type").default("doc").notNull(),
    courseId: text("course_id").references(() => courses.id, { onDelete: "set null" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    size: text("size").default("—").notNull(),
    uploadedAt: ts("uploaded_at").defaultNow().notNull(),
    pages: integer("pages"),
    summary: text("summary").default("").notNull(),
    content: text("content"),
    linkedTaskIds: jsonb("linked_task_ids").$type<string[]>().default([]).notNull(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    externalId: text("external_id"),
    externalUrl: text("external_url"),
  },
  (t) => [uniqueIndex("documents_external_idx").on(t.userId, t.externalId)]
)

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").default("").notNull(),
    time: ts("time").defaultNow().notNull(),
    read: boolean("read").default(false).notNull(),
    link: text("link"),
    // Set by the reminder scheduler (e.g. "deadline:<taskId>", "daily:2026-09-21") so a restart never double-notifies
    dedupeKey: text("dedupe_key"),
  },
  (t) => [uniqueIndex("notifications_dedupe_idx").on(t.userId, t.dedupeKey)]
)

export const integrations = pgTable(
  "integrations",
  {
    id: text("id").notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    status: text("status").default("disconnected").notNull(),
    account: text("account"),
    lastSync: ts("last_sync"),
    scopes: jsonb("scopes").$type<string[]>().default([]).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })]
)

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  messages: jsonb("messages").$type<Array<Record<string, unknown>>>().default([]).notNull(),
})

export const settings = pgTable("settings", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  ai: jsonb("ai").$type<Record<string, unknown>>().default({}).notNull(),
  notifications: jsonb("notifications").$type<Record<string, unknown>>().default({}).notNull(),
  privacy: jsonb("privacy").$type<Record<string, unknown>>().default({}).notNull(),
})
