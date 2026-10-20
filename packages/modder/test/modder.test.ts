import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AddressInfo } from 'node:net'
import { Server } from 'node:http'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, holeKey, patchKey, placePatch, restoreLibrary, validatePatch, type ModRequest, type Patch, type Rule, type Scenario, type Tree, type Cond, type Effect } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { Modder, ScriptedModel, SelfState, WorldLibrary, auditOf, briefOf, relatedRules, createModderServer, freeLunch, laneOf, deriveTests, parseJson, qualifyTerrains, scriptFromFile, stationFromRules, normalizePatch, signatureOf, type ChatMessage, type ChatOptions, type Model, type Script } from '../src/index.ts'

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
 * A real ModRequest: the player holds a stone out to a creature. The act is defined (the creature is
 * offered the stone), and the creature's own nature answers only a fibrous or an edible thing
 * (`creature/offered`): a stone inherits to the root, the hole `core/offered`, the event
 * `impulse/offered`, hosted by the creature, with the stone as its item.
 */
function request(host = 'actor/creature/slime/green_slime', item = 'item/material/stone'): ModRequest {
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
  // the stone held out to it, as a stone used on it does (putting is physics: a creature does not take what is put on it)
  eng.queue({ kind: 'impulse/offered', host: { e: 'it' }, roles: { actor: { e: 'actor' }, item: { e: 'held' }, source: { e: 'held' } }, params: {}, cause: 'actor', origin: 'player' })
  const rec = port.records[0]
  expect(rec?.request).toMatchObject({ event: { kind: 'impulse/offered', host: { type: host } }, hole: { rule: 'core/offered' } })
  return rec.request
}

/** The other input: the stone USED on a dead tree (a creature would be offered it), a hole in the stone's own nature (`core/use`). */
function useRequest(host = 'fixture/nature/dead_tree'): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: 'item/material/stone', x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: host, x: 2, y: 1 },
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  expect(eng.act('use', 'actor', { e: 'it' }).defined).toBe(false)
  const rec = port.records[0]
  expect(rec.request).toMatchObject({ event: { kind: 'act/use', host: { type: 'item/material/stone' } }, hole: { rule: 'core/use' } })
  return rec.request
}

const STONY: Cond = { is: { role: 'item', sel: { tags: ['stone'] } } }
const SLIME = 'actor/creature/slime/green_slime'

/** The hole a request fell into, as a learned rule names it. */
const holeOf = (req: ModRequest): string => holeKey(req.hole.rule, req.hole.path)

/** A patch placed where a request fell undefined (host, on, hole, at from the request), as the pipeline places every draft. */
const placed = (patch: Patch, req: ModRequest): Patch => placePatch(patch, req).patch

/**
 * The creature's nature when offered something stony: it is weighed down, and the stone goes into
 * it. Anything else stays open (a learned rule never inherits: the case is asked later).
 */
function bindTree(): Tree {
  return {
    if: STONY,
    then: {
      do: [
        { op: 'addStatus', status: 'frozen', duration: 30 },
        { op: 'emit', impulse: 'taken', to: 'item', params: { into: 'contents' }, other: 'host' },
        { op: 'vfx', fx: 'dust' },
        { op: 'log', text: { en: 'You weigh {host} down with {item}.', zh: '你用{item}压住了{host}。' } },
      ],
    },
    else: { undefined: true },
  }
}

/** A learned rule is one type's own (design.md §5.16): the green slime's by default, tested on another green slime. */
function bindRule(id = 'patch/stone-stills-creature', host = SLIME, testHost = host): Rule {
  return {
    id,
    host: { type: host },
    on: 'impulse/offered',
    doc: 'A creature offered a stone is weighed down by it for a while.',
    tree: bindTree(),
    tests: [
      {
        name: 'another of its kind',
        given: {
          entities: [
            { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
            { key: 'r', type: 'item/material/stone', x: 2, y: 2, heldBy: 'actor' },
            { key: 'w', type: testHost, x: 2, y: 1 },
          ],
          // the stone held out to it (as a stone used on it does): the creature answers
          event: { kind: 'impulse/offered', host: 'w', actor: 'actor', item: 'r', source: 'r' },
        },
        expect: [{ key: 'w', hasStatus: 'frozen' }, { key: 'r', exists: true }],
      },
    ],
  }
}

const patchOf = (...rules: Rule[]): Patch => ({ note: 'stone stills', artifacts: rules.map((rule) => ({ kind: 'rule' as const, rule })) })

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
    if (opts.purpose === 'reflect') return over.reflect?.(calls.reflect, messages) ?? { lessons: { add: [{ text: 'Select a stone-like item by its stone tag, not its type.', terms: ['kind:impulse/offered', 'item#stone'] }] }, skill: null }
    calls.design++
    if (last.role === 'user') return { content: '', toolCalls: [{ id: `c${calls.design}`, name: 'search_rules', args: { on: 'impulse/offered', tag: 'stone' } }] }
    const d = drafts[Math.min(next++, drafts.length - 1)]
    return typeof d === 'string' ? d : { patch: d, summary: 'stone stills creatures' }
  }
  return { model: new ScriptedModel(script), calls }
}

/** The offline profile by default: the full loop (tools, blocking review, model-written tests). */
function setup(model?: Model, dir = mkdtempSync(join(tmpdir(), 'lsw-modder-')), profile: 'live' | 'offline' = 'offline') {
  const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
  const state = SelfState.open(join(dir, 'modder-state'))
  // these tests drive the patch pipeline (json); the repo-form agent has its own tests; the auditor too (audit.test.ts)
  state.setHarness({ ...state.harness(), audit: { ...auditOf(state.harness()), enabled: false }, reflect: { ...state.harness().reflect, batch: 4 }, offline: { ...state.harness().offline, design: { ...state.harness().offline.design, mode: 'json' } } }, 'test: json pipeline offline')
  const modder = new Modder({ library, state, model, profile })
  return { dir, library, state, modder }
}

describe('a backend signed out', () => {
  it('an expired sign-in is the backend\'s failure too: no escalation, no reflection, no calls for a while', async () => {
    let calls = 0
    const model: Model = { name: 'claude-code:signed-out', chat: async () => (calls++, Promise.reject(new Error('claude-code: Failed to authenticate: OAuth session expired and could not be refreshed'))) }
    const { modder, state } = setup(model, undefined, 'live')
    expect((await modder.resolve({ request: request() })).outcome).toBe('failed')
    await modder.settled()
    const after = calls
    expect([...state.journalOf('reflect'), ...state.journalOf('lesson.add')]).toEqual([])
    expect((await modder.resolve({ request: request('actor/creature/beast/wolf') })).outcome).toBe('unavailable')
    await modder.settled()
    expect(calls).toBe(after)
  })
})

describe('a backend out of quota', () => {
  it('is no lesson and no reason to work the request again: nothing follows, and no call goes out for a while', async () => {
    let calls = 0
    const model: Model = { name: 'claude-code:quota', chat: async () => (calls++, Promise.reject(new Error("claude-code: You've hit your session limit · resets 12:30am"))) }
    const { modder, state } = setup(model, undefined, 'live')
    const first = await modder.resolve({ request: request() })
    expect(first.outcome).toBe('failed')
    await modder.settled()
    const after = calls
    // no escalation, no reflection: the failure was the backend's
    expect([...state.journalOf('reflect'), ...state.journalOf('lesson.add')]).toEqual([])
    // and the next request gets no call at all
    const second = await modder.resolve({ request: request('actor/creature/beast/wolf') })
    expect(second.outcome).toBe('unavailable')
    await modder.settled()
    expect(calls).toBe(after)
  })
})

describe('a backend that goes out while work is queued', () => {
  it('work queued before it went out (an escalation, a reflection) is dropped, not run against it', async () => {
    const QUOTA = "claude-code: You've hit your session limit · resets 12:30am"
    let release!: () => void
    const held = new Promise<void>((r) => (release = r))
    let out = false
    let designs = 0
    let calls = 0
    const model: Model = {
      name: 'claude-code:quota-later',
      chat: async (_messages, opts) => {
        calls++
        if (out) throw new Error(QUOTA)
        // the first reflection is the one that finds the backend out, after the next request has queued its work
        if (opts?.purpose === 'reflect') {
          await held
          out = true
          throw new Error(QUOTA)
        }
        // the first request is answered; the second gets no patch (a failure that is not the backend's)
        return designs++ === 0 ? { content: JSON.stringify({ patch: patchOf(bindRule()), summary: 'stone stills' }), toolCalls: [] } : { content: 'no idea', toolCalls: [] }
      },
    }
    const { modder, state } = setup(model, undefined, 'live')
    const h = state.harness()
    state.setHarness({ ...h, review: { ...h.review, enabled: false }, reflect: { ...h.reflect, batch: 1 }, concurrency: { design: 4, background: 1 } }, 'test: one background job at a time')
    expect((await modder.resolve({ request: request() })).outcome).toBe('accepted')
    // its reflection runs (and waits on the backend); the next failure queues an escalation and a reflection behind it
    expect((await modder.resolve({ request: useRequest() })).outcome).toBe('failed')
    // (the reflection that finds it out is already counted)
    const before = calls
    release()
    await modder.settled()
    expect(calls).toBe(before)
    // the two requests' episodes, and no escalation's
    expect(state.episodes().map((e) => e.outcome)).toEqual(['accepted', 'failed'])
    expect(state.journalOf('reflect')).toEqual([])
    expect((await modder.resolve({ request: useRequest('fixture/nature/beehive') })).outcome).toBe('unavailable')
    expect(calls).toBe(before)
  })

  it('a repo episode that fails on a quota error pauses the calls and is not reflected on', { timeout: 120_000 }, async () => {
    let calls = 0
    const model: Model = { name: 'claude-code:quota', chat: async () => (calls++, Promise.reject(new Error("claude-code: You've hit your session limit · resets 12:30am"))) }
    const dir = mkdtempSync(join(tmpdir(), 'lsw-modder-'))
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const state = SelfState.open(join(dir, 'modder-state'))
    state.setHarness({ ...state.harness(), audit: { ...auditOf(state.harness()), enabled: false } }, 'test: the repo agent, no auditor')
    expect(state.harness().offline.design?.mode).toBe('repo')
    const modder = new Modder({ library, state, model, profile: 'offline' })
    const saved = process.env.LSW_ISOLATION
    process.env.LSW_ISOLATION = 'none'
    try {
      expect((await modder.resolve({ request: request() })).outcome).toBe('failed')
      await modder.settled()
      expect(calls).toBe(1)
      expect(state.journalOf('reflect')).toEqual([])
      expect((await modder.resolve({ request: request('actor/creature/beast/wolf') })).outcome).toBe('unavailable')
      await modder.settled()
      expect(calls).toBe(1)
    } finally {
      if (saved === undefined) delete process.env.LSW_ISOLATION
      else process.env.LSW_ISOLATION = saved
    }
  })
})

describe('the modder pipeline', () => {
  it('designs with tools, validates, commits to the shared library and records the episode', async () => {
    const { model, calls } = scripted([patchOf(bindRule())])
    const { modder, library, state, dir } = setup(model)
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    expect(reply.patch?.artifacts[0]).toMatchObject({ kind: 'rule', rule: { id: 'patch/stone-stills-creature' } })
    expect(library.lib.rules.get('patch/stone-stills-creature')?.source?.author).toBe('modder')
    expect(calls.review).toBe(1)

    // the log is append-only and rebuilds the same library
    const again = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(again.lib.rules.has('patch/stone-stills-creature')).toBe(true)
    expect(again.asked).toHaveLength(1)

    const ep = state.episode(reply.episode!)!
    expect(ep.outcome).toBe('accepted')
    expect(ep.tools.map((t) => t.name)).toEqual(['search_rules'])
    expect(ep.attempts).toHaveLength(1)
    expect(ep.usage.calls).toBe(3) // tool turn, answer, review

    await modder.settled()
    const lessons = state.lessons()
    expect(lessons).toHaveLength(1)
    expect(lessons[0].episodes).toEqual([ep.id])
    expect(readFileSync(join(state.dir, 'memory/lessons.md'), 'utf8')).toContain('stone tag')
    expect(readFileSync(join(state.dir, 'journal.jsonl'), 'utf8')).toMatch(/"kind":"lesson.add"/)
  })

  it('feeds the validator\'s diagnostics back and repairs', async () => {
    const bad = bindRule()
    bad.tree = { if: STONY, then: { do: [{ op: 'addStatus', status: 'hogtied' }] } }
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
    bad.tree = { if: STONY, then: { do: [{ op: 'addStatus', status: 'hogtied' }] } }
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
    // the same type at the same hole again (another green slime): the learned rule is its type's own
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('covered')
    expect(reply.patch?.artifacts[0]).toMatchObject({ rule: { id: 'patch/stone-stills-creature' } })
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
    expect((await offline.modder.resolve({ request: request() })).outcome).toBe('covered')
    // the open case of the learned tree (not fibrous), and another type's hole: nothing answers them
    expect((await offline.modder.resolve({ request: request(SLIME, 'item/tool/shovel') })).outcome).toBe('unavailable')
    expect((await offline.modder.resolve({ request: request('actor/creature/slime/fire_slime') })).outcome).toBe('unavailable')
  })

  it('revises after a reviewer\'s notes', async () => {
    const narrow = bindRule('patch/stone-stills-slime')
    const { model, calls } = scripted([patchOf(narrow), patchOf(bindRule())], {
      review: (n) => (n === 0 ? { verdict: 'revise', notes: ['Say what the stone does: it should go into the creature.'] } : { verdict: 'ship', notes: [] }),
    })
    const { modder, state, library } = setup(model)
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    const ep = state.episode(reply.episode!)!
    expect(ep.attempts.map((a) => [a.phase, a.review?.verdict])).toEqual([
      ['design', 'revise'],
      ['review', 'ship'],
    ])
    expect(calls.review).toBe(2) // the harness allows one revision; the revision is reviewed before it ships
    expect(library.lib.rules.has('patch/stone-stills-creature')).toBe(true)
    expect(library.lib.rules.has('patch/stone-stills-slime')).toBe(false)
  })

  it('writes a skill once work recurs, offers it, and books its outcomes', async () => {
    const skill = { name: 'Still with stone', description: 'Weighing things down with stone-like items.', triggers: ['item#stone'], body: '1. Host the rule on the creature\'s own type; select the item by the stone tag.\n2. Freeze the host for a while; take the stone into it (emit taken to the item).' }
    let reads = 0
    const calls = { design: 0 }
    const model = new ScriptedModel((messages, opts) => {
      const last = messages[messages.length - 1]
      if (opts.purpose === 'review') return { verdict: 'ship' }
      if (opts.purpose === 'reflect') return { lessons: {}, skill }
      calls.design++
      const user = messages.find((m, i) => i > 0 && m.role === 'user')!.content
      if (last.role === 'user' && user.includes('- still-with-stone:')) return { content: '', toolCalls: [{ id: `r${++reads}`, name: 'read_skill', args: { name: 'still-with-stone' } }] }
      // write the rule for the host's own type (a learned rule is one type's)
      const type = /"host":\{"role":"host"[^}]*?"type":"([^"]+)"/.exec(user)![1]
      return { patch: patchOf(bindRule(`patch/stone-stills-${type.split('/').pop()}`, type)) }
    })
    const { modder, state } = setup(model)
    state.setHarness({ ...state.harness(), reflect: { enabled: true, skillMinRecurrence: 1 } }, 'test: skills after one similar episode')

    await modder.resolve({ request: request() })
    await modder.settled()
    expect(state.skills()).toHaveLength(0) // nothing similar before: no skill yet

    await modder.resolve({ request: request('actor/creature/beast/wolf') })
    await modder.settled()
    expect(state.skills().map((s) => s.name)).toEqual(['still-with-stone'])
    expect(readFileSync(join(state.dir, 'skills/still-with-stone/SKILL.md'), 'utf8')).toMatch(/^---\nname: still-with-stone/)

    const third = await modder.resolve({ request: request('actor/creature/beast/wolf', 'item/material/stone') })
    // the wolf's rule covers the next wolf; a new type then: another kind of creature, the same stone
    expect(third.outcome).toBe('covered')
    const golem = Object.keys(onto.types).find((t) => t.startsWith('actor/creature/') && !t.startsWith('actor/creature/slime') && !t.startsWith('actor/creature/beast') && !Object.keys(onto.types).some((o) => o.startsWith(t + '/')))!
    const r4 = await modder.resolve({ request: request(golem) })
    expect(state.episode(r4.episode!)!.skillsRead).toEqual(['still-with-stone'])
    expect(state.skill('still-with-stone')).toMatchObject({ uses: 1, accepted: 1 })
    await modder.settled()
    expect(state.skill('still-with-stone')!.version).toBe(2) // revised by name after use
  })

  it('snapshots the self-state and renders it as one transferable document', async () => {
    const { model } = scripted([patchOf(bindRule())])
    const { modder, state } = setup(model)
    await modder.resolve({ request: request() })
    await modder.settled()
    const to = state.snapshot('checkpoint-1')
    expect(existsSync(join(to, 'memory/lessons.json'))).toBe(true)
    expect(JSON.parse(readFileSync(join(to, 'meta.json'), 'utf8')).stats.accepted).toBe(1)
    expect(readFileSync(join(to, 'SELF.md'), 'utf8')).toContain('stone tag')
    expect(() => state.snapshot('checkpoint-1')).toThrow(/exists/)
  })

  it('files requests of one class of outcome under one key', () => {
    expect(signatureOf(request()).key).toBe(signatureOf(request()).key)
    expect(signatureOf(request()).key).not.toBe(signatureOf(request('actor/creature/beast/wolf')).key)
    expect(signatureOf(request()).key).not.toBe(signatureOf(request(undefined, 'item/tool/shovel')).key)
    expect(signatureOf(request()).terms).toEqual(expect.arrayContaining(['kind:impulse/offered', 'hole:core/offered', 'host:actor/creature/slime', 'item#stone']))
  })
})

describe('the Mod port with the modder plugged in', () => {
  it('a game engine raises, the modder patches, the held event re-resolves', async () => {
    const { model } = scripted([patchOf(bindRule())])
    const { modder } = setup(model)
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'stone', type: 'item/material/stone', x: 2, y: 2, heldBy: 'actor' },
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
    eng.queue({ kind: 'impulse/offered', host: { e: 'slime' }, roles: { actor: { e: 'actor' }, item: { e: 'stone' }, source: { e: 'stone' } }, params: {}, cause: 'actor', origin: 'player' })
    // while the outcome waits, its participants are held — the one who started the chain too
    expect(port.records[0]).toMatchObject({ status: 'pending', request: { event: { kind: 'impulse/offered' } } })
    expect(eng.world.get('slime')!.frozenBy).toBe(port.records[0].id)
    expect(eng.world.get('actor')!.frozenBy).toBe(port.records[0].id)
    await finished
    expect(eng.world.hasStatus({ e: 'slime' }, 'frozen')).toBe(true)
    expect(eng.world.get('stone')?.place).toEqual({ on: 'inside', holder: 'slime' })
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
      expect(log.entries[0].rules).toEqual(['patch/stone-stills-creature'])
      // each patch comes with the scene it answered: a client replays it there before it takes it
      expect(log.entries[0].scenario?.event).toMatchObject({ kind: 'impulse/offered' })
      expect((await (await fetch(`${base}/patches?since=1`)).json()).entries).toEqual([])
    } finally {
      server.close()
    }
  })
})

describe('the offline script (fixtures/offline.json, for `serve --script`)', () => {
  it('answers a stone held out to a creature and a stone used on a dead tree, live, each at its own hole; the same event again is covered', async () => {
    const model = scriptFromFile(fileURLToPath(new URL('../fixtures/offline.json', import.meta.url)))
    const ids = (p: Patch | null | undefined) => p?.artifacts.map((a) => (a.kind === 'rule' ? a.rule.id : a.kind))
    for (const first of ['put', 'use'] as const) {
      const { modder } = setup(model, undefined, 'live')
      const reply = await modder.resolve({ request: first === 'put' ? request() : useRequest() })
      expect(reply.outcome).toBe('accepted')
      expect(ids(reply.patch)).toEqual([first === 'put' ? 'patch/stone-weighs-creature' : 'patch/stone-knocks-dead-tree'])
      // the other input falls into another hole (the stone's, or the creature's): its own answer
      const other = await modder.resolve({ request: first === 'put' ? useRequest() : request() })
      expect(other.outcome).toBe('accepted')
      expect(ids(other.patch)).toEqual([first === 'put' ? 'patch/stone-knocks-dead-tree' : 'patch/stone-weighs-creature'])
      expect((await modder.resolve({ request: first === 'put' ? request() : useRequest() })).outcome).toBe('covered')
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
        else if (last.role === 'user') message = { content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_type', arguments: '{"id":"item/material/stone"}' } }] }
        else message = { content: '```json\n' + JSON.stringify({ patch: patchOf(bindRule()) }) + '\n```' }
        // (a connection a call, never kept: under a full parallel run a kept one can be closed by the server as the
        // client takes it up again, and the call fails for nothing the test is about)
        res.writeHead(200, { 'Content-Type': 'application/json', Connection: 'close' })
        res.end(JSON.stringify({ choices: [{ message }], usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.0005 } }))
      })
    }).listen(0)
    await listening(server)
    try {
      const { OpenAICompatModel } = await import('@openworld/agent')
      const model = new OpenAICompatModel({ baseUrl: `http://localhost:${(server.address() as AddressInfo).port}/v1`, apiKey: 'test', model: 'mock-1' })
      const { modder, state } = setup(model)
      const reply = await modder.resolve({ request: request() })
      expect(reply.outcome).toBe('accepted')
      // the tool call went out with its schema, and its result came back as a tool message
      expect((bodies[0].tools as { function: { name: string } }[]).map((t) => t.function.name)).toContain('dry_run')
      const second = bodies[1].messages as { role: string; tool_call_id?: string; content: string }[]
      expect(second.at(-2)).toMatchObject({ role: 'assistant' })
      expect(second.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'call_1' })
      expect(second.at(-1)!.content).toContain('stone')
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
    hole: holeOf(useRequest()), // the hole a tool used on something falls into (a placed rule names its hole)
    doc: 'A club worked on a workbench comes apart into logs.',
    tree: { if: { is: { role: 'target', sel: { type: 'fixture/craft/workbench' } } }, then: { do: [{ op: 'transform', into: 'item/material/log' }, ...(logs > 1 ? [{ op: 'spawn', type: 'item/material/log', at: 'host', count: logs - 1 } as Effect] : [])] }, else: { undefined: true } },
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
  it('rejects a catch-all that would answer for anything at all, and a class: a learned rule is one type\'s own', () => {
    const { library } = setup()
    const req = request()
    const catchAll: Rule = { id: 'patch/offered-nothing', on: 'impulse/offered', hole: holeOf(req), tree: { do: [{ op: 'log', text: 'Nothing happens.' }] } }
    expect(library.validate(patchOf(catchAll), req).errors.join()).toMatch(/host must be exactly \{type/)
    // the class the host belongs to is not its place either
    const cls: Rule = { ...catchAll, id: 'patch/creature-offered-nothing', host: { type: 'actor/creature' } }
    expect(library.validate(patchOf(cls), req).errors.join()).toMatch(/the host of the triggering event is a actor\/creature\/slime\/green_slime, not a actor\/creature/)
    // the host's own type is
    const own: Rule = { ...catchAll, id: 'patch/green-slime-offered-nothing', host: { type: SLIME } }
    expect(library.validate(patchOf(own), req).ok).toBe(true)
  })

  it('holds a patch to the event model: host-only effects, open cases but never inherit, not the earlier shape, the event that asked', () => {
    const { library } = setup()
    const req = request()
    const of = { ...bindRule(), tree: { if: STONY, then: { do: [{ op: 'addStatus', of: 'item', status: 'wet' }] }, else: { undefined: true } } } as unknown as Rule
    expect(library.validate(placed(patchOf(of), req), req).errors.join()).toMatch(/effects act on the host only/)
    // a case the rule does not answer stays open ({"undefined": true}); `inherit` is the base rules' word
    const inherits: Rule = { ...bindRule(), hole: holeOf(req), tree: { if: STONY, then: { do: [{ op: 'vfx', fx: 'dust' }] }, else: 'inherit' } }
    expect(library.validate(patchOf(inherits), req).errors.join()).toMatch(/never inherits/)
    expect(library.validate(placed(patchOf(bindRule()), req), req).ok).toBe(true)
    // an open leaf answers nothing: a rule with no {do} leaf is no rule
    const open: Rule = { ...bindRule(), hole: holeOf(req), tree: { if: STONY, then: { undefined: true }, else: { undefined: true } } }
    expect(library.validate(patchOf(open), req).errors.join()).toMatch(/no leaf answers/)
    const old = { id: 'patch/stone-stills', on: 'interaction', when: { verb: ['interact'] }, do: [{ op: 'addStatus', of: 'target', status: 'frozen' }] } as unknown as Rule
    expect(library.validate(patchOf(old), req).errors.join()).toMatch(/earlier rule shape/)
    // a rule that does not answer the event that asked is no answer
    const elsewhere: Rule = { ...bindRule(), hole: holeOf(req), on: 'impulse/handle' }
    expect(library.validate(patchOf(elsewhere), req).errors.join()).toMatch(/the triggering event is impulse\/offered, not impulse\/handle/)
    const otherHole: Rule = { ...bindRule(), hole: 'core/handle' }
    expect(library.validate(patchOf(otherHole), req).errors.join()).toMatch(/falls undefined at "core\/offered", not "core\/handle"/)
  })

  it('refuses a second answer at a leaf already answered, and takes one at the open leaf of the first', () => {
    const { library } = setup()
    const req = request()
    const a = placed(patchOf(bindRule('patch/a')), req)
    expect(library.commit(a, req).ok).toBe(true)
    // the type's tree at this hole is the first answer; a later answer replaces one of its open leaves
    const key = patchKey(SLIME, 'impulse/offered', holeOf(req))
    expect(library.lib.tree(key)).toEqual(bindTree())
    expect(laneOf(req)).toBe(key)
    const b = (at: string[]): Patch => patchOf({ ...bindRule('patch/b'), hole: holeOf(req), at, doc: 'the same case, said again', tests: undefined })
    expect(library.validate(b([JSON.stringify(STONY)])).errors.join()).toMatch(/already answered/)
    expect(library.validate(b([])).errors.join()).toMatch(/leads nowhere/)
    expect(library.validate(b([`!${JSON.stringify(STONY)}`])).ok).toBe(true)
    // the scene that asked is answered now: there is nothing left to answer there
    expect(library.validate(b([`!${JSON.stringify(STONY)}`]), req).errors.join()).toMatch(/already defined by "patch\/a"/)
  })

  it('reports an unproven chance assignment bound in the library audit', () => {
    const { library } = setup()
    const req = useRequest()
    const rule: Rule = { id: 'patch/audit-chances', host: { type: 'item/material/stone' }, on: 'act/use', hole: holeOf(req), tree: {
      if: { all: Array.from({ length: 7 }, () => ({ any: [{ chance: 0.5 }, { chance: 1 }] })) }, then: { do: [] }, else: { do: [] },
    } }
    library.lib.add({ ...rule, source: { origin: 'patch' } })
    library.asked.push({ scenario: req.scenario, rule: rule.id })
    expect(library.audit()).toEqual([{ rule: rule.id, reason: expect.stringMatching(/repeat check.*64.*safety/) }])
  })

  it('commits to the shared log only what stands on the shared library alone', async () => {
    const glow: Rule = { ...bindRule('patch/stone-glows'), tree: { if: STONY, then: { do: [{ op: 'addStatus', status: 'glowing', duration: 30 }] }, else: { undefined: true } }, tests: [] }
    const status = { id: 'glowing', name: { en: 'Glowing', zh: '发光' }, duration: 30 }
    // the first draft leans on a status only this client has (a local patch of its own); the repair carries it
    const { model, calls } = scripted([patchOf(glow), { artifacts: [{ kind: 'status', status }, { kind: 'rule', rule: glow }] }])
    const { modder, library } = setup(model)
    const ws = { patches: { rules: [], statuses: [status] } }
    expect(library.validate(placed(patchOf(glow), request()), request(), ws).ok).toBe(true)
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
    const newer: Rule = { ...bindRule('creature/offered-stone'), source: { origin: 'base' } }
    const library = new WorldLibrary(onto, [...BASE, newer], join(dir, 'library.jsonl'))
    const state = SelfState.open(join(dir, 'modder-state'))
    state.setHarness({ ...state.harness(), audit: { ...auditOf(state.harness()), enabled: false } }, 'test: no auditor')
    const modder = new Modder({ library, state, model })
    const reply = await modder.resolve({ request: request() })
    expect(reply).toMatchObject({ patch: null, outcome: 'failed' })
    expect(reply.diagnostics?.join()).toMatch(/creature\/offered-stone/)
    expect(calls.design).toBe(0)
  })
})

describe('deterministic repairs', () => {
  it('accepts a correct rule in the wrong wrapper without another model turn', async () => {
    const rule = bindRule()
    const { tree: _t, ...bare } = rule
    // a rule written in the flat form: its condition and effects beside the rule, not in a tree
    const flat = { ...bare, if: STONY, do: (bindTree() as { then: { do: unknown[] } }).then.do }
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
      expect(library.lib.rules.get('patch/stone-stills-creature')!.tree).toEqual(bindTree())
    }
  })

  it('reads a rule the model wrote without its place (no on, no host) as a rule, bare or flattened beside its kind', () => {
    // 2026-10-10, Opus 5.5 low (frostcap used on oneself): the harness sets host and on now, so the model leaves them out
    const tree = { if: { same: ['actor', 'target'] }, then: { do: [{ op: 'destroy' }] }, else: { undefined: true } }
    const bare = normalizePatch({ patch: { artifacts: [{ id: 'patch/frostcap-eaten-raw', doc: 'd', tree }] } })
    expect(bare.patch!.artifacts).toEqual([{ kind: 'rule', rule: { id: 'patch/frostcap-eaten-raw', doc: 'd', tree } }])
    const flat = normalizePatch({ patch: { artifacts: [{ kind: 'rule', id: 'patch/frostcap-eaten-raw', doc: 'd', tree }] } })
    expect(flat.patch!.artifacts).toEqual([{ kind: 'rule', rule: { id: 'patch/frostcap-eaten-raw', doc: 'd', tree } }])
    expect(flat.fixes.join()).toMatch(/wrapped rule/)
    // a type is not taken for a rule
    const type = normalizePatch({ patch: { artifacts: [{ kind: 'type', id: 'item/material/x', name: { en: 'X', zh: 'X' } }] } })
    expect(type.patch!.artifacts[0]).toMatchObject({ kind: 'type', type: { id: 'item/material/x' } })
  })

  it('reads the station of a new thing off the branch that makes it on a workbench', () => {
    const strips = { id: 'item/material/leather_strips', name: { en: 'Leather Strips', zh: '皮条' }, tags: ['fiber'], props: { material: 'leather' }, makeup: [{ type: 'item/material/leather', count: 1 }] }
    const onWorkbench: Rule = { id: 'patch/leather-strips', host: { type: 'item/material/leather' }, on: 'act/use', doc: 'd', tree: { if: { is: { role: 'target', sel: { type: 'fixture/craft/workbench' } } }, then: { do: [{ op: 'transform', into: strips.id }] }, else: { undefined: true } } }
    const made = (rule: Rule, type: object = strips) => stationFromRules({ artifacts: [{ kind: 'type', type: type as never }, { kind: 'rule', rule }] }, onto)
    const { patch, fixes } = made(onWorkbench)
    expect((patch.artifacts[0] as { type: { station?: string } }).type.station).toBe('workbench')
    expect(fixes).toHaveLength(1)
    // made two at a time by the rule: the recipe makes two (yields), whether or not the designer named the station
    const two: Rule = { ...onWorkbench, tree: { if: { is: { role: 'target', sel: { type: 'fixture/craft/workbench' } } }, then: { do: [{ op: 'spawn', type: strips.id, at: 'target', count: 2 }, { op: 'destroy' }] }, else: { undefined: true } } }
    expect((made(two).patch.artifacts[0] as { type: { yields?: number; station?: string } }).type).toMatchObject({ station: 'workbench', yields: 2 })
    expect((made(two, { ...strips, station: 'workbench' }).patch.artifacts[0] as { type: { yields?: number } }).type.yields).toBe(2)
    // made in a cauldron (no station), or said already: left alone
    expect(made({ ...onWorkbench, tree: { if: { is: { role: 'target', sel: { type: 'fixture/craft/cauldron' } } }, then: { do: [{ op: 'transform', into: strips.id }] }, else: { undefined: true } } }).fixes).toEqual([])
    expect(made(onWorkbench, { ...strips, station: 'hands' }).fixes).toEqual([])
    // the shop's stall is a station of buying, not of making
    expect(made({ ...onWorkbench, tree: { if: { is: { role: 'target', sel: { type: 'fixture/furniture/stall/trade' } } }, then: { do: [{ op: 'transform', into: strips.id }] }, else: { undefined: true } } }).fixes).toEqual([])
  })

  it('a thing a rule makes only with a tool or at a place is not made by hand without them: the tool joins the recipe, a place drops it', () => {
    const flour = { id: 'item/material/flour', name: { en: 'Flour', zh: '面粉' }, tags: ['powder'], props: { material: 'plant' }, makeup: [{ type: 'item/material/wheat', count: 1 }], station: 'hands' }
    const on = (target: string): Rule => ({ id: 'patch/wheat-ground', host: { type: 'item/material/wheat' }, on: 'act/use', doc: 'd', tree: { if: { is: { role: 'target', sel: { type: target } } }, then: { do: [{ op: 'transform', into: flour.id }] }, else: { undefined: true } } })
    const made = (rule: Rule) => stationFromRules({ artifacts: [{ kind: 'type', type: flour as never }, { kind: 'rule', rule }] }, onto)
    const type = (r: ReturnType<typeof made>) => (r.patch.artifacts[0] as { type: { station?: string; tools?: string[] } }).type
    // ground on a stone: by hand, with a stone carried
    const stone = made(on('item/material/stone'))
    expect(type(stone)).toMatchObject({ station: 'hands', tools: ['stone'] })
    expect(stone.fixes.join()).toMatch(/stone/)
    // cut with a knife: its tool tag
    expect(type(made(on('item/tool/knife')))).toMatchObject({ station: 'hands', tools: ['tool:knife'] })
    // stirred in a cauldron (a place, not carried): no recipe by hand
    expect(type(made(on('fixture/craft/cauldron'))).station).toBeUndefined()
    // made of what it is used on (a feather on a stick, both in its makeup): by hand as it says
    const arrow = { ...flour, id: 'item/material/arrow', makeup: [{ type: 'item/material/stick', count: 1 }, { type: 'item/material/feather', count: 1 }] }
    const fletch: Rule = { id: 'patch/fletch', host: { type: 'item/material/feather' }, on: 'act/use', doc: 'd', tree: { if: { is: { role: 'target', sel: { type: 'item/material/stick' } } }, then: { do: [{ op: 'transform', into: arrow.id }] }, else: { undefined: true } } }
    const a = stationFromRules({ artifacts: [{ kind: 'type', type: arrow as never }, { kind: 'rule', rule: fletch }] }, onto)
    expect((a.patch.artifacts[0] as { type: { station?: string; tools?: string[] } }).type).toMatchObject({ station: 'hands' })
    expect((a.patch.artifacts[0] as { type: { tools?: string[] } }).type.tools).toBeUndefined()
  })

  it('makes a fixture it gives a station portable: made into the hand, it can be set down', () => {
    const stool = { id: 'fixture/furniture/stool', name: { en: 'Stool', zh: '凳子' }, tags: ['wooden'], props: { material: 'wood' }, makeup: [{ type: 'item/material/plank', count: 1 }] }
    const rule: Rule = { id: 'patch/plank-stool', host: { type: 'item/material/plank' }, on: 'act/use', doc: 'd', tree: { if: { is: { role: 'target', sel: { type: 'fixture/craft/workbench' } } }, then: { do: [{ op: 'transform', into: stool.id }] }, else: { undefined: true } } }
    const { patch, fixes } = stationFromRules({ artifacts: [{ kind: 'type', type: stool as never }, { kind: 'rule', rule }] }, onto)
    expect((patch.artifacts[0] as { type: { station?: string; tags?: string[] } }).type).toMatchObject({ station: 'workbench', tags: ['wooden', 'portable'] })
    expect(fixes.join()).toMatch(/portable/)
    expect(validatePatch(patch, { ontology: onto, library: new RuleLibrary(BASE) }).errors.join()).not.toMatch(/portable/)
    // a station the designer named, with its yields too: made portable all the same
    const named = stationFromRules({ artifacts: [{ kind: 'type', type: { ...stool, station: 'workbench', yields: 2 } as never }, { kind: 'rule', rule }] }, onto)
    expect((named.patch.artifacts[0] as { type: { tags?: string[] } }).type.tags).toContain('portable')
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

  it('places a rule written for a class, a branch of kinds or with inherit where the request fell undefined, without another model turn', async () => {
    const req = request()
    // the old way: the creature class, the whole impulse branch, the other cases left to inherit
    const p = patchOf({ ...bindRule(), host: { type: 'actor/creature', notStatus: ['frozen'] }, on: 'impulse', tree: { if: STONY, then: (bindTree() as { then: Tree }).then } })
    const { patch, fixes } = placePatch(p, req)
    const r = (patch.artifacts[0] as { rule: Rule }).rule
    expect(r).toMatchObject({ host: { type: SLIME }, on: 'impulse/offered', hole: 'core/offered', at: [] })
    expect(r.tree).toEqual(bindTree())
    expect(fixes.join('\n')).toMatch(/host set to \{type: "actor\/creature\/slime\/green_slime"\} \(was \{"type":"actor\/creature","notStatus":\["frozen"\]\}\)/)
    expect(fixes.join('\n')).toMatch(/on set to impulse\/offered \(was impulse\)/)
    expect(fixes.join('\n')).toMatch(/inherit leaf left open/)
    // a rule already in its place is left alone
    expect(placePatch(patch, req).fixes).toEqual([])

    // in the pipeline: placed, validated and committed in the type's own tree
    const { model, calls } = scripted([p])
    const { modder, state, library } = setup(model)
    const reply = await modder.resolve({ request: req })
    expect(reply.outcome).toBe('accepted')
    expect(state.episode(reply.episode!)!.attempts[0].fixes?.join()).toMatch(/on set to impulse\/offered/)
    expect(library.lib.rules.get('patch/stone-stills-creature')).toMatchObject({ host: { type: SLIME }, on: 'impulse/offered', hole: 'core/offered' })
    expect(library.lib.tree(laneOf(req))).toEqual(bindTree())
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
        // (a connection a call: see the adapter's test above)
        res.setHeader('Connection', 'close')
        handler(n++, body, res)
      })
    }).listen(0)
    await listening(server)
    const { OpenAICompatModel } = await import('@openworld/agent')
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
  /** A creature offered a stone leaves something behind: the router's answers are scripted by what each call shows. */
  // (once, then not for a while: a yield costs its host — the repeat check, world-model.md §8.4)
  const leaves = (type: string): Rule => ({ id: 'patch/stone-on-creature-leaves', host: { type: 'actor/creature' }, on: 'impulse/offered', doc: `A creature offered a stone leaves ${type} behind, and not again for a while.`, tree: { if: { all: [STONY, { not: { has: { role: 'host', status: 'stirred' } } }] }, then: { do: [{ op: 'spawn', type, at: 'host' }, { op: 'addStatus', status: 'stirred' }, { op: 'log', text: { en: 'Something drops.', zh: '掉下了东西。' } }] } } })
  const INGOT_TYPE = { id: 'item/material/steel_ingot', name: { en: 'Steel Ingot', zh: '钢锭' }, tags: ['metal'], props: { material: 'iron' }, makeup: [{ type: 'item/material/iron_ore', count: 1 }] }

  function router(o: { local: unknown; find?: unknown; create?: unknown; art?: (n: number) => unknown; onArt?: () => void; onCreate?: () => void }) {
    const seen: { purpose?: string; system: string; last: string }[] = []
    let arts = 0
    const model = new ScriptedModel((messages, opts) => {
      const last = messages[messages.length - 1].content
      seen.push({ purpose: opts.purpose, system: messages[0].content, last })
      if (opts.purpose === 'review') return { verdict: 'ship' }
      if (opts.purpose === 'reflect') return {}
      if (opts.purpose === 'art') return (o.onArt?.(), o.art?.(arts++) ?? INGOT_ART) as object
      if (last.startsWith('# Create')) return (o.onCreate?.(), o.create) as object
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

  it('goes through the catalogue before creating: a thing the world has under another name is found, not made again', async () => {
    const { model, seen } = router({ local: { create: [{ id: 'item/material/sticks', name: { en: 'Sticks', zh: '一捆木棍' }, why: 'what it leaves behind' }] }, find: { patch: patchOf(leaves('item/material/stick')) } })
    const { modder, state, library } = setup(model, undefined, 'live')
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    expect(state.episode(reply.episode!)!.route).toEqual(['local', 'find'])
    expect(seen.find((c) => c.last.startsWith('# What you asked for'))!.last).toMatch(/"Sticks".*item\/material\/stick/)
    expect(library.lib.types).toEqual([])
  })

  it('a draft that makes a thing the world has no type for goes to create, not to a repair that swaps it for a known one', async () => {
    const req = request()
    let during: unknown
    const { model, seen } = router({
      // the designer writes the spawn at once, as if the thing existed (a recalled episode named it)
      local: { patch: { artifacts: [{ kind: 'rule', rule: leaves('item/material/steel_ingot') }] } },
      create: { patch: { artifacts: [{ kind: 'type', type: INGOT_TYPE }, { kind: 'rule', rule: leaves('item/material/steel_ingot') }] } },
      onCreate: () => (during = modder.progressOf(req.id)),
    })
    const { modder, state, library } = setup(model, undefined, 'live')
    const reply = await modder.resolve({ request: req })
    expect(reply.outcome).toBe('accepted')
    expect(state.episode(reply.episode!)).toMatchObject({ route: ['local', 'create'], created: ['item/material/steel_ingot'] })
    expect(seen.find((x) => x.last.startsWith('# Create'))?.last).toContain('item/material/steel_ingot (Steel Ingot)')
    // the player is told what is being made in either language: the id's words stand for the Chinese name it has not got yet
    expect(during).toEqual({ stage: 'create', creating: [{ en: 'Steel Ingot', zh: 'Steel Ingot' }] })
    expect(library.lib.types.map((t) => t.id)).toContain('item/material/steel_ingot')
  })

  it('takes a slip of a known id for a slip, and a malformed draft for the repair, not for a creation or a crash', async () => {
    const { unknownMade } = await import('../src/pipeline.ts')
    const spawning = (type: unknown) => ({ artifacts: [{ kind: 'rule' as const, rule: { ...leaves('x'), tree: { if: STONY, then: { do: [{ op: 'spawn', type, at: 'host' }] } } } as never }] })
    expect(unknownMade(spawning('item/material/steel_ingot'), onto).map((c) => c.id)).toEqual(['item/material/steel_ingot'])
    expect(unknownMade(spawning('item/food/berrie'), onto)).toEqual([])
    expect(unknownMade({ artifacts: [{ kind: 'rule', rule: { ...leaves('x'), tree: { do: { op: 'spawn' } } } as never }] }, onto)).toEqual([])
    expect(unknownMade({ artifacts: [{ kind: 'rule', rule: { ...leaves('x'), tree: { do: [null] } } as never }] }, onto)).toEqual([])
    expect(stationFromRules({ artifacts: [{ kind: 'type' } as never, { kind: 'rule', rule: { ...leaves('x'), tree: { if: null, then: { do: [null] } } } as never }] }, onto).fixes).toEqual([])
  })

  it('does not design for a thing only the asking client knows (its own kind, or one its save kept): no answer could be shared', async () => {
    let calls = 0
    const model: Model = { name: 'scripted:counting', chat: async () => (calls++, { content: '{}' }) as never }
    const { modder } = setup(model, undefined, 'live')
    const req = request()
    const local = { id: 'item/clothing/wool_scarf', name: { en: 'Wool Scarf', zh: '羊毛围巾' }, tags: ['wearable'], props: { material: 'cloth', slot: 'neck' }, makeup: [{ type: 'item/material/wool', count: 1 }] }
    req.event.host = { ...req.event.host, type: local.id } as never
    const reply = await modder.resolve({ request: req, workspace: { patches: { rules: [], types: [local as never], statuses: [] } } })
    expect(reply.outcome).toBe('failed')
    expect(reply.diagnostics?.join()).toMatch(/known only to this client/)
    expect(calls).toBe(0)
  })

  it('draws a new creature too, but leaves it its kind\'s look: a picture is no animated sheet', async () => {
    const { model } = router({ local: {} })
    const { modder } = setup(model, undefined, 'live')
    const drawn = (await (modder as unknown as { drawAll: (m: Model, p: Patch, c: unknown[]) => Promise<Patch> }).drawAll(model, {
      artifacts: [{ kind: 'type', type: { id: 'actor/creature/beast/wolf/ash_wolf', name: { en: 'Ash Wolf', zh: '灰狼' } } as never }, { kind: 'type', type: { id: 'item/material/ash_fur', name: { en: 'Ash Fur', zh: '灰毛' } } as never }],
    }, [])).artifacts.map((a) => (a.kind === 'type' ? a.type : undefined))
    expect(drawn[0]).toMatchObject({ art: INGOT_ART })
    expect(drawn[0]?.sprite).toBeUndefined()
    expect(drawn[1]).toMatchObject({ art: INGOT_ART, sprite: 'art:item/material/ash_fur' })
  })

  it('draws a new thing while its rules are written: the picture is begun as soon as the thing is named', async () => {
    const at: Record<string, number> = {}
    const t0 = Date.now()
    const slow = async <T,>(key: string, f: () => Promise<T>): Promise<T> => {
      at[`${key}:start`] = Date.now() - t0
      await new Promise((r) => setTimeout(r, 200))
      const v = await f()
      at[`${key}:end`] = Date.now() - t0
      return v
    }
    const { model } = router({
      local: { need: [{ name: 'steel ingot' }] },
      find: { create: [{ id: 'item/material/steel_ingot', name: { en: 'Steel Ingot', zh: '钢锭' }, why: 'smelted steel' }] },
      create: { patch: { artifacts: [{ kind: 'type', type: INGOT_TYPE }, { kind: 'rule', rule: leaves('item/material/steel_ingot') }] } },
    })
    const wrapped: Model = { name: model.name, chat: (m, o) => (o?.purpose === 'art' ? slow('art', () => model.chat(m, o)) : m[m.length - 1].content.startsWith('# Create') ? slow('create', () => model.chat(m, o)) : model.chat(m, o)) }
    const { modder, library } = setup(wrapped, undefined, 'live')
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    // the picture was begun before the rules came back, and the two took the time of one
    expect(at['art:start']).toBeLessThan(at['create:end'])
    expect(at['art:end'] - at['create:start']).toBeLessThan(350)
    expect(library.lib.types.find((x) => x.id === 'item/material/steel_ingot')).toMatchObject({ art: INGOT_ART, sprite: 'art:item/material/steel_ingot' })
  })

  it('creates what the world does not have, with its picture, and says so while it works', async () => {
    let during: unknown
    const req = request()
    const { model } = router({
      local: { need: [{ name: 'steel ingot' }] },
      find: { create: [{ id: 'item/material/steel_ingot', name: { en: 'Steel Ingot', zh: '钢锭' }, why: 'smelted steel' }] },
      create: { patch: { artifacts: [{ kind: 'type', type: INGOT_TYPE }, { kind: 'rule', rule: leaves('item/material/steel_ingot') }] } },
      onArt: () => (during = modder.progressOf(req.id)),
    })
    const { modder, state, library } = setup(model, undefined, 'live')
    const reply = await modder.resolve({ request: req })
    expect(reply.outcome).toBe('accepted')
    // the picture is begun as soon as the thing is named, while its rules are written
    expect(during).toEqual({ stage: 'create', creating: [{ en: 'Steel Ingot', zh: '钢锭' }] })
    expect(modder.progressOf(req.id)).toBeUndefined()
    expect(state.episode(reply.episode!)).toMatchObject({ route: ['local', 'find', 'create'], created: ['item/material/steel_ingot'] })
    const t = library.lib.types.find((x) => x.id === 'item/material/steel_ingot')!
    expect(t).toMatchObject({ sprite: 'art:item/material/steel_ingot', art: INGOT_ART })
    // every client gets the new thing with the rule that makes it
    expect(library.since(0).at(-1)).toMatchObject({ patch: { artifacts: [{ kind: 'type', type: { id: 'item/material/steel_ingot' } }, { kind: 'rule' }] } })
  })

  it('still creates the thing when its picture cannot be drawn: it shows its parent\'s', async () => {
    const { model } = router({
      local: { need: [{ name: 'steel ingot' }] },
      find: { create: [{ id: 'item/material/steel_ingot', name: { en: 'Steel Ingot', zh: '钢锭' } }] },
      create: { patch: { artifacts: [{ kind: 'type', type: INGOT_TYPE }, { kind: 'rule', rule: leaves('item/material/steel_ingot') }] } },
      art: () => ({ grid: ['k'], palette: { k: '#000000' } }),
    })
    const { modder, library } = setup(model, undefined, 'live')
    expect((await modder.resolve({ request: request() })).outcome).toBe('accepted')
    const t = library.lib.types.find((x) => x.id === 'item/material/steel_ingot')!
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
      return { patch: patchOf(noTestsRule(messages[1].content.includes('impulse/offered') ? bindRule() : { ...bindRule('patch/stone-used-on-dead-tree'), on: 'act/use', host: { type: 'item/material/stone' }, tree: { if: { is: { role: 'target', sel: { type: 'fixture/nature/dead_tree' } } }, then: { do: [{ op: 'log', text: 'You knock the stone on it.' }] } } })) }
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
    // two green slimes offered a stone: one tree (the type's, at this hole), so one lane; a wolf's is another
    const again = request()
    expect(laneOf(again)).toBe(laneOf(request()))
    expect(laneOf(again)).toBe(`${SLIME}|impulse/offered|core/offered|medium`) // one lane per tree: per tier too
    expect(laneOf(request('actor/creature/beast/wolf'))).not.toBe(laneOf(again))
    const replies = await Promise.all([modder.resolve({ request: request() }), modder.resolve({ request: again })])
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

describe('a failure of the harness itself', () => {
  it('keeps where it came from and the answer it failed on, so it can be found again', async () => {
    const model = new ScriptedModel((_m, opts) => (opts.purpose === 'reflect' ? {} : opts.purpose === 'review' ? { verdict: 'ship' } : { patch: patchOf(noTestsRule(bindRule())) }))
    const { modder, state, library } = setup(model, undefined, 'live')
    // (2026-10-10: "Maximum call stack size exceeded" on a strike from a feather, with nothing kept to see why)
    library.validate = () => {
      throw new RangeError('Maximum call stack size exceeded')
    }
    const reply = await modder.resolve({ request: request() })
    const ep = state.episode(reply.episode!)!
    expect(ep).toMatchObject({ outcome: 'failed', error: 'Maximum call stack size exceeded' })
    expect(ep.stack).toMatch(/at /)
    expect(ep.attempts.at(-1)).toMatchObject({ errors: [expect.stringMatching(/harness failed on this answer/)] })
    expect(ep.attempts.at(-1)!.raw).toMatch(/patch/)
  })
})

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
        return last.role === 'user' ? { content: '', toolCalls: [{ id: 'x', name: 'get_type', args: { id: 'item/material/stone' } }] } : (o.offline!(n.offline, messages) as object)
      }
      return o.live(n.live++) as object
    })
    return { model, n }
  }
  const noTests = (r: Rule): Rule => ({ ...r, tests: undefined })

  it('answers in one call without tools; the harness keeps the scene that asked as the rule\'s test', async () => {
    const { model, n } = liveModel({ live: () => ({ patch: patchOf(noTests(bindRule())) }) })
    const { modder, state, library } = setup(model, undefined, 'live')
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    const ep = state.episode(reply.episode!)!
    expect(ep.usage.calls).toBe(1)
    expect(ep.profile).toBe('live')
    expect(ep.attempts[0].derived?.join()).toMatch(/derived a test from the scene that asked/)
    const tests = library.lib.rules.get('patch/stone-stills-creature')!.tests!
    // the scene that asked, with what the rule did there (a learned rule is one type's: no sibling to try it on)
    expect(tests[0].name).toBe('derived: the scene that asked')
    expect(tests[0].given.event).toMatchObject({ kind: 'impulse/offered', host: 'host' })
    expect(tests[0].given.entities.find((e) => e.key === 'host')!.type).toBe(SLIME)
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
        const [cls, host] = classes[i]
        return { patch: patchOf(noTests(bindRule(`patch/stone-stills-${cls}`, `actor/creature/${cls}/${host}`))) }
      },
      reflect: (_i, m) => ((batch = m[1].content), { lessons: { add: [{ text: 'Still by the stone tag.', terms: [] }] } }),
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
    expect(state.lessons().find((l) => l.text === 'Still by the stone tag.')!.episodes).toEqual(ids)
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
      if (last.startsWith('# Request')) return { need: [{ name: 'steel ingot' }] }
      if (route === 'create' && last.startsWith('# What you asked for')) return { create: [{ ...type, why: 'a new ingot' }] }
      const patch = patchOf(noTests(bindRule(`patch/route-${cls}`, `actor/creature/${cls}/${classes[index][1]}`)))
      index++
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
    expect(library.lib.rules.has('patch/stone-stills-creature')).toBe(true) // ...and the world learns it anyway
    const escalated = state.episodes().map((e) => state.episode(e.id)!).find((e) => e.escalatedFrom === reply.episode)!
    expect(escalated).toMatchObject({ profile: 'offline', outcome: 'accepted' })
  })

  it('revises a shipped rule when the late reviewer asks, replacing it in the shared library', async () => {
    const narrow = noTests(bindRule('patch/stone-stills-slime'))
    const { model } = liveModel({
      live: () => ({ patch: patchOf(narrow) }),
      review: (i) => (i === 0 ? { verdict: 'revise', notes: ['Say what the stone does: it should go into the creature.'] } : { verdict: 'ship' }),
      offline: (_i, messages) => {
        expect(messages[1].content).toContain('# Revision')
        return { patch: patchOf(bindRule()) }
      },
    })
    const { modder, state, library } = setup(model, undefined, 'live')
    state.setHarness({ ...state.harness(), review: { ...state.harness().review, unflagged: true } }, 'test: review everything')
    const first = await modder.resolve({ request: request() })
    expect(library.lib.rules.has('patch/stone-stills-slime')).toBe(true)
    await modder.settled()
    expect(library.lib.rules.has('patch/stone-stills-slime')).toBe(false)
    expect(library.lib.rules.has('patch/stone-stills-creature')).toBe(true)
    expect(library.since(0).map((e) => ('remove' in e ? `-${e.remove}` : 'patch' in e ? `+${e.rules.join()}` : 'removeType' in e ? `-type ${e.removeType}` : `-status ${e.removeStatus}`))).toEqual(['+patch/stone-stills-slime', '-patch/stone-stills-slime', '+patch/stone-stills-creature'])
    const rev = state.episodes().map((e) => state.episode(e.id)!).find((e) => e.revises === first.episode)!
    expect(rev.outcome).toBe('accepted')
  })

  it('a background revision does not hold the lane a player\'s request waits in', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    let reviews = 0
    let lives = 0
    let revising = false
    const model = new ScriptedModel(async (messages, opts) => {
      if (opts.purpose === 'review') return reviews++ === 0 ? { verdict: 'revise', notes: ['Any creature can be tied up, not just slimes.'] } : { verdict: 'ship' }
      if (opts.purpose === 'reflect') return {}
      if (opts.tools?.length || messages.some((m) => m.role === 'tool')) {
        revising = true
        if (messages[messages.length - 1].role === 'user') return { content: '', toolCalls: [{ id: 'x', name: 'get_type', args: { id: 'item/tool/rope' } }] }
        await gate
        return { patch: patchOf(bindRule()) }
      }
      return { patch: patchOf(noTests(bindRule(`patch/stone-stills-slime-${lives++}`))) }
    })
    const { modder, state } = setup(model, undefined, 'live')
    state.setHarness({ ...state.harness(), review: { ...state.harness().review, unflagged: true } }, 'test: review everything')
    expect((await modder.resolve({ request: request() })).outcome).toBe('accepted')
    for (let i = 0; i < 200 && !revising; i++) await new Promise((r) => setTimeout(r, 10))
    expect(revising).toBe(true)
    // another green slime offered a stone: the same lane (the type's tree at this hole), while its revision is still being designed
    const again = request()
    expect(laneOf(again)).toBe(laneOf(request()))
    const second = await Promise.race([modder.resolve({ request: again }), new Promise<'blocked'>((r) => setTimeout(() => r('blocked'), 3000))])
    expect(second).not.toBe('blocked')
    release()
    await modder.settled()
  })

  it('flags a rule that changes nothing for the reviewer', async () => {
    const flavour: Rule = { id: 'patch/stone-on-creature-nothing', host: { type: 'actor/creature' }, on: 'impulse/offered', doc: 'Nothing.', tree: { if: STONY, then: { do: [{ op: 'log', text: 'You knock the stone about.' }] } } }
    let seen = ''
    const { model } = liveModel({ live: () => ({ patch: patchOf(flavour) }), review: (_i, m) => ((seen = m[1].content), { verdict: 'ship' }) })
    const { modder } = setup(model, undefined, 'live')
    await modder.resolve({ request: request() })
    await modder.settled()
    expect(seen).toContain('changes nothing in the world')
  })
})

describe('checks that hold their ground', () => {
  it('one class key: the client\'s port and the service key every request alike', () => {
    for (const req of [request(), useRequest(), request('actor/creature/beast/wolf', 'item/material/stone')]) {
      const eng = buildSandbox(req.scenario, onto, new RuleLibrary(BASE))
      const port = new ModPort(eng)
      const sc = req.scenario
      if (req.event.kind === 'act/use') eng.act('use', 'actor', { e: 'target' }, { instrument: { e: 'instrument' } })
      else eng.queue({ kind: 'impulse/offered', host: { e: sc.event.host! }, roles: { actor: { e: 'actor' }, item: { e: sc.event.item! }, source: { e: sc.event.item! } }, params: {}, cause: 'actor', origin: 'player' })
      const rec = port.records[0]
      expect(signatureOf(rec.request).key).toBe(rec.signature)
    }
  })

  it('a review that gives no verdict is no review: asked again, then recorded as an error, never as "ship"', async () => {
    const { model, calls } = scripted([patchOf(bindRule())], { review: () => ({ thoughts: 'looks fine to me' }) })
    const { modder, state } = setup(model)
    const reply = await modder.resolve({ request: request() })
    expect(state.episode(reply.episode!)!.attempts.at(-1)!.review).toEqual({ verdict: 'error', notes: [] })
    // no verdict before shipping (asked twice): the rule ships, and is reviewed again after the fact (twice more)
    await modder.settled()
    expect(calls.review).toBe(4)
    // and a verdict in capitals is read as what it says
    const again = scripted([patchOf(bindRule()), patchOf(bindRule('patch/stone-stills-creature-2'))], { review: (n) => (n === 0 ? { verdict: 'REVISE', notes: ['say what happens'] } : { verdict: 'ship', notes: [] }) })
    const s2 = setup(again.model)
    await s2.modder.resolve({ request: request() })
    expect(again.calls.design).toBeGreaterThanOrEqual(2)
  })

  it('a derived test checks at least that the rule answers, and a number by the way it moved', () => {
    const req = useRequest()
    const lib = new RuleLibrary(BASE)
    // (the rule as the pipeline places it: the stone's own, at the hole the use fell into)
    const rule = (id: string, effects: unknown[]): Patch => placed(patchOf({ id, host: { type: 'item/material/stone' }, on: 'act/use', tree: { if: { is: { role: 'target', sel: { type: 'fixture/nature/dead_tree' } } }, then: { do: effects as Effect[] }, else: { undefined: true } } }), req)
    const told = deriveTests(rule('patch/stone-says', [{ op: 'log', text: 'You knock the stone on it.' }]), req, lib, onto)
    const says = told.patch.artifacts[0].kind === 'rule' ? told.patch.artifacts[0].rule.tests?.[0]?.expect : undefined
    expect(says).toEqual([{ resolvedBy: 'patch/stone-says' }])
    expect(told.notes.join()).toMatch(/checks only that the rule answers/)
    const worn = deriveTests(rule('patch/stone-wears', [{ op: 'addProp', key: 'wear', delta: 1 }]), req, lib, onto)
    const wears = worn.patch.artifacts[0].kind === 'rule' ? worn.patch.artifacts[0].rule.tests?.[0]?.expect : undefined
    expect(wears).toContainEqual({ resolvedBy: 'patch/stone-wears' })
    expect(wears?.some((x) => 'propGt' in x && x.propGt[0] === 'wear')).toBe(true)
  })

  it('a new type that is a thing the world has, by another number or in Chinese, is refused', () => {
    const stick = onto.types['item/material/stick']
    const zh = typeof stick.name === 'object' ? stick.name.zh! : ''
    const type = (id: string, en: string, z: string) => ({ artifacts: [{ kind: 'type' as const, type: { id, name: { en, zh: z }, tags: [], props: { material: 'wood' }, makeup: [{ type: 'item/material/log', count: 1 }] } }] })
    const errs = (p: Patch) => validatePatch(p, { ontology: onto, library: new RuleLibrary(BASE) }).errors.join()
    expect(errs(type('item/material/sticks', 'Bundle', '一捆'))).toMatch(/already is this thing/)
    expect(errs(type('item/material/twig_bundle', 'Twig Bundle', zh))).toMatch(/already is this thing/)
    expect(errs(type('item/material/twig_bundle', 'Twig Bundle', '一捆细枝'))).not.toMatch(/already is this thing/)
  })

  it('a patch from the shared library is replayed in the scene it came with: a farm that a bare check would let through is refused', () => {
    const req = useRequest()
    const eng = buildSandbox(req.scenario, onto, new RuleLibrary(BASE))
    const port = new ModPort(eng)
    // (a shared patch arrives placed: the service placed it where its own request fell undefined)
    const farm = placed(patchOf({ id: 'patch/stone-farm', host: { type: 'item/material/stone' }, on: 'act/use', label: { en: 'Use {instrument}', zh: '使用{instrument}' }, tree: { if: { is: { role: 'target', sel: { type: 'fixture/nature/dead_tree' } } }, then: { do: [{ op: 'spawn', type: 'item/material/stone', at: 'actor', into: 'contents' }] }, else: { undefined: true } } }), req)
    expect(port.submit(undefined, farm, req.scenario).errors.join()).toMatch(/endless yield/)
  })

  it('a saved library comes back checked: a patch rule that no longer holds is left out', () => {
    const good: Rule = { ...(placed(patchOf(bindRule()), request()).artifacts[0] as { rule: Rule }).rule, source: { origin: 'patch' } }
    const bad: Rule = { id: 'patch/spawns-nothing-known', host: { type: 'item/material/stone' }, on: 'act/use', hole: holeOf(useRequest()), tree: { do: [{ op: 'spawn', type: 'item/material/unobtainium', at: 'host' }] }, source: { origin: 'patch' } }
    const dropped: string[] = []
    const lib = restoreLibrary(BASE, { rules: [good, bad], types: [], statuses: [], log: [], version: 3 }, onto, [], (id) => dropped.push(id))
    expect(lib.rules.has(good.id)).toBe(true)
    expect(lib.rules.has(bad.id)).toBe(false)
    expect(dropped).toEqual([bad.id])
  })
})

describe('a new thing an author asks for (the editor, M1)', () => {
  const ART = { grid: Array.from({ length: 16 }, (_, y) => (y > 3 && y < 12 ? '....kkkkkkkk....' : '................')), palette: { k: '#3e464e' } }
  const BLADE = { id: 'item/material/frost_ingot', name: { en: 'Frost Ingot', zh: '霜铁锭' }, tags: ['metal'], props: { material: 'iron' }, makeup: [{ type: 'item/material/iron_ore', count: 2 }], station: 'hands' }

  it('drafts its type from a sentence, mends what the engine rejects, draws its icon, and commits nothing', async () => {
    const asked: string[] = []
    const model = new ScriptedModel((messages, opts) => {
      if (opts.purpose === 'art') return ART
      asked.push(messages[messages.length - 1].content)
      // first a parent the world lacks, then the type as the engine takes it
      return asked.length === 1 ? { patch: { artifacts: [{ kind: 'type', type: { ...BLADE, id: 'item/nowhere/frost_ingot' } }] }, look: 'a pale blue ingot' } : { patch: { artifacts: [{ kind: 'type', type: BLADE }] }, look: 'a pale blue ingot' }
    })
    const { modder, library } = setup(model)
    const reply = await modder.createThing({ intent: 'an ingot that is always cold', had: [{ id: 'item/material/iron_ore', name: 'Iron Ore' }] })
    expect(asked[0]).toContain('"an ingot that is always cold"')
    expect(asked[0]).toContain('- item/material/iron_ore (Iron Ore)')
    expect(asked[1]).toContain('The validator rejected the patch')
    expect(reply.patch?.artifacts).toEqual([{ kind: 'type', type: { ...BLADE, art: ART, sprite: 'art:item/material/frost_ingot' } }])
    expect(reply.look).toBe('a pale blue ingot')
    expect(library.lib.types.some((t) => t.id === BLADE.id)).toBe(false)
  })

  it('draws each new thing by its own look: a part is not drawn as what it makes', async () => {
    const PELT = { id: 'item/material/leather/wolf_pelt', name: { en: 'Wolf Pelt', zh: '狼皮' }, tags: ['material'], props: { material: 'leather' }, makeup: [{ type: 'item/material/leather', count: 1 }], station: 'hands' }
    const CLOAK = { id: 'item/clothing/cloak/clasp_wolfcloak', name: { en: 'Iron-Clasp Wolfcloak', zh: '铁扣狼皮斗篷' }, tags: ['clothing'], props: { material: 'leather', slot: 'shoulders' }, makeup: [{ type: PELT.id, count: 2 }], station: 'hands' }
    const drawn: string[] = []
    const model = new ScriptedModel((messages, opts) => {
      if (opts.purpose === 'art') return (drawn.push(messages[1].content.split('\n')[0]), ART)
      return { patch: { artifacts: [{ kind: 'type', type: PELT }, { kind: 'type', type: CLOAK }] }, looks: { [PELT.id]: 'a rolled grey pelt', [CLOAK.id]: 'a fur cloak with an iron clasp' } }
    })
    const { modder } = setup(model)
    const reply = await modder.createThing({ intent: 'a cloak of wolf fur' })
    expect(reply.diagnostics).toEqual([])
    expect(reply.patch?.artifacts).toHaveLength(2)
    expect(drawn.sort()).toEqual([`Draw a 16x16 pixel-art inventory icon of: Iron-Clasp Wolfcloak (${CLOAK.id}) - a fur cloak with an iron clasp.`, `Draw a 16x16 pixel-art inventory icon of: Wolf Pelt (${PELT.id}) - a rolled grey pelt.`])
    expect(reply.look).toBe('a fur cloak with an iron clasp')
  })

  it('adopted, the library has it (so its holes can be asked), once', async () => {
    const { modder, library } = setup(new ScriptedModel(() => ({})))
    expect(modder.adopt({ artifacts: [{ kind: 'type', type: BLADE }] })).toEqual({ ok: true, errors: [] })
    expect(library.fullOntology().types[BLADE.id]).toBeDefined()
    const seq = library.seq
    expect(modder.adopt({ artifacts: [{ kind: 'type', type: BLADE }] })).toEqual({ ok: true, errors: [] })
    expect(library.seq).toBe(seq)
  })
})

describe('the service, an author\'s new thing', () => {
  it('drafts and takes in a new thing over HTTP from this machine; the patch log has it once taken', async () => {
    const ART = { grid: Array.from({ length: 16 }, (_, y) => (y > 3 && y < 12 ? '....kkkkkkkk....' : '................')), palette: { k: '#3e464e' } }
    const INGOT = { id: 'item/material/frost_ingot', name: { en: 'Frost Ingot', zh: '霜铁锭' }, tags: ['metal'], props: { material: 'iron' }, makeup: [{ type: 'item/material/iron_ore', count: 2 }], station: 'hands' }
    const model = new ScriptedModel((_m, opts) => (opts.purpose === 'art' ? ART : { patch: { artifacts: [{ kind: 'type', type: INGOT }] } }))
    const { modder, library } = setup(model)
    const server = createModderServer(modder).listen(0)
    await listening(server)
    const base = `http://localhost:${(server.address() as AddressInfo).port}`
    try {
      const draft = await (await fetch(`${base}/create`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent: 'a cold ingot' }) })).json()
      expect(draft.patch.artifacts[0].type).toMatchObject({ id: INGOT.id, art: ART })
      expect(library.seq).toBe(0)
      expect(await (await fetch(`${base}/adopt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patch: draft.patch }) })).json()).toEqual({ ok: true, errors: [] })
      expect((await (await fetch(`${base}/patches?since=0`)).json()).entries[0].patch.artifacts[0].type.id).toBe(INGOT.id)
    } finally {
      server.close()
    }
  })
})
