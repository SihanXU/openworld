// The streets' furniture, drawn whole as fixtures' pictures (docs/showcase.md §3.4): what makes a square of the Holy
// City a place one stands in — its iron lamps, stone benches, clipped cypresses and box balls in their planters, urns of
// flowers, balustrades along a terrace, the standards hung on the feast days, the First Martyr in bronze on his plinth.

import type { Ornament } from '../oblique.ts'
import { box, drum, octagon, spire, type Solid } from '../shapes.ts'
import { S } from '../kit.ts'
import type { PropModel } from './inside.ts'

const prop = (m: Omit<PropModel, 'sprite'>): PropModel => ({ ...m, sprite: true })
const C = S / 2

/** A street lamp of black iron: a stepped foot, a fluted shaft with a collar, a scrolled arm, a lantern of four panes lit. */
function streetLamp(): PropModel {
  const solids: Solid[] = [
    octagon(C, C, 4, 0, 3, 'ironDark'),
    octagon(C, C, 3, 3, 6, 'ironDark'),
    drum(C, C, 1.3, 6, 46, 'ironDark'),
    drum(C, C, 2.2, 22, 24, 'ironDark'),
    octagon(C, C, 4, 46, 48, 'ironDark'),
    box(C - 4, C - 4, 48, C + 4, C + 4, 59, 'glassLit'),
    octagon(C, C, 5.5, 59, 61, 'ironDark'),
    spire(C, C, 5, 61, 7, 4, 'ironDark'),
  ]
  const orn: Ornament[] = [
    // the frames over its panes and the scrolls under the lantern
    { x: C - 4, y: C + 4, z: 59, rows: ['i       i', 'i   i   i', 'i   i   i', 'i   i   i', 'i   i   i', 'iiiiiiiii', 'i   i   i', 'i   i   i', 'i   i   i', 'i   i   i', 'iiiiiiiii'], keys: { i: 'i3' }, free: true },
    { x: C - 5, y: C + 2, z: 47, rows: ['ii       ii', ' ii     ii ', '  iii iii  '], keys: { i: 'i3' }, free: true },
  ]
  return prop({ name: 'street_lamp', footprint: ['#'], solids, voids: [], ornaments: orn })
}

/** A bench of dressed stone: two carved ends, the seat between them. 2x1. */
function stoneBench(): PropModel {
  const W = 2 * S
  const solids: Solid[] = [box(3, 6, 0, 7, 12, 5, 'stone'), box(W - 7, 6, 0, W - 3, 12, 5, 'stone'), box(1, 5, 5, W - 1, 13, 8, 'stone'), box(2, 3, 5, W - 2, 5, 16, 'stone'), box(1, 2, 16, W - 1, 5, 18, 'stone')]
  return prop({ name: 'stone_bench', footprint: ['##'], solids, voids: [], ornaments: [] })
}

/** A tall cypress clipped to a flame, in a square planter of stone. */
function cypress(): PropModel {
  const solids: Solid[] = [box(2, 2, 0, S - 2, S - 2, 10, 'stone'), box(1, 1, 10, S - 1, S - 1, 12, 'stone'), box(3, 3, 10, S - 3, S - 3, 11, 'earth')]
  // the foliage: stacked drums narrowing upward, a point
  const steps = [5.8, 6.2, 6, 5.6, 5, 4.2, 3.2]
  steps.forEach((r, k) => solids.push(drum(C, C, r, 11 + k * 7, 18 + k * 7, 'foliage')))
  solids.push(spire(C, C, 3, 60, 10, 0, 'foliage'))
  return prop({ name: 'cypress', footprint: ['#'], solids, voids: [], ornaments: [] })
}

/** A ball of box clipped round, in a round planter of terracotta. */
function topiary(): PropModel {
  const solids: Solid[] = [drum(C, C, 5.5, 0, 9, 'tile'), drum(C, C, 6.5, 9, 11, 'tile'), drum(C, C, 1.4, 11, 14, 'timber')]
  for (let z = 14; z < 28; z++) {
    const r = Math.sqrt(Math.max(0, 49 - (z - 21) * (z - 21)))
    if (r > 0.5) solids.push(drum(C, C, r, z, z + 1, 'foliage'))
  }
  return prop({ name: 'topiary', footprint: ['#'], solids, voids: [], ornaments: [] })
}

/** An urn of stone on a pedestal, flowers spilling over its lip. */
function urn(): PropModel {
  const solids: Solid[] = [box(3, 3, 0, S - 3, S - 3, 10, 'stone'), box(2, 2, 10, S - 2, S - 2, 12, 'stone'), drum(C, C, 2, 12, 15, 'stone'), drum(C, C, 4, 15, 18, 'stone'), drum(C, C, 5.5, 18, 24, 'stone'), drum(C, C, 6, 24, 26, 'stone'), drum(C, C, 5, 26, 29, 'foliage')]
  const orn: Ornament[] = [{ x: C - 6, y: C + 5, z: 33, rows: ['  r  y   ', ' rRvyYv r', 'vrvvvvvrR', ' v  v  v ', ' v     v '], keys: { r: 'cr0', R: 'cr1', y: 'cy0', Y: 'cy1', v: 'v1' }, free: true }]
  return prop({ name: 'urn', footprint: ['#'], solids, voids: [], ornaments: orn })
}

/** A length of balustrade of white stone, a cell: a plinth, turned balusters, a coping; a post at its west end. */
function balustrade(): PropModel {
  const solids: Solid[] = [box(0, 6, 0, S, 11, 3, 'stone'), box(0, 6, 15, S, 11, 18, 'stone'), box(0, 5, 0, 4, 12, 20, 'stone')]
  for (const x of [6.5, 10, 13.5]) solids.push(drum(x, 8.5, 1.2, 3, 6, 'stone'), drum(x, 8.5, 1.8, 6, 11, 'stone'), drum(x, 8.5, 1.1, 11, 15, 'stone'))
  return prop({ name: 'balustrade', footprint: ['#'], solids, voids: [], ornaments: [] })
}

/** A standard on a pole, the city's banner of violet and gold hung from a crossbar. */
function standard(): PropModel {
  const solids: Solid[] = [octagon(C, C, 3.5, 0, 3, 'stone'), drum(C, C, 1, 3, 70, 'timber'), box(C - 7, C - 1, 64, C + 7, C + 1, 66, 'timber'), drum(C, C, 2, 70, 73, 'gold')]
  const rows: string[] = []
  for (let j = 0; j < 30; j++) {
    const edge = j > 25 ? Math.abs(j - 25) : 0
    let l = ''
    for (let i = 0; i < 13; i++) {
      const inside = i >= edge && i < 13 - edge
      l += !inside ? ' ' : i === 0 || i === 12 ? 'a' : j > 6 && j < 14 && i > 3 && i < 9 ? 'a' : j % 9 === 0 ? 'A' : 'u'
    }
    rows.push(l)
  }
  const orn: Ornament[] = [{ x: C - 6, y: C + 1, z: 64, rows, keys: { u: 'U1', A: 'U2', a: 'a1' }, free: true }]
  return prop({ name: 'standard', footprint: ['#'], solids, voids: [], ornaments: orn })
}

/** Astra the First Martyr in bronze on a tall plinth of granite (docs/lore.md §1): robed, his arms raised, a gilt sun held up between his hands. */
function martyrStatue(): PropModel {
  const solids: Solid[] = [
    box(0, 1, 0, S, S - 1, 4, 'granite'),
    box(2, 3, 4, S - 2, S - 3, 26, 'granite'),
    box(1, 2, 26, S - 1, S - 2, 29, 'granite'),
    // the robe falling to the plinth, the body, the head under its veil, the arms raised
    drum(C, C, 4.2, 29, 38, 'bronze'),
    drum(C, C, 3.4, 38, 48, 'bronze'),
    drum(C, C, 2.2, 48, 53, 'bronze'),
    box(C - 4.5, C - 1, 46, C - 3, C + 1, 58, 'bronze'),
    box(C + 3, C - 1, 46, C + 4.5, C + 1, 58, 'bronze'),
    drum(C, C, 3.4, 58, 64, 'gold'),
  ]
  const orn: Ornament[] = [
    { x: 4, y: S - 3, z: 20, rows: ['aaaaaaaa', 'a      a', 'a aaaa a', 'a      a', 'aaaaaaaa'], keys: { a: 'a2' } },
    // the sun's rays round the disc
    { x: C - 6, y: C + 3, z: 68, rows: ['  a   a  ', '   a a   ', 'a       a', '         ', 'a       a', '   a a   ', '  a   a  '], keys: { a: 'a0' }, free: true },
  ]
  return prop({ name: 'martyr_statue', footprint: ['#'], solids, voids: [], ornaments: orn })
}

/** A well-head of the square: an octagonal kerb, an iron overthrow with its pulley and bucket. */
function wellHead(): PropModel {
  const W = 2 * S
  const c = W / 2
  const solids: Solid[] = [octagon(c, S / 2 + 4, 13, 0, 14, 'stone'), octagon(c, S / 2 + 4, 10, 10, 15, 'water'), octagon(c, S / 2 + 4, 14, 14, 16, 'stone')]
  for (const dx of [-11, 11]) solids.push(box(c + dx - 1, S / 2 + 3, 16, c + dx + 1, S / 2 + 5, 46, 'iron'))
  solids.push(box(c - 11, S / 2 + 3, 44, c + 11, S / 2 + 5, 46, 'iron'), drum(c, S / 2 + 4, 2.5, 38, 43, 'timber'))
  const orn: Ornament[] = [{ x: c - 9, y: S / 2 + 5, z: 52, rows: [' iiiiiiiiiiiiiiiii ', 'i   i       i    i', 'i  i         i   i'], keys: { i: 'i3' }, free: true }]
  return prop({ name: 'well_head', footprint: ['##'], solids, voids: [], ornaments: orn })
}

export const STREET_PROPS: Record<string, () => PropModel> = {
  street_lamp: streetLamp,
  stone_bench: stoneBench,
  cypress,
  topiary,
  urn,
  balustrade,
  standard,
  martyr_statue: martyrStatue,
  well_head: wellHead,
}
