// The tutorial's lessons as the player sees them (docs/prologue.md, the drills): what a lesson teaches
// is spotlit — the screen dims round it while the lesson locks the keys it does not teach — the key to
// press is drawn over it, a key the lesson does not let through shakes, and a lesson done shows a tick.
// The engine holds the locks for the world's inputs (moving, the five keys, the toolbar, making,
// setting down); the panels (the bag, crafting, the build palette, the map) are this view's to open,
// so it asks the lesson here and tells the story when one is opened (a lesson may wait on it).

import type { Frame, FxEvent, LessonInput, LessonView } from '@openworld/engine'
import { locale } from './common.ts'

/** How a key is named on screen. */
const KEY_TEXT: Record<string, { en: string; zh: string }> = {
  LMB: { en: 'Left click', zh: '左键' },
  RMB: { en: 'Right click', zh: '右键' },
  'hold E': { en: 'Hold E', zh: '长按 E' },
  'hold G': { en: 'Hold G', zh: '长按 G' },
}

export class LessonGuide {
  private dim = document.createElement('div')
  private glyph = document.createElement('div')
  private done = document.createElement('div')
  private frame?: Frame
  private lesson?: LessonView
  private cells = ''
  /** The lesson whose panel part was brought into view (once each: the player may scroll away). */
  private scrolled = ''

  constructor(
    private screen: {
      /** A thing's middle on the canvas. */
      of(id: string): { x: number; y: number } | undefined
      /** A cell's middle on the canvas. */
      ofTile(x: number, y: number): { x: number; y: number }
      /** Draw the lesson's outline on the ground (none: clear it). */
      cells(cells?: [number, number][]): void
    },
  ) {
    this.dim.className = 'lesson-dim hidden'
    this.glyph.className = 'lesson-key hidden'
    this.done.className = 'lesson-done hidden'
    this.done.textContent = '✓'
    document.body.append(this.dim, this.glyph, this.done)
    const loop = () => {
      this.draw()
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }

  onFrame(f: Frame): void {
    this.frame = f
    this.lesson = f.scene ? undefined : f.lesson
    const cells = JSON.stringify(this.lesson?.focus?.cells ?? null)
    if (cells !== this.cells) {
      this.cells = cells
      this.screen.cells(this.lesson?.focus?.cells)
    }
  }

  onFx(fx: FxEvent): void {
    if (fx.t !== 'lesson') return
    if (fx.blocked) this.shake()
    if (fx.done) {
      this.done.classList.remove('hidden', 'pop')
      void this.done.offsetWidth
      this.done.classList.add('pop')
      setTimeout(() => this.done.classList.add('hidden'), 900)
    }
  }

  /** May a panel be opened now? A lesson that locks the keys lets only what it teaches; a refusal shakes the key. */
  allows(input: LessonInput): boolean {
    const l = this.lesson
    if (!l?.allow || l.allow.includes(input)) return true
    this.shake()
    return false
  }

  /** Is a lesson at hand (Esc held skips it)? */
  get active(): boolean {
    return !!this.lesson
  }

  private shake(): void {
    this.glyph.classList.remove('shake')
    void this.glyph.offsetWidth
    this.glyph.classList.add('shake')
  }

  /** Where the focus is on the page: a panel's part if it is shown, else the thing, the cell, the outline, else the player. */
  private target(l: LessonView): { x: number; y: number; r: number } {
    const f = l.focus ?? {}
    const canvas = document.querySelector('#game canvas')?.getBoundingClientRect() ?? { left: 0, top: 0 }
    const onCanvas = (p: { x: number; y: number } | undefined, r: number) => p && { x: p.x + canvas.left, y: p.y + canvas.top, r }
    const shown = (el: Element | null | undefined): el is HTMLElement => !!el && (el as HTMLElement).offsetParent !== null
    const ofElement = (el: HTMLElement) => {
      const b = el.getBoundingClientRect()
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, r: Math.max(b.width, b.height) / 2 + 8 }
    }
    if (f.ui) {
      const [kind, ...rest] = f.ui.split(':')
      const id = rest.join(':')
      let el: Element | null | undefined
      if (kind === 'bag') el = document.getElementById('bagBtn')
      else if (kind === 'map') el = document.getElementById('minimap')
      else if (kind === 'build') el = document.querySelector(`#buildingMode:not(.hidden) [data-recipe="${CSS.escape(id)}"]`) ?? (f.cells ? undefined : document.getElementById('buildBtn'))
      else if (kind === 'craft') el = document.querySelector(`[data-craft="${CSS.escape(id)}"]`)?.closest('.recipe')
      else if (kind === 'slot') {
        const i = (this.frame?.player.slots ?? []).findIndex((s) => s?.item.type.startsWith(id))
        el = i >= 0 ? document.querySelector(`#toolbar [data-slot="${i}"]`) : undefined
      }
      if (shown(el)) {
        // in a list that scrolls (the crafting panel): brought into view once
        const k = `${l.id}|${f.ui}`
        if (this.scrolled !== k) (this.scrolled = k), el.scrollIntoView({ block: 'nearest' })
        return ofElement(el)
      }
    }
    const at =
      (f.id && onCanvas(this.screen.of(f.id), 28)) ||
      (f.tile && onCanvas(this.screen.ofTile(f.tile[0], f.tile[1]), 28)) ||
      (f.cells?.length && onCanvas(this.screen.ofTile(f.cells[0][0], f.cells[0][1]), 34)) ||
      (this.frame && onCanvas(this.screen.of(this.frame.player.id), 28))
    return at || { x: innerWidth / 2, y: innerHeight / 2, r: 30 }
  }

  private draw(): void {
    const l = this.lesson
    const hide = !l || document.getElementById('intro')?.classList.contains('hidden') === false
    this.glyph.classList.toggle('hidden', hide)
    this.dim.classList.toggle('hidden', hide || !l?.allow)
    if (hide || !l) return
    const t = this.target(l)
    const zh = locale.value === 'zh'
    const key = l.key ? (KEY_TEXT[l.key]?.[zh ? 'zh' : 'en'] ?? l.key) : ''
    const text = `<b>${key}</b><span>${l.index + 1}/${l.total}</span>`
    if (this.glyph.innerHTML !== text) this.glyph.innerHTML = text
    this.glyph.style.left = `${t.x}px`
    this.glyph.style.top = `${t.y - t.r - 8}px`
    if (l.allow) this.dim.style.background = `radial-gradient(circle at ${t.x}px ${t.y}px, transparent ${t.r}px, rgba(6, 8, 14, 0.62) ${t.r + 26}px)`
  }
}
