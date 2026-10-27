// The Ford (docs/game-design.md): the whole demo on one map. A crossing at the edge of the map
// where the road ends at a river; the ferrykeeper's camp, a stranded peddler's cart, a dead tree
// at the narrows, a dry meadow, a marsh, and the hollow the slimes come out of after dark. The far
// bank is the goal. `buildFord()` is pure (the completeness test builds the world in memory);
// run as a script it writes the default web world.
//
//   npx tsx games/openworld/tools/src/demo/world.ts

import { bloom, ruin, wildFloor } from './wildfloor.ts'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { storyTopics, tickAt, type AiData, type Entity, type MapMeta, type Pos, type StepDef, type ScheduleEntry, type ScheduleVariant, type Text, type WorldIndex } from '@openworld/engine'
import { REGIONS, QUESTS, STORY_RULES, SOCIAL_COIN, codexEntries, FIRSTLIGHT, GUIDE_BEATS, INVARIANTS, PROLOGUE_BEATS, PROTECTED_FACTS, PLAYER_LOOK, favouriteFor, generateLook, type RawChunk } from '@openworld-game/content'
import { MapBuilder, itemOf, linkEdge, reseed, rng } from './builder.ts'
import { GROUND_YIELD, appears, clump, lay } from './kit.ts'
import { plantGarden } from './garden.ts'
import { EAST_ROAD, EMBERFALL, LAIR, MINE, PASS, buildEastRoad, buildEmberfall, buildLair, buildMine, buildPass } from './quest/maps.ts'
import { QUEST_SCENES } from './quest/scenes.ts'
import { PAT, PROLOGUE, TUTORIAL, buildFoot, buildFootHut, buildSummit, buildTutorial } from './prologue.ts'
import { BARROW, HOLLOW, buildBarrow, buildHollow, buildOssuary, buildSanctum } from './hollow.ts'
import type { PersonDef, Slot } from './person.ts'
import { buildOverworld, placeCells, readContinent, siteOf } from './overworld.ts'
import { backdropMeta, buildBackdrop } from './continent/backdrop.ts'
import { peopleBackdrop } from './continent/people.ts'
import { ownShells } from './shells.ts'
import { CATALOG } from '../../../client/src/catalog.ts'
import { HOUSEHOLDS, PEOPLE, householdOf } from './people.ts'
import { buildHaven, buildHavenGrounds } from './quest/haven.ts'
import { firstlightGround, villageInteriors, villageLife, villageTown } from './village.ts'
import { eastRoadRooms, emberfallRooms, tentRooms } from './interiors.ts'
import { HILL_MINE, VIGIL, buildChapel, buildDawnHill, buildHillMine, buildMillCellar, buildMillHouse, buildMillbrook } from './quest/vigil.ts'
import { buildKingdom } from './quest/kingdom.ts'
import { PILGRIM, PILGRIMAGE_STORY, buildAbbey, buildAbbeyCrypt, buildAbbeyHall, buildAbbeyTomb, buildField, buildHostel, buildRest, buildRestChapel, buildWay } from './quest/pilgrimage.ts'
import { FLANKS, FLANKS_STORY, buildBend, buildBendCabin, buildDell, buildDellHut } from './quest/flanks.ts'
import { CHAPTER1_SCENES, CHAPTER1_STORY, HAVEN_STORY, buildOffstage, chapter1Barrow, chapter1EastRoad, chapter1Kingdom, chapter1Foot, chapter1Ford, chapter1Forest, chapter1Hollow, chapter1Pasture, chapter1Summit, chapter1Village } from './quest/chapter1.ts'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../../public/world')
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
  const m = new MapBuilder('ford', L('The Ford', '渡口'), 'wild', 48, 30, 'grass', 'ford', 'outdoor', 'frostfang')
  const grass = (t: string) => t === 'grass'
  // ------------------------------------------------------------ the river: a pool at the landing, narrows at the dead tree
  for (let y = 0; y < m.h; y++) for (let x = NEAR[y]; x <= FAR[y]; x++) m.set(x, y, 'water')
  // the frost slime keeps its corner of the bank in rime and the river's edge frozen (the ice route, shown before it is taught)
  // (the rime runs down to the water and the ice lies along the bank under it, one frozen margin, never a white blob
  // on the grass: docs/release-1.md)
  m.organic(25.6, 4, 1.4, 2.4, 'snow', { only: (t) => t === 'grass' })
  for (let y = 2; y <= 6; y++) m.set(NEAR[y], y, 'ice')
  for (const [x, y] of [[28, 3], [28, 4], [28, 5]] as const) m.set(x, y, 'ice')
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
  // the far bank: trees frame the road east to the Pilgrims' Rest; they close its north, south and east edges but for
  // the road's own way, so the far bank leads on only by the road, never off its edge onto the world map east of the
  // river (docs/release-1.md §1)
  clump(m, 44, 4, 3.2, 0.8)
  clump(m, 44.5, 24.5, 3.5, 0.8)
  clump(m, 41.5, 9.5, 1.3, 0.5)
  // (from the water's edge, row by row: the bank begins before FAR_BANK where the river narrows)
  for (let y = 0; y < m.h; y++)
    for (let x = FAR[y] + 1; x < m.w; x++) {
      const edge = y < 2 || y > m.h - 3 || (x > m.w - 3 && !(EAST_ROAD.fordEast as readonly number[]).includes(y))
      if (edge && grass(m.get(x, y))) m.set(x, y, rng.chance(0.3) ? 'pine' : 'tree')
    }
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
  // where the road east leaves the far bank, a signpost
  m.fixture('fixture/sign', 40, 14, { props: { text: "EAST — the Pilgrims' Rest, and the Pilgrim's Road beyond it.", text_zh: '往东——朝圣者驿站，再往前是朝圣者之路。' } })
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
  // the old way down the mountain ends here as it began (prologue.ts): two columns at the foot of the cliff stair, a
  // watchtower's stump on the far bank over the river, a run of wall by the road east
  ruin(m, 'ruin_column_1', 16, 3)
  ruin(m, 'ruin_column_2', 19, 3)
  ruin(m, 'ruin_tower', 38, 3)
  ruin(m, 'ruin_wall_x3', 41, 18)
  for (const [name, x, y] of [['decor_column_fallen', 20, 10], ['decor_stones', 26, 8], ['decor_stones', 43, 17]] as [string, number, number][]) m.building(name, x, y)
  // what lies about (wildfloor.ts): never at the camp, the landing or the hollow's mouth
  const camp = (x: number, y: number) => (x >= 4 && x <= 20 && y >= 11 && y <= 23) || (x >= 21 && x <= 29 && y >= 10 && y <= 23) || (x <= 9 && y <= 8)
  wildFloor(m, 0.8, camp)
  bloom(m, 0.8, camp)
  return m
}



// =================================================================== Firstlight Village, west of the Ford (stable id: meadow)

/** The road's gap in the Ford's western woods, and the meadow's eastern one it leads to. */
export const WEST_GAP = [18, 19, 20]
/** The gap in the meadow's southern woods (columns), and the forest's northern one below it. */
export const SOUTH_GAP = [22, 23, 24]
/** Where the grassland's animals start: the cows on the upper pasture, the hens in their run by the road. */
export const MEADOW = {
  cows: [[11, 4], [16, 6], [6, 10]],
  hens: [[28, 9], [30, 9], [27, 11], [30, 11]],
} as const satisfies Record<string, readonly (readonly [number, number])[]>
/** A passive animal: it wanders near where it lives, and runs from whoever strikes it. */
const GRAZER: Omit<AiData, 'home'> = { behaviour: 'passive', temper: 'wary', sight: 4, leash: 6 }

/** A starting village in a ring of woods, with homes, a shared square, pasture and a garden. */
function buildMeadow(): MapBuilder {
  // (60 x 40 since 2026-10-11; redrawn to the showcase's standard on 2026-10-26, docs/release-1.md §3: the ground laid in
  // code — the woods round it, the square before the chapel, the east road from the Ford and the lanes north, west and
  // south, the pond — the village's own buildings on it. What stands on it is placed here and in village.ts.)
  const m = new MapBuilder(FIRSTLIGHT.map, FIRSTLIGHT.name, 'village', 60, 40, 'grass', 'village', 'outdoor', 'frostfang')
  firstlightGround(m)
  // the houses with their doors (every one has a room behind it: village.ts), their yards and what the village uses
  villageTown(m)
  m.fixture('fixture/water/well', ...FIRSTLIGHT.well, { id: 'village.well' })
  m.fixture('fixture/light/campfire', ...FIRSTLIGHT.fire, { id: 'village.campfire', statuses: { lit: -1 } })
  m.fixture('fixture/furniture/bench/log', 20, 19, { id: 'village.bench' })
  // the woodworker's bench in the woodcutter's yard, by the wood pile: what is made at a workbench is made here (world-model.md §6.4)
  m.fixture('fixture/craft/workbench', 12, 14, { id: 'village.workbench' })
  // the boards at the square's north-west corner, under the chapel: the village's notices, and the favours people want done (docs/quests.md §3)
  m.fixture('fixture/sign/noticeboard', 19, 13, { id: 'village.notice', props: { text: 'FIRSTLIGHT VILLAGE. East: the Ford. West: Millbrook. North: Dawn Hill. South: the grassland, and the forest beyond.', text_zh: '初原村。东：渡口。西：水车磨坊。北：晨光丘。南：草原，再往南是森林。' } })
  m.fixture('fixture/sign/questboard', 20, 13, { id: 'village.board' })
  for (const [x, y] of [[25, 13], [12, 16]] as const) m.fixture('fixture/light/lamppost', x, y, { id: `village.lamp.${x}`, statuses: { lit: -1 } })
  // Tobin and his stock move together, at the square's market corner where the road comes in. Stable IDs keep saved trades and inventories intact.
  m.fixture('fixture/furniture/cart', ...FIRSTLIGHT.cart, { id: 'ford.cart', props: { owner: 'npc.tobin' } })
  m.item({ form: 'item/weapon/magic/wand', material: 'wood', element: 'ice', name: L('Frost Wand', '寒霜魔杖'), props: { owner: 'npc.tobin' } }, ...FIRSTLIGHT.cart).id = 'tobin.wand'
  m.item({ form: 'item/vessel/flask/oil', props: { owner: 'npc.tobin' } }, ...FIRSTLIGHT.cart).id = 'tobin.oil'
  m.anchor('cart', 30, 16)
  m.anchor('cart.bed', 31, 16)
  // where travellers sleep: the market shelter by the north lane (the households sleep in their own beds: village.ts)
  m.anchor('market.shelter', 29, 9)
  m.anchor('square.well', 20, 14)
  m.anchor('square.warm', 23, 17)
  // the drill yard by the watch house: Bram, the profession trainer (docs/skill-tree.md)
  m.anchor('drill.yard', 41, 7)
  m.anchor('drill.bed', 40, 6)
  m.anchor('elder.porch', 18, 10)
  m.anchor('cook.fire', 21, 18)
  m.anchor('pond.edge', 19, 21)
  m.anchor('guard.post', 25, 25)
  m.anchor('wood.pile', 13, 16)
  // the wood pile Gus stacks his logs on (world-model.md §6.10: work is real)
  m.fixture('fixture/container/woodpile', 13, 15, { id: 'village.woodpile', statuses: { open: -1 } })
  m.anchor('lina.garden', 13, 18)
  m.anchor('oskar.bench', 17, 19)
  // the village keeps the law (docs/npc-sandbox.md §2.7): its watch, and the cells beside the watch house
  m.law = 'firstlight'
  m.anchor('cells', 38, 10)
  // Cass's loom west of the square: anyone may weave cloth at it from grass fibre (life.ts weave/cloth)
  m.fixture('fixture/craft/loom', 16, 13, { id: 'village.loom', props: { owner: 'npc.cass' } })
  m.anchor('cass.loom', 16, 14)
  // where Vigo sleeps rough, at the square's east edge by the road
  m.anchor('vigo.camp', 34, 15)
  // Odette's standing mirror at the square's south-east, east of the evening fire, and where she works beside it by day, a step east of the grey man's spot before it (content dresser.ts)
  m.fixture('fixture/furniture/mirror', 26, 16, { id: 'village.mirror', props: { owner: 'npc.odette' } })
  m.anchor('dresser.stand', 27, 17)
  // the warm spring in its clearing west of the pond: sit in it and it mends you
  const [sx, sy] = FIRSTLIGHT.spring
  m.scenery('spring', sx - 1, sy - 1)
  // the ground round it, where Lumi points it out
  m.regions.spring = [sx - 4, sy - 3, 9, 7]
  // the pond's banks and the garden's ground: where the fairy's guides begin (content quests/guides.ts)
  m.regions.pond = [...FIRSTLIGHT.regions.pond]
  m.regions.garden = [...FIRSTLIGHT.regions.garden]
  m.fixture('fixture/sign', sx + 2, sy - 2, { props: { text: 'Warm spring — sit a while, and it mends you.', text_zh: '温泉——泡一会儿，伤就好了。' } })
  // what the village keeps in its yards, fields and orchard, and the small things on the ground: village.ts
  villageLife(m)
  // the village keeps no herd: the cows and hens graze the grassland south of it (buildPasture)
  // sticks under the woods, stones and grass in the open, as on the Ford
  lay(m, 'item/material/stick', 3, [3, 21, 6, 8])
  lay(m, 'item/material/stone', 3, [30, 20, 8, 5])
  lay(m, 'item/material/grass', 3, [25, 26, 7, 4])
  // fireweed in the open grass of the hay meadow, for the herbalist of Emberfall (main quest)
  lay(m, 'item/material/fireweed', 3, [50, 3, 7, 8])
  m.appear = [...GROUND_YIELD, appears('item/material/fireweed', ['grass'], 3, 900)]
  plantGarden(m)
  return m
}

// =================================================================== the grassland, south of the village

/** The village's southern gap (columns) and the grassland's way on south to the forest: the same columns, top and bottom. */
export const PASTURE_GAP = SOUTH_GAP

/**
 * The herders' grassland (drawn by hand for release 1, docs/release-1.md: maps/pasture.txt): open rolling meadow in a
 * belt of woods, the road from the village to the forest straight through it. West of the road the upper pasture and the
 * knoll with the lone old tree, the stone fold the herd is brought into, and Brin's post at its gate; a hedgerow parts it
 * from the watering pond and its muddy drinking bank. East of the road the hens' run, and below a dry-stone wall the hay
 * meadow and its stacks. The cows and hens, and more of them in time.
 */
function buildPasture(): MapBuilder {
  const m = new MapBuilder('pasture', L('The Grassland', '草原'), 'wild', 40, 30, 'grass', 'field', 'outdoor', 'frostfang')
  m.paint('pasture')
  // the fold: a dry-stone pen the herd is brought into, a gate east to Brin's post and one south to the pond; its hay
  // and its trough inside
  m.yard(11, 8, 7, 6, 'stonewall', [[17, 10], [13, 13]])
  for (const [x, y] of [[12, 10], [13, 10]] as const) m.fixture('fixture/nature/haystack', x, y)
  m.fixture('fixture/water/trough', 15, 12)
  // Brin's post at the fold's gate, where the cows' track meets the road: her bench (quest/chapter1.ts), a lantern on
  // its post for the evenings, a barrel of feed
  m.fixture('fixture/light/lantern', 21, 9)
  m.fixture('fixture/container/barrel', 18, 11)
  // the hens' run by the road, behind its rail: the hay they lay in
  m.yard(26, 8, 7, 5, 'rail', [[26, 10]])
  m.fixture('fixture/nature/haystack', 31, 9)
  // the dry-stone wall between the upper pasture and the hay meadow, a gate in it; the hay in stacks
  m.fence('stonewall', [26, 16], [36, 16], [[31, 16]])
  for (const [x, y] of [[29, 20], [33, 22], [30, 23]] as const) m.fixture('fixture/nature/haystack', x, y)
  // grey stones at the knoll's foot under the old tree, and one on the swell east of the road
  for (const [x, y] of [[11, 5], [5, 8], [34, 6]] as const) m.fixture('fixture/nature/boulder', x, y)
  // small things where they belong: reeds at the pond, flowers under the walls and in the swale, pebbles by the
  // stone, leaves and ferns under the woods' edge, tufts in the open grass
  const grass = (t: string) => t === 'grass'
  const tree = (t: string) => t === 'tree' || t === 'pine' || t === 'bush'
  const water = (t: string) => t === 'water'
  const wall = (t: string) => t === 'wall' || t === 'woodwall'
  m.sprinkle('fixture/nature/reeds', 0.7, (x, y, t) => (grass(t) || t === 'flowers') && m.near(x, y, water))
  m.sprinkle('fixture/nature/flowers', 0.25, (x, y, t) => grass(t) && m.near(x, y, wall) && !m.near(x, y, tree))
  m.sprinkle('fixture/nature/pebbles', 0.15, (x, y, t) => t === 'drygrass' && m.near(x, y, (c) => c === 'wall'))
  m.sprinkle('fixture/nature/leaves', 0.2, (x, y, t) => grass(t) && m.near(x, y, tree))
  m.sprinkle('fixture/nature/ferns', 0.08, (x, y, t) => grass(t) && m.near(x, y, tree) && (x < 6 || x > 33 || y > 23))
  m.sprinkle('fixture/nature/tuft', 0.06, (x, y, t) => grass(t) && !m.near(x, y, tree, 1) && !m.near(x, y, (c) => c === 'path', 1))
  // the herd and the hens; hens lay through the day
  const start = tickAt(1, START_HOUR)
  for (const [x, y] of MEADOW.cows) m.creature('animal/cow', x, y, { ...GRAZER })
  MEADOW.hens.forEach(([x, y], i) => (m.creature('animal/chicken', x, y, { ...GRAZER }).statuses = { stage: start + 600 + i * 300 }))
  // sticks, stones and grass lie about from the start, as everywhere outdoors
  lay(m, 'item/material/stick', 3, [3, 9, 6, 6])
  lay(m, 'item/material/stone', 3, [4, 3, 10, 6])
  lay(m, 'item/material/grass', 3, [14, 3, 8, 5])
  // Minecraft's passive mobs are slow to come back: a cow every two minutes, a hen every ninety seconds, while there is room
  m.appear = [
    ...GROUND_YIELD,
    appears('actor/creature/animal/cow', ['grass'], 4, 1200, { ai: GRAZER }),
    appears('actor/creature/animal/chicken', ['grass'], 5, 900, { ai: GRAZER }),
  ]
  wildFloor(m, 0.8)
  return m
}

// =================================================================== the forest, south of the meadow

/**
 * The forest (drawn by hand for release 1, docs/release-1.md: maps/forest.txt). The old woods close it thick at the
 * edges, broadleaf and light in the north and east, dark pines thickening to the south-west towards the hollow. The track
 * from the grassland comes into the woodcutters' clearing, where Gus fells and stacks (wood/notch, wood/fell: two swings
 * of an axe; a stump grows back in two days), and runs on to the fork, where a signpost parts the trails: west to the
 * Charcoal Dell, east over the brook's footbridge to the Reed Bend, south to Thornwood Hollow. Off them: the frostcap
 * glade in the pines' shade with its mushroom rings; the spring the brook rises in; and the old footpath, half grown
 * over, to the pilgrims' camp deep in the south-east by the brook (quest/chapter1.ts).
 */
function buildForest(): MapBuilder {
  const m = new MapBuilder('forest', L('The Forest', '森林'), 'wild', 40, 30, 'grass', 'forest', 'outdoor', 'frostfang')
  m.paint('forest')
  m.stumpsAsThings()
  // the woodcutters' clearing: stumps of old fellings round it (the layout's), the chopping block, split logs stacked
  // to dry; Gus works here mornings (people/gus.ts)
  m.anchor('woods.clearing', 23, 7)
  m.fixture('fixture/nature/stump', 26, 6, { name: L('Chopping block', '劈柴墩') })
  m.fixture('fixture/nature/logpile/stack', 25, 7)
  m.fixture('fixture/nature/logpile/stack', 20, 5)
  // the fork, where the trails part: a signpost that says where each goes
  m.fixture('fixture/sign', 19, 13, { props: { text: 'NORTH — the grassland, and Firstlight. WEST — the Charcoal Dell. EAST — over the brook to the Reed Bend. SOUTH — Thornwood Hollow; keep to the path.', text_zh: '北——草原，再往前是初原村。西——烧炭谷。东——过了溪就是芦苇湾。南——荆棘谷，别离开小路。' } })
  // what the forest gives a forager and a beekeeper (content life.ts): mushroom rings in the frostcap glade's shade,
  // wild hives on the sunny side of the trees by the clearing and the spring
  for (const [x, y] of [[5, 20], [9, 19], [7, 21]] as const) m.fixture('fixture/nature/mushroom_ring', x, y)
  for (const [x, y] of [[27, 4], [36, 2]] as const) m.fixture('fixture/nature/beehive', x, y)
  // the forest floor: moss and ferns in the pines' shade, leaves under the broadleaves, reeds and pebbles along the
  // brook, tufts where the sun gets in
  const wood = (t: string) => t === 'tree' || t === 'pine'
  const open = (t: string) => t === 'grass'
  const pines = (x: number, y: number) => m.near(x, y, (t) => t === 'pine', 1)
  const water = (x: number, y: number) => m.near(x, y, (t) => t === 'water', 1)
  m.sprinkle('fixture/nature/reeds', 0.45, (x, y, t) => open(t) && water(x, y))
  m.sprinkle('fixture/nature/pebbles', 0.2, (x, y, t) => open(t) && water(x, y))
  m.sprinkle('fixture/nature/moss', 0.18, (x, y, t) => open(t) && pines(x, y))
  m.sprinkle('fixture/nature/ferns', 0.2, (x, y, t) => open(t) && pines(x, y))
  m.sprinkle('fixture/nature/leaves', 0.3, (x, y, t) => open(t) && m.near(x, y, (c) => c === 'tree', 1) && !pines(x, y))
  m.sprinkle('fixture/nature/ferns', 0.06, (x, y, t) => open(t) && m.near(x, y, wood) && !pines(x, y))
  m.sprinkle('fixture/nature/tuft', 0.08, (x, y, t) => open(t) && !m.near(x, y, wood, 1) && !water(x, y))
  // what falls in a forest: sticks above all, about the clearing; stones by the brook
  lay(m, 'item/material/stick', 4, [18, 4, 10, 6])
  lay(m, 'item/material/stone', 2, [29, 18, 6, 4])
  // frostcap in the glade's shade, for the herbalist of Emberfall (main quest)
  lay(m, 'item/material/frostcap', 3, [4, 19, 8, 5])
  m.appear = [
    appears('item/material/frostcap', ['grass'], 3, 900),
    appears('item/material/stick', ['grass'], 10),
    appears('item/material/stone', ['grass'], 3),
    appears('item/material/grass', ['grass'], 4),
  ]
  wildFloor(m, 1)
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
  // their social life (docs/npc-sandbox.md): their house, whether they fight, the watch they keep, their trade and coin
  const household = householdOf(p.id)
  const purse = p.purse ?? (p.role === 'child' ? 2 : 10)
  const stock = p.trade?.stock ?? []
  // (their age's tag: a child under eighteen is `minor` — never robbed, stolen from or preached unbelief, social.ts)
  const tags = [...(p.tags ?? []), ...(p.age < 18 ? ['minor'] : []), ...(p.watch ? ['watchman'] : []), ...(p.trade ? ['merchant'] : []), ...(p.trade?.fence ? ['fence'] : []), ...(p.hireling ? ['hireling'] : []), ...(p.essential ? ['essential'] : [])]
  const carried = [
    ...(p.items ?? []).map((spec, i) => ({ id: `${p.id}.item${i}`, ...itemOf(spec, `${p.id}.item${i}`) })),
    // (their gear at their level: world-model.md §6.8)
    ...stock.flatMap(([form, n], i) => Array.from({ length: n }, (_, j) => ({ id: `${p.id}.stock${i}.${j}`, ...itemOf({ form, level: p.trade?.level ?? 1 }, `${p.id}.stock${i}.${j}`) }))),
    ...Array.from({ length: purse }, (_, i) => ({ id: `${p.id}.coin${i}`, type: SOCIAL_COIN })),
  ].map((e) => ({ ...e, place: { on: 'inside' as const, holder: p.id } }))
  return {
    id: p.id,
    type: `actor/person/${p.role}`,
    name: p.name,
    place: { on: 'tile', map: first.map, x: first.x, y: first.y },
    facing: 'down',
    props: {
      age: p.age,
      // what they like best: pinned by their record, else drawn from their id (content gifts.ts)
      favourite: p.favourite ?? favouriteFor(p.id, p.age),
      purse,
      ...(household && { household }),
      ...(p.fights && { fights: true }),
      ...(p.watch && { watch: p.watch }),
      ...(stock.length && { stock: stock.map(([form, n]) => `${form}*${n}`).join('|') }),
      ...(p.trade?.level && p.trade.level > 1 && { gearLevel: p.trade.level }),
      ...(p.honesty !== undefined && { honesty: p.honesty }),
      ...(p.lawful === false && { lawful: false }),
      ...p.props,
    },
    ...(tags.length && { tags }),
    // what they carry (addTree puts it in their bag): their things, their goods, their coin
    ...(carried.length && { _items: carried }),
    // how they look: what the author chose, the rest drawn from their id (docs/looks.md)
    look: generateLook(p.id, { sex: p.gender, age: p.age, role: p.role }, p.look),
    npc: {
      role: p.role,
      schedule,
      lines: p.lines.filter((l) => l.key === 'default').map((l) => l.text),
      faction: 'ford',
      person: { temperament: p.temperament, ties: p.ties, lines: p.lines, schedules },
    },
  }
}

// =================================================================== scenes

const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })

/** Firstlight's own beats: Lumi points out the healing spring the first time one comes near it. */
const FIRSTLIGHT_BEATS: StepDef[] = [
  {
    id: 'see_spring',
    when: { map: FIRSTLIGHT.map, region: 'spring' },
    say: L('Steam! It\'s a warm spring. If you sit in it, your wounds heal. Come back here when you\'re hurt.', '冒热气了！是温泉。泡在里面，伤口会慢慢长好。受了伤就回这里来。'),
  },
]

const scenes: StepDef[] = [
  {
    // Across before the village has called you on the road: the far bank is reached, the road waits.
    id: 'far_bank_early',
    when: { map: 'ford', region: 'far_bank', quest: { first_seal: { lt: 30 } } },
    facts: { 'ford.crossed': 1 },
    say: L('We\'re across! But the village still needs us, and we don\'t know yet what\'s down that road. Let\'s not go too far.', '我们过来了！不过村里还等着我们呢，这条路通到哪儿也还不知道。先别走太远。'),
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
      say('npc.hesper', 'Off the mountain? Nobody has come down that stair since the storm. And the evenings come sooner every week.', '从山上下来的？风暴以后，那道石阶就没人走过。天也一个礼拜比一个礼拜黑得早。'),
      say('npc.hesper', 'The storm took my ferry rope. The bridge was a rider. He was all in white, with a crown of thorns grown through his helm. He pulled the planks up with his hands and laid the nails out on my pier in a row, like a toll.', '风暴扯断了我的渡绳。桥是一个骑手拆的。那人一身白，荆棘冠长进了头盔里。他徒手把木板一块块拔起来，把钉子在我的码头上摆成一排，像是交了过路钱。'),
      say('npc.hesper', 'Three planks would mend it. There\'s an old axe by the stump, and the woods are full of trees.', '补上三块木板，桥就能走。树桩边上有把旧斧头，林子里树有的是。'),
      say('npc.hesper', 'West of here is Firstlight Village. Tobin keeps his cart there now. A meal might buy you something useful from him.', '往西是初原村。托宾现在把货车停在那边。给他一顿饭，兴许能换到点有用的东西。'),
      say('npc.hesper', 'It\'s a small place. Good soil, a well, and a roof when the weather turns.', '村子不大。地好，有口井，变天了也有个躲雨的地方。'),
      // before the bridge, the village (docs/quests.md): its rescue opens the bridge chapter (quest 1)
      say('npc.hesper', 'They\'ve had it worse than me, though. Two of theirs went missing in the storm, I hear. Rowan, their elder, is asking anyone who can hold a blade. The bridge can wait. Go to them first.', '不过他们比我惨。听说村里有两个人在风暴里没了音信。他们的长老罗万在找会使兵器的人。桥不急，你先去那边。'),
      { give: 'item/food/bread' },
      say('player', '(In your pack: the end of a travel loaf.)', '（行囊里还剩一截路上吃的面包。）'),
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
      say('npc.hesper', 'There. Mind the step. Mind the road, too. Nobody has walked it since the storm.', '到了。上岸当心脚下。那条路风暴以后还没人走过，路上也当心。'),
    ],
  },
  {
    // The goal is a state: however you got here, the far bank ends the first chapter.
    id: 'far_bank',
    // once the pilgrimage is called (the First Seal's stage 30: the letter); across before that, `far_bank_early`;
    // and only while it is still chapter one's hook (past the river the road is long taken: `far_bank_late`)
    when: { map: 'ford', region: 'far_bank', quest: { first_seal: { gte: 30, lt: 40 } } },
    script: [
      { fact: 'ford.crossed', value: 1 },
      { wait: 10 },
      // (the road east comes first to the Church's Rest: the Pilgrim's Road, docs/chapter-1.md §14)
      say('npc.hesper', 'Go on, then. East, the road comes first to the Church\'s Rest. The rider went a long way past it, beyond the burned farm. If you find him, mind his bow.', '去吧。往东走，先到教会的驿站。那个骑手去得远多了，在烧掉的农庄再过去。真找着他，当心他的弓。'),
      say('npc.hesper', 'If you need anything before the road, Firstlight Village is just west of here.', '上路前要是还缺什么，初原村就在西边，不远。'),
      { topic: 'crossed', days: 30 },
    ],
  },
  {
    // across for the first time when the story is long past its first chapter: the river is crossed, said nothing of
    id: 'far_bank_late',
    when: { map: 'ford', region: 'far_bank', quest: { first_seal: { gte: 40 } } },
    facts: { 'ford.crossed': 1 },
  },
]

// =================================================================== the world

export interface FordWorld {
  index: WorldIndex
  /** The played maps and the overworld. */
  chunks: RawChunk[]
  /** The backdrop's maps (docs/continent.md): in the index, written with the world, loaded by no test of the played maps. */
  backdrop: RawChunk[]
  /** Where each hand-made map lies on the overworld, from the Ford's cell. */
  cells: Map<string, { x: number; y: number }>
}

/** The backdrop's maps, made once (the continent is data: they come out the same on every build), and their people by map. */
let backdropMaps: RawChunk[] | undefined
let backdropPeople = new Map<string, number>()

/**
 * The world: the Ford and every hand-made map round it, the overworld, the backdrop. `overworld: false` leaves the
 * overworld and the backdrop out (the continent's generator asks only where the hand-made maps lie).
 */
export function buildFord(opts: { overworld?: boolean } = {}): FordWorld {
  // each map from its own seed: the same world on every build, and one map's draws never move another's
  reseed(4242)
  const m = buildMap()
  // the meadow west of the Ford, through the road's gap in the woods
  reseed(4243)
  const meadow = buildMeadow()
  // the rooms behind the village's doors: homes, the store, the smithy, the church
  const rooms = villageInteriors()
  // its houses are as peaceful as the village (nothing comes out of the dark in someone's kitchen), and under its watch
  for (const r of rooms) (meadow.linkInterior(r.door, r.map), (r.map.zone = 'peaceful'), (r.map.law = 'firstlight'))
  linkEdge(m, WEST_GAP.map((y) => [0, y]), [1, 0], meadow, WEST_GAP.map((y) => [meadow.w - 1, y]), [-1, 0])
  // Firstlight's own country (docs/chapter-1.md §13): Millbrook west of it, Dawn Hill north; their cellar and chapel
  reseed(4270)
  const mill = buildMillbrook()
  // the mill behind its door, its cellar down the stair in the mill floor
  const millhouse = buildMillHouse()
  const millcellar = buildMillCellar()
  mill.linkInterior('mill', millhouse)
  millhouse.linkInterior('cellar', millcellar)
  reseed(4271)
  const dawnhill = buildDawnHill()
  const chapel = buildChapel()
  dawnhill.linkInterior('chapel', chapel)
  // (the village's ways west and north: its ground, village.ts firstlightGround)
  linkEdge(meadow, VIGIL.villageWest.map((y) => [0, y]), [1, 0], mill, VIGIL.millEast.map((y) => [mill.w - 1, y]), [-1, 0])
  linkEdge(meadow, VIGIL.villageNorth.map((x) => [x, 0]), [0, 1], dawnhill, VIGIL.hillSouth.map((x) => [x, dawnhill.h - 1]), [0, -1])
  // the mine in Dawn Hill's western flank (quest/vigil.ts): the first chapter's ore
  reseed(4253)
  const hillmine = buildHillMine()
  linkEdge(dawnhill, HILL_MINE.hillWest.map((y) => [0, y]), [1, 0], hillmine, HILL_MINE.east.map((y) => [hillmine.w - 1, y]), [-1, 0])
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
  // the forest's flanks (docs/chapter-1.md §15): the Charcoal Dell west of it, the Reed Bend east, a hut and a cabin
  reseed(4290)
  const dell = buildDell()
  const dellHut = buildDellHut()
  dell.linkInterior('hut', dellHut)
  reseed(4291)
  const bend = buildBend()
  const bendCabin = buildBendCabin()
  bend.linkInterior('cabin', bendCabin)
  linkEdge(forest, FLANKS.forestWest.map((y) => [0, y]), [1, 0], dell, FLANKS.dellEast.map((y) => [dell.w - 1, y]), [-1, 0])
  linkEdge(forest, FLANKS.forestEast.map((y) => [forest.w - 1, y]), [-1, 0], bend, FLANKS.bendWest.map((y) => [0, y]), [1, 0])
  const flanks = [dell, dellHut, bend, bendCabin]
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
  // the Pilgrim's Road between the Ford and the knight (docs/chapter-1.md §14): the Rest, the road, the abbey north of
  // it, the Kneeling Field; then the East Road
  reseed(4280)
  const rest = buildRest()
  const restChapel = buildRestChapel()
  const hostel = buildHostel()
  rest.linkInterior('chapel', restChapel)
  rest.linkInterior('hostel', hostel)
  reseed(4281)
  const way = buildWay()
  reseed(4282)
  const abbey = buildAbbey()
  const abbeyHall = buildAbbeyHall()
  const abbeyCrypt = buildAbbeyCrypt()
  // the priors' tomb behind its fog at the crypt's head (docs/boss-rooms.md)
  const abbeyTomb = buildAbbeyTomb()
  abbey.linkInterior('hall', abbeyHall)
  abbey.linkInterior('crypt', abbeyCrypt)
  reseed(4283)
  const field = buildField()
  // the White Knight's arena behind his fog on the East Road (docs/boss-rooms.md §4.1)
  reseed(4284)
  const kingdom = buildKingdom()
  linkEdge(m, col(m, m.w - 1, EAST_ROAD.fordEast), [-1, 0], rest, col(rest, 0, PILGRIM.rest.west), [1, 0])
  linkEdge(rest, col(rest, rest.w - 1, PILGRIM.rest.east), [-1, 0], way, col(way, 0, PILGRIM.way.west), [1, 0])
  linkEdge(way, row(way, 0, PILGRIM.way.north), [0, 1], abbey, row(abbey, abbey.h - 1, PILGRIM.abbey.south), [0, -1])
  linkEdge(way, col(way, way.w - 1, PILGRIM.way.east), [-1, 0], field, col(field, 0, PILGRIM.field.west), [1, 0])
  linkEdge(field, col(field, field.w - 1, PILGRIM.field.east), [-1, 0], road, col(road, 0, EAST_ROAD.west), [1, 0])
  const pilgrimage = [rest, restChapel, hostel, way, abbey, abbeyHall, abbeyCrypt, abbeyTomb, field, kingdom]
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
  // the hunter's cabin at the foot
  const footHut = buildFootHut()
  foot.linkInterior('hut', footHut)
  // the tutorial: a plot of its own, linked to nothing
  reseed(4254)
  const tutorial = buildTutorial()
  // (what is built after the prologue's maps has its own seed: redrawing them moves nothing else)
  reseed(4256)
  linkEdge(summit, row(summit, summit.h - 1, PROLOGUE.summitSouth), [0, -1], foot, row(foot, 0, PROLOGUE.footNorth), [0, 1])
  linkEdge(foot, row(foot, foot.h - 1, PROLOGUE.footSouth), [0, -1], m, row(m, 0, PROLOGUE.fordNorth), [0, 1])
  // towns and camps are peaceful: nothing comes out of the dark there (nightspawn.ts); everywhere else is a combat zone
  for (const b of [m, meadow, ember, summit, rest]) b.zone = 'peaceful'
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
  chapter1Kingdom(kingdom)
  const offstage = buildOffstage()
  // the Held Ground the Oath-Thorn opens (docs/chapter-1.md §12): linked to nothing
  const haven = buildHaven()
  // its grounds, opened by its steward: places of their own, a way back to the heart from each
  const grounds = buildHavenGrounds()
  // every building walked into (interiors.ts): Emberfall's, the East Road farmhouse; the tents, gone into by hand
  const elsewhere = [...emberfallRooms().map((r) => (ember.linkInterior(r.door, r.map), r.map)), ...eastRoadRooms().map((r) => (road.linkInterior(r.door, r.map), r.map)), ...tentRooms(m, forest, haven)]
  const builders = [m, meadow, ...rooms.map((r) => r.map), pasture, forest, hollow, barrow, ossuary, sanctum, ...flanks, mill, millhouse, millcellar, dawnhill, hillmine, chapel, ...pilgrimage, road, ember, mine, pass, lair, summit, foot, footHut, tutorial, offstage, haven, ...grounds, ...elsewhere]
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
  // a household's home is theirs (docs/npc-sandbox.md §2.1): found where its first sleeps — the room behind its door,
  // or a doorstep outdoors — unless others sleep there too (a room or a door that is a shelter as well is nobody's)
  // (where one sleeps in any of one's days: Edda's cabin is hers from the day she comes)
  const bedOf = (p: PersonDef) => Object.values(p.schedules).flat().find((s) => s[3] === 'sleep')?.[2]
  for (const [h, ids] of Object.entries(HOUSEHOLDS)) {
    const p = PEOPLE.find((x) => x.id === ids[0])
    const bed = p && bedOf(p)
    if (!bed) continue
    const a = anchorAt(bed)
    const b = builders.find((x) => x.id === a.map)!
    const indoors = b.kind === 'interior'
    const near = (o: Pos) => o.map === a.map && (indoors || (o.y === a.y && Math.abs(o.x - a.x) <= 1))
    if (PEOPLE.some((o) => !ids.includes(o.id) && bedOf(o) && near(anchorAt(bedOf(o)!)))) continue
    b.regions[`home.${h}`] = indoors ? [0, 0, b.w, b.h] : [a.x - 1, a.y, 3, 1]
    b.regionProps[`home.${h}`] = { owner: `household:${h}` }
  }
  // a house's walls are whose its rooms are (docs/building.md §10): breaking into them is a deed against them
  ownShells(builders, CATALOG.prefabs)
  // the overworld (world-model.md §5.1): each map on its cell, the rest of the continent wild
  const cells = placeCells(builders, m)
  for (const b of builders) {
    const c = cells.get(b.id)
    if (c) b.site = siteOf(c)
  }
  // bushes are walked through (2026-10-27): one on a map's edge would be a way off it onto the world map, so there it is a tree
  for (const b of builders) {
    if (b.kind === 'interior') continue
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) if ((x === 0 || y === 0 || x === b.w - 1 || y === b.h - 1) && b.get(x, y) === 'bush' && !b.portals.some((p) => p.x === x && p.y === y)) b.set(x, y, 'tree')
  }
  // the maps redrawn since a save could hold them: their things under the ids they had (builder.ts keepIds)
  const kept = JSON.parse(readFileSync(new URL('./quest/kept-ids.json', import.meta.url), 'utf8')) as Record<string, [string, string, string][]>
  for (const b of builders) b.keepIds(kept[b.id])
  const chunks = builders.map((b) => b.chunk())
  if (opts.overworld === false) return { index: undefined as unknown as WorldIndex, chunks, backdrop: [], cells }
  const overworld = buildOverworld(chunks, cells)
  if (!backdropMaps) {
    const continent = readContinent()
    backdropMaps = buildBackdrop(continent)
    // the backdrop's people, made into its places' files (docs/continent.md §11): their records are their places', never the index's
    backdropPeople = peopleBackdrop(backdropMaps, continent)
    ownShells(backdropMaps.map((c) => c.map), CATALOG.prefabs)
  }
  const backdrop = backdropMaps
  let items = 0
  let fixtures = 0
  let creatures = 0
  const kinds = new Set<string>()
  // what the world holds: the played maps and the backdrop's
  for (const e of [...chunks, ...backdrop].flatMap((c) => c.entities)) {
    if (e.type.startsWith('item/')) (items++, kinds.add(`${e.type}|${(e.tags ?? []).join(',')}`))
    else if (e.type.startsWith('fixture/')) fixtures++
    else if (e.type.startsWith('actor/creature')) creatures++
  }
  const metaOf = (b: MapBuilder, c: RawChunk): MapMeta => ({ id: b.id, name: b.name, kind: b.kind, region: b.region, width: b.w, height: b.h, portals: b.portals, npcs: npcs.filter((n) => n.place.on === 'tile' && n.place.map === b.id).length, items: c.entities.filter((e) => e.type.startsWith('item/')).length, at: at.get(b.id), ...(Object.keys(b.regions).length && { regions: b.regions }) })
  // the story's one script (world-model.md §6.12): the tutorial's beats and Firstlight's, then the scenes; the fairy's
  // guides last (one step plays at a poll: a lesson of hers never delays the story's own moment)
  const steps = [...PROLOGUE_BEATS, ...FIRSTLIGHT_BEATS, ...scenes, ...CHAPTER1_STORY, ...PILGRIMAGE_STORY, ...FLANKS_STORY, ...CHAPTER1_SCENES, ...HAVEN_STORY, ...QUEST_SCENES, ...GUIDE_BEATS]
  const index: WorldIndex = {
    name: L('The Ford', '渡口'),
    version: VERSION,
    seed: 4242,
    // a new game begins on Cloudtop, the summit plateau, in its ruined shelter; the tutorial is a
    // mode of its own (docs/prologue.md)
    start: { map: summit.id, x: PAT.spawn[0], y: PAT.spawn[1] },
    // one comes round in the clearing early in the morning: a long day to get ready for the night
    starts: { tutorial: { at: { map: tutorial.id, x: TUTORIAL.spawn[0], y: TUTORIAL.spawn[1] }, hour: 7, statuses: { out_cold: 50 } } },
    startHour: START_HOUR,
    maps: [...builders.map((b, i) => metaOf(b, chunks[i])), { id: overworld.map.id, name: overworld.map.name, kind: overworld.map.kind, region: overworld.map.region, width: overworld.map.width, height: overworld.map.height, portals: [], npcs: 0, items: 0 }, ...backdrop.map((c) => ({ ...backdropMeta(c), npcs: backdropPeople.get(c.map.id) ?? 0, ...(c.map.regions && Object.keys(c.map.regions).length && { regions: c.map.regions }) }))],
    // the continent's regions (docs/continent.md), as the world map draws them
    regions: REGIONS.map((r) => ({ id: r.id, name: r.name, color: r.color, ...(r.backdrop && { backdrop: true }), ...(r.look && { look: r.look }) })),
    npcs,
    codex: codexEntries(),
    player: {
      id: 'player',
      type: 'actor/person/player',
      name: L('You', '你'),
      place: { on: 'none' },
      facing: 'down',
      // the look a new game starts from (the new-game panel lets one make one's own)
      look: PLAYER_LOOK,
      // a little hungry: the first thing the mountain teaches is to eat
      props: { hp: 40, maxHp: 40, atk: 2, def: 0, speed: 2, hunger: 12 },
    },
    companions: [{ id: 'pip', type: 'actor/companion/fairy', name: L('Lumi', '露米'), place: { on: 'none' }, facing: 'down' }],
    // the quests (docs/quests.md): the main line, what the people ask, the radiant favours
    quests: QUESTS,
    waypoints: chunks.flatMap((c) => c.entities.filter((e) => e.type === 'fixture/sacred/waypoint').map((e) => ({ id: e.id, map: c.map.id, x: (e.place as { x: number }).x, y: (e.place as { y: number }).y, name: e.name ?? L('Waypoint', '传送雕像') }))),
    stats: { maps: builders.length + backdrop.length, npcs: npcs.length + [...backdropPeople.values()].reduce((a, b) => a + b, 0), creatures, items, itemKinds: kinds.size, fixtures },
    steps,
    invariants: INVARIANTS,
    // the story's facts, and the topics it raises itself (its news: no patch raises one)
    protectedFacts: [...PROTECTED_FACTS, ...storyTopics(steps, STORY_RULES).map((t) => `topic.${t}`)],
    weather: [
      { day: 1, from: 0, to: 17, weather: 'cloud' },
      { day: 1, from: 17, to: 20, weather: 'storm' },
      { day: 1, from: 20, to: 24, weather: 'rain' },
      { day: 2, from: 0, to: 8, weather: 'fog' },
      { day: 2, from: 8, to: 24, weather: 'sun' },
    ],
  }
  return { index, chunks: [...chunks, overworld], backdrop, cells }
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
  const { index, chunks, backdrop } = buildFord()
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(join(OUT, 'maps'), { recursive: true })
  for (const c of [...chunks, ...backdrop]) writeFileSync(join(OUT, 'maps', `${c.map.id}.json`), JSON.stringify(c))
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))
  const lines = PEOPLE.reduce((n, p) => n + p.lines.length, 0)
  const s = index.stats
  console.log(`The Ford: ${s.maps} maps (${backdrop.length} of them backdrop), ${s.npcs} people (${lines} lines), ${s.creatures} creatures, ${s.items} items (${s.itemKinds} kinds), ${s.fixtures} fixtures → ${OUT}`)
}
