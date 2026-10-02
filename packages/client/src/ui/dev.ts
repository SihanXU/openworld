// The Mod Console: a developer's window onto the Mod port (dev builds only). It lists the
// undefined events as they happen, shows each ModRequest, and lets a person write a patch that
// goes through the same validate → apply → persist path as the modder's.

import type { Frame, ModSpec, Patch, Rule, ValidationResult, WorldIndex } from '@lsw/engine'
import type { LibraryView, RecordView } from '../protocol.ts'
import { $, esc, locale } from './common.ts'
import { template } from './template.ts'

export { template }

export interface DevSend {
  patch(id: string | undefined, patch: Patch): void
  dismiss(id: string): void
  removeRule(id: string): void
  spec(): void
  save(): void
  newGame(): void
}

export class ModConsole {
  records: RecordView[] = []
  library?: LibraryView
  spec?: ModSpec
  modder: { online: boolean; url?: string; model?: string | null } = { online: false }
  stats?: WorldIndex['stats']
  frame?: Frame
  private perf = { tickMs: 0, entities: 0, loaded: 0, fps: 0 }
  private selected?: string
  private tab: 'undefined' | 'rules' | 'spec' | 'world' = 'undefined'
  private lastValidation?: { id?: string; html: string }

  constructor(private send: DevSend) {}

  get open(): boolean {
    return !$('#dev').classList.contains('hidden')
  }

  toggle(force?: boolean): void {
    if (!import.meta.env.DEV) return
    $('#dev').classList.toggle('hidden', force === undefined ? this.open : !force)
    if (this.open) this.render()
  }

  setPerf(p: { tickMs: number; entities: number; loaded: number }, fps: number): void {
    this.perf = { ...p, fps }
  }

  setRecords(records: RecordView[], library: LibraryView): void {
    this.records = records
    this.library = library
    if (!this.selected && records.length) this.selected = records[records.length - 1].id
    if (this.open && !typing()) this.render()
  }

  setModder(m: { online: boolean; url?: string; model?: string | null }): void {
    this.modder = m
    if (this.open && !typing()) this.render()
  }

  setSpec(spec: ModSpec): void {
    this.spec = spec
    if (this.tab === 'spec' && this.open) this.render()
  }

  onFrame(f: Frame): void {
    this.frame = f
    if (this.open && this.tab === 'world') this.renderWorldTab()
  }

  showValidation(id: string | undefined, r: ValidationResult): void {
    const el = document.querySelector('#valOut')
    const html = r.ok
      ? `<div class="ok">✓ ${locale.value === 'zh' ? '校验通过并已应用' : 'validated and applied'}${r.overrides.length ? ` · overrides: ${esc(r.overrides.join(', '))}` : ''}</div>`
      : `<div class="err">${r.errors.map((e) => `✗ ${esc(e)}`).join('<br>')}</div>`
    const warn = r.warnings.length ? `<div class="warn">${r.warnings.map((w) => `! ${esc(w)}`).join('<br>')}</div>` : ''
    if (el) el.innerHTML = html + warn
    this.lastValidation = { id, html: html + warn }
    if (r.ok && id) this.selected = id
  }

  render(): void {
    const zh = locale.value === 'zh'
    const tabs: [typeof this.tab, string][] = [
      ['undefined', zh ? '未定义' : 'Undefined'],
      ['rules', zh ? '规则库' : 'Rule library'],
      ['spec', 'ModSpec'],
      ['world', zh ? '世界' : 'World'],
    ]
    const dev = $('#dev')
    const keepText = (dev.querySelector('#patchText') as HTMLTextAreaElement | null)?.value
    const m = this.modder
    const chip = m.online
      ? `<span class="modder on" title="${esc(m.url ?? '')}">● ${zh ? '模组师' : 'modder'}: ${esc(m.model ?? '—')}</span>`
      : `<span class="modder" title="${esc(m.url ?? '')}">○ ${zh ? '无模组师：手动打补丁' : 'no modder: patch by hand'}</span>`
    dev.innerHTML = `
      <div class="panel-head"><b>⚙ ${zh ? '模组控制台' : 'Mod Console'}</b> ${chip}
        <span class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${this.tab === k ? 'on' : ''}">${l}</button>`).join('')}</span>
        <button class="x" id="devClose">✕</button></div>
      <div class="dev-body" id="devBody"></div>`
    dev.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => (b.onclick = () => ((this.tab = b.dataset.tab as typeof this.tab), this.render())))
    $('#devClose').onclick = () => this.toggle(false)
    if (this.tab === 'undefined') this.renderUndefinedTab(keepText)
    if (this.tab === 'rules') this.renderRulesTab()
    if (this.tab === 'spec') this.renderSpecTab()
    if (this.tab === 'world') this.renderWorldTab()
  }

  private renderUndefinedTab(keepText?: string): void {
    const zh = locale.value === 'zh'
    const body = $('#devBody')
    const rec = this.records.find((r) => r.id === this.selected)
    const list = [...this.records]
      .reverse()
      .map((r) => `<div class="rec ${r.id === this.selected ? 'sel' : ''}" data-rec="${r.id}"><span class="pill p-${r.status}">${r.status}</span> ${esc(r.summary)}</div>`)
      .join('')
    body.innerHTML = `
      <div class="split">
        <div class="list">${list || `<div class="muted pad">${zh ? '还没有未定义的事件。' : 'No undefined events yet.'}</div>`}</div>
        <div class="detail">${rec ? this.recordDetail(rec, keepText) : ''}</div>
      </div>`
    body.querySelectorAll<HTMLElement>('[data-rec]').forEach((el) => (el.onclick = () => ((this.selected = el.dataset.rec), this.render())))
    if (!rec) return
    const ta = body.querySelector<HTMLTextAreaElement>('#patchText')!
    body.querySelector<HTMLButtonElement>('#bTemplate')!.onclick = () => (ta.value = JSON.stringify(template(rec), null, 2))
    body.querySelector<HTMLButtonElement>('#bSubmit')!.onclick = () => {
      try {
        this.send.patch(rec.id, JSON.parse(ta.value) as Patch)
      } catch (err) {
        $('#valOut').innerHTML = `<div class="err">JSON: ${esc((err as Error).message)}</div>`
      }
    }
    body.querySelector<HTMLButtonElement>('#bDismiss')?.addEventListener('click', () => this.send.dismiss(rec.id))
    body.querySelector<HTMLButtonElement>('#bCopy')!.onclick = async () => {
      if (!this.spec) this.send.spec()
      await navigator.clipboard.writeText(llmPrompt(rec, this.spec)).catch(() => {})
      body.querySelector('#bCopy')!.textContent = zh ? '已复制 ✓' : 'Copied ✓'
    }
  }

  private recordDetail(r: RecordView, keepText?: string): string {
    const zh = locale.value === 'zh'
    const req = r.request
    const ent = (e?: { name: string; type: string; tags: string[]; statuses: string[] }) =>
      e ? `<b>${esc(e.name)}</b> <code>${esc(e.type)}</code> ${e.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}${e.statuses.map((t) => `<span class="tag st">${esc(t)}</span>`).join('')}` : '—'
    const text = keepText ?? (r.patch ? JSON.stringify(r.patch, null, 2) : '')
    const params = Object.entries(req.event.params ?? {}).filter(([k]) => !['power'].includes(k)).map(([k, v]) => `${k}=${v}`).join(' ')
    const what = `${req.event.kind}${params ? ` · ${params}` : ''}`
    return `
      <div class="req">
        <div class="row"><span class="k">${zh ? '事件' : 'event'}</span> <code>${esc(what)}</code> <span class="pill p-${r.status}">${r.status}</span> <span class="muted">tick ${r.tick} · ${esc(req.context.map.name)} · ${req.context.hour}h</span></div>
        <div class="row"><span class="k">host</span> ${ent(req.event.host)}</div>
        ${Object.entries(req.event.roles).map(([k, e]) => `<div class="row"><span class="k">${esc(k)}</span> ${ent(e)}</div>`).join('')}
        <div class="row"><span class="k">hole</span> <code>${esc(req.hole.rule)}</code> ${req.hole.path.map((p) => `<span class="tag">${esc(p)}</span>`).join('')}</div>
        <div class="row"><span class="k">rules</span> ${req.context.rules.map((n) => `<code>${esc(n.id)}</code>`).join(' ') || '—'}</div>
        ${r.rules?.length ? `<div class="row"><span class="k">rules</span> ${r.rules.map((x) => `<code class="good">${esc(x)}</code>`).join(' ')}</div>` : ''}
        <details><summary>ModRequest JSON</summary><pre>${esc(JSON.stringify(req, null, 2))}</pre></details>
      </div>
      <div class="patch-ed">
        <div class="row"><b>Patch</b>
          <button id="bTemplate">${zh ? '填入模板' : 'Template'}</button>
          <button id="bCopy">${zh ? '复制为 LLM 提示词' : 'Copy as LLM prompt'}</button>
          <span class="grow"></span>
          ${r.status === 'pending' ? `<button id="bDismiss">${zh ? '什么也不发生' : 'Nothing happens'}</button>` : ''}
          <button id="bSubmit" class="primary">${zh ? '校验并应用' : 'Validate & apply'}</button></div>
        <textarea id="patchText" spellcheck="false" placeholder='{ "artifacts": [ { "kind": "rule", "rule": { … } } ] }'>${esc(text)}</textarea>
        <div id="valOut">${this.lastValidation?.id === r.id ? this.lastValidation.html : r.diagnostics?.length ? `<div class="warn">${r.diagnostics.map((d) => esc(d)).join('<br>')}</div>` : ''}</div>
      </div>`
  }

  private renderRulesTab(): void {
    const zh = locale.value === 'zh'
    const lib = this.library
    const body = $('#devBody')
    if (!lib) return
    const counts = Object.entries(lib.counts)
      .map(([k, v]) => `<span class="tag">${k}: ${v}</span>`)
      .join(' ')
    body.innerHTML = `
      <div class="pad">
        <div class="row"><b>${zh ? '规则库' : 'Rule library'}</b> v${lib.version} · ${lib.base} base · ${lib.patches.length} patches · ${counts}</div>
        ${lib.patches.map((r) => ruleCard(r)).join('') || `<div class="muted pad">${zh ? '还没有补丁。' : 'No patches yet.'}</div>`}
      </div>`
    body.querySelectorAll<HTMLButtonElement>('[data-rm]').forEach((b) => (b.onclick = () => this.send.removeRule(b.dataset.rm!)))
  }

  private renderSpecTab(): void {
    const body = $('#devBody')
    if (!this.spec) {
      this.send.spec()
      body.innerHTML = `<div class="pad muted">…</div>`
      return
    }
    body.innerHTML = `<div class="pad"><div class="row"><b>${esc(this.spec.version)}</b> <span class="grow"></span><button id="bSpecCopy">Copy JSON</button></div>
      <p class="muted">${esc(this.spec.summary)}</p>
      <pre class="tall">${esc(JSON.stringify(this.spec, null, 2))}</pre></div>`
    $('#bSpecCopy').onclick = () => navigator.clipboard.writeText(JSON.stringify(this.spec, null, 2)).catch(() => {})
  }

  private renderWorldTab(): void {
    const s = this.stats
    const f = this.frame
    const body = document.querySelector('#devBody')
    if (!body || !s) return
    const n = (x: number) => x.toLocaleString('en-US')
    body.innerHTML = `<div class="pad world-tab">
      <div class="stats small">
        <div><b>${n(s.maps)}</b><span>maps</span></div><div><b>${n(s.npcs)}</b><span>NPCs</span></div>
        <div><b>${n(s.creatures)}</b><span>creatures</span></div><div><b>${n(s.items)}</b><span>items</span></div>
        <div><b>${n(s.itemKinds)}</b><span>item kinds</span></div><div><b>${n(s.fixtures)}</b><span>fixtures</span></div>
      </div>
      <table class="kv">
        <tr><td>maps loaded</td><td>${this.perf.loaded}</td></tr>
        <tr><td>entities in memory</td><td>${n(this.perf.entities)}</td></tr>
        <tr><td>entities on this map</td><td>${f ? f.entities.length : 0}</td></tr>
        <tr><td>engine tick</td><td>${this.perf.tickMs.toFixed(2)} ms</td></tr>
        <tr><td>FPS</td><td>${this.perf.fps.toFixed(0)}</td></tr>
        <tr><td>tick</td><td>${f?.tick ?? 0}</td></tr>
      </table>
    </div>`
  }
}

function typing(): boolean {
  const a = document.activeElement
  return !!a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT')
}

function ruleCard(r: Rule): string {
  const src = r.source
  return `<div class="rulecard"><div class="row"><code class="good">${esc(r.id)}</code> <span class="muted">${esc(r.on)} · ${esc(src?.author ?? '')} · ${esc(src?.at?.slice(0, 19).replace('T', ' ') ?? '')}</span><span class="grow"></span><button data-rm="${esc(r.id)}">remove</button></div>
    ${r.doc ? `<div class="muted">${esc(r.doc)}</div>` : ''}<pre>${esc(JSON.stringify({ host: r.host, tree: r.tree }, null, 2))}</pre></div>`
}


/** The request + spec as a self-contained prompt for any LLM. */
export function llmPrompt(r: RecordView, spec?: ModSpec): string {
  return [
    'You are the modder of a 2D RPG world whose mechanics are data (rules). An event just happened that no rule covers.',
    'Write ONE JSON patch {"artifacts":[{"kind":"rule","rule":{...}}]} that defines the CLASS of this event, following the ModSpec exactly. Output only JSON.',
    '',
    '## ModRequest',
    JSON.stringify(r.request, null, 2),
    '',
    '## ModSpec',
    spec ? JSON.stringify(spec, null, 2) : '(open the ModSpec tab once to include it)',
  ].join('\n')
}
