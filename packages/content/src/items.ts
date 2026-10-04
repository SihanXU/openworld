// The item catalogue. Item TYPES are forms (sword, bucket, bread…); INSTANCES vary by
// material × quality × element, carried as tags and props, so type-level rules address
// whole classes while the world still holds tens of thousands of distinct items.

import { gearProps, type Entity, type MaterialDef, type PropValue, type QualityDef, type Rng, type TypeDef } from '@lsw/engine'
import { VEGETABLE_CROPS } from './crops.ts'

export interface Form {
  id: string // full type path
  en: string
  zh: string
  sprite: string
  tags?: string[]
  props?: Record<string, PropValue>
  /** Materials this form can be made of (instances pick one). */
  materials?: string[]
  /** Can carry an element (weapons, wands, gems, scrolls). */
  elemental?: boolean
  /** Relative spawn weight per context. */
  where?: Partial<Record<Context, number>>
  /** What it is made of (its main ingredient first, whose material it takes), and where (world-model.md §6.4). */
  makeup?: TypeDef['makeup']
  station?: string
  craftLevel?: number
}

export type Context = 'home' | 'shop' | 'smithy' | 'inn' | 'temple' | 'library' | 'wild' | 'dungeon' | 'farm' | 'npc'

export interface Material {
  id: string
  en: string
  zh: string
  tags: string[]
  /** What it makes of a weapon's power and a worn thing's defence: factors (world-model.md §6.8, Elin's material atk and pv). */
  attack: number
  defence: number
  value: number // value multiplier
  color: string
  /** What tools work on (world-model.md §4.5): wood, plant, stone, ore, metal, soil, fibre, skin, bone, organic, flesh, crystal. */
  category: string
  /** An instrument softer than what it strikes does nothing to it. */
  hardness: number
}

export const MATERIALS: Record<string, Material> = {
  wood: { id: 'wood', en: 'Wooden', zh: '木', tags: ['wooden', 'flammable'], attack: 0.75, defence: 0.75, value: 0.6, color: '#a0703c', category: 'wood', hardness: 1 },
  bronze: { id: 'bronze', en: 'Bronze', zh: '青铜', tags: ['metal', 'conductive'], attack: 1.25, defence: 1.25, value: 0.9, color: '#b8783a', category: 'metal', hardness: 3 },
  iron: { id: 'iron', en: 'Iron', zh: '铁', tags: ['metal', 'conductive'], attack: 1.5, defence: 1.5, value: 1, color: '#8a8f98', category: 'metal', hardness: 4 },
  steel: { id: 'steel', en: 'Steel', zh: '钢', tags: ['metal', 'conductive'], attack: 1.75, defence: 1.75, value: 1.6, color: '#b9c2cc', category: 'metal', hardness: 5 },
  silver: { id: 'silver', en: 'Silver', zh: '银', tags: ['metal', 'conductive', 'holy'], attack: 1.5, defence: 1.25, value: 2.5, color: '#dfe6ee', category: 'metal', hardness: 3 },
  gold: { id: 'gold', en: 'Golden', zh: '金', tags: ['metal', 'conductive', 'precious'], attack: 1.25, defence: 1, value: 5, color: '#e9c24a', category: 'metal', hardness: 2 },
  bone: { id: 'bone', en: 'Bone', zh: '骨', tags: ['bone'], attack: 1.25, defence: 1, value: 0.5, color: '#e8e0c8', category: 'bone', hardness: 2 },
  stone: { id: 'stone', en: 'Stone', zh: '石', tags: ['stone'], attack: 1.25, defence: 1, value: 0.4, color: '#8d8a84', category: 'stone', hardness: 2 },
  crystal: { id: 'crystal', en: 'Crystal', zh: '水晶', tags: ['crystal', 'fragile', 'arcane'], attack: 1.75, defence: 1, value: 3, color: '#9fe3f0', category: 'crystal', hardness: 4 },
  glass: { id: 'glass', en: 'Glass', zh: '玻璃', tags: ['glass', 'fragile'], attack: 1, defence: 0.5, value: 0.8, color: '#cfeff7', category: 'crystal', hardness: 1 },
  clay: { id: 'clay', en: 'Clay', zh: '陶', tags: ['clay', 'fragile'], attack: 1, defence: 0.5, value: 0.4, color: '#b86a44', category: 'soil', hardness: 0 },
  leather: { id: 'leather', en: 'Leather', zh: '皮', tags: ['leather', 'flammable'], attack: 1, defence: 1, value: 0.8, color: '#7a4b2a', category: 'skin', hardness: 1 },
  cloth: { id: 'cloth', en: 'Cloth', zh: '布', tags: ['cloth', 'flammable'], attack: 1, defence: 0.5, value: 0.5, color: '#c9b79c', category: 'fibre', hardness: 0 },
  silk: { id: 'silk', en: 'Silk', zh: '丝', tags: ['cloth', 'flammable', 'precious'], attack: 1, defence: 0.75, value: 2.2, color: '#e7c6d8', category: 'fibre', hardness: 0 },
  obsidian: { id: 'obsidian', en: 'Obsidian', zh: '黑曜石', tags: ['stone', 'volcanic', 'fragile'], attack: 2, defence: 1.25, value: 2.4, color: '#2d2438', category: 'stone', hardness: 4 },
  mithril: { id: 'mithril', en: 'Mithril', zh: '秘银', tags: ['metal', 'arcane'], attack: 2.25, defence: 2.25, value: 6, color: '#bfe0ff', category: 'metal', hardness: 6 },
  ringsteel: { id: 'ringsteel', en: 'Ringsteel', zh: '环钢', tags: ['metal', 'ancient', 'runic', 'conductive'], attack: 2.5, defence: 2.5, value: 8, color: '#9ad0c2', category: 'metal', hardness: 7 },
}

/** What else things are made of (the world's own: bodies, plants, the ground) — never an item's material. */
const NATURAL: MaterialDef[] = [
  { id: 'flesh', category: 'flesh', hardness: 0 },
  { id: 'plant', category: 'plant', hardness: 0 },
  { id: 'gel', category: 'organic', hardness: 0 },
  { id: 'earth', category: 'soil', hardness: 0 },
  { id: 'ice', category: 'crystal', hardness: 1 },
  { id: 'ore', category: 'ore', hardness: 2 },
]

/** Every material, as the world reads it (world-model.md §4.5): its category and hardness. */
export const MATERIAL_DEFS: Record<string, MaterialDef> = Object.fromEntries([
  ...Object.values(MATERIALS).map((m) => ({ id: m.id, category: m.category, hardness: m.hardness, name: { en: m.en, zh: m.zh }, tags: m.tags, attack: m.attack, defence: m.defence })),
  ...NATURAL,
].map((m) => [m.id, m]))

/** The qualities as the world reads them: a maker reaches each by how far above the recipe's level they are (legendary: never by making). */
export const QUALITY_DEFS = (): QualityDef[] =>
  QUALITIES.map((q) => ({ id: q.id, tag: q.id === 'common' ? undefined : `quality:${q.id}`, name: q.en ? { en: q.en, zh: q.zh } : undefined, factor: q.factor, from: QUALITY_FROM[q.id] }))
const QUALITY_FROM: Record<string, number | undefined> = { crude: -99, common: 0, fine: 3, masterwork: 6 }

export const QUALITIES = [
  // a quality's factor on power and defence (Elin's rarity: crude 120/150, superior 120/100, legendary 120/80)
  { id: 'crude', en: 'Crude', zh: '粗制', factor: 0.8, value: 0.5, w: 3 },
  { id: 'common', en: '', zh: '', factor: 1, value: 1, w: 8 },
  { id: 'fine', en: 'Fine', zh: '精良', factor: 1.25, value: 1.8, w: 3 },
  { id: 'masterwork', en: 'Masterwork', zh: '大师', factor: 1.5, value: 3.5, w: 1 },
  { id: 'legendary', en: 'Legendary', zh: '传说', factor: 2, value: 9, w: 0.15 },
]

export const ELEMENT_NAMES: Record<string, { en: string; zh: string }> = {
  fire: { en: 'of Embers', zh: '炽焰' },
  water: { en: 'of Tides', zh: '潮汐' },
  ice: { en: 'of Frost', zh: '寒霜' },
  lightning: { en: 'of Storms', zh: '雷霆' },
  wind: { en: 'of Gales', zh: '疾风' },
  earth: { en: 'of Stone', zh: '岩土' },
}

const WEAPON_METALS = ['bronze', 'iron', 'steel', 'silver', 'obsidian', 'mithril', 'ringsteel', 'bone']
const TOOL_METALS = ['bronze', 'iron', 'steel']
const W = (id: string, en: string, zh: string, sprite: string, rest: Partial<Form> = {}): Form => ({ id, en, zh, sprite, ...rest })

export const FORMS: Form[] = [
  // weapons
  W('item/weapon/blade/sword', 'Sword', '剑', 'item:sword', { props: { power: 4 }, materials: WEAPON_METALS, elemental: true, where: { smithy: 5, dungeon: 3, shop: 1 } }),
  W('item/weapon/blade/dagger', 'Dagger', '匕首', 'item:dagger', { props: { power: 2 }, materials: WEAPON_METALS, elemental: true, where: { smithy: 3, dungeon: 2, home: 0.5, npc: 1 } }),
  W('item/weapon/blade/axe', 'Axe', '斧', 'item:axe', { tags: ['tool:axe'], props: { power: 4 }, materials: TOOL_METALS, elemental: true, where: { smithy: 3, farm: 2, wild: 0.5 }, makeup: [{ type: 'item/material/stone', count: 1 }, { type: 'item/material/stick', count: 1 }, { type: 'item/material/grass', count: 1 }], station: 'hands' }),
  // the smith of Emberfall's blade, forged for the dragon (the main quest)
  W('item/weapon/blade/dragonsbane', 'Dragonsbane', '屠龙剑', 'item:sword', { tags: ['dragonsbane', 'quality:legendary'], props: { power: 12 }, where: {} }),
  W('item/weapon/blade/scimitar', 'Scimitar', '弯刀', 'item:sword', { props: { power: 4 }, materials: WEAPON_METALS, elemental: true, where: { dungeon: 1, smithy: 1 } }),
  W('item/weapon/blunt/club', 'Club', '棍棒', 'item:club', { props: { power: 2 }, materials: ['wood', 'bone'], where: { wild: 1, npc: 1, dungeon: 1 }, makeup: [{ type: 'item/material/log', count: 1 }], station: 'workbench' }),
  W('item/weapon/blunt/mace', 'Mace', '钉锤', 'item:mace', { props: { power: 4 }, materials: WEAPON_METALS, elemental: true, where: { smithy: 2, dungeon: 2 } }),
  W('item/weapon/blunt/warhammer', 'Warhammer', '战锤', 'item:hammer', { props: { power: 5 }, materials: WEAPON_METALS, elemental: true, where: { smithy: 1, dungeon: 1 } }),
  W('item/weapon/polearm/spear', 'Spear', '长矛', 'item:spear', { props: { power: 4, range: 2 }, materials: WEAPON_METALS, elemental: true, where: { smithy: 2, dungeon: 1, npc: 0.5 } }),
  W('item/weapon/polearm/halberd', 'Halberd', '戟', 'item:spear', { props: { power: 5, range: 2 }, materials: WEAPON_METALS, elemental: true, where: { smithy: 1, dungeon: 1 } }),
  W('item/weapon/ranged/bow', 'Bow', '弓', 'item:bow', { props: { power: 3, range: 6 }, materials: ['wood', 'bone'], elemental: true, where: { smithy: 1, wild: 0.3, dungeon: 1 }, makeup: [{ type: 'item/material/stick', count: 2 }, { type: 'item/material/grass', count: 3 }], station: 'workbench', craftLevel: 2 }),
  W('item/weapon/magic/wand', 'Wand', '魔杖', 'item:wand', { tags: ['arcane'], props: { power: 3, range: 5 }, materials: ['wood', 'crystal', 'bone', 'silver'], elemental: true, where: { library: 3, temple: 1, dungeon: 2, shop: 0.5 } }),
  W('item/weapon/magic/staff', 'Staff', '法杖', 'item:staff', { tags: ['arcane'], props: { power: 5, range: 4 }, materials: ['wood', 'crystal', 'bone', 'mithril'], elemental: true, where: { library: 1, dungeon: 1 } }),
  // armour and clothing: put on oneself, worn in a slot (world-model.md §6.8); armour adds its defence
  W('item/armor/helmet', 'Helmet', '头盔', 'item:helmet', { tags: ['wearable'], props: { def: 1, slot: 'head' }, materials: ['iron', 'steel', 'bronze', 'leather', 'bone'], where: { smithy: 2, dungeon: 1 } }),
  W('item/armor/shield', 'Shield', '盾牌', 'item:shield', { tags: ['wearable'], props: { def: 2, slot: 'arm' }, materials: ['wood', 'iron', 'steel', 'bronze'], where: { smithy: 2, dungeon: 1 }, makeup: [{ type: 'item/material/plank', count: 3 }, { type: 'item/material/stick', count: 1 }], station: 'workbench' }),
  W('item/armor/breastplate', 'Breastplate', '胸甲', 'item:armor', { tags: ['wearable'], props: { def: 3, slot: 'body' }, materials: ['iron', 'steel', 'leather', 'mithril'], where: { smithy: 1, dungeon: 0.5 } }),
  W('item/clothing/cloak', 'Cloak', '斗篷', 'item:cloak', { tags: ['wearable'], props: { slot: 'back' }, materials: ['cloth', 'leather', 'silk'], where: { home: 2, shop: 1 } }),
  W('item/clothing/hat', 'Hat', '帽子', 'item:hat', { tags: ['wearable'], props: { slot: 'head' }, materials: ['cloth', 'leather', 'silk'], where: { home: 2, shop: 1, npc: 0.3 } }),
  W('item/clothing/boots', 'Boots', '靴子', 'item:boots', { tags: ['wearable'], props: { slot: 'feet' }, materials: ['leather', 'cloth'], where: { home: 2, shop: 1 } }),
  W('item/clothing/gloves', 'Gloves', '手套', 'item:gloves', { tags: ['wearable'], props: { slot: 'hands' }, materials: ['leather', 'cloth', 'silk'], where: { home: 1, shop: 1, smithy: 1 } }),
  // tools
  W('item/tool/pickaxe', 'Pickaxe', '镐', 'item:pickaxe', { tags: ['tool:pickaxe'], props: { power: 3 }, materials: TOOL_METALS, where: { smithy: 2, dungeon: 1, farm: 0.5 }, makeup: [{ type: 'item/material/stone', count: 2 }, { type: 'item/material/stick', count: 2 }, { type: 'item/material/grass', count: 1 }], station: 'hands' }),
  W('item/tool/shovel', 'Shovel', '铲子', 'item:shovel', { tags: ['tool:shovel'], props: { power: 2 }, materials: TOOL_METALS, where: { farm: 2, smithy: 1, home: 0.5 } }),
  W('item/tool/hoe', 'Hoe', '锄头', 'item:hoe', { tags: ['tool:hoe'], props: { power: 2 }, materials: TOOL_METALS, where: { farm: 3 }, makeup: [{ type: 'item/material/stone', count: 2 }, { type: 'item/material/stick', count: 2 }, { type: 'item/material/grass', count: 1 }], station: 'hands' }),
  W('item/tool/sickle', 'Sickle', '镰刀', 'item:sickle', { tags: ['tool:sickle', 'sharp'], props: { power: 2 }, materials: TOOL_METALS, where: { farm: 2 }, makeup: [{ type: 'item/material/stone', count: 2 }, { type: 'item/material/stick', count: 1 }, { type: 'item/material/grass', count: 1 }], station: 'hands' }),
  W('item/tool/fishing_rod', 'Fishing Rod', '鱼竿', 'item:rod', { tags: ['tool:fishing', 'wooden', 'flammable'], where: { home: 0.5, shop: 0.5, npc: 0.3 } }),
  W('item/tool/smith_hammer', 'Smith Hammer', '锻锤', 'item:hammer', { tags: ['tool:hammer'], props: { power: 3 }, materials: TOOL_METALS, where: { smithy: 3, farm: 1, home: 0.5 }, makeup: [{ type: 'item/material/stone', count: 2 }, { type: 'item/material/stick', count: 1 }], station: 'hands' }),
  W('item/tool/knife', 'Knife', '小刀', 'item:dagger', { tags: ['tool:knife', 'sharp'], materials: TOOL_METALS, where: { home: 2, inn: 2, farm: 1 } }),
  W('item/tool/rope', 'Rope', '绳索', 'item:rope', { tags: ['flammable', 'fiber'], where: { home: 1, shop: 2, farm: 1, dungeon: 0.5 } }),
  W('item/tool/flint', 'Flint and Steel', '火镰', 'item:flint', { tags: ['fire-source', 'metal'], where: { home: 1, shop: 1, inn: 0.5, npc: 0.3 } }),
  W('item/tool/broom', 'Broom', '扫帚', 'item:broom', { tags: ['wooden', 'flammable', 'straw'], where: { home: 1.5, inn: 1 } }),
  W('item/tool/lockpick', 'Lockpick', '开锁器', 'item:key', { tags: ['metal', 'lockpick'], where: { shop: 0.3, dungeon: 0.5 } }),
  // light
  W('item/light/torch', 'Torch', '火把', 'item:torch', { tags: ['fire-source', 'wooden', 'flammable', 'light'], where: { home: 1, shop: 1, dungeon: 2, inn: 0.5, npc: 0.3 } }),
  W('item/light/candle', 'Candle', '蜡烛', 'item:candle', { tags: ['fire-source', 'wax', 'flammable', 'light'], where: { home: 2, temple: 3, library: 2 } }),
  W('item/light/lantern', 'Lantern', '提灯', 'item:lantern', { tags: ['fire-source', 'metal', 'light', 'conductive'], where: { shop: 1, home: 0.5, inn: 1 } }),
  // vessels (explicit empty/filled types so rules can transform between them)
  W('item/vessel/bucket/empty', 'Bucket', '木桶', 'item:bucket', { tags: ['empty-vessel'], props: { waterType: 'item/vessel/bucket/water', oilType: 'item/vessel/bucket/oil' }, where: { home: 1, farm: 2, inn: 1 }, makeup: [{ type: 'item/material/plank', count: 3 }, { type: 'item/material/grass', count: 1 }], station: 'hands' }),
  W('item/vessel/bucket/water', 'Water Bucket', '一桶水', 'item:bucket_water', { tags: ['liquid:water', 'liquid'], props: { emptyType: 'item/vessel/bucket/empty' }, where: { farm: 0.5, inn: 0.3 } }),
  W('item/vessel/bucket/oil', 'Oil Bucket', '一桶油', 'item:bucket_oil', { tags: ['liquid:oil', 'liquid', 'flammable'], props: { emptyType: 'item/vessel/bucket/empty' }, where: {} }),
  W('item/vessel/flask/empty', 'Empty Flask', '空瓶', 'item:flask', { tags: ['empty-vessel'], props: { waterType: 'item/vessel/flask/water', oilType: 'item/vessel/flask/oil' }, where: { home: 1, shop: 1, library: 1, temple: 0.5 } }),
  W('item/vessel/flask/water', 'Flask of Water', '一瓶水', 'item:flask_water', { tags: ['liquid:water', 'liquid'], props: { emptyType: 'item/vessel/flask/empty' }, where: { home: 0.5, inn: 0.5, npc: 0.3 } }),
  W('item/vessel/flask/oil', 'Flask of Oil', '一瓶灯油', 'item:flask_oil', { tags: ['liquid:oil', 'liquid', 'flammable'], props: { emptyType: 'item/vessel/flask/empty' }, where: { shop: 1.5, home: 0.5, dungeon: 0.5 } }),
  W('item/vessel/flask/holy_water', 'Holy Water', '圣水', 'item:flask_water', { tags: ['liquid:water', 'liquid', 'holy'], props: { emptyType: 'item/vessel/flask/empty' }, where: { temple: 2 } }),
  W('item/vessel/waterskin/full', 'Waterskin', '水袋', 'item:waterskin', { tags: ['liquid:water', 'liquid'], props: { emptyType: 'item/vessel/waterskin/empty' }, where: { home: 0.5, npc: 0.3 } }),
  W('item/vessel/waterskin/empty', 'Empty Waterskin', '空水袋', 'item:waterskin', { tags: ['empty-vessel'], props: { waterType: 'item/vessel/waterskin/full' }, where: {} }),
  W('item/vessel/cup', 'Cup', '杯子', 'item:cup', { materials: ['wood', 'clay', 'silver', 'gold', 'glass'], where: { home: 2, inn: 3 } }),
  W('item/vessel/plate', 'Plate', '盘子', 'item:plate', { materials: ['wood', 'clay', 'silver'], where: { home: 2, inn: 2 } }),
  W('item/vessel/pot', 'Cooking Pot', '锅', 'item:pot', { tags: ['metal', 'conductive'], where: { home: 1, inn: 1 } }),
  // food
  W('item/food/bread', 'Bread', '面包', 'item:bread', { tags: ['edible', 'flammable'], props: { heal: 5, food: 5 }, where: { home: 2, inn: 3, shop: 1, npc: 0.5 } }),
  W('item/food/apple', 'Apple', '苹果', 'item:apple', { tags: ['edible', 'fruit'], props: { heal: 3, food: 4 }, where: { home: 2, farm: 2, shop: 1, npc: 0.5 } }),
  W('item/food/cheese', 'Cheese', '奶酪', 'item:cheese', { tags: ['edible'], props: { heal: 4, food: 4 }, where: { home: 1, inn: 2 } }),
  W('item/food/fish/raw', 'Raw Fish', '生鱼', 'item:fish', { tags: ['edible', 'raw', 'cookable'], props: { heal: 2, food: 2, cookedType: 'item/food/fish/cooked' }, where: { home: 1, inn: 1, shop: 0.5 } }),
  W('item/food/fish/cooked', 'Grilled Fish', '烤鱼', 'item:fish_cooked', { tags: ['edible', 'cooked'], props: { heal: 8, food: 5 }, where: { inn: 1 } }),
  W('item/food/meat/raw', 'Raw Beef', '生牛肉', 'item:meat', { tags: ['edible', 'raw', 'cookable'], props: { heal: 2, food: 3, cookedType: 'item/food/meat/cooked' }, where: { home: 1, inn: 1, farm: 1 } }),
  W('item/food/meat/cooked', 'Steak', '牛排', 'item:meat_cooked', { tags: ['edible', 'cooked'], props: { heal: 10, food: 8 }, where: { inn: 1 } }),
  W('item/food/chicken/raw', 'Raw Chicken', '生鸡肉', 'item:chicken', { tags: ['edible', 'raw', 'cookable'], props: { heal: 1, food: 2, cookedType: 'item/food/chicken/cooked' }, where: { farm: 1 } }),
  W('item/food/chicken/cooked', 'Roast Chicken', '烤鸡肉', 'item:chicken_cooked', { tags: ['edible', 'cooked'], props: { heal: 7, food: 6 }, where: { inn: 0.5 } }),
  W('item/food/mushroom/raw', 'Mushroom', '蘑菇', 'item:mushroom', { tags: ['edible', 'raw', 'cookable'], props: { heal: 2, food: 1, cookedType: 'item/food/mushroom/roasted' }, where: { wild: 3, dungeon: 1 } }),
  W('item/food/mushroom/roasted', 'Roasted Mushroom', '烤蘑菇', 'item:mushroom', { tags: ['edible', 'cooked'], props: { heal: 5, food: 4 }, where: {} }),
  W('item/food/berries', 'Berries', '浆果', 'item:berries', { tags: ['edible', 'fruit'], props: { heal: 2, food: 2 }, where: { wild: 3, farm: 1 } }),
  ...VEGETABLE_CROPS.map((c) => W(`item/food/${c.id}`, c.en, c.zh, `item:${c.id}`, {
    tags: ['edible', 'plant', 'vegetable'], props: { heal: c.heal, food: c.food }, where: { farm: 2, home: 0.5, shop: 0.5 },
  })),
  W('item/food/egg/raw', 'Egg', '鸡蛋', 'item:egg', { tags: ['edible', 'raw', 'fragile', 'cookable'], props: { heal: 1, food: 1, cookedType: 'item/food/egg/boiled' }, where: { farm: 2, home: 1 } }),
  W('item/food/egg/boiled', 'Boiled Egg', '熟鸡蛋', 'item:egg_boiled', { tags: ['edible', 'cooked'], props: { heal: 4, food: 3 }, where: {} }),
  W('item/food/pie', 'Pie', '馅饼', 'item:pie', { tags: ['edible', 'flammable'], props: { heal: 9, food: 8 }, where: { inn: 1, home: 0.5 } }),
  W('item/food/honey', 'Honey Jar', '蜂蜜罐', 'item:honey', { tags: ['edible', 'sticky', 'clay'], props: { heal: 6, food: 6 }, where: { farm: 0.5, shop: 0.5 } }),
  W('item/food/wine', 'Wine Bottle', '葡萄酒', 'item:wine', { tags: ['drinkable', 'glass', 'fragile', 'liquid', 'alcohol'], props: { heal: 3 }, where: { inn: 3, home: 0.5 } }),
  W('item/food/ale', 'Mug of Ale', '一杯麦酒', 'item:ale', { tags: ['drinkable', 'liquid', 'alcohol'], props: { heal: 2 }, where: { inn: 3 } }),
  // potions
  W('item/potion/healing', 'Healing Potion', '治疗药水', 'item:potion_red', { tags: ['drinkable', 'glass', 'fragile', 'magical'], props: { heal: 15 }, where: { temple: 1, shop: 1, dungeon: 1.5 } }),
  W('item/potion/antidote', 'Antidote', '解毒剂', 'item:potion_green', { tags: ['drinkable', 'glass', 'fragile', 'magical'], props: { heal: 4 }, where: { temple: 1, shop: 0.5 } }),
  W('item/potion/fire_resist', 'Fireproof Draught', '抗火药剂', 'item:potion_orange', { tags: ['drinkable', 'glass', 'fragile', 'magical'], props: { heal: 2 }, where: { library: 0.5, shop: 0.3 } }),
  W('item/potion/mystery', 'Murky Potion', '浑浊药水', 'item:potion_purple', { tags: ['drinkable', 'glass', 'fragile', 'magical', 'unknown'], where: { dungeon: 1, library: 0.5 } }),
  // materials
  W('item/material/log', 'Log', '木头', 'item:log', { tags: ['wooden', 'flammable', 'fuel'], props: { material: 'wood' }, where: { wild: 1, farm: 1, home: 0.5 } }),
  W('item/material/plank', 'Plank', '木板', 'item:plank', { tags: ['wooden', 'flammable'], props: { material: 'wood' }, where: { smithy: 1, farm: 0.5 } }),
  W('item/material/stick', 'Stick', '树枝', 'item:stick', { tags: ['wooden', 'flammable', 'fuel'], props: { material: 'wood' }, where: { wild: 3 } }),
  W('item/material/stone', 'Stone', '石块', 'item:stone', { tags: ['stone', 'heavy'], props: { material: 'stone' }, where: { wild: 3, dungeon: 2 } }),
  W('item/material/grass', 'Cut Grass', '干草', 'item:grass', { tags: ['plant', 'flammable', 'fuel', 'fiber'], props: { material: 'plant' }, where: { wild: 3, farm: 1 } }),
  W('item/material/coal', 'Coal', '煤炭', 'item:coal', { tags: ['flammable', 'fuel', 'mineral'], where: { smithy: 2, dungeon: 1 } }),
  W('item/material/iron_ore', 'Iron Ore', '铁矿石', 'item:ore', { tags: ['mineral', 'metal', 'ore'], where: { dungeon: 2, smithy: 1 } }),
  W('item/material/gold_ore', 'Gold Ore', '金矿石', 'item:ore_gold', { tags: ['mineral', 'metal', 'ore', 'precious'], where: { dungeon: 0.5 } }),
  W('item/material/herb', 'Herb', '草药', 'item:herb', { tags: ['plant', 'flammable', 'medicinal', 'edible'], props: { heal: 3, food: 1 }, where: { wild: 3, temple: 1, farm: 0.5 } }),
  W('item/material/fireweed', 'Fireweed', '火焰草', 'item:herb_red', { tags: ['plant', 'flammable', 'fiery', 'reagent'], where: { wild: 1, library: 0.5 } }),
  W('item/material/frostcap', 'Frostcap', '霜盖菇', 'item:mushroom_blue', { tags: ['fungus', 'icy', 'reagent'], where: { wild: 0.8, dungeon: 0.5 } }),
  W('item/material/feather', 'Feather', '羽毛', 'item:feather', { tags: ['light', 'flammable'], where: { wild: 1, farm: 1 } }),
  W('item/material/bone', 'Bone', '骨头', 'item:bone', { tags: ['bone'], where: { dungeon: 3, wild: 0.5 } }),
  W('item/material/cloth', 'Bolt of Cloth', '布匹', 'item:cloth', { tags: ['cloth', 'flammable'], where: { shop: 2, home: 0.5 } }),
  W('item/material/leather', 'Leather Hide', '皮革', 'item:leather', { tags: ['leather', 'flammable'], where: { shop: 1, farm: 0.5 } }),
  W('item/material/wool', 'Wool', '羊毛', 'item:wool', { tags: ['cloth', 'flammable', 'soft'], where: { farm: 1.5 } }),
  W('item/material/wax', 'Wax', '蜂蜡', 'item:wax', { tags: ['wax', 'flammable'], where: { temple: 1, farm: 0.5 } }),
  W('item/material/salt', 'Salt', '盐', 'item:salt', { tags: ['mineral'], where: { inn: 1, shop: 1 } }),
  W('item/material/ash', 'Ash', '灰烬', 'item:ash', { tags: ['burnt', 'powder'], where: {} }),
  W('item/seed/wheat', 'Wheat Seeds', '麦种', 'item:seed', { tags: ['plantable'], props: { cropType: 'fixture/crop/wheat/sprout' }, where: { farm: 3, shop: 0.5 } }),
  W('item/seed/herb', 'Herb Seeds', '草药种子', 'item:seed', { tags: ['plantable'], props: { cropType: 'fixture/crop/herb/sprout' }, where: { farm: 1, temple: 0.3, shop: 0.3 } }),
  W('item/seed/berry', 'Berry Seeds', '浆果种子', 'item:seed', { tags: ['plantable'], props: { cropType: 'fixture/crop/berry/sprout' }, where: { farm: 1, wild: 0.3 } }),
  ...VEGETABLE_CROPS.map((c) => W(`item/seed/${c.id}`, `${c.en} Seeds`, `${c.zh}种子`, `item:${c.id}_seed`, {
    tags: ['plantable'], props: { cropType: `fixture/crop/${c.id}/sprout` }, where: { farm: 2, shop: 0.5 },
  })),
  W('item/seed/acorn', 'Acorn', '橡子', 'item:acorn', { tags: ['acorn'], props: { cropType: 'fixture/crop/oak/sapling' }, where: { wild: 0.5 } }),
  W('item/material/wheat', 'Wheat', '麦子', 'item:wheat', { tags: ['plant', 'flammable', 'dry'], where: { farm: 3 } }),
  // gems & valuables
  W('item/gem', 'Gem', '宝石', 'item:gem', { tags: ['gem', 'precious', 'crystal'], elemental: true, where: { dungeon: 2, shop: 0.3 } }),
  W('item/valuable/coin_pouch', 'Coin Pouch', '钱袋', 'item:coins', { tags: ['money', 'leather'], props: { value: 20 }, where: { home: 1, npc: 1, dungeon: 1 } }),
  W('item/valuable/ring', 'Ring', '戒指', 'item:ring', { materials: ['silver', 'gold', 'iron', 'bone', 'mithril'], elemental: true, where: { home: 0.5, dungeon: 1, npc: 0.3 } }),
  W('item/valuable/amulet', 'Amulet', '护符', 'item:amulet', { materials: ['silver', 'gold', 'bone', 'crystal'], elemental: true, where: { temple: 1, dungeon: 1 } }),
  W('item/valuable/goblet', 'Goblet', '高脚杯', 'item:goblet', { materials: ['silver', 'gold'], where: { temple: 1, dungeon: 0.5 } }),
  W('item/valuable/crown', 'Circlet', '头冠', 'item:crown', { materials: ['silver', 'gold', 'ringsteel'], where: { dungeon: 0.2 } }),
  W('item/valuable/ancient_ring_shard', 'Ring Shard', '环冠碎片', 'item:shard', { tags: ['ancient', 'runic', 'arcane', 'metal'], where: { dungeon: 0.4 } }),
  // documents
  W('item/document/book', 'Book', '书', 'item:book', { tags: ['paper', 'flammable', 'readable'], where: { library: 5, home: 1, temple: 1 } }),
  W('item/document/scroll', 'Scroll', '卷轴', 'item:scroll', { tags: ['paper', 'flammable', 'readable', 'arcane'], elemental: true, where: { library: 3, temple: 1, dungeon: 1 } }),
  W('item/document/letter', 'Letter', '信件', 'item:letter', { tags: ['paper', 'flammable', 'readable'], where: { home: 1, npc: 0.3 } }),
  W('item/document/map', 'Map', '地图', 'item:map', { tags: ['paper', 'flammable', 'readable'], where: { library: 1, shop: 0.5, dungeon: 0.3 } }),
  // keys
  W('item/key', 'Key', '钥匙', 'item:key', { tags: ['key', 'metal'], materials: ['iron', 'bronze', 'silver', 'gold'], where: { home: 0.3, dungeon: 0.5, npc: 0.2 } }),
  // misc
  W('item/misc/bell', 'Bell', '铃铛', 'item:bell', { tags: ['metal', 'conductive', 'noisy'], where: { temple: 1, shop: 0.3 } }),
  W('item/misc/flute', 'Flute', '笛子', 'item:flute', { tags: ['wooden', 'instrument', 'flammable'], where: { home: 0.5, inn: 0.5 } }),
  W('item/misc/lute', 'Lute', '鲁特琴', 'item:lute', { tags: ['wooden', 'instrument', 'flammable'], where: { inn: 0.5 } }),
  W('item/misc/dice', 'Dice', '骰子', 'item:dice', { tags: ['bone', 'game'], where: { inn: 1.5, home: 0.5 } }),
  W('item/misc/doll', 'Rag Doll', '布偶', 'item:doll', { tags: ['cloth', 'flammable', 'toy'], where: { home: 1 } }),
  W('item/misc/mirror', 'Hand Mirror', '手镜', 'item:mirror', { tags: ['glass', 'fragile', 'reflective'], where: { home: 0.5, shop: 0.3 } }),
  W('item/misc/skull', 'Skull', '头骨', 'item:skull', { tags: ['bone', 'macabre'], where: { dungeon: 1.5 } }),
  W('item/misc/feather_quill', 'Quill', '羽毛笔', 'item:quill', { tags: ['light', 'flammable', 'writing'], where: { library: 2, home: 0.3 } }),
  W('item/misc/ink', 'Ink Pot', '墨水瓶', 'item:ink', { tags: ['glass', 'fragile', 'liquid', 'dye'], where: { library: 2 } }),
  W('item/misc/soap', 'Soap', '肥皂', 'item:soap', { tags: ['slippery', 'cleaning'], where: { home: 0.5, inn: 0.5 } }),
  W('item/misc/firework', 'Firecracker', '爆竹', 'item:firework', { tags: ['explosive', 'flammable', 'paper'], where: { shop: 0.3 } }),
  W('item/misc/bomb', 'Blackpowder Bomb', '黑火药炸弹', 'item:bomb', { tags: ['explosive', 'flammable', 'heavy'], where: { dungeon: 0.4 } }),
  W('item/misc/snowball', 'Snowball', '雪球', 'item:snowball', { tags: ['icy', 'cold', 'water', 'fragile'], where: {} }),
]

/** Types derived from the catalogue (plus the roots). */
export function itemTypes(): TypeDef[] {
  const roots: TypeDef[] = [
    { id: 'item', name: { en: 'item', zh: '物品' }, tags: ['portable'] },
    { id: 'item/weapon', name: { en: 'weapon', zh: '武器' }, tags: ['weapon'] },
    { id: 'item/weapon/blade', tags: ['sharp', 'blade'] },
    { id: 'item/weapon/blunt', tags: ['blunt'] },
    { id: 'item/weapon/polearm', tags: ['sharp', 'long'] },
    { id: 'item/weapon/ranged', tags: ['ranged'] },
    { id: 'item/weapon/magic', tags: ['magical', 'focus'] },
    { id: 'item/armor', tags: ['armor', 'wearable'] },
    { id: 'item/clothing', tags: ['wearable', 'clothing'] },
    { id: 'item/tool', tags: ['tool'] },
    { id: 'item/light', tags: ['light'] },
    { id: 'item/vessel', tags: ['vessel'] },
    { id: 'item/vessel/bucket', name: { en: 'Bucket', zh: '木桶' }, tags: ['wooden'] },
    { id: 'item/vessel/flask', name: { en: 'Flask', zh: '瓶子' }, tags: ['glass', 'fragile'] },
    { id: 'item/vessel/waterskin', name: { en: 'Waterskin', zh: '水袋' }, tags: ['leather'] },
    { id: 'item/food', tags: ['food'] },
    { id: 'item/food/fish', name: { en: 'Fish', zh: '鱼' }, tags: ['edible'] },
    { id: 'item/food/meat', name: { en: 'Meat', zh: '肉' }, tags: ['edible'] },
    { id: 'item/food/mushroom', name: { en: 'Mushroom', zh: '蘑菇' }, tags: ['edible', 'fungus'] },
    { id: 'item/food/egg', name: { en: 'Egg', zh: '蛋' }, tags: ['edible'] },
    { id: 'item/potion', tags: ['potion'] },
    { id: 'item/material', tags: ['material'] },
    { id: 'item/seed', name: { en: 'Seeds', zh: '种子' }, tags: ['seed', 'plant'] },
    { id: 'item/valuable', tags: ['valuable'] },
    { id: 'item/document', tags: ['document'] },
    { id: 'item/misc', tags: [] },
  ]
  return [
    ...roots,
    ...FORMS.map((f): TypeDef => ({
      id: f.id,
      name: { en: f.en, zh: f.zh },
      sprite: f.sprite,
      tags: f.tags ?? [],
      props: f.props,
      ...(f.makeup && { makeup: f.makeup, station: f.station, craftLevel: f.craftLevel }),
    })),
  ]
}

export const FORM_BY_ID: Record<string, Form> = Object.fromEntries(FORMS.map((f) => [f.id, f]))

/** Instantiate an item: material × quality × element, with a composed bilingual name. */
export function makeItem(rng: Rng, form: Form, opts: { material?: string; quality?: string; element?: string | null } = {}): Omit<Entity, 'id' | 'place'> {
  const tags: string[] = []
  const props: Record<string, PropValue> = {}
  let en = form.en
  let zh = form.zh
  const matId = opts.material ?? (form.materials ? rng.pick(form.materials) : undefined)
  if (matId) {
    const m = MATERIALS[matId]
    tags.push(`material:${m.id}`, ...m.tags)
    en = `${m.en} ${en}`
    zh = `${m.zh}${zh}`
  }
  let quality: string | undefined
  const isGear = form.id.startsWith('item/weapon') || form.id.startsWith('item/armor') || form.id.startsWith('item/tool') || form.id.startsWith('item/valuable')
  if (isGear) {
    const q = opts.quality ? QUALITIES.find((x) => x.id === opts.quality)! : weighted(rng, QUALITIES)
    if (q.id !== 'common') {
      tags.push(`quality:${q.id}`)
      en = `${q.en} ${en}`
      zh = `${q.zh}${zh}`
    }
    quality = q.id
  }
  // what the material and the quality make of its power and defence (world-model.md §6.8)
  Object.assign(props, gearProps(form.props ?? {}, matId ? MATERIAL_DEFS[matId] : undefined, QUALITY_DEFS().find((x) => x.id === quality)))
  const el = opts.element === null ? undefined : (opts.element ?? (form.elemental && rng.chance(0.28) ? rng.pick(Object.keys(ELEMENT_NAMES)) : undefined))
  if (el && form.elemental) {
    tags.push(`element:${el}`)
    props.element = el
    en = `${en} ${ELEMENT_NAMES[el].en}`
    zh = `${ELEMENT_NAMES[el].zh}${zh}`
  }
  return {
    type: form.id,
    name: en === form.en ? undefined : { en, zh },
    tags: tags.length ? tags : undefined,
    props: Object.keys(props).length ? props : undefined,
  }
}

function weighted<T extends { w: number }>(rng: Rng, xs: T[]): T {
  const total = xs.reduce((a, x) => a + x.w, 0)
  let r = rng.next() * total
  for (const x of xs) if ((r -= x.w) < 0) return x
  return xs[xs.length - 1]
}

export function formsFor(ctx: Context): [Form, number][] {
  return FORMS.filter((f) => (f.where?.[ctx] ?? 0) > 0).map((f) => [f, f.where![ctx]!])
}

export function pickForm(rng: Rng, ctx: Context): Form {
  const opts = formsFor(ctx)
  const total = opts.reduce((a, [, w]) => a + w, 0)
  let r = rng.next() * total
  for (const [f, w] of opts) if ((r -= w) < 0) return f
  return opts[opts.length - 1][0]
}
