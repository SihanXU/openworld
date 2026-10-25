# Firstlight Village and the wider Ford

The former meadow is **Firstlight Village** (Chinese display name **初原村**), the
place where a journey begins. Its internal ID stays `meadow`: portals, fireweed
turn-ins, save records and explored-map facts keep working.

The Ford keeps Hesper, who opens the arrival dialogue. Tobin, his cart, frost wand
and oil move to the village. Residents of Emberfall are unchanged. Lumi remains a
following companion. Tobin's default and storm schedules never return to the Ford;
the arrival and crossing scenes no longer ask an off-map peddler to speak.

## Authored layout

- Ford: 48 × 30. The river's eastern edge is three tiles farther east. At the
  narrows it is six tiles wide; at the landing the broader pool is ten tiles wide.
  The ferry lands at (37,16); the far-bank objective starts at column 36.
- Footbridge: row 22, western pier x28–30, eastern pier x34–35. Only x31–33 are
  missing, so completing the story still requires three planks. The ferry, fallen
  dead tree and successive frost casts still cross the wider water.
- Village: 60 × 40 since 2026-10-11 (it grew east along the road from the Ford and
  south down the forest trail, so what stood keeps its cell; `tools/src/demo/world.ts`
  `buildMeadow`, `tools/src/demo/village.ts`). Four pixel-art cottage prefabs at (8,5),
  (19,5), (28,5) and (7,13) — Marta's, the elder's, the watch house, the woodcutter's —
  joined by paths to a cobbled square. Well (21,14), lit fire (22,17), log bench
  (20,19), noticeboard (17,14) and commission board (16,14), lit lamps; Cass's loom
  (14,13) by the woodcutter's house.
- The east road's frontage, north of the road as it comes in from the Ford, each door
  with a path down to the road and a sign: the general store (Greta behind her
  counter, the shop panel on its shelves: content `village.ts`) and the smithy (Haldor
  at the forge and anvil inside, anyone's to use with a hammer carried). Two lit lamps
  on the road. Brother Anselm keeps his bookstand of skill books (a shop station too)
  in the chapel (Ilse's).
- Two homes in a south lane off the forest trail: the house in the lane (12,31) and
  the little cabin (30,31).
- Odette the dresser (2026-10-24, content `dresser.ts`): her standing mirror (26,16) at the
  square's south-east, east of the evening fire, where she works 9–18 (`dresser.stand` (26,17)); asked, or a hand on
  the mirror, opens the restyle panel (docs/looks.md §5) for ten Dawnmarks and three
  wildflowers; she sleeps under the market shelter as the travellers do. The small things of the ground
  (flowers, tufts, ferns, reeds, leaves, pebbles, moss, soot) are picked up by hand since the same day and
  are gone (content `life.ts` forage/pick); flowers, tufts, leaves and pebbles come back slowly on any outdoor
  map (content `ontology.ts` LITTER: one every two hours, three at most), and the hand-made maps strew about a
  quarter of what they did (`builder.ts` LITTER_SCALE).
- Every house has a door and a furnished room behind it (an interior map each:
  `villageInteriors`), the cottages included; older saves get the town by
  `content/src/migrateSmithy.ts`.
- Tobin's cart (30,15), with stock on top. Cart, well, sheltered market corner and
  evening fire have reachable schedule anchors. The eastern gate still connects
  to the Ford; the southern trail still connects to the forest.
- Garden x26–29 / y22–25, supply crate (31,23). The twelve vegetable stages and
  four bare planting plots move out of the Ford. Its original cows, hens, pond,
  gathering resources and fireweed remain.

## Existing saves

`content/src/migrateFirstlight.ts` performs a one-time migration on loading an old
`ford-3` save. The client fetches both authored chunks before resuming. New games
are marked immediately; no migration or forced extra map loading is needed.

The migration keeps quest facts, experience, trades, NPC memories, held/stored
items, crop growth/watering and the supply crate's remaining contents. It refreshes
Tobin's schedule and moves only loose legacy wares, not already owned stock.
Visited and unvisited villages are handled separately so harvested crops, taken
supplies and destroyed carts do not respawn. Garden stock now uses stable IDs that
cannot collide with an old meadow's generated items.

Each repaired tile of the old three-plank gap becomes a repaired tile of the new
gap. Old authored farmland overrides are cleared only in the former showcase's
rectangle. Actors or saved builds covered by new river water or cottage walls are
moved to nearby clear ground with their contents intact, not deleted. No save slot
is cleared, and normal saving remains responsible for persistence.

## Verification

The real-world requirement F17 checks the village name, its cottage prefabs, the
smithy's anvil at work, wider river, absence of Ford crops, working well and
lighting; T1 checks that every house on the 60 × 40 map leads into a furnished room
and out again. Existing requirements still prove all four crossings,
trade and the full planting/building loop. Seven migration tests cover visited and
unvisited chunks, partial bridge progress, harvested/destroyed objects, carried
stock, building relocation and idempotency.
