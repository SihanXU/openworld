# Derive recipes from what things are made of (makeup + station), instead of listing them

## What is wrong (for a fix) / What is wanted (for a feature)

Crafting recipes are currently a hand-written list in content (`RECIPES` in `recipes.ts`): each entry spells out its own ingredients and a prebuilt product. This duplicates the one relation the world already has, a type's `makeup` (what it is made of), and cannot grow: a type added by a patch is never craftable, and nothing says where a recipe is made.

Make the recipe follow from the types. A type that has both a **station** (where it is made) and a **makeup** is craftable, and the recipe list is derived from the types. No recipe is listed by hand.

Things made this way should also be made *of* something. The product takes the material of its main ingredient, a quality set by the maker's level against the recipe's level, a power from its form, material and quality, and a name built from these.

Several things also need to change in the content so that this works end to end:
- The first tools (axe, pickaxe, hoe, sickle, smith hammer, bucket) keep their current ingredients but are now derived.
- New craftables: shield, club (at a workbench), bow (at a workbench, harder level).
- A workbench must exist in Firstlight Village, by the wood pile.
- Chests, campfires, signs and fences get durability and a makeup, so they can be built and broken back like the other buildings.
- A locked chest is not taken apart by blows; blows only wear it down.
- The crafting panel shows where a recipe is made.

## Expected behaviour

**Derivation**
- Every type with a station and a non-empty makeup yields exactly one recipe, whose id is the type id. Types lacking either yield none.
- The recipe's `needs` are the makeup parts (type, count) in order, with the first as the main ingredient. Its `make` is the type to create. It carries the station and its level (the type's craft level, default 1).
- The engine derives recipes from whatever types it holds when constructed, including a type introduced by a patch. Content's `RECIPES` and `RECIPE_BY_ID` are derived the same way from the content ontology, keyed by type id (e.g. `item/weapon/blade/axe`, `item/tool/pickaxe`, `item/armor/shield`) rather than the old ids like `stone-axe`.

**Stations**
- Station `hands` can be used anywhere.
- Any other station is satisfied when a thing within reach (the crafter's cell and the eight around it, including things covering those cells) has the tag `station:<x>`. The workbench carries `station:workbench`.
- Crafting at a station not in reach makes nothing, uses nothing up, and tells the player (log message) that it is made at that station.
- Needs not met: nothing is made, as before.

**What is made**
- Material: the product takes the material of the first ingredient consumed (basic materials such as log, plank, stick, stone, grass carry one: wood, wood, wood, stone, plant). The product has `material:<id>` and that material's tags.
- Quality: derived from `maker level − recipe level`. Qualities are defined in the ontology: crude (always reachable as the floor), common (0), fine (from 3), masterwork (from 6); the highest threshold met wins. Common adds no tag and no name part. Others add `quality:<id>`. Legendary is never reached by making.
- Power: if the form has a numeric power, the product's power is form + material power + quality power, at least 1.
- Name: quality name, material name, form name, in that order (English separated by spaces, Chinese joined without). Example: a shield from planks made at level 1 is `Wooden Shield` / `木盾牌`; made at level 4 it is `Fine Wooden Shield` / `精良木盾牌` and has tag `quality:fine`.
- Materials and qualities now carry display data (names, tags, power) so this can be computed.

**Content**
- Recipes: axe (stone 1, stick 1, grass 1, hands), pickaxe (stone 2, stick 2, grass 1, hands), hoe (stone 2, stick 2, grass 1, hands), sickle (stone 2, stick 1, grass 1, hands), smith hammer (stone 2, stick 1, hands), bucket (plank 3, grass 1, hands), shield (plank 3, stick 1, workbench), club (log 1, workbench), bow (stick 2, grass 3, workbench, craft level 2).
- Buildings with durability and makeup: chest (4 planks, wood, 8 hp), campfire (2 stone, 2 sticks, stone material, 6 hp), sign (1 stick, 1 plank, wood, 4 hp), fence (2 sticks, wood, 4 hp).
- A workbench stands at (11, 18) in Firstlight Village, so a player at (11, 19) is beside it.
- A locked chest hit with an axe: the dismantle rule does not apply; the ordinary strike rule does, with no unanswered holes, and the chest's hp drops below its max.
- Crafting panel: a recipe whose station is not hands shows where it is made (e.g. "at a workbench" / 需在工作台旁).

**Economy**
- No recipe, break, or item-conversion rule, alone or in two consecutive steps, makes more of a thing than it consumed.
- For every building, building it and breaking it back returns no more of any consumed ingredient than went in, and nothing that never went in.
- Without the AI, every recipe ingredient and building requirement is obtainable from the world as it starts (including a workbench being present for workbench recipes).

## Requirements

- Recipes are derived from types with station + makeup; there is no hand-maintained recipe list.
- The engine registers derived recipes on construction, including those from types it holds beyond the content (patch types).
- Crafting enforces station reach for non-hand stations, with no side effects on failure besides the message.
- Crafted products inherit the main ingredient's material, a level-based quality, computed power, and the composed name; when a recipe's `make` already carries its own tags or name, those are used as given.
- The quality is based on the crafter's `level` prop (default 1) and the recipe level (default 1).
- Material and quality definitions expose name, tags, power, and quality thresholds through the ontology.
- Content data above is in place (recipes, durable buildings, workbench in the village, `station:workbench` tag).
- A locked chest is worn, not dismantled.
- The crafting panel indicates non-hand stations.
- Existing behaviour that relied on old recipe ids (axe/pickaxe for the first tools, felling trees, mining rock) continues to work with the new ids.
- The economy properties above hold for all content.

## Interface

In `packages/engine/src/recipes.ts` (re-exported from the engine package index):
- `deriveRecipes(onto: OntologyIndex): Recipe[]`: all recipes the types give.
- `qualityFor(onto: Ontology, makerLevel: number, recipeLevel: number): string | undefined`: the quality id reached.
- `madeOf(data: Ontology, onto: OntologyIndex, type: string, material?: string, quality?: string): Omit<Entity, 'id' | 'place'>`: a made thing's look as data: type, tags (`material:<id>` and material tags, quality tag), name, and power prop.

In `packages/engine/src/types.ts`:
- `TypeDef.station?: string`
- `TypeDef.craftLevel?: number`
- `MaterialDef.name?: Text`, `MaterialDef.tags?: string[]`, `MaterialDef.power?: number`
- `QualityDef { id: string; tag?: string; name?: Text; power: number; from?: number }`
- `Ontology.qualities?: QualityDef[]`
- `Recipe.station?: string`, `Recipe.level?: number`

In `packages/content/src/items.ts`:
- `QUALITY_DEFS(): QualityDef[]`: qualities as the ontology reads them.
- `Form` gains optional `makeup`, `station`, `craftLevel`.

The content ontology (`buildOntology()`) now includes `qualities`.
