# Looks: the character creator every body is drawn from

Agreed with the user 2026-10-08/09: an anime (二次元) character creator from which every person — the hand-written
people, the crowd, the player, one the modder brings — gets a matching map sprite, portrait (立绘) and tags.
Defaults the user accepted: map figures 16x32, half-body portraits, every humanoid in the system, a `gender`
on people, all 24 people converted, the player makes their own look; the portrait art is drawn by a model
hosted locally.

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
  parts: Record<string, string>        // slot → part: hair, face, beard, age, mark, glasses, hat, outfit
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
- The man's and the boy's bases are the woman's and the girl's heads on their own bodies, so every head part
  (hair, faces, hats, beards, glasses, marks, age) is drawn once and fits both.

## 3. Three outputs from one record

1. **Map sprite** (`client/src/assets/figure/sprite.ts`): a 16x32 anime chibi, the sheet layout the renderer
   reads (columns down, up, left, right; rows the walk). A body template draws the bald figure with region letters
   (skin, torso, arms, hands, legs, feet) per facing and frame; an outfit paints the regions in its colour keys
   and draws over them (skirts, aprons, stoles); head parts are drawn once per facing and follow the bob; left is
   right mirrored; a dark outline goes round the figure last. Grids: `pixparts.ts`, `pixhair.ts`, `pixhead.ts`,
   `pixoutfit.ts`. Composed on demand into a canvas texture named by the look's code (`figure/index.ts`).
2. **Portrait** (`figure/portrait.ts`): a 768x768 half-body bust composed from layers in a fixed stack
   (`hairBack, body, outfit, armour, cloak, age, face, mark, beard, glasses, hair, hat`; the hair goes under a covering hat). A layer is its paint and its
   value map (value, zone, coverage); zone k is repainted through the gradient of its colour key. A face part has a
   layer per mood; what the speaker's statuses show on the map (wet, burning, frozen, oiled…) washes over it
   (`figure/index.ts` WASH). The dialogue box shows it standing at its left (`ui/hud.ts`, `game.css .dialog.bust`); the
   codex shows the sprite; the wiki both (`wiki/src/looks.ts`).
3. **Tags and words**: `lookTags` (engine) derives `look:*` tags from the parts and colours — never stored, read
   by `World.view` and `hasTag`, so rules can address "the hooded"; `lookWords` (engine) gives the modder's
   `EntityInfo.look`; `describeLook` (content) the codex's, the wiki's and the creator's sentence in both languages.

Colour: one colour per key gives both ramps (`figure/color.ts`): the sprite's three tones and the portrait's
gradient (lines → shadow → the colour at value 180 → light → highlight), with painters' hue shift. The hair on
the map and in the portrait is the same colour by construction.

## 4. The art pipeline (`games/openworld/tools/src/art/looks/portrait/`)

- **Model**: Qwen-Image-Edit-2511 (Apache-2.0) in a local ComfyUI: GGUF Q4_K_M transformer, fp8 Qwen2.5-VL
  encoder, VAE, Lightning 4-step LoRA (`setup.md`, `download.sh`). `comfy_node.py` keeps the edit's reference at the
  input's size, so a 768x768 edit leaves every pixel where it was. About 30–60 s a picture on an RTX 5080 laptop.
- **Bases** (`parts.py`, `bases.py`): a bald woman in a plain tank top on flat grey, drawn once; the man's body
  drawn by an edit and her head pasted back; the girl's base likewise, the boy's from it.
- **Parts** (`parts.py`): one edit of a base per part, per mood for faces (from the face's neutral picture). Hair,
  beards and brows are drawn grey (their value is their shading); garments in key hues (pure red: colour 1, green:
  colour 2, blue: leather or metal, colour 3) so the cut can tell the zones apart.
- **Cut** (`extract.py`, `build.py`): the part is what the edit changed (a colour distance over a tolerance,
  cleaned); edges are unmixed from the known background; hair outside the base figure becomes the layer behind
  the body; a face is what replaces the base's features (the same mask in every mood); zones by hue (key hues,
  the skin's hue band, the iris, grey for hair); lines take their neighbour's zone (coloured lineart); values
  anchored at the zone's median with a bounded gain (skin uses one mapping for every layer, so no seams).
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

## 6. Where it stands (2026-10-09)

The first library: 4 bodies, 6 faces x 6 moods, 15 hairstyles, 3 beards, age lines, 2 marks, round glasses,
7 hats, 20 outfits (25 drawings over the bodies they fit), 3 worn pieces for both adult bodies — 98 pictures,
cut into 18 MB of layers. `docs/figures/looks-review.png` is everyone as the game draws them,
`looks-worn.png` what is worn, `looks-dialogue.jpg` the dialogue box in play.

## 7. Not yet

- Unique figures: Pip, the Seal-bearers' portraits.
- A bigger library (more hair, outfits per role and region, more faces), kin resemblance, regional palettes.
- A style LoRA for a house style, once the art direction settles.
