// The agriculture branch's skill icons (the life tree grown to twenty nodes a branch: tilling, watering, sowing,
// harvesting, the crops of each kind and their market), 64x64, drawn by code in the look of the active skills' icons
// (skill-actives.ts): one bold emblem, a dark outline, three or four tones a colour, a few bright accents — in a
// farm's colours: soil browns, leaf greens, wheat gold, water blue.
//
//   npx tsx packages/tools/src/art/skill-life-agriculture.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [40, 18, 14, 255],
  // steel
  s1: [78, 84, 100, 255], s2: [138, 146, 162, 255], s3: [198, 205, 216, 255], s4: [246, 248, 252, 255],
  // wood
  w1: [86, 46, 26, 255], w2: [136, 80, 42, 255], w3: [188, 124, 68, 255],
  // gold
  g1: [146, 92, 28, 255], g2: [212, 150, 50, 255], g3: [250, 208, 98, 255], g4: [255, 240, 180, 255],
  // straw and wheat
  y1: [156, 112, 40, 255], y2: [214, 170, 70, 255], y3: [242, 210, 118, 255],
  // red (tomato, strawberry)
  r1: [116, 28, 30, 255], r2: [196, 50, 40, 255], r3: [240, 104, 74, 255], r4: [255, 190, 160, 255],
  // orange (carrot, pumpkin)
  o1: [168, 72, 22, 255], o2: [228, 120, 36, 255], o3: [252, 172, 76, 255],
  // leaf green
  l1: [34, 92, 40, 255], l2: [70, 150, 56, 255], l3: [132, 200, 82, 255], l4: [206, 240, 150, 255],
  // soil
  e1: [58, 36, 24, 255], e2: [96, 62, 38, 255], e3: [140, 96, 60, 255],
  // water
  i1: [40, 90, 160, 255], i2: [82, 150, 220, 255], i3: [160, 210, 246, 255], i4: [236, 250, 255, 255],
  // purple (eggplant, blueberry)
  v1: [52, 30, 84, 255], v2: [98, 60, 150, 255], v3: [150, 110, 206, 255],
  // potato and seeds
  u1: [120, 86, 50, 255], u2: [176, 134, 84, 255], u3: [216, 180, 122, 255],
  // cloth (pouch, packets)
  c1: [120, 96, 70, 255], c2: [182, 156, 118, 255], c3: [230, 214, 178, 255],
  // skin
  n1: [150, 90, 60, 255], n2: [204, 140, 100, 255], n3: [236, 184, 144, 255],
}

const S = 64
type P = [number, number]
type Ramp = [string, string, string, string?]

const thick = (r: Raster, a: P, b: P, c: string, w: number) => r.line(a[0], a[1], b[0], b[1], c, w)

function ball(r: Raster, cx: number, cy: number, rx: number, ramp: Ramp, ry = rx): void {
  r.ellipse(cx, cy, rx, ry, ramp[0])
  r.ellipse(cx - rx * 0.12, cy - ry * 0.12, rx * 0.82, ry * 0.82, ramp[1])
  r.ellipse(cx - rx * 0.3, cy - ry * 0.3, rx * 0.5, ry * 0.5, ramp[2])
  if (ramp[3]) r.ellipse(cx - rx * 0.42, cy - ry * 0.42, Math.max(1, rx * 0.18), Math.max(1, ry * 0.18), ramp[3])
}

function arc(r: Raster, cx: number, cy: number, rad: number, a0: number, a1: number, c: string, w = 1): void {
  const steps = Math.max(8, Math.ceil(Math.abs(a1 - a0) * rad * 0.05))
  let prev: P | undefined
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180
    const p: P = [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]
    if (prev) thick(r, prev, p, c, w)
    prev = p
  }
}

function sparkle(r: Raster, x: number, y: number, s: number, c: string, core = c): void {
  r.line(x - s, y, x + s, y, c)
  r.line(x, y - s, x, y + s, c)
  r.set(x, y, core)
}

/** A leaf: a pointed ellipse along a direction, a vein down its middle. */
function leaf(r: Raster, a: P, b: P, w: number, ramp: Ramp = ['l1', 'l2', 'l3']): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const d: P = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
  const n: P = [-d[1], d[0]]
  const at = (t: number, o: number): P => [a[0] + d[0] * t + n[0] * o, a[1] + d[1] * t + n[1] * o]
  r.poly([a, at(len * 0.3, w), at(len * 0.65, w * 0.8), b, at(len * 0.65, -w * 0.8), at(len * 0.3, -w)], ramp[1])
  r.poly([at(len * 0.2, w * 0.2), at(len * 0.35, w * 0.9), at(len * 0.6, w * 0.7), at(len * 0.85, w * 0.1)], ramp[2])
  thick(r, a, at(len * 0.85, 0), ramp[0], 1)
}

/** A sprout: a stem and two small leaves. */
function sprout(r: Raster, x: number, y: number, s = 1): void {
  thick(r, [x, y], [x, y - 7 * s], 'l1', 1)
  leaf(r, [x, y - 6 * s], [x - 6 * s, y - 10 * s], 2.2 * s)
  leaf(r, [x, y - 7 * s], [x + 6 * s, y - 12 * s], 2.2 * s)
}

/** A wheat ear: a bare stalk, then a head of plump kernels in pairs along it, an awn at the tip. */
function ear(r: Raster, base: P, tip: P, ramp: Ramp = ['y1', 'y2', 'y3'], head = 0.42): void {
  const len = Math.hypot(tip[0] - base[0], tip[1] - base[1])
  const d: P = [(tip[0] - base[0]) / len, (tip[1] - base[1]) / len]
  const n: P = [-d[1], d[0]]
  const start = len * (1 - head)
  thick(r, base, [base[0] + d[0] * start, base[1] + d[1] * start], ramp[0], 1)
  let side = 1
  for (let t = start; t < len - 1; t += 2.6) {
    const c: P = [base[0] + d[0] * t + n[0] * side * 1.6, base[1] + d[1] * t + n[1] * side * 1.6]
    r.ellipse(c[0], c[1], 1.7, 1.7, ramp[0])
    r.ellipse(c[0] - 0.3, c[1] - 0.3, 1.2, 1.2, ramp[1])
    r.set(c[0] - 0.6, c[1] - 0.6, ramp[2])
    side = -side
  }
  r.line(tip[0], tip[1], tip[0] + d[0] * 4, tip[1] + d[1] * 4, ramp[0])
}

/** A sheaf: stalks bound together low, the ears fanning out wide above the band. */
function sheaf(r: Raster, cx: number, cy: number, ramp: Ramp, h = 30): void {
  const base: P = [cx, cy + h * 0.5]
  const band: P = [cx, cy + h * 0.12]
  const tips: P[] = [-50, -28, -9, 9, 28, 50].map((a) => {
    const rad = ((a - 90) * Math.PI) / 180
    return [band[0] + Math.cos(rad) * h * 0.62, band[1] + Math.sin(rad) * h * 0.62]
  })
  // the bound stalks below the band
  for (const dx of [-4, -2, 0, 2, 4]) thick(r, [band[0] + dx * 0.5, band[1]], [base[0] + dx, base[1]], ramp[0], 1)
  for (const t of tips) ear(r, band, t, ramp, 0.55)
  r.rect(cx - 4, band[1] - 1, 9, 4, 'w2')
  r.rect(cx - 4, band[1] - 1, 9, 1, 'w3')
}

function tomato(r: Raster, x: number, y: number, s: number): void {
  ball(r, x, y, s, ['r1', 'r2', 'r3', 'r4'], s * 0.88)
  for (const a of [-60, -100, -140, -20]) {
    const rad = (a * Math.PI) / 180
    thick(r, [x, y - s * 0.75], [x + Math.cos(rad) * s * 0.55, y - s * 0.75 + Math.sin(rad) * s * 0.35], 'l2', 1)
  }
  r.set(x, y - s - 1, 'l1')
}

function carrot(r: Raster, a: P, b: P, w: number): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const d: P = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
  const n: P = [-d[1], d[0]]
  r.poly([[a[0] + n[0] * w, a[1] + n[1] * w], b, [a[0] - n[0] * w, a[1] - n[1] * w]], 'o2')
  thick(r, [a[0] + n[0] * w * 0.4, a[1] + n[1] * w * 0.4], [b[0] - d[0] * 3, b[1] - d[1] * 3], 'o3', 1)
  for (let t = 5; t < len - 4; t += 5) r.line(a[0] + d[0] * t + n[0] * w * 0.5, a[1] + d[1] * t + n[1] * w * 0.5, a[0] + d[0] * t + n[0] * w * 0.1, a[1] + d[1] * t + n[1] * w * 0.1, 'o1')
  leaf(r, a, [a[0] - d[0] * 9 + n[0] * 4, a[1] - d[1] * 9 + n[1] * 4], 1.6)
  leaf(r, a, [a[0] - d[0] * 10 - n[0] * 3, a[1] - d[1] * 10 - n[1] * 3], 1.6)
}

function potato(r: Raster, x: number, y: number, s: number): void {
  ball(r, x, y, s, ['u1', 'u2', 'u3'], s * 0.75)
  for (const [dx, dy] of [[-0.3, 0.1], [0.25, -0.15], [0.4, 0.3]]) r.set(x + dx * s, y + dy * s, 'u1')
}

function pumpkin(r: Raster, x: number, y: number, s: number): void {
  for (const dx of [-0.55, 0.55]) ball(r, x + dx * s, y, s * 0.6, ['o1', 'o2', 'o3'], s * 0.82)
  ball(r, x, y, s * 0.62, ['o1', 'o2', 'o3'], s * 0.86)
  r.line(x - s * 0.3, y - s * 0.5, x - s * 0.3, y + s * 0.6, 'o1')
  r.line(x + s * 0.3, y - s * 0.5, x + s * 0.3, y + s * 0.6, 'o1')
  thick(r, [x, y - s * 0.75], [x + 2, y - s * 1.15], 'w2', 2)
  leaf(r, [x + 1, y - s * 0.85], [x + s * 0.8, y - s * 1.2], 2.4)
}

function eggplant(r: Raster, x: number, y: number, s: number): void {
  ball(r, x, y + s * 0.25, s * 0.7, ['v1', 'v2', 'v3'], s)
  ball(r, x - s * 0.15, y - s * 0.5, s * 0.45, ['v1', 'v2', 'v3'], s * 0.5)
  r.poly([[x - s * 0.6, y - s * 0.75], [x + s * 0.4, y - s * 0.85], [x - s * 0.1, y - s * 1.15]], 'l2')
  thick(r, [x - s * 0.1, y - s * 1.1], [x + 1, y - s * 1.5], 'l1', 1)
}

function pepper(r: Raster, a: P, b: P, w: number): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const d: P = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
  const n: P = [-d[1], d[0]]
  const at = (t: number, o: number): P => [a[0] + d[0] * t + n[0] * o, a[1] + d[1] * t + n[1] * o]
  r.poly([at(0, w), at(len * 0.6, w * 0.8), b, at(len * 0.6, -w * 0.6), at(0, -w)], 'r2')
  thick(r, at(2, w * 0.4), at(len * 0.7, w * 0.3), 'r3', 1)
  thick(r, a, at(-4, 2), 'l2', 2)
}

function berry(r: Raster, x: number, y: number, s: number, ramp: Ramp): void {
  ball(r, x, y, s, ramp)
}

function strawberry(r: Raster, x: number, y: number, s: number): void {
  r.poly([[x - s, y - s * 0.4], [x + s, y - s * 0.4], [x + s * 0.7, y + s * 0.4], [x, y + s * 1.2], [x - s * 0.7, y + s * 0.4]], 'r2')
  r.ellipse(x - s * 0.3, y - s * 0.1, s * 0.4, s * 0.35, 'r3')
  for (const [dx, dy] of [[-0.5, 0], [0.4, 0.1], [0, 0.5], [-0.2, -0.2], [0.5, -0.3]]) r.set(x + dx * s, y + dy * s, 'g3')
  r.poly([[x - s * 0.8, y - s * 0.5], [x, y - s * 1.1], [x + s * 0.8, y - s * 0.5], [x, y - s * 0.3]], 'l2')
}

function coin(r: Raster, x: number, y: number, s: number): void {
  r.ellipse(x, y, s, s, 'g1')
  r.ellipse(x - 0.5, y - 0.5, s - 1.2, s - 1.2, 'g2')
  r.ellipse(x - 1, y - 1, s * 0.5, s * 0.5, 'g3')
  r.line(x - 1, y - s * 0.45, x - 1, y + s * 0.45, 'g1')
  r.set(x - s * 0.5, y - s * 0.5, 'g4')
}

function crown(r: Raster, x: number, y: number, w: number): void {
  r.poly([[x - w, y + 5], [x - w, y - 3], [x - w * 0.5, y + 1], [x, y - 6], [x + w * 0.5, y + 1], [x + w, y - 3], [x + w, y + 5]], 'g2')
  r.rect(x - w, y + 3, w * 2 + 1, 2, 'g1')
  r.line(x - w + 1, y - 1, x - w + 1, y + 2, 'g3')
  for (const dx of [-w, 0, w]) r.ellipse(x + dx, y + (dx === 0 ? -6 : -3), 1.2, 1.2, 'g3')
  r.set(x, y + 3, 'r3')
}

/** A tilled furrow seen from above: a long mound with a dark groove. */
function furrow(r: Raster, x0: number, y: number, x1: number): void {
  r.rect(x0, y - 2, x1 - x0, 5, 'e2')
  r.rect(x0, y - 2, x1 - x0, 1, 'e3')
  r.rect(x0 + 1, y + 1, x1 - x0 - 2, 1, 'e1')
}

function hoe(r: Raster, top: P, head: P, wide = false): void {
  thick(r, top, head, 'w2', 2)
  thick(r, [top[0] + 1, top[1]], [head[0] + 1, head[1] - 1], 'w3', 1)
  const hw = wide ? 9 : 5
  r.poly([[head[0] - hw, head[1]], [head[0] + hw, head[1]], [head[0] + hw - 1, head[1] + 6], [head[0] - hw + 1, head[1] + 6]], 's2')
  r.line(head[0] - hw, head[1], head[0] + hw, head[1], 's3')
  r.line(head[0] - hw + 1, head[1] + 6, head[0] + hw - 1, head[1] + 6, 's1')
}


function droplet(r: Raster, x: number, y: number, s: number): void {
  r.ellipse(x, y, s, s * 1.15, 'i1')
  r.ellipse(x - s * 0.1, y, s * 0.75, s * 0.95, 'i2')
  r.poly([[x - s * 0.6, y - s * 0.5], [x, y - s * 2.2], [x + s * 0.6, y - s * 0.5]], 'i2')
  r.set(x - s * 0.35, y - s * 0.3, 'i4')
}

const out: Record<string, Raster> = {}
const icon = (id: string, draw: (r: Raster) => void) => {
  const r = new Raster(S, S)
  draw(r)
  out[id] = r
}

// ---------------------------------------------------------------- the agriculture branch

icon('farmer', (r) => {
  hoe(r, [46, 54], [18, 22])
  // the straw hat: a wide brim and a crown, a red band
  r.ellipse(34, 34, 22, 7, 'y1')
  r.ellipse(34, 33, 20, 5.5, 'y2')
  r.ellipse(30, 32, 12, 3, 'y3')
  r.poly([[22, 32], [24, 18], [34, 14], [44, 18], [46, 32]], 'y2')
  r.poly([[25, 30], [26, 19], [33, 16], [36, 17], [30, 30]], 'y3')
  r.rect(23, 26, 23, 4, 'r2')
  r.rect(23, 26, 23, 1, 'r3')
  for (let x = 26; x < 44; x += 4) r.set(x, 22, 'y1')
  r.outline('k')
})

icon('green-fingers', (r) => {
  tomato(r, 26, 26, 11)
  thick(r, [26, 14], [30, 8], 'l1', 1)
  // a hand from below right, thumb and fingers closing on it
  r.poly([[34, 58], [36, 40], [40, 34], [52, 32], [56, 38], [54, 50], [48, 58]], 'n2')
  r.poly([[37, 56], [38, 42], [42, 37], [46, 37], [42, 46], [42, 56]], 'n3')
  for (const [x, y] of [[40, 34], [45, 32], [50, 32]] as P[]) (r.ellipse(x, y, 2.6, 4, 'n2'), r.set(x - 1, y - 2, 'n3'))
  r.poly([[33, 42], [30, 36], [33, 33], [37, 38]], 'n2')
  r.line(41, 44, 49, 44, 'n1')
  sparkle(r, 11, 12, 2, 'l4')
  r.outline('k', ['l4'])
})

icon('bountiful', (r) => {
  // the basket: a woven bowl, a handle
  arc(r, 32, 30, 20, 180, 360, 'w2', 2)
  tomato(r, 22, 28, 7)
  pumpkin(r, 40, 28, 8)
  carrot(r, [30, 26], [26, 12], 3)
  eggplant(r, 32, 30, 6)
  r.poly([[8, 32], [56, 32], [50, 54], [14, 54]], 'w2')
  for (let y = 36; y < 54; y += 4) r.line(10 + (y - 32) * 0.12, y, 54 - (y - 32) * 0.12, y, 'w1')
  for (let x = 14; x < 52; x += 6) r.line(x, 33, x + 1, 53, 'w3')
  r.rect(8, 31, 49, 3, 'w3')
  r.outline('k')
})

icon('rich-soil', (r) => {
  r.ellipse(32, 46, 24, 10, 'e1')
  r.ellipse(31, 44, 22, 8, 'e2')
  r.ellipse(26, 41, 12, 4, 'e3')
  for (const [x, y] of [[18, 45], [40, 46], [30, 49], [46, 42], [22, 40]] as P[]) r.set(x, y, 'e1')
  sprout(r, 32, 40, 1.6)
  sparkle(r, 12, 22, 3, 'g3', 'g4')
  sparkle(r, 52, 20, 2, 'g3', 'g4')
  sparkle(r, 48, 32, 2, 'l4')
  r.outline('k', ['g3', 'g4', 'l4'])
})

icon('composter', (r) => {
  // a sack of fertilizer, tied, leaves spilling
  r.poly([[16, 56], [12, 34], [18, 22], [46, 22], [52, 34], [48, 56]], 'c2')
  r.poly([[18, 54], [15, 34], [20, 24], [28, 24], [24, 54]], 'c3')
  r.poly([[22, 22], [26, 14], [38, 14], [42, 22]], 'c1')
  r.rect(22, 20, 20, 3, 'w1')
  r.ellipse(32, 40, 9, 9, 'e2')
  r.ellipse(31, 39, 6, 6, 'e3')
  leaf(r, [32, 38], [27, 31], 2.4)
  leaf(r, [32, 38], [38, 32], 2.4)
  leaf(r, [44, 52], [56, 46], 3)
  leaf(r, [16, 52], [6, 46], 3, ['l1', 'l2', 'l4'])
  r.outline('k')
})

icon('wide-hoe', (r) => {
  furrow(r, 6, 40, 58)
  furrow(r, 6, 48, 58)
  furrow(r, 6, 56, 58)
  hoe(r, [52, 6], [26, 30], true)
  r.outline('k')
})

icon('irrigation', (r) => {
  furrow(r, 6, 54, 58)
  // a channel of water running into the soil, a bucket tipping
  r.rect(30, 48, 26, 4, 'i2')
  r.rect(30, 48, 26, 1, 'i3')
  thick(r, [24, 30], [30, 48], 'i2', 3)
  thick(r, [25, 31], [30, 46], 'i3', 1)
  droplet(r, 36, 40, 2)
  droplet(r, 22, 42, 2)
  r.ellipse(20, 20, 0, 0, 'k')
  // the bucket, tipped
  r.poly([[8, 12], [24, 8], [28, 26], [14, 28]], 'w2')
  r.line(10, 16, 25, 13, 's2')
  r.line(12, 23, 27, 20, 's2')
  r.line(9, 13, 14, 27, 'w3')
  r.ellipse(26, 17, 2.4, 9, 'w1')
  r.ellipse(26, 17, 1.4, 7, 'i2')
  arc(r, 16, 18, 10, 120, 240, 's2', 1)
  r.outline('k')
})

icon('sprinkler', (r) => {
  for (const x of [14, 32, 50]) sprout(r, x, 58, 1.1)
  // a fan of droplets from above
  for (const [x, y, s] of [[32, 10, 3], [20, 16, 2.6], [44, 16, 2.6], [12, 26, 2.2], [52, 26, 2.2], [26, 28, 2.2], [38, 28, 2.2], [32, 38, 1.8], [18, 38, 1.8], [46, 38, 1.8]] as [number, number, number][]) droplet(r, x, y, s)
  r.outline('k')
})

icon('seed-saver', (r) => {
  // a cloth pouch on its side, seeds spilling out
  r.poly([[8, 34], [14, 22], [30, 18], [40, 26], [40, 48], [22, 54], [10, 48]], 'c2')
  r.poly([[12, 34], [16, 25], [26, 22], [22, 46], [14, 46]], 'c3')
  r.rect(36, 24, 4, 26, 'c1')
  thick(r, [34, 22], [44, 18], 'w1', 2)
  thick(r, [36, 30], [46, 34], 'w1', 1)
  for (const [x, y] of [[46, 40], [50, 46], [44, 48], [54, 52], [48, 54], [56, 44], [42, 54], [52, 38]] as P[]) {
    r.ellipse(x, y, 2, 1.5, 'u2')
    r.set(x - 1, y - 1, 'u3')
  }
  r.outline('k')
})

icon('seed-merchant', (r) => {
  // two seed packets, a picture on each, and a coin
  const packet = (x: number, y: number, crop: (cx: number, cy: number) => void) => {
    r.rect(x, y, 18, 26, 'c3')
    r.rect(x, y, 18, 4, 'c1')
    r.rect(x + 1, y + 6, 16, 14, 'c2')
    crop(x + 9, y + 13)
  }
  packet(8, 12, (x, y) => carrot(r, [x - 3, y - 4], [x + 3, y + 5], 2.4))
  packet(26, 18, (x, y) => tomato(r, x, y + 1, 5))
  coin(r, 50, 46, 8)
  sparkle(r, 54, 30, 2, 'g4')
  r.outline('k', ['g4'])
})

icon('market-gardener', (r) => {
  // a crate of vegetables and a coin
  carrot(r, [18, 28], [12, 12], 3)
  tomato(r, 28, 26, 7)
  pumpkin(r, 42, 26, 7)
  r.rect(8, 30, 40, 22, 'w2')
  for (const y of [36, 44]) r.rect(8, y, 40, 1, 'w1')
  r.rect(8, 30, 40, 2, 'w3')
  r.rect(8, 30, 2, 22, 'w3')
  r.rect(46, 30, 2, 22, 'w1')
  coin(r, 50, 50, 8)
  r.outline('k')
})

icon('perennial-keeper', (r) => {
  // a berry bush, a circular arrow round it
  arc(r, 32, 34, 23, 200, 520, 'l3', 2)
  r.poly([[52, 26], [58, 34], [48, 34]], 'l3')
  for (const [x, y, s] of [[32, 34, 10], [24, 38, 8], [40, 38, 8], [32, 28, 8]] as [number, number, number][]) ball(r, x, y, s, ['l1', 'l2', 'l3'])
  for (const [x, y] of [[26, 34], [36, 30], [32, 40], [40, 38], [24, 40]] as P[]) berry(r, x, y, 2.4, ['v1', 'v2', 'v3'])
  thick(r, [32, 44], [32, 52], 'w2', 2)
  r.outline('k', ['l3'])
})

icon('herb-gardener', (r) => {
  // a little raised bed, three herbs
  r.rect(8, 44, 48, 12, 'w2')
  r.rect(8, 44, 48, 2, 'w3')
  r.rect(10, 46, 44, 3, 'e2')
  for (const [x, h] of [[18, 22], [32, 28], [46, 20]] as P[]) {
    thick(r, [x, 46], [x, 46 - h], 'l1', 1)
    for (let t = 6; t < h; t += 5) {
      leaf(r, [x, 46 - t], [x - 6, 46 - t - 4], 1.8, ['l1', 'l2', 'l4'])
      leaf(r, [x, 46 - t - 2], [x + 6, 46 - t - 6], 1.8)
    }
  }
  r.ellipse(32, 18, 2.2, 2.2, 'v3')
  r.ellipse(46, 26, 1.8, 1.8, 'v3')
  r.outline('k')
})

icon('berry-farmer', (r) => {
  strawberry(r, 42, 38, 11)
  for (const [x, y] of [[16, 22], [24, 18], [20, 30], [28, 26], [12, 30], [24, 34]] as P[]) berry(r, x, y, 5, ['v1', 'v2', 'v3'])
  for (const [x, y] of [[16, 22], [24, 18], [20, 30], [28, 26], [12, 30], [24, 34]] as P[]) r.set(x, y - 4, 'v1')
  leaf(r, [22, 14], [32, 8], 3)
  r.outline('k')
})

icon('grain-farmer', (r) => {
  sheaf(r, 32, 30, ['y1', 'y2', 'y3'], 44)
  r.outline('k')
})

icon('root-farmer', (r) => {
  carrot(r, [22, 16], [36, 54], 6)
  potato(r, 44, 40, 11)
  r.outline('k')
})

icon('gourd-farmer', (r) => {
  pumpkin(r, 30, 38, 16)
  thick(r, [44, 24], [54, 14], 'l1', 1)
  arc(r, 54, 18, 4, 180, 450, 'l2', 1)
  r.outline('k')
})

icon('fruit-farmer', (r) => {
  eggplant(r, 46, 36, 10)
  pepper(r, [16, 18], [12, 50], 5)
  tomato(r, 30, 44, 10)
  r.outline('k')
})

icon('golden-harvest', (r) => {
  // a golden sheaf, glowing
  // a soft ring of light behind it
  arc(r, 32, 30, 24, 0, 360, 'g3', 2)
  arc(r, 32, 30, 20, 0, 360, 'g4', 1)
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180
    r.line(32 + Math.cos(rad) * 25, 30 + Math.sin(rad) * 25, 32 + Math.cos(rad) * 28, 30 + Math.sin(rad) * 28, 'g3')
  }
  sheaf(r, 32, 30, ['g1', 'g2', 'g3'], 44)
  sparkle(r, 10, 14, 3, 'g3', 'g4')
  sparkle(r, 54, 12, 3, 'g3', 'g4')
  sparkle(r, 52, 50, 2, 'g3', 'g4')
  sparkle(r, 12, 48, 2, 'g3', 'g4')
  r.outline('k', ['g3', 'g4', 'y3'])
})

icon('master-farmer', (r) => {
  // a sickle crossed with a wheat ear, a gold crown above
  for (const [dx, dy] of [[-6, 2], [0, 0], [6, 2]] as P[]) ear(r, [18, 58], [38 + dx, 18 + dy], ['y1', 'y2', 'y3'], 0.5)
  arc(r, 34, 34, 14, 200, 330, 's2', 3)
  arc(r, 34, 34, 15, 205, 325, 's3', 1)
  thick(r, [22, 40], [44, 58], 'w2', 3)
  thick(r, [23, 40], [44, 56], 'w3', 1)
  crown(r, 32, 10, 12)
  r.outline('k')
})

for (const [id, r] of Object.entries(out)) writeAtlas(`Skills/${id}.png`, [[r]], PAL)
console.log(`${Object.keys(out).length} agriculture skill icons → public/assets/lsw/Skills`)
