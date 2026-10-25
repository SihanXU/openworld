// Every building can be walked through (2026-10-25): on every map with rooms — Firstlight's houses of rooms, the other
// hand-made interiors and every backdrop room — the floor, the doors, the doorways between rooms, every thing in a
// room and every named spot are reached from the way in; nothing stands on a doorway or in the cell before a door or
// a doorway; the people's spots are reached; and every building's door is reached from outside. A failure names its
// map and cell.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type Entity, type MapData } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

const world = buildFord()
const g = Game.create(world.index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
for (const ch of [...world.chunks, ...world.backdrop]) g.loadChunk(decodeChunk(ch))
const w = g.engine.world

const FOUR = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const
const key = (x: number, y: number) => `${x},${y}`
/** Open ground for walking: terrain one stands on and no solid thing's base (the people step aside). */
const open = (map: string, x: number, y: number) => w.inBounds(map, x, y) && !w.blocked(map, x, y)

/** The cells reached on a map from its ways in, over open ground, four ways. */
function flood(map: string, from: [number, number][]): Set<string> {
  const seen = new Set<string>()
  const queue = from.filter(([x, y]) => open(map, x, y))
  for (const [x, y] of queue) seen.add(key(x, y))
  while (queue.length) {
    const [x, y] = queue.pop()!
    for (const [dx, dy] of FOUR) {
      const k = key(x + dx, y + dy)
      if (seen.has(k) || !open(map, x + dx, y + dy)) continue
      seen.add(k)
      queue.push([x + dx, y + dy])
    }
  }
  return seen
}

const maps = Object.values(w.state.maps) as MapData[]
/** Where one comes onto each map: every portal's landing, and a tent's inside (its `interior` props). */
const landings = new Map<string, { at: [number, number]; from: string }[]>()
const land = (map: string, at: [number, number], from: string) => landings.set(map, [...(landings.get(map) ?? []), { at, from }])
for (const m of maps) for (const p of m.portals) land(p.to, [p.tx, p.ty], m.id)
for (const e of Object.values(w.state.entities)) {
  const to = e.props?.interior
  if (typeof to === 'string' && e.place.on === 'tile') land(to, [Number(e.props!.interiorX), Number(e.props!.interiorY)], e.place.map)
}

const roomed = maps.filter((m) => m.kind === 'interior' || (m.rooms?.length ?? 0) > 0)
const inRect = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h
/** Inside a room, off its walls. */
const inside = (m: MapData, x: number, y: number) => (m.rooms ?? []).some((r) => inRect({ x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, x, y))
/** On a room's walls (its frame). */
const onFrame = (m: MapData, x: number, y: number) => (m.rooms ?? []).some((r) => inRect(r, x, y) && !inRect({ x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, x, y))
const fixturesAt = (map: string, x: number, y: number) => w.entitiesAt(map, x, y).filter((e) => e.type.startsWith('fixture/') && !w.isAgent(e))
/** The cells a thing's base covers. */
function base(e: Entity): [number, number][] {
  if (e.place.on !== 'tile') return []
  const [fw, fd] = w.onto.resolve(e.type).footprint ?? [1, 1]
  const out: [number, number][] = []
  for (let y = e.place.y - fd; y <= e.place.y + fd; y++) for (let x = e.place.x - fw; x <= e.place.x + fw; x++) if (w.covers(e, e.place.map, x, y) || (x === e.place.x && y === e.place.y)) out.push([x, y])
  return out
}
const touched = (reached: Set<string>, cells: [number, number][]) => cells.some(([x, y]) => reached.has(key(x, y)) || FOUR.some(([dx, dy]) => reached.has(key(x + dx, y + dy))))

/** What is wrong inside every map with rooms, as `map: what at x,y`. */
function problems(): string[] {
  const out: string[] = []
  for (const m of roomed) {
    const ins = landings.get(m.id) ?? []
    if (!ins.length) {
      out.push(`${m.id}: no way in`)
      continue
    }
    const reached = flood(m.id, ins.map((l) => l.at))
    for (const l of ins) if (!open(m.id, ...l.at)) out.push(`${m.id}: lands from ${l.from} on a blocked cell at ${key(...l.at)}`)
    // the floor of every room
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++) if (inside(m, x, y) && open(m.id, x, y) && !reached.has(key(x, y))) out.push(`${m.id}: floor cut off at ${key(x, y)}`)
    // the doors (portals) and the doorways (open cells in a room's walls): reached, nothing on them, the cell before them clear
    const gaps: [number, number, string][] = m.portals.map((p) => [p.x, p.y, 'door'])
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++) if (onFrame(m, x, y) && !m.portals.some((p) => p.x === x && p.y === y) && !w.onto.data.terrains[m.terrain[y * m.width + x]]?.solid) gaps.push([x, y, 'doorway'])
    for (const [x, y, what] of gaps) {
      if (!touched(reached, [[x, y]])) out.push(`${m.id}: ${what} not reached at ${key(x, y)}`)
      for (const f of fixturesAt(m.id, x, y)) out.push(`${m.id}: ${f.type} stands on the ${what} at ${key(x, y)}`)
      if (what === 'doorway' && !open(m.id, x, y)) out.push(`${m.id}: doorway blocked at ${key(x, y)}`)
      for (const [dx, dy] of FOUR) {
        const [fx, fy] = [x + dx, y + dy]
        if (!inside(m, fx, fy)) continue
        const solid = w.solidAt(m.id, fx, fy)
        if (solid && !w.isAgent(solid)) out.push(`${m.id}: ${solid.type} before the ${what} at ${key(fx, fy)}`)
      }
    }
    // every thing in a room within a hand's reach of the floor one walks
    for (const e of Object.values(w.state.entities)) {
      if (e.place.on !== 'tile' || e.place.map !== m.id || !e.type.startsWith('fixture/') || !inside(m, e.place.x, e.place.y)) continue
      if (!touched(reached, base(e))) out.push(`${m.id}: ${e.type} out of reach at ${key(e.place.x, e.place.y)}`)
    }
    // the named spots
    for (const [name, [x, y]] of Object.entries(m.anchors ?? {}))
      if (!(open(m.id, x, y) && reached.has(key(x, y)))) out.push(`${m.id}: anchor ${name} not reached at ${key(x, y)}`)
  }
  return out
}

/** The people's schedule spots: on a map with rooms reached from its way in, anywhere open ground. */
function spots(): string[] {
  const out: string[] = []
  const reach = new Map<string, Set<string>>()
  const roomedIds = new Set(roomed.map((m) => m.id))
  for (const p of w.people()) {
    for (const v of p.npc?.person?.schedules ?? [])
      for (const s of v.entries) {
        if (!w.map(s.map)) continue
        if (!open(s.map, s.x, s.y)) {
          out.push(`${s.map}: ${p.id}'s ${s.activity} spot blocked at ${key(s.x, s.y)}`)
          continue
        }
        if (!roomedIds.has(s.map)) continue
        let r = reach.get(s.map)
        if (!r) reach.set(s.map, (r = flood(s.map, (landings.get(s.map) ?? []).map((l) => l.at))))
        if (!r.has(key(s.x, s.y))) out.push(`${s.map}: ${p.id}'s ${s.activity} spot not reached at ${key(s.x, s.y)}`)
      }
  }
  return [...new Set(out)]
}

/** Every building's door from outside: the cell before it open, and reached from the map's other ways in and its open edges. */
function doorsOutside(): string[] {
  const out: string[] = []
  const reach = new Map<string, Set<string>>()
  const interiors = new Set(roomed.filter((m) => m.kind === 'interior').map((m) => m.id))
  for (const m of roomed) {
    if (m.kind !== 'interior') continue
    for (const p of m.portals) {
      const outer = w.map(p.to)
      if (!outer || interiors.has(outer.id)) continue
      if (!open(outer.id, p.tx, p.ty)) {
        out.push(`${outer.id}: before ${m.id}'s door, blocked at ${key(p.tx, p.ty)}`)
        continue
      }
      let r = reach.get(outer.id)
      if (!r) {
        const from = (landings.get(outer.id) ?? []).filter((l) => !interiors.has(l.from)).map((l) => l.at)
        if (outer.site) for (let y = 0; y < outer.height; y++) for (let x = 0; x < outer.width; x++) if (x === 0 || y === 0 || x === outer.width - 1 || y === outer.height - 1) from.push([x, y])
        reach.set(outer.id, (r = flood(outer.id, from)))
      }
      // (a map one comes onto only from its rooms, the Held Ground carried in a thorn, has no other way in to count from)
      if (r.size && !r.has(key(p.tx, p.ty))) out.push(`${outer.id}: ${m.id}'s door not reached from outside at ${key(p.tx, p.ty)}`)
    }
  }
  return out
}

describe('every building can be walked through', () => {
  it('holds rooms enough to mean it: Firstlight\'s houses, the hand-made interiors and every backdrop room', () => {
    expect(roomed.filter((m) => m.id.startsWith('meadow.')).length).toBeGreaterThanOrEqual(9)
    expect(roomed.length).toBeGreaterThan(700)
  })

  it('inside: every room\'s floor, door, doorway, thing and named spot reached from the way in; nothing on or before a door or a doorway', () => {
    const found = problems()
    if (found.length) console.log(`${found.length} problems inside:\n${found.slice(0, 400).join('\n')}`)
    expect(found).toEqual([])
  }, 300_000)

  it('the people\'s schedule spots stand on open ground, and inside a building are reached from its door', () => {
    const found = spots()
    if (found.length) console.log(`${found.length} spots:\n${found.join('\n')}`)
    expect(found).toEqual([])
  }, 120_000)

  it('every building\'s door is reached from outside', () => {
    const found = doorsOutside()
    if (found.length) console.log(`${found.length} doors:\n${found.join('\n')}`)
    expect(found).toEqual([])
  }, 300_000)
})
