import { icon, mountWindow, type IconName } from './components/index.ts'
// The journal (L, or its button bottom right; docs/quests.md §2.5): three tabs — under way, done, failed. Each
// quest shows its kind (the main line, a side quest, a favour, a companion's guide) and who gave it, what it is about, its objectives (open with their counts, done ticked,
// failed struck through, where they are when elsewhere) and its log, the lines of the stages reached, in order;
// one is tracked (the tracker, the markers, a companion's guidance). The commission board (docs/quests.md §3) opens here too:
// the favours on offer, to take on.

import type { Frame, JournalQuest, QuestOffer } from '@openworld/engine'
import { $, esc, locale, t, tx } from './common.ts'

type Tab = 'active' | 'done' | 'failed'
const KIND_TAG: Record<string, string> = { main: 'q_main', side: 'q_side', favor: 'q_favor', guide: 'q_guide' }
const mountIcons = (root: HTMLElement): void => root.querySelectorAll<HTMLElement>('[data-quest-icon]').forEach((node) => node.replaceChildren(icon(node.dataset.questIcon as IconName)))

export class QuestLog {
  private sig = ''
  private tab: Tab = 'active'
  /** The board being read (its id), or none: the journal. */
  private boardOf?: string
  /** The quest whose log is open (its id): the latest of a tab otherwise. */
  private openId?: string

  constructor(
    private host: HTMLElement,
    private close: () => void,
    private send: { track(id: string | undefined): void; board(who: string, ref: string): void },
  ) {}

  get open(): boolean {
    return !this.host.classList.contains('hidden')
  }

  show(f?: Frame, board?: string): void {
    this.host.classList.remove('hidden')
    this.boardOf = board
    this.sig = ''
    if (f) this.render(f)
  }

  render(f: Frame): void {
    const q = f.quests
    const sig = JSON.stringify([q?.journal, q?.board, q?.tracked, this.tab, this.openId, this.boardOf, t('qTitle')])
    if (sig === this.sig) return
    this.sig = sig
    if (this.boardOf) return this.renderBoard(q?.board ?? [], this.boardOf)
    const all = q?.journal ?? []
    const state = (x: JournalQuest) => (x.state === 'active' ? 'active' : x.state)
    const list = all.filter((x) => state(x) === this.tab)
    const pick = list.find((x) => x.id === this.openId) ?? list.find((x) => x.tracked) ?? list[0]
    const tabs = (['active', 'done', 'failed'] as const)
      .map((k) => `<button type="button" class="ql-tab${k === this.tab ? ' on' : ''}" data-qt="${k}" aria-pressed="${k === this.tab}"><span>${t(`qTab_${k}`)}</span><small class="ql-count">${all.filter((x) => state(x) === k).length}</small></button>`)
      .join('')
    const row = (x: JournalQuest) =>
      `<button type="button" class="ql-row ${x.kind}${x === pick ? ' on' : ''}" data-q="${esc(x.id)}" aria-pressed="${x === pick}"><span class="ql-row-meta"><span class="ql-tag ${x.kind}">${t(KIND_TAG[x.kind] ?? 'q_side')}</span>${x.tracked ? `<span class="ql-row-tracked" aria-label="${t('qTracked')}" data-quest-icon="check"></span>` : ''}</span><span class="ql-row-title">${esc(tx(x.title))}</span></button>`
    const empty = `<div class="ql-empty">${t(this.tab === 'active' ? (all.length ? 'qIdle' : 'qEmpty') : 'qNone')}</div>`
    this.host.innerHTML = `<div class="sheet wood ql-sheet">
      <div class="tabs-row"><span class="sk-title">${t('qTitle')}</span><button class="x" id="qlClose">✕</button></div>
      <div class="ql-tabs">${tabs}</div>
      <div class="ql-body">
        <div class="ql-list" aria-label="${t('qTitle')}">${list.length ? list.map(row).join('') : empty}</div>
        <div class="ql-detail">${pick ? this.detail(pick) : ''}</div>
      </div></div>`
    mountWindow(this.host.querySelector<HTMLElement>('.sheet')!, { size: 'lg', view: this.boardOf ?? this.tab, onClose: () => this.close() })
    mountIcons(this.host)
    $('#qlClose').onclick = () => this.close()
    this.host.querySelectorAll<HTMLButtonElement>('[data-qt]').forEach((b) => (b.onclick = () => ((this.tab = b.dataset.qt as Tab), (this.openId = undefined), this.render(f))))
    this.host.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((b) => (b.onclick = () => ((this.openId = b.dataset.q), this.render(f))))
    this.host.querySelector<HTMLButtonElement>('[data-track]')?.addEventListener('click', (e) => this.send.track((e.currentTarget as HTMLElement).dataset.track || undefined))
  }

  /** One quest: what it is about, its objectives, its log; and, under way, whether it is the one followed. */
  private detail(x: JournalQuest): string {
    const goal = (o: JournalQuest['objectives'][number]) => {
      const meta = [
        o.need ? `<span class="ql-progress">${o.have} / ${o.need}</span>` : '',
        o.optional ? `<span class="ql-optional">${t('qOptional')}</span>` : '',
        o.where && o.state === 'open' ? `<span class="ql-where"><span data-quest-icon="map" aria-hidden="true"></span><span>${esc(tx(o.where))}</span></span>` : '',
      ].filter(Boolean).join('')
      return `<li class="ql-goal ${o.state}"><span class="ql-goal-mark" aria-hidden="true"${o.state === 'open' ? '' : ` data-quest-icon="${o.state === 'done' ? 'check' : 'close'}"`}></span><div class="ql-goal-copy"><p class="ql-goal-text">${esc(tx(o.text))}</p>${meta ? `<div class="ql-goal-meta">${meta}</div>` : ''}</div></li>`
    }
    const open = x.objectives.filter((o) => o.state === 'open')
    const shut = x.objectives.filter((o) => o.state !== 'open')
    const track = x.state === 'active' ? `<button type="button" class="ql-track${x.tracked ? ' on' : ''}" aria-pressed="${x.tracked}" data-track="${x.tracked ? '' : esc(x.id)}"><span data-quest-icon="${x.tracked ? 'check' : 'plus'}" aria-hidden="true"></span>${t(x.tracked ? 'qTracked' : 'qTrack')}</button>` : ''
    const state = x.state === 'done' ? `<span class="ql-state done">${t('qDone')}</span>` : x.state === 'failed' ? `<span class="ql-state failed">${t('qFailed')}</span>` : ''
    return `<div class="ql-quest ${x.kind}">
      <div class="ql-head"><h2 class="ql-title">${esc(tx(x.title))}</h2>${state}${track}</div>
      ${x.giver ? `<div class="ql-from">${t('qFrom')}${locale.value === 'zh' ? '：' : ': '}${esc(tx(x.giver))}</div>` : ''}
      <p class="ql-sum">${esc(tx(x.summary))}</p>
      ${x.objectives.length ? `<section class="ql-section"><h3 class="ql-section-title">${t('qObjectives')}</h3><ul class="ql-goals">${[...open, ...shut].map(goal).join('')}</ul></section>` : ''}
      ${x.log.length ? `<section class="ql-section"><h3 class="ql-section-title">${t('qLog')}</h3><ol class="ql-log">${x.log.map((l) => `<li>${esc(tx(l.text))}</li>`).join('')}</ol></section>` : ''}
    </div>`
  }

  /** The commission board: every favour on offer, who wants it done, and a button to take it on. */
  private renderBoard(offers: QuestOffer[], board: string): void {
    const card = (o: QuestOffer) => `<div class="ql-quest favor"><div class="ql-head"><h2 class="ql-title">${esc(tx(o.title))}</h2><button type="button" class="ql-take" data-take="${esc(o.ref)}">${t('qTake')}</button></div><p class="ql-sum">${esc(tx(o.summary))}</p></div>`
    this.host.innerHTML = `<div class="sheet wood ql-sheet">
      <div class="tabs-row"><span class="sk-title">${t('qBoard')}</span><button class="x" id="qlClose">✕</button></div>
      <div class="ql-board">${offers.length ? offers.map(card).join('') : `<div class="ql-empty">${t('qBoardEmpty')}</div>`}</div></div>`
    mountWindow(this.host.querySelector<HTMLElement>('.sheet')!, { size: 'lg', view: this.boardOf ?? this.tab, onClose: () => this.close() })
    $('#qlClose').onclick = () => this.close()
    this.host.querySelectorAll<HTMLButtonElement>('[data-take]').forEach((b) => (b.onclick = () => this.send.board(board, b.dataset.take!)))
  }
}
