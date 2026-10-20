// Tests the harness writes instead of the model. A hand-written test scenario was a large part
// of every answer (output tokens are most of a call's latency), and it is mechanical: replay the
// event under the draft in the scene that asked and note what changed. The test is attached to the
// rule and guards it from then on (a learned rule is one type's, placed at one leaf: there is no
// other instance of a class to try it on, design.md §5.16).

import { RuleLibrary, buildSandbox, isDo, isHole, leaves, replay, type Effect, type Expectation, type ModRequest, type Ontology, type Patch, type Rule, type Scenario } from '@openworld/engine'

const NARRATION = new Set(['vfx', 'say', 'log', 'emote'])

const narrates = (effects: Effect[]) => effects.every((e) => NARRATION.has(e.op))

/**
 * A rule that only narrates (log, say, vfx, emote) and changes nothing in the world (a hole's default
 * included). Given the default of the hole it answers (`ModRequest.hole.default`), it changes nothing
 * only if that default changes nothing either: an answer replaces the default where it answers, so
 * words in place of a default that does something (a thing that breaks and is gone, a story's
 * fallback) cancel what the world would have done.
 */
export function changesNothing(r: Rule, holeDefault: Effect[] = []): boolean {
  const ls = leaves(r.tree)
  if (!ls.every((l) => narrates(isDo(l) ? l.do : isHole(l) ? (l.default ?? []) : []))) return false
  return narrates(holeDefault) || !ls.some(isDo)
}

function candidate(patch: Patch, lib: RuleLibrary, onto: Ontology): { lib: RuleLibrary; onto: Ontology } {
  const l = lib.clone()
  const o: Ontology = { ...onto, types: { ...onto.types }, statuses: { ...onto.statuses } }
  for (const a of patch.artifacts) {
    if (a.kind === 'type') o.types[a.type.id] = a.type
    if (a.kind === 'status') o.statuses[a.status.id] = a.status
  }
  for (const a of patch.artifacts) if (a.kind === 'rule') l.add({ ...a.rule, source: { origin: 'patch' } })
  return { lib: l, onto: o }
}

/** What the event did to the scenario's things, as expectations that should hold for any instance (the upstream loop reads them too, resolvedBy aside). */
export function effectsOf(sc: Scenario, rule: Rule, lib: RuleLibrary, onto: Ontology): Expectation[] | undefined {
  const rp = replay(sc, onto, lib)
  if (rp.resolution.rule?.id !== rule.id || rp.errors.length) return undefined
  const w = rp.engine.world
  // (what the scene's numbers were before: the type's defaults with the scenario's own)
  const was = buildSandbox(sc, onto, lib).world
  // the test checks at least that this rule answers (a rule whose effects no test can see is still tested)
  const out: Expectation[] = [{ resolvedBy: rule.id }]
  const keys = new Set(Object.values(sc.event).filter((v): v is string => typeof v === 'string' && sc.entities.some((e) => e.key === v)))
  for (const key of keys) {
    const before = sc.entities.find((e) => e.key === key)!
    const e = w.get(key)
    if (!e) {
      out.push({ key, destroyed: true })
      continue
    }
    if (e.type !== before.type) out.push({ key, isType: e.type })
    // a number that went up or down (hp, charges, a counter): by its direction, which holds for any instance
    const old = was.get(key)
    for (const [k, v] of Object.entries(e.props ?? {})) {
      // (a number it did not have counts from 0, as addProp counts it)
      const had = old ? was.prop(old, k) : undefined
      const u = had === undefined ? 0 : had
      if (typeof v !== 'number' || typeof u !== 'number' || v === u) continue
      out.push(v > u ? { key, propGt: [k, u] } : { key, propLt: [k, u] })
    }
    const had = new Set(before.statuses ?? [])
    const has = Object.keys(e.statuses ?? {})
    for (const s of has) if (!had.has(s)) out.push({ key, hasStatus: s })
    for (const s of had) if (!has.includes(s)) out.push({ key, lacksStatus: s })
  }
  for (const v of Object.values(sc.event)) {
    // (a cell's top only: the terrain rows say what is on top; `tile:x,y:space` is what lies under it)
    if (typeof v !== 'string' || !v.startsWith('tile:') || v.split(':').length > 2) continue
    const [x, y] = v.slice(5).split(',').map(Number)
    const t = w.terrainAt('sandbox', x, y)
    if (t !== sc.terrain?.[y]?.[x]) out.push({ tile: [x, y], terrain: t })
  }
  for (const l of leaves(rule.tree)) if (isDo(l)) for (const eff of l.do) if (eff.op === 'spawn' && !eff.type.startsWith('@') && Object.values(w.state.entities).some((e) => e.type === eff.type)) out.push({ spawned: eff.type })
  return out
}

export interface Derived {
  patch: Patch
  /** what was derived, or why nothing was (for the reviewer) */
  notes: string[]
}

/**
 * Attach a test to every rule of the patch that has none: the scene that asked, and what the rule
 * did there (a learned rule is one type's and answers at one place, so there is no sibling to try;
 * the test guards the answer against later changes of the base rules around it).
 */
export function deriveTests(patch: Patch, req: ModRequest, lib: RuleLibrary, onto: Ontology): Derived {
  const notes: string[] = []
  let cand: { lib: RuleLibrary; onto: Ontology }
  try {
    cand = candidate(patch, lib, onto)
  } catch {
    return { patch, notes }
  }
  const artifacts = patch.artifacts.map((a) => {
    if (a.kind !== 'rule' || !a.rule?.host || a.rule.tests?.length) return a
    const r = a.rule
    try {
      const expect = effectsOf(req.scenario, r, cand.lib, cand.onto)
      if (!expect) return a // not this rule's event: the validator will say so
      notes.push(`${r.id}: derived a test from the scene that asked${expect.length === 1 ? ' (it checks only that the rule answers: its effects are not ones a test can see)' : ''}`)
      return { ...a, rule: { ...r, tests: [{ name: 'derived: the scene that asked', given: structuredClone(req.scenario), expect }] } }
    } catch (err) {
      notes.push(`${r.id}: could not derive a test (${(err as Error).message})`)
      return a
    }
  })
  return { patch: { ...patch, artifacts }, notes }
}
