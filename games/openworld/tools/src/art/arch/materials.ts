// What the buildings are made of, and how each is drawn (oblique.ts): a material is a function from a point of a
// surface — where it is, which way it faces, whether a shadow falls on it, how shut in it is — to a key of the
// palette. Flat tones as the pack draws them, four or five a material: the light on what faces up and west, the
// middle on what faces the viewer, the dark on what turns east and on what is shaded; the courses of the stone, the
// rows of the slates, the beams of a timbered wall drawn as lines of the next tone.

export type RGBA = [number, number, number, number]

export interface Surface {
  x: number
  y: number
  z: number
  n: [number, number, number]
  cls: 'top' | 'south' | 'north' | 'east' | 'west' | 'slopeW' | 'slopeE' | 'slopeS' | 'slopeN'
  shadow: boolean
  /** How many of nine points round it are inside something (0 open, 9 deep in a recess). */
  shut: number
  lit: number
}

const hex = (h: string): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255]

/** Ramps, light to dark: a key is the ramp's name and the step (`s2`, `r3`). */
const RAMPS: Record<string, string[]> = {
  // the Holy City's limestone, warm and pale
  s: ['#fbf4e4', '#ebdfc4', '#d3c3a2', '#ae9c7e', '#83725d', '#5b4e42'],
  // a fortress's grey granite
  g: ['#e6e9e6', '#c6cbc9', '#a2a8aa', '#7d8387', '#585e64', '#3c4147'],
  // slate and lead, blue-grey
  r: ['#b3c1cf', '#8c9db1', '#6c7d93', '#516075', '#3a4558', '#2a3242'],
  // gold
  a: ['#fff6c4', '#f4d784', '#d6a84b', '#9d7029', '#6c4a1c'],
  // red clay tiles
  t: ['#f2a983', '#da7a53', '#b9573d', '#8a3c2e', '#5f2923'],
  // plaster, cream; rose, ochre, blue-grey and white washes
  p: ['#fdf7e8', '#f3e7cc', '#e0cfac', '#bfab88', '#94815f'],
  pk: ['#fde9e2', '#f3cfc4', '#dcafa2', '#b88a7e', '#8c675e'],
  po: ['#fdf0c6', '#f2d995', '#dcbc6e', '#b89650', '#8a6d38'],
  pb: ['#eef3f6', '#d3dfe6', '#b2c3cf', '#8c9fae', '#687a88'],
  pw: ['#ffffff', '#f4f2ee', '#dedbd4', '#bcb8ae', '#918c82'],
  // timber
  w: ['#c8966b', '#a3754e', '#7d5236', '#5a3a28', '#3f281d'],
  // brick
  b: ['#cf7c5c', '#b5654a', '#8f4b38', '#6e3a2c', '#4e2a22'],
  // thatch
  h: ['#ead08a', '#d8b46a', '#b38f4c', '#8a6a35', '#5f4824'],
  // green copper (a spire's cap)
  c: ['#a8dcc0', '#7cc0a0', '#5a9c80', '#417a63', '#2e5848'],
  // the dark of an opening
  n: ['#4a4352', '#38323f', '#2a2530', '#1e1b23', '#16141a'],
  // stained glass: blue, red, gold, green, violet
  B: ['#7fb0ff', '#4a7fd6', '#2f5aa6', '#21407a'],
  E: ['#ff8a80', '#d9474e', '#a72f39', '#741f29'],
  Y: ['#ffe58a', '#f0bd45', '#c48d27', '#8d6119'],
  V: ['#9ae0a4', '#55a86a', '#3b7f4f', '#285a39'],
  U: ['#c9a2f2', '#8c5cc2', '#6a3f9a', '#482a6b'],
  // canvas: red, blue, yellow, green, white
  cr: ['#f07a6e', '#d4504a', '#a93b38', '#7a2a29'],
  cb: ['#7fb2ea', '#4f84c4', '#365f94', '#26456c'],
  cy: ['#ffe08a', '#f1c24c', '#c99b2f', '#8f6c1f'],
  cg: ['#8ad39a', '#5aa36b', '#3f7a4e', '#2b5638'],
  cw: ['#fbf6ec', '#ece3d1', '#cfc4ae', '#a39a86'],
  // iron
  i: ['#a9b0b8', '#7c838c', '#585e66', '#3b4046'],
  // hedge and grass on a roof garden or a courtyard
  v: ['#a8d16a', '#7fb24d', '#5a8d3b', '#3d672c'],
  // the regions' own (docs/showcase.md §4b): snow lying on a roof, the Scarred March's red sandstone, a fen's dark wood,
  // the Vale's salt
  sn: ['#ffffff', '#eef4fb', '#d2deec', '#aebfd4', '#8597b1'],
  rd: ['#f2b48a', '#d98d64', '#b96a4a', '#8e4c37', '#653528', '#47251d'],
  dw: ['#8a6d55', '#6b5242', '#4f3b31', '#382a23', '#251c18'],
  sl: ['#fbfbf6', '#ecebe0', '#d6d4c3', '#b5b29e'],
  // bronze gone green (a statue in a square)
  z: ['#a9d1b4', '#79a68b', '#567f68', '#3c5c4c', '#283f35'],
  // water in a fountain
  q: ['#d6f4ff', '#8fd3ef', '#58aedb', '#3a86b8'],
}

export const PALETTE: Record<string, RGBA> = { k: hex('#141b1b') }
for (const [name, ramp] of Object.entries(RAMPS)) ramp.forEach((h, i) => (PALETTE[name + i] = hex(h)))

/** The step of a ramp for a surface: by its facing, one darker in shadow, one darker deep in a recess. */
export function tone(s: Surface, base = 0): number {
  const by: Record<Surface['cls'], number> = { top: 1, slopeW: 1, slopeS: 1, west: 1, slopeN: 2, south: 2, north: 3, slopeE: 3, east: 3 }
  let t = by[s.cls] + base
  if (s.shadow) t += 1
  if (s.shut >= 6) t += 1
  return t
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
/** A key of a ramp, the step held to the ramp's length. */
export const step = (ramp: string, i: number) => ramp + clamp(Math.round(i), 0, RAMPS[ramp].length - 1)

/** A cheap hash of a lattice point, 0..1. */
export function hash(a: number, b: number, c = 0): number {
  let h = (Math.imul(Math.floor(a) | 0, 374761393) + Math.imul(Math.floor(b) | 0, 668265263) + Math.imul(Math.floor(c) | 0, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Coursed ashlar: blocks `ch` high and about `cw` long, the joints a tone darker; a flat top paved in squares. */
function ashlar(ramp: string, ch: number, cw: number, base = 0) {
  return (s: Surface) => {
    const t = tone(s, base)
    if (s.cls === 'top') {
      const jx = ((s.x % 12) + 12) % 12 < 1
      const jy = ((s.y % 12) + 12) % 12 < 1
      return step(ramp, jx || jy ? t + 1 : t)
    }
    if (s.cls === 'south' || s.cls === 'north' || s.cls === 'east' || s.cls === 'west') {
      const course = Math.floor(s.z / ch)
      const u = s.cls === 'south' || s.cls === 'north' ? s.x : s.y
      const off = (course % 2) * (cw / 2) + hash(course, 7) * 3
      const block = Math.floor((u + off) / cw)
      // the joints drawn as the pack draws a wall's: not every bed, not every joint, so the face reads as one plane
      const bed = ((s.z % ch) + ch) % ch < 1 && hash(block, course, 5) < 0.7
      const joint = (((u + off) % cw) + cw) % cw < 1 && hash(block, course, 6) < 0.55
      // a stone here and there a shade off
      const odd = hash(block, course, 3) < 0.035
      return step(ramp, bed || joint ? t + 1 : odd ? t - 0.6 : t)
    }
    return step(ramp, t)
  }
}

/** Slates or tiles: courses along the eaves (by height), each slate `cw` wide, staggered; a light ridge line. */
function shingles(ramp: string, ch: number, cw: number) {
  return (s: Surface) => {
    const t = tone(s)
    if (s.cls === 'south' || s.cls === 'north' || s.cls === 'east' || s.cls === 'west') return step(ramp, t + 1)
    const course = Math.floor(s.z / ch)
    const along = Math.abs(s.n[0]) >= Math.abs(s.n[1]) ? s.y : s.x
    const bed = ((s.z % ch) + ch) % ch < 1
    const off = (course % 2) * (cw / 2)
    const slate = Math.floor((along + off) / cw)
    // the joints between slates now and then, a slate here and there newer or older than the rest
    const joint = (((along + off) % cw) + cw) % cw < 1 && hash(slate, course, 2) < 0.6
    const odd = hash(slate, course, 4)
    return step(ramp, bed || joint ? t + 1 : odd < 0.08 ? t - 0.6 : odd > 0.94 ? t + 0.6 : t)
  }
}

/** A plain surface of one ramp, by its facing. */
const plain = (ramp: string, base = 0) => (s: Surface) => step(ramp, tone(s, base))

/** Stripes of a canvas awning: two ramps by turns, `w` wide, across the eaves. */
function stripes(a: string, b: string, w: number) {
  return (s: Surface) => {
    const along = Math.abs(s.n[0]) >= Math.abs(s.n[1]) ? s.y : s.x
    const ramp = Math.floor(along / w) % 2 ? b : a
    return step(ramp, tone(s) - 1)
  }
}

export const MATERIALS: Record<string, (s: Surface) => string> = {
  stone: ashlar('s', 7, 14),
  stoneSmall: ashlar('s', 4, 8),
  plinth: ashlar('s', 8, 16, 1),
  granite: ashlar('g', 7, 14),
  graniteRough: (s) => {
    const t = tone(s)
    if (s.cls === 'top') return step('g', t + (hash(s.x / 5, s.y / 5) < 0.2 ? 1 : 0))
    const course = Math.floor(s.z / 7)
    const u = s.cls === 'south' ? s.x : s.y
    const w = 8 + Math.floor(hash(course, 1) * 8)
    const bed = ((s.z % 7) + 7) % 7 < 1
    const joint = (((u + course * 5) % w) + w) % w < 1
    return step('g', bed || joint ? t + 1 : hash(Math.floor(u / w), course) < 0.15 ? t - 0.6 : t)
  },
  slate: shingles('r', 5, 7),
  // a spire's dressed stone: no courses across it (they read as rungs on so steep a face), a rib down each arris
  spireStone: (s) => {
    const t = tone(s)
    return step('s', t)
  },
  lead: plain('r', 0),
  copper: shingles('c', 4, 5),
  tile: shingles('t', 4, 5),
  thatch: (s) => {
    const t = tone(s)
    const along = Math.abs(s.n[0]) >= Math.abs(s.n[1]) ? s.y : s.x
    return step('h', t + (hash(Math.floor(along / 2), Math.floor(s.z / 3)) < 0.3 ? 1 : 0))
  },
  gold: plain('a', -1),
  plaster: plain('p', 0),
  plasterRose: plain('pk', 0),
  plasterOchre: plain('po', 0),
  plasterBlue: plain('pb', 0),
  plasterWhite: plain('pw', 0),
  // polished white marble: its tone by facing, a vein of grey across it now and then
  marbleWhite: (s) => step('pw', tone(s, -1) + (hash(Math.floor(s.x / 3), Math.floor(s.z / 2), 61) < 0.07 ? 2 : 0)),
  timber: plain('w', 0),
  brick: ashlar('b', 4, 8),
  dark: (s) => step('n', 1 + (s.shut >= 6 ? 1 : 0)),
  // a room's ceiling as the game shows a room with its roof off: the dark over its walls (the rim pass lights its edge)
  ceiling: (s) => (s.cls === 'top' ? 'n2' : step('n', 3)),
  door: (s) => {
    // planks a few pixels wide, a dark line between, iron bands across
    const u = s.cls === 'south' ? s.x : s.y
    const band = ((s.z % 9) + 9) % 9 < 1.2
    if (band) return step('i', 2)
    return step('w', ((u % 4) + 4) % 4 < 1 ? 3 : 2)
  },
  iron: plain('i', 0),
  // snow on a roof: soft, its courses barely showing, blue in shade
  snowRoof: (s) => {
    // the slates' courses showing through where the snow lies thin, drifts, a darker patch where it has slid
    const t = tone(s, -0.3)
    if (s.cls === 'south' || s.cls === 'north' || s.cls === 'east' || s.cls === 'west') return step('sn', t + 1)
    const course = Math.floor(s.z / 5)
    const along = Math.abs(s.n[0]) >= Math.abs(s.n[1]) ? s.y : s.x
    const thin = hash(Math.floor(along / 4), Math.floor(s.z / 3), 71) < 0.1 && hash(Math.floor(along / 11), Math.floor(s.z / 9), 74) < 0.6
    const bed = ((s.z % 5) + 5) % 5 < 1
    if (thin) return bed ? 'r2' : hash(Math.floor(along / 4), course, 72) < 0.3 ? 'sn3' : 'sn2'
    return step('sn', t + (bed && hash(Math.floor(along / 7), course, 73) < 0.35 ? 1 : 0))
  },
  snowField: plain('sn', 0),
  sandstone: ashlar('rd', 8, 18),
  sandstoneRough: (s) => step('rd', tone(s) + (hash(Math.floor(s.x / 7), Math.floor(s.z / 5), 73) < 0.3 ? 1 : 0) + (Math.floor(s.z / 9) % 3 === 0 ? 0.6 : 0)),
  plasterRed: plain('rd', -1),
  darkwood: (s) => step('dw', tone(s) + (((s.cls === 'south' ? s.x : s.y) % 5 + 5) % 5 < 1 ? 1 : 0)),
  salt: plain('sl', 0),
  whiteStone: ashlar('pw', 7, 16),
  // black iron (a street lamp's)
  ironDark: plain('i', 1.4),
  bronze: plain('z', 0),
  // a lantern's panes lit from within
  glassLit: (s) => step('Y', s.cls === 'top' ? 0 : 0.5),
  earth: plain('w', 2.5),
  // clipped evergreen: leaves in three greens, darker below
  foliage: (s) => step('v', tone(s, 0.8) + (hash(Math.floor(s.x / 2), Math.floor(s.z / 2), Math.floor(s.y / 2)) < 0.3 ? 1 : hash(Math.floor(s.x / 2), Math.floor(s.z / 2), 5) < 0.15 ? -1 : 0)),
  grass: plain('v', 0),
  water: (s) => step('q', 1 + (hash(Math.floor(s.x / 3), Math.floor(s.y / 2)) < 0.2 ? -1 : 0)),
  canvasRed: stripes('cr', 'cw', 5),
  canvasBlue: stripes('cb', 'cw', 5),
  canvasYellow: stripes('cy', 'cr', 5),
  canvasGreen: stripes('cg', 'cw', 5),
  canvasPlain: plain('cw', 0),
}

/** A palette key's colour as #rrggbb, for what reads the palette elsewhere (the review sheets). */
export const colourOf = (key: string) => '#' + PALETTE[key].slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('')
