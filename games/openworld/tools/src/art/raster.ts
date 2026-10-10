// A small raster for the project's own pixel art drawn by code (the bosses): a grid of palette
// keys, primitives (pixels, rectangles, lines, polygons, ellipses), an outline pass in the pack's
// style (a dark pixel round every drawn shape), and an atlas writer.

import { writePng } from './png.ts'

export type RGBA = [number, number, number, number]
export type Palette = Record<string, RGBA>

export class Raster {
  readonly px: (string | null)[]
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = Array(w * h).fill(null)
  }

  get(x: number, y: number): string | null {
    x = Math.round(x)
    y = Math.round(y)
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.px[y * this.w + x]
  }

  set(x: number, y: number, c: string | null): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.px[y * this.w + x] = c
  }

  /** Only where nothing is drawn yet (to paint behind). */
  under(x: number, y: number, c: string): void {
    if (this.get(x, y) === null) this.set(x, y, c)
  }

  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c)
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string, width = 1): void {
    x0 = Math.round(x0)
    y0 = Math.round(y0)
    x1 = Math.round(x1)
    y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      if (width <= 1) this.set(x0, y0, c)
      else this.rect(x0 - Math.floor((width - 1) / 2), y0 - Math.floor((width - 1) / 2), width, width, c)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x0 += sx
      }
      if (e2 <= dx) {
        err += dx
        y0 += sy
      }
    }
  }

  /** A filled polygon (even-odd scanline at pixel centres). */
  poly(pts: [number, number][], c: string): void {
    const ys = pts.map((p) => p[1])
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs: number[] = []
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i]
        const [bx, by] = pts[(i + 1) % pts.length]
        const cy = y + 0.5
        if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax))
      }
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.set(x, y, c)
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x - cx) / (rx + 0.01)) ** 2 + ((y - cy) / (ry + 0.01)) ** 2 <= 1) this.set(x, y, c)
  }

  /** The pack's outline: a dark pixel on every empty pixel beside a drawn one (keys in `skip` cast none). */
  outline(c = 'k', skip: string[] = []): void {
    const add: number[] = []
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.px[y * this.w + x] !== null) continue
        const n = [this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)]
        if (n.some((v) => v !== null && v !== c && !skip.includes(v))) add.push(y * this.w + x)
      }
    for (const i of add) this.px[i] = c
  }

  /** Every pixel of one key becomes another (a hurt flash). */
  recolor(map: Record<string, string>): void {
    for (let i = 0; i < this.px.length; i++) {
      const v = this.px[i]
      if (v !== null && map[v]) this.px[i] = map[v]
    }
  }

  /** Mirror left to right. */
  flip(): Raster {
    const r = new Raster(this.w, this.h)
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) r.px[y * this.w + x] = this.px[y * this.w + (this.w - 1 - x)]
    return r
  }
}

/** Frames into one atlas (rows of columns), written as a PNG under public/assets/lsw/. */
export function writeAtlas(path: string, rows: Raster[][], pal: Palette): void {
  const fw = rows[0][0].w
  const fh = rows[0][0].h
  const cols = Math.max(...rows.map((r) => r.length))
  const W = cols * fw
  const H = rows.length * fh
  const px = new Uint8Array(W * H * 4)
  rows.forEach((row, ry) =>
    row.forEach((f, cx) => {
      for (let y = 0; y < fh; y++)
        for (let x = 0; x < fw; x++) {
          const k = f.px[y * fw + x]
          if (k === null) continue
          const c = pal[k]
          if (!c) throw new Error(`no colour for ${k}`)
          px.set(c, ((ry * fh + y) * W + cx * fw + x) * 4)
        }
    }),
  )
  writePng(path, W, H, px)
}
