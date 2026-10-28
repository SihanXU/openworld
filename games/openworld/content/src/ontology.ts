// Base ontology: terrains, statuses, elements, visual effects and the type tree
// for actors and fixtures. Item types come from the catalogue in items.ts.

import { APPEAR_TICK, TICKS_PER_DAY, type Cond, type Ontology, type StageDef, type StatusDef, type TerrainDef, type TypeDef } from '@openworld/engine'
import { HUNGER_EFFECT_EVERY, HUNGER_EVERY, HUNGRY_BELOW, HUNGRY_PACE } from '@openworld/modules'
// the engine's official modules this game uses (docs/engine-split.md S3): loading them registers them
import '@openworld/modules'
import { LOOK_TABLE } from './looks.ts'
import { ELEMENT_NAMES, MATERIALS, MATERIAL_DEFS, QUALITIES, QUALITY_DEFS, itemTypes } from './items.ts'
import { GEAR_LEVELS } from './gear.ts'
import { GEAR_SETS } from './sets.ts'
import { AFFIX_TABLE, LOOT, TROPHY_OF, TROPHY_SETS } from './trophies.ts'
import { PILGRIMAGE_TYPES } from './pilgrimage.ts'
import { FOG, FOG_EVERY } from './bossrooms.ts'
import { FAITH_STATUSES } from './faith.ts'
import { VEGETABLE_CROPS, cropHours } from './crops.ts'
import { BOSSES, BOSS_ENCOUNTERS, BOSS_KITS, BOSS_TYPES } from './bosses.ts'
import { CREATURE_TACTICS, ELITE_KITS, KIT_TYPES, KITS } from './kits.ts'
import { CREATURE_DROPS } from './drops.ts'
import { CREATURE_STATS } from './levels.ts'
import { SKILL_STATUSES } from './afflictions.ts'
import { SKILL_PROFESSIONS } from './skills.ts'
import { BOON_STATUSES } from './boons.ts'
import { DEEDS, LAWS, SOCIAL, SOCIAL_STATUSES, SOCIAL_TYPES, TALK } from './social.ts'
import { MINOR_SUBJECTS } from './protection.ts'

/** One char per terrain: maps are stored as strings. */
export const TERRAIN_CHARS: Record<string, string> = {
  '.': 'grass',
  ',': 'drygrass',
  '*': 'flowers',
  ':': 'dirt',
  '=': 'path',
  '#': 'cobble',
  s: 'sand',
  n: 'snow',
  i: 'ice',
  '~': 'water',
  W: 'deepwater',
  T: 'tree',
  P: 'pine',
  b: 'bush',
  '%': 'thornhedge',
  R: 'rock',
  X: 'wall',
  H: 'woodwall',
  r: 'roof',
  f: 'floor_wood',
  F: 'floor_stone',
  c: 'carpet',
  D: 'door',
  '>': 'stairs_down',
  '<': 'stairs_up',
  o: 'cave_floor',
  O: 'cave_wall',
  L: 'lava',
  a: 'ash',
  t: 'charred_tree',
  K: 'burnt_wall',
  // the walls of the buildings not of stone or wood (a tent's canvas, a hut's thatch, an igloo's snow blocks)
  Y: 'canvaswall',
  Z: 'thatchwall',
  S: 'snowwall',
  // the overworld's ground (world-model.md §5.1)
  '0': 'ow_sea',
  '1': 'ow_plain',
  '2': 'ow_forest',
  '3': 'ow_hills',
  '4': 'ow_mountain',
  '5': 'ow_snow',
  '6': 'ow_road',
  '7': 'ow_river',
  // the other regions' grounds (docs/continent.md §2)
  '8': 'ow_steppe',
  '9': 'ow_badlands',
  A: 'ow_fields',
  C: 'ow_dust',
  E: 'ow_salt',
  G: 'ow_marsh',
  I: 'ow_deadwood',
  J: 'ow_highland',
  N: 'ow_city',
  Q: 'ow_bridge',
  u: 'stump',
  g: 'gravel',
  B: 'bridge',
  m: 'farmland',
  M: 'mud',
  h: 'spring',
  V: 'void',
  p: 'paving',
  w: 'flagstone',
  U: 'rampart',
  z: 'plaza',
  k: 'flags',
  e: 'flowerbed',
  l: 'lattice',
  q: 'marble',
  d: 'parquet',
  y: 'carpet_royal',
  j: 'runner',
}
export const CHAR_OF: Record<string, string> = Object.fromEntries(Object.entries(TERRAIN_CHARS).map(([c, t]) => [t, c]))

const T = (id: string, zh: string, en: string, tags: string[], extra: Partial<TerrainDef> = {}): TerrainDef => ({
  id,
  name: { en, zh },
  // `standing`: what takes the cell above its floor (a tree, a bush, rock, a wall, a stump), a thing a hand meets
  tags: [...tags, ...(extra.solid ? ['solid'] : []), ...(extra.liquid ? ['liquid'] : []), ...(extra.space && extra.space !== 'floor' ? ['standing'] : [])],
  ...extra,
})

/** The share of what a thing is made of that it leaves when it breaks (world-model.md §6.4, D9). */
export const RECOVERY = 0.5
/** A drop of a level does no harm; each level beyond it hurts this much (world-model.md §5.5). */
export const SAFE_FALL = 1
export const FALL_DAMAGE = 6
/** Heavy weather slows a long step (world-model.md §5.6): rain, storm, snow. */
export const RAIN_COST = 1.5
/** How many storeys may stand above the ground (world-model.md §5.2). */
export const STOREYS = 4

// ------------------------------------------------------------------ stages (world-model.md §6.5)

/** Out under the sky (a plant needs light, after Elin's GrowSystem). */
const LIGHT: Cond = { outdoors: true }
/** Nobody standing on it (a tree does not grow up through someone). */
const CLEAR: Cond = { count: { role: 'host', in: 'tile', match: { type: 'actor' }, cmp: { eq: 0 } } }
/** Two game days for a felled tree's stump, or a sapling, to grow into a tree; an hour more while something stops it. */
export const TREE_GROWS = 28800
const GROWS_INTO_TREE: StageDef = { into: 'tile/tree', lasts: TREE_GROWS, needs: { all: [LIGHT, CLEAR] }, wait: 600, fx: 'leaves' }
/** A vein mined out grows back in a game day (its spent face stands meanwhile: nothing breaks it). */
export const VEIN_REGROWS = TICKS_PER_DAY
/** The ground's small things (flowers, tufts, leaves, pebbles): how often one more appears on an outdoor map (two game hours), and at most how many of each. */
export const LITTER_EVERY = TICKS_PER_DAY / 12
export const LITTER: [type: string, on: string[], max: number][] = [
  ['fixture/nature/flowers', ['grass', 'flowers'], 3],
  ['fixture/nature/tuft', ['grass', 'drygrass'], 3],
  ['fixture/nature/leaves', ['grass', 'dirt'], 3],
  ['fixture/nature/pebbles', ['dirt', 'gravel', 'sand'], 3],
]
/** A calf or a chick grows up in two game days. */
const GROWS_UP = 2 * TICKS_PER_DAY
/** A hen lays an egg every three game hours. */
export const LAYS_EVERY = 1800
/** A hen does not lay while this many eggs lie about her map: uncollected, they would pile up without end. */
export const EGGS_LIE = 12
const LAYS: StageDef = { lasts: LAYS_EVERY, yields: [{ type: 'item/food/egg/raw' }], needs: { count: { role: 'host', in: 'map', match: { type: 'item/food/egg' }, cmp: { lt: EGGS_LIE } } } }

/** How many night-born walk a map at once, and how often (ticks) another may come (world-model.md §6.9). */
export const NIGHT_CAP = 4
export const NIGHT_EVERY = 60
/** The largest a room may be, in cells (larger is out of doors). */
export const ROOM_SIZE = 256

/**
 * How well each capability and each edge works on each material category (world-model.md §6.1,
 * after Elin's tool efficiency): a stone axe fells a tree in two blows, a pickaxe breaks rock in
 * two, a sword cuts wood at half pace and stone hardly at all.
 */
const ROW = (wood: number, plant: number, stone: number, ore: number, soil: number, soft: number, bone: number, crystal: number) =>
  ({ wood, plant, stone, ore, metal: ore, soil, skin: soft, organic: soft, flesh: soft, fibre: soft, bone, crystal })
export const EFFICIENCY: Record<string, Record<string, number>> = {
  'tool:axe': ROW(1, 1, 0.25, 0.1, 0.25, 1, 0.5, 0.25),
  'tool:pickaxe': ROW(0.25, 0.25, 1, 1, 0.5, 0.5, 1, 1),
  'tool:shovel': ROW(0.25, 1, 0.25, 0.1, 1, 0.25, 0.25, 0.1),
  'tool:hammer': ROW(0.5, 0.25, 0.5, 0.5, 0.25, 0.5, 1, 1),
  'edge:cut': ROW(0.5, 1, 0.1, 0.1, 0.1, 1, 0.5, 0.25),
  'edge:blunt': ROW(0.25, 0.5, 0.1, 0.1, 0.1, 1, 0.5, 0.25),
  'edge:pierce': ROW(0.25, 0.5, 0.1, 0.1, 0.1, 1, 0.25, 0.1),
  'edge:dig': ROW(0.25, 1, 0.25, 0.1, 1, 0.25, 0.25, 0.1),
  'edge:magic': ROW(0.25, 0.5, 0.25, 0.25, 0.25, 1, 0.5, 0.5),
}

export const TERRAINS: TerrainDef[] = [
  T('grass', '草地', 'grass', ['ground', 'plant', 'diggable'], { color: '#6ab04c' }),
  T('drygrass', '枯草', 'dry grass', ['ground', 'plant', 'flammable', 'dry'], { color: '#b6b94f' }),
  T('flowers', '花丛', 'flowers', ['ground', 'plant'], { color: '#7cc05a' }),
  T('dirt', '泥土', 'dirt', ['ground', 'diggable'], { color: '#9a7b52' }),
  T('path', '土路', 'dirt road', ['ground', 'road'], { color: '#c9a86a' }),
  T('cobble', '石板路', 'cobblestones', ['ground', 'road', 'stone'], { color: '#9ea3a8' }),
  // the Holy City's showcase grounds (docs/showcase.md §3.5): pale limestone laid in panels (a cathedral's parvis and
  // its nave), grey flags (a fortress's wards), and the walk along a curtain wall's top (its face is masonry)
  T('paving', '石板铺地', 'paving', ['ground', 'road', 'stone'], { color: '#efd6c0' }),
  T('flagstone', '灰石板地', 'flagstones', ['ground', 'road', 'stone'], { color: '#5d5660' }),
  T('rampart', '城墙步道', 'wall-walk', ['ground', 'stone'], { color: '#6a646e' }),
  // (tools/src/art/floors.ts) a city's cobbled plaza in its kerb, its flagstone streets, flower beds in stone edging; and
  // within, a nave's diamond lattice, a chancel's marble, oak parquet, the crimson carpet and the blue runner
  T('plaza', '广场石地', 'plaza', ['ground', 'road', 'stone'], { color: '#6f7377' }),
  T('flags', '石板街', 'flagstone street', ['ground', 'road', 'stone'], { color: '#d3c3a2' }),
  T('flowerbed', '花坛', 'flower bed', ['plant', 'ground'], { space: 'volume', solid: true, color: '#7fb24d' }),
  T('lattice', '菱纹地砖', 'lattice tiles', ['floor', 'stone', 'indoor'], { color: '#b9573d' }),
  T('marble', '大理石地面', 'marble floor', ['floor', 'stone', 'indoor'], { color: '#f4f2ee' }),
  T('parquet', '人字拼木地板', 'parquet', ['floor', 'wooden', 'flammable', 'indoor'], { color: '#a3754e' }),
  T('carpet_royal', '金边红毯', 'crimson carpet', ['floor', 'cloth', 'flammable', 'indoor'], { color: '#a72f39' }),
  T('runner', '蓝色长毯', 'blue runner', ['floor', 'cloth', 'flammable', 'indoor'], { color: '#2f5aa6' }),
  T('sand', '沙地', 'sand', ['ground', 'diggable'], { color: '#e3cf8f' }),
  T('snow', '雪地', 'snow', ['ground', 'cold', 'diggable'], { color: '#eef3f6' }),
  // ice that froze from water (thin: `chilled`) thaws back to water when that runs out; the ice a map is made with does not
  T('ice', '冰面', 'ice', ['ground', 'cold', 'frozen-water', 'slippery'], { stage: { into: 'tile/water', clock: 'chilled', fx: 'splash' }, color: '#bfe6f5' }),
  T('water', '浅水', 'water', ['water', 'water-source', 'conductive'], { solid: true, liquid: true, color: '#3d7fd6' }),
  T('deepwater', '深水', 'deep water', ['water', 'water-source', 'conductive', 'deep'], { solid: true, liquid: true, color: '#2c5fae' }),
  // what fills a cell can be broken (world-model.md §6.3): its durability, what it is made of
  T('tree', '树', 'tree', ['plant', 'tree', 'flammable', 'wooden'], { space: 'volume', solid: true, props: { material: 'wood', maxHp: 10, hp: 10 }, makeup: [{ type: 'item/material/log', count: 4 }, { type: 'item/material/stick', count: 2 }], color: '#2f6b33' }),
  T('pine', '松树', 'pine tree', ['plant', 'tree', 'flammable', 'wooden', 'cold'], { space: 'volume', solid: true, props: { material: 'wood', maxHp: 10, hp: 10 }, makeup: [{ type: 'item/material/log', count: 4 }, { type: 'item/material/stick', count: 2 }], color: '#23553a' }),
  // (low enough to push through: one walks into a bush as into tall grass)
  T('bush', '灌木', 'bush', ['plant', 'flammable'], { space: 'volume', solid: false, props: { material: 'plant', maxHp: 4, hp: 4 }, makeup: [{ type: 'item/material/stick', count: 2 }], color: '#4f8f3a' }),
  // the White Knight's hedge across the East Road (docs/boss-rooms.md): thorns that close again, no blade or fire opens them
  T('thornhedge', '荆棘篱', 'thorn hedge', ['plant', 'thorn'], { space: 'volume', solid: true, color: '#3b4a2a' }),
  T('rock', '岩石', 'rock', ['rock', 'stone', 'mineable'], { space: 'volume', solid: true, props: { material: 'stone', maxHp: 10, hp: 10 }, makeup: [{ type: 'item/material/stone', count: 2 }], color: '#7d7a74' }),
  // the walls the maps are built of (houses, chapels, keeps, ruins, fences: docs/building.md §10) are `enduring`: hit,
  // they show it, crack by crack, but never give way (wall/endure) — the way into a house is its door. What one builds
  // (structure/wall) is not: it is taken down as it was put up.
  T('wall', '石墙', 'stone wall', ['stone', 'wall', 'enduring'], { space: 'volume', solid: true, props: { material: 'stone', maxHp: 24, hp: 24, supports: 2 }, makeup: [{ type: 'item/material/stone', count: 4 }], color: '#6b6e75' }),
  T('woodwall', '木墙', 'wooden wall', ['wooden', 'wall', 'flammable', 'enduring'], { space: 'volume', solid: true, props: { material: 'wood', maxHp: 12, hp: 12, supports: 2 }, makeup: [{ type: 'item/material/plank', count: 2 }], color: '#8a5a33' }),
  T('burnt_wall', '焦黑的木墙', 'burnt wall', ['wall', 'burnt', 'enduring'], { space: 'volume', solid: true, props: { material: 'wood', maxHp: 4, hp: 4 }, makeup: [{ type: 'item/material/coal', count: 2 }], color: '#3a2e28' }),
  // a building is made of what its walls are (docs/building.md §10): a tent's canvas gives to a blade, a hut's thatch to
  // an axe or a sickle, an igloo's packed snow to a pick; what each is made of is what it would break into
  T('canvaswall', '帆布墙', 'canvas wall', ['cloth', 'wall', 'flammable', 'enduring'], { space: 'volume', solid: true, props: { material: 'cloth', maxHp: 6, hp: 6, supports: 1 }, makeup: [{ type: 'item/material/cloth', count: 2 }, { type: 'item/material/stick', count: 1 }], color: '#c9a46a' }),
  T('thatchwall', '草泥墙', 'thatch wall', ['plant', 'wall', 'flammable', 'enduring'], { space: 'volume', solid: true, props: { material: 'plant', maxHp: 6, hp: 6, supports: 1 }, makeup: [{ type: 'item/material/grass', count: 3 }, { type: 'item/material/stick', count: 2 }], color: '#b59a55' }),
  T('snowwall', '雪砖墙', 'snow-block wall', ['cold', 'wall', 'enduring'], { space: 'volume', solid: true, props: { material: 'ice', maxHp: 10, hp: 10, supports: 2 }, makeup: [{ type: 'item/misc/snowball', count: 3 }], color: '#e8f0f4' }),
  T('roof', '屋顶', 'roof', ['roof'], { space: 'volume', solid: true, props: { material: 'wood', maxHp: 8, hp: 8 }, makeup: [{ type: 'item/material/plank', count: 1 }], color: '#a8432f' }),
  T('floor_wood', '木地板', 'wooden floor', ['floor', 'wooden', 'flammable', 'indoor'], { color: '#9c7a4c' }),
  T('floor_stone', '石地板', 'stone floor', ['floor', 'stone', 'indoor'], { color: '#8d8f94' }),
  T('carpet', '地毯', 'carpet', ['floor', 'cloth', 'flammable', 'indoor'], { color: '#8e3b46' }),
  T('door', '门', 'door', ['door', 'wooden'], { color: '#6b4226' }),
  T('stairs_down', '下行阶梯', 'stairs down', ['stairs'], { color: '#4a4d52' }),
  T('stairs_up', '上行阶梯', 'stairs up', ['stairs'], { color: '#77797e' }),
  T('cave_floor', '洞穴地面', 'cave floor', ['ground', 'stone', 'cave'], { color: '#5a5550' }),
  T('cave_wall', '洞壁', 'cave wall', ['rock', 'stone', 'mineable', 'cave'], { space: 'volume', solid: true, props: { material: 'stone', maxHp: 16, hp: 16 }, makeup: [{ type: 'item/material/stone', count: 2 }], color: '#34302c' }),
  T('lava', '熔岩', 'lava', ['fire-source', 'hot', 'molten'], { solid: true, liquid: true, color: '#e2541b' }),
  T('ash', '灰烬', 'ash', ['ground', 'burnt'], { color: '#5b5550' }),
  T('charred_tree', '焦木', 'charred tree', ['burnt', 'tree'], { space: 'volume', solid: true, props: { material: 'wood', maxHp: 4, hp: 4 }, makeup: [{ type: 'item/material/coal', count: 2 }], color: '#3a2e28' }),
  T('stump', '树桩', 'stump', ['wooden', 'flammable'], { space: 'soil', props: { material: 'wood', maxHp: 6, hp: 6 }, makeup: [{ type: 'item/material/log', count: 2 }], stage: GROWS_INTO_TREE, color: '#7a5a3a' }),
  T('gravel', '碎石', 'gravel', ['ground', 'stone'], { color: '#8b8680' }),
  T('bridge', '木桥', 'wooden bridge', ['wooden', 'flammable', 'road'], { color: '#a07a4a' }),
  T('farmland', '农田', 'farmland', ['ground', 'diggable', 'soil'], { color: '#7a5634' }),
  T('mud', '泥潭', 'mud', ['ground', 'wet-ground'], { color: '#5e4a33' }),
  // a warm spring, shallow enough to wade into and sit in: soaking mends (content rules.ts, spring/soak)
  T('spring', '疗伤温泉', 'healing spring', ['spring', 'warm'], { color: '#5fb8d6' }),
  T('void', '虚空', 'void', [], { solid: true, color: '#000000' }),
  // the open air of a cell on a storey above the ground where no floor is laid: never on a map, only
  // reached there to lay a floor in or set a wall on the wall below (docs/building.md §3)
  T('air', '空中', 'open air', ['air'], { color: '#cfe6f7' }),
  // the overworld (world-model.md §5.1): an ordinary map whose every cell is a local map; each step
  // costs time by its ground (props.cost: road half, rough ground half again); sea, mountains and
  // rivers do not let one pass
  T('ow_sea', '海', 'sea', ['water', 'overworld'], { solid: true, liquid: true, color: '#2c5fae' }),
  T('ow_plain', '平原', 'plains', ['ground', 'overworld'], { props: { cost: 1 }, color: '#6ab04c' }),
  T('ow_forest', '森林', 'forest', ['ground', 'overworld', 'wooded'], { props: { cost: 1.5 }, color: '#2f6b33' }),
  T('ow_hills', '丘陵', 'hills', ['ground', 'overworld', 'rough'], { props: { cost: 1.5 }, color: '#8a9a52' }),
  T('ow_mountain', '山脉', 'mountains', ['overworld', 'rock'], { solid: true, color: '#7d7a74' }),
  T('ow_snow', '雪原', 'snowfield', ['ground', 'overworld', 'cold'], { props: { cost: 1.5 }, color: '#eef3f6' }),
  T('ow_road', '大道', 'road', ['ground', 'overworld', 'road'], { props: { cost: 0.5 }, color: '#c9a86a' }),
  T('ow_river', '河流', 'river', ['water', 'overworld'], { solid: true, liquid: true, color: '#3d7fd6' }),
  // the other regions' grounds (docs/continent.md §2): the March's steppe and red badlands, the Vale's fields, dust
  // and salt, the Fens' marsh and dead wood, the Heights' white stone, the Holy City's streets; a bridge where a road
  // crosses a river (the river's cell, gone over)
  T('ow_steppe', '草原', 'steppe', ['ground', 'overworld'], { props: { cost: 1 }, color: '#b4a868' }),
  T('ow_badlands', '赤岩荒原', 'badlands', ['ground', 'overworld', 'rough'], { props: { cost: 1.5 }, color: '#b0583c' }),
  T('ow_fields', '田野', 'fields', ['ground', 'overworld'], { props: { cost: 1 }, color: '#c8b070' }),
  T('ow_dust', '尘原', 'dust plain', ['ground', 'overworld', 'rough'], { props: { cost: 1.5 }, color: '#d8c49a' }),
  T('ow_salt', '盐滩', 'salt flat', ['ground', 'overworld'], { props: { cost: 1 }, color: '#ece6d8' }),
  T('ow_marsh', '沼泽', 'marsh', ['ground', 'overworld', 'wet'], { props: { cost: 2 }, color: '#56705a' }),
  T('ow_deadwood', '死林', 'dead wood', ['ground', 'overworld', 'wooded'], { props: { cost: 1.5 }, color: '#6a6252' }),
  T('ow_highland', '白石高原', 'white highland', ['ground', 'overworld', 'rough'], { props: { cost: 1.5 }, color: '#d4cfc0' }),
  T('ow_city', '城郊', 'city ground', ['ground', 'overworld', 'road'], { props: { cost: 0.5 }, color: '#b8a48a' }),
  T('ow_bridge', '桥', 'bridge', ['ground', 'overworld', 'road'], { props: { cost: 0.5 }, color: '#a07a4a' }),
]

export const STATUSES: StatusDef[] = [
  { id: 'burning', name: { en: 'burning', zh: '燃烧' }, duration: 45, clears: ['frozen'], overlay: 'fire' },
  // a discomfort (wellbeing.ts): one is rid of it under a roof, by a fire, or as it dries
  { id: 'wet', name: { en: 'wet', zh: '潮湿' }, duration: 400, clears: ['burning'], overlay: 'wet', mind: 1 },
  // sitting in a warm spring: it mends (the spring's rules give it back while one stays), green crosses rising
  { id: 'soaking', name: { en: 'soaking', zh: '泡温泉' }, duration: 8, clears: ['burning', 'frozen'], overlay: 'mend' },
  // water a line was cast into: nothing bites there until it settles
  { id: 'stirred', name: { en: 'stirred up', zh: '搅浑' }, duration: 100 },
  // a mushroom ring picked, reeds cut, a hive's honey taken: none again until it grows back (life.ts)
  { id: 'picked', name: { en: 'picked', zh: '已采' }, duration: 14400 },
  { id: 'frozen', name: { en: 'frozen', zh: '冰冻' }, duration: 40, clears: ['burning', 'wet'], immobilize: true, overlay: 'ice', mind: 2 },
  // frozen a moment ago: it does not freeze again until this wears off (in the rain, a wet thing struck
  // by ice again and again was held frozen through a whole fight)
  { id: 'thawed', name: { en: 'thawing', zh: '刚解冻' }, duration: 80 },
  { id: 'electrified', name: { en: 'electrified', zh: '感电' }, duration: 8, immobilize: true, overlay: 'spark' },
  { id: 'oiled', name: { en: 'oiled', zh: '油污' }, duration: 900, overlay: 'oil', mind: 1 },
  { id: 'lit', name: { en: 'lit', zh: '点燃' }, overlay: 'flame' },
  { id: 'open', name: { en: 'open', zh: '打开' } },
  /** A waypoint stone touched: it glows, and the world map can take you to it (docs/prologue.md). */
  { id: 'attuned', name: { en: 'attuned', zh: '已共鸣' } },
  { id: 'notched', name: { en: 'notched', zh: '砍了一斧' }, duration: 100 },
  { id: 'watered', name: { en: 'watered', zh: '浇过水' }, overlay: 'wet' },
  { id: 'irrigated', name: { en: 'water held for the next stage', zh: '已蓄水供下一阶段' } },
  { id: 'fertilized', name: { en: 'fertilized', zh: '施过肥' } },
  // a stage's clock (world-model.md §6.5): when it runs out, the thing becomes what its stage says next
  { id: 'stage', name: { en: 'growing', zh: '生长中' } },
  // the herbalist's draught: fire does a quarter of its harm while it lasts (a resistance, world-model.md §6.8)
  { id: 'fireproof', name: { en: 'fireproof', zh: '防火' }, duration: 3000, clears: ['burning'], wards: ['burning'], props: { resFire: 75 } },
  // ice that magic or a creature made: it thaws back to water
  { id: 'chilled', name: { en: 'thin ice', zh: '薄冰' }, duration: 1500 },
  // a mechanism that needs mending (the ferry winch whose rope snapped)
  { id: 'broken', name: { en: 'broken', zh: '坏了' } },
  // at no health the essential (people, the player) collapse for a while instead of dying
  { id: 'down', name: { en: 'down', zh: '倒地' }, duration: 300, immobilize: true, pose: 'lie' },
  // a quest's deadline (docs/quests.md): when it runs out, an offer is withdrawn and a quest under way fails
  { id: 'due', name: { en: 'due', zh: '期限' } },
  // out cold (a new game's first moments): lying still a while, then one comes round
  { id: 'out_cold', name: { en: 'out cold', zh: '昏迷' }, duration: 50, immobilize: true, pose: 'lie' },
  // asleep in a bed: lying still while the night passes, hungry four times slower (the hunger period's paceBy)
  { id: 'asleep', name: { en: 'asleep', zh: '睡着' }, immobilize: true, pose: 'lie' },
  // the postures a thing's use asks of who uses it (a chair, hay, an altar, a wall: the settle impulse): each ends as one moves on
  { id: 'seated', name: { en: 'seated', zh: '坐着' }, pose: 'sit', untilMove: true },
  { id: 'lying', name: { en: 'lying down', zh: '躺着' }, pose: 'lie', untilMove: true },
  { id: 'kneeling', name: { en: 'kneeling', zh: '跪着' }, pose: 'kneel', untilMove: true },
  { id: 'leaning', name: { en: 'leaning', zh: '倚着' }, pose: 'lean', untilMove: true },
  // under six tenths of a full food bar: hunger falls slowly now (a body goes days without food)
  { id: 'hungry', name: { en: 'hungry', zh: '饿了' }, mind: 3 },
  // a wound that bleeds 1 a second (Hemorrhage), and the rush of Adrenaline (the skills)
  { id: 'bleeding', name: { en: 'bleeding', zh: '流血' }, duration: 40, every: 10 },
  // a beast fed for the day, a cow milked for the day (homestead.ts)
  { id: 'fed', name: { en: 'fed', zh: '吃饱了' }, duration: TICKS_PER_DAY },
  { id: 'milked', name: { en: 'milked', zh: '挤过奶' }, duration: TICKS_PER_DAY },
  // a beast that has borne young rests a day before it can again
  { id: 'bred', name: { en: 'bred', zh: '刚生过崽' }, duration: TICKS_PER_DAY },
  // forced to one's knees (the Crown of Thorns' power: none cross that do not kneel)
  { id: 'knelt', name: { en: 'kneeling', zh: '跪地' }, duration: 10, immobilize: true },
  { id: 'adrenaline', name: { en: 'adrenaline', zh: '肾上腺素' }, duration: 50, every: 10 },
  // knocked senseless a moment (a Shield Bash, a Charge, actives.ts): it cannot move or strike
  { id: 'stunned', name: { en: 'stunned', zh: '眩晕' }, duration: 15, immobilize: true },
]

import { ELEMENTS } from './elements.ts'
export { ELEMENTS }

export const VFX = [
  'steam',
  'splash',
  'fire_burst',
  'sparks',
  'frost',
  'smoke',
  'poof',
  'heal',
  'hit',
  'explosion',
  'leaves',
  'dust',
  'sparkle',
  'gust',
  'shatter',
]

const P = (id: string, en: string, zh: string, extra: Partial<TypeDef> = {}): TypeDef => ({ id, name: { en, zh }, ...extra })
const F = (id: string, en: string, zh: string, tags: string[], extra: Partial<TypeDef> = {}): TypeDef => ({
  id,
  name: { en, zh },
  tags,
  sprite: 'fixture:' + id.split('/').pop(),
  ...extra,
})

/** The roles whose work is out under the sky whatever it does: they do not mind getting wet (the rest go in out of the rain). */
export const WEATHERED = ['farmer', 'guard', 'fisher', 'hunter', 'soldier', 'sailor', 'ferrykeeper']

export const PERSON_ROLES: [string, string, string][] = [
  ['villager', 'villager', '村民'],
  ['farmer', 'farmer', '农夫'],
  ['merchant', 'merchant', '商人'],
  ['guard', 'guard', '卫兵'],
  ['smith', 'blacksmith', '铁匠'],
  ['innkeeper', 'innkeeper', '旅店老板'],
  ['priest', 'priest', '祭司'],
  ['scholar', 'scholar', '学者'],
  ['noble', 'noble', '贵族'],
  ['child', 'child', '孩童'],
  ['fisher', 'fisher', '渔夫'],
  ['hunter', 'hunter', '猎人'],
  ['miner', 'miner', '矿工'],
  ['bard', 'bard', '吟游诗人'],
  ['beggar', 'beggar', '乞丐'],
  ['soldier', 'soldier', '士兵'],
  ['mage', 'mage', '法师'],
  ['herbalist', 'herbalist', '草药师'],
  ['sailor', 'sailor', '水手'],
  ['traveler', 'traveler', '旅人'],
  ['elder', 'village elder', '村长'],
  ['ferrykeeper', 'ferrykeeper', '摆渡人'],
  ['peddler', 'peddler', '货郎'],
]

const actorTypes: TypeDef[] = [
  // an agent acts by itself, with a body that takes its cells (world-model.md §4.2)
  P('actor', 'creature', '生物', { tags: ['agent'], props: { level: 1, material: 'flesh' } }),
  // people are mortal (docs/npc-sandbox.md §2.8): those the story needs carry `essential` themselves (they go
  // down instead); a person grows hungry slower than the traveller, perceives, and has a conscience (and fights back when struck only if it says so: `fights`)
  P('actor/person', 'person', '人', {
    tags: ['person', 'living', 'talkable', 'faction:folk'],
    props: { hp: 20, maxHp: 20, atk: 1, def: 0, speed: 2, sight: 7, perception: 10, hunger: 20, maxHunger: 20, hungerEvery: 960, honesty: 1, bodyType: 'fixture/remains/body' },
    sprite: 'person',
  }),
  P('actor/person/player', 'you', '你', { tags: ['essential'], props: { hp: 40, maxHp: 40, atk: 2, def: 0, speed: 2, hunger: 20, maxHunger: 20, hungerEvery: 480 } }),
  // those whose work is out in the weather do not mind the rain at it (wellbeing.ts: StatusDef.mind, TypeDef.minds)
  ...PERSON_ROLES.map(([id, en, zh]) => P(`actor/person/${id}`, en, zh, WEATHERED.includes(id) ? { minds: { wet: 0 } } : {})),
  // the profession trainer (engine/src/profession.ts): a profession is chosen within reach of one
  P('actor/person/trainer', 'profession trainer', '职业导师', { tags: ['trainer'] }),
  // a minor kind's health, attack and defence are not set here: they come from one curve through its role (levels.ts)
  P('actor/creature', 'creature', '怪物', { tags: ['creature', 'living', 'faction:wild'], props: { hp: 10, maxHp: 10, atk: 2, def: 0, speed: 6 } }),
  P('actor/creature/slime', 'slime', '史莱姆', { tags: ['slime', 'gelatinous'], sprite: 'creature:slime', props: { hp: 9, maxHp: 9, atk: 2, speed: 7 } }),
  P('actor/creature/slime/green_slime', 'green slime', '绿史莱姆', {}),
  P('actor/creature/slime/fire_slime', 'fire slime', '火焰史莱姆', { tags: ['fiery'], props: { element: 'fire' } }),
  P('actor/creature/slime/frost_slime', 'frost slime', '冰霜史莱姆', { tags: ['icy'], props: { element: 'ice' } }),
  P('actor/creature/slime/spark_slime', 'spark slime', '雷电史莱姆', { tags: ['charged'], props: { element: 'lightning' } }),
  P('actor/creature/slime/water_slime', 'water slime', '水史莱姆', { tags: ['watery'], props: { element: 'water' } }),
  P('actor/creature/slime/king_slime', 'Slime King', '史莱姆王', { tags: ['boss', 'large'], sprite: 'boss:slime', props: { speed: 9 } }),
  P('actor/creature/beast', 'beast', '野兽', { tags: ['beast', 'furry', 'flammable'], sprite: 'creature:wolf' }),
  P('actor/creature/beast/wolf', 'wolf', '狼', { props: { speed: 4 } }),
  P('actor/creature/beast/frost_wolf', 'frost wolf', '霜狼', { tags: ['icy'], props: { element: 'ice', speed: 4 } }),
  P('actor/creature/beast/boar', 'boar', '野猪', { sprite: 'creature:boar', props: { speed: 5 } }),
  P('actor/creature/beast/bat', 'bat', '蝙蝠', { sprite: 'creature:bat', tags: ['flying'], props: { speed: 3, stance: 'air' } }),
  P('actor/creature/undead', 'undead', '亡灵', { tags: ['undead'], sprite: 'creature:skeleton' }),
  // the night's walkers (engine/src/nightspawn.ts): slow, and gone at dawn
  P('actor/creature/undead/zombie', 'zombie', '僵尸', { tags: ['rotting'], sprite: 'creature:zombie', props: { speed: 10 } }),
  // the Old Barrow's keeper (docs/quests.md)
  P('actor/creature/undead/warden', 'barrow warden', '古墓守卫', { tags: ['bone', 'boss'], props: { speed: 8 } }),
  P('actor/creature/undead/skeleton', 'skeleton', '骷髅', { tags: ['bone'], props: { speed: 6 } }),
  P('actor/creature/undead/ghost', 'ghost', '幽灵', { sprite: 'creature:ghost', tags: ['spectral'], props: { speed: 5, element: 'ice', stance: 'air', range: 4 } }),
  P('actor/creature/golem', 'golem', '魔像', { tags: ['construct'], sprite: 'creature:golem' }),
  P('actor/creature/golem/stone_golem', 'stone golem', '石魔像', { tags: ['stone'], props: { speed: 9, element: 'earth' } }),
  P('actor/creature/golem/ice_golem', 'ice golem', '冰魔像', { tags: ['icy'], props: { speed: 9, element: 'ice' } }),
  P('actor/creature/imp', 'imp', '小恶魔', { tags: ['demon', 'fiery'], sprite: 'creature:imp' }),
  P('actor/creature/imp/fire_imp', 'fire imp', '火焰小鬼', { props: { speed: 5, element: 'fire', range: 4 } }),
  P('actor/creature/wisp', 'wisp', '鬼火', { tags: ['spectral', 'charged'], sprite: 'creature:wisp', props: { stance: 'air' } }),
  P('actor/creature/wisp/storm_wisp', 'storm wisp', '风暴鬼火', { props: { speed: 4, element: 'lightning', range: 4 } }),
  // companions (docs/prologue.md): they follow a leader (props.companion), fly, never block nor fight
  // (it keeps two tiles off its leader, engine companion.ts, and is spoken to from as far)
  P('actor/companion', 'companion', '同伴', { tags: ['companion', 'living', 'airborne', 'essential'], props: { hp: 10, maxHp: 10, atk: 0, def: 0, speed: 2, sight: 8, handsRange: 2 } }),
  // Lumi: a fairy, a small winged girl (the project's own art, tools/src/art/fairy.ts)
  P('actor/companion/fairy', 'fairy', '精灵', { tags: ['fairy', 'winged'], sprite: 'creature:fairy' }),
  // the meadow's animals: passive, they run when struck, and leave food behind (drop × drops)
  P('actor/creature/animal', 'animal', '动物', { tags: ['animal'], props: { behaviour: 'passive', temper: 'wary', sight: 4 } }),
  P('actor/creature/animal/cow', 'cow', '牛', { tags: ['livestock', 'furry'], sprite: 'creature:cow', props: { hp: 10, maxHp: 10, atk: 0, speed: 7, babyType: 'actor/creature/animal/calf', meat: 'item/food/meat/raw', hide: 'item/material/leather' }, makeup: [{ type: 'item/food/meat/raw', count: 4 }] }),
  P('actor/creature/animal/chicken', 'chicken', '鸡', { tags: ['livestock', 'bird', 'feathered', 'lays-eggs'], sprite: 'creature:chicken', stage: LAYS, props: { hp: 4, maxHp: 4, atk: 0, speed: 5, babyType: 'actor/creature/animal/chick', meat: 'item/food/chicken/raw', hide: 'item/material/feather' }, makeup: [{ type: 'item/food/chicken/raw', count: 2 }] }),
  // the young of a pair fed together (homestead.ts, Minecraft's breeding): they grow up in two days
  P('actor/creature/animal/calf', 'calf', '小牛', { tags: ['livestock', 'furry', 'young'], sprite: 'creature:calf', stage: { lasts: GROWS_UP, into: 'actor/creature/animal/cow' }, props: { hp: 5, maxHp: 5, atk: 0, speed: 6 }, makeup: [{ type: 'item/food/meat/raw', count: 1 }] }),
  P('actor/creature/animal/chick', 'chick', '小鸡', { tags: ['livestock', 'bird', 'feathered', 'young'], sprite: 'creature:chick', stage: { lasts: GROWS_UP, into: 'actor/creature/animal/chicken' }, props: { hp: 2, maxHp: 2, atk: 0, speed: 4 }, makeup: [{ type: 'item/material/feather', count: 1 }] }),
  // the main quest's monsters (docs/main-quest.md)
  P('actor/creature/spider', 'cave spider', '洞穴蜘蛛', { tags: ['spider', 'venomous'], sprite: 'creature:spider', props: { speed: 4 } }),
  P('actor/creature/cyclops', 'cyclops', '独眼巨人', { tags: ['boss', 'large'], sprite: 'boss:cyclops', props: { speed: 9 } }),
  P('actor/creature/whelp', 'dragon whelp', '幼龙', { tags: ['fiery', 'dragon'], sprite: 'creature:whelp', props: { speed: 5, element: 'fire' } }),
  // a boss fight (bosses.ts: its kit and its phases), two cells wide and deep; its body trails behind it
  P('actor/creature/dragon', 'the dragon of Cinder Peak', '烬峰魔龙', { tags: ['boss', 'large', 'fiery', 'dragon'], sprite: 'boss:dragon', footprint: [2, 2], props: { hp: 700, maxHp: 700, atk: 7, def: 3, speed: 8, element: 'fire', range: 4 } }),
  P('actor/creature/crab', 'giant crab', '巨蟹', { tags: ['shelled', 'watery'], sprite: 'creature:crab', props: { speed: 7 } }),
]

/** What kind of crop each vegetable is (a farmer's specialty: life.ts). */
const CROP_KIND: Record<string, string> = {
  carrot: 'root', turnip: 'root', parsnip: 'root', potato: 'root', radish: 'root',
  pumpkin: 'gourd', melon: 'gourd', cauliflower: 'gourd',
  blueberry: 'berry', strawberry: 'berry',
  tomato: 'fruit', corn: 'fruit', pepper: 'fruit', eggplant: 'fruit',
}

/** A crop: sprout → young → ripe, siblings under one plant that names its yield and seed. */
function crop(id: string, en: string, zh: string, yieldType: string, young: [string, string], ripe: [string, string], ripeTags: string[] = [], tags: string[] = []): TypeDef[] {
  const base = `fixture/crop/${id}`
  return [
    F(base, en, zh, tags, { props: { yieldType, seedType: `item/seed/${id}`, growHours: cropHours(id), ...(tags.includes('perennial') && { regrowType: `${base}/young` }) } }),
    // Water starts a full stage; a dry plant waits. Irrigation supplies another stage without slowing either one.
    F(`${base}/sprout`, `${en} sprout`, `${zh}嫩芽`, ['growing'], { sprite: `fixture:${id}_sprout`, stage: { into: `${base}/young`, lasts: cropHours(id) * 600, needs: { all: [LIGHT, { has: { role: 'host', status: 'watered' } }] }, wait: 600, fx: 'leaves' } }),
    F(`${base}/young`, young[0], young[1], ['growing', 'ripening'], { sprite: `fixture:${id}_young`, stage: { into: `${base}/ripe`, lasts: cropHours(id) * 600, needs: { all: [LIGHT, { has: { role: 'host', status: 'watered' } }] }, wait: 600, fx: 'leaves' } }),
    F(`${base}/ripe`, ripe[0], ripe[1], ['ripe', ...ripeTags], { sprite: `fixture:${id}_ripe` }),
  ]
}

/** The resident hosts (design.md §5.5): the world (its clocks: the ground's yield, the weather) and the story (its facts and scenes). */
const RESIDENTS: TypeDef[] = [
  { id: 'resident', name: { en: 'the world', zh: '世界' } },
  { id: 'resident/world', name: { en: 'the world', zh: '世界' } },
  { id: 'resident/story', name: { en: 'the story', zh: '故事' } },
  // a quest under way (docs/quests.md): a resident thing whose props are its state, answering only its own rules
  { id: 'resident/quest', name: { en: 'quest', zh: '任务' } },
  // a map's named area (world-model.md §5.4): entering and leaving it is the relation in-region
  { id: 'region', name: { en: 'an area', zh: '区域' } },
  // a room: found where cells are covered and walled all round (derived, read-only, world-model.md §5.4)
  { id: 'region/room', name: { en: 'a room', zh: '房间' } },
  // a cell of the overworld, standing for its local map (world-model.md §5.1, §5.6): one cell, one
  // place; empty hands on it go in (props.map: the map it stands for)
  { id: 'site', name: { en: 'a place', zh: '地点' }, sprite: 'site', props: { handsRange: 0 } },
  { id: 'site/wild', name: { en: 'the wild', zh: '荒野' }, sprite: 'site:wild' },
  { id: 'site/place', name: { en: 'a place', zh: '地点' }, sprite: 'site:place' },
  // a hand-made place is drawn as what it is on the world map: its kind is its icon
  ...(['village', 'town', 'farm', 'mill', 'watermill', 'woods', 'hollow', 'barrow', 'mine', 'lair', 'pass', 'summit', 'shrine', 'camp', 'waystone'] as const).map((k) => ({ id: `site/place/${k}`, name: { en: 'a place', zh: '地点' }, sprite: `site:${k}` })),
  // and the kinds the other regions' places are (docs/continent.md §3): a fort, a ruin, a graveyard, a cathedral, a
  // city's quarter, a tower, a battlefield, a cave, a Seal-bearer's seat
  ...(['fort', 'ruin', 'graveyard', 'cathedral', 'city', 'tower', 'battlefield', 'cave', 'seat'] as const).map((k) => ({ id: `site/place/${k}`, name: { en: 'a place', zh: '地点' }, sprite: `site:${k}` })),
  // a place a barrier runs through (the Ford: the river): its cell is the barrier's on the world map, so one
  // goes in from the cell beside it, on the side one stands — and only through it from bank to bank
  { id: 'site/place/crossing', name: { en: 'a crossing', zh: '渡口' }, sprite: 'site:ford', props: { handsRange: 1 } },
  // what one builds (world-model.md §6.6): a thing one carries and sets down — set in a cell it takes
  // its space there (a wall the volume, a floor the floor, on the storey where it comes to rest), and
  // can be picked up again; a floor needs holding up (walls hold what is laid over them, two cells round).
  // Each is named by its form; what it is made of names the rest (planks: a Wooden Wall, 木墙)
  { id: 'structure', name: { en: 'structure', zh: '建筑件' }, tags: ['portable', 'structure', 'wooden', 'flammable'], props: { material: 'wood' } },
  { id: 'structure/wall', name: { en: 'Wall', zh: '墙' }, sprite: 'structure:wall', occupies: ['volume'], solid: true, tags: ['wall', 'opaque'], props: { maxHp: 12, hp: 12, supports: 2 }, makeup: [{ type: 'item/material/plank', count: 2 }], station: 'hands' },
  { id: 'structure/floor', name: { en: 'Floor', zh: '地板' }, sprite: 'structure:floor', occupies: ['floor'], reach: ['ground'], props: { maxHp: 8, hp: 8, needsSupport: true }, makeup: [{ type: 'item/material/plank', count: 2 }], station: 'hands' },
  // stairs: a block a storey high whose top is steps, set before what is a storey up: one walks onto
  // them (half a storey up) and on, the way they go up, onto the storey above; open overhead
  { id: 'structure/stairs', name: { en: 'Stairs', zh: '楼梯' }, sprite: 'structure:stairs', occupies: ['volume'], tags: ['stairs', 'turns'], props: { maxHp: 8, hp: 8 }, makeup: [{ type: 'item/material/plank', count: 3 }], station: 'hands' },
  // a door: shut it stops what walks, as a wall does; open, one walks through; either way it is a room's edge
  { id: 'structure/door', name: { en: 'Door', zh: '门' }, sprite: 'structure:door', occupies: ['volume'], solid: true, tags: ['door', 'opaque'], props: { maxHp: 10, hp: 10, supports: 2 }, makeup: [{ type: 'item/material/plank', count: 2 }], station: 'hands' },
  { id: 'structure/door/open', name: { en: 'Open Door', zh: '开着的门' }, sprite: 'structure:door_open', solid: false },
]

const fixtureTypes: TypeDef[] = [
  // what stands in a cell can be stood or set on, by what walks (its reach)
  F('fixture', 'thing', '物件', [], { reach: ['ground'] }),
  F('fixture/container', 'container', '容器', ['container'], { solid: true }),
  // a chest and a crate a tool knocks loose whole, as a bed (design.md §5.2): what is in them spills first
  F('fixture/container/chest', 'chest', '箱子', ['wooden', 'flammable', 'portable'], { solid: true, props: { capacity: 12, material: 'wood', maxHp: 8, hp: 8 }, makeup: [{ type: 'item/material/plank', count: 4 }] }),
  F('fixture/container/barrel', 'barrel', '木桶', ['wooden', 'flammable', 'breakable'], { solid: true, props: { capacity: 4, material: 'wood', maxHp: 1, hp: 1 }, makeup: [{ type: 'item/material/plank', count: 2 }] }),
  // the village's wood pile: the woodcutter stacks his logs on it, anyone may take them (world-model.md §6.10)
  F('fixture/container/woodpile', 'wood pile', '柴堆', ['wooden', 'flammable'], { sprite: 'fixture:firewood', solid: true, props: { capacity: 12, material: 'wood', maxHp: 6, hp: 6 }, makeup: [{ type: 'item/material/log', count: 2 }] }),
  F('fixture/container/crate', 'crate', '板条箱', ['wooden', 'flammable', 'breakable', 'portable'], { solid: true, props: { capacity: 6, material: 'wood', maxHp: 1, hp: 1 }, makeup: [{ type: 'item/material/plank', count: 2 }] }),
  F('fixture/container/pot', 'clay pot', '陶罐', ['clay', 'fragile', 'breakable'], { solid: true, props: { capacity: 2, material: 'clay', maxHp: 1, hp: 1 } }),
  F('fixture/container/wardrobe', 'wardrobe', '衣柜', ['wooden', 'flammable'], { solid: true, props: { capacity: 12, material: 'wood', maxHp: 10, hp: 10 }, makeup: [{ type: 'item/material/plank', count: 4 }] }),
  // the Held Ground's storehouse (built by its steward): forty places
  F('fixture/container/storehouse', 'storehouse', '储物棚', ['wooden', 'flammable'], { solid: true, sprite: 'fixture:wardrobe', props: { capacity: 40, material: 'wood' } }),
  // the dresser's standing mirror (dresser.ts): a hand on it opens the restyle panel
  F('fixture/furniture/mirror', 'standing mirror', '穿衣镜', ['wooden', 'glass', 'fragile'], { solid: true, props: { material: 'wood', maxHp: 4, hp: 4 }, makeup: [{ type: 'item/material/plank', count: 2 }] }),
  F('fixture/container/shelf', 'shelf', '货架', ['wooden', 'flammable'], { solid: true, props: { capacity: 8, material: 'wood', maxHp: 6, hp: 6 }, makeup: [{ type: 'item/material/plank', count: 3 }] }),
  F('fixture/container/bookshelf', 'bookshelf', '书架', ['wooden', 'flammable', 'paper'], { solid: true, props: { capacity: 8, material: 'wood', maxHp: 8, hp: 8 }, makeup: [{ type: 'item/material/plank', count: 3 }] }),
  // the showcase's furniture (docs/showcase.md §4; pictures by tools/src/art/arch/buildings/inside.ts): a library's tall case
  F('fixture/container/bookcase', 'tall bookcase', '高书柜', ['wooden', 'flammable', 'paper'], { solid: true, footprint: [2, 1], props: { capacity: 16, material: 'wood', maxHp: 12, hp: 12 }, makeup: [{ type: 'item/material/plank', count: 5 }] }),
  F('fixture/container/sack', 'sack', '麻袋', ['cloth', 'flammable'], { solid: false, props: { capacity: 4, material: 'cloth', maxHp: 3, hp: 3 }, makeup: [{ type: 'item/material/cloth', count: 1 }] }),
  F('fixture/furniture', 'furniture', '家具', ['wooden', 'flammable'], { solid: true }),
  F('fixture/furniture/table', 'table', '桌子', ['surface']),
  // what a household lives with (docs/release-1.md): a family's long table, a chest of drawers, a cupboard, a plant on the sill
  F('fixture/furniture/table/long', 'long table', '长餐桌', ['surface'], { solid: true, footprint: [3, 1], sprite: 'fixture:long_table' }),
  F('fixture/container/drawers', 'chest of drawers', '五斗柜', ['wooden', 'flammable'], { solid: true, props: { capacity: 8, material: 'wood', maxHp: 8, hp: 8 }, makeup: [{ type: 'item/material/plank', count: 3 }] }),
  F('fixture/container/cupboard', 'cupboard', '橱柜', ['wooden', 'flammable'], { solid: true, footprint: [2, 1], props: { capacity: 12, material: 'wood', maxHp: 10, hp: 10 }, makeup: [{ type: 'item/material/plank', count: 4 }] }),
  F('fixture/nature/plant', 'potted plant', '盆栽', ['plant', 'clay', 'fragile', 'breakable'], { solid: true, props: { material: 'clay', maxHp: 1, hp: 1 } }),
  F('fixture/furniture/chair', 'chair', '椅子', [], { solid: false }),
  // one lies on a bed: a hand on it reaches only from on it
  // a bed is made by hand (planks and a mattress of grass), carried, and set down where one sleeps
  F('fixture/furniture/bed', 'bed', '床', ['cloth', 'portable'], { solid: false, props: { handsRange: 0 }, makeup: [{ type: 'item/material/plank', count: 2 }, { type: 'item/material/grass', count: 2 }], station: 'hands' }),
  F('fixture/furniture/bench', 'bench', '长椅', ['surface'], { solid: false }),
  F('fixture/furniture/bench/log', 'log bench', '原木长凳', [], { solid: true, footprint: [3, 1], sprite: 'fixture:log_bench' }),
  F('fixture/furniture/rack', 'cooking rack', '炊架', ['surface']),
  // the watch's and the smith's: spears, a sword and a shield stood in a wooden rack (docs/release-1.md)
  F('fixture/furniture/rack/arms', 'weapon rack', '兵器架', ['wooden', 'flammable'], { solid: true, sprite: 'fixture:arms_rack' }),
  // the Reed Bend's fisher's (docs/chapter-1.md §15): her nets hung on a pole to dry, her fish drying on a rack
  F('fixture/furniture/rack/nets', 'drying nets', '晾网架', ['wooden', 'flammable'], { solid: true }),
  F('fixture/furniture/rack/fish', 'fish-drying rack', '晾鱼架', ['wooden', 'flammable'], { solid: true, sprite: 'fixture:fish_rack' }),
  F('fixture/furniture/counter', 'counter', '柜台', ['surface']),
  // the general store's counter, the church's bookstand: shops whose offers are recipes (village.ts)
  F('fixture/furniture/counter/store', 'general store counter', '杂货铺柜台', ['shop', 'station:store'], { sprite: 'fixture:counter' }),
  F('fixture/furniture/bookstand', 'bookstand', '教堂书架', ['paper', 'shop', 'station:books'], { sprite: 'fixture:bookshelf' }),
  F('fixture/furniture/pew', 'pew', '教堂长椅', ['surface'], { footprint: [3, 1], props: { material: 'wood', maxHp: 10, hp: 10 }, makeup: [{ type: 'item/material/plank', count: 3 }] }),
  F('fixture/furniture/desk', "copyist's desk", '抄写台', ['surface'], { props: { material: 'wood', maxHp: 6, hp: 6 }, makeup: [{ type: 'item/material/plank', count: 2 }] }),
  F('fixture/furniture/throne', 'throne', '王座', [], { props: { material: 'wood', maxHp: 14, hp: 14 }, makeup: [{ type: 'item/material/plank', count: 3 }] }),
  F('fixture/furniture/stall', 'market stall', '市集摊位', ['cloth', 'surface']),
  // a stall that trades (homestead.ts): its shelves are made at it as at a station
  F('fixture/furniture/stall/trade', 'trading stall', '货摊', ['cloth', 'surface', 'stall', 'station:stall'], { sprite: 'fixture:stall' }),
  F('fixture/furniture/washing_line', 'washing line', '晾衣绳', ['cloth', 'flammable']),
  F('fixture/furniture/cart', 'handcart', '手推车', ['surface']),
  F('fixture/furniture/cart/flowers', 'flower cart', '花车', ['plant', 'flower'], { sprite: 'fixture:flower_cart' }),
  F('fixture/light', 'light', '灯', []),
  F('fixture/light/campfire', 'campfire', '营火', ['lightable', 'cookware'], { solid: true, props: { material: 'stone', maxHp: 6, hp: 6 }, makeup: [{ type: 'item/material/stone', count: 2 }, { type: 'item/material/stick', count: 2 }] }),
  F('fixture/light/brazier', 'brazier', '火盆', ['lightable', 'metal', 'conductive', 'cookware'], { solid: true }),
  F('fixture/light/lamppost', 'lamp post', '路灯', ['lightable', 'metal', 'conductive'], { solid: true }),
  // the Holy City's lamps of black iron (docs/showcase.md §3.4)
  F('fixture/light/lamppost/street', 'street lamp', '铁艺街灯', [], { sprite: 'fixture:street_lamp' }),
  F('fixture/light/candles', 'candles', '烛台', ['lightable'], { solid: true }),
  F('fixture/light/candelabrum', 'candelabrum', '落地烛架', ['lightable', 'metal', 'conductive'], { solid: true }),
  F('fixture/light/lantern', 'lantern post', '灯笼柱', ['lightable', 'wooden', 'flammable'], { solid: true }),
  F('fixture/light/fireplace', 'fireplace', '壁炉', ['lightable', 'stone', 'cookware'], { solid: true }),
  F('fixture/water', 'water source', '水源', ['water-source', 'stone'], { solid: true }),
  F('fixture/water/well', 'well', '水井', []),
  F('fixture/water/well/square', 'well head', '井台', [], { footprint: [2, 1], sprite: 'fixture:well_head' }),
  F('fixture/water/fountain', 'fountain', '喷泉', []),
  F('fixture/water/trough', 'trough', '水槽', ['wooden']),
  // a sign is read from a step or two off
  F('fixture/sign', 'sign', '告示牌', ['wooden', 'flammable', 'readable'], { solid: true, props: { material: 'wood', maxHp: 4, hp: 4, handsRange: 2 }, makeup: [{ type: 'item/material/stick', count: 1 }, { type: 'item/material/plank', count: 1 }] }),
  F('fixture/tent', 'tent', '帐篷', ['cloth', 'flammable', 'shelter', 'opaque'], { solid: true, footprint: [3, 3] }),
  // a tent left to rot, drawn torn (the forest's pilgrims' camp: docs/release-1.md)
  F('fixture/tent/torn', 'torn tent', '破帐篷', ['cloth', 'flammable', 'shelter', 'opaque'], { solid: true, footprint: [3, 3], sprite: 'fixture:tent_torn' }),
  // the knight's own pavilion in the Held Ground, white and red, its pennant up (docs/release-1.md §7)
  F('fixture/tent/pavilion', 'pavilion', '骑士营帐', ['cloth', 'flammable', 'shelter', 'opaque'], { solid: true, footprint: [3, 3], sprite: 'fixture:pavilion' }),
  F('fixture/sign/noticeboard', 'notice board', '布告栏', ['paper']),
  // the village's board of favours (docs/quests.md §3): what people want done, to take on
  F('fixture/sign/questboard', 'commission board', '委托板', ['paper']),
  F('fixture/craft', 'workstation', '工作台', [], { solid: true }),
  // the smith's stations (content life.ts): ore smelted at a forge, ingots worked on an anvil — each opened by a hand on it
  // (its panel: `station/<x>` rules), nothing made beside it; a smith who has learned to build them (Forge Builder) can
  // raise the portable kind at home
  F('fixture/craft/anvil', 'anvil', '铁砧', ['metal', 'conductive', 'surface', 'station:anvil']),
  F('fixture/craft/anvil/smith', 'smith\'s anvil', '铁匠砧', ['portable'], { sprite: 'fixture:anvil' }),
  F('fixture/craft/forge', 'forge', '熔炉', ['stone', 'lightable', 'cookware', 'station:forge']),
  F('fixture/craft/forge/smith', 'smith\'s forge', '铁匠炉', ['portable'], { sprite: 'fixture:forge' }),
  F('fixture/craft/cauldron', 'cauldron', '坩埚', ['metal', 'conductive', 'lightable', 'cookware']),
  F('fixture/craft/loom', 'loom', '织布机', ['wooden', 'flammable', 'station:loom']),
  // the arcane workbench (the Held Ground's arcane workshop, haven.ts): wands, staves, draughts and spell books are made at
  // it (life.ts ARCANE_RECIPES), opened by a hand on it
  F('fixture/craft/arcane', 'arcane workbench', '魔法工作台', ['wooden', 'flammable', 'surface', 'arcane', 'station:arcane'], { sprite: 'fixture:altar' }),
  // a bench (world-model.md §6.4): made by hand from planks, carried, and set down where one works (as a bed is). The
  // game's own recipes are no longer its (a club, a shield, a bow are made anywhere once the Held Ground's workshop
  // stands); it stays a station for what the world learns to make at one (a hand on it opens its panel)
  F('fixture/craft/workbench', 'workbench', '工作台', ['wooden', 'flammable', 'surface', 'station:workbench', 'portable'], { makeup: [{ type: 'item/material/plank', count: 4 }], station: 'hands' }),
  F('fixture/sacred', 'sacred place', '圣所', ['stone'], { solid: true }),
  F('fixture/sacred/altar', 'altar', '祭坛', ['holy', 'surface']),
  // the Held Ground's heart: Alberic's longsword, point down in the earth (tools/src/art/planted-sword.ts)
  F('fixture/sacred/sword', 'planted sword', '插在地上的长剑', ['metal', 'conductive'], { sprite: 'fixture:planted_sword' }),
  F('fixture/sacred/statue', 'statue', '雕像', []),
  // Astra the First Martyr in bronze, the sun held up in his hands, on the squares of the Holy City (docs/lore.md §1)
  F('fixture/sacred/statue/martyr', 'statue of Astra the First Martyr', '初殉者阿斯特拉像', ['metal', 'conductive', 'holy'], { sprite: 'fixture:martyr_statue' }),
  // what a square of the Holy City is furnished with (docs/showcase.md §3.4): clipped evergreens and urns of flowers in
  // stone, balustrades along its terraces, the city's standards
  F('fixture/garden', 'garden ornament', '园饰', ['stone'], { solid: true, props: { material: 'stone', maxHp: 12, hp: 12 }, makeup: [{ type: 'item/material/stone', count: 2 }] }),
  F('fixture/garden/cypress', 'clipped cypress', '修剪柏树', ['plant']),
  F('fixture/garden/topiary', 'box topiary', '黄杨球盆', ['plant', 'clay']),
  F('fixture/garden/urn', 'urn of flowers', '石瓶花', ['plant', 'flower']),
  F('fixture/garden/balustrade', 'balustrade', '石栏杆', []),
  F('fixture/garden/bench', 'stone bench', '石凳', ['surface'], { footprint: [2, 1], sprite: 'fixture:stone_bench', props: { material: 'stone', maxHp: 20, hp: 20 }, makeup: [{ type: 'item/material/stone', count: 3 }] }),
  F('fixture/standard', 'standard', '旗杆', ['cloth', 'wooden', 'flammable'], { solid: true, props: { material: 'wood', maxHp: 6, hp: 6 }, makeup: [{ type: 'item/material/stick', count: 2 }, { type: 'item/material/cloth', count: 1 }] }),
  F('fixture/sacred/pulpit', 'pulpit', '讲道坛', ['wooden', 'flammable']),
  F('fixture/sacred/font', 'font', '洗礼池', ['holy', 'water-source']),
  F('fixture/sacred/tomb', 'tomb', '石墓', ['readable'], { footprint: [1, 2] }),
  F('fixture/sacred/sarcophagus', 'sarcophagus', '石棺', [], { footprint: [1, 2] }),
  F('fixture/sacred/reliquary', 'reliquary', '圣骨匣', ['holy', 'metal', 'conductive']),
  F('fixture/sacred/organ', 'organ', '管风琴', ['wooden', 'metal'], { footprint: [3, 1] }),
  F('fixture/sacred/altar/high', 'high altar', '主祭坛', ['stone'], { footprint: [3, 1], sprite: 'fixture:high_altar' }),
  // the lectern of brass on its stone foot, from which the lessons are read in a church or a hall
  F('fixture/sacred/lectern', 'lectern', '读经台', ['metal', 'conductive', 'surface'], { props: { material: 'metal', maxHp: 12, hp: 12 }, makeup: [{ type: 'item/material/stone', count: 1 }] }),
  F('fixture/sacred/saint', 'statue of a saint', '圣徒像', ['stone']),
  F('fixture/sacred/rail', 'altar rail', '圣坛栏杆', ['wooden'], { sprite: 'fixture:altar_rail' }),
  F('fixture/sacred/cross', 'processional cross', '十字杖架', ['holy', 'metal', 'conductive'], { sprite: 'fixture:standing_cross' }),
  F('fixture/sacred/gravestone', 'gravestone', '墓碑', ['readable']),
  // a wayside shrine of the Five Sufferings: five carved wounds, the first cracked and weeping black (docs/chapter-1.md)
  F('fixture/sacred/seal_stone', 'five-wound shrine stone', '五伤路碑', ['ancient', 'runic', 'holy']),
  F('fixture/sacred/waypoint', 'waypoint statue', '传送雕像', ['ancient', 'runic', 'waypoint']),
  // Pell's chalk drawings (docs/chapter-1.md §7): flat on the ground, read with a hand; each where the grey man was
  F('fixture/chalk', 'chalk drawing', '粉笔画', ['readable', 'chalk'], { solid: false, props: { handsRange: 1 } }),
  F('fixture/chalk/stone', 'chalk drawing of a stone', '画着石碑的粉笔画', [], { sprite: 'fixture:chalk_stone' }),
  F('fixture/chalk/door', 'chalk drawing of a door', '画着门的粉笔画', [], { sprite: 'fixture:chalk_door' }),
  F('fixture/chalk/bridge', 'chalk drawing of a bridge', '画着桥的粉笔画', [], { sprite: 'fixture:chalk_bridge' }),
  F('fixture/chalk/man', 'chalk drawing of a grey man', '画着灰衣人的粉笔画', [], { sprite: 'fixture:chalk_man' }),
  F('fixture/nature', 'natural feature', '自然物', [], { solid: true }),
  // briars: the White Knight's thorns, a hedge that stands where he set it (docs/chapter-1.md §4)
  // a bank of mist at the Held Ground's edge (haven.ts): it holds the ground in until the steward widens it
  F('fixture/nature/mist', 'bank of mist', '雾墙', ['mist'], { solid: true }),
  // the fog at a boss's door (docs/boss-rooms.md): through it one comes into the arena; sealed inside while the boss stands
  F('fixture/fog', 'wall of fog', '雾门', ['mist', 'opaque'], { solid: true, sprite: 'fixture:fog' }),
  F('fixture/nature/briar', 'briar', '荆棘丛', ['plant', 'sharp', 'thorny', 'flammable'], { props: { material: 'wood', maxHp: 6, hp: 6 }, makeup: [{ type: 'item/material/stick', count: 1 }] }),
  F('fixture/nature/boulder', 'boulder', '巨石', ['stone', 'rock', 'mineable'], { props: { material: 'stone', maxHp: 12, hp: 12 }, makeup: [{ type: 'item/material/stone', count: 8 }] }),
  // the mines' veins: a pickaxe breaks them like a boulder, into the ore they hold (half of it, as anything broken); what
  // is left is the spent face (`spent`), which grows back into the vein in a day (life.ts mine/vein, VEIN_REGROWS)
  F('fixture/nature/vein', 'ore vein', '矿脉', ['stone', 'rock', 'mineable', 'vein'], { props: { material: 'ore', maxHp: 12, hp: 12 }, makeup: [{ type: 'item/material/stone', count: 2 }] }),
  // `ore`: what a prospector gets more of (life.ts mine/vein)
  F('fixture/nature/vein/iron', 'iron vein', '铁矿脉', [], { sprite: 'fixture:vein_iron', props: { ore: 'item/material/iron_ore', spent: 'fixture/nature/spentvein/iron' }, makeup: [{ type: 'item/material/iron_ore', count: 4 }] }),
  F('fixture/nature/vein/coal', 'coal seam', '煤层', [], { sprite: 'fixture:vein_coal', props: { ore: 'item/material/coal', spent: 'fixture/nature/spentvein/coal' }, makeup: [{ type: 'item/material/coal', count: 4 }] }),
  // the deep chamber's gold (the Old Mine): what the Held Ground's boundary stones are paid in (haven.ts, widening III)
  F('fixture/nature/vein/gold', 'gold vein', '金矿脉', [], { sprite: 'fixture:vein_gold', props: { ore: 'item/material/gold_ore', spent: 'fixture/nature/spentvein/gold' }, makeup: [{ type: 'item/material/gold_ore', count: 4 }] }),
  // a vein's spent face: bedrock, with no durability of its own (nothing harms it; a blow on it is life.ts mine/spent); in a
  // day the vein is back where it was, whole (the rule heals it before it turns)
  F('fixture/nature/spentvein', 'spent vein', '挖空的矿脉', ['stone', 'rock'], { sprite: 'fixture:spentvein', props: { material: 'bedrock' } }),
  F('fixture/nature/spentvein/iron', 'spent iron vein', '挖空的铁矿脉', [], { sprite: 'fixture:spentvein', stage: { into: 'fixture/nature/vein/iron', lasts: VEIN_REGROWS, fx: 'dust' } }),
  F('fixture/nature/spentvein/coal', 'spent coal seam', '挖空的煤层', [], { sprite: 'fixture:spentvein', stage: { into: 'fixture/nature/vein/coal', lasts: VEIN_REGROWS, fx: 'dust' } }),
  F('fixture/nature/spentvein/gold', 'spent gold vein', '挖空的金矿脉', [], { sprite: 'fixture:spentvein', stage: { into: 'fixture/nature/vein/gold', lasts: VEIN_REGROWS, fx: 'dust' } }),
  F('fixture/nature/haystack', 'haystack', '干草垛', ['plant', 'flammable', 'dry']),
  F('fixture/nature/logpile', 'log pile', '柴堆', ['wooden', 'flammable']),
  F('fixture/nature/logpile/stack', 'firewood', '柴垛', [], { sprite: 'fixture:firewood' }),
  F('fixture/nature/stump', 'stump', '树墩', ['wooden', 'flammable', 'surface'], { props: { material: 'wood', maxHp: 6, hp: 6 }, makeup: [{ type: 'item/material/log', count: 2 }] }),
  // the small things of the ground: each a thing, never a picture
  F('fixture/nature/flowers', 'wildflowers', '野花', ['plant', 'flower', 'flammable'], { solid: false }),
  F('fixture/nature/reeds', 'reeds', '芦苇', ['plant', 'flammable'], { solid: false }),
  F('fixture/nature/ferns', 'ferns', '蕨草', ['plant', 'flammable'], { solid: false }),
  F('fixture/nature/tuft', 'grass tuft', '草丛', ['plant', 'flammable'], { solid: false }),
  F('fixture/nature/leaves', 'fallen leaves', '落叶', ['plant', 'dry', 'flammable'], { solid: false }),
  F('fixture/nature/pebbles', 'pebbles', '卵石', ['stone'], { solid: false }),
  F('fixture/nature/moss', 'moss', '苔藓', ['plant'], { solid: false }),
  // the soot a charcoal kiln breathes onto the ground before its mouth (the Charcoal Dell)
  F('fixture/nature/soot', 'soot', '炭灰', [], { solid: false }),
  F('fixture/nature/mushroom_ring', 'mushroom ring', '蘑菇圈', ['plant', 'fungus'], { solid: false }),
  F('fixture/nature/beehive', 'beehive', '蜂巢', ['wooden', 'flammable', 'bees']),
  // a bee box one builds (Apiarist, life.ts): honey as a wild hive gives it
  F('fixture/nature/beehive/box', 'bee box', '蜂箱', ['portable'], { sprite: 'fixture:beehive' }),
  F('fixture/nature/dead_tree', 'dead tree', '枯树', ['wooden', 'flammable', 'dry', 'tall', 'tree'], { props: { cuts: 0 } }),
  F('fixture/nature/burrow', 'slime burrow', '史莱姆洞', ['stone', 'cave'], { solid: true, footprint: [3, 3] }),
  F('fixture/ferry', 'ferry', '渡船', ['wooden', 'flammable'], { solid: true }),
  F('fixture/ferry/winch', 'ferry winch', '渡口绞盘', ['mechanism']),
  F('fixture/ferry/raft', 'ferry raft', '渡筏', ['surface']),
  // a rowboat moored at a jetty (the Reed Bend's: the boat that came home without him)
  F('fixture/boat', 'rowboat', '小船', ['wooden', 'flammable', 'surface'], { solid: true }),
  F('fixture/fence', 'fence', '栅栏', ['wooden', 'flammable', 'turns'], { solid: true, props: { material: 'wood', maxHp: 4, hp: 4 }, makeup: [{ type: 'item/material/stick', count: 2 }] }),
  F('fixture/crop', 'crop', '作物', ['crop', 'plant'], { solid: false, props: { yield: 2 } }),
  // each crop is of a kind (`crop:<kind>`): what a farmer who knows that kind gets more of (content life.ts)
  ...crop('wheat', 'wheat', '麦子', 'item/material/wheat', ['young wheat', '青麦'], ['ripe wheat', '熟麦'], ['dry', 'flammable'], ['crop:grain']),
  ...crop('herb', 'herb', '草药', 'item/material/herb', ['herb plant', '草药苗'], ['ripe herbs', '成熟的草药'], [], ['crop:herb']),
  ...crop('berry', 'berry bush', '浆果丛', 'item/food/berries', ['berry bush', '浆果丛'], ['berry bush in fruit', '结果的浆果丛'], [], ['perennial', 'crop:berry']),
  ...VEGETABLE_CROPS.flatMap((c) => crop(c.id, c.en.toLowerCase(), c.zh, `item/food/${c.id}`,
    [`young ${c.en.toLowerCase()}`, `${c.zh}幼株`], [`ripe ${c.en.toLowerCase()}`, `成熟的${c.zh}`],
    [], [...(c.perennial ? ['perennial'] : []), `crop:${CROP_KIND[c.id] ?? 'fruit'}`])),
  F('fixture/crop/oak', 'oak', '橡树', [], { props: { seedType: 'item/seed/acorn' } }),
  F('fixture/crop/oak/sapling', 'oak sapling', '橡树苗', ['sapling'], { sprite: 'fixture:oak_sapling', stage: GROWS_INTO_TREE }),
  F('fixture/build', 'unfinished work', '半成品', ['unfinished'], { solid: true }),
  F('fixture/build/frame', 'wooden frame', '木框架', ['wooden', 'flammable']),
  F('fixture/build/stakes', 'stakes', '木桩', ['wooden', 'flammable', 'turns']),
  F('fixture/build/post', 'sign post', '牌子立柱', ['wooden', 'flammable']),
  F('fixture/build/ring', 'stone ring', '石圈', ['stone']),
  // a plot staked out at the Held Ground's heart for a building the steward will build there (haven.ts HAVEN_UPGRADES)
  F('fixture/build/plot', 'staked plot', '地基', ['wooden', 'flammable'], { solid: false, sprite: 'fixture:stakes' }),
  ...([['workshop', 'workshop', '工坊'], ['kitchen', 'kitchen hearth', '厨房灶台'], ['storehouse', 'storehouse', '储物棚'], ['loom', 'weaving shed', '织坊'], ['apothecary', 'apothecary', '药房'], ['arcane', 'arcane workshop', '魔法工坊'], ['lodge1', "residents' tent", '居民营帐'], ['lodge2', "second residents' tent", '第二座居民营帐'], ['lodge3', "third residents' tent", '第三座居民营帐']] as const).map(([id, en, zh]) => F(`fixture/build/plot/${id}`, `plot for a ${en}`, `${zh}地基`, [])),
  // a training dummy: knocked down it stands up again (train/dummy), for practising blows (the tutorial's)
  F('fixture/dummy', 'training dummy', '训练假人', ['wooden', 'flammable', 'straw'], { solid: true, props: { material: 'wood', maxHp: 12, hp: 12 } }),
  F('fixture/scarecrow', 'scarecrow', '稻草人', ['straw', 'cloth', 'wooden', 'flammable'], { solid: true }),
]

/** The engine's modules this game uses (docs/engine-split.md S3). */
export const MODULES = ['classes', 'waypoints', 'boons', 'needs', 'society', 'loot', 'kits', 'fishing']

export function buildOntology(): Ontology {
  const types: Record<string, TypeDef> = {}
  for (const t of [...actorTypes, ...fixtureTypes, ...PILGRIMAGE_TYPES, ...itemTypes(), ...RESIDENTS, ...BOSS_TYPES, ...SOCIAL_TYPES, ...KIT_TYPES]) types[t.id] = t
  // each kind of monster with its own piece (trophies.ts): what it is and how often a felling gives it (rules.ts combat/defeat)
  for (const [kind, t] of Object.entries(TROPHY_OF)) types[kind] = { ...types[kind], props: { ...types[kind].props, trophy: t.type, trophyChance: t.chance } }
  // what each kind of monster is made of, so a felling leaves it (drops.ts; rules.ts combat/defeat breaks it down)
  for (const [kind, makeup] of Object.entries(CREATURE_DROPS)) types[kind] = { ...types[kind], makeup }
  // each minor kind's level and numbers, from one curve through its role (levels.ts)
  for (const [kind, stats] of Object.entries(CREATURE_STATS)) types[kind] = { ...types[kind], props: { ...types[kind].props, ...stats } }
  // how each moves in a fight: keeping back, fleeing hurt, a pack's flank (kits.ts CREATURE_TACTICS)
  for (const [kind, t] of Object.entries(CREATURE_TACTICS))
    types[kind] = { ...types[kind], ...(t.pack && { tags: [...(types[kind].tags ?? []), 'pack'] }), props: { ...types[kind].props, ...(t.keepAway && { keepAway: t.keepAway }), ...(t.fleeBelow && { fleeBelow: t.fleeBelow }) } }
  return {
    // the systems this game takes from the engine's modules (module.ts), installed in this order
    modules: MODULES,
    fishing: { maps: ['haven', 'haven.quarry', 'haven.timber', 'haven.lake', 'haven.springs'], extraType: 'item/food/fish/raw' },
    protection: {
      subjects: MINOR_SUBJECTS,
      statuses: ['burning', 'electrified', 'frozen', 'bleeding', 'poisoned', 'stunned', 'knelt', 'entranced', 'mired', 'webbed', 'down', 'out_cold', 'jailed', 'doubted', 'robbed', 'pilfered'],
      refusal: { en: 'I will not harm a child.', zh: '我不会伤害孩子。' },
    },
    types,
    statuses: Object.fromEntries([...STATUSES, ...BOON_STATUSES, ...SOCIAL_STATUSES, ...FAITH_STATUSES, ...SKILL_STATUSES].map((s) => [s.id, s])),
    // the creatures' own skills (kits.ts, docs/creatures.md), taken up by the kit goal before they fight as before
    // every monster's skills, the minor monsters' (kits.ts) and the bosses' (bosses.ts), and the boss fights that take
    // theirs up in turn (docs/skills.md)
    kits: { ...KITS, ...ELITE_KITS, ...BOSS_KITS },
    encounters: BOSS_ENCOUNTERS,
    // danger first of all (but a boss's fight): what harms one is left or put right (engine wellbeing.ts)
    goals: ['encounter', 'danger', 'rout', 'kit', 'tactics', 'threat', 'social', 'follow', 'need', 'residentWork', 'schedule', 'home', 'idle'],
    // the people's social life (docs/npc-sandbox.md): deeds and their fines, the watches, the numbers, the talk panel's verbs
    deeds: DEEDS,
    laws: LAWS,
    social: SOCIAL,
    talk: TALK,
    // who attacks whom: the wild attacks folk (when a creature's temper says so); folk attack no one
    factions: {
      folk: { name: { en: 'folk', zh: '人们' }, hostile: [] },
      wild: { name: { en: 'the wild', zh: '野物' }, hostile: ['folk'] },
    },
    terrains: Object.fromEntries(TERRAINS.map((t) => [t.id, t])),
    // the looks bodies are drawn from: bodies, parts, colours (docs/looks.md)
    looks: LOOK_TABLE,
    // the professions' names, for "only a warrior can fight with the sword" (engine/src/profession.ts)
    professions: Object.fromEntries(SKILL_PROFESSIONS.map((p) => [p.id, { name: p.name }])),
    // the lines whose crossing is an event, and the clocks (design.md §5.7)
    // every thing with durability breaks at none (world-model.md §6.3): a person goes down, a tree falls, rock breaks
    thresholds: [
      { name: 'broken', prop: 'hp', lte: 0 },
      // under six tenths of a full bar one is hungry; fed over it again, not (body/hungry)
      { name: 'hungry', prop: 'hunger', below: { prop: 'maxHunger', mul: HUNGRY_BELOW }, both: true },
    ],
    // what things are made of, and how well each instrument works on each (world-model.md §4.5, §6.1)
    materials: MATERIAL_DEFS,
    qualities: QUALITY_DEFS(),
    // the four forged sets and the monster families' sets, and what each gives worn together (sets.ts, trophies.ts)
    sets: [...GEAR_SETS, ...TROPHY_SETS],
    // the small extras a piece of gear rolls as it is made (trophies.ts)
    affixes: AFFIX_TABLE,
    // each kind of monster's own piece: sure at the fiftieth, and what the finder is told (the loot module, trophies.ts)
    loot: LOOT,
    efficiency: EFFICIENCY,
    params: { recovery: RECOVERY, safeFall: SAFE_FALL, fallDamage: FALL_DAMAGE, rainCost: RAIN_COST, storeys: STOREYS, roomSize: ROOM_SIZE, riseHour: 6, rest: 0.5, reach: 1, carry: 1, slotCount: { ring: 2 }, nightFact: 'night.shift', gearLevels: GEAR_LEVELS, restyle: { coin: 10, needs: [{ type: 'item/material/flower', count: 3 }] } },
    // what makes a room what it is: a bed a bedroom (a night there gives everything back), a cooking fire a
    // kitchen, a workbench or forge a workshop, three chests and more a storeroom (world-model.md §5.4)
    roomRoles: [
      { role: 'bedroom', needs: { type: 'fixture/furniture/bed' }, props: { rest: 1 } },
      { role: 'kitchen', needs: { tags: ['cookware'] } },
      { role: 'workshop', needs: { type: 'fixture/craft' } },
      { role: 'storeroom', needs: { type: 'fixture/container' }, count: 3 },
    ],
    periods: [
      // fed it falls fast, between meals; hungry (under six tenths) slowly, over days; asleep slower still
      { name: 'hunger', every: HUNGER_EVERY, everyProp: 'hungerEvery', paceBy: { asleep: 4, hungry: HUNGRY_PACE }, host: { type: 'actor', props: { maxHunger: { gt: 0 } } } },
      { name: 'vitals', every: HUNGER_EFFECT_EVERY, host: { type: 'actor', props: { maxHunger: { gt: 0 } } } },
      // what appears by itself: the ground's yield, creatures that come back, the night's walkers (world-model.md §6.9)
      { name: 'appear', every: APPEAR_TICK, host: 'world' },
      { name: 'weather', every: 60, host: 'world' },
      // the Held Ground's mist looks now and then whether the ground has grown past it (haven.ts)
      { name: 'mist', every: 30, host: { type: 'fixture/nature/mist' } },
      // a boss's fog looks now and then whether its boss has fallen (bossrooms.ts)
      { name: 'fog', every: FOG_EVERY, host: { type: FOG } },
      // a plot staked at the Held Ground's heart looks whether its building has been built (haven.ts)
      { name: 'plot', every: 30, host: { type: 'fixture/build/plot' } },
      { name: 'storm', every: 300, host: 'world' },
      // each morning one has one's purse again, and a merchant its stock (people/morning)
      { name: 'morning', every: TICKS_PER_DAY, host: { type: 'actor/person' } },
      // the night's walkers crumble at dawn (their own)
      { name: 'dawn', every: 5, host: { type: 'actor', tags: ['nightborn'] } },
      // the dragon's whelps, their mother slain, scatter into the dark (quest.ts, mq/whelps-scatter)
      { name: 'orphaned', every: 5, host: { type: 'actor/creature/whelp' } },
    ],
    // what appears on any map its `where` fits, besides each map's own: after dark, out in the wild,
    // the dead and the bats, a few at a time, six to ten cells off (out of sight where they come)
    appear: [
      // the small things of the ground (life.ts forage/pick: picked up, they are gone): a new patch now and then on
      // any outdoor map, a few at a time, slowly — every couple of hours, never more than a handful
      ...LITTER.map(([type, on, max]) => ({ types: { [type]: 1 }, on, max, every: LITTER_EVERY, where: { light: 'outdoor' as const } })),
      {
        types: { 'actor/creature/undead/zombie': 0.6, 'actor/creature/beast/bat': 0.4 },
        where: { zone: 'combat', light: 'outdoor' },
        night: true,
        ring: [6, 10],
        max: NIGHT_CAP,
        every: NIGHT_EVERY,
        tag: 'nightborn',
        ai: { behaviour: 'melee', temper: 'aggressive', sight: 8, leash: 14 },
      },
    ],
    elements: ELEMENTS,
    // each element's resistance: a stat in percent (a status or a worn thing may add to it), world-model.md §6.8
    resistances: { fire: 'resFire', water: 'resWater', ice: 'resIce', lightning: 'resLightning', wind: 'resWind', earth: 'resEarth' },
    vfx: [...new Set([...VFX, ...BOSSES.flatMap((b) => b.skills.flatMap((s) => s.fx ?? []))])],
    instanceTags: [
      ...new Set([
        ...Object.values(MATERIALS).flatMap((m) => [`material:${m.id}`, ...m.tags]),
        ...QUALITIES.map((q) => `quality:${q.id}`),
        ...Object.keys(ELEMENT_NAMES).map((e) => `element:${e}`),
        'locked',
        // a temporary actor-side selector used only while a resident harvests (rules.ts farm/pick)
        'resident-work-harvest',
        // a person's place in the people's life, from their record (tools/src/demo/world.ts): the watch, a trade, a fence, a hand for hire
        'watchman',
        'merchant',
        'fence',
        'hireling',
        // of the Church (people records): they take words against the gods ill (social.ts unbelief, faith.ts)
        'devout',
        // one the main story needs where they are: not asked to come and live on a home ground (social.ts residence)
        'storybound',
        // a child, under eighteen by their record's age: never robbed, stolen from or preached unbelief (social.ts)
        'minor',
      ]),
    ],
  }
}

/** What a station is called (for the crafting panel): the first kind of thing that is one (`station:<id>`). */
export function stationName(station: string): { en: string; zh: string } {
  const n = fixtureTypes.find((t) => t.tags?.includes(`station:${station}`))?.name
  return typeof n === 'object' ? { en: n.en, zh: n.zh ?? n.en } : { en: n ?? station, zh: n ?? station }
}
