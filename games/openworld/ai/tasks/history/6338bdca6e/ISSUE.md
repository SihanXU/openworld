# Storeys, building by setting things down, support and collapse

## What is wanted

The world has only one level: every place on a cell is on the ground. We want vertical structure, so that players can build upward with wooden pieces. This means:

- A place on a cell has a storey `z` (0 is the ground's; omitted means 0). Up to 4 storeys may stand above the ground (a world parameter). Spaces, exclusivity, walking, bodies and relations are all per storey: two things on different storeys of the same cell do not conflict.
- Three new buildable types, carried like any item and crafted by hand from planks: a wall, a floor and stairs.
- Building is putting one of these on a cell. It comes to rest on the lowest storey (counting from the one of the target cell) that has room for what it takes and something to hold it. A wall goes on the ground. A floor laid over a wall goes onto the storey above. Pieces can be picked up again like anything carried.
- A floor needs support. It is held up by walls on the storey below within a reach of two cells (the walls of the map hold too). A floor with no holder cannot be placed. A floor that loses its last support breaks, and what stood on it falls.
- Falling: something that stands on nothing on its storey drops to the first floor below (or the ground) and is struck by the drop beyond the safe height.
- Walking: from stairs one steps up onto the floor above them; from above one steps onto stairs below; off the edge of a floor one falls to the first floor below.
- When a thing changes, moves or goes, the relation update must reach every storey of the touched cells and everything that relied on the thing (stood on it or was held up by it).
- Client: storeys are drawn raised, built things set in a cell are drawn as part of the place, and what stands above the player near them fades.

## Expected behaviour

On an open stretch of ground:

1. Putting a wall on a ground cell: it ends up on that cell at the ground storey.
2. Putting a floor on that wall's cell: the floor rests on storey 1 above the wall. A floor put on a cell one beside it ends up on storey 1 too, because the wall's reach of two cells holds it, and it has a `support` relation.
3. Putting stairs on an adjacent ground cell: they rest on the ground.
4. A player on the cell beside the stairs walks onto the stairs (ground), then in the same direction onto the floor above (storey 1).
5. When the wall is broken (durability gone), after a few ticks the supported floors are gone, each breaking into what it was made of (planks come back). The player standing on one falls to the ground storey on that cell, ending at ground level.
6. A floor on the ground storey needs no support. A floor with no wall below it and no ground-storey room finds no place.

## Requirements

- Each place on a tile carries an optional storey; ground is the default and is omitted from positions and snapshots.
- A world parameter gives the number of storeys above the ground (4).
- Occupancy lookups (what is at a cell, what occupies a space, who stands, what blocks or is walkable, what covers) take a storey, defaulting to the ground; the map's static things belong to the ground only.
- A thing set on a cell settles on the lowest storey from the target's up to the maximum where the spaces it takes are free and it is held (a floor by its supports, other things by a floor there). When there is no such storey the put does nothing.
- Anything put on a built structure goes on top of it rather than into it.
- Support relation: a floor relates `support` to each holder within reach on the storey below. Walls carry a `supports` reach of 2 (stone and wooden map walls too).
- A floor that loses its last support breaks (durability to none, with a visible effect and a log line) and what stood on it falls, via a new rule on the end of a contact.
- A new condition lets a rule test whether a role currently has a relation of a given kind. It validates in mod patches and is described in the mod spec.
- A new effect makes a host with nothing under it on its storey fall to the first floor below. It does nothing while a floor is there or if the host flies. Falling is struck by the drop like other falls.
- Moving: step up from stairs onto a floor above, down onto stairs from above, off a floor's edge a fall. The cliff/height logic applies only on the ground storey.
- The relation diff reaches all storeys of touched cells and everything that depended on a changed thing, including support, not just standing-on.
- Snapshots expose the storey of entities and the player when above ground, and the spaces of entities that take any besides a body.

## Interface

- `World.settleZ(e: Entity, map: string, x: number, y: number, from?: number): number | undefined` — in `packages/engine/src/world.ts`.
- `World.supportersOf(e: Entity): Entity[]` — in `world.ts`.
- `cellKey(map, x, y, z?)` and `storeyOf(place)` exported from `world.ts`.
- Storey-aware optional `z` (default 0) parameter on `World.entitiesAt`, `placedAt`, `occupant`, `coveringAt`, `actorAt`, `solidAt`, `blocked`, `walkable`, `fits`.
- `Pos.z?: number` and `Place` tile variant `z?: number` in `types.ts`; `WorldParams.storeys?: number`.
- New condition `{ rel: { role: RoleName; how: string } }` and new effect `{ op: 'fall' }` in `types.ts`.
- `EntitySnap.z?`, `EntitySnap.spaces?: string[]`, `Frame.player.z?` in `snapshot.ts`.
- Content: `STOREYS` exported from `packages/content/src/ontology.ts` (4), params `storeys`; types `structure`, `structure/wall`, `structure/floor`, `structure/stairs`; rules `core/fall` and `build/stack`, `build/collapse`.
- Client sprites for `structure:wall`, `structure:floor`, `structure:stairs` in the catalog.
