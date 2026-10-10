// The people's panels (docs/npc-sandbox.md): a talk, a trade, a person's pockets, as the client draws them.

import { itemInfo, type Engine, type Frame, type Id } from '@openworld/engine'
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
      goods: s.stock(m).map((e) => ({ item: itemInfo(eng, e.id)!, price: s.priceToBuy(e, m, p) })),
      offers: carried.filter((e) => s.buys(m, e, p)).map((e) => ({ item: itemInfo(eng, e.id)!, price: s.priceToSell(e, p, m) })),
      purse: s.purse(p),
      theirs: s.purse(m),
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
