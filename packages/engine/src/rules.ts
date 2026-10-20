// Rules as host natures (design.md §5.6): matching, specificity, the condition tree, and the
// versioned rule library. Resolution is the same for every event: the most specific base rule
// whose host and kind fit is walked to a leaf; `inherit` goes up a level; an undefined leaf
// consults the host type's own learned tree for that hole (design.md §5.16) — learned rules are
// only ever reached there, so the AI fills holes and never changes what is defined. Each tier of the AI
// setting keeps its own trees (quality.ts): an event takes its own tier's answer first, then a higher one's.

import { isA, typeDepth } from './ontology.ts'
import { ruleTier, tiersFrom } from './quality.ts'
import { STACK_MAX, slotsOf, stackKey } from './stacks.ts'
import { FIGHT_TICKS } from './types.ts'
import type { Bounds, Cmp, Cond, GameEvent, Leaf, Operand, PropValue, Reader, RoleName, Rule, Selector, StatusDef, Tier, Tree, TypeDef } from './types.ts'
import type { View, World } from './world.ts'

export const ROLES: RoleName[] = ['host', 'actor', 'target', 'instrument', 'other', 'item', 'source']

export type Roles = Partial<Record<Reader, View>>

// ---------------------------------------------------------------- matching

export function cmp(v: PropValue | undefined, c: Cmp): boolean {
  if (typeof c !== 'object' || c === null) return v === c
  if (c.eq !== undefined && v !== c.eq) return false
  if (c.ne !== undefined && v === c.ne) return false
  if (typeof v !== 'number') return c.gt === undefined && c.gte === undefined && c.lt === undefined && c.lte === undefined
  if (c.gt !== undefined && !(v > c.gt)) return false
  if (c.gte !== undefined && !(v >= c.gte)) return false
  if (c.lt !== undefined && !(v < c.lt)) return false
  if (c.lte !== undefined && !(v <= c.lte)) return false
  return true
}

export function matchSelector(sel: Selector | undefined, v: View | undefined): boolean {
  if (!sel) return true
  if (!v) return false
  if (sel.type && !isA(v.type, sel.type)) return false
  if (sel.id && v.id !== sel.id) return false
  for (const t of sel.tags ?? []) if (!v.tags.has(t)) return false
  for (const t of sel.notTags ?? []) if (v.tags.has(t)) return false
  for (const s of sel.status ?? []) if (!v.statuses.has(s)) return false
  for (const s of sel.notStatus ?? []) if (v.statuses.has(s)) return false
  for (const [k, c] of Object.entries(sel.props ?? {})) if (!cmp(v.props[k], c)) return false
  return true
}

/** The views of an event's roles, its host included. */
export function rolesOf(ev: GameEvent, world: World): Roles {
  // read anything: the event's roles, and the stewards (the story's facts are its props)
  const out: Roles = { host: world.view(ev.host), story: world.view({ e: 'story' }), world: world.view({ e: 'world' }) }
  for (const [k, r] of Object.entries(ev.roles)) out[k as RoleName] = world.view(r)
  return out
}

export function evalCond(c: Cond | undefined, roles: Roles, world: World, ev?: GameEvent): boolean {
  if (!c) return true
  if ('all' in c) return c.all.every((x) => evalCond(x, roles, world, ev))
  if ('any' in c) return c.any.some((x) => evalCond(x, roles, world, ev))
  if ('not' in c) return !evalCond(c.not, roles, world, ev)
  if ('is' in c) return !!roles[c.is.role] && matchSelector(c.is.sel, roles[c.is.role])
  if ('none' in c) return !roles[c.none]
  if ('same' in c) {
    const [a, b] = c.same.map((r) => roles[r])
    return !!a && !!b && sameRef(a, b)
  }
  if ('leads' in c) {
    const [leader, follower] = c.leads.map((r) => roles[r])
    return !!leader && !!follower && 'e' in leader.ref && (follower.props.companion === leader.ref.e || follower.props.follow === leader.ref.e)
  }
  if ('has' in c) {
    const v = roles[c.has.role]
    if (!v) return false
    if (c.has.status && !v.statuses.has(c.has.status)) return false
    if (c.has.tag && !v.tags.has(c.has.tag)) return false
    return true
  }
  if ('prop' in c) {
    const v = roles[c.prop.role]?.props[c.prop.key] ?? c.prop.default
    if (v === undefined) return false
    if (c.prop.cmp !== undefined && !cmp(v, c.prop.cmp)) return false
    if (c.prop.bounds && !(typeof v === 'number' && within(v, c.prop.bounds, roles, ev))) return false
    return true
  }
  if ('propEqualsParam' in c) {
    const prop = roles[c.propEqualsParam.role]?.props[c.propEqualsParam.key]
    const param = ev?.params?.[c.propEqualsParam.param]
    return prop !== undefined && param !== undefined && prop === param
  }
  if ('param' in c) {
    const v = ev?.params?.[c.param.key]
    return v !== undefined && cmp(v, c.param.cmp)
  }
  if ('chance' in c) return world.chance(c, c.chance)
  if ('hour' in c) {
    const h = world.hour()
    return c.hour.from <= c.hour.to ? h >= c.hour.from && h < c.hour.to : h >= c.hour.from || h < c.hour.to
  }
  if ('night' in c) return world.isNight() === c.night
  if ('count' in c) {
    const v = roles[c.count.role]
    if (!v) return false
    const adding = c.count.adding ? roles[c.count.adding] : undefined
    return within(countAt(v, c.count.in, c.count.match, world, { stacks: c.count.stacks, adding }), c.count.cmp, roles, ev)
  }
  if ('topic' in c) return world.topicFresh(c.topic)
  if ('weather' in c) return c.weather.includes(world.calendar().weather)
  if ('exists' in c) {
    // (read by kind where it names one)
    const pool = c.exists.type ? world.ofType(c.exists.type) : Object.values(world.state.entities)
    for (const e of pool) if (e.place.on !== 'none' && matchSelector(c.exists, world.view({ e: e.id }))) return true
    return false
  }
  if ('rel' in c) {
    const e = roles[c.rel.role]?.entity
    return !!e && world.relationsOf(e).some((k) => k.startsWith(`${c.rel.how}|`))
  }
  if ('worn' in c) {
    const e = roles[c.worn]?.entity
    const holder = e && (e.place.on === 'inside' || e.place.on === 'hand') ? world.get(e.place.holder) : undefined
    const slot = e && world.prop(e, 'slot')
    return !!e && !!holder && typeof slot === 'string' && world.wearKeys(slot).some((k) => world.prop(holder, k) === e.id)
  }
  if ('makeup' in c) {
    const v = roles[c.makeup]
    return !!v && !!world.onto.resolve(v.type).makeup?.length
  }
  if ('outdoors' in c) {
    // a thing with a place: its cell is not covered; the story and the world: the map one plays on has a sky
    const p = roles.host && world.refPos(roles.host.ref)
    if (p) return !world.covered(p.map, p.x, p.y, p.z)
    const map = world.posOf(world.player)?.map
    return !!map && (world.map(map)?.light ?? 'outdoor') === 'outdoor'
  }
  if ('fighting' in c) {
    const e = roles[c.fighting]?.entity
    return !!e && world.state.tick - (e.combat?.fightTick ?? -Infinity) < FIGHT_TICKS
  }
  if ('remembers' in c) return !!roles[c.remembers]?.entity?.npc
  // a module's condition (module.ts)
  for (const [key, impl] of world.condImpls) if (key in c) return impl(c, roles, world, ev)
  return false
}

export function sameRef(a: View, b: View): boolean {
  return a.ref.e === b.ref.e
}

/** Things in a role's contents, or lying on its tile besides the role itself (not the ground there), that match a selector. */
export function countAt(
  v: View,
  where: 'contents' | 'tile' | 'map',
  match: Selector | undefined,
  world: World,
  opts?: { stacks?: boolean; adding?: View },
): number {
  let ids: Iterable<string>
  if (where === 'contents') ids = v.entity?.contents ?? []
  else {
    const p = world.refPos(v.ref)
    // its cell, or everything lying on its map (in the open: not what is carried or held)
    ids = !p ? [] : where === 'map' ? world.entitiesOnMap(p.map).filter((e) => e.place.on === 'tile').map((e) => e.id) : world.placedAt(p.map, p.x, p.y).map((e) => e.id)
  }
  if (where === 'contents' && !match && opts?.stacks) {
    const counts = new Map<string, number>()
    let slots = 0
    for (const id of ids) {
      if (id === v.id) continue
      const e = world.get(id)
      if (!e || e.place.on === 'none') continue
      const key = stackKey(e)
      const count = counts.get(key) ?? 0
      if (count % STACK_MAX === 0) slots++
      counts.set(key, count + 1)
    }
    if (opts.adding) {
      const key = stackKey(opts.adding.entity ?? opts.adding)
      if ((counts.get(key) ?? 0) % STACK_MAX === 0) slots++
    }
    return slots
  }
  const keys: string[] = []
  let n = 0
  for (const id of ids) {
    if (id === v.id) continue
    // With no selector, an entity's identity is enough. A bulk deposit counts the growing
    // contents once per item; rebuilding every full view here makes those inputs stall.
    if (!match) {
      const e = world.get(id)
      if (e && e.place.on !== 'none') {
        n++
        if (opts?.stacks) keys.push(stackKey(e))
        continue
      }
    }
    const w = world.view({ e: id })
    if (w && matchSelector(match, w)) {
      n++
      if (opts?.stacks) keys.push(stackKey(w.entity ?? w))
    }
  }
  // as things (the default): one apiece. As slots: one per kind, and one more for each STACK_MAX
  // beyond the first — with the one at hand counted in, so a stack that still has room takes it.
  if (!opts?.stacks) return n
  if (opts.adding) keys.push(stackKey(opts.adding.entity ?? opts.adding))
  return slotsOf(keys)
}

export function operand(o: Operand, roles: Roles, ev?: GameEvent): number | undefined {
  if (typeof o === 'number') return o
  if ('param' in o) {
    const v = ev?.params?.[o.param]
    return typeof v === 'number' ? v * (o.mul ?? 1) : undefined
  }
  const v = roles[o.of]?.props[o.prop]
  return typeof v === 'number' ? v * (o.mul ?? 1) : undefined
}

export function within(n: number, b: Bounds, roles: Roles, ev?: GameEvent): boolean {
  const tests: [Operand | undefined, (lim: number) => boolean][] = [
    [b.eq, (l) => n === l],
    [b.gt, (l) => n > l],
    [b.gte, (l) => n >= l],
    [b.lt, (l) => n < l],
    [b.lte, (l) => n <= l],
  ]
  for (const [o, ok] of tests) {
    if (o === undefined) continue
    const lim = operand(o, roles, ev)
    if (lim === undefined || !ok(lim)) return false
  }
  return true
}

/** Does a rule's `on` (a kind or a branch of the kind tree) cover this kind? */
export function kindCovers(on: string, kind: string): boolean {
  return kind === on || kind.startsWith(on + '/')
}

// ---------------------------------------------------------------- the condition tree

/** Walk a tree to its leaf; `path` records each branch taken (for the request and the hole's key). */
export function walk(tree: Tree, roles: Roles, world: World, ev: GameEvent): { leaf: Leaf; path: string[] } {
  const path: string[] = []
  let t: Tree = tree
  for (let guard = 0; guard < 64; guard++) {
    if (typeof t === 'string' || !('if' in t)) return { leaf: t, path }
    const yes = evalCond(t.if, roles, world, ev)
    path.push(`${yes ? '' : '!'}${JSON.stringify(t.if)}`)
    t = yes ? t.then : (t.else ?? 'inherit')
  }
  return { leaf: 'inherit', path }
}

/** Every leaf of a tree. */
export function leaves(tree: Tree): Leaf[] {
  if (typeof tree === 'string' || !('if' in tree)) return [tree]
  return [...leaves(tree.then), ...leaves(tree.else ?? 'inherit')]
}

export const isDo = (l: Leaf): l is { do: import('./types.ts').Effect[] } => typeof l === 'object' && 'do' in l
export const isHole = (l: Leaf): l is { undefined: true; default?: import('./types.ts').Effect[] } => typeof l === 'object' && 'undefined' in l

// ---------------------------------------------------------------- specificity

/**
 * Rules written before there were no kinds (world-model.md §4.1) selected `{kind: 'actor'}`;
 * the kind names are the type tree's roots, so such a selector is `{type: 'actor'}` (or, when it
 * also named a type, just that type). Applied in place to a rule's host, its conditions' selectors
 * and its emissions' filters whenever a rule enters a library (old saves, old patches).
 */
export function selectByType(rule: Rule): Rule {
  const fix = (s: unknown): void => {
    if (!s || typeof s !== 'object' || !('kind' in s)) return
    const sel = s as { kind?: unknown; type?: string }
    if (typeof sel.kind === 'string' && !sel.type) sel.type = sel.kind
    delete sel.kind
  }
  const tree = (t: unknown): void => {
    if (!t || typeof t !== 'object') return
    const node = t as Record<string, unknown>
    if ('if' in node) (cond(node.if), tree(node.then), tree(node.else))
    for (const e of (Array.isArray(node.do) ? node.do : []).concat(Array.isArray(node.default) ? node.default : [])) fix((e as { filter?: unknown })?.filter)
  }
  const cond = (c: unknown): void => {
    if (!c || typeof c !== 'object') return
    const node = c as Record<string, unknown>
    for (const k of ['all', 'any']) if (Array.isArray(node[k])) (node[k] as unknown[]).forEach(cond)
    if (node.not) cond(node.not)
    if (node.is && typeof node.is === 'object') fix((node.is as { sel?: unknown }).sel)
  }
  fix(rule.host)
  tree(rule.tree)
  return rule
}

/**
 * Rules written when facts were the world's (world-model.md §3): a fact is a prop of the story,
 * so `{fact: {key, cmp}}` reads it (`{prop: {role: 'story', key, cmp, default: 0}}`) and
 * `setFact`/`addFact` are the story's `setProp`/`addProp`. Applied in place, like `selectByType`.
 */
export function factsOnTheStory(rule: Rule): Rule {
  const cond = (c: unknown): unknown => {
    if (!c || typeof c !== 'object') return c
    const node = c as Record<string, unknown>
    if (node.fact && typeof node.fact === 'object') {
      const f = node.fact as { key: string; cmp: unknown }
      return { prop: { role: 'story', key: f.key, cmp: f.cmp, default: 0 } }
    }
    for (const k of ['all', 'any']) if (Array.isArray(node[k])) node[k] = (node[k] as unknown[]).map(cond)
    if (node.not) node.not = cond(node.not)
    return node
  }
  const effects = (list: unknown): void => {
    if (!Array.isArray(list)) return
    list.forEach((e, i) => {
      const x = e as { op?: string; key?: string; value?: unknown; delta?: unknown }
      if (x?.op === 'setFact') list[i] = { op: 'setProp', key: x.key, value: x.value }
      if (x?.op === 'addFact') list[i] = { op: 'addProp', key: x.key, delta: x.delta }
    })
  }
  const tree = (t: unknown): void => {
    if (!t || typeof t !== 'object') return
    const node = t as Record<string, unknown>
    if ('if' in node) (node.if = cond(node.if)), tree(node.then), tree(node.else)
    effects(node.do)
    effects(node.default)
  }
  tree(rule.tree)
  return rule
}

/**
 * Rules written when a cell was a terrain with an override (world-model.md §4.6): a cell is made
 * of things, so `setTerrain {terrain}` — the host becomes that terrain — is the host transforming
 * into `tile/<terrain>` (which gives way when that space of its cell is taken). Applied in place.
 * And a thing at no health was `defeated`; every thing with durability is `broken` (world-model.md
 * D30): a condition on the old name reads the new one. The ground's `forage` and the night's `appear {types, ring, cap, tag}`
 * are one `appear` over data.
 */
export function cellsAsThings(rule: Rule): Rule {
  const cond = (c: unknown): void => {
    if (!c || typeof c !== 'object') return
    const node = c as Record<string, unknown>
    for (const k of ['all', 'any']) if (Array.isArray(node[k])) (node[k] as unknown[]).forEach(cond)
    if (node.not) cond(node.not)
    const p = node.param as { key?: string; cmp?: unknown } | undefined
    if (p?.key === 'name' && p.cmp === 'defeated') p.cmp = 'broken'
  }
  const effects = (list: unknown): void => {
    if (!Array.isArray(list)) return
    list.forEach((e, i) => {
      const x = e as { op?: string; terrain?: string }
      if (x?.op === 'setTerrain') list[i] = { op: 'transform', into: `tile/${x.terrain}` }
      // what appears by itself is one primitive over data (world-model.md §6.9)
      if (x?.op === 'forage') list[i] = { op: 'appear' }
      const old = x as { op?: string; types?: Record<string, number>; ring?: [number, number]; cap?: number; tag?: string }
      if (old?.op === 'appear' && old.types) list[i] = { op: 'appear', what: { types: old.types, ring: old.ring, max: old.cap ?? 1, every: 0, tag: old.tag, ai: { behaviour: 'melee', temper: 'aggressive', sight: 8, leash: 14 } } }
    })
  }
  const tree = (t: unknown): void => {
    if (!t || typeof t !== 'object') return
    const node = t as Record<string, unknown>
    if ('if' in node) cond(node.if), tree(node.then), tree(node.else)
    effects(node.do)
    effects(node.default)
  }
  tree(rule.tree)
  return rule
}

/** Lexicographic: (instance-bound, host type depth, host constraints, event kind depth). */
export type Spec = [number, number, number, number]

export function specOf(rule: Rule): Spec {
  const s = rule.host ?? {}
  const inst = s.id ? 1 : 0
  // a type below the root is one level deeper; naming a root type (actor, item, fixture, tile) is
  // one constraint, as naming its kind was before there were none
  const depth = s.type ? typeDepth(s.type) - 1 : 0
  const n = (s.type ? 1 : 0) + (s.tags?.length ?? 0) + (s.notTags?.length ?? 0) + (s.status?.length ?? 0) + (s.notStatus?.length ?? 0) + Object.keys(s.props ?? {}).length
  return [inst, depth, n, rule.on.split('/').length]
}

export function compareSpec(a: Spec, b: Spec): number {
  for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

export const isPatch = (r: Rule) => r.source?.origin === 'patch'
/** A root rule: it names no host class (it answers for anything). */
export const isRoot = (r: Rule) => !r.host || Object.keys(r.host).length === 0

// ---------------------------------------------------------------- resolution

export interface Resolution {
  /** The outcome is defined: a rule (base or patch) gives effects. */
  defined: boolean
  /** The rule whose leaf decided (the learned answer that filled the hole, when one did). */
  rule?: Rule
  leaf?: Leaf
  /** The base rule and path where the outcome was undefined (filled or not). */
  hole?: { rule: Rule; path: string[]; default: import('./types.ts').Effect[] }
  /**
   * Still undefined after the host type's own trees (design.md §5.16): the place (`placeKey`), the tier
   * the event is answered at, and the path in that tier's tree to the undefined leaf the event fell
   * into (empty: no tree yet). A learned answer is placed there.
   */
  open?: { key: string; tier: Tier; path: string[] }
}

// ---------------------------------------------------------------- learned trees

/** A hole as a key: its base rule, and the branch that reached it. */
export const holeKey = (rule: string, path: string[]): string => `${rule}${path.length ? '#' + path.join('&') : ''}`

/** A host type's place for answers to one kind of event at one hole, at every tier: `type|kind|hole`. */
export const placeKey = (type: string, kind: string, hole: string): string => `${type}|${kind}|${hole}`

/** Where a host type's learned answers to one kind of event at one hole, made at one tier, live: one tree per key. */
export const patchKey = (type: string, kind: string, hole: string, tier: Tier = 'medium'): string => `${placeKey(type, kind, hole)}|${tier}`

/** A learned rule that has a place: its host is one type, its kind is exact, and it names its hole. */
export const placed = (r: Rule): boolean => isPatch(r) && typeof r.hole === 'string' && typeof r.on === 'string' && !!r.host?.type && Object.keys(r.host).length === 1

/** The key of a learned rule's tree (undefined for one with no place: an older class patch). */
export const keyOf = (r: Rule): string | undefined => (placed(r) ? patchKey(r.host!.type!, r.on, r.hole!, ruleTier(r)) : undefined)

/** A copy of a tree that keeps its leaves by reference (so a leaf still tells which rule it came from). */
function copyTree(t: Tree): Tree {
  if (typeof t === 'string' || !('if' in t)) return t
  return { if: t.if, then: copyTree(t.then), ...(t.else !== undefined ? { else: copyTree(t.else) } : {}) }
}

/** The branch a path element names at an if-node: the condition, taken (`...`) or not (`!...`). */
const branchKey = (c: Cond, yes: boolean): string => `${yes ? '' : '!'}${JSON.stringify(c)}`

/**
 * Follow a path (as `walk` records it) through a tree to the leaf it ends at. Returns how to replace
 * that leaf, or undefined when the path does not fit the tree.
 */
export function locate(tree: Tree, path: string[]): { leaf: Leaf; set: (t: Tree) => Tree } | undefined {
  if (!path.length) return typeof tree === 'string' || !('if' in tree) ? { leaf: tree, set: (t) => t } : undefined
  if (typeof tree === 'string' || !('if' in tree)) return undefined
  const node = tree
  const yes = path[0] === branchKey(node.if, true)
  if (!yes && path[0] !== branchKey(node.if, false)) return undefined
  const sub = locate(yes ? node.then : (node.else ?? 'inherit'), path.slice(1))
  if (!sub) return undefined
  return { leaf: sub.leaf, set: (t) => (yes ? { ...node, then: sub.set(t) } : { ...node, else: sub.set(t) }) }
}

interface Composed {
  tree: Tree
  /** Each leaf (by reference) to the learned rule it belongs to. */
  owner: WeakMap<object, string>
  /** Answers that could not be placed: their leaf is gone or already answered. */
  stale: { id: string; why: string }[]
}

/**
 * One tree per key from its answers in the order they were learned: the first answer is the tree;
 * each later one replaces the undefined leaf at its `at`. A leaf keeps its answer, so the rule that
 * decided an event is known, and an answer set aside at runtime leaves its leaves open.
 */
export function compose(answers: Rule[]): Composed {
  const owner = new WeakMap<object, string>()
  const stale: Composed['stale'] = []
  let tree: Tree | undefined
  for (const r of answers) {
    for (const l of leaves(r.tree)) if (typeof l === 'object') owner.set(l, r.id)
    const at = r.at ?? []
    if (tree === undefined) {
      if (at.length) stale.push({ id: r.id, why: 'placed below a leaf, but no answer holds the tree yet' })
      else tree = copyTree(r.tree)
      continue
    }
    const spot = locate(tree, at)
    if (!spot) stale.push({ id: r.id, why: 'its place is gone: the path no longer leads to a leaf' })
    else if (!isHole(spot.leaf)) stale.push({ id: r.id, why: `its leaf is already answered by "${owner.get(spot.leaf as object) ?? '?'}"` })
    else tree = spot.set(copyTree(r.tree))
  }
  return { tree: tree ?? { undefined: true }, owner, stale }
}

// ---------------------------------------------------------------- library

export interface LibraryEntry {
  version: number
  action: 'add' | 'remove'
  ruleId?: string
  rule?: Rule
  type?: TypeDef
  typeId?: string
  statusId?: string
  status?: StatusDef
  at: string
}

export interface LibraryData {
  rules: Rule[]
  types: TypeDef[]
  statuses: StatusDef[]
  log: LibraryEntry[]
  version: number
}

/**
 * The rule library: base rules + learned answers, with an append-only log so any patch can be
 * inspected, rolled back or ablated. Base rules are bucketed by the root of their kind and kept
 * most specific first. Learned rules form one tree per (host type, event kind, hole, tier), grown by
 * answers in the order they were learned (design.md §5.16; §13, the AI setting).
 */
export class RuleLibrary {
  private base = new Map<string, Rule[]>()
  private specs = new Map<string, Spec>()
  /** Learned answers by their tree's key, in the order they were added. */
  private byKey = new Map<string, Rule[]>()
  private trees = new Map<string, Composed>()
  private order = new Map<string, number>()
  /** Where removed learned rules stood (a revision takes its predecessor's place, so what grew below it stays). */
  private retired = new Map<string, { order: number; key: string | undefined }>()
  private added = 0
  readonly rules = new Map<string, Rule>()
  /** Types and statuses introduced by patches (base ontology lives in content). */
  types: TypeDef[] = []
  statuses: StatusDef[] = []
  log: LibraryEntry[] = []
  version = 0

  constructor(rules: Rule[] = []) {
    for (const r of rules) {
      // one id, one rule: a second would silently replace the first
      if (this.rules.has(r.id)) throw new Error(`rule id "${r.id}" appears twice`)
      this.put(r, undefined, true)
    }
    // the indexes once, not once per rule (a clone of a thousand rules was a thousand sorts)
    for (const root of new Set([...this.rules.values()].filter((r) => !isPatch(r)).map((r) => r.on.split('/')[0]))) this.rebuild(root)
    for (const key of new Set([...this.rules.values()].map(keyOf).filter((k): k is string => !!k))) this.rebuildTree(key)
  }

  private put(r: Rule, inPlaceOf?: string, later = false): void {
    selectByType(r)
    factsOnTheStory(r)
    cellsAsThings(r)
    this.rules.set(r.id, r)
    this.specs.set(r.id, specOf(r))
    const old = inPlaceOf ? this.retired.get(inPlaceOf) : undefined
    this.order.set(r.id, old && old.key === keyOf(r) ? old.order : this.added++)
    if (later) return
    if (isPatch(r)) this.rebuildTree(keyOf(r))
    else this.rebuild(r.on.split('/')[0])
  }

  private rebuild(root: string): void {
    const all = [...this.rules.values()].filter((r) => !isPatch(r) && r.on.split('/')[0] === root)
    const order = (a: Rule, b: Rule) => compareSpec(this.specs.get(b.id)!, this.specs.get(a.id)!)
    this.base.set(root, all.sort(order))
  }

  /** The tree of a key from its answers, oldest first (a learned rule with no place is kept, never consulted). */
  private rebuildTree(key: string | undefined): void {
    if (!key) return
    const list = [...this.rules.values()].filter((r) => keyOf(r) === key).sort((a, b) => this.order.get(a.id)! - this.order.get(b.id)!)
    if (!list.length) {
      this.byKey.delete(key)
      this.trees.delete(key)
      return
    }
    this.byKey.set(key, list)
    this.trees.set(key, compose(list))
  }

  spec(id: string): Spec | undefined {
    return this.specs.get(id)
  }

  /** inPlaceOf: a learned rule this one replaces (a revision): it takes that rule's place in its tree. */
  add(rule: Rule, now = new Date().toISOString(), inPlaceOf?: string): void {
    this.put(rule, inPlaceOf)
    this.version += 1
    this.log.push({ version: this.version, action: 'add', ruleId: rule.id, rule, at: now })
  }

  addType(t: TypeDef, now = new Date().toISOString()): void {
    this.types = this.types.filter((x) => x.id !== t.id).concat(t)
    this.version += 1
    this.log.push({ version: this.version, action: 'add', type: t, at: now })
  }

  /** Forget a learned type (rolled back with the patch that brought it). */
  removeType(id: string, now = new Date().toISOString()): boolean {
    if (!this.types.some((t) => t.id === id)) return false
    this.types = this.types.filter((t) => t.id !== id)
    this.version += 1
    this.log.push({ version: this.version, action: 'remove', typeId: id, at: now })
    return true
  }

  /** Forget a learned status (rolled back with the patch that brought it). */
  removeStatus(id: string, now = new Date().toISOString()): boolean {
    if (!this.statuses.some((s) => s.id === id)) return false
    this.statuses = this.statuses.filter((s) => s.id !== id)
    this.version += 1
    this.log.push({ version: this.version, action: 'remove', statusId: id, at: now })
    return true
  }

  addStatus(s: StatusDef, now = new Date().toISOString()): void {
    this.statuses = this.statuses.filter((x) => x.id !== s.id).concat(s)
    this.version += 1
    this.log.push({ version: this.version, action: 'add', status: s, at: now })
  }

  remove(id: string, now = new Date().toISOString()): boolean {
    const r = this.rules.get(id)
    if (!r) return false
    this.rules.delete(id)
    this.specs.delete(id)
    this.retired.set(id, { order: this.order.get(id)!, key: keyOf(r) })
    this.order.delete(id)
    if (isPatch(r)) this.rebuildTree(keyOf(r))
    else this.rebuild(r.on.split('/')[0])
    this.version += 1
    this.log.push({ version: this.version, action: 'remove', ruleId: id, at: now })
    return true
  }

  /** The base rules whose kind covers this one and whose host fits, most specific first. */
  candidates(kind: string, host: View | undefined): Rule[] {
    const list = this.base.get(kind.split('/')[0]) ?? []
    return list.filter((r) => kindCovers(r.on, kind) && matchSelector(r.host, host))
  }

  /** The learned answers of a host type to a kind, at every hole and tier (oldest first within a tree). */
  learned(type: string | undefined, kind: string): Rule[] {
    if (!type) return []
    const out: Rule[] = []
    for (const [key, list] of this.byKey) if (key.startsWith(`${type}|${kind}|`)) out.push(...list)
    return out
  }

  /** The composed tree at a key (undefined: no answer yet). */
  tree(key: string): Tree | undefined {
    return this.trees.get(key)?.tree
  }

  /** Learned rules that have no place in their tree any more (their leaf is gone or already answered). */
  stale(): { id: string; why: string }[] {
    return [...this.trees.values()].flatMap((c) => c.stale)
  }

  /** Every rule a kind could reach (base and learned), for the ModSpec's context and the dev panel. */
  forKind(kind: string): Rule[] {
    const root = kind.split('/')[0]
    return [...(this.base.get(root) ?? []), ...this.patches().filter((r) => kindCovers(r.on, kind) || kindCovers(kind, r.on))]
  }

  /** Walk the base chain: the first leaf that does not inherit. */
  private chain(list: Rule[], roles: Roles, world: World, ev: GameEvent): { rule: Rule; leaf: Leaf; path: string[] } | undefined {
    for (const rule of list) {
      const { leaf, path } = walk(rule.tree, roles, world, ev)
      if (leaf !== 'inherit') return { rule, leaf, path }
    }
    return undefined
  }

  /**
   * Resolve an event's outcome (design.md §5.6, §5.16): the base chain to a leaf; at a hole, the host
   * type's own trees for that hole — the event's tier's first, then the higher tiers', nearest first
   * (design.md §13, the AI setting: a higher answer serves a lower setting, never the reverse). Still open: where an answer of
   * the event's own tier would go. Conditions may consume randomness: callers dry-running restore it.
   */
  resolve(ev: GameEvent, roles: Roles, world: World, tierOf: Tier | (() => Tier) = 'medium'): Resolution {
    const base = this.chain(this.candidates(ev.kind, roles.host), roles, world, ev)
    if (!base) return { defined: false }
    if (!isHole(base.leaf)) return { defined: true, rule: base.rule, leaf: base.leaf }
    // (the tier only matters at a hole: worked out only there)
    const tier = typeof tierOf === 'function' ? tierOf() : tierOf
    const hole = { rule: base.rule, path: base.path, default: base.leaf.default ?? [] }
    const place = placeKey(roles.host?.type ?? '-', ev.kind, holeKey(base.rule.id, base.path))
    let open = { key: place, tier, path: [] as string[] }
    for (const t of tiersFrom(tier)) {
      const composed = this.trees.get(`${place}|${t}`)
      if (!composed) continue
      const { leaf, path } = walk(composed.tree, roles, world, ev)
      const id = typeof leaf === 'object' ? composed.owner.get(leaf) : undefined
      const rule = id ? this.rules.get(id) : undefined
      // (a leaf that says undefined is open, whatever else it carries; a learned answer set aside at
      // runtime answers no more: its leaf is open again)
      if (rule && isDo(leaf) && !isHole(leaf) && !world.state.quarantine?.[rule.id]) return { defined: true, rule, leaf, hole }
      if (t === tier) open = { key: place, tier, path }
    }
    return { defined: false, rule: base.rule, leaf: base.leaf, hole, open }
  }

  /** Is there a learned tree for this hole at any of these tiers? */
  grown(type: string, kind: string, hole: string, tiers: Tier[]): boolean {
    return tiers.some((t) => this.trees.has(patchKey(type, kind, hole, t)))
  }

  /**
   * Could this host's event of this kind do anything? False when every rule that could answer it
   * is a root rule whose only outcome is no change — then the engine need not make the event.
   */
  /**
   * Whether, by its type alone, some rule could answer a kind for a thing (a cheap test before its view is made): never
   * a no that a rule would answer. `tags`: all the tags the thing has, when they are its type's alone (a cell of a map's
   * data, not kept: nothing of its own) — a rule for other tags is passed over too.
   */
  mayAnswer(kind: string, type: string, tags?: readonly string[]): boolean {
    if (this.may?.version !== this.version) this.may = { version: this.version, by: new Map() }
    const k = `${kind}|${type}${tags ? '|t' : ''}`
    let v = this.may.by.get(k)
    if (v === undefined) {
      const list = this.base.get(kind.split('/')[0]) ?? []
      v =
        list.some((r) => kindCovers(r.on, kind) && (!isRoot(r) || leaves(r.tree).some((l) => l !== 'inherit' && !(isDo(l) && l.do.length === 0))) && (!r.host?.type || isA(type, r.host.type) || isA(r.host.type, type)) && (!tags || !r.host?.tags || r.host.tags.every((t) => tags.includes(t)))) ||
        this.learned(type, kind).length > 0
      this.may.by.set(k, v)
    }
    return v
  }
  private may?: { version: number; by: Map<string, boolean> }

  answers(kind: string, host: View | undefined): boolean {
    for (const r of this.candidates(kind, host)) {
      if (!isRoot(r)) return true
      if (leaves(r.tree).some((l) => l !== 'inherit' && !(isDo(l) && l.do.length === 0))) return true
    }
    for (const r of this.learned(host?.type, kind)) if (leaves(r.tree).some((l) => isDo(l) && l.do.length > 0)) return true
    return false
  }

  /** The learned rules, in the order they hold their places (a revision where its predecessor stood). */
  patches(): Rule[] {
    return this.inOrder().filter(isPatch)
  }

  /**
   * Every rule in its order: a revision takes its predecessor's place, so it can stand before rules
   * added earlier (the answers that grew below it). A copy or a save keeps that order, or what grew
   * below a revision would come before it and lose its place.
   */
  private inOrder(): Rule[] {
    return [...this.rules.values()].sort((a, b) => this.order.get(a.id)! - this.order.get(b.id)!)
  }

  clone(): RuleLibrary {
    const lib = new RuleLibrary(this.inOrder())
    lib.order = new Map(this.order)
    lib.retired = new Map(this.retired)
    lib.added = this.added
    lib.types = [...this.types]
    lib.statuses = [...this.statuses]
    lib.version = this.version
    return lib
  }

  toJSON(): LibraryData {
    return { rules: this.inOrder(), types: this.types, statuses: this.statuses, log: this.log, version: this.version }
  }

  /** What was learned (the patches, the kinds and statuses they brought, the log): what a save keeps — the base is the game's, fresh from content on every load. */
  learnedJSON(): LibraryData {
    return { rules: this.patches(), types: this.types, statuses: this.statuses, log: this.log, version: this.version }
  }

  static fromJSON(d: LibraryData): RuleLibrary {
    const lib = new RuleLibrary(d.rules)
    lib.types = d.types ?? []
    lib.statuses = d.statuses ?? []
    lib.log = d.log ?? []
    lib.version = d.version ?? 0
    return lib
  }
}
