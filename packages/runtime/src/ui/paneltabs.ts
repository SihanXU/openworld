// Tab's tabs (2026-10-20, design.md §5.3): over whichever panel is open — the bag, crafting, the skill tree and
// the skill panel (the classes module's), the quests, the codex, the world map — a row of tabs, each with the key
// that opens it, to go to another panel without that key (Tab opens the bag; the panels stay each its own).
// Over a panel that is a whole picture (the world map: `floats`) they float instead of taking room at its top: faint
// while the pointer is away, gone after a little while untouched, back as the pointer comes near the top edge.

import type { Action } from '../keymap.ts'
import { esc, kbd } from './common.ts'

export type Panel = 'bag' | 'craft' | 'skills' | 'skillPanel' | 'quests' | 'journal' | 'map'

/** How long floating tabs stay, untouched, before they fade out (ms); how near the top edge brings them back (px). */
const FLOAT_LINGER = 2500
const FLOAT_ZONE = 56

export class PanelTabs {
  private el = document.createElement('div')
  private shown = ''
  private measure: ResizeObserver
  /** Floating over the open panel (it is a whole picture), and the pointer or the focus holding them there. */
  private floating = false
  private held = false
  private sleep?: number

  constructor(
    /** The tabs this game has, in order: each its name and the action whose key opens it. */
    private tabs: () => { id: Panel; name: string; action: Action }[],
    /** The panel open now, if one of these. */
    private current: () => Panel | undefined,
    /** Go to that panel. */
    private go: (p: Panel) => void,
    /** Does this panel take the whole screen, the tabs floating over it (the world map)? */
    private floats: (p: Panel) => boolean = () => false,
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
    // floating: the pointer near the top edge (or on them) and the keyboard's focus in them keep them; away, they go
    window.addEventListener('pointermove', (e) => {
      if (!this.floating) return
      const near = e.clientY <= Math.max(FLOAT_ZONE, this.el.getBoundingClientRect().bottom + 16)
      if (near !== this.held) this.hold(near)
    })
    document.documentElement.addEventListener('pointerleave', () => this.floating && this.hold(false))
    this.el.addEventListener('focusin', () => this.floating && this.hold(true))
    this.el.addEventListener('focusout', () => this.floating && this.hold(false))
  }

  /** Floating: held (shown until let go), or let go (they fade out a little while after). */
  private hold(on: boolean): void {
    this.held = on
    this.wake()
  }

  /** Floating: shown now, and out of sight once untouched for a while. */
  private wake(): void {
    clearTimeout(this.sleep)
    this.el.classList.remove('pt-gone')
    if (!this.held) this.sleep = window.setTimeout(() => this.floating && !this.held && this.el.classList.add('pt-gone'), FLOAT_LINGER)
  }

  /** Shown over an open panel, the open one marked (each animation frame: redrawn only when it changes). */
  sync(): void {
    const now = this.current()
    const tabs = now ? this.tabs() : []
    const sig = now ? `${now}|${tabs.map((t) => `${t.id}:${t.name}:${kbd(t.action)}`).join(',')}` : ''
    if (sig === this.shown) return
    this.shown = sig
    this.el.classList.toggle('hidden', !now)
    const floating = !!now && this.floats(now)
    if (floating !== this.floating) (this.floating = floating), (this.held = false)
    this.el.classList.toggle('pt-float', floating)
    if (floating) this.wake()
    else (clearTimeout(this.sleep), this.el.classList.remove('pt-gone'))
    // (what is open under them leaves their room at the top: game.css `.with-tabs`; a whole picture keeps it)
    document.body.classList.toggle('with-tabs', !!now && !floating)
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
