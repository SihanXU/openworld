// What stands inside the showcase's halls (docs/showcase.md §4): seen as the game sees a room, from the south and above
// with its roof taken off — its north wall's face (the apse with its glass, a hall's hearth and hangings, a library's
// windows), the columns of a nave standing in rows, the canopy over the high altar; and the furniture, each a fixture
// with a picture of its own (`sprite`): pews, the pulpit, the font, tombs, the organ, lecterns and desks, a throne, the
// great bells.

import type { Model, Ornament } from '../oblique.ts'
import { archNS, backOf, box, drum, gable, octagon, recess, spire, type Solid } from '../shapes.ts'
import { banner, cross, greatWindow, lancet, rose, sconce, statue, window, type Glass } from '../ornaments.ts'
import { shell, type Dress, type Face } from '../shell.ts'
import { NAVE } from '../plans.ts'
import { S } from '../kit.ts'

/** A model drawn whole as a fixture's picture, its footprint centred on its own cell (MapBuilder.fixture). */
export interface PropModel extends Model {
  sprite: true
}
const prop = (m: Model): PropModel => ({ ...m, sprite: true })

/**
 * A clustered pier of the nave: a round core with four shafts, a moulded base, a capital of gilt leaves, and the springing
 * of the arches it carries (cut off where the roof is taken away). A cell; tall.
 */
function pier(h: number, mat = 'stone'): Model {
  const c = S / 2
  const solids: Solid[] = [
    box(1, 1, 0, S - 1, S - 1, 8, mat),
    drum(c, c, 5, 0, h, mat),
    ...[[c - 5, c], [c + 5, c], [c, c - 5], [c, c + 5]].map(([x, y]) => drum(x, y, 2.2, 0, h - 6, mat)),
    drum(c, c, 7, h - 10, h - 4, 'gold'),
    box(1, 1, h - 4, S - 1, S - 1, h, mat),
  ]
  return { name: 'x', footprint: ['#'], solids, voids: [], ornaments: [] }
}

/**
 * The apse seen from within: a half ring of wall round the high altar, five tall lancets of glass in it (the middle one
 * the Five Sufferings' own, gold), a band of blind arcading under them, a rose over the middle.
 */
function apse(w: number, d: number): Model {
  const W = w * S
  const R = W / 2
  const cx = R
  const cy = d * S
  const H = 200
  const T = 12
  const solids: Solid[] = []
  const voids: Solid[] = []
  const orn: Ornament[] = []
  // the ring: a half drum with its inside cut away
  solids.push({ ...drum(cx, cy, R, 0, H, 'stone', 'n') })
  voids.push(drum(cx, cy, R - T, 0, H + 2, 'void', 'n'))
  // the square bays either side down to the room's south edge: plain wall
  const glass: Glass[] = ['blue', 'red', 'gold', 'red', 'blue']
  for (let k = 0; k < 5; k++) {
    const a = ((k - 2) / 2.6) * (Math.PI / 2)
    const x = cx + Math.sin(a) * (R - T)
    const y = cy - Math.cos(a) * (R - T)
    orn.push(lancet(12, 92, glass[k], 2).at(x - 6, y, 58))
    orn.push(statue(7, 22, k === 2).at(x - 3, y, 24))
  }
  orn.push(rose(16).at(cx - 16, cy - R + T, 158))
  const fp: string[] = []
  for (let y = 0; y < d; y++) {
    let line = ''
    for (let x = 0; x < w; x++) {
      const px = (x + 0.5) * S
      const py = (y + 0.5) * S
      const r = Math.hypot(px - cx, py - cy)
      line += r > R - T - 4 ? (r < R + 2 ? '#' : ' ') : ' '
    }
    fp.push(line)
  }
  return { name: 'x', footprint: fp, solids, voids, ornaments: orn }
}

/**
 * A room's north wall seen from within: its face `h` high, of `mat`, windows (lancets of a glass, or plain), a dado of
 * blind arches or panelling, and what hangs on it. A row of cells, its face at the row's south edge.
 */
function wallFace(o: { w: number; h: number; mat: string; windows?: 'lancet' | 'round' | 'none'; glass?: Glass; every?: number; hang?: 'tapestry' | 'banners' | 'shelves' | 'niches' | 'none'; hearth?: boolean }): Model {
  const W = o.w * S
  const D = S
  const solids: Solid[] = [box(0, 0, 0, W, D, o.h, o.mat)]
  const voids: Solid[] = []
  const orn: Ornament[] = []
  const every = o.every ?? 3
  for (let c = 1; c < o.w - 1; c += every) {
    const x = c * S + S / 2 + (every > 1 ? S / 2 : 0)
    if (x > W - S) continue
    if (o.windows === 'lancet') {
      voids.push(...recess(x, D, o.h * 0.38, 16, o.h * 0.5, 4, 'pointed', 2, 2))
      orn.push(lancet(12, Math.round(o.h * 0.5) - 2, o.glass ?? 'blue', 2).at(x - 6, backOf(D, 4), o.h * 0.38))
    } else if (o.windows === 'round') {
      voids.push(...recess(x, D, o.h * 0.45, 14, o.h * 0.32, 4, 'round'))
      orn.push(window(10, Math.round(o.h * 0.3), false).at(x - 5, backOf(D, 4), o.h * 0.45))
    }
    if (o.hang === 'tapestry' && c + every < o.w) orn.push(tapestry(22, 40, c).at(x + every * S / 2 - 11, D, 18))
    if (o.hang === 'banners') orn.push(banner(10, 34, 'U').at(x - 5, D, o.h * 0.3))
    if (o.hang === 'niches') {
      voids.push(...recess(x, D, 10, 12, 18, 5, 'round'))
      orn.push(skulls(10).at(x - 5, backOf(D, 5), 10))
    }
  }
  if (o.hearth) {
    const x = W / 2
    solids.push(box(x - 26, D, 0, x + 26, D + 10, 46, o.mat))
    solids.push(box(x - 22, D, 46, x + 22, D + 6, o.h, o.mat))
    voids.push(archNS(x, D + 2, D + 11, 0, 36, 30, 'flat'))
    orn.push(fire(30).at(x - 15, D + 3, 0))
  }
  // the dado: a band of blind arches along the foot
  for (let x = 6; x < W - 6; x += 12) voids.push(archNS(x + 3, D - 2, D + 1, 2, 8, 14, 'pointed'))
  return { name: 'x', footprint: ['#'.repeat(o.w)], solids, voids, ornaments: orn }
}

/** A hanging: a woven scene in deep red and gold, a border, a rod. */
function tapestry(w: number, h: number, seed: number) {
  const rowsPic: string[] = []
  for (let j = 0; j < h; j++) {
    let line = ''
    for (let i = 0; i < w; i++) {
      if (j === 0) line += 'w'
      else if (i === 0 || i === w - 1 || j === 1 || j === h - 1) line += 'y'
      else if (Math.abs(i - w / 2) < 3 && j > h * 0.3 && j < h * 0.75) line += (j + seed) % 4 === 0 ? 'y' : 'g'
      else line += (i + j + seed) % 9 === 0 ? 'R' : 'r'
    }
    rowsPic.push(line)
  }
  return { at: (x: number, y: number, z: number): Ornament => ({ x, y, z, rows: rowsPic, keys: { w: 'w3', y: 'a2', r: 'E2', R: 'E3', g: 'V2' } }) }
}

/** Skulls stacked in a niche (an ossuary's wall). */
function skulls(w: number) {
  const rowsPic = ['  o  o  o ', ' oooooooo ', 'o.oo.oo.oo', 'oooooooooo', ' o.o o.o o', 'oooooooooo'].map((r) => r.slice(0, w))
  return { at: (x: number, y: number, z: number): Ornament => ({ x, y, z, rows: rowsPic, keys: { o: 'pw1', '.': 'n3' } }) }
}

/** A fire in a hearth. */
function fire(w: number) {
  const rowsPic: string[] = []
  for (let j = 0; j < 14; j++) {
    let line = ''
    for (let i = 0; i < w; i++) {
      const hgt = 6 + Math.round(6 * Math.abs(Math.sin(i * 0.9)))
      const v = 13 - j
      line += v < 2 ? (i % 3 ? 'L' : 'l') : v < hgt ? (v < hgt * 0.4 ? 'y' : v < hgt * 0.75 ? 'o' : 'r') : ' '
    }
    rowsPic.push(line)
  }
  return { at: (x: number, y: number, z: number): Ornament => ({ x, y, z, rows: rowsPic, keys: { L: 'w3', l: 'w2', y: 'a0', o: 'Y1', r: 'E1' }, free: true }) }
}

/** The canopy over the high altar (Bernini's baldacchino, a gothic ciborium): four shafts, a gilt vault, a spire. 3x3. */
function baldachin(): Model {
  const W = 3 * S
  const solids: Solid[] = [
    box(2, 2, 0, W - 2, W - 2, 6, 'stone'),
    ...[[6, 6], [W - 6, 6], [6, W - 6], [W - 6, W - 6]].map(([x, y]) => drum(x, y, 2.5, 6, 82, 'gold')),
    box(1, 1, 82, W - 1, W - 1, 92, 'gold'),
    gable(1, 1, W - 1, W - 1, 92, 26, 'y', 'gold', 'gold'),
    spire(W / 2, W / 2, 6, 110, 30, 8, 'gold'),
  ]
  const orn: Ornament[] = [cross(9).at(W / 2 - 2, W / 2, 138, true)]
  return { name: 'x', footprint: ['...', '...', '#.#'], solids, voids: [], ornaments: orn }
}

/**
 * The labyrinth inlaid in the nave's floor (Chartres's): eleven rings of pale stone between lines of dark, the path
 * turning back on itself, the six-petalled rose in the middle. Laid as ground, walked over. 5x5.
 */
function labyrinth(): Model {
  const W = 5 * S
  const c = W / 2
  const R = c - 1
  const disc: Solid = {
    ...drum(c, c, R, 0, 1, 'stone'),
    paint: (x, y) => {
      const dx = x - c
      const dy = y - c
      const d = Math.hypot(dx, dy)
      if (d < 5) return Math.abs(Math.sin(Math.atan2(dy, dx) * 3)) > 0.5 || d < 1.6 ? 'gold' : 'plasterWhite'
      const band = (R - d) / 2.4
      // the walls between the rings, broken where the path turns: on the axes, by turns
      const wall = band % 1 < 0.38
      const ring = Math.floor(band)
      const a = Math.atan2(dy, dx)
      const gap = Math.abs(Math.sin(a)) < 0.12 && (ring % 2 === 0 ? dy < 0 : dy > 0)
      return wall && !gap ? 'iron' : ring % 2 ? 'stone' : 'plasterWhite'
    },
  }
  return { name: 'x', footprint: Array(5).fill('#####'), solids: [disc], voids: [], ornaments: [], ground: true, terrain: 'marble' }
}

/** The great bells in their frame of oak, under the belfry's louvres. 4x3. */
function bellFrame(): Model {
  const W = 4 * S
  const D = 3 * S
  const solids: Solid[] = [
    box(2, 4, 0, 6, D - 4, 70, 'timber'),
    box(W - 6, 4, 0, W - 2, D - 4, 70, 'timber'),
    box(2, D / 2 - 2, 64, W - 2, D / 2 + 2, 72, 'timber'),
    // the bells: bronze, flaring to their lips
    ...[[W * 0.3, 18], [W * 0.7, 14]].flatMap(([x, r]) => [
      { ...drum(x, D / 2, r * 0.55, 34, 62, 'gold') },
      { ...drum(x, D / 2, r, 26, 36, 'gold') },
    ]),
  ]
  return { name: 'x', footprint: ['#..#', '#..#', '#..#'], solids, voids: [], ornaments: [] }
}

// ------------------------------------------------------------------ furniture (fixtures with pictures of their own)

/** A pew: a long bench of oak with a back and ends carved with a poppyhead. 3x1. */
function pew(): PropModel {
  const W = 3 * S
  return prop({
    name: 'pew',
    footprint: ['###'],
    solids: [box(1, 4, 0, W - 1, 12, 8, 'timber'), box(2, 5, 8, W - 2, 12, 10, 'canvasRed'), box(1, 1, 0, W - 1, 4, 20, 'timber'), box(1, 1, 20, W - 1, 4, 22, 'gold'), box(0, 1, 0, 3, 13, 22, 'timber'), box(W - 3, 1, 0, W, 13, 22, 'timber')],
    voids: [],
    ornaments: [],
  })
}

/** The pulpit: an octagonal tub of carved oak on a stem, a stair to it, a sounding board over it. */
function pulpit(): PropModel {
  const c = S / 2
  return prop({
    name: 'pulpit',
    footprint: ['#'],
    solids: [octagon(c, c, 3, 0, 22, 'timber'), octagon(c, c, 7, 22, 40, 'timber'), box(c - 1, 1, 40, c + 1, 3, 76, 'timber'), octagon(c, c, 9, 76, 80, 'timber'), spire(c, c, 7, 80, 12, 8, 'gold')],
    voids: [],
    ornaments: [],
  })
}

/** The font: a stone basin on a shaft, its water, a cover of gilt. */
function font(): PropModel {
  const c = S / 2
  return prop({ name: 'font', footprint: ['#'], solids: [octagon(c, c, 7, 0, 4, 'stone'), drum(c, c, 3, 4, 16, 'stone'), octagon(c, c, 7, 16, 24, 'stone'), drum(c, c, 5, 22, 23, 'water')], voids: [], ornaments: [] })
}

/** A tomb: a chest of stone with an effigy lying on it, hands joined, a dog at the feet. 1x2. */
function tomb(gilt: boolean): PropModel {
  return prop({
    name: gilt ? 'tomb_gilt' : 'tomb',
    footprint: ['#', '#'],
    solids: [box(1, 1, 0, S - 1, 2 * S - 1, 14, 'stone'), box(4, 4, 14, S - 4, 2 * S - 4, 19, gilt ? 'gold' : 'stone'), box(5, 3, 14, S - 5, 7, 21, gilt ? 'gold' : 'stone')],
    voids: [],
    ornaments: [],
  })
}

/** The organ: a case of oak against the wall, its pipes in towers, the tallest in the middle, gilt mouths. 3x1. */
function organ(): PropModel {
  const W = 3 * S
  // the case of carved oak, three towers of pipes (the middle the tallest), gilt crowns on the towers, the console
  const solids: Solid[] = [box(0, 2, 0, W, S, 34, 'timber'), box(W / 2 - 8, S - 2, 18, W / 2 + 8, S + 2, 30, 'timber')]
  for (let i = 0; i < 11; i++) {
    const x = 3 + i * 4
    const tower = i < 3 ? 0 : i < 8 ? 1 : 2
    const h = tower === 1 ? 96 + 14 * Math.sin(((i - 3 + 0.5) / 5) * Math.PI) : 80 + 6 * Math.sin(((i % 4) + 0.5) * 0.8)
    solids.push(drum(x + 1.5, S - 5, 1.6, 34, h, 'iron'))
  }
  solids.push(box(0, 1, 34, 3, S - 2, 104, 'timber'), box(W - 3, 1, 34, W, S - 2, 104, 'timber'), box(12, 1, 34, 14, S - 2, 116, 'timber'), box(W - 14, 1, 34, W - 12, S - 2, 116, 'timber'))
  solids.push(box(-1, 1, 104, 14, S - 1, 108, 'gold'), box(W - 14, 1, 104, W + 1, S - 1, 108, 'gold'), box(12, 1, 116, W - 12, S - 1, 122, 'gold'), spire(W / 2, S / 2 + 2, 5, 122, 12, 4, 'gold'))
  return prop({ name: 'organ', footprint: ['###'], solids, voids: [], ornaments: [] })
}

/** A lectern: an eagle of brass with its wings spread under the open book, on a shaft. */
function lectern(): PropModel {
  const c = S / 2
  return prop({ name: 'lectern', footprint: ['#'], solids: [drum(c, c, 4, 0, 3, 'gold'), drum(c, c, 1.5, 3, 30, 'gold'), box(c - 6, c - 3, 30, c + 6, c + 3, 33, 'gold'), box(c - 5, c - 2, 33, c + 5, c + 2, 35, 'plasterWhite')], voids: [], ornaments: [] })
}

/** A copyist's desk: a sloping board on a frame, an inkhorn, a candle, a stool. 1x1. */
function desk(): PropModel {
  return prop({ name: 'desk', footprint: ['#'], solids: [box(2, 2, 0, S - 2, S - 3, 16, 'timber'), box(1, 1, 16, S - 1, S - 2, 20, 'timber'), box(3, 3, 20, S - 3, 8, 21, 'plasterWhite')], voids: [], ornaments: [] })
}

/** A tall bookcase of oak, its shelves full (the library's, three storeys of books). 2x1. */
function bookcase(): PropModel {
  const W = 2 * S
  const solids: Solid[] = [box(0, 2, 0, W, S, 64, 'timber')]
  const orn: Ornament[] = []
  const KEYS = ['E1', 'B1', 'V1', 'Y1', 'U1', 'w1', 'E2', 'B2']
  for (let shelf = 0; shelf < 5; shelf++) {
    let line = ''
    for (let i = 0; i < W - 4; i++) line += String.fromCharCode(97 + ((i * 7 + shelf * 3) % 8))
    const rowsPic = Array(9).fill(line).map((l: string, j: number) => (j === 0 ? l.replace(/./g, (ch, i) => ((i * 5 + shelf) % 3 === 0 ? ' ' : ch)) : l))
    orn.push({ x: 2, y: S, z: 4 + shelf * 12, rows: rowsPic, keys: Object.fromEntries(KEYS.map((k, i) => [String.fromCharCode(97 + i), k])) })
  }
  return prop({ name: 'bookcase', footprint: ['##'], solids, voids: [], ornaments: orn })
}

/** A throne: a high-backed chair of oak and gilt on a step, a canopy of cloth over it. */
function throne(): PropModel {
  return prop({
    name: 'throne',
    footprint: ['#'],
    solids: [box(0, 0, 0, S, S, 4, 'stone'), box(2, 6, 4, S - 2, S - 2, 14, 'timber'), box(2, 2, 4, S - 2, 6, 52, 'gold'), box(1, 1, 52, S - 1, 4, 56, 'gold'), box(3, 6, 14, S - 3, S - 3, 16, 'canvasRed')],
    voids: [],
    ornaments: [],
  })
}

/** A reliquary: a little gilt church on a stone table, its roof jewelled. */
function reliquary(): PropModel {
  return prop({ name: 'reliquary', footprint: ['#'], solids: [box(1, 2, 0, S - 1, S - 2, 14, 'stone'), box(3, 4, 14, S - 3, S - 4, 22, 'gold'), gable(2, 3, S - 2, S - 3, 22, 8, 'x', 'gold', 'gold')], voids: [], ornaments: [] })
}

/** A sarcophagus in the crypt: a plain chest of stone under its lid. 1x2. */
function sarcophagus(): PropModel {
  return prop({ name: 'sarcophagus', footprint: ['#', '#'], solids: [box(2, 2, 0, S - 2, 2 * S - 2, 14, 'stone'), box(1, 1, 14, S - 1, 2 * S - 1, 18, 'stone')], voids: [], ornaments: [] })
}

/** Pilasters along a face: a shaft a little proud of it at each end and every `every` cells, a gilt capital. */
function pilasters(f: Face, h: number, every = 4): Solid[] {
  const y = (f.y + 1) * S
  const out: Solid[] = []
  for (let x = f.x0; x <= f.x1 + 1; x += every) {
    const px = Math.min(x, f.x1 + 1) * S
    out.push(box(px - 3, y - 2, 0, px + 3, y + 3, h - 4, 'stone'), box(px - 4, y - 2, h - 14, px + 4, y + 4, h - 10, 'gold'))
  }
  return out
}

/** A dark doorway's leaves (a sacristy's door at the back of its recess). */
function doorDark(w: number, h: number): (x: number, y: number, z: number) => Ornament {
  const rowsPic: string[] = []
  for (let j = 0; j < h; j++) {
    let line = ''
    for (let i = 0; i < w; i++) line += j < 3 ? 'n' : i % 4 === 0 ? 'd' : j % 9 === 4 ? 'i' : 'w'
    rowsPic.push(line)
  }
  return (x, y, z) => ({ x, y, z, rows: rowsPic, keys: { n: 'n2', d: 'w3', i: 'i2', w: 'w2' } })
}

/** The dressing of the nave's faces: by where each run of faces stands in its plan. */
function dressNave(f: Face): Dress {
  const p = NAVE.parts
  const y = (f.y + 1) * S
  const mid = ((f.x0 + f.x1 + 1) / 2) * S
  const solids: Solid[] = []
  const voids: Solid[] = []
  const orn: Ornament[] = []
  const lamp = (x: number, z: number) => orn.push(sconce().at(x - 3, y, z))
  // the apse: its great window, a saint in a niche either side, the string course, the pilasters between
  if (f.y === p.apse.y - 1) {
    // (the window high, over the organ's crown, as Reims's and Saint-Denis's over their altars)
    const h = 176
    voids.push(...recess(mid, y, 92, 64, 78, 6, 'pointed', 2, 3))
    orn.push(greatWindow(56, 74).at(mid - 28, y - 6, 93))
    for (const k of [-1, 1]) {
      voids.push(...recess(mid + k * 54, y, 60, 18, 42, 5, 'pointed'))
      orn.push(statue(10, 36, true).at(mid + k * 54 - 5, y - 5, 61))
      lamp(mid + k * 36, 56)
      lamp(mid + k * 72, 56)
    }
    solids.push(box(f.x0 * S, y - 2, 52, (f.x1 + 1) * S, y + 2, 56, 'stone'), box(f.x0 * S, y - 2, 86, (f.x1 + 1) * S, y + 2, 90, 'stone'), ...pilasters(f, h, 3))
    return { h, solids, voids, ornaments: orn }
  }
  // the choir's side walls: a tall lancet each, a sconce under it
  if (f.y === p.choir.y - 1) {
    const h = 112
    voids.push(...recess(mid, y, 30, 16, 64, 4, 'pointed', 2, 2))
    orn.push(lancet(12, 60, f.x0 < 17 ? 'red' : 'blue', 2).at(mid - 6, y - 4, 31))
    lamp(mid, 12)
    return { h, solids: pilasters(f, h, 3), voids, ornaments: orn }
  }
  // the transept's arms: a rose in each, a pointed doorway under it to the sacristy, sconces either side
  if (f.y === p.transept.y - 1) {
    const h = 112
    voids.push(...recess(mid, y, 52, 50, 50, 4, 'circle', 2, 3))
    orn.push(rose(21).at(mid - 21, y - 4, 56))
    voids.push(...recess(mid, y, 0, 26, 42, 6, 'pointed', 2, 3))
    orn.push(doorDark(18, 36)(mid - 9, y - 6, 0))
    for (const k of [-1, 1]) lamp(mid + k * 30, 30)
    return { h, solids: pilasters(f, h, 7), voids, ornaments: orn }
  }
  // the chapels: a gilt saint in a deep niche, a lancet over, candles at its feet
  if (f.y === p.chapelW1.y - 1 || f.y === p.chapelW2.y - 1) {
    const h = 96
    voids.push(...recess(mid, y, 14, 20, 42, 6, 'pointed', 2, 2))
    orn.push(statue(12, 36, true).at(mid - 6, y - 6, 15))
    voids.push(...recess(mid, y, 64, 10, 24, 3, 'pointed'))
    orn.push(lancet(8, 22, 'violet').at(mid - 4, y - 3, 65))
    for (const k of [-1, 1]) lamp(mid + k * 16, 22)
    return { h, voids, ornaments: orn }
  }
  return {}
}

export const INSIDE: Record<string, () => Model> = {
  nave_shell: () => shell({ name: 'nave_shell', plan: NAVE.plan, h: 112, wall: 'stone', dress: dressNave }),
  nave_pier: () => ({ ...pier(136), name: 'nave_pier' }),
  crypt_pillar: () => ({ ...pier(54), name: 'crypt_pillar' }),
  hall_pillar: () => ({ ...pier(110, 'granite'), name: 'hall_pillar' }),
  nave_apse: () => ({ ...apse(20, 9), name: 'nave_apse' }),
  nave_baldachin: () => ({ ...baldachin(), name: 'nave_baldachin' }),
  nave_labyrinth: () => ({ ...labyrinth(), name: 'nave_labyrinth' }),
  belfry_bells: () => ({ ...bellFrame(), name: 'belfry_bells' }),
  wall_nave: () => ({ ...wallFace({ w: 28, h: 160, mat: 'stone', windows: 'lancet', glass: 'blue', every: 3 }), name: 'wall_nave' }),
  wall_library: () => ({ ...wallFace({ w: 26, h: 112, mat: 'stone', windows: 'lancet', glass: 'gold', every: 4 }), name: 'wall_library' }),
  wall_refectory: () => ({ ...wallFace({ w: 22, h: 96, mat: 'stone', windows: 'lancet', glass: 'blue', every: 3, hang: 'none' }), name: 'wall_refectory' }),
  wall_crypt: () => ({ ...wallFace({ w: 26, h: 56, mat: 'stone', windows: 'none', every: 2, hang: 'niches' }), name: 'wall_crypt' }),
  wall_greathall: () => ({ ...wallFace({ w: 26, h: 128, mat: 'granite', windows: 'round', every: 4, hang: 'tapestry', hearth: true }), name: 'wall_greathall' }),
  wall_keep_upper: () => ({ ...wallFace({ w: 22, h: 96, mat: 'granite', windows: 'round', every: 4, hang: 'banners', hearth: true }), name: 'wall_keep_upper' }),
  wall_townhall: () => ({ ...wallFace({ w: 24, h: 120, mat: 'stone', windows: 'lancet', glass: 'red', every: 3, hang: 'banners' }), name: 'wall_townhall' }),
  wall_inn: () => ({ ...wallFace({ w: 24, h: 80, mat: 'plasterOchre', windows: 'round', every: 5, hearth: true }), name: 'wall_inn' }),
  wall_tavern: () => ({ ...wallFace({ w: 18, h: 72, mat: 'plaster', windows: 'round', every: 5, hearth: true }), name: 'wall_tavern' }),
  wall_markethall: () => ({ ...wallFace({ w: 26, h: 88, mat: 'stone', windows: 'round', every: 3 }), name: 'wall_markethall' }),
  wall_belfry: () => ({ ...wallFace({ w: 14, h: 96, mat: 'stone', windows: 'lancet', glass: 'blue', every: 4 }), name: 'wall_belfry' }),
}

/** The high altar: a block of white stone under its linen, a gilt frontal, a cross and six candles on its gradine. 3x1. */
function highAltar(): PropModel {
  const W = 3 * S
  const solids: Solid[] = [
    box(1, 3, 0, W - 1, S - 1, 4, 'stone'),
    box(3, 4, 4, W - 3, S - 3, 22, 'marbleWhite'),
    box(4, S - 4, 6, W - 4, S - 2, 20, 'gold'),
    box(2, 3, 22, W - 2, S - 2, 25, 'plasterWhite'),
    box(4, 4, 25, W - 4, 8, 29, 'stone'),
    box(W / 2 - 1, 5, 29, W / 2 + 1, 7, 48, 'gold'),
    box(W / 2 - 6, 5, 40, W / 2 + 6, 7, 42, 'gold'),
    ...[-18, -12, -6, 6, 12, 18].map((dx) => box(W / 2 + dx - 1, 5, 29, W / 2 + dx + 1, 7, 37 + Math.abs(dx) / 6, 'plasterWhite')),
  ]
  return prop({ name: 'high_altar', footprint: ['###'], solids, voids: [], ornaments: [] })
}

/** A standing candelabrum of gilt brass: a tripod foot, a shaft, five branches, their candles and flames. */
function candelabrum(): PropModel {
  const c = S / 2
  const solids: Solid[] = [drum(c, c, 4, 0, 3, 'gold'), drum(c, c, 1.3, 3, 40, 'gold'), box(c - 7, c - 1, 38, c + 7, c + 1, 40, 'gold')]
  for (const dx of [-6, -3, 0, 3, 6]) solids.push(box(c + dx - 0.7, c - 0.7, 40, c + dx + 0.7, c + 0.7, 46, 'plasterWhite'))
  const orn: Ornament[] = [-6, -3, 0, 3, 6].map((dx) => ({ x: c + dx - 0.5, y: c, z: 46, rows: ['y', 'Y'], keys: { y: 'Y0', Y: 'a0' }, free: true }))
  return prop({ name: 'candelabrum', footprint: ['#'], solids, voids: [], ornaments: orn })
}

/** A saint on a plinth: a robed figure of white marble, a book held to the breast, a gilt halo, on a moulded pedestal. */
function saint(): PropModel {
  const c = S / 2
  const solids: Solid[] = [box(1, 2, 0, S - 1, S - 1, 4, 'stone'), box(2, 3, 4, S - 2, S - 2, 16, 'stone'), box(1, 2, 16, S - 1, S - 1, 19, 'stone'), drum(c, c, 4.2, 19, 36, 'marbleWhite'), drum(c, c, 3.2, 36, 46, 'marbleWhite'), drum(c, c, 2.4, 46, 51, 'marbleWhite'), box(c - 2, c + 2, 34, c + 2, c + 4, 39, 'timber')]
  return prop({ name: 'saint', footprint: ['#'], solids, voids: [], ornaments: [{ x: c - 3, y: c, z: 51, rows: [' aaa ', 'a   a', ' aaa '], keys: { a: 'a1' }, free: true }] })
}

/** A length of the altar rail: gilt balusters under a rail of oak. */
function altarRail(): PropModel {
  const solids: Solid[] = [box(0, 9, 0, S, 13, 3, 'stone'), box(0, 9, 14, S, 13, 17, 'timber')]
  for (const x of [3, 8, 13]) solids.push(drum(x, 11, 1.4, 3, 14, 'gold'))
  return prop({ name: 'altar_rail', footprint: ['#'], solids, voids: [], ornaments: [] })
}

/** A processional cross on its stand, gilt. */
function standingCross(): PropModel {
  const c = S / 2
  return prop({ name: 'standing_cross', footprint: ['#'], solids: [drum(c, c, 4, 0, 3, 'stone'), drum(c, c, 1.2, 3, 44, 'gold'), box(c - 6, c - 1, 36, c + 6, c + 1, 39, 'gold'), box(c - 2, c - 1, 44, c + 2, c + 1, 48, 'gold')], voids: [], ornaments: [] })
}

export const PROPS: Record<string, () => PropModel> = {
  high_altar: highAltar,
  candelabrum,
  saint,
  altar_rail: altarRail,
  standing_cross: standingCross,
  pew,
  pulpit,
  font,
  tomb: () => tomb(false),
  tomb_gilt: () => tomb(true),
  organ,
  lectern,
  desk,
  bookcase,
  throne,
  reliquary,
  sarcophagus,
}
