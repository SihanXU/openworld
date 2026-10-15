# Draw order: floors under what stands on them, walkers ordered by where they are drawn, flyers over roofs

## What is wrong

The client's draw order is scattered through the scene code and gives wrong pictures in several situations:

1. **Floors cover things.** A floor laid under a campfire, bed, stairs or chest has the same depth as them, so which is drawn on top depends on creation order. A floor laid later can cover a campfire, and the result can flip after loading a save. Upper-storey walls and upper-storey floors tie in the same way.
2. **Depth jumps while walking.** A walker's depth is computed from the cell it is heading to, while its picture is still sliding toward that cell. Walking north past a tree, the person goes behind the tree a step too early. Walking south, they jump in front of it a step too early.
3. **A fairy is hidden by roofs.** A companion that can fly over blocking things is drawn under the roof of a house when it is over the house's back-row cells.
4. **The player is hidden by tall things.** Standing behind a wide tree crown, a lamppost or a tall fixture hides part of the player or all of them.

## What is wanted

Make the draw order one pure, renderer-independent rule that can be tested without a renderer. Use it from the scene. Make things that stand in front of the player and cover them fade, as built walls and floors already do.

## Expected behaviour

Order is decided first by the row the thing is in, then by storey, then by its role within the cell.

- **Floor on the ground (storey 0).** It is part of the ground. It is drawn over things that lie flat on the ground (moss, leaves) and under everything that stands, whatever was created first. This holds for fixtures, built blocks, walls, furniture, loose items and bodies. It also holds for things in the row north of it and for bodies three rows north. All ground floors have the same depth, whatever their row.
- **Within one cell, at any storey.** Strictly increasing depth, in this order: floor slab, then a built block or fixture, then loose items (including ones on a table), then a body.
- **Storey up.**
  - A floor at storey 1 is over the wall below it at storey 0.
  - It is under things that stand or sit on it (a bed, a wall, a body at storey 1).
  - A body at storey 0 under that ceiling is under the floor.
  - Anything on upper storeys is behind a body one row further south at storey 0.
- **Row first.** A fixture in a row further south is in front of a body in the row to its north. A body in the south row is in front of a storey-1 wall in the north row. A tree is drawn at `(y+1)·T − 1`. A body in the same row is in front of it, and a body one row north is behind it.
- **A body on the move.** Order it by where it is drawn rather than by its target cell.
  - Stepping north from row 6 to row 5 beside a tree in row 6, the person stays in front of the tree until the picture has reached the target row, and only then goes behind it.
  - While moving south, its depth never decreases.
  - Once it has arrived, its depth equals the depth of a body standing in that cell.
  - The drawn position used for ordering is limited to the range from the target row's top to two rows below it. A body lagging far behind, or a storey lift jumping on stairs, never goes beyond that range.
- **Flyers over buildings.** A flying thing (tagged `airborne`) over a building's covered cells is drawn over the building's roof. A non-flying body at the same place stays under the roof. A flyer south of the building is in front anyway.
- **Fading.** A tree crown, lamppost or tall fixture standing in front of the player and covering them becomes semi-transparent. This is checked every frame because the player's picture moves. Built walls and floors keep their existing see-through behaviour.

## Requirements

- Depth is computed by a single pure function that needs no renderer. The scene uses it for static and moving things.
- Ground floors tie with nothing that stands, and nothing is left to creation order.
- Floors at storey 1 and above are slabs drawn over the wall that holds them and under what stands on them.
- A walker's depth is based on its drawn position, limited to the range above. Stairs lift must not put a walker behind the storey it left.
- The building cover for the flyer rule is the set of cells the building picture covers, down to its last solid row.
- Things that lie flat on the ground keep their existing depth below floors. Ground floors sit just above them.
- Fading applies to tall things standing in front of and covering the player, not to the player, agents or built structures. It is reversible: when the thing no longer covers the player, it is fully opaque again.
- Existing behaviour that is not listed here is unchanged.
- The client test folder is included in the client's type checking.

## Interface

In `packages/client/src/render/depth.ts` (new file):

- `interface Drawn { y: number; z?: number; tags: string[]; spaces?: string[] }`: what a thing's order is read from. `spaces` lists the spaces it takes in its cell (`floor`, `volume`); it is absent for loose things.
- `interface DepthOpts { ground?: boolean; roof?: number; foot?: number }`
  - `ground`: the thing lies flat on the ground.
  - `roof`: the depth of a building whose picture covers the thing's cell.
  - `foot`: where the thing stands now, in pixels from the map's top. It defaults to the bottom edge of its cell.
- `function depthOf(e: Drawn, o?: DepthOpts): number`: the draw order of a thing.
- `function footOf(y: number, drawnFoot: number): number`: limits a drawn foot position to between `y·T` and `(y+2)·T` for the target row `y`.

`T` is the tile size from `packages/client/src/assets/ground.ts`.
