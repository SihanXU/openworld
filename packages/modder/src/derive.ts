// Tests the harness writes instead of the model. A hand-written test scenario was a large part
// of every answer (output tokens are most of a call's latency), and it is mechanical: replay
// the event under the draft, note what changed, then swap in ANOTHER instance of the host class
// the rule names and check the rule answers there with the same effects. A test that holds is
// attached to the rule (and guards it from then on); one that does not is reported, because a
// rule that only works for the instance that asked is not the class it claims.

import {
  OntologyIndex,
  RuleLibrary,
  isA,
  isDo,
  leaves,
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

const NARRATION = new Set(['vfx', 'say', 'log', 'emote'])

/** A rule that only narrates (log, say, vfx, emote) and changes nothing in the world. */
export function changesNothing(r: Rule): boolean {
  return leaves(r.tree).every((l) => !isDo(l) || l.do.every((e) => NARRATION.has(e.op)))
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

/** The scenario key of the event's host (as the sandbox picks it when the scenario does not say). */
function hostKey(sc: Scenario): string | undefined {
  const e = sc.event
  return e.host ?? e.instrument ?? e.actor ?? e.target
}

/** What the event did to the scenario's things, as expectations that should hold for any instance. */
function effectsOf(sc: Scenario, rule: Rule, lib: RuleLibrary, onto: Ontology): Expectation[] | undefined {
  const rp = replay(sc, onto, lib)
  if (rp.resolution.rule?.id !== rule.id || rp.errors.length) return undefined
  const w = rp.engine.world
  const out: Expectation[] = []
  const keys = new Set(Object.values(sc.event).filter((v): v is string => typeof v === 'string' && sc.entities.some((e) => e.key === v)))
  for (const key of keys) {
    const before = sc.entities.find((e) => e.key === key)!
    const e = w.get(key)
    if (!e) {
      out.push({ key, destroyed: true })
      continue
    }
    if (e.type !== before.type) out.push({ key, isType: e.type })
    const had = new Set(before.statuses ?? [])
    const has = Object.keys(e.statuses ?? {})
    for (const s of has) if (!had.has(s)) out.push({ key, hasStatus: s })
    for (const s of had) if (!has.includes(s)) out.push({ key, lacksStatus: s })
  }
  for (const v of Object.values(sc.event)) {
    if (typeof v !== 'string' || !v.startsWith('tile:')) continue
    const [x, y] = v.slice(5).split(',').map(Number)
    const t = w.terrainAt('sandbox', x, y)
    if (t !== sc.terrain?.[y]?.[x]) out.push({ tile: [x, y], terrain: t })
  }
  for (const l of leaves(rule.tree)) if (isDo(l)) for (const eff of l.do) if (eff.op === 'spawn' && !eff.type.startsWith('@') && Object.values(w.state.entities).some((e) => e.type === eff.type)) out.push({ spawned: eff.type })
  return out
}

const shape = (s: Selector): Selector => {
  const { status: _s, notStatus: _n, props: _p, ...rest } = s
  return rest
}

/** Other instances the selector also picks, best first: types under the same root elsewhere in the tree (another branch first), or other terrains. */
function siblings(sel: Selector, current: string, tile: boolean, onto: Ontology): string[] {
  const s = shape(sel)
  if (tile) {
    const terrains = Object.values(onto.terrains).filter((t) => `tile/${t.id}` !== current && t.id !== current)
    const view = (id: string, tags: string[] = []): View => ({ ref: { tile: { map: 'x', x: 0, y: 0 } }, type: `tile/${id}`, tags: new Set(tags), statuses: new Set(), props: {} })
    return terrains.filter((t) => matchSelector(s, view(t.id, t.tags))).map((t) => t.id)
  }
  const index = new OntologyIndex(onto)
  const parent = current.split('/').slice(0, -1).join('/')
  const leafTypes = Object.keys(onto.types)
    .filter((id) => id !== current && !Object.keys(onto.types).some((o) => o.startsWith(id + '/')))
    .sort()
  const root = current.split('/')[0]
  const fits = leafTypes.filter((id) => {
    const r = index.resolve(id)
    if (id.split('/')[0] !== root) return false
    return matchSelector(s, { ref: { e: id }, type: id, tags: new Set(r.tags), statuses: new Set(), props: r.props })
  })
  // prefer an instance from another branch: that is what tests the class, not the family
  return [...fits.filter((id) => !isA(id, parent)), ...fits.filter((id) => isA(id, parent))]
}

export interface Derived {
  patch: Patch
  /** what was derived, and what did not generalize (for the reviewer) */
  notes: string[]
}

/** Attach a derived test to every rule of the patch that has none: the same event, another instance of its host class. */
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
      const key = hostKey(req.scenario)
      if (!key) return a
      const tile = key.startsWith('tile:') ? key.slice(5).split(',').map(Number) : undefined
      const ent = tile ? undefined : req.scenario.entities.find((e) => e.key === key)
      if (!tile && !ent) return a // a resident host: one of a kind
      const others = tile ? siblings(r.host!, req.scenario.terrain![tile[1]][tile[0]], true, cand.onto) : siblings(r.host!, ent!.type, false, cand.onto)
      const swap = (other: string): Scenario => {
        const sc: Scenario = structuredClone(req.scenario)
        if (tile) sc.terrain![tile[1]][tile[0]] = other
        else Object.assign(sc.entities.find((e) => e.key === key)!, { type: other, props: undefined, tags: undefined })
        return sc
      }
      // the first instance this rule answers, or one it should answer but the hole is still open;
      // an instance a more specific rule already answers (another patch, a base rule) says nothing
      let other: string | undefined
      let sc: Scenario | undefined
      for (const o of others.slice(0, 8)) {
        const s = swap(o)
        const res = replay(s, cand.onto, cand.lib).resolution
        if (res.rule && res.rule.id !== r.id && res.defined) continue
        ;[other, sc] = [o, s]
        break
      }
      if (!other || !sc) {
        notes.push(`${r.id}: no other instance of its host class to test on${others.length ? ' (the others are answered by more specific rules)' : ''}`)
        return a
      }
      const there = effectsOf(sc, r, cand.lib, cand.onto)
      const same = (x: Expectation) => JSON.stringify(x)
      // a transformation names the type it became, which may differ per instance: compare the rest
      const holds = there && expect.filter((x) => !('isType' in x)).every((x) => there.some((y) => same(y) === same(x)))
      if (!holds) {
        notes.push(`${r.id}: did not generalize — with host ${other} it ${there ? 'has other effects' : 'does not answer'}`)
        return a
      }
      notes.push(`${r.id}: derived a test on host ${other}`)
      return { ...a, rule: { ...r, tests: [{ name: `derived: host ${other}`, given: sc, expect: there! }] } }
    } catch (err) {
      notes.push(`${r.id}: could not derive a test (${(err as Error).message})`)
      return a
    }
  })
  return { patch: { ...patch, artifacts }, notes }
}
