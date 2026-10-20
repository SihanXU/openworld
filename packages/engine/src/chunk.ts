// The map file format: a map chunk as a game writes it to disk, terrain as one character per tile. Which
// character is which terrain is the game's (GameDef.terrainChars); the format is the engine's.

import { appearFromForage } from './appear.ts'
import type { MapChunk } from './engine.ts'
import type { Entity, MapData, Portal, PropValue, Text } from './types.ts'

export interface RawMap {
  id: string
  name: Text
  region?: string
  kind: string
  width: number
  height: number
  rows: string[]
  /** Ground heights in half levels, one digit per column (omitted: all 0). */
  heights?: string[]
  portals: Portal[]
  stamps?: MapData['stamps']
  rooms?: MapData['rooms']
  music?: string
  light?: MapData['light']
  fish?: boolean
  anchors?: MapData['anchors']
  regions?: MapData['regions']
  regionProps?: MapData['regionProps']
  law?: MapData['law']
  appear?: MapData['appear']
  /** An older chunk's `appear` (one type each). */
  forage?: MapData['forage']
  zone?: MapData['zone']
  scale?: MapData['scale']
  site?: MapData['site']
  backdrop?: MapData['backdrop']
  /** The editor's brush strokes that drew it, with their seeds (the engine ignores them: the rows are the map). */
  strokes?: { brush: string; seed: number; at: [number, number, number, number]; params?: Record<string, PropValue> }[]
}

export interface RawChunk {
  map: RawMap
  entities: Entity[]
}

/** A map file's map, its rows read through the game's terrain characters (an unknown one is `void`). */
export function decodeRawMap(m: RawMap, chars: Record<string, string>): MapData {
  const terrain: string[] = []
  for (const row of m.rows) for (const c of row) terrain.push(chars[c] ?? 'void')
  return {
    id: m.id,
    name: m.name,
    region: m.region,
    kind: m.kind,
    width: m.width,
    height: m.height,
    terrain,
    heights: m.heights ? m.heights.flatMap((row) => [...row].map(Number)) : undefined,
    portals: m.portals,
    stamps: m.stamps,
    rooms: m.rooms,
    music: m.music,
    light: m.light,
    fish: m.fish,
    anchors: m.anchors,
    regions: m.regions,
    ...(m.regionProps && { regionProps: m.regionProps }),
    ...(m.law && { law: m.law }),
    appear: m.appear ?? appearFromForage(m as unknown as MapData),
    zone: m.zone,
    scale: m.scale,
    site: m.site,
    ...(m.backdrop && { backdrop: true }),
  }
}

export function decodeRawChunk(raw: RawChunk, chars: Record<string, string>): MapChunk {
  return { map: decodeRawMap(raw.map, chars), entities: raw.entities }
}
