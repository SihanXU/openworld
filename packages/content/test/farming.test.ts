// M4: farming, played through the same entry point as the player's keys.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, SANDBOX_MAP, buildSandbox, type Engine } from '@lsw/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const HOURS = 600

/** Farmland (or `ground`) along y = 1, `crops` standing on it, the player at (x,2) facing up. */
function farm(width: number, crops: Record<number, string> = {}, ground = 'farmland', extraRows = 0): Engine {
  const rows = Array.from({ length: 3 + extraRows }, (_, y) => Array(width).fill(y >= 1 && y <= 1 + extraRows ? ground : 'grass'))
  const eng = buildSandbox(
    {
      terrain: rows,
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 0, y: 2 + extraRows },
        ...Object.entries(crops).map(([x, type]) => ({ key: `c${x}`, type, x: Number(x), y: 1 })),
      ],
      event: {},
    },
    onto,
    new RuleLibrary(BASE_RULES),
  )
  eng.world.get('actor')!.facing = 'up'
  return eng
}

const standAt = (eng: Engine, x: number) => eng.world.place(eng.world.get('actor')!, { on: 'tile', map: SANDBOX_MAP, x, y: 2 })
const hold = (eng: Engine, type: string) => {
  eng.hold('actor')
  eng.world.create(type, { on: 'hand', holder: 'actor' })
}
const act = (eng: Engine, verb: 'put' | 'interact' | 'take', type?: string) => {
  if (type) hold(eng, type)
  else eng.hold('actor')
  return eng.playerVerb(verb)?.rule?.id
}
const wait = (eng: Engine, ticks: number) => {
  for (let i = 0; i < ticks; i++) eng.tick()
}
const at = (eng: Engine, x: number, y = 1) => eng.world.entitiesAt(SANDBOX_MAP, x, y).map((e) => e.type)
const everywhere = (eng: Engine, type: string) => Object.values(eng.world.state.entities).filter((e) => e.type === type).length

const SEED = 'item/seed/wheat'
const WATER = 'item/vessel/bucket/water'
const SICKLE = 'item/tool/sickle'

describe('a season', () => {
  it('four seeds become eight within a game day', () => {
    const eng = farm(4)
    for (let x = 0; x < 4; x++) {
      standAt(eng, x)
      expect(act(eng, 'put', SEED)).toBe('farm/sow')
    }
    expect(at(eng, 2)).toEqual(['fixture/crop/wheat/sprout'])
    for (const stage of ['young', 'ripe']) {
      for (let x = 0; x < 4; x++) {
        standAt(eng, x)
        expect(act(eng, 'interact', WATER)).toBe('farm/water')
      }
      wait(eng, 2 * HOURS + 1)
      expect(at(eng, 0)).toEqual([`fixture/crop/wheat/${stage}`])
    }
    for (let x = 0; x < 4; x++) {
      standAt(eng, x)
      expect(act(eng, 'interact', SICKLE)).toBe('farm/harvest')
    }
    expect(everywhere(eng, SEED)).toBe(8)
    expect(everywhere(eng, 'item/material/wheat')).toBe(8)
    expect(eng.world.state.tick).toBeLessThan(24 * HOURS)
  })

  it('a crop only grows when watered, and only one stage per watering', () => {
    const eng = farm(1, { 0: 'fixture/crop/wheat/sprout' })
    wait(eng, 24 * HOURS)
    expect(at(eng, 0)).toEqual(['fixture/crop/wheat/sprout'])
    act(eng, 'interact', WATER)
    expect(act(eng, 'interact', WATER)).toBe('core/splash')
    wait(eng, 24 * HOURS)
    expect(at(eng, 0)).toEqual(['fixture/crop/wheat/young'])
  })

  it('picking by hand gives one of each; ash adds one to a sickle harvest', () => {
    const picked = farm(1, { 0: 'fixture/crop/wheat/ripe' })
    expect(act(picked, 'take')).toBe('farm/pick')
    expect(picked.world.get(picked.world.get('actor')!.held)?.type).toBe('item/material/wheat')
    expect(at(picked, 0)).toEqual([SEED])

    const rich = farm(1, { 0: 'fixture/crop/wheat/young' })
    expect(act(rich, 'put', 'item/material/ash')).toBe('farm/fertilize')
    act(rich, 'interact', WATER)
    wait(rich, 2 * HOURS + 1)
    expect(act(rich, 'interact', SICKLE)).toBe('farm/harvest')
    expect(everywhere(rich, 'item/material/wheat')).toBe(3)
  })

  it('a berry bush bears again after picking', () => {
    const eng = farm(1, { 0: 'fixture/crop/berry/ripe' })
    expect(act(eng, 'take')).toBe('farm/pick-perennial')
    expect(at(eng, 0)).toContain('fixture/crop/berry/young')
  })

  it('a shovel lifts a plant and gives back its seed', () => {
    const eng = farm(1, { 0: 'fixture/crop/herb/young' })
    expect(act(eng, 'interact', 'item/tool/shovel')).toBe('farm/dig-up')
    expect(at(eng, 0)).toEqual(['item/seed/herb'])
  })
})

describe('fire and trees', () => {
  it('a torch dropped in ripe wheat costs the harvest and leaves ash', () => {
    // a 4 x 4 field of ripe wheat, the player below it
    const eng = buildSandbox(
      {
        terrain: Array.from({ length: 6 }, (_, y) => Array(4).fill(y >= 1 && y <= 4 ? 'farmland' : 'grass')),
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 1, y: 5 },
          ...Array.from({ length: 16 }, (_, i) => ({ key: `c${i}`, type: 'fixture/crop/wheat/ripe', x: i % 4, y: 1 + Math.floor(i / 4) })),
        ],
        event: {},
      },
      onto,
      new RuleLibrary(BASE_RULES),
    )
    eng.world.get('actor')!.facing = 'up'
    expect(act(eng, 'put', 'item/light/torch')).toBe('core/ignite')
    eng.hold('actor')
    wait(eng, 2 * HOURS)
    expect(everywhere(eng, 'fixture/crop/wheat/ripe')).toBe(0)
    expect(everywhere(eng, 'item/material/ash')).toBe(16)
  })

  it('an acorn grows into a tree in two game days', () => {
    const eng = farm(3, {}, 'grass')
    standAt(eng, 1)
    expect(act(eng, 'put', 'item/seed/acorn')).toBe('farm/plant-acorn')
    expect(at(eng, 1)).toEqual(['fixture/crop/oak/sapling'])
    eng.hold('actor')
    wait(eng, 48 * HOURS + 1)
    expect(eng.world.terrainAt(SANDBOX_MAP, 1, 1)).toBe('tree')
    expect(at(eng, 1)).toEqual([])
  })

  it('a felled tree sometimes drops an acorn', () => {
    const eng = farm(20, {}, 'tree')
    let acorns = 0
    for (let x = 0; x < 20; x++) {
      standAt(eng, x)
      act(eng, 'interact', 'item/weapon/blade/axe')
      act(eng, 'interact', 'item/weapon/blade/axe')
      acorns += at(eng, x).filter((t) => t === 'item/seed/acorn').length
    }
    expect(acorns).toBeGreaterThan(0)
    expect(acorns).toBeLessThan(20)
  })
})
