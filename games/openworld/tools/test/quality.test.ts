// The AI setting (design.md §13): a level per kind of work, the same wait at every level, a tier's
// answers kept in their own trees — an answer serves its own tier and the lower ones, never a higher —
// the workload of a tier over the harness, and the detection of what a model carries.

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ModPort,
  PRESETS,
  RuleLibrary,
  buildSandbox,
  categoryOf,
  categoryOfRequest,
  placePatch,
  presetOf,
  qualityOf,
  tiersFrom,
  validatePatch,
  type AiQuality,
  type ModRequest,
  type Patch,
  type Rule,
  type Scenario,
  type Tier,
} from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { Detector, Modder, ScriptedModel, SelfState, WorldLibrary, auditOf, envelope, gatherProbes, recommendOf, withoutChains, workloadOf, type ChatOptions, type DetectRun } from '@openworld/modder'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const STONE = 'item/material/stone'
const TREE = 'fixture/nature/dead_tree'
const SLIME = 'actor/creature/slime/green_slime'

const scene = (target = TREE): Scenario => ({
  entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' },
    { key: 'it', type: target, x: 2, y: 1 },
    { key: 'pebble', type: STONE, x: 3, y: 3 },
  ],
  event: {},
})

const at = (level: AiQuality['things']): AiQuality => ({ ...PRESETS[level] })

/** The stone used on a dead tree (a hole in the stone's own nature), asked at a setting. */
function ask(level: AiQuality['things'] = 'medium', lib = new RuleLibrary(BASE)) {
  const eng = buildSandbox(scene(), onto, lib)
  eng.quality = at(level)
  const port = new ModPort(eng)
  const res = eng.act('use', 'actor', { e: 'it' })
  return { eng, port, res, req: port.records[0]?.request as ModRequest }
}

const answer = (id: string, text: string): Patch => ({ artifacts: [{ kind: 'rule', rule: { id, host: { type: 'x' }, on: 'x', label: 'Tap {target}', doc: text, tree: { do: [{ op: 'log', text }] } } }] })
const ruleOf = (p: Patch) => (p.artifacts[0] as { rule: Rule }).rule
/** Which learned rule answers the stone on the tree at a setting, in this library. */
const answeredBy = (lib: RuleLibrary, level: AiQuality['things']) => {
  const { eng } = ask(level, lib.clone())
  const res = eng.resolveEvent(eng.actEvent('use', 'actor', { e: 'it' }, { e: 'held' }))
  return res.defined ? res.rule?.id : undefined
}

describe('the kinds of work', () => {
  it('the player on a thing, on a creature, on themselves; the world by itself — the engine and the request agree', () => {
    const eng = buildSandbox(scene(SLIME), onto, new RuleLibrary(BASE))
    const use = eng.actEvent('use', 'actor', { e: 'it' }, { e: 'held' })
    expect(categoryOf(eng.world, use)).toBe('things') // the stone is the host of a use
    const offered = { kind: 'impulse/offered' as const, host: { e: 'it' }, roles: { actor: { e: 'actor' }, item: { e: 'held' } }, params: {}, cause: 'actor', origin: 'player' as const }
    expect(categoryOf(eng.world, offered)).toBe('people')
    expect(categoryOf(eng.world, { ...offered, origin: 'world' })).toBe('world')
    expect(categoryOf(eng.world, { ...offered, host: { e: 'actor' } })).toBe('things') // on oneself
    const { req } = ask()
    expect(categoryOfRequest(req)).toBe('things')
    expect(categoryOfRequest({ ...req, origin: 'world' })).toBe('world')
  })

  it('a setting read back keeps what it says and takes the default for the rest; presets are named', () => {
    expect(qualityOf({ things: 'low', people: 'ultra', create: 'off' })).toEqual({ ...PRESETS.medium, things: 'low', create: 'off' })
    expect(qualityOf('junk')).toEqual(PRESETS.medium)
    expect(presetOf(PRESETS.high)).toBe('high')
    expect(presetOf({ ...PRESETS.high, world: 'low' })).toBeUndefined()
    expect(tiersFrom('low')).toEqual(['low', 'medium', 'high'])
    expect(tiersFrom('high')).toEqual(['high'])
  })
})

describe('a level off', () => {
  it('asks no one: the default runs at once, the record stays open, and what was learned still answers', async () => {
    let asked = 0
    const { eng, port } = (() => {
      const eng = buildSandbox(scene(), onto, new RuleLibrary(BASE))
      eng.quality = { ...PRESETS.medium, things: 'off' }
      const port = new ModPort(eng)
      port.provider = { resolve: async () => (asked++, null) }
      return { eng, port }
    })()
    expect(eng.act('use', 'actor', { e: 'it' }).defined).toBe(false)
    const rec = port.records[0]
    expect(rec.status).toBe('fallback')
    expect(eng.world.fx.some((f) => f.t === 'undefined' && !f.asked)).toBe(true)
    await Promise.resolve()
    expect(asked).toBe(0)
    // an answer the library brings is still taken, and answers from then on
    expect(port.submit(rec.id, placePatch(answer('patch/stone-tree', 'tap'), rec.request).patch).ok).toBe(true)
    expect(eng.resolveEvent(eng.actEvent('use', 'actor', { e: 'it' }, { e: 'held' })).rule?.id).toBe('patch/stone-tree')
  })
})

describe('answers kept by tier', () => {
  it('a request carries its tier; the answer is placed in that tier; the view widens with the tier', () => {
    const low = ask('low').req
    const high = ask('high').req
    expect(low.tier).toBe('low')
    expect(low.scenario.tier).toBe('low')
    expect(ruleOf(placePatch(answer('patch/a', 'a'), low).patch).tier).toBe('low')
    expect(ruleOf(placePatch(answer('patch/a', 'a'), ask('medium').req).patch).tier).toBeUndefined() // medium: as before
    // what the AI is shown: little at low, more at high
    expect(low.context.tiles.length).toBe(3)
    expect(low.context.nearby).toEqual([])
    expect(high.context.tiles.length).toBe(7)
    expect(high.context.nearby.length).toBeGreaterThanOrEqual(ask('medium').req.context.nearby.length)
    expect(high.create).toBe('high')
  })

  it('an answer serves its tier and the ones below; its own tier first; never a higher one', () => {
    const lib = new RuleLibrary(BASE)
    // a low answer first: the low setting has it, medium and high do not
    const lo = ask('low', lib)
    expect(lo.port.submit(lo.req.id, placePatch(answer('patch/tap-low', 'low'), lo.req).patch).ok).toBe(true)
    expect(answeredBy(lo.eng.lib, 'low')).toBe('patch/tap-low')
    expect(answeredBy(lo.eng.lib, 'medium')).toBeUndefined()
    expect(answeredBy(lo.eng.lib, 'high')).toBeUndefined()
    // a high answer: it serves medium (nothing of its own there) and high; low keeps its own
    const hi = ask('high', lo.eng.lib.clone())
    expect(hi.res.defined).toBe(false)
    expect(hi.port.submit(hi.req.id, placePatch(answer('patch/tap-high', 'high'), hi.req).patch).ok).toBe(true)
    expect(answeredBy(hi.eng.lib, 'low')).toBe('patch/tap-low')
    expect(answeredBy(hi.eng.lib, 'medium')).toBe('patch/tap-high')
    expect(answeredBy(hi.eng.lib, 'high')).toBe('patch/tap-high')
    expect(answeredBy(hi.eng.lib, 'off')).toBe('patch/tap-low') // off asks nothing and takes every tier's
    // a medium question is answered by the high answer: nothing to ask
    expect(ask('medium', hi.eng.lib.clone()).res.defined).toBe(true)
  })

  it('an answer of another tier than the question asked is refused', () => {
    const { req, eng } = ask('low')
    const wrong: Patch = { artifacts: [{ kind: 'rule', rule: { ...ruleOf(placePatch(answer('patch/x', 'x'), req).patch), tier: 'high' } }] }
    expect(validatePatch(wrong, { ontology: onto, library: eng.lib, scenario: req.scenario }).errors.join()).toMatch(/asked at the low tier, not the high/)
    const bogus: Patch = { artifacts: [{ kind: 'rule', rule: { ...ruleOf(wrong), tier: 'ultra' as Tier } }] }
    expect(validatePatch(bogus, { ontology: onto, library: eng.lib }).errors.join()).toMatch(/tier must be one of low\|medium\|high/)
  })

  it('the shared library: a higher answer covers a lower question, a lower one never a higher', () => {
    const library = new WorldLibrary(onto, BASE)
    const low = ask('low').req
    expect(library.commit(placePatch(answer('patch/tap-low', 'low'), low).patch, low).ok).toBe(true)
    expect(library.covering(low)?.rule).toBe('patch/tap-low')
    const high = ask('high').req
    expect(library.covering(high)).toBeUndefined()
    expect(library.commit(placePatch(answer('patch/tap-high', 'high'), high).patch, high).ok).toBe(true)
    expect(library.covering(ask('medium').req)?.rule).toBe('patch/tap-high')
    expect(library.covering(low)?.rule).toBe('patch/tap-low')
  })
})

describe('the workload of a tier', () => {
  const h = SelfState.open(mkdtempSync(join(tmpdir(), 'lsw-q-'))).harness()

  it('medium is the harness; low does less; high does more; never more time', () => {
    expect(envelope(h, workloadOf({ tier: 'medium', scenario: { entities: [], event: {} } }))).toBe(h)
    const low = envelope(h, workloadOf({ tier: 'low', scenario: { entities: [], event: {}, tier: 'low' } }))
    expect(low.design.reasoning).toBe('none')
    expect(low.repair.maxRounds).toBe(0)
    expect([low.review.enabled, auditOf(low).enabled, low.escalate, low.revise]).toEqual([false, false, false, false])
    const high = envelope(h, workloadOf({ scenario: { entities: [], event: {}, tier: 'high' } }))
    expect(high.design.reasoning).toBe('medium')
    expect(high.repair.maxRounds).toBeGreaterThanOrEqual(2)
    expect(high.review).toMatchObject({ enabled: true, blocking: true })
    for (const x of [low, high]) expect([x.design.hedgeMs, x.design.deadlineMs]).toEqual([h.design.hedgeMs, h.design.deadlineMs])
    expect(workloadOf({ scenario: { entities: [], event: {}, tier: 'low' } })).toMatchObject({ find: false, chains: false, create: 'medium' })
  })

  it('a low answer changes its host only: the impulses it sends elsewhere are taken out', () => {
    const p: Patch = { artifacts: [{ kind: 'rule', rule: { id: 'patch/x', host: { type: STONE }, on: 'act/use', tree: { if: { chance: 0.5 }, then: { do: [{ op: 'emit', impulse: 'strike', to: 'target' }, { op: 'log', text: 'thud' }] }, else: { do: [] } } } }] }
    const { patch, fixes } = withoutChains(p)
    expect(fixes).toHaveLength(1)
    expect(JSON.stringify(patch)).not.toMatch(/emit/)
    expect(withoutChains(patch).patch).toBe(patch)
  })
})

describe('the pipeline at each tier', () => {
  const draft = (req: ModRequest) => ({ patch: { artifacts: [{ kind: 'rule', rule: { id: 'patch/stone-taps-tree', host: { type: STONE }, on: 'act/use', label: { en: 'Tap {target}', zh: '敲{target}' }, doc: 'A stone taps a tree.', tree: { do: [{ op: 'emit', impulse: 'strike', to: 'target' }, { op: 'log', text: { en: 'Tap.', zh: '嗒。' } }] } } }] } })
  function setup() {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-q-'))
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const state = SelfState.open(join(dir, 'modder-state'))
    state.setHarness({ ...state.harness(), reflect: { ...state.harness().reflect, enabled: false } }, 'test: no reflection')
    const calls: { purpose?: string; opts: ChatOptions }[] = []
    let req!: ModRequest
    const model = new ScriptedModel((_m, opts) => {
      calls.push({ purpose: opts.purpose, opts })
      if (opts.purpose === 'review') return { verdict: 'ship', notes: [] }
      if (opts.purpose === 'audit') return { findings: [] }
      return draft(req)
    })
    const modder = new Modder({ library, state, model })
    return { modder, state, library, calls, ask: (r: ModRequest) => ((req = r), modder.resolve({ request: r })) }
  }

  it('low: one call, no reasoning, the host changed only, nothing after it ships', async () => {
    const s = setup()
    const reply = await s.ask(ask('low').req)
    expect(reply.outcome).toBe('accepted')
    expect(JSON.stringify(reply.patch)).not.toMatch(/emit/)
    expect(ruleOf(reply.patch!).tier).toBe('low')
    await s.modder.settled()
    expect(s.calls.map((c) => c.purpose)).toEqual(['design'])
    expect(s.calls[0].opts.reasoning).toBe('none')
    expect(s.state.episode(reply.episode!)?.quality).toEqual({ tier: 'low', create: 'low' })
  })

  it('high: more reasoning, and a review before it ships, on the fast providers', async () => {
    const s = setup()
    const reply = await s.ask(ask('high').req)
    expect(reply.outcome).toBe('accepted')
    expect(ruleOf(reply.patch!).tier).toBe('high')
    // reviewed before the reply came: the review is already in
    const before = s.calls.map((c) => c.purpose)
    expect(before.slice(0, 2)).toEqual(['design', 'review'])
    expect(s.calls[0].opts.reasoning).toBe('medium')
    expect(s.calls[1].opts.deadlineMs).toBe(s.state.harness().design.deadlineMs)
    await s.modder.settled()
  })

  it('making new kinds off: a request to create is sent back, and the answer uses what the world has', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-q-'))
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const state = SelfState.open(join(dir, 'modder-state'))
    state.setHarness({ ...state.harness(), reflect: { ...state.harness().reflect, enabled: false }, audit: { ...auditOf(state.harness()), enabled: false }, review: { ...state.harness().review, enabled: false } }, 'test: bare')
    const req = { ...ask('medium').req, create: 'off' as const }
    const said: string[] = []
    const model = new ScriptedModel((messages, opts) => {
      said.push(messages.at(-1)!.content)
      if (opts.purpose !== 'design') return {}
      return said.length === 1 ? { create: [{ id: 'item/material/glowstone', name: { en: 'Glowstone', zh: '辉石' }, why: 'a stone that glows' }] } : draft(req)
    })
    const reply = await new Modder({ library, state, model }).resolve({ request: req })
    expect(said[0]).toMatch(/Making new kinds is off/)
    expect(said[1]).toMatch(/Making new kinds is off at this setting/)
    expect(reply.outcome).toBe('accepted')
  })
})

describe('detecting what a model carries', () => {
  const run = (category: DetectRun['category'], tier: Tier, ok: boolean): DetectRun => ({ probe: 'p', summary: 's', category, tier, ok, outcome: ok ? 'accepted' : 'failed', ms: 1000, cost: 0, calls: 1 })

  it('recommends, per kind of work, the highest tier answered in time often enough', () => {
    const runs = [
      ...['low', 'medium', 'high'].flatMap((t) => [run('things', t as Tier, true), run('things', t as Tier, true)]),
      run('people', 'low', true), run('people', 'medium', true), run('people', 'high', false),
      run('world', 'low', false), run('world', 'medium', false), run('world', 'high', false),
    ]
    expect(recommendOf(runs)).toEqual({ things: 'high', people: 'medium', world: 'off', create: 'high' })
    expect(recommendOf([]).things).toBe('medium')
  })

  it('plays the game\'s probes at every tier on the base game alone, and keeps nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-q-'))
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const state = SelfState.open(join(dir, 'modder-state'))
    state.setHarness({ ...state.harness(), reflect: { ...state.harness().reflect, enabled: false } }, 'test: no reflection')
    const model = new ScriptedModel((_m, opts) => {
      if (opts.purpose === 'review') return { verdict: 'ship', notes: [] }
      return { patch: { artifacts: [{ kind: 'rule', rule: { id: `patch/tap-${Math.random().toString(36).slice(2, 7)}`, host: { type: STONE }, on: 'act/use', label: 'Tap {target}', doc: 'tap', tree: { do: [{ op: 'log', text: 'tap' }] } } }] } }
    })
    const req = ask('medium').req
    const modder = new Modder({ library, state, model, probes: async () => [req] })
    expect(gatherProbes(modder, [req]).map((p) => p.category)).toEqual(['things'])
    const detector = new Detector(modder, { probes: modder.opts.probes })
    expect(await detector.plan()).toMatchObject({ probes: 1, runs: 3 })
    expect(await detector.start()).toMatchObject({ started: true, total: 3 })
    while (detector.running) await new Promise((r) => setTimeout(r, 20))
    expect(detector.error).toBeUndefined()
    expect(detector.last?.runs.map((r) => [r.tier, r.ok])).toEqual(expect.arrayContaining([['low', true], ['medium', true], ['high', true]]))
    expect(detector.last?.recommend.things).toBe('high')
    // nothing committed, nothing recorded
    expect(library.seq).toBe(0)
    expect(state.episodes()).toHaveLength(0)
  })
})
