// The people's panels (docs/npc-sandbox.md §2.10): a merchant's trade — its goods at its prices, and what it
// would pay for what one carries — and a person's pockets open to a sneaking hand — what they carry, to take,
// and what one carries, to slip in. Each choice is an act the world answers (the worker's `trade` and
// `pocket`); the panels show what the frame says now.

import type { Frame, ItemInfo } from '@openworld/engine'
import { $, esc, locale, tx } from './common.ts'

export interface PeopleSend {
  trade(item: string, buy: boolean): void
  closeTrade(): void
  pocket(item: string, take: boolean): void
  closePockets(): void
}

const L = (en: string, zh: string) => (locale.value === 'zh' ? zh : en)

export class PeoplePanels {
  /** Paints item icons into [data-icon] slots (main.ts, from the textures). */
  paintIcons?: (items: ItemInfo[]) => void

  constructor(private send: PeopleSend) {
    const root = document.createElement('div')
    root.id = 'peoplePanels'
    root.innerHTML = `<div class="overlay hidden" id="tradePanel"><div class="sheet wood people-sheet" id="tradeSheet"></div></div><div class="overlay hidden" id="pocketsPanel"><div class="sheet wood people-sheet" id="pocketsSheet"></div></div>`
    document.body.appendChild(root)
  }

  get open(): boolean {
    return !$('#tradePanel').classList.contains('hidden') || !$('#pocketsPanel').classList.contains('hidden')
  }

  /** Esc: the open panel closes. */
  close(): void {
    if (!$('#tradePanel').classList.contains('hidden')) this.send.closeTrade()
    if (!$('#pocketsPanel').classList.contains('hidden')) this.send.closePockets()
  }

  private tradeSig = ''
  private pocketsSig = ''

  onFrame(f: Frame): void {
    this.renderTrade(f)
    this.renderPockets(f)
  }

  /** One row: a thing (and how many alike), what it costs or is, and what one can do with it. `stolen`: say it is not one's own. */
  private row(item: ItemInfo, right: string, action: string, cls = '', count = 1, stolen = false): string {
    return `<div class="pp-row ${cls}"><div class="icon" data-icon="${item.id}"></div><span class="pp-name">${esc(tx(item.name))}${count > 1 ? ` ×${count}` : ''}${stolen && item.steal ? ` <span class="pp-steal">${L('not yours', '非你所有')}</span>` : ''}</span>${right}${action}</div>`
  }

  /** Things alike (one kind, one name, one price) as one row: the first of them is the one bought or sold. */
  private stacks<T extends { item: ItemInfo; price?: number; count?: number }>(list: T[]): { first: T; count: number }[] {
    const by = new Map<string, { first: T; count: number }>()
    for (const x of list) {
      const k = `${x.item.type}|${JSON.stringify(x.item.name)}|${x.price ?? ''}|${x.item.steal ? 1 : 0}`
      const s = by.get(k)
      // (a row may stand for several already: the trade's view counts things alike)
      if (s) s.count += x.count ?? 1
      else by.set(k, { first: x, count: x.count ?? 1 })
    }
    return [...by.values()]
  }

  private renderTrade(f: Frame): void {
    const t = f.trade
    const sig = t ? `${locale.value}|${JSON.stringify(t)}` : ''
    if (sig === this.tradeSig) return
    this.tradeSig = sig
    $('#tradePanel').classList.toggle('hidden', !t)
    if (!t) return
    const coin = (n: number) => `<span class="pp-price">${n} ⊕</span>`
    const goods = t.goods.length
      ? this.stacks(t.goods).map(({ first: g, count }) => this.row(g.item, coin(g.price), `<button data-buy="${g.item.id}"${g.price > t.purse ? ' disabled' : ''}>${L('Buy', '买')}</button>`, '', count)).join('')
      : `<div class="muted">${L('Nothing left to sell today.', '今天没东西可卖了。')}</div>`
    const offers = t.offers.length
      ? this.stacks(t.offers).map(({ first: o, count }) => this.row(o.item, coin(o.price), `<button data-sell="${o.item.id}"${o.price > t.theirs ? ' disabled' : ''}>${L('Sell', '卖')}</button>`, '', count, true)).join('')
      : `<div class="muted">${L('Nothing you carry interests them.', '你身上没有他们想要的东西。')}</div>`
    $('#tradeSheet').innerHTML = `
      <div class="pp-head"><b>${esc(tx(t.name))}</b>${t.discount ? `<span class="pp-deal${t.discount < 0 ? ' worse' : ''}" title="${L('What their regard for you does to their prices', '他们对你的好感让价格变了多少')}">${t.discount > 0 ? `♥ ${L('Friend’s price', '好感优惠')} −${Math.round(t.discount * 100)}%` : `${L('Cold price', '冷淡加价')} +${Math.round(-t.discount * 100)}%`}</span>` : ''}<span class="pp-purse">${L('You', '你')} ${coin(t.purse)} · ${esc(tx(t.name))} ${coin(t.theirs)}</span><button class="x" id="tradeX">✕</button></div>
      <div class="pp-cols">
        <div><div class="pp-title">${L('Their goods', '他们的货')}</div>${goods}</div>
        <div><div class="pp-title">${L('What they would pay', '他们愿意收的')}</div>${offers}</div>
      </div>`
    $('#tradeX').onclick = () => this.send.closeTrade()
    $('#tradeSheet').querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => (b.onclick = () => this.send.trade(b.dataset.buy!, true)))
    $('#tradeSheet').querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((b) => (b.onclick = () => this.send.trade(b.dataset.sell!, false)))
    this.paintIcons?.([...t.goods.map((g) => g.item), ...t.offers.map((o) => o.item)])
  }

  private renderPockets(f: Frame): void {
    const p = f.pockets
    const mine = f.player.inventory.filter((i) => !i.tags.includes('important') && !i.tags.includes('bound'))
    const sig = p ? `${locale.value}|${JSON.stringify(p)}|${mine.map((i) => `${i.id}×${i.count}`).join(',')}` : ''
    if (sig === this.pocketsSig) return
    this.pocketsSig = sig
    $('#pocketsPanel').classList.toggle('hidden', !p)
    if (!p) return
    const theirs = p.contents.length
      ? this.stacks(p.contents.map((item) => ({ item }))).map(({ first: { item: i }, count }) => this.row(i, (i as { worn?: boolean }).worn ? `<span class="pp-worn">${L('worn', '穿着')}</span>` : '', `<button data-take="${i.id}">${L('Take', '拿')}</button>`, (i as { worn?: boolean }).worn ? 'worn' : '', count)).join('')
      : `<div class="muted">${L('Empty pockets.', '口袋空空。')}</div>`
    // (the bag comes as stacks already: one row each, the first of it the one slipped in)
    const yours = mine.length ? mine.map((i) => this.row(i, '', `<button data-plant="${i.id}">${L('Slip in', '塞进去')}</button>`, '', i.count, true)).join('') : `<div class="muted">${L('You carry nothing to slip in.', '你没有可以塞的东西。')}</div>`
    $('#pocketsSheet').innerHTML = `
      <div class="pp-head"><b>${L(`${tx(p.name)}'s pockets`, `${tx(p.name)}的口袋`)}</b><span class="muted">${L('Every hand in a pocket may be felt — and seen.', '每次伸手都可能被察觉——也可能被看见。')}</span><button class="x" id="pocketsX">✕</button></div>
      <div class="pp-cols">
        <div><div class="pp-title">${L('What they carry', '他们身上的')}</div>${theirs}</div>
        <div><div class="pp-title">${L('What you carry', '你身上的')}</div>${yours}</div>
      </div>`
    $('#pocketsX').onclick = () => this.send.closePockets()
    $('#pocketsSheet').querySelectorAll<HTMLButtonElement>('[data-take]').forEach((b) => (b.onclick = () => this.send.pocket(b.dataset.take!, true)))
    $('#pocketsSheet').querySelectorAll<HTMLButtonElement>('[data-plant]').forEach((b) => (b.onclick = () => this.send.pocket(b.dataset.plant!, false)))
    this.paintIcons?.([...p.contents, ...mine])
  }
}
