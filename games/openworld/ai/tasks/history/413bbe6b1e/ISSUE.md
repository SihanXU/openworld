# Build palette (B): set walls, floors, doors, beds and workbenches down, dragged in rows

## What is wanted

Right now there are two ways to build. Walls, floors, doors, beds and the like are crafted (C) and then set down one at a time with G. The B palette only holds placement recipes (campfire, chest, fence, sign, sowing). The B palette should become the one place to build, with G's existing "put down" act underneath it.

1. The palette lists what is made and set down: every recipe whose result is a structure or a fixture (bed, workbench, wall, floor, stairs, door), plus anything else of that kind the player is carrying. The placement recipes follow.
2. Choosing a cell sets down one carried item of that type, exactly as G would. If none is carried, one is first made from what the player carries, then set down. The preview says which will happen, or why it can't.
3. A pointer beyond reach is not moved to a nearer cell. Nothing is set down elsewhere.
4. Holding the left button and dragging sets one down in each new cell the pointer enters.
5. The workbench becomes something made by hand from four planks and carried (like the bed), so it can be set down anywhere. Things made at a workbench can then be made anywhere one has been set down.

## Expected behaviour

Engine controls offer a preview and an action for setting a type down at a cell (aim):

- Player carries a wall and three planks, and aims at an adjacent cell in reach:
  - The preview is ok and reports 1 carried.
  - Placing succeeds and that cell holds exactly one wall.
- Player now carries no wall but still has planks, and aims at another adjacent cell:
  - The preview is ok and reports 0 carried.
  - Placing succeeds. A wall is made from two planks, then set down. One plank is left over from the three.
- With only one plank left and no wall carried, the preview is not ok (one plank makes no wall).
- Player carries a wall and aims at a cell beyond reach (e.g. three cells away):
  - Placing returns false.
  - Nothing is placed at that cell or at a nearer cell in between.
- Player carries four planks, two sticks and three grass, and places a workbench at an adjacent cell:
  - It succeeds and the cell holds a workbench, made by hand from the four planks.
  - Crafting a bow afterwards succeeds, because a workbench now stands beside the player. One bow is carried.

In the client palette:
- The "Structures" category lists made-and-set-down things first, then placement recipes. Items of that kind found and carried also appear.
- Details show how many are carried and, if none, what would make one.
- The left-button press places in the aimed cell. Dragging places in each new cell entered. Releasing, closing the palette, or toggling it off ends the drag.
- The preview for these entries works through the same aim/preview/build messaging as placement recipes, and failures are logged like other placement failures.

## Requirements

- Setting a type down with a carried item uses the same rules and plan as G's put with that item. This holds even when the item isn't the one in hand.
- With none carried, a recipe that makes the type is crafted from what is carried, then the result is set down. If the recipe cannot be crafted, or the cell is unreachable or blocked, nothing is made and nothing is lost.
- The made-first preview applies the same placement conditions: within carry reach, not a solid cell, in bounds, and not the player's own cell for a solid type.
- A cell other than the aimed one is never used. If the plan would land elsewhere, placing fails and the preview is not ok.
- Placing does nothing while the player is busy.
- The workbench type is made by hand from 4 planks, is portable (can be carried), and keeps its station role so that crafting at a workbench still works beside it.
- Only structure and fixture types count as placeable by this mechanism.
- Dragging does not repeatedly place in the same cell while the pointer stays in it.

## Interface

Added to the engine `Controls` class (`packages/engine/src/controls.ts`):

- `Controls.placeable(type: string): boolean` (static). True for types starting with `structure/` or `fixture/`.
- `previewPlace(type: string, aim: Aim): { ok: boolean; reason: Text; carried: number }`. `carried` is how many of the type are carried.
- `place(type: string, aim: Aim): boolean`. Sets down one at the aim, making one first if none is carried. Returns whether it was set down.

Content change (`packages/content/src/ontology.ts`): the type `fixture/craft/workbench` gains the `portable` tag and a makeup of 4 × `item/material/plank` made with station `hands`.

Client (not directly tested):
- `BuildingMode` in `packages/client/src/ui/building.ts` gains `press(tile?)`, `release()` and a `dragging` flag.
- Palette entries for setting a thing down use ids of the form `put:<type>`. The worker accepts these ids in the `buildAim` and `build` messages.
