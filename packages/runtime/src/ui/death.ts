// The death screen (after Minecraft's): when the one at the keys falls, the world stops and says so —
// who felled them, and what may follow, by the game's difficulty:
// - easy: get up where one fell, keeping what one carried;
// - normal: rise again at home (the bed last slept in, the waypoint last woken), what one carried
//   left where one fell to go back for;
// - hardcore: one life — the world has ended; its slot is kept as it ended and cannot be played on.
// On easy and normal one may instead load a save (the slot is not saved while one lies fallen, so
// its save is from before the fall) or go back to the title.

import { mountWindow } from './components/index.ts'
import type { Frame } from '@openworld/engine'
import { esc, locale, tx } from './common.ts'

export interface DeathHandlers {
  /** Rise again: where one fell (easy), or at home (normal). */
  rise(home: boolean): void
  /** Load a save (the cover's load panel). */
  load(): void
  /** Back to the title. */
  title(): void
}

export class DeathScreen {
  private el: HTMLDivElement
  private shownFor?: string

  constructor(private on: DeathHandlers) {
    this.el = document.createElement('div')
    this.el.id = 'death'
    this.el.className = 'death hidden'
    document.getElementById('app')!.appendChild(this.el)
  }

  get open(): boolean {
    return !this.el.classList.contains('hidden')
  }

  /** Shown while the frame says the one at the keys has fallen; gone when they stand again. */
  onFrame(f: Frame): void {
    const fallen = f.fallen
    if (!fallen) {
      if (this.open) this.hide()
      return
    }
    const sig = `${fallen.difficulty}|${tx(fallen.by ?? '')}|${locale.value}`
    if (this.open && sig === this.shownFor) return
    this.shownFor = sig
    this.render(fallen)
    this.el.classList.remove('hidden')
  }

  hide(): void {
    this.el.classList.add('hidden')
    this.shownFor = undefined
  }

  private render(fallen: NonNullable<Frame['fallen']>): void {
    const zh = locale.value === 'zh'
    const by = fallen.by && tx(fallen.by)
    const cause = by ? (zh ? `被${by}打倒了` : `Felled by ${by}`) : zh ? '你倒下了' : 'You fell'
    const hard = fallen.difficulty === 'hardcore'
    const rise =
      fallen.difficulty === 'easy'
        ? `<button class="cv-btn primary" data-act="here">${zh ? '原地起身' : 'Get up'}<small>${zh ? '带着身上的东西' : 'with what you carry'}</small></button>`
        : fallen.difficulty === 'normal'
          ? `<button class="cv-btn primary" data-act="home">${zh ? '复活' : 'Respawn'}<small>${zh ? '在你的落脚处（床、唤醒的雕像）；身上的东西留在倒下的地方' : 'at home (a bed, a woken statue); what you carried stays where you fell'}</small></button>`
          : ''
    this.el.innerHTML = `
      <div class="death-box">
        <h1 class="death-title">${zh ? '你死了！' : 'You died!'}</h1>
        <div class="death-cause">${esc(cause)}</div>
        ${hard ? `<div class="death-note">${zh ? '极限模式只有一条命：这个世界到此结束了。' : 'Hardcore has one life: this world has ended.'}</div>` : ''}
        <div class="death-acts">
          ${rise}
          ${hard ? '' : `<button class="cv-btn" data-act="load">${zh ? '读档' : 'Load a save'}<small>${zh ? '回到倒下之前' : 'from before the fall'}</small></button>`}
          <button class="cv-btn" data-act="title">${zh ? '回到标题' : 'Title screen'}</button>
        </div>
      </div>`
    mountWindow(this.el.querySelector<HTMLElement>('.death-box')!, { title: zh ? '你倒下了' : 'You fell', dismissible: false })
    this.el.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => {
      b.onclick = () => {
        const act = b.dataset.act
        if (act === 'here') this.on.rise(false)
        else if (act === 'home') this.on.rise(true)
        else if (act === 'load') (this.hide(), this.on.load())
        else (this.hide(), this.on.title())
      }
    })
  }
}
