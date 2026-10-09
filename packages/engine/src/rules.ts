// Rules as host natures (design.md §5.6): matching, specificity, the condition tree, and the
// versioned rule library. Rules are written for classes, most specific first, and an `inherit`
// leaf means "what the less specific rules say here". That is the author's shorthand only: the
// library compiles each type's rules for a kind into one complete tree (design.md §5.16), every
// parent's answer copied into it, and an event walks that tree once. A learned rule replaces one
// leaf of it, the one the event that asked reached: a hole, or what the type inherited from a
// class. What the type's own rule defines it never touches.

import { isA, typeDepth } from './ontology.ts'
import { FIGHT_TICKS } from './types.ts'
import type { Bounds, Cmp, Cond, GameEvent, Leaf, Operand, PropValue, Reader, RoleName, Rule, Selector, StatusDef, Tree, TypeDef } from './types.ts'
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
    return !!leader && !!follower && 'e' in leader.ref && follower.props.companion === leader.ref.e
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
    return !!v && within(countAt(v, c.count.in, c.count.match, world), c.count.cmp, roles, ev)
  }
  if ('topic' in c) return world.topicFresh(c.topic)
  if ('weather' in c) return c.weather.includes(world.calendar().weather)
  if ('exists' in c) {
    for (const e of Object.values(world.state.entities)) if (e.place.on !== 'none' && matchSelector(c.exists, world.view({ e: e.id }))) return true
    return false
  }
  if ('rel' in c) {
    const e = roles[c.rel.role]?.entity
    return !!e && world.relationsOf(e).some((k) => k.startsWith(`${c.rel.how}|`))
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
  return false
}

export function sameRef(a: View, b: View): boolean {
  return a.ref.e === b.ref.e
}

/** Things in a role's contents, or lying on its tile besides the role itself (not the ground there), that match a selector. */
export function countAt(v: View, where: 'contents' | 'tile', match: Selector | undefined, world: World): number {
  let ids: Iterable<string>
  if (where === 'contents') ids = v.entity?.contents ?? []
  else {
    const p = world.refPos(v.ref)
    ids = p ? world.placedAt(p.map, p.x, p.y).map((e) => e.id) : []
  }
  let n = 0
  for (const id of ids) if (id !== v.id && matchSelector(match, world.view({ e: id }))) n++
  return n
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

// ---------------------------------------------------------------- compiling

/** A tree with its `inherit` leaves replaced by `rest`, and its own leaves marked with the rule they came from. */
export function graft(t: Tree, rest: Tree, from: string): Tree {
  if (t === 'inherit') return rest
  if ('if' in t) return { if: t.if, then: graft(t.then, rest, from), else: graft(t.else ?? 'inherit', rest, from) }
  return { ...t, from }
}

/** The leaf at a path of a compiled tree (a walk's path), or undefined when the tree has no such leaf. */
export function leafAt(t: Tree, at: string[]): Leaf | undefined {
  let n: Tree = t
  for (const step of at) {
    if (typeof n !== 'object' || !('if' in n)) return undefined
    const no = step.startsWith('!')
    if (JSON.stringify(n.if) !== (no ? step.slice(1) : step)) return undefined
    n = no ? (n.else ?? 'inherit') : n.then
  }
  return typeof n === 'object' && 'if' in n ? undefined : n
}

/** A compiled tree with the leaf at a path replaced (by what `make` makes of it); undefined when there is no such leaf. */
function replaceAt(t: Tree, at: string[], i: number, make: (leaf: Leaf) => Tree): Tree | undefined {
  if (i === at.length) return typeof t === 'object' && 'if' in t ? undefined : make(t)
  if (typeof t !== 'object' || !('if' in t)) return undefined
  const no = at[i].startsWith('!')
  if (JSON.stringify(t.if) !== (no ? at[i].slice(1) : at[i])) return undefined
  if (no) {
    const e = replaceAt(t.else ?? 'inherit', at, i + 1, make)
    return e === undefined ? undefined : { ...t, else: e }
  }
  const th = replaceAt(t.then, at, i + 1, make)
  return th === undefined ? undefined : { ...t, then: th }
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
/** A learned rule of one cell: it answers for exactly one type (design.md §5.16). Older patches named classes. */
export const isCellRule = (r: Rule) => r.cell === true && !!r.host?.type && Object.keys(r.host).length === 1
/** A learned rule placed in its type's compiled tree, replacing one leaf (design.md §5.16). */
export const isEdit = (r: Rule) => isCellRule(r) && Array.isArray(r.at)
/** A patch's rules as taken (design.md §5.16): each one cell's. */
export const asCells = <P extends { artifacts: { kind: string }[] }>(patch: P): P =>
  ({ ...patch, artifacts: patch.artifacts.map((a) => (a.kind === 'rule' && 'rule' in a ? { ...a, rule: { ...(a.rule as Rule), cell: true as const } } : a)) })
/** Was the rule written for this very host (its type, or the instance), not inherited from a broader class? */
export const isOwn = (r: Rule, host: View): boolean => !!r.host && ((!!r.host.id && r.host.id === host.id) || (!!r.host.type && r.host.type === host.type))

/** A short stable hash of what a rule does (host, kind, tree): a copy remembers it (Rule.from). */
export function ruleHash(r: Rule): string {
  const s = JSON.stringify([r.host ?? {}, r.on, r.tree])
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
/** The kinds a soft hole may be (design.md §5.16): using one thing on another, and what one thing does to another. */
const SOFT_KINDS = /^(act\/use|impulse\/)/
/** A root rule: it names no host class (it answers for anything). */
export const isRoot = (r: Rule) => !r.host || Object.keys(r.host).length === 0

// ---------------------------------------------------------------- resolution

export interface Resolution {
  /** The outcome is defined: a rule (base or patch) gives effects. */
  defined: boolean
  /** The rule whose leaf decided (the patch that filled the hole, when one did). */
  rule?: Rule
  leaf?: Leaf
  /** The base rule and path where the outcome was undefined (filled or not). */
  hole?: { rule: Rule; path: string[]; default: import('./types.ts').Effect[] }
  /**
   * A soft hole (design.md §5.16): defined, but only by a rule the host's type inherited, and the
   * type has learned no rule of its own for this kind yet. The outcome runs as inherited; the AI
   * may be asked, meanwhile, what this type does instead.
   */
  soft?: { rule: Rule; path: string[]; default: import('./types.ts').Effect[] }
}

// ---------------------------------------------------------------- library

export interface LibraryEntry {
  version: number
  action: 'add' | 'remove'
  ruleId?: string
  rule?: Rule
  type?: TypeDef
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
 * The rule library: base rules + accepted patches, with an append-only log so any patch can be
 * inspected, rolled back or ablated. Rules are bucketed by the root of their kind and kept most
 * specific first; base and patch rules form separate layers.
 */
export class RuleLibrary {
  private base = new Map<string, Rule[]>()
  private layer = new Map<string, Rule[]>()
  private specs = new Map<string, Spec>()
  private asks = new Map<string, boolean>()
  /** Each type's compiled tree for each kind, learned rules placed (design.md §5.16). */
  private compiled = new Map<string, Tree>()
  /** Learned rules whose place is gone from their type's tree (its rules changed under them). */
  private unplaced = new Set<string>()
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
      this.put(r)
    }
  }

  private put(r: Rule): void {
    selectByType(r)
    factsOnTheStory(r)
    cellsAsThings(r)
    this.rules.set(r.id, r)
    this.specs.set(r.id, specOf(r))
    this.rebuild(r.on.split('/')[0])
  }

  private rebuild(root: string): void {
    const all = [...this.rules.values()].filter((r) => r.on.split('/')[0] === root)
    const order = (a: Rule, b: Rule) => compareSpec(this.specs.get(b.id)!, this.specs.get(a.id)!)
    this.base.set(root, all.filter((r) => !isPatch(r)).sort(order))
    // learned rules in the order they were learned: a later one answers only where earlier ones inherit
    this.layer.set(root, all.filter(isPatch))
    this.asks.clear()
    this.compiled.clear()
    this.unplaced.clear()
  }

  /**
   * The one tree a type answers a kind with (design.md §5.16): every rule that names the type or a
   * class it belongs to, most specific first, compiled into a single tree. Each `inherit` becomes the
   * less specific rules' tree, and what a rule's host requires beyond the type (tags, statuses, an
   * instance) becomes a condition on the host. Then the type's learned rules, in the order learned,
   * each replace the leaf it was asked about. Resolving an event is one walk of this tree.
   */
  treeOf(kind: string, type: string, skip?: Record<string, unknown>): Tree {
    const key = `${type}|${kind}`
    const edits = (this.layer.get(kind.split('/')[0]) ?? []).filter((r) => isEdit(r) && r.on === kind && r.host!.type === type)
    // (a learned rule set aside at runtime answers no more: its leaf is what it replaced)
    const skipped = !!skip && edits.some((r) => skip[r.id])
    const cached = skipped ? undefined : this.compiled.get(key)
    if (cached !== undefined) return cached
    const list = (this.base.get(kind.split('/')[0]) ?? []).filter((r) => kindCovers(r.on, kind) && (!r.host?.type || isA(type, r.host.type)))
    let t: Tree = 'inherit'
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i]
      const own = graft(r.tree, t, r.id)
      const { type: _t, ...rest } = r.host ?? {}
      t = Object.keys(rest).length ? { if: { is: { role: 'host', sel: rest } }, then: own, else: t } : own
    }
    for (const e of edits) {
      if (skipped && skip![e.id]) continue
      const placed = replaceAt(t, e.at!, 0, (leaf) => graft(e.tree, leaf, e.id))
      if (placed === undefined) this.unplaced.add(e.id)
      else t = placed
    }
    if (!skipped) this.compiled.set(key, t)
    return t
  }

  spec(id: string): Spec | undefined {
    return this.specs.get(id)
  }

  add(rule: Rule, now = new Date().toISOString()): void {
    this.put(rule)
    this.version += 1
    this.log.push({ version: this.version, action: 'add', ruleId: rule.id, rule, at: now })
  }

  addType(t: TypeDef, now = new Date().toISOString()): void {
    this.types = this.types.filter((x) => x.id !== t.id).concat(t)
    this.version += 1
    this.log.push({ version: this.version, action: 'add', type: t, at: now })
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
    this.rebuild(r.on.split('/')[0])
    this.version += 1
    this.log.push({ version: this.version, action: 'remove', ruleId: id, at: now })
    return true
  }

  /**
   * The rules of a layer whose kind covers this one and whose host fits: the base most specific
   * first; the learned in the order they were learned, a cell's rule fitting its type exactly.
   */
  candidates(kind: string, host: View | undefined, patches = false): Rule[] {
    const list = (patches ? this.layer : this.base).get(kind.split('/')[0]) ?? []
    return list.filter((r) => kindCovers(r.on, kind) && (patches && isCellRule(r) ? !!host && host.type === r.host!.type : matchSelector(r.host, host)))
  }

  /**
   * Is this kind one the world asks about (root defaults decide what is asked, design.md §5.6)?
   * True when its most specific root rule leaves some outcome undefined: using, impulses; not
   * physics (taking, putting), contact, time or sight.
   */
  askable(kind: string): boolean {
    let a = this.asks.get(kind)
    if (a === undefined) {
      const root = (this.base.get(kind.split('/')[0]) ?? []).find((r) => isRoot(r) && kindCovers(r.on, kind))
      a = !!root && leaves(root.tree).some(isHole)
      this.asks.set(kind, a)
    }
    return a
  }

  /** Has this type learned a rule of its own for this kind (one placed in its tree), from this rule's leaf if named? */
  learned(kind: string, type: string, from?: string): boolean {
    return (this.layer.get(kind.split('/')[0]) ?? []).some((r) => isEdit(r) && r.on === kind && r.host!.type === type && (from === undefined || r.from?.rule === from))
  }

  /**
   * Learned rules to look at again (design.md §5.16): the rule whose leaf one replaced changed since
   * (it still sits there, now over the new leaf), or is gone, or its place is gone from the tree.
   */
  stale(): { rule: string; from: string; why: 'changed' | 'gone' | 'unplaced' }[] {
    const out: { rule: string; from: string; why: 'changed' | 'gone' | 'unplaced' }[] = []
    for (const r of this.patches()) {
      if (isEdit(r)) this.treeOf(r.on, r.host!.type!)
      if (this.unplaced.has(r.id)) out.push({ rule: r.id, from: r.from?.rule ?? '?', why: 'unplaced' })
      else if (!r.from) continue
      else if (!this.rules.get(r.from.rule)) out.push({ rule: r.id, from: r.from.rule, why: 'gone' })
      else if (ruleHash(this.rules.get(r.from.rule)!) !== r.from.hash) out.push({ rule: r.id, from: r.from.rule, why: 'changed' })
    }
    return out
  }

  /** Every rule a kind could reach (both layers), for the ModSpec's context and the dev panel. */
  forKind(kind: string): Rule[] {
    const root = kind.split('/')[0]
    return [...(this.base.get(root) ?? []), ...(this.layer.get(root) ?? [])].filter((r) => kindCovers(r.on, kind) || kindCovers(kind, r.on))
  }

  /** Walk one layer's chain: the first leaf that does not inherit. */
  private chain(list: Rule[], roles: Roles, world: World, ev: GameEvent): { rule: Rule; leaf: Leaf; path: string[] } | undefined {
    for (const rule of list) {
      const { leaf, path } = walk(rule.tree, roles, world, ev)
      if (leaf !== 'inherit') return { rule, leaf, path }
    }
    return undefined
  }

  /**
   * Resolve an event's outcome (design.md §5.6, §5.16): one walk of the host type's compiled tree.
   * Conditions may consume randomness: callers dry-running restore it.
   */
  resolve(ev: GameEvent, roles: Roles, world: World): Resolution {
    const host = roles.host
    if (!host) return this.resolveByChain(ev, roles, world)
    const q = world.state.quarantine
    const { leaf, path } = walk(this.treeOf(ev.kind, host.type, q), roles, world, ev)
    if (leaf === 'inherit') return { defined: false }
    const from = (leaf as { from?: string }).from
    const rule = from ? this.rules.get(from) : undefined
    if (isHole(leaf)) {
      const hole = { rule: rule!, path, default: leaf.default ?? [] }
      // older patches (named for a class, or for a type before they had a place) answer at holes, as they always did
      const patch = this.chain(this.candidates(ev.kind, host, true).filter((r) => !isEdit(r) && !q?.[r.id]), roles, world, ev)
      if (patch && isDo(patch.leaf)) return { defined: true, rule: patch.rule, leaf: patch.leaf, hole }
      return { defined: false, rule, leaf, hole }
    }
    const res: Resolution = { defined: true, rule, leaf }
    // a soft hole: a class's rule answered a use or an impulse the world asks about, and the type has
    // no answer of its own there yet. A root's own answer is physics (a person pushed steps), and so
    // is a threshold; what the type's own rule says is its own
    if (rule && isDo(leaf) && !isPatch(rule) && !isOwn(rule, host) && !isRoot(rule) && SOFT_KINDS.test(ev.kind) && this.askable(ev.kind)) res.soft = { rule, path, default: leaf.do }
    return res
  }

  /**
   * The reference the compiled tree replaces: the chain of rules, most specific first, `inherit`
   * moving down it, patches only at holes. Kept for an event with no host, and for the test that
   * the compiled tree answers every event as the chain does.
   */
  resolveByChain(ev: GameEvent, roles: Roles, world: World): Resolution {
    const base = this.chain(this.candidates(ev.kind, roles.host), roles, world, ev)
    if (!base) return { defined: false }
    if (!isHole(base.leaf)) return { defined: true, rule: base.rule, leaf: base.leaf }
    const hole = { rule: base.rule, path: base.path, default: base.leaf.default ?? [] }
    const patch = this.chain(this.candidates(ev.kind, roles.host, true).filter((r) => !isEdit(r) && !world.state.quarantine?.[r.id]), roles, world, ev)
    if (patch && isDo(patch.leaf)) return { defined: true, rule: patch.rule, leaf: patch.leaf, hole }
    return { defined: false, rule: base.rule, leaf: base.leaf, hole }
  }

  /**
   * Could this host's event of this kind do anything? False when every rule that could answer it
   * is a root rule whose only outcome is no change — then the engine need not make the event.
   */
  answers(kind: string, host: View | undefined): boolean {
    for (const patches of [false, true])
      for (const r of this.candidates(kind, host, patches)) {
        if (!isRoot(r)) return true
        if (leaves(r.tree).some((l) => l !== 'inherit' && !(isDo(l) && l.do.length === 0))) return true
      }
    return false
  }

  patches(): Rule[] {
    return [...this.rules.values()].filter(isPatch)
  }

  clone(): RuleLibrary {
    const lib = new RuleLibrary([...this.rules.values()])
    lib.types = [...this.types]
    lib.statuses = [...this.statuses]
    lib.version = this.version
    return lib
  }

  toJSON(): LibraryData {
    return { rules: [...this.rules.values()], types: this.types, statuses: this.statuses, log: this.log, version: this.version }
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
