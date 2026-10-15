# The left click builds: a built thing or fixture in hand is set down where one clicks (a row when dragged), and R lays a floor in the ceiling

## What is wanted

G is the "put" that drops a thing. Building should live on the mouse, as in most building games. It belongs on the left click, because the right click here is "use on oneself" (eat, drink, put on).

With a built thing (a wall, a floor, a door, stairs) or a fixture (a bed, a workbench) in hand, the left click ("use") should set it down at the clicked spot, exactly as G's put would set it down. The physics is G's: the cell receiving it decides whether it takes it or refuses, and no AI is asked.

Today, left-clicking with such a thing in hand is only an experiment for the world to learn. It should build on open ground, on a floor, on something already built, and (for a floor) in the ceiling over the spot.

The client should support this:
- A press builds at once, with no long-press chooser.
- Holding and dragging builds one in each new cell entered, and only where something can be set down.
- With a floor in hand, R switches the left click to laying the ceiling, and back.
- The thing in hand shows a translucent ghost under the pointer, where it will be drawn.

## Expected behaviour

- With a wall in hand, the left-click plan on open ground is a plan that sets, is not an unknown experiment, and running it puts a wall in that cell. It stands on the ground storey only, with nothing in the storeys above.
- With a floor in hand, left click on open ground lays a floor. With a bed in hand, left click on that floored cell puts the bed on it, so the cell holds both the floor and the bed.
- With a floor in hand, the choices for the left click on a cell (the chooser's list) end with the ceiling layer. Using the left click on the ceiling layer over a wall lays a floor in the storey above, held up by the wall.
- Still an experiment (unknown outcome, not marked as setting):
  - a wall in hand used on water;
  - a stick or other non-built item in hand, including on a tree or a person.
- A non-built item in hand gets no ceiling option in the left click's choices.
- A thing swung as a blow (attack) is not set down.
- The reach over one's head counts for the left-click use as it does for G's put and take.
- A tutorial lesson's `only` (what may be put) and `cells` (where) narrow the left click's setting as they narrow G.
- While dragging, a cell that is not settable (a tree, a person) does nothing; it never triggers an experiment.
- The key table, the tutorial's house hint and the docs describe the new controls.

## Requirements

- Two rules, one for a held structure and one for a held fixture, apply to the left click on open ground (not solid, not liquid), a floor, or what is built. They hand the held thing to the target cell as G's put does (the cell's ground, stacking and air-receiving behaviour apply). In the water, on a tree or person, or swung as a blow, they defer to the held thing's ordinary behaviour (the experiment).
- A plan that results from a cell receiving what is held is marked as setting.
- The left click's targets include the open air and the ceiling only when what is held is a built thing or fixture.
- The left click's reach over one's head is counted as for put and take.
- The lesson filter for the left click applies `only` and `cells` as it does for put.
- A running plan that sets goes through the lesson filter with the held type and position.
- The client sends a drag as a key press flagged as a drag, which the worker honours only if the plan sets. The worker also receives whether the ceiling mode (R) is on, and the plan for the left click uses the ceiling layer when it is.
- The key-view the frame carries for a key says when it sets, so the client can skip the chooser and show the ghost.
- Pressing R with a floor in hand toggles ceiling mode. It is dropped when something other than a floor is in hand, or when the build palette opens or closes. In ceiling mode the view shows one's own storey and marks the ceilings, as the palette does.
- All existing behaviour of G, right click, and the palette is unchanged.

## Interface

- `Plan.sets?: boolean` in `packages/engine/src/types.ts`: true when the plan sets what is held down at the aimed spot (the cell takes it).
- `KeyView.sets?: boolean` in `packages/engine/src/snapshot.ts`: the same, carried in a frame's key views.
- Rule ids `use/set-structure` and `use/set-fixture` in `packages/content/src/rules.ts`, hosted by a held structure and a held fixture, on `act/use`.
- Client protocol (`packages/client/src/protocol.ts`):
  - `ToWorker` gains `{ t: 'handUp'; up: boolean }`.
  - The `key` message gains an optional `drag?: boolean`.
- `BuildingMode.hand(up: boolean): void` in `packages/client/src/ui/building.ts`: shows the held thing's ghost when the left click sets.
- `Controls.plan('use', tile, layer)` and `Controls.choices('use', tile)` accept the `CEILING` layer when a built thing is in hand (existing signatures, new behaviour).
