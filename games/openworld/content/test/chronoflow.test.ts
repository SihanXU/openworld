import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, buildSandbox, snapshot, type Engine, type SaveData, type ScenarioEntity, type WorldIndex } from '@openworld/engine'
import { BASE_RULES, CHRONOFLOW_SWORD, buildOntology } from '../src/index.ts'
import GAME from '../src/game.ts'

const ONTOLOGY = buildOntology()
const MAP = 'sandbox'
const PLAYER = 'actor'
const STARTING_HP = 2000

function slime(key: string, x: number, y = 3, props: ScenarioEntity['props'] = {}): ScenarioEntity {
  return { key, type: 'actor/creature/slime', x, y, props: { hp: STARTING_HP, maxHp: STARTING_HP, def: 5, ...props } }
}

function field(others: ScenarioEntity[], wall = false): Engine {
  const terrain = Array.from({ length: 12 }, () => Array(24).fill('grass'))
  if (wall) terrain[3][9] = 'wall'
  const eng = buildSandbox({
    terrain,
    entities: [
      { key: PLAYER, type: 'actor/person/player', x: 2, y: 3, props: { profession: 'warrior', level: 20 } },
      { key: 'sword', type: CHRONOFLOW_SWORD, x: 2, y: 3, inside: PLAYER },
      ...others,
    ],
    event: {},
  }, ONTOLOGY, new RuleLibrary(BASE_RULES))
  expect(eng.hasWeaponTechnique(PLAYER)).toBe(false)
  eng.controls.sync()
  eng.controls.wear('sword', true)
  expect(eng.hasWeaponTechnique(PLAYER)).toBe(true)
  return eng
}

function hp(eng: Engine, id: string): number {
  return eng.world.num(eng.world.get(id)!, 'hp')
}

function step(eng: Engine, count = 1): void {
  for (let i = 0; i < count; i++) eng.stepWeaponTechniques()
}

describe('Chronoflow Sword', () => {
  it('applies consecutive mode toggles before the next snapshot and remembers the normal mode', () => {
    const eng = field([])
    eng.weaponTechniqueInput(PLAYER, { t: 'mode', mode: 'toggleNormal' })
    eng.weaponTechniqueInput(PLAYER, { t: 'mode', mode: 'toggleNormal' })
    expect(snapshot(eng).weaponTechnique?.mode).toBe('pierce')
    eng.weaponTechniqueInput(PLAYER, { t: 'mode', mode: 'toggleNormal' })
    eng.weaponTechniqueInput(PLAYER, { t: 'mode', mode: 'toggleBeam' })
    expect(snapshot(eng).weaponTechnique?.mode).toBe('beam')
    eng.weaponTechniqueInput(PLAYER, { t: 'mode', mode: 'toggleBeam' })
    expect(snapshot(eng).weaponTechnique?.mode).toBe('wave')
  })

  it('discards attacks when the player falls and respawns on the same tile', () => {
    const eng = field([slime('foe', 8)])
    const aim = { x: 8, y: 3 }
    eng.weaponTechniqueInput(PLAYER, { t: 'mode', mode: 'wave' })
    eng.weaponTechniqueInput(PLAYER, { t: 'hold', on: true, aim })
    expect(eng.weaponFx(MAP).some(f => f.kind === 'echo')).toBe(true)
    eng.author(() => eng.hurt(eng.world.player, 100, undefined, true))
    expect(eng.world.hasStatus({ e: PLAYER }, 'down')).toBe(true)
    expect(eng.weaponFx(MAP)).toEqual([])
    eng.respawn(false)
    expect(eng.world.hasStatus({ e: PLAYER }, 'down')).toBe(false)
    expect(snapshot(eng).weaponTechnique?.mode).toBe('pierce')
    step(eng, 40)
    expect(hp(eng, 'foe')).toBe(STARTING_HP)
  })

  it('charges before applying one 200-power hit each combat step, aims live, and releases without more damage', () => {
    const eng = field([slime('foe', 5), slime('companion', 4, 3, { follow: PLAYER }), slime('behind', 11), slime('side', 2, 7), {
      key: 'child', type: 'actor/person', x: 6, y: 3, props: { hp: STARTING_HP, maxHp: STARTING_HP, age: 12 },
    }], true)
    const child = eng.world.get('child')!
    eng.author(() => {
      child.ai = { behaviour: 'melee', temper: 'aggressive', home: { map: MAP, x: 6, y: 3 }, sight: 6, foes: [PLAYER] }
    })
    expect(eng.isProtected(child)).toBe(true)

    const tick = eng.world.state.tick
    const aim = { x: 16, y: 3 }
    eng.weaponTechniqueInput(PLAYER, { t: 'mode', mode: 'beam' })
    eng.weaponTechniqueInput(PLAYER, { t: 'aim', aim })
    expect(eng.weaponFx(MAP)).toContainEqual(expect.objectContaining({ kind: 'aim', endX: expect.closeTo(8.5, 2) }))
    eng.weaponTechniqueInput(PLAYER, { t: 'hold', on: true, aim })
    step(eng, 35)
    expect(eng.weaponFx(MAP)).toContainEqual(expect.objectContaining({ kind: 'charge' }))
    expect(hp(eng, 'foe')).toBe(STARTING_HP)

    for (let hits = 1; hits <= 5; hits++) {
      step(eng)
      expect(hp(eng, 'foe')).toBe(STARTING_HP - 195 * hits)
    }
    expect(eng.world.state.tick).toBe(tick)
    expect(eng.weaponFx(MAP)).toContainEqual(expect.objectContaining({ kind: 'beam', wall: true, endX: expect.closeTo(8.5, 2) }))
    expect(eng.world.fx).toContainEqual(expect.objectContaining({ t: 'vfx', fx: 'prism-impact' }))
    for (const id of ['companion', 'child', 'behind', 'side']) expect(hp(eng, id), id).toBe(STARTING_HP)

    eng.weaponTechniqueInput(PLAYER, { t: 'aim', aim: { x: 2, y: 10 } })
    step(eng)
    expect(hp(eng, 'side')).toBe(STARTING_HP - 195)
    expect(hp(eng, 'foe')).toBe(STARTING_HP - 195 * 5)
    eng.weaponTechniqueInput(PLAYER, { t: 'hold', on: false })
    expect(eng.weaponFx(MAP)).toContainEqual(expect.objectContaining({ kind: 'tail' }))
    step(eng, 22)
    expect(hp(eng, 'side')).toBe(STARTING_HP - 195)
    expect(eng.weaponFx(MAP)).toEqual([expect.objectContaining({ kind: 'aim' })])
  })

  it('keeps the equipped sword through a packed save while clearing an active beam', () => {
    const eng = field([slime('foe', 5)])
    const aim = { x: 12, y: 3 }
    eng.weaponTechniqueInput(PLAYER, { t: 'mode', mode: 'beam' })
    eng.weaponTechniqueInput(PLAYER, { t: 'hold', on: true, aim })
    step(eng, 40)
    const damaged = hp(eng, 'foe')
    expect(damaged).toBeLessThan(STARTING_HP)
    expect(eng.weaponFx(MAP)).toContainEqual(expect.objectContaining({ kind: 'beam' }))

    const map = structuredClone(eng.world.map(MAP)!)
    const index: WorldIndex = {
      name: 'Chronoflow test', version: 'test', seed: eng.world.state.seed,
      start: { map: MAP, x: 2, y: 3 },
      maps: [{ id: MAP, name: map.name, kind: map.kind, width: map.width, height: map.height, portals: map.portals, npcs: 0, items: 1 }],
      npcs: [], player: structuredClone(eng.world.player),
      stats: { maps: 1, npcs: 0, creatures: 1, items: 1, itemKinds: 1, fixtures: 0 },
    }
    const save: SaveData = JSON.parse(JSON.stringify(new Game(eng).save()))
    const loaded = Game.load(save, index, ONTOLOGY, new RuleLibrary(GAME.rules), GAME.upgradeSave)
    loaded.loadChunk({ map, entities: [] })
    const restored = loaded.engine
    const sword = restored.world.get('sword')!
    expect(sword.type).toBe(CHRONOFLOW_SWORD)
    expect(restored.world.num(sword, 'power')).toBe(144)
    expect(restored.hasWeaponTechnique(PLAYER)).toBe(true)
    expect(restored.weaponFx(MAP)).toEqual([])
    step(restored, 40)
    expect(hp(restored, 'foe')).toBe(damaged)

    restored.weaponTechniqueInput(PLAYER, { t: 'hold', on: true, aim: { x: 5, y: 3 } })
    step(restored, 10)
    expect(hp(restored, 'foe')).toBeLessThan(damaged)
  })
  it('crosses multiple creatures with one damage event each from a single sword wave', () => {
    const eng = field([slime('first', 4), slime('second', 7), slime('off-line', 5, 5)])
    eng.weaponTechniqueInput(PLAYER, { t: 'mode', mode: 'wave' })
    eng.weaponTechniqueInput(PLAYER, { t: 'hold', on: true, aim: { x: 12, y: 3 } })
    eng.weaponTechniqueInput(PLAYER, { t: 'hold', on: false })
    step(eng, 24)
    expect(hp(eng, 'first')).toBe(STARTING_HP - 211)
    expect(hp(eng, 'second')).toBe(STARTING_HP - 211)
    expect(hp(eng, 'off-line')).toBe(STARTING_HP)
    expect(eng.weaponFx(MAP).filter(f => f.kind === 'wave')).toHaveLength(1)
    expect(new Set(eng.weaponFx(MAP).filter(f => f.kind === 'echo').map(f => f.color)).size).toBe(7)
  })

  it('pierces on consecutive combat steps and launches seven colored echoes from a hover', () => {
    const eng = field([slime('foe', 8)])
    const aim = { x: 8, y: 3 }
    eng.weaponTechniqueInput(PLAYER, { t: 'hold', on: true, aim })
    eng.weaponTechniqueInput(PLAYER, { t: 'hold', on: false })
    const echoes = () => eng.weaponFx(MAP).filter(f => f.kind === 'echo')
    const born = echoes()
    expect(born).toHaveLength(7)
    expect(new Set(born.map(f => f.color)).size).toBe(7)
    expect(new Set(born.map(f => `${f.x},${f.y}`)).size).toBe(1)

    const damageSteps: number[] = []
    const count = () => eng.trace.filter(t => t.ev.kind === 'impulse/strike' && t.ev.host.e === 'foe').length
    for (let frame = 1; frame <= 17; frame++) {
      const before = count()
      step(eng)
      damageSteps.push(count() - before)
    }
    expect(damageSteps).toContain(1)
    expect(Math.max(...damageSteps)).toBe(1)
    expect(damageSteps.some((hits, i) => hits === 1 && damageSteps[i + 1] === 1)).toBe(true)
    expect(hp(eng, 'foe')).toBeLessThan(STARTING_HP)
    expect(eng.trace.filter(t => t.ev.kind === 'impulse/element').map(t => t.ev.params?.element)).toEqual(expect.arrayContaining(['water', 'lightning']))

    const hover = echoes()
    expect(hover.every(f => f.progress === 0)).toBe(true)
    expect(new Set(hover.map(f => f.y)).size).toBe(7)
    step(eng, 4)
    expect(echoes().every(f => f.progress > 0)).toBe(true)
    const afterPierce = hp(eng, 'foe')
    step(eng, 24)
    expect(hp(eng, 'foe')).toBeLessThan(afterPierce)
    expect(echoes()).toHaveLength(0)
  })
})
