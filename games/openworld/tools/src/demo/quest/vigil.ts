// Firstlight's own country (docs/chapter-1.md §13): what the village's vigil asks for, after the rescue and before the
// night of thanks — Millbrook to the west (the miller's press, its cellar, where the vigil oil is kept) and Dawn Hill to
// the north (where the first dawn after the First Night was seen: dawnbloom on its slopes, the ruined Chapel of the
// First Dawn on its top, and the bell that was rung that morning) — and, dug into the hill's western flank, the Dawn
// Hill Mine: the first chapter's ore for the smithy, its veins growing back in a day where they were mined.

import type { AiData } from '@openworld/engine'
import { MapBuilder } from '../builder.ts'
import { L, GROUND_YIELD, appears } from '../kit.ts'
import { house } from '../village.ts'

/** Edge openings: Firstlight's new west gap (rows) and north gap (columns), and where they meet the new maps. */
export const VIGIL = {
  villageWest: [17, 18, 19],
  millEast: [17, 18, 19],
  villageNorth: [24, 25, 26],
  hillSouth: [19, 20, 21],
  /** where the vigil's things are: the oil on the cellar's back shelves, dawnbloom on Dawn Hill's east slope, the Dawnstone on its crown */
  oil: [[4, 3], [11, 3]] as const,
  bloom: [[31, 14], [33, 11], [31, 17], [34, 15]] as const,
  stone: [28, 5] as const,
  /** Dawn Hill's waypoint, at the head of the first stair */
  statue: [22, 17] as const,
} as const

/** The Chapel of the First Dawn on Dawn Hill's crown (its door the middle of its bottom row). */
const CHAPEL_AT = [19, 2] as const

const HUNT = (sight = 5): Omit<AiData, 'home'> => ({ behaviour: 'melee', temper: 'aggressive', sight, leash: 6 })

// =================================================================== Millbrook

/** Millbrook's mill: the building (its door the second column of its bottom row) and its wheel in the race against its west wall. */
export const MILL = { house: [15, 11] as const, wheel: [12, 12] as const, field: [22, 4, 12, 9] as const }

/**
 * Millbrook, drawn by hand (release 1, docs/release-1.md): its ground `maps/mill.txt`. The brook comes down from the
 * hills in the north into Tam's mill pond; stones laid across the pond's outlet are the weir, and the brook goes on
 * south over them; the race leaves the pond's east end and runs down the mill's west wall, through the wheel, and back
 * west into the brook, round the willows of the island between them. The mill stands on the race, its door on Tam's
 * yard (sacks, a barrel, the cart), the road from Firstlight coming in from the east; north of the yard, between the
 * mill and the field, a lane up to the pond's bank; east of the lane, his wheat behind its rail, the scarecrow over it,
 * gone thin in the short days; south of the road a meadow; woods round it all.
 */
export function buildMillbrook(): MapBuilder {
  const m = new MapBuilder('mill', L('Millbrook', '水车磨坊'), 'village', 40, 30, 'grass', 'millbrook', 'outdoor', 'frostfang')
  m.zone = 'peaceful'
  m.paint('mill')
  m.fish = true
  const grass = (t: string) => t === 'grass'
  const tree = (t: string) => t === 'tree' || t === 'pine'
  const water = (t: string) => t === 'water' || t === 'deepwater'
  const road = (t: string) => t === 'path' || t === 'dirt'
  // the mill on its race, the wheel against its west wall; the weir's stones across the pond's outlet
  m.house('inn', ...MILL.house, 'mill')
  m.scenery('waterwheel', ...MILL.wheel)
  for (const x of [4, 5, 6]) m.fixture('fixture/nature/boulder', x, 9, { name: L('A stone of the weir', '堰石') })
  // Tam minds the wheel from the race's bank below it; sleeps in his room in the mill (buildMillHouse)
  m.anchor('mill.yard', 15, 17)
  // his yard: grain sacks and a barrel by the door, the cart he takes the flour to the village in
  for (const [x, y] of [[18, 16], [19, 16]] as const) m.fixture('fixture/container/sack', x, y, { name: L('Grain sack', '麦袋') }, ['item/material/wheat'])
  m.fixture('fixture/container/barrel', 17, 16)
  m.fixture('fixture/furniture/cart', 23, 16, { props: { owner: 'npc.tam' } })
  // the field behind its rail, the gate on the lane; ripe wheat at its north end, young further down, the last rows bare
  const [fx, fy, fw, fh] = MILL.field
  m.yard(fx, fy, fw, fh, 'rail', [[fx, fy + 4]])
  for (let y = fy + 1; y < fy + fh - 1; y++)
    for (let x = fx + 1; x < fx + fw - 1; x++) {
      const row = y - fy - 1
      if (x === fx + 6 && y === fy + 4) continue
      if (row < 3) m.fixture('fixture/crop/wheat/ripe', x, y)
      else if (row < 5 && (x + y) % 3 !== 0) m.fixture('fixture/crop/wheat/young', x, y)
    }
  m.fixture('fixture/scarecrow', fx + 6, fy + 4)
  for (const [x, y] of [[35, 6], [35, 9]] as const) m.fixture('fixture/nature/haystack', x, y)
  // a log bench on the pond's bank by the lane
  m.fixture('fixture/furniture/bench/log', 17, 5)
  m.fixture('fixture/sign', 34, 16, { props: { text: 'MILLBROOK — flour and lamp oil for Firstlight.', text_zh: '水车磨坊——为初原村供应面粉和灯油。' } })
  // reeds at the water, flowers along the road and in the meadow, tufts in the open, leaves under the woods
  m.sprinkle('fixture/nature/reeds', 0.4, (x, y, t) => grass(t) && m.near(x, y, water) && !m.near(x, y, road, 0))
  m.sprinkle('fixture/nature/flowers', 0.12, (x, y, t) => grass(t) && m.near(x, y, road, 1) && !m.near(x, y, tree, 2))
  m.sprinkle('fixture/nature/tuft', 0.06, (x, y, t) => grass(t) && !m.near(x, y, tree, 1) && !m.near(x, y, road, 1) && !m.near(x, y, water, 1))
  m.sprinkle('fixture/nature/leaves', 0.16, (x, y, t) => grass(t) && m.near(x, y, tree))
  m.appear = GROUND_YIELD
  return m
}

/** The stair down to the cellar, in the mill floor's north-east corner. */
const MILL_STAIR = [8, 1] as const
const hearthOf = (m: MapBuilder, x: number, y: number) => m.fixture('fixture/light/fireplace', x, y, { statuses: { lit: -1 } })

/**
 * Inside the mill (a house of rooms, village.ts): the mill floor — the millstones under their hopper, the grain and the
 * flour, the long table where it is bagged, the stair down to the cellar — and, through the side, Tam's own room.
 */
export function buildMillHouse(): MapBuilder {
  const m = house('millhouse', 'The Mill', '磨坊', 16, 10, 'wood', [[0, 0, 10, 10], [10, 2, 6, 6]], [[9, 4], [10, 4]], [4, 9])
  m.zone = 'peaceful'
  // the mill floor
  m.scenery('millstones', 2, 2)
  m.set(...MILL_STAIR, 'stairs_down')
  m.doors.cellar = [...MILL_STAIR]
  for (const [x, y] of [[1, 5], [1, 6], [2, 6]] as const) m.fixture('fixture/container/sack', x, y, { name: L('Flour sack', '面粉袋') })
  m.fixture('fixture/container/sack', 4, 2, { name: L('Grain sack', '麦袋') }, ['item/material/wheat', 'item/material/wheat'])
  m.fixture('fixture/furniture/table/long', 6, 6)
  m.fixture('fixture/container/barrel', 8, 6)
  m.fixture('fixture/container/crate', 8, 7)
  m.fixture('fixture/light/candles', 6, 2, { statuses: { lit: -1 } })
  m.fixture('fixture/craft/workbench', 2, 8, { name: L("The millwright's bench", '磨坊木工台') })
  // Tam's room: his bed by the hearth, a table, his chest
  hearthOf(m, 12, 3)
  m.fixture('fixture/furniture/bed', 14, 4)
  m.anchor('bed', 13, 4)
  m.fixture('fixture/furniture/table', 12, 5)
  m.fixture('fixture/furniture/chair', 11, 5)
  m.fixture('fixture/nature/plant', 13, 6)
  m.fixture('fixture/container/chest', 14, 6)
  return m
}

/**
 * The mill's cellar, down the stair: where the vigil oil is kept on the shelves at the back, and where something has
 * moved in. A vault on two pillars: barrels racked along the west wall, sacks and crates east, the damp corner in the
 * south-west where the brook seeps in (the slimes' corner), the spider by the shelves.
 */
export function buildMillCellar(): MapBuilder {
  const m = new MapBuilder('millcellar', L('The Mill Cellar', '磨坊地窖'), 'interior', 16, 12, 'floor_stone', 'cave', 'dark', 'frostfang')
  m.gearLevel = 2
  m.room('stone', 'floor_stone')
  // the way up: the stair in the south wall, where the door was
  m.set(...m.doors.out, 'stairs_up')
  // the damp corner: the flags sunk and wet where the brook seeps through, a puddle in the corner, moss on the stones
  for (const [x, y] of [[1, 7], [1, 8], [2, 8], [1, 9], [2, 9], [3, 9], [2, 10], [3, 10], [4, 10], [3, 8]] as const) m.set(x, y, 'cave_floor')
  m.set(1, 10, 'water')
  for (const [x, y] of [[4, 9], [2, 7], [5, 10], [1, 6]] as const) m.fixture('fixture/nature/moss', x, y)
  // the vault's two pillars
  for (const x of [5, 10]) m.scenery('pillar', x, 4)
  // the shelves at the back, the oil before them
  for (const x of [3, 4, 11, 12]) m.fixture('fixture/container/shelf', x, 2)
  for (const [x, y] of VIGIL.oil) m.item({ form: 'item/vessel/flask/oil', name: L('Vigil Oil', '守夜灯油') }, x, y)
  // barrels racked along the west wall, sacks and crates along the east
  for (const y of [3, 4, 5]) m.fixture('fixture/container/barrel', 1, y)
  for (const [x, y] of [[14, 4], [14, 5], [13, 5]] as const) m.fixture('fixture/container/sack', x, y)
  for (const [x, y] of [[14, 8], [14, 9], [13, 9]] as const) m.fixture('fixture/container/crate', x, y)
  m.fixture('fixture/light/candles', 9, 10, { statuses: { lit: -1 } })
  for (const [x, y] of [[3, 8], [6, 9]] as const) m.creature('slime/green_slime', x, y, HUNT(4))
  m.creature('spider', 8, 3, HUNT(4))
  return m
}

// =================================================================== Dawn Hill

/**
 * Dawn Hill, drawn by hand (release 1, docs/release-1.md): its ground `maps/dawnhill.txt`, its heights
 * `maps/dawnhill.heights.txt` (the faces drawn where it drops: ground.ts terracePieces). The village's lane comes up
 * from the south across the hill's foot; the hill's shoulder stands two levels over it behind a rock face (the face's
 * upper row is the rock itself, cave wall), and the road climbs it by a stair cut in the face, runs east along the
 * brow and up the east-facing slope where the dawnbloom grows, then back west and up a ramp to the crown, a level
 * higher again, where the Chapel of the First Dawn stands in its old churchyard and the Dawnstone looks east. West, a
 * track leaves the road along the foot of the face and ends at the mine's mouth in the rock of the west flank
 * (buildHillMine). Pines on the flanks, woods round the foot.
 */
export function buildDawnHill(): MapBuilder {
  const m = new MapBuilder('dawnhill', L('Dawn Hill', '晨光丘'), 'wild', 40, 30, 'grass', 'field', 'outdoor', 'frostfang')
  m.gearLevel = 2
  m.paint('dawnhill')
  m.lift('dawnhill.heights')
  const grass = (t: string) => t === 'grass'
  const tree = (t: string) => t === 'tree' || t === 'pine'
  const road = (t: string) => t === 'path' || t === 'dirt' || t === 'cobble'
  /** Under a rock face: the ground a level below the cell north of it (keep it clear, the face is drawn there). */
  const underFace = (x: number, y: number) => y > 0 && m.heights[y - 1][x] - m.heights[y][x] >= 2
  // the chapel on the crown, its forecourt before it; the churchyard of its old keepers west of it, its wall fallen in places
  m.house('temple', ...CHAPEL_AT, 'chapel')
  m.yard(13, 1, 5, 5, 'stonewall', [[17, 3], [13, 2], [15, 5], [16, 5]])
  for (const [x, y] of [[14, 3], [16, 3], [15, 2]] as const) m.fixture('fixture/sacred/gravestone', x, y, { name: L('A keeper of the chapel', '礼拜堂的守护人'), props: { text: 'The name is worn away. Under it, a small sun, rising.', text_zh: '名字已经磨平了。下面刻着一个小小的、正在升起的太阳。' } })
  // the stone where the first dawn was seen, on the crown's east brow, and dawnbloom on the east-facing slope below it
  m.fixture('fixture/sacred/seal_stone', ...VIGIL.stone, { name: L('The Dawnstone', '晨光石'), tags: ['readable'], props: { text: 'Cut deep, and old: HERE THE SUN ROSE AGAIN. Below, newer: five small wounds, and a flame.', text_zh: '刻得很深，也很古老：太阳在此重新升起。下面是较新的刻痕：五道小伤痕，和一团火。' } })
  for (const [x, y] of VIGIL.bloom) m.item({ form: 'item/material/herb', name: L('Dawnbloom', '晨光花') }, x, y)
  // the statue at the head of the first stair, beside the road
  m.fixture('fixture/sacred/waypoint', ...VIGIL.statue, { id: 'wp.dawnhill', name: L('Dawn Hill statue', '晨光丘传送雕像') })
  // wolves on the shoulder's west and at the foot's east woods
  for (const [x, y] of [[6, 10], [33, 24]] as const) m.creature('beast/wolf', x, y, HUNT(5))
  // up on the open top, where the storms break first: spark slimes, charged by them (docs/creatures.md §3.4); out at its
  // ends, beyond sight of the statue and the Dawnstone, so one who travels here or keeps the vigil is not set on at once
  for (const [x, y] of [[12, 8], [34, 4]] as const) m.creature('slime/spark_slime', x, y, HUNT(4))
  // west: the track to the mine's adit (buildHillMine), a sign where it leaves the road, a brazier at the mouth
  m.fixture('fixture/sign', 18, 23, { props: { text: '← The mine', text_zh: '← 矿洞' } })
  m.scenery('adit', 0, HILL_MINE.hillWest[0] - 2)
  m.fixture('fixture/light/brazier', 3, 20, { statuses: { lit: -1 } })
  // small things where they belong: flowers on the east slope and round the Dawnstone, tufts on the open shoulder, stones
  // fallen at the foot of the faces, leaves under the woods
  const east = (x: number) => x >= 26
  m.sprinkle('fixture/nature/flowers', 0.35, (x, y, t) => (grass(t) || t === 'flowers') && east(x) && m.heights[y][x] >= 2 && !underFace(x, y) && !m.near(x, y, road, 0))
  m.sprinkle('fixture/nature/tuft', 0.08, (x, y, t) => grass(t) && !east(x) && !underFace(x, y) && !m.near(x, y, tree, 1) && !m.near(x, y, road, 1))
  m.sprinkle('fixture/nature/pebbles', 0.3, (x, y, t) => grass(t) && underFace(x, y - 1) && !underFace(x, y))
  m.sprinkle('fixture/nature/leaves', 0.16, (x, y, t) => grass(t) && !underFace(x, y) && m.near(x, y, tree))
  m.appear = [...GROUND_YIELD, appears('item/material/herb', ['flowers', 'grass'], 3, 1200)]
  return m
}

// =================================================================== the Dawn Hill Mine

/** The mine in Dawn Hill's west flank: its size, its adit's rows on its east edge, and the hill's west-edge rows it opens onto. */
export const HILL_MINE = { w: 30, h: 22, east: [11, 12], hillWest: [18, 19] } as const

/**
 * The mine dug into Dawn Hill's western flank (docs/chapter-1.md §13), a field west of the village's smithy: the first
 * chapter's ore. An adit from the east edge runs west into a hall, the miners' store off it; a gallery climbs north of
 * the hall to a chamber, another drops south-east to the coal. Iron in the hall and the north chamber, coal in the
 * south, boulders fallen at the hall's mouth; braziers along the way; a worn pickaxe left at the mouth. A vein
 * mined grows back where it was in a day (content ontology.ts, spent veins). Bats roost here and come back; stone lies
 * about and comes back. No gold: that is the Old Mine's and the quarry's.
 */
export function buildHillMine(): MapBuilder {
  const m = new MapBuilder('hillmine', L('Dawn Hill Mine', '晨光丘矿洞'), 'dungeon', HILL_MINE.w, HILL_MINE.h, 'cave_wall', 'cave', 'dark', 'frostfang')
  m.gearLevel = 2
  // the rock and its floor drawn by hand (maps/hillmine.txt): the adit, the miners' store off it, the hall with the
  // rock left standing in it, the north chamber up its gallery, the coal chamber down the other
  m.paint('hillmine')
  const [ey] = HILL_MINE.east
  /** A thing of the mine stands on its floor (the map is checked as it is built). */
  const floor = (x: number, y: number): [number, number] => {
    if (m.get(x, y) !== 'cave_floor') throw new Error(`hillmine: ${x},${y} is ${m.get(x, y)}, not cave floor`)
    return [x, y]
  }
  // veins: iron in the north chamber and the hall, coal in the south chamber; boulders fallen in the hall's mouth
  for (const [x, y] of [[4, 8], [7, 1], [12, 3], [4, 4], [18, 10]] as const) m.fixture('fixture/nature/vein/iron', ...floor(x, y))
  for (const [x, y] of [[16, 16], [25, 17], [26, 18], [22, 19]] as const) m.fixture('fixture/nature/vein/coal', ...floor(x, y))
  for (const [x, y] of [[18, 9], [20, 12], [17, 14]] as const) m.fixture('fixture/nature/boulder', ...floor(x, y))
  for (const [x, y] of [[26, 10], [14, 8], [19, 16]] as const) m.fixture('fixture/light/brazier', ...floor(x, y), { statuses: { lit: -1 } })
  // the miners' store off the adit: props stacked for the galleries, a crate of tools, a water barrel
  m.fixture('fixture/nature/logpile/stack', ...floor(23, 9))
  for (const [x, y] of [[24, 8], [25, 8]] as const) m.fixture('fixture/container/crate', ...floor(x, y))
  m.fixture('fixture/container/barrel', ...floor(27, 9))
  // a worn pickaxe at the mouth: whoever walks up from the village can dig at once (one is two stones, two sticks and grass by hand too)
  m.item({ form: 'item/tool/pickaxe', material: 'stone', name: L('Worn Pickaxe', '磨损的镐') }, ...floor(27, ey + 1))
  for (const [x, y] of [[8, 3], [21, 17]] as const) m.creature('beast/bat', ...floor(x, y), { sight: 5 })
  // what lies about: chips of stone where the veins were worked; moss and mushrooms in the hall's low corner, where it seeps
  const vein = (x: number, y: number) => m.entities.some((e) => e.type.startsWith('fixture/nature/vein') && e.place.on === 'tile' && Math.max(Math.abs(e.place.x - x), Math.abs(e.place.y - y)) <= 1)
  m.sprinkle('fixture/nature/pebbles', 0.5, (x, y, t) => t === 'cave_floor' && vein(x, y))
  for (const [x, y] of [[6, 12], [7, 14], [6, 13], [9, 14], [8, 13]] as const) m.fixture('fixture/nature/moss', ...floor(x, y))
  m.fixture('fixture/nature/mushroom_ring', ...floor(10, 13))
  m.appear = [
    appears('item/material/stone', ['cave_floor'], 4),
    appears('actor/creature/beast/bat', ['cave_floor'], 2, 1800, { ai: { behaviour: 'melee', temper: 'aggressive', sight: 5 } }),
  ]
  return m
}


/**
 * The Chapel of the First Dawn: roofless, cold, its bell still hanging in the tower. The nave (the first hearth at its
 * head between two candles gone out, what is left of the benches, weeds come up through the flags where the roof fell
 * in, a fallen stone) and, through a doorway at its head, the foot of the bell tower, the rope hanging in it.
 */
export function buildChapel(): MapBuilder {
  const m = house('chapel', 'Chapel of the First Dawn', '初晓礼拜堂', 14, 12, 'stone', [[0, 0, 10, 12], [10, 0, 4, 7]], [[9, 4], [10, 4]], [5, 11], { floor: 'floor_stone', music: 'temple' })
  m.fixture('fixture/sacred/altar', 5, 2, { name: L('The first hearth', '最初的火坛'), tags: ['readable'], props: { text: 'A stone hearth, cold for centuries. Soot in the cracks: the Firstlight was kindled here from the dawn, and carried down the hill.', text_zh: '一座石砌的火坛，冷了几百年。裂缝里还有烟灰：初火就是在这里借着晨光点燃，再被带下山去的。' } })
  for (const [x, y] of [[3, 2], [7, 2]] as const) m.fixture('fixture/light/candles', x, y)
  // what is left of the benches, two either side of the aisle, one tipped over by the wall
  for (const [x, y] of [[3, 5], [7, 5], [3, 7], [7, 8]] as const) m.fixture('fixture/furniture/bench', x, y)
  // where the roof fell in: weeds through the flags, a fallen stone, moss, leaves blown in
  m.fixture('fixture/nature/boulder', 1, 6, { name: L('A fallen stone', '坠落的石块') })
  for (const [x, y] of [[1, 7], [8, 3], [4, 9], [2, 9], [8, 10]] as const) m.fixture('fixture/nature/moss', x, y)
  for (const [x, y] of [[6, 9], [2, 4], [8, 7], [5, 7]] as const) m.fixture('fixture/nature/leaves', x, y)
  for (const [x, y] of [[3, 9], [2, 8], [7, 6], [1, 10]] as const) m.fixture('fixture/nature/tuft', x, y)
  // the bell tower: the rope down its north wall, rung from the floor below it
  m.scenery('bell_rope', 11, 0)
  m.regions.belfry = [10, 1, 3, 2]
  m.creature('beast/bat', 6, 4, HUNT(4))
  return m
}
