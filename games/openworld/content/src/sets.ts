// The four sets of gear (2026-10-11), one for each profession, each covering the whole body: head, shoulders, body,
// hands, waist and feet; neck, ear and ring; the main hand and the off hand. Every piece is forged at an anvil with a
// smith's hammer carried (life.ts: the smith's craft); its main ingredient gives its material, the smith's level and
// craft its quality, the set its name and what it adds. As in Dungeon Fighter, a profession's gear is two sets, not
// one: its armour (the six pieces on the body: bonuses at two, four and six) and its trinkets (neck, ear, ring: at two
// and three); the weapon and the off hand are pieces of their own, in no set (World.stat reads `Ontology.sets`, a
// piece per slot). Only the weapon and the off hand are a profession's own (their forms' `profession:` tags); the rest
// anyone may wear.

import type { GearSet, Recipe, Text } from '@openworld/engine'
import { FORM_BY_ID } from './items.ts'

const L = (en: string, zh: string): Text => ({ en, zh })

const STEEL = 'item/material/steel_bar'
const IRON = 'item/material/iron_ingot'
const GOLD = 'item/material/gold_ingot'
const LEATHER = 'item/material/leather'
const CLOTH = 'item/material/cloth'
const PLANK = 'item/material/plank'
const FEATHER = 'item/material/feather'

/** One piece of a set: the form it is, its name, what it takes (the first gives its material), what it adds. */
interface Piece {
  slot: string
  type: string
  en: string
  zh: string
  needs: [string, number][]
  props?: Record<string, number>
  /** A skill its making needs (jewellery: the Jeweler). */
  skill?: string
}

interface SetDef {
  id: string
  profession: string
  en: string
  zh: string
  /** How hard its pieces are to make (the quality a smith reaches against it). */
  level: number
  pieces: Piece[]
  /** What its armour gives worn together (head, shoulders, body, hands, waist, feet), and its trinkets (neck, ear, ring). */
  armour: GearSet['bonuses']
  trinkets: GearSet['bonuses']
}

const P = (slot: string, type: string, en: string, zh: string, needs: [string, number][], props?: Record<string, number>, skill?: string): Piece => ({ slot, type, en, zh, needs, ...(props && { props }), ...(skill && { skill }) })
/** A set's ring (one piece: a second of it worn counts once). */
const ring = (en: string, zh: string, props: Record<string, number>): Piece => P('ring', 'item/valuable/ring', en, zh, [[GOLD, 1]], props, 'jeweler')
const pct = (n: number) => `${Math.round(n * 100)}%`

export const SET_DEFS: SetDef[] = [
  {
    id: 'shadowfang', profession: 'assassin', en: 'Shadowfang', zh: '影刃', level: 3,
    pieces: [
      P('head', 'item/clothing/hood', 'Shadowfang Hood', '影刃兜帽', [[LEATHER, 2], [CLOTH, 1]], { dodge: 0.01 }),
      P('ear', 'item/valuable/earring', 'Shadowfang Earring', '影刃耳坠', [[GOLD, 1]], { critChance: 0.01 }, 'jeweler'),
      P('neck', 'item/valuable/amulet', 'Shadowfang Pendant', '影刃吊坠', [[GOLD, 1], [STEEL, 1]], { dodge: 0.01 }, 'jeweler'),
      P('shoulders', 'item/clothing/cloak', 'Shadowfang Cloak', '影刃披风', [[CLOTH, 3], [LEATHER, 1]], { dodge: 0.02 }),
      P('body', 'item/armor/jerkin', 'Shadowfang Jerkin', '影刃皮甲', [[LEATHER, 4], [STEEL, 1]], { dodge: 0.03 }),
      P('hands', 'item/clothing/gloves', 'Shadowfang Gloves', '影刃手套', [[LEATHER, 2]], { critChance: 0.02 }),
      ring('Shadowfang Ring', '影刃指环', { critDamage: 0.1 }),
      P('waist', 'item/clothing/belt', 'Shadowfang Belt', '影刃腰带', [[LEATHER, 2], [IRON, 1]], { luck: 0.03 }),
      P('feet', 'item/clothing/boots', 'Shadowfang Boots', '影刃软靴', [[LEATHER, 3]], { dodge: 0.02 }),
      P('weapon', 'item/weapon/blade/dagger', 'Shadowfang', '影刃', [[STEEL, 2], [LEATHER, 1]], { critChance: 0.03 }),
      P('arm', 'item/armor/parrying_dagger', 'Shadowfang Parrier', '影刃格挡短刃', [[STEEL, 1], [LEATHER, 1]]),
    ],
    armour: [
      { pieces: 2, props: { dodge: 0.03 }, text: L(`Dodge +${pct(0.03)}`, `闪避 +${pct(0.03)}`) },
      { pieces: 4, props: { luck: 0.1, critChance: 0.05 }, text: L(`Luck +${pct(0.1)}, critical chance +${pct(0.05)}`, `幸运 +${pct(0.1)}，暴击率 +${pct(0.05)}`) },
      { pieces: 6, props: { critDamage: 0.3, lifesteal: 1 }, text: L(`Critical damage +${pct(0.3)}; each hit draws 1 health`, `暴击伤害 +${pct(0.3)}，每次命中吸取 1 点生命`) },
    ],
    trinkets: [
      { pieces: 2, props: { critChance: 0.03 }, text: L(`Critical chance +${pct(0.03)}`, `暴击率 +${pct(0.03)}`) },
      { pieces: 3, props: { critDamage: 0.15, attackHaste: 0.05 }, text: L(`Critical damage +${pct(0.15)}, attack speed +${pct(0.05)}`, `暴击伤害 +${pct(0.15)}，攻击速度 +${pct(0.05)}`) },
    ],
  },
  {
    id: 'oathguard', profession: 'warrior', en: 'Oathguard', zh: '誓卫', level: 4,
    pieces: [
      P('head', 'item/armor/helmet', 'Oathguard Helm', '誓卫战盔', [[STEEL, 2]]),
      P('ear', 'item/valuable/earring', 'Oathguard Earring', '誓卫耳坠', [[GOLD, 1]], { def: 1 }, 'jeweler'),
      P('neck', 'item/valuable/amulet', 'Oathguard Gorget', '誓卫护喉', [[GOLD, 1], [STEEL, 1]], { def: 1 }, 'jeweler'),
      P('shoulders', 'item/armor/pauldrons', 'Oathguard Pauldrons', '誓卫肩甲', [[STEEL, 2]]),
      P('body', 'item/armor/breastplate', 'Oathguard Plate', '誓卫板甲', [[STEEL, 4], [LEATHER, 1]]),
      P('hands', 'item/clothing/gloves', 'Oathguard Gauntlets', '誓卫护手', [[LEATHER, 1], [STEEL, 1]], { def: 1 }),
      ring('Oathguard Signet', '誓卫印戒', { atk: 1 }),
      P('waist', 'item/clothing/belt', 'Oathguard Girdle', '誓卫束带', [[LEATHER, 2], [STEEL, 1]], { def: 1 }),
      P('feet', 'item/clothing/boots', 'Oathguard Greaves', '誓卫战靴', [[LEATHER, 2], [STEEL, 1]], { def: 1 }),
      P('weapon', 'item/weapon/blade/sword', 'Oathguard Blade', '誓卫长剑', [[STEEL, 2], [LEATHER, 1]]),
      P('arm', 'item/armor/shield', 'Oathguard Bulwark', '誓卫塔盾', [[STEEL, 3], [PLANK, 1]], { block: 0.1 }),
    ],
    armour: [
      { pieces: 2, props: { def: 2 }, text: L('Defence +2', '防御 +2') },
      { pieces: 4, props: { atk: 1, def: 2 }, text: L('Attack +1, defence +2', '攻击 +1，防御 +2') },
      { pieces: 6, props: { def: 3, lifesteal: 1 }, text: L('Defence +3; each hit draws 1 health', '防御 +3，每次命中吸取 1 点生命') },
    ],
    trinkets: [
      { pieces: 2, props: { atk: 1 }, text: L('Attack +1', '攻击 +1') },
      { pieces: 3, props: { atk: 1, def: 3 }, text: L('Attack +1, defence +3', '攻击 +1，防御 +3') },
    ],
  },
  {
    id: 'windrunner', profession: 'ranger', en: 'Windrunner', zh: '风行', level: 3,
    pieces: [
      P('head', 'item/clothing/hood', 'Windrunner Hood', '风行兜帽', [[LEATHER, 2]], { critChance: 0.01 }),
      P('ear', 'item/valuable/earring', 'Windrunner Earring', '风行耳坠', [[GOLD, 1]], { xpRate: 0.05 }, 'jeweler'),
      P('neck', 'item/valuable/amulet', 'Windrunner Token', '风行信物', [[GOLD, 1], [IRON, 1]], { dodge: 0.01 }, 'jeweler'),
      P('shoulders', 'item/clothing/cloak', 'Windrunner Mantle', '风行披肩', [[CLOTH, 3], [FEATHER, 4]], { dodge: 0.02 }),
      P('body', 'item/armor/jerkin', 'Windrunner Jerkin', '风行皮甲', [[LEATHER, 4], [IRON, 1]]),
      P('hands', 'item/clothing/gloves', 'Windrunner Bracers', '风行护腕', [[LEATHER, 2]], { atk: 1 }),
      ring('Windrunner Ring', '风行指环', { critChance: 0.02 }),
      P('waist', 'item/clothing/belt', 'Windrunner Belt', '风行腰带', [[LEATHER, 2]], { dodge: 0.01 }),
      P('feet', 'item/clothing/boots', 'Windrunner Boots', '风行长靴', [[LEATHER, 3]], { dodge: 0.02 }),
      P('weapon', 'item/weapon/ranged/bow', 'Windrunner Bow', '风行长弓', [[PLANK, 3], [LEATHER, 1], [IRON, 1]], { critChance: 0.03 }),
      P('arm', 'item/armor/quiver', 'Windrunner Quiver', '风行箭袋', [[LEATHER, 3], [FEATHER, 6]]),
    ],
    armour: [
      { pieces: 2, props: { dodge: 0.04 }, text: L(`Dodge +${pct(0.04)}`, `闪避 +${pct(0.04)}`) },
      { pieces: 4, props: { atk: 2 }, text: L('Attack +2', '攻击 +2') },
      { pieces: 6, props: { critChance: 0.06, critDamage: 0.2 }, text: L(`Critical chance +${pct(0.06)}, critical damage +${pct(0.2)}`, `暴击率 +${pct(0.06)}，暴击伤害 +${pct(0.2)}`) },
    ],
    trinkets: [
      { pieces: 2, props: { xpRate: 0.1 }, text: L(`Experience +${pct(0.1)}`, `经验 +${pct(0.1)}`) },
      { pieces: 3, props: { cdr: 0.1, attackHaste: 0.05 }, text: L(`Skills rest ${pct(0.1)} less; attack speed +${pct(0.05)}`, `技能冷却 -${pct(0.1)}，攻击速度 +${pct(0.05)}`) },
    ],
  },
  {
    id: 'starweave', profession: 'mage', en: 'Starweave', zh: '星辉', level: 3,
    pieces: [
      P('head', 'item/valuable/crown', 'Starweave Circlet', '星辉头环', [[GOLD, 1]], { cdr: 0.03 }, 'jeweler'),
      P('ear', 'item/valuable/earring', 'Starweave Earring', '星辉耳坠', [[GOLD, 1]], { xpRate: 0.05 }, 'jeweler'),
      P('neck', 'item/valuable/amulet', 'Starweave Amulet', '星辉护符', [[GOLD, 1], [IRON, 1]], { atk: 1 }, 'jeweler'),
      P('shoulders', 'item/clothing/cloak', 'Starweave Mantle', '星辉披肩', [[CLOTH, 4]], { cdr: 0.02 }),
      P('body', 'item/clothing/robe', 'Starweave Robe', '星辉法袍', [[CLOTH, 5], [GOLD, 1]], { cdr: 0.03 }),
      P('hands', 'item/clothing/gloves', 'Starweave Gloves', '星辉手套', [[CLOTH, 2]], { atk: 1 }),
      ring('Starweave Ring', '星辉指环', { atk: 1 }),
      P('waist', 'item/clothing/belt', 'Starweave Sash', '星辉腰带', [[CLOTH, 2]], { xpRate: 0.03 }),
      P('feet', 'item/clothing/boots', 'Starweave Slippers', '星辉便鞋', [[CLOTH, 2], [LEATHER, 1]], { cdr: 0.02 }),
      P('weapon', 'item/weapon/magic/staff', 'Starweave Staff', '星辉法杖', [[PLANK, 2], [GOLD, 1]], { critChance: 0.03 }),
      P('arm', 'item/armor/tome', 'Starweave Tome', '星辉法典', [[LEATHER, 1], [CLOTH, 2], [FEATHER, 2]]),
    ],
    armour: [
      { pieces: 2, props: { xpRate: 0.1 }, text: L(`Experience +${pct(0.1)}`, `经验 +${pct(0.1)}`) },
      { pieces: 4, props: { cdr: 0.1 }, text: L(`Skills rest ${pct(0.1)} less`, `技能冷却 -${pct(0.1)}`) },
      { pieces: 6, props: { atk: 3, critChance: 0.05 }, text: L(`Attack +3, critical chance +${pct(0.05)}`, `攻击 +3，暴击率 +${pct(0.05)}`) },
    ],
    trinkets: [
      { pieces: 2, props: { atk: 1 }, text: L('Attack +1', '攻击 +1') },
      { pieces: 3, props: { cdr: 0.08, critChance: 0.03 }, text: L(`Skills rest ${pct(0.08)} less; critical chance +${pct(0.03)}`, `技能冷却 -${pct(0.08)}，暴击率 +${pct(0.03)}`) },
    ],
  },
]

/** Which of a profession's two sets a slot's piece belongs to (none: the weapon and the off hand). */
export const ARMOUR_SLOTS = ['head', 'shoulders', 'body', 'hands', 'waist', 'feet']
export const TRINKET_SLOTS = ['neck', 'ear', 'ring']
export const setOfSlot = (id: string, slot: string): string | undefined => (ARMOUR_SLOTS.includes(slot) ? id : TRINKET_SLOTS.includes(slot) ? `${id}_trinkets` : undefined)

/** The sets as the world knows them (Ontology.sets): each profession's armour (six pieces) and trinkets (three). */
export const GEAR_SETS: GearSet[] = SET_DEFS.flatMap((s) => [
  { id: s.id, name: L(`${s.en} Armour`, `${s.zh}防具`), pieces: ARMOUR_SLOTS.length, bonuses: s.armour },
  { id: `${s.id}_trinkets`, name: L(`${s.en} Trinkets`, `${s.zh}首饰`), pieces: TRINKET_SLOTS.length, bonuses: s.trinkets },
])

/** Each piece, forged at an anvil with a hammer carried: named for its profession's gear, carrying its set (if any) and what it adds. */
export const SET_RECIPES: Recipe[] = SET_DEFS.flatMap((s) =>
  s.pieces.map((p): Recipe => ({
    id: `set/${s.id}/${p.slot}`,
    name: L(p.en, p.zh),
    sprite: FORM_BY_ID[p.type]?.sprite ?? 'item:bag',
    group: `set:${s.id}`,
    needs: p.needs.map(([type, count]) => ({ type, count })),
    make: { type: p.type, name: L(p.en, p.zh), props: { ...(setOfSlot(s.id, p.slot) && { set: setOfSlot(s.id, p.slot) }), ...p.props } },
    station: 'anvil',
    tools: ['tool:hammer'],
    level: s.level,
    ...(p.skill && { skill: p.skill }),
  })),
)
