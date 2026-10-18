# The map figures (docs/looks.md §3.1)

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
| Drafts in bulk | `addjobs.py outfits\|hats\|beards\|worn` (jobs into `queue.json`), `queue.py [size]` (makes them one by one, keeps running, jobs can be added; `queue.stop` stops it), `whiten.py` (a draft's drawn checkerboard made white) |
| Hair | `gen_hair.py style…` (the bald drafts of each facing edited to wear it), `hairmake.py style [--back …]` (what the edit changed, cut out against the bald draft, set on our head; a speck dropped, the edge a dark line), `nape.py` (a back view's hair carried to the nape, in strands), `fixcropped.py`, `fixbraid.py`, `fixchildbob.py`, `hairpreview.py` (every style on both bodies as the game layers it); `hairall.sh` is the whole recipe; `hairs.py <dir>` writes `basehair.ts` from the parts and `hairs.json` (where each hangs behind the body) |
| Outfits | `regions.py` (each frame's body parts: head, neck, torso, hips, upper arm, forearm, hand, thigh, shin, foot, and how far along its limb a cell lies), `outfitfit.py` (which cloth the draft puts on each body cell of the standing frame, by the nearest key colour; `samplec.py` finds a draft's colours), `outfit.py outfit body facing` (the outfit on every frame of the facing by its parts, from `outfits.json`: the keys, a limb's cloth along it, a skirt, pieces laid by place, a facing's torso of one cloth), `runall.sh outfit:body…` (every facing of each), `showo.py` (an outfit's frames big), `showd.py` (its drafts); the worn pieces likewise (`armour.plate`, `cloak.pauldrons` laid by place), the worn cloak from the long cloak's outfit (`worncloak.py`); `outfits.py <dir>` writes `baseoutfit.ts` |
| Head parts | `partmake.py kind id body letters:#hex…` (a hat or a beard: what its draft changed on the bald head), `details.py` (the faces' variants, a scar, freckles, age's lines and the glasses, by hand); `heads.py <dir>` writes `basehead.ts` from them and `heads.json` (where a hat hides the hair) |
| Children | `kidcarve.py` (a child's frame from the woman's: a torso row and five leg rows out, the legs closer together, the 3/4 strides' legs drawn small); their outfits are drafted on their own frames drawn big (`outfitfit.fit_child` finds the scale) |
| Check | `wearall.py out.png FRAMES:parts…` (parts worn on frames as the runtime wears them) |

A grid file: 36 rows of 24 letters, a blank line, then `L #rrggbb` per letter. Letters: K L outline; O H J F Q skin (J
the colour, repainted per look); M P the eyes (P the colour); N the eye's white; V W T X the grey underclothes.

Hair letters: a (light) .. c (the colour, repainted from the look's hair) .. e (the hair's dark line). A style is one
grid per facing on the standing head; it fits every body (the child's head is the woman's) and moves with the head
when a step lowers it.

An outfit's part is drawn for every frame, in its slot's letters: the outfit's 1 qrst, 2 uvwx, 3 yzAB (the look's keys)
and 4 CDEG (its own colour), the armour's 0123, a cloak's 4567, light to dark; K an outline it adds, `_` a cell it
clears, and the base's letters where it redraws the body (a long skirt's feet). The tones come from the base under
it (its light, mid, shade and dark), so the cloth keeps the body's form.

The outfits' and the worn pieces' work needs the bases' grids in the work folder's `bg/` (`bases.py out bg`) and the
drafts in `drafts/`. Their order: drafts (`addjobs.py`, `queue.py`), then per outfit its entry in `outfits.json` and
`outfit.py` for each body and facing, looked at with `showo.py`, then `outfits.py .`; the head parts likewise with
`partmake.py`, `heads.json` and `heads.py .`.
