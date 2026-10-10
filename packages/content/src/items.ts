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
  /** Tools its making needs carried, not used up; how many one making gives. */
  tools?: string[]
  yields?: number
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
  // a body: its bare blow breaks what is no harder (plants, wood, slowly) — Minecraft's fist
  { id: 'flesh', category: 'flesh', hardness: 1 },
  { id: 'plant', category: 'plant', hardness: 0 },
  { id: 'gel', category: 'organic', hardness: 0 },
  { id: 'earth', category: 'soil', hardness: 0 },
  { id: 'ice', category: 'crystal', hardness: 1 },
  { id: 'ore', category: 'ore', hardness: 2 },
]

/** Every material, as the world reads it (world-model.md §4.5): its category and hardness. */
export const MATERIAL_DEFS: Record<string, MaterialDef> = Object.fromEntries([
  ...Object.values(MATERIALS).map((m) => ({ id: m.id, category: m.category, hardness: m.hardness, name: { en: m.en, zh: m.zh }, tags: m.tags, attack: m.attack, defence: m.defence, value: m.value })),
  ...NATURAL,
].map((m) => [m.id, m]))

/** The qualities as the world reads them: a maker reaches each by how far above the recipe's level they are (legendary: never by making). */
export const QUALITY_DEFS = (): QualityDef[] =>
  QUALITIES.map((q) => ({ id: q.id, tag: q.id === 'common' ? undefined : `quality:${q.id}`, name: q.en ? { en: q.en, zh: q.zh } : undefined, factor: q.factor, from: QUALITY_FROM[q.id], value: q.value }))
const QUALITY_FROM: Record<string, number | undefined> = { crude: -99, common: 0, fine: 3, masterwork: 6 }

/**
 * The tiers of a made thing (docs/chapter-1.md, docs/lore.md). The two above the maker's reach are the story's
 * own: **Vowbound** (遗誓) — what those bound by a vow left behind (the Order of the Thorn, the pilgrims before
 * you); found, never made — and, highest, **Stigmatic** (圣痕) — what bears one of Astra's five wounds: only the
 * Seal-bearers carry it, and each piece asks something back (its id stays `legendary`, which saves and rules name).
 */
export const QUALITIES = [
  // a quality's factor on power and defence (Elin's rarity: crude 120/150, superior 120/100, legendary 120/80)
  { id: 'crude', en: 'Crude', zh: '粗制', factor: 0.8, value: 0.5, w: 3 },
  { id: 'common', en: '', zh: '', factor: 1, value: 1, w: 8 },
  { id: 'fine', en: 'Fine', zh: '精良', factor: 1.25, value: 1.8, w: 3 },
  { id: 'masterwork', en: 'Masterwork', zh: '大师', factor: 1.5, value: 3.5, w: 1 },
  { id: 'vowed', en: 'Vowbound', zh: '遗誓', factor: 1.75, value: 6, w: 0.1 },
  // never rolled: a Seal-bearer's alone
  { id: 'legendary', en: 'Stigmatic', zh: '圣痕', factor: 2, value: 9, w: 0 },
]

/**
 * The Stigmatic pieces' powers (engine combat.ts `relicsOf`): one of each in the world, each its own. What the
 * tooltip names and tells.
 */
export const RELICS: Record<string, { en: string; zh: string; text: { en: string; zh: string } }> = {
  crown: { en: 'None Cross That Do Not Kneel', zh: '不跪者不得过', text: { en: 'Your blows have a 20% chance to force the struck to their knees (1 second, unable to move).', zh: '你的攻击有 20% 几率令目标跪地（1 秒内无法移动）。' } },
  nightfang: { en: 'Tooth of the Night', zh: '夜之牙', text: { en: '+25% critical chance at night.', zh: '入夜后暴击率 +25%。' } },
  mirrorshard: { en: 'Stolen Face', zh: '窃面', text: { en: 'A critical hit draws back 3 more health.', zh: '暴击时额外吸取 3 点生命。' } },
  oathbrand: { en: 'Oath Kept', zh: '守誓', text: { en: 'Below 30% health, the health it draws back is tripled.', zh: '生命低于 30% 时，吸取的生命变为三倍。' } },
  galestring: { en: 'Running Wind', zh: '逐风', text: { en: 'Each hit: +30% movement speed for 2 seconds.', zh: '每次命中：2 秒内移动速度 +30%。' } },
  starfall: { en: 'Falling Star', zh: '坠星', text: { en: 'Every fifth hit is a critical.', zh: '每第五次命中必定暴击。' } },
  emberheart: { en: 'Heart of Embers', zh: '余烬之心', text: { en: 'Hits have a 25% chance to set the struck burning.', zh: '命中有 25% 几率点燃目标。' } },
  rimecrown: { en: 'Crown of Rime', zh: '霜冕', text: { en: 'Hits have a 20% chance to freeze the struck for a moment.', zh: '命中有 20% 几率令目标短暂冰冻。' } },
  unfallen: { en: 'Unfallen', zh: '不陷', text: { en: 'Once a minute, a blow that would fell you is turned aside.', zh: '每分钟一次：将致命一击完全挡下。' } },
  dragonsbane: { en: 'Dragonslayer', zh: '屠龙', text: { en: 'Double damage against dragons and their whelps.', zh: '对巨龙与幼龙造成双倍伤害。' } },
}

/**
 * What a Vowbound piece keeps of the vow it was made under: a trait beyond its numbers, read from what is worn
 * or held (engine World.stat, combat.ts): a rolled one takes one of these; the story's own name theirs.
 */
export const VOW_TRAITS: Record<string, number>[] = [
  { critChance: 0.05 }, { dodge: 0.06 }, { lifesteal: 1 }, { moveHaste: 0.1 }, { holdFast: 0.15 }, { 'night:def': 2 }, { 'night:atk': 1 },
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
  // profession weapons (`profession:<id>`, engine/src/profession.ts) fight only for their own:
  // the assassin's dagger, the warrior's sword and shield, the ranger's bow, the mage's staff
  W('item/weapon/blade/sword', 'Sword', '剑', 'item:sword', { tags: ['profession:warrior'], props: { power: 4 }, materials: WEAPON_METALS, elemental: true, where: { smithy: 5, dungeon: 3, shop: 1 } }),
  W('item/weapon/blade/dagger', 'Dagger', '匕首', 'item:dagger', { tags: ['profession:assassin'], props: { power: 2 }, materials: WEAPON_METALS, elemental: true, where: { smithy: 3, dungeon: 2, home: 0.5, npc: 1 } }),
  W('item/weapon/blade/axe', 'Axe', '斧', 'item:axe', { tags: ['tool:axe'], props: { power: 4 }, materials: TOOL_METALS, elemental: true, where: { smithy: 3, farm: 2, wild: 0.5 }, makeup: [{ type: 'item/material/stone', count: 1 }, { type: 'item/material/stick', count: 1 }, { type: 'item/material/grass', count: 1 }], station: 'hands' }),
  // the smith of Emberfall's blade, forged for the dragon (the main quest)
  W('item/weapon/blade/dragonsbane', 'Dragonsbane', '屠龙剑', 'item:sword', { tags: ['dragonsbane', 'quality:legendary'], props: { relic: 'dragonsbane', power: 12 }, where: {} }),
  W('item/weapon/blade/scimitar', 'Scimitar', '弯刀', 'item:sword', { tags: ['profession:warrior'], props: { power: 4 }, materials: WEAPON_METALS, elemental: true, where: { dungeon: 1, smithy: 1 } }),
  W('item/weapon/blunt/club', 'Club', '棍棒', 'item:club', { props: { power: 2 }, materials: ['wood', 'bone'], where: { wild: 1, npc: 1, dungeon: 1 }, makeup: [{ type: 'item/material/log', count: 1 }], station: 'workbench' }),
  W('item/weapon/blunt/mace', 'Mace', '钉锤', 'item:mace', { props: { power: 4 }, materials: WEAPON_METALS, elemental: true, where: { smithy: 2, dungeon: 2 } }),
  W('item/weapon/blunt/warhammer', 'Warhammer', '战锤', 'item:hammer', { props: { power: 5 }, materials: WEAPON_METALS, elemental: true, where: { smithy: 1, dungeon: 1 } }),
  W('item/weapon/polearm/spear', 'Spear', '长矛', 'item:spear', { props: { power: 4, range: 2 }, materials: WEAPON_METALS, elemental: true, where: { smithy: 2, dungeon: 1, npc: 0.5 } }),
  W('item/weapon/polearm/halberd', 'Halberd', '戟', 'item:spear', { props: { power: 5, range: 2 }, materials: WEAPON_METALS, elemental: true, where: { smithy: 1, dungeon: 1 } }),
  W('item/weapon/ranged/bow', 'Bow', '弓', 'item:bow', { tags: ['profession:ranger'], props: { power: 3, range: 6 }, materials: ['wood', 'bone'], elemental: true, where: { smithy: 1, wild: 0.3, dungeon: 1 }, makeup: [{ type: 'item/material/stick', count: 2 }, { type: 'item/material/grass', count: 3 }], station: 'workbench', craftLevel: 2 }),
  W('item/weapon/magic/wand', 'Wand', '魔杖', 'item:wand', { tags: ['arcane'], props: { power: 3, range: 5 }, materials: ['wood', 'crystal', 'bone', 'silver'], elemental: true, where: { library: 3, temple: 1, dungeon: 2, shop: 0.5 } }),
  W('item/weapon/magic/staff', 'Staff', '法杖', 'item:staff', { tags: ['arcane', 'profession:mage'], props: { power: 5, range: 4 }, materials: ['wood', 'crystal', 'bone', 'mithril'], elemental: true, where: { library: 1, dungeon: 1 } }),
  // the professions' legendary arms, two each (LEGENDARY_ARMS): kin of their family, never found
  // lying about; a fallen sin leaves one for the profession of whoever felled it (bosses.ts)
  W('item/weapon/blade/dagger/nightfang', 'Nightfang', '夜牙', 'item:dagger', { tags: ['quality:legendary', 'legend'], props: { relic: 'nightfang', power: 8, critChance: 0.15 }, where: {} }),
  W('item/weapon/blade/dagger/mirrorshard', 'Mirrorshard', '镜中刃', 'item:dagger', { tags: ['quality:legendary', 'legend', 'glass'], props: { relic: 'mirrorshard', power: 7, lifesteal: 1 }, where: {} }),
  W('item/weapon/blade/sword/oathbrand', 'Oathbrand', '誓约之刃', 'item:sword', { tags: ['quality:legendary', 'legend', 'metal', 'conductive', 'holy'], props: { relic: 'oathbrand', power: 10, lifesteal: 1 }, where: {} }),
  W('item/weapon/ranged/bow/galestring', 'Galestring', '疾风之弦', 'item:bow', { tags: ['quality:legendary', 'legend', 'element:wind'], props: { relic: 'galestring', power: 8, range: 7, element: 'wind', attackHaste: 0.2 }, where: {} }),
  W('item/weapon/ranged/bow/starfall', 'Starfall', '坠星', 'item:bow', { tags: ['quality:legendary', 'legend'], props: { relic: 'starfall', power: 10, range: 8, critChance: 0.1 }, where: {} }),
  W('item/weapon/magic/staff/emberheart', 'Emberheart', '烬心法杖', 'item:staff', { tags: ['quality:legendary', 'legend', 'element:fire'], props: { relic: 'emberheart', power: 11, range: 5, element: 'fire' }, where: {} }),
  W('item/weapon/magic/staff/rimecrown', 'Rimecrown', '霜冠法杖', 'item:staff', { tags: ['quality:legendary', 'legend', 'element:ice', 'crystal'], props: { relic: 'rimecrown', power: 10, range: 6, element: 'ice', critChance: 0.1 }, where: {} }),
  // armour and clothing: put on oneself, worn in a slot (world-model.md §6.8); armour adds its defence
  W('item/armor/helmet', 'Helmet', '头盔', 'item:helmet', { tags: ['wearable'], props: { def: 1, slot: 'head', look: 'hat.helm' }, materials: ['iron', 'steel', 'bronze', 'leather', 'bone'], where: { smithy: 2, dungeon: 1 } }),
  W('item/armor/shield', 'Shield', '盾牌', 'item:shield', { tags: ['wearable', 'profession:warrior'], props: { def: 2, slot: 'arm' }, materials: ['wood', 'iron', 'steel', 'bronze'], where: { smithy: 2, dungeon: 1 }, makeup: [{ type: 'item/material/plank', count: 3 }, { type: 'item/material/stick', count: 1 }], station: 'workbench' }),
  // the warrior's legendary shield: a block turns a blow aside (combat.ts)
  W('item/armor/shield/unfallen', 'The Unfallen Wall', '不陷之壁', 'item:shield', { tags: ['quality:legendary', 'legend', 'metal', 'conductive'], props: { relic: 'unfallen', def: 5, block: 0.15 }, where: {} }),
  W('item/armor/breastplate', 'Breastplate', '胸甲', 'item:armor', { tags: ['wearable'], props: { def: 3, slot: 'body', look: 'armour.plate' }, materials: ['iron', 'steel', 'leather', 'mithril'], where: { smithy: 1, dungeon: 0.5 } }),
  // the body's ten slots (docs/world-model.md §6.8): head, body, feet, hands, waist, shoulders, neck, two rings, ear
  W('item/armor/pauldrons', 'Pauldrons', '护肩', 'item:pauldrons', { tags: ['wearable'], props: { def: 1, slot: 'shoulders', look: 'cloak.pauldrons' }, materials: ['iron', 'steel', 'leather', 'bronze'], where: { smithy: 1, dungeon: 0.5 } }),
  W('item/clothing/cloak', 'Cloak', '斗篷', 'item:cloak', { tags: ['wearable'], props: { slot: 'shoulders', look: 'cloak.cloak' }, materials: ['cloth', 'leather', 'silk'], where: { home: 2, shop: 1 } }),
  W('item/clothing/belt', 'Belt', '腰带', 'item:belt', { tags: ['wearable'], props: { def: 1, slot: 'waist' }, materials: ['leather', 'cloth'], where: { home: 1, shop: 1, smithy: 0.5 } }),
  W('item/clothing/hat', 'Hat', '帽子', 'item:hat', { tags: ['wearable'], props: { slot: 'head', look: 'hat.cap' }, materials: ['cloth', 'leather', 'silk'], where: { home: 2, shop: 1, npc: 0.3 } }),
  // a hood drawn up hides the face: who sees a deed done under it remembers only the hood (docs/npc-sandbox.md §2.3)
  W('item/clothing/hood', 'Hood', '兜帽', 'item:cloak', { tags: ['wearable'], props: { slot: 'head', look: 'hat.hood' }, materials: ['cloth', 'leather'], where: { shop: 0.5, home: 0.5 } }),
  W('item/clothing/boots', 'Boots', '靴子', 'item:boots', { tags: ['wearable'], props: { slot: 'feet' }, materials: ['leather', 'cloth'], where: { home: 2, shop: 1 } }),
  W('item/clothing/gloves', 'Gloves', '手套', 'item:gloves', { tags: ['wearable'], props: { slot: 'hands' }, materials: ['leather', 'cloth', 'silk'], where: { home: 1, shop: 1, smithy: 1 } }),
  // tools
  W('item/tool/pickaxe', 'Pickaxe', '镐', 'item:pickaxe', { tags: ['tool:pickaxe'], props: { power: 3 }, materials: TOOL_METALS, where: { smithy: 2, dungeon: 1, farm: 0.5 }, makeup: [{ type: 'item/material/stone', count: 2 }, { type: 'item/material/stick', count: 2 }, { type: 'item/material/grass', count: 1 }], station: 'hands' }),
  W('item/tool/shovel', 'Shovel', '铲子', 'item:shovel', { tags: ['tool:shovel'], props: { power: 2 }, materials: TOOL_METALS, where: { farm: 2, smithy: 1, home: 0.5 } }),
  W('item/tool/hoe', 'Hoe', '锄头', 'item:hoe', { tags: ['tool:hoe'], props: { power: 2 }, materials: TOOL_METALS, where: { farm: 3 }, makeup: [{ type: 'item/material/stone', count: 2 }, { type: 'item/material/stick', count: 2 }, { type: 'item/material/grass', count: 1 }], station: 'hands' }),
  W('item/tool/sickle', 'Sickle', '镰刀', 'item:sickle', { tags: ['tool:sickle', 'sharp'], props: { power: 2 }, materials: TOOL_METALS, where: { farm: 2 }, makeup: [{ type: 'item/material/stone', count: 2 }, { type: 'item/material/stick', count: 1 }, { type: 'item/material/grass', count: 1 }], station: 'hands' }),
  // made at hand from two sticks and a line of grass (the crafting panel); bait put on it is kept on it (`bait`, homestead.ts)
  W('item/tool/fishing_rod', 'Fishing Rod', '鱼竿', 'item:rod', { tags: ['tool:fishing', 'wooden', 'flammable'], props: { range: 3 }, where: { home: 0.5, shop: 0.5, npc: 0.3 }, makeup: [{ type: 'item/material/stick', count: 2 }, { type: 'item/material/grass', count: 2 }], station: 'hands' }),
  W('item/tool/smith_hammer', 'Smith Hammer', '锻锤', 'item:hammer', { tags: ['tool:hammer'], props: { power: 3 }, materials: TOOL_METALS, where: { smithy: 3, farm: 1, home: 0.5 }, makeup: [{ type: 'item/material/stone', count: 2 }, { type: 'item/material/stick', count: 1 }], station: 'hands' }),
  W('item/tool/knife', 'Knife', '小刀', 'item:dagger', { tags: ['tool:knife', 'sharp'], materials: TOOL_METALS, where: { home: 2, inn: 2, farm: 1 } }),
  W('item/tool/rope', 'Rope', '绳索', 'item:rope', { tags: ['flammable', 'fiber'], where: { home: 1, shop: 2, farm: 1, dungeon: 0.5 } }),
  W('item/tool/flint', 'Flint and Steel', '火镰', 'item:flint', { tags: ['fire-source', 'metal'], where: { home: 1, shop: 1, inn: 0.5, npc: 0.3 } }),
  W('item/tool/broom', 'Broom', '扫帚', 'item:broom', { tags: ['wooden', 'flammable', 'straw'], where: { home: 1.5, inn: 1 } }),
  W('item/tool/lockpick', 'Lockpick', '开锁器', 'item:key', { tags: ['metal', 'lockpick'], where: { shop: 0.3, dungeon: 0.5 } }),
  // light
  W('item/light/torch', 'Torch', '火把', 'item:torch', { tags: ['fire-source', 'wooden', 'flammable', 'light'], where: { home: 1, shop: 1, dungeon: 2, inn: 0.5, npc: 0.3 }, makeup: [{ type: 'item/material/stick', count: 1 }, { type: 'item/material/grass', count: 1 }], station: 'hands' }),
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
  W('item/potion/fire_resist', 'Fireproof Draught', '防火药剂', 'item:potion_orange', { tags: ['drinkable', 'glass', 'fragile', 'magical'], where: { library: 0.5, shop: 0.3 } }),
  W('item/potion/mystery', 'Murky Potion', '浑浊药水', 'item:potion_purple', { tags: ['drinkable', 'glass', 'fragile', 'magical', 'unknown'], where: { dungeon: 1, library: 0.5 } }),
  // materials
  W('item/material/log', 'Log', '木头', 'item:log', { tags: ['wooden', 'flammable', 'fuel'], props: { material: 'wood' }, where: { wild: 1, farm: 1, home: 0.5 } }),
  // a log split with an axe at hand (the crafting panel; or the axe on a log on the ground): two planks
  W('item/material/plank', 'Plank', '木板', 'item:plank', { tags: ['wooden', 'flammable'], props: { material: 'wood' }, where: { smithy: 1, farm: 0.5 }, makeup: [{ type: 'item/material/log', count: 1 }], station: 'hands', tools: ['tool:axe'], yields: 2 }),
  W('item/material/stick', 'Stick', '树枝', 'item:stick', { tags: ['wooden', 'flammable', 'fuel'], props: { material: 'wood' }, where: { wild: 3 } }),
  W('item/material/stone', 'Stone', '石块', 'item:stone', { tags: ['stone', 'heavy'], props: { material: 'stone' }, where: { wild: 3, dungeon: 2 } }),
  W('item/material/grass', 'Cut Grass', '干草', 'item:grass', { tags: ['plant', 'flammable', 'fuel', 'fiber'], props: { material: 'plant' }, where: { wild: 3, farm: 1 } }),
  W('item/material/coal', 'Coal', '煤炭', 'item:coal', { tags: ['flammable', 'fuel', 'mineral'], where: { smithy: 2, dungeon: 1 } }),
  // ore smelts in a lit forge into its bar (`smelts`, rules.ts smelt/ore); a bar is shaped at the anvil
  W('item/material/iron_ore', 'Iron Ore', '铁矿石', 'item:ore', { tags: ['mineral', 'metal', 'ore'], props: { smelts: 'item/material/iron_ingot' }, where: { dungeon: 2, smithy: 1 } }),
  W('item/material/gold_ore', 'Gold Ore', '金矿石', 'item:ore_gold', { tags: ['mineral', 'metal', 'ore', 'precious'], props: { smelts: 'item/material/gold_ingot' }, where: { dungeon: 0.5 } }),
  W('item/material/iron_ingot', 'Iron Ingot', '铁锭', 'item:ore', { tags: ['metal', 'smelted', 'conductive'], props: { material: 'iron' }, where: { smithy: 2 } }),
  W('item/material/gold_ingot', 'Gold Ingot', '金锭', 'item:ore_gold', { tags: ['metal', 'smelted', 'precious', 'conductive'], props: { material: 'gold' }, where: { smithy: 0.3 } }),
  W('item/material/herb', 'Herb', '草药', 'item:herb', { tags: ['plant', 'flammable', 'medicinal', 'edible'], props: { heal: 3, food: 1 }, where: { wild: 3, temple: 1, farm: 0.5 } }),
  W('item/material/fireweed', 'Fireweed', '火焰草', 'item:herb_red', { tags: ['plant', 'flammable', 'fiery', 'reagent'], where: { wild: 1, library: 0.5 } }),
  W('item/material/frostcap', 'Frostcap', '霜盖菇', 'item:mushroom_blue', { tags: ['fungus', 'icy', 'reagent'], where: { wild: 0.8, dungeon: 0.5 } }),
  W('item/material/feather', 'Feather', '羽毛', 'item:feather', { tags: ['lightweight', 'flammable'], where: { wild: 1, farm: 1 } }),
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
  // wheat is feed too (Minecraft's: a cow or a hen fed wheat, homestead.ts)
  W('item/material/wheat', 'Wheat', '麦子', 'item:wheat', { tags: ['plant', 'flammable', 'dry', 'feed'], where: { farm: 3 } }),
  // the homestead (docs/homestead.md): the Held Ground's coin, and what its stall sells and buys
  W('item/misc/thornmark', 'Thornmark', '银荆币', 'item:thornmark', { tags: ['currency', 'metal', 'precious'], where: {} }),
  W('item/material/fertilizer', 'Fertilizer', '肥料', 'item:fertilizer', { tags: ['fertilizer'], where: { farm: 1 } }),
  W('item/material/feed', 'Animal Feed', '饲料', 'item:feed', { tags: ['feed', 'flammable', 'dry'], where: { farm: 1 } }),
  W('item/misc/bait', 'Bait', '鱼饵', 'item:bait', { tags: ['bait'], props: { casts: 5 }, where: { shop: 0.5 } }),
  W('item/misc/crate_hen', 'Crated Hen', '装箱的母鸡', 'item:crate', { tags: ['animal-crate', 'wooden'], props: { animalType: 'actor/creature/animal/chicken' }, where: {} }),
  W('item/misc/crate_calf', 'Crated Calf', '装箱的小牛', 'item:crate', { tags: ['animal-crate', 'wooden'], props: { animalType: 'actor/creature/animal/calf' }, where: {} }),
  W('item/vessel/bucket/milk', 'Bucket of Milk', '一桶牛奶', 'item:milk', { tags: ['liquid', 'drinkable'], props: { food: 4, heal: 3, emptyType: 'item/vessel/bucket/empty' }, where: {} }),
  // what else bites (homestead.ts FISH): by the hour, the weather, the water — after Stardew's
  W('item/food/fish/sunfish', 'Sunfish', '太阳鱼', 'item:sunfish', { tags: ['edible', 'raw', 'cookable'], props: { heal: 2, food: 2, cookedType: 'item/food/fish/cooked' }, where: {} }),
  W('item/food/fish/perch', 'Perch', '河鲈', 'item:perch', { tags: ['edible', 'raw', 'cookable'], props: { heal: 2, food: 3, cookedType: 'item/food/fish/cooked' }, where: {} }),
  W('item/food/fish/catfish', 'Catfish', '鲶鱼', 'item:catfish', { tags: ['edible', 'raw', 'cookable'], props: { heal: 3, food: 4, cookedType: 'item/food/fish/cooked' }, where: {} }),
  W('item/food/fish/eel', 'Eel', '鳗鱼', 'item:eel', { tags: ['edible', 'raw', 'cookable'], props: { heal: 3, food: 4, cookedType: 'item/food/fish/cooked' }, where: {} }),
  W('item/food/fish/pike', 'Pike', '狗鱼', 'item:pike', { tags: ['edible', 'raw', 'cookable'], props: { heal: 3, food: 4, cookedType: 'item/food/fish/cooked' }, where: {} }),
  W('item/food/fish/dawnscale', 'Dawnscale', '晨鳞鱼', 'item:dawnscale', { tags: ['edible', 'raw', 'cookable', 'precious', 'holy'], props: { heal: 6, food: 4, cookedType: 'item/food/fish/cooked' }, where: {} }),
  W('item/food/fish/carp', 'Golden Carp', '金鳞鲤', 'item:carp', { tags: ['edible', 'raw', 'cookable', 'precious'], props: { heal: 4, food: 4, cookedType: 'item/food/fish/cooked' }, where: {} }),
  W('item/misc/old_boot', 'Soggy Boot', '泡烂的靴子', 'item:boots', { tags: ['leather', 'junk', 'wet'], where: {} }),
  // gems & valuables
  W('item/gem', 'Gem', '宝石', 'item:gem', { tags: ['gem', 'precious', 'crystal'], elemental: true, where: { dungeon: 2, shop: 0.3 } }),
  W('item/valuable/coin_pouch', 'Coin Pouch', '钱袋', 'item:coins', { tags: ['money', 'leather'], props: { value: 20 }, where: { home: 1, npc: 1, dungeon: 1 } }),
  W('item/valuable/ring', 'Ring', '戒指', 'item:ring', { tags: ['wearable'], props: { atk: 1, slot: 'ring' }, materials: ['silver', 'gold', 'iron', 'bone', 'mithril'], elemental: true, where: { home: 0.5, dungeon: 1, npc: 0.3 } }),
  W('item/valuable/amulet', 'Amulet', '护符', 'item:amulet', { tags: ['wearable'], props: { def: 1, slot: 'neck' }, materials: ['silver', 'gold', 'bone', 'crystal'], elemental: true, where: { temple: 1, dungeon: 1 } }),
  W('item/valuable/earring', 'Earring', '耳环', 'item:earring', { tags: ['wearable'], props: { xpRate: 0.1, slot: 'ear' }, materials: ['silver', 'gold', 'bone', 'crystal'], where: { home: 0.5, shop: 0.5, dungeon: 0.5 } }),
  W('item/valuable/goblet', 'Goblet', '高脚杯', 'item:goblet', { materials: ['silver', 'gold'], where: { temple: 1, dungeon: 0.5 } }),
  W('item/valuable/crown', 'Circlet', '头冠', 'item:crown', { tags: ['wearable'], props: { def: 1, slot: 'head', look: 'hat.circlet' }, materials: ['silver', 'gold', 'ringsteel'], where: { dungeon: 0.2 } }),
  W('item/valuable/ancient_ring_shard', 'Ring Shard', '环冠碎片', 'item:shard', { tags: ['ancient', 'runic', 'arcane', 'metal'], where: { dungeon: 0.4 } }),
  // documents
  W('item/document/book', 'Book', '书', 'item:book', { tags: ['paper', 'flammable', 'readable'], where: { library: 5, home: 1, temple: 1 } }),
  W('item/document/scroll', 'Scroll', '卷轴', 'item:scroll', { tags: ['paper', 'flammable', 'readable', 'arcane'], elemental: true, where: { library: 3, temple: 1, dungeon: 1 } }),
  W('item/document/letter', 'Letter', '信件', 'item:letter', { tags: ['paper', 'flammable', 'readable'], where: { home: 1, npc: 0.3 } }),
  W('item/document/map', 'Map', '地图', 'item:map', { tags: ['paper', 'flammable', 'readable'], where: { library: 1, shop: 0.5, dungeon: 0.3 } }),
  // Chapter 1 (docs/chapter-1.md): the Holy City's proclamation of the pilgrimage, the old almanac from before the First Night
  W('item/document/proclamation', 'Proclamation of the Pilgrimage', '朝圣令', 'item:letter', { tags: ['paper', 'flammable', 'readable', 'holy'], props: {
    text: 'By the Church of the Five Sufferings, to every parish and every road: the Seal-bearers can no longer carry what Astra laid upon them. Dusk comes earlier, dawn later; should the five Seals fail, the Long Night falls a second time. The pilgrimage is called. Let the pilgrim seek out the five Seal-bearers, bring back the five instruments, and come to the Holy City for the Rite of the Five Sufferings. Named to this road: the one who came down from the mountain with a fairy. — Sealed in the Holy City.',
    text_zh: '五苦圣教，致各教区、各条道路：五位持印者已无法继续承担阿斯特拉留下的五苦。黄昏一日早过一日，黎明一日迟过一日；五印若尽衰，第二次极夜终将降临。今召朝圣。朝圣者当寻访五位持印者，取回五件圣刑之器，前往圣城，重行五苦大礼。受命踏上此路者：从山上下来、身边跟着一只妖精的人。——圣城用印',
  }, where: {} }),
  // a skill book: read (used on oneself), it teaches the active skill its `teaches` names (rules.ts use/read-skillbook; skills.ts skillBook)
  W('item/document/skillbook', 'Skill Book', '技能书', 'item:book', { tags: ['paper', 'flammable', 'skillbook'], where: {} }),
  W('item/document/almanac', 'Almanac of the First Night', '初夜历书', 'item:book', { tags: ['paper', 'flammable', 'readable', 'ancient'], props: {
    // its last pages: a hand that begs someone to stop him (docs/chapter-1.md, Nessa; lore.md §9's first misreading)
    text: 'Sunset after sunset in a neat column, each a little earlier than the last. On the last pages the hand changes — hurried, pressed so hard the pen has torn the paper: "No sun today. None today. He says he will take it all. Whoever reads this — stop him." After that, nothing.',
    text_zh: '一行行工整的日落时刻，每一行都比上一行早一点。最后几页，字迹变了——仓促，用力得笔尖划破了纸：「今天没有太阳。今天也没有。他说他会把一切都担下来。读到这里的人——阻止他。」再往后，什么也没有。',
  }, where: {} }),
  // the first of the five instruments of the Five Sufferings (docs/lore.md §4): the Crown of Thorns
  // Stigmatic: worn, it wears the self away as it wore Alberic's (lore.md §4) — strength, and experience slow to come
  W('item/relic/crown_of_thorns', 'Crown of Thorns', '荆棘冠', 'item:crown_of_thorns', { tags: ['holy', 'relic', 'sharp', 'thorny', 'wearable', 'quality:legendary', 'wound:crown'], props: { slot: 'head', look: 'hat.thorns', def: 4, atk: 2, xpRate: -0.5, relic: 'crown' }, where: {} }),
  // what the grey man gave a child: an ember of a dawn flame, warm at night (its uses left to the world)
  W('item/misc/warm_ember', 'Warm Ember', '温暖的余烬', 'item:warm_ember', { tags: ['warm', 'light', 'holy'], where: {} }),
  // the bridge's missing nail, pulled straight; a farmer's wedding band
  W('item/misc/ninth_nail', 'The Ninth Nail', '第九根钉子', 'item:ninth_nail', { tags: ['metal', 'iron', 'conductive', 'sharp'], where: {} }),
  W('item/valuable/band', 'Wedding Band', '婚戒', 'item:ring', { tags: ['metal', 'precious', 'wearable'], props: { slot: 'ring' }, where: {} }),
  // the pilgrim before you: a scallop shell on a cord, the pilgrim's mark, found at his cold camp in the forest
  // the White Knight's last gift: one thorn of his crown, still green, that opens the ground he holds for you (haven.ts)
  W('item/relic/oath_thorn', 'The Oath-Thorn', '誓约之棘', 'item:oath_thorn', { tags: ['holy', 'relic', 'keepsake', 'bound', 'important', 'quality:vowed'], where: {} }),
  // what one carried, left where one fell (rules.ts body/rise): opened (a hand on it, or taken), all of it comes back
  W('item/misc/bundle', 'Lost Belongings', '遗落的包裹', 'item:bundle', { tags: ['belongings'], where: {} }),
  W('item/valuable/scallop', "Pilgrim's Scallop", '朝圣者的扇贝', 'item:amulet', { tags: ['holy', 'keepsake', 'wearable', 'quality:vowed'], props: { slot: 'neck', def: 1, xpRate: 0.1, moveHaste: 0.15 }, where: {} }),
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
  W('item/misc/feather_quill', 'Quill', '羽毛笔', 'item:quill', { tags: ['lightweight', 'flammable', 'writing'], where: { library: 2, home: 0.3 } }),
  W('item/misc/ink', 'Ink Pot', '墨水瓶', 'item:ink', { tags: ['glass', 'fragile', 'liquid', 'dye'], where: { library: 2 } }),
  W('item/misc/soap', 'Soap', '肥皂', 'item:soap', { tags: ['slippery', 'cleaning'], where: { home: 0.5, inn: 0.5 } }),
  W('item/misc/firework', 'Firecracker', '爆竹', 'item:firework', { tags: ['explosive', 'flammable', 'paper'], props: { blast: 1 }, where: { shop: 0.3 } }),
  W('item/misc/bomb', 'Blackpowder Bomb', '黑火药炸弹', 'item:bomb', { tags: ['explosive', 'flammable', 'heavy'], props: { blast: 8 }, where: { dungeon: 0.4 } }),
  W('item/misc/snowball', 'Snowball', '雪球', 'item:snowball', { tags: ['icy', 'cold', 'water', 'fragile'], where: {} }),
]

/** Types derived from the catalogue (plus the roots). */
export function itemTypes(): TypeDef[] {
  const roots: TypeDef[] = [
    { id: 'item', name: { en: 'item', zh: '物品' }, tags: ['portable'] },
    // a weapon is kept in the main hand (worn: `wear:weapon`), so the hand may hold something else and it still strikes
    { id: 'item/weapon', name: { en: 'weapon', zh: '武器' }, tags: ['weapon', 'wearable'], props: { slot: 'weapon' } },
    { id: 'item/weapon/blade', tags: ['sharp', 'blade'] },
    { id: 'item/weapon/blunt', tags: ['blunt'] },
    { id: 'item/weapon/polearm', tags: ['sharp', 'long'] },
    // what it looses, drawn in flight (the client's missile:<name>): an arrow, not a bolt of its element
    { id: 'item/weapon/ranged', tags: ['ranged'], props: { missile: 'arrow' } },
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
    // the five instruments of the Five Sufferings (docs/lore.md §4)
    { id: 'item/relic', name: { en: 'relic', zh: '圣物' }, tags: ['relic', 'holy'] },
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
      // what it is worth (docs/npc-sandbox.md §2.10): its own, else its kind's; times its material's and quality's
      props: { value: baseValue(f.id), ...f.props },
      ...(f.makeup && { makeup: f.makeup, station: f.station, craftLevel: f.craftLevel, tools: f.tools, yields: f.yields }),
    })),
  ]
}

export const FORM_BY_ID: Record<string, Form> = Object.fromEntries(FORMS.map((f) => [f.id, f]))

/** What a kind of thing is worth before its material and quality (the longest prefix that names it). */
const VALUES: [string, number][] = [
  ['item/relic', 400],
  ['item/valuable/crown', 120],
  ['item/valuable/coin_pouch', 20],
  ['item/valuable', 40],
  ['item/weapon/magic', 45],
  ['item/weapon/ranged', 35],
  ['item/weapon/polearm', 35],
  ['item/weapon/blade/dagger', 20],
  ['item/weapon/blade/axe', 15],
  ['item/weapon', 30],
  ['item/armor/shield', 25],
  ['item/armor', 35],
  ['item/clothing', 10],
  ['item/tool/lockpick', 8],
  ['item/tool/rope', 4],
  ['item/tool/flint', 3],
  ['item/tool', 12],
  ['item/light', 6],
  ['item/vessel', 4],
  ['item/potion/mystery', 15],
  ['item/potion', 25],
  ['item/food/fish', 6],
  ['item/food/meat', 5],
  ['item/food/bread', 4],
  ['item/food', 3],
  ['item/material/iron_ingot', 15],
  ['item/material/gold_ingot', 15],
  ['item/material/iron_ore', 6],
  ['item/material/gold_ore', 20],
  ['item/material/plank', 3],
  ['item/material', 2],
  ['item/seed', 1],
  ['item/document/skillbook', 60],
  ['item/document', 8],
  ['item/misc/thornmark', 1],
  ['item/misc/old_boot', 1],
  ['item/misc', 5],
]
export function baseValue(type: string): number {
  return VALUES.find(([p]) => type === p || type.startsWith(p + '/'))?.[1] ?? 2
}

/** Each profession's legendary arms, in the order a fallen sin hands them over (bosses.ts). */
export const LEGENDARY_ARMS: Record<string, string[]> = {
  assassin: ['item/weapon/blade/dagger/nightfang', 'item/weapon/blade/dagger/mirrorshard'],
  warrior: ['item/weapon/blade/sword/oathbrand', 'item/armor/shield/unfallen'],
  ranger: ['item/weapon/ranged/bow/galestring', 'item/weapon/ranged/bow/starfall'],
  mage: ['item/weapon/magic/staff/emberheart', 'item/weapon/magic/staff/rimecrown'],
}

/** Instantiate an item: material × quality × element, with a composed bilingual name. */
/** `trait`: whether a Vowbound piece rolls its vow's trait (a named piece says its own). */
export function makeItem(rng: Rng, form: Form, opts: { material?: string; quality?: string; element?: string | null; trait?: boolean } = {}): Omit<Entity, 'id' | 'place'> {
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
  // gear has a tier: what is wielded, worn (armour and clothing alike) or treasured
  const isGear = form.id.startsWith('item/weapon') || form.id.startsWith('item/armor') || form.id.startsWith('item/clothing') || form.id.startsWith('item/tool') || form.id.startsWith('item/valuable')
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
  // a Vowbound piece keeps something of its vow beyond its numbers
  if (quality === 'vowed' && opts.trait !== false) Object.assign(props, rng.pick(VOW_TRAITS))
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
