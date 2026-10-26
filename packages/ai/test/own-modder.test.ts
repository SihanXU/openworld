// The player's own modder (docs/byok.md): the key the player gives goes to the service they chose and nowhere else —
// never back to the page past its hint, never to the engine's worker over its port, never to another service, never
// in an error — and this browser keeps it only when asked to. The day's cap stops the calls once it is spent.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ontology } from '@openworld/engine'
import { STDLIB_ONTOLOGY, STDLIB_RULES } from '@openworld/stdlib'
import { LocalModder, type ModderStore, type StoreKey } from '../src/player/localModder.ts'
import { portLink } from '../../runtime/src/modderLink.ts'
import type { FromModder, ModelStatus } from '../../runtime/src/modderProtocol.ts'

const KEY = 'sk-or-v1-SECRETSECRET1234'

vi.mock('phaser', () => ({ default: { Scene: class {} } }))

function memoryStore(): ModderStore & { data: Map<StoreKey, unknown> } {
  const data = new Map<StoreKey, unknown>()
  return {
    data,
    get: async <T>(k: StoreKey) => structuredClone(data.get(k)) as T | undefined,
    set: async (k, v) => void data.set(k, structuredClone(v)),
    del: async (k) => void data.delete(k),
  }
}

let fetched: { url: string; headers: string; body: string }[]
let answer: (url: string) => { status?: number; body: unknown }
let posts: FromModder[]
let ports: MessagePort[]

beforeEach(() => {
  fetched = []
  posts = []
  ports = []
  answer = () => ({ body: { choices: [{ message: { content: 'OK' } }], usage: { prompt_tokens: 5, completion_tokens: 1, cost: 0.002 } } })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      fetched.push({ url: String(url), headers: JSON.stringify(init.headers ?? {}), body: String(init.body ?? '') })
      const r = answer(String(url))
      return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  for (const p of ports) p.close()
})

async function host(store = memoryStore()) {
  const h = new LocalModder({ store, post: (m) => posts.push(structuredClone(m)) })
  await h.handle({ t: 'game', ontology: STDLIB_ONTOLOGY as Ontology, rules: STDLIB_RULES })
  return { h, store }
}
const status = (): ModelStatus => (posts.filter((m) => m.t === 'status').at(-1) as { status: ModelStatus }).status
const reply = (id: number) => posts.find((m) => m.t === 'reply' && m.id === id) as { value?: unknown; error?: string } | undefined
/** Nothing the modder said, and no request that went anywhere but the service chosen, holds the key. */
function keyStayedPut(host = 'openrouter.ai') {
  expect(JSON.stringify(posts)).not.toContain(KEY)
  for (const f of fetched) if (f.headers.includes(KEY) || f.body.includes(KEY)) expect(new URL(f.url).host).toBe(host)
}

describe("the player's own modder keeps the key to the service chosen", () => {
  it('shows the page only the hint, and keeps the key in this browser only when asked', async () => {
    const { h, store } = await host()
    await h.handle({ t: 'set', choice: { provider: 'openrouter', model: 'a/b' }, key: KEY, remember: 'device', cap: 0 })
    expect(status()).toMatchObject({ keyHint: 'sk-or-…1234', model: 'a/b', remember: 'device' })
    expect(store.data.get('model')).toEqual({ choice: { provider: 'openrouter', model: 'a/b' }, key: KEY })
    await h.handle({ t: 'set', choice: { provider: 'openrouter', model: 'a/b' }, remember: 'session', cap: 0 })
    // (the key stays for this page: the same service, no new key typed)
    expect(status()).toMatchObject({ keyHint: 'sk-or-…1234', model: 'a/b', remember: 'session' })
    expect(store.data.has('model')).toBe(false)
    keyStayedPut()
  })

  it('opens again with a key this browser kept, and forgets it when told', async () => {
    const store = memoryStore()
    store.data.set('model', { choice: { provider: 'openrouter', model: 'a/b' }, key: KEY })
    const { h } = await host(store)
    expect(status()).toMatchObject({ model: 'a/b', remember: 'device' })
    await h.handle({ t: 'forget' })
    expect(status().keyHint).toBeUndefined()
    expect(status().model).toBeUndefined()
    expect(store.data.has('model')).toBe(false)
  })

  it('never sends a key kept for one service to another', async () => {
    const { h } = await host()
    await h.handle({ t: 'set', choice: { provider: 'openrouter', model: 'a/b' }, key: KEY, remember: 'session', cap: 0 })
    await h.handle({ t: 'test', id: 1, choice: { provider: 'openrouter', model: 'a/b' } })
    expect(reply(1)?.value).toMatchObject({ ok: true })
    expect(fetched[0].url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(fetched[0].headers).toContain(`Bearer ${KEY}`)
    // a test, a list and a choice of another service, with no key typed: no key goes with them
    await h.handle({ t: 'test', id: 2, choice: { provider: 'openai', model: 'gpt' } })
    await h.handle({ t: 'models', id: 3, choice: { provider: 'custom', baseUrl: 'https://elsewhere.example/v1', model: '' } })
    await h.handle({ t: 'set', choice: { provider: 'openai', model: 'gpt' }, remember: 'session', cap: 0 })
    expect(fetched.slice(1).map((f) => new URL(f.url).host)).toEqual(['api.openai.com', 'elsewhere.example'])
    expect(status().keyHint).toBeUndefined()
    expect(status().model).toBeUndefined()
    expect(status().error).toMatch(/no key/)
    keyStayedPut()
  })

  it("answers the engine's worker over its port as a service answers, and says nothing of the key there", async () => {
    const { h } = await host()
    const ch = new MessageChannel()
    ports.push(ch.port1, ch.port2)
    await h.handle({ t: 'link', port: ch.port1 })
    const link = portLink(ch.port2)
    expect(link.where).toBe('local:')
    expect(await link.health()).toEqual({ model: null })
    await h.handle({ t: 'set', choice: { provider: 'openrouter', model: 'a/b' }, key: KEY, remember: 'session', cap: 0 })
    expect(await link.health()).toEqual({ model: 'a/b' })
    const log = await link.patches(0)
    expect(log).toMatchObject({ seq: 0, entries: [] })
    expect(typeof log.log).toBe('string')
    expect(await link.progress('nothing')).toEqual({})
    expect(JSON.stringify(log)).not.toContain(KEY)
    keyStayedPut()
  })

  it('a model this browser kept answers the first probe, however the page and the engine race at the start', async () => {
    const store = memoryStore()
    store.data.set('model', { choice: { provider: 'openrouter', model: 'a/b' }, key: KEY })
    // the browser's database answers a task later, not a microtask
    const slow: ModderStore = { ...store, get: (k) => new Promise((r) => setTimeout(() => r(store.get(k)), 5)) }
    const h = new LocalModder({ store: slow, post: (m) => posts.push(structuredClone(m)) })
    const ch = new MessageChannel()
    ports.push(ch.port1, ch.port2)
    // as the worker's onmessage hands them on: the game, then the engine's port, neither waited for
    const game = h.handle({ t: 'game', ontology: STDLIB_ONTOLOGY as Ontology, rules: STDLIB_RULES })
    const linked = h.handle({ t: 'link', port: ch.port1 })
    // the engine probes once and keeps what it hears: a model, or none (then every hole takes its default)
    expect(await portLink(ch.port2).health()).toEqual({ model: 'a/b' })
    await Promise.all([game, linked])
  })

  it('starts on a page that is not a secure context (plain http at an address): no crypto.randomUUID there', async () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array<ArrayBuffer>) => real.getRandomValues(a) })
    expect(crypto.randomUUID).toBeUndefined()
    const store = memoryStore()
    store.data.set('model', { choice: { provider: 'openrouter', model: 'a/b' }, key: KEY })
    const { h } = await host(store)
    const ch = new MessageChannel()
    ports.push(ch.port1, ch.port2)
    await h.handle({ t: 'link', port: ch.port1 })
    const link = portLink(ch.port2)
    expect(await link.health()).toEqual({ model: 'a/b' })
    expect((await link.patches(0)).log).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('takes the key out of what a service says back', async () => {
    const { h } = await host()
    answer = () => ({ status: 401, body: { error: { message: `no such key: ${KEY}` } } })
    await h.handle({ t: 'set', choice: { provider: 'openrouter', model: 'a/b' }, key: KEY, remember: 'session', cap: 0 })
    await h.handle({ t: 'test', id: 1, choice: { provider: 'openrouter', model: 'a/b' } })
    await h.handle({ t: 'models', id: 2, choice: { provider: 'openrouter', model: '' } })
    expect(reply(1)?.value).toMatchObject({ ok: false })
    expect(reply(2)?.error).toContain('401')
    // a call of the modder's own that fails: its error is the status's, cleared too
    const model = (h as unknown as { model: { chat: (m: unknown[]) => Promise<unknown> } }).model
    await expect(model.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(/\[key\]/)
    expect(status().error).toContain('[key]')
    keyStayedPut()
  })
})

describe('what the modder spends', () => {
  it("counts each call's cost, and stops calling once the day's cap is spent", async () => {
    const { h, store } = await host()
    await h.handle({ t: 'set', choice: { provider: 'openrouter', model: 'a/b' }, key: KEY, remember: 'session', cap: 0.003 })
    const model = (h as unknown as { model: { chat: (m: unknown[]) => Promise<unknown> } }).model
    await model.chat([{ role: 'user', content: 'one' }])
    await model.chat([{ role: 'user', content: 'two' }])
    expect(status().spend).toMatchObject({ calls: 2, input: 10, output: 2, unpriced: 0 })
    expect(status().spend.cost).toBeCloseTo(0.004)
    expect(store.data.get('spend')).toMatchObject({ calls: 2 })
    // spent: refused before it goes out (the words a pausing modder knows: quota)
    await expect(model.chat([{ role: 'user', content: 'three' }])).rejects.toThrow(/quota/)
    expect(fetched).toHaveLength(2)
  })

  it('a new day begins with nothing spent, the total kept', async () => {
    const store = memoryStore()
    store.data.set('spend', { day: '2000-01-01', cost: 5, calls: 9, input: 1, output: 1, unpriced: 0, total: 7 })
    await host(store)
    expect(status().spend).toMatchObject({ cost: 0, calls: 0, total: 7 })
  })
})

describe("the options' Your model", () => {
  it('shows the kept key by its hint for its own service only, and every service offered', async () => {
    const { ModelSection } = await import('../../runtime/src/ui/modelSettings.ts')
    const own = { status: { choice: { provider: 'openrouter', model: 'a/b' }, keyHint: 'sk-or-…1234', remember: 'device', model: 'a/b', cap: 2, spend: { day: '2026-10-25', cost: 0.0123, calls: 4, input: 1, output: 1, unpriced: 1, total: 1 } } }
    const section = new ModelSection(own as never, () => undefined)
    const html = section.html()
    expect(html).toContain('sk-or-…1234')
    expect(html).toContain('value="a/b"')
    for (const id of ['openrouter', 'anthropic', 'openai', 'deepseek', 'moonshot', 'gemini', 'ollama', 'custom']) expect(html).toContain(`value="${id}"`)
    expect(html).toContain('0.012')
    expect(html).not.toContain(KEY)
    // a page naming a service says it answers instead
    expect(new ModelSection(own as never, () => undefined, 'http://localhost:8787').html()).toContain('http://localhost:8787')
  })
})

describe("the title's first offer of a model", () => {
  it('is drawn without a heading of its own (the panel names it)', async () => {
    const { ModelSection } = await import('../../runtime/src/ui/modelSettings.ts')
    const own = { status: { remember: 'device', cap: 0, spend: { day: '', cost: 0, calls: 0, input: 0, output: 0, unpriced: 0, total: 0 } } }
    const section = new ModelSection(own as never, () => undefined)
    expect(section.html()).toContain('<h4>')
    expect(section.html(false)).not.toContain('<h4>')
  })

  it('remembers a player who chose to play without AI, and nothing else of them', async () => {
    const kept = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) })
    const { OwnModel } = await import('../../runtime/src/ownModel.ts')
    expect(OwnModel.skipped()).toBe(false)
    OwnModel.skip()
    expect(OwnModel.skipped()).toBe(true)
    expect(OwnModel.kept()).toBe(false)
    expect([...kept.keys()]).toEqual(['lsw.model.skip'])
  })
})
