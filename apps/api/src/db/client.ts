import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema.js"
import { env } from "../env.js"

export const sql = postgres(env.DATABASE_URL, { max: 10 })
export const db = drizzle(sql, { schema })
export type Db = typeof db
export { schema }
