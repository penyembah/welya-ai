// Runs the committed SQL migrations in apps/api/drizzle at container start (no drizzle-kit needed at runtime).
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { db, sql } from "./client.js"

const folder = new URL("../../drizzle", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")

try {
  await migrate(db, { migrationsFolder: folder })
  console.log("migrations applied")
} finally {
  await sql.end()
}
