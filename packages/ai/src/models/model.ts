// The one place the modder talks to a model. The model is not chosen yet, so this is an
// interface: anything OpenAI-compatible plugs in (OpenRouter reaches most providers), Claude
// Code's print mode reaches Claude signed in as the user, and tests and offline demos use a
// scripted model that answers from code or a file. This part runs anywhere, a browser's worker too (the
// player's own key: docs/byok.md); what needs Node — Claude Code's print mode, a script file, the
// environment — is model-node.ts. Anthropic's own API is the last part of this file.

import Anthropic from '@anthropic-ai/sdk'

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
  /** How hard a reasoning model thinks before answering; most of a call's latency is these tokens. */
  reasoning?: 'none' | 'minimal' | 'low' | 'medium' | 'high'
  /** Tail guard (live play): send a second request after hedgeMs, give up a try after deadlineMs, retry this often. */
  hedgeMs?: number
  deadlineMs?: number
  retries?: number
  /** OpenRouter provider preferences for this call (replaces the configured ones), e.g. { sort: 'price' } */
  provider?: Record<string, unknown>
}

export interface ModelReply {
  content: string
  toolCalls: ToolCall[]
  /** cost in USD and reasoning tokens (part of output), when the provider reports them */
  usage?: { input: number; output: number; cost?: number; reasoning?: number }
  /** wall time of the call and who served it */
  ms?: number
  provider?: string
  /** the answer came from the second (hedge) request */
  hedged?: boolean
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
  /**
   * A frozen model (docs/rsi-experiments.md §3): served by these OpenRouter providers only, at these
   * precisions, with no fallback. It overrides every call's own provider preferences (the harness's
   * included), and a reply from anyone else is an error, never an answer.
   */
  pin?: ProviderPin
}

export interface ProviderPin {
  providers: string[]
  quantizations?: string[]
}

/** The words of the error a reply from outside the pin raises (a run that meets it is void). */
export const PIN_BREACH = 'outside the provider pin'

/** OpenRouter names a provider "Moonshot AI" in a reply and "moonshotai" in a request. */
const providerKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export class OpenAICompatModel implements Model {
  readonly name: string
  constructor(private cfg: OpenAIConfig) {
    this.name = cfg.model
  }

  /** The provider pin, if any (a run's manifest records it). */
  get pin(): ProviderPin | undefined {
    return this.cfg.pin
  }

  /** The endpoint is OpenRouter: what only it reads goes there only (another endpoint refuses a field it does not know). */
  private get openrouter(): boolean {
    return this.cfg.baseUrl.includes('openrouter.ai')
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ModelReply> {
    const openrouter = this.openrouter
    const body: Record<string, unknown> = {
      model: this.cfg.model,
      temperature: opts.temperature ?? 0.3,
      messages: messages.map((m, i) => {
        const w = toWire(m)
        // Anthropic models cache only marked prefixes: the system prompt (the ModSpec) is resent every turn
        if (i === 0 && m.role === 'system' && this.cfg.model.startsWith('anthropic/'))
          w.content = [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }]
        return w
      }),
      // OpenRouter reports what each call cost
      ...(openrouter ? { usage: { include: true } } : {}),
      ...this.cfg.extraBody,
    }
    if (opts.tools?.length) {
      body.tools = opts.tools.map((t) => ({ type: 'function', function: t }))
      body.tool_choice = 'auto'
    } else if (opts.json) body.response_format = { type: 'json_object' }
    if (opts.reasoning && openrouter) body.reasoning = opts.reasoning === 'none' ? { enabled: false } : { effort: opts.reasoning }
    if (opts.provider && openrouter) body.provider = opts.provider
    // pinned: those providers and nothing a call asks (an endpoint other than OpenRouter is its own provider)
    const pin = this.cfg.pin
    if (pin && openrouter)
      body.provider = { only: pin.providers, order: pin.providers, allow_fallbacks: false, ...(pin.quantizations?.length ? { quantizations: pin.quantizations } : {}) }
    else if (pin) delete body.provider
    const timeoutMs = this.cfg.timeoutMs ?? 180_000
    if (!opts.hedgeMs && !opts.deadlineMs) return this.once(body, AbortSignal.timeout(timeoutMs))
    // the time the caller waited, hedge and retries included (what a latency report means by a call's time)
    const t0 = Date.now()
    let last: unknown
    for (let i = 0; i <= (opts.retries ?? 1); i++) {
      try {
        // (0 is the harness's "off" for both; with no deadline of its own a try still ends at the timeout)
        return { ...(await this.hedged(body, opts.hedgeMs || undefined, opts.deadlineMs || timeoutMs)), ms: Date.now() - t0 }
      } catch (err) {
        last = err
      }
    }
    throw last
  }

  /**
   * One call with a tail guard. Single calls usually take 3–7 s, but now and then a provider
   * stalls (20 s, or 180 s and an empty body). After `hedgeMs` a second, identical request goes
   * out — to the next provider in the pinned order — and the first answer wins; the other is
   * aborted. A failure before that launches the second request at once.
   */
  private hedged(body: Record<string, unknown>, hedgeMs?: number, deadlineMs?: number): Promise<ModelReply> {
    return new Promise((resolve, reject) => {
      const ctrls: AbortController[] = []
      let failures = 0
      let done = false
      let hedgeTimer: ReturnType<typeof setTimeout> | undefined
      let deadTimer: ReturnType<typeof setTimeout> | undefined
      const finish = (fn: () => void) => {
        if (done) return
        done = true
        clearTimeout(hedgeTimer)
        clearTimeout(deadTimer)
        for (const c of ctrls) c.abort()
        fn()
      }
      const launch = (b: Record<string, unknown>) => {
        const c = new AbortController()
        ctrls.push(c)
        const hedge = ctrls.length > 1
        this.once(b, c.signal).then(
          (r) => finish(() => resolve({ ...r, hedged: hedge })),
          (err) => {
            failures++
            if (!done && ctrls.length < 2 && hedgeMs !== undefined) launch(rotated(body))
            else if (failures >= ctrls.length) finish(() => reject(err))
          },
        )
      }
      launch(body)
      if (hedgeMs !== undefined) hedgeTimer = setTimeout(() => !done && ctrls.length < 2 && launch(rotated(body)), hedgeMs)
      if (deadlineMs !== undefined) deadTimer = setTimeout(() => finish(() => reject(new Error(`model: no answer within ${deadlineMs} ms`))), deadlineMs)
    })
  }

  private async once(body: Record<string, unknown>, signal: AbortSignal): Promise<ModelReply> {
    const t0 = Date.now()
    const res = await fetch(`${this.cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      // (a local server may want no key)
      headers: { 'Content-Type': 'application/json', ...(this.cfg.apiKey && { Authorization: `Bearer ${this.cfg.apiKey}` }) },
      body: JSON.stringify(body),
      signal,
    })
    const data = (await res.json().catch(() => null)) as WireReply | null
    if (!res.ok || !data) throw new Error(`model: HTTP ${res.status} ${JSON.stringify(data)?.slice(0, 300) ?? ''}`)
    const pin = this.cfg.pin
    if (pin && this.openrouter && !pin.providers.some((p) => providerKey(p) === providerKey(data.provider ?? '')))
      throw new Error(`model: served by ${data.provider ?? 'an unnamed provider'}, ${PIN_BREACH} (${pin.providers.join(', ')})`)
    // a provider that failed upstream answers 200 with an error in place of a message: an error, not an empty answer
    const choice = data.choices?.[0]
    const failed = data.error ?? choice?.error
    if (failed || choice?.finish_reason === 'error') throw new Error(`model: the provider failed: ${JSON.stringify(failed ?? choice).slice(0, 300)}`)
    const m = choice?.message
    if (!m) throw new Error('model: empty reply')
    return {
      content: m.content ?? '',
      toolCalls: (m.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function?.name ?? '', args: parseArgs(c.function?.arguments) })),
      usage: data.usage
        ? { input: data.usage.prompt_tokens ?? 0, output: data.usage.completion_tokens ?? 0, cost: data.usage.cost, reasoning: data.usage.completion_tokens_details?.reasoning_tokens }
        : undefined,
      ms: Date.now() - t0,
      provider: data.provider,
    }
  }
}

/** The same request, preferring the next provider in the pinned order (a hedge should not wait on the same stall). */
function rotated(body: Record<string, unknown>): Record<string, unknown> {
  const p = body.provider as { order?: string[] } | undefined
  if (!p?.order || p.order.length < 2) return body
  return { ...body, provider: { ...p, order: [...p.order.slice(1), p.order[0]] } }
}

interface WireReply {
  provider?: string
  error?: unknown
  choices?: { message?: { content?: string | null; tool_calls?: { id: string; function?: { name?: string; arguments?: string } }[] }; error?: unknown; finish_reason?: string }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number; completion_tokens_details?: { reasoning_tokens?: number } }
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

// ---------------------------------------------------------------- effort (Claude Code's and Anthropic's API's)

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max']
/** A call's effort: the configured one, or more when the call asks for more reasoning (never less). */
export function effortOf(floor: string | undefined, reasoning: ChatOptions['reasoning']): string {
  const base = floor ?? 'low'
  const want = reasoning === 'medium' || reasoning === 'high' ? reasoning : 'low'
  return EFFORTS.indexOf(want) > EFFORTS.indexOf(base) ? want : base
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

// ---------------------------------------------------------------- helpers

/** Best-effort JSON out of a model reply: strip code fences, else take the outermost {...}. */
export function parseJson(text: string, onRepair?: () => void): unknown {
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
    const fixed = repairBrackets(t.slice(a, b + 1))
    if (fixed !== undefined) {
      onRepair?.()
      return fixed
    }
  }
  return undefined
}

/**
 * JSON whose only fault is its brackets — the commonest malformed answer from a model writing a
 * deep tree: one `}` too many (an object closed early), or the closers missing at the end. Tries
 * dropping one closer from the run just before the error, or appending the missing ones; up to a
 * few rounds. Returns the value, or undefined when brackets are not the problem.
 */
function repairBrackets(s: string): unknown {
  const error = (x: string): { pos: number; end: boolean } | undefined => {
    try {
      JSON.parse(x)
      return undefined
    } catch (err) {
      const m = /position (\d+)/.exec((err as Error).message)
      const pos = m ? Number(m[1]) : x.length
      return { pos, end: pos >= x.trimEnd().length || /end of (JSON|data)/i.test((err as Error).message) }
    }
  }
  const missing = (x: string): string => {
    const stack: string[] = []
    let str = false
    for (let i = 0; i < x.length; i++) {
      const c = x[i]
      if (str) {
        if (c === '\\') i++
        else if (c === '"') str = false
      } else if (c === '"') str = true
      else if (c === '{') stack.push('}')
      else if (c === '[') stack.push(']')
      else if (c === '}' || c === ']') stack.pop()
    }
    return stack.reverse().join('')
  }
  let cur = s
  for (let round = 0; round < 4; round++) {
    const e = error(cur)
    if (!e) return JSON.parse(cur)
    if (e.end) {
      // a forgotten last brace or two; more than that is a truncated answer, not a typo
      const tail = missing(cur)
      if (!tail || tail.length > 2 || error(cur + tail)) return undefined
      return JSON.parse(cur + tail)
    }
    // the nearest run of closers before the error (the parser may stumble a token or two later):
    // one of them closed something too early
    let i = e.pos - 1
    while (i >= 0 && e.pos - i < 200 && cur[i] !== '}' && cur[i] !== ']') i--
    let next: string | undefined
    for (let j = i; j >= 0 && (cur[j] === '}' || cur[j] === ']'); j--) {
      const cand = cur.slice(0, j) + cur.slice(j + 1)
      const ce = error(cand)
      if (!ce) return JSON.parse(cand)
      if (ce.pos > e.pos) {
        next = cand
        break
      }
    }
    if (next === undefined) return undefined
    cur = next
  }
  return undefined
}

export interface CallRecord {
  purpose?: string
  ms: number
  input: number
  output: number
  reasoning?: number
  tools: number
  provider?: string
  hedged?: boolean
}

/** Counts calls, tokens, cost and time per episode; keeps one record per call (where latency goes). */
export class Meter implements Model {
  calls = 0
  input = 0
  output = 0
  /** USD, when the provider reports it. */
  cost = 0
  log: CallRecord[] = []
  readonly name: string
  constructor(private inner: Model) {
    this.name = inner.name
  }
  /** What the calls so far used, as an episode or a journal entry records it. */
  get usage(): { calls: number; input: number; output: number; cost: number } {
    return { calls: this.calls, input: this.input, output: this.output, cost: this.cost }
  }
  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ModelReply> {
    this.calls++
    const t0 = Date.now()
    const r = await this.inner.chat(messages, opts)
    this.input += r.usage?.input ?? 0
    this.output += r.usage?.output ?? 0
    this.cost += r.usage?.cost ?? 0
    this.log.push({ purpose: opts?.purpose, ms: r.ms ?? Date.now() - t0, input: r.usage?.input ?? 0, output: r.usage?.output ?? 0, reasoning: r.usage?.reasoning, tools: r.toolCalls.length, provider: r.provider, hedged: r.hedged })
    return r
  }
}

/**
 * A machine where no Anthropic model may be called (LSW_NO_ANTHROPIC=1): the claude-code backend and OpenRouter's
 * anthropic/* models refuse.
 */
export function noAnthropicHere(env: Record<string, string | undefined> = globalThis.process?.env ?? {}, what?: string): void {
  if (what && env.LSW_NO_ANTHROPIC === '1') throw new Error(`${what} is refused on this machine (LSW_NO_ANTHROPIC=1): no Anthropic model is called from here`)
}

// ---------------------------------------------------------------- Anthropic's own API
// Claude through Anthropic's own API, with an API key (ANTHROPIC_API_KEY): the backend `anthropic`. A call is one
// Messages request in the API's own shapes — the system prompt (the ModSpec, the same every call) cached, tools as
// tools, the effort the call asks for (never less than the configured floor) — and a declined call goes on to the
// model's default fallback, which the reply names as its provider. Its cost is reckoned from the usage the API reports
// at Anthropic's list prices.

/** List prices in USD per million tokens: input, output, a cache read, a cache write (five minutes). */
const PRICES: Record<string, [number, number, number, number]> = {
  'claude-opus-5-5': [4, 20, 0.2, 5],
  'claude-sonnet-5-5': [2, 10, 0.2, 2.5],
  'claude-haiku-5-5': [0.1, 0.5, 0.01, 0.125],
  'claude-fable-5-1': [10, 50, 0.25, 12.5],
}

export interface AnthropicConfig {
  /** e.g. claude-opus-5-5 */
  model: string
  /** low | medium | high | xhigh | max: the least effort of every call (`effortOf`, as the claude-code backend's) */
  effort?: string
  /** default: ANTHROPIC_API_KEY */
  apiKey?: string
  timeoutMs?: number
  maxTokens?: number
  /** Called from a browser with the player's own key (docs/byok.md): the key goes to Anthropic and nowhere else. */
  browser?: boolean
  /** Another address than Anthropic's own (a gateway of the player's). */
  baseUrl?: string
}

type Block = Anthropic.Beta.BetaContentBlockParam
type Turn = Anthropic.Beta.BetaMessageParam

/** The turns with a cache breakpoint on the last block of the last one (when `on`). */
function cachedTo(turns: Turn[], on: boolean): Turn[] {
  const last = turns.at(-1)
  if (!on || !last) return turns
  const blocks: Block[] = typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : [...last.content]
  const end = blocks.length - 1
  if (end < 0 || blocks[end].type === 'thinking' || blocks[end].type === 'redacted_thinking') return turns
  blocks[end] = { ...blocks[end], cache_control: { type: 'ephemeral' } } as Block
  return [...turns.slice(0, -1), { ...last, content: blocks }]
}

export class AnthropicModel implements Model {
  readonly name: string
  private client: Anthropic
  /**
   * An assistant turn's blocks as the API sent them, its thinking with them, by its first tool call's id: a tool
   * conversation is sent back as it was said, never rebuilt (a rebuilt turn would lose the thinking it carries).
   */
  private said = new Map<string, Block[]>()

  constructor(private cfg: AnthropicConfig) {
    this.name = `anthropic:${cfg.model}@${cfg.effort ?? 'low'}`
    this.client = new Anthropic({ apiKey: cfg.apiKey, timeout: cfg.timeoutMs ?? 180_000, maxRetries: 2, ...(cfg.baseUrl && { baseURL: cfg.baseUrl }), ...(cfg.browser && { dangerouslyAllowBrowser: true }) })
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ModelReply> {
    noAnthropicHere(undefined, 'the anthropic backend')
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
    const tools = opts.tools?.length ? opts.tools : undefined
    const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
      model: this.cfg.model,
      max_tokens: this.cfg.maxTokens ?? 16_000,
      ...(system ? { system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] } : {}),
      // a tool conversation goes on: its history is cached up to the last turn, so the next step reads it, not pays it again
      messages: cachedTo(this.turns(messages.filter((m) => m.role !== 'system'), !!opts.json && !tools, !!tools), !!tools),
      output_config: { effort: effortOf(this.cfg.effort, opts.reasoning) as 'low' },
      ...(tools
        ? {
            tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema })),
            tool_choice: { type: 'auto' as const },
          }
        : {}),
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    }
    const t0 = Date.now()
    // (a deadline of 0 is the harness's "off", as the API backend reads it)
    const r = await this.client.beta.messages.create(params, { timeout: opts.deadlineMs || this.cfg.timeoutMs || 180_000, maxRetries: opts.retries ?? 2 })
    if (r.stop_reason === 'refusal') throw new Error(`anthropic: declined (${r.stop_details?.category ?? 'no category'})`)
    const text = r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const calls: ToolCall[] = r.content.flatMap((b) => (b.type === 'tool_use' ? [{ id: b.id, name: b.name, args: b.input }] : []))
    if (calls.length) this.said.set(calls[0].id, r.content as unknown as Block[])
    const u = r.usage
    const read = u.cache_read_input_tokens ?? 0
    const wrote = u.cache_creation_input_tokens ?? 0
    const price = PRICES[r.model] ?? PRICES[this.cfg.model]
    const cost = price ? (u.input_tokens * price[0] + u.output_tokens * price[1] + read * price[2] + wrote * price[3]) / 1e6 : undefined
    return {
      content: text,
      toolCalls: calls,
      usage: { input: u.input_tokens + read + wrote, output: u.output_tokens, cost },
      ms: Date.now() - t0,
      // the model that answered: another than the one asked for means its fallback did
      provider: r.model === this.cfg.model ? 'anthropic' : `anthropic fallback ${r.model}`,
    }
  }

  /**
   * The conversation in the API's turns: tool results together in one user turn, and the JSON request at the end.
   * A call that offers no tools gets its history's tool calls and results as text (the API refuses tool blocks in a
   * request that defines no tools: the design's last call after its tool rounds is one).
   */
  private turns(messages: ChatMessage[], json: boolean, tools: boolean): Turn[] {
    const out: Turn[] = []
    for (const m of messages) {
      if (!tools && m.role === 'tool') out.push({ role: 'user', content: `[result of ${m.toolCallId}]\n${m.content}` })
      else if (!tools && m.role === 'assistant' && m.toolCalls?.length)
        out.push({ role: 'assistant', content: [m.content, ...m.toolCalls.map((c) => `[called ${c.name} (${c.id}) with ${JSON.stringify(c.args ?? {})}]`)].filter(Boolean).join('\n') })
      else if (m.role === 'tool') {
        const result: Block = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }
        const last = out[out.length - 1]
        if (last?.role === 'user' && Array.isArray(last.content) && last.content.every((b) => b.type === 'tool_result')) last.content.push(result)
        else out.push({ role: 'user', content: [result] })
      } else if (m.role === 'assistant') {
        if (m.toolCalls?.length) {
          const blocks: Block[] = this.said.get(m.toolCalls[0].id) ?? [
            ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
            ...m.toolCalls.map((c) => ({ type: 'tool_use' as const, id: c.id, name: c.name, input: c.args ?? {} })),
          ]
          out.push({ role: 'assistant', content: blocks })
        } else out.push({ role: 'assistant', content: m.content || '(nothing)' })
      } else out.push({ role: 'user', content: m.content })
    }
    if (out[0]?.role !== 'user') out.unshift({ role: 'user', content: '(begin)' })
    if (json) out.push({ role: 'user', content: 'Reply with one JSON object and nothing else.' })
    return out
  }
}

/**
 * A backend that cannot answer says so in its error: out of quota or throttling (claude-code's session
 * limit, an HTTP 429, a provider's quota), or not signed in (an expired OAuth session, a 401/403, a bad key).
 */
export const BACKEND_DOWN = /session limit|usage limit|rate.?limit|quota|\b429\b|overloaded|insufficient_quota|authenticat|oauth|unauthori[sz]ed|\b401\b|\b403\b|invalid.?api.?key|not logged in/i
