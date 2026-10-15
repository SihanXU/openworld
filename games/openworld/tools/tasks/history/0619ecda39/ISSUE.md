# Stairs should be a storey's front one walks up, set where a wall would hold a floor's edge

## What is wanted

Stairs currently occupy a cell in front of the floor above and are treated as a walkable tile that is drawn two tiles high over the storey's front. They should work like stairs set into a cliff's face instead.

- Stairs stand in the cell where a wall would hold up a floor's edge, and a floor can be laid over them, as over a wall.
- From the side, stairs are solid, like a wall.
- Walking into the stairs in the direction they go up (their facing, north unless set) puts you on the floor laid over them, one storey up.
- Walking off that floor in the opposite direction from the stairs' cell puts you down on the ground in front of them.

## Expected behaviour

Take stairs at (3,3) facing north (placed from (3,4)), with a floor laid over them at (3,3) and over a wall at (3,2):

- From (3,4) on the ground, walking up (north) leaves you at (3,3) on storey 1. Walking up again moves you to (3,2) on storey 1, over the wall.
- From (3,3) on storey 1, walking down (south) keeps you at (3,3) on storey 1. Walking down again takes you to (3,4) on the ground (z is 0 or unset).
- From (4,3) on the ground, walking left (into the stairs' side) does not move you. You stay at (4,3) on the ground.
- Stairs placed facing east (via the palette's turn) record facing `'right'` and go up toward the east.

In the second-storey scenario (walls, a floor held up by them, stairs, going up):

- Stairs set at x+1 beside the wall, facing west (`'left'`, placed from the east), under the floor beside the wall.
- Standing at x+2 and walking west puts you at (x+1, y) on storey 1, and then at (x, y) on storey 1 over the wall.
- Breaking the wall brings the floors down. Whoever stands on the floor falls to the ground, here at (x, y) with z unset.

## Requirements

- Stairs occupy the volume of their cell and are solid, like a wall. They can be placed in the same cell where a floor will later be laid over them. They keep the `stairs` tag, hp and make-up (3 planks).
- Climbing is decided by the cell being walked into. Moving in the stairs' facing direction into a cell that has stairs with that facing, with a floor at the next storey above, moves you to z+1 in that cell.
- Descending is decided by the cell being walked from. If you are above ground (z > 0) and the cell you are in has stairs on the storey below, with a facing opposite to your movement direction, you move down one storey.
- If neither of those applies, the existing behaviour is kept. With no floor under you at your storey, you fall to the first floor below, or to the ground, unless you are airborne. The ordinary rules still hold when a floor is under you.
- Moving into stairs from any direction other than their facing is blocked, as with a wall. Stairs are not walkable from the side.
- Stairs placed with a facing (including via the palette's turn) store it, defaulting to north (`'up'`).
- Breaking the wall that supports a floor still brings that floor down and drops whoever is on it.

## Interface

None
