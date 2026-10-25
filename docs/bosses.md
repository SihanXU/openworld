# Boss encounters

Status (2026-10-15): the bosses' skills and the minor monsters' are **one system** (docs/skills.md): a boss is a kit and an
encounter — phases that take its skills up in turn — on the kits module. Two bosses were redesigned on it: **the White
Knight Alberic** and **the dragon of Cinder Peak** (now a boss fight; docs/skills.md §6). The rest of this section is the
history.

Status (2026-10-05): **the White Knight Alberic** (白骑士·阿尔贝里克), the First Seal-bearer and
Chapter 1's boss, is built (docs/chapter-1.md §4: art, kit, effects; `docs/alberic-art.md`, 128x128
overhead frames in three directions, a 3x2 body). Besides him, three authored encounters remain — **the Crown Without a King** (无王之冠),
**the Velvet Lure** (绯愿兰后) and **the Face Thief** (窃面者). The earlier "seven sins" setting is
withdrawn with the four other kits (the Gilt Tollkeeper, the Banquet Maw, the Drowsing Monastery,
the Cinder Executioner): their code, lore and gallery entries are gone; their art stays in
`games/openworld/public/assets/lsw/Bosses/` for later use. None of the three has a campaign place
yet; the story's bosses are being redesigned (docs/chapter-1.md). The internal ids (`pride`,
`lust`, `envy`, types `actor/creature/sin/<id>`) are unchanged.

## Where they can be fought

- **Boss Studio** (`/boss-gallery.html`): the real engine, East Road terrain, Phaser renderer and
  HUD, without reading or writing saves. Choose a boss, inspect its animation modes, trigger its
  skills, or fight with WASD and Space (200 HP, 8 attack; not campaign balance).
- **Boss Challenge** (首领挑战, a page of its own, `/boss-gallery.html?challenge=1`; the title screen's button went 2026-10-25): pick
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
| 烬峰魔龙 / The Dragon of Cinder Peak (`dragon`, type `actor/creature/dragon`) | 2 × 2 | 1600 / 3 (the lair: 700 / 3) | The pack's green dragon in parts — head, beating wings, a trail of body segments and a tail — composed in code; its wind-up rears it, the wings flared |
| 绯愿兰后 / The Velvet Lure (`lust`) | 5 × 3 | 1600 / 2 | Orchid mantis with porcelain mask, petal mantle and thorn vows; wine / ivory |
| 窃面者 / The Face Thief (`envy`) | **1 × 1** | 1000 / 1 | Small masked assassin, stolen mirror face and twin glass daggers; emerald / bone |
| 无王之冠 / The Crown Without a King (`pride`) | 5 × 4 | 2600 / 3 | Peacock gargoyle, hollow crown head and floating mirror plates; lapis / ivory / gold |

The Velvet Lure expresses desire through impossible promises and floral entrapment, not
sexualized anatomy. The Face Thief's small silhouette is intentional: fast readable tells, low
armor and a blink, against two monumental bodies.

## Skill kits

The White Knight's and the dragon's are in docs/skills.md §6 (and their wiki pages, generated from the kits). The three
kept for later are as they were, ported to the one system unchanged: each blow its old damage (a multiple of an attack
of 24), their skills in turn, phase II at half health with wind-ups ×0.8, recoveries ×0.65 and blows ×1.35.

Seconds at 10 ticks/s; damage is raw, before armor and talents. Each cycles three skills in order; its colour marks the
exact cells that will resolve. Ring interiors and the spaces between spot marks are safe.

| Boss | Skill | Shape / radius | Wind-up / recovery | Damage and effect |
|---|---|---|---|---|
| Velvet Lure | 绯瓣弧斩 / Velvet Crescent | Forward cone, 7 | 1.6 / 1.0 | 30 |
| | 虚愿花印 / False Promise | Five target-centered spots, 4 | 1.8 / 1.0 | 24; pull, then entranced 0.8 s |
| | 荆棘誓约 / Thorn Covenant | Locked target cross, 6 | 2.0 / 1.2 | 32; mired 2.5 s |
| Face Thief | 借影双刃 / Borrowed Blades | Forward cone, 3 | 1.0 / 0.8 | 24 |
| | 碎面镜雨 / Shattered Faces | Five target-centered spots, 3 | 1.4 / 1.0 | 20 |
| | 窃步瞬身 / Stolen Footstep | Locked target disk, 1 (3×3) | 1.2 / 0.8 | 24; blink beside the target's old place |
| Crown | 王翼斥退 / Royal Rebuff | Forward cone, 7 | 1.8 / 1.2 | 42; push one cell |
| | 完美镜裁 / Perfect Reflection | Locked target cross, 7 | 2.2 / 1.4 | 36 |
| | 万象俯首 / Kneel Before the Crown | Locked target ring, 5 | 2.4 / 1.6 | 44; stay in its centre or clear the rim |

The locked aim stays dodgeable in every phase. Mired multiplies movement delay by 1.7, not attack delay. Hits follow
faction hostility, never "is it the player". Pushes and blinks never pass through occupied or solid tiles.

## Runtime and saves

- `content/src/bosses.ts`: each boss's `BossDef` (its type, its body in the Studio and the challenge, its kit, its
  encounter), the `boss/<id>` rules that answer its skills, what its skills leave (the briar sprouts and the hedge, the
  embers) and their rules, and the sins' defeat rules (a fallen sin goes down for two seconds, leaves four iron ore and
  whatever it held, tells the story `sins.defeated.<id>`, and — for a feller with a profession — the next legendary of
  their profession not yet seen). The dragon's end stays the main quest's (`content/src/quest.ts`). The ontology's
  `kits` and `encounters` carry every boss's (`BOSS_KITS`, `BOSS_ENCOUNTERS`).
- `packages/modules/src/kits/encounter.ts`: the director (docs/skills.md §2); `cast.ts` the wind-up, `pattern.ts` the
  cells, `unleash.ts` the landing. A released skill is the boss's act (`use` with its own body, param `kit`), answered by
  its `boss/<id>` rule with `unleash`. One hit per victim however many cells it covers.
- Bodies are indexed over their whole footprint; steps and teleports check the whole body; weapon rays strike the near
  edge. `Entity.boss` is the director's saved memory (phase, the opening skill taken, the rotation's step, the skill and
  clip drawn); a wind-up is behaviour memory, lost with a save (the boss takes the skill up again).
- `content/src/migrateBosses.ts` (`content.bosses-v4`): an older save's bodies of the removed kits are cleared, and its
  White Knight, whose blows were `skillScale`d, takes Chapter 1's numbers keeping his share of health; the kits module's
  `upgrade` turns an older boss memory (a kit id, skills by index, a wind-up) into the director's.
- The health plate (crown, five seals — the one a Seal-bearer bears lit —, HP, a mark where each phase begins, a damage
  trail, a cast meter) replaces the ordinary overhead bar for a type with an encounter. A boss drawn on a sheet of rows
  (the sins') is posed by `render/boss-animation.ts` (Alberic by his skills' clips); the dragon, drawn in parts, rears in
  code.
- World-space scales: 1.25× (Alberic), 1.75× (Velvet Lure), 2× (Crown), 1.25× (Face Thief).

## Art

Alberic uses **v3 overhead art**, replacing the rejected front/side portrait projection.
`public/assets/lsw/Bosses/alberic/v3/actions.png` is a 4 × 21 atlas (128 px cells): seven
four-frame actions for down, right and up. Left mirrors right. Separate flat-shot and skyward-shot
rows, physical hurt poses and a four-stage kneel/remove crown/offer/fall death are drawn in all
three directions. The camera looks down on the helmet roof and shoulders; the torso and legs
are foreshortened. Three six-frame effect strips share the ivory/gold/bronze palette.
Prompts: `alberic-art-v3-prompts.json`; export: `tools/src/art/export-alberic.swift`;
The preview gallery has an Alberic-only facing selector. See `alberic-art.md` for the full contract.

The other three bosses remain unchanged:

Generated with the built-in image tool; prompts in `seven-sins-prompts.json` (all seven kits'
prompts are kept with their art). Each directory `public/assets/lsw/Bosses/<id>/` holds
`source.png` and `effects-source.png` (originals), `actions.png` (runtime 4 × 5 atlas: idle,
walk, attack, cast, hurt + collapse; 96 px frames, the Face Thief 32 px) and three
`effect-<skill>.png` strips (4 frames of 64 px). `swift games/openworld/tools/src/art/export-bosses.swift`
crops and aligns them without repainting.

## Verification

`tools/test/bosses.test.ts`: the five bosses, every skill landing on the cells it advertised as its rule says, faction
targeting, dodging, multi-cell collision and edge hits, save and reload, phase timing (the three kept for later exactly
as before), one-time rewards, the migrations, and every runtime PNG. `boss-fights.test.ts`: the White Knight's and the
dragon's redesigned fights. `kit-contract.test.ts`: the contract both kits keep (docs/skills.md §4). `boss-challenge.test.ts`: the four loadouts, each boss
alone, win, loss and retry. `boss-balance.test.ts`: with real movement and attacks, every
profession loses to each boss (the dragon among them) when ignoring warnings, and a dodging warrior beats each.
`alberic-art.test.ts`: all 102 new runtime frames (real decoded alpha, unique pixels, unclipped
borders), directional action selection, bow-release timing and unchanged legacy atlas selection.
