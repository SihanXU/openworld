# Planks from the crafting panel: a log splits in two with an axe carried; "all" splits every log

## What is wanted

Splitting a log into planks currently means putting the log down, using the axe on it, then picking the planks up and putting them down again. Following Elin (processing in the crafting panel, with a tool required) and Minecraft (logs to planks in the grid), planks should be craftable from the crafting panel:

- A recipe can require tools that are carried but not used up (tagged e.g. `tool:axe`).
- A recipe can make more than one item per making. A plank is one log plus an axe, giving two planks.
- What an item made in multiples breaks back into is its share of the makeup (a plank breaks back into half a log, not a whole one).
- A "make all" action crafts a recipe repeatedly for as long as what it needs is carried.
- The crafting panel shows the tool a recipe needs (✓ carried / ✗ missing), shows "×2" on the Craft button for multi-yield recipes, offers an "All ×n" button, and treats Shift-click on Craft as "all".
- A material that is a thing's own (a plank is wood) does not name the item again. A crafted plank is simply "Plank", the same kind as the planks that come from splitting.
- Using an axe on a log lying on the ground yields two planks that pop out on the ground (for the magnet to pick up), and the log is gone.

## Expected behaviour

- Plank recipe: needs 1 log, needs the `tool:axe` tag carried, made at `hands`, makes 2 planks.
- Carrying 3 logs and no axe: the plank recipe cannot be crafted, and attempting it makes nothing.
- Carrying 3 logs and an axe: crafting once leaves 2 logs, 2 planks, and still 1 axe.
- A crafted plank has no special name (not "Wooden Plank"); it is the same kind as any other plank.
- Crafting all with the remaining 2 logs makes it twice (returns 2), leaving 0 logs and 6 planks in total, with the axe kept.
- Using the axe on a log on the ground: the log is gone and exactly two planks are on that tile, both flagged as dropped (so the magnet collects them).
- Breaking a plank down returns half a log's worth of the makeup, not a whole log's worth.
- In the crafting panel, a recipe with tools shows each tool with ✓ or ✗. A multi-yield recipe's Craft button shows "×n". When more than one making is possible, an "All ×n" button appears. Shift-clicking Craft does the same as "All".
- If the tool is missing when a craft is requested, nothing is made and the player is told they need the right tool.

## Requirements

- Recipes support a list of required tool tags that must be carried (not frozen), are not consumed, and gate whether the recipe can be crafted.
- Recipes support a yield count (default 1); crafting gives that many items to the maker.
- Types derived into recipes from item definitions carry their tools and yield count through to the recipe (yield only when greater than 1).
- A type's resolved definition exposes its yield count, and breaking down such a type scales the makeup by 1/yield.
- A "craft all" control repeats crafting while it can succeed, returns how many times it succeeded, and accepts an optional upper limit (default 99).
- The craft message from the client to the engine worker accepts an optional "all" flag, and the worker uses craft-all when it is set.
- A made item whose material equals the type's own material does not get a material name or tag applied.
- The log-splitting rule for an axe on a ground log produces two planks as dropped items and removes the log.
- The plank item type defines its makeup (one log), station `hands`, tool `tool:axe`, and yield 2.
- The UI strings (English and Chinese) for the "All" button, its tooltip, and the tool-kept tooltip exist.

## Interface

- `TypeDef.tools?: string[]` and `TypeDef.yields?: number` in `packages/engine/src/types.ts`.
- `Recipe.tools?: string[]` and `Recipe.count?: number` in `packages/engine/src/types.ts`.
- `ResolvedType.yields?: number` in `packages/engine/src/ontology.ts`, reachable via `OntologyIndex.resolve(type).yields`.
- `Form.tools?: string[]` and `Form.yields?: number` in `packages/content/src/items.ts`.
- `Controls.craftAll(r: Recipe, most?: number): number` in `packages/engine/src/controls.ts`; returns the number of times crafted.
- `Controls.canCraft(r: Recipe): boolean` also takes required tools into account.
- `ToWorker` craft message: `{ t: 'craft'; id: string; all?: boolean }` in `packages/client/src/protocol.ts`.
- `MenuSend.craft(id: string, all?: boolean): void` in `packages/client/src/ui/menu.ts`.
- The plank recipe is available as `RECIPE_BY_ID['item/material/plank']`, exported from the content package.
