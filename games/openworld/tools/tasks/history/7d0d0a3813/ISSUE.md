# Cover and rooms: rain only under the sky, rooms derived from walls and roofs, and a night's sleep

## What is wanted

Step W5 of the world model: the world should know which cells are covered, find rooms from the structures built, give rooms roles from what is inside them, and let an actor sleep.

1. **Cover.** A cell is covered when something on a higher storey takes its floor or its volume (a floor laid over it, a roof). A map that is not outdoor (a cave, a house interior) is covered everywhere. Whether a thing is "outdoors" is decided per cell, not per map.
2. **Rain only under the sky.** Weather that wets (rain, storm) should reach only things out under the sky. Something in a covered cell stays dry.
3. **Rooms.** Rooms are derived, not stored. On each storey, a room is a largest connected set of standable, covered cells that flooding cannot leave: walls all round, no door needed. It may not exceed a configured maximum size. A room is a region-like thing, and a thing standing in one is "in" that region through the same in-region relation as authored areas.
4. **Roles.** A room's roles come from what is in it. A bed makes it a bedroom, a cooking fire (cookware) a kitchen, a craft fixture (workbench, forge) a workshop, three or more containers a storeroom. A bedroom gives a night's sleep a full rest.
5. **Sleep.** An actor can sleep. Sleeping gives back missing health in proportion to the best rest among the regions it lies in, or a default fraction outside any room that says more. For the actor at the keys, time passes to the rise hour at once, as in a fast-forward. Harm (e.g. starving) wakes it. Taking hold of a bed makes the actor lie down and sleep. The existing restore effect gains a "sleep" kind.

## Expected behaviour

- A one-cell spot with four walls around it and a floor laid over it is covered and is a room of size 1. Standing in it, the cell's regions include a room of type `region/room`. Without the floor over it, or with a wall missing, it is not a room.
- A bed placed in that room gives the room the tag `role:bedroom`; before the bed, it lacks it. Roles are read from the contents every time, so adding or removing things changes them at once.
- The player, hurt and not starving, takes hold of the bed at 22:00. After the next tick the player's health is full and the hour is 6. Outside a bedroom, a sleep gives back only about half of what is missing (rounded up), never more than is missing.
- A room can be looked up by its id (`room.<z>.<x>.<y>.<map>`, where x and y are the room's top-left-most cell; map ids may contain dots), and the lookup returns a `region/room` thing. Real stored things take precedence over this lookup.
- After a wall of the room is destroyed, the room no longer exists, but the cell is still covered.
- During rain, a hen standing outside becomes wet. The player standing in the built room does not.
- A room is larger than the limit → not a room (it counts as out of doors). Rooms found are cached and recomputed when a cell's spaces change (a wall built, a floor laid, a tree felled, a thing transformed).

## Requirements

- Covered status is available as a world query, and the "outdoors" condition on a thing with a place means "its cell is not covered". For the story or the world (no place), it falls back to whether the player's map is outdoor.
- The emission target "everything on the map" accepts a sky option restricting recipients to things whose cells are not covered. The rain/storm weather rule uses it.
- Rooms are exposed as a world query per map, and appear among the regions at a cell on a given storey. Regions at a cell take an optional storey, which defaults to the ground, and the in-region relation uses the thing's own storey.
- Area places may carry a storey.
- The ontology defines a room type, a maximum room size (256), a rise hour (6), a default rest (0.5), and the room roles above, with a bedroom's rest being 1. Roles may need a type, tags, or a count, and may carry props. When several roles give the same numeric prop, the largest wins.
- A new `sleep` effect primitive exists, with documentation in the primitive list. Sleeping adds a log line (a soundly-rested one for a full rest, otherwise a weaker one). Only the player's sleep fast-forwards time.
- The restore rule handles `which: sleep`, and a rule on beds responds to being handled by logging a line and emitting a sleep restore to the actor.
- The documentation of the in-region contact event mentions rooms.
- Existing behaviour is otherwise unchanged. Typecheck and the existing tests continue to pass.

## Interface

- `World.covered(map: string, x: number, y: number, z?: number): boolean` in `packages/engine/src/world.ts`.
- `World.roomsOf(map: string): Entity[]` in the same file. Each is of type `region/room`, with `props.size`, tags `role:<role>`, and an `area` place (with `z` for storeys above ground).
- `World.regionsAt(map, x, y, z?)`: gains an optional storey argument.
- `Place` area variant gains an optional `z?: number` (`types.ts`).
- `WorldParams` gains `roomSize?: number`, `riseHour?: number`, `rest?: number`.
- `Ontology.roomRoles?: { role: string; needs: Selector; count?: number; props?: Record<string, PropValue> }[]`.
- `EmitTo` map variant becomes `{ map: true; sky?: boolean }`.
- `Effect` gains `{ op: 'sleep' }`.
- `Engine.sleepUntil(hour: number): void` in `engine.ts`.
- `ROOM_SIZE` constant (256) exported from `packages/content/src/ontology.ts`.
- New type id `region/room` in the content ontology.
- New rule id `bed/sleep` (host: `fixture/furniture/bed`, on `impulse/handle`); the `core/restore` rule handles `which: 'sleep'`.
