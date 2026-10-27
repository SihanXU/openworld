// What the harness does to an answer by itself, without another model turn: deterministic repairs of its shape,
// the tests it derives instead of the model writing them, and the judgment of what the thing affords (design.md
// §5.17) held to what the rule does.

import { OntologyIndex, PRIMITIVES, selectByType, RuleLibrary, buildSandbox, isDo, isHole, leaves, replay, ontologyWith, withArtifacts, AFFORDANCES, patchRules, type Artifact, type Cond, type Effect, type Text, type Ontology, type Patch, type Rule, type Selector, type Tree, type Expectation, type ModRequest, type Scenario, type Affordance } from '@openworld/engine'

// ---------------------------------------------------------------- deterministic repairs
// Deterministic repairs. A model repair round costs a full turn (5–10 s); most first answers
// that fail validation fail for mechanical reasons the harness can fix itself. Measured on
// the latency bench, every malformed first answer had a correct rule inside the wrong wrapper.
// Each fix is recorded on the attempt, so the episode shows what was changed and why.

// a rule's kind and place are the harness's now (design.md §5.16): one the model wrote without `on` is a rule by its id
const looksLikeRule = (x: Record<string, unknown>) => (typeof x.on === 'string' || (typeof x.id === 'string' && x.id.startsWith('patch/'))) && (!!x.tree || Array.isArray(x.do))

/**
 * Bring a draft into the Patch shape: a bare rule, a list of rules, or an artifact with the
 * rule's fields spread on it all become `{ kind: 'rule', rule }`; a rule written as a flat
 * `do` list (with an optional `if`) gets that as its tree.
 */
export function normalizePatch(x: unknown): { patch?: Patch; fixes: string[] } {
  const fixes: string[] = []
  if (!x || typeof x !== 'object') return { fixes }
  let o = x as Record<string, unknown>
  if (o.patch && typeof o.patch === 'object') o = o.patch as Record<string, unknown>
  let items: unknown[] | undefined = Array.isArray(o.artifacts) ? o.artifacts : undefined
  if (!items && Array.isArray(o.rules)) (items = o.rules), fixes.push('read "rules" as artifacts')
  if (!items && o.rule && typeof o.rule === 'object') (items = [o]), fixes.push('read a single artifact as the patch')
  if (!items && looksLikeRule(o)) (items = [o]), fixes.push('read a bare rule as the patch')
  if (!items) return { fixes }
  const artifacts: Artifact[] = []
  for (const it of items) {
    if (!it || typeof it !== 'object') continue
    const a = it as Record<string, unknown>
    if (a.kind === 'rule' && a.rule && typeof a.rule === 'object') {
      artifacts.push({ kind: 'rule', rule: treeOf(a.rule as Record<string, unknown>, fixes) })
      continue
    }
    if ((a.kind === 'type' && a.type) || (a.kind === 'status' && a.status)) {
      artifacts.push(a as unknown as Artifact)
      continue
    }
    if (looksLikeRule(a)) {
      const { kind: _k, ...rule } = a
      artifacts.push({ kind: 'rule', rule: treeOf(rule, fixes) })
      fixes.push(`wrapped rule "${String(a.id)}" as {kind:"rule", rule}`)
      continue
    }
    if (a.kind === 'type' || a.kind === 'status') {
      const { kind, ...def } = a
      artifacts.push(kind === 'type' ? ({ kind: 'type', type: def } as unknown as Artifact) : ({ kind: 'status', status: def } as unknown as Artifact))
      fixes.push(`wrapped ${String(kind)} "${String(a.id)}"`)
      continue
    }
    artifacts.push(a as unknown as Artifact) // let the validator say what is wrong with it
  }
  // there are no kinds (world-model.md §4.1): a selector naming one selects by that root type
  for (const a of artifacts) {
    if (a?.kind !== 'rule' || !a.rule) continue
    const before = JSON.stringify(a.rule)
    selectByType(a.rule)
    if (JSON.stringify(a.rule) !== before) fixes.push(`rule "${a.rule.id}" selected by kind: now by its root type`)
  }
  return { patch: { ...(o as object), artifacts } as Patch, fixes }
}

/** A rule with `do` (and maybe `if`) beside its tree instead of in it; effects keyed by their op. */
function treeOf(r: Record<string, unknown>, fixes: string[]): Rule {
  const id = String(r.id)
  if (r.tree) return { ...(r as object), tree: flatEffects(r.tree as Tree, id, fixes) } as Rule
  if (!Array.isArray(r.do)) return r as unknown as Rule
  const { do: effects, if: cond, ...rest } = r
  const leaf = flatEffects({ do: effects as Effect[] }, id, fixes)
  fixes.push(`moved the effects of "${id}" into its tree`)
  return { ...(rest as object), tree: cond ? { if: cond as Cond, then: leaf } : leaf } as Rule
}

/** An effect written as `{spawn: {type, at}}` is `{op: 'spawn', type, at}`: the op is its only key. */
function flatEffects(t: Tree, id: string, fixes: string[]): Tree {
  if (!t || typeof t !== 'object') return t
  if ('if' in t) return { ...t, then: flatEffects(t.then, id, fixes), ...(t.else !== undefined ? { else: flatEffects(t.else, id, fixes) } : {}) }
  if (!('do' in t) || !Array.isArray(t.do)) return t
  let n = 0
  const effects = t.do.map((e) => {
    const o = e as unknown as Record<string, unknown>
    const keys = o && typeof o === 'object' && !('op' in o) ? Object.keys(o) : []
    if (keys.length !== 1 || !(keys[0] in PRIMITIVES)) return e
    const args = o[keys[0]]
    n++
    return { op: keys[0], ...(args && typeof args === 'object' ? args : {}) } as Effect
  })
  if (n) fixes.push(`flattened ${n} effect(s) of "${id}" written as {op: {...}} into {op, ...}`)
  return n ? { ...t, do: effects } : t
}

/**
 * A selector naming a terrain by its bare id (`{type: "bush"}`) means the tile type `tile/bush`:
 * qualify it, in the host and in every `is` condition, when no type of that name exists.
 */
export function qualifyTerrains(patch: Patch, onto: Ontology): { patch: Patch; fixes: string[] } {
  const fixes: string[] = []
  const types = new Set([...Object.keys(onto.types), ...patch.artifacts.flatMap((a) => (a.kind === 'type' && a.type?.id ? [a.type.id] : []))])
  const sel = (s: Selector | undefined, id: string): Selector | undefined => {
    if (!s?.type || s.type.startsWith('tile/') || types.has(s.type) || !(s.type in onto.terrains)) return s
    fixes.push(`read type "${s.type}" in "${id}" as the terrain "tile/${s.type}"`)
    return { ...s, type: `tile/${s.type}` }
  }
  const cond = (c: Cond, id: string): Cond => {
    if ('all' in c) return { all: c.all.map((x) => cond(x, id)) }
    if ('any' in c) return { any: c.any.map((x) => cond(x, id)) }
    if ('not' in c) return { not: cond(c.not, id) }
    if ('is' in c) return { is: { ...c.is, sel: sel(c.is.sel, id)! } }
    return c
  }
  const tree = (t: Tree, id: string): Tree => (t && typeof t === 'object' && 'if' in t ? { if: cond(t.if, id), then: tree(t.then, id), ...(t.else !== undefined ? { else: tree(t.else, id) } : {}) } : t)
  const artifacts = patch.artifacts.map((a) => (a.kind === 'rule' && a.rule ? { ...a, rule: { ...a.rule, host: sel(a.rule.host, a.rule.id), tree: tree(a.rule.tree, a.rule.id) } } : a))
  return { patch: fixes.length ? { ...patch, artifacts } : patch, fixes }
}

/**
 * A label names only the roles an input has ({target}, {instrument}, {actor}: the validator holds to it), never the
 * host. A label that says {host} means the host itself: its name is written in, in each language the label has
 * (the one mistake a reflecting modder learns first, and a modder without memory makes every time). The host is the
 * request's (`requestHost`): a learned rule's host is always the type that asked.
 */
export function namedHost(patch: Patch, onto: Ontology, requestHost?: string): { patch: Patch; fixes: string[] } {
  const fixes: string[] = []
  const name = (type: string | undefined, lang: string): string | undefined => {
    // a thing's type, or a cell's terrain (tile/<id>)
    const n = !type ? undefined : (onto.types[type]?.name ?? (type.startsWith('tile/') ? onto.terrains[type.slice(5)]?.name : undefined))
    return typeof n === 'string' ? n : n && typeof n === 'object' ? ((n as Record<string, string>)[lang] ?? (n as Record<string, string>).en) : undefined
  }
  const label = (l: unknown, type: string | undefined, id: string): unknown => {
    if (typeof l === 'string') {
      const n = name(type, 'en')
      if (!n || !l.includes('{host}')) return l
      fixes.push(`wrote the host's name for {host} in the label of "${id}"`)
      return l.replaceAll('{host}', n)
    }
    if (!l || typeof l !== 'object') return l
    let changed = false
    const out = Object.fromEntries(Object.entries(l as Record<string, unknown>).map(([lang, s]) => {
      const n = name(type, lang)
      if (typeof s !== 'string' || !n || !s.includes('{host}')) return [lang, s]
      changed = true
      return [lang, s.replaceAll('{host}', n)]
    }))
    if (changed) fixes.push(`wrote the host's name for {host} in the label of "${id}"`)
    return changed ? out : l
  }
  const tree = (t: Tree, type: string | undefined, id: string): Tree => {
    if (!t || typeof t !== 'object') return t
    if ('if' in t) return { ...t, then: tree(t.then, type, id), ...(t.else !== undefined ? { else: tree(t.else, type, id) } : {}) }
    if ('do' in t && t.label !== undefined) return { ...t, label: label(t.label, type, id) as Text }
    return t
  }
  const artifacts = patch.artifacts.map((a) => {
    if (a.kind !== 'rule' || !a.rule) return a
    // the request's host (its place is the harness's, set after this: the model may have left the host out)
    const type = requestHost ?? a.rule.host?.type
    return { ...a, rule: { ...a.rule, ...(a.rule.label !== undefined && { label: label(a.rule.label, type, a.rule.id) as Text }), tree: tree(a.rule.tree, type, a.rule.id) } }
  })
  return { patch: fixes.length ? { ...patch, artifacts } : patch, fixes }
}

/**
 * A new thing a rule makes by using something on a station (a workbench: a fixture tagged `station:<id>`)
 * is that station's craft, and is listed in the crafting panel too (world-model.md §6.4): its type says
 * so (`station`). The designer often leaves it out; the harness reads it off the branch that makes it.
 */
export function stationFromRules(patch: Patch, onto: Ontology): { patch: Patch; fixes: string[] } {
  const made = toolsOf(stationsOf(patch, onto), onto)
  // made at hand or a station, it comes into the maker's hand and has to leave it: a fixture is carried (as the world's workbench is)
  const fixes = [...made.fixes]
  const artifacts = made.patch.artifacts.map((a) => {
    if (a?.kind !== 'type' || !a.type?.id || !a.type.station) return a
    if (new OntologyIndex({ ...onto, types: { ...onto.types, [a.type.id]: a.type } }).resolve(a.type.id).tags.includes('portable')) return a
    fixes.push(`"${a.type.id}" is made into the maker's hand: portable, so the hand can set it down`)
    return { ...a, type: { ...a.type, tags: [...(a.type.tags ?? []), 'portable'] } }
  })
  return fixes.length > made.fixes.length ? { patch: { ...made.patch, artifacts }, fixes } : made
}

/**
 * A thing made by hand that its rule makes only with something else it is used on (wheat ground on a stone, cut with
 * a knife), which is neither what it is made of nor a station: by hand, that something is carried (the recipe's
 * tools, by the tag it is known by); one that cannot be carried (stirred in a cauldron) leaves no recipe by hand.
 */
function toolsOf(made: { patch: Patch; fixes: string[] }, onto: Ontology): { patch: Patch; fixes: string[] } {
  const { patch } = made
  const fixes = [...made.fixes]
  const types = new Map(patch.artifacts.flatMap((a) => (a?.kind === 'type' && a.type?.id ? [[a.type.id, a.type]] : [])))
  const needs = new Map<string, Set<string>>()
  const targetOf = (c: Cond): string | undefined => (c && typeof c === 'object' && 'is' in c && c.is?.role === 'target' && typeof c.is.sel?.type === 'string' ? c.is.sel.type : undefined)
  const visit = (effects: Effect[], path: Cond[]): void => {
    for (const e of effects) {
      if (!e || typeof e !== 'object') continue
      const id = madeBy(e)
      const type = typeof id === 'string' ? types.get(id) : undefined
      if (!type) continue
      for (const target of path.map(targetOf)) {
        if (!target || (type.makeup ?? []).some((m) => m?.type === target)) continue
        if (onto.types[target]?.tags?.some((g) => g.startsWith('station:'))) continue
        ;(needs.get(type.id) ?? needs.set(type.id, new Set()).get(type.id)!).add(target)
      }
    }
  }
  for (const a of patch.artifacts) if (a?.kind === 'rule' && a.rule?.tree) branches(a.rule.tree, visit)
  if (!needs.size) return made
  const index = new OntologyIndex({ ...onto, types: { ...onto.types, ...Object.fromEntries(types) } })
  const artifacts = patch.artifacts.map((a) => {
    if (a?.kind !== 'type' || a.type.station !== 'hands' || !needs.has(a.type.id)) return a
    const tools = new Set(a.type.tools ?? [])
    for (const target of needs.get(a.type.id)!) {
      const r = index.resolve(target)
      const leaf = target.split('/').at(-1)!
      const tag = r.tags.find((g) => g.startsWith('tool:')) ?? (r.tags.includes(leaf) ? leaf : undefined)
      if (!r.tags.includes('portable') || !tag) {
        fixes.push(`"${a.type.id}" is made only at ${target}, which cannot be carried: no recipe by hand (station left out)`)
        const { station: _, ...rest } = a.type
        return { ...a, type: rest }
      }
      tools.add(tag)
    }
    if (tools.size === (a.type.tools ?? []).length) return a
    fixes.push(`"${a.type.id}" is made by hand only with ${[...tools].join(', ')} carried, as its rule uses it (tools)`)
    return { ...a, type: { ...a.type, tools: [...tools] } }
  })
  return { patch: { ...patch, artifacts }, fixes }
}

/** Each `do` leaf of a tree with the conditions on its way there (an `all` read as its parts; an `else` adds none). */
function branches(t: Tree, visit: (effects: Effect[], path: Cond[]) => void, path: Cond[] = []): void {
  if (!t || typeof t !== 'object') return
  if ('if' in t) {
    const c = t.if as Cond | null
    const here = c && typeof c === 'object' && 'all' in c && Array.isArray(c.all) ? c.all : [c as Cond]
    branches(t.then, visit, [...path, ...here])
    if (t.else !== undefined) branches(t.else, visit, path)
    return
  }
  if ('do' in t && Array.isArray(t.do)) visit(t.do, path)
}

/** The type an effect makes: a spawn's, or what a transform turns its host into. */
const madeBy = (e: Effect): unknown => (e.op === 'spawn' ? e.type : e.op === 'transform' ? e.into : undefined)

/** A condition that holds only by chance (at any depth). */
function byChance(c: Cond): boolean {
  if (!c || typeof c !== 'object') return false
  if ('chance' in c) return true
  if ('all' in c && Array.isArray(c.all)) return c.all.some(byChance)
  if ('any' in c && Array.isArray(c.any)) return c.any.some(byChance)
  if ('not' in c) return byChance(c.not)
  return false
}

function stationsOf(patch: Patch, onto: Ontology): { patch: Patch; fixes: string[] } {
  const fixes: string[] = []
  const open = new Map(patch.artifacts.flatMap((a) => (a.kind === 'type' && a.type?.id && (!a.type.station || !a.type.yields) ? [[a.type.id, a.type]] : [])))
  if (!open.size) return { patch, fixes }
  const stationOf = (c: Cond): string | undefined => {
    if (!c || typeof c !== 'object' || !('is' in c) || c.is?.role !== 'target' || !c.is.sel?.type) return undefined
    const tag = onto.types[c.is.sel.type]?.tags?.find((t) => t.startsWith('station:'))
    const s = tag?.slice('station:'.length)
    return s && s !== 'stall' ? s : undefined
  }
  const found = new Map<string, string>()
  const counts = new Map<string, number>()
  const visit = (effects: Effect[], path: Cond[]): void => {
    const station = path.map(stationOf).find(Boolean)
    // a branch taken only by chance (one strike in ten at the anvil) is no craft: a recipe never fails
    if (!station || path.some(byChance)) return
    for (const e of effects) {
      if (!e || typeof e !== 'object') continue
      const id = madeBy(e)
      if (typeof id !== 'string' || !open.has(id) || found.has(id)) continue
      found.set(id, station)
      // what the rule makes at once, the recipe makes too (a bolt cut into two bandages)
      const n = e.op === 'spawn' && typeof e.count === 'number' ? e.count : 1
      if (n > 1) counts.set(id, n)
    }
  }
  for (const a of patch.artifacts) if (a.kind === 'rule' && a.rule?.tree) branches(a.rule.tree, visit)
  if (!found.size) return { patch, fixes }
  const artifacts = patch.artifacts.map((a) => {
    if (a?.kind !== 'type' || !a.type?.id || !found.has(a.type.id)) return a
    const station = a.type.station ? undefined : found.get(a.type.id)
    // as many at a time only where the rule makes them so: at the station the recipe is made at (a type
    // the designer made by hand keeps its own recipe, one for one)
    const n = a.type.yields || (a.type.station ?? station) !== found.get(a.type.id) ? undefined : counts.get(a.type.id)
    if (!station && !n) return a
    fixes.push(`"${a.type.id}" is made at a ${found.get(a.type.id)}: it is that station's craft too${station ? ` (station "${station}")` : ''}${n ? `, ${n} at a time as the rule makes it (yields ${n})` : ''}`)
    return { ...a, type: { ...a.type, ...(station && { station }), ...(n && { yields: n }) } }
  })
  return fixes.length ? { patch: { ...patch, artifacts }, fixes } : { patch, fixes }
}

// ---------------------------------------------------------------- derived tests
// Tests the harness writes instead of the model. A hand-written test scenario was a large part
// of every answer (output tokens are most of a call's latency), and it is mechanical: replay the
// event under the draft in the scene that asked and note what changed. The test is attached to the
// rule and guards it from then on (a learned rule is one type's, placed at one leaf: there is no
// other instance of a class to try it on, design.md §5.16).

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
  const l = withArtifacts(lib, patch)
  return { lib: l, onto: ontologyWith(onto, l) }
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

/**
 * Does the patch's answer change anything in the scene that asked (a status, a number, a thing made, gone or
 * become another, a cell), beyond its words? What a `use` must do (design.md §5.17): an emit whose receiver has
 * no answer of its own changes nothing here.
 */
export function changesScene(patch: Patch, req: ModRequest, lib: RuleLibrary, onto: Ontology): boolean {
  try {
    const cand = candidate(patch, lib, onto)
    return patch.artifacts.some((a) => a.kind === 'rule' && (effectsOf(req.scenario, a.rule, cand.lib, cand.onto)?.length ?? 0) > 1)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------- what a thing affords
// What a thing affords for an act (design.md §5.17). The modder says it before it designs ("affords"): a common use
// a player would reasonably expect (a chair is sat on), words only (a bare hand on a wall), or nothing. The harness
// holds the answer to it: a use must change the scene that asked, not only speak of it; words are provisional (the
// port asks again when the player keeps trying); nothing is decided.

/** The judgment the answer states: `affords` beside the patch, or inside it. */
export function statedAffordance(answer: unknown): Affordance | undefined {
  const o = answer && typeof answer === 'object' ? (answer as Record<string, unknown>) : {}
  const p = o.patch && typeof o.patch === 'object' ? (o.patch as Record<string, unknown>) : {}
  const x = String(o.affords ?? p.affords ?? '').trim().toLowerCase()
  return (AFFORDANCES as readonly string[]).includes(x) ? (x as Affordance) : undefined
}

/** The rules of the patch that answer the request (its host's type, its kind), not another thing's reply. */
function answering(patch: Patch, req: ModRequest): Rule[] {
  const rules = patchRules(patch)
  const own = rules.filter((r) => r.host?.type === req.event.host?.type && r.on === req.event.kind)
  return own.length ? own : rules.slice(0, 1)
}

/** What a rule's own effects say it is, when the answer did not: a change is a use; lines alone, words; nothing, none. */
function derivedAffordance(r: Rule): Affordance {
  if (!changesNothing(r)) return 'use'
  return JSON.stringify(r.tree).includes('"op":"') ? 'words' : 'none'
}

const SPEAKS = new Set(['vfx', 'say', 'log', 'emote', 'emit'])

/** Does a leaf of the rule change its host itself (a status, a prop, a transform, a spawn…), not only speak or send? */
function writesItself(r: Rule): boolean {
  return leaves(r.tree).some((l) => isDo(l) && l.do.some((e) => !SPEAKS.has(e.op)))
}

export interface Judged {
  patch: Patch
  affords: Affordance
  /** A use that changes nothing in the scene that asked: what to tell the designer. */
  mismatch?: string
  /** What the harness set right by itself. */
  fixes: string[]
}

/**
 * The answer's judgment, held to what the answer does: written on the answering rules (`affords`, and `reasked`
 * when the question was asked again). `force` overrides it (a use that still changed nothing after a repair is
 * kept as words: provisional, so it can grow).
 */
export function judge(patch: Patch, req: ModRequest, stated: Affordance | undefined, lib: RuleLibrary, onto: Ontology, force?: Affordance): Judged {
  const fixes: string[] = []
  const rules = answering(patch, req)
  const derived = rules.map(derivedAffordance)
  let affords: Affordance = force ?? stated ?? (derived.includes('use') ? 'use' : derived.includes('words') ? 'words' : 'none')
  // words or nothing that change the world after all are a use
  if (!force && affords !== 'use' && derived.includes('use')) {
    fixes.push(`judged "${affords}" but the rule changes the world: kept as "use"`)
    affords = 'use'
  }
  // only an answer whose change is all sent to others may change nothing (its receiver may have no answer): one that
  // writes its host, or whose derived test saw the scene change, needs no replay of its own
  const seen = rules.some((r) => writesItself(r) || r.tests?.some((t) => t.name?.startsWith('derived') && (t.expect?.length ?? 0) > 1))
  // the answer is held to what it said: an unsaid judgment is read off the rule, never sent back
  const mismatch =
    !force && stated === 'use' && affords === 'use' && !seen && !changesScene(patch, req, lib, onto)
      ? 'You judged this a use (affords "use"), but in the scene that asked your rule changes nothing: no status, number, thing or cell is different afterwards, only words (an impulse you emit has no answer from its receiver there). Make the use real: state on the host, or an impulse its receiver answers (a posture: emit settle to the actor with {pose}). If the thing truly has no use for this act, answer with affords "words" and a short line.'
      : undefined
  const ids = new Set(rules.map((r) => r.id))
  const artifacts = patch.artifacts.map((a) => (a.kind === 'rule' && ids.has(a.rule.id) ? { ...a, rule: { ...a.rule, affords, ...(req.again && { reasked: true }) } } : a))
  return { patch: { ...patch, artifacts }, affords, mismatch, fixes }
}
