// The active skills' icons (the skill bar's twenty: four for everyone, four for each profession), 64x64, drawn by
// code in the look of the illustrated skill art: one bold emblem on a clear ground, a dark outline round it, three or
// four tones a colour, a few bright accents; what flies off it (wind, sparks, smoke) is left without an outline.
//
//   npx tsx packages/tools/src/art/skill-actives.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [40, 18, 14, 255],
  // steel
  s1: [78, 84, 100, 255], s2: [138, 146, 162, 255], s3: [198, 205, 216, 255], s4: [246, 248, 252, 255],
  // wood and leather
  w1: [86, 46, 26, 255], w2: [136, 80, 42, 255], w3: [188, 124, 68, 255],
  // gold
  g1: [146, 92, 28, 255], g2: [212, 150, 50, 255], g3: [250, 208, 98, 255],
  // red
  r1: [116, 28, 30, 255], r2: [188, 50, 44, 255], r3: [234, 98, 72, 255],
  // fire
  f1: [196, 64, 28, 255], f2: [240, 126, 38, 255], f3: [255, 196, 76, 255], f4: [255, 242, 172, 255],
  // green: poison, healing
  p1: [36, 104, 48, 255], p2: [76, 176, 66, 255], p3: [146, 228, 106, 255], p4: [222, 255, 190, 255],
  // teal wind
  t1: [36, 116, 116, 255], t2: [78, 178, 168, 255], t3: [160, 232, 214, 255],
  // purple shadow, arcane
  v1: [56, 28, 86, 255], v2: [106, 58, 148, 255], v3: [168, 108, 210, 255], v4: [226, 192, 252, 255],
  // ice
  i1: [46, 96, 158, 255], i2: [98, 168, 220, 255], i3: [170, 220, 246, 255], i4: [236, 250, 255, 255],
  // smoke
  m1: [86, 86, 94, 255], m2: [136, 136, 146, 255], m3: [188, 188, 198, 255], m4: [230, 230, 236, 255],
  // lightning
  y1: [198, 146, 28, 255], y2: [250, 218, 60, 255], y3: [255, 250, 182, 255],
  // the bomb's iron
  b1: [28, 28, 38, 255], b2: [58, 58, 74, 255], b3: [100, 100, 122, 255],
  // earth
  e1: [78, 52, 38, 255], e2: [120, 84, 54, 255], e3: [166, 120, 80, 255],
}

const S = 64
type P = [number, number]
type Ramp = [string, string, string, string?]
const STEEL: Ramp = ['s1', 's2', 's3', 's4']

/** A line of some width (a square pen). */
const thick = (r: Raster, a: P, b: P, c: string, w: number) => r.line(a[0], a[1], b[0], b[1], c, w)

/** A ball shaded from the lower right (dark) to a highlight at the upper left. */
function ball(r: Raster, cx: number, cy: number, rad: number, ramp: Ramp): void {
  r.ellipse(cx, cy, rad, rad, ramp[0])
  r.ellipse(cx - rad * 0.12, cy - rad * 0.12, rad * 0.82, rad * 0.82, ramp[1])
  r.ellipse(cx - rad * 0.3, cy - rad * 0.3, rad * 0.5, rad * 0.5, ramp[2])
  if (ramp[3]) r.ellipse(cx - rad * 0.42, cy - rad * 0.42, Math.max(1, rad * 0.18), Math.max(1, rad * 0.18), ramp[3])
}

/** An arc of a circle (degrees, 0 = right, clockwise on screen). */
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

/** A blade from its base `a` to its point `b`, half-width h: a lit edge, a dark edge, a bright tip. */
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

/** A sword or dagger: blade from the guard to the point, a gold crossguard, a leather grip and a pommel. */
function sword(r: Raster, hilt: P, point: P, h: number, grip = 7): void {
  const len = Math.hypot(point[0] - hilt[0], point[1] - hilt[1])
  const d: P = [(point[0] - hilt[0]) / len, (point[1] - hilt[1]) / len]
  const n: P = [-d[1], d[0]]
  blade(r, hilt, point, h)
  const g = h + 3
  thick(r, [hilt[0] + n[0] * g, hilt[1] + n[1] * g], [hilt[0] - n[0] * g, hilt[1] - n[1] * g], 'g2', 2)
  r.set(hilt[0] + n[0] * g, hilt[1] + n[1] * g, 'g3')
  const end: P = [hilt[0] - d[0] * grip, hilt[1] - d[1] * grip]
  thick(r, [hilt[0] - d[0] * 2, hilt[1] - d[1] * 2], end, 'w2', 2)
  r.ellipse(end[0] - d[0], end[1] - d[1], 1.6, 1.6, 'g2')
  r.set(end[0] - d[0] - 0.6, end[1] - d[1] - 0.6, 'g3')
}

/** An arrow from its nock to its point: a wooden shaft, a steel head, red fletching. */
function arrow(r: Raster, nock: P, point: P, head = 4): void {
  const len = Math.hypot(point[0] - nock[0], point[1] - nock[1])
  const d: P = [(point[0] - nock[0]) / len, (point[1] - nock[1]) / len]
  const n: P = [-d[1], d[0]]
  const base: P = [point[0] - d[0] * head * 1.6, point[1] - d[1] * head * 1.6]
  thick(r, nock, base, 'w3', 2)
  r.line(nock[0], nock[1], base[0], base[1], 'w2')
  r.poly([[base[0] + n[0] * head, base[1] + n[1] * head], point, [base[0] - n[0] * head, base[1] - n[1] * head]], 's2')
  r.line(base[0], base[1], point[0], point[1], 's4')
  for (const s of [1, -1]) {
    for (let t = 0; t < 6; t++) {
      const x = nock[0] + d[0] * t
      const y = nock[1] + d[1] * t
      r.line(x, y, x + n[0] * s * 3 - d[0] * 2, y + n[1] * s * 3 - d[1] * 2, t % 2 ? 'r2' : 'r3')
    }
  }
}

/** A four-point sparkle. */
function sparkle(r: Raster, x: number, y: number, s: number, c: string, core = c): void {
  r.line(x - s, y, x + s, y, c)
  r.line(x, y - s, x, y + s, c)
  r.set(x, y, core)
}

/** Wind streaks: a few short curved strokes, unoutlined. */
function streaks(r: Raster, lines: [number, number, number][], ramp: string[]): void {
  lines.forEach(([x, y, len], i) => {
    r.line(x, y, x + len, y, ramp[i % ramp.length])
    r.line(x + len, y, x + len + 2, y - 1, ramp[i % ramp.length])
  })
}

const out: Record<string, Raster> = {}
const icon = (id: string, draw: (r: Raster) => void) => {
  const r = new Raster(S, S)
  draw(r)
  out[id] = r
}

// ---------------------------------------------------------------- everyone's

// Whirlwind: a sword at the end of a spiral of wind, sweeping round
icon('whirlwind', (r) => {
  arc(r, 32, 32, 21, 160, 470, 't1', 3)
  arc(r, 32, 32, 21, 200, 470, 't2', 2)
  arc(r, 32, 32, 14, 20, 300, 't2', 2)
  arc(r, 32, 32, 14, 60, 300, 't3', 1)
  arc(r, 32, 32, 8, 120, 380, 't3', 1)
  r.outline('k')
  sword(r, [24, 40], [48, 16], 3, 8)
  r.outline('k', ['t1', 't2', 't3'])
  sparkle(r, 52, 12, 3, 't3', 'p4')
})

// Cleave: a great axe brought down, the ground cracking under it
icon('cleave', (r) => {
  // the ground the bit bites into
  r.poly([[4, 50], [60, 50], [60, 58], [4, 58]], 'e2')
  r.line(4, 50, 60, 50, 'e3')
  r.outline('k')
  thick(r, [44, 8], [26, 46], 'w2', 3)
  r.line(44, 8, 26, 46, 'w3')
  // the head: a broad crescent bit
  r.poly([[30, 30], [16, 26], [10, 36], [14, 50], [26, 46], [30, 40]], 's2')
  r.poly([[14, 30], [10, 36], [14, 46], [17, 44], [14, 36]], 's3')
  r.line(12, 32, 12, 42, 's4')
  r.rect(28, 36, 4, 6, 's1')
  r.outline('k')
  // the crack it opens, sparks where steel meets stone
  r.line(14, 51, 10, 57, 'k')
  r.line(18, 51, 24, 57, 'k')
  r.line(16, 51, 16, 55, 'k')
  sparkle(r, 6, 44, 2, 'f3', 'f4')
  sparkle(r, 26, 52, 2, 'f3', 'f4')
  for (const [x, y] of [[4, 36], [34, 46], [38, 40]] as const) r.rect(x, y, 2, 2, 'e3')
})

// Gale Step: a winged boot, teal wind streaming behind it
icon('gale-step', (r) => {
  // the boot
  r.poly([[26, 14], [40, 14], [40, 36], [52, 42], [54, 50], [24, 50], [24, 36]], 'w2')
  r.poly([[26, 14], [32, 14], [32, 40], [26, 40]], 'w3')
  r.rect(24, 46, 31, 4, 'w1')
  r.rect(26, 18, 14, 3, 'g2')
  r.line(26, 18, 39, 18, 'g3')
  // the wing at its heel
  r.poly([[24, 24], [10, 16], [6, 20], [12, 24], [6, 28], [14, 30], [8, 34], [18, 34], [24, 32]], 'i4')
  r.line(10, 20, 22, 26, 'i3')
  r.line(10, 28, 22, 30, 'i3')
  r.outline('k')
  streaks(r, [[2, 40, 14], [4, 44, 12], [8, 48, 10], [40, 8, 12], [44, 12, 8]], ['t2', 't3', 't1'])
})

// Mend: a green cross that glows, sparkles rising
icon('mend', (r) => {
  r.ellipse(32, 32, 22, 22, 'p1')
  r.ellipse(32, 32, 20, 20, null as unknown as string)
  r.poly([[26, 12], [38, 12], [38, 26], [52, 26], [52, 38], [38, 38], [38, 52], [26, 52], [26, 38], [12, 38], [12, 26], [26, 26]], 'p2')
  r.poly([[28, 14], [34, 14], [34, 28], [28, 28]], 'p3')
  r.poly([[14, 28], [28, 28], [28, 32], [14, 32]], 'p3')
  r.rect(29, 15, 2, 8, 'p4')
  r.rect(15, 29, 8, 2, 'p4')
  r.rect(36, 36, 2, 14, 'p1')
  r.rect(36, 36, 14, 2, 'p1')
  r.outline('k', ['p1'])
  sparkle(r, 10, 12, 3, 'p3', 'p4')
  sparkle(r, 54, 14, 2, 'p3', 'p4')
  sparkle(r, 52, 52, 3, 'p3', 'p4')
  sparkle(r, 8, 50, 2, 'p3', 'p4')
})

// ---------------------------------------------------------------- the assassin

// Shadow Strike: a dagger thrust out of a purple shadow
icon('shadow-strike', (r) => {
  // the shadow: a hooded figure's silhouette
  r.ellipse(24, 22, 9, 9, 'v1')
  r.poly([[12, 54], [16, 30], [24, 26], [32, 30], [38, 54]], 'v1')
  r.ellipse(24, 23, 6, 5, 'v2')
  r.set(21, 23, 'v4')
  r.set(26, 23, 'v4')
  r.poly([[16, 54], [19, 34], [24, 30], [22, 54]], 'v2')
  r.outline('k')
  sword(r, [30, 40], [54, 14], 2.5, 6)
  r.outline('k')
  for (const [x, y] of [[8, 40], [6, 30], [42, 52], [10, 18]] as const) r.rect(x, y, 2, 2, 'v3')
  sparkle(r, 56, 10, 3, 'v4', 's4')
})

// Envenom: a dagger dripping green poison
icon('envenom', (r) => {
  sword(r, [20, 46], [48, 12], 3, 8)
  // the poison running down the blade
  r.line(30, 34, 44, 18, 'p2')
  r.line(31, 35, 45, 19, 'p3')
  r.outline('k')
  r.ellipse(36, 36, 2, 3, 'p2')
  r.ellipse(40, 46, 2, 3, 'p2')
  r.ellipse(44, 54, 2.5, 3, 'p2')
  r.set(35, 35, 'p4')
  r.set(39, 45, 'p4')
  r.set(43, 53, 'p4')
  r.rect(36, 39, 1, 3, 'p3')
  r.rect(40, 49, 1, 2, 'p3')
  r.outline('k', ['p3'])
  for (const [x, y] of [[52, 30], [54, 40], [28, 54]] as const) sparkle(r, x, y, 1, 'p3', 'p4')
})

// Smoke Bomb: a black bomb, its fuse lit, smoke billowing round it
icon('smoke-bomb', (r) => {
  // the smoke behind
  for (const [x, y, s] of [[14, 42, 9], [50, 44, 8], [44, 18, 7], [18, 20, 6], [32, 52, 8]] as const) {
    r.ellipse(x, y, s, s * 0.8, 'm2')
    r.ellipse(x - 2, y - 2, s * 0.65, s * 0.5, 'm3')
    r.ellipse(x - 3, y - 3, s * 0.3, s * 0.25, 'm4')
  }
  r.outline('k')
  ball(r, 32, 36, 13, ['b1', 'b2', 'b3', 'm4'])
  r.rect(29, 20, 7, 5, 'b2')
  r.rect(29, 20, 7, 2, 'b3')
  r.outline('k')
  r.line(33, 19, 36, 13, 'w2')
  r.line(36, 13, 40, 11, 'w2')
  r.outline('k', [])
  sparkle(r, 42, 9, 3, 'f2', 'f4')
  r.set(43, 8, 'f3')
})

// Flurry: four daggers fanned out from one grip-point
icon('flurry', (r) => {
  const hub: P = [20, 46]
  for (const a of [-80, -55, -30, -5]) {
    const t = (a * Math.PI) / 180
    const base: P = [hub[0] + Math.cos(t) * 6, hub[1] + Math.sin(t) * 6]
    const tip: P = [hub[0] + Math.cos(t) * 40, hub[1] + Math.sin(t) * 40]
    sword(r, base, tip, 2.2, 5)
    r.outline('k')
  }
  for (const [x, y] of [[52, 16], [44, 6], [58, 30]] as const) sparkle(r, x, y, 2, 's3', 's4')
})

// ---------------------------------------------------------------- the warrior

// Shield Bash: a round shield, a star of impact where it strikes
icon('shield-bash', (r) => {
  // the impact behind, to the right
  r.poly([[46, 20], [50, 28], [60, 26], [52, 33], [60, 40], [50, 38], [46, 46], [44, 37], [36, 34], [44, 30]], 'f3')
  r.poly([[46, 26], [48, 30], [54, 30], [50, 33], [54, 37], [48, 36], [46, 40], [45, 35], [41, 33], [45, 31]], 'f4')
  r.outline('k')
  ball(r, 26, 34, 18, ['w1', 'w2', 'w3'])
  r.ellipse(26, 34, 18, 18, null as unknown as string)
  ball(r, 26, 34, 18, ['w1', 'w2', 'w3'])
  arc(r, 26, 34, 16, 0, 360, 's2', 2)
  arc(r, 26, 34, 16, 190, 280, 's4', 1)
  ball(r, 26, 34, 5, ['g1', 'g2', 'g3'])
  for (const a of [45, 135, 225, 315]) {
    const t = (a * Math.PI) / 180
    r.rect(26 + Math.cos(t) * 11 - 1, 34 + Math.sin(t) * 11 - 1, 2, 2, 'g2')
  }
  r.outline('k')
  for (const [x, y, len] of [[54, 14, 6], [56, 50, 6]] as const) r.line(x, y, x + len, y + (y < 32 ? -3 : 3), 'f3')
})

// Charge: a helmed head rushing forward behind a lance point, speed lines trailing
icon('charge', (r) => {
  // the lance
  r.poly([[14, 34], [56, 26], [14, 40]], 's2')
  r.line(16, 35, 54, 27, 's4')
  r.line(16, 39, 50, 29, 's1')
  r.outline('k')
  // the helmet
  r.poly([[10, 18], [26, 14], [32, 22], [32, 36], [10, 36]], 's2')
  r.poly([[12, 18], [22, 15], [24, 22], [12, 24]], 's3')
  r.rect(18, 25, 12, 3, 'k')
  r.rect(10, 32, 22, 4, 's1')
  r.poly([[12, 14], [8, 6], [16, 12]], 'r2')
  r.outline('k')
  streaks(r, [[0, 44, 10], [2, 48, 14], [0, 52, 8], [0, 12, 4]], ['g3', 'g2', 'm3'])
  sparkle(r, 58, 24, 3, 'f3', 'f4')
})

// War Cry: a horned helmet roaring, shout waves rolling out
icon('war-cry', (r) => {
  for (const rad of [22, 27]) arc(r, 30, 34, rad, -50, 50, rad === 22 ? 'f3' : 'f2', 2)
  for (const rad of [22, 27]) arc(r, 30, 34, rad, 130, 230, rad === 22 ? 'f3' : 'f2', 2)
  // horns
  r.poly([[18, 26], [8, 18], [6, 8], [12, 16], [22, 22]], 'm4')
  r.poly([[42, 26], [52, 18], [54, 8], [48, 16], [38, 22]], 'm4')
  r.line(8, 12, 12, 18, 'm3')
  r.line(52, 12, 48, 18, 'm3')
  // helmet and open mouth
  r.ellipse(30, 32, 13, 12, 's2')
  r.ellipse(27, 28, 8, 6, 's3')
  r.rect(18, 36, 24, 10, 's2')
  r.rect(22, 34, 16, 3, 'k')
  r.poly([[24, 40], [36, 40], [34, 48], [26, 48]], 'r1')
  r.rect(26, 40, 8, 2, 'm4')
  r.line(30, 20, 30, 34, 'g2')
  r.outline('k', ['f2', 'f3'])
})

// Earthsplitter: a war hammer slammed down, the ground split and shards flying
icon('earthsplitter', (r) => {
  // ground and the split
  r.poly([[4, 48], [60, 48], [60, 58], [4, 58]], 'e2')
  r.line(4, 48, 60, 48, 'e3')
  r.poly([[26, 48], [38, 48], [34, 58], [30, 58]], 'k')
  r.line(32, 48, 20, 56, 'k')
  r.line(32, 48, 46, 56, 'k')
  r.outline('k')
  // the hammer
  thick(r, [44, 6], [33, 32], 'w2', 3)
  r.line(44, 6, 33, 32, 'w3')
  r.poly([[18, 30], [44, 30], [46, 44], [16, 44]], 's2')
  r.rect(18, 31, 26, 3, 's3')
  r.line(19, 31, 30, 31, 's4')
  r.rect(16, 41, 30, 3, 's1')
  r.rect(29, 34, 6, 7, 'g2')
  r.outline('k')
  // shards
  for (const [x, y] of [[8, 38], [12, 30], [54, 36], [50, 28], [6, 44]] as const) {
    r.poly([[x, y], [x + 3, y - 2], [x + 4, y + 2]], 'e3')
  }
  r.outline('k')
  for (const [x, y] of [[14, 46], [50, 46]] as const) sparkle(r, x, y, 2, 'f3', 'f4')
})

// ---------------------------------------------------------------- the ranger

// Multishot: three arrows fanned out
icon('multishot', (r) => {
  for (const [nock, point] of [[[10, 54], [40, 10]], [[10, 54], [54, 24]], [[10, 54], [56, 48]]] as [P, P][]) arrow(r, nock, point)
  r.outline('k')
  for (const [x, y] of [[46, 6], [60, 20], [60, 44]] as const) sparkle(r, x, y, 2, 'g3', 's4')
})

// Leap Shot: a drawn bow, a backward arc of motion behind it
icon('leap-shot', (r) => {
  arc(r, 30, 30, 24, 110, 250, 't2', 2)
  arc(r, 30, 30, 20, 120, 240, 't3', 1)
  r.poly([[4, 50], [10, 44], [12, 50]], 't2')
  r.outline('k', [])
  // the bow, bent toward the right; the string drawn back
  arc(r, 30, 32, 20, -70, 70, 'w2', 3)
  arc(r, 30, 32, 20, -60, -10, 'w3', 1)
  r.line(37, 13, 24, 32, 'm4')
  r.line(24, 32, 37, 51, 'm4')
  arrow(r, [22, 32], [58, 32], 4)
  r.outline('k', ['t2', 't3'])
})

// Piercing Arrow: an arrow driven clean through a target
icon('piercing-arrow', (r) => {
  ball(r, 34, 32, 16, ['r1', 'r2', 'r3'])
  r.ellipse(34, 32, 11, 11, 'm4')
  r.ellipse(34, 32, 6, 6, 'r2')
  r.ellipse(33, 31, 3, 3, 'r3')
  r.outline('k')
  arrow(r, [4, 50], [60, 14], 4)
  r.outline('k')
  for (const [x, y] of [[56, 22], [52, 8]] as const) sparkle(r, x, y, 2, 'g3', 's4')
})

// Arrow Rain: arrows falling slant out of the sky
icon('arrow-rain', (r) => {
  // staggered so no arrow's fletching covers another's head
  for (const [x, y] of [[4, 6], [18, 18], [32, 4], [46, 16]] as const) arrow(r, [x, y], [x + 9, y + 30], 3)
  r.outline('k')
  r.poly([[4, 54], [60, 54], [60, 58], [4, 58]], 'e2')
  r.line(4, 54, 60, 54, 'e3')
  r.outline('k')
  for (const [x, y] of [[14, 50], [42, 50], [58, 50]] as const) sparkle(r, x, y, 2, 'e3', 'm4')
})

// ---------------------------------------------------------------- the mage

// Fireball: a ball of fire, its tail streaming behind
icon('fireball', (r) => {
  r.poly([[34, 22], [6, 4], [18, 18], [4, 22], [22, 30], [8, 44], [30, 40]], 'f1')
  r.poly([[34, 26], [14, 12], [22, 22], [12, 28], [28, 34]], 'f2')
  r.outline('k')
  ball(r, 38, 36, 16, ['f1', 'f2', 'f3', 'f4'])
  r.ellipse(34, 32, 6, 6, 'f4')
  r.outline('k')
  for (const [x, y] of [[56, 14], [10, 54], [56, 56]] as const) sparkle(r, x, y, 2, 'f3', 'f4')
})

// Frost Nova: a burst of ice crystals round a pale core
icon('frost-nova', (r) => {
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    const tip: P = [32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26]
    const side = (s: number): P => [32 + Math.cos(a + s) * 12, 32 + Math.sin(a + s) * 12]
    r.poly([side(0.28), tip, side(-0.28)], i % 2 ? 'i2' : 'i3')
    r.line(32 + Math.cos(a) * 12, 32 + Math.sin(a) * 12, tip[0], tip[1], 'i4')
  }
  r.outline('k')
  ball(r, 32, 32, 11, ['i1', 'i2', 'i3', 'i4'])
  r.outline('k')
  for (const [x, y] of [[10, 10], [54, 10], [54, 54], [10, 54]] as const) sparkle(r, x, y, 2, 'i3', 'i4')
})

// Chain Lightning: a bolt that forks from one point to the next
icon('chain-lightning', (r) => {
  const bolt: P[] = [[8, 8], [24, 22], [18, 26], [36, 40], [30, 44], [54, 58]]
  for (let i = 0; i + 1 < bolt.length; i++) thick(r, bolt[i], bolt[i + 1], 'y2', 4)
  for (let i = 0; i + 1 < bolt.length; i++) thick(r, bolt[i], bolt[i + 1], 'y3', 1)
  // the fork
  thick(r, [24, 22], [46, 14], 'y2', 3)
  thick(r, [46, 14], [42, 20], 'y2', 2)
  thick(r, [42, 20], [56, 24], 'y2', 2)
  r.line(24, 22, 46, 14, 'y3')
  r.outline('k')
  for (const [x, y] of [[8, 8], [56, 24], [54, 58]] as const) ball(r, x, y, 3.5, ['y1', 'y2', 'y3'])
  r.outline('k')
  for (const [x, y] of [[14, 52], [52, 40], [36, 6]] as const) sparkle(r, x, y, 2, 'y2', 'y3')
})

// Blink: a swirl of arcane light, sparks thrown off
icon('blink', (r) => {
  arc(r, 32, 32, 22, 0, 300, 'v1', 4)
  arc(r, 32, 32, 22, 20, 260, 'v2', 2)
  arc(r, 32, 32, 15, 120, 420, 'v2', 3)
  arc(r, 32, 32, 15, 160, 380, 'v3', 1)
  arc(r, 32, 32, 8, 240, 540, 'v3', 2)
  r.outline('k')
  r.poly([[32, 22], [35, 29], [42, 32], [35, 35], [32, 42], [29, 35], [22, 32], [29, 29]], 'v4')
  r.set(32, 32, 's4')
  r.outline('k', ['v4'])
  for (const [x, y] of [[54, 12], [8, 18], [52, 54], [12, 52]] as const) sparkle(r, x, y, 2, 'v3', 'v4')
})

for (const [id, r] of Object.entries(out)) writeAtlas(`Skills/${id}.png`, [[r]], PAL)
console.log(`${Object.keys(out).length} active skill icons → public/assets/lsw/Skills`)
