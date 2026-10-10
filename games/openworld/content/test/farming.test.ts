// M4: farming, played through the same entry point as the player's keys (controls.plan + run).
// A seed's own act sows it; water reaches a crop as an element; a sickle's blow (`strike`) is
// answered by the ripe crop; a hand takes (`taken`) what it picks.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, SANDBOX_MAP, buildSandbox, type Engine, type Key } from '@openworld/engine'
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

/** The player walks to (x,2) (an act of moving), still facing up. */
const standAt = (eng: Engine, x: number) => {
  eng.relocate(eng.world.get('actor')!, { map: SANDBOX_MAP, x, y: 2 })
  eng.world.get('actor')!.facing = 'up'
}
/** Put a fresh `type` in the player's hand (whatever was there is gone), as if picked from the toolbar. */
const hold = (eng: Engine, type: string) => {
  const w = eng.world
  eng.author(() => {
    const old = w.get(w.player.held)
    if (old) w.destroy(old)
    w.author(() => w.create(type, { on: 'hand', holder: 'actor' }))
  })
  eng.controls.sync()
}
/** Empty the player's hand (what it held is gone, so the toolbar keeps no slot for it). */
const stow = (eng: Engine) => {
  const w = eng.world
  const h = w.get(w.player.held)
  if (h) eng.author(() => w.destroy(h))
  eng.controls.sync()
}

/** Press a key at the tile in front, holding a fresh `type`; the rules the chain resolved to (defined ones). */
const press = (eng: Engine, key: Key, type?: string): string[] => {
  if (type) hold(eng, type)
  const plan = eng.controls.plan(key)
  eng.trace.length = 0
  if (plan) eng.controls.run(plan, true)
  return eng.trace.filter((t) => t.defined && t.rule).map((t) => t.rule!)
}
const wait = (eng: Engine, ticks: number) => {
  for (let i = 0; i < ticks; i++) eng.tick()
}
const at = (eng: Engine, x: number, y = 1) => eng.world.placedAt(SANDBOX_MAP, x, y).map((e) => e.type)
const everywhere = (eng: Engine, type: string) => Object.values(eng.world.state.entities).filter((e) => e.type === type).length

const SEED = 'item/seed/wheat'
const WATER = 'item/vessel/bucket/water'
const SICKLE = 'item/tool/sickle'

describe('a season', () => {
  it('four seeds become eight within a game day', () => {
    const eng = farm(4)
    for (let x = 0; x < 4; x++) {
      standAt(eng, x)
      expect(press(eng, 'put', SEED)).toContain('farm/sow-put')
    }
    expect(at(eng, 2)).toEqual(['fixture/crop/wheat/sprout'])
    for (const stage of ['young', 'ripe']) {
      for (let x = 0; x < 4; x++) {
        standAt(eng, x)
        expect(press(eng, 'use', WATER)).toEqual(expect.arrayContaining(['use/water', 'farm/water']))
      }
      stow(eng)
      wait(eng, 2 * HOURS + 1)
      expect(at(eng, 0)).toEqual([`fixture/crop/wheat/${stage}`])
    }
    for (let x = 0; x < 4; x++) {
      standAt(eng, x)
      expect(press(eng, 'use', SICKLE)).toEqual(expect.arrayContaining(['use/sickle', 'farm/harvest']))
    }
    expect(everywhere(eng, SEED)).toBe(8)
    expect(everywhere(eng, 'item/material/wheat')).toBe(8)
    expect(eng.world.state.tick).toBeLessThan(24 * HOURS)
  })

  it('a crop only grows when watered, and only one stage per watering', () => {
    const eng = farm(1, { 0: 'fixture/crop/wheat/sprout' })
    wait(eng, 24 * HOURS)
    expect(at(eng, 0)).toEqual(['fixture/crop/wheat/sprout'])
    expect(press(eng, 'use', WATER)).toContain('farm/water')
    // watered already: the water only splashes it
    const again = press(eng, 'use', WATER)
    expect(again).toContain('core/element')
    expect(again).not.toContain('farm/water')
    stow(eng)
    wait(eng, 24 * HOURS)
    expect(at(eng, 0)).toEqual(['fixture/crop/wheat/young'])
  })

  it('picking by hand gives one of each; ash adds one to a sickle harvest', () => {
    const picked = farm(1, { 0: 'fixture/crop/wheat/ripe' })
    expect(press(picked, 'take')).toEqual(expect.arrayContaining(['core/take', 'farm/pick']))
    expect(picked.world.get(picked.world.get('actor')!.held)?.type).toBe('item/material/wheat')
    expect(at(picked, 0)).toEqual([SEED])

    const rich = farm(1, { 0: 'fixture/crop/wheat/young' })
    expect(press(rich, 'put', 'item/material/ash')).toEqual(expect.arrayContaining(['farm/ash-put', 'farm/fertilize']))
    expect(rich.world.hasStatus({ e: 'c0' }, 'fertilized')).toBe(true)
    press(rich, 'use', WATER)
    stow(rich)
    wait(rich, 2 * HOURS + 1)
    expect(press(rich, 'use', SICKLE)).toContain('farm/harvest')
    expect(everywhere(rich, 'item/material/wheat')).toBe(3)
  })

  it('a berry bush bears again after picking', () => {
    const eng = farm(1, { 0: 'fixture/crop/berry/ripe' })
    expect(press(eng, 'take')).toContain('farm/pick')
    expect(eng.world.get(eng.world.get('actor')!.held)?.type).toBe('item/food/berries')
    expect(at(eng, 0)).toContain('fixture/crop/berry/young')
  })

  it('a shovel lifts a plant and gives back its seed', () => {
    const eng = farm(1, { 0: 'fixture/crop/herb/young' })
    expect(press(eng, 'use', 'item/tool/shovel')).toEqual(expect.arrayContaining(['use/shovel', 'farm/dig-up']))
    expect(at(eng, 0)).toEqual(['item/seed/herb'])
  })

  it('ash and the stall\'s fertilizer each say what was worked into the soil', () => {
    for (const [type, zh] of [['item/material/ash', '灰烬'], ['item/material/fertilizer', '肥料']] as const) {
      const eng = farm(1, { 0: 'fixture/crop/wheat/young' })
      eng.world.fx.length = 0
      press(eng, 'use', type)
      expect(eng.world.hasStatus({ e: 'c0' }, 'fertilized'), type).toBe(true)
      expect(eng.world.fx.some((f) => f.t === 'log' && JSON.stringify(f.text).includes(zh)), type).toBe(true)
    }
  })
})

describe('fire and trees', () => {
  it('a torch held to ripe wheat costs the harvest and leaves ash', () => {
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
    expect(press(eng, 'use', 'item/light/torch')).toEqual(expect.arrayContaining(['use/fire', 'core/element']))
    expect(eng.world.hasStatus({ e: 'c13' }, 'burning')).toBe(true)
    stow(eng)
    wait(eng, 2 * HOURS)
    expect(everywhere(eng, 'fixture/crop/wheat/ripe')).toBe(0)
    expect(everywhere(eng, 'item/material/ash')).toBe(16)
  })

  it('an acorn grows into a tree in two game days', () => {
    const eng = farm(3, {}, 'grass')
    standAt(eng, 1)
    expect(press(eng, 'put', 'item/seed/acorn')).toContain('farm/plant-acorn-put')
    expect(at(eng, 1)).toEqual(['fixture/crop/oak/sapling'])
    stow(eng)
    wait(eng, 48 * HOURS + 1)
    expect(eng.world.terrainAt(SANDBOX_MAP, 1, 1)).toBe('tree')
    expect(at(eng, 1)).toEqual([])
  })

  it('a felled tree sometimes drops an acorn', () => {
    const eng = farm(20, {}, 'tree')
    let acorns = 0
    for (let x = 0; x < 20; x++) {
      standAt(eng, x)
      press(eng, 'use', 'item/weapon/blade/axe')
      expect(press(eng, 'use', 'item/weapon/blade/axe')).toContain('wood/fell')
      expect(eng.world.terrainAt(SANDBOX_MAP, x, 1)).toBe('stump')
      acorns += at(eng, x).filter((t) => t === 'item/seed/acorn').length
    }
    expect(acorns).toBeGreaterThan(0)
    expect(acorns).toBeLessThan(20)
  })
})
