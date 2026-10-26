# World map as a place to a cell, sealed places, Firstlight's town with shops and smithies, and loose coin on death

## What is wanted

Several linked pieces of content and engine behaviour are wanted together:

1. **Overworld, one place per cell.** The overworld used to give each place a 3x3 block of tiles. It should now be one cell per place. Each hand-made place is drawn as its own kind (village, town, farm, mill, woods, hollow, barrow, mine, lair, pass, summit, shrine, camp, waystone). The Ford is a "crossing": its cell is the river's, and it is entered from the cell beside it. Walking off a local map's edge leads onto the neighbouring overworld cell. Coming back onto a place's cell and pressing E enters it on the side one came from.
2. **Sealed places.** Places beyond the White Knight on the East Road (Emberfall, the mine, the pass, the lair, and everything east of them) are sealed until the story fact that he has fallen is set. Entering a sealed place says why and does not go in.
3. **Overworld time.** One overworld step costs half an hour, scaled by the cell's ground cost, and hunger falls over it.
4. **Saves.** Older saves migrate in three ways. They are laid out one place to a tile. Cloudtop's waypoint statue (`wp.summit`) is removed, and the waypoint list no longer includes it. The smithy and town changes below are applied.
5. **Smithing.** Firstlight has a smith, Haldor, who works at a lit forge and an anvil indoors by day. A smith's mark shows over smiths' heads. The Held Ground has a smith, Alberic, with his own forge and anvil.
6. **Firstlight's town.** The village map grows to 60x40 (east and south only). Every house has a door and a furnished room behind it. Rooms: the elder's, the families' (cook, guards, woodhouse), two south-lane homes (lane, cabin), and, on the east road, the general store (Greta), the smithy and the church. The church has Brother Anselm's bookstand of skill books.
7. **Shops.** The general store's counter and the church's bookstand are shop stations. A hand on them opens a shop panel (`shop:<station>`). The shop panel serves any shop station, not just the existing stall.
8. **Money on death.** On normal difficulty, when one rises at home after falling, the coin one carried is not put in the bundle. It lies loose on the cell where one fell, to be picked up. The rest still goes into the bundle.
9. **UI polish.** The bag shows the coin carried. It becomes a character sheet with the portrait between the body's slots, the stats beneath, and silhouettes in empty slots. Panels, ribbons, slots and buttons get a framed look. This is presentation only.

## Expected behaviour

- **Place entities.** Every map except the tutorial and the floors under the barrow lies on the overworld, on one cell. The overworld entity at the map's `site.x, site.y` has a type starting `site/place/` and `props.map` equal to the map's id.
- **Pass edge.** Mine through the pass's north rim, then walk up. One arrives on the overworld at `(site.x, site.y - 1)`. After walking down onto the pass's cell with the knight beaten, E enters the pass on its north side.
- **Ford and river.**
  - The Ford's cell is not passable on foot.
  - From the west bank, nothing reaches the east road's cell. The east road's cell is directly east of the Ford's.
  - On the east road's cell facing west, the E plan is `site/enter` targeting `site.ford`. It puts one on the Ford's far bank.
  - Leaving the far bank by its north edge puts one on the east road's cell.
- **Facing.** Anywhere on a standable overworld cell, E enters that cell's place whichever way one faces. The exception is that facing a crossing's cell targets the crossing instead.
- **Labels.** The plan label starts with "Enter " normally. It starts with "Sealed: " for a place whose `props.opensWhen` fact is unset.
- **Sealed places.**
  - Emberfall, mine, pass and lair each have `props.opensWhen` equal to `CH1.knight`.
  - Pressing E on Emberfall's cell labels the plan "Sealed: …" and says why, and one stays on the overworld.
  - The snapshot entity for a sealed place carries `sealed: true` and `leadsTo: <map id>`. The `sealed` field is absent once the fact is set.
  - After `CH1.knight` is set, the label is "Enter …" and one goes in.
- **Wild places.** Entering a wild place from its cell, leaving by the west edge, and returning puts one back on its cell, or beside it where the west is sea. The map is the same each time, with changes kept.
- **Overworld step.** One step from the cell west of the Ford takes at least `30 * cost * TICKS_PER_HOUR / 60` ticks, where `cost` is the destination cell's `cost` prop. Hunger falls, and being hurt shortens the passage of time.
- **Overworld size.** There are far fewer standable cells than before, but still more than 80.
- **Village.**
  - The village map is 60x40 with 5 `house_*` stamps.
  - Its portals into interior maps lead to exactly these rooms: `meadow.cook`, `meadow.elder`, `meadow.guards`, `meadow.woodhouse`, `meadow.store`, `meadow.smithy`, `meadow.church`, `meadow.lane`, `meadow.cabin`.
  - Each room's exit leads back to the step before its door (`door.x, door.y + 1`) and contains a bed.
  - Walking up from that step enters the room.
- **Smithy.**
  - `smithy.forge` is a lit `fixture/craft/forge` in `meadow.smithy`.
  - The map has the anchor `smith.anvil`.
  - By day (about 9:00) `npc.haldor` is within 2 cells of the anvil and has the tag `smith`.
  - His trade stock includes `item/tool/smith_hammer`, `item/material/coal` and `item/material/iron_ingot`.
  - Recipe `smith/smelt-iron` turns 2 iron ore and 1 coal into 2 iron ingots at the forge.
  - Recipe `smith/dagger-iron` makes a dagger of iron at the anvil. It fails without a carried smith hammer and succeeds with one.
- **Shops.**
  - The store's counter (`fixture/furniture/counter/store`, station `store`) offers supplies and provisions to buy and goods to sell back, for Thornmarks.
  - The church's bookstand (`fixture/furniture/bookstand`, station `books`) sells a skill book for every active skill. Common ones cost 60 and profession ones cost 120, on a separate shelf.
  - A hand on either opens the panel `shop:<station>`.
  - The existing stall keeps its shelves. The shop panel serves any station listed in the shops list the client is given.
- **Death.** On normal difficulty, 7 carried Thornmarks, then a fall and `respawn(true)`:
  - After one tick the player carries 0.
  - Exactly 7 `item/misc/thornmark` entities lie on the fall cell, loose.
  - None of them is inside any bundle's contents.
  - The bundle drop otherwise behaves as before.

## Requirements

- The overworld has one place per cell. A place's footprint is one cell, and the `site` type no longer has a 3x3 footprint.
- Place types `site/place/<kind>` exist for each of `village`, `town`, `farm`, `mill`, `woods`, `hollow`, `barrow`, `mine`, `lair`, `pass`, `summit`, `shrine`, `camp`, `waystone`. `site/place/crossing` also exists, with hand range 1, for places a barrier runs through. Each has its own sprite key, and the sprite catalog draws it as that kind.
- The rule `site/enter` refuses places whose `opensWhen` fact is unset. It logs the reason and labels the plan "Sealed: {target}". The gates are data: an exported list `SITE_GATES` of `{ fact, say: { en, zh } }`. It has one entry for the White Knight (`CH1.knight`).
- Overworld terrain, ground and sprite keys exist for the world map's inked style: sea, river, plains, forest, hills, mountain, snow and road. A smith's mark sprite exists.
- The migrations run on load for saves lacking their layout fact, and fresh games are marked as already migrated.
  - **Overworld:** destroy and recreate the overworld's site entities from the current map. For saves already on an earlier place-to-a-tile layout, only the places are redone. For older saves, other things standing on the overworld move to the nearest open cell of their old block.
  - **Waypoints:** destroy `wp.summit`.
  - **Smithy:** destroy the old open-air forge, anvil and smithy sign. Add the new signs, lamps, forge and anvil to maps the save has already visited. Maps not yet visited get them when first loaded.
  - Each migration is idempotent and skips itself if its fact is set.
- Rules or recipes for shops are part of the base rule and recipe sets, and the shop definitions are given to the client's crafting configuration.
- The `dropContents` effect gets a way to name kinds that stay loose beside the bundle instead of going into it. The rising rule uses it for currency, and its doc and log text say the coin is scattered beside the bundle.
- The old exported `BLOCK` constant in the demo overworld module is gone. The demo overworld, world and people modules are updated to place each map on its cell, with the Ford's cell the river's.
- Hunger and passage of time on the overworld follow the cell's ground cost.

## Interface

In `@openworld-game/content` (`games/openworld/content/src`):

- `SITE_GATES: { fact: string; say: { en: string; zh: string } }[]` in `rules.ts`.
- `OVERWORLD_LAYOUT` (`'content.overworld-cells-v2'`) and `migrateOverworld(game: Game, overworld: MapChunk): void` in `migrateOverworld.ts`.
- `WAYPOINTS_LAYOUT` (`'content.waypoints-v2'`) and `migrateWaypoints(game: Game): void` in `migrateWaypoints.ts`.
- `SMITHY_LAYOUT` (`'content.town-v2'`) and `migrateSmithy(game: Game, chunks: MapChunk[]): void` in `migrateSmithy.ts`.
- In `village.ts`:
  - `interface ShopDef { station: string; name: Text; shelves: [group: string, en: string, zh: string][] }`
  - `SHOPS: ShopDef[]` (stations `stall`, `store`, `books`)
  - `VILLAGE_SHOP_RECIPES: Recipe[]`
  - `VILLAGE_SHOP_RULES: Rule[]`

  All of these are re-exported from the content index along with the migration modules.
- New ontology types:
  - `site/place/{village,town,farm,mill,woods,hollow,barrow,mine,lair,pass,summit,shrine,camp,waystone}`
  - `site/place/crossing`
  - `fixture/furniture/counter/store`, with tags `shop` and `station:store`
  - `fixture/furniture/bookstand`, with tags `shop` and `station:books`
- Recipe ids:
  - `store/buy/…` and `store/sell/…`
  - `books/<skillId>`
  - `smith/smelt-iron` and `smith/dagger-iron`
- Entity ids and maps (the existing demo and tools modules are extended):
  - NPCs `npc.haldor` and an Alberic smith setup
  - entities `smithy.forge` and `site.<id>`
  - maps `meadow.store`, `meadow.smithy`, `meadow.church`, `meadow.lane`, `meadow.cabin`, `meadow.cook`, `meadow.elder`, `meadow.guards`, `meadow.woodhouse`
  - map anchor `smith.anvil` on `meadow.smithy`
- The `dropContents` effect accepts `loose?: string[]` (type tags or kinds, e.g. `['currency']`) for items left unbundled.
- The snapshot's entity entries may carry `sealed?: true` and `leadsTo?: string` for a sealed place.
- Client:
  - `CLIENT_GAME.crafting` accepts `shops: ShopDef[]`.
  - The catalog has the sprite keys `ow_sea`, `ow_river`, `ow_plain`, `ow_forest`, `ow_hills`, `ow_mountain`, `ow_snow`, `ow_road`, `site:<kind>` for each place kind and the Ford, `site:woods`, `site:wild`, and the UI sprite `smithMark`.
- Tools: asset generators `worldmap.ts`, `smith-mark.ts` and `equip-slots.ts` under `games/openworld/tools/src/art`.
- The overworld demo module still exports `OVERWORLD` but no longer exports `BLOCK`.
