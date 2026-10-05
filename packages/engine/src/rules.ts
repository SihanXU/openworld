// Rules as host natures (design.md §5.6): matching, specificity, the condition tree, and the
// versioned rule library. Resolution is the same for every event: the most specific base rule
// whose host and kind fit is walked to a leaf; `inherit` goes up a level; an undefined leaf
// consults the patch layer — patch rules are only ever reached there, so the AI fills holes and
// never changes what is defined.

import { isA, typeDepth } from './ontology.ts'
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
  /** The rule whose leaf decided (the patch that filled the hole, when one did). */
  rule?: Rule
  leaf?: Leaf
  /** The base rule and path where the outcome was undefined (filled or not). */
  hole?: { rule: Rule; path: string[]; default: import('./types.ts').Effect[] }
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
    this.layer.set(root, all.filter(isPatch).sort(order))
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

  /** The rules of a layer whose kind covers this one and whose host fits, most specific first. */
  candidates(kind: string, host: View | undefined, patches = false): Rule[] {
    const list = (patches ? this.layer : this.base).get(kind.split('/')[0]) ?? []
    return list.filter((r) => kindCovers(r.on, kind) && matchSelector(r.host, host))
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

  /** Resolve an event's outcome (design.md §5.6). Conditions may consume randomness: callers dry-running restore it. */
  resolve(ev: GameEvent, roles: Roles, world: World): Resolution {
    const base = this.chain(this.candidates(ev.kind, roles.host), roles, world, ev)
    if (!base) return { defined: false }
    if (!isHole(base.leaf)) return { defined: true, rule: base.rule, leaf: base.leaf }
    const hole = { rule: base.rule, path: base.path, default: base.leaf.default ?? [] }
    const patch = this.chain(this.candidates(ev.kind, roles.host, true), roles, world, ev)
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
