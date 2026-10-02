# LoomWorld — game design

LoomWorld (织界) is the world; *Large Symbolic World* is the method and the paper. Its first place
is **Hearthvale** (炉谷), a valley village. This document is the design bible for the playable
game: what Hearthvale v1 is, why it is built that way, and how the same structure grows from a
village to a town to a city. It overrides `docs/roadmap.md` where they overlap.

We benchmark the *craft* of the best games in the genre — Stardew Valley, Animal Crossing, Fields
of Mistria, Breath of the Wild's systemic design, RimWorld's procedural people — their thinking,
quality and detail. We take no story, setting or theme from them.

Contents: 1 pillars · 2 the world and its premise · 3 time and the calendar · 4 places ·
5 people · 6 loops · 7 the first week · 8 systems (data formats) · 9 scale · 10 production plan ·
references.

---

## 1. Pillars

Each pillar names the benchmark it comes from and what it means here.

1. **A world that existed before you.** Fields of Mistria's most praised trait: villagers have a
   shared history and relationships that do not revolve around the player. Stardew gives every
   villager a home that says who they are (the artist alone in the forest, the writer by the sea).
   → Every villager has a home, a job, family and friends, a history with others; their yard and
   their rooms show who they are. Nobody lives at the inn unless they work there.
2. **Teach with situations, not text.** BotW's Great Plateau has no tutorial text after the first
   screen: an axe beside a man chopping wood, peppers at the edge of the cold, one shrine per
   ability whose geometry teaches it. → Every elemental rule is taught by a placed situation
   (a campfire beside the hay, a storm over a puddle, an ice-sealed door). Villagers stop
   reciting mechanics.
3. **A world that reacts and remembers.** Stardew's conversation topics make every NPC able to
   react to a world event, and to remember it after a day, a week, a year; one small rule (the
   villager who scavenges does not mind you rummaging in bins) says more than a page of text.
   Kenshi changes the world with simple facts. Coral Island is the counter-example: lines that
   ignore the season, opinions that contradict the character. → World state is facts and
   topics; lines are chosen by context; what you do is noticed and remembered.
4. **People are data, resolved from specific to generic.** Stardew resolves schedules, lines and
   gift reactions by the most specific matching key (a date, a heart level, rain, a weekday, the
   season, a mandatory default); Animal Crossing gives ~400 villagers distinct voices from 8
   personality templates filled with slots. → Our rule engine already chooses the most specific
   rule; people use the same principle: hand-written for heroes, templates with slots for the
   crowd.
5. **Something to do every day; goals that change the map.** Animal Crossing's daily small
   novelties, Mistria's weekly gathering at the inn ("a town rather than a collection of quest
   dispensers"), Stardew's long project whose rooms each repair something in the world. →
   A daily rhythm, a weekly gathering (Hearth Night), and one long-term project whose stages
   visibly change the valley.
6. **A paced first week.** Animal Crossing teaches its verbs through hospitality on day one;
   Stardew's first day is a few seeds, a few tools and "meet everyone"; Mistria keeps day one
   short and opens systems over several days. Baba Is You's warning: too many active rules at the
   start overwhelm. → Day one is arrival and meeting people; each day opens one system through a
   person's request.
7. **Level design craft.** BotW's triangle rule (large forms as landmarks, medium ones that hide,
   small ones that pace) and its "gravity" of points of interest; Stardew's map layers (ground,
   buildings, a front layer drawn over the player, canopies always on top) and its secrets. →
   Every map has a landmark seen from afar, a route that pulls the player along, framing
   (water, cliffs, woods), layers that let the player walk behind things, and at least one
   secret.
8. **Uniform systems over special cases.** BotW's chemistry engine: elements change materials,
   elements change each other, materials don't change materials; TotK found that making
   everything follow one system created interactions "without any dedicated implementation". →
   New behaviour comes from rules over classes and new primitives, never from a special object.
   This is also what makes the world's self-patching coherent.
9. **Game feel.** A day long enough to plan and short enough that choices matter (Stardew: ~14
   minutes); things that bounce, pop, shake and sound when touched; a warm UI. → See §8.8.

## 2. The world and its premise

**Hearthvale** sits in a high valley of Saenvar, below the Frostfang Hold. At its centre burns
the **Great Hearth**, a stone ring of fire that has not gone out in two hundred winters. The
valley folk say the Hearth keeps "the ways of the valley": that water quenches and frost bites,
that seed becomes wheat. The old word for those ways is *the weave*.

The night you arrive, the Hearth gutters out. Nothing breaks at once — but the mill wheel stops,
the north road is blocked by a slide, the bridge to the east meadow washes out in the first
rain. Rekindling the Hearth is the long project of v1 (§6.3).

**The weave and the Threadbook.** The world in LoomWorld is a weave of rules. When the player
does something the valley has never seen, the world pauses and learns — a new thread is woven.
Mira, Elder Maren's apprentice, keeps the **Threadbook**: a journal in which every new thread
appears in plain language ("A rope can bind a creature for a while"), with who first wove it.
The Threadbook is the player-facing form of the shared rule library: it replaces the Mod Console
in the clean game (the console stays a developer tool). It turns the paper's mechanism into a
diegetic, collectible part of play — without explaining any of it.

**Tone.** Warm, small, a little melancholy; humour in people, not in jokes about mechanics. The
world is domestic, not epic: one valley, its people, its seasons.

## 3. Time and the calendar

| | v1 |
|---|---|
| Day | A full 24-hour day: the world never stops (people sleep, shops close, the night has its own life). One game minute ≈ 0.7 s → a whole day ≈ 17 real minutes, close to Stardew's pace, so that what you do with a day matters. The game begins on day 1 at 06:00; days change at midnight. |
| Sleep | Sleeping skips to 06:00 and restores energy. Staying up is allowed at any hour; the longer you are awake, the more tired you get (energy drains faster, you move slower). |
| Energy | Tools and heavy work cost energy; food restores it. Low energy slows you down. Gives every day a budget. |
| Week | 7 days: **Firstday, Ashday, Riverday, Stoneday, Seedday, Windday, Hearthday**. Hearthday evening is Hearth Night (§6.2). Shops close on Hearthday mornings. |
| Weather | Sun, cloud, rain, storm, fog; drawn per day from a seed. Rain waters crops, wets everything outdoors (the elemental rules apply!), changes schedules and lines. Storms bring lightning. |
| Seasons | v1 plays one season (*Thaw*, 28 days). The calendar and data formats carry seasons from the start; seasonal tilesets come later. |

## 4. Places

### 4.1 Map layers (every map)

| Layer | Contents | Draw order |
|---|---|---|
| Ground | terrain (autotiled) | bottom |
| Detail | paths' edges, stones, flowers, grass tufts, puddles, decals | over ground |
| Buildings | walls, fences, rocks, trunks: solid | y-sorted with actors |
| Front | the parts the player walks behind when north of them (fence tops, bushes' upper halves, lamp heads) | y-sorted |
| Canopy | tree crowns, roofs, arches | always over actors |
| Logic | spawns, warps, triggers, no-walk, named spots (anchors) | not drawn |

### 4.2 Hearthvale (town), about 64 × 48

```
  N   ^ north road (blocked by a rockslide until stage 3)            ~ river
  .....##########.....................^^^.....................~~~~~.........
  ..graveyard ...#....                 |                     ~~~~  OLD MILL ..
  .. + + +  shrine#..   ELDER'S HOUSE  |                    ~~~~  (wheel     ..
  ..  lookout ...#....   [Maren, Mira] |                   ~~~~    stopped)   .
  .......###.........    garden  well  |        mill bridge==~~~~ ............
  HOMESTEAD <=====west road=========( GREAT HEARTH )=======east road====== SMITHY
  (to the   ......  ODA'S GOODS     (  stone ring   )   THE HEARTH INN   [Brann] .
   player's ......  stall, crates     square: board,     tables outside   yard:   .
   farm)    .......                   benches, lamps     stable, horse   ore,trough
  .HOLLIS'S FARM ...........................|.............~~~~~~~~~ east bridge ..
  . fields  barn  coop  scarecrow ..........|...........~~~~ POND ~~~ (washed out
  . [Hollis]       chickens ................|..........~~~ FENN'S  ~~  until stage 2)
  ..........................................|..........~~~ dock, shack, cat
  ....... SERA'S COTTAGE ..................|........ east meadow (beyond the bridge)
  ....... herb garden, beehives, drying racks |
  ........... forest edge .......  GATEHOUSE [Garrick]   watchtower
  #############################|  south road  |##################################
                                 v Whisperwood
```

- **Landmark:** the Great Hearth, visible from every entrance (its smoke column when lit; its
  cold ring of stones when not). Second landmark: the stopped mill wheel on the river.
- **Framing:** the river runs from the north-east to the pond and on south; cliffs along the north
  (the graveyard and shrine on a rise, with a lookout over the whole valley); woods to the south.
- **Homes that show their owners:** Hollis's barn, coop and scarecrow; Sera's herb garden, hives
  and drying racks at the woods' edge; Fenn's dock, nets and his cat; Brann's yard of ore and a
  quench trough beside the river; the inn's outdoor tables and stable; Oda's market stall and
  stacked crates; Maren's garden beside the Hearth; Garrick's watchtower at the gate.
- **Placed situations:** the inn's outdoor campfire beside Hollis's hay (fire spreads on dry
  grass); the well and buckets on the square (water douses); the smith's quench trough (wet
  metal, steam); puddles on the square after rain (lightning conducts); an oil barrel by the
  inn's kitchen door.
- **Secrets:** the lookout (a view of the whole valley, and a lost item); a gap in the hedge
  behind the graveyard to a tiny shrine; Fenn's buried box under the dock (Fenn hints at it
  after four hearts).

### 4.3 Homestead (the player's farm), about 36 × 28

The player's cottage (small, run-down, a hearth that can be lit), an overgrown plot to clear
(weeds, stones, stumps: the first uses of the hoe, pickaxe and axe), a well, a shipping crate,
a fallen fence. The plot is the player's own canvas; it grows with them.

### 4.4 Whisperwood, about 64 × 48

```
  ======= south road from town ========
         |            old shrine (moss) .....  BEEHIVE GLADE (honey; smoke calms bees)
  .......|.....  burnt clearing (charred trunks: what fire does to the woods) ....
  ...... |      footbridge over the stream ~~~~~~~
  FALLEN GIANT TREE blocks the path to the  ~~~ stream ~~~
  HIDDEN GROVE (stage 2: cut, or burn it)    ~~~~~~
  ...... |............................ LAKE (frozen at dawn in Thaw; fishing)
  ...... MUSHROOM RING (wisps at night)
  ...... CAMP (traveller's campfire, sack, hay)   .....  cliff path ^ to the HOLLOW
```

- **Route:** the road pulls the player south past the burnt clearing (a lesson in what fire
  does), over the footbridge, to the lake and the camp; the cliff path climbs to the Hollow.
- **Gravity:** points of interest of different visibility between the road and the edges (the
  hive glade's sound, the wisps' light at night, the giant tree's silhouette) pull players off
  the straight path.
- **Secret:** the Hidden Grove behind the fallen giant (rare herbs, a sleeping stag, a stone
  with the oldest thread written on it).

### 4.5 Slime Hollow, two levels

A dungeon designed as a sequence of rooms, each teaching one combination, then mixing them —
the BotW shrine principle:

1. **Entry:** braziers and an unlit corridor (light the way; fire as light).
2. **The pool hall:** spark slimes around water (soak them, then shock them; conductivity).
3. **The ice-sealed gate:** melt it with fire, or find the warm route (states change).
4. **The oil cellar:** barrels, a careless fire, and a door blown open (oil + fire).
5. **The King's den:** all of it together; the Hollow's lower gate opens at stage 4.

### 4.6 Interiors

Player's cottage · Elder's house (Maren and Mira: study, the Threadbook desk) · The Hearth Inn
(common room, kitchen, family rooms for Lio, Tamsin and the children, two guest rooms) · Oda's
Goods (shop below, rooms above) · Brann's smithy (forge, living corner) · Hollis's farmhouse ·
Sera's cottage (drying herbs, a still) · Fenn's shack · the Gatehouse. Each room has a purpose
and furniture that serves it (a kitchen has a stove, a table and something cooking; a study has
books, a lamp and an unfinished letter).

## 5. People

### 5.1 The record (one per person, as data)

| Field | Values (examples) |
|---|---|
| id, name, age | `npc.hollis`, Hollis, 63 |
| temperament | **personality** (one of 8, §9.3), **manner** (polite / plain / rough), **social** (outgoing / reserved), **outlook** (hopeful / wary) |
| home, work | `hollis.farmhouse`, `hollis.fields` |
| family & friends | `{ npc.sera: 'daughter', npc.fenn: 'old friend', npc.oda: 'rival haggler' }` |
| birthday | Thaw 19 |
| tastes | loves / likes / dislikes / hates by type or tag (`food:pie`, `tag:fiber`) + universal tastes |
| schedule | keyed entries (§8.2) |
| lines | keyed lines (§8.3) |
| events | heart events with conditions (§8.6) |
| look | sprite and faceset (Ninja Adventure) |

### 5.2 The people of Hearthvale (v1: 12)

| Who | Age | Work | Home | Ties | What they want |
|---|---|---|---|---|---|
| **Maren**, the elder | 74 | keeps the Hearth | Elder's house | teacher of Mira; old friend (once more) of Fenn | to see the Hearth lit before she dies |
| **Mira**, apprentice | 22 | keeps the Threadbook | Elder's house | Maren's apprentice; Wren follows her everywhere | to understand why the weave learns |
| **Lio**, innkeeper | 38 | the Hearth Inn | the inn | married to Tamsin; father of Wren and Pip | to keep the inn full and his family out of trouble |
| **Tamsin**, cook | 36 | the inn's kitchen | the inn | married to Lio; mother of Wren and Pip | a real oven (the old one smokes) |
| **Wren** | 10 | — | the inn | Lio and Tamsin's daughter; idolizes Mira | to see magic up close |
| **Pip** | 7 | — | the inn | Wren's brother; idolizes Garrick | a sword (he gets a stick) |
| **Brann**, smith | 47 | the smithy | the smithy | widower; taught Garrick to fight; buys ore from Oda | to forge one perfect thing again |
| **Oda**, merchant | 55 | Oda's Goods | above the shop | haggles with Hollis; supplies Brann; nobody knows her past | a profit — and, quietly, company |
| **Hollis**, farmer | 63 | the fields | the farmhouse | father of Sera (estranged); old friend of Fenn | slimes out of his turnips; his daughter back |
| **Sera**, herbalist | 31 | herbs, remedies | cottage at the woods' edge | Hollis's daughter; Garrick is sweet on her | a cure she read of in an old book |
| **Garrick**, guard | 33 | the south gate | the gatehouse | Brann's student; sweet on Sera; Pip's hero | to be needed |
| **Fenn**, fisher | 76 | the pond | the shack by the dock | old friend of Hollis; Maren's ex | one last big catch; to make it up to Maren |

Plus animals with homes and routines: Hollis's chickens and cow, Fenn's cat, the inn's horse,
the village dog that follows whoever fed it last.

**The web is the point.** Two stories run through it and pay off in heart events: Hollis and
Sera (a father and daughter who stopped talking when she chose herbs over the farm), and Maren
and Fenn (a long-ago engagement, and an old man who wants to say sorry). Others are threads:
Garrick and Sera, Pip and Garrick, Wren and Mira, Oda and Hollis's haggling, Brann and his
unfinished blade.

### 5.3 How a person speaks

Lines are organized by context, and the most specific one that applies is said (§8.3). Each
hero has, in v1, about 40–60 lines:

- **greetings** by time of day and by friendship (stranger → acquaintance → friend → close);
- **weekday** lines (Hollis on Seedday: market prices; Brann on Stoneday: ore delivery);
- **weather** lines (rain, storm, fog: each person reacts in character);
- **place** lines (Sera at the inn on Hearth Night; Fenn at the dock at dawn);
- **topic** lines — reactions to world events (§8.4): the hay field burned, the bridge fixed,
  the King of the Hollow defeated, the Hearth's stages — and their **memories** a day and a week
  later;
- **gift** reactions: by item, by kind, by taste, generic;
- **about others**: lines that mention family and friends (Tamsin on Wren's latest mischief).

Lines never teach mechanics. They may *mention* a thing the person knows ("Mind the hay —
Lio's campfire spits"), because that is what a farmer would say.

### 5.4 Friendship and gifts

- Friendship points per person, 250 per heart, 10 hearts. Talking once a day +20; gifts by
  taste (love +80, like +45, neutral +20, dislike −20, hate −40), one per day, two per week;
  birthdays ×8. Points fade slowly if you ignore someone.
- Reactions come from character, not from a table alone: Oda is delighted by anything rare and
  scornful of anything cheap; Pip loves anything that looks like a weapon; Sera loves anything
  that grows; Fenn hates being given fish ("I *have* fish").
- Small social rules carry character: Hollis is annoyed if you trample his crops in front of him;
  Brann likes it when you use his anvil properly; Garrick notices if you start a fire in town.
- Heart events at 2, 4, 6, 8 hearts for the key people of the two stories (Hollis, Sera, Maren,
  Fenn) in v1; others get one event each later.

## 6. Loops

### 6.1 Daily

Each day offers something new without requiring it:
- the noticeboard on the square (one or two small requests from villagers, with a deadline);
- forage and fish that change with weather and time;
- Oda's rotating stock; a traveller at the camp in Whisperwood on some days;
- the farm (water, harvest, plant), the mail (letters from villagers, items, recipes);
- a person to visit (birthdays, a villager who wants to talk about yesterday's events).

### 6.2 Weekly: Hearth Night

Every Hearthday evening the whole village gathers — at the inn while the Hearth is cold, at the
square around the Hearth once it is lit. Everyone has special lines; there is music; the week's
events are talked over (topics); small things happen between villagers (Garrick works up the
courage to sit next to Sera; Fenn tells a tall tale; Pip falls asleep on a bench).

### 6.3 Long term: rekindling the Great Hearth

Four kindlings, each gathered from one part of the valley's life, each of which visibly changes
the valley when offered:

| Stage | Kindling (examples) | What changes |
|---|---|---|
| 1. Field | a sheaf of wheat, an egg, a sack of flour… | the **mill** turns again (flour, bread at the inn) |
| 2. Water | a fish from the lake, river reeds, clean water… | the **east bridge** is rebuilt; the east meadow opens |
| 3. Wood | honey, rare herbs from the Hidden Grove, charcoal… | the **north road**'s slide is cleared; travellers come |
| 4. Stone | ore from the Hollow, a smith's ingot, a gem… | the Hollow's **lower gate** opens; then the Hearth is relit — a festival |

The offerings reuse every system (farming, fishing, foraging, mining, smithing, cooking) and every
elemental rule; the order is the player's. When the Hearth is relit, the village celebrates
on the square, and the world (and its people) talk about it for a long time.

## 7. The first week

| Day | What happens | What is learned |
|---|---|---|
| Arrival (evening) | You come up the south road at dusk; Garrick lets you in; the Hearth gutters out as you reach the square; Maren takes you to your cottage. | walking, talking |
| Day 1 | Morning: Maren shows you the homestead; a basic kit is in the cottage chest. Quest: *meet the people of Hearthvale* (each greeting is a little scene). | take, put, the inventory; people |
| Day 2 | Hollis: slimes in his turnips; he lends you a hoe and asks you to drive them off (Brann has a practice blade). | combat; tools |
| Day 3 | Tamsin: the inn needs a fish for supper; Fenn lends you a rod. | fishing; cooking (at the inn's fire) |
| Day 4 | Rain. Sera needs fireweed from the burnt clearing; the woods are wet — fire won't catch, and slimes are slick. | weather and the elements |
| Day 5 | Mira shows you the Threadbook and the first thread you wove (whatever undefined thing you tried); she asks you to "try something the valley has never seen". | the world learns |
| Day 6 | Maren: the Great Hearth and the four kindlings; the noticeboard opens. | the long project |
| Day 7 | Hearth Night at the inn. | the village as a whole |

One system opens per day; the elemental rules arrive as situations, never as instructions.

## 8. Systems (data formats)

All of it is data the engine resolves. New behaviour is a rule; new kinds of data or events are
engine changes. The formats below are what the build implements.

### 8.1 Calendar and world state

- `calendar`: `{ day, weekday, season, year, weather }` derived from ticks and the world seed;
  a day is a full 24 hours from 06:00 at 0.7 s per game minute.
- **Facts**: named booleans or numbers (`hearth.stage = 2`, `bridge.east.fixed`, `hay.burned`,
  `king.defeated`). Rules read and write them; schedules, lines and events are conditioned on
  them.
- **Topics**: `{ id, day }` raised by rules when something happens (`hay_burned`,
  `bridge_fixed`); a topic lives for 4 days by default; lines keyed on the topic are said once
  per person; `<topic>_memory_week` keys fire a week later.

### 8.2 Schedules

A person's schedule is keyed entries; the most specific key that applies wins:

```
festival / date (thaw_12) → hearts-gated variant → rain / storm → weekday (seedday) → default
entry: [time, place (map + anchor or x,y), facing?, activity?, line?]
```

with arrive-by times, cross-map paths, and conditions on facts (`NOT bridge.east.fixed` →
another route). v1 people have 4–6 variants each. Hearth Night (`weekday:hearthday`) is the
weekly gathering and outranks the weather: the inn is indoors.

### 8.3 Lines

```
{ key: 'rain', text: {en, zh}, mood?: 'happy'|'sad'|'angry'|'surprised', once?: true }
key grammar (specific → generic):
  topic:<id> | topic:<id>:memory_week | date | place:<map>[:<anchor>] + hearts | weekday + hearts |
  weather | hour band (morning/day/evening/night) + hearts | greeting:<tier> | default
```

Slots: `{player}`, `{friend:<id>}`, `{fact:<name>}`, `{item}`. A line can carry a mood (the
faceset expression) and can be once-only. The resolver picks the most specific matching key
(randomly among equals, avoiding the line said last time). The first words of the day are a
greeting by friendship; later in the day the moment speaks (hour, weather, place). Heart-gated
lines join their key's pool once the hearts are there; a birthday outranks the date.

### 8.4 Friendship, gifts, social rules

- Player props `friend.<npc>` (points), `talked.<npc>.day`, `gifts.<npc>.week`.
- Gift = putting an item on a person (the existing `put` verb on a person) → taste lookup
  (person's own by item → by tag → universal → default) → points and a reaction line
  (`gift:loved` …).
- Social rules are ordinary rules on events with a witness condition (a person within N tiles
  who can see): *trampling crops near Hollis* → his points drop and he says so.

### 8.5 Mail and the noticeboard

Letters are keyed by date or fact (`hearth.stage=1` → a letter from Tamsin with bread); they
can carry items. Noticeboard requests are templates (bring X to Y by day Z) filled from the
people's needs; their rewards are friendship, money, recipes.

### 8.6 Events (scenes)

A scene is a precondition (place, time window, weather, facts, hearts, seen-before) plus a
script of commands: `move`, `face`, `say`, `emote`, `wait`, `fade`, `place`, `warp`, `give`,
`fact`, `topic`, `status` (the Hearth goes out), `prop` (the story's stage). The line waiting to
be advanced travels in every frame, so a client that missed it (loading) still shows it. The player watches; control returns at the end. Heart events, the arrival, the Hearth
relighting and Hearth Nights use the same runner.

### 8.7 Maps

- Layers as in §4.1. Implemented: ground (terrain), the **detail layer** (`MapData.decor`:
  catalog decor groups, lying or y-sorted), buildings and scenery stamps, the **collision layer**
  (`MapData.solid`, tiles that block whatever the terrain — fences, the Hearth's ring, crates),
  and **anchors** (`MapData.anchors`, the named spots schedules and scenes use; the build fails
  on an anchor that is not walkable).
- The authoring DSL gains the tools of composition: curved and irregular paths (with soft
  edges), organic shorelines and clearings, fences with gates, yards (a fenced lot with a
  purpose), **vignettes** (hand-composed clusters of props: a woodpile with an axe in a stump; a
  washing line; a vegetable patch with a scarecrow), detail scattering by masks (flowers along
  paths, stones at cliff feet, never uniform noise).
- Maps are checked by screenshot during the build.

### 8.8 Feel

- Movement: smooth, at about 4 tiles/s walking; the interaction grid stays tile-based (the tile in
  front of you), so rules are unchanged.
- Animation: tool swings; items pop out of things, bounce and drift to the player; held-up new
  items; things that shake when hit, crops that sway; footstep dust; ambient animals and
  birds.
- Sound for every interaction (Ninja Adventure's sfx), music per place and time.
- UI: warm framed panels (the pack's dialog and panel art), a toolbar, the Threadbook, the
  calendar and the clock; no developer language in the clean game.
- Loading: texture atlases and lazy music, so the game starts in seconds.

### 8.9 The Threadbook

Every accepted patch rule becomes an entry: its one-line description (in the reader's language),
the place and day it was woven, by whom (you, or the world), and how often it has happened
since. Sorted by place and kind; new entries glow. It is the only window the clean game opens
onto the weave.

## 9. Scale: village → town → city

Hearthvale v1 is the hero layer of a structure built to grow:

| Stage | Places | People | Items |
|---|---|---|---|
| v1 Hearthvale (village) | 4 outdoor maps + ~9 interiors | 12 heroes + animals | a few hundred |
| v2 a market town (Saenvar) | ~30 maps | ~50 heroes + a few hundred crowd | thousands |
| v3 a city | hundreds of maps | 30–50 core heroes, ~200 named, thousands crowd | tens of thousands |

### 9.1 Heroes and the crowd, with promotion

Hand-write 1–5 % of people (heroes: the full record of §5). The rest are **crowd**: generated
from templates, kept as light records (or counts, far away). A crowd person the player
interacts with is **promoted** to a persistent individual with a name, memory and a full record
(Dwarf Fortress's historical figures; Watch Dogs: Legion's "uprezzing").

### 9.2 Consistent, lazy generation

A crowd person is generated from a few tags (role, district, income), and the rest follows from
constraints — work → income → home → schedule → friends at work (Legion's Census). Details are
filled in only when needed, but always consistently.

### 9.3 Templates with slots

Eight personalities (our own set: **warm, gruff, proud, dreamy, cheerful, shy, sharp,
steadfast**), each with a body of lines keyed as in §8.3, with slots for the person's job,
family, catchphrase, favourite things and recent events — Animal Crossing's way of giving
hundreds of villagers distinct voices. Heroes override any key with their own lines. Writing
crowd lines within these templates is where the modder (LLM) works at scale.

### 9.4 Fidelity tiers

Full simulation near the player; planned itineraries (each crowd person's day planned at dawn,
replayed cheaply; Shadows of Doubt) on loaded maps; statistics (population, production) for
districts far away (Mount & Blade's economy). Already: our NPC two-fidelity simulation.

### 9.5 Places at scale

Hand-composed hero places (squares, landmarks, hero homes); procedural districts for the rest:
roads → blocks → lots → buildings (tensor-field or template street plans), interiors from
floor-plan templates with furnishing rules (Shadows of Doubt), decoration with Wave Function
Collapse over the pack's tiles. Tiled `.world`-style stitching for many maps. The existing 460-map
Saenvar becomes this generated layer, rebuilt with the composition rules of §8.7.

### 9.6 World state at scale

Facts and topics (§8.1) are the same at any scale; topics gain a reach (a household, a
district, the whole city) so that news travels.

## 10. Production plan (v1)

Status (v1 build): stage 1 is in — every system above except the noticeboard and social
witness rules, map front/canopy layers beyond y-sorting, and juice (pickup arcs, shake);
stage 2 is in — the town (64 × 48), the homestead, eleven interiors, the twelve people (about
830 lines, `tools/src/demo/people/`), the arrival, the first week's story (`content/src/story.ts`),
letters and the first week's weather. `npm run check:world` plays two days headless.

1. **Systems** — calendar, pacing, weather, energy; facts and topics; schedules and lines with
   keys and slots; friendship, gifts, social rules; mail and noticeboard; scenes; map layers and
   the composition DSL; feel (movement, juice, UI shell, loading); the Threadbook.
2. **Hearthvale** — the town, the homestead and the interiors; the 12 people (records,
   schedules, lines, tastes, ties); the arrival and the first week.
3. **The wild** — Whisperwood and Slime Hollow redesigned; the four kindlings and the map
   changes; Hearth Night; the relighting festival.
4. **Polish** — a pass on every map by screenshot; line review for context and character
   (no Coral Island contradictions); playtests of the first hour.

What `docs/roadmap.md` (M5–M9) plans for gathering, fishing, cooking, mining, smithing and
trading fits into stage 3's kindlings; where the two differ, this document decides.

## References

- Stardew Valley wiki, modding pages: [schedules](https://stardewvalleywiki.com/Modding:Schedule_data), [dialogue](https://stardewvalleywiki.com/Modding:Dialogue), [gift tastes](https://stardewvalleywiki.com/Modding:Gift_taste_data), [events](https://stardewvalleywiki.com/Modding:Event_data), [maps](https://stardewvalleywiki.com/Modding:Maps), [friendship](https://stardewvalleywiki.com/Friendship); interviews with Eric Barone ([Kotaku](https://kotaku.com/the-past-present-and-future-of-stardew-valley-1766238624), [PC Gamer](https://www.pcgamer.com/games/sim/eric-barone-has-regrets-about-not-fleshing-out-stardew-valleys-characters-more-but-likes-that-its-so-open-ended-since-it-makes-things-more-personal-for-each-player/)).
- Animal Crossing: [Nookipedia — villagers](https://nookipedia.com/wiki/Villager), [conversation](https://nookipedia.com/wiki/Conversation), [compatibility](https://nookipedia.com/wiki/Compatibility); [Eguchi on communication](https://www.gamedeveloper.com/design/designed-as-a-communication-game-i-animal-crossing-i-defied-genre).
- Fields of Mistria: [FinalBoss review](https://finalboss.io/fields-of-mistria-review-1-0-makes-its-village-the-real-progression-system). Coral Island (counter-example): [review](https://grumpybunnygames.com/coral-island-review/).
- Breath of the Wild / Tears of the Kingdom: [GDC 2017 report](https://www.thumbsticks.com/gdc-17-breaking-conventions-breath-of-the-wild/), [CEDEC 2017 level design](https://gist.github.com/idbrii/e39fe96279aa1670319bfa521d907399), [the Great Plateau's quiet guidance](https://eliterev.wordpress.com/2017/03/16/breath-of-the-wilds-quiet-guidance-and-the-lessons-of-the-great-plateau/), [GDC 2024](https://www.shacknews.com/article/139210/zelda-totk-gdc-2024-panel-recap).
- Baba Is You: [designing the rule system](https://www.gamedeveloper.com/design/designing-i-baba-is-you-i-s-delightfully-innovative-rule-writing-system). DOS2 surfaces: [gamepressure](https://www.gamepressure.com/originalsinii/environmental-effects-and-combinations/zea274).
- Scale: [Dwarf Fortress historical figures](https://dwarffortresswiki.org/index.php/Historical_figure), [Watch Dogs: Legion's Census](https://www.gamedeveloper.com/design/how-watch-dogs-legion-s-play-as-anyone-simulation-works), [Shadows of Doubt devblogs](https://colepowered.com/shadows-of-doubt-devblog-13-creating-procedural-interiors/), [RimWorld backstories](https://rimworldwiki.com/wiki/Backstories), [Kenshi world states](https://kenshi-modding.fandom.com/wiki/FCS:_World_States), [AC Unity crowds (GDC 2015)](https://gdcvault.com/play/1022411/Massive-Crowd-on-Assassin-s), [Tiled worlds](https://doc.mapeditor.org/en/stable/manual/worlds/), [Wave Function Collapse](https://github.com/mxgmn/WaveFunctionCollapse).
