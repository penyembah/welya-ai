import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import postgres from "postgres"

const sql = postgres(process.env.DATABASE_URL ?? "postgres://welya:welya@localhost:5433/welya")

try {
  const tables = await sql<{ name: string }[]>`
    select table_name as name
    from information_schema.tables
    where table_schema = 'public' and table_name in ('users', 'tasks', 'integrations', 'oauth_tokens', 'sessions')
  `
  const required = new Set(tables.map((row) => row.name))
  const missing = ["users", "tasks", "integrations", "oauth_tokens", "sessions"].filter((name) => !required.has(name))
  if (missing.length) {
    throw new Error(`Cannot baseline: missing tables ${missing.join(", ")}. Run db:migrate or db:push first.`)
  }

  const migrationDir = path.resolve("drizzle")
  const migrationFile = (await readdir(migrationDir)).find((name) => /^\d+_.+\.sql$/.test(name))
  if (!migrationFile) throw new Error("No SQL migration found in apps/api/drizzle")
  const migrationSql = await readFile(path.join(migrationDir, migrationFile), "utf8")
  const hash = createHash("sha256").update(migrationSql).digest("hex")

  await sql`create schema if not exists drizzle`
  await sql`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `
  const [existing] = await sql<{ hash: string }[]>`
    select hash from drizzle.__drizzle_migrations where hash = ${hash} limit 1
  `
  if (existing) {
    console.log(`${migrationFile} is already recorded as applied`)
  } else {
    await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${Date.now()})`
    console.log(`Recorded ${migrationFile} as the baseline migration`)
  }
} finally {
  await sql.end()
}
