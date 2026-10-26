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
