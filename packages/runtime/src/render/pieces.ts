// A building's picture as pieces bound to what is beneath them (docs/building.md §10). A prefab is one picture over
// a block of cells; each of its solid cells is a thing of the world (a wall, with its durability and what it is made
// of). The picture is cut into a piece per cell, and each piece shows its cell as the state has it: whole, cracked as
// its wall loses durability, blackened when it burnt, gone — a hole one sees through and walks into — when its wall
// is. The renderer only reads: what a cell is now comes with the frame (its terrain and durability, `Frame.tiles`).
// Pure, so it is tested without a renderer (packages/runtime/test/pieces.test.ts).

import { T } from '../assets/ground.ts'
import type { PrefabDef } from '../assets/types.ts'

/** What a cell of the map is now, as the frame tells it (a cell it does not name is as the map's file has it). */
export interface CellNow {
  terrain: string
  hp?: number
  maxHp?: number
}

/** What the renderer is told of the terrains: which fill their cell (a wall), which are a wall burnt. */
export interface TerrainFacts {
  solid(terrain: string): boolean
  burnt(terrain: string): boolean
}

/** How a piece shows its cell: whole (its cracks 0–3, blackened or not), or gone. */
export type PieceState = { gone: true } | { gone: false; crack: 0 | 1 | 2 | 3; burnt: boolean }

/** How a piece of a building's picture is held to the map: bound to its cell's wall, or drawn whatever is there. */
export interface PieceDef {
  /** Its cell on the map. */
  x: number
  y: number
  /** Its place in the prefab's grid. */
  i: number
  j: number
  /** Bound to the wall the map's file has in its cell (its terrain): it shows that wall as it is now. */
  bound?: string
}

/** The cracks on a wall that has lost durability: none whole, then one stage a third of it at a time. */
export function crackStage(hp: number | undefined, maxHp: number | undefined): 0 | 1 | 2 | 3 {
  if (hp === undefined || !maxHp || hp >= maxHp) return 0
  const left = hp / maxHp
  return left >= 2 / 3 ? 1 : left >= 1 / 3 ? 2 : 3
}

/**
 * A stamp's pieces: one per cell of its grid. A solid cell ('#') is bound to the wall the map's file has there when
 * that fills its cell; the door, what is drawn and free ('.') and what is drawn over nothing (' ') are drawn as they
 * are. A picture laid as ground (a pool one wades into) is never cut loose from its cells.
 */
export function piecesOf(p: PrefabDef, at: { x: number; y: number }, original: (x: number, y: number) => string, facts: TerrainFacts): PieceDef[] {
  const out: PieceDef[] = []
  for (let j = 0; j < p.th; j++)
    for (let i = 0; i < p.tw; i++) {
      const x = at.x + i
      const y = at.y + j
      const t = original(x, y)
      const bound = !p.ground && p.grid[j]?.[i] === '#' && facts.solid(t) ? t : undefined
      out.push({ x, y, i, j, ...(bound && { bound }) })
    }
  return out
}

/** How a piece shows its cell now. One not bound is always whole. */
export function pieceState(piece: PieceDef, now: CellNow | undefined, facts: TerrainFacts): PieceState {
  if (!piece.bound) return { gone: false, crack: 0, burnt: false }
  const terrain = now?.terrain ?? piece.bound
  if (!facts.solid(terrain)) return { gone: true }
  return { gone: false, crack: crackStage(now?.hp, now?.maxHp), burnt: terrain !== piece.bound && facts.burnt(terrain) }
}

/**
 * The draw order of a building's pieces. Whole, the picture is drawn at its last solid row (all of it in front of
 * whoever passes behind it). Opened, it is drawn row by row, as everything that stands is: one standing in a hole
 * is behind the rows south of it and in front of those north of it.
 */
export function pieceDepth(p: PrefabDef, at: { y: number }, j: number, open: boolean): number {
  if (p.ground) return -40
  if (open) return (at.y + j + 1) * T - 2
  let last = 0
  p.grid.forEach((row, r) => /[#D]/.test(row) && (last = r))
  return (at.y + last + 1) * T - 2
}
