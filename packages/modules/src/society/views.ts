// The people's panels (docs/npc-sandbox.md): a talk, a trade, a person's pockets, as the client draws them.

import { itemInfo, matchSelector, splitStacks, stackKey, type Engine, type Entity, type Frame, type GiftView, type Id, type ResidenceView, type ResidenceWorkDef, type ResidenceWorkView, type Selector, type TradeView } from '@openworld/engine'
import { socialOf } from './state.ts'
import { residentWorkEligibility, residentWorkOrderView, residentWorkView } from './resident-work.ts'

/** The views of the people's panels the host has open (docs/npc-sandbox.md): a talk, a trade, a person's pockets. */
export function peopleViews(eng: Engine, open: { talk?: { who: Id; arrest?: boolean }; trade?: Id; pockets?: Id; gift?: Id }): Pick<Frame, 'talk' | 'trade' | 'pockets' | 'gift'> {
  const w = eng.world
  const p = w.player
  const s = socialOf(eng)
  const out: Pick<Frame, 'talk' | 'trade' | 'pockets' | 'gift'> = {}
  const talkTo = open.talk && w.get(open.talk.who)
  if (talkTo?.npc) out.talk = { name: talkTo.name ?? w.onto.resolve(talkTo.type).name ?? talkTo.id, ...s.talkView(talkTo, p, open.talk!.arrest) }
  const m = open.trade ? w.get(open.trade) : undefined
  if (m?.npc) {
    const carried = [...(p.contents ?? []), ...(p.held ? [p.held] : [])].map((id) => w.get(id)).filter((e): e is NonNullable<typeof e> => !!e)
    out.trade = {
      who: m.id,
      name: m.name ?? w.onto.resolve(m.type).name ?? m.id,
      goods: rows(eng, s.stock(m), (e) => s.priceToBuy(e, m, p)),
      offers: rows(eng, carried.filter((e) => s.buys(m, e, p)), (e) => s.priceToSell(e, p, m)),
      purse: s.purse(p),
      theirs: s.purse(m),
      discount: Math.round(s.regardDiscount(m, p.id) * 100) / 100,
    }
  }
  const who = open.pockets ? w.get(open.pockets) : undefined
  if (who?.npc) {
    const worn = new Set(w.worn(who).map((e) => e.id))
    out.pockets = {
      id: who.id,
      name: who.name ?? w.onto.resolve(who.type).name ?? who.id,
      contents: [...(who.contents ?? []), ...(who.held ? [who.held] : [])].flatMap((id) => {
        const info = itemInfo(eng, id)
        return info ? [{ ...info, ...(worn.has(id) && { worn: true }) }] : []
      }),
    }
  }
  const to = open.gift ? w.get(open.gift) : undefined
  if (to?.npc) out.gift = giftView(eng, to)
  return out
}

/** The configured home ground's beds and whole-map work counts. Work is shown only while its map is live and observed. */
export function residenceView(eng: Engine): Pick<Frame, 'residence'> {
  const w = eng.world
  const home = w.onto.data.social?.residence
  if (!home) return {}

  const residents = w.people()
    .filter((e) => e.npc?.resident?.map === home.map)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e) => {
      const eligibility = residentWorkEligibility(eng, e)
      return { id: e.id, name: e.name ?? w.onto.resolve(e.type).name ?? e.type, slot: e.npc!.resident!.slot, eligible: eligibility.eligible, ...(eligibility.reason && { eligibilityReason: eligibility.reason }), ...(residentWorkOrderView(eng, e) && { order: residentWorkOrderView(eng, e) }) }
    })
  const playerMap = w.posOf(w.player)?.map
  const view: ResidenceView = { map: home.map, active: eng.activeMap === home.map, onMap: playerMap === home.map, residents }

  view.recoveries = [...w.withProp('residentWorkMap', home.map)]
    .filter((e) => !e.npc?.resident || !w.isAgent(e))
    .flatMap((e) => {
      const order = e.residentWork
      const p = w.posOf(e)
      const isRemains = !w.isAgent(e)
      if (!order || !p || p.map !== home.map || !order.cargoIds.length || (!isRemains && !['revoked', 'recovery', 'paused'].includes(order.status))) return []
      const cargo = order.cargoIds.flatMap((id) => { const info = itemInfo(eng, id); return info ? [info] : [] })
      return cargo.length ? [{ id: e.id, name: e.name ?? w.onto.resolve(e.type).name ?? e.type, x: p.x, y: p.y, cargo, status: isRemains ? 'recovery' as const : order.status as 'paused' | 'revoked' | 'recovery', ...(order.blockedReason && { blockedReason: order.blockedReason }) }] : []
    })

  if (w.map(home.map)?.anchors) {
    const beds = socialOf(eng).residenceBeds()
    view.beds = {
      total: beds.length,
      occupied: beds.filter((bed) => bed.who).length,
      empty: beds.filter((bed) => !bed.who).length,
      slots: beds.map((bed) => ({ anchor: bed.anchor, ...(bed.who && { resident: bed.who }) })),
    }
  }

  const def = home.work
  if (def && view.active && view.onMap) {
    const counts = residenceWork(eng, home.map, def)
    view.work = { ...counts, crops: { ...counts.crops, ...residentWorkView(eng, def) } }
  }
  return { residence: view }
}

function residenceWork(eng: Engine, map: string, def: ResidenceWorkDef): ResidenceWorkView {
  const w = eng.world
  const onGround = w.entitiesOnMap(map)
    .filter((e) => e.place.on === 'tile')
    .map((entity) => ({ entity, view: w.view({ e: entity.id }) }))
  const matches = (candidate: (typeof onGround)[number], selector: Selector | undefined) => !!selector && matchSelector(selector, candidate.view)
  const count = (selector: Selector | undefined, within?: Selector) => selector
    ? onGround.filter((candidate) => matches(candidate, selector) && (!within || matches(candidate, within))).length
    : undefined
  const out: ResidenceWorkView = {}

  if (def.crop || def.ripe || def.growing) out.crops = {
    ...(def.crop && { total: count(def.crop) }),
    ...(def.ripe && { ripe: count(def.ripe, def.crop) }),
    ...(def.growing && { needsWater: count(def.growing, def.crop) }),
  }
  if (def.livestock || def.unfed || def.milkable) out.livestock = {
    ...(def.livestock && { total: count(def.livestock) }),
    ...(def.unfed && { unfed: count(def.unfed, def.livestock) }),
    ...(def.milkable && { milkable: count(def.milkable, def.livestock) }),
  }
  if (def.egg) out.groundEggs = count(def.egg) ?? 0
  if (def.warehouse) out.warehouses = onGround.filter((candidate) => matches(candidate, def.warehouse)).map(({ entity: box }) => {
    const contents = (box.contents ?? []).map((id) => w.get(id)).filter((e): e is Entity => !!e && e.place.on === 'inside' && e.place.holder === box.id)
    const rows = new Map<string, NonNullable<ReturnType<typeof itemInfo>> & { count: number }>()
    for (const item of contents) {
      const key = stackKey(item)
      const row = rows.get(key)
      if (row) row.count++
      else {
        const info = itemInfo(eng, item.id)
        if (info) rows.set(key, { ...info, count: 1 })
      }
    }
    const capacity = w.prop(box, 'capacity')
    const p = w.posOf(box)!
    const owner = eng.society.relation(eng.society.ownerOf(box), w.player)
    const locked = !!box.frozenBy || w.hasTag(box, 'locked') || w.hasStatus({ e: box.id }, 'locked')
    return {
      id: box.id,
      type: box.type,
      name: box.name ?? w.onto.resolve(box.type).name ?? box.type,
      x: p.x,
      y: p.y,
      selectable: owner !== 'another' && !locked,
      ...((owner === 'another' || locked) && { unavailableReason: owner === 'another' ? { en: 'Owned by someone else', zh: '属于他人' } : { en: 'Locked or unavailable', zh: '已上锁或暂不可用' } }),
      ...(typeof capacity === 'number' && { capacity }),
      usedSlots: splitStacks(contents).length,
      contents: [...rows.values()],
    }
  })
  return out
}

/**
 * The gift panel's view (docs/npc-sandbox.md §2.15): what the person likes best, named only once they have said it to
 * the one at the keys; what the one at the keys carries that may be given (not what is bound to them, nor coin), things
 * alike as one row, each with how warmly it would be taken.
 */
export function giftView(eng: Engine, to: Entity): GiftView {
  const w = eng.world
  const p = w.player
  const s = socialOf(eng)
  const fav = s.favourite(to)
  const told = s.toldFavourite(to, p.id)
  const def = fav ? w.onto.resolve(fav) : undefined
  const by = new Map<string, GiftView['items'][number]>()
  for (const id of p.contents ?? []) {
    const e = w.get(id)
    if (!e || e.frozenBy || s.isCoin(e) || w.hasTag(e, 'bound') || w.hasTag(e, 'important')) continue
    const k = stackKey(e)
    const row = by.get(k)
    if (row) row.count++
    else {
      const item = itemInfo(eng, e.id)
      if (item) by.set(k, { ...item, count: 1, warmth: s.giftWarmth(to, e), ...(s.isFavourite(to, e) && { favourite: true }) })
    }
  }
  // the warmest first, then the dearest
  const items = [...by.values()].sort((a, b) => b.warmth - a.warmth || (b.value ?? 0) - (a.value ?? 0))
  return {
    who: to.id,
    name: to.name ?? w.onto.resolve(to.type).name ?? to.id,
    affection: s.regard(to, p.id),
    told,
    ...(told && fav && def && { favourite: { type: fav, name: def.name ?? fav, sprite: def.sprite ?? '' } }),
    ...(w.hasStatus({ e: to.id }, 'cheered') && { cheered: true }),
    items: told ? items : items.map(({ favourite: _f, ...rest }) => ({ ...rest, warmth: rest.warmth === 4 ? 3 : rest.warmth })),
  }
}

/**
 * Things alike at one price and ownership warning as one row, with how many (a bag of two thousand stones is one row, not two thousand: the
 * panel's view goes to the page every tick). The first of them is the one bought or sold.
 */
function rows(eng: Engine, things: Entity[], price: (e: Entity) => number): TradeView['offers'] {
  const by = new Map<string, TradeView['offers'][number]>()
  for (const e of things) {
    const p = price(e)
    const steal = eng.society.isAnothers(e, eng.world.player)
    const k = `${stackKey(e)}|${p}|${steal}`
    const row = by.get(k)
    if (row) row.count = (row.count ?? 1) + 1
    else {
      const item = itemInfo(eng, e.id)
      if (item) by.set(k, { item, price: p, count: 1 })
    }
  }
  return [...by.values()]
}
