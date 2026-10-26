# Pointer aiming: a far pointer clamps toward itself, and one's own picture is one's own place

## What is wrong

How `Controls` decides where a key acts, when the pointer is on the map, has several faults.

1. **A pointer beyond every input's reach falls back.** The pointer may be farther than any input can act. Then the keys, and the left click ("use") especially, act on the place in front of the player, or on the player, or do nothing. The pointer's direction is lost.
2. **The player's own picture counts as the tile behind it.** The player's head is drawn over the tile behind them. A pointer on that picture is treated as pointing at that other tile. It should mean the player's own place. E and F there should meet what lies at the player's feet (for example berries), not what is on the tile behind.
3. **The view's cells of a tile are put before what stands on it.** A tile's own cells, such as its volume, come in the pointer's stack. They are met before the things standing on that tile, so berries underfoot are hidden by the tile's own growth.
4. **The E fallback to one's own place is applied too widely.** It is meant for when no spot is pointed at. It also fires in cases where the spot is the pointer's own.

## Expected behaviour

- **Pointer within some input's reach:** unchanged. The spot is the pointed one.
- **Pointer beyond every input's reach:** the aim is the farthest spot, stepping back along the straight line from the player to the pointer, that some input reaches. This holds for every key, including the left click.
  - Rounding of halves goes away from the player, the same on every side.
  - If no spot along the line is reached, the aim is the player's own place.
  - Example, with a bow in hand (it carries along rows and columns) and a slime far down the column:
    - A pointer at (2,30) straight down aims at x=2 and a y well past the player's neighbours, in line with the bow's reach.
    - A pointer off the line, such as (9,7) with the player at (2,2), aims at (3,3), the next spot toward it.
    - A pointer at (-5,2) along the row aims at (0,2), as far as the map goes.
    - None of the plans for E, F or the left click at such a pointer targets the player.
  - Example, with nothing in hand: the left click at a pointer 2 cells away aims at the neighbouring spot in line, and targets what is there (an NPC, say), not nothing.
- **Pointer on the player's own picture:** a pointer whose stack begins with the player is the player's own place, even if its x,y is the tile behind. E there meets the top layer at the player's feet (berries), not the tile behind.
- **Stack ordering:** the view's cells belonging to the very tile being planned come under what stands on it, never before it. Berries underfoot are met before the tile's own volume cell, even when that cell is drawn first in the stack.
- **No pointer:** the aim is still the place in front.
- **Self key:** unchanged. The right click is always on oneself.
- **E fallback:** the E fallback to one's own place (when the spot has no answer of its own and the player's place does) applies only where the aimed spot is not the pointer's own. A pointed spot, whether reached directly or the player's own picture, does not trigger it. A clamped spot, or the place in front, still does.
- **Client keys view:** the client's "self" key view treats the player as aimed at when the pointer's resolved aim is the player's own place, not merely when the raw pointer tile equals it.

## Requirements

- A pointer beyond all reach never falls back to the place in front, to nothing, or to the player (unless nothing along the line is reached).
- The left click no longer returns no plan merely because the pointer is out of reach. It acts on the clamped spot.
- A pointer whose stack starts with the player resolves to the player's own position for every key except where `self` already does.
- A tile's own view cells are ordered after the entities standing on it when building the stack of things the keys meet. Cells of other tiles keep their current order.
- The E own-place fallback is skipped whenever the aim is the pointer's own spot.
- The client's `self` view uses the resolved aim position to decide whether the player is aimed at.

## Interface

`Controls.aim(at?: Aim, key?: Key)` in `packages/engine/src/controls.ts` has a new return type: `{ at: Pos; stack?: Ref[]; pointed?: boolean } | undefined`.

- `pointed` is `true` when the aimed spot is the pointer's own: the pointed spot is reached, or the pointer is on the player's own picture. It is absent or false for a clamped spot, the place in front, and the `self` key.

No other new names.
