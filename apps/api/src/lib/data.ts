import { eq } from "drizzle-orm"
import { db, schema } from "../db/client.js"
import { DEFAULT_SETTINGS } from "./provision.js"

export type UserData = Awaited<ReturnType<typeof loadUserData>>

const strip = <T extends { userId: string }>(rows: T[]) => rows.map(({ userId: _u, ...rest }) => rest)

export async function loadUserData(uid: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, uid))
  const [coursesRows, workspacesRows, tasksRows, eventsRows, inboxRows, documentsRows, notificationsRows, integrationsRows, conversationsRows, settingsRow] = await Promise.all([
    db.select().from(schema.courses).where(eq(schema.courses.userId, uid)),
    db.select().from(schema.workspaces).where(eq(schema.workspaces.userId, uid)),
    db.select().from(schema.tasks).where(eq(schema.tasks.userId, uid)),
    db.select().from(schema.events).where(eq(schema.events.userId, uid)),
    db.select().from(schema.inboxItems).where(eq(schema.inboxItems.userId, uid)),
    db.select().from(schema.documents).where(eq(schema.documents.userId, uid)),
    db.select().from(schema.notifications).where(eq(schema.notifications.userId, uid)),
    db.select().from(schema.integrations).where(eq(schema.integrations.userId, uid)),
    db.select().from(schema.conversations).where(eq(schema.conversations.userId, uid)),
    db.select().from(schema.settings).where(eq(schema.settings.userId, uid)).then((r) => r[0]),
  ])
  return {
    user: { id: user.id, email: user.email, name: user.name, university: user.university, program: user.program, semester: user.semester, avatar: user.avatar, createdAt: user.createdAt, hasPassword: Boolean(user.passwordHash), googleLinked: Boolean(user.googleId), pendingEmail: user.pendingEmail ?? null },
    courses: strip(coursesRows),
    workspaces: strip(workspacesRows),
    tasks: strip(tasksRows),
    events: strip(eventsRows),
    inboxItems: strip(inboxRows),
    documents: strip(documentsRows),
    notifications: strip(notificationsRows),
    integrations: strip(integrationsRows),
    conversations: strip(conversationsRows),
    settings: settingsRow ? { ai: settingsRow.ai, notifications: settingsRow.notifications, privacy: settingsRow.privacy } : DEFAULT_SETTINGS,
  }
}
