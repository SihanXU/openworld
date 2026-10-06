// M3: building, played through the same entry point as the player's keys (controls.plan + run).
// The material put on another gives itself to the work (its act emits `receive`); the work
// answers for itself; a tool's blow (`strike`) finishes it or takes it apart.

import { describe, expect, it } from 'vitest'
import { CEILING, RuleLibrary, SANDBOX_MAP, buildSandbox, textOf, type Engine, type Key } from '@lsw/engine'
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
  const put = (eng: Engine, type: string, x: number, y: number, layer = 0) => {
    hold(eng, type)
    const plan = eng.controls.plan('put', { x, y }, layer)
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
    // the ceiling, chosen: laid over the walls, the floor of the storey above
    put(eng, 'structure/floor', 3, 3, CEILING)
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

describe('storeys: what one reaches, and where a thing goes (docs/building.md §6)', () => {
  /** A meadow of 8 × 8 with shallow water at (5,4), the player at (3,4) facing up. */
  function meadow(): Engine {
    const rows = Array.from({ length: 8 }, () => Array(8).fill('grass'))
    rows[4][5] = 'water'
    const eng = buildSandbox({ terrain: rows, entities: [{ key: 'actor', type: 'actor/person/player', x: 3, y: 4 }], event: {} }, onto, new RuleLibrary(BASE_RULES))
    eng.world.get('actor')!.facing = 'up'
    return eng
  }
  const give = (eng: Engine, type: string, n = 1) => eng.author(() => { for (let i = 0; i < n; i++) eng.world.create(type, { on: 'inside', holder: 'actor' }) })
  const storeys = (eng: Engine, x: number, y: number) => [0, 1, 2, 3].map((z) => eng.world.placedAt(SANDBOX_MAP, x, y, z).filter((e) => e.type.startsWith('structure') || e.type.startsWith('fixture')).map((e) => e.type.split('/').slice(1).join('/')))
  const stand = (eng: Engine, x: number, y: number, z = 0) => eng.author(() => eng.world.place(eng.world.player, { on: 'tile', map: SANDBOX_MAP, x, y, ...(z && { z }) }))
  /** Built by the author's hand (the world as it is), not through the inputs under test. */
  const build = (eng: Engine, type: string, x: number, y: number, z = 0) => eng.author(() => eng.world.create(type, { on: 'tile', map: SANDBOX_MAP, x, y, ...(z && { z }) }))
  const walk = (eng: Engine, dir: 'up' | 'down' | 'left' | 'right') => {
    eng.movePlayer(dir)
    for (let i = 0; i < 8; i++) eng.tick()
    return eng.world.posOf(eng.world.player)!
  }
  const take = (eng: Engine, x: number, y: number, layer = 0) => {
    const plan = eng.controls.plan('take', { x, y }, layer)
    if (plan) eng.controls.run(plan)
    eng.tick()
    return plan
  }
  const why = (eng: Engine, type: string, x: number, y: number, up = false) => textOf(eng.controls.previewPlace(type, { x, y }, up).reason)

  it('6.1 a floor on the ground covers it: laid again there is one already; not on water; under what stands there; taken, the ground shows again', () => {
    const eng = meadow()
    const w = eng.world
    give(eng, 'structure/floor', 3)
    give(eng, 'fixture/furniture/bed')
    eng.controls.sync()
    // laid on the grass: on the ground's own storey, never a storey up
    expect(eng.controls.place('structure/floor', { x: 3, y: 3 })).toBe(true)
    expect(storeys(eng, 3, 3)).toEqual([['floor'], [], [], []])
    expect(w.cellTop(SANDBOX_MAP, 3, 3)?.type).toBe('structure/floor')
    // laid again: there is one already (it does not climb)
    expect(eng.controls.previewPlace('structure/floor', { x: 3, y: 3 }).ok).toBe(false)
    expect(why(eng, 'structure/floor', 3, 3)).toBe('There is a floor there already.')
    // water is no ground to lay one on
    stand(eng, 4, 4)
    expect(why(eng, 'structure/floor', 5, 4)).toBe('A floor cannot be laid on this ground.')
    // under a bed already standing there: the bed now stands on it
    expect(eng.controls.place('fixture/furniture/bed', { x: 4, y: 3 })).toBe(true)
    expect(eng.controls.place('structure/floor', { x: 4, y: 3 })).toBe(true)
    expect(storeys(eng, 4, 3)[0].sort()).toEqual(['floor', 'furniture/bed'])
    // taken: F meets the bed first; the floor under it is the chooser's; taken, the bed stays
    const bed = w.placedAt(SANDBOX_MAP, 4, 3).find((e) => e.type === 'fixture/furniture/bed')!
    expect(eng.controls.plan('take', { x: 4, y: 3 })?.target.e).toBe(bed.id)
    const layer = eng.controls.choices('take', { x: 4, y: 3 }).find((c) => w.get(c.plan!.target.e)?.type === 'structure/floor')!.layer
    take(eng, 4, 3, layer)
    expect(storeys(eng, 4, 3)).toEqual([['furniture/bed'], [], [], []])
    // and the floor on the grass taken: the grass again
    stand(eng, 3, 4)
    take(eng, 3, 3)
    expect(storeys(eng, 3, 3)).toEqual([[], [], [], []])
    expect(w.cellTop(SANDBOX_MAP, 3, 3)?.type).toBe('tile/grass')
  })

  it('6.1 the ceiling: laid from below only when chosen, held by the walls within reach, never over stairs; a floor put without choosing stays on one\'s storey', () => {
    const eng = meadow()
    give(eng, 'structure/floor', 4)
    eng.controls.sync()
    build(eng, 'structure/wall', 3, 3)
    // chosen: the ceiling over the wall (the floor of the storey above), held by it
    expect(eng.controls.previewPlace('structure/floor', { x: 3, y: 3 }, true)).toMatchObject({ ok: true, reason: { en: 'Lay the ceiling' } })
    expect(eng.controls.place('structure/floor', { x: 3, y: 3 }, undefined, true)).toBe(true)
    expect(storeys(eng, 3, 3)).toEqual([['wall'], ['floor'], [], []])
    // over the cell one stands in too
    expect(eng.controls.place('structure/floor', { x: 3, y: 4 }, undefined, true)).toBe(true)
    expect(storeys(eng, 3, 4)).toEqual([[], ['floor'], [], []])
    // not chosen: a floor stays on one's own storey (on the grass)
    expect(eng.controls.place('structure/floor', { x: 2, y: 3 })).toBe(true)
    expect(storeys(eng, 2, 3)).toEqual([['floor'], [], [], []])
    // nothing to hold it: a wall's reach is two cells
    eng.author(() => eng.world.destroy(eng.world.placedAt(SANDBOX_MAP, 3, 3).find((e) => e.type === 'structure/wall')!))
    build(eng, 'structure/wall', 0, 0)
    stand(eng, 6, 6)
    expect(why(eng, 'structure/floor', 6, 5, true)).toBe('Nothing would hold it up.')
    // stairs keep the storey over them open
    build(eng, 'structure/wall', 6, 4)
    const st = build(eng, 'structure/stairs', 6, 5)
    st.facing = 'up'
    expect(why(eng, 'structure/floor', 6, 5, true)).toBe('Stairs keep the storey over them open.')
    // the long press offers the ceiling, last; never a default
    hold(eng, 'structure/floor')
    const list = eng.controls.choices('put', { x: 7, y: 6 })
    expect(list.at(-1)).toMatchObject({ layer: CEILING, name: { en: 'The ceiling' } })
    expect(eng.controls.plan('put', { x: 7, y: 6 })?.target.e).not.toBe(list.at(-1)!.plan!.target.e)
  })

  it('5 the ceiling chosen is the one drawn at the point (the view says which, as `over`): laid and taken there', () => {
    const eng = meadow()
    build(eng, 'structure/wall', 3, 2)
    hold(eng, 'structure/floor')
    // the pointer on the row above the player's cell: the ceiling drawn there is the one over (3,4)
    const aim = { x: 3, y: 3, over: { x: 3, y: 4 } }
    expect(eng.controls.choices('put', aim).at(-1)).toMatchObject({ layer: CEILING })
    eng.controls.run(eng.controls.plan('put', aim, CEILING)!)
    eng.tick()
    expect(storeys(eng, 3, 4)).toEqual([[], ['floor'], [], []])
    expect(storeys(eng, 3, 3)).toEqual([[], [], [], []])
    take(eng, 3, 3, CEILING)
    expect(storeys(eng, 3, 4)).toEqual([[], ['floor'], [], []])
    eng.controls.run(eng.controls.plan('take', aim, CEILING)!)
    eng.tick()
    expect(storeys(eng, 3, 4)).toEqual([[], [], [], []])
  })

  it('6.3 the ceiling is taken down from below only when chosen, and not while something rests on it', () => {
    const eng = meadow()
    const w = eng.world
    build(eng, 'structure/wall', 3, 3)
    build(eng, 'structure/floor', 3, 3, 1)
    // F meets the wall; the ceiling is the chooser's, last
    expect(w.get(eng.controls.plan('take', { x: 3, y: 3 })!.target.e)?.type).toBe('structure/wall')
    expect(eng.controls.choices('take', { x: 3, y: 3 }).at(-1)).toMatchObject({ layer: CEILING })
    // something on it upstairs (a bed): not offered
    const bed = build(eng, 'fixture/furniture/bed', 3, 3, 1)
    expect(eng.controls.plan('take', { x: 3, y: 3 }, CEILING)).toBeUndefined()
    eng.author(() => w.destroy(bed))
    take(eng, 3, 3, CEILING)
    expect(storeys(eng, 3, 3)).toEqual([['wall'], [], [], []])
  })

  it('6.1–6.4 upstairs one reaches one\'s own storey: a floor laid into the open air where walls hold it, a wall set on the wall below; nothing of the storey below; E never meets the air', () => {
    const eng = meadow()
    const w = eng.world
    build(eng, 'structure/wall', 3, 3)
    build(eng, 'structure/wall', 4, 3)
    build(eng, 'structure/floor', 3, 3, 1)
    const chest = build(eng, 'fixture/container/chest', 2, 3)
    give(eng, 'structure/floor', 3)
    give(eng, 'structure/wall', 2)
    eng.controls.sync()
    stand(eng, 3, 3, 1)
    // the open air beside: a floor laid there, held by the wall under its neighbour
    expect(eng.controls.place('structure/floor', { x: 3, y: 2 })).toBe(true)
    expect(storeys(eng, 3, 2)).toEqual([[], ['floor'], [], []])
    // a wall set on the wall below, in the open air
    expect(eng.controls.place('structure/wall', { x: 4, y: 3 })).toBe(true)
    expect(storeys(eng, 4, 3)).toEqual([['wall'], ['wall'], [], []])
    // over nothing: no wall below, no floor
    expect(why(eng, 'structure/wall', 2, 3)).toBe('Nothing would hold it up.')
    // the storey below is out of reach: the chest at (2,3) is not met; E never meets the open air
    expect(eng.controls.plan('take', { x: 2, y: 3 })).toBeUndefined()
    expect(eng.controls.plan('hands', { x: 2, y: 3 })).toBeUndefined()
    expect(w.posOf(chest)).toMatchObject({ x: 2, y: 3 })
    // farther than the walls hold: from the end of the floor laid out
    build(eng, 'structure/floor', 3, 1, 1)
    stand(eng, 3, 1, 1)
    expect(why(eng, 'structure/floor', 3, 0)).toBe('Nothing would hold it up.')
    // the slab one stands on is not taken (something rests on it: oneself)
    expect(eng.controls.choices('take', { x: 3, y: 1 }).some((c) => w.get(c.plan!.target.e)?.type === 'structure/floor')).toBe(false)
  })

  it('a taller wall is built from the storey above, never set on a wall from below', () => {
    const eng = meadow()
    give(eng, 'structure/wall', 2)
    eng.controls.sync()
    expect(eng.controls.place('structure/wall', { x: 3, y: 3 })).toBe(true)
    expect(why(eng, 'structure/wall', 3, 3)).toBe('Something is there already.')
    expect(eng.controls.place('structure/wall', { x: 3, y: 3 })).toBe(false)
    expect(storeys(eng, 3, 3)).toEqual([['wall'], [], [], []])
    // from upstairs (a floor beside it, held by it)
    build(eng, 'structure/floor', 3, 4, 1)
    stand(eng, 3, 4, 1)
    expect(eng.controls.place('structure/wall', { x: 3, y: 3 })).toBe(true)
    expect(storeys(eng, 3, 3)).toEqual([['wall'], ['wall'], [], []])
  })

  it("stairs are a block one walks onto, then on the way they go up onto the storey above; back down the same way; onto them from the side too", () => {
    const eng = meadow()
    const w = eng.world
    // a platform: a wall at (3,2) with the ceiling laid over it; stairs before it at (3,3) going up north (set from (3,4))
    give(eng, 'structure/wall')
    give(eng, 'structure/floor')
    give(eng, 'structure/stairs')
    eng.controls.sync()
    stand(eng, 3, 3)
    expect(eng.controls.place('structure/wall', { x: 3, y: 2 })).toBe(true)
    expect(eng.controls.place('structure/floor', { x: 3, y: 2 }, undefined, true)).toBe(true)
    expect(w.placedAt(SANDBOX_MAP, 3, 2, 1).map((e) => e.type)).toEqual(['structure/floor'])
    stand(eng, 3, 4)
    expect(eng.controls.place('structure/stairs', { x: 3, y: 3 })).toBe(true)
    const stairs = w.placedAt(SANDBOX_MAP, 3, 3).find((e) => e.type === 'structure/stairs')!
    expect(stairs.facing).toBe('up')
    // up: onto the stairs (on their storey), then on north onto the floor a storey up
    expect(walk(eng, 'up')).toMatchObject({ x: 3, y: 3 })
    expect(w.posOf(w.player)!.z ?? 0).toBe(0)
    // on the stairs one is on their storey: the floor over the landing is its ceiling, there already
    give(eng, 'structure/floor')
    eng.controls.sync()
    expect(why(eng, 'structure/floor', 3, 2, true)).toBe('There is a floor there already.')
    expect(walk(eng, 'up')).toMatchObject({ x: 3, y: 2, z: 1 })
    // down: back onto the stairs (half a storey: no fall), and off them onto the ground
    const hp = w.num(w.player, 'hp')
    expect(walk(eng, 'down')).toMatchObject({ x: 3, y: 3 })
    expect(w.posOf(w.player)!.z ?? 0).toBe(0)
    expect(walk(eng, 'down')).toMatchObject({ x: 3, y: 4 })
    expect(w.num(w.player, 'hp')).toBe(hp)
    // from the side one steps onto them, and off the other side; only their way up leads up
    stand(eng, 4, 3)
    expect(walk(eng, 'left')).toMatchObject({ x: 3, y: 3 })
    expect(walk(eng, 'left')).toMatchObject({ x: 2, y: 3 })
    expect(w.posOf(w.player)!.z ?? 0).toBe(0)
    // stairs set facing east (the palette's turn) go up east
    give(eng, 'structure/stairs')
    eng.controls.sync()
    stand(eng, 5, 5)
    expect(eng.controls.place('structure/stairs', { x: 6, y: 5 }, 'right')).toBe(true)
    expect(w.placedAt(SANDBOX_MAP, 6, 5).find((e) => e.type === 'structure/stairs')!.facing).toBe('right')
  })

  it("stairs in a room going up through a hole in the floor overhead are the room's own, lead to the storey above, and the stairwell's roof is laid from upstairs", () => {
    const eng = meadow()
    const w = eng.world
    // walls round (2..4, 2..4) inside (1..5, 1..5); a floor over it all but the stairs' cell (3,3); stairs going up north
    eng.author(() => {
      for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) if (x === 1 || x === 5 || y === 1 || y === 5) w.create('structure/wall', { on: 'tile', map: SANDBOX_MAP, x, y })
      for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) if (!(x === 3 && y === 3)) w.create('structure/floor', { on: 'tile', map: SANDBOX_MAP, x, y, z: 1 })
      const st = w.create('structure/stairs', { on: 'tile', map: SANDBOX_MAP, x: 3, y: 3 })
      st.facing = 'up'
    })
    stand(eng, 3, 4)
    const room = w.roomsOf(SANDBOX_MAP).find((r) => r.place.on === 'area' && !r.place.z)!
    expect(room).toBeDefined()
    expect(room.place.on === 'area' && room.place.rects.map(([x, y]) => `${x},${y}`)).toContain('3,3')
    // from below: no ceiling over the stairs; a floor laid on the ground under them is fine
    give(eng, 'structure/floor', 2)
    eng.controls.sync()
    expect(why(eng, 'structure/floor', 3, 3, true)).toBe('Stairs keep the storey over them open.')
    expect(walk(eng, 'up')).toMatchObject({ x: 3, y: 3 })
    expect(walk(eng, 'up')).toMatchObject({ x: 3, y: 2, z: 1 })
    // and back down through the hole
    expect(walk(eng, 'down')).toMatchObject({ x: 3, y: 3 })
    expect(w.posOf(w.player)!.z ?? 0).toBe(0)
    // the stairwell's roof: from upstairs, that storey's own ceiling, held by the walls there
    eng.author(() => { for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) if (x === 1 || x === 5 || y === 1 || y === 5) w.create('structure/wall', { on: 'tile', map: SANDBOX_MAP, x, y, z: 1 }) })
    stand(eng, 3, 2, 1)
    expect(eng.controls.place('structure/floor', { x: 3, y: 3 }, undefined, true)).toBe(true)
    expect(storeys(eng, 3, 3)).toEqual([['stairs'], [], ['floor'], []])
  })

  it('the inputs meet only the storey one stands on: below the floor overhead, E meets the wall, never the floor laid over it', () => {
    const eng = meadow()
    const w = eng.world
    give(eng, 'structure/wall')
    give(eng, 'structure/floor')
    eng.controls.sync()
    stand(eng, 3, 4)
    expect(eng.controls.place('structure/wall', { x: 3, y: 3 })).toBe(true)
    expect(eng.controls.place('structure/floor', { x: 3, y: 3 }, undefined, true)).toBe(true)
    const floor = w.placedAt(SANDBOX_MAP, 3, 3, 1).find((e) => e.type === 'structure/floor')!
    // the view puts the floor overhead on top of the stack: it is not one of the layers
    const plan = eng.controls.plan('hands', { x: 3, y: 3, stack: [{ e: floor.id }] })
    expect(w.get(plan!.target.e)?.type).toBe('structure/wall')
    expect(eng.controls.choices('hands', { x: 3, y: 3, stack: [{ e: floor.id }] }).map((c) => w.get(c.plan!.target.e)?.type)).not.toContain('structure/floor')
    // up there, standing on the floor: the floor is one's ground, the cell's own grass below is not
    stand(eng, 3, 3, 1)
    expect(eng.controls.layers({ map: SANDBOX_MAP, x: 3, y: 3 }).map((r) => w.get(r.e)?.type)).toEqual(['actor/person/player', 'structure/floor'])
  })
})

describe('the build palette on built things', () => {
  it('with none carried, a wall is made and set down, never on a wall below; a floor made and laid as the ceiling over walls', () => {
    const rows = Array.from({ length: 7 }, () => Array(7).fill('grass'))
    const eng = buildSandbox({ terrain: rows, entities: [{ key: 'actor', type: 'actor/person/player', x: 3, y: 4 }], event: {} }, onto, new RuleLibrary(BASE_RULES))
    const w = eng.world
    eng.author(() => { for (let i = 0; i < 8; i++) w.create('item/material/plank', { on: 'inside', holder: 'actor' }) })
    eng.controls.sync()
    expect(eng.controls.place('structure/wall', { x: 3, y: 3 })).toBe(true)
    expect(eng.controls.previewPlace('structure/wall', { x: 3, y: 3 })).toMatchObject({ ok: false, reason: { en: 'Something is there already.' } })
    expect(eng.controls.place('structure/wall', { x: 2, y: 3 })).toBe(true)
    expect(eng.controls.place('structure/floor', { x: 2, y: 3 }, undefined, true)).toBe(true)
    expect(w.placedAt(SANDBOX_MAP, 2, 3, 1).map((e) => e.type)).toEqual(['structure/floor'])
  })
})
