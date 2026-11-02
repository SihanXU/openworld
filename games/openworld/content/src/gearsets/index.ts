// The main line's sets (docs/sets.md): thirty-two, five or six to a chapter and two across it, each piece a type of its
// own. What the item catalogue (items.ts: a form per piece), the ontology (its sets; the Seal-bearers' sure drops), the
// catalogue's pictures (client catalog.ts), the demo (tools/src/demo/sets: what lies on its maps) and the wiki read.

import type { GearSet } from '@openworld/engine'
import { ACROSS_SETS } from './across.ts'
import { CH1_SETS } from './ch1.ts'
import { CH2_SETS } from './ch2.ts'
import { CH3_SETS } from './ch3.ts'
import { CH4_SETS } from './ch4.ts'
import { CH5_SETS } from './ch5.ts'
import { FIN_SETS } from './fin.ts'
import { gearSetOf, pieceProps, pieceSprite, pieceType, type PieceDef, type SetDef } from './kit.ts'

export { bonusOf, gearSetOf, pieceProps, pieceSprite, pieceType, type BonusDef, type Chapter, type From, type Lean, type PieceDef, type SetDef, type Slot } from './kit.ts'

/** Every set of the main line, chapter by chapter, then the two that cross it. */
export const MAIN_SETS: SetDef[] = [...CH1_SETS, ...CH2_SETS, ...CH3_SETS, ...CH4_SETS, ...CH5_SETS, ...FIN_SETS, ...ACROSS_SETS]

/** The sets as the world knows them (Ontology.sets). */
export const MAIN_GEAR_SETS: GearSet[] = MAIN_SETS.map(gearSetOf)

/** A piece as the catalogue makes it: its set, what its chapter's file wrote, its type, picture and props. */
export interface SetPiece {
  set: SetDef
  piece: PieceDef
  type: string
  sprite: string
  props: Record<string, number | string>
}
export const SET_PIECES: SetPiece[] = MAIN_SETS.flatMap((set) => set.pieces.map((piece) => ({ set, piece, type: pieceType(set, piece), sprite: pieceSprite(set, piece), props: pieceProps(set, piece) })))
export const SET_PIECE_BY_TYPE: Record<string, SetPiece> = Object.fromEntries(SET_PIECES.map((p) => [p.type, p]))

/** Each Seal-bearer's own piece (a boss's id → the piece's type), surely dropped when it falls. */
export const SEAL_DROPS: Record<string, string> = Object.fromEntries(SET_PIECES.filter((p) => p.piece.from.startsWith('boss:')).map((p) => [p.piece.from.slice('boss:'.length), p.type]))

/** The pieces a map holds (a map's id → the types laid there: tools/src/demo/sets lays them). */
export const piecesOnMap = (map: string): SetPiece[] => SET_PIECES.filter((p) => p.piece.from === `map:${map}`)
/** The pieces a person sells (their stock: people's files). */
export const piecesSoldBy = (npc: string): SetPiece[] => SET_PIECES.filter((p) => p.piece.from === `npc:${npc}`)
/** The pieces a quest pays (quests/*.ts: `setPiece`). */
export const piecesOfQuest = (quest: string): SetPiece[] => SET_PIECES.filter((p) => p.piece.from === `quest:${quest}`)
