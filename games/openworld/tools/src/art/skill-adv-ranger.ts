// The ranger's advancements (docs/advancement.md): the three paths' skills — the Sharpshooter in gold and white, the
// Trapper in iron and rope, the Beastmaster in fur grey and forest green —, the mastery's (the Master Archer, teal and
// silver), the four new skills of the first tree, and the paths' and mastery's entrances. 64x64, by code, in the look
// of skill-actives.ts: one bold emblem on a clear ground, a dark outline round it, three or four tones a colour, a few
// bright accents.
//
//   npx tsx games/openworld/tools/src/art/skill-adv-ranger.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [40, 18, 14, 255],
  // steel and iron
  s1: [78, 84, 100, 255], s2: [138, 146, 162, 255], s3: [198, 205, 216, 255], s4: [246, 248, 252, 255],
  b1: [28, 28, 38, 255], b2: [58, 58, 74, 255], b3: [100, 100, 122, 255],
  // wood, leather, rope
  w1: [86, 46, 26, 255], w2: [136, 80, 42, 255], w3: [188, 124, 68, 255],
  e1: [78, 52, 38, 255], e2: [120, 84, 54, 255], e3: [166, 120, 80, 255],
  o1: [122, 92, 52, 255], o2: [176, 138, 82, 255], o3: [222, 190, 132, 255],
  // gold and ivory: the Sharpshooter
  g1: [146, 92, 28, 255], g2: [212, 150, 50, 255], g3: [250, 208, 98, 255],
  y2: [250, 218, 60, 255], y3: [255, 250, 182, 255],
  c1: [196, 186, 160, 255], c2: [232, 224, 202, 255], c3: [252, 248, 236, 255],
  // red, fire
  r1: [116, 28, 30, 255], r2: [188, 50, 44, 255], r3: [234, 98, 72, 255],
  f1: [196, 64, 28, 255], f2: [240, 126, 38, 255], f3: [255, 196, 76, 255], f4: [255, 242, 172, 255],
  // greens: the ranger's, the forest's
  p1: [36, 104, 48, 255], p2: [76, 176, 66, 255], p3: [146, 228, 106, 255],
  q1: [30, 66, 40, 255], q2: [52, 104, 60, 255], q3: [92, 148, 88, 255],
  // fur
  m1: [86, 86, 94, 255], m2: [136, 136, 146, 255], m3: [188, 188, 198, 255], m4: [230, 230, 236, 255],
  // the Master Archer's wind
  t1: [36, 116, 116, 255], t2: [78, 178, 168, 255], t3: [160, 232, 214, 255],
  // water
  i1: [46, 96, 158, 255], i2: [98, 168, 220, 255],
  // the hawk's plumage, mud
  h1: [92, 58, 34, 255], h2: [150, 102, 62, 255], h3: [222, 196, 152, 255],
  d1: [70, 50, 32, 255], d2: [104, 76, 48, 255], d3: [140, 108, 72, 255],
}

const S = 64
type P = [number, number]
type Ramp = [string, string, string, string?]

const thick = (r: Raster, a: P, b: P, c: string, w: number) => r.line(a[0], a[1], b[0], b[1], c, w)

function ball(r: Raster, cx: number, cy: number, rad: number, ramp: Ramp): void {
  r.ellipse(cx, cy, rad, rad, ramp[0])
  r.ellipse(cx - rad * 0.12, cy - rad * 0.12, rad * 0.82, rad * 0.82, ramp[1])
  r.ellipse(cx - rad * 0.3, cy - rad * 0.3, rad * 0.5, rad * 0.5, ramp[2])
  if (ramp[3]) r.ellipse(cx - rad * 0.42, cy - rad * 0.42, Math.max(1, rad * 0.18), Math.max(1, rad * 0.18), ramp[3])
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

/** An arrow from its nock to its point: a shaft, a head, fletching in two colours. */
function arrow(r: Raster, nock: P, point: P, head = 4, fletch = ['r2', 'r3'], shaft = ['w3', 'w2'], tip = ['s2', 's4']): void {
  const len = Math.hypot(point[0] - nock[0], point[1] - nock[1])
  const d: P = [(point[0] - nock[0]) / len, (point[1] - nock[1]) / len]
  const n: P = [-d[1], d[0]]
  const base: P = [point[0] - d[0] * head * 1.6, point[1] - d[1] * head * 1.6]
  thick(r, nock, base, shaft[0], 2)
  r.line(nock[0], nock[1], base[0], base[1], shaft[1])
  r.poly([[base[0] + n[0] * head, base[1] + n[1] * head], point, [base[0] - n[0] * head, base[1] - n[1] * head]], tip[0])
  r.line(base[0], base[1], point[0], point[1], tip[1])
  for (const s of [1, -1]) {
    for (let t = 0; t < 6; t++) {
      const x = nock[0] + d[0] * t
      const y = nock[1] + d[1] * t
      r.line(x, y, x + n[0] * s * 3 - d[0] * 2, y + n[1] * s * 3 - d[1] * 2, t % 2 ? fletch[0] : fletch[1])
    }
  }
}

function sparkle(r: Raster, x: number, y: number, s: number, c: string, core = c): void {
  r.line(x - s, y, x + s, y, c)
  r.line(x, y - s, x, y + s, c)
  r.set(x, y, core)
}

function streaks(r: Raster, lines: [number, number, number][], ramp: string[]): void {
  lines.forEach(([x, y, len], i) => {
    r.line(x, y, x + len, y, ramp[i % ramp.length])
    r.line(x + len, y, x + len + 2, y - 1, ramp[i % ramp.length])
  })
}

function star(r: Raster, cx: number, cy: number, rad: number, c: string, core?: string): void {
  const pts: P[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? rad * 0.45 : rad
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
  }
  r.poly(pts, c)
  if (core) r.set(cx, cy, core)
}

/** A paw print: a pad and four toes. */
function paw(r: Raster, cx: number, cy: number, s: number, ramp: [string, string]): void {
  r.ellipse(cx, cy + s * 0.5, s * 1.1, s * 0.85, ramp[0])
  r.ellipse(cx - s * 0.15, cy + s * 0.35, s * 0.6, s * 0.45, ramp[1])
  for (const [dx, dy] of [[-1.3, -0.7], [-0.45, -1.35], [0.45, -1.35], [1.3, -0.7]] as const) {
    r.ellipse(cx + dx * s, cy + dy * s, s * 0.42, s * 0.5, ramp[0])
    r.set(cx + dx * s - 1, cy + dy * s - 1, ramp[1])
  }
}

/** A wolf's head, face on: ears up, a pale muzzle, eyes of `eye`. */
function wolfFront(r: Raster, cx: number, cy: number, s: number, eye: [string, string] = ['p2', 'p3']): void {
  const at = (x: number, y: number): P => [cx + x * s, cy + y * s]
  // ears
  r.poly([at(-9, -6), at(-11, -17), at(-4, -10)], 'm2')
  r.poly([at(9, -6), at(11, -17), at(4, -10)], 'm2')
  r.poly([at(-9, -8), at(-10, -14), at(-6, -10)], 'm1')
  r.poly([at(9, -8), at(10, -14), at(6, -10)], 'm1')
  // the head
  r.poly([at(-12, -6), at(-6, -12), at(6, -12), at(12, -6), at(13, 2), at(7, 9), at(0, 14), at(-7, 9), at(-13, 2)], 'm2')
  r.poly([at(-10, -5), at(-5, -10), at(5, -10), at(9, -5), at(6, 0), at(-6, 0)], 'm3')
  // ruff at the cheeks
  r.poly([at(-13, 2), at(-16, 6), at(-10, 6)], 'm1')
  r.poly([at(13, 2), at(16, 6), at(10, 6)], 'm1')
  // muzzle
  r.poly([at(-5, 1), at(5, 1), at(4, 9), at(0, 13), at(-4, 9)], 'm4')
  r.ellipse(cx, cy + 9 * s, 2.4 * s, 1.6 * s, 'b1')
  r.set(cx - s, cy + 8.4 * s, 'm3')
  // eyes
  for (const sx of [-1, 1]) {
    r.poly([at(sx * 7, -3), at(sx * 3, -3), at(sx * 4, -1), at(sx * 7, -2)], eye[0])
    r.set(cx + sx * 5 * s, cy - 2.5 * s, eye[1])
  }
}

/** A wolf's head in profile facing right, jaws open (`open`), its neck going off to the lower left. */
function wolfSide(r: Raster, x: number, y: number, s: number, open: number, fur: Ramp = ['m1', 'm2', 'm3']): void {
  const at = (u: number, v: number): P => [x + u * s, y + v * s]
  // the neck and back of the head
  r.poly([at(-14, 12), at(-12, -4), at(-4, -10), at(4, -9), at(6, 6), at(-6, 16)], fur[1])
  r.poly([at(-12, 10), at(-10, -2), at(-4, -7), at(0, -6), at(-2, 8)], fur[2])
  // ear
  r.poly([at(-6, -8), at(-3, -18), at(2, -9)], fur[0])
  r.poly([at(-4, -9), at(-3, -15), at(0, -9)], fur[1])
  // upper jaw
  r.poly([at(2, -9), at(16, -5), at(20, -2), at(18, 0), at(4, 0)], fur[1])
  r.line(x + 4 * s, y - 7 * s, x + 18 * s, y - 3 * s, fur[2])
  r.ellipse(x + 19.5 * s, y - 2.6 * s, 1.4 * s, 1.2 * s, 'b1')
  // lower jaw, dropped by `open`
  r.poly([at(4, 2 + open * 0.2), at(15, 2 + open), at(14, 5 + open), at(4, 7)], fur[0])
  // mouth and teeth
  r.poly([at(4, 0), at(18, 0), at(15, 2 + open), at(4, 2 + open * 0.2)], 'r1')
  for (const u of [8, 12, 16]) {
    r.poly([at(u, 0), at(u + 1.5, 0), at(u + 0.7, 2)], 'm4')
    r.poly([at(u - 1, 2 + open * 0.9), at(u + 0.5, 2 + open * 0.9), at(u - 0.3, 0.5 + open * 0.9)], 'm4')
  }
  // the eye
  r.poly([at(4, -6), at(8, -6), at(7, -4)], 'p2')
  r.set(x + 6 * s, y - 5.4 * s, 'p3')
}

const out: Record<string, Raster> = {}
const icon = (id: string, draw: (r: Raster) => void) => {
  const r = new Raster(S, S)
  draw(r)
  out[id] = r
}

const GOLD = ['g2', 'g3']
const IVORY = ['c2', 'c3']

// ================================================================== the Sharpshooter: gold and white

// the path: a gold arrow upright through a white sight ring, four ticks round it
icon('path-sharpshooter', (r) => {
  arc(r, 32, 32, 22, 0, 360, 'c1', 3)
  arc(r, 32, 32, 22, 200, 330, 'c3', 1)
  for (const [a, b] of [[[32, 4], [32, 12]], [[32, 52], [32, 60]], [[4, 32], [12, 32]], [[52, 32], [60, 32]]] as [P, P][]) thick(r, a, b, 'g2', 3)
  r.outline('k')
  arrow(r, [32, 58], [32, 6], 5, IVORY, ['g2', 'g1'], ['g2', 'y3'])
  r.outline('k')
  sparkle(r, 32, 6, 3, 'y3', 'c3')
  for (const [x, y] of [[50, 12], [12, 50]] as const) sparkle(r, x, y, 2, 'g3', 'c3')
})

// Eagle Eye: an almond eye, white with a gold iris, a feather for its lash
icon('eagle-eye', (r) => {
  r.poly([[6, 32], [18, 20], [32, 16], [46, 20], [58, 32], [46, 44], [32, 48], [18, 44]], 'c1')
  r.poly([[10, 32], [20, 22], [32, 19], [44, 22], [54, 32], [44, 41], [32, 44], [20, 41]], 'c3')
  ball(r, 32, 32, 11, ['g1', 'g2', 'g3'])
  r.ellipse(32, 32, 5, 5, 'b1')
  r.ellipse(29, 29, 2, 2, 'c3')
  r.outline('k')
  // the lash: a gold feather sweeping off the top
  r.poly([[30, 16], [44, 4], [58, 2], [48, 10], [36, 18]], 'g2')
  r.poly([[34, 16], [46, 6], [56, 3], [44, 12]], 'g3')
  r.line(32, 17, 56, 3, 'g1')
  r.outline('k')
  for (const [x, y] of [[8, 50], [56, 50]] as const) sparkle(r, x, y, 2, 'y3', 'c3')
})

// Deadeye: a white bow drawn to the full, a glowing gold arrow on the string
icon('deadeye', (r) => {
  // the bow, bent hard to the right
  arc(r, 14, 32, 28, -62, 62, 'c1', 4)
  arc(r, 14, 32, 28, -55, 0, 'c3', 1)
  r.rect(37, 29, 4, 6, 'g1')
  // the string, pulled back into a deep V
  r.line(27, 7, 6, 32, 'c3')
  r.line(27, 57, 6, 32, 'c3')
  r.outline('k', ['c3'])
  arrow(r, [6, 32], [60, 32], 5, GOLD, ['g2', 'g1'], ['y2', 'y3'])
  r.outline('k')
  // the glint running down the shaft
  for (let x = 14; x < 50; x += 6) r.set(x, 31, 'y3')
  sparkle(r, 58, 22, 3, 'y3', 'c3')
  sparkle(r, 58, 42, 2, 'g3')
})

// Ricochet: an arrow's zigzag path, three bright knocks where it turned, the arrow at its end
icon('ricochet', (r) => {
  const pts: P[] = [[6, 54], [20, 20], [34, 46], [48, 14]]
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]]
    for (let t = 0; t < 1; t += 0.12) r.ellipse(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 1.5, 1.5, i % 2 ? 'g2' : 'c2')
  }
  for (const p of pts.slice(1, 3)) {
    star(r, p[0], p[1], 6, 'g3', 'c3')
  }
  r.outline('k', ['g2', 'c2'])
  arrow(r, [40, 30], [58, 4], 4.5, IVORY, ['g2', 'g1'], ['s2', 's4'])
  r.outline('k')
  sparkle(r, 8, 54, 2, 'c3')
})

// Weak Point: a white breastplate cracked, a gold arrowhead driving into the crack
icon('weak-point', (r) => {
  r.poly([[12, 14], [26, 10], [38, 10], [52, 14], [50, 34], [44, 48], [32, 56], [20, 48], [14, 34]], 'c1')
  r.poly([[16, 16], [28, 13], [36, 13], [48, 16], [46, 32], [40, 44], [32, 50], [24, 44], [18, 32]], 'c2')
  r.line(32, 13, 32, 50, 'c1')
  r.line(20, 18, 26, 30, 'c3')
  // the crack
  r.line(36, 20, 30, 28, 'b1')
  r.line(30, 28, 38, 34, 'b1')
  r.line(38, 34, 32, 42, 'b1')
  r.line(30, 28, 24, 30, 'b1')
  r.outline('k')
  // the arrowhead, gold, at the crack from the upper right
  r.poly([[34, 30], [56, 12], [48, 26]], 'g2')
  r.poly([[34, 30], [56, 12], [44, 18]], 'g3')
  thick(r, [56, 12], [62, 6], 'w2', 2)
  r.outline('k')
  sparkle(r, 34, 30, 3, 'y3', 'c3')
})

// Patience: a gold hourglass, white sand running, an arrow laid across its foot
icon('patience', (r) => {
  r.rect(16, 6, 32, 5, 'g2')
  r.rect(16, 53, 32, 5, 'g2')
  r.rect(16, 6, 32, 2, 'g3')
  r.rect(16, 53, 32, 2, 'g3')
  for (const x of [19, 44]) r.rect(x, 11, 2, 42, 'g1')
  r.poly([[22, 11], [42, 11], [34, 30], [34, 34], [42, 53], [22, 53], [30, 34], [30, 30]], 'c1')
  r.poly([[24, 12], [40, 12], [33, 29], [31, 29]], 'c3')
  // the sand: the top half spent, a heap below
  r.poly([[27, 20], [37, 20], [33, 28], [31, 28]], 'g3')
  r.line(32, 29, 32, 46, 'g3')
  r.poly([[24, 52], [32, 42], [40, 52]], 'g3')
  r.outline('k')
  arrow(r, [4, 58], [60, 46], 4, IVORY, ['w3', 'w2'], ['s2', 's4'])
  r.outline('k')
})

// Heartseeker: a white heart, a gold arrow through it and out the far side
icon('heartseeker', (r) => {
  const heart = (cx: number, cy: number, s: number, c: string) => {
    r.ellipse(cx - 7 * s, cy - 4 * s, 8 * s, 8 * s, c)
    r.ellipse(cx + 7 * s, cy - 4 * s, 8 * s, 8 * s, c)
    r.poly([[cx - 14.6 * s, cy - 1 * s], [cx + 14.6 * s, cy - 1 * s], [cx, cy + 16 * s]], c)
  }
  heart(32, 30, 1.35, 'c1')
  heart(31, 29, 1.1, 'c2')
  r.ellipse(22, 22, 4, 4, 'c3')
  r.outline('k')
  arrow(r, [6, 56], [58, 8], 5, GOLD, ['g2', 'g1'], ['y2', 'y3'])
  r.outline('k')
  for (const [x, y] of [[54, 24], [10, 30], [44, 54]] as const) sparkle(r, x, y, 3, 'y3', 'c3')
})

// ================================================================== the Trapper: iron and rope

// the path: a steel trap seen face on, its toothed jaws sprung open, its chain trailing in a coil of rope
icon('path-trapper', (r) => {
  // the jaws: two half-rings hinged at the bottom, open wide
  for (const s of [-1, 1]) {
    arc(r, 32, 40, 20, s < 0 ? 150 : -90, s < 0 ? 270 : 30, 's1', 5)
    arc(r, 32, 40, 20, s < 0 ? 160 : -80, s < 0 ? 250 : 10, 's2', 2)
    // teeth on the inner edge
    for (let i = 0; i < 5; i++) {
      const a = ((s < 0 ? 165 + i * 20 : -75 + i * 20) * Math.PI) / 180
      const [x, y] = [32 + Math.cos(a) * 17, 40 + Math.sin(a) * 17]
      const [ix, iy] = [32 + Math.cos(a) * 11, 40 + Math.sin(a) * 11]
      r.poly([[x + Math.sin(a) * 2, y - Math.cos(a) * 2], [ix, iy], [x - Math.sin(a) * 2, y + Math.cos(a) * 2]], 's3')
    }
  }
  // the pan and the springs at the hinge
  r.rect(14, 54, 36, 5, 's1')
  r.rect(14, 54, 36, 2, 's2')
  r.ellipse(32, 46, 5, 3, 'b2')
  r.ellipse(31, 45, 3, 1.5, 's3')
  r.outline('k')
  // the chain to a coil of rope
  for (let i = 0; i < 4; i++) r.ellipse(52 + i * 2, 56 - i * 4, 2, 1.5, i % 2 ? 's2' : 's3')
  arc(r, 54, 18, 6, 0, 360, 'o2', 3)
  arc(r, 54, 18, 6, 200, 320, 'o3', 1)
  r.outline('k')
})

// Lay of the Land: a folded map, a dashed trail across it, an iron pin at its end
icon('lay-of-the-land', (r) => {
  r.poly([[6, 14], [22, 10], [42, 14], [58, 10], [58, 50], [42, 54], [22, 50], [6, 54]], 'o2')
  r.poly([[22, 10], [42, 14], [42, 54], [22, 50]], 'o3')
  r.line(22, 10, 22, 50, 'o1')
  r.line(42, 14, 42, 54, 'o1')
  // hills, a river
  r.poly([[10, 40], [16, 30], [22, 40]], 'q2')
  r.poly([[44, 30], [50, 22], [56, 30]], 'q2')
  r.line(26, 52, 34, 40, 'i2')
  r.outline('k')
  // the trail, dashed, and the pin
  const trail: P[] = [[10, 46], [18, 36], [28, 34], [34, 26], [46, 24]]
  for (let i = 0; i + 1 < trail.length; i++) {
    const [a, b] = [trail[i], trail[i + 1]]
    for (let t = 0; t < 1; t += 0.34) r.ellipse(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 1, 1, 'r2')
  }
  thick(r, [48, 22], [48, 10], 's2', 2)
  ball(r, 48, 8, 4, ['r1', 'r2', 'r3'])
  r.outline('k', ['r2'])
})

// Snare Trap: a sapling bent down to a peg, a rope noose laid open on the ground under it
icon('snare-trap', (r) => {
  // the sapling, bent over in a bow from the left
  arc(r, 30, 48, 24, 180, 300, 'w2', 4)
  arc(r, 30, 48, 24, 190, 260, 'w3', 1)
  r.poly([[4, 50], [8, 50], [8, 58], [4, 58]], 'w1')
  // its leaves at the tip
  for (const [x, y] of [[40, 24], [44, 20], [46, 26]] as const) r.ellipse(x, y, 3, 2, 'q2')
  r.outline('k')
  // the line down from the tip to the noose
  r.line(42, 27, 42, 40, 'o1')
  r.line(43, 27, 43, 40, 'o2')
  // the noose: an open loop of rope on the ground, its knot
  arc(r, 36, 50, 14, 0, 360, 'o2', 3)
  arc(r, 36, 49, 14, 190, 340, 'o3', 1)
  r.ellipse(42, 40, 3, 2.5, 'o1')
  r.ellipse(41, 39, 1.5, 1, 'o3')
  r.outline('k')
  r.rect(4, 60, 56, 2, 'd2')
  r.outline('k')
})

// Spike Trap: three iron spikes up through a board, a drop of blood on one point
icon('spike-trap', (r) => {
  r.rect(6, 46, 52, 10, 'w2')
  r.rect(6, 46, 52, 3, 'w3')
  for (const x of [14, 30, 46]) r.rect(x - 1, 50, 2, 2, 'w1')
  r.outline('k')
  for (const [x, h] of [[16, 30], [32, 40], [48, 30]] as const) {
    r.poly([[x - 5, 46], [x, 46 - h], [x + 5, 46]], 's2')
    r.poly([[x - 3, 46], [x, 46 - h], [x, 46]], 's3')
    r.line(x, 46 - h + 2, x, 44, 's4')
  }
  r.outline('k')
  r.ellipse(32, 9, 1.6, 2.2, 'r2')
  for (const [x, y] of [[52, 10], [10, 14]] as const) sparkle(r, x, y, 2, 's4')
})

// Ambusher: two eyes in the leaves, an arrowhead poking out of the cover
icon('ambusher', (r) => {
  for (const [x, y, rad, c] of [[20, 30, 14, 'q1'], [40, 28, 15, 'q2'], [30, 44, 16, 'q1'], [48, 44, 11, 'q2'], [14, 46, 10, 'q2']] as const) r.ellipse(x, y, rad, rad * 0.85, c)
  for (const [x, y] of [[16, 24], [36, 20], [26, 40], [46, 40], [12, 44], [38, 50]] as const) r.poly([[x, y], [x + 4, y - 3], [x + 6, y + 1]], 'q3')
  r.outline('k')
  // the eyes, low and narrow
  for (const x of [24, 36]) {
    r.poly([[x - 4, 32], [x + 4, 31], [x + 3, 34], [x - 3, 34]], 'y2')
    r.rect(x - 1, 32, 2, 2, 'b1')
  }
  // the arrowhead, out of the right side of the bush
  r.poly([[50, 30], [62, 34], [50, 38]], 's2')
  r.line(51, 34, 61, 34, 's4')
  r.outline('k')
})

// Tripwire: a taut wire between two pegs, a bell on it struck and sparking
icon('tripwire', (r) => {
  for (const x of [8, 56]) {
    r.poly([[x - 3, 30], [x + 3, 30], [x + 1, 50], [x - 1, 50]], 'w2')
    r.rect(x - 3, 28, 6, 3, 'w3')
  }
  r.line(8, 32, 56, 36, 'm4')
  r.line(8, 33, 56, 37, 's2')
  r.outline('k', ['m4', 's2'])
  // the bell
  r.poly([[26, 36], [26, 30], [32, 26], [38, 30], [38, 36], [40, 40], [24, 40]], 'g2')
  r.poly([[28, 36], [28, 31], [32, 28], [34, 30], [33, 38]], 'g3')
  r.ellipse(32, 42, 2, 2, 'g1')
  r.outline('k')
  for (const [x, y] of [[20, 20], [44, 18], [32, 12]] as const) star(r, x, y, 4, 'y2', 'y3')
  r.outline('k', ['m4', 's2'])
})

// Killing Field: a ring of iron trap-plates round a burst of fire
icon('killing-field', (r) => {
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6
    const len = i % 2 ? 14 : 22
    r.poly([[32 + Math.cos(a + 0.22) * 6, 32 + Math.sin(a + 0.22) * 6], [32 + Math.cos(a) * len, 32 + Math.sin(a) * len], [32 + Math.cos(a - 0.22) * 6, 32 + Math.sin(a - 0.22) * 6]], i % 2 ? 'f3' : 'f2')
  }
  ball(r, 32, 32, 8, ['f1', 'f2', 'f3', 'f4'])
  r.outline('k')
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 6
    const [x, y] = [32 + Math.cos(a) * 25, 32 + Math.sin(a) * 25]
    r.ellipse(x, y, 6, 5, 's1')
    r.ellipse(x - 0.5, y - 0.5, 4.5, 3.5, 's2')
    r.rect(x - 1, y - 1, 2, 2, 'r2')
  }
  r.outline('k')
})

// ================================================================== the Beastmaster: fur grey and forest green

// the path: a wolf's head, face on, a green collar under its jaw
icon('path-beastmaster', (r) => {
  wolfFront(r, 32, 30, 1.6)
  r.poly([[18, 50], [46, 50], [44, 56], [20, 56]], 'q2')
  r.rect(20, 51, 24, 2, 'q3')
  r.ellipse(32, 56, 3, 3, 'g2')
  r.outline('k')
  for (const [x, y] of [[8, 12], [56, 12]] as const) sparkle(r, x, y, 2, 'q3', 'm4')
})

// Pack Bond: a grey paw print within a braided green cord
icon('pack-bond', (r) => {
  arc(r, 32, 32, 26, 0, 360, 'q1', 4)
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8
    r.ellipse(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26, 2.4, 2.4, i % 2 ? 'q2' : 'q3')
  }
  r.outline('k')
  paw(r, 32, 34, 7, ['m2', 'm3'])
  r.outline('k')
  sparkle(r, 32, 6, 2, 'm4')
})

// Call the Hound: a bone whistle, its call going out in green rings, a paw print beside
icon('call-the-hound', (r) => {
  for (const [rad, c] of [[10, 'q3'], [16, 'q2'], [22, 'q1']] as const) arc(r, 30, 30, rad, -60, 40, c, 2)
  r.outline('k', ['q1', 'q2', 'q3'])
  // the whistle, from the lower left up to the mouth of the rings
  r.poly([[6, 52], [24, 32], [30, 36], [12, 56]], 'h3')
  r.poly([[8, 52], [24, 34], [26, 36], [10, 54]], 'c3')
  r.rect(20, 38, 3, 3, 'h1')
  r.rect(15, 44, 3, 3, 'h1')
  r.ellipse(26, 34, 3, 3, 'h2')
  r.outline('k')
  paw(r, 48, 50, 4, ['m2', 'm3'])
  r.outline('k')
})

// Sic: a wolf in profile lunging, jaws wide, three red bite marks before it
icon('sic', (r) => {
  wolfSide(r, 26, 34, 1.5, 7)
  r.outline('k')
  for (const [x, y] of [[54, 14], [58, 24], [54, 34]] as const) {
    r.line(x - 4, y - 3, x + 4, y + 3, 'r2', 2)
  }
  streaks(r, [[2, 50, 8], [4, 56, 6]], ['m3', 'm2'])
  r.outline('k', ['m3', 'm2'])
})

// Feral Instinct: a wolf's green eye, glowing, three claw marks raked across
icon('feral-instinct', (r) => {
  r.poly([[6, 34], [20, 22], [34, 18], [50, 22], [60, 32], [48, 42], [32, 46], [16, 44]], 'm2')
  r.poly([[12, 34], [22, 26], [34, 23], [48, 26], [54, 32], [46, 38], [32, 41], [18, 40]], 'p2')
  r.ellipse(34, 32, 4, 9, 'b1')
  r.ellipse(30, 28, 2, 2, 'p3')
  r.outline('k')
  for (const dx of [-12, 0, 12]) thick(r, [20 + dx, 6], [40 + dx, 58], 'm4', 2)
  for (const dx of [-12, 0, 12]) r.line(21 + dx, 6, 41 + dx, 58, 'r3')
  r.outline('k', ['m4', 'r3'])
})

// Pack Hunter: two wolves running side by side, one before the other
icon('pack-hunter', (r) => {
  const runner = (x: number, y: number, ramp: Ramp) => {
    r.poly([[x - 16, y + 1], [x - 6, y - 6], [x + 8, y - 6], [x + 13, y - 11], [x + 22, y - 9], [x + 21, y - 4], [x + 15, y + 2], [x + 7, y + 7], [x - 10, y + 7]], ramp[1])
    r.poly([[x - 12, y], [x - 4, y - 4], [x + 8, y - 4], [x + 4, y + 2], [x - 8, y + 3]], ramp[2])
    r.poly([[x + 13, y - 11], [x + 14, y - 16], [x + 17, y - 11]], ramp[0])
    // legs in stride
    r.line(x - 10, y + 6, x - 18, y + 12, ramp[0], 3)
    r.line(x - 5, y + 6, x - 1, y + 13, ramp[0], 3)
    r.line(x + 8, y + 4, x + 16, y + 10, ramp[0], 3)
    r.line(x + 3, y + 5, x + 1, y + 13, ramp[0], 3)
    // the tail
    r.line(x - 16, y + 1, x - 24, y - 3, ramp[1], 4)
    r.set(x + 18, y - 8, 'p3')
  }
  runner(30, 22, ['m1', 'm2', 'm3'])
  r.outline('k')
  runner(36, 44, ['m1', 'm3', 'm4'])
  r.outline('k')
  streaks(r, [[2, 30, 6], [2, 52, 8]], ['q3', 'q2'])
})

// The Pack: three wolves' heads raised, howling up at a white moon
icon('the-pack', (r) => {
  ball(r, 18, 13, 9, ['c1', 'c2', 'c3'])
  r.outline('k')
  // a wolf's head in profile, muzzle raised to the upper right
  const howler = (x: number, y: number, s: number, ramp: Ramp) => {
    const at = (u: number, v: number): P => [x + u * s, y + v * s]
    r.poly([at(-7, 16), at(-7, 2), at(-5, -6), at(-4, -14), at(-1, -8), at(3, -10), at(9, -18), at(12, -16), at(8, -8), at(6, 0), at(7, 16)], ramp[1])
    r.poly([at(-4, 14), at(-4, 2), at(-1, -5), at(4, -8), at(5, -2), at(3, 14)], ramp[2])
    r.poly([at(-7, -4), at(-6, -17), at(0, -8)], ramp[0])
    r.poly([at(-5, -6), at(-5, -13), at(-2, -8)], ramp[1])
    // the open mouth, howling, and the nose at the tip
    r.poly([at(6, -6), at(11, -13), at(10, -10), at(7, -4)], 'r1')
    r.ellipse(x + 10.5 * s, y - 17 * s, 1.4 * s, 1.2 * s, 'b1')
    r.set(x + 1 * s, y - 6 * s, 'b1')
  }
  // each outlined before the next, so they stand apart
  howler(12, 44, 1.0, ['m1', 'm2', 'm3'])
  r.outline('k')
  howler(52, 44, 1.0, ['m1', 'm2', 'm3'])
  r.outline('k')
  howler(32, 38, 1.35, ['m1', 'm3', 'm4'])
  r.outline('k')
  r.rect(2, 58, 60, 4, 'q1')
  r.rect(2, 58, 60, 1, 'q2')
  r.outline('k')
  for (const [x, y] of [[40, 8], [54, 14], [6, 28]] as const) sparkle(r, x, y, 1, 'c3')
})

// ================================================================== the Master Archer: teal and silver

// the mastery: a silver arrow with teal wings, set in a gold circlet
icon('mastery-ranger', (r) => {
  arc(r, 32, 34, 24, 0, 360, 'g1', 3)
  arc(r, 32, 34, 24, 190, 340, 'g3', 1)
  for (let i = 0; i < 5; i++) {
    const a = ((-150 + i * 30) * Math.PI) / 180
    r.poly([[32 + Math.cos(a - 0.12) * 24, 34 + Math.sin(a - 0.12) * 24], [32 + Math.cos(a) * 31, 34 + Math.sin(a) * 31], [32 + Math.cos(a + 0.12) * 24, 34 + Math.sin(a + 0.12) * 24]], 'g2')
  }
  r.outline('k')
  // wings at the nock
  for (const s of [-1, 1]) {
    r.poly([[32, 48], [32 + s * 18, 42], [32 + s * 22, 52], [32 + s * 8, 54]], 't2')
    r.poly([[32, 48], [32 + s * 14, 44], [32 + s * 16, 50]], 't3')
  }
  r.outline('k')
  arrow(r, [32, 56], [32, 12], 5, ['t2', 't3'], ['s3', 's2'], ['s3', 's4'])
  r.outline('k')
  sparkle(r, 32, 10, 3, 's4', 't3')
})

// Hawk's Patience: a long hawk feather, a teal ribbon of wind round its quill
icon('hawks-patience', (r) => {
  r.poly([[14, 56], [22, 40], [34, 20], [48, 6], [54, 8], [48, 24], [36, 42], [22, 54]], 'h2')
  r.poly([[18, 52], [26, 40], [36, 24], [48, 10], [44, 24], [34, 40], [22, 50]], 'h3')
  for (let i = 0; i < 6; i++) r.line(20 + i * 5, 50 - i * 7, 26 + i * 5, 48 - i * 7, 'h1')
  thick(r, [14, 56], [8, 62], 'h1', 2)
  r.line(15, 55, 50, 9, 'h1')
  r.outline('k')
  arc(r, 22, 46, 12, 120, 380, 't2', 2)
  arc(r, 22, 46, 12, 150, 260, 't3', 1)
  r.outline('k', ['t2', 't3'])
  sparkle(r, 54, 30, 2, 'g3', 's4')
})

// Wind Arrow: a silver arrow in a teal spiral of wind, flying to the right
icon('wind-arrow', (r) => {
  for (let i = 0; i < 4; i++) {
    const cx = 14 + i * 11
    arc(r, cx, 32, 9 - i, 0, 300, i % 2 ? 't2' : 't3', 2)
  }
  r.outline('k', ['t2', 't3'])
  arrow(r, [4, 32], [60, 32], 5, ['t2', 't3'], ['s3', 's2'], ['s3', 's4'])
  r.outline('k', ['t2', 't3'])
  streaks(r, [[6, 16, 10], [8, 48, 12]], ['t3', 't2'])
})

// Fletcher: three arrows bound in twine, a loose feather and a small knife beside
icon('fletcher', (r) => {
  for (const dx of [-6, 0, 6]) arrow(r, [26 + dx, 58], [26 + dx, 8], 4, ['t2', 't3'], ['w3', 'w2'], ['s2', 's4'])
  r.outline('k')
  r.rect(16, 34, 20, 4, 'o2')
  r.rect(16, 34, 20, 1, 'o3')
  r.outline('k')
  // the loose feather
  r.poly([[40, 54], [48, 40], [56, 30], [58, 34], [50, 46]], 'm4')
  r.poly([[42, 52], [50, 40], [56, 32]], 'm3')
  r.line(40, 56, 57, 31, 't1')
  r.outline('k')
  // the knife
  r.poly([[44, 22], [58, 8], [60, 10], [48, 24]], 's3')
  r.rect(41, 23, 5, 5, 'w1')
  r.outline('k')
})

// Thousand Arrows: a teal-grey cloud raining a dense fall of silver arrows
icon('thousand-arrows', (r) => {
  for (const [x, y, rad] of [[18, 14, 10], [32, 10, 12], [46, 14, 10], [26, 18, 9], [40, 18, 9]] as const) r.ellipse(x, y, rad, rad * 0.8, 'm2')
  for (const [x, y, rad] of [[20, 12, 6], [32, 8, 8], [44, 12, 6]] as const) r.ellipse(x, y, rad, rad * 0.7, 'm3')
  r.rect(10, 20, 44, 3, 't1')
  r.outline('k')
  for (const [x, y] of [[12, 30], [22, 36], [32, 28], [42, 34], [52, 30], [16, 48], [28, 52], [38, 46], [48, 52]] as const) {
    r.line(x, y - 7, x, y, 's2')
    r.poly([[x - 2, y], [x + 2, y], [x, y + 4]], 's4')
    r.set(x - 1, y - 7, 't3')
    r.set(x + 1, y - 7, 't2')
  }
  r.outline('k', ['t3', 't2'])
  for (const [x, y] of [[8, 40], [58, 44]] as const) sparkle(r, x, y, 2, 'g3', 's4')
})

// Eagle's Grace: an eagle's wings spread, silver tipped with teal, a gold gem between them
icon("eagles-grace", (r) => {
  for (const s of [-1, 1]) {
    const at = (x: number, y: number): P => [32 + s * x, y]
    r.poly([at(4, 30), at(14, 18), at(28, 10), at(30, 14), at(26, 22), at(30, 24), at(26, 32), at(28, 36), at(20, 40), at(8, 40)], 'm3')
    r.poly([at(6, 30), at(14, 22), at(24, 16), at(20, 26), at(12, 34)], 'm4')
    for (const [x, y] of [[30, 14], [30, 24], [28, 36]] as const) r.poly([at(x - 6, y - 2), at(x, y), at(x - 5, y + 3)], 't2')
  }
  r.outline('k')
  ball(r, 32, 34, 6, ['g1', 'g2', 'g3', 'y3'])
  r.poly([[28, 40], [36, 40], [32, 54]], 't1')
  r.outline('k')
  streaks(r, [[2, 52, 10], [46, 54, 12]], ['t3', 't2'])
})

// ================================================================== the first tree, deeper: the ranger's green and wood

// Volley: three arrows arcing up and over together, green fletched
icon('volley', (r) => {
  for (const [dy, c] of [[0, 'p1'], [8, 'p1'], [16, 'p1']] as const) arc(r, 34, 56 + dy, 28, 200, 300, c, 1)
  r.outline('k', ['p1'])
  for (const [nock, point] of [[[8, 40], [46, 14]], [[12, 48], [52, 22]], [[16, 56], [58, 30]]] as [P, P][]) arrow(r, nock, point, 4, ['p2', 'p3'])
  r.outline('k', ['p1'])
  for (const [x, y] of [[50, 10], [58, 20]] as const) sparkle(r, x, y, 2, 'p3', 's4')
})

// Disengage: a green arc of a leap going back, an arrow flying forward, a splash of mud below
icon('disengage', (r) => {
  // the mud
  r.ellipse(40, 54, 18, 6, 'd1')
  r.ellipse(40, 53, 14, 4, 'd2')
  for (const [x, y] of [[28, 46], [52, 44], [44, 42]] as const) r.ellipse(x, y, 2, 2, 'd3')
  r.outline('k')
  // the leap back: a curved arrow over to the left
  arc(r, 32, 40, 22, 200, 340, 'p2', 4)
  arc(r, 32, 40, 22, 210, 300, 'p3', 1)
  r.poly([[6, 44], [14, 34], [2, 32]], 'p2')
  r.outline('k')
  arrow(r, [26, 30], [60, 30], 4, ['p2', 'p3'])
  r.outline('k')
})

// Keen Arrows: an arrowhead drawn along a whetstone, sparks flying
icon('keen-arrows', (r) => {
  r.poly([[6, 46], [42, 38], [46, 46], [10, 56]], 'm2')
  r.poly([[8, 46], [42, 39], [43, 42], [9, 50]], 'm3')
  r.outline('k')
  r.poly([[30, 34], [56, 12], [46, 30]], 's2')
  r.poly([[30, 34], [56, 12], [40, 22]], 's3')
  r.line(31, 33, 55, 13, 's4')
  thick(r, [30, 34], [22, 40], 'w2', 2)
  r.outline('k')
  for (const [x, y] of [[24, 30], [18, 26], [28, 22]] as const) star(r, x, y, 3, 'f3', 'f4')
  r.outline('k', ['m2'])
})

// Fleet Foot: footprints in the dust running off to the right, wind streaking past them
icon('fleet-foot', (r) => {
  const foot = (x: number, y: number) => {
    // the sole, the heel, five toes in an arc
    r.poly([[x - 4, y - 6], [x + 4, y - 7], [x + 5, y + 2], [x + 2, y + 6], [x - 3, y + 6], [x - 5, y]], 'd2')
    r.ellipse(x - 0.5, y + 10, 3.5, 3, 'd2')
    r.poly([[x - 3, y - 4], [x + 2, y - 5], [x + 3, y + 1], [x - 2, y + 3]], 'd3')
    for (const [dx, dy, rad] of [[-4, -11, 1.7], [-1, -13, 1.9], [2, -12.5, 1.6], [4.5, -11, 1.4], [6, -8.5, 1.2]] as const) r.ellipse(x + dx, y + dy, rad, rad, 'd2')
  }
  foot(14, 46)
  foot(32, 30)
  foot(50, 44)
  r.outline('k')
  streaks(r, [[2, 18, 12], [18, 8, 14], [24, 58, 14], [44, 22, 10]], ['t3', 't2', 't3', 't2'])
  for (const [x, y] of [[58, 30], [6, 34]] as const) sparkle(r, x, y, 2, 'p3', 's4')
})

// ----------------------------------------------------------------

const DIR = 'skills'
for (const [id, r] of Object.entries(out)) writeAtlas(`${DIR}/${id}.png`, [[r]], PAL)
console.log(`${Object.keys(out).length} ranger advancement icons → public/assets/lsw/${DIR}`)
