# A cell is made of things: one reference form for cells, floors, and what stands on them

## What is wrong (for a fix) / What is wanted (for a feature)

A map is authored as one terrain per cell, and the engine treats the cell as a special case. It has its own reference form (`{tile: {map,x,y}}`), its own state (`state.tiles` / `TileState`), its own effect (`setTerrain`), and its own place in statuses, relations, views and events. Every rule, the controls, the AI and the renderer must therefore handle two kinds of reference, and a tree, a stump or a rock is a "terrain" rather than a thing.

Wanted: a cell is made of ordinary things, one per space, and there is only one way to refer to anything: `{e: id}`.

- **floor**: the ground one stands on.
- **soil**: what roots in the soil (a stump).
- **volume**: what fills the space (a tree, rock, wall, charred tree, cave wall, roof).

The authored map stays one terrain per cell. The engine splits it into the cell's things. A filled cell (tree, rock, wall…) gets the ground its nearest standable neighbours show. Every terrain becomes a thing type `tile/<id>`, whose data says which space it occupies and that it is drawn as the ground.

Content that used to change terrain through `setTerrain` must instead transform or destroy its own host thing.

## Expected behaviour

**Cell things and ids**
- A cell thing's id is derived from its place: `<map>:<x>,<y>,<z>:<space>`, e.g. `ford:12,8,0:volume`. There is a way to build such an id and to parse one back (returning nothing for ids that aren't cell ids).
- A tree on the Ford: `w.cellRef('ford', x, y)` is `{e: 'ford:x,y,0:volume'}`, the thing's type is `tile/tree`, and it is static (kept in the map's data). Under it a floor thing with id `ford:x,y,0:floor` exists, of a non-solid ground terrain.
- When a cell thing first changes (e.g. gains a status), the state keeps it under the **same id**; it is the same object, no longer static, and appears once in `entitiesAt`. When it is destroyed it stays gone, even after the world is reindexed, and the terrain at that cell reads as the floor beneath.
- A cell thing that has become something else (a tree felled to a stump) is the same thing with a new type.
- Saves hold only cell things that changed. A fresh game saves none. After `World.setTerrain` on a grass cell to farmland, the save holds exactly that cell's floor thing, and a reloaded game shows farmland there with type `tile/farmland`. `World.setTerrain` remains as the author's brush.

**Reference form**
- `Ref` is `{e: id}` only. `{tile}` refs, `state.tiles` and `TileState` no longer exist. Statuses, relations, views and events belong to things only.
- `cellRef(map,x,y)` names a cell as what makes it up on top (the volume if filled, else the soil, else the floor). Roles that used to mean "the tile" (`tileOf:`, a `put`, a blow that meets nobody, lightning, a bump into nothing, a stuck person, a scenario's `tile:`) resolve to that top thing. `placedAt(map,x,y)` returns only what stands or lies in a cell (not the cell's own things); `entitiesAt` returns everything, including the cell's things.
- Interaction: aiming and the chooser (`layers`) list what stands there, then the cell's own things top first (the ground ranks last). A canopy hit that names a cell by any of its ids resolves to the cell's top.

**Spaces and exclusivity**
- `spacesOf(thing)` gives the spaces a thing occupies; `occupant(map,x,y,space)` gives the thing in that space. In every cell of every loaded map each space has at most one occupant, and every cell has a floor, both initially and after two game days of running.
- `cellRank` orders cell things (floor lowest) and `cellTop` returns the top one in a cell.

**Transform / destroy semantics**
- `setTerrain` is removed from rules (the effect op no longer exists). A transform into a type whose space in its cell is already taken by another thing makes the host give way: it is destroyed (an essential thing is not). So rock→gravel with a floor beneath means the rock is gone and the floor shows.
- Content changes:
  - Felling a tree leaves a stump (the tree thing transforms to `tile/stump`; soil space).
  - The dead tree on the Ford falls and its host becomes a stump (it no longer disappears).
  - A stump regrows by transforming to `tile/tree`; a rooted oak sapling does likewise.
  - A shovel digs out a stump: the stump is destroyed and the ground it stood on shows (`grass`, not `dirt`).
  - An axe on a charred tree gives coal and destroys the tree, leaving the floor (`grass`, not `ash`).
  - A pickaxe on rock gives a stone and destroys the rock.
  - Hoeing diggable ground → `tile/farmland`; ice/water/thaw/freeze/bridging transform their own tile thing.
  - Burning: a tree becomes `tile/charred_tree`; other flammable ground becomes `tile/ash`, and what burns on top of a floor is gone.
  - The old `ground/receive-growth` rule is removed.
- Terrain definitions: tree, pine, bush, rock, wall, woodwall, roof, cave_wall, charred_tree occupy `volume`; stump occupies `soil`; everything else is floor.

**Older saves and rules**
- Old tile overrides (terrain and statuses) become cell things when that map's data arrives, so terrain reads as overridden and statuses (e.g. `regrowing`, `wet`) hold on the cell's top thing. Old tile-keyed relations (`on|t|…`) start again quietly, recomputed from where things stand.
- Older rules using `setTerrain` or tile refs are rewritten on entering a rule library, and the validator explains the change.

**Other**
- The map builder clears the volume under a solid fixture set in rock (a brazier against a cave wall, a coal vein).
- Boss blows and `put` act on the aimed cell's top thing; the client's aim signature and scene aim use `{e}` refs, naming a drawn tree/grass object by its cell's `volume` id.
- The migration of the first-light content restores cells to the map's version by reverting their cell things instead of editing tile state.

## Requirements

- No `{tile}` ref, `state.tiles`, `TileState` or `setTerrain` effect remains in the engine, rules, content or client; everything refers to things with `{e}`.
- Cell thing ids are deterministic from map, coordinates, z and space, and are stable across materialisation.
- A static cell thing, once changed, is kept in state under the same id; once destroyed, it never returns from map data, including after reindex and reload.
- Saves contain only changed cell things; a fresh game's save contains none.
- Each space of a cell has at most one occupant; every cell has a floor; this holds on all maps at load and after 48 game hours.
- Filled cells get floor from the nearest standable neighbours' most common ground (deterministic, from the map alone; fall back to any floor, then a default such as dirt).
- Transform into a type whose space is taken destroys the host (except essential things).
- All listed content now transforms or destroys its own host, with the outcomes stated above.
- Existing behaviours that observed cells (aiming, chooser, bumps, lightning, put, boss blows, tileOf roles, scenario `tile:`) keep working through the top cell thing.
- Old saves migrate as described; old rules are rewritten and validated.
- The documentation of the `transform` primitive describes cells as things and the give-way rule; `setTerrain` is removed from the primitive list.

## Interface

In `@lsw/engine` (new file `cells.ts`, exported from the package index):
- `type CellSpace = 'floor' | 'soil' | 'volume'`
- `const CELL_SPACES: CellSpace[]` — `['floor','soil','volume']`
- `cellId(map: string, x: number, y: number, space: CellSpace, z?: number): string` — z defaults to 0; yields `map:x,y,z:space`
- `parseCellId(id: string): { map: string; x: number; y: number; z: number; space: CellSpace } | undefined`
- `interface Layers { floor; soil; volume }` — arrays of `string | undefined` per cell
- `splitLayers(m: MapData, spaceOf: (terrain: string) => CellSpace, standable: (terrain: string) => boolean): Layers`
- A `Space` type exported from the engine (used for `spacesOf`/`occupant`).

On `World`:
- `cellRef(map: string, x: number, y: number): Ref` — the cell's top thing as `{e}`
- `cellTop(map, x, y): Entity | undefined`
- `cellRank(e: Entity): number` — ordering of cell things; ≥ 0 for cell things (floor lowest)
- `placedAt(map, x, y): Entity[]` — things standing or lying in the cell, without the cell's own things
- `spacesOf(e: Entity): Space[]`
- `occupant(map, x, y, space): Entity | undefined`
- `isStatic(e: Entity): boolean` — true while a cell thing is still only the map's data
- `isTerrain(e: Entity): boolean` — whether a thing is a cell thing
- `isSolidTerrain(terrain: string): boolean`
- `revert(e: Entity): void` — return a materialised cell thing to the map's version
- `reindex(): void`
- `entitiesAt` now includes cell things; `setTerrain(map, x, y, terrain)` stays as the author's brush.

On `Engine`:
- `mapArrived(map: string): void` (replaces `ensureRegions`) — makes a map's regions and converts any legacy tile overrides into cell things when its data arrives.
- `legacyTiles: Map<string, {x; y; terrain?; statuses?; statusBy?}[]>` and `reseed: Set<string>` — older-save carry-over.

Terrain definitions gain an optional `space` field (`'volume'` or `'soil'`; default floor). `Ref` becomes `{ e: Id }` only. Terrain types are `tile/<id>`; tests use `tile/tree`, `tile/stump`, `tile/farmland`.
