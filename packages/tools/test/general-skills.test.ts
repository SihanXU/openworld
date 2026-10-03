import { describe, expect, it } from 'vitest'
import { Engine, RuleLibrary, buildSandbox, combatDamage, combatDelay, combatStrike, combatTick, dash, finishCombatStrike, type Entity, type Scenario } from '@lsw/engine'
import { BASE_RULES, SKILLS, buildOntology } from '@lsw/content'

// The general combat branches, deeper (docs/skill-tree.md): swiftness (dodge, the dash and what
// it opens), damage (attack, critical chance and damage, how a fight builds), survival (health,
// defence, hunger, regeneration, the brink).

const onto = buildOntology()
const lib = new RuleLibrary(BASE_RULES)

/** A strip of grass 12 × 3: the player at (1,1) facing right, a slime two tiles ahead. */
function arena(skills: string[] = [], extra: Scenario['entities'] = []): { eng: Engine; p: Entity; foe: Entity } {
  const sc: Scenario = {
    terrain: Array.from({ length: 3 }, () => Array(12).fill('grass')),
    entities: [{ key: 'actor', type: 'actor/person/player', x: 1, y: 1 }, { key: 'foe', type: 'actor/creature/slime/green_slime', x: 3, y: 1 }, ...extra],
    event: {},
  }
  const start = buildSandbox(sc, onto, lib)
  const eng = new Engine(structuredClone(start.world.state), start.world.onto.data, lib)
  eng.world.state.player = 'actor'
  const p = eng.world.get('actor')!
  p.facing = 'right'
  Object.assign((p.props ??= {}), { hp: 40, maxHp: 40, atk: 10, def: 0, hunger: 20, maxHunger: 20 })
  p.tags = skills.map((s) => `skill:${s}`)
  const foe = eng.world.get('foe')!
  Object.assign((foe.props ??= {}), { hp: 200, maxHp: 200, def: 0 })
  return { eng, p, foe }
}
const at = (eng: Engine, e: Entity) => eng.world.posOf(e)!

describe('the general branches', () => {
  it('each holds a second capstone that needs both new arms, costs two points, and ends the branch', () => {
    for (const [branch, cap] of [['swiftness', 'untouchable'], ['damage', 'berserker'], ['survival', 'phoenix']] as const) {
      const own = SKILLS.filter((s) => s.branch === branch)
      expect(own.at(-1)!.id).toBe(cap)
      expect(own.at(-1)!.cost).toBe(2)
      expect(own.at(-1)!.requires).toHaveLength(2)
      expect(own.length).toBeGreaterThanOrEqual(13)
    }
  })
})

describe('swiftness', () => {
  it('dodge: a blow misses entirely, about as often as the chance says (capped at 50%)', () => {
    const { eng, p, foe } = arena()
    p.props!.dodge = 0.9
    let missed = 0
    for (let i = 0; i < 400; i++) if (combatDamage(eng.world, p, 5, foe, false) === 0) missed++
    expect(missed / 400).toBeGreaterThan(0.4)
    expect(missed / 400).toBeLessThan(0.6)
    // piercing harm (hunger, fire) is never dodged
    expect(combatDamage(eng.world, p, 5, foe, true)).toBe(5)
  })

  it('dodge: no roll at all for those without it (the world\'s dice stay as they were)', () => {
    const { eng, p, foe } = arena()
    const rng = eng.world.state.rng
    combatDamage(eng.world, p, 5, foe, false)
    expect(eng.world.state.rng).toBe(rng)
  })

  it('dash: three tiles ahead, stopped by a creature, with a cooldown', () => {
    const { eng, p } = arena(['dash'])
    expect(dash(eng, p)).toBe(true)
    expect(at(eng, p).x).toBe(2) // the slime at x=3 stops it
    eng.world.place(eng.world.get('foe')!, { on: 'tile', map: at(eng, p).map, x: 10, y: 0 })
    expect(dash(eng, p)).toBe(false) // cooling down
    for (let i = 0; i < 40; i++) eng.tick()
    expect(dash(eng, p)).toBe(true)
    expect(at(eng, p).x).toBe(5)
  })

  it('phantom step: through the creature, untouchable a moment; tailwind: farther, sooner; slipstream: faster after', () => {
    const { eng, p, foe } = arena(['dash', 'phantom-step', 'slipstream', 'tailwind'])
    const slow = combatDelay(eng.world, p, 10, 'move')
    expect(dash(eng, p)).toBe(true)
    expect(at(eng, p).x).toBe(5) // through the slime, four tiles
    expect(combatDamage(eng.world, p, 9, foe, false)).toBe(0)
    expect(combatDelay(eng.world, p, 10, 'move')).toBeLessThan(slow)
    for (let i = 0; i < 25; i++) eng.tick()
    expect(combatDamage(eng.world, p, 9, foe, false)).toBe(9)
    p.facing = 'left'
    expect(dash(eng, p)).toBe(true) // 2.5 s cooldown
  })

  it('untouchable: a dodge readies a sure critical, spent by the hit', () => {
    const { eng, p, foe } = arena(['untouchable'])
    p.combat = { dodgeTick: eng.world.state.tick }
    const s = combatStrike(eng.world, p, foe, 10, 1, undefined, true)
    expect(s.critical).toBe(true)
    finishCombatStrike(eng.world, p, foe, s, 200, 1, true)
    foe.props!.hp = 150
    finishCombatStrike(eng.world, p, foe, s, 200, 1, true)
    expect(p.combat!.dodgeTick).toBeUndefined()
  })
})

describe('damage', () => {
  it('critical damage adds to the multiplier: ×1.5 + 0.25 + 0.25', () => {
    const { eng, p, foe } = arena(['lethal-edge', 'brutal'])
    Object.assign(p.props!, { critChance: 1, critDamage: 0.5 })
    const s = combatStrike(eng.world, p, foe, 10, 1, undefined, true)
    expect([s.critical, s.power]).toEqual([true, 20])
  })

  it('first strike: +30% on a target at full health only', () => {
    const { eng, p, foe } = arena(['first-strike'])
    expect(combatStrike(eng.world, p, foe, 10, 1, undefined, true).power).toBeCloseTo(13)
    foe.props!.hp = 199
    expect(combatStrike(eng.world, p, foe, 10, 1, undefined, true).power).toBeCloseTo(10)
  })

  it('momentum: a chain of hits adds 5% each, up to 25%, and breaks after 1.5 seconds', () => {
    const { eng, p, foe } = arena(['momentum'])
    p.combat = { chain: 3, chainTick: eng.world.state.tick }
    expect(combatStrike(eng.world, p, foe, 10, 1, undefined, true).power).toBeCloseTo(11.5)
    p.combat = { chain: 9, chainTick: eng.world.state.tick }
    expect(combatStrike(eng.world, p, foe, 10, 1, undefined, true).power).toBeCloseTo(12.5)
    p.combat = { chain: 3, chainTick: eng.world.state.tick - 20 }
    expect(combatStrike(eng.world, p, foe, 10, 1, undefined, true).power).toBeCloseTo(10)
  })

  it('berserker: at half health, +25% damage and +10% critical chance', () => {
    const { eng, p, foe } = arena(['berserker'])
    expect(combatStrike(eng.world, p, foe, 10, 1, undefined, true).power).toBeCloseTo(10)
    p.props!.hp = 20
    p.props!.critChance = 0.9 // with berserker, 1.0: always critical
    const s = combatStrike(eng.world, p, foe, 10, 1, undefined, true)
    expect([s.critical, s.power]).toEqual([true, 10 * 1.25 * 1.5])
  })

  it('hemorrhage: a critical hit bleeds the target 1 a second for 4 seconds, through defence', () => {
    const { eng, p, foe } = arena(['hemorrhage'])
    foe.props!.def = 5
    p.props!.critChance = 1
    eng.attack(p, { e: foe.id }) // out of reach: place it beside first
    eng.world.place(foe, { on: 'tile', map: at(eng, p).map, x: 2, y: 1 })
    eng.attack(p, { e: foe.id })
    expect(foe.combat?.bleedUntil).toBeGreaterThan(eng.world.state.tick)
    const hp = eng.world.num(foe, 'hp')
    for (let i = 0; i < 60; i++) combatTick(eng, at(eng, foe).map), (eng.world.state.tick += 1)
    expect(hp - eng.world.num(foe, 'hp')).toBe(4)
  })
})

describe('survival', () => {
  it('regeneration: heals from a quarter-full food bar', () => {
    for (const [skills, healed] of [[[], false], [['regeneration'], true]] as const) {
      const { eng, p } = arena([...skills])
      Object.assign(p.props!, { hp: 20, hunger: 6 })
      for (let i = 0; i < 81; i++) eng.tick()
      expect(eng.world.num(p, 'hp') > 20).toBe(healed)
    }
  })

  it('hearty meals: food fills half as much again', () => {
    for (const [skills, fill] of [[[], 5], [['hearty-meals'], 7.5]] as const) {
      const { eng, p } = arena([...skills])
      p.props!.hunger = 2
      const bread = eng.world.create('item/food/bread', { on: 'hand', holder: p.id })
      p.held = bread.id
      eng.interact('interact', p.id, { e: p.id }, { instrument: { e: bread.id } })
      expect(eng.world.num(p, 'hunger')).toBe(2 + Math.round(fill))
    }
  })

  it('adrenaline: a blow to the brink brings speed and a little healing, once a minute', () => {
    const { eng, p, foe } = arena(['adrenaline'])
    const slow = combatDelay(eng.world, p, 10, 'move')
    eng.damage(p, 30, undefined, false, { e: foe.id })
    expect(eng.world.num(p, 'hp')).toBe(10)
    expect(combatDelay(eng.world, p, 10, 'move')).toBeLessThan(slow)
    for (let i = 0; i < 60; i++) eng.tick()
    expect(eng.world.num(p, 'hp')).toBeGreaterThanOrEqual(14)
    const tick = p.combat!.adrenalineTick
    eng.damage(p, eng.world.num(p, 'hp') - 2, undefined, false, { e: foe.id })
    expect(p.combat!.adrenalineTick).toBe(tick)
  })

  it('phoenix: once a day, any lethal damage — even piercing — leaves 30% health', () => {
    const { eng, p } = arena(['phoenix'])
    eng.damage(p, 999, undefined, true)
    expect(eng.world.num(p, 'hp')).toBe(12)
    expect(combatDamage(eng.world, p, 50, eng.world.get('foe')!, false)).toBe(0) // untouchable a moment
    for (let i = 0; i < 31; i++) eng.tick()
    eng.damage(p, 999, undefined, true)
    expect(eng.world.num(p, 'hp')).toBeLessThanOrEqual(0)
  })
})
