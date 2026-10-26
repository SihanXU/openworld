// The showcase maps (docs/showcase.md): hand-made places that take the Holy City's backdrop places' files — the abbey's
// cathedral and close, the North Gate's fortress, the Bell Ward's grand square, the Market, the Lamp Ward and the Lower
// Town — each laid out from the great places they learn from, built from the project's own buildings
// (tools/src/art/arch), lived in by people of their own (cast.ts). They stay backdrop (no tale is told there yet): a
// place's map and the halls and rooms behind its doors, made here instead of by its kind. The five quarters are one
// walk, each street running on into the next (their edges joined), round the Most Holy Hall they stand about.

import { Rng } from '@openworld/engine'
import { linkEdge, type MapBuilder } from '../builder.ts'
import type { Place } from '../continent/generate.ts'
import { stockMap, stockPlace, stockRoom } from '../continent/stock.ts'
import { abbeyClose } from './abbey.ts'
import { northGate, FORT_EAST } from './fort.ts'
import { bellWard, BELL_SOUTH, BELL_WEST } from './bellward.ts'
import { market, MARKET_NORTH, MARKET_SOUTH } from './market.ts'
import { lampWard, LAMP_NORTH, LAMP_WEST } from './lampward.ts'
import { lowerTown, LOWER_EAST } from './lowertown.ts'
import { rimeholm } from './rimeholm.ts'
import { warcombe } from './warcombe.ts'
import { weighmarket } from './weighmarket.ts'
import { duskMoorings } from './duskmoorings.ts'
import { highheath } from './highheath.ts'
import { barleyridge } from './barleyridge.ts'
import { brandby } from './brandby.ts'

const MAKERS: Record<string, (p: Place) => MapBuilder[]> = {
  'holy.sunwell-abbey': abbeyClose,
  'holy.quarter-1': northGate,
  'holy.quarter-2': bellWard,
  'holy.quarter-3': market,
  'holy.quarter-4': lampWard,
  'holy.quarter-5': lowerTown,
  // the regions' places (docs/showcase.md §4b)
  'frostfang.rimeholm': rimeholm,
  'redmarch.warcombe': warcombe,
  'tithe.weighmarket': weighmarket,
  'palefen.dusk-moorings': duskMoorings,
  'altar.highheath-abbey': highheath,
  // a farm village and a mine with what it broke into (docs/showcase.md §4c)
  'tithe.barleyridge-farm': barleyridge,
  'redmarch.brandby-mine': brandby,
}

/** The roles a room behind a door has (continent/rooms.ts): stocked as such. */
const ROLES = new Set(['home', 'farmhouse', 'mill', 'smithy', 'shop', 'teahouse', 'inn', 'chapel', 'tent', 'barracks', 'cell'])
/** What a showcase's own halls keep (stock.ts's uses). */
const HALL_USE: Record<string, string> = {
  nave: 'temple', crypt: 'dungeon', belfry: 'temple', library: 'library', refectory: 'inn', hall: 'home', solar: 'home',
  boathouse: 'shop', longhall: 'home', warhall: 'home', armoury: 'smithy', hospital: 'temple', counting: 'shop', granary: 'farm', poorhouse: 'home',
  ossuary: 'temple', healer: 'shop', chapel: 'temple', catacombs: 'dungeon', barn: 'farm', farmhouse: 'home', workings: 'dungeon', oldworks: 'dungeon',
}

/** A showcase place's maps, made, and stocked as the backdrop's are (stock.ts): the place's, its rooms', its halls'. */
function make(p: Place, maker: (p: Place) => MapBuilder[]): MapBuilder[] {
  const maps = maker(p)
  for (const m of maps) {
    if (m.id === p.id) stockPlace(m, p)
    else {
      const what = m.id.slice(p.id.length + 1)
      if (ROLES.has(what.replace(/-\d+$/, ''))) stockRoom(m, p)
      else stockMap(m, p.region, (p.id === 'holy.quarter-3' && what === 'hall' ? 'shop' : HALL_USE[what] ?? 'home') as never, new Rng([...m.id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 0x01000193), 0x811c9dc5) | 0))
    }
  }
  return maps
}

/** The places the showcase makes (their ids in the continent). */
export const SHOWCASE_PLACES = Object.keys(MAKERS)

export const SHOWCASE: Record<string, (p: Place) => MapBuilder[]> = Object.fromEntries(Object.entries(MAKERS).map(([id, f]) => [id, (p: Place) => make(p, f)]))

/** Cells along an edge: x fixed and y from a to b, or y fixed and x from a to b. */
const column = (x: number, [a, b]: [number, number]): [number, number][] => Array.from({ length: b - a + 1 }, (_, i) => [x, a + i])
const row = (y: number, [a, b]: [number, number]): [number, number][] => Array.from({ length: b - a + 1 }, (_, i) => [a + i, y])

/**
 * The quarters' streets joined across their edges (after every place's maps are made, before they are written): the
 * North Gate's street east into the Bell Ward's Processional Way, the Bell Ward's way south through the tower gate into
 * the Market, the Market's south into the Lamp Ward, the Lamp Ward's street west into the Lower Town.
 */
export function joinShowcase(all: MapBuilder[]): void {
  const by = (id: string) => all.find((m) => m.id === id)
  const q1 = by('holy.quarter-1')
  const q2 = by('holy.quarter-2')
  const q3 = by('holy.quarter-3')
  const q4 = by('holy.quarter-4')
  const q5 = by('holy.quarter-5')
  if (!q1 || !q2 || !q3 || !q4 || !q5) return
  linkEdge(q1, column(q1.w - 1, FORT_EAST), [-1, 0], q2, column(0, BELL_WEST), [1, 0])
  linkEdge(q2, row(q2.h - 1, BELL_SOUTH), [0, -1], q3, row(0, MARKET_NORTH), [0, 1])
  linkEdge(q3, row(q3.h - 1, MARKET_SOUTH), [0, -1], q4, row(0, LAMP_NORTH), [0, 1])
  linkEdge(q4, column(0, LAMP_WEST), [1, 0], q5, column(q5.w - 1, LOWER_EAST), [-1, 0])
}
