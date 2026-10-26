import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, placePatch, withArtifacts, type ModRequest, type Patch, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { Modder, ScriptedModel, SelfState, WorldLibrary, audit, auditOf, confirm, type ChatMessage, type ChatOptions, type Finding } from '../src/index.ts'

// The auditor (audit.ts, design.md §13): an agent plays against a patch in the sandbox, out to break
// the game. Its findings are setups, steps and claims; the sandbox decides: a finding counts only
// when it holds with the patch and not without it.

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const BANE = 'item/weapon/blade/dragonsbane'
const STONE = 'item/material/stone'

/** The stone used on a dead tree (a creature would be offered it): a hole in the stone's own nature (`core/use`). */
function useRequest(): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: 'fixture/nature/dead_tree', x: 2, y: 1 },
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
/** Valid, one for one, and a cheap road to the rarest blade in the world. */
const bane = onDeadTree('patch/stone-bane', [{ op: 'transform', into: BANE }, { op: 'log', text: { en: 'The stone is honed into a blade.', zh: '石头磨成了一把剑。' } }])
/** The same act, harmless: the dead tree only creaks (narration only: nothing for the auditor to break). */
const sniff = onDeadTree('patch/stone-creak', [{ op: 'log', text: { en: '{target} creaks under {instrument}.', zh: '{instrument}敲得{target}吱呀作响。' } }])
/** Harmless too, though it changes something: the dead tree's sap wets the stone. */
const slobber = onDeadTree('patch/stone-sapped', [{ op: 'addStatus', status: 'wet', duration: 10 }, { op: 'log', text: { en: '{target} drips sap on {instrument}.', zh: '{target}的树液把{instrument}弄湿了。' } }])
const becomesBane: Finding = { title: 'a stone becomes Dragonsbane', kind: 'value', steps: [{ act: 'use', target: 'target', instrument: 'instrument' }], expect: [{ is: { key: 'instrument', type: BANE } }] }

describe('confirm: the sandbox judges a finding', () => {
  const req = useRequest()
  const base = new RuleLibrary(BASE)
  /** A draft placed where the request fell undefined (design.md §5.16): only a placed rule is consulted. */
  const put = (p: Patch) => placePatch(p, req).patch

  it('counts what holds with the patch and not without it, with the evidence', () => {
    const c = confirm(becomesBane, req.scenario, onto, base, withArtifacts(base, put(bane)))
    expect('evidence' in c && c.evidence).toMatch(/dragonsbane \+1/)
  })

  it('does not count a claim that does not hold, nor one the world already makes true', () => {
    const twice: Finding = { ...becomesBane, expect: [{ count: { type: BANE, atLeast: 2 } }] }
    expect(confirm(twice, req.scenario, onto, base, withArtifacts(base, put(bane)))).toMatchObject({ why: expect.stringMatching(/does not hold/) })
    const already: Finding = { ...becomesBane, expect: [{ is: { key: 'actor', type: 'actor/person/player' } }] }
    expect(confirm(already, req.scenario, onto, base, withArtifacts(base, put(bane)))).toMatchObject({ why: expect.stringMatching(/without the patch too/) })
    expect(confirm(becomesBane, req.scenario, onto, base, withArtifacts(base, put(sniff)))).toMatchObject({ why: expect.stringMatching(/does not hold/) })
  })

  it('counts a farm: a use that leaves a stone and costs nothing, again and again', () => {
    const farm = onDeadTree('patch/stone-farm', [{ op: 'spawn', type: STONE, at: 'actor', into: 'contents' }])
    const f: Finding = { title: 'stones for nothing', kind: 'farm', steps: [{ repeat: 30, steps: [{ act: 'use', target: 'target', instrument: 'instrument' }] }], expect: [{ count: { type: STONE, in: 'actor', atLeast: 30 } }] }
    expect('evidence' in confirm(f, req.scenario, onto, base, withArtifacts(base, put(farm)))).toBe(true)
  })

  it('runs only so much: a finding that asks for a billion steps is cut short', () => {
    const f: Finding = { ...becomesBane, steps: [{ repeat: 1e9, steps: [{ tick: 1e9 }] }] }
    const t = Date.now()
    confirm(f, req.scenario, onto, base, withArtifacts(base, put(bane)))
    expect(Date.now() - t).toBeLessThan(30_000)
  }, 60_000)
})

/** A scripted modder: the design answers with the drafts in turn; the auditor runs its steps, then reports. */
function scripted(drafts: Patch[], report: Finding[]) {
  const calls = { design: 0, audit: 0, auditTools: 0 }
  const model = new ScriptedModel((messages: ChatMessage[], opts: ChatOptions) => {
    if (opts.purpose === 'audit') {
      calls.audit++
      // first the run (with tools), then the report
      if (opts.tools && !messages.some((m) => m.role === 'tool')) {
        calls.auditTools++
        return { content: '', toolCalls: [{ id: 'a1', name: 'run', args: { steps: report[0]?.steps ?? [] } }] }
      }
      return { findings: report }
    }
    if (opts.purpose === 'design') return { patch: drafts[Math.min(calls.design++, drafts.length - 1)], summary: 'a stone on a dead tree' }
    return {}
  })
  return { model, calls }
}

function setup(model: ScriptedModel, profile: 'live' | 'offline') {
  const dir = mkdtempSync(join(tmpdir(), 'lsw-audit-'))
  const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
  const state = SelfState.open(join(dir, 'modder-state'))
  const h = state.harness()
  state.setHarness({ ...h, audit: { ...auditOf(h), rounds: 2 }, review: { ...h.review, enabled: false }, reflect: { ...h.reflect, enabled: false }, escalate: false, revise: false, offline: { ...h.offline, design: { ...h.offline.design, mode: 'json' } } }, 'test: the auditor alone')
  return { library, state, modder: new Modder({ library, state, model, profile }) }
}

describe('audit: each finding judged on its own', () => {
  it('a finding the sandbox cannot judge (a claim of no known shape) is unconfirmed; the one it confirms still counts', async () => {
    const req = useRequest()
    const base = new RuleLibrary(BASE)
    const sloppy = { title: 'something', kind: 'other', steps: becomesBane.steps, expect: [{ prop: null }] } as unknown as Finding
    const model = new ScriptedModel(() => ({ findings: [becomesBane, sloppy] }))
    const out = await audit(model, 'system', 'user', req, onto, base, placePatch(bane, req).patch, { rounds: 0 })
    expect(out.confirmed.map((c) => c.title)).toEqual([becomesBane.title])
    expect(out.unconfirmed).toMatchObject([{ finding: { title: 'something' }, why: expect.stringMatching(/could not be judged/) }])
  })
})

describe('the auditor in the pipeline', () => {
  it('live: the patch ships, then the auditor breaks it in the sandbox, and it leaves the library', async () => {
    const { model, calls } = scripted([bane], [becomesBane])
    const { library, modder } = setup(model, 'live')
    const reply = await modder.resolve({ request: useRequest() })
    expect(reply.outcome).toBe('accepted')
    await modder.settled()
    expect(calls.auditTools).toBe(1)
    expect(library.lib.rules.has('patch/stone-bane')).toBe(false)
  })

  it('live: a claim the sandbox does not bear out changes nothing', async () => {
    const { model, calls } = scripted([slobber], [becomesBane])
    const { library, modder } = setup(model, 'live')
    expect((await modder.resolve({ request: useRequest() })).outcome).toBe('accepted')
    await modder.settled()
    expect(calls.auditTools).toBe(1)
    expect(library.lib.rules.has('patch/stone-sapped')).toBe(true)
  })

  it('live: a patch that only narrates is not audited (no call), and the journal says why', async () => {
    const { model, calls } = scripted([sniff], [becomesBane])
    const { library, state, modder } = setup(model, 'live')
    const reply = await modder.resolve({ request: useRequest() })
    expect(reply.outcome).toBe('accepted')
    await modder.settled()
    expect(calls.audit).toBe(0)
    expect(library.lib.rules.has('patch/stone-creak')).toBe(true)
    expect(state.journalOf('audit')).toMatchObject([{ episode: reply.episode, rules: ['patch/stone-creak'], skipped: 'narrates only', usage: { calls: 0 } }])
  })

  it('live: an auditor that fails keeps the patch, and the journal says it failed (not that it found nothing)', async () => {
    let audits = 0
    const model = new ScriptedModel((_messages: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'audit') {
        audits++
        throw new Error('model: no answer within 180000 ms')
      }
      if (opts.purpose === 'design') return { patch: bane, summary: 'a stone honed into a blade' }
      return {}
    })
    const { library, state, modder } = setup(model, 'live')
    const reply = await modder.resolve({ request: useRequest() })
    expect(reply.outcome).toBe('accepted')
    await modder.settled()
    expect(audits).toBe(1)
    expect(library.lib.rules.has('patch/stone-bane')).toBe(true)
    expect(state.journalOf('audit')).toMatchObject([{ episode: reply.episode, confirmed: [], error: 'model: no answer within 180000 ms' }])
  })

  it('offline: a draft the auditor breaks goes back with the evidence; the next one ships', async () => {
    const { model, calls } = scripted([bane, sniff], [becomesBane])
    const { library, modder } = setup(model, 'offline')
    const reply = await modder.resolve({ request: useRequest() })
    expect(reply.outcome).toBe('accepted')
    expect(calls.design).toBe(2)
    // the second draft only narrates: it is not audited again
    expect(calls.auditTools).toBe(1)
    expect(library.lib.rules.has('patch/stone-bane')).toBe(false)
    expect(library.lib.rules.has('patch/stone-creak')).toBe(true)
  })
})
