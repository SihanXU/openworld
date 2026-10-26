// The people's panels (docs/npc-sandbox.md §2.10, §2.15): a merchant's trade — its goods at its prices, and what it
// would pay for what one carries —, a person's pockets open to a sneaking hand — what they carry, to take,
// and what one carries, to slip in —, and a gift for someone — what they like best, once they have said it, and
// what one carries to give, each with how warmly it would be taken. Each choice is an act the world answers (the
// worker's `trade`, `pocket` and `gift`); the panels show what the frame says now.

import { stackKey, type Frame, type ItemInfo } from '@openworld/engine'
import { $, esc, locale, tx } from './common.ts'
import { heartsOf } from './hearts.ts'

export interface PeopleSend {
  trade(item: string, buy: boolean): void
  closeTrade(): void
  pocket(item: string, take: boolean): void
  closePockets(): void
  gift(item: string): void
  closeGift(): void
}

const L = (en: string, zh: string) => (locale.value === 'zh' ? zh : en)

export class PeoplePanels {
  /** Paints item icons into [data-icon] slots (main.ts, from the textures). */
  paintIcons?: (items: ItemInfo[]) => void

  constructor(private send: PeopleSend) {
    const root = document.createElement('div')
    root.id = 'peoplePanels'
    root.innerHTML = `<div class="overlay hidden" id="tradePanel"><div class="sheet wood people-sheet" id="tradeSheet"></div></div><div class="overlay hidden" id="pocketsPanel"><div class="sheet wood people-sheet" id="pocketsSheet"></div></div><div class="overlay hidden" id="giftPanel"><div class="sheet wood people-sheet gift-sheet" id="giftSheet"></div></div>`
    document.body.appendChild(root)
  }

  get open(): boolean {
    return !$('#tradePanel').classList.contains('hidden') || !$('#pocketsPanel').classList.contains('hidden') || !$('#giftPanel').classList.contains('hidden')
  }

  /** Esc: the open panel closes. */
  close(): void {
    if (!$('#tradePanel').classList.contains('hidden')) this.send.closeTrade()
    if (!$('#pocketsPanel').classList.contains('hidden')) this.send.closePockets()
    if (!$('#giftPanel').classList.contains('hidden')) this.send.closeGift()
  }

  private tradeSig = ''
  private pocketsSig = ''
  private giftSig = ''

  onFrame(f: Frame): void {
    this.renderTrade(f)
    this.renderPockets(f)
    this.renderGift(f)
  }

  /**
   * The gift panel (docs/npc-sandbox.md §2.15): their regard as hearts, a card for what they like best — named once
   * they have let it slip in a chat, else a riddle —, and what one carries to give, the warmest first, each with how
   * warmly it would be taken (hearts; a star for the thing they like best).
   */
  private renderGift(f: Frame): void {
    const g = f.gift
    const sig = g ? `${locale.value}|${JSON.stringify(g)}` : ''
    if (sig === this.giftSig) return
    this.giftSig = sig
    $('#giftPanel').classList.toggle('hidden', !g)
    if (!g) return
    const zh = locale.value === 'zh'
    const name = esc(tx(g.name))
    const hearts = `<span class="hearts" title="${zh ? '好感' : 'Regard'} ${Math.round(g.affection)}/100">${heartsOf(g.affection).map((h) => `<i class="${h}"></i>`).join('')}</span>`
    const warmth = (n: number, fav?: boolean) => (fav ? `<span class="gf-warmth fav" title="${L('The thing they like best', '他最喜欢的东西')}">★</span>` : `<span class="gf-warmth w${n}" title="${[L('A trifle', '小意思'), L('A kindness', '一份心意'), L('A treasure', '厚礼')][n - 1] ?? ''}">${'♥'.repeat(Math.max(1, Math.min(3, n)))}</span>`)
    const fav = g.favourite
    const secret = fav
      ? `<div class="gf-secret known"><div class="icon gf-favicon" data-icon="fav:${esc(fav.type)}"></div><div><div class="gf-secret-title">${L(`${name} likes best`, `${name}最喜欢`)}</div><div class="gf-secret-name">★ ${esc(tx(fav.name))}</div><div class="gf-secret-note">${g.cheered ? L('Already delighted today — tomorrow it will mean as much again.', '今天已经送过了——明天再送，一样欢喜。') : L('Give it, and watch their face.', '送出去，看他的表情。')}</div></div></div>`
      : `<div class="gf-secret"><div class="gf-riddle">?</div><div><div class="gf-secret-title">${L(`What ${name} likes best`, `${name}最喜欢什么`)}</div><div class="gf-secret-name muted">${L('Unknown yet', '还不知道')}</div><div class="gf-secret-note">${L('Chat with them a while — people let these things slip.', '多和他聊聊天——人总会说漏嘴的。')}</div></div></div>`
    const cards = g.items.length
      ? g.items
          .map(
            (it) => `<div class="gf-card${it.favourite ? ' fav' : ''}"><div class="icon" data-icon="${esc(it.id)}"></div><div class="gf-name">${esc(tx(it.name))}${it.count > 1 ? ` <span class="gf-count">×${it.count}</span>` : ''}${it.steal ? ` <span class="pp-steal">${L('not yours', '非你所有')}</span>` : ''}</div>${warmth(it.warmth, it.favourite)}<button data-gift="${esc(it.id)}">${L('Give', '送出')}</button></div>`,
          )
          .join('')
      : `<div class="muted gf-empty">${L('You carry nothing you could give.', '你身上没有能送的东西。')}</div>`
    $('#giftSheet').innerHTML = `
      <div class="pp-head"><b>${L(`A gift for ${name}`, `送礼物给${name}`)}</b>${hearts}<button class="x" id="giftX">✕</button></div>
      ${secret}
      <div class="pp-title">${L('What you carry', '你身上的东西')}</div>
      <div class="gf-grid">${cards}</div>
      <div class="gf-foot muted">${L('The dearer the gift, the warmer the thanks. The thing they like best delights them once a day.', '礼物越贵重，他越高兴。送他最喜欢的东西，好感大涨，每天一次。')}</div>`
    $('#giftX').onclick = () => this.send.closeGift()
    $('#giftSheet').querySelectorAll<HTMLButtonElement>('[data-gift]').forEach((b) => (b.onclick = () => this.send.gift(b.dataset.gift!)))
    // (the favourite's picture: a thing of its kind, drawn by its type's sprite)
    this.paintIcons?.([...g.items, ...(fav ? [{ id: `fav:${fav.type}`, type: fav.type, sprite: fav.sprite, name: fav.name, tags: [], statuses: [], props: {} } satisfies ItemInfo] : [])])
  }

  /** One row: a thing (and how many alike), what it costs or is, and what one can do with it. `stolen`: say it is not one's own. */
  private row(item: ItemInfo, right: string, action: string, cls = '', count = 1, stolen = false): string {
    return `<div class="pp-row ${cls}"><div class="icon" data-icon="${item.id}"></div><span class="pp-name">${esc(tx(item.name))}${count > 1 ? ` ×${count}` : ''}${stolen && item.steal ? ` <span class="pp-steal">${L('not yours', '非你所有')}</span>` : ''}</span>${right}${action}</div>`
  }

  /** One row per stack identity and price: pieces stay separate, materials keep their counted rows. */
  private stacks<T extends { item: ItemInfo; price?: number; count?: number }>(list: T[]): { first: T; count: number }[] {
    const by = new Map<string, { first: T; count: number }>()
    for (const x of list) {
      const k = JSON.stringify([stackKey(x.item), x.price ?? null, !!x.item.steal])
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
