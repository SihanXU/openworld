// The prologue's maps (docs/prologue.md), north of the Ford and stacked down the mountain:
// Cloudtop (the summit plateau, where a new game begins) and the Mountain Foot. Cloudtop's only
// way down is a cut through the rock of its south rim; the foot's trail comes down off the high
// ground by a ramp, levels out where an old seal stone nobody can read stands in a ring of
// flowers, and runs out of the map's south edge at the top of the Ford's cliff. And the Clearing,
// the tutorial's own. Their ground is drawn by hand (maps/summit.txt, foot.txt, tutorial.txt and
// the heights beside them, docs/release-1.md).

import { MapBuilder } from './builder.ts'
import { TUTORIAL_DUMMY, TUTORIAL_OPEN } from '@openworld-game/content'
import { L, GROUND_YIELD, appears } from './kit.ts'
import { flHouse } from './village.ts'
import { bloom, rough, ruin, wildFloor } from './wildfloor.ts'

/** Edge openings: the foot's way in from the north (the tutorial's road comes out there), its way out below, the Ford's cliff stair. */
export const PROLOGUE = {
  summitSouth: [19, 20, 21],
  footNorth: [19, 20, 21],
  footSouth: [17, 18],
  fordNorth: [17, 18],
} as const

/** Where things are at the foot (the tests read these). */
export const PAT = {
  /** where a new game begins: in the ruined watch shelter on Cloudtop */
  spawn: [10, 5],
  /** the gap in the cut, Cloudtop's only way down */
  cut: [20, 20],
  /** the rune-cut seal stone: nothing in the world defines it */
  relic: [20, 12],
  footStone: [24, 20],
  /** the ramp down off the high ground (two columns wide), from its top */
  ramp: [20, 3],
} as const satisfies Record<string, readonly [number, number]>

/** The hunter's cabin at the foot: its top-left cell (a cabin of logs five cells by three, its door in the middle of its bottom row). */
export const FOOT_HUT = [4, 13] as const

// =================================================================== Cloudtop: the summit

export function buildSummit(): MapBuilder {
  // (drawn by hand since 2026-10-21, docs/release-1.md: the layout file is the ground — the crags of the peaks behind,
  // the snowfield and the shelter built against them, the wind-bent pines in their lee, the patches the wind has
  // scoured to the tussock, the rim of rock along the plateau's south edge with the cut through it, the face below and
  // the way down between rock and pine to the Mountain Foot. A trail trodden in the snow runs from the door to the cut.)
  const m = new MapBuilder('summit', L('Cloudtop', '云顶台地'), 'wild', 40, 30, 'snow', 'cloudtop', 'outdoor', 'frostfang')
  m.paint('summit')
  // the ruined watch shelter one wakes in: low walls of dry stone built against the crags, roofless, fallen in at its
  // north-west corner and on its west side, its doorway on the south toward the cut, the hearth's chimney still standing
  // (art/arch/buildings/prologue.ts); snow has drifted in where the wall is down, and a stone that fell lies outside
  m.building('ct_shelter', 6, 3)
  // what the watchman left: his cot, his chair at the table his log lies on (chapter1.ts), a barrel of stores long empty
  m.fixture('fixture/furniture/bed', 7, 7)
  m.fixture('fixture/furniture/chair', 12, 4)
  m.fixture('fixture/container/barrel', 13, 7)
  // the lookout on the rim: a log to sit on over the drop, where one sees the valley below
  m.fixture('fixture/furniture/bench/log', 31, 19)
  // what lies before the shelter: berries on the crowberry in the tussock, sticks under the pines, stones by the
  // outcrops, grass in the tussock — what an axe is made of
  for (const [x, y] of [[6, 10], [8, 11], [4, 12]] as const) m.item('item/food/berries', x, y)
  for (const [x, y] of [[27, 7], [29, 12]] as const) m.item('item/material/stick', x, y)
  for (const [x, y] of [[21, 9], [12, 16]] as const) m.item('item/material/stone', x, y)
  for (const [x, y] of [[6, 11], [7, 13]] as const) m.item('item/material/grass', x, y)
  // small things where they belong: tufts in the tussock (the snow has its own, drawn with the ground)
  m.sprinkle('fixture/nature/tuft', 0.3, (_x, _y, t) => t === 'drygrass')
  // the old way down, given up: the cairn the watchman found the small light by (his log, chapter1.ts), the signal
  // tower's stump in the lee of the rocks, columns that marked the way through the snow, and the way's gate, an arch
  // alone in the rim over the cut
  ruin(m, 'ct_cairn', 17, 6)
  ruin(m, 'snow_ruin_tower', 31, 13)
  ruin(m, 'ct_waymark_0', 13, 10)
  ruin(m, 'ct_waymark_1', 21, 15)
  ruin(m, 'ct_waymark_0', 17, 18)
  m.building('snow_ruin_arch', PAT.cut[0] - 1, PAT.cut[1])
  // what lies about: needles under the pines, stones shed at the crags, never in the shelter
  wildFloor(m, 1, (x, y) => x >= 6 && x <= 14 && y >= 3 && y <= 8)
  // the heights, drawn by hand: the crags two levels above the plateau, their face along its north side (the shelter
  // built against it), and the plateau two levels above the way down, the rim's face below it; in the cut a ramp, each
  // row half a level lower
  m.lift('summit.heights')
  const [cx, cy] = PAT.cut
  for (const [dy, h] of [[0, 3], [1, 2], [2, 1]] as const) m.raise(cx, cy + dy, 1, 1, h)
  m.anchor('spawn', ...PAT.spawn)
  // the ground's yield as everywhere (GROUND_YIELD), on the ground there is here: sticks and stones in the snow, grass in
  // the tussock
  m.appear = [appears('item/material/stick', ['snow'], 6), appears('item/material/stone', ['snow'], 5), appears('item/material/grass', ['drygrass'], 6)]
  return m
}

// =================================================================== the Mountain Foot

export function buildFoot(): MapBuilder {
  // (drawn by hand since 2026-10-21, docs/release-1.md: the layout file is the ground — the mountain over the north, its
  // crags and the ledge of fallen rock under them, the cleft the trail comes down through, the scree at the foot of the
  // face; the old ground of the seal stone, paved and gone to flowers; the hunter's hut and its yard; the meadows and
  // the woods round them, open only where the trail runs out south to the top of the Ford's cliff.)
  const m = new MapBuilder('foot', L('Woundstone Foot', '伤石山麓'), 'wild', 40, 30, 'grass', 'field', 'outdoor', 'frostfang')
  m.paint('foot')
  // the heights, drawn by hand: the crags two levels above the ledge, the ledge two above the foot, its edge a face of
  // rock — a ramp runs down the cleft where the trail does (each row half a level lower), a drop anywhere else hurts
  m.lift('foot.heights')
  const [rx, ry] = PAT.ramp
  for (const [dy, h] of [[1, 3], [2, 2], [3, 1]] as const) m.raise(rx, ry + dy, 2, 1, h)
  // where the trail levels out: an old seal stone nobody can read, on a round of worn paving gone to flowers, two
  // pillars of whatever stood round it still standing
  m.fixture('fixture/sacred/seal_stone', ...PAT.relic)
  m.regions.relic = [14, 7, 13, 10]
  m.fixture('fixture/sacred/waypoint', ...PAT.footStone, { id: 'wp.foot', name: L('Woundstone Foot statue', '伤石山麓传送雕像') })
  // the hunter's cabin, long left (its room: buildFootHut), built of wood and burning like it; its yard before the door:
  // a rail fence round the trodden ground, fallen in places, the block he split wood on, the wood he split stacked
  // against the wall, the rack he hung meat on, bones; a footpath from the door through the gate to the trail
  const [hx, hy] = FOOT_HUT
  m.building('ft_hut', hx, hy, ['hut'])
  // the wood he split stacked against the cabin's west end, bones of his kills by the rack
  m.building('decor_firewood', hx - 1, hy + 2)
  m.building('decor_bones', 6, 18)
  m.fence('rail', [3, 16], [3, 20], [[3, 18]])
  m.fence('rail', [4, 20], [10, 20], [[7, 20]])
  m.fence('rail', [10, 16], [10, 19], [[10, 18]])
  m.fixture('fixture/nature/logpile/stack', hx + 5, hy + 2)
  m.fixture('fixture/nature/stump', 8, 16)
  m.fixture('fixture/furniture/rack', 4, 17)
  for (const [x, y] of [[5, 19], [9, 19]] as const) m.item('item/material/bone', x, y)
  m.fixture('fixture/sign', 20, 25, { props: { text: 'Vesper Ford ↓', text_zh: '晚祷渡 ↓' } })
  // small things where they belong: stones shed under the face, tufts in the scree, flowers along the trail, leaves
  // under the woods
  const rock = (t: string) => t === 'rock' || t === 'cave_wall'
  const tree = (t: string) => t === 'tree' || t === 'pine'
  const road = (t: string) => t === 'path'
  const open = (t: string) => t === 'grass' || t === 'drygrass'
  m.sprinkle('fixture/nature/pebbles', 0.25, (x, y, t) => open(t) && y >= 8 && y <= 10 && (x < 9 || x > 29))
  m.sprinkle('fixture/nature/tuft', 0.3, (_x, _y, t) => t === 'drygrass')
  m.sprinkle('fixture/nature/flowers', 0.12, (x, y, t) => t === 'grass' && y > 13 && m.near(x, y, road))
  m.sprinkle('fixture/nature/leaves', 0.16, (x, y, t) => t === 'grass' && y > 9 && m.near(x, y, tree))
  m.sprinkle('fixture/nature/tuft', 0.05, (x, y, t) => t === 'grass' && y > 9 && !m.near(x, y, rock))
  // the ground of the meadows: dry grass where the noise rises, bare earth where it falls, never in the yard
  const yard = (x: number, y: number) => x >= 3 && x <= 10 && y >= 13 && y <= 20
  rough(m, 2521, (x, y) => y >= 8 && !yard(x, y) && !(x >= 13 && x <= 27 && y >= 9 && y <= 16))
  // the old close round the stone, as the way's other places are (art/arch/buildings/wilds.ts): its walls fallen to their
  // last runs, its gate two columns where the trail comes in off the ramp; stumps of its colonnade, a saint toppled off
  // its plinth, its stones; a tower's stump out to the east
  ruin(m, 'ruin_wall_x4', 14, 9)
  ruin(m, 'ruin_column_1', 19, 9)
  ruin(m, 'ruin_column_2', 22, 9)
  ruin(m, 'ruin_wall_x4', 23, 9)
  ruin(m, 'ab_wall_y4', 13, 11)
  ruin(m, 'ab_wall_y3', 27, 10)
  ruin(m, 'ruin_stump_1', 15, 12)
  ruin(m, 'ruin_stump_2', 25, 12)
  ruin(m, 'ruin_stump_0', 15, 16)
  ruin(m, 'ruin_stump_1', 25, 16)
  ruin(m, 'ruin_tower', 29, 11)
  ruin(m, 'decor_waycross', 22, 24)
  for (const [name, x, y] of [['decor_column_fallen', 17, 15], ['decor_statue_fallen', 26, 14], ['decor_stones', 15, 14], ['decor_stones', 24, 11], ['decor_stones', 12, 10], ['decor_stones', 28, 13]] as [string, number, number][]) m.building(name, x, y)
  wildFloor(m, 1, (x, y) => (x >= 14 && x <= 26 && y >= 7 && y <= 16) || (x >= 3 && x <= 10 && y >= 13 && y <= 20))
  bloom(m, 1, (x, y) => x >= 3 && x <= 10 && y >= 13 && y <= 20)
  m.appear = GROUND_YIELD
  return m
}

/**
 * The hunter's cabin at the foot, long left: one room of wood — his cot against the wall, a cold hearth, the rack his
 * spears stood in, a table and a chair, a barrel. He went into the woods and did not come back for his gloves (on the
 * block in the yard: chapter1.ts).
 */
export function buildFootHut(): MapBuilder {
  // (a hall of its plan, plans.ts fthut: the room and, through the side, the lean-to where he kept his stores)
  const { m, P } = flHouse('fthut', 'foot.hut', "The Hunter's Cabin", '猎人小屋', 'floor_wood', ['room', 'store'])
  m.zone = 'combat'
  const R = P.room
  m.fixture('fixture/furniture/bed', R.x, R.y + 1)
  m.fixture('fixture/furniture/rack/arms', R.x + 2, R.y)
  m.fixture('fixture/light/fireplace', R.x + 5, R.y)
  m.rect(R.x + 3, R.y + 3, 3, 2, 'carpet')
  m.fixture('fixture/furniture/table', R.x + 4, R.y + 3)
  m.fixture('fixture/furniture/chair', R.x + 3, R.y + 3)
  m.fixture('fixture/container/barrel', R.x + 7, R.y + 5)
  m.building('decor_firewood', R.x + 7, R.y)
  // the lean-to: a sack and crates of what he lived on, gone to dust; his kindling
  const S = P.store
  m.fixture('fixture/container/sack', S.x, S.y)
  for (const y of [S.y, S.y + 1]) m.fixture('fixture/container/crate', S.x + 2, y)
  m.building('decor_firewood', S.x, S.y + 4)
  return m
}

// =================================================================== the tutorial

/** The tutorial clearing: where a new game begins unless the player skips it (then: the Mountain Foot). */
export const TUTORIAL = {
  size: [36, 26],
  /** where one comes round */
  spawn: [12, 12],
  /** the path out, south, two columns wide: open once the story says so */
  exit: [17, 18],
  /** where one comes out at the foot: the top of its trail */
  arrive: [20, 1],
  /** what lies about the clearing to begin with */
  berries: [[11, 10], [14, 11], [13, 14], [9, 11], [15, 13], [12, 16]],
  sticks: [[8, 13], [16, 9], [9, 16]],
  stones: [[7, 10], [15, 15], [10, 17], [17, 12]],
  grass: [[6, 12], [13, 8], [11, 15], [16, 14], [8, 9]],
  /** the grove on the clearing's east side: the wood a house is made of */
  grove: [[25, 9], [28, 8], [27, 12], [30, 11], [26, 15], [29, 16], [31, 13]],
} as const

/**
 * The tutorial (docs/prologue.md): a clearing ringed by forest where one comes round, finds food,
 * gathers, makes an axe, cuts wood, lights a fire, builds a house and gets through a night. It lies
 * on no cell of the overworld and nothing leads back into it: a scene played once. Its one way out,
 * the path south to the Mountain Foot, opens on the first morning after the house stands. It is a
 * combat zone: the night's walkers come.
 */
export function buildTutorial(): MapBuilder {
  const [w, h] = TUTORIAL.size
  // (drawn by hand since 2026-10-21, docs/release-1.md: the layout file is the ground — a hollow of grass in old woods,
  // thick at its corners; a spring under the north trees, flowers in the sun beside it, the berry bushes round where one
  // comes to, the grove standing apart on the east side, and the woods opening south into a funnel where the path runs
  // out. The house goes up on open ground east of the berries, TUTORIAL_HOUSE.)
  const m = new MapBuilder('tutorial', L('The Waking Glade', '初醒林地'), 'wild', w, h, 'grass', 'forest', 'outdoor', 'frostfang')
  const exit = TUTORIAL.exit as readonly number[]
  m.paint('tutorial')
  for (const [x, y] of TUTORIAL.grove) if (m.get(x, y) !== 'tree') throw new Error(`tutorial: the grove's tree at ${x},${y} is not in the layout`)
  // someone slept here before: a ring of stones round cold wood, a log to sit on by it
  m.fixture('fixture/build/ring', 6, 17)
  m.fixture('fixture/furniture/bench/log', 6, 15)
  // where the path leaves the clearing, a weathered sign
  m.fixture('fixture/sign', exit[1] + 1, h - 6, { props: { text: 'DOWN — Woundstone Foot.', text_zh: '往下——伤石山麓。' } })
  // small things where they belong: reeds and stones round the spring, ferns and leaves under the woods' edge, mushrooms
  // in their shade — never on the ground the lessons work (where things lie, the house, the fire, the dummy)
  const water = (t: string) => t === 'water'
  const tree = (t: string) => t === 'tree' || t === 'pine'
  const grass = (t: string) => t === 'grass'
  const work = (x: number, y: number) => x >= 5 && x <= 24 && y >= 7 && y <= 19
  m.sprinkle('fixture/nature/reeds', 0.45, (x, y, t) => grass(t) && m.near(x, y, water))
  m.sprinkle('fixture/nature/pebbles', 0.3, (x, y, t) => grass(t) && m.near(x, y, water))
  m.sprinkle('fixture/nature/ferns', 0.25, (x, y, t) => grass(t) && !work(x, y) && m.near(x, y, tree) && (x < 12 || y > 18))
  m.sprinkle('fixture/nature/leaves', 0.2, (x, y, t) => grass(t) && !work(x, y) && m.near(x, y, tree))
  m.fixture('fixture/nature/mushroom_ring', 4, 9)
  m.fixture('fixture/nature/moss', 13, 3)
  for (const [x, y] of TUTORIAL.berries) m.item('item/food/berries', x, y)
  for (const [x, y] of TUTORIAL.sticks) m.item('item/material/stick', x, y)
  for (const [x, y] of TUTORIAL.stones) m.item('item/material/stone', x, y)
  for (const [x, y] of TUTORIAL.grass) m.item('item/material/grass', x, y)
  // a training dummy beside where the house goes: the tutorial's blow lesson (it stands up again)
  m.fixture('fixture/dummy', TUTORIAL_DUMMY[0], TUTORIAL_DUMMY[1])
  m.regions.exit = [exit[0] - 3, h - 5, 8, 5]
  // the way out: only once the story has opened it
  for (const [i, x] of exit.entries()) m.portals.push({ x, y: h - 1, to: 'foot', tx: TUTORIAL.arrive[0] + i, ty: TUTORIAL.arrive[1], label: L('Woundstone Foot', '伤石山麓'), opensWhen: TUTORIAL_OPEN })
  m.anchors.spawn = [TUTORIAL.spawn[0], TUTORIAL.spawn[1]]
  // what was here before the woods: the spring rising under an old wall of the Five, its niche and its five marks
  // (art/arch/buildings/prologue.ts), columns of whatever stood round it, a saint fallen by the water; and the oak the
  // clearing grew round, its crown over the woods' west edge — none of it on the ground the lessons work
  const lessons = (x: number, y: number) => (x >= 4 && x <= 25 && y >= 6 && y <= 20) || (x >= exit[0] - 3 && x <= exit[0] + 4 && y >= h - 6)
  rough(m, 2541, (x, y) => !lessons(x, y) && y > 2)
  ruin(m, 'cl_spring', 14, 2)
  ruin(m, 'cl_oak', 1, 6)
  ruin(m, 'ruin_low_x3', 10, 3)
  ruin(m, 'ruin_low_x2', 19, 3)
  ruin(m, 'ruin_stump_1', 11, 5)
  ruin(m, 'ruin_stump_2', 21, 5)
  ruin(m, 'ruin_low_x3', 25, 5)
  for (const [name, x, y] of [['decor_statue_fallen', 8, 4], ['decor_column_fallen', 23, 6], ['decor_stones', 13, 4], ['decor_stones', 19, 6]] as [string, number, number][]) m.building(name, x, y)
  // what lies about under the woods' edge — never on the ground the lessons work, nor on the way out
  wildFloor(m, 1, lessons)
  bloom(m, 1.4, lessons)
  // the clearing's own: berries keep turning up, enough to eat one's fill before the night
  m.appear = [...GROUND_YIELD, appears('item/food/berries', ['grass'], 6)]
  return m
}
