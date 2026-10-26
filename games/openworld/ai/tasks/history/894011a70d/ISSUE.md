# Chapter 1 groundwork: profession weapons, Pip the fairy and her boons, the White Knight Alberic

## What is wanted

Three connected changes to the engine, content and client.

1. **Profession weapons.** Dagger, sword, bow and staff become tied to a profession. A weapon fights only for its own profession. The warrior's shield is worn in a separate off-hand (arm) slot.
2. **Pip the fairy and her boons.** The companion Pip becomes a fairy, with her own pixel art. Older saves where Pip is a bird are migrated to the fairy. Pip carries *boons*, one active at a time. A boon is a seal's power, given by the story. The player chooses which boon she carries only beside a woken waypoint statue. The first boon is Crown's Insight: the leader's XP gain +100%.
3. **Bosses.** The seven-sins roster is cut down. The Crown Without a King, the Velvet Lure and the Face Thief remain. The old kits' art stays on disk. A new boss, the White Knight Alberic, First Seal-bearer, is added with art, kit, effects and a 20 fps animation pipeline in the client. The boss challenge and review pages use the current content roster, not whatever an older fetched map index lists.

## Expected behaviour

### Profession weapons
- A weapon of a profession's kind (bow → ranger, staff → mage, dagger → assassin, sword → warrior) works as a weapon only when the holder has that profession.
  - Held by someone of another profession, or by someone with none, it does not strike.
  - Common weapons take no profession talents.
- The warrior's starting loadout is sword and shield. The shield sits in the off-hand slot, which gives block.
  - The player can wear a carried item there or take it off (protocol message `wear`).
- Each profession has two legendary arms, dropped by fallen bosses.
- The boss challenge equips the warrior with sword and shield, and the mage with a staff rather than a wand. The mage's challenge weapon is renamed "Challenge Ember Staff" / "试炼·炽焰法杖". Tooltips know the player's profession.

### Companion and boons
- Pip is an entity of type `actor/companion/fairy`, tagged `airborne`, drawn from the project's own art. The catalog key is `creature:fairy`.
- The fairy sheet is `lsw/Companion/Fairy/SpriteSheet.png`, 64×16, 4 frames in 1 row. Its faceset is `Faceset.png`, 38×38. Both are RGBA PNGs.
- `migrateCompanion(game)` turns an older save's bird Pip (`actor/companion/bird`) into the fairy.
  - Any boon already given is kept.
  - The layout fact `COMPANION_LAYOUT` becomes true.
- The story gives a boon through a `notify` with `what: 'boon'` and `unlock: <id>` on Pip.
  - The boon is kept and carried at once if she carries none.
  - Giving it again changes nothing.
- A boon is a status on the companion. Its `lead:<stat>` props raise the *leader's* stat, so `xp` (Crown's Insight) gives the leader `xpRate` 1, and `xpRate` is 0 without it.
  - Experience from a `defeat` notify is multiplied by `1 + xpRate`. For example, 5 XP becomes 10.
- Choosing a boon: `controls.chooseBoon(id)` returns `true` and swaps the carried boon only when both of these hold:
  - the boon has been given;
  - the player stands beside a woken (attuned) waypoint statue.
  - Otherwise it returns `false` and nothing changes.
  - After a swap the leader's stats follow the new boon (a `lead:atk: 3` boon adds 3 to `atk` and removes the XP bonus).
- Touching a woken waypoint statue emits a `panel` fx with `panel: 'boons'`. The client opens the boons panel on it, and its choice is sent as a `boon` message.
- The frame snapshot's `player.boons` reports `{ unlocked, active, atWaypoint }`.

### Bosses
- `actor/creature/sin/greed` and the other withdrawn sins no longer exist. Lust, envy and pride remain (art kept), plus the new Alberic.
- The content exports `BOSS_ARENA` (the arena the boss is placed in), replacing `FIRST_BOSS`. `BOSSES` is the current roster.
- Challenge and review progress text counts against `BOSSES.length`, not a hard-coded 7.
- The boss review page is rebuilt on a testable bootstrap, `createBossStudio`. It also gets a preview of every authored animation, built on `previewBoss`, which touches only the render snapshot.

### Alberic animation
- Alberic's kit has three skills: arrow, volley and thorns.
- His actor art is a 32-column × 21-row atlas of 128 px frames. That is 3 directions (down, side, up) × 7 actions (idle, walk, thorns/attack, arrow/cast, volley/cast, hurt, death). The atlas is `lsw/Bosses/alberic/v5/actions.png`, anchored at y 88, scale 1.25.
- Effects are 6-frame strips in `lsw/Bosses/alberic/v3/` (`effect-arrow.png`, `effect-volley.png`, `effect-thorns.png`). Arrow is a directional beam.
- Row selection is `action row + 7 × direction`, with direction down → 0, left/right → 1, up → 2. Left and right share the side row.
- Frame selection by `bossAnimationFrame(boss, time, offset, facing)`:
  - Idle and walk loop through their clip at 20 fps.
  - Attack and cast: the wind-up covers progress [0, .5) using the first half of the clip, and release and recovery cover [.5, 1] using the second half. A pose of the second half never shows before the engine resolves a telegraph.
  - Hurt and death step through the clip and clamp on the last pose. They never loop.
  - Progress that is NaN or out of range is clamped to [0, 1].
  - For the cast clip, the progress samples 0, .249, .25, .499, .5, .749, .75, 1 and 4 give columns 0, 6, 9, 15, 16, 22, 25, 31 and 31.
- Other bosses keep their old 20-frame layout, pacing, and two-frame death selection.
- Between 10 Hz simulation snapshots, a `BossAnimationClock` keeps the pose advancing at 20 fps:
  - When the snapshot carries `animationElapsedMs`, the elapsed time is that value plus at most one extra tick of wall time.
  - Repeated paused snapshots do not rewind the pose.
  - A telegraphed wind-up cannot cross into the release half until an authoritative snapshot says so.
  - The snapshot itself is never mutated.

### Art and docs
- The Alberic body atlas and the effect strips are transparent, distinct frames. They have clear borders, no opaque backgrounds, and no duplicate frames across the 672 body frames and 18 effect frames. Idle and walk keep a steady baseline and horizontal registration across rows.
- Prompt manifests `docs/alberic-art-v3-prompts.json`, `v4` and `v5` record the generation, the overhead camera, the directions and the per-action prompts. Their structure is pinned by the art checks.
- Story docs `docs/lore.md` and `docs/chapter-1.md` are added.

## Requirements

- A profession weapon in the hands of a character of another profession (or none) cannot strike. Existing sword, bow, staff and dagger scenarios must set the matching profession to work.
- An off-hand slot exists, with the exported `OFFHAND` key. The warrior's shield goes there, and the `wear` message can put on or take off an item.
- Boons are given by the story and kept once. At most one is active. Choosing is refused anywhere but beside a woken waypoint statue, and refused for a boon not yet given.
- The XP boon doubles XP from defeats.
- Boon effects on the leader are read through the companion's status props.
- The old bird Pip migrates to the fairy without losing boons.
- The fairy exists as an `airborne` companion with sheet and faceset at the stated sizes.
- The withdrawn sins are gone from content, while their art files stay.
- Alberic is in the roster with the arrow, volley and thorns skills. His art, effects, clips and animation selection match the numbers above.
- The following clip contents are exact, in atlas columns. All 7 clips use distinct columns within 0..31:

  | clip | columns |
  |---|---|
  | idle | 0,4,8,12,16,20,24,28 |
  | walk | 0,3,6,10,13,16,19,22,26,29 |
  | thorns | 0,3,6,9,12,15,16,19,22,25,28,31 |
  | arrow | same as thorns |
  | volley | same as thorns |
  | hurt | 0,4,8,12,16,21,26,31 |
  | death | 0,3,6,9,12,15,18,21,24,27,30,31 |

  - For thorns, arrow and volley, the first six columns are below 16 and the rest are 16 or above.
  - Clip lengths in order idle, walk, thorns, arrow, volley, hurt, death are 8, 10, 12, 12, 12, 8, 12.
  - The constants are `ALBERIC_FPS = 20` and `ALBERIC_FRAME_MS = 50`.
- Challenge and review bootstraps use the current `BOSSES` rather than the map index's list, so a new boss is seen as a boss.
- Nothing mutates the live boss state or the saved encounter during a preview.

## Interface

**`@lsw/engine`**
- `OFFHAND` — the prop/slot key for the off hand.
- `boonsOf(world, companion): string[]` — the given boon ids.
- `activeBoon(companion): string | undefined` — the carried boon id.
- `Engine.controls.chooseBoon(id: string): boolean`.
- `snapshot(engine).player.boons?: { unlocked: string[]; active?: string; atWaypoint: boolean }`.
- `EntitySnap.boss` gains optional `skill?: string` and `animationElapsedMs?: number`, with `kit` being the kit id.
- `FxEvent` panel `'boons'`.
- Stat `xpRate`, and the `lead:<stat>` convention in status props.
- Profession weapon rule in `engine/src/profession.ts`; boons in `engine/src/boons.ts`.

**`@lsw/content`**
- `BOSS_ARENA` (replaces `FIRST_BOSS`), `BOSSES`, `BOSS_BY_ID`.
- `COMPANION_LAYOUT` (fact key).
- `migrateCompanion(game: Game): void`.
- Entity types `actor/companion/fairy` and `actor/companion/bird`. `item/weapon/...` types for the profession weapons.
- Boon status ids (including `boon_*` entries), plus the XP boon given by the story rules via the `notify` described above.

**`packages/client`**
- `src/assets/bosses.ts`: `ALBERIC_ATLAS_COLUMNS` (32), `ALBERIC_FPS`, `ALBERIC_FRAME_MS`, `ALBERIC_CLIPS` (keys idle, walk, thorns, arrow, volley, hurt, death), and `SIN_ACTORS['boss:sin:alberic']` / `SIN_FX['sin:alberic:{arrow,volley,thorns}']` entries.
- `src/assets/types.ts`: `FxDef.originY?: number`, `FxDef.beam?: boolean`.
- `src/render/boss-animation.ts`: `bossAnimationFrame(boss, time, offset?, facing?): { col: number; row: number }`, and `class BossAnimationClock` with `receive(boss, time)`, `progress(time): number` and `elapsed(time): number | undefined`.
- `src/boss-preview.ts`: `BossPreviewMode`, `bossPreviewModes(kit)`, `bossPreviewMode(value, kit)`, `previewBoss(entity, mode, elapsedMs)`.
- `src/boss-studio.ts`: `createBossStudio(index, raw, bossId): Game`.
- `src/protocol.ts`: `ToWorker` messages `{ t: 'wear'; item?: string }` and `{ t: 'boon'; id: string }`.
- Catalog key `creature:fairy`, replacing `creature:parrot`.
- Assets: `public/assets/lsw/Companion/Fairy/{SpriteSheet,Faceset}.png`, `public/assets/lsw/Bosses/alberic/v5/actions.png`, `.../alberic/v3/effect-{arrow,volley,thorns}.png`.
- Docs: `docs/alberic-art-v3-prompts.json`, `docs/alberic-art-v4-prompts.json`, `docs/alberic-art-v5-prompts.json`, `docs/lore.md`, `docs/chapter-1.md`.
