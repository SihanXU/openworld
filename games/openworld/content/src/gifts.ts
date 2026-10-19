// Gifts (docs/npc-sandbox.md §2.15): the kind of thing each person likes best, drawn from a pool by their id — the same
// person, the same favourite, in every game — unless their record pins one (PersonDef.favourite). A child's is a
// child's thing. The talk's `chat` lets it slip once; the gift panel names it from then on, and the thing given
// delights them (rules.ts people/accept: the `favourite` condition, the `cheered` status).

/** What anyone might like best: things one can find, make or buy — a meal, a flower of the field, a trinket, a light. */
export const GIFT_POOL: string[] = [
  'item/food/bread',
  'item/food/apple',
  'item/food/cheese',
  'item/food/fish/cooked',
  'item/food/meat/cooked',
  'item/food/chicken/cooked',
  'item/food/mushroom/roasted',
  'item/food/berries',
  'item/food/egg/boiled',
  'item/food/pie',
  'item/food/honey',
  'item/food/wine',
  'item/food/ale',
  'item/food/fish/sunfish',
  'item/food/fish/perch',
  'item/food/fish/catfish',
  'item/food/fish/eel',
  'item/food/fish/pike',
  'item/material/herb',
  'item/material/fireweed',
  'item/material/frostcap',
  'item/material/feather',
  'item/material/wool',
  'item/material/cloth',
  'item/material/wax',
  'item/material/salt',
  'item/material/gold_ingot',
  'item/light/candle',
  'item/light/lantern',
  'item/vessel/flask/holy_water',
  'item/gem',
  'item/misc/bell',
  'item/misc/flute',
  'item/misc/lute',
  'item/misc/dice',
  'item/misc/doll',
]

/** What a child might like best (under fourteen, looks.ts bodyFor): sweet things and playthings. */
export const CHILD_GIFT_POOL: string[] = ['item/misc/doll', 'item/misc/dice', 'item/misc/flute', 'item/misc/bell', 'item/food/berries', 'item/food/pie', 'item/food/honey', 'item/food/apple', 'item/food/egg/boiled']

/** A small seeded random over a string's hash (as looks.ts draws a look): the same seed, the same pick. */
function hash(seed: string): number {
  let h = 2166136261 ^ seed.length
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  h ^= h >>> 15
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

/** The kind of thing a person likes best, from their id (and their age: a child's from the child's pool). */
export function favouriteFor(id: string, age: number): string {
  const pool = age < 14 ? CHILD_GIFT_POOL : GIFT_POOL
  return pool[hash(`${id}|favourite`) % pool.length]
}
