import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { describe, expect, it } from 'vitest'
import { agentTools } from '../src/agent/tools.ts'
import { runAgent } from '../src/agent/loop.ts'
import { SelfState } from '../src/agent/state.ts'
import { MemFiles } from '../src/agent/files.ts'
import type { Env } from '../src/agent/env.ts'
import { OpenAICompatModel, type ChatMessage, type Model } from '../src/models/model.ts'

const workspace = () => mkdtempSync(join(tmpdir(), 'openworld-agent-infra-'))
const state = () => SelfState.open('state', undefined, [], new MemFiles())
const environment = (root: string): Env => ({ root, cwd: root, isolated: false, exec: async () => ({ code: 0, stdout: '', stderr: '', ms: 0, timedOut: false }) })
function toolset(root: string) {
  const tools = agentTools(environment(root))
  return (name: string) => tools.find(t => t.name === name)!
}

describe('native source editing contracts', () => {
  it('reads unguttered source with a hash, and applies LF edits without changing a CRLF file convention', async () => {
    const root = workspace(), file = join(root, 'source.ts'), tool = toolset(root)
    writeFileSync(file, 'function value() {\r\n  return 1\r\n}\r\n')
    const read = JSON.parse(await tool('read_file').run({ path: 'source.ts', format: 'json', start: 1, end: 3 }))
    expect(read).toMatchObject({ path: 'source.ts', start: 1, end: 3, lineEnding: 'CRLF', text: 'function value() {\n  return 1\n}' })
    expect(read.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(await tool('read_file').run({ path: 'source.ts', format: 'text', start: 2, end: 2 })).toBe('  return 1')
    expect(await tool('edit_file').run({ path: 'source.ts', old_string: 'function value() {\n  return 1\n}', new_string: 'function value() {\n  return 2\n}', expected_sha256: read.sha256 })).toContain('edited')
    expect(readFileSync(file, 'utf8')).toBe('function value() {\r\n  return 2\r\n}\r\n')
    expect(await tool('edit_file').run({ path: 'source.ts', old_string: 'return 2', new_string: 'return 3', expected_sha256: read.sha256 })).toContain('File changed')
    expect(readFileSync(file, 'utf8')).toContain('return 2')
  })

  it('retains uniqueness and exact indentation instead of guessing which block a model intended', async () => {
    const root = workspace(), file = join(root, 'source.ts'), tool = toolset(root)
    const source = '  value\r\n  value\r\n'
    writeFileSync(file, source)
    expect(await tool('edit_file').run({ path: 'source.ts', old_string: '  value\n', new_string: '  replacement\n' })).toContain('occurs 2 times')
    expect(await tool('edit_file').run({ path: 'source.ts', old_string: '    value', new_string: 'replacement' })).toContain('not found')
    expect(readFileSync(file, 'utf8')).toBe(source)
    expect(await tool('edit_file').run({ path: 'source.ts', old_string: '  value\n', new_string: '', replace_all: true })).toContain('2 replacements')
    expect(readFileSync(file, 'utf8')).toBe('')
  })

  it('does not normalize unrelated mixed-newline content', async () => {
    const root = workspace(), file = join(root, 'source.ts'), tool = toolset(root)
    writeFileSync(file, 'one\r\ntwo\n')
    expect(await tool('edit_file').run({ path: 'source.ts', old_string: 'one\n', new_string: 'ONE\n' })).toContain('not found')
    expect(await tool('edit_file').run({ path: 'source.ts', old_string: 'one\r\n', new_string: 'ONE\r\n' })).toContain('edited')
    expect(readFileSync(file, 'utf8')).toBe('ONE\r\ntwo\n')
  })

  it('reports missing model arguments before opening a directory or overwriting a file', async () => {
    const root = workspace(), tool = toolset(root), file = join(root, 'source.ts')
    writeFileSync(file, 'preserved')
    expect(() => tool('read_file').run({})).toThrow('path must be a non-empty string')
    expect(() => tool('write_file').run({ path: 'source.ts' })).toThrow('content must be a string')
    expect(() => tool('edit_file').run({ path: 'source.ts', old_string: 'preserved' })).toThrow('new_string must be a string')
    expect(() => tool('edit_file').run({ path: 'source.ts', old_string: '', new_string: 'x' })).toThrow('old_string must not be empty')
    expect(() => tool('edit_file').run({ path: 'source.ts', old_string: 'preserved', new_string: 'x', replace_all: 'false' })).toThrow('replace_all must be a boolean')
    expect(readFileSync(file, 'utf8')).toBe('preserved')
  })
})

describe('provider continuation and native agent execution', () => {
  it('round-trips provider reasoning with a tool response and exposes output exhaustion', async () => {
    const bodies: any[] = []
    const server = createServer((req, res) => {
      let raw = ''; req.on('data', chunk => { raw += chunk })
      req.on('end', () => {
        bodies.push(JSON.parse(raw))
        const first = bodies.length === 1
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ choices: [{ finish_reason: first ? 'tool_calls' : 'length', message: { content: '', reasoning_content: first ? 'continuation-token' : 'unfinished', ...(first && { tool_calls: [{ id: 'inspect-1', type: 'function', function: { name: 'inspect', arguments: '{}' } }] }) } }] }))
      })
    })
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
    try {
      const model = new OpenAICompatModel({ baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}`, apiKey: 'test', model: 'test' })
      const messages: ChatMessage[] = [{ role: 'user', content: 'inspect this world' }]
      const reply = await model.chat(messages)
      expect(reply).toMatchObject({ reasoningContent: 'continuation-token', finishReason: 'tool_calls' })
      const next = await model.chat([...messages, { role: 'assistant', content: reply.content, toolCalls: reply.toolCalls, reasoningContent: reply.reasoningContent }, { role: 'tool', toolCallId: 'inspect-1', name: 'inspect', content: 'world' }])
      expect(bodies[1].messages[1].reasoning_content).toBe('continuation-token')
      expect(next).toMatchObject({ content: '', toolCalls: [], finishReason: 'length', reasoningContent: 'unfinished' })
    } finally {
      server.closeAllConnections(); await new Promise<void>(done => server.close(() => done()))
    }
  })

  it('ends a sequence of empty replies without ever forwarding an invalid assistant message', async () => {
    let calls = 0
    const model: Model = { name: 'empty', chat: async messages => {
      calls++
      expect(messages.some(m => m.role === 'assistant' && !m.content.trim() && !m.toolCalls?.length)).toBe(false)
      return { content: '', toolCalls: [], reasoningContent: 'still thinking' }
    } }
    const result = await runAgent({ id: 'empty', kind: 'infra', statement: 'Complete a task.', env: environment(workspace()) }, { model, state: state() })
    expect(calls).toBe(4)
    expect(result.episode.error).toContain('4 empty replies')
    expect(result.submitted).toBe(false)
  })

  it('does not execute a truncated file edit and records the output-limit failure', async () => {
    const root = workspace(), file = join(root, 'source.ts'); writeFileSync(file, 'original')
    const model: Model = { name: 'truncated', chat: async () => ({ content: '', finishReason: 'length', toolCalls: [{ id: 'partial', name: 'write_file', args: { path: 'source.ts', content: 'partial' } }] }) }
    const result = await runAgent({ id: 'truncated', kind: 'infra', statement: 'Complete a task.', env: environment(root) }, { model, state: state() })
    expect(result.episode.error).toContain('output limit')
    expect(result.episode.tools).toEqual([])
    expect(readFileSync(file, 'utf8')).toBe('original')
  })

  it('offers domain tools through the native loop and retains their continuation metadata', async () => {
    let calls = 0, inspections = 0
    const model: Model = { name: 'domain', chat: async (messages, options) => {
      expect(options?.tools?.some(t => t.name === 'inspect_world')).toBe(true)
      if (calls++ === 0) return { content: '', reasoningContent: 'continue-inspection', toolCalls: [{ id: 'inspect', name: 'inspect_world', args: { id: 'focus' } }] }
      expect(messages.find(m => m.role === 'assistant')).toMatchObject({ reasoningContent: 'continue-inspection' })
      expect(messages.at(-1)).toMatchObject({ role: 'tool', name: 'inspect_world', content: 'focus: channel' })
      return { content: '', toolCalls: [{ id: 'done', name: 'submit', args: { summary: 'Inspected the world.' } }] }
    } }
    const result = await runAgent({ id: 'domain', kind: 'infra', statement: 'Inspect focus.', env: environment(workspace()), verdict: async () => ({ ok: inspections === 1, output: 'inspection recorded' }) }, {
      model, state: state(), extraTools: [{ name: 'inspect_world', description: 'Inspect a world object.', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, run: args => { expect(args.id).toBe('focus'); inspections++; return 'focus: channel' } }],
    })
    expect(result.outcome).toBe('accepted')
    expect(result.episode.tools.map(t => t.name)).toEqual(['inspect_world', 'submit'])
  })
})
