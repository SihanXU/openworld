// The portrait's cut layers carry nothing that is not their part's (docs/looks.md §4): an edit redraws the whole
// figure, and what the cut took of the body's own lines and hatching shows, once repainted, as hair across a dress or
// a second outline down the legs. tools/src/art/looks/portrait/clean.py clears them; this holds what it leaves, by
// the same table (clean.json), read here independently of it.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PortraitLayer, PortraitManifest } from '@openworld/runtime/src/assets/figure/portrait.ts'
import { OUT, readPng } from '../src/art/png.ts'

const ROOT = join(OUT, 'Looks', 'portrait')
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as PortraitManifest
type Band = [['h' | 't', number], ['h' | 't', number]]
interface Slot {
  r: number
  reach?: number
  piece?: number
  band: Band
  head?: boolean
  eyes?: boolean
  reachOn?: number
}
const table = JSON.parse(readFileSync(join(import.meta.dirname, '../src/art/looks/portrait/clean.json'), 'utf8')) as {
  slots: Record<string, Slot>
  parts: Record<string, Partial<Slot>>
  speck: number
  faint: number
  ground: [number, number, number]
  groundTol: number
  groundPiece: number
  groundInset: number
  groundKept: string[]
}
/** A part's numbers: its slot's, with its own overrides. */
const params = (pid: string): Slot => ({ ...table.slots[pid.split('.')[0]], ...table.parts[pid] })
const W = manifest.w
const H = manifest.h

interface Pixels {
  paint: Uint8Array
  value: Uint8Array
}
const cache = new Map<string, Pixels>()
const pixels = (file: string): Pixels => {
  if (!cache.has(file)) cache.set(file, { paint: readPng(join(ROOT, file + '.png')).rgba, value: readPng(join(ROOT, file + '.z.png')).rgba })
  return cache.get(file)!
}

/** Python's round (half to even), as clean.py rounds a band's row. */
const pyRound = (x: number) => {
  const f = Math.floor(x)
  const d = x - f
  return d > 0.5 || (d === 0.5 && f % 2 !== 0) ? f + 1 : f
}

/** A body's frame from its layer, as clean.py reads it: the head's top, the neck, the soles. */
function frameOf(body: string) {
  const fig = new Uint8Array(W * H)
  for (const l of manifest.bodies[body].layers) {
    const { value } = pixels(l.file)
    for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (value[(y * l.w + x) * 4 + 3]) fig[(l.y + y) * W + l.x + x] = 1
  }
  const rows: number[] = []
  for (let y = 0; y < H; y++) {
    let n = 0
    for (let x = 0; x < W; x++) n += fig[y * W + x]
    rows.push(n)
  }
  const top = rows.findIndex((n) => n > 0)
  const soles = H - 1 - [...rows].reverse().findIndex((n) => n > 0)
  const tall = soles - top
  const lo = top + Math.floor(0.07 * tall)
  const hi = top + Math.floor(0.32 * tall)
  let neck = lo
  for (let y = lo; y < hi; y++) if ((rows[y] || 1 << 20) < (rows[neck] || 1 << 20)) neck = y
  const row = ([unit, f]: ['h' | 't', number]) => top + pyRound(f * (unit === 'h' ? neck - top : tall))
  return { fig, top, neck, soles, row }
}
const frames = Object.fromEntries(Object.keys(manifest.bodies).map((b) => [b, frameOf(b)]))

/** Components of a mask, 8-connected (or 4): a label per pixel (0: none) and their count. */
function label(m: Uint8Array, w: number, h: number, four = false): { lab: Int32Array; n: number } {
  const lab = new Int32Array(w * h)
  const stack = new Int32Array(w * h)
  let n = 0
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || lab[s]) continue
    lab[s] = ++n
    let sp = 0
    stack[sp++] = s
    while (sp) {
      const p = stack[--sp]
      const px = p % w
      const py = (p - px) / w
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = px + dx
          const y = py + dy
          if (x < 0 || y < 0 || x >= w || y >= h || (four && dx && dy)) continue
          const q = y * w + x
          if (m[q] && !lab[q]) ((lab[q] = n), (stack[sp++] = q))
        }
    }
  }
  return { lab, n }
}

/** A square (2r+1) min or max filter, outside the image 0 (scipy's binary erosion and dilation by a 3x3, r times):
 * per row, then per column, by a running count of the window's ones. */
function squareFilter(m: Uint8Array, w: number, h: number, r: number, max: boolean): Uint8Array {
  const pass = (src: Uint8Array, len: number, lines: number, at: (line: number, k: number) => number) => {
    const out = new Uint8Array(w * h)
    for (let line = 0; line < lines; line++) {
      let ones = 0
      for (let k = 0; k < Math.min(r, len); k++) ones += src[at(line, k)]
      for (let k = 0; k < len; k++) {
        if (k + r < len) ones += src[at(line, k + r)]
        if (k - r - 1 >= 0) ones -= src[at(line, k - r - 1)]
        // the window counts outside the image as 0: a min is 1 only with the whole window inside and all ones
        out[at(line, k)] = max ? +(ones > 0) : +(ones === 2 * r + 1)
      }
    }
    return out
  }
  const rows = pass(m, w, h, (y, x) => y * w + x)
  return pass(rows, h, w, (x, y) => y * w + x)
}

/** Where a body's faces draw their eyes, every face and mood (the zone of the `eyes` key), a little widened. */
function eyesOf(body: string): Uint8Array {
  const eyes = new Uint8Array(W * H)
  for (const [pid, bodies] of Object.entries(manifest.parts)) {
    const e = bodies[body]
    if (!e || !pid.startsWith('face.')) continue
    for (const l of [...e.layers, ...Object.values(e.moods ?? {}).flat()]) {
      const k = l.zones.indexOf('eyes') + 1
      if (!k) continue
      const { value } = pixels(l.file)
      for (let y = 0; y < l.h; y++)
        for (let x = 0; x < l.w; x++) {
          const i = (y * l.w + x) * 4
          if (value[i + 3] && value[i + 1] === 40 * k) eyes[(l.y + y) * W + l.x + x] = 1
        }
    }
  }
  return squareFilter(eyes, W, H, 3, true)
}
const eyes = Object.fromEntries(Object.keys(manifest.bodies).map((b) => [b, eyesOf(b)]))
/** A body inset by groundInset: a pale piece of a part well inside it is a highlight, at its edge or off it the ground. */
const inner = Object.fromEntries(Object.keys(manifest.bodies).map((b) => [b, squareFilter(frames[b].fig, W, H, table.groundInset, false)]))

/** The ground a layer took in (clean.py `ground_of`): pixels of the bases' ground colour keeping their paint, in pieces
 * of groundPiece or more or on the layer's outer edge, from a row down; a part's, only the pieces mostly off its body
 * inset or on its eyes (well inside the body, a pale piece is a highlight the part drew). Their count. */
function groundIn(l: PortraitLayer, fromRow = 0, body?: string): number {
  const { paint, value } = pixels(l.file)
  const { w, h } = l
  const near = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const close = [0, 1, 2].every((k) => Math.abs(paint[i * 4 + k] - table.ground[k]) < table.groundTol)
    if (close && value[i * 4 + 1] === 0 && value[i * 4 + 3] && Math.floor(i / w) >= fromRow) near[i] = 1
  }
  if (!near.some((v) => v)) return 0
  // the outside: the uncovered pixels (4-connected) that reach the layer's edge, a pixel's ring round it
  const pw = w + 2
  const bare = new Uint8Array(pw * (h + 2)).fill(1)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) bare[(y + 1) * pw + x + 1] = value[(y * w + x) * 4 + 3] ? 0 : 1
  const out = label(bare, pw, h + 2, true).lab
  const outside = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) outside[y * w + x] = out[(y + 1) * pw + x + 1] === out[0] ? 1 : 0
  const rim = squareFilter(outside, w, h, 1, true)
  const { lab, n } = label(near, w, h)
  const size = new Array(n + 1).fill(0)
  const edge = new Array(n + 1).fill(false)
  const off = new Array(n + 1).fill(0)
  const onEyes = new Array(n + 1).fill(0)
  for (let i = 0; i < w * h; i++) {
    const c = lab[i]
    if (!c) continue
    size[c]++
    if (rim[i]) edge[c] = true
    const at = (l.y + Math.floor(i / w)) * W + l.x + (i % w)
    if (body && !inner[body][at]) off[c]++
    if (body && eyes[body][at]) onEyes[c]++
  }
  let count = 0
  for (let c = 1; c <= n; c++)
    if ((size[c] >= table.groundPiece || edge[c]) && (!body || off[c] / size[c] > 0.5 || onEyes[c] / size[c] > 0.5)) count += size[c]
  return count
}

/** What of a part's union (its layers' coverage, cut to a box) clean.py keeps as the part's own. */
function kept(alpha: Uint8Array, w: number, h: number, oy: number, ox: number, pid: string, body: string): Uint8Array {
  const slot = params(pid)
  const fr = frames[body]
  const y0 = Math.max(fr.row(slot.band[0]), 0)
  const y1 = Math.max(fr.row(slot.band[1]) + 1, 0)
  const over = (y: number, x: number) => {
    const cy = oy + y
    const cx = ox + x
    return cy >= 0 && cx >= 0 && cy < H && cx < W && eyes[body][cy * W + cx] === 1
  }
  let m = new Uint8Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (alpha[y * w + x] && oy + y >= y0 && oy + y < y1 && !(slot.eyes === false && over(y, x))) m[y * w + x] = 1
  {
    const { lab, n } = label(m, w, h)
    const size = new Array(n + 1).fill(0)
    const peak = new Array(n + 1).fill(0)
    for (let i = 0; i < w * h; i++) if (lab[i]) (size[lab[i]]++, (peak[lab[i]] = Math.max(peak[lab[i]], alpha[i])))
    m = m.map((v, i) => (v && size[lab[i]] >= table.speck && peak[lab[i]] >= table.faint ? 1 : 0))
  }
  if (!slot.r) return m
  const solid = m.map((v, i) => (v && alpha[i] >= 128 ? 1 : 0))
  const eye = (i: number) => over(Math.floor(i / w), i % w)
  let core = squareFilter(squareFilter(solid, w, h, slot.r, false), w, h, slot.r, true)
  {
    const { lab, n } = label(core, w, h)
    const size = new Array(n + 1).fill(0)
    const onEyes = new Array(n + 1).fill(0)
    for (let i = 0; i < w * h; i++) if (lab[i]) (size[lab[i]]++, eye(i) && onEyes[lab[i]]++)
    // a solid piece of hair or a hat lying mostly on the eyes is an eye
    core = core.map((v, i) => (v && size[lab[i]] >= slot.piece! && !(slot.head && onEyes[lab[i]] / size[lab[i]] > 0.5) ? 1 : 0))
  }
  // grown back along the part's own pixels, a step (8-connected) at a time: how many steps each pixel is from the core
  const steps = new Int32Array(w * h).fill(-1)
  let front: number[] = []
  for (let i = 0; i < w * h; i++) if (core[i]) (steps[i] = 0, front.push(i))
  for (let step = 1; step <= slot.reach! && front.length; step++) {
    const next: number[] = []
    for (const p of front) {
      const px = p % w
      const py = (p - px) / w
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = px + dx
          const y = py + dy
          if (x < 0 || y < 0 || x >= w || y >= h) continue
          const q = y * w + x
          if (m[q] && steps[q] < 0) ((steps[q] = step), next.push(q))
        }
    }
    front = next
  }
  const onBody = (i: number) => {
    const y = oy + Math.floor(i / w)
    const x = ox + (i % w)
    return x >= 0 && y >= 0 && x < W && y < H && fr.fig[y * W + x] === 1
  }
  // on the body only a little; for what hangs from the head, nothing thin over the eyes
  const grown = new Uint8Array(w * h).map((_, i) =>
    steps[i] < 0 ? 0 : steps[i] === 0 ? 1 : (slot.reachOn !== undefined && onBody(i) && steps[i] > slot.reachOn) || (slot.head && eye(i)) ? 0 : 1,
  )
  if (!slot.head) return grown
  const { lab, n } = label(grown, w, h)
  const top = new Array(n + 1).fill(Infinity)
  const off = new Array(n + 1).fill(0)
  const size = new Array(n + 1).fill(0)
  for (let i = 0; i < w * h; i++) {
    const c = lab[i]
    if (!c) continue
    const y = oy + Math.floor(i / w)
    const x = ox + (i % w)
    top[c] = Math.min(top[c], y)
    size[c]++
    if (x < 0 || y < 0 || x >= W || y >= H || !fr.fig[y * W + x]) off[c]++
  }
  return grown.map((v, i) => (v && (top[lab[i]] <= fr.neck || off[lab[i]] / size[lab[i]] > 0.5) ? 1 : 0))
}

/** Every part, body and mood with its layers. */
const groups: { pid: string; body: string; mood?: string; layers: PortraitLayer[] }[] = Object.entries(manifest.parts).flatMap(([pid, bodies]) =>
  Object.entries(bodies).flatMap(([body, e]) => [{ pid, body, layers: e.layers }, ...Object.entries(e.moods ?? {}).map(([mood, layers]) => ({ pid, body, mood, layers: layers! }))]),
)
const allLayers = [...Object.values(manifest.bodies).flatMap((b) => b.layers), ...groups.flatMap((g) => g.layers)]

describe('the portrait layers (tools/src/art/looks/portrait/clean.py)', () => {
  it('every layer: its two images, the same coverage in both, no zone or paint where nothing is covered, only its keys', { timeout: 120_000 }, () => {
    const bad: string[] = []
    for (const l of allLayers) {
      if (!existsSync(join(ROOT, l.file + '.png')) || !existsSync(join(ROOT, l.file + '.z.png'))) {
        bad.push(`${l.file}: missing`)
        continue
      }
      const a = readPng(join(ROOT, l.file + '.png'))
      const b = readPng(join(ROOT, l.file + '.z.png'))
      cache.set(l.file, { paint: a.rgba, value: b.rgba })
      if (a.w !== l.w || a.h !== l.h || b.w !== l.w || b.h !== l.h) bad.push(`${l.file}: ${a.w}x${a.h} / ${b.w}x${b.h}, the manifest says ${l.w}x${l.h}`)
      if (l.x < 0 || l.y < 0 || l.x + l.w > W || l.y + l.h > H) bad.push(`${l.file}: off the canvas`)
      let n = 0
      for (let i = 0; i < a.rgba.length; i += 4) {
        const cover = b.rgba[i + 3]
        const zone = b.rgba[i + 1]
        const wrong =
          a.rgba[i + 3] !== cover ||
          zone % 40 !== 0 ||
          zone / 40 > l.zones.length ||
          (!cover && (zone || b.rgba[i] || a.rgba[i] || a.rgba[i + 1] || a.rgba[i + 2])) ||
          (zone > 0 && (a.rgba[i] || a.rgba[i + 1] || a.rgba[i + 2]))
        if (wrong) n++
      }
      if (n) bad.push(`${l.file}: ${n} pixels whose paint and value map disagree`)
    }
    expect(bad).toEqual([])
  })

  it("no layer keeps the ground it was cut from: a body's gaps (between an arm and the waist), a rim round a garment, a patch beside a boot", { timeout: 120_000 }, () => {
    const bad: string[] = []
    for (const [body, e] of Object.entries(manifest.bodies))
      for (const l of e.layers) {
        const n = groundIn(l, frames[body].neck - l.y)
        if (n) bad.push(`${l.file}: ${n} pixels of ground`)
      }
    for (const g of groups) {
      if (table.groundKept.includes(g.pid.split('.')[0])) continue
      for (const l of g.layers) {
        const n = groundIn(l, 0, g.body)
        if (n) bad.push(`${l.file}: ${n} pixels of ground`)
      }
    }
    expect(bad).toEqual([])
  })

  it("every part's pixels are its own: no speckle, no faint dust, nothing outside its band of the figure, no stroke or patch away from its mass", { timeout: 120_000 }, () => {
    const bad: string[] = []
    for (const { pid, body, mood, layers } of groups) {
      expect(table.slots[pid.split('.')[0]], `${pid}: a slot clean.json knows`).toBeDefined()
      const slot = params(pid)
      // the union of the group's layers, in its box with room round it (outside the canvas is nothing)
      const pad = (slot.r || 0) + (slot.reach || 0) + 2
      const x0 = Math.min(...layers.map((l) => l.x)) - pad
      const y0 = Math.min(...layers.map((l) => l.y)) - pad
      const w = Math.max(...layers.map((l) => l.x + l.w)) + pad - x0
      const h = Math.max(...layers.map((l) => l.y + l.h)) + pad - y0
      const alpha = new Uint8Array(w * h)
      for (const l of layers) {
        const { value } = pixels(l.file)
        for (let y = 0; y < l.h; y++)
          for (let x = 0; x < l.w; x++) {
            const i = (l.y - y0 + y) * w + l.x - x0 + x
            alpha[i] = Math.max(alpha[i], value[(y * l.w + x) * 4 + 3])
          }
      }
      const keep = kept(alpha, w, h, y0, x0, pid, body)
      let stray = 0
      for (let i = 0; i < w * h; i++) if (alpha[i] && !keep[i]) stray++
      if (stray) bad.push(`${pid} on the ${body}${mood ? ` (${mood})` : ''}: ${stray} stray pixels`)
    }
    expect(bad).toEqual([])
  })
})
