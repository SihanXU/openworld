import { $, t } from './common.ts'
import type { FishingView } from '@openworld/engine'

/** Non-pausing overlay for the worker-owned fishing state. It never sends gameplay or pause actions. */
export class FishingHud {
  private readonly root: HTMLElement
  private readonly title: HTMLElement
  private readonly hint: HTMLElement
  private readonly bobber: HTMLElement
  private readonly track: HTMLElement
  private readonly fish: HTMLElement
  private readonly zone: HTMLElement
  private readonly progressWrap: HTMLElement
  private readonly progress: HTMLElement
  private readonly progressLabel: HTMLElement
  private readonly time: HTMLElement
  private readonly bait: HTMLElement
  private view?: FishingView

  constructor() {
    this.root = document.createElement('section')
    this.root.className = 'fishing-hud'
    this.root.setAttribute('role', 'status')
    this.root.setAttribute('aria-live', 'polite')
    this.root.hidden = true
    this.root.innerHTML = `
      <div class="fishing-hud__heading"><strong data-title></strong><span data-time></span></div>
      <div class="fishing-hud__hint" data-hint></div>
      <div class="fishing-hud__bobber" data-bobber aria-hidden="true"><i></i><b></b></div>
      <div class="fishing-hud__track" data-track aria-label="Fishing control zone">
        <i class="fishing-hud__zone" data-zone></i><b class="fishing-hud__fish" data-fish></b>
      </div>
      <div class="fishing-hud__progress-wrap" data-progress-wrap>
        <div class="fishing-hud__progress"><i data-progress></i></div>
        <span data-progress-label></span>
      </div>
      <div class="fishing-hud__footer"><span data-bait></span><span data-cancel></span></div>`
    $('#hud').append(this.root)
    this.title = $('[data-title]', this.root)
    this.hint = $('[data-hint]', this.root)
    this.bobber = $('[data-bobber]', this.root)
    this.track = $('[data-track]', this.root)
    this.fish = $('[data-fish]', this.root)
    this.zone = $('[data-zone]', this.root)
    this.progressWrap = $('[data-progress-wrap]', this.root)
    this.progress = $('[data-progress]', this.root)
    this.progressLabel = $('[data-progress-label]', this.root)
    this.time = $('[data-time]', this.root)
    this.bait = $('[data-bait]', this.root)
    this.relabel()
  }

  render(view?: FishingView): void {
    this.view = view
    this.root.hidden = !view
    if (!view) return
    const fight = view.phase === 'fight'
    this.title.textContent = t(view.phase === 'waiting' ? 'fishingWaitingTitle' : view.phase === 'bite' ? 'fishingBiteTitle' : 'fishingFightTitle')
    this.hint.textContent = t(view.phase === 'waiting' ? 'fishingWaitingHint' : view.phase === 'bite' ? 'fishingBiteHint' : 'fishingFightHint')
    this.bobber.hidden = fight
    this.track.hidden = !fight
    this.progressWrap.hidden = !fight
    this.time.hidden = fight && view.remaining <= 0
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
      this.progressLabel.textContent = `${Math.round(progress * 100)}%`
      this.track.setAttribute('aria-label', `${t('fishingProgress')}: ${Math.round(progress * 100)}%`)
    }
  }

  relabel(): void {
    const phase = this.view?.phase
    this.title.textContent = t(phase === 'bite' ? 'fishingBiteTitle' : phase === 'fight' ? 'fishingFightTitle' : 'fishingWaitingTitle')
    this.hint.textContent = t(phase === 'bite' ? 'fishingBiteHint' : phase === 'fight' ? 'fishingFightHint' : 'fishingWaitingHint')
    this.bait.textContent = t('fishingBait').replace('{n}', String(this.view?.bait ?? 0))
    this.time.textContent = t('fishingTime').replace('{n}', String(Math.max(0, Math.ceil(this.view?.remaining ?? 0))))
    this.time.hidden = this.view?.phase === 'fight' && (this.view?.remaining ?? 0) <= 0
    this.progressLabel.textContent = t('fishingProgress')
    $('[data-cancel]', this.root).textContent = t('fishingCancel')
  }
}
