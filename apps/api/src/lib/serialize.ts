// Postgres returns timestamptz as "2026-09-20 15:00:00+00"; clients expect ISO 8601.
const PG_TS = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-]\d{2}(?::?\d{2})?)?$/

export function toIso(value: unknown): unknown {
  if (typeof value !== "string") return value
  const m = PG_TS.exec(value)
  if (!m) return value
  const tz = m[3] ? (m[3].length === 3 ? `${m[3]}:00` : m[3].includes(":") ? m[3] : `${m[3].slice(0, 3)}:${m[3].slice(3)}`) : "Z"
  return new Date(`${m[1]}T${m[2]}${tz}`).toISOString()
}

export function normalize<T>(input: T): T {
  if (Array.isArray(input)) return input.map(normalize) as T
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) out[k] = normalize(toIso(v))
    return out as T
  }
  return toIso(input) as T
}
