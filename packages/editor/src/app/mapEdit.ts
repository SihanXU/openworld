// The map's edits as the map mode makes them (docs/engine-split.md §16, E1): the cells of a shape (a brush, a
// rectangle, an ellipse, a flood fill), the ground or its height painted over them, a block copied with the things
// on it and pasted elsewhere, a building stamped from the catalogue's prefabs, a room's walls, an interior made
// behind a door, a map duplicated. Pure: a map file's data in, the same data changed; the store keeps it as an edit.

import type { Entity, Portal, RawChunk, Text } from '@openworld/engine'

export interface Cell {
  x: number
  y: number
}
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** What a shape paints: the ground (a terrain's character) or its height (a digit, half levels). */
export type Layer = 'ground' | 'height'

/** The box two corners span. */
export const boxOf = (a: Cell, b: Cell): Box => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 })

/** A square brush of `size` cells a side about a cell (an even size reaches further right and down). */
export function brushCells(c: Cell, size: number): Cell[] {
  const n = Math.max(1, Math.floor(size))
  const o = Math.floor((n - 1) / 2)
  return rectCells({ x: c.x - o, y: c.y - o }, { x: c.x - o + n - 1, y: c.y - o + n - 1 })
}

export function rectCells(a: Cell, b: Cell): Cell[] {
  const r = boxOf(a, b)
  const out: Cell[] = []
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push({ x, y })
  return out
}

/** The ellipse inscribed in the box two corners span: a cell is in when its centre is. */
export function ellipseCells(a: Cell, b: Cell): Cell[] {
  const r = boxOf(a, b)
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  return rectCells(a, b).filter(({ x, y }) => ((x + 0.5 - cx) / (r.w / 2)) ** 2 + ((y + 0.5 - cy) / (r.h / 2)) ** 2 <= 1 + 1e-9)
}

const inside = (m: RawChunk['map'], c: Cell) => c.x >= 0 && c.y >= 0 && c.x < m.width && c.y < m.height

/** The character of a layer at a cell (a height with no heights written is 0). */
export function valueAt(ch: RawChunk, layer: Layer, c: Cell): string | undefined {
  if (!inside(ch.map, c)) return undefined
  return layer === 'ground' ? ch.map.rows[c.y][c.x] : (ch.map.heights?.[c.y]?.[c.x] ?? '0')
}

/** The cells joined to one by sides with its value on the layer (RPG Maker's flood fill). */
export function floodCells(ch: RawChunk, layer: Layer, from: Cell): Cell[] {
  const v = valueAt(ch, layer, from)
  if (v === undefined) return []
  const seen = new Set<number>()
  const out: Cell[] = []
  const w = ch.map.width
  const todo = [from]
  while (todo.length) {
    const c = todo.pop()!
    if (!inside(ch.map, c) || seen.has(c.y * w + c.x) || valueAt(ch, layer, c) !== v) continue
    seen.add(c.y * w + c.x)
    out.push(c)
    todo.push({ x: c.x + 1, y: c.y }, { x: c.x - 1, y: c.y }, { x: c.x, y: c.y + 1 }, { x: c.x, y: c.y - 1 })
  }
  return out
}

const setAt = (row: string, x: number, ch: string) => row.slice(0, x) + ch + row.slice(x + 1)

/**
 * The ground around a box: the character most of the cells just outside it have, walls and doors aside (what the
 * cells a cut, a move or a building taken away leave behind are given). None around: the fallback.
 */
export function groundAround(ch: RawChunk, r: Box, chars: Record<string, string>, fallback: string): string {
  const n = new Map<string, number>()
  for (let x = r.x - 1; x <= r.x + r.w; x++)
    for (let y = r.y - 1; y <= r.y + r.h; y++) {
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) continue
      const c = valueAt(ch, 'ground', { x, y })
      if (c !== undefined && chars[c] !== 'wall' && chars[c] !== 'door') n.set(c, (n.get(c) ?? 0) + 1)
    }
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback
}

/** Paint a layer over cells (those off the map left alone). */
export function paint(ch: RawChunk, layer: Layer, cells: Cell[], value: string): void {
  const m = ch.map
  if (layer === 'height') m.heights ??= m.rows.map((r) => '0'.repeat(r.length))
  const rows = layer === 'ground' ? m.rows : m.heights!
  for (const c of cells) if (inside(m, c)) rows[c.y] = setAt(rows[c.y], c.x, value)
  if (layer === 'height' && m.heights!.every((r) => /^0*$/.test(r))) delete m.heights
}

// ------------------------------------------------------------------ things

/** The ids the project's things and people have: a new thing takes none of them. */
export function idsOf(chunks: RawChunk[], people: string[] = []): Set<string> {
  return new Set([...chunks.flatMap((c) => c.entities.map((e) => e.id)), ...people])
}

/** A thing's new id: its map's, its kind's, a number no other thing has (and now taken). */
export function newId(mapId: string, type: string, taken: Set<string>): string {
  const base = `${mapId}.${type.split('/').pop()}`
  for (let n = 1; ; n++)
    if (!taken.has(`${base}${n}`)) {
      taken.add(`${base}${n}`)
      return `${base}${n}`
    }
}

/** The things standing on cells of a box, and all they hold (in it, in hand; what that holds, and so on). */
export function thingsIn(ch: RawChunk, r: Box): Entity[] {
  const top = ch.entities.filter((e) => e.place.on === 'tile' && e.place.x >= r.x && e.place.y >= r.y && e.place.x < r.x + r.w && e.place.y < r.y + r.h)
  return withContents(ch, top)
}

function withContents(ch: RawChunk, top: Entity[]): Entity[] {
  const ids = new Set(top.map((e) => e.id))
  const out = [...top]
  for (let grew = true; grew; ) {
    grew = false
    for (const e of ch.entities)
      if ((e.place.on === 'inside' || e.place.on === 'hand') && ids.has(e.place.holder) && !ids.has(e.id)) (ids.add(e.id), out.push(e), (grew = true))
  }
  return out
}

/** Things moved on their map: those on a tile by so many cells, what they hold with them; their homes too. */
function shift(es: Entity[], dx: number, dy: number, map: string): void {
  for (const e of es) {
    if (e.place.on === 'tile') e.place = { ...e.place, map, x: e.place.x + dx, y: e.place.y + dy }
    if (e.ai?.home) e.ai.home = { ...e.ai.home, map, x: e.ai.home.x + dx, y: e.ai.home.y + dy }
  }
}

/** Copies of things with new ids, the ids among them (what holds what) changed alike. */
function renew(es: Entity[], mapId: string, taken: Set<string>): Entity[] {
  const ids = new Map(es.map((e) => [e.id, newId(mapId, e.type, taken)]))
  return es.map((e0) => {
    const e = structuredClone(e0)
    e.id = ids.get(e0.id)!
    if ((e.place.on === 'inside' || e.place.on === 'hand') && ids.has(e.place.holder)) e.place = { ...e.place, holder: ids.get(e.place.holder)! }
    if (e.contents) e.contents = e.contents.map((c) => ids.get(c) ?? c)
    if (e.held) e.held = ids.get(e.held) ?? e.held
    return e
  })
}

/** Move one thing to a cell of its map (what it holds goes with it). */
export function moveThing(ch: RawChunk, id: string, to: Cell): boolean {
  const e = ch.entities.find((x) => x.id === id)
  if (!e || e.place.on !== 'tile' || !inside(ch.map, to)) return false
  shift([e], to.x - e.place.x, to.y - e.place.y, ch.map.id)
  return true
}

/** Remove things, and what they hold. */
export function removeThings(ch: RawChunk, ids: string[]): number {
  const gone = new Set(withContents(ch, ch.entities.filter((e) => ids.includes(e.id))).map((e) => e.id))
  ch.entities = ch.entities.filter((e) => !gone.has(e.id))
  return gone.size
}

// ------------------------------------------------------------------ blocks: copy, cut, paste

/**
 * A block of a map as copied: its ground and heights, the things on it, and the buildings' pictures and rooms' walls
 * wholly inside it (their places from its top left). A block of things alone (`things`) leaves the ground as it is.
 */
export interface Block {
  w: number
  h: number
  rows: string[]
  heights?: string[]
  entities: Entity[]
  stamps?: NonNullable<RawChunk['map']['stamps']>
  rooms?: NonNullable<RawChunk['map']['rooms']>
  things?: boolean
}

type Stamp = NonNullable<RawChunk['map']['stamps']>[number]
type Room = NonNullable<RawChunk['map']['rooms']>[number]
const within = (r: Box, x: number, y: number, w = 1, h = 1) => x >= r.x && y >= r.y && x + w <= r.x + r.w && y + h <= r.y + r.h

/** The stamps (by the catalogue's prefab sizes) and rooms wholly inside a box. */
function laidIn(ch: RawChunk, r: Box, prefabs: Record<string, Prefab>): { stamps: Stamp[]; rooms: Room[] } {
  return {
    stamps: (ch.map.stamps ?? []).filter((s) => prefabs[s.key] && within(r, s.x, s.y, prefabs[s.key].tw, prefabs[s.key].th)),
    rooms: (ch.map.rooms ?? []).filter((m) => within(r, m.x, m.y, m.w, m.h)),
  }
}

export function copyBlock(ch: RawChunk, r0: Box, prefabs: Record<string, Prefab> = {}): Block {
  const r = clip(ch.map, r0)
  const rows = ch.map.rows.slice(r.y, r.y + r.h).map((row) => row.slice(r.x, r.x + r.w))
  const heights = ch.map.heights?.slice(r.y, r.y + r.h).map((row) => row.slice(r.x, r.x + r.w))
  const entities = structuredClone(thingsIn(ch, r))
  shift(entities, -r.x, -r.y, '')
  const laid = laidIn(ch, r, prefabs)
  const stamps = laid.stamps.map((s) => ({ ...s, x: s.x - r.x, y: s.y - r.y }))
  const rooms = laid.rooms.map((m) => ({ ...m, x: m.x - r.x, y: m.y - r.y }))
  return { w: r.w, h: r.h, rows, ...(heights && { heights }), entities, ...(stamps.length && { stamps }), ...(rooms.length && { rooms }) }
}

/** A block of one thing (and what it holds), from its cell. */
export function copyThing(ch: RawChunk, id: string): Block | undefined {
  const e = ch.entities.find((x) => x.id === id)
  if (!e || e.place.on !== 'tile') return undefined
  const entities = structuredClone(withContents(ch, [e]))
  shift(entities, -e.place.x, -e.place.y, '')
  return { w: 1, h: 1, rows: [], entities, things: true }
}

/** A box inside the map. */
export function clip(m: RawChunk['map'], r: Box): Box {
  const x = Math.max(0, r.x)
  const y = Math.max(0, r.y)
  return { x, y, w: Math.max(0, Math.min(m.width, r.x + r.w) - x), h: Math.max(0, Math.min(m.height, r.y + r.h) - y) }
}

/** Clear a box: its things taken away, the buildings and rooms wholly in it too, its ground the given terrain's (none: left), its height 0. */
export function clearBlock(ch: RawChunk, r: Box, ground?: string, prefabs: Record<string, Prefab> = {}): void {
  removeThings(ch, thingsIn(ch, r).map((e) => e.id))
  const laid = laidIn(ch, r, prefabs)
  if (ch.map.stamps) ch.map.stamps = ch.map.stamps.filter((s) => !laid.stamps.includes(s))
  if (ch.map.rooms) ch.map.rooms = ch.map.rooms.filter((m) => !laid.rooms.includes(m))
  tidy(ch)
  const cells = rectCells(r, { x: r.x + r.w - 1, y: r.y + r.h - 1 })
  if (ground) paint(ch, 'ground', cells, ground)
  if (ch.map.heights) paint(ch, 'height', cells, '0')
}

const tidy = (ch: RawChunk) => {
  if (ch.map.stamps && !ch.map.stamps.length) delete ch.map.stamps
  if (ch.map.rooms && !ch.map.rooms.length) delete ch.map.rooms
}

/** Lay a block's ground and heights with its top left at a cell, where they fall on the map. */
function layGround(ch: RawChunk, b: Block, at: Cell): void {
  const m = ch.map
  if (b.things) return
  if (b.heights && !m.heights) m.heights = m.rows.map((r) => '0'.repeat(r.length))
  for (let j = 0; j < b.h; j++) {
    const y = at.y + j
    if (y < 0 || y >= m.height) continue
    for (let i = 0; i < b.w; i++) {
      const x = at.x + i
      if (x < 0 || x >= m.width) continue
      m.rows[y] = setAt(m.rows[y], x, b.rows[j][i])
      if (m.heights) m.heights[y] = setAt(m.heights[y], x, b.heights?.[j]?.[i] ?? '0')
    }
  }
  if (m.heights?.every((r) => /^0*$/.test(r))) delete m.heights
}

/** What of a block's things falls on the map at a cell: those off it left out, with all they hold. */
function onMap(m: RawChunk['map'], es: Entity[], at: Cell): Entity[] {
  const out = new Set(es.filter((e) => e.place.on === 'tile' && !inside(m, { x: at.x + e.place.x, y: at.y + e.place.y })).map((e) => e.id))
  for (let grew = true; grew; ) {
    grew = false
    for (const e of es) if ((e.place.on === 'inside' || e.place.on === 'hand') && out.has(e.place.holder) && !out.has(e.id)) (out.add(e.id), (grew = true))
  }
  return es.filter((e) => !out.has(e.id))
}

/** Paste a block with its top left at a cell: its ground, heights, buildings and rooms where they fall on the map, its things anew. The new things' ids. */
export function pasteBlock(ch: RawChunk, b: Block, at: Cell, taken: Set<string>, prefabs: Record<string, Prefab> = {}): string[] {
  const m = ch.map
  layGround(ch, b, at)
  const fits = (x: number, y: number, w: number, h: number) => x >= 0 && y >= 0 && x + w <= m.width && y + h <= m.height
  for (const s of b.stamps ?? []) if (prefabs[s.key] && fits(at.x + s.x, at.y + s.y, prefabs[s.key].tw, prefabs[s.key].th)) (m.stamps ??= []).push({ ...s, x: at.x + s.x, y: at.y + s.y })
  for (const r of b.rooms ?? []) if (fits(at.x + r.x, at.y + r.y, r.w, r.h)) (m.rooms ??= []).push({ ...r, x: at.x + r.x, y: at.y + r.y })
  const made = renew(onMap(m, b.entities, at), m.id, taken)
  shift(made, at.x, at.y, m.id)
  ch.entities.push(...made)
  return made.map((e) => e.id)
}

/**
 * Move a box's contents by so much (a selection dragged): its ground, heights, things (the same ids), buildings,
 * rooms, portals, anchors and areas wholly in it; the cells it leaves get the given ground. Things carried off the
 * map are removed. The box where it now is.
 */
export function moveBlock(ch: RawChunk, r0: Box, d: Cell, ground: string, prefabs: Record<string, Prefab> = {}): Box {
  const m = ch.map
  const r = clip(m, r0)
  const b = copyBlock(ch, r)
  const things = thingsIn(ch, r)
  const laid = laidIn(ch, r, prefabs)
  const cells = rectCells(r, { x: r.x + r.w - 1, y: r.y + r.h - 1 })
  paint(ch, 'ground', cells, ground)
  if (m.heights) paint(ch, 'height', cells, '0')
  const to = { x: r.x + d.x, y: r.y + d.y }
  layGround(ch, b, to)
  const top = things.filter((e) => e.place.on === 'tile')
  const off = top.filter((e) => e.place.on === 'tile' && !inside(m, { x: e.place.x + d.x, y: e.place.y + d.y }))
  removeThings(ch, off.map((e) => e.id))
  shift(top.filter((e) => !off.includes(e)), d.x, d.y, m.id)
  const fits = (x: number, y: number, w: number, h: number) => x >= 0 && y >= 0 && x + w <= m.width && y + h <= m.height
  for (const s of laid.stamps) if (fits(s.x + d.x, s.y + d.y, prefabs[s.key].tw, prefabs[s.key].th)) (s.x += d.x), (s.y += d.y)
  else m.stamps!.splice(m.stamps!.indexOf(s), 1)
  for (const o of laid.rooms) if (fits(o.x + d.x, o.y + d.y, o.w, o.h)) (o.x += d.x), (o.y += d.y)
  else m.rooms!.splice(m.rooms!.indexOf(o), 1)
  tidy(ch)
  for (const p of m.portals) if (within(r, p.x, p.y) && inside(m, { x: p.x + d.x, y: p.y + d.y })) (p.x += d.x), (p.y += d.y)
  for (const a of Object.values(m.anchors ?? {})) if (within(r, a[0], a[1]) && inside(m, { x: a[0] + d.x, y: a[1] + d.y })) (a[0] += d.x), (a[1] += d.y)
  for (const g of Object.values(m.regions ?? {})) if (within(r, g[0], g[1], g[2], g[3]) && fits(g[0] + d.x, g[1] + d.y, g[2], g[3])) (g[0] += d.x), (g[1] += d.y)
  return { ...to, w: r.w, h: r.h }
}

// ------------------------------------------------------------------ buildings, rooms, interiors

/** A building from the catalogue (its prefab): its cells, '#' solid, 'D' its door, '.' drawn and free, ' ' nothing. */
export interface Prefab {
  tw: number
  th: number
  grid: string[]
  /** The terrain its solid cells get (default `wall`). */
  terrain?: string
}

/** Which character a map writes a terrain by (the game's terrain characters read backwards). */
export function charOf(chars: Record<string, string>, terrain: string): string | undefined {
  return Object.entries(chars).find(([, t]) => t === terrain)?.[0]
}

export class EditError extends Error {}

/**
 * Stamp a building with its top left at a cell (as the builder's `prefab` does): its picture as one of the map's
 * stamps, its solid cells the prefab's terrain, its door a door. Its door cell, if it has one on the map.
 */
export function stampBuilding(ch: RawChunk, key: string, p: Prefab, at: Cell, chars: Record<string, string>): Cell | undefined {
  const solid = charOf(chars, p.terrain ?? 'wall')
  const door = charOf(chars, 'door')
  if (!solid) throw new EditError(`the game writes no character for the terrain ${p.terrain ?? 'wall'} (its terrain characters, the Game mode)`)
  if (p.grid.some((r) => r.includes('D')) && !door) throw new EditError('the game writes no character for the terrain door')
  ;(ch.map.stamps ??= []).push({ key, x: at.x, y: at.y })
  let doorAt: Cell | undefined
  p.grid.forEach((row, j) =>
    [...row].forEach((c, i) => {
      const cell = { x: at.x + i, y: at.y + j }
      if (!inside(ch.map, cell)) return
      if (c === '#') paint(ch, 'ground', [cell], solid)
      if (c === 'D') (paint(ch, 'ground', [cell], door!), (doorAt = cell))
    }),
  )
  return doorAt
}

/** The stamp whose picture covers a cell (the last laid on top), by its index in the map's stamps. */
export function stampAt(ch: RawChunk, prefabs: Record<string, Prefab>, c: Cell): number | undefined {
  const s = ch.map.stamps ?? []
  for (let i = s.length - 1; i >= 0; i--) {
    const p = prefabs[s[i].key]
    if (p && c.x >= s[i].x && c.y >= s[i].y && c.x < s[i].x + p.tw && c.y < s[i].y + p.th) return i
  }
  return undefined
}

/** A stamp taken away: its picture, and its cells given back the ground around it (the given terrain's). */
export function removeStamp(ch: RawChunk, prefabs: Record<string, Prefab>, i: number, ground: string): void {
  const s = ch.map.stamps?.[i]
  if (!s) return
  const p = prefabs[s.key]
  if (p) p.grid.forEach((row, j) => [...row].forEach((c, k) => (c === '#' || c === 'D') && paint(ch, 'ground', [{ x: s.x + k, y: s.y + j }], ground)))
  ch.map.stamps!.splice(i, 1)
  if (!ch.map.stamps!.length) delete ch.map.stamps
}

/** A room (as the builder's `partition`): its ring walls, drawn in a wall frame's style, its inside the floor given (none: left), doorways in its walls. */
export function room(ch: RawChunk, style: string, r: Box, chars: Record<string, string>, floor?: string, doorways: Cell[] = []): void {
  const wall = charOf(chars, 'wall')
  const door = charOf(chars, 'door')
  if (!wall) throw new EditError('the game writes no character for the terrain wall')
  if (doorways.length && !door) throw new EditError('the game writes no character for the terrain door')
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      const ring = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1
      if (ring) paint(ch, 'ground', [{ x, y }], doorways.some((d) => d.x === x && d.y === y) ? door! : wall)
      else if (floor) paint(ch, 'ground', [{ x, y }], floor)
    }
  ;(ch.map.rooms ??= []).push({ style, x: r.x, y: r.y, w: r.w, h: r.h })
}

/** The room whose walls are on a cell (the last laid), by its index. */
export function roomAt(ch: RawChunk, c: Cell): number | undefined {
  const rs = ch.map.rooms ?? []
  for (let i = rs.length - 1; i >= 0; i--) {
    const r = rs[i]
    if (c.x >= r.x && c.y >= r.y && c.x < r.x + r.w && c.y < r.y + r.h) return i
  }
  return undefined
}

export interface InteriorSpec {
  id: string
  name: Text
  w: number
  h: number
  /** The wall frame's style (the catalogue's rooms). */
  style: string
  /** The floor's terrain. */
  floor: string
  music?: string
}

/**
 * The room behind a door (RPG Maker's house and its inside): a new interior map, walls round a floor, a door in
 * the middle of its bottom wall; a portal from the door outside to the cell inside it, and one from the door
 * inside back to the cell before the door outside. The new map; the outside map gets its portal.
 */
export function interiorBehind(outside: RawChunk, door: Cell, spec: InteriorSpec, chars: Record<string, string>): RawChunk {
  const floor = charOf(chars, spec.floor)
  if (!floor) throw new EditError(`the game writes no character for the terrain ${spec.floor}`)
  const w = Math.max(4, spec.w)
  const h = Math.max(4, spec.h)
  const inner: RawChunk = {
    map: { id: spec.id, name: spec.name, kind: 'interior', width: w, height: h, rows: Array.from({ length: h }, () => floor.repeat(w)), portals: [], light: 'indoor', zone: 'peaceful', ...(spec.music && { music: spec.music }) },
    entities: [],
  }
  const d = { x: Math.floor(w / 2), y: h - 1 }
  room(inner, spec.style, { x: 0, y: 0, w, h }, chars, undefined, [d])
  const out = { x: door.x, y: Math.min(outside.map.height - 1, door.y + 1) }
  outside.map.portals = outside.map.portals.filter((p) => !(p.x === door.x && p.y === door.y))
  outside.map.portals.push({ x: door.x, y: door.y, to: spec.id, tx: d.x, ty: d.y - 1, label: spec.name })
  inner.map.portals.push({ x: d.x, y: d.y, to: outside.map.id, tx: out.x, ty: out.y, label: outside.map.name } satisfies Portal)
  return inner
}

// ------------------------------------------------------------------ maps

/** A map copied under a new id: its things anew (their ids the new map's), its portals, anchors and areas as they were. */
export function duplicateMap(ch: RawChunk, id: string, name: Text, taken: Set<string>): RawChunk {
  const m = structuredClone(ch.map)
  m.id = id
  m.name = name
  delete m.strokes
  const top = ch.entities.filter((e) => e.place.on === 'tile')
  const made = renew(withContents(ch, top), id, taken)
  shift(made, 0, 0, id)
  return { map: m, entities: made }
}

