# Every person is a "look": one record drives the map sprite, the portrait, and the person's tags and words

## What is wanted

People in the game are currently described by an old numeric `Appearance` (and a `PLAYER_LOOK` constant), and the map figure, portrait and any descriptive tags are not derived from one place. Replace this with a single **look** record on each entity: a body, one part per slot, and one colour per colour key. Everything about how a person appears should come from that record, so the sprite, the tags and the words cannot disagree.

Concretely:

- The engine has a `Look` type and a look table on the ontology (`Ontology.looks`). The engine can validate a look against the table, derive `look:*` tags from a look, and produce a restyled copy of a look.
- Tags of the form `look:*` are derived from the look. They are never stored, but they show up in `World.view(...).tags` and in `World.hasTag`.
- A new `restyle` effect lets a rule change its host's look (parts and/or colours). The validator accepts only parts and colours that exist in the table, and rejects mismatched slots.
- Content supplies the look table (bodies, parts with words in English and Chinese, tags, generator weights, named colours), a deterministic look generator seeded by a person's id, a description function, and the player's look.
- Every person in `PEOPLE` has a `gender` and may pin some look parts; everything not pinned is drawn deterministically from their id. A person with no look gets a generated one.
- The client composes a 16x32 map sprite sheet (4 facings × 4 walk frames) from the look using code-defined pixel grids, and colours it from the same named colours that the portrait uses.
- The old numeric appearance is gone. `Entity.look` is now the look record (it was previously something else, such as a character id string, so code that reads it as a string needs to cast).

## Expected behaviour

**Look table (content)**
- Every part lives in a known slot; its id starts with `<slot>.`; its bodies (if restricted) are known bodies; every colour it names is a known colour; its words exist in both `en` and `zh`; every tag it gives starts with the look tag prefix (`LOOK_TAG`, i.e. `look:`).
- Every colour has a `#rrggbb` hex.
- `buildOntology().looks` is the very same object as `LOOK_TABLE`.

**Map sprite parts (client)**
- Every part in the table, except those in the `age` slot, has map pixel grids in the corresponding table (faces, hairs, beards, hats, glasses, marks, outfits). Nothing is drawn that is not in the look table.

**People**
- `generateLook(id, { sex, age, role }, pins)` is deterministic and yields a valid look (no problems from `lookProblems`), with at least a face and an outfit.
- Children (age < 14) get a child body; adults get an adult body; the body's sex equals the person's gender.
- No two people in `PEOPLE` share the same `lookCode`.
- People aged 60 or more (except `npc.alberic`) show it through the tag `look:old` or `look:grey-haired`.
- `PLAYER_LOOK` is a valid look.
- Entities built into the Ford world have their `look` equal to the one generated from their person record (`generateLook(p.id, {sex, age, role}, p.look)`).

**Tags** (`lookTags(look, table)`; `tagsOfLook(look)` in content)
- A man with `face.stern`, `hair.thin`, `beard.full`, `outfit.apron` and hair colour `snow` has `look:balding`, `look:bearded`, `look:grey-haired`, `look:bare-armed`, `look:stern`. Changing the hair colour to `copper` gives `look:red-haired`.

**Words** (`describeLook(look, { age })` returns `{ en, zh }`)
- A woman aged 71 with `hair.bun`, `face.soft`, `outfit.shawl`, hair `silver`, eyes `leaf`, `outfit.1` `plum` is described in English containing "old woman", "silver hair in a bun", "green eyes", "plum dress", and in Chinese containing "银发髻" and "梅紫色长裙".

**Restyle**
- `restyled(look, { parts, colors })` returns a look with those parts/colours replaced and `own: true`; tags follow (e.g. hair colour `copper` → `look:red-haired`).
- `lookProblems` reports, for a hair slot filled with `outfit.dress`, a message matching `is a outfit, not a hair`; for a `beard` on a woman's body, a message matching `not drawn for the body woman`.
- A rule with `{ op: 'restyle', parts, colors }` on a host, when dispatched, changes the entity's `look` (parts and colours), sets `own: true`, and `World.hasTag` / `World.view(...).tags` reflect the new derived tags (e.g. becoming `look:grey-haired` after dyeing the hair `snow`).
- `validatePatch` on a rule containing `restyle`:
  - accepts `hair.bob` and colour `copper`;
  - rejects an unknown part with an error containing `unknown look part "hair.mohawk"`;
  - rejects a wrong-slot part with `hair.bob is a hair, not a hat`;
  - rejects an unknown colour with `unknown colour "chartreuse"`.

**Map sprite composition**
- `composeSprite(look)` returns RGBA pixels for a 4×4 sheet of `FW`×`FH` (16×32) frames: length `FW*4 * FH*4 * 4`. In every facing's first-row frame, the opaque pixels' lowest row is between 26 and 30 inclusive, and the figure has opaque pixels within the frame.
- The sprite paints hair in the three tones of the hair colour (`ramp3(rgbOf(colour))`: light, mid, dark); all three appear in the output.
- `gradient(rgb)` returns a 256-step RGB table whose entry at value 180 equals the colour itself, i.e. the mid tone of `ramp3`.

## Requirements

- One `Look` record per entity, on `Entity.look`, with: `body` (id), `parts` (slot → part id), `colors` (key → colour id), and an optional `own` flag set by a restyle.
- `look:*` tags are derived at read time (in `World.view` and `World.hasTag`), never stored on the entity.
- `restyle` is a host-only effect, applied through a world method that validates against the table; the validator accepts only the table's parts and colours and checks slot match.
- Look generation is deterministic from the person's id and pins; the same input always yields the same look.
- A person's own pins win over generation; unpinned slots are drawn.
- The sprite's and the portrait's hair colours come from the same named colour.
- The old numeric `Appearance` and the old `PLAYER_LOOK` are removed/replaced by the new ones.
- Saves keep a look that the world changed (`own`) or that the player made; otherwise they take the world's.
- Existing code that read `Entity.look` as a character id string still works when cast.

## Interface

Engine (`@lsw/engine`):
- `type Look = { body: string; parts: Record<string, string>; colors: Record<string, string>; own?: boolean }`
- `const LOOK_TAG: string` — the `'look:'` prefix.
- `type Mood` — a portrait mood.
- `lookCode(look: Look): string` — a canonical string for a look.
- `lookProblems(look: Look, table: LookTable): string[]` — empty when valid.
- `lookTags(look: Look, table: LookTable): string[]`.
- `lookColor(look: Look, key: string, table: LookTable): string | undefined` — the colour a key has (its own, else its part's default).
- `restyled(look: Look, change: { parts?: Record<string,string>; colors?: Record<string,string> }): Look` — a copy with the changes and `own: true`.
- `type LookTable` — the table type (bodies, parts, colours, slots).
- `Ontology.looks: LookTable`.
- `World.setLook(...)` — host-only, table-checked.
- Rule effect `{ op: 'restyle', parts?: Record<string,string>, colors?: Record<string,string> }`.

Content (`@lsw/content`):
- `LOOK_BODIES`, `LOOK_COLORS`, `LOOK_PARTS`, `LOOK_SLOTS`, `LOOK_TABLE` — the table. Each part has `slot`, optional `bodies`, optional `colors`, optional `gen` (with optional `colors` options), `say: { en, zh }`, optional `tags`. Each body has `age` (`'child' | 'adult'`) and `sex`. Each colour has `hex`.
- `PLAYER_LOOK: Look`.
- `generateLook(id: string, traits: { sex?: string; age?: number; role?: string }, pins?: Partial<Look>-like pins): Look`.
- `describeLook(look: Look, opts?: { age?: number }): { en: string; zh: string }`.
- `tagsOfLook(look: Look): string[]`.

Tools (`packages/tools/src/demo/people.ts`):
- Each entry of `PEOPLE` has `gender` and an optional `look` pins field, alongside `id`, `age`, `role`.

Client (`packages/client/src/assets/figure/`):
- `pixparts.ts` exports `FACES`, `HAIRS`, `BEARDS`, `GLASSES`, `HATS`, `MARKS`, `OUTFITS`: records keyed by part id.
- `sprite.ts` exports `FW` (16), `FH` (32) and `composeSprite(look: Look): Uint8ClampedArray | number[]` (RGBA, length `FW*4*FH*4*4`).
- `color.ts` exports `rgbOf(colour: string | undefined): [number, number, number]`, `ramp3(rgb): [RGB, RGB, RGB]` (light, mid, dark), `gradient(rgb): Uint8Array` (256×3), `shade`, `keyRgb`, `hexRgb`, and `type RGB`.
- `ids.ts` exports `figureId(look)` and `crowdLook(id, type, age?)`.
