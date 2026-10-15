# People holding still for someone who faces them are pushed out of their place, and pushed-aside walkers keep a stale path

## What is wrong

In the NPC sandbox, two people (e.g. Ilse and Vigo by the well) can trade places over and over for hours:

- The person in the cell the player is facing holds still for the player (they are "attended").
- Another person on their way pushes into that cell and swaps with them. The one who was holding still is now displaced, and then holds still in turn.
- The person who was pushed out keeps walking with a path that now starts two cells away from them rather than beside them, and pushes straight back into the cell. The cycle repeats.

Two defects cause this:

1. A person holding still for the one who faces them can be swapped out of their cell by another person on their way.
2. A path whose first step is no longer adjacent to its walker (because they were made to step aside) is still followed instead of being planned again.

## Expected behaviour

- When the player faces a person and that person holds their round for the player (attended), another person walking into that cell does **not** swap with them. The one holding still keeps their place, and the walker is blocked and has to go round.
- The player can still swap places with that person by pushing on into them, as before.
- Swapping between two people on their way, where the one pushed into is free (not attended, not busy), still works as before.
- When a walker's stored path has a first step that is not exactly one cell (Manhattan distance) from the walker's current position, the path is discarded and planned again. This applies to:
  - the schedule goal (the movement towards a scheduled place), and
  - the people's own goals (the NPC simulation's goal movement).
- A path whose first step is adjacent is kept and followed as before.

Example: the player stands at the well facing Cass, who is directly below and facing up. After a couple of ticks Cass holds still. Gus, to the left of Cass and facing her, steps into her repeatedly (10 times). Cass stays in her cell. Then the player pushes down into Cass repeatedly and within 12 attempts ends up in her cell's row (swapped).

## Requirements

- A person who is attended (held still for someone facing them, with the attended counter above 0 and within the attend limit) is not swapped out of their cell by a non-player mover. The mover is blocked as it would be by any non-yielding obstacle.
- A person who is not attended, and is not busy, can still be swapped with by the player or by another person.
- The player can swap with an attended person.
- A person who has not been attended is not reported as holding still.
- Stale paths (first step not adjacent to the walker's current cell) are cleared and re-planned in both the schedule goal movement and the NPC goal movement.
- Existing behaviour for adjacent-start paths and for goal changes is unchanged.

## Interface

- `NpcSim.holding(e: Entity): boolean` in `packages/engine/src/npc.ts`, reachable as `engine.npcs.holding(entity)`. Returns true when the person is holding their round for one who faces them: attended counter greater than 0 and not beyond the attend limit. Returns false for a person with no runtime state or who is not attended.
