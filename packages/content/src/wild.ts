// The wilderness (world-model.md §5.7): every overworld cell without a hand-made map is a map made
// from the world's seed and the cell, by a recipe for its ground — the same seed and cell always
// give the same map, so only what changed there is kept (D20). Its edges are open: whichever way
// one walks out, one is back on the overworld (§5.1).

import { Rng, type AiData, type Entity, type MapChunk, type MapData, type Text, type World } from '@lsw/engine'

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
  const site = cell && Object.values(w.state.entities).find((e) => e.type.startsWith('site') && e.props?.map === id)
  if (!cell || !site || site.place.on !== 'tile') return undefined
  const size = w.onto.resolve(site.type).footprint[0]
  const ground = String(site.props?.ground ?? 'ow_plain')
  return wildChunk(w.state.seed, cell.cx, cell.cy, ground, { map: site.place.map, x: site.place.x - Math.floor((size - 1) / 2), y: site.place.y - (size - 1), size })
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
}

/** The grounds a wilderness can be made for (the overworld's passable ground). */
export const WILD_GROUNDS = Object.keys(RECIPES)

/**
 * A wilderness map for overworld cell (cx, cy), whose ground is `ground` (an overworld terrain),
 * lying at `site` on the overworld. Deterministic: the world's seed and the cell decide everything.
 */
export function wildChunk(seed: number, cx: number, cy: number, ground: string, site: MapData['site']): MapChunk {
  const r = RECIPES[ground] ?? RECIPES.ow_plain
  const rng = new Rng(cellSeed(seed, cx, cy))
  const id = wildId(cx, cy)
  const terrain: string[] = new Array(WILD_W * WILD_H).fill(r.ground)
  const at = (x: number, y: number) => y * WILD_W + x
  for (const [t, n, size] of r.patches)
    for (let k = 0; k < n; k++) {
      const px = rng.int(2, WILD_W - 3)
      const py = rng.int(2, WILD_H - 3)
      for (let y = py - size; y <= py + size; y++)
        for (let x = px - size; x <= px + size; x++)
          if (x >= 0 && y >= 0 && x < WILD_W && y < WILD_H && Math.hypot(x - px, y - py) <= size + rng.next() - 0.5) terrain[at(x, y)] = t
    }
  // a road runs across a road's cell, west to east
  if (ground === 'ow_road') {
    let y = Math.floor(WILD_H / 2)
    for (let x = 0; x < WILD_W; x++) {
      for (const dy of [0, 1]) terrain[at(x, y + dy)] = 'path'
      if (rng.chance(0.2)) y = Math.max(3, Math.min(WILD_H - 5, y + (rng.chance(0.5) ? 1 : -1)))
    }
  }
  const open = (x: number, y: number) => !['tree', 'pine', 'bush', 'rock', 'water', 'ice', 'path'].includes(terrain[at(x, y)])
  // what grows: never in the middle, where one comes in from where one stood
  for (let y = 0; y < WILD_H; y++)
    for (let x = 0; x < WILD_W; x++) {
      if (!open(x, y) || Math.hypot(x - WILD_W / 2, y - WILD_H / 2) < 3) continue
      for (const [t, p] of r.growth) if (rng.chance(p)) (terrain[at(x, y)] = t)
    }
  const entities: Entity[] = []
  let n = 0
  const spot = (): [number, number] | undefined => {
    for (let tries = 0; tries < 40; tries++) {
      const x = rng.int(2, WILD_W - 3)
      const y = rng.int(2, WILD_H - 3)
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
    kind: 'wild',
    width: WILD_W,
    height: WILD_H,
    terrain,
    portals: [],
    light: 'outdoor',
    zone: 'combat',
    site,
    forage: [
      { type: 'item/material/stick', on: ['grass', 'snow'], max: 4 },
      { type: 'item/material/stone', on: ['grass', 'snow'], max: 3 },
      { type: 'item/material/grass', on: ['grass', 'drygrass'], max: 4 },
    ],
  }
  return { map, entities }
}
