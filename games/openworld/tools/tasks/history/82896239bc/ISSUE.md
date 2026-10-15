# Ground has height: ramps, cliffs and falls

## What is wanted

The world's ground should have height (world-model.md §5.2, §5.5). Heights are measured in half levels: a level is two, and a column with an odd height is a ramp between two levels. The ground's height should decide where things can walk, what hurts them, what they can see, and how it looks. The summit map (Cloudtop) should use it.

Today every column is at the same height, so there is no way to make a plateau, a ramp, or a cliff, and no way to fall.

## Expected behaviour

**Map data and world queries**
- A map can carry a height for each column (default 0 everywhere). Content chunks can give heights as rows of digits, one digit per column. A map without them behaves as before.
- The world can report the height of any column. Off the map, or where the map gives none, it is 0.
- The world can classify a step from one column to an adjacent one for a given thing:
  - a **walk**, when the height changes by half a level or less in either direction (level ground, a ramp);
  - a **fall** of N levels, when the step goes down by more than half a level (a drop of 2 half levels is 1 level, 4 half levels is 2 levels, and so on);
  - a **climb**, which cannot be made, when the step goes up by more than half a level (a cliff).
  - Things that fly neither climb nor fall: every step is a walk for them.
- The world can also say whether a step is "safe" for path planning: a walk, or a fall no greater than the safe height.

**Movement**
- Walking up or down a ramp, or along level ground, works as before and does no harm.
- Stepping off a ledge moves the thing and it falls. A fall up to the safe height (1 level) does no harm. Beyond it, each additional level hurts the faller by a fixed amount, applied as a blow to itself. With the default parameters (safe fall 1, fall damage 6), a two-level fall costs 6 hp. The player sees a log message on a harmful fall, and a dust effect shows at the landing place.
- Trying to step up a cliff fails: the thing stays where it is, and it bumps into the cell above (the thing that makes up that cell), as it would into any obstacle.
- The safe fall height and the damage per level are world parameters (`safeFall`, `fallDamage`) in the ontology data.

**Planning and sight**
- Path planning for people, creatures, bosses and scene-directed movers only takes walks and safe drops. It never plans a climb or a harmful fall.
- Ground that is higher than both ends of a line of sight blocks that sight.

**Cloudtop (the summit map)**
- The plateau stands two levels (4 half levels) above the land below the cut. At the gap where the pine stands (once the pine is felled), the ground is a ramp stepping down one half level per column: heights 4, 3, 2, 1, 0 at rows 19 through 23 in the pine's column.
- Down and up the ramp is unharmed. Stepping off the cliff elsewhere along the cut is a two-level fall that hurts. The cliff cannot be climbed back.

**Rendering**
- Higher ground is drawn a little lighter. Where ground drops by a level or more, a dark lip is drawn on the edges, with a rock face and its shadow on the ground below it. Ramps show their steps.
- A small durability bar is shown over a cell whose tree or rock has been struck and has lost durability. Any other struck thing that has durability (not only bodies with health) also shows a bar over it. The bar for non-agents is distinct in colour from the health bars of agents.
- To support this, the per-frame tile information carries the cell's current and maximum durability when it has lost some.

## Requirements

- Heights are optional on a map; maps without heights behave exactly as before.
- Content chunks decode a `heights` array of digit strings into the per-column numbers.
- A step is classified as above: up by more than 1 half level is a climb; down by more than 1 half level is a fall of (drop / 2) levels; anything else is a walk. Flyers always walk.
- A successful step that is a fall applies fall harm to the stepping thing after it has moved: `max(0, levels − safeFall) × fallDamage`. No harm is applied for a safe drop.
- A climb attempt does not move the thing and raises a bump against the cell's top thing.
- All path planners (creature, boss, NPC and scene movers) refuse steps that aren't safe steps. The shared path search accepts an optional step-permission check.
- Line of sight is blocked by a column whose height exceeds the greater of the two endpoints' heights by more than one half level.
- The map builder can raise a rectangle of ground to a given height, and writes heights into the chunk only when any are non-zero.
- On the summit, felling the pine opens the ramp described above, and the plateau and cut give the cliff described above.
- The existing tests keep passing.

## Interface

- `MapData.heights?: number[]` in `packages/engine/src/types.ts`: row-major, one entry per column, in half levels.
- `RawMap.heights?: string[]` in `packages/content/src/chunk.ts`: one digit per column in each row string; decoded into `MapData.heights`.
- `WorldParams.safeFall: number` and `WorldParams.fallDamage: number` in `packages/engine/src/types.ts`; the ontology supplies them (defaults 1 and 6), exported from `packages/content/src/ontology.ts` as `SAFE_FALL` and `FALL_DAMAGE`.
- `World.heightAt(map: string, x: number, y: number): number` in `packages/engine/src/world.ts`.
- `World.stepOver(e: Entity | undefined, map: string, ax: number, ay: number, bx: number, by: number): { walk: true } | { fall: number } | { climb: true }` in `packages/engine/src/world.ts`.
- `World.safeStep(e: Entity | undefined, map: string, ax: number, ay: number, bx: number, by: number): boolean` in `packages/engine/src/world.ts`.
- `Engine.fallBy(e: Entity, levels: number, ev?: GameEvent): void` in `packages/engine/src/engine.ts`.
- `astar(...)` in `packages/engine/src/path.ts` gains an optional trailing parameter `step?: (ax: number, ay: number, bx: number, by: number) => boolean`.
- `MapBuilder.heights: number[][]` and `MapBuilder.raise(x: number, y: number, w: number, h: number, half: number): void` in `packages/tools/src/demo/builder.ts`.
- `TileSnap.hp?: number` and `TileSnap.maxHp?: number` in `packages/engine/src/snapshot.ts`.
