# When laying a ceiling, build (and show) the one drawn under the pointer

## What is wanted

Building a ceiling currently acts on the cell the pointer is over on the player's own storey. But a ceiling is drawn one storey up, which the view draws a tile higher. So the ceiling drawn under the pointer is generally not the one that gets laid or taken down: the preview, the ceiling laid and the roof seen from outside land at different spots.

Wanted: "where one points, it is built and shown". When the ceiling layer is chosen, the pointer is mapped onto the plane of the storey above, and the cell acted on is the one whose ceiling is drawn at the pointer. This applies to laying and to taking down, to the build palette (preview and ghost, click, drag) and to the long-press list of choices, where the ceiling entry must be the same one.

While ceilings are being laid in the build palette, the existing ceilings over the player's storey should be tinted and translucent where they are drawn (a storey up), so one sees them even from inside a room. They must not hide what is beneath them.

## Expected behaviour

- The view supplies, along with the cell aimed at and the `stack`, a second cell: the one whose ceiling is drawn at the point. It is the same column as the cell aimed at, and the row is the one a storey higher, drawn a tile up, for the player's storey.
- With the ceiling chosen and an aim that carries that cell, `put` and `take` act on the ceiling of that cell, not of the cell aimed at on the player's storey.
  - Example: the player stands near (3,5) and the pointer is on (3,3) with the drawn-ceiling cell (3,4). Laying a floor as the ceiling puts it over (3,4) and nothing over (3,3). Taking down the ceiling with the same aim removes the one over (3,4).
- Without that cell in the aim, behaviour is unchanged: the ceiling is over the cell aimed at.
- In the build palette, when laying a floor as the ceiling (the R toggle), the cell previewed, placed (click) and placed while dragging is the drawn-ceiling cell. With no pointer, the cell in front is used as before. A drag places one new ceiling per new such cell.
- The ghost for a ceiling is drawn where the ceiling will be drawn (a tile higher than for a floor on the same cell).
- The view's ceiling tint is shown only while the palette is open and a floor is being laid as the ceiling. It is not shown merely because the palette is open. It follows selecting another recipe and toggling R.
- The long-press list's ceiling entry plans the same ceiling as the palette.

## Requirements

- Choosing the ceiling with an aim that has the drawn-ceiling cell plans put/take on that cell's ceiling.
- Choosing the ceiling with an aim lacking it plans on the aimed cell, as before.
- The last choice in the long-press list is still the ceiling, never the default.
- The preview reply is accepted only for the cell actually targeted (the drawn-ceiling cell while laying a ceiling).
- Ceilings are tinted at their drawn position only while laying ceilings in an open palette; the tint is cleared when the palette closes, another recipe is chosen, or R turns the ceiling off.
- `docs/building.md` §5 describes this behaviour.

## Interface

- `Aim.over?: { x: number; y: number }` in `packages/engine/src/types.ts`: the cell whose ceiling (the floor of the storey above) is drawn at the point; optional, supplied by the view.
- `BuildingMode.onView?: (open: boolean, ceilings: boolean) => void` in `packages/client/src/ui/building.ts`: replaces `onToggle`, called with whether the palette is open and whether ceilings are being laid.
- `WorldScene.setBuildView(open: boolean, ceilings: boolean): void` in `packages/client/src/render/scene.ts`: replaces `setCeilingOverlay`. `open` hides the storeys above the player's, `ceilings` (only while open) tints the ceilings.
