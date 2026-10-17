// The cells a kit skill marks (docs/skills.md): one geometry for the minor monsters and the bosses. What is marked
// when the wind-up begins is what lands; the landing works the cells out again from the same locked origin and aim.

import type { Engine, Entity, KitSkill, Pos } from '@openworld/engine'

/** The axis of a cell from another: one step along the greater axis (down when they are the same cell). */
export function axis(from: Pos, to: Pos): [number, number] {
  const dx = to.x - from.x, dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return [Math.sign(dx), 0]
  return [0, Math.sign(dy) || 1]
}

/**
 * The cell of a caster's body nearest a point: a large body (the dragon's 2x2, the knight's 3x2) reaches, aims and
 * winds up from its edge facing its foe, never from a corner of itself. One cell: the caster's own.
 */
export function edgeOf(eng: Engine, e: Entity, pos: Pos, at: Pos): Pos {
  const cells = eng.world.occupiedCells(e, pos.x, pos.y)
  const xs = cells.map(([x]) => x), ys = cells.map(([, y]) => y)
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  return { ...pos, x: clamp(at.x, Math.min(...xs), Math.max(...xs)), y: clamp(at.y, Math.min(...ys), Math.max(...ys)) }
}

/** Where a skill is wound up from: a line, a cone or a dash from the body's edge facing its foe; a disk round the body's anchor. */
export function originOf(eng: Engine, e: Entity, skill: KitSkill, pos: Pos, at: Pos): Pos {
  return skill.shape === 'line' || skill.shape === 'cone' || skill.move === 'dash' ? edgeOf(eng, e, pos, at) : pos
}

/** A disk of cells round a centre (`r` 0: the centre alone; 1: the eight round it too). */
const disk = (r: number, x: number, y: number) => x * x + y * y <= r * r + r

/** The cells a skill marks, wound up at `origin` against a foe at `aim` (before the map's bounds and its sight). */
export function pattern(skill: KitSkill, origin: Pos, aim: Pos): [number, number][] {
  const [vx, vy] = axis(origin, aim)
  const r = skill.radius
  const out: [number, number][] = []
  const seen = new Set<string>()
  const add = (x: number, y: number) => {
    const k = `${x},${y}`
    if (!seen.has(k)) (seen.add(k), out.push([x, y]))
  }
  if (skill.shape === 'line') {
    // `width` wide, centred on the axis, from the cell before it to `radius` out
    const half = Math.max(0, Math.floor(((skill.width ?? 1) - 1) / 2))
    for (let i = 1; i <= r; i++) for (let s = -half; s <= half; s++) add(origin.x + vx * i + vy * s, origin.y + vy * i + vx * s)
    return out
  }
  const c = skill.aim === 'self' ? origin : aim
  if (skill.shape === 'spots') {
    // the centre and the four cells `radius` out along the axes, each a disk of `spot`
    const s = skill.spot ?? 0
    for (const [cx, cy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]])
      for (let y = -s; y <= s; y++) for (let x = -s; x <= s; x++) if (disk(s, x, y)) add(c.x + cx + x, c.y + cy + y)
    return out
  }
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const forward = x * vx + y * vy, side = Math.abs(x * vy - y * vx)
      const hit =
        skill.shape === 'circle' ? disk(r, x, y)
        : skill.shape === 'ring' ? Math.max(Math.abs(x), Math.abs(y)) === r
        : skill.shape === 'cross' ? x === 0 || y === 0
        : forward >= 1 && side <= Math.ceil(forward / 2)
      // a disk or a cross around itself spares its own cell
      if (hit && !(skill.aim === 'self' && skill.shape !== 'cone' && x === 0 && y === 0)) add(c.x + x, c.y + y)
    }
  return out
}

/** The minor monsters' name for the same geometry. */
export const kitPattern = pattern

/**
 * The cells a skill marks on its map: within the bounds, and for a skill that `occlude`s, only those it sees from where it
 * wound up and something could stand on (a rock, a wall, a pillar shelters what lies behind it).
 */
export function cellsOf(eng: Engine, skill: KitSkill, origin: Pos, aim: Pos): [number, number][] {
  const w = eng.world
  const map = origin.map
  return pattern(skill, origin, aim).filter(([x, y]) => w.inBounds(map, x, y)
    && (!skill.occlude || (w.passable(map, x, y) && eng.lineOfSight(map, origin, { map, x, y }))))
}
