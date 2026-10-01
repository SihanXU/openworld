// The one place the modder talks to a model. The model is not chosen yet, so this is an
// interface: anything OpenAI-compatible plugs in (OpenRouter reaches most providers), and
// tests and offline demos use a scripted model that answers from code or a file.

import { readFileSync } from 'node:fs'

export interface ToolSpec {
  name: string
  description: string
  /** JSON Schema of the arguments. */
  parameters: Record<string, unknown>
}

export interface ToolCall {
  id: string
  name: string
  args: unknown
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string }

export interface ChatOptions {
  tools?: ToolSpec[]
  /** Ask for a JSON object (only honoured without tools). */
  json?: boolean
  temperature?: number
  /** Which stage is calling: design | review | reflect (for logs and scripted models). */
  purpose?: string
}

export interface ModelReply {
  content: string
  toolCalls: ToolCall[]
  usage?: { input: number; output: number }
}

export interface Model {
  readonly name: string
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ModelReply>
}

// ---------------------------------------------------------------- OpenAI-compatible

export interface OpenAIConfig {
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs?: number
  /** Merged into every request body (provider-specific switches). */
  extraBody?: Record<string, unknown>
}

export class OpenAICompatModel implements Model {
  readonly name: string
  constructor(private cfg: OpenAIConfig) {
    this.name = cfg.model
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ModelReply> {
    const body: Record<string, unknown> = {
      model: this.cfg.model,
      temperature: opts.temperature ?? 0.3,
      messages: messages.map(toWire),
      ...this.cfg.extraBody,
    }
    if (opts.tools?.length) {
      body.tools = opts.tools.map((t) => ({ type: 'function', function: t }))
      body.tool_choice = 'auto'
    } else if (opts.json) body.response_format = { type: 'json_object' }
    const res = await fetch(`${this.cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 180_000),
    })
    const data = (await res.json().catch(() => null)) as WireReply | null
    if (!res.ok || !data) throw new Error(`model: HTTP ${res.status} ${JSON.stringify(data)?.slice(0, 300) ?? ''}`)
    const m = data.choices?.[0]?.message
    if (!m) throw new Error('model: empty reply')
    return {
      content: m.content ?? '',
      toolCalls: (m.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function?.name ?? '', args: parseArgs(c.function?.arguments) })),
      usage: data.usage ? { input: data.usage.prompt_tokens ?? 0, output: data.usage.completion_tokens ?? 0 } : undefined,
    }
  }
}

interface WireReply {
  choices?: { message?: { content?: string | null; tool_calls?: { id: string; function?: { name?: string; arguments?: string } }[] } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

function toWire(m: ChatMessage): Record<string, unknown> {
  if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content }
  if (m.role === 'assistant' && m.toolCalls?.length)
    return {
      role: 'assistant',
      content: m.content,
      tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) } })),
    }
  return { role: m.role, content: m.content }
}

function parseArgs(s: string | undefined): unknown {
  if (!s) return {}
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------- scripted

/** A model whose replies come from code: tests, and the offline demo without an API key. */
export type Script = (messages: ChatMessage[], opts: ChatOptions, call: number) => ModelReply | string | object | Promise<ModelReply | string | object>

export class ScriptedModel implements Model {
  calls = 0
  constructor(
    private script: Script,
    readonly name = 'scripted',
  ) {}

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ModelReply> {
    const r = await this.script(messages, opts, this.calls++)
    if (typeof r === 'string') return { content: r, toolCalls: [] }
    if (r && typeof r === 'object' && 'toolCalls' in r && 'content' in r) return r as ModelReply
    return { content: JSON.stringify(r), toolCalls: [] }
  }
}

/**
 * A script file: entries tried in order; the first whose `purpose` matches the stage and whose
 * `contains` occurs in the last user message answers with `reply` (JSON). Unmatched calls
 * answer `{}`, which the pipeline treats as "no patch".
 */
export interface ScriptEntry {
  purpose?: string
  contains?: string
  reply: unknown
}

export function scriptFromFile(path: string): ScriptedModel {
  const entries = JSON.parse(readFileSync(path, 'utf8')) as ScriptEntry[]
  return new ScriptedModel((messages, opts) => {
    const text = messages.map((m) => m.content).join('\n')
    const hit = entries.find((e) => (!e.purpose || e.purpose === opts.purpose) && (!e.contains || text.includes(e.contains)))
    return (hit?.reply ?? {}) as object
  }, `script:${path.split(/[\\/]/).pop()}`)
}

// ---------------------------------------------------------------- helpers

/** Best-effort JSON out of a model reply: strip code fences, else take the outermost {...}. */
export function parseJson(text: string): unknown {
  if (!text) return undefined
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(t)
  } catch {
    /* fall through */
  }
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(t.slice(a, b + 1))
    } catch {
      /* fall through */
    }
  }
  return undefined
}

/** Counts calls and tokens per episode. */
export class Meter implements Model {
  calls = 0
  input = 0
  output = 0
  readonly name: string
  constructor(private inner: Model) {
    this.name = inner.name
  }
  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ModelReply> {
    this.calls++
    const r = await this.inner.chat(messages, opts)
    this.input += r.usage?.input ?? 0
    this.output += r.usage?.output ?? 0
    return r
  }
}

/**
 * From the environment: LSW_MODEL_SCRIPT=<file> for a scripted model, or
 * LSW_MODEL_URL + LSW_MODEL_KEY + LSW_MODEL for an OpenAI-compatible endpoint.
 */
export function modelFromEnv(env: Record<string, string | undefined> = process.env): Model | undefined {
  if (env.LSW_MODEL_SCRIPT) return scriptFromFile(env.LSW_MODEL_SCRIPT)
  if (!env.LSW_MODEL_KEY || !env.LSW_MODEL) return undefined
  return new OpenAICompatModel({
    baseUrl: env.LSW_MODEL_URL || 'https://openrouter.ai/api/v1',
    apiKey: env.LSW_MODEL_KEY,
    model: env.LSW_MODEL,
    extraBody: env.LSW_MODEL_EXTRA ? JSON.parse(env.LSW_MODEL_EXTRA) : undefined,
  })
}
