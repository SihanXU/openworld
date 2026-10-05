// The economy check (world-model.md §8.4, §10.2): no combination of conversions makes more of
// anything than it takes. Every conversion the world knows is a step (what it takes, what it
// gives): a recipe, a thing broken down into its makeup, a rule that turns one item into others.
// A "free lunch" is a mix of steps, each run some number of times, after which no thing is fewer
// and some thing is more. That is a linear programme: with x_j in [0, 1] the times step j runs,
// maximise the total net gain subject to every thing's net change being >= 0. x = 0 is feasible,
// so the simplex starts there with no first phase; a positive optimum is a free lunch, and the
// steps with x_j > 0 are the cycle to show. (With one input and one output per step this is
// currency arbitrage, a positive cycle Bellman-Ford finds; several in and out need the LP.)

import { OntologyIndex, deriveRecipes, type Effect, type Ontology, type Rule, type Selector, type Tree } from '@lsw/engine'

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
  for (const r of deriveRecipes(index)) out.push({ name: `recipe ${r.id}`, takes: new Map(r.needs.map((n) => [n.type, n.count])), gives: new Map([[r.make.type, 1]]) })
  for (const id of Object.keys(onto.types)) {
    const r = index.resolve(id)
    if (typeof r.props.maxHp === 'number' && r.makeup?.length) out.push({ name: `break ${id}`, takes: new Map([[id, 1]]), gives: new Map(r.makeup.map((m) => [m.type, m.count * (m.chance ?? 1) * recovery])) })
  }
  for (const rule of rules) out.push(...ruleSteps(rule, onto))
  return out
}

/**
 * A rule's conversions, one per leaf (branches are exclusive): an item host that is used up
 * (transformed or destroyed) is what the leaf takes; a thing put into the host (an `item` the
 * leaf takes into its contents) is taken too; what the leaf spawns, and what the host becomes,
 * is what it gives. A leaf that takes nothing is a faucet, the repeat check's to judge.
 */
export function ruleSteps(rule: Rule, onto: Ontology): Step[] {
  const host = rule.host?.type
  const out: Step[] = []
  const walk = (t: Tree, item: string | undefined, path: string) => {
    if (!t || t === 'inherit' || 'undefined' in t) return
    if ('if' in t) {
      const named = itemType(t.if) ?? item
      walk(t.then, named, `${path}.then`)
      walk(t.else ?? 'inherit', item, `${path}.else`)
      return
    }
    const fx: Effect[] = t.do
    const takes = new Map<string, number>()
    const gives = new Map<string, number>()
    const usedUp = fx.some((e) => e.op === 'destroy' || (e.op === 'transform' && !e.into.startsWith('@')))
    if (host && host.startsWith('item/') && host in onto.types && usedUp) takes.set(host, 1)
    if (item && fx.some((e) => e.op === 'emit' && e.impulse === 'taken' && e.to === 'item' && (e.params as { into?: unknown } | undefined)?.into === 'contents')) takes.set(item, (takes.get(item) ?? 0) + 1)
    for (const e of fx) {
      if (e.op === 'transform' && !e.into.startsWith('@') && host?.startsWith('item/')) gives.set(e.into, (gives.get(e.into) ?? 0) + 1)
      if (e.op === 'spawn' && !e.type.startsWith('@') && typeof (e.count ?? 1) === 'number') gives.set(e.type, (gives.get(e.type) ?? 0) + Number(e.count ?? 1))
    }
    if (takes.size && gives.size) out.push({ name: `rule ${rule.id}${path}`, takes, gives })
  }
  walk(rule.tree, undefined, '')
  return out
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

/** The best free lunch among these steps, or undefined when none makes more than it takes. */
export function freeLunch(steps: Step[]): FreeLunch | undefined {
  if (!steps.length) return undefined
  const items = [...new Set(steps.flatMap((s) => [...s.takes.keys(), ...s.gives.keys()]))]
  const net = (s: Step, t: string) => (s.gives.get(t) ?? 0) - (s.takes.get(t) ?? 0)
  // rows: one per thing (sum_j -net_ij x_j <= 0), one per step (x_j <= 1); objective: total net
  const A: number[][] = [...items.map((t) => steps.map((s) => -net(s, t))), ...steps.map((_, j) => steps.map((__, k) => (k === j ? 1 : 0)))]
  const b = [...items.map(() => 0), ...steps.map(() => 1)]
  const c = steps.map((s) => items.reduce((a, t) => a + net(s, t), 0))
  const x = simplexMax(A, b, c)
  const gain = c.reduce((a, cj, j) => a + cj * x[j], 0)
  if (gain <= 1e-7) return undefined
  const top = Math.max(...x)
  const uses = steps.map((s, j) => ({ step: s.name, times: x[j] / top })).filter((u) => u.times > 1e-6)
  const makes = items.map((t) => ({ type: t, n: steps.reduce((a, s, j) => a + net(s, t) * x[j], 0) / top })).filter((m) => m.n > 1e-6)
  return { gain, uses, makes }
}

/**
 * max c·x subject to A x <= b, x >= 0, with b >= 0 (so x = 0 is a vertex). Dense tableau,
 * Bland's rule (no cycling). Returns x.
 */
export function simplexMax(A: number[][], b: number[], c: number[]): number[] {
  const m = A.length
  const n = c.length
  // tableau: m rows of [A | I | b], the last row the objective [-c | 0 | 0]
  const T: number[][] = A.map((row, i) => [...row, ...Array.from({ length: m }, (_, k) => (k === i ? 1 : 0)), b[i]])
  T.push([...c.map((v) => -v), ...Array(m).fill(0), 0])
  const basis = Array.from({ length: m }, (_, i) => n + i)
  const width = n + m
  for (let iter = 0; iter < 50 * (m + n); iter++) {
    const z = T[m]
    let col = -1
    for (let j = 0; j < width; j++) if (z[j] < -EPS) ((col = j), (j = width)) // Bland: the first improving column
    if (col < 0) break
    let row = -1
    let best = Infinity
    for (let i = 0; i < m; i++) {
      const a = T[i][col]
      if (a <= EPS) continue
      const ratio = T[i][width] / a
      if (ratio < best - EPS || (Math.abs(ratio - best) <= EPS && basis[i] < basis[row])) ((best = ratio), (row = i))
    }
    if (row < 0) break // unbounded cannot happen with x <= 1; stop rather than loop
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
  for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = T[i][width]
  return x
}
