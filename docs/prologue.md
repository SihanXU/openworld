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

- The player's `prologue` prop (the table above). `quest` stays 0 until the Ford, so the main
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
