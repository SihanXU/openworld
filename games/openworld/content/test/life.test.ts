// The life branches, deeper (content life.ts): each skill's mark on what the world gives — played through the same entry
// point as the player's keys (controls.plan + run) or the crafting panel (controls.craft), in a sandbox.

import { describe, expect, it } from 'vitest'
import { OntologyIndex, RuleLibrary, SANDBOX_MAP, buildSandbox, type Engine, type Key, type ScenarioEntity } from '@openworld/engine'
import { BASE_RULES, LIFE_SKILLS, RECIPE_BY_ID, SKILLS, buildOntology } from '../src/index.ts'
import GAME from '../src/game.ts'

const onto = buildOntology()
const DAY = 14400

/** A 5×3 patch of `ground` (row 1), the player at (2,2) facing up, these things placed. */
function patch(entities: Omit<ScenarioEntity, 'key'>[] = [], ground = 'grass', row1 = ground): Engine {
  const eng = buildSandbox(
    {
      terrain: [Array(5).fill(ground), Array(5).fill(row1), Array(5).fill(ground)],
      entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, ...entities.map((e, i) => ({ key: `x${i}`, ...e }))],
      event: {},
    },
    onto,
    new RuleLibrary(BASE_RULES),
  )
  eng.world.get('actor')!.facing = 'up'
  return eng
}
/** The player knows a skill: its tag and what it grants (as learning does). */
const knows = (eng: Engine, ...ids: string[]) =>
  eng.author(() => {
    const w = eng.world
    for (const id of ids) {
      const def = SKILLS.find((s) => s.id === id)!
      w.addTag(w.player, `skill:${id}`)
      for (const [k, v] of Object.entries(def.grant ?? {})) w.setProp(w.player, k, w.num(w.player, k) + v)
    }
  })
/** Carry so many of a type. */
const carry = (eng: Engine, type: string, n = 1, props?: Record<string, number>) =>
  eng.author(() => { for (let i = 0; i < n; i++) eng.world.create(type, { on: 'inside', holder: 'actor' }, props ? { props } : {}) })
const hold = (eng: Engine, type: string) => {
  eng.author(() => {
    const old = eng.world.get(eng.world.player.held)
    if (old) eng.world.destroy(old)
    eng.world.create(type, { on: 'hand', holder: 'actor' })
  })
  eng.controls.sync()
}
/** Press a key at the tile in front (1 up), holding a fresh `type`. */
const press = (eng: Engine, key: Key, type?: string) => {
  if (type) hold(eng, type)
  const plan = eng.controls.plan(key)
  if (plan) eng.controls.run(plan, true)
  for (let i = 0; i < 3; i++) eng.tick()
}
const count = (eng: Engine, type: string) => Object.values(eng.world.state.entities).filter((e) => e.type === type).length
const bag = (eng: Engine, type: string) => eng.controls.count(type)

describe('crafting and stall pickup feedback', () => {
  const forms = new OntologyIndex(onto)
  const shop = () => patch([{ type: 'fixture/furniture/stall/trade', x: 1, y: 2 }])
  const pickups = (eng: Engine) => eng.world.fx.filter((fx) => fx.t === 'pickup')
  const output = (type: string, count: number) => ({ name: forms.resolve(type).name, sprite: forms.resolve(type).sprite, count })

  it('buying a five-piece pack announces all five of the purchased item', () => {
    const eng = shop()
    carry(eng, 'item/misc/thornmark', 5)
    expect(eng.controls.craft(RECIPE_BY_ID['shop/buy/misc-bait'])).toBe(true)
    expect(bag(eng, 'item/misc/bait')).toBe(5)
    expect(bag(eng, 'item/misc/thornmark')).toBe(0)
    expect(pickups(eng)).toEqual([expect.objectContaining(output('item/misc/bait', 5))])
  })

  it('selling a sunfish announces six coins, while the shelf still names the fish', () => {
    const eng = shop()
    carry(eng, 'item/food/fish/sunfish')
    const sale = RECIPE_BY_ID['shop/sell/food-fish-sunfish']
    expect(sale.name).toEqual(forms.resolve('item/food/fish/sunfish').name)
    expect(eng.controls.craft(sale)).toBe(true)
    expect(bag(eng, 'item/food/fish/sunfish')).toBe(0)
    expect(bag(eng, 'item/misc/thornmark')).toBe(6)
    expect(pickups(eng)).toEqual([expect.objectContaining(output('item/misc/thornmark', 6))])
    expect(eng.world.get(pickups(eng)[0].item)?.type).toBe('item/misc/thornmark')
  })

  it('selling all three fish reports each real payout without duplicating coins', () => {
    const eng = shop()
    carry(eng, 'item/food/fish/sunfish', 3)
    expect(eng.controls.craftAll(RECIPE_BY_ID['shop/sell/food-fish-sunfish'])).toBe(3)
    expect(bag(eng, 'item/food/fish/sunfish')).toBe(0)
    expect(bag(eng, 'item/misc/thornmark')).toBe(18)
    expect(pickups(eng)).toEqual(Array.from({ length: 3 }, () => expect.objectContaining(output('item/misc/thornmark', 6))))
  })

  it('buying with the seed merchant skill reports the final eight-piece output', () => {
    const eng = shop()
    knows(eng, 'seed-merchant')
    carry(eng, 'item/misc/thornmark', 5)
    expect(eng.controls.craft(RECIPE_BY_ID['shop/buy/seed-wheat'])).toBe(true)
    expect(bag(eng, 'item/seed/wheat')).toBe(8)
    expect(pickups(eng)).toEqual([expect.objectContaining(output('item/seed/wheat', 8))])
  })

  it('ordinary crafting reports its real quantity and the resulting custom name', () => {
    const eng = patch()
    carry(eng, 'item/material/wheat', 2)
    const name = { en: 'Prepared Feed', zh: '配好的饲料' }
    const recipe = { ...RECIPE_BY_ID['ranch/feed'], name: 'A feed order', make: { type: 'item/material/feed', name } }
    expect(eng.controls.craft(recipe)).toBe(true)
    expect(bag(eng, 'item/material/feed')).toBe(3)
    expect(pickups(eng)).toEqual([expect.objectContaining({ ...output('item/material/feed', 3), name })])
  })
})

describe('the life branches have twenty nodes each', () => {
  it('gathering, agriculture, husbandry and smithing: twenty each, a capstone (two points) to each', () => {
    for (const branch of ['gathering', 'agriculture', 'husbandry', 'smithing']) {
      const own = SKILLS.filter((s) => s.branch === branch)
      expect(own.length, branch).toBe(20)
      expect(own.filter((s) => s.cost === 2).length, branch).toBeGreaterThanOrEqual(1)
    }
    expect(LIFE_SKILLS).toHaveLength(76)
  })
})

describe('smithing', () => {
  /** Beside a forge (left) and an anvil (right). */
  const smithy = () => patch([{ type: 'fixture/craft/forge', x: 1, y: 2 }, { type: 'fixture/craft/anvil', x: 3, y: 2 }])

  it('ore and coal smelt to two bars at a forge (an efficient smelter gets twice that); steel and gold are for those who learned them', () => {
    const eng = smithy()
    carry(eng, 'item/material/iron_ore', 10)
    carry(eng, 'item/material/coal', 8)
    expect(eng.controls.craft(RECIPE_BY_ID['smith/smelt-iron'])).toBe(true)
    expect(bag(eng, 'item/material/iron_ingot')).toBe(2)
    expect(eng.world.materialOf(eng.world.get(eng.world.player.contents!.find((id) => eng.world.get(id)?.type === 'item/material/iron_ingot'))!)?.id).toBe('iron')
    knows(eng, 'efficient-smelting')
    expect(eng.controls.craft(RECIPE_BY_ID['smith/smelt-iron'])).toBe(true)
    expect(bag(eng, 'item/material/iron_ingot')).toBe(6)
    // steel: not without Steelworking
    expect(eng.controls.craft(RECIPE_BY_ID['smith/smelt-steel'])).toBe(false)
    knows(eng, 'steelworking')
    expect(eng.controls.craft(RECIPE_BY_ID['smith/smelt-steel'])).toBe(true)
  })

  it('ingots worked on an anvil with a hammer: the gear takes their metal; a weaponsmith\'s strikes harder, an armorsmith\'s guards better, a fine craftsman\'s is finer', () => {
    const eng = smithy()
    carry(eng, 'item/tool/smith_hammer')
    eng.author(() => { for (let i = 0; i < 12; i++) eng.world.create('item/material/iron_ingot', { on: 'inside', holder: 'actor' }) })
    carry(eng, 'item/material/plank', 4)
    const made = (type: string) => Object.values(eng.world.state.entities).filter((e) => e.type === type)
    expect(eng.controls.craft(RECIPE_BY_ID['smith/sword-iron'])).toBe(true)
    const plain = made('item/weapon/blade/sword')[0]
    expect(eng.world.materialOf(plain)?.id).toBe('iron')
    knows(eng, 'weaponsmith')
    expect(eng.controls.craft(RECIPE_BY_ID['smith/sword-iron'])).toBe(true)
    const better = made('item/weapon/blade/sword').find((e) => e.id !== plain.id)!
    expect(eng.world.num(better, 'power')).toBe(eng.world.num(plain, 'power') + 1)
    knows(eng, 'armorsmith')
    expect(eng.controls.craft(RECIPE_BY_ID['smith/helmet-iron'])).toBe(true)
    // the heavy arms and the plate: not without their skills, nor before the Held Ground's smithy has its bellows
    expect(eng.controls.craft(RECIPE_BY_ID['smith/warhammer-iron'])).toBe(false)
    expect(eng.controls.craft(RECIPE_BY_ID['smith/breastplate-iron'])).toBe(false)
    expect(RECIPE_BY_ID['smith/warhammer-iron'].unlockedBy).toMatchObject({ fact: 'haven.build.smithy' })
    expect(RECIPE_BY_ID['smith/dagger-iron'].unlockedBy).toBeUndefined()
    // the craft lifts the quality (level 1 + Apprentice 1 + Fine Craft 2 + Grandmaster 3, against the dagger's 1: fine and better)
    knows(eng, 'apprentice-smith', 'fine-craft', 'grandmaster-smith')
    expect(eng.controls.craft(RECIPE_BY_ID['smith/dagger-iron'])).toBe(true)
    expect(made('item/weapon/blade/dagger')[0].tags?.some((t) => t === 'quality:masterwork' || t === 'quality:fine')).toBe(true)
  })

  it('a set\'s piece is of the metal it took and as well as its smith forges, under the set\'s name; what another named recipe makes is as the recipe says (Recipe.madeOf)', () => {
    const eng = smithy()
    const w = eng.world
    const made = (type: string) => Object.values(w.state.entities).filter((e) => e.type === type)
    // feed made by hand at the first level, before any quality is in reach
    carry(eng, 'item/material/wheat', 4)
    expect(eng.controls.craft(RECIPE_BY_ID['ranch/feed'])).toBe(true)
    const [old] = made('item/material/feed')
    // a smith far past every recipe's level: what is made of a material and a quality shows both
    eng.author(() => w.setProp(w.player, 'level', 9))
    knows(eng, 'forge-builder')
    carry(eng, 'item/tool/smith_hammer')
    carry(eng, 'item/material/steel_bar', 2)
    carry(eng, 'item/material/leather', 1)
    expect(RECIPE_BY_ID['set/shadowfang/weapon'].madeOf).toBe(true)
    // a set's piece: only once the smithy's anvil is hardened (haven.build.smithy 2)
    expect(RECIPE_BY_ID['set/shadowfang/weapon'].unlockedBy).toEqual({ fact: 'haven.build.smithy', name: expect.anything(), level: 2 })
    expect(eng.controls.craft(RECIPE_BY_ID['set/shadowfang/weapon'])).toBe(false)
    eng.author(() => w.setFact('haven.build.smithy', 2))
    expect(eng.controls.craft(RECIPE_BY_ID['set/shadowfang/weapon'])).toBe(true)
    const blade = made('item/weapon/blade/dagger')[0]
    expect(blade.tags).toEqual(expect.arrayContaining(['material:steel', 'quality:masterwork']))
    expect([blade.name, blade.props?.critChance]).toEqual([{ en: 'Shadowfang', zh: '影刃' }, 0.03])
    // a smith's anvil made of iron at the forge: the anvil the recipe names, not an iron one of masterwork
    carry(eng, 'item/material/iron_ingot', 3)
    expect(RECIPE_BY_ID['smith/anvil'].madeOf).toBeUndefined()
    expect(eng.controls.craft(RECIPE_BY_ID['smith/anvil'])).toBe(true)
    const anvil = made('fixture/craft/anvil/smith')[0]
    expect([anvil.name, anvil.tags]).toEqual([{ en: "Smith's Anvil", zh: '铁匠砧' }, undefined])
    // feed made by hand at that level is feed, and keeps with the feed made before (one slot: Controls.key)
    const before = new Set(made('item/material/feed').map((e) => e.id))
    expect(eng.controls.craft(RECIPE_BY_ID['ranch/feed'])).toBe(true)
    const feed = made('item/material/feed').filter((e) => !before.has(e.id))
    expect(feed.length).toBeGreaterThan(0)
    for (const f of feed) expect([f.tags, eng.controls.key(f)]).toEqual([undefined, eng.controls.key(old)])
  })
})

describe('smithing in an older save', () => {
  it('a Masterwork learned before the engine named the lift (`anvil:masterwork`) is the lift (`anvil:lift`) once loaded', () => {
    const eng = patch()
    const w = eng.world
    eng.author(() => w.setProp(w.player, 'anvil:masterwork', 0.15))
    eng.author(() => GAME.upgradeSave!(eng))
    expect(w.num(w.player, 'anvil:lift')).toBe(0.15)
    expect(w.player.props?.['anvil:masterwork']).toBeUndefined()
    // the skill grants the lift itself now
    expect(SKILLS.find((x) => x.id === 'masterwork')?.grant).toEqual({ 'anvil:lift': 0.15 })
  })
})

describe('agriculture', () => {
  it('a harvest: a root farmer gets two more roots, a farmer a seed more; picking by hand gives two to green fingers', () => {
    const eng = patch([{ type: 'fixture/crop/carrot/ripe', x: 2, y: 1 }], 'grass', 'farmland')
    press(eng, 'use', 'item/tool/sickle')
    const base = [count(eng, 'item/food/carrot'), count(eng, 'item/seed/carrot')]
    expect(base).toEqual([2, 2])
    const rich = patch([{ type: 'fixture/crop/carrot/ripe', x: 2, y: 1 }], 'grass', 'farmland')
    knows(rich, 'farmer', 'bountiful', 'root-farmer')
    press(rich, 'use', 'item/tool/sickle')
    expect([count(rich, 'item/food/carrot'), count(rich, 'item/seed/carrot')]).toEqual([2 + 1 + 2, 3])
    const hand = patch([{ type: 'fixture/crop/carrot/ripe', x: 2, y: 1 }], 'grass', 'farmland')
    knows(hand, 'green-fingers')
    press(hand, 'hands')
    expect(bag(hand, 'item/food/carrot')).toBe(2)
  })

  it('a wide hoe tills the ground around; sprinkler irrigation supplies both growth stages', () => {
    const eng = patch()
    knows(eng, 'wide-hoe')
    press(eng, 'use', 'item/tool/hoe')
    const farmland = () => [0, 1, 2, 3, 4].flatMap((x) => [0, 1, 2].map((y) => eng.world.terrainAt(SANDBOX_MAP, x, y))).filter((t) => t === 'farmland').length
    expect(farmland()).toBeGreaterThanOrEqual(5)
    const wet = patch([{ type: 'fixture/crop/carrot/sprout', x: 1, y: 1 }, { type: 'fixture/crop/carrot/sprout', x: 2, y: 1 }, { type: 'fixture/crop/carrot/sprout', x: 3, y: 1 }], 'grass', 'farmland')
    knows(wet, 'sprinkler', 'irrigation')
    press(wet, 'use', 'item/vessel/bucket/water')
    const sprouts = Object.values(wet.world.state.entities).filter((e) => e.type === 'fixture/crop/carrot/sprout')
    expect(sprouts.every((e) => wet.world.hasStatus({ e: e.id }, 'watered'))).toBe(true)
    const front = sprouts.find((e) => e.place.on === 'tile' && e.place.x === 2)!
    expect((front.statuses?.stage ?? 0) - wet.world.state.tick).toBeGreaterThan(1190)
    expect(wet.world.hasStatus({ e: front.id }, 'irrigated')).toBe(true)
    for (let i = 0; i < 2400; i++) wet.tick()
    expect(sprouts.every((e) => e.type === 'fixture/crop/carrot/ripe')).toBe(true)
    expect(sprouts.every((e) => !wet.world.hasStatus({ e: e.id }, 'watered'))).toBe(true)
  })

  it('a seed saver digs up two seeds more; a market gardener sells for more, a seed merchant buys more', () => {
    const eng = patch([{ type: 'fixture/crop/carrot/young', x: 2, y: 1 }], 'grass', 'farmland')
    knows(eng, 'seed-saver')
    press(eng, 'use', 'item/tool/shovel')
    expect(count(eng, 'item/seed/carrot')).toBe(3)
    const shop = patch([{ type: 'fixture/furniture/stall/trade', x: 1, y: 2 }])
    knows(shop, 'market-gardener', 'seed-merchant')
    carry(shop, 'item/food/cauliflower', 1)
    expect(shop.controls.craft(RECIPE_BY_ID['shop/sell/food-cauliflower'])).toBe(true)
    expect(bag(shop, 'item/misc/thornmark')).toBe(Math.round(18 * 1.25))
    expect(shop.controls.craft(RECIPE_BY_ID['shop/buy/seed-wheat'])).toBe(true)
    expect(bag(shop, 'item/seed/wheat')).toBe(Math.round(5 * 1.5))
  })
})

describe('husbandry', () => {
  it('a herdsman\'s feeding lasts two days; a stockman feeds the herd around; an egg collector\'s hen lays at once', () => {
    const eng = patch([{ type: 'actor/creature/animal/cow', x: 2, y: 1 }, { type: 'actor/creature/animal/cow', x: 3, y: 1 }, { type: 'actor/creature/animal/chicken', x: 1, y: 1 }])
    knows(eng, 'herdsman', 'stockman', 'egg-collector')
    press(eng, 'use', 'item/material/feed')
    const cows = Object.values(eng.world.state.entities).filter((e) => e.type === 'actor/creature/animal/cow')
    expect(cows.every((c) => eng.world.hasStatus({ e: c.id }, 'fed'))).toBe(true)
    expect(Math.max(...cows.map((c) => (c.statuses?.fed ?? 0) - eng.world.state.tick))).toBeGreaterThan(DAY)
    // the hen beside was fed with the herd, and laid
    expect(count(eng, 'item/food/egg/raw')).toBeGreaterThanOrEqual(1)
  })

  it('milk over a fire makes cheese (more for a cheesemaker); a butcher and a tanner take more from a cow; wheat makes feed (more for a feed maker)', () => {
    const eng = patch([{ type: 'fixture/light/campfire', x: 2, y: 1, statuses: ['lit'] }])
    knows(eng, 'cheesemaker')
    press(eng, 'use', 'item/vessel/bucket/milk')
    expect(bag(eng, 'item/food/cheese')).toBe(3)
    expect(bag(eng, 'item/vessel/bucket/empty')).toBe(1)
    const cow = patch([{ type: 'actor/creature/animal/cow', x: 2, y: 1, props: { hp: 1 } }])
    knows(cow, 'butcher', 'tanner')
    cow.setCooldown('atk:actor', 0)
    cow.attack(cow.world.player, { e: Object.values(cow.world.state.entities).find((e) => e.type === 'actor/creature/animal/cow')!.id })
    for (let i = 0; i < 3; i++) cow.tick()
    expect(count(cow, 'item/material/leather')).toBe(1)
    expect(count(cow, 'item/food/meat/raw')).toBe(2 + 1)
    const feed = patch()
    carry(feed, 'item/material/wheat', 4)
    expect(feed.controls.craft(RECIPE_BY_ID['ranch/feed'])).toBe(true)
    expect(bag(feed, 'item/material/feed')).toBe(3)
    knows(feed, 'feed-maker')
    expect(feed.controls.craft(RECIPE_BY_ID['ranch/feed'])).toBe(true)
    expect(bag(feed, 'item/material/feed')).toBe(3 + 5)
  })
})

describe('gathering', () => {
  it('a prospector gets an ore more from a vein; a heavy pick strikes harder; a stonecutter gets a stone more from a boulder', () => {
    const ore = (skills: string[]) => {
      const eng = patch([{ type: 'fixture/nature/vein/iron', x: 2, y: 1, props: { hp: 1 } }])
      knows(eng, ...skills)
      press(eng, 'use', 'item/tool/pickaxe')
      return count(eng, 'item/material/iron_ore')
    }
    expect(ore(['prospector'])).toBe(ore([]) + 1)
    const hit = (skills: string[]) => {
      const eng = patch([{ type: 'fixture/nature/boulder', x: 2, y: 1 }])
      knows(eng, ...skills)
      press(eng, 'use', 'item/tool/pickaxe')
      const b = Object.values(eng.world.state.entities).find((e) => e.type === 'fixture/nature/boulder')!
      return 12 - eng.world.num(b, 'hp')
    }
    expect(hit(['heavy-pick'])).toBeGreaterThan(hit([]))
    const stone = (skills: string[]) => {
      const eng = patch([{ type: 'fixture/nature/boulder', x: 2, y: 1, props: { hp: 1 } }])
      knows(eng, ...skills)
      press(eng, 'use', 'item/tool/pickaxe')
      return count(eng, 'item/material/stone')
    }
    expect(stone(['stonecutter'])).toBe(stone([]) + 1)
  })

  it('a carpenter splits a log into three planks; a herbalist draws twice the good from a herb; a master angler brings up a fish more', () => {
    const eng = patch([{ type: 'item/material/log', x: 2, y: 1 }])
    knows(eng, 'carpenter')
    press(eng, 'use', 'item/weapon/blade/axe')
    expect(count(eng, 'item/material/plank')).toBe(3)
    const herb = patch()
    knows(herb, 'herbalist')
    herb.author(() => herb.world.setProp(herb.world.player, 'hp', 1))
    hold(herb, 'item/material/herb')
    const heal = herb.world.num(herb.world.get(herb.world.player.held)!, 'heal')
    herb.controls.run(herb.controls.plan('self')!, true)
    for (let i = 0; i < 3; i++) herb.tick()
    expect(herb.world.num(herb.world.player, 'hp')).toBe(Math.min(herb.world.num(herb.world.player, 'maxHp'), 1 + heal * 2 + 2))
    // fishing until something bites: a master angler's catch comes with a fish more
    const pond = patch([], 'grass', 'water')
    knows(pond, 'master-angler')
    hold(pond, 'item/tool/fishing_rod')
    // (a cast stirs the water: the next waits for it to settle)
    for (let i = 0; i < 80 && (pond.world.player.contents?.length ?? 0) === 0; i++) {
      const plan = pond.controls.plan('use')
      if (plan) pond.controls.run(plan, true)
      for (let t = 0; t < 101; t++) pond.tick()
    }
    expect(pond.world.player.contents?.length ?? 0).toBeGreaterThanOrEqual(2)
  })
})
