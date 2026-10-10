// The project's own pixel art for what one builds (the Ninja Adventure pack has walls only as
// whole houses and fences, and stairs only as icons): wall blocks, stairs and the edge of a floor
// laid a storey up, all on the 16x16 grid, in the pack's wood colours.
//
// One projection for all of it (the 3/4 view of the classic JRPGs): a point h storeys up is drawn
// h tiles above where it stands, and a storey is one tile high, as a cell is one tile deep. So a
// block (a wall, a door, stairs) shows its front in its own cell and its top one tile up; a floor
// laid a storey up lies where the tops of the blocks under it are.
//
//   npx tsx games/openworld/tools/src/art/structures.ts
//
// Structures/wall.png    22 tiles: 16 tops (a wall's cap, a dark mass one never mistakes for a
//                        floor, as RPG Maker's ceiling; rimmed on each side with no wall beside it:
//                        bits n=1 e=2 s=4 w=8 say there is), then 4 fronts (bits e=1 w=2), then a
//                        door in a wall that runs north-south seen from above, shut and open.
// Structures/floor.png   17 tiles: the edge of a floor laid a storey up (bits as the tops'), over
//                        the floor's own picture; then its thickness (4 high), seen under a south
//                        edge nothing holds up (a balcony).
// Structures/stairs.png  4 blocks of 16x32 (the front in the cell, the top a tile up), by the way
//                        up: north, east, south, west.

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
const CAP = hex('#6e4b33')
const CAP_DK = hex('#5a3a28')
const CAP_RIM = hex('#b07a50')
const DOOR = hex('#e46d3a')
const DOOR_HI = hex('#ef914f')
const SILL = hex('#c99a68')

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

/** A wall block's top at (ox, oy): its cap, a dark mass, rimmed light on each side with no wall beside it. */
function wallTop(c: Canvas, ox: number, oy: number, bits: number): void {
  const [n, e, s, w] = [bits & 1, bits & 2, bits & 4, bits & 8]
  c.rect(ox, oy, ox + 15, oy + 15, CAP)
  for (const y of [5, 10]) c.hline(ox, ox + 15, oy + y, CAP_DK)
  if (!n) (c.hline(ox, ox + 15, oy + 1, CAP_RIM), c.hline(ox, ox + 15, oy, INK))
  if (!w) (c.vline(ox + 1, oy, oy + 15, CAP_RIM), c.vline(ox, oy, oy + 15, INK))
  if (!e) (c.vline(ox + 14, oy, oy + 15, CAP_RIM), c.vline(ox + 15, oy, oy + 15, INK))
  if (!s) (c.hline(ox, ox + 14, oy + 14, CAP_RIM), c.hline(ox, ox + 15, oy + 15, INK))
}

/** A door in a wall that runs north-south, seen from above: the jambs' caps at its ends, the sill between, the leaf along the wall's line (open: swung into the room). */
function doorAbove(c: Canvas, ox: number, oy: number, open: boolean): void {
  wallTop(c, ox, oy, 1 | 4)
  c.rect(ox + 2, oy + 3, ox + 13, oy + 12, SILL)
  c.hline(ox + 2, ox + 13, oy + 3, INK)
  c.hline(ox + 2, ox + 13, oy + 12, INK)
  if (open) {
    c.rect(ox + 3, oy + 4, ox + 12, oy + 5, DOOR)
    c.hline(ox + 3, ox + 12, oy + 6, INK)
  } else {
    c.rect(ox + 5, oy + 3, ox + 10, oy + 12, INK)
    c.rect(ox + 6, oy + 4, ox + 9, oy + 11, DOOR)
    c.vline(ox + 6, oy + 4, oy + 11, DOOR_HI)
  }
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

/** A floor's thickness, seen under a south edge nothing holds up (a balcony, an overhang). */
function floorLip(c: Canvas, ox: number): void {
  c.rect(ox, 0, ox + 15, 3, FACE_DK)
  c.hline(ox, ox + 15, 0, INK)
  c.hline(ox, ox + 15, 3, INK)
}

/** The edge of a floor laid a storey up: an outline (and a light lip) on each side with no floor beside it; the rest clear. */
function floorEdge(c: Canvas, ox: number, oy: number, bits: number): void {
  const [n, e, s, w] = [bits & 1, bits & 2, bits & 4, bits & 8]
  if (!n) (c.hline(ox, ox + 15, oy, INK), c.hline(ox, ox + 15, oy + 1, TOP_HI))
  if (!w) c.vline(ox, oy, oy + 15, INK)
  if (!e) c.vline(ox + 15, oy, oy + 15, INK)
  if (!s) (c.hline(ox, ox + 15, oy + 14, GRAIN), c.hline(ox, ox + 15, oy + 15, INK))
}

// Stairs are a block a storey high whose top is steps (four of 4): 16x32, the front in the cell and
// the top a tile up. A point d into the cell and h up is drawn d + h above the cell's south edge, so
// what faces the viewer (a riser, a side) is drawn darker, what faces up (a tread) lighter.

/** Up to the north: a tread and a riser per step, all facing the viewer, between stringers. */
function stairsNorth(c: Canvas, ox: number): void {
  for (let i = 0; i < 4; i++) {
    const y = 32 - 8 * (i + 1)
    c.rect(ox + 2, y, ox + 13, y + 3, TOP)
    c.hline(ox + 2, ox + 13, y, TOP_HI)
    c.rect(ox + 2, y + 4, ox + 13, y + 7, FACE)
    c.hline(ox + 2, ox + 13, y + 4, INK)
    c.hline(ox + 2, ox + 13, y + 7, FACE_LO)
  }
  c.rect(ox, 0, ox + 1, 31, FACE_DK)
  c.rect(ox + 14, 0, ox + 15, 31, FACE_DK)
  c.vline(ox, 0, 31, INK)
  c.vline(ox + 15, 0, 31, INK)
  c.hline(ox, ox + 15, 0, INK)
  c.hline(ox, ox + 15, 31, INK)
}

/** Up to the east: steps across, each a tread the cell's depth (drawn upright) over its side, which faces the viewer. */
function stairsEast(c: Canvas, ox: number, mirror: boolean): void {
  const X = (x: number) => ox + (mirror ? 15 - x : x)
  for (let i = 0; i < 4; i++) {
    const h = 4 * (i + 1)
    for (let x = 4 * i; x < 4 * i + 4; x++) {
      c.vline(X(x), 32 - h - 16, 32 - h - 1, TOP)
      c.vline(X(x), 32 - h, 31, FACE_DK)
      c.set(X(x), 32 - h - 16, INK)
      c.set(X(x), 32 - h, FACE_LO)
    }
    c.vline(X(4 * i), 32 - h - 16, 31, i ? FACE_LO : INK)
  }
  c.vline(X(15), 0, 31, INK)
  c.hline(ox, ox + 15, 31, INK)
}

/** Up to the south (toward the viewer): seen edge-on, all one sees is the top step's tread; the high end faces the viewer. */
function stairsSouth(c: Canvas, ox: number): void {
  c.rect(ox, 12, ox + 15, 15, TOP)
  c.hline(ox, ox + 15, 12, INK)
  for (const x of [4, 8, 12]) c.vline(ox + x, 12, 15, GRAIN)
  c.rect(ox, 16, ox + 15, 31, FACE)
  for (let i = 0; i < 4; i++) c.hline(ox + 1, ox + 14, 16 + 4 * i, FACE_DK)
  c.vline(ox, 12, 31, INK)
  c.vline(ox + 15, 12, 31, INK)
  c.hline(ox, ox + 15, 31, INK)
}

const wall = new Canvas(16 * 22, 16)
for (let b = 0; b < 16; b++) wallTop(wall, 16 * b, 0, b)
for (let b = 0; b < 4; b++) wallFront(wall, 16 * (16 + b), 0, b)
doorAbove(wall, 16 * 20, 0, false)
doorAbove(wall, 16 * 21, 0, true)
writePng('Structures/wall.png', wall.w, wall.h, wall.px)

const floor = new Canvas(16 * 17, 16)
for (let b = 0; b < 16; b++) floorEdge(floor, 16 * b, 0, b)
floorLip(floor, 16 * 16)
writePng('Structures/floor.png', floor.w, floor.h, floor.px)

const stairs = new Canvas(16 * 4, 32)
stairsNorth(stairs, 0)
stairsEast(stairs, 16, false)
stairsSouth(stairs, 32)
stairsEast(stairs, 48, true)
writePng('Structures/stairs.png', stairs.w, stairs.h, stairs.px)
