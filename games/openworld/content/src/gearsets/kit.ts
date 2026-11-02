// The main line's sets (docs/sets.md, 2026-11-01): what a set and its pieces are, and how a set's words and numbers are
// made from what its chapter's file writes. A piece is a type of its own under a wearable form (its slot, look and
// makeup the form's), with its own picture (`item:set/<set>/<slot>`, tools/src/art/sets.py) and its own words; its main
// stats are written as a level-1 piece's and scaled to its level as a monster's piece is (trophies.ts), a set's piece
// as a fine one. The set's bonuses come at 2 / 4 / 6 pieces (four-piece sets at 2 / 4, trinkets at 2 / 3), their attack
// and defence scaled by the set's level too; the best of them grants a power (powers.ts).

import { levelFactor, type GearSet, type GearSetBonus, type Text } from '@openworld/engine'
import { GEAR_LEVELS } from '../gear.ts'
import { RELICS, SET_POWERS, VOWS } from '../powers.ts'

export type Slot = 'head' | 'shoulders' | 'body' | 'hands' | 'waist' | 'feet' | 'neck' | 'ear' | 'ring'
export type Chapter = 'ch1' | 'ch2' | 'ch3' | 'ch4' | 'ch5' | 'fin'
export type Lean = 'any' | 'assassin' | 'warrior' | 'ranger' | 'mage'

/**
 * Where a piece is found — the remains or a chest on a map (the demo lays it: tools/src/demo/sets), a person's
 * stock, a quest's reward, a boss's sure drop — for the wiki's words and the test that finds every piece in the world.
 */
export type From = `map:${string}` | `npc:${string}` | `quest:${string}` | `boss:${string}`

export interface PieceDef {
  slot: Slot
  /** The wearable form it is one of (`item/armor/helmet`, `item/clothing/hood` …): its slot's, its look's. */
  form: string
  en: string
  zh: string
  /** Its words: who wore it, what became of them (docs/writing.md). */
  text: string
  textZh: string
  /** What it gives beyond its slot's defence (shares as they are; attack and defence as a level-1 piece's). */
  props?: Record<string, number>
  from: From
  /** Its own level, where it is not its set's (a Pilgrim's, each its chapter's; a Seal's, its boss's). */
  level?: number
  /** Its picture's shape among its slot's (sets.py): a helm's crest, a robe's cut. */
  shape?: string
}

export interface BonusDef {
  pieces: number
  props?: Record<string, number>
  vow?: string
  relic?: string
  power?: string
}

export interface SetDef {
  id: string
  en: string
  zh: string
  chapter: Chapter | 'all'
  level: number
  lean: Lean
  /** The colour its pieces show on the one who wears them (a look colour, looks.ts LOOK_COLORS), and its pictures' four. */
  look?: string
  palette: [main: string, dark: string, accent: string, light: string]
  pieces: PieceDef[]
  bonuses: BonusDef[]
}

/** A set's piece as a fine one, as the monster families' are (trophies.ts SET_TIER). */
const SET_TIER = 1.25
/** A slot's defence and attack before its level (a heavy form a little more), and what the piece is worth at level 1. */
const BASE: Record<Slot, { def?: number; atk?: number; value: number }> = {
  head: { def: 1, value: 40 },
  shoulders: { def: 1, value: 40 },
  body: { def: 2, value: 60 },
  hands: { def: 1, value: 35 },
  waist: { def: 1, value: 35 },
  feet: { def: 1, value: 35 },
  neck: { def: 1, value: 45 },
  ear: { value: 45 },
  ring: { atk: 1, value: 45 },
}
/** The heavier forms' extra defence: plate and helm take blows a cloth does not. */
const HEAVY: Record<string, number> = { 'item/armor/breastplate': 1, 'item/armor/helmet': 1, 'item/armor/pauldrons': 1 }

const scale = (n: number, level: number, tier = 1): number => Math.max(1, Math.round(n * tier * levelFactor(GEAR_LEVELS, level)))

/** A piece's type id: its form's, then its set's (and its slot where a set has two of a form). */
export const pieceType = (s: SetDef, p: PieceDef): string => `${p.form}/${s.id}${s.pieces.filter((q) => q.form === p.form).length > 1 ? `_${p.slot}` : ''}`
/** A piece's picture in the catalogue. */
export const pieceSprite = (s: SetDef, p: PieceDef): string => `item:set/${s.id}/${p.slot}`

/** A piece's props as its type keeps them: its slot and level, its set, its main stats at its level, its words. */
export function pieceProps(s: SetDef, p: PieceDef): Record<string, number | string> {
  const level = p.level ?? s.level
  const base = BASE[p.slot]
  const def = (p.props?.def ?? base.def ?? 0) + (HEAVY[p.form] ?? 0)
  const atk = p.props?.atk ?? base.atk ?? 0
  const props: Record<string, number | string> = { slot: p.slot, level, set: s.id, value: Math.round(base.value * levelFactor(GEAR_LEVELS, level)), text: p.text, text_zh: p.textZh }
  for (const [k, v] of Object.entries(p.props ?? {})) if (k !== 'def' && k !== 'atk') props[k] = v
  if (def) props.def = scale(def, level, SET_TIER)
  if (atk) props.atk = scale(atk, level, SET_TIER)
  if (s.look) props.lookColor = s.look
  return props
}

// ------------------------------------------------------------------ a bonus's words, made from its numbers

const pct = (n: number) => `${Math.round(n * 100)}%`
/** How each number a bonus gives is said (a share as a percentage). */
const SAY: Record<string, (n: number) => [string, string]> = {
  atk: (n) => [`attack +${n}`, `攻击 +${n}`],
  def: (n) => [`defence +${n}`, `防御 +${n}`],
  critChance: (n) => [`critical chance +${pct(n)}`, `暴击率 +${pct(n)}`],
  critDamage: (n) => [`critical damage +${pct(n)}`, `暴击伤害 +${pct(n)}`],
  dodge: (n) => [`dodge +${pct(n)}`, `闪避 +${pct(n)}`],
  lifesteal: (n) => [`each hit draws ${n} health`, `每次命中吸取 ${n} 点生命`],
  cdr: (n) => [`skills rest ${pct(n)} less`, `技能冷却 -${pct(n)}`],
  xpRate: (n) => [`experience +${pct(n)}`, `经验 +${pct(n)}`],
  luck: (n) => [`luck +${pct(n)}`, `幸运 +${pct(n)}`],
  moveHaste: (n) => [`movement speed +${pct(n)}`, `移动速度 +${pct(n)}`],
  attackHaste: (n) => [`attack speed +${pct(n)}`, `攻击速度 +${pct(n)}`],
  block: (n) => [`block with a shield +${pct(n)}`, `持盾格挡 +${pct(n)}`],
  holdFast: (n) => [`standing your ground, ${pct(n)} less harm`, `站定时受到的伤害 -${pct(n)}`],
  'night:def': (n) => [`defence +${n} at night`, `夜间防御 +${n}`],
  'night:atk': (n) => [`attack +${n} at night`, `夜间攻击 +${n}`],
  'night:critChance': (n) => [`critical chance +${pct(n)} at night`, `夜间暴击率 +${pct(n)}`],
}
const SCALED = new Set(['atk', 'def', 'night:def', 'night:atk'])

/** A bonus as the world keeps it: its numbers (attack and defence at the set's level), its power, and its words. */
export function bonusOf(s: SetDef, b: BonusDef): GearSetBonus {
  const props: Record<string, number> = {}
  for (const [k, v] of Object.entries(b.props ?? {})) props[k] = SCALED.has(k) ? scale(v, s.level) : v
  const en: string[] = []
  const zh: string[] = []
  for (const [k, v] of Object.entries(props)) {
    const say = SAY[k]
    if (!say) throw new Error(`set ${s.id}: no words for ${k}`)
    const [e, z] = say(v)
    en.push(e)
    zh.push(z)
  }
  const power = b.vow ? VOWS[b.vow] : b.relic ? RELICS[b.relic] : b.power ? SET_POWERS[b.power] : undefined
  if ((b.vow || b.relic || b.power) && !power) throw new Error(`set ${s.id}: unknown power ${b.vow ?? b.relic ?? b.power}`)
  if (power) {
    en.push(`${power.en}: ${power.text.en}`)
    zh.push(`${power.zh}：${power.text.zh}`)
  }
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
  const text: Text = { en: cap(en.join(', ')), zh: zh.join('，') }
  return { pieces: b.pieces, props, text, ...(b.vow && { vow: b.vow }), ...(b.relic && { relic: b.relic }), ...(b.power && { power: b.power }) }
}

/** The set as the world knows it (Ontology.sets). */
export const gearSetOf = (s: SetDef): GearSet => ({ id: s.id, name: { en: s.en, zh: s.zh }, pieces: s.pieces.length, bonuses: s.bonuses.map((b) => bonusOf(s, b)) })

/** A piece (for the chapters' files): slot, form, names, words, where, and what it adds. */
export const P = (slot: Slot, form: string, en: string, zh: string, text: string, textZh: string, from: From, props?: Record<string, number>, extra: Partial<PieceDef> = {}): PieceDef => ({ slot, form, en, zh, text, textZh, from, ...(props && { props }), ...extra })

/** The wearable forms the pieces are made of, by name, for the chapters' files. */
export const F = {
  helmet: 'item/armor/helmet',
  hood: 'item/clothing/hood',
  hat: 'item/clothing/hat',
  circlet: 'item/valuable/crown',
  pauldrons: 'item/armor/pauldrons',
  cloak: 'item/clothing/cloak',
  plate: 'item/armor/breastplate',
  jerkin: 'item/armor/jerkin',
  robe: 'item/clothing/robe',
  gloves: 'item/clothing/gloves',
  belt: 'item/clothing/belt',
  boots: 'item/clothing/boots',
  amulet: 'item/valuable/amulet',
  earring: 'item/valuable/earring',
  ring: 'item/valuable/ring',
} as const
