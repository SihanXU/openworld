// The player's own model (docs/byok.md): the services offered, a model made from a choice, and what goes where —
// OpenRouter's own fields to OpenRouter only, the key in the header its service reads and nowhere else.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnthropicModel, MemFiles, OpenAICompatModel, PROVIDERS, SelfState, baseUrlOf, configProblem, keyHint, listModels, modelOf, providerOf, scrub, testModel } from '../src/core.ts'

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
