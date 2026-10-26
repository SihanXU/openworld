// Tab's tabs (2026-10-20, design.md §5.3): over whichever panel is open — the bag, crafting, the skill tree and
// the skill panel (the classes module's), the quests, the codex, the world map — a row of tabs, each with the key
// that opens it, to go to another panel without that key (Tab opens the bag; the panels stay each its own).

import type { Action } from '../keymap.ts'
import { esc, kbd } from './common.ts'

export type Panel = 'bag' | 'craft' | 'skills' | 'skillPanel' | 'quests' | 'journal' | 'map'

export class PanelTabs {
  private el = document.createElement('div')
  private shown = ''
  private measure: ResizeObserver

  constructor(
    /** The tabs this game has, in order: each its name and the action whose key opens it. */
    private tabs: () => { id: Panel; name: string; action: Action }[],
    /** The panel open now, if one of these. */
    private current: () => Panel | undefined,
    /** Go to that panel. */
    private go: (p: Panel) => void,
  ) {
    this.el.className = 'panel-tabs hidden'
    this.el.id = 'paneltabs'
    document.body.appendChild(this.el)
    this.measure = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--ui-measured-tabs', `${this.el.getBoundingClientRect().height + 8}px`)
    })
    this.measure.observe(this.el)
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-panel]')
      if (b) this.go(b.dataset.panel as Panel)
    })
  }

  /** Shown over an open panel, the open one marked (each animation frame: redrawn only when it changes). */
  sync(): void {
    const now = this.current()
    const tabs = now ? this.tabs() : []
    const sig = now ? `${now}|${tabs.map((t) => `${t.id}:${t.name}:${kbd(t.action)}`).join(',')}` : ''
    if (sig === this.shown) return
    this.shown = sig
    this.el.classList.toggle('hidden', !now)
    // (what is open under them leaves their room at the top: game.css `.with-tabs`)
    document.body.classList.toggle('with-tabs', !!now)
    if (!now) return
    this.el.setAttribute('role', 'tablist')
    this.el.setAttribute('aria-label', document.documentElement.lang.startsWith('zh') ? '游戏菜单' : 'Game menu')
    this.el.innerHTML = tabs.map((t) => `<button type="button" role="tab" aria-selected="${t.id === now}" class="pt-tab${t.id === now ? ' on' : ''}" data-panel="${t.id}">${esc(t.name)} <kbd>${esc(kbd(t.action))}</kbd></button>`).join('')
    this.el.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  /** Redrawn at once (the keys or the language changed). */
  relabel(): void {
    this.shown = ''
    this.sync()
  }
}
