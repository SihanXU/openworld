# Build palette: with none carried, a made wall may go on a wall, a floor over walls; R turns what is set down

## What is wrong

Two things in the build palette (the construction mode where a thing is set down on an aimed cell):

1. **Stacking is refused when none is carried.** When the player carries none of a thing but could make one from what they carry, the preview only asks whether the aimed cell is solid. A wall on a wall, or a floor laid over walls, is therefore refused as "It cannot go there.", even though the same thing, if carried, would be set on the storey above. The preview should instead ask the world where a thing of that kind would come to rest.

2. **There is no way to turn what is set down.** Stairs go up one way (the way their setter faced), but the palette gives no means of choosing that way. Unturned, a thing set down faces away from the player.

## Expected behaviour

- Player carrying planks (no wall in hand) with the palette aimed at a cell:
  - Setting a `structure/wall` on an empty cell makes one from the planks and places it on the ground storey (returns `true`).
  - The preview for a wall on that cell, now holding a wall, reports `ok`.
  - Setting a wall on that cell again succeeds, and the wall stands on storey 1 on top of the first.
  - On a cell holding a wall, making and placing a `structure/floor` succeeds, and the floor is on storey 1 over the wall.
- The preview's decision of whether a made thing can go to an aimed cell uses the same rule as for a carried thing: the cell must be within reach, and the world must find a storey where a thing of that kind comes to rest. It is no longer refused simply because the cell contains a solid thing.
- Out-of-reach cells, out-of-bounds cells, and cells where nothing of that kind can rest are still refused, with the existing "It cannot go there." reason.
- **R in the palette** turns what is set down clockwise (up → right → down → left), starting from the way it would face now (away from the player toward the aimed cell). The chosen facing is sent along with the build request and passed to `Controls.place`, which uses it as the way the placed thing faces (for stairs, the way up). Without a turn, behaviour is as before. Closing the palette clears the turn.
- When stairs are selected, the ghost shows an arrow for the way up and the detail panel says that R turns it.

## Requirements

- The made-thing preview asks the world's settling logic (`World.settleZ`) with a thing that is not in the world, instead of testing whether the cell is solid.
- Stacking a wall on a wall and a floor over walls works through the palette when none is carried.
- `Controls.place` accepts an optional facing; omitted, behaviour is unchanged.
- The `build` message from client to worker carries an optional facing, which the worker passes to `Controls.place`.
- R is handled while the palette is open (not repeated on key hold) and does not affect other keys.
- The arrow and the R hint appear only for stairs.
- Existing tests keep passing.

## Interface

- `Controls.place(type: string, tile: { x: number; y: number }, facing?: Dir): boolean` — in `packages/engine/src/controls.ts`; the new optional third parameter is the facing.
- `ToWorker` `build` message in `packages/client/src/protocol.ts`: gains an optional `facing?: Dir`.
- `BuildingMode.rotate(): void` and `BuildingMode.facing?: Dir` — in `packages/client/src/ui/building.ts`.
