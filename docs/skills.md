# Monster skills: one system

Status (2026-10-15): **built.** The minor monsters' skills (docs/creatures.md, Bao Zhuhan) and the bosses' (docs/bosses.md)
were two systems, written by two people: two skill types, two ways of working out the cells, two primitives that landed
a skill, two telegraph paths, and a status rule both had to edit. They are one now. This document is the shared part:
what a skill is, how each kind of monster takes skills up, the archetypes both draw from, and the contract both keep.
The player's own active skills (docs/skill-tree.md) are a separate system and stay so.

## 1. A skill: data aims it, a rule lands it

The event model holds (design.md §5.4–5.15). A skill's **data** says where it aims, how long it winds up on the cells it
marks, how its caster moves, and when it may be taken up. **What lands** is the caster's own rule: the wind-up ends in an
act, `use` with the caster's own body on the aimed cell and the param `kit` (the skill's id), and the caster's rule
answers it, normally with the one primitive `unleash`.

`KitSkill` (engine `types.ts`), in `Ontology.kits` by type (a kind's kit is the nearest its type or an ancestor names):

| Group | Fields |
|---|---|
| Cells | `shape` (circle, ring, line, cone, cross, spots), `aim` (self, target), `radius`, `width` (a line's), `spot` (each spot's radius), `occlude` (cells the caster cannot see from where it winds up — behind a rock, a wall — and cells nothing can stand on are spared) |
| Timing | `windup`, `recovery`, `cooldown`, `steady` (held, stunned or frozen, the wind-up waits instead of being lost), `then` (another skill of the kit, wound up as soon as this one lands, aimed afresh: a second arrow, a second wave) |
| When | `range` [near, far], `aligned` (a row or a column), `below` (a share of its health), `spent` (a prop that, once the caster has it, keeps it from the skill: one used once), `chance` |
| Moving | `move` (leap, dash, blink), `back` (springs back after the blow); a dash that meets only a wall stuns the dasher |
| Looks | `color` (the marks), `action` (a boss's pose: attack, cast), `clip` (a drawn clip of its own), `fx`, `fxPlacement` |

`unleash {power, element, edge, coat, push, pull, heal, leave, leaveStatus}`: the caster moves as the skill says (it
writes only itself), each foe on the marked cells is struck, coated, pushed or pulled — impulses it answers for itself —
the caster mends `heal` for each foe hit, and a `leave` thing is made on each marked cell no body stands on, holding
`leaveStatus` from the start. One hit per foe however many of its cells the skill covers. `power` is always a multiple
of the act's power, `{param: 'power', mul}`: the caster's attack, scaled by a boss's phase. So a softer boss for an early
chapter is simply a lower attack.

What a skill leaves (the White Knight's briars, the dragon's embers) acts by its own rules: contact, its stage running out.

## 2. Two behaviours take skills up (the "inheritance")

```
KitSkill — pattern.ts (the cells), cast.ts (a wind-up and its release), unleash.ts, Frame.telegraphs, afflictions.ts
   ├─ a minor monster — the kit goal (kit.ts), before threat: once a second, the first skill whose conditions hold;
   │                    none: it fights on as before. Held, stunned or frozen in the wind-up, it loses the skill.
   └─ a boss — the encounter goal (encounter.ts), for a type in Ontology.encounters: each phase (by its health, never
                going back) takes its rotation's skills up in turn; as a phase begins, its opening skill (once, steady);
                between the rotation's steps, an answering skill whose conditions hold (taken up as a minor monster's,
                by the same function: it does not move the rotation on). It walks to its foe, keeps to its arena.
```

`EncounterDef`: `sight`, `leash` (default: its own `ai`), `plate {color, seal?}`, `phases: [{at, rotation, enter?,
windupMul?, recoveryMul?, powerMul?}]`, `reactive`, `floors {windup, recovery}` (default 8 and 6 ticks: how far a phase may shorten a time; one written shorter stays as
written). Its body is its
type's (health, footprint). A type with an encounter is fought as a boss: the plate, the camera, the music.

A large body (the dragon's 2x2, the knight's 3x2) strikes from its edge: a line, a cone or a dash is wound up from the
cell of its body nearest the foe (`originOf`, `edgeOf` in pattern.ts), and its range and row are measured from there; a
dash stops at the first foe its leading edge meets. A disk, a ring, a cross or spots round itself keep to where it
stands (its anchor), and so does their range. One cell: the same cell either way.

A wind-up is behaviour memory in the module (`World.ext('kits')`), never the world's state: a save taken mid wind-up
loses only the wind-up (docs/creatures.md §4). A boss's place in its fight (phase, rotation step) is its saved memory,
`Entity.boss`; what a wind-up under way was taken up as (`winding`: a phase's opening or a rotation's step) is saved
with it, and a director that finds it without a wind-up gives the opening or the step back: a save never skips the
dragon's brood or the knight's hedge. Let go, or lost to a hold, the opening or the step is spent.

## 3. Archetypes: one move, two scales

Both kits draw from one table. A new archetype is an engine change, reviewed by both owners.

| Archetype | Minor monsters | Bosses |
|---|---|---|
| Leap | slime's Hop | — |
| Dash | wolf's Lunge, boar's Charge, bat's Swoop | the dragon's Searing Dive |
| Line | skeleton's Bone Toss (1 wide) | the White Knight's Arrow of Conquest (3 wide), None Cross Unkneeling |
| Lob (3×3) | imp's Fireball, spider's Web Spit | the dragon's Threefold Fire |
| Spots | — | the White Knight's White-Feather Volley, the dragon's Ashfall |
| Disk round itself | golem's Ground Slam, ghost's Wail | the dragon's Tail Sweep |
| Ring | — | the White Knight's Thorns, the Second Ring, Hold. |
| Cone | whelp's Ember Breath (3) | the dragon's Cinder Breath (5, the pillars shelter), the White Knight's Hilt Rebuff |
| Cross | wisp's Discharge, zombie's Grasp | — |
| Call | wolf's Howl | the dragon's Call the Brood |
| Guard | crab's Shell Up | — |
| Leave | (a web, later) | the White Knight's briars, the dragon's embers |

## 4. The contract (games/openworld/tools/test/kit-contract.test.ts)

| | Minor monster | Boss |
|---|---|---|
| Wind-up, a skill that marks cells | ≥ 0.6 s | ≥ 1.0 s; ≥ 0.6 s for the next of a chain and for an answering skill; never under 0.8 s however a phase scales it |
| Blow (`power` multiple of its attack) | ×0.8–2.0 | ×0.6–2.0 each |
| Holding a body (immobilize) | ≤ 1.5 s, then `steadied` | the same |
| Skills | 1–2 a kind; an elite of the minor monsters (the warden, the cyclops, the Slime King) 2–4, a chain and a guard allowed, wind-ups ≥ 0.8 s (≥ 0.6 s for the next of a chain), never a director (docs/creatures.md §10) | a rotation of 3–5 a phase, 0–2 answering, one opening skill a phase |
| Interrupted | held, stunned or frozen: lost | rotation and answering skills: lost; opening skills are steady (the wind-up waits) |

- **No hold follows a hold.** A body coated with a hold (entranced, knelt, stunned) is `steadied` for 4.5 s after: those
  holds do not take. (`body/afflict`, content `afflictions.ts`.)
- Every skill names its counterplay: step off the marks, interrupt it, stand behind something hard, go round.
- Every skill of every kind is answered by that kind's own rule; every coat is in `AFFLICTIONS`; every `then` is a skill
  of the same kit, never a circle; every phase names skills of its kit; every effect is in `onto.vfx`.
- Rules are `kit/<family>` (minor monsters) and `boss/<id>` (bosses), all base rules; rewards and defeats stay story rules.

**Who owns what.** `content/src/kits.ts`: the minor monsters (Bao Zhuhan). `content/src/bosses.ts`: the bosses (the boss
designer). `content/src/afflictions.ts`: shared, add-only — the helpers (`skill`, `kitRule`, `unleash`, `POWER`), the
marks' colours (harm red, cling purple, call amber), what clings, `body/afflict`. `packages/modules/src/kits/` and the
engine types: shared, changed with both owners' review. In a project in the format, `kits` and `encounters` are merged by
key across ontology files (`packages/format/src/compile.ts`), so each designer keeps a file of their own.

## 5. Adding a skill

- **A minor monster's**: a `skill(...)` in `KITS` under its type (with a `range`), and its answer in that kind's
  `kitRule('kit/<family>', …)`. The kit goal takes it up by itself.
- **A boss's**: a `skill(...)` in its kit, its id in a phase's `rotation` (or as `enter`, or in `reactive` with a `range`),
  and its answer in `kitRule('boss/<id>', …)`. The Boss Studio's buttons show it at once.
- A stronger variant for a later place is a subtype with its own kit (a kit is the nearest the type or an ancestor names).

## 6. The two bosses redesigned (2026-10-15)

**The White Knight Alberic** (docs/chapter-1.md §4): the crown wore his self away until all he remembers is to *hold*;
none cross that do not kneel. Two phases, all on his drawn rows (arrow, volley, the plunged sword, the kneel and the
offered crown). Phase I: Arrow of Conquest → White-Feather Volley → Thorns Bend the Knee → Arrow → None Cross Unkneeling
(a line of briars from him toward his foe: those on it kneel; the briars stay twelve seconds, no wall but none cross them
without kneeling; cut them, burn them, go round). Hilt Rebuff answers one who stands too close. At half health he plants
the sword: *Hold.* — a hedge closes round him six cells out (steady). Phase II: two arrows (the second aimed afresh), the
volley, the briars, the thorns in then out; wind-ups ×0.85, recoveries ×0.7, blows ×1.25. Chapter 1: 300 health, attack
10; the Boss Studio and the challenge: 1200, 24.

**The dragon of Cinder Peak** (docs/main-quest.md): a boss fight now, three phases, two cells wide. Phase I: Cinder Breath
(a cone the lair's rock pillars shelter from, leaving embers that burn those who step in) → Threefold Fire (three bolts,
each where its foe stands then); Tail Sweep and Bite answer those beside it and before it. At half: Call the Brood (its
three whelps, once in a world: the main quest's `mq.whelps`); phase II adds the Searing Dive (a dash down a three-wide row
leaving embers; one that meets only a rock stuns it — bait it into a pillar). At a quarter: Ashfall, two waves; phase III
faster and harder, its breath twice. 700 health and attack 7 in the lair; 1600 and 22 in the challenge.

Checks: `boss-fights.test.ts` (the redesigned fights), `bosses.test.ts` (every boss skill lands on its marked cells as its
rule says; the three kept for later exactly as before), `boss-balance.test.ts` (every profession loses ignoring the
warnings; a dodging warrior wins), `kits.test.ts` (the minor monsters), `kit-contract.test.ts` (§4).
