# The map figures' bases (docs/looks.md §3.1)

The 24x36 bases in `packages/runtime/src/assets/figure/bases.ts` were made here, by the method the user settled on:
ComfyUI (Qwen-Image-Edit, `../portrait/setup.md`) draws a pose; the pose is fitted onto the grid in the example's
palette; our own head (Cloud's face) goes on top; then the pixels are touched up by hand — outline gaps closed,
specks removed, the draft's shapes kept. Run everything in a work folder (`drafts/` and the grid files live there).

| Step | Tool |
|---|---|
| Drafts | `gen.py` (front and back, drawn and edited from the 3/4 drafts), `gen_walk.py` (the far-leg stride), `gen_walk3.py` (the near-leg stride) |
| Fit a draft | `fit.py draft out.txt --neck Y` (head and body bands); `fit2.py draft out.txt --knots y:row,… --xs scale:row,…` (any bands: the head, the neck, the shoulders, the hem, the soles each on their row) |
| The draft's heights | `rows.py draft [y0 y1]` |
| Edit | `patch.py base out rows.txt` (rows replaced), `walk.py` (`step`, `stride`, `shift_block`: the front and back steps from a standing grid) |
| Check | `gaps.py grid…` (fill touching the background: an outline gap), `px.py big`, `biggrid.py`, `present.py` (facings big and at game scale), `overlay.py` (a grid under strokes the user drew on a screenshot) |
| Into the game | `bases.py out <dir>` writes the module's grids as files; `bases.py in <dir>` writes them back |

A grid file: 36 rows of 24 letters, a blank line, then `L #rrggbb` per letter. Letters: K L outline; O H J F Q skin (J
the colour, repainted per look); M P the eyes (P the colour); N the eye's white; V W T X the grey underclothes.
