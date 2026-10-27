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

// ------------------------------------------------------------------------------------------------ Barleyridge (the farm)

/** The barn: the cows' pen in the corner, hay heaped to the beams, the cart, the tools, the hens scratching at the floor. */
export function barnHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'barn', `${p.id}.barn`, { en: `${p.name.en} — the Great Barn`, zh: `${p.name.zh}·大谷仓` }, 'dirt', { floors: [['loft', 'floor_wood']] })
  const F = P.floor
  m.fence('rail', [F.x, F.y + 5], [F.x + 9, F.y + 5], [[F.x + 5, F.y + 5]])
  m.fence('rail', [F.x + 10, F.y], [F.x + 10, F.y + 5])
  at(m, 'fixture/water/trough', [[F.x + 1, F.y], [F.x + 5, F.y]])
  for (const [x, y] of [[F.x + 3, F.y + 2], [F.x + 7, F.y + 3]] as Cell[]) m.creature('animal/cow', x, y, { behaviour: 'passive', temper: 'wary', sight: 3, leash: 2 })
  m.creature('animal/calf', F.x + 5, F.y + 2, { behaviour: 'passive', temper: 'wary', sight: 3, leash: 2 })
  for (const x of [F.x + 13, F.x + 16, F.x + 19, F.x + 22]) decor(m, 'decor_hay', x, F.y)
  for (const [x, y] of [[F.x + 20, F.y + 3], [F.x + 23, F.y + 4]] as Cell[]) m.fixture('fixture/nature/haystack', x, y)
  m.fixture('fixture/furniture/cart', F.x + 15, F.y + 4)
  at(m, 'fixture/furniture/rack', [[F.x + 23, F.y + 7], [F.x + 23, F.y + 8]])
  m.fixture('fixture/craft/workbench', F.x + 18, F.y + 8)
  at(m, 'fixture/container/sack', [[F.x, F.y + 8], [F.x + 1, F.y + 8], [F.x, F.y + 9]])
  at(m, 'fixture/container/barrel', [[F.x + 23, F.y + 9], [F.x + 22, F.y + 9]])
  for (const [x, y] of [[F.x + 4, F.y + 7], [F.x + 12, F.y + 8], [F.x + 9, F.y + 9]] as Cell[]) decor(m, 'decor_straw', x, y)
  for (const [x, y] of [[F.x + 13, F.y + 7], [F.x + 8, F.y + 8]] as Cell[]) m.creature('animal/chicken', x, y, { behaviour: 'passive', temper: 'wary', sight: 3, leash: 4 })
  decor(m, 'decor_hay', P.loft.x, P.loft.y)
  decor(m, 'decor_sacks', P.loft.x + 3, P.loft.y)
  m.fixture('fixture/container/chest', P.loft.x + 7, P.loft.y)
  glow(m, F.x + 12, F.y + 2, 18, 6, '#ffe8b0', 0.22, 'sun')
  m.anchors = { work: [F.x + 15, F.y + 7], pen: [F.x + 6, F.y + 6] }
  return m
}

/** The farmhouse's kitchen and parlour: the long table, the pot on the fire, the loom, the dresser, the beds through the arch. */
export function farmhouseHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'farmhouse', `${p.id}.farmhouse`, { en: `${p.name.en} — the Farmhouse`, zh: `${p.name.zh}·农舍` }, 'floor_wood', { floors: [['hearth', 'floor_stone'], ['parlour', 'parquet']] })
  const K = P.kitchen
  const R = P.parlour
  board(m, K.x + 3, K.y + 4, 6)
  m.fixture('fixture/craft/cauldron', K.x + 5, K.y, lit)
  decor(m, 'decor_firewood', K.x, K.y)
  at(m, 'fixture/container/pot', [[K.x + 8, K.y], [K.x + 9, K.y]])
  at(m, 'fixture/container/cupboard', [[K.x + 12, K.y], [K.x + 13, K.y]])
  m.fixture('fixture/craft/loom', K.x, K.y + 4)
  at(m, 'fixture/container/barrel', [[K.x + 13, K.y + 8], [K.x + 13, K.y + 7]])
  at(m, 'fixture/container/sack', [[K.x, K.y + 8], [K.x + 1, K.y + 8]])
  decor(m, 'decor_cat', K.x + 6, K.y + 1)
  m.fixture('fixture/light/candles', K.x + 9, K.y + 3, lit)
  at(m, 'fixture/furniture/bed', [[R.x, R.y], [R.x + 2, R.y]])
  m.fixture('fixture/container/wardrobe', R.x + 6, R.y)
  m.fixture('fixture/container/chest', R.x + 4, R.y)
  m.fixture('fixture/furniture/mirror', R.x + 6, R.y + 3)
  decor(m, 'decor_rug', R.x + 2, R.y + 4)
  m.fixture('fixture/furniture/chair', R.x + 5, R.y + 6)
  glow(m, K.x + 7, P.hearth.y + 2, 10, 6, '#ff8a3a', 0.45)
  m.anchors = { hearth: [K.x + 6, K.y + 1], eat: [K.x + 10, K.y + 2], rest: [R.x + 3, R.y + 2] }
  return m
}

/** The mill: the stones turning under their hopper, the race's water at the head, sacks of flour, the miller's scale. */
export function millHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'mill', `${p.id}.mill`, { en: `${p.name.en} — the Watermill`, zh: `${p.name.zh}·水磨坊` }, 'floor_wood', { floors: [['race', 'water'], ['entry', 'floor_stone']] })
  const F = P.floor
  for (const x of [F.x + 8, F.x + 12]) decor(m, 'decor_millstone', x, F.y + 2)
  at(m, 'fixture/craft/workbench', [[F.x + 9, F.y + 1], [F.x + 11, F.y + 1]])
  for (const x of [F.x, F.x + 2, F.x + 16, F.x + 18]) decor(m, 'decor_sacks', x, F.y)
  for (const [x, y] of [[F.x, F.y + 5], [F.x + 18, F.y + 6]] as Cell[]) decor(m, 'decor_sacks', x, y)
  at(m, 'fixture/furniture/counter', span(F.x + 5, F.x + 7, F.y + 6))
  m.fixture('fixture/furniture/cart', F.x + 15, F.y + 7)
  at(m, 'fixture/container/barrel', [[F.x + 19, F.y + 8], [F.x, F.y + 8]])
  for (const [x, y] of [[F.x + 4, F.y + 2], [F.x + 15, F.y + 2]] as Cell[]) m.building('crypt_pillar', x, y)
  decor(m, 'decor_millstone', F.x + 2, F.y + 8)
  glow(m, F.x + 10, F.y + 1, 12, 5, '#ffe8b0', 0.25, 'sun')
  m.anchors = { stones: [F.x + 10, F.y + 4], floor: [F.x + 8, F.y + 7] }
  return m
}

// ------------------------------------------------------------------------------------------------ Brandby Mine

/** The workings: the main drift and its levels, rails and carts, timbered faces, the stopes with their ore, the flooded sump. */
export function workingsHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'workings', `${p.id}.workings`, { en: `${p.name.en} — the Workings`, zh: `${p.name.zh}·矿道` }, 'cave_floor', { music: 'crypt', light: 'dark', floors: [['entry', 'gravel']] })
  const M = P.main
  for (let y = M.y; y < P.entry.y + P.entry.h; y++) decor(m, 'decor_rails_v', M.x + 1, y)
  for (let x = P.westLow.x; x < M.x; x++) decor(m, 'decor_rails_h', x, P.westLow.y + 1)
  for (let x = M.x + M.w; x < P.eastMid.x + P.eastMid.w; x++) decor(m, 'decor_rails_h', x, P.eastMid.y + 1)
  for (const [x, y] of [[M.x + 1, M.y + 9], [P.eastMid.x + 9, P.eastMid.y + 1], [P.westLow.x + 9, P.westLow.y + 1]] as Cell[]) m.fixture('fixture/furniture/cart', x, y)
  // the ore in the stopes and the cavern: veins in the rock to be worked, heaps broken out
  for (const [T, n] of [[P.stopeW, 4], [P.stopeE, 5], [P.cavern, 4], [P.winze, 2]] as const)
    for (let k = 0; k < n; k++) {
      const x = T.x + ((k * 3) % T.w)
      const y = T.y + (k % 2 ? T.h - 1 : 0)
      m.fixture(k % 3 === 0 ? 'fixture/nature/vein/coal' : k === 4 ? 'fixture/nature/vein/gold' : 'fixture/nature/vein/iron', x, y)
    }
  for (const [x, y] of [[P.stopeW.x + 3, P.stopeW.y + 2], [P.stopeE.x + 3, P.stopeE.y + 3], [P.stopeE.x + 6, P.stopeE.y + 5], [P.cavern.x + 5, P.cavern.y + 3]] as Cell[]) decor(m, 'decor_ore', x, y)
  // the sump's black water, the pump that keeps it down, the bones of what fell in
  m.rect(P.sump.x + 1, P.sump.y + 2, 9, 3, 'water')
  decor(m, 'decor_pump', P.sump.x + 10, P.sump.y + 1)
  m.fixture('fixture/remains/bones', P.sump.x, P.sump.y + 5)
  // the store at the mouth: timbers, casks, crates, the brazier the shifts warm themselves at
  at(m, 'fixture/nature/logpile/stack', [[P.entry.x, P.entry.y], [P.entry.x, P.entry.y + 1]])
  at(m, 'fixture/container/barrel', [[P.entry.x + 7, P.entry.y], [P.entry.x + 7, P.entry.y + 1]])
  at(m, 'fixture/container/crate', [[P.entry.x, P.entry.y + 3]])
  m.fixture('fixture/light/brazier', P.entry.x + 6, P.entry.y + 3, lit)
  glow(m, P.entry.x + 6.5, P.entry.y + 3.5, 5, 4, '#ff8a3a', 0.5)
  // lanterns along the drifts, each a pool of light in the dark
  for (const [x, y] of [[M.x + 3, M.y + 4], [M.x + 3, M.y + 16], [P.westLow.x + 4, P.westLow.y + 2], [P.eastMid.x + 14, P.eastMid.y + 2], [P.westHigh.x + 3, P.westHigh.y + 2], [P.eastHigh.x + 10, P.eastHigh.y + 2], [P.stopeE.x + 1, P.stopeE.y + 7], [P.stopeW.x + 7, P.stopeW.y + 5]] as Cell[]) {
    m.fixture('fixture/light/lantern', x, y, lit)
    glow(m, x + 0.5, y + 0.5, 5, 4, '#ffb35c', 0.45)
  }
  m.fixture('fixture/craft/workbench', P.stopeW.x, P.stopeW.y + 5)
  // the workings' own creatures keep to themselves (wary): the miners go down the shaft and past the cavern every day
  for (const [x, y] of [[P.cavern.x + 2, P.cavern.y + 1], [P.winze.x + 3, P.winze.y + 2]] as Cell[]) m.creature('beast/bat', x, y, { leash: 4, temper: 'wary' })
  m.creature('spider', P.cavern.x + 7, P.cavern.y + 5, { leash: 3, temper: 'wary' })
  m.anchors = { face: [M.x + 2, M.y + 12], stopeW: [P.stopeW.x + 5, P.stopeW.y + 3], stopeE: [P.stopeE.x + 3, P.stopeE.y + 1], entry: [P.entry.x + 3, P.entry.y + 2], down: [P.stopeE.x + 4, P.stopeE.y + 1], shaft: [P.winze.x + 2, P.winze.y] }
  return m
}

/** The old works the miners broke into: a hall of pillars before a sealed gate, a forge where the rock still burns, tombs, a vault. */
export function oldWorksHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'oldworks', `${p.id}.oldworks`, { en: `${p.name.en} — the Old Works`, zh: `${p.name.zh}·古代工坊` }, 'floor_stone', { music: 'crypt', light: 'dark', outside: false, floors: [['gate', 'marble'], ['way', 'runner'], ['landing', 'cave_floor']] })
  const Hh = P.hall
  for (const y of [Hh.y + 2, Hh.y + 7]) for (const x of [Hh.x + 2, Hh.x + 6, Hh.x + 10, Hh.x + 19, Hh.x + 23, Hh.x + 27]) m.building('crypt_pillar', x, y)
  const fires: Cell[] = [[P.gate.x + 1, P.gate.y + 4], [P.gate.x + 8, P.gate.y + 4], [Hh.x + 13, Hh.y + 5], [Hh.x + 16, Hh.y + 5]]
  at(m, 'fixture/light/brazier', fires, lit)
  for (const [x, y] of fires) glow(m, x + 0.5, y + 0.5, 5, 4, '#ff7a2a', 0.5)
  at(m, 'fixture/sacred/statue', [[Hh.x, Hh.y], [Hh.x + Hh.w - 1, Hh.y]])
  at(m, 'fixture/remains/bones', [[Hh.x + 4, Hh.y + 9], [Hh.x + 25, Hh.y + 1], [Hh.x + 8, Hh.y + 4], [P.way.x, P.way.y + 6]])
  // the forge: a pool of the rock still molten, the anvil, the tools of a smith no one remembers
  m.rect(P.forge.x, P.forge.y + 2, 3, 3, 'lava')
  m.fixture('fixture/craft/anvil', P.forge.x + 4, P.forge.y + 1)
  m.fixture('fixture/craft/forge', P.forge.x + 4, P.forge.y, lit)
  at(m, 'fixture/furniture/rack/arms', [[P.forge.x + 6, P.forge.y], [P.forge.x + 6, P.forge.y + 5]])
  glow(m, P.forge.x + 2, P.forge.y + 3.5, 7, 6, '#ff5a1a', 0.6)
  // the vault: its chests, a reliquary, gold in the wall
  at(m, 'fixture/container/chest', [[P.vault.x, P.vault.y], [P.vault.x + 2, P.vault.y], [P.vault.x + 4, P.vault.y], [P.vault.x + 6, P.vault.y + 5]])
  m.fixture('fixture/sacred/reliquary', P.vault.x + 3, P.vault.y + 3)
  m.fixture('fixture/nature/vein/gold', P.vault.x + 6, P.vault.y)
  for (const T of [P.tombW, P.tombE]) {
    at(m, 'fixture/sacred/sarcophagus', [[T.x + 1, T.y + 1], [T.x + 5, T.y + 1]])
    at(m, 'fixture/light/candles', [[T.x, T.y], [T.x + 7, T.y]], lit)
    m.fixture('fixture/sacred/tomb', T.x + 3, T.y + 4, tomb('Here lie the makers. They sealed the gate and stayed behind it.', '造物者长眠于此。他们封上了门，留在了门后。'))
    glow(m, T.x + 4, T.y + 1, 7, 4, '#ffb35c', 0.35)
  }
  for (const [x, y] of [[Hh.x + 4, Hh.y + 5], [Hh.x + 25, Hh.y + 5], [P.tombW.x + 4, P.tombW.y + 3]] as Cell[]) m.creature('undead/skeleton', x, y, { leash: 4 })
  m.creature('imp/fire_imp', P.forge.x + 5, P.forge.y + 3, { leash: 3 })
  m.anchors = { stair: [P.landing.x + 2, P.landing.y + 2], hall: [Hh.x + 15, Hh.y + 8], gate: [P.gate.x + 5, P.gate.y + 5] }
  return m
}

// ------------------------------------------------------------------------------------------------ Bellwick (the manor)

/** The manor's hall: the lord's chair on the dais, the table set for twenty, the busts and the sideboards, the stair up. */
export function manorHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'manorhall', `${p.id}.manorhall`, { en: `${p.name.en} — the Hall`, zh: `${p.name.zh}·庄园大厅` }, 'parquet', { floors: [['dais', 'carpet_royal'], ['entry', 'marble'], ['stair', 'marble']] })
  const H = P.hall
  const D = P.dais
  m.rect(H.x + 12, H.y, 2, H.h + 3, 'runner')
  at(m, 'fixture/furniture/table/long', span(H.x + 4, H.x + 10, H.y + 4))
  at(m, 'fixture/furniture/table/long', span(H.x + 15, H.x + 21, H.y + 4))
  at(m, 'fixture/furniture/chair', [...span(H.x + 4, H.x + 10, H.y + 3), ...span(H.x + 4, H.x + 10, H.y + 5), ...span(H.x + 15, H.x + 21, H.y + 3), ...span(H.x + 15, H.x + 21, H.y + 5)])
  at(m, 'fixture/light/candelabrum', [[H.x + 3, H.y + 4], [H.x + 22, H.y + 4]], lit)
  m.fixture('fixture/furniture/throne', D.x + 4, D.y)
  m.fixture('fixture/furniture/throne', D.x + 5, D.y)
  at(m, 'fixture/standard', [[D.x, D.y], [D.x + 9, D.y]])
  at(m, 'fixture/light/candelabrum', [[D.x + 1, D.y + 2], [D.x + 8, D.y + 2]], lit)
  at(m, 'fixture/sacred/statue', [[H.x, H.y], [H.x + H.w - 1, H.y], [P.bayE.x, P.bayE.y + 1]])
  at(m, 'fixture/container/cupboard', [[H.x, H.y + 4], [H.x, H.y + 5], [H.x + H.w - 1, H.y + 4], [H.x + H.w - 1, H.y + 5]])
  m.fixture('fixture/furniture/mirror', H.x + H.w - 1, H.y + 8)
  at(m, 'fixture/nature/plant', [[H.x + 1, H.y + 9], [H.x + H.w - 2, H.y + 9], [P.entry.x, P.entry.y + 2], [P.entry.x + 5, P.entry.y + 2]])
  decor(m, 'decor_rug', H.x + 5, H.y + 8)
  decor(m, 'decor_rug', H.x + 18, H.y + 8)
  glow(m, D.x + 5, D.y + 2, 14, 6, '#ffc46b', 0.4)
  glow(m, H.x + 13, H.y + 4, 22, 5, '#ffd27a', 0.3)
  m.anchors = { lord: [D.x + 4, D.y + 2], table: [H.x + 13, H.y + 4], hall: [H.x + 7, H.y + 8], up: [P.stair.x + 1, P.stair.y], down: [P.bayW.x, P.bayW.y + 1] }
  return m
}

/** The long gallery: the family's portraits down its length, busts in the bays, benches, the bookcases at its end. */
export function galleryHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'gallery', `${p.id}.gallery`, { en: `${p.name.en} — the Long Gallery`, zh: `${p.name.zh}·长廊` }, 'parquet', { outside: false, floors: [['landing', 'marble']] })
  const G = P.gallery
  m.rect(G.x + 1, G.y + 2, G.w - 2, 1, 'runner')
  for (const b of [P.bayN1, P.bayN2, P.bayN3]) {
    m.fixture('fixture/sacred/statue', b.x + 1, b.y)
    m.fixture('fixture/nature/plant', b.x + 3, b.y)
  }
  at(m, 'fixture/garden/bench', [[G.x + 6, G.y + 4], [G.x + 12, G.y + 4], [G.x + 21, G.y + 4], [G.x + 27, G.y + 4]])
  at(m, 'fixture/container/bookcase', [[G.x, G.y], [G.x, G.y + 1], [G.x + G.w - 1, G.y], [G.x + G.w - 1, G.y + 1]])
  m.fixture('fixture/furniture/desk', G.x + 1, G.y + 4)
  at(m, 'fixture/light/candelabrum', [[G.x + 9, G.y], [G.x + 18, G.y], [G.x + 27, G.y]], lit)
  glow(m, G.x + 15, G.y + 2, 28, 4, '#ffe8b0', 0.25, 'sun')
  m.anchors = { stair: [P.landing.x + 1, P.landing.y + 1], walk: [G.x + 9, G.y + 2] }
  return m
}

/** The kitchen and the wine cellar under the hall: the spit and the pot, the long table, the barrels in their rows. */
export function manorCellar(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'cellar', `${p.id}.cellar`, { en: `${p.name.en} — the Kitchens`, zh: `${p.name.zh}·厨房与酒窖` }, 'floor_stone', { outside: false })
  const K = P.kitchen
  const C = P.cellar
  m.fixture('fixture/craft/cauldron', K.x + 5, K.y, lit)
  at(m, 'fixture/container/cupboard', [[K.x, K.y], [K.x + 1, K.y]])
  at(m, 'fixture/container/pot', [[K.x + 8, K.y], [K.x + 9, K.y], [K.x + 10, K.y]])
  at(m, 'fixture/furniture/table/long', span(K.x + 3, K.x + 8, K.y + 4))
  at(m, 'fixture/furniture/bench', [...span(K.x + 3, K.x + 8, K.y + 5)])
  m.fixture('fixture/furniture/rack', K.x + 11, K.y)
  at(m, 'fixture/container/sack', [[K.x, K.y + 7], [K.x + 1, K.y + 7], [K.x, K.y + 8]])
  m.building('decor_casks_row', C.x + 1, C.y)
  m.building('decor_casks_row', C.x + 5, C.y)
  for (const y of [C.y + 3, C.y + 6]) at(m, 'fixture/container/barrel', span(C.x + 1, C.x + 7, y, 2))
  at(m, 'fixture/container/shelf', [[C.x + 8, C.y + 3], [C.x + 8, C.y + 4]])
  m.fixture('fixture/light/candles', C.x, C.y + 8, lit)
  glow(m, K.x + 6, K.y + 1, 9, 5, '#ff8a3a', 0.45)
  m.anchors = { cook: [K.x + 6, K.y + 2], cellar: [C.x + 4, C.y + 5], stair: [P.landing.x + 1, P.landing.y] }
  return m
}

// ------------------------------------------------------------------------------------------------ Ashengate (the ruin)

/** The undercroft under the ruined church: its pillars, the tombs, water standing on the floor, roots through the vault. */
export function undercroftHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'undercroft', `${p.id}.undercroft`, { en: `${p.name.en} — the Undercroft`, zh: `${p.name.zh}·地下墓堂` }, 'floor_stone', { music: 'crypt', light: 'dark', outside: false })
  const H = P.hall
  for (const y of [H.y + 2, H.y + 7]) for (const x of [H.x + 3, H.x + 6, H.x + 13, H.x + 16]) m.building('crypt_pillar', x, y)
  at(m, 'fixture/sacred/sarcophagus', [[H.x + 1, H.y + 1], [H.x + 18, H.y + 1], [H.x + 1, H.y + 8], [H.x + 18, H.y + 8]])
  m.rect(H.x + 9, H.y + 4, 3, 3, 'water')
  m.rect(H.x + 4, H.y + 5, 2, 1, 'water')
  at(m, 'fixture/remains/bones', [[H.x + 8, H.y + 9], [H.x + 15, H.y]])
  at(m, 'fixture/nature/ferns', [[H.x + 12, H.y], [H.x + 19, H.y + 5], [H.x, H.y + 7]])
  m.fixture('fixture/nature/boulder', H.x + 7, H.y + 5)
  m.fixture('fixture/sacred/altar', P.apse.x + 3, P.apse.y)
  m.fixture('fixture/sacred/reliquary', P.apse.x + 4, P.apse.y)
  at(m, 'fixture/light/candles', [[P.apse.x + 1, P.apse.y], [P.apse.x + 6, P.apse.y]], lit)
  glow(m, P.apse.x + 4, P.apse.y + 1.5, 8, 4, '#ffb35c', 0.45)
  // (wary: the scholars work at its altar every day)
  m.creature('undead/zombie', H.x + 15, H.y + 4, { leash: 4, temper: 'wary' })
  m.anchors = { stair: [P.landing.x + 1, P.landing.y], down: [H.x, H.y + 4], altar: [P.apse.x + 3, P.apse.y + 1] }
  return m
}

/** The drowned vault below: black water to the walls, a causeway of stones to the altar, what the monks hid there. */
export function drownedHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'drowned', `${p.id}.drowned`, { en: `${p.name.en} — the Drowned Vault`, zh: `${p.name.zh}·水淹地窖` }, 'floor_stone', { music: 'crypt', light: 'dark', outside: false })
  const Q = P.pool
  m.rect(Q.x, Q.y, Q.w, Q.h, 'water')
  const mid = Q.x + 7
  for (const [x, y] of [[0, 8], [0, 7], [0, 6], [1, 6], [1, 5], [1, 4], [0, 4], [0, 3], [0, 2], [1, 2], [0, 1], [1, 1], [-1, 0], [0, 0], [1, 0], [2, 0]] as Cell[]) m.set(mid + x, Q.y + y, 'floor_stone')
  m.fixture('fixture/sacred/reliquary', mid + 2, Q.y)
  m.fixture('fixture/container/chest', mid - 1, Q.y)
  at(m, 'fixture/light/candles', [[mid + 1, Q.y]], lit)
  glow(m, mid + 0.5, Q.y + 1, 6, 3, '#9fd8ff', 0.4)
  m.creature('undead/ghost', mid + 1, Q.y + 4, { leash: 4 })
  m.anchors = { stair: [P.landing.x + 1, P.landing.y], altar: [mid, Q.y + 1] }
  return m
}

// ------------------------------------------------------------------------------------------------ Northmoor Cave

/** Crystals and stalagmites along a rect's edges, glowing moss on its floor (the cave's furniture). */
function caveFurnish(m: MapBuilder, r: { x: number; y: number; w: number; h: number }, seed: number): void {
  for (let i = 0; i < r.w; i += 2) {
    const k = (i + seed) % 3
    if ((i + seed) % 4 === 0) decor(m, `decor_crystals_${k}`, r.x + i, r.y)
    else if ((i + seed) % 4 === 2) decor(m, `decor_stalagmite_${k}`, r.x + i, r.y)
  }
  decor(m, 'decor_glowmoss', r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2))
}

/** The ice caves: snow drifted in at the mouth, the hall of crystals, ice on the floor, the frozen dead, what lives there. */
export function iceCaveHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'icecave', `${p.id}.icecave`, { en: `${p.name.en} — the Ice Caves`, zh: `${p.name.zh}·冰窟` }, 'cave_floor', { music: 'crypt', light: 'dark', floors: [['entry', 'snow']] })
  for (const [x, y, rx, ry] of [[24, 27, 5, 2], [10, 20, 4, 2], [38, 18, 4, 1.5]]) m.organic(x, y, rx, ry, 'ice', { rough: 0.4, only: (c) => c === 'cave_floor' })
  for (const [k, r] of [P.hall, P.west, P.east, P.sw, P.se].entries()) caveFurnish(m, r, k)
  at(m, 'fixture/remains/bones', [[P.west.x + 1, P.west.y + 2], [P.hall.x + 8, P.hall.y + 5]])
  m.fixture('fixture/remains/body', P.west.x + 3, P.west.y + 3)
  m.fixture('fixture/container/chest', P.west.x + 5, P.west.y + 1)
  for (const [x, y] of [[P.hall.x + 2, P.hall.y + 2], [P.east.x + 4, P.east.y + 2], [P.west.x + 3, P.west.y + 1], [P.sw.x + 1, P.sw.y + 1], [P.entry.x + 2, P.entry.y]] as Cell[]) glow(m, x, y, 6, 4, '#9fd8ff', 0.4)
  // (wary: the ice-cutters work at the mouth every day)
  m.creature('golem/ice_golem', P.east.x + 4, P.east.y + 1, { leash: 3, temper: 'wary' })
  for (const [x, y] of [[P.hall.x + 6, P.hall.y + 3], [P.sw.x + 2, P.sw.y + 1]] as Cell[]) m.creature('slime/frost_slime', x, y, { leash: 4, temper: 'wary' })
  m.anchors = { entry: [P.entry.x + 2, P.entry.y + 2], hall: [P.hall.x + 5, P.hall.y + 3], down: [P.se.x + 2, P.se.y + 1] }
  return m
}

/** The lake under the ice: black water in a hall of crystal, an island with a saint frozen at prayer, the shore's moss. */
export function iceLakeHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'icelake', `${p.id}.icelake`, { en: `${p.name.en} — the Under-lake`, zh: `${p.name.zh}·地下冰湖` }, 'cave_floor', { music: 'crypt', light: 'dark', outside: false })
  const cx = 25
  const cy = 20
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === 'cave_floor' && ((x - cx) / 13) ** 2 + ((y - cy) / 5.5) ** 2 <= 1) m.set(x, y, 'water')
  m.organic(cx, cy, 2.5, 1.5, 'snow', { rough: 0.2 })
  m.fixture('fixture/sacred/statue', cx, cy)
  for (const [k, r] of [P.shore, P.west, P.east].entries()) caveFurnish(m, r, k + 3)
  for (let x = P.shore.x; x < P.shore.x + P.shore.w; x += 5) glow(m, x, P.shore.y, 6, 3, '#9fd8ff', 0.35)
  glow(m, cx + 0.5, cy + 0.5, 8, 5, '#c9a2f2', 0.4)
  m.creature('slime/frost_slime', P.east.x + 2, P.east.y + 2, { leash: 3 })
  m.anchors = { stair: [P.landing.x + 2, P.landing.y + 1], shore: [P.shore.x + 10, P.shore.y + 2] }
  return m
}

// ------------------------------------------------------------------------------------------------ Goldmere Tower

/** The tower's ground floor: the library, its desks and lecterns, the stair up and the stair down. */
export function towerHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'towerhall', `${p.id}.tower`, { en: `${p.name.en} — the Library`, zh: `${p.name.zh}·藏书大厅` }, 'parquet', { floors: [['entry', 'floor_stone']] })
  const R = P.room
  for (const x of [R.x + 4, R.x + 8, R.x + 12]) {
    m.fixture('fixture/furniture/desk', x, R.y + 4)
    m.fixture('fixture/furniture/chair', x, R.y + 5)
  }
  at(m, 'fixture/furniture/bookstand', [[R.x + 2, R.y + 7], [R.x + 13, R.y + 7]])
  m.fixture('fixture/sacred/lectern', R.x + 8, R.y + 8)
  at(m, 'fixture/container/bookcase', [[R.x, R.y + 3], [R.x, R.y + 4], [R.x + R.w - 1, R.y + 3], [R.x + R.w - 1, R.y + 4]])
  decor(m, 'decor_rug', R.x + 7, R.y + 6)
  decor(m, 'decor_crystals_0', R.x + 15, R.y + 8)
  at(m, 'fixture/light/candelabrum', [[R.x + 2, R.y + 1], [R.x + 13, R.y + 1]], lit)
  glow(m, R.x + 8, R.y + 4, 14, 5, '#c9a2f2', 0.3)
  m.anchors = { desk: [R.x + 8, R.y + 6], up: [R.x + 14, R.y], down: [R.x + 1, R.y] }
  return m
}

/** The alchemist's floor: two cauldrons on their fires, the benches, jars and retorts, a crystal growing on the bench. */
export function alchemyHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'alchemy', `${p.id}.alchemy`, { en: `${p.name.en} — the Laboratory`, zh: `${p.name.zh}·炼金室` }, 'floor_stone', { outside: false })
  const R = P.room
  at(m, 'fixture/craft/cauldron', [[R.x + 5, R.y + 3], [R.x + 9, R.y + 3]], lit)
  at(m, 'fixture/craft/workbench', [[R.x + 3, R.y + 6], [R.x + 7, R.y + 6], [R.x + 11, R.y + 6]])
  at(m, 'fixture/container/shelf', [[R.x, R.y + 4], [R.x, R.y + 5], [R.x + R.w - 1, R.y + 4], [R.x + R.w - 1, R.y + 5]])
  decor(m, 'decor_amphorae', R.x + 1, R.y + 8)
  decor(m, 'decor_crystals_1', R.x + 12, R.y + 8)
  at(m, 'fixture/container/chest', [[R.x + 6, R.y + 8]])
  for (const x of [R.x + 5, R.x + 9]) glow(m, x + 0.5, R.y + 3.5, 5, 4, '#7fe0a0', 0.45)
  m.anchors = { work: [R.x + 7, R.y + 5], down: [R.x + 1, R.y], up: [R.x + 12, R.y] }
  return m
}

/** The observatory under the spire: the great orb on its stand, the star charts, the desk, the window to the sky. */
export function observatoryHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'observatory', `${p.id}.observatory`, { en: `${p.name.en} — the Observatory`, zh: `${p.name.zh}·观星台` }, 'marble', { outside: false })
  const R = P.room
  decor(m, 'decor_crystals_2', R.x + 7, R.y + 4)
  m.rect(R.x + 5, R.y + 3, 5, 3, 'carpet_royal')
  at(m, 'fixture/furniture/desk', [[R.x + 2, R.y + 7], [R.x + 12, R.y + 7]])
  at(m, 'fixture/furniture/bookstand', [[R.x + 3, R.y + 2], [R.x + 11, R.y + 2]])
  at(m, 'fixture/furniture/chair', [[R.x + 2, R.y + 8], [R.x + 12, R.y + 8]])
  glow(m, R.x + 7.5, R.y + 4, 8, 5, '#c9a2f2', 0.55)
  m.anchors = { gaze: [R.x + 7, R.y + 7], down: [R.x + 1, R.y] }
  return m
}

/** The tower's cellar: its stores, the cage where something the mage keeps is kept. */
export function towerCellar(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'towercellar', `${p.id}.undercellar`, { en: `${p.name.en} — the Cellar`, zh: `${p.name.zh}·地下室` }, 'floor_stone', { music: 'crypt', light: 'dark', outside: false })
  const R = P.room
  for (const x of [R.x + 6, R.x + 10]) decor(m, 'decor_cage', x, R.y + 3)
  // (caged, and wary: the servants feed it)
  m.creature('imp/fire_imp', R.x + 8, R.y + 5, { leash: 2, temper: 'wary' })
  at(m, 'fixture/container/barrel', [[R.x + 13, R.y], [R.x + 13, R.y + 1], [R.x + 12, R.y]])
  at(m, 'fixture/container/chest', [[R.x + 13, R.y + 8], [R.x, R.y + 8]])
  at(m, 'fixture/remains/bones', [[R.x + 3, R.y + 6]])
  m.fixture('fixture/light/candles', R.x + 4, R.y, lit)
  glow(m, R.x + 8, R.y + 4, 8, 5, '#ff7a2a', 0.35)
  m.anchors = { up: [R.x + 1, R.y], cage: [R.x + 8, R.y + 7] }
  return m
}

// ------------------------------------------------------------------------------------------------ Scarwell (the bandits)

/** The chief's lodge: his seat by the hearth, the loot heaped by the walls, the furs, the table where the takings are shared. */
export function chiefLodge(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'chieflodge', `${p.id}.lodge`, { en: `${p.name.en} — the Chief's Lodge`, zh: `${p.name.zh}·头目木屋` }, 'floor_wood', { music: 'interior_night' })
  const L = P.lodge
  m.fixture('fixture/furniture/throne', L.x + 8, L.y + 1)
  decor(m, 'decor_loot', L.x, L.y)
  decor(m, 'decor_loot', L.x + 16, L.y)
  for (const [x, y] of [[L.x + 3, L.y + 4], [L.x + 13, L.y + 4]] as Cell[]) decor(m, 'decor_rug', x, y)
  setting(m, L.x + 9, L.y + 6)
  at(m, 'fixture/furniture/rack/arms', [[L.x, L.y + 3], [L.x, L.y + 4], [L.x + L.w - 1, L.y + 3]])
  at(m, 'fixture/container/barrel', [[L.x + L.w - 1, L.y + 7], [L.x + L.w - 1, L.y + 8], [L.x, L.y + 8]])
  at(m, 'fixture/container/chest', [[L.x + 2, L.y + 8], [L.x + 15, L.y + 8]])
  at(m, 'fixture/furniture/bed', [[L.x + 5, L.y + 8], [L.x + 12, L.y + 8]])
  glow(m, L.x + 9, L.y + 1, 9, 5, '#ff8a3a', 0.5)
  m.anchors = { chief: [L.x + 8, L.y + 3], eat: [L.x + 6, L.y + 6], guard: [L.x + 12, L.y + 6] }
  return m
}

/** The burrow behind the camp: the den with its fire and bedrolls, the hoard, the cells where the takings that can walk are kept. */
export function burrowHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'burrow', `${p.id}.burrow`, { en: `${p.name.en} — the Burrow`, zh: `${p.name.zh}·藏身洞` }, 'cave_floor', { music: 'crypt', light: 'dark' })
  const Dn = P.den
  m.fixture('fixture/light/campfire', Dn.x + 5, Dn.y + 2, lit)
  glow(m, Dn.x + 5.5, Dn.y + 2.5, 7, 5, '#ff8a3a', 0.55)
  at(m, 'fixture/furniture/bench/log', [[Dn.x + 3, Dn.y + 2], [Dn.x + 7, Dn.y + 2]])
  at(m, 'fixture/furniture/bed', [[Dn.x, Dn.y], [Dn.x + 2, Dn.y], [Dn.x + 9, Dn.y], [Dn.x, Dn.y + 4]])
  at(m, 'fixture/container/barrel', [[Dn.x + 9, Dn.y + 4], [Dn.x + 8, Dn.y + 4]])
  decor(m, 'decor_sacks', Dn.x + 3, Dn.y + 4)
  decor(m, 'decor_loot', P.hoard.x, P.hoard.y)
  decor(m, 'decor_loot', P.hoard.x + 3, P.hoard.y + 2)
  at(m, 'fixture/container/chest', [[P.hoard.x + 5, P.hoard.y], [P.hoard.x + 1, P.hoard.y + 3]])
  glow(m, P.hoard.x + 3, P.hoard.y + 1, 6, 4, '#ffd27a', 0.35)
  for (const x of [P.cells.x, P.cells.x + 2, P.cells.x + 4]) decor(m, 'decor_cage', x, P.cells.y)
  m.fixture('fixture/light/lantern', P.entry.x + 4, P.entry.y, lit)
  glow(m, P.entry.x + 4.5, P.entry.y + 0.5, 5, 4, '#ffb35c', 0.4)
  m.anchors = { den: [Dn.x + 5, Dn.y + 3], hoard: [P.hoard.x + 2, P.hoard.y + 1], cells: [P.cells.x + 2, P.cells.y + 2], entry: [P.entry.x + 2, P.entry.y + 2] }
  return m
}

// ------------------------------------------------------------------------------------------------ Frostbarrow (the border fort)

/** The garrison's hall: bunks along the walls, the mess table, the arms in the armoury's alcove, the stove. */
export function garrisonHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'garrison', `${p.id}.garrison`, { en: `${p.name.en} — the Garrison`, zh: `${p.name.zh}·营房` }, 'floor_wood', { floors: [['armoury', 'floor_stone']] })
  const H = P.hall
  at(m, 'fixture/furniture/bed', [...span(H.x + 8, H.x + 22, H.y, 2), ...span(H.x, H.x + 6, H.y + 9, 2), ...span(H.x + 16, H.x + 22, H.y + 9, 2)])
  at(m, 'fixture/container/chest', [[H.x + 9, H.y], [H.x + 13, H.y], [H.x + 17, H.y]])
  board(m, H.x + 7, H.y + 4, 10)
  at(m, 'fixture/furniture/rack/arms', span(P.armoury.x, P.armoury.x + 5, P.armoury.y))
  at(m, 'fixture/dummy', [[H.x + 22, H.y + 4], [H.x + 22, H.y + 6]])
  at(m, 'fixture/standard', [[H.x, H.y + 1], [H.x + H.w - 1, H.y + 1]])
  at(m, 'fixture/light/brazier', [[H.x, H.y + 5], [H.x + H.w - 1, H.y + 5]], lit)
  for (const x of [H.x, H.x + H.w - 1]) glow(m, x + 0.5, H.y + 5.5, 5, 4, '#ff8a3a', 0.45)
  decor(m, 'decor_firewood', H.x + 1, H.y + 7)
  m.anchors = { mess: [H.x + 12, H.y + 7], bunks: [H.x + 15, H.y + 1], arms: [P.armoury.x + 2, P.armoury.y + 1] }
  return m
}
