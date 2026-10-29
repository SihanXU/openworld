// What can be made (world-model.md §6.4): derived from the types, never listed — every type with
// a station and a makeup (the first tools from sticks, stones and grass, at hand; ore smelted at a
// forge, bars worked at an anvil, each opened by a hand on it). The crafting panel shows what is
// made anywhere; the engine derives the same from its own types (a patch's new type included). What
// a building of the Held Ground unlocks (haven.ts `recipes`: a shield, a club, a bow once the
// workshop stands; cloth and leather once the weaving shed does) is made anywhere from then on.

import { OntologyIndex, deriveRecipes, type Recipe } from '@openworld/engine'
import { buildOntology } from './ontology.ts'
import { HAVEN_UPGRADES } from './haven.ts'
import { SHOP_RECIPES } from './homestead.ts'
import { LIFE_RECIPES } from './life.ts'
import { ARCANE_RECIPES } from './arcane.ts'
import { VILLAGE_SHOP_RECIPES } from './village.ts'
import { SET_RECIPES } from './sets.ts'
import { DROP_SELLS } from './drops.ts'

/** The recipes the Held Ground's buildings unlock: by recipe id, the fact that stands for the building and its name. */
export const RECIPE_UNLOCKS: Record<string, NonNullable<Recipe['unlockedBy']>> = Object.fromEntries(
  HAVEN_UPGRADES.flatMap((u) => (u.recipes ?? []).map((id) => [id, { fact: u.fact, name: u.name, ...(u.value > 1 && { level: u.value }) }])),
)
const unlocked = (r: Recipe): Recipe => (RECIPE_UNLOCKS[r.id] ? { ...r, unlockedBy: RECIPE_UNLOCKS[r.id] } : r)

/** What is made, and (the homestead's stall) what is bought and sold there. */
export const RECIPES: Recipe[] = [...deriveRecipes(new OntologyIndex(buildOntology())), ...LIFE_RECIPES, ...ARCANE_RECIPES, ...SHOP_RECIPES, ...VILLAGE_SHOP_RECIPES, ...SET_RECIPES, ...DROP_SELLS].map(unlocked)

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]))
