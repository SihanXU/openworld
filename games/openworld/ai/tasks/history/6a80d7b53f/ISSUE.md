# Older saves don't get the Held Ground's plots, Cass's loom, the Pilgrim's Road places, the merchants' new goods, or the forged sets' per-slot rules

## What is wrong

Saves made before recent content changes keep what they already hold, and loading only adds props an entity never had. Several changes never reached those saves:

1. **Held Ground plots and Cass's loom.** A save that visited the Held Ground or Firstlight before the building plots existed (workshop, kitchen, storehouse, loom, apothecary) lacks them, and lacks the loom. The steward takes the materials and sets `haven.build.<id>`, but nothing rises. The residents' tents' plots are missing too. The old `migrateLodges` covers only the tents' plots. Firstlight's waypoint statue (`wp.village`) also stands where the loom now stands.
2. **World map (Pilgrim's Road).** The Pilgrim's Road put four places between the Ford and the East Road and moved the east along. A save laid out one place to a tile (the previous layout) kept the East Road where the Rest now is and a wild place where the East Road now is. The Oath-Thorn's `pocket.return` ("map,x,y") may still be on the old 3 x 3 scale, so leaving the Held Ground sends the player off the map.
3. **Old smithy migration.** It removes `village.forge`, `village.anvil` and `village.smithy.sign` as "moved". No layout before the current one ever had those, so the removal is dead.
4. **Forged set pieces.** Pieces forged earlier carry their profession's single set whatever their slot. A profession's gear is now two sets, the armour and the trinkets (`<id>_trinkets`), and the weapon and off hand belong to neither. A helmet with jewels, a blade and a shield wrongly give the armour's six-piece bonus.
5. **Merchants' stock.** A person's goods are their `stock` prop ("type*count|…"), and the morning restock fills to that list. Loading does not overwrite it, so Garrick, Marta, Tobin, Wren and others keep their old, shorter lists for good.
6. **Comments** in `quests/side.ts` and `migrateHaven.ts` describe things that don't exist or are wrong (a `HAVEN_TIERS`, materials "laid at the sword").

## Expected behaviour

**Plots and loom** (new migration, run on load for saves not yet marked):
- Given the chunks of maps the save has been to (the Held Ground and Firstlight's meadow), every plot (`haven.plot.<id>` for each upgrade that has a plot, including the lodges) and `village.loom` is added from the chunk if missing, at the chunk's position and with its type.
- `wp.village` is moved to the position the chunk has for it if it differs.
- A map not in `loadedMaps` is left alone; it comes as built when first loaded.
- A building whose `haven.build.<id>` fact is already set rises on its plot (it becomes e.g. a workbench for the workshop) at the plot's next look once the player is near. Other plots stay plots.
- Once run, the save is marked, and a second run (even with different chunks) changes nothing.
- Fresh games are marked so they don't migrate.

**World map:**
- A v2 save (previous layout) gets the world map's places made again from the chunk: the four new places exist, the East Road and the Rest are where the map has them, and the stray wild place at the East Road's old cell is gone.
- Anything standing on a cell that is no longer open goes to the nearest open one.
- `pocket.return` on any entity, if it names the world map, comes down to its cell:
  - On a 3 x 3 save, the old coordinates scale down (e.g. block cell `meadow.x*3+1, meadow.y*3+1` → `meadow.x, meadow.y`).
  - On a v2 save, a value that is still off the map (the old scale) scales down, and a value on the map is left as it is.
- The migration is marked with a new layout id (v3). The dead v1 branch goes, and v2 is the live "already one place to a tile" layout.

**Smithy:** the removal of the three "moved" ids is dropped. The other additions stay.

**Forged sets:** on load, a piece whose `set` is a forged profession set id is set to the set for its slot: the armour set for armour slots, the trinkets set for trinket slots, and none for the weapon and off hand. With six pieces worn (head, neck, ear, ring, weapon, off hand) in a save from before, a loaded game shows the set as `oathguard`, `oathguard_trinkets` ×3, then none, none. The armour six-piece bonus (e.g. lifesteal) is gone, and the three-piece trinket bonus applies.

**Merchants:** each person's `stock` takes in the world's list:
- Every kind the world's list sells appears, with at least that count.
- Kinds only the save's list holds stay, with their count.
- A person whose list already equals the world's, or who has no list on either side, is left alone.
- Marta, whose old list was only bread, ends with exactly the world's list, and her next restock (or being asked to trade) brings her pies.
- Tobin keeps an extra kind the world never gave him, such as dice, and his firework count rises to the world's.
- Once run, the save is marked.

## Requirements

- Plots/loom, world-map and stock migrations run only for saves lacking their marker, and set it when done.
- The Openworld client's upgrade hook runs the plots migration only with chunks of the `haven` and `meadow` maps that the save has loaded, and the stock migration with the world index. Fresh games get both markers.
- The old tent-only plot migration and its marker are replaced by the new one.
- Every place that the story seals on the world map (`opensWhen` set) has a `SITE_GATES` gate whose fact matches, so the map and the gates can't drift. This must hold for the current content.
- Don't change behaviour for saves already on the current layouts.
- Fix the two comments named above.

## Interface

In `games/openworld/content/src/migrateHaven.ts` (exported through the content package index, replacing `migrateLodges` and `LODGES_LAYOUT`):
- `PLOTS_LAYOUT: string` — the marker fact id for the plots migration (`'content.haven-plots-v1'`).
- `migratePlots(game: Game, chunks: MapChunk[]): void`

In a new file `games/openworld/content/src/migrateStock.ts`, exported from the content index:
- `STOCK_LAYOUT: string` — the marker fact id (`'content.stock-v2'`).
- `migrateStock(game: Game, index: WorldIndex): void` — takes the world index, whose `npcs` carry the current `stock` props.

In `games/openworld/content/src/migrateOverworld.ts`:
- `OVERWORLD_LAYOUT` now has the value `'content.overworld-cells-v3'`. `migrateOverworld(game, overworld)` keeps its signature. A save carrying `'content.overworld-cells-v2'` counts as already one place to a tile.

Already used by the tests (must be exported from the content package if not already):
- `SITE_GATES` (array of gates with a `fact` field).
- `SET_DEFS`, `GAME` (with `upgradeSave`), `BASE_RULES`, `STORY_RULES`, `buildOntology`, `decodeChunk`.
- `setOfSlot(setId: string, slot: string): string | undefined` in `sets.ts`, which maps a slot to the armour set id, the trinkets set id (`<id>_trinkets`), or nothing for weapon and off hand.
