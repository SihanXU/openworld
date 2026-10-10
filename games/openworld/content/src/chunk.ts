// This game's map files (the format is the engine's, engine/src/chunk.ts): its rows read through its terrain
// characters (TERRAIN_CHARS).

import { decodeRawChunk, decodeRawMap, type MapChunk, type MapData, type RawChunk, type RawMap } from '@openworld/engine'
import { TERRAIN_CHARS } from './ontology.ts'

export type { RawChunk, RawMap }

export const decodeMap = (m: RawMap): MapData => decodeRawMap(m, TERRAIN_CHARS)

export const decodeChunk = (raw: RawChunk): MapChunk => decodeRawChunk(raw, TERRAIN_CHARS)
