// The modder's episodes beyond one design (pipeline.ts): a repo episode is checked as a json one is (audited, a
// failed audit is no audit, reviewed when the harness says so, its checks' calls counted, an answer asked again
// takes the words' place), a revision after a review only touches the version reviewed, the router off makes no
// new kinds, a class is escalated once, and where a request is stays its own while others of its class end.

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AGAIN_AFTER, ModPort, RuleLibrary, buildSandbox, placePatch, withArtifacts, type ModRequest, type Patch, type Rule, type Scenario } from '@openworld/engine'
import { Modder, ScriptedModel, SelfState, WorldLibrary, auditOf, useOffline, Detector, gatherProbes, auditTools, changesNothing, probe, stationFromRules, type ChatMessage, type ChatOptions, type Model, type Harness } from '@openworld/ai'
import { BASE, DEAD_TREE, HONE, SAP, SLOW, STONE, becomesBane, gate, jsonOffline, noAudit, onDeadTree, onTarget, onto, quiet, testModder, useRequest } from './fixtures.ts'

const sap = (id = 'patch/sap', word = 'sap') => onTarget(id, DEAD_TREE, [{ op: 'addStatus', status: 'wet', duration: 10 }, { op: 'log', text: { en: `{target} drips ${word} on {instrument}.`, zh: '树液。' } }])

/** Nothing after the answer (no audit, review, reflection, escalation or revision), as the test says otherwise. */
function setup(model: Model | undefined, profile: 'live' | 'offline', over: Record<string, unknown> = {}, offlineMode: 'json' | 'repo' = 'json') {
  return testModder({ model, profile, harness: (h) => ({ ...noAudit(h), ...quiet(h), offline: { ...h.offline, design: { ...h.offline.design, mode: offlineMode } }, ...over }) })
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
    fakeRepoAgent(() => placePatch(sap(), req).patch)
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
    fakeRepoAgent(() => placePatch(sap(), req).patch)
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
      if (opts.purpose === 'design') return opts.tools ? { patch: sap('patch/sap', 'REVISION-OF-V1'), summary: 'v3' } : { patch: sap('patch/sap', 'V1'), summary: 'v1' }
      return {}
    })
    const { library, state, modder } = setup(model, 'live', { revise: true })
    state.setHarness({ ...state.harness(), review: { ...state.harness().review, enabled: true, blocking: false, unflagged: true } }, 'test: review every live rule after shipping')
    expect((await modder.resolve({ request: req })).outcome).toBe('accepted')
    await reviewing.p
    // meanwhile another revision (a fault's, an audit's) replaced the rule under its id
    const v2 = library.commit(placePatch(sap('patch/sap', 'V2'), req).patch, req, new Date(), ['patch/sap'])
    expect(v2.ok).toBe(true)
    release.open()
    await modder.settled()
    // v2 was never reviewed: it stays (as the audit after shipping leaves it, above)
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
    fakeRepoAgent(() => placePatch(sap(), req).patch)
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

// The pipeline's bookkeeping around a shipped rule (pipeline.ts): which version a later removal takes,
// what a fault counts, how a revision after a fault is asked, which work waits for which.

/** A cheap road to the rarest blade (the auditor breaks it). */
const bane = (id = 'patch/stone-bane') => onDeadTree(id, HONE)
/** Harmless: the dead tree's sap wets the stone. */
const sapped = (id = 'patch/stone-bane') => onDeadTree(id, SAP)

describe('a rule id is not one version', () => {
  it('the audit after shipping removes the version it audited, not a revision committed under its id meanwhile', SLOW, async () => {
    const req = useRequest()
    const auditing = gate()
    const release = gate()
    const model = new ScriptedModel(async (messages: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'audit') {
        auditing.open()
        await release.p
        if (opts.tools && !messages.some((m) => m.role === 'tool')) return { content: '', toolCalls: [{ id: 'a1', name: 'run', args: { steps: becomesBane.steps } }] }
        return { findings: [becomesBane] }
      }
      if (opts.purpose === 'design') return { patch: bane(), summary: 'a stone on a dead tree' }
      return {}
    })
    const { library, state, modder } = setup(model, 'live')
    state.setHarness({ ...state.harness(), audit: { ...auditOf(state.harness()), enabled: true, blocking: false, rounds: 2 } }, 'test: the audit after shipping')
    expect((await modder.resolve({ request: req })).outcome).toBe('accepted')
    await auditing.p
    // while the audit runs, a revision replaces the rule under the same id
    const revised = library.commit(placePatch(sapped(), req).patch, req, new Date(), ['patch/stone-bane'])
    expect(revised.ok).toBe(true)
    release.open()
    await modder.settled()
    // the audit's finding was about the old version: the revision stays
    expect(library.seqOf('patch/stone-bane')).toBe(revised.seq)
    expect(JSON.stringify(library.lib.rules.get('patch/stone-bane')?.tree)).toContain('wet')
  })

  it('a fault counted against a rule is forgotten when the rule is replaced, or removed and added again', SLOW, () => {
    const req = useRequest()
    const { library, state, modder } = setup(undefined, 'live')
    state.setHarness({ ...state.harness(), faults: { remove: 2 } }, 'test: two faults remove')
    expect(library.commit(placePatch(sapped('patch/sap'), req).patch, req).ok).toBe(true)
    expect(modder.fault('patch/sap', 'a chain that does not end', 'client-a')).toMatchObject({ counted: 1, removed: false })
    // a revision replaces it: the new version has had no fault yet
    expect(library.commit(placePatch(sapped('patch/sap'), req).patch, req, new Date(), ['patch/sap']).ok).toBe(true)
    expect(modder.fault('patch/sap', 'a chain that does not end', 'client-b')).toMatchObject({ counted: 1, removed: false })
    expect(library.lib.rules.has('patch/sap')).toBe(true)
    // rolled back and taken in again: none either
    expect(library.remove('patch/sap')).toBe(true)
    expect(library.commit(placePatch(sapped('patch/sap'), req).patch, req).ok).toBe(true)
    expect(modder.fault('patch/sap', 'a chain that does not end', 'client-c')).toMatchObject({ counted: 1, removed: false })
    expect(modder.fault('patch/sap', 'a chain that does not end', 'client-d')).toMatchObject({ counted: 2, removed: true })
    expect(library.lib.rules.has('patch/sap')).toBe(false)
  })
})

describe('the revision after a fault', () => {
  it('is asked where the scene falls undefined now (host, hole and context rebuilt), and its answer is committed', SLOW, async () => {
    const req = useRequest()
    const designs: ChatMessage[][] = []
    // the offline design: a look at the rules first, then the revised rule, written (as drafts often are) on the
    // wrong host: its place is the request's to set, never the model's (design.md §5.16)
    const revised = onDeadTree('patch/sap', [{ op: 'addStatus', status: 'wet', duration: 5 }, { op: 'log', text: { en: '{target} weeps a little sap.', zh: '{target}渗出一点树液。' } }])
    const draft: Patch = { artifacts: revised.artifacts.map((a) => (a.kind === 'rule' ? { ...a, rule: { ...a.rule, host: { type: 'fixture/nature/dead_tree' } } } : a)) }
    const model = new ScriptedModel((messages: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose !== 'design') return {}
      designs.push(messages)
      if (messages.at(-1)!.role === 'user') return { content: '', toolCalls: [{ id: `c${designs.length}`, name: 'search_rules', args: { on: 'act/use' } }] }
      return { patch: draft, summary: 'the revision' }
    })
    const { library, state, modder } = setup(model, 'live', { revise: true, faults: { remove: 1 } })
    const first = library.commit(placePatch(sapped('patch/sap'), req).patch, req)
    expect(first.ok).toBe(true)
    expect(modder.fault('patch/sap', 'an effect refused', 'client-a')).toMatchObject({ removed: true })
    await modder.settled()
    const revision = state.episodes().map((e) => state.episode(e.id)!).find((e) => e.revises === 'fault-patch/sap')
    expect(revision?.outcome).toBe('accepted')
    expect(revision?.request).toMatchObject({ event: { kind: 'act/use', host: { type: STONE } }, hole: { rule: req.hole.rule } })
    expect(library.seqOf('patch/sap')).toBeGreaterThan(first.seq!)
    expect(JSON.stringify(library.lib.rules.get('patch/sap')?.tree)).toContain('weeps')
  })
})

describe('lanes', () => {
  it("a player's request does not wait behind an escalation of the same hole", SLOW, async () => {
    const escalating = gate()
    const release = gate()
    const designing = gate()
    let failing = true
    const model = new ScriptedModel(async (_messages: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose !== 'design') return {}
      // the escalation (the offline profile designs with tools): held until the test lets it go
      if (opts.tools) {
        escalating.open()
        await release.p
        return 'no idea'
      }
      if (failing) return 'no idea'
      designing.open()
      return { patch: sapped('patch/sap'), summary: 'sap' }
    })
    const { modder } = setup(model, 'live', { escalate: true })
    expect((await modder.resolve({ request: useRequest() })).outcome).toBe('failed')
    await escalating.p
    failing = false
    // the same hole asked again by a player while the escalation works on it
    const second = modder.resolve({ request: useRequest() })
    // it is designed while the escalation still holds its call (behind it in a lane, it would not be)
    const waited = await Promise.race([designing.p.then(() => 'designing'), new Promise((r) => setTimeout(() => r('still waiting'), 15_000))])
    release.open()
    expect(waited).toBe('designing')
    expect((await second).outcome).toBe('accepted')
    await modder.settled()
  })
})

describe('what is in flight', () => {
  it('a request at a higher tier does not wait for one of its class at a lower tier (whose answer cannot serve it)', SLOW, async () => {
    const first = gate()
    const release = gate()
    const designing = gate()
    let designs = 0
    const model = new ScriptedModel(async (_messages: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'review') return { verdict: 'ship', notes: [] }
      if (opts.purpose !== 'design') return {}
      if (designs++ === 0) {
        first.open()
        await release.p
        return 'no idea'
      }
      designing.open()
      return { patch: sapped('patch/sap'), summary: 'sap' }
    })
    const { modder } = setup(model, 'live')
    const req = useRequest()
    const at = (tier: 'low' | 'high'): ModRequest => ({ ...req, id: `${req.id}-${tier}`, tier, scenario: { ...req.scenario, tier } })
    const low = modder.resolve({ request: at('low') })
    await first.p
    const high = modder.resolve({ request: at('high') })
    const waited = await Promise.race([designing.p.then(() => 'designing'), new Promise((r) => setTimeout(() => r('still waiting'), 15_000))])
    release.open()
    expect(waited).toBe('designing')
    expect((await high).outcome).toBe('accepted')
    await low
    await modder.settled()
  })

  it("pictures begun for a new thing are waited for when the request fails, and their calls are the episode's", SLOW, async () => {
    let drawn = 0
    const model = new ScriptedModel(async (_messages: ChatMessage[], opts: ChatOptions, call: number) => {
      if (opts.purpose === 'art') {
        await new Promise((r) => setTimeout(r, 300))
        drawn++
        return { content: '{}', toolCalls: [], usage: { input: 1000, output: 50 } }
      }
      if (opts.purpose !== 'design') return {}
      // a draft that makes a thing the world has no kind of (a creation, and its picture begun), then nothing usable
      return call === 0 ? { patch: onDeadTree('patch/glimmer', [{ op: 'spawn', type: 'item/material/glimmerdust', at: 'actor', into: 'contents' }, { op: 'destroy' }]), summary: 'glimmer' } : 'no idea'
    })
    const { state, modder } = setup(model, 'live')
    const reply = await modder.resolve({ request: useRequest() })
    expect(reply.outcome).toBe('failed')
    // the picture's two tries ran before the reply, and are counted with the episode
    expect(drawn).toBe(2)
    const ep = state.episode(reply.episode!)!
    expect(ep.route).toContain('create')
    expect(ep.usage).toMatchObject({ input: 2000, output: 100 })
    await modder.settled()
  })
})

// Guards on the detection side of the modder: the deterministic fixes laid on a model's draft, the
// auditor's probe and its evidence, the blocking audit and review, the review after the fact, and the
// detection of what a model carries. Each test names the defect it holds shut.

/** A learned rule for the stone on the dead tree, placed where the request fell undefined. */
const placedOnDeadTree = (req: ModRequest, id: string, effects: unknown[]): Patch =>
  placePatch({ artifacts: [{ kind: 'rule', rule: { id, host: { type: STONE }, on: 'act/use', label: { en: 'Use {instrument} on {target}', zh: '对{target}使用{instrument}' }, doc: 'd', tree: { if: { is: { role: 'target', sel: { type: DEAD_TREE } } }, then: { do: effects as never }, else: { undefined: true } } } }] }, req).patch

describe('stationFromRules: yields only where the rule makes them so', () => {
  const STICK = 'item/material/stick'
  const ANVIL = 'fixture/craft/anvil'
  const bits = { id: 'item/material/stone_bits', name: { en: 'Stone Bits', zh: '碎石' }, tags: ['stone'], props: { material: 'stone' }, makeup: [{ type: STICK, count: 1 }] }
  const atAnvil = (extra?: object): Rule => ({
    id: 'patch/stick-bits',
    host: { type: STICK },
    on: 'act/use',
    doc: 'd',
    tree: { if: extra ? { all: [{ is: { role: 'target', sel: { type: ANVIL } } }, extra] } : { is: { role: 'target', sel: { type: ANVIL } } }, then: { do: [{ op: 'spawn', type: bits.id, at: 'target', count: 5 }, { op: 'destroy' }] }, else: { undefined: true } } as never,
  })
  const typeOf = (rule: Rule, type: object) => (stationFromRules({ artifacts: [{ kind: 'type', type: type as never }, { kind: 'rule', rule }] }, onto).patch.artifacts[0] as { type: { station?: string; yields?: number } }).type

  it('a type made by hand keeps one for one, though a rule makes five at an anvil (E2)', () => {
    expect(typeOf(atAnvil(), { ...bits, station: 'hands' }).yields).toBeUndefined()
  })

  it('a branch taken only by chance gives neither a station nor yields (E2)', () => {
    expect(typeOf(atAnvil({ chance: 0.1 }), { ...bits, station: 'hands' }).yields).toBeUndefined()
    const t = typeOf(atAnvil({ chance: 0.1 }), bits)
    expect(t.station).toBeUndefined()
    expect(t.yields).toBeUndefined()
    // the same branch with no chance in it is the anvil's craft, five at a time
    expect(typeOf(atAnvil(), bits)).toMatchObject({ station: 'anvil', yields: 5 })
  })
})

describe('the probe: a number that rises on every use is a farm, whoever holds it', () => {
  it('finds a stone whose power grows by two with every use, with no model (D4a)', () => {
    const req = useRequest()
    const base = new RuleLibrary(BASE)
    const farm = placedOnDeadTree(req, 'patch/stone-hones', [{ op: 'addProp', key: 'power', delta: 2 }])
    const found = probe(req, onto, base, withArtifacts(base, farm))
    expect(found.map((f) => f.kind)).toEqual(['farm'])
    expect(found[0].title).toMatch(/power every time/)
    // a number that rises once and stops (capped) is no farm
    const capped = placedOnDeadTree(req, 'patch/stone-hones-once', [{ op: 'addProp', key: 'power', delta: 2, max: 2 }])
    expect(probe(req, onto, base, withArtifacts(base, capped))).toEqual([])
  })
})

describe('the auditor sees what the engine refused', () => {
  it('lists a refused effect among the warnings of a run (its dev line, "rule …")', () => {
    const req = useRequest()
    const base = new RuleLibrary(BASE)
    const bad = placedOnDeadTree(req, 'patch/stone-unheals', [{ op: 'heal', amount: -5 }])
    const tool = auditTools(req.scenario, onto, base, withArtifacts(base, bad)).find((t) => t.name === 'run')!
    const out = tool.run({ steps: [{ act: 'use', target: req.scenario.event.target, instrument: req.scenario.event.instrument }] })
    expect(out).toMatch(/warnings: rule patch\/stone-unheals: a heal of -5/)
  })
})

describe('narration in place of a default that does something is a change', () => {
  it('a log-only answer to core/break, whose default drops and destroys, changes something (D10)', () => {
    const words: Rule = { id: 'patch/pot-creaks', host: { type: 'item/container/pot' }, on: 'threshold/cross', doc: 'd', tree: { do: [{ op: 'log', text: { en: '{host} creaks.', zh: '{host}吱呀作响。' } }] } }
    // nothing it says changes the world by itself...
    expect(changesNothing(words)).toBe(true)
    expect(changesNothing(words, [{ op: 'log', text: { en: 'Nothing happens.', zh: 'Nothing happens.' } }])).toBe(true)
    // ...but in place of the thing breaking (core/break) or the story's fallback (core/broken), it keeps them from happening
    expect(changesNothing(words, [{ op: 'dropContents' }, { op: 'destroy' }] as never)).toBe(false)
    expect(changesNothing(words, [{ op: 'fallback' }] as never)).toBe(false)
    // a tree that leaves every case open replaces nothing: the default still runs
    expect(changesNothing({ ...words, tree: { undefined: true } }, [{ op: 'destroy' }] as never)).toBe(true)
  })
})

/** A modder over the base game; the harness as the test says (no reflection, escalation or revision unless it says). */
function modderWith(model: Model, profile: 'live' | 'offline', over: (h: Harness) => Partial<Harness> = () => ({})) {
  return testModder({ model, profile, harness: (h) => ({ reflect: { ...h.reflect, enabled: false }, escalate: false, revise: false, ...jsonOffline(h), ...over(h) }) })
}

/** Harmless, though it changes something (the probe finds nothing in it): the dead tree's sap wets the stone. */
const placedSap = (req: ModRequest) => placedOnDeadTree(req, 'patch/stone-sapped', SAP)

describe('a blocking audit that fails is no audit', () => {
  it('offline: the auditor times out twice, and the patch is not committed unaudited (D5)', async () => {
    const req = useRequest()
    let audits = 0
    const model = new ScriptedModel((_m: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'audit') {
        audits++
        throw new Error('model: no answer within 180000 ms')
      }
      if (opts.purpose === 'design') return { patch: placedSap(req), summary: 'sap wets the stone' }
      return { verdict: 'ship', notes: [] }
    })
    const { library, state, modder } = modderWith(model, 'offline', (h) => ({ audit: { ...auditOf(h), rounds: 1 }, review: { ...h.review, enabled: false } }))
    const reply = await modder.resolve({ request: req })
    await modder.settled()
    expect(reply.outcome).toBe('failed')
    expect(audits).toBe(2) // asked once more
    expect(library.lib.rules.has('patch/stone-sapped')).toBe(false)
    expect(state.episode(reply.episode!)!.attempts.at(-1)!.errors.join()).toMatch(/the audit failed \(model: no answer within 180000 ms\)/)
  })

  it('offline: an auditor that fails once and then answers lets a clean patch ship', async () => {
    const req = useRequest()
    let audits = 0
    const model = new ScriptedModel((_m: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'audit') {
        if (audits++ === 0) throw new Error('model: no answer within 180000 ms')
        return { findings: [] }
      }
      if (opts.purpose === 'design') return { patch: placedSap(req), summary: 'sap wets the stone' }
      return { verdict: 'ship', notes: [] }
    })
    const { library, modder } = modderWith(model, 'offline', (h) => ({ audit: { ...auditOf(h), rounds: 0 }, review: { ...h.review, enabled: false } }))
    expect((await modder.resolve({ request: req })).outcome).toBe('accepted')
    expect(library.lib.rules.has('patch/stone-sapped')).toBe(true)
  })
})

describe('a blocking review ships only what it let through', () => {
  /** A modder whose designer answers with the drafts in turn and whose reviewer gives the verdicts in turn. */
  const scriptedReview = (drafts: Patch[], verdicts: string[]) => {
    const calls = { design: 0, review: 0 }
    const model = new ScriptedModel((_m: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'review') return { verdict: verdicts[Math.min(calls.review++, verdicts.length - 1)], notes: ['The sap should not reach a dry stone.'] }
      if (opts.purpose === 'design') return { patch: drafts[Math.min(calls.design++, drafts.length - 1)], summary: 'sap' }
      return {}
    })
    return { model, calls }
  }
  const noAudit = (h: Harness): Partial<Harness> => ({ audit: { ...auditOf(h), enabled: false } })

  it('a revision is reviewed too, and one sent back again does not ship (D6)', async () => {
    const req = useRequest()
    const { model, calls } = scriptedReview([placedSap(req)], ['revise'])
    const { library, modder } = modderWith(model, 'offline', noAudit)
    const reply = await modder.resolve({ request: req })
    expect(calls.review).toBe(2) // the draft, and its one revision (review.maxRounds 1)
    expect(reply.outcome).toBe('failed')
    expect(library.lib.rules.has('patch/stone-sapped')).toBe(false)
  })

  it('the draft the reviewer sent back does not ship when its revision never validates (D6)', async () => {
    const req = useRequest()
    const broken = placedOnDeadTree(req, 'patch/stone-sapped', [{ op: 'no-such-effect' }])
    const { model } = scriptedReview([placedSap(req), broken], ['revise'])
    const { library, modder } = modderWith(model, 'offline', noAudit)
    const reply = await modder.resolve({ request: req })
    expect(reply.outcome).toBe('failed')
    expect(library.lib.rules.has('patch/stone-sapped')).toBe(false)
  })
})

describe('the review after the fact', () => {
  /** The live profile's own harness (review after shipping, only flagged rules), no auditor; counts the reviews. */
  const live = (patch: Patch) => {
    const calls = { review: 0 }
    const model = new ScriptedModel((_m: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'review') return calls.review++, { verdict: 'ship', notes: [] }
      return { patch: { ...patch, artifacts: patch.artifacts.map((a) => (a.kind === 'rule' ? { ...a, rule: { ...a.rule, tests: undefined } } : a)) }, summary: 's' }
    })
    return { model, calls }
  }
  const noAudit = (h: Harness): Partial<Harness> => ({ audit: { ...auditOf(h), enabled: false } })

  it('reviews a world-changing rule whose effects the harness\'s test cannot see (D9)', async () => {
    const req = useRequest()
    // a tag on the stone: it changes the world, and the derived test sees no tag (it checks only that the rule answers)
    const { model, calls } = live(placedOnDeadTree(req, 'patch/stone-scored', [{ op: 'addTag', tag: 'flammable' }]))
    const { state, modder } = modderWith(model, 'live', noAudit)
    expect(state.harness().review).toMatchObject({ enabled: true, blocking: false, unflagged: false })
    const reply = await modder.resolve({ request: req })
    expect(reply.outcome).toBe('accepted')
    expect(state.episode(reply.episode!)!.attempts.at(-1)!.derived?.join()).toMatch(/checks only that the rule answers/)
    await modder.settled()
    expect(calls.review).toBe(1)
    // one whose test holds it to what it does is not flagged (review.unflagged is off): no review after the fact
    const wet = live(placedSap(req))
    const second = modderWith(wet.model, 'live', noAudit)
    expect((await second.modder.resolve({ request: req })).outcome).toBe('accepted')
    await second.modder.settled()
    expect(wet.calls.review).toBe(0)
  })
})

describe('detecting what a model carries, while the backend throttles', () => {
  const detect = async (model: Model, reqs = [useRequest()]) => {
    const { modder } = modderWith(model, 'live')
    const detector = new Detector(modder, { probes: async () => reqs })
    expect(await detector.start()).toMatchObject({ started: true, total: 3 * reqs.length })
    while (detector.running) await new Promise((r) => setTimeout(r, 20))
    return detector
  }

  it('a rate limit gives no verdict, not the model "off" (D7)', async () => {
    const detector = await detect({ name: 'throttled', chat: async () => Promise.reject(new Error('HTTP 429: rate limit exceeded')) })
    expect(detector.error).toMatch(/unavailable during the detection/)
    expect(detector.last).toBeUndefined()
  })

  it('plays a few runs at once, not every question at every tier (D7)', async () => {
    let now = 0
    let most = 0
    const inner = new ScriptedModel((_m: ChatMessage[], opts: ChatOptions) => (opts.purpose === 'review' ? { verdict: 'ship', notes: [] } : { patch: placedSap(useRequest()), summary: 's' }))
    const model: Model = {
      name: 'slow',
      chat: async (m, o) => {
        most = Math.max(most, ++now)
        await new Promise((r) => setTimeout(r, 30))
        now--
        return inner.chat(m, o)
      },
    }
    // three questions of three classes (a class asked at once waits for the first): nine runs
    const detector = await detect(model, [DEAD_TREE, 'fixture/nature/beehive', 'fixture/nature/haystack'].map((t, i) => ({ ...useRequest(t), id: `q${i}` })))
    expect(detector.error).toBeUndefined()
    expect(detector.last?.runs).toHaveLength(9)
    expect(most).toBeLessThanOrEqual(2) // DETECT_AT_ONCE (the service's own gate lets 4 designs in at once)
  })
})

describe('detecting what a model carries, after the game grew', () => {
  it('a question the base rules answer now is not played: no model is asked, and it is no failure of the model', async () => {
    const req = useRequest()
    // the service's base rules grew since the question was asked: the stone on a dead tree is the game's own now
    const answered: Rule = { id: 'core/stone-on-dead-tree', host: { type: STONE }, on: 'act/use', tree: { if: { is: { role: 'target', sel: { type: DEAD_TREE } } }, then: { do: [{ op: 'log', text: { en: 'Nothing.', zh: '没什么。' } }] }, else: 'inherit' } }
    let calls = 0
    const dir = mkdtempSync(join(tmpdir(), 'lsw-guards-'))
    const library = new WorldLibrary(onto, [...BASE, answered], join(dir, 'library.jsonl'))
    const modder = new Modder({ library, state: SelfState.open(join(dir, 'modder-state')), model: new ScriptedModel(async () => (calls++, {})) })
    expect(gatherProbes(modder, [req])).toEqual([])
    // played, it would have been three failed runs and the things "off"
    expect(await new Detector(modder, { probes: async () => [req] }).start()).toMatchObject({ started: false })
    expect(calls).toBe(0)
  })
})
