// The crafting panel's recipes (Don't Starve's first tools): what each uses up from what the
// player carries, and the item it makes. The tools are the catalogue's own forms in stone, so
// the rules that answer an axe or a pickaxe answer them too.

import { Rng, type Recipe, type Text } from '@lsw/engine'
import { FORM_BY_ID, makeItem } from './items.ts'

const STICK = 'item/material/stick'
const STONE = 'item/material/stone'
const GRASS = 'item/material/grass'

/** A tool of the catalogue made of `material`, common and without an element. */
function tool(id: string, form: string, material: string, needs: Recipe['needs']): Recipe {
  const f = FORM_BY_ID[form]
  const make = makeItem(new Rng(0), f, { material, quality: 'common', element: null })
  return { id, name: make.name as Text, sprite: f.sprite, needs, make }
}

export const RECIPES: Recipe[] = [
  tool('stone-hoe', 'item/tool/hoe', 'stone', [{ type: STICK, count: 2 }, { type: STONE, count: 2 }, { type: GRASS, count: 1 }]),
  tool('stone-sickle', 'item/tool/sickle', 'stone', [{ type: STICK, count: 1 }, { type: STONE, count: 2 }, { type: GRASS, count: 1 }]),
  tool('stone-hammer', 'item/tool/smith_hammer', 'stone', [{ type: STICK, count: 1 }, { type: STONE, count: 2 }]),
  tool('wooden-bucket', 'item/vessel/bucket/empty', 'wood', [{ type: 'item/material/plank', count: 3 }, { type: GRASS, count: 1 }]),
  tool('stone-axe', 'item/weapon/blade/axe', 'stone', [
    { type: STICK, count: 1 },
    { type: STONE, count: 1 },
    { type: GRASS, count: 1 },
  ]),
  tool('stone-pickaxe', 'item/tool/pickaxe', 'stone', [
    { type: STICK, count: 2 },
    { type: STONE, count: 2 },
    { type: GRASS, count: 1 },
  ]),
]

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]))
