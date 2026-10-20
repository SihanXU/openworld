import { $, t, tx } from './common.ts'
import type { FishingView, ItemInfo } from '@openworld/engine'

/** Worker-owned fishing state; presses use the existing input path, while this UI changes no simulation or rewards. */
export class FishingHud {
  private readonly root: HTMLElement
  private readonly paper: HTMLElement
  private readonly title: HTMLElement
  private readonly hint: HTMLElement
  private readonly bobber: HTMLElement
  private readonly track: HTMLElement
  private readonly fish: HTMLElement
  private readonly fishIcon: HTMLElement
  private readonly fishName: HTMLElement
  private readonly catchInfo: HTMLElement
  private readonly zone: HTMLElement
  private readonly progressWrap: HTMLElement
  private readonly progress: HTMLElement
  private readonly progressLabel: HTMLElement
  private readonly progressValue: HTMLElement
  private readonly time: HTMLElement
  private readonly bait: HTMLElement
  private view?: FishingView
  private lastFishKey?: string

  /** The game supplies its normal pixel-art item painter; this view contains no game IDs or assets. */
  paintIcon?: (item: ItemInfo) => void

  /** A left press on the scrollable paper is routed through the game's authoritative input path. */
  onPress?: () => void

  constructor() {
    this.root = document.createElement('section')
    this.root.className = 'fishing-hud wood'
    this.root.setAttribute('role', 'status')
    this.root.setAttribute('aria-live', 'polite')
    this.root.hidden = true
    this.root.innerHTML = `
      <div class="fishing-hud__paper">
        <header class="fishing-hud__heading"><strong data-title></strong><span class="fishing-hud__time" data-time></span></header>
        <div class="fishing-hud__hint" data-hint></div>
        <div class="fishing-hud__layout">
          <div class="fishing-hud__water" data-water aria-label="Fishing water">
            <div class="fishing-hud__track" data-track aria-label="Fishing control zone">
              <i class="fishing-hud__zone" data-zone></i>
              <span class="fishing-hud__fish" data-fish><span class="fishing-hud__fish-icon" data-fish-icon></span></span>
            </div>
            <div class="fishing-hud__bobber" data-bobber aria-hidden="true"><i></i><b></b></div>
          </div>
          <aside class="fishing-hud__readout">
            <div class="fishing-hud__catch" data-catch hidden>
              <span class="fishing-hud__catch-label" data-catch-label></span>
              <span class="fishing-hud__fish-name" data-fish-name></span>
            </div>
            <div class="fishing-hud__progress-wrap" data-progress-wrap>
              <div class="fishing-hud__progress-heading"><span data-progress-label></span><b data-progress-value></b></div>
              <div class="fishing-hud__progress"><i data-progress></i></div>
            </div>
            <span class="fishing-hud__bait" data-bait></span>
          </aside>
        </div>
        <footer class="fishing-hud__footer"><span data-cancel></span></footer>
      </div>`
    $('#hud').append(this.root)
    this.paper = $('.fishing-hud__paper', this.root)
    this.paper.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return
      this.onPress?.()
    })
    this.paper.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true })
    this.title = $('[data-title]', this.root)
    this.hint = $('[data-hint]', this.root)
    this.bobber = $('[data-bobber]', this.root)
    this.track = $('[data-track]', this.root)
    this.fish = $('[data-fish]', this.root)
    this.fishIcon = $('[data-fish-icon]', this.root)
    this.fishName = $('[data-fish-name]', this.root)
    this.catchInfo = $('[data-catch]', this.root)
    this.zone = $('[data-zone]', this.root)
    this.progressWrap = $('[data-progress-wrap]', this.root)
    this.progress = $('[data-progress]', this.root)
    this.progressLabel = $('[data-progress-label]', this.root)
    this.progressValue = $('[data-progress-value]', this.root)
    this.time = $('[data-time]', this.root)
    this.bait = $('[data-bait]', this.root)
    this.relabel()
  }

  render(view?: FishingView): void {
    this.view = view
    this.root.hidden = !view
    if (!view) {
      this.clearFish()
      return
    }
    const fight = view.phase === 'fight'
    this.root.dataset.phase = view.phase
    this.title.textContent = t(view.phase === 'waiting' ? 'fishingWaitingTitle' : view.phase === 'bite' ? 'fishingBiteTitle' : 'fishingFightTitle')
    this.hint.textContent = t(view.phase === 'waiting' ? 'fishingWaitingHint' : view.phase === 'bite' ? 'fishingBiteHint' : 'fishingFightHint')
    this.bobber.hidden = fight
    this.track.hidden = !fight
    this.progressWrap.hidden = !fight
    this.time.hidden = fight
    this.bait.textContent = t('fishingBait').replace('{n}', String(view.bait))
    this.time.textContent = t('fishingTime').replace('{n}', String(Math.max(0, Math.ceil(view.remaining))))
    if (fight) {
      const fish = Math.min(1, Math.max(0, view.fish))
      const bar = Math.min(1, Math.max(0, view.bar))
      const size = Math.min(1, Math.max(0, view.barSize))
      const progress = Math.min(1, Math.max(0, view.progress))
      this.fish.style.top = `${(1 - fish) * 100}%`
      this.zone.style.top = `${(1 - bar) * 100}%`
      this.zone.style.height = `${size * 100}%`
      this.progress.style.width = `${progress * 100}%`
      this.progressValue.textContent = `${Math.round(progress * 100)}%`
      this.track.setAttribute('aria-label', `${t('fishingProgress')}: ${Math.round(progress * 100)}%`)
      this.setFishItem(view.fishItem)
    } else {
      this.clearFish()
    }
  }

  relabel(): void {
    const phase = this.view?.phase
    this.title.textContent = t(phase === 'bite' ? 'fishingBiteTitle' : phase === 'fight' ? 'fishingFightTitle' : 'fishingWaitingTitle')
    this.hint.textContent = t(phase === 'bite' ? 'fishingBiteHint' : phase === 'fight' ? 'fishingFightHint' : 'fishingWaitingHint')
    this.bait.textContent = t('fishingBait').replace('{n}', String(this.view?.bait ?? 0))
    this.time.textContent = t('fishingTime').replace('{n}', String(Math.max(0, Math.ceil(this.view?.remaining ?? 0))))
    this.time.hidden = this.view?.phase === 'fight'
    this.progressLabel.textContent = t('fishingProgress')
    $('[data-catch-label]', this.root).textContent = t('fishingCatch')
    $('[data-cancel]', this.root).textContent = t('fishingCancel')
    this.fishName.textContent = this.view?.phase === 'fight' && this.view.fishItem ? tx(this.view.fishItem.name) : ''
  }

  private setFishItem(item?: ItemInfo): void {
    if (!item) {
      this.clearFish()
      return
    }
    this.fishName.textContent = tx(item.name)
    this.catchInfo.hidden = false
    const key = `${item.type}|${item.sprite}`
    if (key === this.lastFishKey) return
    this.fishIcon.dataset.icon = item.id
    this.paintIcon?.(item)
    if (this.paintIcon) this.lastFishKey = key
  }

  private clearFish(): void {
    this.fishIcon.replaceChildren()
    this.fishIcon.removeAttribute('data-icon')
    this.fishName.textContent = ''
    this.catchInfo.hidden = true
    this.lastFishKey = undefined
  }
}
