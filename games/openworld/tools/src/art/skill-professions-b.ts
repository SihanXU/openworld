// The ranger's and the mage's deeper trees (twelve new nodes each): their new active skills, the enhancements of
// their skills (each drawn as the skill's own emblem, changed as the enhancement changes it, with a gold badge in the
// upper right), their talents and capstones — 64x64, by code, in the look of skill-actives.ts: one bold emblem on a
// clear ground, a dark outline round it, three or four tones a colour, a few bright accents.
//
//   npx tsx packages/tools/src/art/skill-professions-b.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [40, 18, 14, 255],
  s1: [78, 84, 100, 255], s2: [138, 146, 162, 255], s3: [198, 205, 216, 255], s4: [246, 248, 252, 255],
  w1: [86, 46, 26, 255], w2: [136, 80, 42, 255], w3: [188, 124, 68, 255],
  g1: [146, 92, 28, 255], g2: [212, 150, 50, 255], g3: [250, 208, 98, 255],
  r1: [116, 28, 30, 255], r2: [188, 50, 44, 255], r3: [234, 98, 72, 255],
  f1: [196, 64, 28, 255], f2: [240, 126, 38, 255], f3: [255, 196, 76, 255], f4: [255, 242, 172, 255],
  p1: [36, 104, 48, 255], p2: [76, 176, 66, 255], p3: [146, 228, 106, 255], p4: [222, 255, 190, 255],
  t1: [36, 116, 116, 255], t2: [78, 178, 168, 255], t3: [160, 232, 214, 255],
  v1: [56, 28, 86, 255], v2: [106, 58, 148, 255], v3: [168, 108, 210, 255], v4: [226, 192, 252, 255],
  i1: [46, 96, 158, 255], i2: [98, 168, 220, 255], i3: [170, 220, 246, 255], i4: [236, 250, 255, 255],
  m1: [86, 86, 94, 255], m2: [136, 136, 146, 255], m3: [188, 188, 198, 255], m4: [230, 230, 236, 255],
  y1: [198, 146, 28, 255], y2: [250, 218, 60, 255], y3: [255, 250, 182, 255],
  b1: [28, 28, 38, 255], b2: [58, 58, 74, 255], b3: [100, 100, 122, 255],
  e1: [78, 52, 38, 255], e2: [120, 84, 54, 255], e3: [166, 120, 80, 255],
  // the hawk's plumage, the mana's blue
  h1: [92, 58, 34, 255], h2: [150, 102, 62, 255], h3: [222, 196, 152, 255],
  n1: [30, 54, 128, 255], n2: [56, 102, 200, 255], n3: [120, 168, 246, 255],
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

/** An arrow from its nock to its point: a wooden shaft, a steel head, red fletching. */
function arrow(r: Raster, nock: P, point: P, head = 4, fletch = ['r2', 'r3']): void {
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

/** A five-point star (a stun's), outline left to the caller. */
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

/** The enhancement's mark: a gold disc in the upper right with an up-chevron (outlined with the rest). */
function badge(r: Raster): void {
  r.ellipse(53, 10, 7.5, 7.5, 'k')
  r.ellipse(53, 10, 6.5, 6.5, 'g1')
  r.ellipse(52.4, 9.4, 5.5, 5.5, 'g2')
  r.ellipse(51, 8, 2.4, 2.4, 'g3')
  // the chevron, twice
  for (const dy of [0, 4]) {
    r.line(49, 12 + dy - 1, 53, 8 + dy - 1, 's4', 2)
    r.line(53, 8 + dy - 1, 57, 12 + dy - 1, 's4', 2)
  }
}

/** Clear a disc (the badge's room) so nothing of the emblem runs under it. */
function clearCorner(r: Raster): void {
  for (let y = 0; y < 20; y++) for (let x = 42; x < 64; x++) if (Math.hypot(x - 53, y - 10) <= 9.5) r.set(x, y, null)
}

const out: Record<string, Raster> = {}
const icon = (id: string, draw: (r: Raster) => void) => {
  const r = new Raster(S, S)
  draw(r)
  out[id] = r
}

// ---------------------------------------------------------------- the ranger: what is shared

/** Concussive Shot's emblem: an arrow striking, a yellow ring of impact, stun stars (`stars` of them). */
function concussive(r: Raster, stars: number): void {
  for (const [rad, c] of [[16, 'y1'], [12, 'y2']] as const) arc(r, 40, 30, rad, 0, 360, c, 2)
  arc(r, 40, 30, 8, 0, 360, 'y3', 1)
  r.outline('k', ['y3'])
  arrow(r, [6, 54], [40, 30], 4)
  r.outline('k')
  const spots: P[] = [[24, 10], [42, 6], [58, 22], [56, 46], [34, 52], [14, 26]]
  for (const [x, y] of spots.slice(0, stars)) star(r, x, y, 5, 'y2', 'y3')
  r.outline('k')
}

/** Frost Bolt's emblem: an ice shard flying down to the lower right, a frosty trail behind it. */
function frostBolt(r: Raster): void {
  // the trail
  for (const [x, y, rad] of [[10, 12, 3], [16, 17, 3.5], [8, 22, 2.5], [20, 10, 2]] as const) r.ellipse(x, y, rad, rad, 'i3')
  streaks(r, [[2, 30, 8], [6, 6, 6]], ['i3', 'i2'])
  // the shard
  r.poly([[18, 22], [30, 18], [56, 48], [24, 32]], 'i2')
  r.poly([[22, 22], [30, 20], [52, 44], [26, 28]], 'i3')
  r.line(26, 22, 54, 46, 'i4')
  r.poly([[18, 22], [24, 32], [14, 30]], 'i1')
  r.outline('k', ['i3'])
  sparkle(r, 58, 54, 2, 'i3', 'i4')
}

// ---------------------------------------------------------------- the ranger: new skills

// Concussive Shot: an arrow striking home in a ring of yellow, stun stars round it
icon('concussive-shot', (r) => concussive(r, 3))

// Hawk Eye: a hawk's head in profile, its eye in a crosshair
icon('hawk-eye', (r) => {
  // the head
  r.poly([[8, 50], [10, 28], [20, 14], [36, 10], [48, 16], [52, 26], [44, 30], [40, 40], [28, 54]], 'h2')
  r.poly([[12, 44], [14, 30], [22, 18], [34, 14], [42, 18], [36, 26], [30, 40], [22, 50]], 'h3')
  // the beak, hooked
  r.poly([[48, 16], [60, 22], [58, 32], [52, 28], [52, 24]], 'g2')
  r.line(50, 18, 58, 24, 'g3')
  r.poly([[56, 30], [58, 32], [55, 34]], 'g1')
  // the brow
  r.poly([[28, 18], [44, 16], [46, 20], [32, 22]], 'h1')
  r.outline('k')
  // the eye
  ball(r, 38, 24, 4, ['y1', 'y2', 'y3'])
  r.ellipse(38.5, 24.5, 1.6, 1.6, 'k')
  // the crosshair over it
  arc(r, 38, 24, 9, 0, 360, 'r3', 1)
  for (const [a, b] of [[[38, 12], [38, 17]], [[38, 31], [38, 36]], [[26, 24], [31, 24]], [[45, 24], [50, 24]]] as [P, P][]) r.line(a[0], a[1], b[0], b[1], 'r2')
  streaks(r, [[2, 58, 10], [16, 60, 8]], ['h3', 'g3'])
})

// Arrow Storm: five arrows fanned wide, gold streaks behind them
icon('arrow-storm', (r) => {
  streaks(r, [[2, 40, 8], [4, 46, 10], [2, 52, 6]], ['g3', 'g2', 'g3'])
  const fan: P[] = [[22, 6], [42, 8], [56, 22], [58, 40], [52, 56]]
  for (const p of fan) arrow(r, [8, 50], p, 3.5, ['g2', 'g3'])
  r.outline('k', ['g2', 'g3'])
  for (const [x, y] of [[30, 4], [50, 12], [62, 32]] as const) sparkle(r, x, y, 2, 'g3', 's4')
  ball(r, 8, 50, 3.5, ['g1', 'g2', 'g3'])
  r.outline('k', ['g2', 'g3'])
})

// Light Gear: a soft leather boot with a feather tucked in it
icon('light-gear', (r) => {
  // the boot
  r.poly([[18, 22], [34, 22], [34, 42], [52, 46], [54, 54], [18, 54]], 'w2')
  r.poly([[20, 24], [30, 24], [30, 44], [48, 48], [50, 52], [20, 52]], 'w3')
  r.rect(18, 22, 16, 4, 'w1')
  r.rect(18, 50, 36, 4, 'w1')
  r.line(22, 30, 30, 30, 'w1')
  r.line(22, 36, 30, 36, 'w1')
  r.outline('k')
  // the feather
  thick(r, [26, 24], [46, 4], 'm4', 1)
  r.poly([[30, 20], [36, 10], [46, 4], [42, 14]], 'm4')
  r.poly([[32, 20], [40, 10], [46, 4], [38, 18]], 'm3')
  r.line(28, 22, 46, 4, 'g2')
  r.outline('k')
  streaks(r, [[2, 34, 10], [4, 42, 8], [2, 48, 6]], ['t3', 't2', 't3'])
})

// Deadly Shot: an arrowhead in a red burst of a critical
icon('deadly-shot', (r) => {
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6
    const len = i % 2 ? 16 : 26
    r.poly([[32 + Math.cos(a + 0.18) * 8, 32 + Math.sin(a + 0.18) * 8], [32 + Math.cos(a) * len, 32 + Math.sin(a) * len], [32 + Math.cos(a - 0.18) * 8, 32 + Math.sin(a - 0.18) * 8]], i % 2 ? 'r3' : 'r2')
  }
  r.ellipse(32, 32, 10, 10, 'r1')
  r.outline('k')
  // the arrowhead, pointing up and right
  r.poly([[22, 42], [44, 20], [38, 36]], 's2')
  r.poly([[22, 42], [44, 20], [28, 26]], 's3')
  r.line(23, 41, 43, 21, 's4')
  thick(r, [22, 42], [14, 50], 'w2', 2)
  r.outline('k')
  sparkle(r, 46, 18, 3, 'f4', 's4')
})

// Windwalker: a bow wrapped in green wind
icon('windwalker', (r) => {
  arc(r, 34, 32, 26, 200, 330, 't1', 2)
  arc(r, 30, 32, 22, 30, 150, 't2', 2)
  arc(r, 32, 32, 28, 60, 110, 't3', 1)
  // the bow, upright, bent left; the string straight
  arc(r, 44, 32, 22, 125, 235, 'w2', 3)
  arc(r, 44, 32, 22, 130, 175, 'w3', 1)
  r.line(31, 14, 31, 50, 'm4')
  r.outline('k', ['t1', 't2', 't3'])
  streaks(r, [[40, 20, 12], [42, 32, 14], [40, 44, 12]], ['t3', 't2', 't3'])
  for (const [x, y] of [[56, 12], [8, 52]] as const) sparkle(r, x, y, 2, 't3', 'p4')
})

// Marksman: a bullseye, an arrow dead in its centre, a gold laurel round it
icon('marksman', (r) => {
  // the laurel
  for (const s of [-1, 1]) {
    arc(r, 32, 34, 26, s < 0 ? 110 : 20, s < 0 ? 160 : 70, 'p1', 2)
    for (let i = 0; i < 4; i++) {
      const a = ((s < 0 ? 115 + i * 13 : 65 - i * 13) * Math.PI) / 180
      const x = 32 + Math.cos(a) * 26
      const y = 34 + Math.sin(a) * 26
      r.ellipse(x, y - 2, 2.2, 3, i % 2 ? 'g2' : 'g3')
    }
  }
  // the target
  ball(r, 32, 30, 17, ['r1', 'r2', 'r3'])
  r.ellipse(32, 30, 12, 12, 'm4')
  r.ellipse(32, 30, 7, 7, 'r2')
  r.ellipse(32, 30, 3, 3, 'g3')
  r.outline('k')
  // the arrow, its head buried in the gold
  arrow(r, [58, 6], [33, 29], 3.5)
  r.set(33, 29, 'g3')
  r.outline('k')
  sparkle(r, 8, 8, 3, 'g3', 's4')
})

// ---------------------------------------------------------------- the ranger: enhancements

// Multishot ·五连: five arrows fanned out from the one bow
icon('multishot-plus', (r) => {
  const fan: P[] = [[26, 8], [42, 14], [52, 28], [56, 42], [52, 56]]
  for (const p of fan) arrow(r, [8, 52], p, 3.5)
  clearCorner(r)
  r.outline('k')
  badge(r)
  for (const [x, y] of [[34, 6], [60, 30]] as const) sparkle(r, x, y, 2, 'g3', 's4')
})

// Leap Shot ·远: the drawn bow, a longer arc of motion behind it
icon('leap-plus', (r) => {
  arc(r, 34, 32, 28, 105, 255, 't2', 2)
  arc(r, 34, 32, 24, 115, 245, 't3', 1)
  arc(r, 34, 32, 20, 125, 235, 't1', 1)
  r.poly([[4, 54], [10, 46], [12, 54]], 't2')
  // the bow, bent toward the right; the string drawn back
  arc(r, 34, 34, 18, -70, 70, 'w2', 3)
  arc(r, 34, 34, 18, -60, -10, 'w3', 1)
  r.line(40, 17, 28, 34, 'm4')
  r.line(28, 34, 40, 51, 'm4')
  arrow(r, [26, 34], [58, 34], 4)
  clearCorner(r)
  r.outline('k', ['t1', 't2', 't3'])
  badge(r)
})

// Piercing Arrow ·破甲: the arrow through a target that cracks apart
icon('pierce-plus', (r) => {
  ball(r, 32, 34, 16, ['r1', 'r2', 'r3'])
  r.ellipse(32, 34, 11, 11, 'm4')
  r.ellipse(32, 34, 6, 6, 'r2')
  r.ellipse(31, 33, 3, 3, 'r3')
  // the cracks
  for (const [a, b] of [[[32, 34], [20, 22]], [[32, 34], [44, 48]], [[32, 34], [18, 44]], [[20, 22], [16, 24]], [[44, 48], [48, 46]]] as [P, P][]) r.line(a[0], a[1], b[0], b[1], 'k')
  r.outline('k')
  // shards flying off
  for (const [x, y] of [[10, 18], [52, 54], [8, 50]] as const) r.poly([[x, y], [x + 4, y - 2], [x + 3, y + 3]], 'r3')
  r.outline('k')
  arrow(r, [4, 52], [58, 18], 4)
  clearCorner(r)
  r.outline('k')
  badge(r)
})

// Arrow Rain ·延续: more arrows falling, slant out of the sky
icon('rain-plus', (r) => {
  for (const [x, y] of [[2, 10], [14, 22], [24, 6], [34, 20], [44, 26], [12, 2]] as const) arrow(r, [x, y], [x + 8, y + 27], 3)
  clearCorner(r)
  r.outline('k')
  r.poly([[4, 54], [60, 54], [60, 58], [4, 58]], 'e2')
  r.line(4, 54, 60, 54, 'e3')
  r.outline('k')
  badge(r)
  for (const [x, y] of [[24, 50], [58, 48]] as const) sparkle(r, x, y, 2, 'e3', 'm4')
})

// Concussive Shot ·重: the strike with more stars round it
icon('concussive-plus', (r) => {
  concussive(r, 6)
  clearCorner(r)
  badge(r)
})

// ---------------------------------------------------------------- the mage: new skills

// Frost Bolt: an ice shard flying, a frosty trail behind it
icon('frost-bolt', (r) => frostBolt(r))

// Thunderstorm: a dark cloud raining lightning
icon('thunderstorm', (r) => {
  // the bolts under it
  for (const [x, len] of [[18, 22], [34, 28], [48, 20]] as const) {
    const pts: P[] = [[x, 28], [x - 4, 28 + len * 0.4], [x + 2, 28 + len * 0.45], [x - 3, 28 + len]]
    for (let i = 0; i + 1 < pts.length; i++) thick(r, pts[i], pts[i + 1], 'y2', 3)
    for (let i = 0; i + 1 < pts.length; i++) thick(r, pts[i], pts[i + 1], 'y3', 1)
  }
  r.outline('k')
  // the cloud
  for (const [x, y, rad] of [[16, 22, 9], [28, 16, 12], [42, 18, 11], [52, 24, 8], [32, 26, 10]] as const) r.ellipse(x, y, rad, rad, 'b2')
  for (const [x, y, rad] of [[26, 13, 7], [40, 15, 6], [14, 20, 5]] as const) r.ellipse(x, y, rad, rad, 'b3')
  r.rect(8, 26, 50, 6, 'b2')
  r.line(10, 31, 56, 31, 'b1')
  r.outline('k')
  for (const [x, y] of [[8, 52], [58, 46]] as const) sparkle(r, x, y, 2, 'y2', 'y3')
})

// Meteor: a huge flaming rock falling, its fire streaming behind, gold sparks
icon('meteor', (r) => {
  // the fire trail, up and to the left
  r.poly([[30, 26], [2, 2], [14, 20], [2, 26], [22, 34], [6, 46], [30, 40]], 'f1')
  r.poly([[30, 30], [10, 10], [18, 22], [10, 30], [26, 36]], 'f2')
  r.poly([[32, 32], [18, 18], [22, 26], [26, 34]], 'f3')
  r.outline('k')
  // the rock
  r.poly([[30, 28], [44, 22], [58, 30], [60, 46], [48, 58], [32, 56], [24, 44]], 'e2')
  r.poly([[32, 30], [44, 25], [54, 31], [50, 40], [36, 42], [28, 40]], 'e3')
  r.poly([[30, 46], [44, 50], [56, 44], [48, 56], [34, 54]], 'e1')
  // molten cracks
  for (const [a, b] of [[[38, 36], [46, 44]], [[46, 44], [44, 52]], [[46, 44], [54, 40]], [[34, 46], [40, 44]]] as [P, P][]) thick(r, a, b, 'f2', 2)
  r.line(38, 36, 46, 44, 'f4')
  r.outline('k')
  for (const [x, y] of [[58, 10], [20, 58], [60, 58]] as const) sparkle(r, x, y, 3, 'g3', 'f4')
})

// Mana Surge: a blue mana orb in a swirl of energy, a small clock on it
icon('mana-surge', (r) => {
  arc(r, 32, 34, 25, 200, 470, 'n2', 2)
  arc(r, 32, 34, 21, 20, 260, 'n3', 1)
  ball(r, 32, 34, 16, ['n1', 'n2', 'n3', 'i4'])
  r.outline('k', ['n2', 'n3'])
  // the clock, lower right
  ball(r, 46, 48, 9, ['g1', 'g2', 'g3'])
  r.ellipse(46, 48, 6.5, 6.5, 'm4')
  r.line(46, 48, 46, 43, 'k')
  r.line(46, 48, 50, 48, 'k')
  r.set(46, 48, 'r2')
  r.outline('k', ['n2', 'n3'])
  for (const [x, y] of [[10, 10], [56, 16], [8, 54]] as const) sparkle(r, x, y, 2, 'n3', 'i4')
})

// Elementalist: three orbs — fire, ice, lightning — in a triangle, a thread of light between them
icon('elementalist', (r) => {
  const at: P[] = [[32, 14], [14, 46], [50, 46]]
  for (let i = 0; i < 3; i++) thick(r, at[i], at[(i + 1) % 3], 'v3', 1)
  ball(r, at[0][0], at[0][1], 10, ['f1', 'f2', 'f3', 'f4'])
  ball(r, at[1][0], at[1][1], 10, ['i1', 'i2', 'i3', 'i4'])
  ball(r, at[2][0], at[2][1], 10, ['y1', 'y2', 'y3'])
  r.outline('k', ['v3'])
  sparkle(r, 32, 36, 3, 'v4', 's4')
})

// Arcane Barrier: a purple hexagonal shield of light
icon('arcane-barrier', (r) => {
  const hex = (rad: number): P[] => Array.from({ length: 6 }, (_, i) => [32 + Math.cos(((i * 60 - 90) * Math.PI) / 180) * rad, 32 + Math.sin(((i * 60 - 90) * Math.PI) / 180) * rad * 1.05] as P)
  r.poly(hex(26), 'v1')
  r.poly(hex(23), 'v2')
  r.poly(hex(16), 'v3')
  // the honeycomb lines on it
  const h = hex(23)
  for (let i = 0; i < 6; i++) r.line(32, 32, h[i][0], h[i][1], 'v1')
  r.poly(hex(8), 'v4')
  r.line(22, 14, 14, 22, 'v4')
  r.line(24, 16, 16, 24, 's4')
  r.outline('k')
  for (const [x, y] of [[6, 8], [58, 56], [56, 8]] as const) sparkle(r, x, y, 2, 'v3', 'v4')
})

// Elemental Master: a staff crowned with a gold ring holding the three orbs
icon('elemental-master', (r) => {
  // the staff
  thick(r, [20, 60], [32, 28], 'w2', 3)
  r.line(20, 60, 32, 28, 'w3')
  r.outline('k')
  // the gold ring
  arc(r, 34, 22, 15, 0, 360, 'g2', 3)
  arc(r, 34, 22, 15, 200, 300, 'g3', 1)
  // the orbs on it
  ball(r, 34, 8, 6.5, ['f1', 'f2', 'f3', 'f4'])
  ball(r, 21, 29, 6.5, ['i1', 'i2', 'i3', 'i4'])
  ball(r, 47, 29, 6.5, ['y1', 'y2', 'y3'])
  r.outline('k')
  // the crown's points over the top orb
  for (const x of [26, 42]) r.poly([[x - 3, 12], [x, 4], [x + 3, 12]], 'g3')
  r.outline('k')
  ball(r, 34, 22, 4, ['v2', 'v3', 'v4'])
  for (const [x, y] of [[54, 50], [8, 12], [58, 10]] as const) sparkle(r, x, y, 3, 'g3', 's4')
})

// ---------------------------------------------------------------- the mage: enhancements

// Fireball ·炎爆: a bigger blaze round the ball, its tail wider
icon('fireball-plus', (r) => {
  r.poly([[34, 20], [2, 2], [16, 18], [2, 24], [20, 32], [4, 48], [28, 42]], 'f1')
  r.poly([[34, 24], [10, 10], [20, 22], [8, 30], [26, 36]], 'f2')
  r.outline('k')
  // flames licking off the ball
  for (let i = 0; i < 9; i++) {
    const a = (i * 2 * Math.PI) / 9
    r.poly([[38 + Math.cos(a + 0.3) * 14, 38 + Math.sin(a + 0.3) * 14], [38 + Math.cos(a) * 24, 38 + Math.sin(a) * 24], [38 + Math.cos(a - 0.3) * 14, 38 + Math.sin(a - 0.3) * 14]], i % 2 ? 'f2' : 'f3')
  }
  ball(r, 38, 38, 17, ['f1', 'f2', 'f3', 'f4'])
  r.ellipse(34, 34, 7, 7, 'f4')
  clearCorner(r)
  r.outline('k')
  badge(r)
})

// Frost Nova ·扩散: the burst with a second, wider ring of ice
icon('nova-plus', (r) => {
  arc(r, 32, 34, 27, 0, 360, 'i2', 2)
  arc(r, 32, 34, 27, 200, 300, 'i4', 1)
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8
    const tip: P = [32 + Math.cos(a) * 22, 34 + Math.sin(a) * 22]
    const side = (s: number): P => [32 + Math.cos(a + s) * 10, 34 + Math.sin(a + s) * 10]
    r.poly([side(0.3), tip, side(-0.3)], i % 2 ? 'i2' : 'i3')
    r.line(32 + Math.cos(a) * 10, 34 + Math.sin(a) * 10, tip[0], tip[1], 'i4')
  }
  clearCorner(r)
  r.outline('k')
  ball(r, 32, 34, 9, ['i1', 'i2', 'i3', 'i4'])
  r.outline('k')
  badge(r)
  for (const [x, y] of [[6, 6], [6, 60], [58, 60]] as const) sparkle(r, x, y, 2, 'i3', 'i4')
})

// Chain Lightning ·连锁: the bolt forking to more points
icon('chain-plus', (r) => {
  const bolt: P[] = [[6, 10], [22, 22], [16, 28], [34, 40], [28, 44], [50, 58]]
  for (let i = 0; i + 1 < bolt.length; i++) thick(r, bolt[i], bolt[i + 1], 'y2', 4)
  for (let i = 0; i + 1 < bolt.length; i++) thick(r, bolt[i], bolt[i + 1], 'y3', 1)
  // three forks
  for (const f of [[[22, 22], [38, 24], [34, 28], [46, 32]], [[34, 40], [52, 40], [48, 44], [60, 46]], [[16, 28], [8, 40], [12, 42], [4, 52]]] as P[][]) {
    for (let i = 0; i + 1 < f.length; i++) thick(r, f[i], f[i + 1], 'y2', 2)
    r.line(f[0][0], f[0][1], f[1][0], f[1][1], 'y3')
  }
  clearCorner(r)
  r.outline('k')
  for (const [x, y] of [[6, 10], [46, 32], [60, 46], [4, 52], [50, 58]] as const) ball(r, x, y, 3.2, ['y1', 'y2', 'y3'])
  r.outline('k')
  badge(r)
})

// Blink ·远: the arcane swirl, a long purple streak thrown off it
icon('blink-plus', (r) => {
  streaks(r, [[2, 50, 20], [4, 56, 14], [6, 44, 10]], ['v3', 'v2', 'v4'])
  arc(r, 38, 32, 20, 0, 300, 'v1', 4)
  arc(r, 38, 32, 20, 20, 260, 'v2', 2)
  arc(r, 38, 32, 13, 120, 420, 'v2', 3)
  arc(r, 38, 32, 13, 160, 380, 'v3', 1)
  arc(r, 38, 32, 7, 240, 540, 'v3', 2)
  clearCorner(r)
  r.outline('k', ['v2', 'v3', 'v4'])
  r.poly([[38, 23], [41, 29], [47, 32], [41, 35], [38, 41], [35, 35], [29, 32], [35, 29]], 'v4')
  r.set(38, 32, 's4')
  r.outline('k', ['v4', 'v2', 'v3'])
  badge(r)
  sparkle(r, 8, 14, 2, 'v3', 'v4')
})

// Frost Bolt ·刺骨: the shard with a snowflake on it
icon('frost-bolt-plus', (r) => {
  frostBolt(r)
  // the snowflake, lower left
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3
    r.line(14 - Math.cos(a) * 7, 48 - Math.sin(a) * 7, 14 + Math.cos(a) * 7, 48 + Math.sin(a) * 7, 'i4', 2)
  }
  r.ellipse(14, 48, 2, 2, 'i3')
  clearCorner(r)
  r.outline('k', ['i3'])
  badge(r)
})

for (const [id, r] of Object.entries(out)) writeAtlas(`Skills/${id}.png`, [[r]], PAL)
console.log(`${Object.keys(out).length} ranger and mage skill icons → public/assets/lsw/Skills`)
