# Built stairs have no usable back: one can step onto them from behind and walk off their top into the cell behind

## What is wrong

Built stairs (`structure/stairs`) are a block a storey high; the end opposite the way they go up (the "back") is their highest end. Currently the engine lets a player:

1. Step onto built stairs from the cell directly behind them, as though the back were an entrance.
2. Standing on built stairs, walk toward their back and step off onto the ground in the cell behind, as though the top were an exit.

Neither should be possible: the back is a wall of block, so the player should bump into it.

A second problem is visual. When the player stands behind stairs (the stairs are drawn in front of the player and cover them), the player is completely hidden. Stairs should fade to semi-transparent in that situation, the way a statue or a tree crown already does.

## Expected behaviour

Stairs face the direction in which they go up (north / `up` if no facing is set).

- On the stairs' own storey, moving onto the stairs from the cell behind them (the cell on the side opposite their facing, moving in the direction of the facing) is blocked: the player stays where they are and bumps into the stairs.
- Standing on built stairs, moving in the direction of their facing (toward the high end, into the cell behind) onto ground at the same storey is blocked likewise. The player stays on the stairs. If there is a floor a storey up in the cell behind, moving that way still goes up onto that floor, as before.
- Moving onto or off the stairs from the front or from either side works as before.
- Example: stairs at (6,5) facing `right`. A player at (7,5) walking `left` stays at (7,5). A player at (5,5) walking `right` reaches (6,5); walking `right` again stays at (6,5) and remains at storey 0. From (6,5), walking `down` reaches (6,6).
- A map's own way down (`stairs_down` terrain, an exit to another floor) is not built stairs and has no back; its behaviour is unchanged.
- Rendering: stairs that stand in front of the player and cover them fade to semi-transparent, like statues and tree crowns. Other built structures keep their existing see-through handling.

## Requirements

- From the cell behind built stairs, moving toward them on the stairs' own storey is refused with a bump.
- Moving off the top of built stairs into the cell behind on the same storey is refused with a bump, unless a floor a storey up exists there, in which case the player goes up as before.
- Front and side entry and exit are unchanged, including climbing to the storey above in the direction of the stairs.
- Terrain-based `stairs_down` is unaffected.
- Non-walking movement (air stance) is not blocked by this rule.
- Stairs that cover the player in the scene fade; other `structure/` entities do not newly fade.
- A shared direction-reversal table is available and replaces the duplicated local reversals in the existing code that computes the opposite of a direction (the skill actives' "back" lookup and the swap-on-push step).
- Docs describing stairs and storeys (world model, building, the wiki floors page) reflect that stairs have a back.

## Interface

- `OPPOSITE` in `packages/engine/src/types.ts`: `export const OPPOSITE: Record<Dir, Dir>` mapping each direction to its opposite (`up`↔`down`, `left`↔`right`).
