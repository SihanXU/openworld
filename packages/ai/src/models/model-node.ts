// What of the model needs Node: Claude Code's print mode (a child process), a script file, and the model
// the environment names (model.ts is the part that runs anywhere).

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, isAbsolute, join } from 'node:path'
import { AnthropicModel } from './anthropic.ts'
import { OpenAICompatModel, ScriptedModel, effortOf, noAnthropicHere, parseJson, type ChatMessage, type ChatOptions, type Model, type ModelReply, type ProviderPin, type ToolCall, type ToolSpec } from './model.ts'

// ---------------------------------------------------------------- Claude Code (headless)

export interface ClaudeCodeConfig {
  /** e.g. claude-opus-5-5 */
  model: string
  /**
   * low | medium | high | xhigh | max: the least effort of every call; a call that asks for more reasoning
   * (`reasoning` medium or high: the high AI setting's design, the offline profile) gets that much
   */
  effort?: string
  /** fast mode (the account must allow it: extra usage on); the reply says when it was not granted */
  fast?: boolean
  /** the `claude` executable (default: `claude` on the PATH) */
  bin?: string
  timeoutMs?: number
}

/**
 * A model reached through Claude Code's print mode (`claude -p`), signed in as the user: no API
 * key. Each call is one fresh, tool-less session that reads the transcript from stdin. The
 * design stage's tools are offered as a text protocol (a JSON object of tool calls), since the
 * session's own tools are switched off.
 *
 * Caching: Claude Code caches the prompt's prefix (with a one-hour lifetime), and a fresh
 * process reads what an earlier one wrote. A cached prefix ends at a block boundary: Claude Code
 * marks the system prompt and the last content block of the last message, and the API looks for
 * an earlier entry only at block boundaries (up to about 20 blocks back from a mark).
 * - The system prompt is passed exactly as the caller built it, from a file (it outgrows an
 *   argument's size limit as the content grows): every call with the same system prompt reads it
 *   from the cache, whatever the call asks.
 * - A call with tools is a step of a conversation (the agent loop: up to 40 steps on a transcript
 *   that grows to tens of thousands of tokens; the design and the auditor with their tools). It
 *   goes as stream-json: one user message with one text block per turn, the tool protocol first
 *   (fixed for the conversation). The next step's message is this one with blocks appended, so its
 *   prefix up to this step's last block is read from the cache, and only the new turns are written.
 *   (One text block whose end changed every step, as before, matched nothing past the system prompt.)
 * - Any other call (the live design, reviews, reflections: one call each) is plain text, with
 *   "reply with JSON" after the transcript.
 */
export class ClaudeCodeModel implements Model {
  readonly name: string
  constructor(private cfg: ClaudeCodeConfig) {
    this.name = `claude-code:${cfg.model}@${cfg.effort ?? 'low'}${cfg.fast ? '+fast' : ''}`
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ModelReply> {
    noAnthropicHere(process.env, 'claude -p')
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
    const turns = messages.filter((m) => m.role !== 'system').map(transcriptLine)
    // a step of a tool conversation: one block per turn, so the next step only appends (the class comment)
    const stream = !!opts.tools?.length
    const tail = opts.json ? ['[instructions]\nReply with one JSON object and nothing else.'] : []
    const prompt = stream ? conversationInput(opts.tools!, turns) : [...turns, ...tail].join('\n\n')
    const dir = mkdtempSync(join(tmpdir(), 'lsw-claude-'))
    const systemFile = join(dir, 'system.txt')
    writeFileSync(systemFile, system)
    const args = [
      '-p', '--model', this.cfg.model, '--effort', effortOf(this.cfg.effort, opts.reasoning), '--output-format', stream ? 'stream-json' : 'json',
      '--tools', '', '--setting-sources', '', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence',
      '--system-prompt-file', systemFile,
      ...(this.cfg.fast ? ['--settings', JSON.stringify({ fastMode: true })] : []),
      // stream-json input needs stream-json output, and that needs --verbose in print mode
      ...(stream ? ['--input-format', 'stream-json', '--verbose'] : []),
    ]
    // (a deadline of 0 is the harness's "off", as the API backend reads it)
    const timeout = opts.deadlineMs || this.cfg.timeoutMs || 180_000
    let last: unknown
    try {
      for (let i = 0; i <= (opts.retries ?? 0); i++) {
        try {
          return this.reply(await runClaude(this.cfg.bin ?? 'claude', args, prompt, timeout, stream), stream)
        } catch (err) {
          last = err
        }
      }
      throw last
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  private reply(out: { data: ClaudeResult; ms: number }, tools: boolean): ModelReply {
    const d = out.data
    if (d.is_error || typeof d.result !== 'string') throw new Error(`claude-code: ${String(d.result ?? d.subtype ?? 'error').slice(0, 300)}`)
    const u = d.usage ?? {}
    const usage = {
      input: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
      output: u.output_tokens ?? 0,
      cost: d.total_cost_usd,
      reasoning: u.output_tokens_details?.thinking_tokens,
    }
    const calls = tools ? toolCallsOf(d.result) : []
    // fast asked for but not granted shows in the provider (latency reports print it)
    const slow = this.cfg.fast && d.fast_mode_state !== 'on' ? ` (fast ${d.fast_mode_state ?? 'off'}: ${d.fast_mode_disabled_reason ?? 'unknown'})` : ''
    return { content: calls.length ? '' : d.result, toolCalls: calls, usage, ms: out.ms, provider: `claude-code${this.cfg.fast && !slow ? ' fast' : ''}${slow}` }
  }
}

interface ClaudeResult {
  is_error?: boolean
  subtype?: string
  result?: string
  total_cost_usd?: number
  fast_mode_state?: string
  fast_mode_disabled_reason?: string
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number; output_tokens_details?: { thinking_tokens?: number } }
}

/**
 * How to start a command by name or path on this platform. Elsewhere: as given. On Windows a
 * process can only be started from an .exe: a script with a node shebang runs under this node,
 * and a name is looked up on PATH as .exe, then .cmd (what `npm i -g` installs, run through
 * cmd.exe with its arguments quoted — ours are flags, model ids and temp-file paths; the prompt
 * goes through stdin).
 */
export function commandFor(bin: string, args: string[]): { file: string; args: string[]; shell: boolean } {
  if (process.platform !== 'win32') return { file: bin, args, shell: false }
  const isFile = (p: string) => existsSync(p) && statSync(p).isFile()
  const isScript = (p: string) => {
    try {
      return /^#!.*\bnode\b/.test(readFileSync(p, 'utf8').slice(0, 200))
    } catch {
      return false
    }
  }
  const cmd = (p: string) => ({ file: `"${p}"`, args: args.map((a) => `"${a.replace(/"/g, '""')}"`), shell: true })
  const found = (p: string) => {
    if (/\.exe$/i.test(p)) return { file: p, args, shell: false }
    if (/\.(cmd|bat)$/i.test(p)) return cmd(p)
    if (isScript(p)) return { file: process.execPath, args: [p, ...args], shell: false }
    return undefined
  }
  if (/[\\/]/.test(bin) || isAbsolute(bin)) {
    for (const p of [bin, `${bin}.exe`, `${bin}.cmd`]) if (isFile(p)) return found(p) ?? { file: p, args, shell: false }
    return { file: bin, args, shell: false }
  }
  for (const dir of (process.env.PATH ?? '').split(delimiter).filter(Boolean))
    for (const ext of ['.exe', '.cmd', '.bat', '']) {
      const p = join(dir, bin + ext)
      const f = isFile(p) && found(p)
      if (f) return f
    }
  return { file: bin, args, shell: false }
}

/** Print mode's answer: one JSON object (json), or the `result` line of a stream of them (stream-json). */
function resultOf(out: string, stream: boolean): ClaudeResult {
  if (!stream) return JSON.parse(out) as ClaudeResult
  for (const line of out.trim().split('\n').reverse()) {
    const j = JSON.parse(line) as ClaudeResult & { type?: string }
    if (j.type === 'result') return j
  }
  throw new Error('no result in the stream')
}

/**
 * The CLI's traffic that is not the call: the update check, telemetry, error reports, surveys.
 * Measured (2026-10-09, Opus 5.5 low, a one-word answer): with it a call is 3.5–3.8 s of wall
 * for 1.1 s of API; without it 1.5–1.7 s. Every call of the modder's pays that, so it is off.
 */
const QUIET_CLI = { DISABLE_TELEMETRY: '1', DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', DISABLE_ERROR_REPORTING: '1', DISABLE_COST_WARNINGS: '1', DISABLE_BUG_COMMAND: '1', DISABLE_FEEDBACK_SURVEY: '1' }

function runClaude(bin: string, args: string[], stdin: string, timeoutMs: number, stream = false): Promise<{ data: ClaudeResult; ms: number }> {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    // outside the repo, so the session picks up no project instructions
    const c = commandFor(bin, args)
    const child = spawn(c.file, c.args, { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'], shell: c.shell, windowsHide: true, env: { ...process.env, ...QUIET_CLI } })
    let out = ''
    let err = ''
    const timer = setTimeout(() => (child.kill(), reject(new Error(`model: no answer within ${timeoutMs} ms`))), timeoutMs)
    child.stdout.on('data', (c: Buffer) => (out += c))
    child.stderr.on('data', (c: Buffer) => (err += c))
    child.on('error', (e) => (clearTimeout(timer), reject(e)))
    // a session that ends before reading all of stdin (signed out, a bad flag) closes the pipe:
    // that is reported by 'close' below, not thrown as an unhandled EPIPE
    child.stdin.on('error', () => {})
    child.on('close', (code) => {
      clearTimeout(timer)
      try {
        resolve({ data: resultOf(out, stream), ms: Date.now() - t0 })
      } catch {
        reject(new Error(`claude-code: exit ${code} ${(err || out).slice(0, 300)}`))
      }
    })
    child.stdin.end(stdin)
  })
}

function transcriptLine(m: ChatMessage): string {
  if (m.role === 'tool') return `[tool result: ${m.name} #${m.toolCallId}]\n${m.content}`
  if (m.role === 'assistant')
    return `[assistant]\n${m.content}${m.toolCalls?.length ? `\n${JSON.stringify({ tool_calls: m.toolCalls.map((c) => ({ id: c.id, name: c.name, args: c.args })) })}` : ''}`
  return `[${m.role}]\n${m.content}`
}

/**
 * A tool conversation as stream-json input: one user message whose blocks are the tool protocol,
 * then one per turn. Blocks are never merged, so a step's blocks are the last step's and its new turns.
 */
function conversationInput(tools: ToolSpec[], turns: string[]): string {
  const content = [`[instructions]\n${toolProtocol(tools)}`, ...turns].map((text) => ({ type: 'text', text }))
  return `${JSON.stringify({ type: 'user', message: { role: 'user', content }, parent_tool_use_id: null, session_id: '' })}\n`
}

function toolProtocol(tools: ToolSpec[]): string {
  return [
    '## Tools',
    'To call tools, reply with exactly one JSON object and nothing else: {"tool_calls": [{"name": "<tool>", "args": {...}}]}.',
    'Their results come back as [tool result] blocks. When you need no more tools, reply with your final answer instead (not in that form).',
    ...tools.map((t) => `- ${t.name}: ${t.description}\n  args (JSON Schema): ${JSON.stringify(t.parameters)}`),
  ].join('\n')
}

function toolCallsOf(text: string): ToolCall[] {
  let j = parseJson(text) as { tool_calls?: { name?: unknown; args?: unknown }[] } | undefined
  // the protocol asks for the object alone, but a model may say a sentence first, braces and all:
  // the call is the object that begins at "tool_calls"
  const at = text.search(/\{\s*"tool_calls"\s*:/)
  if (!Array.isArray(j?.tool_calls) && at > 0) j = parseJson(text.slice(at)) as typeof j
  if (!j || !Array.isArray(j.tool_calls)) return []
  return j.tool_calls
    .filter((c) => typeof c?.name === 'string')
    .map((c, i) => ({ id: `call_${Date.now().toString(36)}_${i}`, name: c.name as string, args: c.args ?? {} }))
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

/**
 * From the environment: LSW_MODEL_SCRIPT=<file> for a scripted model; otherwise the backend
 * LSW_MODEL_BACKEND names (`npm run dev` asks for it):
 * - `openrouter` (the default): LSW_MODEL_URL + LSW_MODEL_KEY + LSW_MODEL for an OpenAI-compatible endpoint.
 *   LSW_MODEL_PROVIDERS=together,parasail pins OpenRouter's providers in that order (others stay as fallbacks);
 *   pin by measurement (npm run latency): OpenRouter's own throughput sort picked the slowest one.
 *   LSW_MODEL_SORT=throughput|latency|price lets OpenRouter choose instead.
 *   LSW_MODEL_PIN=moonshotai freezes the model for an experiment (docs/rsi-experiments.md §3): those providers
 *   only, no fallback, whatever a call asks; LSW_MODEL_QUANT=fp8 also fixes the precision. It excludes the two above.
 * - `claude-code`: `claude -p`, signed in as the user. LSW_CLAUDE_MODEL (default claude-opus-5-5),
 *   LSW_CLAUDE_EFFORT (default low), LSW_CLAUDE_BIN (default `claude`). LSW_CLAUDE_FAST=1 (`--fast`)
 *   asks for fast mode; it applies to this backend only.
 * - `anthropic`: Anthropic's API with ANTHROPIC_API_KEY (anthropic.ts). LSW_CLAUDE_MODEL (default claude-opus-5-5) and
 *   LSW_CLAUDE_EFFORT (default low), as for claude-code.
 * - `none`: no model; the modder answers from the shared library only.
 */
export function modelFromEnv(env: Record<string, string | undefined> = process.env): Model | undefined {
  if (env.LSW_MODEL_SCRIPT) return scriptFromFile(env.LSW_MODEL_SCRIPT)
  const backend = env.LSW_MODEL_BACKEND || 'openrouter'
  noAnthropicHere(env, backend === 'claude-code' || backend === 'anthropic' ? `the ${backend} backend` : /^anthropic\//.test(env.LSW_MODEL ?? '') ? env.LSW_MODEL : undefined)
  const fast = env.LSW_CLAUDE_FAST === '1'
  if (!['openrouter', 'claude-code', 'anthropic', 'none'].includes(backend)) throw new Error(`LSW_MODEL_BACKEND: unknown backend "${backend}" (openrouter | claude-code | anthropic | none)`)
  if (fast && backend !== 'claude-code') throw new Error(`--fast (LSW_CLAUDE_FAST=1) applies to the claude-code backend only, not "${backend}"`)
  const pin = pinFromEnv(env)
  if (pin && backend !== 'openrouter') throw new Error(`LSW_MODEL_PIN applies to the openrouter backend only, not "${backend}"`)
  if (backend === 'none') return undefined
  if (backend === 'claude-code')
    return new ClaudeCodeModel({ model: env.LSW_CLAUDE_MODEL || 'claude-opus-5-5', effort: env.LSW_CLAUDE_EFFORT || 'low', fast, bin: env.LSW_CLAUDE_BIN })
  if (backend === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) throw new Error('the anthropic backend needs ANTHROPIC_API_KEY')
    return new AnthropicModel({ model: env.LSW_CLAUDE_MODEL || 'claude-opus-5-5', effort: env.LSW_CLAUDE_EFFORT || 'low', apiKey: env.ANTHROPIC_API_KEY })
  }
  if (!env.LSW_MODEL_KEY || !env.LSW_MODEL) return undefined
  if (pin && (env.LSW_MODEL_SORT || env.LSW_MODEL_PROVIDERS)) throw new Error('LSW_MODEL_PIN freezes the provider: LSW_MODEL_SORT and LSW_MODEL_PROVIDERS cannot be set with it')
  const extra: Record<string, unknown> = env.LSW_MODEL_EXTRA ? JSON.parse(env.LSW_MODEL_EXTRA) : {}
  if (env.LSW_MODEL_SORT) extra.provider = { ...(extra.provider as object), sort: env.LSW_MODEL_SORT }
  if (env.LSW_MODEL_PROVIDERS) extra.provider = { ...(extra.provider as object), order: env.LSW_MODEL_PROVIDERS.split(',').map((s) => s.trim()), allow_fallbacks: true }
  return new OpenAICompatModel({ baseUrl: env.LSW_MODEL_URL || 'https://openrouter.ai/api/v1', apiKey: env.LSW_MODEL_KEY, model: env.LSW_MODEL, extraBody: extra, pin })
}

/** The provider pin LSW_MODEL_PIN (and LSW_MODEL_QUANT) name, if any. */
export function pinFromEnv(env: Record<string, string | undefined> = process.env): ProviderPin | undefined {
  const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const providers = list(env.LSW_MODEL_PIN)
  if (!providers.length) return undefined
  const quantizations = list(env.LSW_MODEL_QUANT)
  return { providers, ...(quantizations.length ? { quantizations } : {}) }
}
