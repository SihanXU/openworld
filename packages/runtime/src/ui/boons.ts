import { mountWindow } from './components/index.ts'
// The companion's boons (the boons module; a woken waypoint statue opens it, `panel: boons`): the powers the companion
// has taken up, the one it carries, and the choice of another — only beside a woken statue (modules/src/boons). The
// runtime's own panel, shown for a game that uses the module and has no panel of its own for it (ClientGame.panels,
// ui/panels.ts); as many slots as the game has boons, the ones not yet found shown as sealed.

import type { Frame } from '@openworld/engine'
import { game } from '../game.ts'
import { esc, locale, t, tx } from './common.ts'
import type { GamePanel, PanelContext } from './panels.ts'

class BoonPanel implements GamePanel {
  private sig = ''

  constructor(private ctx: PanelContext) {}

  show(f: Frame | undefined): void | false {
    // nothing to choose from until the companion has a power
    if (!f?.player.boons?.unlocked.length) return false
    this.sig = ''
    this.render(f)
  }

  render(f: Frame): void {
    const b = f.player.boons
    const sig = `${locale.value}|${b?.unlocked.join()}|${b?.active}|${b?.atWaypoint}`
    if (sig === this.sig) return
    this.sig = sig
    const unlocked = b?.unlocked ?? []
    const slots = Math.max(unlocked.length, Object.keys(game().boons).length)
    const cards = Array.from({ length: slots }, (_, i) => {
      const def = game().boons[unlocked[i]]
      if (!def) return `<div class="pf-card sealed"><div class="pf-icon">🔒</div><div class="pf-body"><b>${t('boonSealed')}</b><div class="pf-doc">${t('boonSealedDoc')}</div></div></div>`
      const mine = def.id === b?.active
      const action = mine
        ? `<span class="pf-current">✓ ${t('boonCarried')}</span>`
        : `<button class="cv-btn primary small" data-boon="${esc(def.id)}" ${b?.atWaypoint ? '' : 'disabled'}>${t('boonCarry')}</button>`
      return `<div class="pf-card${mine ? ' mine' : ''}"><div class="pf-icon">✦</div>
        <div class="pf-body"><b>${esc(tx(def.name))}</b><div class="pf-doc">${esc(tx(def.doc))}</div></div>
        <div class="pf-act">${action}</div></div>`
    }).join('')
    const note = b?.atWaypoint ? t('boonOne') : t('boonAway')
    this.ctx.host.innerHTML = `<div class="sheet wood pf-sheet">
      <div class="tabs-row"><span class="sk-title">${t('boonTitle')}</span><button class="x" data-close>✕</button></div>
      <div class="tab-body"><div class="pf-note">${note}</div><div class="pf-cards">${cards}</div></div></div>`
    mountWindow(this.ctx.host.querySelector<HTMLElement>('.sheet')!, { onClose: () => this.ctx.close() })
    this.ctx.host.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.ctx.close()
    this.ctx.host.querySelectorAll<HTMLButtonElement>('[data-boon]').forEach((el) => (el.onclick = () => this.ctx.send.boon(el.dataset.boon!)))
  }
}

/** The runtime's boons panel (one factory, kept: the registry makes one panel of it). */
export const boonPanel = (ctx: PanelContext): GamePanel => new BoonPanel(ctx)
