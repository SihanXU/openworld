// New halls for the scale film: the showcase's hall plans (art/arch/plans.ts HALLS, their walls the plans' dressed
// shells) furnished again for other uses, the way the showcase furnishes its own (demo/showcase/halls.ts): every part of
// the plan laid with its floor, its back wall lined, its middle set for what the hall is for, rugs down, candles lit, a
// glow over it, its people at their work. A tavern in a chapel's shell is not asked for: each plan takes the uses its
// walls suit.
import type { Entity } from '@openworld/engine'
import { generateLook } from '@openworld-game/content'
import { MapBuilder, ownRandom, type Cell } from '../../../games/openworld/tools/src/demo/builder.ts'
import { glow, lit, planHall } from '../../../games/openworld/tools/src/demo/showcase/halls.ts'
import { HALLS, type Rect } from '../../../games/openworld/tools/src/art/arch/plans.ts'

type Key = keyof typeof HALLS
export type Use = 'tavern' | 'chapel' | 'forge' | 'study' | 'bedchamber' | 'kitchen' | 'shop' | 'cellar' | 'armoury' | 'weavers' | 'council' | 'bath' | 'alchemy' | 'feast'

/** What each use lines its walls with, sets in its middle, lays on its floor, and who works there. */
interface Furnish {
  floors: string[]
  wall: string[]
  side: string[]
  middle: (m: MapBuilder, r: Rect, put: Put, rnd: () => number) => void
  rug?: string
  people: string[]
  glow: string
}
type Put = (type: string, x: number, y: number, extra?: Partial<Entity>) => boolean

const F = 'fixture/'
const table = (put: Put, x: number, y: number, chairs = true) => { put(`${F}furniture/table`, x, y); if (chairs) (put(`${F}furniture/chair`, x - 1, y), put(`${F}furniture/chair`, x + 1, y)); put(`${F}light/candles`, x, y - 1, lit) }
/** A long table down a run of cells, a bench along each side. */
const board = (put: Put, x: number, y: number, n: number) => { for (let i = 0; i < n; i++) (put(`${F}furniture/table/long`, x + i, y), put(`${F}furniture/bench`, x + i, y - 1), put(`${F}furniture/bench`, x + i, y + 1)) }
/** Rows of a thing across the middle of a part, `gap` between. */
const rows = (put: Put, r: Rect, type: string, gapX: number, gapY: number, x0 = 1, y0 = 2) => { for (let y = r.y + y0; y < r.y + r.h - 1; y += gapY) for (let x = r.x + x0; x < r.x + r.w - 1; x += gapX) put(type, x, y) }

const USES: Record<Use, Furnish> = {
  tavern: { floors: ['floor_wood', 'parquet'], rug: 'carpet', wall: [`${F}container/barrel`, `${F}container/shelf`, `${F}container/barrel`, `${F}furniture/rack`], side: [`${F}container/barrel`, `${F}light/lantern`],
    middle: (m, r, put) => { for (let y = r.y + 2; y < r.y + r.h - 2; y += 3) for (let x = r.x + 2; x < r.x + r.w - 2; x += 4) table(put, x, y) }, people: ['villager', 'merchant', 'guard', 'villager'], glow: '#ff9a4a' },
  feast: { floors: ['flagstone', 'floor_wood'], rug: 'runner', wall: [`${F}standard`, `${F}container/cupboard`, `${F}standard`, `${F}light/candelabrum`], side: [`${F}light/candelabrum`, `${F}container/barrel`],
    middle: (m, r, put) => { const n = Math.max(3, r.w - 6); for (let y = r.y + 2; y < r.y + r.h - 1; y += 4) board(put, r.x + 3, y, n) }, people: ['noble', 'guard', 'villager', 'noble'], glow: '#ffb35c' },
  chapel: { floors: ['marble', 'flagstone'], rug: 'runner', wall: [`${F}sacred/statue`, `${F}light/candelabrum`, `${F}sacred/saint`, `${F}light/candelabrum`], side: [`${F}light/candles`, `${F}sacred/statue/martyr`],
    middle: (m, r, put) => { const cx = r.x + Math.floor(r.w / 2); put(`${F}sacred/altar`, cx, r.y + 1); put(`${F}sacred/lectern`, cx - 2, r.y + 2); for (let y = r.y + 3; y < r.y + r.h - 1; y += 2) for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (Math.abs(x - cx) > 1) put(`${F}furniture/pew`, x, y) }, people: ['priest', 'villager', 'villager'], glow: '#ffe2a8' },
  forge: { floors: ['floor_stone', 'flagstone'], wall: [`${F}furniture/rack/arms`, `${F}craft/forge`, `${F}furniture/rack`, `${F}container/barrel`], side: [`${F}container/crate`, `${F}nature/logpile/stack`],
    middle: (m, r, put) => { put(`${F}craft/forge`, r.x + 2, r.y + 1, lit); put(`${F}craft/anvil`, r.x + 3, r.y + 3); put(`${F}craft/workbench`, r.x + r.w - 3, r.y + 2); put(`${F}craft/anvil`, r.x + r.w - 4, r.y + 4); put(`${F}dummy`, r.x + Math.floor(r.w / 2), r.y + r.h - 2) }, people: ['smith', 'smith', 'guard'], glow: '#ff7a2a' },
  study: { floors: ['parquet', 'floor_wood'], rug: 'carpet', wall: [`${F}container/bookcase`, `${F}container/bookshelf`, `${F}container/bookcase`, `${F}light/candelabrum`], side: [`${F}container/bookshelf`, `${F}furniture/bookstand`],
    middle: (m, r, put) => { for (let x = r.x + 2; x < r.x + r.w - 2; x += 4) { put(`${F}furniture/desk`, x, r.y + 3); put(`${F}furniture/chair`, x, r.y + 4); put(`${F}light/candles`, x + 1, r.y + 3, lit) } put(`${F}furniture/bookstand`, r.x + Math.floor(r.w / 2), r.y + r.h - 2) }, people: ['scholar', 'priest', 'scholar'], glow: '#ffd28a' },
  bedchamber: { floors: ['floor_wood', 'parquet'], rug: 'carpet', wall: [`${F}furniture/bed`, `${F}container/drawers`, `${F}furniture/bed`, `${F}container/wardrobe`], side: [`${F}furniture/mirror`, `${F}container/chest`],
    middle: (m, r, put) => { table(put, r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2) + 1) }, people: ['villager', 'noble'], glow: '#ffc46b' },
  kitchen: { floors: ['flagstone', 'floor_stone'], wall: [`${F}container/cupboard`, `${F}craft/cauldron`, `${F}container/shelf`, `${F}container/pot`], side: [`${F}container/sack`, `${F}container/barrel`],
    middle: (m, r, put) => { put(`${F}craft/cauldron`, r.x + 2, r.y + 2, lit); for (let x = r.x + 3; x < r.x + r.w - 3; x++) put(`${F}furniture/counter`, x, r.y + 3); table(put, r.x + Math.floor(r.w / 2), r.y + r.h - 2) }, people: ['cook', 'villager', 'cook'], glow: '#ff9a4a' },
  shop: { floors: ['floor_wood', 'parquet'], rug: 'carpet', wall: [`${F}container/shelf`, `${F}container/cupboard`, `${F}container/shelf`, `${F}container/drawers`], side: [`${F}container/crate`, `${F}container/sack`],
    middle: (m, r, put) => { for (let x = r.x + 2; x < r.x + r.w - 2; x++) put(`${F}furniture/counter/store`, x, r.y + 3); put(`${F}furniture/stall`, r.x + 2, r.y + r.h - 2); put(`${F}container/crate`, r.x + r.w - 3, r.y + r.h - 2) }, people: ['merchant', 'villager', 'villager'], glow: '#ffc46b' },
  cellar: { floors: ['floor_stone', 'flagstone'], wall: [`${F}container/barrel`, `${F}container/barrel`, `${F}container/crate`, `${F}container/sack`], side: [`${F}container/barrel`, `${F}container/pot`],
    middle: (m, r, put) => { const cx = r.x + Math.floor(r.w / 2), cy = r.y + Math.floor(r.h / 2); table(put, cx, cy); for (const [dx, dy, t] of [[-3, -1, 'crate'], [-3, 0, 'crate'], [3, -1, 'sack'], [3, 1, 'sack'], [-2, 2, 'pot'], [2, 2, 'barrel']] as const) put(`${F}container/${t}`, cx + dx, cy + dy); put(`${F}light/lantern`, r.x + 1, r.y + r.h - 2, lit) }, people: ['villager', 'merchant'], glow: '#ffb35c' },
  armoury: { floors: ['flagstone', 'floor_stone'], wall: [`${F}furniture/rack/arms`, `${F}furniture/rack/arms`, `${F}standard`, `${F}furniture/rack`], side: [`${F}container/chest`, `${F}dummy`],
    middle: (m, r, put) => { rows(put, r, `${F}dummy`, 3, 3, 2, 2); put(`${F}craft/anvil`, r.x + r.w - 3, r.y + r.h - 2) }, people: ['guard', 'guard', 'smith'], glow: '#ffb35c' },
  weavers: { floors: ['floor_wood', 'parquet'], wall: [`${F}container/shelf`, `${F}furniture/rack`, `${F}container/shelf`, `${F}container/sack`], side: [`${F}container/sack`, `${F}furniture/washing_line`],
    middle: (m, r, put) => { rows(put, r, `${F}craft/loom`, 3, 3, 2, 2) }, people: ['villager', 'villager', 'merchant'], glow: '#ffd28a' },
  council: { floors: ['marble', 'parquet'], rug: 'carpet_royal', wall: [`${F}standard`, `${F}light/candelabrum`, `${F}standard`, `${F}container/bookcase`], side: [`${F}standard`, `${F}light/candelabrum`],
    middle: (m, r, put) => { const cx = r.x + Math.floor(r.w / 2); put(`${F}furniture/throne`, cx, r.y + 1); board(put, cx - 2, r.y + 4, 5) }, people: ['noble', 'guard', 'noble', 'scholar'], glow: '#ffd28a' },
  bath: { floors: ['marble', 'lattice'], wall: [`${F}garden/urn`, `${F}nature/plant`, `${F}garden/urn`, `${F}light/candelabrum`], side: [`${F}garden/bench`, `${F}nature/plant`],
    middle: (m, r, put) => { if (r.w >= 6 && r.h >= 5) m.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 3, 'water'); put(`${F}water/fountain`, r.x + 1, r.y + r.h - 2) }, people: ['noble', 'villager'], glow: '#bfe0ff' },
  alchemy: { floors: ['floor_stone', 'flagstone'], rug: 'carpet', wall: [`${F}container/shelf`, `${F}craft/cauldron`, `${F}container/bookshelf`, `${F}container/pot`], side: [`${F}container/pot`, `${F}furniture/bookstand`],
    middle: (m, r, put) => { put(`${F}craft/cauldron`, r.x + 2, r.y + 3, lit); put(`${F}craft/cauldron`, r.x + r.w - 3, r.y + 3, lit); put(`${F}craft/workbench`, r.x + Math.floor(r.w / 2), r.y + 2); put(`${F}furniture/desk`, r.x + Math.floor(r.w / 2), r.y + r.h - 2) }, people: ['scholar', 'scholar'], glow: '#9adf8a' },
}

/** The uses each plan's walls suit (its own use left out: the showcase has that one). */
export const PLAN_USES: Partial<Record<Key, Use[]>> = {
  crypt: ['chapel', 'cellar'], belfry: ['cellar', 'weavers'], library: ['council', 'feast', 'chapel'], refectory: ['tavern', 'chapel', 'council'],
  greathall: ['council', 'chapel', 'armoury'], solar: ['study', 'bath'], council: ['feast', 'study', 'chapel'], markethall: ['weavers', 'feast', 'armoury'],
  inn: ['shop', 'kitchen', 'weavers'], tavern: ['kitchen', 'shop', 'alchemy'], seatavern: ['shop', 'kitchen', 'cellar'], boathouse: ['weavers', 'armoury', 'feast'],
  longhall: ['council', 'armoury', 'tavern'], warhall: ['feast', 'chapel', 'study'], armoury: ['forge', 'cellar'], hospital: ['bedchamber', 'chapel', 'study'],
  counting: ['study', 'shop', 'council'], granary: ['cellar', 'weavers', 'tavern'], poorhouse: ['kitchen', 'bedchamber', 'tavern'], ossuary: ['chapel', 'cellar'],
  healer: ['alchemy', 'kitchen'], stiltinn: ['shop', 'kitchen', 'bedchamber'], chapel: ['council', 'feast'], barn: ['weavers', 'cellar', 'tavern'],
  farmhouse: ['shop', 'tavern', 'bedchamber'], mill: ['cellar', 'weavers', 'forge'], manorhall: ['feast', 'study', 'bath'], gallery: ['study', 'bath'],
  cellar: ['kitchen', 'alchemy', 'tavern'], undercroft: ['chapel', 'cellar', 'armoury'], drowned: ['bath', 'cellar'], towerhall: ['study', 'alchemy', 'bedchamber'],
  alchemy: ['study', 'kitchen'], observatory: ['study', 'alchemy'], towercellar: ['cellar', 'armoury'], chieflodge: ['feast', 'armoury', 'tavern'],
  garrison: ['armoury', 'tavern', 'forge'], flcook: ['shop', 'bedchamber'], flwatch: ['armoury', 'tavern'], flelder: ['alchemy', 'bedchamber'],
  flwood: ['kitchen', 'weavers'], fllane: ['shop', 'study'], flcabin: ['alchemy', 'kitchen'], flstore: ['tavern', 'weavers'], flsmithy: ['armoury', 'kitchen'],
  flchurch: ['study', 'council'], fthut: ['alchemy', 'kitchen'], mbmill: ['cellar', 'weavers'], dlhut: ['shop', 'alchemy'], rbcabin: ['bedchamber', 'kitchen'],
  prchapel: ['study', 'alchemy'], prhostel: ['tavern', 'bedchamber'], abhall: ['feast', 'study'], abcrypt: ['cellar', 'chapel'], abtomb: ['chapel', 'cellar'],
  erfarm: ['kitchen', 'shop'], catacombs: ['chapel', 'cellar'],
}

/** Each worker's kind of person in the ontology. */
const ROLES: Record<string, string> = { villager: 'villager', merchant: 'merchant', guard: 'guard', priest: 'elder', smith: 'villager', scholar: 'scholar', noble: 'noble', cook: 'innkeeper' }

/** A plan's hall furnished for a use: its map, ready to be written. */
export function furnished(key: Key, use: Use, region: string, n: number): MapBuilder {
  const id = `promo.${key}.${use}.${n}`
  const rnd = ownRandom(id)
  const f = USES[use]
  const floor = f.floors[n % f.floors.length]
  const p = { id, name: { en: `${key} ${use}`, zh: `${key} ${use}` }, region, kind: 'interior', x: 0, y: 0, seed: 1 }
  const { m, P, plan } = planHall(p, key, id, p.name, floor, { outside: true })
  // what is kept clear: the door cells and the way in from them, two cells up
  const taken = new Set<string>()
  for (const [x, y] of plan.doors) for (let k = 0; k < 4; k++) taken.add(`${x},${y - k}`)
  const floorAt = (x: number, y: number) => plan.plan[y]?.[x] === '.'
  const put: Put = (type, x, y, extra = {}) => {
    if (!floorAt(x, y) || taken.has(`${x},${y}`)) return false
    taken.add(`${x},${y}`)
    m.fixture(type, x, y, extra)
    return true
  }
  const parts = Object.entries(P).filter(([name, r]) => r.w * r.h > 4 && name !== 'entry' && !name.startsWith('row'))
  const main = parts.reduce((a, b) => (b[1].w * b[1].h > a[1].w * a[1].h ? b : a), parts[0])
  for (const [name, r] of parts) {
    // a rug down the main part's middle, the back wall lined, its sides
    if (f.rug && name === main[0] && r.w >= 6 && r.h >= 5) m.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 3, f.rug)
    for (let x = r.x, i = 0; x < r.x + r.w; x += 2, i++) put(f.wall[(i + n) % f.wall.length], x, r.y, f.wall[(i + n) % f.wall.length].includes('light/') ? lit : {})
    for (let y = r.y + 2; y < r.y + r.h - 1; y += 3) (put(f.side[0], r.x, y), put(f.side[1], r.x + r.w - 1, y, f.side[1].includes('light/') ? lit : {}))
    if (name === main[0]) f.middle(m, r, put, rnd)
    else if (r.w >= 4 && r.h >= 4) table(put, r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2))
    glow(m, r.x + r.w / 2, r.y + r.h / 2, r.w + 2, r.h + 2, f.glow, 0.38)
  }
  // its people, at the free cells of its main part
  const M = main[1]
  const roles = f.people
  for (let k = 0, tries = 0; k < roles.length && tries < 60; tries++) {
    const x = M.x + 1 + Math.floor(rnd() * Math.max(1, M.w - 2)), y = M.y + 1 + Math.floor(rnd() * Math.max(1, M.h - 2))
    if (!floorAt(x, y) || taken.has(`${x},${y}`)) continue
    taken.add(`${x},${y}`)
    const pid = `${id}.p${k}`, role = ROLES[roles[k]] ?? 'villager'
    m.fixture(`actor/person/${role}`, x, y, {
      id: pid, name: { en: 'someone', zh: '某人' }, facing: rnd() < 0.5 ? 'down' : 'left',
      look: generateLook(pid, { sex: rnd() < 0.5 ? 'female' : 'male', age: 18 + Math.floor(rnd() * 50), role: roles[k] }),
      npc: { role, schedule: [{ from: 0, to: 24, map: id, x, y, activity: 'work' }] },
    } as never)
    k++
  }
  return m
}

/** Every new hall: each plan three times for each of its uses (on its other floor, its walls lined the other way
 *  round, other people). */
export function allHalls(): MapBuilder[] {
  const REGIONS = ['holy', 'frostfang', 'redmarch', 'tithe', 'palefen', 'altar']
  const out: MapBuilder[] = []
  let n = 0
  for (const [key, uses] of Object.entries(PLAN_USES) as [Key, Use[]][]) {
    if (!HALLS[key]) continue
    for (const use of uses) for (let take = 0; take < 3; take++) {
      try { out.push(furnished(key, use, REGIONS[n % REGIONS.length], n)) } catch (e) { console.warn('cannot furnish', key, use, (e as Error).message) }
      n++
    }
  }
  return out
}
export type { Cell }
