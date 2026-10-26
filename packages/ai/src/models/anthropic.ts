// Claude through Anthropic's own API, with an API key (ANTHROPIC_API_KEY): the backend `anthropic`. A call is one
// Messages request in the API's own shapes — the system prompt (the ModSpec, the same every call) cached, tools as
// tools, the effort the call asks for (never less than the configured floor) — and a declined call goes on to the
// model's default fallback, which the reply names as its provider. Its cost is reckoned from the usage the API reports
// at Anthropic's list prices.

import Anthropic from '@anthropic-ai/sdk'
import { effortOf, noAnthropicHere, type ChatMessage, type ChatOptions, type Model, type ModelReply, type ToolCall } from './model.ts'

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
