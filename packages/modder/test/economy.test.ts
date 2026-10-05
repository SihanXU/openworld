import { describe, expect, it } from 'vitest'
import { buildOntology } from '@lsw/content'
import type { Ontology, Rule, Tree } from '@lsw/engine'
import { economySteps, freeLunch, prices, ruleSteps, simplexMax, type Step } from '../src/economy.ts'

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

const S = (name: string, takes: [string, number][], gives: [string, number][]): Step => ({ name, takes: new Map(takes), gives: new Map(gives) })
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
  it('agrees with Bellman-Ford on 300 random markets (one thing in, one out: a positive cycle is arbitrage)', () => {
    const r = rng(11)
    const RATES = [0.5, 0.8, 0.9, 1.1, 1.25, 2, 3]
    let found = 0
    for (let k = 0; k < 300; k++) {
      const n = 2 + Math.floor(r() * 4)
      const steps: Step[] = []
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
