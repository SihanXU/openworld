// What furnishes the showcase's streets and squares (docs/showcase.md §4): the lamps and the glow each lays on the paving
// after dark; a terrace raised a level, its balustrade along its edge and its stairs down; a parterre — a flowerbed in a
// kerb of stone with a cypress at each corner; the things set out before a house's front (a shop's crates and barrels,
// a home's urns and box balls, a bench by the wall). Every piece is a fixture of the content's (the street's furniture
// is drawn by tools/src/art/arch/buildings/street.ts).

import { rng, type Cell, type MapBuilder } from '../builder.ts'
import { BUILDINGS } from '../../../../client/src/catalog.ts'
import type { Row } from './street.ts'

/** A street lamp, its glow on the ground round it by night. */
export function lamp(b: MapBuilder, x: number, y: number, glow = 0.32): void {
  b.fixture('fixture/light/lamppost/street', x, y, { statuses: { lit: -1 } })
  b.lights.push({ x: x + 0.5, y: y + 0.9, w: 3.2, h: 2.2, color: '#ffc46b', shape: 'glow', when: 'night', strength: glow })
}

/** Lamps along a row from x0 to x1, every `every` cells, where the ground is free. */
export function lampRow(b: MapBuilder, x0: number, x1: number, y: number, every: number, skip: (x: number) => boolean = () => false): void {
  for (let x = x0; x <= x1; x += every) if (!skip(x) && free(b, x, y)) lamp(b, x, y)
}

/** Whether a cell is open ground nothing stands on (and no door's step). */
export function free(b: MapBuilder, x: number, y: number): boolean {
  if (!b.in(x, y)) return false
  const t = b.get(x, y)
  if (['wall', 'door', 'water', 'tree', 'flowerbed', 'bush', 'roof', 'void'].includes(t)) return false
  if (b.get(x, y - 1) === 'door') return false
  return !b.entities.some((e) => e.place.on === 'tile' && e.place.x === x && e.place.y === y)
}

/**
 * A terrace: the rect raised to `half` (from the ground's `from`), its top of `top`; a balustrade along its south edge
 * but where its stairs come down (each a run of cells on the row below the edge, half a level between).
 */
export function terrace(b: MapBuilder, x: number, y: number, w: number, h: number, half: number, top: string, stairs: [number, number][], from = half - 2): void {
  b.rect(x, y, w, h, top)
  b.raise(x, y, w, h, half)
  const edge = y + h - 1
  const onStair = (cx: number) => stairs.some(([sx, sw]) => cx >= sx && cx < sx + sw)
  for (const [sx, sw] of stairs) {
    b.rect(sx, edge + 1, sw, 1, top)
    b.raise(sx, edge + 1, sw, 1, from + 1)
  }
  for (let cx = x; cx < x + w; cx++) if (!onStair(cx)) b.fixture('fixture/garden/balustrade', cx, edge)
  // an urn on the balustrade's ends either side of each stair
  for (const [sx, sw] of stairs) for (const ux of [sx - 1, sx + sw]) if (ux >= x && ux < x + w) {
    b.entities = b.entities.filter((e) => !(e.place.on === 'tile' && e.place.x === ux && e.place.y === edge))
    b.fixture('fixture/garden/urn', ux, edge)
  }
}

/** A parterre: a flowerbed in a kerb of the ground round it, a cypress at each corner, a box ball at each side's middle. */
export function parterre(b: MapBuilder, x: number, y: number, w: number, h: number): void {
  b.rect(x + 1, y + 1, w - 2, h - 2, 'flowerbed')
  for (const [cx, cy] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]] as Cell[]) b.fixture('fixture/garden/cypress', cx, cy)
  for (const [cx, cy] of [[x + Math.floor(w / 2), y], [x + Math.floor(w / 2), y + h - 1]] as Cell[]) if (w > 4) b.fixture('fixture/garden/topiary', cx, cy)
}

/**
 * The things set out before a row's fronts, on the street's first row: a shop's goods and casks either side of its
 * arch, a home's urn or box ball by its door, a bench against a blank wall now and then — never on a door's step.
 */
export function frontage(b: MapBuilder, row: Row, poor = false): void {
  row.doors.forEach((d, i) => {
    const m = BUILDINGS[d.prefab]
    const [fx, fy] = row.fronts[i]
    const dx = m.doors[0]?.[0] ?? 0
    const x0 = fx - dx
    const y = fy
    const put = (type: string, x: number) => free(b, x, y) && x !== fx && b.fixture(type, x, y)
    if (poor) {
      if (rng.chance(0.5)) put(rng.pick(['fixture/container/barrel', 'fixture/container/crate', 'fixture/container/pot']), x0 + (rng.chance(0.5) ? 0 : m.w - 1))
      return
    }
    if (d.role === 'shop') {
      // the shop's arch is beside the door: its wares spill out there
      const east = dx + 3 <= m.w - 2
      const sx = east ? fx + 2 : fx - 4
      put(rng.pick(['fixture/container/crate', 'fixture/container/barrel']), east ? sx + 3 : sx - 1)
      if (rng.chance(0.6)) put('fixture/container/sack', east ? sx + 3 : sx - 1)
      put('fixture/garden/topiary', fx - 1)
    } else {
      put(rng.chance(0.5) ? 'fixture/garden/urn' : 'fixture/garden/topiary', fx - 1)
      put(rng.chance(0.5) ? 'fixture/garden/urn' : 'fixture/garden/topiary', fx + 1)
      if (m.w > 8 && rng.chance(0.5)) put('fixture/garden/bench', x0 + m.w - 3)
    }
  })
}

/** A pavement before a row's fronts: `rows` of flags under the houses, the street's ground beyond. */
export function pavement(b: MapBuilder, x0: number, x1: number, y: number, rows = 1, t = 'flags'): void {
  for (let j = y; j < y + rows; j++) for (let x = x0; x <= x1; x++) if (b.in(x, j) && !['wall', 'door', 'water'].includes(b.get(x, j))) b.set(x, j, t)
}

// ---------------------------------------------------------------------------------------------- the clutter
// Maximalist (the user's ask of 2026-10-25): every front, corner and stretch of paving holds something. The clutter is
// the decor kit's pictures (art/arch/buildings/decor.ts) stamped on the map, never things: it costs the engine nothing.
// What stands keeps to the walls' feet and the squares' edges, never a doorstep, an anchor or the cells beside a door;
// what hangs stands on two posts along the fronts; what lies on the ground lies anywhere one walks.

const SOLID_GROUND = new Set(['wall', 'water', 'tree', 'thornhedge', 'flowerbed', 'void', 'door'])
const PAVED = new Set(['flags', 'paving', 'plaza', 'cobble', 'flagstone', 'dirt', 'mud', 'path'])
/** The cells a map's decals already lie on (a cell takes one). */
const strewn = new WeakMap<MapBuilder, Set<string>>()

/** Whether a picture of `w` cells standing at (x, y) keeps clear of doors, anchors and what is there. */
function room(b: MapBuilder, x: number, y: number, w: number): boolean {
  // (never by a map's edge, where its ways in come: a road out stays a road)
  if (y < 2 || y > b.h - 4 || x < 2 || x + w > b.w - 2) return false
  const near = Object.values(b.anchors ?? {}).some(([ax, ay]) => Math.abs(ax - x - (w - 1) / 2) <= w / 2 + 1 && Math.abs(ay - y) <= 1)
  if (near) return false
  for (let i = x; i < x + w; i++) {
    if (!free(b, i, y) || !PAVED.has(b.get(i, y)) && b.get(i, y) !== 'grass') return false
    for (const dx of [-1, 0, 1]) if (b.get(i + dx, y - 1) === 'door' || b.get(i + dx, y) === 'door') return false
    if (b.get(i, y + 1) === 'door') return false
  }
  return true
}

/** Whether a cell's wall is a fence's (a run of `rail`, `fence` or `stonewall` stamped as scenery). */
function isFence(b: MapBuilder, x: number, y: number): boolean {
  return b.stamps.some((s) => s.x === x && s.y === y && /^(rail|fence|stonewall)_/.test(s.key))
}

/** The quarter's sort, which sets what it piles against its walls. */
export type Sort = 'city' | 'market' | 'poor' | 'close'
const PILES: Record<Sort, string[]> = {
  city: ['decor_flowerstand', 'decor_flowerstand', 'decor_orange', 'decor_orange', 'decor_planter', 'decor_planter', 'decor_casks', 'decor_crates', 'decor_column', 'decor_bollards', 'decor_amphorae', 'decor_pump', 'decor_signpost', 'decor_birdbath'],
  market: ['decor_casks', 'decor_casks_row', 'decor_crates', 'decor_crates_row', 'decor_sacks', 'decor_amphorae', 'decor_cart', 'decor_flowerstand', 'decor_hay', 'decor_orange'],
  poor: ['decor_casks', 'decor_crates', 'decor_sacks', 'decor_firewood', 'decor_hay', 'decor_amphorae', 'decor_cart'],
  close: ['decor_orange', 'decor_planter', 'decor_birdbath', 'decor_amphorae', 'decor_flowerstand'],
}

/** What the decor took on a map, cell by cell: its stamps and the ground its standing cells had (for `unshut`). */
const placed = new WeakMap<MapBuilder, Map<string, { stamps: MapBuilder['stamps']; cells: [number, number, string][] }>>()

/** Stamp a decor picture, keeping what it took. */
function stampDecor(b: MapBuilder, name: string, x: number, y: number): void {
  const m = BUILDINGS[name]
  const cells: [number, number, string][] = []
  for (const s of m.slices) [...s.grid[s.grid.length - 1]].forEach((c, i) => c === '#' && cells.push([x + s.col + i, y + s.row, b.get(x + s.col + i, y + s.row)]))
  const n = b.stamps.length
  b.building(name, x, y)
  const rec = { stamps: b.stamps.slice(n), cells }
  const map = placed.get(b) ?? new Map()
  placed.set(b, map)
  for (const [cx, cy] of cells) map.set(`${cx},${cy}`, rec)
}

/** Stamp a decor picture if it has room; whether it did. */
export function decor(b: MapBuilder, name: string, x: number, y: number): boolean {
  const m = BUILDINGS[name]
  if (!m || !room(b, x, y, m.w)) return false
  stampDecor(b, name, x, y)
  return true
}

/**
 * Every door led out again: a door whose step cannot reach the map's edges (the roofs' hidden ground walled round it, a
 * pile of casks in the way) has the fewest such cells opened along its way out — the hidden ground given back, the
 * decor taken away. Laid last, before the map grows.
 */
export function unshut(b: MapBuilder): void {
  const W = b.w
  const H = b.h
  const id = (x: number, y: number) => y * W + x
  const decorAt = placed.get(b) ?? new Map()
  const opened = (x: number, y: number) => b.covered.has(`${x},${y}`) || decorAt.has(`${x},${y}`)
  // (the open map: the largest stretch of ground one can walk, the streets and squares every way in comes onto)
  const flood = () => {
    const seen = new Int32Array(W * H).fill(-1)
    let best = -1
    let bestSize = 0
    let n = 0
    for (let s0 = 0; s0 < W * H; s0++) {
      if (seen[s0] >= 0 || !b.passable(s0 % W, Math.floor(s0 / W))) continue
      const q = [s0]
      seen[s0] = n
      let size = 0
      while (q.length) {
        const k = q.pop()!
        size++
        const x = k % W
        const y = (k - x) / W
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[id(nx, ny)] >= 0 || !b.passable(nx, ny)) continue
          seen[id(nx, ny)] = n
          q.push(id(nx, ny))
        }
      }
      if (size > bestSize) (bestSize = size), (best = n)
      n++
    }
    const main = new Uint8Array(W * H)
    for (let k = 0; k < W * H; k++) if (seen[k] === best) main[k] = 1
    return main
  }
  // (what stands in the way that may be moved aside: the casks, crates, sacks and racks a street is cluttered with)
  const MOVABLE = /^fixture\/(container\/(barrel|crate|sack|pot)|furniture\/(rack|cart|bench|washing_line)|light\/lantern|garden\/(urn|topiary)|nature)/
  const moveable = (x: number, y: number) => b.entities.find((e) => e.place.on === 'tile' && e.place.x === x && e.place.y === y && MOVABLE.test(e.type))
  let main = flood()
  for (let y = 0; y < H - 1; y++)
    for (let x = 0; x < W; x++) {
      if (b.get(x, y) !== 'door' || main[id(x, y + 1)]) continue
      // the cheapest way from the step to the open map: walkable cells free, hidden ground and decor one each
      const cost = new Float64Array(W * H).fill(Infinity)
      const from = new Int32Array(W * H).fill(-1)
      const dq: number[] = [id(x, y + 1)]
      cost[id(x, y + 1)] = 0
      let goal = -1
      while (dq.length) {
        let bi = 0
        for (let i = 1; i < dq.length; i++) if (cost[dq[i]] < cost[dq[bi]]) bi = i
        const k = dq.splice(bi, 1)[0]
        if (main[k]) {
          goal = k
          break
        }
        const kx = k % W
        const ky = (k - kx) / W
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = kx + dx
          const ny = ky + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const step = b.passable(nx, ny) ? 0 : opened(nx, ny) ? 1 : moveable(nx, ny) && !SOLID_GROUND.has(b.get(nx, ny)) ? 2 : Infinity
          const c = cost[k] + step + 0.001
          if (c >= cost[id(nx, ny)]) continue
          cost[id(nx, ny)] = c
          from[id(nx, ny)] = k
          dq.push(id(nx, ny))
        }
      }
      if (goal < 0) continue
      for (let k = goal; k >= 0; k = from[k]) {
        const kx = k % W
        const ky = (k - kx) / W
        const key = `${kx},${ky}`
        if (b.covered.has(key)) {
          b.set(kx, ky, b.covered.get(key)!)
          b.covered.delete(key)
        }
        const thing = moveable(kx, ky)
        if (thing && !b.passable(kx, ky)) b.entities = b.entities.filter((e) => e !== thing)
        const rec = decorAt.get(key)
        if (rec) {
          b.stamps = b.stamps.filter((s) => !rec.stamps.includes(s))
          for (const [cx, cy, t] of rec.cells) (b.set(cx, cy, t), decorAt.delete(`${cx},${cy}`))
        }
      }
      main = flood()
    }
}

/** Things piled against every wall's foot in the rect (each cell a chance `p`), from the sort's list. */
export function piles(b: MapBuilder, x0: number, y0: number, w: number, h: number, sort: Sort, p = 0.55): void {
  const list = PILES[sort]
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      // (a building's wall, never a fence's or a yard's: nothing is heaped against a field wall)
      if (b.get(x, y - 1) !== 'wall' || isFence(b, x, y - 1) || !rng.chance(p)) continue
      const name = rng.pick(list)
      if (decor(b, name, x, y)) x += BUILDINGS[name].w
    }
}

/** Flags, lanterns or washing on posts along the row in front of the walls, between the doors (each span a chance). */
export function festoons(b: MapBuilder, x0: number, x1: number, y: number, kinds: ('flags' | 'lanterns' | 'washing')[], p = 0.7): void {
  let x = x0
  while (x < x1) {
    const w = rng.pick([4, 5, 6, 8])
    const name = `decor_${rng.pick(kinds)}_${w}`
    const posts = [x, x + w - 1]
    const ok = x + w <= x1 && posts.every((px) => room(b, px, y, 1)) && rng.chance(p)
    if (ok) {
      stampDecor(b, name, x, y)
      x += w + 1
    } else x += 1
  }
}

/** What lies underfoot over the rect's paving: petals, leaves, puddles, cracks, a drain, pigeons, a cat (each cell `p`). */
export function strew(b: MapBuilder, x0: number, y0: number, w: number, h: number, p = 0.12, sort: Sort = 'city'): void {
  const seen = strewn.get(b) ?? new Set<string>()
  strewn.set(b, seen)
  const LIE: [string, number][] =
    sort === 'poor'
      ? [['decor_puddle_0', 3], ['decor_puddle_1', 3], ['decor_puddle_2', 2], ['decor_straw', 4], ['decor_leaves_0', 2], ['decor_cracks_0', 0.4], ['decor_pigeons_1', 2], ['decor_pigeons_0', 2], ['decor_cat', 1]]
      : [['decor_petals_0', 5], ['decor_petals_1', 5], ['decor_petals_2', 4], ['decor_leaves_0', 0.6], ['decor_leaves_1', 0.6], ['decor_cracks_0', 0.2], ['decor_puddle_0', 1.2], ['decor_puddle_1', 1.2], ['decor_grate', 0.3], ['decor_manhole', 0.2], ['decor_pigeons_0', 1], ['decor_pigeons_1', 0.6], ['decor_pigeons_2', 0.3], ['decor_cat', 0.3], ['decor_chalk', 0.2]]
  const total = LIE.reduce((n, [, k]) => n + k, 0)
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      if (seen.has(`${x},${y}`) || !PAVED.has(b.get(x, y)) || !rng.chance(p)) continue
      let t = rng.next() * total
      const name = LIE.find(([, k]) => (t -= k) < 0)![0]
      const wide = BUILDINGS[name]?.w ?? 1
      if (!BUILDINGS[name] || (wide > 1 && (!PAVED.has(b.get(x + 1, y)) || seen.has(`${x + 1},${y}`)))) continue
      b.building(name, x, y)
      for (let i = 0; i < wide; i++) seen.add(`${x + i},${y}`)
    }
}

/** A row's fronts filled: piles at the walls' feet, festoons over the pavement. */
export function busyRow(b: MapBuilder, row: Row, x0: number, x1: number, sort: Sort): void {
  for (const sp of row.spans) piles(b, Math.max(x0, sp.x0), sp.y, Math.min(x1, sp.x1) - Math.max(x0, sp.x0), row.line + 2 - sp.y, sort, sort === 'poor' ? 0.45 : 0.6)
  if (!row.spans.length) return
  const fx0 = Math.max(x0, Math.min(...row.spans.map((s) => s.x0)))
  const fx1 = Math.min(x1, Math.max(...row.spans.map((s) => s.x1)))
  festoons(b, fx0, fx1, row.line + 1, sort === 'poor' ? ['washing'] : sort === 'market' ? ['flags', 'lanterns'] : ['flags', 'lanterns', 'washing'], sort === 'poor' ? 0.35 : 0.4)
}

/** A square's paving laid in panels: a band of flags every `step` cells each way over its paving (a plaza's grid). */
export function panels(b: MapBuilder, x0: number, y0: number, w: number, h: number, step = 6, t = 'flags'): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (b.get(x, y) === 'paving' && ((x - x0) % step === 0 || (y - y0) % step === 0)) b.set(x, y, t)
}
