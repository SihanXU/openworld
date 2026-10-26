# Character art: portraits and event CGs

Status: **the direction agreed with the user (2026-10-24); the engine's part and the CG pipeline built, the CGs in
progress; release 1's cast has portraits of their own (built 2026-10-25, §4c).** How the people of the story get their
moments in a pixel world: the key people a portrait of their own in the dialogue box, and an illustration (a CG) where it
matters, drawn as a shot. The cast: Nessa ([cast/nessa.md](cast/nessa.md)), Lumi ([cast/lumi.md](cast/lumi.md)), Lina
([cast/lina.md](cast/lina.md)), Sister Ilse ([cast/ilse.md](cast/ilse.md)), Severin ([cast/severin.md](cast/severin.md)) and Tobin
([cast/tobin.md](cast/tobin.md)).

## 1. What it is, and what it is not

- **The visual novel's presentation, not its romance.** Portraits, expression changes, event CGs and a gallery to see
  them again; no routes, no dating. The setting is a dark religious tragedy whose hero ends as the next vessel
  (lore.md §16), and the game has no romance (wiki 友谊, "没有恋爱和结婚").
- **Few and earned.** A CG marks a person's moment — a meeting, a confidence, a discovery — never explains the setting.
  Part One keeps to the first layer of the truth (chapter-1.md §2): a CG may show what people misread, never the
  reading Part One does not give.
- **The protagonist's face is never drawn.** The player's look is their own (docs/looks.md); a CG shows them from
  behind, as a hand, or not at all.
- **Adults only in anything tender.** Mia and Pell (9) appear only in plain, warm scenes.

## 2. The style (decided with the user, 2026-10-24)

**The people keep their look portraits; the CGs take the visual novel's atmosphere.** (Changed the same day: the key people got
portraits of their own, designed to a sheet, §3–§4c; the rest keep their look portraits.) A person's design is their look
portrait in the game (docs/looks.md; `npx tsx games/openworld/tools/src/art/looks/person.ts <person id> <dir>` writes it in
every mood, its bust and its map sprite): the dialogue box keeps showing that portrait, and a CG draws the same person —
the same hair, glasses, clothes and colours. What a CG adds is the moment: the atmosphere of Innocent Grey's *FLOWERS*
and *天ノ少女* — luminous and soft, painterly gradients, light with bloom and haze, a shallow depth of field — and a
composition designed as a shot (§4). The figure in a CG is drawn in clean, delicate anime line; the portraits' ink and
hatching are not imitated there, the design is.

What was tried on the way, and why it was left (the trials: Nessa's sheet artifact):

| Tried | Left because |
|---|---|
| the portrait itself redrawn in a FLOWERS-like style (SDXL Animagine / Illustrious, Qwen, Neta) | the design drifts (collars, glasses, colours), and one person redrawn would clash with every other portrait |
| CGs in the portraits' own style (ink, hatching, cream paper) | the backgrounds come out pale and flat |
| a soft background first, the person put into it | right atmosphere, flat compositions: a full figure standing in a scene, like a portrait pasted on |
| **the shot drawn whole to a written spec, then the person made themself from their portrait** | kept (§4) |

**Never put an artist's name in a prompt, and never train on a living artist's work for what the game ships.** The game is
open source and its art ships with it (wiki 企划/美术: "能随开源代码一起发布"): describe the atmosphere, as the words below do.

The atmosphere every drawing ends with (`cg.py` `LOOK`):

> A soft, luminous Japanese visual novel event CG: delicate clean anime line art, gentle painterly gradients, tender
> rich colours, soft glowing light with bloom and light haze, shallow depth of field with a soft blurred foreground,
> cinematic composition, beautiful, elegant, dreamy.

## 3. Tools (as found 2026-10-24)

What matters: the same person across many images, the atmosphere, and a licence that lets the output ship with the
code. **In use**, on a local ComfyUI (a shared L40S; `CUDA_VISIBLE_DEVICES` one free card):

| Model | Licence | What it does here |
|---|---|---|
| **Neta Lumina 1.0** (`neta-art/Neta-Lumina`, the all-in-one file) | Apache-2.0 | the drawing pass: the composition, the light, the atmosphere |
| **Qwen-Image-Edit-2511** (GGUF Q4_K_M, the Lightning 4-step LoRA; the portrait pipeline's own, docs/looks.md) | Apache-2.0 | the identity pass: given the drawn shot and the person's portrait, it makes the person themself and keeps the rest |

Tried and set aside: Animagine XL 4.0 (OpenRAIL++) and Illustrious XL v2.0 (CreativeML OpenRAIL-M) redraw with a ControlNet
(xinsir union promax, Apache-2.0) — anime enough, but the person and the colours drift. Not tried: NoobAI-XL (FAIPL, read
its terms first), NovelAI V4.5 ([models](https://docs.novelai.net/en/image/models), hosted, *Precise Reference*),
Midjourney niji ([`--oref`](https://hunted.space/product/midjourney-omni-reference), hosted). Check a model's own card for its
licence before anything made with it goes into the repository.

## 4. What the game shows, and how a CG gets in

**Built (2026-10-24):**

- **A scene's picture** (`SceneCmd` `{ picture: 'lsw/CG/…' }`, engine `story.ts`): a CG over the world and the HUD, the
  lines going on over it with their portraits; `{ picture: null }` takes it away, and so does the scene's end. Kept in
  the scene's state, so a reload in the middle shows it again. A picture the game does not have leaves the scene
  playing over the world.
- **A card over a picture** (`{ card: …, art: 'lsw/CG/…' }`): the chapter's end on its illustration.
- **The fade kept** (`SceneState.dark`): a reload during a fade stays dark.
- **The portrait moves with its line's mood** (runtime `hud.ts`, `game.css`): one coming in slides up; a hop for
  joy, a start for surprise, a shake for anger, a sink for sorrow, a turn for shyness. The mood is the line's own
  (`say(who, en, zh, 'sad')`, a person's line's `{ mood }`, the `emote` command), so the motion always matches the
  words — the way Stardew's `$h` marks a line. Off under the system's reduced-motion setting.
- **A portrait of a person's own** (2026-10-24; §4c): the catalogue's `portraits` (runtime `assets/types.ts` `PortraitSet`) names
  the people who have one; the dialogue shows it in place of their look's bust, inside the box, its frame cutting it at the shoulders
  (200 px; no corner of the box behind the hair, no edge of the picture in the air, and the pixel world stays in front), a picture per
  mood; every face blinks once soon after its line begins (so one who reads fast sees it), then every three to four seconds (now and
  then twice), the eyes shut over whatever the mouth is doing, and moves its mouth for about as long as the line takes to say
  (~70 ms a character, a rest at a stop or a comma), whatever the typing's pace (`hud.ts` `ownFace`, `showFrame`, `speak`, `blinkLater`).
  The mood motions move the face, not its picture, so a blink never starts one again. Still with the system's reduced-motion setting.
  First: Nessa (`lsw/Portraits/nessa/`: six moods, each with `-blink` and `-talk`).
- **The editor**: *Show a picture* among a scene's commands, a card's picture.
- **Looking at one without playing to it** (dev): `lsw.send({ t: 'debug', op: 'scene', script: [{ picture:
  'lsw/CG/nessa/01-sunset.webp' }, { say: 'npc.nessa', text: '…', mood: 'happy' }] })`, or `id: '<step>'` to play a
  step of the story.

**Next:** the CGs into the scenes (cast/nessa.md §5), a gallery of the CGs seen as a page of the codex; perhaps a blink
and a talking mouth for the look portraits (the dialogue already types its words, `hud.ts` `type`) and the visual
novel's layout (the portrait standing at the screen's side). A person without a look (Lumi) needs a design of their own
first: a reference sheet the team chooses, which then serves as their portrait (Lumi's, done 2026-10-24: §4c).

**When a CG plays** — the story's triggers already say it (`StepCond`): a map and a region or spot, an hour, the
weather, a quest's stage, another step played. A person's moments hang on their errands (stage 100: handed in); no
system of hearts is needed for release 1. Triggers on regard (the society module's) would be an engine change and a
question for the team (they decided on 2026-10-02 not to copy Stardew's heart events).

## 4c. A person's own portrait

Decided with the user (2026-10-24): the key people get a portrait of their own, drawn as a visual novel's official character
design; in the dialogue it sits where a look's bust sits, small enough that the pixel world stays the picture (a large portrait at
the screen's side, or a visual novel's centred figure, was tried and left: on a pixel map it takes the screen). Within the box, not
over its edge: a portrait standing over the box's left edge showed the box's corner behind its hair, and one moved to cover it showed
the picture's own cut edge. A CG is where a person is seen large.

1. **The design**, by an online model from a brief (Nessa's: a turnaround, an expression sheet, a sprite), chosen by the team.
   From the second person on, the brief uploads Nessa's turnaround as picture 1, "a style reference only", so every sheet is drawn
   by the same hand (Lumi's brief, [cast/lumi.md](cast/lumi.md)). The local models were tried first for Lumi and did not reach it
   (generic faces, elf ears on a fairy whatever the words said); the online sheet did.
2. **The sprite** drawn on white (knees up, or the whole figure for one who floats; three-quarter, even light), in the chosen colours.
   From a sheet, Qwen-Image-Edit draws it well locally (Lumi's: the sheet as picture 1, twelve tries). A neutral pose — a hand at the
   chest, not a wave — since the pose is kept under every mood. Every own portrait faces right, toward the dialogue's text; one drawn
   facing left is turned by the cut (`mirror`), its regions written in the turned sprite's pixels.
3. `games/openworld/tools/src/art/portraits/portrait.py cut <person>.json <sprite> <work>`: cut out, the white un-mixed from the
   edges and keyed out of black hair's edge; the person's `keep` boxes (a feather, earrings, the face) untouched.
4. `portrait.py moods`: each mood the face alone edited, pasted back; then every face's blink and talk, the expression kept, taken
   only from their eyes' and mouth's regions (a blink asks for no blush where the mood has none). Where the brows are faint or under
   the bangs, a mood asked to move them while the old ones stay gets a second pair drawn over the first (four eyebrows, Lumi's angry
   and Lina's): such a mood redraws only the eyes and the mouth (`moodFeatures`, a hard edge, `featuresBlur` 3), its feeling in the
   lids and the mouth, each eye's region wide enough to take the old lashes' tail. Where the sheet's face does move the brows (Ilse's
   angry and surprised), the mood's region takes the whole brow with room above it (`brows`) and its words say one thin brow over
   each eye, the old lines gone (`moodKeepAlso`): the old brow is redrawn, not doubled. Several seeds, compared large with the sheet's
   face, the one chosen written down (`moodSeeds`). A talk frame opens the mood's own mouth across its own width (a smile turning into a
   small oval reads as one big, one small), the sheet's speaking face as its picture 2 where it helps (`moodFrames` `ref`). Nothing on a face
   is drawn by hand: a fault is mended by the model, a second pass over the one feature (`moodTouch`) or another face's frame (`moodFrames`).
5. Looked at on a dark ground and a light one, the frames played in a dialogue box; then `portrait.py ship` → `lsw/Portraits/<person>/`
   (400 px square WebP, shown at 200; the bust framed so the head is in the middle of what the box shows), and the person's entry in
   the catalogue's `portraits`. A person with a panel of the game's own also gets a wider picture per mood (`panel`: Lumi's, with
   both wings, in her companion panel in place of her look's portrait).
6. Their look record follows the design where the map sprite can (Nessa: `hair.long`).

## 4b. How a CG is made

The tools: `games/openworld/tools/src/art/cg/` — `refboard.py` (references), `cg.py` (draw, identity, detail), and per
person a book of shots, `shots/<person>.json` (each shot's scene, camera, framing, light, references and drawing words).

1. **References by what the shot holds.** `python -I refboard.py <work dir> <name> "game_cg candle" "game_cg reading glasses" …`
   searches Safebooru (all-ages) by tags, best scored first; `game_cg` keeps to official game CGs. Thirty or so per shot,
   on a contact sheet; three or four kept, their links in the shot's `refs`. They are studied, never fed to a model,
   never shipped; what is not for all ages is skipped.
2. **The shot's spec**, from them, written in the book: the **camera** (eye level, from above, from below, how far tilted,
   the lens), the **framing** (how much of the frame's height the person takes, where the face sits, what is in front
   and behind) and the **light** (the key and where from, the rim, a second light, warm against cool). Then the drawing
   words: the spec in prose, the person only as a short sketch (`{who}`).
3. **Draw.** `python -I cg.py draw shots/<person>.json <shot> <portrait.png> <out> --seeds 1,2,3,4,5,6`: Neta Lumina draws
   each seed to the spec (16:9, 1664×928), then Qwen makes the person themself from their portrait (`<shot>-s<n>.png`; the
   drawing kept as `-raw`). About 35 seconds a seed.
4. **Pick** against a checklist: one person; the design whole (for Nessa: the bob and its blunt bangs, the round glasses,
   the high collar, the cream waistcoat and its brass buttons); the props right (a pocket watch, not a mirror); hands; the
   spec kept. A shot whose identity pass went wrong in one way everywhere gets its own words (`identity` in the book) and
   `cg.py refix` over the drawings.
5. **Detail.** `python -I cg.py detail shots/<person>.json <shot> <chosen.png>`: the chosen picture drawn again at the
   game's size at strength 0.2 (`-hd20.png`, 1920×1080).
6. **The file** (§5), and the scene's `picture` command.

What the references taught (FLOWERS, 天ノ少女 and the `game_cg` boards): the camera is close — half-body, bust and face
close-ups, the body cut by the frame — almost never a full figure in a wide scene; the horizon and the figure are tilted,
lines run diagonally; something blurred in front (petals, a curtain, a book, grass) leads the eye to the face; the light
comes from behind — a window, the low sun — with a bright rim round the hair, and a haze over everything; an object alone
can be the CG (an open book); the camera moves — from above for one lying down, over a shoulder, from below against a sky.

What the pipeline taught (2026-10-24): a face close-up given as a second reference makes a second person; a long drawing
prompt bends small props; glasses pushed up need "the only pair, nothing over her eyes" or a pair is added; the identity
pass can leave hatching in a sky (pick it out); the detail pass at 0.3 already moves the eyes' colour.

## 5. The files

| What | Where | Size |
|---|---|---|
| CG | `games/openworld/public/assets/lsw/CG/<person>/<nn>-<name>.webp` | master 1920×1080 PNG kept outside the repo; in the game WebP, quality ~85, 1920×1080 (about 200–400 KB) |
| a shot book | `games/openworld/tools/src/art/cg/shots/<person>.json` | — |
| drafts, seeds, reference boards | outside the repository (or a team drive) | — |

**A CG's frame.** 16:9. The dialogue box covers the lower 30% of the screen, centred, about 60% of its width: faces and
what the moment is about stay in the upper 70%. The screen may be narrower than 16:9 (the picture is fitted whole, the
rest black), so nothing that matters at the very left or right edge.

