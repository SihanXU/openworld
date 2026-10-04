// What appears by itself (world-model.md §6.9): the ground's yield (Don't Starve's twigs, flint and
// grass), creatures that come back to a map (Minecraft's cows and chickens, a dell's slimes), and
// the night's walkers. All of it is one primitive over data (types.ts `AppearDef`): each map names
// its own (MapData.appear) and the world names what appears on any map its `where` fits
// (Ontology.appear). The world's `appear` period runs the primitive on the active map (dormant maps
// are frozen, design.md §5.12): an appearance whose time has come, at its hours and weather, adds
// one more of its weighted types on a free cell of its ground, at its distance from the one at the
// keys, until `max` are on the map. A creature comes with its behaviour, at home where it appears.

import type { Engine } from './engine.ts'
import type { AppearDef, MapData } from './types.ts'

/** How often (ticks) the world looks at what appears: every appearance's `every` is a multiple of it. */
export const APPEAR_TICK = 30
/** The ground's yield, by default: a quarter game hour, fifteen seconds of play. */
export const APPEAR_EVERY = 150
/** Never under the feet of the one at the keys or right beside them: things appear, they do not pop up in hand. */
const NEAR = 2
const TRIES = 24

/** The appearances of a map: its own, and the world's whose `where` fits it. */
export function appearancesOf(eng: Engine, map: MapData): AppearDef[] {
  const world = (eng.world.onto.data.appear ?? []).filter(
    (a) => (!a.where?.zone || (map.zone ?? 'combat') === a.where.zone) && (!a.where?.light || (map.light ?? 'outdoor') === a.where.light),
  )
  return [...(map.appear ?? []), ...world]
}

/** What appears on the active map now: each appearance whose time, hours and weather have come (or only the one given). */
export function appear(eng: Engine, what?: AppearDef): void {
  const w = eng.world
  const active = eng.activeMap
  const map = w.map(active)
  if (!map) return
  const due = what ? [what] : appearancesOf(eng, map).filter((a) => w.state.tick % (a.every || APPEAR_EVERY) === 0)
  for (const a of due) if (now(eng, a)) one(eng, active, a)
}

/** Is it the hour and the weather for it? */
function now(eng: Engine, a: AppearDef): boolean {
  const w = eng.world
  if (a.weather && !a.weather.includes(w.calendar().weather)) return false
  if (!a.hours) return true
  const h = w.hour() % 24
  const [from, to] = a.hours
  return from <= to ? h >= from && h < to : h >= from || h < to
}

/** One more of an appearance on a map, unless `max` are there already. */
function one(eng: Engine, active: string, a: AppearDef): void {
  const w = eng.world
  const map = w.map(active)!
  const kinds = Object.entries(a.types).filter(([t]) => w.onto.hasType(t))
  if (!kinds.length) return
  let there = 0
  for (const e of w.entitiesOnMap(active)) if (e.place.on === 'tile' && (a.tag ? w.hasTag(e, a.tag) : kinds.some(([k]) => k === e.type))) there++
  if (there >= a.max) return
  const total = kinds.reduce((s, [, share]) => s + share, 0)
  let roll = w.rand() * total
  const type = kinds.find(([, share]) => (roll -= share) < 0)?.[0] ?? kinds[0][0]
  const p = w.posOf(w.player)
  const here = p?.map === active ? p : undefined
  // a ring around the one at the keys needs them here
  if (a.ring && !here) return
  for (let i = 0; i < TRIES; i++) {
    let x: number
    let y: number
    if (a.ring && here) {
      const [near, far] = a.ring
      const ang = w.rand() * Math.PI * 2
      const r = near + w.rand() * (far - near)
      x = Math.round(here.x + Math.cos(ang) * r)
      y = Math.round(here.y + Math.sin(ang) * r)
    } else {
      x = Math.floor(w.rand() * map.width)
      y = Math.floor(w.rand() * map.height)
      if (here && Math.max(Math.abs(here.x - x), Math.abs(here.y - y)) <= NEAR) continue
    }
    if (!w.inBounds(active, x, y)) continue
    if (a.on && !a.on.includes(w.terrainAt(active, x, y))) continue
    if (!w.walkable(active, x, y) || w.placedAt(active, x, y).length) continue
    const made = w.create(type, { on: 'tile', map: active, x, y }, {
      ...(a.ai && { facing: 'down' as const, ai: { ...structuredClone(a.ai), home: { map: active, x, y } } }),
      ...(a.tag && { tags: [a.tag] }),
    })
    eng.touch({ e: made.id })
    for (const st of a.statuses ?? []) eng.applyStatus({ e: made.id }, st)
    return
  }
}

/** An older chunk's yield (MapData.forage, one type each) as appearances. */
export function appearFromForage(map: MapData): AppearDef[] | undefined {
  return map.forage?.map((f) => ({ types: { [f.type]: 1 }, on: f.on, max: f.max, every: f.every ?? APPEAR_EVERY, ...(f.ai && { ai: f.ai }), ...(f.statuses && { statuses: f.statuses }) }))
}
