import { env, llmEnabled } from "../env.js"

/**
 * Thin client for the Azure OpenAI v1 Responses API (Azure AI Foundry).
 * Every call asks for strict JSON so callers get typed, validated objects back.
 */

export class LlmError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message)
    this.name = "LlmError"
  }
}

export type JsonSchema = Record<string, unknown>

type MessageContent = string | Array<{ type: "input_text" | "input_image"; text?: string; image_url?: string }>
type Message = { role: "system" | "developer" | "user" | "assistant"; content: MessageContent }

interface LlmJsonOptions {
  name: string
  schema: JsonSchema
  instructions: string
  input: Message[] | string
  effort?: "minimal" | "low" | "medium" | "high"
  maxOutputTokens?: number
}

function endpointUrl() {
  const base = env.AZURE_OPENAI_ENDPOINT!.replace(/\/+$/, "")
  return base.endsWith("/responses") ? base : `${base}/responses`
}

function extractText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text
  const out: string[] = []
  for (const item of payload?.output ?? []) {
    if (item?.type !== "message") continue
    for (const part of item.content ?? []) {
      if (part?.type === "output_text" && typeof part.text === "string") out.push(part.text)
      if (part?.type === "refusal") throw new LlmError(`Model refused: ${part.refusal}`)
    }
  }
  if (!out.length) throw new LlmError("Model returned no text output", undefined, payload)
  return out.join("")
}

export async function llmJson<T>(opts: LlmJsonOptions): Promise<T> {
  if (!llmEnabled) throw new LlmError("LLM is not configured")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS)
  try {
    const res = await fetch(endpointUrl(), {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "api-key": env.AZURE_OPENAI_API_KEY!, Authorization: `Bearer ${env.AZURE_OPENAI_API_KEY!}` },
      body: JSON.stringify({
        model: env.AZURE_OPENAI_DEPLOYMENT,
        instructions: opts.instructions,
        input: typeof opts.input === "string" ? opts.input : opts.input.map((m) => ({ role: m.role, content: m.content })),
        reasoning: { effort: opts.effort ?? "low" },
        max_output_tokens: opts.maxOutputTokens ?? 1200,
        text: { format: { type: "json_schema", name: opts.name, strict: true, schema: opts.schema } },
        store: false,
      }),
    })
    const text = await res.text()
    let payload: any = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      /* non-JSON error body */
    }
    if (!res.ok) throw new LlmError(payload?.error?.message ?? `LLM request failed (${res.status})`, res.status, payload ?? text)
    if (payload?.status === "incomplete") throw new LlmError(`LLM response incomplete: ${payload?.incomplete_details?.reason ?? "unknown"}`, res.status, payload)
    const raw = extractText(payload)
    try {
      return JSON.parse(raw) as T
    } catch {
      throw new LlmError("Model output was not valid JSON", res.status, raw)
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new LlmError(`LLM request timed out after ${env.AI_TIMEOUT_MS}ms`)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/* ---------- schema helpers (strict mode: every property required, no extras) ---------- */
export const S = {
  obj: (properties: Record<string, JsonSchema>): JsonSchema => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false }),
  str: (description?: string): JsonSchema => ({ type: "string", ...(description ? { description } : {}) }),
  nstr: (description?: string): JsonSchema => ({ type: ["string", "null"], ...(description ? { description } : {}) }),
  num: (description?: string): JsonSchema => ({ type: "number", ...(description ? { description } : {}) }),
  bool: (): JsonSchema => ({ type: "boolean" }),
  enum: (values: string[], description?: string): JsonSchema => ({ type: "string", enum: values, ...(description ? { description } : {}) }),
  arr: (items: JsonSchema, description?: string): JsonSchema => ({ type: "array", items, ...(description ? { description } : {}) }),
}
