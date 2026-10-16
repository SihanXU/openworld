import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, performPlacement, previewPlacement, textOf, type Engine } from '@openworld/engine'
import { BASE_RULES, BUILDINGS, PLACEMENT_BY_ID, VEGETABLE_CROPS, buildOntology } from '../src/index.ts'

const at = { map: 'sandbox', x: 2, y: 1 }
function fresh(actorId = 'actor'): Engine {
  return buildSandbox({ entities: [{ key: actorId, type: 'actor/person/player', x: 2, y: 2 }], event: { kind: 'act/hands', host: actorId, actor: actorId, target: 'tile:2,1' } }, buildOntology(), new RuleLibrary(BASE_RULES))
}
function kit(eng: Engine, recipeId: string, actorId = 'actor') {
  const r = PLACEMENT_BY_ID[recipeId]
  const tools: Record<string, string> = { 'tool:hammer': 'item/tool/smith_hammer', 'tool:hoe': 'item/tool/hoe', 'tool:sickle': 'item/tool/sickle', 'liquid:water': 'item/vessel/bucket/water', 'empty-vessel': 'item/vessel/bucket/empty' }
  return r.needs.flatMap((n) => Array.from({ length: n.count }, () => eng.world.author(() => eng.world.create(n.match.type ?? tools[n.match.tags![0]], { on: 'inside', holder: actorId }))))
}
const place = (e: Engine, id: string, actor = 'actor') => performPlacement(e, actor, PLACEMENT_BY_ID[id], at)

describe('rule-driven construction', () => {
  it.each(BUILDINGS)('builds $id through its real rules and spends exactly its recipe', (r) => {
    const e = fresh()
    const items = kit(e, r.id)
    expect(previewPlacement(e, 'actor', r, at).ok).toBe(true)
    expect(place(e, r.id).ok).toBe(true)
    const made = e.world.placedAt(at.map, at.x, at.y).find((x) => x.type === r.result)
    expect(made).toBeDefined()
    // every step answered by the rules it names, along its chain (an act and the impulses it sends)
    const acted = e.trace.filter((x) => x.ev.kind.startsWith('act/')).length
    expect(acted).toBe(r.steps.length)
    const actor = e.world.get('actor')!
    expect([...(actor.contents ?? []), ...(actor.held ? [actor.held] : [])]).toHaveLength(r.needs.filter((x) => !x.consume).length)
    for (const tool of items.filter((x) => e.world.hasTag(x, 'tool:hammer'))) expect(e.world.posOf(e.world.get(tool.id))).toEqual(e.world.posOf(actor))
    expect(e.world.onto.resolve(made!.type).solid).toBe(true)
  })
  it('never borrows from other actors or nearby containers', () => {
    const e = fresh('builder')
    kit(e, 'chest', 'builder')
    expect(place(e, 'chest', 'builder').ok).toBe(true)
    expect(e.world.player.id).not.toBe('builder')
    e.world.author(() => e.world.place(e.world.get('builder')!, { on: 'tile', map: at.map, x: 1, y: 1 }))
    expect(place(e, 'crate').ok).toBe(false)
  })
  it.each(['missing', 'occupied', 'self', 'far', 'fractional', 'water', 'frozen'] as const)('rejects %s without spending or changing equipment', (kind) => {
    const e = fresh()
    const items = kit(e, 'crate')
    let target = at
    if (kind === 'missing') e.world.author(() => e.world.destroy(items[1]))
    if (kind === 'occupied') e.world.author(() => e.world.create('item/material/stick', { on: 'tile', ...at }))
    if (kind === 'self') target = { ...at, y: 2 }
    if (kind === 'far') target = { ...at, x: 4 }
    if (kind === 'fractional') target = { ...at, x: 2.5 }
    if (kind === 'water') e.world.author(() => e.world.setTerrain(at.map, at.x, at.y, 'water'))
    if (kind === 'frozen') items[0].frozenBy = 'pending'
    const before = structuredClone(e.world.state)
    expect(performPlacement(e, 'actor', PLACEMENT_BY_ID.crate, target).ok).toBe(false)
    expect(e.world.state).toEqual(before)
  })
  it.each(BUILDINGS)('builds $id on a floor laid there (in a house), on the floor', (r) => {
    const e = fresh()
    e.world.author(() => e.world.create('structure/floor', { on: 'tile', ...at }))
    kit(e, r.id)
    expect(place(e, r.id).ok).toBe(true)
    const made = e.world.placedAt(at.map, at.x, at.y).find((x) => x.type === r.result)!
    expect(e.world.posOf(made)).toMatchObject(at)
    expect(e.world.posOf(made)?.z ?? 0).toBe(0)
    expect(e.world.placedAt(at.map, at.x, at.y).some((x) => x.type === 'structure/floor')).toBe(true)
  })
  it('builds upstairs on the floor one stands on; a flyer over the cell is not in the way, a thing lying there is', () => {
    const e = fresh()
    e.world.author(() => {
      e.world.create('structure/floor', { on: 'tile', ...at, z: 1 })
      e.world.create('structure/floor', { on: 'tile', ...at, y: 2, z: 1 })
      e.world.place(e.world.get('actor')!, { on: 'tile', ...at, y: 2, z: 1 })
      e.world.create('actor/companion/fairy', { on: 'tile', ...at, z: 1 })
    })
    kit(e, 'chest')
    expect(textOf(place(e, 'chest').reason, 'en')).toBe('Done.')
    const chest = e.world.placedAt(at.map, at.x, at.y, 1).find((x) => x.type === 'fixture/container/chest')!
    expect(e.world.posOf(chest)?.z).toBe(1)
    // nothing was built on the ground under it
    expect(e.world.entitiesAt(at.map, at.x, at.y, 0).some((x) => !e.world.isTerrain(x))).toBe(false)
    const f = fresh()
    f.world.author(() => {
      f.world.create('structure/floor', { on: 'tile', ...at })
      f.world.create('item/material/stick', { on: 'tile', ...at })
    })
    kit(f, 'crate')
    expect(place(f, 'crate').ok).toBe(false)
  })
  it('a fence faces the way the builder faces it (across their way), or the way the palette turned it (R)', () => {
    const e = fresh()
    kit(e, 'fence')
    // the builder stands south of the cell: the fence runs east-west across their way, its front to them
    expect(place(e, 'fence').ok).toBe(true)
    expect(e.world.placedAt(at.map, at.x, at.y).find((x) => x.type === 'fixture/fence')?.facing).toBe('up')
    const f = fresh()
    kit(f, 'fence')
    expect(performPlacement(f, 'actor', PLACEMENT_BY_ID.fence, at, 'right').ok).toBe(true)
    expect(f.world.placedAt(at.map, at.x, at.y).find((x) => x.type === 'fixture/fence')?.facing).toBe('right')
  })
  it('rehearses every step before spending if the library no longer permits a finish', () => {
    const e = fresh()
    kit(e, 'chest')
    e.lib = new RuleLibrary(BASE_RULES.filter((r) => r.id !== 'build/frame'))
    const before = structuredClone(e.world.state)
    expect(place(e, 'chest').ok).toBe(false)
    expect(e.world.state).toEqual(before)
  })
})

describe('vegetable garden', () => {
  it('grows on the real expiry clock, never on an unwatered timer', () => {
    const e = fresh()
    e.world.author(() => e.world.setTerrain(at.map, at.x, at.y, 'farmland'))
    kit(e, 'sow-carrot'); kit(e, 'water')
    place(e, 'sow-carrot')
    const crop = e.world.placedAt(at.map, at.x, at.y)[0]
    for (let i = 0; i < 1200; i++) e.tick()
    expect(crop.type).toBe('fixture/crop/carrot/sprout')
    expect(place(e, 'water').ok).toBe(true)
    for (let i = 0; i < 1199; i++) e.tick()
    expect(crop.type).toBe('fixture/crop/carrot/sprout')
    e.tick()
    expect(crop.type).toBe('fixture/crop/carrot/young')
    expect(e.world.hasStatus({ e: crop.id }, 'watered')).toBe(false)
  })
  it.each(VEGETABLE_CROPS)('$id: till, sow, water twice, harvest food and seeds', (c) => {
    const e = fresh()
    kit(e, 'till'); kit(e, `sow-${c.id}`); kit(e, 'water'); kit(e, 'harvest')
    expect(place(e, 'till').ok).toBe(true)
    expect(e.world.terrainAt(at.map, at.x, at.y)).toBe('farmland')
    expect(place(e, `sow-${c.id}`).ok).toBe(true)
    const crop = e.world.placedAt(at.map, at.x, at.y)[0]
    expect(crop.type).toBe(`fixture/crop/${c.id}/sprout`)
    expect(place(e, `sow-${c.id}`).ok).toBe(false)
    const grow = () => {
      expect(place(e, 'water').ok).toBe(true)
      expect(place(e, 'water').ok).toBe(false)
      expect(e.world.hasStatus({ e: crop.id }, 'watered')).toBe(true)
      // Wait the crop's actual clock, preserving the real watering and harvest assertions.
      const duration = Number(e.world.prop(crop, 'growHours')) * 600
      for (let i = 0; i < duration; i++) e.tick()
    }
    grow()
    expect(crop.type).toBe(`fixture/crop/${c.id}/young`)
    expect(place(e, 'harvest').ok).toBe(false)
    e.author(() => e.world.setTerrain(at.map, at.x - 1, at.y, 'water'))
    expect(performPlacement(e, 'actor', PLACEMENT_BY_ID.fill, { ...at, x: at.x - 1 }).ok).toBe(true)
    grow()
    expect(crop.type).toBe(`fixture/crop/${c.id}/ripe`)
    expect(place(e, 'harvest').ok).toBe(true)
    const drops = Object.values(e.world.state.entities)
    expect(drops.filter((x) => x.type === `item/food/${c.id}`)).toHaveLength(2)
    expect(drops.filter((x) => x.type === `item/seed/${c.id}`)).toHaveLength(2)
    expect(e.world.get(crop.id)?.type).toBe(c.perennial ? `fixture/crop/${c.id}/young` : undefined)
    expect(drops.find((x) => x.type === `item/food/${c.id}`) && e.world.onto.resolve(`item/food/${c.id}`).props.food).toBe(c.food)
  })
  it('keeps the bucket in its selected slot across watering and refilling', () => {
    const e = fresh()
    e.world.author(() => e.world.setTerrain(at.map, at.x, at.y, 'farmland'))
    kit(e, 'sow-carrot')
    const [bucket] = kit(e, 'water')
    e.controls.sync()
    e.controls.select(e.world.get('actor')!.slots!.indexOf(e.controls.key(bucket)))
    expect(place(e, 'sow-carrot').ok).toBe(true)
    expect(place(e, 'water').ok).toBe(true)
    expect(e.world.get('actor')!.held).toBe(bucket.id)
    expect(e.world.get(bucket.id)!.type).toBe('item/vessel/bucket/empty')
  })
})

describe('one name for one thing', () => {
  it.each(BUILDINGS)('the building panel calls $id what it builds is called (营火, not 篝火 in the labels)', (r) => {
    const onto = buildOntology()
    const made = onto.types[r.result!]?.name
    expect(textOf(r.name, 'zh')).toBe(textOf(made, 'zh'))
  })
})
