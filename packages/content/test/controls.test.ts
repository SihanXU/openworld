import { describe, expect, it } from 'vitest'
import { HUNGER_EFFECT_EVERY, HUNGER_EVERY, ModPort, RuleLibrary, buildSandbox, textOf, type Engine, type Key, type Plan, type Ref, type ScenarioEntity, type Verb } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

/** The player at (2,2) facing up toward (2,1), holding `held` (if any), with `others` around. Strict: state changes only in outcomes. */
function world(held: string | undefined, others: ScenarioEntity[], terrain?: string[][]): Engine {
  const entities: ScenarioEntity[] = [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2, props: {} }, ...others]
  if (held) entities.push({ key: 'held', type: held, x: 2, y: 2, heldBy: 'actor' })
  const eng = buildSandbox({ entities, event: {}, terrain }, onto, lib())
  eng.world.strict = true
  eng.world.player.facing = 'up'
  eng.controls.sync()
  return eng
}

const npc = (key = 'npc.hollis'): ScenarioEntity => ({ key, type: 'actor/person/farmer', x: 2, y: 1 })
/** The index of the ground among the layers of a tile (the chooser's pick). */
const ground = (eng: Engine, x = 2, y = 1) => eng.controls.layers({ map: 'sandbox', x, y }).findIndex((r) => 'tile' in r)
const label = (p: Plan | undefined) => textOf(p?.label)

describe('the four inputs: one verb each', () => {
  it('E talks to a person whatever is held; right click gives the held thing', () => {
    const eng = world('item/food/apple', [npc()])
    const talk = eng.controls.plan('hands')
    expect(talk).toMatchObject({ verb: 'hands', rule: 'people/talk', instrument: undefined })
    expect(label(talk)).toBe('Talk to farmer')
    const give = eng.controls.plan('put')
    expect(give).toMatchObject({ verb: 'put', rule: 'people/accept' })
    expect(label(give)).toBe('Give Apple to farmer')
    eng.controls.run(give!)
    expect(eng.world.get('held')!.place).toMatchObject({ on: 'inside', holder: 'npc.hollis' })
  })

  it('E opens a container as a panel; the panel moves things by acts of taking and putting', () => {
    const eng = world(undefined, [{ key: 'chest', type: 'fixture/container/chest', x: 2, y: 1 }, { key: 'loaf', type: 'item/food/bread', x: 2, y: 1, inside: 'chest' }])
    const plan = eng.controls.plan('hands')!
    expect(plan).toMatchObject({ verb: 'hands', rule: 'core/open-close', panel: 'chest' })
    expect(label(plan)).toBe('Open chest')
    expect(eng.controls.run(plan).panel).toBe('chest')
    expect(eng.world.hasStatus({ e: 'chest' }, 'open')).toBe(true)
    eng.controls.transfer('chest', 'chest', 'loaf', true)
    expect(eng.world.get('loaf')!.place).toMatchObject({ holder: 'actor' })
    eng.controls.transfer('chest', 'bag', 'loaf', true)
    expect(eng.world.get('loaf')!.place).toMatchObject({ on: 'inside', holder: 'chest' })
  })

  it('asks before eating (left click on oneself), and eats on yes', () => {
    const meal = world('item/food/bread', [])
    const eat = meal.controls.plan('use', { x: 2, y: 2 })!
    expect(eat).toMatchObject({ verb: 'use', target: { e: 'actor' }, rule: 'use/eat' })
    expect(label(eat)).toBe('Eat Bread')
    expect(eat.confirm).toBeDefined()
    meal.controls.run(eat)
    expect(meal.world.state.question).toBeDefined()
    expect(meal.world.get('held')).toBeDefined()
    meal.controls.answer(true)
    expect(meal.world.get('held')).toBeUndefined()
  })

  it('F takes a loose item; right click places anything, tools included', () => {
    const take = world(undefined, [{ key: 'stone', type: 'item/material/stone', x: 2, y: 1 }])
    const pick = take.controls.plan('take')
    expect(pick).toMatchObject({ verb: 'take', target: { e: 'stone' } })
    expect(label(pick)).toBe('Take Stone')
    take.controls.run(pick!)
    expect(take.world.get('stone')!.place).toMatchObject({ holder: 'actor' })
    const tool = world('item/tool/hoe', [])
    const put = tool.controls.plan('put')!
    expect(put).toMatchObject({ verb: 'put', rule: 'core/receive-ground' })
    expect(label(put)).toBe('Place Hoe')
    tool.controls.run(put)
    expect(tool.world.get('held')!.place).toMatchObject({ on: 'tile', x: 2, y: 1 })
  })

  it('an object used on bare ground is an experiment for the modder, not nothing', () => {
    const eng = world('item/food/apple', [])
    expect(eng.controls.plan('use')).toMatchObject({ verb: 'use', target: { tile: { x: 2, y: 1 } }, unknown: true })
    expect(eng.controls.plan('use', { x: 2, y: 1 })).toMatchObject({ verb: 'use', target: { tile: { x: 2, y: 1 } }, unknown: true })
  })

  it('left click works the ground with a tool: the hoe strikes, the ground answers', () => {
    const eng = world('item/tool/hoe', [])
    const plan = eng.controls.plan('use')!
    expect(plan.rule).toBe('farm/till')
    expect(label(plan)).toBe('Till')
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
    expect(port.records[0]).toMatchObject({ origin: 'player', request: { event: { kind: 'act/use' }, hole: { rule: 'core/use' } } })
    // a bare hand on a boulder: the act is defined (a hand handles it), the boulder's answer is not
    const rock = world(undefined, [{ key: 'rock', type: 'fixture/nature/boulder', x: 2, y: 1 }])
    const p2 = new ModPort(rock)
    const hands = rock.controls.plan('hands')!
    expect(hands.unknown).toBe(true)
    rock.controls.run(hands)
    expect(p2.records[0]).toMatchObject({ origin: 'player', request: { event: { kind: 'impulse/handle' }, hole: { rule: 'core/handle' } } })
  })

  it('weapons strike (but on a person a blade is not a blow); a fist on a creature punches', () => {
    const well = world('item/weapon/blade/sword', [{ key: 'well', type: 'fixture/water/well', x: 2, y: 1 }])
    const port = new ModPort(well)
    const plan = well.controls.plan('use')!
    expect(plan.attack).toBe(true)
    well.controls.run(plan)
    expect(port.records[0]?.request.event).toMatchObject({ kind: 'impulse/strike', params: { edge: 'cut' } })
    const person = world('item/weapon/blade/sword', [npc()])
    expect(person.controls.plan('use')).toMatchObject({ verb: 'use' })
    expect(person.controls.plan('use')!.attack).toBeUndefined()
    const slime = world(undefined, [{ key: 's', type: 'actor/creature/slime/green_slime', x: 2, y: 1 }])
    expect(slime.controls.plan('use')).toMatchObject({ verb: 'use', attack: true, rule: 'combat/struck' })
  })

  it('the chooser reaches any layer: the ground under a stick, the table under a pile', () => {
    const eng = world('item/tool/hoe', [{ key: 'stick', type: 'item/material/stick', x: 2, y: 1 }])
    expect(eng.controls.plan('use', undefined, ground(eng))!.rule).toBe('farm/till')
    const pile = world(undefined, [{ key: 'table', type: 'fixture/furniture/table', x: 2, y: 1 }, { key: 'a', type: 'item/food/apple', x: 2, y: 1 }, { key: 'b', type: 'item/food/bread', x: 2, y: 1 }])
    const targets = pile.controls.choices('take').map((c) => c.plan?.target)
    for (const id of ['table', 'a', 'b']) expect(targets).toContainEqual({ e: id })
  })

  it('stepping onto a tile is contact: no change unless the tile says (nothing asked); a burning tile burns who steps on it', () => {
    const eng = world(undefined, [])
    const port = new ModPort(eng)
    eng.applyStatus({ tile: { map: 'sandbox', x: 2, y: 1 } }, 'oiled')
    eng.applyStatus({ tile: { map: 'sandbox', x: 2, y: 0 } }, 'burning', 999)
    eng.trace = []
    eng.world.player.facing = 'up'
    expect(eng.step(eng.world.player, 'up')).toBe(true)
    expect(port.records).toHaveLength(0)
    expect(eng.world.hasStatus({ e: 'actor' }, 'burning')).toBe(false)
    eng.setCooldown('actor', 0)
    expect(eng.step(eng.world.player, 'up')).toBe(true)
    expect(eng.trace.some((t) => t.ev.kind === 'contact/begin' && t.rule === 'core/touch')).toBe(true)
    expect(eng.world.hasStatus({ e: 'actor' }, 'burning')).toBe(true)
    expect(port.records).toHaveLength(0)
  })
})

/**
 * Completeness (design.md §5.2): every act (verb, instrument, target) the player can make is
 * produced by some input — a key, the selected slot, the aim and a layer — and an input makes
 * exactly one act. The scene has the hard cases: a pile on a table, a stick on the ground, a
 * person, the player's own tile, a second thing in the bag.
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
  const TILES = [{ x: 2, y: 1 }, { x: 1, y: 2 }, { x: 3, y: 1 }, { x: 2, y: 2 }] // a pile on a table, a stick on grass, a person, the own tile
  const sig = (verb: string, inst: string, target: Ref) => JSON.stringify([verb, inst, target])

  it('every (verb, instrument, target) is reachable from some input', () => {
    const eng = scene()
    const c = eng.controls
    const p = eng.world.player
    const typeOf = (r?: Ref) => (r && 'e' in r ? eng.world.get(r.e)!.type : 'none')
    // what the inputs make: every key × every slot (each carried thing, and an empty one) × every aim × every layer
    const made = new Set<string>()
    const slots = [...p.slots!.map((k, i) => (k ? i : -1)).filter((i) => i >= 0), p.slots!.findIndex((k, i) => !k && i < 10)]
    for (const slot of slots) {
      c.select(slot)
      for (const key of KEYS)
        for (const tile of TILES) {
          const n = c.layers({ map: 'sandbox', ...tile }).length
          for (let layer = 0; layer < n; layer++) {
            const pl = c.plan(key, tile, layer)
            if (pl) made.add(sig(pl.attack ? 'attack' : pl.verb!, typeOf(pl.instrument), pl.target))
          }
        }
    }
    // what the player can do there: take or touch bare-handed, use or put any carried thing.
    // No weapon is carried and no creature is near, so nothing is a blow.
    const carried = [...new Set([...(p.contents ?? []), ...(p.held ? [p.held] : [])].map((id) => eng.world.get(id)!.type))]
    const missing: string[] = []
    for (const tile of TILES)
      for (const target of c.layers({ map: 'sandbox', ...tile })) {
        for (const verb of ['take', 'hands'] as Verb[]) if (!made.has(sig(verb, 'none', target))) missing.push(sig(verb, 'none', target))
        for (const verb of ['use', 'put'] as Verb[]) for (const inst of carried) if (!made.has(sig(verb, inst, target))) missing.push(sig(verb, inst, target))
      }
    expect(missing).toEqual([])
  })

  it('each input makes exactly one act, of its own verb (a bare left click is a hand)', () => {
    const eng = scene()
    const c = eng.controls
    for (const slot of [eng.world.player.selected!, eng.world.player.slots!.findIndex((k, i) => !k && i < 10)]) {
      c.select(slot)
      for (const key of KEYS)
        for (const tile of [{ x: 2, y: 1 }, { x: 1, y: 2 }, { x: 3, y: 1 }, { x: 2, y: 2 }]) {
          const n = c.layers({ map: 'sandbox', ...tile }).length
          for (let layer = 0; layer < n; layer++) {
            const a = c.plan(key, tile, layer)
            const b = c.plan(key, tile, layer)
            expect(JSON.stringify(a)).toBe(JSON.stringify(b))
            if (!a || a.attack) continue
            if (key === 'use' && !a.instrument) expect(a.verb).toBe('hands')
            else expect(a.verb).toBe(key)
          }
        }
    }
  })

  it('an item in the bag is a target too (the context menu)', () => {
    const eng = scene()
    expect(eng.controls.planOnItem('use', 'apple')).toMatchObject({ verb: 'use', target: { e: 'apple' } })
    expect(eng.controls.planOnItem('put', 'apple')).toMatchObject({ verb: 'put', target: { e: 'apple' } })
    expect(eng.controls.planOnItem('hands', 'apple')).toMatchObject({ verb: 'hands', target: { e: 'apple' }, instrument: undefined })
  })
})

describe('slots and the magnet', () => {
  it('new kinds take free slots; the hand holds the selected stack; a held item an outcome changed keeps its slot', () => {
    const eng = world('item/vessel/bucket/water', [
      { key: 'b2', type: 'item/food/bread', x: 0, y: 0, inside: 'actor' },
      { key: 'b3', type: 'item/food/bread', x: 0, y: 0, inside: 'actor' },
    ])
    const p = eng.world.player
    expect(p.slots!.filter(Boolean)).toHaveLength(2)
    const bucketSlot = p.selected!
    // pouring the water out: the bucket (the act's host) becomes an empty one, in the hand
    eng.controls.run(eng.controls.plan('use')!)
    expect(eng.world.get('held')!.type).toBe('item/vessel/bucket/empty')
    expect(p.selected).toBe(bucketSlot)
    expect(eng.world.get(p.held)!.type).toBe('item/vessel/bucket/empty')
    const breadSlot = p.slots!.findIndex((k, i) => k && i !== bucketSlot)
    eng.controls.select(breadSlot)
    expect(eng.world.get(p.held)!.type).toBe('item/food/bread')
    const empty = p.slots!.findIndex((k, i) => !k && i < 10)
    eng.controls.select(empty)
    expect(p.held).toBeUndefined()
    expect(p.slots![bucketSlot]).toBeTruthy()
    eng.controls.select(bucketSlot)
    expect(eng.world.get(p.held)!.type).toBe('item/vessel/bucket/empty')
  })

  it('the bag holds three rows; Tab brings the next row to the toolbar, Shift+click moves a stack across', () => {
    const known = ['ash', 'bone', 'cloth', 'coal', 'feather', 'herb', 'leather', 'log', 'plank', 'salt', 'stick', 'stone'].map((m) => `item/material/${m}`)
    const eng = world(undefined, known.map((type, i) => ({ key: `k${i}`, type, x: 0, y: 0, inside: 'actor' })))
    const p = eng.world.player
    expect(p.slots).toHaveLength(30)
    // more kinds than the toolbar holds: the rest go to row 2, nothing is dropped
    expect(p.slots!.filter(Boolean)).toHaveLength(known.length)
    expect(p.contents!.length + (p.held ? 1 : 0)).toBe(known.length)
    const second = p.slots![10]
    expect(second).toBeTruthy()
    eng.controls.nextRow()
    expect(p.slots![0]).toBe(second)
    eng.controls.nextRow(-1)
    expect(p.slots![10]).toBe(second)
    // Shift+click: from the bag to the toolbar's first free slot, and back to the bag's
    eng.controls.select(0)
    eng.controls.drop(0, true)
    eng.controls.quickMove(10)
    expect(p.slots![0]).toBe(second)
    expect(p.slots![10]).toBeNull()
    eng.controls.quickMove(0)
    expect(p.slots![0]).toBeNull()
    expect(p.slots!.indexOf(second)).toBeGreaterThanOrEqual(10)
  })

  it('the menu drops in front (an act of putting)', () => {
    const bag = world(undefined, [{ key: 'b', type: 'item/food/bread', x: 0, y: 0, inside: 'actor' }])
    bag.trace = []
    bag.controls.drop(bag.world.player.slots!.findIndex(Boolean), true)
    expect(bag.world.get('b')!.place).toMatchObject({ on: 'tile', x: 2, y: 1 })
    expect(bag.trace.map((t) => t.rule).slice(0, 2)).toEqual(['core/put', 'core/receive-ground'])
  })

  it('dropped items within two tiles fly into the bag (an act of taking)', () => {
    const eng = world(undefined, [{ key: 'log', type: 'item/material/log', x: 4, y: 2 }])
    eng.world.get('log')!.dropped = true
    eng.controls.magnetic = true
    eng.tick()
    expect(eng.world.get('log')!.place).toMatchObject({ holder: 'actor' })
  })
})

describe('hunger', () => {
  it('drains over time, food restores it, well fed heals, starving hurts but never takes the last point', () => {
    const eng = world('item/food/bread', [])
    const p = eng.world.player
    const tickTo = (t: number) => {
      while (eng.world.state.tick < t) eng.tick()
    }
    expect(eng.world.num(p, 'maxHunger')).toBe(20)
    tickTo(HUNGER_EVERY)
    expect(p.props!.hunger).toBe(19)
    // bread feeds (5), never past the bar, and does not heal (Minecraft: health comes from being fed)
    p.props!.hp = 30
    eng.act('use', p.id, { e: p.id }, { instrument: { e: 'held' } })
    expect(p.props!.hunger).toBe(20)
    expect(p.props!.hp).toBe(30)
    // a healing herb is medicine: it heals as well
    const herb = eng.world.write(() => eng.world.create('item/material/herb', { on: 'inside', holder: p.id }))
    eng.act('use', p.id, { e: p.id }, { instrument: { e: herb.id } })
    expect(p.props!.hp).toBe(34)
    // well fed: hurt health comes back slowly
    p.props!.hp = 30
    tickTo(eng.world.state.tick + HUNGER_EFFECT_EVERY * 3)
    expect(p.props!.hp).toBeGreaterThan(30)
    // starving: health falls, but not below 1
    p.props!.hunger = 0
    p.props!.hp = 3
    tickTo(eng.world.state.tick + HUNGER_EFFECT_EVERY * 10)
    expect(p.props!.hp).toBe(1)
    expect(eng.world.hasStatus({ e: p.id }, 'down')).toBe(false)
  })
})

describe('the attack key', () => {
  it('strikes straight ahead with the held weapon; held down, the cooldown paces the blows', () => {
    const eng = world('item/weapon/blade/sword', [{ key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 1, props: { hp: 50, maxHp: 50 } }])
    const slime = eng.world.get('slime')!
    eng.controls.strike()
    eng.tick()
    const after1 = eng.world.num(slime, 'hp')
    expect(after1).toBeLessThan(50)
    // pressed again at once: the blow is still on cooldown
    eng.controls.strike()
    eng.tick()
    expect(eng.world.num(slime, 'hp')).toBe(after1)
    // held down: blows keep landing as the cooldown allows
    for (let i = 0; i < 20; i++) (eng.controls.strike(), eng.tick())
    expect(eng.world.num(slime, 'hp')).toBeLessThan(after1)
  })
})
