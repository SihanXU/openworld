// The streets' clutter (docs/showcase.md §3.6): what fills every corner of a showcase place, drawn by the oblique
// renderer and laid on the map as pictures (MapBuilder.building), never as things — so a square may hold hundreds of
// them and cost the engine nothing. Three sorts: what stands and blocks its cell (casks, crates, sacks, a stand of
// pots, a café table under its parasol, a pump, a signpost, a bill column, a handcart); what hangs over the street
// between two posts, walked under (flags, lanterns, washing, a rose arch); what lies on the ground under the feet
// (puddles, petals, leaves, cracks, a drain, pigeons, a cat, chalk, straw, a rug of wares).

import type { Model, Ornament } from '../oblique.ts'
import { box, drum, spire, type Solid } from '../shapes.ts'
import { bird, bunting, cat, laundry, lanternString, pots, poster } from '../ornaments.ts'
import { GOODS_KEYS, S } from '../kit.ts'
import { hash } from '../materials.ts'

const C = S / 2

/** A cask on its end: staves, two iron hoops, its lid. */
function cask(x: number, y: number, z: number, r = 5, h = 12): Solid[] {
  return [drum(x, y, r, z, z + h, 'timber'), drum(x, y, r + 0.4, z + 2, z + 3.2, 'iron'), drum(x, y, r + 0.4, z + h - 3, z + h - 1.8, 'iron'), drum(x, y, r - 1, z + h, z + h + 0.6, 'earth')]
}

/** A crate of slats. */
function crate(x: number, y: number, z: number, w = 10, d = 9, h = 9): Solid[] {
  return [box(x, y, z, x + w, y + d, z + h, 'timber'), box(x - 0.3, y + d - 1, z + h / 2 - 0.5, x + w + 0.3, y + d + 0.3, z + h / 2 + 0.5, 'earth')]
}

/** A split log lying north–south, r about (x, z), from y0 to y1: bark along it, its cut end (to the south) pale with a ring. */
function log(x: number, z: number, r: number, y0: number, y1: number, seed: number): Solid {
  const ring = r * 0.55 + hash(seed, 2) * 0.3
  return {
    b: [x - r, y0, z - r, x + r, y1, z + r],
    mat: 'darkwood',
    inside: (px, py, pz) => py >= y0 && py <= y1 && Math.hypot(px - x, pz - z) <= r,
    paint: (px, py, pz) => {
      if (py < y1 - 0.6) return undefined
      const d = Math.hypot(px - x, pz - z)
      // (small as it is: a pale face, a darker rim of sapwood, the pith only on a big log)
      return d > r - 0.8 ? undefined : d > r - 1.8 || (r > 4.5 && (d < 0.8 || Math.abs(d - ring) < 0.35)) ? 'endRing' : 'endGrain'
    },
  }
}

/** A sack, slumped. */
function sack(x: number, y: number, z: number, seed: number): Solid[] {
  const r = 3.4 + hash(seed, 1)
  return [drum(x, y, r, z, z + 6, 'canvasPlain'), drum(x, y, r - 1.2, z + 6, z + 8.5, 'canvasPlain'), drum(x, y, 1, z + 8.5, z + 10, 'earth')]
}

const one = (name: string, solids: Solid[], ornaments: Ornament[] = [], footprint = ['#']): Model => ({ name, footprint, solids, voids: [], ornaments })

/** The things that stand. */
function standing(): Record<string, () => Model> {
  const out: Record<string, () => Model> = {}
  out.decor_casks = () => one('decor_casks', [...cask(5, 6, 0), ...cask(11, 10, 0, 4.5, 11), ...cask(7, 9, 12, 4.5, 10)])
  out.decor_casks_row = () => one('decor_casks_row', [...cask(5, 8, 0), ...cask(16, 8, 0), ...cask(27, 8, 0), ...cask(10.5, 8, 12, 4.6, 11), ...cask(21.5, 8, 12, 4.6, 11)], [], ['##'])
  out.decor_crates = () => one('decor_crates', [...crate(1, 4, 0), ...crate(4, 5, 9, 9, 8, 8), ...crate(8, 8, 0, 7, 7, 7)])
  out.decor_crates_row = () =>
    one('decor_crates_row', [...crate(1, 4, 0), ...crate(12, 5, 0), ...crate(22, 4, 0, 9), ...crate(6, 5, 9, 10, 8, 8), ...crate(17, 6, 9, 9, 7, 8)], [{ x: 14, y: 14, z: 17, rows: [' rr gg ', 'rRrgGgg', 'rrrgggg'], keys: { r: 'E1', R: 'E0', g: 'V1', G: 'V0' }, free: true }], ['##'])
  out.decor_sacks = () => one('decor_sacks', [...sack(5, 7, 0, 1), ...sack(11, 9, 0, 2), ...sack(8, 12, 0, 3), ...sack(8, 8, 6, 4)])
  out.decor_amphorae = () =>
    one('decor_amphorae', [3, 8, 13].flatMap((x, k) => [drum(x, 6 + k * 2, 2, 0, 3, 'tile'), drum(x, 6 + k * 2, 3.6, 3, 10, 'tile'), drum(x, 6 + k * 2, 2.6, 10, 13, 'tile'), drum(x, 6 + k * 2, 1.4, 13, 17, 'tile'), drum(x, 6 + k * 2, 2, 17, 18, 'tile')]))
  out.decor_firewood = () => {
    // split logs stacked in a heap that narrows as it rises (four, three, two), each row in the gaps of the one below,
    // their pale cut ends to the street, not flush: a log here and there pushed in or standing out
    const W = 2 * S
    const solids: Solid[] = []
    for (const [row, n] of [[0, 4], [1, 3], [2, 2]] as const) {
      const r = 3.7 - row * 0.15
      const z = 3.7 + row * 6.4
      const x0 = W / 2 - (n - 1) * 3.75
      for (let k = 0; k < n; k++) {
        const seed = row * 7 + k
        solids.push(log(x0 + k * 7.5 + (hash(seed, 3) - 0.5), z, r + (hash(seed, 4) - 0.5) * 0.6, 7, 10.5 + (hash(seed, 5) < 0.3 ? -1 : hash(seed, 5) > 0.8 ? 1 : 0), seed))
      }
    }
    return one('decor_firewood', solids, [], ['##'])
  }
  out.decor_flowerstand = () => {
    const W = 2 * S
    const solids: Solid[] = [box(1, 4, 0, 3, 6, 26, 'timber'), box(W - 3, 4, 0, W - 1, 6, 26, 'timber')]
    for (const [z, y] of [[6, 11], [14, 8], [22, 5]]) solids.push(box(1, y - 2, z - 1, W - 1, y + 3, z, 'timber'))
    const orn: Ornament[] = [[6, 11], [14, 8], [22, 5]].map(([z, y], k) => pots(W - 4, 30 + k).at(2, y + 2, z, true))
    return one('decor_flowerstand', solids, orn, ['##'])
  }
  out.decor_orange = () => {
    const solids: Solid[] = [drum(C, C, 5, 0, 8, 'tile'), drum(C, C, 6, 8, 10, 'tile'), drum(C, C, 1, 10, 18, 'timber')]
    for (let z = 18; z < 32; z++) {
      const r = Math.sqrt(Math.max(0, 49 - (z - 25) * (z - 25)))
      if (r > 0.5) solids.push(drum(C, C, r, z, z + 1, 'foliage'))
    }
    const fruit: Ornament = { x: C - 6, y: C + 6, z: 31, rows: ['   o    ', ' o    o ', '    o   ', 'o  o   o', '  o   o ', ' o   o  '], keys: { o: 'Y1' }, free: true }
    return one('decor_orange', solids, [fruit])
  }
  out.decor_planter = () => {
    const W = 2 * S
    return one('decor_planter', [box(1, 4, 0, W - 1, 13, 9, 'stone'), box(0, 3, 9, W, 14, 11, 'stone'), box(2, 5, 9, W - 2, 12, 10.5, 'earth')], [pots(W - 4, 77).at(2, 9, 10, true)], ['##'])
  }
  out.decor_cafe = () => {
    const W = 2 * S
    const solids: Solid[] = [
      drum(W / 2, 9, 1, 0, 11, 'iron'),
      drum(W / 2, 9, 6, 11, 12, 'plasterWhite'),
      ...[[W / 2 - 10, 8], [W / 2 + 10, 8]].flatMap(([x, y]) => [box(x - 3, y - 2, 0, x + 3, y + 3, 7, 'ironDark'), box(x - 3, y - 3, 7, x + 3, y - 2, 15, 'ironDark')]),
      drum(W / 2, 9, 0.8, 12, 40, 'timber'),
    ]
    // the parasol, striped, over it
    for (let z = 34; z < 40; z++) solids.push(drum(W / 2, 9, 11 - (z - 34) * 1.8, z, z + 1, 'canvasRed'))
    const orn: Ornament[] = [{ x: W / 2 - 3, y: 9, z: 13, rows: ['p  c', 'pp c'], keys: { p: 'cw0', c: 'Y1' }, free: true }]
    return one('decor_cafe', solids, orn, ['##'])
  }
  out.decor_pump = () => one('decor_pump', [box(4, 6, 0, 12, 12, 3, 'stone'), drum(C, 9, 2.2, 3, 26, 'ironDark'), drum(C, 9, 3, 24, 28, 'ironDark'), spire(C, 9, 3, 28, 4, 0, 'ironDark'), box(C, 9, 20, C + 6, 10.5, 21.5, 'ironDark'), box(C - 1, 9, 14, C + 1, 14, 16, 'ironDark'), box(3, 11, 0, 13, 15, 2, 'water')])
  out.decor_signpost = () =>
    one('decor_signpost', [box(C - 1, C - 1, 0, C + 1, C + 1, 40, 'timber'), box(C - 1, C - 1, 40, C + 1, C + 1, 42, 'gold')], [
      { x: C - 9, y: C + 1, z: 36, rows: ['wwwwwwwwwwwwwwwwww ', 'wkwkkwkwkkwkwkkwkww', 'wwwwwwwwwwwwwwwwww '], keys: { w: 'w1', k: 'n2' }, free: true },
      { x: C - 8, y: C + 1, z: 28, rows: [' wwwwwwwwwwwwwwww', 'wwkkwkwwkkwkkwkww', ' wwwwwwwwwwwwwwww'], keys: { w: 'w2', k: 'n2' }, free: true },
    ])
  out.decor_column = () => {
    const orn: Ornament[] = []
    for (let k = 0; k < 3; k++) orn.push(poster(90 + k).at(2 + k * 4, C + 6, 10 + (k % 2) * 12, true))
    return one('decor_column', [drum(C, C, 6, 0, 3, 'stone'), drum(C, C, 5, 3, 40, 'plasterWhite'), drum(C, C, 6, 40, 43, 'ironDark'), spire(C, C, 6, 43, 7, 0, 'copper'), drum(C, C, 1, 50, 53, 'gold')], orn)
  }
  out.decor_bollards = () => one('decor_bollards', [3, 13].flatMap((x) => [drum(x, 8, 2.4, 0, 9, 'stone'), drum(x, 8, 2.8, 9, 11, 'stone')]))
  out.decor_birdbath = () => one('decor_birdbath', [drum(C, C, 3, 0, 3, 'stone'), drum(C, C, 1.6, 3, 14, 'stone'), drum(C, C, 6, 14, 17, 'stone'), drum(C, C, 4.6, 16, 17.2, 'water')], [bird(false, 3).at(C - 6, C, 17, true), bird(true, 4).at(C + 1, C + 2, 17, true)])
  out.decor_cart = () => {
    const W = 2 * S
    const solids: Solid[] = [box(2, 3, 8, W - 6, 13, 16, 'timber'), box(1, 2, 16, W - 5, 14, 18, 'timber'), drum(9, 2, 6, 0, 1, 'timber'), drum(9, 14, 6, 0, 1, 'timber'), box(W - 6, 7, 10, W, 8.5, 11.5, 'timber'), box(W - 6, 9.5, 10, W, 11, 11.5, 'timber')]
    for (const y of [1.5, 14.5]) solids.push({ ...box(3, y - 0.6, 0, 15, y + 0.6, 12, 'timber'), inside: (x, yy, z) => Math.abs(yy - y) <= 0.6 && Math.hypot(x - 9, z - 6) <= 6 && Math.hypot(x - 9, z - 6) >= 4.6 })
    const orn: Ornament[] = [{ x: 4, y: 12, z: 22, rows: ['  gg rr yy ', ' gGgrRryYy ', 'gggrrrryyyy'], keys: { g: 'V1', G: 'V0', r: 'E1', R: 'E0', y: 'Y1', Y: 'Y0' }, free: true }]
    return one('decor_cart', solids, orn, ['##'])
  }
  out.decor_hay = () => one('decor_hay', [box(1, 3, 0, 15, 13, 10, 'thatch'), box(3, 5, 10, 13, 11, 16, 'thatch')])
  out.decor_obelisk = () => one('decor_obelisk', [box(1, 1, 0, 15, 15, 4, 'stone'), box(3, 3, 4, 13, 13, 8, 'stone'), box(5, 5, 8, 11, 11, 56, 'marbleWhite'), spire(C, C, 3.2, 56, 8, 4, 'gold')])
  return out
}

/** What hangs over the street between two posts, walked under: flags, lanterns, washing; a rose arch. */
function hanging(): Record<string, () => Model> {
  const out: Record<string, () => Model> = {}
  for (const w of [3, 4, 5, 6, 8]) {
    const W = w * S
    const posts = (mat: string): Solid[] => [box(C - 1, C - 1, 0, C + 1, C + 1, 62, mat), box(W - C - 1, C - 1, 0, W - C + 1, C + 1, 62, mat), drum(C, C, 2, 62, 64, 'gold'), drum(W - C, C, 2, 62, 64, 'gold')]
    const fp = ['#' + '.'.repeat(w - 2) + '#']
    out[`decor_flags_${w}`] = () => ({ name: `decor_flags_${w}`, footprint: fp, solids: posts('ironDark'), voids: [], ornaments: [bunting(W - S, w).at(C, C, 60, true), bunting(W - S, w + 9).at(C, C, 50, true)] })
    out[`decor_lanterns_${w}`] = () => ({ name: `decor_lanterns_${w}`, footprint: fp, solids: posts('timber'), voids: [], ornaments: [lanternString(W - S, w).at(C, C, 60, true)] })
    out[`decor_washing_${w}`] = () => ({ name: `decor_washing_${w}`, footprint: fp, solids: [box(C - 1, C - 1, 0, C + 1, C + 1, 44, 'timber'), box(W - C - 1, C - 1, 0, W - C + 1, C + 1, 44, 'timber')], voids: [], ornaments: [laundry(W - S, w * 3).at(C, C, 44, true)] })
  }
  out.decor_rosearch = () => {
    const W = 3 * S
    const solids: Solid[] = [box(2, 6, 0, 6, 10, 40, 'ironDark'), box(W - 6, 6, 0, W - 2, 10, 40, 'ironDark')]
    // the arch of iron hoops over the walk, roses grown over it
    solids.push({ b: [0, 4, 30, W, 12, 56], mat: 'foliage', inside: (x, y, z) => y >= 4 && y <= 12 && Math.abs(Math.hypot(x - W / 2, (z - 34) * 1.2) - (W / 2 - 4)) < 3.2 && z >= 30 })
    const orn: Ornament[] = []
    for (let k = 0; k < 26; k++) {
      const a = (k / 25) * Math.PI
      orn.push({ x: W / 2 - Math.cos(a) * (W / 2 - 4) - 1, y: 12, z: 34 + Math.sin(a) * (W / 2 - 4) / 1.2 + 2, rows: ['r', 'R'], keys: { r: k % 3 ? 'cr0' : 'pk1', R: 'cr1' }, free: true })
    }
    return { name: 'decor_rosearch', footprint: ['#.#'], solids, voids: [], ornaments: orn }
  }
  return out
}

/** What lies on the ground. */
function lying(): Record<string, () => Model> {
  const out: Record<string, () => Model> = {}
  const flat = (name: string, rows: string[], keys: Record<string, string>, w = 1): Model => ({
    name,
    footprint: ['.'.repeat(w)],
    // (nothing stands: the picture is laid flat on the cell, its top row at the cell's top)
    solids: [],
    voids: [],
    ornaments: [{ x: 0, y: S, z: Math.max(0, S - rows.length), rows, keys, free: true }],
    ground: true,
  })
  const blot = (w: number, h: number, seed: number, f: (x: number, y: number) => string | null) => {
    const rows: string[] = []
    for (let y = 0; y < h; y++) {
      let l = ''
      for (let x = 0; x < w; x++) l += f(x, y) ?? ' '
      rows.push(l)
    }
    return rows
  }
  for (let k = 0; k < 3; k++) {
    out[`decor_puddle_${k}`] = () =>
      flat(`decor_puddle_${k}`, blot(16, 16, k, (x, y) => {
        const d = Math.hypot((x - 8) / (5 + k), (y - 8) / (3 + k * 0.6)) + hash(x, y, k) * 0.15
        return d < 0.75 ? (hash(x, y, k + 3) < 0.1 ? 'w' : 'q') : d < 1 ? 'Q' : null
      }), { q: 'q2', Q: 'q3', w: 'q0' })
    out[`decor_petals_${k}`] = () => flat(`decor_petals_${k}`, blot(16, 16, k, (x, y) => (hash(x, y, k + 10) < 0.09 ? (hash(x, y, k + 11) < 0.5 ? 'a' : 'b') : null)), { a: ['pk1', 'cr0', 'cy0'][k], b: ['pk0', 'cw0', 'cr0'][k] })
    out[`decor_leaves_${k}`] = () => flat(`decor_leaves_${k}`, blot(16, 16, k, (x, y) => (hash(x, y, k + 20) < 0.1 ? ['a', 'b', 'c'][Math.floor(hash(x, y, k + 21) * 3)] : null)), { a: 't1', b: 'h2', c: 'v2' })
    out[`decor_cracks_${k}`] = () => {
      const pts = new Set<string>()
      let x = 2 + k * 3
      for (let y = 2; y < 14; y++) {
        x = Math.max(0, Math.min(15, x + (hash(k, y, 30) < 0.33 ? -1 : hash(k, y, 30) > 0.66 ? 1 : 0)))
        pts.add(`${x},${y}`)
        if (hash(k, y, 31) < 0.2) pts.add(`${x + 1},${y}`), pts.add(`${x + 2},${y + 1}`)
      }
      return flat(`decor_cracks_${k}`, blot(16, 16, k, (xx, yy) => (pts.has(`${xx},${yy}`) ? 'k' : null)), { k: 'n2' })
    }
    out[`decor_pigeons_${k}`] = () => {
      const m = flat(`decor_pigeons_${k}`, [' '], { ' ': 'k' })
      m.ornaments = [0, 1, 2].slice(0, k + 1).map((i) => bird(hash(k, i) < 0.5, k * 3 + i).at(2 + i * 5, S - 1 - i * 3, 0, true))
      return m
    }
  }
  out.decor_grate = () => flat('decor_grate', blot(16, 16, 0, (x, y) => (x > 3 && x < 12 && y > 5 && y < 11 ? (x === 4 || x === 11 || y === 6 || y === 10 ? 'i' : x % 2 ? 'k' : 'i') : null)), { i: 'i2', k: 'n3' })
  out.decor_manhole = () => flat('decor_manhole', blot(16, 16, 0, (x, y) => { const d = Math.hypot(x - 7.5, (y - 7.5) * 1.6); return d < 5.5 ? (d > 4.5 || (x + y) % 3 === 0 ? 'i' : 'I') : null }), { i: 'i3', I: 'i2' })
  out.decor_chalk = () =>
    flat('decor_chalk', blot(32, 16, 0, (x, y) => (((x % 8 === 0 || y === 3 || y === 12) && x < 32 && y >= 3 && y <= 12) || (x > 20 && Math.hypot(x - 26, y - 8) < 2.5 && Math.hypot(x - 26, y - 8) > 1.6) ? 'c' : null)), { c: 'cw0' }, 2)
  out.decor_straw = () => flat('decor_straw', blot(16, 16, 0, (x, y) => (hash(x, y, 50) < 0.35 - Math.hypot(x - 8, y - 8) * 0.03 ? (hash(x, y, 51) < 0.5 ? 'a' : 'b') : null)), { a: 'h1', b: 'h2' })
  out.decor_cat = () => {
    const m = flat('decor_cat', [' '], { ' ': 'k' })
    m.ornaments = [cat(7).at(4, S - 3, 0, true)]
    return m
  }
  out.decor_rug = () => {
    const rows = blot(32, 14, 0, (x, y) => (x < 1 || x > 30 || y < 1 || y > 12 ? 'b' : (x + y) % 6 < 2 ? 'a' : 'c'))
    const m = flat('decor_rug', rows, { a: 'cy1', b: 'cr2', c: 'cr1' }, 2)
    // its wares on it: pots, a heap of spice, cloth folded
    m.ornaments!.push({ x: 4, y: 12, z: 0, rows: [' pp  oo  cc ', 'pPpp oooo ccc', 'pppp yyyy CCC'], keys: { p: GOODS_KEYS.p, P: GOODS_KEYS.P, o: 'Y1', y: 't1', c: 'cb1', C: 'cb2' }, free: true })
    return m
  }
  return out
}

export const DECOR: Record<string, () => Model> = { ...standing(), ...hanging(), ...lying() }

/** The decor by sort, for the maps to choose from. */
export const DECOR_STANDING = Object.keys(standing())
export const DECOR_LYING = Object.keys(lying())
