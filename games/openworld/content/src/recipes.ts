// What can be made (world-model.md §6.4): derived from the types, never listed — every type with
// a station and a makeup (the first tools from sticks, stones and grass, at hand; a shield, a club,
// a bow at a workbench). The crafting panel shows them; the engine derives the same from its own
// types (a patch's new type included).

import { OntologyIndex, deriveRecipes, type Recipe } from '@openworld/engine'
import { buildOntology } from './ontology.ts'
import { SHOP_RECIPES } from './homestead.ts'
import { LIFE_RECIPES, LIFE_SELLS } from './life.ts'
import { VILLAGE_SHOP_RECIPES } from './village.ts'

/** What is made, and (the homestead's stall) what is bought and sold there. */
export const RECIPES: Recipe[] = [...deriveRecipes(new OntologyIndex(buildOntology())), ...LIFE_RECIPES, ...SHOP_RECIPES, ...LIFE_SELLS, ...VILLAGE_SHOP_RECIPES]

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]))
