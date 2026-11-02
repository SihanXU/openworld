// The assassin's advancement icons (docs/advancement.md): the three paths' skills — the Necromancer's bone and grave-
// green, the Shadowdancer's night (indigo and a silver moon), the Demon Hunter's crimson, gold sigils and violet hexes —,
// the mastery's (black, crimson and gold), the four new skills of the first tree (the assassin's plum and steel), each
// path's entrance and the name its third takes (Hell Sovereign, Phantom, Ghostwail), and the hubs of the skill tree's
// Profession direction. 64x64, drawn by code
// in the look of the other skill icons (skill-actives.ts, skill-professions-a.ts): one bold emblem, a dark outline,
// three or four tones a colour, a few bright accents.
//
//   npx tsx games/openworld/tools/src/art/skill-adv-assassin.ts

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { OUT } from './png.ts'
import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [40, 18, 14, 255],
  // steel
  s1: [78, 84, 100, 255], s2: [138, 146, 162, 255], s3: [198, 205, 216, 255], s4: [246, 248, 252, 255],
  // wood and leather
  w1: [86, 46, 26, 255], w2: [136, 80, 42, 255], w3: [188, 124, 68, 255],
  // gold
  g1: [146, 92, 28, 255], g2: [212, 150, 50, 255], g3: [250, 208, 98, 255],
  // red, crimson
  r1: [116, 28, 30, 255], r2: [188, 50, 44, 255], r3: [234, 98, 72, 255],
  c1: [84, 12, 30, 255], c2: [150, 26, 50, 255], c3: [214, 62, 82, 255],
  // the night: indigo
  d1: [28, 26, 66, 255], d2: [52, 52, 120, 255], d3: [96, 100, 180, 255], d4: [170, 178, 234, 255],
  // the moon: ivory
  o1: [176, 164, 130, 255], o2: [222, 212, 178, 255], o3: [250, 246, 228, 255],
  // purple shadow, plum
  v1: [56, 28, 86, 255], v2: [106, 58, 148, 255], v3: [168, 108, 210, 255], v4: [226, 192, 252, 255],
  // poison: green, and a sickly yellow-green
  p1: [36, 104, 48, 255], p2: [76, 176, 66, 255], p3: [146, 228, 106, 255], p4: [222, 255, 190, 255],
  q1: [96, 112, 26, 255], q2: [156, 178, 46, 255], q3: [214, 230, 110, 255],
  // teal ribbons, wind
  t1: [36, 116, 116, 255], t2: [78, 178, 168, 255], t3: [160, 232, 214, 255],
  // smoke, iron
  m1: [86, 86, 94, 255], m2: [136, 136, 146, 255], m3: [188, 188, 198, 255], m4: [230, 230, 236, 255],
  b1: [28, 28, 38, 255], b2: [58, 58, 74, 255], b3: [100, 100, 122, 255],
  // bright
  f3: [255, 196, 76, 255], f4: [255, 242, 172, 255],
}

const S = 64
type P = [number, number]
type Ramp = [string, string, string, string?]
const STEEL: Ramp = ['s1', 's2', 's3', 's4']
const NONE = null as unknown as string

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

function blade(r: Raster, a: P, b: P, h: number, ramp: Ramp = STEEL): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const d: P = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
  const n: P = [-d[1], d[0]]
  const at = (t: number, o: number): P => [a[0] + d[0] * t + n[0] * o, a[1] + d[1] * t + n[1] * o]
  r.poly([at(0, h), at(len - h * 2.2, h), b, at(len - h * 2.2, -h), at(0, -h)], ramp[1])
  thick(r, at(0, -h + 0.6), at(len - h * 2.2, -h + 0.6), ramp[0], 1)
  thick(r, at(0, h * 0.35), at(len - h * 1.8, h * 0.35), ramp[2], 1)
  if (ramp[3]) thick(r, at(len - h * 3, h * 0.35), at(len - 1, 0), ramp[3], 1)
}

/** A dagger: blade from the guard to the point, a crossguard, a grip, a pommel (the grip's and guard's colours given). */
function dagger(r: Raster, hilt: P, point: P, h: number, grip = 7, ramp: Ramp = STEEL, guard = 'g2', wrap = 'w2'): void {
  const len = Math.hypot(point[0] - hilt[0], point[1] - hilt[1])
  const d: P = [(point[0] - hilt[0]) / len, (point[1] - hilt[1]) / len]
  const n: P = [-d[1], d[0]]
  blade(r, hilt, point, h, ramp)
  const g = h + 3
  thick(r, [hilt[0] + n[0] * g, hilt[1] + n[1] * g], [hilt[0] - n[0] * g, hilt[1] - n[1] * g], guard, 2)
  const end: P = [hilt[0] - d[0] * grip, hilt[1] - d[1] * grip]
  thick(r, [hilt[0] - d[0] * 2, hilt[1] - d[1] * 2], end, wrap, 2)
  r.ellipse(end[0] - d[0], end[1] - d[1], 1.6, 1.6, guard)
}

function sparkle(r: Raster, x: number, y: number, s: number, c: string, core = c): void {
  r.line(x - s, y, x + s, y, c)
  r.line(x, y - s, x, y + s, c)
  r.set(x, y, core)
}

/** A crescent: a disc with a second disc cut out of it (offset toward the upper right). */
function crescent(r: Raster, cx: number, cy: number, rad: number, cut: P, ramp: Ramp): void {
  const tmp = new Raster(S, S)
  tmp.ellipse(cx, cy, rad, rad, ramp[1])
  tmp.ellipse(cx - rad * 0.25, cy + rad * 0.2, rad * 0.55, rad * 0.55, ramp[2])
  if (ramp[3]) tmp.ellipse(cx - rad * 0.45, cy + rad * 0.35, rad * 0.2, rad * 0.2, ramp[3])
  tmp.ellipse(cx + cut[0], cy + cut[1], rad * 0.86, rad * 0.86, NONE)
  for (let i = 0; i < tmp.px.length; i++) if (tmp.px[i]) r.px[i] = tmp.px[i]
}

/** Drops of a colour (falling: a round body, a bright glint). */
function drop(r: Raster, x: number, y: number, s: number, ramp: Ramp): void {
  r.ellipse(x, y, s, s * 1.2, ramp[0])
  r.ellipse(x - s * 0.15, y, s * 0.75, s, ramp[1])
  r.poly([[x - s * 0.6, y - s * 0.5], [x, y - s * 2.4], [x + s * 0.6, y - s * 0.5]], ramp[1])
  r.set(x - s * 0.35, y - s * 0.3, ramp[2])
}

/** A billowing cloud of round puffs (a ramp: shade, body, light). */
function cloud(r: Raster, puffs: [number, number, number][], ramp: Ramp): void {
  for (const [x, y, s] of puffs) r.ellipse(x, y, s, s * 0.85, ramp[0])
  for (const [x, y, s] of puffs) r.ellipse(x - 1, y - 1, s * 0.82, s * 0.68, ramp[1])
  for (const [x, y, s] of puffs) r.ellipse(x - s * 0.3, y - s * 0.32, s * 0.36, s * 0.3, ramp[2])
}

/** A hooded figure's silhouette (a cloak and an empty hood) in one ramp: dark, body, a rim of light. */
function hooded(r: Raster, cx: number, top: number, h: number, ramp: Ramp, eyes?: string): void {
  const w = h * 0.42
  r.poly([[cx - w, top + h], [cx - w * 0.62, top + h * 0.32], [cx, top + h * 0.16], [cx + w * 0.62, top + h * 0.32], [cx + w, top + h]], ramp[0])
  r.ellipse(cx, top + h * 0.2, h * 0.18, h * 0.2, ramp[0])
  r.poly([[cx - w * 0.78, top + h], [cx - w * 0.45, top + h * 0.4], [cx - w * 0.08, top + h * 0.3], [cx - w * 0.2, top + h]], ramp[1])
  r.ellipse(cx - h * 0.04, top + h * 0.17, h * 0.11, h * 0.12, ramp[1])
  r.ellipse(cx, top + h * 0.22, h * 0.09, h * 0.08, ramp[3] ?? 'b1')
  if (eyes) {
    r.set(cx - h * 0.04, top + h * 0.21, eyes)
    r.set(cx + h * 0.04, top + h * 0.21, eyes)
  }
  r.line(cx - w * 0.6, top + h * 0.34, cx - w * 0.95, top + h - 1, ramp[2])
}

/** A skull, front on: the dome, a jaw of teeth, two hollow eyes (a glint of `glow` in each), a nose (a ramp of bone). */
function skull(r: Raster, cx: number, cy: number, s: number, ramp: Ramp, glow?: string): void {
  r.ellipse(cx, cy, s, s * 0.88, ramp[0])
  r.ellipse(cx - s * 0.1, cy - s * 0.12, s * 0.84, s * 0.72, ramp[1])
  r.ellipse(cx - s * 0.38, cy - s * 0.42, s * 0.28, s * 0.2, ramp[2])
  r.rect(cx - s * 0.5, cy + s * 0.6, s, s * 0.45, ramp[1])
  r.rect(cx - s * 0.5, cy + s * 0.95, s, Math.max(1, s * 0.12), ramp[0])
  for (let x = cx - s * 0.5 + 2; x < cx + s * 0.5 - 1; x += 3) r.line(x, cy + s * 0.62, x, cy + s * 1.0, ramp[0])
  for (const d of [-1, 1]) {
    r.ellipse(cx + d * s * 0.4, cy + s * 0.08, s * 0.26, s * 0.24, 'b1')
    if (glow) r.set(cx + d * s * 0.4, cy + s * 0.08, glow)
  }
  r.poly([[cx, cy + s * 0.3], [cx - s * 0.13, cy + s * 0.52], [cx + s * 0.13, cy + s * 0.52]], 'b1')
}

/** A smooth path through points (Catmull-Rom), sampled. */
function curve(pts: P[], steps = 6): P[] {
  const out: P[] = []
  for (let i = 0; i + 1 < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const t2 = t * t, t3 = t2 * t
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

const out: Record<string, Raster> = {}
const icon = (id: string, draw: (r: Raster) => void) => {
  const r = new Raster(S, S)
  draw(r)
  out[id] = r
}

// ================================================================ the Necromancer: bone and a sickly green

// The path: a skull wreathed in green grave-fire, a dagger behind it
icon('path-necromancer', (r) => {
  dagger(r, [12, 56], [54, 10], 3, 7, STEEL, 'p2', 'b2')
  r.outline('k')
  r.poly([[18, 34], [21, 16], [26, 24], [32, 6], [38, 24], [43, 16], [46, 34]], 'p1')
  r.poly([[22, 34], [25, 22], [29, 28], [32, 14], [35, 28], [39, 22], [42, 34]], 'p2')
  r.poly([[27, 34], [32, 22], [37, 34]], 'p3')
  skull(r, 32, 36, 12, ['o1', 'o2', 'o3'], 'p3')
  r.outline('k')
  sparkle(r, 52, 50, 2, 'p3', 'p4')
  sparkle(r, 10, 14, 2, 'p3', 'p4')
})

// Grave Toxin: a bone of the raised dead, its knuckle end dripping green poison
icon('grave-toxin', (r) => {
  thick(r, [18, 46], [44, 20], 'o1', 7)
  thick(r, [18, 46], [44, 20], 'o2', 5)
  r.line(19, 43, 41, 21, 'o3')
  for (const [x, y] of [[14, 46], [18, 50], [44, 16], [48, 20]] as const) ball(r, x, y, 5, ['o1', 'o2', 'o3'])
  r.outline('k')
  // the poison soaking its upper end and running off it
  for (const [x, y] of [[44, 16], [48, 20], [41, 23]] as const) r.ellipse(x, y, 3, 2.5, 'p2')
  r.ellipse(46, 17, 1.5, 1.2, 'p4')
  drop(r, 50, 34, 2.6, ['p1', 'p2', 'p4'])
  drop(r, 42, 40, 2, ['p1', 'p2', 'p4'])
  drop(r, 52, 48, 1.6, ['p1', 'p2', 'p4'])
  r.outline('k', ['p2', 'p4'])
  sparkle(r, 12, 14, 2, 'p3', 'p4')
})

// Miasma: a green cloud of bubbling poison, darker swirls within it
icon('miasma', (r) => {
  cloud(r, [[20, 38, 11], [34, 32, 13], [46, 40, 10], [30, 46, 10], [16, 28, 7], [44, 24, 7]], ['p1', 'p2', 'p3'])
  r.outline('k')
  arc(r, 30, 38, 6, 0, 270, 'q1', 1)
  arc(r, 44, 32, 4, 90, 360, 'q1', 1)
  for (const [x, y, s] of [[12, 52, 2], [24, 56, 2.5], [44, 54, 2], [52, 50, 1.5]] as const) ball(r, x, y, s, ['q1', 'q2', 'q3'])
  r.outline('k', ['q1'])
})

// Raise Dead: a bony hand clawing up out of broken ground, green wisps about it
icon('raise-dead', (r) => {
  r.ellipse(32, 54, 27, 8, 'w1')
  r.ellipse(32, 53, 21, 5, 'b1')
  for (const [x, y] of [[8, 52], [56, 52], [14, 58], [50, 58]] as const) r.rect(x, y, 3, 2, 'w2')
  // the forearm's two bones, the wrist, the palm
  thick(r, [28, 52], [27, 34], 'o1', 3)
  thick(r, [35, 52], [34, 34], 'o2', 3)
  r.ellipse(31, 30, 7, 5, 'o2')
  r.ellipse(29, 29, 4, 2.5, 'o3')
  // four fingers spread and crooked, a thumb
  for (const [x0, x1, y1] of [[25, 20, 16], [29, 27, 12], [33, 34, 12], [37, 41, 16]] as const) {
    thick(r, [x0, 27], [x1, y1], 'o2', 2)
    r.set(x0 + (x1 - x0) / 2, 27 + (y1 - 27) / 2, 'o1')
  }
  thick(r, [37, 31], [44, 26], 'o2', 2)
  r.outline('k')
  cloud(r, [[12, 40, 4], [8, 34, 3]], ['p1', 'p2', 'p3'])
  cloud(r, [[52, 38, 4], [56, 31, 3]], ['p1', 'p2', 'p3'])
  r.outline('k', ['w1', 'w2', 'b1'])
  sparkle(r, 46, 10, 2, 'p3', 'p4')
})

// Corpse Burst: a cracked skull flung apart in a green burst, bone shards about it
icon('corpse-burst', (r) => {
  const burst: P[] = []
  for (let i = 0; i < 16; i++) {
    const t = (i * Math.PI) / 8
    const rad = i % 2 ? 13 : 27
    burst.push([32 + Math.cos(t) * rad, 34 + Math.sin(t) * rad])
  }
  r.poly(burst, 'p1')
  r.poly(burst.map(([x, y]) => [32 + (x - 32) * 0.7, 34 + (y - 34) * 0.7] as P), 'p2')
  r.poly(burst.map(([x, y]) => [32 + (x - 32) * 0.4, 34 + (y - 34) * 0.4] as P), 'p3')
  r.outline('k')
  skull(r, 32, 32, 10, ['o1', 'o2', 'o3'], 'p4')
  // the crack down its dome
  r.line(30, 22, 33, 27, 'b1')
  r.line(33, 27, 31, 31, 'b1')
  r.outline('k')
  for (const [x, y, a, b] of [[8, 12, 13, 15], [54, 10, 50, 15], [56, 54, 51, 50], [8, 54, 13, 50]] as const) thick(r, [x, y], [a, b], 'o2', 2)
  r.outline('k', ['p1', 'p2', 'p3'])
})

// Grave Pact: a sealed scroll, its wax a green skull
icon('grave-pact', (r) => {
  r.rect(14, 14, 36, 34, 'o2')
  r.rect(14, 14, 36, 4, 'o1')
  r.rect(14, 14, 6, 34, 'o3')
  r.ellipse(14, 31, 4, 17, 'o1')
  r.ellipse(50, 31, 4, 17, 'o1')
  for (const y of [24, 29, 34]) r.line(22, y, 44, y, 'w2')
  r.line(22, 39, 34, 39, 'w2')
  r.outline('k')
  // the seal, a ribbon hanging from it
  thick(r, [40, 46], [36, 58], 'c2', 3)
  thick(r, [44, 46], [48, 58], 'c2', 3)
  ball(r, 42, 44, 8, ['p1', 'p2', 'p3', 'p4'])
  skull(r, 42, 43, 4, ['p1', 'p1', 'p1'])
  r.outline('k', ['o1'])
  sparkle(r, 54, 10, 2, 'p3', 'p4')
})

// Army of the Dead: three skulls rising out of the ground, the middle one foremost, their eyes green
icon('army-of-the-dead', (r) => {
  r.ellipse(32, 56, 30, 7, 'w1')
  r.ellipse(32, 55, 25, 4, 'b1')
  skull(r, 15, 38, 9, ['o1', 'o2', 'o2'], 'p3')
  skull(r, 49, 38, 9, ['o1', 'o2', 'o2'], 'p3')
  r.outline('k')
  for (const x of [11, 15, 19, 45, 49, 53]) r.line(x, 49, x, 54, 'o1')
  skull(r, 32, 30, 12, ['o1', 'o2', 'o3'], 'p4')
  thick(r, [28, 45], [28, 55], 'o1', 2)
  thick(r, [36, 45], [36, 55], 'o1', 2)
  r.outline('k', ['w1', 'b1'])
  for (const [x, y] of [[8, 14], [32, 8], [56, 16]] as const) sparkle(r, x, y, 2, 'p3', 'p4')
})

// ================================================================ the Shadowdancer: indigo, a silver moon

// The path: a crescent moon on an indigo night, a dagger crossed before it
icon('path-shadowdancer', (r) => {
  ball(r, 32, 32, 22, ['d1', 'd2', 'd2', 'd3'])
  r.outline('k')
  crescent(r, 30, 30, 15, [7, -5], ['o1', 'o2', 'o3', 's4'])
  for (const [x, y] of [[44, 18], [48, 34], [20, 44]] as const) r.set(x, y, 'd4')
  dagger(r, [22, 46], [50, 14], 3, 7, STEEL, 'v3', 'v1')
  r.outline('k')
  sparkle(r, 52, 12, 3, 'd4', 's4')
})

// Shadow Poise: an indigo cloak, its hem going to dusk, a crescent clasp at the throat
icon('shadow-poise', (r) => {
  // the cloak, broad at the shoulders, its hood thrown back, its hem going to dusk
  r.poly([[32, 10], [46, 14], [56, 22], [52, 30], [54, 52], [46, 48], [40, 54], [32, 48], [24, 54], [18, 48], [10, 52], [12, 30], [8, 22], [18, 14]], 'd2')
  r.poly([[32, 10], [18, 14], [8, 22], [12, 30], [10, 52], [18, 48], [20, 30], [26, 18]], 'd3')
  r.poly([[22, 8], [42, 8], [44, 16], [32, 20], [20, 16]], 'd1')
  r.poly([[24, 9], [32, 9], [30, 15], [22, 14]], 'd3')
  r.line(12, 32, 11, 50, 'd4')
  r.line(8, 22, 18, 14, 'd4')
  r.outline('k')
  for (const [x, y] of [[14, 56], [22, 58], [30, 56], [38, 58], [46, 56], [52, 58]] as const) r.rect(x, y, 2, 2, 'd3')
  for (const [x, y] of [[18, 60], [34, 60], [44, 61]] as const) r.set(x, y, 'd2')
  crescent(r, 32, 24, 5, [2, -2], ['o1', 'o2', 'o3'])
  r.outline('k', ['d3', 'd2'])
  sparkle(r, 54, 8, 2, 'd4', 'o3')
  sparkle(r, 8, 40, 2, 'd4', 'o3')
})

// Umbral Step: a dagger stepping out of a pool of void, its point already glinting gold
icon('umbral-step', (r) => {
  r.ellipse(26, 46, 20, 9, 'd1')
  r.ellipse(26, 45, 16, 6, 'b1')
  arc(r, 26, 46, 19, 190, 350, 'd3', 1)
  r.outline('k')
  dagger(r, [24, 46], [46, 14], 3.2, 6, STEEL, 'd3', 'd1')
  r.outline('k')
  // the void it came out of, rising off it
  for (const [x, y, len] of [[14, 40, 6], [34, 38, 5], [20, 36, 4]] as const) r.line(x, y, x - 2, y - len, 'd3')
  sparkle(r, 48, 12, 4, 'g3', 'f4')
  r.set(52, 8, 'g2')
  r.set(44, 8, 'g2')
})

// Blur: a dagger thrust with two afterimages trailing behind it, fainter each
icon('blur', (r) => {
  dagger(r, [8, 46], [30, 16], 3, 6, ['d1', 'd1', 'd2'], 'd2', 'd1')
  dagger(r, [18, 50], [40, 18], 3, 6, ['d1', 'd2', 'd3'], 'd3', 'd1')
  dagger(r, [28, 54], [54, 18], 3.4, 7, STEEL, 'v3', 'v1')
  r.outline('k', ['d1', 'd2', 'd3'])
  for (const [x, y, len] of [[40, 52, 10], [46, 46, 8], [36, 58, 7]] as const) r.line(x, y, x + len, y - len * 0.4, 'd4')
  sparkle(r, 56, 14, 3, 'd4', 's4')
})

// Unseen: a dagger half there, fading to nothing toward the hilt, out of a wisp of smoke
icon('unseen', (r) => {
  cloud(r, [[14, 46, 7], [22, 50, 6], [10, 52, 5]], ['m1', 'm2', 'm3'])
  r.outline('k')
  dagger(r, [20, 44], [50, 14], 3, 6, ['d1', 'd2', 'd4', 's4'], 'd3', 'd1')
  // the hilt half gone: every other pixel of it lost to the veil
  for (let y = 36; y < 54; y++) for (let x = 12; x < 32; x++) if ((x + y) % 2 === 0 && r.get(x, y) && !['m1', 'm2', 'm3'].includes(r.get(x, y)!)) r.set(x, y, NONE)
  r.outline('k', ['m1', 'm2', 'm3'])
  sparkle(r, 52, 12, 3, 'g3', 'f4')
  r.rect(34, 22, 2, 2, 'f4')
})

// Riposte: two blades meeting in a spark, the defender's turning back on a curved arrow
icon('riposte', (r) => {
  dagger(r, [8, 40], [36, 24], 2.8, 5, ['r1', 'm2', 'm3'], 'm2', 'b2')
  dagger(r, [52, 54], [30, 20], 3, 6, STEEL, 't2', 't1')
  r.outline('k')
  // the turn back: an arc and its head
  arc(r, 34, 30, 18, 200, 330, 't2', 3)
  arc(r, 34, 30, 18, 205, 325, 't3', 1)
  r.poly([[48, 16], [54, 22], [46, 24]], 't2')
  r.outline('k', ['s1', 's2', 's3', 's4', 'r1', 'm2', 'm3'])
  sparkle(r, 32, 26, 4, 'f3', 'f4')
  sparkle(r, 32, 26, 2, 'f4', 's4')
})

// Thousand Shadows: three hooded shadows in a row, each fainter, the last striking
icon('thousand-shadows', (r) => {
  hooded(r, 16, 18, 34, ['d1', 'd1', 'd2'])
  hooded(r, 28, 14, 38, ['d1', 'd2', 'd3'])
  r.outline('k')
  hooded(r, 42, 10, 42, ['v1', 'v2', 'v3', 'b1'], 'v4')
  r.outline('k', ['d1', 'd2', 'd3'])
  dagger(r, [50, 40], [60, 24], 2.4, 5, STEEL, 'v3', 'v1')
  r.outline('k', ['d1', 'd2', 'd3'])
  sparkle(r, 60, 20, 2, 'd4', 's4')
})

// ================================================================ the Demon Hunter: crimson, gold sigils, violet hexes

/** A ring of gold with the marks of a binding round it. */
function sigilRing(r: Raster, cx: number, cy: number, rad: number): void {
  arc(r, cx, cy, rad, 0, 360, 'g1', 2)
  arc(r, cx, cy, rad, 0, 360, 'g2', 1)
  for (let i = 0; i < 8; i++) {
    const t = (i * Math.PI) / 4
    r.rect(cx + Math.cos(t) * rad - 1, cy + Math.sin(t) * rad - 1, 3, 3, 'g3')
  }
}

/** A demon's horned skull (crimson), its eyes alight. */
function demonSkull(r: Raster, cx: number, cy: number, s: number): void {
  for (const d of [-1, 1]) {
    r.poly([[cx + d * s * 0.5, cy - s * 0.5], [cx + d * s * 1.4, cy - s * 1.5], [cx + d * s * 0.95, cy - s * 0.2]], 'c1')
    r.poly([[cx + d * s * 0.6, cy - s * 0.55], [cx + d * s * 1.3, cy - s * 1.35], [cx + d * s * 0.9, cy - s * 0.35]], 'c2')
  }
  skull(r, cx, cy, s, ['c1', 'c2', 'c3'], 'f3')
}

// The path: a demon's horned skull inside a gold binding ring, a dagger through it
icon('path-demonhunter', (r) => {
  sigilRing(r, 32, 34, 25)
  demonSkull(r, 32, 34, 11)
  r.outline('k', ['g1', 'g2', 'g3'])
  dagger(r, [48, 58], [18, 10], 3, 6, STEEL, 'g2', 'b2')
  r.outline('k', ['g1', 'g2', 'g3'])
  sparkle(r, 54, 12, 2, 'v3', 'v4')
})

// Hunter's Lore: an open book, a violet sigil glowing on its pages
icon('hunters-lore', (r) => {
  r.poly([[6, 20], [32, 26], [58, 20], [58, 50], [32, 56], [6, 50]], 'w1')
  r.poly([[8, 18], [31, 24], [31, 52], [8, 46]], 'o2')
  r.poly([[33, 24], [56, 18], [56, 46], [33, 52]], 'o3')
  r.line(32, 25, 32, 54, 'o1')
  for (const y of [28, 33, 38]) r.line(11, y - 2, 27, y + 2, 'o1')
  r.outline('k')
  arc(r, 44, 35, 8, 0, 360, 'v2', 1)
  r.poly([[44, 27], [46, 33], [52, 35], [46, 37], [44, 43], [42, 37], [36, 35], [42, 33]], 'v3')
  r.set(44, 35, 'v4')
  sparkle(r, 50, 10, 3, 'v3', 'v4')
  sparkle(r, 14, 10, 2, 'v3', 'v4')
})

// Binding Sigil: a gold circle on the ground, a violet star bound inside it
icon('binding-sigil', (r) => {
  r.ellipse(32, 34, 27, 24, 'v1')
  r.ellipse(32, 34, 24, 21, 'b2')
  sigilRing(r, 32, 34, 23)
  const star: P[] = []
  for (let i = 0; i < 5; i++) {
    const t = -Math.PI / 2 + (i * 4 * Math.PI) / 5
    star.push([32 + Math.cos(t) * 18, 34 + Math.sin(t) * 16])
  }
  for (let i = 0; i < 5; i++) thick(r, star[i], star[(i + 1) % 5], 'v3', 2)
  for (let i = 0; i < 5; i++) r.line(star[i][0], star[i][1], star[(i + 1) % 5][0], star[(i + 1) % 5][1], 'v4')
  r.outline('k')
  ball(r, 32, 34, 3, ['v2', 'v3', 'v4'])
})

// Call of the Hunt: a curled hunting horn, its call ringing out
icon('hunt-call', (r) => {
  const horn = curve([[10, 44], [18, 52], [32, 50], [42, 40], [46, 28]], 8)
  for (let i = 0; i + 1 < horn.length; i++) thick(r, horn[i], horn[i + 1], 'w2', 2 + Math.round((i / horn.length) * 6))
  for (let i = 0; i + 1 < horn.length; i++) r.line(horn[i][0], horn[i][1] - 1, horn[i + 1][0], horn[i + 1][1] - 1, 'w3')
  r.ellipse(46, 26, 7, 4, 'g2')
  r.ellipse(46, 25, 5, 2.5, 'b1')
  r.rect(9, 41, 4, 5, 'g2')
  r.rect(24, 48, 3, 6, 'g1')
  r.rect(36, 42, 3, 6, 'g1')
  r.outline('k')
  for (const rad of [8, 14, 20]) arc(r, 46, 20, rad, 230, 330, rad === 14 ? 'g3' : 'g2', 1)
  sparkle(r, 12, 14, 2, 'g3', 'f4')
})

// Hexing Edge: a dagger whose blade is written with violet runes, a hex glowing at its point
icon('hex-edge', (r) => {
  dagger(r, [14, 52], [50, 14], 4.2, 8, ['v1', 'v2', 'v3', 'v4'], 'g2', 'b2')
  r.outline('k')
  for (let t = 4; t < 30; t += 5) {
    const x = 16 + t
    const y = 50 - t
    r.set(x, y, 'f4')
    r.set(x + 1, y - 1, 'v4')
  }
  arc(r, 52, 12, 6, 0, 360, 'v3', 1)
  sparkle(r, 52, 12, 3, 'v4', 's4')
})

// Hunter's Vigil: a steel shield, a violet eye watching from its boss
icon('hunters-vigil', (r) => {
  r.poly([[12, 10], [52, 10], [52, 30], [32, 58], [12, 30]], 's1')
  r.poly([[15, 13], [49, 13], [49, 30], [32, 54], [15, 30]], 's2')
  r.poly([[15, 13], [30, 13], [30, 50], [15, 30]], 's3')
  r.outline('k')
  r.ellipse(32, 30, 11, 6, 'o3')
  r.ellipse(32, 30, 5, 5, 'v2')
  r.ellipse(32, 30, 2.5, 2.5, 'b1')
  r.set(31, 29, 'v4')
  r.line(21, 30, 26, 25, 'k')
  r.line(38, 25, 43, 30, 'k')
  r.outline('k', ['s1', 's2', 's3'])
  sparkle(r, 56, 8, 2, 'v3', 'v4')
})

// Demon Prison: a demon's skull held in chains, a ring of gold sigils round it
icon('demon-prison', (r) => {
  sigilRing(r, 32, 34, 27)
  demonSkull(r, 32, 36, 10)
  r.outline('k', ['g1', 'g2', 'g3'])
  for (const [a, b] of [[[8, 18], [24, 34]], [[56, 18], [40, 34]], [[10, 56], [24, 44]], [[54, 56], [40, 44]]] as [P, P][]) {
    for (let i = 0; i <= 4; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / 4
      const y = a[1] + ((b[1] - a[1]) * i) / 4
      r.ellipse(x, y, 2, 2, i % 2 ? 'm2' : 'm3')
    }
  }
  r.outline('k', ['g1', 'g2', 'g3'])
})


// ================================================================ the Master of Shadows: black, crimson, gold

// The mastery: a black hood, crimson eyes in it, a gold crown above
icon('mastery-assassin', (r) => {
  hooded(r, 32, 18, 42, ['b1', 'b2', 'b3', 'b1'], 'c3')
  r.outline('k')
  r.poly([[20, 16], [22, 6], [26, 12], [32, 4], [38, 12], [42, 6], [44, 16]], 'g2')
  r.poly([[20, 16], [22, 8], [26, 13], [28, 16]], 'g3')
  r.rect(20, 14, 25, 3, 'g1')
  r.set(32, 9, 'c3')
  r.outline('k', ['b3'])
  sparkle(r, 52, 10, 2, 'g3', 'f4')
})

// Lethality: a dagger with a crimson edge and a gold star of the critical at its point
icon('lethality', (r) => {
  dagger(r, [14, 50], [46, 18], 4, 8, ['c1', 'c2', 'c3', 's4'], 'g2', 'b2')
  r.outline('k')
  r.poly([[50, 6], [53, 12], [60, 13], [55, 18], [57, 25], [50, 21], [43, 25], [45, 18], [40, 13], [47, 12]], 'g2')
  r.poly([[50, 9], [52, 13], [56, 14], [53, 17], [50, 15]], 'g3')
  r.outline('k')
  sparkle(r, 12, 14, 2, 'c3', 'f4')
})

// Death Mark: a crimson brand: a ring, a cross through it, four barbs — the sign set on the marked
icon('death-mark', (r) => {
  // the marked: a dark hooded head, and over it the crimson reticle of the mark
  hooded(r, 32, 16, 44, ['b1', 'b2', 'b3', 'b1'])
  r.outline('k')
  arc(r, 32, 30, 20, 0, 360, 'c1', 4)
  arc(r, 32, 30, 20, 0, 360, 'c2', 2)
  arc(r, 32, 30, 20, 200, 290, 'c3', 1)
  for (const [x, y, dx, dy] of [[32, 6, 0, 1], [32, 54, 0, -1], [8, 30, 1, 0], [56, 30, -1, 0]] as const) {
    thick(r, [x, y], [x + dx * 10, y + dy * 10], 'c2', 3)
    r.line(x, y, x + dx * 10, y + dy * 10, 'c3')
  }
  r.outline('k', ['b1', 'b2', 'b3'])
  ball(r, 32, 30, 3, ['c1', 'c2', 'c3'])
  sparkle(r, 54, 54, 2, 'c3', 'f4')
})

// Ghost: a pale wraith of a hood, its edges thinning to nothing
icon('ghost', (r) => {
  // a pale wraith: a hood with a dark face, a body that thins into wisps
  r.ellipse(32, 18, 13, 13, 'm3')
  r.poly([[19, 20], [45, 20], [50, 40], [46, 50], [40, 44], [36, 56], [32, 46], [26, 58], [22, 46], [16, 52], [14, 40]], 'm3')
  r.poly([[19, 20], [28, 20], [24, 40], [22, 46], [16, 52], [14, 40]], 'm4')
  r.ellipse(30, 14, 6, 5, 'm4')
  // arms reaching out, thinning
  r.poly([[16, 28], [6, 36], [8, 40], [18, 34]], 'm3')
  r.poly([[48, 28], [58, 34], [56, 38], [46, 34]], 'm2')
  r.ellipse(32, 20, 7, 7, 'b2')
  r.ellipse(32, 21, 6, 6, 'b1')
  r.set(29, 20, 'd4')
  r.set(35, 20, 'd4')
  r.outline('k')
  // the lower half thinning to nothing
  for (let y = 40; y < 64; y++) for (let x = 0; x < 64; x++) if (r.get(x, y) && (x * 3 + y * 5) % (y > 50 ? 2 : 3) === 0) r.set(x, y, NONE)
  for (const [x, y] of [[10, 12], [54, 14], [56, 52]] as const) sparkle(r, x, y, 2, 'm4', 's4')
})

// Assassinate: one great dagger driven straight down, a crimson streak behind it, a flash at its point
icon('assassinate', (r) => {
  for (const [x, len] of [[20, 26], [26, 34], [38, 30], [44, 22]] as const) r.line(x, 4, x, 4 + len, 'c2')
  for (const x of [23, 41]) r.line(x, 6, x, 30, 'c3')
  dagger(r, [32, 8], [32, 52], 5, 8, ['s1', 's2', 's3', 's4'], 'g2', 'b2')
  r.outline('k', ['c2', 'c3'])
  sparkle(r, 32, 56, 6, 'g3', 'f4')
  sparkle(r, 32, 56, 3, 'f4', 's4')
  for (const [x, y] of [[20, 58], [44, 58]] as const) r.rect(x, y, 2, 2, 'c3')
})

// Shadow Lord: a crown of black iron, five gold points, a crimson stone at its brow
icon('shadow-lord', (r) => {
  const pts: P[] = [[8, 46], [8, 22], [17, 34], [22, 14], [28, 32], [32, 8], [36, 32], [42, 14], [47, 34], [56, 22], [56, 46]]
  r.poly(pts, 'b2')
  r.poly([[8, 46], [8, 24], [16, 36], [20, 46]], 'b3')
  r.rect(8, 42, 49, 8, 'b1')
  r.line(8, 43, 56, 43, 'b3')
  r.outline('k')
  for (const [x, y] of [[8, 22], [22, 14], [32, 8], [42, 14], [56, 22]] as const) ball(r, x, y, 3, ['g1', 'g2', 'g3'])
  ball(r, 32, 38, 5, ['c1', 'c2', 'c3', 'f4'])
  r.outline('k')
})

// Hell Sovereign (the Necromancer's third): a skull crowned with black horns, hellfire behind it
icon('mastery-necromancer', (r) => {
  r.poly([[10, 52], [14, 22], [20, 32], [26, 10], [32, 26], [38, 10], [44, 32], [50, 22], [54, 52]], 'r1')
  r.poly([[16, 52], [19, 30], [24, 38], [28, 20], [32, 32], [36, 20], [40, 38], [45, 30], [48, 52]], 'r2')
  r.poly([[24, 52], [28, 38], [32, 44], [36, 38], [40, 52]], 'f3')
  r.outline('k')
  skull(r, 32, 38, 12, ['o1', 'o2', 'o3'], 'r3')
  // a crown of black horns
  r.rect(20, 23, 24, 4, 'b2')
  for (const [x, h] of [[21, 10], [27, 14], [32, 18], [37, 14], [43, 10]] as const) r.poly([[x - 2.5, 24], [x, 24 - h], [x + 2.5, 24]], 'b2')
  r.line(20, 24, 43, 24, 'b3')
  r.outline('k')
})

// Phantom (the Shadowdancer's third): a pale half mask with one violet eye, its other half gone to indigo smoke
icon('mastery-shadowdancer', (r) => {
  cloud(r, [[44, 20, 8], [48, 32, 9], [44, 44, 8], [52, 50, 5]], ['d1', 'd2', 'd3'])
  r.outline('k')
  r.poly([[32, 8], [22, 10], [14, 18], [12, 30], [16, 44], [24, 54], [32, 56]], 'o2')
  r.poly([[32, 8], [22, 10], [16, 18], [16, 28], [22, 22], [32, 20]], 'o3')
  r.poly([[16, 40], [24, 52], [32, 56], [32, 48]], 'o1')
  r.ellipse(24, 30, 5, 3, 'b1')
  r.set(24, 30, 'v4')
  r.line(20, 42, 28, 44, 'o1')
  r.outline('k', ['d1', 'd2', 'd3'])
  // the mask's other half: only its edge, in smoke
  for (const [x, y] of [[36, 12], [40, 20], [42, 30], [40, 42], [36, 52]] as const) r.rect(x, y, 2, 2, 'd4')
  sparkle(r, 10, 10, 2, 'v3', 'v4')
})

// Ghostwail (the Demon Hunter's third): a horned crimson mask weeping pale tears, a gold sigil on its brow
icon('mastery-demonhunter', (r) => {
  for (const d of [-1, 1]) {
    r.poly([[32 + d * 10, 18], [32 + d * 26, 4], [32 + d * 18, 22]], 'c1')
    r.poly([[32 + d * 11, 18], [32 + d * 24, 7], [32 + d * 17, 20]], 'c2')
  }
  r.poly([[32, 12], [46, 16], [50, 30], [46, 46], [32, 56], [18, 46], [14, 30], [18, 16]], 'c2')
  r.poly([[32, 12], [18, 16], [14, 30], [18, 40], [24, 26], [32, 20]], 'c3')
  r.poly([[18, 46], [32, 56], [46, 46], [32, 50]], 'c1')
  for (const d of [-1, 1]) r.poly([[32 + d * 4, 32], [32 + d * 14, 28], [32 + d * 12, 34]], 'b1')
  r.line(26, 46, 38, 46, 'b1')
  r.outline('k')
  for (const x of [22, 42]) {
    thick(r, [x, 35], [x, 50], 'd4', 2)
    drop(r, x, 56, 2.2, ['d3', 'd4', 's4'])
  }
  r.ellipse(32, 20, 3, 3, 'g2')
  r.set(32, 20, 'f4')
  r.outline('k', ['d3', 'd4', 's4'])
})

// ================================================================ the first tree, deeper: plum and steel

// Garrote: a wire drawn between two wooden grips, looped as for a throat
icon('garrote', (r) => {
  const wire = curve([[14, 18], [10, 34], [24, 50], [40, 50], [54, 34], [50, 18]], 6)
  for (let i = 0; i + 1 < wire.length; i++) thick(r, wire[i], wire[i + 1], 's2', 2)
  for (let i = 0; i + 1 < wire.length; i++) r.line(wire[i][0], wire[i][1] - 1, wire[i + 1][0], wire[i + 1][1] - 1, 's4')
  r.outline('k')
  for (const [x, y] of [[14, 14], [50, 14]] as const) {
    r.rect(x - 7, y - 3, 14, 7, 'w2')
    r.rect(x - 7, y - 3, 14, 2, 'w3')
    r.rect(x - 1, y - 3, 2, 7, 'v2')
  }
  r.outline('k')
  sparkle(r, 32, 52, 3, 'v4', 's4')
})

// Caltrops: three iron caltrops thrown down, a point up on each
function caltrop(r: Raster, x: number, y: number, s: number): void {
  thick(r, [x - s, y + s * 0.6], [x + s, y - s * 0.4], 'b2', 3)
  thick(r, [x - s * 0.7, y - s * 0.6], [x + s * 0.7, y + s * 0.7], 'b2', 3)
  thick(r, [x, y], [x, y - s * 1.3], 'b3', 3)
  r.line(x, y - 1, x, y - s * 1.3, 'm4')
  r.line(x - s, y + s * 0.6 - 1, x + s, y - s * 0.4 - 1, 'b3')
}
icon('caltrops', (r) => {
  caltrop(r, 18, 44, 9)
  caltrop(r, 44, 48, 8)
  caltrop(r, 32, 24, 10)
  r.outline('k')
  for (const [x, y] of [[32, 11], [18, 32], [44, 37]] as const) r.set(x, y, 's4')
  for (const [x, y] of [[8, 56], [56, 30], [52, 12]] as const) r.rect(x, y, 2, 2, 'v3')
})

// Light Step: a soft plum shoe on a white feather
icon('light-step', (r) => {
  // the feather
  r.poly([[8, 54], [30, 30], [52, 12], [56, 16], [40, 36], [16, 56]], 'm4')
  r.poly([[12, 54], [30, 34], [52, 14], [40, 30], [18, 54]], 's4')
  r.line(8, 56, 54, 14, 'm2')
  r.outline('k')
  // the shoe
  r.poly([[22, 22], [34, 22], [36, 36], [46, 40], [46, 46], [20, 46], [20, 34]], 'v2')
  r.poly([[22, 22], [28, 22], [28, 44], [20, 44], [20, 34]], 'v3')
  r.rect(20, 44, 27, 3, 'v1')
  r.line(22, 26, 34, 26, 'v4')
  r.outline('k')
  for (const [x, y, len] of [[48, 50, 8], [50, 54, 6], [6, 20, 6]] as const) r.line(x, y, x + len, y, 'v3')
})

// Cut Deep: a deep gash opened in a hide, red welling in it, the dagger that made it above
icon('cut-deep', (r) => {
  r.poly([[8, 30], [30, 22], [56, 28], [58, 52], [34, 58], [10, 52]], 'w2')
  r.poly([[8, 30], [30, 22], [32, 30], [10, 38]], 'w3')
  r.outline('k')
  r.poly([[14, 48], [34, 34], [52, 32], [36, 42], [16, 52]], 'c1')
  r.poly([[18, 48], [34, 37], [46, 34], [34, 41], [20, 50]], 'c2')
  r.line(22, 47, 40, 37, 'c3')
  r.outline('k', ['w2', 'w3'])
  dagger(r, [20, 16], [48, 8], 2.6, 6, STEEL, 'v3', 'v1')
  r.outline('k')
  drop(r, 30, 56, 2, ['c1', 'c2', 'c3'])
  drop(r, 44, 46, 1.8, ['c1', 'c2', 'c3'])
})

// ================================================================ the Profession direction's hubs

// Advancement: three gold chevrons rising, a star at the top
icon('advance', (r) => {
  for (const [y, c, l] of [[50, 'g1', 'g2'], [38, 'g2', 'g3'], [26, 'g2', 'g3']] as const) {
    r.poly([[12, y + 6], [32, y - 8], [52, y + 6], [52, y + 12], [32, y - 2], [12, y + 12]], c)
    r.line(13, y + 6, 32, y - 7, l)
  }
  r.outline('k')
  r.poly([[32, 2], [35, 9], [42, 10], [37, 15], [38, 22], [32, 18], [26, 22], [27, 15], [22, 10], [29, 9]], 'f3')
  r.poly([[32, 5], [34, 10], [32, 14], [29, 10]], 'f4')
  r.outline('k')
})

// The path, before one is chosen: a waymark post, three arms pointing three ways
icon('path', (r) => {
  r.rect(29, 14, 6, 46, 'w2')
  r.rect(29, 14, 2, 46, 'w3')
  r.rect(22, 56, 20, 4, 'w1')
  for (const [y, dir, c] of [[14, -1, 'v2'], [26, 1, 'p2'], [38, -1, 't2']] as const) {
    const x0 = dir < 0 ? 31 : 33
    const x1 = dir < 0 ? 8 : 56
    r.poly([[x0, y], [x1 + dir * -6, y], [x1, y + 4], [x1 + dir * -6, y + 8], [x0, y + 8]], c)
    r.line(x0, y + 1, x1 + dir * -6, y + 1, 's4')
  }
  r.outline('k')
  ball(r, 32, 10, 3, ['g1', 'g2', 'g3'])
  r.outline('k')
})

// The mastery (the third): a gold laurel round a star
icon('mastery', (r) => {
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const t = Math.PI / 2 + side * (0.4 + i * 0.36)
      const x = 32 + Math.cos(t) * 21
      const y = 34 + Math.sin(t) * 21
      r.ellipse(x, y, 4, 2.6, 'p1')
      r.ellipse(x - 0.5, y - 0.5, 3, 1.8, 'p2')
    }
    arc(r, 32, 34, 21, side < 0 ? 120 : 60, side < 0 ? 250 : -70, 'w2', 1)
  }
  r.outline('k')
  r.poly([[32, 16], [36, 27], [48, 28], [39, 35], [42, 47], [32, 40], [22, 47], [25, 35], [16, 28], [28, 27]], 'g2')
  r.poly([[32, 20], [35, 28], [32, 34], [29, 28]], 'g3')
  r.outline('k')
  sparkle(r, 32, 58, 2, 'g3', 'f4')
})

// ---------------------------------------------------------------- write them (never over another's picture)

const MINE = Object.keys(out)
for (const id of MINE) {
  const path = join(OUT, 'skills', `${id}.png`)
  if (existsSync(path) && !process.argv.includes('--again')) throw new Error(`skills/${id}.png is already drawn (pass --again to redraw this file's own)`)
}
for (const [id, r] of Object.entries(out)) writeAtlas(`skills/${id}.png`, [[r]], PAL)
console.log(`${MINE.length} assassin advancement icons → public/assets/lsw/skills`)
