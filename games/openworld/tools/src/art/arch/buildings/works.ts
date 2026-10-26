// The farm's and the mine's buildings (docs/showcase.md §4c): the Vale's farmsteads — thatched farmhouses, barns with
// their gable ends to the yard and the loft's hay at the door, a dovecote, a granary on staddle stones against the rats,
// a hen house, the watermill with its wheel in the race; and the Scarred March's mine — the adit's timbered mouth in the
// rock, the headframe over the shaft with its sheave, the spoil heaps, the sheds, the rails the carts run on, the ore.

import type { Model, Ornament } from '../oblique.ts'
import { backOf, box, doorSlab, drum, gable, leanTo, recess, spire, type Solid } from '../shapes.ts'
import { bird, door, lantern, moss, pots, smoke, stains, window } from '../ornaments.ts'
import { house, S } from '../kit.ts'
import { hash } from '../materials.ts'

const one = (name: string, footprint: string[], solids: Solid[], ornaments: Ornament[] = [], voids: Solid[] = []): Model => ({ name, footprint, solids, voids, ornaments })
const C = S / 2

/** A wheel drawn as pixel rows (a cart's, the mill's, a sheave): rim `r`, hub and spokes `s`, `n` of them. */
function wheel(r: number, n: number): Ornament['rows'] {
  const rows: string[] = []
  for (let y = -r; y <= r; y++) {
    let l = ''
    for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y)
      const a = Math.atan2(y, x)
      const onSpoke = d < r - 1 && Array.from({ length: n }, (_, k) => (k / n) * Math.PI * 2).some((s) => Math.abs(Math.sin(a - s)) * d < 0.7 && Math.cos(a - s) > 0)
      l += d > r - 2 && d <= r ? 'r' : d < 2.2 ? 'r' : onSpoke ? 's' : ' '
    }
    rows.push(l)
  }
  return rows
}

// ------------------------------------------------------------------------------------------------ the farm

/** A barn: its gable end to the yard, the great doors, the loft door over them with the hay showing, a lean-to at the side. */
function barn(name: string, w: number, d: number, seed: number, wall: string, roof: string): Model {
  const W = w * S
  const D = d * S
  const bw = W - S
  const H = 58
  const cx = bw / 2
  const solids: Solid[] = [box(0, 0, 0, bw, D, H, wall), gable(-3, -3, bw + 3, D + 3, H, bw * 0.55, 'y', roof, wall)]
  // the lean-to at the east end: a cart shed, open to the yard
  solids.push(box(bw, 6, 0, W, D - 4, 30, wall), leanTo(bw - 2, 3, W + 1, D - 1, 30, 12, 'w', roof))
  const voids: Solid[] = [...recess(cx, D, 0, 34, 42, 4, 'flat'), ...recess(cx, D, H + 6, 14, 16, 3, 'flat'), box(bw + 3, D - 10, 0, W - 3, D + 1, 26, 'dark')]
  solids.push(doorSlab(cx - 8, backOf(D, 4), 0, 16, 40, 'flat', 'timber'), doorSlab(cx + 8, backOf(D, 4), 0, 16, 40, 'flat', 'timber'))
  const orn: Ornament[] = [
    // the doors' braces, the hay in the loft, a hay hook's beam over it
    { x: cx - 16, y: backOf(D, 4) - 1, z: 0, rows: Array.from({ length: 40 }, (_, j) => Array.from({ length: 32 }, (_, i) => (i === 0 || i === 15 || i === 16 || i === 31 || j === 0 || j === 39 || Math.abs((i % 16) - (j * 15) / 39) < 0.8 ? 'w' : ' ')).join('')), keys: { w: 'w3' } },
    { x: cx - 6, y: backOf(D, 3) - 1, z: H + 6, rows: ['hHhhHhhhHhhh', 'hhHhhhHhhhHh', 'HhhhHhhhhHhh', 'hhhHhhHhhhhH', 'hHhhhhhHhHhh', 'hhhhHhhhhhhh'], keys: { h: 'h1', H: 'h2' } },
    { x: cx - 2, y: D + 4, z: H + 22, rows: ['wwww', 'w   ', 'w   '], keys: { w: 'w3' }, free: true },
    stains(bw, 24, 'w', seed).at(0, D, 0),
    moss(14, 5, seed).at(6, D + 2, H + 4, true),
    bird(seed % 2 === 0, seed).at(cx, D / 2, H + bw * 0.55 + 1, true),
    // a cart wheel against the lean-to, a pitchfork
    { x: bw + 2, y: D + 2, z: 0, rows: wheel(7, 6), keys: { r: 'w3', s: 'w2' }, free: true },
    { x: 4, y: D + 1, z: 0, rows: ['i i i', 'i i i', ' iii ', '  w  ', '  w  ', '  w  ', '  w  ', '  w  ', '  w  ', '  w  ', '  w  ', '  w  ', '  w  '], keys: { i: 'i1', w: 'w1' }, free: true },
  ]
  const fp = Array.from({ length: d }, () => '#'.repeat(w).split(''))
  fp[d - 1][Math.floor(cx / S)] = 'D'
  return one(name, fp.map((r) => r.join('')), solids, orn, voids)
}

/** A farmhouse of the Vale: thatch over washed walls, timbered or stone below, flowers and the clutter of a farm's front. */
function farmhouse(i: number): Model {
  const r = (k: number) => hash(i, k, 1201)
  return house({
    name: `farm_house_${i}`,
    w: 7 + (i % 3),
    d: r(1) < 0.4 ? 4 : 3,
    upper: i % 2,
    wall: ['plasterOchre', 'plaster', 'stone', 'plasterRose', 'plasterWhite', 'plasterOchre'][i % 6],
    roof: 'thatch',
    timber: i % 3 !== 0,
    seed: 1200 + i,
    plan: (['eaves', 'gable', 'wingE', 'wingW', 'bay', 'gable'] as const)[i % 6],
    wing: [3, 1],
    stoneBelow: i % 2 === 0,
    shutters: (['cg', 'cb', 'cr', 'cy'] as const)[i % 4],
    ivy: i % 3 === 1,
  })
}

/** A round dovecote of stone under a cone of thatch, its rows of holes, the doves on the ledge and the roof. */
function dovecote(): Model {
  const solids: Solid[] = [drum(S, S, 13, 0, 46, 'stone'), drum(S, S, 14.5, 30, 32, 'stone'), spire(S, S, 16, 46, 26, 0, 'thatch')]
  const voids: Solid[] = [...recess(S, 2 * S - 3, 0, 10, 18, 3, 'round')]
  const orn: Ornament[] = [door(10, 18, 'round', 'w').at(S - 5, 2 * S - 5, 0)]
  for (const z of [34, 40]) orn.push({ x: S - 9, y: 2 * S - 2, z, rows: ['n n n n n', 'n n n n n'], keys: { n: 'n1' } })
  for (const [k, x] of [[0, S - 8], [1, S + 4]]) orn.push(bird(k === 0, k + 4).at(x, 2 * S - 1, 32, true))
  orn.push(bird(false, 9).at(S - 2, S, 72, true))
  return one('farm_dovecote', ['##', '##'], solids, orn, voids)
}

/** A granary on staddle stones (the rats cannot climb their caps), its steps, its tiled roof. */
function staddleGranary(): Model {
  const W = 3 * S
  const D = 2 * S
  const solids: Solid[] = []
  for (const x of [5, W / 2, W - 5]) for (const y of [5, D - 5]) solids.push(drum(x, y, 2.4, 0, 9, 'stone'), drum(x, y, 4.6, 9, 11, 'stone'))
  solids.push(box(1, 1, 11, W - 1, D - 1, 36, 'timber'), gable(-2, -2, W + 2, D + 2, 36, 14, 'x', 'tile', 'timber'))
  const voids: Solid[] = [...recess(W / 2, D - 1, 13, 10, 18, 2, 'flat')]
  const orn: Ornament[] = [door(10, 18, 'flat', 'w').at(W / 2 - 5, D - 3, 13), { x: W / 2 - 4, y: D + 6, z: 0, rows: ['wwwwwwww', '        ', 'wwwwwwww', '        ', 'wwwwwwww', '        ', 'wwwwwwww'], keys: { w: 'w2' }, free: true }]
  return one('farm_staddle', ['###', '###'], solids, orn, voids)
}

/** A hen house on legs: its ramp, the nest boxes' lids along its side, straw at the hatch. */
function coop(): Model {
  const W = 2 * S
  const D = 2 * S
  const solids: Solid[] = []
  for (const x of [5, W - 5]) for (const y of [7, D - 5]) solids.push(box(x - 1, y - 1, 0, x + 1, y + 1, 8, 'timber'))
  solids.push(box(2, 4, 8, W - 2, D - 3, 24, 'timber'), leanTo(0, 2, W, D, 24, 7, 'n', 'thatch'), box(W - 8, 6, 12, W, D - 6, 19, 'darkwood'))
  const orn: Ornament[] = [
    { x: 6, y: D + 6, z: 0, rows: ['   www', '  www ', ' www  ', 'www   '], keys: { w: 'w1' }, free: true },
    { x: 8, y: D - 3, z: 12, rows: ['nnnn', 'nnnn', 'nnnn'], keys: { n: 'n2' } },
    { x: 4, y: D + 2, z: 0, rows: [' hh h ', 'hhhhhh'], keys: { h: 'h1' }, free: true },
  ]
  return one('farm_coop', ['##', '##'], solids, orn)
}

/** The watermill: a stone mill under red tile, its wheel in the race at the east end, the sluice, sacks at the door. */
function watermill(): Model {
  const w = 9
  const d = 4
  const bw = 7 * S
  const D = d * S
  const H = 62
  const solids: Solid[] = [box(0, 0, 0, bw, D, H, 'stone'), gable(-3, -3, bw + 3, D + 3, H, D * 0.62, 'x', 'tile', 'stone')]
  // the race's walls and the sluice's trough over the wheel, the axle out of the mill's wall
  solids.push(box(bw, 4, 0, bw + 3, D, 18, 'stone'), box(w * S - 3, 4, 0, w * S, D, 18, 'stone'), box(bw, 18, 52, w * S, 28, 56, 'timber'), drum(bw + 2, D / 2, 3, 26, 30, 'iron'))
  const dcx = 3 * S + C
  const voids: Solid[] = [...recess(dcx, D, 0, 18, 30, 4, 'round', 2, 2)]
  solids.push(doorSlab(dcx, backOf(D, 4), 0, 14, 28, 'round'))
  const orn: Ornament[] = [door(14, 28, 'round', 'w').at(dcx - 7, backOf(D, 4) - 1, 0)]
  for (const x of [12, 44, 92]) orn.push(window(10, 14, true, hash(x, 3) < 0.4).at(x, D, 32))
  orn.push({ x: bw + 3, y: D / 2 + 2, z: 2, rows: wheel(26, 8), keys: { r: 'w3', s: 'w2' }, free: true })
  // the water spilling from the trough onto the wheel's paddles
  orn.push({ x: bw + 22, y: 28, z: 30, rows: ['qQ', 'Qq', 'qQ', 'Qq', 'qQ', 'qq', 'Qq', 'qQ', 'qq', 'Qq', 'qQ', 'qq', 'qQ', 'Qq', 'qq', 'qQ', 'Qq', 'qq', 'qQ', 'Qq', 'qq', 'qQ'], keys: { q: 'q1', Q: 'q0' }, free: true })
  orn.push(stains(bw, 20, 'g', 7).at(0, D, 0), smoke(3).at(20, D / 2, H + D * 0.62, true), pots(16, 2).at(dcx + 12, D + 1, 0, true))
  for (const x of [dcx - 22, dcx + 12]) orn.push({ x, y: D + 4, z: 0, rows: [' cc  ', 'cccc ', 'cCccc', 'ccccc'], keys: { c: 'cw1', C: 'cw2' }, free: true })
  const fp = Array.from({ length: d }, () => '#'.repeat(w).split(''))
  fp[d - 1][3] = 'D'
  return one('farm_watermill', fp.map((r) => r.join('')), solids, orn, voids)
}

// ------------------------------------------------------------------------------------------------ the mine

/** The adit: a timbered mouth in the red rock, its posts and lintel, the dark going in, a lantern, the rails out of it. */
function adit(): Model {
  const W = 3 * S
  const D = 2 * S
  const solids: Solid[] = [box(0, 0, 0, W, D - 6, 60, 'sandstoneRough'), box(14, 0, 0, 34, D - 6, 36, 'dark')]
  for (const x of [10, 34]) solids.push(box(x, D - 9, 0, x + 4, D - 4, 38, 'timber'))
  solids.push(box(7, D - 9, 36, 41, D - 4, 42, 'timber'))
  const voids: Solid[] = [box(14, D - 7, 0, 34, D + 1, 36, 'dark')]
  const orn: Ornament[] = [lantern(false).at(36, D - 3, 26, true), stains(W, 40, 'rd', 5).at(0, D - 6, 0)]
  for (let z = 44; z < 60; z += 5) orn.push({ x: 2 + (z % 7), y: D - 6, z, rows: ['n  n ', ' nn  '], keys: { n: 'rd4' } })
  return one('mine_adit', ['###', '#D#'], solids, orn, voids)
}

/** The headframe over the shaft: four legs braced, the platform, the sheave at the top, the rope down to the cage. */
function headframe(): Model {
  const W = 4 * S
  const solids: Solid[] = []
  for (const x of [8, W - 8]) for (const y of [8, W - 8]) solids.push(box(x - 2, y - 2, 0, x + 2, y + 2, 84, 'timber'))
  for (const z of [24, 52]) {
    solids.push(box(6, 6, z, W - 6, 10, z + 3, 'timber'), box(6, W - 10, z, W - 6, W - 6, z + 3, 'timber'))
    solids.push(box(6, 6, z, 10, W - 6, z + 3, 'timber'), box(W - 10, 6, z, W - 6, W - 6, z + 3, 'timber'))
  }
  solids.push(box(4, W / 2 - 3, 84, W - 4, W / 2 + 3, 88, 'timber'), box(W / 2 - 3, 4, 84, W / 2 + 3, W - 4, 87, 'timber'), box(20, 20, 0, W - 20, W - 20, 3, 'timber'), box(24, 24, 0, W - 24, W - 24, 2, 'dark'))
  const orn: Ornament[] = [
    { x: W / 2 - 12, y: W / 2, z: 88, rows: wheel(12, 6), keys: { r: 'i2', s: 'i1' }, free: true },
    { x: W / 2 - 1, y: W / 2, z: 6, rows: Array.from({ length: 84 }, () => 'n'), keys: { n: 'n1' }, free: true },
    { x: W / 2 - 6, y: W / 2 + 2, z: 4, rows: ['iiiiiiiiiiii', 'i    ii    i', 'i    ii    i', 'i    ii    i', 'i    ii    i', 'iiiiiiiiiiii'], keys: { i: 'i2' }, free: true },
    lantern(true).at(10, W - 6, 60, true),
    bird(false, 11).at(W / 2 + 4, W / 2, 100, true),
  ]
  return one('mine_headframe', ['####', '####', '####', '####'], solids, orn)
}

/** A spoil heap: the waste rock tipped from the carts, its stones, the rails' end on its top. */
function spoil(name: string, w: number, seed: number): Model {
  const W = w * S
  const D = 2 * S
  const H = 18 + w * 4
  const mound = (x: number, y: number, z: number) => {
    const dx = (x - W / 2) / (W / 2)
    const dy = (y - D / 2) / (D / 2)
    return z <= H * (1 - dx * dx - dy * dy * 0.6) + hash(Math.floor(x / 3), Math.floor(y / 3), seed) * 3
  }
  const solids: Solid[] = [{ b: [0, 0, 0, W, D, H + 4], mat: 'sandstoneRough', inside: mound }]
  const orn: Ornament[] = []
  for (let k = 0; k < 6; k++) orn.push({ x: Math.round(hash(k, seed, 1) * (W - 6)), y: D + 1, z: 0, rows: [' nn ', 'nnnn'], keys: { n: k % 2 ? 'rd3' : 'g3' }, free: true })
  return one(name, ['#'.repeat(w), '#'.repeat(w)], solids, orn)
}

/** The ore heap by the adit: red rock with the glint of copper and iron in it. */
function oreHeap(): Model {
  const solids: Solid[] = [{ b: [0, 0, 0, S, S, 12], mat: 'sandstoneRough', inside: (x, y, z) => z <= 11 * (1 - ((x - C) / C) ** 2 - ((y - C) / C) ** 2 * 0.7) }]
  return one('decor_ore', ['#'], solids, [{ x: 3, y: S, z: 2, rows: ['  a   i  ', ' i  a    ', '   i   a ', '  a  i   '], keys: { a: 'a2', i: 'i0' }, free: true }])
}

/** A millstone and its runner laid by the wall (the mill's spare). */
function millstone(): Model {
  return one('decor_millstone', ['#'], [drum(C, C, 7, 0, 4, 'graniteRough'), drum(C, C, 6.5, 4, 8, 'graniteRough')], [{ x: C - 1, y: C + 6, z: 8, rows: ['nn'], keys: { n: 'n2' }, free: true }])
}

/** Rails laid flat on their sleepers, across a cell east to west, or north to south. */
function rails(axis: 'h' | 'v'): Model {
  const rows: string[] = []
  for (let y = 0; y < S; y++) {
    let l = ''
    for (let x = 0; x < S; x++) {
      const u = axis === 'h' ? x : y
      const v = axis === 'h' ? y : x
      l += v === 4 || v === 11 ? 'i' : u % 4 === 1 && v > 2 && v < 13 ? 'w' : ' '
    }
    rows.push(l)
  }
  return { name: `decor_rails_${axis}`, footprint: ['.'], solids: [], voids: [], ornaments: [{ x: 0, y: S, z: 0, rows, keys: { i: 'i1', w: 'w3' }, free: true }], ground: true }
}

export const WORKS: Record<string, () => Model> = {
  farm_barn_a: () => barn('farm_barn_a', 9, 5, 1, 'darkwood', 'thatch'),
  farm_barn_b: () => barn('farm_barn_b', 8, 4, 2, 'timber', 'tile'),
  ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`farm_house_${i}`, () => farmhouse(i)])),
  farm_dovecote: dovecote,
  farm_staddle: staddleGranary,
  farm_coop: coop,
  farm_watermill: watermill,
  mine_adit: adit,
  mine_headframe: headframe,
  mine_spoil_a: () => spoil('mine_spoil_a', 4, 1),
  mine_spoil_b: () => spoil('mine_spoil_b', 3, 2),
  mine_shed: () => house({ name: 'mine_shed', w: 7, d: 3, upper: 0, wall: 'darkwood', roof: 'darkwood', timber: false, seed: 1301, plan: 'eaves', poor: true, sign: 'anvil' }),
  mine_bunkhouse: () => house({ name: 'mine_bunkhouse', w: 10, d: 3, upper: 1, wall: 'sandstone', roof: 'tile', timber: true, seed: 1302, plan: 'eaves', poor: true }),
  decor_ore: oreHeap,
  decor_millstone: millstone,
  decor_rails_h: () => rails('h'),
  decor_rails_v: () => rails('v'),
}

/** The farm's houses by name, for the map's rows. */
export const FARM_HOUSES = Array.from({ length: 6 }, (_, i) => `farm_house_${i}`)
