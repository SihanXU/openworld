// High ground whose top is built (docs/showcase.md §3.5): the edges of a curtain wall's walk and of a quay's street,
// laid out as the terrace sheet is (terrace.ts: columns 0-6, rows 0-4 — the rims, the one-level face's ends and middle,
// the inner corners' notches, the tall face) but in masonry: a coping of dressed stone along every edge that drops, its
// shadow under it; the face below in coursed ashlar, quoins at its ends, a plinth at its foot. Rampart.png in the
// fortress's granite, Quay.png in the Holy City's limestone with the water's dark line at its foot.
//
//   npx tsx games/openworld/tools/src/art/rampart.ts

import { writePng } from './png.ts'
import { PALETTE, hash, type RGBA } from './arch/materials.ts'

const T = 16

function sheet(ramp: string, wet: boolean): Uint8Array {
  const W = 7 * T
  const H = 5 * T
  const px = new Uint8Array(W * H * 4)
  const set = (x: number, y: number, k: string) => px.set(PALETTE[k] as RGBA, (y * W + x) * 4)
  const tone = (i: number) => ramp + Math.max(0, Math.min(5, i))
  // a coping along one edge of a tile: the ink outside, the stone's light top, its shadowed lip
  const coping = (c: number, r: number, side: 'n' | 'w' | 'e') => {
    for (let i = 0; i < T; i++)
      for (let d = 0; d < 4; d++) {
        const [x, y] = side === 'n' ? [i, d] : side === 'w' ? [d, i] : [T - 1 - d, i]
        set(c * T + x, r * T + y, d === 0 ? 'k' : d === 1 ? tone(0) : d === 2 ? tone(1) : tone(3))
      }
  }
  // a corner's notch: the coping turned round the corner, a 4x4 square of it
  const notch = (c: number, r: number, cx: 0 | 1, cy: 0 | 1) => {
    for (let d = 0; d < 4; d++)
      for (let e = 0; e < 4; e++) {
        const x = cx ? T - 1 - d : d
        const y = cy ? T - 1 - e : e
        set(c * T + x, r * T + y, d === 0 || e === 0 ? 'k' : d === 1 || e === 1 ? tone(0) : tone(1))
      }
  }
  // a face of masonry: courses 5 high, blocks 8 to 12 long, the quoins at an end long and short by turns
  const face = (c: number, r: number, rows: number, row: number, left: boolean, right: boolean) => {
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        const gy = row * T + y // from the top of the whole face
        const total = rows * T
        const course = Math.floor(gy / 5)
        const bed = gy % 5 === 4
        const off = (course % 2) * 5 + Math.floor(hash(course, 3) * 4)
        const len = 9 + Math.floor(hash(course, Math.floor((x + c * T + off) / 10)) * 3)
        const joint = (x + c * T + off) % len === 0
        let k = tone(2)
        if (bed || joint) k = tone(3)
        else if (hash(Math.floor((x + c * T + off) / len), course, 7) < 0.06) k = tone(1)
        // the shadow under the coping, the plinth and the foot's dark line
        if (gy < 2) k = tone(4)
        if (gy >= total - 4) k = gy >= total - 1 ? 'k' : tone(wet && gy >= total - 3 ? 4 : 3)
        if (wet && gy >= total - 2) k = 'B3'
        // the quoins: an end's stones long and short by turns, a shade lighter, an ink line at the corner
        const atEnd = (left && x < (course % 2 ? 7 : 4)) || (right && T - 1 - x < (course % 2 ? 4 : 7))
        if (atEnd && !bed && gy >= 2 && gy < total - 4) k = tone(1)
        if ((left && x === 0) || (right && x === T - 1)) k = 'k'
        set(c * T + x, r * T + y, k)
      }
  }
  // rims: col 0 a walk one cell wide, cols 1-3 a wide one's west side, top, east side; row 0 with the north edge
  for (const [c, r, sides] of [
    [0, 0, ['n', 'w', 'e']], [0, 1, ['w', 'e']], [1, 0, ['n', 'w']], [1, 1, ['w']], [2, 0, ['n']], [3, 0, ['n', 'e']], [3, 1, ['e']],
  ] as const)
    for (const s of sides) coping(c, r, s)
  // the inner corners
  notch(0, 3, 0, 0)
  notch(1, 3, 1, 0)
  notch(0, 4, 0, 1)
  notch(1, 4, 1, 1)
  // the one-level face: alone, its left end, middle, right end
  face(0, 2, 1, 0, true, true)
  face(1, 2, 1, 0, true, false)
  face(2, 2, 1, 0, false, false)
  face(3, 2, 1, 0, false, true)
  // the tall face: its left end, middle, right end, each in three rows (top, middle, foot)
  for (let row = 0; row < 3; row++) {
    face(4, row, 3, row, true, false)
    face(5, row, 3, row, false, false)
    face(6, row, 3, row, false, true)
  }
  return px
}

writePng('Relief/Rampart.png', 7 * T, 5 * T, sheet('g', false))
writePng('Relief/Quay.png', 7 * T, 5 * T, sheet('s', true))
// a chancel's marble step: the white of its stone, coursed like treads
writePng('Relief/Steps.png', 7 * T, 5 * T, sheet('pw', false))
