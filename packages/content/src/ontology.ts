// Base ontology: terrains, statuses, elements, visual effects and the type tree
// for actors and fixtures. Item types come from the catalogue in items.ts.

import { FORAGE_EVERY, HUNGER_EFFECT_EVERY, HUNGER_EVERY, NIGHT_EVERY, type Ontology, type StatusDef, type TerrainDef, type TypeDef } from '@lsw/engine'
import { ELEMENT_NAMES, MATERIALS, MATERIAL_DEFS, QUALITIES, QUALITY_DEFS, itemTypes } from './items.ts'
import { VEGETABLE_CROPS } from './crops.ts'
import { BOSSES, BOSS_STATUSES, BOSS_TYPES } from './bosses.ts'

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
  // the overworld's ground (world-model.md §5.1)
  '0': 'ow_sea',
  '1': 'ow_plain',
  '2': 'ow_forest',
  '3': 'ow_hills',
  '4': 'ow_mountain',
  '5': 'ow_snow',
  '6': 'ow_road',
  '7': 'ow_river',
  u: 'stump',
  g: 'gravel',
  B: 'bridge',
  m: 'farmland',
  M: 'mud',
  V: 'void',
}
export const CHAR_OF: Record<string, string> = Object.fromEntries(Object.entries(TERRAIN_CHARS).map(([c, t]) => [t, c]))

const T = (id: string, zh: string, en: string, tags: string[], extra: Partial<TerrainDef> = {}): TerrainDef => ({
  id,
  name: { en, zh },
  tags: [...tags, ...(extra.solid ? ['solid'] : []), ...(extra.liquid ? ['liquid'] : [])],
  ...extra,
})

/** The share of what a thing is made of that it leaves when it breaks (world-model.md §6.4, D9). */
export const RECOVERY = 0.5
/** A drop of a level does no harm; each level beyond it hurts this much (world-model.md §5.5). */
export const SAFE_FALL = 1
export const FALL_DAMAGE = 6
/** Heavy weather slows a long step (world-model.md §5.6): rain, storm, snow. */
export const RAIN_COST = 1.5

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
  T('sand', '沙地', 'sand', ['ground', 'diggable'], { color: '#e3cf8f' }),
  T('snow', '雪地', 'snow', ['ground', 'cold', 'diggable'], { color: '#eef3f6' }),
  T('ice', '冰面', 'ice', ['ground', 'cold', 'frozen-water', 'slippery'], { color: '#bfe6f5' }),
  T('water', '浅水', 'water', ['water', 'water-source', 'conductive'], { solid: true, liquid: true, color: '#3d7fd6' }),
  T('deepwater', '深水', 'deep water', ['water', 'water-source', 'conductive', 'deep'], { solid: true, liquid: true, color: '#2c5fae' }),
  // what fills a cell can be broken (world-model.md §6.3): its durability, what it is made of
  T('tree', '树', 'tree', ['plant', 'tree', 'flammable', 'wooden'], { space: 'volume', solid: true, props: { material: 'wood', maxHp: 10, hp: 10 }, makeup: [{ type: 'item/material/log', count: 4 }, { type: 'item/material/stick', count: 2 }], color: '#2f6b33' }),
  T('pine', '松树', 'pine tree', ['plant', 'tree', 'flammable', 'wooden', 'cold'], { space: 'volume', solid: true, props: { material: 'wood', maxHp: 10, hp: 10 }, makeup: [{ type: 'item/material/log', count: 4 }, { type: 'item/material/stick', count: 2 }], color: '#23553a' }),
  T('bush', '灌木', 'bush', ['plant', 'flammable'], { space: 'volume', solid: true, props: { material: 'plant', maxHp: 4, hp: 4 }, makeup: [{ type: 'item/material/stick', count: 2 }], color: '#4f8f3a' }),
  T('rock', '岩石', 'rock', ['rock', 'stone', 'mineable'], { space: 'volume', solid: true, props: { material: 'stone', maxHp: 10, hp: 10 }, makeup: [{ type: 'item/material/stone', count: 2 }], color: '#7d7a74' }),
  T('wall', '石墙', 'stone wall', ['stone', 'wall'], { space: 'volume', solid: true, props: { material: 'stone', maxHp: 24, hp: 24 }, makeup: [{ type: 'item/material/stone', count: 4 }], color: '#6b6e75' }),
  T('woodwall', '木墙', 'wooden wall', ['wooden', 'wall', 'flammable'], { space: 'volume', solid: true, props: { material: 'wood', maxHp: 12, hp: 12 }, makeup: [{ type: 'item/material/plank', count: 2 }], color: '#8a5a33' }),
  T('burnt_wall', '焦黑的木墙', 'burnt wall', ['wall', 'burnt'], { space: 'volume', solid: true, props: { material: 'wood', maxHp: 4, hp: 4 }, makeup: [{ type: 'item/material/coal', count: 2 }], color: '#3a2e28' }),
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
  T('stump', '树桩', 'stump', ['wooden', 'flammable'], { space: 'soil', props: { material: 'wood', maxHp: 6, hp: 6 }, makeup: [{ type: 'item/material/log', count: 2 }], color: '#7a5a3a' }),
  T('gravel', '碎石', 'gravel', ['ground', 'stone'], { color: '#8b8680' }),
  T('bridge', '木桥', 'wooden bridge', ['wooden', 'flammable', 'road'], { color: '#a07a4a' }),
  T('farmland', '农田', 'farmland', ['ground', 'diggable', 'soil'], { color: '#7a5634' }),
  T('mud', '泥潭', 'mud', ['ground', 'wet-ground'], { color: '#5e4a33' }),
  T('void', '虚空', 'void', [], { solid: true, color: '#000000' }),
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
]

export const STATUSES: StatusDef[] = [
  { id: 'burning', name: { en: 'burning', zh: '燃烧' }, duration: 45, clears: ['frozen'], overlay: 'fire' },
  { id: 'wet', name: { en: 'wet', zh: '潮湿' }, duration: 400, clears: ['burning'], overlay: 'wet' },
  // water a line was cast into: nothing bites there until it settles
  { id: 'stirred', name: { en: 'stirred up', zh: '搅浑' }, duration: 100 },
  { id: 'frozen', name: { en: 'frozen', zh: '冰冻' }, duration: 40, clears: ['burning', 'wet'], immobilize: true, overlay: 'ice' },
  { id: 'electrified', name: { en: 'electrified', zh: '感电' }, duration: 8, immobilize: true, overlay: 'spark' },
  { id: 'oiled', name: { en: 'oiled', zh: '油污' }, duration: 900, overlay: 'oil' },
  { id: 'lit', name: { en: 'lit', zh: '点燃' }, overlay: 'flame' },
  { id: 'open', name: { en: 'open', zh: '打开' } },
  /** A waypoint stone touched: it glows, and the world map can take you to it (docs/prologue.md). */
  { id: 'attuned', name: { en: 'attuned', zh: '已共鸣' } },
  { id: 'notched', name: { en: 'notched', zh: '砍了一斧' }, duration: 100 },
  { id: 'regrowing', name: { en: 'regrowing', zh: '正在长回' }, duration: 28800 },
  { id: 'watered', name: { en: 'watered', zh: '浇过水' }, duration: 1200, overlay: 'wet' },
  { id: 'fertilized', name: { en: 'fertilized', zh: '施过肥' } },
  { id: 'rooting', name: { en: 'rooting', zh: '正在扎根' }, duration: 28800 },
  { id: 'laying', name: { en: 'laying', zh: '快下蛋了' }, duration: 1800 },
  { id: 'fireproof', name: { en: 'fireproof', zh: '防火' }, duration: 3000, clears: ['burning'], wards: ['burning'] },
  // ice that magic or a creature made: it thaws back to water
  { id: 'chilled', name: { en: 'thin ice', zh: '薄冰' }, duration: 1500 },
  // a mechanism that needs mending (the ferry winch whose rope snapped)
  { id: 'broken', name: { en: 'broken', zh: '坏了' } },
  // at no health the essential (people, the player) collapse for a while instead of dying
  { id: 'down', name: { en: 'down', zh: '倒地' }, duration: 300, immobilize: true },
  // a wound that bleeds 1 a second (Hemorrhage), and the rush of Adrenaline (the skills)
  { id: 'bleeding', name: { en: 'bleeding', zh: '流血' }, duration: 40, every: 10 },
  { id: 'adrenaline', name: { en: 'adrenaline', zh: '肾上腺素' }, duration: 50, every: 10 },
]

export const ELEMENTS = ['fire', 'water', 'ice', 'lightning', 'wind', 'earth']

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
  P('actor/person', 'person', '人', {
    tags: ['person', 'living', 'talkable', 'faction:folk', 'essential'],
    props: { hp: 20, maxHp: 20, atk: 1, def: 0, speed: 2, sight: 7 },
    sprite: 'person',
  }),
  P('actor/person/player', 'you', '你', { props: { hp: 40, maxHp: 40, atk: 2, def: 0, speed: 2, hunger: 20, maxHunger: 20 } }),
  ...PERSON_ROLES.map(([id, en, zh]) => P(`actor/person/${id}`, en, zh)),
  // the profession trainer (engine/src/profession.ts): a profession is chosen within reach of one
  P('actor/person/trainer', 'profession trainer', '职业导师', { tags: ['trainer'] }),
  P('actor/creature', 'creature', '怪物', { tags: ['creature', 'living', 'faction:wild'], props: { hp: 10, maxHp: 10, atk: 2, def: 0, speed: 6 } }),
  P('actor/creature/slime', 'slime', '史莱姆', { tags: ['slime', 'gelatinous'], sprite: 'creature:slime', props: { hp: 9, maxHp: 9, atk: 2, speed: 7 } }),
  P('actor/creature/slime/green_slime', 'green slime', '绿史莱姆', {}),
  P('actor/creature/slime/fire_slime', 'fire slime', '火焰史莱姆', { tags: ['fiery'], props: { element: 'fire', hp: 11, maxHp: 11 } }),
  P('actor/creature/slime/frost_slime', 'frost slime', '冰霜史莱姆', { tags: ['icy'], props: { element: 'ice', hp: 11, maxHp: 11 } }),
  P('actor/creature/slime/spark_slime', 'spark slime', '雷电史莱姆', { tags: ['charged'], props: { element: 'lightning', hp: 10, maxHp: 10 } }),
  P('actor/creature/slime/water_slime', 'water slime', '水史莱姆', { tags: ['watery'], props: { element: 'water', hp: 12, maxHp: 12 } }),
  P('actor/creature/slime/king_slime', 'Slime King', '史莱姆王', { tags: ['boss', 'large'], sprite: 'boss:slime', props: { hp: 50, maxHp: 50, atk: 4, def: 1, speed: 9 } }),
  P('actor/creature/beast', 'beast', '野兽', { tags: ['beast', 'furry', 'flammable'], sprite: 'creature:wolf' }),
  P('actor/creature/beast/wolf', 'wolf', '狼', { props: { hp: 14, maxHp: 14, atk: 3, speed: 4 } }),
  P('actor/creature/beast/frost_wolf', 'frost wolf', '霜狼', { tags: ['icy'], props: { element: 'ice', hp: 18, maxHp: 18, atk: 4, speed: 4 } }),
  P('actor/creature/beast/boar', 'boar', '野猪', { sprite: 'creature:boar', props: { hp: 18, maxHp: 18, atk: 4, def: 1, speed: 5 } }),
  P('actor/creature/beast/bat', 'bat', '蝙蝠', { sprite: 'creature:bat', tags: ['flying'], props: { hp: 6, maxHp: 6, atk: 2, speed: 3, stance: 'air' } }),
  P('actor/creature/undead', 'undead', '亡灵', { tags: ['undead'], sprite: 'creature:skeleton' }),
  // the night's walkers (engine/src/nightspawn.ts): slow, and gone at dawn
  P('actor/creature/undead/zombie', 'zombie', '僵尸', { tags: ['rotting'], sprite: 'creature:zombie', props: { hp: 14, maxHp: 14, atk: 3, def: 0, speed: 10 } }),
  // the Old Barrow's keeper (docs/quests.md)
  P('actor/creature/undead/warden', 'barrow warden', '古墓守卫', { tags: ['bone', 'boss'], props: { hp: 45, maxHp: 45, atk: 5, def: 1, speed: 8 } }),
  P('actor/creature/undead/skeleton', 'skeleton', '骷髅', { tags: ['bone'], props: { hp: 16, maxHp: 16, atk: 4, def: 1, speed: 6 } }),
  P('actor/creature/undead/ghost', 'ghost', '幽灵', { sprite: 'creature:ghost', tags: ['spectral'], props: { hp: 12, maxHp: 12, atk: 3, speed: 5, element: 'ice', stance: 'air' } }),
  P('actor/creature/golem', 'golem', '魔像', { tags: ['construct'], sprite: 'creature:golem' }),
  P('actor/creature/golem/stone_golem', 'stone golem', '石魔像', { tags: ['stone'], props: { hp: 30, maxHp: 30, atk: 6, def: 3, speed: 9, element: 'earth' } }),
  P('actor/creature/golem/ice_golem', 'ice golem', '冰魔像', { tags: ['icy'], props: { hp: 28, maxHp: 28, atk: 5, def: 2, speed: 9, element: 'ice' } }),
  P('actor/creature/imp', 'imp', '小恶魔', { tags: ['demon', 'fiery'], sprite: 'creature:imp' }),
  P('actor/creature/imp/fire_imp', 'fire imp', '火焰小鬼', { props: { hp: 12, maxHp: 12, atk: 3, speed: 5, element: 'fire' } }),
  P('actor/creature/wisp', 'wisp', '鬼火', { tags: ['spectral', 'charged'], sprite: 'creature:wisp', props: { stance: 'air' } }),
  P('actor/creature/wisp/storm_wisp', 'storm wisp', '风暴鬼火', { props: { hp: 9, maxHp: 9, atk: 3, speed: 4, element: 'lightning' } }),
  // companions (docs/prologue.md): they follow a leader (props.companion), fly, never block nor fight
  P('actor/companion', 'companion', '同伴', { tags: ['companion', 'living', 'airborne', 'essential'], props: { hp: 10, maxHp: 10, atk: 0, def: 0, speed: 2, sight: 8 } }),
  P('actor/companion/bird', 'bird', '鸟', { tags: ['bird', 'feathered'], sprite: 'creature:parrot' }),
  // the meadow's animals: passive, they run when struck, and leave food behind (drop × drops)
  P('actor/creature/animal', 'animal', '动物', { tags: ['animal'] }),
  P('actor/creature/animal/cow', 'cow', '牛', { tags: ['livestock', 'furry'], sprite: 'creature:cow', props: { hp: 10, maxHp: 10, atk: 0, speed: 7, drop: 'item/food/meat/raw', drops: 2 } }),
  P('actor/creature/animal/chicken', 'chicken', '鸡', { tags: ['bird', 'feathered', 'lays-eggs'], sprite: 'creature:chicken', props: { hp: 4, maxHp: 4, atk: 0, speed: 5, drop: 'item/food/chicken/raw', drops: 1 } }),
  // the main quest's monsters (docs/main-quest.md)
  P('actor/creature/spider', 'cave spider', '洞穴蜘蛛', { tags: ['spider', 'venomous'], sprite: 'creature:spider', props: { hp: 8, maxHp: 8, atk: 3, speed: 4 } }),
  P('actor/creature/cyclops', 'cyclops', '独眼巨人', { tags: ['boss', 'large'], sprite: 'boss:cyclops', props: { hp: 60, maxHp: 60, atk: 6, def: 2, speed: 9, drop: 'item/material/iron_ore', drops: 2 } }),
  P('actor/creature/whelp', 'dragon whelp', '幼龙', { tags: ['fiery', 'dragon'], sprite: 'creature:whelp', props: { hp: 14, maxHp: 14, atk: 4, speed: 5, element: 'fire' } }),
  P('actor/creature/dragon', 'the dragon of Cinder Peak', '烬峰魔龙', { tags: ['boss', 'large', 'fiery', 'dragon'], sprite: 'boss:dragon', props: { hp: 700, maxHp: 700, atk: 7, def: 3, speed: 8, element: 'fire', range: 4 } }),
  P('actor/creature/crab', 'giant crab', '巨蟹', { tags: ['shelled', 'watery'], sprite: 'creature:crab', props: { hp: 20, maxHp: 20, atk: 4, def: 3, speed: 7 } }),
]

/** A crop: sprout → young → ripe, siblings under one plant that names its yield and seed. */
function crop(id: string, en: string, zh: string, yieldType: string, young: [string, string], ripe: [string, string], ripeTags: string[] = [], tags: string[] = []): TypeDef[] {
  const base = `fixture/crop/${id}`
  return [
    F(base, en, zh, tags, { props: { yieldType, seedType: `item/seed/${id}`, ...(tags.includes('perennial') && { regrowType: `${base}/young` }) } }),
    F(`${base}/sprout`, `${en} sprout`, `${zh}嫩芽`, ['growing'], { sprite: `fixture:${id}_sprout`, props: { nextType: `${base}/young` } }),
    F(`${base}/young`, young[0], young[1], ['growing'], { sprite: `fixture:${id}_young`, props: { nextType: `${base}/ripe` } }),
    F(`${base}/ripe`, ripe[0], ripe[1], ['ripe', ...ripeTags], { sprite: `fixture:${id}_ripe` }),
  ]
}

/** The resident hosts (design.md §5.5): the world (its clocks: the ground's yield, the weather) and the story (its facts and scenes). */
const RESIDENTS: TypeDef[] = [
  { id: 'resident', name: { en: 'the world', zh: '世界' } },
  { id: 'resident/world', name: { en: 'the world', zh: '世界' } },
  { id: 'resident/story', name: { en: 'the story', zh: '故事' } },
  // a map's named area (world-model.md §5.4): entering and leaving it is the relation in-region
  { id: 'region', name: { en: 'an area', zh: '区域' } },
  // a cell of the overworld, standing for its local map (world-model.md §5.1, §5.6): it covers the
  // cell's block of the overworld; empty hands on it go in (props.map: the map it stands for)
  { id: 'site', name: { en: 'a place', zh: '地点' }, sprite: 'site', footprint: [3, 3] },
  { id: 'site/wild', name: { en: 'the wild', zh: '荒野' }, sprite: 'site:wild' },
  { id: 'site/place', name: { en: 'a place', zh: '地点' }, sprite: 'site:place' },
]

const fixtureTypes: TypeDef[] = [
  // what stands in a cell can be stood or set on, by what walks (its reach)
  F('fixture', 'thing', '物件', [], { reach: ['ground'] }),
  F('fixture/container', 'container', '容器', ['container'], { solid: true }),
  F('fixture/container/chest', 'chest', '箱子', ['wooden', 'flammable'], { solid: true, props: { capacity: 12, material: 'wood', maxHp: 8, hp: 8 }, makeup: [{ type: 'item/material/plank', count: 4 }] }),
  F('fixture/container/barrel', 'barrel', '木桶', ['wooden', 'flammable', 'breakable'], { solid: true, props: { capacity: 4, material: 'wood', maxHp: 1, hp: 1 }, makeup: [{ type: 'item/material/plank', count: 2 }] }),
  F('fixture/container/crate', 'crate', '板条箱', ['wooden', 'flammable', 'breakable'], { solid: true, props: { capacity: 6, material: 'wood', maxHp: 1, hp: 1 }, makeup: [{ type: 'item/material/plank', count: 2 }] }),
  F('fixture/container/pot', 'clay pot', '陶罐', ['clay', 'fragile', 'breakable'], { solid: true, props: { capacity: 2, material: 'clay', maxHp: 1, hp: 1 } }),
  F('fixture/container/wardrobe', 'wardrobe', '衣柜', ['wooden', 'flammable'], { solid: true, props: { capacity: 12 } }),
  F('fixture/container/shelf', 'shelf', '货架', ['wooden', 'flammable'], { solid: true, props: { capacity: 8 } }),
  F('fixture/container/bookshelf', 'bookshelf', '书架', ['wooden', 'flammable', 'paper'], { solid: true, props: { capacity: 8 } }),
  F('fixture/container/sack', 'sack', '麻袋', ['cloth', 'flammable'], { solid: false, props: { capacity: 4 } }),
  F('fixture/furniture', 'furniture', '家具', ['wooden', 'flammable'], { solid: true }),
  F('fixture/furniture/table', 'table', '桌子', ['surface']),
  F('fixture/furniture/chair', 'chair', '椅子', [], { solid: false }),
  F('fixture/furniture/bed', 'bed', '床', ['cloth'], { solid: false }),
  F('fixture/furniture/bench', 'bench', '长椅', ['surface'], { solid: false }),
  F('fixture/furniture/bench/log', 'log bench', '原木长凳', [], { solid: true, footprint: [3, 1], sprite: 'fixture:log_bench' }),
  F('fixture/furniture/rack', 'cooking rack', '炊架', ['surface']),
  F('fixture/furniture/counter', 'counter', '柜台', ['surface']),
  F('fixture/furniture/stall', 'market stall', '市集摊位', ['cloth', 'surface']),
  F('fixture/furniture/washing_line', 'washing line', '晾衣绳', ['cloth', 'flammable']),
  F('fixture/furniture/cart', 'handcart', '手推车', ['surface']),
  F('fixture/furniture/cart/flowers', 'flower cart', '花车', ['plant', 'flower'], { sprite: 'fixture:flower_cart' }),
  F('fixture/light', 'light', '灯', []),
  F('fixture/light/campfire', 'campfire', '篝火', ['lightable', 'cookware'], { solid: true, props: { material: 'stone', maxHp: 6, hp: 6 }, makeup: [{ type: 'item/material/stone', count: 2 }, { type: 'item/material/stick', count: 2 }] }),
  F('fixture/light/brazier', 'brazier', '火盆', ['lightable', 'metal', 'conductive'], { solid: true }),
  F('fixture/light/lamppost', 'lamp post', '路灯', ['lightable', 'metal', 'conductive'], { solid: true }),
  F('fixture/light/candles', 'candles', '烛台', ['lightable'], { solid: true }),
  F('fixture/light/lantern', 'lantern post', '灯笼柱', ['lightable', 'wooden', 'flammable'], { solid: true }),
  F('fixture/light/fireplace', 'fireplace', '壁炉', ['lightable', 'stone', 'cookware'], { solid: true }),
  F('fixture/water', 'water source', '水源', ['water-source', 'stone'], { solid: true }),
  F('fixture/water/well', 'well', '水井', []),
  F('fixture/water/fountain', 'fountain', '喷泉', []),
  F('fixture/water/trough', 'trough', '水槽', ['wooden']),
  F('fixture/sign', 'sign', '告示牌', ['wooden', 'flammable', 'readable'], { solid: true, props: { material: 'wood', maxHp: 4, hp: 4 }, makeup: [{ type: 'item/material/stick', count: 1 }, { type: 'item/material/plank', count: 1 }] }),
  F('fixture/tent', 'tent', '帐篷', ['cloth', 'flammable', 'shelter', 'opaque'], { solid: true, footprint: [3, 3] }),
  F('fixture/sign/noticeboard', 'notice board', '布告栏', ['paper']),
  F('fixture/craft', 'workstation', '工作台', [], { solid: true }),
  F('fixture/craft/anvil', 'anvil', '铁砧', ['metal', 'conductive', 'surface']),
  F('fixture/craft/forge', 'forge', '熔炉', ['stone', 'lightable', 'cookware']),
  F('fixture/craft/cauldron', 'cauldron', '坩埚', ['metal', 'conductive', 'cookware']),
  F('fixture/craft/loom', 'loom', '织布机', ['wooden', 'flammable']),
  // a station (world-model.md §6.4): what is made at a workbench is made beside one
  F('fixture/craft/workbench', 'workbench', '工作台', ['wooden', 'flammable', 'surface', 'station:workbench']),
  F('fixture/sacred', 'sacred place', '圣所', ['stone'], { solid: true }),
  F('fixture/sacred/altar', 'altar', '祭坛', ['holy', 'surface']),
  F('fixture/sacred/statue', 'statue', '雕像', []),
  F('fixture/sacred/gravestone', 'gravestone', '墓碑', ['readable']),
  F('fixture/sacred/seal_stone', 'seal stone', '封印石', ['ancient', 'runic']),
  F('fixture/sacred/waypoint', 'waypoint statue', '传送雕像', ['ancient', 'runic', 'waypoint']),
  F('fixture/nature', 'natural feature', '自然物', [], { solid: true }),
  F('fixture/nature/boulder', 'boulder', '巨石', ['stone', 'rock', 'mineable'], { props: { material: 'stone', maxHp: 12, hp: 12 }, makeup: [{ type: 'item/material/stone', count: 8 }] }),
  // the old mine's veins: a pickaxe breaks them like a boulder, into the ore they hold
  F('fixture/nature/vein', 'ore vein', '矿脉', ['stone', 'rock', 'mineable', 'vein'], { props: { material: 'ore', maxHp: 12, hp: 12 }, makeup: [{ type: 'item/material/stone', count: 2 }] }),
  F('fixture/nature/vein/iron', 'iron vein', '铁矿脉', [], { sprite: 'fixture:vein_iron', makeup: [{ type: 'item/material/iron_ore', count: 4 }] }),
  F('fixture/nature/vein/coal', 'coal seam', '煤层', [], { sprite: 'fixture:vein_coal', makeup: [{ type: 'item/material/coal', count: 4 }] }),
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
  F('fixture/nature/mushroom_ring', 'mushroom ring', '蘑菇圈', ['plant', 'fungus'], { solid: false }),
  F('fixture/nature/beehive', 'beehive', '蜂巢', ['wooden', 'flammable', 'bees']),
  F('fixture/nature/dead_tree', 'dead tree', '枯树', ['wooden', 'flammable', 'dry', 'tall', 'tree'], { props: { cuts: 0 } }),
  F('fixture/nature/burrow', 'slime burrow', '史莱姆洞', ['stone', 'cave'], { solid: true, footprint: [3, 3] }),
  F('fixture/ferry', 'ferry', '渡船', ['wooden', 'flammable'], { solid: true }),
  F('fixture/ferry/winch', 'ferry winch', '渡口绞盘', ['mechanism']),
  F('fixture/ferry/raft', 'ferry raft', '渡筏', ['surface']),
  F('fixture/fence', 'fence', '栅栏', ['wooden', 'flammable'], { solid: true, props: { material: 'wood', maxHp: 4, hp: 4 }, makeup: [{ type: 'item/material/stick', count: 2 }] }),
  F('fixture/crop', 'crop', '作物', ['crop', 'plant'], { solid: false, props: { yield: 2 } }),
  ...crop('wheat', 'wheat', '麦子', 'item/material/wheat', ['young wheat', '青麦'], ['ripe wheat', '熟麦'], ['dry', 'flammable']),
  ...crop('herb', 'herb', '草药', 'item/material/herb', ['herb plant', '草药苗'], ['ripe herbs', '成熟的草药']),
  ...crop('berry', 'berry bush', '浆果丛', 'item/food/berries', ['berry bush', '浆果丛'], ['berry bush in fruit', '结果的浆果丛'], [], ['perennial']),
  ...VEGETABLE_CROPS.flatMap((c) => crop(c.id, c.en.toLowerCase(), c.zh, `item/food/${c.id}`,
    [`young ${c.en.toLowerCase()}`, `${c.zh}幼株`], [`ripe ${c.en.toLowerCase()}`, `成熟的${c.zh}`],
    [], c.perennial ? ['perennial'] : [])),
  F('fixture/crop/oak', 'oak', '橡树', [], { props: { seedType: 'item/seed/acorn' } }),
  F('fixture/crop/oak/sapling', 'oak sapling', '橡树苗', ['sapling'], { sprite: 'fixture:oak_sapling' }),
  F('fixture/build', 'unfinished work', '半成品', ['unfinished'], { solid: true }),
  F('fixture/build/frame', 'wooden frame', '木框架', ['wooden', 'flammable']),
  F('fixture/build/stakes', 'stakes', '木桩', ['wooden', 'flammable']),
  F('fixture/build/post', 'sign post', '牌子立柱', ['wooden', 'flammable']),
  F('fixture/build/ring', 'stone ring', '石圈', ['stone']),
  F('fixture/dummy', 'training dummy', '训练假人', ['wooden', 'flammable', 'straw'], { solid: true }),
  F('fixture/scarecrow', 'scarecrow', '稻草人', ['straw', 'cloth', 'wooden', 'flammable'], { solid: true }),
]

export function buildOntology(): Ontology {
  const types: Record<string, TypeDef> = {}
  for (const t of [...actorTypes, ...fixtureTypes, ...itemTypes(), ...RESIDENTS, ...BOSS_TYPES]) types[t.id] = t
  return {
    types,
    statuses: Object.fromEntries([...STATUSES, ...BOSS_STATUSES].map((s) => [s.id, s])),
    // who attacks whom: the wild attacks folk (when a creature's temper says so); folk attack no one
    factions: {
      folk: { name: { en: 'folk', zh: '人们' }, hostile: [] },
      wild: { name: { en: 'the wild', zh: '野物' }, hostile: ['folk'] },
    },
    terrains: Object.fromEntries(TERRAINS.map((t) => [t.id, t])),
    // the lines whose crossing is an event, and the clocks (design.md §5.7)
    // every thing with durability breaks at none (world-model.md §6.3): a person goes down, a tree falls, rock breaks
    thresholds: [{ name: 'broken', prop: 'hp', lte: 0 }],
    // what things are made of, and how well each instrument works on each (world-model.md §4.5, §6.1)
    materials: MATERIAL_DEFS,
    qualities: QUALITY_DEFS(),
    efficiency: EFFICIENCY,
    params: { recovery: RECOVERY, safeFall: SAFE_FALL, fallDamage: FALL_DAMAGE, rainCost: RAIN_COST },
    periods: [
      { name: 'hunger', every: HUNGER_EVERY, everyProp: 'hungerEvery', host: { type: 'actor', props: { maxHunger: { gt: 0 } } } },
      { name: 'vitals', every: HUNGER_EFFECT_EVERY, host: { type: 'actor', props: { maxHunger: { gt: 0 } } } },
      { name: 'forage', every: FORAGE_EVERY, host: 'world' },
      { name: 'weather', every: 60, host: 'world' },
      { name: 'storm', every: 300, host: 'world' },
      // the night's walkers come (the world's), and crumble at dawn (their own)
      { name: 'night', every: NIGHT_EVERY, host: 'world' },
      { name: 'dawn', every: 5, host: { type: 'actor', tags: ['nightborn'] } },
    ],
    elements: ELEMENTS,
    vfx: [...VFX, ...BOSSES.flatMap((b) => b.skills.map((s) => s.fx))],
    instanceTags: [
      ...new Set([
        ...Object.values(MATERIALS).flatMap((m) => [`material:${m.id}`, ...m.tags]),
        ...QUALITIES.map((q) => `quality:${q.id}`),
        ...Object.keys(ELEMENT_NAMES).map((e) => `element:${e}`),
        'locked',
      ]),
    ],
  }
}
