// The skill panel (U, or its button bottom right): every active skill one has now — learned in the skill tree,
// read from a skill book, or lent by a piece one wears — each with where it comes from, and the skill bar's six
// slots above them. A skill goes in a slot by dragging its card there, or by picking it (a click) and then the
// slot; a slot is emptied with a right click. What a piece lends leaves with the piece: still in a slot, it shows
// as not had (engine actives.ts knownActives).

import type { Frame, KnownActive } from '@openworld/engine'
import { SKILL_BY_ID } from '@openworld-game/content'
import { $, esc, locale, tx } from './common.ts'
import { skillPng } from './skillIcons.ts'
import { SKILLBAR_KEYS } from './skillbar.ts'

export class SkillPanel {
  private sig = ''
  /** A skill picked by a click, waiting for the slot it goes in. */
  private picked?: string

  constructor(
    private host: HTMLElement,
    private set: (slot: number, id: string | null) => void,
    private close: () => void,
  ) {}

  get open(): boolean {
    return !this.host.classList.contains('hidden')
  }

  show(f?: Frame): void {
    this.host.classList.remove('hidden')
    this.sig = ''
    this.picked = undefined
    if (f) this.render(f)
  }

  render(f: Frame): void {
    const zh = locale.value === 'zh'
    const bar = f.player.skillbar ?? []
    const known = f.player.actives ?? []
    const sig = JSON.stringify([bar.map((s) => s && [s.id, s.usable]), known, this.picked, locale.value])
    if (sig === this.sig) return
    this.sig = sig
    const source = (k: KnownActive) => {
      if (k.source === 'gear') {
        const item = f.player.inventory.find((i) => i.id === k.item)
        return `<span class="sp-src gear">${zh ? '装备' : 'Gear'}${item ? `：${esc(tx(item.name))}` : ''}</span>`
      }
      return k.source === 'book' ? `<span class="sp-src book">${zh ? '技能书' : 'Skill book'}</span>` : `<span class="sp-src tree">${zh ? '天赋树' : 'Skill tree'}</span>`
    }
    const slots = SKILLBAR_KEYS.map((k, i) => {
      const s = bar[i]
      const def = s ? SKILL_BY_ID[s.id] : undefined
      return `<div class="sp-slot${def ? '' : ' empty'}${s && !s.usable ? ' lost' : ''}${this.picked ? ' target' : ''}" data-slot="${i}" title="${def ? esc(tx(def.name)) : ''}">${def ? `<img src="${skillPng(def.icon ?? def.id)}" alt="" draggable="false">` : ''}<kbd>⇧${k}</kbd></div>`
    }).join('')
    const cards = known.map((k) => {
      const def = SKILL_BY_ID[k.id]
      if (!def) return ''
      const at = bar.findIndex((s) => s?.id === k.id)
      return `<div class="sp-card${this.picked === k.id ? ' picked' : ''}" data-skill="${k.id}" draggable="true">
        <img class="sp-icon" src="${skillPng(def.icon ?? def.id)}" alt="" draggable="false">
        <div class="sp-text"><div class="sp-head"><b>${esc(tx(def.name))}</b>${source(k)}${at >= 0 ? `<span class="sp-in">⇧${SKILLBAR_KEYS[at]}</span>` : ''}</div>
        <div class="sp-doc">${esc(tx(def.doc))}</div></div></div>`
    }).join('')
    const hint = zh ? '把技能拖到上面的格子里，或先点技能再点格子；右键格子清空。技能来自天赋树、技能书，或身上的装备（脱下装备，技能也会失去）。' : 'Drag a skill to a slot above, or click it and then a slot; right click a slot to empty it. Skills come from the skill tree, skill books, or what you wear (taken off, its skill goes with it).'
    this.host.innerHTML = `<div class="sheet wood sp-sheet">
      <div class="tabs-row"><span class="sk-title">${zh ? '技能管理' : 'Skills'}</span><button class="x" id="spClose">✕</button></div>
      <div class="tab-body">
        <div class="sp-bar">${slots}</div>
        <div class="sp-hint">${hint}</div>
        <div class="sp-list">${cards || `<div class="ql-none">${zh ? '还没有主动技能。在技能树（K）里学习、阅读技能书，或穿上带技能的装备。' : 'No active skills yet: learn them in the skill tree (K), read a skill book, or wear a piece that lends one.'}</div>`}</div>
      </div></div>`
    $('#spClose').onclick = () => this.close()
    this.host.querySelectorAll<HTMLElement>('.sp-card').forEach((c) => {
      c.onclick = () => ((this.picked = this.picked === c.dataset.skill ? undefined : c.dataset.skill), (this.sig = ''), this.render(f))
      c.ondragstart = (e) => e.dataTransfer?.setData('text/skill', c.dataset.skill!)
    })
    this.host.querySelectorAll<HTMLElement>('.sp-slot').forEach((el) => {
      const i = Number(el.dataset.slot)
      el.onclick = () => {
        if (!this.picked) return
        this.set(i, this.picked)
        this.picked = undefined
      }
      el.oncontextmenu = (e) => (e.preventDefault(), this.set(i, null))
      el.ondragover = (e) => e.preventDefault()
      el.ondrop = (e) => {
        e.preventDefault()
        const id = e.dataTransfer?.getData('text/skill')
        if (id) this.set(i, id)
      }
    })
  }
}
