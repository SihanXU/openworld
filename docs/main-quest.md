# Main quest: from the broken bridge to the dragon

> 2026-10-05: stages 0–2 are now **Chapter 1, the First Seal** ([chapter-1.md](chapter-1.md)): the bridge was
> taken by the White Knight, the road east is his kingdom, and Emberfall opens after he falls. The chapters
> below from Emberfall on are unchanged for now; the story's setting is [lore.md](lore.md).

Status: **built** (2026-10-02): all seven chapters are playable and each is proved by a demo
requirement (Q1–Q6 in `tools/test/demo.test.ts`). Still to do: a single headless run of the
whole quest in order, and play-testing the length (estimated 50–60 minutes). About an hour of play, in seven chapters, from mending
the Ford's footbridge to defeating the dragon in the mountain. It is built on what exists: the
Ford, the survival loop (bag, foraging, crafting, hunger, levels), the meadow and the forest.

## Principles

- **The goal of each chapter is a state, not a path** (as the Ford's crossing already is): the
  objective says what must be true (the far bank reached, the sword forged, the dragon down);
  any way the world allows, or learns, counts.
- **Story state is facts** (and, since 2026-10-09, the `dragon_road` quest that answers them, docs/quests.md), changed only by story rules and
  scenes; world patches may not touch them (design.md §5.8; `PROTECTED_FACTS`).
- **Behaviour is rules.** Turn-ins, rewards, boss phases and summons are story rules on
  `interaction`, `hit`, `defeat` and `expire`. An engine change only where no rule can do it
  (fire resistance, the dragon's composite sprite).
- **Every placed thing witnesses a requirement** (`tools/test/demo.test.ts`), and the whole
  quest is proved completable headless, through the player's own inputs.
- **Reuse before new**: the meadow and the forest yield the herbalist's ingredients; the
  survival loop makes the first tools and the planks.

## The chapters (quest stages)

| Stage (`quest`) | Chapter | Map | What the player does | Minutes |
|---|---|---|---|---|
| 1 | Mend the bridge | the Ford | The storm tore three planks out of the footbridge by the marsh. Take the Old Axe, fell a tree, split its logs into planks, lay three planks across the gap. (The ferry, the dead tree and the ice still work: the far bank is the goal.) | 8–10 |
| 2 | The road east | East Road | Follow the road past a burned farmstead (the dragon's claw marks, a burning haystack); two wolves and a boar. The road ends at Emberfall. | 5–7 |
| 3 | Emberfall | Emberfall | Mara the elder tells of the dragon of Cinder Peak, gives bread, and sets two tasks. | 3 |
| 4 | Arm for the dragon | Old Mine; meadow, forest | Garrick the smith: 5 iron ore and 3 coal (veins in the dark mine among bats, spiders and a skeleton; the richest iron lies past the cyclops) → **Dragonsbane** (power 12). Wren the herbalist: 3 fireweed (meadow) and 3 frostcap (forest) → two **fireproof draughts**. The objective counts what each has been given. | 20–25 |
| 5 | Cinder Pass | Cinder Pass | Climb past frost wolves, fire imps and a stone golem; a lit campfire half way. | 6–8 |
| 6 | The dragon | Dragon's Lair | The lair's mouth wakes it (700 HP, fire bolts at range 4, bites). Once below half it calls three whelps. Fireproof: fire does a quarter of its harm and cannot set you alight. | 5–8 |
| 7 | The end | | The victory scene and the ending card. | |

Balance, measured headless during development (a player who only stands beside it and strikes):
with the draught the dragon falls in about a minute of blows and the player collapses once;
without it, three and a half minutes and six collapses.

## Maps

| Map | Size | Links | Contents |
|---|---|---|---|
| the Ford | 48 × 30 | west: Firstlight Village; east: East Road | wider river, Hesper only; broken footbridge (a 3-tile gap at row 22) |
| Firstlight Village (`meadow`) | 40 × 30 | east: Ford; south: Forest | four homes, well, lit square, Tobin's cart, crops and supply crate; pasture and fireweed retained |
| East Road | 48 × 24 | west: Ford; east: Emberfall | road, burned farmstead, wolves, a boar |
| Emberfall | 40 × 30 | west: East Road; north: Old Mine; east: Cinder Pass (always open) | houses, smithy (anvil, lit forge), herbalist's hut and cauldron, the elder's house, well, hens |
| Old Mine | 40 × 30, dark | south: Emberfall | tunnels, ore and coal veins, torches; bats, spiders, skeletons; the cyclops |
| Cinder Pass | 30 × 40 | west: Emberfall; north: Lair | snow and scorched rock; frost wolves, imps, a golem; a campfire |
| Dragon's Lair | 30 × 24, dark | south: Cinder Pass | an arena of scorched stone and rock pillars |

## Monsters

| Creature | Where | Sprite (Ninja Adventure) | Notes |
|---|---|---|---|
| wolf, boar | East Road | Beast2, Bear (exist) | |
| bat, spider, skeleton | Old Mine | BlueBat, SpiderRed, Skeleton (exist or pack) | the mine respawns bats and spiders slowly |
| cyclops (mini-boss) | Old Mine | Boss/DemonCyclop | 60 HP; guards the deep veins; drops two iron ore |
| frost wolf, fire imp, stone golem | Cinder Pass | exist | |
| dragon whelp | Lair | Monster/Dragon | summoned by the dragon below half health |
| **the dragon** | Lair | Boss/DragonGreen (head, wings, body segments) | 700 HP; fire bolts at range 4, bites; whelps once below half; composed sprite |

## New engine and content pieces

- **Fire resistance**: status `fireproof` cuts fire damage to a quarter (engine `damage`) and
  wards off `burning` (a status may now ward others off: `StatusDef.wards`). A blow's damage is
  of the blow's element unless the rule says otherwise, so a fire bolt is fire harm.
- **Ranged creatures**: without a weapon, a creature's own `range` prop is its reach.
- **Rule-spawned creatures** get the behaviour their type names and appear on the nearest free
  tile (the whelps).
- **Turn-ins**: story rules on `put` to a person, counted in facts (`mq.ore` …), with a reward
  on a word (E) once the count is met (the smith forges, the herbalist brews). The HUD's objective
  shows the counts (`Objective.progress`, from the frame's facts).
- **Boss phases**: story rules on `hit` guarded by the dragon's hp and a fact (summon once).
- **Dragon sprite**: the renderer composes head, wings and a trail of body segments.
- **Ending**: a scene on the dragon's `defeat` plays the ending card; the Threadbook remains.

## Tests

- One demo requirement per chapter, checked on the real maps through the player's inputs.
- **The whole quest, headless**: a test that walks the stages in order with scripted inputs
  (fell, split, lay planks; travel; mine; turn in; brew; fight) and ends with `quest` = 8.
- Every new placed thing witnesses one of these (the minimality test).

## Order of work

1. Chapter 1: the footbridge, the objectives for every stage, the far bank no longer ends the game.
2. Groundwork: fireproof, turn-in pattern, map links east.
3. East Road. 4. Emberfall and its people. 5. The Old Mine and the smith. 6. Fire and frost.
7. Cinder Pass. 8. The Lair and the dragon. 9. The headless playthrough, balance to ~1 hour, PR.
