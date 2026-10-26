// The plans of the showcase's halls (docs/showcase.md §4): a hall's cells, shared by its walls' art (shell.ts) and its
// map (demo/showcase), so the walls drawn and the floor laid are one plan. A plan is drawn from rectangles of floor
// carved out of wall; what lies more than a few cells from any floor is the dark beyond.

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** A plan W by H: every cell wall, the rects carved to floor ('.'), the wall far from any floor made nothing (' '). */
export function carve(W: number, H: number, floors: Rect[], reach = 2): string[] {
  const g = Array.from({ length: H }, () => Array(W).fill('#'))
  for (const r of floors) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y][x] = '.'
  const near = (x: number, y: number) => {
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) if (g[y + dy]?.[x + dx] === '.') return true
    return false
  }
  return g.map((row, y) => row.map((c, x) => (c === '#' && !near(x, y) ? ' ' : c)).join(''))
}

/**
 * The nave of Sunwell Abbey's church (35 by 62, its axis the middle of column 17): the apse at its head with its great
 * window, the raised chancel and the choir before it, the transept with a rose in each arm's wall, four chapels off the
 * nave's sides, the narthex at the west door. `TOP` rows of the dark over the apse (its face is tall).
 */
export const NAVE = (() => {
  const TOP = 9
  const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y: y + TOP, w, h })
  const parts = {
    apse: R(12, 7, 11, 8),
    choir: R(9, 11, 17, 7),
    transept: R(2, 18, 31, 8),
    nave: R(7, 26, 21, 23),
    chapelW1: R(4, 30, 3, 5),
    chapelW2: R(4, 39, 3, 5),
    chapelE1: R(28, 30, 3, 5),
    chapelE2: R(28, 39, 3, 5),
    narthex: R(12, 49, 11, 3),
    door: R(17, 52, 1, 1),
  }
  const plan = carve(35, 53 + TOP, Object.values(parts))
  return { TOP, parts, plan, axis: 17, door: [17, 52 + TOP] as [number, number] }
})()

/** A hall's plan: its rects (offset by `TOP` rows of the dark its tallest face rises into), the plan, its door cells. */
export interface HallPlan {
  TOP: number
  parts: Record<string, Rect>
  plan: string[]
  doors: [number, number][]
}

function hallPlan(W: number, H: number, TOP: number, parts: Record<string, [number, number, number, number]>, doors: [number, number][]): HallPlan {
  const rects = Object.fromEntries(Object.entries(parts).map(([k, [x, y, w, h]]) => [k, { x, y: y + TOP, w, h }])) as Record<string, Rect>
  const ds = doors.map(([x, y]) => [x, y + TOP] as [number, number])
  const plan = carve(W, H + TOP, [...Object.values(rects), ...ds.map(([x, y]) => ({ x, y, w: 1, h: 1 }))])
  return { TOP, parts: rects, plan, doors: ds }
}

/**
 * The plans of the showcase's other halls (docs/showcase.md §4; the user's word of 2026-10-26: "内饰怎么全是方块"): each its
 * own shape — alcoves and bays, a dais, a nook for the hearth, rooms off a room — so its walls step in and out as the
 * nave's do, and every step is a face to dress.
 */
export const HALLS = {
  crypt: hallPlan(26, 16, 5, { hall: [4, 3, 18, 10], apse: [10, 1, 6, 2], bayW1: [1, 4, 3, 3], bayW2: [1, 9, 3, 3], bayE1: [22, 4, 3, 3], bayE2: [22, 9, 3, 3], entry: [11, 13, 4, 2] }, [[12, 15], [13, 15]]),
  belfry: hallPlan(14, 15, 7, { chamber: [2, 3, 10, 9], landing: [5, 12, 4, 2] }, [[6, 14], [7, 14]]),
  library: hallPlan(30, 18, 8, { hall: [3, 4, 24, 11], bay1: [6, 2, 4, 2], bay2: [13, 2, 4, 2], bay3: [20, 2, 4, 2], alcoveW: [1, 7, 2, 4], alcoveE: [27, 7, 2, 4], entry: [13, 15, 4, 2] }, [[14, 17]]),
  refectory: hallPlan(27, 16, 7, { hall: [2, 4, 22, 10], pulpit: [4, 2, 3, 2], dais: [9, 2, 8, 2], hatch: [24, 6, 2, 4], entry: [11, 14, 4, 1] }, [[13, 15]]),
  greathall: hallPlan(28, 19, 9, { hall: [2, 5, 24, 12], dais: [9, 2, 10, 3], bayW: [1, 8, 1, 4], bayE: [26, 8, 1, 4], entry: [11, 17, 6, 1] }, [[13, 18], [14, 18]]),
  solar: hallPlan(24, 14, 7, { chamber: [2, 3, 9, 9], study: [13, 5, 8, 7], passage: [11, 7, 2, 2], closet: [21, 6, 2, 3] }, []),
  council: hallPlan(26, 17, 8, { hall: [2, 5, 22, 10], dais: [8, 2, 10, 3], entry: [10, 15, 6, 1] }, [[12, 16], [13, 16]]),
  markethall: hallPlan(28, 17, 6, { hall: [2, 4, 24, 11], bay: [10, 2, 8, 2], entry: [11, 15, 6, 1] }, [[13, 16], [14, 16]]),
  inn: hallPlan(26, 17, 6, { common: [2, 4, 16, 10], hearth: [6, 2, 6, 2], dorm: [19, 4, 5, 10], arch: [18, 9, 1, 4], entry: [8, 14, 4, 2] }, [[9, 16]]),
  tavern: hallPlan(20, 14, 5, { main: [2, 3, 12, 8], nook: [14, 5, 4, 5], hearth: [5, 1, 4, 2], entry: [6, 11, 4, 2] }, [[7, 13]]),
  // the regions' places (docs/showcase.md §4b): Rimeholm's tavern, boathouse and longhall; Warcombe's war hall, armoury and
  // field hospital; Weighmarket's counting house, granary and poorhouse; Dusk Moorings' ossuary, healer's hut and inn;
  // Highheath's chapel and the catacombs under it
  seatavern: hallPlan(24, 15, 6, { main: [2, 3, 14, 9], snug: [17, 5, 5, 6], arch: [16, 7, 1, 3], hearth: [6, 1, 5, 2], entry: [8, 12, 4, 2] }, [[9, 14]]),
  boathouse: hallPlan(30, 17, 7, { slip: [2, 3, 26, 11], loft: [3, 1, 7, 2], store: [21, 1, 6, 2], entry: [12, 14, 6, 2] }, [[14, 16]]),
  longhall: hallPlan(32, 18, 8, { hall: [2, 4, 28, 10], dais: [11, 1, 10, 3], bayW: [1, 7, 1, 4], bayE: [30, 7, 1, 4], entry: [13, 14, 6, 3] }, [[15, 17]]),
  warhall: hallPlan(28, 17, 8, { hall: [2, 4, 24, 10], dais: [9, 1, 10, 3], bayW: [1, 7, 1, 4], bayE: [26, 7, 1, 4], entry: [11, 14, 6, 2] }, [[13, 16]]),
  armoury: hallPlan(24, 15, 6, { hall: [2, 3, 20, 9], forge: [8, 1, 7, 2], entry: [9, 12, 5, 2] }, [[11, 14]]),
  hospital: hallPlan(28, 16, 6, { ward: [2, 3, 24, 9], shrine: [11, 1, 6, 2], entry: [11, 12, 6, 3] }, [[13, 15]]),
  counting: hallPlan(26, 15, 7, { hall: [2, 4, 22, 8], clerks: [3, 2, 7, 2], strong: [17, 1, 6, 3], entry: [10, 12, 6, 2] }, [[12, 14]]),
  granary: hallPlan(30, 17, 6, { floor: [2, 3, 26, 11], bayW: [1, 6, 1, 4], bayE: [28, 6, 1, 4], entry: [12, 14, 6, 2] }, [[14, 16]]),
  poorhouse: hallPlan(24, 15, 5, { hall: [2, 3, 20, 9], kitchen: [3, 1, 6, 2], entry: [9, 12, 5, 2] }, [[11, 14]]),
  ossuary: hallPlan(22, 16, 6, { nave: [3, 3, 16, 10], apse: [8, 1, 6, 2], entry: [9, 13, 4, 2] }, [[10, 15]]),
  healer: hallPlan(18, 13, 5, { hut: [2, 3, 14, 7], entry: [7, 10, 4, 2] }, [[8, 12]]),
  stiltinn: hallPlan(26, 16, 6, { common: [2, 3, 16, 10], rooms: [19, 3, 5, 10], arch: [18, 6, 1, 3], hearth: [6, 1, 5, 2], entry: [8, 13, 4, 2] }, [[9, 15]]),
  chapel: hallPlan(30, 19, 9, { nave: [5, 5, 20, 10], apse: [11, 2, 8, 3], chapelW: [2, 8, 3, 4], chapelE: [25, 8, 3, 4], entry: [12, 15, 6, 3] }, [[14, 18]]),
  // the farm's barn, farmhouse and mill; the mine's workings and the old works under them (docs/showcase.md §4c)
  barn: hallPlan(28, 16, 7, { floor: [2, 3, 24, 10], loft: [3, 1, 8, 2], entry: [11, 13, 6, 2] }, [[13, 15]]),
  farmhouse: hallPlan(26, 15, 6, { kitchen: [2, 3, 14, 9], parlour: [17, 4, 7, 7], arch: [16, 6, 1, 3], hearth: [5, 1, 6, 2], entry: [8, 12, 4, 2] }, [[9, 14]]),
  mill: hallPlan(24, 15, 7, { floor: [2, 3, 20, 9], race: [16, 1, 5, 2], entry: [9, 12, 5, 2] }, [[11, 14]]),
  workings: hallPlan(58, 40, 5, { entry: [25, 33, 8, 5], main: [27, 6, 4, 27], westLow: [6, 24, 21, 3], eastMid: [31, 18, 20, 3], westHigh: [8, 10, 19, 3], eastHigh: [31, 7, 22, 3], stopeW: [3, 18, 8, 6], stopeE: [47, 21, 9, 8], cavern: [3, 3, 10, 7], winze: [50, 2, 6, 5], sump: [12, 29, 12, 6], drift: [16, 27, 3, 2] }, [[28, 38]]),
  oldworks: hallPlan(50, 38, 7, { landing: [22, 31, 6, 5], way: [23, 18, 4, 13], hall: [10, 8, 30, 10], gate: [20, 2, 10, 6], forge: [2, 10, 7, 6], forgeDoor: [9, 12, 1, 2], vault: [41, 10, 7, 6], vaultDoor: [40, 12, 1, 2], tombW: [12, 20, 8, 6], tombWDoor: [20, 22, 3, 2], tombE: [30, 20, 8, 6], tombEDoor: [27, 22, 3, 2] }, []),
  catacombs: hallPlan(30, 20, 5, { north: [3, 2, 24, 3], south: [3, 13, 24, 3], west: [3, 5, 3, 8], east: [24, 5, 3, 8], spine: [13, 5, 4, 8], tombW: [7, 7, 5, 4], passW: [6, 8, 1, 2], tombE: [18, 7, 5, 4], passE: [23, 8, 1, 2], entry: [13, 16, 4, 3] }, []),
}
