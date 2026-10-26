// The showcase's halls (docs/showcase.md §4): a room seen as the game sees one, from the south and above with its roof
// taken off — its north wall a building's face (tools/src/art/arch/buildings/inside.ts) standing tall at its top, the
// dark over it, its other walls the room frame's low stone; doors in its south wall, stairs to the halls over and
// under it.

import type { Text } from '@openworld/engine'
import { MapBuilder } from '../builder.ts'
import { BUILDINGS } from '../../../../client/src/catalog.ts'

export interface HallRoom {
  id: string
  name: Text
  /** The room's width and its depth (the floor and its frame), in cells. */
  w: number
  h: number
  floor: string
  music?: string
  light?: 'indoor' | 'dark'
  region: string
  /** The north wall's face (a building of the catalogue as wide as the room), if any. */
  wall?: string
  frame?: 'stone' | 'plaster' | 'wood' | 'moss'
  /** The door cells in the south wall (x); default its middle. */
  doors?: number[]
  kind?: string
  /** Rows of dark kept over the room, if not as many as its north wall's face rises (a nave's apse stamped on its own). */
  top?: number
}

/** A hall: the dark over its north wall, its frame, its floor, its north wall's face, its doors. */
export function hallRoom(o: HallRoom): MapBuilder {
  const top = o.top ?? (o.wall ? BUILDINGS[o.wall].slices.reduce((n, s) => Math.max(n, s.th), 1) - 1 : 0)
  const H = top + o.h
  const m = new MapBuilder(o.id, o.name, o.kind ?? 'interior', o.w, H, 'void', o.music ?? 'interior', o.light ?? 'indoor', o.region)
  m.backdrop = true
  m.zone = 'peaceful'
  m.rect(0, top, o.w, o.h, 'wall')
  m.rect(1, top + 1, o.w - 2, o.h - 2, o.floor)
  m.rooms.push({ style: o.frame ?? 'stone', x: 0, y: top, w: o.w, h: o.h })
  if (o.wall) m.building(o.wall, 0, top)
  const doors = o.doors ?? [Math.floor(o.w / 2)]
  for (const x of doors) m.set(x, H - 1, 'door')
  if (doors.length) m.doors.out = [doors[0], H - 1]
  return m
}

/** The rows of a hall above its floor (where its north wall's face stands): its floor's first row. */
export const floorTop = (m: MapBuilder): number => {
  for (let y = 0; y < m.h; y++) if (m.get(1, y) !== 'void' && m.get(1, y) !== 'wall') return y
  return 0
}

/** Doors between a place's map and a hall: each of its door cells to one of the hall's, both ways (one in front of the other's). */
export function linkDoors(outer: MapBuilder, cells: [number, number][], hall: MapBuilder, inner: [number, number][]): void {
  cells.forEach(([x, y], i) => {
    const [ix, iy] = inner[i]
    outer.portal(x, y, hall.id, ix, iy - 1, hall.name)
    hall.portal(ix, iy, outer.id, x, y + 1, outer.name)
  })
}

/** A stair between two halls: down here, up there (or the other way), each landing on the cell before the other. */
export function linkStair(a: MapBuilder, [ax, ay]: [number, number], b: MapBuilder, [bx, by]: [number, number], aDown: boolean): void {
  a.set(ax, ay, aDown ? 'stairs_down' : 'stairs_up')
  b.set(bx, by, aDown ? 'stairs_up' : 'stairs_down')
  a.portal(ax, ay, b.id, bx, by + 1, b.name)
  b.portal(bx, by, a.id, ax, ay + 1, a.name)
}
