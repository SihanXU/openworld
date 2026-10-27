// What lies about on the ground of the first chapter's wilds (docs/release-1.md §3, the redo of 2026-10-26: the country
// round Firstlight dressed as the showcase's places are): twigs and needles under the trees, mushrooms in their shade,
// stones shed at the foot of rock, now and then bones. All of it lying decor (art/arch/buildings/chapter1.ts): drawn on
// the ground, walked over, no thing of the world's — so it witnesses nothing and asks nothing of the demo's proof. Laid
// last on a map, where nothing else lies, so what a map's own seed placed before stays where it was.

import { rng, type MapBuilder } from './builder.ts'

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
