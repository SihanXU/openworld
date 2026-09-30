// Terrain tileset: 16x16 tiles, several variants per ground terrain. Variants share a
// variant-independent noise "border" (lattice points on tile edges are fixed per terrain),
// so any two variants of the same terrain tile seamlessly next to each other; decorative
// features stay inside the tile.

import { Pix, Rand, mix, pack, rnd, shade, strHash, type Sheet } from './core.ts'

const S = 16

interface Pal {
  deep: string
  dark: string
  base: string
  light: string
  hi: string
}

function pal5(base: string): Pal {
  return { deep: shade(base, -0.5), dark: shade(base, -0.22), base, light: shade(base, 0.2), hi: shade(base, 0.42) }
}

const PALS: Record<string, Pal> = {
  grass: { deep: '#326e3a', dark: '#4b9544', base: '#5ca84a', light: '#6cb753', hi: '#9fd672' },
  flowers: { deep: '#326e3a', dark: '#4b9544', base: '#5ca84a', light: '#6cb753', hi: '#9fd672' },
  drygrass: { deep: '#66632a', dark: '#94913c', base: '#b3ae50', light: '#c9c46a', hi: '#e6df94' },
  dirt: { deep: '#5a3f2a', dark: '#7a5a3b', base: '#957150', light: '#ad8a63', hi: '#cfb088' },
  path: { deep: '#7a5f3c', dark: '#a8895a', base: '#c4a570', light: '#d6bc86', hi: '#ecd9a8' },
  cobble: { deep: '#4b4c57', dark: '#767a84', base: '#9a9ea6', light: '#b7bbc2', hi: '#d6d9dd' },
  sand: { deep: '#b08f58', dark: '#ccae72', base: '#e2ca8c', light: '#ecd9a6', hi: '#faf0cc' },
  snow: { deep: '#98aecb', dark: '#c3d3e6', base: '#e6eef6', light: '#f4f8fb', hi: '#ffffff' },
  ice: { deep: '#5f9cc8', dark: '#94cbe6', base: '#bbe3f3', light: '#d9f2fb', hi: '#ffffff' },
  water: { deep: '#26529c', dark: '#3066b6', base: '#3d7cd2', light: '#5f9ee6', hi: '#b8defa' },
  deepwater: { deep: '#15285a', dark: '#1d3c7c', base: '#274f98', light: '#3664b0', hi: '#6e9ed8' },
  wall: { deep: '#3a3b46', dark: '#5a5d68', base: '#767a85', light: '#9296a0', hi: '#b4b8c0' },
  woodwall: { deep: '#3f2618', dark: '#6a4128', base: '#8a5a35', light: '#a6743f', hi: '#c69256' },
  roof: { deep: '#5a1f1c', dark: '#84302a', base: '#a8432f', light: '#c65e3e', hi: '#e08a5a' },
  floor_wood: { deep: '#4f3220', dark: '#7a5433', base: '#9a7148', light: '#b28a5a', hi: '#c9a574' },
  floor_stone: { deep: '#4f515a', dark: '#6f727b', base: '#8a8d95', light: '#a2a5ac', hi: '#bec1c6' },
  carpet: { deep: '#4a1a26', dark: '#6e2733', base: '#8e3444', light: '#a8475a', hi: '#d8a84a' },
  door: { deep: '#2e1a10', dark: '#4f2f1c', base: '#6e4428', light: '#8c5a34', hi: '#b27c48' },
  cave_floor: { deep: '#2e2a28', dark: '#433e3a', base: '#56504a', light: '#69625a', hi: '#847b70' },
  cave_wall: { deep: '#141110', dark: '#28221e', base: '#3b332d', light: '#554a40', hi: '#736454' },
  rock: { deep: '#3a3836', dark: '#5c5955', base: '#7d7a74', light: '#9d9a93', hi: '#c2beb5' },
  lava: { deep: '#3a120e', dark: '#6a2216', base: '#dd4f1a', light: '#f7922a', hi: '#ffe27a' },
  ash: { deep: '#2f2c2a', dark: '#46423f', base: '#5b5652', light: '#716b66', hi: '#8c8680' },
  gravel: { deep: '#4e4a45', dark: '#6c6760', base: '#8a857e', light: '#a39e96', hi: '#c2bdb4' },
  bridge: { deep: '#3f2a18', dark: '#6e4c2c', base: '#9a7244', light: '#b48a56', hi: '#cda46c' },
  farmland: { deep: '#3e2816', dark: '#5a3c22', base: '#74502e', light: '#8c6440', hi: '#a67c52' },
  mud: { deep: '#2e2216', dark: '#43321f', base: '#5a4630', light: '#6e5840', hi: '#9a8a70' },
  stairs: { deep: '#1e1f26', dark: '#3c3e46', base: '#5e616a', light: '#80838c', hi: '#a6a9b0' },
}

// ---------------------------------------------------------------------------------------
// Noise with a fixed border: interior lattice points vary per variant, border points only
// per terrain, so tiles of different variants meet without seams.

function makeNoise(seed: number, variant: number, cells: number, neutral = true): (x: number, y: number) => number {
  const cs = S / cells
  const val = (i: number, j: number): number => {
    const ii = ((i % cells) + cells) % cells
    const jj = ((j % cells) + cells) % cells
    // Tile-edge lattice points are neutral for every terrain and variant, so neighbouring
    // tiles always agree along their shared edge and no 16px grid shows through.
    if (ii === 0 || jj === 0) return neutral ? 0.5 : rnd(seed, ii, jj, 7)
    return rnd(seed, variant + 101, ii, jj)
  }
  const sm = (t: number) => t * t * (3 - 2 * t)
  return (x, y) => {
    const fx = x / cs
    const fy = y / cs
    const i = Math.floor(fx)
    const j = Math.floor(fy)
    const tx = sm(fx - i)
    const ty = sm(fy - j)
    const a = val(i, j) + (val(i + 1, j) - val(i, j)) * tx
    const b = val(i, j + 1) + (val(i + 1, j + 1) - val(i, j + 1)) * tx
    return a + (b - a) * ty
  }
}

function fbm(seed: number, v: number): (x: number, y: number) => number {
  const a = makeNoise(seed, v, 4)
  const b = makeNoise(seed + 17, v, 8)
  return (x, y) => a(x + 0.5, y + 0.5) * 0.7 + b(x + 0.5, y + 0.5) * 0.3
}

/** Busier noise whose features reach the tile edges (edge lattice fixed per terrain). */
function fbmEdge(seed: number, v: number): (x: number, y: number) => number {
  const a = makeNoise(seed, v, 4, false)
  const b = makeNoise(seed + 17, v, 8, false)
  return (x, y) => a(x + 0.5, y + 0.5) * 0.45 + b(x + 0.5, y + 0.5) * 0.55
}

/** Ground base: 3-5 tone field from smooth noise plus a little dithering. */
function ground(p: Pix, pal: Pal, seed: number, v: number, lo = 0.3, hi = 0.7, grain = 0.035): void {
  const n = fbm(seed, v)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const k = n(x, y) + (rnd(seed, v, x, y, 3) - 0.5) * grain * 2
      p.set(x, y, k < lo ? pal.dark : k > hi ? pal.light : pal.base)
    }
}

function speckle(p: Pix, seed: number, v: number, c: string, density: number, margin = 0): void {
  for (let y = margin; y < S - margin; y++)
    for (let x = margin; x < S - margin; x++) if (rnd(seed, v, x, y, 11) < density) p.set(x, y, c)
}

/** Positions for features, well spread inside the tile. */
function spots(seed: number, v: number, n: number, margin = 2, minDist = 4): [number, number][] {
  const r = new Rand(seed * 31 + v * 7919 + 5)
  const out: [number, number][] = []
  let guard = 0
  while (out.length < n && guard++ < 200) {
    const x = r.range(margin, S - 1 - margin)
    const y = r.range(margin, S - 1 - margin)
    if (out.every(([a, b]) => Math.abs(a - x) + Math.abs(b - y) >= minDist)) out.push([x, y])
  }
  return out
}

// ---------------------------------------------------------------------------------------
// Small reusable decorations

function tuft(p: Pix, x: number, y: number, dark: string, light: string, kind: number): void {
  if (kind % 3 === 0) {
    // "w" shaped tuft
    p.set(x, y, dark)
    p.set(x + 2, y, dark)
    p.set(x + 1, y + 1, dark)
    p.set(x, y + 1, dark)
    p.set(x + 2, y + 1, dark)
    p.set(x + 1, y, light)
  } else if (kind % 3 === 1) {
    // two blades
    p.set(x, y, light)
    p.set(x, y + 1, dark)
    p.set(x + 1, y + 1, dark)
    p.set(x + 2, y - 1, light)
    p.set(x + 2, y, dark)
  } else {
    p.set(x + 1, y - 1, light)
    p.set(x, y, dark)
    p.set(x + 1, y, dark)
    p.set(x + 2, y, dark)
    p.set(x + 1, y + 1, dark)
  }
}

function pebble(p: Pix, x: number, y: number, pal: Pal, big = false): void {
  if (big) {
    p.set(x, y, pal.hi)
    p.set(x + 1, y, pal.light)
    p.set(x - 1, y + 1, pal.light)
    p.set(x, y + 1, pal.light)
    p.set(x + 1, y + 1, pal.base)
    p.set(x + 2, y + 1, pal.dark)
    p.set(x, y + 2, pal.dark)
    p.set(x + 1, y + 2, pal.deep)
    p.set(x - 1, y + 2, pal.dark)
  } else {
    p.set(x, y, pal.hi)
    p.set(x + 1, y, pal.light)
    p.set(x, y + 1, pal.dark)
    p.set(x + 1, y + 1, pal.deep)
  }
}

function flower(p: Pix, x: number, y: number, petal: string, center: string, leafC: string): void {
  p.set(x - 1, y + 1, leafC)
  p.set(x + 1, y + 1, leafC)
  p.set(x, y - 1, petal)
  p.set(x - 1, y, petal)
  p.set(x + 1, y, petal)
  p.set(x, y + 1, petal)
  p.set(x, y, center)
}

// Shape helper: paint a separate layer, outline it, then composite.
function layer(draw: (q: Pix) => void, outline: string | null = '#1a1522', strength = 0.7): Pix {
  const q = new Pix(S, S)
  draw(q)
  if (outline) q.outline(outline, strength)
  return q
}

// ---------------------------------------------------------------------------------------
// Terrain painters. Each receives the target pixmap, variant index and a palette.

type Painter = (p: Pix, v: number, pal: Pal, seed: number) => void

const grassBase: Painter = (p, v, pal, seed) => {
  ground(p, pal, seed, v, 0.26, 0.68)
  const r = new Rand(seed + v * 13)
  const n = 2 + (v % 3)
  const tuftDark = mix(pal.dark, pal.deep, 0.35)
  for (const [x, y] of spots(seed, v, n, 2, 5)) tuft(p, x - 1, y, tuftDark, pal.hi, r.int(3))
  if (v === 2) {
    const [x, y] = spots(seed + 9, v, 1, 4)[0]
    p.set(x, y, '#f4f1e0')
    p.set(x, y + 1, pal.dark)
  }
  if (v === 3) speckle(p, seed, v, pal.hi, 0.03, 1)
}

const drygrass: Painter = (p, v, pal, seed) => {
  ground(p, pal, seed, v, 0.27, 0.7)
  const r = new Rand(seed + v)
  for (const [x, y] of spots(seed, v, 4, 2, 5)) {
    const k = r.int(2)
    p.set(x, y - 1, pal.hi)
    p.set(x, y, pal.dark)
    p.set(x - 1, y + 1, pal.deep)
    p.set(x + 1, y, k ? pal.light : pal.dark)
    p.set(x + 1, y + 1, pal.deep)
    p.set(x, y + 1, pal.dark)
  }
  if (v === 3) pebble(p, 9, 10, PALS.dirt)
}

const flowers: Painter = (p, v, pal, seed) => {
  ground(p, pal, seed, v, 0.26, 0.68)
  const cols = [
    ['#f7f3e6', '#f2c440'],
    ['#f5d24a', '#e0882a'],
    ['#f08aa8', '#fff0a0'],
    ['#8fb0f5', '#fff4c0'],
    ['#e85a5a', '#ffe070'],
  ]
  const r = new Rand(seed * 3 + v)
  const main = cols[v % cols.length]
  const pts = spots(seed, v, 5, 2, 4)
  pts.forEach(([x, y], i) => {
    const c = i % 3 === 2 ? cols[r.int(cols.length)] : main
    flower(p, x, y, c[0], c[1], pal.deep)
  })
  for (const [x, y] of spots(seed + 99, v, 2, 2, 3)) {
    p.set(x, y, pal.dark)
    p.set(x + 1, y - 1, pal.light)
  }
}

const dirt: Painter = (p, v, pal, seed) => {
  ground(p, pal, seed, v, 0.28, 0.7)
  speckle(p, seed, v, pal.dark, 0.035)
  speckle(p, seed + 5, v, pal.light, 0.02)
  const pts = spots(seed, v, v === 0 ? 1 : 2 + (v % 2), 2, 5)
  pts.forEach(([x, y], i) => pebble(p, x, y, pal, i === 0 && v === 2))
}

const path: Painter = (p, v, pal, seed) => {
  ground(p, pal, seed, v, 0.28, 0.72, 0.03)
  speckle(p, seed, v, pal.dark, 0.035)
  speckle(p, seed + 3, v, pal.hi, 0.015)
  const pts = spots(seed, v, 1 + (v % 3), 2, 5)
  pts.forEach(([x, y]) => pebble(p, x, y, PALS.gravel))
}

/**
 * Stone field: rows of stones. `rows` gives [height, [split x positions]] per band; stones
 * may wrap across the tile edge (their tint stays neutral so variants still match).
 */
function stoneField(p: Pix, pal: Pal, seed: number, v: number, rows: [number, number[]][], opts: { mortar: string; rounded?: boolean; vary?: number; bevel?: boolean }): void {
  let y0 = 0
  const r = new Rand(seed * 7 + v * 131)
  rows.forEach(([h, splits], ri) => {
    const sorted = [...splits].sort((a, b) => a - b)
    // stone spans between consecutive splits (with wrap)
    for (let si = 0; si < sorted.length; si++) {
      const x0 = sorted[si] + 1
      const x1 = si + 1 < sorted.length ? sorted[si + 1] - 1 : sorted[0] - 1 + S
      const wraps = x1 >= S
      const tintAmt = wraps ? 0 : (r.next() - 0.5) * (opts.vary ?? 0.16)
      const base = tintAmt >= 0 ? mix(pal.base, pal.light, tintAmt * 2) : mix(pal.base, pal.dark, -tintAmt * 2)
      for (let yy = 0; yy < h - 1; yy++)
        for (let xx = x0; xx <= x1; xx++) {
          const x = xx % S
          const y = y0 + yy
          let c = base
          const top = yy === 0
          const bottom = yy === h - 2
          const left = xx === x0
          const right = xx === x1
          if (opts.rounded && ((top || bottom) && (left || right))) {
            c = opts.mortar
          } else if (top || left) c = opts.bevel === false ? base : mix(base, pal.hi, 0.45)
          else if (bottom || right) c = mix(base, pal.dark, 0.7)
          else if (rnd(seed, v, x, y, ri) < 0.08) c = mix(base, pal.dark, 0.5)
          p.set(x, y, c)
        }
      // mortar column
      for (let yy = 0; yy < h; yy++) p.set(sorted[si] % S, y0 + yy, opts.mortar)
    }
    // mortar row
    for (let x = 0; x < S; x++) p.set(x, y0 + h - 1, opts.mortar)
    y0 += h
  })
}

const cobble: Painter = (p, v, pal, seed) => {
  p.rect(0, 0, S, S, pal.deep)
  stoneField(
    p,
    pal,
    seed,
    v,
    [
      [5, [2, 8, 13]],
      [6, [5, 11]],
      [5, [0, 7, 12]],
    ],
    { mortar: mix(pal.deep, pal.dark, 0.35), rounded: true, vary: 0.35 },
  )
  if (v === 1) {
    // a crack
    p.set(9, 7, pal.deep)
    p.set(10, 8, pal.deep)
  }
  if (v === 2) {
    p.set(1, 5, '#6a9a4a')
    p.set(12, 10, '#5a8a40')
    p.set(13, 10, '#6a9a4a')
  }
}

const floorStone: Painter = (p, v, pal, seed) => {
  p.rect(0, 0, S, S, pal.deep)
  stoneField(
    p,
    pal,
    seed,
    v,
    [
      [8, [0, 8]],
      [8, [4, 12]],
    ],
    { mortar: pal.dark, vary: 0.2 },
  )
  if (v === 1) {
    p.set(3, 3, pal.dark)
    p.set(4, 4, pal.dark)
    p.set(4, 5, pal.dark)
  }
}

const wall: Painter = (p, v, pal, seed) => {
  p.rect(0, 0, S, S, pal.deep)
  stoneField(
    p,
    pal,
    seed,
    v,
    [
      [4, [0, 8]],
      [4, [4, 12]],
      [4, [0, 8]],
      [4, [4, 12]],
    ],
    { mortar: mix(pal.deep, pal.dark, 0.3), vary: 0.28 },
  )
  if (v === 1) {
    p.set(10, 5, '#5f8a48')
    p.set(11, 5, '#76a454')
    p.set(10, 6, '#4a7038')
    p.set(2, 13, '#5f8a48')
  }
}

const woodwall: Painter = (p, v, pal, seed) => {
  for (let x = 0; x < S; x++)
    for (let y = 0; y < S; y++) {
      const col = x % 4
      let c = col === 0 ? pal.light : col === 3 ? pal.dark : pal.base
      if (col === 3 && x === 15) c = pal.deep
      if (rnd(seed, v, x >> 2, y, 1) < 0.18 && col === 1) c = pal.dark
      p.set(x, y, c)
    }
  for (let x = 3; x < S; x += 4) p.vline(x, 0, S - 1, pal.deep)
  // horizontal beam
  const by = 7
  p.hline(0, 15, by - 1, pal.deep)
  p.hline(0, 15, by, pal.light)
  p.hline(0, 15, by + 1, pal.base)
  p.hline(0, 15, by + 2, pal.deep)
  for (const x of [1, 9]) p.set(x, by + 1, '#2a2226')
  if (v === 1) {
    p.set(6, 3, pal.deep)
    p.set(6, 4, pal.dark)
    p.set(13, 12, pal.deep)
  }
}

const roof: Painter = (p, v, pal, seed) => {
  p.rect(0, 0, S, S, pal.deep)
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 2 : 0
    for (let k = -1; k < 5; k++) {
      const x0 = k * 4 + off
      const t = rnd(seed, v, row, ((k % 4) + 4) % 4) - 0.5
      const edge = x0 < 0 || x0 + 3 >= S
      const base = edge ? pal.base : t > 0.3 ? pal.light : t < -0.35 ? pal.dark : pal.base
      for (let yy = 0; yy < 4; yy++)
        for (let xx = 0; xx < 4; xx++) {
          const x = (((x0 + xx) % S) + S) % S
          const y = row * 4 + yy
          let c = base
          if (yy === 3) c = xx === 0 || xx === 3 ? pal.deep : pal.dark
          else if (yy === 0) c = mix(base, pal.hi, 0.35)
          else if (xx === 3) c = mix(base, pal.dark, 0.6)
          else if (xx === 0) c = mix(base, pal.light, 0.4)
          p.set(x, y, c)
        }
    }
  }
  if (v === 1) {
    p.set(6, 9, '#6a8a44')
    p.set(7, 9, '#7a9a50')
  }
}

const floorWood: Painter = (p, v, pal, seed) => {
  const seams = [
    [3, 11],
    [7],
    [1, 13],
    [9],
  ]
  for (let row = 0; row < 4; row++) {
    const t = rnd(seed, row, 3) - 0.5
    const base = t > 0.25 ? mix(pal.base, pal.light, 0.4) : t < -0.25 ? mix(pal.base, pal.dark, 0.35) : pal.base
    for (let yy = 0; yy < 4; yy++)
      for (let x = 0; x < S; x++) {
        const y = row * 4 + yy
        let c = base
        if (yy === 3) c = pal.deep
        else if (yy === 0) c = mix(base, pal.light, 0.5)
        else if (rnd(seed, v, x >> 1, y, 5) < 0.14) c = mix(base, pal.dark, 0.6)
        p.set(x, y, c)
      }
    const ss = seams[(row + v) % seams.length]
    for (const sx of ss) {
      p.vline(sx, row * 4, row * 4 + 2, pal.deep)
      p.set(sx + 1, row * 4 + 1, '#3a2a22')
    }
  }
  if (v === 2) {
    p.set(12, 6, pal.deep)
    p.set(13, 6, pal.dark)
  }
}

const carpet: Painter = (p, v, pal, seed) => {
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = Math.abs(((x + 4) % 8) - 4)
      const dy = Math.abs(((y + 4) % 8) - 4)
      const d = dx + dy
      let c = pal.base
      if (d === 4) c = pal.dark
      else if (d === 0) c = pal.hi
      else if (d === 1) c = pal.light
      if (rnd(seed, v, x, y) < 0.06 && c === pal.base) c = mix(pal.base, pal.dark, 0.4)
      p.set(x, y, c)
    }
  for (let y = 0; y < S; y += 8) for (let x = 0; x < S; x += 8) p.set(x, y, mix(pal.hi, pal.dark, 0.3))
}

const sand: Painter = (p, v, pal, seed) => {
  ground(p, pal, seed, v, 0.27, 0.73, 0.03)
  speckle(p, seed, v, pal.dark, 0.025)
  speckle(p, seed + 1, v, pal.hi, 0.015)
  // wind ripples
  const r = new Rand(seed + v * 3)
  const n = v === 0 ? 1 : 2
  for (let i = 0; i < n; i++) {
    const y = 3 + i * 6 + r.int(3)
    const x0 = 2 + r.int(5)
    const len = 4 + r.int(4)
    for (let x = x0; x < x0 + len && x < 15; x++) {
      const yy = y + (x - x0 === 0 || x - x0 === len - 1 ? 1 : 0)
      p.set(x, yy, pal.light)
      p.set(x, yy + 1, pal.dark)
    }
  }
  if (v === 3) {
    // shell
    p.set(11, 11, '#f6e6d6')
    p.set(12, 11, '#f0b8a0')
    p.set(11, 12, '#d89a80')
    p.set(12, 12, '#f6e6d6')
  }
}

const snow: Painter = (p, v, pal, seed) => {
  ground(p, pal, seed, v, 0.27, 0.74, 0.03)
  speckle(p, seed, v, pal.dark, 0.015)
  for (const [x, y] of spots(seed, v, 1 + (v % 2), 2, 5)) {
    p.set(x, y, pal.hi)
    p.set(x - 1, y, pal.light)
    p.set(x + 1, y, pal.light)
    p.set(x, y - 1, pal.light)
    p.set(x, y + 1, pal.light)
  }
  if (v === 2) {
    // little drift shadow
    p.hline(4, 9, 11, pal.dark)
    p.hline(5, 8, 10, pal.hi)
  }
  if (v === 3) {
    p.set(10, 5, pal.deep)
    p.set(11, 5, pal.dark)
  }
}

const ice: Painter = (p, v, pal, seed) => {
  ground(p, pal, seed, v, 0.22, 0.76, 0.03)
  // diagonal streaks
  for (let i = 0; i < 2; i++) {
    const r = new Rand(seed + v * 11 + i)
    const x0 = 2 + r.int(10)
    const y0 = 2 + r.int(6)
    const len = 3 + r.int(3)
    for (let k = 0; k < len; k++) p.set(x0 + k, y0 + k * 1 - (k >> 1), pal.light)
  }
  // crack
  if (v !== 0) {
    const r = new Rand(seed * 5 + v)
    let x = 3 + r.int(9)
    let y = 3 + r.int(5)
    for (let k = 0; k < 6; k++) {
      p.set(x, y, pal.deep)
      x += r.int(3) - 1
      y += 1
      if (x < 1 || x > 14 || y > 14) break
    }
  }
  for (const [x, y] of spots(seed + 4, v, 2, 2, 6)) p.set(x, y, pal.hi)
}

function waterPaint(p: Pix, v: number, pal: Pal, seed: number, phase: number, deep: boolean): void {
  ground(p, pal, seed, v, 0.22, 0.78, 0.03)
  // waves: short crest marks; in animation frames they wrap around the tile
  const r = new Rand(seed + v * 17)
  const n = deep ? 2 : 3
  for (let i = 0; i < n; i++) {
    const y = 2 + i * 5 + r.int(2)
    const x0 = r.int(12) + phase
    const len = deep ? 3 : 3 + r.int(2)
    for (let k = 0; k < len; k++) {
      const x = (x0 + k) % S
      p.set(x, y, k === 0 || k === len - 1 ? pal.light : pal.hi)
      p.set(x, y + 1, pal.dark)
    }
  }
  if (!deep) {
    const [x, y] = spots(seed + 3, v, 1, 2, 4)[0]
    p.set((x + phase) % S, y, pal.light)
  }
}

const water: Painter = (p, v, pal, seed) => waterPaint(p, v, pal, seed, 0, false)
const deepwater: Painter = (p, v, pal, seed) => waterPaint(p, v, pal, seed, 0, true)

function canopy(q: Pix, cx: number, cy: number, rx: number, ry: number, leaf: Pal, seed: number): void {
  const bumps: [number, number, number][] = []
  const r = new Rand(seed)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r.next() * 0.5
    bumps.push([cx + Math.cos(a) * rx * 0.75, cy + Math.sin(a) * ry * 0.75, 2.4 + r.next()])
  }
  const inside = (x: number, y: number) => {
    const nx = (x + 0.5 - cx) / rx
    const ny = (y + 0.5 - cy) / ry
    if (nx * nx + ny * ny <= 0.82) return true
    return bumps.some(([bx, by, br]) => (x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 <= br * br)
  }
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!inside(x, y)) continue
      const nx = (x + 0.5 - cx) / rx
      const ny = (y + 0.5 - cy) / ry
      const l = -nx * 0.55 - ny * 0.75 + (rnd(seed, x, y) - 0.5) * 0.35
      q.set(x, y, l > 0.45 ? leaf.light : l > -0.15 ? leaf.base : l > -0.6 ? leaf.dark : leaf.deep)
    }
  // leaf clumps: small light arcs in the upper half, dark notches in the lower
  const rr = new Rand(seed + 1)
  for (let i = 0; i < 5; i++) {
    const x = Math.round(cx - rx * 0.6 + rr.next() * rx * 1.1)
    const y = Math.round(cy - ry * 0.6 + rr.next() * ry * 0.7)
    if (q.alpha(x, y) && q.alpha(x + 1, y)) {
      q.set(x, y, leaf.hi)
      q.set(x + 1, y, leaf.light)
      q.over(x - 1, y + 1, leaf.light)
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.round(cx - rx * 0.4 + rr.next() * rx * 1.2)
    const y = Math.round(cy + rr.next() * ry * 0.7)
    q.over(x, y, leaf.deep)
    q.over(x + 1, y, leaf.dark)
  }
}

const TREE_LEAF: Pal = { deep: '#1d4a2c', dark: '#2b6a36', base: '#3f8a3e', light: '#5eab4a', hi: '#8ccb62' }
const PINE_LEAF: Pal = { deep: '#133a2e', dark: '#1d5238', base: '#2a6a44', light: '#3d8750', hi: '#62a866' }
const BARK = { deep: '#2e1a12', dark: '#4a2e1c', base: '#6b4428', light: '#8a5c34' }

const tree: Painter = (p, v, _pal, seed) => {
  grassBase(p, v + 1, PALS.grass, strHash('grass'))
  // shadow on the grass
  p.ellipse(8.5, 13.5, 6, 2.2, PALS.grass.deep, 0.45)
  const trunk = layer((q) => {
    q.rect(6, 10, 4, 5, BARK.base)
    q.vline(6, 10, 14, BARK.light)
    q.vline(9, 10, 14, BARK.dark)
    q.set(5, 14, BARK.dark)
    q.set(10, 14, BARK.dark)
    q.set(7, 12, BARK.deep)
  })
  p.blit(trunk)
  const leaf = v === 1 || v === 3 ? { ...TREE_LEAF, base: '#468e3c', light: '#66b04c', hi: '#94cc66' } : TREE_LEAF
  const top = layer((q) => {
    canopy(q, 8, v === 3 ? 6.6 : 6.2, v === 3 ? 6.3 : 6.6, v === 3 ? 5.3 : 5.6, leaf, seed + v * 7)
    if (v === 2) {
      for (const [x, y] of [
        [5, 5],
        [10, 7],
        [8, 3],
      ])
        if (q.alpha(x, y)) {
          q.set(x, y, '#d8423a')
          q.set(x, y - 1, '#f08a6a')
        }
    }
  }, '#10261a', 0.75)
  p.blit(top)
}

const pine: Painter = (p, v, _pal, seed) => {
  grassBase(p, v + 2, PALS.grass, strHash('grass'))
  p.ellipse(8.5, 14, 5.5, 1.8, PALS.grass.deep, 0.45)
  const t = layer((q) => {
    q.rect(7, 12, 2, 3, BARK.base)
    q.set(8, 12, BARK.dark)
    q.set(8, 13, BARK.dark)
    q.set(8, 14, BARK.dark)
    const tiers: [number, number, number][] =
      v === 1
        ? [
            [1, 4, 3],
            [3, 7, 5],
            [6, 10, 6],
            [9, 12, 7],
          ]
        : [
            [1, 5, 3],
            [4, 9, 5],
            [7, 12, 7],
          ]
    for (const [top, bot, half] of tiers) {
      for (let y = top; y <= bot; y++) {
        const w = Math.round(((y - top + 1) / (bot - top + 1)) * half)
        for (let x = 8 - w; x <= 7 + w; x++) {
          const rel = (x - (7.5 - w)) / (2 * w + 1)
          let c = rel < 0.3 ? PINE_LEAF.light : rel > 0.7 ? PINE_LEAF.dark : PINE_LEAF.base
          if (y === bot && (x + y) % 2 === 0) c = PINE_LEAF.deep
          if (y === top + 1 && x === 7) c = PINE_LEAF.hi
          q.set(x, y, c)
        }
      }
    }
    q.set(7, 0, PINE_LEAF.light)
    q.set(8, 0, PINE_LEAF.base)
    void seed
  }, '#0c2018', 0.8)
  p.blit(t)
}

const bush: Painter = (p, v, _pal, seed) => {
  grassBase(p, v + 1, PALS.grass, strHash('grass'))
  p.ellipse(8.5, 13.5, 6.5, 2, PALS.grass.deep, 0.4)
  const leaf: Pal = { deep: '#24542e', dark: '#357a38', base: '#4f9a44', light: '#6fb856', hi: '#9ad472' }
  const b = layer((q) => {
    canopy(q, 8, 9.5, 6.2, 4.4, leaf, seed + v * 5)
    if (v === 1)
      for (const [x, y] of [
        [5, 8],
        [9, 10],
        [11, 8],
        [7, 12],
        [4, 11],
      ])
        if (q.alpha(x, y)) {
          q.set(x, y, '#c8324a')
          q.over(x, y - 1, '#f07a8a')
        }
    if (v === 2)
      for (const [x, y] of [
        [5, 7],
        [10, 9],
        [8, 11],
      ])
        if (q.alpha(x, y)) {
          q.set(x, y, '#f7f3e6')
          q.over(x + 1, y, '#f7d84a')
        }
  }, '#10261a', 0.75)
  p.blit(b)
}

/**
 * Lumpy rock: a set of rounded lumps (optionally wrapping around the tile); each pixel
 * belongs to the highest lump over it and is shaded by that lump's normal, while the low
 * ground between lumps becomes dark crevices.
 */
function lumps(p: Pix, pal: Pal, ls: [number, number, number, number][], seed: number, v: number, wrap: boolean, crevice = 0.08): void {
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let best = -1
      let bn: [number, number] = [0, 0]
      for (const [cx, cy, rx, ry] of ls) {
        for (const ox of wrap ? [-S, 0, S] : [0])
          for (const oy of wrap ? [-S, 0, S] : [0]) {
            const nx = (x + 0.5 - cx - ox) / rx
            const ny = (y + 0.5 - cy - oy) / ry
            const h = 1 - (nx * nx + ny * ny)
            if (h > best) {
              best = h
              bn = [nx, ny]
            }
          }
      }
      if (best < crevice) {
        if (wrap || best >= 0) p.set(x, y, best < 0 ? pal.deep : mix(pal.deep, pal.dark, 0.5))
        continue
      }
      const l = -bn[0] * 0.6 - bn[1] * 0.75 + (rnd(seed, v, x, y, 9) - 0.5) * 0.25
      p.set(x, y, l > 0.6 ? pal.hi : l > 0.15 ? pal.light : l > -0.35 ? pal.base : pal.dark)
    }
}

function rockTexture(p: Pix, pal: Pal, seed: number, v: number): void {
  const r = new Rand(seed * 17 + v * 101)
  const ls: [number, number, number, number][] = []
  for (let i = 0; i < 5; i++) ls.push([r.next() * S, r.next() * S, 4 + r.next() * 2.5, 3.5 + r.next() * 2])
  lumps(p, pal, ls, seed, v, true)
}

const caveWall: Painter = (p, v, pal, seed) => {
  rockTexture(p, pal, seed, v)
  if (v === 1) {
    // mineral glint
    for (let y = 2; y < 14; y++)
      for (let x = 2; x < 14; x++)
        if (p.get(x, y) === pal.light && rnd(seed, x, y, 77) < 0.08) {
          p.set(x, y, '#8fc8e0')
          p.set(x + 1, y, '#dff6ff')
          return
        }
  }
}

const rock: Painter = (p, v, pal, seed) => {
  grassBase(p, v + 1, PALS.grass, strHash('grass'))
  const shapes: [number, number, number, number][][] = [
    [[8, 8.6, 6.8, 5.8]],
    [
      [6, 8.2, 5, 4.6],
      [11.6, 11.2, 3.2, 2.8],
    ],
    [
      [8.4, 8, 6.2, 5.4],
      [3.2, 12.4, 2.2, 1.8],
    ],
  ]
  const ls = shapes[v % shapes.length]
  for (const [cx, cy, rx] of ls) p.ellipse(cx + 0.5, cy + rx * 0.75, rx, 1.6, PALS.grass.deep, 0.45)
  const q = new Pix(S, S)
  for (const l of ls) {
    const one = new Pix(S, S)
    lumps(one, pal, [l], seed, v, false, 0)
    q.blit(one)
  }
  // crack and moss
  const [cx, cy] = ls[0]
  q.over(Math.round(cx) - 1, Math.round(cy), pal.deep)
  q.over(Math.round(cx), Math.round(cy) + 1, pal.deep)
  q.over(Math.round(cx), Math.round(cy) + 2, pal.dark)
  if (v === 2) {
    for (const [x, y] of [
      [6, 4],
      [7, 3],
      [8, 3],
      [9, 4],
      [5, 5],
    ])
      q.over(x, y, y === 3 ? '#8ccb62' : '#5ea24a')
  }
  q.outline('#1a1520', 0.75)
  p.blit(q)
}

const caveFloor: Painter = (p, v, pal, seed) => {
  ground(p, pal, seed, v, 0.28, 0.72)
  speckle(p, seed, v, pal.dark, 0.03)
  const pts = spots(seed, v, 1 + (v % 3), 2, 5)
  pts.forEach(([x, y]) => pebble(p, x, y, pal))
  if (v === 2) {
    p.set(4, 11, pal.deep)
    p.set(5, 12, pal.deep)
    p.set(6, 12, pal.deep)
  }
}

function lavaPaint(p: Pix, v: number, pal: Pal, seed: number): void {
  const n = fbmEdge(seed, v)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const k = n(x, y)
      let c: string
      if (k < 0.3) c = pal.deep
      else if (k < 0.37) c = pal.dark
      else if (k < 0.42) c = '#b8321a'
      else if (k < 0.6) c = pal.base
      else if (k < 0.72) c = pal.light
      else c = pal.hi
      p.set(x, y, c)
    }
  // crust highlights
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) if (n(x, y) < 0.3 && n(x, y - 1) >= 0.3) p.set(x, y, '#8a3a24')
}

const lava: Painter = (p, v, pal, seed) => lavaPaint(p, v, pal, seed)

const ash: Painter = (p, v, pal, seed) => {
  ground(p, pal, seed, v, 0.28, 0.7)
  speckle(p, seed, v, pal.deep, 0.035)
  speckle(p, seed + 2, v, pal.hi, 0.015)
  const pts = v === 1 ? spots(seed, v, 1, 3, 6) : []
  for (const [x, y] of pts) {
    p.set(x, y, '#f07a2a')
    p.set(x + 1, y, '#a83a1e')
    p.set(x, y + 1, '#6a2a1e')
  }
  if (v === 2) {
    p.line(3, 11, 8, 9, '#221c1a')
    p.set(6, 9, '#221c1a')
  }
}

const charredTree: Painter = (p, v, _pal, seed) => {
  ash(p, v, PALS.ash, strHash('ash'))
  p.ellipse(8.5, 14.3, 4.5, 1.4, '#221e1c', 0.5)
  const t = layer((q) => {
    const c = '#2a2220'
    const l = '#463a34'
    q.rect(7, 5, 3, 10, c)
    q.vline(7, 5, 14, l)
    q.set(6, 14, c)
    q.set(10, 14, c)
    // branches
    q.line(7, 7, 4, 4, c)
    q.line(4, 4, 4, 2, c)
    q.line(9, 6, 12, 3, c)
    q.line(12, 3, 13, 3, c)
    q.line(8, 5, 8, 1, c)
    q.set(5, 5, l)
    q.set(10, 5, l)
    if (v === 0) q.set(8, 10, '#e8642a')
    q.set(9, 12, '#1a1412')
  }, '#0c0908', 0.8)
  p.blit(t)
  void seed
}

const stump: Painter = (p, v, _pal, seed) => {
  grassBase(p, v + 3, PALS.grass, strHash('grass'))
  p.ellipse(8.5, 13, 6, 2, PALS.grass.deep, 0.4)
  const t = layer((q) => {
    // bark side
    q.rect(3, 8, 10, 5, BARK.base)
    q.vline(3, 8, 12, BARK.light)
    q.vline(12, 8, 12, BARK.dark)
    q.set(6, 10, BARK.dark)
    q.set(6, 11, BARK.dark)
    q.set(9, 9, BARK.dark)
    q.set(9, 10, BARK.dark)
    // roots
    q.set(2, 12, BARK.base)
    q.set(13, 12, BARK.dark)
    q.set(7, 13, BARK.dark)
    q.set(8, 13, BARK.base)
    // cut face
    q.ellipse(8, 7.5, 5, 2.6, '#c89a62')
    q.ellipse(8, 7.5, 3.2, 1.6, '#b0824e')
    q.ellipse(8, 7.5, 1.5, 0.8, '#d6ac72')
    q.set(10, 7, '#8a6038')
  }, '#1f140e', 0.75)
  p.blit(t)
  void seed
}

const gravel: Painter = (p, v, pal, seed) => {
  ground(p, pal, seed, v, 0.3, 0.7)
  const r = new Rand(seed * 13 + v)
  for (let i = 0; i < 12; i++) {
    const x = 1 + r.int(14)
    const y = 1 + r.int(14)
    if (r.chance(0.5)) pebble(p, x, y, pal)
    else {
      p.set(x, y, pal.light)
      p.set(x, y + 1, pal.deep)
    }
  }
}

const bridge: Painter = (p, v, pal, seed) => {
  p.rect(0, 0, S, S, '#1d2a44')
  for (let row = 0; row < 4; row++) {
    const t = rnd(seed, v, row) - 0.5
    const base = t > 0.2 ? pal.light : t < -0.2 ? mix(pal.base, pal.dark, 0.5) : pal.base
    const y0 = row * 4
    for (let yy = 0; yy < 3; yy++)
      for (let x = 0; x < S; x++) {
        let c = base
        if (yy === 0) c = mix(base, pal.hi, 0.4)
        if (yy === 2) c = pal.dark
        if (yy === 1 && rnd(seed, v, x >> 2, row, 3) < 0.25) c = mix(base, pal.dark, 0.5)
        p.set(x, y0 + yy, c)
      }
    p.hline(0, 15, y0 + 3, pal.deep)
    p.set(2, y0 + 1, '#3a3036')
    p.set(13, y0 + 1, '#3a3036')
  }
  // side rope rails
  p.vline(0, 0, 15, pal.deep)
  p.vline(15, 0, 15, pal.deep)
}

const farmland: Painter = (p, v, pal, seed) => {
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const k = y % 4
      // ridge (k 0-1) catches light, furrow (k 2-3) sits in shadow
      let c = k === 0 ? pal.light : k === 1 ? pal.base : k === 2 ? pal.dark : pal.deep
      const r = rnd(seed, v, x, y)
      if (k === 0 && r < 0.18) c = pal.hi
      else if (k === 1 && r < 0.15) c = pal.light
      else if (k === 3 && r < 0.25) c = pal.dark
      p.set(x, y, c)
    }
  for (const [x, y] of spots(seed, v, 3, 1, 4)) {
    const yy = y - (y % 4)
    p.set(x, yy, pal.hi)
    p.set(x + 1, yy, pal.light)
    p.set(x, yy + 1, pal.dark)
    p.set(x + 1, yy + 1, pal.deep)
  }
}

const mud: Painter = (p, v, pal, seed) => {
  ground(p, pal, seed, v, 0.3, 0.7)
  const pts = spots(seed, v, v === 0 ? 2 : 1, 3, 6)
  pts.forEach(([x, y], i) => {
    if (i === 0 && v === 0) {
      p.ellipse(x, y, 3, 1.6, pal.deep)
      p.set(x - 1, y - 1, pal.hi)
      p.set(x, y - 1, pal.light)
    } else {
      p.set(x, y, pal.hi)
      p.set(x + 1, y, pal.light)
      p.set(x, y + 1, pal.deep)
    }
  })
  speckle(p, seed, v, pal.dark, 0.06)
}

const door: Painter = (p, _v, pal) => {
  const frame = '#3a3240'
  const frameL = '#5a5262'
  p.rect(0, 0, S, S, frame)
  // stone frame bevel
  p.hline(0, 15, 0, frameL)
  p.vline(0, 0, 15, frameL)
  // door leaf
  for (let y = 2; y < S; y++)
    for (let x = 2; x < 14; x++) {
      const col = (x - 2) % 4
      let c = col === 0 ? pal.light : col === 3 ? pal.dark : pal.base
      if (y === 2) c = pal.dark
      p.set(x, y, c)
    }
  // arch corners
  p.set(2, 2, frame)
  p.set(13, 2, frame)
  for (const y of [5, 12]) {
    p.hline(2, 13, y, '#3c3a44')
    p.hline(2, 13, y - 1, '#6a6874')
    p.set(3, y - 1, '#9a98a4')
    p.set(12, y - 1, '#9a98a4')
  }
  // knob
  p.set(11, 9, '#f2c94c')
  p.set(11, 10, '#a87c20')
  p.set(10, 9, pal.deep)
  // shadow on the right of the recess
  p.vline(13, 3, 15, pal.deep)
}

function stairs(p: Pix, pal: Pal, down: boolean): void {
  p.rect(0, 0, S, S, pal.dark)
  // side walls
  for (let y = 0; y < S; y++) {
    p.set(0, y, pal.light)
    p.set(1, y, pal.base)
    p.set(14, y, pal.dark)
    p.set(15, y, pal.deep)
  }
  const steps = 5
  for (let i = 0; i < steps; i++) {
    const y0 = i * 3 + 1
    // i = 0 is the far (top) step
    const t = i / (steps - 1)
    const base = down ? mix(pal.deep, pal.light, t) : mix(pal.hi, pal.base, t * 0.8)
    for (let x = 2; x < 14; x++) {
      p.set(x, y0, mix(base, '#ffffff', down ? 0.12 : 0.2))
      p.set(x, y0 + 1, base)
      p.set(x, y0 + 2, mix(base, '#000000', 0.35))
    }
  }
  if (down) {
    // dark opening at the far end
    p.rect(2, 0, 12, 2, '#0e0e14')
  } else {
    p.rect(2, 0, 12, 1, pal.hi)
  }
}

const stairsDown: Painter = (p, _v, pal) => stairs(p, pal, true)
const stairsUp: Painter = (p, _v, pal) => stairs(p, pal, false)

const voidT: Painter = (p, v, _pal, seed) => {
  p.rect(0, 0, S, S, '#07060b')
  speckle(p, seed, v, '#141022', 0.03)
}

const generic: Painter = (p, v, pal, seed) => {
  ground(p, pal, seed, v, 0.3, 0.7)
  speckle(p, seed, v, pal.dark, 0.04)
}

const genericSolid: Painter = (p, v, pal, seed) => rockTexture(p, pal, seed, v)

interface TerrainSpec {
  painter: Painter
  variants: number
  anim?: boolean
}

const SPECS: Record<string, TerrainSpec> = {
  grass: { painter: grassBase, variants: 4 },
  drygrass: { painter: drygrass, variants: 4 },
  flowers: { painter: flowers, variants: 4 },
  dirt: { painter: dirt, variants: 4 },
  path: { painter: path, variants: 4 },
  cobble: { painter: cobble, variants: 3 },
  sand: { painter: sand, variants: 4 },
  snow: { painter: snow, variants: 4 },
  ice: { painter: ice, variants: 3 },
  water: { painter: water, variants: 2, anim: true },
  deepwater: { painter: deepwater, variants: 2, anim: true },
  tree: { painter: tree, variants: 4 },
  pine: { painter: pine, variants: 2 },
  bush: { painter: bush, variants: 3 },
  rock: { painter: rock, variants: 3 },
  wall: { painter: wall, variants: 2 },
  woodwall: { painter: woodwall, variants: 2 },
  roof: { painter: roof, variants: 2 },
  floor_wood: { painter: floorWood, variants: 3 },
  floor_stone: { painter: floorStone, variants: 2 },
  carpet: { painter: carpet, variants: 1 },
  door: { painter: door, variants: 1 },
  stairs_down: { painter: stairsDown, variants: 1 },
  stairs_up: { painter: stairsUp, variants: 1 },
  cave_floor: { painter: caveFloor, variants: 3 },
  cave_wall: { painter: caveWall, variants: 2 },
  lava: { painter: lava, variants: 2, anim: true },
  ash: { painter: ash, variants: 3 },
  charred_tree: { painter: charredTree, variants: 2 },
  stump: { painter: stump, variants: 1 },
  gravel: { painter: gravel, variants: 3 },
  bridge: { painter: bridge, variants: 2 },
  farmland: { painter: farmland, variants: 2 },
  mud: { painter: mud, variants: 3 },
  void: { painter: voidT, variants: 1 },
}

function specFor(t: { id: string; tags?: string[] }): TerrainSpec {
  const s = SPECS[t.id]
  if (s) return s
  const tags = t.tags ?? []
  if (tags.includes('water')) return { painter: water, variants: 2, anim: true }
  if (tags.includes('molten')) return SPECS.lava
  if (tags.includes('tree')) return SPECS.tree
  if (tags.includes('wall')) return tags.includes('wooden') ? SPECS.woodwall : SPECS.wall
  if (tags.includes('floor')) return tags.includes('wooden') ? SPECS.floor_wood : SPECS.floor_stone
  if (tags.includes('solid') || tags.includes('rock')) return { painter: genericSolid, variants: 2 }
  return { painter: generic, variants: tags.includes('ground') ? 3 : 2 }
}

function palFor(t: { id: string; color?: string; tags?: string[] }): Pal {
  if (PALS[t.id]) return PALS[t.id]
  if (t.id.startsWith('stairs')) return PALS.stairs
  return pal5(t.color ?? '#808080')
}

export function terrainSheet(terrains: { id: string; color?: string; tags?: string[] }[]): Sheet & { variants: Record<string, number> } {
  const items: { name: string; pix: Pix }[] = []
  const variants: Record<string, number> = {}
  for (const t of terrains) {
    const spec = specFor(t)
    // unknown terrains take their own colour even when borrowing a known painter
    const pal = palFor(t)
    const seed = strHash(t.id)
    variants[t.id] = spec.variants
    for (let v = 0; v < spec.variants; v++) {
      const p = new Pix(S, S)
      spec.painter(p, v, pal, seed)
      items.push({ name: `${t.id}#${v}`, pix: p })
    }
    if (spec.anim) {
      for (let f = 0; f < 2; f++) {
        const p = new Pix(S, S)
        if (spec.painter === lava) lavaPaint(p, 10 + f, pal, seed)
        else waterPaint(p, 0, pal, seed, f * 2, t.id === 'deepwater' || !!t.tags?.includes('deep'))
        items.push({ name: `${t.id}#anim${f}`, pix: p })
      }
    }
  }
  // Strict 16px grid, row-major; each terrain's variants occupy consecutive tile indices
  // (index = row * cols + col), so a tilemap can address them as firstIndex + variant.
  return { ...pack(items, 16), variants }
}
