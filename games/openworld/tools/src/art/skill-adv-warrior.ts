// The warrior's advancement icons (docs/advancement.md): its three paths' skills, its mastery's and the four more of its
// first tree, and the paths' and the mastery's entrances, 64x64, drawn by code in the look of the other skill icons
// (skill-actives.ts, skill-professions-a.ts): one bold emblem, a dark outline, three or four tones a colour, a few bright
// accents. Each path has its colours: the Sentinel steel and blue, the Berserker blood red and dark iron, the
// Thornknight white enamel and thorn green; the mastery (the Paragon) gold.
//
//   npx tsx games/openworld/tools/src/art/skill-adv-warrior.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [40, 18, 14, 255],
  // steel
  s1: [78, 84, 100, 255], s2: [138, 146, 162, 255], s3: [198, 205, 216, 255], s4: [246, 248, 252, 255],
  // wood and leather
  w1: [86, 46, 26, 255], w2: [136, 80, 42, 255], w3: [188, 124, 68, 255],
  // gold
  g1: [146, 92, 28, 255], g2: [212, 150, 50, 255], g3: [250, 208, 98, 255], g4: [255, 242, 172, 255],
  // red, blood
  r1: [116, 28, 30, 255], r2: [188, 50, 44, 255], r3: [234, 98, 72, 255],
  // the Sentinel's blue
  u1: [30, 48, 98, 255], u2: [52, 84, 150, 255], u3: [96, 136, 200, 255], u4: [170, 206, 240, 255],
  // the Thornknight's white enamel and thorn green
  y1: [168, 160, 146, 255], y2: [218, 212, 196, 255], y3: [244, 240, 228, 255],
  h1: [28, 60, 36, 255], h2: [52, 102, 56, 255], h3: [98, 152, 82, 255],
  // dark iron
  b1: [28, 28, 38, 255], b2: [58, 58, 74, 255], b3: [100, 100, 122, 255],
  // earth and stone
  e1: [78, 52, 38, 255], e2: [120, 84, 54, 255], e3: [166, 120, 80, 255],
  // the guard's light
  i3: [170, 220, 246, 255], i4: [236, 250, 255, 255],
  // a heal
  p2: [76, 176, 66, 255], p3: [146, 228, 106, 255],
}

const S = 64
type P = [number, number]
type Ramp = [string, string, string, string?]
const STEEL: Ramp = ['s1', 's2', 's3', 's4']
const BLUE: Ramp = ['u1', 'u2', 'u3', 'u4']
const WHITE: Ramp = ['y1', 'y2', 'y3', 's4']
const GOLD: Ramp = ['g1', 'g2', 'g3', 'g4']

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

function ball(r: Raster, cx: number, cy: number, rad: number, ramp: Ramp): void {
  r.ellipse(cx, cy, rad, rad, ramp[0])
  r.ellipse(cx - rad * 0.12, cy - rad * 0.12, rad * 0.82, rad * 0.82, ramp[1])
  r.ellipse(cx - rad * 0.3, cy - rad * 0.3, rad * 0.5, rad * 0.5, ramp[2])
  if (ramp[3]) r.ellipse(cx - rad * 0.42, cy - rad * 0.42, Math.max(1, rad * 0.18), Math.max(1, rad * 0.18), ramp[3])
}

function sparkle(r: Raster, x: number, y: number, s: number, c: string, core = c): void {
  r.line(x - s, y, x + s, y, c)
  r.line(x, y - s, x, y + s, c)
  r.set(x, y, core)
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

function sword(r: Raster, hilt: P, point: P, h: number, grip = 7, ramp: Ramp = STEEL, guard = 'g2'): void {
  const len = Math.hypot(point[0] - hilt[0], point[1] - hilt[1])
  const d: P = [(point[0] - hilt[0]) / len, (point[1] - hilt[1]) / len]
  const n: P = [-d[1], d[0]]
  blade(r, hilt, point, h, ramp)
  const g = h + 3
  thick(r, [hilt[0] + n[0] * g, hilt[1] + n[1] * g], [hilt[0] - n[0] * g, hilt[1] - n[1] * g], guard, 2)
  const end: P = [hilt[0] - d[0] * grip, hilt[1] - d[1] * grip]
  thick(r, [hilt[0] - d[0] * 2, hilt[1] - d[1] * 2], end, 'w2', 2)
  r.ellipse(end[0] - d[0], end[1] - d[1], 1.6, 1.6, 'g2')
}

/** A tall tower shield, round-topped: its field, a rim, a boss or an emblem the caller adds. */
function tower(r: Raster, x: number, y: number, w: number, h: number, field: Ramp, rim: Ramp = STEEL): void {
  const top = Math.round(w / 2)
  r.ellipse(x + w / 2, y + top, w / 2, top, rim[1])
  r.rect(x, y + top, w + 1, h - top, rim[1])
  r.ellipse(x + w / 2, y + top + 1, w / 2 - 2, top - 2, field[1])
  r.rect(x + 2, y + top, w - 3, h - top - 2, field[1])
  // the light down its left, the shade down its right
  r.rect(x + 3, y + top, 2, h - top - 4, field[2])
  r.rect(x + w - 5, y + top, 2, h - top - 3, field[0])
  r.line(x + 1, y + top, x + 1, y + h - 1, rim[2])
  r.line(x + 1, y + h - 1, x + w, y + h - 1, rim[0])
}

/** A kite shield, point down. */
function kite(r: Raster, cx: number, top: number, w: number, h: number, field: Ramp, rim: Ramp = STEEL): void {
  const half = w / 2
  r.poly([[cx - half, top], [cx + half, top], [cx + half, top + h * 0.45], [cx, top + h], [cx - half, top + h * 0.45]], rim[1])
  r.poly([[cx - half + 2, top + 2], [cx + half - 2, top + 2], [cx + half - 2, top + h * 0.45], [cx, top + h - 3], [cx - half + 2, top + h * 0.45]], field[1])
  r.poly([[cx - half + 3, top + 3], [cx - half + 6, top + 3], [cx - half + 6, top + h * 0.5], [cx - half + 3, top + h * 0.43]], field[2])
  r.poly([[cx + 2, top + 3], [cx + half - 3, top + 3], [cx + half - 3, top + h * 0.44], [cx + 1, top + h - 5]], field[0])
  r.line(cx - half, top, cx + half, top, rim[2])
}

/** A vine of thorns along a path: a stem, a spike now and then to either side. */
function thorns(r: Raster, pts: P[], stem = 'h2', spike = 'h1', every = 4): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const d: P = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
    const n: P = [-d[1], d[0]]
    thick(r, a, b, stem, 2)
    for (let t = 2; t < len; t += every) {
      const side = Math.floor(t / every) % 2 ? 1 : -1
      const base: P = [a[0] + d[0] * t, a[1] + d[1] * t]
      r.poly([[base[0] - d[0], base[1] - d[1]], [base[0] + d[0], base[1] + d[1]], [base[0] + n[0] * side * 4 + d[0] * 2, base[1] + n[1] * side * 4 + d[1] * 2]], spike)
    }
  }
}

/** A crown of thorns seen a little from above: a ring of twisted stems, spikes out, a few red drops. */
function thornCrown(r: Raster, cx: number, cy: number, rx: number, ry: number, drops = true): void {
  const pts: P[] = []
  for (let a = 0; a <= 360; a += 15) pts.push([cx + Math.cos((a * Math.PI) / 180) * rx, cy + Math.sin((a * Math.PI) / 180) * ry])
  thorns(r, pts, 'h2', 'h1', 3)
  arc(r, cx, cy, rx - 2, 190, 340, 'h3', 1)
  if (drops) for (const [x, y] of [[cx - rx * 0.6, cy + ry + 2], [cx + rx * 0.3, cy + ry + 3]] as P[]) (r.ellipse(x, y, 1.4, 2, 'r2'), r.set(x, y - 1, 'r3'))
}

/** A greataxe: a haft and a crescent head. */
function axe(r: Raster, foot: P, head: P, ramp: Ramp = STEEL, haft = 'w2'): void {
  thick(r, foot, head, haft, 3)
  const len = Math.hypot(head[0] - foot[0], head[1] - foot[1])
  const d: P = [(head[0] - foot[0]) / len, (head[1] - foot[1]) / len]
  const n: P = [-d[1], d[0]]
  const c: P = [head[0] - d[0] * 6, head[1] - d[1] * 6]
  const at = (t: number, o: number): P => [c[0] + d[0] * t + n[0] * o, c[1] + d[1] * t + n[1] * o]
  r.poly([at(-4, 2), at(-9, 13), at(-2, 15), at(4, 15), at(10, 12), at(5, 2)], ramp[1])
  r.poly([at(-7, 12), at(-2, 14), at(4, 14), at(8, 11.5), at(4, 10), at(-3, 10.5)], ramp[2])
  thick(r, at(-8, 13), at(9, 12), ramp[3] ?? ramp[2], 1)
  r.poly([at(-3, -1), at(4, -1), at(3, 3), at(-2, 3)], ramp[0])
}

/** A gauntlet, fingers up (a closed fist when `fist`). */
function gauntlet(r: Raster, x: number, y: number, ramp: Ramp = STEEL, cuff = 'u2', fist = false): void {
  if (fist) {
    r.rect(x, y, 18, 14, ramp[1])
    for (let i = 0; i < 4; i++) (r.rect(x + 1 + i * 4, y - 3, 4, 5, ramp[1]), r.line(x + 1 + i * 4, y - 3, x + 3 + i * 4, y - 3, ramp[2]))
    r.rect(x - 4, y + 3, 6, 8, ramp[1])
    r.line(x + 1, y + 4, x + 16, y + 4, ramp[2])
    r.line(x + 1, y + 13, x + 17, y + 13, ramp[0])
  } else {
    for (let i = 0; i < 4; i++) (r.rect(x + 1 + i * 4, y - 10 + Math.abs(1.5 - i) * 2, 3, 12, ramp[1]), r.line(x + 1 + i * 4, y - 10 + Math.abs(1.5 - i) * 2, x + 1 + i * 4, y, ramp[2]))
    r.rect(x, y, 17, 12, ramp[1])
    r.poly([[x - 6, y + 2], [x, y], [x, y + 8], [x - 4, y + 6]], ramp[1])
    r.line(x + 1, y + 2, x + 15, y + 2, ramp[2])
  }
  r.rect(x - 1, y + 14, 20, 8, cuff)
  r.line(x - 1, y + 14, x + 18, y + 14, 'g2')
  r.line(x - 1, y + 21, x + 18, y + 21, 'k')
}

/** A closed helm (a slit, rivets). */
function helm(r: Raster, cx: number, cy: number, ramp: Ramp = STEEL): void {
  r.ellipse(cx, cy - 2, 13, 12, ramp[1])
  r.rect(cx - 13, cy - 2, 27, 14, ramp[1])
  r.ellipse(cx - 4, cy - 7, 6, 4, ramp[2])
  r.rect(cx - 13, cy + 10, 27, 3, ramp[0])
  r.rect(cx - 10, cy + 1, 21, 3, 'k')
  r.line(cx, cy - 13, cx, cy + 12, ramp[2])
  for (const x of [cx - 9, cx + 9]) r.set(x, cy + 7, ramp[3] ?? ramp[2])
}

/** A key drawn to cut a hole (a chain link's eye): cleared once the icon is drawn. */
const NONE_KEY = 'hole'
/** The pictures this file draws, and no other (every one new: none of these was drawn before it). */
const MINE = new Set([
  'shieldbearer', 'bastion', 'challenge', 'retort', 'unyielding', 'aegis',
  'blood-fury', 'blood-rage', 'reaving-spin', 'carnage', 'pain-eater', 'leap-of-ruin',
  'thorned-mail', 'kneel', 'briar-line', 'crowns-due', 'hold-the-line', 'crown-of-thorns',
  'iron-body', 'unbreakable-will', 'weapon-master', 'godslayer', 'living-legend',
  'hamstring', 'sunder', 'battle-hardened', 'sword-mastery',
  'path-sentinel', 'path-berserker', 'path-thornknight', 'mastery-warrior',
])

const out: Record<string, Raster> = {}
const icon = (id: string, draw: (r: Raster) => void) => {
  const r = new Raster(S, S)
  draw(r)
  for (let i = 0; i < r.px.length; i++) if (r.px[i] === NONE_KEY) r.px[i] = null
  out[id] = r
}

// ------------------------------------------------------------------ the Sentinel: steel and blue

// Shieldbearer: a steel gauntlet gripping the rim of a blue tower shield seen from the side, its strap and boss
icon('shieldbearer', (r) => {
  r.poly([[30, 6], [44, 10], [46, 54], [32, 58]], 'u1')
  r.poly([[32, 8], [42, 12], [43, 52], [33, 55]], 'u2')
  r.line(33, 10, 34, 54, 'u3')
  r.line(30, 6, 32, 58, 's2')
  ball(r, 39, 32, 4, GOLD)
  r.outline('k')
  gauntlet(r, 12, 30, STEEL, 'u2', true)
  thick(r, [28, 34], [34, 30], 'w2', 3)
  r.outline('k')
  for (const [x, y] of [[52, 14], [54, 46]] as P[]) sparkle(r, x, y, 2, 'u4', 's4')
})

// Bastion: a blue tower shield face-on, arrows snapping off its face
icon('bastion', (r) => {
  tower(r, 20, 10, 26, 44, BLUE)
  ball(r, 33, 32, 5, GOLD)
  r.outline('k')
  for (const [a, b] of [[[4, 18], [16, 24]], [[2, 34], [16, 34]], [[6, 50], [17, 43]]] as [P, P][]) {
    thick(r, a, b, 'w2', 2)
    r.poly([[b[0], b[1] - 2], [b[0] + 3, b[1]], [b[0], b[1] + 2]], 's3')
  }
  for (const [x, y] of [[50, 16], [54, 30], [50, 46]] as P[]) (thick(r, [x, y], [x + 6, y - 3], 'w2', 2), r.set(x + 7, y - 4, 's3'))
  r.outline('k', ['u4', 'i4'])
  for (const [x, y] of [[18, 20], [18, 34], [18, 46]] as P[]) sparkle(r, x, y, 2, 'i3', 'i4')
})

// Challenge: a steel gauntlet thrown down, its blue cuff, the dust where it struck
icon('challenge', (r) => {
  r.poly([[12, 50], [52, 50], [56, 56], [8, 56]], 'e2')
  r.line(9, 55, 55, 55, 'e1')
  gauntlet(r, 24, 22, STEEL, 'u2')
  r.outline('k')
  for (const [x, y] of [[10, 44], [54, 42], [16, 36], [50, 32]] as P[]) (r.rect(x, y, 3, 2, 'e3'), r.set(x + 1, y - 1, 'e2'))
  for (const [a, b] of [[[8, 20], [14, 26]], [[56, 18], [50, 24]], [[32, 4], [32, 10]]] as [P, P][]) thick(r, a, b, 'g3', 2)
  r.outline('k', ['g3', 'e3', 'e2'])
})

// Retort: a blue shield, a gold arrow striking it and curving back the way it came
icon('retort', (r) => {
  kite(r, 22, 10, 24, 42, BLUE)
  r.outline('k')
  arc(r, 40, 30, 14, -110, 110, 'g2', 3)
  arc(r, 40, 30, 14, -100, 40, 'g3', 1)
  const tip: P = [40 + Math.cos((110 * Math.PI) / 180) * 14, 30 + Math.sin((110 * Math.PI) / 180) * 14]
  r.poly([[tip[0] - 5, tip[1] - 1], [tip[0] + 3, tip[1] - 5], [tip[0] + 2, tip[1] + 4]], 'g3')
  r.outline('k', ['g3'])
  sparkle(r, 36, 14, 3, 'g3', 'g4')
})

// Unyielding: a blue shield planted upright in cracked ground, chipped, still standing
icon('unyielding', (r) => {
  r.poly([[6, 50], [58, 50], [60, 58], [4, 58]], 'e2')
  for (const [a, b] of [[[32, 50], [22, 58]], [[32, 50], [44, 58]], [[20, 52], [12, 56]]] as [P, P][]) thick(r, a, b, 'e1', 1)
  tower(r, 20, 6, 24, 46, BLUE)
  r.poly([[44, 14], [40, 18], [44, 22]], 'k')
  r.poly([[20, 30], [24, 33], [20, 36]], 'k')
  r.line(32, 20, 28, 32, 'u1')
  r.line(28, 32, 31, 40, 'u1')
  r.outline('k')
  for (const [x, y] of [[50, 40], [14, 44]] as P[]) (r.ellipse(x, y, 1.4, 2, 'r2'), r.set(x, y - 1, 'r3'))
  for (const [x, y] of [[8, 46], [56, 44], [36, 48]] as P[]) r.rect(x, y, 3, 2, 'e3')
  r.outline('k', ['e3'])
})

// Aegis: a round gold shield, a sun on its boss, inside a dome of pale hexagons
icon('aegis', (r) => {
  for (const [cx, cy] of [[32, 6], [20, 12], [44, 12], [10, 22], [54, 22], [8, 36], [56, 36], [12, 50], [52, 50]] as P[]) {
    const pts: P[] = []
    for (let a = 0; a < 360; a += 60) pts.push([cx + Math.cos((a * Math.PI) / 180) * 5, cy + Math.sin((a * Math.PI) / 180) * 5])
    for (let i = 0; i < 6; i++) r.line(pts[i][0], pts[i][1], pts[(i + 1) % 6][0], pts[(i + 1) % 6][1], 'i3')
  }
  r.ellipse(32, 34, 17, 17, 'g1')
  r.ellipse(32, 34, 15, 15, 'u2')
  r.ellipse(30, 32, 10, 10, 'u3')
  ball(r, 32, 34, 7, GOLD)
  for (let a = 0; a < 360; a += 45) {
    const c = Math.cos((a * Math.PI) / 180)
    const s = Math.sin((a * Math.PI) / 180)
    thick(r, [32 + c * 8, 34 + s * 8], [32 + c * 13, 34 + s * 13], 'g2', 2)
  }
  r.outline('k', ['i3'])
  for (const [x, y] of [[32, 56], [4, 8], [60, 8]] as P[]) sparkle(r, x, y, 2, 'i3', 'i4')
})

// ------------------------------------------------------------------ the Berserker: blood red and dark iron

// Blood Fury: a great clenched steel fist, a red aura round it like flame
icon('blood-fury', (r) => {
  r.poly([[8, 58], [4, 30], [12, 36], [10, 14], [20, 24], [24, 4], [32, 18], [40, 4], [44, 24], [54, 14], [52, 36], [60, 30], [56, 58]], 'r1')
  r.poly([[14, 58], [10, 38], [18, 42], [18, 24], [26, 32], [32, 16], [38, 32], [46, 24], [46, 42], [54, 38], [50, 58]], 'r2')
  r.outline('k')
  // the fist: four knuckles, the thumb across, a red cuff
  r.rect(18, 26, 28, 20, 's2')
  for (let i = 0; i < 4; i++) (r.ellipse(21 + i * 7, 26, 3.5, 3, 's3'), r.set(20 + i * 7, 25, 's4'))
  r.poly([[16, 34], [30, 34], [30, 40], [16, 42]], 's3')
  r.line(17, 35, 29, 35, 's4')
  for (let i = 1; i < 4; i++) r.line(18 + i * 7, 28, 18 + i * 7, 33, 's1')
  r.rect(20, 46, 24, 10, 'r1')
  r.line(20, 46, 43, 46, 'g2')
  r.outline('k')
  for (const [x, y] of [[8, 8], [56, 8]] as P[]) sparkle(r, x, y, 2, 'r3', 'g4')
})

// Blood Rage: a great drop of blood with two narrowed, burning eyes in it
icon('blood-rage', (r) => {
  r.ellipse(32, 38, 18, 18, 'r1')
  r.poly([[15, 32], [32, 4], [49, 32]], 'r1')
  r.ellipse(30, 37, 15, 15, 'r2')
  r.poly([[18, 30], [32, 8], [44, 30]], 'r2')
  r.ellipse(24, 30, 4, 7, 'r3')
  r.poly([[20, 36], [30, 40], [30, 44], [20, 42]], 'k')
  r.poly([[44, 36], [34, 40], [34, 44], [44, 42]], 'k')
  r.rect(25, 41, 3, 2, 'g4')
  r.rect(36, 41, 3, 2, 'g4')
  r.outline('k')
  for (const [x, y] of [[8, 50], [56, 50], [54, 14]] as P[]) (r.ellipse(x, y, 2, 2.6, 'r2'), r.set(x, y - 1, 'r3'))
  r.outline('k', ['r3'])
})

// Reaving Spin: a red-bladed greataxe swung round, a spiral of blood behind it
icon('reaving-spin', (r) => {
  arc(r, 32, 32, 26, 120, 380, 'r2', 3)
  arc(r, 32, 32, 20, 160, 400, 'r1', 2)
  arc(r, 32, 32, 26, 300, 380, 'r3', 1)
  axe(r, [18, 46], [44, 20], ['b1', 'r2', 'r3', 's4'], 'w1')
  r.outline('k', ['r1'])
  sparkle(r, 54, 54, 2, 'r3', 'g4')
})

// Carnage: a foe's helm split in two by a blow, a red slash between the halves, a green mend rising
icon('carnage', (r) => {
  r.poly([[8, 22], [26, 14], [28, 54], [10, 52]], 'b2')
  r.poly([[11, 24], [24, 18], [24, 30], [12, 32]], 'b3')
  r.rect(12, 36, 14, 3, 'k')
  r.poly([[36, 14], [54, 22], [52, 52], [34, 54]], 'b2')
  r.rect(36, 36, 14, 3, 'k')
  r.line(36, 16, 52, 23, 'b3')
  r.outline('k')
  thick(r, [31, 4], [31, 60], 'r2', 3)
  r.line(30, 4, 30, 60, 'r3')
  r.outline('k', ['r3'])
  thick(r, [52, 4], [52, 14], 'p2', 3)
  thick(r, [47, 9], [57, 9], 'p2', 3)
  r.line(52, 5, 52, 13, 'p3')
  r.outline('k', ['p3', 'r3'])
})

// Pain Eater: iron jaws closing on a drop of blood
icon('pain-eater', (r) => {
  r.poly([[8, 20], [56, 20], [52, 30], [12, 30]], 'b2')
  r.poly([[12, 44], [52, 44], [56, 54], [8, 54]], 'b2')
  for (let x = 12; x <= 50; x += 7) (r.poly([[x, 30], [x + 6, 30], [x + 3, 37]], 's3'), r.poly([[x, 44], [x + 6, 44], [x + 3, 37]], 's3'))
  r.line(9, 21, 55, 21, 'b3')
  r.line(9, 53, 55, 53, 'b1')
  r.outline('k')
  r.ellipse(32, 37, 4, 5, 'r2')
  r.poly([[29, 35], [32, 28], [35, 35]], 'r2')
  r.set(31, 36, 'r3')
  r.outline('k', ['s3'])
})

// Leap of Ruin: a red greataxe come down from the top left along its arc, the ground cracked red where it lands
icon('leap-of-ruin', (r) => {
  arc(r, 46, 50, 38, 190, 260, 'r3', 2)
  arc(r, 46, 50, 34, 195, 255, 'r2', 1)
  r.poly([[6, 50], [58, 50], [60, 58], [4, 58]], 'e2')
  for (const [a, b] of [[[34, 50], [20, 58]], [[34, 50], [50, 58]], [[34, 50], [34, 58]], [[34, 50], [10, 54]]] as [P, P][]) thick(r, a, b, 'r2', 1)
  axe(r, [24, 18], [38, 46], ['b1', 'r2', 'r3', 's4'], 'w1')
  r.outline('k', ['r3', 'r2'])
  for (const [x, y] of [[16, 44], [54, 40], [50, 46]] as P[]) r.rect(x, y, 3, 3, 'e3')
  r.outline('k', ['r3', 'r2'])
})

// ------------------------------------------------------------------ the Thornknight: white enamel and thorn green

// Thorned Mail: a white breastplate bound round with a green thorn vine
icon('thorned-mail', (r) => {
  r.poly([[16, 12], [26, 8], [32, 12], [38, 8], [48, 12], [50, 30], [44, 54], [20, 54], [14, 30]], 'y2')
  r.poly([[18, 14], [26, 10], [30, 14], [24, 50], [20, 50], [16, 30]], 'y3')
  r.poly([[40, 14], [46, 14], [48, 30], [44, 50], [36, 50]], 'y1')
  r.line(32, 14, 32, 52, 'y1')
  r.outline('k')
  thorns(r, [[10, 22], [30, 30], [54, 22]], 'h2', 'h1', 4)
  thorns(r, [[12, 44], [34, 38], [54, 46]], 'h2', 'h1', 4)
  r.outline('k')
})

// Kneel: a white knight on one knee, a sword point down before him, a crown of thorns above
icon('kneel', (r) => {
  thornCrown(r, 26, 8, 11, 4, false)
  // the helm and the bowed head
  r.ellipse(24, 22, 8, 8, 'y2')
  r.ellipse(22, 19, 4, 3, 'y3')
  r.rect(17, 22, 15, 3, 'k')
  // the body, the knee forward, the shin down behind
  r.poly([[14, 30], [34, 30], [36, 46], [16, 48]], 'y2')
  r.rect(16, 31, 4, 15, 'y3')
  r.poly([[32, 30], [36, 30], [37, 44], [34, 46]], 'y1')
  r.poly([[16, 46], [36, 44], [46, 46], [46, 54], [34, 52], [20, 54]], 'y1')
  r.poly([[14, 48], [24, 50], [20, 60], [8, 60]], 'y2')
  r.rect(40, 52, 8, 8, 'y1')
  r.outline('k')
  sword(r, [52, 22], [52, 60], 3, 7, WHITE, 'h2')
  r.outline('k')
  sparkle(r, 52, 10, 2, 'y3', 's4')
})

// Briar Line: three clumps of briars sprung up in a row, the near one tallest
icon('briar-line', (r) => {
  r.poly([[2, 54], [62, 40], [62, 48], [2, 62]], 'e2')
  r.line(2, 61, 62, 47, 'e1')
  for (const [x, y, s] of [[14, 56, 1.4], [34, 51, 1.15], [52, 46, 0.9]] as const) {
    thorns(r, [[x, y], [x - 7 * s, y - 16 * s], [x - 3 * s, y - 30 * s]], 'h2', 'h1', 3)
    thorns(r, [[x, y], [x + 8 * s, y - 14 * s], [x + 5 * s, y - 26 * s]], 'h2', 'h1', 3)
    thorns(r, [[x, y], [x + 1 * s, y - 20 * s]], 'h3', 'h1', 3)
  }
  r.outline('k')
})

// Crown's Due: a white sword driven down through a crown of thorns
icon("crowns-due", (r) => {
  thornCrown(r, 32, 40, 20, 9)
  r.outline('k')
  sword(r, [32, 12], [32, 58], 3, 8, WHITE, 'h2')
  r.outline('k')
  for (const [x, y] of [[10, 14], [54, 14]] as P[]) sparkle(r, x, y, 2, 'y3', 's4')
})

// Hold the Line: three white stakes in a row, a thorn vine strung between them
icon('hold-the-line', (r) => {
  r.poly([[4, 54], [60, 54], [60, 58], [4, 58]], 'e2')
  for (const x of [12, 30, 48]) {
    r.poly([[x, 54], [x, 20], [x + 3, 14], [x + 6, 20], [x + 6, 54]], 'y2')
    r.rect(x + 1, 20, 2, 32, 'y3')
    r.rect(x + 5, 20, 1, 34, 'y1')
  }
  r.outline('k')
  thorns(r, [[8, 30], [24, 34], [42, 30], [58, 34]], 'h2', 'h1', 4)
  thorns(r, [[8, 44], [24, 46], [42, 42], [58, 46]], 'h2', 'h1', 4)
  r.outline('k')
})

// Crown of Thorns: a ring of briars seen from above round a white light
icon('crown-of-thorns', (r) => {
  r.ellipse(32, 32, 12, 12, 'y3')
  r.ellipse(32, 32, 7, 7, 's4')
  thornCrown(r, 32, 32, 25, 25, false)
  thornCrown(r, 32, 32, 19, 19, false)
  r.outline('k', ['y3', 's4'])
  for (const [x, y] of [[32, 32], [6, 6], [58, 58]] as P[]) sparkle(r, x, y, 3, 'g3', 'g4')
})

// ------------------------------------------------------------------ the Paragon (the mastery): gold

// Iron Body: a muscled steel cuirass, gold rivets down its front
icon('iron-body', (r) => {
  r.poly([[14, 10], [24, 6], [32, 12], [40, 6], [50, 10], [54, 28], [46, 56], [18, 56], [10, 28]], 's2')
  r.ellipse(24, 24, 8, 7, 's3')
  r.ellipse(40, 24, 8, 7, 's2')
  r.ellipse(38, 22, 5, 4, 's3')
  for (const y of [34, 40, 46]) (r.rect(22, y, 8, 4, 's3'), r.rect(34, y, 8, 4, 's2'))
  r.line(32, 12, 32, 54, 's1')
  r.line(17, 54, 47, 54, 's1')
  for (const y of [14, 22, 30, 38, 46]) r.set(32, y, 'g3')
  r.outline('k')
  sparkle(r, 18, 18, 2, 's4', 'g4')
})

// Unbreakable Will: a heavy gold chain snapped in the middle, its two ends flying apart, sparks where it broke
icon('unbreakable-will', (r) => {
  const link = (cx: number, cy: number, flat: boolean) => {
    if (flat) (r.ellipse(cx, cy, 9, 6, 'g1'), r.ellipse(cx - 1, cy - 1, 8, 5, 'g2'), r.ellipse(cx, cy, 5, 2, NONE_KEY), r.line(cx - 6, cy - 4, cx + 2, cy - 5, 'g3'))
    else (r.ellipse(cx, cy, 6, 9, 'g1'), r.ellipse(cx - 1, cy - 1, 5, 8, 'g2'), r.ellipse(cx, cy, 2, 5, NONE_KEY), r.line(cx - 4, cy - 5, cx - 4, cy + 2, 'g3'))
  }
  link(8, 52, false)
  link(18, 42, true)
  link(46, 22, true)
  link(56, 12, false)
  for (let i = 0; i < r.px.length; i++) if (r.px[i] === NONE_KEY) r.px[i] = null
  // the broken link: two hooks bent open
  arc(r, 27, 34, 5, 200, 380, 'g2', 3)
  arc(r, 37, 30, 5, 20, 200, 'g2', 3)
  r.outline('k')
  for (const [x, y] of [[32, 32], [26, 22], [40, 42], [32, 16]] as P[]) sparkle(r, x, y, 3, 'g3', 'g4')
})

// Weapon Master: a sword, an axe and a mace fanned out behind a gold rosette
icon('weapon-master', (r) => {
  axe(r, [32, 52], [14, 14], STEEL, 'w2')
  thick(r, [32, 52], [50, 14], 'w2', 3)
  ball(r, 50, 13, 6, STEEL)
  for (const [x, y] of [[50, 5], [58, 13], [44, 8], [56, 7]] as P[]) r.rect(x - 1, y - 1, 3, 3, 's3')
  sword(r, [32, 46], [32, 6], 3, 8)
  r.outline('k')
  ball(r, 32, 50, 6, GOLD)
  r.outline('k')
  sparkle(r, 32, 50, 2, 'g4', 's4')
})

// Godslayer: a great sword driven down through a cracked golden halo
icon('godslayer', (r) => {
  arc(r, 32, 22, 20, 0, 160, 'g2', 3)
  arc(r, 32, 22, 20, 200, 340, 'g2', 3)
  arc(r, 32, 22, 20, 210, 300, 'g3', 1)
  r.outline('k')
  sword(r, [32, 4], [32, 58], 4, 0)
  r.rect(26, 2, 13, 3, 'g2')
  r.outline('k')
  for (const [x, y] of [[12, 22], [52, 22], [32, 44]] as P[]) sparkle(r, x, y, 3, 'g3', 'g4')
  for (const [a, b] of [[[46, 34], [56, 44]], [[18, 34], [8, 44]]] as [P, P][]) thick(r, a, b, 'g3', 1)
})

// Living Legend: a gold laurel wreath round a star
icon('living-legend', (r) => {
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const a = ((100 + i * 22) * Math.PI) / 180
      const x = 32 + side * Math.cos(a) * -20
      const y = 34 + Math.sin(a) * 20
      r.ellipse(x, y, 4, 2.5, i % 2 ? 'g2' : 'g1')
      r.set(x - side, y - 1, 'g3')
    }
  }
  const star: P[] = []
  for (let i = 0; i < 10; i++) {
    const a = ((-90 + i * 36) * Math.PI) / 180
    const rad = i % 2 ? 6 : 13
    star.push([32 + Math.cos(a) * rad, 32 + Math.sin(a) * rad])
  }
  r.poly(star, 'g2')
  r.poly(star.map(([x, y]): P => [32 + (x - 32) * 0.6 - 1, 32 + (y - 32) * 0.6 - 1]), 'g3')
  r.outline('k')
  sparkle(r, 30, 28, 2, 'g4', 's4')
  for (const [x, y] of [[8, 8], [56, 8]] as P[]) sparkle(r, x, y, 2, 'g3', 'g4')
})

// ------------------------------------------------------------------ the first tree, deeper: steel and leather

// Hamstring: a big leather boot, a red cut across its heel, a dragging chain behind
icon('hamstring', (r) => {
  r.rect(26, 8, 16, 30, 'w2')
  r.poly([[26, 34], [54, 34], [58, 44], [26, 44]], 'w2')
  r.rect(28, 10, 4, 26, 'w3')
  r.rect(24, 8, 20, 5, 's2')
  r.line(25, 9, 43, 9, 's3')
  r.rect(26, 44, 33, 4, 'b2')
  r.line(27, 43, 57, 43, 'w1')
  r.outline('k')
  for (let i = 0; i < 4; i++) (r.ellipse(20 - i * 5, 46 + (i % 2), 2.5, 2, i % 2 ? 's3' : 's2'), r.set(20 - i * 5, 46 + (i % 2), 's1'))
  r.outline('k')
  thick(r, [12, 24], [46, 46], 'r2', 4)
  thick(r, [14, 24], [46, 44], 'r3', 1)
  r.outline('k', ['r3'])
  for (const [x, y] of [[50, 52], [56, 50], [44, 54]] as P[]) r.rect(x, y, 2, 2, 'e3')
})

// Sunder: a breastplate split down its middle by a blow, sparks where it parts
icon('sunder', (r) => {
  r.poly([[14, 12], [30, 10], [28, 54], [18, 54], [12, 32]], 's2')
  r.poly([[36, 10], [52, 12], [54, 32], [48, 54], [38, 54]], 's2')
  r.poly([[16, 14], [26, 12], [22, 50], [18, 50], [14, 32]], 's3')
  r.rect(46, 14, 3, 36, 's1')
  r.outline('k')
  thick(r, [33, 2], [33, 58], 'g3', 1)
  r.outline('k', ['g3'])
  for (const [x, y] of [[33, 20], [26, 32], [40, 40]] as P[]) sparkle(r, x, y, 3, 'g3', 'g4')
})

// Battle Hardened: a steel bracer, dented and scored, its leather straps stitched again where they tore
icon('battle-hardened', (r) => {
  r.poly([[18, 8], [46, 8], [50, 56], [14, 56]], 's1')
  r.poly([[20, 10], [44, 10], [47, 54], [17, 54]], 's2')
  r.poly([[21, 12], [28, 12], [26, 52], [19, 52]], 's3')
  for (const y of [18, 44]) (r.rect(12, y, 41, 6, 'w2'), r.line(12, y, 52, y, 'w3'), r.line(12, y + 5, 52, y + 5, 'w1'))
  for (const y of [18, 44]) for (let x = 15; x < 50; x += 4) r.set(x, y + 3, 'w3')
  r.outline('k')
  for (const [a, b] of [[[26, 28], [36, 36]], [[30, 26], [40, 32]], [[22, 36], [28, 40]]] as [P, P][]) thick(r, a, b, 's1', 1)
  for (const [x, y] of [[40, 28], [24, 30]] as P[]) (r.ellipse(x, y, 2.5, 2, 's1'), r.set(x - 1, y - 1, 's4'))
  for (const [x, y] of [[54, 10], [8, 30]] as P[]) sparkle(r, x, y, 2, 's4', 'g4')
})

// Sword Mastery: a sword upright before a gold rosette, a diamond of light at its point
icon('sword-mastery', (r) => {
  for (let a = 0; a < 360; a += 30) {
    const c = Math.cos((a * Math.PI) / 180)
    const s = Math.sin((a * Math.PI) / 180)
    r.ellipse(32 + c * 15, 34 + s * 15, 5, 5, a % 60 ? 'g1' : 'g2')
  }
  r.ellipse(32, 34, 13, 13, 'g2')
  r.ellipse(30, 32, 8, 8, 'g3')
  r.outline('k')
  sword(r, [32, 48], [32, 6], 3, 8)
  r.outline('k')
  r.poly([[32, 0], [35, 4], [32, 8], [29, 4]], 'g4')
})

// ------------------------------------------------------------------ the entrances

// The Sentinel's path: a blue tower shield, a silver tower on it
icon('path-sentinel', (r) => {
  tower(r, 16, 6, 32, 52, BLUE)
  r.rect(26, 22, 12, 22, 's3')
  for (const x of [26, 30, 34]) r.rect(x, 18, 3, 4, 's3')
  r.rect(30, 34, 4, 10, 'u1')
  r.rect(36, 22, 2, 22, 's2')
  r.outline('k')
  sparkle(r, 52, 10, 2, 'u4', 's4')
})

// The Berserker's path: a double-bitted axe, red-bladed, on a bone-white haft
icon('path-berserker', (r) => {
  thick(r, [32, 58], [32, 6], 'y1', 4)
  r.line(31, 58, 31, 6, 'y3')
  for (const side of [-1, 1]) {
    r.poly([[32, 12], [32 + side * 22, 4], [32 + side * 26, 20], [32 + side * 22, 34], [32, 26]], 'r1')
    r.poly([[32 + side * 4, 14], [32 + side * 20, 8], [32 + side * 23, 20], [32 + side * 20, 30], [32 + side * 4, 24]], 'r2')
    r.line(32 + side * 21, 7, 32 + side * 24, 20, 'r3')
  }
  r.rect(28, 12, 9, 16, 'b2')
  r.rect(28, 44, 9, 4, 'b2')
  r.outline('k')
  sparkle(r, 32, 58, 2, 'r3', 'g4')
})

// The Thornknight's path: a white kite shield, a ring of thorns on it
icon('path-thornknight', (r) => {
  kite(r, 32, 6, 38, 54, WHITE)
  r.outline('k')
  thornCrown(r, 32, 26, 10, 10, true)
  r.outline('k', ['r3'])
  sparkle(r, 54, 8, 2, 'y3', 's4')
})

// The warrior's mastery: a golden crowned helm between two crossed swords
icon('mastery-warrior', (r) => {
  sword(r, [12, 54], [50, 10], 2, 6)
  sword(r, [52, 54], [14, 10], 2, 6)
  r.outline('k')
  helm(r, 32, 34, GOLD)
  for (const x of [22, 32, 42]) r.poly([[x - 4, 22], [x, 12], [x + 4, 22]], 'g2')
  r.rect(20, 20, 25, 4, 'g1')
  for (const x of [22, 32, 42]) r.set(x, 15, 'r3')
  r.outline('k')
  sparkle(r, 32, 8, 3, 'g3', 'g4')
})

if (Object.keys(out).length !== MINE.size) throw new Error(`warrior advancement: ${Object.keys(out).length} drawn, ${MINE.size} listed`)
for (const [id, r] of Object.entries(out)) {
  // (never another's picture: only those this file lists)
  if (!MINE.has(id)) throw new Error(`skills/${id}.png is not the warrior's advancement's to draw`)
  writeAtlas(`skills/${id}.png`, [[r]], PAL)
}
console.log(`${Object.keys(out).length} warrior advancement icons → public/assets/lsw/skills`)
