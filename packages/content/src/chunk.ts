// On-disk map chunk format: terrain as one char per tile (see TERRAIN_CHARS).

import { appearFromForage, type Entity, type MapChunk, type MapData, type Portal, type Text } from '@lsw/engine'
import { TERRAIN_CHARS } from './ontology.ts'

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
  appear?: MapData['appear']
  /** An older chunk's `appear` (one type each). */
  forage?: MapData['forage']
  zone?: MapData['zone']
  scale?: MapData['scale']
  site?: MapData['site']
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
    heights: m.heights ? m.heights.flatMap((row) => [...row].map(Number)) : undefined,
    portals: m.portals,
    stamps: m.stamps,
    rooms: m.rooms,
    music: m.music,
    light: m.light,
    fish: m.fish,
    anchors: m.anchors,
    regions: m.regions,
    appear: m.appear ?? appearFromForage(m as unknown as MapData),
    zone: m.zone,
    scale: m.scale,
    site: m.site,
  }
}

export function decodeChunk(raw: RawChunk): MapChunk {
  return { map: decodeMap(raw.map), entities: raw.entities }
}
