// The people's panels (docs/npc-sandbox.md): a talk, a trade, a person's pockets, as the client draws them.

import { itemInfo, stackKey, type Engine, type Entity, type Frame, type Id, type TradeView } from '@openworld/engine'
import { socialOf } from './state.ts'

/** The views of the people's panels the host has open (docs/npc-sandbox.md): a talk, a trade, a person's pockets. */
export function peopleViews(eng: Engine, open: { talk?: { who: Id; arrest?: boolean }; trade?: Id; pockets?: Id }): Pick<Frame, 'talk' | 'trade' | 'pockets'> {
  const w = eng.world
  const p = w.player
  const s = socialOf(eng)
  const out: Pick<Frame, 'talk' | 'trade' | 'pockets'> = {}
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
  return out
}

/**
 * Things alike at one price as one row, with how many (a bag of two thousand stones is one row, not two thousand: the
 * panel's view goes to the page every tick). The first of them is the one bought or sold.
 */
function rows(eng: Engine, things: Entity[], price: (e: Entity) => number): TradeView['offers'] {
  const by = new Map<string, TradeView['offers'][number]>()
  for (const e of things) {
    const p = price(e)
    const k = `${stackKey(e)}|${p}`
    const row = by.get(k)
    if (row) row.count = (row.count ?? 1) + 1
    else {
      const item = itemInfo(eng, e.id)
      if (item) by.set(k, { item, price: p, count: 1 })
    }
  }
  return [...by.values()]
}
