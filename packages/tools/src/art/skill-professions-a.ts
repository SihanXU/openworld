// The assassin's and the warrior's new skill icons (their trees grown to twenty-two nodes each: new actives, the
// enhancements of their actives, their talents and capstones), 64x64, drawn by code in the look of the active skills'
// icons (skill-actives.ts): one bold emblem, a dark outline, three or four tones a colour, a few bright accents. An
// enhancement redraws its skill's emblem with the change it makes, and a gold up-chevron badge in the lower right.
//
//   npx tsx packages/tools/src/art/skill-professions-a.ts

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
  // green poison
  p1: [36, 104, 48, 255], p2: [76, 176, 66, 255], p3: [146, 228, 106, 255], p4: [222, 255, 190, 255],
  // teal wind
  t1: [36, 116, 116, 255], t2: [78, 178, 168, 255], t3: [160, 232, 214, 255],
  // purple shadow
  v1: [56, 28, 86, 255], v2: [106, 58, 148, 255], v3: [168, 108, 210, 255], v4: [226, 192, 252, 255],
  // ice, the guard's aura
  i1: [46, 96, 158, 255], i2: [98, 168, 220, 255], i3: [170, 220, 246, 255], i4: [236, 250, 255, 255],
  // smoke
  m1: [86, 86, 94, 255], m2: [136, 136, 146, 255], m3: [188, 188, 198, 255], m4: [230, 230, 236, 255],
  // the bomb's iron
  b1: [28, 28, 38, 255], b2: [58, 58, 74, 255], b3: [100, 100, 122, 255],
  // earth
  e1: [78, 52, 38, 255], e2: [120, 84, 54, 255], e3: [166, 120, 80, 255],
  // skin
  n1: [150, 90, 60, 255], n2: [204, 140, 100, 255], n3: [236, 184, 144, 255],
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

function sword(r: Raster, hilt: P, point: P, h: number, grip = 7, ramp: Ramp = STEEL): void {
  const len = Math.hypot(point[0] - hilt[0], point[1] - hilt[1])
  const d: P = [(point[0] - hilt[0]) / len, (point[1] - hilt[1]) / len]
  const n: P = [-d[1], d[0]]
  blade(r, hilt, point, h, ramp)
  const g = h + 3
  thick(r, [hilt[0] + n[0] * g, hilt[1] + n[1] * g], [hilt[0] - n[0] * g, hilt[1] - n[1] * g], 'g2', 2)
  r.set(hilt[0] + n[0] * g, hilt[1] + n[1] * g, 'g3')
  const end: P = [hilt[0] - d[0] * grip, hilt[1] - d[1] * grip]
  thick(r, [hilt[0] - d[0] * 2, hilt[1] - d[1] * 2], end, 'w2', 2)
  r.ellipse(end[0] - d[0], end[1] - d[1], 1.6, 1.6, 'g2')
  r.set(end[0] - d[0] - 0.6, end[1] - d[1] - 0.6, 'g3')
}

/** A throwing knife: a leaf blade and a ring at its tail, no guard. */
function knife(r: Raster, tail: P, point: P, h: number): void {
  const len = Math.hypot(point[0] - tail[0], point[1] - tail[1])
  const d: P = [(point[0] - tail[0]) / len, (point[1] - tail[1]) / len]
  const base: P = [tail[0] + d[0] * 5, tail[1] + d[1] * 5]
  blade(r, base, point, h)
  thick(r, tail, base, 'b2', 2)
  r.ellipse(tail[0], tail[1], 2, 2, 'g2')
  r.set(tail[0], tail[1], NONE)
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

/** The enhancement's mark: a round gold badge with an up-chevron, lower right (the corner itself stays clear). */
function badge(r: Raster, cx = 51, cy = 51): void {
  r.ellipse(cx, cy, 8, 8, 'k')
  ball(r, cx, cy, 7, ['g1', 'g2', 'g3'])
  thick(r, [cx - 4, cy + 2], [cx, cy - 2], 'k', 2)
  thick(r, [cx, cy - 2], [cx + 4, cy + 2], 'k', 2)
  thick(r, [cx - 4, cy + 5], [cx, cy + 1], 'f4', 1)
  thick(r, [cx, cy + 1], [cx + 4, cy + 5], 'f4', 1)
  r.line(cx - 3, cy + 1, cx, cy - 2, 'f4')
  r.line(cx, cy - 2, cx + 3, cy + 1, 'f4')
}

/** Drops of a colour (falling: a round body, a bright glint). */
function drop(r: Raster, x: number, y: number, s: number, ramp: Ramp): void {
  r.ellipse(x, y, s, s * 1.2, ramp[0])
  r.ellipse(x - s * 0.15, y, s * 0.75, s, ramp[1])
  r.poly([[x - s * 0.6, y - s * 0.5], [x, y - s * 2.4], [x + s * 0.6, y - s * 0.5]], ramp[1])
  r.set(x - s * 0.35, y - s * 0.3, ramp[2])
}

const out: Record<string, Raster> = {}
const icon = (id: string, draw: (r: Raster) => void) => {
  const r = new Raster(S, S)
  draw(r)
  out[id] = r
}

// ---------------------------------------------------------------- the base emblems the enhancements redraw

function shadowStrike(r: Raster, trail: boolean): void {
  if (trail) {
    // a longer purple trail behind the thrust
    for (const [x, y, len] of [[4, 44, 20], [6, 48, 18], [2, 52, 16], [8, 40, 10]] as const) r.line(x, y, x + len, y - len * 0.9, 'v3')
    for (const [x, y, len] of [[6, 46, 14], [4, 50, 12]] as const) r.line(x, y, x + len, y - len * 0.9, 'v4')
  }
  r.ellipse(24, 22, 9, 9, 'v1')
  r.poly([[12, 54], [16, 30], [24, 26], [32, 30], [38, 54]], 'v1')
  r.ellipse(24, 23, 6, 5, 'v2')
  r.set(21, 23, 'v4')
  r.set(26, 23, 'v4')
  r.poly([[16, 54], [19, 34], [24, 30], [22, 54]], 'v2')
  r.outline('k', ['v3', 'v4'])
  sword(r, [30, 40], [54, 14], 2.5, 6)
  r.outline('k', ['v3', 'v4'])
  sparkle(r, 56, 10, 3, 'v4', 's4')
}

function envenom(r: Raster, potent: boolean): void {
  sword(r, [16, 44], [44, 10], 3, 8)
  r.line(26, 32, 40, 16, 'p2')
  r.line(27, 33, 41, 17, 'p3')
  r.outline('k')
  const drops: [number, number, number][] = potent
    ? [[30, 36, 2.6], [36, 46, 3.2], [24, 50, 2.4], [44, 34, 2.2], [14, 56, 2]]
    : [[32, 36, 2], [36, 46, 2], [40, 54, 2.5]]
  for (const [x, y, s] of drops) drop(r, x, y, s, ['p1', 'p2', 'p4'])
  r.outline('k', ['p3'])
  if (potent) for (const [x, y] of [[54, 16], [8, 30], [50, 26]] as const) sparkle(r, x, y, 2, 'p3', 'p4')
}

function smokeBomb(r: Raster, hourglass: boolean): void {
  for (const [x, y, s] of [[14, 42, 9], [48, 40, 7], [44, 16, 7], [16, 18, 6], [30, 54, 7]] as const) {
    r.ellipse(x, y, s, s * 0.8, 'm2')
    r.ellipse(x - 2, y - 2, s * 0.65, s * 0.5, 'm3')
    r.ellipse(x - 3, y - 3, s * 0.3, s * 0.25, 'm4')
  }
  r.outline('k')
  ball(r, 30, 34, 13, ['b1', 'b2', 'b3', 'm4'])
  r.rect(27, 18, 7, 5, 'b2')
  r.rect(27, 18, 7, 2, 'b3')
  r.outline('k')
  r.line(31, 17, 34, 11, 'w2')
  r.line(34, 11, 38, 9, 'w2')
  sparkle(r, 40, 7, 3, 'f2', 'f4')
  if (hourglass) {
    // a small hourglass at the upper left: the smoke that lingers
    r.rect(4, 4, 12, 2, 'w2')
    r.rect(4, 20, 12, 2, 'w2')
    r.poly([[6, 6], [14, 6], [10, 13], [14, 20], [6, 20], [10, 13]], 'i3')
    r.poly([[7, 6], [13, 6], [10, 11]], 'g3')
    r.poly([[10, 15], [13, 20], [7, 20]], 'g2')
    r.outline('k')
  }
}

function flurry(r: Raster, angles: number[]): void {
  const hub: P = [16, 48]
  for (const a of angles) {
    const t = (a * Math.PI) / 180
    const base: P = [hub[0] + Math.cos(t) * 6, hub[1] + Math.sin(t) * 6]
    const tip: P = [hub[0] + Math.cos(t) * 38, hub[1] + Math.sin(t) * 38]
    sword(r, base, tip, 2, 5)
    r.outline('k')
  }
}

function fan(r: Raster, glint: boolean): void {
  // a ring of blades spinning out from a centre, red drops thrown off
  arc(r, 30, 30, 9, 0, 360, 'v2', 2)
  for (let i = 0; i < 7; i++) {
    const a = (i * 2 * Math.PI) / 7
    const sw = a + 0.5
    const base: P = [30 + Math.cos(a) * 8, 30 + Math.sin(a) * 8]
    const tip: P = [30 + Math.cos(sw) * 24, 30 + Math.sin(sw) * 24]
    blade(r, base, tip, 2.4, glint ? ['s1', 's3', 's4', 's4'] : STEEL)
  }
  r.outline('k')
  ball(r, 30, 30, 5, ['b2', 'b3', 'm4'])
  r.outline('k')
  for (const [x, y, s] of [[56, 14, 2], [6, 46, 2], [52, 48, 1.6]] as const) drop(r, x, y, s, ['r1', 'r2', 'r3'])
  r.outline('k')
  if (glint) for (const [x, y] of [[50, 32], [14, 8], [36, 54], [8, 24]] as const) sparkle(r, x, y, 3, 's4', 'f4')
}

function shieldBash(r: Raster, stars: boolean): void {
  r.poly([[46, 20], [50, 28], [60, 26], [52, 33], [60, 40], [50, 38], [46, 46], [44, 37], [36, 34], [44, 30]], 'f3')
  r.poly([[46, 26], [48, 30], [54, 30], [50, 33], [54, 37], [48, 36], [46, 40], [45, 35], [41, 33], [45, 31]], 'f4')
  r.outline('k')
  ball(r, 26, 32, 18, ['w1', 'w2', 'w3'])
  arc(r, 26, 32, 16, 0, 360, 's2', 2)
  arc(r, 26, 32, 16, 190, 280, 's4', 1)
  ball(r, 26, 32, 5, ['g1', 'g2', 'g3'])
  for (const a of [45, 135, 225, 315]) {
    const t = (a * Math.PI) / 180
    r.rect(26 + Math.cos(t) * 11 - 1, 32 + Math.sin(t) * 11 - 1, 2, 2, 'g2')
  }
  r.outline('k')
  if (stars) {
    // stars of a stunned head circling over it
    arc(r, 30, 10, 14, 180, 360, 'f3', 1)
    for (const [x, y] of [[16, 10], [30, 4], [44, 10]] as const) {
      r.poly([[x, y - 4], [x + 1.4, y - 1.2], [x + 4, y], [x + 1.4, y + 1.2], [x, y + 4], [x - 1.4, y + 1.2], [x - 4, y], [x - 1.4, y - 1.2]], 'g3')
      r.set(x, y, 'f4')
    }
    r.outline('k', ['f3'])
  }
}

function charge(r: Raster, long: boolean): void {
  // a lance thrust forward, a helmed head behind it
  r.poly([[16, 32], [58, 26], [16, 40]], 's2')
  r.line(18, 33, 56, 27, 's4')
  r.line(18, 39, 52, 29, 's1')
  r.poly([[14, 28], [20, 30], [20, 42], [14, 44]], 'g2')
  r.outline('k')
  r.poly([[4, 22], [16, 20], [20, 26], [20, 44], [4, 44]], 's2')
  r.poly([[6, 22], [14, 21], [16, 26], [6, 28]], 's3')
  r.rect(10, 30, 10, 3, 'k')
  r.rect(4, 40, 16, 4, 's1')
  r.poly([[6, 20], [4, 12], [10, 18]], 'r2')
  r.outline('k')
  const lines: [number, number, number][] = long
    ? [[0, 48, 16], [2, 52, 22], [0, 56, 12], [24, 46, 10], [22, 14, 14], [30, 18, 10]]
    : [[0, 48, 10], [2, 52, 14], [0, 56, 8]]
  streaks(r, lines, ['g3', 'g2', 'm3'])
  sparkle(r, 58, 22, 3, 'f3', 'f4')
}

function warCry(r: Raster, big: boolean): void {
  const rads = big ? [20, 25, 30] : [22, 27]
  for (const rad of rads) arc(r, 30, 32, rad, -50, 50, rad === rads[0] ? 'f3' : 'f2', 2)
  for (const rad of rads) arc(r, 30, 32, rad, 130, 230, rad === rads[0] ? 'f3' : 'f2', 2)
  r.poly([[18, 24], [8, 16], [6, 6], [12, 14], [22, 20]], 'm4')
  r.poly([[42, 24], [52, 16], [54, 6], [48, 14], [38, 20]], 'm4')
  r.line(8, 10, 12, 16, 'm3')
  r.line(52, 10, 48, 16, 'm3')
  r.ellipse(30, 30, 13, 12, 's2')
  r.ellipse(27, 26, 8, 6, 's3')
  r.rect(18, 34, 24, 10, 's2')
  r.rect(22, 32, 16, 3, 'k')
  r.poly([[24, 38], [36, 38], [34, 46], [26, 46]], 'r1')
  r.rect(26, 38, 8, 2, 'm4')
  r.line(30, 18, 30, 32, 'g2')
  r.outline('k', ['f2', 'f3'])
}

function quake(r: Raster, more: boolean): void {
  r.poly([[4, 48], [60, 48], [60, 58], [4, 58]], 'e2')
  r.line(4, 48, 60, 48, 'e3')
  r.poly([[26, 48], [38, 48], [34, 58], [30, 58]], 'k')
  r.line(32, 48, 20, 56, 'k')
  r.line(32, 48, 46, 56, 'k')
  r.outline('k')
  thick(r, [44, 6], [33, 32], 'w2', 3)
  r.line(44, 6, 33, 32, 'w3')
  r.poly([[18, 30], [44, 30], [46, 44], [16, 44]], 's2')
  r.rect(18, 31, 26, 3, 's3')
  r.line(19, 31, 30, 31, 's4')
  r.rect(16, 41, 30, 3, 's1')
  r.rect(29, 34, 6, 7, 'g2')
  r.outline('k')
  const shards: P[] = more
    ? [[6, 38], [10, 28], [54, 34], [50, 24], [4, 44], [14, 20], [56, 16], [20, 12]]
    : [[8, 38], [12, 30], [54, 36], [50, 28], [6, 44]]
  for (const [x, y] of shards) r.poly([[x, y], [x + 3, y - 2], [x + 4, y + 2]], 'e3')
  r.outline('k')
  for (const [x, y] of [[14, 46], [50, 46]] as const) sparkle(r, x, y, 2, 'f3', 'f4')
}

function wideSlash(r: Raster, sharp: boolean): void {
  // a wide horizontal arc, the sword at its end
  arc(r, 32, 52, 34, 200, 340, 'i2', 4)
  arc(r, 32, 52, 34, 205, 335, 'i3', 2)
  arc(r, 32, 52, 30, 215, 325, 'i4', 1)
  r.outline('k', ['i2', 'i3', 'i4'])
  sword(r, [16, 48], [56, 22], 3, 8, sharp ? ['s1', 's3', 's4', 's4'] : STEEL)
  r.outline('k', ['i2', 'i3', 'i4'])
  if (sharp) {
    sparkle(r, 54, 14, 5, 's4', 'f4')
    sparkle(r, 40, 30, 3, 's4', 'f4')
  } else sparkle(r, 58, 16, 3, 's3', 's4')
}

// ---------------------------------------------------------------- the assassin

// Throwing Knives: two knives flying, speed lines behind
icon('throwing-knives', (r) => {
  knife(r, [10, 26], [44, 12], 2.4)
  knife(r, [18, 46], [56, 34], 2.4)
  r.outline('k')
  streaks(r, [[2, 30, 6], [4, 34, 4], [6, 50, 8], [8, 54, 6], [2, 22, 5]], ['m3', 'm4', 's3'])
  sparkle(r, 50, 8, 2, 's4', 'f4')
  sparkle(r, 60, 30, 2, 's4', 'f4')
})

// Fan of Knives: a ring of blades spinning out, red drops thrown off
icon('fan-of-knives', (r) => fan(r, false))

// Vanishing Strikes: three shadow silhouettes cutting, X marks of the cuts
icon('vanishing-strikes', (r) => {
  for (const [cx, dark] of [[14, 'v1'], [32, 'v2'], [50, 'v1']] as const) {
    r.ellipse(cx, 22, 6, 6, dark)
    r.poly([[cx - 8, 50], [cx - 5, 30], [cx, 27], [cx + 5, 30], [cx + 8, 50]], dark)
    r.set(cx - 2, 22, 'v4')
    r.set(cx + 2, 22, 'v4')
  }
  r.outline('k')
  // the X of the cuts across them
  thick(r, [6, 12], [58, 52], 'v4', 2)
  thick(r, [58, 12], [6, 52], 'v4', 2)
  r.line(6, 12, 58, 52, 's4')
  r.line(58, 12, 6, 52, 's4')
  for (const [x, y] of [[32, 6], [6, 32], [58, 32], [32, 58]] as const) sparkle(r, x, y, 3, 'v3', 'v4')
})

icon('shadow-mastery', (r) => {
  shadowStrike(r, true)
  badge(r)
})

icon('potent-venom', (r) => {
  envenom(r, true)
  badge(r)
})

icon('lingering-smoke', (r) => {
  smokeBomb(r, true)
  badge(r)
})

icon('flurry-plus', (r) => {
  flurry(r, [-85, -68, -51, -34, -17, 0])
  for (const [x, y] of [[52, 14], [44, 4]] as const) sparkle(r, x, y, 2, 's3', 's4')
  badge(r)
})

icon('fan-plus', (r) => {
  fan(r, true)
  badge(r)
})

// Venom Mastery: a dagger over a drop of blood, a green poison skull
icon('venom-mastery', (r) => {
  drop(r, 22, 40, 10, ['r1', 'r2', 'r3'])
  r.outline('k')
  // the skull, green
  r.ellipse(42, 22, 10, 9, 'p2')
  r.rect(36, 28, 12, 6, 'p2')
  r.ellipse(40, 20, 6, 4, 'p3')
  r.ellipse(38, 24, 2.4, 2.4, 'p1')
  r.ellipse(46, 24, 2.4, 2.4, 'p1')
  r.set(42, 28, 'p1')
  for (const x of [38, 41, 44]) r.line(x, 31, x, 33, 'p1')
  r.outline('k')
  sword(r, [10, 58], [52, 8], 2.4, 6)
  r.outline('k')
  for (const [x, y] of [[56, 40], [8, 18]] as const) sparkle(r, x, y, 2, 'p3', 'p4')
})

// Nightstalker: a crescent moon over a hooded figure's glowing eyes
icon('nightstalker', (r) => {
  r.ellipse(44, 18, 13, 13, 'g3')
  r.ellipse(50, 13, 11, 11, NONE)
  r.ellipse(40, 20, 3, 4, 'f4')
  r.outline('k')
  r.ellipse(26, 36, 16, 14, 'v1')
  r.poly([[8, 60], [12, 40], [26, 34], [40, 40], [44, 60]], 'v1')
  r.ellipse(26, 38, 11, 9, 'b1')
  r.poly([[12, 32], [20, 22], [26, 20], [32, 22], [40, 32], [26, 28]], 'v2')
  r.outline('k')
  for (const x of [21, 31]) {
    r.rect(x - 1, 37, 4, 2, 'v4')
    r.set(x, 37, 's4')
  }
  for (const [x, y] of [[8, 10], [20, 6], [58, 36], [56, 52]] as const) sparkle(r, x, y, 1, 'v3', 'v4')
})

// Nimble Blade: a dagger with fading after-images, a feather
icon('nimble-blade', (r) => {
  for (const [dx, c] of [[-14, 'v2'], [-7, 'v3']] as const) {
    r.poly([[18 + dx, 50], [46 + dx, 14], [50 + dx, 18], [22 + dx, 54]], c)
  }
  sword(r, [20, 50], [52, 12], 2.6, 7)
  r.outline('k', ['v2', 'v3'])
  // the feather
  r.poly([[40, 58], [46, 46], [56, 38], [60, 40], [54, 50], [44, 58]], 'm4')
  r.line(40, 60, 58, 39, 'm2')
  for (const t of [0.3, 0.5, 0.7]) r.line(40 + 18 * t, 60 - 21 * t, 40 + 18 * t + 3, 60 - 21 * t + 2, 'm3')
  r.outline('k', ['v2', 'v3'])
  sparkle(r, 56, 8, 2, 's4', 'f4')
})

// Master Assassin: a crowned dagger in a ring of purple shadow, gold accents
icon('master-assassin', (r) => {
  arc(r, 32, 34, 23, 0, 360, 'v1', 4)
  arc(r, 32, 34, 23, 200, 340, 'v3', 2)
  arc(r, 32, 34, 19, 20, 160, 'v2', 2)
  r.outline('k', [])
  sword(r, [32, 54], [32, 20], 3.2, 7)
  r.outline('k')
  // the crown over its point
  r.poly([[20, 16], [24, 6], [28, 12], [32, 3], [36, 12], [40, 6], [44, 16]], 'g2')
  r.rect(20, 14, 25, 4, 'g1')
  r.line(21, 14, 43, 14, 'g3')
  for (const x of [24, 32, 40]) r.set(x, 16, 'r3')
  r.set(32, 5, 'f4')
  r.outline('k', ['v1', 'v2', 'v3'])
  for (const [x, y] of [[8, 14], [56, 14], [10, 56], [54, 56]] as const) sparkle(r, x, y, 2, 'g3', 'f4')
})

// ---------------------------------------------------------------- the warrior

icon('wide-slash', (r) => wideSlash(r, false))

// Iron Guard: a great tower shield in a blue ring of guard
icon('iron-guard', (r) => {
  r.ellipse(32, 32, 28, 28, 'i2')
  r.ellipse(32, 32, 26, 26, 'i3')
  r.ellipse(32, 32, 24, 24, NONE)
  r.outline('k', ['i2', 'i3'])
  r.poly([[16, 10], [48, 10], [48, 40], [32, 56], [16, 40]], 's2')
  r.poly([[19, 13], [32, 13], [32, 52], [19, 39]], 's3')
  r.line(19, 13, 31, 13, 's4')
  r.rect(30, 10, 4, 46, 'g2')
  r.rect(16, 24, 32, 4, 'g2')
  r.rect(30, 24, 4, 4, 'g3')
  for (const [x, y] of [[20, 14], [44, 14], [20, 36], [44, 36]] as const) r.rect(x, y, 2, 2, 'g3')
  r.outline('k', ['i2', 'i3'])
  for (const [x, y] of [[6, 10], [58, 12], [8, 54], [56, 52]] as const) sparkle(r, x, y, 2, 'i3', 'i4')
})

// Heaven Splitter: a giant sword coming down, the ground breaking in a shockwave, gold rays
icon('heaven-splitter', (r) => {
  for (const a of [-150, -120, -90, -60, -30]) {
    const t = (a * Math.PI) / 180
    r.line(32 + Math.cos(t) * 10, 48 + Math.sin(t) * 10, 32 + Math.cos(t) * 34, 48 + Math.sin(t) * 34, 'g3')
  }
  r.poly([[2, 50], [62, 50], [62, 60], [2, 60]], 'e2')
  r.line(2, 50, 62, 50, 'e3')
  r.outline('k', ['g3'])
  for (const [a, b] of [[[32, 50], [12, 58]], [[32, 50], [52, 58]], [[32, 50], [30, 60]], [[22, 54], [16, 50]]] as [P, P][]) r.line(a[0], a[1], b[0], b[1], 'k')
  // the shockwave at its foot
  arc(r, 32, 50, 16, 180, 360, 'f3', 2)
  arc(r, 32, 50, 22, 190, 350, 'f2', 1)
  sword(r, [32, 10], [32, 52], 4.6, 8)
  r.outline('k', ['g3', 'f2', 'f3'])
  for (const [x, y] of [[10, 34], [54, 34]] as const) sparkle(r, x, y, 3, 'g3', 'f4')
})

icon('bash-plus', (r) => {
  shieldBash(r, true)
  badge(r)
})

icon('charge-plus', (r) => {
  charge(r, true)
  badge(r)
})

icon('war-cry-plus', (r) => {
  warCry(r, true)
  badge(r)
})

icon('quake-plus', (r) => {
  quake(r, true)
  badge(r, 51, 12)
})

icon('slash-plus', (r) => {
  wideSlash(r, true)
  badge(r, 12, 12)
})

// Shield Wall: two shields side by side, the left laid over the right one's edge
icon('shield-wall', (r) => {
  const shield = (x: number, y: number) => {
    r.poly([[x, y], [x + 22, y], [x + 22, y + 28], [x + 11, y + 42], [x, y + 28]], 'w2')
    r.poly([[x + 2, y + 2], [x + 11, y + 2], [x + 11, y + 38], [x + 2, y + 27]], 'w3')
    r.rect(x, y, 22, 3, 's2')
    r.line(x, y, x + 22, y, 's3')
    r.rect(x + 9, y + 10, 5, 5, 'g2')
    r.set(x + 10, y + 11, 'g3')
  }
  shield(32, 8)
  r.outline('k')
  shield(12, 14)
  // its edge over the other's face
  r.line(34, 14, 34, 42, 'k')
  r.line(34, 42, 23, 56, 'k')
  r.outline('k')
  for (const [x, y] of [[6, 8], [60, 4]] as const) sparkle(r, x, y, 2, 's3', 's4')
})

// Bloodthirst: a sword, a red heart drawing blood into it
icon('bloodthirst', (r) => {
  // the heart
  r.ellipse(38, 22, 8, 7, 'r2')
  r.ellipse(52, 22, 8, 7, 'r2')
  r.poly([[30, 24], [60, 24], [45, 42]], 'r2')
  r.ellipse(36, 20, 4, 3, 'r3')
  r.set(35, 19, 'f4')
  r.outline('k')
  sword(r, [10, 58], [38, 30], 3, 7)
  r.outline('k')
  // blood running from the blade into the heart
  for (const [x, y, s] of [[28, 32, 1.8], [22, 26, 1.4], [14, 30, 1.6]] as const) drop(r, x, y, s, ['r1', 'r2', 'r3'])
  r.outline('k')
  sparkle(r, 58, 40, 2, 'r3', 'f4')
})

// Fortitude: a sturdy breastplate, a red heart at its centre
icon('fortitude', (r) => {
  r.poly([[12, 12], [24, 8], [32, 12], [40, 8], [52, 12], [54, 26], [48, 48], [32, 56], [16, 48], [10, 26]], 's2')
  r.poly([[14, 14], [24, 10], [30, 14], [30, 52], [18, 46], [12, 26]], 's3')
  r.line(32, 12, 32, 54, 's1')
  r.line(16, 14, 24, 11, 's4')
  // the heart on it
  r.ellipse(28, 28, 5, 4.5, 'r2')
  r.ellipse(36, 28, 5, 4.5, 'r2')
  r.poly([[23, 29], [41, 29], [32, 40]], 'r2')
  r.set(26, 27, 'r3')
  r.set(27, 26, 'f4')
  r.outline('k')
  for (const [x, y] of [[6, 8], [58, 8], [56, 50]] as const) sparkle(r, x, y, 2, 'g3', 'f4')
})

// Undying Spirit: a helmed spirit wreathed in flame, gold accents
icon('undying-spirit', (r) => {
  r.poly([[12, 50], [6, 28], [14, 34], [12, 16], [22, 26], [26, 6], [32, 20], [38, 6], [42, 26], [52, 16], [50, 34], [58, 28], [52, 50]], 'f1')
  r.poly([[16, 50], [12, 34], [20, 38], [20, 22], [28, 30], [32, 16], [36, 30], [44, 22], [44, 38], [52, 34], [48, 50]], 'f2')
  r.poly([[22, 50], [20, 40], [28, 42], [32, 30], [36, 42], [44, 40], [42, 50]], 'f3')
  r.outline('k')
  r.ellipse(32, 38, 12, 11, 's2')
  r.ellipse(29, 34, 7, 5, 's3')
  r.rect(22, 40, 20, 10, 's2')
  r.rect(24, 38, 16, 3, 'k')
  r.rect(26, 38, 3, 2, 'f4')
  r.rect(35, 38, 3, 2, 'f4')
  r.line(32, 27, 32, 38, 'g2')
  r.rect(22, 48, 20, 3, 'g2')
  r.line(22, 48, 41, 48, 'g3')
  r.outline('k')
  for (const [x, y] of [[6, 54], [58, 54], [32, 58]] as const) sparkle(r, x, y, 2, 'g3', 'f4')
})

for (const [id, r] of Object.entries(out)) writeAtlas(`Skills/${id}.png`, [[r]], PAL)
console.log(`${Object.keys(out).length} assassin and warrior skill icons → public/assets/lsw/Skills`)
