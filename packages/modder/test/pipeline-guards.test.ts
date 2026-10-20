// The pipeline's bookkeeping around a shipped rule (pipeline.ts): which version a later removal takes,
// what a fault counts, how a revision after a fault is asked, which work waits for which.

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, placePatch, type ModRequest, type Patch, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { Modder, ScriptedModel, SelfState, WorldLibrary, auditOf, type ChatMessage, type ChatOptions, type Finding, type Model } from '../src/index.ts'

/** These commit and replay in the sandbox: under a full parallel run, slow. */
const SLOW = { timeout: 120_000 }

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const STONE = 'item/material/stone'
const BANE = 'item/weapon/blade/dragonsbane'

/** The stone used on a dead tree: a hole in the stone's own nature (`core/use`), as in audit.test.ts. */
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

const onDeadTree = (id: string, effects: unknown[]): Patch => ({
  artifacts: [{ kind: 'rule', rule: { id, host: { type: STONE }, on: 'act/use', label: { en: 'Use {instrument} on {target}', zh: '对{target}使用{instrument}' }, tree: { if: { is: { role: 'target', sel: { type: 'fixture/nature/dead_tree' } } }, then: { do: effects as never }, else: 'inherit' } } }],
})
/** A cheap road to the rarest blade (the auditor breaks it). */
const bane = (id = 'patch/stone-bane') => onDeadTree(id, [{ op: 'transform', into: BANE }, { op: 'log', text: { en: 'The stone is honed into a blade.', zh: '石头磨成了一把剑。' } }])
/** Harmless: the dead tree's sap wets the stone. */
const sapped = (id = 'patch/stone-bane') => onDeadTree(id, [{ op: 'addStatus', status: 'wet', duration: 10 }, { op: 'log', text: { en: '{target} drips sap on {instrument}.', zh: '{target}的树液把{instrument}弄湿了。' } }])
const becomesBane: Finding = { title: 'a stone becomes Dragonsbane', kind: 'value', steps: [{ act: 'use', target: 'target', instrument: 'instrument' }], expect: [{ is: { key: 'instrument', type: BANE } }] }

function setup(model: Model | undefined, profile: 'live' | 'offline', over: Record<string, unknown> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'lsw-pipeline-'))
  const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
  const state = SelfState.open(join(dir, 'modder-state'))
  const h = state.harness()
  state.setHarness({ ...h, audit: { ...auditOf(h), enabled: false }, review: { ...h.review, enabled: false }, reflect: { ...h.reflect, enabled: false }, escalate: false, revise: false, offline: { ...h.offline, design: { ...h.offline.design, mode: 'json' } }, ...over }, 'test: pipeline guards')
  return { library, state, modder: new Modder({ library, state, model, profile }) }
}

/** A promise and the hand that settles it. */
function gate<T = void>() {
  let open!: (v: T) => void
  const p = new Promise<T>((r) => (open = r))
  return { p, open }
}

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
