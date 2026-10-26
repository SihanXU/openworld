// The second batch's buildings (docs/showcase.md §4b, the user's ask of 2026-10-26): a model place in each of the five
// seals' lands, each its own kit — the Frostfang Coast's snowbound harbour (cogs at the quay, a lighthouse, warehouses
// with their hoists, longhouses under snow), the Scarred March's canyon town (palisades, timber watchtowers, the army's
// tents, a trebuchet, flat-roofed houses of red sandstone), the Vale of Scales' granary city (windmills, granaries on
// their staddles, the great scales), the Pale Fens' stilt village (houses on piles over the water, the ossuary
// chapel), the White Altar Heights' cliff monastery (white stone, a bell gable, cells cut in the cliff).

import type { Model, Ornament } from '../oblique.ts'
import { archNS, backOf, box, doorSlab, drum, gable, hip, leanTo, merlons, moved, recess, spire, type Solid } from '../shapes.ts'
import { banner, bird, door, lancet, lantern, laundry, moss, pots, stains, window } from '../ornaments.ts'
import { house, rows, S, solidFootprint, type HouseOpts2 } from '../kit.ts'
import { hash } from '../materials.ts'

const one = (name: string, footprint: string[], solids: Solid[], ornaments: Ornament[] = [], voids: Solid[] = []): Model => ({ name, footprint, solids, voids, ornaments })

// ------------------------------------------------------------------------------------------------ the Frostfang Coast

/** A cog at its moorings, bow east: a round-bellied hull, castles fore and aft, one mast, its sail furled or set. */
function cog(name: string, len: number, sailSet: boolean, seed: number): Model {
  const W = len * S
  const D = 3 * S
  const solids: Solid[] = []
  // the hull: its belly narrowing to the keel and the ends, its sheer rising fore and aft; a red strake, a rubbing strake
  const top = (x: number) => 30 + Math.pow(Math.abs(x - W / 2) / (W / 2), 2) * 12
  const hull = (x: number, y: number, z: number) => {
    if (x < 0 || x > W || y < 3 || y > D - 3 || z < 0 || z > top(x)) return false
    const along = Math.min(x, W - x) / (W * 0.5)
    const half = (D / 2 - 3) * Math.min(1, along * 3.2) * (0.5 + 0.5 * Math.min(1, z / 18))
    return Math.abs(y - D / 2) <= half
  }
  solids.push({ b: [0, 0, 0, W, D, 44], mat: 'darkwood', inside: hull })
  solids.push({ b: [0, 0, 6, W, D, 10], mat: 'canvasRed', inside: (x, y, z) => z >= 6 && z <= 9 && hull(x, y, z) && !hull(x, y - 1.5, z) })
  solids.push({ b: [0, 0, 26, W, D, 30], mat: 'timber', inside: (x, y, z) => z >= 26 && z <= 29 && hull(x, y, z) && !hull(x, y - 1.5, z) })
  // the castles fore and aft, their rails
  solids.push(box(6, 8, 30, 6 + S + 2, D - 8, 52, 'darkwood'), box(W - S - 8, 10, 30, W - 8, D - 10, 46, 'darkwood'))
  solids.push(merlons(6, D - 10, 6 + S + 2, D - 8, 52, 4, 3, 2, 'x', 'timber'))
  // the mast, its yard, the sail
  const mx = W * 0.52
  solids.push(drum(mx, D / 2, 2, 28, 120, 'timber'), box(mx - 2, D / 2 - 1, 108, mx + 2, D / 2 + 1, 112, 'timber'))
  if (sailSet) solids.push({ b: [mx - 26, D / 2 + 2, 60, mx + 26, D / 2 + 6, 108], mat: hash(seed, 1) < 0.5 ? 'canvasRed' : 'canvasPlain', inside: (x, y, z) => z >= 60 && Math.abs(x - mx) <= 22 + (z - 60) * 0.08 && y >= D / 2 + 2 + Math.sin(((z - 60) / 48) * Math.PI) * 2 && y <= D / 2 + 4 + Math.sin(((z - 60) / 48) * Math.PI) * 2 })
  else solids.push(box(mx - 24, D / 2 - 2, 104, mx + 24, D / 2 + 2, 108, 'canvasPlain'))
  solids.push(box(mx - 26, D / 2 - 1, 108, mx + 26, D / 2 + 1, 110, 'timber'))
  // the bowsprit, a lantern at the stern, the rigging
  solids.push(box(W - 10, D / 2 - 1, 40, W, D / 2 + 1, 42, 'timber'))
  const rig: string[] = []
  for (let j = 0; j < 70; j++) {
    let l = ''
    for (let i = 0; i < W; i++) l += Math.abs(i - (mx - (70 - j) * 0.55)) < 0.6 || Math.abs(i - (mx + (70 - j) * 0.7)) < 0.6 ? 'r' : ' '
    rig.push(l)
  }
  const orn: Ornament[] = [{ x: 0, y: D / 2, z: 40, rows: rig, keys: { r: 'n2' }, free: true }, lantern(false).at(10, D - 6, 52, true), banner(8, 14, 'U').at(mx + 1, D / 2, 120, true)]
  // shields along the rail, a name painted at the bow
  for (let x = S + 14; x < W - S - 10; x += 10) orn.push({ x, y: D - 4, z: 31, rows: [' aa ', 'aEEa', 'aEEa', ' aa '], keys: { a: 'a2', E: hash(seed, x) < 0.5 ? 'E1' : 'B1' }, free: true })
  return one(name, Array(3).fill('#'.repeat(len)), solids, orn)
}

/** The lighthouse on its headland: a tapering round tower, the gallery, the lantern lit, its cap. */
function lighthouse(): Model {
  const W = 5 * S
  const c = W / 2
  const solids: Solid[] = [drum(c, c, 30, 0, 18, 'graniteRough')]
  for (let z = 18; z < 128; z += 4) solids.push(drum(c, c, 24 - (z - 18) * 0.06, z, z + 4, Math.floor((z - 18) / 20) % 2 ? 'plasterWhite' : 'canvasRed'))
  solids.push(drum(c, c, 22, 128, 132, 'granite'), drum(c, c, 13, 132, 152, 'glassLit'), drum(c, c, 15, 152, 156, 'ironDark'), spire(c, c, 15, 156, 18, 0, 'copper'))
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2
    solids.push(box(c + Math.cos(a) * 21 - 0.6, c + Math.sin(a) * 21 - 0.6, 132, c + Math.cos(a) * 21 + 0.6, c + Math.sin(a) * 21 + 0.6, 140, 'ironDark'))
  }
  const voids: Solid[] = [...recess(c, c + 24, 0, 14, 26, 4, 'round')]
  solids.push(doorSlab(c, backOf(c + 24, 4), 0, 12, 24, 'round'))
  const orn: Ornament[] = [door(12, 24, 'round', 'g').at(c - 6, backOf(c + 24, 4) - 1, 0), window(6, 10, false, true).at(c - 3, c + 22, 60), window(6, 10, false, true).at(c - 3, c + 20, 96)]
  for (let k = 0; k < 4; k++) orn.push(bird(k % 2 === 0, k).at(c - 14 + k * 8, c, 156 + (k % 2), true))
  return one('north_lighthouse', Array(5).fill('#####'), solids, orn, voids)
}

/** A harbour warehouse: timber on a stone ground floor, its gable to the quay, the hoist beam and its loft door, snow on its roof. */
function warehouse(name: string, w: number, seed: number): Model {
  const m = house({ name, w, d: 4, upper: 1, wall: 'timber', roof: 'snowRoof', timber: false, stoneBelow: true, seed, plan: 'gable', shutters: 'cb' })
  const W = w * S
  const D = 4 * S
  const H = 48 + 44
  // the loft door under the gable, its hoist beam and rope with a bale on it
  m.solids.push(box(W / 2 - 1, D - 2, H + 18, W / 2 + 1, D + 16, H + 21, 'timber'))
  m.ornaments!.push({ x: W / 2 - 9, y: D, z: H - 6, rows: Array(22).fill('wWWWWWWWWWWWWWWWWw'), keys: { w: 'w3', W: 'w2' } })
  m.ornaments!.push({ x: W / 2 + 12, y: D + 14, z: H - 30, rows: [...Array(30).fill('  n  '), ' hhh ', 'hhhhh', 'hhhhh', ' hhh '], keys: { n: 'n2', h: 'h2' }, free: true })
  return m
}

/** A longhouse of the coast: long and low, dark timber, turf and snow on its roof, smoke, the carved dragon at its gable. */
function longhouse(name: string, w: number, seed: number): Model {
  return house({ name, w, d: 4, upper: 0, wall: 'darkwood', roof: 'snowRoof', timber: false, seed, plan: hash(seed, 3) < 0.5 ? 'eaves' : 'wingW', wing: [4, 1], shutters: 'cr', poor: false, stoneBelow: true, ivy: false })
}

/** A snow-roofed townhouse of the coast's harbour: the city's kit in the north's materials. */
function northHouse(i: number): Model {
  const r = (k: number) => hash(i, k, 333)
  const PLANS = ['eaves', 'gable', 'wingW', 'wingE', 'bay'] as const
  const o: HouseOpts2 = {
    name: `north_house_${i}`,
    w: 7 + Math.floor(r(1) * 4),
    d: r(2) < 0.4 ? 4 : 3,
    upper: r(3) < 0.35 ? 2 : 1,
    wall: ['darkwood', 'plasterBlue', 'plasterWhite', 'timber', 'plasterOchre'][Math.floor(r(4) * 5)],
    roof: 'snowRoof',
    timber: r(5) < 0.3,
    seed: 400 + i,
    plan: PLANS[Math.floor(r(6) * PLANS.length)],
    wing: [3 + Math.floor(r(7) * 2), 1],
    stoneBelow: r(8) < 0.7,
    shutters: (['cr', 'cb', 'cy', 'cg'] as const)[Math.floor(r(9) * 4)],
    bloom: undefined,
    shop: i % 3 === 0 ? { sign: (['fish', 'cup', 'key', 'cloth'] as const)[i % 4], goods: [' ff  FF  ff  F ', 'fffFFFffffFFFff', 'sssssssssssssss'], canvas: 'canvasBlue' } : undefined,
  }
  return house(o)
}

// ------------------------------------------------------------------------------------------------ the Scarred March

/** A run of palisade, sharpened stakes of uneven height, a walk inside on its posts: along x, `n` cells. */
function palisade(name: string, n: number, axis: 'x' | 'y'): Model {
  const L = n * S
  const solids: Solid[] = []
  for (let k = 0; k < L; k += 5) {
    const h = 44 + hash(k, n, 7) * 10
    const [x, y] = axis === 'x' ? [k + 2.5, S * 0.7] : [S * 0.7, k + 2.5]
    solids.push(drum(x, y, 2.6, 0, h, 'darkwood'), spire(x, y, 2.6, h, 6, 0, 'timber'))
  }
  if (axis === 'x') solids.push(box(0, S * 0.7 - 1, 30, L, S * 0.7 + 1, 33, 'timber'))
  else solids.push(box(S * 0.7 - 1, 0, 30, S * 0.7 + 1, L, 33, 'timber'))
  return one(name, axis === 'x' ? ['#'.repeat(n)] : Array(n).fill('#'), solids)
}

/** A timber watchtower: four posts braced, a platform with its rail at the top, a little hip roof, a horn hung, a banner. */
function watchtower(): Model {
  const W = 3 * S
  const solids: Solid[] = []
  for (const [x, y] of [[4, 4], [W - 4, 4], [4, W - 4], [W - 4, W - 4]]) solids.push(drum(x, y, 2.4, 0, 100, 'darkwood'))
  for (const z of [30, 62]) solids.push(box(3, W - 6, z, W - 3, W - 3, z + 2, 'timber'), box(3, 3, z, W - 3, 6, z + 2, 'timber'))
  solids.push(box(-2, -2, 76, W + 2, W + 2, 80, 'timber'))
  solids.push(box(-2, W - 1, 80, W + 2, W + 2, 90, 'timber'), box(-2, -2, 80, W + 2, 1, 90, 'timber'))
  solids.push(hip(-4, -4, W + 4, W + 4, 100, 20, 'thatch'))
  // the braces across the front, the ladder
  const brace: string[] = []
  for (let j = 0; j < 46; j++) brace.push(Array.from({ length: W - 8 }, (_, i) => (Math.abs(i - (j / 46) * (W - 8)) < 1 || Math.abs(i - (1 - j / 46) * (W - 8)) < 1 ? 'w' : ' ')).join(''))
  const orn: Ornament[] = [{ x: 4, y: W - 2, z: 30, rows: brace, keys: { w: 'w3' } }, { x: W / 2 - 3, y: W, z: 0, rows: Array(76).fill(0).map((_, j) => (j % 6 === 0 ? 'wwwwww' : 'w    w')), keys: { w: 'w2' }, free: true }, banner(10, 20, 'E').at(W - 6, W + 2, 104, true)]
  return one('march_watchtower', ['###', '###', '###'], solids, orn)
}

/** An army tent: canvas over a ridge pole, guy ropes, its flap tied back on the dark inside, a pennant on its pole. */
function tent(name: string, canvas: string, w: number, seed: number): Model {
  const W = w * S
  const D = 3 * S
  const solids: Solid[] = [gable(2, 2, W - 2, D - 2, 0, w > 3 ? 40 : 32, 'y', canvas, canvas), drum(W / 2, D / 2, 1.2, 0, (w > 3 ? 40 : 32) + 14, 'timber')]
  const voids: Solid[] = [archNS(W / 2, D - 6, D, 0, 14, 22, 'pointed')]
  const orn: Ornament[] = [{ x: W / 2 - 7, y: D - 6, z: 0, rows: Array.from({ length: 22 }, (_, j) => Array.from({ length: 14 }, (_, i) => (Math.abs(i - 7) <= (j + 1) * 0.33 ? 'n' : ' ')).join('')), keys: { n: 'n1' } }]
  orn.push(banner(8, 10, hash(seed, 2) < 0.5 ? 'E' : 'U').at(W / 2 + 1, D / 2, (w > 3 ? 40 : 32) + 12, true))
  // the guy ropes and their pegs
  for (const k of [-1, 1]) orn.push({ x: k < 0 ? 0 : W - 4, y: D - 2, z: 0, rows: ['   n', '  n ', ' n  ', 'n   '].map((r) => (k < 0 ? r : [...r].reverse().join(''))), keys: { n: 'w2' }, free: true })
  return one(name, Array(3).fill('#'.repeat(w)), solids, orn, voids)
}

/** A trebuchet at rest: its A-frames, the throwing arm cocked, the counterweight box, the sling on the ground. */
function trebuchet(): Model {
  const W = 4 * S
  const D = 3 * S
  const solids: Solid[] = [box(2, 4, 0, W - 2, 8, 6, 'darkwood'), box(2, D - 8, 0, W - 2, D - 4, 6, 'darkwood')]
  for (const y of [6, D - 6]) {
    solids.push({ b: [W / 2 - 18, y - 2, 6, W / 2 + 18, y + 2, 60], mat: 'darkwood', inside: (x, yy, z) => Math.abs(yy - y) <= 2 && Math.abs(Math.abs(x - W / 2) - (60 - z) * 0.3) < 2.5 && z >= 6 && z <= 60 })
  }
  solids.push(box(W / 2 - 1, 6, 56, W / 2 + 1, D - 6, 60, 'timber'))
  // the arm from the counterweight high to the sling end low
  solids.push({ b: [4, D / 2 - 2, 20, W - 4, D / 2 + 2, 92], mat: 'timber', inside: (x, y, z) => Math.abs(y - D / 2) <= 2 && Math.abs(z - (58 + (x - W / 2) * -0.9)) < 2.5 })
  solids.push(box(W / 2 + 14, D / 2 - 7, 30, W / 2 + 28, D / 2 + 7, 46, 'darkwood'))
  return one('march_trebuchet', ['####', '####', '####'], solids)
}

/** A flat-roofed house of the March: red sandstone, its parapet, a roof terrace with an awning, a stair up the side, slit windows. */
function marchHouse(i: number): Model {
  const r = (k: number) => hash(i, k, 555)
  const w = 5 + Math.floor(r(1) * 4)
  const d = 3
  const W = w * S
  const D = d * S
  const H = r(2) < 0.4 ? 84 : 56
  const solids: Solid[] = [box(0, 0, 0, W, D, H, r(3) < 0.5 ? 'sandstone' : 'plasterRed'), box(-1, -1, H, W + 1, D + 1, H + 3, 'sandstone')]
  solids.push(merlons(-1, D - 2, W + 1, D + 1, H + 3, 6, 5, 4, 'x', 'sandstone'))
  // the roof terrace's awning on four poles, the outside stair up the east end
  if (r(4) < 0.6) {
    const ax = W * 0.2
    for (const [x, y] of [[ax, 6], [ax + 30, 6], [ax, D - 8], [ax + 30, D - 8]]) solids.push(drum(x, y, 1, H + 3, H + 26, 'timber'))
    solids.push(leanTo(ax - 4, 2, ax + 34, D - 4, H + 22, 6, 'n', r(5) < 0.5 ? 'canvasRed' : 'canvasYellow'))
  }
  solids.push({ b: [W - 14, D, 0, W, D + 10, H], mat: 'sandstone', inside: (x, y, z) => x >= W - 14 && x <= W && y >= D && y <= D + 10 && z <= ((x - (W - 14)) / 14) * H })
  const dc = Math.floor(w / 3)
  const dcx = dc * S + S / 2
  const voids: Solid[] = [...recess(dcx, D, 0, 18, 32, 4, 'round', 2, 2)]
  solids.push(doorSlab(dcx, backOf(D, 4), 0, 14, 30, 'round'))
  const orn: Ornament[] = [...[0].map(() => stains(W, 30, 'rd', i).at(0, D, 0)), door(14, 30, 'round', 'rd').at(dcx - 7, backOf(D, 4) - 1, 0)]
  for (let c = 0; c < w - 1; c++) if (Math.abs(c - dc) > 1 && c % 2 === 0) orn.push(window(6, 12, true, r(10 + c) < 0.2, 'w3').at(c * S + 4, D, H * 0.45))
  if (r(6) < 0.5) orn.push(laundry(Math.min(W - 16, 34), i).at(4, D + 1, H - 6, true))
  if (r(7) < 0.6) orn.push(pots(12, i).at(W - 30, D, H + 3, true))
  for (let k = 0; k < 3; k++) if (r(20 + k) < 0.7) orn.push(moss(12, 4, i + k).at(r(23 + k) * (W - 14), D, 0))
  if (r(8) < 0.5) orn.push(banner(8, 22, 'E').at(W * 0.6, D, H - 30))
  const fp = solidFootprint(w, d)
  fp[d - 1][dc] = 'D'
  return { name: `march_house_${i}`, footprint: rows(fp), solids, voids, ornaments: orn }
}

// ------------------------------------------------------------------------------------------------ the Vale of Scales

/** A tower mill: a round stone tower, its cap turned into the wind, four sails of lattice and canvas, a gallery, a door. */
function windmill(name: string, seed: number): Model {
  // (the tower in the middle of a footprint wide and deep enough for its sails' picture; the cells round it open)
  const W = 7 * S
  const c = W / 2
  const H = 96
  const solids: Solid[] = [drum(c, c, 22, 0, H, hash(seed, 1) < 0.5 ? 'plasterWhite' : 'stone'), drum(c, c, 25, 0, 10, 'stone'), drum(c, c, 25, 40, 43, 'timber')]
  solids.push({ b: [c - 24, c - 24, H, c + 24, c + 24, H + 30], mat: 'thatch', inside: (x, y, z) => z >= H && Math.hypot(x - c, y - c) <= 24 * Math.cos(((z - H) / 30) * (Math.PI / 2)) + 1 })
  solids.push(box(c - 3, c + 18, H - 6, c + 3, c + 32, H + 4, 'timber'))
  const voids: Solid[] = [...recess(c, c + 22, 0, 14, 28, 3, 'round')]
  solids.push(doorSlab(c, backOf(c + 22, 3), 0, 12, 26, 'round'))
  // the sails: four lattices on their stocks, turned a little, the cloth on two
  const R = 52
  const turn = hash(seed, 2) * 0.6
  const sail: string[] = []
  for (let j = -R; j <= R; j++) {
    let l = ''
    for (let i = -R; i <= R; i++) {
      const rr = Math.hypot(i, j)
      let k = ' '
      if (rr < 4) k = 'h'
      else if (rr < R)
        for (let b = 0; b < 4; b++) {
          const a = turn + (b * Math.PI) / 2
          const along = i * Math.cos(a) + j * Math.sin(a)
          const across = -i * Math.sin(a) + j * Math.cos(a)
          if (along > 6 && Math.abs(across) < 1) k = 'h'
          else if (along > 10 && across > 1 && across < 10) k = (Math.round(along) % 6 === 0 || Math.round(across) % 4 === 0) ? 'w' : b % 2 ? 'c' : ' '
        }
      l += k
    }
    sail.push(l)
  }
  const orn: Ornament[] = [door(12, 26, 'round').at(c - 6, backOf(c + 22, 3) - 1, 0), { x: c - R, y: c + 32, z: H - 2 - R, rows: sail, keys: { h: 'w3', w: 'w1', c: 'cw1' }, free: true }, window(6, 10, false).at(c - 3, c + 21, 56), ...[0, 1].map((k) => bird(k === 1, seed + k).at(c - 10 + k * 12, c, H + 28, true))]
  return one(name, ['       ', '       ', '  ###  ', '  ###  ', '  ###  ', '       ', '       '], solids, orn, voids)
}

/** A granary on its staddle stones (the rats kept out): timber walls, a thatched roof, the loft door and hoist, sacks waiting. */
function granary(name: string, w: number, seed: number): Model {
  const W = w * S
  const D = 4 * S
  const solids: Solid[] = []
  for (let x = 6; x < W - 2; x += 18) for (const y of [6, D - 6]) solids.push(drum(x, y, 3.5, 0, 10, 'stone'), drum(x, y, 6, 10, 13, 'stone'))
  solids.push(box(0, 0, 13, W, D, 86, 'timber'), gable(-4, -4, W + 4, D + 4, 86, 40, 'x', 'thatch', 'timber'))
  for (let x = 0; x <= W; x += 12) solids.push(box(Math.min(x, W - 3), D - 1, 13, Math.min(x, W - 3) + 3, D + 1, 86, 'darkwood'))
  solids.push(box(W / 2 - 1, D - 2, 98, W / 2 + 1, D + 16, 101, 'timber'))
  const orn: Ornament[] = [{ x: W / 2 - 10, y: D + 1, z: 50, rows: Array(30).fill('wWWWWWWWWWWWWWWWWWWw'), keys: { w: 'w3', W: 'w2' }, free: true }, { x: W / 2 + 12, y: D + 14, z: 40, rows: [...Array(50).fill('  n  '), ' hhh ', 'hhhhh', 'hhhhh', ' hhh '], keys: { n: 'n2', h: 'h2' }, free: true }]
  // the steps up to its door
  solids.push({ b: [W * 0.2, D, 0, W * 0.2 + 18, D + 14, 13], mat: 'stone', inside: (x, y, z) => x >= W * 0.2 && x <= W * 0.2 + 18 && y >= D && y <= D + 14 && z <= 13 - (y - D) })
  orn.push({ x: W * 0.2 + 2, y: D, z: 13, rows: Array(30).fill('wwwwwwwwwwwwww'), keys: { w: 'w2' } })
  for (let k = 0; k < 3; k++) if (hash(seed, k) < 0.7) orn.push(moss(14, 4, seed + k).at(hash(seed, k, 2) * (W - 16), D, 13))
  const fp = solidFootprint(w, 4)
  fp[3][Math.floor(w * 0.2 + 0.5)] = 'D'
  return { name, footprint: rows(fp), solids, voids: [], ornaments: orn }
}

/** The great scales of the Vale on their stepped plinth: a bronze post, the beam, two pans on chains — one heaped with grain. */
function greatScales(): Model {
  const W = 5 * S
  const c = W / 2
  const solids: Solid[] = [box(0, 0, 0, W, W, 6, 'stone'), box(6, 6, 6, W - 6, W - 6, 12, 'stone'), box(14, 14, 12, W - 14, W - 14, 18, 'stone')]
  solids.push(drum(c, c, 3, 18, 110, 'bronze'), drum(c, c, 6, 108, 114, 'gold'), box(c - 34, c - 2, 104, c + 34, c + 2, 108, 'bronze'))
  for (const [k, low] of [[-1, 20], [1, 34]] as [number, number][]) {
    solids.push(drum(c + k * 32, c, 14, 70 - low, 74 - low, 'bronze'))
  }
  const orn: Ornament[] = []
  for (const [k, low] of [[-1, 20], [1, 34]] as [number, number][]) {
    const len = 104 - (74 - low)
    orn.push({ x: c + k * 32 - 10, y: c, z: 74 - low, rows: Array.from({ length: len }, (_, j) => Array.from({ length: 21 }, (_, i) => (Math.abs(i - 10 - (j / len) * (i < 10 ? -9 : 9)) < 0.7 && (i < 4 || i > 16 || Math.abs(i - 10) < 1) ? 'i' : ' ')).join('')), keys: { i: 'i3' }, free: true })
  }
  orn.push({ x: c + 32 - 12, y: c, z: 74 - 34 + 2, rows: ['   yyyyyyyy   ', ' yyyYyyyyYyyy ', 'yyyyyyyyyyyyyy'], keys: { y: 'h1', Y: 'h2' }, free: true })
  // the plaque on the plinth's face: a gilt frame, its lettering
  orn.push({ x: c - 12, y: W - 6, z: 1, rows: ['aaaaaaaaaaaaaaaaaaaaaaaa', 'asnnsnsnnnsnnsnsnnnsnnsa', 'asssssssssssssssssssssa ', 'aaaaaaaaaaaaaaaaaaaaaaaa'], keys: { a: 'a2', s: 's2', n: 'n2' } })
  return one('vale_scales', Array(5).fill('#####'), solids, orn)
}

/** A house of the Vale: a rich guild's (washed, tall, a stepped gable) or a poor one's (mud, thatch, low). */
function valeHouse(i: number, poor: boolean): Model {
  const r = (k: number) => hash(i, k, 777)
  return house({
    name: poor ? `vale_hovel_${i}` : `vale_house_${i}`,
    w: poor ? 6 + Math.floor(r(1) * 2) : 8 + Math.floor(r(1) * 4),
    d: 3,
    upper: poor ? 0 : r(2) < 0.5 ? 2 : 1,
    wall: poor ? (r(3) < 0.5 ? 'plasterOchre' : 'plaster') : ['plasterOchre', 'plasterWhite', 'plasterRose', 'stone'][Math.floor(r(3) * 4)],
    roof: poor ? 'thatch' : r(4) < 0.5 ? 'tile' : 'slate',
    timber: !poor && r(5) < 0.4,
    seed: 700 + i + (poor ? 50 : 0),
    plan: (['eaves', 'gable', 'wingW', 'wingE', 'bay'] as const)[Math.floor(r(6) * 5)],
    wing: [3 + Math.floor(r(7) * 2), 1],
    stoneBelow: !poor && r(8) < 0.7,
    shutters: (['cy', 'cg', 'cb', 'cr'] as const)[Math.floor(r(9) * 4)],
    poor,
    gablet: !poor && r(10) < 0.4,
    shop: !poor && i % 2 === 0 ? { sign: (['bread', 'scale', 'cloth', 'key'] as const)[i % 4], goods: [' bb  bb  bb  bb ', 'bBbbbBbbbBbbbBbb', 'oyoyoyoyoyoyoyoy'], canvas: (['canvasYellow', 'canvasGreen', 'canvasRed', 'canvasBlue'] as const)[i % 4] } : undefined,
  })
}

// ------------------------------------------------------------------------------------------------ the Pale Fens

/** A house on piles over the water: a fen house lifted on posts, a ladder down to the boardwalk, a lantern for the fog. */
function stiltHouse(i: number, name = `fen_house_${i}`, extra: Partial<HouseOpts2> = {}): Model {
  const r = (k: number) => hash(i, k, 999)
  const lift = 22
  const base = house({ name, w: 5 + Math.floor(r(1) * 3), d: 3, upper: r(2) < 0.3 ? 1 : 0, wall: r(3) < 0.5 ? 'darkwood' : 'timber', roof: r(4) < 0.6 ? 'thatch' : 'darkwood', timber: false, seed: 900 + i, plan: (['eaves', 'gable'] as const)[Math.floor(r(5) * 2)], poor: true, shutters: 'cg', ...extra })
  const W = base.footprint[0].length * S
  const D = base.footprint.length * S
  const solids = base.solids.map((s) => moved(s, 0, 0, lift))
  for (let x = 4; x < W; x += 16) for (const y of [4, D - 4]) solids.push(drum(x, y, 2.4, -6, lift, 'darkwood'))
  solids.push(box(-2, D - 6, lift - 3, W + 2, D + 6, lift, 'darkwood'))
  const orn = (base.ornaments ?? []).map((o) => ({ ...o, z: o.z + lift }))
  orn.push({ x: W * 0.3 - 4, y: D + 6, z: 0, rows: Array.from({ length: lift }, (_, j) => (j % 5 === 0 ? 'wwwwwwww' : 'w      w')), keys: { w: 'w2' }, free: true })
  orn.push(lantern(r(6) < 0.5).at(W - 12, D + 6, lift + 26, true))
  orn.push({ x: W * 0.6, y: D + 6, z: lift - 2, rows: ['  yy  ', ' yYYy ', '  yy  '], keys: { y: 'q1', Y: 'cw0' }, free: true })
  return { name, footprint: base.footprint, solids, voids: (base.voids ?? []).map((v) => moved(v, 0, 0, lift)), ornaments: orn }
}

/** The fen's ossuary chapel: low dark stone, a squat bell gable, its windows set with skulls behind iron, fog lamps at the door. */
function ossuaryChapel(): Model {
  const w = 7
  const d = 6
  const W = w * S
  const D = d * S
  const solids: Solid[] = [box(0, 0, 0, W, D, 64, 'graniteRough'), gable(-3, -3, W + 3, D + 3, 64, 30, 'y', 'darkwood', 'graniteRough')]
  solids.push(box(W / 2 - 10, D - 8, 64, W / 2 + 10, D, 110, 'graniteRough'), gable(W / 2 - 12, D - 10, W / 2 + 12, D + 1, 110, 10, 'y', 'darkwood', 'graniteRough'))
  const voids: Solid[] = [archNS(W / 2, D - 9, D + 1, 80, 10, 20, 'round'), ...recess(W / 2, D, 0, 22, 40, 5, 'pointed', 2, 2)]
  solids.push(doorSlab(W / 2, backOf(D, 5), 0, 16, 36, 'pointed'))
  const orn: Ornament[] = [stains(W, 40, 'g', 31).at(0, D, 0), door(16, 36, 'pointed', 'g').at(W / 2 - 8, backOf(D, 5) - 1, 0)]
  for (const k of [-1, 1]) {
    voids.push(...recess(W / 2 + k * 32, D, 24, 12, 22, 4, 'round'))
    orn.push({ x: W / 2 + k * 32 - 5, y: backOf(D, 4), z: 25, rows: ['iwiwiwiwii', 'woooooooow', 'io.oo.oo.i', 'wooooooooo', 'iiwiwiwiwi'].map((r) => r.slice(0, 10)), keys: { i: 'i3', w: 'pw1', o: 'pw1', '.': 'n3' } })
    orn.push(lantern(k > 0).at(W / 2 + k * 14 - 4, D, 26))
  }
  for (let k = 0; k < 4; k++) orn.push(moss(14, 5, 40 + k).at(k * 26, D, 0))
  orn.push({ x: W / 2 - 3, y: D - 8, z: 84, rows: ['  aa  ', ' aaaa ', ' aaaa ', 'aaaaaa', '  aa  '], keys: { a: 'i2' }, free: true })
  const fp = solidFootprint(w, d)
  fp[d - 1][Math.floor(w / 2)] = 'D'
  return { name: 'fen_ossuary', footprint: rows(fp), solids, voids, ornaments: orn }
}

/** A dead tree of the fen: a grey trunk, bare limbs reaching, a crow. */
function deadTree(seed: number): Model {
  // a bare grey trunk, its limbs forking twice as they reach up and out over the water, a crow on one
  const c = 1.5 * S
  const solids: Solid[] = [drum(c, S / 2, 3, 0, 28, 'darkwood'), drum(c, S / 2, 4.5, 0, 4, 'darkwood')]
  const GW = 3 * S
  const GH = 60
  const grid = Array.from({ length: GH }, () => Array(GW).fill(' '))
  const limb = (x: number, y: number, ang: number, len: number, wid: number, depth: number, k: number) => {
    for (let t = 0; t <= len; t += 0.5) {
      const px = x + Math.cos(ang) * t
      const py = y + Math.sin(ang) * t + Math.sin(t / 3 + k) * 0.6
      const w = wid * (1 - (t / len) * 0.5)
      for (let dx = -2; dx <= 2; dx++)
        for (let dy = -2; dy <= 2; dy++) {
          if (Math.hypot(dx, dy) > w) continue
          const gx = Math.round(px + dx)
          const gy = GH - 1 - Math.round(py + dy)
          if (gx >= 0 && gx < GW && gy >= 0 && gy < GH) grid[gy][gx] = dx > 0 ? 'h' : 'g'
        }
    }
    if (depth === 0) return
    const ex = x + Math.cos(ang) * len
    const ey = y + Math.sin(ang) * len
    const n = 2 + (hash(seed, k, depth) < 0.4 ? 1 : 0)
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) * 0.7 + (hash(seed * 31 + k, i, 3) - 0.5) * 0.4
      limb(ex, ey, ang + spread, len * (0.55 + hash(seed * 31 + k, i, 4) * 0.2), Math.max(0.5, wid * 0.6), depth - 1, k * 3 + i + 1)
    }
  }
  limb(GW / 2, 0, Math.PI / 2 - 0.7 + hash(seed, 1) * 0.2, 18, 2, 2, 1)
  limb(GW / 2, 3, Math.PI / 2 + 0.65 + hash(seed, 2) * 0.2, 16, 1.8, 2, 2)
  limb(GW / 2, 6, Math.PI / 2 + (hash(seed, 3) - 0.5) * 0.3, 15, 1.7, 2, 3)
  const limbs = grid.map((r) => r.join(''))
  return one(`fen_deadtree_${seed}`, [' # '], solids, [{ x: 0, y: S / 2, z: 24, rows: limbs, keys: { g: 'dw1', h: 'dw3' }, free: true }, bird(seed % 2 === 0, seed).at(c + 6, S / 2, 66, true)])
}

// ------------------------------------------------------------------------------------------------ the White Altar Heights

/** A building of the cliff monastery: white stone, a slate roof, lancets, a bell gable on the chapel; its kind by `kind`. */
function cliffBuilding(kind: 'chapel' | 'cells' | 'hall' | 'gate', seed: number): Model {
  if (kind === 'cells') return house({ name: 'altar_cells', w: 12, d: 3, upper: 1, wall: 'whiteStone', roof: 'slate', timber: false, seed, plan: 'eaves', shutters: 'cb', bloom: undefined })
  if (kind === 'hall') return house({ name: 'altar_hall', w: 10, d: 4, upper: 1, wall: 'whiteStone', roof: 'slate', timber: false, seed, plan: 'bay', wing: [4, 1], shutters: 'cb' })
  const w = kind === 'chapel' ? 11 : 5
  const d = kind === 'chapel' ? 6 : 4
  const W = w * S
  const D = d * S
  const H = kind === 'chapel' ? 72 : 76
  const solids: Solid[] = [box(0, 0, 0, W, D, H, 'whiteStone'), kind === 'chapel' ? gable(-3, -3, W + 3, D + 3, H, 46, 'x', 'slate', 'whiteStone') : gable(-3, -3, W + 3, D + 3, H, W * 0.55, 'y', 'slate', 'whiteStone')]
  for (let y = 8; y < D - 4; y += 24) for (const x of [-4, W]) solids.push(box(x, y, 0, x + 4, y + 8, H - 16, 'whiteStone'), leanTo(x - 2, y, x + 6, y + 8, H - 16, 10, x < 0 ? 'e' : 'w', 'whiteStone'))
  const voids: Solid[] = []
  const orn: Ornament[] = [stains(W, 30, 'pw', seed).at(0, D, 0)]
  if (kind === 'chapel') {
    solids.push(box(W / 2 - 14, D - 10, 0, W / 2 + 14, D, H + 64, 'whiteStone'), gable(W / 2 - 16, D - 12, W / 2 + 16, D + 1, H + 64, 14, 'y', 'slate', 'whiteStone'))
    voids.push(archNS(W / 2 - 7, D - 11, D + 1, H + 30, 9, 22, 'round'), archNS(W / 2 + 7, D - 11, D + 1, H + 30, 9, 22, 'round'))
    for (const k of [-1, 1]) orn.push({ x: W / 2 + k * 7 - 3, y: D - 5, z: H + 34, rows: ['  aa  ', ' aaaa ', ' aaaa ', 'aaaaaa'], keys: { a: 'a2' } })
    for (let x = 12; x < W - 12; x += 22) {
      if (Math.abs(x - W / 2) < 26) continue
      voids.push(...recess(x, D, 22, 10, 34, 3, 'pointed'))
      orn.push(lancet(8, 32, 'blue', 1).at(x - 4, backOf(D, 3), 22))
    }
    voids.push(...recess(W / 2, D, 46, 16, 36, 4, 'pointed', 2, 2))
    orn.push(lancet(12, 34, 'blue', 2).at(W / 2 - 6, backOf(D, 4), 47))
    voids.push(...recess(W / 2, D, 0, 24, 36, 6, 'round', 3, 3))
    solids.push(doorSlab(W / 2, backOf(D, 6), 0, 16, 32, 'round'))
    orn.push(door(16, 32, 'round', 'pw').at(W / 2 - 8, backOf(D, 6) - 1, 0))
  } else {
    voids.push(archNS(W / 2, -1, D + 2, 0, 2 * S, 50, 'round'))
    solids.push(merlons(-2, D - 3, W + 2, D + 2, H, 7, 5, 4, 'x', 'whiteStone'))
    orn.push(banner(10, 30, 'U').at(W / 2 - 5, D, H - 40))
  }
  const fp = solidFootprint(w, d)
  if (kind === 'chapel') fp[d - 1][Math.floor(w / 2)] = 'D'
  else for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) if (Math.abs((x + 0.5) * S - W / 2) < S) fp[y][x] = '.'
  return { name: kind === 'chapel' ? 'altar_chapel' : 'altar_gate', footprint: rows(fp), solids, voids, ornaments: orn }
}

/** A hermit's cell cut into the cliff's face: an arched mouth, a door of planks, a cross over it, a lamp, a ledge of pots. */
function cliffCell(seed: number): Model {
  const W = 2 * S
  const cx = S + S / 2
  const solids: Solid[] = [box(0, 0, 0, W, S, 40, 'whiteStone')]
  const voids: Solid[] = [...recess(cx, S, 0, 16, 28, 5, 'round', 2, 2)]
  solids.push(doorSlab(cx, backOf(S, 5), 0, 12, 24, 'round'))
  const orn: Ornament[] = [door(12, 24, 'round', 'pw').at(cx - 6, backOf(S, 5) - 1, 0), { x: cx - 1, y: S, z: 30, rows: [' a ', 'aaa', ' a ', ' a '], keys: { a: 'a2' } }, lantern(false).at(2, S, 18)]
  return one(`altar_cell_${seed}`, ['#D'], solids, orn, voids)
}

export const REGIONS: Record<string, () => Model> = {
  north_cog_a: () => cog('north_cog_a', 8, false, 1),
  north_cog_b: () => cog('north_cog_b', 7, true, 2),
  north_cog_c: () => cog('north_cog_c', 9, true, 3),
  north_lighthouse: lighthouse,
  north_tavern: () => house({ name: 'north_tavern', w: 11, d: 4, upper: 1, wall: 'darkwood', roof: 'snowRoof', timber: true, seed: 131, plan: 'wingE', wing: [4, 1], stoneBelow: true, shutters: 'cr', sign: 'cup' }),
  north_warehouse_a: () => warehouse('north_warehouse_a', 8, 11),
  north_warehouse_b: () => warehouse('north_warehouse_b', 7, 12),
  north_longhouse_a: () => longhouse('north_longhouse_a', 12, 21),
  north_longhouse_b: () => longhouse('north_longhouse_b', 10, 22),
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`north_house_${i}`, () => northHouse(i)])),
  ...Object.fromEntries([3, 4, 6, 8].flatMap((n) => [[`march_palisade_x${n}`, () => palisade(`march_palisade_x${n}`, n, 'x')], [`march_palisade_y${n}`, () => palisade(`march_palisade_y${n}`, n, 'y')]])),
  march_watchtower: watchtower,
  march_tent_a: () => tent('march_tent_a', 'canvasPlain', 3, 1),
  march_tent_b: () => tent('march_tent_b', 'canvasRed', 4, 2),
  march_tent_c: () => tent('march_tent_c', 'canvasYellow', 3, 3),
  march_trebuchet: trebuchet,
  // the war hall where the March's captains sit, the field hospital by the gate
  march_warhall: () => house({ name: 'march_warhall', w: 14, d: 5, upper: 2, wall: 'sandstone', roof: 'darkwood', timber: false, seed: 591, plan: 'bay', wing: [6, 1], shutters: 'cr', banner: 'E' }),
  march_hospital: () => house({ name: 'march_hospital', w: 11, d: 4, upper: 1, wall: 'plasterRed', roof: 'thatch', timber: true, seed: 592, plan: 'eaves', shutters: 'cy', sign: 'bed' }),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`march_house_${i}`, () => marchHouse(i)])),
  vale_windmill_a: () => windmill('vale_windmill_a', 1),
  vale_windmill_b: () => windmill('vale_windmill_b', 2),
  vale_granary_a: () => granary('vale_granary_a', 8, 1),
  vale_granary_b: () => granary('vale_granary_b', 6, 2),
  vale_scales: greatScales,
  // the counting house of the Black Steward's tithe, the poorhouse where the tithe leaves those it takes from
  vale_counting: () => house({ name: 'vale_counting', w: 12, d: 4, upper: 2, wall: 'stone', roof: 'slate', timber: false, seed: 741, plan: 'bay', wing: [4, 1], stoneBelow: true, shutters: 'cb', sign: 'scale', banner: 'U' }),
  vale_poorhouse: () => house({ name: 'vale_poorhouse', w: 10, d: 4, upper: 1, wall: 'plaster', roof: 'thatch', timber: true, seed: 742, plan: 'eaves', poor: true }),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`vale_house_${i}`, () => valeHouse(i, false)])),
  ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`vale_hovel_${i}`, () => valeHouse(i, true)])),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`fen_house_${i}`, () => stiltHouse(i)])),
  fen_ossuary: ossuaryChapel,
  // the fen's inn and its healer's hut: stilt houses of their own, wider, a sign by the door
  fen_inn: () => stiltHouse(41, 'fen_inn', { w: 9, upper: 1, plan: 'gable', roof: 'thatch', sign: 'bed', poor: false }),
  fen_healer: () => stiltHouse(42, 'fen_healer', { w: 6, plan: 'eaves', roof: 'thatch', sign: 'book' }),
  ...Object.fromEntries([1, 2, 3].map((k) => [`fen_deadtree_${k}`, () => deadTree(k)])),
  altar_chapel: () => cliffBuilding('chapel', 1),
  altar_gate: () => cliffBuilding('gate', 2),
  altar_cells: () => cliffBuilding('cells', 3),
  altar_hall: () => cliffBuilding('hall', 4),
  ...Object.fromEntries([1, 2].map((k) => [`altar_cell_${k}`, () => cliffCell(k)])),
}

/** The region kits' houses by name, for the maps' rows. */
export const NORTH_HOUSES = Array.from({ length: 12 }, (_, i) => `north_house_${i}`)
export const MARCH_HOUSES = Array.from({ length: 10 }, (_, i) => `march_house_${i}`)
export const VALE_HOUSES = Array.from({ length: 10 }, (_, i) => `vale_house_${i}`)
export const VALE_HOVELS = Array.from({ length: 6 }, (_, i) => `vale_hovel_${i}`)
export const FEN_HOUSES = Array.from({ length: 10 }, (_, i) => `fen_house_${i}`)
