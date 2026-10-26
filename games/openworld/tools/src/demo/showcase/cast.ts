// The showcase's people (docs/showcase.md §5): not a household to every room by its kind, as the backdrop's are
// (continent/people.ts), but each one placed by the place's maker — who they are, where they sleep, and their day hour
// by hour: the brothers at their desks in the scriptorium and in their stalls at vespers, the keepers at their stalls,
// the watch on the walls, the drill in the ward. They are the backdrop's own all the same (`npc.fidelity: 'local'`),
// written into the place's file in the shape the backdrop's are, so every check of the backdrop's people holds them.

import { OntologyIndex, type Entity, type LineDef, type ScheduleEntry } from '@openworld/engine'
import { SOCIAL_COIN, TERRAIN_CHARS, favouriteFor, generateLook, type RawChunk } from '@openworld-game/content'
import { itemOf, reseed, rng } from '../builder.ts'
import { GIVEN, familyName, linesFor } from '../continent/folk.ts'
import type { Place } from '../continent/generate.ts'

type Cell = [number, number]

/** An hour span of someone's day: where (a map of the place, a cell, how far round it they keep), doing what. */
export interface Hours {
  from: number
  to: number
  map: string
  x: number
  y: number
  r?: number
  activity: string
}

/** One of a place's people, as its maker places them. */
export interface Cast {
  role: string
  /** Where they sleep: a map of the place (a room behind a door, or the place itself for those who sleep rough). */
  home: string
  /** Their bed there, if not wherever the room has one free. */
  bed?: Cell
  /** Their waking day; the hours it leaves are asleep in their bed. */
  day: Hours[]
  stock?: [string, number][]
  purse?: number
  sex?: 'female' | 'male'
  age?: [number, number]
  fights?: boolean
}

/** Each showcase place's cast, by place id: what its maker sets as it builds the place's maps (showcase/index.ts). */
export const CASTS = new Map<string, Cast[]>()

const key = (x: number, y: number) => `${x},${y}`

/** The cells of a map one may stand on, and those taken already (no two people keep to one cell). */
class Floor {
  free = new Set<string>()
  taken = new Set<string>()
  beds: Cell[] = []
  constructor(chunk: RawChunk, onto: OntologyIndex) {
    const m = chunk.map
    const terrain = m.rows.flatMap((r) => [...r].map((c) => TERRAIN_CHARS[c] ?? 'void'))
    const solid = new Set<string>()
    for (const e of chunk.entities) {
      if (e.place.on !== 'tile') continue
      if (e.type.startsWith('fixture/furniture/bed')) this.beds.push([e.place.x, e.place.y])
      if (!onto.resolve(e.type).solid) continue
      const [fw, fd] = onto.resolve(e.type).footprint
      for (let dy = 0; dy < fd; dy++) for (let dx = 0; dx < fw; dx++) solid.add(key(e.place.x - Math.floor((fw - 1) / 2) + dx, e.place.y - dy))
    }
    for (const p of m.portals) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) solid.add(key(p.x + dx, p.y + dy))
    for (let y = 1; y < m.height - 1; y++)
      for (let x = 1; x < m.width - 1; x++) {
        const t = terrain[y * m.width + x]
        const td = onto.terrain(t)
        if (!td || td.solid || t === 'door' || t.includes('water') || solid.has(key(x, y))) continue
        this.free.add(key(x, y))
      }
  }
  /** A free cell of one's own within r of a cell (the nearest free one past it). */
  spot([cx, cy]: Cell, r: number): Cell {
    const cells: Cell[] = []
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (this.free.has(key(cx + dx, cy + dy)) && !this.taken.has(key(cx + dx, cy + dy))) cells.push([cx + dx, cy + dy])
    let out = cells.length ? rng.pick(cells) : undefined
    for (let ring = r + 1; !out && ring < 20; ring++)
      for (let dy = -ring; dy <= ring && !out; dy++)
        for (let dx = -ring; dx <= ring && !out; dx++) if (this.free.has(key(cx + dx, cy + dy)) && !this.taken.has(key(cx + dx, cy + dy))) out = [cx + dx, cy + dy]
    if (!out) throw new Error(`no free cell near ${cx},${cy}`)
    this.taken.add(key(...out))
    return out
  }
}

const PURSE: Record<string, number> = { child: 1, beggar: 0, merchant: 14, smith: 10, innkeeper: 12, noble: 20, peddler: 8, priest: 3 }
const FIGHTS = new Set(['guard', 'soldier', 'smith', 'hunter'])
const AGE: Record<string, [number, number]> = { child: [6, 15], elder: [60, 80], noble: [30, 65], scholar: [25, 70] }

/** A place's cast made into its map's things (each with what they carry), their days kept within the place's maps. */
export function castPeople(chunk: RawChunk, rooms: RawChunk[], p: Place, onto: OntologyIndex, cast: Cast[], others: Entity[] = []): Entity[] {
  reseed(p.seed ^ 0xca57)
  const names = new Set(others.filter((e) => e.npc).map((e) => (e.name as { en: string }).en))
  const map = chunk.map.id
  const floors = new Map<string, Floor>([[map, new Floor(chunk, onto)], ...rooms.map((r) => [r.map.id, new Floor(r, onto)] as [string, Floor])])
  const floor = (m: string) => {
    const f = floors.get(m)
    if (!f) throw new Error(`${map}: the cast keeps to ${m}, not a map of the place`)
    return f
  }
  const families = new Set<string>()
  const out: Entity[] = []
  cast.forEach((c, n) => {
    const id = `${map}.cast${n}`
    const sex = c.sex ?? (rng.chance(0.5) ? 'female' : 'male')
    const [lo, hi] = c.age ?? AGE[c.role] ?? [18, 60]
    const age = rng.int(lo, hi)
    const given = GIVEN[p.region] ?? GIVEN.frostfang
    // a name no one of the place has yet (its households' or the cast's)
    let first = rng.pick(given[sex])
    let family = familyName(p.region, (xs) => rng.pick(xs), families)
    for (let k = 0; k < 40 && names.has(`${first[0]} ${family.en}`); k++) {
      first = rng.pick(given[sex])
      if (k % 4 === 3) family = familyName(p.region, (xs) => rng.pick(xs), families)
    }
    names.add(`${first[0]} ${family.en}`)
    // their bed: the one asked for, or a free one in their room, or (none) a cell of the room
    const home = floor(c.home)
    const bedCell: Cell = c.bed ?? (home.beds.length ? home.beds.splice(rng.int(0, home.beds.length - 1), 1)[0] : home.spot([Math.floor(chunkOf(c.home).map.width / 2), Math.floor(chunkOf(c.home).map.height / 2)], 4))
    const bed = { map: c.home, x: bedCell[0], y: bedCell[1] }
    const day: ScheduleEntry[] = [...c.day]
      .sort((a, b) => a.from - b.from)
      .map((h) => {
        const [x, y] = floor(h.map).spot([h.x, h.y], h.r ?? 0)
        return { from: h.from, to: h.to % 24, map: h.map, x, y, activity: h.activity }
      })
    // asleep in the hours the day leaves (the longest run of them: a night watch sleeps by day)
    const awake = Array.from({ length: 24 }, (_, hr) => day.some((s) => (s.from <= s.to ? hr >= s.from && hr < s.to : hr >= s.from || hr < s.to)))
    let best: [number, number] = [0, 0]
    for (let start = 0; start < 24; start++) {
      if (awake[start] || !awake[(start + 23) % 24]) continue
      let n = 0
      while (n < 24 && !awake[(start + n) % 24]) n++
      if (n > best[1]) best = [start, n]
    }
    if (!best[1]) throw new Error(`${id}: a day with no hour to sleep`)
    const schedule: ScheduleEntry[] = [{ from: best[0], to: (best[0] + best[1]) % 24, ...bed, activity: 'sleep' }, ...day]
    // (any other hour left, a short rest at home)
    for (let hr = 0; hr < 24; hr++)
      if (!awake[hr] && (hr - best[0] + 24) % 24 >= best[1]) schedule.push({ from: hr, to: (hr + 1) % 24, ...bed, activity: 'rest' })
    // where they begin: where six in the morning finds them, if that is the place's map or a room a step through its
    // doors (a place's own people are written in its file, which holds no further — packages/format check.ts); else the
    // first hour of their day that is
    const near = (m: string) => m === map || chunk.map.portals.some((pt) => pt.to === m)
    const at6 = schedule.find((s) => (s.from <= s.to ? 6 >= s.from && 6 < s.to : 6 >= s.from || 6 < s.to)) ?? schedule[0]
    const now = near(at6.map) ? at6 : [...schedule].sort((a, b) => ((a.from - 6 + 24) % 24) - ((b.from - 6 + 24) % 24)).find((s) => near(s.map)) ?? at6
    const purse = c.purse ?? PURSE[c.role] ?? rng.int(2, 6)
    const carried: Entity[] = [
      ...(c.stock ?? []).flatMap(([form, k], i) => Array.from({ length: k }, (_, j) => ({ ...itemOf(form, `${id}.s${i}.${j}`), id: `${id}.s${i}.${j}`, place: { on: 'inside' as const, holder: id } }))),
      ...Array.from({ length: purse }, (_, i) => ({ id: `${id}.coin${i}`, type: SOCIAL_COIN, place: { on: 'inside' as const, holder: id } })),
    ]
    const tags = [...(age < 18 ? ['minor'] : []), ...(c.stock ? ['merchant'] : [])]
    const lines: LineDef[] = linesFor(c.role, p.region, (xs) => rng.pick(xs))
    out.push({
      id,
      type: `actor/person/${c.role}`,
      name: { en: `${first[0]} ${family.en}`, zh: `${first[1]}·${family.zh}` },
      place: { on: 'tile', map: now.map, x: now.x, y: now.y },
      facing: 'down',
      props: {
        age,
        household: `${map}.house${n}`,
        purse,
        favourite: favouriteFor(id, age),
        ...((c.fights ?? FIGHTS.has(c.role)) && { fights: true }),
        ...(c.stock && { stock: c.stock.map(([form, k]) => `${form}*${k}`).join('|') }),
      },
      ...(tags.length && { tags }),
      ...(carried.length && { contents: carried.map((e) => e.id) }),
      look: generateLook(id, { sex, age, role: c.role }),
      npc: { role: c.role, schedule, fidelity: 'local', person: { lines } },
    })
    out.push(...carried)
  })
  return out
  function chunkOf(m: string): RawChunk {
    return m === map ? chunk : rooms.find((r) => r.map.id === m)!
  }
}
