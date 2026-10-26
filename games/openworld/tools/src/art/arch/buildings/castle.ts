// The North Gate's castle redrawn (docs/showcase.md §4.3; the user's word of 2026-10-26: "这城堡太丑了"): walls that are
// walls — thick and tall, battered at the foot, slits in their face, a walk along their top between two parapets,
// machicolations under the outer one — round towers as stout as Beaumaris's drums under low cones, a gatehouse of two
// drum towers, a keep with its turrets and its lead roof, and all of it weathered: damp, moss, banners, lanterns.

import type { Model, Ornament } from '../oblique.ts'
import { archNS, box, doorSlab, drum, hip, leanTo, merlons, recess, ringMerlons, spire, type Solid } from '../shapes.ts'
import { banner, door, drainpipe, lantern, moss, stains, window } from '../ornaments.ts'
import { rows, S, solidFootprint } from '../kit.ts'
import { hash } from '../materials.ts'

/** A curtain wall's height to the walk, its thickness (cells). */
const WALL_H = 76
const SLIT = (x: number, y: number, z: number): Ornament => ({ x: x - 1, y: y - 2, z, rows: [' ## ', '####', ' ## ', ' ## ', ' ## ', ' ## ', ' ## ', ' ## ', ' ## ', ' ## ', ' ## '], keys: { '#': 'n2' } })

/** Weathering on a granite face: damp from the foot, moss in tufts, a few cracks of darker stone. */
function weather(W: number, y: number, h: number, seed: number): Ornament[] {
  const out: Ornament[] = [stains(W, Math.min(h, 34), 'g', seed).at(0, y, 0)]
  for (let k = 0; k < Math.ceil(W / 40); k++) if (hash(seed, k) < 0.75) out.push(moss(10 + Math.floor(hash(seed, k, 2) * 12), 4, seed + k).at(hash(seed, k, 3) * (W - 16), y, 0))
  return out
}

/**
 * A stretch of curtain wall along x (`len` cells, two deep): its battered foot, the face with slits, the machicolated
 * outer parapet and the inner one, the walk between; a buttress every few cells, a banner now and then.
 */
function curtainX(name: string, len: number, seed: number): Model {
  const W = len * S
  const D = 2 * S
  const solids: Solid[] = []
  const voids: Solid[] = []
  const orn: Ornament[] = [...weather(W, D, WALL_H, seed)]
  solids.push(box(0, 3, 0, W, D, WALL_H, 'granite'))
  solids.push(leanTo(0, D - 2, W, D + 5, 0, 18, 'n', 'granite'))
  // the outer parapet jutting on its corbels, its merlons; the inner, plain
  solids.push(box(0, D - 3, WALL_H - 6, W, D + 3, WALL_H + 2, 'granite'))
  for (let x = 2; x < W - 2; x += 6) solids.push(box(x, D, WALL_H - 12, x + 3, D + 3, WALL_H - 6, 'granite'))
  solids.push(merlons(0, D - 1, W, D + 3, WALL_H + 2, 9, 6, 5, 'x', 'granite'))
  solids.push(merlons(0, 3, W, 6, WALL_H, 7, 6, 5, 'x', 'granite'))
  for (let c = 1; c < len; c += 2) {
    const cx = c * S
    voids.push(...recess(cx, D, 30, 4, 18, 3, 'flat'))
    orn.push(SLIT(cx, D, 30))
  }
  for (let c = 0; c <= len; c += 4) {
    const x = Math.min(W - 8, Math.max(0, c * S - 4))
    solids.push(box(x, D - 2, 0, x + 8, D + 4, WALL_H - 14, 'granite'), leanTo(x, D, x + 8, D + 4, WALL_H - 14, 8, 'n', 'granite'))
  }
  if (hash(seed, 9) < 0.6) orn.push(banner(10, 30, hash(seed, 10) < 0.5 ? 'U' : 'E').at(W / 2 - 5, D + 3, WALL_H - 38))
  return { name, footprint: rows(solidFootprint(len, 2)), solids, voids, ornaments: orn }
}

/** A stretch of curtain wall along y (`len` cells, two wide): seen from above its walk between the parapets, its end. */
function curtainY(name: string, len: number, seed: number): Model {
  const W = 2 * S
  const D = len * S
  const solids: Solid[] = [box(3, 0, 0, W - 3, D, WALL_H, 'granite'), merlons(0, 0, 4, D, WALL_H, 9, 6, 5, 'y', 'granite'), merlons(W - 4, 0, W, D, WALL_H, 9, 6, 5, 'y', 'granite'), box(0, 0, WALL_H - 6, 4, D, WALL_H, 'granite'), box(W - 4, 0, WALL_H - 6, W, D, WALL_H, 'granite')]
  // the walk's flags along its top, a brazier's black now and then
  const orn: Ornament[] = [...weather(W, D, WALL_H, seed)]
  for (let y = 10; y < D - 6; y += 40) orn.push({ x: W / 2 - 2, y, z: WALL_H, rows: ['iii', 'iYi', 'iii'], keys: { i: 'i3', Y: 'Y1' }, free: true })
  return { name, footprint: rows(solidFootprint(2, len)), solids, voids: [], ornaments: orn }
}

/** A drum tower of the curtain (Beaumaris's): stout, battered, slits on three stages, a machicolated ring, a low cone. */
function drumTower(name: string, size: number, height: number, top: 'cone' | 'crenel', seed: number): Model {
  const W = size * S
  const c = W / 2
  const r = c - 1
  const solids: Solid[] = [drum(c, c, r, 0, height, 'granite'), drum(c, c, r + 3, 0, 20, 'granite')]
  const voids: Solid[] = []
  const orn: Ornament[] = [...weather(W, c + r, height, seed)]
  // the machicolated ring: corbels, the ring over them
  for (let k = 0; k < 16; k++) {
    const a = Math.PI * (k / 15)
    solids.push(box(c + Math.cos(a) * (r + 1) - 1.5, c + Math.sin(a) * (r + 1) - 1, height - 14, c + Math.cos(a) * (r + 1) + 1.5, c + Math.sin(a) * (r + 1) + 2, height - 8, 'granite'))
  }
  solids.push(drum(c, c, r + 3, height - 8, height, 'granite'))
  if (top === 'cone') {
    solids.push(drum(c, c, r + 1, height, height + 10, 'granite'))
    solids.push(spire(c, c, r + 6, height + 8, W * 0.62, 0, 'slate'))
    solids.push(box(c - 1, c - 1, height + 8 + W * 0.62, c + 1, c + 1, height + 8 + W * 0.62 + 16, 'ironDark'))
    orn.push(banner(10, 12, 'U').at(c + 1, c, height + 8 + W * 0.62 + 4, true))
  } else {
    solids.push(ringMerlons(c, c, r + 3, 5, height, 9, Math.round(size * 3), 'granite'))
    solids.push(box(c - 1, c - 1, height, c + 1, c + 1, height + 34, 'timber'))
    orn.push(banner(14, 18, 'U').at(c + 1, c, height + 32 - 18, true))
  }
  for (let z = 30; z < height - 26; z += 30) {
    voids.push(...recess(c, c + r, z, 4, 18, 3, 'flat'))
    orn.push(SLIT(c, c + r, z))
  }
  // a window high up where the garrison sleeps, lit at night
  voids.push(...recess(c, c + r, height - 36, 10, 14, 3, 'round'))
  orn.push(window(8, 12, false, hash(seed, 4) < 0.5).at(c - 4, c + r - 3, height - 36))
  return { name, footprint: rows(solidFootprint(size, size)), solids, voids, ornaments: orn }
}

/**
 * The great gatehouse: two drum towers under cones either side of the gate block, its arch deep under a machicolated
 * gallery, the portcullis half raised, the arms of the city over the arch, lanterns at the mouth.
 */
function greatGate(name: string, towers: boolean): Model {
  // (the towers' radius, the gate block between them: wide enough for its arch and the towers clear of it)
  const R = towers ? 40 : 34
  const block = 3 * S
  const w = Math.ceil((4 * R + block + 4) / S)
  const d = Math.ceil((2 * R + 8) / S) + 1
  const W = w * S
  const Dp = d * S
  const H = towers ? 112 : 90
  const fp = solidFootprint(w, d)
  const solids: Solid[] = []
  const voids: Solid[] = []
  const orn: Ornament[] = [...weather(W, Dp, H, towers ? 31 : 37)]
  const cy = Dp - R - 2
  const lx = R + 2
  const rx = W - R - 2
  // the gate block, its gallery over the arch, the passage
  solids.push(box(lx, S, 0, rx, Dp, H - 14, 'granite'))
  solids.push(box(lx - 2, Dp - 8, H - 30, rx + 2, Dp + 4, H - 14, 'granite'))
  for (let x = lx + 2; x < rx - 2; x += 7) solids.push(box(x, Dp - 2, H - 38, x + 3, Dp + 4, H - 30, 'granite'))
  solids.push(merlons(lx - 2, Dp, rx + 2, Dp + 4, H - 14, 9, 6, 5, 'x', 'granite'))
  solids.push(gableRoof(lx, rx, S, Dp - 6, H - 14))
  const pw = 2 * S + 4
  const mid = W / 2
  voids.push(archNS(mid, -1, Dp + 5, 0, pw, 54, 'pointed'))
  voids.push(...recess(mid, Dp, 0, pw + 14, 66, 6, 'pointed', 3, 4))
  for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) if (Math.abs((x + 0.5) * S - mid) < pw / 2) fp[y][x] = '.'
  // the portcullis, half raised
  const grid: string[] = []
  for (let j = 0; j < 26; j++) {
    let line = ''
    for (let i = 0; i < pw - 6; i++) line += i % 6 === 0 || j % 6 === 0 ? '#' : ' '
    grid.push(line)
  }
  grid.push([...Array(pw - 6)].map((_, i) => (i % 6 === 0 ? 'v' : ' ')).join(''))
  orn.push({ x: mid - pw / 2 + 3, y: Dp - 3, z: 54 - 27, rows: grid, keys: { '#': 'i3', v: 'i2' } })
  // the city's arms over the arch: a shield of violet with the gold sun
  orn.push({ x: mid - 7, y: Dp, z: 70, rows: ['aaaaaaaaaaaaaa', 'aUUUUUUUUUUUUa', 'aUUUUyyyyUUUUa', 'aUUUyyyyyyUUUa', 'aUUUyyyyyyUUUa', 'aUUUUyyyyUUUUa', 'aUUUUUUUUUUUUa', ' aUUUUUUUUUUa ', '  aUUUUUUUUa  ', '   aUUUUUUa   ', '     aaaa     '], keys: { a: 'a2', U: 'U1', y: 'a0' } })
  for (const k of [-1, 1]) orn.push(lantern(k > 0).at(k < 0 ? mid - pw / 2 - 12 : mid + pw / 2 + 3, Dp, 30))
  // the towers
  for (const tx of [lx, rx]) {
    solids.push(drum(tx, cy, R, 0, H, 'granite'), drum(tx, cy, R + 3, 0, 20, 'granite'))
    for (let k = 0; k < 14; k++) {
      const a = Math.PI * (k / 13)
      solids.push(box(tx + Math.cos(a) * (R + 1) - 1.5, cy + Math.sin(a) * (R + 1) - 1, H - 14, tx + Math.cos(a) * (R + 1) + 1.5, cy + Math.sin(a) * (R + 1) + 2, H - 8, 'granite'))
    }
    solids.push(drum(tx, cy, R + 3, H - 8, H, 'granite'))
    if (towers) {
      solids.push(spire(tx, cy, R + 6, H, R * 1.3, 0, 'slate'))
      solids.push(box(tx - 1, cy - 1, H + R * 1.3, tx + 1, cy + 1, H + R * 1.3 + 16, 'ironDark'))
      orn.push(banner(10, 12, 'U').at(tx + 1, cy, H + R * 1.3 + 4, true))
    } else solids.push(ringMerlons(tx, cy, R + 3, 5, H, 9, 10, 'granite'))
    for (let z = 32; z < H - 30; z += 30) {
      voids.push(...recess(tx, cy + R, z, 4, 18, 3, 'flat'))
      orn.push(SLIT(tx, cy + R, z))
    }
  }
  for (const tx of [lx + R + 4, rx - R - 14]) orn.push(banner(10, 32, 'U').at(tx, Dp + 4, H - 66))
  return { name, footprint: rows(fp), solids, voids, ornaments: orn }

  /** The gate block's roof behind its parapet: a low slate gable. */
  function gableRoof(x0: number, x1: number, y0: number, y1: number, z0: number): Solid {
    return hip(x0 + 4, y0 + 2, x1 - 4, y1, z0, 18, 'slate')
  }
}

/**
 * The keep (Rochester's, Dover's): a great square tower of three tall storeys on a battered plinth, pilasters, round-headed
 * windows in pairs, a turret at each corner under its own cone, a lead hipped roof inside the parapet, the flag; the
 * forebuilding before its door, its stair climbing the front under a pent roof.
 */
function greatKeep(): Model {
  const w = 12
  const d = 9
  const W = w * S
  const D = d * S
  const H = 150
  const fp = solidFootprint(w, d + 2)
  const solids: Solid[] = []
  const voids: Solid[] = []
  const orn: Ornament[] = [...weather(W, D, H, 51)]
  solids.push(box(0, 0, 0, W, D, H, 'granite'), box(-3, -3, 0, W + 3, D + 3, 22, 'granite'), leanTo(-3, D, W + 3, D + 8, 0, 14, 'n', 'granite'))
  for (let x = W / 4; x < W; x += W / 4) solids.push(box(x - 5, D - 2, 0, x + 5, D + 4, H - 8, 'granite'))
  // the parapet on its corbels, the merlons; the corner turrets under cones; the lead roof within
  solids.push(box(-3, -3, H - 8, W + 3, D + 3, H, 'granite'))
  for (let x = 0; x < W; x += 7) solids.push(box(x, D, H - 14, x + 3, D + 3, H - 8, 'granite'))
  solids.push(merlons(-3, D - 1, W + 3, D + 3, H, 9, 6, 5, 'x', 'granite'), merlons(-3, -3, W + 3, 1, H, 9, 6, 5, 'x', 'granite'))
  solids.push(merlons(-3, -3, 1, D + 3, H, 9, 6, 5, 'y', 'granite'), merlons(W - 1, -3, W + 3, D + 3, H, 9, 6, 5, 'y', 'granite'))
  for (const [tx, ty] of [[10, 10], [W - 10, 10], [10, D - 10], [W - 10, D - 10]]) {
    solids.push(drum(tx, ty, 11, H - 8, H + 26, 'granite'), drum(tx, ty, 13, H + 22, H + 28, 'granite'), spire(tx, ty, 15, H + 28, 30, 0, 'slate'))
    solids.push(box(tx - 1, ty - 1, H + 56, tx + 1, ty + 1, H + 66, 'ironDark'))
  }
  solids.push(hip(16, 16, W - 16, D - 16, H - 8, Math.min(W, D) * 0.28, 'lead'))
  solids.push(box(W / 2 - 1, D / 2 - 1, H, W / 2 + 1, D / 2 + 1, H + 64, 'timber'))
  orn.push(banner(18, 24, 'U').at(W / 2 + 1, D / 2, H + 62 - 24, true))
  // windows: slits below, round-headed pairs above, lit by night
  for (let st = 0; st < 3; st++) {
    const z = 28 + st * 42
    for (let k = 0; k < 4; k++) {
      const cx = (k + 0.5) * (W / 4)
      if (Math.abs(cx - W / 2) < 2 * S + 4 && st === 0) continue
      if (st === 0) {
        voids.push(...recess(cx, D, z, 4, 18, 3, 'flat'))
        orn.push(SLIT(cx, D, z))
      } else {
        voids.push(...recess(cx, D, z, 16, 26, 4, 'round', 2, 2))
        orn.push(window(5, 20, false, st === 2 && k % 2 === 0).at(cx - 6, D - 4, z))
        orn.push(window(5, 20, false, st === 2 && k % 2 === 1).at(cx + 1, D - 4, z))
      }
    }
  }
  for (const x of [W / 8 - 5, W - W / 8 - 5]) orn.push(banner(10, 34, 'U').at(x, D + 3, H - 50))
  orn.push(drainpipe(H - 2).at(2, D, 0))
  // the forebuilding: a lower block before the door, crenellated, its pent stair along its front, the door at its foot
  const fx0 = W / 2 - 2.5 * S
  const fx1 = W / 2 + 2.5 * S
  const FD = D + 2 * S
  solids.push(box(fx0, D, 0, fx1, FD, 70, 'granite'), merlons(fx0, FD - 4, fx1, FD, 70, 8, 6, 4, 'x', 'granite'))
  solids.push(leanTo(fx0 - 6, FD - 6, fx0 + 2 * S, FD + 2, 40, 16, 'e', 'slate'))
  voids.push(...recess(W / 2, FD, 0, 26, 44, 7, 'round', 3, 3))
  solids.push(doorSlab(W / 2, FD - 7, 0, 18, 36, 'round'))
  orn.push(door(18, 36, 'round', 'g').at(W / 2 - 9, FD - 8, 0))
  for (const k of [-1, 1]) orn.push(lantern(k > 0).at(k < 0 ? W / 2 - 26 : W / 2 + 17, FD, 30))
  for (let y = d; y < d + 2; y++) for (let x = 0; x < w; x++) fp[y][x] = (x + 0.5) * S > fx0 && (x + 0.5) * S < fx1 ? '#' : ' '
  fp[d + 1][w / 2 - 1] = 'D'
  fp[d + 1][w / 2] = 'D'
  return { name: 'fort_keep', footprint: rows(fp), solids, voids, ornaments: orn }
}

export const CASTLE: Record<string, () => Model> = {
  fort_keep: greatKeep,
  fort_gatehouse: () => greatGate('fort_gatehouse', true),
  fort_barbican: () => greatGate('fort_barbican', false),
  fort_tower_round: () => drumTower('fort_tower_round', 7, 104, 'cone', 61),
  fort_tower_crenel: () => drumTower('fort_tower_crenel', 6, 92, 'crenel', 62),
  ...Object.fromEntries([2, 3, 4, 5, 6, 8, 10, 12].flatMap((n) => [[`fort_wall_x${n}`, () => curtainX(`fort_wall_x${n}`, n, 70 + n)], [`fort_wall_y${n}`, () => curtainY(`fort_wall_y${n}`, n, 90 + n)]])),
}
