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

### 3.4 Where they are met (2026-10-19)

Four kinds with a kit stood on no map: their skills were never fought. Each now stands where its element is, on a map
of about its level (the map's `gearLevel`), witnessed by demo requirement K2:

| Kind | Map | Where |
|---|---|---|
| Spark slime ×2 | Dawn Hill (2) | the open top, where the storms break first |
| Giant crab | the Reed Bend (2) | the shore south of the spit |
| Ice golem | the Cinder Pass (6) | the snow below, with the frost wolves |
| Storm wisp | the Cinder Pass (6) | up the trail; and in a storm over the pass, up to two more (its own `appear` with `weather: ['storm']`) |
| Slime King | Thornwood Hollow (2) | the bog at the west end, off the way to the barrow (demo requirement K4) |

The world's night walkers stay the dead and the bats: the night's table is every outdoor combat map's, and a ghost
(level 4) or a wisp (level 5) there would meet a level-1 player in the Ford's meadow. A kind of a later place comes
by that place's own appearances, as the wisp's storm does.

On a map of the later chapters a kind is of the map's level however it got there: `levelCreatures` sets those placed and
fills `MapData.levelled`, the numbers `appear` gives each kind that comes by itself, the night's walkers among them
(`tools/test/map-levels.test.ts`).

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
  the body. Each mark carries the wind-up's **pose** (`Frame.telegraphs[].pose`, from `windupPose` in the kits module:
  by how the skill moves, else where it lands), and the body takes it as the blow nears (`windupPose` in scene.ts): it
  crouches to leap (wider, lower), draws back from its foe to dash, gathers itself up for a blow round itself, sways
  to cast, rears and trembles to call. A cast and a call are heard as they begin, a leap, a dash and a slam as they
  land (`hop`, `wind`, `impact` in the catalogue's sounds); a felled monster sounds a blow (`fell`), no longer the
  game-over jingle; one sound asked twice in a moment (a burst on nine cells) is heard once.
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

- **Looks.** Done for the five that fit worst (2026-10-19): the zombie, the stone and the ice golem, the giant crab
  and the storm wisp are the project's own sheets (`tools/src/art/creatures.ts`: each part drawn on its own, lit from
  the top left, outlined in the pack's line, laid over the parts before it; `lsw/Creature/<kind>/`, mapped by `own()`
  in the client's catalogue; before and after: `docs/figures/creature-looks.png`). Still the pack's: the slimes, the
  wolves, the boar, the bat, the skeleton, the ghost, the imp, the spider, the whelp. The pack's two mushroom monsters are unused. Candidates: a new night-born mushroom kind (spore cloud:
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
its place in the world — the level its own trophy is made at (trophies.ts, 1–7), or, for a kind met before that, the
level of where it is met (`MET_AT`: the barrow warden, a gate of chapter 1, at its floor's 4) — and its numbers come from
one curve read through its **role** (the ontology sets none of them by hand):

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

Experience stays the full health: the fights are longer, so what a minute of fighting gives is about what it was. Over the
kinds placed on the demo's maps that is about three times the experience of before (each kill is worth more, and there
are as many kills): levels and what they open (a profession at 5) come sooner on the main line. (Open, 2026-10-20.)

Checks: `tools/test/minor-balance.test.ts` duels every kind against a player with gear of its level (a stone axe's blow
grown a quarter a level, a point of defence every two), standing and striking and stepping off the marks: it is won
both ways, it costs something, a swarm lasts at least a second and anything else long enough to wind a skill up (it
does, for every kind with a kit but the elites), and what standing costs stays within its role's bound (12 for a swarm
or a fighter, 20 a brute, 30 an elite). Measured standing at gear of its level: swarms 1.3–2 s and 3–4 health,
fighters and casters 2–3 s and 3–8, brutes 5–7 s and 9–16, elites 9 s and 15–20.

## 10. The elites (2026-10-19)

The minor monsters' gatekeepers — the barrow warden (the sanctum, the barrow's deepest floor), the cyclops (the old
mine's deep end) and the Slime King — had no kit (the King only its kin's Hop). They stay minor monsters: they take
their skills up as any does (the kit goal, when a skill's conditions hold), never by a boss's director, with no plate,
camera or phases. What makes each a fight of its own is a kit of two to four, a chain and a guard (`ELITE_KITS`,
`ELITE_RULES` in kits.ts; the contract's elite tier: two to four skills, a wind-up of at least 0.8 s, 0.6 s for the next
of a chain, no encounter).

| Elite | Skill | When | Lands |
|---|---|---|---|
| Barrow warden | Vigil Sweep 守夜横扫 | 1–2 cells | a cone of 2: atk × 1.4, cut, pushed 1 |
| | Shield Charge 盾冲 | in a row, 2–4 | a dash: atk × 1.6, stunned; then the Vigil Sweep at once |
| | Hold the Post 坚守岗位 | under half health, steady | the ring 3 out: atk × 1, mired |
| Cyclops | Boulder Toss 掷石 | 3–6 cells | 3×3 at the foe: atk × 1.6, earth |
| | Stomp 跺地 | 1–2 cells | a disk of 2: atk × 1.5, earth, pushed 1; then the Aftershock: the ring 3 out, atk × 1 |
| | Baleful Glare 独眼凝视 | in a row, 2–6 | a line of 6: atk × 0.8, stunned |
| Slime King | Royal Bounce 王之弹跳 | 2–4 cells | a leap; a disk of 2 at the foe: atk × 1.5, its element |
| | Split 分裂 | under half health, not spent | two green slimes come off it, once (its prop `split`, which the skill's `spent` names: never wound up again) |

A skill that is only ever the next of a chain (the Aftershock) has the range [0, 0], which the kit goal never meets.
The warden's charge is meant to be dodged: one it catches is stunned for 1.5 s, longer than the 0.6 s the sweep winds
up, so the sweep always lands after it (about atk × 3 and a push in all).
Measured with gear of their level (minor-balance.test.ts): the warden 10 s and 24 health standing, 11 s and 6 dodging;
the cyclops 10 s and 19, 14 s and 16; the King 8 s and 15 either way. Checks: kits.test.ts (the King splits once; the
charge is followed by the sweep; the aftershock comes only after the stomp), kit-contract.test.ts (the elite tier).


## 11. Tactics (2026-10-19)

A minor monster walked up and struck, or stood and cast; none kept its distance, ran or worked with another. Two goals
of the kits module (`tactics.ts`) now move it in a fight, as behaviour (design.md §5.4), each read from its type's data
(content `CREATURE_TACTICS` in kits.ts, applied in `buildOntology`):

- **rout** (before the kit goal): hurt past `fleeBelow` of its health, it runs, each step as far from its foe as it can
  within its leash and, if it fears fire, out of a fire's reach (the bounds the threat goal keeps, after dark from where
  it roams). Cornered, it turns and fights; a skill it is winding up it sees through. The wolves and the frost wolves, at
  a fifth.
- **tactics** (after the kit goal: a skill it can take up comes first):
  - `keepAway`: one that fights from afar steps back from a foe come closer than that, keeping it in its row where it
    can (its lines aim there). The fire imp and the storm wisp at 3, the ghost at 2; cornered, it fights where it stands.
  - the tag `pack`: one of a pack goes round to its foe's far side from a packmate already beside it (a short search
    for the way round, out of a fire's reach), past the foe's other sides; the mate it goes by is the first of the pack
    (by id) beside the foe, so two never circle each other, and one across from a mate stays. The wolves.

The order matters: with keeping away before the kit, an imp spent every turn stepping back and never cast; after it,
an imp too close casts when it can and steps back when it cannot. Goals: `encounter, rout, kit, tactics, threat, …`.

Checks: kits.test.ts (an imp come too close steps back; a wolf badly hurt runs, and cornered by its leash fights; two
wolves come at their foe from opposite sides), minor-balance.test.ts unchanged in its bounds (the imp now 1.8 s and 5 health standing, 3.6 s and none dodging).

## 12. Traps and a new kind (2026-10-19)

- **The cobweb.** A spider's Web Spit leaves a cobweb (`fixture/nature/web`, content `COBWEB`) on each cell it fell on
  that no one stands on (`unleash`'s `leave`). Who wades into one is webbed (`web/snare`: contact, a spider walks its
  own, a flyer never touches it); a blow or a flame tears it (2 durability, flammable; `web/torn`); it sags away in
  twelve seconds (`web/sags`, its stage). The briars' pattern (bosses.ts), on a minor monster.
- **The sporecap** (`actor/creature/fungus/sporecap`, a new family `fungus`): a mushroom the First Night has woken
  into a thing that walks (docs/lore.md §2: beasts and plants turn strange), drawn with the pack's mushroom monster,
  unused until now. Level 2, a fighter; slow; flammable. Its kit: **Spore Cloud** 孢子云, a disk of 2 round itself,
  1.2 s: atk × 0.8, poisoned. It leaves a herb; its own piece is the Sporecap Hat (a piece of its own, outside the
  families' sets, which were full). Two stand in Thornwood Hollow, where the thorns grow thickest (demo K3).
- The contract's families are fifteen now.

Checks: kits.test.ts (the web left round the player, who wades in is webbed, a blow tears one, the rest sag away; the
Spore Cloud poisons), demo.test.ts K3, trophies.test.ts (the sporecap's piece stands alone).

## 13. Struck from afar (2026-11-19)

A monster looked for foes only within its sight, so whoever struck it from beyond that was never answered: a bow's six
cells against a wolf's five, and seven kinds of eight stood under the arrows. Now one that struck it in the last ten
seconds (`combat.lastHurtBy`, `PROVOKED` in engine `creatures.ts`) is its foe wherever it stands, for the threat goal
a minor monster's kit goal and its tactics alike (`provokedBy`; a boss's director already sees the whole map): it
comes on, or into its own reach if it shoots, as far as its leash lets it. Once ten seconds pass without a blow, one out
of its sight is forgotten and it goes back toward home (to within four cells of it); if they come into its sight again it fights them again, and one within its sight it fights on, as before. A passive animal struck from
afar runs from the one who struck it for those ten seconds. A short leash still stops it: a skeleton on a leash of 3
cannot reach an archer six cells off. Minecraft's mobs turn on whoever hurt them the same way.

Checks: provoked.test.ts (a wolf and a fire imp shot from six cells come and fight back; one left alone stays; one
struck once by someone who then goes out of its sight chases them, then goes home).

## 14. The late roads' kinds (2026-11-20)

Chapters 3 to 5 had borrowed the Ford's kinds: the Black Balance's clerks were ghosts, the Pale Fens' wisps were storm
wisps. Each chapter now has a kind of its own, and each asks an answer none before it did, the way a new enemy in a
Souls game or Monster Hunter teaches one new read.

- **The Hollow Clerk** 空心书记官 (`undead/clerk`, a fighter, the six desks of the Black Balance). **Weigh** 称量:
  it stands 0.6 s, then is `weighing` for 1.5 s, gold on its body (the status's tint; the skill marks no cells). A
  blow struck meanwhile does it no harm and comes back on the striker at the clerk's own attack (`clerk/weigh`, an
  `impulse/strike` rule of the status). **Strike the Account** 勾账: a cone of 2 toward its foe, 1 s, atk × 1.4 cut.
  The answer is to hold one's blows: the read Sekiro's and Dark Souls' parries ask of the player, turned round.
- **The bog wisp** 沼火 (`wisp/bog_wisp`, a caster, keeps away at 3, the causeway and the drowned graves).
  **Beckon** 招引: from 2 to 4 cells off in its row, a line of 5, 1 s, pulls 3 toward it (so from its farthest one lands beside it), and chains into **Corpse Light** 尸火: the ring of 8
  round itself, 0.6 s, atk × 1.3. The will-o'-wisp that leads one into the bog, with a hook's two beats (Dota's Pudge):
  step off the line and neither lands; pulled, step out of the ring.
- **The Restless** 不安者 (`undead/restless`, a caster, keeps away at 3, two in the catacombs among the dead).
  **Plea** 哀求: a line of 4, 1 s, atk × 1, mired. **How Long?** 还要多久: half the times it may, it stands 1.4 s
  and robes itself and every undead within 5 (`coat robed`, the `body/afflict` rule), 5 s mending 4% of their health a
  second (`body/robed`). Diablo's Fallen Shaman and Dark Souls' Channeler: the one to fell first, or to draw the others
  away from.
- Their pieces are a fourth trinket family, the Unreleased 未释者首饰 (the Ledger Ring, the Fenlight Earring, the
  White-Robe Clasp; levels 12, 15, 18). The kits are eighteen.

Checks: kits.test.ts (a clerk weighing takes no harm and strikes back; the wisp beckons and burns; the Restless robe
the dead within reach and they mend), minor-balance.test.ts (a guard status is a wall: standing into it may cost a
brute's 20, reading it a fighter's 12), demo.test.ts K5 (each kind on its maps, their kits and their set).

## 15. Weaknesses and immunities (2026-11-20)

Until now an element on a blow reached only what the element itself did (a burn, a chill, a shock); the blow's harm
was the same whatever it struck, and the resistances the engine already had (world-model.md §6.8) were read by those
reactions alone. Now the whole blow is the element's: `hurt` in answer to a strike that carries one meets the one
struck's resistance to it (effects.ts), and the frame's `damage` says what it made of it — `weak`, `resisted`,
`immune` — so the number is drawn larger with a `!`, smaller and dimmer, or as the word Immune (hud.ts).

Each minor kind's resistances come from what it is (content `affinities.ts`), never from a list of kinds:

- its own element it is immune to (a fire slime, the storm wisp, the ice golem);
- each of its tags, inherited down the type tree, brings its nature's: the elemental ones their element's immunity and
  the opposite's weakness (fiery to water, icy to fire, charged to earth, watery to lightning, stone to water), and
  the rest a weakness or a share each — what burns (beasts, the sporecap), rots or wears cloth to fire, bone to earth,
  spirits to wind, dragons to ice, constructs half lightning, fur a quarter of the cold;
- of several, the strongest resistance and the worst weakness count. A weakness is half again the harm (−50), an
  immunity none of it (100).

References: Pokémon's type chart (the reads by a thing's nature, a dragon's cold, electric to ground), Monster Hunter's
weakness stars (one or two weaknesses a kind, never a wall of numbers), Elin's per-element resistances (the engine's
model already). The green slime, the spider and the cyclops stay neutral, a baseline. The bosses keep theirs as their
owners set them: `CREATURE_ROLES` names the minor kinds alone.

The element/actor reaction no longer weighs its harm itself (water on the fiery took 1.2 of the blow's power, lightning
on a construct a half): the resistances carry it, so a weakness is never counted twice. The fireproof draught's
resFire 75 now meets fire blows as well as burns, which its own words and the wiki already promised (the dragon's
fire does a quarter of its harm to one who drank it).

Checks: affinities.test.ts (a wolf takes half again from fire and less from ice, a storm wisp nothing from lightning,
each with its mark in the frame; every kind immune to its own element, at most two immunities and two weaknesses, every
element someone's weakness, the green slime neutral, every nature's tag worn by some minor kind; a reaction weighed once). The wiki's monster infobox
reads the three rows from the data (templates.ts), and 元素 has the table.

## 16. How a blow looks (2026-11-20)

A minor monster answered a blow with a number over its head and nothing more, and fell by vanishing. Every action game
since Zelda draws the blow on the body: Hollow Knight and Hades flash the struck body white for a few frames and knock
it back from the striker; Minish Cap and Stardew's monsters burst into motes as they fall; Zelda's octoroks and
Stardew's slimes lunge at you as they strike. The page now does the same (runtime `render/scene.ts`):

- **Struck** (`struck`, `jolt`): white for 90 ms, knocked 2.5 px back from the one who dealt the blow (4 px on a
  weakness), easing back over 160 ms. Only actors other than the player, never a boss (its own animations answer).
- **Striking bare** (a monster's swing with no weapon to draw): a 4 px lunge the way it faces and back, 180 ms.
- **Felled** (`fell`): white, squashed, then stretched upward and faded as it rises 8 px, with eight motes in its own
  tint flying out; 330 ms in all, then the view is gone. Bosses and persons keep their own.

For this the frame's `damage` carries `by` (who dealt it, when someone did) and `fell` (the blow brought it to
nothing); the felled one leaves the frame in the same tick, so the page reads `fell` before the removal.

The bog wisp has its own sheet now (tools `art/creatures.ts`): the storm wisp's ball of light in marsh-fire green, where
it was the pack's spirit tinted.

Checks: motion.test.ts (a landed blow names its striker; only a felling one says `fell`, and the felled is gone in that
frame; a monster striking bare makes a swing naming it).

## 17. Their own colours (2026-11-20)

Seven minor monsters wore one of the pack's sheets under a multiplying tint: the fire, frost and spark slimes, the
frost wolf, the sporecap, the hollow clerk and the restless dead. A multiplying tint only darkens, so each came out a
muddy cast of its source, and the fire slime and the frost slime were one sheet in two shades. They are recoloured
pixel by pixel now (tools `art/recolours.ts`, after alberic-human.swift): every colour of the pack's sheet mapped to
its own, the drawing and its line kept, the faces too, and the moods the face tool draws on the restless's. What
tells a kind apart at a glance is drawn on its frames:

- **Fire slime:** amber, a flame four pixels high on its crown that sways with its step.
- **Frost slime:** pale ice, a cluster of cyan shards on its crown.
- **Spark slime:** the one-eyed slime in yellow, its eye electric blue, a spark leaping off it at another place each step.
- **Sporecap:** the cap violet with lime spots, spores drifting up off it. A sporecap no longer passes for one of the
  Hollow's red mushrooms.
- **Frost wolf:** the horned beast in ice, horns and fangs white and cyan.
- **Hollow clerk:** the inspector gone to ash, his coat faded to ink-grey, his hat yellowed like old paper.
- **Restless:** the monk gone grave-pale, in grey grave-cloth.

Where a leap brings the body to the frame's top, its marks are lowered with it rather than cut off. A felled one
breaks into motes of its own colour (§16): the tint gave that colour before, and now the sheet's `tone` in the
catalogue gives it, the bog wisp's too.

The pack's Slime and Slime2, sheets and faces, stay copied as the sources (copyAssets.ts `KEEP`). No minor monster
wears a tinted sheet now.

## 18. Noticed (2026-11-21)

A monster that turns on you used to do it without a sign; one at the edge of the screen was already on its way
before you knew. Now it shows it: a "!" pops up over its head for a moment as it takes a foe up, as a Pokémon
trainer's does when you cross their sight and a guard's in Metal Gear.

- **When.** The moment it takes a foe up to fight or to run from (`ai.state` turned `chase` or `flee`): the threat
  goal, the pack's tactics, and now the kit goal too, since one that opens with a skill is in a fight as much as one
  that closes in. A passive creature that bolts shows it as well.
- **Once.** It shows again only after five seconds without a foe (behaviour.ts `FORGET`), so a monster that turns
  back at its leash and comes on again, or a foe at the edge of its sight, does not flicker it.
- **The signal** is the one a startled person already gives (npc.ts): the `emote` fx with the mood `surprised`. The
  engine adds no new kind of fx. The page draws it for a creature as a short pop (hud.ts `alert`, 0.9 s) rather than
  a person's speech bubble, and above whatever the creature says at the same moment: a monster that opens with a
  skill shows the "!" over the skill's name, which still warns of the wind-up. Any other surprise of a creature's (a
  rule's or a scene's emote, a step into fire) is drawn the same way. Bosses (their own openings), people and
  companions are left out.
- **Kept** for the map in hand only, as the people's runtime is: a save forgets it, and a monster already after you
  when a game is loaded shows it once more.

Checks: `tools/test/motion.test.ts` holds that a monster that takes a foe up shows it once over eighty ticks, not at
all while it sees nothing, and again when it sees once more after that; and that a wolf three cells off whose first
act is its lunge has shown it by the time it winds up. Without the kit goal's change that second check fails. In
the browser, a wolf on Dawnhill showed the "!" within 0.6 s of the player coming into its sight.

## 20. They come back (2026-11-28)

Twelve of the twenty-three kinds with a trophy were only ever placed, one to six of them in the whole world, and
nothing brought them back: a fire slime's gloves at 4% and a frost wolf's hood at 10% were out of reach for good
once the few were down, the pity count never got near fifty. Now a minor monster placed on a map comes back to it,
as the creatures of an area do in Zelda, Monster Hunter's small monsters and an MMO's camps.

- **What.** On every map, each kind with a role (levels.ts `CREATURE_ROLES`) that is not an elite, placed on a tile
  there, and not already named by one of the map's appearances (demo/kit.ts `comeBack`). The bosses stay one of a
  kind, and a map's own wolves or zombies that already come back keep their way of it.
- **How.** One appearance per kind (engine appear.ts): up to as many as were placed, on the grounds they stood on,
  with the placed one's behaviour, temper, sight and leash, at home where it comes. It comes on the map in hand only
  (dormant maps are frozen), every 3600 ticks, six game hours: a camp cleared stays clear for the evening, and is
  back the next day.
- **Levels.** On the late maps `levelCreatures` adds them first, so one that comes back has the numbers of one
  placed there (map-levels.test).

Checks: `tools/test/come-back.test.ts` holds that every minor kind placed on a map comes back to it, up to as many
as were placed, and that the frost wolves of Cinder Pass, all put down, come back on its snow with the placed ones'
ways. Both fail without the change. A trace of the real tick loop on the pass brought a wolf back 2200 ticks after
the two were put down (the next six-hour mark) and the second 3600 ticks after that; they then fought the player.
