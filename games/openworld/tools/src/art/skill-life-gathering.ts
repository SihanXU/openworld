// The gathering branch's skill icons (the life tree grown to twenty nodes a branch: woodcutting, mining, foraging and
// fishing), 64x64, drawn by code in the look of the other skill icons (skill-actives.ts): one bold emblem, a dark
// outline, three or four tones a colour, a few bright accents — in the earth's colours, wood, stone, leaf and water.
//
//   npx tsx packages/tools/src/art/skill-life-gathering.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [40, 18, 14, 255],
  // steel
  s1: [78, 84, 100, 255], s2: [138, 146, 162, 255], s3: [198, 205, 216, 255], s4: [246, 248, 252, 255],
  // wood and bark
  w1: [86, 46, 26, 255], w2: [136, 80, 42, 255], w3: [188, 124, 68, 255], w4: [226, 176, 112, 255],
  // gold
  g1: [146, 92, 28, 255], g2: [212, 150, 50, 255], g3: [250, 208, 98, 255], g4: [255, 242, 172, 255],
  // leaf
  l1: [36, 92, 40, 255], l2: [70, 146, 58, 255], l3: [124, 196, 84, 255], l4: [196, 236, 140, 255],
  // stone
  o1: [72, 70, 78, 255], o2: [116, 112, 120, 255], o3: [162, 158, 164, 255], o4: [206, 202, 206, 255],
  // iron ore's rust
  u1: [120, 58, 34, 255], u2: [176, 96, 56, 255],
  // water
  a1: [28, 58, 112, 255], a2: [46, 98, 168, 255], a3: [92, 156, 216, 255], a4: [180, 220, 246, 255],
  // the deep
  d1: [16, 26, 58, 255], d2: [26, 44, 92, 255],
  // a gem's violet and a red float
  v1: [76, 40, 140, 255], v2: [130, 84, 210, 255], v3: [196, 160, 255, 255],
  r1: [150, 32, 30, 255], r2: [214, 62, 50, 255], r3: [246, 128, 104, 255],
  // mushroom cream and pink bait
  c1: [212, 196, 162, 255], c2: [244, 234, 206, 255], n1: [196, 110, 110, 255], n2: [236, 160, 150, 255],
}

const S = 64
type P = [number, number]
type Ramp = [string, string, string, string?]
const NONE = null as unknown as string

const thick = (r: Raster, a: P, b: P, c: string, w: number) => r.line(a[0], a[1], b[0], b[1], c, w)


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

/** A log lying across: a bark body and a ringed end on the left. */
function log(r: Raster, x: number, y: number, len: number, rad: number): void {
  r.rect(x, y - rad, len, rad * 2, 'w2')
  r.rect(x, y - rad, len, Math.max(1, Math.round(rad * 0.5)), 'w3')
  r.rect(x, y + rad - 1, len, 1, 'w1')
  for (let i = x + 4; i < x + len - 2; i += 6) r.line(i, y - rad + 2, i + 2, y + rad - 2, 'w1')
  r.ellipse(x, y, rad * 0.7, rad, 'w3')
  r.ellipse(x, y, rad * 0.45, rad * 0.65, 'w4')
  r.set(x, y, 'w2')
}

/** An axe: a wooden haft from `end` to `head`, a steel head at `head` facing `dir` (1 right, -1 left). */
function axe(r: Raster, end: P, head: P, dir: 1 | -1, size = 1): void {
  thick(r, end, head, 'w2', 3)
  thick(r, [end[0] + 1, end[1]], [head[0] + 1, head[1]], 'w3', 1)
  const [hx, hy] = head
  const s = size
  r.poly([[hx, hy - 6 * s], [hx + dir * 12 * s, hy - 10 * s], [hx + dir * 15 * s, hy], [hx + dir * 12 * s, hy + 10 * s], [hx, hy + 6 * s]], 's2')
  r.poly([[hx + dir * 3, hy - 5 * s], [hx + dir * 11 * s, hy - 8 * s], [hx + dir * 11 * s, hy - 2 * s], [hx + dir * 3, hy - 2]], 's3')
  thick(r, [hx + dir * 13 * s, hy - 8 * s], [hx + dir * 14 * s, hy + 8 * s], 's4', 1)
  r.rect(hx - 2, hy - 7 * s, 4, 14 * s, 's1')
}

/** A pickaxe: a haft from `end` to `head`, a curved steel head across it. */
function pickaxe(r: Raster, end: P, head: P, size = 1): void {
  thick(r, end, head, 'w2', 3 + (size > 1 ? 1 : 0))
  thick(r, [end[0] + 1, end[1]], [head[0] + 1, head[1]], 'w3', 1)
  const [hx, hy] = head
  const s = size
  const pts: P[] = []
  for (let i = -10; i <= 10; i++) pts.push([hx + i * 1.4 * s, hy + (i * i * 0.07 - 4) * s])
  for (let i = 0; i < pts.length - 1; i++) thick(r, pts[i], pts[i + 1], 's2', 4 * s)
  for (let i = 0; i < pts.length - 1; i++) thick(r, [pts[i][0], pts[i][1] - 1.5 * s], [pts[i + 1][0], pts[i + 1][1] - 1.5 * s], 's3', 1)
  r.set(pts[0][0], pts[0][1], 's4')
  r.set(pts[pts.length - 1][0], pts[pts.length - 1][1], 's4')
  r.rect(hx - 3 * s, hy - 6 * s, 6 * s, 7 * s, 's1')
}

/** A rock: a lumpy stone body. */
function rock(r: Raster, cx: number, cy: number, w: number, h: number, ramp: Ramp = ['o1', 'o2', 'o3', 'o4']): void {
  r.poly([[cx - w, cy + h], [cx - w * 0.9, cy - h * 0.3], [cx - w * 0.4, cy - h], [cx + w * 0.5, cy - h * 0.9], [cx + w, cy - h * 0.1], [cx + w * 0.9, cy + h]], ramp[0])
  r.poly([[cx - w * 0.8, cy + h * 0.7], [cx - w * 0.75, cy - h * 0.2], [cx - w * 0.35, cy - h * 0.8], [cx + w * 0.45, cy - h * 0.7], [cx + w * 0.75, cy], [cx + w * 0.6, cy + h * 0.6]], ramp[1])
  r.poly([[cx - w * 0.6, cy - h * 0.1], [cx - w * 0.3, cy - h * 0.65], [cx + w * 0.2, cy - h * 0.6], [cx - w * 0.1, cy - h * 0.1]], ramp[2])
  if (ramp[3]) r.set(cx - w * 0.3, cy - h * 0.55, ramp[3])
}

/** A fish swimming right: an oval body, a tail, an eye. */
function fish(r: Raster, cx: number, cy: number, len: number, ramp: Ramp, dir: 1 | -1 = 1, slim = 0.32): void {
  const h = len * slim
  r.ellipse(cx, cy, len * 0.5, h, ramp[0])
  r.ellipse(cx, cy - h * 0.2, len * 0.45, h * 0.7, ramp[1])
  r.ellipse(cx + dir * len * 0.05, cy - h * 0.45, len * 0.28, h * 0.3, ramp[2])
  const tx = cx - dir * len * 0.48
  r.poly([[tx, cy], [tx - dir * len * 0.3, cy - h * 1.1], [tx - dir * len * 0.24, cy], [tx - dir * len * 0.3, cy + h * 1.1]], ramp[0])
  r.poly([[cx - dir * len * 0.1, cy - h * 0.8], [cx + dir * len * 0.1, cy - h * 1.5], [cx + dir * len * 0.2, cy - h * 0.8]], ramp[0])
  r.set(cx + dir * len * 0.33, cy - h * 0.25, 'k')
  if (ramp[3]) r.set(cx + dir * len * 0.33 - dir, cy - h * 0.4, ramp[3])
}

/** Water's ripples: flat ellipse rings. */
function ripples(r: Raster, cx: number, cy: number, rings: number[], c: string): void {
  for (const rad of rings) {
    for (let a = 0; a < 360; a += 4) {
      const t = (a * Math.PI) / 180
      r.set(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad * 0.35, c)
    }
  }
}

/** A gold laurel under an emblem: two arcs of leaves meeting at the bottom. */
function laurel(r: Raster, cx: number, cy: number, rad: number): void {
  arc(r, cx, cy, rad, 110, 230, 'g2', 2)
  arc(r, cx, cy, rad, -50, 70, 'g2', 2)
  for (const a of [125, 150, 175, 200, 225, 55, 30, 5, -20, -45]) {
    const t = (a * Math.PI) / 180
    r.ellipse(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad, 2, 1.3, 'g3')
  }
}

const out: Record<string, Raster> = {}
const icon = (id: string, draw: (r: Raster) => void) => {
  const r = new Raster(S, S)
  draw(r)
  out[id] = r
}

// ---------------------------------------------------------------- woodcutting

// Sharp Axe: an axe biting into an upright trunk, its edge gleaming
icon('sharp-axe', (r) => {
  // the trunk on the left, a notch where the axe went in
  r.rect(8, 10, 18, 46, 'w2')
  r.rect(8, 10, 6, 46, 'w1')
  r.rect(18, 10, 4, 46, 'w3')
  for (const y of [16, 30, 44]) r.line(10, y, 13, y + 4, 'w1')
  r.poly([[26, 30], [18, 34], [26, 38]], NONE)
  r.outline('k')
  axe(r, [56, 56], [40, 34], -1, 1)
  r.outline('k')
  // the gleam on the edge, chips flying
  for (const [x, y] of [[50, 12], [56, 20]] as const) sparkle(r, x, y, 3, 'g3', 'g4')
  for (const [x, y] of [[30, 22], [34, 46], [30, 50]] as const) r.rect(x, y, 2, 2, 'w4')
})

// Carpenter: a log split into planks, a small saw across them
icon('carpenter', (r) => {
  for (const [y, c1, c2] of [[18, 'w3', 'w4'], [28, 'w2', 'w3'], [38, 'w3', 'w4']] as const) {
    r.rect(8, y, 40, 8, c1)
    r.rect(8, y, 40, 2, c2)
    r.line(10, y + 5, 46, y + 5, 'w1')
  }
  r.outline('k')
  // the saw: a toothed steel blade and a wooden handle
  r.poly([[20, 54], [52, 34], [56, 40], [24, 58]], 's2')
  thick(r, [21, 55], [53, 35], 's3', 1)
  for (let i = 0; i < 9; i++) r.set(24 + i * 3.6, 58 - i * 2.2, 's1')
  r.rect(52, 28, 8, 12, 'w2')
  r.rect(53, 30, 6, 2, 'w3')
  r.rect(55, 32, 2, 5, NONE)
  r.outline('k')
  for (const [x, y] of [[12, 52], [18, 48]] as const) r.rect(x, y, 2, 1, 'w4')
})

// Forester: an acorn and the sapling sprouting from it
icon('forester', (r) => {
  // the sapling
  thick(r, [32, 36], [32, 14], 'l1', 2)
  r.ellipse(24, 18, 8, 5, 'l2')
  r.ellipse(40, 14, 8, 5, 'l2')
  r.ellipse(24, 17, 5, 3, 'l3')
  r.ellipse(40, 13, 5, 3, 'l3')
  r.set(22, 16, 'l4')
  r.set(38, 12, 'l4')
  r.ellipse(32, 26, 6, 4, 'l2')
  r.ellipse(31, 25, 3, 2, 'l3')
  r.outline('k')
  // the acorn below
  r.ellipse(32, 46, 11, 12, 'w2')
  r.ellipse(30, 47, 8, 9, 'w3')
  r.set(27, 44, 'w4')
  r.rect(20, 34, 24, 6, 'w1')
  r.rect(22, 33, 20, 3, 'w2')
  for (let x = 21; x < 44; x += 3) r.set(x, 36, 'w2')
  r.outline('k')
  // a little earth
  for (const [x, y] of [[12, 56], [52, 56]] as const) sparkle(r, x, y, 2, 'l3', 'l4')
})

// Timber Master: a stack of logs, a gold laurel round it
icon('timber-master', (r) => {
  log(r, 14, 44, 32, 6)
  log(r, 20, 32, 30, 6)
  log(r, 14, 20, 26, 6)
  r.outline('k')
  laurel(r, 32, 34, 28)
  // the crown on top
  r.poly([[24, 8], [28, 2], [32, 7], [36, 2], [40, 8], [40, 11], [24, 11]], 'g2')
  r.line(24, 10, 40, 10, 'g3')
  r.set(28, 3, 'g4')
  r.set(36, 3, 'g4')
  r.outline('k')
})

// ---------------------------------------------------------------- mining

// Prospector: a pickaxe over a rock that glints with ore
icon('prospector', (r) => {
  rock(r, 32, 46, 24, 12)
  for (const [x, y] of [[20, 46], [34, 42], [42, 50]] as const) {
    r.rect(x, y, 4, 3, 'u2')
    r.set(x, y, 'g3')
  }
  r.rect(26, 52, 3, 2, 'u1')
  r.outline('k')
  pickaxe(r, [50, 34], [24, 14], 1)
  r.outline('k')
  for (const [x, y] of [[10, 36], [54, 14], [48, 40]] as const) sparkle(r, x, y, 2, 'g3', 'g4')
})

// Heavy Pick: a great pickaxe striking, impact lines round the point
icon('heavy-pick', (r) => {
  pickaxe(r, [54, 56], [28, 22], 1.35)
  r.outline('k')
  // the impact where the point lands
  for (const [a, b] of [[[6, 46], [12, 42]], [[4, 36], [11, 37]], [[10, 54], [15, 48]]] as [P, P][]) thick(r, a, b, 'g3', 2)
  r.rect(8, 56, 10, 3, 'o2')
  r.rect(9, 56, 8, 1, 'o3')
  r.outline('k')
  sparkle(r, 18, 48, 3, 'g3', 'g4')
})

// Stonecutter: a stone split in two, chips flying out of the crack
icon('stonecutter', (r) => {
  rock(r, 22, 38, 14, 16)
  rock(r, 44, 40, 13, 15)
  // the crack between
  r.line(31, 22, 33, 56, NONE)
  r.line(32, 22, 34, 56, NONE)
  r.outline('k')
  for (const [x, y, s] of [[32, 14, 3], [24, 10, 2], [42, 12, 2], [14, 16, 2], [52, 20, 2]] as const) {
    r.rect(x, y, s, s, 'o3')
    r.set(x, y, 'o4')
  }
  r.outline('k')
  sparkle(r, 32, 6, 3, 'g3', 'g4')
})

// Gem Finder: a rock cracked open, a sparkling gem inside it
icon('gem-finder', (r) => {
  rock(r, 32, 40, 24, 16)
  // the hollow it shows, and the gem in it
  r.ellipse(32, 38, 11, 9, 'o1')
  r.poly([[24, 38], [28, 31], [36, 31], [40, 38], [32, 47]], 'v1')
  r.poly([[26, 38], [29, 33], [35, 33], [38, 38], [32, 45]], 'v2')
  r.poly([[28, 37], [30, 34], [33, 34], [32, 40]], 'v3')
  r.line(26, 38, 38, 38, 'v1')
  r.outline('k')
  for (const [x, y, s] of [[44, 18, 3], [18, 20, 2], [52, 30, 2]] as const) sparkle(r, x, y, s, 'v3', 'g4')
})

// Deep Vein: dark rock with veins of gold and iron running through it, gold accents
icon('deep-vein', (r) => {
  rock(r, 32, 36, 26, 22, ['o1', 'o1', 'o2', 'o3'])
  // the veins
  const vein = (pts: P[], c1: string, c2: string) => {
    for (let i = 0; i < pts.length - 1; i++) thick(r, pts[i], pts[i + 1], c1, 3)
    for (let i = 0; i < pts.length - 1; i++) thick(r, pts[i], pts[i + 1], c2, 1)
  }
  vein([[12, 44], [22, 36], [30, 40], [40, 30], [52, 32]], 'g1', 'g3')
  vein([[16, 26], [26, 24], [34, 18], [46, 20]], 'u1', 'u2')
  vein([[22, 54], [32, 50], [44, 52]], 'g1', 'g2')
  r.outline('k')
  for (const [x, y, s] of [[40, 30, 3], [22, 36, 2], [54, 12, 2], [8, 14, 2]] as const) sparkle(r, x, y, s, 'g3', 'g4')
})

// ---------------------------------------------------------------- foraging

// Forager: a woven basket, mushrooms and reeds in it
icon('forager', (r) => {
  // reeds standing up behind
  for (const [x, top] of [[20, 10], [26, 6], [44, 8]] as const) {
    thick(r, [x, 34], [x, top + 8], 'l2', 1)
    r.ellipse(x, top + 5, 2, 5, 'w2')
    r.set(x, top + 3, 'w3')
  }
  // mushrooms on the brim
  for (const [x, y] of [[32, 24], [40, 26]] as const) {
    r.rect(x - 1, y, 3, 8, 'c2')
    r.ellipse(x, y, 6, 4, 'r2')
    r.ellipse(x - 1, y - 1, 4, 2, 'r3')
    r.set(x - 3, y - 1, 'c2')
    r.set(x + 2, y - 2, 'c2')
  }
  r.outline('k')
  // the basket
  r.poly([[10, 32], [54, 32], [48, 56], [16, 56]], 'w2')
  for (let y = 35; y < 55; y += 4) r.line(12 + (y - 32) * 0.2, y, 52 - (y - 32) * 0.2, y, 'w3')
  for (let x = 16; x < 50; x += 6) r.line(x, 33, x + 1, 55, 'w1')
  r.rect(8, 30, 48, 4, 'w3')
  r.line(8, 30, 55, 30, 'w4')
  r.outline('k')
})

// Herbalist: a green herb sprig over a stone mortar and pestle
icon('herbalist', (r) => {
  // the sprig
  thick(r, [22, 40], [30, 8], 'l1', 2)
  for (const [x, y, flip] of [[24, 30, -1], [27, 22, 1], [26, 16, -1], [30, 10, 1]] as const) {
    r.ellipse(x + flip * 5, y, 5, 3, 'l2')
    r.ellipse(x + flip * 5, y - 1, 3, 1.5, 'l3')
  }
  r.set(31, 8, 'l4')
  r.outline('k')
  // the mortar
  r.poly([[24, 40], [60, 40], [54, 56], [30, 56]], 'o2')
  r.rect(22, 38, 40, 4, 'o3')
  r.line(22, 38, 61, 38, 'o4')
  r.rect(30, 46, 24, 2, 'o1')
  // the pestle
  thick(r, [50, 40], [58, 20], 'w2', 3)
  r.ellipse(58, 20, 3, 3, 'w3')
  // green pulp in the bowl
  r.rect(30, 39, 20, 2, 'l3')
  r.outline('k')
  sparkle(r, 12, 14, 2, 'l3', 'l4')
})

// ---------------------------------------------------------------- fishing

// Angler: a rod bent over the water, a red float bobbing among ripples
icon('angler', (r) => {
  // the rod
  thick(r, [8, 56], [38, 10], 'w2', 2)
  r.line(9, 56, 38, 11, 'w3')
  r.rect(8, 50, 4, 6, 'w1')
  // the line down to the float
  arc(r, 46, 14, 10, 200, 290, 's3', 1)
  r.line(48, 22, 48, 40, 's3')
  r.outline('k', ['s3'])
  ripples(r, 48, 50, [8, 13], 'a3')
  ripples(r, 48, 50, [4], 'a4')
  // the float
  r.ellipse(48, 44, 4, 5, 'r2')
  r.rect(45, 45, 7, 4, 'c2')
  r.set(47, 41, 'r3')
  r.line(48, 37, 48, 39, 'k')
  r.outline('k', ['a3', 'a4', 's3'])
})

// Bait Saver: a hook with a shrimp on it, a small green "+" — the bait is kept
icon('bait-saver', (r) => {
  r.line(30, 4, 30, 30, 's3')
  // the hook
  thick(r, [30, 30], [30, 44], 's2', 2)
  arc(r, 24, 44, 6, 0, 180, 's2', 2)
  thick(r, [18, 44], [18, 38], 's2', 2)
  r.poly([[17, 38], [15, 41], [19, 41]], 's3')
  // the shrimp curled on it
  arc(r, 26, 42, 8, 200, 360, 'n1', 4)
  arc(r, 26, 42, 8, 220, 340, 'n2', 1)
  r.ellipse(34, 40, 3, 2.5, 'n2')
  r.set(35, 39, 'k')
  r.line(36, 38, 40, 34, 'n1')
  r.outline('k', ['s3'])
  // the plus: kept
  r.rect(44, 18, 14, 4, 'l2')
  r.rect(49, 13, 4, 14, 'l2')
  r.rect(45, 19, 12, 1, 'l4')
  r.rect(50, 14, 1, 12, 'l4')
  r.outline('k', ['s3'])
  sparkle(r, 50, 44, 2, 'g3', 'g4')
})

// Lucky Catch: a golden carp leaping, sparkles round it
icon('lucky-catch', (r) => {
  fish(r, 32, 30, 40, ['g1', 'g2', 'g3', 'g4'])
  // the scales
  for (const [x, y] of [[26, 30], [32, 32], [38, 30], [30, 26]] as const) arc(r, x, y, 2, 30, 150, 'g1', 1)
  r.outline('k')
  ripples(r, 32, 54, [10, 16], 'a3')
  for (const [x, y, s] of [[10, 12, 3], [54, 12, 2], [52, 44, 3], [12, 42, 2]] as const) sparkle(r, x, y, s, 'g3', 'g4')
})

// Deep Fisher: a long pike in dark deep water, the light far above
icon('deep-fisher', (r) => {
  // the deep: a dark round pool
  r.ellipse(32, 34, 28, 24, 'd1')
  r.ellipse(32, 30, 24, 18, 'd2')
  r.ellipse(32, 18, 18, 6, 'a1')
  r.outline('k')
  // the pike: long, lean, spotted
  fish(r, 34, 36, 36, ['l1', 'l2', 'l3', 'l4'], 1, 0.17)
  for (const [x, y] of [[26, 37], [32, 35], [38, 37], [44, 36]] as const) r.set(x, y, 'c2')
  r.outline('k')
  for (const [x, y] of [[20, 14], [30, 10], [44, 12]] as const) r.rect(x, y, 2, 2, 'a4')
})

// Master Angler: two fish crossed over a rod, gold accents
icon('master-angler', (r) => {
  thick(r, [6, 58], [58, 6], 'w2', 3)
  r.line(7, 58, 58, 7, 'w3')
  r.rect(6, 52, 5, 6, 'g2')
  r.outline('k')
  // two fish crossing, one each way
  fish(r, 24, 22, 30, ['a1', 'a2', 'a3', 'a4'], 1)
  fish(r, 40, 42, 30, ['g1', 'g2', 'g3', 'g4'], -1)
  r.outline('k')
  laurel(r, 32, 32, 29)
  for (const [x, y] of [[52, 18], [12, 46]] as const) sparkle(r, x, y, 3, 'g3', 'g4')
})

for (const [id, r] of Object.entries(out)) writeAtlas(`Skills/${id}.png`, [[r]], PAL)
console.log(`${Object.keys(out).length} gathering skill icons → public/assets/lsw/Skills`)
