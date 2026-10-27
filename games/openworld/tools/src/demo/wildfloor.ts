// What lies about on the ground of the first chapter's wilds (docs/release-1.md §3, the redo of 2026-10-26: the country
// round Firstlight dressed as the showcase's places are): twigs and needles under the trees, mushrooms in their shade,
// stones shed at the foot of rock, now and then bones. All of it lying decor (art/arch/buildings/chapter1.ts): drawn on
// the ground, walked over, no thing of the world's — so it witnesses nothing and asks nothing of the demo's proof. Laid
// last on a map, where nothing else lies, so what a map's own seed placed before stays where it was.

import { rng, type MapBuilder } from './builder.ts'
import { BUILDINGS } from '../../../client/src/catalog.ts'
import { noise } from './quest/country.ts'

const OPEN = new Set(['grass', 'drygrass', 'dirt', 'flowers', 'tussock', 'moss', 'snow', 'cave_floor'])
const BARROW = new Set(['floor_stone', 'cave_floor', 'dirt'])
const TREE = (t: string) => t === 'tree' || t === 'charred_tree'
const PINE = (t: string) => t === 'pine'
const ROCK = (t: string) => t === 'rock' || t === 'cave_wall' || t === 'cliff'

/**
 * The wild floor over a rect of a map (the whole map unless given), its density `p` (1 the usual), `keep` the cells left
 * bare (a lesson's ground, a scene's stage); a barrow's (`sort`) its bones, its fallen stones and its cracked flags.
 */
export function wildFloor(m: MapBuilder, p = 1, keep: (x: number, y: number) => boolean = () => false, rect: [number, number, number, number] = [0, 0, m.w, m.h], sort: 'wild' | 'barrow' = 'wild'): void {
  const taken = new Set<string>()
  for (const e of m.entities) if (e.place.on === 'tile') taken.add(`${e.place.x},${e.place.y}`)
  for (const s of m.stamps) taken.add(`${s.x},${s.y}`)
  const [x0, y0, w, h] = rect
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const t = m.get(x, y)
      if (sort === 'barrow') {
        // a barrow's floor: bones where the dead were laid along the walls, stones fallen from the vault, cracked flags
        if (!BARROW.has(t) || taken.has(`${x},${y}`) || keep(x, y) || !m.walkable(x, y)) continue
        const wall = m.near(x, y, (u) => u === 'wall' || ROCK(u))
        const pick: [string, number][] = [['decor_bones', wall ? 0.05 : 0.012], ['decor_stones', wall ? 0.04 : 0.01], ['decor_cracks_0', 0.02]]
        for (const [name, chance] of pick)
          if (rng.chance(chance * p)) {
            m.building(name, x, y)
            taken.add(`${x},${y}`)
            break
          }
        continue
      }
      if (!OPEN.has(t) || taken.has(`${x},${y}`) || keep(x, y) || !m.walkable(x, y)) continue
      const pine = m.near(x, y, PINE)
      const tree = m.near(x, y, TREE)
      const rock = m.near(x, y, ROCK)
      const pick: [string, number][] = [
        ['decor_needles', pine ? 0.1 : 0],
        ['decor_twigs', tree || pine ? 0.035 : 0.004],
        ['decor_mushrooms', tree ? 0.02 : 0],
        ['decor_stones', rock ? 0.08 : t === 'dirt' ? 0.015 : 0.005],
        ['decor_bones', 0.0012],
      ]
      for (const [name, chance] of pick)
        if (chance && rng.chance(chance * p)) {
          m.building(name, x, y)
          taken.add(`${x},${y}`)
          break
        }
    }
}

const KEPT = new Set(['path', 'water', 'deepwater', 'bridge', 'door', 'ice', 'cobble', 'flags'])

/**
 * One of the ruin's pieces stood on a map (the prologue's way down, docs/release-1.md §4b): as `MapBuilder.building`, but
 * a piece that would wall a way, the water, a door or a thing the map already holds throws, so no ruin ever stands on
 * what the story keeps. Laid after what a map's seed placed, before what lies about.
 */
export function ruin(m: MapBuilder, name: string, x: number, y: number): void {
  const b = BUILDINGS[name]
  if (!b) throw new Error(`ruin ${name} not in the catalog`)
  const before = new Map<string, string>()
  for (let j = y; j < y + b.d; j++) for (let i = x; i < x + b.w; i++) before.set(`${i},${j}`, m.get(i, j))
  m.building(name, x, y)
  for (const [k, t] of before) {
    const [i, j] = k.split(',').map(Number)
    if (m.get(i, j) === t && m.passable(i, j)) continue
    if (KEPT.has(t)) throw new Error(`${m.id}: ${name} at ${x},${y} walls the ${t} at ${i},${j}`)
    const e = m.entities.find((e) => e.place.on === 'tile' && e.place.x === i && e.place.y === j)
    if (e) throw new Error(`${m.id}: ${name} at ${x},${y} stands on ${e.type} at ${i},${j}`)
  }
}

/** Petals blown from the flowers onto the grass round them, and fallen leaves at the woods' edge (lying decor, as above). */
export function bloom(m: MapBuilder, p = 1, keep: (x: number, y: number) => boolean = () => false): void {
  const taken = new Set<string>()
  for (const e of m.entities) if (e.place.on === 'tile') taken.add(`${e.place.x},${e.place.y}`)
  for (const s of m.stamps) taken.add(`${s.x},${s.y}`)
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const t = m.get(x, y)
      if ((t !== 'grass' && t !== 'drygrass') || taken.has(`${x},${y}`) || keep(x, y) || !m.walkable(x, y)) continue
      const k = Math.floor(rng.next() * 3)
      if (m.near(x, y, (u) => u === 'flowers') && rng.chance(0.08 * p)) m.building(`decor_petals_${k}`, x, y)
      else if (m.near(x, y, (u) => u === 'tree') && rng.chance(0.04 * p)) m.building(`decor_leaves_${k}`, x, y)
    }
}

/**
 * The ground of the wilds less even (as quest/country.ts lays Part One's road east): grass gone to dry grass where soft
 * noise rises, to bare earth where it falls, on the cells `where` allows and nothing stands on. Laid after what a map's
 * seed placed, so nothing before it moves.
 */
export function rough(m: MapBuilder, seed: number, where: (x: number, y: number) => boolean): void {
  const held = new Set<string>()
  for (const e of m.entities) if (e.place.on === 'tile') held.add(`${e.place.x},${e.place.y}`)
  const open = (x: number, y: number) => m.get(x, y) === 'grass' && !held.has(`${x},${y}`) && where(x, y)
  // (bare earth only in patches: a cell of it alone draws as a square)
  const bare = (x: number, y: number) => open(x, y) && noise(x, y, 4, seed) < 0.14 && !m.near(x, y, (t) => t === 'water')
  const dirt: [number, number][] = []
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (!open(x, y)) continue
      if (noise(x, y, 4, seed) > 0.66) m.set(x, y, 'drygrass')
      else if (bare(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => bare(x + dx, y + dy)).length >= 3) dirt.push([x, y])
    }
  for (const [x, y] of dirt) m.set(x, y, 'dirt')
}
