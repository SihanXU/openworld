// The project's own pixel art for what one builds (the Ninja Adventure pack has walls only as
// whole houses and fences, and stairs only as icons): wall blocks, stairs and the edge of a floor
// laid a storey up, all on the 16x16 grid, in the pack's wood colours. A storey is one tile high:
// a wall block shows its top one tile up from its cell and its front in its cell; stairs reach
// from the foot of their cell to the floor one storey up.
//
//   npx tsx packages/tools/src/art/structures.ts
//
// Structures/wall.png    20 tiles: 16 tops (outlined on each side with no wall beside it: bits
//                        n=1 e=2 s=4 w=8 say there is), then 4 fronts (bits e=1 w=2).
// Structures/floor.png   16 tiles: the edge of a floor laid a storey up (bits as the tops'), over
//                        the floor's own picture.
// Structures/stairs.png  4 tiles, by the way up: north, east, south, west.

import { writePng } from './png.ts'

type RGBA = [number, number, number, number]
const hex = (h: string, a = 255): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a]
// the pack's own: the outline, the wooden floor's light, the house walls' planks
const INK = hex('#141b1b')
const TOP = hex('#d9a874')
const TOP_HI = hex('#f0c890')
const GRAIN = hex('#c08b58')
const FACE = hex('#a3754e')
const FACE_DK = hex('#7d5236')
const FACE_LO = hex('#5a3a28')
const FACE_HI = hex('#c8966b')

class Canvas {
  px: Uint8Array
  constructor(
    public w: number,
    public h: number,
  ) {
    this.px = new Uint8Array(w * h * 4)
  }
  set(x: number, y: number, c: RGBA): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.px.set(c, (y * this.w + x) * 4)
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: RGBA): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c)
  }
  hline(x0: number, x1: number, y: number, c: RGBA): void {
    this.rect(x0, y, x1, y, c)
  }
  vline(x: number, y0: number, y1: number, c: RGBA): void {
    this.rect(x, y0, x, y1, c)
  }
}

/** A wall block's top at (ox, oy): planks seen from above, outlined on each side with no wall beside it. */
function wallTop(c: Canvas, ox: number, oy: number, bits: number): void {
  const [n, e, s, w] = [bits & 1, bits & 2, bits & 4, bits & 8]
  c.rect(ox, oy, ox + 15, oy + 15, TOP)
  for (const y of [4, 9, 13]) c.hline(ox, ox + 15, oy + y, GRAIN)
  if (!n) (c.hline(ox, ox + 15, oy, INK), c.hline(ox, ox + 15, oy + 1, TOP_HI))
  if (!w) (c.vline(ox, oy, oy + 15, INK), c.vline(ox + 1, oy + (n ? 0 : 1), oy + 15, TOP_HI))
  if (!e) c.vline(ox + 15, oy, oy + 15, INK)
  if (!s) c.hline(ox, ox + 15, oy + 15, INK)
}

/** A wall block's front at (ox, oy): vertical planks, dark under the top's edge and at the foot (a beam between storeys). */
function wallFront(c: Canvas, ox: number, oy: number, bits: number): void {
  const [e, w] = [bits & 1, bits & 2]
  c.rect(ox, oy, ox + 15, oy + 15, FACE)
  for (const x of [3, 7, 11]) c.vline(ox + x, oy, oy + 15, FACE_DK)
  for (const x of [4, 8, 12]) c.vline(ox + x, oy + 1, oy + 14, FACE_HI)
  c.hline(ox, ox + 15, oy, FACE_LO)
  c.hline(ox, ox + 15, oy + 14, FACE_LO)
  c.hline(ox, ox + 15, oy + 15, INK)
  if (!w) c.vline(ox, oy, oy + 15, INK)
  if (!e) c.vline(ox + 15, oy, oy + 15, INK)
}

/** The edge of a floor laid a storey up: an outline (and a light lip) on each side with no floor beside it; the rest clear. */
function floorEdge(c: Canvas, ox: number, oy: number, bits: number): void {
  const [n, e, s, w] = [bits & 1, bits & 2, bits & 4, bits & 8]
  if (!n) (c.hline(ox, ox + 15, oy, INK), c.hline(ox, ox + 15, oy + 1, TOP_HI))
  if (!w) c.vline(ox, oy, oy + 15, INK)
  if (!e) c.vline(ox + 15, oy, oy + 15, INK)
  if (!s) (c.hline(ox, ox + 15, oy + 14, GRAIN), c.hline(ox, ox + 15, oy + 15, INK))
}

// Stairs are a storey's front one walks up (in the cell a wall would hold the floor's edge from):
// one tile, four steps of 4. Seen from the south and above (3/4): what faces the viewer darker (a
// riser, a side), what faces up lighter (a tread).

/** Up to the north: the steps face the viewer, a tread over a riser each, between stringers. */
function stairsNorth(c: Canvas, ox: number): void {
  for (let i = 0; i < 4; i++) {
    const y = 4 * i
    c.rect(ox + 2, y, ox + 13, y + 1, TOP)
    c.hline(ox + 2, ox + 13, y, TOP_HI)
    c.rect(ox + 2, y + 2, ox + 13, y + 3, FACE)
    c.hline(ox + 2, ox + 13, y + 2, FACE_DK)
  }
  c.rect(ox, 0, ox + 1, 15, FACE_DK)
  c.rect(ox + 14, 0, ox + 15, 15, FACE_DK)
  c.vline(ox, 0, 15, INK)
  c.vline(ox + 15, 0, 15, INK)
  c.hline(ox, ox + 15, 15, INK)
}

/** Up to the east, seen from the side: four steps rising to the right, each a tread over its side. */
function stairsEast(c: Canvas, ox: number, mirror: boolean): void {
  const X = (x: number) => ox + (mirror ? 15 - x : x)
  for (let i = 0; i < 4; i++) {
    const top = 16 - 4 * (i + 1)
    for (let x = 4 * i; x < 4 * i + 4; x++) {
      c.vline(X(x), top, top + 1, TOP)
      c.vline(X(x), top + 2, 15, FACE)
    }
    c.hline(Math.min(X(4 * i), X(4 * i + 3)), Math.max(X(4 * i), X(4 * i + 3)), top, INK)
    c.hline(Math.min(X(4 * i), X(4 * i + 3)), Math.max(X(4 * i), X(4 * i + 3)), top + 2, FACE_DK)
    c.vline(X(4 * i), top, 15, i ? FACE_DK : INK)
  }
  c.vline(X(15), 0, 15, INK)
  c.hline(ox, ox + 15, 15, INK)
}

/** Up to the south, seen from behind: its back, planked, with the steps' edges along the top. */
function stairsSouth(c: Canvas, ox: number): void {
  c.rect(ox, 0, ox + 15, 15, FACE)
  for (let i = 0; i < 4; i++) c.hline(ox + 1, ox + 14, 4 * i + 3, FACE_DK)
  c.rect(ox + 1, 0, ox + 14, 1, TOP)
  for (const x of [5, 10]) c.vline(ox + x, 2, 14, FACE_LO)
  c.vline(ox, 0, 15, INK)
  c.vline(ox + 15, 0, 15, INK)
  c.hline(ox, ox + 15, 15, INK)
}

const wall = new Canvas(16 * 20, 16)
for (let b = 0; b < 16; b++) wallTop(wall, 16 * b, 0, b)
for (let b = 0; b < 4; b++) wallFront(wall, 16 * (16 + b), 0, b)
writePng('Structures/wall.png', wall.w, wall.h, wall.px)

const floor = new Canvas(16 * 16, 16)
for (let b = 0; b < 16; b++) floorEdge(floor, 16 * b, 0, b)
writePng('Structures/floor.png', floor.w, floor.h, floor.px)

const stairs = new Canvas(16 * 4, 16)
stairsNorth(stairs, 0)
stairsEast(stairs, 16, false)
stairsSouth(stairs, 32)
stairsEast(stairs, 48, true)
writePng('Structures/stairs.png', stairs.w, stairs.h, stairs.px)
