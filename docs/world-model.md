# World model and base gameplay

Status: **agreed 2026-10-04** (v4, after a self-review against generality, first principles
and completeness); **not yet built**. Implementation order: §12. It extends the event model
(design.md §5.4–5.15) and does not replace it: the one AI interface stays the outcome of an
event, rules write only their host, and the root defaults decide what is asked.

What it fixes:

- The same thing is done several ways. A tree counts blows with a status (`notched`), an ore
  vein with a prop (`cracks`), a breakable fixture breaks at once, and walls, stumps and rocks
  have no durability at all. Tiles cannot hold props, so an AI patch that counted blows on a
  stump silently did nothing and a stick could be farmed forever (library #208, #220, #246).
- Maps are bounded by rings of rock. Mine through the rock and you stand at the end of the
  world with nowhere to go.
- There is no common model for materials, what things are made of, crafting, building, rooms,
  storeys, terrain height or a world map.
- Several systems exist twice or more: four behaviour systems, four story-script systems, two
  ways of spawning by time, five damage channels that each reach a different set of things.

## 1. Principles

1. **Reference first.** Every mechanism starts from how existing games built it. Elin is read
   in its decompiled source (installed locally; `ilspycmd` on `Elin_Data/Managed/Elin.dll`).
   Caves of Qud, Cataclysm: DDA, Dwarf Fortress, Elona, RimWorld, Stardew Valley, Minecraft
   and classic JRPGs are compared. We design ourselves only where none of them has a model.
2. **The event model holds.** One AI interface (the outcome of an event); rules read anything
   and write only their host; deliberate acts and impulses are undefined at the root, what
   happens around us all the time is defined physics; patches only fill holes.
3. **Generality.** One concept, one mechanism. No branch on what kind of thing something is,
   what kind of map it is on, or which system made it.
4. **First principles.** Every concept is derived from what play needs. Whatever can be data
   is data, inherited along the type tree. The engine holds mechanisms, never numbers.
5. **Completeness.** Every new element is argued through A1–A7 (design.md §5.13) and held by
   tests (§10).
6. **We take data shapes, not shortcuts.** Elin judges hostility, affinity and crime relative
   to the player, and settles NPC work as abstract daily output. We take neither.

## 2. Decisions

| # | Decision | Reference |
|---|---|---|
| D1 | The state is **things and the clock**. Facts, topics, the current scene, the weather and people's memories are props of the things they belong to (§3) | — (our closure of A1) |
| D2 | **One root type, `thing`.** No kinds: every question the engine asks of a thing is answered by data on its type (§4.2) | Elin's single `Card` base, without its `Thing`/`Chara` code split |
| D3 | **One reference form, `{e: id}`.** A thing in a cell space has an id derived from its position | Qud, CDDA: do not store what can be regenerated |
| D4 | Space is cells `(map, x, y, z)`. What may share a cell is decided by **occupied spaces** (data) and one exclusivity rule | Elin's cell layers, generalised |
| D5 | Terrain has height (a height map per map); storeys stand above the ground; the ground cannot be broken | classic JRPG height levels; Dwarf Fortress z-levels; Minecraft bedrock |
| D6 | Every thing may have **durability**; damage is counted in blows | Elin's hardness × tool efficiency, as blows instead of work time |
| D7 | Every damage channel (blow, element, fall, collapse, crush) reaches every thing with durability | — (generality) |
| D8 | **Material** is an axis of every thing; outputs inherit the material of their source | Elin `SourceMaterial` |
| D9 | One relation, **makeup**, gives the recipe, what a broken thing leaves, and loot; one world **recovery rate** applies to all | Elin `components` + `factory` |
| D10 | Time-staged change (**stages**) is data any thing may carry: growth, regrowth, hatching, spoiling, rust, a fire burning out | Elin `GrowSystem`, generalised |
| D11 | Building is moving a buildable thing into a cell; it is the same thing, in a new place | Elin: a placed block is the same Thing |
| D12 | Any drop is a fall; anything that needs support and loses it collapses | Dwarf Fortress, RimWorld |
| D13 | **Cover** is a derived property of each cell; a **room** is an enclosed, covered, connected space, a derived and read-only thing with any number of roles | Elin rooms; RimWorld roles (as tags, not one chosen role) |
| D14 | **Regions** are things: authored ones (a map's named areas) and derived ones (rooms); entering and leaving one is a contact event | — (generality) |
| D15 | **One behaviour system** of goals for every actor: needs, threat, schedule and work, following, encounter moves, patrol, idle use | Elin `AIAct` goals |
| D16 | **One story script**: steps (blocking or not) and objectives | — (merges scenes, beats, quests, guides) |
| D17 | **One world spawner** (`appear`) for everything that appears by time | merges `forage` and the night spawner |
| D18 | Every act has a **duration**; when the controlled actor's act far outlasts real time the engine **fast-forwards**; damage interrupts | Elin `AIAct` durations, `CancelWhenDamaged` |
| D19 | **Two-level maps**: an overworld (a continent ringed by sea) whose every cell is a local map; leaving a local map by any edge returns to the overworld | Elin, Elona |
| D20 | Local maps are generated deterministically from the world seed and the cell; only changes are saved; nothing expires | Qud (seeded zones), CDDA and DF (do not store what regenerates) |
| D21 | People are placed by their schedules when a map is entered; those headed for the active map walk in from an edge; events for dormant maps wait in their inbox | Elin/Elona catch-up on entry; CDDA, Qud events deferred to load |
| D22 | Local barriers the story relies on are mirrored on the overworld | — (ours: no reference) |
| D23 | Economy conservation, strict: no cycle that takes no time may yield a net gain | — (ours) |
| D24 | Collapse, falling, stages and room changes are defined physics: never asked | root-default policy (design.md §5.9) |
| D25 | Level + skill tree stay; tool tier comes from the instrument's material | ours |
| D26 | Behaviour does real acts; relations are per pair and never player-centric | — (rejects Elin's shortcuts) |
| D27 | Later: tool wear, throwing, digging into hills, overworld encounters, room quality scores | — |
| D28 | Dungeons, deep mines and interiors are maps below a local map, reached by portals | Elin child zones |
| D29 | Every number is a world parameter (§11), never a literal in the engine | — |
| D30 | The threshold at durability 0 is `broken` for every thing (`defeated` merges into it) | — |

## 3. The state

**A1, closed.** The state is:

| State | What | Who changes it |
|---|---|---|
| Things | every thing wherever it is stored: beings, items, furnishings, walls, trees, ground, regions, the story, the world | outcomes, each writing only its host (A2, A3) |
| The clock | the tick | the engine (the clock, fast-forward) |

Moved onto things:

| Was | Becomes |
|---|---|
| `state.facts` | props of the story; `visited.<map>` became a prop of whoever went there; `invalid.<id>` the detector's record (`reported`) |
| `state.topics` | props of the story: `topic.<id>` (the day it was raised) and `topic.<id>.days` |
| `state.scene` | the story's current step (`script` on the story thing) |
| `state.weather` | not state: the weather spans are authored content, loaded with the world like map data; the day's weather is derived from them |
| `state.memory` | each person's own record (`npc.memory` on that person) |

As built (W1): a condition reads a named thing's prop as `{prop: {role: 'story' | 'world', key, default}}`
(the story and the world are roles every event has); `setFact`/`addFact` are gone (a story-hosted
`setProp`/`addProp`; old rules and patches are rewritten when the library takes them); a saved
state keeps only the fields of §3 (a test holds the list). A map's named areas are things of type
`region` (`region.<map>.<name>`, place `{on: 'area', map, rects}`), made when the map's data first
comes; standing in one is the relation `in-region` (the region's side is `encloses`); a scene tied to
a region begins when the player enters it, or stands in it as another scene ends, never by a poll.

**Derived, not state.** Recomputed from the state after every outcome and on entering a map,
the same state always giving the same result: relations (on/under, in/contains, held/holds,
support, in-region), cover, rooms.

**Engine-internal records, not world state.** The event queue, dormant inboxes, cooldowns,
behaviour memory (`Entity.combat`, paths, telegraphs), the Mod port's asked set, and which
broken invariants the detector has already reported. The engine writes these itself; rules
neither read nor write them. (The invariant detector used to write `invalid.<id>` as a fact,
a hidden A2 breach; that record moves here. Whether the story keeps a note that content
broke is the story's own outcome of `broken`.)

## 4. Things

### 4.1 One root

Everything is a `thing`: people, creatures, items, furniture, walls, trees, ground, rooms, the
story, the world. The type tree serves two purposes only: rules choose their hosts by its
nodes, and data defaults are inherited along it. The engine never branches on where in the
tree a thing sits.

### 4.2 The engine's questions, answered by data

| Question | Today | Answered by |
|---|---|---|
| Where is it? | place, and the kind | place only: in a cell, inside something, in a hand, nowhere (the story, the world), gone |
| What may share its cell? | terrain vs entity, actor vs airborne vs NPC | the spaces it occupies (`occupies`, §5.2) and the exclusivity rule |
| Does it block movement? | kind actor, terrain `solid` | `occupies` `volume` or `body` |
| Does it block sight? | kind fixture + `opaque`/`tall`, terrain tags | `opaque` while solid (a shut door; an open one is a gap), `tall` |
| Can one stand on it? | kind fixture + `reach` | `occupies` `floor`, and `reach` (stance) |
| Can it be carried? | kind item | `portable` |
| Can it hold things? | container tags | `capacity` |
| Can it be broken? | only actors have hp | it has `maxHp`; without it, it cannot |
| What does it leave? | actors' drop props; nothing for others | its `makeup` (§6.4) and what it holds |
| Does it act by itself? | kind actor + `ai` / `npc` | it has behaviour data (goals, §6.10) |
| Does it see acts? | kind actor | `sight` |
| How many cells does it fill? | footprint only for actors | `footprint`, for any thing |
| Does it gain experience? | kind actor | it has `level` |
| Collapse or be destroyed at 0? | kind actor | `essential` (goes down and comes to) or not |
| May it write story/world props? | kind resident | it writes only itself; the story and the world are things like any other |
| Is it derived and read-only? | — | `derived` |
| Does it fly or swim? | `stance` | unchanged |
| What does it strike with? | the held item, else special cases for bare hands | its **instrument**: what it holds, else its own body (§6.1) |

No `kindOf` remains in the engine, and type definitions carry no `kind` (§10).

### 4.3 The type tree (draft)

```
thing            material, quality, maxHp (optional), makeup (optional), tags, statuses, props, place
├─ being         living; maxHp, sight, level, body material flesh, occupies body
│  ├─ person     essential
│  ├─ creature   slime, beast, undead, golem (body material stone) …
│  └─ companion  airborne, essential
├─ plant         occupies soil (crops) or volume (trees); stages
│  └─ tree, bush, flowers, crop, stump
├─ terrain       occupies floor; no maxHp
│  └─ grass, dirt, path, cobble, sand, snow, ice, water, lava, floor, cave floor, ash, gravel, farmland, mud …
├─ formation     occupies volume; opaque; maxHp
│  └─ rock, cave wall
├─ structure     made; maxHp; makeup
│  └─ wall, door, fence, stairs, ramp, slab, bridge, roof
├─ furnishing    made; maxHp; makeup; portable when not placed
│  └─ chest, bed, workbench, forge, stove, campfire, lamp, sign
├─ item          portable
│  └─ tool, weapon, food, material, potion, book …
├─ region        derived (rooms) or authored (a map's named areas)
│  └─ room, area
└─ steward       nowhere; always live
   └─ story, world
```

- A wall can be carried: like Elin, a built wall is a thing you can pick up; set in a cell it
  occupies that cell's volume. Whether it can be carried is `portable`, not its branch.
- A site on the overworld (§5.6) is a thing too.

### 4.4 What every thing carries

| Field | From | Meaning |
|---|---|---|
| type | data | rules, defaults, makeup, stages |
| material | instance (type default) | category, hardness, durability factor, weight, value, attack/defence factors, fireproof |
| quality | instance | crude, common, fine, masterwork, legendary (existing) |
| `hp/maxHp` | type × material; current value on the instance | none: cannot be broken |
| `occupies` | type | spaces in its cell (§5.2) |
| `makeup` | type | what it is made of / leaves, with chances; plus the station that makes it, if any |
| capabilities and edge | type, instance | `tool:axe`, `tool:pickaxe`, `tool:shovel`, `tool:hoe`, `tool:sickle`, `tool:hammer`; edge `cut`/`blunt`/`pierce`/`dig` |
| support | type | `needs-support`; or `supports` with a radius |
| stages | type | time-staged change (§6.5) |
| tags, statuses, props | as today | statuses keep who gave them and their own pace (built) |

### 4.5 Materials

Elin's `SourceMaterial` has category, hardness, weight, value, attack/defence multipliers,
material elements, fire/acid proofing. Ours extends the 17 existing materials with:
category (wood, plant, stone, ore, metal, gem, crystal, soil, fibre, skin, bone, organic, flesh),
hardness, durability factor, weight factor, fireproof; and adds terrain and building materials
(granite, sandstone, oak, pine, earth, ice, flesh). Outputs keep their source's material: an
oak gives oak logs, oak planks, an oak chest, oak planks again when it breaks.

### 4.6 References

Every thing has an id; the only reference form is `{e: id}`. A thing in a cell space has an id
derived from its position and space (`ford:12,8,0:volume`). Whether it lives in a map's
static arrays or has been materialised into the save, rules and the AI see one thing with one
id; materialising it on its first change keeps the id.

As built (W2a): a map is still authored as one terrain per cell, the thing on top; the engine
(`cells.ts`) splits it into the cell's things — the floor, what roots in the soil (a stump), what
fills the volume (a tree, rock, a wall) — and gives a filled cell the ground most common among its
nearest standable neighbours. Each terrain is a type `tile/<id>` whose data says its space and
that it is drawn as the cell's ground (`terrain`); a thing so drawn makes up its cell, the rest
stands or lies in it (`placedAt`). The state keeps a cell thing from its first change, and one
destroyed as a record with no place; `state.tiles` and `{tile}` are gone, and so is `setTerrain`:
a host becomes another terrain by `transform`, and becoming a type whose space in its cell is
taken it gives way (rock becoming gravel where a floor is: the rock is gone). A cell as a role
(`tileOf:`, a put on a cell, a blow that meets no one) is what makes it up on top. Older saves'
overrides become cell things when each map's data comes; older rules' `setTerrain` is rewritten
on entering a library; the map builder clears the volume under a solid fixture set in rock.

## 5. Space

### 5.1 Two-level maps

- **The overworld** is an ordinary map: a continent (16 × 12 cells to start) ringed by sea.
  Overworld terrains: sea, plain, forest, hills, mountains, snowfield, road, river. Sea,
  mountains and rivers do not let one pass; fords and bridges do.
- **Each overworld cell holds a site**, a thing standing for its local map (40 × 30).
  Story places are hand-made (the Ford, Firstlight Village, the pasture, the forest, the
  foot, the east road, Emberfall, the pass…), placed at the offsets the
  world map already computes; every other cell is wilderness generated from its terrain.
- **Maps below**: caves, deep mine levels, the barrow, interiors hang below a local map and are
  reached through portals (D28).
- **Edges are open**: leaving a local map by any edge returns the traveller to the overworld,
  on that map's cell. No ring of rock bounds a map; rock is ordinary rock.
- **Entering**: on the overworld, empty hands on one's own cell (E) acts on its site, whose
  rule sends the actor a `push` to the local map; one arrives on the side one came from, or in
  the middle if one entered where one stood.
- **Barriers are mirrored (D22).** The Ford's goal is the far bank. With open edges one could
  leave west, walk round on the overworld and enter from the east. So the river is a barrier
  on the overworld too, and the Ford's cell is the only crossing: only someone already east of
  the river can enter the Ford from the east. Generally: where a local map's barriers split its
  edges into parts that do not reach each other, the overworld's links between neighbouring
  cells match them (checked, §10).

As built (W3): the overworld is the map `overworld`, 16 × 12 cells of 3 × 3 tiles each (a cell's
block), with `scale` 30 (a step lasts 30 minutes × its ground's `cost` × rain's), its grounds the
`ow_*` terrains. The hand-made maps lie on the cells their edge links give (`placeCells`), each
map's `site` naming its block; every other cell of land is a wilderness `wild.<x>.<y>`. A site
(`site/place`, `site/wild`) covers its block (footprint 3 × 3); empty hands on it push the actor
in (`site/enter`), anything else is out of reach (`site/far`, and the root of `act/use` on a
site). A map's **parts** (`World.partsOf`) are what one can reach inside it without crossing a
floor one cannot stand on (water, lava, void; breakable things do not part it); its block shows
each tile's part (`regionPart`), with river where parts would touch — so the overworld is an
ordinary map and its barriers are terrain: the Ford's block is west bank, river, far bank, and a
mountain range north of it and the river south of it run sea to sea. Walking out of a map's edge
(the player) lands on the tile of its block showing the same part, nearest where one left;
going in lands at the nearest place of the part the tile one stands on shows, nearest the point
it stands for (`Engine.enterFrom`). Portals between hand-made maps stay. A wilderness is made by
`wildChunk` (content `wild.ts`) from the world's seed, its cell and its ground (a recipe each:
plains, woods, hills, snow, road), with open edges; the client makes it when it is needed, and
on loading. A long step's time passes at once at the end of the tick (fast-forward); harm stops
it. People walking in from an edge come with W9.

### 5.2 Cells, height and occupied spaces

- A cell is `(map, x, y, z)`. Each map has a height map (ground level per column, up to the
  height parameter); the column below the ground is solid and is not a thing (§13: no digging
  into hills yet). Storeys stand above the ground, up to the storey parameter; only built
  cells are stored.
- **Occupied spaces.** Elin stores a cell as fixed layers (floor, block, obj, bridge, roof,
  deco). From first principles play asks four things of a cell: where one stands, whether one
  can pass, whether one can see through, and what may share it. The first three are
  properties; the fourth is exclusivity. So each type declares the spaces it takes in its cell:

  | Space | Taken by |
  |---|---|
  | `floor` | ground, slabs, bridges (what one stands on) |
  | `volume` | walls, rock, trees, doors (closed), stairs, ramps |
  | `soil` | crops, saplings |
  | `body` | beings that do not fly |

  **One rule: in a cell, each space has at most one occupant.** Items and most furniture take
  no space and just lie there. This also replaces today's three walkability special cases
  (actors block each other, airborne things block nobody, NPCs pass through each other to
  avoid deadlock): they become `body` plus data (a companion takes no space; crowds use an
  explicit `yield` behaviour).
- **Storage**: a map's static data is arrays per space (and the height map); a thing in a cell
  space whose state equals the static data is stored only there; on its first change it is
  materialised under its derived id and saved.

### 5.3 Cover

A cell is **covered** when anything above it occupies `floor` or `volume`. Cover is derived,
per cell. Rain and snow fall only on cells that are not covered (the `outdoors` condition
becomes per cell); under eaves, a bridge or a tree one is dry.

### 5.4 Regions and rooms

- **Regions are things** whose place is a set of cells. Authored regions are a map's named
  areas (`far_bank`, `yard`, `relic`); derived regions are rooms.
- **Entering and leaving** any region is the relation `in-region`; the relation difference
  turns it into `contact begin`/`end` for both sides. Scenes and story steps react to these
  events instead of polling conditions.
- **A room** (Elin floods out from a cell to walls and requires a door; RimWorld requires walls,
  doors and a roof, and picks one role): a maximal connected set of standable cells on one z
  that is enclosed (flooding cannot leave it) and covered. No door is required: a sealed
  pocket changes nothing in play. Flooding stops at the room-size parameter (larger is outdoors).
- **Room props (derived, read-only)**: size; roles as tags, any number (`role:bedroom` from a
  bed, `role:kitchen` from a stove or hearth, `role:workshop` from a station, `role:storeroom`
  from enough containers; the requirements are data); the set of owners of what is in it.
- **Recomputed** when an outcome changes what blocks, covers or occupies a cell, from that
  cell; the whole map on entering.

As built (W5, after W6: what covers a cell stands on a storey above it): `World.covered(map, x, y, z)`
is true where anything on a higher storey takes `floor` or `volume`, and everywhere on a map that is
not out of doors. The condition `outdoors` is per cell (the host's), and an emission may say
`{map: true, sky: true}`: only things out under the sky receive it (the rain rule uses it; under a
floor laid over walls one stays dry, req W11). `World.roomsOf(map)` floods each storey: a room is a
largest connected set of cells one can stand in, every one covered, that flooding cannot leave, no
larger than `params.roomSize` (256). Rooms are `region/room` things, found and not kept (`room.<z>.<x>.<y>.<map>`;
`World.get` resolves them; kept things come first); they are among the regions a cell is in, so
entering and leaving one is the `in-region` relation like any named area. Their shapes are cached
until a cell's spaces change (the whole map is flooded again, not from the cell); their roles are
read from what is in them each time, from `Ontology.roomRoles` (data: a bed makes a bedroom with
`rest` 1, cookware a kitchen, a crafting fixture a workshop, three containers a storeroom), with the
props the roles give (the largest wins). A bed taken hold of (`bed/sleep`) sends the sleeper
`restore {which: sleep}`; the new primitive `sleep` gives back the missing health times the best
`rest` of the regions it lies in (`params.rest` 0.5 elsewhere) and, for the one at the keys, passes
the time to `params.riseHour` (6) at once (the fast-forward, which harm interrupts, req W10). The
sleeper is `asleep` meanwhile (lying still), and hunger comes four times slower to one asleep
(`PeriodDef.paceBy`, after Elin, whose sleep advances the date and not the sleeper's turns): a
night costs about four points of twenty, and only an empty stomach is woken by hunger
(`tools/test/rest.test.ts`). Not yet: the owners of what is in a room,
and rooms on the overworld.

Hunger in two paces (2026-10-06, hunger.ts): fed, a point every 48 game minutes, full to six tenths
between meals (a meal, 8, fills it again); under six tenths one is `hungry` (the threshold line
`hungry`, `ThresholdDef.below` a share of another prop and `both` ways, rule `body/hungry`) and the
hunger period comes 7.5 times slower, so full to empty takes about three days. The paces of `paceBy`
multiply (asleep and hungry). A period on a host's own pace (`everyProp`, `paceBy`) comes on by its
progress (`Engine.progress`): the ticks gone by over its interval as the pace is now, carried over a
change of pace, so a change never brings the next one at once (on the clock's beat it fired at once
when a slower pace's multiple happened to be near); a jump of the clock catches up.

As built (2026-10-05): room shapes have a geometry version per map. Keeping a static cell's
changed state does not change that version. Each map counts upper-storey floor and volume
occupants, so an outdoor map without any returns no rooms without flooding. Roles still read
the room's contents on every query.
- **Read-only**: rules may host on rooms and react (`contact in-region`, `threshold gain/lose`
  with the role), never write them.
- Room quality (beauty, cleanliness) is later (D27).

### 5.5 Vertical movement

- On one z one walks; stairs and ramps join z and z + 1; a cliff edge cannot be crossed upward.
- **Any drop is a fall** (classic ledges are just short falls): fall damage grows with the
  drop above a safe height (a prop, defaulting to the parameter). Behaviour avoids unsafe drops.
- Pathfinding, sight and range include z; height blocks sight and gives reach.

As built (W2d): heights are a map's `heights` (one per column, in half levels: a level is two, a
ramp is a column between two levels; the chunk stores a digit per column). `World.stepOver`: a
step up or down of at most half a level is a walk; more up is a cliff (a bump into what makes up
the cell above); more down is a fall of that many levels, which hurts beyond the safe height
(`params.safeFall` 1, `params.fallDamage` 6 a level) as the faller's own blow (`Engine.fallBy`).
What flies neither climbs nor falls. Planning (A*) takes only walks and safe drops; ground higher
than both ends blocks sight. The high ground at the Mountain Foot stands two levels above its face of rock, the trail a
ramp. The renderer draws higher ground lighter, a lip and a rock face with its shadow where it
drops a level, a ramp's steps, and a durability bar over a struck cell or thing. z for storeys,
the `fall` primitive (support lost) and reach by height come with W6.

### 5.6 Sites, travel and the overworld's acts

- A site is a thing on its overworld cell. Its base rules: empty hands → `push` the actor into
  the local map; use, put, take → "too far to reach", no change (defined, not asked: the
  question would mix scales). No input is special on the overworld.
- A step on the overworld is an ordinary move whose **duration** (§6.11) is large: the
  overworld's scale × the terrain's cost × weather (road ×0.5; forest, hills, snow ×1.5; heavy
  rain or snow ×1.5; all data). Time passes by fast-forward; damage interrupts (Elin cancels
  the step and warns when health falls below a fifth).

### 5.7 Generation and persistence

- Hand-made maps come from `public/world`. Wilderness maps are generated from the world seed
  and the cell's coordinates, by a recipe per overworld terrain (written with the map builder
  DSL); the same seed and cell always give the same map.
- The save holds things that differ from static data, the clock, dormant inboxes and times.
  Nothing expires (unlike Elin's fields): what the player and the AI did stays. What should
  recover recovers by stages and the spawner, caught up on entry.

## 6. Systems

### 6.1 Instruments and efficiency

- What strikes is an **instrument**: the held thing, or else the striker's own body. Every
  instrument has capabilities and an edge; a fist is a blunt body of flesh.
- **Efficiency** is a data table, capability-or-edge × material category; an instrument takes
  its best row. Draft (calibrated in step 2 so that a stone axe fells a tree in two blows):

  | | wood | plant | stone | ore/metal | soil | skin/organic/flesh | bone | crystal |
  |---|---|---|---|---|---|---|---|---|
  | `tool:axe` | 1.0 | 1.0 | 0.25 | 0.1 | 0.25 | 1.0 | 0.5 | 0.25 |
  | `tool:pickaxe` | 0.25 | 0.25 | 1.0 | 1.0 | 0.5 | 0.5 | 1.0 | 1.0 |
  | `tool:shovel` | 0.25 | 1.0 | 0.25 | 0.1 | 1.0 | 0.25 | 0.25 | 0.1 |
  | `tool:hammer` | 0.5 | 0.25 | 0.5 | 0.5 | 0.25 | 0.5 | 1.0 | 1.0 |
  | edge `cut` | 0.5 | 1.0 | 0.1 | 0.1 | 0.1 | 1.0 | 0.5 | 0.25 |
  | edge `blunt` | 0.25 | 0.5 | 0.1 | 0.1 | 0.1 | 1.0 | 0.5 | 0.25 |
  | edge `pierce` | 0.25 | 0.5 | 0.1 | 0.1 | 0.1 | 1.0 | 0.25 | 0.1 |

- **Too hard** (Elin: `reqLv > toolLv`): an instrument whose material is softer than the
  target's does no damage; "too hard" is shown. Defined; never asked.

### 6.2 Damage channels

`damage = power × efficiency − defence` for a blow. Every channel reaches every thing with
`maxHp` (D7): a blow; an element (a burning thing loses durability on each pulse; fire on
wood); a fall (the drop); a collapse (the faller and what it lands on); being crushed. What
fire leaves is each type's own (Elin: a tree becomes a burnt tree, a wall a burnt wall).

### 6.3 Breaking

As built (W2b): materials are world data (`Ontology.materials`: category and hardness; the item
materials gained both, and flesh, plant, gel, earth, ice, ore were added); a thing's material is its
`material:<id>` tag or its type's `material` prop. The efficiency table is `Ontology.efficiency`
(rows `tool:<x>` and `edge:<x>`), the recovery rate `Ontology.params.recovery` (0.5). The root
strike (`core/strike`) on anything with `maxHp` is `hurt {blow: true}`: the instrument (what struck,
else the striker's body) times its best row; softer than the target, "Too hard." and nothing.
`hurt` does nothing to what has no `maxHp`. Burning wears what has durability (`fire/wear`, and the
spreading rules wear too); `fire/scorch` merged into it. The root of `broken` is `core/break`;
`breakdown` makes the parts (popping out for the magnet, in the host's material) and spills what
it held, on the host's storey where another floor holds them, else on the first floor below (a
floor that broke leaves nothing to lie on). `transform` gives the new form its full durability.
Trees (10: a stone axe, two blows, notched between), pines, bushes, rock (10), cave walls, stone and wooden walls, roofs, stumps,
charred trees, boulders, veins and the breakable containers have durability and makeup; the
pickaxe's endless `mine/chip` and the counters `mine/crack`, `mine/vein`, `mine/rock` are gone. A
burning wooden wall wears and stands black (`burnt_wall`). Bodies took their blows apart (`combat/struck`) until W8; now as anything with durability (§6.8).

At 0, `threshold/cross` `broken` (for every thing), resolved by the most specific rule:
1. a type's own rule (a tree becomes a stump and drops logs; a person goes down; a sin falls);
2. otherwise the root: `breakdown` — its makeup × the recovery rate (with chances; at least
   one of each part made by a recipe), in its material; what it holds spills out; it is removed;
3. a thing with neither makeup nor its own rule: undefined, asked; by default removed.

### 6.4 Makeup, recipes, recovery

- One relation, `makeup`: what a thing is made of, which is also what it leaves. A tree is
  logs and a stick; a slime is gel; a boar is raw meat and hide; a chest is planks. What a
  creature carries is not makeup; it spills as contents (loot is contents).
- A thing whose type names a **station** (`hands`, or a station capability such as
  `station:workbench`) is craftable from its makeup; recipes are derived from all types (Elin
  `RecipeManager.BuildList`). `content/src/recipes.ts` and `construction.ts` become derived.
- **Recovery rate**: one world parameter, applied to every break (D9, D23).
- Crafting (`act/craft`, built): the product's material is the main ingredient's; quality from
  the crafter's level against the recipe's; ingredients' tags and props pass on (food effects).
- A **station** is any placed thing with a station capability; the C panel is the `hands`
  station.

As built (W4): a type's `station` (`hands`, or `workbench` …: a thing within reach tagged
`station:<x>`) and `makeup` make its recipe (`deriveRecipes`, engine `recipes.ts`); content's
`RECIPES` is that list for its own types, and the engine derives the same from whatever types it
holds (a patch's new type included). The first part of the makeup is the main ingredient: what
is made takes its material (basic materials carry a `material` prop), a quality by how far its
maker's level is above the recipe's (`Ontology.qualities`: crude below, fine from 3, masterwork
from 6; legendary never by making), and its power from form, material and quality; its name is
made from them ("Fine Wooden Shield"). The first tools are made at hand, a shield, a club and a
bow at a workbench (one stands in Firstlight Village). Chests, campfires, signs and fences have
durability and makeup. Checks: build and break back (every building returns no more than went
in), the economy (no step, and no two steps in a row — recipes, breaking down, an item a rule
turns into others — make more of a thing than they took), and reachability (every recipe's and
building's needs from the world as it starts and what it yields, without the AI). Not yet:
building as moving a carried thing into a cell (furniture and walls carried and set down) — it
comes with W6, with the walls and floors it is for; the B palette's frames stay meanwhile.

As built (2026-10-05): makeup and recipe ingredient counts are positive safe integers.
Probabilistic recovery uses the separate `chance` field. Patch validation checks inherited
makeup too, and crafting refuses an invalid ingredient count before consuming or producing
anything.

### 6.5 Stages and harvest

- **Stages** (Elin `GrowSystem`, generalised): a list of stages, each with a duration and
  conditions (watered, light, warmth), what it becomes at the end, whether it can be harvested
  and what that yields, and where harvesting returns it.
- Driven by timers, so dormant maps catch up on entry. One mechanism for crops, trees, bushes,
  a stump growing back, eggs hatching, food spoiling, iron rusting, a campfire burning out;
  today's scattered timers (`wood/regrow`, `animal/lay-egg`, thin ice) move onto it.
- **Harvest** (empty hands or a sickle) takes the yield and leaves the plant at its return
  stage; felling or digging is breaking.

As built (W7): a type (or terrain) carries `stage: {into?, lasts?, clock?, needs?, wait?, yields?, fx?}`
(`StageDef`, inherited like makeup). A thing that comes to be of such a type (`World.add`,
`World.transform`) starts its clock, the status `stage` for `lasts` ticks, unless the stage's clock
is another status, given by what gives it (a crop moves on when its `watered` runs out). The root
of `time/timer` is `core/stage`, the new primitive `grow`: when the stage's clock runs out, a
condition the stage `needs` (on the host: light, nobody standing on it) unmet makes it wait `wait`
ticks and look again; met, it leaves its `yields` where it is (still, taken with F) and becomes
`into`, or begins the stage again when there is none (a hen lays every three hours). A map's own
things in a stage start their clocks when the map comes (`World.startStages`). On it now: stumps
and saplings (into a tree in two game days, out under the sky, nobody on them), crops' sprouts
and young plants (clock `watered`, out under the sky: a crop in a room waits, req 16), thin ice
(clock `chilled`, into water), hens (an egg). Gone: `wood/regrow`, `farm/grow`, `farm/root`,
`animal/lay-egg`, `frost/thaw` and the statuses `regrowing`, `rooting`, `laying` (an old save's
become `stage`). Harvest stays the crop rules' (the plant's props name yield, seed and the stage it
returns to). Not yet: food spoiling, iron rusting, a campfire burning out, eggs hatching (each is
now a stage in data).

As built (2026-10-05): a timer carries its scheduled deadline. Repeated stages, waits and
transformed stages start their next clocks from that deadline. Entry processes newly due
clocks in time order, finishing each outcome before choosing the next, even when entry comes
from a queued event. Catch-up stops at the engine's event budget; clocks still due stay for
following ticks. Dormant maps still do not run continuous behaviour.

### 6.6 Building

- A buildable thing has `occupies`; putting it on a cell moves it there (the existing `move`
  primitive; the host is the thing itself, so A3 holds). It is the same thing, now in a cell.
- Valid when its spaces are free in the target cell and, above the ground, it is supported.
- Furniture is the same with no space taken; in a cell it offers sleep, craft, toggle; in a hand
  or bag it does not (no separate install state).
- Dismantling is breaking (a hammer's efficiency on what it is made of), returning makeup ×
  the recovery rate.
- The B palette lists derived buildable recipes; `engine/src/placement.ts` keeps planning.

### 6.7 Support and collapse

- A type may `need-support`, and may `support` within a radius (data). Support is a relation
  (`how = support`), recomputed by the relation difference.
- A thing that needs support and has none is notified (`contact end`, `how = support`); its
  root rule sets its durability to 0, so it breaks, falls and strikes what is below (D24).
- Slabs, roofs, hanging lamps and furniture upstairs all behave the same.

As built (W6, before W5: cover needs what stands above): a place on a cell has a storey `z` (0 the
ground's; `params.storeys` 4 above it); spaces, exclusivity, walking, sight of bodies and relations
are per storey. Built things are `structure/*`, carried (portable) and crafted at hand from
planks: a wall (fills the volume, `supports` 2), a floor (`needsSupport`), stairs. Building is
putting one on a cell: it comes to rest on the lowest storey from the one aimed at where its spaces
are free and it is held (`World.settleZ`) — a wall on the ground, a floor laid over a wall above it
(something put on a built thing goes on top of it, `build/stack`); picked up again like anything
carried. A floor relates `support` to what holds it (walls on the storey below within their
reach; the map's walls hold too). Walking: on a floor one walks; from stairs onto the floor above
them; onto stairs from above them; off a floor's edge one falls to the first floor below. The
root of `contact/end on` is the new primitive `fall`; a floor whose last support goes
(`build/collapse`, the new condition `rel`) breaks, and what stood on it falls. The relation
difference reaches every storey of a touched cell and whoever relied on a thing gone. The client
draws a storey raised, things set in a cell as part of the place, and fades what stands above the
player near them. Not yet: the overworld's and paths' z, and roofs drawn as roofs.

Storeys as built further (2026-10-05, tried with the pack's tiles before it was drawn): a wall
or a door set on a wall stands on it, so walls stack into a taller wall with no floor between;
the inputs meet only what is on the player's own storey (Controls.layers).

What one reaches across storeys, and where a built thing goes (2026-10-05): docs/building.md.
In short:
- Each storey builds its own: one reaches its floor, its volume, and its ceiling (the floor of the
  storey above), and nothing else.
- The ceiling is reached only when chosen.
- A thing never searches up or down for room.
- A floor laid on the ground covers it.
- The open air above the ground is reached as the ground is.

Blocks and stairs redesigned (2026-10-05, after RPG Maker, Stardew Valley and RimWorld, every case
drawn first): one projection for everything — a point h storeys up is drawn h tiles above where it
stands, a storey one tile high as a cell is one tile deep — and drawn by the row, then the storey.
- A block (a wall, a door, stairs) shows its front in its cell (where nothing stands south of it)
  and its top a tile up (where nothing is built on it). A wall's top is its cap, a dark mass rimmed
  where no wall is beside it (RPG Maker's ceiling), never mistaken for a floor one walks on. A door
  in a wall that runs east-west is its front; in one that runs north-south it is seen from above
  (the sill, the leaf along the wall's line or swung open).
- A floor laid a storey up lies where the tops of the blocks under it are; under a south edge
  nothing holds up (a balcony) its thickness shows.
- Stairs are a block a storey high whose top is steps, set before what is a storey up, going up
  their setter's facing (R in the palette turns them). One walks onto them from the front or a side
  (half a storey: drawn half a tile up), never from behind (their high end is a storey of block, and
  one does not walk off it onto the ground behind either), and, on them, on the way they go up onto
  the floor a storey up;
  from that storey onto them, half a storey down, and off. They keep the storey over them open: a
  floor set on their cell is laid a storey higher (a roof), and in a room, stairs going up through
  the hole are the room's own.
- What hides the player is see-through, all of it (Stardew): a wall or a floor drawn in front of
  them over their body, and the run it belongs to (a wall's along its row and up and down what is
  stacked on it, a floor's along its row); a see-through wall shows its front faint and no top. In a
  room, its south wall (the camera's side) is see-through so, and what is above the room is not
  drawn (RimWorld, The Sims).
The art is the project's own (tools/src/art/structures.ts: the pack has walls only as whole houses
and stairs only as icons).

The build palette (B) sets things down as G does (2026-10-05): walls, floors, stairs, doors, beds
and workbenches — one carried, or with none, one made from what is carried first
(`Controls.previewPlace`, `Controls.place`; the palette never moves a pointer beyond reach
nearer) — beside the placement recipes (a campfire built from stones and sticks, a chest, sowing).
Held and dragged, the left button sets one in each cell it passes. A recipe may need a tool
carried, not used up (`TypeDef.tools`), and make more than one (`TypeDef.yields`): a log splits
into two planks with an axe at hand, in the crafting panel ("All" splits every log).

As built (2026-10-05): when a landing cell is occupied, `fall` searches for a free cell on
the landing storey and retains that storey. Damage uses the actual drop to the chosen landing.

### 6.8 Combat

- One durability and damage model for all things; material and quality enter attack and
  defence (weapon power × the material's attack factor; armour × its defence factor).
- The talents already built (dodge, criticals, bleeding, drain, adrenaline, phoenix) stay.
- Elements and resistances are data: each element names its resistance prop.
- Element side effects stay physics rules (Elin hard-codes them in a switch).
- Death is `broken`: `essential` beings go down; others break down into their makeup and spill
  their contents (D9). Throwing is later.

As built (W8): a material carries `attack` and `defence` factors and a quality a `factor` (Elin's
material atk/pv and rarity: crude 0.8, fine 1.25, masterwork 1.5, legendary 2); a made or found
thing's power and defence are its form's times both (`gearProps`, used by `madeOf` and the item
catalogue alike: an iron sword 6, a wooden one 3, a fine iron one 8). Armour and clothing are
`wearable` with a `slot`: put on oneself (right click on one's own place) they are worn — the
actor's `body/wear` on the `offered` impulse runs the new primitive `wear`, which keeps the
thing's id in the actor's `wear:<slot>` prop (one to a slot; put on again, it comes off; given
away or dropped, it no longer counts). `World.stat(e, key)` is a stat as it stands: the thing's
own number, what its statuses add while they last (`StatusDef.props`) and what it wears adds;
attack (`atk`), defence (`def`) and resistances read it. Elements name their resistances
(`Ontology.resistances`: fire `resFire`, …, in percent; at 100 none of that harm, below 0 more);
harm done in answer to an element is that element's. The herbalist's draught is a status that
adds `resFire` 75 (the engine's special case for it is gone). A body takes a blow as anything
with durability does (`hurt {blow}`: what struck on what it is made of; bodies are flesh), and
at no health breaks down into its makeup lying still (a cow four raw beef, two left; a hen two
raw chicken) and spills what it carried (the cyclops's hoard of ore); the `drop`/`drops` props
are gone. Req 17. Element side effects stay rules (`element/actor`). Not yet: shields that block,
armour that wears out, what a worn thing looks like on its wearer.

The body's slots (2026-10-07): **head** (helmet, hat), **body** (breastplate), **feet** (boots), **hands**
(gloves), **waist** (belt), **shoulders** (pauldrons, cloak), **neck** (amulet), **ring** ×2 (rings, a wedding
band), **ear** (earring), and the off hand (**arm**: the warrior's shield). A kind of slot there are more of is
data (`params.slotCount`: `ring: 2` → `wear:ring`, `wear:ring.2`; a ring goes on the first free, else the
first). Rings add `atk` 1, an amulet `def` 1, an earring `xpRate` 0.1, a belt and pauldrons `def` 1. The frame
carries what is worn by slot (`player.worn`); the bag shows it as a paper doll beside the grid
(`tools/test/equipment.test.ts`).

As built (2026-10-05): a ranged blow checks blocking from the first cell ahead, on the shooter's
storey. An adjacent wall stops the ray and receives an unaimed blow through its own rules.

### 6.9 Weather and the world's appearances

- One world primitive, `appear`, for everything that appears by time (merging `forage` and the
  night spawner): what (weighted types), on which spaces and terrains, when (hours, weather),
  how many at most, how far from the player. Data only.
- Periods (hunger, vitals, weather, storm, night, dawn) stay data.

As built (W7): `AppearDef {types (weighted), on?, max, every, ring?, hours?, weather?, where?, tag?,
ai?, statuses?}`; a map's own in `MapData.appear` (an older chunk's `forage` is read as it), the
world's in `Ontology.appear`, each fitting the maps its `where` names (zone, light). One period,
`appear` (every 30 ticks), runs the primitive `appear` on the active map: every appearance whose
`every` divides the tick, at its hours and weather, adds one of its types on a free cell of its
ground — in its ring around the one at the keys, or anywhere not within two of them — unless
`max` are there (counted by its tag, else its types); a creature comes with its behaviour, at home
where it appears. The night's walkers are the world's one appearance (combat zones out of doors,
21–5, six to ten cells off, four at most, tagged `nightborn`); `forage.ts` and `nightspawn.ts` are
gone, and an older rule's `forage` or `appear {types, ring, cap, tag}` is read as the new one.
Reachability with renewables (`economy.test.ts`): from what appears by itself, the wilderness's
things and grounds, and every stage on a cycle (a stump to a tree, a seed to a plant that gives
seed, a hen), every recipe's and building's input comes back without end.

### 6.10 Behaviour

Elin gives every character one goal system (`AIAct`: combat, sleep, work, hobby, idle…). Ours
today has four (`npc.ts`, `creatures.ts`, `companion.ts`, `bosses.ts`). They become one:

- **Goals by priority, ordered by data per type**: needs (hunger, sleep); threat (fight or flee,
  by hostility and temper); schedule and work; follow (a leader); encounter moves (telegraphed
  skills); patrol and home; idle use of what is near (sit, warm oneself).
- Every goal is carried out with the same acts as the player's and moves. **Work is real**: a
  woodcutter fells trees with an axe, a farmer waters with a bucket, a cook cooks at a stove.
- Every goal that cannot go on reports `stuck`.
- Relations are per pair and come from what each saw; factions, temper, foes stay data.
- People change maps by their schedules (D21).

As built (W9): `behaviour.ts` is the one system. Every tick, each actor on the active map but the
one at the keys (and each companion, wherever its leader went) tries its goals in its order —
its type's `goals`, else the world's (`Ontology.goals`), else encounter, threat, follow,
schedule, home, idle — and the first that applies takes its turn: encounter (a sin's telegraphs,
`bosses.ts`), threat (fight what it is hostile to in sight, or flee it if passive; a person runs
from what would attack them), follow (a companion), schedule (a person's day), home, idle. The
paced goals wait for the actor's cooldown and for it to be free; a scene keeps the people on
stage. The four loops are gone (`stepCreatures`, `stepBosses`, the people's and the companions'
own), each controller a goal now; the people, creatures and sins behave as before (the playtest
keeps the same days to the person). Work is real: a schedule entry's `work` (`WorkDef`: a verb, a
target selector, what to hold, a radius about the anchor, a condition on the worker) makes the
person do the player's own acts on the nearest thing that fits — Gus, the woodcutter, takes the
logs about the forest clearing and fells its trees with his iron axe in the morning (carrying no
more than six logs), and in the afternoon stacks them on the village's wood pile (a container
anyone may take from); the stumps grow back (§6.5). People bound for the active map come in on
the hour by the edge or portal of the last map on their way (D21), and walk on from there (req
14). The playtest (`check:world`) now stands in the village and counts the people on or bound
for the active map (0 of 324 off their day over two days); a dormant map's people are frozen by
design, so the old count of everyone (87 of 576 from the village) is printed beside it. Not yet:
needs (hunger, sleep) as goals, idle use of what is near, patrols, per-pair relations from what
each saw.

As built (2026-10-05): the world indexes companion ids when things are added, destroyed or
loaded and when their own `companion` prop changes. Dormant companions take their turns in
the same entity order without a scan of dormant items each tick.

### 6.11 Durations and fast-forward

- Every act has a duration: a move takes the actor's step time × the terrain's cost × the
  map's scale; a sleep lasts until it is time to rise; crafting and waiting have theirs.
- When the controlled actor is engaged in an act that far outlasts real time (an overworld step,
  sleep, a long wait), the engine fast-forwards: it runs the ticks without waiting for real
  time. Hunger, statuses and periods happen by their ordinary rules. Damage interrupts.
- If the tick loop proves too slow for long sleeps, things with no behaviour catch up in
  closed form (CDDA's `actualize`), still raising their events.

### 6.12 The story's script

Scenes (taking control), beats (not taking control), quests and objectives become one script:
**steps** with triggers (conditions or events such as `in-region`) that may take control,
whose effects are the story's own props or events sent to others; and **objectives** (quests,
guides), which are story props plus how they are shown.

As built (W10): `story.ts` is the one script; `scenes.ts` and the companions' beats are gone. A
`StepDef` has a trigger (`StepCond`: the leader's map, region, stage props, what they carry,
skills, what stands near; the story's facts; the hour and weather; another step played), may be
`manual` or `repeat` daily, and may carry a `script` (it takes control: a scene), facts, stage
props it tells the leader, and the companion's line and hint (a beat). The index carries `steps`
(the prologue's beats, then the scenes); a step plays once, recorded as `seen.<id>` (the tick; a
repeating one also `seen.<id>.day`; a beat also `step.last`, whose hint the companion repeats);
`seen.` is protected for every step now. A step with a region is looked at when the one at the
keys enters a region and as a step plays — never polled (a beat with a region too: the prologue's
test walks into the relic's ground instead of being set down in it); the rest every three ticks,
one step at a time, the beats first. Guides (the objective by stage, `@objective`) and the hint
(`@hint`) are the story's; quests keep their own lifecycle in the story's facts (`quests.ts`), the
objectives with a giver. An older save's `beat.<id>` facts become `seen.<id>`, `beat.last`
`step.last`. The prologue and the quests play as before (P1, P3, P4, Q1–Q5). Not yet: one view of
all objectives (the quest log and the guide are shown apart).

## 7. The event model, extended

- **References**: `{e: id}` only; derived ids for things in cell spaces (§4.6).
- **Kinds**: unchanged. `contact` gains `how` values `in-region` and `support`.
- **Condition `rel`**: whether the host has a relation now (`support`, `on`, `in-region` …).
- **Conditions on named things**: a condition may read a named thing's prop
  (`{prop: {role: 'story', key}}`); `fact` becomes this.
- **New primitives** (each writes only its host): `fall` (drop to the first thing that holds,
  striking oneself by the drop) and `breakdown` (§6.3). `setFact`, `addFact` and `topic` become
  the story's or the world's own `setProp`/`addProp`. `forage` and `appear` merge (§6.9).
  Building uses `move`; entering a map uses `push`.

**Root defaults** (they replace the matching rows of design.md §5.9):

| Event | Host (data) | Root outcome | Asked |
|---|---|---|---|
| `impulse/strike` | has `maxHp` | durability falls by the damage (§6.2); too hard: nothing, shown | no |
| `impulse/strike` | no `maxHp` | undefined; default nothing | yes (repeat check) |
| `impulse/element` | has `maxHp` and the element harms it | existing physics, plus durability loss | no |
| `threshold/cross broken` | `essential` | down; comes to | no |
| `threshold/cross broken` | has `makeup` | `breakdown` | no |
| `threshold/cross broken` | neither | undefined; default removed | yes |
| `act/put` | the host has `occupies`, its spaces are free and it is supported | `move` into the cell | no |
| `contact/end how=support` | needs support, has none | durability to 0 (collapse) | no |
| `contact/end how=on` | not airborne, nothing beneath | `fall` | no |
| `time/*` | a stage ends | the next stage | no |
| any event | `derived` | may react and emit, never write itself | no |
| `contact in-region`; a room's `threshold` | regions, things entering them | no change | no |
| `act/hands` | a site | `push` the actor into its map | no |
| `act/use`, `act/put`, `act/take` | a site | "too far to reach", no change | no |
| `stuck` | a being | undefined (existing) | yes |
| everything else | — | as today | as today |

## 8. The AI interface

1. **The request** adds the host's occupied spaces, z, material (category, hardness),
   durability, makeup, stages, room and region; related rules add the type's `broken` rules,
   its recipe and its stages. The scenario snapshot adds heights, spaces, z, regions and rooms;
   the sandbox replays vertical and room events.
2. **One question per hole and class**; a class is a type, never a material.
3. **A type the AI creates** (the router's create step) must name: its parent type (defaults),
   occupied spaces, material category, `maxHp` or that it cannot be broken, makeup (and
   station), capabilities and edge, support needs, stages (optional), and its picture. Missing
   any, the validator refuses it. AI-made things are therefore breakable, dismantlable and
   craftable from birth and open no "what does it leave" holes.
4. **The validator** adds:
   - **the repeat check**: the triggering event replayed N times in the sandbox; if the host
     neither changes nor is used up and the expected yield is above zero (chances count), the
     patch is refused as an endless yield;
   - **the economy check**: a new type's recipes, makeup and yields join the consumption graph
     (§10), and a cycle with a net gain that takes no time is refused.
5. **The ModSpec** documents spaces, z, height, cover, regions and rooms (read-only),
   materials and the efficiency table, instruments, durability, `broken`/`breakdown`, makeup
   and recovery, stages, support, `fall`, `rel`, conditions on named things, the story's props
   in place of facts, sites, and that collapse, falls, stages and room changes are never asked.
6. **Live and offline** keep their pipelines; derived tests follow the new scenario format and
   include the repeat check. Measure the live profile with `npm run latency`.
7. **Old patches**: patches using `setFact`, `fact`, `kind` selectors or `{tile}` refs are
   rewritten automatically; those that cannot be, and those that fail the repeat check (the
   stick farms), are listed for the user before removal.

As built (2026-10-05): the repeat check explores both possible outcomes of each reached
chance condition, emission and breakdown fraction, with a stable assignment per site across
replays. It discovers sites depth first and checks at most 64 assignments. An endless yield
refuses the patch; unexplored assignments at the limit also refuse it with a diagnostic that
safety could not be established. Chances of zero or one have only their possible outcome.
The triggering replay uses that assignment too, before the same 12 repeats and 4-event tail.
A scenario names a thing under the top of its cell by its space (`tile:x,y:floor`), so a request
about the floor under a tree replays on that floor. People yield to each other by a swap that is one step: the
one pushed makes way first, and the pusher steps in only if it has gone. A cell holds one body
(`World.fits` no longer lets people pass through people), and a thing that falls onto a body
comes to rest beside it. Saves keep the migrated cells of maps not yet entered (`legacyTiles`,
`reseed` in the state).

As built (2026-10-06): the repeat check is **exact**, not sampled (`yieldCycle`, `whyEndless`). After each
replay it keeps the state of the event's participants (type, props, statuses, tags, place; what
they hold aside). When a state comes back, the replays between are a cycle that can go round for
ever: endless if it made anything, and the refusal names the cycle ("every 2 replays come back to
where they began and make 2 things"). When the host is used up, or the replays settle making
nothing, it ends. A store that keeps giving without coming back (charges counting down) passes
while it gives at most 64 (`YIELD_MOST`); a bigger one must come back over time. So a bush picked
twenty times passes (it was refused after twelve), and a thing that turns into another and back,
a stick each way, is caught. It still runs under every outcome of the chances reached. Beside it,
**every chain ends** is proven on the scene (`chainLoop`, design.md A7): the event and all it sets
off are followed through the ticks they wait, and an event that sets off, by way of its own
outcomes, the same event on the same world again is a loop. The refusal is the round, parent to
child; a chain still going after 50 ticks or 1,500 events is refused too.

As built (W2c): the repeat check is `endlessYield` (engine `sandbox.ts`): the triggering event
replayed 12 times with no time between; if its host still stands and any of the last 4 replays
made a thing, the patch is refused. It applies to what someone can repeat at will (acts, impulses,
contact, bumps, being seen); the clock's events wait on time, thresholds on a change, broken content
is reported once. The whole base library passes it (a test sweeps every input on everything the
player can face); fishing now stirs the water (`stirred`, a status that runs out). A new type with
`maxHp` must name a known `material` and a makeup (or a rule of its own on `broken`); the request
carries each role's material and makeup. `npm run modder -- library audit [--data <dir>]` lists the
stored patches that make something from nothing, for the user to remove (`library remove <id>`);
nothing is removed automatically. The economy check (consumption graph) and reachability are W4.

As built (2026-10-05): **the economy check** runs in the modder's validation (`modder/src/economy.ts`).
Every conversion is a step (a derived recipe, a thing broken into its makeup, one leaf of a rule
that uses up an item or takes one into the host); a mix of steps x_j in [0, 1] that leaves no thing
fewer and some thing more is a free lunch. That is a linear programme (x = 0 is feasible, so a
one-phase simplex): a patch is refused when its steps make one that the world's steps alone do not,
and the refusal names the steps and what they make. With one input and one output per step this
is currency arbitrage (a positive cycle); several in and out need the LP. Chance counts by
expectation: a branch on `chance` gives its odds' share, a part that breaks off by chance its share
too, so a lottery that loses on average is no free lunch and one that wins on average is (the
repeat check, which has no cost to weigh, forces every chance instead). A condition on the state is
the player's choice, so each way of it is a step of its own. When there is no free lunch, the
simplex's dual gives the proof: prices, each at least 1, under which no step gives more value than
it takes. The base content has none, and its prices check (any length; tools/test/economy.test.ts;
the simplex against strong duality, Chvátal's degenerate example and Bellman-Ford in
modder/test/economy.test.ts). **A type the AI creates** names `props.material` and a
makeup (a breakable one may give a rule of its own on `broken` instead), and never a new ground
(`tile/*`); one with a station is craftable as soon as the patch applies.

As built (2026-10-05): the economy extractor expands type and tag host classes and counts
non-item hosts that are used up. A consumed host and the known responses to its emitted
impulses form one conversion, including further emits and their odds. Receive conversions
stay with their sender's cost. A durable type's break step follows its own `broken` response
before the makeup fallback. Validation rechecks an existing conversion when a new receiver
changes it. Dynamic counts or receivers, recursive chains, state-dependent primitive yields
and paths beyond the extraction bound produce warnings rather than a claim of complete
coverage. The clock's `grow` primitive is not expanded into free sources. The simplex balances
the programme's units and checks both its mix and dual certificate against the original
constraints with relative tolerances. Numerical uncertainty is a validation diagnostic.

## 9. Holes after the change

What remains for the AI is what needs invention:
- combinations no rule covers (a held thing on a target);
- what a thing with no makeup leaves when it breaks;
- what happens when something unbreakable is struck;
- `stuck`, witnesses' reactions, broken content.

## 10. Completeness

### 10.1 A1–A7

| | Argument |
|---|---|
| A1 the state is closed | things and the clock (§3); relations, cover, rooms are derived; engine-internal records are not world state |
| A2 only outcomes and the clock change it | every mutator (cells, materialising, props of the story and world) is behind the writer; static map data is written only by the author while loading or generating; fast-forward is the clock; the writes scan covers the new mutators and the client |
| A3 an outcome writes only its host | a cell thing writes itself; building is a thing moving itself; `breakdown` spawns; collapse reaches what is below by a strike; `fall` writes the faller; story and world write their own props; derived things write nothing |
| A4 the relation difference after every outcome | extended to on/under with z, support, in-region (authored areas and rooms), cover; the whole map on entering |
| A5 a thing's own changes are events | `broken` is declared for every thing with durability; statuses of cell things are events; stages run on timers |
| A6 every event reaches one leaf | every type descends from `thing`, whose root rules answer every kind with no `inherit`; new rules pass the tie check |
| A7 every chain ends | collapse is bounded by the depth bound and lowers or removes something each step; falls are bounded by z; flooding by the room-size parameter; fast-forward by the act's duration |

### 10.2 Checks (tests)

| Check | What | |
|---|---|---|
| root total | every root kind answered by `thing`, no `inherit`, including the new `how` values | extended |
| no ties | base and story rules | as today |
| writes only through the writer | cells, materialising, story/world props, fast-forward, the client | extended |
| state is things and the clock | a whitelist of save-state fields | new |
| no kinds | no `kindOf` in the engine or content, no `kind` in type data; selectors use type nodes, tags, props, statuses, places | new |
| no map-type branches | no engine branch on the overworld or any map type | new |
| one reference form | every host and role is `{e: id}`; every derived id resolves to one thing, the same before and after materialising | new |
| exclusivity | at any time each space of each cell has at most one occupant | new |
| every channel reaches every breakable type | for each damage channel and each type with `maxHp`, the root lowers durability | new |
| every breakable type has an end | makeup, its own rule, or an explicit hole on a list | new |
| build and break back | for each buildable type: build, place, break; what returns ≤ what went in, material kept | new |
| economy | recipes, breaks, harvests, spawns form a graph; no cycle without time yields a net gain (chances by expectation) | new |
| reachability | without AI, from the initial world plus renewable sources, every recipe's ingredients can be had and every buildable built | new |
| no endless yield | every base rule: an event repeated on an unchanged host yields nothing in expectation | new |
| edges | every edge of every local map leads to its overworld cell | new |
| mirrored barriers | each local map's edge parts match the overworld's links | new |
| deterministic generation | same seed and cell, same map; a save of only changes reloads identically | new |
| every goal reports stuck | each behaviour goal that cannot go on raises `stuck` | new |
| parameters | every parameter (§11) is read from world data and appears nowhere as a literal | new |
| playable without AI | the three ways across with AI off; plus building a home, sleeping, travelling the overworld | extended |
| the demo is minimal | every new element witnesses a requirement (§10.3) | extended |
| coverage | targets include every cell type, rooms, sites; holes move from "a blow" to "what is left" and combinations; milestone numbers in roadmap §3 | extended |
| inputs complete | design.md §5.2's proof, with sites | extended |
| determinism | same save and inputs, same world, fast-forward included | extended |

### 10.3 New demo requirements (each checked on the real maps)

1. A stone axe fells a tree in two blows; it becomes a stump and drops logs.
2. A wooden tool on rock: "too hard".
3. A pickaxe breaks rock and returns stone.
4. Mining through the rock at a map's edge, one walks out onto the overworld.
5. An overworld step passes time; hunger falls; damage interrupts.
6. The river is a barrier: only the Ford crosses it.
7. A generated wilderness, left and re-entered, is the same map with one's changes kept.
8. Height: up and down a ramp; a drop hurts above the safe height.
9. A derived recipe made at a workbench; material and quality inherited.
10. A covered, enclosed room with a bed becomes a bedroom; sleeping there restores fully.
11. Rain does not reach covered cells.
12. A second storey reached by stairs; removing its support collapses it.
13. A burning wooden wall loses durability and leaves a burnt wall.
14. A person does real work (the woodcutter fells a tree); people walk in from an edge.
15. A story step triggered by entering an authored region (no polling).
16. A stage waits for what it needs: a watered sprout under a roof does not grow, one out under
    the sky does; a felled tree's stump grows back, but not up through someone standing on it.
17. A thing's material and quality make its power and defence; armour put on oneself takes a
    share off every blow; what resists an element takes its share of that harm away.

## 11. Parameters (world data)

Height levels (3); storeys above ground (4); support radius (4); room size (256 cells); safe
fall height; recovery rate (0.5); overworld step (30 minutes) and terrain/weather costs;
repeat-check count (5); fast-forward threshold; the efficiency table; material table; damage
interruption threshold. Values in brackets are the starting values.

## 12. Implementation order

Each step: typecheck and the full suite green; `check:world`; its checks from §10 as tests;
the coverage baseline refreshed and its numbers in roadmap §3; the new play walked through in
the browser.

| Step | What | Demo requirements |
|---|---|---|
| W1 State model | no kinds for things off the grid (beings, items, furnishings, stewards); facts, topics, scene, weather, memories onto things; the invariant detector's record; regions as things with `in-region` | 15 |
| W2 Space and breaking | occupied spaces, z, height, cells as things with derived ids, materialising, one reference form (`{tile}` and the last kind go); durability, materials, instruments, efficiency, every damage channel, makeup and recovery, `broken`, `breakdown`, `fall`; migrate trees, walls, rock, stumps, veins, breakable fixtures; old patches cleaned; renderer: cell things, cliffs, durability bar | 1, 2, 3, 8, 13 |
| W3 Two-level maps | overworld, sites, open edges, durations and fast-forward, wilderness generation, changes-only saves, people entering from edges, mirrored barriers | 4, 5, 6, 7 |
| W4 Makeup and recipes | stations, derived recipes, quality and material inheritance, building as `move`, economy, reachability, build-and-break-back | 9 |
| W5 Cover and rooms | | 10, 11 |
| W6 Storeys | slabs, stairs, support, collapse, storey fading | 12 |
| W7 Stages and appearances | stages for all; `forage` + night spawner → `appear` | reachability with renewables, 16 |
| W8 Combat | material and quality in attack/defence; elements and resistances as data | coverage holds, 17 |
| W9 Behaviour | one goal system for people, creatures, companions, sins; real work | 14 |
| W10 The story's script | scenes, beats, quests, objectives as one script | the prologue and quests unchanged in play |

## 13. Risks and limits

- W1 and W2 touch nearly every position-related line of the engine, the renderer and the map
  codec. They are done on a branch and merged only with every check green.
- Storey fading may not look right; then storeys stop at one level with roofs (RimWorld), and
  W1–W5 are unaffected.
- The ground's column is not a thing: no digging into hills until it is materialised (D27).
- Wilderness generation quality must be seen in the browser.
- Long fast-forwards may be slow; the fallback is closed-form catch-up (§6.11).
- All numbers are drafts until calibrated against the demo requirements.

## References

- Elin (decompiled locally, EA 23.351): `Card.cs`, `Thing.cs`, `Chara.cs`, `Trait.cs`,
  `Cell.cs`, `Map.cs` (`MineBlock`, `MineFloor`, `MineObj`, `DropBlockComponent`,
  `TryAddRoom`), `BaseTaskHarvest.cs`, `GrowSystem.cs`, `SourceMaterial.cs`,
  `RecipeManager.cs`, `RecipeSource.cs`, `AttackProcess.cs`, `ActPlan.cs`, `AIAct.cs`,
  `GoalWork.cs`, `Region.cs`, `Zone.cs`, `Zone_Field.cs`, `Player.cs` (`ExitBorder`),
  `GameDate.cs`, `GlobalGoalAdv.cs`, `Room.cs`.
- [Elin modding docs](https://elin-modding-resources.github.io/Elin.Docs/);
  [Ylvapedia](https://ylvapedia.wiki/wiki/Elin:Crafting).
- [Caves of Qud wiki: world map](https://wiki.cavesofqud.com/wiki/World_map),
  [zones and worlds](https://wiki.cavesofqud.com/wiki/Modding:Intro_-_Zones_and_Worlds).
- [Cataclysm: DDA source](https://github.com/CleverRaven/Cataclysm-DDA/tree/master/src)
  (`overmapbuffer.cpp`, `mapbuffer.cpp`, `map.cpp` `actualize`, `npc.cpp`, `do_turn.cpp`).
- [OpenNefia](https://github.com/Ruin0x11/OpenNefia) (Elona 1.22).
- [Dwarf Fortress wiki: adventurer mode](https://dwarffortresswiki.org/index.php/DF2014:Adventurer_mode),
  [world activities](https://dwarffortresswiki.org/index.php/DF2014:World_activities).
