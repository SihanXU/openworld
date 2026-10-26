# No wall without a thing: collision comes from solid terrain and solid things only

## What is wrong

The map has its own collision layer (a list of blocked tile indices, `MapData.solid`) that blocks movement regardless of terrain or what stands there. That layer is a wall with no thing behind it:

- Big things (the tent, the log bench, the burrow's mound) are not solid over their whole base. Authors hide their size behind hand-marked blocked tiles.
- When such a thing is destroyed, the tiles marked for it stay blocked. The felled tent leaves an invisible wall.
- Scenery stamps (prefabs placed as scenery) mark their solid cells in the collision layer instead of being terrain.

Collision should come from only two sources: solid terrain and solid things.

## What is wanted

1. Remove the map's collision layer from the engine's map data, from the content chunk decoding, and from the demo map builder and its output.
2. Let a type declare the size of its base on the ground. A solid thing blocks all of that base while it stands, and nothing once it is destroyed or removed.
3. Give the tent a 3x3 base, the log bench a 3x1 base, and the slime burrow's mound a 3x3 base. All three are solid.
4. Scenery stamps are the look of terrain. Their solid cells (`#`) become solid terrain, not collision-layer entries.
5. The demo Ford map stops hand-marking blocked tiles around the tent, the log bench and the hollow. Its tent, bench and hollow block through their types.
6. The client worker's tick loop reports any error thrown in it to the host, with its stack, instead of failing silently.

## Expected behaviour

- **Base geometry.** A base of [width, depth] on a thing's tile is centred horizontally on that tile and reaches back (north) from it. For the tent standing at (tx, ty), the covered tiles are x in tx-1..tx+1 and y in ty-2..ty. For an even width, the extra column falls on the east side. The default footprint is [1, 1].
- **Tent.** While it stands, every tile of its 3x3 base is not walkable and not passable for path planning. After the tent is destroyed, every one of those tiles is walkable again.
- **Log bench.** The bench's 3x1 base blocks the tile it stands on and the tiles to its left and right. It blocks nothing once removed.
- **Non-solid things** with a footprint, or things with no declared footprint, never block beyond what they did before. Only a solid thing's base blocks.
- **Actors** on a tile still block walking as before. A thing does not block itself: an entity named as the one to ignore is not stopped by its own base.
- **Built maps.** A built Ford chunk's map has no `solid` field. The same goes for any chunk the builder produces.
- **Anchor validation.** The Ford's anchor check still rejects anchors on unwalkable ground, now including tiles under a solid thing's base, but no longer consults a collision layer.
- **Builder queries.** Asking the builder whether a tile is free or walkable accounts for terrain and for the bases of placed things, not only the tile a thing stands on.
- **Scenery.** Stamping a prefab turns its `#` cells into the prefab's terrain (or a wall if none is set) unless the cell is already solid terrain. `D` cells still become doors.

## Requirements

- `MapData` and the raw map type used for chunk decoding no longer have a `solid` field. A decoded map carries none.
- `TypeDef` accepts an optional `footprint` of `[width, depth]`; resolved types always expose a footprint (default `[1, 1]`) that is inherited down the type hierarchy like other fields, with a more specific type's footprint overriding an ancestor's.
- The ontology index exposes the largest width and depth of any registered type's footprint (minimum 1x1), so a lookup knows how far around a tile a base can reach. It stays correct when a type is added at runtime.
- The world's blocked, walkable and passable queries treat a tile as blocked if its terrain is solid or a solid fixture's base covers it. This includes a big fixture standing on a neighbouring tile whose base reaches here. `blocked` accepts an optional entity id to ignore.
- Nothing but solid terrain and solid things' bases blocks movement. There is no other map-level blocking.
- The demo's F11 requirement holds: the built map has no `decor` and no `solid`, and the tent's base is unwalkable while it stands and walkable once it is destroyed.
- The worker's interval callback catches errors from the loop and posts `{ t: 'error', message }` with the error's stack (or its string form if it has no stack).
- Existing behaviour that does not involve collision layers or footprints is unchanged.

## Interface

- `TypeDef.footprint?: [number, number]` in `packages/engine/src/types.ts`, the base on the ground as [width, depth] in tiles. Default [1, 1].
- `ResolvedType.footprint: [number, number]` in `packages/engine/src/ontology.ts`.
- `OntologyIndex.maxFootprint` getter returning `[number, number]` in `packages/engine/src/ontology.ts`.
- `baseCovers(ex: number, ey: number, footprint: [number, number], x: number, y: number): boolean` exported from `packages/engine/src/world.ts` (and so from the engine package). It tells whether a base of the given size standing on (ex, ey) covers (x, y).
- `World.covers(e: Entity, map: string, x: number, y: number): boolean` in `packages/engine/src/world.ts`.
- `World.solidAt(map: string, x: number, y: number, ignore?: Id): Entity | undefined` in `packages/engine/src/world.ts`.
- `World.blocked(map: string, x: number, y: number, ignore?: Id): boolean`. The existing method gains an optional `ignore` parameter.
- `MapBuilder.walkable(x: number, y: number): boolean` in `packages/tools/src/demo/builder.ts`.
- Removed: `MapData.solid`, `RawMap.solid`, `MapBuilder.solid`, `MapBuilder.block`.
