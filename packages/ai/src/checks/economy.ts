// The economy check (world-model.md §8.4, §10.2): no combination of conversions makes more of
// anything than it takes. Every conversion the world knows is a step (what it takes, what it
// gives): a recipe, a thing broken down into its makeup, a rule that turns one item into others.
// A "free lunch" is a mix of steps, each run some number of times, after which no thing is fewer
// and some thing is more. That is a linear programme: with x_j in [0, 1] the times step j runs,
// maximise the total net gain subject to every thing's net change being >= 0. x = 0 is feasible,
// so the simplex starts there with no first phase; a positive optimum is a free lunch, and the
// steps with x_j > 0 are the cycle to show. (With one input and one output per step this is
// currency arbitrage, a positive cycle Bellman-Ford finds; several in and out need the LP.)
//
// Chance is counted by expectation: a run that is repeated without end gives on average what it
// gives once, weighed by its odds (a part that breaks off one time in four is a quarter of a
// part; a branch taken three times in ten gives three tenths of what it gives). So a lottery that
// loses on average is no free lunch, and one that wins on average is one. A choice the state
// makes (a condition on what the item is) is the player's: each way is a step of its own. When
// there is none, the simplex's dual gives prices (every thing at least 1) under which no step
// gives more value than it takes: the proof that nothing comes from nothing.

import { OntologyIndex, cmp, compareSpec, deriveRecipes, isA, isPatch, kindCovers, specOf, type Amount, type Cond, type Effect, type Ontology, type PropValue, type Reader, type Rule, type Selector, type Tree } from '@openworld/engine'

export interface Step {
  name: string
  takes: Map<string, number>
  gives: Map<string, number>
}

export interface FreeLunch {
  gain: number
  /** the steps of the mix and how often each runs (scaled so the largest is 1) */
  uses: { step: string; times: number }[]
  /** what the mix leaves more of */
  makes: { type: string; n: number }[]
}

const EPS = 1e-9

/** Every conversion the ontology and these rules say; unmodelled paths are reported to the caller. */
export function economySteps(onto: Ontology, rules: Rule[], recovery: number, warnings: string[] = []): Step[] {
  const conversions = new Conversions(onto, rules, recovery, warnings)
  const out: Step[] = []
  // a recipe makes as many as its type yields at once (a log into two planks), as the engine makes them
  for (const r of deriveRecipes(conversions.index)) out.push({ name: `recipe ${r.id}`, takes: sum(r.needs.map((n) => [n.type, n.count])), gives: new Map([[r.make.type, r.count ?? 1]]) })
  for (const id of Object.keys(onto.types)) {
    const r = conversions.index.resolve(id)
    if (typeof r.props.maxHp === 'number') out.push(...conversions.broken(id))
  }
  for (const rule of rules) {
    // A receive carries its sender's cost; breaks have their actual event parameters.
    if (!kindCovers(rule.on, 'threshold/cross') && rule.on !== 'impulse/receive') out.push(...conversions.rule(rule))
  }
  return out
}

/** A host used up, what it takes in, and the outputs of the impulses it sends, as one step. */
export function ruleSteps(rule: Rule, onto: Ontology, rules: Rule[] = [rule], warnings: string[] = []): Step[] {
  return new Conversions(onto, rules, onto.params?.recovery ?? 0.5, warnings).rule(rule)
}

interface Context {
  host: string
  roles: Partial<Record<Reader, Selector>>
  params: Record<string, PropValue | undefined>
  complete: boolean
  broken?: boolean
}

/** Static event paths: state choices remain alternatives, known types and emitted params narrow them. */
class Conversions {
  readonly index: OntologyIndex

  constructor(readonly onto: Ontology, readonly rules: Rule[], readonly recovery: number, readonly warnings: string[]) {
    this.index = new OntologyIndex(onto)
  }

  private warn(path: string, why: string): void {
    path = path.replace(/\.(?:then|else)\b| \[[^\]]+\]/g, '')
    const message = `economy: ${path}: ${why} not modelled; the economy proof covers only extracted conversions`
    if (!this.warnings.includes(message)) this.warnings.push(message)
  }

  private types(sel: Selector = {}): string[] {
    return Object.keys(this.onto.types).filter((id) => this.matches(id, sel))
  }

  private matches(id: string, sel: Selector = {}): boolean {
    const tags = this.index.resolve(id).tags
    return (!sel.type || isA(id, sel.type)) && (sel.tags ?? []).every((t) => tags.includes(t)) && !(sel.notTags ?? []).some((t) => tags.includes(t))
  }

  private context(host: string): Context {
    return { host, roles: { host: { type: host } }, params: {}, complete: false }
  }

  private steps(out: Outcome[], name: string): Step[] {
    return out.filter((o) => [...o.takes.values()].some((n) => n > 0) && [...o.gives.values()].some((n) => n > 0)).map((o) => ({ name: `${name}${o.path}`, takes: o.takes, gives: o.gives }))
  }

  private unique(out: Outcome[], path: string): Outcome[] {
    const seen = new Map<string, Outcome>()
    for (const o of out) seen.set(JSON.stringify([[...o.takes].sort(), [...o.gives].sort()]), o)
    if (seen.size > 256) this.warn(path, 'more than 256 distinct conversion paths')
    return [...seen.values()].slice(0, 256)
  }

  rule(rule: Rule): Step[] {
    const hosts = this.types(rule.host)
    if (!hosts.length) this.warn(`rule ${rule.id}`, 'a host class with no statically matching type')
    return hosts.flatMap((host) => {
      const name = `rule ${rule.id}${hosts.length === 1 && host === rule.host?.type ? '' : ` [${host}]`}`
      const ctx = this.context(host)
      ctx.roles.host = { ...rule.host, type: host }
      return this.steps(this.walk(rule.tree, ctx, name, [], () => [empty()]), name)
    })
  }

  broken(host: string): Step[] {
    const ctx = { ...this.context(host), params: { name: 'broken', prop: 'hp' }, complete: true, broken: true }
    // Without a rule library, makeup alone still defines the ordinary break conversion.
    const out = this.rules.length ? this.resolve('threshold/cross', ctx, `break ${host}`, []) : this.leaf([{ op: 'breakdown' }], ctx, `break ${host}`, [])
    return this.steps(out, `break ${host}`)
  }

  private condition(c: Cond, ctx: Context): boolean | undefined {
    if ('all' in c || 'any' in c) {
      const values = ('all' in c ? c.all : c.any).map((x) => this.condition(x, ctx))
      return 'all' in c ? values.includes(false) ? false : values.every((v) => v === true) ? true : undefined : values.includes(true) ? true : values.every((v) => v === false) ? false : undefined
    }
    if ('not' in c) {
      const v = this.condition(c.not, ctx)
      return v === undefined ? undefined : !v
    }
    if ('param' in c) {
      const v = ctx.params[c.param.key]
      return v !== undefined ? cmp(v, c.param.cmp) : ctx.complete && !(c.param.key in ctx.params) ? false : undefined
    }
    if ('is' in c) {
      const known = ctx.roles[c.is.role]
      if (!known) return ctx.complete ? false : undefined
      const sel = c.is.sel
      if (known.type && sel.type && !isA(known.type, sel.type) && !isA(sel.type, known.type)) return false
      if (sel.tags?.length || sel.notTags?.length || sel.status?.length || sel.notStatus?.length || sel.props || sel.id) return undefined
      return !sel.type || (known.type && isA(known.type, sel.type)) ? true : undefined
    }
    if ('none' in c) return ctx.roles[c.none] ? false : ctx.complete ? true : undefined
    if ('makeup' in c) {
      const type = ctx.roles[c.makeup]?.type
      return type ? !!this.index.resolve(type).makeup?.length : ctx.complete ? false : undefined
    }
    return undefined
  }

  private narrow(c: Cond, ctx: Context): Context {
    if ('all' in c) return c.all.reduce((a, x) => this.narrow(x, a), ctx)
    if ('is' in c) {
      const old = ctx.roles[c.is.role] ?? {}
      const sel = c.is.sel
      const type = old.type && (!sel.type || isA(old.type, sel.type)) ? old.type : sel.type
      return { ...ctx, roles: { ...ctx.roles, [c.is.role]: { ...old, ...sel, type, tags: [...(old.tags ?? []), ...(sel.tags ?? [])] } } }
    }
    if ('param' in c && (typeof c.param.cmp !== 'object' || c.param.cmp === null || 'eq' in c.param.cmp)) {
      const value = typeof c.param.cmp === 'object' && c.param.cmp !== null ? c.param.cmp.eq : c.param.cmp
      return { ...ctx, params: { ...ctx.params, [c.param.key]: value }, ...(c.param.key === 'name' && value === 'broken' && { broken: true }) }
    }
    return ctx
  }

  private walk(t: Tree, ctx: Context, path: string, stack: string[], inherit: () => Outcome[], hole = inherit, root = path): Outcome[] {
    if (!t || t === 'inherit') return inherit()
    if ('undefined' in t) return hole()
    if ('if' in t) {
      const odds = chanceOf(t.if)
      const value = this.condition(t.if, ctx)
      const yes = () => this.walk(t.then, this.narrow(t.if, ctx), `${path}.then`, stack, inherit, hole, root)
      const no = () => this.walk(t.else ?? 'inherit', ctx, `${path}.else`, stack, inherit, hole, root)
      if (!odds) return this.unique(value === true ? yes() : value === false ? no() : [...yes(), ...no()], path)
      if (value === false || odds.p === 0) return no()
      const a = yes(), b = no()
      const mixed = a.flatMap((x) => b.map((y) => mix(x, y, odds.p, `(${odds.p})`)))
      return this.unique(odds.pure ? mixed : [...mixed, ...b], path)
    }
    return this.leaf(t.do, ctx, path, stack).map((o) => ({ ...o, path: path.slice(root.length) + o.path }))
  }

  private amount(a: Amount | undefined, ctx: Context): number | undefined {
    if (a === undefined) return 1
    if (typeof a === 'number') return a
    const v = 'param' in a ? ctx.params[a.param] : ctx.roles[a.of]?.type ? this.index.resolve(ctx.roles[a.of]!.type!).props[a.prop] : undefined
    return typeof v === 'number' ? v * (a.mul ?? 1) + (a.add ?? 0) : undefined
  }

  private named(name: string, ctx: Context): string | undefined {
    if (!name.startsWith('@')) return name
    const match = /^@prop:(?:(\w+)\.)?(\w+)$/.exec(name)
    const type = match && ctx.roles[(match[1] ?? 'host') as Reader]?.type
    const value = type && this.index.resolve(type).props[match![2]]
    return typeof value === 'string' && value in this.onto.types ? value : undefined
  }

  private leaf(fx: Effect[], ctx: Context, path: string, stack: string[]): Outcome[] {
    const o = empty()
    const usedUp = ctx.broken || fx.some((e) => e.op === 'destroy' || e.op === 'transform' || e.op === 'breakdown')
    if (usedUp) add(o.takes, ctx.host, 1)
    // an input is counted: the host used up, a link of a chain, or a spawn
    const counted = usedUp || stack.length > 0 || fx.some((e) => e.op === 'spawn')
    let out = [o]
    for (const e of fx) {
      if (e.op === 'transform' || e.op === 'spawn') {
        const type = this.named(e.op === 'transform' ? e.into : e.type, ctx)
        const n = e.op === 'transform' ? 1 : this.amount(e.count, ctx)
        if (type && n !== undefined && Number.isFinite(n)) for (const a of out) add(a.gives, type, Math.max(0, Math.floor(n)))
        else this.warn(path, 'dynamic type or output count')
      } else if (e.op === 'breakdown') {
        // one of a thing made several at once leaves its share of the makeup (the engine divides by its yields)
        const r = this.index.resolve(ctx.host)
        const share = 1 / Math.max(1, r.yields ?? 1)
        for (const m of r.makeup ?? []) for (const a of out) add(a.gives, m.type, m.count * (m.chance ?? 1) * this.recovery * share)
      } else if (e.op === 'emit') {
        const item = ctx.roles.item?.type
        if (item && e.impulse === 'taken' && e.to === 'item' && e.params?.into === 'contents') {
          for (const a of out) add(a.takes, item, e.chance ?? 1)
          continue
        }
        // Pure emissions have no input here; durable receivers' breaks are separate steps.
        if (!counted) {
          if (this.rules.some((r) => isPatch(r) && path.startsWith(`rule ${r.id}`))) this.warn(path, 'emitted outcomes without a statically counted input')
          continue
        }
        const sel = typeof e.to === 'string' ? ctx.roles[e.to as Reader] ?? (e.to === 'story' || e.to === 'world' ? { type: `resident/${e.to}` } : undefined) : undefined
        if (!sel || (!sel.type && !sel.tags?.length)) {
          this.warn(path, 'emitted receivers or their multiplicity')
          continue
        }
        if (e.to === 'host' && fx.some((e) => e.op === 'destroy' || e.op === 'transform')) {
          this.warn(path, 'an emit queued after its host changes')
          continue
        }
        const params = Object.fromEntries(Object.entries(e.params ?? {}).map(([k, v]) => [k, typeof v !== 'object' || v === null ? v : 'typeOf' in v ? ctx.roles[v.typeOf]?.type : 'idOf' in v || 'stackKeyOf' in v ? undefined : this.amount(v, ctx)]))
        const receivers = this.types(sel).filter((id) => this.matches(id, e.filter))
        if (!receivers.length) this.warn(path, 'an emitted class with no statically matching type')
        const choices = this.unique(receivers.flatMap((host) => this.resolve(`impulse/${e.impulse}`, { host, roles: { host: { ...sel, type: host }, source: ctx.roles.host, actor: ctx.roles.actor, instrument: ctx.roles.instrument, item: e.item ? ctx.roles[e.item] : undefined, other: e.other ? ctx.roles[e.other] : undefined }, params, complete: true }, path, stack)), path)
        out = this.unique(out.flatMap((a) => (choices.length ? choices : [empty()]).map((b) => combine(a, mix(b, empty(), e.chance ?? 1, b.path)))), path)
      } else if (counted && ['hurt', 'addStatus', 'removeStatus', 'setProp', 'addProp', 'craft', 'build', 'grow', 'quests', 'appear', 'fall'].includes(e.op)) {
        this.warn(path, `${e.op}'s state-dependent consequences`)
      }
    }
    return out
  }

  private resolve(kind: string, ctx: Context, path: string, stack: string[]): Outcome[] {
    const key = `${ctx.host}:${kind}`
    if (stack.includes(key) || stack.length >= 16) {
      this.warn(path, 'a recursive emit chain')
      return [empty()]
    }
    const candidates = this.rules.filter((r) => kindCovers(r.on, kind) && this.matches(ctx.host, r.host)).sort((a, b) => compareSpec(specOf(b), specOf(a)))
    const base = candidates.filter((r) => !isPatch(r)), patches = candidates.filter(isPatch)
    const chain = (list: Rule[], i: number, patch: boolean): Outcome[] => {
      const r = list[i]
      if (!r) {
        if (patch || !base.length) this.warn(path, `the undefined ${kind} response of ${ctx.host}`)
        return [empty()]
      }
      const inherit = () => chain(list, i + 1, patch)
      return this.walk(r.tree, ctx, `${path} -> ${r.id}`, [...stack, key], inherit, () => chain(patches, 0, true)).map((o) => ({ ...o, path: ` -> ${r.id}${o.path}` }))
    }
    return chain(base, 0, false)
  }
}

const empty = (): Outcome => ({ takes: new Map(), gives: new Map(), path: '' })
function combine(a: Outcome, b: Outcome): Outcome {
  return { takes: sum([...a.takes, ...b.takes]), gives: sum([...a.gives, ...b.gives]), path: a.path + b.path }
}

interface Outcome {
  takes: Map<string, number>
  gives: Map<string, number>
  path: string
}

const add = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n)
/** Counts by type, a type named twice summed (a part in a makeup twice, by chance and not). */
const sum = (pairs: [string, number][]): Map<string, number> => pairs.reduce((m, [k, n]) => add(m, k, n), new Map<string, number>())

/** Two outcomes as one, the first with odds p. */
function mix(a: Outcome, b: Outcome, p: number, path: string): Outcome {
  const o: Outcome = { takes: new Map(), gives: new Map(), path }
  for (const [k, n] of a.takes) add(o.takes, k, p * n)
  for (const [k, n] of b.takes) add(o.takes, k, (1 - p) * n)
  for (const [k, n] of a.gives) add(o.gives, k, p * n)
  for (const [k, n] of b.gives) add(o.gives, k, (1 - p) * n)
  return o
}

/** The odds of a condition that rolls: `{chance}`, or chances among an `all` (pure: nothing else in it). */
function chanceOf(c: Cond): { p: number; pure: boolean } | undefined {
  if ('chance' in c) return { p: Math.min(1, Math.max(0, c.chance)), pure: true }
  if ('all' in c) {
    const rolls = c.all.filter((x): x is { chance: number } => 'chance' in x)
    if (!rolls.length) return undefined
    return { p: rolls.reduce((a, r) => a * Math.min(1, Math.max(0, r.chance)), 1), pure: rolls.length === c.all.length }
  }
  return undefined
}

/** The steps that share a thing with `seed` steps, and so may combine with them. */
export function connected(steps: Step[], seed: Step[]): Step[] {
  const things = new Set<string>()
  const add = (s: Step) => [...s.takes.keys(), ...s.gives.keys()].forEach((t) => things.add(t))
  seed.forEach(add)
  const inside = new Set(seed)
  for (let grew = true; grew; ) {
    grew = false
    for (const s of steps) {
      if (inside.has(s)) continue
      if ([...s.takes.keys(), ...s.gives.keys()].some((t) => things.has(t))) (inside.add(s), add(s), (grew = true))
    }
  }
  return [...inside]
}

/** What a free lunch must gain at least (below it, rounding). */
const GAIN = 1e-7

/**
 * The economy as a linear programme: rows one per thing (sum_j -net_tj x_j <= 0: no thing fewer),
 * then one per step (x_j <= 1); the objective the total net gain.
 */
function programme(steps: Step[]) {
  const items = [...new Set(steps.flatMap((s) => [...s.takes.keys(), ...s.gives.keys()]))]
  const net = (s: Step, t: string) => (s.gives.get(t) ?? 0) - (s.takes.get(t) ?? 0)
  const A: number[][] = [...items.map((t) => steps.map((s) => -net(s, t))), ...steps.map((_, j) => steps.map((__, k) => (k === j ? 1 : 0)))]
  const b = [...items.map(() => 0), ...steps.map(() => 1)]
  const c = steps.map((s) => items.reduce((a, t) => a + net(s, t), 0))
  return { items, net, A, b, c }
}

/** The best free lunch among these steps, or undefined when none makes more than it takes. */
export function freeLunch(steps: Step[]): FreeLunch | undefined {
  if (!steps.length) return undefined
  const { items, net, A, b, c } = programme(steps)
  const { x, value } = simplexMax(A, b, c)
  if (value <= GAIN) return undefined
  // the mix, checked by hand: no thing fewer (the simplex's arithmetic is floating point)
  const left = items.map((t) => steps.reduce((a, s, j) => a + net(s, t) * x[j], 0))
  if (left.some((n, i) => n < -EPS * steps.reduce((a, s, j) => a + Math.abs(net(s, items[i]) * x[j]), 0))) throw new Error('economy: the simplex returned a mix that leaves a thing fewer')
  const top = Math.max(...x)
  const uses = steps.map((s, j) => ({ step: s.name, times: x[j] / top })).filter((u) => u.times > 0)
  const makes = items.map((t, i) => ({ type: t, n: left[i] / top })).filter((m) => m.n > 0)
  return { gain: value, uses, makes }
}

/**
 * The proof that there is no free lunch (LP duality): a price for every thing, at least 1, under
 * which no step gives more value than it takes. From the simplex's dual: with y_t the dual of
 * thing t's row, the price is 1 + y_t (the dual's bound rows are all 0 when the optimum is 0).
 * Undefined when there is a free lunch.
 */
export function prices(steps: Step[]): Map<string, number> | undefined {
  if (!steps.length) return new Map()
  const { items, A, b, c } = programme(steps)
  const { value, y } = simplexMax(A, b, c)
  if (value > GAIN) return undefined
  const p = new Map(items.map((t, i) => [t, 1 + y[i]]))
  const worth = (counts: Map<string, number>) => [...counts].reduce((a, [t, n]) => a + n * p.get(t)!, 0)
  if (steps.some((s) => worth(s.gives) - worth(s.takes) > EPS * (worth(s.gives) + worth(s.takes)))) throw new Error('economy: cannot certify prices in the original units')
  return p
}

export interface Solution {
  /** the optimum */
  x: number[]
  /** the dual: one value per row of A (each >= 0); b·y = c·x */
  y: number[]
  value: number
}

/**
 * max c·x subject to A x <= b, x >= 0, with b >= 0 (so x = 0 is a vertex and no first phase is
 * needed). Dense tableau, Bland's rule: the first improving column enters, the first row of the
 * least ratio leaves (ties to the lowest basic index), which cannot cycle on a degenerate vertex.
 * Throws when the programme is unbounded (never for the economy: every x_j <= 1) or b < 0.
 */
export function simplexMax(A: number[][], b: number[], c: number[]): Solution {
  const m = A.length
  const n = c.length
  if (b.some((v) => v < 0)) throw new Error('simplex: b must be >= 0 (x = 0 the first vertex)')
  if (b.length !== m || A.some((r) => r.length !== n || r.some((v) => !Number.isFinite(v))) || [...b, ...c].some((v) => !Number.isFinite(v))) throw new Error('simplex: a finite, rectangular programme is required')
  // Units must not decide whether a coefficient is zero; solve in balanced units and undo them.
  const units = A.map((r, i) => Math.max(Math.abs(b[i]), ...r.map(Math.abs)) || 1)
  const bounds = A.map((r) => r.every((v) => v >= 0))
  const columns = c.map((_, j) => {
    const bound = Math.min(...A.map((r, i) => bounds[i] && b[i] > 0 && r[j] > 0 ? b[i] / r[j] : Infinity))
    return Number.isFinite(bound) && bound > 0 ? 1 / bound : Math.max(0, ...A.map((r, i) => Math.abs(r[j]) / units[i])) || 1
  })
  const rows = A.map((r, i) => Math.max(Math.abs(b[i]), ...r.map((v, j) => Math.abs(v) / columns[j])) || 1)
  const costs = Math.max(0, ...c.map((v, j) => Math.abs(v) / columns[j])) || 1
  // tableau: m rows of [A | I | b], the last row the objective [-c | 0 | 0]
  const T: number[][] = A.map((row, i) => [...row.map((v, j) => v / rows[i] / columns[j]), ...Array.from({ length: m }, (_, k) => (k === i ? 1 : 0)), b[i] / rows[i]])
  T.push([...c.map((v, j) => -v / columns[j] / costs), ...Array(m).fill(0), 0])
  const basis = Array.from({ length: m }, (_, i) => n + i)
  const width = n + m
  // (Bland's rule ends; the bound only guards against floating point gone wrong)
  for (let iter = 0; ; iter++) {
    if (iter > 1000 * (m + n + 1)) throw new Error('simplex: no optimum after too many pivots')
    const z = T[m]
    let col = -1
    for (let j = 0; j < width; j++)
      if (z[j] < -EPS) {
        col = j
        break
      }
    if (col < 0) break
    let row = -1
    let best = Infinity
    for (let i = 0; i < m; i++) {
      const a = T[i][col]
      if (a <= 0) continue
      const ratio = T[i][width] / a
      const tolerance = EPS * Math.max(Math.abs(ratio), Math.abs(best))
      if (row < 0 || ratio < best - tolerance || (Math.abs(ratio - best) <= tolerance && basis[i] < basis[row])) ((best = ratio), (row = i))
    }
    if (row < 0) throw new Error('simplex: unbounded')
    const p = T[row][col]
    for (let j = 0; j <= width; j++) T[row][j] /= p
    for (let i = 0; i <= m; i++) {
      if (i === row) continue
      const f = T[i][col]
      if (f === 0) continue
      for (let j = 0; j <= width; j++) {
        const before = T[i][j], change = f * T[row][j]
        const after = before - change
        T[i][j] = Math.abs(after) <= 16 * Number.EPSILON * (Math.abs(before) + Math.abs(change)) ? 0 : after
      }
    }
    basis[row] = col
  }
  const x = Array(n).fill(0)
  for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = Math.max(0, T[i][width]) / columns[basis[i]]
  // the dual: the objective row under each slack
  const y = Array.from({ length: m }, (_, i) => (T[m][n + i] > EPS ? T[m][n + i] : 0) * costs / rows[i])
  const primal = c.reduce((a, v, j) => a + v * x[j], 0)
  const dual = b.reduce((a, v, i) => a + v * y[i], 0)
  const feasible = (terms: number[], limit: number) => terms.reduce((a, v) => a + v, 0) <= limit + EPS * (Math.abs(limit) + terms.reduce((a, v) => a + Math.abs(v), 0))
  if ([...x, ...y, primal, dual].some((v) => !Number.isFinite(v))) throw new Error('simplex: non-finite solution')
  if (A.some((r, i) => !feasible(r.map((v, j) => v * x[j]), b[i]))) throw new Error('simplex: cannot certify the mix in the original units')
  if (c.some((v, j) => !feasible(A.map((r, i) => -r[j] * y[i]), -v))) throw new Error('simplex: cannot certify the dual in the original units')
  if (Math.abs(primal - dual) > EPS * (c.reduce((a, v, j) => a + Math.abs(v * x[j]), 0) + b.reduce((a, v, i) => a + Math.abs(v * y[i]), 0))) throw new Error('simplex: cannot certify the optimum in the original units')
  return { x, y, value: primal }
}
