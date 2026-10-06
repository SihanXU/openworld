import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AddressInfo } from 'node:net'
import { Server } from 'node:http'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildRequest, buildSandbox, scenarioEvent, type ModRequest, type Patch, type Rule, type Scenario, type Tree, type Cond, type Effect } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
import { Modder, ScriptedModel, SelfState, WorldLibrary, auditOf, briefOf, relatedRules, createModderServer, freeLunch, laneOf, deriveTests, narrowKinds, parseJson, qualifyTerrains, scriptFromFile, signatureOf, type ChatMessage, type ChatOptions, type Model, type Script } from '../src/index.ts'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]

function listening(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    const ready = () => { server.off('error', failed); resolve() }
    const failed = (error: Error) => { server.off('listening', ready); reject(error) }
    server.once('listening', ready)
    server.once('error', failed)
  })
}

it('reports a listen error immediately', async () => {
  const server = new Server()
  const initial = server.listenerCount('listening')
  server.on('error', () => {})
  const error = Object.assign(new Error('listen EPERM'), { code: 'EPERM' })
  const result = Promise.race([listening(server).catch((e) => e), new Promise((resolve) => setTimeout(() => resolve('still waiting'), 20))])
  server.emit('error', error)
  expect(await result).toBe(error)
  expect(server.listenerCount('listening')).toBe(initial)
})

/**
 * A real ModRequest: the player puts a rope on a creature. The act is defined (the creature is
 * offered the rope), but no rule says how a creature takes being offered one: the hole is
 * `core/offered`, the event `impulse/offered`, hosted by the creature, with the rope as its item.
 */
function request(host = 'actor/creature/slime/green_slime', item = 'item/tool/rope'): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: item, x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: host, x: 2, y: 1 },
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  // the rope held out to it, as a rope used on it does (putting is physics: a creature does not take what is put on it)
  eng.queue({ kind: 'impulse/offered', host: { e: 'it' }, roles: { actor: { e: 'actor' }, item: { e: 'held' }, source: { e: 'held' } }, params: {}, cause: 'actor', origin: 'player' })
  const rec = port.records[0]
  expect(rec?.request).toMatchObject({ event: { kind: 'impulse/offered', host: { type: host } }, hole: { rule: 'core/offered' } })
  return rec.request
}

/** The other input: the rope USED on the creature, a hole in the rope's own nature (`core/use`). */
function useRequest(host = 'actor/creature/slime/green_slime'): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: host, x: 2, y: 1 },
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  expect(eng.act('use', 'actor', { e: 'it' }).defined).toBe(false)
  const rec = port.records[0]
  expect(rec.request).toMatchObject({ event: { kind: 'act/use', host: { type: 'item/tool/rope' } }, hole: { rule: 'core/use' } })
  return rec.request
}

const FIBER: Cond = { is: { role: 'item', sel: { tags: ['fiber'] } } }

/** The creature's nature when offered something fibrous: it is lashed down, and the rope goes onto it. */
function bindTree(): Tree {
  return {
    if: FIBER,
    then: {
      do: [
        { op: 'addStatus', status: 'frozen', duration: 30 },
        { op: 'emit', impulse: 'taken', to: 'item', params: { into: 'contents' }, other: 'host' },
        { op: 'vfx', fx: 'dust' },
        { op: 'log', text: { en: 'You lash {host} down with {item}.', zh: '你用{item}捆住了{host}。' } },
      ],
    },
  }
}

function bindRule(id = 'patch/rope-binds-creature', host = 'actor/creature', testHost = 'actor/creature/beast/wolf'): Rule {
  return {
    id,
    host: { type: host, notStatus: ['frozen'] },
    on: 'impulse/offered',
    doc: 'A creature offered a rope is lashed down with it for a while.',
    tree: bindTree(),
    tests: [
      {
        name: 'another creature',
        given: {
          entities: [
            { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
            { key: 'r', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
            { key: 'w', type: testHost, x: 2, y: 1 },
          ],
          // the rope held out to it (as a rope used on it does): the creature answers
          event: { kind: 'impulse/offered', host: 'w', actor: 'actor', item: 'r', source: 'r' },
        },
        expect: [{ key: 'w', hasStatus: 'frozen' }, { key: 'r', exists: true }],
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
    if (opts.purpose === 'reflect') return over.reflect?.(calls.reflect, messages) ?? { lessons: { add: [{ text: 'Select a rope-like item by its fiber tag, not its type.', terms: ['kind:impulse/offered', 'item#fiber'] }] }, skill: null }
    calls.design++
    if (last.role === 'user') return { content: '', toolCalls: [{ id: `c${calls.design}`, name: 'search_rules', args: { on: 'impulse/offered', tag: 'fiber' } }] }
    const d = drafts[Math.min(next++, drafts.length - 1)]
    return typeof d === 'string' ? d : { patch: d, summary: 'rope binds creatures' }
  }
  return { model: new ScriptedModel(script), calls }
}

/** The offline profile by default: the full loop (tools, blocking review, model-written tests). */
function setup(model?: Model, dir = mkdtempSync(join(tmpdir(), 'lsw-modder-')), profile: 'live' | 'offline' = 'offline') {
  const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
  const state = SelfState.open(join(dir, 'modder-state'))
  // these tests drive the patch pipeline (json); the repo-form agent has its own tests; the auditor too (audit.test.ts)
  state.setHarness({ ...state.harness(), audit: { ...auditOf(state.harness()), enabled: false }, offline: { ...state.harness().offline, design: { ...state.harness().offline.design, mode: 'json' } } }, 'test: json pipeline offline')
  const modder = new Modder({ library, state, model, profile })
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
    bad.tree = { if: FIBER, then: { do: [{ op: 'addStatus', status: 'hogtied' }] } }
    const { model, calls } = scripted([patchOf(bad), patchOf(bindRule())])
    const { modder, state } = setup(model)
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    const ep = state.episode(reply.episode!)!
    expect(ep.attempts.map((a) => a.phase)).toEqual(['design', 'repair'])
    expect(ep.attempts[0].errors.join()).toMatch(/unknown status "hogtied"/)
    // the repair turn showed the model exactly what the validator said
    const repairTurn = calls.log.find((c) => c.purpose === 'design' && c.messages.some((m) => m.role === 'user' && m.content.startsWith('The validator rejected')))
    expect(repairTurn?.messages.find((m) => m.content.startsWith('The validator rejected'))?.content).toContain('hogtied')
  })

  it('gives up after the harness\'s repair budget, leaving the library untouched', async () => {
    const bad = bindRule()
    bad.tree = { if: FIBER, then: { do: [{ op: 'addStatus', status: 'hogtied' }] } }
    const { model } = scripted([patchOf(bad)])
    const { modder, library, state } = setup(model)
    state.setHarness({ ...state.harness(), offline: { ...state.harness().offline, repair: { maxRounds: 1 } } }, 'test: one repair round')
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('failed')
    expect(reply.patch).toBeNull()
    expect(reply.diagnostics?.join()).toMatch(/hogtied/)
    expect(state.episode(reply.episode!)!.attempts).toHaveLength(2)
    expect(library.patchRules()).toHaveLength(0)
    expect(state.harness().version).toBe(3) // the setup's change and this one
    expect(readFileSync(join(state.dir, 'harness/CHANGELOG.md'), 'utf8')).toContain('one repair round')
  })

  it('answers a covered event from the shared library without a model call', async () => {
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

  it('returns covered before repairing a tie when another lane has answered the hole', async () => {
    const req = (type: string, id: string) => {
      const sc: Scenario = { entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'item', type, x: 2, y: 2, heldBy: 'actor' }, { key: 'pot', type: 'fixture/container/pot', x: 2, y: 1 }], event: { kind: 'act/use', host: 'item', actor: 'actor', instrument: 'item', target: 'pot' } }
      const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
      const ev = scenarioEvent(sc, eng)
      return buildRequest(eng, ev, eng.resolveEvent(ev), id)
    }
    const a = req('item/misc/doll', 'broad-request')
    const b = req('item/material/feather', 'other-request')
    expect(laneOf(a)).not.toBe(laneOf(b))
    const drafts = ['patch/broad-a', 'patch/broad-b'].map((id) => patchOf({ id, host: { type: 'item' }, on: 'act/use', tree: { do: [{ op: 'log', text: 'Answered.' }] } }))
    let goA!: () => void, goB!: () => void, both!: () => void
    const gates = [new Promise<void>((r) => (goA = r)), new Promise<void>((r) => (goB = r))]
    const started = new Promise<void>((r) => (both = r))
    let designs = 0
    const model = new ScriptedModel(async (_messages, opts) => {
      if (opts.purpose !== 'design') return {}
      const n = designs++
      if (designs === 2) both()
      await gates[n]
      return { patch: drafts[Math.min(n, 1)] }
    })
    const { modder, state, library } = setup(model)
    state.setHarness({ ...state.harness(), design: { ...state.harness().design, tests: 'model' }, repair: { maxRounds: 1 }, review: { enabled: false, maxRounds: 0 }, reflect: { enabled: false, skillMinRecurrence: 3 }, escalate: false, revise: false }, 'test: concurrent drafts')
    const pa = modder.resolve({ request: a }), pb = modder.resolve({ request: b })
    await started
    goA()
    const ra = await pa
    expect(library.covering(b)?.rule).toBe('patch/broad-a')
    expect(library.validate(drafts[1], b).errors.join('\n')).toMatch(/ties with/)
    goB()
    const rb = await pb
    await modder.settled()
    expect([ra.outcome, rb.outcome]).toEqual(['accepted', 'covered'])
    expect(model.calls).toBe(2)
    expect(library.log).toHaveLength(1)
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
    const skill = { name: 'Bind with fiber', description: 'Tying things up with rope-like items.', triggers: ['item#fiber'], body: '1. Host the rule on the creature class; select the item by the fiber tag.\n2. Freeze the host for a while; take the rope onto it (emit taken to the item).' }
    let reads = 0
    const calls = { design: 0 }
    const model = new ScriptedModel((messages, opts) => {
      const last = messages[messages.length - 1]
      if (opts.purpose === 'review') return { verdict: 'ship' }
      if (opts.purpose === 'reflect') return { lessons: {}, skill }
      calls.design++
      const user = messages.find((m, i) => i > 0 && m.role === 'user')!.content
      if (last.role === 'user' && user.includes('- bind-with-fiber:')) return { content: '', toolCalls: [{ id: `r${++reads}`, name: 'read_skill', args: { name: 'bind-with-fiber' } }] }
      // write the rule for the host's family (slimes, beasts) or, failing that, its own type
      const type = /"host":\{"role":"host"[^}]*?"type":"([^"]+)"/.exec(user)![1]
      const family = type.split('/').slice(0, 3).join('/')
      const cls = family === 'actor/creature/slime' || family === 'actor/creature/beast' ? family : type
      const other = cls === type ? type : cls === 'actor/creature/slime' ? 'actor/creature/slime/frost_slime' : 'actor/creature/beast/frost_wolf'
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
    // the beast rule covers the boar; a new class then: another kind of creature, the same rope
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

  it('files requests of one class of outcome under one key', () => {
    expect(signatureOf(request()).key).toBe(signatureOf(request()).key)
    expect(signatureOf(request()).key).not.toBe(signatureOf(request('actor/creature/beast/wolf')).key)
    expect(signatureOf(request()).key).not.toBe(signatureOf(request(undefined, 'item/tool/shovel')).key)
    expect(signatureOf(request()).terms).toEqual(expect.arrayContaining(['kind:impulse/offered', 'hole:core/offered', 'host:actor/creature/slime', 'item#fiber']))
  })
})

describe('the Mod port with the modder plugged in', () => {
  it('a game engine raises, the modder patches, the held event re-resolves', async () => {
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
    eng.queue({ kind: 'impulse/offered', host: { e: 'slime' }, roles: { actor: { e: 'actor' }, item: { e: 'rope' }, source: { e: 'rope' } }, params: {}, cause: 'actor', origin: 'player' })
    // while the outcome waits, its participants are held — the one who started the chain too
    expect(port.records[0]).toMatchObject({ status: 'pending', request: { event: { kind: 'impulse/offered' } } })
    expect(eng.world.get('slime')!.frozenBy).toBe(port.records[0].id)
    expect(eng.world.get('actor')!.frozenBy).toBe(port.records[0].id)
    await finished
    expect(eng.world.hasStatus({ e: 'slime' }, 'frozen')).toBe(true)
    expect(eng.world.get('rope')?.place).toEqual({ on: 'inside', holder: 'slime' })
    expect(eng.world.get('actor')!.frozenBy).toBeUndefined()

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
    await listening(server)
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

describe('the offline script (fixtures/offline.json, for `serve --script`)', () => {
  it('answers a rope held out to or used on a creature, live, and the patch covers the rest of the class', async () => {
    const model = scriptFromFile(fileURLToPath(new URL('../fixtures/offline.json', import.meta.url)))
    for (const first of ['put', 'use'] as const) {
      const { modder } = setup(model, undefined, 'live')
      const reply = await modder.resolve({ request: first === 'put' ? request() : useRequest() })
      expect(reply.outcome).toBe('accepted')
      expect(reply.patch?.artifacts.map((a) => (a.kind === 'rule' ? a.rule.id : a.kind))).toEqual(['patch/fiber-binds-creature', 'patch/fiber-lashes-creature'])
      expect((await modder.resolve({ request: first === 'put' ? useRequest() : request() })).outcome).toBe('covered')
      expect((await modder.resolve({ request: request('actor/creature/beast/wolf') })).outcome).toBe('covered')
      await modder.settled()
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
        res.end(JSON.stringify({ choices: [{ message }], usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.0005 } }))
      })
    }).listen(0)
    await listening(server)
    try {
      const { OpenAICompatModel } = await import('@lsw/agent')
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
      expect(ep.usage).toMatchObject({ calls: 3, input: 300, output: 60 })
      expect(ep.usage.cost).toBeCloseTo(0.0015)
    } finally {
      server.close()
    }
  })
})

describe('the economy check', () => {
  /** A club (the workbench makes one from a log) used on a workbench comes apart into logs. */
  const unmake = (logs: number): Rule => ({
    id: 'patch/club-comes-apart',
    host: { type: 'item/weapon/blunt/club' },
    on: 'act/use',
    doc: 'A club worked on a workbench comes apart into logs.',
    tree: { if: { is: { role: 'target', sel: { type: 'fixture/craft/workbench' } } }, then: { do: [{ op: 'transform', into: 'item/material/log' }, ...(logs > 1 ? [{ op: 'spawn', type: 'item/material/log', at: 'host', count: logs - 1 } as Effect] : [])] } },
  })

  it('refuses a patch that, with the world\'s own conversions, makes something from nothing — and names them', () => {
    const { library } = setup()
    const res = library.validate(patchOf(unmake(2)))
    expect(res.ok).toBe(false)
    const msg = res.errors.join()
    expect(msg).toMatch(/economy/)
    expect(msg).toMatch(/recipe item\/weapon\/blunt\/club/)
    expect(msg).toMatch(/rule patch\/club-comes-apart/)
    expect(msg).toMatch(/leave more item\/material\/(log|plank) \(\+\d/)
  })

  it('accepts one that gives back what went in', () => {
    const { library } = setup()
    expect(library.validate(patchOf(unmake(1))).errors.filter((e) => /economy/.test(e))).toEqual([])
  })

  it('finds a gain that takes three steps, which no pair of them shows', () => {
    const S = (name: string, takes: [string, number][], gives: [string, number][]) => ({ name, takes: new Map(takes), gives: new Map(gives) })
    const lunch = freeLunch([S('a', [['A', 2]], [['B', 3]]), S('b', [['B', 2]], [['C', 3]]), S('c', [['C', 2]], [['A', 3]])])
    expect(lunch?.uses.map((u) => u.step).sort()).toEqual(['a', 'b', 'c'])
    expect(freeLunch([S('a', [['A', 1]], [['B', 2]]), S('b', [['B', 2]], [['A', 1]])])).toBeUndefined()
  })
})

describe('integrity', () => {
  it('rejects a catch-all that would answer for anything at all', () => {
    const { library } = setup()
    const catchAll: Rule = { id: 'patch/offered-nothing', on: 'impulse/offered', tree: { do: [{ op: 'log', text: 'Nothing happens.' }] } }
    expect(library.validate(patchOf(catchAll), request()).errors.join()).toMatch(/name the host/)
    // naming what the rule is about is enough
    const scoped: Rule = { ...catchAll, id: 'patch/creature-offered-nothing', host: { type: 'actor/creature' } }
    expect(library.validate(patchOf(scoped), request()).errors.join()).not.toMatch(/name the host/)
  })

  it('holds a patch to the event model: host-only effects, no holes, not the earlier shape', () => {
    const { library } = setup()
    const of = { ...bindRule(), tree: { if: FIBER, then: { do: [{ op: 'addStatus', of: 'item', status: 'wet' }] } } } as unknown as Rule
    expect(library.validate(patchOf(of), request()).errors.join()).toMatch(/effects act on the host only/)
    const hole: Rule = { ...bindRule(), tree: { if: FIBER, then: { undefined: true } } }
    expect(library.validate(patchOf(hole), request()).errors.join()).toMatch(/may not leave an outcome undefined/)
    const old = { id: 'patch/rope-binds', on: 'interaction', when: { verb: ['interact'] }, do: [{ op: 'addStatus', of: 'target', status: 'frozen' }] } as unknown as Rule
    expect(library.validate(patchOf(old), request()).errors.join()).toMatch(/earlier rule shape/)
    // a rule that does not answer the event that asked is no answer
    const elsewhere: Rule = { ...bindRule(), on: 'impulse/handle' }
    expect(library.validate(patchOf(elsewhere), request()).errors.join()).toMatch(/still undefined/)
  })

  it('refuses two rules of one patch that tie with each other, as it would across patches', () => {
    const { library } = setup()
    const a = bindRule('patch/a')
    const b = { ...bindRule('patch/b'), doc: 'the same class, said again' }
    expect(library.validate(patchOf(a, b), request()).errors.join()).toMatch(/"patch\/a" ties with "patch\/b"/)
  })

  it('reports an unproven chance assignment bound in the library audit', () => {
    const { library } = setup()
    const req = useRequest()
    const rule: Rule = { id: 'patch/audit-chances', host: { type: 'item/tool/rope' }, on: 'act/use', tree: {
      if: { all: Array.from({ length: 7 }, () => ({ any: [{ chance: 0.5 }, { chance: 1 }] })) }, then: { do: [] }, else: { do: [] },
    } }
    library.lib.add({ ...rule, source: { origin: 'patch' } })
    library.regression.push({ scenario: req.scenario, rule: rule.id })
    expect(library.audit()).toEqual([{ rule: rule.id, reason: expect.stringMatching(/repeat check.*64.*safety/) }])
  })

  it('commits to the shared log only what stands on the shared library alone', async () => {
    const glow: Rule = { ...bindRule('patch/rope-glows'), tree: { if: FIBER, then: { do: [{ op: 'addStatus', status: 'glowing', duration: 30 }] } }, tests: [] }
    const status = { id: 'glowing', duration: 30 }
    // the first draft leans on a status only this client has (a local patch of its own); the repair carries it
    const { model, calls } = scripted([patchOf(glow), { artifacts: [{ kind: 'status', status }, { kind: 'rule', rule: glow }] }])
    const { modder, library } = setup(model)
    const ws = { patches: { rules: [], statuses: [status] } }
    expect(library.validate(patchOf(glow), request(), ws).ok).toBe(true)
    const reply = await modder.resolve({ request: request(), workspace: ws })
    expect(reply.outcome).toBe('accepted')
    expect(calls.log.some((c) => c.messages.some((m) => m.role !== 'system' && /glowing/.test(m.content) && /unknown status/.test(m.content)))).toBe(true)
    // the shared library now knows the status, so every client can take the rule
    expect(library.lib.statuses.map((s) => s.id)).toContain('glowing')
  })

  it('asks no model when the service\'s own base rules already answer (the client is older)', async () => {
    const { model, calls } = scripted([patchOf(bindRule())])
    const dir = mkdtempSync(join(tmpdir(), 'lsw-modder-'))
    // the service's base rules have learned what the client's have not
    const newer: Rule = { ...bindRule('creature/offered-rope'), source: { origin: 'base' } }
    const library = new WorldLibrary(onto, [...BASE, newer], join(dir, 'library.jsonl'))
    const state = SelfState.open(join(dir, 'modder-state'))
    state.setHarness({ ...state.harness(), audit: { ...auditOf(state.harness()), enabled: false } }, 'test: no auditor')
    const modder = new Modder({ library, state, model })
    const reply = await modder.resolve({ request: request() })
    expect(reply).toMatchObject({ patch: null, outcome: 'failed' })
    expect(reply.diagnostics?.join()).toMatch(/creature\/offered-rope/)
    expect(calls.design).toBe(0)
  })
})

describe('deterministic repairs', () => {
  it('accepts a correct rule in the wrong wrapper without another model turn', async () => {
    const rule = bindRule()
    const { tree: _t, ...bare } = rule
    // a rule written in the flat form: its condition and effects beside the rule, not in a tree
    const flat = { ...bare, if: FIBER, do: (bindTree() as { then: { do: unknown[] } }).then.do }
    // effects keyed by their op ({"addStatus": {"status": …}}), as a live model wrote them
    const tree = bindTree() as { if: unknown; then: { do: { op: string }[] } }
    const keyed = { ...rule, tree: { ...tree, then: { do: tree.then.do.map(({ op, ...args }) => ({ [op]: args })) } } }
    // the shapes models actually produce: the rule as the artifact, or its fields spread on {kind:"rule"}
    for (const draft of [{ artifacts: [rule] }, { artifacts: [{ kind: 'rule', ...rule }] }, rule, { rules: [rule] }, { artifacts: [{ kind: 'rule', rule: flat }] }, { artifacts: [{ kind: 'rule', rule: keyed }] }]) {
      const { model, calls } = scripted([draft as unknown as Patch])
      const { modder, state, library } = setup(model)
      const reply = await modder.resolve({ request: request() })
      expect(reply.outcome).toBe('accepted')
      const ep = state.episode(reply.episode!)!
      expect(ep.attempts).toHaveLength(1)
      expect(ep.attempts[0].fixes?.length).toBeGreaterThan(0)
      expect(calls.design).toBe(2) // the tool turn and the answer: no repair round
      expect(library.lib.rules.get('patch/rope-binds-creature')!.tree).toEqual(bindTree())
    }
  })

  it('derives the test on an instance its rule answers, not on one a more specific patch already answers', () => {
    // 2026-10-03: a rule for every plant was flagged "did not generalize" because the sibling it
    // was tried on (flowers) had its own, more specific patch
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'it', type: 'fixture/nature/ferns', x: 2, y: 1 },
      ],
      event: {},
    }
    const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
    const port = new ModPort(eng)
    // a bare blow on it: what cannot break has no answer of its own to a blow (core/strike)
    eng.act('use', 'actor', { e: 'it' }, { instrument: null, params: { attack: true } })
    const req = port.records[0].request
    expect(req.hole.rule).toBe('core/strike')
    const shed = (id: string, host: Rule['host']): Rule => ({ id, host, on: 'impulse/strike', doc: 'Struck, it is flattened.', tree: { do: [{ op: 'transform', into: 'fixture/nature/tuft' }, { op: 'vfx', fx: 'leaves' }] } })
    const library = new WorldLibrary(onto, BASE)
    expect(library.commit(patchOf(shed('patch/flowers-shed', { type: 'fixture/nature/flowers' }))).ok).toBe(true)
    const d = deriveTests(patchOf(shed('patch/plants-shed', { type: 'fixture/nature', tags: ['plant'] })), req, library.lib, library.fullOntology())
    expect(d.notes.join()).toMatch(/derived a test on host/)
    expect(d.notes.join()).not.toMatch(/flowers|did not generalize/)
  })

  it('reads a bare terrain id as its tile type, in the host and in conditions', () => {
    // 2026-10-03, Kimi K3: {"kind": "tile", "type": "bush"} for the bush tile (the kind goes in normalizePatch)
    const r: Rule = { id: 'patch/bush-chop', host: { type: 'bush' }, on: 'impulse/strike', doc: 'd', tree: { if: { is: { role: 'other', sel: { type: 'grass' } } }, then: { do: [{ op: 'vfx', fx: 'leaves' }] } } }
    const { patch, fixes } = qualifyTerrains(patchOf(r), onto)
    const q = (patch.artifacts[0] as { rule: Rule }).rule
    expect(q.host).toEqual({ type: 'tile/bush' })
    expect((q.tree as { if: { is: { sel: unknown } } }).if.is.sel).toEqual({ type: 'tile/grass' })
    expect(fixes).toHaveLength(2)
    // a real type of that name is left alone, and the validator says what the terrain is called
    expect(qualifyTerrains(patchOf({ ...r, host: { type: 'item/food' }, tree: { do: [{ op: 'vfx', fx: 'leaves' }] } }), onto).fixes).toEqual([])
    expect(new WorldLibrary(onto, BASE).validate(patchOf(r)).errors.join()).toMatch(/a terrain is named "tile\/bush"/)
  })

  it('reads an answer whose only fault is its brackets (one closed too early), as a live model wrote it', () => {
    // 2026-10-03, Kimi K3: one `}` too many after the tree, so "doc" fell into the array
    const raw = '{"patch": {"artifacts": [{"id": "patch/x", "host": {"tags": ["empty-vessel"]}, "on": "act/use", "tree": {"if": {"is": {"role": "target", "sel": {"type": "tile/snow"}}}, "then": {"do": [{"op": "vfx", "fx": "frost"}]}}}, "doc": "d"}], "note": "n"}, "summary": "s"}'
    expect(() => JSON.parse(raw)).toThrow()
    let repaired = false
    const v = parseJson(raw, () => (repaired = true)) as { patch: { artifacts: { tree: { then: unknown }; doc: string }[] } }
    expect(repaired).toBe(true)
    expect(v.patch.artifacts[0].doc).toBe('d')
    expect(v.patch.artifacts[0].tree.then).toEqual({ do: [{ op: 'vfx', fx: 'frost' }] })
    // a truncated answer is not completed into a shorter rule
    expect(parseJson('{"patch": {"artifacts": [{"id": "patch/x", "tree": {"if": {"is": {"role": "target"}}, "then": {"do": [{"op": "vfx"}')).toBeUndefined()
  })

  it('narrows a rule to the kind that was asked when its broader branch is what ties', async () => {
    const p = patchOf({ ...bindRule(), on: 'impulse' })
    const res = { ok: false, errors: ['rule "patch/rope-binds-creature" ties with "patch/creature-shrugs" (same kind, same specificity, overlapping hosts) — make it more specific or name a different host'], warnings: [], overrides: [] }
    const n = narrowKinds(p, request(), res)!
    expect(n.fixes[0]).toMatch(/narrowed/)
    expect((n.patch.artifacts[0] as { rule: Rule }).rule.on).toBe('impulse/offered')
    expect(narrowKinds(p, request(), { ...res, errors: ['unknown status "x"'] })).toBeUndefined()

    // in the pipeline: an earlier patch answers the whole impulse branch for the same class
    const { model, calls } = scripted([p])
    const { modder, state, library } = setup(model)
    const shrug: Rule = { id: 'patch/creature-shrugs', host: { type: 'actor/creature', notStatus: ['frozen'] }, on: 'impulse', doc: 'Wind ruffles a creature.', tree: { if: { param: { key: 'element', cmp: 'wind' } }, then: { do: [{ op: 'vfx', fx: 'dust' }] } } }
    expect(library.commit(patchOf(shrug)).ok).toBe(true)
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    expect(state.episode(reply.episode!)!.attempts[0].fixes?.join()).toMatch(/narrowed "patch\/rope-binds-creature" from impulse to impulse\/offered/)
    expect(library.lib.rules.get('patch/rope-binds-creature')!.on).toBe('impulse/offered')
    expect(calls.design).toBe(2) // no repair round
  })
})

describe('the tail guard', () => {
  async function mock(handler: (n: number, body: Record<string, unknown>, res: import('node:http').ServerResponse) => void) {
    const { createServer } = await import('node:http')
    let n = 0
    const bodies: Record<string, unknown>[] = []
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        const body = JSON.parse(raw)
        bodies.push(body)
        handler(n++, body, res)
      })
    }).listen(0)
    await listening(server)
    const { OpenAICompatModel } = await import('@lsw/agent')
    const model = new OpenAICompatModel({ baseUrl: `http://localhost:${(server.address() as AddressInfo).port}/v1`, apiKey: 't', model: 'm', extraBody: { provider: { order: ['a', 'b'] } } })
    return { model, bodies, close: () => (server.closeAllConnections(), server.close()) }
  }
  const ok = (res: import('node:http').ServerResponse, text: string) => (res.writeHead(200, { 'Content-Type': 'application/json' }), res.end(JSON.stringify({ choices: [{ message: { content: text } }], provider: text })))

  it('hedges a stalled call to the next provider and takes the first answer', async () => {
    const m = await mock((n, _b, res) => (n === 0 ? undefined : ok(res, 'second')))
    try {
      const t0 = Date.now()
      const r = await m.model.chat([{ role: 'user', content: 'hi' }], { hedgeMs: 150, deadlineMs: 3000 })
      expect(r.content).toBe('second')
      expect(r.hedged).toBe(true)
      expect(Date.now() - t0).toBeLessThan(1500)
      expect((m.bodies[1].provider as { order: string[] }).order).toEqual(['b', 'a'])
    } finally {
      m.close()
    }
  })

  it('treats an empty body as a failure and asks again at once', async () => {
    const m = await mock((n, _b, res) => (n === 0 ? (res.writeHead(200), res.end('')) : ok(res, 'again')))
    try {
      const r = await m.model.chat([{ role: 'user', content: 'hi' }], { hedgeMs: 5000, deadlineMs: 8000 })
      expect(r.content).toBe('again')
    } finally {
      m.close()
    }
  })

  it('gives up a try at the deadline and retries', async () => {
    const m = await mock((n, _b, res) => (n < 2 ? undefined : ok(res, 'retry')))
    try {
      const r = await m.model.chat([{ role: 'user', content: 'hi' }], { hedgeMs: 50, deadlineMs: 300, retries: 1 })
      expect(r.content).toBe('retry')
    } finally {
      m.close()
    }
  })
})

describe('the router: local, then find, then create', () => {
  const INGOT_ART = {
    grid: ['................', '................', '................', '....kkkkkkkkk...', '...kaaeaaaaaak..', '..kaeaaaaaaabk..', '.kaaaaaaaaabbck.', 'kbbbbbbbbbbbcck.', 'kbbbbbbbbbbccdk.', 'kbccbbbbbbbccdk.', 'kcccccccccccddk.', 'kccccccccccddk..', '.kkkkkkkkkkkkk..', '................', '................', '................'],
    palette: { k: '#141b1b', e: '#eef2f0', a: '#b9c1c6', b: '#8a949c', c: '#5e6870', d: '#3e464e' },
  }
  /** A creature offered rope leaves something behind: the router's answers are scripted by what each call shows. */
  // (once, then not for a while: a yield costs its host — the repeat check, world-model.md §8.4)
  const leaves = (type: string): Rule => ({ id: 'patch/rope-on-creature-leaves', host: { type: 'actor/creature' }, on: 'impulse/offered', doc: `A creature offered rope leaves ${type} behind, and not again for a while.`, tree: { if: { all: [FIBER, { not: { has: { role: 'host', status: 'stirred' } } }] }, then: { do: [{ op: 'spawn', type, at: 'host' }, { op: 'addStatus', status: 'stirred' }, { op: 'log', text: { en: 'Something drops.', zh: '掉下了东西。' } }] } } })
  const INGOT_TYPE = { id: 'item/material/iron_ingot', name: { en: 'Iron Ingot', zh: '铁锭' }, tags: ['metal'], props: { material: 'iron' }, makeup: [{ type: 'item/material/iron_ore', count: 1 }] }

  function router(o: { local: unknown; find?: unknown; create?: unknown; art?: (n: number) => unknown; onArt?: () => void }) {
    const seen: { purpose?: string; system: string; last: string }[] = []
    let arts = 0
    const model = new ScriptedModel((messages, opts) => {
      const last = messages[messages.length - 1].content
      seen.push({ purpose: opts.purpose, system: messages[0].content, last })
      if (opts.purpose === 'review') return { verdict: 'ship' }
      if (opts.purpose === 'reflect') return {}
      if (opts.purpose === 'art') return (o.onArt?.(), o.art?.(arts++) ?? INGOT_ART) as object
      if (last.startsWith('# Create')) return o.create as object
      if (last.startsWith('# What you asked for')) return o.find as object
      return o.local as object
    })
    return { model, seen }
  }

  it('answers from the request alone when nothing beyond it is needed: no catalogue, the directories in the brief', async () => {
    const { model, seen } = router({ local: { patch: patchOf(noTestsRule(bindRule())) } })
    const { modder, state } = setup(model, undefined, 'live')
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    expect(state.episode(reply.episode!)!.route).toEqual(['local'])
    const design = seen.filter((c) => c.purpose === 'design')
    expect(design).toHaveLength(1)
    expect(design[0].system).toContain('"types":[]')
    expect(design[0].system).toContain('Things beyond this request')
    expect(seen.find((c) => c.purpose === 'design')!.last).toMatch(/## The directories of this request[\s\S]*actor\/creature\/slime\/ \(green_slime here\): green_slime, fire_slime/)
  })

  it('finds what the design needs in the catalogue, and uses the type the world has', async () => {
    const { model, seen } = router({ local: { need: [{ name: 'stick', why: 'what it leaves behind' }] }, find: { patch: patchOf(leaves('item/material/stick')) } })
    const { modder, state, library } = setup(model, undefined, 'live')
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    const ep = state.episode(reply.episode!)!
    expect(ep).toMatchObject({ route: ['local', 'find'], needed: ['stick'], created: [] })
    const find = seen.find((c) => c.last.startsWith('# What you asked for'))!.last
    expect(find).toMatch(/"stick" \(what it leaves behind\): closest by name: item\/material\/stick/)
    expect(find).toMatch(/item\/material\/: .*stick/)
    expect(library.lib.types).toEqual([])
  })

  it('creates what the world does not have, with its picture, and says so while it works', async () => {
    let during: unknown
    const req = request()
    const { model } = router({
      local: { need: [{ name: 'iron ingot' }] },
      find: { create: [{ id: 'item/material/iron_ingot', name: { en: 'Iron Ingot', zh: '铁锭' }, why: 'smelted iron' }] },
      create: { patch: { artifacts: [{ kind: 'type', type: INGOT_TYPE }, { kind: 'rule', rule: leaves('item/material/iron_ingot') }] } },
      onArt: () => (during = modder.progressOf(req.id)),
    })
    const { modder, state, library } = setup(model, undefined, 'live')
    const reply = await modder.resolve({ request: req })
    expect(reply.outcome).toBe('accepted')
    expect(during).toEqual({ stage: 'art', creating: [{ en: 'Iron Ingot', zh: '铁锭' }] })
    expect(modder.progressOf(req.id)).toBeUndefined()
    expect(state.episode(reply.episode!)).toMatchObject({ route: ['local', 'find', 'create'], created: ['item/material/iron_ingot'] })
    const t = library.lib.types.find((x) => x.id === 'item/material/iron_ingot')!
    expect(t).toMatchObject({ sprite: 'art:item/material/iron_ingot', art: INGOT_ART })
    // every client gets the new thing with the rule that makes it
    expect(library.since(0).at(-1)).toMatchObject({ patch: { artifacts: [{ kind: 'type', type: { id: 'item/material/iron_ingot' } }, { kind: 'rule' }] } })
  })

  it('still creates the thing when its picture cannot be drawn: it shows its parent\'s', async () => {
    const { model } = router({
      local: { need: [{ name: 'iron ingot' }] },
      find: { create: [{ id: 'item/material/iron_ingot', name: { en: 'Iron Ingot', zh: '铁锭' } }] },
      create: { patch: { artifacts: [{ kind: 'type', type: INGOT_TYPE }, { kind: 'rule', rule: leaves('item/material/iron_ingot') }] } },
      art: () => ({ grid: ['k'], palette: { k: '#000000' } }),
    })
    const { modder, library } = setup(model, undefined, 'live')
    expect((await modder.resolve({ request: request() })).outcome).toBe('accepted')
    const t = library.lib.types.find((x) => x.id === 'item/material/iron_ingot')!
    expect(t.art).toBeUndefined()
    expect(t.sprite).toBeUndefined()
  })

  /** A scripted designer that counts how many designs run at once. */
  function overlapping() {
    const seen = { busy: 0, most: 0, designs: 0 }
    const model = new ScriptedModel(async (messages, opts) => {
      if (opts.purpose !== 'design') return opts.purpose === 'review' ? { verdict: 'ship' } : {}
      seen.busy++
      seen.designs++
      seen.most = Math.max(seen.most, seen.busy)
      await new Promise((r) => setTimeout(r, 20))
      seen.busy--
      return { patch: patchOf(noTestsRule(messages[1].content.includes('impulse/offered') ? bindRule() : { ...bindRule('patch/rope-used-on-creature'), on: 'act/use', host: { type: 'item/tool/rope' }, tree: { if: { is: { role: 'target', sel: { type: 'actor/creature' } } }, then: { do: [{ op: 'log', text: 'You wave the rope.' }] } } })) }
    })
    return { model, seen }
  }

  it('designs side by side when the patches would be written in different places (lanes)', async () => {
    const { model, seen } = overlapping()
    const { modder } = setup(model, undefined, 'live')
    expect(laneOf(request())).not.toBe(laneOf(useRequest()))
    const replies = await Promise.all([modder.resolve({ request: request() }), modder.resolve({ request: useRequest() })])
    expect(replies.map((r) => r.outcome)).toEqual(['accepted', 'accepted'])
    expect(seen.most).toBe(2)
  })

  it('queues requests in one lane, so the later one is answered by what the earlier committed', async () => {
    const { model, seen } = overlapping()
    const { modder } = setup(model, undefined, 'live')
    // a slime and a wolf offered rope: two classes, one lane (impulse/offered on a creature)
    const wolf = request('actor/creature/beast/wolf')
    expect(laneOf(wolf)).toBe(laneOf(request()))
    const replies = await Promise.all([modder.resolve({ request: request() }), modder.resolve({ request: wolf })])
    expect(replies.map((r) => r.outcome).sort()).toEqual(['accepted', 'covered'])
    expect(seen.most).toBe(1)
    expect(seen.designs).toBe(1)
  })
})

describe('the design prompt', () => {
  it('keeps the static system prefix byte-identical across addenda, clients and library versions', async () => {
    const seen: { system: string; user: string }[] = []
    const model = new ScriptedModel((messages, opts) => {
      if (opts.purpose === 'design') seen.push({ system: messages[0].content, user: messages[1].content })
      return opts.purpose === 'review' ? { verdict: 'ship' } : opts.purpose === 'reflect' ? {} : { patch: patchOf(noTestsRule(bindRule())) }
    })
    const { modder, library, state } = setup(model, undefined, 'live')
    const version = library.lib.version
    await modder.resolve({ request: request() })
    const first = seen[0]
    // later: the shared library has a patch, and this client a status of its own
    expect(library.lib.version).toBeGreaterThan(version)
    state.setHarness({ ...state.harness(), addenda: ['Keep outcomes legible.'] }, 'test: a variable addendum')
    const n = seen.length
    await modder.resolve({ request: useRequest(), workspace: { patches: { rules: [], statuses: [{ id: 'glowing', duration: 30 }] } } })
    const later = seen[n]
    expect(Buffer.compare(Buffer.from(later.system.split('\n\nYour own working notes:')[0]), Buffer.from(first.system))).toBe(0)
    expect(later.system).toContain('Your own working notes:\n- Keep outcomes legible.')
    expect(first.system).not.toMatch(/lib@/)
    // the scenario is the harness's to replay, and the brief carries the rules: neither is in the model's request
    expect(first.user).not.toMatch(/"scenario"/)
    expect(first.user).toMatch(/"rules":\[\]/)
    expect(later.user).toMatch(/# Types and statuses added by patches[\s\S]*"id":"glowing"/)
    expect(first.user).not.toMatch(/read_skill|get_episode|search_rules/)
  })

  it('shows each related rule once, retaining the closest rules in full', () => {
    const req = request(), library = new RuleLibrary(BASE)
    const related = relatedRules(req, library)
    const brief = briefOf(req, library, onto)
    const lines = brief.split('\n')
    for (const r of related.slice(0, 24)) {
      const full = lines.filter((line) => { try { return JSON.parse(line).id === r.id } catch { return false } })
      const compact = lines.filter((line) => line.startsWith(`${r.id} [`))
      expect(full.length + compact.length, r.id).toBe(1)
      if (related.indexOf(r) < 4) expect(JSON.parse(full[0]).tree).toEqual(r.tree)
    }
  })
})

const noTestsRule = (r: Rule): Rule => ({ ...r, tests: undefined })

describe('the live profile', () => {
  /** Live design calls carry no tools; offline ones do. */
  function liveModel(o: { live: (n: number) => unknown; offline?: (n: number, m: ChatMessage[]) => unknown; review?: (n: number, m: ChatMessage[]) => unknown; reflect?: (n: number, m: ChatMessage[]) => unknown }) {
    const n = { live: 0, offline: 0, review: 0, reflect: 0 }
    const model = new ScriptedModel((messages, opts) => {
      if (opts.purpose === 'review') {
        const i = n.review++
        return (o.review?.(i, messages) ?? { verdict: 'ship' }) as object
      }
      if (opts.purpose === 'reflect') return (o.reflect?.(n.reflect++, messages) ?? {}) as object
      if (opts.tools?.length || messages.some((m) => m.role === 'tool')) {
        n.offline++
        const last = messages[messages.length - 1]
        return last.role === 'user' ? { content: '', toolCalls: [{ id: 'x', name: 'get_type', args: { id: 'item/tool/rope' } }] } : (o.offline!(n.offline, messages) as object)
      }
      return o.live(n.live++) as object
    })
    return { model, n }
  }
  const noTests = (r: Rule): Rule => ({ ...r, tests: undefined })

  it('answers in one call without tools and writes the generalization test itself', async () => {
    const { model, n } = liveModel({ live: () => ({ patch: patchOf(noTests(bindRule())) }) })
    const { modder, state, library } = setup(model, undefined, 'live')
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    const ep = state.episode(reply.episode!)!
    expect(ep.usage.calls).toBe(1)
    expect(ep.profile).toBe('live')
    expect(ep.attempts[0].derived?.join()).toMatch(/derived a test on host/)
    const tests = library.lib.rules.get('patch/rope-binds-creature')!.tests!
    // the harness swapped the HOST for another instance of its class, from another branch of it
    expect(tests[0].name).toMatch(/^derived: host actor\/creature\//)
    expect(tests[0].given.event).toMatchObject({ kind: 'impulse/offered', host: 'host' })
    expect(tests[0].given.entities.find((e) => e.key === 'host')!.type).not.toMatch(/^actor\/creature\/slime/)
    expect(tests[0].expect).toContainEqual({ key: 'host', hasStatus: 'frozen' })
    await modder.settled()
    // nothing flagged in it (it changes the world, and generalized): no review after the fact
    expect(n.review).toBe(0)
  })

  it('reviews every live rule after the fact when the harness says review.unflagged', async () => {
    const { model, n } = liveModel({ live: () => ({ patch: patchOf(noTests(bindRule())) }) })
    const { modder, state } = setup(model, undefined, 'live')
    state.setHarness({ ...state.harness(), review: { ...state.harness().review, unflagged: true } }, 'test: review everything')
    await modder.resolve({ request: request() })
    await modder.settled()
    expect(n.review).toBe(1) // reviewed after the player had the patch
    expect(readFileSync(join(state.dir, 'journal.jsonl'), 'utf8')).toMatch(/"kind":"review"/)
  })

  it('reflects on live episodes that went cleanly a batch at a time, citing each', async () => {
    const classes = [
      ['slime', 'green_slime', 'frost_slime'],
      ['beast', 'wolf', 'boar'],
      ['undead', 'zombie', 'skeleton'],
      ['golem', 'stone_golem', 'ice_golem'],
    ]
    let batch = ''
    const { model, n } = liveModel({
      live: (i) => {
        const [cls, , sibling] = classes[i]
        return { patch: patchOf(noTests(bindRule(`patch/rope-binds-${cls}`, `actor/creature/${cls}`, `actor/creature/${cls}/${sibling}`))) }
      },
      reflect: (_i, m) => ((batch = m[1].content), { lessons: { add: [{ text: 'Bind by the fiber tag.', terms: [] }] } }),
    })
    const { modder, state } = setup(model, undefined, 'live')
    expect(state.harness().reflect.batch).toBe(4)
    const ids: string[] = []
    for (const [i, [cls, host]] of classes.entries()) {
      const reply = await modder.resolve({ request: request(`actor/creature/${cls}/${host}`) })
      expect(reply.outcome).toBe('accepted')
      ids.push(reply.episode!)
      await modder.settled()
      expect(n.reflect).toBe(i < 3 ? 0 : 1)
    }
    expect(batch).toContain('# 4 episodes, each accepted at its first answer')
    expect(state.lessons().find((l) => l.text === 'Bind by the fiber tag.')!.episodes).toEqual(ids)
  })

  it.each(['find', 'create'] as const)('batches four clean %s routes into one reflection', async (route) => {
    const classes = [['slime', 'green_slime'], ['beast', 'wolf'], ['undead', 'zombie'], ['golem', 'stone_golem']]
    let index = 0, reflections = 0, batch = ''
    const model = new ScriptedModel((messages, opts) => {
      if (opts.purpose === 'reflect') { reflections++; batch = messages[1].content; return {} }
      if (opts.purpose === 'review') return { verdict: 'ship' }
      if (opts.purpose === 'art') return { grid: Array(16).fill('................'), palette: { k: '#000000' } }
      const cls = classes[index][0]
      const type = { id: `item/material/${cls}_ingot`, name: { en: `${cls} Ingot`, zh: `${cls}锭` }, props: { material: 'iron' }, makeup: [{ type: 'item/material/iron_ore', count: 1 }] }
      const last = messages.at(-1)!.content
      if (last.startsWith('# Request')) return { need: [{ name: 'iron ingot' }] }
      if (route === 'create' && last.startsWith('# What you asked for')) return { create: [{ ...type, why: 'a new ingot' }] }
      index++
      const patch = patchOf(noTests(bindRule(`patch/route-${cls}`, `actor/creature/${cls}`)))
      if (route === 'create') patch.artifacts.unshift({ kind: 'type', type })
      return { patch }
    })
    const { modder, state } = setup(model, undefined, 'live')
    const ids: string[] = []
    for (const [i, [cls, host]] of classes.entries()) {
      const reply = await modder.resolve({ request: request(`actor/creature/${cls}/${host}`) })
      expect(reply.outcome).toBe('accepted')
      ids.push(reply.episode!)
      await modder.settled()
      expect(state.episode(reply.episode!)!.route).toContain(route)
      expect(reflections).toBe(i < 3 ? 0 : 1)
    }
    for (const id of ids) expect(batch).toContain(id)
  })

  it('reflects immediately on repaired or flagged live outcomes', async () => {
    for (const kind of ['errors', 'fixes', 'flags']) {
      const { model, n } = liveModel({ live: (i) => {
        if (kind === 'errors' && i === 0) return 'not JSON'
        if (kind === 'fixes') return noTests(bindRule())
        return { patch: patchOf(noTests(kind === 'flags' ? { ...bindRule(), tree: { do: [{ op: 'log', text: 'Nothing happens.' }] } } : bindRule())) }
      }, reflect: () => ({}) })
      const { modder } = setup(model, undefined, 'live')
      const reply = await modder.resolve({ request: request() })
      expect(reply.outcome).toBe('accepted')
      await modder.settled()
      expect(n.reflect).toBe(1)
    }
  })

  it('works a failed live request again offline, in the background', async () => {
    const { model, n } = liveModel({ live: () => 'I am not sure.', offline: () => ({ patch: patchOf(bindRule()) }) })
    const { modder, state, library } = setup(model, undefined, 'live')
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('failed') // the player gets the fallback now
    expect(n.live).toBe(2) // one answer and one repair, the live budget
    await modder.settled()
    expect(library.lib.rules.has('patch/rope-binds-creature')).toBe(true) // ...and the world learns it anyway
    const escalated = state.episodes().map((e) => state.episode(e.id)!).find((e) => e.escalatedFrom === reply.episode)!
    expect(escalated).toMatchObject({ profile: 'offline', outcome: 'accepted' })
  })

  it('revises a shipped rule when the late reviewer asks, replacing it in the shared library', async () => {
    const narrow = noTests(bindRule('patch/rope-binds-slime', 'actor/creature/slime', 'actor/creature/slime/frost_slime'))
    const { model } = liveModel({
      live: () => ({ patch: patchOf(narrow) }),
      review: (i) => (i === 0 ? { verdict: 'revise', notes: ['Any creature can be tied up, not just slimes.'] } : { verdict: 'ship' }),
      offline: (_i, messages) => {
        expect(messages[1].content).toContain('# Revision')
        return { patch: patchOf(bindRule()) }
      },
    })
    const { modder, state, library } = setup(model, undefined, 'live')
    state.setHarness({ ...state.harness(), review: { ...state.harness().review, unflagged: true } }, 'test: review everything')
    const first = await modder.resolve({ request: request() })
    expect(library.lib.rules.has('patch/rope-binds-slime')).toBe(true)
    await modder.settled()
    expect(library.lib.rules.has('patch/rope-binds-slime')).toBe(false)
    expect(library.lib.rules.has('patch/rope-binds-creature')).toBe(true)
    expect(library.since(0).map((e) => ('remove' in e ? `-${e.remove}` : `+${e.rules.join()}`))).toEqual(['+patch/rope-binds-slime', '-patch/rope-binds-slime', '+patch/rope-binds-creature'])
    const rev = state.episodes().map((e) => state.episode(e.id)!).find((e) => e.revises === first.episode)!
    expect(rev.outcome).toBe('accepted')
  })

  it('flags a rule that changes nothing for the reviewer', async () => {
    const flavour: Rule = { id: 'patch/rope-on-creature-nothing', host: { type: 'actor/creature' }, on: 'impulse/offered', doc: 'Nothing.', tree: { if: FIBER, then: { do: [{ op: 'log', text: 'You wave the rope about.' }] } } }
    let seen = ''
    const { model } = liveModel({ live: () => ({ patch: patchOf(flavour) }), review: (_i, m) => ((seen = m[1].content), { verdict: 'ship' }) })
    const { modder } = setup(model, undefined, 'live')
    await modder.resolve({ request: request() })
    await modder.settled()
    expect(seen).toContain('changes nothing in the world')
  })
})
