// DOM UI: status HUD, inventory bar, message log, speech bubbles, toasts, help, intro,
// and the Mod Console (the human-operated Mod port until an LLM modder is plugged in).

import type { Frame, FxEvent, ItemInfo, ModSpec, Patch, Rule, Text, ValidationResult, WorldIndex } from '@lsw/engine'
import type { LibraryView, RecordView } from './protocol.ts'
import { textOf } from './scene.ts'

export type Locale = 'en' | 'zh'

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const UI: Record<string, [string, string]> = {
  hand: ['Hand', '手'],
  empty: ['empty', '空'],
  pack: ['Pack', '背包'],
  help: ['Help', '帮助'],
  mods: ['Mod Console', '模组控制台'],
  save: ['Save', '保存'],
  newGame: ['New game', '新游戏'],
  saved: ['Saved.', '已保存。'],
  undefinedToast: ['Undefined interaction → Mod port', '未定义交互 → 已发往模组接口'],
  patchedToast: ['Patched — the world learned a new rule', '已打补丁——世界学会了一条新规则'],
  open: ['Open', '打开'],
  loading: ['Loading', '加载中'],
}

export class Hud {
  locale: Locale = (localStorage.getItem('lsw.locale') as Locale) || 'en'
  private frame?: Frame
  private records: RecordView[] = []
  private library?: LibraryView
  private selected?: string
  private tab: 'undefined' | 'rules' | 'spec' | 'world' = 'undefined'
  private stats?: WorldIndex['stats']
  private perf = { tickMs: 0, entities: 0, loaded: 0, fps: 0 }
  private bubbles = new Map<string, { el: HTMLElement; until: number; who: string }>()
  private floaters: { el: HTMLElement; born: number; who?: string; tile?: [number, number] }[] = []
  private dotEls = new Map<string, HTMLElement>()
  spec?: ModSpec

  constructor(
    private send: {
      hold(item?: string): void
      patch(id: string | undefined, patch: Patch): void
      dismiss(id: string): void
      removeRule(id: string): void
      spec(): void
      save(): void
      newGame(): void
    },
    private screenOf: (id: string) => { x: number; y: number } | undefined,
    readonly screenOfTile: (x: number, y: number) => { x: number; y: number },
  ) {
    this.build()
  }

  t(k: string): string {
    const v = UI[k]
    return v ? (this.locale === 'zh' ? v[1] : v[0]) : k
  }

  tx(t: Text | undefined): string {
    return textOf(t, this.locale)
  }

  // ---------------------------------------------------------------- skeleton

  private build(): void {
    $('#hud').innerHTML = `
      <div class="hud-tl panel-glass">
        <div class="map-name" id="mapName">…</div>
        <div class="clock"><span id="clockIcon">☀</span> <span id="clock">08:00</span> <span id="region" class="muted"></span></div>
        <div class="hpbar"><div id="hpFill"></div><span id="hpText"></span></div>
        <div id="pStatus" class="statuses"></div>
      </div>
      <div class="hud-tr">
        <button id="bHelp" title="H">?</button>
        <button id="bLang" title="L">中/EN</button>
        <button id="bMods" title="\`">⚙ <span id="modsLabel"></span> <span id="modBadge" class="badge hidden">0</span></button>
      </div>
      <div class="hud-bottom">
        <div class="slot hand" id="handSlot" title="Q: stow"><div class="lbl" id="handLbl"></div></div>
        <div class="pack" id="pack"></div>
      </div>
      <div class="hud-log" id="log"></div>
      <div class="toasts" id="toasts"></div>
      <div class="hint" id="hint"></div>`
    $('#bHelp').onclick = () => this.toggle('#help')
    $('#bLang').onclick = () => this.toggleLocale()
    $('#bMods').onclick = () => this.toggleMods()
    this.renderHelp()
    this.relabel()
  }

  relabel(): void {
    $('#modsLabel').textContent = this.t('mods')
    $('#handLbl').textContent = this.t('hand')
    document.documentElement.lang = this.locale === 'zh' ? 'zh-CN' : 'en'
  }

  toggleLocale(): void {
    this.locale = this.locale === 'en' ? 'zh' : 'en'
    localStorage.setItem('lsw.locale', this.locale)
    this.relabel()
    this.renderHelp()
    if (this.frame) this.onFrame(this.frame)
    this.renderMods()
  }

  toggle(sel: string, force?: boolean): void {
    const el = $(sel)
    el.classList.toggle('hidden', force === undefined ? !el.classList.contains('hidden') : !force)
  }

  toggleMods(force?: boolean): void {
    this.toggle('#dev', force)
    if (!$('#dev').classList.contains('hidden')) this.renderMods()
  }

  closeAll(): void {
    for (const s of ['#help', '#dev']) this.toggle(s, false)
  }

  get typing(): boolean {
    const a = document.activeElement
    return !!a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT')
  }

  // ---------------------------------------------------------------- intro & help

  showIntro(name: Text, stats: WorldIndex['stats'], resumed: boolean, onStart: (fresh: boolean) => void): void {
    this.stats = stats
    const zh = this.locale === 'zh'
    const n = (x: number) => x.toLocaleString('en-US')
    $('#intro').innerHTML = `
      <div class="intro-card">
        <div class="kicker">Large Symbolic World</div>
        <h1>${esc(this.tx(name))}</h1>
        <p class="lede">${zh ? '一个由代码构成、由 AI 实时打补丁的开放世界。已定义的交互直接运行；未定义的交互交给模组接口，补出一条新规则。' : 'An open world made of code. Defined interactions just run; an undefined one goes to the Mod port, which writes the world a new rule.'}</p>
        <div class="stats">
          <div><b>${n(stats.maps)}</b><span>${zh ? '张地图' : 'maps'}</span></div>
          <div><b>${n(stats.npcs)}</b><span>${zh ? '个 NPC' : 'NPCs'}</span></div>
          <div><b>${n(stats.creatures)}</b><span>${zh ? '只怪物' : 'creatures'}</span></div>
          <div><b>${n(stats.items)}</b><span>${zh ? '件物品' : 'items'}</span></div>
          <div><b>${n(stats.itemKinds)}</b><span>${zh ? '种物品' : 'item kinds'}</span></div>
          <div><b>${n(stats.fixtures)}</b><span>${zh ? '个物件' : 'fixtures'}</span></div>
        </div>
        <div class="controls-mini">${this.controlsHtml()}</div>
        <div class="intro-actions">
          ${resumed ? `<button id="iCont" class="primary">${zh ? '继续' : 'Continue'}</button><button id="iNew">${zh ? '新游戏' : 'New game'}</button>` : `<button id="iCont" class="primary">${zh ? '开始' : 'Start'}</button>`}
        </div>
      </div>`
    this.toggle('#intro', true)
    const go = (fresh: boolean) => {
      this.toggle('#intro', false)
      onStart(fresh)
    }
    $('#iCont').onclick = () => go(false)
    const nb = document.querySelector<HTMLButtonElement>('#iNew')
    if (nb) nb.onclick = () => go(true)
  }

  private controlsHtml(): string {
    const zh = this.locale === 'zh'
    const rows: [string, string, string][] = [
      ['WASD / ↑↓←→', 'move', '移动'],
      ['F', 'take', '拿'],
      ['G', 'put (held item)', '放（手中物品）'],
      ['E', 'interact (with held item)', '交互（用手中物品）'],
      ['U', 'use held item on yourself', '对自己使用'],
      ['Space', 'attack / cast', '攻击 / 施法'],
      ['1–9 · Q', 'hold item · stow', '拿起背包物品 · 收起'],
      ['`', 'Mod Console', '模组控制台'],
      ['L · H', 'language · help', '语言 · 帮助'],
    ]
    return `<table>${rows.map(([k, en, z]) => `<tr><td><kbd>${k}</kbd></td><td>${zh ? z : en}</td></tr>`).join('')}</table>`
  }

  private renderHelp(): void {
    const zh = this.locale === 'zh'
    $('#help').innerHTML = `
      <div class="panel-head"><b>${this.t('help')}</b><button class="x" data-close="#help">✕</button></div>
      <div class="help-body">
        ${this.controlsHtml()}
        <p>${zh ? '三个动作：<b>拿</b>、<b>放</b>、<b>交互</b>。手里拿着东西时，交互就是“用它作用于目标”。试试：把水泼到着火的草上、用火把点燃干草、在篝火上烤鱼、用冰杖冻住湿了的史莱姆、对湿的敌人放雷。' : 'Three verbs: <b>take</b>, <b>put</b>, <b>interact</b>. Holding something, interact means “apply it to the target”. Try: douse burning grass with water, light the hay with a torch, cook fish on a campfire, freeze a wet slime with an ice wand, shock wet enemies.'}</p>
        <p>${zh ? '当你做了规则库里没有的事，交互就是<b>未定义</b>的：目标会短暂冻结，请求会发到<b>模组控制台</b>（`）。在那里可以查看完整请求、写一条补丁规则并提交；引擎校验通过后，这条规则就永久成为世界的一部分。' : 'When you do something the rule library does not cover, the interaction is <b>undefined</b>: the target freezes briefly and the request goes to the <b>Mod Console</b> (`). There you can inspect the full request, write a patch rule and submit it; once the engine validates it, the rule becomes a permanent part of the world.'}</p>
      </div>`
    $('#help').querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.toggle('#help', false)
  }

  // ---------------------------------------------------------------- per frame

  onFrame(f: Frame): void {
    this.frame = f
    const p = f.player
    const hh = Math.floor(f.hour)
    const mm = Math.floor((f.hour - hh) * 60)
    $('#clock').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    $('#clockIcon').textContent = f.hour >= 6 && f.hour < 19 ? '☀' : '☾'
    $<HTMLDivElement>('#hpFill').style.width = `${Math.max(0, (100 * p.hp) / p.maxHp)}%`
    $('#hpText').textContent = `${Math.max(0, Math.round(p.hp))} / ${p.maxHp}`
    $('#pStatus').innerHTML = p.statuses.map((s) => `<span class="st st-${s}">${s}</span>`).join('')
    this.renderInventory(p.held, p.inventory)
    // pending-mod indicators over frozen entities
    const frozen = new Set(f.entities.filter((e) => e.frozen).map((e) => e.id))
    for (const id of frozen)
      if (!this.dotEls.has(id)) {
        const el = document.createElement('div')
        el.className = 'pending-dots'
        el.textContent = '…'
        $('#labels').appendChild(el)
        this.dotEls.set(id, el)
      }
    for (const [id, el] of this.dotEls) if (!frozen.has(id)) (el.remove(), this.dotEls.delete(id))
    if (!$('#dev').classList.contains('hidden') && this.tab === 'world') this.renderWorldTab()
  }

  setMapName(name: Text, region?: string): void {
    $('#mapName').textContent = this.tx(name)
    $('#region').textContent = region ? `· ${region}` : ''
  }

  private invSig = ''

  private renderInventory(held: ItemInfo | undefined, inv: ItemInfo[]): void {
    const sig = `${this.locale}|${held?.id}:${held?.type}|${inv.map((i) => i.id + i.type).join(',')}`
    if (sig === this.invSig) return
    this.invSig = sig
    const hand = $('#handSlot')
    hand.querySelectorAll('.icon,.name').forEach((n) => n.remove())
    if (held) hand.insertAdjacentHTML('afterbegin', `<div class="icon" data-icon="${held.id}"></div><div class="name">${esc(this.tx(held.name))}</div>`)
    else hand.insertAdjacentHTML('afterbegin', `<div class="name muted">${this.t('empty')}</div>`)
    $('#pack').innerHTML = inv
      .slice(0, 18)
      .map((it, i) => `<div class="slot" data-item="${it.id}" title="${esc(this.tx(it.name))}"><div class="icon" data-icon="${it.id}"></div><kbd>${i < 9 ? i + 1 : ''}</kbd></div>`)
      .join('')
    $('#pack').querySelectorAll<HTMLElement>('[data-item]').forEach((el) => (el.onclick = () => this.send.hold(el.dataset.item)))
    hand.onclick = () => this.send.hold(undefined)
    this.paintIcons?.([held, ...inv].filter(Boolean) as ItemInfo[])
  }

  /** Set by main.ts: paints item icons (from Phaser textures) into [data-icon] slots. */
  paintIcons?: (items: ItemInfo[]) => void

  // ---------------------------------------------------------------- fx → UI

  onFx(fx: FxEvent): void {
    switch (fx.t) {
      case 'log':
        return this.log(this.tx(fx.text), fx.tone)
      case 'say':
        return this.say(fx.who, this.tx(fx.text))
      case 'damage':
        return this.floater(fx.who, fx.amount < 0 ? `+${-fx.amount}` : `-${fx.amount}`, fx.amount < 0 ? 'heal' : fx.element ?? 'hit')
      case 'undefined':
        this.log(`⚠ ${fx.summary}`, 'ai')
        return this.toast(`<b>${this.t('undefinedToast')}</b><br>${esc(fx.summary)}`, true)
      case 'patched':
        this.log(`✓ ${fx.rule}`, 'good')
        return this.toast(`<b>${this.t('patchedToast')}</b><br><code>${esc(fx.rule)}</code>`)
    }
  }

  log(text: string, tone?: string): void {
    const el = document.createElement('div')
    el.className = `line ${tone ?? ''}`
    el.textContent = text
    const log = $('#log')
    log.appendChild(el)
    while (log.children.length > 7) log.firstElementChild!.remove()
    setTimeout(() => el.classList.add('fade'), 9000)
  }

  toast(html: string, withOpen = false): void {
    const el = document.createElement('div')
    el.className = 'toast'
    el.innerHTML = html + (withOpen ? ` <button class="mini">${this.t('open')} \`</button>` : '')
    el.querySelector('button')?.addEventListener('click', () => this.toggleMods(true))
    $('#toasts').appendChild(el)
    setTimeout(() => el.classList.add('fade'), 4500)
    setTimeout(() => el.remove(), 5200)
  }

  hint(text: string): void {
    $('#hint').textContent = text
  }

  say(who: string, text: string): void {
    this.bubbles.get(who)?.el.remove()
    const el = document.createElement('div')
    el.className = 'bubble'
    el.textContent = text
    $('#labels').appendChild(el)
    this.bubbles.set(who, { el, until: performance.now() + 2600 + text.length * 45, who })
  }

  floater(who: string, text: string, kind: string): void {
    const el = document.createElement('div')
    el.className = `floater f-${kind}`
    el.textContent = text
    $('#labels').appendChild(el)
    this.floaters.push({ el, born: performance.now(), who })
  }

  /** Reposition DOM labels to follow sprites (called every animation frame). */
  tickLabels(): void {
    const now = performance.now()
    for (const [id, b] of this.bubbles) {
      const p = this.screenOf(b.who)
      if (!p || now > b.until) {
        b.el.remove()
        this.bubbles.delete(id)
        continue
      }
      b.el.style.transform = `translate(${p.x}px, ${p.y - 30}px) translate(-50%, -100%)`
    }
    this.floaters = this.floaters.filter((f) => {
      const age = now - f.born
      const p = f.who ? this.screenOf(f.who) : undefined
      if (age > 900 || !p) {
        f.el.remove()
        return false
      }
      f.el.style.transform = `translate(${p.x}px, ${p.y - 26 - age / 25}px) translate(-50%, -100%)`
      f.el.style.opacity = String(1 - age / 900)
      return true
    })
    for (const [id, el] of this.dotEls) {
      const p = this.screenOf(id)
      if (p) el.style.transform = `translate(${p.x}px, ${p.y - 28}px) translate(-50%, -100%)`
    }
  }

  // ---------------------------------------------------------------- Mod Console

  setPerf(p: { tickMs: number; entities: number; loaded: number }, fps: number): void {
    this.perf = { ...p, fps }
  }

  setRecords(records: RecordView[], library: LibraryView): void {
    this.records = records
    this.library = library
    const pending = records.filter((r) => r.status === 'pending').length
    const badge = $('#modBadge')
    badge.textContent = String(records.filter((r) => r.status !== 'patched').length)
    badge.classList.toggle('hidden', records.every((r) => r.status === 'patched'))
    badge.classList.toggle('hot', pending > 0)
    if (!this.selected && records.length) this.selected = records[records.length - 1].id
    if (!$('#dev').classList.contains('hidden') && !this.typing) this.renderMods()
  }

  setSpec(spec: ModSpec): void {
    this.spec = spec
    if (this.tab === 'spec') this.renderMods()
  }

  private lastValidation?: { id?: string; html: string }

  showValidation(id: string | undefined, r: ValidationResult): void {
    const el = document.querySelector('#valOut')
    const html = r.ok
      ? `<div class="ok">✓ ${this.locale === 'zh' ? '校验通过并已应用' : 'validated and applied'}${r.overrides.length ? ` · overrides: ${esc(r.overrides.join(', '))}` : ''}</div>`
      : `<div class="err">${r.errors.map((e) => `✗ ${esc(e)}`).join('<br>')}</div>`
    const warn = r.warnings.length ? `<div class="warn">${r.warnings.map((w) => `! ${esc(w)}`).join('<br>')}</div>` : ''
    if (el) el.innerHTML = html + warn
    this.lastValidation = { id, html: html + warn }
    if (r.ok && id) this.selected = id
  }

  private renderMods(): void {
    const zh = this.locale === 'zh'
    const tabs: [typeof this.tab, string][] = [
      ['undefined', zh ? '未定义交互' : 'Undefined'],
      ['rules', zh ? '规则库' : 'Rule library'],
      ['spec', 'ModSpec'],
      ['world', zh ? '世界' : 'World'],
    ]
    const dev = $('#dev')
    const keepText = (dev.querySelector('#patchText') as HTMLTextAreaElement | null)?.value
    dev.innerHTML = `
      <div class="panel-head"><b>⚙ ${this.t('mods')}</b>
        <span class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${this.tab === k ? 'on' : ''}">${l}</button>`).join('')}</span>
        <button class="x" id="devClose">✕</button></div>
      <div class="dev-body" id="devBody"></div>`
    dev.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => (b.onclick = () => ((this.tab = b.dataset.tab as typeof this.tab), this.renderMods())))
    $('#devClose').onclick = () => this.toggleMods(false)
    if (this.tab === 'undefined') this.renderUndefinedTab(keepText)
    if (this.tab === 'rules') this.renderRulesTab()
    if (this.tab === 'spec') this.renderSpecTab()
    if (this.tab === 'world') this.renderWorldTab()
  }

  private renderUndefinedTab(keepText?: string): void {
    const zh = this.locale === 'zh'
    const body = $('#devBody')
    const rec = this.records.find((r) => r.id === this.selected)
    const list = [...this.records]
      .reverse()
      .map((r) => `<div class="rec ${r.id === this.selected ? 'sel' : ''}" data-rec="${r.id}"><span class="pill p-${r.status}">${r.status}</span> ${esc(r.summary)}</div>`)
      .join('')
    body.innerHTML = `
      <div class="split">
        <div class="list">${list || `<div class="muted pad">${zh ? '还没有未定义交互。试试拿着东西去交互一些奇怪的目标。' : 'No undefined interactions yet. Try applying a held item to something unusual.'}</div>`}</div>
        <div class="detail">${rec ? this.recordDetail(rec, keepText) : ''}</div>
      </div>`
    body.querySelectorAll<HTMLElement>('[data-rec]').forEach((el) => (el.onclick = () => ((this.selected = el.dataset.rec), this.renderMods())))
    if (!rec) return
    const ta = body.querySelector<HTMLTextAreaElement>('#patchText')!
    body.querySelector<HTMLButtonElement>('#bTemplate')!.onclick = () => (ta.value = JSON.stringify(template(rec), null, 2))
    body.querySelector<HTMLButtonElement>('#bSubmit')!.onclick = () => {
      try {
        const patch = JSON.parse(ta.value) as Patch
        this.send.patch(rec.id, patch)
      } catch (err) {
        $('#valOut').innerHTML = `<div class="err">JSON: ${esc((err as Error).message)}</div>`
      }
    }
    body.querySelector<HTMLButtonElement>('#bDismiss')?.addEventListener('click', () => this.send.dismiss(rec.id))
    body.querySelector<HTMLButtonElement>('#bCopy')!.onclick = async () => {
      if (!this.spec) this.send.spec()
      const prompt = llmPrompt(rec, this.spec)
      await navigator.clipboard.writeText(prompt).catch(() => {})
      body.querySelector('#bCopy')!.textContent = zh ? '已复制 ✓' : 'Copied ✓'
    }
  }

  private recordDetail(r: RecordView, keepText?: string): string {
    const zh = this.locale === 'zh'
    const req = r.request
    const ent = (e?: { name: string; type: string; tags: string[]; statuses: string[] }) =>
      e ? `<b>${esc(e.name)}</b> <code>${esc(e.type)}</code> ${e.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}${e.statuses.map((t) => `<span class="tag st">${esc(t)}</span>`).join('')}` : '—'
    const text = keepText ?? (r.patch ? JSON.stringify(r.patch, null, 2) : '')
    return `
      <div class="req">
        <div class="row"><span class="k">${zh ? '动作' : 'verb'}</span> <code>${req.event.verb}</code> <span class="pill p-${r.status}">${r.status}</span> <span class="muted">tick ${r.tick} · ${esc(req.context.map.name)} · ${req.context.hour}h</span></div>
        <div class="row"><span class="k">actor</span> ${ent(req.event.actor)}</div>
        <div class="row"><span class="k">target</span> ${ent(req.event.target)}</div>
        <div class="row"><span class="k">instrument</span> ${ent(req.event.instrument)}</div>
        <div class="row"><span class="k">near-miss</span> ${req.context.nearMisses.map((n) => `<code>${esc(n.id)}</code>`).join(' ') || '—'}</div>
        ${r.rules?.length ? `<div class="row"><span class="k">rules</span> ${r.rules.map((x) => `<code class="good">${esc(x)}</code>`).join(' ')}</div>` : ''}
        <details><summary>ModRequest JSON</summary><pre>${esc(JSON.stringify(req, null, 2))}</pre></details>
      </div>
      <div class="patch-ed">
        <div class="row"><b>Patch</b>
          <button id="bTemplate">${zh ? '填入模板' : 'Template'}</button>
          <button id="bCopy" title="request + ModSpec as an LLM prompt">${zh ? '复制为 LLM 提示词' : 'Copy as LLM prompt'}</button>
          <span class="grow"></span>
          ${r.status === 'pending' ? `<button id="bDismiss">${zh ? '放弃（兜底）' : 'Dismiss (fallback)'}</button>` : ''}
          <button id="bSubmit" class="primary">${zh ? '校验并应用' : 'Validate & apply'}</button></div>
        <textarea id="patchText" spellcheck="false" placeholder='{ "artifacts": [ { "kind": "rule", "rule": { … } } ] }'>${esc(text)}</textarea>
        <div id="valOut">${this.lastValidation?.id === r.id ? this.lastValidation.html : r.diagnostics?.length ? `<div class="warn">${r.diagnostics.map((d) => esc(d)).join('<br>')}</div>` : ''}</div>
      </div>`
  }

  private renderRulesTab(): void {
    const zh = this.locale === 'zh'
    const lib = this.library
    const body = $('#devBody')
    if (!lib) return
    const counts = Object.entries(lib.counts)
      .map(([k, v]) => `<span class="tag">${k}: ${v}</span>`)
      .join(' ')
    body.innerHTML = `
      <div class="pad">
        <div class="row"><b>${zh ? '规则库' : 'Rule library'}</b> v${lib.version} · ${lib.base} base · ${lib.patches.length} patches · ${counts}</div>
        <div class="muted">${zh ? '补丁规则按类型生效：一次补丁覆盖这一类交互的所有实例。可随时移除（回滚）。' : 'Patches are type-level: one patch covers every instance of its interaction class. Remove any patch to roll it back.'}</div>
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
    const zh = this.locale === 'zh'
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
        <tr><td>${zh ? '已加载地图' : 'maps loaded'}</td><td>${this.perf.loaded}</td></tr>
        <tr><td>${zh ? '内存中实体' : 'entities in memory'}</td><td>${n(this.perf.entities)}</td></tr>
        <tr><td>${zh ? '当前地图实体' : 'entities on this map'}</td><td>${f ? f.entities.length : 0}</td></tr>
        <tr><td>${zh ? '引擎 tick 耗时' : 'engine tick'}</td><td>${this.perf.tickMs.toFixed(2)} ms</td></tr>
        <tr><td>FPS</td><td>${this.perf.fps.toFixed(0)}</td></tr>
        <tr><td>tick</td><td>${f?.tick ?? 0}</td></tr>
      </table>
      <div class="row"><button id="bSave">${this.t('save')}</button><button id="bNew">${this.t('newGame')}</button></div>
    </div>`
    $('#bSave').onclick = () => this.send.save()
    $('#bNew').onclick = () => confirm(zh ? '开始新游戏？（规则库补丁会保留）' : 'Start a new game? (rule-library patches are kept)') && this.send.newGame()
  }
}

function ruleCard(r: Rule): string {
  const src = r.source
  return `<div class="rulecard"><div class="row"><code class="good">${esc(r.id)}</code> <span class="muted">${esc(r.on)} · ${esc(src?.author ?? '')} · ${esc(src?.at?.slice(0, 19).replace('T', ' ') ?? '')}</span><span class="grow"></span><button data-rm="${esc(r.id)}">remove</button></div>
    ${r.doc ? `<div class="muted">${esc(r.doc)}</div>` : ''}<pre>${esc(JSON.stringify({ when: r.when, guard: r.guard, do: r.do }, null, 2))}</pre></div>`
}

/** A starting-point patch for a record: the class of the interaction, a visible effect, and the triggering case as a test. */
export function template(r: RecordView): Patch {
  const req = r.request
  const leaf = (t?: { type: string }) => (t ? t.type.split('/').pop()! : 'hand')
  const inst = req.event.instrument
  const tgt = req.event.target!
  const tType = tgt.kind === 'tile' ? tgt.type : (tgt.typeChain.length > 1 ? tgt.typeChain[tgt.typeChain.length - 2] : tgt.type)
  const instSel = inst ? { tags: inst.tags.filter((t) => !t.startsWith('material:') && !t.startsWith('quality:')).slice(0, 1) } : { none: true }
  return {
    author: 'human',
    note: `for ${req.summary}`,
    artifacts: [
      {
        kind: 'rule',
        rule: {
          id: `patch/${req.event.verb}-${leaf(inst)}-on-${leaf(tgt)}`,
          on: 'interaction',
          doc: 'TODO: one-line description',
          when: { verb: [req.event.verb as 'interact'], instrument: instSel, target: { type: tType } },
          do: [
            { op: 'vfx', at: 'target', fx: 'sparkle' },
            { op: 'log', text: { en: 'TODO: what happens', zh: 'TODO：发生了什么' } },
          ],
          tests: [{ name: 'the triggering interaction', given: req.scenario, expect: [{ key: 'target', exists: true }] }],
        },
      },
    ],
  }
}

/** The request + spec as a self-contained prompt for any LLM (manual loop until the modder service exists). */
export function llmPrompt(r: RecordView, spec?: ModSpec): string {
  return [
    'You are the modder of a 2D RPG world whose mechanics are data (rules). An interaction just happened that no rule covers.',
    'Write ONE JSON patch {"artifacts":[{"kind":"rule","rule":{...}}]} that defines the CLASS of this interaction, following the ModSpec exactly. Output only JSON.',
    '',
    '## ModRequest',
    JSON.stringify(r.request, null, 2),
    '',
    '## ModSpec',
    spec ? JSON.stringify(spec, null, 2) : '(open the ModSpec tab once to include it)',
  ].join('\n')
}
