// Core helpers for the procedural pixel-art module: a tiny RGBA pixel buffer, colour maths
// (hue-shifted shading in the SNES/Ninja-Adventure tradition), a deterministic hash, grid
// stamping from compact string sprites, automatic 1-px outlines, and sheet packing.
// Everything is deterministic: no Math.random anywhere.

export interface Frame {
  name: string
  x: number
  y: number
  w: number
  h: number
}

export interface Sheet {
  canvas: HTMLCanvasElement
  frames: Frame[]
}

// ---------------------------------------------------------------------------------------
// Colour

export type RGB = [number, number, number]

const hexCache = new Map<string, RGB>()

export function rgb(hex: string): RGB {
  let c = hexCache.get(hex)
  if (c) return c
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h.slice(0, 6), 16)
  c = Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [255, 0, 255]
  hexCache.set(hex, c)
  return c
}

export function toHex([r, g, b]: RGB): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return '#' + f(r) + f(g) + f(b)
}

export function mix(a: string, b: string, t: number): string {
  const x = rgb(a)
  const y = rgb(b)
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t])
}

function toHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

function fromHsl(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

function hueToward(h: number, target: number, amt: number): number {
  let d = target - h
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return h + d * amt
}

/**
 * Hue-shifted shading. amt < 0 darkens (and drifts hue toward cool violet, raising
 * saturation a little), amt > 0 lightens (drifting toward warm yellow). |amt| ~0.1–0.4.
 */
export function shade(hex: string, amt: number): string {
  const [h, s, l] = toHsl(rgb(hex))
  if (amt < 0) {
    const a = -amt
    const nh = s < 0.08 ? h : hueToward(h, 250, a * 0.35)
    return toHex(fromHsl(nh, Math.min(1, s + a * 0.12), Math.max(0, l - a * (0.55 + l * 0.2))))
  }
  const nh = s < 0.08 ? h : hueToward(h, 55, amt * 0.3)
  return toHex(fromHsl(nh, Math.max(0, s - amt * 0.08), Math.min(1, l + amt * (1 - l) * 1.1)))
}

/** Replace hue/saturation of `hex` keeping a similar lightness profile (for tinting parts). */
export function tint(hex: string, toward: string, t: number): string {
  return mix(hex, toward, t)
}

export function lum(hex: string): number {
  const [r, g, b] = rgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Base / shade / light triplet from one colour. */
export function ramp(hex: string, d = 0.28, l = 0.3): { base: string; dark: string; light: string; deep: string } {
  return { base: hex, dark: shade(hex, -d), light: shade(hex, l), deep: shade(hex, -d * 2) }
}

export const OUTLINE = '#1a1522'

// ---------------------------------------------------------------------------------------
// Deterministic hashing

export function hash(...xs: number[]): number {
  let h = 0x811c9dc5
  for (const x of xs) {
    h ^= x | 0
    h = Math.imul(h, 0x01000193)
    h ^= h >>> 15
    h = Math.imul(h, 0x2c1b3c6d)
    h ^= h >>> 12
  }
  h ^= h >>> 16
  return h >>> 0
}

export function strHash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Seeded float in [0,1). */
export function rnd(...xs: number[]): number {
  return hash(...xs) / 4294967296
}

/** Small seeded PRNG for sequential decisions. */
export class Rand {
  private s: number
  constructor(seed: number) {
    this.s = seed >>> 0 || 1
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  int(n: number): number {
    return Math.floor(this.next() * n)
  }
  range(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1))
  }
  pick<T>(xs: T[]): T {
    return xs[this.int(xs.length)]
  }
  chance(p: number): boolean {
    return this.next() < p
  }
}

// ---------------------------------------------------------------------------------------
// Pixel buffer

export class Pix {
  readonly w: number
  readonly h: number
  /** RGBA bytes. */
  readonly d: Uint8ClampedArray

  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.d = new Uint8ClampedArray(w * h * 4)
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h
  }

  alpha(x: number, y: number): number {
    if (!this.inside(x, y)) return 0
    return this.d[(y * this.w + x) * 4 + 3]
  }

  get(x: number, y: number): string | null {
    if (!this.inside(x, y)) return null
    const i = (y * this.w + x) * 4
    if (this.d[i + 3] === 0) return null
    return toHex([this.d[i], this.d[i + 1], this.d[i + 2]])
  }

  /** Paint a pixel. alpha in 0..1 blends over what is there. */
  set(x: number, y: number, c: string | null | undefined, alpha = 1): void {
    x = Math.floor(x)
    y = Math.floor(y)
    if (!c || !this.inside(x, y)) return
    const [r, g, b] = rgb(c)
    const i = (y * this.w + x) * 4
    if (alpha >= 1) {
      this.d[i] = r
      this.d[i + 1] = g
      this.d[i + 2] = b
      this.d[i + 3] = 255
      return
    }
    const da = this.d[i + 3] / 255
    const oa = alpha + da * (1 - alpha)
    if (oa <= 0) return
    this.d[i] = (r * alpha + this.d[i] * da * (1 - alpha)) / oa
    this.d[i + 1] = (g * alpha + this.d[i + 1] * da * (1 - alpha)) / oa
    this.d[i + 2] = (b * alpha + this.d[i + 2] * da * (1 - alpha)) / oa
    this.d[i + 3] = oa * 255
  }

  clear(x: number, y: number): void {
    if (!this.inside(x, y)) return
    const i = (y * this.w + x) * 4
    this.d[i] = this.d[i + 1] = this.d[i + 2] = this.d[i + 3] = 0
  }

  /** Paint only where something is already opaque. */
  over(x: number, y: number, c: string, alpha = 1): void {
    if (this.alpha(x, y) > 0) this.set(x, y, c, alpha)
  }

  rect(x: number, y: number, w: number, h: number, c: string, alpha = 1): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, alpha)
  }

  hline(x0: number, x1: number, y: number, c: string): void {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c)
  }

  vline(x: number, y0: number, y1: number, c: string): void {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c)
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string): void {
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.set(x0, y0, c)
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

  /** Filled ellipse centred at (cx,cy) (may be fractional) with radii rx, ry. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string | ((x: number, y: number, nx: number, ny: number) => string | null), alpha = 1): void {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const nx = (x + 0.5 - cx) / rx
        const ny = (y + 0.5 - cy) / ry
        if (nx * nx + ny * ny <= 1) {
          const col = typeof c === 'function' ? c(x, y, nx, ny) : c
          if (col) this.set(x, y, col, alpha)
        }
      }
  }

  /** Stamp a string grid. '.' and ' ' are transparent; unknown chars are skipped. */
  stamp(rows: string[], pal: Record<string, string | null | undefined>, ox = 0, oy = 0, flip = false): void {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j]
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]
        if (ch === '.' || ch === ' ') continue
        const c = pal[ch]
        if (!c) continue
        const x = flip ? ox + row.length - 1 - i : ox + i
        this.set(x, oy + j, c)
      }
    }
  }

  /** Copy another buffer onto this one (alpha-aware). */
  blit(src: Pix, ox = 0, oy = 0, flip = false, alphaMul = 1): void {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4
        const a = src.d[i + 3]
        if (!a) continue
        const tx = flip ? ox + src.w - 1 - x : ox + x
        this.set(tx, oy + y, toHex([src.d[i], src.d[i + 1], src.d[i + 2]]), (a / 255) * alphaMul)
      }
  }

  clone(): Pix {
    const p = new Pix(this.w, this.h)
    p.d.set(this.d)
    return p
  }

  flipped(): Pix {
    const p = new Pix(this.w, this.h)
    p.blit(this, 0, 0, true)
    return p
  }

  /**
   * Add a 1-px outline around the opaque silhouette (4-neighbourhood, or 8 with `diag`).
   * The outline colour is the average neighbour colour pushed hard toward `dark`, which
   * gives the slightly tinted near-black outlines of modern 16-bit-style packs.
   */
  outline(dark = OUTLINE, strength = 0.78, diag = false): void {
    const src = this.clone()
    const nb = diag
      ? [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ]
      : [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (src.alpha(x, y) > 40) continue
        let r = 0
        let g = 0
        let b = 0
        let n = 0
        for (const [dx, dy] of nb) {
          const a = src.alpha(x + dx, y + dy)
          if (a > 100) {
            const i = ((y + dy) * this.w + x + dx) * 4
            r += src.d[i]
            g += src.d[i + 1]
            b += src.d[i + 2]
            n++
          }
        }
        if (n) {
          const avg = toHex([r / n, g / n, b / n])
          this.set(x, y, mix(avg, dark, strength))
        }
      }
  }

  /** Recolour every opaque pixel through a function. */
  map(fn: (c: string, x: number, y: number, a: number) => string | null): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4
        const a = this.d[i + 3]
        if (!a) continue
        const c = fn(toHex([this.d[i], this.d[i + 1], this.d[i + 2]]), x, y, a)
        if (c === null) this.clear(x, y)
        else {
          const [r, g, b] = rgb(c)
          this.d[i] = r
          this.d[i + 1] = g
          this.d[i + 2] = b
        }
      }
  }

  /** Shift the whole image, leaving transparency behind. */
  shifted(dx: number, dy: number): Pix {
    const p = new Pix(this.w, this.h)
    p.blit(this, dx, dy)
    return p
  }

  /** Multiply the alpha of everything. */
  fade(a: number): void {
    for (let i = 3; i < this.d.length; i += 4) this.d[i] = this.d[i] * a
  }
}

// ---------------------------------------------------------------------------------------
// Canvas & sheets

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  const ctx = c.getContext('2d')
  if (ctx) ctx.imageSmoothingEnabled = false
  return c
}

/**
 * Pack named buffers into one canvas. Frames are laid out left-to-right in rows of `cols`
 * (row height = tallest frame in that row).
 */
export function pack(items: { name: string; pix: Pix }[], cols = 8): Sheet {
  const frames: Frame[] = []
  let x = 0
  let y = 0
  let rowH = 0
  let maxW = 0
  items.forEach((it, i) => {
    if (i > 0 && i % cols === 0) {
      y += rowH
      x = 0
      rowH = 0
    }
    frames.push({ name: it.name, x, y, w: it.pix.w, h: it.pix.h })
    x += it.pix.w
    rowH = Math.max(rowH, it.pix.h)
    maxW = Math.max(maxW, x)
  })
  const canvas = makeCanvas(maxW, y + rowH)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  items.forEach((it, i) => {
    const f = frames[i]
    const img = ctx.createImageData(it.pix.w, it.pix.h)
    img.data.set(it.pix.d)
    ctx.putImageData(img, f.x, f.y)
  })
  return { canvas, frames }
}

/** Grid layout with fixed columns and fixed cell size (used for character sheets). */
export function packGrid(items: { name: string; pix: Pix }[], cols: number, cw: number, ch: number): Sheet {
  const rows = Math.ceil(items.length / cols)
  const canvas = makeCanvas(cols * cw, rows * ch)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const frames: Frame[] = items.map((it, i) => {
    const x = (i % cols) * cw
    const y = Math.floor(i / cols) * ch
    const img = ctx.createImageData(it.pix.w, it.pix.h)
    img.data.set(it.pix.d)
    ctx.putImageData(img, x, y)
    return { name: it.name, x, y, w: it.pix.w, h: it.pix.h }
  })
  return { canvas, frames }
}

export function leaf(s: string): string {
  const i = Math.max(s.lastIndexOf(':'), s.lastIndexOf('/'))
  return i >= 0 ? s.slice(i + 1) : s
}

/** Element accent colours shared by icons, creatures and effects. */
export const ELEMENT_COLORS: Record<string, { base: string; light: string; dark: string; glow: string }> = {
  fire: { base: '#f0642a', light: '#ffd35a', dark: '#a8261e', glow: '#ff9a3c' },
  water: { base: '#3b8ee8', light: '#9fdcff', dark: '#1f4fa0', glow: '#63b6ff' },
  ice: { base: '#8fd8f2', light: '#effcff', dark: '#4a8fc0', glow: '#bff0ff' },
  lightning: { base: '#f5d63a', light: '#fffbc8', dark: '#b08a12', glow: '#fff07a' },
  wind: { base: '#8fe0b0', light: '#e8fff2', dark: '#3f9a70', glow: '#bff5d5' },
  earth: { base: '#b08a4a', light: '#e2c690', dark: '#6a4f28', glow: '#d8b070' },
}
