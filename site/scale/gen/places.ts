// New places for the scale film, made the showcase's way (demo/showcase): the project's own buildings
// (art/arch/buildings: each region's houses, its halls and works), streets laid as showcase/street.ts lays them, the
// ground and its dress (showcase/dress.ts, ground.ts), people about their day. Each a hamlet of a region in one of three
// shapes, laid out afresh from its seed:
//   street     two rows of houses facing a street, a square between them with its well or fountain, stalls, lamps
//   green      houses round a green with a pond and trees, their yards fenced, the fields beyond in strips
//   quay       houses along a quay over the water, the boats at it, the stores and the crane, the nets drying
import type { Entity } from '@openworld/engine'
import { generateLook } from '@openworld-game/content'
import { MapBuilder, reseed, rng, type Cell } from '../../../games/openworld/tools/src/demo/builder.ts'
import { houseRow, clearDoorsteps, pave } from '../../../games/openworld/tools/src/demo/showcase/street.ts'
import { lamp, free, decor, festoons, unshut } from '../../../games/openworld/tools/src/demo/showcase/dress.ts'
import { snowOver } from '../../../games/openworld/tools/src/demo/showcase/ground.ts'
import { FARM_HOUSES } from '../../../games/openworld/tools/src/art/arch/buildings/works.ts'
import { FEN_HOUSES, MARCH_HOUSES, NORTH_HOUSES, VALE_HOUSES, VALE_HOVELS } from '../../../games/openworld/tools/src/art/arch/buildings/regions.ts'
import { LOW_HOUSES, TALL_HOUSES } from '../../../games/openworld/tools/src/art/arch/buildings/town.ts'

type Shape = 'street' | 'green' | 'quay'
interface Palette {
  region: string
  houses: string[]
  /** What stands out among them: an inn, a hall, a mill, a chapel. */
  great: string[]
  ground: string
  street: string
  tree: string
  /** What lies about: decor pictures and things. */
  clutter: string[]
  shapes: Shape[]
  roles: string[]
  snow?: boolean
  dry?: boolean
}
const PALETTES: Record<string, Palette> = {
  holy: { region: 'holy', houses: [...TALL_HOUSES, ...LOW_HOUSES], great: ['town_inn', 'town_tavern', 'town_guild', 'town_teahouse_0', 'town_hall'], ground: 'grass', street: 'cobble', tree: 'tree', clutter: ['decor_cafe', 'decor_flowerstand', 'decor_casks', 'decor_crates', 'decor_planter', 'decor_birdbath'], shapes: ['street', 'street', 'quay', 'green'], roles: ['villager', 'merchant', 'noble', 'guard', 'scholar', 'bard', 'child'] },
  north: { region: 'frostfang', houses: NORTH_HOUSES, great: ['north_longhouse_a', 'north_longhouse_b', 'north_tavern', 'north_warehouse_a', 'north_warehouse_b'], ground: 'grass', street: 'gravel', tree: 'pine', clutter: ['decor_casks', 'decor_crates', 'decor_firewood', 'decor_sacks'], shapes: ['quay', 'street', 'green'], roles: ['fisher', 'sailor', 'villager', 'hunter', 'merchant'], snow: true },
  march: { region: 'redmarch', houses: MARCH_HOUSES, great: ['march_warhall', 'march_hospital', 'march_watchtower', 'march_tent_a', 'march_tent_b'], ground: 'drygrass', street: 'dirt', tree: 'tree', clutter: ['decor_firewood', 'decor_crates', 'decor_hay', 'decor_stones'], shapes: ['street', 'green'], roles: ['guard', 'villager', 'hunter', 'traveler'], dry: true },
  vale: { region: 'tithe', houses: [...VALE_HOUSES, ...VALE_HOVELS], great: ['vale_windmill_a', 'vale_windmill_b', 'vale_granary_a', 'vale_granary_b', 'vale_counting', 'vale_scales'], ground: 'grass', street: 'path', tree: 'tree', clutter: ['decor_sacks', 'decor_hay', 'decor_crates', 'decor_millstone'], shapes: ['green', 'street', 'green'], roles: ['farmer', 'merchant', 'villager', 'child'] },
  fen: { region: 'palefen', houses: FEN_HOUSES, great: ['fen_inn', 'fen_healer', 'fen_ossuary'], ground: 'grass', street: 'flags', tree: 'tree', clutter: ['decor_casks', 'decor_twigs', 'decor_mushrooms', 'decor_stones'], shapes: ['quay', 'green'], roles: ['fisher', 'villager', 'elder', 'beggar'] },
  altar: { region: 'altar', houses: [...FARM_HOUSES, ...VALE_HOVELS], great: ['altar_hall', 'altar_chapel', 'altar_cells', 'altar_gate'], ground: 'grass', street: 'flagstone', tree: 'tree', clutter: ['decor_planter', 'decor_birdbath', 'decor_flowerstand', 'decor_waycross'], shapes: ['green', 'street'], roles: ['elder', 'villager', 'scholar', 'traveler'] },
  farm: { region: 'tithe', houses: FARM_HOUSES, great: ['farm_barn_a', 'farm_barn_b', 'farm_watermill', 'farm_dovecote', 'farm_staddle', 'farm_coop'], ground: 'grass', street: 'path', tree: 'tree', clutter: ['decor_hay', 'decor_sacks', 'decor_cart', 'decor_straw'], shapes: ['green', 'green'], roles: ['farmer', 'villager', 'child'] },
}

const W = 46, H = 34

/** Someone of the place, standing at their work all day where they are put. */
function person(b: MapBuilder, x: number, y: number, role: string): void {
  if (!free(b, x, y)) return
  const id = b.newId('folk')
  b.fixture(`actor/person/${role}`, x, y, {
    id, name: { en: 'someone', zh: '某人' }, facing: rng.pick(['down', 'left', 'right', 'up']),
    look: generateLook(id, { sex: rng.chance(0.5) ? 'female' : 'male', age: role === 'child' ? 9 : rng.int(17, 70), role }),
    npc: { role, schedule: [{ from: 0, to: 24, map: b.id, x, y, activity: 'work' }] },
  } as Partial<Entity>)
}
/** Things set about a rect where the ground is free. */
function about(b: MapBuilder, x0: number, y0: number, w: number, h: number, things: string[], p: number): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (rng.chance(p) && free(b, x, y)) {
    const t = rng.pick(things)
    if (t.startsWith('decor_')) decor(b, t, x, y)
    else b.fixture(t, x, y, t.includes('light/') ? { statuses: { lit: -1 } } : {})
  }
}
/** People about a rect. */
function crowd(b: MapBuilder, x0: number, y0: number, w: number, h: number, n: number, roles: string[]): void {
  for (let k = 0, tries = 0; k < n && tries < n * 20; tries++) { const x = rng.int(x0, x0 + w - 1), y = rng.int(y0, y0 + h - 1); if (free(b, x, y)) (person(b, x, y, rng.pick(roles)), k++) }
}

export function place(key: string, shape: Shape, seed: number): MapBuilder {
  const P = PALETTES[key]
  reseed(seed)
  const id = `promo.${key}.${shape}.${seed}`
  const b = new MapBuilder(id, { en: `${key} ${shape}`, zh: `${key} ${shape}` }, 'village', W, H, P.ground, 'village', 'outdoor', P.region)
  b.backdrop = true
  b.zone = 'peaceful'
  // a little of the wild round it: trees at the edges, rough ground in patches
  for (let k = 0; k < 10; k++) b.organic(rng.pick([2, W - 3, rng.int(2, W - 3)]), rng.pick([2, H - 3, rng.int(2, H - 3)]), rng.int(2, 4), rng.int(1, 3), P.dry ? 'dirt' : 'drygrass', { rough: 0.5, only: (c) => c === P.ground })
  if (shape === 'street') {
    // the street across, two rows of houses facing it, a square opened in the middle with its fountain or well
    pave(b, 0, 13, W, 3, P.street)
    houseRow(b, 1, W - 1, 12, P.houses, 'n', 0.35, { yards: ['garden', 'court', 'bare'] })
    pave(b, 0, 26, W, 2, P.street)
    houseRow(b, 1, W - 1, 25, P.houses, 's', 0.35, { yards: ['garden', 'court'] })
    const sq = rng.int(14, W - 20)
    pave(b, sq, 16, 12, 6, key === 'holy' ? 'paving' : P.street)
    if (key === 'holy') b.building(rng.pick(['town_fountain', 'market_cross']), sq + 4, 17, [], true)
    else b.fixture(rng.chance(0.5) ? 'fixture/water/well' : 'fixture/water/well/square', sq + 5, 18)
    for (let x = sq + 1; x < sq + 11; x += 3) b.fixture('fixture/furniture/stall', x, 21)
    for (let x = 3; x < W - 2; x += 8) if (free(b, x, 16)) lamp(b, x, 16)
    festoons(b, 2, W - 3, 16, ['flags', 'lanterns', 'washing'], 0.5)
    about(b, 0, 13, W, 14, ['fixture/container/barrel', 'fixture/container/crate', 'fixture/furniture/bench', 'fixture/furniture/cart', ...P.clutter], 0.03)
    crowd(b, 0, 13, W, 14, 14, P.roles)
  } else if (shape === 'green') {
    // houses along the top round a green, a pond and trees on it, yards fenced below, fields in strips beyond
    pave(b, 0, 12, W, 2, P.street)
    houseRow(b, 1, W - 1, 11, P.houses, 'n', 0.4, { yards: ['garden', 'garden', 'bare'] })
    const gx = rng.int(4, 12)
    b.building(rng.pick(P.great), gx + rng.int(0, 18), 16, [], true)
    b.organic(rng.int(8, W - 8), rng.int(20, 24), rng.int(3, 5), rng.int(2, 3), 'water', { rough: 0.4, only: (c) => c === P.ground || c === 'drygrass' })
    b.sprinkle('fixture/nature/reeds', 0.3, (x, y, t) => (t === P.ground || t === 'drygrass') && b.near(x, y, (n) => n === 'water', 1))
    for (let k = 0; k < 8; k++) { const x = rng.int(1, W - 2), y = rng.int(15, H - 10); if (free(b, x, y)) b.set(x, y, P.tree) }
    // the fields: strips of farmland with their crop, a fence between them
    const fy = H - 7
    for (let x = 1, s = 0; x < W - 6; x += 7, s++) {
      b.rect(x, fy, 6, 5, 'farmland')
      const crop = rng.pick(['wheat', 'wheat', 'barley', 'cabbage', 'pumpkin'])
      for (let yy = fy + 1; yy < fy + 5; yy += 2) for (let xx = x; xx < x + 6; xx++) b.fixture(`fixture/crop/${crop === 'barley' || crop === 'cabbage' || crop === 'pumpkin' ? 'wheat' : crop}/${s % 2 ? 'ripe' : 'young'}`, xx, yy)
    }
    b.fence('rail', [0, fy - 1], [W - 1, fy - 1], [[rng.int(3, W - 4), fy - 1]])
    about(b, 0, 14, W, fy - 15, ['fixture/nature/haystack', 'fixture/furniture/cart', 'fixture/garden/bench', 'fixture/nature/beehive', 'fixture/water/trough', ...P.clutter], 0.02)
    crowd(b, 0, 13, W, fy - 13, 10, P.roles)
    for (const [x, y] of [[rng.int(5, W - 5), rng.int(16, 22)], [rng.int(5, W - 5), rng.int(16, 22)]] as Cell[]) if (free(b, x, y)) b.creature(rng.pick(['animal/cow', 'animal/chicken', 'animal/calf']), x, y, { behaviour: 'passive', temper: 'wary', sight: 4, leash: 3 } as never)
  } else {
    // the quay: the houses along the top, the quay of flags, the water below with the boats at it
    pave(b, 0, 13, W, 2, P.street)
    houseRow(b, 1, W - 1, 12, P.houses, 'n', 0.3, { yards: ['court', 'bare'] })
    b.rect(0, 15, W, 4, 'flagstone')
    b.rect(0, 19, W, H - 19, 'water')
    b.rect(0, 25, W, H - 25, 'deepwater')
    for (let x = rng.int(2, 6); x < W - 4; x += rng.int(8, 13)) { b.rect(x, 19, 2, 4, 'bridge'); b.fixture('fixture/boat', x + 2, 21) }
    if (key === 'north' || key === 'holy') { b.building(rng.pick(['north_cog_a', 'north_cog_b', 'north_cog_c']), rng.int(6, W - 14), 24, [], true); b.building('town_crane', rng.int(2, W - 6), 16, [], true) }
    about(b, 0, 15, W, 4, ['fixture/furniture/rack/nets', 'fixture/furniture/rack/fish', 'fixture/container/barrel', 'fixture/container/crate', 'fixture/container/sack', ...P.clutter], 0.08)
    for (let x = 3; x < W - 2; x += 9) if (free(b, x, 15)) lamp(b, x, 15)
    crowd(b, 0, 13, W, 6, 10, P.roles)
  }
  clearDoorsteps(b)
  unshut(b)
  if (P.snow) snowOver(b)
  return b
}

/** Every new place: each palette in each of its shapes, ten seeds apiece. */
export function allPlaces(): MapBuilder[] {
  const out: MapBuilder[] = []
  let seed = 101
  for (const key of Object.keys(PALETTES)) for (const shape of [...new Set(PALETTES[key].shapes)]) for (let k = 0; k < 10; k++) {
    try { out.push(place(key, shape, seed)) } catch (e) { console.warn('cannot make', key, shape, (e as Error).message) }
    seed += 17
  }
  return out
}
