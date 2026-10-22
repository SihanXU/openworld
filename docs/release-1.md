# Release 1: Part One, the west bank

Status: **agreed 2026-10-21; the ending, the valley, Firstlight, the Ford and every map of the valley built (2026-10-21).** Release 1 is the
game's first part, played on the Frostfang Coast's west bank: from waking on Cloudtop, down the mountain, through
Firstlight and its country — the grassland, the forest, Thornwood Hollow and the barrow, Millbrook and Dawn Hill, the
Charcoal Dell and the Reed Bend — to the far bank of the Ford. The rest of the world stays as it is: the Pilgrim's Road,
Alberic and the dragon are Part Two, already built and played by the team behind one fact.

The user's decisions (2026-10-21): the release ends at the river; the walkable west bank shrinks to a valley of places
with a reason to walk between them; the maps are polished one by one from Firstlight and the Ford, their ground drawn by
hand; every picture the game shows there is cut and drawn right. Still open: whether the Held Ground (now reached only
past the knight) comes into Part One, and how (§6).

## 1. The ending and the sealed road

- **`world.part2`** (content `regions.ts` `PART_TWO`) is the fact the second part waits for. No rule sets it in
  release 1; the dev console (or a test, by the author's hand) sets it to play on. `world.` is a protected prefix: no
  learned rule may set it.
- **The ending** is the story step `part_one` (`tools/src/demo/world.ts`): on the Ford's far bank with the First Seal at
  its river stage (40) and Part Two unopened, Lumi looks down the road and the card plays — "PART ONE · THE FORD". The
  west bank stays the player's afterwards (the game's sandbox after its ending, game-design.md §1).
- **The road east is sealed**: the Ford's east portal to the Pilgrims' Rest has `opensWhen: world.part2`; the far bank's
  north, south and east edges are woods but for the road; the rider's thorns grow across it under a signpost that says
  why. The engine never lets the player off a map's edge from a portal the story has not opened (`stepSelf`: a sealed
  way leads nowhere), so the far bank cannot be left for the world map east of the river. On the world map the Rest, the
  Pilgrim's Road, the abbey, the Kneeling Field and the East Road are sealed sites, saying why (`SITE_GATES`).
- Proved by demo F1 (the card once, the edge refused, the Rest's site shut; with Part Two open, no card) and by Q2 and
  PR1, which open Part Two to walk the road.

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

- **Its ground is drawn by hand**: `tools/src/demo/maps/meadow.txt`, a character a cell in the map format's own
  characters, read by `MapBuilder.paint`. The woods ring it with thick corners; the square of cobble lies before the
  chapel; the east road comes in from the Ford two wide, lanes go north, west and south, footpaths run to each door
  (always four-connected: a diagonal path comes apart). The editor does not yet write these files back (§6).
- **Its yards** (`village.ts` `villageLife`): Marta's kitchen patch, the woodcutter's yard (stump, split logs, wood pile,
  the workbench), the drill yard by the watch house with its lookout tower, the trades' frontage, the hay meadow and its
  stacks, the fields behind a rail with their scarecrow, the orchard and its hives, the churchyard in its clearing, the
  lane house's garden and washing line, a trough on the road, the green banners and the village's name where the road
  comes in. Every fence joins (§5).
- **Houses of rooms** (`village.ts` `house`): each house is rooms of its own walls side by side, joined by doorways — the
  pack's way of joining rooms. Marta's: the kitchen and the family table, her room, the children's. The watch house: the
  guard room and the bunks. The elder's: his study and his bedroom. The woodcutter's: the hearth room with Cass's loom,
  the bedroom. Joss's: his workshop and a narrow room. Edda's hut: one room and a pantry. The store: the shop, the
  storeroom, Greta's room. The smithy: the forge and Haldor's room. The chapel: the nave and two cells. All are peaceful.
- **Every household sleeps in its own beds** (`bed.<n>` anchors in its house) — it slept on the lawn at its doorstep
  before. A household's home is its house (`home.<h>` over the whole interior): what stands in it is theirs, and by night
  one walks into it as a trespasser.
- Proved by demo F17 (the village) and F18 (the households, the doorways, what a house holds).

## 4. The Ford

The frost slime's corner is a frozen margin — rime on the bank running into an ice floe along the river — not a white
blob on the grass; the dry meadow is grass with gold clumps, not tinted squares; the far bank is closed but for the road,
and the road east ends in the rider's thorns (§1).

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
| high ground | a thin line round a raised rectangle | the relief's rims and rock faces where ground drops a level, taller for a bigger drop, a stair's steps (`ground.ts` `terracePieces`, `tools/src/art/terrace.ts`, both renderers) |
| snow | trees and paths in it on a grass square; a grey path | snow under a tree or a rock standing in snow, the snow path's own tiles, a snowy pine or rock (`ground.ts` `objectLook`) |
| a pillar | a third, blocking cell with nothing drawn on it | its two tiles |
| the mill | a longhouse, no wheel; a windmill on the world map | a water wheel and millstones (`tools/src/art/mill.ts`), a bell rope for the chapel (`bell-rope.ts`); a watermill mark |
| the world map's snow | blank white squares | pines under snow |

New furniture for the houses, each a sub-type of what it is: the long table, the chest of drawers, the cupboard, the
potted plant (`content/src/ontology.ts`), with the pack's own pictures.

## 6. Open

- **The Held Ground in Part One.** It opens with the Oath-Thorn, from the fallen knight (chapter-1.md §12), so release 1
  never reaches it. Bringing it in needs the story to give it another way in and another steward before the knight.
- **Pictures still borrowed**: Garrick's tool rack (Emberfall, Part Two) is the camp's cooking rack; a bedroll is drawn
  as a framed bed; the pack has neither. Millbrook's wheel does not turn.
- **The editor and the layout files**: `maps/*.txt` are the map format's rows, but OpenWorld's maps are still built by
  code, so the editor cannot save into them yet.
