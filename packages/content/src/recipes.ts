// What can be made (world-model.md §6.4): derived from the types, never listed — every type with
// a station and a makeup (the first tools from sticks, stones and grass, at hand; a shield, a club,
// a bow at a workbench). The crafting panel shows them; the engine derives the same from its own
// types (a patch's new type included).

import { OntologyIndex, deriveRecipes, type Recipe } from '@lsw/engine'
import { buildOntology } from './ontology.ts'

export const RECIPES: Recipe[] = deriveRecipes(new OntologyIndex(buildOntology()))

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]))
