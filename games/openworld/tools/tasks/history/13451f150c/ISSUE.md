# Buildings from the build palette can't be placed inside a house (on a laid floor, or upstairs), and a set-down bed is drawn as half a bed

## What is wrong

1. **Nothing can be built in a house.** The build palette's buildings (wooden chest, campfire, crate, fence, sign) require the target cell to be empty. A laid floor counts as "something there", so on any cell with a floor the placement is refused with "This tile is occupied". Two further obstacles lie behind that check:
   - Site selection only accepts bare ground, not a floor.
   - The first step of each building's recipe only accepts the "receive onto ground" rule. Putting a thing on a floor is handled by the `build/stack` rule, so that step fails on a floor.

   In addition, when the builder stands upstairs, placement still looks at and builds on the ground storey (z = 0) rather than the storey the builder is on.

2. **A set-down bed is drawn as half a bed.** A carriable fixture (such as a bed) that has been put down is treated as a loose item and drawn with its one-tile bag icon, so only the head of the bed shows. The build-mode preview draws the full two-tile bed, so the two disagree.

## Expected behaviour

- A floor laid in a cell is part of the cell, like the ground. Each of the five buildings can be built on a cell with a floor. The result stands on the floor, at the same storey (z 0 for a ground-level floor), and the floor is still there afterwards.
- A flyer over the cell (for example the fairy companion) does not block building. Anything lying or standing there (for example a stick on the floor) still blocks it, and the placement is refused.
- Building happens on the builder's own storey. A builder standing on a floor at z = 1 builds on the floor at z = 1 in the target cell. Nothing is built on the ground (z = 0) under it. This holds even with a fairy over the target cell. A successful placement reports "Done."
- A building is only accepted on a floor where the built thing could rest there, according to the world's settling/physics check.
- The first material of each of the five buildings can be set down either on open ground or stacked on a floor.
- A carriable fixture, once set down, is drawn as its own full fixture appearance in the world scene, not as its bag icon. Other portable items keep their icon.

## Requirements

- Placement planning and the rehearsal of the steps both use the storey of the builder (or of the target position if one is given), not always the ground.
- A thing counts as a laid floor only if it is not terrain and all of its spaces are floor.
- Floors and flyers (entities tagged airborne) are ignored by the "must be empty" check. Other non-terrain things still block it, and agents are handled as before.
- A refused placement leaves the world state unchanged.
- Existing ground-level building, farming and other placements behave as before.
- The set-down check for every palette building's first step accepts both `core/receive-ground` and `build/stack`.
- In the scene, portable entities whose type starts with `fixture/` are drawn via their fixture definition once set down.

## Interface

None
