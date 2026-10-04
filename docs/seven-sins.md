# Seven Sins — Original Bosses

## Delivered scope

Seven authored encounters, seven original transparent action atlases and 21 original
skill-effect strips. Six bosses occupy multiple collision tiles. Envy alone is 1 × 1.
Only Greed has a campaign placement: the East Road, immediately east of the Ford beyond
its bridge. The other six are implemented and playable in the independent Boss Studio;
their campaign locations are deliberately not assigned to existing quest encounters.

Open `/boss-gallery.html` on the running game server. It uses the real engine, East Road
terrain, Phaser renderer and HUD, without reading or writing game saves. Choose a boss,
inspect all six animation modes, trigger individual skills, or fight with WASD and Space.
The sandbox character has 200 HP and 8 attack; these are not campaign balance changes.

## Title-screen challenge

The title screen's **Seven Sins Challenge / 七罪挑战** button opens
`/boss-gallery.html?challenge=1`. Select any of the seven bosses and a level-20 profession:
Assassin (dagger, openers/backstabs/finishers), Warrior (mace, defense/counterattacks),
Ranger (bow, seven-tile shots/aimed volleys), or Mage (fire wand, echoes/mana shield).
Each receives all six of its own profession talents plus four shared starter talents.
Weapons are equipped automatically; campaign loadouts and skill trees are unchanged.

The selection screen pauses the simulation. WASD/arrows move, Space attacks in the
facing direction, and Escape pauses. Losing focus also pauses the trial. Victory and
defeat show a result screen with retry and profession/opponent selection; victory adds
a next-undefeated-boss option. A session-only counter tracks the seven defeated bosses.
Every retry creates a fresh character and boss, clearing wounds, effects and rewards.
This mode has no save calls, campaign portals, NPCs or incidental creature spawns.
Returning to the title or refreshing discards trial progress, never campaign saves.

`client/src/boss-challenge.ts` owns this disposable bootstrap. Its 13 regression tests
cover four complete loadouts and real weapon damage, all seven encounter selections,
victory/defeat/retry, invalid selections, and unchanged source world/chunk data.

## Art direction and roster

The visual language is hand-painted pixel fantasy: chunky silhouettes, dark contour
clusters, restrained metallic highlights and tactile materials. Each sin is expressed
through an original creature and its equipment, not a generic colored demon. Ground is
16px per tile; decorative height and attack silhouettes extend beyond collision bases.

| Sin / name | Collision | HP / armor | Distinct silhouette and palette |
|---|---|---|---|
| Greed — 铸税者 / Gilt Tollkeeper | 5 × 3 | 1400 / 2 | Vault-backed hermit crab; stamp claw, key claw, wax seals; brass / dark teal |
| Gluttony — 饕宴巨口 / Banquet Maw | 5 × 4 | 1800 / 2 | Cauldron-bellied toad; cutlery tusks and cook's cap; copper / bile green |
| Sloth — 眠钟古寺 / Drowsing Monastery | 7 × 5 | 2200 / 4 | Broad stone tortoise carrying a mossy bell temple; slate / lavender |
| Lust — 绯愿兰后 / Velvet Lure | 5 × 3 | 1600 / 2 | Orchid mantis with porcelain mask, petal mantle and thorn vows; wine / ivory |
| Wrath — 烬炉刑官 / Cinder Executioner | 5 × 4 | 2100 / 3 | Boar-headed forge executioner with anvil chest and molten cleaver; charcoal / ember |
| Envy — 窃面者 / Face Thief | **1 × 1** | 1000 / 1 | Small masked assassin, stolen mirror face and twin glass daggers; emerald / bone |
| Pride — 无王之冠 / Crown Without a King | 5 × 4 | 2600 / 3 | Peacock gargoyle, hollow crown head and floating mirror plates; lapis / ivory / gold |

Lust expresses desire through impossible promises and floral entrapment, not sexualized
anatomy. Envy's small silhouette is intentional: fast readable tells, low armor and a
blink contrast with the six monumental bodies.

## Skill kits

Times are seconds at 10 engine ticks/s. Damage is raw, before the ordinary armor and
combat-talent rules. Each boss cycles three skills in order; its color marks the exact
cells that will resolve. Ring interiors and spaces between spot marks remain safe.

| Boss | Skill | Shape / radius | Wind-up / recovery | Damage and additional effect |
|---|---|---|---|---|
| Greed | 征税重钳 / Gilded Stamp | Forward cone, 6 | 1.6 / 1.0 | 26; push one cell |
| | 散财风暴 / Coin Storm | Self-centered ring, 6 | 2.0 / 1.2 | 22; stay inside or outside the rim |
| | 索债金链 / Debt Collection | Locked target cross, 4 | 1.6 / 1.0 | 24; pull one cell |
| Gluttony | 宴席巨噬 / Banquet Bite | Forward cone, 6 | 2.0 / 1.2 | 34; heal 40 per struck foe |
| | 酸汤倾泻 / Cauldron Spill | Locked target disk, 3 | 1.8 / 1.0 | 26; mired for 2.5s |
| | 吞尽满席 / Empty the Table | Self-centered disk, 7 | 2.4 / 1.4 | 30; pull; heal 30 per struck foe |
| Sloth | 千钧迟踏 / Rooted Stomp | Self-centered disk, 7 | 2.6 / 1.8 | 46; push one cell |
| | 沉眠钟雾 / Drowsing Chimes | Five target-centered spots, 5 | 2.0 / 1.6 | 30; mired for 2.5s |
| | 古寺回响 / Monastery Wall | Self-centered ring, 8 | 2.8 / 1.8 | 40; retreat into the quiet center |
| Lust | 绯瓣弧斩 / Velvet Crescent | Forward cone, 7 | 1.6 / 1.0 | 30 |
| | 虚愿花印 / False Promise | Five target-centered spots, 4 | 1.8 / 1.0 | 24; pull then immobilize for 0.8s |
| | 荆棘誓约 / Thorn Covenant | Locked target cross, 6 | 2.0 / 1.2 | 32; mired for 2.5s |
| Wrath | 断罪斧落 / Execution Stroke | Three-cell-wide forward line, 8 | 1.8 / 1.0 | 44; push one cell |
| | 熔炉裂隙 / Furnace Fault | Locked target cross, 6 | 2.0 / 1.2 | 32 fire |
| | 怒烬震环 / Ashen Roar | Self-centered ring, 7 | 1.8 / 1.2 | 38 fire |
| Envy | 借影双刃 / Borrowed Blades | Forward cone, 3 | 1.0 / 0.8 | 24 |
| | 碎面镜雨 / Shattered Faces | Five target-centered spots, 3 | 1.4 / 1.0 | 20 |
| | 窃步瞬身 / Stolen Footstep | Locked target disk, 2 | 1.2 / 0.8 | 24; blink beside the original target position |
| Pride | 王翼斥退 / Royal Rebuff | Forward cone, 7 | 1.8 / 1.2 | 42; push one cell |
| | 完美镜裁 / Perfect Reflection | Locked target cross, 7 | 2.2 / 1.4 | 36 |
| | 万象俯首 / Kneel Before the Crown | Locked target ring, 5 | 2.4 / 1.6 | 44; remain in its center or clear the rim |

Phase II activates at 50% HP (Sloth: 45%; Wrath: 60%). Wind-ups become 20% shorter,
never below 0.8s, damage increases by 35% (rounded), and recovery is 35% shorter
(rounded to ticks, minimum 0.6s). The locked aim remains dodgeable in both phases.
Mired multiplies movement delay by 1.7, not attack delay. Hits use faction hostility,
not player identity. Movement effects cannot push or blink through occupied/solid tiles.

## Runtime and saves

The v2 scale/balance pass keeps every original imagegen atlas. World-space sprite scales
are 1.75× for Greed/Gluttony/Lust/Wrath, 2.25× for Sloth and 2× for Pride. Envy receives
only a 1.25× readability boost and remains the sole one-cell body. Generated effects for
large bosses are 1.5×. The camera reserves space for the encounter plate and player UI.
The new 860px-max forged-metal health plate has a crown, seven sin seals, numeric HP,
awakening threshold, delayed damage trail, phase-II lighting and a separate cast meter.
Ordinary overhead enemy health bars are suppressed for these bosses.

`boss-balance.test.ts` uses real movement and attacks: all 28 profession/opponent pairs
lose when ignoring warnings; a dodging warrior can beat all seven, each taking over 30
simulation seconds. It is a deterministic regression target, not a claim about every
human player's kill time. No invulnerability, extra damage or healing is used by the pilot.

- `content/src/bosses.ts` owns names, footprints, stats, kits, statuses and defeat rules.
  `WorldIndex.bosses` loads them into the content-independent encounter controller.
- `engine/src/bosses.ts` builds locked tile patterns, tracks wind-up/recovery and phases (the
  encounter's behaviour). When a wind-up runs out the blow is the sin's act (`use` with its own
  body on the aimed tile, carrying the skill, the origin and the aim); its rule (`sins/release`)
  answers with the `release` effect: a `strike` to each foe on the locked cells, a `push` (push
  or pull) and a `coat` (mired, entranced: `sins/afflict`) that they answer themselves, and its
  own heal or blink. One hit per victim, regardless of how many cells its body intersects.
- Actor spatial indices cover the full footprint. Steps and teleports validate the whole
  body; weapon rays can strike the near edge instead of needing to reach the anchor.
- `Entity.boss` is plain saved data, including locked aim, cells and release time. Reloading
  mid-cast retains the warning and result. Dead bodies have a two-second death animation,
  then disappear. Defeat facts and rewards are set only once.
- Greed's stable ID is `eastroad.sin.greed`, at `(23,15)`. A local dirt clearing provides
  space to dodge. The migration adds it to already-visited old roads without resetting
  quests or inventory, moves the new spawn if the player occupies the site, and never
  recreates a defeated boss. A completely obstructed site is retried on a later load.
  The v2 migration retains v1's wounded-health ratio and relocates the enlarged body if
  its new footprint overlaps the player or a structure; quests and defeated bosses stay intact.

## Image generation and source files

Generated with the **built-in image generation tool**, not a paid API fallback or hand-coded
replacement sprites. The full 14 prompts are preserved in `seven-sins-prompts.json`.
Original outputs are copied into the project; existing skill icons and old bosses remain
untouched. Each directory is `packages/client/public/assets/lsw/Bosses/<sin>/`:

- `source.png`: original 4 × 5 action atlas.
- `effects-source.png`: original 4 × 3 effects atlas.
- `actions.png`: runtime 4 × 5 atlas. Large frames 96 × 96; Envy 32 × 32.
- `effect-<skill>.png`: three horizontal 4-frame strips, 64 × 64 per frame.

Action rows: idle (4), walk (4), physical attack (4), cast (4), hurt (2) + collapse/dead (2).
This is a fixed three-quarter/front atlas, horizontally mirrored when facing left, not
a four-direction atlas. Total: **140 body frames + 84 effect frames**.

`swift packages/tools/src/art/export-bosses.swift` only locates cell gutters, crops,
nearest-neighbor downsamples and aligns baselines. It preserves generated colors/alpha
and can regenerate runtime atlases using the project's copies. It does not repaint art.
`seven-sins-preview.png` shows the complete roster and one frame from each effect.
`seven-sins-gameplay.png` and `boss-review/` contain actual game-renderer captures.

## Verification

`tools/test/bosses.test.ts` checks all 21 skills, faction targeting, dodging, multi-cell
collision and edge hits, save/reload, phase timing, one-time death rewards, migration,
and every runtime PNG. `demo.test.ts` F16 witnesses the real Ford → East Road encounter.
`npm run check`, `npm run build`, `npm run coverage` and `npm run check:world` pass.
The isolated browser review renders all seven encounters, all 42 animation-mode switches
and all 21 generated effect textures without JavaScript or HTTP failures. It can be repeated with
`node packages/tools/src/art/review-bosses.mjs` against the documented isolated Chrome.
`node packages/tools/src/art/review-challenge.mjs` additionally checks the title entry,
four profession loadouts, paused selection, keyboard combat, the enlarged health plate,
damage trail, defeat/retry, session progress and narrow-window layout. It writes the
`boss-review/challenge-*.png` UI captures and does not access any existing browser profile.
