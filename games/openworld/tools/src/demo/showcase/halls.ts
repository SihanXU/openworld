// The showcase's halls laid out (docs/showcase.md §4; the user's word of 2026-10-26: "内饰怎么全是方块"): each from its own
// plan (tools/src/art/arch/plans.ts HALLS), its walls the plan's shell (art/arch/buildings/halls.ts), its floors in their
// kinds by the parts of the plan, and furnished as full as the hall would be — every alcove used, every wall lined,
// tables set, rugs down, lights lit. Each returns its map with the anchors its people keep to.

import type { Place } from '../continent/generate.ts'
import { MapBuilder, type Cell } from '../builder.ts'
import { HALLS, type HallPlan } from '../../art/arch/plans.ts'
import type { Text } from '@openworld/engine'

type Key = keyof typeof HALLS

/** A hall from its plan: the dark round it, its floors (a default and the parts' own), its walls, its doors to the outside. */
export function planHall(p: Place, key: Key, id: string, name: Text, floor: string, opts: { music?: string; light?: 'indoor' | 'dark'; kind?: string; floors?: [string, string][]; outside?: boolean } = {}): { m: MapBuilder; P: HallPlan['parts']; plan: HallPlan } {
  const plan = HALLS[key]
  const W = plan.plan[0].length
  const H = plan.plan.length
  const m = new MapBuilder(id, name, opts.kind ?? 'interior', W, H, 'void', opts.music ?? 'interior', opts.light ?? 'indoor', p.region)
  m.backdrop = true
  m.zone = 'peaceful'
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (plan.plan[y][x] === '.') m.set(x, y, floor)
  for (const [part, t] of opts.floors ?? []) {
    const r = plan.parts[part]
    if (r) m.rect(r.x, r.y, r.w, r.h, t)
  }
  m.building(`${key}_shell`, 0, 0)
  if (opts.outside !== false) {
    for (const [x, y] of plan.doors) m.set(x, y, 'door')
    if (plan.doors.length) m.doors.out = plan.doors[0]
  }
  return { m, P: plan.parts, plan }
}

export const glow = (m: MapBuilder, x: number, y: number, w: number, h: number, color = '#ff9a4a', strength = 0.4, when: 'always' | 'night' | 'sun' = 'always') => m.lights.push({ x, y, w, h, color, shape: 'glow', when, strength })
export const lit = { statuses: { lit: -1 } }

/** The crypt under the choir: its vault on two rows of pillars, a sarcophagus in every bay, the reliquary in the apse, candles. */
export function cryptHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'crypt', `${p.id}.crypt`, { en: `${p.name.en} — the Crypt`, zh: `${p.name.zh}·地下墓室` }, 'floor_stone', { music: 'crypt', light: 'dark', kind: 'dungeon', outside: false, floors: [['apse', 'marble']] })
  const H = P.hall
  m.rect(12, H.y, 2, H.h + 2, 'carpet_royal')
  for (const y of [H.y + 1, H.y + 4, H.y + 7]) for (const x of [8, 17, 5, 20]) m.building('crypt_pillar', x, y)
  for (const r of [P.bayW1, P.bayW2, P.bayE1, P.bayE2]) {
    m.fixture('fixture/sacred/sarcophagus', r.x + 1, r.y)
    m.fixture('fixture/light/candles', r.x + (r.x < 10 ? 2 : 0), r.y + 2, lit)
  }
  for (const [x, y] of [[10, H.y + 2], [15, H.y + 2], [10, H.y + 6], [15, H.y + 6]] as Cell[]) m.fixture('fixture/sacred/tomb', x, y, { props: { text: 'Here lies a brother of Sunwell. The light keeps him.', text_zh: '此处安息着日泉的一位修士。光守着他。' } })
  m.fixture('fixture/sacred/reliquary', 12, P.apse.y)
  for (const x of [10, 15]) m.fixture('fixture/light/candelabrum', x, P.apse.y, lit)
  for (const [x, y] of [[6, H.y + 9], [19, H.y + 9], [4, H.y], [21, H.y]] as Cell[]) m.fixture('fixture/container/pot', x, y)
  for (const [x, y] of [[22, H.y + 9], [7, H.y + 4]] as Cell[]) m.fixture('fixture/remains/bones', x, y)
  for (const [x, y] of [[5, H.y + 3], [20, H.y + 6]] as Cell[]) m.building('decor_amphorae', x, y)
  glow(m, 12.5, P.apse.y + 1, 8, 4, '#ffb35c', 0.5)
  for (const r of [P.bayW1, P.bayW2, P.bayE1, P.bayE2]) glow(m, r.x + 1.5, r.y + 1.5, 4, 3, '#ffb35c', 0.35)
  m.anchors = { stair: [12, P.entry.y], apse: [12, P.apse.y + 1] }
  return m
}

/** The belfry: the bells in their frame, the ropes, the brothers' stores, the light through its lancets. */
export function belfryHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'belfry', `${p.id}.belfry`, { en: `${p.name.en} — the Belfry`, zh: `${p.name.zh}·钟楼` }, 'floor_wood', { music: 'temple', outside: false, floors: [['landing', 'floor_stone']] })
  const C = P.chamber
  m.building('belfry_bells', 5, C.y + 2)
  for (const [x, y] of [[C.x, C.y], [C.x + 1, C.y]] as Cell[]) m.fixture('fixture/container/crate', x, y)
  m.building('decor_sacks', C.x + 9, C.y)
  m.building('decor_casks', C.x, C.y + 7)
  m.fixture('fixture/container/chest', C.x + 9, C.y + 7)
  m.fixture('fixture/light/candles', C.x + 8, C.y + 8, lit)
  // the ringers' bench and their ropes' coils, the bell-founder's tools, spare timbers, the pigeons that roost up here
  m.fixture('fixture/furniture/bench/log', C.x + 5, C.y + 8)
  for (const [x, y] of [[C.x + 2, C.y + 8], [C.x + 8, C.y + 5]] as Cell[]) m.fixture('fixture/container/sack', x, y)
  m.building('decor_firewood', C.x, C.y + 4)
  m.building('decor_crates', C.x + 9, C.y + 3)
  for (const [x, y] of [[C.x + 3, C.y + 1], [C.x + 6, C.y + 6], [C.x + 1, C.y + 6]] as Cell[]) m.building('decor_pigeons_1', x, y)
  m.building('decor_straw', C.x + 7, C.y + 7)
  m.fixture('fixture/furniture/rack/arms', C.x + 9, C.y + 6)
  glow(m, 7, C.y + 3, 10, 6, '#ffe8b0', 0.28, 'sun')
  m.anchors = { stair: [6, P.landing.y], bells: [7, C.y + 6] }
  return m
}

/** The library: cases in ranks, a desk in every window bay, the lectern on its rug, the reading table, alcoves to read in. */
export function libraryHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'library', `${p.id}.library`, { en: `${p.name.en} — the Library`, zh: `${p.name.zh}·藏书楼` }, 'parquet', { floors: [['entry', 'floor_wood']] })
  const H = P.hall
  m.rect(14, H.y, 2, H.h + 2, 'carpet_royal')
  m.rect(12, H.y + 5, 6, 4, 'carpet_royal')
  for (const y of [H.y + 1, H.y + 4, H.y + 7]) for (const x of [4, 7, 10, 19, 22, 25]) m.fixture('fixture/container/bookcase', x, y)
  for (const r of [P.bay1, P.bay2, P.bay3]) {
    m.fixture('fixture/furniture/desk', r.x + 1, r.y)
    m.fixture('fixture/furniture/chair', r.x + 1, r.y + 1)
    m.fixture('fixture/light/candles', r.x + 3, r.y, lit)
  }
  for (const r of [P.alcoveW, P.alcoveE]) {
    m.fixture('fixture/furniture/table', r.x + (r.x < 10 ? 0 : 1), r.y + 1)
    m.fixture('fixture/furniture/chair', r.x + (r.x < 10 ? 1 : 0), r.y + 1)
    m.fixture('fixture/nature/plant', r.x, r.y + 3)
  }
  m.fixture('fixture/sacred/lectern', 14, H.y + 6)
  for (const x of [12, 17]) m.fixture('fixture/light/candelabrum', x, H.y + 5, lit)
  m.fixture('fixture/furniture/table/long', 15, H.y + 9)
  for (const x of [14, 15, 16]) for (const y of [H.y + 8, H.y + 10]) m.fixture('fixture/furniture/chair', x, y)
  for (const [x, y] of [[4, H.y + 10], [25, H.y + 10]] as Cell[]) m.fixture('fixture/container/chest', x, y)
  for (const [x, y] of [[3, H.y + 10], [26, H.y + 10]] as Cell[]) m.fixture('fixture/nature/plant', x, y)
  for (const r of [P.bay1, P.bay2, P.bay3]) m.lights.push({ x: r.x + 2, y: r.y + 3, w: 2, h: 3, color: '#ffe08a', shape: 'lancet', when: 'sun', strength: 0.35 })
  m.anchors = { desks: [15, H.y + 10], cases: [13, H.y + 3] }
  return m
}

/** The refectory: the high table on its dais, the reader's pulpit, three ranks of long tables and benches, the kitchen's hatch. */
export function refectoryHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'refectory', `${p.id}.refectory`, { en: `${p.name.en} — the Refectory`, zh: `${p.name.zh}·食堂` }, 'flags', { floors: [['dais', 'parquet'], ['hatch', 'floor_stone'], ['pulpit', 'parquet']] })
  const H = P.hall
  m.rect(12, H.y, 2, H.h + 1, 'carpet_royal')
  for (const x of [11, 14]) m.fixture('fixture/furniture/table/long', x, P.dais.y + 1)
  for (const x of [10, 11, 12, 13, 14, 15]) m.fixture('fixture/furniture/chair', x, P.dais.y)
  m.fixture('fixture/sacred/pulpit', P.pulpit.x + 1, P.pulpit.y)
  for (const y of [H.y + 2, H.y + 5, H.y + 8]) for (const x of [5, 9, 16, 20]) {
    m.fixture('fixture/furniture/table/long', x, y)
    m.fixture('fixture/furniture/bench/log', x, y + 1)
    m.fixture('fixture/light/candles', x, y - 1, lit)
  }
  m.fixture('fixture/craft/cauldron', P.hatch.x, P.hatch.y)
  m.fixture('fixture/container/cupboard', P.hatch.x, P.hatch.y + 2)
  m.building('decor_casks', P.hatch.x + 1, P.hatch.y + 3)
  for (const [x, y] of [[H.x, H.y], [H.x, H.y + 1], [H.x + 1, H.y]] as Cell[]) m.fixture('fixture/container/barrel', x, y)
  m.building('decor_sacks', H.x + H.w - 1, H.y + H.h - 1)
  m.building('decor_amphorae', H.x, H.y + H.h - 1)
  glow(m, 12.5, P.dais.y + 1, 10, 4, '#ffe8b0', 0.25, 'sun')
  m.anchors = { table: [12, H.y], bench: [12, H.y + 7] }
  return m
}

/** The keep's great hall: the dais, the throne under its cloth of estate, the high table; long tables, braziers, arms, the hearth. */
export function greatHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'greathall', `${p.id}.hall`, { en: `${p.name.en} — the Great Hall`, zh: `${p.name.zh}·大厅` }, 'flags', { floors: [['dais', 'carpet_royal'], ['bayW', 'floor_stone'], ['bayE', 'floor_stone']] })
  const H = P.hall
  m.rect(13, H.y, 2, H.h + 1, 'carpet_royal')
  m.fixture('fixture/furniture/throne', 14, P.dais.y)
  m.fixture('fixture/furniture/table/long', 14, P.dais.y + 2)
  for (const x of [11, 12, 16, 17]) m.fixture('fixture/furniture/chair', x, P.dais.y + 1)
  for (const x of [10, 18]) m.fixture('fixture/standard', x, P.dais.y)
  for (const y of [H.y + 2, H.y + 5, H.y + 8]) for (const x of [8, 19]) {
    m.fixture('fixture/furniture/table/long', x, y)
    m.fixture('fixture/furniture/bench/log', x, y + 1)
    m.fixture('fixture/light/candles', x, y - 1, lit)
  }
  for (const [x, y] of [[4, H.y + 1], [23, H.y + 1], [4, H.y + 7], [23, H.y + 7]] as Cell[]) m.building('hall_pillar', x, y)
  for (const x of [11, 16]) m.fixture('fixture/light/brazier', x, H.y, lit)
  for (const [x, y] of [[3, H.y + 4], [24, H.y + 4], [P.bayW.x, P.bayW.y + 1], [P.bayE.x, P.bayE.y + 1]] as Cell[]) m.fixture('fixture/furniture/rack/arms', x, y)
  for (const [x, y] of [[3, H.y + 10], [24, H.y + 10]] as Cell[]) m.fixture('fixture/container/chest', x, y)
  m.building('decor_casks', H.x, H.y + H.h - 2)
  m.building('decor_crates', H.x + H.w - 1, H.y + H.h - 2)
  glow(m, 14, P.dais.y + 1, 14, 6, '#ff9a4a', 0.45)
  m.anchors = { throne: [14, P.dais.y + 1], eat: [11, H.y + 3], work: [12, H.y + 10] }
  return m
}

/** The castellan's floor: the bedchamber and its great bed, the study with its books and desk, the closet, the stair down. */
export function solarHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'solar', `${p.id}.solar`, { en: `${p.name.en} — the Castellan's Floor`, zh: `${p.name.zh}·城主居所` }, 'parquet', { outside: false, floors: [['study', 'floor_wood'], ['closet', 'floor_stone'], ['passage', 'floor_wood']] })
  const C = P.chamber
  const S = P.study
  m.rect(C.x + 3, C.y + 4, 4, 3, 'carpet_royal')
  m.rect(S.x + 2, S.y + 3, 4, 3, 'carpet_royal')
  m.fixture('fixture/furniture/bed', C.x + 1, C.y + 1)
  m.fixture('fixture/container/chest', C.x + 1, C.y + 3)
  m.fixture('fixture/container/wardrobe', C.x + 6, C.y)
  m.fixture('fixture/container/drawers', C.x + 8, C.y)
  m.fixture('fixture/furniture/mirror', C.x + 8, C.y + 3)
  m.fixture('fixture/furniture/table', C.x + 5, C.y + 5)
  for (const dx of [4, 6]) m.fixture('fixture/furniture/chair', C.x + dx, C.y + 5)
  for (const [x, y] of [[C.x, C.y + 8], [C.x + 8, C.y + 8]] as Cell[]) m.fixture('fixture/nature/plant', x, y)
  m.fixture('fixture/light/candles', C.x + 2, C.y, lit)
  m.fixture('fixture/container/bookcase', S.x, S.y)
  m.fixture('fixture/container/bookcase', S.x + 6, S.y)
  m.fixture('fixture/furniture/desk', S.x + 3, S.y + 1)
  m.fixture('fixture/furniture/chair', S.x + 3, S.y + 2)
  m.fixture('fixture/furniture/table', S.x + 4, S.y + 4)
  for (const dx of [3, 5]) m.fixture('fixture/furniture/chair', S.x + dx, S.y + 4)
  for (const dx of [5, 6, 7]) m.fixture('fixture/furniture/rack/arms', S.x + dx, S.y + 6)
  m.fixture('fixture/container/chest', P.closet.x, P.closet.y)
  m.fixture('fixture/container/chest', P.closet.x + 1, P.closet.y)
  m.fixture('fixture/light/candles', S.x + 7, S.y + 2, lit)
  glow(m, C.x + 4.5, C.y + 1, 8, 4, '#ff9a4a', 0.4)
  glow(m, S.x + 4, S.y + 1, 7, 4, '#ff9a4a', 0.35, 'night')
  m.anchors = { bed: [C.x + 1, C.y + 1], eat: [C.x + 5, C.y + 6], work: [S.x + 3, S.y + 3], stair: [C.x + 1, C.y + C.h - 2] }
  return m
}

/** The Bell Ward's council chamber: the mayor's seat under its cloth of estate, the council's tables, the citizens' benches, the clerk. */
export function councilHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'council', `${p.id}.hall`, { en: `${p.name.en} — the Council Hall`, zh: `${p.name.zh}·议事厅` }, 'marble', { floors: [['dais', 'carpet_royal']] })
  const H = P.hall
  m.rect(12, H.y, 2, H.h + 1, 'carpet_royal')
  m.fixture('fixture/furniture/throne', 12, P.dais.y)
  for (const x of [9, 16]) m.fixture('fixture/standard', x, P.dais.y)
  for (const x of [9, 16]) m.fixture('fixture/light/candelabrum', x, P.dais.y + 2, lit)
  for (const x of [8, 17]) {
    m.fixture('fixture/furniture/table/long', x, H.y + 2)
    for (const dx of [-1, 0, 1]) for (const dy of [1, 3]) m.fixture('fixture/furniture/chair', x + dx, H.y + dy)
  }
  for (const y of [H.y + 6, H.y + 8]) for (const x of [5, 19]) m.fixture('fixture/furniture/pew', x, y)
  for (const [x, y] of [[3, H.y], [21, H.y]] as Cell[]) m.fixture('fixture/container/bookcase', x, y)
  m.fixture('fixture/furniture/desk', 3, H.y + 4)
  m.fixture('fixture/sacred/lectern', 22, H.y + 4)
  for (const [x, y] of [[2, H.y + 9], [23, H.y + 9]] as Cell[]) m.fixture('fixture/nature/plant', x, y)
  for (let k = 0; k < 4; k++) m.lights.push({ x: 4.5 + k * 5.5, y: H.y + 2, w: 2, h: 4, color: k % 2 ? '#d9474e' : '#f0bd45', shape: 'lancet', when: 'sun', strength: 0.35 })
  m.anchors = { seat: [12, P.dais.y + 1], clerk: [4, H.y + 5], bench: [12, H.y + 7] }
  return m
}

/** The market hall: stalls in two ranks under its roof, counters along the north wall, the loading bay heaped, pillars. */
export function marketHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'markethall', `${p.id}.hall`, { en: `${p.name.en} — the Market Hall`, zh: `${p.name.zh}·市场大厅` }, 'floor_wood', { music: 'shop', floors: [['bay', 'floor_stone']] })
  const H = P.hall
  m.rect(12, H.y, 4, H.h + 1, 'flags')
  m.rect(H.x, H.y + 5, H.w, 1, 'flags')
  for (const x of [3, 5, 7, 20, 22, 24]) m.fixture('fixture/furniture/counter', x, H.y)
  const TRADES = ['bread', 'fruit', 'cloth', 'candles', 'herbs', 'pots', 'fish', 'meat']
  let k = 0
  for (const y of [H.y + 3, H.y + 8]) for (const x of [3, 7, 17, 21]) m.building(`market_stall_${TRADES[k++ % TRADES.length]}`, x, y - 1)
  for (const [x, y] of [[10, H.y + 2], [17, H.y + 2], [10, H.y + 8], [17, H.y + 8]] as Cell[]) m.building('hall_pillar', x, y)
  m.building('decor_crates_row', P.bay.x, P.bay.y)
  m.building('decor_sacks', P.bay.x + 3, P.bay.y)
  m.building('decor_casks_row', P.bay.x + 5, P.bay.y)
  m.building('decor_cart', P.bay.x + 3, P.bay.y + 1)
  for (const [x, y] of [[H.x, H.y + 10], [H.x + H.w - 1, H.y + 10], [H.x, H.y + 6], [H.x + H.w - 1, H.y + 6]] as Cell[]) m.building('decor_casks', x, y)
  for (const [x, y] of [[H.x + 1, H.y + 10], [H.x + H.w - 2, H.y + 10]] as Cell[]) m.building('decor_amphorae', x, y)
  glow(m, 14, H.y + 1, 22, 5, '#ffe8b0', 0.22, 'sun')
  m.anchors = { counters: [4, H.y + 1], counters2: [21, H.y + 1], rest: [13, H.y + 6] }
  return m
}

/** The Pilgrims' Rest's common room: the bar and its casks, tables by the hearth, the lodgers' beds through the arch. */
export function innHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'inn', `${p.id}.inn-0`, { en: `${p.name.en} — the Pilgrims' Rest`, zh: `${p.name.zh}·朝圣者客栈` }, 'floor_wood', { floors: [['hearth', 'floor_stone'], ['dorm', 'parquet']] })
  const C = P.common
  const D = P.dorm
  m.rect(C.x + 5, P.hearth.y + 2, 6, 3, 'carpet_royal')
  for (let y = C.y + 1; y < C.y + 7; y++) m.fixture('fixture/furniture/counter', C.x + 2, y)
  for (let y = C.y; y < C.y + 7; y += 2) m.fixture('fixture/container/barrel', C.x, y)
  m.building('decor_casks', C.x, C.y + 7)
  for (const [x, y] of [[C.x + 6, C.y + 2], [C.x + 9, C.y + 2]] as Cell[]) m.fixture('fixture/furniture/bench/log', x, y)
  for (const [x, y] of [[C.x + 6, C.y + 5], [C.x + 10, C.y + 5], [C.x + 13, C.y + 3], [C.x + 6, C.y + 8], [C.x + 10, C.y + 8], [C.x + 13, C.y + 7]] as Cell[]) {
    m.fixture('fixture/furniture/table', x, y)
    for (const dx of [-1, 1]) m.fixture('fixture/furniture/chair', x + dx, y)
    m.fixture('fixture/light/candles', x, y - 1, lit)
  }
  m.fixture('fixture/sign/noticeboard', C.x + C.w - 1, C.y)
  for (const [x, y] of [[C.x + C.w - 1, C.y + C.h - 1], [C.x + 3, C.y + C.h - 1]] as Cell[]) m.fixture('fixture/nature/plant', x, y)
  for (const y of [D.y, D.y + 3, D.y + 6]) for (const x of [D.x, D.x + 3]) {
    m.fixture('fixture/furniture/bed', x, y)
    m.fixture('fixture/container/chest', x + 1, y)
  }
  m.fixture('fixture/light/candles', D.x + 2, D.y + D.h - 1, lit)
  glow(m, C.x + 8, P.hearth.y + 1, 10, 6, '#ff9a4a', 0.45)
  glow(m, C.x + 2, C.y + 3, 4, 5, '#ffc46b', 0.3)
  m.anchors = { bar: [C.x + 3, C.y + 3], eat: [C.x + 8, C.y + 6], rest: [C.x + 7, C.y + 3], bard: [C.x + 12, C.y + 5] }
  return m
}

/** The Drowned Lantern: low and crooked, its counter, its casks heaped, tables close by the fire, two beds in the nook. */
export function tavernHall(p: Place): MapBuilder {
  const { m, P } = planHall(p, 'tavern', `${p.id}.inn-0`, { en: `${p.name.en} — the Drowned Lantern`, zh: `${p.name.zh}·溺灯酒馆` }, 'floor_wood', { music: 'interior_night', floors: [['hearth', 'floor_stone']] })
  const M = P.main
  const N = P.nook
  for (const x of [M.x + 8, M.x + 9, M.x + 10, M.x + 11]) m.fixture('fixture/furniture/counter', x, M.y + 2)
  m.building('decor_casks_row', M.x + 8, M.y)
  m.building('decor_casks', M.x + 10, M.y)
  m.fixture('fixture/container/barrel', M.x + 11, M.y)
  for (const [x, y] of [[M.x + 2, M.y + 4], [M.x + 5, M.y + 6], [M.x + 2, M.y + 7], [M.x + 9, M.y + 6]] as Cell[]) {
    m.fixture('fixture/furniture/table', x, y)
    for (const dx of [-1, 1]) m.fixture('fixture/furniture/chair', x + dx, y)
    m.fixture('fixture/light/candles', x, y - 1, lit)
  }
  m.fixture('fixture/furniture/bench/log', M.x + 5, M.y + 1)
  m.building('decor_sacks', M.x, M.y)
  for (const x of [N.x, N.x + 2]) m.fixture('fixture/furniture/bed', x, N.y)
  m.fixture('fixture/container/chest', N.x + 3, N.y + 3)
  m.fixture('fixture/furniture/table', N.x + 1, N.y + 3)
  glow(m, M.x + 5, P.hearth.y + 1, 9, 6, '#ff8a3a', 0.5)
  m.anchors = { bar: [M.x + 9, M.y + 3], rest: [M.x + 4, M.y + 5], bard: [M.x + 6, M.y + 3], eat: [M.x + 3, M.y + 5] }
  return m
}
