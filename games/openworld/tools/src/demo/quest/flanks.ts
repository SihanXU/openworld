// The forest's flanks (docs/chapter-1.md §15, 2026-10-13): two places off the forest's sides, each with one who lives
// there and what they ask. West, through the forest's side trail, the Charcoal Dell: Orrin the charcoal burner, his
// three kilns and his coppice, boars in the undergrowth — and the roost oak the forest's birds all fled to the night
// the bridge came down (why the forest is quiet). East, down the clearing's trail, the Reed Bend: the Ford's river
// bending south, Hilde the fisher's cabin and jetty, the spit where her husband's boat bell lies among water slimes, a
// drowned stone older than the Church. Both are combat zones; both lie on the overworld (the bend on the river's own
// cell, a camp on the near bank one reaches only through the forest: the river stays the barrier it is, D22).
//
// Drawn by hand for release 1 (2026-10-21, docs/release-1.md): the ground of each is its layout file (maps/charcoal.txt,
// maps/reedbend.txt). The dell is a felled clearing in the coppice — the trodden yard before the kilns, the cordwood
// stacked by them, a ring of stumps where the trees came down, the burner's hut in its own yard, the roost oak in its
// ring west. The bend is the river bowing in along the east (running to the map's edge: one bank, D22), reed beds and mud
// flats along the water, the fisher's beach and jetty with her boat, her nets and fish drying, the spit, the stone.

import type { AiData, StepDef } from '@openworld/engine'
import { MapBuilder, rng } from '../builder.ts'
import { L, GROUND_YIELD, appears, lay } from '../kit.ts'
import { flHouse } from '../village.ts'
import { wildFloor } from '../wildfloor.ts'

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
  /** the jetty's first plank, on the bend's bank (it is two planks wide, rows 12-13, three out) */
  pier: [28, 12] as const,
  spit: [31, 21] as const,
  stone: [28, 6] as const,
} as const

const HUNT = (sight = 5): Omit<AiData, 'home'> => ({ behaviour: 'melee', temper: 'aggressive', sight, leash: 7 })
const grassy = (t: string) => t === 'grass' || t === 'drygrass' || t === 'flowers'
const wood = (t: string) => t === 'tree' || t === 'pine'
const water = (t: string) => t === 'water' || t === 'deepwater'
const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })

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

/** Each cell of a list a thing of `type`, where the cell is free (a list drawn by hand: the map's own composition). */
function each(m: MapBuilder, type: string, cells: readonly (readonly [number, number])[], extra: Parameters<MapBuilder['fixture']>[3] = {}): void {
  for (const [x, y] of cells) if (m.free(x, y)) m.fixture(type, x, y, extra)
}

/** A rug laid on a room's floor; a bed (drawn its head a cell up, against the wall) and where its sleeper lies down. */
const rug = (m: MapBuilder, x: number, y: number, w: number, h: number) => m.rect(x, y, w, h, 'carpet')
const bed = (m: MapBuilder, x: number, y: number, anchor: string, at: [number, number]) => (m.fixture('fixture/furniture/bed', x, y), m.anchor(anchor, ...at))

// =================================================================== the Charcoal Dell

/** West of the forest: a felled clearing in the coppice where the charcoal burner keeps his kilns, boars in the woods round it, and the roost oak. */
export function buildDell(): MapBuilder {
  const m = new MapBuilder('charcoal', L('The Charcoal Dell', '烧炭谷'), 'wild', 40, 30, 'grass', 'dell', 'outdoor', 'frostfang')
  m.gearLevel = 2
  // the ground: the coppice round it, the felled ring, the trodden yard, the trail in from the forest (east, row 15)
  m.paint('charcoal')
  // the three kilns along the yard's north side, earth mounds that burn four days each; the soot before each mouth
  for (const [x, y] of FAT.kilns) m.scenery('kiln', x, y)
  for (const [x, y] of FAT.kilns) m.fixture('fixture/nature/soot', x + 1, y + 4)
  m.anchor('orrin.kilns', 18, 13)
  // the cordwood yard east of the kilns: the wood for the next burn, stacked in two cords
  each(m, 'fixture/nature/logpile', [[27, 9], [29, 9], [27, 11], [29, 11]], { name: L('Cordwood for the kilns', '备着烧炭的柴') })
  // where he splits it: the chopping block and the split wood by it
  m.fixture('fixture/nature/stump', 25, 14, { name: L("Orrin's chopping block", '奥林的劈柴墩') })
  m.fixture('fixture/nature/logpile/stack', 27, 14)
  // what the kilns gave: the coal crate and sacks by it, at the yard's south side; coal raked out before the mouths
  m.fixture('fixture/container/crate', 15, 15, { name: L("Orrin's coal crate", '奥林的炭箱') }, [{ form: 'item/material/coal' }, { form: 'item/material/coal' }, { form: 'item/material/coal' }])
  each(m, 'fixture/container/sack', [[16, 16], [14, 16]], { name: L('A sack of charcoal', '一袋木炭') })
  for (const [x, y] of [[12, 13], [19, 12], [24, 13]] as const) m.item('item/material/coal', ...spot(m, x, y))
  m.regions.dell = [10, 6, 22, 13]
  // his hut east of the yard, its own yard before the door: his firewood against its wall, the water butt, a bench,
  // the lantern he walks to the kilns by at night (its room: buildDellHut)
  m.building('dl_hut', 30, 16, ['hut'])
  m.fixture('fixture/container/woodpile', 28, 17, { statuses: { open: -1 } })
  m.fixture('fixture/container/barrel', 34, 17, { name: L('Water butt', '接雨水的桶') })
  m.fixture('fixture/furniture/bench/log', 29, 19)
  m.fixture('fixture/light/lantern', 29, 16)
  // the felled ring: the stumps of the trees that went into the kilns, round the clearing's edge; older ones in the coppice
  const ring = [[15, 5], [20, 5], [25, 6], [30, 6], [33, 8], [34, 11], [36, 13], [35, 18], [23, 21], [26, 19], [20, 20], [14, 19], [12, 16], [11, 14]] as const
  const coppice = [[21, 23], [15, 25], [31, 24], [6, 22], [6, 3], [31, 3]] as const
  each(m, 'fixture/nature/stump', [...ring, ...coppice].filter(([x, y]) => grassy(m.get(x, y))))
  // the roost: an old oak in a ring of trees, west, where the forest's birds come at dusk; their feathers under it
  const [rx, ry] = FAT.roost
  // (the oak stands at the glade's head, 6,9: the layout's tree there is drawn as the great one)
  for (const [x, y] of [[rx - 2, ry - 2], [rx, ry - 2], [rx - 1, ry - 1], [rx - 3, ry - 1]] as const) m.item('item/material/feather', ...spot(m, x, y))
  m.fixture('fixture/sign', rx + 2, ry, {
    name: L("Orrin's tally board", '奥林的刻痕板'),
    props: {
      text: 'Notches cut in a board, in fives. Under them, in charcoal: DAYS SINCE THE BIRDS CAME. They come at dusk, every one in the forest, and sit in the old oak till dawn. They do not sing.',
      text_zh: '板子上刻着一道道痕，五道一组。下面用炭写着：鸟来了多少天。它们每天黄昏都来，整座森林的鸟一只不少，在老橡树上一直待到天亮。它们不叫。',
    },
  })
  m.regions.roost = [rx - 4, ry - 3, 9, 7]
  // what lives here: boars rooting in the coppice's glades
  for (const [x, y] of [[6, 23], [14, 25], [32, 24], [31, 5]] as const) m.creature('beast/boar', ...spot(m, x, y), HUNT(4))
  // small things where they fall: leaves and ferns under the woods' edge, a few pebbles on the trodden earth
  const near = (x: number, y: number) => m.near(x, y, wood)
  m.sprinkle('fixture/nature/leaves', 0.3, (x, y, t) => grassy(t) && near(x, y))
  m.sprinkle('fixture/nature/ferns', 0.1, (x, y, t) => grassy(t) && near(x, y) && !m.near(x, y, (u) => u === 'dirt' || u === 'path', 1))
  m.sprinkle('fixture/nature/pebbles', 0.05, (x, y, t) => t === 'dirt' && !m.near(x, y, (u) => u === 'wall', 1))
  lay(m, 'item/material/stick', 3, [4, 2, 6, 3])
  lay(m, 'item/material/stone', 2, [29, 3, 6, 3])
  wildFloor(m, 1, (x, y) => x >= 10 && x <= 31 && y >= 6 && y <= 18)
  m.appear = [...GROUND_YIELD, appears('actor/creature/beast/boar', ['grass'], 3, 1500, { ai: HUNT(4) })]
  return m
}

/** The charcoal burner's hut: his room (the bed, the hearth, his table), and the store behind it where the coal is sacked. */
export function buildDellHut(): MapBuilder {
  // (a hall of its plan, plans.ts dlhut: his room, and the store through the side)
  const { m, P } = flHouse('dlhut', 'charcoal.hut', "Orrin's Hut", '奥林的小屋', 'floor_wood', ['room', 'store'])
  m.zone = 'combat'
  const R = P.room
  bed(m, R.x, R.y + 1, 'orrin.bed', [R.x, R.y + 2])
  m.fixture('fixture/container/drawers', R.x + 2, R.y)
  m.fixture('fixture/light/fireplace', R.x + 5, R.y, { statuses: { lit: -1 } })
  rug(m, R.x + 4, R.y + 2, 3, 2)
  m.fixture('fixture/furniture/table', R.x + 5, R.y + 2)
  m.fixture('fixture/furniture/chair', R.x + 4, R.y + 2)
  m.fixture('fixture/container/chest', R.x, R.y + 5)
  m.fixture('fixture/container/barrel', R.x + 8, R.y + 5)
  m.building('decor_firewood', R.x + 7, R.y)
  // the store: the coal sacked for Firstlight's smithy and hearths, the kindling, a barrel of water against a spark
  const S = P.store
  m.fixture('fixture/container/sack', S.x, S.y, { name: L('A sack of charcoal', '一袋木炭') }, [{ form: 'item/material/coal' }, { form: 'item/material/coal' }])
  m.fixture('fixture/container/sack', S.x + 1, S.y, { name: L('A sack of charcoal', '一袋木炭') })
  m.fixture('fixture/container/crate', S.x + 5, S.y)
  m.fixture('fixture/container/crate', S.x + 5, S.y + 1)
  m.fixture('fixture/nature/logpile/stack', S.x + 1, S.y + 5)
  m.fixture('fixture/container/barrel', S.x + 5, S.y + 5)
  m.building('decor_sacks', S.x + 3, S.y)
  return m
}

// =================================================================== the Reed Bend

/** The river's near bank, row by row: its first water column (the layout's; it bows in to the jetty, and the spit's rows run out along it). */
const BANK = [30, 30, 30, 30, 29, 29, 29, 28, 28, 27, 27, 27, 28, 28, 27, 27, 28, 28, 29, 29, 31, 34, 32, 30, 30, 31, 31, 31, 31, 31] as const
export const bankAt = (y: number) => BANK[y]

/** East of the forest: the Ford's river bending along the east side, reed beds and mud flats, the fisher's cabin and jetty, the spit, the drowned stone. */
export function buildBend(): MapBuilder {
  const m = new MapBuilder('reedbend', L('The Reed Bend', '芦苇湾'), 'wild', 40, 30, 'grass', 'river', 'outdoor', 'frostfang')
  m.gearLevel = 2
  // the ground: the river, its banks, the woods round, the path in from the forest (west, row 17)
  m.paint('reedbend')
  for (let y = 0; y < m.h; y++) {
    // (the river's: the old arm in the meadow lies west of the cabin)
    const x = [...Array(m.w).keys()].find((i) => i >= 20 && (water(m.get(i, y)) || m.get(i, y) === 'bridge'))
    if (x !== bankAt(y)) throw new Error(`reedbend: the layout's bank in row ${y} is ${x}, bankAt says ${bankAt(y)}`)
  }
  // the spit: a tongue of sand out into the water, where the boat came home without him
  const [sx, sy] = FAT.spit
  m.item({ form: 'item/misc/bell', name: L("Rolf's Boat Bell", '罗尔夫的船铃'), tags: ['keepsake'] }, sx, sy).id = 'quest.hilde.bell'
  for (const [x, y] of [[sx - 2, sy], [sx - 1, sy - 1], [sx, sy + 1]] as const) m.creature('slime/water_slime', x, y, HUNT(4))
  // down the shore to the south, on the mud flats: a giant crab keeps it (docs/creatures.md §3.4)
  m.creature('crab', bankAt(25) - 2, 25, HUNT(3))
  m.regions.spit = [26, 19, 9, 5]
  // her cabin up the bank, its yard before the door (its rooms: buildBendCabin): the salt barrel, her catch crated, a bench
  m.building('rb_cabin', 20, 8, ['cabin'])
  m.fixture('fixture/container/barrel', 19, 10, { name: L('Salt barrel', '盐桶') })
  m.fixture('fixture/container/crate', 24, 10, { name: L("Hilde's catch", '希尔德的渔获') })
  m.fixture('fixture/furniture/bench/log', 23, 13)
  // the jetty on its beach, her boat tied alongside, a lantern at its foot; she fishes from its end
  const [px, py] = FAT.pier
  m.fixture('fixture/boat', px + 1, py + 2, { name: L("Hilde's boat", '希尔德的船'), props: { owner: 'npc.hilde' } })
  m.fixture('fixture/light/lantern', px - 2, py - 1)
  m.anchor('hilde.pier', px + 2, py + 1)
  // her nets hung to dry on the open bank north of the jetty; the fish drying either side of the smoke-fire south of it
  each(m, 'fixture/furniture/rack/nets', [[23, 7], [25, 8]], { name: L('Drying nets', '晾着的渔网') })
  m.fixture('fixture/light/campfire', 22, 16, { name: L("Hilde's smoke-fire", '熏鱼的火堆'), statuses: { lit: -1 } })
  each(m, 'fixture/furniture/rack/fish', [[20, 16], [24, 16]], { name: L('Fish drying', '晾着的鱼') })
  m.regions.camp = [17, 7, 12, 11]
  // the drowned stone, half in the water north of the jetty: older than the village, older than the Church
  const [tx, ty] = FAT.stone
  m.fixture('fixture/sacred/gravestone', tx, ty, {
    name: L('A drowned stone', '沉在水边的石头'),
    props: {
      text: 'A standing stone, tilted, the river up to its waist. The carving is worn soft: a boat; a figure in it handing a fish down to a child on the bank. No thorns. No wounds. Nobody kneeling.',
      text_zh: '一块歪倒的立石，河水淹到它半腰。刻纹已经磨得很柔和：一条船；船上的人把一条鱼递给岸边的孩子。没有荆棘。没有伤口。没有人下跪。',
    },
  })
  m.regions.stone = [tx - 2, ty - 2, 5, 5]
  // the reed beds: thick on the mud flats at the bend's two ends and out into the shallows before them, round the old
  // arm in the meadow, a few along the bank between; none on the spit, the jetty's beach, the
  // ways, or before the stone
  const shallow = (x: number, y: number) => m.get(x, y) === 'water' && m.near(x, y, (u) => !water(u) && u !== 'bridge')
  const kept = (x: number, y: number) => Math.abs(x - tx) + Math.abs(y - ty) <= 2 || (x >= 25 && y >= 18 && y <= 23) || (y >= 10 && y <= 15 && x >= 24)
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const t = m.get(x, y)
      if (kept(x, y) || t === 'path' || t === 'dirt') continue
      const arm = x < 20
      const ends = y <= 9 || y >= 23
      const p = shallow(x, y)
        ? arm ? 0.45 : ends ? 0.65 : 0.08
        : t === 'mud' ? (arm ? 0.55 : 0.7)
        : (grassy(t) || t === 'sand') && m.near(x, y, water, 1) ? (arm ? 0.4 : ends ? 0.6 : 0.15) : 0
      if (p && rng.chance(p) && (m.free(x, y) || shallow(x, y)) && !m.entities.some((e) => e.place.on === 'tile' && e.place.x === x && e.place.y === y)) m.fixture('fixture/nature/reeds', x, y)
    }
  // pebbles on the sand, flowers under the cabin's walls and along the path, leaves under the woods
  m.sprinkle('fixture/nature/pebbles', 0.12, (_x, _y, t) => t === 'sand')
  m.sprinkle('fixture/nature/flowers', 0.25, (x, y, t) => grassy(t) && m.near(x, y, (u) => u === 'wall', 1) && !m.near(x, y, (u) => u === 'door', 1))
  m.sprinkle('fixture/nature/flowers', 0.06, (x, y, t) => grassy(t) && m.near(x, y, (u) => u === 'path', 1) && !m.near(x, y, wood, 2))
  m.sprinkle('fixture/nature/leaves', 0.2, (x, y, t) => grassy(t) && m.near(x, y, wood))
  lay(m, 'item/material/stick', 3, [4, 6, 8, 5])
  lay(m, 'item/material/stone', 2, [4, 9, 12, 4])
  wildFloor(m, 1, (x, y) => x >= 17 && x <= 28 && y >= 6 && y <= 24)
  // fish shadows in the river: a stocked water (eels at night, pike in the deep: content rules.ts)
  m.fish = true
  m.appear = [...GROUND_YIELD, appears('actor/creature/slime/water_slime', ['sand'], 2, 1800, { ai: HUNT(4) })]
  return m
}

/** The fisher's cabin: the room by the door (her hearth, her table and its tally), her room, the store where the nets and the smoked fish are kept. */
export function buildBendCabin(): MapBuilder {
  // (a hall of its plan, plans.ts rbcabin: the room by the door, her bedroom and the store side by side)
  const { m, P } = flHouse('rbcabin', 'reedbend.cabin', "Hilde's Cabin", '希尔德的小屋', 'floor_wood', ['room', 'bedroom', 'store'])
  m.zone = 'combat'
  const R = P.room
  m.fixture('fixture/light/fireplace', R.x + 5, R.y, { statuses: { lit: -1 } })
  m.fixture('fixture/container/cupboard', R.x, R.y + 1, { name: L("Hilde's cupboard", '希尔德的橱柜') })
  rug(m, R.x + 2, R.y + 3, 3, 2)
  m.fixture('fixture/furniture/table', R.x + 3, R.y + 3, {
    name: L("Hilde's table", '希尔德的桌子'),
    tags: ['readable'],
    props: {
      text: 'A tally of catches, year by year, in a square hand. One line, nine winters back, is not a tally: "Boat came home. He did not. Fog." Nothing else is written that year.',
      text_zh: '一年一年的渔获记录，字迹方方正正。九个冬天前有一行不是记录："船回来了。他没有。雾。"那一年再没有写别的。',
    },
  })
  m.fixture('fixture/furniture/chair', R.x + 2, R.y + 3)
  m.fixture('fixture/nature/plant', R.x + 9, R.y + 6)
  m.fixture('fixture/container/barrel', R.x, R.y + 6)
  m.building('decor_firewood', R.x + 8, R.y)
  // her room: one bed (his side of it empty nine winters), her drawers, the chest
  const B = P.bedroom
  bed(m, B.x + 3, B.y + 1, 'hilde.bed', [B.x + 3, B.y + 2])
  m.fixture('fixture/container/drawers', B.x + 1, B.y)
  m.fixture('fixture/container/chest', B.x, B.y + 5)
  // the store: the smoked eels crated, the salt, a sack of bait-meal — along its walls, the row from the doorway left free
  const S = P.store
  m.fixture('fixture/container/crate', S.x + 2, S.y, { name: L('Smoked eels', '熏鳗鱼箱') }, [{ form: 'item/food/fish/cooked' }, { form: 'item/food/fish/cooked' }])
  m.fixture('fixture/container/barrel', S.x + 3, S.y + 2, { name: L('Salt', '盐') })
  m.fixture('fixture/container/barrel', S.x + 2, S.y + 6)
  m.fixture('fixture/container/sack', S.x + 3, S.y + 6)
  m.building('decor_sacks', S.x, S.y)
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
