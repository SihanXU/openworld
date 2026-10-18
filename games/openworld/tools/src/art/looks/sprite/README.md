# The map figures' bases (docs/looks.md §3.1)

The 24x36 bases in `packages/runtime/src/assets/figure/bases.ts` were made here, by the method the user settled on:
ComfyUI (Qwen-Image-Edit, `../portrait/setup.md`) draws a pose; the pose is fitted onto the grid in the example's
palette; our own head (Cloud's face) goes on top; then the pixels are touched up by hand — outline gaps closed,
specks removed, the draft's shapes kept. Run everything in a work folder (`drafts/` and the grid files live there).

| Step | Tool |
|---|---|
| Drafts | `gen.py` (front and back, drawn and edited from the 3/4 drafts), `gen_walk.py` and `gen_walk4.py` (the far-leg stride; the second with the near arm forward, as it must be), `gen_walk3.py` (the near-leg stride) |
| Fit a draft | `fit.py draft out.txt --neck Y` (head and body bands); `fit2.py draft out.txt --knots y:row,… --xs scale:row,…` (any bands: the head, the neck, the shoulders, the hem, the soles each on their row) |
| The draft's heights | `rows.py draft [y0 y1]` |
| Edit | `patch.py base out rows.txt` (rows replaced), `walk.py` (`step`, `stride`, `shift_block`: the front and back steps from a standing grid), `armsfb.py` (the front and back steps' arms: the one swinging toward the viewer over the hip, the other's forearm hidden behind it, opposite the forward leg — the farther, higher foot) |
| Arms | `lower.py` (an arm tilted down, farther cells lower), `rotarm.py` (an arm turned about its shoulder, in front of the body or behind it: the 3/4 strides' swing kept close to the body) |
| Check | `gaps.py grid…` (fill touching the background: an outline gap), `px.py big`, `biggrid.py`, `present.py` (facings big and at game scale), `overlay.py` (a grid under strokes the user drew on a screenshot) |
| Into the game | `bases.py out <dir>` writes the module's grids as files; `bases.py in <dir>` writes them back |
| Hair | `gen_hair.py style…` (the bald drafts of each facing edited to wear it), `hairmake.py style [--back …]` (what the edit changed, cut out against the bald draft, set on our head; a speck dropped, the edge a dark line), `nape.py` (a back view's hair carried to the nape, in strands), `fixcropped.py`, `fixbraid.py`, `hairpreview.py` (every style on both bodies as the game layers it); `hairall.sh` is the whole recipe; `hairs.py <dir>` writes `basehair.ts` from the parts and `hairs.json` (where each hangs behind the body) |

A grid file: 36 rows of 24 letters, a blank line, then `L #rrggbb` per letter. Letters: K L outline; O H J F Q skin (J
the colour, repainted per look); M P the eyes (P the colour); N the eye's white; V W T X the grey underclothes.

Hair letters: a (light) .. c (the colour, repainted from the look's hair) .. e (the hair's dark line). A style is one
grid per facing on the standing head; it fits both bodies and moves with the head when a step lowers it.
