// The west bank's wild cells (release 1, docs/release-1.md §2): the valley keeps ten cells of wild between its
// hand-made places, each with a reason to walk there. Each is still a wilderness made from the world's seed and its cell
// (wild.ts), with a place of its own laid over it: a name, what its ground grows, and a small scene drawn by hand —
// the high snow's cairn, the crag's hive, the mill's fields, the wayside, the Westwood's camp, pool, fallen giant, grave
// and shelter, the river meadow's jetty.

import type { Entity, PropValue, Text } from '@openworld/engine'
import { TERRAIN_CHARS } from './ontology.ts'

/** What stands on a scene's cell: a type, its props, what it holds. */
interface Thing {
  type: string
  name?: Text
  props?: Record<string, PropValue>
  statuses?: Record<string, number>
  contents?: string[]
}

/** A place laid over a wild cell. */
export interface ValleyPlace {
  name: Text
  /** What the ground grows, in place of the recipe's (wild.ts Recipe.growth): a quieter ground round the scene. */
  growth?: [string, number][]
  /** The ground's patches, in place of the recipe's (none: the scene is the only feature). */
  patches?: [string, number, number][]
  /** The scene, a character a cell: the map format's terrain characters, a key of `things` (on the scene's own ground,
   * `floor`), or ' ' to keep what the wild made there. */
  scene: string[]
  /** Its top left on the 40 x 30 wild map. */
  at: [number, number]
  /** The terrain under a thing (the scene's ground). */
  floor: string
  things: Record<string, Thing>
  /** Roads from the middle of each edge to the scene (the wayside's crossroads). */
  crossroads?: boolean
}

const L = (en: string, zh: string): Text => ({ en, zh })
const QUIET_WOODS: [string, number][] = [['tree', 0.16], ['pine', 0.05], ['bush', 0.03]]
const QUIET_PLAIN: [string, number][] = [['tree', 0.015], ['bush', 0.01]]

/** The valley's wild cells by their overworld cell ("x,y"): continent/generate.ts POCKET keeps exactly these walkable. */
export const VALLEY: Record<string, ValleyPlace> = {
  // above Cloudtop: a cairn on the snow where the old watchmen turned back, a pilgrim who did not
  '7,2': {
    name: L('The High Snow', '高处雪原'),
    floor: 'n',
    at: [13, 9],
    scene: [
      ' PP      P   ',
      'PnnnnnnnnnnP ',
      'nnnRRRnnnnnn ',
      'nnRRxRRnnnnnP',
      'nnnRRRnnnyzn ',
      ' nnnnnnnnnnn ',
      '  PnnnnnnnP  ',
    ],
    things: {
      x: { type: 'fixture/sign', name: L('The cairn', '石堆'), props: { text: 'A cairn of flat stones, piled by the watchmen of Cloudtop to mark where their watch ended. No one has piled any stones beyond it.', text_zh: '一堆扁平的石头，是云顶台地的守望人堆的，标着他们巡守到的地方。再往上，就没有人堆过石头了。' } },
      y: { type: 'fixture/remains/bones', name: L("A pilgrim's bones", '朝圣者的遗骨') },
      z: { type: 'fixture/container/sack', name: L('A frozen pack', '冻硬的行囊'), contents: ['item/food/bread', 'item/light/candle', 'item/tool/rope'] },
    },
  },
  // Dawn Hill's crag: rock thrown up through the turf, a wild hive in its lee, herbs where the sun lies longest
  '6,3': {
    name: L("Dawn Hill's Crag", '晨光丘的岩岗'),
    floor: '.',
    at: [12, 8],
    patches: [['gravel', 2, 2]],
    scene: [
      '   RRRR     ',
      '  RRRRRRR   ',
      ' RRR..RRRR  ',
      ' RR..x..RR  ',
      '  ..***..   ',
      '  .*****. y ',
      '   .***.    ',
    ],
    things: {
      x: { type: 'fixture/nature/beehive', name: L('A wild hive', '野蜂巢') },
      y: { type: 'fixture/nature/boulder' },
    },
  },
  // west of Millbrook: its fields, the hay in, a scarecrow over the furrows, the cart left at the track's end
  '4,5': {
    name: L("Millbrook's Fields", '水车磨坊的田地'),
    floor: '.',
    at: [8, 7],
    growth: QUIET_PLAIN,
    patches: [],
    scene: [
      ':::::::::::::::::::::::',
      ':.mmmmmmm..mmmmmmm..x.:',
      ':.mmmmmmm..mmmmmmm....:',
      ':.........y..........z:',
      ':.mmmmmmm..mmmmmmm..x.:',
      ':.mmmmmmm..mmmmmmm....:',
      ':::::::::::::::::::::::',
    ],
    things: {
      x: { type: 'fixture/nature/haystack' },
      y: { type: 'fixture/scarecrow' },
      z: { type: 'fixture/furniture/cart', name: L("The miller's cart", '磨坊主的推车') },
    },
  },
  // between the mill, the grassland and the dell: where the ways cross, a signpost, a bench, a lantern for the dark
  '5,6': {
    name: L('The Wayside', '路口'),
    floor: '.',
    at: [18, 13],
    crossroads: true,
    growth: QUIET_PLAIN,
    // (the crossroads are drawn first: the scene leaves their cells, x 20-21 and y 15-16, as they are)
    scene: [
      '.*  .*',
      '.x  .y',
      '      ',
      '      ',
      '..  z.',
    ],
    things: {
      x: { type: 'fixture/sign', props: { text: 'NORTH: Millbrook. EAST: the grassland, and Firstlight beyond. SOUTH: the Charcoal Dell.', text_zh: '北：水车磨坊。东：草原，再往前是初原村。南：烧炭谷。' } },
      y: { type: 'fixture/furniture/bench/log' },
      z: { type: 'fixture/light/lantern', statuses: { lit: -1 } },
    },
  },
  // the Westwood: a hunter's camp in a glade
  '4,6': {
    name: L("Westwood: the Hunter's Camp", '西林·猎人营地'),
    floor: '.',
    at: [13, 9],
    growth: QUIET_WOODS,
    scene: [
      '  .........  ',
      ' ...........',
      '....x.......',
      '............ ',
      '..k..y..z...',
      ' ..l....... ',
      '  ........  ',
    ],
    things: {
      x: { type: 'fixture/tent', name: L("The hunter's tent", '猎人的帐篷') },
      y: { type: 'fixture/light/campfire' },
      z: { type: 'fixture/furniture/rack' },
      k: { type: 'fixture/nature/logpile/stack' },
      l: { type: 'fixture/nature/stump' },
    },
  },
  // the Westwood: a still pool under the trees, reeds and a ring of mushrooms
  '4,7': {
    name: L('Westwood: the Still Pool', '西林·静水潭'),
    floor: '.',
    at: [12, 8],
    growth: QUIET_WOODS,
    scene: [
      '   .......    ',
      '  ..x~~~x..   ',
      ' ..~~~~~~~x.  ',
      ' .x~~~~~~~~.. ',
      ' ..~~~~~~~x.  ',
      '  ..x~~~.... y',
      '   .......    ',
    ],
    things: {
      x: { type: 'fixture/nature/reeds' },
      y: { type: 'fixture/nature/mushroom_ring' },
    },
  },
  // the Westwood: a giant fallen across the glade it made, its wood for the taking, moss on it
  '4,8': {
    name: L('Westwood: the Fallen Giant', '西林·倒下的巨木'),
    floor: '.',
    at: [12, 9],
    growth: QUIET_WOODS,
    scene: [
      '  ..........  ',
      ' ....z....... ',
      '..x...yyy..z..',
      ' ....z....... ',
      '  ..........  ',
    ],
    things: {
      x: { type: 'fixture/nature/dead_tree', name: L('The giant\'s stump', '巨木的残桩') },
      y: { type: 'fixture/nature/logpile' },
      z: { type: 'fixture/nature/moss' },
    },
  },
  // the Westwood: a woodsman buried where he worked, flowers on him
  '5,8': {
    name: L("Westwood: the Woodsman's Grave", '西林·樵夫之墓'),
    floor: '.',
    at: [15, 10],
    growth: QUIET_WOODS,
    scene: [
      ' ...... ',
      '..*x*...',
      '.*****..',
      ' ..y... ',
    ],
    things: {
      x: { type: 'fixture/sacred/gravestone', props: { text: 'BEREN, WHO CUT THE WESTWOOD FORTY YEARS AND NEVER TOOK THE OLD ONES.', text_zh: '樵夫贝伦之墓。伐木西林四十载，未尝伐一株老树。' } },
      y: { type: 'fixture/nature/stump' },
    },
  },
  // the Westwood's edge, over the hollow: a shelter left in a hurry, what was in it still there
  '5,9': {
    name: L("Westwood: the Abandoned Shelter", '西林·废弃的棚子'),
    floor: '.',
    at: [14, 9],
    growth: QUIET_WOODS,
    scene: [
      ' ......... ',
      '...x.......',
      '...........',
      '..y....z...',
      ' ......... ',
    ],
    things: {
      x: { type: 'fixture/tent', name: L('A torn shelter', '破了的棚子') },
      y: { type: 'fixture/container/chest', name: L('A chest left behind', '留下的箱子'), contents: ['item/light/torch', 'item/tool/rope', 'item/food/apple'] },
      z: { type: 'fixture/light/campfire' },
    },
  },
  // below the barrow: the meadow down to the river's south shore, reeds, a little jetty
  '6,10': {
    name: L('The River Meadow', '河边草地'),
    floor: '.',
    at: [0, 23],
    growth: QUIET_PLAIN,
    scene: [
      '...*........................*......x....',
      '....x.......*.........y.........x......*',
      'ssssssssssssssssssBBsssssssssssssssssss',
      '~~~~~~~~~~~~~~~~~~BB~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~BB~~~~~~~~~~~~~~~~~~~~',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
    things: {
      x: { type: 'fixture/nature/reeds' },
      y: { type: 'fixture/furniture/bench/log' },
    },
  },
}

/** Lay a valley place over a wild map made for its cell: its name, its scene, its things (ids `<map>~v<n>`). */
export function layValley(place: ValleyPlace, id: string, W: number, H: number, terrain: string[], entities: Entity[]): void {
  const at = (x: number, y: number) => y * W + x
  const floor = TERRAIN_CHARS[place.floor] ?? 'grass'
  if (place.crossroads) {
    const [cx, cy] = [Math.floor(W / 2), Math.floor(H / 2)]
    for (let x = 0; x < W; x++) for (const dy of [0, 1]) terrain[at(x, cy + dy)] = 'path'
    for (let y = 0; y < H; y++) for (const dx of [0, 1]) terrain[at(cx + dx, y)] = 'path'
  }
  let n = 0
  place.scene.forEach((row, j) =>
    [...row].forEach((c, i) => {
      const [x, y] = [place.at[0] + i, place.at[1] + j]
      if (c === ' ' || x < 0 || y < 0 || x >= W || y >= H) return
      const thing = place.things[c]
      terrain[at(x, y)] = thing ? floor : (TERRAIN_CHARS[c] ?? floor)
      // what the wild put on a cell the scene draws is gone (a tree, a mushroom where the pool is)
      for (let k = entities.length - 1; k >= 0; k--) {
        const e = entities[k]
        if (e.place.on === 'tile' && e.place.x === x && e.place.y === y) entities.splice(k, 1)
      }
      if (!thing) return
      const eid = `${id}~v${n++}`
      entities.push({ id: eid, type: thing.type, place: { on: 'tile', map: id, x, y }, ...(thing.name && { name: thing.name }), ...(thing.props && { props: { ...thing.props } }), ...(thing.statuses && { statuses: { ...thing.statuses } }) })
      thing.contents?.forEach((type, k) => entities.push({ id: `${eid}.${k}`, type, place: { on: 'inside', holder: eid } }))
    }),
  )
}
