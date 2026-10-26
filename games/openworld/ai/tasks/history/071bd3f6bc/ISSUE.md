# Build the tutorial as a day and a night in a clearing, with the foot of the mountain as the world's own start

## What is wrong (for a fix) or What is wanted (for a feature)

The tutorial is currently a stub: a bare 20x14 plot of grass, peaceful, with no portal and nothing in it, and it is the world's default start. The prologue has no steps before the foot of the mountain (stage 9). A new game should instead play a real tutorial, then go down to the foot.

Wanted:

1. **The Clearing** (map id `tutorial`, 36x26): a clearing ringed by forest, with a grove of trees on its east side. Berries, sticks, stones and grass lie about at the start and keep turning up again. It is a combat zone, so the night's dead walk it. Its one way out is the path south at the bottom edge, a portal to the map `foot` that stays shut until the story fact `TUTORIAL_OPEN` is set. Nothing leads back into it, and it lies on no cell of the overworld (it is played once).
2. **The tutorial steps** (prologue stages 1–8), each spoken by Pip and each with an objective title and a hint saying how:
   1. Come round (the player starts out cold). Once awake and in the tutorial map, the stage becomes 1.
   2. Eat (the player has eaten a meal) → stage 2.
   3. Gather a stick, a stone and some grass → stage 3.
   4. Make a stone axe → stage 4.
   5. Fell a tree and split planks (carrying a plank) → stage 5.
   6. Light a campfire (a lit campfire nearby) → stage 6.
   7. Build a house with a bed, meaning a room that counts as a bedroom → stage 7.
   8. Get through the night. On the first morning after the house is built, the stage becomes `TUTORIAL_DONE` (8) and `TUTORIAL_OPEN` is set, which opens the way out.
   - Walking onto the exit area before the tutorial is done makes Pip say it is not yet time (the way is shut anyway).
   - Arriving at the map `foot` once the tutorial is done sets the stage to `PROLOGUE_AT_FOOT`, and Pip says a line.
3. **Starts.** The world's own default start becomes the foot of the mountain, at the stage `PROLOGUE_AT_FOOT`, so a game created without a named start has no tutorial. The tutorial becomes a named start called `tutorial`: the player begins in the clearing at 07:00, out cold. The cover (title screen) menu's "new game" with the tutorial option on, which is the default, must start with the named start `tutorial`. With the option off it passes no named start. The old named start `skip` goes away.

## Expected behaviour

- A game created with start `tutorial` begins in map `tutorial` at the clearing's spawn point, at hour 7, with the player out cold and the prologue stage 0. After a short while the player comes round and the stage becomes 1.
- The player can play through the whole tutorial using normal player inputs: take and eat berries; pick up sticks, stones and grass; craft a stone axe; fell trees in the grove and split the logs into planks; build a campfire and light it with a torch; build a house round themselves (bed underfoot, walls and a door round, a floor overhead); and survive the night. Nightborn walkers appear in the clearing at night, and with the door shut they do not hurt the player. Sleeping in the bed through the night brings the first morning (day 2), the stage reaches `TUTORIAL_DONE`, and `TUTORIAL_OPEN` is set.
- Before that, standing on the exit's edge cells at the bottom of the map does not take the player out, and Pip's "not yet" line is seen. After it, walking south off the exit takes the player to map `foot` at the arrival cell, the top of the foot's trail. The stage then becomes `PROLOGUE_AT_FOOT` and Pip is on the `foot` map.
- No map's portals lead to `tutorial`. The map has no overworld position, and the loaded map has no `site`.
- A game created with no named start begins on the map `foot` at the arrival cell, with stage `PROLOGUE_AT_FOOT`, not out cold, and Pip beside the player.
- The existing prologue from the foot to the Ford still works when started without a named start.

## Requirements

- The tutorial map is 36x26, named "The Clearing" (with a Chinese name), a combat zone rather than a peaceful one, ringed by trees except for the exit path, with a grove in the east. Trees are placed so that felling three of the grove trees is possible.
- The initial placement of berries, sticks, stones and grass is enough for the whole tutorial: enough of each to make the axe, eat, and build the campfire. Berries in particular keep reappearing on grass cells, so the player can eat their fill before the night. The usual ground yield also applies.
- The exit is a two-column-wide path running south to the map's bottom edge. Each column has a portal to `foot`, gated on the fact `TUTORIAL_OPEN`. The two portals land on adjacent cells at the foot's arrival point. A named region `exit` covers the end of the path and is used for the "too soon" line.
- The step conditions use the existing beat machinery: the map, statuses, props, facts, carried items, nearby lit campfire, room kind, and "morning after" another beat.
- The stage constants, the story fact and the objectives are exported from the content package. Objectives exist for stages 1–8 (with English and Chinese titles and hints) alongside the existing ones for the foot.
- The world's start is the foot at the arrival cell. The default (no named start) sets the prologue stage to `PROLOGUE_AT_FOOT`. The named start `tutorial` places the player in the clearing at hour 7 with the `out_cold` status, with enough duration for the first step to be seen.
- The foot map's anchor for the old skip start is renamed to match the new arrival role.
- The cover's comments and behaviour match the new start naming.

## Interface

In `@lsw/content` (`packages/content/src/prologue.ts`):

- `export const TUTORIAL_OPEN = 'tutorial.open'`, the story fact that opens the tutorial's way out.
- `export const TUTORIAL_DONE = 8`, the tutorial's last stage.

In `packages/tools/src/demo/prologue.ts`, the `TUTORIAL` constant (existing name, new fields and values):

- `size: [36, 26]`
- `spawn`: where the player comes round, in the clearing.
- `exit`: the x columns of the two-wide exit path (an array of two numbers). Replaces the previous `skip` field.
- `arrive`: `[20, 1]`, the cell at the top of the foot's trail where the player comes out (and where a game without the tutorial begins). Replaces `skip`.
- `berries`, `sticks`, `stones`, `grass`: arrays of `[x, y]` for the starting items.
- `grove`: an array of `[x, y]` for the trees of the east grove.

The named start `tutorial` is a key in the world's `starts`, and the world's own start is the foot.
