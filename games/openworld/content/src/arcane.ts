// The arcane workbench's recipes (the Held Ground's arcane workshop, haven.ts `arcane` and `arcane2`; the fixture
// ontology.ts fixture/craft/arcane, opened by a hand on it): wands and staves of wood round a gem, staves that carry fire
// or frost once the workshop is raised again, draughts of herb and reagent, and the spell books a mage reads. Kept apart
// from life.ts, which skills.ts imports.

import type { Recipe, Text } from '@openworld/engine'
import { FORM_BY_ID } from './items.ts'
import { unlockedBy } from './haven.ts'
import { skillBook } from './skills.ts'

const L = (en: string, zh: string): Text => ({ en, zh })
const formName = (type: string): Text => {
  const f = FORM_BY_ID[type]
  return f ? L(f.en, f.zh) : L(type, type)
}
const sprite = (type: string) => FORM_BY_ID[type]?.sprite ?? 'item:bag'
const needs = (...n: [string, number][]) => n.map(([type, count]) => ({ type, count }))
const M = { stick: 'item/material/stick', honey: 'item/food/honey' }

/** A spell book is bound in leather round a gem and the spell's reagent. A staff is a mage's alone (its form's `profession:mage`); a wand anyone's. A book read (used on oneself) teaches its spell, its tree's `requires` holding. */
const STAFF = 'item/weapon/magic/staff'
const book = (skill: string, reagents: [string, number][], level: 1 | 2): Recipe => ({
  id: `arcane/book-${skill}`, name: skillBook(skill).name!, sprite: 'item:book', needs: needs(['item/material/leather', 1], ['item/gem', 1], ...reagents), make: skillBook(skill), station: 'arcane',
  unlockedBy: unlockedBy(level === 1 ? 'arcane' : 'arcane2'),
})
const elementalStaff = (element: 'fire' | 'ice', reagent: string, en: string, zh: string): Recipe => ({
  id: `arcane/staff-${element}`, name: L(en, zh), sprite: sprite(STAFF), needs: needs([M.stick, 2], ['item/gem', 1], [reagent, 2]),
  make: { type: STAFF, tags: [`element:${element}`], props: { element } }, madeOf: true, station: 'arcane', level: 3, unlockedBy: unlockedBy('arcane2'),
})
export const ARCANE_RECIPES: Recipe[] = [
  { id: 'arcane/wand', name: formName('item/weapon/magic/wand'), sprite: sprite('item/weapon/magic/wand'), needs: needs([M.stick, 1], ['item/gem', 1]), make: { type: 'item/weapon/magic/wand' }, station: 'arcane', level: 1, unlockedBy: unlockedBy('arcane') },
  { id: 'arcane/staff', name: formName(STAFF), sprite: sprite(STAFF), needs: needs([M.stick, 2], ['item/gem', 1]), make: { type: STAFF }, station: 'arcane', level: 2, unlockedBy: unlockedBy('arcane') },
  elementalStaff('fire', 'item/material/fireweed', 'Fire Staff', '火焰法杖'),
  elementalStaff('ice', 'item/material/frostcap', 'Frost Staff', '冰霜法杖'),
  { id: 'arcane/healing', name: formName('item/potion/healing'), sprite: sprite('item/potion/healing'), needs: needs(['item/material/herb', 2], [M.honey, 1]), make: { type: 'item/potion/healing' }, station: 'arcane', unlockedBy: unlockedBy('arcane') },
  { id: 'arcane/fireproof', name: formName('item/potion/fire_resist'), sprite: sprite('item/potion/fire_resist'), needs: needs(['item/material/frostcap', 2], ['item/material/herb', 1]), make: { type: 'item/potion/fire_resist' }, station: 'arcane', unlockedBy: unlockedBy('arcane') },
  book('fireball', [['item/material/fireweed', 1]], 1),
  book('frost-nova', [['item/material/frostcap', 1]], 1),
  book('chain-lightning', [['item/gem', 1]], 1),
  book('blink', [['item/material/ectoplasm', 1]], 1),
  book('frost-bolt', [['item/material/frostcap', 2]], 2),
  book('thunderstorm', [['item/gem', 1], ['item/material/feather', 2]], 2),
  book('meteor', [['item/material/fireweed', 3], ['item/gem', 1]], 2),
]

