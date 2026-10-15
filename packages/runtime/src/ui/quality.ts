// The options' AI section (design.md §13, the AI setting): the AI setting as a game's graphics settings are laid out — a
// preset, a level for each kind of work, and the detection of what the connected model carries (the
// service plays its questions at every tier and recommends). The setting is the player's, kept in this
// browser like a graphics setting, never in a save.

import { AI_KEYS, AI_LEVELS, AI_WAIT_MS, PRESETS, presetOf, qualityOf, type AiCategory, type AiLevel, type AiQuality, type Tier } from '@openworld/engine'
import { esc, t } from './common.ts'

const STORE = 'lsw.ai'

/** The setting this browser keeps (the default where it keeps none, or cannot keep one). */
export function storedQuality(): AiQuality {
  try {
    return qualityOf(JSON.parse(localStorage.getItem(STORE) ?? 'null'))
  } catch {
    return qualityOf(undefined)
  }
}

function storeQuality(q: AiQuality): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(q))
  } catch {
    /* a blocked store: the setting lasts this page only */
  }
}

/** What the service says at GET /quality (the modder's detect.ts, in the part shown here). */
interface QualityReply {
  model: string | null
  waitMs: number
  detection: {
    model: string
    at: string
    table: Record<AiCategory, Record<Tier, { n: number; ok: number; p90: number; cost: number }>>
    recommend: Omit<AiQuality, 'prefetch'>
  } | null
  running: { done: number; total: number } | null
  error: string | null
  plan?: { probes: number; runs: number }
}

const LEVEL_KEY: Record<AiLevel, string> = { off: 'aiOff', low: 'aiLow', medium: 'aiMedium', high: 'aiHigh' }
const ROW_KEY: Record<keyof AiQuality, string> = { things: 'aiThings', people: 'aiPeople', world: 'aiWorld', create: 'aiCreate', prefetch: 'aiPrefetch' }
const CATEGORIES: AiCategory[] = ['things', 'people', 'world']
const POLL_MS = 2000

export class AiOptions {
  quality = storedQuality()
  /** The modder service, as the worker last found it. */
  service?: { url?: string; online: boolean; model?: string | null }
  private reply?: QualityReply
  private asking = false
  /** Why a detection did not start (the service's answer). */
  private note?: string
  private poll?: ReturnType<typeof setTimeout>

  constructor(
    /** The setting to the engine (the worker). */
    private apply: (q: AiQuality) => void,
    /** Draw the section again (the options tab, if it is open). */
    private redraw: () => void,
  ) {}

  set(q: AiQuality): void {
    this.quality = q
    storeQuality(q)
    this.apply(q)
    this.redraw()
  }

  html(): string {
    const q = this.quality
    const preset = presetOf(q)
    const seg = (on: AiLevel | undefined, attr: string) =>
      `<span class="ai-seg">${AI_LEVELS.map((l) => `<button ${attr}="${l}" class="${l === on ? 'on' : ''}">${t(LEVEL_KEY[l])}</button>`).join('')}</span>`
    const rows = AI_KEYS.map(
      (k) => `<div class="ai-row"><span class="ai-name">${t(ROW_KEY[k])}</span>${seg(q[k], `data-ai-${k}`)}<small class="muted">${t(`${ROW_KEY[k]}Tip`)}</small></div>`,
    ).join('')
    return `<h4>${t('aiSection')}</h4>
      <div class="ai-opts">
        <div class="ai-row"><span class="ai-name">${t('aiPreset')}</span>${seg(preset, 'data-ai-preset')}${preset ? '' : `<small class="ai-custom">${t('aiCustom')}</small>`}</div>
        ${rows}
        <p class="muted ai-note">${t('aiWait').replace('{s}', String(Math.round(AI_WAIT_MS / 1000)))}</p>
        <div class="ai-detect">${this.detectHtml()}</div>
      </div>`
  }

  private detectHtml(): string {
    const s = this.service
    if (!s?.url || !s.online) return `<span class="muted">${t('aiNoService')}</span>`
    if (!s.model) return `<span class="muted">${t('aiNoModel')}</span>`
    const r = this.reply
    const head = `<div>${t('aiModel')}: <b>${esc(s.model)}</b></div>`
    if (r?.running) return `${head}<div>${t('aiDetecting').replace('{n}', String(r.running.done)).replace('{m}', String(r.running.total))}</div>`
    const plan = r?.plan ? ` <small class="muted">${t('aiDetectPlan').replace('{n}', String(r.plan.probes)).replace('{m}', String(r.plan.runs))}</small>` : ''
    const button = `<button id="aiDetect" ${this.asking ? 'disabled' : ''}>${t('aiDetect')}</button>${plan}`
    const error = [this.note, r?.error].filter(Boolean).map((e) => `<div class="warn">${esc(e!)}</div>`).join('')
    const d = r?.detection
    if (!d) return `${head}${button}${error}`
    const stale = d.model !== s.model ? ` <small class="warn">${t('aiStale')}</small>` : ''
    const cell = (c: AiCategory, tier: Tier) => {
      const x = d.table[c]?.[tier]
      return x?.n ? `${t(LEVEL_KEY[tier])} ${x.ok}/${x.n} · ${(x.p90 / 1000).toFixed(1)}s` : `${t(LEVEL_KEY[tier])} —`
    }
    const table = CATEGORIES.map((c) => `<tr><td>${t(ROW_KEY[c])}</td><td>${(['low', 'medium', 'high'] as Tier[]).map((tier) => cell(c, tier)).join('</td><td>')}</td><td><b>${t(LEVEL_KEY[d.recommend[c]])}</b></td></tr>`).join('')
    const rec = d.recommend
    const same = (Object.keys(rec) as (keyof typeof rec)[]).every((k) => this.quality[k] === rec[k])
    return `${head}
      <div>${t('aiDetected').replace('{at}', new Date(d.at).toLocaleString())}${stale}</div>
      <table class="ai-table"><tr><th></th><th colspan="3">${t('aiInTime')}</th><th>${t('aiRecommend')}</th></tr>${table}</table>
      <div><button id="aiApply" ${same ? 'disabled' : ''}>${t('aiApply')}</button> ${button}</div>${error}`
  }

  wire(root: HTMLElement): void {
    for (const k of AI_KEYS)
      root.querySelectorAll<HTMLButtonElement>(`[data-ai-${k}]`).forEach((b) => (b.onclick = () => this.set({ ...this.quality, [k]: b.getAttribute(`data-ai-${k}`) as AiLevel })))
    root.querySelectorAll<HTMLButtonElement>('[data-ai-preset]').forEach((b) => (b.onclick = () => this.set({ ...PRESETS[b.dataset.aiPreset as AiLevel] })))
    root.querySelector<HTMLButtonElement>('#aiDetect')?.addEventListener('click', () => void this.detect())
    const rec = this.reply?.detection?.recommend
    root.querySelector<HTMLButtonElement>('#aiApply')?.addEventListener('click', () => rec && this.set({ ...this.quality, ...rec }))
  }

  /** Ask the service what it knows of its model (when the options open, and while a detection runs). */
  async refresh(plan = true): Promise<void> {
    const url = this.service?.online ? this.service.url : undefined
    if (!url) return
    try {
      this.reply = (await (await fetch(`${url}/quality${plan ? '?plan=1' : ''}`, { signal: AbortSignal.timeout(5000) })).json()) as QualityReply
    } catch {
      this.reply = undefined
    }
    this.redraw()
    clearTimeout(this.poll)
    if (this.reply?.running) this.poll = setTimeout(() => void this.refresh(false), POLL_MS)
  }

  private async detect(): Promise<void> {
    const url = this.service?.url
    if (!url || this.asking) return
    this.asking = true
    this.redraw()
    try {
      const r = (await (await fetch(`${url}/quality/detect`, { method: 'POST', signal: AbortSignal.timeout(5000) })).json()) as { started?: boolean; why?: string; error?: string }
      this.note = r.started ? undefined : (r.why ?? r.error)
    } catch (err) {
      this.note = (err as Error).message
    }
    this.asking = false
    await this.refresh(false)
  }

  /** The options closed: no more asking. */
  stop(): void {
    clearTimeout(this.poll)
  }
}
