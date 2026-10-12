import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ClaudeCodeModel, commandFor, modelFromEnv, type ChatMessage } from '../src/index.ts'

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
  const dir = mkdtempSync(join(tmpdir(), 'fake-claude-'))
  const bin = join(dir, 'claude')
  const log = join(dir, 'calls.jsonl')
  writeFileSync(log, '')
  writeFileSync(
    bin,
    `#!/usr/bin/env node
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
`,
  )
  chmodSync(bin, 0o755)
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
    const dir = mkdtempSync(join(tmpdir(), 'fake-claude-'))
    const bin = join(dir, 'claude')
    // exits at once, reading none of its (large) input; a node script, so it runs on Windows too
    writeFileSync(bin, '#!/usr/bin/env node\nprocess.exit(3)\n')
    chmodSync(bin, 0o755)
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
})
