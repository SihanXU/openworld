// The model backends at their edges, against local stand-ins: the harness's 0 for "off" (hedge, deadline), a hedged
// call's timeout and wall time, a provider's error inside a 200, a tool history in a call that offers no tools;
// Claude Code's print mode; and the player's own model (docs/byok.md): the services offered, a model made from a
// choice, and what goes where (OpenRouter's own fields to OpenRouter only, the key in the header its service reads
// and nowhere else).

import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnthropicModel, ClaudeCodeModel, MemFiles, Meter, OpenAICompatModel, PROVIDERS, SelfState, baseUrlOf, commandFor, configProblem, keyHint, listModels, modelFromEnv, modelOf, providerOf, scrub, testModel, type ChatMessage } from '../src/index.ts'

type Handler = (n: number, body: Record<string, unknown>, req: IncomingMessage, res: ServerResponse) => void
const servers: { close(): void }[] = []
afterEach(() => {
  for (const s of servers.splice(0)) s.close()
})

/** A stand-in for the `claude` CLI: a node script (so it runs on Windows too) in a directory of its own. */
function claudeBin(script: (dir: string) => string): string {
  const dir = mkdtempSync(join(tmpdir(), 'fake-claude-'))
  const bin = join(dir, 'claude')
  writeFileSync(bin, script(dir))
  chmodSync(bin, 0o755)
  return bin
}

/** A local OpenAI-compatible stand-in: `handle` gets the request's ordinal (0, 1, ...) and its body. */
async function serve(handle: Handler): Promise<{ url: string; origin: string; hits: { n: number; at: number }[] }> {
  const hits: { n: number; at: number }[] = []
  const t0 = Date.now()
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      const n = hits.length
      hits.push({ n, at: Date.now() - t0 })
      handle(n, raw ? JSON.parse(raw) : {}, req, res)
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  servers.push({ close: () => (server.closeAllConnections(), server.close()) })
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  return { url: `${origin}/v1`, origin, hits }
}
const answer = (res: ServerResponse, content: string, extra: Record<string, unknown> = {}) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 2 }, ...extra }))
}
const user = [{ role: 'user' as const, content: 'hi' }]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('OpenAICompatModel tail guard', () => {
  it('hedgeMs 0 means no hedge (state.ts: "0 = off"): one request, not two at once', async () => {
    const s = await serve((_n, _b, _req, res) => setTimeout(() => answer(res, '{"ok":1}'), 150))
    const model = new OpenAICompatModel({ baseUrl: s.url, apiKey: 'k', model: 'm' })
    // the live profile with `npm run latency -- --no-hedge` (hedgeMs 0, deadlineMs 0) at a find/create stage: converse() passes SLOW_MS
    const r = await model.chat(user, { hedgeMs: 0, deadlineMs: 60_000 })
    expect(r.content).toBe('{"ok":1}')
    expect(s.hits.length).toBe(1)
  })

  it('deadlineMs 0 means no deadline (as the claude-code and anthropic backends read it)', async () => {
    const s = await serve((_n, _b, _req, res) => setTimeout(() => answer(res, '{"ok":1}'), 50))
    const model = new OpenAICompatModel({ baseUrl: s.url, apiKey: 'k', model: 'm' })
    const r = await model.chat(user, { hedgeMs: 5_000, deadlineMs: 0, retries: 0 })
    expect(r.content).toBe('{"ok":1}')
  })

  it('a hedged call without a deadline still gives up after the configured timeoutMs', async () => {
    const s = await serve(() => {}) // never answers
    const model = new OpenAICompatModel({ baseUrl: s.url, apiKey: 'k', model: 'm', timeoutMs: 300 })
    const outcome = await Promise.race([
      model.chat(user, { hedgeMs: 50, retries: 0 }).then(
        () => 'answered',
        () => 'gave up',
      ),
      sleep(3_000).then(() => 'still waiting after 3 s'),
    ])
    expect(outcome).toBe('gave up')
  })

  it("a hedged reply's ms is the wall time the caller waited, hedge delay included (Meter's per-call latency)", async () => {
    const s = await serve((n, _b, _req, res) => {
      if (n === 0) return // the first request stalls
      setTimeout(() => answer(res, '{"ok":1}'), 30)
    })
    const meter = new Meter(new OpenAICompatModel({ baseUrl: s.url, apiKey: 'k', model: 'm' }))
    const t0 = Date.now()
    const r = await meter.chat(user, { hedgeMs: 400, deadlineMs: 5_000, retries: 0 })
    const wall = Date.now() - t0
    expect(r.hedged).toBe(true)
    expect(wall).toBeGreaterThanOrEqual(400)
    expect(meter.log[0].ms).toBeGreaterThanOrEqual(400)
  })
})

describe('OpenAICompatModel error replies', () => {
  // OpenRouter's non-streaming choice carries `error` (HTTP 200) when the upstream provider failed
  const errorChoice = { choices: [{ finish_reason: 'error', message: { role: 'assistant', content: null }, error: { code: 502, message: 'upstream provider error' } }] }

  it('an HTTP 200 whose choice is an error is an error, not an empty answer', async () => {
    const s = await serve((_n, _b, _req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(errorChoice))
    })
    const model = new OpenAICompatModel({ baseUrl: s.url, apiKey: 'k', model: 'm' })
    await expect(model.chat(user)).rejects.toThrow()
  })

  it('an error choice does not win the hedge race over a real answer', async () => {
    const s = await serve((n, _b, _req, res) => {
      if (n === 0) {
        // the first request stalls past the hedge, then the provider reports an error
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(errorChoice))
        }, 150)
      } else setTimeout(() => answer(res, '{"rule":"real"}'), 300)
    })
    const model = new OpenAICompatModel({ baseUrl: s.url, apiKey: 'k', model: 'm' })
    const r = await model.chat(user, { hedgeMs: 50, deadlineMs: 5_000, retries: 0 })
    expect(r.content).toBe('{"rule":"real"}')
  })
})

describe('AnthropicModel', () => {
  it('a call without tools whose history holds tool_use/tool_result still defines tools (the API refuses otherwise)', async () => {
    // Anthropic's Messages API: "Requests which include `tool_use` or `tool_result` blocks must define tools."
    // The design stage's converse() does exactly this: tool rounds, then FINALIZE with { json: true } and no tools.
    const bodies: Record<string, unknown>[] = []
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        const body = JSON.parse(raw) as { messages: { content: unknown }[]; tools?: unknown[] }
        bodies.push(body)
        const hasToolBlocks = JSON.stringify(body.messages).includes('"tool_use"') || JSON.stringify(body.messages).includes('"tool_result"')
        res.writeHead(hasToolBlocks && !body.tools?.length ? 400 : 200, { 'Content-Type': 'application/json' })
        if (hasToolBlocks && !body.tools?.length)
          return res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Requests which include `tool_use` or `tool_result` blocks must define tools.' } }))
        const first = bodies.length === 1
        res.end(
          JSON.stringify({
            id: 'msg', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: first ? 'tool_use' : 'end_turn',
            content: first ? [{ type: 'tool_use', id: 'toolu_1', name: 'get_rule', input: { id: 'x' } }] : [{ type: 'text', text: '{"ok":1}' }],
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
        )
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    servers.push({ close: () => (server.closeAllConnections(), server.close()) })
    const model = new AnthropicModel({ model: 'claude-opus-5-5', apiKey: 'test', baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}` })
    const tools = [{ name: 'get_rule', description: 'a rule', parameters: { type: 'object', properties: { id: { type: 'string' } } } }]
    const messages: Parameters<AnthropicModel['chat']>[0] = [{ role: 'system', content: 's' }, { role: 'user', content: 'design' }]
    const r1 = await model.chat(messages, { tools, retries: 0 })
    messages.push({ role: 'assistant', content: r1.content, toolCalls: r1.toolCalls })
    messages.push({ role: 'tool', toolCallId: r1.toolCalls[0].id, name: 'get_rule', content: '{...}' })
    messages.push({ role: 'user', content: 'Tool budget spent: give your final answer.' })
    const r2 = await model.chat(messages, { json: true, retries: 0 })
    expect(r2.content).toBe('{"ok":1}')
  })
})

describe('the anthropic backend', () => {
  // the offline profile's design calls carry deadlineMs 0 (off); read as 0 ms, every offline call timed out at once
  it('takes deadlineMs 0 as no deadline', async () => {
    const { origin } = await serve((_n, _b, _req, res) =>
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }))
      }, 50),
    )
    const model = new AnthropicModel({ model: 'claude-opus-5-5', apiKey: 'test', baseUrl: origin })
    const r = await model.chat([{ role: 'system', content: 's' }, { role: 'user', content: 'u' }], { json: true, deadlineMs: 0, retries: 0 })
    expect(r.content).toBe('{"ok":true}')
  })
})

interface FakeCall {
  args: string[]
  stdin: string
  system: string
}

/**
 * A stand-in for `claude -p`: it answers by what its system prompt and stdin say, as print mode's
 * JSON (or, given stream-json input, as a stream ending in a result line, which needs --verbose as
 * the real one does), and logs each call's arguments, stdin and system prompt beside itself.
 */
function fakeClaude(): { bin: string; calls: () => FakeCall[]; systems: () => string[] } {
  let log = ''
  const bin = claudeBin((dir) => {
    log = join(dir, 'calls.jsonl')
    writeFileSync(log, '')
    return `#!/usr/bin/env node
const fs = require('fs')
const args = process.argv.slice(2)
const arg = (k) => args[args.indexOf(k) + 1]
const stream = arg('--input-format') === 'stream-json'
if (stream && (arg('--output-format') !== 'stream-json' || !args.includes('--verbose'))) {
  console.error('Error: --input-format=stream-json requires output-format=stream-json (and --verbose)')
  process.exit(1)
}
let stdin = ''
process.stdin.on('data', (c) => (stdin += c))
process.stdin.on('end', () => {
  const system = fs.readFileSync(arg('--system-prompt-file'), 'utf8')
  fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args, stdin, system }) + '\\n')
  const text = stream ? stdin.trim().split('\\n').map((l) => JSON.parse(l).message.content.map((b) => b.text).join('\\n\\n')).join('\\n\\n') : stdin
  const say = (o) => (stream ? console.log(JSON.stringify({ type: 'system', subtype: 'init' }) + '\\n' + JSON.stringify({ type: 'result', ...o })) : console.log(JSON.stringify(o)))
  let result
  if (text.includes('FAIL')) return say({ is_error: true, result: 'Failed to authenticate' })
  // a sentence first, with braces of its own, then the call (seen live: the protocol asks for the object alone)
  if (text.includes('PROSE') && text.includes('## Tools') && !text.includes('[tool result: ')) result = 'The { "from": "request" } form does not build here; I will read the rule.\\n' + JSON.stringify({ tool_calls: [{ name: 'get_rule', args: { id: 'core/use' } }] })
  else if (text.includes('## Tools') && !text.includes('[tool result: ')) result = JSON.stringify({ tool_calls: [{ name: 'get_rule', args: { id: 'core/use' } }] })
  else result = JSON.stringify({ model: arg('--model'), effort: arg('--effort'), tools: arg('--tools'), sawResult: text.includes('[tool result: get_rule'), json: text.includes('one JSON object') })
  say({ is_error: false, result, total_cost_usd: 0.01, usage: { input_tokens: 10, cache_read_input_tokens: 90, output_tokens: 5, output_tokens_details: { thinking_tokens: 2 } } })
})
`
  })
  const calls = () => readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as FakeCall)
  return { bin, calls, systems: () => calls().map((c) => c.system) }
}

/** The blocks of a stream-json call's one user message. */
function blocksOf(c: FakeCall): string[] {
  const lines = c.stdin.trim().split('\n')
  expect(lines).toHaveLength(1)
  const m = JSON.parse(lines[0]) as { type: string; message: { role: string; content: { type: string; text: string }[] } }
  expect(m).toMatchObject({ type: 'user', message: { role: 'user' } })
  return m.message.content.map((b) => b.text)
}

const tools = [{ name: 'get_rule', description: 'a rule by id', parameters: { type: 'object', properties: { id: { type: 'string' } } } }]

describe('the Claude Code backend (claude -p)', () => {
  it('answers a JSON call with the configured model and effort, with no tools of its own', async () => {
    const { bin } = fakeClaude()
    const m = new ClaudeCodeModel({ model: 'claude-opus-5-5', effort: 'low', bin })
    const r = await m.chat([{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }], { json: true })
    expect(JSON.parse(r.content)).toEqual({ model: 'claude-opus-5-5', effort: 'low', tools: '', sawResult: false, json: true })
    expect(r.usage).toEqual({ input: 100, output: 5, cost: 0.01, reasoning: 2 })
    expect(r.provider).toBe('claude-code')
  })

  it('offers tools as a text protocol: a tool call comes back, and its result is read on the next turn', async () => {
    const { bin } = fakeClaude()
    const m = new ClaudeCodeModel({ model: 'claude-opus-5-5', bin })
    const first = await m.chat([{ role: 'system', content: 'sys' }, { role: 'user', content: 'design' }], { tools })
    expect(first.toolCalls).toMatchObject([{ name: 'get_rule', args: { id: 'core/use' } }])
    const c = first.toolCalls[0]
    const second = await m.chat(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'design' },
        { role: 'assistant', content: '', toolCalls: [c] },
        { role: 'tool', toolCallId: c.id, name: c.name, content: '{"id":"core/use"}' },
      ],
      { tools },
    )
    expect(second.toolCalls).toEqual([])
    expect(JSON.parse(second.content).sawResult).toBe(true)
  })

  it('finds the tool call after a sentence that has braces of its own', async () => {
    const { bin } = fakeClaude()
    const m = new ClaudeCodeModel({ model: 'claude-opus-5-5', bin })
    const r = await m.chat([{ role: 'system', content: 'sys' }, { role: 'user', content: 'design PROSE' }], { tools })
    expect(r.toolCalls).toMatchObject([{ name: 'get_rule', args: { id: 'core/use' } }])
    expect(r.content).toBe('')
  })

  it('keeps the system prompt byte for byte as given, whatever the call asks (the cached prefix), and passes it in a file', async () => {
    const { bin, systems } = fakeClaude()
    const m = new ClaudeCodeModel({ model: 'claude-opus-5-5', bin })
    const big = 'ModSpec '.repeat(40_000) // ~320 KB: past an argument's size limit on Linux
    await m.chat([{ role: 'system', content: big }, { role: 'user', content: 'a' }], { tools })
    await m.chat([{ role: 'system', content: big }, { role: 'user', content: 'b' }], { json: true })
    await m.chat([{ role: 'system', content: big }, { role: 'user', content: 'c' }])
    expect(systems()).toEqual([big, big, big])
  })

  it('a tool conversation goes as one message of one block per turn, the protocol first: each step only appends (the cached prefix)', async () => {
    const { bin, calls } = fakeClaude()
    const m = new ClaudeCodeModel({ model: 'claude-opus-5-5', bin })
    const messages: ChatMessage[] = [{ role: 'system', content: 'ModSpec '.repeat(1000) }, { role: 'user', content: 'design' }]
    // three steps of the agent loop: each answers with a tool call, whose result is appended
    for (let step = 0; step < 3; step++) {
      const r = await m.chat(messages, { tools })
      const c = r.toolCalls[0] ?? { id: `c${step}`, name: 'get_rule', args: { id: 'core/use' } }
      messages.push({ role: 'assistant', content: r.content, toolCalls: [c] }, { role: 'tool', toolCallId: c.id, name: c.name, content: `{"id":"core/use","step":${step}}` })
    }
    const steps = calls()
    expect(steps).toHaveLength(3)
    for (const c of steps) {
      expect(c.args.join(' ')).toContain('--output-format stream-json')
      expect(c.args.join(' ')).toContain('--input-format stream-json')
      expect(c.args).toContain('--verbose')
      expect(c.args).toContain('--no-session-persistence')
      expect(c.system).toBe(steps[0].system)
    }
    const blocks = steps.map(blocksOf)
    expect(blocks[0][0]).toMatch(/^\[instructions\]\n## Tools/)
    expect(blocks[0]).toEqual([blocks[0][0], '[user]\ndesign'])
    // each step is the last one's blocks and the new turns (the assistant's call, its result)
    for (let i = 1; i < blocks.length; i++) {
      expect(blocks[i].slice(0, blocks[i - 1].length)).toEqual(blocks[i - 1])
      expect(blocks[i]).toHaveLength(blocks[i - 1].length + 2)
      expect(blocks[i].at(-1)).toMatch(/^\[tool result: get_rule #/)
    }
    // a call without tools (the live design, a review, the last call of a tool budget) goes as before:
    // plain text, "reply with JSON" last
    await m.chat([{ role: 'system', content: 'sys' }, { role: 'user', content: 'design' }], { json: true })
    const c = calls()[3]
    expect(c.args).not.toContain('--input-format')
    expect(c.args.join(' ')).toContain('--output-format json')
    expect(c.stdin).toBe('[user]\ndesign\n\n[instructions]\nReply with one JSON object and nothing else.')
  })

  it('a failed session is an error (the modder falls back), not an answer', async () => {
    const { bin } = fakeClaude()
    const m = new ClaudeCodeModel({ model: 'claude-opus-5-5', bin })
    await expect(m.chat([{ role: 'user', content: 'FAIL' }])).rejects.toThrow(/Failed to authenticate/)
    await expect(m.chat([{ role: 'user', content: 'FAIL' }], { tools })).rejects.toThrow(/Failed to authenticate/)
  })

  it('a session that exits before reading its input is an error, not a crash (EPIPE)', async () => {
    // exits at once, reading none of its (large) input
    const bin = claudeBin(() => '#!/usr/bin/env node\nprocess.exit(3)\n')
    const m = new ClaudeCodeModel({ model: 'claude-opus-5-5', bin })
    await expect(m.chat([{ role: 'user', content: 'x'.repeat(4_000_000) }])).rejects.toThrow(/exit 3/)
  })

  // `npm i -g` installs claude as claude.cmd on Windows, which a process cannot be started from directly
  it.runIf(process.platform === 'win32')('finds a .cmd on PATH by its name and passes its arguments whole (Windows)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fake-cmd-'))
    writeFileSync(join(dir, 'lswprobe.cmd'), '@echo off\r\necho [%1] [%2]\r\n')
    const saved = process.env.PATH
    process.env.PATH = `${dir};${saved}`
    try {
      const c = commandFor('lswprobe', ['--model', 'C:\\tmp dir\\sys.txt'])
      expect(c.shell).toBe(true)
      const out = execFileSync(c.file, c.args, { shell: true, encoding: 'utf8' })
      expect(out.trim()).toBe('["--model"] ["C:\\tmp dir\\sys.txt"]')
    } finally {
      process.env.PATH = saved
    }
  })

  it('is chosen by LSW_MODEL_BACKEND, Opus 5.5 at low effort by default', () => {
    expect(modelFromEnv({ LSW_MODEL_BACKEND: 'claude-code' })?.name).toBe('claude-code:claude-opus-5-5@low')
    expect(modelFromEnv({ LSW_MODEL_BACKEND: 'claude-code', LSW_CLAUDE_FAST: '1' })?.name).toBe('claude-code:claude-opus-5-5@low+fast')
    expect(() => modelFromEnv({ LSW_CLAUDE_FAST: '1', LSW_MODEL_KEY: 'k', LSW_MODEL: 'm' })).toThrow(/claude-code backend only/)
    expect(modelFromEnv({ LSW_MODEL_BACKEND: 'none', LSW_MODEL_KEY: 'k', LSW_MODEL: 'm' })).toBeUndefined()
    expect(modelFromEnv({ LSW_MODEL_KEY: 'k', LSW_MODEL: 'moonshotai/kimi-k3' })?.name).toBe('moonshotai/kimi-k3')
    expect(() => modelFromEnv({ LSW_MODEL_BACKEND: 'nope' })).toThrow(/unknown backend/)
  })

  // as the anthropic backend: deadlineMs 0 is off
  it('takes deadlineMs 0 as no deadline', async () => {
    const bin = claudeBin(() => `#!/usr/bin/env node\nprocess.stdin.resume();process.stdin.on('end',()=>setTimeout(()=>process.stdout.write(JSON.stringify({type:'result',subtype:'success',is_error:false,result:'{"ok":true}',usage:{input_tokens:1,output_tokens:1}})),50))\n`)
    const model = new ClaudeCodeModel({ model: 'claude-opus-5-5', effort: 'low', bin })
    const r = await model.chat([{ role: 'system', content: 's' }, { role: 'user', content: 'u' }], { json: true, deadlineMs: 0 })
    expect(r.content).toBe('{"ok":true}')
  })
})

const KEY = 'sk-or-v1-0123456789abcdef'

/** fetch answered as an OpenAI-compatible service answers, every call kept. */
function fakeFetch(reply: (url: string, init: RequestInit) => { status?: number; body: unknown }) {
  const calls: { url: string; init: RequestInit; body?: Record<string, unknown> }[] = []
  const f = vi.fn(async (url: string | URL, init: RequestInit = {}) => {
    const u = String(url)
    calls.push({ url: u, init, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined })
    const r = reply(u, init)
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', f)
  return calls
}
const chat = (content: string) => ({ body: { choices: [{ message: { content } }], usage: { prompt_tokens: 3, completion_tokens: 1 } } })

afterEach(() => vi.unstubAllGlobals())

describe('the services offered', () => {
  it('each has an id of its own, an address unless the player gives one, and a kind', () => {
    expect(new Set(PROVIDERS.map((p) => p.id)).size).toBe(PROVIDERS.length)
    for (const p of PROVIDERS) {
      expect(['openai', 'anthropic']).toContain(p.kind)
      if (p.id !== 'custom') expect(p.baseUrl).toMatch(/^https?:\/\//)
    }
  })

  it('says what a choice still lacks', () => {
    expect(configProblem(undefined)).toBe('provider')
    expect(configProblem({ provider: 'nope', model: 'x' })).toBe('provider')
    expect(configProblem({ provider: 'custom', model: 'x', apiKey: 'k' })).toBe('baseUrl')
    expect(configProblem({ provider: 'openrouter', model: ' ', apiKey: 'k' })).toBe('model')
    expect(configProblem({ provider: 'openrouter', model: 'a/b' })).toBe('apiKey')
    expect(configProblem({ provider: 'ollama', model: 'llama' })).toBeUndefined()
    expect(configProblem({ provider: 'custom', baseUrl: 'https://my.host/v1/', model: 'm', apiKey: 'k' })).toBeUndefined()
    expect(baseUrlOf({ provider: 'custom', baseUrl: ' https://my.host/v1/ ', model: 'm' })).toBe('https://my.host/v1')
  })

  it('makes the model of the service chosen', () => {
    expect(modelOf({ provider: 'openrouter', model: 'moonshotai/kimi-k3', apiKey: KEY })).toBeInstanceOf(OpenAICompatModel)
    expect(modelOf({ provider: 'anthropic', model: 'claude-sonnet-5-5', apiKey: 'k' }, { browser: true })).toBeInstanceOf(AnthropicModel)
    expect(providerOf('anthropic')?.kind).toBe('anthropic')
  })

  it('shows a key only by its start and its end, and takes it out of a message', () => {
    expect(keyHint(KEY)).toBe('sk-or-…cdef')
    expect(keyHint(KEY)).not.toContain('0123456789')
    expect(keyHint('short')).toBe('••••')
    expect(scrub(`HTTP 401 {"error":"bad key ${KEY}"}`, KEY)).toBe('HTTP 401 {"error":"bad key [key]"}')
  })
})

describe('what goes where', () => {
  it("sends OpenRouter's own fields to OpenRouter only (another service refuses a field it does not know)", async () => {
    const calls = fakeFetch(() => chat('OK'))
    const opts = { reasoning: 'low' as const, provider: { sort: 'price' } }
    await new OpenAICompatModel({ baseUrl: 'https://openrouter.ai/api/v1', apiKey: KEY, model: 'a/b' }).chat([{ role: 'user', content: 'hi' }], opts)
    await new OpenAICompatModel({ baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-openai-key', model: 'm' }).chat([{ role: 'user', content: 'hi' }], opts)
    expect(calls[0].body).toMatchObject({ reasoning: { effort: 'low' }, provider: { sort: 'price' }, usage: { include: true } })
    expect(calls[1].body).not.toHaveProperty('reasoning')
    expect(calls[1].body).not.toHaveProperty('provider')
    expect(calls[1].body).not.toHaveProperty('usage')
  })

  it('carries the key in the header its service reads, to that service only; a local server gets none', async () => {
    const calls = fakeFetch((url) => (url.endsWith('/models') ? { body: { data: [{ id: 'b' }, { id: 'a' }, { id: 'a' }] } } : chat('OK')))
    expect(await listModels({ provider: 'openrouter', model: '', apiKey: KEY })).toEqual(['a', 'b'])
    expect(await testModel({ provider: 'ollama', model: 'llama3' })).toMatchObject({ ok: true, reply: 'OK' })
    await listModels({ provider: 'anthropic', model: '', apiKey: 'sk-ant-key' })
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/models')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`)
    expect(calls[1].url).toBe('http://localhost:11434/v1/chat/completions')
    expect(calls[1].init.headers).not.toHaveProperty('Authorization')
    expect(calls[2].url).toBe('https://api.anthropic.com/v1/models?limit=1000')
    expect(calls[2].init.headers).toMatchObject({ 'x-api-key': 'sk-ant-key', 'anthropic-dangerous-direct-browser-access': 'true' })
    for (const c of calls) if (JSON.stringify(c.init.headers).includes(KEY)) expect(new URL(c.url).host).toBe('openrouter.ai')
  })

  it('a failed test says why without the key', async () => {
    fakeFetch(() => ({ status: 401, body: { error: { message: `invalid key ${KEY}` } } }))
    const r = await testModel({ provider: 'openrouter', model: 'a/b', apiKey: KEY })
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain(KEY)
    expect(JSON.stringify(r)).toContain('401')
  })
})

describe('the self-state over files in memory (a browser has no disk)', () => {
  it('keeps what a SelfState writes, and opens again from what it kept', () => {
    const files = new MemFiles()
    const state = SelfState.open('/self', () => new Date('2026-10-25T00:00:00Z'), [], files)
    state.note('review', { episode: 'e1', usage: { cost: 0.5 } })
    state.writeSkill({ name: 'Bake Bread', description: 'how', triggers: ['bread'], body: 'Knead.' })
    expect(files.list('/self/skills')).toEqual(['bake-bread', 'index.json'])
    const again = SelfState.open('/self', () => new Date(), [], new MemFiles(files.entries()))
    expect(again.skills().map((s) => s.name)).toEqual(['bake-bread'])
    expect(again.journalOf('review')).toHaveLength(1)
    expect(again.harness().version).toBe(state.harness().version)
  })

  it('reads a harness written before it opens over the default', () => {
    const files = new MemFiles({ '/self/harness/pipeline.json': JSON.stringify({ reflect: { enabled: false }, escalate: false }) })
    const h = SelfState.open('/self', () => new Date(), [], files).harness()
    expect(h.reflect.enabled).toBe(false)
    expect(h.escalate).toBe(false)
    expect(h.reflect.skillMinRecurrence).toBeGreaterThan(0)
  })

  it('copies, renames and lists as a disk does', () => {
    const f = new MemFiles()
    f.write('/a/b/c.txt', 'x')
    f.append('/a/b/c.txt', 'y')
    f.copy('/a', '/z')
    f.rename('/z/b/c.txt', '/z/d.txt')
    expect(f.read('/a/b/c.txt')).toBe('xy')
    expect(f.read('/z/d.txt')).toBe('xy')
    expect(f.list('/z')).toEqual(['b', 'd.txt'])
    expect(f.exists('/a/b')).toBe(true)
    expect(f.exists('/q')).toBe(false)
    expect(f.join('/a\\b', 'c')).toBe('/a/b/c')
  })
})
