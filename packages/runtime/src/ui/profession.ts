import { mountWindow, confirmDialog } from './components/index.ts'
// The trainer's panel (talking to a profession trainer opens it): the four professions, what
// each is about and the weapon it starts with; the current one; the level it takes. Changing
// profession gives back every point of the profession branch (engine/src/profession.ts), so
// the panel says so and asks first.

import type { Frame } from '@openworld/engine'
import { ADVANCE_LEVELS, ADVANCE_POINTS, PROFESSION_LEVEL, thirdOf } from '@openworld/modules'
import { game } from '../game.ts'
import { $, esc, t, tx } from './common.ts'
import { skillArt } from './skillIcons.ts'

export class ProfessionPanel {
  private sig = ''

  constructor(
    private host: HTMLElement,
    private choose: (id: string) => void,
    private close: () => void,
    private advance: (tier: number, path?: string) => void = () => {},
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
    const path = typeof f.player.props.path === 'string' ? f.player.props.path : ''
    const tier = current ? Math.max(1, Number(f.player.props.advancement ?? 1)) : 0
    // the points a change of path would give back: the path's learned skills
    const onPath = game().skills.all.filter((s) => s.path && f.player.skills.includes(s.id)).reduce((n, s) => n + (s.cost ?? 1), 0)
    const sig = `${level}|${current}|${spent}|${path}|${tier}|${onPath}|${t('profTitle')}`
    if (sig === this.sig) return
    this.sig = sig
    const ready = level >= PROFESSION_LEVEL
    const cards = game().skills.professions.map((p) => {
      const mine = p.id === current
      // (its first tree: the paths' and the mastery's are shown below, docs/advancement.md)
      const nodes = game().skills.all.filter((s) => s.profession === p.id && !s.path && !s.tier)
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
    // the advancements (docs/advancement.md): the profession's three paths at the second, its mastery at the third (under
    // the path's name for it: each path's card says what its third is called)
    const prof = game().skills.professions.find((p) => p.id === current)
    let advance = ''
    if (prof?.paths?.length) {
      const second = ADVANCE_LEVELS[2]
      const third = ADVANCE_LEVELS[3]
      const pathCards = prof.paths.map((p) => {
        const mine = p.id === path
        const nodes = game().skills.all.filter((s) => s.path === p.id)
        const action = mine
          ? `<span class="pf-current">✓ ${t('advCurrent')}</span>`
          : `<button class="cv-btn primary small" data-path="${p.id}" ${level >= second ? '' : 'disabled'}>${path ? t('advChange') : t('advChoose')}</button>`
        return `<div class="pf-card${mine ? ' mine' : ''}">
          <div class="pf-icon">${skillArt(p.icon ?? 'path')}</div>
          <div class="pf-body"><b>${esc(tx(p.name))}</b><div class="pf-doc">${esc(tx(p.doc))}</div>
            <div class="pf-meta">${nodes.length} ${t('profNodes')}${p.third ? ` · ${t('advThirdName')}: ${esc(tx(p.third.name))}` : ''}</div></div>
          <div class="pf-act">${action}</div>
        </div>`
      }).join('')
      // (no path yet, and the paths name their thirds: every name it may take)
      const title = thirdOf(prof, path)
      const names = !path && prof.paths.every((p) => p.third) ? prof.paths.map((p) => esc(tx(p.third!.name))).join(' / ') : esc(tx(title?.name))
      const mastery = title
        ? `<div class="pf-card${tier >= 3 ? ' mine' : ''}">
          <div class="pf-icon">${skillArt(title.icon ?? 'mastery')}</div>
          <div class="pf-body"><b>${names}</b><div class="pf-doc">${esc(tx(title.doc))}</div>
            <div class="pf-meta">${t('advLevel').replace('{n}', String(third))} · ${t('advPoints').replace('{n}', String(ADVANCE_POINTS))}</div></div>
          <div class="pf-act">${tier >= 3 ? `<span class="pf-current">✓ ${t('advDone')}</span>` : `<button class="cv-btn primary small" data-third="1" ${tier === 2 && level >= third ? '' : 'disabled'}>${t('advDo')}</button>`}</div>
        </div>`
        : ''
      advance = `<div class="pf-section"><span class="sk-title">${t('advTitle')}</span></div>
        <div class="pf-note">${t('advNote')}</div>
        <div class="pf-sub">${t('advSecond')} · ${t('advLevel').replace('{n}', String(second))} · ${t('advPoints').replace('{n}', String(ADVANCE_POINTS))}</div>
        <div class="pf-cards">${pathCards}</div>
        <div class="pf-sub">${t('advThird')}</div>
        <div class="pf-cards">${mastery}</div>`
    }
    this.host.innerHTML = `<div class="sheet wood pf-sheet">
      <div class="tabs-row"><span class="sk-title">${t('profTitle')}</span><button class="x" id="pfClose">✕</button></div>
      <div class="tab-body">
        <div class="pf-note">${ready ? (current ? t('profSwitchNote').replace('{n}', String(spent)) : t('profReady')) : t('profLevel').replace('{n}', String(PROFESSION_LEVEL)).replace('{l}', String(level))}</div>
        <div class="pf-cards">${cards}</div>
        ${advance}
      </div></div>`
    mountWindow(this.host.querySelector<HTMLElement>('.sheet')!, { onClose: () => this.close() })
    $('#pfClose').onclick = () => this.close()
    this.host.querySelectorAll<HTMLButtonElement>('[data-prof]').forEach((b) => {
      b.onclick = async () => {
        const id = b.dataset.prof!
        if (current && !await confirmDialog(t('profConfirm').replace('{n}', String(spent)))) return
        this.choose(id)
      }
    })
    this.host.querySelectorAll<HTMLButtonElement>('[data-path]').forEach((b) => {
      b.onclick = async () => {
        if (path && onPath && !await confirmDialog(t('advConfirm').replace('{n}', String(onPath)))) return
        this.advance(2, b.dataset.path!)
      }
    })
    this.host.querySelectorAll<HTMLButtonElement>('[data-third]').forEach((b) => (b.onclick = () => this.advance(3)))
  }
}
