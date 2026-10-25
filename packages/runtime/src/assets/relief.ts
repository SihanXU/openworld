// The relief drawn (world-model.md §5.5, docs/release-1.md §5): a map's heights as rock, painted pixel by pixel into
// one layer laid over the ground and under all that stands (scene.ts drawHeights, the wiki's render-map.ts). Seen from
// the south and above, ground that drops to the south shows its face on the lower ground below the edge, a cell a
// level (the engine's relief.ts holds the same cells as rock): a face of bedded rock — strata, the joints between its
// blocks, cracks, lit where the light from the upper left catches it and darker toward its foot — under a lip lit
// along the edge (a cornice of snow on snowy ground, a fringe of grass on grassy), with a ragged foot and its shadow,
// stones fallen before it, and a shelf at each level of a taller one. Where ground drops west, east or north its rim
// is drawn, the side of the rock showing a little beside it; a stair cut in it shows its steps. The rock's colours are
// the region's where the catalogue gives them.

import { faceCells } from '@openworld/engine'

/** A rock's colours, darkest to lightest, 0xRRGGBB; a snowy and a grassy lip's. */
export interface ReliefPalette {
  outline: number
  deep: number
  dark: number
  mid: number
  light: number
  lit: number
  snow: number
  snowShade: number
  grass: number
  grassShade: number
}

/** The rock of the Frostfang Coast's hills and the mountain: a cool slate, a little green. */
export const SLATE: ReliefPalette = {
  outline: 0x1d2325,
  deep: 0x353f41,
  dark: 0x4b5658,
  mid: 0x66706f,
  light: 0x858e8a,
  lit: 0xadb5ad,
  snow: 0xf4f6fa,
  snowShade: 0xb9cadb,
  grass: 0x6ea44c,
  grassShade: 0x3f6e38,
}

const T = 16

/** A deterministic hash of a few integers, 0..1. */
function noise(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export interface ReliefLayer {
  width: number
  height: number
  /** RGBA, transparent where nothing is drawn. */
  rgba: Uint8ClampedArray<ArrayBuffer>
}

/**
 * The relief of a map as one layer, `width * 16` by `height * 16` pixels; undefined where it has no heights. `ground`
 * names the ground of a cell (snow, grass… — its lip follows it).
 */
export function paintRelief(width: number, height: number, heights: readonly number[] | undefined, ground: (x: number, y: number) => string, pal: ReliefPalette = SLATE): ReliefLayer | undefined {
  if (!heights?.some((h) => h)) return undefined
  const PW = width * T
  const PH = height * T
  const rgba = new Uint8ClampedArray(PW * PH * 4)
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? undefined : heights[y * width + x] ?? 0)
  const faces = faceCells(width, height, heights)
  const isFace = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && faces[y * width + x] > 0
  /** Lower by a level or more (a drop that shows an edge). */
  const lower = (x: number, y: number, dx: number, dy: number) => {
    const a = at(x, y)
    const b = at(x + dx, y + dy)
    return a !== undefined && b !== undefined && a - b >= 2
  }
  const snowy = (t: string) => t === 'snow' || t === 'ice'
  const grassy = (t: string) => t === 'grass' || t === 'flowers' || t === 'drygrass'

  const put = (px: number, py: number, c: number, a = 1) => {
    if (px < 0 || py < 0 || px >= PW || py >= PH) return
    const i = (py * PW + px) * 4
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255
    if (a >= 1 || rgba[i + 3] === 0) {
      rgba[i] = r, rgba[i + 1] = g, rgba[i + 2] = b, rgba[i + 3] = a >= 1 ? 255 : Math.round(a * 255)
      return
    }
    // over what is there already: blended (a shadow over a shadow)
    const da = rgba[i + 3] / 255
    const oa = a + da * (1 - a)
    rgba[i] = (r * a + rgba[i] * da * (1 - a)) / oa
    rgba[i + 1] = (g * a + rgba[i + 1] * da * (1 - a)) / oa
    rgba[i + 2] = (b * a + rgba[i + 2] * da * (1 - a)) / oa
    rgba[i + 3] = oa * 255
  }
  const shade = (px: number, py: number, a: number) => put(px, py, 0x000000, a)

  // ------------------------------------------------------------------ the faces
  // each face pixel: the pixel row its face's top is at, and how tall it is (its levels)
  const top = new Int32Array(PW * PH).fill(-1)
  const tall = new Uint8Array(PW * PH)
  for (let y = 0; y + 1 < height; y++)
    for (let x = 0; x < width; x++) {
      const levels = Math.floor((at(x, y)! - at(x, y + 1)!) / 2)
      if (levels < 1) continue
      const y0 = (y + 1) * T
      const y1 = Math.min(PH, (y + 1 + levels) * T)
      for (let px = x * T; px < (x + 1) * T; px++) {
        // a ragged foot: boulders five pixels wide, their bottoms rounded, ending up to three pixels short of the cell's
        const off = Math.floor(noise(y, x, 9) * 5)
        const seg = Math.floor((px + off) / 5)
        const pos = (px + off) % 5
        const short = y1 === PH ? 0 : Math.floor(noise(seg, y, 7) * 2.6) + (pos === 0 || pos === 4 ? 1 : 0)
        for (let py = y0; py < y1 - short; py++) {
          const i = py * PW + px
          // where two faces meet, the taller one shows
          if (top[i] >= 0 && tall[i] >= levels) continue
          top[i] = y0
          tall[i] = levels
        }
      }
    }
  const face = (px: number, py: number) => px >= 0 && py >= 0 && px < PW && py < PH && top[py * PW + px] >= 0
  /** Where the masses of a face below ledge row `cy` part, left to right: every 12 to 22 pixels. */
  const massesOf = new Map<number, number[]>()
  const bounds = (cy: number) => {
    let a = massesOf.get(cy)
    if (!a) {
      a = [-T]
      for (let x = -T, k = 0; x < PW + T; k++) a.push((x += 12 + Math.floor(noise(k, cy, 201) * 11)))
      massesOf.set(cy, a)
    }
    return a
  }
  /** The chunk of rock a pixel lies in (seeds on a staggered, jittered grid; wider than tall), or a crack between two. */
  const GX = 9
  const GY = 6
  const chunk = (px: number, py: number): { id: number; sx: number; sy: number; edge: boolean } => {
    const j0 = Math.floor(py / GY)
    let best = Infinity, second = Infinity, id = 0, sx = 0, sy = 0
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      const shift = j & 1 ? GX >> 1 : 0
      const i0 = Math.floor((px - shift) / GX)
      for (let i = i0 - 1; i <= i0 + 1; i++) {
        const x = i * GX + shift + Math.floor(noise(i, j, 1) * 5) - 2
        const y = j * GY + Math.floor(noise(i, j, 2) * 3) - 1
        const dd = ((px - x) * 0.62) ** 2 + (py - y) ** 2
        if (dd < best) (second = best), (best = dd), (id = i * 7919 + j), (sx = x), (sy = y)
        else if (dd < second) second = dd
      }
    }
    return { id, sx, sy, edge: Math.sqrt(second) - Math.sqrt(best) < 0.75 }
  }

  for (let py = 0; py < PH; py++)
    for (let px = 0; px < PW; px++) {
      const i = py * PW + px
      const y0 = top[i]
      if (y0 < 0) continue
      const levels = tall[i]
      const fh = levels * T
      const d = py - y0
      const cy = Math.floor(y0 / T) - 1 // the ledge's row
      const cx = Math.floor(px / T)
      // its ends and its foot: outlined, the left end lit and the right in shadow
      const leftOpen = !face(px - 1, py)
      const rightOpen = !face(px + 1, py)
      const footOpen = !face(px, py + 1)
      if (leftOpen || rightOpen || footOpen) {
        put(px, py, pal.outline)
        continue
      }
      // just under the lip: the shadow of its overhang
      if (d === 0) {
        put(px, py, pal.outline)
        continue
      }
      if (d === 1) {
        put(px, py, pal.deep)
        continue
      }
      // the rock: masses a cell or so wide standing side by side, split by fissures that run down from somewhere in
      // the face, each lit on its left flank and shadowed on its right; broken within into chunks wider than tall (as
      // bedded rock breaks), lit along their tops and dark under them; darker toward the foot
      const bs = bounds(cy)
      const sway = Math.round(Math.sin(d * 0.45 + cy * 2.3) * 1.1)
      const qx = px + sway
      let m = 0
      while (m + 1 < bs.length && bs[m + 1] <= qx) m++
      const u = (qx - bs[m]) / Math.max(1, bs[m + 1] - bs[m])
      const fissure = qx === bs[m] && d > Math.floor(noise(m, cy, 202) * fh * 0.45) + 2
      if (fissure) {
        put(px, py, pal.deep)
        continue
      }
      const ramp = [pal.deep, pal.dark, pal.mid, pal.light, pal.lit]
      let level = noise(m, cy, 203) < 0.3 ? 1.6 : 2.2
      if (u < 0.22) level += 0.9
      else if (u > 0.72) level -= 0.9
      if (qx === bs[m] + 1) level += 1
      const k = chunk(px, py)
      const above = chunk(px, py - 1)
      const below = chunk(px, py + 1)
      const topEdge = !k.edge && (above.edge || above.id !== k.id || d === 2)
      if (k.edge) level -= 1
      else if (topEdge) level += 1
      else if (below.edge || below.id !== k.id) level -= 0.6
      else if (noise(px, py, 93) < 0.06) level -= 1
      else if (noise(k.id, 5, 95) < 0.25) level -= 0.4
      // the lower part of a face is in its own shadow
      level -= Math.max(0, d / fh - 0.55) * 2.2
      // next to its ends: lit on the left, dark on the right
      if (!face(px - 2, py)) level = Math.max(level, 3)
      if (!face(px + 2, py)) level = 0
      let c = ramp[Math.max(0, Math.min(4, Math.round(level)))]
      // snow lies on a few ledges where the ground above is snow
      if (topEdge && d > 2 && d < fh * 0.5 && snowy(ground(cx, cy)) && noise(k.id, 3, 94) < 0.12 && noise(px, py, 96) < 0.7) c = pal.snow
      put(px, py, c)
    }

  // the foot: the face's shadow on the ground before it, ragged, and stones fallen from it
  for (let px = 0; px < PW; px++)
    for (let py = 1; py < PH; py++) {
      if (face(px, py) || !face(px, py - 1)) continue
      const reach = 2 + Math.floor(noise(px >> 1, py, 71) * 3)
      for (let k = 0; k < reach && !face(px, py + k); k++) shade(px, py + k, 0.32 * (1 - k / reach))
    }
  for (let y = 1; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!isFace(x, y - 1) || isFace(x, y)) continue
      for (let n = 0; n < 3; n++) {
        if (noise(x, y, 80 + n) > 0.55) continue
        const sx = x * T + 2 + Math.floor(noise(x, y, 90 + n) * 11)
        const sy = y * T + 1 + Math.floor(noise(x, y, 100 + n) * 4)
        const big = noise(x, y, 110 + n) < 0.4
        put(sx, sy, pal.light)
        put(sx + 1, sy, pal.mid)
        if (big) (put(sx, sy - 1, pal.lit), put(sx + 1, sy - 1, pal.light), put(sx + 2, sy, pal.dark))
        put(sx, sy + 1, pal.outline)
        put(sx + 1, sy + 1, pal.outline)
        if (big) put(sx + 2, sy + 1, pal.outline)
      }
    }

  // ------------------------------------------------------------------ the rims
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const g = ground(x, y)
      const snow = snowy(g)
      const grass = grassy(g)
      const x0 = x * T
      const y0 = y * T
      const n = lower(x, y, 0, -1)
      const w = lower(x, y, -1, 0)
      const e = lower(x, y, 1, 0)
      const s = lower(x, y, 0, 1)
      const edge = snow ? pal.snow : grass ? pal.grass : pal.lit
      const edgeShade = snow ? pal.snowShade : grass ? pal.grassShade : pal.light
      // the lip over a face: lit along its edge, and hanging over the face's top a cornice of snow, a fringe of grass,
      // or the rock's own lip, in runs a few pixels long, dark under it
      if (s)
        for (let px = x0; px < x0 + T; px++) {
          if (!face(px, y0 + T)) continue
          const run = Math.floor((px + Math.floor(noise(x, y, 120) * 4)) / 4)
          const hang = snow ? 2 + Math.floor(noise(run, y, 121) * 2.6) : grass ? Math.floor(noise(run, y, 122) * 2.2) : noise(run, y, 123) < 0.4 ? 1 : 0
          put(px, y0 + T - 2, snow ? pal.snow : edge)
          put(px, y0 + T - 1, edge)
          for (let k = 0; k < hang; k++) put(px, y0 + T + k, k === hang - 1 ? edgeShade : edge)
          if (face(px, y0 + T + hang)) put(px, y0 + T + hang, pal.outline)
        }
      // a rim where it drops north: the edge outlined, lit inside it
      if (n)
        for (let px = x0; px < x0 + T; px++) {
          put(px, y0, pal.outline)
          put(px, y0 + 1, edge)
        }
      // where it drops west or east: the rock's side, a few pixels of it, along the cell's edge under its rim — lit on
      // the west, in shadow on the east, which casts a shadow on the ground beyond
      const sideFrom = n ? 1 : 0
      const jagAt = (py: number, salt: number) => Math.floor(noise(x, Math.floor((py + Math.floor(noise(x, y, salt + 1) * 4)) / 4), salt) * 2.7)
      if (w)
        for (let py = y0 + sideFrom; py < y0 + T; py++) {
          const jag = jagAt(py, 141)
          put(x0, py, pal.outline)
          for (let k = 1; k <= 1 + jag; k++) put(x0 + k, py, k === 1 ? pal.lit : noise(py, k, 143) < 0.15 ? pal.mid : pal.light)
          put(x0 + 2 + jag, py, pal.dark)
          put(x0 + 3 + jag, py, edge)
        }
      if (e) {
        for (let py = y0 + sideFrom; py < y0 + T; py++) {
          const jag = jagAt(py, 151)
          put(x0 + T - 1, py, pal.outline)
          for (let k = 2; k <= 2 + jag; k++) put(x0 + T - k, py, k === 2 ? pal.deep : noise(py, k, 153) < 0.2 ? pal.deep : pal.dark)
          put(x0 + T - 3 - jag, py, pal.outline)
          put(x0 + T - 4 - jag, py, edgeShade)
        }
        if (!isFace(x + 1, y)) for (let py = y0; py < y0 + T; py++) for (let k = 0; k < 3; k++) shade(x0 + T + k, py, 0.24 * (1 - k / 3))
      }
      // the corners where it turns in: a notch of the rim
      const corner = (dx: number, dy: number, px: number, py: number) => {
        if (!lower(x, y, dx, dy) || lower(x, y, dx, 0) || lower(x, y, 0, dy)) return
        put(px, py, pal.outline)
      }
      corner(-1, -1, x0, y0)
      corner(1, -1, x0 + T - 1, y0)
    }

  // ------------------------------------------------------------------ the stairs cut in it
  // steps of stone four pixels deep, rising north: the tread lit at its nose, the riser in shadow; the slabs of each
  // step jointed at their own places; a cheek of rock each side where the flight is cut through; snow on the treads in snow
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!stairAt(width, height, heights, x, y)) continue
      const x0 = x * T
      const y0 = y * T
      const snow = snowy(ground(x, y)) || snowy(ground(x, y - 1))
      const cheekL = !stairAt(width, height, heights, x - 1, y)
      const cheekR = !stairAt(width, height, heights, x + 1, y)
      for (let k = 0; k < 4; k++) {
        const step = y * 4 + k
        const off = Math.floor(noise(x, step, 160) * 6)
        for (let px = x0; px < x0 + T; px++) {
          const joint = (px + off) % 7 === 0
          const lit = noise(px, step, 161) < 0.85
          const white = snow && noise(Math.floor((px + off) / 3), step, 162) < 0.65
          const rows = [white ? pal.snowShade : pal.mid, white ? pal.snow : pal.light, white ? pal.snow : lit ? pal.lit : pal.light, pal.deep]
          for (let r = 0; r < 4; r++) put(px, y0 + k * 4 + r, joint && r < 3 && !white ? (r === 2 ? pal.mid : pal.dark) : rows[r])
        }
      }
      for (let py = y0; py < y0 + T; py++) {
        if (cheekL) (put(x0, py, pal.outline), put(x0 + 1, py, pal.light), put(x0 + 2, py, pal.outline))
        if (cheekR) (put(x0 + T - 1, py, pal.outline), put(x0 + T - 2, py, pal.dark), put(x0 + T - 3, py, pal.outline))
      }
    }
  return { width: PW, height: PH, rgba }
}

/**
 * Is a cell a step of a stair (MapData.heights, half levels): a ramp's odd height, or a level's height inside a flight
 * that climbs on through it — half a level up to the north and half down to the south (a face two levels tall is
 * climbed by three steps, the middle one even).
 */
export function stairAt(w: number, h: number, heights: readonly number[], x: number, y: number): boolean {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? undefined : heights[y * w + x] ?? 0)
  const here = at(x, y)
  if (here === undefined) return false
  return here % 2 === 1 || (at(x, y - 1) === here + 1 && at(x, y + 1) === here - 1)
}
