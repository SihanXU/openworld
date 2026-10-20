// The forest's flanks (docs/chapter-1.md §15, 2026-10-13): two places off the forest's sides, each with one who lives
// there and what they ask. West, through the forest's side trail, the Charcoal Dell: Orrin the charcoal burner, his
// three kilns and his coppice, boars in the undergrowth — and the roost oak the forest's birds all fled to the night
// the bridge came down (why the forest is quiet). East, down the clearing's trail, the Reed Bend: the Ford's river
// bending south, Hilde the fisher's cabin and pier, the spit where her husband's boat bell lies among water slimes, a
// drowned stone older than the Church. Both are combat zones; both lie on the overworld (the bend on the river's own
// cell, a camp on the near bank one reaches only through the forest: the river stays the barrier it is, D22).

import type { AiData, StepDef } from '@openworld/engine'
import { MapBuilder, rng } from '../builder.ts'
import { L, GROUND_YIELD, appears, lay } from '../kit.ts'
import { home, room } from '../village.ts'

/** Edge openings: the forest's new west and east gaps (rows), and the rows they meet on the new maps. */
export const FLANKS = {
  forestWest: [14, 15, 16],
  dellEast: [14, 15, 16],
  forestEast: [16, 17, 18],
  bendWest: [16, 17, 18],
} as const

/** Where things are (the demo test reads these). */
export const FAT = {
  /** the three kilns' top-left corners (3 x 4 stamps) */
  kilns: [[12, 8], [17, 7], [22, 8]] as const,
  roost: [7, 12] as const,
  /** the pier's first plank, on the bend's bank */
  pier: [28, 12] as const,
  spit: [31, 21] as const,
  stone: [28, 6] as const,
} as const

const HUNT = (sight = 5): Omit<AiData, 'home'> => ({ behaviour: 'melee', temper: 'aggressive', sight, leash: 7 })
const has = (xs: readonly number[], v: number) => xs.includes(v)
const grassy = (t: string) => t === 'grass'
const wood = (t: string) => t === 'tree' || t === 'pine'
const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })

/** Woods round a map's edge, two to `deep` deep, open where `open(x, y)` says. */
function rim(m: MapBuilder, open: (x: number, y: number) => boolean, deep = 4): void {
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (open(x, y)) continue
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      if (edge < 2 || (edge < deep && rng.chance(0.5 - (edge - 2) * 0.15))) m.set(x, y, rng.chance(0.3) ? 'pine' : 'tree')
    }
}

/** The nearest free tile to (x, y). */
function spot(m: MapBuilder, x: number, y: number, walk = false): [number, number] {
  for (let r = 0; r <= 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        if (walk ? m.walkable(x + dx, y + dy) : m.free(x + dx, y + dy)) return [x + dx, y + dy]
      }
  throw new Error(`no open tile near ${m.id}:${x},${y}`)
}

// =================================================================== the Charcoal Dell

/** West of the forest: a dell of trodden earth where the charcoal burner keeps his kilns, coppice woods round it, boars in them, and the roost oak. */
export function buildDell(): MapBuilder {
  const m = new MapBuilder('charcoal', L('The Charcoal Dell', '烧炭谷'), 'wild', 40, 30, 'grass', 'forest', 'outdoor', 'frostfang')
  m.gearLevel = 2
  rim(m, (x, y) => x >= m.w - 4 && has(FLANKS.dellEast, y))
  // the coppice: woods cut and cut again, north and south of the dell — trees thick, old stumps among them
  // (stumps as things, not as the ground's stage: a map's own stage would start its clock as the map comes)
  const stumps: [number, number][] = []
  for (let y = 4; y < m.h - 4; y++)
    for (let x = 4; x < m.w - 4; x++) {
      if (y > 9 && y < 20) continue
      if (!grassy(m.get(x, y))) continue
      if (rng.chance(0.35)) m.set(x, y, rng.chance(0.3) ? 'pine' : 'tree')
      else if (rng.chance(0.08)) stumps.push([x, y])
    }
  for (const [x, y] of stumps) if (m.free(x, y)) m.fixture('fixture/nature/stump', x, y)
  // the dell: trodden earth, ash where the clamps have burned
  m.organic(18, 14, 9, 4.5, 'dirt', { only: grassy, rough: 0.25 })
  for (const [cx, cy] of [[13, 13], [18, 12], [23, 13]] as const) m.organic(cx, cy, 2, 1.1, 'ash', { only: (t) => t === 'dirt' })
  // the way in from the forest (east), through the dell, on to the roost (west)
  m.path([[39, 15], [33, 15], [27, 15], [20, 15], [14, 14], [10, 13]], 'path', 1, { edge: 'dirt', edgeP: 0.25 })
  // the three kilns: earth mounds that burn four days each
  for (const [x, y] of FAT.kilns) m.scenery('kiln', x, y)
  for (const [x, y] of [[27, 11], [27, 13]] as const) m.fixture('fixture/nature/logpile', x, y, { name: L('Cordwood for the kilns', '备着烧炭的柴') })
  m.fixture('fixture/container/crate', 15, 17, { name: L("Orrin's coal crate", '奥林的炭箱') }, [{ form: 'item/material/coal' }, { form: 'item/material/coal' }, { form: 'item/material/coal' }])
  for (const [x, y] of [[13, 15], [19, 16], [24, 15]] as const) m.item('item/material/coal', ...spot(m, x, y))
  // his hut, east of the dell (its room: buildDellHut)
  m.house('hut_straw', 30, 17, 'hut')
  m.anchor('orrin.kilns', ...spot(m, 17, 13, true))
  m.regions.dell = [9, 9, 20, 10]
  // the roost: an old oak in a ring of trees, west, where the forest's birds come at dusk; their feathers under it
  const [rx, ry] = FAT.roost
  m.organic(rx, ry, 3, 2.2, 'grass', { only: (t) => t !== 'path' && t !== 'dirt' })
  for (let t = 0; t < 20; t++) {
    const x = Math.round(rx + Math.cos((t / 20) * Math.PI * 2) * 3.6)
    const y = Math.round(ry + Math.sin((t / 20) * Math.PI * 2) * 2.8)
    if (x > rx + 2 && Math.abs(y - ry) <= 1) continue // open to the east, where the trail comes
    if (m.in(x, y) && grassy(m.get(x, y))) m.set(x, y, 'tree')
  }
  m.set(rx, ry - 1, 'tree')
  m.set(rx - 1, ry - 1, 'tree')
  for (const [x, y] of [[rx - 1, ry + 1], [rx + 1, ry], [rx, ry + 1], [rx + 1, ry + 1]] as const) m.item('item/material/feather', ...spot(m, x, y))
  m.fixture('fixture/sign', ...spot(m, rx + 3, ry + 2), {
    name: L("Orrin's tally board", '奥林的刻痕板'),
    props: {
      text: 'Notches cut in a board, in fives. Under them, in charcoal: DAYS SINCE THE BIRDS CAME. They come at dusk, every one in the forest, and sit in the old oak till dawn. They do not sing.',
      text_zh: '板子上刻着一道道痕，五道一组。下面用炭写着：鸟来了多少天。它们每天黄昏都来，整座森林的鸟一只不少，在老橡树上一直待到天亮。它们不叫。',
    },
  })
  m.regions.roost = [rx - 4, ry - 3, 9, 7]
  // what lives here: boars rooting in the coppice
  for (const [x, y] of [[8, 23], [30, 6], [32, 24], [14, 25]] as const) m.creature('beast/boar', ...spot(m, x, y), HUNT(4))
  const near = (x: number, y: number) => m.near(x, y, wood)
  m.sprinkle('fixture/nature/leaves', 0.25, (x, y, t) => grassy(t) && near(x, y))
  m.sprinkle('fixture/nature/ferns', 0.08, (x, y, t) => grassy(t) && near(x, y))
  m.sprinkle('fixture/nature/pebbles', 0.1, (x, y, t) => t === 'dirt')
  lay(m, 'item/material/stick', 3, [5, 4, 10, 5])
  lay(m, 'item/material/stone', 2, [28, 5, 8, 4])
  m.appear = [...GROUND_YIELD, appears('actor/creature/beast/boar', ['grass'], 3, 1500, { ai: HUNT(4) })]
  // the gap east, opened last, so every draw above stays as it was
  for (let x = m.w - 4; x < m.w; x++) for (const y of FLANKS.dellEast) if (wood(m.get(x, y))) m.set(x, y, 'grass')
  return m
}

/** The charcoal burner's hut: one bed, and a sack of what he makes. */
export function buildDellHut(): MapBuilder {
  const m = home('charcoal.hut', "Orrin's Hut", '奥林的小屋', 1, 'wood')
  m.fixture('fixture/container/sack', 3, 1, { name: L('A sack of charcoal', '一袋木炭') }, [{ form: 'item/material/coal' }, { form: 'item/material/coal' }])
  m.anchor('orrin.bed', 2, 2)
  return m
}

// =================================================================== the Reed Bend

/** The river's bank, row by row: where the water begins (it bends in towards the middle rows). */
export const bankAt = (y: number) => Math.round(28 + 4 * ((y - 15) / 15) ** 2)

/** East of the forest: the Ford's river bending south along the east side, reeds, the fisher's cabin and pier, the spit, the drowned stone. */
export function buildBend(): MapBuilder {
  const m = new MapBuilder('reedbend', L('The Reed Bend', '芦苇湾'), 'wild', 40, 30, 'grass', 'field', 'outdoor', 'frostfang')
  m.gearLevel = 2
  rim(m, (x, y) => (x < 4 && has(FLANKS.bendWest, y)) || x >= bankAt(y) - 1, 3)
  // the river: from the bank to the map's edge, deep past the shallows
  for (let y = 0; y < m.h; y++) {
    const b = bankAt(y)
    for (let x = b; x < m.w; x++) m.set(x, y, x >= b + 3 ? 'deepwater' : 'water')
    if (m.get(b - 1, y) !== 'tree' && m.get(b - 1, y) !== 'pine') m.set(b - 1, y, rng.chance(0.5) ? 'sand' : 'grass')
  }
  // the spit: a tongue of sand out into the water, where the boat came home without him
  const [sx, sy] = FAT.spit
  for (const [dy, len] of [[-1, 3], [0, 6], [1, 4]] as const) for (let x = bankAt(sy + dy) - 1; x < bankAt(sy + dy) - 1 + len; x++) m.set(x, sy + dy, 'sand')
  m.item({ form: 'item/misc/bell', name: L("Rolf's Boat Bell", '罗尔夫的船铃'), tags: ['keepsake'] }, sx, sy).id = 'quest.hilde.bell'
  for (const [x, y] of [[sx - 2, sy], [sx - 1, sy - 1], [sx, sy + 1]] as const) m.creature('slime/water_slime', x, y, HUNT(4))
  // down the shore to the south: a giant crab keeps it (docs/creatures.md §3.4)
  m.creature('crab', bankAt(25) - 1, 25, HUNT(3))
  m.regions.spit = [bankAt(sy) - 2, sy - 2, 9, 5]
  // the pier, three planks out from the bank; her cabin up the bank from it (its room: buildBendCabin)
  const [px, py] = FAT.pier
  for (let x = px; x < px + 3; x++) m.set(x, py, 'bridge')
  m.house('cabin', 20, 9, 'cabin')
  m.path([[0, 17], [8, 16], [16, 14], [21, 12]], 'path', 1, { edge: 'dirt', edgeP: 0.25 })
  m.path([[21, 12], [24, 12], [px - 1, py]], 'path', 1)
  m.fixture('fixture/furniture/rack', 24, 10, { name: L('Drying nets', '晾着的渔网') })
  m.fixture('fixture/container/barrel', 18, 11, { name: L('Salt barrel', '盐桶') })
  m.fixture('fixture/light/campfire', 23, 15, { name: L("Hilde's smoke-fire", '熏鱼的火堆'), statuses: { lit: -1 } })
  m.anchor('hilde.pier', px - 1, py)
  m.regions.camp = [17, 8, 12, 9]
  // the drowned stone, half in the water north of the pier: older than the village, older than the Church
  const [tx, ty] = FAT.stone
  m.set(tx, ty, 'sand')
  m.fixture('fixture/sacred/gravestone', tx, ty, {
    name: L('A drowned stone', '沉在水边的石头'),
    props: {
      text: 'A standing stone, tilted, the river up to its waist. The carving is worn soft: a boat; a figure in it handing a fish down to a child on the bank. No thorns. No wounds. Nobody kneeling.',
      text_zh: '一块歪倒的立石，河水淹到它半腰。刻纹已经磨得很柔和：一条船；船上的人把一条鱼递给岸边的孩子。没有荆棘。没有伤口。没有人下跪。',
    },
  })
  m.regions.stone = [tx - 2, ty - 2, 5, 5]
  // reeds along the water, pebbles on the sand, sticks under the woods
  m.sprinkle('fixture/nature/reeds', 0.3, (x, y, t) => (grassy(t) || t === 'sand') && m.near(x, y, (u) => u === 'water'))
  m.sprinkle('fixture/nature/pebbles', 0.15, (_x, _y, t) => t === 'sand')
  m.sprinkle('fixture/nature/flowers', 0.05, (x, y, t) => grassy(t) && m.near(x, y, (u) => u === 'path', 2))
  lay(m, 'item/material/stick', 3, [5, 5, 10, 6])
  lay(m, 'item/material/stone', 2, [6, 22, 10, 5])
  // fish shadows in the river: a stocked water (eels at night, pike in the deep: content rules.ts)
  m.fish = true
  m.appear = [...GROUND_YIELD, appears('actor/creature/slime/water_slime', ['sand'], 2, 1800, { ai: HUNT(4) })]
  // the gap west, opened last
  for (let x = 0; x < 4; x++) for (const y of FLANKS.bendWest) if (wood(m.get(x, y))) m.set(x, y, 'grass')
  return m
}

/** The fisher's cabin: a bed, the hearth, her table, smoked eels in a crate. */
export function buildBendCabin(): MapBuilder {
  const m = room('reedbend.cabin', "Hilde's Cabin", '希尔德的小屋', 10, 8, 'wood', 'floor_wood')
  m.fixture('fixture/furniture/bed', 1, 1)
  m.fixture('fixture/light/fireplace', 8, 1, { statuses: { lit: -1 } })
  m.fixture('fixture/furniture/table', 5, 4, {
    name: L("Hilde's table", '希尔德的桌子'),
    tags: ['readable'],
    props: {
      text: 'A tally of catches, year by year, in a square hand. One line, nine winters back, is not a tally: "Boat came home. He did not. Fog." Nothing else is written that year.',
      text_zh: '一年一年的渔获记录，字迹方方正正。九个冬天前有一行不是记录："船回来了。他没有。雾。"那一年再没有写别的。',
    },
  })
  m.fixture('fixture/furniture/chair', 4, 4)
  m.fixture('fixture/container/crate', 8, 5, { name: L('Smoked eels', '熏鳗鱼箱') }, [{ form: 'item/food/fish/cooked' }, { form: 'item/food/fish/cooked' }])
  m.fixture('fixture/container/barrel', 1, 5)
  m.anchor('hilde.bed', 2, 2)
  return m
}

// =================================================================== the scenes

/** The flanks' own facts. */
export const FLANKS_FACTS = { roost: 'ch1.roost', stone: 'ch1.drowned_stone' } as const

export const FLANKS_STORY: StepDef[] = [
  {
    // The dell, first time: smoke that has been burning for days.
    id: 'dell_first',
    when: { map: 'charcoal' },
    say: L('Smoke. Somebody is burning something slow — it smells like a fire that has been going for days. ...And listen: still no birds.', '有烟。有人在慢慢地烧什么东西——闻起来像一堆烧了好几天的火。……你听：还是没有鸟叫。'),
  },
  {
    // The roost at dusk: every bird of the forest, silent, facing east.
    id: 'roost_dusk',
    when: { map: 'charcoal', region: 'roost', hour: { from: 17, to: 21 } },
    script: [
      say('player', '(The old oak is black with birds. Hundreds of them, wing to wing on every branch. Not one makes a sound.)', '（老橡树上落满了鸟，黑压压一片。几百只，翅膀挨着翅膀，挤满了每一根枝条。没有一只出声。）', 'surprised'),
      say('pip', 'So THAT\'s where they went. Every bird in the forest, and they all came here. ...They\'re facing east. Like the cows.', '原来它们都到这儿来了。整座森林的鸟，全都飞到了这里。……它们朝着东边。和那些牛一样。', 'sad'),
      say('pip', 'Birds know when something is wrong before people do. They won\'t sleep in the forest. What walked through it?', '鸟比人先知道出了事。它们不肯在森林里过夜。到底是什么从那片林子里走过去了？', 'shy'),
      { fact: FLANKS_FACTS.roost, value: 1 },
    ],
  },
  {
    // The bend, first time: the Ford's river again, quiet.
    id: 'bend_first',
    when: { map: 'reedbend' },
    say: L('The river! It\'s the Ford\'s river, I\'m sure — it bends down this way. ...Even the water is quiet here.', '是那条河！我敢肯定是渡口那条河——它拐到这边来了。……这里连水都是安静的。'),
  },
  {
    // The drowned stone: a carving with no suffering in it.
    id: 'drowned_stone',
    when: { map: 'reedbend', region: 'stone' },
    script: [
      say('player', '(A standing stone half in the river, older than anything in the village. A boat; a figure handing a fish down to a child. No thorns, no wounds. Nobody kneeling.)', '（一块半泡在河里的立石，比村里任何东西都古老。一条船；船上的人把一条鱼递给岸边的孩子。没有荆棘，没有伤口。没有人下跪。）'),
      say('pip', 'Nobody\'s suffering on this one. Somebody\'s just... giving somebody a fish. ...Why does that feel so strange to look at?', '这块石头上没有人在受苦。只是有人……在给另一个人一条鱼。……为什么看着会觉得这么奇怪？', 'shy'),
      { fact: FLANKS_FACTS.stone, value: 1 },
    ],
  },
]
