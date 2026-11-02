// The main line's sets on the demo's maps (docs/sets.md): every piece content says lies on a map (`from: map:<id>`) is
// laid there, one to a spot — on someone's bones, or in a chest — at the cells each chapter's file chooses, the nearest
// open cell that is no door, no way off and not before one. Laid after a map is built, so no other thing's id moves.

import { piecesOnMap, type SetPiece } from '@openworld-game/content'
import type { Text } from '@openworld/engine'
import type { Cell, MapBuilder } from '../builder.ts'
import { CH1_SPOTS } from './ch1.ts'
import { CH2_SPOTS } from './ch2.ts'
import { CH3_SPOTS } from './ch3.ts'
import { CH4_SPOTS } from './ch4.ts'
import { CH5_SPOTS } from './ch5.ts'
import { FIN_SPOTS } from './fin.ts'

/** Where a piece lies: near a cell, on bones (by default) or in a chest, under a name of its own. */
export interface Spot {
  at: Cell
  kind?: 'bones' | 'chest'
  name?: Text
}

/** Each map's spots, one for each piece content lays there, in the order of its pieces (gearsets MAIN_SETS). */
export const SET_SPOTS: Record<string, Spot[]> = { ...CH1_SPOTS, ...CH2_SPOTS, ...CH3_SPOTS, ...CH4_SPOTS, ...CH5_SPOTS, ...FIN_SPOTS }

const BONES = 'fixture/remains/bones'
const CHEST = 'fixture/container/chest'

/** The nearest cell to (x, y) a thing may lie on: open, no door, no way off a map, and not beside one. */
function restingCell(m: MapBuilder, x: number, y: number): Cell {
  const doorish = (cx: number, cy: number) => m.get(cx, cy) === 'door' || m.portals.some((p) => p.x === cx && p.y === cy)
  for (let r = 0; r <= 10; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const [cx, cy] = [x + dx, y + dy]
        if (!m.free(cx, cy) || doorish(cx, cy)) continue
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => doorish(cx + ax, cy + ay))) continue
        return [cx, cy]
      }
  throw new Error(`no resting cell near ${m.id}:${x},${y}`)
}

/** Lay each map's pieces (the ones content puts on it) on its spots. */
export function laySetPieces(builders: MapBuilder[]): void {
  for (const m of builders) {
    const pieces: SetPiece[] = piecesOnMap(m.id)
    const spots = SET_SPOTS[m.id] ?? []
    if (pieces.length !== spots.length) throw new Error(`sets: ${m.id} holds ${pieces.length} pieces and has ${spots.length} spots`)
    pieces.forEach((p, i) => {
      const s = spots[i]
      const [x, y] = restingCell(m, s.at[0], s.at[1])
      m.fixture(s.kind === 'chest' ? CHEST : BONES, x, y, s.name ? { name: s.name } : {}, [{ form: p.type }])
    })
  }
}
