// The model backends at their edges, against local stand-ins: the harness's 0 for "off" (hedge, deadline), a hedged
// call's timeout and wall time, a provider's error inside a 200, and a tool history in a call that offers no tools.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { Meter, OpenAICompatModel } from '../src/models/model.ts'
import { AnthropicModel } from '../src/models/anthropic.ts'

type Handler = (n: number, body: Record<string, unknown>, req: IncomingMessage, res: ServerResponse) => void
const servers: { close(): void }[] = []
afterEach(() => {
  for (const s of servers.splice(0)) s.close()
})

/** A local OpenAI-compatible stand-in: `handle` gets the request's ordinal (0, 1, ...) and its body. */
async function serve(handle: Handler): Promise<{ url: string; hits: { n: number; at: number }[] }> {
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
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`, hits }
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
