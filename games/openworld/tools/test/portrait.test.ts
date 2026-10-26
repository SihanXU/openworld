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
  into: Record<string, string[]>
  encloses: string[]
  holes: { slots: string[]; max: number; speck: number; ink: number; seam: number }
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

  it("a hairstyle and a beard have no pinholes and no lone grey or red dots: no speck shows in the strands", { timeout: 120_000 }, () => {
    const bad: string[] = []
    for (const g of groups) {
      if (!table.holes.slots.includes(g.pid.split('.')[0])) continue
      // what the hairstyle (front and back as one) does not fully cover, 4-connected, with a ring round its box: the
      // pieces that never reach the ring are pinholes
      const x0 = Math.min(...g.layers.map((l) => l.x)) - 1
      const y0 = Math.min(...g.layers.map((l) => l.y)) - 1
      const pw = Math.max(...g.layers.map((l) => l.x + l.w)) + 1 - x0
      const ph = Math.max(...g.layers.map((l) => l.y + l.h)) + 1 - y0
      const cover = new Uint8Array(pw * ph)
      for (const l of g.layers) {
        const { value } = pixels(l.file)
        for (let y = 0; y < l.h; y++)
          for (let x = 0; x < l.w; x++) {
            const i = (l.y - y0 + y) * pw + l.x - x0 + x
            cover[i] = Math.max(cover[i], value[(y * l.w + x) * 4 + 3])
          }
      }
      const holes = label(cover.map((a) => (a < 255 ? 1 : 0)), pw, ph, true)
      const size = new Array(holes.n + 1).fill(0)
      for (const c of holes.lab) size[c]++
      let pins = 0
      for (let c = 1; c <= holes.n; c++) if (c !== holes.lab[0] && size[c] <= table.holes.max) pins++
      if (pins) bad.push(`${g.pid} on the ${g.body}: ${pins} pinholes`)
      for (const l of g.layers) {
        const { value } = pixels(l.file)
        const { w, h } = l
        // the pieces keeping their paint, small, wholly inside the repainted hair and lighter than ink
        const { paint } = pixels(l.file)
        const kept = new Uint8Array(w * h)
        for (let i = 0; i < w * h; i++) kept[i] = value[i * 4 + 3] && !value[i * 4 + 1] ? 1 : 0
        const k = label(kept, w, h)
        const px: number[][] = Array.from({ length: k.n + 1 }, () => [])
        for (let i = 0; i < w * h; i++) if (k.lab[i] && px[k.lab[i]].length <= table.holes.speck) px[k.lab[i]].push(i)
        let specks = 0
        for (let c = 1; c <= k.n; c++) {
          const piece = px[c]
          if (piece.length > table.holes.speck) continue
          let inside = true
          for (const i of piece)
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++) {
                const x = (i % w) + dx
                const y = Math.floor(i / w) + dy
                if (x < 0 || y < 0 || x >= w || y >= h) continue
                const q = y * w + x
                if (k.lab[q] !== c && !(value[q * 4 + 3] === 255 && value[q * 4 + 1] > 0)) inside = false
              }
          const lum = piece.reduce((a, i) => a + paint[i * 4] * 0.299 + paint[i * 4 + 1] * 0.587 + paint[i * 4 + 2] * 0.114, 0) / piece.length
          if (inside && lum > table.holes.ink) specks++
        }
        if (specks) bad.push(`${l.file}: ${specks} lone specks`)
      }
    }
    expect(bad).toEqual([])
  })

  it("a face's irises are round (no tail of the eye colour below an eye) and keep their pupil and ring", { timeout: 120_000 }, () => {
    const bad: string[] = []
    // the disc eyes.py `round_iris` opens with
    const disc = [[0, 1, 1, 1, 0], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [0, 1, 1, 1, 0]]
    for (const g of groups) {
      if (!g.pid.startsWith('face.')) continue
      for (const l of g.layers) {
        const k = l.zones.indexOf('eyes') + 1
        if (!k) continue
        const { value } = pixels(l.file)
        const { w, h } = l
        const iris = new Uint8Array(w * h)
        for (let i = 0; i < w * h; i++) iris[i] = value[i * 4 + 3] && value[i * 4 + 1] === 40 * k ? 1 : 0
        const fits = (y: number, x: number) => disc.every((row, dy) => row.every((d, dx) => !d || iris[(y + dy - 2) * w + x + dx - 2] === 1))
        // what an opening by the disc keeps, grown a pixel: the iris; anything further out is a tail
        const core = new Uint8Array(w * h)
        for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) if (fits(y, x)) disc.forEach((row, dy) => row.forEach((d, dx) => d && (core[(y + dy - 2) * w + x + dx - 2] = 1)))
        const near = squareFilter(core, w, h, 1, true)
        let tail = 0
        const vals: number[] = []
        for (let i = 0; i < w * h; i++) if (iris[i]) (near[i] ? vals.push(value[i * 4]) : tail++)
        if (tail) bad.push(`${l.file}: ${tail} iris pixels off the round iris`)
        vals.sort((a, b) => a - b)
        // the darkest twentieth near the gradient's ink (eyes.py DARK): recoloured, an iris keeps its pupil and ring
        if (vals.length >= 20 && vals[Math.floor(vals.length * 0.05)] > 40) bad.push(`${l.file}: a flat iris (its darkest ${vals[Math.floor(vals.length * 0.05)]})`)
      }
    }
    expect(bad).toEqual([])
  })

  it("the order of what is worn: legwear and trousers go into the shoes, a garment's cloth falls over them", { timeout: 120_000 }, () => {
    // body < legs < outfit < shoes; what of an outfit hangs over the boots is its hem (hems.py)
    const bad: string[] = []
    const order = ['hairBack', 'body', 'legs', 'outfit', 'shoes', 'armour', 'cloak', 'age', 'face', 'mark', 'beard', 'glasses', 'hair', 'hat']
    const overShoes = (p: { above?: string[] }, l: PortraitLayer) => (p.above ?? []).includes('shoes') || (l.above ?? []).includes('shoes') || order.indexOf(l.z) > order.indexOf('shoes')
    for (const [pid, bodies] of Object.entries(manifest.parts)) {
      const slot = pid.split('.')[0]
      for (const [body, p] of Object.entries(bodies)) {
        // a boot encloses the leg (clean.json `encloses`): the composer hides what goes into it below its rim
        if (slot === 'shoes' && !!p.encloses !== table.encloses.includes(pid)) bad.push(`${pid} on the ${body}: encloses should be ${table.encloses.includes(pid)}`)
        // stockings, hose and wraps never over the shoes
        if (slot === 'legs' && p.layers.some((l) => overShoes(p, l))) bad.push(`${pid} on the ${body} is drawn over the shoes`)
        if (slot !== 'outfit') continue
        // nothing over the shoes is what goes into them: the trousers, the greaves (clean.json `into`), bare skin
        const into = [...(table.into[pid] ?? []), 'skin']
        for (const l of p.layers) {
          if (!overShoes(p, l)) continue
          const { value } = pixels(l.file)
          const ks = into.map((k) => l.zones.indexOf(k) + 1).filter((k) => k > 0)
          let n = 0
          for (let i = 0; i < l.w * l.h; i++) if (value[i * 4 + 3] && ks.includes(value[i * 4 + 1] / 40)) n++
          if (n) bad.push(`${l.file}: ${n} pixels of ${into.join(', ')} over the shoes (trousers over the boots)`)
        }
        // no shoe covers the garment's cloth (zone 1) drawn under it
        const under = new Uint8Array(W * H)
        for (const l of p.layers) {
          if (!l.zones.includes('.1') || overShoes(p, l)) continue
          const { value } = pixels(l.file)
          const k = l.zones.indexOf('.1') + 1
          for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (value[(y * l.w + x) * 4 + 3] && value[(y * l.w + x) * 4 + 1] === 40 * k) under[(l.y + y) * W + l.x + x] = 1
        }
        for (const [sid, sbodies] of Object.entries(manifest.parts)) {
          if (!sid.startsWith('shoes.') || !sbodies[body]) continue
          let n = 0
          for (const l of sbodies[body].layers) {
            const { value } = pixels(l.file)
            for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (value[(y * l.w + x) * 4 + 3] > 128 && under[(l.y + y) * W + l.x + x]) n++
          }
          // a few pixels where a boot's outline grazes the cloth's edge are the drawing's; a coat's skirt is hundreds
          if (n > 40) bad.push(`${sid} drawn over ${pid}'s cloth on the ${body}: ${n} pixels`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('hair on the body hangs from the head: no piece of it is drawn over what is worn (long hair behind an arm is behind the body)', { timeout: 120_000 }, () => {
    const bad: string[] = []
    for (const g of groups) {
      if (!g.pid.startsWith('hair.')) continue
      const x0 = Math.min(...g.layers.map((l) => l.x))
      const y0 = Math.min(...g.layers.map((l) => l.y))
      const w = Math.max(...g.layers.map((l) => l.x + l.w)) - x0
      const h = Math.max(...g.layers.map((l) => l.y + l.h)) - y0
      const union = new Uint8Array(w * h)
      const front = new Uint8Array(w * h)
      for (const l of g.layers) {
        const { value } = pixels(l.file)
        for (let y = 0; y < l.h; y++)
          for (let x = 0; x < l.w; x++)
            if (value[(y * l.w + x) * 4 + 3]) {
              const i = (l.y - y0 + y) * w + l.x - x0 + x
              union[i] = 1
              if (l.z === 'hair') front[i] = 1
            }
      }
      const { lab, n } = label(union, w, h)
      const top = new Array(n + 1).fill(Infinity)
      for (let i = 0; i < w * h; i++) if (lab[i]) top[lab[i]] = Math.min(top[lab[i]], y0 + Math.floor(i / w))
      let hang = 0
      for (let i = 0; i < w * h; i++) if (front[i] && top[lab[i]] > frames[g.body].neck) hang++
      if (hang) bad.push(`${g.pid} on the ${g.body}: ${hang} pixels of hair on the body that do not reach the head`)
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
      // where the hair on the body and the hair behind it meet over the body's outline (clean.py `seam_zone`), the
      // body's pixels between them are the hair's
      const zs = layers.map((l) => l.z)
      if (table.holes.slots.includes(pid.split('.')[0]) && zs.includes('hair') && zs.includes('hairBack')) {
        const full = (z: string) => {
          const l = layers[zs.indexOf(z)]
          const { value } = pixels(l.file)
          const out = new Uint8Array(w * h)
          for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (value[(y * l.w + x) * 4 + 3] === 255) out[(l.y - y0 + y) * w + l.x - x0 + x] = 1
          return out
        }
        const f = full('hair')
        const b = full('hairBack')
        const R = table.holes.seam
        const closed = squareFilter(squareFilter(f.map((v, i) => v | b[i]), w, h, R, true), w, h, R, false)
        const nearF = squareFilter(f, w, h, R, true)
        const nearB = squareFilter(b, w, h, R, true)
        const fig = frames[body].fig
        for (let i = 0; i < w * h; i++) {
          const cy = y0 + Math.floor(i / w)
          const cx = x0 + (i % w)
          if (alpha[i] && closed[i] && nearF[i] && nearB[i] && cx >= 0 && cy >= 0 && cx < W && cy < H && fig[cy * W + cx]) keep[i] = 1
        }
      }
      let stray = 0
      for (let i = 0; i < w * h; i++) if (alpha[i] && !keep[i]) stray++
      if (stray) bad.push(`${pid} on the ${body}${mood ? ` (${mood})` : ''}: ${stray} stray pixels`)
    }
    expect(bad).toEqual([])
  })
})
