// The wilderness (world-model.md §5.7): every overworld cell without a hand-made map is a map made
// from the world's seed and the cell, by a recipe for its ground — the same seed and cell always
// give the same map, so only what changed there is kept (D20). Its edges are open: whichever way
// one walks out, one is back on the overworld (§5.1).

import { APPEAR_EVERY, Rng, type AiData, type Entity, type MapChunk, type MapData, type Text, type World } from '@openworld/engine'

export const WILD_W = 40
export const WILD_H = 30

/** A wilderness map's id: its overworld cell. */
export const wildId = (cx: number, cy: number): string => `wild.${cx}.${cy}`

/** The cell a wilderness map's id names, if it is one. */
export function wildCell(id: string): { cx: number; cy: number } | undefined {
  const m = /^wild\.(-?\d+)\.(-?\d+)$/.exec(id)
  return m ? { cx: +m[1], cy: +m[2] } : undefined
}

/**
 * The wilderness map `id`, made from what the world holds: its site on the overworld (its ground,
 * its block) and the world's seed. Undefined when `id` is not a wilderness's or no site names it.
 */
export function wildChunkFor(w: World, id: string): MapChunk | undefined {
  const cell = wildCell(id)
  const site = cell && w.withProp('map', id).find((e) => e.type.startsWith('site'))
  if (!cell || !site || site.place.on !== 'tile') return undefined
  const size = w.onto.resolve(site.type).footprint[0]
  const ground = String(site.props?.ground ?? 'ow_plain')
  const region = typeof site.props?.region === 'string' ? site.props.region : undefined
  return wildChunk(w.state.seed, cell.cx, cell.cy, ground, { map: site.place.map, x: site.place.x - Math.floor((size - 1) / 2), y: site.place.y - (size - 1), size }, region)
}

/** A number from the world's seed and a cell (and a salt): the cell's own randomness. */
function cellSeed(seed: number, cx: number, cy: number, salt = 0): number {
  let h = (seed ^ 0x9e3779b9) >>> 0
  for (const v of [cx, cy, salt]) h = Math.imul(h ^ (v + 0x7f4a7c15), 0x85ebca6b) >>> 0
  return h ^ (h >>> 13)
}

interface Recipe {
  name: Text
  ground: string
  /** The ground's patches: a terrain, how many, how big. */
  patches: [string, number, number][]
  /** What stands on it, by chance per cell. */
  growth: [string, number][]
  creatures: [string, number][]
  items: [string, number][]
}

const SLIME: Omit<AiData, 'home'> = { behaviour: 'melee', temper: 'aggressive', sight: 4, leash: 6 }
const SHY: Omit<AiData, 'home'> = { behaviour: 'melee', temper: 'wary', sight: 5, leash: 8 }

/** A recipe for each ground of the overworld. */
const RECIPES: Record<string, Recipe> = {
  ow_plain: {
    name: { en: 'Open Plains', zh: '开阔平原' },
    ground: 'grass',
    patches: [['flowers', 4, 3], ['drygrass', 3, 4]],
    growth: [['tree', 0.03], ['bush', 0.015], ['rock', 0.008]],
    creatures: [['actor/creature/slime/green_slime', 2], ['actor/creature/animal/chicken', 1]],
    items: [['item/food/berries', 3], ['item/material/stick', 3], ['item/material/stone', 2]],
  },
  ow_forest: {
    name: { en: 'Deep Woods', zh: '幽深林地' },
    ground: 'grass',
    patches: [['flowers', 2, 2]],
    growth: [['tree', 0.2], ['pine', 0.06], ['bush', 0.04]],
    creatures: [['actor/creature/beast/boar', 1], ['actor/creature/slime/green_slime', 1]],
    items: [['item/food/mushroom/raw', 4], ['item/material/stick', 4]],
  },
  ow_hills: {
    name: { en: 'Rolling Hills', zh: '起伏丘陵' },
    ground: 'grass',
    patches: [['drygrass', 5, 4], ['gravel', 2, 2]],
    growth: [['rock', 0.05], ['bush', 0.02], ['tree', 0.015]],
    creatures: [['actor/creature/beast/wolf', 1], ['actor/creature/slime/green_slime', 1]],
    items: [['item/material/stone', 4], ['item/material/herb', 2]],
  },
  ow_snow: {
    name: { en: 'Snowfield', zh: '雪原' },
    ground: 'snow',
    patches: [['ice', 1, 2]],
    growth: [['pine', 0.08], ['rock', 0.02]],
    creatures: [['actor/creature/beast/frost_wolf', 1], ['actor/creature/slime/frost_slime', 1]],
    items: [['item/material/stone', 2], ['item/material/stick', 2]],
  },
  ow_road: {
    name: { en: 'The Road', zh: '大道' },
    ground: 'grass',
    patches: [['flowers', 2, 3]],
    growth: [['tree', 0.02], ['bush', 0.01]],
    creatures: [['actor/creature/slime/green_slime', 1]],
    items: [['item/material/stick', 2]],
  },
  // the other regions' grounds (docs/continent.md §2)
  ow_steppe: {
    name: { en: 'Open Steppe', zh: '开阔草原' },
    ground: 'drygrass',
    patches: [['grass', 3, 3], ['dirt', 2, 2]],
    growth: [['bush', 0.012], ['rock', 0.01]],
    creatures: [['actor/creature/beast/wolf', 2], ['actor/creature/beast/boar', 1]],
    items: [['item/material/herb', 2], ['item/material/stick', 2]],
  },
  ow_badlands: {
    name: { en: 'Red Badlands', zh: '赤岩荒原' },
    ground: 'dirt',
    patches: [['sand', 4, 4], ['gravel', 3, 3], ['ash', 2, 2]],
    growth: [['rock', 0.07], ['charred_tree', 0.012]],
    creatures: [['actor/creature/imp/fire_imp', 1], ['actor/creature/slime/fire_slime', 2]],
    items: [['item/material/stone', 4], ['item/material/coal', 1]],
  },
  ow_fields: {
    name: { en: 'Barren Fields', zh: '荒芜田野' },
    ground: 'drygrass',
    patches: [['farmland', 5, 4], ['dirt', 2, 3]],
    growth: [['stump', 0.01], ['bush', 0.01], ['tree', 0.008]],
    creatures: [['actor/creature/animal/chicken', 1], ['actor/creature/slime/green_slime', 1]],
    items: [['item/material/grass', 3], ['item/material/stick', 2]],
  },
  ow_dust: {
    name: { en: 'Dust Plain', zh: '尘原' },
    ground: 'sand',
    patches: [['dirt', 4, 4], ['gravel', 2, 3]],
    growth: [['rock', 0.025], ['charred_tree', 0.008]],
    creatures: [['actor/creature/spider', 2], ['actor/creature/slime/fire_slime', 1]],
    items: [['item/material/stone', 3]],
  },
  ow_salt: {
    name: { en: 'Salt Flat', zh: '盐滩' },
    ground: 'sand',
    patches: [['snow', 6, 4], ['water', 2, 2]],
    growth: [['rock', 0.01]],
    creatures: [['actor/creature/crab', 2], ['actor/creature/slime/water_slime', 1]],
    items: [['item/material/stone', 2]],
  },
  ow_marsh: {
    name: { en: 'Marsh', zh: '沼泽' },
    ground: 'mud',
    patches: [['water', 7, 3], ['grass', 3, 3], ['drygrass', 2, 2]],
    growth: [['charred_tree', 0.025], ['bush', 0.02]],
    creatures: [['actor/creature/slime/water_slime', 2], ['actor/creature/undead/zombie', 1]],
    items: [['item/food/mushroom/raw', 3], ['item/material/grass', 2]],
  },
  ow_deadwood: {
    name: { en: 'Dead Wood', zh: '死林' },
    ground: 'drygrass',
    patches: [['mud', 3, 3], ['ash', 2, 2]],
    growth: [['charred_tree', 0.16], ['stump', 0.02], ['bush', 0.01]],
    creatures: [['actor/creature/undead/skeleton', 1], ['actor/creature/beast/bat', 2]],
    items: [['item/material/stick', 4], ['item/food/mushroom/raw', 2]],
  },
  ow_highland: {
    name: { en: 'White Highland', zh: '白石高原' },
    ground: 'gravel',
    patches: [['grass', 4, 3], ['snow', 2, 2]],
    growth: [['rock', 0.06], ['pine', 0.02]],
    creatures: [['actor/creature/golem/stone_golem', 1], ['actor/creature/wisp/storm_wisp', 1]],
    items: [['item/material/stone', 4], ['item/material/herb', 1]],
  },
  ow_city: {
    name: { en: 'City Outskirts', zh: '城郊' },
    ground: 'grass',
    patches: [['cobble', 3, 3], ['flowers', 2, 2]],
    growth: [['tree', 0.012], ['bush', 0.01]],
    creatures: [['actor/creature/animal/chicken', 2]],
    items: [['item/material/stick', 1]],
  },
  ow_bridge: {
    name: { en: 'The Bridge', zh: '过河桥' },
    ground: 'grass',
    patches: [['flowers', 1, 2]],
    growth: [['tree', 0.02], ['bush', 0.01]],
    creatures: [['actor/creature/slime/water_slime', 1]],
    items: [['item/material/stick', 2]],
  },
}

/**
 * A region's own wild on a ground it shares with others (docs/continent.md §2): the Fens' woods are dead, the
 * Heights' plains are stony, the Holy City's are gardens; the March's hills are red. The rest is the ground's.
 */
const REGIONAL: Record<string, Partial<Recipe>> = {
  'palefen:ow_forest': { name: { en: 'Grey Woods', zh: '灰林' }, growth: [['tree', 0.12], ['charred_tree', 0.06], ['bush', 0.03]], creatures: [['actor/creature/undead/ghost', 1], ['actor/creature/beast/bat', 1]] },
  'palefen:ow_plain': { name: { en: 'Fen Meadow', zh: '沼边草地' }, patches: [['mud', 4, 3], ['water', 3, 2]], creatures: [['actor/creature/undead/zombie', 1], ['actor/creature/slime/water_slime', 1]] },
  'altar:ow_plain': { name: { en: 'Stony Pasture', zh: '石原牧地' }, patches: [['gravel', 4, 3], ['flowers', 2, 2]], growth: [['rock', 0.03], ['bush', 0.01]] },
  'altar:ow_forest': { name: { en: 'Highland Pines', zh: '高地松林' }, growth: [['pine', 0.18], ['rock', 0.03]] },
  'holy:ow_plain': { name: { en: 'Pilgrim Meadows', zh: '朝圣草地' }, patches: [['flowers', 5, 3], ['farmland', 2, 3]], creatures: [['actor/creature/animal/chicken', 1], ['actor/creature/animal/cow', 1]] },
  'redmarch:ow_hills': { name: { en: 'Red Hills', zh: '赤色丘陵' }, ground: 'dirt', patches: [['gravel', 4, 3], ['drygrass', 3, 3]], creatures: [['actor/creature/beast/wolf', 2]] },
  'tithe:ow_plain': { name: { en: 'Thin Grassland', zh: '稀疏草地' }, ground: 'drygrass', patches: [['dirt', 3, 3], ['farmland', 2, 3]] },
}

/** The grounds a wilderness can be made for (the overworld's passable ground). */
export const WILD_GROUNDS = Object.keys(RECIPES)

/**
 * A wilderness map for overworld cell (cx, cy), whose ground is `ground` (an overworld terrain),
 * lying at `site` on the overworld. Deterministic: the world's seed and the cell decide everything.
 */
export function wildChunk(seed: number, cx: number, cy: number, ground: string, site: MapData['site'], region?: string, size: { w: number; h: number } = { w: WILD_W, h: WILD_H }): MapChunk {
  const { w: W, h: H } = size
  const r: Recipe = { ...(RECIPES[ground] ?? RECIPES.ow_plain), ...(region ? REGIONAL[`${region}:${ground}`] : undefined) }
  const rng = new Rng(cellSeed(seed, cx, cy))
  const id = wildId(cx, cy)
  const terrain: string[] = new Array(W * H).fill(r.ground)
  const at = (x: number, y: number) => y * W + x
  for (const [t, n, size] of r.patches)
    for (let k = 0; k < n; k++) {
      const px = rng.int(2, W - 3)
      const py = rng.int(2, H - 3)
      for (let y = py - size; y <= py + size; y++)
        for (let x = px - size; x <= px + size; x++)
          if (x >= 0 && y >= 0 && x < W && y < H && Math.hypot(x - px, y - py) <= size + rng.next() - 0.5) terrain[at(x, y)] = t
    }
  // a river runs down a bridge's cell, north to south, and the road crosses it on planks
  const river = ground === 'ow_bridge' ? rng.int(14, W - 18) : -1
  if (river >= 0)
    for (let y = 0; y < H; y++) for (let x = river; x < river + 3; x++) terrain[at(x + (y % 9 < 4 ? 0 : 1), y)] = 'water'
  // a road runs across a road's cell (and a bridge's), west to east
  if (ground === 'ow_road' || ground === 'ow_bridge') {
    let y = Math.floor(H / 2)
    for (let x = 0; x < W; x++) {
      for (const dy of [0, 1]) terrain[at(x, y + dy)] = terrain[at(x, y + dy)] === 'water' ? 'bridge' : 'path'
      if (rng.chance(0.2) && Math.abs(x - river) > 5) y = Math.max(3, Math.min(H - 5, y + (rng.chance(0.5) ? 1 : -1)))
    }
  }
  const open = (x: number, y: number) => !['tree', 'pine', 'bush', 'rock', 'water', 'ice', 'path', 'bridge', 'charred_tree', 'stump'].includes(terrain[at(x, y)])
  // what grows: never in the middle, where one comes in from where one stood
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!open(x, y) || Math.hypot(x - W / 2, y - H / 2) < 3) continue
      for (const [t, p] of r.growth) if (rng.chance(p)) (terrain[at(x, y)] = t)
    }
  const entities: Entity[] = []
  let n = 0
  const spot = (): [number, number] | undefined => {
    for (let tries = 0; tries < 40; tries++) {
      const x = rng.int(2, W - 3)
      const y = rng.int(2, H - 3)
      if (open(x, y) && !entities.some((e) => e.place.on === 'tile' && e.place.x === x && e.place.y === y)) return [x, y]
    }
    return undefined
  }
  for (const [type, count] of r.items)
    for (let k = 0; k < count; k++) {
      const s = spot()
      if (s) entities.push({ id: `${id}~${n++}`, type, place: { on: 'tile', map: id, x: s[0], y: s[1] } })
    }
  for (const [type, count] of r.creatures)
    for (let k = 0; k < count; k++) {
      const s = spot()
      if (!s) continue
      const ai = type.includes('/animal/') ? SHY : SLIME
      entities.push({ id: `${id}~${n++}`, type, facing: 'down', place: { on: 'tile', map: id, x: s[0], y: s[1] }, ai: { ...structuredClone(ai), home: { map: id, x: s[0], y: s[1] } } })
    }
  const map: MapData = {
    id,
    name: r.name,
    ...(region && { region }),
    kind: 'wild',
    width: W,
    height: H,
    terrain,
    portals: [],
    light: 'outdoor',
    zone: 'combat',
    site,
    appear: [
      { types: { 'item/material/stick': 1 }, on: ['grass', 'snow', 'drygrass', 'mud'], max: 4, every: APPEAR_EVERY },
      { types: { 'item/material/stone': 1 }, on: ['grass', 'snow', 'dirt', 'sand', 'gravel'], max: 3, every: APPEAR_EVERY },
      { types: { 'item/material/grass': 1 }, on: ['grass', 'drygrass'], max: 4, every: APPEAR_EVERY },
    ],
  }
  return { map, entities }
}
