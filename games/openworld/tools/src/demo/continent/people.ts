// The backdrop's people (docs/continent.md §9 C): some three thousand, by settlement. Each place's people are
// households — a house's door is a household's, its family name theirs — with roles by the place's kind and its region
// (a town's merchants and guards, a farm's family, a fort's garrison, a camp's hunters or pilgrims), a look drawn from
// their id (content looks.ts), a day kept within their own map (sleep at their door, work where their role has them,
// a meal at home, the evening at the well or the fire), a trade where it fits (a stall's merchant, a smith, an
// innkeeper: their stock and their coin, as the Ford's people carry theirs), and names in both languages. They are
// the backdrop's own (`npc.fidelity: 'local'`): made with their map, kept as what differs from it, never routed off it,
// never in the wiki. A pass over the built maps: the templates (backdrop.ts) are free to change under it.

import { OntologyIndex, type Entity, type LineDef, type ScheduleEntry } from '@openworld/engine'
import { SOCIAL_COIN, TERRAIN_CHARS, buildOntology, favouriteFor, generateLook, type RawChunk } from '@openworld-game/content'
import { itemOf, reseed, rng } from '../builder.ts'
import { GIVEN, familyName, linesFor } from './folk.ts'
import type { Continent, Place } from './generate.ts'

/** How many people a kind of place has, and what they do: roles every such place has, then the rest by weight. */
interface Plan {
  n: number
  fixed: [string, number][]
  weights: [string, number][]
  /** The largest household (a house's beds). */
  house: number
}

const PLANS: Record<string, Plan> = {
  village: { n: 32, house: 5, fixed: [['elder', 1], ['smith', 1], ['innkeeper', 1], ['merchant', 1], ['herbalist', 1]], weights: [['villager', 5], ['farmer', 5], ['child', 4], ['fisher', 1], ['hunter', 1], ['beggar', 0.3]] },
  town: { n: 45, house: 6, fixed: [['merchant', 3], ['guard', 3], ['smith', 1], ['innkeeper', 1], ['priest', 1], ['herbalist', 1]], weights: [['villager', 6], ['child', 4], ['farmer', 1], ['traveler', 1], ['bard', 0.4], ['beggar', 0.6], ['scholar', 0.4], ['peddler', 0.5]] },
  city: { n: 80, house: 7, fixed: [['merchant', 5], ['guard', 6], ['smith', 2], ['innkeeper', 2], ['priest', 2], ['scholar', 1], ['noble', 2], ['herbalist', 1], ['bard', 1]], weights: [['villager', 7], ['child', 4], ['traveler', 2], ['beggar', 1], ['peddler', 1]] },
  farm: { n: 8, house: 8, fixed: [['farmer', 2], ['elder', 1]], weights: [['farmer', 2], ['child', 2], ['villager', 1]] },
  mill: { n: 7, house: 7, fixed: [['villager', 1], ['merchant', 1]], weights: [['farmer', 2], ['child', 2], ['villager', 1]] },
  camp: { n: 10, house: 3, fixed: [], weights: [['traveler', 1]] },
  shrine: { n: 3, house: 3, fixed: [['priest', 1]], weights: [['traveler', 1]] },
  cathedral: { n: 14, house: 7, fixed: [['priest', 6], ['scholar', 2], ['guard', 2]], weights: [['priest', 2], ['villager', 1]] },
  fort: { n: 16, house: 8, fixed: [['guard', 3], ['smith', 1]], weights: [['soldier', 1]] },
}

/** Who keeps a camp, by region: hunters on the coast, sellswords in the March, traders on the plains, reed-cutters in the fens, pilgrims round the Altar and the City. */
const CAMP: Record<string, [string, number][]> = {
  frostfang: [['hunter', 3], ['traveler', 1]],
  redmarch: [['soldier', 3], ['traveler', 1]],
  tithe: [['peddler', 2], ['merchant', 1], ['traveler', 2]],
  palefen: [['fisher', 3], ['herbalist', 1]],
  altar: [['traveler', 3], ['priest', 1]],
  holy: [['traveler', 3], ['bard', 1], ['peddler', 1]],
}

/** What a trade sells (forms of the world's items), and how much coin each carries. */
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
/** Roles of the young and the old. */
const AGE: Record<string, [number, number]> = { child: [6, 15], elder: [60, 80], noble: [30, 65], scholar: [25, 70] }

type Cell = [number, number]
const key = (x: number, y: number) => `${x},${y}`

/** A built map as the people pass reads it: where one may stand, its doors, what stands where. */
class Ground {
  w: number
  h: number
  terrain: string[]
  free = new Set<string>()
  taken = new Set<string>()
  constructor(public chunk: RawChunk, onto: OntologyIndex) {
    const m = chunk.map
    this.w = m.width
    this.h = m.height
    this.terrain = m.rows.flatMap((r) => [...r].map((c) => TERRAIN_CHARS[c] ?? 'void'))
    const solid = new Set<string>()
    for (const e of chunk.entities) if (e.place.on === 'tile' && onto.resolve(e.type).solid) solid.add(key(e.place.x, e.place.y))
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
  /** The doors of its houses (the cell one stands in front of each). */
  doors(): Cell[] {
    const out: Cell[] = []
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.at(x, y) === 'door') out.push([x, y])
    return out
  }
  /** The free cell nearest a cell (by rings), one not taken yet unless `share`. */
  near([cx, cy]: Cell, share = false): Cell | undefined {
    for (let r = 0; r < 12; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          const k = key(cx + dx, cy + dy)
          if (this.free.has(k) && (share || !this.taken.has(k))) return [cx + dx, cy + dy]
        }
    return undefined
  }
  /** A cell of one's own within `r` of a place (a post at work, a seat in the evening): taken, so no two share it. */
  spot(c: Cell, r: number): Cell | undefined {
    const cells: Cell[] = []
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const k = key(c[0] + dx, c[1] + dy)
      if (this.free.has(k) && !this.taken.has(k)) cells.push([c[0] + dx, c[1] + dy])
    }
    const out = cells.length ? rng.pick(cells) : this.near(c)
    if (out) this.taken.add(key(...out))
    return out
  }
  /** A cell kept for one person (a bed, a post): taken, so the next is beside it. */
  claim(c: Cell): Cell | undefined {
    const n = this.near(c)
    if (n) this.taken.add(key(...n))
    return n
  }
  /** The cells of a terrain (farmland, the water's edge) and of a kind of thing (a well, a stall). */
  cellsOf(terrain: string): Cell[] {
    const out: Cell[] = []
    for (let y = 1; y < this.h - 1; y++) for (let x = 1; x < this.w - 1; x++) if (this.at(x, y) === terrain && this.free.has(key(x, y))) out.push([x, y])
    return out
  }
  things(prefix: string): Cell[] {
    return this.chunk.entities.filter((e) => e.place.on === 'tile' && e.type.startsWith(prefix)).map((e) => [(e.place as { x: number }).x, (e.place as { y: number }).y] as Cell)
  }
  /** Beside water (a fisher's spot). */
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

/** Where a role spends its working hours on this map: a place and how far round it (each person a cell of their own there). */
function workAt(role: string, g: Ground, home: Cell, kind: string, streets: Cell[]): [Cell, number] {
  const pick = (cs: Cell[]) => (cs.length ? rng.pick(cs) : undefined)
  const square = pick([...g.things('fixture/water/well'), ...g.things('fixture/water/fountain'), ...g.things('fixture/light/campfire')]) ?? g.middle()
  const holy = pick([...g.things('fixture/sacred/altar'), ...g.things('fixture/sacred/statue')])
  const street = (): [Cell, number] => [pick(streets) ?? square, 2]
  switch (role) {
    case 'farmer': {
      const field = pick(g.cellsOf('farmland'))
      return field ? [field, 2] : [pick(g.things('fixture/nature/haystack')) ?? home, 3]
    }
    case 'merchant':
    case 'peddler': {
      // a stall if there is one free, else before one's own door (the shop is the house)
      const stall = pick(g.things('fixture/furniture/stall'))
      return stall && rng.chance(0.5) ? [stall, 1] : [home, 2]
    }
    case 'priest':
      return [holy ?? square, 3]
    case 'guard':
      return kind === 'fort' || kind === 'cathedral' ? [pick(g.things('fixture/light/brazier')) ?? square, 3] : rng.chance(0.4) ? [square, 5] : [[g.middle()[0], rng.chance(0.5) ? 2 : g.h - 3], 3]
    case 'soldier':
      return [pick([...g.things('fixture/dummy'), ...g.things('fixture/furniture/rack')]) ?? square, 4]
    case 'fisher':
      return [pick(g.shore()) ?? square, 2]
    case 'hunter':
      return [[rng.chance(0.5) ? 3 : g.w - 4, rng.int(4, g.h - 5)], 3]
    case 'smith':
    case 'innkeeper':
      return [home, 2]
    case 'child':
      return rng.chance(0.35) ? [square, 8] : [home, 4]
    case 'elder':
      return rng.chance(0.5) ? [square, 6] : [home, 2]
    case 'bard':
    case 'beggar':
    case 'traveler':
      return rng.chance(0.4) ? [square, 6] : street()
    default:
      // a villager: about their own house and yard, along the streets, now and then the square
      return rng.chance(0.5) ? [home, 4] : rng.chance(0.75) ? street() : [square, 7]
  }
}

/** A day within the map: asleep at home, at work, a meal at home, at work again, the evening out, home to bed. */
function dayOf(role: string, map: string, home: Cell, work: Cell, evening: Cell, night: boolean): ScheduleEntry[] {
  const at = (c: Cell) => ({ map, x: c[0], y: c[1] })
  // the watch at night: asleep by day, on the street all night
  if (night) return [{ from: 8, to: 16, ...at(home), activity: 'sleep' }, { from: 16, to: 8, ...at(work), activity: 'watch' }]
  const wake = role === 'child' ? 7 : rng.int(5, 7)
  const sleep = role === 'child' ? 20 : rng.int(21, 22)
  const doing = role === 'child' ? 'play' : role === 'elder' ? 'sit' : 'work'
  return [
    { from: sleep, to: wake, ...at(home), activity: 'sleep' },
    { from: wake, to: 12, ...at(work), activity: doing },
    { from: 12, to: 13, ...at(home), activity: 'eat' },
    { from: 13, to: 18, ...at(work), activity: doing },
    { from: 18, to: sleep, ...at(evening), activity: 'rest' },
  ]
}

const pickWeighted = (ws: [string, number][]): string => {
  const total = ws.reduce((n, [, w]) => n + w, 0)
  let r = rng.next() * total
  for (const [k, w] of ws) if ((r -= w) <= 0) return k
  return ws[ws.length - 1][0]
}

/** The roles of a place's people. */
function rolesOf(p: Place): string[] {
  const plan = PLANS[p.kind]
  if (!plan) return []
  const n = p.capital ? Math.round(plan.n * 1.25) : plan.n
  const out: string[] = []
  for (const [role, k] of plan.fixed) for (let i = 0; i < k; i++) out.push(role)
  const weights = p.kind === 'camp' ? (CAMP[p.region] ?? CAMP.frostfang) : plan.weights
  while (out.length < n) out.push(pickWeighted(weights))
  return out
}

/** The people of one place, made into its map's things (each with what they carry). */
export function peoplePlace(chunk: RawChunk, p: Place, onto: OntologyIndex): Entity[] {
  const roles = rolesOf(p)
  if (!roles.length || p.sealed) return []
  reseed(p.seed ^ 0x5eed)
  const g = new Ground(chunk, onto)
  const map = chunk.map.id
  const doors = g.doors().map(([x, y]) => [x, y + 1] as Cell).filter(([x, y]) => g.near([x, y], true))
  // no house (a camp's tents, a shrine): they sleep round the middle
  const homes: Cell[] = doors.length ? doors : Array.from({ length: Math.ceil(roles.length / 3) }, (_, i) => [g.middle()[0] + ((i % 4) - 2) * 3, g.middle()[1] + Math.floor(i / 4) * 3 - 3] as Cell)
  const plan = PLANS[p.kind]!
  // households: a house each, filled in turn — a family's adults first, its children after
  const order = [...roles.filter((r) => r !== 'child'), ...roles.filter((r) => r === 'child')]
  const families = new Set<string>()
  const houses = homes.map((home, i) => ({ id: `${map}.h${i}`, home, family: familyName(p.region, (xs) => rng.pick(xs), families), members: 0 }))
  const streets = [...g.cellsOf('cobble'), ...g.cellsOf('path'), ...g.cellsOf('dirt')]
  const evenings = [...g.things('fixture/water/well'), ...g.things('fixture/water/fountain'), ...g.things('fixture/light/campfire'), ...g.things('fixture/furniture/bench')]
  const out: Entity[] = []
  const names = new Set<string>()
  order.forEach((role, i) => {
    // the next house with room (children go to the houses that have grown-ups)
    const house = houses[i % houses.length].members < plan.house ? houses[i % houses.length] : (houses.find((h) => h.members < plan.house) ?? houses[i % houses.length])
    house.members++
    const id = `${map}.folk${i}`
    const sex = rng.chance(0.5) ? 'female' : 'male'
    const [lo, hi] = AGE[role] ?? [18, 58]
    const age = rng.int(lo, hi)
    const given = GIVEN[p.region] ?? GIVEN.frostfang
    let first = rng.pick(given[sex])
    for (let k = 0; k < 6 && names.has(`${first[0]} ${house.family.en}`); k++) first = rng.pick(given[sex])
    names.add(`${first[0]} ${house.family.en}`)
    const home = g.claim(house.home) ?? g.near(house.home, true) ?? g.middle()
    const [wc, wr] = workAt(role, g, home, p.kind, streets)
    const work = g.spot(wc, wr) ?? home
    // the evening: at the well, the fountain, the fire or a bench, else at home
    const evening = (evenings.length && role !== 'child' && rng.chance(0.35) ? g.spot(rng.pick(evenings), 7) : rng.chance(0.4) ? g.spot(rng.pick(streets.length ? streets : [house.home]), 2) : g.spot(house.home, 2)) ?? home
    // a town's or a city's watch keeps the streets at night too: a guard in three
    const night = role === 'guard' && (p.kind === 'town' || p.kind === 'city') && i % 3 === 0
    const schedule = dayOf(role, map, home, work, evening, night)
    const now = schedule.find((s) => (s.from <= s.to ? 6 >= s.from && 6 < s.to : 6 >= s.from || 6 < s.to)) ?? schedule[0]
    const stand = g.claim([now.x, now.y]) ?? [now.x, now.y]
    const stock = STOCK[role] && (role !== 'priest' || p.kind === 'cathedral' || p.kind === 'shrine') && (role !== 'fisher' || p.kind !== 'camp' || rng.chance(0.5)) ? STOCK[role] : undefined
    const purse = PURSE[role] ?? (role === 'child' ? 1 : rng.int(2, 6))
    const carried: Entity[] = [
      ...(stock ?? []).flatMap(([form, n], k) => Array.from({ length: n }, (_, j) => ({ ...itemOf(form, `${id}.s${k}.${j}`), id: `${id}.s${k}.${j}`, place: { on: 'inside' as const, holder: id } }))),
      ...Array.from({ length: purse }, (_, k) => ({ id: `${id}.coin${k}`, type: SOCIAL_COIN, place: { on: 'inside' as const, holder: id } })),
    ]
    const tags = [...(age < 18 ? ['minor'] : []), ...(stock ? ['merchant'] : [])]
    const lines: LineDef[] = linesFor(role, p.region, (xs) => rng.pick(xs))
    out.push({
      id,
      type: `actor/person/${role}`,
      name: { en: `${first[0]} ${house.family.en}`, zh: `${first[1]}·${house.family.zh}` },
      place: { on: 'tile', map, x: stand[0], y: stand[1] },
      facing: 'down',
      props: {
        age,
        household: house.id,
        purse,
        favourite: favouriteFor(id, age),
        ...(FIGHTS.has(role) && { fights: true }),
        ...(stock && { stock: stock.map(([form, n]) => `${form}*${n}`).join('|') }),
      },
      ...(tags.length && { tags }),
      ...(carried.length && { contents: carried.map((c) => c.id) }),
      look: generateLook(id, { sex, age, role }),
      npc: { role, schedule, fidelity: 'local', person: { lines } },
    })
    out.push(...carried)
  })
  return out
}

/** Every backdrop map's people, laid into its chunk (the continent's places by id). The people made, by map. */
export function peopleBackdrop(chunks: RawChunk[], c: Continent): Map<string, number> {
  const onto = new OntologyIndex(buildOntology())
  const places = new Map(c.places.map((p) => [p.id, p]))
  const counts = new Map<string, number>()
  for (const ch of chunks) {
    const p = places.get(ch.map.id)
    if (!p) continue
    const made = peoplePlace(ch, p, onto)
    if (!made.length) continue
    ch.entities.push(...made)
    counts.set(ch.map.id, made.filter((e) => e.npc).length)
  }
  return counts
}
