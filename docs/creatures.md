# Creature skills

The minor monsters' own skills: what each kind does beyond its plain blow, how the player reads it coming, and how it
is built. Since 2026-10-15 the minor monsters' skills and the bosses' are one system (docs/skills.md): one skill type,
one pipeline, one primitive; the minor monsters differ in how a skill is taken up — one or two skills a kind, short
wind-ups, no phases.

Owner: Bao Zhuhan (minor monsters' looks and skills). Boss skills: Crepuscular.

## 1. Goals

- **Every kind plays differently.** Before this, a creature only chased and struck; kinds differed in numbers alone
  (health, attack, speed, an element, a reach). Now each family has a signature move that changes how one fights it.
- **Every skill is readable and answerable.** A skill names itself over the creature's head, marks the exact cells it
  will hit, fills them as it nears, and the creature flashes white just before. The marks are locked when the wind-up
  starts: stepping off them always dodges. Stunning, freezing or tying the creature in its wind-up cancels the skill.
- **The setting.** docs/lore.md §2: as the First Night seeps in, beasts and plants turn strange, the dead cannot rest,
  and things that do not belong to the world come out at night. The skills are that change: beasts are fiercer (a lunge that opens a
  bleed, a howl that frenzies the pack), the dead grasp and wail, the night's things throw fire and lightning.
- **No judgment is "is it the player".** A skill strikes whoever its creature is hostile to on the marked cells.

## 2. References

- **Stardew Valley**: few, distinct monster patterns (a slime's hop, a bat's swoop, a serpent's dive), each learnable in
  one encounter. The model for "one signature move a family".
- **Elin**: a monster's abilities are a list taken up by chance when they could be used (range, cooldown), on top of
  its plain attack. The model for `chance`, `range` and `cooldown` in the kit.
- **Minecraft**: the spider's leap and the creeper's fuse — a short, visible wind-up the player learns to answer.
- **Our bosses** (docs/bosses.md): locked telegraphs on exact cells. Reused as a principle, not as code.

## 3. Design

### 3.1 The roster

Ticks at 10 a second. `atk` is the creature's attack; damage is before defence.

| Kind | Skill | When | Marks | Wind-up / cooldown | What lands |
|---|---|---|---|---|---|
| Slimes (all, the Slime King too) | Hop 弹跳 | 2–3 cells, 60%/s | 3×3 around the foe; leaps there | 0.8 s / 4 s | atk × 1.5 in its own element |
| Wolf, frost wolf | Lunge 扑咬 | in a row, 2–3 cells, 70%/s | the line, 3; dashes to the first foe | 0.7 s / 5 s | atk × 1.5, cut, its element; bleeding |
| | Howl 狼嚎 | under 60% health | none | 1 s / 60 s | itself and every beast within 6: frenzied |
| Boar | Charge 冲撞 | in a row, 2–5 cells | the line, 5; dashes | 1.2 s / 6 s | atk × 2, pushed 2, stunned; into a wall: it is stunned itself |
| Bat | Swoop 俯冲 | in a row, 2–3 cells, 70%/s | the line, 3; dashes, springs back 2 | 0.6 s / 4 s | atk × 1.2, pierce; it mends 1 |
| Zombie | Grasp 腐臂紧抓 | adjacent, 60%/s | a cross around itself | 1 s / 5 s | atk × 1; mired |
| Skeleton | Bone Toss 掷骨 | in a row, 2–5 cells | the line, 5 | 0.8 s / 4 s | atk × 1 |
| Ghost | Wail 哀嚎 | 1–2 cells | a disk of 2 around itself | 1.2 s / 7 s | atk × 0.8, its cold; stunned |
| Golems | Ground Slam 震地 | 1–2 cells | a disk of 2 around itself | 1.6 s / 6 s | atk × 1.6, its element; pushed 1 |
| Fire imp | Fireball 火球 | 2–5 cells | 3×3 around the foe | 1 s / 5 s | atk × 1.2 fire |
| Storm wisp | Discharge 放电 | 2–4 cells | a cross of 2 through the foe | 1 s / 5 s | atk × 1 lightning |
| Cave spider | Web Spit 吐丝 | 2–4 cells | 3×3 around the foe | 0.8 s / 6 s | webbed |
| | (its bite) | every plain bite | — | — | one in four: poisoned |
| Dragon whelp | Ember Breath 余烬吐息 | in a row, 1–3 cells | a cone of 3 ahead | 1 s / 5 s | atk × 1.2 fire |
| Giant crab | Shell Up 缩壳 | under half health | none | 0.4 s / 15 s | itself: shelled |

The elements do the rest through the rules everyone already has: a frost wolf's lunge freezes the wet, a fireball on
the wet only steams, a discharge arcs through the wet.

### 3.2 What clings

New statuses (content `kits.ts` `KIT_STATUSES`): **poisoned** (3 s, 1 a second through any defence, `body/poison`),
**webbed** (2.5 s, steps take three times as long), **frenzied** (8 s, faster steps, attack +1), **shelled** (4 s,
defence +4, slow). Skills also give the existing **bleeding**, **stunned** and the sins' **mired**.

A body takes a coat as its own status through one rule, `body/afflict` (content `afflictions.ts`, shared with the bosses),
over the list `AFFLICTIONS`; a second rule on `actor` × `impulse/coat` would tie. A hold (stunned, knelt, entranced)
leaves the body `steadied` a while: no hold follows a hold.

### 3.3 Marks

Red: harm. Purple: what clings (web, grasp, wail). Amber: a call or a guard that marks no cells (howl, shell up). The
cells fill as the wind-up runs; the creature flashes white over its last half.

## 4. How it is built

The event model holds (design.md §5.4–5.15): behaviour decides when; the act's outcome is a rule.

- **Data**: `Ontology.kits` — by type, a list of `KitSkill` (engine `types.ts`; `CreatureSkill` is its other name): shape,
  aim, radius, how it moves (`leap`, `dash`, `back`), when it may be taken up (`range`, `aligned`, `below`, `chance`,
  `cooldown`), the wind-up and the marks' colour (docs/skills.md §1). A kind's kit is the nearest its type or an ancestor names.
- **Behaviour**: the `kit` goal (module `packages/modules/src/kits/kit.ts`), tried before `threat` (the game's
  `Ontology.goals`). Once a second it looks whether a skill fits its foe; taking one up, it faces the foe, says the
  skill's name, locks the cells and stands. Held, stunned or frozen meanwhile, it loses the skill. Its memory (what it
  is winding up) is the module's, beside the state: a save mid wind-up only loses the wind-up.
- **The act**: when the wind-up runs out the creature uses its own body on the aimed cell (`act/use`, params `kit`,
  `ox oy ax ay`). Its own rule answers (`kit/<family>` in content `kits.ts`), normally with the module's primitive
  `unleash {power, element, edge, coat, push, heal}`: the host moves as the skill says (it writes only itself), and
  each foe on the cells is struck, coated and pushed — impulses they answer themselves. A rule may answer otherwise: the
  howl emits a coat to the beasts around; shell up sets the crab's own status.
- **The client**: the frame's `telegraphs` (the module's frame hook) are drawn like the bosses' warnings
  (`render/scene.ts`); a creature whose leap or dash moves it several cells is tweened there; the new statuses tint
  the body.
- **The AI**: the module's `unleash` is in the ModSpec. A learned rule on a creature kind may answer `act/use` with a
  `kit` param like the base ones; a new kind's kit is data a later step may let the modder write.

## 5. Checks

- `games/openworld/tools/test/kits.test.ts`: every kit belongs to a kind and every skill has its rule; the patterns;
  a skill is marked in the frame and lands; stepping off dodges; a stun cancels; the wolf, boar, spider, slime, howl
  and crab each do what the table says.
- `games/openworld/tools/test/demo.test.ts` K1: on the real Hollow, its spider webs the player and its wolf lunges.
- The wiki: each monster's page has a 技能 section with the `{{怪物技能}}` table generated from the kit; the system
  page is 战斗/怪物技能.

## 6. Next

- **Looks.** The borrowed sprites that fit worst: the zombie (the pack's caveman tinted green) and the golems (the
  statue). The pack's two mushroom monsters are unused. Candidates: a new night-born mushroom kind (spore cloud:
  poison in a disk) for the forest — it needs a trophy, a codex entry, a wiki page and a place on a map (a demo
  requirement), so it is its own step. Own art goes through `tools/src/art/` like the animals.
- **Drops**: done (§7).
- **Levels and numbers**: done (§8); a play-through at level 1–5 should still confirm them.
- **Balance** wants a play-through at level 1–5: the spider and the boar are the first that can kill a careless player.
- **Variants per place**: a kit is per type; a stronger version for a later chapter is a subtype with its own kit.

## 7. Drops (2026-10-19)

Before this, a hostile monster had no makeup: felled, it left nothing but, rarely, its trophy (docs/gear.md). Now every
kind is made of something (content `drops.ts`, `CREATURE_DROPS`, applied to the types in `buildOntology`), and the base
rule `combat/defeat` breaks it down as it does anything with a makeup: half of each part (the world's recovery rate, at
least one), lying still where it fell, taken with F. No engine change.

- Mostly what the world already has: hides and meat (wolves, the boar, the whelp, the cyclops), bone and rags (the
  dead), stone, ore and frostcap (the golems), coal and fireweed (the imp), raw fish (the crab), and a bat's guano as
  fertilizer.
- Three things only monsters give: **slime gel** (every slime; the Slime King a heap), the **venom sac** (the cave
  spider) and **ectoplasm** (the ghost, the storm wisp). Each sells at one's stall (`DROP_SELLS`).
- **The antidote** is made at hand of a venom sac and a herb; drunk (`use/drink-antidote`, `body/antidote`) it clears
  the spider's poison and mends 4. The spider's threat and its cure come from the same body.
- Icons: `tools/src/art/drops.ts`. The full table: the wiki's 战斗/怪物掉落, and each monster's `{{掉落}}`.

Checks: `tools/test/drops.test.ts` (every hostile minor kind has a makeup the world knows; a felled skeleton leaves two
bones lying still; the three new things each have a use; the antidote clears poison), `npm run coverage` (no form
without a purpose).

## 8. Levels and numbers (2026-10-19)

Before this every monster was level 1 with hand-set numbers, and a level-1 player with a stone axe felled almost any of
them in under two seconds: the skills of §3 seldom had time to wind up. Now (content `levels.ts`) a kind's **level** is
its place in the world — the level its own trophy is made at (trophies.ts, 1–7) — and its numbers come from one curve
read through its **role**:

- health = 30 × role.hp × (1 + 0.25 × (level − 1)): it grows as gear does (`GEAR_LEVELS.perLevel`), so a monster met
  with gear of its own level takes as long to fell at level 7 as at level 1;
- attack = (2.5 + 0.5 × (level − 1)) × role.atk; defence = role.def + ⌊level / 4⌋.

| Role | hp | atk | def | Kinds |
|---|---|---|---|---|
| swarm | ×0.6 | ×0.8 | +0 | the slimes, the bat |
| fighter | ×1 | ×1 | +0 | wolves, the zombie, the skeleton, the spider |
| caster | ×0.7 | ×1 | +0 | the ghost, the imp, the wisp, the whelp |
| brute | ×1.6 | ×1.1 | +2 | the boar, the golems, the crab |
| elite | ×3 | ×1.2 | +1 | the Slime King, the barrow warden, the cyclops |

Experience stays the full health: the fights are longer, so what a minute of fighting gives is about what it was.

Checks: `tools/test/minor-balance.test.ts` duels every kind against a player with gear of its level (a stone axe's blow
grown a quarter a level, a point of defence every two), standing and striking and stepping off the marks: it is won
both ways, it costs something, a swarm lasts at least a second and anything else long enough to wind a skill up (it
does, for every kind with a kit but the elites), and what standing costs stays within its role's bound (12 for a swarm
or a fighter, 20 a brute, 30 an elite). Measured standing at gear of its level: swarms 1.3–2 s and 3–4 health,
fighters and casters 2–3 s and 3–8, brutes 5–7 s and 9–16, elites 9 s and 15–20.
