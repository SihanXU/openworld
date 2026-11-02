// The mage's advancement icons (docs/advancement.md; content advancement.ts): the three paths — the Pyromancer in fire
// orange and red, the Cryomancer in ice blue and white, the Dawnbringer in dawn gold and ivory —, the Archmage's mastery
// in violet and gold, the four new skills of the first tree in arcane blue, and the entrances (a medallion for each
// path, the Archmage's circlet). 64x64, by code, in the look of skill-actives.ts: one bold emblem on a clear ground, a
// dark outline round it, three or four tones a colour, a few bright accents.
//
//   npx tsx games/openworld/tools/src/art/skill-adv-mage.ts

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { OUT } from './png.ts'
import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [40, 18, 14, 255],
  s1: [78, 84, 100, 255], s2: [138, 146, 162, 255], s3: [198, 205, 216, 255], s4: [246, 248, 252, 255],
  w1: [86, 46, 26, 255], w2: [136, 80, 42, 255], w3: [188, 124, 68, 255],
  g1: [146, 92, 28, 255], g2: [212, 150, 50, 255], g3: [250, 208, 98, 255],
  r1: [116, 28, 30, 255], r2: [188, 50, 44, 255], r3: [234, 98, 72, 255],
  f1: [196, 64, 28, 255], f2: [240, 126, 38, 255], f3: [255, 196, 76, 255], f4: [255, 242, 172, 255],
  v1: [56, 28, 86, 255], v2: [106, 58, 148, 255], v3: [168, 108, 210, 255], v4: [226, 192, 252, 255],
  i1: [46, 96, 158, 255], i2: [98, 168, 220, 255], i3: [170, 220, 246, 255], i4: [236, 250, 255, 255],
  m1: [86, 86, 94, 255], m2: [136, 136, 146, 255], m3: [188, 188, 198, 255], m4: [230, 230, 236, 255],
  y1: [198, 146, 28, 255], y2: [250, 218, 60, 255], y3: [255, 250, 182, 255],
  b1: [28, 28, 38, 255], b2: [58, 58, 74, 255], b3: [100, 100, 122, 255],
  e1: [78, 52, 38, 255], e2: [120, 84, 54, 255], e3: [166, 120, 80, 255],
  n1: [30, 54, 128, 255], n2: [56, 102, 200, 255], n3: [120, 168, 246, 255],
  // the dawn's gold and ivory
  d1: [190, 128, 40, 255], d2: [236, 184, 72, 255], d3: [255, 226, 140, 255], d4: [255, 248, 222, 255],
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

function sparkle(r: Raster, x: number, y: number, s: number, c: string, core = c): void {
  r.line(x - s, y, x + s, y, c)
  r.line(x, y - s, x, y + s, c)
  r.set(x, y, core)
}

/** A tongue of flame standing on (cx, by), w wide and h tall, leaning a little; its layers from the outer red to the white heart. */
function flame(r: Raster, cx: number, by: number, w: number, h: number, lean = 0, ramp: string[] = ['r2', 'f2', 'f3', 'f4']): void {
  const layer = (s: number, c: string) => {
    const W = w * s
    const H = h * s
    const L = lean * s
    r.poly(
      [
        [cx - W * 0.5, by - H * 0.22],
        [cx - W * 0.42, by - H * 0.5],
        [cx - W * 0.18 + L * 0.5, by - H * 0.72],
        [cx + L, by - H],
        [cx + W * 0.12 + L * 0.6, by - H * 0.74],
        [cx + W * 0.34 + L * 0.3, by - H * 0.6],
        [cx + W * 0.5, by - H * 0.3],
        [cx + W * 0.36, by - H * 0.04],
        [cx, by],
        [cx - W * 0.36, by - H * 0.04],
      ],
      c,
    )
  }
  ramp.forEach((c, i) => layer([1, 0.72, 0.48, 0.26][i], c))
}

/** A snowflake: three bars through its heart, each arm forked twice. */
function snowflake(r: Raster, cx: number, cy: number, rad: number, c: string, w = 2, tip = c): void {
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2
    const end: P = [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]
    thick(r, [cx, cy], end, c, w)
    for (const t of [0.5, 0.78]) {
      const m: P = [cx + Math.cos(a) * rad * t, cy + Math.sin(a) * rad * t]
      for (const s of [-1, 1]) {
        const b = a + s * 0.75
        r.line(m[0], m[1], m[0] + Math.cos(b) * rad * 0.24, m[1] + Math.sin(b) * rad * 0.24, c)
      }
    }
    r.set(end[0], end[1], tip)
  }
}

/** A sun's rays round a centre: long and short by turns. */
function rays(r: Raster, cx: number, cy: number, inner: number, outer: number, n: number, c: string, w = 2, off = 0): void {
  for (let i = 0; i < n; i++) {
    const a = ((i + off) * 2 * Math.PI) / n
    const len = i % 2 ? outer * 0.78 : outer
    thick(r, [cx + Math.cos(a) * inner, cy + Math.sin(a) * inner], [cx + Math.cos(a) * len, cy + Math.sin(a) * len], c, w)
  }
}

/** A path's medallion: a round plate in the path's colours, a gold rim with four studs. */
function medallion(r: Raster, ramp: Ramp): void {
  r.ellipse(32, 32, 25, 25, 'g1')
  r.ellipse(32, 32, 23, 23, 'g2')
  arc(r, 32, 32, 23, 190, 260, 'g3', 2)
  r.ellipse(32, 32, 19, 19, ramp[0])
  r.ellipse(31, 31, 17, 17, ramp[1])
  r.ellipse(29, 29, 10, 10, ramp[2])
  for (const a of [45, 135, 225, 315]) {
    const x = 32 + Math.cos((a * Math.PI) / 180) * 23
    const y = 32 + Math.sin((a * Math.PI) / 180) * 23
    r.ellipse(x, y, 1.6, 1.6, 'g3')
  }
}

const out: Record<string, Raster> = {}
const icon = (id: string, draw: (r: Raster) => void) => {
  const r = new Raster(S, S)
  draw(r)
  out[id] = r
}

// ---------------------------------------------------------------- the Pyromancer: fire

// Kindling: a twig of tinder, its tip caught, sparks leaping off it
icon('kindling', (r) => {
  thick(r, [12, 54], [38, 26], 'w1', 5)
  thick(r, [12, 53], [37, 26], 'w2', 3)
  r.line(13, 51, 36, 26, 'w3')
  // a knot and a split twig
  r.ellipse(22, 42, 2, 2, 'w1')
  thick(r, [26, 38], [20, 30], 'w2', 2)
  r.outline('k')
  flame(r, 41, 30, 18, 26, 3)
  r.outline('k', ['f3', 'f4'])
  for (const [x, y, s] of [[52, 12, 2], [56, 22, 1], [30, 10, 2], [48, 6, 1]] as const) sparkle(r, x, y, s, 'f3', 'f4')
})

// Flame Wall: a wall of three flames standing on a row of hot stones
icon('flame-wall', (r) => {
  r.poly([[4, 48], [60, 48], [58, 56], [6, 56]], 'e1')
  for (let x = 6; x < 58; x += 9) r.ellipse(x + 4, 51, 4, 3, 'e2')
  for (let x = 6; x < 58; x += 9) r.line(x + 2, 49, x + 5, 49, 'r2')
  r.outline('k')
  flame(r, 16, 49, 16, 30, -2)
  flame(r, 48, 49, 16, 30, 2)
  flame(r, 32, 49, 20, 42, 0)
  r.outline('k', ['f3', 'f4'])
  sparkle(r, 8, 14, 2, 'f3', 'f4')
  sparkle(r, 56, 10, 2, 'f3', 'f4')
})

// Combustion: an ember bursting, its shell flying apart round a white-hot heart
icon('combustion', (r) => {
  const star: P[] = []
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8
    const rad = i % 2 ? 11 : 24
    star.push([32 + Math.cos(a) * rad, 32 + Math.sin(a) * rad])
  }
  r.poly(star, 'r2')
  const inner = star.map(([x, y]): P => [32 + (x - 32) * 0.7, 32 + (y - 32) * 0.7])
  r.poly(inner, 'f2')
  ball(r, 32, 32, 8, ['f3', 'f3', 'f4', 's4'])
  r.outline('k')
  // the ember's shell flying off
  for (const [x, y, a] of [[8, 10, 0], [54, 12, 1], [10, 54, 1], [56, 52, 0]] as const) {
    r.poly([[x, y], [x + 5, y + (a ? -2 : 2)], [x + 3, y + 5]], 'e1')
    r.line(x + 1, y + 1, x + 3, y + 2, 'r2')
  }
  r.outline('k', ['f4', 's4'])
})

// Conflagration: fire running across the grass before the wind, low flames and high
icon('conflagration', (r) => {
  r.poly([[2, 52], [62, 52], [62, 58], [2, 58]], 'e2')
  for (let x = 4; x < 62; x += 5) r.line(x, 52, x + 2, 48, 'g1')
  r.outline('k')
  flame(r, 14, 53, 12, 18, 4)
  flame(r, 30, 53, 16, 30, 6)
  flame(r, 48, 53, 18, 42, 7)
  r.outline('k', ['f3', 'f4'])
  // the wind that drives it
  r.line(4, 22, 16, 22, 'm3')
  r.line(16, 22, 18, 20, 'm3')
  r.line(2, 28, 12, 28, 'm4')
  r.line(6, 34, 14, 34, 'm3')
})

// Ember Heart: a heart of glowing coal, cracked with fire
icon('ember-heart', (r) => {
  r.poly([[32, 54], [10, 32], [8, 22], [14, 13], [24, 12], [32, 20], [40, 12], [50, 13], [56, 22], [54, 32]], 'e1')
  r.poly([[32, 50], [13, 31], [12, 23], [16, 16], [24, 15], [32, 23], [40, 15], [48, 16], [52, 23], [51, 31]], 'b2')
  r.poly([[16, 18], [22, 16], [27, 20], [20, 24]], 'b3')
  // the cracks, alight
  thick(r, [32, 23], [30, 32], 'f2', 2)
  thick(r, [30, 32], [36, 38], 'f2', 2)
  thick(r, [36, 38], [32, 46], 'f2', 2)
  thick(r, [30, 32], [20, 30], 'f2', 2)
  thick(r, [36, 38], [46, 30], 'f2', 2)
  r.line(31, 26, 30, 31, 'f4')
  r.line(33, 39, 32, 44, 'f3')
  r.ellipse(33, 36, 3, 3, 'f3')
  r.set(33, 36, 'f4')
  r.outline('k')
  flame(r, 32, 14, 8, 10, 1, ['f2', 'f3', 'f4'])
  r.outline('k', ['f3', 'f4'])
})

// Inferno: fire raining in slanted drops on a burning ground
icon('inferno', (r) => {
  r.poly([[2, 54], [62, 54], [60, 60], [4, 60]], 'r1')
  r.outline('k')
  for (const [x, y, s] of [[12, 52, 0.7], [30, 53, 1], [50, 52, 0.8]] as const) flame(r, x, y, 14 * s, 18 * s, 0)
  // the falling drops of fire, each with a tail
  for (const [x, y, s] of [[18, 12, 1], [40, 8, 1.2], [52, 26, 0.9], [26, 30, 0.8]] as const) {
    const rad = 4.5 * s
    thick(r, [x - 9 * s, y - 9 * s], [x, y], 'f2', Math.max(2, Math.round(3 * s)))
    thick(r, [x - 12 * s, y - 12 * s], [x - 6 * s, y - 6 * s], 'r2', 2)
    ball(r, x, y, rad, ['r2', 'f2', 'f3', 'f4'])
  }
  r.outline('k', ['f3', 'f4'])
})

// The Pyromancer's medallion: a red plate, a flame
icon('path-pyromancer', (r) => {
  medallion(r, ['r1', 'r2', 'r3'])
  r.outline('k')
  flame(r, 32, 46, 20, 30, 1)
  r.outline('k', ['f3', 'f4'])
})

// ---------------------------------------------------------------- the Cryomancer: ice

// Rime: a twig gone white with frost, icicles hanging from it
icon('rime', (r) => {
  thick(r, [6, 22], [58, 18], 'w1', 4)
  thick(r, [6, 21], [58, 17], 'w2', 2)
  thick(r, [24, 20], [16, 8], 'w1', 3)
  thick(r, [42, 19], [50, 8], 'w1', 3)
  // the frost on top of it
  for (const [x0, x1, y] of [[6, 58, 17], [16, 24, 8]] as const) for (let x = x0; x <= x1; x += 2) r.rect(x, y - 2 - ((x * 7) % 3 === 0 ? 1 : 0), 2, 2, 'i4')
  r.rect(48, 6, 4, 2, 'i4')
  r.outline('k')
  // icicles, long and short
  for (const [x, len] of [[12, 18], [20, 28], [28, 14], [36, 32], [46, 20], [54, 12]] as const) {
    r.poly([[x - 3, 22], [x + 3, 22], [x, 22 + len]], 'i2')
    r.line(x - 1, 23, x, 20 + len, 'i3')
    r.set(x - 1, 23, 'i4')
  }
  r.outline('k')
  sparkle(r, 58, 40, 2, 'i3', 'i4')
  sparkle(r, 6, 46, 2, 'i3', 'i4')
})

// Ice Lance: a long lance of ice driven through two rings of frost
icon('ice-lance', (r) => {
  const a: P = [8, 56]
  thick(r, a, [44, 20], 'i1', 5)
  thick(r, a, [44, 20], 'i2', 3)
  r.line(9, 54, 44, 19, 'i3')
  // the head: a long crystal
  r.poly([[40, 18], [46, 24], [56, 8]], 'i2')
  r.poly([[40, 18], [44, 14], [56, 8]], 'i3')
  r.line(44, 20, 55, 9, 'i4')
  r.outline('k')
  // the rings it passes through
  for (const [x, y] of [[20, 44], [32, 32]] as const) {
    r.ellipse(x, y, 7, 7, 'i3')
    r.ellipse(x, y, 5, 5, null as unknown as string)
    arc(r, x, y, 6, 200, 320, 'i4', 1)
  }
  r.outline('k')
  thick(r, [22, 42], [30, 34], 'i2', 3)
  r.line(22, 41, 30, 33, 'i3')
  sparkle(r, 52, 30, 2, 'i3', 'i4')
  sparkle(r, 12, 30, 2, 'i3', 'i4')
})

// Glacial Prison: a block of ice, something dark held inside it
icon('glacial-prison', (r) => {
  // the block, seen from above a corner
  r.poly([[32, 8], [56, 20], [32, 32], [8, 20]], 'i4')
  r.poly([[8, 20], [32, 32], [32, 58], [8, 46]], 'i2')
  r.poly([[32, 32], [56, 20], [56, 46], [32, 58]], 'i1')
  // the shape held in it: a crouched creature's dark outline
  r.ellipse(20, 40, 6, 7, 'b2')
  r.ellipse(18, 33, 4, 4, 'b2')
  r.ellipse(44, 40, 5, 7, 'n1')
  r.rect(17, 32, 1, 1, 'f3')
  // its edges and a crack, frost on top
  r.line(32, 32, 32, 58, 'i3')
  r.line(8, 20, 32, 32, 's4')
  r.line(32, 32, 56, 20, 'i3')
  r.line(38, 14, 44, 18, 'i3')
  r.line(20, 12, 26, 15, 's4')
  r.line(46, 30, 50, 36, 'i4')
  r.line(50, 36, 48, 40, 'i4')
  r.outline('k')
  sparkle(r, 58, 8, 2, 'i3', 'i4')
})

// Shatter: a crystal breaking, its shards flying out from the crack
icon('shatter', (r) => {
  // the heart of it, cracked through, a piece breaking away
  r.poly([[30, 10], [44, 26], [40, 48], [24, 50], [16, 30]], 'i1')
  r.poly([[30, 12], [42, 26], [38, 46], [25, 48], [18, 30]], 'i2')
  r.poly([[30, 12], [42, 26], [31, 28], [18, 30]], 'i3')
  r.line(29, 15, 22, 28, 'i4')
  r.line(30, 13, 30, 18, 's4')
  thick(r, [31, 28], [27, 38], 'b2', 2)
  thick(r, [27, 38], [32, 48], 'b2', 2)
  thick(r, [31, 28], [40, 34], 'b2', 2)
  r.outline('k')
  // the shards flying off
  for (const [x, y, dx, dy] of [[4, 10, 8, 3], [52, 6, -3, 8], [2, 38, 8, -2], [54, 30, 7, 6], [8, 54, 7, -6], [46, 54, 6, 4], [56, 46, 4, -7]] as const) {
    r.poly([[x, y], [x + dx, y + dy], [x + dx / 2 + 3, y + dy / 2 + 4]], 'i3')
    r.line(x, y, x + dx / 2, y + dy / 2, 'i4')
  }
  r.outline('k')
  // the lines of their flight, no outline
  for (const [x, y, dx, dy] of [[14, 16, 3, 3], [50, 18, -4, 3], [14, 38, 4, -1], [50, 38, -4, -1], [18, 50, 3, -3]] as const) r.line(x, y, x + dx, y + dy, 'i3')
})

// Frost Armour: a breastplate of ice, frost spikes standing off its shoulders
icon('frost-armour', (r) => {
  r.poly([[18, 14], [26, 12], [32, 18], [38, 12], [46, 14], [52, 22], [48, 30], [46, 50], [32, 56], [18, 50], [16, 30], [12, 22]], 'i2')
  r.poly([[20, 16], [26, 14], [32, 20], [32, 54], [20, 48], [18, 30], [15, 23]], 'i3')
  r.line(32, 20, 32, 54, 'i1')
  r.line(21, 32, 43, 32, 'i1')
  r.line(22, 42, 42, 42, 'i1')
  r.line(22, 18, 26, 16, 'i4')
  r.rect(22, 24, 2, 4, 'i4')
  // the spikes of rime on its shoulders
  for (const [x, y, dx] of [[12, 22, -6], [16, 16, -4], [52, 22, 6], [48, 16, 4]] as const) {
    r.poly([[x, y], [x + dx, y - 8], [x + (dx > 0 ? -2 : 2), y - 2]], 'i4')
  }
  r.outline('k')
  sparkle(r, 32, 8, 2, 'i3', 'i4')
})

// Blizzard: a heavy white cloud, snow and hail driving down out of it slantwise
icon('blizzard', (r) => {
  r.ellipse(20, 18, 12, 9, 'm3')
  r.ellipse(36, 14, 14, 11, 'm3')
  r.ellipse(48, 20, 10, 8, 'm3')
  r.rect(10, 18, 46, 9, 'm3')
  r.ellipse(34, 12, 10, 7, 's4')
  r.ellipse(18, 16, 7, 5, 'm4')
  r.rect(10, 24, 46, 3, 'm2')
  r.outline('k')
  // the driven snow
  snowflake(r, 18, 42, 7, 'i4', 1, 'i3')
  snowflake(r, 42, 48, 8, 'i4', 1, 'i3')
  r.outline('k', ['i3'])
  for (const [x, y] of [[30, 34], [52, 34], [10, 52], [30, 56], [56, 56], [24, 30]] as const) {
    r.line(x, y, x - 3, y + 4, 'i3')
    r.set(x - 3, y + 4, 'i4')
  }
})

// The Cryomancer's medallion: a blue plate, a snowflake
icon('path-cryomancer', (r) => {
  medallion(r, ['i1', 'i2', 'i3'])
  r.outline('k')
  snowflake(r, 32, 32, 13, 's4', 2, 'i4')
  r.ellipse(32, 32, 2, 2, 'i4')
  r.outline('k', ['s4', 'i4'])
})

// ---------------------------------------------------------------- the Dawnbringer: the light against the Night

// Dawnlight: the sun's edge coming up over a dark hill, long rays before it
icon('dawnlight', (r) => {
  rays(r, 32, 44, 18, 30, 12, 'd3', 2, 0.5)
  r.ellipse(32, 44, 16, 16, 'd2')
  r.ellipse(32, 44, 13, 13, 'd3')
  r.ellipse(29, 41, 7, 7, 'd4')
  // the hill and the night still on it
  r.poly([[2, 46], [16, 40], [30, 44], [46, 38], [62, 44], [62, 60], [2, 60]], 'v1')
  r.poly([[2, 50], [18, 46], [36, 50], [62, 48], [62, 60], [2, 60]], 'b1')
  r.line(16, 40, 30, 44, 'v2')
  r.line(46, 38, 62, 44, 'v2')
  r.outline('k', ['d3'])
  sparkle(r, 10, 14, 2, 'd3', 'd4')
})

// Sunburst: a sun flaring out, a white heart and a ring of light round it
icon('sunburst', (r) => {
  rays(r, 32, 32, 14, 28, 16, 'd2', 3)
  rays(r, 32, 32, 14, 26, 16, 'd3', 1)
  r.ellipse(32, 32, 14, 14, 'd1')
  r.ellipse(32, 32, 12, 12, 'd2')
  r.ellipse(31, 31, 9, 9, 'd3')
  r.ellipse(29, 29, 5, 5, 'd4')
  r.outline('k', ['d3'])
  arc(r, 32, 32, 19, 0, 360, 'd4', 1)
})

// Sanctuary: a ring of golden runes on the ground, light standing up from it
icon('sanctuary', (r) => {
  r.ellipse(32, 48, 27, 11, 'd1')
  r.ellipse(32, 48, 24, 9, 'd2')
  r.ellipse(32, 48, 19, 6, 'd4')
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    r.rect(32 + Math.cos(a) * 21.5 - 1, 48 + Math.sin(a) * 7.8 - 1, 2, 2, 'd1')
  }
  r.outline('k')
  // the light standing up from the ring: bright shafts, unoutlined, widening to the ground
  for (const [x0, x1, c] of [[22, 18, 'd3'], [27, 25, 'd4'], [32, 32, 's4'], [37, 39, 'd4'], [42, 46, 'd3']] as const) thick(r, [x0, 10], [x1, 44], c, c === 's4' ? 3 : 2)
  r.ellipse(32, 48, 6, 2, 's4')
  sparkle(r, 12, 20, 2, 'd3', 'd4')
  sparkle(r, 52, 14, 2, 'd3', 'd4')
  sparkle(r, 32, 5, 2, 'd3', 'd4')
})

// Lantern Soul: a lantern under a crescent moon, a pale soul-flame burning in it
icon('lantern-soul', (r) => {
  // the moon
  r.ellipse(50, 14, 9, 9, 'd3')
  r.ellipse(54, 11, 8, 8, null as unknown as string)
  // the lantern: a ring, a hood, a glass, a base
  arc(r, 30, 12, 5, 180, 360, 'g1', 2)
  r.poly([[20, 18], [40, 18], [36, 14], [24, 14]], 'g1')
  r.rect(21, 18, 18, 24, 'b2')
  r.rect(23, 20, 14, 20, 'i3')
  r.rect(21, 42, 18, 5, 'g1')
  r.rect(23, 47, 14, 3, 'g2')
  r.line(21, 18, 21, 41, 'g2')
  r.line(38, 18, 38, 41, 'g1')
  r.line(30, 18, 30, 41, 'g1')
  r.outline('k')
  // the soul-flame in the glass, pale blue and white
  flame(r, 30, 39, 10, 16, 1, ['i2', 'i3', 'i4', 's4'])
  r.line(30, 18, 30, 22, 'g1')
  r.outline('k', ['i4', 's4'])
  sparkle(r, 12, 30, 2, 'i3', 'i4')
  sparkle(r, 46, 40, 1, 'd3', 'd4')
})

// Mercy of Dawn: a white dove rising before a small dawn sun
icon('mercy-of-dawn', (r) => {
  rays(r, 40, 20, 9, 18, 10, 'd3', 2, 0.5)
  r.ellipse(40, 20, 9, 9, 'd2')
  r.ellipse(39, 19, 6, 6, 'd3')
  r.ellipse(37, 17, 3, 3, 'd4')
  r.outline('k', ['d3'])
  // the far wing, raised, in shadow
  r.poly([[24, 36], [12, 14], [20, 16], [30, 30]], 'm3')
  r.line(14, 16, 26, 32, 'm2')
  // the tail, the body, the head and its beak
  r.poly([[8, 44], [20, 38], [22, 46], [10, 52]], 'm4')
  r.line(10, 48, 20, 42, 'm3')
  r.ellipse(30, 40, 13, 7, 'm4')
  r.ellipse(30, 42, 11, 4, 'm3')
  r.ellipse(43, 34, 5, 5, 's4')
  r.poly([[47, 33], [52, 35], [47, 36]], 'f2')
  r.set(44, 33, 'b1')
  // the near wing, raised high, its feathers spread
  r.poly([[28, 38], [30, 12], [36, 8], [38, 16], [42, 14], [40, 24], [44, 24], [36, 36]], 's4')
  r.line(31, 14, 33, 34, 'm3')
  r.line(36, 12, 35, 32, 'm3')
  r.line(40, 18, 37, 32, 'm3')
  // a sprig in its beak
  thick(r, [49, 36], [55, 44], 'e2', 1)
  r.set(52, 39, 'g3')
  r.set(54, 42, 'g3')
  r.outline('k', ['d3'])
  sparkle(r, 56, 50, 2, 'd3', 'd4')
})

// Daybreak: a pillar of light driven down into the ground, the ground flaring where it strikes
icon('daybreak', (r) => {
  // the flare at its foot
  r.ellipse(32, 52, 22, 7, 'd2')
  r.ellipse(32, 52, 16, 5, 'd3')
  rays(r, 32, 52, 8, 16, 8, 'd3', 2)
  r.outline('k', ['d3'])
  // the beam, white at its heart
  r.poly([[22, 4], [42, 4], [38, 52], [26, 52]], 'd2')
  r.poly([[26, 4], [38, 4], [35, 52], [29, 52]], 'd3')
  r.rect(30, 4, 4, 48, 'd4')
  r.rect(31, 4, 2, 48, 's4')
  r.outline('k', ['d3'])
  r.ellipse(32, 52, 6, 2, 's4')
  sparkle(r, 12, 40, 2, 'd3', 'd4')
  sparkle(r, 52, 36, 2, 'd3', 'd4')
  sparkle(r, 48, 14, 1, 'd3', 'd4')
})

// The Dawnbringer's medallion: an ivory plate, the sun on it
icon('path-dawnbringer', (r) => {
  medallion(r, ['d1', 'd3', 'd4'])
  r.outline('k')
  rays(r, 32, 32, 9, 16, 12, 'd1', 2)
  r.ellipse(32, 32, 8, 8, 'd1')
  r.ellipse(32, 32, 6, 6, 'd2')
  r.ellipse(30, 30, 3, 3, 'd4')
  r.outline('k', ['d1', 'd2', 'd3', 'd4'])
})

// ---------------------------------------------------------------- the Archmage: violet and gold

// Arcane Mastery: an eye of violet fire in a gold triangle, rays round it
icon('arcane-mastery', (r) => {
  rays(r, 32, 36, 22, 30, 12, 'v3', 1)
  r.poly([[32, 8], [58, 52], [6, 52]], 'g1')
  r.poly([[32, 13], [53, 49], [11, 49]], 'g2')
  r.poly([[32, 18], [48, 46], [16, 46]], 'v1')
  // the eye
  r.poly([[18, 36], [26, 30], [38, 30], [46, 36], [38, 42], [26, 42]], 's4')
  r.ellipse(32, 36, 5, 5, 'v2')
  r.ellipse(32, 36, 3, 3, 'v4')
  r.rect(32, 35, 1, 2, 'b1')
  r.line(32, 13, 52, 48, 'g3')
  r.outline('k', ['v3'])
})

// Time Warp: an hourglass twisting, its violet sand running up as much as down
icon('time-warp', (r) => {
  arc(r, 32, 32, 25, 200, 320, 'v3', 2)
  arc(r, 32, 32, 25, 20, 140, 'v3', 2)
  r.poly([[54, 22], [58, 30], [50, 30]], 'v3')
  r.poly([[10, 42], [6, 34], [14, 34]], 'v3')
  r.rect(18, 8, 28, 4, 'w2')
  r.rect(18, 52, 28, 4, 'w2')
  r.line(18, 8, 45, 8, 'w3')
  r.poly([[21, 12], [43, 12], [34, 31], [43, 52], [21, 52], [30, 33]], 'i3')
  r.poly([[24, 14], [40, 14], [33, 28], [31, 28]], 'v2')
  r.poly([[31, 36], [33, 36], [41, 50], [23, 50]], 'v2')
  r.line(32, 28, 32, 36, 'v4')
  r.line(23, 14, 30, 30, 's4')
  r.outline('k', ['v3'])
})

// Mana Flow: a drop of mana with ribbons of it running round in a loop
icon('mana-flow', (r) => {
  arc(r, 32, 34, 22, 140, 400, 'n2', 3)
  arc(r, 32, 34, 22, 160, 380, 'n3', 1)
  r.poly([[46, 14], [56, 16], [50, 24]], 'n3')
  arc(r, 32, 34, 15, -40, 220, 'v2', 2)
  r.poly([[19, 44], [14, 52], [24, 50]], 'v3')
  r.outline('k', ['n2', 'n3', 'v2', 'v3'])
  // the drop
  r.poly([[32, 16], [40, 30], [40, 38], [32, 44], [24, 38], [24, 30]], 'n1')
  r.poly([[32, 18], [38, 30], [38, 37], [32, 42], [26, 37], [26, 30]], 'n2')
  r.poly([[30, 24], [27, 31], [28, 36], [31, 30]], 'n3')
  r.set(28, 32, 's4')
  r.outline('k', ['n2', 'n3', 'v2', 'v3'])
  sparkle(r, 54, 46, 2, 'n3', 's4')
})

// Convergence: three beams — fire, ice, lightning — meeting in one white star
icon('convergence', (r) => {
  thick(r, [6, 10], [32, 34], 'f2', 5)
  thick(r, [6, 10], [32, 34], 'f3', 2)
  thick(r, [58, 10], [32, 34], 'i2', 5)
  thick(r, [58, 10], [32, 34], 'i4', 2)
  thick(r, [32, 60], [32, 34], 'y1', 5)
  thick(r, [32, 60], [32, 34], 'y3', 2)
  r.outline('k')
  for (const [x, y, c] of [[8, 12, 'f2'], [56, 12, 'i2'], [32, 58, 'y2']] as const) r.ellipse(x, y, 4, 4, c)
  r.poly([[32, 20], [36, 30], [46, 34], [36, 38], [32, 48], [28, 38], [18, 34], [28, 30]], 'v4')
  r.poly([[32, 26], [34, 32], [40, 34], [34, 36], [32, 42], [30, 36], [24, 34], [30, 32]], 's4')
  r.outline('k', ['v4', 's4'])
})

// Ascendance: three chevrons of violet light climbing to a star
icon('ascendance', (r) => {
  for (const [y, c, d] of [[52, 'v1', 'v2'], [40, 'v2', 'v3'], [28, 'v3', 'v4']] as const) {
    r.poly([[12, y], [32, y - 12], [52, y], [52, y + 6], [32, y - 6], [12, y + 6]], c)
    r.line(13, y + 1, 32, y - 11, d)
  }
  r.outline('k')
  r.poly([[32, 4], [35, 11], [42, 12], [36, 16], [38, 23], [32, 19], [26, 23], [28, 16], [22, 12], [29, 11]], 'g3')
  r.set(31, 12, 's4')
  r.outline('k')
  sparkle(r, 10, 22, 2, 'v3', 'v4')
  sparkle(r, 54, 18, 2, 'v3', 'v4')
})

// The Archmage's entrance: a circlet of gold with a violet star-stone, three motes round it
icon('mastery-mage', (r) => {
  r.poly([[8, 40], [14, 26], [22, 34], [32, 18], [42, 34], [50, 26], [56, 40], [56, 48], [8, 48]], 'g2')
  r.poly([[10, 42], [14, 30], [20, 36], [32, 22], [32, 46], [10, 46]], 'g3')
  r.rect(8, 44, 48, 4, 'g1')
  r.ellipse(32, 36, 6, 7, 'v1')
  r.ellipse(31, 35, 4, 5, 'v3')
  r.set(30, 33, 'v4')
  r.ellipse(16, 42, 2, 2, 'i2')
  r.ellipse(48, 42, 2, 2, 'r2')
  r.outline('k')
  // the motes that wheel round it: fire, ice, light
  ball(r, 10, 14, 4, ['r2', 'f2', 'f3'])
  ball(r, 54, 14, 4, ['i1', 'i2', 'i4'])
  ball(r, 32, 6, 3.5, ['y1', 'y2', 'y3'])
  r.outline('k')
  arc(r, 32, 30, 26, 200, 340, 'v3', 1)
})

// ---------------------------------------------------------------- the first tree, deeper

// Arcane Missiles: three violet bolts flying side by side, trailing light
icon('arcane-missiles', (r) => {
  for (const [x, y] of [[44, 14], [50, 30], [38, 44]] as const) {
    thick(r, [x - 26, y + 12], [x - 6, y + 3], 'v2', 3)
    r.line(x - 30, y + 14, x - 6, y + 3, 'v3')
  }
  r.outline('k', ['v3'])
  for (const [x, y] of [[44, 14], [50, 30], [38, 44]] as const) {
    ball(r, x, y, 6, ['v1', 'v2', 'v4', 's4'])
  }
  r.outline('k', ['v3'])
  sparkle(r, 58, 48, 2, 'v3', 'v4')
})

// Mana Ward: a kite shield of blue light, a rune burning on it
icon('mana-ward', (r) => {
  r.poly([[32, 6], [54, 14], [52, 34], [32, 58], [12, 34], [10, 14]], 'n1')
  r.poly([[32, 10], [50, 17], [48, 33], [32, 53], [16, 33], [14, 17]], 'n2')
  r.poly([[32, 10], [14, 17], [16, 33], [32, 53]], 'n3')
  // the rune
  thick(r, [32, 18], [32, 44], 'i4', 2)
  thick(r, [24, 24], [40, 24], 'i4', 2)
  thick(r, [26, 36], [32, 30], 'i4', 2)
  thick(r, [38, 36], [32, 30], 'i4', 2)
  r.line(15, 18, 30, 12, 's4')
  r.outline('k')
  arc(r, 32, 32, 29, 210, 330, 'n3', 1)
  arc(r, 32, 32, 29, 30, 150, 'n3', 1)
})

// Focus: a crystal prism, a broad beam going in and a narrow bright one coming out
icon('focus', (r) => {
  // the light that goes in
  r.poly([[2, 26], [22, 30], [22, 38], [2, 44]], 'v3')
  r.poly([[2, 31], [22, 33], [22, 35], [2, 39]], 'v4')
  r.poly([[30, 14], [46, 46], [16, 46]], 'i2')
  r.poly([[30, 14], [30, 46], [16, 46]], 'i3')
  r.line(29, 18, 20, 44, 'i4')
  r.outline('k', ['v3', 'v4'])
  // the light that comes out, narrowed
  thick(r, [40, 34], [62, 34], 'v4', 3)
  r.line(40, 34, 62, 34, 's4')
  sparkle(r, 58, 28, 2, 'v4', 's4')
})

// Spell Power: a rune stone with a rising glyph burning violet
icon('spell-power', (r) => {
  r.poly([[18, 8], [46, 8], [52, 18], [50, 56], [14, 56], [12, 18]], 'm1')
  r.poly([[18, 10], [44, 10], [49, 19], [47, 54], [17, 54], [15, 19]], 'm2')
  r.poly([[18, 10], [28, 10], [24, 54], [17, 54], [15, 19]], 'm3')
  // the glyph burning in it: an arrow up through two bars
  thick(r, [32, 20], [32, 48], 'v2', 5)
  r.poly([[22, 30], [32, 16], [42, 30]], 'v2')
  thick(r, [22, 38], [42, 38], 'v2', 4)
  thick(r, [24, 46], [40, 46], 'v2', 3)
  thick(r, [32, 22], [32, 47], 'v4', 1)
  r.poly([[26, 28], [32, 20], [38, 28]], 'v3')
  r.line(23, 38, 41, 38, 'v3')
  r.line(25, 46, 39, 46, 'v3')
  r.outline('k')
  sparkle(r, 56, 12, 2, 'v3', 'v4')
  sparkle(r, 8, 46, 2, 'v3', 'v4')
  sparkle(r, 54, 50, 1, 'v3', 'v4')
})

// ---------------------------------------------------------------- written

const mine = new Set(Object.keys(out))
for (const id of mine) {
  const path = join(OUT, 'skills', `${id}.png`)
  // (never over another's picture: only this file's own ids, and only once drawn here)
  if (existsSync(path) && !process.env.REDRAW_ADV_MAGE) throw new Error(`skill-adv-mage: ${id}.png exists; set REDRAW_ADV_MAGE=1 to redraw this file's own`)
}
for (const [id, r] of Object.entries(out)) writeAtlas(`skills/${id}.png`, [[r]], PAL)
console.log(`${mine.size} mage advancement icons → public/assets/lsw/skills`)
