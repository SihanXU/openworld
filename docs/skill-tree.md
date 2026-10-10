# Skill tree and icon brief

## Icon completion (2026-10-04)

All **70 implemented skills** now reference distinct illustrated icons. The library has
**78 registered 64×64 RGBA PNGs** including profession, branch and navigation artwork.
This pass adds **41 skill illustrations and three profession entrances** (Warrior,
Ranger and Mage). The previous 34 PNGs, including the Assassin set, are preserved.
There are no remaining `placeholder:` references in the skill content.

The new illustrations use **built-in imagegen**, one generation per asset, with the
existing Short-Blade Training and Assassin icons as style references. Warm brown
outlines, ivory highlights, copper fittings and worn materials unify the set. Teal
identifies Swiftness, brick red Damage, moss green Survival, iron/red Warrior,
forest green Ranger and violet Mage. All nodes remain full-colour when locked.

- Assets: `games/openworld/public/assets/lsw/skills/<key>.png`.
- Exact shared brief, individual subjects and paths: [generation manifest](skill-art-prompts.json).
- New artwork contact sheet: [44 completed icons](skill-art-complete-preview.png).
- Local full-resolution sources: `var/skill-art/sources/` (not committed).
- Export: `games/openworld/tools/src/art/export-skill-icon.swift`, nearest-neighbour sampling
  with generated alpha preserved; it refuses to overwrite existing artwork.
- Coverage: `games/openworld/tools/test/skill-art.test.ts` checks every skill/entrance, registry
  and file parity, distinct decoded images, dimensions, actual transparent padding,
  visible pixels, prompts and full-colour bitmap rendering. Placeholder exemptions
  have been removed. No gameplay values or skill prerequisites changed in this pass.

Art verification: all eight focused tests pass, and the client production build includes
all 78 PNGs unchanged. The 44-icon contact sheet was checked against the preserved style
references. Recreate it from the repository root with
`swift games/openworld/tools/src/art/preview-skill-icons.swift`.

## Original tree brief and subsequent extensions

The original tree brief below predates the profession and general-branch expansions.
Current icon coverage is summarized above; later sections retain their design history.

The tree has two directions and eight branches. Combat has **25 implemented nodes**;
Life retains four Gathering nodes and three pending, non-purchasable branch entrances.

```text
Combat
├── Swiftness
├── Survival
├── Damage
└── Profession → Assassin (initial profession)
Life
├── Gathering: Long Reach → Woodcutter → Big Pack → Firemaker
├── Agriculture
├── Animal Husbandry
└── Smithing
```

Combat and Life share the existing skill-point pool. Ordinary nodes cost **1 point**;
the four combat capstones cost **2 points** and need both arms. Arms are not mutually
exclusive: early points make a build choice; later points can complete the branch. No
additional level gate, action key or resource bar is introduced. Fully learning the combat
trees costs 29 points; all current skills cost 33. Every level after level 1 grants one point.

Professions (2026-10-03): nobody starts with one. **Bram**, the drillmaster of Firstlight
Village (`npc.bram`, type `actor/person/trainer`, at the drill yard), opens the choice when
spoken to; from **level 5**, within three tiles of a trainer, the player takes up one of four:
**assassin**, **warrior**, **ranger**, **mage** (`content/src/skills.ts` `SKILL_PROFESSIONS`,
`engine/src/profession.ts`). Each has a six-node tree of the same shape (a root, two arms of
two, a two-point capstone needing both arms) and a starter weapon handed over the first time
(dagger, mace, bow, wand). **Changing profession** at the trainer unlearns every skill of the
profession branch, undoes its grants and gives its points back; shared branches are kept.
Each professional node declares `profession`; UI filtering and engine-side learning both
enforce the match, and every talent checks the actor's current profession. The new trees'
icons and profession entrances received individual illustrations on 2026-10-04.

| Profession | Root | Arm A | Arm B | Capstone (2 points) |
| --- | --- | --- | --- | --- |
| Warrior | Arms Training: melee weapons +1 power | Bulwark (−15% combat damage) → Unbreakable (+10 max health) | Retaliation (+40% on the next melee hit within 2 s of being hit) → Rampage (+15% melee per felled creature for 5 s, ×3) | Warlord: Bulwark −30%; Retaliation hits heal 2 |
| Ranger | Archery: bows +1 power, +1 range | Steady Aim (+30% after 1 s still) → Sniper (+25% at 3+ tiles) | Fleet Archer (+20% move for 1.5 s after a hit) → Quick Draw (+20% attack speed with a bow) | Hunter's Mark: every third hit in a row on one target is critical |
| Mage | Arcane Focus: wands/staves +1 power | Elemental Attunement (+25% with an element) → Spell Echo (every fourth spell critical) | Mana Shield (−20% combat damage holding a focus) → Arcane Recovery (+3 health per creature felled by a spell) | Archmage: +2 power, +1 range |

All twelve original ids remain valid. Already learned nodes keep their grants even when
prerequisites change; no points are refunded or grants reapplied. Saves without a profession
acquire the world's initial one; explicit values are preserved. Iron Stomach's legacy
150-tick interval is migrated to 450 (base 300 + 150), fixing accelerated hunger. Since 2026-10-06 hunger
falls in two paces (base 480 ticks fed, 7.5 times slower once hungry, under six tenths); intervals kept
on the old scale (300, 450, 600) are scaled to it (480, 720, 960).

Branch configuration is in `games/openworld/content/src/skills.ts`. Layout is calculated per
direction in `packages/runtime/src/ui/skillLayout.ts`; the page supports dragging, wheel zoom
and explicit +/− zoom controls for touch screens. The compact toolbar stays above navigation.
Empty branches retain their visible entrances so future skills can use the same layout.

## Combat design

The designs adapt general combat ideas, rather than reproducing another game's names,
content or numerical balance:

- [Guild Wars 2: Thief](https://www.guildwars2.com/en/the-game/professions/thief/) informed
  mobile combat and an opening/retreat rhythm. Here it becomes successful-step rewards and
  a quiet-period opener, not literal stealth, teleportation or an initiative resource.
- [World of Warcraft: Rogue](https://worldofwarcraft.blizzard.com/en-gb/game/classes/rogue)
  informed building successive attacks into a finisher. Here a three-hit, same-target melee
  sequence automatically finishes, avoiding an extra hotbar in the current demo.
- [Diablo IV: official 2.0 patch notes](https://news.blizzard.com/en-us/article/24140808/diablo-iv-patch-notes-2-0)
  informed using mobility, critical hits and conditional defence as complementary build axes.
  These are original small-tree designs, not reproductions of its skill trees or builds.

### Swiftness — movement and attack rhythm (6 nodes, 7 points)

```text
Light Footed
├── Quick Hands → Battle Tempo ──┐
└── Evasive Step → Pursuit ──────┴── Windrunner [2 points]
```

| Node | Effect |
| --- | --- |
| Light Footed / 轻盈步伐 | Average movement speed +15%. |
| Quick Hands / 快手 | Average attack speed +15%. |
| Battle Tempo / 战斗节奏 | Another +10% attack speed within 0.6 s of a successful step. |
| Evasive Step / 灵巧闪身 | Direct combat damage taken −25% within 0.6 s of a successful step. |
| Pursuit / 乘胜追击 | Defeat a creature with an attack: movement speed +25% for 3 s; refresh, not stack. |
| Windrunner / 疾风连击 | Three successful steps charge the next primary melee hit for +50% damage. |

Failed bumps, changing facing and teleporting do not count as steps. Fractional tick carry
makes small speed bonuses real in a 10 Hz world, instead of rounding every action back to
the original interval. Haste is capped at 50%, with a minimum one-tick action interval.

### Survival — durability and food-based sustain (7 nodes, 8 points)

```text
Vitality
├── Toughness → Hardy → Defiance ──┐
└── Iron Stomach → Second Wind ────┴── Last Stand [2 points]
```

| Node | Effect |
| --- | --- |
| Vitality / 体魄 | Max health +4, filling the added capacity. |
| Toughness / 坚韧 | Defence +1. |
| Hardy / 强健 | Max health +6, filling the added capacity. |
| Defiance / 绝境韧性 | At ≤30% health before a hit, direct combat damage taken −25%. |
| Iron Stomach / 耐饿 | Hunger drain interval +240 ticks: 720 instead of the base 480, one-third slower drain (both paces). |
| Second Wind / 自愈 | Food-based healing starts at 50% food instead of 90%; existing cadence remains 8 s. |
| Last Stand / 不屈意志 | Survive a lethal direct combat hit at 1 health; cooldown 30 s, saved on the actor. |

Direct combat damage means non-piercing damage attributed to another actor. Environmental,
self-inflicted and hunger damage receive none of these conditional protections. Evasive
Step and Defiance multiply if both apply; normal damage remains at least 1. Last Stand
can prevent the final point of damage but supplies no invulnerability or subsequent healing.

### Damage — power/cleave or critical/execute (6 nodes, 7 points)

```text
Strength
├── Heavy Blows → Sweep ─────────┐
└── Keen Eye → Executioner ──────┴── Deadly Focus [2 points]
```

| Node | Effect |
| --- | --- |
| Strength / 力量 | Attack +1. |
| Heavy Blows / 重击 | Attack +2. |
| Sweep / 横扫 | Melee also strikes creatures at the two sides of the tile ahead. |
| Keen Eye / 洞察弱点 | Critical chance +10%; ordinary critical multiplier 1.5. |
| Executioner / 斩杀 | Attack damage +25% against a target at ≤30% health before the hit. |
| Deadly Focus / 致命专注 | Critical chance +5%; critical multiplier becomes 2. |

### Assassin — opener, positioning and same-target finishers (6 nodes, 7 points)

```text
Short-Blade Training
├── Ambush → Relentless ─────────┐
└── Backstab → Shadow Recovery ──┴── Death Dance [2 points]
```

| Node | Effect |
| --- | --- |
| Short-Blade Training / 短兵精通 | Melee blade weapon attack power +1; no unarmed/ranged bonus. |
| Ambush / 暗影先手 | After 4 s without attacking/taking combat damage, primary melee damage +50%. |
| Relentless / 连环刺击 | Every third primary melee hit on the same target deals +60% damage; adjacent hits ≤2 s apart. |
| Backstab / 背刺 | Primary melee damage +40% from behind, judged by target facing, not attacker facing. |
| Shadow Recovery / 影中汲取 | A melee attack defeating a creature heals 10% max health, rounded up and capped. |
| Death Dance / 死亡之舞 | A qualifying Ambush or Backstab is guaranteed to critically hit. |

Ambush is readiness after a quiet interval, **not invisibility**. Backstab requires a
strictly negative facing dot product; side/front attacks do not qualify. Switching targets,
missing, attacking a downed target or using a ranged weapon resets the melee combo. Sweep's
secondary hits cannot build a combo, consume Windrunner, or inherit Ambush/Backstab bonuses
and guaranteed criticals. They independently receive ordinary critical chance/Executioner
bonuses and can provide legitimate defeat recovery.

### Calculation and boundaries

Attack power = actor attack + weapon power + eligible blade training. Context bonuses
(Windrunner, Ambush, Relentless, Backstab, Executioner) add together, then the critical
multiplier applies; defence and incoming mitigation follow. No attack modifiers apply to
fixtures/tiles. Only actors at positive health and not down can generate a confirmed hit.
Ordinary critical rolls use the world's seeded RNG; guaranteed criticals and actors without
critical chance do not spend a random number. All mechanics apply to any qualified actor,
including NPCs/creatures, not a player-id exception.

Runtime state is `Entity.combat`: movement/attack/hurt timestamps, capped step charge,
same-target combo, pursuit expiry, Last Stand trigger tick and fractional tick carries.
All survive saves. The ModSpec explains that attack `hit.power` already contains offensive
talents; reaction rules must not apply those bonuses again.

## Art

The new branch emblems are 64×64 transparent PNGs in
`games/openworld/public/assets/lsw/skills/`: `swift.png`, `farming.png`, `ranching.png`,
and `smithing.png`. Existing branch emblems reuse `shield.png`, `sweep.png`, and `axe.png`.
Generation used the built-in imagegen tool, with the original generated sword as a style
reference. The source images remain in Codex's generated-images directory; web assets
are resized copies. Icons now use illustrated PNGs only; no SVG line-art substitutes
are shown. Failed image requests fall back once to the original illustrated `origin.png`.
Locked nodes retain full-colour artwork, distinguished by neutral dashed borders rather
than grayscale or reduced opacity.

The combat extension adds five 64×64 RGBA icons in the same directory: `assassin.png`,
`dagger.png`, `critical.png`, `shadow.png` and `combo.png`. These were generated separately
with the **built-in imagegen tool**, using `sword.png` only as a style reference. No existing
icon was replaced. The new prompts are recorded below, and the assets are wired into the
profession hub and relevant talent nodes.

### Shared generation prompt

```text
Use case: stylized-concept
Asset type: branch emblem in the Symbolic World skill tree, a cozy top-down pixel JRPG.
Input image: Image 1 is a style reference only. Match its warm dark-brown outline,
chunky square pixels, hand-drawn asymmetry, and small cream highlights.
Style/medium: a hand-drawn pixel sprite on an approximately 32x32 logical grid.
Hard flat color blocks only, a one-pixel outline, 4–6 flat colors. Strong simple
silhouette readable when displayed at 48 pixels.
Composition: centered single compact symbol in a square, about 65% occupancy,
generous transparent padding for a circular UI node.
Background: genuinely transparent.
Constraints: no circular badge or frame, no typography, no watermark, no gradient,
no soft brush texture, no antialiasing, no cast shadow, no glow, no environment,
no extra props. Preserve the established handcrafted pixel look.
```

Each image appends one subject prompt:

- `swift`: Swiftness / 迅捷 — one lightweight leather boot angled as if sprinting, with
  one small ivory wing attached to the ankle and two short pixel motion streaks. Muted
  amber leather and ivory wing with a small river-teal accent. One boot, no character.
- `farming`: Agriculture / 农业 — one young green sprout emerging from a compact
  cross-section of tilled earth, two broad leaves and one small golden wheat shoot
  alongside it. Moss and leaf greens, warm brown soil, golden seed. Simple agriculture
  emblem, no pot or watering can.
- `ranching`: Animal husbandry / 牧业 — one friendly cream-and-brown cow head facing
  forward, two tiny ochre horns, rounded ears and a warm pink muzzle. A compact simple
  silhouette, only the head, no body or landscape.
- `smithing`: Smithing / 锻造 — one stout gray steel anvil with a small copper smithing
  hammer laid diagonally across its top. One tiny golden impact chip. Simple compact
  workshop emblem; steel blue-gray, warm brown wood, ochre highlight. No forge, no flame
  or character.

### Combat generation prompt set

The five calls each used this shared prompt verbatim, followed by its subject:

```text
Use case: stylized-concept
Asset type: individual transparent skill-tree icon for Symbolic World, a cozy top-down pixel JRPG.
Input image: Image 1 is a style reference only, not an edit target. Match its warm dark-brown outline, chunky square pixel clusters, handmade asymmetry and cream highlights.
Style: hand-drawn pixel sprite on an approximately 32x32 logical grid, hard flat color blocks, single-pixel dark outline, 4-6 muted flat colors. Simple silhouette readable at 48px.
Composition: centered single compact symbol in a square, 65% occupancy, generous transparent padding for a circular UI node.
Background: genuinely transparent alpha.
Constraints: no badge, no frame, no text or watermark, no gradients, no soft texture, no antialiasing, no cast shadow, no glow, no scenery.
Subject:
```

- `assassin`: An assassin profession emblem: one small deep plum hood with a charcoal face covering, two tiny ivory eyes and a folded dusty purple cloth silhouette. Only the hooded head, no body or weapon, friendly old-school fantasy sprite, warm dark-brown outline.
- `dagger`: One short steel dagger tilted diagonally, stout ivory-gray pointed blade, small ochre guard and muted plum leather grip. Simple compact close-combat/backstab symbol, not a sword.
- `critical`: One small ochre archery target with two concentric brick-red rings and a short ivory dagger tip hitting its center at a diagonal. Strong simple weak-point/critical-hit emblem, no stand or scenery.
- `shadow`: One compact deep-plum cloak silhouette with a slightly billowing hem and two short charcoal pixel afterimage streaks to suggest an ambush from shadow. Hood empty and face not visible, no body, no weapon.
- `combo`: Three short ivory-and-plum diagonal slash marks arranged as one compact rising rhythm, with one tiny ochre impact spark at the topmost slash. An abstract three-hit combo/finisher symbol, no numerals, no weapons or body.

### Distinct talent illustrations

The twelve additional assets below completed a one-to-one mapping for the **29 skills
implemented at that stage**. That library contained 34 PNGs including hubs/navigation. Original artwork is
preserved; only previously duplicated talent references are assigned a new, unique image.
All files live at `games/openworld/public/assets/lsw/skills/<key>.png`, exported as 64×64
RGBA PNGs with nearest-neighbour sampling so no smooth resampling is introduced.

Generation mode: **built-in imagegen**, one call per distinct asset. The original sword
and assassin hood are style references only. Warm brown outlines, ivory highlights, worn
materials, cream stitches and copper fittings give the set a shared handmade vocabulary.
New Swiftness art uses teal, Survival moss green, Damage brick red, and Assassin plum.
These illustrations are not generic line glyphs. Unlearned art retains its colours and
material detail; neutral/dashed node borders communicate availability.

Those original illustrations can be reviewed together in [the original preview](skill-art-preview.png).

Every call uses this shared prompt verbatim, followed by its subject:

```text
Use case: stylized-concept
Asset type: one finished, original, collectible skill illustration for Symbolic World, a handcrafted top-down pixel JRPG.
Input images: Image 1 (sword) and Image 2 (assassin hood) are STYLE REFERENCES ONLY, not edit targets. Retain their chunky square pixel clusters, warm dark-brown silhouette outlines, cream highlights and imperfect handmade character.
Primary request: a colorful, fully designed skill icon, not a generic line glyph or flat vector pictogram. Give this specific skill its own recognizable silhouette, tangible fantasy materials and a small story expressed through wear, stitching or copper fittings.
Style/medium: illustrated pixel sprite on a roughly 32x32 logical grid. Hard-edged contiguous pixel color blocks, 6-9 restrained colors, one dark outline, 2-3 distinct flat shading tones per main material. No smooth gradients or antialiasing.
Composition: one compact coherent emblem, centered square, approximately 65% occupancy, readable at 48-64px, generous transparent padding. Only the objects described below.
Visual identity: warm brown outlines, a restrained ochre/copper handcrafted detail, one asymmetrical highlight; earthy cozy fantasy, not shiny generic mobile-game art.
Background: genuinely transparent alpha. No badge, UI frame, environment, typography, numeral, watermark, cast shadow, glow, outline-only art, stock-icon look or geometric line drawing.
Subject and skill:
```

- `quick-hands.png`: Quick Hands / 快手: a teal fingerless leather glove gripping one short ivory-steel throwing knife, with two copper knuckle studs, a stitched wrist cuff and two blocky motion afterimages. Show a crafted agile hand-and-knife silhouette, no arm or character.
- `battle-tempo.png`: Battle Tempo / 战斗节奏: one small ochre wooden war drum with a teal stitched leather rim, visibly cross-laced warm-brown cords and one short ivory-tipped drumstick laid at a lively diagonal. A tiny copper beat spark, no musical notation, no numerals, no character.
- `evasive-step.png`: Evasive Step / 灵巧闪身: one sharply bent teal cloth scarf with a copper fastening button and visibly stitched cream hem, twisting aside as one small chipped silver arrowhead passes its outer edge. A flowing cloth dodge silhouette, no person or body.
- `pursuit.png`: Pursuit / 乘胜追击: a weathered brass tracking compass with a bold ivory needle leaning forward, a dark-teal leather strap and a short forked teal ribbon streaming backward. A tactile asymmetrical adventurer's tool, not an abstract arrow, no lettering or compass labels.
- `windrunner.png`: Windrunner / 疾风连击: two short ivory-steel blades with teal cloth grips sweeping around a compact curl of leaf-shaped teal wind blocks, with two tiny copper sparks. Make a powerful pinwheel-like final-talent silhouette, no circular UI border and no plain triple-line slash.
- `executioner.png`: Executioner / 斩杀: one stout chipped steel cleaver with a broad hooked tip, oxblood-red cloth grip and one copper rivet, descending at a strong diagonal through a short solid brick-red cutting arc. Weighty finishing-blow character, no victim, skull, blood or gore.
- `deadly-focus.png`: Deadly Focus / 致命专注: a sharply focused amber eye seen beneath a small angular brick-red cloth brow, an ivory diamond-shaped pupil and one asymmetrical copper stitch on the folded cloth. Only the compact brow-and-eye emblem, no complete face, no generic outline eye.
- `defiance.png`: Defiance / 绝境韧性: one battered moss-green iron buckler with a large diagonal crack repaired by two bold copper staples, an ivory scuff on its rim and a short frayed green strap. A resilient repaired object with strong character, not the clean existing shield.
- `last-stand.png`: Last Stand / 不屈意志: a moss-green heart-shaped stone talisman, visibly cracked but held together with two warm copper staples, with a small flat amber core visible in the crack and one tiny dark-green root gripping its lower point. Stone texture expressed with only a few chunky pixels, no radiance or soft glow.
- `blade-mastery.png`: Short-Blade Training / 短兵精通: one short ivory-steel dagger partly drawn from a plum leather sheath with cream stitches and an ochre clasp, its lower edge resting against one small gray whetstone. A compact handcrafted blade-training emblem, no hand or character.
- `shadow-recovery.png`: Shadow Recovery / 影中汲取: one small ruby-red heart crystal cupped by a curling plum cloth cloak fold, with an ivory inner highlight and a tiny copper clasp joining the cloth tips. A warm life-force recovered from shadow; no potion bottle, hand, body, blood or glow.
- `death-dance.png`: Death Dance / 死亡之舞: two curved ivory-steel assassin daggers orbiting one small deep-plum rose with a copper-gold center; their short plum cloth grips follow a twisting dance-like rhythm. A distinctive elegant capstone illustration, compact and readable, no frame, skull, gore or plain slash glyph.

## Verification

`games/openworld/tools/test/skills.test.ts` covers tree topology, both prerequisites/capstone cost,
profession filtering/enforcement, legacy save migration, actual input cooldowns, fractional
cadence, step charging, secondary-hit isolation, seeded criticals, execute/defiance thresholds,
Last Stand timing/persistence, food sustain, blade eligibility, opener reset, facing-based
backstabs, combo resets, ranged exclusion, defeat healing and non-player actors.
The full suite has 234 passing tests, including 34 focused skill tests and five art tests.
The art tests cover unique talent imagery, registry coverage, 64px RGBA assets, illustrated
fallbacks and preserved locked-state colours. Type checking and production build pass.
An isolated browser check passes 89 assertions for distinct combat art, prerequisite
connectors, profession changes, learning eligibility, direction switching, image loading,
zoom controls, fallback handling and actual transparent pixels in all 34 assets.

## The general branches, deeper (2026-10-03)

Asked for: swiftness = dodge, movement speed, special movement; damage = attack, critical rate,
critical damage; survival = max health, defence, hunger, natural regeneration, a way to survive
the brink. Each branch keeps its first arms and capstone, gains two more arms, and a second
two-point capstone that needs both of them (the last node of the branch). Each added node
received its own illustrated icon on 2026-10-04. Tests: `tools/test/general-skills.test.ts`.

| Branch | New arm A | New arm B | Capstone (2) |
| --- | --- | --- | --- |
| Swiftness | Nimble (dodge +5%) → Acrobat (+7%) | **Dash** (Q: 3 tiles ahead, 4 s) → Slipstream (+30% move 2 s after) → Tailwind (+1 tile, −1.5 s); Dash → Phantom Step (through creatures, 0.5 s untouchable) | **Untouchable**: dodge +3%; a dodge makes the next attack within 2 s a sure critical |
| Damage | Brute (+3 attack, after Heavy Blows); Precision (+5% crit) → Hemorrhage (crits bleed 1/s for 4 s, through defence); Lethal Edge (crit damage +25%) → Brutal (+25%) | First Strike (+30% on a target at full health) → Momentum (+5% per hit in a chain within 1.5 s, up to +25%) | **Berserker** (Brutal + Momentum): at half health or less, +25% damage and +10% crit |
| Survival | Iron Will (+8 max health, after Hardy); Thick Skin (+1 def) → Fortress (+2 def); Adrenaline (after Defiance: a blow to ≤30% health gives +30% move and 1 health/s for 5 s, once a minute) | Frugal (hunger slower again), Hearty Meals (food +50%), Regeneration (after Second Wind: heal from a quarter-full food bar) | **Phoenix** (Fortress + Regeneration): once a day, any lethal damage (blows, fire, hunger) leaves 30% health and 3 s untouchable |

Mechanics: `dodge` (capped at 50%; rolled only by those who have it, so the world's dice are
unchanged for others) and the untouchable moment (`combat.guardUntil`) live in
`combat.ts` `combatDamage`; a dodged blow does nothing (`Engine.damage`). Critical damage is
`(Deadly Focus ? 2 : 1.5) + critDamage`. Phoenix is checked in the struck one's own `hurt`, so it
covers piercing and environmental harm too.

Where each talent acts (design.md §5.13: every change is an outcome, and an outcome writes only
its host). What a talent does to the striker's blow is computed by the striker's act-making
(`combatStrike`) and carried by the act: its power, a critical, a bleed it opens (Hemorrhage:
`bleed`), health it draws back (the Warlord's answer: `drain`). The weapons' rules pass `bleed` and
`drain` on to the strike; the struck one's `hurt` opens the wound — the status `bleeding`, given
in the striker's name, which pulses once a second (`body/bleed`), so a creature that bleeds out
was felled by them — and sends the drained health back as a `restore` the striker answers.
Adrenaline is the status `adrenaline` the struck one takes in its own `hurt` (`body/adrenaline`
mends 1 a second). Arcane and Shadow Recovery are the striker's own rule on the defeat's notice
(`combat/learn`: the defeat carries the instrument of the last blow). The dash is an act of moving
(`combat.ts` `dash`, any actor; the player's Q). Combos, chains, marks and the windows a talent
opens are the actor's memory of its own blows (`Entity.combat`), written only by itself.
Learning a skill and taking up a profession are acts (`learn`, design.md §5.14): the skill tree
and the trainer's panel make them, the actor's outcome spends the points and grants.

## Active skills and the skill bar (2026-10-08)

The talents above stay automatic. Beside them, twenty **active skills** are cast by hand and then rest
(`SkillDef.active`, engine `actives.ts`; content `ACTIVE_SKILLS` in `skills.ts`): everyone's four — two blows
(Whirlwind 旋风斩 after Sweep, Cleave 重劈 after Strength), a quickness (Gale Step 疾风步 after Light Footed;
the Dash stays on Q apart) and a mending (Mend 疗伤 after Regeneration) — and four for each profession, two
after its first talent and two after those:

| Profession | Active skills |
| --- | --- |
| Assassin | Shadow Strike 影袭, Envenom 淬毒 → Smoke Bomb 烟雾弹, Flurry 千刃 |
| Warrior | Shield Bash 盾击, Charge 冲锋 → War Cry 战吼, Earthsplitter 裂地 |
| Ranger | Multishot 多重箭, Leap Shot 后跃射击 → Piercing Arrow 穿透箭, Arrow Rain 箭雨 |
| Mage | Fireball 火球, Frost Nova 冰霜新星 → Chain Lightning 闪电链, Blink 闪现 |

A cast is the game's own logic made of ordinary acts, as the Dash is: its blows are acts of using the weapon
(the caster's atk and weapon power times the skill's `power`, through `combatStrike` as side blows, so criticals
apply but primary combos do not), carrying what the skill leaves (`afflict`: stunned, frozen; `element`); its
movements are moves; what it leaves on the caster (Gale Step's speed, a War Cry's guard and strength, a Smoke
Bomb's veil, Envenom's poisoned blows, an Arrow Rain's volleys) is combat bookkeeping on `Entity.combat`; a
mending is told to the caster, who answers it (content `body/stage`, what = mend). Cooldowns rest on the engine's
cooldown table (`skill:<id>:<actor>`), as the Dash's do.

**The skill bar** (client `ui/skillbar.ts`, bottom left): six slots, `Entity.skillbar`, cast with **Shift+1–6**
or a click, after Dungeon Fighter's — square bevelled frames, the key in the corner, a dark sweep and the
seconds while a skill rests, a flash when it is ready. A learned active skill goes in the first empty slot;
over the skill tree, hovering a learned one and pressing Shift+1–6 sets it there; slots are dragged to swap
and right-clicked to empty. The twenty icons are drawn by code (`tools/src/art/skill-actives.ts`), not by the
image generator the other icons came from. Proved by `tools/test/actives.test.ts`.

**Where active skills come from** (engine `knownActives`): the skill tree; a **skill book** (`item/document/skillbook`,
its `teaches` prop; content `skillBook(id)` makes one) read by using it on oneself — no points and no skills before
it, only its profession; the book is used up (`use/read-skillbook` → `body/stage` what = read → `learn {book}`;
the learner keeps `skillFrom:<id>` = book); and **what one wears** — any piece with a `skill` prop lends that skill
while worn, whoever wears it (no profession asked). A lent skill left in a slot when its piece comes off shows as not
had and is not cast. **The skill panel** (U, or its button bottom right; client `ui/skillpanel.ts`) lists every active
skill one has with its source, above the skill bar's six slots: a skill goes in a slot by dragging its card there,
or by a click on it and then on the slot; a right click empties a slot. A skill's blows are struck with a weapon
only — never with whatever else the hand holds.
