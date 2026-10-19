# The continent: regions, places, the backdrop

Status: **agreed 2026-10-18, phase A built.** The world grows from the Frostfang Coast to hundreds of maps, thousands of
people and tens of thousands of things, most of them **backdrop** for now: the released demo is what is played today,
with the rest of the continent walkable around it, filled in with played content later. This document is the plan for
that growth (phases A–E) and the record of phase A, the continent itself.

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
| village, town, city | 40×30, 48×36 | lanes of houses (the region's buildings) along streets, a square with a well, lamps, barrels; a town's stalls and statue; a city's fountain |
| farm, mill | 40×30 | a house, fenced fields, haystacks, a pen with a cow and hens; a mill's sacks and log pile |
| camp | 32×24 | tents round a campfire, log benches |
| ruin | 36×28 | broken walls, rubble, bones, a chest; what prowls there |
| shrine, cathedral, seat | 30×24 – 44×32 | a court and a statue, candles; a cathedral's hall with an altar, cloister houses, graves; a seat's hall |
| cave, mine | 36×28 + 40×30 below | a face of rock with a mouth, stairs down to its depths: a winding hollow with ore, bones, bats, spiders, skeletons |
| tower, fort | 32×24, 44×32 | a stone tower; a walled yard with a gate, a keep, barracks, dummies, a rack |
| graveyard, battlefield | 36×28, 44×32 | a walled yard of gravestones, dead trees; ash, the fallen, bones, what walks there |

Every place's map is its ground's own wild (`wildChunk` at the map's size, without its beasts) cleared where the place
is built. Settlements are peaceful; the rest are combat zones.

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
cave's depths lead back up; the backdrop holds no person, no wayshrine, no seal stone, only kinds the game has; a
region's wild is its own. The overworld's older checks (`overworld.test.ts`, `demo.test.ts` W4–W6, W18) hold on the
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

| | Before | Now |
|---|---|---|
| world map | 16×12, ~150 sites | 64×48, 2,135 sites |
| maps | 59 (+ the overworld) | 276: 59 played, 196 backdrop places, 21 depths |
| regions | 1 | 6 |
| world map grounds | 8 | 18 |

## 9. The phases

- **A — the continent** (built): the regions, the world map grown, its grounds, rivers and roads, the gazetteer, the
  backdrop's maps by kind, the wild by region, the world map's continent, the migration, the checks.
- **B — places** (next, in parallel with C and D: they share only the gazetteer): richer templates, interiors behind
  the doors of towns and cities (a room per house: hundreds more maps), districts of a city as maps of their own, each
  region's look (its world filter's grade, by region, and its night's length: the Fens darker), landmarks.
- **C — people** and the engine's scale: people in bulk by household and role per settlement (`format/src/crowd.ts`
  grown: households, looks from `generateLook`, trades, a day within their own place); fidelity tiers (backdrop people
  stay in their place, out of the hourly routing); people made when their map is first entered, kept only when changed;
  dormant maps' things out of memory; indices by map, type and household in place of the scans over all things;
  `catchUp` and `statusTick` kept to the map. On the world map a frame now snaps every site (about 11 ms to make and
  7 ms to copy, ten times a second): frames that send what changed, or what is in view.
- **D — goods**: about a thousand kinds (regional forms, named pieces) and their stock in every shop, house and chest by
  settlement and region: tens of thousands of things. The coverage sweep samples by class where every pair is too many.
- **E — scale checks**: a world-scale test (load the world, walk into fifty maps, time a tick, size a save), the
  wiki's region pages, the backdrop's numbers in this document.
