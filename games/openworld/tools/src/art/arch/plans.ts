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
}
