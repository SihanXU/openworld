# The showcase: model places of the Holy City

Six of the Holy City's backdrop places — and five more, one in each region round it (§4b) — are made by hand as models for every place to come (the user's ask, 2026-10-25:
"样板房" — a Gothic cathedral without and within, a grand busy city, a strong fortress, a busy market and more), each
laid out from the great places it learns from and built from the project's own buildings. They take the places' files
(the continent and its generator are unchanged), stay backdrop (no tale is told there yet), and their people are the
backdrop's own. The five quarters are one walk, street into street, round the Most Holy Hall (sealed, untouched).

| Place | Continent id | What it shows | Learned from |
|---|---|---|---|
| Sunwell Abbey | `holy.sunwell-abbey` | a cathedral and its close; the nave, crypt, belfry, library, refectory, dorter | Reims, Amiens, Cologne (the front, the flyers, the chevet); Chartres (the rose, the labyrinth in the floor); Sainte-Chapelle (glass on the floor); a cloister of the Cistercians |
| The North Gate | `holy.quarter-1` | a concentric fortress over the city's gate; the keep's great hall and the castellan's floor | Krak des Chevaliers and Beaumaris (two rings, the inner higher); Carcassonne (towers under cones, the barbican); Rochester (the keep's forebuilding); Elden Ring's Stormveil (the front is the hard way: the walks are reached by stairs inside) |
| The Bell Ward | `holy.quarter-2` | a grand city's square under its belfry; the council hall | Bruges's Markt and Belfort; Siena's Campo; Rothenburg's Plönlein (the fork round the tower gate); Kevin Lynch's five elements as the check of the layout |
| The Market | `holy.quarter-3` | a market square, its stalls and keepers, the market hall, the weigh-house, the cloth arcade | Bruges's Markt, the cloth halls of Ypres; Marrakech's Jemaa el-Fnaa (the square changes by the hour); the Black Steward's scales (lore.md §6) in the weigh-house |
| The Lamp Ward | `holy.quarter-4` | the pilgrims' inn on its little square, teahouses, a lamp every few steps; the inn's common room | the coaching inns round a square; the evening's city |
| The Lower Town | `holy.quarter-5` | the poor quarter on the canal: quays, boats, the crane, hovels, washing, the tavern | the lesser quays of Venice and Dubrovnik, every old port's poor streets |

## 1. Where it lives

- `games/openworld/tools/src/art/arch/` — the buildings' art (§3).
- `games/openworld/tools/src/demo/showcase/` — the places: `index.ts` (the makers by place id, the stocking, the quarters
  joined across their edges after every place is made, `SHOWCASE_PLACES`), one file a place, `rooms.ts` (a hall with
  its north wall's face, doors and stairs between maps), `street.ts` (rows of townhouses with rooms behind their doors,
  doorsteps kept clear), `cast.ts` (§5).
- `continent/backdrop.ts` hands a place to its maker before its kind's template; `continent/people.ts` adds a place's
  cast after its households.
- Checks: `tools/test/showcase.test.ts` (§6); the continent's and goods' tests know a showcase's halls and buildings.

## 2. Principles

- Every element is placed for what it shows; nothing is noise. A place is laid out first on paper (its approach, its
  focus, its paths and edges), then built, then lived in, then looked at in the game.
- A building is drawn in the game's own projection and cut so that whoever stands beside it is drawn rightly before or
  behind every part of it (§3.1). Nothing rises off the top of a map: the camera cannot go there (a map grows rows above,
  `MapBuilder.grow`).
- A grand front must be seen whole: where one stands before it, the view draws back and looks up (§3.3).
- The palette is the pack's (its ink, its warm light from the top left); the Holy City's stone pale and warm, the
  fortress's granite cool, roofs in slate and red tile, the glass deep blue and ruby with gold.

## 3. The art

### 3.1 The oblique renderer (`arch/oblique.ts`)

A building is a model of solids (`arch/shapes.ts`: boxes, gable, hipped and lean-to roofs, spires of four, eight or
round sides, drums and octagons, half cones over apses, flying buttresses, merlons; arches and recesses cut as voids;
door slabs no void cuts) in pixels (x east, y south, z up; a cell 16 by 16, a storey as high as the art wants). The
renderer casts a ray for every pixel of the picture along the 3/4 view (a point z up is drawn z pixels higher), keeps
the highest point it meets, finds the surface's facing by probing round it, and shades it by its material
(`arch/materials.ts`: coursed ashlar, slates and tiles in staggered courses, timber, plaster washes, glass, iron, gold,
canvas stripes, water) — a tone by facing, one darker in a cast shadow (marched toward the light) or deep in a recess, a
rim of light where a top breaks over the face under it, the ink where one mass stands before another and round all.
Ornaments (`arch/ornaments.ts`) are drawn on the faces where they are seen: lancets with leaded glass and medallions,
the rose, portals with their tympanum and trumeau, statues, crockets, belfry louvres, windows with shutters, doors,
clocks, banners, the trades' signs.

The picture is cut into strips, one for each row of the footprint: a strip is what is seen of that row's own surfaces,
as tall as they rise, stamped at the row's depth (`PrefabDef.base`; `front` for a row one walks under — an arcade, a
gateway — so it is drawn before whoever is under it). So one walking beside the cathedral is behind the parts north of
them and before those south, at every row; through an open arch one sees whoever walks behind it. `arch/main.ts`
renders every model, packs its strips into `public/assets/lsw/Buildings/<name>.png`, and writes the catalogue's manifest
`client/src/buildings.json` (strips, footprints, doors); the catalogue makes a prefab of every strip (`<name>@<row>`), and
`MapBuilder.building(name, x, y, doors)` lays them all.

### 3.2 The kit (`arch/kit.ts`, `arch/buildings/`)

Made to measure from options and a seed: `hall` (walls, roof along either axis or hipped, windows by storey, doors,
buttresses, a stone plinth, half-timbering, chimneys, a bellcote, an open arcade, crenellations), `house` (the
townhouse, §3.2.1), `townhouse` (the older narrow one, kept for reference),
`tower`, `gatehouse` (two towers, the passage, the portcullis, machicolations), `keep`, `stall` (counter, posts,
striped canvas, its trade's goods), `fountain`, `grandFountain`. The models: `abbey.ts` (the church), `close.ts`
(cloister, library, refectory, dorter, lodge, almonry, gate), `fort.ts`, `town.ts` (twenty-eight townhouses, twelve
hovels, the hall and belfry, the tower gate, the guild hall, the inn, the tavern, two teahouses, the crane; the lists
`LOW_HOUSES`, `TALL_HOUSES`, `NARROW_HOUSES`, `HOVEL_NAMES` the maps choose from), `market.ts` (eight trades' stalls,
the hall, the weigh-house, the cross, the arcade), `inside.ts` (the halls' north walls, the nave's piers, the apse,
the canopy, the bells; and the furniture drawn whole as fixtures' pictures: pew, pulpit, font, tomb, sarcophagus,
reliquary, organ, lectern, desk, tall bookcase, throne — new fixture types in the content's ontology; the labyrinth is
drawn as ground, `Model.ground`); `street.ts` (the streets' furniture as fixtures: the iron street lamp, the stone
bench, the clipped cypress, the box ball, the urn of flowers, the balustrade, the city's standard, the hero in bronze, the
well head); `decor.ts` (§3.6).

#### 3.2.0 The halls within (`arch/buildings/halls.ts`, `showcase/halls.ts`)

After the user's word of 2026-10-26 ("内饰怎么全是方块"): every hall has its own plan (`plans.ts HALLS`: alcoves, bays, a dais,
a nook for the hearth, rooms off a room) and its walls are that plan's shell (shell.ts), as the nave's are, each face
dressed by the hall's style — windows, tapestries, banners, paintings, walls of books, shelves of jars, trophies of arms,
niches of bones, pilasters, sconces, and at its head a great hearth, a cloth of estate over a dais, a window of glass, a
wall of books or an ossuary. `showcase/halls.ts` lays each from its plan (floors by part, rugs and runners) and furnishes it
full: the crypt, the belfry, the library, the refectory, the keep's great hall and the castellan's floor, the council
hall, the market hall (stalls under its roof), the Pilgrims' Rest, the Drowned Lantern.

#### 3.2.1 The townhouse (`house`)

The user's word of 2026-10-25: the first houses were "narrowed" — too tall for their width — and every one faced the
screen alike. A house is now as wide as a shop and its door (7–11 cells; a cottage 6–8) and three or four deep, its
ground floor 48 pixels high and each floor above 44 (a storey a head over a man), two or three storeys. It stands to the
street one of five ways (`HousePlan`): its eaves along it, its gable to it (a narrower house, its front a gable end
with an attic window and a hoist beam), a wing brought forward under a gable of its own at the west end or the east (an
L, the door in the corner it makes) or in the middle (a bay, the door in its front); never the same plan twice in a
row, so a street's roofs run every way, as the RPG Maker towns the user showed do. Its front: the door up a step
between lanterns, or a shop — an arch open on shelves of its trade's goods behind a counter, a striped awning and its
valance, the sign hung out, crates of the goods and a chalked slate by the door; windows two cells apart, each with
its own shutters, curtains, box of flowers and now and then a little awning; a balcony with its pots and washing; a
cross gable or dormers; quoins, ivy or a climbing rose, a banner.

### 3.3 Vistas (`MapData.vistas`)

A rect of a map where the camera draws back (`zoom`, a share of the usual) and looks ahead (`look`) or keeps a point in
sight (`focus`, `share` of the way from the player to it). On the parvis the view pulls back to half and holds the
west front; in the choir it looks up at the apse's glass; before the barbican, over the market, under the belfry. The
runtime eases in and out (`scene.ts frameVista`).

### 3.4 Light on the floor (`MapData.lights`)

Pools of coloured light laid on the floor under all that stands: a lancet's or a rose's shape, or a soft glow; `sun` —
by day, moving and lengthening with the sun (west in the morning, east in the evening), gone at night — `night` (a
lamp, a hearth), or `always`. The nave's aisles take their windows' colours; the Lamp Ward's lamps glow on its paving
after dark (`scene.ts layPools`, `shinePools`).

### 3.5 Grounds and built high ground

New terrains: `paving` (pale limestone in panels: a parvis, a square, a nave), `flagstone` and `rampart` (a fortress's
wards and the walk on its walls), `plaza`, `flags`, `flowerbed`, the floors within. High ground is drawn by the runtime's
relief (`assets/relief.ts`) in the region's rock: the Holy City's is its limestone (`Catalog.relief.holy`), so a quay, a
terrace's edge and a curtain wall show pale dressed stone.
So a curtain wall is raised ground one climbs to by stairs and walks along, its parapet merlons on its outer edge; a
canal is a level under its quays.

### 3.6 Maximalism: the clutter (`arch/ornaments.ts`, `arch/buildings/decor.ts`, `showcase/dress.ts`)

The user's word of 2026-10-25: "极繁主义" — every detail full, dazzling. Three layers:

- **On every front** (`house`, `hall`): damp at the walls' foot, a drainpipe down a corner, moss on the stones, bills
  pasted up, the house's number, baskets of flowers hung over the lanterns, pots along the foot of the wall, flags under
  the eaves; on the roof moss in the courses, a skylight, pigeons on the ridge, a cat now and then, the chimney's pots
  and its smoke, a weathervane on a gable.
- **The decor kit** (`decor.ts`): pictures laid on the map (`MapBuilder.building`), never things, so a square can hold
  hundreds of them at no cost to the engine. What stands blocks its cell (casks, crates, sacks, amphorae, firewood, a
  stand of pots, an orange tree in its tub, a stone planter, a café table under its parasol, a pump, a signpost, a bill
  column, bollards, a bird bath, a handcart of produce, hay, an obelisk); what hangs is walked under (flags, paper
  lanterns or washing on two posts, a rose arch); what lies underfoot is drawn as ground (puddles, petals, leaves,
  cracks, a drain, a manhole, pigeons, a cat, chalk, straw, a rug of wares).
- **The maps** (`dress.ts`): `piles` at every wall's foot by the quarter's sort (city, market, poor, close), never a
  doorstep, an anchor or a cell beside a door; `festoons` along the fronts; `strew` over the paving; `panels` lay a
  square's paving in a grid of flags; `parterre`, `terrace` (a raised level with its balustrade and stairs), `lamp`
  (with its glow by night).

The streets themselves are irregular (`street.ts houseRow`): each house stands back from the street's line a cell or
two or not at all, gaps are left between some (a side yard with its tree, a hedge, a passage), and the ground a house leaves
before it — its setback, the corner its wing makes — is its own: a garden behind a bed of flowers, a paved court, bare
earth. A house's roof hides the ground behind it, and that ground is the house's (`Building.cover`, the cells its
picture covers whole, walled when a street lays it; never a doorstep).

## 4. The places

### 4.1 Sunwell Abbey

The close's gate and a lime avenue lead onto the parvis (its great fountain, pilgrims' stalls, statues) and the west
front fills the view: twin towers with open spires, three portals deep in their archivolts, the gallery of kings, the
rose. The nave's five bays with their flyers and pinnacles, the transept with a rose in each arm, the lantern over the
crossing, the chevet's five chapels. The cloister against the nave, the library over the chapter house, the refectory,
the dorter, the abbot's lodging, the almonry; the graveyard west of the choir, the herb garden and orchard behind the
chevet. Within: the nave (piers in two rows, pews, the carpet to the altar under its canopy in the apse, the organ, the
pulpit, the font, the labyrinth in the floor at the west end, abbots' tombs; the glass's colours moving over the aisles by day), the crypt (pillars, sarcophagi, the
reliquary), the belfry (the bells in their frame), the library (tall cases, the copyists' desks), the refectory (long
tables, the reader's pulpit), the dorter (the brothers' beds). The brothers keep the hours: lauds and vespers in the
choir, the morning and afternoon at the desks, in the garden, at prayer in the cloister and among the graves.

### 4.2 The Bell Ward

The council hall at the head of the great square, its belfry over everything (clock, the octagon of the bells, a gilt
spire), the guild hall's stepped gable beside it, a back street of houses behind; the square's inlay round the grand
fountain, columns, flower carts, lamps; the Processional Way along its south edge from the North Gate across the canal
on its causeway; the fork round the tower gate south to the Market.

### 4.3 The North Gate

Redrawn after the user's word of 2026-10-26 ("这城堡太丑了"; `arch/buildings/castle.ts`): curtain walls that are walls —
solid, two cells thick and 76 pixels high, battered at the foot, slits in their face, a machicolated outer parapet and an
inner one with the walk between (`fort_wall_x<n>` along x, `fort_wall_y<n>` along y, laid in the longest stretches by
`fort.ts wall`) — drum towers as stout as Beaumaris's under low cones at the corners, crenellated drums either side of the
great gatehouse (two drums under cones round its deep arch, the portcullis half raised, the city's arms over it, lanterns),
the keep with its four turrets under cones, its lead roof and its forebuilding. Within: the inner ward behind its own wall
(the keep, the chapel and the garrison's graves, the castellan's garden, the well), the barracks and the drill yard west,
the armourer's forge and its yard, the stables and the paddock east, the kitchen garden and the hives, roads of grey flags
from the gatehouse to the inner gate and round the wards; the moat winding before it, the drawbridge, the barbican.

### 4.4 The Market

The market hall's arcade along the north, the weigh-house, four broken runs of stalls of eight trades with lanes
between and a ring round the market cross, carts, crates, sacks and barrels, the well; the cloth arcade and the houses
south. Every stall's keeper stands under its canvas from dawn to dusk, selling what their trade sells; the city shops.

### 4.5 The Lamp Ward

The Pilgrims' Rest at the head of its square, a teahouse either side, the well and benches, lanterns at the doors; a
lamp every third step along the street, their glow on the paving at night. The inn's common room: the counter and its
barrels, tables, the hearth, the lodgers' beds.

### 4.6 The Lower Town

The canal a level under the town: a narrow quay north, a wide one south with the crane, nets and fish on their racks,
barrels and crates; boats on the water, the footbridge; hovels under thatch, the lane up to the Drowned Lantern, mud in
the lanes, washing strung across, the fire where the poor warm themselves.

## 4b. The regions' places

The second batch (the user's ask, 2026-10-26: "再多做一些地图，也是这个质量"): one place in each of five regions round
the Holy City, each built from its region's own buildings (`arch/buildings/regions.ts`: snow roofs, cogs and a
lighthouse; flat sandstone roofs, palisades, tents and a trebuchet; windmills, granaries and the great scales; stilt
houses, an ossuary chapel and dead trees; white chalk chapels, cells cut against the cliff), its ground in steps of the
relief in its region's stone (`Catalog.relief`), and two or three halls within, each from its own plan
(`plans.ts` HALLS, `showcase/regionhalls.ts`). A map's heights are a digit a cell (9 half levels at most), so a cliff is
at most four levels; a stair down a drop of more than one level is a row for every half level (`showcase/ground.ts`).

| Place | Continent id | What it shows | Halls | Learned from |
|---|---|---|---|---|
| Rimeholm | `frostfang.rimeholm` | a harbour on a fjord in three shelves: the longhall and the old gate in its thorns, the green and the tavern, the quay with its fish market, three piers and their cogs, the lighthouse on its spit | the Salt Mermaid, the boathouse (a cog on the slip), the longhall (its hearth down the hall's length) | Bergen's Bryggen, Lofoten's fishing villages, the Hanse's cogs |
| Warcombe | `redmarch.warcombe` | a fort town in a red canyon: the mesa's watch and trebuchet, the war hall on its ledge, the town behind its palisade, the levies' camp and the field of the last battle outside the gate | the war hall, the armoury, the field hospital | the Roman limes, the presidios of the badlands, the Alamo |
| Weighmarket | `tithe.weighmarket` | the tithe's granary city: mills on their rise over the fields, the granaries and the counting house over the great square and its scales, the guild houses; behind them hovels, the poorhouse and the salt pans | the counting house, the tithe granary, the poorhouse | Siena's Campo, the Hanse's grain halls, the tithe barns |
| Dusk Moorings | `palefen.dusk-moorings` | a town on piles: the causeway and its walks (each side's a row apart), houses over the water with gaps between, fog lamps burning all day, the floating market, the ossuary's island and its sinking graveyard, dead trees in the shallows | the ossuary, the healer's hut, the Lantern on Piles | Ganvie, the Marsh Arabs' villages, the Tonlé Sap |
| Highheath Abbey | `altar.highheath-abbey` | a monastery on chalk cliffs: the gatehouse at the foot, hermits' cells against the faces, switchback stairs, the chasm and its one bridge, the brothers' gardens and hives, the chapel, hall, cells, garth and graves on the summit | the Chapel of the Martyrs, the catacombs under it | the Meteora, Mont-Saint-Michel's terraces, the lavra cells of Athos and Cappadocia |

## 5. People (`showcase/cast.ts`)

A place's maker sets its cast as it builds: each one's role, where they sleep, and their day hour by hour (a map, a
cell, how far round it they keep). The hours a day leaves are asleep (a night watch sleeps by day). They are written
into the place's file as the backdrop's people are (`fidelity: 'local'`, a household, a name in both languages unique
in the place, a look from their id, lines by role and region, what they trade and carry), after the households the
rooms behind the doors already have. The crowd check holds them: at most one out of doors to every 25 cells one can
stand on.

## 6. Checks (`tools/test/showcase.test.ts`)

Every place with its halls and people; every portal answered by one back before it; every hall, room and stair reached
from where one comes in; the five quarters joined street to street; no strip rising off its map's top, every vista and
pool of light within its map; the Market (the busiest) ticking within a tick. The backdrop's scale run measures the
templates' places (the showcase is measured here).

## 7. Commands

```bash
npx tsx games/openworld/tools/src/art/arch/main.ts [name …]   # draw the buildings (all, or some) → Buildings/*.png, client/src/buildings.json
npx tsx games/openworld/tools/src/art/arch/try.ts abbey,fort_ out.png 2   # a review sheet of models
npx tsx games/openworld/wiki/src/render-showcase.ts out/ 1     # the showcase's maps drawn as the game draws them
```

## 8. Open

- The cathedral's spires are solid stone; Cologne's and Freiburg's are open tracery.
- The nave's vault is not drawn (the room is seen with its roof off, as every hall is).
- The Most Holy Hall itself stays sealed and its template's; the Old Wall, the Pilgrims' Quarter and the Cloister quarter
  are still their themes'.
- A procession along the Processional Way on a feast day, the market's evening change as a schedule variant.
