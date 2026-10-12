// The husbandry branch's skill icons (the life tree grown to twenty nodes a branch: herding, dairy, the coop,
// breeding, the butcher's and the tanner's trades, bees, the ranch), 64x64, drawn by code in the look of the active
// skills' icons (skill-actives.ts): one bold emblem, a dark outline, three or four tones a colour, a few bright
// accents, in a warm ranch palette.
//
//   npx tsx packages/tools/src/art/skill-life-husbandry.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [40, 18, 14, 255],
  // wood and leather
  w1: [86, 46, 26, 255], w2: [136, 80, 42, 255], w3: [188, 124, 68, 255], w4: [226, 172, 112, 255],
  // gold and honey
  g1: [146, 92, 28, 255], g2: [212, 150, 50, 255], g3: [250, 208, 98, 255], g4: [255, 242, 172, 255],
  // red (meat, hearts, the comb)
  r1: [116, 28, 30, 255], r2: [188, 50, 44, 255], r3: [234, 98, 72, 255], r4: [252, 168, 150, 255],
  // milk, eggs, white plumage
  c1: [176, 166, 150, 255], c2: [222, 214, 198, 255], c3: [248, 244, 234, 255], c4: [255, 255, 255, 255],
  // cheese
  y1: [196, 140, 30, 255], y2: [240, 190, 60, 255], y3: [255, 224, 120, 255],
  // steel
  s1: [78, 84, 100, 255], s2: [138, 146, 162, 255], s3: [198, 205, 216, 255], s4: [246, 248, 252, 255],
  // green (grass, feed)
  p1: [56, 104, 40, 255], p2: [96, 156, 60, 255], p3: [156, 204, 96, 255],
  // the bees' black
  b1: [28, 28, 38, 255], b2: [58, 58, 74, 255],
  // the bees' wings, the clock's face
  i3: [200, 230, 246, 255], i4: [236, 250, 255, 255],
  // the cow's brown and pink
  n1: [110, 64, 40, 255], n2: [160, 102, 64, 255], n3: [210, 156, 112, 255], n4: [244, 176, 172, 255],
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

function heart(r: Raster, cx: number, cy: number, s: number): void {
  r.ellipse(cx - s * 0.5, cy - s * 0.2, s * 0.55, s * 0.5, 'r2')
  r.ellipse(cx + s * 0.5, cy - s * 0.2, s * 0.55, s * 0.5, 'r2')
  r.poly([[cx - s * 1.05, cy - s * 0.05], [cx + s * 1.05, cy - s * 0.05], [cx, cy + s * 1.05]], 'r2')
  r.set(cx - s * 0.6, cy - s * 0.4, 'r4')
}

function egg(r: Raster, cx: number, cy: number, s: number, ramp: Ramp = ['c1', 'c2', 'c3', 'c4']): void {
  r.ellipse(cx, cy, s * 0.8, s, ramp[0])
  r.ellipse(cx - s * 0.1, cy - s * 0.05, s * 0.66, s * 0.86, ramp[1])
  r.ellipse(cx - s * 0.25, cy - s * 0.3, s * 0.3, s * 0.4, ramp[2])
  if (ramp[3]) r.set(cx - s * 0.3, cy - s * 0.5, ramp[3])
}

/** A gold star (the dairy master's mark). */
function star(r: Raster, cx: number, cy: number, s: number): void {
  const pts: P[] = []
  for (let i = 0; i < 10; i++) {
    const a = (-90 + i * 36) * (Math.PI / 180)
    const rad = i % 2 ? s * 0.45 : s
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad])
  }
  r.poly(pts, 'g2')
  r.poly(pts.slice(0, 5).map(([x, y]) => [cx + (x - cx) * 0.55, cy + (y - cy) * 0.55] as P), 'g3')
  r.set(cx - 1, cy - 2, 'g4')
}

/** A hen in profile facing right: white body, red comb and wattle, gold beak. */
function hen(r: Raster, cx: number, cy: number, s: number): void {
  r.ellipse(cx, cy, s, s * 0.8, 'c2')
  r.ellipse(cx - s * 0.15, cy - s * 0.1, s * 0.75, s * 0.6, 'c3')
  // tail
  r.poly([[cx - s * 0.8, cy - s * 0.2], [cx - s * 1.35, cy - s * 0.9], [cx - s * 1.1, cy + s * 0.1]], 'c2')
  // head
  r.ellipse(cx + s * 0.75, cy - s * 0.7, s * 0.42, s * 0.42, 'c3')
  r.poly([[cx + s * 0.55, cy - s * 1.1], [cx + s * 0.7, cy - s * 1.35], [cx + s * 0.85, cy - s * 1.12], [cx + s * 1.0, cy - s * 1.3], [cx + s * 1.05, cy - s * 1.0]], 'r2')
  r.poly([[cx + s * 1.1, cy - s * 0.78], [cx + s * 1.45, cy - s * 0.65], [cx + s * 1.1, cy - s * 0.52]], 'g2')
  r.ellipse(cx + s * 1.0, cy - s * 0.38, s * 0.12, s * 0.18, 'r2')
  r.set(cx + s * 0.85, cy - s * 0.78, 'k')
  // wing
  r.ellipse(cx - s * 0.1, cy + s * 0.05, s * 0.5, s * 0.32, 'c1')
  // legs
  thick(r, [cx - s * 0.2, cy + s * 0.75], [cx - s * 0.2, cy + s * 1.1], 'g2', 1)
  thick(r, [cx + s * 0.2, cy + s * 0.75], [cx + s * 0.2, cy + s * 1.1], 'g2', 1)
}

/** A bee: striped body, pale wings. */
function bee(r: Raster, cx: number, cy: number): void {
  r.ellipse(cx - 1, cy - 3, 2.4, 1.8, 'i3')
  r.ellipse(cx + 2, cy - 3, 2.4, 1.8, 'i4')
  r.ellipse(cx, cy, 3.2, 2.4, 'g3')
  r.line(cx - 1, cy - 2, cx - 1, cy + 2, 'b1')
  r.line(cx + 1, cy - 2, cx + 1, cy + 2, 'b1')
  r.set(cx + 3, cy, 'b1')
}

/** A milk bucket: wooden staves, iron hoops, milk at the brim. */
function bucket(r: Raster, x: number, y: number, w: number, h: number): void {
  r.poly([[x, y], [x + w, y], [x + w - 4, y + h], [x + 4, y + h]], 'w2')
  for (let i = 1; i < 4; i++) r.line(x + (w * i) / 4, y + 1, x + 2 + ((w - 4) * i) / 4, y + h - 1, 'w1')
  thick(r, [x + 1, y + 4], [x + w - 1, y + 4], 's2', 2)
  thick(r, [x + 3, y + h - 4], [x + w - 3, y + h - 4], 's2', 2)
  r.ellipse(x + w / 2, y, w / 2, 3, 'c3')
  r.ellipse(x + w / 2 - 2, y - 1, w / 3, 1.5, 'c4')
  arc(r, x + w / 2, y + 2, w / 2 + 2, 200, 340, 's1', 1)
}

const out: Record<string, Raster> = {}
const icon = (id: string, draw: (r: Raster) => void) => {
  const r = new Raster(S, S)
  draw(r)
  out[id] = r
}

// Herdsman: a shepherd's crook, a bell hanging from its hook
icon('herdsman', (r) => {
  thick(r, [22, 56], [36, 18], 'w2', 4)
  thick(r, [23, 55], [36, 19], 'w3', 1)
  arc(r, 42, 18, 7, 180, 360, 'w2', 4)
  arc(r, 42, 18, 7, 190, 350, 'w3', 1)
  thick(r, [49, 18], [49, 24], 'w2', 4)
  // the bell on a cord from the hook
  r.line(49, 26, 49, 30, 'w1')
  r.poly([[44, 42], [46, 32], [52, 32], [54, 42]], 'g2')
  r.poly([[46, 41], [47, 33], [49, 33], [49, 41]], 'g3')
  r.ellipse(49, 43, 2, 2, 'g1')
  r.outline('k')
  sparkle(r, 12, 14, 2, 'g3', 'g4')
  for (const [x, y] of [[58, 36], [40, 46]] as const) r.line(x, y, x + 3, y - 2, 'g3')
})

// Milker: a bucket of milk, a splash rising from it
icon('milker', (r) => {
  bucket(r, 16, 30, 32, 24)
  for (const [x, y, s] of [[26, 18, 3], [34, 12, 2.6], [40, 20, 2.2], [30, 8, 1.8]] as const) {
    r.ellipse(x, y, s, s, 'c3')
    r.set(x - 1, y - 1, 'c4')
  }
  r.poly([[24, 28], [28, 20], [32, 26], [36, 18], [40, 28]], 'c3')
  r.outline('k')
})

// Cheesemaker: a wedge of cheese with holes
icon('cheesemaker', (r) => {
  r.poly([[8, 44], [52, 24], [56, 46], [10, 54]], 'y1')
  r.poly([[8, 44], [52, 24], [56, 28], [14, 46]], 'y3')
  r.poly([[14, 46], [56, 28], [56, 46], [10, 54]], 'y2')
  for (const [x, y, s] of [[24, 46, 2.5], [38, 42, 3], [48, 36, 2], [30, 51, 1.6]] as const) r.ellipse(x, y, s, s * 0.8, 'y1')
  for (const [x, y] of [[30, 38], [42, 32]] as const) r.ellipse(x, y, 2, 1, 'y2')
  r.outline('k')
  sparkle(r, 54, 12, 2, 'g4', 'c4')
})

// Dairy Master: a cheese wheel and a milk bottle, a gold star
icon('dairy-master', (r) => {
  r.ellipse(24, 44, 16, 10, 'y1')
  r.rect(8, 36, 33, 8, 'y1')
  r.ellipse(24, 36, 16, 10, 'y3')
  r.poly([[24, 36], [40, 34], [38, 40]], 'y2')
  for (const [x, y] of [[14, 42], [20, 47], [30, 46]] as const) r.ellipse(x, y, 1.6, 1.2, 'y2')
  // the bottle
  r.rect(42, 22, 12, 30, 'c3')
  r.rect(45, 14, 6, 9, 'c2')
  r.rect(44, 12, 8, 3, 'r2')
  r.line(44, 26, 44, 48, 'c4')
  r.rect(42, 34, 12, 6, 'i3')
  r.outline('k')
  star(r, 16, 14, 8)
  r.outline('k')
})

// Egg Collector: a wicker basket heaped with eggs
icon('egg-collector', (r) => {
  egg(r, 24, 30, 7)
  egg(r, 38, 28, 7)
  egg(r, 31, 24, 7)
  egg(r, 18, 34, 6, ['n2', 'n3', 'w4'])
  egg(r, 44, 34, 6, ['n2', 'n3', 'w4'])
  r.poly([[8, 36], [56, 36], [50, 56], [14, 56]], 'w2')
  for (let y = 40; y < 56; y += 4) r.line(10, y, 54, y, 'w1')
  for (let x = 14; x < 52; x += 5) r.line(x, 37, x + 1, 55, 'w3')
  arc(r, 32, 36, 24, 200, 340, 'w2', 2)
  r.outline('k')
})

// Coop Keeper: a little coop, a hen by its door
icon('coop-keeper', (r) => {
  r.poly([[6, 26], [28, 8], [50, 26]], 'r1')
  r.poly([[10, 25], [28, 11], [46, 25]], 'r2')
  r.rect(10, 26, 36, 26, 'w2')
  for (let x = 14; x < 46; x += 6) r.line(x, 27, x, 51, 'w1')
  r.rect(22, 36, 12, 16, 'w1')
  r.ellipse(28, 36, 6, 4, 'w1')
  r.outline('k')
  hen(r, 48, 46, 7)
  r.outline('k')
})

// Hen Whisperer: a hen, a heart over her
icon('hen-whisperer', (r) => {
  hen(r, 28, 40, 13)
  r.outline('k')
  heart(r, 48, 14, 6)
  r.outline('k')
  sparkle(r, 12, 14, 2, 'r4', 'c4')
})

// Breeder: a calf and a chick, two little hearts over them
icon('breeder', (r) => {
  // the calf's head
  r.ellipse(22, 40, 12, 11, 'n2')
  r.ellipse(19, 36, 7, 5, 'n3')
  r.ellipse(10, 32, 4, 3, 'n1')
  r.ellipse(34, 32, 4, 3, 'n1')
  r.ellipse(22, 47, 8, 5, 'n4')
  r.set(19, 46, 'k')
  r.set(25, 46, 'k')
  r.set(17, 38, 'k')
  r.set(27, 38, 'k')
  // the chick
  r.ellipse(46, 46, 8, 7, 'y2')
  r.ellipse(48, 37, 6, 6, 'y3')
  r.poly([[53, 37], [57, 38], [53, 39]], 'g1')
  r.set(49, 36, 'k')
  r.outline('k')
  heart(r, 22, 14, 5)
  heart(r, 44, 18, 4)
  r.outline('k')
})

// Quick Breeder: a chick breaking out of its egg, a little clock
icon('quick-breeder', (r) => {
  egg(r, 28, 42, 15)
  // the crack, and the shell's broken top
  r.poly([[14, 34], [18, 30], [22, 35], [27, 29], [32, 35], [37, 29], [42, 34], [42, 26], [14, 26]], NONE)
  r.ellipse(28, 26, 10, 9, 'y2')
  r.ellipse(26, 23, 7, 6, 'y3')
  r.poly([[36, 25], [41, 26], [36, 28]], 'g1')
  r.set(31, 23, 'k')
  r.poly([[14, 34], [18, 30], [22, 35], [27, 29], [32, 35], [37, 29], [42, 34], [42, 37], [14, 37]], 'c2')
  r.outline('k')
  // the clock
  r.ellipse(50, 14, 9, 9, 'g2')
  r.ellipse(50, 14, 7, 7, 'i4')
  r.line(50, 14, 50, 9, 'k')
  r.line(50, 14, 54, 14, 'k')
  r.outline('k')
})

// Stockman: a wooden feed trough heaped with grain
icon('stockman', (r) => {
  r.poly([[6, 30], [58, 30], [52, 46], [12, 46]], 'w2')
  r.poly([[8, 32], [56, 32], [54, 36], [10, 36]], 'w3')
  r.rect(12, 46, 4, 10, 'w1')
  r.rect(48, 46, 4, 10, 'w1')
  // grain heaped above the rim
  r.ellipse(32, 30, 22, 7, 'y2')
  for (let i = 0; i < 18; i++) r.set(14 + ((i * 7) % 36), 26 + ((i * 3) % 6), i % 2 ? 'y3' : 'y1')
  // a few stalks
  for (const [x, h] of [[20, 14], [30, 18], [42, 15]] as const) {
    r.line(x, 28, x + 2, 28 - h, 'p2')
    r.ellipse(x + 2, 28 - h - 2, 1.6, 3, 'y2')
  }
  r.outline('k')
})

// Feed Maker: a sack of feed, wheat ears in its mouth
icon('feed-maker', (r) => {
  r.poly([[16, 26], [46, 26], [52, 56], [10, 56]], 'w3')
  r.poly([[18, 28], [30, 28], [26, 54], [14, 54]], 'w4')
  r.poly([[18, 26], [44, 26], [40, 20], [22, 20]], 'w3')
  thick(r, [18, 26], [44, 26], 'w1', 2)
  // the label
  r.rect(24, 38, 14, 10, 'c3')
  r.line(26, 42, 36, 42, 'y1')
  r.line(26, 45, 33, 45, 'y1')
  for (const [x, h, lean] of [[24, 16, -2], [31, 20, 0], [38, 16, 2]] as const) {
    r.line(x, 22, x + lean, 22 - h, 'p2')
    r.ellipse(x + lean, 22 - h - 2, 2, 4, 'y2')
    r.set(x + lean - 1, 22 - h - 3, 'y3')
  }
  r.outline('k')
})

// Butcher: a cleaver over a cut of meat
icon('butcher', (r) => {
  r.ellipse(30, 44, 20, 12, 'r1')
  r.ellipse(28, 42, 17, 9, 'r2')
  r.ellipse(24, 40, 9, 4, 'r3')
  r.ellipse(42, 44, 4, 3, 'c3')
  r.ellipse(42, 44, 2, 1.5, 'c2')
  // a ribbon of fat
  arc(r, 30, 46, 14, 20, 160, 'r4', 1)
  // the cleaver
  r.poly([[30, 8], [54, 12], [52, 30], [28, 26]], 's2')
  r.poly([[30, 8], [54, 12], [54, 15], [30, 11]], 's4')
  r.line(28, 26, 52, 30, 's1')
  r.ellipse(48, 15, 1.5, 1.5, 'k')
  thick(r, [28, 18], [12, 15], 'w2', 4)
  r.line(13, 14, 27, 16, 'w3')
  r.outline('k')
})

// Tanner: a hide stretched on a wooden frame
icon('tanner', (r) => {
  r.rect(6, 8, 52, 4, 'w2')
  r.rect(6, 52, 52, 4, 'w2')
  r.rect(6, 8, 4, 48, 'w2')
  r.rect(54, 8, 4, 48, 'w2')
  r.poly([[16, 16], [24, 14], [32, 18], [40, 14], [48, 16], [46, 26], [50, 34], [46, 42], [48, 48], [40, 48], [32, 46], [24, 48], [16, 48], [18, 40], [14, 32], [18, 24]], 'w3')
  r.poly([[22, 22], [32, 22], [40, 22], [42, 32], [40, 42], [24, 42], [20, 32]], 'w4')
  // lacing to the frame
  for (const [a, b] of [[[10, 16], [16, 18]], [[10, 32], [14, 32]], [[10, 46], [16, 46]], [[54, 18], [48, 18]], [[54, 32], [50, 33]], [[54, 46], [48, 46]], [[24, 12], [24, 15]], [[40, 12], [40, 15]], [[24, 52], [24, 48]], [[40, 52], [40, 48]]] as [P, P][]) r.line(a[0], a[1], b[0], b[1], 'c2')
  r.outline('k')
})

// Plucker: a fan of feathers
icon('plucker', (r) => {
  const feather = (base: P, tip: P, ramp: Ramp) => {
    const len = Math.hypot(tip[0] - base[0], tip[1] - base[1])
    const d: P = [(tip[0] - base[0]) / len, (tip[1] - base[1]) / len]
    const n: P = [-d[1], d[0]]
    const at = (t: number, o: number): P => [base[0] + d[0] * t + n[0] * o, base[1] + d[1] * t + n[1] * o]
    r.poly([at(len * 0.25, 0), at(len * 0.5, 5), at(len, 0), at(len * 0.55, -5)], ramp[1])
    r.poly([at(len * 0.3, 0), at(len * 0.55, 3), at(len * 0.92, 0)], ramp[2])
    thick(r, base, tip, ramp[0], 1)
  }
  feather([20, 56], [14, 12], ['c1', 'c3', 'c4'])
  feather([28, 56], [36, 8], ['n1', 'w3', 'w4'])
  feather([34, 56], [56, 20], ['c1', 'c2', 'c4'])
  r.outline('k')
  for (const [x, y] of [[50, 50], [10, 40]] as const) sparkle(r, x, y, 2, 'c3', 'c4')
})

// Leatherworker: a leather boot with white stitching, a needle
icon('leatherworker', (r) => {
  r.poly([[16, 10], [34, 10], [34, 38], [54, 44], [56, 54], [14, 54]], 'w2')
  r.poly([[18, 12], [26, 12], [26, 50], [16, 50]], 'w3')
  r.rect(14, 50, 42, 5, 'w1')
  r.rect(15, 10, 20, 4, 'w1')
  // the stitching
  for (let y = 18; y < 46; y += 4) r.line(30, y, 30, y + 2, 'c3')
  for (let x = 36; x < 52; x += 4) r.line(x, 46, x + 2, 46, 'c3')
  // a needle and thread
  thick(r, [44, 8], [58, 30], 's3', 1)
  r.set(44, 8, 's4')
  arc(r, 50, 22, 6, 90, 230, 'c3', 1)
  r.outline('k')
})

// Beekeeper: a straw skep hive, bees about it
icon('beekeeper', (r) => {
  r.ellipse(30, 30, 18, 18, 'g1')
  r.rect(12, 30, 37, 20, 'g1')
  for (let i = 0; i < 5; i++) {
    const y = 18 + i * 7
    const half = i === 0 ? 10 : 17
    thick(r, [30 - half, y], [30 + half, y], i % 2 ? 'g3' : 'g2', 4)
  }
  r.rect(10, 50, 41, 4, 'w2')
  r.ellipse(30, 44, 5, 4, 'w1')
  r.outline('k')
  bee(r, 52, 16)
  bee(r, 50, 34)
  bee(r, 10, 14)
  r.outline('k', ['i3', 'i4'])
})

// Apiarist: a wooden hive frame, honeycomb in it
icon('apiarist', (r) => {
  r.rect(10, 12, 44, 42, 'w2')
  r.rect(14, 16, 36, 34, 'g2')
  r.rect(8, 10, 48, 4, 'w1')
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) {
      const cx = 18 + x * 7 + (y % 2 ? 3.5 : 0)
      const cy = 20 + y * 6.5
      if (cx > 48) continue
      r.ellipse(cx, cy, 2.8, 2.6, (x + y) % 3 ? 'g3' : 'g1')
      r.set(cx - 1, cy - 1, 'g4')
    }
  r.outline('k')
  bee(r, 56, 52)
  r.outline('k', ['i3', 'i4'])
})

// Royal Jelly: a honey pot, a crowned queen bee over it
icon('royal-jelly', (r) => {
  r.ellipse(30, 44, 18, 13, 'w2')
  r.ellipse(28, 41, 14, 9, 'w3')
  r.rect(18, 26, 24, 8, 'w2')
  r.ellipse(30, 26, 12, 3, 'g2')
  // honey dripping over the lip
  r.poly([[18, 28], [42, 28], [40, 36], [37, 30], [33, 38], [28, 31], [23, 36], [20, 30]], 'g3')
  r.rect(22, 44, 16, 6, 'g4')
  r.outline('k')
  // the queen, crowned
  r.ellipse(46, 18, 4, 3, 'i4')
  r.ellipse(52, 18, 4, 3, 'i3')
  r.ellipse(49, 22, 5, 3.5, 'g3')
  r.line(47, 19, 47, 25, 'b1')
  r.line(50, 19, 50, 25, 'b1')
  r.poly([[44, 14], [46, 8], [48, 12], [50, 6], [52, 12], [54, 8], [56, 14]], 'g2')
  r.set(50, 9, 'g4')
  r.outline('k')
})

// Rancher: a wide-brimmed hat, a Dawnmark coin before it
icon('rancher', (r) => {
  r.ellipse(30, 36, 26, 7, 'w2')
  r.ellipse(30, 34, 24, 5, 'w3')
  r.poly([[16, 34], [20, 14], [30, 18], [40, 14], [44, 34]], 'w2')
  r.poly([[20, 32], [22, 17], [30, 20], [30, 32]], 'w3')
  r.rect(17, 28, 27, 4, 'r2')
  r.outline('k')
  r.ellipse(46, 48, 10, 10, 'g1')
  r.ellipse(45, 47, 8, 8, 'g2')
  r.ellipse(43, 45, 4, 4, 'g3')
  r.line(46, 42, 46, 54, 'g1')
  r.line(42, 48, 50, 48, 'g1')
  r.outline('k')
})

// Master Rancher: a cow's head under a gold crown, a laurel round it
icon('master-rancher', (r) => {
  // laurel
  for (const side of [-1, 1]) {
    arc(r, 32, 36, 24, side < 0 ? 100 : -10, side < 0 ? 190 : 80, 'p1', 2)
    for (let i = 0; i < 5; i++) {
      const a = ((side < 0 ? 105 + i * 18 : 3 + i * 18) * Math.PI) / 180
      r.ellipse(32 + Math.cos(a) * 24, 36 + Math.sin(a) * 24, 2.4, 1.6, 'p2')
    }
  }
  // the cow
  r.ellipse(32, 36, 13, 14, 'c3')
  r.ellipse(26, 30, 6, 6, 'n1')
  r.ellipse(18, 26, 5, 3, 'c2')
  r.ellipse(46, 26, 5, 3, 'c2')
  r.poly([[18, 22], [12, 16], [20, 20]], 'c2')
  r.poly([[46, 22], [52, 16], [44, 20]], 'c2')
  r.ellipse(32, 45, 9, 6, 'n4')
  r.set(29, 45, 'k')
  r.set(35, 45, 'k')
  r.set(27, 34, 'k')
  r.set(37, 34, 'k')
  r.outline('k')
  // the crown
  r.poly([[22, 20], [24, 8], [28, 14], [32, 4], [36, 14], [40, 8], [42, 20]], 'g2')
  r.rect(22, 18, 21, 4, 'g1')
  r.set(32, 7, 'g4')
  r.set(24, 11, 'g3')
  r.set(40, 11, 'g3')
  r.outline('k')
  for (const [x, y] of [[8, 54], [56, 54]] as const) sparkle(r, x, y, 2, 'g3', 'g4')
})

for (const [id, r] of Object.entries(out)) writeAtlas(`Skills/${id}.png`, [[r]], PAL)
console.log(`${Object.keys(out).length} husbandry skill icons → public/assets/lsw/Skills`)
