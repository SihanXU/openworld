// The smithing branch's skill icons (the life tree's forge: smelting, steel and gold, the weaponsmith's and the
// armoursmith's arts, quality and the masters), 64x64, drawn by code in the look of the active skills' icons
// (skill-actives.ts): one bold emblem, a dark outline, three or four tones a colour, a few bright accents — here the
// forge's steel greys, glowing orange, coal black and gold. And the ingot the forge smelts (16x16, the look of the
// gear icons, gear.ts): one neutral grey bar the game tints by its metal.
//
//   npx tsx packages/tools/src/art/skill-life-smithing.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  k: [40, 18, 14, 255],
  // steel
  s1: [78, 84, 100, 255], s2: [138, 146, 162, 255], s3: [198, 205, 216, 255], s4: [246, 248, 252, 255],
  // blue steel
  u1: [44, 70, 112, 255], u2: [84, 124, 176, 255], u3: [150, 190, 230, 255], u4: [224, 240, 255, 255],
  // iron of the anvil, coal
  b1: [28, 28, 38, 255], b2: [58, 58, 74, 255], b3: [100, 100, 122, 255],
  // wood
  w1: [86, 46, 26, 255], w2: [136, 80, 42, 255], w3: [188, 124, 68, 255],
  // gold
  g1: [146, 92, 28, 255], g2: [212, 150, 50, 255], g3: [250, 208, 98, 255], g4: [255, 244, 196, 255],
  // fire, glowing metal
  f1: [196, 64, 28, 255], f2: [240, 126, 38, 255], f3: [255, 196, 76, 255], f4: [255, 242, 172, 255],
  // red (the legendary aura)
  r1: [116, 28, 30, 255], r2: [188, 50, 44, 255], r3: [234, 98, 72, 255],
  // stone
  e1: [78, 72, 70, 255], e2: [118, 110, 104, 255], e3: [160, 152, 142, 255],
  // ore (rust-brown with flecks)
  o1: [92, 52, 36, 255], o2: [142, 86, 58, 255], o3: [190, 128, 88, 255],
  // purple (masterwork)
  v1: [56, 28, 86, 255], v2: [106, 58, 148, 255], v3: [168, 108, 210, 255], v4: [226, 192, 252, 255],
  // gem
  c1: [24, 96, 120, 255], c2: [54, 170, 196, 255], c3: [170, 240, 250, 255],
  // laurel green
  l1: [46, 92, 40, 255], l2: [84, 148, 64, 255], l3: [148, 204, 104, 255],
}

const S = 64
type P = [number, number]
type Ramp = [string, string, string, string?]
const STEEL: Ramp = ['s1', 's2', 's3', 's4']
const BLUE: Ramp = ['u1', 'u2', 'u3', 'u4']
const GOLD: Ramp = ['g1', 'g2', 'g3', 'g4']
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

function sword(r: Raster, hilt: P, point: P, h: number, grip = 7, ramp: Ramp = STEEL, guard: Ramp = GOLD): void {
  const len = Math.hypot(point[0] - hilt[0], point[1] - hilt[1])
  const d: P = [(point[0] - hilt[0]) / len, (point[1] - hilt[1]) / len]
  const n: P = [-d[1], d[0]]
  blade(r, hilt, point, h, ramp)
  const g = h + 3
  thick(r, [hilt[0] + n[0] * g, hilt[1] + n[1] * g], [hilt[0] - n[0] * g, hilt[1] - n[1] * g], guard[1], 2)
  r.set(hilt[0] + n[0] * g, hilt[1] + n[1] * g, guard[2])
  const end: P = [hilt[0] - d[0] * grip, hilt[1] - d[1] * grip]
  thick(r, [hilt[0] - d[0] * 2, hilt[1] - d[1] * 2], end, 'w2', 2)
  r.ellipse(end[0] - d[0], end[1] - d[1], 1.6, 1.6, guard[1])
  r.set(end[0] - d[0] - 0.6, end[1] - d[1] - 0.6, guard[2])
}

function sparkle(r: Raster, x: number, y: number, s: number, c: string, core = c): void {
  r.line(x - s, y, x + s, y, c)
  r.line(x, y - s, x, y + s, c)
  r.set(x, y, core)
}

/** Sparks flying up from a strike: short bright dashes. */
function sparks(r: Raster, x: number, y: number, n = 5, spread = 10): void {
  for (let i = 0; i < n; i++) {
    const a = ((-160 + (140 * i) / Math.max(1, n - 1)) * Math.PI) / 180
    const x0 = x + Math.cos(a) * 3
    const y0 = y + Math.sin(a) * 3
    const x1 = x + Math.cos(a) * spread
    const y1 = y + Math.sin(a) * spread
    r.line(x0, y0, x1, y1, i % 2 ? 'f3' : 'f2')
    r.set(x1, y1, 'f4')
  }
}

/** An anvil, its face at y, centred on cx, `w` wide. */
function anvil(r: Raster, cx: number, y: number, w = 36): void {
  const h = w / 2
  // the horn to the left, the face, the waist, the foot
  r.poly([[cx - h - 8, y + 1], [cx - h, y], [cx - h, y + 6], [cx - h - 2, y + 5]], 'b2')
  r.rect(cx - h, y, w, 7, 'b2')
  r.rect(cx - h, y, w, 2, 'b3')
  r.poly([[cx - h * 0.45, y + 7], [cx + h * 0.45, y + 7], [cx + h * 0.3, y + 14], [cx - h * 0.3, y + 14]], 'b1')
  r.rect(cx - h * 0.7, y + 14, w * 0.7, 5, 'b2')
  r.line(cx - h * 0.7, y + 14, cx + h * 0.7 - 1, y + 14, 'b3')
  r.line(cx - h + 2, y, cx + h - 3, y, 's2')
}

/** A smith's hammer: its head at `head`, the haft down to `end`. */
function hammer(r: Raster, head: P, end: P, ramp: Ramp = STEEL, haft = 'w2'): void {
  thick(r, head, end, haft, 3)
  thick(r, [head[0] + 1, head[1]], [end[0] + 1, end[1]], 'w3', 1)
  const len = Math.hypot(end[0] - head[0], end[1] - head[1])
  const d: P = [(end[0] - head[0]) / len, (end[1] - head[1]) / len]
  const n: P = [-d[1], d[0]]
  const a: P = [head[0] + n[0] * 9, head[1] + n[1] * 9]
  const b: P = [head[0] - n[0] * 7, head[1] - n[1] * 7]
  thick(r, a, b, ramp[0], 9)
  thick(r, a, b, ramp[1], 7)
  thick(r, [a[0] - d[0] * 2, a[1] - d[1] * 2], [b[0] - d[0] * 2, b[1] - d[1] * 2], ramp[2], 2)
  if (ramp[3]) r.set(a[0] - d[0] * 2, a[1] - d[1] * 2, ramp[3])
}

/** An ingot seen from the front and a little above: a trapezoid bar with a lit top. */
function ingot(r: Raster, cx: number, cy: number, w: number, ramp: Ramp): void {
  const h = w * 0.36
  const top = w * 0.72
  r.poly([[cx - w / 2, cy + h / 2], [cx + w / 2, cy + h / 2], [cx + top / 2, cy - h / 2], [cx - top / 2, cy - h / 2]], ramp[1])
  r.poly([[cx - top / 2, cy - h / 2], [cx + top / 2, cy - h / 2], [cx + top / 2 - 2, cy - h / 2 - 3], [cx - top / 2 + 2, cy - h / 2 - 3]], ramp[2])
  r.line(cx - top / 2 + 3, cy - h / 2 - 2, cx + top / 2 - 4, cy - h / 2 - 2, ramp[3] ?? ramp[2])
  r.line(cx - w / 2 + 1, cy + h / 2 - 1, cx + w / 2 - 1, cy + h / 2 - 1, ramp[0])
  r.line(cx - top / 2 + 2, cy - h / 2 + 2, cx - w / 2 + 3, cy + h / 2 - 2, ramp[2])
}

/** A laurel: two arcs of leaves under something, opening upwards. */
function laurel(r: Raster, cx: number, cy: number, rad: number): void {
  for (const side of [-1, 1]) {
    // the stem, then leaves along it, pointing up its curve
    arc(r, cx, cy, rad, side < 0 ? 100 : -20, side < 0 ? 200 : 80, 'l1', 1)
    for (let i = 0; i < 5; i++) {
      const deg = 90 + side * (25 + i * 22)
      const a = (deg * Math.PI) / 180
      const x = cx + Math.cos(a) * rad
      const y = cy + Math.sin(a) * rad
      const t = (deg + side * 90) * Math.PI / 180
      const tip: P = [x + Math.cos(t) * 5, y + Math.sin(t) * 5]
      r.poly([[x - 1.5, y], [tip[0], tip[1]], [x + 1.5, y]], 'l2')
      r.ellipse((x + tip[0]) / 2, (y + tip[1]) / 2, 2, 2, i % 2 ? 'l2' : 'l3')
    }
  }
}

/** A crown: three points and a gold band. */
function crown(r: Raster, cx: number, cy: number, w: number): void {
  const h = w / 2
  r.poly([[cx - h, cy + 5], [cx - h, cy - 4], [cx - h / 2, cy + 1], [cx, cy - 7], [cx + h / 2, cy + 1], [cx + h, cy - 4], [cx + h, cy + 5]], 'g2')
  r.rect(cx - h, cy + 2, w, 4, 'g1')
  r.line(cx - h + 1, cy + 2, cx + h - 1, cy + 2, 'g3')
  r.set(cx, cy - 5, 'g4')
  r.ellipse(cx, cy + 4, 1.4, 1.2, 'r2')
}

/** Flames rising from a line: tongues of fire, hottest at the core. */
function flames(r: Raster, x0: number, x1: number, base: number, height: number): void {
  const n = Math.max(3, Math.round((x1 - x0) / 6))
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n
    const tall = height * (i % 2 ? 0.8 : 1)
    r.poly([[x - 4, base], [x + 4, base], [x, base - tall]], 'f1')
    r.poly([[x - 2.5, base], [x + 2.5, base], [x, base - tall * 0.7]], 'f2')
    r.poly([[x - 1.2, base], [x + 1.2, base], [x, base - tall * 0.4]], 'f3')
  }
}

const out: Record<string, Raster> = {}
const icon = (id: string, draw: (r: Raster) => void) => {
  const r = new Raster(S, S)
  draw(r)
  out[id] = r
}

// Apprentice Smith: a smith's hammer raised over an anvil
icon('apprentice-smith', (r) => {
  anvil(r, 30, 36, 38)
  r.outline('k')
  hammer(r, [40, 14], [54, 34])
  r.outline('k')
  sparks(r, 24, 34, 4, 9)
})

// Forge Builder: a stone forge, its mouth full of fire
icon('forge-builder', (r) => {
  // the stone body and chimney
  r.rect(12, 22, 40, 32, 'e2')
  r.rect(26, 6, 12, 18, 'e2')
  for (let y = 24; y < 54; y += 6) for (let x = 12 + ((y / 6) % 2) * 5; x < 52; x += 10) r.rect(x, y, 9, 5, 'e3')
  for (let y = 8; y < 22; y += 6) r.rect(27, y, 10, 5, 'e3')
  r.rect(26, 6, 12, 2, 'e1')
  // the mouth, glowing
  r.ellipse(32, 44, 12, 9, 'b1')
  r.rect(20, 44, 24, 10, 'b1')
  flames(r, 22, 42, 53, 14)
  r.outline('k')
  // smoke
  r.ellipse(30, 3, 3, 2, 'e3')
  r.ellipse(36, 2, 2, 1.5, 'e3')
})

// Efficient Smelting: a glowing crucible pouring out two ingots
icon('efficient-smelting', (r) => {
  // the crucible, tilted
  r.poly([[8, 12], [32, 8], [34, 30], [14, 34]], 'e1')
  r.poly([[11, 13], [30, 10], [31, 28], [15, 31]], 'e2')
  r.ellipse(20, 11, 11, 4, 'f2')
  r.ellipse(20, 11, 8, 2.5, 'f3')
  r.set(18, 10, 'f4')
  // the molten stream
  thick(r, [31, 14], [38, 22], 'f2', 3)
  thick(r, [31, 14], [38, 22], 'f3', 1)
  r.outline('k')
  // two ingots, still glowing
  ingot(r, 32, 44, 22, ['f1', 'f2', 'f3', 'f4'])
  ingot(r, 46, 54, 20, STEEL)
  r.outline('k')
  for (const [x, y] of [[50, 30], [56, 40], [8, 48]] as const) sparkle(r, x, y, 2, 'f3', 'f4')
})

// Steelworking: a blue-steel ingot with sparks off it
icon('steelworking', (r) => {
  ingot(r, 32, 40, 40, BLUE)
  r.outline('k')
  sparks(r, 32, 30, 7, 16)
  sparkle(r, 50, 50, 3, 'u3', 'u4')
  sparkle(r, 12, 52, 2, 'u3', 'u4')
})

// Goldsmith: a gold ingot, shining
icon('goldsmith', (r) => {
  ingot(r, 32, 38, 42, GOLD)
  r.outline('k')
  for (const [x, y, s] of [[14, 18, 3], [50, 16, 4], [54, 50, 2], [10, 50, 2]] as const) sparkle(r, x, y, s, 'g3', 'g4')
})

// Jeweler: a gold ring with a blue gem set in it
icon('jeweler', (r) => {
  r.ellipse(32, 40, 18, 14, 'g1')
  r.ellipse(32, 40, 16, 12, 'g2')
  r.ellipse(32, 41, 12, 8, NONE)
  arc(r, 32, 40, 15, 200, 300, 'g3', 1)
  // the setting and the gem
  r.poly([[24, 24], [40, 24], [36, 30], [28, 30]], 'g1')
  r.poly([[22, 16], [32, 8], [42, 16], [32, 28]], 'c1')
  r.poly([[24, 16], [32, 10], [40, 16], [32, 25]], 'c2')
  r.poly([[27, 15], [32, 11], [32, 18]], 'c3')
  r.outline('k')
  sparkle(r, 48, 10, 3, 'c3', 'g4')
  sparkle(r, 12, 30, 2, 'g3', 'g4')
})

// Tool Smith: an iron pickaxe and a hoe, crossed
icon('tool-smith', (r) => {
  // the hoe: haft from lower right to upper left, a flat blade
  thick(r, [52, 56], [16, 14], 'w2', 3)
  r.poly([[10, 12], [22, 8], [24, 14], [12, 20]], 's2')
  r.line(11, 18, 22, 13, 's3')
  // the pickaxe: haft from lower left to upper right, a curved head
  thick(r, [12, 56], [46, 14], 'w2', 3)
  thick(r, [12, 56], [46, 14], 'w3', 1)
  arc(r, 46, 28, 16, 225, 335, 's1', 4)
  arc(r, 46, 28, 16, 230, 330, 's2', 2)
  arc(r, 46, 28, 15, 245, 300, 's3', 1)
  r.outline('k')
})

// Weaponsmith: a sword blade on the anvil, sparks off the strike
icon('weaponsmith', (r) => {
  anvil(r, 32, 40, 40)
  r.outline('k')
  sword(r, [10, 38], [56, 36], 2.5, 6)
  r.outline('k')
  sparks(r, 34, 34, 6, 13)
})

// Keen Edge: a sword's edge with a bright glint running along it
icon('keen-edge', (r) => {
  sword(r, [12, 54], [54, 10], 4, 8)
  r.outline('k')
  // the glint along the edge
  thick(r, [24, 38], [48, 14], 's4', 1)
  sparkle(r, 46, 16, 5, 's4', 's4')
  sparkle(r, 30, 30, 3, 's3', 's4')
  r.line(41, 11, 51, 21, 's3')
})

// Heavy Arms: a warhammer and a halberd, crossed
icon('heavy-arms', (r) => {
  // the halberd: haft lower left to upper right, axe blade and spike
  thick(r, [10, 58], [48, 10], 'w2', 3)
  r.poly([[42, 10], [56, 14], [54, 26], [44, 20]], 's2')
  r.poly([[44, 12], [54, 15], [52, 22], [45, 18]], 's3')
  r.poly([[46, 10], [52, 2], [50, 12]], 's2')
  // the warhammer: haft lower right to upper left, a block head
  thick(r, [54, 58], [16, 18], 'w2', 3)
  thick(r, [8, 8], [26, 24], 's1', 10)
  thick(r, [8, 8], [26, 24], 's2', 8)
  thick(r, [9, 7], [20, 17], 's3', 2)
  r.outline('k')
})

// Master Weaponsmith: a glowing sword with a gold hilt, a laurel round it
icon('master-weaponsmith', (r) => {
  laurel(r, 32, 34, 24)
  r.outline('k')
  sword(r, [32, 54], [32, 6], 4.5, 7, STEEL, GOLD)
  r.outline('k')
  thick(r, [33, 46], [33, 10], 's4', 1)
  for (const [x, y] of [[20, 12], [46, 18], [50, 6]] as const) sparkle(r, x, y, 3, 'g3', 'g4')
})

// Armorsmith: a helmet on the anvil
icon('armorsmith', (r) => {
  anvil(r, 32, 42, 40)
  r.outline('k')
  // the helmet: a dome, a brow band, an eye slit
  r.ellipse(32, 28, 13, 13, 's2')
  r.rect(19, 28, 26, 14, 's2')
  r.ellipse(28, 23, 6, 5, 's3')
  r.set(25, 20, 's4')
  r.rect(19, 30, 26, 3, 's1')
  r.rect(22, 34, 20, 2, 'b1')
  r.line(32, 15, 32, 28, 's3')
  r.outline('k')
  sparks(r, 48, 36, 3, 8)
})

// Plate Work: a steel breastplate
icon('plate-work', (r) => {
  r.poly([[12, 12], [24, 8], [32, 12], [40, 8], [52, 12], [54, 26], [48, 48], [32, 56], [16, 48], [10, 26]], 's2')
  r.poly([[14, 14], [24, 10], [30, 14], [30, 52], [18, 46], [12, 26]], 's3')
  r.line(32, 12, 32, 54, 's1')
  r.line(16, 14, 24, 11, 's4')
  // the plates' lines
  r.line(14, 30, 50, 30, 's1')
  r.line(16, 40, 48, 40, 's1')
  for (const x of [18, 46]) r.set(x, 22, 's4')
  // the neck and the arms are open
  r.ellipse(32, 9, 8, 6, NONE)
  r.ellipse(6, 22, 6, 9, NONE)
  r.ellipse(58, 22, 6, 9, NONE)
  r.outline('k')
})

// Reinforced: a round shield, a steel band across it and rivets round its rim
icon('reinforced', (r) => {
  r.ellipse(32, 32, 24, 24, 'w1')
  r.ellipse(32, 32, 22, 22, 'w2')
  arc(r, 32, 32, 18, 200, 290, 'w3', 2)
  // the band
  r.rect(10, 27, 44, 10, 's1')
  r.rect(10, 28, 44, 7, 's2')
  r.line(10, 29, 53, 29, 's3')
  // the boss
  ball(r, 32, 32, 6, STEEL)
  // rivets round the rim and on the band
  for (let i = 0; i < 10; i++) {
    const a = (i * 36 * Math.PI) / 180
    r.set(32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20, 's3')
  }
  for (const x of [15, 22, 42, 49]) r.set(x, 31, 's4')
  r.outline('k')
})

// Master Armorsmith: a gold-trimmed breastplate, a laurel round it
icon('master-armorsmith', (r) => {
  laurel(r, 32, 34, 26)
  r.outline('k')
  r.poly([[16, 14], [26, 10], [32, 14], [38, 10], [48, 14], [50, 26], [45, 44], [32, 52], [19, 44], [14, 26]], 'g2')
  r.poly([[19, 16], [26, 13], [31, 16], [31, 49], [21, 43], [17, 26]], 's3')
  r.poly([[33, 16], [38, 13], [45, 16], [47, 26], [43, 43], [33, 49]], 's2')
  r.line(32, 14, 32, 50, 'g1')
  r.line(18, 15, 26, 12, 'g4')
  r.ellipse(32, 10, 6, 5, NONE)
  r.ellipse(10, 24, 5, 8, NONE)
  r.ellipse(54, 24, 5, 8, NONE)
  r.ellipse(32, 28, 3, 3, 'r2')
  r.set(31, 27, 'r3')
  r.outline('k')
  sparkle(r, 52, 8, 3, 'g3', 'g4')
  sparkle(r, 12, 8, 2, 'g3', 'g4')
})

// Fine Craft: a hammer, a star of quality beside it
icon('fine-craft', (r) => {
  hammer(r, [22, 18], [44, 54])
  r.outline('k')
  // the star
  const star: P[] = []
  for (let i = 0; i < 10; i++) {
    const a = ((-90 + i * 36) * Math.PI) / 180
    const rad = i % 2 ? 5 : 11
    star.push([46 + Math.cos(a) * rad, 20 + Math.sin(a) * rad])
  }
  r.poly(star, 'g2')
  r.ellipse(45, 19, 3, 3, 'g3')
  r.set(44, 17, 'g4')
  r.outline('k')
})

// Masterwork: a gleaming ingot-bright blade head in a purple-gold starburst
icon('masterwork', (r) => {
  // the burst
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 * Math.PI) / 180
    const rad = i % 2 ? 18 : 28
    thick(r, [32, 32], [32 + Math.cos(a) * rad, 32 + Math.sin(a) * rad], i % 2 ? 'g2' : 'v2', i % 2 ? 2 : 3)
  }
  r.ellipse(32, 32, 14, 14, 'v1')
  r.ellipse(32, 32, 12, 12, 'v2')
  r.outline('k')
  // the piece: a short gleaming blade
  sword(r, [24, 42], [42, 22], 3, 5, STEEL, GOLD)
  r.outline('k')
  sparkle(r, 42, 22, 3, 'v4', 'g4')
  sparkle(r, 12, 12, 2, 'v3', 'v4')
  sparkle(r, 52, 52, 2, 'g3', 'g4')
})

// Legendary Smith: a sword wreathed in an orange-red legendary aura
icon('legendary-smith', (r) => {
  // the aura: a flame-edged glow behind the blade
  r.ellipse(32, 30, 16, 24, 'r1')
  r.ellipse(32, 30, 13, 21, 'r2')
  r.ellipse(32, 30, 9, 17, 'f1')
  r.ellipse(32, 30, 5, 12, 'f2')
  for (const [x, y] of [[18, 14], [46, 14], [16, 36], [48, 38], [32, 4]] as const) r.poly([[x - 3, y + 6], [x + 3, y + 6], [x, y - 2]], 'r2')
  r.outline('k')
  sword(r, [32, 56], [32, 8], 4, 7, ['s1', 's3', 's4', 'f4'], GOLD)
  r.outline('k')
  for (const [x, y] of [[10, 22], [54, 26], [52, 52]] as const) sparkle(r, x, y, 2, 'f3', 'f4')
})

// Ore Merchant: chunks of ore and a coin
icon('ore-merchant', (r) => {
  // ore chunks
  for (const [x, y, s] of [[22, 42, 11], [38, 48, 9], [14, 52, 7]] as const) {
    r.poly([[x - s, y + s * 0.4], [x - s * 0.6, y - s * 0.7], [x + s * 0.3, y - s], [x + s, y - s * 0.2], [x + s * 0.7, y + s * 0.7], [x - s * 0.3, y + s * 0.8]], 'o2')
    r.poly([[x - s * 0.6, y - s * 0.6], [x + s * 0.3, y - s * 0.9], [x + s * 0.2, y - s * 0.2], [x - s * 0.5, y]], 'o3')
    r.set(x + s * 0.4, y + s * 0.2, 's3')
    r.set(x - s * 0.2, y + s * 0.3, 'g3')
    r.set(x + s * 0.5, y - s * 0.4, 'o1')
  }
  r.outline('k')
  // the coin
  r.ellipse(44, 22, 13, 13, 'g1')
  r.ellipse(43, 21, 11, 11, 'g2')
  r.ellipse(43, 21, 7, 7, 'g1')
  r.ellipse(43, 21, 6, 6, 'g2')
  r.line(43, 16, 43, 26, 'g3')
  r.set(39, 16, 'g4')
  r.outline('k')
  sparkle(r, 58, 10, 2, 'g3', 'g4')
})

// Grandmaster Smith: a golden hammer over a golden anvil, a crown above
icon('grandmaster-smith', (r) => {
  anvil(r, 30, 40, 38)
  r.recolor({ b1: 'g1', b2: 'g2', b3: 'g3', s2: 'g4' })
  r.outline('k')
  hammer(r, [40, 24], [54, 42], GOLD, 'w2')
  r.outline('k')
  crown(r, 24, 18, 22)
  r.outline('k')
  for (const [x, y] of [[8, 30], [54, 10], [44, 58]] as const) sparkle(r, x, y, 2, 'g3', 'g4')
})

for (const [id, r] of Object.entries(out)) writeAtlas(`Skills/${id}.png`, [[r]], PAL)
console.log(`${Object.keys(out).length} smithing skill icons → public/assets/lsw/Skills`)

// the ingot the forge smelts (16x16, gear.ts's look): one neutral grey bar the game tints by its metal
const ING: Palette = {
  k: [31, 26, 36, 255],
  D: [96, 104, 116, 255],
  S: [150, 160, 172, 255],
  s: [214, 222, 230, 255],
  w: [246, 248, 252, 255],
}
const bar = new Raster(16, 16)
// a bar seen at an angle: its top face (light), its front (mid), its shadowed foot
// the long front face, the top face above it, the right end in shadow
bar.poly([[1, 12], [11, 12], [10, 9], [2, 9]], 'S')
bar.poly([[2, 9], [10, 9], [13, 6], [5, 6]], 's')
bar.poly([[11, 12], [14, 9], [13, 6], [10, 9]], 'D')
bar.line(6, 7, 12, 7, 'w')
bar.line(1, 12, 11, 12, 'D')
bar.set(3, 10, 's')
bar.outline('k')
writeAtlas('Items/Ingot.png', [[bar]], ING)
console.log('the ingot → public/assets/lsw/Items/Ingot.png')
