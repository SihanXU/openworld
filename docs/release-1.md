# Release 1: Part One, to the White Knight

Status: **agreed 2026-10-21; re-scoped 2026-10-26 to run to the first boss.** Release 1 is the game's first part, played on
the Frostfang Coast: from waking on Cloudtop, down the mountain, through Firstlight and its country — the grassland, the
forest, Thornwood Hollow and the barrow, Millbrook and Dawn Hill, the Charcoal Dell and the Reed Bend — across the Ford,
and east along the Pilgrim's Road — the Pilgrims' Rest, the five wayside shrines, the Abbey of the Thorn, the Kneeling
Field — to the White Knight on the East Road; then the Crown carried home, and the Held Ground. Emberfall, its mine,
Cinder Pass, the dragon's lair and the continent beyond the river are Part Two, already built and played by the team
behind one fact.

The user's decisions: (2026-10-21) the walkable west bank shrinks to a valley of places with a reason to walk between
them; the maps are polished one by one, their ground drawn by hand; every picture the game shows is cut and drawn right.
(2026-10-26) the release runs to the first boss and opens the Held Ground after him, so the Held Ground is Part One's
(the open question of 2026-10-21, §6, closed); Emberfall stays Part Two's; the way on east is shut by its gate's words, no
new obstacle of the story's; the chapter's card is the release's end; the people's lines that speak of the road east are
kept, as Part Two's promise; the Pilgrim's Road's maps and the Held Ground are polished to the valley's standard (§7).

## 1. The ending and the sealed road

- **`world.part2`** (content `regions.ts` `PART_TWO`) is the fact the second part waits for. No rule sets it in
  release 1; the dev console's World tab (its shortcut "Open Part Two", the debug op `fact`) or a test, by the author's
  hand, sets it to play on. `world.` is a protected prefix: no learned rule may set it.
- **The ending** is the Crown home: the story step `return` (`tools/src/demo/quest/chapter1.ts`, the village, Nessa's
  four minutes, `ch1.end`) and after it, with Part Two unopened, `part_one`: the chapter's card — "CHAPTER ONE · THE
  FIRST SEAL" — with the release's last lines, the road on east opening in Part Two and Firstlight, its country and the
  Held Ground the player's until then. With Part Two open, `chapter_end` shows the chapter's card alone. The world stays
  the player's afterwards (the game's sandbox after its ending, game-design.md §1): the valley, the Pilgrim's Road, the
  Held Ground with its land, grounds and buildings, the professions, the errands.
- **The Dragon Road waits**: `dragon_road` begins once the Crown is home *and* Part Two is open (its `start`). A save that
  began it before (Part Two then opened with the knight) has it put back, unbegun, on loading while Part Two is shut
  (`migratePartTwo`, run every load); it begins again when Part Two opens.
- **The road east of the Ford is open**: the Ford's east portal to the Rest and the world map's places of the Pilgrim's
  Road carry no gate; the far bank's sign names the Rest. The far bank's north, south and east edges are woods but for
  the road's own way, from the water's edge (`world.ts`), so nothing walks off it onto the world map east of the river.
- **The road on east is sealed**: the East Road's way to Emberfall has `opensWhen: world.part2`, so does every place of
  Part Two on the world map (Emberfall, the Old Mine, Cinder Pass, the lair: `overworld.ts`), the knight fallen or not. A
  sealed way is plain ground and leads nowhere (`stepSelf`, `Engine.sealedEdge`); run off, Lumi says why in its gate's
  words, once a minute (`story/sealed`, `SITE_GATES`: "The road on east to Emberfall is not open yet"); a sealed place on
  the world map is solid and says why when bumped (`site/sealed`).
- **The reach** is held by `tools/test/release.test.ts`: from the start, every way the engine gives — a map's ways and
  doors, its edges out onto the world map (a parted map's only where its part's ways lead), the world map's open cells
  and places, the Oath-Thorn's pocket — with every other gate of the story opened, reaches the valley, the Ford and the
  Pilgrim's Road; past the knight the Held Ground besides; never Part Two's places or a backdrop place, and never a cell
  of the world map east of the river; with Part Two open, Emberfall and the dragon's country. A map whose edge opens
  onto the far side fails it, by name.
- Also proved by demo F1 (the far bank: no card, the road on to the Rest, no edge but the road's), W6b (Part Two's places
  sealed, he fallen or not), Q2 (the way on shut past the knight), C1 (the one card, the Dragon Road unbegun until Part
  Two), PR1 (the Pilgrim's Road walked without Part Two), and the companion's gate test.
- Part Two's way onto the continent is no longer the far bank's edge (it was until 2026-10-26): it is the road on east,
  Emberfall and the pass.

## 2. The valley

The west bank was 64 walkable cells of which 53 were generated wild. It is now drawn by hand
(`continent/generate.ts` `POCKET`): peaks close the north and west, snow above Cloudtop, a bay takes the south-west, and
ten wild cells are left between the hand-made places — the high snow over Cloudtop, Dawn Hill's crag, Millbrook's
fields, the wayside between the mill, the grassland and the dell, the Westwood behind the dell and the hollow, the river
meadow below the barrow. `npm run continent` makes the continent round it as before; only the pocket's rows changed.
Older saves: `migrateOverworld` v5 moves what stood on a cell now closed to the nearest open one.

Each of the ten is a place (content `valley.ts` `VALLEY`): still a wilderness made from the seed and its cell, with a
name (on the map and the world map), a quieter ground and a small scene drawn by hand laid over it — the High Snow's
cairn and a lost pilgrim's bones and pack, Dawn Hill's crag with a wild hive, Millbrook's fields with their hay and
scarecrow, the Wayside's crossroads with its signpost, bench and lantern, the Westwood's hunter's camp, still pool,
fallen giant, woodsman's grave and abandoned shelter, and the River Meadow's jetty. `tools/test/valley.test.ts` holds
the list to the walkable cells of the pocket. On the world map a snowfield shows pines under snow, and Millbrook a
watermill (`tools/src/art/worldmap.ts`).

## 3. Firstlight Village

- **Redrawn to the showcase's standard** (2026-10-26, docs/showcase.md): the village's own buildings
  (`tools/src/art/arch/buildings/firstlight.ts`: low cottages of timber and wash under thatch, the elder's of stone, the watch
  house under slate with its banner, the store with its awning and goods, the smithy under its sign, the chapel of grey
  stone with a bell-cote over its door, Joss's house, Edda's hut) stand on the cells the story keeps (`village.ts` `TOWN`:
  the chapel's door on the step above Astra's altar; the square, its well, fire, boards and cart where every scene and
  test finds them). The ground is laid in code (`firstlightGround`: the woods, the four roads on the cells the
  neighbouring maps meet, the square, the pond, the footpaths to every door); every front is piled with what a house uses
  and the lanes strung with washing, all of it stamped pictures (`showcase/dress.ts`), never things the story does not ask
  for. The hand-drawn `maps/meadow.txt` is gone.
- **Its yards** (`village.ts` `villageLife`): Marta's kitchen patch, the woodcutter's yard (stump, split logs, wood pile,
  the workbench), the drill yard by the watch house with its lookout tower, the trades' frontage, the hay meadow and its
  stacks, the fields in their strips behind a rail with their scarecrow, the orchard and its hives, the churchyard in its
  clearing, the lane house's garden and washing line, a trough on the road, the green banners and the village's name where
  the road comes in. Every fence joins (§5).
- **Houses of rooms** (`village.ts` `villageInteriors`): each house is a hall on its own plan (`plans.ts` `fl*`, its walls
  the plan's shell as the showcase's halls are), its rooms side by side (a room behind another would be hidden by the wall
  between, as tall as the house) and joined by arches; the map records them as rooms of style `shell` (their walls are the
  shell's picture: the renderers draw no frame of the pack's for them). Marta's: the kitchen and the family's long table,
  her room, the children's. The watch house: the guard room and the bunks. The elder's: his study and his bedroom. The
  woodcutter's: the hearth room with Cass's loom, the bedroom. Joss's: his workshop and a narrow room. Edda's hut: one room
  and a pantry. The store: the shop, the storeroom, Greta's room. The smithy: the forge and Haldor's room. The chapel: the
  nave and two cells. All are peaceful. An older save is moved off what is now a wall (`migrateFirstlightHouses`).
- **Every household sleeps in its own beds** (`bed.<n>` anchors in its house) — it slept on the lawn at its doorstep
  before. A household's home is its house (`home.<h>` over the whole interior): what stands in it is theirs, and by night
  one walks into it as a trespasser.
- **Every building is walked through** (2026-10-25): nothing stands on a doorway or in the cell before a door or a
  doorway, and from the way in one reaches every room's floor, every door and doorway, every thing in a room and every
  named spot; the people's spots are reached, and every building's door from outside. Held on every map with rooms —
  the hand-made ones and every backdrop room — by `tools/test/interiors.test.ts`, each failure named by map and cell.
- Proved by demo F17 (the village) and F18 (the households, the doorways, what a house holds).

## 4. The Ford

The frost slime's corner is a frozen margin — rime on the bank running into an ice floe along the river — not a white
blob on the grass; the dry meadow is grass with gold clumps, not tinted squares; the far bank is closed but for the road,
which goes on east to the Pilgrims' Rest (§1).

## 4b. The rest of the valley

Every hand-made map of the west bank to the same standard, its ground drawn by hand (`maps/<map>.txt`, and
`maps/<map>.heights.txt` where it rises, read by `MapBuilder.lift`):

- **Cloudtop**: a snowfield under its crags, the watchman's roofless hut against them, pines in the snow, the cut down
  through the rock at the south and a lookout bench on the rim. **The Mountain Foot**: the mountain's tiers over it with
  the trail down a cleft, the seal stone on old paving between pillars, the hunter's cabin (a room behind its door,
  `foot.hut`) in its yard. **The Clearing**: a hollow in old woods, a spring, berry bushes, a cold stone ring (it takes
  the drill's fire: demo T6).
- **The grassland**: the road through a herders' country — the fold of dry stone with its hay and trough, Brin's post at
  its gate, the hens' run, the hay meadow behind a wall, the watering pond, a knoll with an old tree. **The forest**: old
  woods closing every edge, the track crossing the woodcutters' clearing to a signposted fork, footpaths to the Dell, over
  the brook to the Reed Bend and down to the Hollow, a spring feeding the brook, the frostcap glade, the pilgrims' camp by
  the water (its tent drawn torn: `fixture/tent/torn`).
- **Thornwood Hollow**: a dell under the forest's ledge, ringed by thickets, the way down a ramp, the barrow's kerbed mound
  and stone arch at its foot. **The barrow, the ossuary, the sanctum**: an antechamber and galleries with niches, a charnel
  room and the hall of niches, an octagonal arena for the Warden (bones placed with them: demo C7).
- **Millbrook**: a watermill — the pond and its weir, the race down the mill's wall through its wheel and back round a
  willow island (a plank bridge over the race, another over the brook to a path west to the mill's fields), Tam's yard,
  the wheat behind its rail; the mill a house of rooms (`millhouse`: the millstones, the stair to the cellar, Tam's room),
  the cellar a vault. **Dawn Hill**: a hill in terraces — rock faces, a stair cut in them, flowers on the east slope, the
  chapel and its churchyard on the crown, the mine's timbered mouth in the west face; the chapel a nave and its bell tower,
  the mine an adit, a hall round a pillar, chambers. Demo V2.
- **The Charcoal Dell**: the burner's yard — the clamps with soot before their mouths, the stacked wood, the ring of stumps,
  his hut's yard, the old oak's glade; his hut two rooms. **The Reed Bend**: the river bending along the east, reed beds on
  mud and in the shallows, sand at a widened jetty with Hilde's boat, fish drying by a smoking fire, nets on poles, an old
  oxbow pond; her cabin three rooms. Demo FL2.
- **Redrawn to the showcase's standard** (2026-10-26, after Firstlight, §3): the country's houses are the project's own
  (`tools/src/art/arch/buildings/chapter1.ts`, drawn by the oblique renderer) on the cells the pack's stood — the
  hunter's cabin of dark logs (`ft_hut`, its walls wood: they burn, demo W13), Tam's watermill of two storeys over stone on
  its race (`mb_mill`, wooden walls against the wheel, demo V2), the Chapel of the First Dawn low and mossed under its empty
  bell-cote (`dh_chapel`), Orrin's sooty hut under thatch (`dl_hut`), Hilde's cabin of grey boards (`rb_cabin`) — each
  door on the cell the story keeps. Their rooms are halls on plans as Firstlight's are (`plans.ts` `fthut`, `mbmill`,
  `dlhut`, `rbcabin`, rooms side by side: the cabin and its lean-to, the mill floor with the cellar's stair and Tam's room,
  Orrin's room and coal store, Hilde's room, bedroom and store), every anchor, bed and named thing kept; a hall's feature
  (its hearth) stands on its widest room's head wall only. The wilds' ground is strewn with what lies there
  (`wildfloor.ts`: needles and twigs under the trees, mushrooms in their shade, stones under rock, now and then bones; in
  the barrow's three levels bones, fallen stones and cracked flags), all lying pictures laid last on each map, never a
  thing: the demo's proof is unchanged.

## 5. The pictures

What the game drew wrong, fixed where it was wrong, for every map that uses it:

| What | Was | Now |
|---|---|---|
| ground under buildings and fences | the wall tile, showing through every open part of a building's picture (black notches over roofs, dark seams beside walls, dark boxes behind rails) | the ground round them (`ground.ts` `groundBeneath`, both renderers) |
| fences | one straight piece each way: corners, ends at gates and joints broken | every joining piece of the three fences (`catalog.ts` `FENCE_PIECES`), each cell's chosen by its neighbours as the map is written (`MapBuilder.joinFences`) |
| barrels | cut a tile high: the lid sliced off | the whole 22px barrel |
| wood pile | a single log | the camp sheet's stack of split logs |
| washing line | the bare posts cut in half, a stub of laundry floating | the pack's line and its laundry put together (`tools/src/art/washing-line.ts`) |
| loom | the washing line's bare posts | a loom with its warp and cloth (`tools/src/art/loom.ts`) |
| scarecrow | the training dummy's picture | a scarecrow of its own (`tools/src/art/scarecrow.ts`) |
| weapon racks | the camp's cooking rack, pot and all | a rack of spears, a sword and a shield (`tools/src/art/arms-rack.ts`, `fixture/furniture/rack/arms`) |
| wheat | the camp sheet's kindling | three stages of wheat (`tools/src/art/wheat.ts`) |
| briar | a dark block | a thorny bramble (`tools/src/art/chapter1.ts`) |
| dry grass | tinted squares | grass under gold clumps |
| ice | pale squares over the river | a floe: the snow's sheet over water, tinted, joining the rime; water draws no shore against it |
| room frames | walls drawn across every cell of a ring | a doorway left open where floor runs through the wall |
| sand, mud | a plain tile each, a hard square on the grass | the dirt road's 47 pieces recoloured (`tools/src/art/flanks.ts`): soft edges against grass, none beside water or a road (`edgeOn`, `ground.ts`, both renderers) |
| reeds | the pack's grass tufts | clumps of cattails (`tools/src/art/flanks.ts`) |
| the kilns' ground | `ash`: dark squares under a grey tuft each | soot before each mouth, a soft apron (`fixture/nature/soot`) |
| drying nets | the camp's cooking rack, pot and all | nets hung on a pole (`fixture/furniture/rack/nets`); fish drying on their own rack (`…/rack/fish`) |
| log pile | the house sheet's carved plank, which read as a bench | the camp sheet's felled log |
| the rotted tent | the whole, patched tent | the pack's torn tent (`fixture/tent/torn`) |
| high ground | a thin line round a raised rectangle; then the pack's faces, dark vertical stripes that read as a fence, walked straight across | rock painted from the heights (`runtime/src/assets/relief.ts`, both renderers): bedded rock in masses and chunks with cracks, a lit lip, a snow cornice or grass fringe, a ragged shadowed foot with stones, a cell of face a level, stairs cut as steps, the region's rock; and the faces are rock to the engine too (`engine/src/relief.ts`: only stairs and ramps join levels, a ledge a level high is leapt down one way, a higher drop is a wall) |
| snow | trees and paths in it on a grass square; a grey path | snow under a tree or a rock standing in snow, the snow path's own tiles, a snowy pine or rock (`ground.ts` `objectLook`) |
| a pillar | a third, blocking cell with nothing drawn on it | its two tiles |
| the mill | a longhouse, no wheel; a windmill on the world map | a water wheel and millstones (`tools/src/art/mill.ts`), a bell rope for the chapel (`bell-rope.ts`); a watermill mark |
| the world map's snow | blank white squares | pines under snow |

New furniture for the houses, each a sub-type of what it is: the long table, the chest of drawers, the cupboard, the
potted plant (`content/src/ontology.ts`), with the pack's own pictures.

## 6. Open

- **Pictures still borrowed**: a bedroll is drawn as a framed bed; the pack has none. Millbrook's wheel does not turn.
  (Garrick's tool rack, the camp's cooking rack, is Emberfall's: Part Two.)
- **The editor and the layout files**: `maps/*.txt` are the map format's rows, but OpenWorld's maps are still built by
  code, so the editor cannot save into them yet.

## 7. The Pilgrim's Road and the Held Ground, redrawn (to do)

Part One's new maps to the standard Firstlight and its country were redrawn to (§3, §4b, 2026-10-26: docs/showcase.md),
one by one, each looked at in the browser: the Pilgrims' Rest, its chapel and hostel; the Pilgrim's Road; the Abbey of
the Thorn, its chapter hall and crypt; the Kneeling Field; the East Road and the burned farmhouse; the Held Ground and its
four grounds.

- **Their buildings are the project's own**, drawn by the oblique renderer (`tools/src/art/arch`, a module of their own
  under `arch/buildings/` as `firstlight.ts` and `chapter1.ts` are): the Rest's chapel of the Five and the pilgrims'
  hostel, the abbey's ruined cloister, chapter hall and church over its crypt, the burned farmhouse, the Held Ground's
  tent, stall and the buildings raised on its plots — each door on the cell the story keeps.
- **Their rooms are halls on plans** (`plans.ts`, rooms side by side joined by arches, recorded as rooms of style
  `shell`), every anchor, bed, fixture id and named thing kept; an older save moved off what is now a wall.
- **Their ground is laid in code** for what each place is — a road through a pilgrims' country, a ruin gone to weeds, a
  field of kneeling stones, a burned farm, a held field in rings of mist — not woods laid round a road by chance; fronts
  and yards dressed with stamped pictures (`showcase/dress.ts`), the wilds strewn last (`wildfloor.ts`); no thing the
  story does not ask for (the demo's minimality holds).
- Every building walked through (`tools/test/interiors.test.ts`); the edges closed but for the ways (`release.test.ts`).
  The knight's fight, the Crown's scene and the chapter's card played through with them.

## 8. Wiki

The pages that spoke of the far bank as the end (the Ford, the First Seal, the main line, the world map) say the road
goes on to the knight; Emberfall's, the mine's, the pass's, the lair's and the Dragon Road's say they are Part Two's.
