// M3: building, played through the same entry point as the player's keys.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, SANDBOX_MAP, buildSandbox, textOf, type Engine } from '@lsw/engine'
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

/** Put a fresh `type` in the player's hand (stowing whatever was there). */
function hold(eng: Engine, type: string): void {
  eng.hold('actor')
  eng.world.create(type, { on: 'hand', holder: 'actor' })
}

const act = (eng: Engine, verb: 'put' | 'interact' | 'take', type?: string) => {
  if (type) hold(eng, type)
  else eng.hold('actor')
  return eng.playerVerb(verb)?.rule?.id
}
const here = (eng: Engine) => eng.world.entitiesAt(FRONT.map, FRONT.x, FRONT.y)
const fixture = (eng: Engine) => here(eng).find((e) => eng.world.kindOf(e) === 'fixture')
const count = (eng: Engine, type: string) => here(eng).filter((e) => e.type === type).length
const said = (eng: Engine) => eng.world.fx.flatMap((f) => (f.t === 'say' || f.t === 'log' ? [textOf(f.text)] : []))

const PLANK = 'item/material/plank'
const HAMMER = 'item/tool/smith_hammer'
const AXE = 'item/weapon/blade/axe'

describe('a chest from a frame', () => {
  it('counts planks into a frame, reports progress, and a hammer makes a chest', () => {
    const eng = site([PLANK])
    expect(act(eng, 'put', PLANK)).toBe('build/start-frame')
    expect(fixture(eng)?.type).toBe('fixture/build/frame')
    expect(act(eng, 'put', PLANK)).toBe('build/add-plank')
    expect(said(eng)).toContain('A frame of 3 planks.')
    expect(act(eng, 'interact')).toBe('build/read-frame-3')
    expect(act(eng, 'interact', HAMMER)).toBe('build/unfinished')
    expect(act(eng, 'put', PLANK)).toBe('build/add-plank')
    expect(act(eng, 'put', PLANK)).toBe('build/frame-full')
    expect(act(eng, 'interact', HAMMER)).toBe('build/finish-chest')
    const chest = fixture(eng)!
    expect(chest.type).toBe('fixture/container/chest')
    expect(eng.world.num(chest, 'capacity')).toBe(12)
    expect(act(eng, 'interact')).toBe('core/open-close')
    expect(act(eng, 'put', 'item/food/apple')).toBe('core/store')
  })

  it('a hammer on a frame of two makes a crate', () => {
    const eng = site([PLANK])
    act(eng, 'put', PLANK)
    expect(act(eng, 'interact', HAMMER)).toBe('build/finish-crate')
    expect(fixture(eng)?.type).toBe('fixture/container/crate')
  })

  it('an axe takes a frame apart into its planks', () => {
    const eng = site([PLANK])
    act(eng, 'put', PLANK)
    act(eng, 'put', PLANK)
    expect(act(eng, 'interact', AXE)).toBe('build/unframe')
    expect(fixture(eng)).toBeUndefined()
    expect(count(eng, PLANK)).toBe(3)
  })

  it('an axe breaks up a chest: its contents spill and two planks come back; a locked one resists', () => {
    const eng = site([PLANK])
    act(eng, 'put', PLANK)
    act(eng, 'put', PLANK)
    act(eng, 'put', PLANK)
    act(eng, 'interact', HAMMER)
    act(eng, 'interact') // open
    act(eng, 'put', 'item/food/apple')
    expect(act(eng, 'interact', AXE)).toBe('build/dismantle-chest')
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
    expect(act(locked, 'interact', AXE)).toBeUndefined()
    expect(locked.world.get('chest')).toBeDefined()
  })
})

describe('the same pattern', () => {
  it('stakes make a fence', () => {
    const eng = site(['item/material/stick'])
    expect(act(eng, 'put', 'item/material/stick')).toBe('build/stakes')
    expect(act(eng, 'interact', HAMMER)).toBe('build/fence')
    expect(fixture(eng)?.type).toBe('fixture/fence')
  })

  it('a ring of stones and two sticks make a campfire that lights', () => {
    const eng = site(['item/material/stone'])
    expect(act(eng, 'put', 'item/material/stone')).toBe('build/ring')
    expect(act(eng, 'put', 'item/material/stick')).toBe('build/ring-stick')
    expect(act(eng, 'put', 'item/material/stick')).toBe('build/campfire')
    expect(act(eng, 'interact', 'item/light/torch')).toBe('core/light')
  })

  it('a pickaxe takes a ring apart into its stones and sticks', () => {
    const eng = site(['item/material/stone'])
    act(eng, 'put', 'item/material/stone')
    act(eng, 'put', 'item/material/stick')
    expect(act(eng, 'interact', 'item/tool/pickaxe')).toBe('build/unring')
    expect([count(eng, 'item/material/stone'), count(eng, 'item/material/stick')]).toEqual([2, 1])
  })

  it('planks bridge shallow water, not deep water', () => {
    const eng = site([], 'water')
    expect(act(eng, 'put', PLANK)).toBe('build/bridge')
    expect(eng.world.terrainAt(FRONT.map, FRONT.x, FRONT.y)).toBe('bridge')
    const deep = site([], 'deepwater')
    expect(act(deep, 'put', PLANK)).toBe('core/put-in-water')
  })

  it('a sign is built blank and written with a quill while carrying ink', () => {
    const eng = site(['item/material/stick'])
    expect(act(eng, 'put', PLANK)).toBe('build/post')
    expect(act(eng, 'interact', HAMMER)).toBe('build/sign')
    expect(act(eng, 'interact')).toBe('build/read-blank')
    expect(act(eng, 'interact', 'item/misc/feather_quill')).toBeUndefined()
    eng.world.create('item/misc/ink', { on: 'inside', holder: 'actor' })
    expect(act(eng, 'interact', 'item/misc/feather_quill')).toBe('build/write-sign')
    expect(act(eng, 'interact')).toBe('build/read-handmade')
  })
})
