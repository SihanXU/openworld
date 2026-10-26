# Two-level maps: an overworld of sites, open map edges, long-step time, and a generated wilderness

## What is wanted

The world should become two-level. A continent, ringed by sea, is itself an ordinary map (the **overworld**). Every cell of land on it stands for a local map. Walking out of a local map's edge lands you on the overworld, and empty hands on a place there take you back in. Cells with no hand-made map get a **wilderness** map generated from the world's seed and the cell's ground. A step on the overworld takes game time, and that time passes at once.

The pieces:

1. **The overworld map.**
   - 16 × 12 cells, each a block of 3 × 3 tiles.
   - Grounds are new `ow_*` terrains: sea, plain, forest, hills, mountain, snow, road, river.
   - Each step costs time by ground: road is cheaper and rough ground dearer. Sea, mountains and rivers cannot be passed.
   - Every cell of land holds a *site* thing. It is `site/place` where a hand-made map sits at the cell its edge links put it. It is `site/wild` elsewhere.
   - The overworld's scale is 30 minutes a step.
2. **Parts of a map.**
   - A map's *parts* are the sets of cells reachable from one another without crossing water, lava or void. Things that can be broken, such as trees and rock, do not split a part.
   - A map's block on the overworld shows its parts side by side, with river where parts would otherwise touch. The Ford's block reads west bank | river | far bank.
   - A mountain range and the river carry the Ford's barrier from sea to sea. What a map keeps apart, the overworld keeps apart (mirrored barriers).
3. **Open edges.**
   - Walking out of a map's edge puts you on the tile of its cell's block that shows the same part, nearest where you left, and facing the way you walked. This holds even for an edge opened by mining through rock.
   - Empty hands on a site push you into its map. You arrive on the part that the block tile you stand on shows, nearest the point on the map that the tile stands for. Coming from beside the site, you arrive on the side you came from.
   - Anything else done to a site is out of reach: a blow, putting something down, taking something. The game logs that it is too far and nothing changes.
   - Portals between hand-made maps keep working.
   - Big things must be found by the tiles their base covers, not only by their anchor tile. Selecting or acting on a tile of a site's block must find the site.
4. **The wild.**
   - A function makes a wilderness map from the world's seed, its overworld cell and its ground (plains, woods, hills, snow, road). The same inputs always give the same map. A different cell gives a different map.
   - The client makes the map when it is needed and when a save is loaded. Only what changed is in the save.
5. **Long steps.**
   - A step on a map with a scale lasts scale × the ground's cost × weather. Rain, storm and snow make it longer.
   - The player's time passes at once, as a fast-forward. Hunger falls on its own clock during it. Harm stops it, with a log line.
6. **Client.** The overworld grounds and sites need art, and site signposts need to be shown. The worker makes wild maps rather than fetching them.

## Expected behaviour

- **Every map is on its cell.** Every loaded map other than the overworld has a `site` pointing at its block on the overworld. The cell holds a `site/place` whose map prop names it, found on the block's bottom row.
- **Mined out of the summit's edge.** On the summit, mine through the two rows of rock at the north rim, then walk up off the edge. You arrive on the overworld within the summit's block, on its north row. Empty hands on the place there take you back into the summit, on its northern side.
- **A step passes time.** Standing on plain overworld ground and stepping once passes at least 30 minutes × the ground's cost of game time, and hunger is lower afterwards. While burning, the same step stops early and takes less time.
- **The river is a barrier.** From the west bank, no walk over passable overworld tiles reaches the Ford's far-bank tiles, nor the east road's cell. Only going through the Ford does. Stepping west from the east road's cell onto the Ford's block and going in puts you in the Ford's far-bank region.
- **A wilderness is stable.** Enter a wilderness, change it (fell a tree, set a stone down), leave by its west edge and re-enter. The terrain is the same and both changes are kept. After a save and load, with the map made again from seed and cell, the changes still show.
- **Determinism.** For every ground that has a recipe, two calls with the same seed, cell and ground give equal results. A different cell gives different terrain.
- **Mirrored barriers.** For every map with a site, any two passable tiles of its block that show different parts are not connected by overworld walking. At least one map has more than one part on its block.

## Requirements

- The overworld is an ordinary map. Its barriers are terrain, and nothing special-cases them.
- `ow_sea`, `ow_mountain` and `ow_river` block walking. The other `ow_*` grounds are walkable and carry a `cost`: road 0.5, plain 1, and forest, hills and snow 1.5.
- Parts come from a map's data and do not change with play. They treat floorless cells (water, lava, void) as splits. Cells with no floor belong to no part.
- Leaving by an edge applies to the player only, and only on maps that have a `site`. NPCs and portals behave as before.
- A tile of a block that shows no matching part falls back to the nearest open tile. Arrival falls back to the nearest place the entity fits.
- Long steps apply only on maps with a `scale`. Non-player steps on such a map set the actor's cooldown instead of fast-forwarding.
- Rain, storm and snow multiply the step time by a configurable world parameter (default 1.5).
- Fast-forward stops at the first tick where the player's hp has dropped below its value at the start.
- Entering a map that is not loaded yet remembers where the player came from and places them once the map arrives.
- A site's map prop can be passed on as a word to an effect, so that "go in" can name the map.
- Wild maps are 40 × 30. Nothing grows in the middle, where one arrives. They are zone `combat`, outdoor, and carry the `site` of their cell.
- Save and load keep working: the wild map is rebuilt from seed and cell, and the save carries only changes.
- Old saves and existing maps keep loading. The new map fields are optional and are carried through map decoding.

## Interface

**`packages/content/src/wild.ts`** (exported from `@lsw/content`)
- `WILD_W: number` and `WILD_H: number`. The wild map is 40 wide and 30 high.
- `wildId(cx: number, cy: number): string` returns `wild.<cx>.<cy>`.
- `wildCell(id: string): { cx: number; cy: number } | undefined` parses such an id and returns undefined for anything else.
- `wildChunkFor(w: World, id: string): MapChunk | undefined` makes the wild map named by `id` from the world's seed and its site entity on the overworld. It returns undefined if `id` is not a wilderness or no site names it.
- `wildChunk(seed: number, cx: number, cy: number, ground: string, site: MapData['site']): MapChunk` is deterministic. An unknown ground falls back to plains.
- `WILD_GROUNDS: string[]` lists the grounds a wilderness can be made for: `ow_plain`, `ow_forest`, `ow_hills`, `ow_snow`, `ow_road`.

**`packages/tools/src/demo/overworld.ts`**
- `OVERWORLD = 'overworld'` is the map id.
- `BLOCK = 3` is the tiles per side of a cell.
- `CELLS = { w: 16, h: 12 }`.
- `FORD_CELL = { x: 7, y: 5 }`.
- `OVERWORLD_STEP = 30` is minutes per step on plain ground.
- `placeCells(builders: MapBuilder[], origin: MapBuilder): Map<string, { x: number; y: number }>` puts each map in a cell relative to the origin, from the edge links of its portals.

**Engine (`@lsw/engine`)**
- `MapData.scale?: number` is minutes per step on a map.
- `MapData.site?: { map: string; x: number; y: number; size: number }` is the top-left tile of the map's block, and its side.
- `WorldParams.rainCost?: number`.
- `World.partsOf(map: string): Int32Array | undefined`.
- `World.partAt(map: string, x: number, y: number): number`, with -1 for none.
- `World.regionPart(map: string, i: number, j: number, size: number): number` is the part that holds most of the region that tile (i, j) of a `size × size` block stands for.
- `World.coveringAt(map: string, x: number, y: number): Entity[]` returns the non-body things whose base covers the tile but whose anchor is on another tile.
- `Engine.enterFrom(e: Entity, map: string, through: Entity | undefined): void`.
- `Engine.pendingTransition` gains an optional `entry`.
- `Entry` is `{ rel: [number, number]; tile: [number, number]; size: number }`.

**Content**
- The terrains `ow_sea`, `ow_plain`, `ow_forest`, `ow_hills`, `ow_mountain`, `ow_snow`, `ow_road` and `ow_river`, with map characters `'0'` to `'7'` in that order.
- Entity types `site`, `site/wild` and `site/place`. `site` has a 3 × 3 footprint. A site's `props.map` names its local map, and for wilds `props.ground` names the overworld ground.
- The constant `RAIN_COST = 1.5`, passed as the `rainCost` param in the ontology.
- Rules `site/enter` and `site/far`.
- `MapBuilder.site?: MapData['site']`, written out with the built map.
- `RawMap.scale` and `RawMap.site`, carried by `decodeMap`.
