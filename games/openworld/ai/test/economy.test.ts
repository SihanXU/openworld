import { describe, expect, it } from 'vitest'
import { LOOSE, OntologyIndex, RuleLibrary, buildSandbox, performPlacement, buildRequest, holeKey, scenarioEvent, type Effect, type Rule, type Tree, type Ontology, type Patch, type Scenario } from '@openworld/engine'
import { BASE_RULES, BUILDINGS, HAVEN_UPGRADES, RECIPES, RECOVERY, STORY_RULES, TERRAINS, WILD_GROUNDS, buildOntology, decodeChunk, wildChunk } from '@openworld-game/content'
import { economySteps, freeLunch, prices, ruleSteps, simplexMax, WorldLibrary, type Step as LpStep } from '@openworld/ai'
import { buildFord } from '../../tools/src/demo/world.ts'
import { onto } from './fixtures.ts'

// The economy (world-model.md §6.4, §10.2, D23): what is built and broken back returns no more
// than went in; no two steps (a recipe, a break, a rule's conversion) make more of a thing than
// they took; and without the AI, everything the recipes and buildings ask for can be had from the
// world as it starts, and what it yields by itself.

const index = new OntologyIndex(onto)
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

/** The effects of a rule's tree, every branch. */
function effectsOf(t: Tree): Effect[] {
  if (typeof t === 'string') return []
  if ('if' in t) return [...effectsOf(t.then), ...effectsOf(t.else ?? 'inherit')]
  return 'do' in t ? t.do : []
}

/** A conversion: what goes in, what comes out (expected counts). */
interface Step {
  name: string
  takes: Map<string, number>
  gives: Map<string, number>
}

/** Every step the data and the base rules say: recipes, breaking down, items a rule turns into others. */
function steps(): Step[] {
  const out: Step[] = []
  for (const r of RECIPES) out.push({ name: `recipe ${r.id}`, takes: new Map(r.needs.map((n) => [n.type, n.count])), gives: new Map([[r.make.type, 1]]) })
  for (const id of Object.keys(onto.types)) {
    const r = index.resolve(id)
    if (typeof r.props.maxHp === 'number' && r.makeup?.length) out.push({ name: `break ${id}`, takes: new Map([[id, 1]]), gives: new Map(r.makeup.map((m) => [m.type, m.count * (m.chance ?? 1) * RECOVERY])) })
  }
  // an item a rule turns into another, and what it spawns beside it (a log split into planks)
  for (const rule of BASE_RULES as Rule[]) {
    const host = rule.host?.type
    if (!host?.startsWith('item/') || !onto.types[host]) continue
    const fx = effectsOf(rule.tree)
    const into = fx.find((e): e is Extract<Effect, { op: 'transform' }> => e.op === 'transform' && !e.into.startsWith('@'))
    if (!into) continue
    const gives = new Map([[into.into, 1]])
    for (const e of fx) if (e.op === 'spawn' && !e.type.startsWith('@') && typeof (e.count ?? 1) === 'number') gives.set(e.type, (gives.get(e.type) ?? 0) + Number(e.count ?? 1))
    out.push({ name: `rule ${rule.id}`, takes: new Map([[host, 1]]), gives })
  }
  return out
}

describe('the economy (world-model.md §10.2)', () => {
  it('no step and no two steps in a row make more of a thing than they took', () => {
    const all = steps()
    const gains: string[] = []
    for (const a of all) for (const [t, n] of a.gives) if (n > (a.takes.get(t) ?? 0) && a.takes.has(t)) gains.push(`${a.name}: ${t} ${a.takes.get(t)} → ${n}`)
    // A then B: what A gives, B takes; per unit of a thing A took, how much of it comes back
    for (const a of all)
      for (const b of all) {
        if (a === b) continue
        for (const [mid, made] of a.gives) {
          const need = b.takes.get(mid)
          if (!need) continue
          const runs = made / need
          for (const [t, took] of a.takes) {
            const back = (b.gives.get(t) ?? 0) * runs
            if (back > took + 1e-9) gains.push(`${a.name} then ${b.name}: ${t} ${took} → ${back}`)
          }
        }
      }
    expect(gains).toEqual([])
  })

  it('no mix of steps, of any length, makes more of anything than it takes (a linear programme)', () => {
    expect(freeLunch(economySteps(onto, [...lib().rules.values()], RECOVERY))).toBeUndefined()
  })

  it('and the proof of it: prices (each thing worth at least 1) under which no step gives more value than it takes', () => {
    const all = economySteps(onto, [...lib().rules.values()], RECOVERY)
    const p = prices(all)!
    expect(p).toBeDefined()
    for (const v of p.values()) expect(v).toBeGreaterThanOrEqual(1 - 1e-9)
    const value = (m: Map<string, number>) => [...m].reduce((a, [t, n]) => a + n * p.get(t)!, 0)
    const gaining = all.filter((s) => value(s.gives) > value(s.takes) + 1e-7).map((s) => s.name)
    expect(gaining).toEqual([])
    // (the base content's rolls are weighed in: the parts that break off only by chance)
    expect(all.length).toBeGreaterThan(20)
  })

  it('build and break back: each building, broken, returns no more of anything than went into it', () => {
    const over: string[] = []
    for (const b of BUILDINGS) {
      const consumed = b.needs.filter((n) => n.consume)
      const eng = buildSandbox(
        {
          terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
          entities: [
            { key: 'actor', type: 'actor/person/player', x: 2, y: 3, props: { atk: 6 } },
            ...b.needs.flatMap((n, i) => Array.from({ length: n.consume ? n.count : 1 }, (_, k) => ({ key: `need${i}.${k}`, type: n.match.type ?? Object.keys(onto.types).find((t) => (n.match.tags ?? []).every((tag) => index.resolve(t).tags.includes(tag)) && t.startsWith('item/'))!, x: 2, y: 3, inside: 'actor' }))),
          ],
          event: {},
        },
        onto,
        lib(),
      )
      eng.world.get('actor')!.facing = 'up'
      const res = performPlacement(eng, 'actor', b, { map: 'sandbox', x: 2, y: 2 })
      expect([b.id, res.ok]).toEqual([b.id, true])
      const made = eng.world.placedAt('sandbox', 2, 2).find((e) => e.type === b.result)
      expect([b.id, !!made]).toEqual([b.id, true])
      // broken by blows (fire would do as well): with what works best on what it is made of
      const tool = index.resolve(made!.type).props.material === 'stone' ? 'item/tool/pickaxe' : 'item/tool/smith_hammer'
      eng.author(() => eng.world.add({ id: 'breaker', type: tool, tags: ['material:iron'], place: { on: 'hand', holder: 'actor' } }))
      // (a tool knocks what can be carried loose whole: the thing itself comes back, packed, and nothing more)
      const standing = () => eng.world.get(made!.id)?.place.on === 'tile'
      for (let i = 0; i < 20 && standing(); i++) eng.act('use', 'actor', { e: made!.id }, { params: { attack: true } })
      expect([b.id, standing()]).toEqual([b.id, false])
      const back = new Map<string, number>()
      for (const e of eng.world.placedAt('sandbox', 2, 2)) if (e.type !== LOOSE) back.set(e.type, (back.get(e.type) ?? 0) + 1)
      for (const n of consumed) {
        const t = n.match.type!
        if ((back.get(t) ?? 0) > n.count) over.push(`${b.id}: ${t} ${n.count} in, ${back.get(t)} back`)
      }
      for (const [t] of back) if (!consumed.some((n) => n.match.type === t)) over.push(`${b.id}: ${t} back, never went in`)
    }
    expect(over).toEqual([])
  })

  it('reachability: without the AI, everything the recipes and buildings ask for can be had from the world as it starts', () => {
    const { index: world, chunks } = buildFord()
    const have = new Set<string>()
    const present = new Set<string>()
    for (const c of chunks.map(decodeChunk)) {
      for (const t of new Set(c.map.terrain)) present.add(`tile/${t}`)
      for (const e of c.entities) (e.type.startsWith('item/') ? have : present).add(e.type)
      for (const a of [...(c.map.appear ?? []), ...(onto.appear ?? [])]) for (const t of Object.keys(a.types)) (t.startsWith('item/') ? have : present).add(t)
    }
    for (const n of world.npcs) for (const it of (n as { _items?: { type: string }[] })._items ?? []) have.add(it.type)
    // what the Held Ground's plots become once the steward builds them (haven.ts, a story rule): the arcane workbench among them
    for (const u of HAVEN_UPGRADES) if (u.becomes) present.add(u.becomes)
    const stations = new Set([...present].flatMap((t) => index.resolve(t).tags.filter((x) => x.startsWith('station:')).map((x) => x.slice(8))))
    stations.add('hands')
    // what breaks gives its makeup; what a rule on a present thing spawns, it gives
    // (a spawn or a transform naming the host's own prop — a crop's yieldType, a seed's cropType — is read from the type)
    const named = (type: string, ref: string): string[] => {
      if (!ref.startsWith('@prop:')) return [ref]
      const v = index.resolve(type).props[ref.slice(6).replace(/^host\./, '')]
      return typeof v === 'string' ? [v] : []
    }
    const spawnsOf = (type: string) =>
      (BASE_RULES as Rule[]).filter((r) => r.host && (!r.host.type || type === r.host.type || type.startsWith(r.host.type + '/')) && (r.host.tags ?? []).every((t) => index.resolve(type).tags.includes(t))).flatMap((r) =>
        effectsOf(r.tree).flatMap((e) => (e.op === 'spawn' ? named(type, e.type) : e.op === 'transform' ? named(type, e.into) : [])),
      )
    for (let round = 0; round < 8; round++) {
      for (const t of [...present, ...have]) {
        for (const m of index.resolve(t).makeup ?? []) if (typeof index.resolve(t).props.maxHp === 'number') have.add(m.type)
        for (const s of spawnsOf(t)) (s.startsWith('item/') ? have : present).add(s)
        // what a present thing's stage yields as it turns (a hen lays), and what it turns into (a sprout grows)
        for (const y of index.resolve(t).stage?.yields ?? []) have.add(y.type)
        const into = index.resolve(t).stage?.into
        if (into) (into.startsWith('item/') ? have : present).add(into)
      }
      for (const r of RECIPES) if (stations.has(r.station ?? 'hands') && r.needs.every((n) => have.has(n.type))) have.add(r.make.type)
    }
    const missing: string[] = []
    for (const r of RECIPES) {
      if (!stations.has(r.station ?? 'hands')) missing.push(`${r.id}: no ${r.station} in the world`)
      for (const n of r.needs) if (!have.has(n.type)) missing.push(`${r.id}: ${n.type}`)
    }
    for (const b of BUILDINGS)
      for (const n of b.needs) {
        const ok = n.match.type ? have.has(n.match.type) : [...have].some((t) => (n.match.tags ?? []).every((tag) => index.resolve(t).tags.includes(tag)))
        if (!ok) missing.push(`${b.id}: ${JSON.stringify(n.match)}`)
      }
    expect(missing).toEqual([])
    expect(TERRAINS.length).toBeGreaterThan(0)
  })

  it('reachability with renewables (world-model.md §10.2, W7): everything the recipes and buildings ask for comes back without end — from what appears by itself, from the wilderness that is made as one goes, or from a stage that returns (a stump grows back into a tree, a seed into a plant that gives seed, a hen lays)', () => {
    const { chunks } = buildFord()
    // what a type leads to: what it becomes or leaves (a rule on it, its stage), what breaking it gives, what it makes (a recipe)
    const prop = (type: string, ref: string) => {
      const key = ref.slice(6).replace(/^host\./, '')
      const v = index.resolve(type).props[key]
      return typeof v === 'string' ? v : undefined
    }
    const named = (type: string, t: string) => (t.startsWith('@prop:') ? prop(type, t) : t)
    const edges = new Map<string, Set<string>>()
    const stageEdges: [string, string][] = []
    const link = (a: string, b: string | undefined) => {
      if (!b || !onto.types[b]) return
      if (!edges.has(a)) edges.set(a, new Set())
      edges.get(a)!.add(b)
    }
    const types = Object.keys(onto.types)
    for (const t of types) {
      const r = index.resolve(t)
      if (typeof r.props.maxHp === 'number') for (const m of r.makeup ?? []) link(t, m.type)
      for (const rule of BASE_RULES as Rule[]) {
        const h = rule.host
        if (!h || (h.type && t !== h.type && !t.startsWith(h.type + '/')) || !(h.tags ?? []).every((x) => r.tags.includes(x))) continue
        for (const e of effectsOf(rule.tree)) if (e.op === 'spawn') link(t, named(t, e.type)); else if (e.op === 'transform') link(t, named(t, e.into))
      }
      const st = r.stage
      if (st) {
        // a stage with nothing next returns to itself: what it leaves comes again and again
        const next = st.into ?? t
        link(t, next)
        stageEdges.push([t, next])
        for (const y of st.yields ?? []) (link(t, y.type), stageEdges.push([t, y.type]))
      }
    }
    for (const r of RECIPES) for (const n of r.needs) link(n.type, r.make.type)
    const reach = (from: string): Set<string> => {
      const seen = new Set([from])
      const todo = [from]
      while (todo.length) for (const b of edges.get(todo.pop()!) ?? []) if (!seen.has(b)) (seen.add(b), todo.push(b))
      return seen
    }
    // the sources without end: what appears by itself (each map's and the world's), the wilderness's things and
    // grounds (made anew wherever one goes), and every stage on a cycle (only time makes more: a stage edge on it)
    const sources = new Set<string>()
    for (const c of chunks.map(decodeChunk)) for (const a of c.map.appear ?? []) for (const t of Object.keys(a.types)) sources.add(t)
    for (const a of onto.appear ?? []) for (const t of Object.keys(a.types)) sources.add(t)
    for (const g of WILD_GROUNDS)
      for (let i = 0; i < 6; i++) {
        const c = wildChunk(7 + i, i, 2 * i, g, undefined)
        for (const t of new Set(c.map.terrain)) sources.add(`tile/${t}`)
        for (const e of c.entities) sources.add(e.type)
        for (const a of c.map.appear ?? []) for (const t of Object.keys(a.types)) sources.add(t)
      }
    const cycles: string[] = []
    for (const [a, b] of stageEdges) if (reach(b).has(a)) (sources.add(a), cycles.push(`${a} → ${b}`))
    // a stump grows back into the tree it was felled from; a seed grows into a plant that gives seed; a hen lays
    expect(cycles).toEqual(expect.arrayContaining(['tile/stump → tile/tree', 'actor/creature/animal/chicken → actor/creature/animal/chicken', 'fixture/crop/wheat/young → fixture/crop/wheat/ripe']))
    const renewable = new Set<string>()
    for (const s of sources) for (const t of reach(s)) renewable.add(t)
    const finite: string[] = []
    for (const r of RECIPES) for (const n of r.needs) if (!renewable.has(n.type)) finite.push(`${r.id}: ${n.type}`)
    for (const b of BUILDINGS)
      for (const n of b.needs) {
        const ok = n.match.type ? renewable.has(n.match.type) : [...renewable].some((t) => (n.match.tags ?? []).every((tag) => index.resolve(t).tags.includes(tag)))
        if (!ok) finite.push(`${b.id}: ${JSON.stringify(n.match)}`)
      }
    expect([...new Set(finite)]).toEqual([])
  })
})

// The economy check's linear programme (economy.ts, world-model.md §8): the simplex itself, checked
// against duality and against Bellman-Ford on arbitrage; and how chance is counted (by expectation).

/** A small deterministic generator (mulberry32), so every run sees the same instances. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const S = (name: string, takes: [string, number][], gives: [string, number][]): LpStep => ({ name, takes: new Map(takes), gives: new Map(gives) })
const close = (a: number, b: number, tol = 1e-7) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))

describe('the simplex', () => {
  it('solves the textbook programme, with its shadow prices', () => {
    // max 3x + 5y; x <= 4, 2y <= 12, 3x + 2y <= 18 (optimum (2, 6), 36; duals 0, 3/2, 1)
    const s = simplexMax([[1, 0], [0, 2], [3, 2]], [4, 12, 18], [3, 5])
    expect(s.x.map((v) => +v.toFixed(9))).toEqual([2, 6])
    expect(s.value).toBeCloseTo(36, 9)
    expect(s.y.map((v) => +v.toFixed(9))).toEqual([0, 1.5, 1])
  })

  it('does not cycle on a degenerate vertex (Chvátal\'s example, where the largest coefficient rule cycles)', () => {
    const s = simplexMax(
      [
        [0.5, -5.5, -2.5, 9],
        [0.5, -1.5, -0.5, 1],
        [1, 0, 0, 0],
      ],
      [0, 0, 1],
      [10, -57, -9, -24],
    )
    expect(s.value).toBeCloseTo(1, 9)
    expect(s.x.map((v) => +v.toFixed(9))).toEqual([1, 0, 1, 0])
  })

  it('says when a programme is unbounded, and refuses a start that is not a vertex', () => {
    expect(() => simplexMax([[1, -1]], [1], [1, 1])).toThrow(/unbounded/)
    expect(() => simplexMax([[1]], [-1], [1])).toThrow(/b must be/)
    expect(() => simplexMax([], [], [1])).toThrow(/unbounded/)
    expect(simplexMax([[]], [1], [])).toEqual({ x: [], y: [0], value: 0 })
  })

  it('keeps the solution and certificate when rows, columns and the objective are scaled', () => {
    for (const scale of [1e-12, 1e-10, 1, 1e10, 1e12]) {
      const s = simplexMax([[scale]], [scale], [1])
      expect(s.x[0]).toBeCloseTo(1, 9)
      expect(s.value).toBeCloseTo(1, 9)
      expect(s.y[0] * scale).toBeCloseTo(1, 9)
      const column = simplexMax([[scale]], [1], [scale])
      expect(column.x[0] * scale).toBeCloseTo(1, 9)
      expect(column.value).toBeCloseTo(1, 9)
      const objective = simplexMax([[1]], [1], [scale])
      expect(objective.x[0]).toBeCloseTo(1, 9)
      expect(objective.value / scale).toBeCloseTo(1, 9)
    }
    const rows = [1e-12, 1e10, 1e-6], columns = [1e-10, 1e10]
    const A = [[1, 0], [0, 2], [3, 2]].map((r, i) => r.map((v, j) => v * rows[i] * columns[j]))
    const s = simplexMax(A, [4, 12, 18].map((v, i) => v * rows[i]), [3, 5].map((v, j) => v * columns[j]))
    expect(s.x.map((v, j) => v * columns[j])).toEqual(expect.arrayContaining([expect.closeTo(2, 9), expect.closeTo(6, 9)]))
    expect(s.value).toBeCloseTo(36, 9)
    expect(s.y.map((v, i) => v * rows[i])).toEqual([0, expect.closeTo(1.5, 9), expect.closeTo(1, 9)])
  })

  it('is optimal on 300 random programmes: x and y feasible, and c·x = b·y (strong duality)', () => {
    const r = rng(7)
    for (let k = 0; k < 300; k++) {
      const m = 1 + Math.floor(r() * 7)
      const n = 1 + Math.floor(r() * 7)
      // a box keeps it bounded; some b = 0 rows make degenerate vertices
      const A = [...Array.from({ length: m }, () => Array.from({ length: n }, () => Math.round((r() * 2 - 1) * 10) / 2)), ...Array.from({ length: n }, (_, j) => Array.from({ length: n }, (__, i) => (i === j ? 1 : 0)))]
      const b = [...Array.from({ length: m }, () => (r() < 0.3 ? 0 : Math.round(r() * 10))), ...Array.from({ length: n }, () => 1 + Math.floor(r() * 3))]
      const c = Array.from({ length: n }, () => Math.round((r() * 2 - 1) * 10))
      const { x, y, value } = simplexMax(A, b, c)
      A.forEach((row, i) => expect(row.reduce((a, v, j) => a + v * x[j], 0)).toBeLessThanOrEqual(b[i] + 1e-7))
      expect(x.every((v) => v >= 0) && y.every((v) => v >= 0)).toBe(true)
      for (let j = 0; j < n; j++) expect(A.reduce((a, row, i) => a + row[j] * y[i], 0)).toBeGreaterThanOrEqual(c[j] - 1e-7)
      const primal = c.reduce((a, v, j) => a + v * x[j], 0)
      expect(close(primal, value) && close(primal, b.reduce((a, v, i) => a + v * y[i], 0))).toBe(true)
    }
  })
})

describe('the free lunch', () => {
  it('keeps a tiny necessary step in the returned mix', () => {
    const steps = [S('bulk', [['A', 1e10]], [['B', 1e10]]), S('return', [['B', 1]], [['A', 2]])]
    const lunch = freeLunch(steps)!
    expect(lunch).toBeDefined()
    expect(lunch.uses.map((u) => u.step)).toContain('bulk')
    for (const type of ['A', 'B']) {
      const terms = lunch.uses.map((u) => {
        const s = steps.find((s) => s.name === u.step)!
        return ((s.gives.get(type) ?? 0) - (s.takes.get(type) ?? 0)) * u.times
      })
      expect(terms.reduce((a, n) => a + n, 0)).toBeGreaterThanOrEqual(-1e-9 * terms.reduce((a, n) => a + Math.abs(n), 0))
    }
  })

  it('never calls a positive input without a source a free lunch, however small', () => {
    for (const cost of [1e-12, 1e-10, 1, 1e10]) {
      const steps = [S('costly', [['A', cost]], [['B', 1]])]
      expect(freeLunch(steps), String(cost)).toBeUndefined()
      const p = prices(steps)!
      expect(p).toBeDefined()
      expect(cost * p.get('A')!).toBeGreaterThanOrEqual(p.get('B')! * (1 - 1e-9))
    }
    expect(freeLunch([S('tiny cycle', [['A', 1e-10]], [['B', 1]]), S('return', [['B', 1]], [['A', 2e-10]])])).toBeDefined()
  })
  it('agrees with Bellman-Ford on 300 random markets (one thing in, one out: a positive cycle is arbitrage)', () => {
    const r = rng(11)
    const RATES = [0.5, 0.8, 0.9, 1.1, 1.25, 2, 3]
    let found = 0
    for (let k = 0; k < 300; k++) {
      const n = 2 + Math.floor(r() * 4)
      const steps: LpStep[] = []
      const edges: [number, number, number][] = []
      for (let a = 0; a < n; a++)
        for (let b = 0; b < n; b++)
          if (a !== b && r() < 0.45) {
            const rate = RATES[Math.floor(r() * RATES.length)]
            steps.push(S(`${a}>${b}`, [[`T${a}`, 1]], [[`T${b}`, rate]]))
            edges.push([a, b, -Math.log(rate)])
          }
      // Bellman-Ford from a virtual source: a further relaxation after n rounds is a negative cycle
      const d = Array(n).fill(0)
      for (let i = 0; i < n; i++) for (const [a, b, w] of edges) if (d[a] + w < d[b] - 1e-12) d[b] = d[a] + w
      const arbitrage = edges.some(([a, b, w]) => d[a] + w < d[b] - 1e-9)
      const lunch = freeLunch(steps)
      expect([k, !!lunch]).toEqual([k, arbitrage])
      if (lunch) found++
      // no lunch: prices prove it; a lunch: none exist
      const p = prices(steps)
      expect([k, !!p]).toEqual([k, !arbitrage])
    }
    // (the instances are not all one way)
    expect(found).toBeGreaterThan(30)
    expect(found).toBeLessThan(270)
  })

  it('finds what takes several things and gives several, which no single exchange shows', () => {
    // 2 wood + 1 stone → 1 axe; an axe broken → 1 wood + 1 stone + 1 handle; 1 handle → 1 wood
    const steps = [S('craft', [['wood', 2], ['stone', 1]], [['axe', 1]]), S('break', [['axe', 1]], [['wood', 1], ['stone', 1], ['handle', 1]]), S('split', [['handle', 1]], [['wood', 1]])]
    expect(freeLunch(steps)).toBeUndefined()
    // a handle that splits into two pieces of wood: wood from nothing
    const greedy = [...steps.slice(0, 2), S('split', [['handle', 1]], [['wood', 2]])]
    expect(freeLunch(greedy)?.makes).toEqual([{ type: 'wood', n: 1 }])
  })

  it('prices: every thing worth at least 1, and no step gives more value than it takes', () => {
    const steps = [S('a', [['A', 2]], [['B', 3]]), S('b', [['B', 3]], [['C', 1]]), S('c', [['C', 1]], [['A', 1.5]])]
    const p = prices(steps)!
    expect(p).toBeDefined()
    for (const v of p.values()) expect(v).toBeGreaterThanOrEqual(1 - 1e-9)
    const value = (m: Map<string, number>) => [...m].reduce((a, [t, n]) => a + n * p.get(t)!, 0)
    for (const s of steps) expect(value(s.gives)).toBeLessThanOrEqual(value(s.takes) + 1e-9)
  })
})

describe('conversions checked when a patch is validated', () => {
  const onto = buildOntology()
  const base = [...BASE_RULES, ...STORY_RULES]
  const FEATHER = 'item/material/feather'
  const STONE = 'item/material/stone'
  const POT = 'fixture/container/pot'
  const scene: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'feather', type: FEATHER, x: 2, y: 2, heldBy: 'actor' },
      { key: 'pot', type: POT, x: 2, y: 1 },
    ],
    event: { kind: 'act/use', actor: 'actor', host: 'feather', instrument: 'feather', target: 'pot' },
  }
  const request = (known = base) => {
    const eng = buildSandbox(scene, onto, new RuleLibrary(known))
    const ev = scenarioEvent(scene, eng)
    return buildRequest(eng, ev, eng.resolveEvent(ev), 'test')
  }
  /** The hole the scene's event falls into: a learned rule names it (design.md §5.16). */
  const USE_HOLE = (({ hole }) => holeKey(hole.rule, hole.path))(request())
  /** The base hole a rule of another kind fills (its own tree at that key: nothing there yet). */
  /** A base rule's first open leaf, as a hole key (the path of branches `walk` would record to it). */
  const openLeafOf = (id: string): string => {
    const base = [...BASE_RULES, ...STORY_RULES].find((r) => r.id === id)!
    const find = (t: Tree, path: string[]): string[] | undefined => {
      if (typeof t === 'string') return undefined
      if ('undefined' in t) return path
      if (!('if' in t)) return undefined
      return find(t.then, [...path, JSON.stringify(t.if)]) ?? find(t.else ?? 'inherit', [...path, '!' + JSON.stringify(t.if)])
    }
    return holeKey(id, find(base.tree, [])!)
  }
  const HOLES: Record<string, string> = { 'act/use': USE_HOLE, 'impulse/coat': openLeafOf('core/coat'), 'threshold/cross': openLeafOf('core/break') }
  const OPEN: Tree = { undefined: true }
  const rule = (id: string, tree: Tree, host: Rule['host'] = { type: FEATHER }, on = 'act/use'): Rule => ({ id: `test/${id}`, host, on, hole: HOLES[on], tree, source: { origin: 'patch' } })
  const patchOf = (...rules: Rule[]): Patch => ({ artifacts: rules.map((rule) => ({ kind: 'rule', rule })) })
  const sender = rule('send', { if: { is: { role: 'target', sel: { type: POT } } }, then: { do: [{ op: 'emit', impulse: 'coat', to: 'target', params: { substance: 'fibre' } }, { op: 'destroy' }] }, else: OPEN })
  const receiver = (count: number) => rule('receive', { if: { param: { key: 'substance', cmp: 'fibre' } }, then: { do: [{ op: 'spawn', type: FEATHER, at: 'host', count }] }, else: OPEN }, { type: POT }, 'impulse/coat')

  it('reports only what a patch adds that cannot be modelled, not the base library\'s gaps', () => {
    // a fair conversion: a feather used on the pot leaves a stone in the bag
    const fair = rule('fair', { if: { is: { role: 'target', sel: { type: POT } } }, then: { do: [{ op: 'destroy' }, { op: 'spawn', type: STONE, at: 'actor', into: 'contents' }] }, else: OPEN })
    const result = new WorldLibrary(onto, base).validate(patchOf(fair), request())
    expect(result.ok).toBe(true)
    expect(result.warnings.filter((w) => w.startsWith('economy:'))).toEqual([])
  })

  it('composes a used-up item with the patched or defined receiver of its emit', () => {
    for (const defined of [false, true]) {
      const known = defined ? [...base, { ...receiver(2), source: { origin: 'base' as const } }] : base
      const patch = defined ? patchOf(sender) : patchOf(sender, receiver(2))
      const result = new WorldLibrary(onto, known).validate(patch, request(known))
      expect(result.ok, String(defined)).toBe(false)
      expect(result.errors.join()).toMatch(/economy.*test\/send/)
    }
    expect(new WorldLibrary(onto, base).validate(patchOf(sender, receiver(1)), request()).ok).toBe(true)
  })

  it('rechecks an existing sender when a new receiver changes its conversion', () => {
    const library = new WorldLibrary(onto, base)
    expect(library.commit(patchOf(sender), request()).ok).toBe(true)
    const result = library.validate(patchOf(receiver(2)))
    expect(result.ok).toBe(false)
    expect(result.errors.join()).toMatch(/economy/)
  })

  it('follows a second emit and weighs its chance without duplicating the input', () => {
    const send = { ...sender, tree: { if: { all: [{ is: { role: 'target', sel: { type: POT } } }, { is: { role: 'actor', sel: { type: 'actor' } } }] }, then: { do: [{ op: 'emit', impulse: 'coat', to: 'target', params: { substance: 'fibre' } }, { op: 'destroy' }] }, else: OPEN } } as Rule
    for (const chance of [0.5, 1]) {
      const relay = rule('relay', { if: { param: { key: 'substance', cmp: 'fibre' } }, then: { do: [{ op: 'emit', impulse: 'coat', to: 'actor', params: { substance: 'fibre' }, chance }] }, else: OPEN }, { type: POT }, 'impulse/coat')
      const last = { ...receiver(2), id: 'test/last', host: { type: 'actor' } }
      const result = new WorldLibrary(onto, base).validate(patchOf(send, relay, last), request())
      expect(result.ok, String(chance)).toBe(chance === 0.5)
      if (chance === 1) expect(result.errors.join()).toMatch(/economy.*test\/last/)
    }
  })

  it('expands tag and parent-class hosts to the types that can be converted', () => {
    const forward = rule('forward', { if: { is: { role: 'target', sel: { type: POT } } }, then: { do: [{ op: 'transform', into: 'item/misc/doll' }] }, else: OPEN })
    const back: Tree = { if: { is: { role: 'target', sel: { type: 'actor' } } }, then: { do: [{ op: 'transform', into: FEATHER }, { op: 'spawn', type: STONE, at: 'host' }] }, else: OPEN }
    // the extractor models a base rule of a class (a tag, a parent type) over every type it covers
    for (const host of [{ tags: ['toy'] }, { type: 'item/misc', tags: ['toy'] }]) expect(ruleSteps(rule('reverse', back, host), onto).some((s) => s.takes.has('item/misc/doll'))).toBe(true)
    // a learned rule is one type's: the doll's own, and the round trip still shows
    const reverse = rule('reverse', back, { type: 'item/misc/doll' })
    const result = new WorldLibrary(onto, base).validate(patchOf(forward, reverse), request())
    expect(result.ok).toBe(false)
    expect(result.errors.join()).toMatch(/economy.*test\/reverse/)
    expect(ruleSteps(reverse, onto).some((s) => s.takes.has('item/misc/doll'))).toBe(true)
  })

  it('counts a new fixture\'s own broken rule and a non-item host that is used up', () => {
    for (const count of [2, 1]) {
      const type = { id: 'fixture/container/feather_press', name: { en: 'Feather Press', zh: '羽毛压模' }, props: { material: 'cloth', maxHp: 1, hp: 1 } }
      const make = rule('make-press', { do: [{ op: 'spawn', type: type.id, at: 'target' }, { op: 'destroy' }] })
      const unmake = rule('break-press', { if: { param: { key: 'name', cmp: 'broken' } }, then: { do: [{ op: 'spawn', type: FEATHER, at: 'host', count }, { op: 'destroy' }] }, else: OPEN }, { type: type.id }, 'threshold/cross')
      const patch = patchOf(make, unmake)
      patch.artifacts.unshift({ kind: 'type', type })
      const result = new WorldLibrary(onto, base).validate(patch, request())
      expect(result.ok, String(count)).toBe(count === 1)
      if (count === 2) expect(result.errors.join()).toMatch(/economy.*press/)
      const steps = economySteps({ ...onto, types: { ...onto.types, [type.id]: type } }, [...base, make, unmake], 0.5)
      expect(steps.some((s) => s.takes.get(type.id) === 1 && s.gives.get(FEATHER) === count)).toBe(true)
      const used = { ...unmake, on: 'act/use', tree: { do: [{ op: 'transform' as const, into: FEATHER }] } }
      expect(ruleSteps(used, { ...onto, types: { ...onto.types, [type.id]: type } })[0]?.takes.get(type.id)).toBe(1)
    }
  })

  it('counts the outputs when the broken fixture remains as a spent host', () => {
    const type = { id: 'fixture/container/feather_press', name: { en: 'Feather Press', zh: '羽毛压模' }, props: { material: 'cloth', maxHp: 1, hp: 1 } }
    const make = rule('make-press', { do: [{ op: 'spawn', type: type.id, at: 'target' }, { op: 'destroy' }] })
    const broken = rule('spent-press', { if: { param: { key: 'name', cmp: 'broken' } }, then: { do: [{ op: 'spawn', type: FEATHER, at: 'host', count: 2 }] }, else: OPEN }, { type: type.id }, 'threshold/cross')
    const patch = patchOf(make, broken)
    patch.artifacts.unshift({ kind: 'type', type })
    const result = new WorldLibrary(onto, base).validate(patch, request())
    expect(result.ok).toBe(false)
    expect(result.errors.join()).toMatch(/economy.*spent-press/)
  })

  it('reports an output path whose emitted receivers cannot be counted', () => {
    const spread = rule('spread', { do: [{ op: 'emit', impulse: 'coat', to: { area: { radius: 1 } }, chance: 0.5, params: { substance: 'fibre' } }, { op: 'destroy' }] })
    const result = new WorldLibrary(onto, base).validate(patchOf(spread, receiver(1)), request())
    expect(result.warnings.join()).toMatch(/economy.*test\/spread.*not modelled/)
  })
})

describe('chance, counted by expectation', () => {
  const onto: Ontology = buildOntology()
  const STONE = 'item/material/stone'
  const STICK = 'item/material/stick'
  /** 2 stones make a stick (a step of the world's). */
  const craft = S('craft', [[STONE, 2]], [[STICK, 1]])
  /** A rule on a stick: struck, it breaks; by chance p it leaves `n` stones. */
  const lottery = (p: number, n: number, tree?: Tree): Rule => ({
    id: `test/lottery${p}`,
    host: { type: STICK },
    on: 'act/use',
    tree: tree ?? { if: { chance: p }, then: { do: [{ op: 'destroy' }, { op: 'spawn', type: STONE, at: 'host', count: n }] }, else: { do: [{ op: 'destroy' }] } },
    source: { origin: 'patch' },
  })

  it('a lottery that loses on average is no free lunch (3 stones three times in ten: 0.9 a stick)', () => {
    const steps = ruleSteps(lottery(0.3, 3), onto)
    expect(steps).toHaveLength(1)
    expect(steps[0].takes.get(STICK)).toBe(1)
    expect(steps[0].gives.get(STONE)).toBeCloseTo(0.9, 12)
    expect(freeLunch([craft, ...steps])).toBeUndefined()
  })

  it('one that wins on average is (eight times in ten: 2.4 stones a stick, from 2)', () => {
    const lunch = freeLunch([craft, ...ruleSteps(lottery(0.8, 3), onto)])
    expect(lunch?.makes.map((m) => m.type)).toEqual([STONE])
  })

  it('a choice the state makes is the player\'s; a roll beside it is weighed in', () => {
    // with a stone in hand, by chance one in two, 5 stones; without, nothing but the break
    const tree: Tree = {
      if: { all: [{ is: { role: 'item', sel: { type: STONE } } }, { chance: 0.5 }] },
      then: { do: [{ op: 'destroy' }, { op: 'spawn', type: STONE, at: 'host', count: 5 }] },
      else: { do: [{ op: 'destroy' }, { op: 'spawn', type: STONE, at: 'host', count: 1 }] },
    }
    const steps = ruleSteps(lottery(0.5, 0, tree), onto)
    // the mix (3 stones on average) and the else alone (the stone not in hand: 1)
    expect(steps.map((s) => s.gives.get(STONE)).sort()).toEqual([1, 3])
    expect(freeLunch([craft, ...steps])).toBeDefined()
  })

  it('nested rolls multiply, and an item taken in by chance is taken by its odds', () => {
    const tree: Tree = {
      if: { chance: 0.5 },
      then: { if: { chance: 0.5 }, then: { do: [{ op: 'destroy' }, { op: 'spawn', type: STONE, at: 'host', count: 4 }] }, else: { do: [{ op: 'destroy' }] } },
      else: { do: [{ op: 'destroy' }] },
    }
    expect(ruleSteps(lottery(0, 0, tree), onto)[0].gives.get(STONE)).toBeCloseTo(1, 12)
    const taker: Rule = {
      id: 'test/taker',
      host: { type: 'fixture/container/pot' },
      on: 'act/use',
      tree: { if: { is: { role: 'item', sel: { type: STICK } } }, then: { do: [{ op: 'emit', impulse: 'taken', to: 'item', params: { into: 'contents' }, chance: 0.25 }, { op: 'spawn', type: STONE, at: 'host', count: 1 }] }, else: 'inherit' },
      source: { origin: 'patch' },
    }
    const [s] = ruleSteps(taker, onto)
    expect([s.takes.get(STICK), s.gives.get(STONE)]).toEqual([0.25, 1])
  })

  it('a grind that gives the thing itself back one time in five: the LP sums the rounds (1 / (1 - 0.2) = 1.25)', () => {
    // a stick ground: a stone, and by chance p the stick again (ground again, and so on)
    const grind = (p: number) =>
      ruleSteps(
        lottery(p, 0, {
          if: { chance: p },
          then: { do: [{ op: 'destroy' }, { op: 'spawn', type: STONE, at: 'host', count: 1 }, { op: 'spawn', type: STICK, at: 'host', count: 1 }] },
          else: { do: [{ op: 'destroy' }, { op: 'spawn', type: STONE, at: 'host', count: 1 }] },
        }),
        onto,
      )
    const [g] = grind(0.2)
    expect([g.takes.get(STICK), g.gives.get(STONE)]).toEqual([1, 1])
    expect(g.gives.get(STICK)).toBeCloseTo(0.2, 12)
    // 5 stones make 4 sticks; a stick ground to the end gives 1.25 stones: 4 sticks, 5 stones, even
    const make = S('make', [[STONE, 5]], [[STICK, 4]])
    expect(freeLunch([make, ...grind(0.2)])).toBeUndefined()
    // one time in four: 4 sticks give 5 1/3 stones, a third of a stone from nothing
    expect(freeLunch([make, ...grind(0.25)])?.makes.map((m) => m.type)).toEqual([STONE])
    // every time: the stick never goes, a stone from nothing at once
    expect(freeLunch(grind(1))?.makes).toEqual([{ type: STONE, n: 1 }])
  })

  it('a thing that breaks into itself by chance, and a part named twice, both count', () => {
    const GEODE = 'item/material/geode_test'
    const geode = { id: GEODE, name: { en: 'Geode', zh: '晶洞' }, tags: [], props: { maxHp: 4, material: 'stone' }, makeup: [{ type: STONE, count: 1 }, { type: STONE, count: 1, chance: 0.5 }, { type: GEODE, count: 1, chance: 0.2 }] }
    const steps = economySteps({ ...onto, types: { ...onto.types, [GEODE]: geode } } as Ontology, [], 1)
    const b = steps.find((s) => s.name === `break ${GEODE}`)!
    expect(b.gives.get(STONE)).toBeCloseTo(1.5, 12)
    expect(b.gives.get(GEODE)).toBeCloseTo(0.2, 12)
  })

  it('a count read from the kind of thing the host is counts', () => {
    const withYield: Ontology = { ...onto, types: { ...onto.types, [STICK]: { ...onto.types[STICK], props: { ...onto.types[STICK].props, yield: 3 } } } }
    const rule = lottery(1, 0, { do: [{ op: 'destroy' }, { op: 'spawn', type: STONE, at: 'host', count: { prop: 'yield', of: 'host', add: 1 } }] })
    expect(ruleSteps(rule, withYield)[0].gives.get(STONE)).toBe(4)
    expect(freeLunch([craft, ...ruleSteps(rule, withYield)])).toBeDefined()
  })
})

describe('a recipe that makes several at once (yields)', () => {
  const onto = buildOntology()
  const base = [...BASE_RULES, ...STORY_RULES]
  const STONE = 'item/material/stone'
  const chip = (yields: number) => ({ id: 'item/material/chip', name: { en: 'Chip', zh: '石片' }, props: { material: 'stone', maxHp: 1, hp: 1 }, makeup: [{ type: STONE, count: 4 }], station: 'hands', yields })
  const back: Rule = { id: 'test/chip-back', host: { type: 'item/material/chip' }, on: 'act/use', tree: { do: [{ op: 'transform', into: STONE }] }, source: { origin: 'patch' } }

  it('makes as many as it yields: four stones into eight chips, each turned back into a stone, doubles the stone', () => {
    const t = chip(8)
    const steps = economySteps({ ...onto, types: { ...onto.types, [t.id]: t } }, [...base, back], 0.5)
    expect(steps.find((s) => s.name === `recipe ${t.id}`)?.gives.get(t.id)).toBe(8)
    expect(freeLunch(steps)?.makes.length).toBeGreaterThan(0)
  })

  it('one of them breaks into its share of the makeup, so a fair way to one is no free lunch', () => {
    const t = chip(4)
    const steps = economySteps({ ...onto, types: { ...onto.types, [t.id]: t } }, base, 0.5)
    expect(steps.find((s) => s.takes.get(t.id) === 1 && s.gives.has(STONE))?.gives.get(STONE)).toBeCloseTo((4 * 0.5) / 4, 9)
    const toChip: Rule = { id: 'test/stone-chip', host: { type: STONE }, on: 'act/use', tree: { do: [{ op: 'transform', into: t.id }] }, source: { origin: 'patch' } }
    expect(freeLunch(economySteps({ ...onto, types: { ...onto.types, [t.id]: t } }, [...base, toChip], 0.5))).toBeUndefined()
  })
})
