// The oblique renderer of the project's buildings (docs/showcase.md §3): a building modelled in solids (shapes.ts) is
// drawn in the game's own projection — the 3/4 view, where a point h up is drawn h pixels above where it stands, as a
// cell is drawn as deep as it is wide — then shaded and textured by its materials (materials.ts) in the pack's manner
// (flat tones, a dark line where one mass stands before another, the ink round it), with ornaments laid on its faces
// (ornaments.ts), and cut into strips, a strip for each row of its footprint: what is seen of the row's own solids,
// drawn at the row's depth. So one standing beside the building at any row is drawn before what stands north of them
// and behind what stands south, wherever the building rises over them.

import type { Solid } from './shapes.ts'
import { MATERIALS, PALETTE, type Surface } from './materials.ts'

export const T = 16

/** A 2D picture laid on a south face: rows of palette keys (' ' none), its bottom-left at (x, z) on the face y. */
export interface Ornament {
  x: number
  y: number
  z: number
  rows: string[]
  keys: Record<string, string>
  /** Draw it over any face it meets, not only the face at y (a cross on a spire's tip, a banner on a pole). */
  free?: boolean
}

export interface Model {
  name: string
  /** The footprint in cells: a row a string, a cell a character — '#' solid, 'D' a door, '.' walkable under it, ' ' open. */
  footprint: string[]
  solids: Solid[]
  voids?: Solid[]
  ornaments?: Ornament[]
  /** The light: from the west and up, a little from the south (the pack's light, top left). */
  light?: [number, number, number]
  /** Laid as ground, under whoever stands on it (a bridge's deck, a quay's stair), its solid cells this terrain. */
  ground?: boolean
  terrain?: string
}

/** What a pixel of the picture shows: the point it hits and of which solid. */
interface Hit {
  x: number
  y: number
  z: number
  s: number
}

/** A strip of the building: what is seen of footprint row `row`, in the atlas at (ax, ay), `tw` by `th` tiles. */
export interface Slice {
  row: number
  col: number
  tw: number
  th: number
  ax: number
  ay: number
  grid: string[]
}

export interface Rendered {
  name: string
  w: number
  d: number
  /** The whole picture (for review), RGBA, `pw` by `ph`, its ground's top-left at (0, top). */
  rgba: Uint8Array
  pw: number
  ph: number
  top: number
  /** Each pixel's footprint row, or -1. */
  rows: Int16Array
  /** Its shadow on the ground: RGBA `cw` by `ch` cells, its top-left at (cx0, cy0) cells from the footprint's. */
  shadow?: { rgba: Uint8Array; cx0: number; cy0: number; cw: number; ch: number }
}

class Grid {
  private cells = new Map<string, Solid[]>()
  constructor(solids: Solid[]) {
    for (const s of solids)
      for (let cy = Math.floor(s.b[1] / T); cy <= Math.floor(s.b[4] / T); cy++)
        for (let cx = Math.floor(s.b[0] / T); cx <= Math.floor(s.b[3] / T); cx++) {
          const k = `${cx},${cy}`
          const l = this.cells.get(k)
          if (l) l.push(s)
          else this.cells.set(k, [s])
        }
  }
  at(x: number, y: number): Solid[] {
    return this.cells.get(`${Math.floor(x / T)},${Math.floor(y / T)}`) ?? []
  }
}

export function render(m: Model): Rendered {
  const w = m.footprint[0].length
  const d = m.footprint.length
  const solids = m.solids
  const voids = m.voids ?? []
  const maxZ = Math.max(...solids.map((s) => s.b[5]), 1)
  const top = Math.ceil((maxZ + 2) / T) * T
  const pw = w * T
  const ph = d * T + top
  const sg = new Grid(solids)
  const vg = new Grid(voids)
  const voided = (x: number, y: number, z: number) => vg.at(x, y).some((v) => v.inside(x, y, z))
  const occ = (x: number, y: number, z: number) => {
    if (z < 0) return false
    let cut: boolean | undefined
    for (const s of sg.at(x, y)) if (s.inside(x, y, z) && (s.uncut || !(cut ??= voided(x, y, z)))) return true
    return false
  }

  // ------------------------------------------------------------------ what each pixel sees: the highest point along its ray
  const hits: (Hit | null)[] = Array(pw * ph).fill(null)
  const best = new Float32Array(pw * ph).fill(-1)
  solids.forEach((s, si) => {
    const [x0, y0, z0, x1, y1, z1] = s.b
    for (let py = Math.max(0, Math.floor(y0 - z1 + top)); py < Math.min(ph, Math.ceil(y1 - z0 + top)); py++)
      for (let px = Math.max(0, Math.floor(x0)); px < Math.min(pw, Math.ceil(x1)); px++) {
        const X = px + 0.5
        const sy = py + 0.5 - top
        const tmin = Math.max(z0, y0 - sy, 0)
        const tmax = Math.min(z1, y1 - sy)
        if (tmin > tmax) continue
        const i = py * pw + px
        // (a later solid wins a tie: a tower stood in a roof's gable shows as the tower)
        if (tmax < best[i]) continue
        for (let t = tmax; t >= tmin && t >= best[i]; t -= 0.5) {
          const Y = sy + t
          if (s.inside(X, Y, t) && (s.uncut || !voided(X, Y, t))) {
            best[i] = t
            hits[i] = { x: X, y: Y, z: t, s: si }
            break
          }
        }
      }
  })

  // ------------------------------------------------------------------ each hit's surface: its facing, shade, shadow
  const L = norm(m.light ?? [-0.62, 0.3, 0.72])
  const keys: (string | null)[] = Array(pw * ph).fill(null)
  const classes: (Surface['cls'] | null)[] = Array(pw * ph).fill(null)
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i]
    if (!h) continue
    const n = normal(occ, h.x, h.y, h.z)
    const cls = classOf(n)
    classes[i] = cls
    let shadow = false
    // what stands between the point and the light (a tower over the nave's roof): marched toward the light
    for (let k = 3; k < 260; k += 2) {
      const qx = h.x + L[0] * k + n[0] * 1.2
      const qy = h.y + L[1] * k + n[1] * 1.2
      const qz = h.z + L[2] * k + n[2] * 1.2
      if (qz > maxZ + 1) break
      if (occ(qx, qy, qz)) {
        shadow = true
        break
      }
    }
    // how shut in it is: a recess, the foot of a wall under a roof
    let shut = 0
    for (const [dx, dy, dz] of AO) if (occ(h.x + dx + n[0] * 2, h.y + dy + n[1] * 2, h.z + dz + n[2] * 2)) shut++
    const s = solids[h.s]
    const upright = cls === 'south' || cls === 'north' || cls === 'east' || cls === 'west'
    const mat = s.paint?.(h.x, h.y, h.z) ?? (upright && s.side ? s.side : s.mat)
    const surf: Surface = { x: h.x, y: h.y, z: h.z, n, cls, shadow, shut, lit: Math.max(0, dot(n, L)) }
    const f = MATERIALS[mat]
    if (!f) throw new Error(`${m.name}: no material ${mat}`)
    keys[i] = f(surf)
  }

  // ------------------------------------------------------------------ the light along the top of every edge turned to it
  // (where a top or a slope breaks over the face under it, the pack's rim of light)
  for (let py = 0; py < ph - 1; py++)
    for (let px = 0; px < pw; px++) {
      const i = py * pw + px
      const c = classes[i]
      const below = classes[i + pw]
      if (!c || !below || !keys[i] || c === 'south' || c === 'east' || c === 'north') continue
      if (below !== 'south') continue
      const a = hits[i]!
      const b = hits[i + pw]!
      if (Math.abs(a.y + a.z - (b.y + b.z)) > 3) continue
      keys[i] = lighter(keys[i]!)
    }

  // ------------------------------------------------------------------ the ornaments, on the faces they lie on and where seen
  const rows = new Int16Array(pw * ph).fill(-1)
  const rowOf = (y: number) => Math.min(d - 1, Math.max(0, Math.floor((y - 0.01) / T)))
  for (let i = 0; i < hits.length; i++) if (hits[i]) rows[i] = rowOf(hits[i]!.y)
  for (const o of m.ornaments ?? []) {
    const h = o.rows.length
    o.rows.forEach((line, j) =>
      [...line].forEach((c, u) => {
        if (c === ' ') return
        const px = Math.round(o.x) + u
        const py = Math.round(o.y - o.z + top) - h + j
        if (px < 0 || py < 0 || px >= pw || py >= ph) return
        const i = py * pw + px
        const hit = hits[i]
        if (!o.free && (!hit || Math.abs(hit.y - o.y) > 3)) return
        if (o.free && hit && hit.y + hit.z > o.y + (o.z + (h - j)) + 2) return
        const key = o.keys[c]
        if (!key) throw new Error(`${m.name}: ornament key ${c}`)
        keys[i] = key
        if (!hit) rows[i] = rowOf(o.y)
      }),
    )
  }

  // ------------------------------------------------------------------ the lines: where one mass stands before another
  const ink = new Uint8Array(pw * ph)
  for (let py = 0; py < ph; py++)
    for (let px = 0; px < pw; px++) {
      const i = py * pw + px
      const h = hits[i]
      if (!h || !keys[i]) continue
      for (const [dx, dy] of N4) {
        const qx = px + dx
        const qy = py + dy
        if (qx < 0 || qy < 0 || qx >= pw || qy >= ph) continue
        const q = hits[qy * pw + qx]
        if (!q) continue
        // the nearer surface's edge is drawn on the farther one
        if (q.y + q.z - (h.y + h.z) > 7) ink[i] = 1
      }
    }
  for (let i = 0; i < ink.length; i++) if (ink[i]) keys[i] = 'k'
  // the ink round it all
  const add: [number, number][] = []
  for (let py = 0; py < ph; py++)
    for (let px = 0; px < pw; px++) {
      const i = py * pw + px
      if (keys[i]) continue
      let row = -1
      let near = -Infinity
      for (const [dx, dy] of N4) {
        const qx = px + dx
        const qy = py + dy
        if (qx < 0 || qy < 0 || qx >= pw || qy >= ph) continue
        const j = qy * pw + qx
        if (!keys[j] || keys[j] === 'k' && rows[j] < 0) continue
        const q = hits[j]
        const key = q ? q.y + q.z : 0
        if (key > near) (near = key), (row = rows[j])
      }
      if (row >= 0) add.push([i, row])
    }
  for (const [i, row] of add) (keys[i] = 'k'), (rows[i] = row)

  const rgba = new Uint8Array(pw * ph * 4)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (!k) continue
    const c = PALETTE[k]
    if (!c) throw new Error(`${m.name}: no colour ${k}`)
    rgba.set(c, i * 4)
  }
  return { name: m.name, w, d, rgba, pw, ph, top, rows, shadow: m.ground ? undefined : shadowOf(m, occ, L, maxZ) }
}

/**
 * The shadow the building throws on the ground round it (docs/showcase.md §3.1): every point of the ground, marched
 * toward the light, that meets the building — away from the light, east and a little north. Cells, relative to the
 * footprint's top-left; laid as ground under all that stands.
 */
function shadowOf(m: Model, occ: (x: number, y: number, z: number) => boolean, L: [number, number, number], maxZ: number): Rendered['shadow'] {
  const w = m.footprint[0].length
  const d = m.footprint.length
  const reach = Math.ceil((maxZ / L[2]) * Math.max(Math.abs(L[0]), Math.abs(L[1])) / T) + 1
  const cx0 = 0
  const cy0 = -reach
  const cw = w + reach
  const ch = d + reach
  const W = cw * T
  const H = ch * T
  const rgba = new Uint8Array(W * H * 4)
  const solid = (x: number, y: number) => y >= 0 && y < d && x >= 0 && x < w && m.footprint[y][x] !== ' '
  let any = false
  // at half the resolution (the shadow is soft enough), each sample marched up to the building's height
  for (let py = 0; py < H; py += 2)
    for (let px = 0; px < W; px += 2) {
      const X = cx0 * T + px + 1
      const Y = cy0 * T + py + 1
      if (solid(Math.floor(X / T), Math.floor(Y / T))) continue
      let dark = false
      for (let k = 2; k * L[2] < maxZ + 2; k += 3)
        if (occ(X + L[0] * k, Y + L[1] * k, L[2] * k)) {
          dark = true
          break
        }
      if (!dark) continue
      any = true
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) rgba.set([10, 12, 30, 72], ((py + dy) * W + px + dx) * 4)
    }
  return any ? { rgba, cx0, cy0, cw, ch } : undefined
}

/** The building cut into strips, a strip a footprint row, each as tall as what is seen of the row. */
export function slices(r: Rendered, footprint: string[]): { slice: Slice; rgba: Uint8Array }[] {
  const out: { slice: Slice; rgba: Uint8Array }[] = []
  for (let row = 0; row < r.d; row++) {
    let x0 = Infinity
    let x1 = -1
    let y0 = Infinity
    for (let i = 0; i < r.rows.length; i++)
      if (r.rows[i] === row) {
        const px = i % r.pw
        const py = Math.floor(i / r.pw)
        x0 = Math.min(x0, px)
        x1 = Math.max(x1, px)
        y0 = Math.min(y0, py)
      }
    const fp = footprint[row]
    const solid = /[#D.]/.test(fp)
    if (x1 < 0 && !solid) continue
    // the strip's columns: what is drawn, and the cells of the footprint (a solid cell nothing is drawn on still blocks)
    let c0 = x1 < 0 ? r.w : Math.floor(x0 / T)
    let c1 = x1 < 0 ? -1 : Math.floor(x1 / T)
    for (let c = 0; c < r.w; c++) if (fp[c] !== ' ') (c0 = Math.min(c0, c)), (c1 = Math.max(c1, c))
    const bottom = (row + 1) * T + r.top
    const topPx = x1 < 0 ? bottom - T : Math.min(bottom - T, Math.floor(y0 / T) * T)
    const tw = c1 - c0 + 1
    const th = (bottom - topPx) / T
    const rgba = new Uint8Array(tw * T * th * T * 4)
    for (let py = topPx; py < bottom; py++)
      for (let px = c0 * T; px < (c1 + 1) * T; px++) {
        const i = py * r.pw + px
        if (r.rows[i] !== row) continue
        rgba.set(r.rgba.subarray(i * 4, i * 4 + 4), ((py - topPx) * tw * T + (px - c0 * T)) * 4)
      }
    const grid = [...Array(th - 1).fill(' '.repeat(tw)), fp.slice(c0, c1 + 1)]
    out.push({ slice: { row, col: c0, tw, th, ax: 0, ay: 0, grid }, rgba })
  }
  return out
}

/** A palette key a step lighter on its ramp (`s2` → `s1`). */
function lighter(k: string): string {
  const m = /^(.*?)(\d+)$/.exec(k)
  if (!m) return k
  return m[1] + Math.max(0, Number(m[2]) - 1)
}

const AO: [number, number, number][] = [
  [3, 0, 0], [-3, 0, 0], [0, 3, 0], [0, -3, 0], [0, 0, 3], [2, 2, 2], [-2, 2, 2], [2, -2, 2], [-2, -2, 2],
]
const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

function norm(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(...v) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** The surface's facing at a point just inside it: the ways out of the solid close by, summed. */
function normal(occ: (x: number, y: number, z: number) => boolean, x: number, y: number, z: number): [number, number, number] {
  const n: [number, number, number] = [0, 0, 0]
  for (const r of [1.5, 3]) {
    if (!occ(x + r, y, z)) n[0] += 1
    if (!occ(x - r, y, z)) n[0] -= 1
    if (!occ(x, y + r, z)) n[1] += 1
    if (!occ(x, y - r, z)) n[1] -= 1
    if (!occ(x, y, z + r)) n[2] += 1
    if (!occ(x, y, z - r)) n[2] -= 1
  }
  if (!n[0] && !n[1] && !n[2]) return [0, 0, 1]
  return norm(n)
}

/** A facing by name: what the materials shade by. */
export function classOf(n: [number, number, number]): Surface['cls'] {
  const [x, y, z] = n
  if (z > 0.8) return 'top'
  if (y > 0.8) return 'south'
  if (z > 0.25) {
    if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 'slopeW' : 'slopeE'
    return y > 0 ? 'slopeS' : 'slopeN'
  }
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? 'west' : 'east'
  return y > 0 ? 'south' : 'north'
}
