import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, type Engine, type ScenarioEntity } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

/** The player at (2,2) facing up toward (2,1), holding `held` (if any), with `others` around. */
function world(held: string | undefined, others: ScenarioEntity[], terrain?: string[][]): Engine {
  const entities: ScenarioEntity[] = [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2, props: { energy: 100 } }, ...others]
  if (held) entities.push({ key: 'held', type: held, x: 2, y: 2, heldBy: 'actor' })
  const eng = buildSandbox({ entities, event: {}, terrain }, onto, lib())
  eng.world.player.facing = 'up'
  eng.controls.sync()
  return eng
}

const npc = (key = 'npc.hollis'): ScenarioEntity => ({ key, type: 'actor/person/farmer', x: 2, y: 1 })

describe('the Action key', () => {
  it('gives a held object to a person, and talks when holding a tool', () => {
    const gift = world('item/food/apple', [npc()])
    const g = gift.controls.planAction()!
    expect(g.verb).toBe('put')
    expect(g.rule).toBe('core/give')
    const talk = world('item/tool/hoe', [npc()])
    const t = talk.controls.planAction()!
    expect(t.verb).toBe('interact')
    expect(t.rule).toBe('core/talk')
    expect(t.instrument).toBeUndefined()
  })

  it('opens a container as a panel; the panel moves things through the rules', () => {
    const eng = world(undefined, [{ key: 'chest', type: 'fixture/container/chest', x: 2, y: 1 }, { key: 'loaf', type: 'item/food/bread', x: 2, y: 1, inside: 'chest' }])
    const plan = eng.controls.planAction()!
    expect(plan.panel).toBe('chest')
    expect(eng.controls.run(plan).panel).toBe('chest')
    eng.controls.transfer('chest', 'chest', 'loaf', true)
    expect(eng.world.get('loaf')!.place).toMatchObject({ holder: 'actor' })
    eng.controls.transfer('chest', 'bag', 'loaf', true)
    expect(eng.world.get('loaf')!.place).toMatchObject({ on: 'inside', holder: 'chest' })
  })

  it('asks before sleeping and before eating', () => {
    const bed = world(undefined, [{ key: 'bed', type: 'fixture/furniture/bed', x: 2, y: 1 }])
    const plan = bed.controls.planAction()!
    expect(plan.confirm).toBeDefined()
    bed.controls.run(plan)
    expect(bed.world.state.question).toBeDefined()
    const day = bed.world.calendar().day
    bed.controls.answer(true)
    expect(bed.world.calendar().day).toBe(day + 1)
    const meal = world('item/food/bread', [])
    const eat = meal.controls.planAction()!
    expect(eat.rule).toBe('core/eat')
    expect(eat.confirm).toBeDefined()
  })

  it('is forgiving: standing on the bed facing a wall still finds the bed', () => {
    const eng = world(undefined, [{ key: 'bed', type: 'fixture/furniture/bed', x: 2, y: 2 }], [
      ['grass', 'grass', 'grass', 'grass', 'grass'],
      ['wall', 'wall', 'wall', 'wall', 'wall'],
      ['grass', 'grass', 'grass', 'grass', 'grass'],
      ['grass', 'grass', 'grass', 'grass', 'grass'],
      ['grass', 'grass', 'grass', 'grass', 'grass'],
    ])
    expect(eng.controls.planAction()?.rule).toBe('core/sleep')
  })

  it('takes a loose item, places a held object on open ground, and is never undefined', () => {
    const take = world(undefined, [{ key: 'stone', type: 'item/material/stone', x: 2, y: 1 }])
    expect(take.controls.planAction()!.verb).toBe('take')
    const place = world('item/material/stone', [])
    expect(place.controls.planAction()!.rule).toBe('core/put-down')
    const well = world('item/food/apple', [{ key: 'well', type: 'fixture/water/well', x: 2, y: 1 }])
    const a = well.controls.planAction()
    expect(a?.unknown).toBeFalsy()
  })
})

describe('the Use key', () => {
  it('works the ground with a tool', () => {
    const eng = world('item/tool/hoe', [])
    const plan = eng.controls.planUse()!
    expect(plan.rule).toBe('core/till')
    eng.controls.run(plan)
    expect(eng.world.terrainAt('sandbox', 2, 1)).toBe('farmland')
  })

  it('an object on something the world has never seen goes to the Mod port', () => {
    const eng = world('item/food/apple', [{ key: 'well', type: 'fixture/water/well', x: 2, y: 1 }])
    const port = new ModPort(eng)
    const plan = eng.controls.planUse()!
    expect(plan.unknown).toBe(true)
    eng.controls.run(plan)
    expect(port.records).toHaveLength(1)
  })

  it('a bare hand on a thing only a description answers is undefined (source 4)', () => {
    const eng = world(undefined, [{ key: 'rock', type: 'fixture/nature/boulder', x: 2, y: 1 }])
    const port = new ModPort(eng)
    const plan = eng.controls.planUse()!
    expect(plan.unknown).toBe(true)
    eng.controls.run(plan)
    expect(port.records[0].request.event.strict).toBe(true)
  })

  it('a blow on a fixture with no reaction is undefined (source 3); a person in front means Action', () => {
    const eng = world('item/weapon/blade/sword', [{ key: 'well', type: 'fixture/water/well', x: 2, y: 1 }])
    const port = new ModPort(eng)
    const plan = eng.controls.planUse()!
    expect(plan.attack).toBe(true)
    eng.controls.run(plan)
    expect(port.records[0]?.request.event.kind).toBe('hit')
    const kind = world('item/weapon/blade/sword', [npc()])
    expect(kind.controls.planUse()!.key).toBe('action')
  })

  it('stepping onto a burning tile with no rule for it is undefined (source 5)', () => {
    const eng = world(undefined, [])
    const port = new ModPort(eng)
    eng.world.setStatus({ tile: { map: 'sandbox', x: 2, y: 1 } }, 'oiled', -1)
    eng.step(eng.world.player, 'up')
    expect(port.records.map((r) => r.request.event.kind)).toContain('enter')
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
    // pour the bucket: it becomes an empty bucket in the same slot
    eng.world.get('held')!.type = 'item/vessel/bucket/empty'
    eng.controls.sync()
    expect(p.selected).toBe(bucketSlot)
    expect(eng.world.get(p.held)!.type).toBe('item/vessel/bucket/empty')
    const breadSlot = p.slots!.findIndex((k, i) => k && i !== bucketSlot)
    eng.controls.select(breadSlot)
    expect(eng.world.get(p.held)!.type).toBe('item/food/bread')
    // an empty slot: an empty hand, and every stack keeps its slot
    const empty = p.slots!.findIndex((k, i) => !k && i < 12)
    eng.controls.select(empty)
    expect(p.held).toBeUndefined()
    expect(p.slots![bucketSlot]).toBeTruthy()
    eng.controls.select(bucketSlot)
    expect(eng.world.get(p.held)!.type).toBe('item/vessel/bucket/empty')
  })

  it('dropped items within two tiles fly into the bag', () => {
    const eng = world(undefined, [{ key: 'log', type: 'item/material/log', x: 4, y: 2 }])
    eng.world.get('log')!.dropped = true
    eng.controls.magnetic = true
    eng.tick()
    expect(eng.world.get('log')!.place).toMatchObject({ holder: 'actor' })
  })
})
