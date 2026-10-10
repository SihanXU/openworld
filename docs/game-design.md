# OpenWorld — game design

OpenWorld is the world; *Large Symbolic World* is the method and the paper. The playable demo is
**the Ford** (渡口) and the maps growing around it (the meadow, §4b; the forest, §4c): the
development scaffold of a world meant to reach hundreds of maps. Every element it holds
witnesses a requirement (§9 proves it). This document is the design bible for the demo: what
it is, why it is built that way, and why nothing in it is idle.

## 1. What the demo is, and what it is not

The first demo, Hearthvale, copied Stardew Valley's game: a newcomer inherits a farm in a
valley village, twelve villagers with heart levels and gift tastes, letters, a weekly
gathering, a long project that repairs the town, a calendar of weekdays and seasons, energy.
That was a mistake. What we wanted from Stardew and its peers was their **craft** — places that
teach, people with lives, a world that reacts, a warm feel — not their content.

The Ford's game comes from our own premise: *the world is code, and what it has never seen, it
learns.* So the game is about trying things, and the world answering:

- **One goal, stated as a state.** Get to the far bank. Any rule that carries the player there
  counts — the ones the place teaches, and the ones the world learns from the player (a raft
  from the bucket, a ride on a slime). The modder's patches are gameplay, not decoration.
- **A world that acts alone.** A storm comes in the evening; slimes come out of the hollow at
  night; the two people keep their own days. Their collisions with what the rules do not cover
  are the world's own undefined events.
- **Short and finished.** 20–40 minutes, an ending, and a sandbox after it.

## 2. Pillars

1. **The goal is a state, not a path.** The ending plays when the player stands on the far
   bank (a map region), however they got there. Content that the story relies on is guarded by
   invariants, so no state the player or the world reaches can soft-lock it (§7).
2. **The place teaches, not text.** Every way across is shown before it is needed: the river's
   edge is frozen where the frost slime sits; the dead tree stands alone at the narrows, rock on
   either side, water beyond; the snapped rope trails from the winch; the bucket waits by the
   water and the torch by the fire. People speak of their lives, not of mechanics.
3. **A world that existed before you.** Hesper has kept this crossing for thirty-one years; her
   husband built the winch and drowned the spring after. Tobin owes her last autumn's fare. They
   have days of their own, and they notice what you do with their things.
4. **Uniform systems over special cases.** Fire, water, ice, lightning and oil are statuses and
   elements in one rule library; the routes across are ordinary rules on ordinary types. The
   modder patches into the same physics.
5. **Legible.** Every input shows what it will do before it is pressed, and marks what the
   world has never seen (`?`). Every thread the world learns enters the Threadbook, with whose
   act taught it.
6. **Feel.** Things pop, flare, splash and shake; a warm, framed UI; music and sound from the
   Ninja Adventure pack.

## 3. Time and weather

| | The Ford |
|---|---|
| Clock | Days and nights only: no weekdays, no seasons. A game minute is a real second (a day is 24 minutes). The game begins on day 1 at 13:00. |
| Night | 21:00–05:00. People sleep. The frost slime (nocturnal) comes out of the hollow and attacks folk — the player and the people alike — but never comes near a lit fire; the fire slime (wary) roams too and fights only if struck. |
| Weather | Fixed for the first two days (cloud, an evening storm 17–20, rain, then fog and sun), drawn from the seed after. Rain wets everyone outdoors and douses fires; the storm's lightning seeks what stands tall (the dead tree). |
| Health | The only bar. At none, anyone essential (you, Hesper, Tobin) collapses for 30 seconds and comes to with half their health; the story stays intact. There is no energy. |

## 4. The map (40 × 30)

```
     0         10        20         27  32  39
 0   ▓▓▓▓▓▓▓▓▓ mossy cliff ▓▓▓▓▓▓▓▓▓ ♣♣ ≈≈≈≈≈ ♣♣♣♣
 4   ♣ ⌂hollow  boulders      ❄rime ❄ ≈≈≈≈ ♣♣    (frost slime by day; the river's edge frozen)
 7   ♣  ‴‴ dry meadow ‴‴   ♣♣         ≈≈≈≈
10   ♣  hay      trail ↗           ♠ ≈≈≈    dead tree on a spit, rock either side: the narrows
13   ♣♣    tent▲ chest  rack  cart    ≈≈≈≈≈   ♣
16   ═road═  stump  🔥fire    Tobin ┃═≈≈≈═┃═══ road east → (signpost)   winch, boat, two piers
19   ═══════════════bench═══════╝   ≈≈≈≈≈≈≈
22   ♣♣        lantern   ◯pond ◯pond ≈≈≈≈≈≈   ♣♣♣  the marsh: ponds among tall grass
26   ♣♣♣♣♣♣ woods ♣♣♣♣♣♣♣♣♣♣♣♣♣♣♣  ≈≈≈≈≈   ♣♣♣
```

Composed, not scattered. The rules it follows:

- **One landmark you see from the camp**: the dead tree standing alone on its spit at the
  narrows, and below it the landing with the boat. The trail from the camp leads to both.
- **The river has a shape that says something**: it comes down from under the cliff, narrows to
  three tiles where the tree could bridge it, widens into a still pool where a ferry makes
  sense, and bends away. Its banks are the pack's grass-bank water, never square patches.
- **The camp is a clearing** ringed by woods: tent, chest, a stone-ring fire with a log bench
  and a cooking rack, a stump with the axe beside the woodpile, a lantern where the road comes in.
- **Every danger is placed where it teaches**: the hollow is a mossy cave mound at the cliff's
  foot, trodden earth and bones before it; the frost slime's corner is white with rime and the
  river's edge beside it is ice; dry tall grass lies between the hollow and the hay; the marsh's
  ponds are where lightning has water to run through.
- **Detail by masks, never by noise**: tall grass and flowers sit off the grid; reeds only by
  water; leaves only under trees; pebbles only on banks. One season of trees.
- **Nothing is only a picture**: every flower, tuft, pebble and bench is a thing of its type, met
  by whatever input points at it (requirement F11); the map has no decoration layer.
- **The far bank is quieter**: flowers, framing woods, a pier, and a road that leaves the map
  with a signpost to a place not written yet.

| Place | What it is for |
|---|---|
| The camp | Hesper's tent, her chest (a rope; her bread), the campfire, the torch. Where you wake, where she tends the fire, the one place the wild keeps off at night. |
| Tobin's cart | By the road short of the landing. A pile on a fixture: the frost wand and a flask of oil, both his. |
| The landing | The rope post whose line snapped (the winch, `broken`), the boat at the near pier, the bucket; the far pier across the gap the ferry crossed. |
| The narrows | The dead tree on a spit of land, rock to north and south, water to the east: it can only be felled across. |
| The hollow | The slimes' cave mound at the cliff's foot; the frost slime's rimed corner and the frozen edge of the river. |
| The dry meadow | Tall dry grass: fire runs here. |
| The marsh | Ponds among tall grass: lightning runs here. |
| The far bank | The goal (region `far_bank`, every column from 32 east); a road that leaves the map to the east. |

### 4b. The meadow, west of the Ford (40 × 30)

The road leaves the Ford through the gap in its western woods (rows 18–20) and comes out on the
meadow's east edge: open grassland in a ring of woods, a pond, flowers and tufts (Minecraft's
plains). Its ground yields sticks, stones and grass like the Ford's (three of each to start,
up to 6/5/6). Three cows and four hens live there; more appear slowly while the player is on the map
(`MapData.appear`: a cow every 1,200 ticks up to 4, a hen every 900 up to 5). Animals are
passive: they wander near where they appeared and run from whoever strikes them. A cow leaves
two raw beef, a hen one raw chicken (what they are made of, broken down: `combat/defeat`); a hen
lays an egg every 1,800 ticks (her stage, world-model.md §6.5). Both lie where they fell, taken with F. Every food is edible, raw or cooked, and feeds
its own `food` (raw beef 3, steak 8, raw chicken 2, roast chicken 6, egg 1, bread 5).
The cow and chicken sprites are the project's own (`tools/src/art/animals.ts`, served from
`public/assets/lsw/`); the pack subset has none.

### 4c. The forest, south of the meadow (40 × 30)

A trail leaves the meadow through the gap in its southern woods (columns 22–24) and winds
through thick woods: about two trees in five inside, clearings along the trail, side trails
off it. Every tree and pine falls to an axe as anywhere (`wood/notch`, `wood/fell`: two swings,
a stump that grows back in two game days, two logs and a stick); a couple of hundred stand
beside ground the player can reach. Its ground yields sticks above all (up to 10), a few
stones and grass.

## 5. People

Two people, as data (`tools/src/demo/people/*.ts`): a record each with temperament, ties, keyed
schedules and keyed lines (about 16 each, English and Chinese).

| | Hesper, the ferrykeeper | Tobin, the peddler |
|---|---|---|
| Who | 64; thirty-one years on the crossing; few words; stiff hands she will not mention | 34; charms and oddments from the east; talks; hungry since the storm cut him off |
| Tie | Tobin owes her last autumn's fare | the ferrykeeper he owes a fare |
| Day | tends the fire at dawn, noon and evening (the fire must be **lit**); watches the water; mends nets; sleeps by the fire | minds his cart (it must not be **burning**); stares at the water; warms his hands at the fire in the evening |
| Storm | waits it out at the tent's mouth | waits it out beside the tent |
| What they own | the chest and the bread in it (the rope is the ferry's) | the cart, the frost wand, the oil |

- **Schedules** pick the most specific variant: `fact:<key>` → `storm` → `rain` → `default`. An
  entry may name the thing its activity **uses** and what it must be (`need`); when it is not,
  the person is **blocked** (§8).
- **Lines** pick the most specific key: `topic:<id>` → `fact:<key>` → `greeting:first` →
  `weather:<w>` → `hour:<band>` → `default`; and when handed something, `given:<type>` → `given`.
  Topic and once-only lines are said once; the last line is not repeated.
- **Handing** someone a thing (right click on them) gives it to them; they say their line for it.
  No hearts, no tastes, no points.
- **Danger**: people run from what would attack them, toward the fire. A fire keeps the wild off,
  so Hesper tending it every evening is what keeps the camp safe at night, and dousing it lets
  the night in. Tobin sleeps by his cart, outside the fire's reach.

## 6. The ways across

| Way | What the player does | Taught by |
|---|---|---|
| **The ferry** | take the rope from Hesper's chest (E opens it), put it on the winch (`ford/mend-winch`), then talk to Hesper (`ford/ask-crossing` → the ferry scene) | the snapped rope at the winch (E: "a good length of rope would mend it"); Hesper's first words |
| **The dead tree** | take the axe, strike the tree three times from the landward side (`ford/chop-dead-tree`, `ford/fell-dead-tree` → `layLine` lays a log bridge over the water), walk across | the tree alone at the narrows, water beyond it; Hesper: "Aldo always said it would fall the wrong way" |
| **The ice** | give Tobin something to eat (`ford/feed-peddler`: he trades the frost wand), cast frost at the water at your feet, step, cast again — the ice thaws after a while (`chilled` → `frost/thaw`) | the frozen edge where the frost slime sits; Tobin: "freezes a puddle solid — a river, I would not know" |
| **Anything else** | whatever the world learns that carries the player over | the Threadbook |

The ending (`far_bank` scene) is triggered by the region, not by a route: it sets
`ford.crossed`, Hesper and Tobin call across the water, and a card closes the story. The world
goes on after it.

## 7. Content that must stay playable (invariants)

BardOS's stage invariant, as data (`content/src/ford.ts`): while `when` holds, `holds` must hold.
If state breaks one, the world raises `invalid` for the modder; with no answer, the fallback
keeps the Ford winnable.

| Invariant | Breaks when | Fallback |
|---|---|---|
| `ford.rope` | the winch is broken and no rope exists (it burned) | Hesper finds the old rope off the raft |
| `ford.crossing` | not crossed, and no rope, no dead tree, no frost wand, nothing mended or felled | Hesper takes you over on the raft herself |

## 8. What the world does by itself

Each source of undefined behaviour of the previous event model has an instance at the Ford.
The common cases are rules; the rest go to the modder when they are salient. Under the event
model agreed on 2026-10-02 (design.md §5.4–5.14), the twelve sources become kinds of one event
tree and this table is re-derived with the migration (§5.14).

| # | Source | At the Ford (a rule) | At the Ford (asked) |
|---|---|---|---|
| 1 | the held thing on something | rope on the winch; frost on water | bread on the winch |
| 2 | put something somewhere | rope into the chest; bread to Tobin | the axe put on the dead tree |
| 3 | a blow with no reaction | the axe on a slime | frost on the winch |
| 4 | a bare hand on a thing | E on the chest, the winch | E on the raft |
| 5 | stepping into a tile in a state | into fire, into water | onto oil |
| 8 | a cascade meets an unmodelled pair | fire through dry grass; rain on fire | lightning on the dead tree; fire reaching the rope; rain on the fire slime |
| 9 | creatures meet things | the fire slime lights the haystack | the frost slime at the chest; the two slimes meet |
| 10 | a person is blocked | her fire is out: she lights it again | her fire is soaked; his cart is burning |
| 11 | a witness | the owner objects to a theft | a bystander sees it |
| 12 | content is invalidated | — | the rope burns (`ford.rope`) |

Sources 6 (free intent) and 7 (open conversation) stay reserved (D9).

## 9. Completeness: the Ford contains everything the demo needs, and nothing else

The world model ([world-model.md](world-model.md) §10.3) adds fifteen requirements, each landing
with its step (W1–W10): felling, too hard, mining, leaving by an edge, overworld time, the river
as a barrier, persistent wilderness, height and falls, derived recipes, bedrooms, cover, storeys
and collapse, fire on structures, real work and people entering from edges, story steps on
entering regions.

The requirements are derived from the system, not chosen:

- **A. The engine's event space**: every event kind — `interaction`, `hit`, `status`, `expire`,
  `tick`, `enter`, `defeat`, `meet`, `blocked`, `witness`, `invalid` — occurs on the map.
  After the event model's migration (design.md §5.14): every kind of its tree (act, impulse,
  contact, bump, time, threshold, seen, stuck, broken) occurs, and every undefined leaf the root
  defaults leave open has an instance that is asked.
- **B. The sources of undefined behaviour** (design.md §5.4): 1–5 from the player, 8–9
  physical, 10–12 social; each has an instance that is asked about (6–7 are reserved).
- **C. The ontology the rules address**: every kind of thing (the player, people, creatures,
  items, fixtures, tiles with statuses); every element of the reaction triangle (fire, water,
  ice, lightning) and oil has a source.
- **D. The inputs** (design.md §5.2): every class of held thing (none, an object, food, a pure
  weapon, a tool-weapon) and every target layer (a person, a creature, a fixture, a loose item, a
  pile on a fixture, the ground, oneself) exist, and every input reaches every layer.
- **E. The Mod port's loop**: a request becomes a validated patch, applied and in the
  Threadbook with whose act taught it; the class never asks again; a bad patch is rejected and
  the safe default stands; the world's own requests never freeze it and never harm a person;
  the library persists across saves and new games.
- **F. What a game needs at the least**: a goal stated as a state (F1); the three taught ways
  across, each played through (F2a–c); teaching by placement (F3); risk and recovery (F4); a
  world that acts alone (F5); people with lives (F6); save and continue (F7); legibility (F8); an
  opening (F9); danger by data — the wild attacks folk by faction, the player and people alike;
  people run; a fire keeps the wild off (F10); a place, not a picture — all that is drawn or in
  the way is terrain or a thing, met by whatever input points at it (F11); the ground yields
  sticks, stones and grass that craft the first tools (F12); a defeated foe teaches whoever
  struck it (F13); the meadow's animals and their food (F14); the forest's trees (F15).

**The proof** is `games/openworld/tools/test/demo.test.ts`. It builds the real map in memory
(`buildFord()`), and for every requirement runs a scenario on it — through the player's own
inputs wherever there are any (the routes are walked, the axe is swung, the wand is cast) — and
asserts the event, request or state. Then the converse, **minimality**: every placed type, every
person, the storm and the goal region must witness some requirement, and every witness named
must be on the map. The log pile of the first draft witnessed nothing and was cut; so were the
bed (Hesper sleeps by the fire) and a third slime.

| Element | Requirements it witnesses |
|---|---|
| Hesper | B10, B11, B12, C1, F2a, F5, F6, F9 |
| Tobin | B11, C1, E3, F2c, F4, F5, F6, F9, F10 |
| fire slime | B9, C1, C2, F3, F4, F5 |
| frost slime | B9, C2, E2, F3, F10 |
| rope | B12, C1, D1, F2a |
| bread | B1, D1, F2c, F9 |
| axe | B2, D1, F2b |
| frost wand | B3, C2, D1, D2, F2c |
| oil | B5, B11, C2 |
| bucket | B10, C2, F3 |
| torch | C2, F3 |
| campfire | B10, C1, F3, F10 |
| chest | B9, F2a |
| cart (a pile on a fixture) | B11, D2 |
| winch | B1, B3, B12, F2a, F8 |
| raft | B4, E1, F2a, F8 |
| dead tree | B2, B8, F2b, F3 |
| haystack | B9, F3 |
| burrow (the hollow) | B9 |
| the storm | B8, C2, F5 |
| the far bank | F1 |

## 10. What was cut, and why

| Cut | Why |
|---|---|
| Hearthvale's fifteen maps, twelve villagers and ~830 lines; the homestead, shops, fishing | Stardew's content, not ours; none of it witnessed a requirement the Ford does not |
| Weekdays, seasons, the weekly gathering, the long repair project | Stardew's loops; the Ford's loop is the goal and the world's answers |
| Friendship hearts, gift tastes, letters, energy, sleeping in a bed | Stardew's systems; people react through lines, topics and witnesses instead |
| The social, map and letters tabs | nothing to show; the journal holds the objective and the Threadbook |

The engine keeps what is general (rules, statuses, scenes, schedules with variants, lines with
keys, topics, facts) and gained what the Ford needs (the world's four event kinds, invariants,
regions, `layLine`, `goto`, `give`, `emote`). The base rule library keeps its farming,
building and fishing rules: they are world physics for the places still to come, not the
demo's game.

## 11. Scale

The Ford is the first place of a world built to grow; the generated 460-map world that came
before it is gone (2026-10-02), and scale is built out from the Ford. What carries over unchanged: people as keyed data (heroes hand-written,
the crowd from templates with slots), schedules with fidelity tiers, invariants per piece of
content, the world's own events with salience and budgets, and the shared library. The road
east of the far bank is where the next place begins.

## References

- Breath of the Wild: [GDC 2017 report](https://www.thumbsticks.com/gdc-17-breaking-conventions-breath-of-the-wild/), [the Great Plateau's quiet guidance](https://eliterev.wordpress.com/2017/03/16/breath-of-the-wilds-quiet-guidance-and-the-lessons-of-the-great-plateau/) — a small region that contains every mechanic, taught by placement.
- Baba Is You: [designing the rule system](https://www.gamedeveloper.com/design/designing-i-baba-is-you-i-s-delightfully-innovative-rule-writing-system). DOS2 surfaces: [gamepressure](https://www.gamepressure.com/originalsinii/environmental-effects-and-combinations/zea274).
- Stardew Valley, Animal Crossing, Fields of Mistria — for craft (people as keyed data, warm UI, feel), not content: [schedules](https://stardewvalleywiki.com/Modding:Schedule_data), [dialogue](https://stardewvalleywiki.com/Modding:Dialogue), [Nookipedia — villagers](https://nookipedia.com/wiki/Villager).
- Oblivion and Skyrim — the world's own events and their boundaries: [What was Radiant AI, anyway?](https://blog.paavo.me/radiant-ai/), [Creation Kit: Story Manager](https://ck.uesp.net/wiki/Category:Story_Manager).
- Scale: [Dwarf Fortress historical figures](https://dwarffortresswiki.org/index.php/Historical_figure), [Watch Dogs: Legion's Census](https://www.gamedeveloper.com/design/how-watch-dogs-legion-s-play-as-anyone-simulation-works), [Shadows of Doubt devblogs](https://colepowered.com/shadows-of-doubt-devblog-13-creating-procedural-interiors/).
