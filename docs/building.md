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

**R5 Taking down is the mirror of building** (since 2026-10-21 a tool's: design.md §5.2).
- A tool (an axe, a pickaxe, a hammer) swung at what is built knocks it loose whole (`loosen`): it lies packed
  where it stood, to be picked up (E, or the magnet). The swing meets the top of one storey's layers, as now:
  fixtures, structures, then the laid floor (the chooser for what is under).
- The ceiling is knocked loose only when chosen explicitly (§5); it comes down whole to the storey below.
- A slab (F(z > 0)) or a ceiling that something rests on directly cannot be knocked loose until that is
  taken first (a wall on it, a bed, an item, someone standing). A floor on the ground can: what
  stood on it stays, on the terrain.
- Knocking loose a wall that holds slabs up still brings down the slabs that lose all support (the
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
    stairs, and dragging lays a row of either; with a floor in hand, R turns the right click to the ceiling.
  - The chooser on a cell (Alt with the right click), carrying a floor, lists *lay a ceiling*.
  - The right click alone lays a floor in F(z); G puts a floor down loose, never laying it.
  - Knocking the ceiling loose is in the chooser only (Alt with the left click, a tool in hand). It is never a
    swing's default.
- **The preview** shows the thing where it will be drawn:
  - a block as its front and top (two tiles high) at its cell;
  - a floor flat on its cell;
  - a ceiling a storey up: under the pointer.

  Two tries were wrong, and are recorded here:
  - The ceiling was taken over the cell pointed at, and drawn a row up from it: one clicked a cell and
    the ceiling appeared over the one behind it.
  - The preview was then drawn on the cell pointed at while the ceiling still appeared a row up.
- **The labels** say which: "Set Wall down", "Lay floor", "Lay ceiling".
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

### 6.2 Setting up a wall, door, stairs or furniture (V(z) only)

Set up with the right click or the palette; anything put down with G lies loose (the last column).

| Target | Wall / door | Stairs | Bed, chest, workbench | Loose (G) |
|---|---|---|---|---|
| F(z) present, V(z) free | ok | ok, facing chosen (R) | ok | ok |
| F(z) empty, wall/door in V(z−1) | ok (taller wall) | cannot | cannot | cannot |
| F(z) empty, nothing below | cannot | cannot | cannot | cannot |
| V(z) taken (solid) | cannot | cannot | cannot | ok (lies there, as now) |
| a body in the cell | cannot | cannot | cannot | ok |
| the cell one stands in | cannot (solid) | cannot | cannot | ok |

### 6.3 Knocking loose (a tool's left click; what lies loose E picks up)

| Target | A press | The chooser (Alt) |
|---|---|---|
| a fixture or a structure that can be carried, in V(z) | top first | each listed |
| a laid floor in F(z), nothing on it | when nothing else is there | listed |
| a floor on the ground, something on it (oneself too) | after what is on it | listed: what was on it stays, on the terrain |
| a slab (z>0), something on it (oneself too) | not offered | not offered |
| the ceiling F(z+1), nothing on it | never | *the ceiling*: it comes down whole |
| the ceiling, something on it (a wall, a bed, someone upstairs) | never | not offered |
| a wall holding slabs | ok; the slabs left without support come down (W12) | listed |

### 6.4 E and use

They meet only V(z) and F(z) of one's storey, as now. The ceiling and other storeys are never met, but by the
chooser's ceiling (a floor laid, or knocked loose).

### 6.5 A two-storey house, start to finish (every step uses R1)

1. On the ground: a ring of walls and a door.
2. On the ground: lay a floor (optional).
3. On the ground: lay the ceiling, held by the walls.
4. On the ground: set stairs; climb.
5. Upstairs: a ring of walls on the slab.
6. Upstairs: lay the ceiling (the roof), and over the stairwell too.

Taking it down is the reverse, step by step, with a tool. Every step is reachable, and nothing is guessed.

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
  - Only G and the right click with a built thing in hand meet it (`targets`).
  - Its rule is `core/receive-air`: it takes what is set in it, and where that rests is physics.
  - The coverage table leaves it out (it is never faced on a map).
- **Where a thing rests.** `World.settleZ(e, map, x, y, z)` checks one storey; `World.settleWhy` says why not:
  `taken`, `ground`, `stairs`, `unheld`. The palette's refusals are `REFUSAL` in `controls.ts`.
- **Reach.** `Engine.inReach` lets a put, a take or a use reach the floor slot of the storey above: a laid
  floor or the open air.
- **Choosing the ceiling.** The ceiling is `CEILING` (layer −1) of `Controls.plan` and `choices`: the
  chooser's last entry, never a default. It is the ceiling of `Aim.over` (the cell whose ceiling is
  drawn at the pointer, from `WorldScene.aimAtScreen`), else of the cell aimed at. The build palette's
  `up`, carried by the `build` and `buildAim` messages, toggles with R for a floor; it sends the
  `over` cell as the tile.
- **The dry run is structural.** A move counts as a change whether or not the thing could rest there, so
  `Controls.planOn` checks a put, or a use that sets a thing up, on a cell or a built thing against `settleWhy`,
  and a ceiling knocked loose against `World.bears`: a floor above the ground that something rests on. The `move`
  and `loosen` primitives refuse to move a floor that bears anything.
- **What turns** (2026-10-08): the tag `turns` (stairs, stakes, a fence). Set down (the `move` effect)
  or become (the `transform` effect) where it lies, it faces the way the one who made it faced: its front
  toward them (stairs go up away from them, a fence runs across their way). By hand one faces the cell
  one builds; the palette's R turns the builder (`performPlacement`'s `facing`, `Controls.place`). A
  fence facing east or west is drawn across (the catalogue's `across`); the ghosts show the arrow.
- **The back of stairs** (2026-10-08) is their high end, a storey of block: on their storey one bumps
  into it from the cell behind and does not walk off their top into that cell (`Engine.stepSelf`).
  Stairs that hide the player fade, as a statue does (`WorldScene.fadeOver`).
- **The right click builds** (2026-10-08 the left click, after the user: G is the put that drops a thing, building
  belongs on the mouse as in every building game; 2026-10-21 the right click, the held thing's use on the aim,
  design.md §5.2). A built thing or a fixture in hand, used on open ground, a floor or what is built there, is set
  up there: the rules `use/set-structure` and `use/set-fixture` (hosted by what is held) hand it to the cell with
  `build`, which takes it as it takes G's put (`core/receive-ground`, `build/stack`, `core/receive-air`), so the
  physics is the same — but it stands, where what G puts lies loose. Anywhere else (the water, a tree, a person),
  or swung as a blow, it stays what its nature says: an experiment. On one's own place it is set up under one
  where it can stand with one (a bed).
  - The plan says it sets (`Plan.sets`, the frame's `KeyView.sets`: the answer is a cell taking it), and is
    offered only where it changes something and the thing could rest there. The right button acts on the press
    and, held and dragged, in each new cell, only where it sets (the worker's `drag`).
  - R with a floor in hand lays it in the ceiling (`CEILING` for the use, the reach over one's head
    as G's); the view shows one's storey and the ceilings while it is on, as the palette does.
  - The build palette sets up through the same use (`Controls.place` → `planSet`), never G.
  - The thing in hand has its ghost where it will be drawn (`BuildingMode.hand`).
  - A lesson's `only` and `cells` narrow it as they narrow G.
- **Two forms** (2026-10-21, design.md §5.2): a built thing that can be carried either stands (set up) or lies
  loose, packed as `LOOSE` (`item/misc/bundle/loose`, drawn as the small picture of what it holds): put down with
  G, spilled, or knocked loose by a tool (`core/strike` → `loosen`, what it holds spilling first; a packed ceiling
  comes down to the storey that holds it). E or the magnet picks the pack up, and the thing comes out whole
  (`body/loose-taken`). Set up again, it stands. The world's maps and the palette's work stand from the start;
  no save changes.
- **The build palette's buildings** (a chest, a campfire, a crate, a fence, a sign: `placement.ts`) go up
  on one's own storey, on open ground or on a floor laid there (the first material stacks on it,
  `build/stack`), where the result could rest (`settleWhy`). A laid floor and a flyer over the cell are
  not in the way; anything else standing or lying there is.
- **The client:**
  - the preview where the thing will be drawn (a block two tiles high; a ceiling under the pointer);
  - what is above one's storey hidden under cover (`WorldScene.coveredRound`) and while the palette is open;
  - the palette's ceiling toggle and its line in the details;
  - `WorldScene.setBuildView` while the palette is open (one's own storey; the ceilings tinted where they are drawn while one lays them);
  - the prologue's house hint tells how to lay the ceiling;
  - **the draw order** (`render/depth.ts`, tested in `packages/runtime/test/depth.test.ts`):
    - by the row a thing stands in, then its storey, then what it is in its cell: the slab, a built block
      or a fixture, what lies loose on it, a body;
    - a floor laid on the ground is part of the ground, under all that stands whatever was made first
      (a floor and what stood on it used to tie, and the order of making decided);
    - a body on the move is ordered by where it is drawn, within a row of its cell;
    - one flying over a building is over its roof;
    - a fixture one can carry (a bed) is drawn as itself once set down, not as its icon in the bag;
    - what stands in front of the player and over them (a tree's crown, a lamppost) fades (`WorldScene.fadeOver`),
      as built walls and floors do (`findSeeThrough`).
- **Tests:** `games/openworld/content/test/building.test.ts` ("storeys: what one reaches…"), one test per table
  of §6, and W10, W12 and the tutorial walkthrough laying the ceiling by choice.

## 10. The buildings one finds: walls that break (2026-10-25)

The user chopped a village house's wall with a stone axe: the wall broke and they could walk where it stood, yet
the house was still drawn whole. A building on a map is a picture (the catalogue's prefab, `MapData.stamps`) over a
block of wall cells, and the picture was one image the state never reached. The promise is that anything can be
done to anything and the world stays consistent, the picture with it.

- **The walls are things of the world.** Every solid cell of a prefab is a wall in the map's file, with the
  durability, material and makeup of its terrain (`Prefab.terrain`). What a building's walls are made of is chosen
  by what its picture shows: plaster and stone cottages, the temple, the kiln `wall` (stone, 24, four stones);
  timber houses, the store, the teahouse, the inn, the longhouse, towers and palisades `woodwall` (wood, 12, two
  planks); tents and the smithy's canvas `canvaswall` (cloth, 6); the straw hut `thatchwall` (plant, 6); igloos
  `snowwall` (ice, 10, snowballs). A blow on one is its own outcome by the physics there is (`core/strike`, the
  instrument's efficiency on its material: an axe gives wood at 1 and stone at 0.25, a pick the reverse); broken, it
  is open ground with half of what it was made of lying there (`world-model.md` §6.3). Fire takes a wooden wall
  black (`burnt_wall`) and canvas or thatch to ash (`fire/burn-out-ground`, `fire/burnt-wall`).
- **The ground under a wall** is the street round it, never a way through: a door or stairs beside it are passed
  over when a filled cell's floor is found (`cells.ts` `WAY_TAGS`), so a wall broken beside a door is not a door.
- **The picture is pieces bound to the walls** (`packages/runtime/src/render/pieces.ts`). A stamp is cut into a
  piece per cell; each solid cell's piece is bound to the wall the file has there and shows it as the frame tells
  it (`Frame.tiles`: its terrain and durability): whole; cracked by thirds as it loses durability (the project's
  own `Structures/damage.png`, the catalogue's `ui.wallDamage`); darkened when it burnt; gone when the wall is,
  a hole in the picture where one walks in. The door, cells drawn and free ('.') and cells drawn over nothing
  (' ') are not bound. A room's frame (`MapData.rooms`) is bound the same way, and a built `structure/wall` shows
  the same cracks. The renderer only reads.
- **The roof over a hole.** The prefabs are drawn in the 3/4 view: their upper rows are the roof over the
  house's body, and they are wall cells too. So the roof is what it covers: a roof piece stays while its cell's
  wall stands and goes when it is broken, as every piece does. A hole under a roof piece still standing has the
  eave's shade on its ground. Whole, a building is drawn at its last solid row (all of it in front of whoever is
  behind it); opened, row by row like everything that stands, so one in a hole is behind the rows south of it and
  in front of those north of it, and the hole's cells no longer hide what is in them (the scene's `roofs`).
  A house's rooms are a map of their own behind its door; the shell one breaks into outside is the house's body,
  not a way into those rooms.
- **Whose the walls are.** A building whose door leads into an owned room has an owned shell: a region over each
  row's run of its solid cells, owned as the room behind the door is (`games/openworld/tools/src/demo/shells.ts`,
  run over the Ford's maps and the backdrop's). So breaking someone's wall is a deed against them: `seen` carries
  `theirs` and the harm, and the society module judges it vandalism (`social.ts`), seen by whoever had sight of it;
  standing in the hole by night is a trespass, as standing in their rooms is. Nothing here is an engine shortcut:
  the wall's damage is its own outcome, the deed is what witnesses make of the act. Two things the society module
  learnt from it: an owner goes to ask back only what the doer still carries (`conduct.ts` `confront`: a wall broken
  or a chest smashed is cried out and reported, never asked for), and a deed whose thing the act destroyed still
  names it, from the record its cell keeps (`social.ts` `judge`: "smashed at Rowan's household's wooden wall").
  A town has dozens of shells, so a map's named areas as its file has them now leave with it when it is put away and
  are made again when it comes back (`sparse.ts` `fileRegions`, `Engine.mapArrived`): a save keeps only one that changed.
- **The Held Ground's walls** are built things (`structure/wall`): a tool knocks one loose whole (§9 *Two forms*);
  any other blow or fire wears it down, and it shows the same cracks.
- **Tests:** `packages/runtime/test/pieces.test.ts` (the binding, the states, the order), `games/openworld/content/
  test/buildings.test.ts` (materials, makeup, the deed), `games/openworld/tools/test/buildings.test.ts` (the real
  maps: every owned house's shell, a Firstlight wall broken through the keys, the frame and the pieces).
