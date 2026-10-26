# The Held Ground grows three ways through its steward's panel; four profession gear sets; cloth woven at a loom; item worths reset

## What is wanted

The Held Ground (the player's carried camp, kept by the steward Alberic) should be grown through a single panel in Alberic's talk instead of through his widening errands. Alongside this, the game gains four profession gear sets with set bonuses, a loom recipe for cloth, new gear forms, and a reset of item worths so that merchants' prices follow from them.

### 1. The Held Ground's panel

Alberic's talk gets a verb "The Held Ground…" that opens a `haven` panel. The panel offers three tracks of growth:

- **Land**: the rings of mist, lifted one after another (`haven.size` 1, 2, 3).
- **Grounds**: new places of their own, each requiring a certain amount of land first: a quarry, a timberland, a lakeside and hot springs. Once opened, a ground is gone to from the panel, and a way at its edge leads back to the heart.
- **Buildings**: a plot staked out at the heart that, once built, becomes a workshop (workbench), a kitchen hearth (lit campfire), a storehouse (container of forty places), a weaving shed (loom) and an apothecary (cauldron).

What an upgrade asks for is handed to Alberic and goes into the ground's stock, which he keeps and copies to the story for the panel. Building takes the materials from that stock. Anything that no upgrade asks for, when handed to him, is a gift as to anyone. A handed thing that goes into the stock is used up.

The heart of the Held Ground is a planted sword (a longsword point down in the earth), not an altar. The ground keeps no beasts of its own; they are bought at the stall.

### 2. Old saves

The old widening errands (`haven1`–`haven3`) are removed. Saves made before this change must be migrated: the errands, their story records and any tracking of them are cleared, while `haven.size` and what was already carried are kept. An altar at `haven.heart` becomes the planted sword. New games are marked as already migrated.

### 3. Item worths and trade

Every item's worth is reset against a day's earnings (a day's work is a few dozen Thornmarks). A merchant sells at the worth plus a quarter and buys at half. The Held Ground's stall and the general store price from the same worths, so a torch (worth 3) costs 4 and a herb (worth 6) sells for 3. Every person sells what fits who they are.

### 4. Gear sets

There are four profession sets of twelve pieces each, covering the whole body, forged at an anvil. Set bonuses apply at 3, 6, 9 and 12 pieces worn. New forms are needed: jerkin, robe, parrying dagger, quiver and tome. Cloth is woven from grass at a loom.

### 5. Bag

Empty equipment slots in the bag show embossed silhouettes.

## Expected behaviour

- Talking to Alberic after the knight has fallen lists a `haven` verb. Choosing it opens the `haven` panel.
- Offering Alberic 4 of 12 logs puts 4 into `haven.stock.item/material/log`, and the player's logs drop to 8. Building `land1` (10 logs, 10 stones) with too little in stock changes nothing: `haven.size` stays 0.
- With enough handed over, building `land1` sets `haven.size` to 1, pays the upgrade's coins in Thornmarks, deducts the cost from the stock (leaving 2 logs and 2 stones in the example of handing over 12 of each), and the first ring of mist lifts.
- The land rings must be built in order: ring *n* needs `haven.size` to be *n−1*.
- A ground needs its land first. The quarry, with its stock handed over but `haven.size` 0, is not opened (`haven.zone.quarry` stays 0). Once `haven.size` is 1, building `quarry` sets `haven.zone.quarry` to 1.
- Choosing `go:quarry` once opened moves the player to the map `haven.quarry`, whose portals all lead to `haven`. The maps `haven.timber`, `haven.lake` and `haven.springs` also exist. A `go:` choice for a ground not yet opened does nothing but say it is still under the mist.
- Building `workshop` sets `haven.build.workshop` to 1. The staked plot entity `haven.plot.workshop` starts as type `fixture/build/plot/workshop` and, some time after the build, becomes `fixture/craft/workbench`. The same holds for the other buildings (the kitchen hearth also becomes lit, the storehouse open).
- The heart `haven.heart` is of type `fixture/sacred/sword`.
- The Held Ground's grounds are not on the overworld and need no site cell there.
- Each of the four sets (ids in order `shadowfang`, `oathguard`, `windrunner`, `starweave`) has twelve pieces, one for each of the slots `arm, body, ear, feet, hands, head, neck, ring, shoulders, waist, weapon` (with two rings making twelve). Each piece is forged by a recipe `set/<set id>/<slot>` at an anvil; the result is of its main ingredient's metal (or leather and cloth for the softer sets) and the smith's quality, and named for its set (e.g. "Shadowfang Jerkin", leather, dodge 0.03).
- Wearing set pieces gives their own stats plus the set's bonus at 3, 6, 9 and 12 pieces. For Shadowfang, three pieces add +0.05 dodge on top of the pieces' own, and six give stealth 4 (stealth is 0 below the threshold).
- The recipe `weave/cloth` at a loom turns 4 grass into 1 cloth. The village loom is entity `village.loom`.

## Requirements

- Alberic's talk offers "The Held Ground…" (verb `haven`) once the knight has fallen; with a `choice` parameter of `build:<id>` or `go:<id>` it builds or travels, without one it opens the panel.
- Handing a thing to the steward that an upgrade asks for adds one to its stock, copies the count to the story for the panel, and consumes the thing. Anything else is treated as an ordinary gift.
- Building requires: the land reached (`haven.size` at least the upgrade's `land`), the upgrade not already built, for land rings the previous ring built, and the full stock. On success the stock is reduced, the fact is set, coins (if any) are spawned for the player, and Alberic speaks his line. Otherwise a log line says it is not yet.
- A building's plot becomes what it was staked out for after it is built, checked periodically, with a sparkle effect, and with its status (lit/open) where one applies.
- The widening errands are removed from the quest list.
- Migration: loading a save without the new layout fact removes the errands as described and sets it. Loading a save whose heart is an altar transforms it into the planted sword. `HAVEN_LAYOUT` is set on fresh games.
- The loaded-maps check that every map lies on the overworld must exclude the grounds (map ids starting with `haven.`).
- The quarry holds the only gold vein besides the old mine's.
- All forms listed (jerkin, robe, parrying dagger, quiver, tome) exist with their slot and profession tags; the quiver and tome and parrying dagger occupy the `arm` (off hand) slot for those professions that previously had none.
- Cloth and leather hides carry their material so gear made from them reports its material correctly.
- The loom is a station that crafts `weave/cloth`.
- The world's `stat` takes set bonuses into account; `Ontology.sets` lists each set with its id and number of pieces.
- Worth values are reset as described, and both the Held Ground's stall and the general store price from them. Existing prices expressed as fixed numbers in tests derive from the recipe's data rather than hard-coded values.
- The bag draws embossed silhouettes in empty equipment slots.
- The Held Ground no longer spawns its own beasts; tests that need a cow place one.

## Interface

- `HAVEN_UPGRADES: HavenUpgrade[]` — exported from the content package (`haven.ts`). Each entry has `id: string`, `track: 'land' | 'zone' | 'building'`, `name`, `unlocks: Text[]`, `needs: { type: string; count: number; text: Text }[]`, `land: number`, `fact: string`, `value: number`, `coins: number`, `done: { en: string; zh: string }`, and optionally `map`, `at`, `plot`, `becomes`, `status`. The ids include `land1`, `land2`, `land3`, `quarry`, `timber`, `lake`, `springs`, `workshop`, `kitchen`, `storehouse`, `loom`, `apothecary`.
- `HavenUpgrade` — the type of the above.
- `HAVEN_LAYOUT: string` — `'content.haven-heart-v1'`, from `migrateHaven.ts`, exported from the content package.
- `migrateHaven(game: Game): void` and `migrateHavenHeart(game: Game): void` — in `migrateHaven.ts`, exported from the content package.
- `SET_DEFS` — exported from the content package (`sets.ts`): an array of the four sets, each with `id: string` and `pieces: { slot: string, ... }[]`.
- `GEAR_SETS` — in `sets.ts`, exported from the content package, supplied as `Ontology.sets`.
- `Ontology.sets` / `World.stat` — the ontology data gains `sets` (each with `id` and `pieces: number`), and `World.stat` includes set bonuses.
- Recipes: `set/<setId>/<slot>` for each set piece and `weave/cloth`, available through `RECIPE_BY_ID`.
- Entity types: `fixture/sacred/sword`, `fixture/container/storehouse`, `fixture/build/plot`, `fixture/build/plot/<id>` for `workshop`, `kitchen`, `storehouse`, `loom`, `apothecary`.
- Item forms: `item/armor/jerkin`, `item/clothing/robe`, `item/armor/parrying_dagger`, `item/armor/quiver`, `item/armor/tome`.
- Facts and story keys: `haven.stock.<item type>`, `haven.zone.<id>`, `haven.build.<id>`.
- Map ids: `haven.quarry`, `haven.timber`, `haven.lake`, `haven.springs`.
- Entity ids: `haven.plot.<id>` for the five buildings.
- Panel id `haven`, opened from the `haven` talk verb. Talk choices `build:<id>` and `go:<id>`.
- Client: a `homestead` entry on `ClientGame` describing the title, steward (`npc.alberic`), size fact, stock prefix and upgrades.
- Tick period `plot` (every 30 ticks) on `fixture/build/plot` hosts.
