# Prologue: down from the plateau

Status: agreed with the user 2026-10-02 (the plateau is the prologue; you walk down to the Ford,
and past the Ford the road leads to a town — Emberfall, as today). A new game starts on the
mountain; the main quest (docs/main-quest.md) is unchanged after it.

Craft learned from other games, not their content: an opening on high ground the player cannot
leave until they have what the world below needs; teaching by the shape of the place rather
than by text; a companion who points, never lectures; teleport stones that are attuned by
touch and used from the map.

## The three maps (north of the Ford, stacked)

| Map | Size | What it teaches | Gate to the next |
|---|---|---|---|
| **Cloudtop** (`summit`), snow, stone, pines, a ruined watch shelter | 40 × 30 | moving; F take; left click on yourself to eat; E on a waypoint stone (attune) and M (the map); C craft a stone axe; 1–0 hold; left click with the axe on a tree | the only way down is a narrow cut with a pine grown across it |
| **Pinewind Slope** (`slope`) | 40 × 30 | Space / left click fights (slimes on the switchbacks, and more breed); experience → a level → K the skill tree; a waypoint and a lit fire half way | none: the switchbacks lead on; the beats keep the order |
| **Mountain Foot** (`foot`) | 40 × 30 | the world learns: an old rune-cut seal stone nothing in the world defines; try anything on it; J the Threadbook; the last waypoint | the trail runs out of the map's south edge onto the Ford's north bank |

Each beat is taught by the place first (the pine blocks the cut, the slimes sit on the path),
the bird second (one short bubble), the objective third (the HUD's line). No beat locks the
player in: every gate is a state the world can reach in other ways (burn the pine, go round,
anything the world learns).

## The bird

Pip (`actor/companion/bird`, the pack's red parrot) wakes you and stays with you for the whole
game:

- **Follows** its leader (`props.companion` = the leader's id — data, not "the player"): it
  hops beside them, flies over what blocks people, follows them across maps, and is airborne:
  it never blocks a tile nor takes a blow.
- **Beats** (`WorldIndex.beats`): once-firing, non-blocking steps of the tutorial. Each has a
  condition (facts, the leader's props, skills, what they carry, the map, a region) and, when it
  first holds, sets props or facts (the prologue's stage) and lets the bird say one line in a
  bubble. Beats are content; the engine only evaluates them (`engine/src/companion.ts`).
- **E on the bird** repeats the line of the stage you are at (`@hint`).

## The map system

- **Waypoint statues** (`fixture/sacred/waypoint`, drawn as a statue that glows once woken): E attunes one (status `attuned`); the first one in view, Pip points out. From the world
  map, any attuned stone takes you to it (not during a scene or while the world is learning).
- **World map** (M): every visited map placed where it lies (offsets computed from the edge
  links when the world is built, `MapMeta.at`), painted from its terrain, the player's
  position, attuned stones to click and travel. Drag to pan, wheel to zoom (like the skill tree).
- **Minimap**: the current map, always on screen under the clock: terrain, the player, people,
  creatures, waypoint stones.

## Story state

- The player's `prologue` prop: 1 … 8 while on the mountain, 9 when done (the Ford's arrival
  scene follows on the Ford). `quest` stays 0 until the Ford, so the main quest's stages and
  tests are untouched.
- `PROLOGUE_OBJECTIVES` (content) are shown while `prologue` < 9.
- Facts: `visited.<map>` (set on entering a map), `world.experiments` (an undefined player
  interaction was tried — online or off, so the beat never depends on a modder).

| `prologue` | Objective | Beat that ends it |
|---|---|---|
| 1 | Follow Pip | leave the shelter (region) |
| 2 | Find something to eat | eat (hunger back up) |
| 3 | Touch the old stone | a waypoint attuned (then: M) |
| 4 | Make a stone axe (C) | an axe carried |
| 5 | Clear the way down | past the pine (region) |
| 6 | Fight your way down the slope | level 2 |
| 7 | Learn a skill (K) | a skill learned |
| 8 | Try something the world has never seen | `world.experiments` ≥ 1 |
| 9 | (done) Down to the Ford | — |

Status: **built** (2026-10-02). `content/src/prologue.ts` (objectives, beats, the meal rule),
`tools/src/demo/prologue.ts` (the maps), `engine/src/companion.ts`, `engine/src/waypoints.ts`,
`client/src/ui/worldmap.ts`. Whatever the player skips, reaching the Ford ends the prologue.
Invariants wait until their giver's map is loaded (the Ford's content is not in play while the
player is on the mountain).

## Tests

- `P1` in `tools/test/demo.test.ts`: the whole prologue, headless and offline (no modder),
  through the player's own inputs — every beat in order, Pip following across maps, the
  world map's offsets, travel to an attuned stone — ending on the Ford with the story begun.
- The Ford's own tests begin where the prologue ends (`prologue` = 10, on the Ford).
