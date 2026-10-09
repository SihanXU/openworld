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
import { tickAt, type AiData, type Entity, type MapMeta, type Pos, type StepDef, type ScheduleEntry, type ScheduleVariant, type Text, type WorldIndex } from '@lsw/engine'
import { BOSSES, CH1_QUESTS, HAVEN_QUESTS, codexEntries, FIRSTLIGHT, INVARIANTS, OBJECTIVES, VILLAGE_QUESTS, PROLOGUE_AT_FOOT, PROLOGUE_BEATS, PROLOGUE_DONE, PROLOGUE_OBJECTIVES, PROTECTED_FACTS, type RawChunk } from '@lsw/content'
import { CATALOG } from '../../../client/src/assets/catalog.ts'
import { MapBuilder, itemOf, linkEdge, reseed, rng } from './builder.ts'
import { GROUND_YIELD, appears, clump, lay } from './kit.ts'
import { plantGarden } from './garden.ts'
import { EAST_ROAD, EMBERFALL, LAIR, MINE, PASS, buildEastRoad, buildEmberfall, buildLair, buildMine, buildPass } from './quest/maps.ts'
import { QUEST_SCENES } from './quest/scenes.ts'
import { PAT, PROLOGUE, TUTORIAL, buildFoot, buildSummit, buildTutorial } from './prologue.ts'
import { BARROW, HOLLOW, buildBarrow, buildHollow, buildOssuary, buildSanctum } from './hollow.ts'
import type { PersonDef, Slot } from './person.ts'
import { buildOverworld, placeCells, siteOf } from './overworld.ts'
import { PEOPLE } from './people.ts'
import { buildHaven } from './quest/haven.ts'
import { VIGIL, buildChapel, buildDawnHill, buildMillCellar, buildMillbrook } from './quest/vigil.ts'
import { CHAPTER1_SCENES, CHAPTER1_STORY, HAVEN_STORY, buildOffstage, chapter1Barrow, chapter1EastRoad, chapter1Foot, chapter1Ford, chapter1Forest, chapter1Hollow, chapter1Pasture, chapter1Summit, chapter1Village } from './quest/chapter1.ts'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../../client/public/world')
export const VERSION = 'ford-4'
export const START_HOUR = 13
const L = (en: string, zh: string): Text => ({ en, zh })
const SOLID = new Set(['water', 'deepwater', 'tree', 'pine', 'bush', 'rock', 'wall', 'woodwall', 'burnt_wall', 'roof', 'cave_wall', 'lava', 'charred_tree', 'void'])

/**
 * The river, row by row: its near (west) edge and far (east) edge. It comes down from the north
 * between the woods and the far bank, narrows where the dead tree stands, widens
 * into a still pool at the landing (where a ferry makes sense), and bends away to the south.
 */
const NEAR = [27, 27, 27, 27, 27, 27, 28, 28, 28, 29, 29, 29, 28, 27, 26, 26, 26, 26, 26, 26, 27, 27, 28, 28, 28, 28, 28, 28, 28, 28]
const FAR = [31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32].map((x) => x + 3)
/** Everything east of this column is the far bank (the goal region); the river never reaches it on the near side. */
export const FAR_BANK = 36

/** The footbridge south of the landing: its two ends stand, the storm tore out the middle span (main-quest chapter 1). */
export const FOOTBRIDGE = { y: 22, ends: [30, 34], gap: [31, 32, 33], piers: [28, 29, 30, 34, 35] } as const

/** Where things are, and where a person stands to use them (the completeness test reads these). */
export const AT = {
  spawn: [14, 17],
  campfire: [14, 16],
  /** the tent: three by three, standing on this, its front middle */
  tent: [10, 14],
  chest: [12, 14],
  cart: FIRSTLIGHT.cart,
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
  farLanding: [37, 16],
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
  tobin: FIRSTLIGHT.tobinStand,
  /** east of the cart, facing its pile */
  cart: FIRSTLIGHT.cartStand,
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
  const m = new MapBuilder('ford', L('The Ford', '渡口'), 'wild', 48, 30, 'grass', 'field', 'outdoor', 'frostfang')
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
  // the stair down the cliff from the mountain (docs/prologue.md): a gap in it, a trail to the camp
  const stair = PROLOGUE.fordNorth as readonly number[]
  const [s0, s1] = [stair[0], stair[stair.length - 1]]
  for (let x = 0; x <= 22; x++) if (!stair.includes(x)) m.scenery(x === 22 || x === s0 - 1 ? 'cliff_r' : x === s1 + 1 ? 'cliff_l' : 'cliff_m', x, 0)
  for (let x = 0; x <= 22; x++) for (let y = 0; y < 3; y++) m.set(x, y, stair.includes(x) ? 'path' : 'cave_wall')
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
  clump(m, 44, 4, 3.2, 0.8)
  clump(m, 44.5, 24.5, 3.5, 0.8)
  clump(m, 41.5, 9.5, 1.3, 0.5)
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
  m.path([[FAR_BANK + 1, 16], [40, 15], [44, 13], [m.w - 1, 13]], 'path', 1)
  // the landing and the far one: a short pier out into the pool on each side, the gap the ferry crossed
  for (const [x, y] of [[26, 16], [27, 16], [34, 16], [35, 16]] as const) m.set(x, y, 'bridge')
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
  m.fixture('fixture/sign', 40, 14, { props: { text: '→ Emberfall', text_zh: '→ 余烬镇' } })
  m.fixture('fixture/nature/haystack', ...AT.haystack)
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
  m.appear = [...GROUND_YIELD]
  // ------------------------------------------------------------ the footbridge (chapter 1): a trail down from the landing to it, its ends standing, three planks gone
  m.path([[25, 18], [25, 20], [26, 20], [26, 22], [27, 22]], 'path', 1)
  for (const x of FOOTBRIDGE.piers) m.set(x, FOOTBRIDGE.y, 'bridge')
  // the trail from the cliff stair to the camp (docs/prologue.md): drawn last, so every draw above stays as it was
  m.path([[17, 2], [17, 5], [15, 8], [13, 11]], 'path', 1)
  return m
}



// =================================================================== Firstlight Village, west of the Ford (stable id: meadow)

/** The road's gap in the Ford's western woods, and the meadow's eastern one it leads to. */
export const WEST_GAP = [18, 19, 20]
/** The gap in the meadow's southern woods (columns), and the forest's northern one below it. */
export const SOUTH_GAP = [22, 23, 24]
/** Where the grassland's animals start (the completeness test reads these). */
export const MEADOW = {
  cows: [[12, 10], [18, 14], [9, 20]],
  hens: [[24, 9], [26, 12], [22, 21], [28, 19]],
} as const satisfies Record<string, readonly (readonly [number, number])[]>
/** A passive animal: it wanders near where it lives, and runs from whoever strikes it. */
const GRAZER: Omit<AiData, 'home'> = { behaviour: 'passive', temper: 'wary', sight: 4, leash: 6 }

/** A starting village in a ring of woods, with homes, a shared square, pasture and a garden. */
function buildMeadow(): MapBuilder {
  const m = new MapBuilder(FIRSTLIGHT.map, FIRSTLIGHT.name, 'village', 40, 30, 'grass', 'village', 'outdoor', 'frostfang')
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
  // The east gate leads to a village square, then homes and the forest trail.
  m.path([[39, 19], [34, 19], [29, 17], [23, 16], [18, 17], [11, 16]], 'path', 2, { edge: 'dirt', edgeP: 0.2 })
  // and a trail south, into the forest
  m.path([[23, 17], [24, 20], [23, 25], [23, 29]], 'path', 2, { edge: 'dirt', edgeP: 0.2 })
  m.organic(21, 16, 4.6, 3, 'cobble', { only: (t) => t === 'grass' || t === 'path' })
  // Four modest homes, paths to each door, a communal well and an evening fire.
  for (const [key, x, y] of [['house_plaster', 8, 5], ['house_wood', 19, 5], ['house_thatch', 28, 5], ['house_red', 7, 13]] as const) m.scenery(key, x, y)
  m.path([[9, 8], [12, 11], [18, 16]], 'path', 1)
  m.path([[20, 8], [20, 11], [20, 13]], 'path', 1)
  m.path([[29, 8], [28, 11], [26, 15]], 'path', 1)
  m.path([[8, 16], [12, 17], [17, 17]], 'path', 1)
  m.fixture('fixture/water/well', ...FIRSTLIGHT.well, { id: 'village.well' })
  m.fixture('fixture/light/campfire', ...FIRSTLIGHT.fire, { id: 'village.campfire', statuses: { lit: -1 } })
  m.fixture('fixture/furniture/bench/log', 20, 19, { id: 'village.bench' })
  // the woodworker's bench by the wood pile: what is made at a workbench is made here (world-model.md §6.4)
  m.fixture('fixture/craft/workbench', 11, 18, { id: 'village.workbench' })
  m.fixture('fixture/sign/noticeboard', 17, 14, { id: 'village.notice', props: { text: 'FIRSTLIGHT VILLAGE — Every journey begins with a first step. East: The Ford. West: Millbrook. North: Dawn Hill. South: the grassland, and the forest beyond.', text_zh: '初原村——每段旅程都从第一步开始。东：渡口。西：水车磨坊。北：晨光丘。南：草原，再往南是森林。' } })
  for (const [x, y] of [[25, 13], [12, 16]] as const) m.fixture('fixture/light/lamppost', x, y, { id: `village.lamp.${x}`, statuses: { lit: -1 } })
  // Tobin and his stock move together. Stable IDs keep saved trades and inventories intact.
  m.fixture('fixture/furniture/cart', ...FIRSTLIGHT.cart, { id: 'ford.cart', props: { owner: 'npc.tobin' } })
  m.item({ form: 'item/weapon/magic/wand', material: 'wood', element: 'ice', name: L('Frost Wand', '寒霜魔杖'), props: { owner: 'npc.tobin' } }, ...FIRSTLIGHT.cart).id = 'tobin.wand'
  m.item({ form: 'item/vessel/flask/oil', props: { owner: 'npc.tobin' } }, ...FIRSTLIGHT.cart).id = 'tobin.oil'
  m.anchor('cart', 30, 16)
  m.anchor('cart.bed', 31, 16)
  m.anchor('market.shelter', 29, 9)
  m.anchor('square.well', 20, 14)
  m.anchor('square.warm', 23, 17)
  // the drill yard by the north-east cottage: Bram, the profession trainer (docs/skill-tree.md)
  m.anchor('drill.yard', 33, 11)
  m.anchor('drill.bed', 29, 9)
  // the villagers who give quests (docs/quests.md), and where the rescued foragers live
  m.anchor('elder.porch', 20, 9)
  m.anchor('elder.home', 20, 8)
  m.anchor('cook.fire', 21, 18)
  m.anchor('cook.home', 9, 9)
  m.anchor('pond.edge', 19, 21)
  m.anchor('guard.post', 25, 25)
  m.anchor('guard.home', 29, 9)
  m.anchor('wood.pile', 9, 18)
  // the wood pile Gus stacks his logs on (world-model.md §6.10: work is real)
  m.fixture('fixture/container/woodpile', 9, 19, { id: 'village.woodpile', statuses: { open: -1 } })
  m.anchor('wood.home', 8, 16)
  m.anchor('lina.garden', 13, 18)
  m.anchor('lina.home', 9, 9)
  m.anchor('oskar.bench', 17, 19)
  m.anchor('oskar.home', 29, 9)
  // a pond where the animals drink
  m.organic(16, 22, 2.6, 1.7, 'water', { only: (t) => t === 'grass' })
  // the warm spring west of it (its pool drawn over grass): sit in it and it mends you
  const [sx, sy] = FIRSTLIGHT.spring
  for (let y = sy - 2; y <= sy + 2; y++) for (let x = sx - 2; x <= sx + 2; x++) if (m.get(x, y) === 'tree' || m.get(x, y) === 'pine') m.set(x, y, 'grass')
  m.scenery('spring', sx - 1, sy - 1)
  // the ground round it, where Pip points it out
  m.regions.spring = [sx - 4, sy - 3, 9, 7]
  m.fixture('fixture/sign', sx - 2, sy - 2, { props: { text: 'Warm spring — sit a while, and it mends you.', text_zh: '温泉——泡一会儿，伤就好了。' } })
  // small things: flowers and tufts in the open, leaves under the trees
  const tree = (t: string) => t === 'tree' || t === 'pine'
  m.sprinkle('fixture/nature/flowers', 0.06, (x, y, t) => t === 'grass' && !m.near(x, y, tree, 2))
  m.sprinkle('fixture/nature/tuft', 0.08, (x, y, t) => t === 'grass' && !m.near(x, y, tree, 1))
  m.sprinkle('fixture/nature/leaves', 0.14, (x, y, t) => t === 'grass' && m.near(x, y, tree))
  // the village keeps no herd: the cows and hens graze the grassland south of it (buildPasture)
  // sticks under the woods, stones and grass in the open, as on the Ford
  lay(m, 'item/material/stick', 3, [5, 5, 8, 6])
  lay(m, 'item/material/stone', 3, [20, 15, 8, 6])
  lay(m, 'item/material/grass', 3, [26, 6, 8, 6])
  // fireweed in the open grass, for the herbalist of Emberfall (main quest)
  lay(m, 'item/material/fireweed', 3, [10, 8, 10, 6])
  m.appear = [...GROUND_YIELD, appears('item/material/fireweed', ['grass'], 3, 900)]
  plantGarden(m)
  return m
}

// =================================================================== the grassland, south of the village

/** The village's southern gap (columns) and the grassland's way on south to the forest: the same columns, top and bottom. */
export const PASTURE_GAP = SOUTH_GAP

/** Open grassland in a ring of woods (Minecraft's plains): the cows and hens, and more of them in time. */
function buildPasture(): MapBuilder {
  const m = new MapBuilder('pasture', L('The Grassland', '草原'), 'wild', 40, 30, 'grass', 'field', 'outdoor', 'frostfang')
  const gap = (x: number) => (PASTURE_GAP as readonly number[]).includes(x)
  // woods round the edge, thinner than the village's, open north (from the village) and south (to the forest)
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (gap(x) && (y < 4 || y >= m.h - 4)) continue
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      if (edge < 2 || (edge < 3 && rng.chance(0.4))) m.set(x, y, rng.chance(0.3) ? 'pine' : 'tree')
    }
  // a few lone trees for shade, a pond the animals drink at
  for (const [cx, cy, r, p] of [[9, 8, 1.4, 0.6], [31, 21, 1.6, 0.6], [30, 7, 1.2, 0.5]] as const) clump(m, cx, cy, r, p)
  m.organic(14, 19, 3, 2, 'water', { only: (t) => t === 'grass' })
  m.path([[23, 0], [22, 8], [24, 15], [22, 22], [23, 29]], 'path', 1, { edge: 'dirt', edgeP: 0.25 })
  const tree = (t: string) => t === 'tree' || t === 'pine'
  m.sprinkle('fixture/nature/flowers', 0.08, (x, y, t) => t === 'grass' && !m.near(x, y, tree, 2))
  m.sprinkle('fixture/nature/tuft', 0.1, (x, y, t) => t === 'grass' && !m.near(x, y, tree, 1))
  m.sprinkle('fixture/nature/leaves', 0.14, (x, y, t) => t === 'grass' && m.near(x, y, tree))
  // the herd and the hens; hens lay through the day
  const start = tickAt(1, START_HOUR)
  for (const [x, y] of MEADOW.cows) m.creature('animal/cow', x, y, { ...GRAZER })
  MEADOW.hens.forEach(([x, y], i) => (m.creature('animal/chicken', x, y, { ...GRAZER }).statuses = { stage: start + 600 + i * 300 }))
  // sticks, stones and grass lie about from the start, as everywhere outdoors
  lay(m, 'item/material/stick', 3, [4, 4, 10, 8])
  lay(m, 'item/material/stone', 3, [26, 12, 8, 6])
  lay(m, 'item/material/grass', 3, [16, 6, 8, 6])
  // Minecraft's passive mobs are slow to come back: a cow every two minutes, a hen every ninety seconds, while there is room
  m.appear = [
    ...GROUND_YIELD,
    appears('actor/creature/animal/cow', ['grass'], 4, 1200, { ai: GRAZER }),
    appears('actor/creature/animal/chicken', ['grass'], 5, 900, { ai: GRAZER }),
  ]
  return m
}

// =================================================================== the forest, south of the meadow

/** Dense woods to fell (wood/notch, wood/fell: two swings of an axe; a stump grows back in two days), a trail and clearings through them. */
function buildForest(): MapBuilder {
  const m = new MapBuilder('forest', L('The Forest', '森林'), 'wild', 40, 30, 'grass', 'forest', 'outdoor', 'frostfang')
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
  // clearings, a trail that winds through them, and side trails off it (the first is where the woodcutter works)
  const wood = (t: string) => t === 'tree' || t === 'pine'
  for (const [cx, cy, rx, ry] of [[23, 7, 3.2, 2.2], [13, 13, 3.6, 2.6], [27, 17, 3, 2.4], [10, 23, 3.4, 2.2], [31, 25, 2.8, 2]] as const) m.organic(cx, cy, rx, ry, 'grass', { only: wood, rough: 0.2 })
  m.path([[23, 0], [23, 5], [20, 9], [15, 12], [17, 16], [24, 17], [27, 21], [20, 23], [12, 23]], 'path', 1, { edge: 'dirt', edgeP: 0.25 })
  m.path([[27, 21], [31, 25]], 'path', 1)
  m.anchor('woods.clearing', 23, 7)
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
  // frostcap in the shade, for the herbalist of Emberfall (main quest)
  lay(m, 'item/material/frostcap', 3, [8, 12, 10, 8])
  m.appear = [
    appears('item/material/frostcap', ['grass'], 3, 900),
    appears('item/material/stick', ['grass'], 10),
    appears('item/material/stone', ['grass'], 3),
    appears('item/material/grass', ['grass'], 4),
  ]
  // the way on south, to Thornwood Hollow (docs/quests.md): opened last, so every draw above stays as it was
  for (let y = m.h - 4; y < m.h; y++) for (const x of HOLLOW.forestSouth) m.set(x, y, 'grass')
  m.path([[12, 23], [13, 26], [13, 29]], 'path', 1)
  // what the forest gives a forager and a beekeeper (content life.ts): mushroom rings in the shade, wild hives among the
  // trees — set last, at the first open grass of their patch, so every draw above stays as it was
  const spots = (n: number, [rx, ry, rw, rh]: [number, number, number, number]): [number, number][] => {
    const out: [number, number][] = []
    for (let y = ry; y < ry + rh && out.length < n; y += 2) for (let x = rx; x < rx + rw && out.length < n; x += 3) if (m.get(x, y) === 'grass' && m.free(x, y)) out.push([x, y])
    return out
  }
  for (const [x, y] of spots(3, [6, 14, 14, 10])) m.fixture('fixture/nature/mushroom_ring', x, y)
  for (const [x, y] of spots(2, [22, 6, 14, 12])) m.fixture('fixture/nature/beehive', x, y)
  return m
}


// =================================================================== people

function slots(p: PersonDef, key: string, list: Slot[], at: (name: string) => Pos): ScheduleEntry[] {
  // a variant covers the whole day
  const covered = new Array(24).fill(false)
  for (const [from, to] of list) {
    // a slot that comes round to where it began ([0, 24]) is the whole day
    if (from % 24 === to % 24) covered.fill(true)
    else for (let h = from % 24; h !== to % 24; h = (h + 1) % 24) covered[h] = true
  }
  const gap = covered.indexOf(false)
  if (gap >= 0) throw new Error(`${p.id} schedule ${key} leaves hour ${gap} uncovered`)
  return list.map(([from, to, anchor, activity, needs]) => ({ from, to, ...at(anchor), activity, ...(needs?.uses && { uses: needs.uses, need: needs.need }), ...(needs?.work && { work: needs.work }) }))
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
    ...(p.tags && { tags: p.tags }),
    // what they carry (addTree puts it in their bag)
    ...(p.items && { _items: p.items.map((spec, i) => ({ id: `${p.id}.item${i}`, ...itemOf(spec), place: { on: 'inside' as const, holder: p.id } })) }),
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

/** Firstlight's own beats: Pip points out the healing spring the first time one comes near it. */
const FIRSTLIGHT_BEATS: StepDef[] = [
  {
    id: 'see_spring',
    when: { map: FIRSTLIGHT.map, region: 'spring' },
    say: L('Look, steam! That is a healing spring — sit in it and your wounds close. Come back here whenever you are hurt.', '看，冒着热气！那是疗伤温泉——泡进去伤口就会慢慢愈合。受伤了就回来泡一泡吧。'),
  },
]

const scenes: StepDef[] = [
  {
    // Across before the village has called you on the road: the far bank is reached, the road waits.
    id: 'far_bank_early',
    when: { map: 'ford', region: 'far_bank', props: { quest: { lt: 0.7 } } },
    facts: { 'ford.crossed': 1 },
    say: L('We made it across! ...But the village still needs us, and nobody has told us what is down that road yet. Let\'s not go far.', '我们过来了！……不过村里还需要我们，也还没人告诉我们那条路上有什么。先别走太远。'),
  },
  {
    // The afternoon after the storm: you come down the cliff stair from the mountain (docs/prologue.md).
    id: 'arrival',
    when: { map: 'ford' },
    script: [
      { place: 'npc.hesper', map: 'ford', x: 16, y: 5 },
      { face: 'npc.hesper', dir: 'up' },
      { face: 'player', dir: 'down' },
      { wait: 10 },
      say('npc.hesper', 'Someone off the mountain? Nobody has come down that stair since the storm — and the evenings come sooner every week.', '有人从山上下来了？风暴以后就没人走过那道石阶——而且天黑得一周比一周早。'),
      say('npc.hesper', 'The storm took the ferry rope. The footbridge it did not take: a rider did. All in white, a crown of thorns grown through his helm. He pulled the planks out with his hands and laid the nails on my pier like a toll paid.', '风暴扯断了渡绳。可那座小桥不是风暴冲走的：是一个骑手拆的。浑身雪白，荆棘冠长进了他的头盔。他用手把木板拔出来，把钉子摆在我的码头上，像是付了过路费。'),
      say('npc.hesper', 'Three planks would span the bridge. There is an old axe by the stump; the woods have trees.', '三块木板就能把桥接上。树桩边有把旧斧头，林子里有的是树。'),
      say('npc.hesper', 'West of here is Firstlight Village. Tobin keeps his cart there now — a meal might buy you something useful.', '西边是初原村。托宾现在把货车停在那里——拿顿饭说不定能换点有用的东西。'),
      say('npc.hesper', 'A small place. Good soil, a well, and a roof when the weather turns.', '村子不大。有能种东西的地，有井，变天了也有屋檐能躲。'),
      // before the bridge, the village (docs/quests.md): its rescue opens the bridge chapter (quest 1)
      say('npc.hesper', 'But they have it worse than us — two of theirs are lost, they say. Rowan, their elder, is asking anyone who can fight. The bridge will keep; go to them first.', '不过风暴对他们的打击比我们还重——听说有两个人失踪了。他们的长老罗万在找能打的人。桥可以等，先去帮他们吧。'),
      { give: 'item/food/bread' },
      say('player', '(Still in your pack: the end of a travel loaf.)', '（行囊里还剩半块路上吃的面包。）'),
      { fact: 'village.sent', value: 1 },
    ],
  },
  {
    // The ferry: she takes you over on the mended line (or wades you over when every way is gone).
    id: 'ferry',
    when: { map: 'ford' },
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
    // The goal is a state: however you got here, the far bank ends the first chapter.
    id: 'far_bank',
    // once the pilgrimage is called (stage 0.7: the letter); across before that, `far_bank_early`
    when: { map: 'ford', region: 'far_bank', props: { quest: { gte: 0.7 } } },
    script: [
      { fact: 'ford.crossed', value: 1 },
      { prop: 'quest', value: 2 },
      { wait: 10 },
      say('npc.hesper', 'Go on, then. The rider went east along the road, past the burned farm. If you find him — mind his bow.', '那就走吧。那个骑手沿着大路往东去了，过了烧毁的农庄。要是你找到他——当心他的弓。'),
      say('npc.hesper', 'If you need supplies before the road, Firstlight Village is still just west of here.', '上路前若还缺东西，初原村就在渡口西边。'),
      { topic: 'crossed', days: 30 },
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
  // the meadow west of the Ford, through the road's gap in the woods
  reseed(4243)
  const meadow = buildMeadow()
  linkEdge(m, WEST_GAP.map((y) => [0, y]), [1, 0], meadow, WEST_GAP.map((y) => [meadow.w - 1, y]), [-1, 0])
  // Firstlight's own country (docs/chapter-1.md §13): Millbrook west of it, Dawn Hill north; their cellar and chapel
  reseed(4270)
  const mill = buildMillbrook()
  const millcellar = buildMillCellar()
  mill.linkInterior('mill', millcellar)
  reseed(4271)
  const dawnhill = buildDawnHill()
  const chapel = buildChapel()
  dawnhill.linkInterior('chapel', chapel)
  // the village's woods opened where the new ways go, a path to each
  for (const y of VIGIL.villageWest) for (let x = 0; x < 4; x++) meadow.set(x, y, 'path')
  for (const x of VIGIL.villageNorth) for (let y = 0; y < 3; y++) meadow.set(x, y, 'path')
  meadow.path([[3, 18], [7, 18], [11, 17]], 'path', 1)
  meadow.path([[25, 2], [24, 5], [21, 9]], 'path', 1)
  linkEdge(meadow, VIGIL.villageWest.map((y) => [0, y]), [1, 0], mill, VIGIL.millEast.map((y) => [mill.w - 1, y]), [-1, 0])
  linkEdge(meadow, VIGIL.villageNorth.map((x) => [x, 0]), [0, 1], dawnhill, VIGIL.hillSouth.map((x) => [x, dawnhill.h - 1]), [0, -1])
  // the forest south of the meadow
  // the grassland south of the village (its cows and hens), and the forest south of that
  reseed(4253)
  const pasture = buildPasture()
  linkEdge(meadow, SOUTH_GAP.map((x) => [x, meadow.h - 1]), [0, -1], pasture, PASTURE_GAP.map((x) => [x, 0]), [0, 1])
  reseed(4244)
  const forest = buildForest()
  linkEdge(pasture, PASTURE_GAP.map((x) => [x, pasture.h - 1]), [0, -1], forest, SOUTH_GAP.map((x) => [x, 0]), [0, 1])
  // south of the forest, before the bridge chapter (docs/quests.md): Thornwood Hollow and the Old Barrow under it
  reseed(4254)
  const hollow = buildHollow()
  reseed(4255)
  const barrow = buildBarrow()
  const ossuary = buildOssuary()
  const sanctum = buildSanctum()
  linkEdge(forest, HOLLOW.forestSouth.map((x) => [x, forest.h - 1]), [0, -1], hollow, HOLLOW.north.map((x) => [x, 0]), [0, 1])
  linkEdge(hollow, HOLLOW.south.map((x) => [x, hollow.h - 1]), [0, -1], barrow, BARROW.north.map((x) => [x, 0]), [0, 1])
  // the main quest east of the Ford (docs/main-quest.md): the road, Emberfall, its mine, the pass, the lair
  reseed(4245)
  const road = buildEastRoad()
  reseed(4246)
  const ember = buildEmberfall()
  reseed(4247)
  const mine = buildMine()
  reseed(4248)
  const pass = buildPass()
  reseed(4249)
  const lair = buildLair()
  const col = (b: MapBuilder, x: number, ys: readonly number[]): [number, number][] => ys.map((y) => [x, y])
  const row = (b: MapBuilder, y: number, xs: readonly number[]): [number, number][] => xs.map((x) => [x, y])
  linkEdge(m, col(m, m.w - 1, EAST_ROAD.fordEast), [-1, 0], road, col(road, 0, EAST_ROAD.west), [1, 0])
  linkEdge(road, col(road, road.w - 1, EAST_ROAD.east), [-1, 0], ember, col(ember, 0, EMBERFALL.west), [1, 0])
  linkEdge(ember, row(ember, 0, EMBERFALL.north), [0, 1], mine, row(mine, mine.h - 1, MINE.south), [0, -1])
  linkEdge(ember, col(ember, ember.w - 1, EMBERFALL.east), [-1, 0], pass, col(pass, 0, PASS.west), [1, 0])
  linkEdge(pass, row(pass, 0, PASS.north), [0, 1], lair, row(lair, lair.h - 1, LAIR.south), [0, -1])
  // the prologue north of the Ford (docs/prologue.md): Cloudtop, the foot of the mountain, the cliff stair
  reseed(4250)
  const summit = buildSummit()
  reseed(4252)
  const foot = buildFoot()
  foot.anchors.arrive = [TUTORIAL.arrive[0], TUTORIAL.arrive[1]]
  // the tutorial: a plot of its own, linked to nothing
  const tutorial = buildTutorial()
  linkEdge(summit, row(summit, summit.h - 1, PROLOGUE.summitSouth), [0, -1], foot, row(foot, 0, PROLOGUE.footNorth), [0, 1])
  linkEdge(foot, row(foot, foot.h - 1, PROLOGUE.footSouth), [0, -1], m, row(m, 0, PROLOGUE.fordNorth), [0, 1])
  // towns and camps are peaceful: nothing comes out of the dark there (nightspawn.ts); everywhere else is a combat zone
  for (const b of [m, meadow, ember, summit]) b.zone = 'peaceful'
  // Chapter 1 (docs/chapter-1.md): the shrine, the drawings, the statues, the knight's kingdom; the scenes' own people wait offstage
  chapter1Ford(m)
  chapter1Village(meadow)
  chapter1Foot(foot)
  chapter1Summit(summit)
  chapter1Pasture(pasture)
  chapter1Forest(forest)
  chapter1Hollow(hollow)
  chapter1Barrow(barrow)
  chapter1EastRoad(road)
  const offstage = buildOffstage()
  // the Held Ground the Oath-Thorn opens (docs/chapter-1.md §12): linked to nothing
  const haven = buildHaven()
  const builders = [m, meadow, pasture, forest, hollow, barrow, ossuary, sanctum, mill, millcellar, dawnhill, chapel, road, ember, mine, pass, lair, summit, foot, tutorial, offstage, haven]
  const at = placeMaps(builders, m)
  for (const b of builders)
    for (const [name, [x, y]] of Object.entries(b.anchors)) {
      const t = b.get(x, y)
      if (SOLID.has(t) || !b.walkable(x, y)) throw new Error(`anchor ${b.id}:${name} at ${x},${y} is not walkable (${t})`)
    }
  // an anchor is the Ford's, or another map's as '<map>:<anchor>'
  const anchorAt = (name: string): Pos => {
    const [mapId, key] = name.includes(':') ? name.split(':') : [m.id, name]
    const b = builders.find((x) => x.id === mapId)
    const a = b?.anchors[key]
    if (!b || !a) throw new Error(`unknown anchor ${name}`)
    return { map: b.id, x: a[0], y: a[1] }
  }
  const npcs = PEOPLE.map((p) => person(p, anchorAt))
  // the overworld (world-model.md §5.1): each map on its cell, the rest of the continent wild
  const cells = placeCells(builders, m)
  for (const b of builders) {
    const c = cells.get(b.id)
    if (c) b.site = siteOf(c)
  }
  const chunks = builders.map((b) => b.chunk())
  reseed(4260)
  const overworld = buildOverworld(chunks, cells)
  let items = 0
  let fixtures = 0
  let creatures = 0
  const kinds = new Set<string>()
  for (const e of chunks.flatMap((c) => c.entities)) {
    if (e.type.startsWith('item/')) (items++, kinds.add(`${e.type}|${(e.tags ?? []).join(',')}`))
    else if (e.type.startsWith('fixture/')) fixtures++
    else if (e.type.startsWith('actor/creature')) creatures++
  }
  const metaOf = (b: MapBuilder, c: RawChunk): MapMeta => ({ id: b.id, name: b.name, kind: b.kind, region: b.region, width: b.w, height: b.h, portals: b.portals, npcs: npcs.filter((n) => n.place.on === 'tile' && n.place.map === b.id).length, items: c.entities.filter((e) => e.type.startsWith('item/')).length, at: at.get(b.id) })
  const index: WorldIndex = {
    name: L('The Ford', '渡口'),
    version: VERSION,
    seed: 4242,
    // a new game begins on Cloudtop, the summit plateau, in its ruined shelter; the tutorial is a
    // mode of its own (docs/prologue.md)
    start: { map: summit.id, x: PAT.spawn[0], y: PAT.spawn[1] },
    begin: { props: { prologue: PROLOGUE_AT_FOOT } },
    // one comes round in the clearing early in the morning: a long day to get ready for the night
    starts: { tutorial: { at: { map: tutorial.id, x: TUTORIAL.spawn[0], y: TUTORIAL.spawn[1] }, hour: 7, statuses: { out_cold: 50 } } },
    startHour: START_HOUR,
    maps: [...builders.map((b, i) => metaOf(b, chunks[i])), { id: overworld.map.id, name: overworld.map.name, kind: overworld.map.kind, region: overworld.map.region, width: overworld.map.width, height: overworld.map.height, portals: [], npcs: 0, items: 0 }],
    npcs,
    bosses: BOSSES,
    codex: codexEntries(),
    player: {
      id: 'player',
      type: 'actor/person/player',
      name: L('You', '你'),
      place: { on: 'none' },
      facing: 'down',
      look: CATALOG.roles.player?.[0] ?? 'NinjaMasked',
      // a little hungry: the first thing the mountain teaches is to eat
      props: { hp: 40, maxHp: 40, atk: 2, def: 0, speed: 2, quest: 0, prologue: 0, hunger: 12 },
    },
    companions: [{ id: 'pip', type: 'actor/companion/fairy', name: L('Pip', '小啾'), place: { on: 'none' }, facing: 'down' }],
    quests: [...VILLAGE_QUESTS, ...CH1_QUESTS, ...HAVEN_QUESTS],
    // what Pip tells when taken hold of (F): the prologue's step on the mountain, then the main quest's
    guides: [
      { prop: 'prologue', until: PROLOGUE_DONE, start: PROLOGUE_DONE, stages: PROLOGUE_OBJECTIVES },
      { prop: 'quest', stages: OBJECTIVES },
    ],
    waypoints: chunks.flatMap((c) => c.entities.filter((e) => e.type === 'fixture/sacred/waypoint').map((e) => ({ id: e.id, map: c.map.id, x: (e.place as { x: number }).x, y: (e.place as { y: number }).y, name: e.name ?? L('Waypoint', '传送雕像') }))),
    stats: { maps: builders.length, npcs: npcs.length, creatures, items, itemKinds: kinds.size, fixtures },
    // the story's one script (world-model.md §6.12): the tutorial's beats, then the scenes
    steps: [...PROLOGUE_BEATS, ...FIRSTLIGHT_BEATS, ...scenes, ...CHAPTER1_STORY, ...CHAPTER1_SCENES, ...HAVEN_STORY, ...QUEST_SCENES],
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
  return { index, chunks: [...chunks, overworld] }
}

/**
 * Where each map lies in the world (its top left, in tiles), from the edge links: a portal on a
 * map's east edge puts the map it leads to just east of it, lined up on the crossing. The world
 * map lays the maps out by this; maps reached only through doors are left out.
 */
function placeMaps(builders: MapBuilder[], origin: MapBuilder): Map<string, { x: number; y: number }> {
  const by = new Map(builders.map((b) => [b.id, b]))
  const out = new Map([[origin.id, { x: 0, y: 0 }]])
  const queue = [origin]
  while (queue.length) {
    const a = queue.shift()!
    const pa = out.get(a.id)!
    for (const p of a.portals) {
      const b = by.get(p.to)
      if (!b || out.has(b.id)) continue
      let pos: { x: number; y: number } | undefined
      if (p.x === a.w - 1) pos = { x: pa.x + a.w, y: pa.y + p.y - p.ty }
      else if (p.x === 0) pos = { x: pa.x - b.w, y: pa.y + p.y - p.ty }
      else if (p.y === a.h - 1) pos = { x: pa.x + p.x - p.tx, y: pa.y + a.h }
      else if (p.y === 0) pos = { x: pa.x + p.x - p.tx, y: pa.y - b.h }
      if (!pos) continue
      out.set(b.id, pos)
      queue.push(b)
    }
  }
  return out
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
