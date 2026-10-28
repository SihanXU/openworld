// The standard price of every item (docs/economy.md, 2026-10-27). One rule prices the world: what the world gives —
// gathered, grown, caught, mined, felled, found — has a price of its own (items.ts VALUES, as it comes: of its own
// material, common); what is made is worth what it was made of, each thing at what the world gave for it (its raw
// content: a made part counts as what it took, never at its own price), and the work once (LABOUR). Made of several
// ways (an iron sword, a steel one; healing from honey or from petals), a kind is priced by its cheapest, per its
// material's factor: so no way of making it is worth more than it took. A merchant sells at the price and a quarter,
// buys at half (social.ts markup, markdown; three tenths off and a fifth on at full regard), so nothing bought, made and
// sold again gives back what it cost, however long the chain: the work is counted once, and a merchant's spread is
// wider than it. A maker's level and hand do not raise the price of what they make beyond its quality's share
// (MADE_QUALITY; the engine's params.made); found pieces keep what their quality and level make of them.

import type { Recipe } from '@openworld/engine'
import { FORMS, FORM_BY_ID, MATERIALS, baseValue } from './items.ts'
import { NAMED_VALUE } from './goods.ts'
import { LIFE_RECIPES } from './life.ts'
import { ARCANE_RECIPES } from './arcane.ts'
import { SET_RECIPES } from './sets.ts'

/** What the work adds to what a thing was made of: a quarter, once. */
export const LABOUR = 1.25
/**
 * What a made thing's quality adds to its price (params.made): little, so a master's piece sells for no more than
 * its makings cost from a merchant at full regard (sold: LABOUR × 1.15 × half and a fifth = 0.8625 of what it took;
 * bought: a quarter on and three tenths off = 0.875).
 */
export const MADE_QUALITY: Record<string, number> = { crude: 0.8, fine: 1.08, masterwork: 1.15, vowed: 1.15, legendary: 1.15 }

/**
 * How a merchant prices (social.ts): its markup on what it sells, its markdown on what it buys, and what full regard
 * takes off what it asks (two thirds of it on what it pays).
 */
export const MARKUP = 0.25
export const MARKDOWN = 0.5
export const DISCOUNT = 0.3
/** What a shop's shelf asks for so many of a thing, and what it pays for one: as any merchant would. */
export const shelfPrice = (type: string, count = 1): number => Math.max(1, Math.round(priceOf(type) * count * (1 + MARKUP)))
export const buyBackPrice = (type: string): number => Math.max(1, Math.floor(priceOf(type) * MARKDOWN))

/** A way a thing is made that is not a recipe: a rule that turns one thing into another (rules.ts, life.ts). */
interface Way {
  id: string
  /** what it is made of: its main ingredient's material (the first it takes), unless it makes a thing as it names it */
  of?: string
  takes: [string, number][]
  /** what it gives, the thing priced first */
  gives: [string, number][]
}

/**
 * The rules that make one thing of another, beside the recipes: cooking (`cookedType`), smelting ore by hand at a lit
 * forge (`smelts`), filling a vessel (`waterType`), and cheese from milk over a fire (life.ts ranch/cheese: two, and
 * the bucket back).
 */
function ruleWays(): Way[] {
  const out: Way[] = []
  for (const f of FORMS) {
    for (const key of ['cookedType', 'smelts', 'waterType'] as const) {
      const into = f.props?.[key]
      if (typeof into === 'string' && FORM_BY_ID[into]) out.push({ id: `${key} ${f.id}`, takes: [[f.id, 1]], gives: [[into, 1]] })
    }
  }
  out.push({ id: 'ranch/cheese', takes: [['item/vessel/bucket/milk', 1]], gives: [['item/food/cheese', 2], ['item/vessel/bucket/empty', 1]] })
  return out
}

/** Every recipe that makes an item of other items (not a shop's: coin is no making). */
function recipeWays(): Way[] {
  const made: Recipe[] = [
    ...FORMS.filter((f) => f.station && f.makeup?.length).map((f): Recipe => ({ id: f.id, name: f.en, sprite: f.sprite, needs: f.makeup!.map((m) => ({ type: m.type, count: m.count })), make: { type: f.id }, count: f.yields })),
    ...LIFE_RECIPES,
    ...ARCANE_RECIPES,
    ...SET_RECIPES,
  ]
  return made
    .filter((r) => r.make.type.startsWith('item/') && r.needs.every((n) => n.type.startsWith('item/')))
    .map((r) => ({ id: r.id, of: madeOfMain(r), takes: r.needs.map((n): [string, number] => [n.type, n.count]), gives: [[r.make.type, r.count ?? 1]] }))
}

/**
 * What a recipe makes its thing of (the engine's craft): its main ingredient's material — unless it makes the thing
 * as it names it (a name, tags or props of its own: a skill book) and not also of what it took (`madeOf`).
 */
export function madeOfMain(r: Recipe): string | undefined {
  if ((r.make.name || r.make.tags || r.make.props) && !r.madeOf) return ownMaterial(r.make.type)
  return ownMaterial(r.needs[0].type) ?? ownMaterial(r.make.type)
}

/** A thing's own material (a plank is wood), whose factor is in its price. */
const ownMaterial = (type: string): string | undefined => {
  const m = FORM_BY_ID[type]?.props?.material
  return typeof m === 'string' ? m : undefined
}
const factor = (m: string | undefined): number => (m && MATERIALS[m]?.value) || 1
/** A kind's own `value`, where its form names one (a monster's piece, the Order's seal): before its material's factor. */
const ownValue = (type: string): number | undefined => {
  const v = FORM_BY_ID[type]?.props?.value
  return typeof v === 'number' && !FORM_BY_ID[type]?.base ? v : undefined
}
/** What the world gives for one that is not made, as it comes. */
const listed = (type: string): number => {
  const own = ownValue(type)
  return own !== undefined ? own * factor(ownMaterial(type)) : baseValue(type)
}

interface Prices {
  /** its `value` prop: the price of a common one before its material's factor */
  value: Map<string, number>
  /** what the world gave for one, as it comes */
  raw: Map<string, number>
  /** what makes it, by the way it is priced from */
  from: Map<string, string>
  /** what one is made of as it is priced: its own material, else what the way it is priced from makes it of */
  material: Map<string, string>
}

let PRICES: Prices | undefined

function derive(): Prices {
  const ways = [...recipeWays(), ...ruleWays()]
  const makes = new Map<string, Way[]>()
  for (const w of ways) makes.set(w.gives[0][0], [...(makes.get(w.gives[0][0]) ?? []), w])
  const raw = new Map<string, number>()
  const value = new Map<string, number>()
  const from = new Map<string, string>()
  const material = new Map<string, string>()
  const visiting = new Set<string>()
  // the raw content of one, as it comes; undefined while it is being priced (a way back to itself is no way)
  const rawOf = (type: string): number | undefined => {
    const known = raw.get(type)
    if (known !== undefined) return known
    if (visiting.has(type)) return undefined
    const own = makes.get(type)
    if (!own) {
      raw.set(type, listed(type))
      return raw.get(type)
    }
    visiting.add(type)
    // per its material's factor, the cheapest way: so no way of making it is worth more than it took
    let best: { per: number; way: Way; main: string | undefined } | undefined
    for (const w of own) {
      let took = 0
      let ok = true
      for (const [t, n] of w.takes) {
        const r = rawOf(t)
        if (r === undefined) ok = false
        else took += r * n
      }
      for (const [t, n] of w.gives.slice(1)) {
        const r = rawOf(t)
        if (r === undefined) ok = false
        else took -= r * n
      }
      if (!ok) continue
      // (what it is made of: its main ingredient's material, else its own — a recipe's, as the engine makes it)
      const main = 'of' in w ? w.of : ownMaterial(w.takes[0][0]) ?? ownMaterial(type)
      const per = Math.max(0, took) / w.gives[0][1] / factor(main)
      if (!best || per < best.per) best = { per, way: w, main }
    }
    visiting.delete(type)
    if (!best) {
      raw.set(type, listed(type))
      return raw.get(type)
    }
    const m = ownMaterial(type) ?? best.main
    if (m) material.set(type, m)
    raw.set(type, best.per * factor(m))
    value.set(type, round(best.per * LABOUR))
    from.set(type, best.way.id)
    return raw.get(type)
  }
  for (const f of FORMS) rawOf(f.id)
  for (const f of FORMS) if (!value.has(f.id) && !f.base) value.set(f.id, round(ownValue(f.id) ?? baseValue(f.id) / factor(ownMaterial(f.id))))
  // a region's own form is priced as its base is, of whatever it is made (a named piece three times: goods.ts)
  for (const f of FORMS) if (f.base && !from.has(f.id)) value.set(f.id, round(value.get(f.base)! * (f.named ? NAMED_VALUE : 1)))
  return { value, raw, from, material }
}

const round = (n: number): number => Math.round(n * 100) / 100

function prices(): Prices {
  return (PRICES ??= derive())
}

/** The `value` prop of a kind of item (the price of a common one, before its material's factor). */
export function valueOf(type: string): number {
  return prices().value.get(type) ?? listed(type) / factor(ownMaterial(type))
}

/**
 * The standard price of one as it comes — as a shelf hands it over, or the world makes one of its kind: of its own
 * material (none named, the factor is one), common, of the first level. One made of something is that times its factor.
 */
export function priceOf(type: string): number {
  return valueOf(type) * factor(ownMaterial(type))
}

/** What the world gave for one, made or not: the raw content a made thing is priced from. */
export function rawOf(type: string): number {
  return prices().raw.get(type) ?? listed(type)
}

/** The way a made kind is priced from (a recipe's id, or a rule's), if it is made. */
export function pricedFrom(type: string): string | undefined {
  return prices().from.get(type)
}
