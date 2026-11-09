import { describe, expect, it } from 'vitest'
import {
  Game, RuleLibrary, buildSandbox, type Engine, type ScenarioEntity, type WorldIndex,
} from '@openworld/engine'
import { BASE_RULES, RECIPE_BY_ID, buildOntology } from '../src/index.ts'
import { CHARM_STASIS, CURSE_CHARMS } from '../src/curse-charms.ts'

const [finger, shades] = CURSE_CHARMS
const ONTOLOGY = buildOntology()
const AIM = { x: 8, y: 5 }
const hp = (eng: Engine, id: string) => eng.world.num(eng.world.get(id)!, 'hp')
const pos = (eng: Engine, id: string) => eng.world.posOf(eng.world.get(id))!
const tick = (eng: Engine, count: number) => { for (let i = 0; i < count; i++) eng.tick() }
const hook = (eng: Engine) => eng.hooks.equipmentGesture!
const cues = (eng: Engine) => eng.world.fx.flatMap(f => f.t === 'vfx' && f.fx.startsWith('charm:') ? [f.fx] : [])
const dead = (eng: Engine, id: string) => !eng.world.get(id) || hp(eng, id) <= 0
function movePlayer(eng: Engine, x: number, y: number) {
  eng.queue({ kind: 'impulse/push', host: { e: eng.world.player.id }, roles: {}, params: { map: 'sandbox', x, y }, origin: 'world' })
  eng.flush()
}
const target = (key: string, x: number, y = 5, props = {}): ScenarioEntity => ({
  key, type: 'actor/creature/slime', x, y, props: { hp: 600, maxHp: 600, def: 0, ...props },
})

function fixture(others: ScenarioEntity[] = [target('foe', 7)], wall?: { x: number; y: number }) {
  const terrain = Array.from({ length: 13 }, () => Array(24).fill('grass'))
  if (wall) terrain[wall.y][wall.x] = 'wall'
  const eng = buildSandbox({ terrain, entities: [
    { key: 'actor', type: 'actor/person/player', x: 3, y: 5 },
    { key: 'finger', type: finger.id, x: 3, y: 5, inside: 'actor' },
    { key: 'shades', type: shades.id, x: 3, y: 5, inside: 'actor' },
    { key: 'arcane', type: 'fixture/craft/arcane', x: 3, y: 4 },
    ...others,
  ], event: {} }, ONTOLOGY, new RuleLibrary(BASE_RULES))
  eng.controls.sync()
  return eng
}

function reload(eng: Engine) {
  const w = eng.world, map = structuredClone(w.state.maps.sandbox)
  const index: WorldIndex = {
    name: 'Charm fixture', version: '1', seed: 1, start: w.state.spawn,
    maps: [{ id: map.id, name: map.name, kind: map.kind, width: map.width, height: map.height, portals: [], npcs: 0, items: 0 }],
    npcs: [], player: structuredClone(w.player), stats: { maps: 1, npcs: 0, creatures: 1, items: 2, itemKinds: 2, fixtures: 1 },
  }
  const loaded = Game.load(JSON.parse(JSON.stringify(new Game(eng).save())), index, ONTOLOGY, new RuleLibrary(BASE_RULES))
  loaded.loadMapData(map)
  return loaded.engine
}

describe('curse charms', () => {
  it.each([finger, shades])('makes $id at the upgraded arcane station and consumes exactly its ingredients', charm => {
    const eng = fixture([])
    const recipe = RECIPE_BY_ID[charm.id]
    expect(recipe.station).toBe('arcane')
    eng.author(() => {
      for (const need of recipe.needs) for (let i = 0; i < need.count; i++) eng.world.create(need.type, { on: 'inside', holder: 'actor' })
    })
    eng.controls.sync()
    expect(eng.controls.craft(recipe, 'arcane')).toBe(false)
    expect(recipe.needs.map(n => eng.controls.count(n.type))).toEqual(recipe.needs.map(n => n.count))
    eng.author(() => eng.world.setFact(recipe.unlockedBy!.fact, recipe.unlockedBy!.level ?? 1))
    expect(eng.controls.craft(recipe, 'arcane')).toBe(true)
    expect(recipe.needs.map(n => eng.controls.count(n.type))).toEqual([0, 0, 0])
    expect(eng.controls.count(charm.id)).toBe(2)
  })

  it('wears and attacks through native controls, then reloads without retaining the active shrine', () => {
    const eng = fixture(), api = hook(eng)
    expect(api.binding('left')).toBeUndefined()
    eng.controls.wear('finger', true)
    expect(api.binding('left')).toEqual({ item: 'finger', double: false })
    api.press('left', AIM)
    tick(eng, 2)
    expect(hp(eng, 'foe')).toBeLessThan(600)
    expect(cues(eng)).toContain('charm:sever-hit')

    api.press('right', AIM, true)
    tick(eng, 3)
    expect(cues(eng)).toContain('charm:scar-field')
    const loaded = reload(eng)
    expect(hook(loaded).binding('left')?.item).toBe('finger')
    const damaged = hp(loaded, 'foe')
    tick(loaded, 12)
    expect(hp(loaded, 'foe')).toBe(damaged)
  })

  it('ends a still field on reload and when its shades are exchanged twice while paused', () => {
    const eng = fixture(), foe = { e: 'foe' }
    eng.controls.wear('shades', true)
    hook(eng).press('right', AIM, true)
    tick(eng, 3)
    expect(eng.world.hasStatus(foe, CHARM_STASIS)).toBe(true)
    eng.author(() => eng.world.setStatus(foe, 'stunned', eng.world.state.tick + 20))

    const loaded = reload(eng)
    expect(hook(loaded).binding('left')?.item).toBe('shades')
    tick(loaded, 1)
    expect(loaded.world.hasStatus(foe, CHARM_STASIS)).toBe(false)
    expect(loaded.world.hasStatus(foe, 'stunned')).toBe(true)

    eng.controls.wear('finger', true)
    eng.controls.wear('shades', true)
    expect(eng.world.hasStatus(foe, CHARM_STASIS)).toBe(false)
    tick(eng, 20)
    expect(eng.world.hasStatus(foe, CHARM_STASIS)).toBe(false)
  })

  it('keeps a red orb in windup when the shades switch to blink mode', () => {
    const eng = fixture()
    eng.controls.wear('shades', true)
    const api = hook(eng)
    api.press('right', AIM)
    api.press('mode')
    tick(eng, 2)
    expect(api.binding('left')?.double).toBe(false)
    expect(cues(eng)).toContain('charm:orb-red')
  })

  it('places fine cuts at the exact cursor across the map, while local walls and friendlies block hits', () => {
    const eng = fixture([target('near', 5), target('far', 21), target('off', 4, 7), target('at-feet', 3, 6), target('behind', 7), {
      key: 'friend', type: 'actor/person', x: 4, y: 5, props: { hp: 80, maxHp: 80 },
    }], { x: 6, y: 5 })
    eng.controls.wear('finger', true)
    const api = hook(eng)
    expect(api.binding('right')).toEqual({ item: 'finger', double: true, repeat: true })
    api.press('right', { x: 4, y: 7 })
    expect(hp(eng, 'off')).toBe(583)
    expect(hp(eng, 'near')).toBe(600)
    tick(eng, 1)
    api.press('right', { x: 5, y: 5 })
    expect(hp(eng, 'near')).toBe(583)
    tick(eng, 1)
    api.press('right', { x: 3, y: 5 })
    expect(hp(eng, 'at-feet')).toBe(583)
    tick(eng, 1)
    api.press('right', { x: 21, y: 5 })
    expect(hp(eng, 'far')).toBe(583)
    expect(hp(eng, 'behind')).toBe(600)
    expect(hp(eng, 'friend')).toBe(80)
    expect(cues(eng)).toContain('charm:rend-hit')
  })

  it('slashes every permitted foe across the storey until the second double-right closes the shrine', () => {
    const eng = fixture([target('near', 5), target('far', 21), target('off', 4, 7), {
      key: 'friend', type: 'actor/person', x: 4, y: 5, props: { hp: 80, maxHp: 80 },
    }], { x: 6, y: 5 })
    eng.controls.wear('finger', true)
    const api = hook(eng)
    api.press('right', AIM, true)
    tick(eng, 3)
    expect(hp(eng, 'far')).toBe(390)
    expect(cues(eng).filter(fx => fx === 'charm:field-cut-hit')).toHaveLength(3)
    expect(cues(eng)).not.toContain('charm:field-cut')
    tick(eng, 8)
    expect(dead(eng, 'near')).toBe(true)
    expect(dead(eng, 'far')).toBe(true)
    expect(hp(eng, 'friend')).toBe(80)
    tick(eng, 60)
    eng.author(() => eng.world.add({ id: 'late', type: 'actor/creature/slime', props: { hp: 600, maxHp: 600 }, place: { on: 'tile', map: 'sandbox', x: 21, y: 5 } }))
    tick(eng, 4)
    expect(hp(eng, 'late')).toBe(390)
    const open = eng.world.fx.find(f => f.t === 'vfx' && f.fx === 'charm:scar-field')
    expect(open).not.toHaveProperty('durationMs')
    api.press('right', AIM, true)
    expect(eng.world.fx).toContainEqual(expect.objectContaining({ t: 'vfx', fx: 'charm:orb-stop', instance: open?.t === 'vfx' && open.instance }))
    expect(api.binding('left')?.double).toBe(false)
    tick(eng, 12)
    expect(hp(eng, 'late')).toBe(390)
    api.press('right', AIM, true)
    tick(eng, 3)
    expect(hp(eng, 'late')).toBe(180)
  })

  it('travels to the cursor, hits each foe once and leaves crossing cuts at the endpoint', () => {
    const eng = fixture([target('line', 5), target('cursor', 10, 6)])
    eng.controls.wear('finger', true)
    hook(eng).press('left', { x: 10, y: 5 })
    tick(eng, 1)
    expect(hp(eng, 'line')).toBe(600)
    expect(cues(eng)).toContain('charm:sever')
    tick(eng, 2)
    expect(hp(eng, 'line')).toBe(559)
    expect(hp(eng, 'cursor')).toBe(559)
    expect(cues(eng)).toContain('charm:sever-end')
  })

  it('flies to a far cursor beyond the previous short range but stops at a wall', () => {
    const far = fixture([target('foe', 20)])
    far.controls.wear('finger', true)
    hook(far).press('left', { x: 21, y: 5 })
    tick(far, 6)
    expect(hp(far, 'foe')).toBe(559)
    const wall = fixture([target('foe', 20)], { x: 18, y: 5 })
    wall.controls.wear('finger', true)
    hook(wall).press('left', { x: 21, y: 5 })
    tick(wall, 6)
    expect(hp(wall, 'foe')).toBe(600)
  })

  it('allows one wide lethal fire wave per manually opened field', () => {
    const eng = fixture([target('near', 7, 5, { def: 1000 }), target('wide', 13, 7, { def: 1000 }), target('off', 12, 9)])
    eng.controls.wear('finger', true)
    const api = hook(eng)
    api.press('left', AIM, true)
    tick(eng, 4)
    expect(cues(eng)).not.toContain('charm:wind-flame')
    expect(api.binding('left')?.double).toBe(false)
    api.press('right', AIM, true)
    tick(eng, 3)
    expect(api.binding('left')?.double).toBe(true)
    api.press('left', AIM, true)
    tick(eng, 2)
    expect(cues(eng)).toContain('charm:wind-flame')
    expect(dead(eng, 'near')).toBe(false)
    tick(eng, 4)
    expect(dead(eng, 'near')).toBe(true)
    expect(dead(eng, 'wide')).toBe(true)
    expect(dead(eng, 'off')).toBe(false)
    expect(cues(eng).filter(fx => fx === 'charm:flame-hit')).toHaveLength(2)
    tick(eng, 10)
    api.press('left', AIM, true)
    tick(eng, 3)
    expect(cues(eng).filter(fx => fx === 'charm:flame')).toHaveLength(1)
    expect(api.binding('left')?.double).toBe(true)
  })

  it('cancels a charged fire wave when the caster closes the field before release', () => {
    const eng = fixture()
    eng.controls.wear('finger', true)
    const api = hook(eng)
    api.press('right', AIM, true)
    tick(eng, 3)
    api.press('left', AIM, true)
    api.press('right', AIM, true)
    expect(api.binding('left')?.double).toBe(false)
    tick(eng, 3)
    expect(cues(eng)).not.toContain('charm:flame')
    tick(eng, 10)
    api.press('right', AIM, true)
    tick(eng, 3)
    api.press('left', AIM, true)
    tick(eng, 3)
    expect(cues(eng)).toContain('charm:flame')
  })

  it('knocks enemies away with the blue orb and draws them toward the red landing', () => {
    const blue = fixture(), red = fixture([target('foe', 9, 6)])
    blue.controls.wear('shades', true); red.controls.wear('shades', true)
    hook(blue).press('left', AIM)
    tick(blue, 2)
    expect(hp(blue, 'foe')).toBe(600)
    expect(cues(blue)).toContain('charm:orb-blue')
    tick(blue, 4)
    expect(pos(blue, 'foe').x).toBe(10)
    expect(hp(blue, 'foe')).toBe(566)

    hook(red).press('right', AIM)
    tick(red, 6)
    expect(pos(red, 'foe')).toMatchObject(AIM)
    expect(hp(red, 'foe')).toBe(574)
    expect(cues(red)).toContain('charm:land-red')
  })

  it('pierces past the pointer and defeats each target before fading at the map boundary', () => {
    const eng = fixture([target('first', 7, 5, { def: 1000 }), target('next', 15), target('off', 14, 8)])
    eng.controls.wear('shades', true)
    hook(eng).press('left', { x: 8, y: 5 }, true)
    tick(eng, 3)
    expect(hp(eng, 'first')).toBe(600)
    expect(cues(eng)).toContain('charm:wind-violet')
    tick(eng, 10)
    expect(dead(eng, 'first')).toBe(true)
    expect(dead(eng, 'next')).toBe(true)
    expect(hp(eng, 'off')).toBe(600)
    expect(cues(eng).filter(fx => fx === 'charm:orb-hit-violet')).toHaveLength(2)
    expect(cues(eng)).toContain('charm:violet-fade')
  })

  it('checks projectile line of sight from swept contact so a wall corner blocks nearby targets', () => {
    const eng = fixture([target('corner', 5, 3)], { x: 4, y: 3 })
    eng.controls.wear('shades', true)
    hook(eng).press('left', { x: 6, y: 1 }, true)
    tick(eng, 10)
    expect(hp(eng, 'corner')).toBe(600)
    expect(cues(eng)).toContain('charm:violet-fade')
    expect(cues(eng)).not.toContain('charm:orb-hit-violet')
  })

  it('merges blue and a resting red orb at red’s position, consuming both in an immediate burst', () => {
    const eng = fixture([target('direct', 11, 7), target('near', 11, 8), target('wide', 13, 7), target('off', 16, 7)])
    eng.controls.wear('shades', true)
    const api = hook(eng), aim = { x: 11, y: 7 }
    api.press('right', aim)
    tick(eng, 7)
    expect(cues(eng)).toContain('charm:orb-red-rest')
    expect(dead(eng, 'near')).toBe(false)
    expect(pos(eng, 'direct')).toMatchObject(aim)
    api.press('left', aim)
    tick(eng, 7)
    const fusion = eng.world.fx.filter(f => f.t === 'vfx' && f.fx === 'charm:violet-fusion')
    expect(fusion).toHaveLength(1)
    expect(fusion[0]).toMatchObject(aim)
    expect(dead(eng, 'direct')).toBe(true)
    expect(dead(eng, 'near')).toBe(true)
    expect(dead(eng, 'wide')).toBe(true)
    expect(dead(eng, 'off')).toBe(false)
    expect(cues(eng)).not.toContain('charm:land-blue')
    expect(cues(eng)).not.toContain('charm:orb-violet')
    tick(eng, 30)
    expect(cues(eng).filter(fx => fx === 'charm:violet-fusion')).toHaveLength(1)
  })

  it('detects a blue–red collision between ticks while both projectiles are still moving', () => {
    const eng = fixture([])
    eng.controls.wear('shades', true)
    const api = hook(eng)
    api.press('right', { x: 12, y: 5 })
    tick(eng, 2)
    movePlayer(eng, 12, 5)
    api.press('left', { x: 6, y: 5 })
    tick(eng, 3)
    const fx = eng.world.fx.find(f => f.t === 'vfx' && f.fx === 'charm:violet-fusion')
    expect(fx?.t === 'vfx' && fx.x).toBeGreaterThan(7.5)
    expect(fx?.t === 'vfx' && fx.x).toBeLessThan(9.75)
    expect(cues(eng)).not.toContain('charm:land-red')
    expect(cues(eng)).not.toContain('charm:orb-red-rest')
  })

  it('holds all permitted foes until the still field closes without deleting other stuns', () => {
    const eng = fixture([target('foe', 5), target('behind', 21)], { x: 6, y: 5 })
    eng.controls.wear('shades', true)
    const api = hook(eng), foe = eng.world.get('foe')!
    eng.author(() => eng.applyStatus({ e: 'foe' }, 'stunned', 300))
    api.press('right', AIM, true)
    tick(eng, 3)
    expect(eng.busy(foe)).toBe(true)
    expect(eng.busy(eng.world.get('behind')!)).toBe(true)
    tick(eng, 75)
    expect(eng.world.hasStatus({ e: 'foe' }, CHARM_STASIS)).toBe(true)
    expect(eng.world.hasStatus({ e: 'behind' }, CHARM_STASIS)).toBe(true)
    api.press('right', AIM, true)
    expect(eng.world.hasStatus({ e: 'foe' }, CHARM_STASIS)).toBe(false)
    expect(eng.world.hasStatus({ e: 'foe' }, 'stunned')).toBe(true)
    expect(eng.busy(eng.world.get('behind')!)).toBe(false)
    api.press('right', AIM, true)
    tick(eng, 3)
    expect(eng.busy(eng.world.get('behind')!)).toBe(true)
    eng.controls.wear('shades', false)
    tick(eng, 1)
    expect(eng.busy(eng.world.get('behind')!)).toBe(false)
  })

  it('blinks only to a walkable unobstructed tile', () => {
    const eng = fixture([], { x: 6, y: 5 })
    eng.controls.wear('shades', true)
    const api = hook(eng)
    api.press('mode')
    expect(api.binding('left')?.double).toBe(false)
    api.press('left', AIM)
    expect(pos(eng, 'actor').x).toBe(3)
    api.press('left', { x: 3, y: 8 })
    expect(pos(eng, 'actor')).toMatchObject({ x: 3, y: 8 })
    api.press('mode')
    expect(api.binding('left')?.double).toBe(true)
    eng.controls.wear('shades', false)
    expect(api.binding('mode')).toBeUndefined()
  })
})
