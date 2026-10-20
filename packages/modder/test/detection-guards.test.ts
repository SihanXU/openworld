// Guards on the detection side of the modder: the deterministic fixes laid on a model's draft, the
// auditor's probe and its evidence, the blocking audit and review, the review after the fact, and the
// detection of what a model carries. Each test names the defect it holds shut.

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, placePatch, type ModRequest, type Patch, type Rule, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { Modder, ScriptedModel, SelfState, WorldLibrary, auditOf, auditTools, changesNothing, probe, stationFromRules, withPatch, type ChatMessage, type ChatOptions, type Harness, type Model } from '../src/index.ts'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const STONE = 'item/material/stone'
const TREE = 'fixture/nature/dead_tree'

/** The stone used on a dead tree: a hole in the stone's own nature (`core/use`), the stone the host. */
function useRequest(): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: TREE, x: 2, y: 1 },
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  expect(eng.act('use', 'actor', { e: 'it' }).defined).toBe(false)
  return port.records[0].request
}

/** A learned rule for the stone on the dead tree, placed where the request fell undefined. */
const onDeadTree = (req: ModRequest, id: string, effects: unknown[]): Patch =>
  placePatch({ artifacts: [{ kind: 'rule', rule: { id, host: { type: STONE }, on: 'act/use', label: { en: 'Use {instrument} on {target}', zh: '对{target}使用{instrument}' }, doc: 'd', tree: { if: { is: { role: 'target', sel: { type: TREE } } }, then: { do: effects as never }, else: { undefined: true } } } }] }, req).patch

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
    const farm = onDeadTree(req, 'patch/stone-hones', [{ op: 'addProp', key: 'power', delta: 2 }])
    const found = probe(req, onto, base, withPatch(base, farm))
    expect(found.map((f) => f.kind)).toEqual(['farm'])
    expect(found[0].title).toMatch(/power every time/)
    // a number that rises once and stops (capped) is no farm
    const capped = onDeadTree(req, 'patch/stone-hones-once', [{ op: 'addProp', key: 'power', delta: 2, max: 2 }])
    expect(probe(req, onto, base, withPatch(base, capped))).toEqual([])
  })
})

describe('the auditor sees what the engine refused', () => {
  it('lists a refused effect among the warnings of a run (its dev line, "rule …")', () => {
    const req = useRequest()
    const base = new RuleLibrary(BASE)
    const bad = onDeadTree(req, 'patch/stone-unheals', [{ op: 'heal', amount: -5 }])
    const tool = auditTools(req.scenario, onto, base, withPatch(base, bad)).find((t) => t.name === 'run')!
    const out = tool.run({ steps: [{ act: 'use', target: req.scenario.event.target, instrument: req.scenario.event.instrument }] })
    expect(out).toMatch(/warnings: rule patch\/stone-unheals: a heal of -5/)
  })
})

describe('narration in place of a default that does something is a change', () => {
  it('a log-only answer to core/break, whose default drops and destroys, changes something (D10)', () => {
    const words: Rule = { id: 'patch/pot-creaks', host: { type: 'item/container/pot' }, on: 'threshold/cross', doc: 'd', tree: { do: [{ op: 'log', text: { en: '{host} creaks.', zh: '{host}吱呀作响。' } }] } }
    // nothing it says changes the world by itself...
    expect(changesNothing(words)).toBe(true)
    expect(changesNothing(words, [{ op: 'log', text: 'Nothing happens.' }])).toBe(true)
    // ...but in place of the thing breaking (core/break) or the story's fallback (core/broken), it keeps them from happening
    expect(changesNothing(words, [{ op: 'dropContents' }, { op: 'destroy' }] as never)).toBe(false)
    expect(changesNothing(words, [{ op: 'fallback' }] as never)).toBe(false)
    // a tree that leaves every case open replaces nothing: the default still runs
    expect(changesNothing({ ...words, tree: { undefined: true } }, [{ op: 'destroy' }] as never)).toBe(true)
  })
})

/** A modder over the base game; the harness as the test says (no reflection, escalation or revision unless it says). */
function modderWith(model: Model, profile: 'live' | 'offline', over: (h: Harness) => Partial<Harness> = () => ({})) {
  const dir = mkdtempSync(join(tmpdir(), 'lsw-guards-'))
  const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
  const state = SelfState.open(join(dir, 'modder-state'))
  const h = state.harness()
  state.setHarness({ ...h, reflect: { ...h.reflect, enabled: false }, escalate: false, revise: false, offline: { ...h.offline, design: { ...h.offline.design, mode: 'json' } }, ...over(h) }, 'test: detection guards')
  return { library, state, modder: new Modder({ library, state, model, profile }) }
}

/** Harmless, though it changes something (the probe finds nothing in it): the dead tree's sap wets the stone. */
const sapped = (req: ModRequest) => onDeadTree(req, 'patch/stone-sapped', [{ op: 'addStatus', status: 'wet', duration: 10 }, { op: 'log', text: { en: '{target} drips sap on {instrument}.', zh: '{target}的树液把{instrument}弄湿了。' } }])

describe('a blocking audit that fails is no audit', () => {
  it('offline: the auditor times out twice, and the patch is not committed unaudited (D5)', async () => {
    const req = useRequest()
    let audits = 0
    const model = new ScriptedModel((_m: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'audit') {
        audits++
        throw new Error('model: no answer within 180000 ms')
      }
      if (opts.purpose === 'design') return { patch: sapped(req), summary: 'sap wets the stone' }
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
      if (opts.purpose === 'design') return { patch: sapped(req), summary: 'sap wets the stone' }
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
    const { model, calls } = scriptedReview([sapped(req)], ['revise'])
    const { library, modder } = modderWith(model, 'offline', noAudit)
    const reply = await modder.resolve({ request: req })
    expect(calls.review).toBe(2) // the draft, and its one revision (review.maxRounds 1)
    expect(reply.outcome).toBe('failed')
    expect(library.lib.rules.has('patch/stone-sapped')).toBe(false)
  })

  it('the draft the reviewer sent back does not ship when its revision never validates (D6)', async () => {
    const req = useRequest()
    const broken = onDeadTree(req, 'patch/stone-sapped', [{ op: 'no-such-effect' }])
    const { model } = scriptedReview([sapped(req), broken], ['revise'])
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
    const { model, calls } = live(onDeadTree(req, 'patch/stone-scored', [{ op: 'addTag', tag: 'flammable' }]))
    const { state, modder } = modderWith(model, 'live', noAudit)
    expect(state.harness().review).toMatchObject({ enabled: true, blocking: false, unflagged: false })
    const reply = await modder.resolve({ request: req })
    expect(reply.outcome).toBe('accepted')
    expect(state.episode(reply.episode!)!.attempts.at(-1)!.derived?.join()).toMatch(/checks only that the rule answers/)
    await modder.settled()
    expect(calls.review).toBe(1)
    // one whose test holds it to what it does is not flagged (review.unflagged is off): no review after the fact
    const wet = live(sapped(req))
    const second = modderWith(wet.model, 'live', noAudit)
    expect((await second.modder.resolve({ request: req })).outcome).toBe('accepted')
    await second.modder.settled()
    expect(wet.calls.review).toBe(0)
  })
})
