// The auditor (audit.ts, design.md §13): an agent plays against a patch in the sandbox, out to break
// the game. Its findings are setups, steps and claims; the sandbox decides: a finding counts only
// when it holds with the patch and not without it, and only as a harm the code recognizes (farm, value,
// harm to what the story needs, softlock, runaway). The finding's own `kind` is the auditor's guess; a
// reproduced effect that is none of them (a stone made wet, which is what a rule that wets stones is for)
// is not confirmed, and in live goes to a reviewer.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, placePatch, withArtifacts, type Patch } from '@openworld/engine'
import { ScriptedModel, audit, auditOf, confirm, type ChatMessage, type ChatOptions, type Finding } from '@openworld/ai'
import { BANE, BASE, HONE, SAP, STONE, becomesBane, jsonOffline, onDeadTree, onto, quiet, testModder, useRequest } from './fixtures.ts'

/** Valid, one for one, and a cheap road to the rarest blade in the world. */
const bane = onDeadTree('patch/stone-bane', HONE)
/** The same act, harmless: the dead tree only creaks (narration only: nothing for the auditor to break). */
const sniff = onDeadTree('patch/stone-creak', [{ op: 'log', text: { en: '{target} creaks under {instrument}.', zh: '{instrument}敲得{target}吱呀作响。' } }])
/** Harmless too, though it changes something: the dead tree's sap wets the stone. */
const slobber = onDeadTree('patch/stone-sapped', SAP)
const USE: Finding['steps'][number] = { act: 'use', target: 'target', instrument: 'instrument' }

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

/** The auditor alone: two rounds, nothing else after the answer. */
const setup = (model: ScriptedModel, profile: 'live' | 'offline') => testModder({ model, profile, harness: (h) => ({ audit: { ...auditOf(h), rounds: 2 }, ...quiet(h), ...jsonOffline(h) }) })

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

// The auditor's findings are harm by construction (audit.ts harmOf, design.md §13): a finding the sandbox reproduces
// counts only when the code sees one of the harms it recognizes in it (farm, value, harm to what the story needs,
// softlock, runaway). The finding's own `kind` is the auditor's guess; a reproduced effect that is none of them (a
// stone made wet, which is what a rule that wets stones is for) is not confirmed, and in live goes to a reviewer.

describe('a reproduced finding counts only as a harm the code recognizes', () => {
  const req = useRequest()
  const base = new RuleLibrary(BASE)
  const put = (p: Patch) => withArtifacts(base, placePatch(p, req).patch)

  it('a stone made wet, claimed as harm, is reproduced but not confirmed', () => {
    const wets = put(onDeadTree('patch/stone-sapped', [{ op: 'addStatus', status: 'wet', duration: 10 }, { op: 'log', text: { en: 'Sap drips.', zh: '树液滴落。' } }]))
    const claim: Finding = { title: 'the stone is wet', kind: 'harm', steps: [USE], expect: [{ status: { key: 'instrument', has: 'wet' } }] }
    expect(confirm(claim, req.scenario, onto, base, wets)).toMatchObject({ reproduced: true, why: expect.stringMatching(/no harm by construction/) })
  })

  it('value: a stone that becomes the rarest blade', () => {
    const bane = put(onDeadTree('patch/stone-bane', [{ op: 'transform', into: BANE }]))
    const c = confirm({ title: 'a stone becomes Dragonsbane', kind: 'value', steps: [USE], expect: [{ is: { key: 'instrument', type: BANE } }] }, req.scenario, onto, base, bane)
    expect(c).toMatchObject({ proven: 'value' })
  })

  it('farm: a stone given for nothing on every use grows with the repeats, whatever the finding calls itself', () => {
    const gives = put(onDeadTree('patch/stone-gives', [{ op: 'emit', impulse: 'offered', to: 'actor', params: {} }, { op: 'spawn', type: STONE, at: 'host' }]))
    const c = confirm({ title: 'stones pile up', kind: 'other', steps: [{ repeat: 10, steps: [USE] }], expect: [{ count: { type: STONE, atLeast: 5 } }] }, req.scenario, onto, base, gives)
    expect(c).toMatchObject({ proven: 'farm' })
  })

  it('harm: the player struck down by a stone used on a tree', () => {
    const fells = put(onDeadTree('patch/stone-fells', [{ op: 'emit', impulse: 'strike', to: 'actor', params: { power: 9999 } }]))
    const c = confirm({ title: 'the player goes down', kind: 'harm', steps: [USE], expect: [{ status: { key: 'actor', has: 'down' } }] }, req.scenario, onto, base, fells)
    expect(c).toMatchObject({ proven: 'harm' })
  })

  it('softlock: the player held fast long after the use', () => {
    const binds = put(onDeadTree('patch/stone-binds', [{ op: 'emit', impulse: 'strike', to: 'actor', params: { power: 1, afflict: 'jailed', afflictFor: 100000 } }]))
    const c = confirm({ title: 'the player cannot move', kind: 'softlock', steps: [USE], expect: [{ status: { key: 'actor', has: 'jailed' } }] }, req.scenario, onto, base, binds)
    expect(c).toMatchObject({ proven: 'softlock' })
  })

  it('runaway: a use that sets off more than fifty events', () => {
    const storm = put(onDeadTree('patch/stone-storm', Array.from({ length: 80 }, () => ({ op: 'emit', impulse: 'handle', to: 'target', params: {} }))))
    const c = confirm({ title: 'events pile up', kind: 'runaway', steps: [USE], expect: [{ events: { atLeast: 60 } }] }, req.scenario, onto, base, storm)
    expect(c).toMatchObject({ proven: 'runaway' })
  })
})

describe('live: a reproduced finding that is no harm goes to a reviewer, and the rule stays', () => {
  it('reviews it after the fact and keeps the rule in the library', async () => {
    const req = useRequest()
    const wet = slobber
    const reviews: string[] = []
    const model = new ScriptedModel((messages: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'audit') return { findings: [{ title: 'the stone is wet', kind: 'harm', steps: [USE], expect: [{ status: { key: 'instrument', has: 'wet' } }] }] }
      if (opts.purpose === 'review') return (reviews.push(messages[messages.length - 1].content), { verdict: 'ship' })
      if (opts.purpose === 'reflect') return {}
      return { patch: placePatch(wet, req).patch }
    })
    const { library, modder } = testModder({ model, profile: 'live', harness: (h) => ({ audit: { ...auditOf(h), enabled: true, blocking: false } }) })
    const reply = await modder.resolve({ request: req })
    expect(reply.outcome).toBe('accepted')
    await modder.settled()
    expect(library.lib.rules.has('patch/stone-sapped')).toBe(true)
    expect(reviews.some((r) => r.includes('the code does not count as harm'))).toBe(true)
  })
})
