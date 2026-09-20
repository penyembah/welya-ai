ALTER TABLE "tasks" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_external_idx" ON "tasks" USING btree ("user_id","external_id");