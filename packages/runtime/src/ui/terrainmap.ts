// The continent painted as a terrain map (docs/continent.md §2): not one flat square a cell, but a hand-drawn-looking
// chart in the manner of an adventure game's world map — the grounds blending along organic edges, relief shaded
// from a height drawn out of the grounds, snow on the peaks, forests stippled, fields in patches, the sea deepening
// away from a foam-lined coast, roads as curving ochre paths, rivers winding, bridges marked. Everything is derived
// from the cell grid alone (the grounds never move), so the picture is painted once per world and kept.

/** How a ground is drawn: its height (0 sea, 1 the peaks), how rough its relief, and its paint. */
interface Paint {
  /** The ground's class, for which edges are inked and how the fill is textured. */
  kind: 'sea' | 'river' | 'flat' | 'wooded' | 'rough' | 'peak' | 'road'
  height: number
  /** How much the fine noise lifts and lowers the ground (0 flat, 1 the mountains). */
  rough: number
  /** The main colour and a second it is mottled with. */
  base: [number, number, number]
  alt: [number, number, number]
  /** A third colour for the ground's marks (a forest's trees, a marsh's pools, a field's furrows). */
  mark?: [number, number, number]
}

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

const PAINTS: Record<string, Paint> = {
  ow_sea: { kind: 'sea', height: 0, rough: 0, base: rgb('#2b5a8f'), alt: rgb('#4f9ac4') },
  ow_river: { kind: 'river', height: 0.22, rough: 0, base: rgb('#4a90c0'), alt: rgb('#6fb0d8') },
  ow_plain: { kind: 'flat', height: 0.3, rough: 0.25, base: rgb('#8ab75e'), alt: rgb('#a6c86e') },
  ow_steppe: { kind: 'flat', height: 0.3, rough: 0.25, base: rgb('#b9ae6c'), alt: rgb('#cdc080') },
  ow_fields: { kind: 'flat', height: 0.3, rough: 0.15, base: rgb('#c9b56e'), alt: rgb('#dcc983'), mark: rgb('#ab9452') },
  ow_salt: { kind: 'flat', height: 0.28, rough: 0.05, base: rgb('#e9e4d6'), alt: rgb('#f4f0e6') },
  ow_dust: { kind: 'flat', height: 0.32, rough: 0.3, base: rgb('#d6bf93'), alt: rgb('#e2cfa6') },
  ow_city: { kind: 'flat', height: 0.3, rough: 0.1, base: rgb('#bba78a'), alt: rgb('#cab79a'), mark: rgb('#9d8a6d') },
  ow_marsh: { kind: 'flat', height: 0.24, rough: 0.1, base: rgb('#5e7b62'), alt: rgb('#6f8d6b'), mark: rgb('#56808a') },
  ow_snow: { kind: 'flat', height: 0.45, rough: 0.12, base: rgb('#eef3f7'), alt: rgb('#dbe5ee') },
  ow_forest: { kind: 'wooded', height: 0.38, rough: 0.35, base: rgb('#3f7f40'), alt: rgb('#326d35'), mark: rgb('#27552b') },
  ow_deadwood: { kind: 'wooded', height: 0.36, rough: 0.3, base: rgb('#746c5a'), alt: rgb('#665e4e'), mark: rgb('#4c4538') },
  ow_hills: { kind: 'rough', height: 0.6, rough: 0.45, base: rgb('#93a35b'), alt: rgb('#a5b36b') },
  ow_badlands: { kind: 'rough', height: 0.6, rough: 0.5, base: rgb('#b7613f'), alt: rgb('#c97a52') },
  ow_highland: { kind: 'rough', height: 0.75, rough: 0.4, base: rgb('#c9c2ae'), alt: rgb('#b6ae99'), mark: rgb('#9fa98a') },
  ow_mountain: { kind: 'peak', height: 1, rough: 0.7, base: rgb('#7d7770'), alt: rgb('#66625c') },
  ow_road: { kind: 'road', height: 0.3, rough: 0.2, base: rgb('#8ab75e'), alt: rgb('#a6c86e') },
  ow_bridge: { kind: 'river', height: 0.22, rough: 0, base: rgb('#4a90c0'), alt: rgb('#6fb0d8') },
}
const UNKNOWN: Paint = { kind: 'flat', height: 0.3, rough: 0.2, base: rgb('#9a9a9a'), alt: rgb('#8a8a8a') }
const SNOWCAP = rgb('#f3f5f7')
const FOAM = rgb('#d6ecf2')
const ROAD = '#cfae72'
const ROAD_EDGE = '#7f5f33'
const BRIDGE = '#8a5a30'

/** Cells with no ground of their own on the map: a road's cell is painted as the ground it runs through. */
const LINE = new Set(['ow_road', 'ow_bridge'])

// --- noise: a hashed value noise, smooth and cheap, summed in a few octaves ---

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function noise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  let fx = x - x0
  let fy = y - y0
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)
  const a = hash(x0, y0, seed)
  const b = hash(x0 + 1, y0, seed)
  const c = hash(x0, y0 + 1, seed)
  const d = hash(x0 + 1, y0 + 1, seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/** Fractal noise in [-1, 1]. */
function fbm(x: number, y: number, seed: number, octaves: number): number {
  let v = 0
  let amp = 0.5
  let sum = 0
  for (let i = 0; i < octaves; i++) {
    v += (noise(x, y, seed + i) * 2 - 1) * amp
    sum += amp
    x = x * 2.03 + 7.1
    y = y * 1.97 + 3.3
    amp *= 0.5
  }
  return v / sum
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const mix = (a: number, b: number, t: number) => a + (b - a) * t

export interface ContinentGrid {
  width: number
  height: number
  terrain: string[]
}

/**
 * Paint the continent at `res` pixels a cell. The canvas is sized in device pixels; the caller scales it down by CSS.
 */
export function paintContinent(c: ContinentGrid, res: number): HTMLCanvasElement {
  const W = c.width
  const H = c.height
  const pw = W * res
  const ph = H * res
  const canvas = document.createElement('canvas')
  canvas.width = pw
  canvas.height = ph
  const g = canvas.getContext('2d')!

  const paintOf = (x: number, y: number): Paint => (x < 0 || y < 0 || x >= W || y >= H ? PAINTS.ow_sea : (PAINTS[c.terrain[y * W + x]] ?? UNKNOWN))
  const idOf = (x: number, y: number): string => (x < 0 || y < 0 || x >= W || y >= H ? 'ow_sea' : (c.terrain[y * W + x] ?? 'ow_sea'))

  // the ground each cell is painted as: a road's cell takes the commonest ground beside it
  const fill: Paint[] = new Array(W * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const id = idOf(x, y)
      if (id !== 'ow_road') {
        fill[y * W + x] = paintOf(x, y)
        continue
      }
      const count = new Map<string, number>()
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const n = idOf(x + dx, y + dy)
          if (LINE.has(n) || n === 'ow_river' || n === 'ow_sea') continue
          count.set(n, (count.get(n) ?? 0) + (dx && dy ? 1 : 2))
        }
      let best = 'ow_plain'
      let bestN = -1
      for (const [k, n] of count) if (n > bestN) (best = k), (bestN = n)
      fill[y * W + x] = PAINTS[best] ?? UNKNOWN
    }

  // each cell's height, smoothed a little so slopes run between cells rather than stepping
  const cellH = new Float32Array((W + 2) * (H + 2))
  const hAt = (x: number, y: number) => fill[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))].height
  for (let y = -1; y <= H; y++)
    for (let x = -1; x <= W; x++) {
      const inside = x >= 0 && y >= 0 && x < W && y < H
      let h = inside ? hAt(x, y) * 4 : 0
      let n = inside ? 4 : 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        h += hAt(nx, ny)
        n++
      }
      cellH[(y + 1) * (W + 2) + x + 1] = n ? h / n : 0
    }
  const heightAt = (u: number, v: number): number => {
    // bilinear between cell centres
    const fx = u - 0.5
    const fy = v - 0.5
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const tx = fx - x0
    const ty = fy - y0
    const at = (x: number, y: number) => cellH[(Math.min(H, Math.max(-1, y)) + 1) * (W + 2) + Math.min(W, Math.max(-1, x)) + 1]
    const a = at(x0, y0)
    const b = at(x0 + 1, y0)
    const d = at(x0, y0 + 1)
    const e = at(x0 + 1, y0 + 1)
    return a + (b - a) * tx + (d - a) * ty + (a - b - d + e) * tx * ty
  }

  // the sea's distance from land, by cell, for the shallows and the deep
  const dist = new Float32Array(W * H).fill(99)
  const queue: number[] = []
  for (let i = 0; i < W * H; i++)
    if (fill[i].kind !== 'sea') (dist[i] = 0), queue.push(i)
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]
    const x = i % W
    const y = Math.floor(i / W)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const j = ny * W + nx
      if (dist[j] > dist[i] + 1) (dist[j] = dist[i] + 1), queue.push(j)
    }
  }
  const distAt = (u: number, v: number): number => {
    const fx = Math.min(W - 1.001, Math.max(0, u - 0.5))
    const fy = Math.min(H - 1.001, Math.max(0, v - 0.5))
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const tx = fx - x0
    const ty = fy - y0
    const at = (x: number, y: number) => dist[Math.min(H - 1, y) * W + Math.min(W - 1, x)]
    const a = at(x0, y0)
    const b = at(x0 + 1, y0)
    const d = at(x0, y0 + 1)
    const e = at(x0 + 1, y0 + 1)
    return a + (b - a) * tx + (d - a) * ty + (a - b - d + e) * tx * ty
  }

  // pass 1: which ground each pixel belongs to (its edges wandering), its height with the fine relief
  const kindAt = new Uint8Array(pw * ph)
  const cellAt = new Int32Array(pw * ph)
  const hgt = new Float32Array(pw * ph)
  const KIND: Record<Paint['kind'], number> = { sea: 0, river: 1, flat: 2, wooded: 3, rough: 4, peak: 5, road: 2 }
  const wander = 0.3
  // how much of its cell a ground claims against its neighbours: a river is narrower than its cell
  const claim = (p: Paint) => (p.kind === 'river' ? 0.7 : 1)
  for (let py = 0; py < ph; py++)
    for (let px = 0; px < pw; px++) {
      const u = (px + 0.5) / res
      const v = (py + 0.5) / res
      // the edges between grounds wander, so no cell shows as a square; between cells the grounds blend by
      // their nearness, so corners come out round
      const ju = u + wander * fbm(u * 1.7, v * 1.7, 11, 3)
      const jv = v + wander * fbm(u * 1.7 + 50, v * 1.7 + 50, 23, 3)
      const fx = ju - 0.5
      const fy = jv - 0.5
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      const tx = fx - x0
      const ty = fy - y0
      let bestW = -1
      let bestC = 0
      for (let k = 0; k < 4; k++) {
        const cx = Math.min(W - 1, Math.max(0, x0 + (k & 1)))
        const cy = Math.min(H - 1, Math.max(0, y0 + (k >> 1)))
        const ci = cy * W + cx
        const p = fill[ci]
        let w = ((k & 1) ? tx : 1 - tx) * ((k >> 1) ? ty : 1 - ty) * claim(p)
        // the same ground on two of the four cells pulls together
        for (let m = 0; m < 4; m++) {
          if (m === k) continue
          const ox = Math.min(W - 1, Math.max(0, x0 + (m & 1)))
          const oy = Math.min(H - 1, Math.max(0, y0 + (m >> 1)))
          if (fill[oy * W + ox] === p) w += ((m & 1) ? tx : 1 - tx) * ((m >> 1) ? ty : 1 - ty) * claim(p)
        }
        if (w > bestW) (bestW = w), (bestC = ci)
      }
      const p = fill[bestC]
      const i = py * pw + px
      cellAt[i] = bestC
      kindAt[i] = KIND[p.kind]
      let relief = fbm(u * 2.2, v * 2.2, 37, 4) * 0.1 * p.rough + fbm(u * 7, v * 7, 41, 2) * 0.012 * p.rough
      // the mountains: ridges, sharp along their crests
      if (p.kind === 'peak') relief += (1 - Math.abs(fbm(u * 1.6, v * 1.6, 43, 3))) * 0.22 - 0.1
      hgt[i] = p.kind === 'sea' ? 0 : heightAt(u, v) + relief
    }

  // pass 2: the paint
  const img = g.createImageData(pw, ph)
  const data = img.data
  // light from the north-west, as a chart is shaded
  const lx = -0.6
  const ly = -0.8
  const stride = Math.max(1, Math.round(res / 10))
  for (let py = 0; py < ph; py++)
    for (let px = 0; px < pw; px++) {
      const i = py * pw + px
      const p = fill[cellAt[i]]
      const u = (px + 0.5) / res
      const v = (py + 0.5) / res
      let r: number
      let gg: number
      let b: number
      if (p.kind === 'sea') {
        const d = distAt(u, v) + fbm(u * 2.5, v * 2.5, 53, 2) * 0.35
        const deep = clamp01((d - 0.3) / 3.2)
        const sea = PAINTS.ow_sea
        r = mix(sea.alt[0], sea.base[0], deep)
        gg = mix(sea.alt[1], sea.base[1], deep)
        b = mix(sea.alt[2], sea.base[2], deep)
        // the swell: faint bands running with the coast
        const wave = Math.sin(d * 9 + fbm(u * 1.3, v * 1.3, 59, 2) * 2) * 0.5 + 0.5
        const band = wave * wave * wave * 0.08 * (1 - deep)
        r += 255 * band
        gg += 255 * band
        b += 255 * band
        // foam at the shore
        const foam = clamp01(1 - (d - 0.15) / 0.3) * (0.55 + 0.45 * noise(u * 14, v * 14, 61))
        r = mix(r, FOAM[0], foam * 0.8)
        gg = mix(gg, FOAM[1], foam * 0.8)
        b = mix(b, FOAM[2], foam * 0.8)
      } else if (p.kind === 'river') {
        const t = noise(u * 6, v * 6, 67)
        r = mix(p.base[0], p.alt[0], t)
        gg = mix(p.base[1], p.alt[1], t)
        b = mix(p.base[2], p.alt[2], t)
      } else {
        // mottled between the two paints
        const t = clamp01(0.5 + fbm(u * 2.2, v * 2.2, 71, 3) * 0.9)
        r = mix(p.base[0], p.alt[0], t)
        gg = mix(p.base[1], p.alt[1], t)
        b = mix(p.base[2], p.alt[2], t)
        const h = hgt[i]
        // the relief: slope against the light
        const xl = px >= stride ? hgt[i - stride] : h
        const xr = px + stride < pw ? hgt[i + stride] : h
        const yu = py >= stride ? hgt[i - stride * pw] : h
        const yd = py + stride < ph ? hgt[i + stride * pw] : h
        const gx = ((xr - xl) * res) / (2 * stride)
        const gy = ((yd - yu) * res) / (2 * stride)
        const slope = -(gx * lx + gy * ly)
        const strength = p.kind === 'peak' ? 2.2 : p.kind === 'rough' ? 1.6 : 1
        const shade = 1 + Math.max(-0.4, Math.min(0.28, slope * strength))
        r *= shade
        gg *= shade
        b *= shade
        if (p.kind === 'peak') {
          // the peaks: snow above the shoulders, darker rock below
          const snow = clamp01((h - 1.02 + fbm(u * 4, v * 4, 73, 2) * 0.05) / 0.08)
          r = mix(r, SNOWCAP[0] * (0.85 + 0.15 * shade), snow)
          gg = mix(gg, SNOWCAP[1] * (0.85 + 0.15 * shade), snow)
          b = mix(b, SNOWCAP[2] * (0.85 + 0.15 * shade), snow)
        } else if (p.kind === 'wooded' && p.mark) {
          // the trees: round dark crowns, denser toward the wood's heart
          const crown = noise(u * 11, v * 11, 79) * 0.6 + noise(u * 23, v * 23, 83) * 0.4
          const dense = crown > 0.56 ? clamp01((crown - 0.56) / 0.12) : 0
          r = mix(r, p.mark[0], dense * 0.85)
          gg = mix(gg, p.mark[1], dense * 0.85)
          b = mix(b, p.mark[2], dense * 0.85)
          // the lit side of each crown
          const lit = crown > 0.56 && noise(u * 11 - 0.08, v * 11 - 0.1, 79) < crown - 0.03 ? 0.12 : 0
          r += 255 * lit
          gg += 255 * lit
          b += 255 * lit
        } else if (p.mark && p.kind === 'flat' && p.base === PAINTS.ow_fields.base) {
          // the fields: a patchwork, each patch its own shade, furrows across it
          const patch = hash(Math.floor(u * 2.5 + fbm(u, v, 89, 2) * 0.6), Math.floor(v * 2.5 + fbm(u + 9, v + 9, 97, 2) * 0.6), 101)
          const furrow = Math.sin((patch > 0.5 ? u : v) * res * 0.8) > 0.6 ? 0.5 : 0
          r = mix(r, p.mark[0], (patch * 0.6 + furrow * 0.3) * 0.6)
          gg = mix(gg, p.mark[1], (patch * 0.6 + furrow * 0.3) * 0.6)
          b = mix(b, p.mark[2], (patch * 0.6 + furrow * 0.3) * 0.6)
        } else if (p.mark && p.base === PAINTS.ow_marsh.base) {
          // the marsh: pools of still water among the reeds
          const pool = clamp01((noise(u * 4, v * 4, 103) - 0.68) / 0.1) * 0.8
          r = mix(r, p.mark[0], pool)
          gg = mix(gg, p.mark[1], pool)
          b = mix(b, p.mark[2], pool)
        } else if (p.mark && p.base === PAINTS.ow_city.base) {
          // the city's grounds: a grid of lanes
          const lane = Math.abs(((u * 6) % 1) - 0.5) < 0.06 || Math.abs(((v * 6) % 1) - 0.5) < 0.06 ? 0.45 : 0
          r = mix(r, p.mark[0], lane)
          gg = mix(gg, p.mark[1], lane)
          b = mix(b, p.mark[2], lane)
        } else if (p.mark && p.base === PAINTS.ow_highland.base) {
          // the white highland: thin pasture in the hollows between the stone
          const grass = clamp01((noise(u * 3, v * 3, 109) - 0.6) / 0.15) * clamp01(1 - (hgt[i] - 0.7) / 0.1)
          r = mix(r, p.mark[0], grass * 0.7)
          gg = mix(gg, p.mark[1], grass * 0.7)
          b = mix(b, p.mark[2], grass * 0.7)
        } else if (p.kind === 'rough' && p.base === PAINTS.ow_badlands.base) {
          // the badlands: banded red rock
          const band = Math.sin(hgt[i] * 60 + fbm(u * 2, v * 2, 107, 2) * 3) > 0.7 ? 0.1 : 0
          r *= 1 - band
          gg *= 1 - band * 1.4
          b *= 1 - band * 1.6
        }
      }
      // the chart's tone: a little toward a warm grey, so the colours sit together like paint; then the paper's grain
      const soft = p.kind === 'sea' ? 0.06 : 0.14
      const grain = (hash(px, py, 113) - 0.5) * 8
      data[i * 4] = clamp255(mix(r, 205, soft) + grain)
      data[i * 4 + 1] = clamp255(mix(gg, 196, soft) + grain)
      data[i * 4 + 2] = clamp255(mix(b, 178, soft) + grain)
      data[i * 4 + 3] = 255
    }

  // pass 3: ink along the edges — the coast strongly, a river's bank lit, the grounds' seams faintly
  const inkW = Math.max(1, Math.round(res / 14))
  for (let py = 0; py < ph; py++)
    for (let px = 0; px < pw; px++) {
      const i = py * pw + px
      const k = kindAt[i]
      let sea = false
      let river = false
      let land = false
      for (let d = 1; d <= inkW; d++) {
        const nb = [px + d < pw ? kindAt[i + d] : k, py + d < ph ? kindAt[i + d * pw] : k, px >= d ? kindAt[i - d] : k, py >= d ? kindAt[i - d * pw] : k]
        for (const o of nb) {
          if (o === k) continue
          if (o === 0) sea = true
          else if (o === 1) river = true
          else land = true
        }
      }
      if (!sea && !river && !land) continue
      let a: number
      let tone: [number, number, number] = [38, 30, 26]
      if (k === 1 && land) (a = 0.45), (tone = FOAM)
      else if (k === 0) a = land || river ? 0.5 : 0
      else if (sea) a = 0.62
      else if (river) a = 0.3
      else a = 0.14
      if (!a) continue
      data[i * 4] = clamp255(data[i * 4] * (1 - a) + tone[0] * a)
      data[i * 4 + 1] = clamp255(data[i * 4 + 1] * (1 - a) + tone[1] * a)
      data[i * 4 + 2] = clamp255(data[i * 4 + 2] * (1 - a) + tone[2] * a)
    }
  g.putImageData(img, 0, 0)

  // the roads: curving paths through the cells they run along (a bridge is a road's cell over a river)
  const isRoad = (x: number, y: number) => {
    const id = idOf(x, y)
    return id === 'ow_road' || id === 'ow_bridge' || id === 'ow_city'
  }
  const roadPath = new Path2D()
  const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]]
  // the middle of a seam, nudged along it so the path does not run ruler-straight (both cells agree on it)
  const seam = (x: number, y: number, dx: number, dy: number): [number, number] => {
    const sx = x + 0.5 + dx / 2
    const sy = y + 0.5 + dy / 2
    const nudge = fbm(sx * 1.9, sy * 1.9, 127, 2) * 0.3
    return [(sx + (dy ? nudge : 0)) * res, (sy + (dx ? nudge : 0)) * res]
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!isRoad(x, y) || idOf(x, y) === 'ow_city') continue
      const cx = (x + 0.5 + fbm(x * 1.3, y * 1.3, 131, 2) * 0.12) * res
      const cy = (y + 0.5 + fbm(x * 1.3 + 7, y * 1.3 + 7, 137, 2) * 0.12) * res
      const ends = DIRS.filter(([dx, dy]) => isRoad(x + dx, y + dy)).map(([dx, dy]) => seam(x, y, dx, dy))
      // a gap of one cell of land between two road cells: the road runs straight on through it
      for (const [dx, dy] of DIRS) {
        const between = idOf(x + dx, y + dy)
        if (isRoad(x + dx, y + dy) || between === 'ow_sea' || between === 'ow_river' || !isRoad(x + 2 * dx, y + 2 * dy)) continue
        roadPath.moveTo(cx, cy)
        roadPath.lineTo((x + 0.5 + dx * 1.5) * res, (y + 0.5 + dy * 1.5) * res)
      }
      if (ends.length === 1) {
        roadPath.moveTo(ends[0][0], ends[0][1])
        roadPath.lineTo(cx, cy)
      } else if (ends.length === 2) {
        roadPath.moveTo(ends[0][0], ends[0][1])
        roadPath.quadraticCurveTo(cx, cy, ends[1][0], ends[1][1])
      } else if (ends.length) {
        // a crossing: every branch curves into the middle
        for (const [ex, ey] of ends) {
          roadPath.moveTo(ex, ey)
          roadPath.quadraticCurveTo((ex + cx) / 2 + (cy - ey) * 0.15, (ey + cy) / 2 + (ex - cx) * 0.15, cx, cy)
        }
      } else {
        roadPath.moveTo(cx - res * 0.2, cy)
        roadPath.lineTo(cx + res * 0.2, cy)
      }
    }
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.strokeStyle = ROAD_EDGE
  g.lineWidth = Math.max(2, res * 0.16)
  g.globalAlpha = 0.55
  g.stroke(roadPath)
  g.globalAlpha = 1
  g.strokeStyle = ROAD
  g.lineWidth = Math.max(1, res * 0.09)
  g.stroke(roadPath)
  // the bridges: planks across the water
  g.fillStyle = BRIDGE
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (idOf(x, y) !== 'ow_bridge') continue
      const across = isRoad(x + 1, y) || isRoad(x - 1, y)
      const cx = (x + 0.5) * res
      const cy = (y + 0.5) * res
      const L = res * 0.5
      const T = res * 0.2
      if (across) g.fillRect(cx - L / 2, cy - T / 2, L, T)
      else g.fillRect(cx - T / 2, cy - L / 2, T, L)
    }

  return canvas
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v) | 0
