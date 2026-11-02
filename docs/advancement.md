# Advancement: the second and third (2026-11-01)

Asked for: deepen the professions' trees; a **second advancement** that chooses one of **three paths**; a **third
advancement** after it that is not a path but the profession's own; new active and passive skills for every path and
every profession. Built on the professions of [skill-tree.md](skill-tree.md) (taken at a trainer from level 5, a tree of
22 nodes each, active skills on the skill bar) — reference: MapleStory's job advancements (a first job, then a choice
of branch, then the branch's later jobs) and Dungeon Fighter's awakenings (a late tier every subclass of a class
shares in spirit); here the third tier is shared by the whole profession. Asked later the same day: the assassin's
paths become the **Necromancer** (poison, necromancy, the dead raised), the **Shadowdancer** (stealth, the backstab,
criticals, dodge) and the **Demon Hunter** (sigils on the ground, hexes, buffs shared with one's companions, control) —
the Necromancer fighting through the dead it raises and its poison, never with its own blows —
and its third takes a name after the path — **Hell Sovereign** 地狱支配者, **Phantom** 幻影, **Ghostwail** 鬼泣 — its
skills still the assassin's own (`PathDef.third`; `thirdOf` gives the mastery under the path's name). In the skill
tree the path goes on after the profession's own tree, out of its last skill, and the mastery after the path
(`SkillBranchDef.after`).

## 1. The three advancements

| Tier | Level | Where | What it opens | Points |
| --- | --- | --- | --- | --- |
| **First**: a profession | 5 | a trainer | the profession's tree (22 nodes, +4 now) | — |
| **Second**: a path, one of three | 10 | a trainer | the path's six skills (three active, three passive) | +3 |
| **Third**: the profession's mastery | 16 | a trainer | the mastery's five skills (two active, three passive) | +3 |

- **Trainers**: Bram in Firstlight, and now **Sergeant Kell** in the March's camp (Chapter 2; his role trainer, the drill sergeant of the Left Company) — the same panel, its advancement section below the professions.
- **Changing**: a path can be changed at a trainer, as a profession can: the path's skills are unlearned and their
  points come back. Changing the profession clears the path (the advancement stays: one who has advanced chooses a path
  of the new profession) and gives back every profession, path and mastery point.
- **Points**: every level still gives one; the second and third advancements give three more each, so the new trees are
  reachable without unlearning the old.
- **The engine** (the classes module): the actor's `advancement` (1–3) and `path`; `SkillDef.path` (a path's skill,
  learned only on it) and `SkillDef.tier` (3: the mastery's, learned only once advanced so far); the act `advance` at a
  trainer (refusals: level, trainer, path, done), the trainer's panel asking for it.

## 2. The paths

### Assassin

| Path | Root (passive) | Actives | Passives | Ultimate (2) |
| --- | --- | --- | --- | --- |
| **Necromancer** 死灵术士 — the dead and the poison, the body standing back; third: Hell Sovereign 地狱支配者 | Grave Pact: the raised +50% health, +30% harder | Raise Dead (two skeletons fight at your side 30 s); Miasma (a cloud on the 3×3 ahead, 5 s: poisons) | Grave Toxin (every blow of the raised poisons 3 s); Corpse Burst (a poisoned foe felled by you or the raised bursts: those within 2 struck ×0.6 and poisoned) | Army of the Dead (those within 2 struck ×0.6 and poisoned; four skeletons rise) |
| **Shadowdancer** 影舞者 — the veil and the back; third: Phantom 幻影 | Shadow Poise: with a dagger, dodge +8%, critical +5%; a Backstab +30% more | Umbral Step (vanish 2 s; the next blow is a sure critical); Blur (4 s: dodge +35%, movement +20%) | Unseen (the first blow out of a veil +50%); Riposte (a dodge readies +80% on the next blow) | Thousand Shadows (behind up to five foes within 4, ×1.4 each) |
| **Demon Hunter** 猎魔人 — the sigil and the hex; third: Ghostwail 鬼泣 | Hunter's Lore: +15% on a foe under any affliction | Binding Sigil (a sigil on the 3×3 ahead, 8 s: who walks in is hexed 4 s — attack −2, defence −3, slower); Call of the Hunt (6 s: you and your companions within 6, +20% damage, +15% attack speed) | Hexing Edge (with a dagger, one blow in five hexes 4 s); Hunter's Vigil (you and your companions within 6, −10% taken) | Demon Prison (those within 2 struck ×1.0 and stunned 1.5 s; a ring of sigils round you) |

(First built the same day as the Nightblade, the Venomancer and the Bladedancer; replaced before release.)

**Mastery — the assassin's third** (named for the path): Lethality (passive: critical damage +30% with a dagger); **Death Mark** (active:
the nearest foe takes +30% from you for 8 s; if it falls marked, every skill is ready); Ghost (passive: dodge +8%);
**Assassinate** (ultimate: behind the marked, or the nearest, foe within 6: ×5, a sure critical); Shadow Lord (capstone:
every fifth blow is a critical).

### Warrior

| Path | Root (passive) | Actives | Passives | Ultimate (2) |
| --- | --- | --- | --- | --- |
| **Sentinel** 哨卫 — the shield | Shieldbearer: with a shield, combat damage taken −10% | Bastion (4 s: every blow from the front is blocked); Challenge (foes within 3 turn on you and are dazed; −20% taken 4 s) | Retort (a blocked blow strikes back for half); Unyielding (at a third of health or less, −25% taken) | Aegis (6 s: no blow takes more than 1) |
| **Berserker** 狂战士 — fury and blood | Blood Fury: the more hurt, the harder (to +30%) | Blood Rage (pay 15% health: 6 s of +40% damage, +20% attack speed, 2 drawn a blow); Reaving Spin (×1.4 round you) | Carnage (a felling mends 4%); Pain Eater (below half health, 1 more drawn a blow) | Leap of Ruin (leap up to 5, the 3×3 there ×2.2, stunned) |
| **Thornknight** 荆棘骑士 — the Order's way: thorns and kneeling | Thorned Mail: who strikes you hand to hand is pricked for 2 | Kneel (those within 2 kneel 1.5 s, ×0.6); Briar Line (briars down the 4 cells ahead, 6 s: they make one kneel) | Crown's Due (+30% on the kneeling and the stunned); Hold the Line (standing your ground, −20% taken) | Crown of Thorns (briars in a ring round you; 6 s of −30% taken) |

**Mastery — Paragon** 典范: Iron Body (passive: max health +20); **Unbreakable Will** (active: 5 s, nothing holds you
still and −40% taken); Weapon Master (passive: attack +3); **Godslayer** (ultimate: the three cells ahead ×5); Living
Legend (capstone: once a minute a blow that would fell you leaves 30% health).

### Ranger

| Path | Root (passive) | Actives | Passives | Ultimate (2) |
| --- | --- | --- | --- | --- |
| **Sharpshooter** 神射手 — the single shot | Eagle Eye: with a bow, critical +5%, damage +10% | Deadeye (one arrow ×3.5); Ricochet (an arrow leaping to 3 foes, ×1.1) | Weak Point (with a bow on a foe below half health, critical +15%); Patience (each second still, +10%, to +40%) | Heartseeker (through every foe in line, ×3, a sure critical) |
| **Trapper** 陷阱师 — the snare and the spike | Lay of the Land: movement +8%, dodge +4% | Snare Trap (the first foe on it is held 3 s); Spike Trap (spikes down 3 cells: those crossing bleed and are mired) | Ambusher (+40% on the held, mired or stunned); Tripwire (critical +25% on the held) | Killing Field (blast traps all round you, ×2 fire) |
| **Beastmaster** 驯兽师 — the hound | Pack Bond: a beast you call has half again its health, and strikes 30% harder (and grows with your level) | Call the Hound (a hound fights at your side 40 s); Sic (your beast leaps on the foe ahead, ×2 of its own, and it bleeds) | Feral Instinct (a companion near: dodge and attack speed +8%); Pack Hunter (a companion near: damage +15%) | The Pack (three wolves, 20 s) |

**Mastery — Master Archer** 箭圣: Hawk's Patience (passive: critical +10% with a bow); **Wind Arrow** (active: through
every foe in line ×1.5, staggering them); Fletcher (passive: Multishot +1 arrow); **Thousand Arrows** (ultimate: the
7×7 round the first foe, five volleys ×0.8); Eagle's Grace (capstone: dodge and attack speed +10%).

### Mage

| Path | Root (passive) | Actives | Passives | Ultimate (2) |
| --- | --- | --- | --- | --- |
| **Pyromancer** 炎术师 — fire | Kindling: fire sets the struck burning one time in three | Flame Wall (embers across the 5 cells ahead, 5 s); Combustion (every burning foe within 5 bursts, ×2.5) | Conflagration (+25% on the burning); Ember Heart (fire spells rest 20% less) | Inferno (fire on the 5×5 round the first foe, four times) |
| **Cryomancer** 霜术师 — ice | Rime: +30% on the frozen | Ice Lance (through the line ×1.6, frozen 1 s); Glacial Prison (the nearest foe frozen 4 s) | Shatter (a blow on the frozen ends it and doubles); Frost Armour (who strikes you hand to hand is frozen a moment, one time in five) | Blizzard (ice on the 5×5 round you, five times, freezing) |
| **Dawnbringer** 晨光术士 — the light against the Night | Dawnlight: +30% on the undead and the night's walkers (`nightborn`) | Sunburst (light round you ×1.4, those within 2 dazzled 1 s); Sanctuary (holy ground on the 3×3 round you, 6 s: you mend 2 a second and take 20% less) | Lantern Soul (at night, +10% damage and skills rest 15% less); Mercy of Dawn (Mend heals 15% more of your health) | Daybreak (a pillar of light on the first foe, ×4) |

**Mastery — Archmage** 大魔导: Arcane Mastery (passive: what carries an element +20%); **Time Warp** (active: every
other skill's rest halved); Mana Flow (passive: cooldowns −10%); **Convergence** (ultimate: fire, ice and lightning on
the first foe ahead, ×2 each); Ascendance (capstone: each cast +10% damage for 4 s, three times).

## 3. The first trees, deeper

Each profession gains two actives and two passives at its first tier: the assassin **Garrote** (from behind ×2, stunned
1 s), **Caltrops** (the 3×3 ahead mires for 5 s), Light Step (+8% movement with a dagger), Cut Deep (bleeds 1 more);
the warrior **Hamstring** (×1.2, mired 3 s), **Sunder** (×1.5, the struck takes +20% from you 5 s), Battle Hardened
(−8% taken), Sword Mastery (critical +5% with a sword); the ranger **Volley** (the 3×3 round the first foe, ×1.0),
**Disengage** (leap 3 back; those beside you mired), Keen Arrows (critical damage +15% with a bow), Fleet Foot (+5%
movement and dodge); the mage **Arcane Missiles** (three bolts ×0.6 at the nearest), **Mana Ward** (a ward that takes
the next 30% of your health in harm, 6 s), Focus (cooldowns −5%), Spell Power (skills +10%).

## 4. How the new skills work

- **A passive in data** (`SkillDef.passive`): a condition (`when`: night, wounded below a share, hale, standing,
  moving, a companion near or none, the own weapon held, the target's status, tag or health, a buff of one's own up)
  and what it pays (`damage`, `crit`, `critDamage`, `dodge`, `taken`, `moveHaste`, `attackHaste`, `drain`, `cdr`,
  `skillDamage`); `party` shares it (a passive, or a buff while it lasts) with those who follow one within 6 cells. The classes module reads them where it reads the talents (combat.ts), so most passives need no code
  of their own; the few that answer an event (a felling, a block, a dodge) are talents in combat.ts as before.
- **A buff in data** (the active kind `buff`, `ActiveDef.buff`): the same payments for so many ticks after the cast,
  at a cost in health if it asks one (Blood Rage) — Gale Step, War Cry, Iron Guard and Hawk Eye are this already, by
  their own kinds.
- **New active kinds** (engine `ActiveDef.kind`, the classes module's actives.ts): `buff`; `field` (lays a hazard of
  the game's — embers, briars, a cloud, holy ground — on a pattern: a line ahead, a square, a ring, a cell), and a trap
  is a field on one cell; `detonate` (each foe within reach in a status: a blow ×power, the status ended); `leap` (to
  a cell, a blow on the 3×3 there); `summon` (a creature of the game's that fights for the caster a while: its
  `companion` the caster, a faction its own); `command` (the caster's hound strikes the foe ahead); `mark` (the nearest
  foe takes more from the caster a while); `taunt`; `ward` (an absorbing ward); `rest` (other skills' rest cut). A
  `summon` or a `field` with a `power` and a `radius` strikes round the caster as it is cast. `whirlwind` takes a
  `count`; `shot` and `pierce` a `sure` critical. (A `dash-strike`, the Bladedancer's, went with it.)
- **The game's hazards** (content): the briars and embers already left by the White Knight and the dragon; new the
  miasma (poisons), the snare (holds), the spikes (bleed, mire), the blast trap (bursts with fire), holy ground (mends
  who stands in it of the caster's side), the binding sigil (hexes: the status `hexed`, attack −2, defence −3, slower)
  — each with its own rule.
- **Icons**: each new skill its own 64×64, drawn by code in the look of the others (tools/src/art/skill-paths-*.ts).

## 5. As built (2026-11-01)

Engine: `SkillDef.path`, `.tier`, `.passive` (`SkillPassive`), the new `ActiveDef` kinds and fields, `LearnRefusal`
'path' and 'tier' (`progression.ts`, a book's words too), the spawn effect's own `props` (the game's script only: the
validator refuses it in a patch). The classes module: `profession.ts` (`ADVANCE_LEVELS`, `ADVANCE_POINTS`, `PathDef`,
`cannotAdvance`, `advance`; a change of profession clears the path), `combat.ts` (`bindSkills`, `paid`: the passives
and buffs in data; the coded talents by id; the ward, the cap, the front block and Retort, Living Legend), `actives.ts`
(the new kinds; the cast's id as `casting`; Ascendance from the last cast; a Corpse Burst on a defeat, read off where
the struck stood as the blow fell, `Strike.at`), `index.ts` (the learn act's `advance`, `advanceProfession`; Thorned
Mail, Frost Armour, Unbreakable Will in the struck one's own `wounded`; a blow's `ends`). Content: `advancement.ts` (the paths, masteries, skills, hazards and their rules, the
called beasts and the raised dead; the faction `ally`), `skills.ts` (the direction `profession`, which took the profession's own branch beside `path` and `mastery`, the
professions' `paths` and `mastery`; `branchesForProfession` and `skillsForProfession` take the path), `rules.ts`
(`body/stage` answers a `price`; a blow's `ends` passed to its strike), `afflictions.ts` (`hexed`). Runtime: the
trainer's panel's advancement section (each path's card names its third), the skill tree's path, the `promote` message. Demo: Sergeant Kell a trainer. Pictures: `tools/src/art/
skill-adv-*.ts` (the skills, paths, masteries and hubs), `hazards.ts` (what the skills lay). Proof:
`tools/test/advancement.test.ts`.
