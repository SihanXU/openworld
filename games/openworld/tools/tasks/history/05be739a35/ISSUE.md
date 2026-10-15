# Stairs should be a walk-onto block that leads up the way they go, not a wall-like front under a floor's edge

## What is wanted

Stairs currently behave like a wall set under a floor's edge: they are solid, one walks "into" them from the facing side and is taken straight to the floor laid over them, and from other sides they simply block. This should change so stairs are a block one steps onto, and which then leads up.

New model: stairs stand *before* something a storey up (e.g. a wall with a floor laid over it), rather than under a floor's edge. They are not solid. One can walk onto them from any side, which is half a storey up and so does not count as a fall coming back. While standing on them, moving the way they go up (their facing, north/`up` unless set) takes one onto the floor a storey up. From that upper floor, moving back puts one on the stairs below again.

Stairs also keep the storey above them open. A floor placed onto the stairs' cell is laid a storey higher instead of directly over them, and stairs that go up through a hole in a room's floor overhead count as part of that room.

## Expected behaviour

Setup: a wall at (3,2) with a floor laid over it at z=1; stairs at (3,3) facing north (`up`); the player south of them at (3,4).

- Walking north from (3,4) puts the player on the stairs at (3,3), still at ground z (0), not on the upper floor.
- Walking north again moves the player to (3,2) at z=1 (the floor above the wall).
- Walking south from there returns the player to the stairs cell (3,3) at z=0, taking no fall damage (hp unchanged).
- Walking south again leaves the stairs onto the ground at (3,4).
- From the side (e.g. from (4,3) walking west) the player now steps onto the stairs at (3,3), and walking west again leaves them to (2,3), staying at z=0. Only the stairs' facing direction leads up.
- Stairs facing east (set via the palette's turn) go up east, as before.
- Stairs in a room: with walls round a room and a floor over it at z=1 except for a hole at the stairs' cell (3,3), the stairs going up north:
  - the ground-level room (as returned by the world's rooms for the map) includes the stairs' cell (3,3) among its area rects, rather than the hole splitting it or leaving it open;
  - from (3,4), walking north puts the player on (3,3), walking north again reaches (3,2) at z=1, and walking south returns to (3,3) at z=0.
- Placing a floor on the stairs' cell (3,3) via the build control succeeds and the floor lands two storeys up from the ground (z=2), not z=1 and not on the stairs' storey: the storeys at that cell read stairs at z=0, nothing at z=1, floor at z=2, nothing at z=3.
- The placement of the stairs themselves with facing `up` when set from the south remains as before.

## Requirements

- `structure/stairs` is no longer solid; it still occupies the volume and keeps the `stairs` tag, its HP, and its plank makeup.
- Climbing: when the walker stands on a stairs cell at its own z, and moves in the stairs' facing direction (default `up`), and there is a floor at z+1 in the destination cell, the walker ends at z+1 in that cell.
- Descending: when the walker is at z > 0, there is no floor at the walker's current z in the destination cell, and the destination cell has stairs at z-1, the walker ends on the stairs at z-1 with no fall damage (half a storey).
- Walking onto stairs from any side on the same storey is allowed and keeps the walker's z.
- Room detection treats a cell holding stairs as roofed (part of the room) for the purpose of finding enclosed rooms, in the same way as a cell with a floor overhead, so a hole in the overhead floor filled by stairs does not open the room.
- Floor placement: a floor cannot be set at the same storey as stairs in that cell, nor at the storey directly over them; it is laid at the next valid storey higher (subject to the usual support rules). Stairs thereby keep the storey over them open.
- The second-storey scenario with a wall, a floor laid over it, and stairs set before the floor's edge continues to work end to end: onto the stairs, onto the floor above, onward over the wall; breaking the wall still brings the floor down and whoever is on it falls.

## Interface

None
