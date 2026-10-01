import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, type ModRequest, type Patch, type Rule, type Scenario } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
import { Modder, ScriptedModel, SelfState, WorldLibrary, createModderServer, signatureOf, type ChatMessage, type ChatOptions, type Model, type Script } from '../src/index.ts'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]

/** A real ModRequest: the player uses a rope on a creature, which no rule covers. */
function request(target = 'actor/creature/slime/green_slime', instrument = 'item/tool/rope'): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: instrument, x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: target, x: 2, y: 1 },
    ],
    event: { verb: 'interact', actor: 'actor', target: 'it', instrument: 'held' },
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  const res = eng.interact('interact', 'actor', { e: 'it' })
  expect(res.defined).toBe(false)
  return port.records[0].request
}

function bindRule(id = 'patch/rope-binds-creature', target = 'actor/creature', testTarget = 'actor/creature/beast/wolf'): Rule {
  return {
    id,
    on: 'interaction',
    doc: 'A rope lashes a creature down for a while.',
    when: { verb: ['interact', 'put'], instrument: { tags: ['fiber'] }, target: { type: target, notStatus: ['frozen'] } },
    do: [
      { op: 'addStatus', of: 'target', status: 'frozen', duration: 30 },
      { op: 'destroy', of: 'instrument' },
      { op: 'vfx', at: 'target', fx: 'dust' },
      { op: 'log', text: { en: 'You lash {target} down with the rope.', zh: '你用绳子捆住了{target}。' } },
    ],
    tests: [
      {
        name: 'another creature',
        given: {
          entities: [
            { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
            { key: 'r', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
            { key: 'w', type: testTarget, x: 2, y: 1 },
          ],
          event: { verb: 'interact', actor: 'actor', target: 'w', instrument: 'r' },
        },
        expect: [{ key: 'w', hasStatus: 'frozen' }, { key: 'r', destroyed: true }],
      },
    ],
  }
}

const patchOf = (...rules: Rule[]): Patch => ({ note: 'rope binds', artifacts: rules.map((rule) => ({ kind: 'rule' as const, rule })) })

interface Calls {
  design: number
  review: number
  reflect: number
  log: { purpose?: string; messages: ChatMessage[] }[]
}

/**
 * A scripted modder: on each design turn it first searches the rule library, then answers
 * with the next draft. Review ships unless told otherwise; reflection adds a lesson.
 */
function scripted(drafts: (Patch | string)[], over: Partial<Record<'review' | 'reflect', (n: number, m: ChatMessage[]) => object>> = {}): { model: ScriptedModel; calls: Calls } {
  const calls: Calls = { design: 0, review: 0, reflect: 0, log: [] }
  let next = 0
  const script: Script = (messages: ChatMessage[], opts: ChatOptions) => {
    calls.log.push({ purpose: opts.purpose, messages: [...messages] })
    const last = messages[messages.length - 1]
    if (opts.purpose === 'review') {
      const n = calls.review++
      return over.review?.(n, messages) ?? { verdict: 'ship', notes: [] }
    }
    if (opts.purpose === 'reflect') return over.reflect?.(calls.reflect, messages) ?? { lessons: { add: [{ text: 'Select a rope-like instrument by its fiber tag, not its type.', terms: ['verb:interact', 'instrument#fiber'] }] }, skill: null }
    calls.design++
    if (last.role === 'user') return { content: '', toolCalls: [{ id: `c${calls.design}`, name: 'search_rules', args: { verb: 'interact', tag: 'fiber' } }] }
    const d = drafts[Math.min(next++, drafts.length - 1)]
    return typeof d === 'string' ? d : { patch: d, summary: 'rope binds creatures' }
  }
  return { model: new ScriptedModel(script), calls }
}

function setup(model?: Model, dir = mkdtempSync(join(tmpdir(), 'lsw-modder-'))) {
  const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
  const state = SelfState.open(join(dir, 'modder-state'))
  const modder = new Modder({ library, state, model })
  return { dir, library, state, modder }
}

describe('the modder pipeline', () => {
  it('designs with tools, validates, commits to the shared library and records the episode', async () => {
    const { model, calls } = scripted([patchOf(bindRule())])
    const { modder, library, state, dir } = setup(model)
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    expect(reply.patch?.artifacts[0]).toMatchObject({ kind: 'rule', rule: { id: 'patch/rope-binds-creature' } })
    expect(library.lib.rules.get('patch/rope-binds-creature')?.source?.author).toBe('modder')
    expect(calls.review).toBe(1)

    // the log is append-only and rebuilds the same library
    const again = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(again.lib.rules.has('patch/rope-binds-creature')).toBe(true)
    expect(again.regression).toHaveLength(1)

    const ep = state.episode(reply.episode!)!
    expect(ep.outcome).toBe('accepted')
    expect(ep.tools.map((t) => t.name)).toEqual(['search_rules'])
    expect(ep.attempts).toHaveLength(1)
    expect(ep.usage.calls).toBe(3) // tool turn, answer, review

    await modder.settled()
    const lessons = state.lessons()
    expect(lessons).toHaveLength(1)
    expect(lessons[0].episodes).toEqual([ep.id])
    expect(readFileSync(join(state.dir, 'memory/lessons.md'), 'utf8')).toContain('fiber tag')
    expect(readFileSync(join(state.dir, 'journal.jsonl'), 'utf8')).toMatch(/"kind":"lesson.add"/)
  })

  it('feeds the validator\'s diagnostics back and repairs', async () => {
    const bad = bindRule()
    bad.do = [{ op: 'addStatus', of: 'target', status: 'hogtied' }]
    const { model, calls } = scripted([patchOf(bad), patchOf(bindRule())])
    const { modder, state } = setup(model)
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    const ep = state.episode(reply.episode!)!
    expect(ep.attempts.map((a) => a.phase)).toEqual(['design', 'repair'])
    expect(ep.attempts[0].errors.join()).toMatch(/unknown status "hogtied"/)
    // the repair turn showed the model exactly what the validator said
    const repairTurn = calls.log.find((c) => c.purpose === 'design' && c.messages.some((m) => m.role === 'user' && m.content.includes('rejected')))
    expect(repairTurn?.messages.find((m) => m.content.includes('rejected'))?.content).toContain('hogtied')
  })

  it('gives up after the harness\'s repair budget, leaving the library untouched', async () => {
    const bad = bindRule()
    bad.do = [{ op: 'addStatus', of: 'target', status: 'hogtied' }]
    const { model } = scripted([patchOf(bad)])
    const { modder, library, state } = setup(model)
    state.setHarness({ ...state.harness(), repair: { maxRounds: 1 } }, 'test: one repair round')
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('failed')
    expect(reply.patch).toBeNull()
    expect(reply.diagnostics?.join()).toMatch(/hogtied/)
    expect(state.episode(reply.episode!)!.attempts).toHaveLength(2)
    expect(library.patchRules()).toHaveLength(0)
    expect(state.harness().version).toBe(2)
    expect(readFileSync(join(state.dir, 'harness/CHANGELOG.md'), 'utf8')).toContain('one repair round')
  })

  it('answers a covered interaction from the shared library without a model call', async () => {
    const { model, calls } = scripted([patchOf(bindRule())])
    const { modder, state } = setup(model)
    await modder.resolve({ request: request() })
    const before = calls.design
    const reply = await modder.resolve({ request: request('actor/creature/slime/frost_slime') })
    expect(reply.outcome).toBe('covered')
    expect(reply.patch?.artifacts[0]).toMatchObject({ rule: { id: 'patch/rope-binds-creature' } })
    expect(calls.design).toBe(before)
    expect(state.stats()).toMatchObject({ episodes: 2, covered: 1, accepted: 1 })
  })

  it('works a class once when the same request arrives twice at the same time', async () => {
    const { model, calls } = scripted([patchOf(bindRule())])
    const { modder } = setup(model)
    const [a, b] = await Promise.all([modder.resolve({ request: request() }), modder.resolve({ request: request() })])
    expect([a.outcome, b.outcome].sort()).toEqual(['accepted', 'covered'])
    expect(calls.design).toBe(2) // one episode: a tool turn and an answer
  })

  it('without a model answers only from the library', async () => {
    const { model } = scripted([patchOf(bindRule())])
    const first = setup(model)
    await first.modder.resolve({ request: request() })
    const offline = setup(undefined, first.dir)
    expect((await offline.modder.resolve({ request: request('actor/creature/slime/fire_slime') })).outcome).toBe('covered')
    expect((await offline.modder.resolve({ request: request('actor/creature/slime/fire_slime', 'item/tool/shovel') })).outcome).toBe('unavailable')
  })

  it('revises after a reviewer\'s notes', async () => {
    const narrow = bindRule('patch/rope-binds-slime', 'actor/creature/slime/green_slime', 'actor/creature/slime/green_slime')
    const { model, calls } = scripted([patchOf(narrow), patchOf(bindRule())], {
      review: (n) => (n === 0 ? { verdict: 'revise', notes: ['Too narrow: any creature can be tied up.'] } : { verdict: 'ship', notes: [] }),
    })
    const { modder, state, library } = setup(model)
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    const ep = state.episode(reply.episode!)!
    expect(ep.attempts.map((a) => [a.phase, a.review?.verdict])).toEqual([
      ['design', 'revise'],
      ['review', undefined],
    ])
    expect(calls.review).toBe(1) // the harness allows one review round: the revision ships unreviewed
    expect(library.lib.rules.has('patch/rope-binds-creature')).toBe(true)
    expect(library.lib.rules.has('patch/rope-binds-slime')).toBe(false)
  })

  it('writes a skill once work recurs, offers it, and books its outcomes', async () => {
    const skill = { name: 'Bind with fiber', description: 'Tying things up with rope-like items.', triggers: ['instrument#fiber'], body: '1. Select the instrument by the fiber tag.\n2. Freeze the target for a while; consume the rope.' }
    let reads = 0
    const calls = { design: 0 }
    const model = new ScriptedModel((messages, opts) => {
      const last = messages[messages.length - 1]
      if (opts.purpose === 'review') return { verdict: 'ship' }
      if (opts.purpose === 'reflect') return { lessons: {}, skill }
      calls.design++
      const user = messages.find((m, i) => i > 0 && m.role === 'user')!.content
      if (last.role === 'user' && user.includes('- bind-with-fiber:')) return { content: '', toolCalls: [{ id: `r${++reads}`, name: 'read_skill', args: { name: 'bind-with-fiber' } }] }
      // write the rule for the target's family (slimes, beasts) or, failing that, its own type
      const type = /"target":\{"role":"target"[^}]*?"type":"([^"]+)"/.exec(user)![1]
      const family = type.split('/').slice(0, 3).join('/')
      const cls = family === 'actor/creature/slime' || family === 'actor/creature/beast' ? family : type
      const other = cls === type ? type : cls === 'actor/creature/slime' ? 'actor/creature/slime/frost_slime' : 'actor/creature/beast/bear'
      return { patch: patchOf(bindRule(`patch/rope-binds-${cls.split('/').pop()}`, cls, other)) }
    })
    const { modder, state } = setup(model)
    state.setHarness({ ...state.harness(), reflect: { enabled: true, skillMinRecurrence: 1 } }, 'test: skills after one similar episode')

    await modder.resolve({ request: request() })
    await modder.settled()
    expect(state.skills()).toHaveLength(0) // nothing similar before: no skill yet

    await modder.resolve({ request: request('actor/creature/beast/wolf') })
    await modder.settled()
    expect(state.skills().map((s) => s.name)).toEqual(['bind-with-fiber'])
    expect(readFileSync(join(state.dir, 'skills/bind-with-fiber/SKILL.md'), 'utf8')).toMatch(/^---\nname: bind-with-fiber/)

    const third = await modder.resolve({ request: request('actor/creature/beast/boar', 'item/tool/rope') })
    // the beast rule covers the boar; a new class then: a snake-like creature with the same rope
    expect(third.outcome).toBe('covered')
    const golem = Object.keys(onto.types).find((t) => t.startsWith('actor/creature/') && !t.startsWith('actor/creature/slime') && !t.startsWith('actor/creature/beast') && !Object.keys(onto.types).some((o) => o.startsWith(t + '/')))!
    const r4 = await modder.resolve({ request: request(golem) })
    expect(state.episode(r4.episode!)!.skillsRead).toEqual(['bind-with-fiber'])
    expect(state.skill('bind-with-fiber')).toMatchObject({ uses: 1, accepted: 1 })
    await modder.settled()
    expect(state.skill('bind-with-fiber')!.version).toBe(2) // revised by name after use
  })

  it('snapshots the self-state and renders it as one transferable document', async () => {
    const { model } = scripted([patchOf(bindRule())])
    const { modder, state } = setup(model)
    await modder.resolve({ request: request() })
    await modder.settled()
    const to = state.snapshot('checkpoint-1')
    expect(existsSync(join(to, 'memory/lessons.json'))).toBe(true)
    expect(JSON.parse(readFileSync(join(to, 'meta.json'), 'utf8')).stats.accepted).toBe(1)
    expect(readFileSync(join(to, 'SELF.md'), 'utf8')).toContain('fiber tag')
    expect(() => state.snapshot('checkpoint-1')).toThrow(/exists/)
  })

  it('files requests of one interaction class under one key', () => {
    expect(signatureOf(request()).key).toBe(signatureOf(request()).key)
    expect(signatureOf(request()).key).not.toBe(signatureOf(request('actor/creature/beast/wolf')).key)
    expect(signatureOf(request()).terms).toContain('instrument#fiber')
  })
})

describe('the Mod port with the modder plugged in', () => {
  it('a game engine raises, the modder patches, the interaction re-resolves', async () => {
    const { model } = scripted([patchOf(bindRule())])
    const { modder } = setup(model)
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'rope', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
        { key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 1 },
      ],
      event: {},
    }
    const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
    const port = new ModPort(eng)
    let done!: () => void
    const finished = new Promise<void>((r) => (done = r))
    port.provider = { resolve: async (req) => (await modder.resolve({ request: req })).patch }
    port.onChange = () => port.records[0]?.status === 'patched' && done()
    eng.interact('interact', 'actor', { e: 'slime' })
    await finished
    expect(eng.world.hasStatus({ e: 'slime' }, 'frozen')).toBe(true)
    expect(eng.world.get('rope')).toBeUndefined()

    // the same shared patch arriving again (sync after reply) is a no-op
    const twice = port.submit(undefined, port.records[0].patch!)
    expect(twice.ok).toBe(true)
    expect(twice.warnings).toContain('already in the library')
  })
})

describe('the service', () => {
  it('serves resolve, the patch log and health over HTTP', async () => {
    const { model } = scripted([patchOf(bindRule())])
    const { modder } = setup(model)
    const server = createModderServer(modder).listen(0)
    await new Promise((r) => server.once('listening', r))
    const base = `http://localhost:${(server.address() as AddressInfo).port}`
    try {
      const health = await (await fetch(`${base}/health`)).json()
      expect(health).toMatchObject({ ok: true, model: 'scripted', library: { seq: 0 } })
      const reply = await (await fetch(`${base}/resolve`, { method: 'POST', body: JSON.stringify({ request: request() }) })).json()
      expect(reply.outcome).toBe('accepted')
      const log = await (await fetch(`${base}/patches?since=0`)).json()
      expect(log.seq).toBe(1)
      expect(log.entries[0].rules).toEqual(['patch/rope-binds-creature'])
      expect(log.entries[0].scenario).toBeUndefined()
      expect((await (await fetch(`${base}/patches?since=1`)).json()).entries).toEqual([])
    } finally {
      server.close()
    }
  })
})

describe('the OpenAI-compatible adapter', () => {
  it('speaks tool calls on the wire and drives a full episode', async () => {
    const bodies: Record<string, unknown>[] = []
    const { createServer } = await import('node:http')
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        const body = JSON.parse(raw)
        bodies.push(body)
        const last = body.messages[body.messages.length - 1]
        const text = (m: { content?: string }) => m.content ?? ''
        let message: Record<string, unknown>
        if (!body.tools) message = { content: text(body.messages[0]).includes('review') ? '{"verdict":"ship"}' : '{"lessons":{}}' }
        else if (last.role === 'user') message = { content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_type', arguments: '{"id":"item/tool/rope"}' } }] }
        else message = { content: '```json\n' + JSON.stringify({ patch: patchOf(bindRule()) }) + '\n```' }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ choices: [{ message }], usage: { prompt_tokens: 100, completion_tokens: 20 } }))
      })
    }).listen(0)
    await new Promise((r) => server.once('listening', r))
    try {
      const { OpenAICompatModel } = await import('../src/model.ts')
      const model = new OpenAICompatModel({ baseUrl: `http://localhost:${(server.address() as AddressInfo).port}/v1`, apiKey: 'test', model: 'mock-1' })
      const { modder, state } = setup(model)
      const reply = await modder.resolve({ request: request() })
      expect(reply.outcome).toBe('accepted')
      // the tool call went out with its schema, and its result came back as a tool message
      expect((bodies[0].tools as { function: { name: string } }[]).map((t) => t.function.name)).toContain('dry_run')
      const second = bodies[1].messages as { role: string; tool_call_id?: string; content: string }[]
      expect(second.at(-2)).toMatchObject({ role: 'assistant' })
      expect(second.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'call_1' })
      expect(second.at(-1)!.content).toContain('fiber')
      const ep = state.episode(reply.episode!)!
      expect(ep.model).toBe('mock-1')
      expect(ep.usage).toEqual({ calls: 3, input: 300, output: 60 })
    } finally {
      server.close()
    }
  })
})
