-- Integration catalogue changes: Google Tasks (two-way) added; Google Drive and WhatsApp removed.
-- Descriptions/scopes for Calendar are refreshed to reflect two-way sync.
INSERT INTO "integrations" ("id", "user_id", "name", "description", "status", "account", "last_sync", "scopes")
SELECT 'google-tasks', u."id", 'Google Tasks',
       'Two-way sync: tasks created in Welya show up in Google Tasks and vice versa, including completion.',
       'disconnected', NULL, NULL, '["Read tasks", "Create and update tasks"]'::jsonb
FROM "users" u
ON CONFLICT ("user_id", "id") DO NOTHING;--> statement-breakpoint
UPDATE "integrations"
SET "description" = 'Two-way sync: classes, deadlines and planned work sessions appear in both calendars.',
    "scopes" = '["Read events", "Create and update events"]'::jsonb
WHERE "id" = 'google-calendar';--> statement-breakpoint
-- Existing Calendar connections only hold calendar.readonly; force a reconnect so the write scope is granted.
UPDATE "integrations" SET "status" = 'error' WHERE "id" = 'google-calendar' AND "status" = 'connected';--> statement-breakpoint
DELETE FROM "integrations" WHERE "id" IN ('google-drive', 'whatsapp');
