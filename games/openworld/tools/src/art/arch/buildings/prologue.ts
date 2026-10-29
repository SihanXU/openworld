// The prologue's own buildings (docs/release-1.md §4b, the redo of 2026-10-27: the way from where a new game begins down
// to Firstlight drawn as the showcase's places are). What one walks through in the first hour is an old way down the
// mountain, long given up: on Cloudtop the watch shelter one wakes in, dry stone fallen in at a corner, its hearth's
// chimney still standing; the cairn the watchman found the small light by; the gate of the way down, an arch alone in
// the rim. In the Clearing the spring rising under an old wall of the Five, its niche and five worn marks, and the oak
// the clearing grew round. At the Mountain Foot and the Ford the same ruin's columns, walls and a tower's stump
// (wilds.ts), in the snow up high as they are below.

import type { Model, Ornament } from '../oblique.ts'
import { archNS, box, drum, spire, type Solid } from '../shapes.ts'
import { bird, ivy, moss, picture, stains } from '../ornaments.ts'
import { S } from '../kit.ts'
import { hash } from '../materials.ts'
import { WILDS, ragged } from './wilds.ts'

const one = (name: string, footprint: string[], solids: Solid[], ornaments: Ornament[] = [], voids: Solid[] = []): Model => ({ name, footprint, solids, voids, ornaments })

/**
 * Up in the snow: a model's stone as dry stone (darker than the snow it stands in), snow lying on every top of it however
 * ragged (wilds.ts `snowed` caps only a solid's highest points).
 */
function snowy(name: string, m: Model): Model {
  const solids: Solid[] = m.solids.map((s) => (s.mat === 'graniteRough' ? { ...s, mat: 'fieldstone' } : s))
  for (const s of m.solids) {
    if (!/granite|stone/i.test(s.mat)) continue
    const [x0, y0, z0, x1, y1, z1] = s.b
    solids.push({ b: [x0, y0, z0 + 1, x1, y1, z1 + 2], mat: 'snowField', inside: (x, y, z) => !s.inside(x, y, z) && s.inside(x, y, z - 2) })
  }
  return { ...m, name, solids }
}

// ------------------------------------------------------------------------------------------------ Cloudtop

/** A dry-stone wall's worn top: how high it stands at `u` along it, rising and falling smoothly between `lo` and `hi`. */
function worn(u: number, seed: number, hi: number, lo: number): number {
  const f = u / 14
  const i = Math.floor(f)
  const e = (f - i) * (f - i) * (3 - 2 * (f - i))
  const a = hash(i, seed, 51)
  return lo + (hi - lo) * (a + (hash(i + 1, seed, 51) - a) * e) - (hash(Math.floor(u / 2), seed, 52) < 0.25 ? 1 : 0)
}

/**
 * The watch shelter on Cloudtop, roofless: walls of dry stone nine cells by six, built against the crags. Its north-west
 * corner is down, a gap in its north wall and another in its west where the stones fell, its doorway south toward the
 * cut; the hearth's chimney stands up out of the north wall. Snow on every top. (Its footprint is the yard the story
 * keeps: the spawn, the cot, the chair at the log, the barrel within.)
 */
function shelter(): Model {
  const w = 9
  const d = 6
  const W = w * S
  const D = d * S
  const T = 6
  const solids: Solid[] = [
    // north, against the crags: tall, fallen to almost nothing at its west end, a gap where a stone fell
    { b: [0, 2, 0, W, 2 + T, 28], mat: 'graniteRough', inside: (x, _y, z) => !(x >= 2 * S && x < 3 * S) && z <= (x < 2 * S ? worn(x, 61, 10, 3) : worn(x, 62, 28, 16)) },
    // west: low, a gap in the middle
    { b: [0, 0, 0, T, D, 18], mat: 'graniteRough', inside: (_x, y, z) => !(y >= 2 * S && y < 3 * S) && z <= (y < S + 4 ? 4 : worn(y, 63, 18, 6)) },
    // east: standing best, in the crags' lee
    { b: [W - T, 0, 0, W, D, 24], mat: 'graniteRough', inside: (_x, y, z) => z <= worn(y, 64, 24, 12) },
    // south: the doorway in it, its jambs standing higher than the wall
    { b: [0, D - T - 2, 0, W, D - 2, 24], mat: 'graniteRough', inside: (x, _y, z) => !(x >= 4 * S && x < 5 * S) && z <= (Math.abs(x - 4 * S) < 6 || Math.abs(x - 5 * S) < 6 ? 24 : worn(x, 65, 18, 6)) },
    // the hearth's chimney, up out of the north wall, its top broken
    { b: [7 * S, 2, 0, 8 * S + 2, 2 + T + 6, 44], mat: 'graniteRough', inside: (x, _y, z) => z <= 38 + hash(Math.floor(x / 4), 66) * 6 },
  ]
  const voids: Solid[] = [archNS(7 * S + 9, T, T + 8, 0, 10, 14, 'round')]
  const orn: Ornament[] = [moss(18, 6, 61).at(S, D - 2, 0), moss(14, 5, 62).at(6 * S, D - 2, 2), stains(W, 16, 'g', 61).at(0, D - 2, 0)]
  // the hearth's soot
  orn.push(picture([' nnnnnn ', 'nnnnnnnn', 'nnnnnnnn'], { n: 'n2' }).at(7 * S + 5, T + 1, 0))
  const fp = ['## ######', '#       #', '        #', '#       #', '#       #', '#### ####']
  return snowy('ct_shelter', one('ct_shelter_bare', fp, solids, orn, voids))
}

/** The cairn on the plateau, stones piled up the height of a man, a pole in it with a strip of red cloth gone pale. */
function cairn(): Model {
  const C = S / 2
  const solids: Solid[] = []
  let z = 0
  for (let k = 0; k < 6; k++) {
    const r = 7.5 - k * 1.1
    const h = 5 - k * 0.4
    const ox = (hash(k, 71) - 0.5) * 2
    const oy = (hash(k, 72) - 0.5) * 2
    solids.push(drum(C + ox, C + oy, r, z, z + h, 'fieldstone'))
    z += h - 0.5
  }
  // snow on its crown only, in the lee of the stones
  solids.push(drum(C, C, 3.2, z - 0.5, z + 1.5, 'snowField'), box(C - 0.5, C - 0.5, z, C + 1, C + 1, z + 18, 'timber'))
  const orn: Ornament[] = [picture(['ccccc', 'cccc ', 'ccc  ', 'cc   '], { c: 'cr0' }).at(C + 1, C + 1, z + 12, true)]
  return one('ct_cairn', ['#'], solids, orn)
}

// ------------------------------------------------------------------------------------------------ the Clearing

/**
 * The spring's wall: old stone of the Five set into the bank north of the pool, five cells long, its ends broken off.
 * In its middle a niche with a hooded figure worn smooth, five marks cut over it, the first of them black; below, the
 * spout the water runs from into the pool. Moss, ivy, the water's stain.
 */
function springWall(): Model {
  const w = 5
  const W = w * S
  const mid = W / 2
  const solids: Solid[] = [
    { b: [0, 3, 0, W, S - 1, 46], mat: 'graniteRough', inside: (x, _y, z) => z <= (x < 14 || x > W - 14 ? ragged(x, 81, 40, 14) : 42) },
    box(14, 6, 40, W - 14, S, 44, 'granite'),
    // the piers either side of the niche, standing above the coping
    { b: [mid - 20, 3, 0, mid - 12, S, 62], mat: 'granite', inside: (_x, _y, z) => z <= 60 },
    { b: [mid + 12, 3, 0, mid + 20, S, 62], mat: 'granite', inside: (_x, _y, z) => z <= 56 },
    // the spout's lip
    box(mid - 4, S - 3, 8, mid + 4, S, 11, 'granite'),
  ]
  const voids: Solid[] = [archNS(mid, S - 7, S + 1, 14, 16, 22, 'round')]
  const orn: Ornament[] = [
    // the figure in the niche: hooded, its hands together, its face gone
    picture(['  gg  ', ' gGGg ', ' gssg ', ' gGGg ', 'gGggGg', 'gGggGg', 'gGggGg', 'gggggg'], { g: 'g3', G: 'g2', s: 'g4' }).at(mid - 3, S - 6, 15),
    // five marks over it, the first black
    picture(['n g g g g'], { n: 'n1', g: 'g4' }).at(mid - 4, S - 1, 38),
    // the water from the spout to the pool, and its stain down the wall
    picture(['qq', 'qQ', 'Qq', 'qq', 'qQ', 'Qq', 'qq', 'QQ'], { q: 'q1', Q: 'q0' }).at(mid - 1, S, 0, true),
    stains(28, 10, 'g', 81).at(mid - 14, S - 1, 0),
    moss(20, 6, 81).at(2, S - 1, 0),
    moss(16, 5, 82).at(W - 20, S - 1, 4),
    ivy(16, 40, 83).at(4, S - 1, 0),
    ivy(14, 36, 84).at(W - 18, S - 1, 0),
  ]
  return one('cl_spring', ['#####'], solids, orn, voids)
}

/**
 * The oak the clearing grew round: older than the wall, its trunk a cell's breadth and its crown five cells wide over
 * the woods' edge. Only the trunk stands in the way; one walks under the crown.
 */
function oak(): Model {
  const cx = 2.5 * S
  const cy = 2.5 * S
  const solids: Solid[] = [drum(cx, cy, 7, 0, 46, 'darkwood'), drum(cx, cy, 10, 0, 6, 'darkwood')]
  // the roots, out across the ground; the two great limbs
  for (const [dx, dy] of [[-12, 1], [12, 2], [-7, 5], [8, -4], [2, 6]] as const) solids.push(box(Math.min(cx, cx + dx) - 1, Math.min(cy, cy + dy) - 1, 0, Math.max(cx, cx + dx) + 1, Math.max(cy, cy + dy) + 1, 3, 'darkwood'))
  solids.push(drum(cx - 9, cy - 2, 4, 30, 58, 'darkwood'), drum(cx + 9, cy - 3, 4, 32, 60, 'darkwood'))
  // the crown: clusters of leaves, lumpy
  const clusters: [number, number, number, number][] = [
    [cx, cy - 12, 78, 24], [cx - 22, cy - 6, 66, 17], [cx + 22, cy - 6, 68, 18], [cx - 10, cy - 22, 90, 18], [cx + 12, cy - 20, 92, 16],
    [cx, cy + 2, 60, 16], [cx - 30, cy - 14, 76, 12], [cx + 30, cy - 16, 78, 12], [cx, cy - 30, 100, 13],
  ]
  solids.push({
    b: [0, cy - 46, 40, 5 * S, cy + 20, 116],
    mat: 'foliage',
    inside: (x, y, z) => clusters.some(([qx, qy, qz, r]) => Math.hypot(x - qx, (y - qy) * 1.1, (z - qz) * 1.15) <= r * (0.88 + 0.22 * hash(Math.floor(x / 3), Math.floor(y / 3), Math.floor(z / 3)))),
  })
  return one('cl_oak', ['     ', '     ', '  #  '], solids, [bird(true, 9).at(cx + 18, cy - 10, 104, true)])
}

/** A run of the ruin's wall fallen to knee height along x, `n` cells: its stones' last courses, moss, ivy. */
function lowWall(n: number, seed: number): Model {
  const W = n * S
  const solids: Solid[] = [{ b: [0, 4, 0, W, S - 2, 30], mat: 'graniteRough', inside: (x, _y, z) => z <= ragged(x, seed, 30, 6) }]
  return one(`ruin_low_x${n}`, ['#'.repeat(n)], solids, [moss(16, 6, seed).at(3, S - 2, 0), ivy(14, 22, seed).at(W / 2 - 7, S - 2, 0)])
}

/** A column broken off low, its drum split, moss at its foot: what is left of the ruin's colonnades where they fell. */
function stump(k: number): Model {
  const C = S / 2
  const h = 12 + k * 7
  const solids: Solid[] = [box(C - 7, C - 6, 0, C + 7, C + 7, 5, 'graniteRough'), { b: [C - 5, C - 5, 5, C + 5, C + 5, h + 4], mat: 'graniteRough', inside: (x, y, z) => Math.hypot(x - C, y - C) <= 5 && z <= h + (x - C) * 0.5 * (k % 2 ? 1 : -1) + hash(Math.floor(x / 2), k, 91) * 3 }]
  return one(`ruin_stump_${k}`, ['#'], solids, [moss(10, 4, k + 90).at(C - 5, C + 7, 0, true)])
}

/** A waymark on the old way across the snow: a squat post of stone, its cap a pyramid, a notch cut in its face. */
function waymark(k: number): Model {
  const C = S / 2
  const h = 16 + k * 3
  const solids: Solid[] = [box(C - 5, C - 4, 0, C + 5, C + 5, h, 'graniteRough'), spire(C, C + 0.5, 6.5, h, 6, 4, 'graniteRough')]
  return snowy(`ct_waymark_${k}`, one(`ct_waymark_${k}_bare`, ['#'], solids, [picture(['nn', 'nn'], { n: 'g4' }).at(C - 1, C + 5, h - 6)]))
}

export const PROLOGUE_BUILDINGS: Record<string, () => Model> = {
  ct_shelter: shelter,
  ct_cairn: cairn,
  cl_spring: springWall,
  cl_oak: oak,
  ...Object.fromEntries([0, 1, 2].map((k) => [`ruin_stump_${k}`, () => stump(k)])),
  ...Object.fromEntries([2, 3, 4].map((n) => [`ruin_low_x${n}`, () => lowWall(n, 95 + n)])),
  ...Object.fromEntries([0, 1].map((k) => [`ct_waymark_${k}`, () => waymark(k)])),
  // the ruin's pieces up in the snow
  snow_ruin_arch: () => snowy('snow_ruin_arch', WILDS.ruin_arch()),
  snow_ruin_tower: () => snowy('snow_ruin_tower', WILDS.ruin_tower()),
  snow_ruin_wall_x3: () => snowy('snow_ruin_wall_x3', WILDS.ruin_wall_x3()),
  ...Object.fromEntries([0, 1, 2].map((k) => [`snow_ruin_column_${k}`, () => snowy(`snow_ruin_column_${k}`, WILDS[`ruin_column_${k}`]())])),
}
