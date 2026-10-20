// Options → Keys (2026-10-20): every action with its key and a spare one, rebound by a click and the new key.
// What is changed is a draft until it is saved (the game keeps the keys it has meanwhile); it may be given up,
// one action set back to its default (the row says what that was), or all of them. A key another action has
// asks first: the two trade, or nothing changes. The presets: A, the left hand on the keys and the right on
// the mouse (the default), and B, both hands on the keys. The mouse's buttons, Esc and ` are not keys here.
// Kept in this browser (keymap.ts).

import { hasModule } from '../game.ts'
import { ACTION_NAME, GROUPS, PRESETS, bind, bindable, bindingLabel, changed, clone, codeLabel, equal, holder, keys, presetOf, reset, unbind, type Action, type Binding, type Keymap, type Preset } from '../keymap.ts'
import { esc, locale } from './common.ts'

/** The actions only the classes module's games have (the skill bar, the skill tree and panel, the dash). */
const CLASSES: Action[] = ['dash', 'cast1', 'cast2', 'cast3', 'cast4', 'cast5', 'cast6', 'skills', 'skillPanel']
const MODIFIERS = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'])
/** Held keys and steps: never with Shift (Shift is the walk's). */
const PLAIN: Action[] = ['up', 'down', 'left', 'right', 'walk']

const W = (en: string, zh: string) => (locale.value === 'zh' ? zh : en)
const nameOf = (a: Action) => ACTION_NAME[a][locale.value === 'zh' ? 1 : 0]

export class KeysPage {
  /** The keys as this page has them, saved or not. */
  private draft?: Keymap
  /** The key being asked for: which action's which slot. */
  private asking?: { action: Action; slot: number }
  /** A key another action has, waiting for the player to say whether the two trade. */
  private trading?: { action: Action; slot: number; b: Binding; other: Action }
  /** Leaving with what is not saved: the page asks first. */
  private leaving = false
  /** What the last change did. */
  private said = ''
  private host?: HTMLElement
  private readonly listen = (e: KeyboardEvent) => this.onKey(e)

  constructor(private back: () => void) {}

  /** Draw the page into its place in the menu (a draft left unsaved is still there). */
  show(host: HTMLElement): void {
    this.host = host
    this.draft ??= clone(keys.map)
    this.render()
  }

  /** The menu moved on: stop asking for a key (the draft waits for the page's return). */
  hide(): void {
    this.stopAsking()
    this.trading = undefined
    this.leaving = false
    this.host = undefined
  }

  private get dirty(): boolean {
    return !!this.draft && !equal(this.draft, keys.map)
  }

  private render(): void {
    const host = this.host
    const m = this.draft
    if (!host || !m) return
    const L = locale.value
    const preset = presetOf(m)
    const classes = hasModule('classes')
    const presetBtn = (p: Preset, label: string) => `<button data-preset="${p}" class="${preset === p ? 'on' : ''}">${esc(label)}</button>`
    const slotBtn = (a: Action, i: number) => {
      const b = m[a][i]
      const asking = this.asking?.action === a && this.asking.slot === i
      const text = asking ? W('press a key…', '按下新键…') : b ? bindingLabel(b, L) : '—'
      return `<button class="kp-key${asking ? ' asking' : ''}${b ? '' : ' empty'}${b && !keys.map[a].some((x) => x.code === b.code && !!x.shift === !!b.shift) ? ' new' : ''}" data-action="${a}" data-slot="${i}">${esc(text)}</button>`
    }
    // a row changed from the default: what the default was, and a click to set it back
    const resetBtn = (a: Action) => {
      if (!changed(m, a)) return '<span></span>'
      const d = PRESETS.a()[a].map((b) => bindingLabel(b, L)).join(' / ') || W('none', '无')
      return `<button class="kp-reset" data-reset="${a}" title="${esc(W('Set this action back to its default key', '把这个动作恢复成默认键'))}">↺ ${esc(W('default', '默认'))} ${esc(d)}</button>`
    }
    const groups = GROUPS.map((g) => {
      const rows = g.actions
        .filter((a) => classes || !CLASSES.includes(a))
        .map((a) => `<div class="kp-row${changed(m, a) ? ' changed' : ''}"><span>${esc(nameOf(a))}</span>${slotBtn(a, 0)}${slotBtn(a, 1)}${resetBtn(a)}</div>`)
        .join('')
      return `<h4>${esc(g.name[L === 'zh' ? 1 : 0])}</h4>${rows}`
    }).join('')
    const t = this.trading
    const prompt = t
      ? `<div class="kp-ask">${esc(W(`${bindingLabel(t.b, L)} is “${nameOf(t.other)}”'s key. Trade the two?`, `${bindingLabel(t.b, L)} 已经是「${nameOf(t.other)}」的键。两边互换吗？`))} <button id="kpTrade">${W('Trade', '互换')}</button><button id="kpKeep">${W('Cancel', '取消')}</button></div>`
      : this.leaving
        ? `<div class="kp-ask">${esc(W('Some changes are not saved.', '还有没保存的改动。'))} <button id="kpSaveBack">${W('Save and go back', '保存并返回')}</button><button id="kpDropBack">${W('Give them up and go back', '放弃并返回')}</button><button id="kpStay">${W('Stay', '留在这里')}</button></div>`
        : `<div class="kp-said">${esc(this.said)}</div>`
    host.innerHTML = `<div class="keys-page">
      <div class="kp-bar">
        <button id="kpBack">${W('← Options', '← 返回选项')}</button>
        <span class="kp-state">${this.dirty ? W('Not saved yet', '有改动还没保存') : W('Saved', '已保存')}</span>
        <button id="kpSave" class="kp-save"${this.dirty ? '' : ' disabled'}>${W('Save', '保存')}</button>
        <button id="kpDrop"${this.dirty ? '' : ' disabled'}>${W('Give up the changes', '放弃改动')}</button>
      </div>
      ${prompt}
      <div class="kp-top"><span>${W('Presets:', '预设：')}</span>
        ${presetBtn('a', W('A: keys left, mouse right', '方案 A：左手键盘、右手鼠标'))}
        ${presetBtn('b', W('B: both hands on the keys', '方案 B：双手键盘'))}
        <button id="kpDefaults"${preset === 'a' ? ' disabled' : ''}>${W('All back to default', '全部恢复默认')}</button>
        <span class="kp-mine">${preset ? '' : W('(your own)', '（自定义）')}</span></div>
      <p class="kp-note">${W('Each action has a key and a spare one: click either, then press the new key (Esc gives up, Backspace takes it off). Changes count once saved. The mouse buttons, Esc and ` stay as they are.', '每个动作有一个按键和一个备用键，两个都能用。点其中一个，再按新键（Esc 取消，Backspace 清除）。改完点“保存”才生效。鼠标左右键、Esc 和 ` 不能改。')}</p>
      <div class="kp-row kp-head"><span>${W('Action', '动作')}</span><span>${W('Key', '按键')}</span><span>${W('Spare key', '备用键')}</span><span></span></div>
      ${groups}
    </div>`
    const on = (id: string, f: () => void) => {
      const el = host.querySelector<HTMLButtonElement>(`#${id}`)
      if (el) el.onclick = f
    }
    on('kpBack', () => (this.dirty ? ((this.leaving = true), this.render()) : this.back()))
    on('kpSave', () => this.save())
    on('kpDrop', () => ((this.draft = clone(keys.map)), (this.said = W('Changes given up.', '改动已放弃。')), this.render()))
    on('kpSaveBack', () => (this.save(), this.back()))
    on('kpDropBack', () => ((this.draft = clone(keys.map)), (this.leaving = false), this.back()))
    on('kpStay', () => ((this.leaving = false), this.render()))
    on('kpTrade', () => {
      const t = this.trading!
      this.draft = bind(this.draft!, t.action, t.slot, t.b).map
      this.said = W(`${bindingLabel(t.b, L)} is now “${nameOf(t.action)}”'s; “${nameOf(t.other)}” has the old one.`, `${bindingLabel(t.b, L)} 现在是「${nameOf(t.action)}」的，「${nameOf(t.other)}」换成了原来的键。`)
      this.trading = undefined
      this.render()
    })
    on('kpKeep', () => ((this.trading = undefined), (this.said = ''), this.render()))
    on('kpDefaults', () => ((this.draft = PRESETS.a()), (this.said = W('All the default keys (not saved yet).', '已全部恢复默认（还没保存）。')), this.render()))
    host.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) => {
      b.onclick = () => {
        this.stopAsking()
        this.draft = PRESETS[b.dataset.preset as Preset]()
        this.said = b.dataset.preset === 'b' ? W('Preset B: J strikes, K acts on what is in front, L dashes (not saved yet).', '方案 B：J 攻击，K 对面前那一格行动，L 冲刺（还没保存）。') : W('Preset A: the default keys (not saved yet).', '方案 A：默认键位（还没保存）。')
        this.render()
      }
    })
    host.querySelectorAll<HTMLButtonElement>('[data-reset]').forEach((b) => {
      b.onclick = () => {
        const a = b.dataset.reset as Action
        const { map, took } = reset(this.draft!, a)
        this.draft = map
        this.said = took.length ? W(`“${nameOf(a)}” is back to its default; ${took.map((x) => `“${nameOf(x)}”`).join(', ')} changed with it.`, `「${nameOf(a)}」恢复成默认键；${took.map((x) => `「${nameOf(x)}」`).join('、')}的键也跟着调整了。`) : ''
        this.render()
      }
    })
    host.querySelectorAll<HTMLButtonElement>('.kp-key').forEach((b) => {
      b.onclick = () => {
        this.asking = { action: b.dataset.action as Action, slot: Number(b.dataset.slot) }
        this.trading = undefined
        this.said = ''
        window.addEventListener('keydown', this.listen, true)
        this.render()
      }
    })
  }

  private save(): void {
    if (!this.draft) return
    keys.set(clone(this.draft))
    this.leaving = false
    this.said = W('Saved: the game uses these keys now.', '已保存：游戏现在用这套键位。')
    this.render()
  }

  private stopAsking(): void {
    this.asking = undefined
    window.removeEventListener('keydown', this.listen, true)
  }

  /** The key asked for, pressed: it is not the game's (nothing else hears it). */
  private onKey(e: KeyboardEvent): void {
    const asking = this.asking
    if (!asking || !this.draft) return
    e.preventDefault()
    e.stopImmediatePropagation()
    const L = locale.value
    if (e.code === 'Escape') return void (this.stopAsking(), this.render())
    if (e.code === 'Backspace' || e.code === 'Delete') {
      this.draft = unbind(this.draft, asking.action, asking.slot)
      return void (this.stopAsking(), this.render())
    }
    // Shift alone is a key only for the walk; any other modifier alone waits for the key it goes with
    const shiftKey = e.code === 'ShiftLeft' || e.code === 'ShiftRight'
    if (MODIFIERS.has(e.code) && !(shiftKey && asking.action === 'walk')) return
    const b: Binding = { code: e.code, ...(e.shiftKey && !shiftKey && !PLAIN.includes(asking.action) && { shift: true }) }
    this.stopAsking()
    if (!bindable(b) || e.ctrlKey || e.altKey || e.metaKey) {
      this.said = W(`${codeLabel(e.code, L)} cannot be used (the browser's or the game's own).`, `${codeLabel(e.code, L)} 不能用（是浏览器或游戏自己的键）。`)
      return this.render()
    }
    // another action's key: asked first
    const other = holder(this.draft, b, asking.action)
    if (other) {
      this.trading = { ...asking, b, other }
      return this.render()
    }
    this.draft = bind(this.draft, asking.action, asking.slot, b).map
    this.said = ''
    this.render()
  }
}
