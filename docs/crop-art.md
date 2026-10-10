# Original crop art

Saved assets: `games/openworld/public/assets/lsw/Crops/<crop>/`. Each of carrot, turnip, tomato and pumpkin has `sprout.png`, `young.png`, `ripe.png` (16 × 24), `produce.png` and `seeds.png` (16 × 16), and its full generated `atlas.png`. Existing skill and legacy crop art is untouched.

Mode: built-in imagegen, four original family-atlas calls and four targeted transparency-cleanup calls. Style reference: `games/openworld/public/assets/lsw/skills/farming.png`. Technical export uses tight visible-alpha bounds and nearest-neighbour resampling, preserves generated colors and alpha, aligns plant roots at the tile base and limits each stage's size separately. Tomato's first row crosses the nominal half-height: its extraction divider is 600px; other atlases use 512px.

[Native sprite / palette preview](crop-art-preview.png). All twenty sprites were loaded
and alpha-checked in an isolated browser verification page using the real placement
planner and generated demo world; no saved user world was modified.

## Complete generation prompts

Every original call uses the following common prompt, followed verbatim by its family specification.

```text
Use case: stylized-concept
Asset type: one original crop-family sprite atlas for Symbolic World, a handcrafted top-down pixel JRPG.
Input image: Image 1 is a STYLE REFERENCE ONLY, the game's agriculture emblem; match its earthy greens, warm dark-brown outline, ivory pixel highlights and handmade asymmetric square clusters. Do not reproduce the emblem.
Primary request: finished in-game crop sprites, not UI icons or concept paintings. Each sprite must be a distinct designed object with a readable silhouette, tactile leaves and produce, restrained flat pixel shading.
Layout: exactly a 3-column by 2-row atlas, six equally sized invisible square cells on a 3:2 landscape canvas. Transparent separation with generous padding. Row 1, left to right: tiny sprout, young growing plant, mature harvest-ready plant. Row 2: one harvested vegetable, one seed pouch, final bottom-right cell COMPLETELY EMPTY. No grid lines or frames. Keep every object inside its own cell.
Art: each cell drawn on about a 24x24 logical pixel grid, crisp hard square pixels and 6-8 earthy flat colors, dark brown outlines, no antialiasing, gradients or soft brush textures. Farm plants viewed from a slightly raised top-down RPG angle, upright and rooted, base pointing down. Growing plants increase in mass across the first row. One coherent plant per cell.
Materials: strong moss-green leaves, cream highlights, crop-specific produce colors. Seed pouch is warm ochre linen with a short tied twine neck, one small colored crop-shaped stitched motif and no writing.
Background: genuinely transparent alpha across the whole canvas, including the empty cell. No backdrop, soil tile, badge, floating particles, glow, cast shadow, text, numerals, logos or watermark. Each cell remains readable when exported to a tiny 16px world sprite.
Crop family: 
```

### carrot

```text
Carrot / 胡萝卜. Sprout: two tiny light-green leaves. Young: a small fan of feathery teal-moss leaves with no visible root. Mature: a fuller irregular fan of serrated leaves above one stout orange carrot shoulder peeking out of the ground, not a whole floating root. Harvest: one slightly bent ochre-orange carrot with three dark brick-orange transverse ridges and a short three-leaf green top, diagonally placed. Seed pouch: ochre linen bag with a small orange carrot-shaped stitched motif.
```

### turnip

```text
Turnip / 芜菁. Sprout: two round lime-green cotyledons. Young: four broad folded moss-green leaves. Mature: a squat round ivory-white turnip bulb with a plum-violet shoulder peeking under crinkled broad green leaves and a tiny downward root tip, visibly rooted. Harvest: one ivory turnip with a dusty-plum top, a hooked short root and a pair of fresh green leaves. Seed pouch: ochre linen bag with a small ivory-and-plum turnip-shaped stitched motif.
```

### tomato

```text
Tomato / 番茄. Sprout: two pointed tiny green leaves. Young: a small jagged-leaf green plant beside one thin warm-brown wooden garden stake, tied once with ochre twine. Mature: the same taller leafy plant, same stake and twine, carrying three plump brick-red tomatoes with tiny ivory highlights and dark green calyxes; plant not a detached bouquet. Harvest: one stout brick-red tomato with an irregular five-point moss-green calyx, one asymmetrical cream highlight and a tiny dark-red bottom notch. Seed pouch: ochre linen bag with a small red tomato-shaped stitched motif.
```

### pumpkin

```text
Pumpkin / 南瓜. Sprout: a short two-leaf lime-green sprout. Young: low curling moss-green vine with three broad lobed leaves, no fruit. Mature: one squat chunky amber-orange pumpkin with dark burnt-orange rib grooves and a curved brown stem, nestled in its low vine with two large green lobed leaves, rooted rather than floating. Harvest: a compact asymmetrical orange pumpkin with bold ribbed segments, one ivory highlight, a short hooked earthy stem and one tiny green leaf. Seed pouch: ochre linen bag with a small burnt-orange pumpkin-shaped stitched motif.
```

## Targeted cleanup prompt

Each generated atlas is the sole edit target, passed as a local referenced image with `transparent_background: true`.

```text
Use case: background-removal. Image 1 is the EDIT TARGET. Keep the five pixel-art sprites exactly unchanged in design, colors, shape, pixel edges, scale and positions, in the same 3-column by 2-row atlas. Remove ONLY the soft glows, haze, shadows, gradients and tinted background around all sprites. Make the entire background truly transparent alpha up to the hard dark-brown pixel outline of each sprite. Preserve the earthy outlines and the tiny clods of soil immediately at the roots as part of the sprites. No black background, no soft glow, no checkerboard drawn, no new artwork. Bottom-right cell remains completely empty/transparent. These will be extracted into tiny game sprites, and need perfectly clean transparency.
```
