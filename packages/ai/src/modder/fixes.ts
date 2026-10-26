// Deterministic repairs. A model repair round costs a full turn (5–10 s); most first answers
// that fail validation fail for mechanical reasons the harness can fix itself. Measured on
// the latency bench, every malformed first answer had a correct rule inside the wrong wrapper.
// Each fix is recorded on the attempt, so the episode shows what was changed and why.

import { OntologyIndex, PRIMITIVES, selectByType, type Artifact, type Cond, type Effect, type Ontology, type Patch, type Rule, type Selector, type Tree } from '@openworld/engine'

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
