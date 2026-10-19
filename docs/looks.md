# Looks: the character creator every body is drawn from

Agreed with the user 2026-10-08/09: an anime (二次元) character creator from which every person — the hand-written
people, the crowd, the player, one the modder brings — gets a matching map sprite, portrait (立绘) and tags.
Defaults the user accepted: map figures 16x32 (24x36 since 2026-10-17, §3), half-body portraits, every humanoid in the system, a `gender`
on people, all 24 people converted, the player makes their own look; the portrait art is drawn by a model
hosted locally.

Redrawn 2026-10-18 at the user's asking ("按照 black souls 这种风格", the trial `docs/figures/looks-style-trial.png`
accepted): full-body standing portraits in a dark-fairy-tale line style — crisp thin sepia ink lines, hatching in
the folds, flat muted fills, about seven heads tall, on a flat pale cream ground — the dialogue box showing the
bust cut from the figure; legs and shoes as slots of their own; every body with its own head and face (a man is
not her head on his body). The style is held by the bases every part is edited from; no style LoRA yet (§7).

## 1. References (what we took)

| Game | How | Taken |
|---|---|---|
| The Scroll of Taiwu (`AvatarData`) | a part id per slot, palette ids per region, age-driven beards and wrinkles | the record's shape |
| Tale of Immortal (鬼谷八荒) | one dress-table id has a portrait version and a figure version; the figure has fewer slots | pairing the two pictures by id |
| RPG Maker MV/MZ generator | each part number drawn for face, walk and battler; greyscale layers gradient-mapped | repainting through a gradient |
| Elin (PCC) | layer → [part, colour]; portraits separate art, matched only in hair colour | the record; Elin's weak consistency is what we avoid |
| RimWorld, Dwarf Fortress | the portrait is a render of the same layers; one descriptor record drives sprite and text | one source for every output |

No game derives the sprite from the portrait; they pair hand-made versions under one id and share colours by
class. So do we. No releasable anime part library exists (research 2026-10-08), so the project draws its own.

## 2. The record

```ts
interface Look {                       // engine/src/types.ts
  body: string                         // woman | man | girl | boy
  parts: Record<string, string>        // slot → part: hair, face, beard, age, mark, glasses, hat, cloak, armour, outfit, legs, shoes
  colors: Record<string, string>       // skin, hair, eyes, and a part's own as '<slot>.<n>' → colour id or #rrggbb
  own?: boolean                        // changed in the world (restyle): the world's design no longer replaces it on load
}
```

- It lives on the entity (`Entity.look`, any actor), is saved with the game, and goes to the client in the
  snapshot. A string `look` is still a whole drawn sheet's key (figures no parts make: a skeleton, a boss).
- The table (`content/src/looks.ts`, `Ontology.looks`): bodies, parts (slot, bodies it is drawn for, colour keys,
  default colours, tags, words in both languages, generator weights) and named colours (hex, names, the tags a
  colour gives the key it colours: silver on hair → `look:grey-haired`).
- Expressions are not stored: a line's `mood` picks the portrait's face at render time.
- Every body has its own head and face: the man's is a young man's, the boy's a boy's. Every head part (hair, faces
  and their moods, hats, beards, glasses, marks, age) is drawn on each body it is for (until 2026-10-18 the man and
  the boy wore the woman's and the girl's heads, and the user rejected it: men and women are told apart at a glance).
- Legs (stockings, hose, leg wraps) and shoes (ankle boots, shoes, buckled shoes, riding boots, sandals) are slots:
  an outfit is drawn barefoot. The generator draws them from a stream of their own (`generateLook`), so adding them
  changed nobody's other parts or colours.

## 3. Three outputs from one record

1. **Map sprite** (`runtime/src/assets/figure/sprite.ts`, 2026-10-17): a 24x36 figure at the tiles' pixel scale
   (two tiles tall), the soles on row 34, in the style of the user's example (an FFBE-style Cloud: its palette, its
   face moved up a row). The sheet is four columns (down, up, left, right: the 3/4 view faces left, right is it
   mirrored) by five rows: the walk (passing, a step, passing, the other step; a step carries the body a row lower,
   one foot planted on the soles) and an idle frame (`ActorDef.idleRow`) a figure stands in, so the woman stands with
   her weight on one leg and walks on both. Composed on demand into a canvas texture named by the look's code
   (`figure/index.ts`), in this order, frame by frame:
   - **The base** (`figure/bases.ts`): the bald man and woman per facing and frame, drawn over ComfyUI drafts; the
     child (girl and boy alike) is the woman's frames with her head kept on a child's body (a torso row and five
     leg rows out, the legs spread less, no bust), so every head part fits the children too. The skin and the eyes
     are repainted from the look's colours (`retone`: each authored tone keeps its step from the reference).
   - **The outfit, then what is worn over it** (`figure/baseoutfit.ts`: 16 outfits for the adults, 2 for the
     children; the breastplate, the cloak, the pauldrons): a part per frame, so a sleeve swings with its arm and a
     skirt walks. Each is read from drafts of the bald bases wearing it — which cloth lies on each body cell — and
     laid on every frame by its body parts: a limb's cloth by how far along the limb (a sleeve's end, a boot's top),
     the torso's by place, a skirt as one cloth from the hem down, and pieces laid by place on the hips (an apron, a
     belt, a stole, a tabard). The tones are the base's own light and shade, so the cloth keeps the body's form. A
     long skirt hides the 3/4 stride: the standing skirt is kept, a row shorter for the bob, the feet peeking out
     ahead and behind (its cells may clear the stride's legs, `_`). Letters per slot: the outfit's keys
     `outfit.1-3` and a colour of its own, the armour's `armour.1`, the cloak's `cloak.1`.
   - **The head's parts** (`figure/basehead.ts`, `figure/basehair.ts`): one grid per facing on the standing head,
     following it down on a step (and down to a child's head): the face's variants, a scar, freckles, age's lines
     (drawn by hand), a beard, the hair (15 styles, cut from drafts; below a row, and in the 3/4 view past a
     column, it hangs behind the body), glasses, a hat (which hides the hair above its brim).
   - **The legs and the shoes** (`figure/basefeet.ts`): at 24x36 a few cells, laid on as colour counted up from the
     frame's lowest row — a shoe repaints the feet (the bare skin and an outfit's own boots), riding boots the shins
     too, stockings the bare skin of the legs above the shoes; under a long skirt there is no skin to repaint.
   How they were drawn: `games/openworld/tools/src/art/looks/sprite/README.md`.
2. **Portrait** (`figure/portrait.ts`, full-body since 2026-10-18): a 768x1536 standing figure composed from layers in
   a fixed stack (`hairBack, body, legs, outfit, shoes, armour, cloak, age, face, mark, beard, glasses, hair, hat`;
   the hair goes under a covering hat; a long skirt's part says `above: ['shoes']`, so it falls over the boots while
   boots go over trousers). A layer is its paint and its value map (value, zone, coverage); zone k is repainted
   through the gradient of its colour key. A face part has a layer per mood; what the speaker's statuses show on the
   map (wet, burning, frozen, oiled…) washes over it (`figure/index.ts` WASH). Each body in the manifest has its
   **bust**, the square of the head and shoulders: `portraitOf(look, mood)` is the bust — the dialogue box shows it
   standing at its left (`ui/hud.ts`, `game.css .dialog.bust`), the character sheet, the companion's panel and the
   editor's scene lines too — and `portraitOf(…, 'full')` the whole figure, which the creator shows. The codex shows
   the sprite; the wiki the bust and the sprite (`wiki/src/looks.ts`).
3. **Tags and words**: `lookTags` (engine) derives `look:*` tags from the parts and colours — never stored, read
   by `World.view` and `hasTag`, so rules can address "the hooded"; `lookWords` (engine) gives the modder's
   `EntityInfo.look`; `describeLook` (content) the codex's, the wiki's and the creator's sentence in both languages.

Colour: one colour per key gives both ramps (`figure/color.ts`): the sprite's tones (an authored ramp moved onto
it, or four steps of `shade`) and the portrait's gradient (lines → shadow → the colour at value 180 → light → highlight), with painters' hue shift. The hair on
the map and in the portrait is the same colour by construction.

## 4. The art pipeline (`games/openworld/tools/src/art/looks/portrait/`)

- **Model**: Qwen-Image-Edit-2511 (Apache-2.0) in a local ComfyUI: GGUF Q4_K_M transformer, fp8 Qwen2.5-VL
  encoder, VAE, Lightning 4-step LoRA (`setup.md`, `download.sh`). `comfy_node.py` keeps the edit's reference at the
  input's size, so a 768x1536 edit leaves every pixel where it was. About 2–3 minutes a picture on an RTX 5080 laptop;
  the library (184 pictures) is a night's run.
- **The style** (2026-10-18): found by trial (`docs/figures/looks-style-trial.png`) with prompts alone — the
  reference the user showed was never given to the model. The woman's base was drawn from words (thin uniform dark
  sepia ink lines, hatching in the folds and shadows, flat muted fills without glossy highlights, refined anime eyes,
  about six and a half heads tall, a flat pale cream ground); every other picture is an edit, which keeps the style
  of what it edits. 8 steps were tried and drew no better than 4.
- **Bases** (`parts.py` `base_jobs`, `bases.py`): four whole figures, each with its own head — the woman's, the
  man's (her base with a man's body and then a young man's face in the same style, never her face: the first try
  with "masculine" words drew a realistic hard face in another style), the girl's from hers, the boy's from the
  girl's with a boy's face. `bases.py` clears the ground under each (the model likes to draw a shadow there).
- **Parts** (`parts.py`): one edit of a base per part and body, per mood for faces (from the face's neutral picture).
  Hair, beards and brows are drawn grey (their value is their shading); garments in key hues (pure red: colour 1,
  green: colour 2, blue: leather or metal, colour 3) so the cut can tell the zones apart; an outfit leaves the feet
  bare and the legs bare below it (stockings and shoes are their own parts).
- **Cut** (`extract.py`, `build.py`): each body's frame is read from its base (the head's top, the neck, the knees,
  the soles; the bust square). The part is what the edit changed (a colour distance over a tolerance, cleaned), only
  in its region (a hat on the head, shoes at the feet, nothing below the soles); edges are unmixed from the known
  background; hair outside the base figure becomes the layer behind the body; a face is what replaces the base's
  features (the same mask in every mood); zones by hue (key hues, the skin's hue band, the iris, grey for hair);
  lines take their neighbour's zone (coloured lineart); values anchored at the zone's median with a bounded gain
  (skin uses one mapping for every layer, so no seams).
- **Review**: `npx tsx games/openworld/tools/src/art/looks/review.ts out.png [mood]` composes everyone with the client's
  own code. `batch.py` runs the jobs (resumable; a job waits for the picture it edits).
- Outputs are CC0 with their prompts and workflow in the repository; the model's licence allows it.

## 5. The event model

- A look is its bearer's state. `restyle {parts?, colors?}` (effects.ts) changes only the host's look, through
  `World.setLook` (writer-guarded, checked against the table); the validator takes only the table's parts in their
  own slots and known colours. Dyeing hair or cutting it is an undefined act today: the modder's place to answer
  with `restyle`.
- The generator (`generateLook`) is seeded by the person's id: the same person, the same look. Authors pin what
  they choose (`PersonDef.look`); sex and age weigh parts (never forbid them); age brings grey hair and lines;
  role brings its clothes.
- A person with no look (one a rule or the modder makes) is drawn from a look generated from its id, never as a
  slime (`crowdLook`).
- What is worn shows (`wornLook`, `World.seenLook`): an item type says the part it is worn as (its `look` prop:
  the helmet `hat.helm`, the breastplate `armour.plate`, the cloak `cloak.cloak`, pauldrons `cloak.pauldrons`, the
  hat, the circlet, the crown of thorns), painted in its material's colour (`LookTable.materials`). The snapshot,
  the look's tags (`look:armoured`) and the modder's words are the look as seen; the bearer's own look is kept.
  Those parts are `gen.worn`: never drawn by chance, never offered in the creator.
- Loading: a save's people take the world's look unless theirs is `own`; a player who made a look keeps it; a
  sheet's key from before looks gets the world's.

## 6. Where it stands

The full-body library (2026-10-18): 4 bodies, each its own head; 6 faces x 6 moods on every body they are for (72
pictures), 15 hairstyles on each body (29), 3 beards, age lines, 2 marks, round glasses, 7 hats, 18 outfits (25 over
the bodies they fit), 3 legwear and 5 shoes, 3 worn pieces — 184 pictures. `docs/figures/looks-review.png` is
everyone as the game draws them.

The first library (2026-10-09, half-body, replaced): 4 bodies, 6 faces x 6 moods, 15 hairstyles, 3 beards, age lines, 2 marks, round glasses,
7 hats, 20 outfits (25 drawings over the bodies they fit), 3 worn pieces for both adult bodies — 98 pictures,
cut into 18 MB of layers. `docs/figures/looks-review.png` is everyone as the game draws them,
`looks-worn.png` what is worn, `looks-dialogue.jpg` the dialogue box in play.

The map figures (2026-10-18): the man, the woman and the child, each facing's walk and idle frame; 16 adult outfits
and 2 children's, 3 worn pieces, 15 hairstyles, 7 hats, 3 beards, the face's 5 variants, glasses, a scar, freckles and
age's lines — `docs/figures/figures-map.png` (standing, the four facings) and `figures-walk.gif` (walking).

## 8. The world filter (2026-10-18)

The map in the portraits' style, asked for after them ("基于相同的风格给游戏加一层滤镜"): the trial
`docs/figures/world-filter-trial.png` (four scenes captured from the game, filtered offline), the recommended
strength taken.

- **One shader pass** over the world camera (`runtime/src/render/worldfilter.ts`, a Phaser 4 filter on the main
  camera's internal list): the colours graded — desaturated, the bright yellow-greens further toward a sage, a little
  warmer, toned toward the duotone (the ink in the shadows, the paper in the lights, the colour only), an S-curve so it
  stays crisp, nothing darker than the ink; the art's own dark outlines turned to the ink; a paper's grain and a
  vignette; hatching where it is dark, more at night (the scene's darkness of the hour).
- **The world's own pixels**: the pass runs at the screen's pixels, but the outlines are judged against the world
  pixels round them and the hatching lies on every third world pixel (the camera's zoom), and the paper and the
  hatching are anchored to the world (the camera's view), so they move with it and never swim.
- **What must be read stays out of it**: the cells a blow is about to fall on are drawn by a second camera above the
  pass (`signalCamera`: it ignores everything the scene adds unless marked, and copies the main camera after it has
  moved each frame). Quest markers and the interface are the page's, never under it.
- **The game's look, the player's strength**: `ClientGame.worldFilter` gives the ink, the paper and two strengths
  (`light`, `full`; OpenWorld's in `client/src/game.ts`); the options choose off, light or full (`prefs.filter()`,
  full by default). A game with none (the starter) shows its art as it is; a canvas renderer too.

## 7. Not yet

- Unique figures: Lumi, the Seal-bearers' portraits.
- A bigger library (more hair, outfits per role and region, more faces), kin resemblance, regional palettes.
- A style LoRA for the house style (asked for 2026-10-18): musubi-tuner trains Qwen-Image-Edit only from the bf16
  transformer (about 41 GB; neither the fp8 nor the GGUF files) and wants 64 GB of RAM with block swapping; this
  machine has 32 GB and, that day, 18 GB of disk free. The edits hold the style without it; it matters most for
  figures drawn from words alone (the Seal-bearers).
