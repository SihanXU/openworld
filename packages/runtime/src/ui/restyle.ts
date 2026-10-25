// The dresser's panel (docs/looks.md §5): the character creator over the traveller's own look, opened by a rule's
// `panel: 'restyle'` (the dresser asked, a hand on her mirror). It says her price (the world's `params.restyle`: coin
// and things carried) and whether one has it; kept, the look goes to the worker, which takes the price and makes the
// look one's own. The look edited is one's own, not what is seen: what is worn goes over it as before.

import type { Frame, Look } from '@openworld/engine'
import { game, ontology } from '../game.ts'
import { Creator } from './creator.ts'
import { esc, locale, tx } from './common.ts'
import type { GamePanel, PanelContext, PanelFactory } from './panels.ts'

class RestylePanel implements GamePanel {
  private creator?: Creator
  private look?: Look
  private sig = ''

  constructor(private ctx: PanelContext) {}

  /** Her price: the coin and the things, each with its name. */
  private price(): { type: string; count: number }[] {
    const p = ontology().params?.restyle
    return [...(p?.coin ? [{ type: game().items.coin, count: p.coin }] : []), ...(p?.needs ?? [])]
  }

  show(f: Frame | undefined): void | false {
    const own = f?.player.look
    if (!f || !own || typeof own !== 'object') return false
    const zh = locale.value === 'zh'
    this.creator?.dispose()
    this.look = structuredClone(own)
    this.sig = ''
    this.ctx.host.innerHTML = `<div class="sheet paper rs-sheet">
      <div class="rs-head"><b>${zh ? '改换样子' : 'A new look'}</b><span class="rs-price" id="rsPrice"></span><button class="x" id="rsClose">✕</button></div>
      <div id="rsCreator"></div>
      <div class="rs-foot"><span class="rs-note">${zh ? '穿戴的装备照旧盖在上面。' : 'What you wear still goes over it.'}</span><button class="cv-btn" id="rsCancel">${zh ? '算了' : 'Never mind'}</button><button class="cv-btn primary" id="rsKeep">${zh ? '就这样' : 'Keep this look'}</button></div>
    </div>`
    this.creator = new Creator(this.ctx.host.querySelector('#rsCreator')!, this.look, (look) => (this.look = look))
    const close = () => {
      this.creator?.dispose()
      this.creator = undefined
      this.ctx.close()
    }
    this.ctx.host.querySelector<HTMLButtonElement>('#rsClose')!.onclick = close
    this.ctx.host.querySelector<HTMLButtonElement>('#rsCancel')!.onclick = close
    this.ctx.host.querySelector<HTMLButtonElement>('#rsKeep')!.onclick = () => {
      if (this.look) this.ctx.send.restyle(this.look)
      close()
    }
    this.render(f)
  }

  render(f: Frame): void {
    const zh = locale.value === 'zh'
    const have = (type: string) => f.player.inventory.filter((s) => s.type === type).reduce((n, s) => n + s.count, 0)
    const price = this.price()
    const sig = `${locale.value}|${price.map((n) => `${n.type}:${have(n.type)}`).join(',')}`
    if (sig === this.sig) return
    this.sig = sig
    const parts = price.map((n) => {
      const got = have(n.type)
      return `<span class="${got >= n.count ? 'ok' : 'short'}">${n.count} ${esc(tx(ontology().types[n.type]?.name) || n.type)}${got >= n.count ? '' : ` (${zh ? '有' : 'have'} ${got})`}</span>`
    })
    const el = this.ctx.host.querySelector('#rsPrice')
    if (el) el.innerHTML = price.length ? `${zh ? '价钱：' : 'Price: '}${parts.join(' · ')}` : zh ? '不收钱' : 'No charge'
    const keep = this.ctx.host.querySelector<HTMLButtonElement>('#rsKeep')
    if (keep) keep.disabled = price.some((n) => have(n.type) < n.count)
  }
}

export const restylePanel: PanelFactory = (ctx) => new RestylePanel(ctx)
