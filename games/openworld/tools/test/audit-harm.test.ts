// The auditor's findings are harm by construction (audit.ts harmOf, design.md §13): a finding the sandbox reproduces
// counts only when the code sees one of the harms it recognizes in it (farm, value, harm to what the story needs,
// softlock, runaway). The finding's own `kind` is the auditor's guess; a reproduced effect that is none of them (a
// stone made wet, which is what a rule that wets stones is for) is not confirmed, and in live goes to a reviewer.

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, placePatch, type ModRequest, type Patch, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { Modder, ScriptedModel, SelfState, WorldLibrary, auditOf, confirm, withPatch, type ChatMessage, type ChatOptions, type Finding } from '@openworld/modder'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const STONE = 'item/material/stone'
const BANE = 'item/weapon/blade/dragonsbane'
const TREE = 'fixture/nature/dead_tree'

/** The stone used on a dead tree: a hole in the stone's own nature (`core/use`). */
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

const onDeadTree = (id: string, effects: unknown[]): Patch => ({
  artifacts: [{ kind: 'rule', rule: { id, host: { type: STONE }, on: 'act/use', label: { en: 'Use {instrument} on {target}', zh: '对{target}使用{instrument}' }, tree: { if: { is: { role: 'target', sel: { type: TREE } } }, then: { do: effects as never }, else: 'inherit' } } }],
})
const USE: Finding['steps'][number] = { act: 'use', target: 'target', instrument: 'instrument' }

describe('a reproduced finding counts only as a harm the code recognizes', () => {
  const req = useRequest()
  const base = new RuleLibrary(BASE)
  const put = (p: Patch) => withPatch(base, placePatch(p, req).patch)

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
    const wet = onDeadTree('patch/stone-sapped', [{ op: 'addStatus', status: 'wet', duration: 10 }, { op: 'log', text: { en: '{target} drips sap on {instrument}.', zh: '{target}的树液把{instrument}弄湿了。' } }])
    const reviews: string[] = []
    const model = new ScriptedModel((messages: ChatMessage[], opts: ChatOptions) => {
      if (opts.purpose === 'audit') return { findings: [{ title: 'the stone is wet', kind: 'harm', steps: [USE], expect: [{ status: { key: 'instrument', has: 'wet' } }] }] }
      if (opts.purpose === 'review') return (reviews.push(messages[messages.length - 1].content), { verdict: 'ship' })
      if (opts.purpose === 'reflect') return {}
      return { patch: placePatch(wet, req).patch }
    })
    const dir = mkdtempSync(join(tmpdir(), 'lsw-harm-'))
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const state = SelfState.open(join(dir, 'state'))
    state.setHarness({ ...state.harness(), audit: { ...auditOf(state.harness()), enabled: true, blocking: false } }, 'test: audit after shipping')
    const modder = new Modder({ library, state, model, profile: 'live' })
    const reply = await modder.resolve({ request: req })
    expect(reply.outcome).toBe('accepted')
    await modder.settled()
    expect(library.lib.rules.has('patch/stone-sapped')).toBe(true)
    expect(reviews.some((r) => r.includes('the code does not count as harm'))).toBe(true)
  })
})
