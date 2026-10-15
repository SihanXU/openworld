# Survival loop: bag, foraging, crafting, levels, hunger, a meadow and a forest

## What is wanted

Add a survival layer on top of the Ford demo, in the manner of Stardew Valley, Don't Starve and Minecraft. The engine and content need these systems, and the demo needs two new maps:

1. **A bigger bag.** The player carries 30 slots in three rows of ten. The first row is the toolbar. The player can bring another row to the toolbar and can move stacks between the toolbar and the rest of the bag.
2. **Foraging.** A map can declare what its ground yields (sticks, stones, cut grass; cows and hens on the meadow). The engine tops each kind up over time, up to a per-kind cap.
3. **Crafting.** Recipes are content. A stone axe and a stone pickaxe can be made from foraged materials. They are the catalogue's own axe and pickaxe forms in stone, so the existing chop and mine rules answer them with no special-casing. Boulders crack in three blows rather than one.
4. **Levels.** A defeated actor gives whoever struck it experience equal to its max HP. Levels cost experience that grows with the level, and each level gives a skill point. The skill tree that spends the points is out of scope.
5. **Hunger.** A Minecraft-style food bar. Food only feeds. Being well fed slowly heals. Starving hurts, but never below 1 HP. Medicine and drinks still heal.
6. **An attack key.** One call makes a blow straight ahead with the held weapon (or a fist). Holding the key repeats the blow as the weapon's cooldown allows.
7. **Two new maps.** A meadow west of the Ford, reached through a gap in the western woods, holds cows and hens. Struck animals run away and never strike back. They come back slowly after they are gone. Cows and hens drop meat. Hens lay eggs. What creatures drop and eggs lie still and are taken with the take key rather than pulled in by the magnet. A forest south of the meadow, reached by a gap in its southern edge, has thick woods that an axe can fell.
8. **Client UI.** The client gets a crafting panel, a Minecraft-style HUD with hearts, hunger and an experience bar, tooltips that follow the cursor, and the Space, Tab and Shift+Tab keys.
9. **Look and art.** The player's look becomes the dog-masked ninja. Art the pack lacks is generated into the project's own assets folder.

Two defects found on the way must also be fixed:

- **The map builder's random generator was never reset.** Only the first map build in a process was the real map. Every later build drifted. Each map should have its own seed so builds are repeatable, and the Ford's terrain must stay as it was.
- **Creatures get stuck behind clumps of trees.** They only take greedy steps. A blocked creature should path around the obstacle and keep to that path. On the real Ford, the frost slime must reach the camp at night again.

## Expected behaviour

**Bag**
- A new player has 30 slots.
- If the player carries more kinds of item than the toolbar holds, the extras go to later rows. Nothing is dropped.
- Bringing the next row to the toolbar moves that row's contents into slots 0–9. Bringing the previous row back reverses it. The same stacks are kept, with the same identity.
- A quick move on a bag slot (index 10 or higher) puts the stack in the toolbar's first free slot. A quick move on a toolbar slot puts it in the bag's first free slot.

**Foraging and crafting**
- The Ford and the meadow have sticks, stones and grass lying about, and the player can take them with the take key.
- A stone axe takes 1 stick, 1 stone and 1 grass. A stone pickaxe takes 2 sticks, 2 stones and 1 grass.
- Crafting consumes the materials and gives the player the tool. Its name is "Stone Axe" / 石斧 or "Stone Pickaxe" / 石镐. Its type is the ordinary axe (`item/weapon/blade/axe`) or pickaxe (`item/tool/pickaxe`).
- When materials are short, crafting does nothing and reports failure. A check for whether a recipe is craftable is available.
- A stone axe fells a tree in two swings, leaving a stump. A stone pickaxe breaks a boulder in three blows.
- After the lying materials are removed, the ground yields them again over time, never past each kind's cap.

**Levels**
- Defeating an actor gives the striker experience equal to the victim's max HP.
- The first level costs 20 experience. After two slimes of max HP 11, the player is level 2 with 2 experience left and 1 skill point.

**Hunger**
- Max hunger is 20. It drops by 1 every `HUNGER_EVERY` ticks. Bread feeds 5, capped at the bar, and does not heal.
- A healing herb eaten from the bag also heals. In the test world, hp goes from 30 to 34.
- While well fed, hurt health returns slowly. The effect is applied every `HUNGER_EFFECT_EVERY` ticks.
- While starving, health falls on the same cadence, but never below 1 HP, and the player is not put in the "down" state by it.
- The meadow's raw beef, raw chicken and raw egg feed their own `food` amounts: hunger rises by exactly that number.

**Attack key**
- A strike made straight ahead with a sword hurts a slime two tiles away on the next tick.
- A second strike immediately afterwards does nothing more, because the weapon is on cooldown. Repeating the strike every tick over a span of ticks lands more blows as the cooldown allows.

**Meadow**
- Walking left through the gap in the Ford's western woods (the `WEST_GAP` position) takes the player to the map `meadow`. It has cows (`actor/creature/animal/cow`) and hens (`actor/creature/animal/chicken`).
- A struck cow runs from the player. Within 60 ticks it is more than 2 tiles away, and the player takes no damage.
- A killed cow leaves 2 `item/food/meat/raw`. A killed hen leaves 1 `item/food/chicken/raw`. They lie where they fell and are not magnetised. The take key picks them up one at a time.
- A hen with the `laying` status lays one `item/food/egg/raw` where she stands and starts the next laying timer.
- After all animals are removed, they come back slowly: no more than 1 cow and 2 hens after 1,200 ticks. After a few thousand ticks, each kind is back, below its cap. All hens on the meadow are in the laying status.

**Forest**
- Walking down through the gap in the meadow's southern edge (the `SOUTH_GAP` position) takes the player to the map `forest`.
- More than 100 trees (trees or pines) stand beside tiles the player can reach on foot from the entry.
- The old axe fells one of them in two swings: a stump, plus 2 logs.

**Fixes**
- Building the Ford twice in one process gives the same map.
- A blocked creature finds a way around tree clumps. The F-requirement for the frost slime reaching the camp at night passes on the real Ford.

## Requirements

- The player has `SLOT_COUNT` = 30 slots, in rows of 10.
- Foraging is data on the map: a list of entries with a type, a max count, and a rate. The engine tops each kind up on its schedule and never beyond the max.
- Recipes are content, looked up by id. The stone axe and stone pickaxe have ids `stone-axe` and `stone-pickaxe`. Crafting uses the catalogue's own forms, with a name override and the stone material.
- The `gainXp` and `feed` primitives exist and are usable by rules.
- Food feeds hunger only. Only medicine and drinks heal.
- Creature drops and laid eggs are placed with a "lies still" option, so the magnet and auto-pickup ignore them, and they are taken with the take key.
- The meadow and forest are real maps in the demo world. The tests move the player to them through the gap positions.
- The map builder gets a seed per map, with no shared module state.
- Detour pathfinding for creatures keeps the chosen path across ticks until it is no longer useful.
- Animals meeting plants or fixtures are answered by a base rule (grazing), so a stream of `meet` requests does not go to the modder.
- All new foods are edible, and the existing raw meat becomes Raw Beef and cooked meat becomes Steak.
- The player's look defaults to the dog-masked ninja, `NinjaMasked`.
- The client protocol and UI gain the attack, row, quick-move and craft messages, the craft tab, the HUD, the tooltip and the Space/Tab/C keys.
- Typecheck passes, and the existing tests keep passing, with the Ford map's slot-count expectation updated to 30.

## Interface

Exported from `@lsw/engine`:

- `SLOT_COUNT` — now 30.
- `FORAGE_EVERY: number` — the base tick interval of the foraging top-up (in `engine/src/forage.ts`).
- `HUNGER_EVERY: number` — ticks per 1 point of hunger lost (in `engine/src/hunger.ts`).
- `HUNGER_EFFECT_EVERY: number` — ticks between the heal or hurt steps of well-fed and starving (in `engine/src/hunger.ts`).
- `xpToNext(level: number): number` — experience needed to go from `level` to the next. `xpToNext(1)` is 20.
- The `gainXp` primitive and the `feed` primitive, usable in rules.
- A `spawn` / `dropContents` option `still` (lies still, no magnet).
- `MapData.forage?: { type: string; max: number; … }[]` — what a map's ground yields. Each entry has a `type` and a `max`, plus whatever rate field the engine needs.
- A frame/`ItemInfo` addition: `props` on `ItemInfo`; `maxHunger` and `hunger` on the frame's player.
- A `levelup` fx event with a `level` field.

Controls (on `engine.controls`):

- `strike(): void` — the attack key's single blow straight ahead with the held weapon or a fist.
- `nextRow(dir?: 1 | -1): void` — brings the next (or, with `-1`, the previous) row of the bag to the toolbar. `dir` defaults to `1`.
- `quickMove(slot: number): void` — Shift+click: moves the stack in `slot` between the toolbar and the rest of the bag.
- `craft(recipe: Recipe): boolean` — makes the recipe from what is carried. Returns `true` if made, `false` if materials are short.
- `canCraft(recipe: Recipe): boolean`
- `count(type: string): number` — how many items of that type the player carries.
- `sync()` and `key(entity)` as they are used on the controls (a bag-sync and the slot key of an entity), if not already present.

Exported from `@lsw/content`:

- `RECIPES: Recipe[]`
- `RECIPE_BY_ID: Record<string, Recipe>`
- `FORM_BY_ID: Record<string, Form>` — catalogue forms by type id, exposing `props` (including `food`), `en`, `zh`, `sprite` and `tags`.
- `Recipe` type: `{ id: string; name: Text; needs: { type: string; count: number }[]; make: { type: string; tags?: string[]; props?: … } }`, in `content/src/recipes.ts`.
- Content for these types: `item/material/grass`, `item/food/chicken/raw`, `item/food/chicken/roast`, `item/food/egg/raw`, the `laying` status, `actor/creature/animal/cow` and `actor/creature/animal/chicken`.

Exported from `packages/tools/src/demo/world.ts`:

- `WEST_GAP: [number, number]` — the Ford's western gap, `[x, y]`, where the road leaves toward the meadow.
- `SOUTH_GAP: [number, number]` — the meadow's southern gap, `[x, y]`; its first element is the x to stand on at the meadow's bottom edge.
- `buildFord()` also builds the maps `meadow` and `forest`, whose ids are those strings.

Client-only additions (not tested): the `attack`, `quickMove` and `craft` messages and `row` with `dir`; `Tooltip` in `client/src/ui/tooltip.ts`; the craft tab in the menu; assets under `public/assets/lsw/` generated by `tools/src/art/`.
