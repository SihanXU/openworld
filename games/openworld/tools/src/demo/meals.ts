// Meals (design.md §5.18, docs/npc-sandbox.md §2.11): a household's larder at home, kept in food as its people's work
// brings it in (the larder's `stock`, store/morning), and a meal at either end of everyone's day — a slot that tends
// `hungry` (ScheduleEntry.tends) at the larder's side for one who sleeps at a home that keeps one, else wherever that
// hour finds one: whoever is short of a full belly eats from what is at hand, and a meal passed while nobody watched was had
// (PeriodDef.tendedBy) — a life goes on unseen as its day says. One with nothing at hand when watched stays hungry, and
// buys, or takes (the society's need).

import type { Entity, Pos, ScheduleEntry } from '@openworld/engine'
import type { MapBuilder } from './builder.ts'

/** What keeps a household's food, in the order one is chosen among a home's containers. */
const LARDERS = ['fixture/container/barrel', 'fixture/container/sack', 'fixture/container/cupboard', 'fixture/container/crate', 'fixture/container/chest']

/** A day's provisions for each who eats there: two meals of bread, and an apple. */
const PER_MOUTH: [string, number][] = [['item/food/bread', 2], ['item/food/apple', 1]]

/** What a larder keeps of what it holds: the food. */
export const isFood = (type: string) => type.startsWith('item/food/')

/** What a meal tends. */
export const MEAL: Pick<ScheduleEntry, 'activity' | 'tends'> = { activity: 'eat', tends: ['hungry'] }

/** The store a home keeps its food in, as its stock says (`type*count|…`), from what it holds now. */
export function stockOf(b: { entities: Entity[] }, box: Entity, edible: (type: string) => boolean): string {
  const n = new Map<string, number>()
  for (const e of b.entities) if (e.place.on === 'inside' && e.place.holder === box.id && edible(e.type)) n.set(e.type, (n.get(e.type) ?? 0) + 1)
  return [...n].map(([t, c]) => `${t}*${c}`).join('|')
}

/** Make a container a larder: its tag, and the provisions it is kept in each morning. */
export function larder(box: Entity, stock: string): void {
  if (!stock) return
  box.tags = [...new Set([...(box.tags ?? []), 'larder'])]
  box.props = { ...box.props, stock }
}

/**
 * Provision a household's home: its larder (one of the containers there, filled for `mouths` and kept so), and where a
 * meal is eaten — a free cell beside the larder. Undefined for a home with nothing to keep food in.
 */
export function provision(b: MapBuilder, mouths: number): Pos | undefined {
  const boxes = b.entities.filter((e) => e.place.on === 'tile' && LARDERS.includes(e.type))
  boxes.sort((a, c) => LARDERS.indexOf(a.type) - LARDERS.indexOf(c.type))
  for (const box of boxes) {
    if (box.place.on !== 'tile') continue
    const { x, y } = box.place
    const cell = ([[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]] as const).map(([dx, dy]) => [x + dx, y + dy] as const).find(([cx, cy]) => b.free(cx, cy) && b.walkable(cx, cy) && b.get(cx, cy) !== 'door')
    if (!cell) continue
    const stock = PER_MOUTH.map(([type, n]) => `${type}*${n * mouths}`).join('|')
    for (const [type, n] of PER_MOUTH) for (let i = 0; i < n * mouths; i++) b.entities.push(b.makeItem({ form: type }, { on: 'inside', holder: box.id }))
    larder(box, stock)
    return { map: b.id, x: cell[0], y: cell[1] }
  }
  return undefined
}

const span = (s: ScheduleEntry) => (s.to - s.from + 24) % 24 || 24

/**
 * A day with its meals: on waking and before bed, an hour that tends hungry (the hour taken from what comes after
 * sleep and what comes before it, where that is longer than an hour). One who sleeps at a home with a larder (`larder`)
 * eats at its side; anyone else where that hour finds them, about what they were doing (Hesper at her fire), from
 * what they carry or have about. A day with no sleep in it (one kept offstage) has none.
 */
export function withMeals(day: ScheduleEntry[], larder?: Pos): ScheduleEntry[] {
  const out = day.map((s) => ({ ...s }))
  const sleep = out.find((s) => s.activity === 'sleep')
  if (!sleep) return out
  const home = larder && larder.map === sleep.map ? larder : undefined
  const meal = (from: number, of: ScheduleEntry): ScheduleEntry =>
    home ? { from: from % 24, to: (from + 1) % 24, map: home.map, x: home.x, y: home.y, ...MEAL } : { ...of, from: from % 24, to: (from + 1) % 24, tends: MEAL.tends }
  const after = out.find((s) => s !== sleep && s.from === sleep.to)
  if (after && span(after) > 1) {
    out.splice(out.indexOf(after), 0, meal(sleep.to, after))
    after.from = (after.from + 1) % 24
  }
  const before = out.find((s) => s !== sleep && s.to === sleep.from && !s.tends)
  if (before && span(before) > 1) {
    before.to = (before.to + 23) % 24
    out.splice(out.indexOf(before) + 1, 0, meal(sleep.from + 23, before))
  }
  return out
}
