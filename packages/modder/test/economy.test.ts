import { describe, expect, it } from 'vitest'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { RuleLibrary, buildRequest, buildSandbox, holeKey, scenarioEvent, type Ontology, type Patch, type Rule, type Scenario, type Tree } from '@openworld/engine'
import { economySteps, freeLunch, prices, ruleSteps, simplexMax, type Step } from '../src/economy.ts'
import { WorldLibrary } from '../src/library.ts'

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
