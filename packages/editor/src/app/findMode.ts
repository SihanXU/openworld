// Find (docs/engine-split.md §16 E2, RPG Maker's event searcher): the story's facts, each with where it is set and
// where it is read; and any id — a type and the kinds under it, a person, a thing, a map, a quest, a step, a rule —
// with every place of the project that names it, each a link to where it is edited.

import type { PersonFile } from '@openworld/format'
import type { QuestDef } from '@openworld/engine'
import type { Ctx, Mode } from './context.ts'
import { factUses, modeOf, usesOf, type Use } from './usage.ts'
import { namesOf } from './triggers.ts'
import { phrase } from './lang.ts'
import { esc, t, tx } from './ui.ts'

export class FindMode implements Mode {
  id = 'find'
  label = phrase('Find')
  private query = ''

  private files(ctx: Ctx): { file: string; data: unknown }[] {
    const s = ctx.store
    return [s.game && { file: 'game.json', data: s.game }, ...(['ontology', 'rules', 'maps', 'people', 'quests', 'story', 'client', 'learned'] as const).flatMap((f) => s.list(f))].filter(Boolean) as { file: string; data: unknown }[]
  }

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const facts = [...factUses(this.files(ctx)).keys()].sort()
    const n = namesOf(ctx)
    const pick = (label: string, ids: [string, string][]) => `<details ${ids.length <= 12 ? 'open' : ''}><summary>${esc(label)} <small class="muted">${ids.length}</small></summary><div class="palette list">${ids.map(([id, name]) => `<button data-q="${esc(id)}" class="${id === this.query || `fact:${id}` === this.query ? 'on' : ''}">${esc(name)}<small>${esc(name === id ? '' : id)}</small></button>`).join('')}</div></details>`
    left.innerHTML = `<h3>${t('Find')}</h3><input id="fdQuery" placeholder="${esc(t('an id, a type, fact:<key>'))}" value="${esc(this.query)}">
      ${pick(t('The story\'s facts'), facts.map((f) => [`fact:${f}`, f]))}
      ${pick(t('People'), ctx.store.list<PersonFile>('people').map((p) => [p.data.id, tx(p.data.name) || p.data.id]))}
      ${pick(t('Quests'), ctx.store.list<QuestDef>('quests').map((q) => [q.data.id, tx(q.data.title) || q.data.id]))}
      ${pick(t('Steps'), n.steps.map((s) => [s, s]))}
      ${pick(t('Maps'), n.maps.map((m) => [m, m]))}`
    const q = left.querySelector<HTMLInputElement>('#fdQuery')!
    q.onchange = () => ((this.query = q.value.trim()), ctx.refresh())
    left.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => (b.onclick = () => ((this.query = b.dataset.q!), ctx.refresh())))
    right.innerHTML = `<h3>${t('Find')}</h3><p class="muted">${t('Where a fact is set and read; where an id is named — a value or a key in any file of the project (a type: the kinds under it too). Each place opens where it is edited.')}</p>`
  }

  main(ctx: Ctx, el: HTMLElement): void {
    const q = this.query
    if (!q) return void (el.innerHTML = `<p class="muted">${t('Choose a fact, a person, a quest, a step or a map on the left, or type an id.')}</p>`)
    const files = this.files(ctx)
    let uses: Use[]
    let what: string
    if (q.startsWith('fact:')) {
      uses = factUses(files).get(q.slice(5)) ?? []
      what = t('the fact {key}', { key: `<code>${esc(q.slice(5))}</code>` })
    } else {
      const type = !!ctx.onto().types[q]
      uses = usesOf(files, q, type)
      what = type ? t('the kind {id} and the kinds under it', { id: `<code>${esc(q)}</code>` }) : `<code>${esc(q)}</code>`
    }
    const groups = (['set', 'read', 'names'] as const).map((how) => [how, uses.filter((u) => u.how === how)] as const).filter(([, us]) => us.length)
    const label = { set: t('Set'), read: t('Read'), names: t('Named') }
    el.innerHTML = `<h3>${uses.length === 1 ? t('1 place names {what}', { what }) : t('{n} places name {what}', { n: uses.length, what })}</h3>
      ${groups.map(([how, us]) => `<div class="box"><h3>${label[how]} (${us.length})</h3><ul class="things">${us.map((u, i) => `<li><a data-use="${how}:${i}">${esc(u.file)}</a> <small class="muted">${esc(u.at ? `${u.at} · ` : '')}${esc(u.path)}</small></li>`).join('')}</ul></div>`).join('') || `<p class="muted">${t('Nowhere in the project.')}</p>`}`
    el.querySelectorAll<HTMLElement>('[data-use]').forEach((a) => {
      const [how, i] = a.dataset.use!.split(':')
      const u = groups.find(([h]) => h === how)![1][Number(i)]
      a.onclick = () => ctx.open(modeOf(u.file), u.file, u.at)
    })
  }

  focus(_ctx: Ctx, _file: string, at?: string): void {
    if (at) this.query = at
  }
}
