// The options' "Your model" (docs/byok.md): the service, the model and the player's own key, for the modder that runs in
// the player's page (ownModel.ts). The key is typed here and sent once to the modder's worker; the section shows only
// its hint after. What a model has spent today stands under it, with the day's cap.

import { PROVIDERS, providerOf } from '@openworld/agent/src/providerList.ts'
import type { ModelChoice, ModelStatus, Remember } from '../modderProtocol.ts'
import type { OwnModel } from '../ownModel.ts'
import { esc, t } from './common.ts'

interface Draft {
  provider: string
  baseUrl: string
  model: string
  /** a key typed and not yet used (cleared once it is) */
  key: string
  remember: Remember
  cap: string
}

type Busy = 'test' | 'models' | undefined

export class ModelSection {
  private draft?: Draft
  private showKey = false
  private busy: Busy
  private models: string[] = []
  /** what the last test or list said */
  private said?: { ok: boolean; text: string }

  constructor(
    private own: OwnModel,
    /** Draw the options again. */
    private redraw: () => void,
    /** The address of a service the page names (?modder=): it answers instead of the player's own. */
    private named?: string,
  ) {}

  /** The form as the modder's state has it (until the player changes something). */
  private form(): Draft {
    if (this.draft) return this.draft
    const s = this.own.status
    const c = s?.choice
    return {
      provider: c?.provider ?? 'openrouter',
      baseUrl: c?.baseUrl ?? '',
      model: c?.model ?? providerOf(c?.provider ?? 'openrouter')?.model ?? '',
      key: '',
      remember: s?.remember ?? 'device',
      cap: String(s?.cap ?? 0),
    }
  }

  private choice(d: Draft): ModelChoice {
    return { provider: d.provider, model: d.model.trim(), ...(d.baseUrl.trim() && { baseUrl: d.baseUrl.trim() }) }
  }

  html(): string {
    const d = this.form()
    const s = this.own.status
    const p = providerOf(d.provider)
    // the kept key is shown only for the service it was kept for
    const keptHere = s?.keyHint && s.choice?.provider === d.provider && (s.choice.baseUrl ?? '') === d.baseUrl.trim()
    const options = PROVIDERS.map((x) => `<option value="${x.id}" ${x.id === d.provider ? 'selected' : ''}>${esc(x.id === 'custom' ? t('aiCustomProvider') : x.name)}</option>`).join('')
    const getKey = p?.keys ? ` <a href="${esc(p.keys)}" target="_blank" rel="noopener noreferrer">${t('aiGetKey')}</a>` : ''
    const list = this.models.length ? `<datalist id="aiOwnModels">${this.models.map((m) => `<option value="${esc(m)}"></option>`).join('')}</datalist>` : ''
    const keyField = p?.keyless
      ? `<small class="muted">${t('aiKeyless')}</small>`
      : `<span class="ai-own-field"><input data-own="key" type="${this.showKey ? 'text' : 'password'}" autocomplete="off" spellcheck="false" value="${esc(d.key)}" placeholder="${esc(keptHere ? t('aiKeyKept').replace('{hint}', s!.keyHint!) : t('aiKeyPlaceholder'))}"><button data-own-act="show">${t(this.showKey ? 'aiHide' : 'aiShow')}</button>${getKey}</span>`
    const radio = (r: Remember, label: string) => `<label><input type="radio" name="aiRemember" data-own-remember="${r}" ${d.remember === r ? 'checked' : ''}> ${t(label)}</label>`
    return `<h4>${t('aiOwnSection')}</h4>
      <div class="ai-opts ai-own">
        <p class="muted ai-note">${t('aiOwnIntro')}</p>
        ${this.named ? `<p class="warn ai-note">${t('aiNamedService').replace('{url}', esc(this.named))}</p>` : ''}
        <div class="ai-row"><span class="ai-name">${t('aiProvider')}</span><select data-own="provider">${options}</select>${p?.note === 'OLLAMA_ORIGINS' ? `<small class="muted">${t('aiOllama')}</small>` : ''}</div>
        <div class="ai-row"><span class="ai-name">${t('aiBaseUrl')}</span><input data-own="baseUrl" spellcheck="false" value="${esc(d.baseUrl)}" placeholder="${esc(p?.baseUrl ?? 'https://…/v1')}"></div>
        <div class="ai-row"><span class="ai-name">${t('aiModelName')}</span><span class="ai-own-field"><input data-own="model" spellcheck="false" list="aiOwnModels" value="${esc(d.model)}"><button data-own-act="models" ${this.busy ? 'disabled' : ''}>${t(this.busy === 'models' ? 'aiListing' : 'aiListModels')}</button></span>${list}</div>
        <div class="ai-row"><span class="ai-name">${t('aiKey')}</span>${keyField}</div>
        <div class="ai-row"><span class="ai-name">${t('aiRemember')}</span><span class="ai-own-field">${radio('device', 'aiRememberDevice')}${radio('session', 'aiRememberSession')}</span><small class="muted">${t('aiRememberTip')}</small></div>
        <div class="ai-row"><span class="ai-name">${t('aiCap')}</span><input data-own="cap" type="number" min="0" step="0.5" value="${esc(d.cap)}"><small class="muted">${t('aiCapTip')}</small></div>
        <div class="ai-own-acts"><button data-own-act="use">${t('aiUse')}</button><button data-own-act="test" ${this.busy ? 'disabled' : ''}>${t(this.busy === 'test' ? 'aiTesting' : 'aiTest')}</button>${s?.choice ? `<button data-own-act="forget">${t('aiForget')}</button>` : ''}</div>
        <div class="ai-own-state">${this.stateHtml(s)}</div>
      </div>`
  }

  private stateHtml(s: ModelStatus | undefined): string {
    const lines: string[] = []
    if (this.said) lines.push(`<div class="${this.said.ok ? 'good' : 'warn'}">${esc(this.said.text)}</div>`)
    if (s?.model) {
      const sp = s.spend
      const unpriced = sp.unpriced ? t('aiSpentUnpriced').replace('{n}', String(sp.unpriced)) : ''
      lines.push(`<div>${t('aiUsing').replace('{model}', `<b>${esc(s.model)}</b>`)}${s.keyHint ? ` · <code>${esc(s.keyHint)}</code>` : ''}</div>`)
      lines.push(`<div class="muted">${t('aiSpent').replace('{cost}', sp.cost.toFixed(sp.cost < 1 ? 3 : 2)).replace('{calls}', String(sp.calls))}${unpriced}${s.cap ? ` / $${s.cap}` : ''}</div>`)
    } else lines.push(`<div class="muted">${t('aiOwnNone')}</div>`)
    if (s?.error) lines.push(`<div class="warn">${esc(s.error)}</div>`)
    return lines.join('')
  }

  wire(root: HTMLElement): void {
    const d = () => (this.draft ??= this.form())
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-own]').forEach((el) => {
      const field = el.dataset.own as 'provider' | 'baseUrl' | 'model' | 'key' | 'cap'
      el.addEventListener('input', () => {
        d()[field] = el.value
        if (field === 'provider') {
          // another service: its own address and model, a key of its own, a list of its own
          const p = providerOf(el.value)
          Object.assign(d(), { baseUrl: '', model: p?.model ?? '', key: '' })
          this.models = []
          this.said = undefined
          this.redraw()
        }
      })
    })
    root.querySelectorAll<HTMLInputElement>('[data-own-remember]').forEach((el) => (el.onchange = () => (d().remember = el.dataset.ownRemember as Remember)))
    const act = (name: string, fn: () => void) => root.querySelector<HTMLButtonElement>(`[data-own-act="${name}"]`)?.addEventListener('click', fn)
    act('show', () => {
      this.showKey = !this.showKey
      this.redraw()
    })
    act('use', () => {
      const f = d()
      this.own.set(this.choice(f), f.key.trim() || undefined, f.remember, Number(f.cap) || 0)
      // the key is the modder's now: not kept on the page
      this.draft = undefined
      this.showKey = false
      this.said = undefined
      this.redraw()
    })
    act('forget', () => {
      this.own.forget()
      this.draft = undefined
      this.said = undefined
      this.redraw()
    })
    act('test', () => void this.run('test'))
    act('models', () => void this.run('models'))
  }

  private async run(what: 'test' | 'models'): Promise<void> {
    const f = (this.draft ??= this.form())
    this.busy = what
    this.said = undefined
    this.redraw()
    try {
      const v = await this.own.ask(what, { choice: this.choice(f), ...(f.key.trim() && { key: f.key.trim() }) })
      if (what === 'models') {
        this.models = v as string[]
        this.said = { ok: true, text: t('aiModelsFound').replace('{n}', String(this.models.length)) }
      } else {
        const r = v as { ok: true; ms: number } | { ok: false; error: string }
        this.said = r.ok ? { ok: true, text: t('aiTestOk').replace('{s}', (r.ms / 1000).toFixed(1)) } : { ok: false, text: hint(r.error) }
      }
    } catch (err) {
      this.said = { ok: false, text: hint((err as Error).message) }
    }
    this.busy = undefined
    this.redraw()
  }
}

/** A failure as the player can act on it: a browser that could not reach the service at all is said plainly. */
function hint(error: string): string {
  return /failed to fetch|networkerror|load failed|cors/i.test(error) ? `${t('aiUnreachable')} (${error})` : error
}
