// Every kind of monster's own piece of gear (2026-10-11): one piece per kind, not a set. Felling one, the one who
// struck may find it in their bag — a small chance each time (a boss's sure), and at the fiftieth without it, surely
// (the loot module's `trophy` primitive keeps the count on the striker: `trophy.<type>`; LOOT below its pity). Its main
// stats are its own and fixed (the props below); the four small extras it rolls as it is made (affixes.ts, the table
// AFFIX_TABLE here), as every made piece of gear does. As the forged gear (sets.ts, after Dungeon Fighter), the pieces
// of one family of monsters make an armour set (the six on the body) or a trinket set (neck, ear, ring); a few bosses'
// pieces stand alone, stronger, in no set (Ontology.sets).

import { levelFactor, type AffixTable, type GearSet, type LootParams, type Text } from '@openworld/engine'
import { GEAR_LEVELS } from './gear.ts'

const L = (en: string, zh: string): Text => ({ en, zh })

/** One kind's piece: the creature, the piece's type (under a wearable form, which gives its slot and picture), names, set, main stats. */
export interface Trophy {
  kind: string
  type: string
  sprite: string
  en: string
  zh: string
  /** Its family's set (none: a piece that stands alone). */
  set?: string
  /** The chance one felling gives it (before the pity count). */
  chance: number
  value: number
  /** Its level (world-model.md §6.8): its kind's place in the world, 1 … 20. */
  level: number
  props: Record<string, number | string>
}

/** How often each felling gives the piece: the common, the stronger, and a boss — met once in a world, it always does. */
const COMMON = 0.04
const ELITE = 0.1
const BOSS = 1

/**
 * A piece's main stats (defence, attack) are written as a level-1 piece's and scaled to its level (the world's curve,
 * items.ts GEAR_LEVELS), a set's piece as a fine one (×1.25), one that stands alone as a masterwork (×1.5): so a higher
 * kind's piece is the better, and a boss's alone the best of its level. Its shares (a crit chance, a dodge) are its own.
 */
const SET_TIER = 1.25
const ALONE_TIER = 1.5
const scaled = (props: Record<string, number>, level: number, tier: number): Record<string, number> => {
  const out = { ...props }
  for (const k of ['def', 'atk'] as const) if (typeof out[k] === 'number') out[k] = Math.max(1, Math.round(out[k] * tier * levelFactor(GEAR_LEVELS, level)))
  return out
}

const T = (kind: string, type: string, sprite: string, slot: string, en: string, zh: string, set: string | undefined, chance: number, level: number, value: number, props: Record<string, number>): Trophy => ({
  kind: `actor/creature/${kind}`,
  type,
  sprite,
  en,
  zh,
  ...(set && { set }),
  chance,
  value: Math.round(value * levelFactor(GEAR_LEVELS, level)),
  level,
  props: { slot, level, ...scaled(props, level, set ? SET_TIER : ALONE_TIER) },
})

export const TROPHIES: Trophy[] = [
  // the Gelatin's armour: the slimes, soft and quick to mend
  T('slime/king_slime', 'item/clothing/hat/jellycrown', 'item:hat', 'head', 'Crown of the Slime King', '史莱姆王冠', 'gelatin', BOSS, 3, 120, { def: 2, lifesteal: 1, xpRate: 0.1 }),
  T('slime/water_slime', 'item/clothing/cloak/tidecloak', 'item:cloak', 'shoulders', 'Tideslick Cloak', '潮滑披风', 'gelatin', COMMON, 1, 35, { def: 1, cdr: 0.04 }),
  T('slime/green_slime', 'item/armor/jerkin/gelhide', 'item:armor', 'body', 'Gelhide Vest', '凝胶软甲', 'gelatin', COMMON, 1, 35, { def: 2 }),
  T('slime/fire_slime', 'item/clothing/gloves/emberjelly', 'item:gloves', 'hands', 'Emberjelly Gloves', '焰胶手套', 'gelatin', COMMON, 1, 35, { atk: 1, critDamage: 0.1 }),
  T('slime/spark_slime', 'item/clothing/belt/sparkcord', 'item:belt', 'waist', 'Sparkcord Sash', '电光腰绳', 'gelatin', COMMON, 1, 35, { def: 1, attackHaste: 0.05 }),
  T('slime/frost_slime', 'item/clothing/boots/rimejelly', 'item:boots', 'feet', 'Rimejelly Boots', '霜胶长靴', 'gelatin', COMMON, 1, 35, { def: 1, moveHaste: 0.05 }),
  // the Wild Hunt's armour: beasts and the things of caves and shores
  T('beast/frost_wolf', 'item/clothing/hood/frostfang', 'item:cloak', 'head', 'Frostfang Hood', '霜牙兜帽', 'wildhunt', ELITE, 5, 45, { def: 1, critChance: 0.03 }),
  T('beast/wolf', 'item/clothing/cloak/wolfpelt', 'item:cloak', 'shoulders', 'Wolfpelt Mantle', '狼皮披肩', 'wildhunt', COMMON, 2, 30, { def: 1, attackHaste: 0.05 }),
  T('crab', 'item/armor/breastplate/carapace', 'item:armor', 'body', 'Carapace Plate', '巨蟹甲壳', 'wildhunt', ELITE, 4, 60, { def: 3 }),
  T('spider', 'item/clothing/gloves/silkspinner', 'item:gloves', 'hands', 'Silkspinner Gloves', '织丝手套', 'wildhunt', COMMON, 2, 35, { critChance: 0.03, luck: 0.05 }),
  T('beast/boar', 'item/clothing/belt/tuskbelt', 'item:belt', 'waist', 'Tusked Belt', '獠牙腰带', 'wildhunt', COMMON, 3, 35, { def: 1, luck: 0.05 }),
  T('beast/bat', 'item/clothing/boots/batwing', 'item:boots', 'feet', 'Batwing Slippers', '蝠影软靴', 'wildhunt', COMMON, 1, 30, { dodge: 0.03, luck: 0.05 }),
  // the Barrow-born's trinkets: what does not stay buried
  T('undead/ghost', 'item/valuable/amulet/wraithlocket', 'item:amulet', 'neck', 'Wraith Locket', '幽魂吊坠', 'barrowborn', COMMON, 4, 40, { dodge: 0.03, cdr: 0.04 }),
  T('undead/zombie', 'item/valuable/earring/gravebell', 'item:earring', 'ear', 'Gravebell Earring', '墓铃耳坠', 'barrowborn', COMMON, 2, 35, { def: 1, luck: 0.05 }),
  T('undead/skeleton', 'item/valuable/ring/bonering', 'item:ring', 'ring', 'Ossuary Ring', '白骨指环', 'barrowborn', COMMON, 3, 40, { atk: 1, critDamage: 0.1 }),
  // the Elemental Court's trinkets: stone, ice, flame and storm given a will
  T('golem/ice_golem', 'item/valuable/amulet/rimeheart', 'item:amulet', 'neck', 'Rimeheart Amulet', '寒心护符', 'elemental', ELITE, 6, 55, { def: 1, cdr: 0.05 }),
  T('wisp/storm_wisp', 'item/valuable/earring/stormspark', 'item:earring', 'ear', 'Stormspark Earring', '风暴火花耳坠', 'elemental', COMMON, 5, 40, { cdr: 0.05, attackHaste: 0.05 }),
  T('imp/fire_imp', 'item/valuable/ring/impember', 'item:ring', 'ring', "Imp's Ember Ring", '小鬼余烬戒', 'elemental', COMMON, 5, 40, { atk: 1, critChance: 0.02 }),
  // the Wyrmblood's trinkets: the cyclops and the dragon's brood
  T('cyclops', 'item/valuable/amulet/cyclopseye', 'item:amulet', 'neck', "The Cyclops' Eye", '独眼巨人之瞳', 'wyrmblood', BOSS, 7, 150, { def: 1, critChance: 0.05, critDamage: 0.15 }),
  T('dragon', 'item/valuable/earring/cindertear', 'item:earring', 'ear', 'Cindertear Earring', '烬龙之泪', 'wyrmblood', BOSS, 10, 300, { atk: 2, critDamage: 0.2, lifesteal: 1 }),
  T('whelp', 'item/valuable/ring/whelpfang', 'item:ring', 'ring', 'Whelpfang Ring', '幼龙牙戒', 'wyrmblood', ELITE, 7, 60, { atk: 1, def: 1 }),
  // pieces that stand alone: stronger than any one piece of a set, in none
  T('undead/warden', 'item/armor/helmet/wardenhelm', 'item:helmet', 'head', "The Warden's Helm", '古墓守卫之盔', undefined, BOSS, 5, 120, { def: 2, luck: 0.1, lifesteal: 1 }),
  T('golem/stone_golem', 'item/armor/breastplate/stoneheart', 'item:armor', 'body', 'Stoneheart Plate', '石心胸甲', undefined, ELITE, 6, 70, { def: 3 }),
]

/** What the families' sets give worn together: an armour set at two, four and six pieces, a trinket set at two and three. */
const FAMILIES: { id: string; en: string; zh: string; bonuses: GearSet['bonuses'] }[] = [
  {
    id: 'gelatin', en: 'Gelatin Armour', zh: '凝胶防具',
    bonuses: [
      { pieces: 2, props: { luck: 0.1 }, text: L('Luck +10%', '幸运 +10%') },
      { pieces: 4, props: { def: 2, moveHaste: 0.05 }, text: L('Defence +2, move speed +5%', '防御 +2，移速 +5%') },
      { pieces: 6, props: { lifesteal: 1, def: 3 }, text: L('Each hit draws 1 health; defence +3', '每次命中吸取 1 点生命，防御 +3') },
    ],
  },
  {
    id: 'wildhunt', en: 'Wild Hunt Armour', zh: '荒野猎手防具',
    bonuses: [
      { pieces: 2, props: { attackHaste: 0.05 }, text: L('Attack speed +5%', '攻速 +5%') },
      { pieces: 4, props: { critChance: 0.05, dodge: 0.03 }, text: L('Critical chance +5%, dodge +3%', '暴击率 +5%，闪避 +3%') },
      { pieces: 6, props: { atk: 3, critDamage: 0.25 }, text: L('Attack +3, critical damage +25%', '攻击 +3，暴伤 +25%') },
    ],
  },
  {
    id: 'barrowborn', en: 'Barrow-born Trinkets', zh: '亡骸首饰',
    bonuses: [
      { pieces: 2, props: { def: 2 }, text: L('Defence +2', '防御 +2') },
      { pieces: 3, props: { lifesteal: 1, luck: 0.1 }, text: L('Each hit draws 1 health; luck +10%', '每次命中吸取 1 点生命，幸运 +10%') },
    ],
  },
  {
    id: 'elemental', en: 'Elemental Court Trinkets', zh: '元素议庭首饰',
    bonuses: [
      { pieces: 2, props: { cdr: 0.08 }, text: L('Cooldowns −8%', '冷却缩减 8%') },
      { pieces: 3, props: { atk: 2, cdr: 0.08, critChance: 0.04 }, text: L('Attack +2, cooldowns −8%, critical chance +4%', '攻击 +2，冷却缩减 8%，暴击率 +4%') },
    ],
  },
  {
    id: 'wyrmblood', en: 'Wyrmblood Trinkets', zh: '龙裔首饰',
    bonuses: [
      { pieces: 2, props: { atk: 2, def: 2 }, text: L('Attack +2, defence +2', '攻击 +2，防御 +2') },
      { pieces: 3, props: { atk: 4, critDamage: 0.3, lifesteal: 1 }, text: L('Attack +4, critical damage +30%, each hit draws 1 health', '攻击 +4，暴伤 +30%，每次命中吸取 1 点生命') },
    ],
  },
]

/** The monster families' sets (Ontology.sets, beside the forged ones of sets.ts). */
export const TROPHY_SETS: GearSet[] = FAMILIES.map((f) => ({ id: f.id, name: L(f.en, f.zh), pieces: TROPHIES.filter((t) => t.set === f.id).length, bonuses: f.bonuses }))

/** The kinds of monster that have a piece, and the piece: what the creature's props carry (rules.ts combat/defeat). */
export const TROPHY_OF: Record<string, Trophy> = Object.fromEntries(TROPHIES.map((t) => [t.kind, t]))

/** The loot module's numbers and words (Ontology.loot): sure at the fiftieth of a kind, and what the finder is told. */
export const LOOT: LootParams = { pity: 50, found: L('A trophy: {item}!', '获得专属装备：{item}！') }

/**
 * The small extras a piece of gear rolls when it is made (engine affixes.ts): four different ones, each a value in its
 * range on its step. Attack and the mends are rarer; a piece's slot narrows a few (no attack speed on boots).
 */
export const AFFIX_TABLE: AffixTable = {
  count: 4,
  pool: [
    { key: 'atk', min: 1, max: 3, step: 1, weight: 0.7, name: L('Attack', '攻击') },
    { key: 'def', min: 1, max: 3, step: 1, name: L('Defence', '防御') },
    { key: 'critChance', min: 0.01, max: 0.05, step: 0.01, name: L('Critical Chance', '暴击率'), percent: true },
    { key: 'critDamage', min: 0.05, max: 0.2, step: 0.05, name: L('Critical Damage', '暴击伤害'), percent: true },
    { key: 'dodge', min: 0.01, max: 0.04, step: 0.01, name: L('Dodge', '闪避'), percent: true },
    { key: 'lifesteal', min: 1, max: 1, step: 1, weight: 0.3, name: L('Health per hit', '每次命中吸血') },
    { key: 'cdr', min: 0.02, max: 0.06, step: 0.01, name: L('Cooldown Reduction', '冷却缩减'), percent: true },
    { key: 'xpRate', min: 0.03, max: 0.1, step: 0.01, weight: 0.8, name: L('Experience', '经验获取'), percent: true },
    { key: 'luck', min: 0.03, max: 0.1, step: 0.01, weight: 0.8, name: L('Luck', '幸运'), percent: true },
    { key: 'moveHaste', min: 0.02, max: 0.06, step: 0.01, slots: ['feet', 'waist', 'shoulders', 'body', 'ear'], name: L('Movement Speed', '移动速度'), percent: true },
    { key: 'attackHaste', min: 0.02, max: 0.06, step: 0.01, slots: ['weapon', 'hands', 'ring', 'ear', 'arm'], name: L('Attack Speed', '攻击速度'), percent: true },
  ],
}
