// The builder's brushes (docs/engine-split.md §6: the map DSL's tools of composition become the editor's brushes,
// games/openworld/tools/src/demo/builder.ts): a curved path through points, an organic patch, small things
// scattered by a mask, a fenced yard. Each paints a map file's data — its rows and its entities — from a seed of
// its own, and leaves a record of itself in the map (`strokes`: what was drawn, with which seed), so the same
// stroke draws the same again and the author sees how the data came to be.

import type { Entity, PropValue, RawChunk } from '@openworld/engine'

export type Cell = [number, number]

/** A stroke as the map keeps it. */
export interface Stroke {
  brush: 'path' | 'organic' | 'scatter' | 'yard'
  seed: number
  /** The rectangle it covered: x, y, w, h. */
  at: [number, number, number, number]
  params?: Record<string, PropValue>
}

/** The same numbers from the same seed (mulberry32). */
export function rngOf(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const inMap = (c: RawChunk, x: number, y: number) => x >= 0 && y >= 0 && x < c.map.width && y < c.map.height
const get = (c: RawChunk, x: number, y: number) => c.map.rows[y]?.[x]
function set(c: RawChunk, x: number, y: number, ch: string): void {
  const r = c.map.rows[y]
  c.map.rows[y] = r.slice(0, x) + ch + r.slice(x + 1)
}
function record(c: RawChunk, s: Stroke): Stroke {
  ;(c.map.strokes ??= []).push(s)
  return s
}
const bounds = (cells: Iterable<Cell>): [number, number, number, number] => {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, y] of cells) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y))
  return x0 === Infinity ? [0, 0, 0, 0] : [x0, y0, x1 - x0 + 1, y1 - y0 + 1]
}

/**
 * A curved path through the points (a Catmull-Rom spline through cell centres): `width` 1 is a 4-connected trail,
 * wider is painted as discs; `edge` frays its border with that character at chance `edgeP`. It paints only over
 * the characters `over` allows (default: anything not in `keep`).
 */
export function paintPath(c: RawChunk, points: Cell[], ch: string, seed: number, o: { width?: number; edge?: string; edgeP?: number; keep?: string[] } = {}): Stroke {
  const r = rngOf(seed)
  const width = o.width ?? 2
  const keep = new Set(o.keep ?? [])
  const P = [points[0], ...points, points[points.length - 1]]
  const paint = new Set<string>()
  const centre: Cell[] = []
  const add = (x: number, y: number) => inMap(c, x, y) && paint.add(`${x},${y}`)
  const visit = (px: number, py: number) => {
    const cx = Math.floor(px)
    const cy = Math.floor(py)
    const last = centre[centre.length - 1]
    if (width <= 1 && last && last[0] !== cx && last[1] !== cy) add(cx, last[1])
    centre.push([cx, cy])
    if (width <= 1) return void add(cx, cy)
    const rad = width / 2
    for (let y = Math.floor(py - rad) - 1; y <= Math.ceil(py + rad); y++) for (let x = Math.floor(px - rad) - 1; x <= Math.ceil(px + rad); x++) if (Math.hypot(x + 0.5 - px, y + 0.5 - py) <= rad) add(x, y)
  }
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]]
    const steps = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 4))
    for (let s = 0; s <= steps; s++) {
      const u = s / steps
      const f = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u * u + (-a + 3 * b - 3 * cc + d) * u * u * u)
      visit(f(p0[0], p1[0], p2[0], p3[0]) + 0.5, f(p0[1], p1[1], p2[1], p3[1]) + 0.5)
    }
  }
  if (points.length === 1) visit(points[0][0] + 0.5, points[0][1] + 0.5)
  const cells = [...paint].map((k) => k.split(',').map(Number) as Cell)
  for (const [x, y] of cells) if (!keep.has(get(c, x, y)!)) set(c, x, y, ch)
  if (o.edge)
    for (const [x, y] of cells)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (!inMap(c, nx, ny) || paint.has(`${nx},${ny}`) || keep.has(get(c, nx, ny)!) || get(c, nx, ny) === ch) continue
        if (r() < (o.edgeP ?? 0.35)) set(c, nx, ny, o.edge)
      }
  return record(c, { brush: 'path', seed, at: bounds(cells), params: { char: ch, width, points: JSON.stringify(points), ...(o.edge && { edge: o.edge }) } })
}

/** An organic patch: an ellipse whose edge wanders with the angle (a pond's shore, a clearing, a grove). Only over `only`, when given. */
export function paintOrganic(c: RawChunk, cx: number, cy: number, rx: number, ry: number, ch: string, seed: number, o: { rough?: number; only?: string[] } = {}): Stroke {
  const r = rngOf(seed)
  const rough = o.rough ?? 0.22
  const only = o.only && new Set(o.only)
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28]
  const cells: Cell[] = []
  for (let y = Math.floor(cy - ry * (1 + rough)) - 1; y <= Math.ceil(cy + ry * (1 + rough)) + 1; y++)
    for (let x = Math.floor(cx - rx * (1 + rough)) - 1; x <= Math.ceil(cx + rx * (1 + rough)) + 1; x++) {
      if (!inMap(c, x, y)) continue
      const dx = (x + 0.5 - cx) / Math.max(0.5, rx)
      const dy = (y + 0.5 - cy) / Math.max(0.5, ry)
      const a = Math.atan2(dy, dx)
      const lim = 1 + rough * (0.5 * Math.sin(3 * a + ph[0]) + 0.3 * Math.sin(5 * a + ph[1]) + 0.2 * Math.sin(7 * a + ph[2]))
      if (Math.hypot(dx, dy) <= lim && (!only || only.has(get(c, x, y)!))) (set(c, x, y, ch), cells.push([x, y]))
    }
  return record(c, { brush: 'organic', seed, at: bounds(cells), params: { char: ch, rx, ry, rough } })
}

/** A new entity id on the map: its id, the kind's, a number not taken. */
export function freshId(c: RawChunk, type: string, taken: Set<string>): string {
  const base = `${c.map.id}.${type.split('/').pop()}`
  for (let n = 1; ; n++) if (!taken.has(`${base}${n}`)) return (taken.add(`${base}${n}`), `${base}${n}`)
}

/**
 * Small things by a mask: on each cell of the rectangle whose ground is one of `on` (default: any) and where no
 * thing stands, a thing of `type` at chance `p` — flowers along a path, stones at a cliff's foot, never noise
 * over everything. `taken`: the ids already used (the project's).
 */
export function scatter(c: RawChunk, rect: [number, number, number, number], type: string, p: number, seed: number, taken: Set<string>, o: { on?: string[] } = {}): Stroke {
  const r = rngOf(seed)
  const on = o.on && new Set(o.on)
  const [rx, ry, rw, rh] = rect
  const stands = new Set(c.entities.flatMap((e) => (e.place.on === 'tile' ? [`${e.place.x},${e.place.y}`] : [])))
  let n = 0
  for (let y = ry; y < ry + rh; y++)
    for (let x = rx; x < rx + rw; x++) {
      if (!inMap(c, x, y) || stands.has(`${x},${y}`) || (on && !on.has(get(c, x, y)!)) || r() >= p) continue
      c.entities.push({ id: freshId(c, type, taken), type, place: { on: 'tile', map: c.map.id, x, y } } as Entity)
      n++
    }
  return record(c, { brush: 'scatter', seed, at: rect, params: { type, p, placed: n, ...(o.on && { on: o.on.join('') }) } })
}

/** A fenced yard: a fence piece (a fixture of `type`) on each cell of the rectangle's outline, but the gates. */
export function yard(c: RawChunk, rect: [number, number, number, number], type: string, taken: Set<string>, gates: Cell[] = []): Stroke {
  const [x0, y0, w, h] = rect
  const open = new Set(gates.map(([x, y]) => `${x},${y}`))
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1
      if (!edge || open.has(`${x},${y}`) || !inMap(c, x, y)) continue
      c.entities.push({ id: freshId(c, type, taken), type, place: { on: 'tile', map: c.map.id, x, y } } as Entity)
    }
  return record(c, { brush: 'yard', seed: 0, at: rect, params: { type, gates: JSON.stringify(gates) } })
}
