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

import { OntologyIndex, deriveRecipes, type Amount, type Cond, type Effect, type Ontology, type Rule, type Selector, type Tree } from '@lsw/engine'

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

/** Every conversion the ontology and these rules say: recipes, breaking down, rules turning items into others. */
export function economySteps(onto: Ontology, rules: Rule[], recovery: number): Step[] {
  const index = new OntologyIndex(onto)
  const out: Step[] = []
  for (const r of deriveRecipes(index)) out.push({ name: `recipe ${r.id}`, takes: sum(r.needs.map((n) => [n.type, n.count])), gives: new Map([[r.make.type, 1]]) })
  for (const id of Object.keys(onto.types)) {
    const r = index.resolve(id)
    if (typeof r.props.maxHp === 'number' && r.makeup?.length) out.push({ name: `break ${id}`, takes: new Map([[id, 1]]), gives: sum(r.makeup.map((m) => [m.type, m.count * (m.chance ?? 1) * recovery])) })
  }
  for (const rule of rules) out.push(...ruleSteps(rule, onto))
  return out
}

/**
 * A rule's conversions: an item host that is used up (transformed or destroyed) is what it takes;
 * a thing put into the host (an `item` it takes into its contents) is taken too; what it spawns,
 * and what the host becomes, is what it gives. Each way the state can choose is a step of its own
 * (branches on a condition are exclusive); a chance is weighed in (`chance` conditions, and a
 * chance on an emit that takes the item in). An outcome that takes nothing is a faucet, the
 * repeat check's to judge.
 */
export function ruleSteps(rule: Rule, onto: Ontology): Step[] {
  const host = rule.host?.type
  const hostType = host && host in onto.types ? host : undefined
  const index = hostType ? new OntologyIndex(onto) : undefined
  const count = (a: Amount | undefined): number | undefined => {
    if (a === undefined) return 1
    if (typeof a === 'number') return a
    // what the host's kind carries (a tree's `logs`), times and plus
    if ('prop' in a && a.of === 'host' && index && hostType) {
      const v = index.resolve(hostType).props[a.prop]
      return typeof v === 'number' ? v * (a.mul ?? 1) + (a.add ?? 0) : undefined
    }
    return undefined // a param: the act's, not known here
  }
  const leaf = (fx: Effect[], item: string | undefined): Outcome => {
    const o: Outcome = { takes: new Map(), gives: new Map(), path: '' }
    const usedUp = fx.some((e) => e.op === 'destroy' || (e.op === 'transform' && !e.into.startsWith('@')))
    if (hostType?.startsWith('item/') && usedUp) add(o.takes, hostType, 1)
    for (const e of fx) {
      if (item && e.op === 'emit' && e.impulse === 'taken' && e.to === 'item' && (e.params as { into?: unknown } | undefined)?.into === 'contents') add(o.takes, item, e.chance ?? 1)
      if (e.op === 'transform' && !e.into.startsWith('@') && host?.startsWith('item/')) add(o.gives, e.into, 1)
      if (e.op === 'spawn' && !e.type.startsWith('@')) {
        const n = count(e.count)
        if (n !== undefined && n > 0) add(o.gives, e.type, n)
      }
    }
    return o
  }
  const walk = (t: Tree, item: string | undefined, path: string): Outcome[] => {
    if (!t || t === 'inherit' || 'undefined' in t) return [{ takes: new Map(), gives: new Map(), path }]
    if ('if' in t) {
      const named = itemType(t.if) ?? item
      const yes = walk(t.then, named, `${path}.then`)
      const no = walk(t.else ?? 'inherit', item, `${path}.else`)
      const odds = chanceOf(t.if)
      if (!odds) return [...yes, ...no]
      // by chance: each way the state chooses before the roll, mixed by the odds
      const mixed = yes.flatMap((a) => no.map((b) => mix(a, b, odds.p, `${path}(${odds.p})`)))
      // (a choice of the state beside the roll: when it fails, the else alone)
      return odds.pure ? mixed : [...mixed, ...no]
    }
    return [{ ...leaf(t.do, item), path }]
  }
  return walk(rule.tree, undefined, '')
    .filter((o) => [...o.takes.values()].some((n) => n > EPS) && [...o.gives.values()].some((n) => n > EPS))
    .map((o) => ({ name: `rule ${rule.id}${o.path}`, takes: o.takes, gives: o.gives }))
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

/** The item type a condition names for the `item` role ({is: {role: 'item', sel: {type}}}, also inside `all`). */
function itemType(c: unknown): string | undefined {
  const o = c as { is?: { role?: string; sel?: Selector }; all?: unknown[] }
  if (o?.is?.role === 'item' && o.is.sel?.type) return o.is.sel.type
  for (const x of o?.all ?? []) {
    const t = itemType(x)
    if (t) return t
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
  if (left.some((n) => n < -1e-6)) throw new Error('economy: the simplex returned a mix that leaves a thing fewer')
  const top = Math.max(...x)
  const uses = steps.map((s, j) => ({ step: s.name, times: x[j] / top })).filter((u) => u.times > 1e-6)
  const makes = items.map((t, i) => ({ type: t, n: left[i] / top })).filter((m) => m.n > 1e-6)
  return { gain: value, uses, makes }
}

/**
 * The proof that there is no free lunch (LP duality): a price for every thing, at least 1, under
 * which no step gives more value than it takes. From the simplex's dual: with y_t the dual of
 * thing t's row, the price is 1 + y_t (the dual's bound rows are all 0 when the optimum is 0).
 * Undefined when there is a free lunch.
 */
export function prices(steps: Step[]): Map<string, number> | undefined {
  const { items, A, b, c } = programme(steps)
  if (!steps.length) return new Map(items.map((t) => [t, 1]))
  const { value, y } = simplexMax(A, b, c)
  if (value > GAIN) return undefined
  return new Map(items.map((t, i) => [t, 1 + y[i]]))
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
  // tableau: m rows of [A | I | b], the last row the objective [-c | 0 | 0]
  const T: number[][] = A.map((row, i) => [...row, ...Array.from({ length: m }, (_, k) => (k === i ? 1 : 0)), b[i]])
  T.push([...c.map((v) => -v), ...Array(m).fill(0), 0])
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
      if (a <= EPS) continue
      const ratio = T[i][width] / a
      if (ratio < best - EPS || (Math.abs(ratio - best) <= EPS && basis[i] < basis[row])) ((best = ratio), (row = i))
    }
    if (row < 0) throw new Error('simplex: unbounded')
    const p = T[row][col]
    for (let j = 0; j <= width; j++) T[row][j] /= p
    for (let i = 0; i <= m; i++) {
      if (i === row) continue
      const f = T[i][col]
      if (Math.abs(f) <= EPS) continue
      for (let j = 0; j <= width; j++) T[i][j] -= f * T[row][j]
    }
    basis[row] = col
  }
  const x = Array(n).fill(0)
  for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = Math.max(0, T[i][width])
  // the dual: the objective row under each slack
  const y = Array.from({ length: m }, (_, i) => Math.max(0, T[m][n + i]))
  return { x, y, value: T[m][width] }
}
