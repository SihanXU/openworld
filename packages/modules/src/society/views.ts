// The people's panels (docs/npc-sandbox.md): a talk, a trade, a person's pockets, as the client draws them.

import { itemInfo, stackKey, type Engine, type Entity, type Frame, type GiftView, type Id, type TradeView } from '@openworld/engine'
import { socialOf } from './state.ts'

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
