// The Kingdom (docs/boss-rooms.md §4.1): the White Knight's arena, a map of its own behind his fog. Past the burned farm
// his hedge of thorns closes the East Road from edge to edge; its one gate is the fog (maps.ts `buildEastRoad`), and
// through it is his field — a sweep of dry grass ringed in his thorns, the kneeling stones of those who would not kneel
// standing round it, his mended pennants on lance-shafts, the broken shrine at its head where he keeps his post. One comes
// in at its west, sealed behind; the road goes on out of its east, sealed until he falls, back onto the East Road beyond
// his hedge. Nobody lives here and no one's day leads here: the story sets its own on the stage.

import { MapBuilder } from '../builder.ts'
import { L } from '../kit.ts'
import { woods } from './country.ts'
import { wildFloor } from '../wildfloor.ts'

export const KINGDOM = {
  w: 36,
  h: 24,
  /** the rows its ways in and out are on, the columns of its two gates (portals with the fog on them) */
  rows: [10, 11, 12] as const,
  west: 1,
  east: 34,
  /** where one comes in, a step inside the west gate */
  arrive: [3, 11] as const,
  /** his post before the broken shrine, the field's middle */
  knight: [18, 12] as const,
} as const

/** The East Road's hedge (maps.ts): the column of its gate, and where one comes back out on either side of it. */
export const HEDGE = { x: 34, west: 33, east: 36 } as const

export function buildKingdom(): MapBuilder {
  const K = KINGDOM
  const m = new MapBuilder('kingdom', L('The Kingdom of Thorns', '荆棘王国'), 'field', K.w, K.h, 'drygrass', 'kneelfield', 'outdoor', 'frostfang')
  m.gearLevel = 4
  // the field: dry grass, trodden bare in a wide ring where he has walked his round for three hundred years
  const [kx, ky] = K.knight
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const d = Math.hypot((x - kx) / 1.2, y - ky)
      if (d > 5.5 && d < 7) m.set(x, y, 'dirt')
    }
  // the road through it, west gate to east gate, worn to the ruts
  m.path([[0, 11], [K.w - 1, 11]], 'path', 2, { edge: 'dirt', edgeP: 0.1 })
  // woods round it, and his thorns inside them all round but for the gates
  const gate = (x: number, y: number) => (K.rows as readonly number[]).includes(y) && (x <= 3 || x >= K.w - 4)
  woods(m, (x, y) => gate(x, y) || Math.hypot((x - kx) / 1.35, y - ky) < 11, { depth: 2, swell: 1.5, pines: 0.4, seed: 461 })
  for (let y = 1; y < m.h - 1; y++)
    for (let x = 1; x < m.w - 1; x++) {
      const d = Math.hypot((x - kx) / 1.35, y - ky)
      // (open where the road runs through it, west and east: the way from each gate into the field)
      if (d >= 10.3 && d < 11.4 && !(K.rows as readonly number[]).includes(y) && m.get(x, y) !== 'tree' && m.get(x, y) !== 'pine') m.set(x, y, 'thornhedge')
    }
  for (const x of [0, K.w - 1]) for (const y of K.rows) m.set(x, y, 'tree')
  // the broken shrine at its head where he keeps his post: an arch left standing, its columns, a fallen saint
  m.building('ruin_arch', kx - 1, 3)
  for (const [k, x] of [[0, kx - 4], [2, kx + 4]] as const) m.building(`ruin_column_${k}`, x, 4)
  m.building('decor_statue_fallen', kx + 2, 6)
  // the gates: a portal on each cell, the fog on it (sealed while he stands); back out onto the East Road either side of his hedge
  for (const y of K.rows) {
    for (const x of [K.west, K.east]) m.set(x, y, 'path')
    m.portal(K.west, y, 'eastroad', HEDGE.west, y, L('The Sunrise Road', '朝阳大道'))
    m.portal(K.east, y, 'eastroad', HEDGE.east, y, L('The Sunrise Road', '朝阳大道'))
    for (const x of [K.west, K.east]) m.fixture('fixture/fog', x, y, { name: L("The knight's fog", '骑士的雾门'), props: { boss: 'alberic' } })
  }
  m.anchors.arrive = [K.arrive[0], K.arrive[1]]
  // his field is his kingdom: stepping into it, he speaks (quest/chapter1.ts)
  m.regions.kingdom = [3, 1, K.w - 6, K.h - 2]
  // the view draws back as one comes in, to hold the whole field and him in it
  m.vistas.push({ at: [2, 1, K.w - 4, K.h - 2], zoom: 0.75, focus: [kx, ky], share: 0.35 })
  m.sprinkle('fixture/nature/tuft', 0.05, (x, y, t) => t === 'drygrass' && Math.hypot((x - kx) / 1.35, y - ky) < 10)
  wildFloor(m, 0.6, (x, y) => Math.hypot((x - kx) / 1.35, y - ky) < 6 || gate(x, y))
  return m
}
