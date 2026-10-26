// The anthropic backend reads a deadline of 0 as the harness means it: off (the offline profile's design calls carry
// deadlineMs 0; read as 0 ms, every offline call on this backend timed out at once). Against a local stand-in.

import { createServer } from 'node:http'
import { describe, expect, it } from 'vitest'
import { AnthropicModel } from '../src/anthropic.ts'

describe('the anthropic backend', () => {
  it('takes deadlineMs 0 as no deadline', async () => {
    const server = createServer((req, res) => {
      req.resume()
      req.on('end', () =>
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }))
        }, 50),
      )
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const was = process.env.ANTHROPIC_BASE_URL
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    try {
      const model = new AnthropicModel({ model: 'claude-opus-5-5', apiKey: 'test' })
      const r = await model.chat([{ role: 'system', content: 's' }, { role: 'user', content: 'u' }], { json: true, deadlineMs: 0, retries: 0 })
      expect(r.content).toBe('{"ok":true}')
    } finally {
      if (was === undefined) delete process.env.ANTHROPIC_BASE_URL
      else process.env.ANTHROPIC_BASE_URL = was
      server.close()
    }
  })
})
