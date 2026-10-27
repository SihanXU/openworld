// The first chapter's own buildings outside Firstlight (docs/release-1.md §3, the redo of 2026-10-26: the country round
// the village drawn as the showcase's places are): the hunter's cabin at the Mountain Foot, Tam's watermill at
// Millbrook, the ruined Chapel of the First Dawn on Dawn Hill's crown, Orrin's hut in the Charcoal Dell and Hilde's
// cabin at the Reed Bend. Each stands where the pack's house stood, its door on the very cell the story keeps it, its
// walls of what the house is built of (wood burns: the hunter's cabin is the burning wall of W13). And what lies on
// the ground of the wilds round them: twigs, stones, mushrooms, pine needles, a fern.

import type { Model, Ornament } from '../oblique.ts'
import { archNS, backOf, box, doorSlab, gable, recess, type Solid } from '../shapes.ts'
import { bird, door, ivy, lancet, moss, stains } from '../ornaments.ts'
import { house, S, type HouseOpts2 } from '../kit.ts'

/** A house of the country: one storey under its roof unless told, its walls of wood (they burn) unless of stone. */
const wooden = (o: Omit<HouseOpts2, 'upper' | 'timber'> & { upper?: number; timber?: boolean }, terrain = 'woodwall'): Model => ({ ...house({ upper: 0, timber: false, ...o }), terrain })

/**
 * The Chapel of the First Dawn: a small chapel of grey stone gone to moss, its slate roof sagging, a bell-cote over the
 * door at its west end with one arch empty (its bell is inside, rung that morning), a lancet down its side, ivy over the
 * east end; its door in the second cell, as the old temple's was.
 */
function dawnChapel(): Model {
  const w = 5
  const d = 3
  const W = w * S
  const D = d * S
  // (low: it stands at the map's head, and its roof must stay on the map)
  const H = 34
  const solids: Solid[] = [box(0, 0, 0, W, D, H, 'stone'), gable(-3, -3, W + 3, D + 3, H, 20, 'x', 'slate', 'stone')]
  const dx = 1.5 * S
  // the bell-cote over the door, both arches empty against the sky
  solids.push(box(dx - 11, D - 8, 0, dx + 11, D, H + 24, 'stone'), gable(dx - 13, D - 10, dx + 13, D + 1, H + 24, 8, 'y', 'slate', 'stone'))
  const voids: Solid[] = [archNS(dx - 5, D - 9, D + 1, H + 6, 6, 13, 'round'), archNS(dx + 5, D - 9, D + 1, H + 6, 6, 13, 'round')]
  const orn: Ornament[] = []
  voids.push(...recess(dx, D, 0, 14, 26, 4, 'pointed', 2, 2))
  solids.push(doorSlab(dx, backOf(D, 4), 0, 10, 22, 'pointed'))
  orn.push(door(10, 22, 'pointed', 'g').at(dx - 5, backOf(D, 4) - 1, 0))
  // a lancet in the nave's side, a buttress either side of it
  const lx = 3.4 * S
  voids.push(...recess(lx, D, 11, 8, 18, 3, 'pointed'))
  orn.push(lancet(6, 16, 'blue', 1).at(lx - 3, backOf(D, 3), 12))
  for (const x of [2.6 * S, 4.4 * S]) solids.push(box(x - 3, D, 0, x + 3, D + 4, 28, 'stone'))
  // what the years left: stains up from the ground, moss in the courses, ivy over its east end, a bird on the ridge
  orn.push(stains(W, 20, 'g', 7).at(0, D, 0), moss(18, 4, 3).at(3 * S, D, 0), moss(12, 3, 5).at(0, D, 24), ivy(26, 34, 9).at(W - 28, D, 0), bird(true, 2).at(W - 18, D / 2, H + 18, true))
  const fp = Array.from({ length: d }, () => '#'.repeat(w).split(''))
  fp[d - 1][1] = 'D'
  return { name: 'dh_chapel', footprint: fp.map((r) => r.join('')), solids, voids, ornaments: orn }
}

/** A flat thing on the ground (nothing stands: walked over), drawn a row a line, its top at the cell's top. */
const lying = (name: string, rows: string[], keys: Record<string, string>, w = 1): Model => ({ name, footprint: ['.'.repeat(w)], solids: [], voids: [], ornaments: [{ x: 0, y: S, z: Math.max(0, S - rows.length), rows, keys, free: true }], ground: true })

/** A small hash of three integers in [0, 1) (the scatter's own). */
function hash(a: number, b: number, c: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** A cell's worth of something strewn: a key at a cell of the 16x16 where `f` says so. */
const scatter = (f: (x: number, y: number) => string | null) => Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => f(x, y) ?? ' ').join(''))

export const CHAPTER1_BUILDINGS: Record<string, () => Model> = {
  // the hunter's cabin at the foot: dark logs under a shingled roof, its lean-to, low and poor, long left
  ft_hut: () => wooden({ name: 'ft_hut', w: 5, d: 3, wall: 'darkwood', roof: 'darkwood', seed: 3101, plan: 'eaves', door: 2, poor: true }),
  // Tam's watermill: two storeys of timber over a stone floor on the race, its hoist under the gable, flour on its sill
  mb_mill: () => wooden({ name: 'mb_mill', w: 5, d: 4, upper: 1, timber: true, wall: 'plaster', roof: 'thatch', seed: 3102, plan: 'gable', door: 1, stoneBelow: true, shutters: 'cg', sign: 'bread' }),
  dh_chapel: dawnChapel,
  // Orrin's hut: a low thing of dark boards black with the kilns' smoke, its thatch sooty, by the yard
  dl_hut: () => wooden({ name: 'dl_hut', w: 4, d: 2, wall: 'darkwood', roof: 'thatch', seed: 3103, plan: 'eaves', door: 1, poor: true }, 'thatchwall'),
  // Hilde's cabin up the bank: grey weathered boards, reed thatch, the shutters blue as the river
  rb_cabin: () => wooden({ name: 'rb_cabin', w: 4, d: 3, wall: 'timber', roof: 'thatch', seed: 3104, plan: 'eaves', door: 1, shutters: 'cb', poor: true, sign: 'fish' }),
  // what lies about in the wilds
  decor_twigs: () => lying('decor_twigs', scatter((x, y) => (Math.abs((x - 3) * 0.5 - (y - 4)) < 0.6 && x > 2 && x < 13) || (Math.abs((12 - x) * 0.7 - (y - 8)) < 0.6 && x > 4 && x < 12) || (x === 9 && y > 10 && y < 14) ? (hash(x, y, 1) < 0.4 ? 'a' : 'b') : null), { a: 'w2', b: 'w3' }),
  decor_stones: () => lying('decor_stones', scatter((x, y) => {
    for (const [cx, cy, r] of [[4, 5, 2.2], [10, 9, 2.8], [6, 12, 1.6], [13, 4, 1.2]] as const) {
      const d = Math.hypot(x - cx, (y - cy) * 1.3)
      if (d <= r) return d < r - 1.1 && y < cy ? 'a' : y > cy ? 'c' : 'b'
    }
    return null
  }), { a: 'g1', b: 'g2', c: 'g4' }),
  decor_mushrooms: () => lying('decor_mushrooms', scatter((x, y) => {
    for (const [cx, cy] of [[4, 7], [9, 5], [11, 10], [6, 12]] as const) {
      if (y === cy && Math.abs(x - cx) <= 1) return 'r'
      if (y === cy - 1 && x === cx) return 'R'
      if (y === cy + 1 && x === cx) return 'p'
      if (y === cy + 2 && x === cx) return 'q'
    }
    return null
  }), { r: 'E1', R: 'E0', p: 'p1', q: 'p3' }),
  decor_needles: () => lying('decor_needles', scatter((x, y) => (hash(x, y, 7) < 0.22 - Math.hypot(x - 8, y - 8) * 0.014 ? (hash(x, y, 8) < 0.5 ? 'a' : 'b') : null)), { a: 'h3', b: 'w2' }),
  decor_bones: () => lying('decor_bones', ['                ', '                ', '    pp      p   ', '   ppppppppppp  ', '    pp      pp  ', '                ', '       q q      ', '      qqqqq     ', '       qqq      ', '                ', '  pp            ', ' pppppppp       ', '  pp   pp       '], { p: 'p1', q: 'p3' }),
}
