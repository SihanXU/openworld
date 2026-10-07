# Building across storeys: what one reaches, and where a thing goes

Agreed and built 2026-10-05 (the defaults of §8 taken). It replaces the "lowest storey with room,
from the one aimed at, upward" rule of `World.settleZ` (world-model.md §5.2, the storeys sections).
How it is built is in §9.

## 1. Why

What one built did not land where one aimed. The engine searched upward for the first storey with
room, so it decided for the player. The aim and the preview sat on the player's own storey, while
the result appeared a storey (one tile) higher. And the first proposal to fix it missed cases
(the ground floor's flooring, the roof over a stairwell). This document starts from the full table
of cases, and every rule below is checked against it (§6).

The user's decisions:
- **Each storey builds its own.** To build the second storey, one goes up the stairs first.
- **The one exception is the ceiling.** A one-storey house needs a ceiling, so it is laid from below.

## 2. References

- **The Sims.** One builds on the level one is viewing. An upper level's floor tiles need walls
  below to hold them, and the roof is its own tool. Level 1's floor tiles cover the ground.
- **RimWorld.** A floor replaces the terrain's surface, and removing it restores the terrain. A
  roof is an area over cells, shown as an overlay on the cells, and needs walls near it. It has
  no storeys.
- **Elin** (decompiled: `Cell`, `AM_Build`, `Map`, `Lot`):
  - Each cell has a ground floor (`_floor`) and at most one raised bridge (`_bridge` at
    `bridgeHeight`), which are separate layers.
  - The recipe's type fixes the layer.
  - Removing a floor turns the cell back to soil, and removing takes the bridge first.
  - Roofs are automatic per room/lot, with nothing placed from below, and are hidden when one is inside.
  - True storeys are separate zones reached by stairs.
- **Taken from them:**
  - A laid floor on the ground covers the terrain (RimWorld, Elin).
  - The kind of thing fixes the slot it takes (Elin).
  - One builds on one's own level (The Sims).
  - The ceiling is shown as an overlay on the cells under it (RimWorld).
- **Not taken:**
  - Elin's building at any height without standing there: the user's decision is otherwise.
  - Automatic roofs: the user wants ceilings laid.

## 3. The model: slots

A cell has, on each storey z:
- **F(z), its floor slot**: what one stands on at storey z. It holds at most one floor.
  - **z = 0:** the terrain fills it. A laid floor covers the terrain; taking the floor away shows
    the terrain again. A floor can be laid only on terrain one can stand on (not water, lava, a
    cliff, or a tree's or rock's own cell).
  - **z > 0:** a laid floor (a slab) fills it, or it is empty (air). A slab needs support: walls
    on storey z − 1 within their `supports` reach (unchanged).
- **V(z), its volume**: at most one solid thing (a wall, door, stairs, a bed, a chest) besides
  bodies and loose items.
  - A thing in V(z) rests on F(z).
  - A wall or door may instead rest on a wall or door in V(z − 1): a taller wall needs no floor
    between its storeys.
- **The ceiling of storey z is F(z + 1).** It is the same slab as the floor of the storey above.

An actor's storey is the z it stands on. One standing on stairs is on the stairs' storey.

## 4. The rules

**R1 Reach.** An actor on storey z reaches exactly F(z), V(z) and F(z + 1), in the cells within its
reach. Nothing on any other storey. This holds for every actor and every act: putting, taking,
E, use. It is a rule of where one stands, not of who one is.

**R2 The kind fixes the slot.**
- A floor goes into a floor slot.
- Everything else (walls, doors, stairs, furniture, items) goes into V(z) of the aimed cell, never
  another storey.
- A thing never searches up or down for room: if its slot is taken, or nothing holds it, it cannot
  go there, and the preview says why.

**R3 Floor or ceiling is chosen, never guessed.**
- A floor goes into F(z) by default.
- It goes into the ceiling F(z + 1) only when the ceiling is chosen explicitly (§5).
- If F(z) is taken, putting a floor there says "there is a floor already". It does not climb.

**R4 What holds what.**
- A thing in V(z) needs F(z), or (a wall, a door) a wall or door in V(z − 1).
- A slab in F(z > 0) needs walls on z − 1 within reach.
- The ceiling over stairs cannot be laid: stairs keep the storey over them open, since one climbs
  through it. The roof over a stairwell is laid from upstairs, as that storey's own ceiling F(z + 2).

**R5 Taking is the mirror of putting.**
- By default F takes what one storey's layers put on top, as now: bodies, loose items, fixtures,
  structures, then the laid floor.
- The ceiling is taken only when chosen explicitly (§5).
- A slab (F(z > 0)) or a ceiling that something rests on directly cannot be taken until that is
  taken first (a wall on it, a bed, an item, someone standing). A floor on the ground can: what
  stood on it stays, on the terrain.
- Taking a wall that holds slabs up still brings down the slabs that lose all support (the
  existing collapse, W12).
- Laying is the gentler side: a floor may be laid under what stands in the cell (it now stands on it).

**R6 Rooms (unchanged).**
- A room is cells walled round and covered.
- Stairs going up through the hole are the room's own.
- What is above the room one is in is not drawn.

## 5. Aim, choice and preview

- **Where one points, it is built and shown** (the user's rule). The pointer is mapped onto the plane
  of the storey being built:
  - building on one's own storey: the plane one stands on (as before);
  - laying the ceiling: the plane a storey up. The cell built is the one whose ceiling is drawn under
    the pointer, the view's `over` (`Aim.over`, as `stack` is the view's).

  A storey up is drawn a tile up, so `over` is the cell south of the one pointed at on one's own plane.
  The preview, the thing built, and the roof seen from outside all stand at the same spot under the
  pointer.
- **Choosing the ceiling:**
  - In the build palette, R toggles a floor entry between *floor* and *ceiling*, as it turns
    stairs, and dragging lays a row of either.
  - A long press on a cell, carrying a floor, lists *lay a ceiling*.
  - G alone lays a floor in F(z).
  - Taking the ceiling is in the long-press list only (*take down the ceiling*). It is never the
    default of F.
- **The preview** shows the thing where it will be drawn:
  - a block as its front and top (two tiles high) at its cell;
  - a floor flat on its cell;
  - a ceiling a storey up: under the pointer.

  Two tries were wrong, and are recorded here:
  - The ceiling was taken over the cell pointed at, and drawn a row up from it: one clicked a cell and
    the ceiling appeared over the one behind it.
  - The preview was then drawn on the cell pointed at while the ceiling still appeared a row up.
- **The labels** say which: "Place wall", "Lay floor", "Lay ceiling", "Take down ceiling".
- **The palette shows one's own storey.** While the palette is open, nothing above one's storey is
  drawn (The Sims' build mode: one edits one level). While one lays ceilings, those over one's storey
  are tinted, translucent, where they are drawn (RimWorld's roof overlay), so they never hide what is
  under them.
- **Under cover, what is above is not drawn.** This holds wherever one stands with something built
  over one's cell: over the covered stretch one stands in, bounded by walls, and round it. A room
  shut in is not needed, so with the door open or a wall missing one still sees in (the ceiling no
  longer covers the bed, the fire, the stairs). From outside, a house shows its upper storey and roof.

## 6. The table of cases

Rows: where one stands, the slot, the act. "ok" means it happens; otherwise, why not.

### 6.1 Putting a floor (default / ceiling chosen)

| Standing on | Target cell state | Default (F(z)) | Ceiling chosen (F(z+1)) |
|---|---|---|---|
| ground (z=0) | standable terrain, no floor | ok: covers the terrain | ok if a wall within reach holds it, F(1) empty, no stairs in V(0) |
| ground | already a laid floor | "there is a floor already" | as above |
| ground | water / lava / cliff / tree | cannot | as above (a slab over water is held by walls, not the water) |
| ground | stairs, a bed, an item in V(0) | ok: laid under them (they now stand on it) | cannot over stairs (they keep it open); ok over the rest |
| slab (z>0) | F(z) empty (air), held | ok: extends the storey (a balcony) | ok if held, F(z+1) empty, no stairs in V(z) |
| slab | F(z) empty, not held | "nothing holds it" | as above |
| slab | F(z) taken | "there is a floor already" | as above |
| on stairs (storey z) | any | as "standing on" storey z | as storey z: the landing above is laid this way |
| any | out of reach | cannot | cannot |

### 6.2 Putting a wall, door, stairs or furniture (V(z) only)

| Target | Wall / door | Stairs | Bed, chest, workbench | Loose item (G) |
|---|---|---|---|---|
| F(z) present, V(z) free | ok | ok, facing chosen (R) | ok | ok |
| F(z) empty, wall/door in V(z−1) | ok (taller wall) | cannot | cannot | cannot |
| F(z) empty, nothing below | cannot | cannot | cannot | cannot |
| V(z) taken (solid) | cannot | cannot | cannot | ok (lies there, as now) |
| a body in the cell | cannot | cannot | cannot | ok |
| the cell one stands in | cannot (solid) | cannot | cannot | ok |

### 6.3 Taking (F)

| Target | Default F | Long press |
|---|---|---|
| an item, a body, a fixture, a structure in V(z) | top first, as now | each listed |
| a laid floor in F(z), nothing on it | when nothing else is there | listed |
| a floor on the ground, something on it (oneself too) | after what is on it | listed: what was on it stays, on the terrain |
| a slab (z>0), something on it (oneself too) | not offered: "take what is on it first" | not offered |
| the ceiling F(z+1), nothing on it | never | *take down the ceiling* |
| the ceiling, something on it (a wall, a bed, someone upstairs) | never | not offered: "something rests on it" |
| a wall holding slabs | ok; the slabs left without support come down (W12) | listed |

### 6.4 E and use

They meet only V(z) and F(z) of one's storey, as now. The ceiling and other storeys are never met.

### 6.5 A two-storey house, start to finish (every step uses R1)

1. On the ground: a ring of walls and a door.
2. On the ground: lay a floor (optional).
3. On the ground: lay the ceiling, held by the walls.
4. On the ground: set stairs; climb.
5. Upstairs: a ring of walls on the slab.
6. Upstairs: lay the ceiling (the roof), and over the stairwell too.

Taking it down is the reverse, step by step. Every step is reachable, and nothing is guessed.

## 7. What changes against what is built

1. `World.settleZ` no longer searches upward. It checks one slot, F(z), V(z) or F(z+1), for
   room and support. `Controls.place`, `previewPlace` and `planPut` take the choice (floor or
   ceiling) as an act param (`params.up`), and the `put` act's `placeFor` reads it. It is data on
   the act, so any actor can use it.
2. `build/stack` ("something put on a built thing goes on top of it") no longer stacks across
   storeys. Putting onto a built thing goes into the same storey's slots: a bed on a floor, a
   wall on a wall only from the storey above.
3. Stacking walls from the ground goes. A taller wall is built from the storey above.
4. The floor set on a stairs cell jumping to z + 2 (PR #37) goes. The ceiling over stairs cannot be
   laid, and the stairwell's roof is laid from upstairs.
5. A laid floor on the ground covers the terrain: no clash with the terrain's floor; it is the
   cell's top surface; taken, the terrain shows again.
6. `Controls.layers` adds the ceiling to the long-press choices only (put and take), never to a default.
7. Tests:
   - `building.test.ts`: walls stacking, the stairwell roof, and a new test per row of §6.
   - `demo.test.ts` W12: the floor over the wall is laid as a ceiling.
   - Any other test that lays floors from below, found by a search when this is built.
8. The client:
   - the preview at the target slot;
   - the R toggle for floor entries;
   - the long-press entries;
   - the ceiling overlay in the palette;
   - the labels.
9. `npm run coverage` after the rule change. world-model.md's storeys section points here.

## 8. Open (with the default taken unless decided otherwise)

1. **A slab or ceiling with something on it.** It cannot be taken until that is taken first.
   (Default: yes. The other way is physics: it is taken and what was on it falls.)
2. **Choosing the ceiling.** The palette's R toggle plus the long press. (Default: yes. The other
   way is two palette entries.)
3. **Floors over water or lava as bridges.** (Default: later.)
4. **Automatic roofs over rooms** (Elin, RimWorld). (Default: no. Ceilings are laid, as decided.)

## 9. As built

- **The open air** is the terrain `tile/air`. `World.get` resolves a cell's floor id on a storey above the
  ground to it when no floor is laid there (`World.airAt`). It is never among a cell's things: it takes
  no space, holds nothing, and is not drawn.
  - `Controls.layers` adds it as the make-up of such a cell.
  - Only F and G meet it (`targets`).
  - Its rule is `core/receive-air`: it takes what is set in it, and where that rests is physics.
  - The coverage table leaves it out (it is never faced on a map).
- **Where a thing rests.** `World.settleZ(e, map, x, y, z)` checks one storey; `World.settleWhy` says why not:
  `taken`, `ground`, `stairs`, `unheld`. The palette's refusals are `REFUSAL` in `controls.ts`.
- **Reach.** `Engine.inReach` lets a put or a take reach the floor slot of the storey above: a laid floor
  or the open air.
- **Choosing the ceiling.** The ceiling is `CEILING` (layer −1) of `Controls.plan` and `choices`: the
  chooser's last entry, never a default. It is the ceiling of `Aim.over` (the cell whose ceiling is
  drawn at the pointer, from `WorldScene.aimAtScreen`), else of the cell aimed at. The build palette's
  `up`, carried by the `build` and `buildAim` messages, toggles with R for a floor; it sends the
  `over` cell as the tile.
- **The dry run is structural.** A move counts as a change whether or not the thing could rest there, so
  `Controls.planOn` checks a put on a cell or a built thing against `settleWhy`, and a take against
  `World.bears`: a floor above the ground that something rests on. The `move` primitive refuses to move
  a floor that bears anything.
- **The client:**
  - the preview where the thing will be drawn (a block two tiles high; a ceiling under the pointer);
  - what is above one's storey hidden under cover (`WorldScene.coveredRound`) and while the palette is open;
  - the palette's ceiling toggle and its line in the details;
  - `WorldScene.setBuildView` while the palette is open (one's own storey; the ceilings tinted where they are drawn while one lays them);
  - the prologue's house hint tells how to lay the ceiling;
  - **the draw order** (`render/depth.ts`, tested in `packages/client/test/depth.test.ts`):
    - by the row a thing stands in, then its storey, then what it is in its cell: the slab, a built block
      or a fixture, what lies loose on it, a body;
    - a floor laid on the ground is part of the ground, under all that stands whatever was made first
      (a floor and what stood on it used to tie, and the order of making decided);
    - a body on the move is ordered by where it is drawn, within a row of its cell;
    - one flying over a building is over its roof;
    - what stands in front of the player and over them (a tree's crown, a lamppost) fades (`WorldScene.fadeOver`),
      as built walls and floors do (`findSeeThrough`).
- **Tests:** `packages/content/test/building.test.ts` ("storeys: what one reaches…"), one test per table
  of §6, and W10, W12 and the tutorial walkthrough laying the ceiling by choice.
