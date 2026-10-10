// The trainer's panel (talking to a profession trainer opens it): the four professions, what
// each is about and the weapon it starts with; the current one; the level it takes. Changing
// profession gives back every point of the profession branch (engine/src/profession.ts), so
// the panel says so and asks first.

import type { Frame } from '@openworld/engine'
import { PROFESSION_LEVEL } from '@openworld/engine'
import { game } from '../game.ts'
import { $, esc, t, tx } from './common.ts'
import { skillArt } from './skillIcons.ts'

export class ProfessionPanel {
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
    const level = Math.max(1, Number(f.player.props.level ?? 1))
    const current = typeof f.player.props.profession === 'string' ? f.player.props.profession : ''
    // the points a change would give back: the current profession's learned skills
    const spent = game().skills.all.filter((s) => s.profession && f.player.skills.includes(s.id)).reduce((n, s) => n + (s.cost ?? 1), 0)
    const sig = `${level}|${current}|${spent}|${t('profTitle')}`
    if (sig === this.sig) return
    this.sig = sig
    const ready = level >= PROFESSION_LEVEL
    const cards = game().skills.professions.map((p) => {
      const mine = p.id === current
      const nodes = game().skills.all.filter((s) => s.profession === p.id)
      const action = mine
        ? `<span class="pf-current">✓ ${t('profCurrent')}</span>`
        : `<button class="cv-btn primary small" data-prof="${p.id}" ${ready ? '' : 'disabled'}>${current ? t('profSwitch') : t('profChoose')}</button>`
      return `<div class="pf-card${mine ? ' mine' : ''}">
        <div class="pf-icon">${skillArt(p.icon)}</div>
        <div class="pf-body"><b>${esc(tx(p.name))}</b><div class="pf-doc">${esc(tx(p.doc))}</div>
          <div class="pf-meta">${t('profKit')}: ${esc(tx(p.weapon?.name))} · ${nodes.length} ${t('profNodes')}</div></div>
        <div class="pf-act">${action}</div>
      </div>`
    }).join('')
    this.host.innerHTML = `<div class="sheet wood pf-sheet">
      <div class="tabs-row"><span class="sk-title">${t('profTitle')}</span><button class="x" id="pfClose">✕</button></div>
      <div class="tab-body">
        <div class="pf-note">${ready ? (current ? t('profSwitchNote').replace('{n}', String(spent)) : t('profReady')) : t('profLevel').replace('{n}', String(PROFESSION_LEVEL)).replace('{l}', String(level))}</div>
        <div class="pf-cards">${cards}</div>
      </div></div>`
    $('#pfClose').onclick = () => this.close()
    this.host.querySelectorAll<HTMLButtonElement>('[data-prof]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.prof!
        if (current && !confirm(t('profConfirm').replace('{n}', String(spent)))) return
        this.choose(id)
      }
    })
  }
}
