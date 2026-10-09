// The quest log (L, or its button bottom right): the quests taken on, grouped main / side /
// repeat, each with what it is about and how far each goal is; "ready" when it can be handed in; then what is done.

import type { Frame, QuestView } from '@lsw/engine'
import { $, esc, t, tx } from './common.ts'

const KINDS = ['main', 'side', 'repeat'] as const

export class QuestLog {
  private sig = ''

  constructor(
    private host: HTMLElement,
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
    const log = f.quests?.log ?? []
    const done = f.quests?.done ?? []
    const sig = JSON.stringify(log) + JSON.stringify(done) + t('qTitle')
    if (sig === this.sig) return
    this.sig = sig
    const card = (q: QuestView) => `<div class="ql-quest ${q.kind}${q.status === 'ready' ? ' ready' : ''}">
      <div class="ql-head"><b>${esc(tx(q.title))}</b><span class="ql-state">${q.status === 'ready' ? `✓ ${t('qReady')}` : t('qActive')}</span></div>
      <div class="ql-sum">${esc(tx(q.summary))}</div>
      <ul class="ql-goals">${q.goals.map((g) => `<li class="${g.have >= g.need ? 'done' : ''}">${g.have >= g.need ? '✓' : '·'} ${esc(tx(g.label))}${g.need > 1 ? ` <span>${g.have}/${g.need}</span>` : ''}</li>`).join('')}</ul>
    </div>`
    const groups = KINDS.map((k) => {
      const qs = log.filter((q) => q.kind === k)
      return `<section class="ql-group ${k}"><h4><span class="ql-tag ${k}">${t(`q_${k}`)}</span></h4>${qs.length ? qs.map(card).join('') : `<div class="ql-none">${t('qNone')}</div>`}</section>`
    }).join('')
    // what is done stays in the log, by title, last (at the finale the log is not empty)
    const finished = done.length ? `<section class="ql-group done"><h4><span class="ql-tag done">${t('qDone')}</span></h4><ul class="ql-done">${done.map((q) => `<li class="${q.kind}">✓ ${esc(tx(q.title))}</li>`).join('')}</ul></section>` : ''
    this.host.innerHTML = `<div class="sheet wood ql-sheet">
      <div class="tabs-row"><span class="sk-title">${t('qTitle')}</span><button class="x" id="qlClose">✕</button></div>
      <div class="tab-body">${log.length ? '' : `<div class="ql-empty">${t(done.length ? 'qIdle' : 'qEmpty')}</div>`}${groups}${finished}</div></div>`
    $('#qlClose').onclick = () => this.close()
  }
}
