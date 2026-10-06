// The White Knight Alberic, First Seal-bearer (docs/chapter-1.md §4, docs/lore.md §6): the project's
// own pixel art, drawn by code from the user's reference (a great helm grown through with a crown of
// thorns, a torn white tabard with gold work and old blood, a longsword pointed at the ground, a
// bow and a quiver). Parts are drawn back to front, each outlined in the pack's style.
//
// - actions.png: 4 columns x 5 rows of 48x48 frames — idle, walk, attack (the sword plunged:
//   thorns), cast (the bow drawn and loosed), hurt (2) + death (he lifts the crown off and holds it
//   out; he lies still, the crown beside him). Facing right; the renderer mirrors him.
// - effect-arrow.png, effect-volley.png, effect-thorns.png: four 64x64 frames each.
//
//   npx tsx packages/tools/src/art/alberic.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const DIR = 'Bosses/alberic'

const PAL: Palette = {
  k: [31, 26, 36, 255], // outline
  A1: [236, 239, 242, 255], // armour, light
  A2: [185, 192, 200, 255], // armour
  A3: [124, 134, 146, 255], // armour, shadow
  V: [36, 30, 44, 255], // the visor's dark
  W1: [244, 239, 226, 255], // tabard
  W2: [216, 207, 184, 255], // tabard shade
  W3: [168, 156, 132, 255], // tabard deep fold
  G1: [232, 196, 90, 255], // gold
  G2: [176, 138, 50, 255], // gold shade
  R1: [142, 42, 42, 255], // old blood
  R2: [94, 26, 29, 255], // dried blood
  T1: [107, 74, 43, 255], // thorn
  T2: [62, 42, 24, 255], // thorn, dark
  S1: [246, 248, 251, 255], // blade
  S2: [201, 210, 220, 255], // blade edge
  B1: [106, 69, 38, 255], // bow wood
  B2: [61, 38, 20, 255], // bow wood, dark
  N: [217, 210, 194, 255], // bowstring
  L: [90, 59, 38, 255], // leather
  F: [240, 236, 222, 255], // fletching
  Y: [255, 246, 200, 255], // holy light
  Yg: [255, 238, 160, 180], // glow, soft
  Yf: [255, 250, 225, 110], // glow, faint
  D: [185, 173, 148, 200], // dust
  Df: [185, 173, 148, 110], // dust, fading
}
/** Glows and dust cast no outline. */
const SOFT = ['Yg', 'Yf', 'D', 'Df', 'Y']

const S = 48

type Sword = 'down' | 'raised' | 'high' | 'plunge' | 'sheathed' | 'planted'
type Bow = 'hold' | 'raise' | 'draw' | 'loose' | 'slung'
interface Pose {
  bob?: number
  liftL?: number
  liftR?: number
  strideL?: number
  strideR?: number
  sway?: number
  sword: Sword
  bow: Bow
  glint?: boolean
  glow?: number
  flash?: boolean
}

/** Draw a part in its own raster, outline it, and stamp it on the figure. */
function part(into: Raster, draw: (r: Raster) => void, outline = true): void {
  const r = new Raster(into.w, into.h)
  draw(r)
  if (outline) r.outline('k', SOFT)
  for (let i = 0; i < r.px.length; i++) if (r.px[i] !== null) into.px[i] = r.px[i]
}

/** A jagged, torn hem: how far each column is torn up (deterministic). */
const tear = (x: number) => [0, 2, 1, 0, 3, 1, 0, 2, 0, 1, 3, 0, 1, 2, 0, 0, 2, 1][((x % 18) + 18) % 18]

function crown(r: Raster, cx: number, y: number, glint = false): void {
  // a twisted band of briars, thin spikes standing out of it (up, and out at the sides)
  for (let x = cx - 5; x <= cx + 5; x++) {
    r.set(x, y + ((x + cx) % 2), 'T2')
    r.set(x, y + 1 - ((x + cx) % 2), (x + cx) % 3 ? 'T2' : 'T1')
  }
  for (const [dx, dy] of [[-4, -3], [-1, -3], [2, -2], [4, -3]] as const) r.line(cx + dx, y - 1, cx + dx + Math.sign(dx) * 0.6, y + dy, 'T2')
  r.line(cx - 6, y + 1, cx - 7, y, 'T2')
  r.line(cx + 6, y, cx + 7, y - 1, 'T2')
  if (glint) r.set(cx - 1, y - 1, 'Y')
}

function knight(p: Pose): Raster {
  const r = new Raster(S, S)
  const b = p.bob ?? 0
  const sw = p.sway ?? 0
  // the quiver on his back, its arrows over the shoulder
  part(r, (q) => {
    q.line(13, 6 + b, 17, 15 + b, 'L', 2)
    for (const [x, y] of [[11, 2], [13, 1], [12, 3]] as const) {
      q.line(x, y + b, x + 2, y + 4 + b, 'B1')
      q.set(x, y + b, 'F')
      q.set(x - 1, y + b, 'F')
    }
  })
  // the cape behind, torn at the hem, old blood low on it
  part(r, (c) => {
    c.poly([[15, 15 + b], [33, 15 + b], [38 + sw, 44], [10 + sw, 44]], 'W2')
    for (let x = 9; x <= 39; x++) for (let t = 0; t < tear(x); t++) c.set(x + 0, 44 - t, null)
    c.line(13 + sw, 40, 16, 20 + b, 'W3')
    c.line(35 + sw, 40, 32, 20 + b, 'W3')
    for (const [x, y] of [[12, 42], [13, 41], [35, 43], [36, 41], [34, 42]] as const) c.set(x + sw, y, 'R2')
  })
  // the legs: greaves and sabatons
  const leg = (x: number, lift: number, stride: number) =>
    part(r, (g) => {
      const x0 = x + stride
      g.rect(x0, 37 + b - lift, 4, 8, 'A2')
      g.rect(x0 + 3, 37 + b - lift, 1, 8, 'A3')
      g.rect(x0, 39 + b - lift, 4, 1, 'A1')
      g.rect(x0, 45 - lift, 5, 1, 'A3')
      g.set(x0 + 4, 44 - lift, 'A2')
    })
  leg(19, p.liftL ?? 0, p.strideL ?? 0)
  leg(25, p.liftR ?? 0, p.strideR ?? 0)
  // the tabard's skirt: white, gold at the hem, torn, a stain spreading from the left
  part(r, (t) => {
    t.poly([[17, 27 + b], [31, 27 + b], [33 + sw, 41 + b], [15 + sw, 41 + b]], 'W1')
    t.line(24, 28 + b, 24 + sw, 40 + b, 'W2')
    t.line(19, 29 + b, 17 + sw, 40 + b, 'W2')
    for (let x = 15; x <= 33; x++) {
      const torn = tear(x + 5)
      t.set(x + sw, 41 + b - torn, torn ? null : 'G1')
      for (let k = 0; k < torn; k++) t.set(x + sw, 41 + b - k, null)
    }
    for (const [x, y] of [[28, 36], [29, 37], [30, 38], [29, 39], [30, 40], [31, 39]] as const) t.set(x + sw, y + b, 'R1')
    t.set(29 + sw, 41 + b, 'R2')
  })
  // the chest: plate under the tabard's front, the gold cross, the belt
  part(r, (c) => {
    c.rect(17, 15 + b, 14, 13, 'A2')
    c.rect(17, 15 + b, 2, 13, 'A3')
    c.rect(20, 16 + b, 8, 12, 'W1')
    c.rect(27, 16 + b, 1, 12, 'W2')
    c.rect(23, 18 + b, 2, 8, 'G1')
    c.rect(21, 20 + b, 6, 2, 'G1')
    c.set(24, 25 + b, 'G2')
    c.rect(17, 27 + b, 14, 2, 'L')
    c.rect(23, 27 + b, 2, 2, 'G1')
  })
  // the pauldrons
  part(r, (s) => {
    s.ellipse(17, 17 + b, 3, 2, 'A1')
    s.rect(15, 18 + b, 5, 1, 'A2')
    s.ellipse(31, 17 + b, 3, 2, 'A2')
    s.rect(29, 18 + b, 5, 1, 'A3')
  })
  // the great helm, its visor's slit, the crown grown into it
  part(r, (h) => {
    h.rect(20, 6 + b, 8, 9, 'A1')
    h.rect(21, 5 + b, 6, 1, 'A1')
    h.rect(26, 6 + b, 2, 9, 'A2')
    h.rect(20, 10 + b, 8, 1, 'V')
    h.rect(23, 11 + b, 2, 3, 'V')
    h.set(21, 12 + b, 'A2')
    h.set(26, 12 + b, 'A3')
    h.rect(21, 15 + b, 6, 1, 'A3')
    crown(h, 24, 6 + b, p.glint)
  })
  // the sword arm (his right: the viewer's left) and the sword
  part(r, (a) => {
    const blade = (x: number, y0: number, y1: number) => {
      const d = y1 > y0 ? 1 : -1
      for (let y = y0; y !== y1; y += d) {
        a.set(x, y, 'S1')
        a.set(x + 1, y, 'S2')
      }
      a.set(x, y1, 'S1')
    }
    switch (p.sword) {
      case 'down':
        a.rect(14, 18 + b, 3, 7, 'A2')
        a.rect(14, 25 + b, 3, 3, 'A1')
        a.set(15, 23 + b, 'G1')
        a.rect(12, 28 + b, 7, 1, 'G1')
        a.set(15, 28 + b, 'G2')
        blade(15, 29 + b, 45)
        break
      case 'raised':
      case 'high':
        a.line(16, 17 + b, 15, 10 + b, 'A2', 3)
        a.rect(14, 8 + b, 3, 3, 'A1')
        a.rect(12, 7 + b, 7, 1, 'G1')
        a.set(15, 11 + b, 'G1')
        blade(15, 6 + b, 0)
        if (p.sword === 'high') for (const [x, y] of [[13, 1], [18, 2], [12, 4], [19, 5], [17, 0]] as const) a.set(x, y + b, 'Yg')
        break
      case 'plunge':
        a.line(16, 18 + b, 21, 22 + b, 'A2', 3)
        a.line(31, 18 + b, 26, 22 + b, 'A2', 3)
        a.rect(21, 21 + b, 6, 3, 'A1')
        a.set(23, 20 + b, 'G1')
        a.set(24, 20 + b, 'G1')
        a.rect(19, 24 + b, 10, 1, 'G1')
        blade(23, 25 + b, 46)
        break
      case 'sheathed':
        a.rect(14, 18 + b, 3, 7, 'A2')
        a.rect(14, 25 + b, 3, 3, 'A1')
        a.rect(16, 27 + b, 1, 2, 'G1')
        a.line(16, 29 + b, 15, 40 + b, 'L')
        break
      case 'planted':
        a.rect(14, 22 + b, 3, 6, 'A2')
        a.rect(13, 26 + b, 3, 2, 'A1')
        a.rect(11, 28 + b, 7, 1, 'G1')
        blade(14, 29 + b, 46)
        break
    }
  })
  // the bow arm (his left: the viewer's right) and the bow
  part(r, (a) => {
    const arc = (x: number, top: number, bottom: number, bend: number) => {
      const mid = (top + bottom) / 2
      for (let y = top; y <= bottom; y++) {
        const t = (y - mid) / ((bottom - top) / 2)
        const x1 = Math.round(x + bend * (1 - t * t))
        a.set(x1, y, 'B1')
        a.set(x1 + 1, y, 'B2')
      }
      a.set(x - 1, top, 'B2')
      a.set(x - 1, bottom, 'B2')
    }
    switch (p.bow) {
      case 'hold':
        a.rect(31, 18 + b, 3, 7, 'A3')
        a.rect(32, 25 + b, 3, 3, 'A2')
        arc(35, 13 + b, 39 + b, 2)
        a.line(34, 13 + b, 34, 39 + b, 'N')
        break
      case 'slung':
        a.line(28, 15 + b, 19, 30 + b, 'B1')
        break
      case 'raise':
      case 'draw':
      case 'loose': {
        a.line(31, 18 + b, 38, 19 + b, 'A3', 3)
        a.rect(38, 18 + b, 2, 3, 'A2')
        arc(40, 6 + b, 32 + b, 2)
        if (p.bow === 'draw') {
          a.line(39, 7 + b, 31, 19 + b, 'N')
          a.line(31, 19 + b, 39, 31 + b, 'N')
          a.line(31, 19 + b, 45, 19 + b, 'S2')
          a.set(46, 19 + b, 'G1')
          a.set(46, 18 + b, 'G1')
          a.set(46, 20 + b, 'G1')
          a.set(30, 18 + b, 'F')
          a.set(30, 20 + b, 'F')
        } else a.line(39, 7 + b, 39, 31 + b, 'N')
        if (p.bow === 'loose') for (const [x, y] of [[44, 19], [45, 17], [45, 21], [46, 19], [43, 16], [43, 22]] as const) a.set(x, y + b, 'Yg')
        break
      }
    }
    // the drawing hand: the sword arm reaches to the string
    if (p.bow === 'draw') a.line(17, 18 + b, 30, 19 + b, 'A2', 2)
  })
  if (p.glow) for (const [x, y] of [[23, 2], [26, 3], [21, 3]] as const) r.under(x, y + b, 'Yf')
  if (p.flash) r.recolor({ A2: 'A1', A3: 'A2', W2: 'W1', W3: 'W2', T1: 'Y', R1: 'W2' })
  return r
}

/** He kneels, sword planted, the crown lifted off and held out in his bow hand. */
function kneeling(): Raster {
  const r = new Raster(S, S)
  const b = 6
  part(r, (c) => {
    c.poly([[15, 15 + b], [33, 15 + b], [37, 45], [11, 45]], 'W2')
    for (let x = 10; x <= 38; x++) for (let t = 0; t < tear(x); t++) c.set(x, 45 - t, null)
  })
  part(r, (g) => {
    g.rect(19, 38, 8, 4, 'A2') // the knee down
    g.rect(27, 41, 6, 4, 'A2') // the shin along the ground
    g.rect(19, 38, 8, 1, 'A1')
  })
  part(r, (t) => {
    t.poly([[17, 27 + b], [31, 27 + b], [33, 43], [15, 43]], 'W1')
    for (const [x, y] of [[28, 38], [29, 39], [30, 40]] as const) t.set(x, y, 'R1')
  })
  part(r, (c) => {
    c.rect(17, 15 + b, 14, 13, 'A2')
    c.rect(20, 16 + b, 8, 12, 'W1')
    c.rect(23, 18 + b, 2, 8, 'G1')
    c.rect(21, 20 + b, 6, 2, 'G1')
    c.rect(17, 27 + b, 14, 2, 'L')
  })
  part(r, (h) => {
    // the bare helm bowed: no crown on it now
    h.rect(20, 8 + b, 8, 8, 'A1')
    h.rect(26, 8 + b, 2, 8, 'A2')
    h.rect(21, 12 + b, 7, 1, 'V')
    h.rect(21, 16 + b, 6, 1, 'A3')
  })
  part(r, (a) => {
    a.rect(13, 22 + b, 3, 6, 'A2')
    a.rect(11, 28 + b, 7, 1, 'G1')
    for (let y = 29 + b; y <= 46; y++) {
      a.set(14, y, 'S1')
      a.set(15, y, 'S2')
    }
  })
  part(r, (a) => {
    a.line(31, 18 + b, 38, 22 + b, 'A3', 3)
    a.rect(38, 21 + b, 3, 3, 'A2')
    crown(a, 40, 18 + b, true)
  })
  for (const [x, y] of [[40, 20], [44, 22], [37, 21], [42, 17]] as const) r.under(x, y, 'Yf')
  return r
}

/** He lies still; the crown on the ground beside him. */
function fallen(): Raster {
  const r = new Raster(S, S)
  part(r, (c) => {
    c.poly([[6, 37], [34, 36], [38, 46], [4, 46]], 'W2')
    for (let x = 4; x <= 38; x++) for (let t = 0; t < tear(x) - 1; t++) c.set(x, 46 - t, null)
  })
  part(r, (b) => {
    b.rect(14, 39, 18, 6, 'A2') // the body along the ground
    b.rect(16, 39, 12, 5, 'W1')
    b.rect(20, 40, 2, 4, 'G1')
    b.rect(32, 41, 7, 3, 'A2') // the legs
    b.rect(39, 41, 2, 4, 'A3')
  })
  part(r, (h) => {
    h.rect(7, 38, 7, 7, 'A1')
    h.rect(8, 41, 5, 1, 'V')
  })
  part(r, (s) => {
    for (let x = 3; x <= 30; x++) {
      s.set(x, 46, 'S2')
    }
    s.rect(10, 45, 1, 2, 'G1')
  })
  part(r, (c) => crown(c, 42, 44, true))
  return r
}

// ---------------------------------------------------------------- the frames

const IDLE: Pose[] = [
  { sword: 'down', bow: 'hold' },
  { sword: 'down', bow: 'hold', sway: 1 },
  { sword: 'down', bow: 'hold', bob: 1, sway: 1, glint: true },
  { sword: 'down', bow: 'hold', sway: 0 },
]
const WALK: Pose[] = [
  { sword: 'down', bow: 'hold', liftL: 2, strideL: 1, sway: -1 },
  { sword: 'down', bow: 'hold', bob: -1 },
  { sword: 'down', bow: 'hold', liftR: 2, strideR: 1, sway: 1 },
  { sword: 'down', bow: 'hold', bob: -1 },
]
// the thorns: the sword lifted, held high and burning, plunged, and the knight rising from it
const ATTACK: Pose[] = [
  { sword: 'raised', bow: 'slung', bob: -1 },
  { sword: 'high', bow: 'slung', bob: -1, glow: 1, glint: true },
  { sword: 'plunge', bow: 'slung', bob: 2 },
  { sword: 'plunge', bow: 'slung', bob: 1 },
]
// the bow: raised, drawn, loosed, lowered
const CAST: Pose[] = [
  { sword: 'sheathed', bow: 'raise' },
  { sword: 'sheathed', bow: 'draw', glow: 1 },
  { sword: 'sheathed', bow: 'loose', glint: true },
  { sword: 'sheathed', bow: 'raise', bob: 1 },
]
const HURT: Raster[] = [knight({ sword: 'down', bow: 'hold', bob: 1, sway: -2, flash: true }), knight({ sword: 'down', bow: 'hold', bob: 2, sway: -1 })]

writeAtlas(
  `${DIR}/actions.png`,
  [IDLE.map(knight), WALK.map(knight), ATTACK.map(knight), CAST.map(knight), [...HURT, kneeling(), fallen()]],
  PAL,
)

// ---------------------------------------------------------------- the effects (64x64)

const E = 64

/** A feather drifting: a short white spine with a darker shaft. */
function feather(r: Raster, x: number, y: number, tilt: number): void {
  r.line(x, y, x + tilt, y + 4, 'F')
  r.line(x + 1, y, x + 1 + tilt, y + 4, 'F')
  r.set(x + Math.round(tilt / 2), y + 2, 'W3')
}

/** The Arrow of Conquest's impact: a holy burst, rays, feathers flung out. */
function arrowFrame(f: number): Raster {
  const r = new Raster(E, E)
  const c = 32
  const rays = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]] as const
  if (f === 0) {
    r.ellipse(c, c, 4, 4, 'Yg')
    r.ellipse(c, c, 2, 2, 'Y')
  }
  if (f === 1) {
    r.ellipse(c, c, 8, 8, 'Yf')
    r.ellipse(c, c, 5, 5, 'Yg')
    r.ellipse(c, c, 3, 3, 'Y')
    for (const [dx, dy] of rays) r.line(c + dx * 6, c + dy * 6, c + dx * 15, c + dy * 15, dx && dy ? 'Yg' : 'G1')
  }
  if (f === 2) {
    for (let a = 0; a < 48; a++) r.set(c + Math.round(Math.cos((a / 48) * Math.PI * 2) * 16), c + Math.round(Math.sin((a / 48) * Math.PI * 2) * 16), 'Yg')
    r.ellipse(c, c, 3, 3, 'Yf')
    for (const [dx, dy] of rays) r.line(c + dx * 18, c + dy * 18, c + dx * 22, c + dy * 22, 'Yf')
    for (const [x, y, t] of [[18, 20, 2], [44, 22, -2], [24, 44, 1], [42, 40, -1]] as const) feather(r, x, y, t)
  }
  if (f === 3) {
    for (const [x, y] of [[c, c - 20], [c + 21, c], [c - 19, c + 3], [c + 4, c + 22], [c - 14, c - 14]] as const) r.set(x, y, 'Yf')
    for (const [x, y, t] of [[12, 22, 2], [48, 24, -2], [20, 50, 1], [46, 46, -1]] as const) feather(r, x, y, t)
  }
  r.outline('k', SOFT)
  return r
}

/** An arrow falling, point down: the shaft, its gold head, its fletching. */
function arrow(r: Raster, x: number, tip: number, streak = 0): void {
  for (let s = 1; s <= streak; s++) r.under(x, tip - 12 - s * 2, 'Yf')
  r.line(x, tip - 11, x, tip - 1, 'S2')
  r.set(x, tip, 'G1')
  r.set(x - 1, tip - 1, 'G1')
  r.set(x + 1, tip - 1, 'G1')
  for (const dy of [11, 10, 9]) {
    r.set(x - 1, tip - dy, 'F')
    r.set(x + 1, tip - dy, 'F')
  }
}

/** The White-Feather Volley: arrows fall, strike, and stand in the dust. */
function volleyFrame(f: number): Raster {
  const r = new Raster(E, E)
  const xs = [16, 25, 32, 40, 48]
  const ground = 50
  if (f === 0) xs.forEach((x, i) => arrow(r, x, 14 + ((i * 7) % 11), 3))
  if (f === 1) xs.forEach((x, i) => arrow(r, x, 34 + ((i * 5) % 9), 4))
  if (f >= 2) {
    xs.forEach((x, i) => arrow(r, x, ground - 2 + (i % 2), 0))
    const dust = f === 2 ? 'D' : 'Df'
    for (const x of xs) {
      r.under(x - 3, ground, dust)
      r.under(x + 3, ground, dust)
      r.under(x - 2, ground - 1, dust)
      r.under(x + 2, ground - 1, dust)
      if (f === 2) {
        r.under(x - 4, ground - 2, dust)
        r.under(x + 4, ground - 2, dust)
        r.under(x, ground + 1, 'Yg')
      }
    }
    if (f === 3) for (const [x, y] of [[28, 40], [38, 38]] as const) r.set(x, y, 'Yf')
  }
  r.outline('k', SOFT)
  return r
}

/** A thorn: a curved spike from the ground, dark along one side. */
function thorn(r: Raster, x: number, ground: number, h: number, lean: number): void {
  for (let i = 0; i < h; i++) {
    const t = i / h
    const cx = Math.round(x + lean * t * t * h * 0.12)
    const w = Math.max(0, Math.round((1 - t) * 1.6))
    for (let dx = -w; dx <= w; dx++) r.set(cx + dx, ground - i, dx === -w && w > 0 ? 'T1' : 'T2')
    // hooked side thorns, alternating sides, pointing up and out
    if (i > 3 && i < h - 2 && i % 5 === 0) {
      const side = (i / 5) % 2 ? 1 : -1
      r.set(cx + side * (w + 1), ground - i, 'T2')
      r.set(cx + side * (w + 2), ground - i - 1, 'T2')
    }
  }
}

/** Thorns Bend the Knee: the ground cracks, briars burst up, red at the tips, and sink. */
function thornsFrame(f: number): Raster {
  const r = new Raster(E, E)
  const g = 52
  const spikes = [[18, -3], [25, -1], [32, 0], [39, 1], [46, 3], [22, -2], [36, 1], [43, 2]] as const
  const heights = [[0, 0, 0, 0, 0, 0, 0, 0], [9, 14, 17, 13, 8, 5, 7, 4], [20, 30, 38, 28, 18, 11, 14, 9], [8, 12, 15, 11, 7, 4, 6, 3]][f]
  if (f === 0) {
    for (const [x1, y1] of [[20, 55], [44, 56], [26, 58], [38, 58], [31, 57]] as const) r.line(32, g + 1, x1, y1, 'T2')
    for (const [x] of spikes) thorn(r, x, g, 3, 0)
  } else spikes.forEach(([x, lean], i) => thorn(r, x, g, heights[i], lean))
  if (f === 2) {
    spikes.forEach(([x, lean], i) => {
      const tx = Math.round(x + lean * heights[i] * 0.12)
      r.set(tx, g - heights[i] + 1, 'R1')
      r.set(tx, g - heights[i] + 2, 'R1')
    })
    for (const [x, y] of [[32, 30], [26, 38], [39, 36]] as const) r.under(x, y, 'Yg')
  }
  if (f === 3) for (const [x, y] of [[22, 50], [40, 51], [30, 49]] as const) r.under(x, y, 'Df')
  r.outline('k', SOFT)
  return r
}

for (const [name, draw] of [['arrow', arrowFrame], ['volley', volleyFrame], ['thorns', thornsFrame]] as const) writeAtlas(`${DIR}/effect-${name}.png`, [[0, 1, 2, 3].map((f) => draw(f))], PAL)
console.log(`alberic → public/assets/lsw/${DIR}`)
