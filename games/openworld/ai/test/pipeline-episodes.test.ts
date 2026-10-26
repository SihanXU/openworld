// The modder's episodes beyond one design (pipeline.ts): a repo episode is checked as a json one is (audited, a
// failed audit is no audit, reviewed when the harness says so, its checks' calls counted, an answer asked again
// takes the words' place), a revision after a review only touches the version reviewed, the router off makes no
// new kinds, a class is escalated once, and where a request is stays its own while others of its class end.

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AGAIN_AFTER, ModPort, RuleLibrary, buildSandbox, placePatch, type ModRequest, type Patch, type Rule, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { Modder, ScriptedModel, SelfState, WorldLibrary, auditOf, useOffline, type ChatMessage, type ChatOptions, type Model } from '@openworld/ai'

const SLOW = { timeout: 180_000 }
const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const STONE = 'item/material/stone'

function useRequest(target = 'fixture/nature/dead_tree'): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: target, x: 2, y: 1 },
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  expect(eng.act('use', 'actor', { e: 'it' }).defined).toBe(false)
  return port.records[0].request
}

const onTarget = (id: string, target: string, effects: unknown[]): Patch => ({
  artifacts: [{ kind: 'rule', rule: { id, host: { type: STONE }, on: 'act/use', label: { en: 'Use {instrument} on {target}', zh: '对{target}使用{instrument}' }, tree: { if: { is: { role: 'target', sel: { type: target } } }, then: { do: effects as never }, else: 'inherit' } } }],
})
const sapped = (id = 'patch/sap', word = 'sap') => onTarget(id, 'fixture/nature/dead_tree', [{ op: 'addStatus', status: 'wet', duration: 10 }, { op: 'log', text: { en: `{target} drips ${word} on {instrument}.`, zh: '树液。' } }])

function gate<T = void>() {
  let open!: (v: T) => void
  const p = new Promise<T>((r) => (open = r))
  return { p, open }
}

function setup(model: Model | undefined, profile: 'live' | 'offline', over: Record<string, unknown> = {}, offlineMode: 'json' | 'repo' = 'json') {
  const dir = mkdtempSync(join(tmpdir(), 'lsw-hunt-'))
  const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
  const state = SelfState.open(join(dir, 'modder-state'))
  const h = state.harness()
  state.setHarness({ ...h, audit: { ...auditOf(h), enabled: false }, review: { ...h.review, enabled: false }, reflect: { ...h.reflect, enabled: false }, escalate: false, revise: false, offline: { ...h.offline, design: { ...h.offline.design, mode: offlineMode } }, ...over }, 'test: hunt')
  return { library, state, modder: new Modder({ library, state, model, profile }) }
}

/** A stand-in for the repo agent: it "submits" whatever `make` returns, and records what it was given. */
function fakeRepoAgent(make: (o: { request: ModRequest; library: RuleLibrary }) => Patch | undefined) {
  const given: { request: ModRequest; library: RuleLibrary; revise?: unknown }[] = []
  let n = 0
  useOffline({
    materializeWorld: (async (o: { request: ModRequest; library: RuleLibrary; revise?: unknown }) => {
      given.push(o)
      return { task: { id: `t${n}`, kind: 'world-repo', prompt: '' }, collect: () => ({ patch: make(o), problems: [] }), dispose: async () => {} }
    }) as never,
    runAgent: (async () => ({
      submitted: true,
      episode: { id: `repo-ep-${n++}`, at: new Date().toISOString(), kind: 'world-repo', summary: '', key: '', terms: [], outcome: 'failed', attempts: [], tools: [], rules: [], shown: { lessons: [], episodes: [], skills: [] }, skillsRead: [], harness: 1, usage: { calls: 1, input: 0, output: 0 }, ms: 0 },
    })) as never,
  })
  return given
}

describe('repo episodes (the offline default: escalations, revisions, the curriculum)', () => {
  it('an audit that failed (the backend not out) is no audit: the patch is not shipped', SLOW, async () => {
    const req = useRequest()
    fakeRepoAgent(() => placePatch(sapped(), req).patch)
    let audits = 0
    const model = new ScriptedModel(async (_m: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'audit') {
        audits++
        throw new Error('fetch failed: socket hang up')
      }
      return {}
    })
    const { library, state, modder } = setup(model, 'offline', {}, 'repo')
    state.setHarness({ ...state.harness(), audit: { ...auditOf(state.harness()), enabled: true, rounds: 1 } }, 'test: blocking audit offline')
    expect(auditOf({ ...state.harness(), ...{ audit: { ...auditOf(state.harness()), ...state.harness().offline.audit } } }).blocking).toBe(true)
    const r = await modder.resolve({ request: req }, 'offline')
    await modder.settled()
    expect(audits).toBeGreaterThan(0)
    // as work() refuses it: asked once more, then not shipped unaudited
    expect({ outcome: r.outcome, inLibrary: library.lib.rules.has('patch/sap') }).toEqual({ outcome: 'failed', inLibrary: false })
  })

  it('the offline profile\'s blocking review runs, and a draft it sends back is not committed', SLOW, async () => {
    const req = useRequest()
    fakeRepoAgent(() => placePatch(sapped(), req).patch)
    let reviews = 0
    const model = new ScriptedModel(async (_m: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'review') return (reviews++, { verdict: 'revise', notes: ['this is wrong'] })
      return {}
    })
    const { library, state, modder } = setup(model, 'offline', {}, 'repo')
    state.setHarness({ ...state.harness(), review: { ...state.harness().review, enabled: true } }, 'test: review on')
    expect(state.harness().offline.review?.blocking).toBe(true)
    const r = await modder.resolve({ request: req }, 'offline')
    await modder.settled()
    expect({ reviews, outcome: r.outcome, inLibrary: library.lib.rules.has('patch/sap') }).toEqual({ reviews: 1, outcome: 'failed', inLibrary: false })
  })

  it('a request asked again replaces the provisional words', SLOW, async () => {
    const CHAIR = 'fixture/furniture/chair'
    const scene: Scenario = { entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'chair', type: CHAIR, x: 2, y: 1 }], event: {} }
    const line = { op: 'log' as const, text: { en: 'The chair creaks.', zh: '椅子吱呀一声。' } }
    const sit = { op: 'emit' as const, impulse: 'settle' as const, to: 'actor' as const, params: { pose: 'sit' } }
    const answer = (id: string, tree: Rule['tree']): Patch => ({ artifacts: [{ kind: 'rule', rule: { id, host: { type: CHAIR }, on: 'impulse/handle', doc: 'A chair.', label: { en: 'Sit on {target}', zh: '坐到{target}上' }, tree } }] })
    const words: Rule = { id: 'patch/chair-words', host: { type: CHAIR }, on: 'impulse/handle', hole: 'core/handle', at: [], affords: 'words', tree: { do: [line] } }
    const first = (() => {
      const eng = buildSandbox(scene, onto, new RuleLibrary(BASE))
      const port = new ModPort(eng)
      eng.act('hands', 'actor', { e: 'chair' }, { instrument: null })
      return port.records[0].request
    })()
    const model = new ScriptedModel(async () => ({}))
    const { library, modder } = setup(model, 'offline', {}, 'repo')
    expect(library.commit(placePatch({ artifacts: [{ kind: 'rule', rule: words }] }, first).patch, first).ok).toBe(true)
    // the player tries the chair again and again: the port asks again
    const eng = buildSandbox(scene, onto, library.lib.clone())
    const port = new ModPort(eng)
    const asked: ModRequest[] = []
    port.provider = { resolve: async (r) => (asked.push(r), null) }
    for (let i = 0; i < AGAIN_AFTER; i++) eng.act('hands', 'actor', { e: 'chair' }, { instrument: null })
    const again = asked[0]
    expect(again.again?.rule).toBe('patch/chair-words')
    const given = fakeRepoAgent((o) => placePatch(answer('patch/chair-sit', { do: [sit, line] }), o.request).patch)
    // (an escalation of a failed live answer to it is worked this way, as is any offline answer)
    const r = await modder.resolve({ request: again }, 'offline')
    await modder.settled()
    // as work() does: the agent works in a library without the words, and the answer takes their place
    expect({ wordsInAgentLibrary: given[0].library.rules.has('patch/chair-words'), outcome: r.outcome, words: library.lib.rules.has('patch/chair-words'), sit: library.lib.rules.has('patch/chair-sit') }).toEqual({ wordsInAgentLibrary: false, outcome: 'accepted', words: false, sit: true })
  })
})

describe('the review after shipping', () => {
  it('its revision leaves alone a version that replaced the one it reviewed', SLOW, async () => {
    const req = useRequest()
    const reviewing = gate()
    const release = gate()
    let reviews = 0
    const model = new ScriptedModel(async (_m: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'review') {
        if (reviews++ === 0) {
          reviewing.open()
          await release.p
          return { verdict: 'revise', notes: ['say more'] }
        }
        return { verdict: 'ship', notes: [] }
      }
      if (opts.purpose === 'design') return opts.tools ? { patch: sapped('patch/sap', 'REVISION-OF-V1'), summary: 'v3' } : { patch: sapped('patch/sap', 'V1'), summary: 'v1' }
      return {}
    })
    const { library, state, modder } = setup(model, 'live', { revise: true })
    state.setHarness({ ...state.harness(), review: { ...state.harness().review, enabled: true, blocking: false, unflagged: true } }, 'test: review every live rule after shipping')
    expect((await modder.resolve({ request: req })).outcome).toBe('accepted')
    await reviewing.p
    // meanwhile another revision (a fault's, an audit's) replaced the rule under its id
    const v2 = library.commit(placePatch(sapped('patch/sap', 'V2'), req).patch, req, new Date(), ['patch/sap'])
    expect(v2.ok).toBe(true)
    release.open()
    await modder.settled()
    // v2 was never reviewed: it stays (as the audit after shipping leaves it, pipeline-guards.test.ts)
    expect(JSON.stringify(library.lib.rules.get('patch/sap')?.tree)).toContain('V2')
  })
})

describe('the router off (an ablation: the request\'s own things only)', () => {
  it('a draft that spawns an unknown kind is not sent to create one', SLOW, async () => {
    const req = useRequest()
    const creates: string[] = []
    const glimmer = onTarget('patch/glimmer', 'fixture/nature/dead_tree', [{ op: 'spawn', type: 'item/material/glimmerdust', at: 'actor', into: 'contents' }, { op: 'destroy' }])
    const model = new ScriptedModel(async (messages: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'art') return '{}'
      if (opts.purpose !== 'design') return {}
      if (/create/i.test(String(messages.at(-1)?.content)) && messages.length > 2) creates.push(String(messages.at(-1)!.content).slice(0, 80))
      return { patch: glimmer, summary: 'glimmer' }
    })
    const { state, modder } = setup(model, 'live')
    state.setHarness({ ...state.harness(), design: { ...state.harness().design, router: false } }, 'test: router off')
    const r = await modder.resolve({ request: req })
    await modder.settled()
    const ep = state.episode(r.episode!)!
    // with the router off, a creation is barred whether the model asks for it or the draft makes an unknown kind
    expect(ep.route ?? []).not.toContain('create')
  })
})

describe('escalation', () => {
  it('two failures of one class while the background work is full are escalated once', SLOW, async () => {
    const hold = gate()
    let blocked = 0
    const offlineDesigns = new Map<string, number>()
    const model = new ScriptedModel(async (messages: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose !== 'design') return {}
      if (opts.tools) {
        const user = String(messages[1]?.content ?? '')
        const key = /dead_tree/.test(user) ? 'dead_tree' : /slime/.test(user) ? 'slime' : 'other'
        if (key !== 'dead_tree' && messages.length === 2 && blocked < 2) {
          blocked++
          await hold.p
        }
        if (messages.length === 2) offlineDesigns.set(key, (offlineDesigns.get(key) ?? 0) + 1)
      }
      return 'no idea'
    })
    const { state, modder } = setup(model, 'live', { escalate: true, concurrency: { design: 4, background: 2 } })
    // two other classes fail first: their escalations fill the two background slots
    const creature = (host: string): ModRequest => {
      const sc: Scenario = { entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' }, { key: 'it', type: host, x: 2, y: 1 }], event: {} }
      const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
      const port = new ModPort(eng)
      eng.queue({ kind: 'impulse/offered', host: { e: 'it' }, roles: { actor: { e: 'actor' }, item: { e: 'held' }, source: { e: 'held' } }, params: {}, cause: 'actor', origin: 'player' })
      return port.records[0].request
    }
    expect((await modder.resolve({ request: creature('actor/creature/slime/green_slime') })).outcome).toBe('failed')
    expect((await modder.resolve({ request: creature('actor/creature/beast/wolf') })).outcome).toBe('failed')
    // the class under test fails twice, one after the other: each queues an escalation
    expect((await modder.resolve({ request: useRequest() })).outcome).toBe('failed')
    expect((await modder.resolve({ request: { ...useRequest(), id: 'second' } })).outcome).toBe('failed')
    hold.open()
    await modder.settled()
    const escalations = state.episodes().map((e) => state.episode(e.id)!).filter((e) => e.escalatedFrom && /dead/.test(JSON.stringify((e.request as ModRequest).event)))
    // one question per class: the first escalation was still waiting its turn when the second failure came
    expect({ escalations: escalations.length, offlineEpisodesStarted: offlineDesigns.get('dead_tree') }).toEqual({ escalations: 1, offlineEpisodesStarted: 1 })
  })
})

describe('a repo episode\'s usage', () => {
  it('the blocking audit\'s calls and spend are counted with it', SLOW, async () => {
    const req = useRequest()
    fakeRepoAgent(() => placePatch(sapped(), req).patch)
    let audits = 0
    const model = new ScriptedModel(async (_m: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'audit') return (audits++, { content: JSON.stringify({ findings: [] }), toolCalls: [], usage: { input: 5000, output: 500, cost: 0.25 } })
      return {}
    })
    const { state, modder } = setup(model, 'offline', {}, 'repo')
    state.setHarness({ ...state.harness(), audit: { ...auditOf(state.harness()), enabled: true, rounds: 1 } }, 'test: blocking audit offline')
    const r = await modder.resolve({ request: req }, 'offline')
    await modder.settled()
    expect(r.outcome).toBe('accepted')
    expect(audits).toBe(1)
    const ep = state.episode(r.episode!)!
    // the agent's own call (1) and the audit's (1, 5000 in, $0.25)
    expect(ep.usage).toMatchObject({ calls: 2, input: 5000, cost: 0.25 })
  })
})

describe('where a request is (GET /progress)', () => {
  it('one episode ending leaves the progress of another of its class (another tier) still designing', SLOW, async () => {
    const req = useRequest()
    const first = gate()
    const release = gate()
    let designs = 0
    const model = new ScriptedModel(async (_m: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose !== 'design') return {}
      if (designs++ === 0) {
        first.open()
        await release.p
      }
      return 'no idea'
    })
    const { modder } = setup(model, 'live')
    const at = (tier: 'low' | 'high'): ModRequest => ({ ...req, id: `${req.id}-${tier}`, tier, scenario: { ...req.scenario, tier } })
    const low = modder.resolve({ request: at('low') })
    await first.p
    expect(modder.progressOf(at('low').id)).toMatchObject({ stage: 'local' })
    expect((await modder.resolve({ request: at('high') })).outcome).toBe('failed')
    // the low request is still designing (its call is held)
    const still = modder.progressOf(at('low').id)
    release.open()
    await low
    await modder.settled()
    expect(still).toMatchObject({ stage: 'local' })
  })
})
