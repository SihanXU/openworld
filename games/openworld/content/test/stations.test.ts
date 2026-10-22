// Where things are made (world-model.md §6.4, as changed 2026-10-21): the crafting panel's recipes anywhere, from the bag —
// those a building of the Held Ground unlocks once it stands —; a station's (a forge's, an anvil's) at the thing itself,
// opened by a hand on it (its panel), never by standing beside it.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, type Engine, type ScenarioEntity } from '@openworld/engine'
import { BASE_RULES, HAVEN_UPGRADES, RECIPES, RECIPE_BY_ID, RECIPE_UNLOCKS, SKILL_BY_ID, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary(BASE_RULES)

/** A meadow of 8 × 8, the player at (2,2) facing up, and these things in it. */
function world(others: ScenarioEntity[]): Engine {
  const rows = Array.from({ length: 8 }, () => Array(8).fill('grass'))
  const eng = buildSandbox({ terrain: rows, entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, ...others], event: {} }, onto, lib())
  eng.world.player.facing = 'up'
  eng.controls.sync()
  return eng
}
const give = (eng: Engine, type: string, n = 1) => eng.author(() => { for (let i = 0; i < n; i++) eng.world.create(type, { on: 'inside', holder: 'actor' }) })
const smelt = () => RECIPE_BY_ID['smith/smelt-iron']

describe('what a building of the Held Ground unlocks is made anywhere, from the bag, once it stands', () => {
  it('every recipe a building names exists, is made by hand, and carries the building as what unlocks it', () => {
    for (const u of HAVEN_UPGRADES) for (const id of u.recipes ?? []) {
      const r = RECIPE_BY_ID[id]
      expect(r, id).toBeDefined()
      expect(r.station ?? 'hands').toBe('hands')
      expect(r.unlockedBy).toEqual({ fact: u.fact, name: u.name, ...(u.value > 1 && { level: u.value }) })
    }
    expect(Object.keys(RECIPE_UNLOCKS).length).toBeGreaterThan(0)
    // no recipe of the game's own asks for a workbench or a loom any more: those are made anywhere, once unlocked
    expect(RECIPES.filter((r) => r.station === 'workbench' || r.station === 'loom')).toEqual([])
  })

  it('a shield waits for the workshop: not made before, whatever is carried; made anywhere after', () => {
    const eng = world([])
    const c = eng.controls
    give(eng, 'item/material/plank', 3)
    give(eng, 'item/material/stick', 1)
    c.sync()
    const shield = RECIPE_BY_ID['item/armor/shield']
    expect(c.craft(shield)).toBe(false)
    expect(c.count('item/armor/shield')).toBe(0)
    expect(c.count('item/material/plank')).toBe(3)
    eng.author(() => eng.world.setFact('haven.build.workshop', 1))
    expect(c.craft(shield)).toBe(true)
    expect(c.count('item/armor/shield')).toBe(1)
    expect(c.count('item/material/plank')).toBe(0)
  })

  it('cloth waits for the weaving shed', () => {
    const eng = world([])
    const c = eng.controls
    give(eng, 'item/material/grass', 4)
    c.sync()
    const cloth = RECIPE_BY_ID['weave/cloth']
    expect(cloth.unlockedBy?.fact).toBe('haven.build.loom')
    expect(c.craft(cloth)).toBe(false)
    eng.author(() => eng.world.setFact('haven.build.loom', 1))
    expect(c.craft(cloth)).toBe(true)
    expect(c.count('item/material/cloth')).toBe(1)
  })
})

describe('a station is opened by a hand on it, and what is made there is made at it', () => {
  it('E on a forge, an anvil, a workbench or a loom opens its panel, told which thing it is', () => {
    for (const [type, station] of [['fixture/craft/forge', 'forge'], ['fixture/craft/anvil', 'anvil'], ['fixture/craft/workbench', 'workbench'], ['fixture/craft/loom', 'loom']]) {
      const eng = world([{ key: 'it', type, x: 2, y: 1 }])
      eng.act('hands', 'actor', { e: 'it' })
      expect(eng.world.fx, type).toContainEqual(expect.objectContaining({ t: 'panel', panel: `station:${station}`, by: 'it' }))
    }
  })

  it('a lit forge opens too (its panel, not a warming of the hands)', () => {
    const eng = world([{ key: 'forge', type: 'fixture/craft/forge', x: 2, y: 1, statuses: ['lit'] }])
    eng.act('hands', 'actor', { e: 'forge' })
    expect(eng.world.fx).toContainEqual(expect.objectContaining({ t: 'panel', panel: 'station:forge', by: 'forge' }))
  })

  it('smelting is made at the forge the act names (the one opened), within the hand\'s reach', () => {
    const eng = world([{ key: 'forge', type: 'fixture/craft/forge', x: 2, y: 1 }])
    const c = eng.controls
    give(eng, 'item/material/iron_ore', 2)
    give(eng, 'item/material/coal', 1)
    c.sync()
    expect(c.craft(smelt(), 'forge')).toBe(true)
    expect(c.count('item/material/iron_ingot')).toBe(2)
    expect(c.count('item/material/iron_ore')).toBe(0)
  })

  it('a forge out of reach makes nothing, named or not; a thing named that is no forge makes nothing', () => {
    const eng = world([{ key: 'forge', type: 'fixture/craft/forge', x: 2, y: 6 }, { key: 'bed', type: 'fixture/furniture/bed', x: 2, y: 1 }])
    const c = eng.controls
    give(eng, 'item/material/iron_ore', 2)
    give(eng, 'item/material/coal', 1)
    c.sync()
    // (the act is made; its outcome refuses it, and says so)
    c.craft(smelt(), 'forge')
    c.craft(smelt())
    c.craft(smelt(), 'bed')
    expect(c.count('item/material/iron_ingot')).toBe(0)
    expect(c.count('item/material/iron_ore')).toBe(2)
    expect(eng.world.fx.filter((x) => x.t === 'log' && /made at a forge/.test(String((x as { text: { en: string } }).text.en)))).toHaveLength(3)
  })

  it('bars are worked at the anvil opened, a hammer carried', () => {
    const eng = world([{ key: 'anvil', type: 'fixture/craft/anvil', x: 2, y: 1 }])
    const c = eng.controls
    give(eng, 'item/material/iron_ingot', 1)
    give(eng, 'item/material/plank', 1)
    give(eng, 'item/tool/smith_hammer', 1)
    c.sync()
    expect(c.craft(RECIPE_BY_ID['smith/dagger-iron'], 'anvil')).toBe(true)
    expect(c.count('item/weapon/blade/dagger')).toBe(1)
  })
})

describe('a building raised again unlocks more (its fact at a higher level), and the arcane workshop is a station of its own', () => {
  it('a candle waits for Workshop II: not at the Workshop alone', () => {
    const eng = world([])
    const c = eng.controls
    give(eng, 'item/food/honey', 1)
    give(eng, 'item/material/grass', 1)
    c.sync()
    const candle = RECIPE_BY_ID['craft/candle']
    expect(candle.unlockedBy).toMatchObject({ fact: 'haven.build.workshop', level: 2 })
    eng.author(() => eng.world.setFact('haven.build.workshop', 1))
    expect(c.craft(candle)).toBe(false)
    eng.author(() => eng.world.setFact('haven.build.workshop', 2))
    expect(c.craft(candle)).toBe(true)
    expect(c.count('item/light/candle')).toBe(2)
  })

  it('the arcane workbench opens by a hand on it; a wand, a draught and a spell book are made there once the workshop stands, a fire staff once it is raised again', () => {
    const eng = world([{ key: 'table', type: 'fixture/craft/arcane', x: 2, y: 1 }])
    const c = eng.controls
    eng.act('hands', 'actor', { e: 'table' })
    expect(eng.world.fx).toContainEqual(expect.objectContaining({ t: 'panel', panel: 'station:arcane', by: 'table' }))
    give(eng, 'item/material/stick', 3)
    give(eng, 'item/gem', 3)
    give(eng, 'item/material/herb', 2)
    give(eng, 'item/food/honey', 1)
    give(eng, 'item/material/leather', 1)
    give(eng, 'item/material/fireweed', 3)
    c.sync()
    expect(c.craft(RECIPE_BY_ID['arcane/wand'], 'table')).toBe(false)
    eng.author(() => eng.world.setFact('haven.build.arcane', 1))
    expect(c.craft(RECIPE_BY_ID['arcane/wand'], 'table')).toBe(true)
    expect(c.count('item/weapon/magic/wand')).toBe(1)
    expect(c.craft(RECIPE_BY_ID['arcane/healing'], 'table')).toBe(true)
    expect(c.count('item/potion/healing')).toBe(1)
    expect(c.craft(RECIPE_BY_ID['arcane/book-fireball'], 'table')).toBe(true)
    const book = Object.values(eng.world.state.entities).find((e) => e.type === 'item/document/skillbook')!
    expect(book.props?.teaches).toBe('fireball')
    // the fire staff: Arcane Workshop II
    give(eng, 'item/material/fireweed', 2)
    give(eng, 'item/gem', 1)
    c.sync()
    expect(c.craft(RECIPE_BY_ID['arcane/staff-fire'], 'table')).toBe(false)
    eng.author(() => eng.world.setFact('haven.build.arcane', 2))
    expect(c.craft(RECIPE_BY_ID['arcane/staff-fire'], 'table')).toBe(true)
    const staff = Object.values(eng.world.state.entities).find((e) => e.type === 'item/weapon/magic/staff')!
    expect([eng.world.materialOf(staff)?.id, eng.world.prop(staff, 'element'), eng.world.hasTag(staff, 'element:fire')]).toEqual(['wood', 'fire', true])
    // away from the table (not named, none beside): nothing
    const far = world([{ key: 'table', type: 'fixture/craft/arcane', x: 2, y: 6 }])
    give(far, 'item/material/stick', 1)
    give(far, 'item/gem', 1)
    far.controls.sync()
    far.author(() => far.world.setFact('haven.build.arcane', 1))
    far.controls.craft(RECIPE_BY_ID['arcane/wand'])
    expect(far.controls.count('item/weapon/magic/wand')).toBe(0)
  })

  it('every spell book the arcane workshop writes teaches a skill the tree has, and every upgrade of a fact comes after the one before', () => {
    for (const r of RECIPES.filter((x) => x.id.startsWith('arcane/book-'))) expect(SKILL_BY_ID[String(r.make.props?.teaches)]?.active, r.id).toBeDefined()
    for (const u of HAVEN_UPGRADES) if (u.value > 1) expect(HAVEN_UPGRADES.some((x) => x.fact === u.fact && x.value === u.value - 1), u.id).toBe(true)
  })
})

