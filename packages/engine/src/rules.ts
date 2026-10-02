// Rule matching, specificity ordering and the versioned rule library.

import { isA, typeDepth } from './ontology.ts'
import type { Bounds, Cmp, Cond, GameEvent, Operand, PropValue, RoleName, Rule, Selector, StatusDef, TypeDef } from './types.ts'
import type { View, World } from './world.ts'

export const ROLES: RoleName[] = ['actor', 'target', 'instrument']

export type Roles = Partial<Record<RoleName, View>>

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
  if (sel.none) return v === undefined
  if (!v) return false
  if (sel.kind && v.kind !== sel.kind) return false
  if (sel.type && !isA(v.type, sel.type)) return false
  if (sel.id && v.id !== sel.id) return false
  if (sel.player !== undefined && v.isPlayer !== sel.player) return false
  for (const t of sel.tags ?? []) if (!v.tags.has(t)) return false
  for (const t of sel.notTags ?? []) if (v.tags.has(t)) return false
  for (const s of sel.status ?? []) if (!v.statuses.has(s)) return false
  for (const s of sel.notStatus ?? []) if (v.statuses.has(s)) return false
  for (const [k, c] of Object.entries(sel.props ?? {})) if (!cmp(v.props[k], c)) return false
  return true
}

export function evalCond(c: Cond | undefined, roles: Roles, world: World): boolean {
  if (!c) return true
  if ('all' in c) return c.all.every((x) => evalCond(x, roles, world))
  if ('any' in c) return c.any.some((x) => evalCond(x, roles, world))
  if ('not' in c) return !evalCond(c.not, roles, world)
  if ('has' in c) {
    const v = roles[c.has.role]
    if (!v) return false
    if (c.has.status && !v.statuses.has(c.has.status)) return false
    if (c.has.tag && !v.tags.has(c.has.tag)) return false
    return true
  }
  if ('prop' in c) return cmp(roles[c.prop.role]?.props[c.prop.key], c.prop.cmp)
  if ('chance' in c) return world.rand() < c.chance
  if ('hour' in c) {
    const h = world.hour()
    return c.hour.from <= c.hour.to ? h >= c.hour.from && h < c.hour.to : h >= c.hour.from || h < c.hour.to
  }
  if ('count' in c) {
    const v = roles[c.count.role]
    return !!v && within(countAt(v, c.count.in, c.count.match, world), c.count.cmp, roles)
  }
  if ('fact' in c) return cmp(world.fact(c.fact.key) ?? 0, c.fact.cmp)
  if ('topic' in c) {
    const day = world.calendar().day
    return (world.state.topics ?? []).some((t) => t.id === c.topic && day < t.day + (t.days ?? 4))
  }
  if ('weather' in c) return c.weather.includes(world.calendar().weather)
  if ('exists' in c) {
    for (const e of Object.values(world.state.entities)) if (e.place.on !== 'none' && matchSelector(c.exists, world.view({ e: e.id }))) return true
    return false
  }
  return false
}

/** Entities in a role's contents, or on its tile besides the role itself, that match a selector. */
export function countAt(v: View, where: 'contents' | 'tile', match: Selector | undefined, world: World): number {
  let ids: Iterable<string>
  if (where === 'contents') ids = v.entity?.contents ?? []
  else {
    const p = world.refPos(v.ref)
    ids = p ? world.entitiesAt(p.map, p.x, p.y).map((e) => e.id) : []
  }
  let n = 0
  for (const id of ids) if (id !== v.id && matchSelector(match, world.view({ e: id }))) n++
  return n
}

function operand(o: Operand, roles: Roles): number | undefined {
  if (typeof o === 'number') return o
  const v = roles[o.of]?.props[o.prop]
  return typeof v === 'number' ? v : undefined
}

export function within(n: number, b: Bounds, roles: Roles): boolean {
  const tests: [Operand | undefined, (lim: number) => boolean][] = [
    [b.eq, (l) => n === l],
    [b.gt, (l) => n > l],
    [b.gte, (l) => n >= l],
    [b.lt, (l) => n < l],
    [b.lte, (l) => n <= l],
  ]
  for (const [o, ok] of tests) {
    if (o === undefined) continue
    const lim = operand(o, roles)
    if (lim === undefined || !ok(lim)) return false
  }
  return true
}

export function rolesOf(ev: GameEvent, world: World): Roles {
  return {
    actor: world.view(ev.roles.actor),
    target: world.view(ev.roles.target),
    instrument: world.view(ev.roles.instrument),
  }
}

/** Pattern match without the guard (guards may consume randomness). */
export function matchPattern(rule: Rule, ev: GameEvent, roles: Roles): boolean {
  if (rule.on !== ev.kind) return false
  const w = rule.when
  if (w.verb && (!ev.verb || !w.verb.includes(ev.verb))) return false
  if (w.element && !w.element.includes(ev.element ?? 'none')) return false
  if (w.status && (!ev.status || !w.status.includes(ev.status))) return false
  if (w.about && (!ev.about || !w.about.includes(ev.about))) return false
  for (const r of ROLES) if (!matchSelector(w[r], roles[r])) return false
  return true
}

// ---------------------------------------------------------------- specificity

/** Lexicographic: (instance-bound, summed type depth, constraint count, priority). */
export type Spec = [number, number, number, number]

function selSpec(s: Selector | undefined): [number, number, number] {
  if (!s) return [0, 0, 0]
  const inst = s.id ? 1 : 0
  const depth = s.type ? typeDepth(s.type) : 0
  const n =
    (s.kind ? 1 : 0) +
    (s.none ? 1 : 0) +
    (s.player !== undefined ? 1 : 0) +
    (s.tags?.length ?? 0) +
    (s.notTags?.length ?? 0) +
    (s.status?.length ?? 0) +
    (s.notStatus?.length ?? 0) +
    Object.keys(s.props ?? {}).length
  return [inst, depth, n]
}

export function specOf(rule: Rule): Spec {
  let inst = 0
  let depth = 0
  let n = 0
  for (const r of ROLES) {
    const [a, b, c] = selSpec(rule.when[r])
    inst += a
    depth += b
    n += c
  }
  if (rule.when.element) n += 1
  if (rule.when.status) n += 1
  if (rule.when.about) n += 1
  if (rule.guard) n += 1
  return [inst, depth, n, rule.priority ?? 0]
}

export function compareSpec(a: Spec, b: Spec): number {
  for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
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
 * The rule library: base rules + accepted patches, with an append-only log so any
 * patch can be inspected, rolled back or ablated. Rules are bucketed by event kind.
 */
export class RuleLibrary {
  private byKind = new Map<string, Rule[]>()
  private specs = new Map<string, Spec>()
  readonly rules = new Map<string, Rule>()
  /** Types and statuses introduced by patches (base ontology lives in content). */
  types: TypeDef[] = []
  statuses: StatusDef[] = []
  log: LibraryEntry[] = []
  version = 0

  constructor(rules: Rule[] = []) {
    for (const r of rules) this.put(r)
  }

  private put(r: Rule): void {
    this.rules.set(r.id, r)
    this.specs.set(r.id, specOf(r))
    this.rebuildKind(r.on)
  }

  private rebuildKind(kind: string): void {
    const list = [...this.rules.values()].filter((r) => r.on === kind)
    list.sort((a, b) => compareSpec(this.specs.get(b.id)!, this.specs.get(a.id)!))
    this.byKind.set(kind, list)
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
    this.rebuildKind(r.on)
    this.version += 1
    this.log.push({ version: this.version, action: 'remove', ruleId: id, at: now })
    return true
  }

  forKind(kind: string): Rule[] {
    return this.byKind.get(kind) ?? []
  }

  /** Every rule whose pattern (and guard) matches, most specific first. */
  match(ev: GameEvent, roles: Roles, world: World): Rule[] {
    const out: Rule[] = []
    for (const r of this.forKind(ev.kind)) {
      if (!matchPattern(r, ev, roles)) continue
      if (!evalCond(r.guard, roles, world)) continue
      out.push(r)
    }
    return out
  }

  /** Rules that miss on exactly one role — shown to the modder as conventions in force. */
  nearMisses(ev: GameEvent, roles: Roles, limit = 8): Rule[] {
    const out: Rule[] = []
    for (const r of this.forKind(ev.kind)) {
      if (r.when.verb && (!ev.verb || !r.when.verb.includes(ev.verb))) continue
      if (r.when.about && (!ev.about || !r.when.about.includes(ev.about))) continue
      let misses = 0
      for (const role of ROLES) if (!matchSelector(r.when[role], roles[role])) misses++
      if (misses === 1) out.push(r)
      if (out.length >= limit) break
    }
    return out
  }

  patches(): Rule[] {
    return [...this.rules.values()].filter((r) => r.source?.origin === 'patch')
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
