# White Knight Alberic — overhead visual remake

2026-10-05. The user's five root-level concept images and the setting (`assets/concept/five-sufferings-setting.md`)
define the design. Alberic's own image is the costume authority: a sealed ivory great helm,
bronze thorn crown, battered ivory/gold plate, ragged white vestments, white-fletched quiver,
recurved bow and longsword. His death offers the crown; he is a burdened guardian, not a demon.

## Camera correction

The user rejected the v2 upright front/side illustration. **v3 is a high overhead 2D map sprite**:
the helmet roof and shoulder tops dominate, the torso and legs are foreshortened, and the cape
spreads across the map plane. Down, right and up are separately drawn; left mirrors right.
Do not return to v2's tall portrait projection, or rotate a front-facing bitmap to fake a back view.

The built-in `imagegen` tool generated a new identity, seven directional animation sheets and
overhead volley/thorn effects. The earlier generated arrow beam remains suitable for rotation
in the ground plane. No raster art was replaced with procedural shapes. The Swift exporter
only crops, applies nearest-neighbour scaling, aligns a fixed pivot and composes review images.
It preserves generated transparency. Death uses one constant sampling correction for all twelve
frames because its source canvas has a different aspect ratio; it never fits each pose separately.

## Motion-density correction (v4)

The user found the four-pose actions too abrupt. v4 keeps the overhead identity and expands
all seven actions to **twelve real generated poses per facing** (252 body frames). Idle has
restrained breathing; walking has contact/loading/passing poses; attacks include recovery;
hurt is compact, and death has intermediate kneeling, crown removal and falling poses.
The first multi-facing attack/death generations had direction drift and were rejected.
Those four actions were regenerated separately for down, right and up, then packed together.

The export first corrects row-wide whitespace offsets in the generated sheets, so crossing
from source frame 4 to 5 or 8 to 9 does not move the actor vertically. Idle/walk sheets also
use one shared horizontal packing correction per source column, measured across every facing;
this removes grid-pitch drift while retaining each pose's individual gait/breathing motion.
It then registers
each action's initial stance to idle once per direction and uses that
one fixed scale/translation throughout all twelve poses. It never resizes each frame's body
to its changing bounds, blends two images, or synthesizes extra frames by rotating copies.

The renderer advances animation progress between 10 Hz simulation snapshots, capped to one
tick ahead. It cannot cross from a telegraph into the release pose before the engine releases
the skill. Paused snapshots do not rewind the sprite. Idle retains a 1.2s breathing loop and
walk a 0.72s gait (10 and 16.7 poses/s respectively). Action previews use a 1.2s loop; hurt
uses 0.6s; death plays over 1.8s and holds the fallen pose until selected again.
Damage, wind-up/recovery durations, collision size and all other bosses remain unchanged.

## Current runtime contract

### Thirty-two-pose expansion (v5)

The user explicitly requested 32 frames per action. The built-in image generator expands
each of the seven v4 actions separately in down/right/up, producing 21 eight-by-four source
sheets: **672 body poses**, with left mirrored from right. The v4 sprites are the identity,
camera and pose references; they are not repeated to fill extra columns. The exporter keeps
one fixed transform per action/facing against the v4 rest stance and preserves source alpha.

The first v5 playback used all 32 poses per action. The later user request supersedes that
timing: the atlas remains the source library, but only the curated clips below play.

### Current playback: 8–12 poses at 20 fps

No new images were generated or existing pixels changed for this revision. The runtime
selects existing v5 columns through `ALBERIC_CLIPS` in `client/src/assets/bosses.ts`:

| Action | Poses | Preview duration |
| --- | ---: | ---: |
| Idle | 8 | 400 ms loop |
| Walk | 10 | 500 ms loop |
| Thorns / Arrow / Volley | 12 each | 600 ms loop |
| Hurt | 8 | 400 ms loop |
| Death | 12 | 600 ms, then hold |

Pose cadence is 50 ms (20 fps), independent of screen refresh. Rendering, camera and input
are not capped to 20 fps, and the simulation remains on its original 100 ms timer.
Snapshots carry `animationElapsedMs` separately from normalized combat progress; the renderer
can advance the intermediate 50 ms pose even inside the first simulation tick. A paused or
stalled simulation extrapolates at most one tick and does not rewind.

In live combat the first six skill poses play at 20 fps, then hold full anticipation until
the authoritative release. The remaining six start at the hit and hold the recovered stance
if needed. The animation never shortens a telegraph, fires early, or changes damage, cooldown,
collision or corpse lifetime. Death plays once and holds until the existing despawn.
Studio previews run directly inside the scene's render update, bypassing the combat snapshot
extrapolator. Clicking a mode starts at its first rendered pose; all seven clips use the same
20 fps selection. There is no second requestAnimationFrame loop rebuilding the world and HUD
on every pose. Facing changes keep the clip running, clicking the same action restarts it,
and returning to live mode clears the override and resumes authoritative combat snapshots.

`packages/client/public/assets/lsw/Bosses/alberic/v5/`:

- `actions.png`: 4096 × 2688 RGBA, 32 columns × 21 rows, 128px cells, scale 1.25, anchor Y 88.
- Rows 0–6: down; 7–13: right; 14–20: up. Each block is idle, walk, thorns, arrow, volley,
  hurt, death. Left uses the right block with horizontal mirroring.
- Each source action has thirty-two distinct frames; playback selects 8–12 of them, for
  222 selected poses across the three drawn facings. Skill clips select six wind-up columns
  below 16, then six release/recovery columns from 16 onward. Unselected source frames remain
  available for future edits; there is no per-frame redraw or rescaling.
- Effects still use the preserved `v3/` files: `effect-arrow.png`, `effect-volley.png` have six
  96px frames each; `effect-thorns.png` has six 64px frames.
- Arrow VFX carries the locked direction and length. Thorns appear on the actual marked ring
  cells, not the safe centre. The existing damage, wind-up, recovery, status and collision values
  are unchanged. Other bosses retain their previous art and animation layout.

The snapshot carries the skill ID so flat-shot and skyward-shot recovery use the correct rows,
including after reloading an existing save. Atlas selection is pure and covered by tests.

## Review and reproducibility

- Open `/boss-gallery.html?boss=alberic` on the development server. Choose an action, then a
  facing; the controls only change the render snapshot. Skill buttons trigger the real encounter.
- Studio and challenge bootstrap use the current content's boss kits, not the generated map
  index's potentially older list. Without a matching kit the snapshot omits boss animation data
  and the renderer treats Alberic as an ordinary creature; changing a preview then does nothing.
  Regression tests load an index without Alberic and check the real scene's sprite frame choices.
- `boss-art/alberic-v5/overview.png`, `overview-right.png`, `overview-up.png`: all thirty-two poses.
- `boss-art/alberic-v5/actions/`: individual 8 × 4 contact sheets for each action/facing.
- `boss-art/alberic-v5/motion-preview.gif`: archived thirty-two-pose source review, not the
  current reduced-clip playback. Use Boss Studio for the current 8–12-pose / 20 fps timing.
- `boss-art/alberic-v5/map-context.png`: labelled composition against existing game map pixels,
  **not** an in-game screenshot or a campaign spawn change.
- `alberic-art-v5-prompts.json`: exact prompts, references, frame layout, source paths and export settings.
- Sources are in `var/boss-art/alberic-v5/sources/`; originals also remain in the image tool cache.
  Export from the project root with `swift packages/tools/src/art/export-alberic.swift --v5`.
  `--v4` reproduces twelve poses, no version flag reproduces v3; `--v2` the retained portrait version.
- Runtime frames are audited in `boss-art/alberic-v5/frames.json`. Tests decode the PNG pixels
  and check nonempty art, real alpha, transparent borders, uniqueness and all directional rows.

The previous legacy, v2, v3 and v4 assets are preserved. The five user concept images and lore file
have not been changed. Browser-based gameplay inspection was unavailable in this session;
the visual checks use generated frames/compositions, with real-engine timing and balance tests.
