// The halls of the regions' showcase places (docs/showcase.md §4b), laid out as the Holy City's are (halls.ts): each from
// its plan (art/arch/plans.ts HALLS), its walls the plan's shell, furnished as full as the hall would be. Rimeholm's
// tavern, boathouse and longhall; Warcombe's war hall, armoury and field hospital; Weighmarket's counting house, granary
// and poorhouse; Dusk Moorings' ossuary, healer's hut and inn; Highheath's chapel and the catacombs under it.

import type { Place } from '../continent/generate.ts'
import type { MapBuilder, Cell } from '../builder.ts'
import { glow, lit, planHall } from './halls.ts'

const at = (m: MapBuilder, type: string, cells: Cell[], extra = {}) => {
  for (const [x, y] of cells) m.fixture(type, x, y, extra)
}
const span = (x0: number, x1: number, y: number, step = 1): Cell[] => Array.from({ length: Math.floor((x1 - x0) / step) + 1 }, (_, i) => [x0 + i * step, y])

/** A long table down a run of cells, a bench along each side. */
function board(m: MapBuilder, x: number, y: number, n: number, bench = 'fixture/furniture/bench'): void {
  at(m, 'fixture/furniture/table/long', span(x, x + n - 1, y))
  at(m, bench, [...span(x, x + n - 1, y - 1), ...span(x, x + n - 1, y + 1)])
}

/** A table with a chair either side and candles on the cell above. */
function setting(m: MapBuilder, x: number, y: number): void {
  m.fixture('fixture/furniture/table', x, y)
  at(m, 'fixture/furniture/chair', [[x - 1, y], [x + 1, y]])
  m.fixture('fixture/light/candles', x, y - 1, lit)
}

/** A decor picture stamped on a hall's floor (its cells planned with the rest). */
const decor = (m: MapBuilder, name: string, x: number, y: number) => m.building(name, x, y)

const tomb = (en: string, zh: string) => ({ props: { text: en, text_zh: zh } })

// ------------------------------------------------------------------------------------------------ Rimeholm

/** The Salt Mermaid: the fishermen's tavern — its counter and casks, nets and fish hung by the fire, long tables, the skippers' snug. */
export function seaTavern(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'seatavern', `${p.id}.inn-0`, { en: `${p.name.en} — the Salt Mermaid`, zh: `${p.name.zh}·盐人鱼酒馆` }, 'floor_wood', { music: 'interior_night', floors: [['hearth', 'floor_stone'], ['snug', 'carpet']] })
  const M = P.main
  const S = P.snug
  at(m, 'fixture/furniture/counter', span(M.x + 9, M.x + 13, M.y + 2))
  m.building('decor_casks_row', M.x + 9, M.y)
  m.fixture('fixture/container/barrel', M.x + 13, M.y)
  board(m, M.x + 1, M.y + 5, 6)
  board(m, M.x + 9, M.y + 6, 3)
  m.fixture('fixture/light/candles', M.x + 7, M.y + 5, lit)
  m.fixture('fixture/furniture/rack/nets', M.x, M.y + 1)
  m.fixture('fixture/furniture/rack/fish', M.x, M.y + 3)
  m.fixture('fixture/container/sack', M.x + 1, M.y)
  m.fixture('fixture/furniture/bench/log', M.x + 3, M.y + 1)
  m.building('decor_firewood', M.x, M.y + 8)
  m.fixture('fixture/container/barrel', M.x + 13, M.y + 8)
  m.fixture('fixture/container/crate', M.x + 12, M.y + 8)
  // the snug: the skippers' table, their sea chests, a bunk for the one too drunk to row home
  setting(m, S.x + 2, S.y + 2)
  m.fixture('fixture/container/drawers', S.x + 4, S.y)
  m.fixture('fixture/container/chest', S.x + 4, S.y + 5)
  m.fixture('fixture/furniture/bed', S.x, S.y + 5)
  glow(m, M.x + 6.5, P.hearth.y + 2, 9, 6, '#ff8a3a', 0.5)
  glow(m, S.x + 2.5, S.y + 2, 4, 3, '#ffc46b', 0.35)
  m.anchors = { bar: [M.x + 11, M.y + 3], eat: [M.x + 7, M.y + 4], rest: [S.x + 2, S.y + 4], bard: [M.x + 10, M.y + 4] }
  return m
}

/** The boathouse: a cog on the slip in its ribs and scaffolds, the timber stacked, the pitch pot on its fire, the loft's gear. */
export function boathouseHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'boathouse', `${p.id}.boathouse`, { en: `${p.name.en} — the Boathouse`, zh: `${p.name.zh}·船坞` }, 'floor_wood', { floors: [['entry', 'floor_stone']] })
  const L = P.slip
  m.building('north_cog_a', L.x + 8, L.y + 3)
  at(m, 'fixture/furniture/rack', [[L.x + 7, L.y + 3], [L.x + 16, L.y + 3], [L.x + 7, L.y + 5], [L.x + 16, L.y + 5]])
  at(m, 'fixture/nature/logpile/stack', [[L.x, L.y + 2], [L.x, L.y + 4], [L.x, L.y + 6]])
  at(m, 'fixture/container/woodpile', [[L.x + 23, L.y + 1], [L.x + 24, L.y + 1]])
  at(m, 'fixture/craft/workbench', [[L.x + 3, L.y + 8], [L.x + 6, L.y + 8], [L.x + 18, L.y + 8], [L.x + 21, L.y + 8]])
  m.fixture('fixture/craft/cauldron', L.x + 20, L.y + 4, lit)
  at(m, 'fixture/boat', [[L.x + 1, L.y + 9], [L.x + 23, L.y + 9]])
  at(m, 'fixture/furniture/rack/nets', [[L.x + 24, L.y + 5], [L.x + 24, L.y + 7]])
  at(m, 'fixture/container/barrel', [[L.x + 25, L.y + 2], [L.x + 25, L.y + 3]])
  at(m, 'fixture/container/crate', [[L.x + 18, L.y + 1], [L.x + 19, L.y + 1]])
  m.fixture('fixture/container/sack', L.x + 4, L.y + 1)
  decor(m, 'decor_sacks', L.x + 11, L.y + 10)
  at(m, 'fixture/container/crate', [[P.loft.x, P.loft.y], [P.loft.x + 1, P.loft.y]])
  m.fixture('fixture/container/sack', P.loft.x + 2, P.loft.y)
  m.fixture('fixture/container/chest', P.loft.x + 6, P.loft.y)
  at(m, 'fixture/container/barrel', [[P.store.x, P.store.y], [P.store.x + 1, P.store.y], [P.store.x + 2, P.store.y]])
  m.fixture('fixture/furniture/rack/nets', P.store.x + 5, P.store.y)
  glow(m, L.x + 13, L.y + 1, 14, 6, '#ffe8b0', 0.28, 'sun')
  glow(m, L.x + 20.5, L.y + 4.5, 4, 3, '#ff8a3a', 0.4)
  m.anchors = { work: [L.x + 12, L.y + 7], hull: [L.x + 7, L.y + 7] }
  return m
}

/** The longhall: the hearth burning down the hall's length, the benches and boards either side, the jarl's high seat on the dais. */
export function longHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'longhall', `${p.id}.longhall`, { en: `${p.name.en} — the Longhall`, zh: `${p.name.zh}·长屋大厅` }, 'floor_wood', { floors: [['dais', 'carpet_royal']] })
  const H = P.hall
  const D = P.dais
  m.rect(H.x + 3, H.y + 3, H.w - 6, 3, 'floor_stone')
  at(m, 'fixture/light/campfire', [[H.x + 3, H.y + 4], [H.x + 8, H.y + 4], [H.x + 19, H.y + 4], [H.x + 24, H.y + 4]], lit)
  for (const [a, b] of [[H.x + 2, H.x + 11], [H.x + 16, H.x + 25]]) {
    at(m, 'fixture/furniture/bench/log', [...span(a, b, H.y + 1), ...span(a, b, H.y + 7)])
    at(m, 'fixture/furniture/table/long', [...span(a, b, H.y + 2), ...span(a, b, H.y + 6)])
  }
  at(m, 'fixture/furniture/throne', [[D.x + 4, D.y], [D.x + 5, D.y]])
  at(m, 'fixture/standard', [[D.x, D.y], [D.x + 9, D.y]])
  at(m, 'fixture/container/chest', [[D.x + 1, D.y], [D.x + 8, D.y]])
  at(m, 'fixture/light/brazier', [[D.x, D.y + 2], [D.x + 9, D.y + 2]], lit)
  at(m, 'fixture/container/barrel', [[P.bayW.x, P.bayW.y], [P.bayW.x, P.bayW.y + 1]])
  at(m, 'fixture/furniture/rack/arms', [[P.bayE.x, P.bayE.y], [P.bayE.x, P.bayE.y + 1], [H.x, H.y + 1]])
  at(m, 'fixture/container/sack', [[H.x, H.y], [H.x + 1, H.y]])
  decor(m, 'decor_firewood', H.x + 25, H.y + 9)
  // furs before the benches, the loom, the chests of the household, a hound's bed of straw
  for (const x of [H.x + 4, H.x + 9, H.x + 18, H.x + 23]) decor(m, 'decor_rug', x, H.y + 9)
  m.fixture('fixture/craft/loom', H.x + 1, H.y + 9)
  at(m, 'fixture/container/chest', [[H.x + 27, H.y + 1], [H.x + 27, H.y + 2], [H.x, H.y + 4]])
  decor(m, 'decor_straw', H.x + 13, H.y + 9)
  at(m, 'fixture/light/brazier', [[H.x, H.y + 9]], lit)
  glow(m, H.x + 14, H.y + 4.5, 26, 5, '#ff8a3a', 0.5)
  glow(m, D.x + 5, D.y + 1.5, 10, 4, '#ffb35c', 0.35)
  m.anchors = { throne: [D.x + 5, D.y + 2], eat: [H.x + 10, H.y + 3], rest: [H.x + 18, H.y + 5], hall: [H.x + 14, H.y + 9] }
  return m
}

// ------------------------------------------------------------------------------------------------ Warcombe

/** The war hall: the captains' table with the March's map on it, the standards, the racks of arms, the dummy, the dais's chair. */
export function warHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'warhall', `${p.id}.warhall`, { en: `${p.name.en} — the War Hall`, zh: `${p.name.zh}·军议厅` }, 'floor_stone', { floors: [['dais', 'carpet_royal']] })
  const H = P.hall
  const D = P.dais
  m.rect(H.x + 11, H.y + 6, 2, 4, 'runner')
  at(m, 'fixture/furniture/table/long', [...span(H.x + 8, H.x + 15, H.y + 3), ...span(H.x + 8, H.x + 15, H.y + 4)])
  at(m, 'fixture/furniture/chair', [...span(H.x + 8, H.x + 15, H.y + 2), ...span(H.x + 8, H.x + 15, H.y + 5)])
  at(m, 'fixture/light/candelabrum', [[H.x + 7, H.y + 4], [H.x + 16, H.y + 4]], lit)
  m.fixture('fixture/furniture/throne', D.x + 4, D.y)
  at(m, 'fixture/furniture/desk', [[D.x + 2, D.y]])
  m.fixture('fixture/container/chest', D.x + 6, D.y)
  at(m, 'fixture/standard', [[D.x, D.y], [D.x + 9, D.y], [H.x, H.y], [H.x + H.w - 1, H.y]])
  at(m, 'fixture/light/brazier', [[D.x + 1, D.y + 2], [D.x + 8, D.y + 2]], lit)
  at(m, 'fixture/furniture/rack/arms', [[H.x + 2, H.y], [H.x + 5, H.y], [H.x + 18, H.y], [H.x + 21, H.y]])
  at(m, 'fixture/dummy', [[H.x + 1, H.y + 8], [H.x + 22, H.y + 8]])
  at(m, 'fixture/sacred/statue', [[P.bayW.x, P.bayW.y + 1], [P.bayE.x, P.bayE.y + 1]])
  at(m, 'fixture/container/barrel', [[H.x, H.y + 5], [H.x + H.w - 1, H.y + 5]])
  at(m, 'fixture/container/crate', [[H.x, H.y + 9], [H.x + H.w - 1, H.y + 9]])
  glow(m, H.x + 12, H.y + 3.5, 14, 5, '#ffc46b', 0.4)
  glow(m, D.x + 5, D.y + 2, 12, 4, '#ff8a3a', 0.35)
  m.anchors = { table: [H.x + 11, H.y + 7], dais: [D.x + 5, D.y + 2], rest: [H.x + 3, H.y + 5] }
  return m
}

/** The armoury: the forge in its alcove, the anvils, the racks and the armour on its stands, the arrows in their barrels. */
export function armouryHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'armoury', `${p.id}.armoury`, { en: `${p.name.en} — the Armoury`, zh: `${p.name.zh}·军械库` }, 'floor_stone')
  const H = P.hall
  const F = P.forge
  m.fixture('fixture/craft/forge', F.x + 3, F.y, lit)
  decor(m, 'decor_sacks', F.x, F.y)
  m.fixture('fixture/water/trough', F.x + 5, F.y)
  at(m, 'fixture/craft/anvil', [[F.x + 2, H.y + 1], [F.x + 5, H.y + 1]])
  m.fixture('fixture/craft/workbench', H.x + 6, H.y + 1)
  for (let x = H.x; x <= H.x + 4; x++) m.fixture(x % 2 ? 'fixture/dummy' : 'fixture/furniture/rack/arms', x, H.y)
  for (let x = H.x + 14; x <= H.x + 18; x++) m.fixture(x % 2 ? 'fixture/dummy' : 'fixture/furniture/rack/arms', x, H.y)
  m.fixture('fixture/container/chest', H.x + 19, H.y)
  at(m, 'fixture/furniture/table', [[H.x + 4, H.y + 4], [H.x + 15, H.y + 4]])
  at(m, 'fixture/container/barrel', [[H.x, H.y + 4], [H.x + 19, H.y + 4], [H.x, H.y + 5]])
  at(m, 'fixture/container/crate', [[H.x, H.y + 7], [H.x + 1, H.y + 7], [H.x + 19, H.y + 7], [H.x + 18, H.y + 7]])
  at(m, 'fixture/furniture/rack/arms', [[H.x, H.y + 2], [H.x + 19, H.y + 2]])
  // down the middle: the armour on its stands, the chests of mail, the arrows in their casks
  at(m, 'fixture/dummy', [[H.x + 8, H.y + 4], [H.x + 11, H.y + 4]])
  at(m, 'fixture/furniture/rack/arms', [[H.x + 9, H.y + 4], [H.x + 10, H.y + 4]])
  at(m, 'fixture/container/chest', [[H.x + 7, H.y + 6], [H.x + 12, H.y + 6]])
  at(m, 'fixture/container/barrel', [[H.x + 9, H.y + 6], [H.x + 10, H.y + 6]])
  decor(m, 'decor_firewood', H.x + 5, H.y + 8)
  decor(m, 'decor_casks', H.x + 15, H.y + 8)
  glow(m, F.x + 3.5, F.y + 2, 9, 5, '#ff7a2a', 0.55)
  m.anchors = { forge: [F.x + 3, H.y], work: [H.x + 6, H.y + 5] }
  return m
}

/** The field hospital: two rows of cots, the shrine at the head, the surgeon's table, the herbs and the cauldron of water. */
export function hospitalHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'hospital', `${p.id}.hospital`, { en: `${p.name.en} — the Field Hospital`, zh: `${p.name.zh}·野战医院` }, 'floor_wood', { floors: [['shrine', 'floor_stone']] })
  const W = P.ward
  const S = P.shrine
  m.fixture('fixture/sacred/altar', S.x + 2, S.y)
  m.fixture('fixture/sacred/saint', S.x + 3, S.y)
  at(m, 'fixture/light/candles', [[S.x, S.y], [S.x + 5, S.y]], lit)
  for (const x of [W.x, W.x + 2, W.x + 4, W.x + 6, W.x + 16, W.x + 18, W.x + 20, W.x + 22]) at(m, 'fixture/furniture/bed', [[x, W.y], [x, W.y + 8]])
  at(m, 'fixture/light/candles', [[W.x + 1, W.y], [W.x + 5, W.y], [W.x + 17, W.y], [W.x + 21, W.y]], lit)
  at(m, 'fixture/furniture/table', span(W.x + 10, W.x + 12, W.y + 4))
  m.fixture('fixture/craft/cauldron', W.x + 13, W.y + 4, lit)
  at(m, 'fixture/container/cupboard', [[W.x, W.y + 3], [W.x, W.y + 4]])
  at(m, 'fixture/container/shelf', [[W.x + 23, W.y + 3], [W.x + 23, W.y + 4]])
  at(m, 'fixture/container/sack', [[W.x + 23, W.y + 6], [W.x, W.y + 6]])
  // a second row of cots in the middle for when the wards overflow, the straw they lie on
  at(m, 'fixture/furniture/bed', [[W.x + 3, W.y + 4], [W.x + 5, W.y + 4], [W.x + 7, W.y + 4], [W.x + 17, W.y + 4], [W.x + 19, W.y + 4], [W.x + 21, W.y + 4]])
  for (const [x, y] of [[W.x + 4, W.y + 6], [W.x + 18, W.y + 6], [W.x + 9, W.y + 2]] as Cell[]) decor(m, 'decor_straw', x, y)
  glow(m, S.x + 3, S.y + 1.5, 8, 4, '#ffb35c', 0.4)
  glow(m, W.x + 12, W.y + 4.5, 8, 4, '#ffc46b', 0.3)
  m.anchors = { ward: [W.x + 11, W.y + 6], shrine: [S.x + 2, W.y] }
  return m
}

// ------------------------------------------------------------------------------------------------ Weighmarket

/** The counting house: the long counter and its gate, the clerks' desks and cases of ledgers, the strong room's chests. */
export function countingHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'counting', `${p.id}.counting`, { en: `${p.name.en} — the Counting House`, zh: `${p.name.zh}·账房` }, 'parquet', { floors: [['strong', 'floor_stone'], ['clerks', 'floor_wood']] })
  const H = P.hall
  for (let x = H.x + 4; x <= H.x + 16; x++) if (x !== H.x + 10) m.fixture('fixture/furniture/counter', x, H.y + 2)
  at(m, 'fixture/furniture/desk', [[H.x + 5, H.y], [H.x + 8, H.y], [H.x + 13, H.y], [H.x + 16, H.y]])
  at(m, 'fixture/furniture/chair', [[H.x + 5, H.y + 1], [H.x + 8, H.y + 1], [H.x + 13, H.y + 1], [H.x + 16, H.y + 1]])
  at(m, 'fixture/container/bookcase', span(P.clerks.x, P.clerks.x + 4, P.clerks.y))
  m.fixture('fixture/furniture/desk', P.clerks.x + 6, P.clerks.y + 1)
  at(m, 'fixture/container/chest', span(P.strong.x, P.strong.x + 5, P.strong.y))
  m.fixture('fixture/light/candles', P.strong.x + 5, P.strong.y + 2, lit)
  m.rect(H.x + 10, H.y + 3, 2, 5, 'runner')
  at(m, 'fixture/furniture/bench', [[H.x + 2, H.y + 5], [H.x + 3, H.y + 5], [H.x + 17, H.y + 5], [H.x + 18, H.y + 5]])
  m.fixture('fixture/sign/noticeboard', H.x, H.y + 3)
  at(m, 'fixture/nature/plant', [[H.x, H.y + 7], [H.x + H.w - 1, H.y + 7]])
  at(m, 'fixture/light/candelabrum', [[H.x + 3, H.y + 2], [H.x + 17, H.y + 2]], lit)
  glow(m, H.x + 10, H.y + 2, 18, 4, '#ffc46b', 0.3)
  m.anchors = { clerk: [H.x + 9, H.y + 1], counter: [H.x + 10, H.y + 4], strong: [P.strong.x + 2, P.strong.y + 2] }
  return m
}

/** The granary: sacks heaped to the walls, the bins, the posts that hold the floor above, the tithe's scale, a cat for the mice. */
export function granaryHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'granary', `${p.id}.granary`, { en: `${p.name.en} — the Tithe Granary`, zh: `${p.name.zh}·什一粮仓` }, 'floor_wood')
  const F = P.floor
  for (let x = F.x; x < F.x + F.w - 1; x += 2) decor(m, 'decor_sacks', x, F.y)
  for (const y of [F.y + 3, F.y + 5, F.y + 7]) for (const x of [F.x + 2, F.x + 6, F.x + 18, F.x + 22]) decor(m, 'decor_sacks', x, y)
  for (const [x, y] of [[F.x + 8, F.y + 2], [F.x + 17, F.y + 2], [F.x + 8, F.y + 9], [F.x + 17, F.y + 9]] as Cell[]) m.building('crypt_pillar', x, y)
  at(m, 'fixture/container/sack', [[F.x + 4, F.y + 4], [F.x + 20, F.y + 8], [F.x + 9, F.y + 9], [F.x + 16, F.y + 2]])
  at(m, 'fixture/furniture/counter', span(F.x + 11, F.x + 14, F.y + 3))
  at(m, 'fixture/furniture/cart', [[F.x + 3, F.y + 9], [F.x + 22, F.y + 9]])
  at(m, 'fixture/container/barrel', [[P.bayW.x, P.bayW.y], [P.bayW.x, P.bayW.y + 1], [P.bayE.x, P.bayE.y], [P.bayE.x, P.bayE.y + 2]])
  decor(m, 'decor_hay', F.x, F.y + 5)
  decor(m, 'decor_cat', F.x + 13, F.y + 6)
  for (const [x, y] of [[F.x + 8, F.y + 5], [F.x + 17, F.y + 5], [F.x + 10, F.y + 8], [F.x + 15, F.y + 1]] as Cell[]) decor(m, 'decor_straw', x, y)
  glow(m, F.x + 13, F.y + 3, 10, 4, '#ffc46b', 0.25)
  m.anchors = { floor: [F.x + 12, F.y + 7], scale: [F.x + 12, F.y + 4] }
  return m
}

/** The poorhouse: pallets close along the walls, the one long table, the kitchen's pot always on. */
export function poorHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'poorhouse', `${p.id}.poorhouse`, { en: `${p.name.en} — the Poorhouse`, zh: `${p.name.zh}·济贫院` }, 'floor_wood', { floors: [['kitchen', 'floor_stone']] })
  const H = P.hall
  const K = P.kitchen
  m.fixture('fixture/craft/cauldron', K.x + 2, K.y, lit)
  decor(m, 'decor_firewood', K.x, K.y)
  at(m, 'fixture/container/pot', [[K.x + 4, K.y], [K.x + 5, K.y]])
  at(m, 'fixture/furniture/bed', [...span(H.x + 8, H.x + 18, H.y, 2), [H.x, H.y + 8], [H.x + 2, H.y + 8], [H.x + 4, H.y + 8], [H.x + 13, H.y + 8], [H.x + 15, H.y + 8], [H.x + 17, H.y + 8], [H.x + 19, H.y + 8]])
  board(m, H.x + 2, H.y + 4, 7)
  m.fixture('fixture/water/trough', H.x + 19, H.y + 4)
  at(m, 'fixture/container/barrel', [[H.x + 19, H.y + 2]])
  for (const [x, y] of [[H.x + 12, H.y + 3], [H.x + 15, H.y + 5], [H.x + 1, H.y + 7]] as Cell[]) decor(m, 'decor_straw', x, y)
  glow(m, K.x + 2.5, K.y + 2, 7, 4, '#ff8a3a', 0.4)
  m.anchors = { eat: [H.x + 10, H.y + 4], beds: [H.x + 14, H.y + 6] }
  return m
}

// ------------------------------------------------------------------------------------------------ Dusk Moorings

/** The ossuary: its walls niches of skulls, the dead in their stone boxes, candles that are never let go out, the relics. */
export function ossuaryHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'ossuary', `${p.id}.ossuary`, { en: `${p.name.en} — the Ossuary`, zh: `${p.name.zh}·藏骨堂` }, 'floor_stone', { music: 'crypt', light: 'dark', floors: [['apse', 'marble']] })
  const N = P.nave
  const A = P.apse
  m.rect(N.x + 7, N.y, 2, N.h, 'runner')
  m.fixture('fixture/sacred/altar', A.x + 2, A.y)
  m.fixture('fixture/sacred/reliquary', A.x + 3, A.y)
  at(m, 'fixture/light/candelabrum', [[A.x, A.y], [A.x + 5, A.y]], lit)
  at(m, 'fixture/sacred/sarcophagus', [[N.x + 2, N.y + 2], [N.x + 2, N.y + 5], [N.x + 13, N.y + 2], [N.x + 13, N.y + 5]])
  at(m, 'fixture/remains/bones', [[N.x, N.y], [N.x + 15, N.y], [N.x, N.y + 9], [N.x + 15, N.y + 9]])
  at(m, 'fixture/light/candles', [[N.x + 4, N.y + 3], [N.x + 11, N.y + 3], [N.x + 4, N.y + 7], [N.x + 11, N.y + 7]], lit)
  at(m, 'fixture/sacred/tomb', [[N.x + 2, N.y + 8], [N.x + 13, N.y + 8]], tomb('Here the fen gave back one it had taken. Pray for the drowned.', '沼泽在此交还了它带走的人。为溺者祈祷。'))
  at(m, 'fixture/furniture/pew', [...span(N.x + 5, N.x + 6, N.y + 5), ...span(N.x + 9, N.x + 10, N.y + 5)])
  glow(m, A.x + 3, A.y + 1.5, 8, 4, '#ffb35c', 0.5)
  for (const [x, y] of [[N.x + 4, N.y + 3], [N.x + 11, N.y + 3], [N.x + 4, N.y + 7], [N.x + 11, N.y + 7]]) glow(m, x + 0.5, y + 0.5, 4, 3, '#ffb35c', 0.35)
  m.anchors = { altar: [A.x + 2, N.y], nave: [N.x + 7, N.y + 7] }
  return m
}

/** The healer's hut: shelves of jars, herbs hung to dry, the pot on the fire, the cot for whoever is carried in out of the fog. */
export function healerHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'healer', `${p.id}.healer`, { en: `${p.name.en} — the Healer's Hut`, zh: `${p.name.zh}·医者小屋` }, 'floor_wood')
  const H = P.hut
  m.fixture('fixture/craft/cauldron', H.x + 6, H.y + 1, lit)
  at(m, 'fixture/container/shelf', [[H.x, H.y], [H.x + 1, H.y], [H.x + 11, H.y], [H.x + 12, H.y], [H.x + 13, H.y]])
  at(m, 'fixture/furniture/rack', [[H.x, H.y + 3], [H.x + 13, H.y + 3]])
  at(m, 'fixture/furniture/bed', [[H.x + 12, H.y + 5], [H.x + 13, H.y + 5]])
  setting(m, H.x + 3, H.y + 3)
  m.fixture('fixture/craft/workbench', H.x + 9, H.y + 3)
  decor(m, 'decor_amphorae', H.x, H.y + 5)
  m.fixture('fixture/nature/plant', H.x, H.y + 6)
  m.fixture('fixture/container/chest', H.x + 13, H.y + 6)
  decor(m, 'decor_firewood', H.x + 3, H.y)
  at(m, 'fixture/container/pot', [[H.x + 9, H.y], [H.x + 4, H.y + 6]])
  m.fixture('fixture/container/barrel', H.x + 10, H.y + 6)
  decor(m, 'decor_rug', H.x + 6, H.y + 5)
  decor(m, 'decor_cat', H.x + 8, H.y + 6)
  glow(m, H.x + 6.5, H.y + 1.5, 7, 4, '#ff8a3a', 0.45)
  m.anchors = { work: [H.x + 7, H.y + 4], bed: [H.x + 11, H.y + 5] }
  return m
}

/** The Lantern on Piles: the fen's inn — its counter and casks, eel traps and nets, tables set close, the rooms behind the arch. */
export function stiltInn(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'stiltinn', `${p.id}.inn-0`, { en: `${p.name.en} — the Lantern on Piles`, zh: `${p.name.zh}·桩上灯客栈` }, 'floor_wood', { music: 'interior_night', floors: [['hearth', 'floor_stone'], ['rooms', 'parquet']] })
  const C = P.common
  const R = P.rooms
  at(m, 'fixture/furniture/counter', span(C.x + 11, C.x + 15, C.y + 2))
  m.building('decor_casks_row', C.x + 11, C.y)
  m.fixture('fixture/container/barrel', C.x + 15, C.y)
  for (const [x, y] of [[C.x + 2, C.y + 4], [C.x + 6, C.y + 4], [C.x + 2, C.y + 7], [C.x + 11, C.y + 7]] as Cell[]) setting(m, x, y)
  m.fixture('fixture/furniture/rack/fish', C.x, C.y)
  m.fixture('fixture/furniture/rack/nets', C.x, C.y + 1)
  m.fixture('fixture/light/lantern', C.x + 15, C.y + 9, lit)
  decor(m, 'decor_firewood', C.x, C.y + 9)
  for (const y of [R.y, R.y + 4, R.y + 8]) {
    at(m, 'fixture/furniture/bed', [[R.x, y], [R.x + 3, y]])
    at(m, 'fixture/container/chest', [[R.x + 1, y], [R.x + 4, y]])
  }
  glow(m, C.x + 6.5, P.hearth.y + 2, 9, 6, '#ff8a3a', 0.45)
  glow(m, C.x + 13, C.y + 2, 6, 3, '#ffc46b', 0.3)
  m.anchors = { bar: [C.x + 13, C.y + 3], eat: [C.x + 4, C.y + 5], rest: [C.x + 8, C.y + 8], bard: [C.x + 9, C.y + 4] }
  return m
}

// ------------------------------------------------------------------------------------------------ Highheath Abbey

/** The abbey's chapel: pews either side of the aisle, the high altar in the apse behind its rail, the martyrs in the side chapels. */
export function altarChapel(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'chapel', `${p.id}.chapel`, { en: `${p.name.en} — the Chapel of the Martyrs`, zh: `${p.name.zh}·殉道者礼拜堂` }, 'marble', { music: 'temple', floors: [['apse', 'floor_stone']] })
  const N = P.nave
  const A = P.apse
  m.rect(N.x + 9, A.y, 2, N.y + N.h - A.y + 3, 'carpet_royal')
  m.fixture('fixture/sacred/altar/high', A.x + 3, A.y)
  at(m, 'fixture/light/candelabrum', [[A.x + 1, A.y], [A.x + 6, A.y]], lit)
  at(m, 'fixture/sacred/statue/martyr', [[A.x, A.y + 1], [A.x + 7, A.y + 1]])
  for (let x = A.x; x < A.x + A.w; x++) if (x !== N.x + 9 && x !== N.x + 10) m.fixture('fixture/sacred/rail', x, N.y)
  for (const y of [N.y + 2, N.y + 4, N.y + 6, N.y + 8]) at(m, 'fixture/furniture/pew', [...span(N.x + 1, N.x + 7, y), ...span(N.x + 12, N.x + 18, y)])
  m.fixture('fixture/sacred/pulpit', N.x + 1, N.y)
  m.fixture('fixture/sacred/lectern', N.x + 18, N.y)
  m.fixture('fixture/sacred/organ', N.x + 19, N.y + 1)
  m.fixture('fixture/sacred/font', P.entry.x, P.entry.y + 1)
  m.fixture('fixture/sacred/statue/martyr', P.chapelW.x, P.chapelW.y)
  m.fixture('fixture/light/candles', P.chapelW.x + 2, P.chapelW.y, lit)
  m.fixture('fixture/sacred/statue/martyr', P.chapelE.x + 2, P.chapelE.y)
  m.fixture('fixture/light/candles', P.chapelE.x, P.chapelE.y, lit)
  m.fixture('fixture/sacred/tomb', P.chapelE.x + 1, P.chapelE.y + 3, tomb('The first of Highheath, who held the cliff when the night came over it.', '高坡的第一人，长夜漫过崖顶时，是他守住了这里。'))
  glow(m, A.x + 4, A.y + 1.5, 10, 4, '#ffd27a', 0.45)
  glow(m, N.x + 10, N.y + 4, 18, 8, '#ffe8b0', 0.25, 'sun')
  m.anchors = { altar: [N.x + 10, A.y + 2], pews: [N.x + 5, N.y + 7], choir: [N.x + 11, N.y + 1] }
  return m
}

/** The catacombs under the chapel: galleries of the martyrs in their stone, two tomb chambers, bones, candles kept by the brothers. */
export function catacombHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'catacombs', `${p.id}.catacombs`, { en: `${p.name.en} — the Catacombs`, zh: `${p.name.zh}·地下墓窟` }, 'floor_stone', { music: 'crypt', light: 'dark', outside: false, floors: [['tombW', 'marble'], ['tombE', 'marble']] })
  const No = P.north
  const So = P.south
  for (const x of [No.x + 1, No.x + 4, No.x + 7, No.x + 16, No.x + 19, No.x + 22]) {
    m.fixture('fixture/sacred/sarcophagus', x, No.y)
    m.fixture('fixture/sacred/sarcophagus', x, So.y + 2)
  }
  at(m, 'fixture/light/candles', [[No.x, No.y], [No.x + 23, No.y], [So.x, So.y + 2], [So.x + 23, So.y + 2]], lit)
  at(m, 'fixture/remains/bones', [[P.west.x, P.west.y], [P.east.x + 2, P.east.y], [P.west.x, P.west.y + 7], [P.east.x + 2, P.east.y + 7], [P.spine.x, P.spine.y + 2], [P.spine.x + 3, P.spine.y + 5]])
  for (const [T, k] of [[P.tombW, 1], [P.tombE, -1]] as const) {
    m.fixture('fixture/sacred/reliquary', T.x + 2, T.y)
    m.fixture('fixture/sacred/tomb', T.x + 2 + k, T.y, tomb('A martyr of the White Altar. The cliff remembers what the city forgot.', '白坛的一位殉道者。城忘了的，崖还记得。'))
    m.fixture('fixture/light/candles', T.x + 2 - k, T.y, lit)
    m.fixture('fixture/sacred/statue/martyr', k > 0 ? T.x : T.x + 4, T.y + 3)
    glow(m, T.x + 2.5, T.y + 1.5, 5, 3, '#ffb35c', 0.45)
  }
  for (const [x, y] of [[No.x + 0.5, No.y + 0.5], [No.x + 23.5, No.y + 0.5], [So.x + 0.5, So.y + 2.5], [So.x + 23.5, So.y + 2.5]]) glow(m, x, y, 4, 3, '#ffb35c', 0.35)
  m.anchors = { stair: [P.entry.x + 1, P.entry.y + 1], tombW: [P.tombW.x + 2, P.tombW.y + 2], tombE: [P.tombE.x + 2, P.tombE.y + 2] }
  return m
}
