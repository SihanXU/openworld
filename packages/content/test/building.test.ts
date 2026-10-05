// M3: building, played through the same entry point as the player's keys (controls.plan + run).
// The material put on another gives itself to the work (its act emits `receive`); the work
// answers for itself; a tool's blow (`strike`) finishes it or takes it apart.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, SANDBOX_MAP, buildSandbox, textOf, type Engine, type Key } from '@lsw/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const FRONT = { map: SANDBOX_MAP, x: 2, y: 1 }

/** The player at (2,2) facing up at (2,1), where `ground` items lie; `front` terrain there. */
function site(ground: string[] = [], front = 'grass'): Engine {
  const rows = Array.from({ length: 4 }, () => Array(5).fill('grass'))
  rows[1][2] = front
  const eng = buildSandbox(
    { terrain: rows, entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, ...ground.map((type, i) => ({ key: `g${i}`, type, x: 2, y: 1 }))], event: {} },
    onto,
    new RuleLibrary(BASE_RULES),
  )
  eng.world.get('actor')!.facing = 'up'
  return eng
}

/** Put a fresh `type` in the player's hand (whatever was there is gone), as if picked from the toolbar. */
function hold(eng: Engine, type: string): void {
  const w = eng.world
  eng.author(() => {
    const old = w.get(w.player.held)
    if (old) w.destroy(old)
    w.author(() => w.create(type, { on: 'hand', holder: 'actor' }))
  })
  eng.controls.sync()
}

/** Empty the player's hand. */
function emptyHand(eng: Engine): void {
  const w = eng.world
  const old = w.get(w.player.held)
  if (old) eng.author(() => w.destroy(old))
  eng.controls.sync()
}

interface Pressed {
  /** The rules whose outcome was defined, in the order the chain resolved. */
  rules: string[]
  /** The rules whose leaf was undefined (asked of the AI; the default ran). */
  holes: string[]
  /** The input offered the act (taking and putting are offered only where they change something). */
  offered: boolean
}

/** Press a key at the tile in front (holding a fresh `type`, or with an empty hand). */
function press(eng: Engine, key: Key, type?: string): Pressed {
  if (type) hold(eng, type)
  else if (key === 'use' || key === 'put') emptyHand(eng)
  const plan = eng.controls.plan(key)
  eng.trace.length = 0
  if (plan) eng.controls.run(plan, true)
  // an input that would change nothing is not offered (taking and putting are physics): the act itself, as the world answers it
  else if (key === 'put' || key === 'take') {
    const front = eng.world.front(eng.world.player)!
    const target = eng.controls.layers(front)[0]
    if (target) eng.act(key, eng.world.state.player, target, { instrument: key === 'put' ? (eng.world.player.held ? { e: eng.world.player.held } : null) : null })
  }
  return {
    rules: eng.trace.filter((t) => t.defined && t.rule).map((t) => t.rule!),
    holes: eng.trace.filter((t) => !t.defined && t.rule).map((t) => t.rule!),
    offered: !!plan,
  }
}

const here = (eng: Engine) => eng.world.placedAt(FRONT.map, FRONT.x, FRONT.y)
const fixture = (eng: Engine) => here(eng).find((e) => !eng.world.isAgent(e) && !eng.world.isPortable(e))
const count = (eng: Engine, type: string) => here(eng).filter((e) => e.type === type).length
const said = (eng: Engine) => eng.world.fx.flatMap((f) => (f.t === 'say' || f.t === 'log' ? [textOf(f.text)] : []))
const heldType = (eng: Engine) => eng.world.get(eng.world.player.held)?.type

const PLANK = 'item/material/plank'
const HAMMER = 'item/tool/smith_hammer'
const AXE = 'item/weapon/blade/axe'

describe('a chest from a frame', () => {
  it('counts planks into a frame, reports progress, and a hammer makes a chest', () => {
    const eng = site([PLANK])
    expect(press(eng, 'put', PLANK)).toMatchObject({ rules: expect.arrayContaining(['build/plank-to-plank', 'build/start-frame']), holes: [] })
    expect(fixture(eng)?.type).toBe('fixture/build/frame')
    expect(heldType(eng)).toBeUndefined() // the plank gave itself to the work
    expect(press(eng, 'put', PLANK).rules).toEqual(expect.arrayContaining(['build/plank-to-frame', 'build/frame']))
    expect(said(eng)).toContain('A frame of 3 planks.')
    expect(press(eng, 'hands').rules).toContain('build/read-frame')
    expect(said(eng)).toContain('A frame of 3 planks. One more makes a chest.')
    // a hammer on a frame of three: one more plank
    const early = press(eng, 'use', HAMMER)
    expect(early).toMatchObject({ rules: expect.arrayContaining(['use/hammer', 'build/frame']), holes: [] })
    expect(said(eng)).toContain('One more plank.')
    expect(fixture(eng)?.type).toBe('fixture/build/frame')
    expect(press(eng, 'put', PLANK).rules).toContain('build/plank-to-frame')
    expect(eng.world.num(fixture(eng)!, 'planks')).toBe(4)
    // a full frame takes no more: the plank stays in hand, and that is the frame's own answer
    const full = press(eng, 'put', PLANK)
    expect(heldType(eng)).toBe(PLANK)
    expect(eng.world.num(fixture(eng)!, 'planks')).toBe(4)
    expect(full.holes).toEqual([])
    expect(press(eng, 'use', HAMMER).rules).toContain('build/frame')
    const chest = fixture(eng)!
    expect(chest.type).toBe('fixture/container/chest')
    expect(eng.world.num(chest, 'capacity')).toBe(12)
    expect(press(eng, 'hands').rules).toContain('core/open-close')
    expect(eng.world.hasStatus({ e: chest.id }, 'open')).toBe(true)
    expect(press(eng, 'put', 'item/food/apple').rules).toContain('core/receive-store')
    expect(chest.contents?.map((id) => eng.world.get(id)!.type)).toEqual(['item/food/apple'])
  })

  it('a hammer on a frame of two makes a crate', () => {
    const eng = site([PLANK])
    press(eng, 'put', PLANK)
    expect(press(eng, 'use', HAMMER).rules).toContain('build/frame')
    expect(fixture(eng)?.type).toBe('fixture/container/crate')
  })

  it('an axe takes a frame apart into its planks', () => {
    const eng = site([PLANK])
    press(eng, 'put', PLANK)
    press(eng, 'put', PLANK)
    expect(press(eng, 'use', AXE)).toMatchObject({ rules: expect.arrayContaining(['use/blade', 'build/unframe']), holes: [] })
    expect(fixture(eng)).toBeUndefined()
    expect(count(eng, PLANK)).toBe(3)
  })

  it('an axe breaks up a chest: its contents spill and two planks come back; a locked one is not taken apart, only worn', () => {
    const eng = site([PLANK])
    press(eng, 'put', PLANK)
    press(eng, 'put', PLANK)
    press(eng, 'put', PLANK)
    press(eng, 'use', HAMMER)
    press(eng, 'hands') // open
    press(eng, 'put', 'item/food/apple')
    expect(press(eng, 'use', AXE).rules).toContain('build/dismantle-chest')
    expect(fixture(eng)).toBeUndefined()
    expect(count(eng, PLANK)).toBe(2)
    expect(count(eng, 'item/food/apple')).toBe(1)

    const locked = buildSandbox(
      {
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
          { key: 'chest', type: 'fixture/container/chest', x: 2, y: 1, tags: ['locked'] },
        ],
        event: {},
      },
      onto,
      new RuleLibrary(BASE_RULES),
    )
    locked.world.get('actor')!.facing = 'up'
    // a locked chest is not taken apart: a blow on it only wears it (its durability, world-model.md §6.3)
    const r = press(locked, 'use', AXE)
    expect(r.rules).not.toContain('build/dismantle-chest')
    expect(r.rules).toContain('core/strike')
    expect(r.holes).toEqual([])
    const chest = locked.world.get('chest')!
    expect(locked.world.num(chest, 'hp')).toBeLessThan(locked.world.num(chest, 'maxHp'))
  })
})

describe('the same pattern', () => {
  it('stakes make a fence', () => {
    const eng = site(['item/material/stick'])
    expect(press(eng, 'put', 'item/material/stick').rules).toEqual(expect.arrayContaining(['build/stick-to-stick', 'build/stakes']))
    expect(fixture(eng)?.type).toBe('fixture/build/stakes')
    expect(press(eng, 'use', HAMMER).rules).toContain('build/fence')
    expect(fixture(eng)?.type).toBe('fixture/fence')
  })

  it('a ring of stones and two sticks make a campfire that lights', () => {
    const eng = site(['item/material/stone'])
    expect(press(eng, 'put', 'item/material/stone').rules).toEqual(expect.arrayContaining(['build/stone-to-stone', 'build/ring']))
    expect(press(eng, 'put', 'item/material/stick').rules).toEqual(expect.arrayContaining(['build/stick-to-ring', 'build/ring-stick']))
    expect(fixture(eng)?.type).toBe('fixture/build/ring')
    expect(press(eng, 'put', 'item/material/stick').rules).toContain('build/ring-stick')
    const fire = fixture(eng)!
    expect(fire.type).toBe('fixture/light/campfire')
    expect(press(eng, 'use', 'item/light/torch').rules).toEqual(expect.arrayContaining(['use/fire', 'core/element']))
    expect(eng.world.hasStatus({ e: fire.id }, 'lit')).toBe(true)
  })

  it('a pickaxe takes a ring apart into its stones and sticks', () => {
    const eng = site(['item/material/stone'])
    press(eng, 'put', 'item/material/stone')
    press(eng, 'put', 'item/material/stick')
    expect(press(eng, 'use', 'item/tool/pickaxe').rules).toContain('build/unring')
    expect(fixture(eng)).toBeUndefined()
    expect([count(eng, 'item/material/stone'), count(eng, 'item/material/stick')]).toEqual([2, 1])
  })

  it('planks bridge shallow water, not deep water', () => {
    const eng = site([], 'water')
    expect(press(eng, 'put', PLANK).rules).toEqual(expect.arrayContaining(['build/plank-on-water', 'water/bridge']))
    expect(eng.world.terrainAt(FRONT.map, FRONT.x, FRONT.y)).toBe('bridge')
    const deep = site([], 'deepwater')
    expect(press(deep, 'put', PLANK)).toMatchObject({ rules: expect.arrayContaining(['core/receive-water']), offered: false })
    expect(deep.world.terrainAt(FRONT.map, FRONT.x, FRONT.y)).toBe('deepwater')
    expect(heldType(deep)).toBe(PLANK) // nothing is lost
  })

  it('a sign is built blank and written with a quill while carrying ink', () => {
    const eng = site(['item/material/stick'])
    expect(press(eng, 'put', PLANK).rules).toEqual(expect.arrayContaining(['build/plank-to-stick', 'build/post']))
    expect(press(eng, 'use', HAMMER).rules).toContain('build/sign')
    const sign = fixture(eng)!
    expect(sign.type).toBe('fixture/sign')
    expect(press(eng, 'hands').rules).toContain('build/write-sign')
    expect(said(eng)).toContain('It is blank.')
    // a quill without ink writes nothing (the sign is only read)
    expect(press(eng, 'use', 'item/misc/feather_quill').rules).not.toContain('build/write-sign')
    expect(eng.world.hasTag(sign, 'blank')).toBe(true)
    eng.author(() => eng.world.create('item/misc/ink', { on: 'inside', holder: 'actor' }))
    expect(press(eng, 'use', 'item/misc/feather_quill').rules).toContain('build/write-sign')
    expect(eng.world.hasTag(sign, 'blank')).toBe(false)
    expect(eng.world.hasTag(sign, 'handmade')).toBe(true)
    expect(press(eng, 'hands').rules).toContain('build/read-handmade')
    expect(said(eng)).toContain('Made by hand.')
  })
})

describe('a house', () => {
  /** A meadow of 7 × 7, the player in its middle. */
  function meadow(): Engine {
    const rows = Array.from({ length: 7 }, () => Array(7).fill('grass'))
    const eng = buildSandbox({ terrain: rows, entities: [{ key: 'actor', type: 'actor/person/player', x: 3, y: 3 }], event: {} }, onto, new RuleLibrary(BASE_RULES))
    eng.world.get('actor')!.facing = 'up'
    return eng
  }
  const put = (eng: Engine, type: string, x: number, y: number) => {
    hold(eng, type)
    const plan = eng.controls.plan('put', { x, y })
    expect(plan, `put ${type} at ${x},${y}`).toBeDefined()
    eng.controls.run(plan!)
    eng.tick()
  }
  const rooms = (eng: Engine) => eng.world.roomsOf(SANDBOX_MAP)

  it('walls, a door and a floor over them make a room round oneself; a bed makes it a bedroom; the door opens and shuts, and the room stays', () => {
    const eng = meadow()
    const w = eng.world
    put(eng, 'fixture/furniture/bed', 3, 3)
    for (const [x, y] of [[3, 2], [2, 3], [4, 3]] as const) put(eng, 'structure/wall', x, y)
    put(eng, 'structure/door', 3, 4)
    put(eng, 'structure/floor', 3, 3)
    expect(w.covered(SANDBOX_MAP, 3, 3)).toBe(true)
    expect(rooms(eng).map((r) => r.tags)).toEqual([['role:bedroom']])
    // E on the door opens it (it was shut: nothing passed), and one walks out through it
    const door = () => w.placedAt(SANDBOX_MAP, 3, 4).find((e) => e.type.startsWith('structure/door'))!
    expect(door().type).toBe('structure/door')
    const open = eng.controls.plan('hands', { x: 3, y: 4 })!
    expect(textOf(open.label)).toBe('Open Door')
    eng.controls.run(open)
    eng.tick()
    expect(door().type).toBe('structure/door/open')
    expect(rooms(eng)).toHaveLength(1)
    for (let i = 0; i < 2; i++) {
      eng.movePlayer('down')
      for (let t = 0; t < 8; t++) eng.tick()
    }
    expect(w.posOf(w.player)).toMatchObject({ x: 3, y: 5 })
    // and shuts it behind
    w.player.facing = 'up'
    eng.controls.run(eng.controls.plan('hands', { x: 3, y: 4 })!)
    eng.tick()
    expect(door().type).toBe('structure/door')
    expect(w.walkable(SANDBOX_MAP, 3, 4)).toBe(false)
  })
})

describe('the build palette (B): setting things down', () => {
  function meadow(): Engine {
    const rows = Array.from({ length: 7 }, () => Array(7).fill('grass'))
    const eng = buildSandbox({ terrain: rows, entities: [{ key: 'actor', type: 'actor/person/player', x: 3, y: 3 }], event: {} }, onto, new RuleLibrary(BASE_RULES))
    eng.world.get('actor')!.facing = 'up'
    return eng
  }
  const give = (eng: Engine, type: string, n = 1) => eng.author(() => { for (let i = 0; i < n; i++) eng.world.create(type, { on: 'inside', holder: 'actor' }) })
  const at = (eng: Engine, x: number, y: number) => eng.world.placedAt(SANDBOX_MAP, x, y).map((e) => e.type)

  it('a wall carried is set down as G sets it; with none carried, one is made from planks first; out of reach, nothing', () => {
    const eng = meadow()
    const c = eng.controls
    give(eng, 'structure/wall')
    give(eng, 'item/material/plank', 3)
    c.sync()
    expect(c.previewPlace('structure/wall', { x: 3, y: 2 })).toMatchObject({ ok: true, carried: 1 })
    expect(c.place('structure/wall', { x: 3, y: 2 })).toBe(true)
    expect(at(eng, 3, 2)).toEqual(['structure/wall'])
    // none carried: made from two of the planks, then set down
    expect(c.previewPlace('structure/wall', { x: 2, y: 3 })).toMatchObject({ ok: true, carried: 0 })
    expect(c.place('structure/wall', { x: 2, y: 3 })).toBe(true)
    expect(at(eng, 2, 3)).toEqual(['structure/wall'])
    expect(c.count('item/material/plank')).toBe(1)
    // one plank makes no wall
    expect(c.previewPlace('structure/wall', { x: 4, y: 3 }).ok).toBe(false)
    // a cell beyond reach is not one nearer: nothing is set down
    give(eng, 'structure/wall')
    c.sync()
    expect(c.place('structure/wall', { x: 3, y: 0 })).toBe(false)
    expect(at(eng, 3, 0)).toEqual([])
    expect(at(eng, 3, 1)).toEqual([])
  })

  it('a workbench is made by hand from four planks and set down; what is made at a workbench is made beside it', () => {
    const eng = meadow()
    const c = eng.controls
    give(eng, 'item/material/plank', 4)
    give(eng, 'item/material/stick', 2)
    give(eng, 'item/material/grass', 3)
    c.sync()
    expect(c.place('fixture/craft/workbench', { x: 3, y: 2 })).toBe(true)
    expect(at(eng, 3, 2)).toEqual(['fixture/craft/workbench'])
    expect(c.craft(eng.recipes.get('item/weapon/ranged/bow')!)).toBe(true)
    expect(c.count('item/weapon/ranged/bow')).toBe(1)
  })
})
