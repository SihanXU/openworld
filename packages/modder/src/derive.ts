// Tests the harness writes instead of the model. A hand-written test scenario was a large part
// of every answer (output tokens are most of a call's latency), and it is mechanical: replay
// the interaction under the draft, note what changed, then swap in ANOTHER instance of the
// class the rule names and check the rule fires there with the same effects. A test that holds
// is attached to the rule (and guards it from then on); one that does not is reported, because
// a rule that only works for the instance that asked is not the class it claims.

import {
  OntologyIndex,
  RuleLibrary,
  isA,
  matchSelector,
  replay,
  type Expectation,
  type ModRequest,
  type Ontology,
  type Patch,
  type Rule,
  type Scenario,
  type Selector,
  type View,
} from '@lsw/engine'

const STATE_OPS = new Set(['spawn', 'destroy', 'transform', 'moveTo', 'addStatus', 'removeStatus', 'setProp', 'addProp', 'addTag', 'removeTag', 'damage', 'heal', 'setTerrain', 'spread', 'hit', 'push', 'open', 'dropContents'])

/** A rule that only narrates (log, say, vfx) and changes nothing in the world. */
export function changesNothing(r: Rule): boolean {
  return !r.do.some((e) => STATE_OPS.has(e.op))
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

/** What the event did to the roles, as expectations that should hold for any instance. */
function effectsOf(sc: Scenario, rule: Rule, lib: RuleLibrary, onto: Ontology): Expectation[] | undefined {
  const rp = replay(sc, onto, lib)
  if (rp.resolution.rule?.id !== rule.id || rp.errors.length) return undefined
  const w = rp.engine.world
  const out: Expectation[] = []
  for (const key of ['target', 'instrument']) {
    const before = sc.entities.find((e) => e.key === key)
    if (!before) continue
    const e = w.get(key)
    if (!e) {
      out.push({ key, destroyed: true })
      continue
    }
    const had = new Set(before.statuses ?? [])
    const has = Object.keys(e.statuses ?? {})
    for (const s of has) if (!had.has(s)) out.push({ key, hasStatus: s })
    for (const s of had) if (!has.includes(s)) out.push({ key, lacksStatus: s })
  }
  const tile = sc.event.target?.startsWith('tile:') ? sc.event.target.slice(5).split(',').map(Number) : undefined
  if (tile) {
    const [x, y] = tile
    const t = w.terrainAt('sandbox', x, y)
    if (t !== sc.terrain?.[y]?.[x]) out.push({ tile: [x, y], terrain: t })
  }
  for (const eff of rule.do) if (eff.op === 'spawn' && !eff.type.startsWith('@')) out.push({ spawned: eff.type })
  return out
}

const shape = (s: Selector): Selector => {
  const { status: _s, notStatus: _n, props: _p, ...rest } = s
  return rest
}

/** Another instance the selector also picks: a type of the same kind elsewhere in the tree, or another terrain. */
function sibling(sel: Selector, current: string, kind: string, onto: Ontology): string | undefined {
  const s = shape(sel)
  if (kind === 'tile') {
    const terrains = Object.values(onto.terrains).filter((t) => `tile/${t.id}` !== current)
    const view = (id: string, tags: string[] = []): View => ({ ref: { tile: { map: 'x', x: 0, y: 0 } }, kind: 'tile', type: `tile/${id}`, tags: new Set(tags), statuses: new Set(), props: {}, isPlayer: false })
    return terrains.find((t) => matchSelector(s, view(t.id, t.tags)))?.id
  }
  const index = new OntologyIndex(onto)
  const parent = current.split('/').slice(0, -1).join('/')
  const leaves = Object.keys(onto.types)
    .filter((id) => id !== current && !Object.keys(onto.types).some((o) => o.startsWith(id + '/')))
    .sort()
  const fits = leaves.filter((id) => {
    const r = index.resolve(id)
    if (r.kind !== kind) return false
    return matchSelector(s, { ref: { e: id }, kind: r.kind, type: id, tags: new Set(r.tags), statuses: new Set(), props: r.props, isPlayer: false })
  })
  // prefer an instance from another branch: that is what tests the class, not the family
  return fits.find((id) => !isA(id, parent)) ?? fits[0]
}

export interface Derived {
  patch: Patch
  /** what was derived, and what did not generalize (for the reviewer) */
  notes: string[]
}

/** Attach a derived test to every interaction rule of the patch that has none. */
export function deriveTests(patch: Patch, req: ModRequest, lib: RuleLibrary, onto: Ontology): Derived {
  const notes: string[] = []
  let cand: { lib: RuleLibrary; onto: Ontology }
  try {
    cand = candidate(patch, lib, onto)
  } catch {
    return { patch, notes }
  }
  const artifacts = patch.artifacts.map((a) => {
    if (a.kind !== 'rule' || a.rule?.on !== 'interaction' || a.rule.tests?.length) return a
    const r = a.rule
    try {
      const expect = effectsOf(req.scenario, r, cand.lib, cand.onto)
      if (!expect) return a // not this rule's interaction: the validator will say so
      const role = r.when.target && (r.when.target.type || r.when.target.tags?.length) ? 'target' : 'instrument'
      const sel = r.when[role]
      const key = req.scenario.event[role]
      if (!sel || !key) return a
      const sc: Scenario = structuredClone(req.scenario)
      let other: string | undefined
      if (key.startsWith('tile:')) {
        const [x, y] = key.slice(5).split(',').map(Number)
        other = sibling(sel, `tile/${sc.terrain![y][x]}`, 'tile', cand.onto)
        if (other) sc.terrain![y][x] = other
      } else {
        const ent = sc.entities.find((e) => e.key === key)!
        const kind = new OntologyIndex(cand.onto).resolve(ent.type).kind
        other = sibling(sel, ent.type, kind, cand.onto)
        if (other) Object.assign(ent, { type: other, props: undefined, tags: undefined })
      }
      if (!other) {
        notes.push(`${r.id}: no other instance of its ${role} class to test on`)
        return a
      }
      const there = effectsOf(sc, r, cand.lib, cand.onto)
      const holds = there && expect.every((x) => there.some((y) => JSON.stringify(y) === JSON.stringify(x)))
      if (!holds) {
        notes.push(`${r.id}: did not generalize — with ${role} ${other} it ${there ? 'has other effects' : 'does not fire'}`)
        return a
      }
      notes.push(`${r.id}: derived a test on ${role} ${other}`)
      return { ...a, rule: { ...r, tests: [{ name: `derived: ${role} ${other}`, given: sc, expect }] } }
    } catch (err) {
      notes.push(`${r.id}: could not derive a test (${(err as Error).message})`)
      return a
    }
  })
  return { patch: { ...patch, artifacts }, notes }
}
