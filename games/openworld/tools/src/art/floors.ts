// The showcase's grounds and floors (docs/showcase.md §3.5), drawn tile by tile in the palette (arch/materials.ts):
// four autotiled blocks laid out as the pack's blob (ground.ts BLOB47; each draws its own rim, so it sits on any
// floor) — the crimson carpet with its gold border, the blue runner with silver, the city's cobbled plaza within its
// kerb of pale stone, a flower bed in its stone edging — and plain tiles in variants: the diamond lattice of a nave's
// aisles, polished marble for a chancel, the pale flagstones of a street, oak parquet in herringbone.
//
//   npx tsx games/openworld/tools/src/art/floors.ts   → public/assets/lsw/Tiles/Floors.png

import { writePng } from './png.ts'
import { BLOB47 } from '../../../../../packages/runtime/src/assets/ground.ts'
import { PALETTE, hash, type RGBA } from './arch/materials.ts'

const T = 16
const COLS = 44
const ROWS = 7
const W = COLS * T
const H = ROWS * T
const px = new Uint8Array(W * H * 4)
const put = (x: number, y: number, k: string) => {
  const c = PALETTE[k] as RGBA | undefined
  if (!c) throw new Error(`no colour ${k}`)
  px.set(c, (y * W + x) * 4)
}

/**
 * A blob block at (col, row): every one of the 47 tiles drawn for its mask (which of its eight neighbours are of it).
 * `rim(d)` the key at depth d into the border (0 the outermost), `fill(gx, gy)` the inside by its position in the
 * block's own pattern, `depth` how wide the rim is.
 */
function blob(col: number, row: number, depth: number, rim: (d: number, gx: number, gy: number) => string, fill: (gx: number, gy: number) => string) {
  for (const [m, [dc, dr]] of Object.entries(BLOB47)) {
    const mask = Number(m)
    const has = (bit: number) => (mask & bit) !== 0
    const N = has(1), E = has(4), S = has(16), Wd = has(64)
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        let d = Infinity
        if (!N) d = Math.min(d, y)
        if (!S) d = Math.min(d, T - 1 - y)
        if (!Wd) d = Math.min(d, x)
        if (!E) d = Math.min(d, T - 1 - x)
        // the inner corners: both sides of it present, the diagonal not
        if (N && Wd && !has(128) && x < depth && y < depth) d = Math.min(d, Math.max(x, y))
        if (N && E && !has(2) && x >= T - depth && y < depth) d = Math.min(d, Math.max(T - 1 - x, y))
        if (S && Wd && !has(32) && x < depth && y >= T - depth) d = Math.min(d, Math.max(x, T - 1 - y))
        if (S && E && !has(8) && x >= T - depth && y >= T - depth) d = Math.min(d, Math.max(T - 1 - x, T - 1 - y))
        const gx = (col + dc) * T + x
        const gy = (row + dr) * T + y
        put(gx, gy, d < depth ? rim(d, x, y) : fill(x, y))
      }
  }
}

// ------------------------------------------------------------------ the crimson carpet, its gold border, its lozenges
blob(0, 0, 5, (d) => ['k', 'a2', 'a1', 'a2', 'E3'][d], (x, y) => {
  const u = (x + 4) % 8 - 4
  const v = (y + 4) % 8 - 4
  const loz = Math.abs(u) + Math.abs(v)
  if (loz === 2 && (x + y) % 16 < 8) return 'a2'
  if (loz === 0) return 'a1'
  return (x * 7 + y * 3) % 11 === 0 ? 'E3' : 'E2'
})
// ------------------------------------------------------------------ the blue runner, silver at its edges
blob(11, 0, 4, (d) => ['k', 'i0', 'i1', 'B3'][d], (x, y) => ((x + 4) % 8 === 0 && (y + 4) % 8 === 0 ? 'cw0' : (y % 4 === 2 && x % 8 === 1) ? 'B1' : 'B2'))
// ------------------------------------------------------------------ the plaza: cobbles of three greys in their kerb
blob(22, 0, 4, (d) => ['g4', 'g1', 'g0', 'g2'][d], (x, y) => {
  // stones about four pixels across, set in courses, the joints dark
  const course = Math.floor(y / 4)
  const off = (course % 2) * 2
  const stone = Math.floor((x + off) / 4)
  const jx = (x + off) % 4 === 3
  const jy = y % 4 === 3
  if (jx || jy) return 'g5'
  const h = hash(stone, course, 41)
  return h < 0.3 ? 'g2' : h < 0.75 ? 'g3' : 'g4'
})
// ------------------------------------------------------------------ the flower bed: dark soil, leaves and blooms, a stone edging
blob(33, 0, 3, (d) => ['k', 's1', 's2'][d], (x, y) => {
  const h = hash(x, y, 73)
  if (h < 0.1) return ['E1', 'Y1', 'U1', 'cw0', 'cb1'][Math.floor(hash(x, y, 74) * 5)]
  if (h < 0.55) return hash(x, y, 75) < 0.5 ? 'v1' : 'v2'
  return h < 0.8 ? 'w3' : 'w4'
})

// ------------------------------------------------------------------ plain tiles (row 5): lattice, marble, flags, parquet
const plain = (col: number, row: number, f: (x: number, y: number) => string) => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) put(col * T + x, row * T + y, f(x, y))
}
// the diamond lattice of an aisle: terracotta lozenges in cream bands, a gilt stud where the bands cross
for (let v = 0; v < 4; v++)
  plain(v, 5, (x, y) => {
    const a = (x + y) % 16
    const b = (x - y + 16) % 16
    if (a < 2 || b < 2) return (x === 0 || x === 8) && (y === 0 || y === 8) ? 'a1' : 's0'
    if (a === 2 || b === 2 || a === 15 || b === 15) return 's2'
    const inner = Math.abs(((x + 8) % 16) - 8) + Math.abs(((y + 8) % 16) - 8)
    if (v % 2 && inner < 3) return 'Y1'
    return (Math.floor((x + y) / 16) + Math.floor((x - y + 32) / 16)) % 2 ? 't2' : 't3'
  })
// polished marble: cream slabs bordered in grey, a black lozenge set where four slabs meet, a vein across each
for (let v = 0; v < 4; v++)
  plain(4 + v, 5, (x, y) => {
    const cx = Math.min(x, 15 - x)
    const cy = Math.min(y, 15 - y)
    if (cx + cy < 3) return cx + cy < 2 ? 'n2' : 'a2'
    if (x === 15 || y === 15) return 'pw3'
    if (x === 1 || y === 1 || x === 14 || y === 14) return 'pw2'
    const vein = Math.abs(y - (5 + v * 2 + Math.sin((x + v * 5) * 0.5) * 3)) < 0.6
    if (vein) return 'pw2'
    if (x === 0 || y === 0) return 'pw0'
    return hash(x, y, 80 + v) < 0.06 ? 'pw2' : 'pw1'
  })
// a street's flagstones: slabs of pale limestone of a few sizes, their joints, a worn one here and there
for (let v = 0; v < 6; v++)
  plain(8 + v, 5, (x, y) => {
    const split = 5 + (v % 3) * 2
    const top = y < split
    const cut = top ? 4 + v * 3 : 9 - v
    const jx = x === ((cut % 14) + 1) || x === 15
    const jy = y === split || y === 15
    if (jx || jy) return 's3'
    const slab = (top ? 0 : 2) + (x < cut % 14 + 1 ? 0 : 1)
    const h = hash(slab, v, 90)
    return h < 0.2 ? 's2' : hash(x, y, 91 + v) < 0.04 ? 's2' : 's1'
  })
// oak parquet in herringbone: planks two pixels wide, alternating their slant
for (let v = 0; v < 2; v++)
  plain(14 + v, 5, (x, y) => {
    const blk = Math.floor((x + v * 4) / 4) % 2
    const u = blk ? (x + y) % 8 : (x - y + 64) % 8
    if (u === 0) return 'w3'
    return u < 4 ? 'w1' : 'w2'
  })

writePng('Tiles/Floors.png', W, H, px)
