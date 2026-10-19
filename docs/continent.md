# The continent: regions, places, the backdrop

Status: **agreed 2026-10-18, phases A, B and C built.** The world grows from the Frostfang Coast to hundreds of maps, thousands of
people and tens of thousands of things, most of them **backdrop** for now: the released demo is what is played today,
with the rest of the continent walkable around it, filled in with played content later. This document is the plan for
that growth (phases A–E) and the record of phases A (the continent itself) and B (its places: rooms, templates,
each region's look, §10).

The user's decisions (2026-10-18):

- The regions follow [lore.md](lore.md) §6: one for each of the five seals, round the Holy City where they are carried.
- The backdrop is walkable: one can go into its places, see its towns and wilds; no story is told there and nobody
  gives an errand. The world map says so ("no tale here yet").
- "Tens of thousands of items" are things in the world (instances), from about a thousand kinds and the materials,
  qualities and elements they come in — not tens of thousands of kinds.
- The wiki has a page for every key person and every played place; backdrop people never get pages, and backdrop
  places are listed on their region's page.

## 1. The backdrop

A backdrop map (`MapData.backdrop`, `MapMeta.backdrop`) is made to fill the world. It is an ordinary map — the engine
treats it like any other, the modder answers in it like anywhere — but nothing of the story is in it: no person, no
quest, no step's region, no thing the Pilgrim's Road counts (its wayshrines tell the story when an offering is laid on
them, so a backdrop shrine keeps a statue). Its site on the world map carries `backdrop: true`.

What holds it:

- **Its own checks** (`games/openworld/tools/test/continent.test.ts`), not the demo's: the demo's minimality
  (`demo.test.ts`, "every placed thing witnesses a requirement") is for what is played. The backdrop's checks are
  generic: every region there, every cell reachable, every place on land with its map on its cell, named in both
  languages, no one trapped coming in from any side, nothing of the story in it.
- **No page of its own** in the wiki: a region's page lists its places (`{{地区地点|<region>}}`, `{{地区表}}`).
- **Replaceable**: a backdrop place is a map file on a cell. A played place takes its cell later (a hand-made map's
  edge links put it there, `npm run continent` makes the continent again around it) or its file.

## 2. Regions and grounds

| Region | Seal / Seal-bearer | The land | Its wild |
|---|---|---|---|
| Frostfang Coast 霜牙海岸 (NW) | Crown of Thorns / Alberic | cold coast, pine, fords; snow in the north | plains, woods, hills, snow (the old recipes) |
| The Scarred March 赤痕边境 (N, NE) | Scourge / Matthias | red badlands and steppe, ridges | steppe (wolves, boars), red badlands (imps, fire slimes), red hills |
| The Vale of Scales 衡谷平原 (E) | Scales / Ele | barren grain fields, dust plains, salt flats | barren fields, dust (spiders), salt (crabs), thin grassland |
| The Pale Fens 苍白林沼 (S) | Nails / Nacht | marsh, dead wood, lakes under a lasting dusk | marsh (water slimes, zombies), dead wood (skeletons, bats), grey woods (ghosts) |
| The White Altar Heights 白坛高地 (W, SW) | Lance / the White-Robed | white stone highland, mountains, pines | white highland (stone golems, storm wisps), highland pines, stony pasture |
| The Holy City 圣城 (centre) | — | the city round the Most Holy Hall, meadows and fields | pilgrim meadows, city outskirts |

The regions are content (`games/openworld/content/src/regions.ts`: name, the seal, a colour for the world map,
whether it is backdrop); `WorldIndex.regions` hands them to the world map. A map's `region` names its region; a wild
cell's site carries it (`props.region`), and the wild's recipe can differ by region on a ground it shares
(`content/src/wild.ts` `REGIONAL`).

The world map's grounds (`ow_*`, content `ontology.ts`), each with its step cost (a cell is 30 minutes on plains):

| Ground | Cost | | Ground | Cost |
|---|---|---|---|---|
| road, city ground, bridge | 0.5 | | forest, hills, white highland, badlands, dust, dead wood | 1.5 |
| plains, steppe, fields, salt flat | 1 | | snow | 1.5 |
| marsh | 2 | | sea, mountains, river | — |

A bridge is a river's cell a road goes over: drawn as the river with planks on it; its wild has the river running
through and the road on planks across.

## 3. Places

Each region holds about thirty named places (the gazetteer): its capital near its heart, its Seal-bearer's seat at its
far edge (sealed: `opensWhen` the fact `world.untold`, which no rule sets; `SITE_GATES` says why), and a quota of kinds
put where the ground suits them (a fort on hills and badlands near a border, a graveyard in marsh and dead wood, a cave
beside a mountain, a farm or a mill on fields and plains, a village near water). The Holy City is the Most Holy Hall
(sealed) and its eight quarters round it.

| Kind | Map | What its template builds (`tools/src/demo/continent/backdrop.ts`) |
|---|---|---|
| village, town, city | 40×30, 48×36 | lanes of houses (the region's buildings) along streets, a square with a well, the region's lamps, barrels; a village's smithy or shop now and then; a town's store, smithy and inn or teahouse, its stalls, statue and banners; a city's fountain, banners and its quarter's theme (§10) |
| farm, mill | 40×30 | a house, fenced fields, haystacks, a pen with a cow and hens; a mill's sacks and log pile |
| camp | 32×24 | tents round a campfire, log benches |
| ruin | 36×28 | broken walls, rubble, bones, a chest; what prowls there |
| shrine, cathedral, seat | 30×24 – 44×32 | a court and a statue, candles; a cathedral's hall with an altar, cloister houses, graves; a seat's hall |
| cave, mine | 36×28 + 40×30 below | a face of rock with a mouth, stairs down to its depths: a winding hollow with ore, bones, bats, spiders, skeletons |
| tower, fort | 32×24, 44×32 | a stone tower; a walled yard with watchtowers in its corners and a gatehouse (an arch between stone posts, the region's banners), a keep, two barracks, dummies, a rack, a well |
| graveyard, battlefield | 36×28, 44×32 | a walled yard of gravestones, dead trees; ash, the fallen, bones, what walks there |

Every place's map is its ground's own wild (`wildChunk` at the map's size, without its beasts) cleared where the place
is built. Settlements are peaceful; the rest are combat zones. Every building's door leads into a room (§10).

## 4. Names

A place is named in both languages at once (`tools/src/demo/continent/names.ts`): a region's first half and a shared
second half that mean the same in English and Chinese, then its kind — Saltmere Mill 盐湖磨坊, Ironwick Keep 铁坞堡.
Each region's first halves are its land and its suffering (the March's red, iron, blood, lash; the Fens' pale, mire,
bone, nail). No name and no stem is used twice. A place's id is its region's and its name's (`redmarch.ironwick-keep`);
a cave's depths are `<id>.depths`.

## 5. Generation and data

The continent is data: `games/openworld/tools/src/demo/continent/continent.json` holds its size, its grounds (a
character a cell, the map format's), its regions (a character a cell) and its places. The world is built from the
file (`overworld.ts` `buildOverworld`, `backdrop.ts` `buildBackdrop`); `npm run continent` makes it again
(`continent/generate.ts`, from its seed and the hand-made places' cells) — after a hand-made place moves, and never by
itself, so a place keeps its cell and id. A test holds the file to what the generator makes.

The generator, in order:

1. **Land**: a rounded block of continent worn by noise, the sea round it; the Frostfang Coast's west bank (the pocket
   behind the Ford, world-model.md D22) and the land east of the Ford always land.
2. **The barrier**: the range north of the Ford to the north coast, the river south of it and along the pocket's south
   shore to the west coast. The Ford stays the only way from the west bank (a check throws if the pocket leaks).
3. **Regions**: the nearest heart, each weighted by how far it reaches, the borders warped by noise; the west bank and
   every hand-made place the Frostfang Coast's.
4. **Grounds**: height and wetness as ranks within each region, so each region has its share of high, low, wet and dry
   ground; ridges of mountain along the seals' borders.
5. **Rivers** from the heights down to the sea, or to a lake where they can go no lower.
6. **Places** as §3, a cell apart.
7. **Roads**: the pilgrims' ring from the pass beyond Emberfall through the capitals and back to the far bank south of
   the Ford, a road from each capital into the Holy City, and in each region a tree joining its settlements to its
   capital (A* over the costs; a river crossed is a bridge, a mountain crossed a pass).
8. **Reach**: every passable cell joined to the far bank (a pass or a bridge where one is cut off; an islet is sea).

`buildFord()` returns the played maps (`chunks`), the backdrop's (`backdrop`, made once per process) and where the
hand-made maps lie (`cells`); the index lists every map (the backdrop's as `backdrop`) and the regions. `gen:world`
writes them all; the bake (`npm run bake`) puts them all in the project.

## 6. Checks

`games/openworld/tools/test/continent.test.ts`: the file is the generator's for the places as they lie; every region of
the lore with its places, capital and seat; every passable cell reached from the far bank and the west bank only
through the Ford; every place on standable land, never beside another, its map on its cell, its site leading in (sealed
ones by the untold gate); names in both languages, never twice; no backdrop map traps one coming in from any side, a
cave's depths lead back up; every door a building stamps leads into a room, which one walks into a step inside its own
door and out of in front of the door one came in by, and from there off the map (no room and no door shuts one in);
the Holy City's eight quarters each laid out its own way, every fort with its gatehouse and only barracks inside, a
region's buildings its own; every region but the played one with a look, the Pale Fens the darkest and greyest; the
backdrop holds no person, no wayshrine, no seal stone, only kinds the game has; a region's wild is its own. The overworld's older checks (`overworld.test.ts`, `demo.test.ts` W4–W6, W18) hold on the
continent too.

## 7. The world map, and older saves

The world map (M) shows the continent (`Atlas.continent`): its grounds, each region tinted and bordered in its colour
and named over its middle (a backdrop region "no tale here yet"), its places (the larger always named, the rest as one
comes closer; sealed ones shut, visited ones lit), the waypoint stones and the quest's marks at their maps' cells, and
where one is (one's own cell, or the place one is in). "Nearby" is the older view: the visited maps as they join.

The continent grew round the Frostfang Coast in the same cells: a save from before keeps its cells, and
`migrateOverworld` (v4) gives it the continent's sites; anything on a cell that is no longer open moves to the
nearest that is.

## 8. Numbers (phase A)

| | Before | Phase A | Phase B |
|---|---|---|---|
| world map | 16×12, ~150 sites | 64×48, 2,135 sites | — |
| maps | 59 (+ the overworld) | 276: 59 played, 196 backdrop places, 21 depths | 1,024: 59 played, 196 places, 21 depths, 748 rooms |
| regions | 1 | 6 | 6, five with a look |
| world map grounds | 8 | 18 | — |
| fixtures in the world | | | 12,113 |
| the world's files (`public/world/`) | | | 6.7 MB |

## 9. The phases

- **A — the continent** (built): the regions, the world map grown, its grounds, rivers and roads, the gazetteer, the
  backdrop's maps by kind, the wild by region, the world map's continent, the migration, the checks.
- **B — places** (built, §10): a room behind every building's door (748 maps), templates by kind and region (the Holy
  City's quarters each by its theme, forts with watchtowers and a gatehouse, each region's buildings, lamps, banners
  and what stands about), each region's look (a grade for the world filter and a shade over its hours: the Fens
  darker). Left for later: a city's districts as maps of their own beyond the Holy City's quarters, the night's
  length by region (the shade darkens every hour alike), landmarks.
- **C — people** and the engine's scale (built, §11–§12; the people live in B's rooms): people in bulk by household and role per settlement (`format/src/crowd.ts`
  grown: households, looks from `generateLook`, trades, a day within their own place); fidelity tiers (backdrop people
  stay in their place, out of the hourly routing); people made when their map is first entered, kept only when changed;
  dormant maps' things out of memory; indices by map, type and household in place of the scans over all things;
  `catchUp` and `statusTick` kept to the map. On the world map a frame now snaps every site (about 11 ms to make and
  7 ms to copy, ten times a second): frames that send what changed, or what is in view.
- **D — goods**: about a thousand kinds (regional forms, named pieces) and their stock in every shop, house and chest by
  settlement and region: tens of thousands of things. The coverage sweep samples by class where every pair is too many.
- **E — scale checks**: a world-scale test (load the world, walk into fifty maps, time a tick, size a save), the
  wiki's region pages, the backdrop's numbers in this document.

## 10. Places (phase B)

**Rooms** (`tools/src/demo/continent/rooms.ts`). Every building a backdrop map stamps goes through `building()`
(`backdrop.ts`), which notes its door, its prefab and what it is (`Role`: home, farmhouse, mill, smithy, shop,
teahouse, inn, chapel, tent, barracks, cloister cell — the prefab's own, `roleOf`, unless the place says: a farm's house
is a farmhouse, a fort's houses barracks, a cathedral's cloister cells). After the place is built, the cell before each
door is cleared, and `roomsBehind` makes a room for each, linked as the hand-made interiors are
(`MapBuilder.linkInterior`): in by the door, a step inside the room's own door at its bottom; out by it, in front of the
door outside. A room is `<place>.<role>-<n>` (`tithe.milletwick.home-3`), named for its place and what it is ("Mournwell
— The Gravedigger's House", 哀泉村·掘墓人之家), backdrop, peaceful, indoor, its region's. Its size follows the building
(a straw hut's 8×6, a cottage's 11×8, an inn's 14×10); its walls and floor are its region's (the Coast's wood, the
March's stone, the Fens' moss, the Heights' and the Holy City's plaster over stone), a smithy's and a barracks' stone. It
is furnished plainly by what it is — a home's beds, hearth, table and chairs, chest and barrel, and (six in ten) the
things of the trade it is kept by, from its region's four (the Coast's woodcutter, fisher, trapper, weaver; the March's
tanner, herder, fletcher, veteran; the Vale's reaper, weigher, baker, gleaner; the Fens' eel-catcher, reed-cutter,
gravedigger, candlemaker; the Heights' stonemason, shepherd, acolyte, copyist; the Holy City's chandler, scribe,
pilgrim-host, glazier); a smithy's forge, anvil and rack; a shop's shelves and counter; a chapel's altar, candles and
benches; an inn's beds, counter and tables; a tent's bedroll, crate and lantern; a barracks' row of beds and racks; a
cell's bed, books and candle. Nothing is put in the way in from the door. The containers are empty (phase D fills them).

**Templates.** A settlement is laid out with a `Layout`: its first buildings on the main street (`civic`: a town's
store, smithy and inn or teahouse; a village's smithy or shop now and then) and ground kept clear for its theme
(`reserve`). Each region's look is laid over its settlements, farms, mills and camps (`DECOR`) besides its buildings,
streets, walls and lamps (`STYLE`): the Coast's pines crowding in, woodpiles and washing lines; the March's red dirt,
braziers along the streets, racks and old bones; the Vale's dry grass, little fields gone to dust with their haystacks,
sacks, carts and scarecrows; the Fens' mud, black pools in reeds, dead trees, lanterns at the doors and mist; the
Heights' gravel and boulders, statues over the streets, candles at the doors; the Holy City's cobbles, lamps, flower
carts. Each region flies its own banner (`BANNER`) over its squares and forts. A city is built by its quarter's theme
(`THEMES`): the Holy City's eight in the gazetteer's order — the North Gate (the city wall with round towers either side
of the gate, the watch's barracks), the Bell Ward (a chapel and the clergy's house, candles and an altar on the
square), the Market (shops, stalls along the square's rows, crates, carts), the Lamp Ward (teahouses, an inn, a lamp at
every few steps), the Lower Town (huts on dirt lanes, mud, washing), the Pilgrims' Quarter (inns, a camp of tents on the
green, a fire), the Old Wall (the first wall broken across the north, its columns standing), the Cloister (a walled
garden with its chapel, a brothers' house and a fountain) — and every other city one of five of them by its seed. A fort
has watchtowers in its corners and a gatehouse in its south wall: the arch between two stone posts, the region's
banners. The towers, posts and banners are the pack's own pieces (catalogue `watchtower`, `tower_round`, `pillar`,
`banner_*`).

**A region's look** (`RegionDef.look` in content `regions.ts`, the engine's `RegionLook`, handed over as region data:
`WorldIndex.regions[].look`). The worker sends a map's region's look with the map (`{ t: 'map', look }`); the scene
eases from one look to the next (about a second) and the first map takes its look at once. A look is a tint the world
filter tones the colour toward with the lightness kept (`uTint`, lighter at the player's light strength), more or less
grey than the game's own grade (`desat`, added to the filter's), and a shade over the hours out of doors, by day as by
night (`shade`; indoors two fifths of it), which darkens the light and so the filter's hatching too, and holds when the
player turns the filter off. The Frostfang Coast has none: the played land keeps the game's own look.

| Region | Tint | Grey | Shade |
|---|---|---|---|
| The Scarred March | red rock `#c86a48`, 0.22 | +0.05 | 0.04 |
| The Vale of Scales | pale straw `#d8c08a`, 0.2 | +0.18 | — |
| The Pale Fens | grey-green `#6f8a80`, 0.35 | +0.4 | 0.24 |
| The White Altar Heights | cold white `#dfe4ee`, 0.2 | +0.12 | — |
| The Holy City | gold `#f0cf7a`, 0.16 | −0.05 | — |
## 11. The backdrop's people (phase C)

The backdrop's people live in the rooms behind their place's doors (§10): a household to a room, as many as the room
is for (`tools/src/demo/continent/people.ts`, their words in `folk.ts`) — a pass over the built maps, so the templates
change freely under it. How many a place has is how many its houses hold, and the street holds those whose day has
them out: a first try that gave each kind of place a number (a city's quarter eighty) filled the squares wall to wall,
and the user ruled it out (2026-10-18): the number follows from the houses.

- **Households by room**: a home's family (one or two grown-ups, children in half the houses), a farmhouse's farmers,
  a mill's miller, a smithy's smith, a shop's keeper, a teahouse's or an inn's keeper (and an inn's lodgers), a
  chapel's priests, a cloister cell's brother, a tent's hunters, sellswords, traders, reed-cutters or pilgrims by
  region, a barracks' garrison (a fort's soldiers and their captain, a town's watch). A home's grown-ups by the place's
  kind and region (a village's farmers and fishers, the coast's hunters, a town's and a city's watch, scholars,
  nobles). A shrine, which has no roof, keeps its keeper and the pilgrims who sleep by it. Ruins, caves, graves, towers,
  battlefields and the sealed seats have no one. The household (`household` `<place>.h<n>`) shares a family name.
- **A day within their place** (its map and its rooms): asleep beside a bed of their room, a meal at its table at noon,
  at work where their trade has them — indoors the smith at the anvil, the keeper at the counter, the priest at the
  altar, the scholar at the books, half the grown-ups and the old at the hearth, the loom or the bench; out of doors
  the farmer in the fields, the guard at the gate or the square, the soldier in the drill yard, the fisher on the shore,
  the children in the street —, the evening out at the well, the fountain, the fire or along the street, or at home.
  One guard in three keeps a town's streets at night. At no hour are more out of doors than one to every 25 cells one
  can stand on (a check).
- **Names** in both languages: a given name by region and sex, transliterated as the Ford's people are, and a family
  name made as the places' are (a region's first half and a root, meaning the same in both: Pinebrook 松溪). **A look**
  from their id (`generateLook`), **a favourite** (`favouriteFor`), **lines** by their work and their land (a
  greeting, two of their work's, one of their land's: the regions' sufferings are in the weather and the prices, never
  in a quest). **A trade where it fits**: the keepers, smiths, herbalists, peddlers, fishers and chapel priests carry
  their stock (`stock`, the morning's restock keeps it), every one their coin (`purse`).
- **The backdrop's own** (`npc.fidelity: 'local'`): their records are their place's file (each begins where six
  o'clock has them — most abed in their rooms), never the index's; not essential; named by no quest, step or invariant;
  no page of the wiki. People of one place know each other by sight (the society module's `neighbours`: no record of
  their meeting is kept).

| | Before | Now |
|---|---|---|
| people | 33 (all in the index) | 33 who travel (the index) + 1,616 of the backdrop (their places' files) |
| rooms lived in | — | 746 of the 748 behind the backdrop's doors (not the sealed Hall's) |
| the busiest street (a Holy City quarter), by day / at night | — | about 30 / 3 |

## 12. The engine at this scale (phase C)

What grew with the world, and what it is now.

- **A map's things are kept as what differs from its file** (`engine/src/sparse.ts`). A chunk's things are made the
  first time the map loads, marked `from` it; from then on the file is their record. A save keeps what differs (a merge
  patch: a person moved and hungrier is a few props; what was made or brought there, whole); what is as the file has it
  is left out; what is gone stays gone (`ChunkState.gone`). A backdrop person is made when their map is first entered
  and saved only once changed. The index is the file of the people who travel (`ROSTER`): a save keeps them as what
  differs from it. An older save's maps are kept whole until their files come again, and then told from them (what the
  file has and the save had not is gone).
- **Dormant maps put away**: the host (`Game.keepMaps`, the worker's 8) puts the maps far behind away (`Game.trim`, the
  longest dormant first): their data and their things leave memory, to come back as they were when the map's file comes
  again (`Engine.loadChunk`). What the world needs wherever it is stays: the player, companions, the people who travel,
  what a quest names, what an invariant looks for, what waits for an outcome. An event for a thing put away waits in its
  map's inbox, as a dormant map's does. A save puts away every map but the player's, whose unchanged things it leaves
  out (`lean`): a save loads onto its map with the map's data alone, and its file brings the rest.
- **Fidelity**: the backdrop's people keep to their place — its map and the rooms behind its doors — out of the hourly
  routing of the people who travel (`npc.ts`, its roster read from the people index): they come and go only between
  maps a step apart (on the hour, those next door whose day brings them in; entering a map, those whose day has them
  next door are there, those next door whose day has them here come), placed by their days. One who is in a room not
  loaded is put away with their place (`sparse.ts`).
- **Indices** in place of the scans over every thing (`world.ts`): by type (`ofType`: the codex's kinds, waypoints, an
  invariant's `exists`, a quest's finder), the people (`people`), props by value (`withProp`: a household's members, the
  site that stands for a map, followers), the kept cells by map (`keptCells`), the agents by map (`agentsOnMap`), the
  statuses by map (`statusfulOn`: `statusTick`, `catchUp`, `fires`), relations read the other way (`settle`); what
  companions lend read from their index (`World.stat`); a thing no rule could answer by its type and tags is passed over
  before its view is made (`RuleLibrary.mayAnswer`: the overworld's places' lasting contact, the periods' hosts).
- **Frames**: a frame carries what the camera shows and a margin round it (`snapshot`'s `view`, the page says what it
  shows), and the worker sends a thing only when it changed (`runtime/src/frameDelta.ts`; the page puts the frame back
  together; a key frame on a new map and every hundred frames).

Measured with `npm run scale` (`tools/src/demo/scale.ts`: fifty maps walked into — played, the backdrop's towns and
wilds, the overworld between — as the worker plays them; one machine, ms):

| | Before (33 people) | Now (3,062 people) |
|---|---|---|
| things in memory after fifty maps | 4,356 (every map seen) | 4,462 (8 maps; 6,417 with every map kept) |
| a tick on the overworld | 5.8 | 1.1 |
| a tick in the backdrop's largest place (52 people) | — | 0.5 |
| a frame on the world map: made, sent | 11 + 7 to copy, 460 KB | 3.2, 6 KB (in view, what changed) |
| a save | 1.47 MB | 390 KB, of it 51 KB the state (the rest the rule library, the same in every world) |

The scale test (`continent.test.ts`, "the world at scale") holds these to bounds, and what is put away to coming back
as it was.
