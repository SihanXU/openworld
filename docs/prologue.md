# Prologue: the clearing, then down from the mountain

Status: the tutorial agreed with the user 2026-10-04 (after Elin's opening: one comes round out
cold, eats, gathers, makes, builds a house and gets through a night; the world beyond opens only
afterwards). The first version of the prologue (2026-10-02: Cloudtop and Pinewind Slope, down to
the Ford) was replaced by it; the Mountain Foot and the way down to the Ford stay. The main
quest (docs/main-quest.md) is unchanged after it.

Craft learned from other games, not their content: an opening the player cannot leave until they
can live in the world (Elin's start site, Minecraft's first night); teaching by the shape of the
place rather than by text; a companion who points, never lectures (Elin's Nerun, Valheim's Hugin);
teleport stones that are attuned by touch and used from the map.

## The tutorial, apart from the story


- **A new game** begins on **Cloudtop** (云顶台地, the map `summit`, restored 2026-10-06), in its
  ruined watch shelter (`PAT.spawn`, the world's start, `prologue` = `PROLOGUE_AT_FOOT`), straight into
  the story. Pip's first line (`summit_wake`) names the place and points to the cut in the south
  rim, Cloudtop's only way down; the trail comes out on the Mountain Foot's north edge. Cloudtop
  is peaceful, with berries, sticks, stones and grass before the shelter and a waypoint statue
  (`wp.summit`). Pip's "the world answers" beat waits until the seal stone was seen (`after: 'relic'`).
- **The tutorial is its own** (the title screen's *Tutorial* button): it begins in the Clearing, out cold,
  writes no save slot, and walking out of the Clearing ends it and returns to the title.
- (Before 2026-10-06: the tutorial was the default start.)

The world's starts are data. `WorldIndex.start` (+ `begin`: its hour, props and statuses) is the
game without the tutorial, at the foot; `WorldIndex.starts.tutorial` is the clearing (07:00, the
status `out_cold` for five seconds); `Game.create(index, …, start)` takes a start's name.

## The Clearing (`tutorial`, 36 × 26)

A clearing ringed by forest: a grove of trees on its east side, berries, sticks, stones and grass
lying about (and turning up again: the ground's yield and the clearing's own berries). It is a
combat zone: after dark the dead walk it. It lies on no cell of the overworld and nothing leads
back into it: a scene played once. Its one way out is the path south: two portals on the south
edge to the top of the foot's trail, which wait on the story's fact `TUTORIAL_OPEN`
(`Portal.opensWhen`: until then the tiles are only ground, and walking there too soon, Pip says not
yet).

| `prologue` | Objective | The step that ends it (state, not path) |
|---|---|---|
| 0 | (out cold) | `tut_wake`: one comes round (`out_cold` gone) |
| 1 | Find something to eat | `tut_ate`: a meal (`prologue.meals` ≥ 1) |
| 2 | Gather sticks, stones and grass | `tut_gathered`: carrying each of the three |
| 3 | Make a stone axe | `tut_axe`: carrying an axe |
| 4 | Fell a tree and split planks | `tut_planks`: carrying a plank |
| 5 | Build a campfire and light it | `tut_fire`: a lit campfire within 12 tiles |
| 6 | Build a house with a bed | `tut_house`: a room that is a bedroom on the map |
| 7 | Get through the night | `tut_morning`: the first morning (05:00) after `tut_house`: `TUTORIAL_OPEN` |
| 8 (`TUTORIAL_DONE`) | Take the path south | `tut_out`: on the foot |
| 9 (`PROLOGUE_AT_FOOT`) | Try something the world has never seen | `tried`: `world.experiments` ≥ 1 |
| 10 | Down to the Ford | `ford`: on the Ford |
| 11 (`PROLOGUE_DONE`) | — the main quest | |

The way out opens on the first morning after the house stands, not at the first dawn: a player
who does nothing is not let out the next day. What the steps need, and where:

- Coming round: `StartDef.statuses` (`out_cold`, immobilizing, drawn lying).
- Food: berries (food 2 each). Hunger falls in two paces (hunger.ts): fed, a point every 48 game
  minutes, full to six tenths between meals; under six tenths one is hungry and it falls a point
  every six hours (full to empty in about three days); asleep, four times slower. A starving
  sleeper wakes in the night, so Pip says to eat one's fill before sleeping.
- Making: the stone axe, the torch (a stick and grass), walls, a door, a floor and a bed (planks;
  the bed also grass), all by hand (C); the campfire from the building panel (B) or by putting
  stones and sticks together; an axe on a log splits it into planks.
- The house: walls and a door round oneself, the bed at one's feet, a floor laid over (it rests
  on the walls: the cover). A door, shut or open, is a room's edge; shut it stops what walks.
- The night: the world's night walkers (zombies and bats, combat zones out of doors, 21–5). Shut
  in, they cannot reach one; looking for a way to someone shut in, a creature waits three
  seconds between searches (`AiData.noWay`).

## The lessons (the drills, 2026-10-07)

The tutorial teaches by the deed, not by text (after the user: "强迫玩家做什么 action"). Craft taken,
not content:
- **Minecraft's tutorial hints**: one key at a time, gone when it is done.
- **Celeste and Hollow Knight**: the key drawn at the thing.
- **The first battles of Pokémon and Fire Emblem**: only the taught command works.
- **Mobile tutorials**: the spotlight, with the rest of the screen dimmed.
- **Zelda's Great Plateau**: the ground learned before one is let out.
- **Hades' training dummy**: blows practised on a target that cannot strike back.

Each stage of the table above holds its lessons in order (`TUTORIAL_LESSONS` in `content/src/prologue.ts`,
on the stage's objective; the engine's `Lesson`).

**A lesson:**
- **One short line.** Pip says it as the lesson begins, after any beat's line has been read.
- **A focus**, resolved by the view each frame:
  - the nearest thing of a type;
  - the nearest cell of a terrain, nearest to a spot (the grove, not the forest's rim);
  - the player, or a spot;
  - an outline of cells, drawn on the ground (`WorldScene.setLessonCells`);
  - a panel's part: the bag and build buttons, a recipe row (scrolled into view), a palette entry, a toolbar slot.
- **The key** to press, drawn over the focus.
- **Optionally a lock**: only the inputs it teaches work, the screen dims round the focus, and a refused
  key shakes. `only` and `cells` narrow making and setting down: only the axe, and only walls on the outline.
- **Done** when a state holds: the story's conditions, plus `holding`, `spot`, `on` (things on cells)
  and `near.exact`.

The lesson at hand is the first of the stage's the story has not marked done (`lesson.<id>`). It is
`Story.lesson()`, and the frame's `lesson` (`LessonView`).

**The locks.** The engine holds the locks for the world's inputs (`Controls.allows`, consulted by
moving, the five keys, the toolbar, making, setting down, and the palette's placements in the worker).
The view holds them for its own panels (the bag, crafting, the build palette, the map). Opening a panel
or choosing from the chooser is told to the story (`ui` → `ui.<what>`), so a lesson can wait on it.

**Never stuck.**
- A lock never keeps one from what the lesson itself needs: the campfire lesson lets one gather, and the
  wall lesson lets one cut wood.
- Esc held two seconds skips the lesson at hand (`Story.skipLesson`); a short press still opens the menu.
- The tutorial itself can be skipped at a new game.

| Stage | Lessons (locked ones marked *) |
|---|---|
| 1 | walk to the spot (WASD)*, F the berries*, their slot in hand*, right click eats* |
| 2 | I opens the bag*, a stick, a stone, grass (F) |
| 3 | C, the stone axe (only it can be made)* |
| 4 | the axe in hand*, a tree in the grove (left click)*, C splits the logs into planks (only planks)* |
| 5 | B, the campfire (only it; gathering allowed)*, C a torch, the fire lit (left click) |
| 6 | B, the first wall on the outline*, a door, a bed, the ceiling (R on the floor) |
| 7 | hold E on the bed (the chooser), the training dummy knocked down (left click)*, the door shut (E), sleep (E) |
| 8 | M, the world map |

**The training dummy** (`fixture/dummy`, 12 health, beside the house) is knocked down and rocks upright
again (`train/dummy`). The story counts it (`tutorial.dummy`).

**Tests:**
- `T1` walks every lesson through the inputs, and checks that the locks refuse what they lock.
- `T3`: skipping a lesson, and the view of the one at hand.

## The Mountain Foot (`foot`, 40 × 30)

The game proper begins here. The trail comes down off high ground two levels up (its face of
rock; a ramp where the trail runs, W8), passes a hunter's old wooden hut (W13) and levels out at
an old rune-cut seal stone in a ring of flowers that nothing in the world defines: try anything
on it — the world learns (J: the Threadbook). A waypoint statue stands below it; the trail runs out
of the map's south edge onto the top of the Ford's cliff.

## The fairy

Pip (`actor/companion/fairy`: a small winged girl, a fairy, in the project's own art —
`tools/src/art/fairy.ts`, a four-frame wingbeat and a portrait; until 2026-10-05 she was the
pack's red parrot, and `content/src/migrateCompanion.ts` turns an older save's bird into her) wakes you and stays with you for the whole
game:

- **Follows** its leader (`props.companion` = the leader's id — data, not "the player"): it
  hops beside them, flies over what blocks people, follows them across maps, and is airborne:
  it never blocks a tile, and blows along the facing pass under it (a blow aimed at it lands).
  Following is its behaviour: each hop is an act of moving. Struck down (it is `essential`: it
  goes down, it is not gone) it cannot follow, and says so: a `stuck` event (activity
  `follow`, target its leader) at most once an hour, whose outcome is undefined — the AI says
  what becomes of a guide that cannot guide; with no answer it waits, comes to, and follows again.
- **Beats**: once-firing, non-blocking steps of the story's one script (`WorldIndex.steps`,
  world-model.md §6.12). Each has a trigger (`StepCond`: facts, the leader's props and statuses,
  skills, what they carry, the map, a region — looked at when the leader enters it —, a thing
  near with a status, a room with a role, the first morning after another step) and, when it
  first holds, it plays: the story keeps it (`seen.<id>`, `step.last`) and its facts, tells the
  leader its new stage (`notify` what = `prologue`, which the leader keeps itself: `body/stage`),
  and the fairy says one line in a bubble. Beats are content; the engine only evaluates them
  (`engine/src/story.ts`).
- **E on the fairy** repeats the line of the stage you are at (`@hint`).

## The map system

- **Waypoint statues** (`fixture/sacred/waypoint`, drawn as a statue that glows once woken): E
  attunes one (status `attuned`); the first one in view, Pip points out. From the world map, any
  attuned stone takes you to it (not during a scene or while the world is learning).
- **World map** (M): every visited map placed where it lies (offsets computed from the edge
  links when the world is built, `MapMeta.at`), painted from its terrain, the player's
  position, attuned stones to click and travel. Drag to pan, wheel to zoom (like the skill tree).
- **Minimap**: the current map, always on screen under the clock: terrain, the player, people,
  creatures, waypoint stones.

## Story state

- (Since 2026-10-09 the stages are the quests `awakening` — the table's 1 … 8 as its stages 10 … 80, the lessons on them — and `descent`, docs/quests.md.) As first built: the player's `prologue` prop (the table above). `quest` stayed 0 until the Ford, so the main
  quest's stages and tests are untouched. `PROLOGUE_OBJECTIVES` (content) are shown while
  `prologue` < `PROLOGUE_DONE`.
- The traveller's own record: `visited.<map>` props (set on entering a map; the world map shows
  the player's).
- `world.experiments`: the story's count of acts the world had no answer for, as a companion saw
  them (its `seen` rule, `companion/witness`: an act whose chain reached an undefined outcome is
  seen with `defined` false) — online or off, so the beat never depends on a modder.

Built: `content/src/prologue.ts` (objectives, beats, the meal rule), `tools/src/demo/prologue.ts`
(the clearing and the foot), `engine/src/companion.ts`, `engine/src/story.ts`,
`engine/src/waypoints.ts`, `client/src/ui/worldmap.ts`. Whatever the player skips, reaching the
Ford ends the prologue. Invariants wait until their giver's map is loaded.

Cloudtop (`summit`) and Pinewind Slope (`slope`) were deleted (2026-10-04). Their requirements
moved: the high ground and its ramp (W8) and a wooden hut (W13) to the foot, rock to the hollow
and the pass (W2–W4); the slimes are witnessed in the hollow (P4).

## Tests

- `T1` in `tools/test/demo.test.ts`: the whole tutorial, headless and offline, through the
  player's own inputs — come round, eat, gather, craft, fell three trees and split their logs,
  light the fire, build the house round oneself, hold the dead off behind the door for an hour,
  sleep, and walk out to the foot; the way out shut before, nothing leading back after.
- `T2`: without the tutorial, the game begins at the foot.
- `P1`: from the foot to the Ford — the waypoint, the seal stone, the Ford's story begun, the
  world map's offsets, travel to the attuned stone.
- The Ford's own tests begin where the prologue ends (`prologue` = `PROLOGUE_DONE`, on the Ford).
