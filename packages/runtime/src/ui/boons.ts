// The companion's boons (touching a woken waypoint statue opens it): the powers the fairy has
// taken up, the one it carries, and the choice of another — only beside a woken statue
// (engine/src/boons.ts). Five slots, the ones not yet found shown as sealed.

import type { Frame } from '@lsw/engine'
import { BOON_BY_ID } from '@lsw/content'
import { $, esc, locale, tx } from './common.ts'

/** How many boons the journey holds (the slots shown). */
const SLOTS = 5

export class BoonPanel {
  private sig = ''

  constructor(
    private host: HTMLElement,
    private choose: (id: string) => void,
    private close: () => void,
  ) {}

  get open(): boolean {
    return !this.host.classList.contains('hidden')
  }

  show(f?: Frame): void {
    this.host.classList.remove('hidden')
    this.sig = ''
    if (f) this.render(f)
  }

  render(f: Frame): void {
    const b = f.player.boons
    const zh = locale.value === 'zh'
    const sig = `${locale.value}|${b?.unlocked.join()}|${b?.active}|${b?.atWaypoint}`
    if (sig === this.sig) return
    this.sig = sig
    const unlocked = b?.unlocked ?? []
    const cards = Array.from({ length: SLOTS }, (_, i) => {
      const def = BOON_BY_ID[unlocked[i]]
      if (!def) return `<div class="pf-card sealed"><div class="pf-icon">🔒</div><div class="pf-body"><b>${zh ? '尚未获得' : 'Not yet found'}</b><div class="pf-doc">${zh ? '击败持印者后，小啾会接住其圣印的一部分力量。' : 'Pip takes up part of a seal\'s power when its bearer falls.'}</div></div></div>`
      const mine = def.id === b?.active
      const action = mine
        ? `<span class="pf-current">✓ ${zh ? '携带中' : 'Carried'}</span>`
        : `<button class="cv-btn primary small" data-boon="${def.id}" ${b?.atWaypoint ? '' : 'disabled'}>${zh ? '携带' : 'Carry'}</button>`
      return `<div class="pf-card${mine ? ' mine' : ''}"><div class="pf-icon">✦</div>
        <div class="pf-body"><b>${esc(tx(def.name))}</b><div class="pf-doc">${esc(tx(def.doc))}</div></div>
        <div class="pf-act">${action}</div></div>`
    }).join('')
    const note = b?.atWaypoint
      ? zh ? '小啾一次只能携带一种力量。' : 'Pip carries one power at a time.'
      : zh ? '只有在唤醒过的传送雕像旁才能切换力量。' : 'A power can be changed only beside a woken waypoint statue.'
    this.host.innerHTML = `<div class="sheet wood pf-sheet">
      <div class="tabs-row"><span class="sk-title">${zh ? '小啾的力量' : "Pip's Powers"}</span><button class="x" id="boonClose">✕</button></div>
      <div class="tab-body"><div class="pf-note">${note}</div><div class="pf-cards">${cards}</div></div></div>`
    $('#boonClose').onclick = () => this.close()
    this.host.querySelectorAll<HTMLButtonElement>('[data-boon]').forEach((el) => (el.onclick = () => this.choose(el.dataset.boon!)))
  }
}
