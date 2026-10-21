// M4: farming, played through the same entry point as the player's keys (controls.plan + run).
// A seed's own act sows it; water reaches a crop as an element; a sickle's blow (`strike`) is
// answered by the ripe crop; a hand takes (`taken`) what it picks.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, SANDBOX_MAP, buildSandbox, type Engine, type Key } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'
import GAME from '../src/game.ts'

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
      expect(press(eng, 'use', SEED)).toContain('farm/sow')
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
    expect(press(picked, 'hands')).toEqual(expect.arrayContaining(['core/hands', 'farm/pick']))
    expect(picked.world.get(picked.world.get('actor')!.held)?.type).toBe('item/material/wheat')
    expect(at(picked, 0)).toEqual([SEED])

    const rich = farm(1, { 0: 'fixture/crop/wheat/young' })
    expect(press(rich, 'use', 'item/material/ash')).toEqual(expect.arrayContaining(['farm/ash', 'farm/fertilize']))
    expect(rich.world.hasStatus({ e: 'c0' }, 'fertilized')).toBe(true)
    press(rich, 'use', WATER)
    stow(rich)
    wait(rich, 2 * HOURS + 1)
    expect(press(rich, 'use', SICKLE)).toContain('farm/harvest')
    expect(everywhere(rich, 'item/material/wheat')).toBe(3)
  })

  it('a berry bush bears again after picking', () => {
    const eng = farm(1, { 0: 'fixture/crop/berry/ripe' })
    expect(press(eng, 'hands')).toContain('farm/pick')
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
    expect(press(eng, 'use', 'item/seed/acorn')).toContain('farm/plant-acorn')
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

describe('crop timing and retained water', () => {
  it.each([['turnip', 600], ['carrot', 1200], ['pumpkin', 2400]] as const)('%s takes its own full stage after watering', (id, duration) => {
    const eng = farm(1, { 0: `fixture/crop/${id}/sprout` })
    // A dry plant's time before watering does not count as growth.
    wait(eng, 300)
    press(eng, 'use', WATER)
    stow(eng)
    wait(eng, duration - 1)
    expect(at(eng, 0)).toEqual([`fixture/crop/${id}/sprout`])
    wait(eng, 2)
    expect(at(eng, 0)).toEqual([`fixture/crop/${id}/young`])
    wait(eng, duration + 1)
    expect(at(eng, 0)).toEqual([`fixture/crop/${id}/young`])
  })

  it('irrigation saves a second watering without delaying either stage', () => {
    for (const irrigated of [false, true]) {
      const eng = farm(1, { 0: 'fixture/crop/carrot/sprout' })
      if (irrigated) eng.author(() => eng.world.addTag(eng.world.player, 'skill:irrigation'))
      press(eng, 'use', WATER)
      stow(eng)
      wait(eng, 1201)
      expect(at(eng, 0), String(irrigated)).toEqual(['fixture/crop/carrot/young'])
      wait(eng, 1200)
      expect(at(eng, 0), String(irrigated)).toEqual([`fixture/crop/carrot/${irrigated ? 'ripe' : 'young'}`])
    }
  })

  it('a sprinkler respects each neighbouring crop and shares irrigation', () => {
    const eng = farm(3, { 0: 'fixture/crop/turnip/sprout', 1: 'fixture/crop/carrot/sprout', 2: 'fixture/crop/pumpkin/sprout' })
    eng.author(() => {
      eng.world.addTag(eng.world.player, 'skill:irrigation')
      eng.world.addTag(eng.world.player, 'skill:sprinkler')
    })
    standAt(eng, 1)
    press(eng, 'use', WATER)
    stow(eng)
    wait(eng, 1201)
    expect(at(eng, 0)).toEqual(['fixture/crop/turnip/ripe'])
    expect(at(eng, 1)).toEqual(['fixture/crop/carrot/young'])
    expect(at(eng, 2)).toEqual(['fixture/crop/pumpkin/sprout'])
    wait(eng, 3600)
    expect(at(eng, 2)).toEqual(['fixture/crop/pumpkin/ripe'])
  })

  it('irrigating the last stage leaves no water to reuse after a perennial harvest', () => {
    const eng = farm(1, { 0: 'fixture/crop/tomato/young' })
    eng.author(() => eng.world.addTag(eng.world.player, 'skill:irrigation'))
    press(eng, 'use', WATER)
    stow(eng)
    wait(eng, 1201)
    expect(at(eng, 0)).toEqual(['fixture/crop/tomato/ripe'])
    press(eng, 'hands')
    stow(eng)
    wait(eng, 2401)
    expect(at(eng, 0)).toContain('fixture/crop/tomato/young')
  })

  it('retained water catches up both elapsed stages on returning to a dormant crop', () => {
    const eng = farm(1, { 0: 'fixture/crop/carrot/sprout' })
    eng.author(() => eng.world.addTag(eng.world.player, 'skill:irrigation'))
    press(eng, 'use', WATER)
    stow(eng)
    // A dormant map receives the elapsed world time on return; both deadlines have already passed.
    eng.author(() => { eng.world.state.tick += 2405 })
    wait(eng, 2)
    expect(at(eng, 0)).toEqual(['fixture/crop/carrot/ripe'])
    expect(eng.world.hasStatus({ e: 'c0' }, 'watered')).toBe(false)
  })

  it('upgrading a finite watering clock preserves its deadline and other saved progress', () => {
    const eng = farm(1, { 0: 'fixture/crop/pumpkin/sprout' })
    const w = eng.world
    eng.author(() => {
      w.setStatus({ e: 'c0' }, 'watered', 700)
      w.clearStatus({ e: 'c0' }, 'stage')
      w.create('item/tool/fishing_rod', { on: 'inside', holder: 'actor' }, { props: { bait: 3 } })
      w.setFact('haven.zone.lake', 1)
      GAME.upgradeSave!(eng)
    })
    expect(w.get('c0')?.statuses?.stage).toBe(700)
    expect(w.get('c0')?.statuses?.watered).toBe(-1)
    wait(eng, 701)
    expect(at(eng, 0)).toEqual(['fixture/crop/pumpkin/young'])
    expect(w.fact('haven.zone.lake')).toBe(1)
    expect(Object.values(w.state.entities).find((e) => e.type === 'item/tool/fishing_rod')?.props?.bait).toBe(3)
    const before = structuredClone(w.get('c0'))
    eng.author(() => GAME.upgradeSave!(eng))
    expect(w.get('c0')).toEqual(before)
  })
})
