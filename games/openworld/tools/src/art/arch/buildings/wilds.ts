// The fourth batch's buildings (docs/showcase.md §4d): a manor of the White Altar — its house with a portico between two
// wings, the orangery, the stables, a gazebo; the Pale Fens' ruin — a roofless church, broken walls, an arch standing
// alone, columns and a tower's stump; the mouth of a cave of ice; a mage's tower; the bandits' huts, cages and loot; and
// the North Gate's castle snowed over for a fort on Frostfang's border.

import type { Model, Ornament } from '../oblique.ts'
import { archNS, backOf, box, doorSlab, drum, gable, hip, octagon, recess, spire, type Solid } from '../shapes.ts'
import { bird, door, ivy, lancet, lantern, moss, pots, railing, smoke, stains, window } from '../ornaments.ts'
import { house, S } from '../kit.ts'
import { hash } from '../materials.ts'
import { CASTLE } from './castle.ts'

const one = (name: string, footprint: string[], solids: Solid[], ornaments: Ornament[] = [], voids: Solid[] = []): Model => ({ name, footprint, solids, voids, ornaments })
const C = S / 2

// ------------------------------------------------------------------------------------------------ the manor

/** The manor house: a block of three storeys under a hipped roof, two wings forward, a portico of four columns on the door. */
function manorHouse(): Model {
  const w = 16
  const W = w * S
  const cx0 = 4 * S
  const cx1 = 12 * S
  const D = 5 * S
  const DW = 6 * S
  const H = 112
  const HW = 80
  const solids: Solid[] = [
    box(cx0, 0, 0, cx1, D, H, 'whiteStone'),
    hip(cx0 - 3, -3, cx1 + 3, D + 3, H, 34, 'slate'),
    box(0, 0, 0, cx0, DW, HW, 'whiteStone'),
    hip(-3, -3, cx0 + 3, DW + 3, HW, 30, 'slate'),
    box(cx1, 0, 0, W, DW, HW, 'whiteStone'),
    hip(cx1 - 3, -3, W + 3, DW + 3, HW, 30, 'slate'),
    // the string courses, the plinth
    box(-1, -1, 0, W + 1, DW + 1, 6, 'stone'),
    box(cx0, D - 1, 50, cx1, D + 2, 54, 'stone'),
  ]
  for (const x of [cx0 + 20, cx1 - 20, 2 * S, W - 2 * S]) solids.push(box(x - 5, 10, H - 10, x + 5, 20, H + 34, 'brick'))
  // the portico: four columns, their entablature, the pediment over them
  const mid = W / 2
  for (const dx of [-36, -12, 12, 36]) solids.push(drum(mid + dx, D + 8, 4, 0, 56, 'whiteStone'), drum(mid + dx, D + 8, 5.5, 54, 58, 'stone'))
  solids.push(box(mid - 44, D, 58, mid + 44, DW, 66, 'whiteStone'), gable(mid - 46, D - 2, mid + 46, DW + 1, 66, 20, 'y', 'slate', 'whiteStone'))
  const voids: Solid[] = [...recess(mid, D, 0, 22, 42, 4, 'round', 2, 2)]
  solids.push(doorSlab(mid, backOf(D, 4), 0, 18, 38, 'round'))
  const orn: Ornament[] = [door(18, 38, 'round', 'pw').at(mid - 9, backOf(D, 4) - 1, 0), railing(88, 8).at(mid - 44, DW, 66, true)]
  for (const x of [mid - 13, mid + 9]) orn.push(lantern(x > mid).at(x, D + 1, 26, true))
  // the windows: three storeys on the block, two on the wings, tall on the principal floor
  for (let x = cx0 + 10; x < cx1 - 10; x += 22) {
    if (Math.abs(x + 5 - mid) > 14) orn.push(window(10, 18, true, hash(x, 1) < 0.35).at(x, D, 14))
    orn.push(window(10, 22, true, hash(x, 2) < 0.4).at(x, D, 58), window(10, 14, true, hash(x, 3) < 0.3).at(x, D, 88))
  }
  for (const [x0, x1] of [[0, cx0], [cx1, W]])
    for (let x = x0 + 10; x < x1 - 10; x += 22) orn.push(window(10, 18, true, hash(x, 4) < 0.35).at(x, DW, 14), window(10, 18, true, hash(x, 5) < 0.3).at(x, DW, 50))
  orn.push(ivy(26, 60, 3).at(4, DW, 0), ivy(22, 50, 4).at(W - 30, DW, 0), stains(W, 16, 'pw', 9).at(0, DW, 0))
  orn.push(pots(24, 5).at(mid - 60, D + 2, 0, true), pots(24, 6).at(mid + 36, D + 2, 0, true))
  orn.push(smoke(4).at(cx0 + 18, 15, H + 34, true), smoke(7).at(W - 2 * S - 2, 15, H + 34, true), bird(false, 3).at(mid, D / 2, H + 34, true))
  const fp: string[] = []
  for (let r = 0; r < 6; r++) {
    let l = ''
    for (let c = 0; c < w; c++) l += r < 5 ? (r === 4 && c === 8 ? 'D' : '#') : c < 4 || c >= 12 ? '#' : '.'
    fp.push(l)
  }
  return one('manor_house', fp, solids, orn, voids)
}

/** The orangery: tall glazed arches between piers on a plinth, the lead roof, a lantern over the middle, orange trees within. */
function orangery(): Model {
  const w = 8
  const W = w * S
  const D = 3 * S
  const H = 48
  const solids: Solid[] = [box(0, 4, 0, W, D, H, 'whiteStone'), hip(-2, 2, W + 2, D + 2, H, 14, 'lead'), drum(W / 2, D / 2 + 2, 7, H + 10, H + 20, 'glassLit'), spire(W / 2, D / 2 + 2, 9, H + 20, 10, 8, 'lead')]
  const orn: Ornament[] = []
  for (let x = 6; x < W - 10; x += 16) {
    if (Math.abs(x + 5 - W / 2) < 9) continue
    orn.push(window(10, 32, false, true, 'pw2').at(x, D, 8))
    orn.push({ x: x + 1, y: D + 2, z: 0, rows: [' vvvv ', 'vVvvVv', ' vvvv ', '  ww  ', ' tttt ', ' tttt '], keys: { v: 'v1', V: 'cy0', w: 'w2', t: 't2' }, free: true })
  }
  const voids: Solid[] = [...recess(W / 2, D, 0, 14, 30, 3, 'round')]
  orn.push(door(12, 28, 'round', 'pw').at(W / 2 - 6, backOf(D, 3) - 1, 0))
  const fp = ['########', '########', '###D####']
  return one('manor_orangery', fp, solids, orn, voids)
}

/** A gazebo: six slender columns round a floor raised a step, a copper dome. */
function gazebo(): Model {
  const c = 1.5 * S
  const solids: Solid[] = [drum(c, c, 20, 0, 4, 'whiteStone')]
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2
    solids.push(drum(c + Math.cos(a) * 16, c + Math.sin(a) * 12, 2, 4, 36, 'whiteStone'))
  }
  solids.push(drum(c, c, 20, 36, 40, 'whiteStone'), spire(c, c, 21, 40, 20, 0, 'copper'))
  return one('manor_gazebo', ['###', '###', '###'], solids, [bird(true, 5).at(c - 2, c, 62, true)])
}

// ------------------------------------------------------------------------------------------------ the ruin

/** A ragged top for a ruined wall: how high it still stands at `u` along it (pixels), never lower than `lo`. */
const ragged = (u: number, seed: number, hi: number, lo: number) => Math.max(lo, hi * (0.35 + 0.65 * hash(Math.floor(u / 10), seed, 41)) - (hash(Math.floor(u / 3), seed, 42) < 0.3 ? 4 : 0))

/** The church's shell, roofless: walls standing to their windows' heads in places, fallen to the sill in others, a gap at the door. */
function ruinNave(): Model {
  const w = 10
  const d = 7
  const W = w * S
  const D = d * S
  const T = 9
  const gaps = (x: number) => (x > 4 * S && x < 6 * S) || (x > 7 * S && x < 8 * S)
  const solids: Solid[] = [
    { b: [0, 0, 0, W, T, 96], mat: 'graniteRough', inside: (x, _y, z) => z <= ragged(x, 1, 96, 26) },
    { b: [0, D - T, 0, W, D, 80], mat: 'graniteRough', inside: (x, _y, z) => !gaps(x) && z <= ragged(x, 2, 80, 10) },
    { b: [0, 0, 0, T, D, 90], mat: 'graniteRough', inside: (_x, y, z) => z <= ragged(y, 3, 90, 30) },
    { b: [W - T, 0, 0, W, D, 110], mat: 'graniteRough', inside: (_x, y, z) => z <= (Math.abs(y - D / 2) < 30 ? 110 - Math.abs(y - D / 2) * 1.4 : ragged(y, 4, 70, 20)) },
  ]
  // the buttresses still standing, a fallen one
  for (const x of [2 * S, 5 * S, 8 * S]) solids.push({ b: [x - 4, D - 2, 0, x + 4, D + 4, 64], mat: 'graniteRough', inside: (_x, _y, z) => z <= ragged(x, 5, 64, 18) })
  const voids: Solid[] = []
  for (const x of [2 * S, 4 * S, 6 * S, 8 * S]) voids.push(archNS(x, -1, T + 1, 34, 12, 34, 'pointed'))
  voids.push(archNS(W - T / 2, D / 2 - 14, D / 2 + 14, 40, 18, 44, 'pointed'))
  const orn: Ornament[] = []
  for (let k = 0; k < 6; k++) orn.push(moss(14, 5, k).at(k * 26 + 4, D, hash(k, 7) * 30, true))
  orn.push(ivy(30, 56, 8).at(10, D, 0), ivy(24, 44, 9).at(W - 40, D, 0), stains(W, 40, 'g', 6).at(0, D, 0), bird(false, 6).at(W - 6, D / 2, 112, true))
  const fp: string[] = []
  for (let r = 0; r < d; r++) {
    let l = ''
    for (let c = 0; c < w; c++) l += r === 0 || c === 0 || c === w - 1 ? '#' : r === d - 1 ? (gaps((c + 0.5) * S) ? ' ' : '#') : ' '
    fp.push(l)
  }
  return one('ruin_nave', fp, solids, orn, voids)
}

/** A run of ruined wall along x, `n` cells: a ragged top, moss and ivy, stones fallen at its foot. */
function ruinWall(n: number, seed: number): Model {
  const W = n * S
  const solids: Solid[] = [{ b: [0, 4, 0, W, S - 2, 60], mat: 'graniteRough', inside: (x, _y, z) => z <= ragged(x, seed, 60, 8) }]
  const orn: Ornament[] = [moss(16, 6, seed).at(4, S - 2, 0), ivy(18, 34, seed).at(W / 2 - 9, S - 2, 0)]
  for (let k = 0; k < n; k++) if (hash(k, seed, 3) < 0.6) orn.push({ x: k * S + 3, y: S + 3, z: 0, rows: [' gg ', 'gGgg'], keys: { g: 'g2', G: 'g3' }, free: true })
  return one(`ruin_wall_x${n}`, ['#'.repeat(n)], solids, orn)
}

/** An arch standing alone where its walls have gone, its keystone cracked, ivy over it. */
function ruinArch(): Model {
  const W = 3 * S
  const solids: Solid[] = [box(2, 4, 0, W - 2, S - 2, 72, 'graniteRough')]
  const voids: Solid[] = [archNS(W / 2, 0, S, 0, 26, 52, 'round'), { b: [W / 2, 0, 60, W, S, 72], mat: 'graniteRough', inside: (x, _y, z) => z > 72 - (x - W / 2) * 0.6 }]
  return one('ruin_arch', ['# #'], solids, [ivy(16, 40, 2).at(4, S - 2, 0), moss(12, 4, 3).at(W - 18, S - 2, 40)], voids)
}

/** A column still standing to some height, its capital gone, or with it. */
function ruinColumn(k: number): Model {
  const h = 26 + Math.round(hash(k, 1) * 40)
  const solids: Solid[] = [box(C - 7, C - 7, 0, C + 7, C + 7, 6, 'graniteRough'), drum(C, C, 5, 6, h, 'graniteRough')]
  if (k % 2) solids.push(box(C - 8, C - 8, h, C + 8, C + 8, h + 5, 'graniteRough'))
  return one(`ruin_column_${k}`, ['#'], solids, [moss(8, 4, k).at(C - 4, C + 6, 4, true)])
}

/** A tower's stump: a drum of stone broken off on a slant, a window left in what stands. */
function ruinTower(): Model {
  const c = 1.5 * S
  const solids: Solid[] = [{ b: [0, 0, 0, 3 * S, 3 * S, 110], mat: 'graniteRough', inside: (x, y, z) => Math.hypot(x - c, y - c) <= 20 && z <= 60 + (x - c) * 1.3 + ragged(y * 3, 9, 20, 0) }]
  const voids: Solid[] = [archNS(c + 6, c, 3 * S, 50, 8, 22, 'pointed'), archNS(c - 6, c, 3 * S, 0, 14, 26, 'round')]
  return one('ruin_tower', ['###', '###', '###'], solids, [ivy(20, 70, 11).at(c - 18, c + 19, 0, true), bird(true, 2).at(c + 14, c, 92, true)], voids)
}

// ------------------------------------------------------------------------------------------------ the cave, the tower, the bandits

/** The mouth of the ice cave: a crag of rock glazed with ice, the dark going in, icicles over the lip, snow on the ledges. */
function caveMouth(): Model {
  const W = 5 * S
  const D = 2 * S
  const solids: Solid[] = [{ b: [0, 0, 0, W, D - 4, 84], mat: 'iceRock', inside: (x, _y, z) => z <= 84 - Math.abs(x - W / 2) * 0.5 - hash(Math.floor(x / 8), 3, 7) * 14 }, box(W / 2 - 14, 0, 0, W / 2 + 14, D - 6, 40, 'dark')]
  const voids: Solid[] = [archNS(W / 2, D - 7, D + 1, 0, 28, 42, 'round')]
  const ice = Array.from({ length: 12 }, (_, j) => Array.from({ length: 30 }, (_, i) => (j === 0 ? 'w' : hash(i, 5, 81) < 0.45 && j < 2 + hash(i, 5, 82) * 10 ? 'i' : ' ')).join(''))
  const orn: Ornament[] = [{ x: W / 2 - 15, y: D - 4, z: 30, rows: ice, keys: { w: 'sn0', i: 'q0' }, free: true }]
  for (let k = 0; k < 5; k++) orn.push({ x: Math.round(hash(k, 9) * (W - 14)), y: D - 4, z: 48 + k * 6, rows: ['ssssssssss', ' ssssssss '], keys: { s: 'sn1' } })
  return one('cave_mouth', ['#####', '##D##'], solids, orn, voids)
}

/** The mage's tower: eight-sided, five storeys, violet glass, a balcony ringing it, a tall spire, crystals on its crown. */
function mageTower(): Model {
  const c = 2 * S
  const r = 26
  const H = 184
  const solids: Solid[] = [octagon(c, c, r + 3, 0, 10, 'granite'), octagon(c, c, r, 10, H, 'stone'), octagon(c, c, r + 6, 118, 122, 'granite'), octagon(c, c, r + 2, H, H + 6, 'granite'), spire(c, c, r + 3, H + 6, 70, 8, 'slate')]
  for (const z of [44, 82, 150]) solids.push(octagon(c, c, r + 1, z, z + 3, 'granite'))
  // (the door in the cell right of the middle: the footprint's door cell)
  const dx = c + C
  const voids: Solid[] = [...recess(dx, c + r, 10, 16, 32, 4, 'pointed', 2, 2)]
  solids.push(doorSlab(dx, backOf(c + r, 4), 10, 12, 28, 'pointed'))
  const orn: Ornament[] = [door(12, 28, 'pointed', 's').at(dx - 6, backOf(c + r, 4) - 1, 10)]
  for (const z of [52, 90, 128, 158]) orn.push(lancet(8, 22, 'violet', 1).at(c - 4, c + r, z))
  for (const dx of [-17, 13]) orn.push(lancet(5, 16, 'violet', 1).at(c + dx, c + r - 6, 96))
  orn.push(railing(48, 6).at(c - 24, c + r + 6, 122, true))
  orn.push({ x: c - 6, y: c, z: H + 70, rows: ['  ab  ', ' aBba ', 'aBbbBa', ' abba ', '  bb  '], keys: { a: 'U1', b: 'B0', B: 'cw0' }, free: true })
  orn.push(lantern(false).at(c + 10, c + r + 1, 34, true), stains(64, 30, 'g', 4).at(0, c + r, 0), ivy(14, 60, 5).at(c - r + 2, c + r - 4, 0))
  return one('mage_tower', ['####', '####', '####', '##D#'], solids, orn, voids)
}

/** A cage of iron bars on its sledge, a prisoner's rag in it. */
function cage(): Model {
  const solids: Solid[] = [box(1, 3, 0, S - 1, S - 1, 3, 'darkwood')]
  for (let x = 2; x < S - 1; x += 3) for (const y of [4, S - 2]) solids.push(box(x, y - 1, 3, x + 1, y, 24, 'ironDark'))
  for (let y = 4; y < S - 1; y += 3) for (const x of [2, S - 2]) solids.push(box(x - 1, y, 3, x, y + 1, 24, 'ironDark'))
  solids.push(box(1, 3, 24, S - 1, S - 1, 26, 'ironDark'))
  return one('decor_cage', ['#'], solids, [{ x: 5, y: S - 3, z: 3, rows: [' cc ', 'cccc', ' cc '], keys: { c: 'cw2' } }])
}

/** The bandits' loot: chests broken open, a heap of coin, a goblet, a bolt of cloth. */
function loot(): Model {
  const solids: Solid[] = [box(1, 5, 0, 13, 13, 9, 'timber'), box(1, 4, 9, 13, 8, 12, 'timber'), box(16, 8, 0, 28, 15, 8, 'darkwood')]
  const orn: Ornament[] = [{ x: 3, y: 10, z: 9, rows: [' aa a ', 'aAaaAa', 'aaaaaa'], keys: { a: 'a1', A: 'a0' }, free: true }, { x: 14, y: S + 1, z: 0, rows: ['  a a   ', ' aaAaa  ', 'aaaaaaa ', ' rr  bbb', 'rrrr bbb'], keys: { a: 'a1', A: 'a0', r: 'E1', b: 'cb1' }, free: true }]
  return one('decor_loot', ['##'], solids, orn)
}

/** Crystals growing from the cave's floor: shafts of blue and violet, lit from within. */
function crystals(k: number): Model {
  const solids: Solid[] = []
  for (let i = 0; i < 4 + k; i++) {
    const x = 3 + hash(i, k, 1) * 10
    const y = 4 + hash(i, k, 2) * 8
    const h = 8 + hash(i, k, 3) * 22
    solids.push({ b: [x - 3, y - 3, 0, x + 3, y + 3, h], mat: 'crystal', inside: (px, py, z) => Math.abs(px - x) + Math.abs(py - y) <= 2.6 * (1 - z / h) + 0.6 })
  }
  return one(`decor_crystals_${k}`, ['#'], solids)
}

/** A stalagmite: the rock's drip grown up from the floor. */
function stalagmite(k: number): Model {
  const h = 18 + k * 9
  return one(`decor_stalagmite_${k}`, ['#'], [{ b: [0, 0, 0, S, S, h], mat: 'iceRock', inside: (x, y, z) => Math.hypot(x - C, (y - C) * 1.2) <= 6.5 * (1 - z / h) + 0.8 }])
}

/** Lying in the grass: a fallen column's drums, a toppled saint, the cave's glowing moss. */
function lying(name: string, rows: string[], keys: Record<string, string>, w = 1): Model {
  return { name, footprint: ['.'.repeat(w)], solids: [], voids: [], ornaments: [{ x: 0, y: S, z: Math.max(0, S - rows.length), rows, keys, free: true }], ground: true }
}

// ------------------------------------------------------------------------------------------------ the castle snowed over

/** A model of the castle with snow on every top and its leaded roofs white: the North Gate's kit for Frostfang. */
function snowed(name: string, m: Model): Model {
  const solids: Solid[] = []
  for (const s of m.solids) {
    const mat = s.mat === 'lead' || s.mat === 'slate' || s.mat === 'copper' ? 'snowRoof' : s.mat
    solids.push({ ...s, mat })
    if (/granite|stone/.test(s.mat)) {
      const top = s.b[5]
      solids.push({ b: [s.b[0], s.b[1], top - 2, s.b[3], s.b[4], top + 2], mat: 'snowField', inside: (x, y, z) => z > top - 0.5 && z <= top + 2 && s.inside(x, y, top - 0.5) && !s.inside(x, y, top + 0.5) })
    }
  }
  return { ...m, name, solids }
}

export const WILDS: Record<string, () => Model> = {
  manor_house: manorHouse,
  manor_orangery: orangery,
  manor_gazebo: gazebo,
  manor_stable: () => house({ name: 'manor_stable', w: 11, d: 4, upper: 1, wall: 'whiteStone', roof: 'slate', timber: false, seed: 1401, plan: 'gable', shutters: 'cg', gablet: true }),
  manor_lodge: () => house({ name: 'manor_lodge', w: 7, d: 3, upper: 1, wall: 'whiteStone', roof: 'slate', timber: false, seed: 1402, plan: 'bay', wing: [3, 1], shutters: 'cg', ivy: true }),
  ruin_nave: ruinNave,
  ...Object.fromEntries([3, 4, 6].map((n) => [`ruin_wall_x${n}`, () => ruinWall(n, 50 + n)])),
  ruin_arch: ruinArch,
  ...Object.fromEntries([0, 1, 2].map((k) => [`ruin_column_${k}`, () => ruinColumn(k)])),
  ruin_tower: ruinTower,
  cave_mouth: caveMouth,
  mage_tower: mageTower,
  mage_annex: () => house({ name: 'mage_annex', w: 8, d: 3, upper: 1, wall: 'stone', roof: 'slate', timber: false, seed: 1501, plan: 'gable', shutters: 'cb', sign: 'book' }),
  ...Object.fromEntries([0, 1, 2].map((i) => [`bandit_hut_${i}`, () => house({ name: `bandit_hut_${i}`, w: 6 + i, d: 3, upper: 0, wall: 'darkwood', roof: i === 1 ? 'darkwood' : 'thatch', timber: false, seed: 1600 + i, plan: 'eaves', poor: true })])),
  decor_cage: cage,
  decor_loot: loot,
  ...Object.fromEntries([0, 1, 2].map((k) => [`decor_crystals_${k}`, () => crystals(k)])),
  ...Object.fromEntries([0, 1, 2].map((k) => [`decor_stalagmite_${k}`, () => stalagmite(k)])),
  decor_column_fallen: () => lying('decor_column_fallen', ['    gggg gggggg  ', '   gGGgg gGGGGgg ', '   gggg  gggggg  ', '         g   g   '], { g: 'g2', G: 'g1' }, 2),
  decor_statue_fallen: () => lying('decor_statue_fallen', ['  ss         ', ' sSss  ssss  ', 'sssssssSSsss ', ' ssss  ssss  ', '  m   m  m   '], { s: 's2', S: 's1', m: 'v2' }),
  decor_glowmoss: () => lying('decor_glowmoss', Array.from({ length: 16 }, (_, j) => Array.from({ length: 16 }, (_, i) => (hash(i, j, 61) < 0.18 - Math.hypot(i - 8, j - 8) * 0.012 ? (hash(i, j, 62) < 0.3 ? 'b' : 'g') : ' ')).join('')), { g: 'c1', b: 'B0' }),
  ...Object.fromEntries(Object.entries(CASTLE).map(([k, f]) => [`snow_${k}`, () => snowed(`snow_${k}`, f())])),
}

/** The bandits' huts by name, for the camp. */
export const BANDIT_HUTS = [0, 1, 2].map((i) => `bandit_hut_${i}`)
