# Boss encounters

Status (2026-10-05): **the White Knight Alberic** (白骑士·阿尔贝里克), the First Seal-bearer and
Chapter 1's boss, is built (docs/chapter-1.md §4: art, kit, effects; `docs/alberic-art.md`, 128x128
overhead frames in three directions, a 3x2 body). Besides him, three authored encounters remain — **the Crown Without a King** (无王之冠),
**the Velvet Lure** (绯愿兰后) and **the Face Thief** (窃面者). The earlier "seven sins" setting is
withdrawn with the four other kits (the Gilt Tollkeeper, the Banquet Maw, the Drowsing Monastery,
the Cinder Executioner): their code, lore and gallery entries are gone; their art stays in
`packages/client/public/assets/lsw/Bosses/` for later use. None of the three has a campaign place
yet; the story's bosses are being redesigned (docs/chapter-1.md). The internal ids (`pride`,
`lust`, `envy`, types `actor/creature/sin/<id>`) are unchanged.

## Where they can be fought

- **Boss Studio** (`/boss-gallery.html`): the real engine, East Road terrain, Phaser renderer and
  HUD, without reading or writing saves. Choose a boss, inspect its animation modes, trigger its
  skills, or fight with WASD and Space (200 HP, 8 attack; not campaign balance).
- **Boss Challenge** (首领挑战, the title screen's button, `/boss-gallery.html?challenge=1`): pick
  one of the four and a level-20 profession (assassin dagger, warrior sword and shield, ranger
  bow, mage fire staff), each with its six profession talents and four shared starter talents.
  Selection pauses; Escape pauses; victory and defeat offer retry. Nothing is saved.
  `client/src/boss-challenge.ts` owns the disposable bootstrap.
- Both stage the fight in the East Road's clearing (`BOSS_ARENA`, `(23,15)`); no campaign boss
  stands there.

## Roster

| Boss | Collision | HP / armor | Silhouette and palette |
|---|---|---|---|
| 白骑士·阿尔贝里克 / The White Knight Alberic (`alberic`) | 3 × 2 | 1200 / 2 | Great helm grown through with a crown of thorns, torn white tabard with a gold cross and old blood, longsword point down, bow and quiver; ivory / steel / gold / briar |
| 绯愿兰后 / The Velvet Lure (`lust`) | 5 × 3 | 1600 / 2 | Orchid mantis with porcelain mask, petal mantle and thorn vows; wine / ivory |
| 窃面者 / The Face Thief (`envy`) | **1 × 1** | 1000 / 1 | Small masked assassin, stolen mirror face and twin glass daggers; emerald / bone |
| 无王之冠 / The Crown Without a King (`pride`) | 5 × 4 | 2600 / 3 | Peacock gargoyle, hollow crown head and floating mirror plates; lapis / ivory / gold |

The Velvet Lure expresses desire through impossible promises and floral entrapment, not
sexualized anatomy. The Face Thief's small silhouette is intentional: fast readable tells, low
armor and a blink, against two monumental bodies.

## Skill kits

Seconds at 10 ticks/s; damage is raw, before armor and talents. Each boss cycles three skills in
order; its colour marks the exact cells that will resolve. Ring interiors and the spaces between
spot marks are safe.

| Boss | Skill | Shape / radius | Wind-up / recovery | Damage and effect |
|---|---|---|---|---|
| White Knight | 征服之矢 / Arrow of Conquest | Three-wide line ahead, 8 | 1.8 / 1.4 | 30 |
| | 白羽箭雨 / White-Feather Volley | Five target-centered spots, 4 | 2.0 / 1.4 | 24 |
| | 荆冠·屈膝 / Thorns Bend the Knee | Self-centered ring, 4 | 2.2 / 1.4 | 34; kneel (immobilize 0.8 s) |
| Velvet Lure | 绯瓣弧斩 / Velvet Crescent | Forward cone, 7 | 1.6 / 1.0 | 30 |
| | 虚愿花印 / False Promise | Five target-centered spots, 4 | 1.8 / 1.0 | 24; pull, then immobilize 0.8 s |
| | 荆棘誓约 / Thorn Covenant | Locked target cross, 6 | 2.0 / 1.2 | 32; mired 2.5 s |
| Face Thief | 借影双刃 / Borrowed Blades | Forward cone, 3 | 1.0 / 0.8 | 24 |
| | 碎面镜雨 / Shattered Faces | Five target-centered spots, 3 | 1.4 / 1.0 | 20 |
| | 窃步瞬身 / Stolen Footstep | Locked target disk, 2 | 1.2 / 0.8 | 24; blink beside the target's old place |
| Crown | 王翼斥退 / Royal Rebuff | Forward cone, 7 | 1.8 / 1.2 | 42; push one cell |
| | 完美镜裁 / Perfect Reflection | Locked target cross, 7 | 2.2 / 1.4 | 36 |
| | 万象俯首 / Kneel Before the Crown | Locked target ring, 5 | 2.4 / 1.6 | 44; stay in its centre or clear the rim |

Phase II begins at 50% HP: wind-ups 20% shorter (never below 0.8 s), damage +35% (rounded),
recovery 35% shorter (at least 0.6 s). The locked aim stays dodgeable in both phases. Mired
multiplies movement delay by 1.7, not attack delay. Hits follow faction hostility, never "is it
the player". Pushes and blinks never pass through occupied or solid tiles.

## Runtime and saves

- `content/src/bosses.ts`: names, footprints, stats, kits, statuses and defeat rules (a fallen
  boss goes down for two seconds, leaves four iron ore and whatever it held, tells the story
  `sins.defeated.<id>`, and — for a feller with a profession — the next legendary of their
  profession not yet seen). `WorldIndex.bosses` loads the kits into the encounter controller.
- `engine/src/bosses.ts`: locked tile patterns, wind-up and recovery, phases (the encounter's
  behaviour). A released skill is the boss's act (`use` with its own body), answered by
  `sins/release`: a `strike` to each foe on the locked cells, a `push` and a `coat` (`sins/afflict`)
  they answer themselves, its own heal or blink. One hit per victim however many cells it covers.
- Bodies are indexed over their whole footprint; steps and teleports check the whole body;
  weapon rays strike the near edge. `Entity.boss` is saved data (locked aim, cells, release
  time), so a reload mid-cast keeps the warning and the result.
- `content/src/migrateBosses.ts`: an older save's bodies of the removed kits (the East Road's
  `eastroad.sin.greed`) are cleared on loading, once (`content.bosses-v3`); progress is untouched.
- World-space scales: 1.25× (Alberic), 1.75× (Velvet Lure), 2× (Crown), 1.25× (Face Thief).
  The health plate (crown, three seals, HP, the awakening mark, a damage trail, a cast meter)
  replaces the ordinary overhead bar for these bosses.

## Art

Alberic uses **v3 overhead art**, replacing the rejected front/side portrait projection.
`public/assets/lsw/Bosses/alberic/v3/actions.png` is a 4 × 21 atlas (128 px cells): seven
four-frame actions for down, right and up. Left mirrors right. Separate flat-shot and skyward-shot
rows, physical hurt poses and a four-stage kneel/remove crown/offer/fall death are drawn in all
three directions. The camera looks down on the helmet roof and shoulders; the torso and legs
are foreshortened. Three six-frame effect strips share the ivory/gold/bronze palette.
Prompts: `alberic-art-v3-prompts.json`; export: `tools/src/art/export-alberic.swift`;
previews: `boss-art/alberic-v3/`. Previous 48px and v2 images remain untouched.
The preview gallery has an Alberic-only facing selector. See `alberic-art.md` for the full contract.

The other three bosses remain unchanged:

Generated with the built-in image tool; prompts in `seven-sins-prompts.json` (all seven kits'
prompts are kept with their art). Each directory `public/assets/lsw/Bosses/<id>/` holds
`source.png` and `effects-source.png` (originals), `actions.png` (runtime 4 × 5 atlas: idle,
walk, attack, cast, hurt + collapse; 96 px frames, the Face Thief 32 px) and three
`effect-<skill>.png` strips (4 frames of 64 px). `swift packages/tools/src/art/export-bosses.swift`
crops and aligns them without repainting.

## Verification

`tools/test/bosses.test.ts`: the four kits, all twelve skills, faction targeting, dodging,
multi-cell collision and edge hits, save and reload, phase timing, one-time rewards, the removed
kits' migration, and every runtime PNG. `boss-challenge.test.ts`: the four loadouts, each boss
alone, win, loss and retry. `boss-balance.test.ts`: with real movement and attacks, every
profession loses to each boss when ignoring warnings, and a dodging warrior beats each.
`alberic-art.test.ts`: all 102 new runtime frames (real decoded alpha, unique pixels, unclipped
borders), directional action selection, bow-release timing and unchanged legacy atlas selection.
