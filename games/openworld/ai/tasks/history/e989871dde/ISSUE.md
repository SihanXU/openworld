# Remove Cloudtop and Pinewind Slope; the Mountain Foot keeps what they taught

## What is wanted

The prologue's summit map (Cloudtop) and the Pinewind Slope map are to be removed from the world, along with their links to other maps, their waypoints, and the prologue beats and objectives that belonged to them (stages 1–7 of the old mountain descent). The tutorial now teaches those lessons, so the prologue proper begins at the Mountain Foot.

The world content that tests relied on in the deleted maps must live on elsewhere. The Mountain Foot has to gain the terrain features the deleted maps provided: raised high ground with a rock face and a ramp, and a wooden hut. Tests that previously used the summit or slope should be able to use the hollow, the pass, or the foot instead.

The prologue's stage numbers shift to match. The world data version is bumped.

## Expected behaviour

**Maps and links**
- The world has no `summit` and no `slope` map. No waypoints `wp.summit` or `wp.slope` exist; the only prologue waypoint is `wp.foot`.
- The foot links only southward to the Ford. Its northern edge opening stays in the layout (for the tutorial's road), but nothing is linked there.
- On the world map the foot lies directly above the Ford (y = -30).
- Overworld ground for the removed maps is no longer defined.

**Prologue stages**
- Stages 1–8 are left to the tutorial and are no longer defined by this prologue module's beats or objectives.
- `PROLOGUE_AT_FOOT` is 9: the foot, before the seal stone. Its objective is "try something the world has never seen".
- Stage 10 (`PROLOGUE_AT_FOOT + 1`) is "Down to the Ford"; the beat that fires after the first world experiment moves the stage from 9 to 10.
- `PROLOGUE_DONE` is 11, reached once on the Ford.
- A saved game whose player has no `prologue` prop defaults to `PROLOGUE_DONE`, not a hard-coded number.
- The world version string is `ford-4`.

**Mountain Foot additions**
- High ground: the northern part of the foot stands at height 4 (two levels) above the rest. Its southern edge is a face of rock, with a two-column-wide ramp starting at the top-of-ramp position `PAT.ramp` (20, 3). Going down the ramp, heights step 4, 3, 2, 1, 0 over five consecutive rows starting at the ramp's top row. Walking down and back up the ramp is unharmful. Stepping off the rock face elsewhere (once the rock is removed) is a fall of two levels that hurts, and the face cannot be climbed back.
- A hunter's hut: a small building of wooden walls over a wooden floor, with its door gap in the south wall. Its walls can burn, lose durability, and become burnt walls.
- The skip start (`TUTORIAL.skip`) for a game that skips the tutorial is moved to (20, 1), so the player begins at the foot on the trail above the ramp.

**Rock for tool tests**
- A wooden club on rock in the hollow is too hard (rock untouched). A stone pickaxe breaks hollow rock in two blows, yielding stone.
- The pass's northern rim has two rows of rock over open ground; mining through both lets the player walk out onto the pass's cell on the overworld, and entering from that place takes them back in on the north side.

**Prologue playthrough (skip start)**
- A game started in "skip" mode begins on the `foot` map at stage `PROLOGUE_AT_FOOT`, with Pip asking returning the seal-stone objective text ("世界从没见过…").
- Waking the foot's waypoint statue (`wp.foot`) works, and the first-sighting remark about the waypoint fires.
- Approaching the seal stone triggers the relic beat; using it advances to stage `PROLOGUE_AT_FOOT + 1`.
- Walking south off the foot onto the Ford completes the prologue (`PROLOGUE_DONE`); Pip then tells the main story's next step (go help the village).
- Travelling to `wp.foot` from the Ford returns the player next to the foot's statue.

**Companion behaviour** continues to work when the player moves about on the foot's open ground below the high ground (e.g. around (8, 8) and (14, 8)), in place of the old slope.

## Requirements

- Remove the summit and slope map builders, their links, zones, builder list entries and overworld ground entries; nothing in the built world refers to them.
- Remove prologue objectives and beats for stages 1–8; key the remaining objectives off `PROLOGUE_AT_FOOT`.
- Set `PROLOGUE_AT_FOOT = 9`, `PROLOGUE_DONE = 11`, and the world version `ford-4`.
- The client's save summary uses `PROLOGUE_DONE` as the default for a missing `prologue` value (the client imports it from the content package).
- The foot gains the high ground, rock face and ramp, and the hunter's hut, as above, without disturbing the seal stone, the foot waypoint, the sign, the trail or the exit south.
- The high ground, rock face and ramp must leave the foot's open ground at around (8, 8) and (14, 8) walkable for the companion test, and the hut must have at least one `woodwall` cell reachable from a neighbouring walkable cell.
- The foot is the only waypoint-bearing prologue map; the world index's waypoint list contains exactly `wp.foot` from the prologue.
- The hollow must have rock cells reachable from an adjacent walkable cell, and the pass's north rim must have a position with rock in rows 0 and 1 and open ground in row 2.
- The green slime remains witnessed by the quest that clears the hollow rather than by the prologue.

## Interface

- `PAT.ramp` — in `packages/tools/src/demo/prologue.ts`, a `readonly [number, number]` equal to `[20, 3]`: the top of the two-column-wide ramp at the foot (the ramp's x is `PAT.ramp[0]` and `PAT.ramp[0] + 1`; the ramp's rows are `PAT.ramp[1]` … `PAT.ramp[1] + 4` with the rock face on row `PAT.ramp[1] + 2` elsewhere).
- `PAT.relic`, `PAT.footStone` remain in the same file; `PAT.spawn`, `PAT.summitStone`, `PAT.pine`, `PAT.slopeStone`, `PAT.slopeFire` are removed.
- `PROLOGUE.summitSouth`, `PROLOGUE.slopeNorth`, `PROLOGUE.slopeSouth` are removed; `PROLOGUE.footNorth`, `PROLOGUE.footSouth`, `PROLOGUE.fordNorth` remain.
- `buildSummit` and `buildSlope` are removed from `packages/tools/src/demo/prologue.ts`; `buildFoot` and `buildTutorial` remain.
- `PROLOGUE_AT_FOOT` (9) and `PROLOGUE_DONE` (11) in `packages/content/src/prologue.ts`, both exported from `@lsw/content`.
- `TUTORIAL.skip` is `[20, 1]`.
