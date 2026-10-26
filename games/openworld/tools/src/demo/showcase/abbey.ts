// Sunwell Abbey (docs/showcase.md §4.1): the great church of the Holy City's abbey and its close — the showcase of a
// gothic cathedral without and within. One comes in by the close's gate, up a lime avenue onto the parvis, and the west
// front fills the sky (the view draws back and looks up at it, MapData.vistas); round the church its close: the
// cloister against the nave's east flank, the library and scriptorium over the chapter house north of it, the
// refectory, the dorter and the abbot's lodging east, the almonry by the gate, the graveyard west of the choir, the
// herb garden behind the chevet. Within: the nave — five bays of clustered piers, pews, the crossing, the choir and its
// stalls, the high altar under its canopy in the apse, the glass throwing its colours on the floor as the sun goes round
// — the crypt under the choir, the belfry over the south-west tower; the library with its cases and desks; the
// refectory's long tables.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, reseed, type Cell } from '../builder.ts'
import { OVERWORLD } from '../overworld.ts'
import { roomsBehind } from '../continent/rooms.ts'
import { CASTS, type Cast, type Hours } from './cast.ts'
import { floorTop, hallRoom, linkDoors, linkStair } from './rooms.ts'
import { NAVE } from '../../art/arch/plans.ts'
import { belfryHall, cryptHall, libraryHall, refectoryHall } from './halls.ts'
import { clearDoorsteps } from './street.ts'
import { lamp, panels, parterre, piles, strew, unshut } from './dress.ts'

/** Where the church stands on the close: its footprint's top-left (26 by 44 cells, the porch on its last row). */
export const CHURCH: Cell = [22, 10]

export function abbeyClose(p: Place): MapBuilder[] {
  reseed(p.seed)
  const W = 76
  const H = 92
  const b = new MapBuilder(p.id, p.name, 'cathedral', W, H, 'grass', 'temple', 'outdoor', p.region)
  b.backdrop = true
  b.zone = 'peaceful'
  b.site = { map: OVERWORLD, x: p.x, y: p.y, size: 1 }
  const [cx, cy] = CHURCH
  const mid = cx + 13 // the church's axis: between cells 34 and 35
  // The close is laid out round one network of walks (docs/showcase.md §4.1): the lime avenue from the gate to the
  // parvis; the parvis framed by its hedge, open to the church's front and by a gap east and west; from the west gap the
  // walk north past the graveyard's gate to the herb garden behind the chevet; along the garden and down the close's
  // east side, the walk every building of the brothers opens onto (library, cloister, dorter, lodge, refectory) and back
  // to the parvis's east gap. Every garden lies on a walk: the fishpond, the orchard, the lavender, the abbot's bed.
  const PARVIS = { x: 15, y: cy + 43, w: 42, h: 16 }
  const AV = { x: mid - 3, w: 6 }
  const GATE_Y = H - 8
  const EAST = W - 3
  // ------------------------------------------------------------------ the walks (flags), laid first: buildings and gardens go on and beside them
  b.rect(19, 8, 2, PARVIS.y - 8, 'flags')
  b.rect(19, 8, EAST - 17, 2, 'flags')
  b.rect(EAST, 8, 2, PARVIS.y + 9 - 8, 'flags')
  b.rect(PARVIS.x + PARVIS.w - 1, PARVIS.y + 7, EAST - PARVIS.x - PARVIS.w + 1, 2, 'flags')
  b.rect(48, 30, EAST - 48, 2, 'flags')
  b.rect(44, 47, EAST - 44, 2, 'flags')
  b.rect(60, 39, EAST - 60, 2, 'flags')
  b.rect(66, 56, 1, PARVIS.y + 7 - 56, 'flags')
  // ------------------------------------------------------------------ the parvis: paving in panels inside its hedge, the axis and the ring round the fountain inlaid
  b.rect(PARVIS.x, PARVIS.y, PARVIS.w, PARVIS.h, 'paving')
  panels(b, PARVIS.x + 1, PARVIS.y + 1, PARVIS.w - 2, PARVIS.h - 2, 5)
  b.rect(PARVIS.x + 1, PARVIS.y + 7, PARVIS.w - 2, 2, 'flags')
  for (let y = PARVIS.y; y < PARVIS.y + PARVIS.h; y++)
    for (let x = PARVIS.x; x < PARVIS.x + PARVIS.w; x++) if ((x >= mid - 2 && x < mid + 2) || Math.hypot(x + 0.5 - mid, y + 0.5 - (PARVIS.y + 7)) < 5.4) b.set(x, y, 'plaza')
  // its hedge: west and east and south, open at the walks and the avenue; a cypress at each corner of it
  for (let y = PARVIS.y + 1; y < PARVIS.y + PARVIS.h; y++) for (const x of [PARVIS.x, PARVIS.x + PARVIS.w - 1]) if (y < PARVIS.y + 7 || y > PARVIS.y + 8) b.set(x, y, 'bush')
  for (let x = PARVIS.x; x < PARVIS.x + PARVIS.w; x++) if (x < AV.x || x >= AV.x + AV.w) b.set(x, PARVIS.y + PARVIS.h - 1, 'bush')
  // ------------------------------------------------------------------ the lime avenue from the gate: paving, a kerb of flags, a clipped hedge, the limes, lamps
  const avTop = PARVIS.y + PARVIS.h
  b.rect(AV.x, avTop - 1, AV.w, GATE_Y - avTop + 1, 'flags')
  b.rect(AV.x + 1, avTop - 1, AV.w - 2, GATE_Y - avTop + 1, 'paving')
  for (let y = avTop; y < GATE_Y; y++) for (const x of [AV.x - 1, AV.x + AV.w]) b.set(x, y, 'bush')
  for (let y = avTop; y < GATE_Y - 1; y += 2) for (const x of [AV.x - 2, AV.x + AV.w + 1]) b.set(x, y, 'tree')
  // the close's wall along the south with the gate in it, the road out
  b.building('abbey_gate', AV.x, GATE_Y)
  b.fence('stonewall', [1, GATE_Y + 4], [AV.x - 1, GATE_Y + 4])
  b.fence('stonewall', [AV.x + 5, GATE_Y + 4], [W - 2, GATE_Y + 4])
  b.rect(AV.x + 2, GATE_Y + 5, 2, H - GATE_Y - 5, 'paving')
  // the almonry by the gate, where the poor are given bread: its door onto a path to the avenue
  b.building('abbey_almonry', AV.x - 10, GATE_Y - 6, ['almonry'])
  b.rect(AV.x - 8, GATE_Y - 1, 7, 1, 'flags')
  for (let y = GATE_Y - 1; y > GATE_Y - 2; y--) b.set(AV.x - 1, y, 'flags')
  // ------------------------------------------------------------------ the church
  b.building('abbey_church', cx, cy, ['church.west', 'church.west2'])
  // the parvis's furniture: the fountain, saints and standards either side of the porch, parterres, benches, lamps, the pilgrims' stalls
  b.building('town_fountain_grand', mid - 3, PARVIS.y + 4)
  for (const x of [mid - 4, mid + 3]) b.fixture('fixture/sacred/saint', x, PARVIS.y + 1)
  for (const x of [mid - 6, mid + 5]) b.fixture('fixture/standard', x, PARVIS.y + 1)
  parterre(b, PARVIS.x + 2, PARVIS.y + 2, 10, 4)
  parterre(b, PARVIS.x + 2, PARVIS.y + 10, 10, 4)
  parterre(b, PARVIS.x + PARVIS.w - 12, PARVIS.y + 2, 10, 4)
  parterre(b, PARVIS.x + PARVIS.w - 12, PARVIS.y + 10, 10, 4)
  for (const [x, y] of [[mid - 7, PARVIS.y + 4], [mid + 5, PARVIS.y + 4], [mid - 7, PARVIS.y + 11], [mid + 5, PARVIS.y + 11]] as Cell[]) b.fixture('fixture/garden/bench', x, y)
  for (const [x, y] of [[PARVIS.x + 1, PARVIS.y + 1], [PARVIS.x + PARVIS.w - 2, PARVIS.y + 1], [PARVIS.x + 1, PARVIS.y + PARVIS.h - 2], [PARVIS.x + PARVIS.w - 2, PARVIS.y + PARVIS.h - 2], [AV.x, PARVIS.y + PARVIS.h - 2], [AV.x + AV.w - 1, PARVIS.y + PARVIS.h - 2]] as Cell[]) lamp(b, x, y)
  for (let y = avTop + 1; y < GATE_Y - 1; y += 4) for (const x of [AV.x, AV.x + AV.w - 1]) lamp(b, x, y)
  b.building('market_stall_candles', PARVIS.x + 13, PARVIS.y + 13)
  b.building('market_stall_herbs', PARVIS.x + PARVIS.w - 16, PARVIS.y + 13)
  // ------------------------------------------------------------------ the brothers' buildings on the east walk: cloister, library, dorter, lodge, refectory
  b.building('abbey_cloister', 44, 33)
  // the garth: four beds round a cross of flags, the well head at its middle, box at the corners; its way in from the walk
  b.rect(46, 35, 12, 10, 'grass')
  for (const [x, y] of [[47, 36], [54, 36], [47, 41], [54, 41]] as Cell[]) b.rect(x, y, 4, 3, 'flowerbed')
  b.rect(51, 35, 2, 12, 'flags')
  b.rect(46, 39, 12, 2, 'flags')
  b.fixture('fixture/water/well/square', 51, 39)
  for (const [x, y] of [[46, 35], [57, 35], [46, 44], [57, 44]] as Cell[]) b.fixture('fixture/garden/topiary', x, y)
  b.building('abbey_library', 50, 23, ['library'])
  b.building('abbey_dorter', 60, 33, ['dorter'])
  b.building('abbey_lodge', 62, 41, ['lodge'])
  b.building('abbey_refectory', 60, 50, ['refectory'])
  // the abbot's bed of roses by his lodging, urns either side of it
  b.rect(69, 42, 3, 4, 'flowerbed')
  for (const y of [41, 46]) b.fixture('fixture/garden/urn', 70, y)
  // ------------------------------------------------------------------ the graveyard west of the choir, its gate onto the west walk, the yews, the calvary
  b.yard(3, 10, 16, 30, 'stonewall', [[18, 24], [18, 25]])
  b.rect(4, 24, 15, 2, 'flags')
  b.rect(10, 11, 2, 28, 'flags')
  for (let y = 12; y < 38; y += 3) for (let x = 5; x < 17; x += 2) if (x !== 11 && !(x >= 9 && x <= 12 && y >= 22 && y <= 28)) b.fixture('fixture/sacred/gravestone', x, y)
  b.building('market_cross', 10, 26)
  for (const [x, y] of [[4, 11], [17, 11], [4, 38], [17, 38], [8, 18], [13, 32]]) b.set(x, y, 'pine')
  // saints along the west walk, between it and the church, lamps and urns between them
  for (let y = 12; y < PARVIS.y - 3; y += 6) {
    b.fixture('fixture/sacred/saint', 21, y)
    if (y % 12 === 0) lamp(b, 21, y + 3)
    else b.fixture('fixture/garden/urn', 21, y + 3)
  }
  // ------------------------------------------------------------------ the herb garden behind the chevet in beds between walks, its well, its hedge
  for (let y = 1; y < 8; y++) for (let x = cx; x < cx + 26; x++) b.set(x, y, y % 3 === 0 || (x - cx) % 5 === 0 ? 'flags' : 'farmland')
  b.fixture('fixture/water/well', mid, 4)
  for (const x of [cx - 1, cx + 26]) for (let y = 1; y < 8; y++) b.set(x, y, 'bush')
  // ------------------------------------------------------------------ the gardens on the walks: the fishpond and its bench, the orchard and its hives, the lavender
  b.organic(8, 46, 4, 2.6, 'water', { rough: 0.3, only: (c) => c === 'grass' })
  b.rect(13, 45, 6, 1, 'flags')
  b.fixture('fixture/garden/bench', 14, 46)
  for (const [x, y] of [[3, 43], [12, 44], [4, 49], [11, 49]] as Cell[]) if (b.get(x, y) === 'grass') b.set(x, y, 'bush')
  for (let y = 53; y < GATE_Y + 3; y += 3) for (let x = 1; x < 13; x += 3) if (b.get(x + (y % 2), y) === 'grass') b.set(x + (y % 2), y, 'tree')
  b.rect(1, PARVIS.y + 7, PARVIS.x - 1, 2, 'flags')
  for (const [x, y] of [[3, PARVIS.y + 10], [7, PARVIS.y + 10], [11, PARVIS.y + 10]] as Cell[]) b.fixture('fixture/nature/beehive', x, y)
  // the lavender south-east, in rows between walks off the east one, a hedge round
  const LAV = { x: PARVIS.x + PARVIS.w + 2, y: PARVIS.y + 10, w: EAST - (PARVIS.x + PARVIS.w + 2) - 1, h: GATE_Y - (PARVIS.y + 10) + 2 }
  for (let y = LAV.y; y < LAV.y + LAV.h; y++) for (let x = LAV.x; x < LAV.x + LAV.w; x++) b.set(x, y, y === LAV.y || y === LAV.y + LAV.h - 1 || x === LAV.x || x === LAV.x + LAV.w - 1 ? 'bush' : (y - LAV.y) % 2 ? 'flowerbed' : 'flags')
  for (let y = LAV.y; y < LAV.y + LAV.h - 1; y++) b.set(LAV.x + Math.floor(LAV.w / 2), y, 'flags')
  b.rect(EAST, PARVIS.y + 9, 2, LAV.h, 'flags')
  for (let y = LAV.y + 1; y < LAV.y + LAV.h - 1; y += 2) b.set(LAV.x + LAV.w - 1, y, 'flags')
  // the brothers' kitchen garden east of the avenue: beds between walks, its way in through a gap in the avenue's hedge
  const KG = { x: AV.x + AV.w + 3, y: avTop + 2, w: LAV.x - (AV.x + AV.w + 3) - 2, h: GATE_Y - avTop - 4 }
  for (let y = KG.y; y < KG.y + KG.h; y++) for (let x = KG.x; x < KG.x + KG.w; x++) b.set(x, y, (y - KG.y) % 3 === 0 || (x - KG.x) % 5 === 0 ? 'flags' : 'farmland')
  const kgDoor = KG.y + 3 * Math.floor(KG.h / 6)
  for (let x = AV.x + AV.w; x < KG.x; x++) b.set(x, kgDoor, 'flags')
  b.fixture('fixture/water/well', KG.x + Math.floor(KG.w / 2), KG.y + 1)
  for (const [x, y] of [[KG.x - 1, KG.y], [KG.x + KG.w, KG.y], [KG.x - 1, KG.y + KG.h - 1], [KG.x + KG.w, KG.y + KG.h - 1]] as Cell[]) b.set(x, y, 'tree')
  // the rose garden west of the avenue, over the almonry: a ring of beds round a bird bath, an arch on its walk
  const RG = { x: 14, y: avTop + 1, w: AV.x - 2 - 14 - 1, h: GATE_Y - 7 - (avTop + 1) - 1 }
  const rgMid: Cell = [RG.x + Math.floor(RG.w / 2), RG.y + Math.floor(RG.h / 2)]
  for (let y = RG.y; y < RG.y + RG.h; y++)
    for (let x = RG.x; x < RG.x + RG.w; x++) {
      const edge = x === RG.x || x === RG.x + RG.w - 1 || y === RG.y || y === RG.y + RG.h - 1
      const walk = x === rgMid[0] || y === rgMid[1] || x === RG.x + 1 || x === RG.x + RG.w - 2 || y === RG.y + 1 || y === RG.y + RG.h - 2
      b.set(x, y, edge ? 'bush' : walk ? 'flags' : 'flowerbed')
    }
  for (let x = rgMid[0]; x < AV.x; x++) if (b.get(x, rgMid[1]) !== 'tree') b.set(x, rgMid[1], 'flags')
  b.set(AV.x - 1, rgMid[1], 'flags')
  for (let x = rgMid[0]; x < RG.x + RG.w; x++) b.set(x, rgMid[1], 'flags')
  b.building('decor_birdbath', rgMid[0] - 3, rgMid[1] - 1)
  // the orchard north of the library, in rows on the lawn the walks leave
  for (let y = 12; y < 21; y += 3) for (let x = 50; x < EAST - 1; x += 3) if (b.get(x + (y % 2), y) === 'grass') b.set(x + (y % 2), y, 'tree')
  for (const x of [52, 61, 70]) b.fixture('fixture/nature/beehive', x, 21)
  // the close's trees along its east edge, flowers along the walks, tufts in the grass
  for (let y = 2; y < 30; y += 4) for (let x = W - 1; x < W; x++) b.set(x, y, 'tree')
  b.sprinkle('fixture/nature/flowers', 0.12, (x, y, t) => t === 'grass' && (b.get(x + 1, y) === 'flags' || b.get(x - 1, y) === 'flags' || b.get(x, y + 1) === 'flags' || b.get(x, y - 1) === 'flags'))
  b.sprinkle('fixture/nature/flowers', 0.05, (_x, _y, t) => t === 'grass')
  b.sprinkle('fixture/nature/tuft', 0.03, (_x, _y, t) => t === 'grass')
  // the view on the parvis and the avenue: drawn back, looking up at the west front
  b.vistas.push({ at: [PARVIS.x, PARVIS.y, PARVIS.w, H - PARVIS.y], zoom: 0.5, focus: [mid, cy + 27], share: 0.5 })
  b.anchors = { parvis: [mid, PARVIS.y + 12], porch: [mid - 1, PARVIS.y + 1], gate: [AV.x + 2, GATE_Y - 2], garth: [52, 40], garden: [mid, 6], graves: [10, 28], candles: [PARVIS.x + 14, PARVIS.y + 13], herbs: [PARVIS.x + PARVIS.w - 15, PARVIS.y + 13] }
  // ------------------------------------------------------------------ the clutter: pots and orange trees by the buildings' walls, petals on the walks
  piles(b, 0, 0, W, H, 'close', 0.3)
  strew(b, 0, 0, W, H, 0.08)
  clearDoorsteps(b)
  unshut(b)
  // the orchard over the close, behind the chevet: room for the church's picture to rise into, and the view to show it
  b.grow(10, 'grass')
  for (let y = 1; y < 10; y += 3) for (let x = 4; x < W - 3; x += 4) if (Math.abs(x - mid) > 6) b.set(x + (y % 2), y, 'tree')

  // ------------------------------------------------------------------ within: the nave (its plan art/arch/plans.ts NAVE)
  const NP = NAVE.parts
  const AX = NAVE.axis
  const nave = new MapBuilder(`${p.id}.nave`, { en: `${p.name.en} — the Nave`, zh: `${p.name.zh}·中殿` }, 'interior', NAVE.plan[0].length, NAVE.plan.length, 'void', 'temple', 'indoor', p.region)
  nave.backdrop = true
  nave.zone = 'peaceful'
  const inside = (r: { x: number; y: number; w: number; h: number }, t: string) => nave.rect(r.x, r.y, r.w, r.h, t)
  // the floors: lattice in the transept's arms and the nave, marble in the crossing, the chancel, the chapels, the aisles, the narthex
  for (const r of Object.values(NP)) inside(r, 'lattice')
  for (const r of [NP.apse, NP.choir, NP.chapelW1, NP.chapelW2, NP.chapelE1, NP.chapelE2, NP.narthex]) inside(r, 'marble')
  nave.rect(9, NP.transept.y, 17, NP.transept.h, 'marble')
  nave.rect(NP.nave.x, NP.nave.y, 3, NP.nave.h, 'marble')
  nave.rect(NP.nave.x + NP.nave.w - 3, NP.nave.y, 3, NP.nave.h, 'marble')
  // the chancel raised a level over the choir's step, the crimson carpet from the west door up to the altar
  const dais = NP.apse.y
  const step = NP.choir.y + NP.choir.h - 3
  nave.raise(NP.choir.x, dais, NP.choir.w, step - dais, 2)
  nave.raise(NP.apse.x, dais, NP.apse.w, NP.choir.y - dais, 2)
  nave.raise(NP.choir.x, step, NP.choir.w, 1, 1)
  nave.rect(AX - 1, NP.transept.y + NP.transept.h, 3, NP.nave.h + NP.narthex.h, 'carpet_royal')
  nave.rect(AX - 1, step - 4, 3, NP.transept.y - (step - 4), 'carpet_royal')
  nave.rect(AX - 2, dais + 3, 5, step - 4 - (dais + 3), 'carpet_royal')
  nave.set(AX, NAVE.door[1], 'door')
  // the walls: tall faces where the floor runs up to them, the ceiling's dark over the rest (stamped from the plan)
  nave.building('nave_shell', 0, 0)
  // the apse: the organ before the great window, the high altar before it, the bishop's chair and the cantor's, candelabra, crosses, saints
  nave.fixture('fixture/sacred/organ', AX, dais)
  nave.fixture('fixture/sacred/altar/high', AX, dais + 3, { props: { text: 'To the Light, and to Astra, who bore the Night for us.', text_zh: '献给光，献给为我们承受黑夜的阿斯特拉。' } })
  nave.fixture('fixture/sacred/reliquary', AX, dais + 1)
  for (const k of [-1, 1]) {
    nave.fixture('fixture/light/candelabrum', AX + k * 3, dais + 3, { statuses: { lit: -1 } })
    nave.fixture('fixture/sacred/cross', AX + k * 4, dais + 1)
    nave.fixture('fixture/sacred/saint', AX + k * 7, NP.choir.y)
    nave.fixture('fixture/light/candelabrum', AX + k * 8, step - 2, { statuses: { lit: -1 } })
    nave.fixture('fixture/nature/plant', AX + k * 5, dais)
  }
  nave.fixture('fixture/furniture/throne', AX - 4, dais + 5)
  nave.fixture('fixture/furniture/chair', AX + 4, dais + 5)
  // the altar rail along the chancel's edge, a gap for the carpet; the choir's stalls either side within it
  for (let x = NP.choir.x; x < NP.choir.x + NP.choir.w; x++) if (Math.abs(x - AX) > 2) nave.fixture('fixture/sacred/rail', x, step - 1)
  for (const k of [-1, 1]) for (const y of [step - 3, step - 2]) nave.fixture('fixture/furniture/pew', AX + k * 6, y)
  nave.fixture('fixture/sacred/lectern', AX - 3, step + 1)
  nave.fixture('fixture/sacred/pulpit', NP.choir.x + NP.choir.w, NP.transept.y + 1)
  // the crossing: the labyrinth in its floor, a clustered pier at each corner
  nave.building('nave_labyrinth', AX - 2, NP.transept.y + 2)
  for (const x of [9, 25]) for (const y of [NP.transept.y, NP.transept.y + NP.transept.h - 1]) nave.building('nave_pier', x, y)
  // the transept's arms: under each rose a doorway, candelabra either side, the founders' tombs, plants
  for (const cx of [5, 29]) {
    for (const k of [-1, 1]) nave.fixture('fixture/light/candelabrum', cx + k * 2, NP.transept.y, { statuses: { lit: -1 } })
    for (const k of [-2, 0, 2]) nave.fixture('fixture/sacred/tomb', cx + k, NP.transept.y + NP.transept.h - 1, { props: { text: 'Here lies an abbot of Sunwell. The light keeps him.', text_zh: '此处安息着日泉的一位院长。光守着他。' } })
    for (const k of [-3, 3]) nave.fixture('fixture/nature/plant', cx + k, NP.transept.y + 1)
  }
  // the nave: two blocks of pews either side of the carpet, the aisles open; candelabra along the walls between the chapels
  for (let y = NP.nave.y + 3; y < NP.nave.y + NP.nave.h - 2; y += 2)
    for (const x of [AX - 6, AX - 3, AX + 3, AX + 6]) nave.fixture('fixture/furniture/pew', x, y)
  for (const y of [NP.nave.y + 2, NP.nave.y + 11, NP.nave.y + 20]) for (const x of [NP.nave.x, NP.nave.x + NP.nave.w - 1]) nave.fixture('fixture/light/candelabrum', x, y, { statuses: { lit: -1 } })
  // the chapels: a kneeler before each saint, a plant at its side
  for (const r of [NP.chapelW1, NP.chapelW2, NP.chapelE1, NP.chapelE2]) {
    nave.fixture('fixture/furniture/pew', r.x + 1, r.y + 2)
    nave.fixture('fixture/nature/plant', r.x + (r.x < AX ? 0 : 2), r.y + r.h - 1)
  }
  // the narthex: the font, saints at the door, plants
  nave.fixture('fixture/sacred/font', AX - 4, NP.narthex.y + 1)
  for (const k of [-1, 1]) {
    nave.fixture('fixture/sacred/saint', AX + k * 3, NP.narthex.y)
    nave.fixture('fixture/nature/plant', AX + k * 2, NP.narthex.y + NP.narthex.h - 1)
  }
  // the light: the great window's gold on the chancel, the roses' colours in the arms, the choir's lancets, the chapels'
  // violet, by day; the candelabra and sconces by night
  nave.lights.push({ x: AX, y: dais + 6, w: 5, h: 7, color: '#ffd16b', shape: 'lancet', when: 'sun', strength: 0.5 })
  for (const [x, c] of [[5, '#d9474e'], [29, '#4a7fd6']] as [number, string][]) nave.lights.push({ x, y: NP.transept.y + 4, w: 6, h: 6, color: c, shape: 'rose', when: 'sun', strength: 0.45 })
  for (const [x, c] of [[10, '#d9474e'], [24, '#4a7fd6']] as [number, string][]) nave.lights.push({ x, y: NP.choir.y + 3, w: 2, h: 4, color: c, shape: 'lancet', when: 'sun', strength: 0.4 })
  for (const r of [NP.chapelW1, NP.chapelW2, NP.chapelE1, NP.chapelE2]) nave.lights.push({ x: r.x + 1, y: r.y + 2, w: 2, h: 3, color: '#8c5cc2', shape: 'lancet', when: 'sun', strength: 0.4 })
  for (const [x, y] of [[AX, dais + 3], [5, NP.transept.y + 1], [29, NP.transept.y + 1], [AX, NP.choir.y + 2], [NP.nave.x, NP.nave.y + 11], [NP.nave.x + NP.nave.w - 1, NP.nave.y + 11]])
    nave.lights.push({ x, y, w: 5, h: 4, color: '#ffb35c', shape: 'glow', when: 'night', strength: 0.45 })
  // in the choir the view draws back and looks up at the apse; in the nave, along it to the altar
  nave.vistas.push({ at: [NP.choir.x, NP.apse.y, NP.choir.w, NP.choir.y + NP.choir.h - NP.apse.y], zoom: 0.6, focus: [AX, NP.apse.y - 4], share: 0.5 })
  nave.vistas.push({ at: [2, NP.transept.y, 31, NP.nave.y + NP.nave.h - NP.transept.y], zoom: 0.75, focus: [AX, NP.apse.y], share: 0.35 })
  nave.anchors = { altar: [AX, dais + 5], choir: [AX, step - 3], pulpit: [NP.choir.x + NP.choir.w - 1, NP.transept.y + 2], font: [AX - 4, NP.narthex.y + 2] }
  nave.doors.out = [AX, NAVE.door[1]]
  linkDoors(b, [b.doors['church.west']], nave, [nave.doors.out])
  b.portal(b.doors['church.west2'][0], b.doors['church.west2'][1], nave.id, AX, NAVE.door[1] - 1, nave.name)

  // ------------------------------------------------------------------ the crypt under the choir, the belfry over the south-west tower, the library, the refectory
  // (each from its own plan, art/arch/plans.ts HALLS; laid and furnished in halls.ts)
  const crypt = cryptHall(p)
  linkStair(nave, [3, NP.transept.y + 1], crypt, crypt.anchors.stair, true)
  const belfry = belfryHall(p)
  linkStair(nave, [NP.narthex.x, NP.narthex.y], belfry, belfry.anchors.stair, false)
  const library = libraryHall(p)
  linkDoors(b, [b.doors.library], library, [library.doors.out])
  const refectory = refectoryHall(p)
  linkDoors(b, [b.doors.refectory], refectory, [refectory.doors.out])

  // ------------------------------------------------------------------ the rooms behind the other doors (rooms.ts): the brothers' cells, the lodge, the almonry
  // the dorter: the brothers' beds in two rows under its roof (a cell's household, rooms.ts's role, and the cast's)
  const dorter = hallRoom({ id: `${p.id}.cell-0`, name: { en: `${p.name.en} — the Dorter`, zh: `${p.name.zh}·僧舍` }, w: 20, h: 10, floor: 'floor_wood', region: p.region, frame: 'plaster' })
  const d0 = floorTop(dorter)
  for (let x = 2; x < 18; x += 2) for (const y of [d0 + 1, d0 + 5]) dorter.fixture('fixture/furniture/bed', x, y + 1)
  dorter.fixture('fixture/container/chest', 18, d0 + 1)
  dorter.fixture('fixture/light/candles', 10, d0 + 3)
  linkDoors(b, [b.doors.dorter], dorter, [dorter.doors.out])
  const rooms = [dorter, ...roomsBehind(b, p, [
    { door: 'lodge', prefab: 'abbey_lodge', role: 'cell' },
    { door: 'almonry', prefab: 'abbey_almonry', role: 'shop' },
  ])]

  // ------------------------------------------------------------------ the brothers, the abbot, the pilgrims, the poor
  const at = (m: MapBuilder, [x, y]: Cell, from: number, to: number, activity: string, r = 1): Hours => ({ from, to, map: m.id, x, y, r, activity })
  const A = b.anchors
  const cast: Cast[] = []
  // the brothers: lauds in the choir, the morning at their work (the scriptorium's desks, the garden, the cloister), the
  // meal in the refectory, the afternoon at work again, vespers in the choir, the evening walk in the cloister
  const WORK: [MapBuilder, Cell, string][] = [
    [library, library.anchors.desks, 'work'], [library, library.anchors.desks, 'work'], [library, library.anchors.desks, 'work'], [library, library.anchors.cases, 'read'],
    [b, A.garden, 'work'], [b, A.garden, 'work'], [b, A.garth, 'pray'], [b, A.graves, 'pray'], [nave, nave.anchors.altar, 'pray'],
  ]
  WORK.forEach(([m, c, act], i) =>
    cast.push({
      role: 'priest',
      home: dorter.id,
      sex: 'male',
      day: [
        at(nave, nave.anchors.choir, 5, 7, 'pray', 3),
        at(m, c, 7, 12, act, 3),
        at(refectory, [i % 2 ? 7 : 18, refectory.anchors.table[1] + 3 + (i % 3) * 3], 12, 13, 'eat', 2),
        at(m, c, 13, 17, act, 3),
        at(nave, nave.anchors.choir, 17, 19, 'pray', 3),
        at(b, A.garth, 19, 21, 'walk', 6),
      ],
    }),
  )
  // the abbot, the sacristan who keeps the nave, the almoner, the keeper of the parvis's candle stall
  cast.push({ role: 'priest', home: rooms[1].id, age: [55, 75], sex: 'male', day: [at(nave, nave.anchors.choir, 6, 8, 'pray', 2), at(b, A.parvis, 8, 11, 'walk', 4), at(library, library.anchors.cases, 11, 12, 'read', 2), at(refectory, refectory.anchors.table, 12, 13, 'eat', 1), at(nave, nave.anchors.altar, 13, 18, 'pray', 2), at(nave, nave.anchors.choir, 18, 21, 'pray', 2)] })
  cast.push({ role: 'priest', home: dorter.id, day: [at(nave, nave.anchors.font, 5, 12, 'work', 4), at(refectory, refectory.anchors.bench, 12, 13, 'eat', 2), at(nave, nave.anchors.pulpit, 13, 21, 'work', 5)] })
  cast.push({ role: 'merchant', home: rooms[2].id, stock: [['item/light/candle', 6], ['item/vessel/flask/holy_water', 2], ['item/food/bread', 3]], day: [at(b, A.candles, 7, 12, 'work', 1), at(rooms[2], [5, 3], 12, 13, 'eat', 2), at(b, A.candles, 13, 19, 'work', 1), at(b, A.parvis, 19, 21, 'rest', 4)] })
  cast.push({ role: 'herbalist', home: rooms[2].id, stock: [['item/material/herb', 5], ['item/potion/healing', 1]], day: [at(b, A.herbs, 7, 12, 'work', 1), at(b, A.garden, 12, 15, 'work', 3), at(b, A.herbs, 15, 19, 'work', 1), at(rooms[2], [5, 3], 19, 21, 'rest', 2)] })
  // pilgrims on the parvis and at the altar, a beggar at the porch (they sleep in the almonry's loft)
  for (let k = 0; k < 6; k++)
    cast.push({ role: 'traveler', home: rooms[2].id, day: [at(b, A.gate, 6, 8, 'walk', 4), at(b, A.parvis, 8, 11, 'rest', 6), at(nave, k % 2 ? nave.anchors.altar : nave.anchors.font, 11, 14, 'pray', 6), at(b, A.parvis, 14, 18, 'rest', 7), at(b, A.porch, 18, 20, 'rest', 6)] })
  cast.push({ role: 'beggar', home: rooms[2].id, day: [at(b, A.porch, 6, 20, 'sit', 2)] })
  cast.push({ role: 'guard', home: rooms[1].id, day: [at(b, A.gate, 6, 14, 'watch', 1), at(b, A.parvis, 14, 20, 'watch', 5)] })
  CASTS.set(p.id, cast)
  return [b, nave, crypt, belfry, library, refectory, ...rooms]
}
