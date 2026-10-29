import { describe, expect, it } from 'vitest'
import { HARM, RuleLibrary, buildSandbox, type Engine, type ScenarioEntity } from '@openworld/engine'
import '@openworld/modules'
import { BASE_RULES, SOCIAL_COIN, STORY_RULES, buildOntology } from '../src/index.ts'

// What weighs on one and what puts it right, read from the game's own rules (engine wellbeing.ts, design.md §5.18):
// nothing in the engine names rain, fire or hunger.

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

function world(others: ScenarioEntity[], cells: NonNullable<Parameters<typeof buildSandbox>[0]['cells']> = []): Engine {
  const entities: ScenarioEntity[] = [{ key: 'actor', type: 'actor/person/player', x: 0, y: 0, props: {} }, ...others]
  return buildSandbox({ entities, event: {}, cells }, onto, lib())
}
const at = (x: number, y: number) => ({ map: 'sandbox', x, y })

describe('what a place does to one', () => {
  it('a burning cell sets one burning, which harms (a danger); a cell beside it, nothing', () => {
    const eng = world([{ key: 'nell', type: 'actor/person/villager', x: 4, y: 4 }], [{ x: 2, y: 1, statuses: ['burning'] }])
    const nell = eng.world.get('nell')!
    const fire = eng.wellbeing.placeAt(nell, at(2, 1))
    expect(fire.adds.has('burning')).toBe(true)
    expect(eng.wellbeing.placeWeight(nell, at(2, 1))).toBeGreaterThanOrEqual(HARM)
    expect(eng.wellbeing.placeAt(nell, at(4, 3)).adds.size).toBe(0)
  })

  it('rain wets one under the sky, not under a roof', () => {
    const eng = world([{ key: 'nell', type: 'actor/person/villager', x: 4, y: 4 }])
    eng.world.weather = [{ day: 1, weather: 'rain' }]
    const nell = eng.world.get('nell')!
    expect(eng.wellbeing.placeAt(nell, at(3, 3)).adds.has('wet')).toBe(true)
    eng.author(() => (eng.world.state.maps.sandbox.light = 'indoor'))
    expect(eng.wellbeing.placeAt(nell, at(3, 2)).adds.has('wet')).toBe(false)
  })
})

describe('what weighs on one', () => {
  it('burning harms (its pulse costs health): a danger; wet is minded, not harm; the weathered and those who endure it do not mind it', () => {
    const eng = world([
      { key: 'nell', type: 'actor/person/villager', x: 4, y: 4, statuses: ['burning', 'wet'] },
      { key: 'odo', type: 'actor/person/farmer', x: 3, y: 4, statuses: ['wet'] },
      { key: 'ivo', type: 'actor/person/villager', x: 2, y: 4, statuses: ['wet'], tags: ['endures:wet'] },
    ])
    const w = eng.world
    expect(eng.wellbeing.harms(w.get('nell')!, 'burning')).toBe(true)
    expect(eng.wellbeing.weight(w.get('nell')!, 'burning')).toBeGreaterThanOrEqual(HARM)
    expect(eng.wellbeing.weight(w.get('nell')!, 'wet')).toBe(1)
    expect(eng.wellbeing.weight(w.get('odo')!, 'wet')).toBe(0)
    expect(eng.wellbeing.weight(w.get('ivo')!, 'wet')).toBe(0)
    expect(eng.wellbeing.troubles(w.get('nell')!).map((t) => [t.status, t.danger])).toEqual([['burning', true], ['wet', false]])
  })
})

describe('what puts it right', () => {
  it('food cures hunger (it fills the bar the status is drawn under); a stone does not', () => {
    const eng = world([
      { key: 'nell', type: 'actor/person/villager', x: 4, y: 4, statuses: ['hungry'], props: { hunger: 4 } },
      { key: 'apple', type: 'item/food/apple', x: 4, y: 4, inside: 'nell' },
      { key: 'stone', type: 'item/material/stone', x: 4, y: 4, inside: 'nell' },
    ])
    const eat = (item: string) => eng.wellbeing.outcome(eng.actEvent('use', 'nell', { e: 'nell' }, { e: item }), 'nell')
    expect(eng.wellbeing.cures(eat('apple'), 'hungry')).toBe(true)
    expect(eng.wellbeing.cures(eat('stone'), 'hungry')).toBe(false)
  })

  it('a bucket of water puts out a fire; an empty bucket at the water becomes one', () => {
    const eng = world(
      [
        { key: 'nell', type: 'actor/person/villager', x: 2, y: 2 },
        { key: 'pail', type: 'item/vessel/bucket/empty', x: 2, y: 2, heldBy: 'nell' },
        { key: 'crate', type: 'fixture/container/crate', x: 3, y: 2, statuses: ['burning'] },
      ],
      [{ x: 1, y: 2, type: 'tile/water' }],
    )
    const w = eng.world
    const water = w.cellTop('sandbox', 1, 2)!
    const fill = eng.wellbeing.outcome(eng.actEvent('use', 'nell', { e: water.id }, { e: 'pail' }), 'pail')
    expect(fill.becomes).toBe('item/vessel/bucket/water')
    const douse = eng.wellbeing.outcome(eng.actEvent('use', 'nell', { e: 'crate' }, { e: 'pail' }), 'crate', undefined, 3, { id: 'pail', type: 'item/vessel/bucket/water' })
    expect(eng.wellbeing.cures(douse, 'burning')).toBe(true)
  })
})

describe('the goal: away, toward, an act', () => {
  /** A person of the world (a round of their own: `npc`), on a map of `rows`, the one at the keys out of the way. */
  function town(rows: string[][], people: (ScenarioEntity & { schedule?: [number, number, number, number][] })[], cells: NonNullable<Parameters<typeof buildSandbox>[0]['cells']> = []): Engine {
    const eng = buildSandbox({ terrain: rows, entities: [{ key: 'actor', type: 'actor/person/player', x: rows[0].length - 1, y: rows.length - 1 }, ...people], event: {}, cells }, onto, lib())
    eng.author(() => {
      for (const p of people) {
        const e = eng.world.get(p.key)!
        e.npc = { role: 'villager', schedule: (p.schedule ?? [[0, 24, p.x, p.y]]).map(([from, to, x, y]) => ({ from, to, map: 'sandbox', x, y, activity: 'stand' })) }
      }
    })
    return eng
  }
  const grass = (w: number, h: number) => Array.from({ length: h }, () => Array(w).fill('grass'))
  const run = (eng: Engine, n: number, until?: () => boolean) => {
    for (let i = 0; i < n; i++) {
      eng.tick()
      if (until?.()) return true
    }
    return false
  }
  const pos = (eng: Engine, id: string) => eng.world.get(id)!.place as { x: number; y: number }

  it('one on fire runs to the wet ground that puts it out (the rules say mud wets what stands on it, and wet clears burning)', () => {
    const rows = grass(7, 5)
    rows[2][5] = 'mud'
    const eng = town(rows, [{ key: 'nell', type: 'actor/person/villager', x: 1, y: 2 }])
    eng.author(() => eng.applyStatus({ e: 'nell' }, 'burning', 200))
    expect(run(eng, 200, () => !eng.world.hasStatus({ e: 'nell' }, 'burning'))).toBe(true)
    expect(pos(eng, 'nell')).toMatchObject({ x: 5, y: 2 })
  })

  it('one standing where it burns steps off it', () => {
    const eng = town(grass(7, 5), [{ key: 'nell', type: 'actor/person/villager', x: 3, y: 2 }], [{ x: 3, y: 2, statuses: ['burning'] }])
    expect(run(eng, 60, () => pos(eng, 'nell').x !== 3 || pos(eng, 'nell').y !== 2)).toBe(true)
  })

  it('in the rain one goes in under a roof, a farmer works on; the sheltered stay in until it stops, then their day takes them out', () => {
    const cover = [0, 1, 2].map((x) => ({ x, y: 0, z: 1, type: 'tile/floor_wood' }))
    const eng = town(grass(8, 5), [
      { key: 'nell', type: 'actor/person/villager', x: 6, y: 3 },
      { key: 'odo', type: 'actor/person/farmer', x: 5, y: 3 },
    ], cover)
    const w = eng.world
    expect(w.covered('sandbox', 1, 0)).toBe(true)
    w.weather = [{ day: w.calendar().day, weather: 'rain' }]
    expect(run(eng, 400, () => w.covered('sandbox', pos(eng, 'nell').x, pos(eng, 'nell').y))).toBe(true)
    expect(pos(eng, 'odo')).toMatchObject({ x: 5, y: 3 })
    run(eng, 200)
    expect(w.covered('sandbox', pos(eng, 'nell').x, pos(eng, 'nell').y)).toBe(true)
    w.weather = [{ day: w.calendar().day, weather: 'sun' }]
    expect(run(eng, 400, () => pos(eng, 'nell').x === 6 && pos(eng, 'nell').y === 3)).toBe(true)
  })

  it('the hungry eat what they carry', () => {
    const eng = town(grass(5, 5), [
      { key: 'nell', type: 'actor/person/villager', x: 2, y: 2, statuses: ['hungry'], props: { hunger: 4 } },
      { key: 'apple', type: 'item/food/apple', x: 2, y: 2, inside: 'nell' },
    ])
    expect(run(eng, 100, () => !eng.world.get('apple'))).toBe(true)
    expect(eng.world.num(eng.world.get('nell')!, 'hunger')).toBeGreaterThan(4)
  })
})

describe('what one cares for', () => {
  function town(rows: string[][], people: ScenarioEntity[], cells: NonNullable<Parameters<typeof buildSandbox>[0]['cells']> = []): Engine {
    const eng = buildSandbox({ terrain: rows, entities: [{ key: 'actor', type: 'actor/person/player', x: rows[0].length - 1, y: rows.length - 1 }, ...people], event: {}, cells }, onto, lib())
    eng.author(() => {
      for (const p of people) {
        const e = eng.world.get(p.key)!
        if (!e.type.startsWith('actor/person/')) continue
        e.npc = { role: 'villager', schedule: [{ from: 0, to: 24, map: 'sandbox', x: p.x, y: p.y, activity: 'stand' }] }
      }
    })
    return eng
  }
  const grass = (w: number, h: number) => Array.from({ length: h }, () => Array(w).fill('grass'))
  const run = (eng: Engine, n: number, until: () => boolean) => {
    for (let i = 0; i < n; i++) {
      eng.tick()
      if (until()) return true
    }
    return false
  }

  it("one's own crate on fire: an empty bucket filled at the water, and the fire put out; another's is not one's to see to", () => {
    const rows = grass(8, 5)
    rows[2][0] = 'water'
    const eng = town(rows, [
      { key: 'nell', type: 'actor/person/villager', x: 3, y: 2 },
      { key: 'pail', type: 'item/vessel/bucket/empty', x: 3, y: 2, inside: 'nell' },
      { key: 'crate', type: 'fixture/container/crate', x: 6, y: 2, statuses: ['burning'], props: { owner: 'nell', hp: 60, maxHp: 60 } },
    ])
    const w = eng.world
    expect(eng.wellbeing.troublesFor(w.get('nell')!).map((t) => [t.subject, t.status, t.danger])).toContainEqual(['crate', 'burning', true])
    // kept burning while she sees to it (a fire left alone burns out by itself)
    eng.author(() => eng.applyStatus({ e: 'crate' }, 'burning', 600))
    expect(run(eng, 500, () => !w.hasStatus({ e: 'crate' }, 'burning'))).toBe(true)
    expect(w.get('crate')).toBeDefined()

    const other = town(rows, [
      { key: 'nell', type: 'actor/person/villager', x: 3, y: 2 },
      { key: 'crate', type: 'fixture/container/crate', x: 6, y: 2, statuses: ['burning'], props: { owner: 'npc.someone' } },
    ])
    expect(other.wellbeing.troublesFor(other.world.get('nell')!).some((t) => t.subject === 'crate')).toBe(false)
  })
})

describe('the circle one keeps', () => {
  it('one\'s household and one\'s own things are cared for, a stranger and his things not', () => {
    const eng = world([
      { key: 'nell', type: 'actor/person/villager', x: 1, y: 1, props: { household: 'mill' } },
      { key: 'odo', type: 'actor/person/farmer', x: 2, y: 1, props: { household: 'mill' } },
      { key: 'ivo', type: 'actor/person/villager', x: 3, y: 1, props: { household: 'inn' } },
      { key: 'box', type: 'fixture/container/crate', x: 1, y: 3, props: { owner: 'household:mill' } },
      { key: 'his', type: 'fixture/container/crate', x: 2, y: 3, props: { owner: 'ivo' } },
    ])
    const w = eng.world
    const care = (o: string) => eng.wellbeing.careFor(w.get('nell')!, w.get(o)!)
    expect([care('odo'), care('ivo'), care('box') > 0, care('his')]).toEqual([0.8, 0, true, 0])
  })
})

describe("the society's way: what cures it, bought", () => {
  it('a hurt person with coin and nothing at hand buys a healing draught of a merchant and drinks it (the goal names no food)', () => {
    const coins = Array.from({ length: 40 }, (_, i): ScenarioEntity => ({ key: `c${i}`, type: SOCIAL_COIN, x: 1, y: 2, inside: 'nell' }))
    const eng = buildSandbox(
      {
        terrain: Array.from({ length: 5 }, () => Array(8).fill('grass')),
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 7, y: 4 },
          { key: 'nell', type: 'actor/person/villager', x: 1, y: 2, props: { hp: 6 } },
          { key: 'mara', type: 'actor/person/merchant', x: 5, y: 2, tags: ['merchant'] },
          { key: 'draught', type: 'item/potion/healing', x: 5, y: 2, inside: 'mara' },
          ...coins,
        ],
        event: {},
      },
      onto,
      lib(),
    )
    const w = eng.world
    eng.author(() => {
      for (const [id, x] of [['nell', 1], ['mara', 5]] as const) w.get(id)!.npc = { role: 'villager', schedule: [{ from: 0, to: 24, map: 'sandbox', x, y: 2, activity: 'stand' }] }
    })
    let done = false
    for (let i = 0; i < 400 && !done; i++) (eng.tick(), (done = !w.get('draught') && w.num(w.get('nell')!, 'hp') > 6))
    expect(done).toBe(true)
  })
})
