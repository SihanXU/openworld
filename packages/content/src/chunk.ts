// On-disk map chunk format: terrain as one char per tile (see TERRAIN_CHARS).

import type { Entity, MapChunk, MapData, Portal, Text } from '@lsw/engine'
import { TERRAIN_CHARS } from './ontology.ts'

export interface RawMap {
  id: string
  name: Text
  region?: string
  kind: string
  width: number
  height: number
  rows: string[]
  portals: Portal[]
  stamps?: MapData['stamps']
  rooms?: MapData['rooms']
  music?: string
  light?: MapData['light']
  anchors?: MapData['anchors']
  regions?: MapData['regions']
}

export interface RawChunk {
  map: RawMap
  entities: Entity[]
}

export function decodeMap(m: RawMap): MapData {
  const terrain: string[] = []
  for (const row of m.rows) for (const c of row) terrain.push(TERRAIN_CHARS[c] ?? 'void')
  return {
    id: m.id,
    name: m.name,
    region: m.region,
    kind: m.kind,
    width: m.width,
    height: m.height,
    terrain,
    portals: m.portals,
    stamps: m.stamps,
    rooms: m.rooms,
    music: m.music,
    light: m.light,
    anchors: m.anchors,
    regions: m.regions,
  }
}

export function decodeChunk(raw: RawChunk): MapChunk {
  return { map: decodeMap(raw.map), entities: raw.entities }
}
