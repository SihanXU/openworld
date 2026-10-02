// The Ford (docs/game-design.md): the whole demo on one map. A crossing at the edge of the map
// where the road ends at a river; the ferrykeeper's camp, a stranded peddler's cart, a dead tree
// at the narrows, a dry meadow, a marsh, and the hollow the slimes come out of after dark. The far
// bank is the goal. `buildFord()` is pure (the completeness test builds the world in memory);
// run as a script it writes the default web world.
//
//   npx tsx packages/tools/src/demo/world.ts

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tickAt, type AiData, type Entity, type Forage, type MapMeta, type Pos, type SceneDef, type ScheduleEntry, type ScheduleVariant, type Text, type WorldIndex } from '@lsw/engine'
import { INVARIANTS, PROTECTED_FACTS, type RawChunk } from '@lsw/content'
import { CATALOG } from '../../../client/src/assets/catalog.ts'
import { MapBuilder, linkEdge, reseed, rng } from './builder.ts'
import type { PersonDef, Slot } from './person.ts'
import { PEOPLE } from './people.ts'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../../client/public/world')
export const VERSION = 'ford-3'
export const START_HOUR = 13
const L = (en: string, zh: string): Text => ({ en, zh })
const SOLID = new Set(['water', 'deepwater', 'tree', 'pine', 'bush', 'rock', 'wall', 'woodwall', 'roof', 'cave_wall', 'lava', 'charred_tree', 'void'])

/**
 * The river, row by row: its near (west) edge and far (east) edge. It comes down from the north
 * between the woods and the far bank, narrows to three tiles where the dead tree stands, widens
 * into a still pool at the landing (where a ferry makes sense), and bends away to the south.
 */
const NEAR = [27, 27, 27, 27, 27, 27, 28, 28, 28, 29, 29, 29, 28, 27, 26, 26, 26, 26, 26, 26, 27, 27, 28, 28, 28, 28, 28, 28, 28, 28]
const FAR = [31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32]
/** Everything east of this column is the far bank (the goal region); the river never reaches it on the near side. */
export const FAR_BANK = 32

/** Where things are, and where a person stands to use them (the completeness test reads these). */
export const AT = {
  spawn: [14, 17],
  campfire: [14, 16],
  /** the tent: three by three, standing on this, its front middle */
  tent: [10, 14],
  chest: [12, 14],
  cart: [20, 14],
  haystack: [9, 10],
  axe: [7, 16],
  torch: [15, 17],
  bucket: [25, 17],
  winch: [25, 15],
  raft: [28, 16],
  deadTree: [28, 10],
  burrow: [5, 4],
  fireSlime: [5, 6],
  frostSlime: [25, 4],
  farLanding: [33, 16],
} as const satisfies Record<string, readonly [number, number]>

/** Tiles to stand on for each use (each is open ground, next to what it is for). */
export const STAND = {
  /** west of the dead tree: the only side it can be felled from, across the water */
  tree: [27, 10],
  /** south of the winch, on the landing */
  winch: [25, 16],
  /** on the bank, with the river right (east) of it: where frost is cast to start a path */
  castFrom: [26, 13],
  /** a bank tile with water east of it, to fill a bucket */
  fill: [27, 12],
  /** the end of the near pier, the boat east of it */
  raft: [27, 16],
  /** south of the chest */
  chest: [12, 15],
  /** south of Tobin's place by the cart */
  tobin: [20, 16],
  /** east of the cart, facing its pile */
  cart: [21, 14],
  /** the road west of the camp: open ground with open ground east of it */
  road: [6, 19],
  /** the dry meadow */
  meadow: [12, 7],
  /** near where the frost slime roams at night, well away from the fire */
  frostGround: [22, 10],
  /** a spot by the fire, inside its reach */
  byFire: [15, 17],
} as const satisfies Record<string, readonly [number, number]>

function buildMap(): MapBuilder {
  const m = new MapBuilder('ford', L('The Ford', '渡口'), 'wild', 40, 30, 'grass', 'Village', 'outdoor', 'frostfang')
  const grass = (t: string) => t === 'grass'
  // ------------------------------------------------------------ the river: a pool at the landing, narrows at the dead tree
  for (let y = 0; y < m.h; y++) for (let x = NEAR[y]; x <= FAR[y]; x++) m.set(x, y, 'water')
  // the frost slime keeps its corner of the bank in rime and the river's edge frozen (the ice route, shown before it is taught)
  m.organic(24.5, 4, 2.4, 1.6, 'snow', { only: (t) => t === 'grass' })
  for (const [x, y] of [[27, 3], [27, 4], [28, 4], [27, 5]] as const) m.set(x, y, 'ice')
  // the spit the dead tree stands on: rock either side, so it can only be felled from the west, across the water
  m.set(28, 9, 'rock')
  m.set(28, 11, 'rock')
  // ------------------------------------------------------------ the north: a mossy cliff, and the hollow at its foot
  for (let x = 0; x <= 22; x++) m.scenery(x === 22 ? 'cliff_r' : 'cliff_m', x, 0)
  for (let x = 0; x <= 22; x++) for (let y = 0; y < 3; y++) m.set(x, y, 'cave_wall')
  // the woods close the north-east corner between the cliff and the river
  clump(m, 24.5, 1.5, 2.6, 0.85)
  // the hollow: a rock mound with a cave mouth, bare trodden earth before it, bones and stones
  m.organic(5.5, 5.6, 3.2, 1.8, 'dirt', { only: grass })
  m.item('item/material/bone', 3, 6)
  m.item('item/material/bone', 7, 7)
  m.fixture('fixture/nature/boulder', 2, 4)
  m.fixture('fixture/nature/boulder', 8, 4)
  m.fixture('fixture/nature/moss', 3, 4)
  // ------------------------------------------------------------ the woods: west and south, in clumps with depth, the road's gap open
  for (let y = 3; y < m.h; y++) for (let x = 0; x < 3; x++) if (!(y >= 18 && y <= 20) && (x < 2 || rng.chance(0.55))) m.set(x, y, rng.chance(0.25) ? 'pine' : 'tree')
  for (const [cx, cy, r, p] of [[2.5, 7, 2.4, 0.7], [3, 13, 2, 0.55], [8.5, 26, 3, 0.75], [3, 25, 3, 0.8], [14, 28.5, 2.2, 0.8], [21, 29, 2, 0.75], [26, 28, 1.4, 0.6], [17.5, 4, 1.4, 0.5]] as const) clump(m, cx, cy, r, p)
  for (let x = 0; x < 27; x++) for (let y = 28; y < m.h; y++) if (grass(m.get(x, y))) m.set(x, y, rng.chance(0.2) ? 'pine' : 'tree')
  // the far bank: trees frame the road east, which leaves the map into the unwritten
  clump(m, 37, 4, 3.2, 0.8)
  clump(m, 37.5, 24.5, 3.5, 0.8)
  clump(m, 35.5, 9.5, 1.3, 0.5)
  // ------------------------------------------------------------ the dry meadow (fire runs here)
  m.organic(11, 7.8, 5.6, 2.4, 'drygrass', { only: grass, rough: 0.3 })
  // ------------------------------------------------------------ the marsh (lightning runs here): small ponds among reeds
  // ponds are round: blobs of at least 3x3 (smaller ones render as slivers and diamonds)
  for (let y = 21; y <= 23; y++) for (let x = 18; x <= 20; x++) m.set(x, y, 'water')
  for (let y = 22; y <= 24; y++) for (let x = 22; x <= 25; x++) if (!(y === 24 && (x === 22 || x === 25))) m.set(x, y, 'water')
  // ------------------------------------------------------------ paths: the road in from the west, through the camp to the landing; trails
  m.path([[0, 19], [5, 19], [9, 19], [12, 20], [16, 20], [19, 18], [22, 16], [25, 16]], 'path', 2, { edge: 'dirt', edgeP: 0.18 })
  m.path([[14, 14], [13, 11], [10, 8], [7, 6]], 'path', 1)
  m.path([[22, 15], [24, 12], [27, 10]], 'path', 1)
  m.path([[FAR_BANK + 1, 16], [35, 15], [37, 13], [39, 13]], 'path', 1)
  // the landing and the far one: a short pier out into the pool on each side, the gap the ferry crossed
  for (const [x, y] of [[26, 16], [27, 16], [31, 16], [32, 16]] as const) m.set(x, y, 'bridge')
  // ------------------------------------------------------------ the camp
  // the tent is a thing, not a stamp: three by three, in the way while it stands
  m.fixture('fixture/tent', ...AT.tent, { id: 'ford.tent' })
  m.fixture('fixture/light/campfire', ...AT.campfire, { id: 'ford.campfire', statuses: { lit: -1 } })
  m.fixture('fixture/container/chest', ...AT.chest, { id: 'ford.chest', props: { owner: 'npc.hesper', capacity: 8 } }, [
    { form: 'item/tool/rope', props: { owner: '' } },
    { form: 'item/food/bread', props: { owner: 'npc.hesper' } },
  ])
  // around the fire: a log bench to sit on, a rack for the pot; the woodpile and the chopping stump by the tent
  // anything that looks like a thing is one: every input reaches it (requirement F11)
  m.fixture('fixture/furniture/bench/log', 14, 18)
  m.fixture('fixture/furniture/rack', 17, 15)
  m.fixture('fixture/nature/logpile/stack', 8, 15)
  m.fixture('fixture/nature/stump', 6, 16)
  m.item({ form: 'item/weapon/blade/axe', material: 'iron', name: L('Old Axe', '旧斧头') }, ...AT.axe)
  m.item('item/light/torch', ...AT.torch)
  m.fixture('fixture/light/lantern', 16, 21)
  // the open slope between the meadow and the river: a few boulders and bushes to break it up
  for (const [x, y] of [[20, 5], [21, 4], [17, 9]] as const) m.fixture('fixture/nature/boulder', x, y)
  clump(m, 22, 8, 1.2, 0.7)
  // where the road east leaves the far bank, a signpost to nowhere yet
  m.fixture('fixture/sign', 35, 14, { props: { text: '→ ?' } })
  m.fixture('fixture/nature/haystack', ...AT.haystack)
  // the peddler's cart by the road, his wares on it, his mat beside it
  m.fixture('fixture/furniture/cart', ...AT.cart, { id: 'ford.cart', props: { owner: 'npc.tobin' } })
  m.item({ form: 'item/weapon/magic/wand', material: 'wood', element: 'ice', name: L('Frost Wand', '寒霜魔杖'), props: { owner: 'npc.tobin' } }, ...AT.cart)
  m.item({ form: 'item/vessel/flask/oil', props: { owner: 'npc.tobin' } }, ...AT.cart)
  // the landing: the post the ferry line ran from, the boat on the water, a bucket, a coil of old line
  m.fixture('fixture/ferry/winch', ...AT.winch, { id: 'ford.winch', statuses: { broken: -1 } })
  m.fixture('fixture/ferry/raft', ...AT.raft, { id: 'ford.raft' })
  m.item('item/vessel/bucket/empty', ...AT.bucket)
  // the dead tree at the narrows, and the hollow the slimes come out of
  m.fixture('fixture/nature/dead_tree', ...AT.deadTree, { id: 'ford.dead_tree' })
  m.fixture('fixture/nature/burrow', ...AT.burrow, { id: 'ford.burrow' })
  m.creature('slime/fire_slime', ...AT.fireSlime, { id: 'ford.fire_slime', temper: 'wary', sight: 4 }).ai!.night = { map: 'ford', x: 10, y: 9 }
  m.creature('slime/frost_slime', ...AT.frostSlime, { id: 'ford.frost_slime', temper: 'nocturnal', sight: 4 }).ai!.night = { map: 'ford', x: 24, y: 12 }
  // ------------------------------------------------------------ anchors (schedules, scenes) and the goal
  m.anchor('camp.fire', 13, 16)
  m.anchor('camp.warm', 15, 16)
  m.anchor('camp.bed', 12, 16)
  m.anchor('tent.mouth', 10, 15)
  m.anchor('tent.side', 12, 15)
  m.anchor('cart', 20, 15)
  m.anchor('cart.bed', 21, 14)
  m.anchor('landing.winch', 24, 15)
  m.anchor('landing.nets', 25, 18)
  m.anchor('landing.edge', 25, 13)
  m.anchor('far.landing', ...AT.farLanding)
  m.regions = { far_bank: [FAR_BANK, 0, m.w - FAR_BANK, m.h] }
  // ------------------------------------------------------------ small things, by masks: where they belong, never uniform noise
  const by = (x: number, y: number, what: (t: string) => boolean) => m.near(x, y, what)
  const water = (t: string) => t === 'water'
  const tree = (t: string) => t === 'tree' || t === 'pine'
  const road = (t: string) => t === 'path' || t === 'dirt'
  const marsh = (x: number, y: number) => y >= 20 && y <= 27 && x >= 15 && x <= 26
  m.sprinkle('fixture/nature/reeds', 0.22, (x, y, t) => grass(t) && marsh(x, y) && by(x, y, water))
  m.sprinkle('fixture/nature/ferns', 0.22, (x, y, t) => grass(t) && marsh(x, y))
  m.sprinkle('fixture/nature/reeds', 0.08, (x, y, t) => grass(t) && by(x, y, water) && (y < 9 || y > 21))
  m.sprinkle('fixture/nature/flowers', 0.12, (x, y, t) => grass(t) && by(x, y, road))
  m.sprinkle('fixture/nature/flowers', 0.1, (x, y, t) => grass(t) && x > FAR_BANK)
  m.sprinkle('fixture/nature/leaves', 0.16, (x, y, t) => grass(t) && by(x, y, tree))
  m.sprinkle('fixture/nature/pebbles', 0.15, (x, y, t) => grass(t) && by(x, y, water) && y >= 10 && y <= 20)
  m.sprinkle('fixture/nature/boulder', 0.12, (x, y, t) => grass(t) && y === 3 && x < 22)
  m.sprinkle('fixture/nature/tuft', 0.05, (_x, _y, t) => grass(t))
  // ------------------------------------------------------------ what the ground yields (Don't Starve's twigs, flint and grass)
  // sticks under the western woods, stones on the slope, grass in the meadow: a first tool's worth
  // lies there from the start, and the ground yields more over time, up to a handful of each
  lay(m, 'item/material/stick', 3, [3, 11, 6, 9])
  lay(m, 'item/material/stone', 3, [16, 5, 6, 6])
  lay(m, 'item/material/grass', 3, [9, 5, 6, 5])
  m.forage = [...MATERIALS_FORAGE]
  return m
}

/** Sticks, stones and grass: every outdoor map's ground yields them, up to a handful of each. */
const MATERIALS_FORAGE: Forage[] = [
  { type: 'item/material/stick', on: ['grass'], max: 6 },
  { type: 'item/material/stone', on: ['grass'], max: 5 },
  { type: 'item/material/grass', on: ['grass', 'drygrass'], max: 6 },
]

/** Lay up to n of an item on open grass in a rect, spread on a fixed pattern (no randomness: the map's other draws stay as they were). */
function lay(m: MapBuilder, type: string, n: number, [x0, y0, w, h]: [number, number, number, number]): void {
  for (let y = y0, k = 0; y < y0 + h && k < n; y++)
    for (let x = x0; x < x0 + w && k < n; x++) if ((x * 7 + y * 3) % 5 === 0 && ['grass', 'drygrass'].includes(m.get(x, y)) && m.free(x, y)) (m.item(type, x, y), k++)
}

// =================================================================== the meadow, west of the Ford

/** The road's gap in the Ford's western woods, and the meadow's eastern one it leads to. */
export const WEST_GAP = [18, 19, 20]
/** The gap in the meadow's southern woods (columns), and the forest's northern one below it. */
export const SOUTH_GAP = [22, 23, 24]
/** Where the meadow's animals start (the completeness test reads these). */
export const MEADOW = {
  cows: [[12, 10], [18, 14], [9, 20]],
  hens: [[24, 9], [26, 12], [22, 21], [28, 19]],
} as const satisfies Record<string, readonly (readonly [number, number])[]>
/** A passive animal: it wanders near where it lives, and runs from whoever strikes it. */
const GRAZER: Omit<AiData, 'home'> = { behaviour: 'passive', temper: 'wary', sight: 4, leash: 6 }

/** Open grassland in a ring of woods (Minecraft's plains): cows and chickens, and more of them in time. */
function buildMeadow(): MapBuilder {
  const m = new MapBuilder('meadow', L('The Meadow', '草原'), 'wild', 40, 30, 'grass', 'Village', 'outdoor', 'frostfang')
  const open = (y: number) => WEST_GAP.includes(y)
  // the woods all round, two to four deep, the east side open where the road comes in
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      if (x >= m.w - 4 && open(y)) continue
      if (y >= m.h - 4 && SOUTH_GAP.includes(x)) continue
      if (edge < 2 || (edge < 4 && rng.chance(0.45 - edge * 0.1))) m.set(x, y, rng.chance(0.25) ? 'pine' : 'tree')
    }
  for (const [cx, cy, r, p] of [[4, 4, 3, 0.7], [35, 4, 2.6, 0.7], [4, 26, 3, 0.75], [33, 26, 2.4, 0.7], [20, 2.5, 2, 0.6], [2.5, 15, 2, 0.6]] as const) clump(m, cx, cy, r, p)
  // the road in from the Ford fades into the grass
  m.path([[39, 19], [34, 19], [30, 18]], 'path', 2, { edge: 'dirt', edgeP: 0.3 })
  // and a trail south, into the forest
  m.path([[27, 21], [23, 25], [23, 29]], 'path', 1, { edge: 'dirt', edgeP: 0.2 })
  // a pond where the animals drink
  m.organic(16, 22, 2.6, 1.7, 'water', { only: (t) => t === 'grass' })
  // small things: flowers and tufts in the open, leaves under the trees
  const tree = (t: string) => t === 'tree' || t === 'pine'
  m.sprinkle('fixture/nature/flowers', 0.06, (x, y, t) => t === 'grass' && !m.near(x, y, tree, 2))
  m.sprinkle('fixture/nature/tuft', 0.08, (x, y, t) => t === 'grass' && !m.near(x, y, tree, 1))
  m.sprinkle('fixture/nature/leaves', 0.14, (x, y, t) => t === 'grass' && m.near(x, y, tree))
  // the herd and the hens; hens lay through the day
  const start = tickAt(1, START_HOUR)
  for (const [x, y] of MEADOW.cows) m.creature('animal/cow', x, y, { ...GRAZER })
  MEADOW.hens.forEach(([x, y], i) => (m.creature('animal/chicken', x, y, { ...GRAZER }).statuses = { laying: start + 600 + i * 300 }))
  // sticks under the woods, stones and grass in the open, as on the Ford
  lay(m, 'item/material/stick', 3, [5, 5, 8, 6])
  lay(m, 'item/material/stone', 3, [20, 15, 8, 6])
  lay(m, 'item/material/grass', 3, [26, 6, 8, 6])
  // Minecraft's passive mobs are slow to come back: a cow every two minutes, a hen every ninety seconds, while there is room
  m.forage = [
    ...MATERIALS_FORAGE,
    { type: 'actor/creature/animal/cow', on: ['grass'], max: 4, every: 1200, ai: GRAZER, statuses: [] },
    { type: 'actor/creature/animal/chicken', on: ['grass'], max: 5, every: 900, ai: GRAZER, statuses: ['laying'] },
  ]
  return m
}

// =================================================================== the forest, south of the meadow

/** Dense woods to fell (wood/notch, wood/fell: two swings of an axe; a stump grows back in two days), a trail and clearings through them. */
function buildForest(): MapBuilder {
  const m = new MapBuilder('forest', L('The Forest', '森林'), 'wild', 40, 30, 'grass', 'Village', 'outdoor', 'frostfang')
  const tree = () => (rng.chance(0.3) ? 'pine' : 'tree')
  // the woods close all round, the north open where the meadow's trail comes in
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      if (y < 4 && SOUTH_GAP.includes(x)) continue
      if (edge < 2 || (edge < 4 && rng.chance(0.5))) m.set(x, y, tree())
      // inside, trees stand thick: two in five tiles
      else if (rng.chance(0.4)) m.set(x, y, tree())
    }
  // clearings, a trail that winds through them, and side trails off it
  const wood = (t: string) => t === 'tree' || t === 'pine'
  for (const [cx, cy, rx, ry] of [[23, 7, 3.2, 2.2], [13, 13, 3.6, 2.6], [27, 17, 3, 2.4], [10, 23, 3.4, 2.2], [31, 25, 2.8, 2]] as const) m.organic(cx, cy, rx, ry, 'grass', { only: wood, rough: 0.2 })
  m.path([[23, 0], [23, 5], [20, 9], [15, 12], [17, 16], [24, 17], [27, 21], [20, 23], [12, 23]], 'path', 1, { edge: 'dirt', edgeP: 0.25 })
  m.path([[27, 21], [31, 25]], 'path', 1)
  m.path([[15, 12], [7, 9], [5, 15]], 'path', 1)
  // the forest floor: leaves under the trees, ferns and moss in the shade, tufts in the clearings
  const near = (x: number, y: number) => m.near(x, y, wood)
  m.sprinkle('fixture/nature/leaves', 0.3, (x, y, t) => t === 'grass' && near(x, y))
  m.sprinkle('fixture/nature/ferns', 0.12, (x, y, t) => t === 'grass' && near(x, y))
  m.sprinkle('fixture/nature/moss', 0.05, (x, y, t) => t === 'grass' && near(x, y))
  m.sprinkle('fixture/nature/tuft', 0.08, (x, y, t) => t === 'grass' && !near(x, y))
  // what falls in a forest: sticks above all
  lay(m, 'item/material/stick', 4, [18, 4, 10, 8])
  lay(m, 'item/material/stone', 2, [10, 10, 8, 6])
  m.forage = [
    { type: 'item/material/stick', on: ['grass'], max: 10 },
    { type: 'item/material/stone', on: ['grass'], max: 3 },
    { type: 'item/material/grass', on: ['grass'], max: 4 },
  ]
  return m
}

/** A clump of trees (some pines, a few bushes) around a point, leaving free what is already built. */
function clump(m: MapBuilder, cx: number, cy: number, r: number, p = 0.7): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if (Math.hypot(x - cx, y - cy) <= r && m.get(x, y) === 'grass' && m.free(x, y) && rng.chance(p)) m.set(x, y, rng.chance(0.12) ? 'bush' : rng.chance(0.25) ? 'pine' : 'tree')
}

// =================================================================== people

function slots(p: PersonDef, key: string, list: Slot[], at: (name: string) => Pos): ScheduleEntry[] {
  // a variant covers the whole day
  const covered = new Array(24).fill(false)
  for (const [from, to] of list) for (let h = from; h !== to; h = (h + 1) % 24) covered[h] = true
  const gap = covered.indexOf(false)
  if (gap >= 0) throw new Error(`${p.id} schedule ${key} leaves hour ${gap} uncovered`)
  return list.map(([from, to, anchor, activity, needs]) => ({ from, to, ...at(anchor), activity, ...(needs && { uses: needs.uses, need: needs.need }) }))
}

function person(p: PersonDef, at: (name: string) => Pos): Entity {
  const schedule = slots(p, 'default', p.schedules.default, at)
  const schedules: ScheduleVariant[] = Object.entries(p.schedules).map(([key, list]) => ({ key, entries: slots(p, key, list, at) }))
  const hourIn = (s: ScheduleEntry, h: number) => (s.from <= s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to)
  const first = schedule.find((s) => hourIn(s, START_HOUR)) ?? schedule[0]
  return {
    id: p.id,
    type: `actor/person/${p.role}`,
    name: p.name,
    place: { on: 'tile', map: first.map, x: first.x, y: first.y },
    facing: 'down',
    props: { age: p.age },
    npc: {
      role: p.role,
      schedule,
      look: p.look,
      lines: p.lines.filter((l) => l.key === 'default').map((l) => l.text),
      faction: 'ford',
      person: { temperament: p.temperament, ties: p.ties, lines: p.lines, schedules },
    },
  }
}

// =================================================================== scenes

const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })

const scenes: SceneDef[] = [
  {
    // The afternoon after the storm: you wake by the ferrykeeper's fire.
    id: 'arrival',
    map: 'ford',
    script: [
      { place: 'npc.hesper', map: 'ford', x: 13, y: 17 },
      { face: 'npc.hesper', dir: 'right' },
      { face: 'player', dir: 'left' },
      { wait: 10 },
      say('npc.hesper', 'Awake. Good. You came in with the storm last night, half drowned on the road.', '醒了。好。你昨夜跟着风暴一起来的，在路上差点淹死。'),
      say('npc.hesper', 'The storm took the ferry rope as well. Nobody crosses until it is mended.', '风暴把渡绳也扯断了。修好之前，谁也过不去。'),
      say('npc.tobin', 'And nobody eats, either!', '也没人有饭吃！', 'surprised'),
      say('npc.hesper', 'That is Tobin. He talks.', '那是托宾。他话多。'),
      { give: 'item/food/bread' },
      say('player', '(Still in your pack: the end of a travel loaf.)', '（行囊里还剩半块路上吃的面包。）'),
      { prop: 'quest', value: 1 },
    ],
  },
  {
    // The ferry: she takes you over on the mended line (or wades you over when every way is gone).
    id: 'ferry',
    map: 'ford',
    manual: true,
    script: [
      { fade: 'out' },
      { wait: 12 },
      { warp: 'ford', x: AT.farLanding[0], y: AT.farLanding[1] },
      { place: 'npc.hesper', map: 'ford', x: 23, y: 14 },
      { fade: 'in' },
      say('npc.hesper', 'There. Mind the step — and the road. Nobody has walked it since the storm.', '到了。小心脚下——也小心那条路。风暴以后还没人走过。'),
    ],
  },
  {
    // The goal is a state: however you got here, the far bank ends the story.
    id: 'far_bank',
    map: 'ford',
    when: { region: 'far_bank' },
    script: [
      { fact: 'ford.crossed', value: 1 },
      { prop: 'quest', value: 2 },
      { wait: 10 },
      say('npc.hesper', 'Go on, then. If you find the far end of that road, come back and tell me what is there.', '那就走吧。要是你走到了那条路的尽头，回来告诉我那边有什么。'),
      say('npc.tobin', 'Wait for me! … No? Next time, then.', '等等我！……不等？那下回吧。'),
      { topic: 'crossed', days: 30 },
      {
        card: L(
          'THE FORD\n\nYou crossed.\nPast here, nothing is written yet.\n\nEverything the world learned from you is in the Threadbook (J).',
          '渡口\n\n你过了河。\n从这里往东，什么都还没写成。\n\n世界从你身上学到的一切，都记在织线簿里（J）。',
        ),
      },
    ],
  },
]

// =================================================================== the world

export interface FordWorld {
  index: WorldIndex
  chunks: RawChunk[]
}

export function buildFord(): FordWorld {
  // each map from its own seed: the same world on every build, and one map's draws never move another's
  reseed(4242)
  const m = buildMap()
  for (const [name, [x, y]] of Object.entries(m.anchors)) {
    const t = m.get(x, y)
    if (SOLID.has(t) || !m.walkable(x, y)) throw new Error(`anchor ${name} at ${x},${y} is not walkable (${t})`)
  }
  const at = (name: string): Pos => {
    const a = m.anchors[name]
    if (!a) throw new Error(`unknown anchor ${name}`)
    return { map: m.id, x: a[0], y: a[1] }
  }
  const npcs = PEOPLE.map((p) => person(p, at))
  // the meadow west of the Ford, through the road's gap in the woods
  reseed(4243)
  const meadow = buildMeadow()
  linkEdge(m, WEST_GAP.map((y) => [0, y]), [1, 0], meadow, WEST_GAP.map((y) => [meadow.w - 1, y]), [-1, 0])
  // the forest south of the meadow
  reseed(4244)
  const forest = buildForest()
  linkEdge(meadow, SOUTH_GAP.map((x) => [x, meadow.h - 1]), [0, -1], forest, SOUTH_GAP.map((x) => [x, 0]), [0, 1])
  const chunk = m.chunk()
  const meadowChunk = meadow.chunk()
  const forestChunk = forest.chunk()
  let items = 0
  let fixtures = 0
  let creatures = 0
  const kinds = new Set<string>()
  for (const e of [...chunk.entities, ...meadowChunk.entities, ...forestChunk.entities]) {
    if (e.type.startsWith('item/')) (items++, kinds.add(`${e.type}|${(e.tags ?? []).join(',')}`))
    else if (e.type.startsWith('fixture/')) fixtures++
    else if (e.type.startsWith('actor/creature')) creatures++
  }
  const metaOf = (b: MapBuilder, c: RawChunk): MapMeta => ({ id: b.id, name: b.name, kind: b.kind, region: b.region, width: b.w, height: b.h, portals: b.portals, npcs: b === m ? npcs.length : 0, items: c.entities.filter((e) => e.type.startsWith('item/')).length })
  const index: WorldIndex = {
    name: L('The Ford', '渡口'),
    version: VERSION,
    seed: 4242,
    start: { map: m.id, x: AT.spawn[0], y: AT.spawn[1] },
    startHour: START_HOUR,
    maps: [metaOf(m, chunk), metaOf(meadow, meadowChunk), metaOf(forest, forestChunk)],
    npcs,
    player: {
      id: 'player',
      type: 'actor/person/player',
      name: L('You', '你'),
      place: { on: 'none' },
      facing: 'up',
      look: CATALOG.roles.player?.[0] ?? 'NinjaMasked',
      props: { hp: 40, maxHp: 40, atk: 2, def: 0, speed: 2, quest: 0 },
    },
    stats: { maps: 3, npcs: npcs.length, creatures, items, itemKinds: kinds.size, fixtures },
    scenes,
    invariants: INVARIANTS,
    protectedFacts: PROTECTED_FACTS,
    weather: [
      { day: 1, from: 0, to: 17, weather: 'cloud' },
      { day: 1, from: 17, to: 20, weather: 'storm' },
      { day: 1, from: 20, to: 24, weather: 'rain' },
      { day: 2, from: 0, to: 8, weather: 'fog' },
      { day: 2, from: 8, to: 24, weather: 'sun' },
    ],
  }
  return { index, chunks: [chunk, meadowChunk, forestChunk] }
}

// =================================================================== write

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1]).toLowerCase()) {
  const { index, chunks } = buildFord()
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(join(OUT, 'maps'), { recursive: true })
  for (const c of chunks) writeFileSync(join(OUT, 'maps', `${c.map.id}.json`), JSON.stringify(c))
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))
  const lines = PEOPLE.reduce((n, p) => n + p.lines.length, 0)
  const s = index.stats
  console.log(`The Ford: ${s.maps} maps, ${s.npcs} people (${lines} lines), ${s.creatures} creatures, ${s.items} items (${s.itemKinds} kinds), ${s.fixtures} fixtures → ${OUT}`)
}
