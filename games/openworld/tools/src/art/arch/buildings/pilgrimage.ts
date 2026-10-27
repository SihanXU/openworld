// The Pilgrim's Road's own buildings (docs/release-1.md §7, the redo of 2026-10-27: Part One's road east drawn as
// Firstlight and its country were): the Pilgrims' Rest — the Church's chapel of the Five, grey stone under slate, its
// bell-cote and porch, and the pilgrims' hostel, stone below and timber above, its sign of a bed; the Abbey of the Thorn
// gone to ruin — the chapter hall still roofed, its slates fallen in, the church roofless but for the chancel over the
// crypt, the cloister's arcades and broken walls; the burned farm on the East Road — the farmhouse black and open to
// the sky, the barn a frame of charred posts; and in the Held Ground the knight's own pavilion. Each door on the cell
// the story keeps it.

import type { Model, Ornament } from '../oblique.ts'
import { archNS, backOf, box, doorSlab, drum, gable, recess, spire, type Solid } from '../shapes.ts'
import { banner, bird, cross, door, ivy, lancet, lantern, moss, rose, smoke, stains } from '../ornaments.ts'
import { house, S } from '../kit.ts'
import { hash } from '../materials.ts'
import type { PropModel } from './inside.ts'

const one = (name: string, footprint: string[], solids: Solid[], ornaments: Ornament[] = [], voids: Solid[] = [], terrain?: string): Model => ({ name, footprint, solids, voids, ornaments, ...(terrain && { terrain }) })
/** A footprint `w` by `d` of solid cells, a door at (dx, dy). */
const solidFp = (w: number, d: number, doors: [number, number][] = []) => Array.from({ length: d }, (_, y) => Array.from({ length: w }, (_, x) => (doors.some(([a, b]) => a === x && b === y) ? 'D' : '#')).join(''))
/** How high a ruined wall still stands at `u` along it (pixels), never lower than `lo`. */
const ragged = (u: number, seed: number, hi: number, lo: number) => Math.max(lo, hi * (0.35 + 0.65 * hash(Math.floor(u / 10), seed, 41)) - (hash(Math.floor(u / 3), seed, 42) < 0.3 ? 4 : 0))

// ------------------------------------------------------------------------------------------------ the Pilgrims' Rest

/**
 * The chapel of the Five: grey stone under a steep slate roof, a gabled porch on its door (a cross over it, the five
 * wounds' rose in the wall above), lancets either side between buttresses, a bell-cote on its west gable with the bell
 * that calls the pilgrims in. Its door in the middle of its front.
 */
function restChapel(): Model {
  const w = 7
  const d = 4
  const W = w * S
  const D = d * S
  const H = 50
  const solids: Solid[] = [box(0, 0, 0, W, D, H, 'stone'), box(-1, -1, 0, W + 1, D + 1, 6, 'plinth'), gable(-3, -3, W + 3, D + 3, H, 30, 'x', 'slate', 'stone')]
  const voids: Solid[] = []
  const orn: Ornament[] = []
  // the bell-cote on the west gable: a pier of stone over the ridge, its arch and the bell in it, a cap of slate
  const bx = 14
  solids.push(box(bx - 10, D / 2 - 7, H + 10, bx + 10, D / 2 + 7, H + 50, 'stone'), gable(bx - 12, D / 2 - 9, bx + 12, D / 2 + 9, H + 50, 9, 'y', 'slate', 'stone'))
  voids.push(archNS(bx, D / 2 - 8, D / 2 + 8, H + 24, 11, 18, 'round'))
  orn.push({ x: bx - 3, y: D / 2 + 3, z: H + 27, rows: ['  aa  ', ' aaaa ', ' aaaa ', 'aaaaaa'], keys: { a: 'a2' } })
  // the porch on the door: its own little gable to the road, the door deep in its arch, a lantern by it, a cross on top
  const dx = W / 2
  solids.push(box(dx - 16, D - 14, 0, dx + 16, D, 30, 'stone'), gable(dx - 18, D - 16, dx + 18, D + 2, 30, 14, 'y', 'slate', 'stone'))
  voids.push(...recess(dx, D, 0, 16, 24, 6, 'round', 2, 2))
  solids.push(doorSlab(dx, backOf(D, 6), 0, 12, 21, 'round'))
  orn.push(door(12, 21, 'round', 's').at(dx - 6, backOf(D, 6) - 1, 0), lantern(false).at(dx + 11, D + 1, 18, true), cross(9).at(dx - 2, D - 6, 44, true))
  // the five wounds' rose over the porch, in the nave's wall
  orn.push(rose(7, 's').at(dx - 7, D - 14, 34))
  // lancets either side, buttresses between, a stone bench along the wall
  for (const x of [1.2 * S, 2.3 * S, W - 2.3 * S, W - 1.2 * S]) {
    voids.push(...recess(x, D, 14, 8, 24, 3, 'pointed'))
    orn.push(lancet(6, 22, 'red', 1).at(x - 3, backOf(D, 3), 15))
  }
  for (const x of [0.4 * S, 1.75 * S, W - 1.75 * S, W - 0.4 * S]) solids.push(box(x - 3, D, 0, x + 3, D + 4, 32, 'stone'))
  orn.push(stains(W, 18, 'g', 21).at(0, D, 0), moss(16, 4, 21).at(5 * S, D, 2), ivy(20, 38, 21).at(2, D, 0), bird(false, 21).at(W - 24, D / 2, H + 24, true))
  return one('pr_chapel', solidFp(w, d, [[3, d - 1]]), solids, orn, voids)
}

// ------------------------------------------------------------------------------------------------ the Abbey of the Thorn

/**
 * The chapter hall: dressed granite, still roofed, but the slates have gone through in two places and the rafters show
 * against the dark inside; three lancets down its side, a buttress between each, its door at the west end under a hood,
 * ivy over the east, moss in the courses, a crow on the ridge.
 */
function chapterHall(): Model {
  const w = 8
  const d = 4
  const W = w * S
  const D = d * S
  const H = 56
  const rise = 32
  const roofZ = (y: number) => H + rise * Math.max(0, 1 - Math.abs(y - D / 2) / (D / 2 + 3))
  const solids: Solid[] = [box(0, 0, 0, W, D, H, 'granite'), box(-1, -1, 0, W + 1, D + 1, 7, 'graniteRough'), gable(-3, -3, W + 3, D + 3, H, rise, 'x', 'slate', 'granite')]
  // where the slates have gone through: the dark inside, the rafters across it, broken slates round its edge
  const voids: Solid[] = []
  const orn: Ornament[] = []
  for (const [hx, hy, hw, hh, seed] of [[3.4 * S, D * 0.72, 22, 13, 1], [5.9 * S, D * 0.62, 15, 10, 2]] as const) {
    const rows: string[] = []
    for (let j = 0; j < hh; j++) {
      let l = ''
      for (let i = 0; i < hw; i++) {
        const e = ((i - hw / 2) / (hw / 2)) ** 2 + ((j - hh / 2) / (hh / 2)) ** 2
        const r = 1 - hash(Math.floor(i / 2), Math.floor(j / 2), 30 + seed) * 0.5
        l += e > r ? (e < r + 0.25 && hash(i, j, 40 + seed) < 0.5 ? 'r' : ' ') : i % 7 === 3 ? 'w' : j === 0 ? 'R' : 'n'
      }
      rows.push(l)
    }
    orn.push({ x: hx - hw / 2, y: hy, z: roofZ(hy) + hh / 2, rows, keys: { n: 'n3', w: 'dw2', r: 'r4', R: 'n4' }, free: true })
  }
  // the door at its west end, deep in a pointed arch with a hood over it
  const dx = 1.5 * S
  voids.push(...recess(dx, D, 0, 16, 28, 5, 'pointed', 2, 2))
  solids.push(doorSlab(dx, backOf(D, 5), 0, 12, 24, 'pointed'), box(dx - 12, D, 30, dx + 12, D + 3, 33, 'granite'))
  orn.push(door(12, 24, 'pointed', 'g').at(dx - 6, backOf(D, 5) - 1, 0))
  for (const x of [3.5 * S, 5 * S, 6.5 * S]) {
    voids.push(...recess(x, D, 16, 9, 28, 3, 'pointed'))
    orn.push(lancet(7, 26, 'blue', 1, 'g').at(x - 3.5, backOf(D, 3), 17))
  }
  for (const x of [2.75 * S, 4.25 * S, 5.75 * S, W - 0.3 * S]) solids.push(box(x - 3, D, 0, x + 3, D + 5, 40, 'granite'))
  orn.push(stains(W, 26, 'g', 31).at(0, D, 0), moss(20, 5, 31).at(2.4 * S, D, 4), moss(14, 4, 32).at(6 * S, D, 30), ivy(26, 50, 31).at(W - 30, D, 0), bird(true, 31).at(2 * S, D / 2, H + rise - 2, true))
  return one('ab_hall', solidFp(w, d, [[1, d - 1]]), solids, orn, voids)
}

/**
 * The abbey church: its nave roofless, the north wall standing to the windows' heads and the west wall to its great
 * window's sill, the south wall fallen to the knee in two places one walks through; its chancel at the east end still
 * roofed over the crypt, a gable to the yard with the crypt's door under a lancet, and the stump of its tower over it.
 */
function abbeyChurch(): Model {
  const w = 10
  const d = 6
  const W = w * S
  const D = d * S
  const T = 9
  const C0 = 7 * S
  const H = 64
  const gaps = [2, 4]
  const gap = (x: number) => gaps.some((c) => x > c * S + 1 && x < (c + 1) * S - 1)
  const solids: Solid[] = [
    { b: [0, 0, 0, C0, T, 92], mat: 'graniteRough', inside: (x, _y, z) => z <= ragged(x, 11, 92, 34) },
    { b: [0, 0, 0, T, D, 84], mat: 'graniteRough', inside: (_x, y, z) => z <= ragged(y, 12, 84, 28) },
    { b: [0, D - T, 0, C0, D, 46], mat: 'graniteRough', inside: (x, _y, z) => !gap(x) && z <= ragged(x, 13, 46, 8) },
    // the chancel, roofed: its walls, its gable to the south, the tower's stump over its north half
    box(C0, 0, 0, W, D, H, 'granite'),
    gable(C0 - 3, -3, W + 3, D + 3, H, 26, 'y', 'slate', 'granite'),
    { b: [C0 - 2, -2, 0, W + 2, 2 * S + 2, 130], mat: 'graniteRough', inside: (x, _y, z) => z <= 100 + (x - C0) * 0.45 + hash(Math.floor(x / 7), 14, 3) * 8 },
  ]
  // the nave's buttresses, one fallen to a stump
  for (const x of [1.5 * S, 3.5 * S, 5.5 * S]) solids.push({ b: [x - 4, D - 2, 0, x + 4, D + 4, 56], mat: 'graniteRough', inside: (_x, _y, z) => z <= ragged(x, 15, 56, 14) })
  const voids: Solid[] = []
  for (const x of [1.5 * S, 3.5 * S, 5.5 * S]) voids.push(archNS(x, -1, T + 1, 40, 12, 36, 'pointed'))
  // the tower's belfry openings, the chancel's lancet over the crypt's door
  const cx = C0 + 1.5 * S
  voids.push(archNS(cx, -3, 2 * S + 3, 82, 10, 18, 'pointed'))
  voids.push(...recess(cx, D, 0, 16, 26, 5, 'pointed', 2, 2), ...recess(cx, D, 36, 8, 22, 3, 'pointed'))
  solids.push(doorSlab(cx, backOf(D, 5), 0, 12, 22, 'pointed'))
  const orn: Ornament[] = [door(12, 22, 'pointed', 'g').at(cx - 6, backOf(D, 5) - 1, 0), lancet(6, 20, 'red', 1, 'g').at(cx - 3, backOf(D, 3), 37)]
  for (let k = 0; k < 5; k++) orn.push(moss(14, 5, 40 + k).at(k * 22 + 3, D, hash(k, 9) * 24, true))
  orn.push(ivy(26, 50, 41).at(4, D, 0), ivy(22, 70, 42).at(W - 26, D, 0), stains(W, 34, 'g', 43).at(0, D, 0), bird(false, 44).at(C0 + 10, S, 128, true), bird(true, 45).at(C0 + 30, S, 124, true))
  const fp: string[] = []
  for (let r = 0; r < d; r++) {
    let l = ''
    for (let c = 0; c < w; c++) {
      if (c >= 7) l += r === d - 1 && c === 8 ? 'D' : '#'
      else if (r === 0 || c === 0) l += '#'
      else if (r === d - 1) l += gap((c + 0.5) * S) ? ' ' : '#'
      else l += ' '
    }
    fp.push(l)
  }
  return one('ab_church', fp, solids, orn, voids)
}

/** A run of the cloister's arcade along x, `n` cells: round arches on piers, its lean-to roof fallen in along half its length. */
function arcade(n: number, seed: number): Model {
  const W = n * S
  const solids: Solid[] = [box(0, 3, 0, W, S - 3, 46, 'granite'), box(0, 2, 0, W, S - 2, 6, 'graniteRough')]
  const voids: Solid[] = []
  for (let k = 0; k < n; k++) voids.push(archNS((k + 0.5) * S, 0, S, 6, 11, 28, 'round'))
  // what is left of the roof over the walk behind
  solids.push({ b: [0, -2, 46, W, S - 1, 60], mat: 'slate', inside: (x, y, z) => hash(Math.floor(x / S), seed, 5) < 0.55 && z <= 46 + (S - 1 - y) * 0.9 })
  const orn: Ornament[] = [moss(16, 5, seed).at(6, S - 3, 0), ivy(16, 40, seed).at(W - 20, S - 3, 0)]
  for (let k = 0; k < n; k++) if (hash(k, seed, 3) < 0.5) orn.push({ x: k * S + 4, y: S + 2, z: 0, rows: [' gg ', 'gGgg'], keys: { g: 'g2', G: 'g3' }, free: true })
  return one(`ab_arcade_x${n}`, ['#'.repeat(n)], solids, orn, voids)
}

/** A run of ruined wall along y, `n` cells deep: a ragged top, moss and ivy (the cloister's and the close's east and west). */
function wallY(n: number, seed: number): Model {
  const D = n * S
  const solids: Solid[] = [{ b: [2, 0, 0, S - 2, D, 44], mat: 'graniteRough', inside: (_x, y, z) => z <= ragged(y, seed, 44, 10) }]
  const orn: Ornament[] = [moss(10, 6, seed).at(3, D, 0), ivy(10, 30, seed).at(3, D, 0)]
  return one(`ab_wall_y${n}`, Array.from({ length: n }, () => '#'), solids, orn)
}

// ------------------------------------------------------------------------------------------------ the burned farm

/**
 * The burned farmhouse: its stone footing and chimney stand; the walls of timber are black, burnt through at a corner;
 * the thatch is gone from its east half, the rafters bare against the sky, and what is left on the west is black. Its
 * door hangs open on the dark, soot over every window.
 */
function burnedFarm(): Model {
  const w = 6
  const d = 3
  const W = w * S
  const D = d * S
  const H = 38
  const rise = 26
  const roofZ = (y: number) => H + rise * Math.max(0, 1 - Math.abs(y - D / 2) / (D / 2 + 3))
  const solids: Solid[] = [
    box(-1, -1, 0, W + 1, D + 1, 9, 'stone'),
    // the walls, burnt down at the south-east corner
    { b: [0, 0, 9, W, D, H], mat: 'charred', inside: (x, y, z) => !(x > W - 22 && y > D - 20 && z > 9 + (W - x) * 0.9 + hash(Math.floor(x / 4), 3, 7) * 6) },
    // what is left of the thatch on the west half, blackened
    { b: [-3, -3, H, W * 0.5, D + 3, H + rise], mat: 'thatchBurnt', inside: (x, y, z) => z <= roofZ(y) && z >= roofZ(y) - 5 - hash(Math.floor(x / 3), Math.floor(y / 3), 8) * 3 && x < W * 0.5 - hash(Math.floor(y / 4), 9, 2) * 10 },
    // the chimney at its west end, standing whole
    box(4, D * 0.3, 0, 16, D * 0.3 + 11, H + rise + 12, 'stone'),
    // the ridge beam
    box(W * 0.4, D / 2 - 1.5, H + rise - 3, W + 2, D / 2 + 1.5, H + rise, 'charred'),
  ]
  // the rafters of the east half, bare
  for (let x = W * 0.55; x < W; x += 9) solids.push({ b: [x - 1.5, -3, H, x + 1.5, D + 3, H + rise], mat: 'charred', inside: (_x, y, z) => Math.abs(z - roofZ(y) + 2) < 2.2 })
  // the dark inside, through the burnt corner and between the rafters
  solids.push(box(4, 4, 0, W - 4, D - 4, H - 1, 'dark'))
  const voids: Solid[] = []
  const orn: Ornament[] = []
  const dx = 2.5 * S
  voids.push(...recess(dx, D, 9, 12, 22, 4, 'flat'))
  orn.push({ x: dx - 6, y: D + 1, z: 9, rows: ['k  ', 'kk ', 'kk ', 'kwk', 'kwk', 'kwk', 'kwk', 'kk ', 'kk ', 'k  '].reverse(), keys: { k: 'n2', w: 'w3' } })
  for (const x of [1.2 * S, 4.2 * S]) {
    voids.push(...recess(x, D, 18, 10, 11, 3, 'flat'))
    // the glass gone, a shutter hanging
    orn.push({ x: x - 5, y: backOf(D, 3) - 1, z: 18, rows: ['nnnnnnnnnn', 'nkkkkkkkkn', 'nkkkkkkkwn', 'nkkkkkkkwn', 'nkkkkkkwwn', 'nkkkkkkkkn', 'nkkkkkkkkn', 'nkkkkkkkkn', 'nkkkkkkkkn', 'nkkkkkkkkn', 'nnnnnnnnnn'].reverse(), keys: { n: 'n0', k: 'n3', w: 'dw2' } })
  }
  orn.push(stains(W, 34, 'n', 51).at(0, D, 0), stains(20, 30, 'n', 52).at(4 * S, D, 12), smoke(53).at(10, D * 0.3, H + rise + 12, true))
  return one('er_farm', solidFp(w, d, [[2, d - 1]]), solids, orn, voids, 'woodwall')
}

/**
 * The burned barn: a frame of black posts, its north wall standing to the eaves and the ends half fallen, the roof
 * gone; one walks in at its open front, over its floor of ash, where Edda hides.
 */
function burnedBarn(): Model {
  const w = 6
  const d = 4
  const W = w * S
  const D = d * S
  // (its boards whole near the ground, black above where the fire went up them)
  const wall = (b: [number, number, number, number, number, number], top: (x: number, y: number) => number): Solid[] => [
    { b, mat: 'darkwood', inside: (x, y, z) => z <= Math.min(top(x, y), 16 + hash(Math.floor((x + y) / 5), 66, 1) * 10) },
    { b, mat: 'charred', inside: (x, y, z) => z <= top(x, y) && z > 16 + hash(Math.floor((x + y) / 5), 66, 1) * 10 },
  ]
  const solids: Solid[] = [
    ...wall([0, 0, 0, W, 8, 44], (x) => ragged(x, 61, 44, 18)),
    ...wall([0, 0, 0, 7, D - S, 40], (_x, y) => ragged(y, 62, 40, 6)),
    ...wall([W - 7, 0, 0, W, D - S, 36], (_x, y) => ragged(y + 9, 63, 36, 4)),
  ]
  // the posts of the front and their beam, broken at one end
  for (const x of [3, W - 4]) solids.push(box(x - 3, D - 7, 0, x + 3, D - 1, x < W / 2 ? 50 : 36, 'charred'))
  solids.push({ b: [0, D - 7, 44, W, D - 2, 49], mat: 'charred', inside: (x) => x < W * 0.62 })
  const orn: Ornament[] = [stains(W, 30, 'n', 64).at(0, 8, 0)]
  const fp = ['######', '#    #', '#    #', '#    #']
  return one('er_barn', fp, solids, orn, [], 'woodwall')
}

/** Rafters and beams fallen from the barn and the house, lying black in the ash (drawn as ground: walked over). */
function fallenBeams(): Model {
  const rows = ['                ', '  nn            ', '   nnnn         ', '     nnnnn      ', '        nnnnn   ', '           nnn  ', '                ', ' gg       nn    ', '  nnnnnnnnnnnn  ', '      g   g     ']
  return { name: 'decor_beams', footprint: ['.'], solids: [], voids: [], ornaments: [{ x: 0, y: S, z: S - rows.length, rows, keys: { n: 'n1', g: 'g4' }, free: true }], ground: true }
}

/** Ash and cinders where the fire burned the yard: a soft grey patch, black bits in it, now and then an ember (drawn as ground). */
function ash(k: number): Model {
  const rows = Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      const d = Math.hypot(x - 7.5 - (k - 1) * 1.5, (y - 7.5) * 1.4) / 7
      const h = hash(x, y, 95 + k)
      if (d > 1 - hash(Math.floor(x / 3), Math.floor(y / 3), 96 + k) * 0.35) return ' '
      return h < 0.025 ? 'b' : h < 0.032 && k === 2 ? 'e' : h < 0.65 ? 'a' : 'c'
    }).join(''),
  )
  return { name: `decor_ash_${k}`, footprint: ['.'], solids: [], voids: [], ornaments: [{ x: 0, y: S, z: 0, rows, keys: { a: 'g3', c: 'g2', b: 'n1', e: 'E1' }, free: true }], ground: true }
}

/** A wayside cross: a shaft of grey stone on two steps, its arms, lichen on it, a pilgrim's scallop cut in the foot. */
function waycross(): Model {
  const c = S / 2
  const solids: Solid[] = [box(1, 2, 0, S - 1, S - 1, 3, 'granite'), box(3, 4, 3, S - 3, S - 3, 6, 'granite'), box(c - 2, c - 2, 6, c + 2, c + 2, 40, 'granite'), box(c - 8, c - 2, 28, c + 8, c + 2, 32, 'granite')]
  const orn: Ornament[] = [moss(6, 3, 91).at(c - 3, c + 2, 8, true), { x: c - 2, y: c + 3, z: 10, rows: [' gg ', 'gggg', ' gg '], keys: { g: 'g4' }, free: true }]
  return one('decor_waycross', ['#'], solids, orn)
}

// ------------------------------------------------------------------------------------------------ the Held Ground

/**
 * The knight's pavilion: a round tent of white canvas striped red, its valance scalloped, a pole through its cone with
 * the thorn ring's pennant, its door flap tied back on the dark. Three cells wide and deep, as every tent.
 */
function pavilion(): PropModel {
  const W = 3 * S
  const c = W / 2
  const cy = 1.5 * S
  const solids: Solid[] = [
    drum(c, cy, 21, 0, 24, 'canvasRed'),
    spire(c, cy, 24, 24, 30, 0, 'canvasRed'),
    box(c - 1, cy - 1, 54, c + 1, cy + 1, 70, 'timber'),
  ]
  const orn: Ornament[] = [
    // the door flap tied back on the dark
    { x: c - 6, y: cy + 21, z: 0, rows: ['   kk   ', '  kkkk  ', ' kkkkkk ', ' kkkkkk ', 'wkkkkkkw', 'wkkkkkkw', 'wkkkkkkw', 'wkkkkkkw', 'wkkkkkkw', 'wkkkkkkw', 'wkkkkkkw', 'wkkkkkkw', 'wkkkkkkw', 'wkkkkkkw', 'wkkkkkkw', 'wwkkkkww'].reverse(), keys: { k: 'n2', w: 'cw1' }, free: true },
    // the valance under the cone's rim
    { x: c - 22, y: cy + 21, z: 20, rows: ['rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr', ' r rr rr rr rr rr rr rr rr rr rr rr rr rr r '], keys: { r: 'cr2' }, free: true },
    banner(7, 9, 'cw').at(c + 1, cy, 60, true),
  ]
  return { name: 'pavilion', footprint: ['###', '###', '###'], solids, voids: [], ornaments: orn, sprite: true }
}

export const PILGRIMAGE_BUILDINGS: Record<string, () => Model> = {
  pr_chapel: restChapel,
  // the pilgrims' hostel: stone below, timber and wash above, slate, the Church's sign of a bed, its long front to the road
  pr_hostel: () => house({ name: 'pr_hostel', w: 9, d: 4, upper: 1, timber: true, wall: 'plaster', roof: 'slate', seed: 4101, plan: 'eaves', door: 3, stoneBelow: true, shutters: 'cr', sign: 'bed', bloom: 'cr0' }),
  ab_hall: chapterHall,
  ab_church: abbeyChurch,
  ...Object.fromEntries([3, 4, 6].map((n) => [`ab_arcade_x${n}`, () => arcade(n, 70 + n)])),
  ...Object.fromEntries([3, 4, 5].map((n) => [`ab_wall_y${n}`, () => wallY(n, 80 + n)])),
  er_farm: burnedFarm,
  er_barn: burnedBarn,
  decor_beams: fallenBeams,
  decor_waycross: waycross,
  ...Object.fromEntries([0, 1, 2].map((k) => [`decor_ash_${k}`, () => ash(k)])),
}

/** The pictures of things drawn whole (the catalogue's `fixture:<name>`). */
export const PILGRIMAGE_PROPS: Record<string, () => PropModel> = { pavilion }
