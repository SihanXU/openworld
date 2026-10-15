# World model review fixes: one body per cell, exact repeat check, old saves keep unvisited maps' cells, scenarios name things under a cell's top

## What is wrong

A review of the world model found several faults:

1. **People share cells.** People can pass through other people, and a person's placement or teleport can put them on a cell another person holds. Pushing into a person is handled loosely: the swap is queued and the pusher steps in regardless of whether the other has moved. Only one pusher at a time is tracked for bump counting.
2. **Solid things and bodies share cells.** A faller (e.g. a player on a floor that is destroyed) can land inside a body or a solid volume below. A wall can be set down on a hen. Transform, breakdown and spill effects on an upper storey also lose their storey and act at ground level.
3. **The repeat check (endless yield, world-model §8.4) is by luck.** A yield that comes only by chance (a chance condition, a chance emit, a fractional breakdown part) can pass the check, though it is as endless as one that always comes.
4. **Scenarios cannot name a thing under a cell's top.** A request about the floor under a tree is replayed as a request about the tree. Statuses/props of cell things other than the top are not carried either.
5. **Old saves lose cells.** When an older save (cells kept as tile overrides) is upgraded, loaded, and saved again before a map is entered, the migrated cells of that map, and the "start relations again" marks, are lost.

## Expected behaviour

**One body a cell**
- Two people never occupy the same cell (same storey). A person cannot walk onto a cell another person holds.
- The player, or a person on their way, who keeps pushing into a free person for about the same duration as before swaps places with them. The pushed person makes way first, at once. The pusher steps into the cell only if it has actually been vacated; otherwise the push fails and nothing moves. Each mover's pushing is tracked separately, so several pushers do not disturb one another's count. A person being pushed by a swap may step into the pusher's cell.
- A person who is placed/teleported to a cell that is not free goes to the nearest free cell instead. Flyers are unaffected.

**Solid vs body**
- A fall that would end in a cell holding something it clashes with comes to rest on the nearest free cell beside it (still falling to the same height). A wall (volume) is not set on a body, and a body is not set in a volume. Two things taking the same space also clash.
- Transform (where a thing gives way), breakdown products, and spilled contents stay on the host's storey.

**Exact repeat check**
- The check runs the event twice, once with every chance forced to come out "yes" and once with every chance forced "no", on a copy of the world each time. If either run shows an endless yield, the patch is refused.
  - A chance condition holds (or fails). A chance emit is always (or never) made. A fractional breakdown part is always made (rounded up) in the "yes" run.
- In normal play the chances remain random.

**Scenarios**
- A thing under its cell's top is named `tile:x,y:space` (e.g. `tile:3,4:floor`), where space is the thing's space. The cell's top is still `tile:x,y`. Replaying a scenario resolves such a name to what takes that space in the cell.
- Scenario cells carry statuses/props of every kept (non-static) terrain thing in the cell, each tagged with its space when it is not the top, and replay applies them to the right one.
- Test derivation from a patch request must ignore the `tile:x,y:space` form where it reads terrain rows (it is not the cell's top and has no row of its own to swap).
- The modder spec's description of scenario roles mentions the new form.

**Old saves**
- The migrated cells of maps not yet entered, and the maps whose relations must start again, are part of the world state, so they survive a save and reload. Once a map's data arrives, its entry is applied and removed from the state.

## Requirements

- No two bodies share a cell over a long simulated run of the village (two in-game days).
- Pushing into a person: swap only when the other actually left; a failed swap leaves both in place.
- Teleporting/placing a person onto an occupied cell lands them on the nearest free one.
- A fall never rests inside a clashing thing; the faller lands beside it.
- A wall cannot be built on a hen or on the cell where its builder stands; the structure stays in the builder's hands.
- Transform/breakdown/spill preserve the storey.
- The endless-yield check refuses a chance-gated yield in both directions (yield by a rare chance, or yield when a likely chance fails).
- `buildScenario` for a floor under a tree gives a host of the form `tile:x,y:floor`, and the sandbox built from it resolves that host to a floor of the same type.
- Upgrading an older save, loading it, entering another map, saving, and loading again, then entering the first map still yields the migrated terrain (e.g. a stump) there, and the pending entry is gone from the state afterwards.

## Interface

- `World.luck?: boolean` in `packages/engine/src/world.ts`: when set, every chance comes out this way; unset in play.
- `World.clash(a: Space[], b: Space[]): boolean` in `world.ts`: whether two sets of spaces cannot share a cell (same space, or volume vs body).
- `World.clashesAt(map: string, x: number, y: number, z: number, spaces: Space[], ignore?: Id): Entity[]` in `world.ts`: what in a cell clashes with a thing taking these spaces.
- `LegacyTile` type in `packages/engine/src/types.ts`: `{ x: number; y: number; terrain?: string; statuses?: Record<string, number>; statusBy?: Record<string, Id> }`.
- `WorldState.legacyTiles?: Record<string, LegacyTile[]>` and `WorldState.reseed?: string[]` in `types.ts`. These replace the engine's former `legacyTiles` map and `reseed` set (which are removed).
- `Scenario.cells[]` gains an optional `space?: Space`.
- Scenario role strings accept `tile:x,y:space`.
