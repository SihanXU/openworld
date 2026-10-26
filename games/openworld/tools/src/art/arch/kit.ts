// The kit the showcase's buildings are made from (docs/showcase.md §3.2): a few kinds, each made to measure — a hall
// (a chapter house, a barracks, a refectory, a guild's hall), a townhouse (the Holy City's narrow tall houses, stone
// below, timbered or washed above, their gables or eaves to the street), a tower (round or square, crenellated or
// under a cone), a gatehouse, a keep, a market stall, a fountain, a bridge. Every kind returns a Model for the oblique
// renderer; what differs between two houses of a street comes from its options and its seed.

import type { Model, Ornament } from './oblique.ts'
import { archEW, archNS, backOf, box, doorSlab, drum, gable, hip, leanTo, merlons, octagon, recess, ringMerlons, spire, type ArchKind, type Solid } from './shapes.ts'
import { banner, bird, bunting, cat, chalkboard, door, drainpipe, hangingBasket, houseWindow, ivy, lancet, lantern, laundry, moss, plaque, poster, pots, produceCrate, quoins, railing, roses, sign, skylight, smoke, stains, weathervane, window, type Glass } from './ornaments.ts'
import { hash } from './materials.ts'

export const S = 16

/** A footprint of w by d cells, all solid, as rows. */
export function solidFootprint(w: number, d: number): string[][] {
  return Array.from({ length: d }, () => Array(w).fill('#'))
}
export const rows = (fp: string[][]) => fp.map((r) => r.join(''))

/** A wall's ramp, by material (what its ornaments' frames are drawn in). */
const RAMP: Record<string, string> = { stone: 's', granite: 'g', graniteRough: 'g', plaster: 'p', plasterRose: 'pk', plasterOchre: 'po', plasterBlue: 'pb', plasterWhite: 'pw', brick: 'b', timber: 'w' }

/**
 * Half-timbering over a plastered face (a paint for a solid): a sill and a plate at every storey, posts every `post`
 * pixels, a brace across every other panel, the timbers the wall's own ramp's darkest.
 */
export function timbering(x0: number, storeyH: number, z0: number, post = 11, seed = 0): (x: number, y: number, z: number) => string | undefined {
  return (x, _y, z) => {
    if (z < z0) return undefined
    const v = (z - z0) % storeyH
    const u = x - x0
    if (v < 2 || v > storeyH - 2) return 'timber'
    const pu = ((u % post) + post) % post
    if (pu < 1.6) return 'timber'
    const panel = Math.floor(u / post)
    const storey = Math.floor((z - z0) / storeyH)
    if (hash(panel, storey, seed) < 0.45) {
      // a brace from one corner of the panel to the other
      const f = pu / post
      const dir = hash(panel, storey, seed + 1) < 0.5
      const line = dir ? f * storeyH : (1 - f) * storeyH
      if (Math.abs(v - line) < 1.3) return 'timber'
    }
    return undefined
  }
}

export interface HallOpts {
  name: string
  w: number
  d: number
  wall: string
  roof: string
  storeys: number
  storeyH?: number
  ridge: 'x' | 'y' | 'hip'
  rise?: number
  /** Door cells on the south row (x). */
  doors?: number[]
  doorKind?: ArchKind
  windows?: 'lancet' | 'rect' | 'round' | 'none'
  glass?: Glass
  buttresses?: boolean
  /** The ground storey stone, the rest of `wall` (a timbered house on a stone plinth). */
  plinth?: string
  timber?: boolean
  chimneys?: number[]
  /** A bellcote on the gable (a chapel's). */
  bell?: boolean
  /** The south row an open arcade one walks under. */
  arcade?: boolean
  /** Merlons along the eaves instead of a roof (a fortified hall). */
  crenel?: boolean
  seed?: number
  sign?: Parameters<typeof sign>[0]
  /** Banners hung from the front's upper storey. */
  banners?: string
}

/** A hall: walls of a material, a roof along x or y or hipped, windows by storey, doors, buttresses if stone. */
export function hall(o: HallOpts): Model {
  const sh = o.storeyH ?? 34
  const H = sh * o.storeys
  const W = o.w * S
  const D = o.d * S
  const fp = solidFootprint(o.w, o.d)
  const solids: Solid[] = []
  const voids: Solid[] = []
  const orn: Ornament[] = []
  const wallRamp = RAMP[o.wall] ?? 's'
  const seed = o.seed ?? 1
  const body = box(0, 0, 0, W, D, H, o.wall)
  if (o.timber) body.paint = timbering(0, sh, o.plinth ? sh : 0, 11, seed)
  solids.push(body)
  if (o.plinth) solids.push(box(-1, -1, 0, W + 1, D + 1, sh, o.plinth))
  // the roof
  const rise = o.rise ?? (o.ridge === 'x' ? D * 0.55 : o.ridge === 'y' ? W * 0.55 : Math.min(W, D) * 0.5)
  if (o.crenel) {
    solids.push(merlons(0, D - 4, W, D, H, 7, 5, 4, 'x', o.wall))
    solids.push(merlons(0, 0, W, 4, H, 7, 5, 4, 'x', o.wall))
    solids.push(merlons(0, 0, 4, D, H, 7, 5, 4, 'y', o.wall))
    solids.push(merlons(W - 4, 0, W, D, H, 7, 5, 4, 'y', o.wall))
  } else if (o.ridge === 'hip') solids.push(hip(-3, -3, W + 3, D + 3, H, rise, o.roof))
  else if (o.ridge === 'x') solids.push(gable(-3, -3, W + 3, D + 3, H, rise, 'x', o.roof, o.wall))
  else {
    const g = gable(-3, 0, W + 3, D + 2, H, rise, 'y', o.roof, o.wall)
    solids.push(g)
    // the gable end over the front, timbered if the house is
    if (o.timber) solids.push({ ...gable(0, D - 2, W, D, H, rise - 3, 'y', o.wall, o.wall), paint: timbering(0, sh, H, 11, seed + 7) })
  }
  for (const cx of o.chimneys ?? []) {
    const x = cx * S + 4
    const top = H + rise * 0.8 + 10
    solids.push(box(x, D * 0.35, H, x + 8, D * 0.35 + 8, top, o.plinth ?? (o.wall.startsWith('plaster') ? 'brick' : o.wall)))
  }
  if (o.bell) {
    const cx = W / 2
    solids.push(box(cx - 9, D - 8, H + rise - 12, cx + 9, D, H + rise + 22, o.wall))
    solids.push(gable(cx - 11, D - 10, cx + 11, D + 1, H + rise + 22, 10, 'y', o.roof, o.wall))
    voids.push(archNS(cx, D - 9, D + 1, H + rise + 2, 10, 18, 'pointed'))
    orn.push(...[0].map(() => bellPic().at(cx - 3, D - 5, H + rise + 4)))
  }
  // buttresses between the bays of a stone hall
  if (o.buttresses) for (let c = 0; c <= o.w; c += 2) {
    const x = Math.min(W - 6, Math.max(0, c * S - 3))
    solids.push(box(x, D - 2, 0, x + 6, D + 5, H - 8, o.wall))
    solids.push(leanTo(x, D, x + 6, D + 5, H - 8, 6, 'n', o.wall))
  }
  // windows: a row a storey, between the doors and the buttresses
  const doors = o.doors ?? []
  for (let st = 0; st < o.storeys; st++) {
    const z = st * sh + (o.windows === 'lancet' ? 6 : 10)
    for (let c = 0; c < o.w; c++) {
      if (st === 0 && doors.includes(c)) continue
      if (o.windows === 'none') break
      const cx = c * S + S / 2
      if (o.windows === 'lancet') {
        const wh = Math.min(sh - 10, 28)
        voids.push(...recess(cx, D, z, 8, wh, 3, 'pointed'))
        orn.push(lancet(6, wh - 1, o.glass ?? 'blue').at(cx - 3, backOf(D, 3), z))
      } else if (o.windows === 'round') {
        voids.push(...recess(cx, D, z, 8, 14, 3, 'round'))
        orn.push(window(6, 12, false).at(cx - 3, backOf(D, 3), z))
      } else {
        const shut = !o.timber && hash(c, st, seed) < 0.6
        orn.push(window(7, 11, shut).at(cx - (shut ? 5 : 3), D, z))
      }
    }
  }
  // the doors
  for (const c of doors) {
    const cx = c * S + S / 2
    const kind = o.doorKind ?? 'round'
    voids.push(...recess(cx, D, 0, 14, 26, 4, kind, 2, 1))
    solids.push(doorSlab(cx, backOf(D, 4), 0, 11, 24, kind))
    orn.push(door(11, 24, kind, wallRamp).at(cx - 5.5, backOf(D, 4) - 1, 0))
    fp[o.d - 1][c] = 'D'
  }
  if (o.sign) orn.push(sign(o.sign).at((doors[0] ?? 0) * S + S - 1, D, sh - 4, true))
  // the clutter of a building in use (docs/showcase.md §3.6): damp at its foot, pipes down its ends, lanterns and baskets
  // by its doors, bills on its walls, moss and birds on its roof
  orn.unshift(stains(W, Math.min(sh, 28), wallRamp, seed).at(0, D, 0))
  if (!o.crenel) for (const x of [2, W - 6]) orn.push(drainpipe(H - 1).at(x, D, 0))
  for (const c of doors) {
    const cx = c * S + S / 2
    for (const k of [-1, 1]) orn.push(lantern(k > 0).at(k < 0 ? cx - 19 : cx + 10, D, 18))
    if (hash(seed, c, 3) < 0.6) orn.push(hangingBasket(['cr0', 'cy0', 'pk1'][c % 3], seed + c).at(cx + 12, D + 2, 34, true))
  }
  for (let c = 1; c < o.w - 1; c++) if (!doors.some((dc) => Math.abs(dc - c) < 2) && hash(seed, c, 7) < 0.18) orn.push(poster(seed * 5 + c).at(c * S + 3, D, 6 + Math.floor(hash(seed, c, 8) * 8)))
  for (let k = 0; k < 3; k++) if (hash(seed, k, 9) < 0.7) orn.push(moss(10 + Math.floor(hash(seed, k, 10) * 10), 4, seed + k).at(hash(seed, k, 11) * (W - 20), D, 0))
  if (o.ridge === 'x' && !o.crenel) for (let k = 0; k < 2 + Math.floor(hash(seed, 12) * 3); k++) orn.push(bird(hash(seed, k, 13) < 0.5, seed + k).at(8 + hash(seed, k, 14) * (W - 20), D / 2, H + rise + 1, true))
  if (o.banners) for (let c = 1; c < o.w; c += Math.max(2, Math.floor(o.w / 3))) orn.push(banner(7, 18, o.banners).at(c * S - 3, D, H - 22))
  // an open arcade along the south row: an arch to each cell, the cells walked under
  if (o.arcade) {
    for (let c = 0; c < o.w; c++) {
      if (doors.includes(c)) continue
      voids.push(archNS(c * S + S / 2, (o.d - 1) * S + 2, D + 1, 0, S - 4, Math.min(sh - 4, 28), 'round'))
      fp[o.d - 1][c] = '.'
    }
  }
  return { name: o.name, footprint: rows(fp), solids, voids, ornaments: orn }
}

/** A small bronze bell. */
function bellPic() {
  const rowsPic = ['  ##  ', ' #### ', ' #### ', '######', '  ##  ']
  return {
    at: (x: number, y: number, z: number): Ornament => ({ x, y, z, rows: rowsPic.map((r) => r.replace(/#/g, 'a')), keys: { a: 'a2' }, free: true }),
  }
}

export interface HouseOpts {
  name: string
  w: number
  d: number
  storeys: number
  wall: string
  roof: 'tile' | 'slate' | 'thatch'
  gableToStreet: boolean
  timber: boolean
  seed: number
  door?: number
  shop?: Parameters<typeof sign>[0]
  /** The upper storeys jutting over the street (a jetty). */
  jetty?: boolean
  /** A stone arcade under the front (the house's south row walked under). */
  arcade?: boolean
}

/** A townhouse: the Holy City's tall narrow house, stone below, washed or timbered above, gable or eaves to the street. */
export function townhouse(o: HouseOpts): Model {
  const sh = 30
  const W = o.w * S
  const D = o.d * S
  const H = sh * o.storeys
  const fp = solidFootprint(o.w, o.d)
  const solids: Solid[] = []
  const voids: Solid[] = []
  const orn: Ornament[] = []
  const jut = o.jetty ? 4 : 0
  // the ground storey: stone; the upper ones of the house's wash, timbered if it is, jutting if it does
  solids.push(box(0, 0, 0, W, D, sh, 'stone'))
  const upper = box(0, 0, sh, W, D + jut, H, o.wall)
  if (o.timber) upper.paint = timbering(0, sh, sh, 10, o.seed)
  solids.push(upper)
  if (jut) solids.push(box(-1, D, sh - 2, W + 1, D + jut + 1, sh + 1, 'timber'))
  const rise = o.gableToStreet ? W * 0.75 : D * 0.6
  if (o.gableToStreet) {
    solids.push(gable(-2, -2, W + 2, D + jut + 2, H, rise, 'y', o.roof, o.wall))
    const end = gable(0, D + jut - 2, W, D + jut, H, rise - 3, 'y', o.wall, o.wall)
    if (o.timber) end.paint = timbering(0, sh, H, 10, o.seed + 3)
    solids.push(end)
    // a hoist beam's window in the gable
    orn.push(window(6, 9, false).at(W / 2 - 3, D + jut, H + 6))
  } else {
    solids.push(gable(-2, -2, W + 2, D + jut + 3, H, rise, 'x', o.roof, o.wall))
    // a dormer in the roof over the street
    const dx = W / 2
    solids.push(box(dx - 8, D * 0.55, H, dx + 8, D * 0.55 + 10, H + rise * 0.55, o.wall))
    solids.push(gable(dx - 10, D * 0.55 - 2, dx + 10, D * 0.55 + 12, H + rise * 0.55, 10, 'y', o.roof, o.wall))
    orn.push(window(6, 8, false).at(dx - 3, D * 0.55 + 10, H + rise * 0.55 - 12))
  }
  // a chimney stack through the roof
  const chx = (hash(o.seed, 3) < 0.5 ? 0.2 : 0.7) * W
  solids.push(box(chx, D * 0.3, H, chx + 7, D * 0.3 + 7, H + rise * 0.85 + 8, 'brick'))
  // the upper storeys' windows, shuttered here and there
  const per = Math.max(1, o.w - 1)
  for (let st = 1; st < o.storeys; st++)
    for (let k = 0; k < per; k++) {
      const cx = ((k + 0.5) / per) * W
      const shut = hash(o.seed, st * 7 + k) < 0.55
      orn.push(window(7, 12, shut, hash(o.seed, st, k) < 0.08).at(cx - (shut ? 5 : 3.5), D + jut, st * sh + 9))
    }
  // the ground storey: a door, a shop's window and sign, or an arcade
  const dc = o.door ?? Math.floor(o.w / 2)
  const dcx = dc * S + S / 2
  if (o.arcade) {
    for (let c = 0; c < o.w; c++) {
      voids.push(archNS(c * S + S / 2, (o.d - 1) * S + 2, D + 1, 0, S - 4, sh - 6, 'round'))
      fp[o.d - 1][c] = '.'
    }
    // the door at the back of the arcade
    voids.push(...recess(dcx, (o.d - 1) * S + 2, 0, 12, 22, 3, 'round'))
    orn.push(door(10, 21, 'round').at(dcx - 5, (o.d - 1) * S - 1, 0))
    fp[o.d - 2][dc] = 'D'
  } else {
    voids.push(...recess(dcx, D, 0, 12, 24, 3, 'round'))
    solids.push(doorSlab(dcx, backOf(D, 3), 0, 10, 22, 'round'))
    orn.push(door(10, 22, 'round').at(dcx - 5, backOf(D, 3) - 1, 0))
    fp[o.d - 1][dc] = 'D'
    for (let c = 0; c < o.w; c++) {
      if (c === dc) continue
      const cx = c * S + S / 2
      if (o.shop) orn.push(window(12, 13, false, false, 'w1').at(cx - 6, D, 6))
      else orn.push(window(7, 10, true).at(cx - 5, D, 9))
    }
  }
  if (o.shop) orn.push(sign(o.shop).at(dcx + 5, D + jut, sh - 2, true))
  return { name: o.name, footprint: rows(fp), solids, voids, ornaments: orn }
}

/**
 * How a house stands to its street (docs/showcase.md §3.2): its eaves along it (the ridge east–west), its gable to it (the
 * ridge north–south, the front a gable end), or a wing brought forward under a gable of its own — at the west end or the
 * east (an L, the door in the corner it makes) or in the middle (a bay, the door in its front). The streets of a town
 * are made of all of them, mixed.
 */
export type HousePlan = 'eaves' | 'gable' | 'wingW' | 'wingE' | 'bay'

export interface HouseOpts2 {
  name: string
  /** Cells wide (7-11 a townhouse, 6-8 a cottage), deep (3 or 4), storeys over the ground floor's. */
  w: number
  d?: number
  upper: number
  wall: string
  roof: 'tile' | 'slate' | 'thatch'
  timber: boolean
  seed: number
  /** How it stands to the street (default its eaves along it). */
  plan?: HousePlan
  /** A wing's width in cells and how far it comes forward (default 4 and 2). */
  wing?: [number, number]
  /** The door's cell (default a third along, clear of a wing); a shop's trade, if the ground floor is a shop. */
  door?: number
  shop?: { sign: Parameters<typeof sign>[0]; goods: string[]; canvas: 'canvasRed' | 'canvasBlue' | 'canvasYellow' | 'canvasGreen' }
  /** A balcony on the first floor; a cross gable over the front's middle (else dormers in the roof). */
  balcony?: boolean
  gablet?: boolean
  /** The ground floor of stone under a washed or timbered upper (else all of `wall`). */
  stoneBelow?: boolean
  shutters?: 'cg' | 'cb' | 'cr' | 'cy'
  bloom?: string
  ivy?: boolean
  banner?: string
  /** Low and poor (the Lower Town's): small windows, no shutters, a lean-to. */
  poor?: boolean
  /** A trade's sign hung by the door of a house that is not a shop (an inn's bed, a tavern's cup). */
  sign?: Parameters<typeof sign>[0]
}

/**
 * A house of the Holy City as one sees it from its street (docs/showcase.md §3.2): as wide as five people stand and a
 * room or two deep, a storey a head taller than a man; the ground floor of stone, its door up a step between two
 * lanterns, or a shop — an arch open on its goods under a striped awning, the trade's sign hung out; the floors above
 * washed or timbered, their windows shuttered over boxes of flowers, curtained, a balcony, a cross gable or dormers in
 * the roof, a chimney smoking; and all the clutter of a front lived in (§3.6).
 */
export function house(o: HouseOpts2): Model {
  const d = o.d ?? 3
  const plan = o.plan ?? 'eaves'
  const W = o.w * S
  const D = d * S
  const G = o.poor ? 40 : 48
  const U = o.poor ? 38 : 44
  const H = G + U * o.upper
  const solids: Solid[] = []
  const voids: Solid[] = []
  const orn: Ornament[] = []
  const r = (k: number) => hash(o.seed, k, 131)
  const below = o.stoneBelow ? 'stone' : o.wall
  const wallRamp = o.stoneBelow ? 's' : RAMP[o.wall] ?? 's'
  // the wing brought forward, if any: its cells [wc0, wc1), its front at Dw
  const [ww, wf] = o.wing ?? [4, 2]
  const winged = plan === 'wingW' || plan === 'wingE' || plan === 'bay'
  const wc0 = plan === 'wingW' ? 0 : plan === 'wingE' ? o.w - ww : Math.floor((o.w - ww) / 2)
  const wc1 = wc0 + ww
  const Dw = winged ? D + wf * S : D
  const inWing = (x0: number, x1: number) => winged && x1 > wc0 * S - 2 && x0 < wc1 * S + 2
  const fp: string[][] = solidFootprint(o.w, d)
  if (winged) for (let k = 0; k < wf; k++) fp.push(Array.from({ length: o.w }, (_, c) => (c >= wc0 && c < wc1 ? '#' : ' ')))
  // (the window's dressing, each its own: a box of flowers, curtains, now and then a little awning)
  const BLOOMS = ['cr0', 'cy0', 'cw0', 'pk1', 'cb0', 'U0', o.bloom ?? 'cr0']
  const CURTAINS = ['cr', 'cb', 'cy', 'pk', 'cw', 'cg', 'U']
  const dress = (k: number, awn = 0.2) => ({
    bloom: o.poor ? (r(k) < 0.25 ? BLOOMS[Math.floor(r(k + 1) * BLOOMS.length)] : undefined) : r(k) < 0.85 ? BLOOMS[Math.floor(r(k + 1) * BLOOMS.length)] : undefined,
    more: { curtain: r(k + 2) < (o.poor ? 0.4 : 0.8) ? CURTAINS[Math.floor(r(k + 3) * CURTAINS.length)] : undefined, awning: !o.poor && r(k + 4) < awn ? ([o.shutters ?? 'cg', 'cw'] as [string, string]) : undefined },
  })
  /** A block of the house: its walls (stone below, washed or timbered above), the string course along its face at `yf`. */
  const block = (x0: number, y0: number, x1: number, yf: number) => {
    orn.push(stains(x1 - x0, Math.min(G, 30), wallRamp, o.seed + x0).at(x0, yf, 0))
    solids.push(box(x0, y0, 0, x1, yf, G, below))
    if (!o.upper) return
    const up = box(x0, y0, G, x1, yf, H, o.wall)
    if (o.timber) up.paint = timbering(x0, U, G, o.w > 9 ? 12 : 10, o.seed)
    solids.push(up)
    solids.push(box(x0 - 1, yf - 2, G - 2, x1 + 1, yf + 2, G + 1, o.timber ? 'timber' : 'stone'))
    for (let st = 1; st < o.upper; st++) if (!o.timber) solids.push(box(x0 - 1, yf - 1, G + st * U - 1, x1 + 1, yf + 1, G + st * U + 1, 'stone'))
  }
  /** A gable end facing the street over a block from x0 to x1 at yf: its triangle, timbered if the house is, its attic window. */
  const gableEnd = (x0: number, x1: number, yf: number, rise: number, k: number) => {
    const face = gable(x0, yf - 2, x1, yf, H, rise - 3, 'y', o.wall, o.wall)
    if (o.timber) face.paint = timbering(x0, U, H, 10, o.seed + k)
    solids.push(face)
    const cx = (x0 + x1) / 2
    const dr = dress(500 + k)
    orn.push(houseWindow(o.poor ? 8 : 10, o.poor ? 10 : 14, o.shutters ?? 'cg', dr.bloom, r(510 + k) < 0.25, dr.more).at(cx - 8, yf, H + 4))
    if (!o.poor && r(520 + k) < 0.5) orn.push({ x: cx - 1, y: yf + 3, z: H + rise - 12, rows: ['ww', 'ww', 'ww', 'ww'], keys: { w: 'w3' }, free: true })
  }

  // ------------------------------------------------------------------ the body and its roof
  block(0, 0, W, D)
  const rise = plan === 'gable' ? Math.min(W * 0.5, 60) : o.poor ? 34 : 44
  if (plan === 'gable') {
    solids.push(gable(-3, -3, W + 3, D + 4, H, rise, 'y', o.roof, o.wall))
    gableEnd(0, W, D, rise, 1)
  } else solids.push(gable(-3, -3, W + 3, D + 4, H, rise, 'x', o.roof, o.wall))
  // the wing: its own walls forward of the body, its gable to the street
  const wRise = ww * S * 0.46
  if (winged) {
    block(wc0 * S, D - S, wc1 * S, Dw)
    solids.push(gable(wc0 * S - 3, D - S - 2, wc1 * S + 3, Dw + 4, H, wRise, 'y', o.roof, o.wall))
    gableEnd(wc0 * S, wc1 * S, Dw, wRise, 2)
  }
  // a cross gable over the front's middle, or dormers in an eaves roof
  const gablet = plan === 'eaves' && o.gablet
  if (gablet) {
    const gw = Math.min(5, o.w - 4) * S
    const gx = (W - gw) / 2
    solids.push(box(gx, D - S, H - 4, gx + gw, D, H + rise * 0.55, o.wall))
    solids.push(gable(gx - 3, D - S - 2, gx + gw + 3, D + 4, H + rise * 0.55, gw * 0.45, 'y', o.roof, o.wall))
    const face = { ...gable(gx, D - 2, gx + gw, D, H + rise * 0.55, gw * 0.42, 'y', o.wall, o.wall) }
    if (o.timber) face.paint = timbering(gx, U, H + rise * 0.55, 10, o.seed + 9)
    solids.push(face)
    orn.push(houseWindow(10, 14, o.shutters ?? 'cg', undefined, r(7) < 0.2).at(W / 2 - 8, D, H + 4))
  } else if (plan !== 'gable' && !o.poor) {
    for (const fx of o.w > 10 ? [0.3, 0.7] : [0.5]) {
      const cx = W * fx
      if (inWing(cx - 14, cx + 14)) continue
      solids.push(box(cx - 10, D - 22, H - 2, cx + 10, D - 2, H + 22, o.wall))
      solids.push(gable(cx - 12, D - 30, cx + 12, D + 1, H + 22, 11, 'y', o.roof, o.wall))
      orn.push(houseWindow(8, 12, o.shutters ?? 'cg').at(cx - 7, D - 2, H + 5))
    }
  }
  // the chimney: through the roof's back slope (an eaves roof) or one side (a gable), capped, its pots
  const chx = plan === 'gable' ? W * (r(1) < 0.5 ? 0.22 : 0.68) : (r(1) < 0.5 ? 0.18 : 0.78) * W
  const chy = plan === 'gable' ? D * 0.4 : D * 0.55
  const chTop = H + rise + 6
  solids.push(box(chx, chy, H, chx + 10, chy + 9, chTop, o.poor ? 'stone' : 'brick'), box(chx - 1, chy - 1, chTop, chx + 11, chy + 10, chTop + 3, 'stone'))
  solids.push(drum(chx + 3, chy + 4, 1.8, chTop + 3, chTop + 9, 'tile'), drum(chx + 7.5, chy + 4, 1.8, chTop + 3, chTop + 7, 'tile'))
  if (r(109) < 0.65) orn.push(smoke(o.seed).at(chx, chy + 5, chTop + 8, true))

  // ------------------------------------------------------------------ the door: in the body's front clear of the wing, or in the bay's front
  const doorInBay = plan === 'bay'
  const firstFree = (from: number) => {
    for (let c = from; c < o.w - 1; c++) if (!inWing(c * S - 14, c * S + S + 14)) return c
    for (let c = from; c > 0; c--) if (!inWing(c * S - 14, c * S + S + 14)) return c
    return from
  }
  const dc = doorInBay ? wc0 + Math.floor(ww / 2) : o.door !== undefined && !inWing(o.door * S - 14, o.door * S + S + 14) ? o.door : firstFree(plan === 'wingW' ? wc1 + 1 : Math.max(1, Math.floor(o.w / 3)))
  const dcx = dc * S + S / 2
  const DF = doorInBay ? Dw : D
  voids.push(...recess(dcx, DF, 0, 24, 40, 4, 'round', 2, 2))
  solids.push(doorSlab(dcx, backOf(DF, 4), 0, 20, 38, 'round'))
  orn.push(door(20, 38, 'round', wallRamp).at(dcx - 10, backOf(DF, 4) - 1, 0))
  solids.push(box(dcx - 14, DF, 0, dcx + 14, DF + 4, 3, 'stone'))
  if (!o.poor) for (const k of [-1, 1]) orn.push(lantern(k > 0).at(k < 0 ? dcx - 23 : dcx + 14, DF, 22))
  fp[doorInBay ? d + wf - 1 : d - 1][dc] = 'D'
  // the shop's arch beside the door, where three cells are clear of the door and the wing
  const shopFits = (c: number) => c >= 0 && c + 3 <= o.w && !inWing(c * S, c * S + 3 * S) && Math.abs(c + 1.5 - (dc + 0.5)) >= 2.5
  const shopAt = !o.shop || doorInBay ? -1 : [dc + 2, dc - 4, dc + 3, dc - 5].find(shopFits) ?? -1
  const shop = shopAt >= 0 ? o.shop : undefined
  // the ground floor's windows and bills along the body's front (and the bay's either side of its door)
  const groundRow = (yf: number, c0: number, c1: number) => {
    for (let c = c0; c < c1; c++) {
      if (yf === DF && Math.abs(c - dc) < 2) continue
      if (yf === D && inWing(c * S, c * S + S)) continue
      if (shop && yf === D && c >= shopAt && c < shopAt + 3) continue
      if (c % 2) {
        const dr = dress(300 + c + yf, 0)
        orn.push(houseWindow(o.poor ? 8 : 10, o.poor ? 10 : 14, o.shutters ?? 'cg', dr.bloom, r(310 + c) < 0.15, dr.more).at(c * S, yf, dr.bloom ? 9 : 14))
      } else if (c > c0 && c < c1 - 1 && r(320 + c) < 0.55) orn.push(poster(o.seed * 7 + c).at(c * S + 4, yf, 12 + Math.floor(r(330 + c) * 10)))
    }
  }
  groundRow(D, 0, o.w)
  if (winged) groundRow(Dw, wc0, wc1)
  if (shop) {
    const sx = shopAt * S
    const sw = 3 * S
    const back = backOf(D, 9)
    voids.push(...recess(sx + sw / 2, D, 0, sw - 4, 38, 9, 'flat', 2, 2))
    solids.push(doorSlab(sx + sw / 2, back, 0, sw - 8, 36, 'flat', 'dark'))
    solids.push(box(sx, D - 1, 38, sx + sw, D + 2, 42, 'timber'))
    // shelves along the back, each with its goods; the counter before them, more goods on its top
    solids.push({ ...box(sx + 2, back - 2, 0, sx + sw - 2, D, 2, 'stone'), uncut: true })
    for (const z of [17, 28]) {
      orn.push({ x: sx + 6, y: back + 1, z: z - 2, rows: [Array(sw - 12).fill('w').join(''), Array(sw - 12).fill('W').join('')], keys: { w: 'w1', W: 'w3' } })
      orn.push({ x: sx + 7, y: back + 1, z, rows: shop.goods, keys: GOODS_KEYS })
    }
    solids.push({ ...box(sx + 4, D - 5, 0, sx + sw - 4, D - 1, 10, 'timber'), uncut: true })
    orn.push({ x: sx + 7, y: D - 5, z: 10 + shop.goods.length, rows: shop.goods, keys: GOODS_KEYS, free: true })
    // the awning over it, striped, its valance
    solids.push(leanTo(sx - 2, D, sx + sw + 2, D + 9, 43, 8, 'n', shop.canvas))
    const [a, b2] = shop.canvas === 'canvasRed' ? ['cr1', 'cw1'] : shop.canvas === 'canvasBlue' ? ['cb1', 'cw1'] : shop.canvas === 'canvasYellow' ? ['cy1', 'cr1'] : ['cg1', 'cw1']
    const val: string[] = []
    for (let j = 0; j < 4; j++) {
      let line = ''
      for (let i = 0; i < sw + 4; i++) line += j < 2 || (j === 2 && i % 6 > 0 && i % 6 < 5) || (j === 3 && i % 6 > 1 && i % 6 < 4) ? (Math.floor(i / 6) % 2 ? 'b' : 'a') : ' '
      val.push(line)
    }
    orn.push({ x: sx - 2, y: D + 9, z: 40, rows: val, keys: { a, b: b2 }, free: true })
    orn.push(sign(shop.sign).at(shopAt > dc ? sx + sw - 4 : sx - 6, D + 4, 46, true))
    // the trade's goods spilling out either side of its arch, the slate of the day's prices
    const goods = GOODS_KEYS[(shop.goods[1] ?? 'r').replace(/ /g, '')[0] ?? 'r'] ?? 'E1'
    for (const x of [sx - 11, sx + sw + 1]) if (x > 0 && x < W - 10 && Math.abs(x + 5 - dcx) > 16 && !inWing(x, x + 10)) orn.push(produceCrate(goods, o.seed + x).at(x, D, 0, true))
    const cb = shopAt > dc ? sx + sw + 12 : sx - 22
    if (cb > 0 && cb < W - 8 && Math.abs(cb + 4 - dcx) > 16 && !inWing(cb, cb + 8)) orn.push(chalkboard(o.seed).at(cb, D, 0, true))
  }
  // ------------------------------------------------------------------ the floors above: windows two cells apart on the body and on the wing
  const balconyX = (() => {
    if (!o.balcony || !o.upper) return undefined
    for (const cx of [W / 2, W * 0.3, W * 0.7]) if (!inWing(cx - 26, cx + 26)) return cx
    return undefined
  })()
  for (let st = 0; st < o.upper; st++) {
    const z = G + st * U + 12
    for (let c = 1; c < o.w - 1; c += 2) {
      const cx = c * S + S / 2
      if (inWing(cx - 9, cx + 9)) continue
      if (balconyX !== undefined && st === 0 && Math.abs(cx - balconyX) < 24) continue
      if (gablet && st === o.upper - 1 && Math.abs(cx - W / 2) < 30) continue
      const dr = dress(400 + st * 31 + c)
      orn.push(houseWindow(o.poor ? 8 : 12, o.poor ? 12 : 20, o.shutters ?? 'cg', dr.bloom, r(20 + st * 9 + c) < 0.15, dr.more).at(cx - (o.poor ? 7 : 9), D, z - (dr.bloom ? 5 : 0)))
    }
    if (winged) {
      const cxs = ww >= 4 ? [wc0 * S + ww * S * 0.28, wc0 * S + ww * S * 0.72] : [wc0 * S + (ww * S) / 2]
      cxs.forEach((cx, k) => {
        const dr = dress(450 + st * 13 + k)
        orn.push(houseWindow(o.poor ? 8 : 12, o.poor ? 12 : 20, o.shutters ?? 'cg', dr.bloom, r(460 + st * 7 + k) < 0.15, dr.more).at(cx - (o.poor ? 7 : 9), Dw, z - (dr.bloom ? 5 : 0)))
      })
    }
  }
  // the balcony: its floor on brackets, its railing, the tall window behind it, its pots and washing
  if (balconyX !== undefined) {
    const bw = 3 * S
    const bx = balconyX - bw / 2
    solids.push(box(bx, D, G, bx + bw, D + 8, G + 3, 'timber'))
    for (const x of [bx + 3, bx + bw - 5]) solids.push(box(x, D, G - 8, x + 2, D + 6, G, 'timber'))
    orn.push(houseWindow(14, 26, o.shutters ?? 'cg', undefined, r(3) < 0.3, { curtain: CURTAINS[Math.floor(r(4) * CURTAINS.length)] }).at(balconyX - 10, D, G + 3))
    orn.push(pots(bw - 6, o.seed + 5).at(bx + 3, D + 6, G + 3, true))
    orn.push(railing(bw, 11).at(bx, D + 8, G + 3, true))
    if (r(6) < 0.55) orn.push(laundry(bw + 4, o.seed).at(bx - 2, D + 8, G + U - 4, true))
  }
  if (o.sign) orn.push(sign(o.sign).at(dcx + 16, DF + 4, 46, true))
  // the corners' quoins on a stone ground floor, ivy, a banner
  if (o.stoneBelow && !o.poor) {
    for (const x of [0, W - 8]) orn.push(quoins(G - 2).at(x, D, 0))
    if (winged) for (const x of [wc0 * S, wc1 * S - 8]) orn.push(quoins(G - 2).at(x, Dw, 0))
  }
  if (o.ivy) {
    const x = r(2) < 0.5 ? 2 : W - 20
    orn.push(ivy(18, G + U - 4, o.seed).at(x, inWing(x, x + 18) ? Dw : D, 0))
  }
  if (o.banner) {
    const x = inWing(W * 0.72, W * 0.72 + 10) ? wc0 * S + ww * S * 0.5 - 5 : W * 0.72
    orn.push(banner(10, 30, o.banner).at(x, inWing(x, x + 10) ? Dw : D, G + 4))
  }
  // ------------------------------------------------------------------ the clutter of a lived-in front (docs/showcase.md §3.6)
  // a drainpipe down a corner, roses or ivy up another; moss on the stones at the foot
  const pipeLeft = r(50) < 0.5
  const pipeX = pipeLeft ? 2 : W - 6
  orn.push(drainpipe(H - 1).at(pipeX, inWing(pipeX, pipeX + 4) ? Dw : D, 0))
  if (winged) orn.push(drainpipe(H - 1).at(pipeLeft ? wc1 * S - 6 : wc0 * S + 2, Dw, 0))
  if (!o.ivy && r(51) < 0.5) {
    const x = pipeLeft ? W - 18 : 6
    orn.push(roses(16, G + (o.upper ? 14 : 0), BLOOMS[Math.floor(r(52) * BLOOMS.length)], o.seed).at(x, inWing(x, x + 16) ? Dw : D, 0))
  }
  for (let k = 0; k < 3; k++)
    if (r(53 + k) < (o.stoneBelow || o.poor ? 0.8 : 0.3)) {
      const x = r(59 + k) * (W - 16)
      orn.push(moss(10 + Math.floor(r(56 + k) * 8), 4, o.seed + k).at(x, inWing(x, x + 16) ? Dw : D, 0))
    }
  if (!o.poor) {
    // the house's number by its door, a basket of flowers hung either side over the lanterns
    orn.push(plaque().at(dcx + 13, DF, 40))
    for (const k of [-1, 1]) if (r(60 + k) < 0.7) orn.push(hangingBasket(BLOOMS[Math.floor(r(62 + k) * BLOOMS.length)], o.seed + k).at(k < 0 ? dcx - 25 : dcx + 18, DF + 2, 46, true))
    // pots along the foot of the fronts where nothing else is, a string of flags under the eaves now and then
    const busy = (x: number) => Math.abs(x - dcx) < 18 || (shop ? x > shopAt * S - 14 && x < shopAt * S + 3 * S + 14 : false)
    for (let x = 4; x < W - 12; x += 12) {
      if (busy(x) || busy(x + 10) || r(70 + x) >= 0.7) continue
      const yf = inWing(x, x + 10) ? Dw : D
      if (yf === Dw && !(x >= wc0 * S && x + 10 <= wc1 * S)) continue
      orn.push(pots(10, o.seed + x).at(x, yf, 0, true))
    }
    if (o.upper && r(64) < 0.35 && !winged) orn.push(bunting(W - 8, o.seed).at(4, D + 1, H - 2, true))
  } else {
    if (r(65) < 0.6 && !winged) orn.push(laundry(Math.min(W - 8, 40), o.seed).at(4, D + 2, G - 6, true))
    if (r(66) < 0.5) {
      const x = r(67) < 0.5 ? 4 : W - 14
      if (!inWing(x, x + 9)) orn.push(pots(9, o.seed).at(x, D, 0, true))
    }
  }
  // ------------------------------------------------------------------ the roof: moss in its courses, a skylight, birds on the ridge, a cat, a weathervane
  const roofAt = (x: number, y: number) => {
    if (plan === 'gable') return { y, z: H + rise * (1 - Math.abs(x - W / 2) / (W / 2 + 3)) }
    const cy = (D + 1) / 2
    return { y, z: H + rise * (1 - (y - cy) / ((D + 7) / 2)) }
  }
  for (let k = 0; k < 4; k++)
    if (r(80 + k) < 0.6) {
      const x = 4 + r(92 + k) * (W - 24)
      if (inWing(x, x + 26)) continue
      const p = roofAt(x + 8, D - 2 - r(84 + k) * (D / 2 - 4))
      orn.push(moss(12 + Math.floor(r(88 + k) * 14), 5, o.seed + 20 + k).at(x, p.y, p.z, true))
    }
  if (!o.poor && plan !== 'gable' && r(96) < 0.5) {
    const x = r(97) < 0.5 ? W * 0.2 : W * 0.65
    if (!inWing(x, x + 6)) orn.push(skylight().at(x, D - 8, roofAt(x, D - 8).z, true))
  }
  const ridge = plan === 'gable' ? { x0: W / 2 - 3, x1: W / 2 + 3, y: D / 2 } : { x0: 8, x1: W - 12, y: (D + 1) / 2 }
  for (let k = 0; k < 1 + Math.floor(r(98) * 4); k++) {
    const x = plan === 'gable' ? ridge.x0 : ridge.x0 + r(103 + k) * (ridge.x1 - ridge.x0)
    const y = plan === 'gable' ? 4 + r(103 + k) * (D - 8) : ridge.y
    orn.push(bird(r(99 + k) < 0.5, o.seed + k).at(x, y, H + rise + 1, true))
  }
  if (r(107) < 0.15) orn.push(cat(o.seed).at(plan === 'gable' ? W / 2 - 3 : r(108) * (W - 12) + 4, ridge.y, H + rise, true))
  if (gablet && r(110) < 0.5) orn.push(weathervane().at(W / 2 - 3, D - 4, H + rise * 0.55 + Math.min(5, o.w - 4) * S * 0.45, true))
  if (winged && r(111) < 0.45) orn.push(weathervane().at(wc0 * S + (ww * S) / 2 - 3, Dw - 4, H + wRise, true))
  if (plan === 'gable' && r(112) < 0.5) orn.push(weathervane().at(W / 2 - 3, D - 4, H + rise, true))
  if (o.poor) {
    // a lean-to of planks against one end, a barrel's worth of shelter
    const lx = r(5) < 0.5 ? -2 * S : W
    solids.push(box(lx + 2, D - 2 * S, 0, lx + 2 * S - 2, D, 26, 'timber'), leanTo(lx, D - 2 * S - 2, lx + 2 * S, D + 2, 26, 10, lx < 0 ? 'e' : 'w', o.roof))
  }
  return { name: o.name, footprint: rows(fp), solids, voids, ornaments: orn }
}

export interface TowerOpts {
  name: string
  /** Footprint cells (square). */
  size: number
  round: boolean
  height: number
  wall: string
  top: 'crenel' | 'cone' | 'pyramid'
  roof?: string
  door?: boolean
  /** A passage through it, north to south (a gate tower). */
  passage?: boolean
  clock?: boolean
  slits?: boolean
  banner?: string
}

/** A tower: round or square, its arrow slits, its top crenellated or under a cone or a pyramid; a door or a passage. */
export function tower(o: TowerOpts): Model {
  const W = o.size * S
  const c = W / 2
  const H = o.height
  const fp = solidFootprint(o.size, o.size)
  const solids: Solid[] = []
  const voids: Solid[] = []
  const orn: Ornament[] = []
  const r = c - 1
  if (o.round) solids.push(drum(c, c, r, 0, H, o.wall))
  else solids.push(box(0, 0, 0, W, W, H, o.wall))
  // a battered plinth
  if (o.round) solids.push(drum(c, c, r + 2, 0, 14, o.wall))
  else solids.push(box(-2, -2, 0, W + 2, W + 2, 14, o.wall))
  if (o.top === 'crenel') {
    // corbelled parapet: a ring a little wider on its corbels, merlons on it
    if (o.round) {
      solids.push(drum(c, c, r + 3, H - 10, H, o.wall))
      solids.push(ringMerlons(c, c, r + 3, 5, H, 8, Math.round(o.size * 4), o.wall))
    } else {
      solids.push(box(-3, -3, H - 10, W + 3, W + 3, H, o.wall))
      solids.push(merlons(-3, W - 2, W + 3, W + 3, H, 8, 6, 5, 'x', o.wall))
      solids.push(merlons(-3, -3, W + 3, 2, H, 8, 6, 5, 'x', o.wall))
      solids.push(merlons(-3, -3, 2, W + 3, H, 8, 6, 5, 'y', o.wall))
      solids.push(merlons(W - 2, -3, W + 3, W + 3, H, 8, 6, 5, 'y', o.wall))
    }
    if (o.banner) orn.push(banner(8, 22, o.banner).at(c - 4, W + 3, H - 30))
  } else {
    const roof = o.roof ?? 'slate'
    if (o.round) solids.push(spire(c, c, r + 4, H, W * 1.15, 0, roof))
    else solids.push(spire(c, c, c + 3, H, W * 0.95, 4, roof))
  }
  if (o.slits) for (let z = 30; z < H - 24; z += 34) {
    voids.push(...recess(c, o.round ? c + r : W, z, 4, 14, 2, 'flat'))
    orn.push({ x: c - 1, y: (o.round ? c + r : W) - 2, z, rows: Array(13).fill('##'), keys: { '#': 'n2' } })
  }
  if (o.clock) orn.push(...[0].map(() => clockAt(c, o.round ? c + r : W, H - 40)))
  if (o.door) {
    voids.push(...recess(c, o.round ? c + r : W, 0, 14, 26, 4, 'round', 2, 1))
    solids.push(doorSlab(c, (o.round ? c + r : W) - 4, 0, 11, 24, 'round'))
    orn.push(door(11, 24, 'round').at(c - 5.5, (o.round ? c + r : W) - 5, 0))
    fp[o.size - 1][Math.floor(o.size / 2)] = 'D'
  }
  if (o.passage) {
    const pw = Math.min(W - 12, 2 * S - 4)
    voids.push(archNS(c, -1, W + 3, 0, pw, 44, 'pointed'))
    for (let y = 0; y < o.size; y++) for (let x = 0; x < o.size; x++) if (Math.abs((x + 0.5) * S - c) < pw / 2) fp[y][x] = '.'
  }
  return { name: o.name, footprint: rows(fp), solids, voids, ornaments: orn }
}

function clockAt(x: number, y: number, z: number): Ornament {
  const r = 9
  const d = r * 2 + 1
  const rowsPic: string[] = []
  for (let j = 0; j < d; j++) {
    let line = ''
    for (let i = 0; i < d; i++) {
      const dx = i - r
      const dy = r - j
      const dist = Math.hypot(dx, dy)
      if (dist > r) line += ' '
      else if (dist > r - 1.3) line += 'a'
      else if ((Math.abs(dx) < 0.6 && dy > 0 && dy < r - 2) || (Math.abs(dy) < 0.6 && dx > 0 && dx < r - 3)) line += 'k'
      else if (Math.abs(((Math.atan2(dy, dx) / (Math.PI * 2)) * 12 + 12.5) % 1 - 0.5) < 0.09 && dist > r - 2.8) line += 'k'
      else line += 'p'
    }
    rowsPic.push(line)
  }
  return { x: x - r, y, z: z - r, rows: rowsPic, keys: { a: 'a2', k: 'k', p: 'p0' } }
}

export interface GateOpts {
  name: string
  /** Cells between the towers' middles. */
  span: number
  towerR: number
  height: number
  wall: string
  roofs: boolean
  banner?: string
}

/**
 * A gatehouse: two round towers either side of a passage under a vaulted gate, a portcullis half raised in its arch,
 * machicolations over it, the towers under cones (Carcassonne's Narbonne Gate) or crenellated.
 */
export function gatehouse(o: GateOpts): Model {
  const R = o.towerR * S
  const w = o.span + o.towerR * 2
  const d = o.towerR * 2 + 1
  const W = w * S
  const Dp = d * S
  const fp = solidFootprint(w, d)
  const solids: Solid[] = []
  const voids: Solid[] = []
  const orn: Ornament[] = []
  const cy = Dp - R - 2
  const lx = R
  const rx = W - R
  const H = o.height
  // the gate block between the towers, its passage, its machicolated parapet
  solids.push(box(lx, S, 0, rx, Dp, H - 16, o.wall))
  solids.push(box(lx - 2, Dp - 8, H - 30, rx + 2, Dp + 3, H - 16, o.wall))
  solids.push(merlons(lx - 2, Dp - 2, rx + 2, Dp + 3, H - 16, 8, 6, 5, 'x', o.wall))
  for (let x = lx + 4; x < rx - 4; x += 10) voids.push(box(x, Dp - 1, H - 34, x + 5, Dp + 4, H - 30, 'void'))
  const pw = Math.min(o.span * S - 8, 3 * S)
  const mid = W / 2
  voids.push(archNS(mid, -1, Dp + 4, 0, pw, 52, 'pointed'))
  for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) if (Math.abs((x + 0.5) * S - mid) < pw / 2) fp[y][x] = '.'
  // the portcullis, half raised, in the arch's mouth
  const grid: string[] = []
  for (let j = 0; j < 24; j++) {
    let line = ''
    for (let i = 0; i < pw - 6; i++) line += i % 6 === 0 || j % 6 === 0 ? '#' : ' '
    grid.push(line)
  }
  grid.push(...Array(1).fill([...Array(pw - 6)].map((_, i) => (i % 6 === 0 ? 'v' : ' ')).join('')))
  orn.push({ x: mid - pw / 2 + 3, y: Dp - 3, z: 52 - 26, rows: grid, keys: { '#': 'i2', v: 'i1' } })
  // the towers
  for (const tx of [lx, rx]) {
    solids.push(drum(tx, cy, R, 0, H, o.wall))
    solids.push(drum(tx, cy, R + 2, 0, 16, o.wall))
    if (o.roofs) {
      solids.push(drum(tx, cy, R + 2, H - 8, H, o.wall))
      solids.push(spire(tx, cy, R + 5, H, R * 2.3, 0, 'slate'))
    } else {
      solids.push(drum(tx, cy, R + 3, H - 10, H, o.wall))
      solids.push(ringMerlons(tx, cy, R + 3, 5, H, 8, Math.round(R / 3), o.wall))
    }
    for (let z = 34; z < H - 30; z += 36) {
      voids.push(...recess(tx, cy + R, z, 4, 16, 3, 'flat'))
      orn.push({ x: tx - 1, y: cy + R - 3, z, rows: Array(15).fill('##'), keys: { '#': 'n2' } })
    }
  }
  if (o.banner) for (const tx of [lx + R + 8, rx - R - 16]) orn.push(banner(8, 24, o.banner).at(tx, Dp + 3, H - 52))
  return { name: o.name, footprint: rows(fp), solids, voids, ornaments: orn }
}

export interface KeepOpts {
  name: string
  w: number
  d: number
  height: number
  wall: string
  banner?: string
}

/**
 * A keep: a great square tower of four storeys, pilaster buttresses, a turret at each corner rising over the
 * crenellated top, a forebuilding with its stair up to the door on the first floor (Rochester, Dover), a flag.
 */
export function keep(o: KeepOpts): Model {
  const W = o.w * S
  const D = o.d * S
  const H = o.height
  const fp = solidFootprint(o.w, o.d + 2)
  const solids: Solid[] = []
  const voids: Solid[] = []
  const orn: Ornament[] = []
  solids.push(box(0, 0, 0, W, D, H, o.wall))
  solids.push(box(-2, -2, 0, W + 2, D + 2, 18, o.wall))
  // pilasters up the front
  for (let x = W / 4; x < W; x += W / 4) solids.push(box(x - 4, D - 2, 0, x + 4, D + 3, H - 6, o.wall))
  // the top: a corbelled parapet, merlons, turrets at the corners
  solids.push(box(-3, -3, H - 8, W + 3, D + 3, H, o.wall))
  solids.push(merlons(-3, D - 2, W + 3, D + 3, H, 9, 6, 5, 'x', o.wall))
  solids.push(merlons(-3, -3, W + 3, 2, H, 9, 6, 5, 'x', o.wall))
  solids.push(merlons(-3, -3, 2, D + 3, H, 9, 6, 5, 'y', o.wall))
  solids.push(merlons(W - 2, -3, W + 3, D + 3, H, 9, 6, 5, 'y', o.wall))
  for (const [tx, ty] of [[8, 8], [W - 8, 8], [8, D - 8], [W - 8, D - 8]]) {
    solids.push(box(tx - 9, ty - 9, H - 8, tx + 9, ty + 9, H + 28, o.wall))
    solids.push(merlons(tx - 9, ty + 5, tx + 9, ty + 9, H + 28, 7, 4, 3, 'x', o.wall))
    solids.push(merlons(tx - 9, ty - 9, tx + 9, ty - 5, H + 28, 7, 4, 3, 'x', o.wall))
  }
  // a low hipped roof of lead inside the parapet, the turrets' tops round it
  solids.push(hip(14, 14, W - 14, D - 14, H - 8, Math.min(W, D) * 0.3, 'lead'))
  // a flag on a pole over the middle
  solids.push(box(W / 2 - 1, D / 2 - 1, H, W / 2 + 1, D / 2 + 1, H + 60, 'timber'))
  if (o.banner) orn.push(banner(14, 22, o.banner).at(W / 2 + 1, D / 2, H + 58 - 22, true))
  // windows: slits low, round-headed pairs higher
  for (let st = 0; st < 4; st++) {
    const z = 22 + st * (H / 4.3)
    for (let k = 1; k < 4; k++) {
      const cx = (k * W) / 4 + W / 8
      if (cx > W - 8) continue
      if (st < 2) {
        voids.push(...recess(cx, D, z, 4, 14, 3, 'flat'))
        orn.push({ x: cx - 1, y: D - 3, z, rows: Array(13).fill('##'), keys: { '#': 'n2' } })
      } else {
        voids.push(...recess(cx, D, z, 14, 22, 4, 'round'))
        orn.push(window(5, 18, false, st === 3).at(cx - 6, D - 4, z))
        orn.push(window(5, 18, false, st === 3).at(cx + 1, D - 4, z))
      }
    }
  }
  // the forebuilding: a lower block before the door, its stair rising along its front
  const fx0 = W / 2 - 2 * S
  const fx1 = W / 2 + 2 * S
  solids.push(box(fx0, D, 0, fx1, D + 2 * S, 74, o.wall))
  solids.push(merlons(fx0, D + 2 * S - 4, fx1, D + 2 * S, 74, 7, 5, 4, 'x', o.wall))
  voids.push(...recess(W / 2, D + 2 * S, 0, 22, 40, 6, 'round', 3, 3))
  solids.push(doorSlab(W / 2, D + 2 * S - 6, 0, 14, 32, 'round'))
  orn.push(door(14, 32, 'round', 'g').at(W / 2 - 7, D + 2 * S - 7, 0))
  for (let y = o.d; y < o.d + 2; y++) for (let x = 0; x < o.w; x++) fp[y][x] = (x + 0.5) * S > fx0 && (x + 0.5) * S < fx1 ? '#' : ' '
  fp[o.d + 1][Math.floor(o.w / 2) - 1] = 'D'
  fp[o.d + 1][Math.floor(o.w / 2)] = 'D'
  return { name: o.name, footprint: rows(fp), solids, voids, ornaments: orn }
}

export interface StallOpts {
  name: string
  canvas: 'canvasRed' | 'canvasBlue' | 'canvasYellow' | 'canvasGreen' | 'canvasPlain'
  /** What lies on its counter: rows of palette keys, drawn on the counter's top. */
  goods: string[]
}

/** A market stall: a counter of boards on trestles, four posts, a striped canvas over it, its goods laid out. */
export function stall(o: StallOpts): Model {
  const W = 3 * S
  const D = 2 * S
  const solids: Solid[] = []
  const orn: Ornament[] = []
  // the counter along the front, the posts, the canvas sloping back — high, so the one who keeps the stall is seen under it
  solids.push(box(2, D - 10, 0, W - 2, D - 1, 14, 'timber'))
  for (const [x, y] of [[2, 3], [W - 4, 3], [2, D - 4], [W - 4, D - 4]]) solids.push(box(x, y, 0, x + 2, y + 2, 58, 'timber'))
  solids.push(leanTo(-1, 1, W + 1, D + 3, 56, 10, 'n', o.canvas))
  // the canvas's valance, scalloped, hanging over the front
  const val: string[] = []
  for (let j = 0; j < 4; j++) {
    let line = ''
    for (let i = 0; i < W + 2; i++) line += j < 2 || (j === 2 && i % 6 > 0 && i % 6 < 5) || (j === 3 && i % 6 > 1 && i % 6 < 4) ? (Math.floor(i / 5) % 2 ? 'b' : 'a') : ' '
    val.push(line)
  }
  const [a, b] = o.canvas === 'canvasRed' ? ['cr1', 'cw1'] : o.canvas === 'canvasBlue' ? ['cb1', 'cw1'] : o.canvas === 'canvasYellow' ? ['cy1', 'cr1'] : o.canvas === 'canvasGreen' ? ['cg1', 'cw1'] : ['cw1', 'cw2']
  orn.push({ x: -1, y: D + 3, z: 53, rows: val, keys: { a, b }, free: true })
  // the goods on the counter (drawn on its top, which the oblique view shows as a band over its front)
  orn.push({ x: 5, y: D - 10, z: 14 + o.goods.length, rows: o.goods.map((r) => r), keys: GOODS_KEYS, free: true })
  const fp = [' . ', '###']
  return { name: o.name, footprint: fp.map((r) => r.replace(/ /g, '.')), solids, voids: [], ornaments: orn }
}
/** The keys the goods are drawn in: fruit red and green, bread, fish, cloth, pots, candles, herbs. */
export const GOODS_KEYS: Record<string, string> = {
  r: 'E1', R: 'E2', g: 'V1', G: 'V2', o: 'Y1', y: 'a1', b: 'h1', B: 'h3', f: 'i0', F: 'i1', c: 'cb1', C: 'cr1', w: 'cw0', p: 't2', P: 't3', k: 'k', s: 's1', u: 'U1',
}

export interface FountainOpts {
  name: string
}

/** A great fountain: a round basin, a second smaller one raised on a shaft, a statue at the top, water falling. */
export function fountain(o: FountainOpts): Model {
  const W = 4 * S
  const c = W / 2
  const solids: Solid[] = [
    drum(c, c, c - 1, 0, 10, 'stone'),
    { ...drum(c, c, c - 4, 6, 9, 'water') },
    drum(c, c, 5, 6, 34, 'stone'),
    drum(c, c, 13, 30, 38, 'stone'),
    { ...drum(c, c, 11, 34, 37, 'water') },
    drum(c, c, 3, 34, 52, 'stone'),
  ]
  const orn: Ornament[] = []
  // a figure on top, the jets falling from the upper basin
  orn.push({ x: c - 3, y: c, z: 52, rows: [' ### ', ' ### ', '  #  ', ' ### ', '#####', ' ### ', ' ### ', ' # # '], keys: { '#': 'a1' }, free: true })
  for (const dx of [-12, -6, 6, 12]) orn.push({ x: c + dx, y: c + 10, z: 12, rows: Array(24).fill('q'), keys: { q: 'q0' }, free: true })
  return { name: o.name, footprint: ['####', '####', '####', '####'], solids, voids: [], ornaments: orn }
}

/**
 * A great fountain for a city's square (Rome's, Siena's Fonte Gaia): a wide octagonal basin with a moulded rim, its water;
 * a second basin on a carved pedestal; a gilt figure on the top with its arm raised; four jets arching into the basin
 * and the water falling from the upper one. 6x6.
 */
export function grandFountain(name: string): Model {
  const W = 6 * S
  const c = W / 2
  const solids: Solid[] = [
    octagon(c, c, c - 1, 0, 12, 'stone'),
    octagon(c, c, c - 5, 8, 11, 'water'),
    octagon(c, c, 9, 8, 40, 'stone'),
    drum(c, c, 20, 36, 44, 'stone'),
    drum(c, c, 17, 41, 43, 'water'),
    octagon(c, c, 5, 42, 62, 'stone'),
    drum(c, c, 7, 60, 64, 'gold'),
  ]
  const orn: Ornament[] = []
  orn.push({ x: c - 4, y: c, z: 64, rows: ['  ##   ', ' ###   ', '  #  # ', ' ######', ' ####  ', ' ###   ', ' ###   ', ' # #   ', ' # #   '], keys: { '#': 'a1' }, free: true })
  // the jets: four arcs of white water from the rim's middle into the basin, the falls from the upper basin
  for (const dx of [-30, 30]) {
    const rowsPic: string[] = []
    for (let j = 0; j < 18; j++) {
      const t = j / 17
      const off = Math.round(Math.sin(t * Math.PI) * 6)
      rowsPic.push(' '.repeat(Math.max(0, dx < 0 ? 8 - off : off)) + 'qq')
    }
    orn.push({ x: c + dx - (dx < 0 ? 0 : 8), y: c + 18, z: 12, rows: rowsPic, keys: { q: 'q0' }, free: true })
  }
  for (const dx of [-18, -10, 10, 18]) orn.push({ x: c + dx, y: c + 14, z: 12, rows: Array(26).fill('q'), keys: { q: dx % 20 ? 'q0' : 'q1' }, free: true })
  return { name, footprint: Array(6).fill('######'), solids, voids: [], ornaments: orn }
}

/** A stone bridge over a canal three cells wide: its deck (walked on, laid as ground), parapets, the arch's face south. */
export function bridge(name: string, w: number): Model {
  const W = w * S
  const D = 5 * S
  const solids: Solid[] = [
    box(0, 0, 0, W, D, 12, 'stone'),
    box(0, 0, 12, 4, D, 18, 'stone'),
    box(W - 4, 0, 12, W, D, 18, 'stone'),
  ]
  const voids: Solid[] = [archEW(D / 2, -1, W + 1, -40, 3 * S, 50, 'round')]
  const fp: string[] = []
  for (let y = 0; y < 5; y++) fp.push('#'.repeat(w))
  return { name, footprint: fp, solids, voids, ornaments: [], ground: true, terrain: 'bridge' }
}

