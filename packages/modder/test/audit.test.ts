import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, type ModRequest, type Patch, type Scenario } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
import { Modder, ScriptedModel, SelfState, WorldLibrary, auditOf, confirm, withPatch, type ChatMessage, type ChatOptions, type Finding } from '../src/index.ts'

// The auditor (audit.ts, design.md §13): an agent plays against a patch in the sandbox, out to break
// the game. Its findings are setups, steps and claims; the sandbox decides: a finding counts only
// when it holds with the patch and not without it.

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const ROPE = 'item/tool/rope'
const BANE = 'item/weapon/blade/dragonsbane'
const STONE = 'item/material/stone'

/** The rope used on a slime: a hole in the rope's own nature (`core/use`). */
function useRequest(): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: ROPE, x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: 'actor/creature/slime/green_slime', x: 2, y: 1 },
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  expect(eng.act('use', 'actor', { e: 'it' }).defined).toBe(false)
  return port.records[0].request
}

const onCreature = (id: string, effects: unknown[]): Patch => ({
  artifacts: [{ kind: 'rule', rule: { id, host: { type: ROPE }, on: 'act/use', label: { en: 'Use {instrument} on {target}', zh: '对{target}使用{instrument}' }, tree: { if: { is: { role: 'target', sel: { type: 'actor/creature' } } }, then: { do: effects as never }, else: 'inherit' } } }],
})
/** Valid, one for one, and a cheap road to the rarest blade in the world. */
const bane = onCreature('patch/rope-bane', [{ op: 'transform', into: BANE }, { op: 'log', text: { en: 'The rope hardens into a blade.', zh: '绳子硬化成了一把剑。' } }])
/** The same act, harmless: the slime only sniffs it (narration only: nothing for the auditor to break). */
const sniff = onCreature('patch/rope-sniff', [{ op: 'log', text: { en: '{target} sniffs {instrument}.', zh: '{target}嗅了嗅{instrument}。' } }])
/** Harmless too, though it changes something: the slime slobbers on the rope. */
const slobber = onCreature('patch/rope-slobber', [{ op: 'addStatus', status: 'wet', duration: 10 }, { op: 'log', text: { en: '{target} slobbers on {instrument}.', zh: '{target}把{instrument}弄湿了。' } }])
const becomesBane: Finding = { title: 'a rope becomes Dragonsbane', kind: 'value', steps: [{ act: 'use', target: 'target', instrument: 'instrument' }], expect: [{ is: { key: 'instrument', type: BANE } }] }

describe('confirm: the sandbox judges a finding', () => {
  const req = useRequest()
  const base = new RuleLibrary(BASE)

  it('counts what holds with the patch and not without it, with the evidence', () => {
    const c = confirm(becomesBane, req.scenario, onto, base, withPatch(base, bane))
    expect('evidence' in c && c.evidence).toMatch(/dragonsbane \+1/)
  })

  it('does not count a claim that does not hold, nor one the world already makes true', () => {
    const twice: Finding = { ...becomesBane, expect: [{ count: { type: BANE, atLeast: 2 } }] }
    expect(confirm(twice, req.scenario, onto, base, withPatch(base, bane))).toMatchObject({ why: expect.stringMatching(/does not hold/) })
    const already: Finding = { ...becomesBane, expect: [{ is: { key: 'actor', type: 'actor/person/player' } }] }
    expect(confirm(already, req.scenario, onto, base, withPatch(base, bane))).toMatchObject({ why: expect.stringMatching(/without the patch too/) })
    expect(confirm(becomesBane, req.scenario, onto, base, withPatch(base, sniff))).toMatchObject({ why: expect.stringMatching(/does not hold/) })
  })

  it('counts a farm: a use that leaves a stone and costs nothing, again and again', () => {
    const farm = onCreature('patch/rope-farm', [{ op: 'spawn', type: STONE, at: 'actor', into: 'contents' }])
    const f: Finding = { title: 'stones for nothing', kind: 'farm', steps: [{ repeat: 30, steps: [{ act: 'use', target: 'target', instrument: 'instrument' }] }], expect: [{ count: { type: STONE, in: 'actor', atLeast: 30 } }] }
    expect('evidence' in confirm(f, req.scenario, onto, base, withPatch(base, farm))).toBe(true)
  })

  it('runs only so much: a finding that asks for a billion steps is cut short', () => {
    const f: Finding = { ...becomesBane, steps: [{ repeat: 1e9, steps: [{ tick: 1e9 }] }] }
    const t = Date.now()
    confirm(f, req.scenario, onto, base, withPatch(base, bane))
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
    if (opts.purpose === 'design') return { patch: drafts[Math.min(calls.design++, drafts.length - 1)], summary: 'a rope on a creature' }
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

describe('the auditor in the pipeline', () => {
  it('live: the patch ships, then the auditor breaks it in the sandbox, and it leaves the library', async () => {
    const { model, calls } = scripted([bane], [becomesBane])
    const { library, modder } = setup(model, 'live')
    const reply = await modder.resolve({ request: useRequest() })
    expect(reply.outcome).toBe('accepted')
    await modder.settled()
    expect(calls.auditTools).toBe(1)
    expect(library.lib.rules.has('patch/rope-bane')).toBe(false)
  })

  it('live: a claim the sandbox does not bear out changes nothing', async () => {
    const { model, calls } = scripted([slobber], [becomesBane])
    const { library, modder } = setup(model, 'live')
    expect((await modder.resolve({ request: useRequest() })).outcome).toBe('accepted')
    await modder.settled()
    expect(calls.auditTools).toBe(1)
    expect(library.lib.rules.has('patch/rope-slobber')).toBe(true)
  })

  it('live: a patch that only narrates is not audited (no call), and the journal says why', async () => {
    const { model, calls } = scripted([sniff], [becomesBane])
    const { library, state, modder } = setup(model, 'live')
    const reply = await modder.resolve({ request: useRequest() })
    expect(reply.outcome).toBe('accepted')
    await modder.settled()
    expect(calls.audit).toBe(0)
    expect(library.lib.rules.has('patch/rope-sniff')).toBe(true)
    expect(state.journalOf('audit')).toMatchObject([{ episode: reply.episode, rules: ['patch/rope-sniff'], skipped: 'narrates only', usage: { calls: 0 } }])
  })

  it('offline: a draft the auditor breaks goes back with the evidence; the next one ships', async () => {
    const { model, calls } = scripted([bane, sniff], [becomesBane])
    const { library, modder } = setup(model, 'offline')
    const reply = await modder.resolve({ request: useRequest() })
    expect(reply.outcome).toBe('accepted')
    expect(calls.design).toBe(2)
    // the second draft only narrates: it is not audited again
    expect(calls.auditTools).toBe(1)
    expect(library.lib.rules.has('patch/rope-bane')).toBe(false)
    expect(library.lib.rules.has('patch/rope-sniff')).toBe(true)
  })
})
