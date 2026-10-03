# Quests, the village's people, and the night

Status: **built** (2026-10-03). Requested by the user: a main quest inside the village before
the bridge chapter (rescue people from new maps below the village), quest givers marked with a
yellow "!", E to take a quest on, a quest log button bottom right that tells main, side and
repeatable quests apart, peaceful and combat zones with zombies and bats at night, more people
in the village, and three side quests of our own design.

## The quest system (`engine/src/quests.ts`)

- Quests are content (`QuestDef`, `content/src/village.ts`, loaded from `WorldIndex.quests`):
  kind (`main` / `side` / `repeat`), giver, optional turn-in, requirements (facts, other quests,
  level), the giver's lines (offer, waiting, done), goals and a reward (xp, items, facts, props).
- Goals: **defeat** creatures of a type (optionally on one map), **carry** things (taken on
  hand-in when `consume`), **talk** to someone (they say a line), a **fact** reaching a value.
- State lives in world facts: `q.<id>` = active / done, `q.<id>.<goal>` counts, `q.<id>.day`
  for a repeatable quest (it comes back the next day).
- E on a person runs the `quest` effect (the `core/talk` rule): hand in what is ready, else take
  on what is offered, else meet a talk goal, else the giver's "waiting" line, else their usual
  line. Defeats count in `Engine.dispatch` before rules remove the felled.
- The frame carries `quests.marks` (yellow **!** a quest to give, **?** one to hand in, drawn
  over the person's head) and `quests.log` (the quest log, L or the 📜 button, grouped main /
  side / repeatable, with goal counts; the button's badge counts quests under way, red when
  one can be handed in).

## The story's order

The Ford's arrival now ends with Hesper sending you to Firstlight Village first
(`village.sent`); the objective (quest 0) is "Help Firstlight Village". Rowan's main quest,
when handed in, sets `quest` = 1: the bridge chapter (docs/main-quest.md) follows unchanged.

## The maps below the village

Village → the Grassland (cows and hens) → the Forest → **Thornwood Hollow** (`hollow`: slimes,
spiders, wolves, thorns; Mia's ring) → **the Old Barrow** (`barrow`, dark: skeletons, a bat, the
barrow warden; Lina and Oskar in the side cells). `tools/src/demo/hollow.ts`.

## The village's people and quests

| Person | Quest | Kind | Asks | Pays |
| --- | --- | --- | --- | --- |
| Rowan, the elder | Lost in the Barrow | main | find Lina and Oskar in the barrow (talk), fell the warden | 60 xp, 2 bread; the foragers go home (their schedules follow `rescue.*`); the bridge chapter opens |
| Marta, the cook | Something for the Pot | side | 3 raw beef, 2 eggs (taken) | 25 xp, 3 bread |
| Mia, her daughter | Mia's Ring | side | the silver ring lost in the hollow's eastern thorns (taken) | 30 xp, her lucky stone |
| Holt, the guard | Clear the Hollow | side (level 2) | fell 6 creatures in the hollow | 40 xp, a spear |
| Gus, the woodcutter | Wood for the Fire | repeat (daily) | 4 logs (taken) | 15 xp, bread |

Lina and Oskar wait in the barrow until found, then live in the village. Bram, the profession
trainer (docs/skill-tree.md), and Tobin, the peddler, are there too.

## Peaceful and combat zones (`engine/src/nightspawn.ts`)

Every map is a combat zone unless marked peaceful (`MapData.zone`): the Ford's camp, Firstlight
Village, Emberfall and the mountaintop are peaceful. At night (21:00–05:00), in a combat zone
under the open sky, zombies and bats come out 6–10 tiles from the player, every 6 seconds, up to
4 at a time; at dawn they crumble one by one. The minimap shows the zone.

## Tests

`tools/test/demo.test.ts`: **P3** (the main quest, through the real maps and the player's
inputs: the marks, taking it on, walking to the barrow, the talk goals, the warden, handing in,
the bridge chapter opening) and **P4** (the three side quests and the daily one, and the night:
spawns in the grassland within the cap, none in the village, gone at dawn); F9 and P1 follow the
new order.
