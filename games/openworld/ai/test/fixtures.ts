// What the AI's tests on this game share: its ontology and base rules, and a modder over them in a fresh directory.

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, placePatch, type ModRequest, type Patch, type Rule, type Scenario, type Tree } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { Modder, SelfState, WorldLibrary, auditOf, type Finding, type Harness, type Model } from '@openworld/ai'

export const onto = buildOntology()
export const BASE = [...BASE_RULES, ...STORY_RULES]

export const STONE = 'item/material/stone'
export const BANE = 'item/weapon/blade/dragonsbane'
export const DEAD_TREE = 'fixture/nature/dead_tree'
export const SLIME = 'actor/creature/slime/green_slime'
/** For a test that waits on the pipeline. */
export const SLOW = { timeout: 180_000 }

/** The player beside `target`, holding `held`. */
export const useScene = (target = DEAD_TREE, held = STONE): Scenario => ({
  entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    { key: 'held', type: held, x: 2, y: 2, heldBy: 'actor' },
    { key: 'it', type: target, x: 2, y: 1 },
  ],
  event: {},
})

/** `held` used on `target` under `lib`: the sandbox, its port, the result, and the request the port raised (if any). */
export function ask(target = DEAD_TREE, lib = new RuleLibrary(BASE), held = STONE) {
  const eng = buildSandbox(useScene(target, held), onto, lib)
  const port = new ModPort(eng)
  const res = eng.act('use', 'actor', { e: 'it' })
  return { eng, port, res, req: port.records[0]?.request }
}

/** `held` used on `target`: a hole in the held thing's own nature (`core/use`). */
export function useRequest(target = DEAD_TREE, held = STONE): ModRequest {
  const { port, res } = ask(target, undefined, held)
  expect(res.defined).toBe(false)
  const rec = port.records[0]
  expect(rec.request).toMatchObject({ event: { kind: 'act/use', host: { type: held } }, hole: { rule: 'core/use' } })
  return rec.request
}

/** `item` held out to `host`, as using it on the host does (putting is physics: a creature does not take what is put on it). */
export function offerRequest(host = SLIME, item = STONE): ModRequest {
  const eng = buildSandbox(useScene(host, item), onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  eng.queue({ kind: 'impulse/offered', host: { e: 'it' }, roles: { actor: { e: 'actor' }, item: { e: 'held' }, source: { e: 'held' } }, params: {}, cause: 'actor', origin: 'player' })
  const rec = port.records[0]
  expect(rec?.request).toMatchObject({ event: { kind: 'impulse/offered', host: { type: host } }, hole: { rule: 'core/offered' } })
  return rec.request
}

/** A rule of the stone's: used on `target` it does `effects`; on anything else it inherits. */
export const onTarget = (id: string, target: string, effects: unknown[]): Patch => ({
  artifacts: [{ kind: 'rule', rule: { id, host: { type: STONE }, on: 'act/use', label: { en: 'Use {instrument} on {target}', zh: '对{target}使用{instrument}' }, tree: { if: { is: { role: 'target', sel: { type: target } } }, then: { do: effects as never }, else: 'inherit' } } }],
})
export const onDeadTree = (id: string, effects: unknown[]): Patch => onTarget(id, DEAD_TREE, effects)

/** Harmless, though it changes something: the dead tree's sap wets the stone. */
export const SAP = [{ op: 'addStatus', status: 'wet', duration: 10 }, { op: 'log', text: { en: '{target} drips sap on {instrument}.', zh: '{target}的树液把{instrument}弄湿了。' } }]
/** A cheap road to the rarest blade in the world (the auditor breaks it). */
export const HONE = [{ op: 'transform', into: BANE }, { op: 'log', text: { en: 'The stone is honed into a blade.', zh: '石头磨成了一把剑。' } }]
export const becomesBane: Finding = { title: 'a stone becomes Dragonsbane', kind: 'value', steps: [{ act: 'use', target: 'target', instrument: 'instrument' }], expect: [{ is: { key: 'instrument', type: BANE } }] }

export const patchOf = (...rules: Rule[]): Patch => ({ artifacts: rules.map((rule) => ({ kind: 'rule' as const, rule })) })

/** A promise and the hand that settles it. */
export function gate<T = void>() {
  let open!: (v: T) => void
  const p = new Promise<T>((r) => (open = r))
  return { p, open }
}

/** Nothing after an answer ships: no review, reflection, escalation or revision. */
export const quiet = (h: Harness): Partial<Harness> => ({ review: { ...h.review, enabled: false }, reflect: { ...h.reflect, enabled: false }, escalate: false, revise: false })

/** The offline profile drafting patches as JSON (not the repo agent). */
export const jsonOffline = (h: Harness): Partial<Harness> => ({ offline: { ...h.offline, design: { ...h.offline.design, mode: 'json' } } })

/** The audit off. */
export const noAudit = (h: Harness): Partial<Harness> => ({ audit: { ...auditOf(h), enabled: false } })

export interface TestModderOptions {
  model?: Model
  profile?: 'live' | 'offline'
  /** What the test changes in the harness (none: the harness as it is). */
  harness?: (h: Harness) => Partial<Harness>
  dir?: string
  dry?: boolean
}

/** A modder over the base game in a fresh directory (or `dir`): its library, self-state and directory. */
export function testModder(o: TestModderOptions = {}) {
  const dir = o.dir ?? mkdtempSync(join(tmpdir(), 'lsw-test-'))
  const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
  const state = SelfState.open(join(dir, 'modder-state'))
  if (o.harness) state.setHarness({ ...state.harness(), ...o.harness(state.harness()) }, 'test')
  return { dir, library, state, modder: new Modder({ library, state, model: o.model, profile: o.profile, dry: o.dry }) }
}

/** A slime seizing up around a stone held out to it (`impulse/offered`, the stone in its `item` role). */
export const SEIZE: Tree = { if: { is: { role: 'item', sel: { type: STONE } } }, then: { do: [{ op: 'addStatus', status: 'frozen', duration: 30 }, { op: 'log', text: { en: 'It seizes up around the stone.', zh: 'It seizes up around the stone.' } }] }, else: { undefined: true } }

/** The shared library with one learned answer per slime type at the offered hole, each placed in the scene that asked. */
export function slimeLibrary(answers: Record<string, Tree>): WorldLibrary {
  const library = new WorldLibrary(onto, BASE)
  for (const [type, tree] of Object.entries(answers)) {
    const req = ask(type, library.lib).req!
    const short = type.split('/').pop()!
    const draft: Patch = { artifacts: [{ kind: 'rule', rule: { id: `patch/${short}-stone`, host: { type: 'x' }, on: 'x', label: { en: 'Press {instrument} to {target}', zh: '把{instrument}按在{target}上' }, doc: `${short}: a stone held out`, tree } }] }
    const r = library.commit(placePatch(draft, req).patch, req)
    expect(r.result.errors, `${short}: ${r.result.errors.join('; ')}`).toEqual([])
  }
  return library
}
