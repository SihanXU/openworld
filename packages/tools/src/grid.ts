// A mutable char grid for map generation (one char per terrain, see TERRAIN_CHARS).

import type { Rng } from '@lsw/engine'

export type Side = 'N' | 'E' | 'S' | 'W'

export interface Exit {
  side: Side
  /** First tile of the opening along the side. */
  at: number
  len: number
  to?: string // destination map id
}

export class Grid {
  cells: string[][]
  constructor(
    public w: number,
    public h: number,
    fill: string,
  ) {
    this.cells = Array.from({ length: h }, () => Array(w).fill(fill))
  }
  in(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h
  }
  get(x: number, y: number) {
    return this.in(x, y) ? this.cells[y][x] : 'V'
  }
  set(x: number, y: number, c: string) {
    if (this.in(x, y)) this.cells[y][x] = c
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c)
  }
  frame(x: number, y: number, w: number, h: number, c: string) {
    for (let i = x; i < x + w; i++) (this.set(i, y, c), this.set(i, y + h - 1, c))
    for (let j = y; j < y + h; j++) (this.set(x, j, c), this.set(x + w - 1, j, c))
  }
  border(c: string, thick = 1) {
    for (let t = 0; t < thick; t++) this.frame(t, t, this.w - 2 * t, this.h - 2 * t, c)
  }
  count(c: string) {
    let n = 0
    for (const row of this.cells) for (const x of row) if (x === c) n++
    return n
  }
  rows(): string[] {
    return this.cells.map((r) => r.join(''))
  }
  /** L-shaped road between two points (width w), only over cells `over` allows. */
  road(ax: number, ay: number, bx: number, by: number, c: string, w = 1, rng?: Rng, over?: (ch: string) => boolean) {
    const put = (x: number, y: number) => {
      for (let d = 0; d < w; d++)
        for (const [px, py] of [[x + d, y], [x, y + d]]) if (!over || over(this.get(px, py))) this.set(px, py, c)
    }
    const horizFirst = rng ? rng.chance(0.5) : true
    let x = ax
    let y = ay
    const stepX = () => {
      while (x !== bx) {
        put(x, y)
        x += Math.sign(bx - x)
      }
    }
    const stepY = () => {
      while (y !== by) {
        put(x, y)
        y += Math.sign(by - y)
      }
    }
    if (horizFirst) (stepX(), stepY())
    else (stepY(), stepX())
    put(bx, by)
  }
  /** Cells of an opening on a side. */
  exitCells(e: Exit): [number, number][] {
    const out: [number, number][] = []
    for (let i = 0; i < e.len; i++) {
      const k = e.at + i
      if (e.side === 'N') out.push([k, 0])
      if (e.side === 'S') out.push([k, this.h - 1])
      if (e.side === 'W') out.push([0, k])
      if (e.side === 'E') out.push([this.w - 1, k])
    }
    return out
  }
  /** The tile just inside an exit cell (arrival point). */
  inward(e: Exit, i: number): [number, number] {
    const [x, y] = this.exitCells(e)[i]
    if (e.side === 'N') return [x, y + 1]
    if (e.side === 'S') return [x, y - 1]
    if (e.side === 'W') return [x + 1, y]
    return [x - 1, y]
  }
  /** Carve an opening through the border and a road from it toward (cx, cy). */
  openExit(e: Exit, road: string, cx: number, cy: number, depth = 3) {
    for (const [x, y] of this.exitCells(e)) {
      for (let d = 0; d < depth; d++) {
        const px = e.side === 'W' ? x + d : e.side === 'E' ? x - d : x
        const py = e.side === 'N' ? y + d : e.side === 'S' ? y - d : y
        this.set(px, py, road)
      }
    }
    const [sx, sy] = this.inward(e, Math.floor(e.len / 2))
    return { sx, sy, cx, cy }
  }
}

/** Cheap value noise in [0,1) for organic shapes. */
export function noise2(seed: number, x: number, y: number, scale: number): number {
  const xf = x / scale
  const yf = y / scale
  const x0 = Math.floor(xf)
  const y0 = Math.floor(yf)
  const fx = xf - x0
  const fy = yf - y0
  const h = (i: number, j: number) => {
    let n = (i * 374761393 + j * 668265263 + seed * 1442695041) | 0
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296
  }
  const s = (t: number) => t * t * (3 - 2 * t)
  const a = h(x0, y0)
  const b = h(x0 + 1, y0)
  const c = h(x0, y0 + 1)
  const d = h(x0 + 1, y0 + 1)
  return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy)
}
