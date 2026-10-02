import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, type Engine, type Key, type Ref, type ScenarioEntity, type Verb } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

/** The player at (2,2) facing up toward (2,1), holding `held` (if any), with `others` around. */
function world(held: string | undefined, others: ScenarioEntity[], terrain?: string[][]): Engine {
  const entities: ScenarioEntity[] = [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2, props: {} }, ...others]
  if (held) entities.push({ key: 'held', type: held, x: 2, y: 2, heldBy: 'actor' })
  const eng = buildSandbox({ entities, event: {}, terrain }, onto, lib())
  eng.world.player.facing = 'up'
  eng.controls.sync()
  return eng
}

const npc = (key = 'npc.hollis'): ScenarioEntity => ({ key, type: 'actor/person/farmer', x: 2, y: 1 })
/** The index of the ground among the layers of a tile (the chooser's pick). */
const ground = (eng: Engine, x = 2, y = 1) => eng.controls.layers({ map: 'sandbox', x, y }).findIndex((r) => 'tile' in r)

describe('the four inputs: one verb each', () => {
  it('E talks to a person whatever is held; right click gives the held thing', () => {
    const eng = world('item/food/apple', [npc()])
    expect(eng.controls.plan('hands')).toMatchObject({ verb: 'interact', rule: 'core/talk', instrument: undefined })
    expect(eng.controls.plan('put')).toMatchObject({ verb: 'put', rule: 'core/give' })
  })

  it('E opens a container as a panel; the panel moves things through the rules', () => {
    const eng = world(undefined, [{ key: 'chest', type: 'fixture/container/chest', x: 2, y: 1 }, { key: 'loaf', type: 'item/food/bread', x: 2, y: 1, inside: 'chest' }])
    const plan = eng.controls.plan('hands')!
    expect(plan.panel).toBe('chest')
    expect(eng.controls.run(plan).panel).toBe('chest')
    eng.controls.transfer('chest', 'chest', 'loaf', true)
    expect(eng.world.get('loaf')!.place).toMatchObject({ holder: 'actor' })
    eng.controls.transfer('chest', 'bag', 'loaf', true)
    expect(eng.world.get('loaf')!.place).toMatchObject({ on: 'inside', holder: 'chest' })
  })

  it('asks before eating (left click on oneself), and eats on yes', () => {
    const meal = world('item/food/bread', [])
    const eat = meal.controls.plan('use', { x: 2, y: 2 })!
    expect(eat.rule).toBe('core/eat')
    expect(eat.confirm).toBeDefined()
    meal.controls.run(eat)
    expect(meal.world.state.question).toBeDefined()
    expect(meal.world.get('held')).toBeDefined()
    meal.controls.answer(true)
    expect(meal.world.get('held')).toBeUndefined()
  })

  it('F takes a loose item; right click places anything, tools included', () => {
    const take = world(undefined, [{ key: 'stone', type: 'item/material/stone', x: 2, y: 1 }])
    expect(take.controls.plan('take')).toMatchObject({ verb: 'take', rule: 'core/take-item' })
    const tool = world('item/tool/hoe', [])
    const put = tool.controls.plan('put')!
    expect(put.rule).toBe('core/put-down')
    tool.controls.run(put)
    expect(tool.world.get('held')!.place).toMatchObject({ on: 'tile', x: 2, y: 1 })
  })

  it('an object used on bare ground is an experiment for the modder, not nothing', () => {
    const eng = world('item/food/apple', [])
    expect(eng.controls.plan('use')).toMatchObject({ verb: 'interact', target: { tile: { x: 2, y: 1 } }, unknown: true })
    const pl = eng.controls.plan('use', { x: 2, y: 1 })!
    expect(pl).toMatchObject({ verb: 'interact', target: { tile: { x: 2, y: 1 } }, unknown: true })
  })

  it('left click works the ground with a tool', () => {
    const eng = world('item/tool/hoe', [])
    const plan = eng.controls.plan('use')!
    expect(plan.rule).toBe('core/till')
    eng.controls.run(plan)
    expect(eng.world.terrainAt('sandbox', 2, 1)).toBe('farmland')
  })

  it('experiments go to the Mod port: an object on a thing (left click), a bare hand (E)', () => {
    const apple = world('item/food/apple', [{ key: 'well', type: 'fixture/water/well', x: 2, y: 1 }])
    const port = new ModPort(apple)
    const plan = apple.controls.plan('use')!
    expect(plan.unknown).toBe(true)
    apple.controls.run(plan)
    expect(port.records).toHaveLength(1)
    const rock = world(undefined, [{ key: 'rock', type: 'fixture/nature/boulder', x: 2, y: 1 }])
    const p2 = new ModPort(rock)
    rock.controls.run(rock.controls.plan('hands')!)
    expect(p2.records[0].request.event.strict).toBe(true)
  })

  it('weapons strike (but on a person a blade is an interaction); a fist on a creature punches', () => {
    const well = world('item/weapon/blade/sword', [{ key: 'well', type: 'fixture/water/well', x: 2, y: 1 }])
    const port = new ModPort(well)
    const plan = well.controls.plan('use')!
    expect(plan.attack).toBe(true)
    well.controls.run(plan)
    expect(port.records[0]?.request.event.kind).toBe('hit')
    const person = world('item/weapon/blade/sword', [npc()])
    expect(person.controls.plan('use')).toMatchObject({ verb: 'interact' })
    expect(person.controls.plan('use')!.attack).toBeUndefined()
    const slime = world(undefined, [{ key: 's', type: 'actor/creature/slime/green_slime', x: 2, y: 1 }])
    expect(slime.controls.plan('use')!.attack).toBe(true)
  })

  it('the chooser reaches any layer: the ground under a stick, the table under a pile', () => {
    const eng = world('item/tool/hoe', [{ key: 'stick', type: 'item/material/stick', x: 2, y: 1 }])
    expect(eng.controls.plan('use', undefined, ground(eng))!.rule).toBe('core/till')
    const pile = world(undefined, [{ key: 'table', type: 'fixture/furniture/table', x: 2, y: 1 }, { key: 'a', type: 'item/food/apple', x: 2, y: 1 }, { key: 'b', type: 'item/food/bread', x: 2, y: 1 }])
    const targets = pile.controls.choices('take').map((c) => c.plan?.target)
    for (const id of ['table', 'a', 'b']) expect(targets).toContainEqual({ e: id })
  })

  it('stepping onto a tile in some state with no rule for it is undefined (source 5)', () => {
    const eng = world(undefined, [])
    const port = new ModPort(eng)
    eng.world.setStatus({ tile: { map: 'sandbox', x: 2, y: 1 } }, 'oiled', -1)
    eng.step(eng.world.player, 'up')
    expect(port.records.map((r) => r.request.event.kind)).toContain('enter')
  })
})

/**
 * Completeness (design.md §5.2): every player interaction (verb, instrument, target) the engine
 * can make is produced by some input — a key, the selected slot, the aim and a layer — and an
 * input makes exactly one event. The scene has the hard cases: a pile on a table, a stick on
 * the ground, a person, the player's own tile, a second thing in the bag.
 */
describe('completeness of the inputs', () => {
  const scene = () =>
    world('item/tool/hoe', [
      { key: 'table', type: 'fixture/furniture/table', x: 2, y: 1 },
      { key: 'bread', type: 'item/food/bread', x: 2, y: 1 },
      { key: 'cheese', type: 'item/food/cheese', x: 2, y: 1 },
      { key: 'stick', type: 'item/material/stick', x: 1, y: 2 },
      { key: 'apple', type: 'item/food/apple', x: 0, y: 0, inside: 'actor' },
      { key: 'npc.oda', type: 'actor/person/merchant', x: 3, y: 1 },
    ])
  const KEYS: Key[] = ['hands', 'take', 'use', 'put']
  const VERB: Record<Key, Verb> = { hands: 'interact', take: 'take', use: 'interact', put: 'put' }
  const TILES = [{ x: 2, y: 1 }, { x: 1, y: 2 }, { x: 3, y: 1 }, { x: 2, y: 2 }] // a pile on a table, a stick on grass, a person, the own tile
  const sig = (verb: string, inst: string, target: Ref) => JSON.stringify([verb, inst, target])

  it('every (verb, instrument, target) is reachable from some input', () => {
    const eng = scene()
    const c = eng.controls
    const p = eng.world.player
    const typeOf = (r?: Ref) => (r && 'e' in r ? eng.world.get(r.e)!.type : 'none')
    // what the inputs make: every key × every slot (each carried thing, and an empty one) × every aim × every layer
    const made = new Set<string>()
    const slots = [...p.slots!.map((k, i) => (k ? i : -1)).filter((i) => i >= 0), p.slots!.findIndex((k, i) => !k && i < 12)]
    for (const slot of slots) {
      c.select(slot)
      for (const key of KEYS)
        for (const tile of TILES) {
          const n = c.layers({ map: 'sandbox', ...tile }).length
          for (let layer = 0; layer < n; layer++) {
            const pl = c.plan(key, tile, layer)
            if (pl) made.add(sig(pl.attack ? 'hit' : pl.verb!, typeOf(pl.instrument), pl.target))
          }
        }
    }
    // what the engine allows on those tiles: take (with whatever is in hand), put (something to put),
    // interact (bare or with any carried thing). Weapons are not carried here, so nothing is a blow.
    const carried = [...new Set([...(p.contents ?? []), ...(p.held ? [p.held] : [])].map((id) => eng.world.get(id)!.type))]
    const missing: string[] = []
    for (const tile of TILES)
      for (const target of c.layers({ map: 'sandbox', ...tile }))
        for (const verb of ['take', 'put', 'interact'] as Verb[])
          for (const inst of ['none', ...carried]) {
            if (verb === 'put' && inst === 'none') continue
            if (!made.has(sig(verb, inst, target))) missing.push(sig(verb, inst, target))
          }
    expect(missing).toEqual([])
  })

  it('each input makes exactly one event, of its own verb', () => {
    const eng = scene()
    const c = eng.controls
    for (const key of KEYS)
      for (const tile of TILES) {
        const n = c.layers({ map: 'sandbox', ...tile }).length
        for (let layer = 0; layer < n; layer++) {
          const a = c.plan(key, tile, layer)
          const b = c.plan(key, tile, layer)
          expect(JSON.stringify(a)).toBe(JSON.stringify(b))
          if (a && !a.attack) expect(a.verb).toBe(VERB[key])
        }
      }
  })

  it('an item in the bag is a target too (the context menu)', () => {
    const eng = scene()
    expect(eng.controls.planOnItem('use', 'apple')).toMatchObject({ verb: 'interact', target: { e: 'apple' } })
    expect(eng.controls.planOnItem('put', 'apple')).toMatchObject({ verb: 'put', target: { e: 'apple' } })
    expect(eng.controls.planOnItem('hands', 'apple')).toMatchObject({ verb: 'interact', target: { e: 'apple' }, instrument: undefined })
  })
})

describe('slots and the magnet', () => {
  it('new kinds take free slots; the hand holds the selected stack; a changed held item keeps its slot', () => {
    const eng = world('item/vessel/bucket/water', [
      { key: 'b2', type: 'item/food/bread', x: 0, y: 0, inside: 'actor' },
      { key: 'b3', type: 'item/food/bread', x: 0, y: 0, inside: 'actor' },
    ])
    const p = eng.world.player
    expect(p.slots!.filter(Boolean)).toHaveLength(2)
    const bucketSlot = p.selected!
    eng.world.get('held')!.type = 'item/vessel/bucket/empty'
    eng.controls.sync()
    expect(p.selected).toBe(bucketSlot)
    expect(eng.world.get(p.held)!.type).toBe('item/vessel/bucket/empty')
    const breadSlot = p.slots!.findIndex((k, i) => k && i !== bucketSlot)
    eng.controls.select(breadSlot)
    expect(eng.world.get(p.held)!.type).toBe('item/food/bread')
    const empty = p.slots!.findIndex((k, i) => !k && i < 12)
    eng.controls.select(empty)
    expect(p.held).toBeUndefined()
    expect(p.slots![bucketSlot]).toBeTruthy()
    eng.controls.select(bucketSlot)
    expect(eng.world.get(p.held)!.type).toBe('item/vessel/bucket/empty')
  })

  it('the menu drops in front', () => {
    const bag = world(undefined, [{ key: 'b', type: 'item/food/bread', x: 0, y: 0, inside: 'actor' }])
    bag.controls.drop(bag.world.player.slots!.findIndex(Boolean), true)
    expect(bag.world.get('b')!.place).toMatchObject({ on: 'tile', x: 2, y: 1 })
  })

  it('dropped items within two tiles fly into the bag', () => {
    const eng = world(undefined, [{ key: 'log', type: 'item/material/log', x: 4, y: 2 }])
    eng.world.get('log')!.dropped = true
    eng.controls.magnetic = true
    eng.tick()
    expect(eng.world.get('log')!.place).toMatchObject({ holder: 'actor' })
  })
})
