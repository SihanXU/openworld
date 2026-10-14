# Storeys: walls stack, stairs go up one way, and the inputs keep to the storey one stands on

## What is wanted

The engine has a notion of storeys (the `z` of a placement), but three things are missing or wrong:

1. **Walls cannot be stacked.** A wall (or door) set down on a wall in the same cell has nowhere to stand unless a floor lies between. Walls should stack into a taller wall, storey on storey, with no floor between.
2. **Stairs go up in every direction.** Stairs should have a single way up. That way is the direction the one who set them down was facing. Climbing, descending and stepping off should respect it.
3. **The inputs see every storey of a cell at once.** The controls (E, hands, choices, layers) mix in entities from storeys above and below, and the cell's own terrain, whatever storey the player stands on. They should deal only with the storey the player stands on.

## Expected behaviour

### Stacking walls
- With a player on open ground, setting a wall at a cell three times in a row via the build palette succeeds each time. The cell then holds a wall at z=0, a wall at z=1, a wall at z=2, and nothing at z=3.
- A wall or door finds its storey above a wall (or door) that supports (`supports` > 0), without a floor in between.

### Stairs
- Stairs set down via a normal put take the facing of the one who set them. A player facing north who sets stairs one cell north gets stairs facing `'up'`.
- The build palette's place action accepts an optional facing. When given, the player takes that facing before setting the thing down, so stairs placed with `'right'` face `'right'`. (The same optional facing passes through the plan-running path used by place.)
- Stairs without a facing count as going up north (`'up'`).
- Movement, using the example of stairs at (3,3) facing north with a floor laid at storey 1 over (3,2):
  - Walking north onto the stairs from (3,4) puts the player on the stairs at (3,3), z=0.
  - Walking north again takes the player up to (3,2) at z=1.
  - Walking south from there goes back down onto the stairs at (3,3), z=0, because one descends onto stairs only from their top.
  - Stepping east off the stairs lands at (4,3) on the ground, z=0. Off the foot or sides of stairs, one stays on the storey.
- Going up from stairs only works moving in the stairs' facing direction. Going down onto stairs from a higher storey only works moving opposite to their facing (from their top).

### Inputs and storeys
- The set of layers for a cell contains only entities on the storey the player stands on (z defaults to 0), on the right map.
- Covering things (a tent, a place on the overworld) and the cell's own terrain make-up count only on the ground storey. Above ground they are left out.
- Structures (anything tagged `structure`) form their own group in the order of layers: after what stands there (bodies, loose things, other fixtures), before the cell's terrain make-up. Among structures, a wall comes before the floor laid in that cell. Structures are not counted as loose, portable things.
- Example 1: a wall at z=0 with a floor at z=1 over it. The player on the ground at that cell, with the floor in the view's stack on top, gets the wall as the target for hands, and the floor is not among the choices.
- Example 2: the player standing at z=1 on that floor sees layers `[player, floor]` only. The grass below is not a layer.

## Requirements

- Wall and door stacking as above; `World.settleZ` places them on a supporting wall/door one storey below even with no floor.
- Stairs record the facing of their setter when set down on a tile, via the same `move` mechanism used for put; a setter without a facing leaves the stairs unchanged.
- Stairs' facing governs climbing (only in that direction), descending onto stairs (only from the top side), and leaves movement off the foot or sides on the same storey.
- `Controls.place` and `Controls.run` accept an optional facing, applied to the player before the action runs.
- `Controls.layers` filters by the player's storey, drops covering things and terrain make-up above ground, and orders structures as described.
- Existing behaviour for ground-level play, with no stairs or upper storeys involved, is unchanged.

## Interface

- `Controls.place(type: string, aim: Aim, facing?: Dir): boolean` in `packages/engine/src/controls.ts` (new optional third parameter).
- `Controls.run(plan: Plan, confirmed?: boolean, facing?: Dir): { panel?: Id }` in `packages/engine/src/controls.ts` (new optional third parameter).
- No other new names. Stairs use the existing `facing` field on entities, and `Dir` is the existing direction type (`'up' | 'down' | 'left' | 'right'`).
