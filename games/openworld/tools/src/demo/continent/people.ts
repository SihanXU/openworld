// The backdrop's people (docs/continent.md §11): they live in the rooms behind their place's doors (rooms.ts), a
// household to a room — a home's family, a smithy's smith, a shop's keeper, a chapel's priests, a barracks' garrison, a
// tent's hunters or pilgrims —, as many as the room is for. Their days are kept within their place (its map and its
// rooms): asleep in their beds, a meal at home at noon, at work where their trade has them — the smith at the anvil,
// the keeper at the counter, the priest at the altar, the farmer in the fields, the guard at the gate, the children in
// the street —, the evening out or at home. So how many a place has is how many its houses hold, and the street holds
// those whose day has them out. Each has a look drawn from their id (content looks.ts), names in both languages, lines
// by their work and land (folk.ts), and a trade where it fits (their stock and coin, as the Ford's people carry them).
// They are the backdrop's own (`npc.fidelity: 'local'`): their records are their place's file, never the index's; never
// in the wiki. A pass over the built maps: the templates (backdrop.ts, rooms.ts) are free to change under it.

import { OntologyIndex, type Entity, type LineDef, type ScheduleEntry } from '@openworld/engine'
import { SOCIAL_COIN, TERRAIN_CHARS, buildOntology, favouriteFor, generateLook, type RawChunk } from '@openworld-game/content'
import { itemOf, reseed, rng } from '../builder.ts'
import { GIVEN, familyName, linesFor } from './folk.ts'
import type { Continent, Place } from './generate.ts'
import type { Role } from './rooms.ts'

type Cell = [number, number]
const key = (x: number, y: number) => `${x},${y}`

/** A built map as the pass reads it: where one may stand, what stands where; the cells kept for someone. */
class Ground {
  w: number
  h: number
  terrain: string[]
  free = new Set<string>()
  taken = new Set<string>()
  constructor(
    public chunk: RawChunk,
    onto: OntologyIndex,
  ) {
    const m = chunk.map
    this.w = m.width
    this.h = m.height
    this.terrain = m.rows.flatMap((r) => [...r].map((c) => TERRAIN_CHARS[c] ?? 'void'))
    const solid = new Set<string>()
    // (a solid thing's whole base: a tent's, a stall's)
    for (const e of chunk.entities) {
      if (e.place.on !== 'tile' || !onto.resolve(e.type).solid) continue
      const [fw, fd] = onto.resolve(e.type).footprint
      for (let dy = 0; dy < fd; dy++) for (let dx = 0; dx < fw; dx++) solid.add(key(e.place.x - Math.floor((fw - 1) / 2) + dx, e.place.y - dy))
    }
    // (never on a portal nor beside one: the way in and out stays clear)
    for (const p of m.portals) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) solid.add(key(p.x + dx, p.y + dy))
    for (let y = 1; y < this.h - 1; y++)
      for (let x = 1; x < this.w - 1; x++) {
        const t = this.terrain[y * this.w + x]
        const td = onto.terrain(t)
        if (!td || td.solid || t === 'door' || t.includes('water') || solid.has(key(x, y))) continue
        this.free.add(key(x, y))
      }
  }
  at(x: number, y: number): string {
    return this.terrain[y * this.w + x] ?? 'void'
  }
  /** The free cell nearest a cell (by rings), one not taken yet unless `share`. */
  near([cx, cy]: Cell, share = false): Cell | undefined {
    for (let r = 0; r < 14; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          const k = key(cx + dx, cy + dy)
          if (this.free.has(k) && (share || !this.taken.has(k))) return [cx + dx, cy + dy]
        }
    return undefined
  }
  /** A cell of one's own within `r` of a place (a bed's side, a post, a seat): taken, so no two share it. */
  spot(c: Cell, r: number): Cell | undefined {
    const cells: Cell[] = []
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const k = key(c[0] + dx, c[1] + dy)
        if (this.free.has(k) && !this.taken.has(k)) cells.push([c[0] + dx, c[1] + dy])
      }
    const out = cells.length ? rng.pick(cells) : this.near(c)
    if (out) this.taken.add(key(...out))
    return out
  }
  cellsOf(...terrains: string[]): Cell[] {
    const out: Cell[] = []
    for (const k of this.free) {
      const [x, y] = k.split(',').map(Number)
      if (terrains.includes(this.at(x, y))) out.push([x, y])
    }
    return out
  }
  things(prefix: string): Cell[] {
    return this.chunk.entities.filter((e) => e.place.on === 'tile' && e.type.startsWith(prefix)).map((e) => [(e.place as { x: number }).x, (e.place as { y: number }).y] as Cell)
  }
  shore(): Cell[] {
    const out: Cell[] = []
    for (const k of this.free) {
      const [x, y] = k.split(',').map(Number)
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.at(x + dx, y + dy).includes('water'))) out.push([x, y])
    }
    return out
  }
  middle(): Cell {
    return [Math.floor(this.w / 2), Math.floor(this.h / 2)]
  }
}

// ------------------------------------------------------------------ who lives where

/** Who keeps a camp's tents, by region: hunters on the coast, sellswords in the March, traders on the plains, reed-cutters in the fens, pilgrims round the Altar and the City. */
const CAMP: Record<string, [string, number][]> = {
  frostfang: [['hunter', 3], ['traveler', 1]],
  redmarch: [['soldier', 3], ['traveler', 1]],
  tithe: [['peddler', 2], ['merchant', 1], ['traveler', 2]],
  palefen: [['fisher', 3], ['herbalist', 1]],
  altar: [['traveler', 3], ['priest', 1]],
  holy: [['traveler', 3], ['bard', 1], ['peddler', 1]],
}

/** A home's grown-ups by the place's kind (and region): what the families of a village, a town, a city do. */
function homeRoles(p: Place): [string, number][] {
  const sea = p.region === 'palefen' || p.region === 'frostfang' ? 1.5 : 0.4
  const woods = p.region === 'frostfang' ? 1.5 : 0.4
  if (p.kind === 'village') return [['farmer', 4], ['villager', 4], ['fisher', sea], ['hunter', woods], ['herbalist', 0.5], ['elder', 0.8], ['beggar', 0.2]]
  if (p.kind === 'town') return [['villager', 5], ['guard', 1.2], ['farmer', 1], ['scholar', 0.3], ['bard', 0.3], ['beggar', 0.3], ['elder', 0.6], ['peddler', 0.4]]
  if (p.kind === 'city') return [['villager', 5], ['guard', 1.5], ['scholar', 0.6], ['noble', 0.6], ['bard', 0.4], ['beggar', 0.5], ['elder', 0.5], ['peddler', 0.5]]
  if (p.kind === 'cathedral') return [['priest', 2], ['villager', 1]]
  return [['villager', 3], ['farmer', 2], ['elder', 0.5]]
}

const pickWeighted = (ws: [string, number][]): string => {
  const total = ws.reduce((n, [, w]) => n + w, 0)
  let r = rng.next() * total
  for (const [k, w] of ws) if ((r -= w) <= 0) return k
  return ws[ws.length - 1][0]
}

/** The household a room holds, by what it is: who keeps it, then the rest (grown-ups, then children). */
function household(role: Role, p: Place): string[] {
  // (children: none in half the houses, one in a third, two now and then)
  const kids = (most: number) => Array.from({ length: Math.min(most, rng.chance(0.5) ? 0 : rng.chance(0.7) ? 1 : 2) }, () => 'child')
  const some = (ws: [string, number][], lo: number, hi: number) => Array.from({ length: rng.int(lo, hi) }, () => pickWeighted(ws))
  switch (role) {
    case 'home':
      return [...some(homeRoles(p), 1, 2), ...kids(2)]
    case 'farmhouse':
      return ['farmer', ...some([['farmer', 3], ['elder', 1]], 1, 2), ...kids(2)]
    case 'mill':
      return ['merchant', ...some([['farmer', 2], ['villager', 1]], 0, 1), ...kids(1)]
    case 'smithy':
      return ['smith', ...some([['villager', 1]], 0, 1)]
    case 'shop':
      return ['merchant', ...some([['villager', 1]], 0, 1), ...kids(1)]
    case 'teahouse':
      return ['innkeeper', ...some([['villager', 1]], 0, 1)]
    case 'inn':
      // the keeper and theirs, and whoever lodges there tonight
      return ['innkeeper', ...some([['villager', 1]], 0, 1), ...some([['traveler', 3], ['bard', 1], ['peddler', 1]], 1, 3)]
    case 'chapel':
      return ['priest', ...some([['priest', 1]], 0, 1)]
    case 'cell':
      return ['priest']
    case 'tent':
      return some(CAMP[p.region] ?? CAMP.frostfang, 1, 2)
    case 'barracks':
      return p.kind === 'fort' ? ['guard', ...some([['soldier', 1]], 4, 5)] : some([['guard', 1]], 3, 4)
  }
}

/** The trades that keep their stock and sell it, and the coin each carries. */
const STOCK: Record<string, [string, number][]> = {
  merchant: [['item/food/bread', 3], ['item/light/candle', 4], ['item/material/cloth', 2], ['item/light/torch', 3]],
  smith: [['item/tool/pickaxe', 1], ['item/tool/hoe', 1], ['item/weapon/blade/dagger', 1], ['item/material/iron_ingot', 2]],
  innkeeper: [['item/food/bread', 4], ['item/food/fish/cooked', 2], ['item/potion/healing', 1]],
  herbalist: [['item/material/herb', 4], ['item/food/berries', 4], ['item/potion/healing', 1]],
  peddler: [['item/light/torch', 3], ['item/misc/bait', 4], ['item/material/cloth', 1]],
  fisher: [['item/food/fish/raw', 3], ['item/misc/bait', 3]],
  priest: [['item/light/candle', 3], ['item/vessel/flask/holy_water', 1]],
}
const PURSE: Record<string, number> = { child: 1, beggar: 0, merchant: 12, smith: 10, innkeeper: 10, noble: 16, peddler: 8 }
/** Who fights back when struck (docs/npc-sandbox.md: the rest flee). */
const FIGHTS = new Set(['guard', 'soldier', 'smith', 'hunter'])
const AGE: Record<string, [number, number]> = { child: [6, 15], elder: [60, 80], noble: [30, 65], scholar: [25, 70] }
/** Who works indoors, at what (a room's thing they keep to). */
const INDOORS: Record<string, string[]> = {
  smith: ['fixture/craft/anvil', 'fixture/craft/forge'],
  merchant: ['fixture/furniture/counter', 'fixture/container/shelf', 'fixture/container/sack'],
  innkeeper: ['fixture/furniture/counter', 'fixture/furniture/table', 'fixture/light/fireplace'],
  priest: ['fixture/sacred/altar', 'fixture/furniture/bench', 'fixture/container/bookshelf'],
  scholar: ['fixture/container/bookshelf', 'fixture/furniture/table'],
}
/** Housework: what a home's own keep to when their day is indoors (the hearth, the table, the loom, the bench), and how often it is. */
const CHORES = ['fixture/light/fireplace', 'fixture/furniture/table', 'fixture/craft/loom', 'fixture/craft/workbench', 'fixture/container/barrel', 'fixture/container/chest']
const HOMEBOUND: Record<string, number> = { villager: 0.5, elder: 0.6, child: 0.45, noble: 0.4, scholar: 0.8 }

// ------------------------------------------------------------------ a place

interface Room {
  id: string
  role: Role
  g: Ground
  /** In front of its door outside, on the place's map. */
  step: Cell
}

/** Where a role spends its working hours out of doors: a place and how far round it. */
function outdoorWork(role: string, g: Ground, step: Cell, kind: string, streets: Cell[]): [Cell, number] {
  const pick = (cs: Cell[]) => (cs.length ? rng.pick(cs) : undefined)
  const square = pick([...g.things('fixture/water/well'), ...g.things('fixture/water/fountain'), ...g.things('fixture/light/campfire')]) ?? g.middle()
  const street = (): [Cell, number] => [pick(streets) ?? square, 2]
  switch (role) {
    case 'farmer': {
      const field = pick(g.cellsOf('farmland'))
      return field ? [field, 2] : [pick(g.things('fixture/nature/haystack')) ?? step, 3]
    }
    case 'merchant':
    case 'peddler': {
      const stall = pick(g.things('fixture/furniture/stall'))
      return stall ? [stall, 1] : street()
    }
    case 'priest':
      return [pick([...g.things('fixture/sacred/altar'), ...g.things('fixture/sacred/statue')]) ?? square, 3]
    case 'guard':
      return kind === 'fort' || kind === 'cathedral' ? [pick(g.things('fixture/light/brazier')) ?? square, 3] : rng.chance(0.4) ? [square, 5] : [[g.middle()[0], rng.chance(0.5) ? 2 : g.h - 3], 3]
    case 'soldier':
      return [pick([...g.things('fixture/dummy'), ...g.things('fixture/furniture/rack')]) ?? square, 4]
    case 'fisher':
      return [pick(g.shore()) ?? square, 2]
    case 'hunter':
      return [[rng.chance(0.5) ? 3 : g.w - 4, rng.int(4, g.h - 5)], 3]
    case 'herbalist':
      return [[rng.int(3, g.w - 4), rng.chance(0.5) ? 3 : g.h - 4], 3]
    case 'child':
      return rng.chance(0.4) ? [square, 8] : [step, 4]
    case 'bard':
    case 'beggar':
    case 'traveler':
    case 'noble':
      return rng.chance(0.4) ? [square, 6] : street()
    default:
      return rng.chance(0.5) ? [step, 4] : rng.chance(0.75) ? street() : [square, 7]
  }
}

/** The people of one place and the rooms behind its doors, made into the place's map's things (each with what they carry). */
export function peoplePlace(chunk: RawChunk, rooms: RawChunk[], p: Place, onto: OntologyIndex): Entity[] {
  if (p.sealed) return []
  reseed(p.seed ^ 0x5eed)
  const map = chunk.map.id
  const g = new Ground(chunk, onto)
  const byId = new Map(rooms.map((r) => [r.map.id, r]))
  // each door's room, and the step before it outside
  const rs: Room[] = []
  for (const portal of chunk.map.portals) {
    const r = byId.get(portal.to)
    if (!r || rs.some((x) => x.id === r.map.id)) continue
    const role = r.map.id.slice(map.length + 1).replace(/-\d+$/, '') as Role
    rs.push({ id: r.map.id, role, g: new Ground(r, onto), step: [portal.x, portal.y + 1] })
  }
  const streets = g.cellsOf('cobble', 'path', 'dirt', 'gravel')
  const evenings = [...g.things('fixture/water/well'), ...g.things('fixture/water/fountain'), ...g.things('fixture/light/campfire'), ...g.things('fixture/furniture/bench')]
  const families = new Set<string>()
  const out: Entity[] = []
  let n = 0
  const make = (role: string, house: { id: string; family: { en: string; zh: string }; room?: Room; names: Set<string> }) => {
    const id = `${map}.folk${n++}`
    const sex = rng.chance(0.5) ? 'female' : 'male'
    const [lo, hi] = AGE[role] ?? [18, 58]
    const age = rng.int(lo, hi)
    const given = GIVEN[p.region] ?? GIVEN.frostfang
    let first = rng.pick(given[sex])
    for (let k = 0; k < 8 && house.names.has(first[0]); k++) first = rng.pick(given[sex])
    house.names.add(first[0])
    const room = house.room
    const at = (m: string, c: Cell) => ({ map: m, x: c[0], y: c[1] })
    // a cell of their own in their room beside one of its things (a bed, the table, the anvil)
    const inside = (prefix: string, r = 1): Cell => {
      const by = room!.g.things(prefix)
      return room!.g.spot(by.length ? rng.pick(by) : room!.g.middle(), r) ?? room!.g.middle()
    }
    // where they sleep and eat: in their room (with none — a shrine's pilgrims — beside the place's middle)
    const bed = room ? at(room.id, inside('fixture/furniture/bed')) : at(map, g.spot(g.middle(), 4) ?? g.middle())
    const meal = room ? at(room.id, inside('fixture/furniture/table', 2)) : bed
    // at work: indoors at their trade's thing in their own room, else out of doors
    const indoors = INDOORS[role] ?? (rng.chance(HOMEBOUND[role] ?? 0) ? CHORES : [])
    const trade = room ? indoors.filter((t) => room.g.things(t).length) : []
    const [wc, wr] = outdoorWork(role, g, room?.step ?? g.middle(), p.kind, streets)
    const work = trade.length ? at(room!.id, inside(rng.pick(trade), 2)) : at(map, g.spot(wc, wr) ?? wc)
    // the evening: out at the well, the fountain, the fire or a bench, or along the street — or at home
    const goesOut = rng.chance(role === 'child' ? 0.2 : 0.45)
    const evening = goesOut ? at(map, g.spot(evenings.length && rng.chance(0.5) ? rng.pick(evenings) : rng.pick(streets.length ? streets : [g.middle()]), evenings.length ? 6 : 2) ?? g.middle()) : meal
    const night = role === 'guard' && (p.kind === 'town' || p.kind === 'city') && n % 3 === 0
    const wake = role === 'child' ? 7 : rng.int(5, 7)
    const sleep = role === 'child' ? 20 : rng.int(21, 22)
    const doing = role === 'child' ? 'play' : role === 'elder' ? 'sit' : 'work'
    const schedule: ScheduleEntry[] = night
      ? [
          { from: 8, to: 16, ...bed, activity: 'sleep' },
          { from: 16, to: 8, ...work, activity: 'watch' },
        ]
      : [
          { from: sleep, to: wake, ...bed, activity: 'sleep' },
          { from: wake, to: 12, ...work, activity: doing },
          { from: 12, to: 13, ...meal, activity: 'eat' },
          { from: 13, to: 18, ...work, activity: doing },
          { from: 18, to: sleep, ...evening, activity: 'rest' },
        ]
    // they begin where a new game's morning has them (six o'clock: most of them abed)
    const now = schedule.find((s) => (s.from <= s.to ? 6 >= s.from && 6 < s.to : 6 >= s.from || 6 < s.to)) ?? schedule[0]
    const stock = STOCK[role] && (role !== 'priest' || p.kind === 'shrine' || room?.role === 'chapel') ? STOCK[role] : undefined
    const purse = PURSE[role] ?? rng.int(2, 6)
    const carried: Entity[] = [
      ...(stock ?? []).flatMap(([form, k], i) => Array.from({ length: k }, (_, j) => ({ ...itemOf(form, `${id}.s${i}.${j}`), id: `${id}.s${i}.${j}`, place: { on: 'inside' as const, holder: id } }))),
      ...Array.from({ length: purse }, (_, i) => ({ id: `${id}.coin${i}`, type: SOCIAL_COIN, place: { on: 'inside' as const, holder: id } })),
    ]
    const tags = [...(age < 18 ? ['minor'] : []), ...(stock ? ['merchant'] : [])]
    const lines: LineDef[] = linesFor(role, p.region, (xs) => rng.pick(xs))
    out.push({
      id,
      type: `actor/person/${role}`,
      name: { en: `${first[0]} ${house.family.en}`, zh: `${first[1]}·${house.family.zh}` },
      place: { on: 'tile', map: now.map, x: now.x, y: now.y },
      facing: 'down',
      props: {
        age,
        household: house.id,
        purse,
        favourite: favouriteFor(id, age),
        ...(FIGHTS.has(role) && { fights: true }),
        ...(stock && { stock: stock.map(([form, k]) => `${form}*${k}`).join('|') }),
      },
      ...(tags.length && { tags }),
      ...(carried.length && { contents: carried.map((c) => c.id) }),
      look: generateLook(id, { sex, age, role }),
      npc: { role, schedule, fidelity: 'local', person: { lines } },
    })
    out.push(...carried)
  }
  // a household to a room
  rs.forEach((room, i) => {
    const house = { id: `${map}.h${i}`, family: familyName(p.region, (xs) => rng.pick(xs), families), room, names: new Set<string>() }
    for (const role of household(room.role, p)) make(role, house)
    // the room is theirs, and so is what it keeps (phase D's stock): taking from it is taking what is another's, as at
    // the Ford's doorsteps (docs/npc-sandbox.md §2.1)
    const m = room.g.chunk.map
    m.regions = { ...m.regions, home: [0, 0, m.width, m.height] }
    m.regionProps = { ...m.regionProps, home: { owner: `household:${house.id}` } }
  })
  // a shrine keeps its keeper and the pilgrims who sleep by it (no roof over them)
  if (!rs.length && p.kind === 'shrine') {
    const house = { id: `${map}.h0`, family: familyName(p.region, (xs) => rng.pick(xs), families), names: new Set<string>() }
    for (const role of ['priest', ...Array.from({ length: rng.int(1, 2) }, () => 'traveler')]) make(role, house)
  }
  return out
}

/** Every backdrop place's people, laid into its map's file (the continent's places by id). The people made, by map. */
export function peopleBackdrop(chunks: RawChunk[], c: Continent): Map<string, number> {
  const onto = new OntologyIndex(buildOntology())
  const places = new Map(c.places.map((p) => [p.id, p]))
  const counts = new Map<string, number>()
  for (const ch of chunks) {
    const p = places.get(ch.map.id)
    if (!p) continue
    const rooms = chunks.filter((r) => r.map.kind === 'interior' && r.map.id.startsWith(`${p.id}.`))
    const made = peoplePlace(ch, rooms, p, onto)
    if (!made.length) continue
    ch.entities.push(...made)
    counts.set(ch.map.id, made.filter((e) => e.npc).length)
  }
  return counts
}
