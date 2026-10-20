// Options → Keys (2026-10-20): every action with its keys (two each at most), rebound by a click and the new key;
// a key another action holds trades places with it; Backspace takes one off, Esc gives up. The presets: A, the
// left hand on the keys and the right on the mouse (the default), and B, both hands on the keys. The mouse's
// buttons, Esc and ` are not keys here. Kept in this browser (keymap.ts).

import { hasModule } from '../game.ts'
import { ACTION_NAME, GROUPS, PRESETS, bind, bindable, bindingLabel, codeLabel, holder, keys, presetOf, unbind, type Action, type Binding, type Preset } from '../keymap.ts'
import { esc, locale } from './common.ts'

/** The actions only the classes module's games have (the skill bar, the skill tree and panel, the dash). */
const CLASSES: Action[] = ['dash', 'cast1', 'cast2', 'cast3', 'cast4', 'cast5', 'cast6', 'skills', 'skillPanel']
const MODIFIERS = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'])
/** Held keys and steps: never with Shift (Shift is the walk's). */
const PLAIN: Action[] = ['up', 'down', 'left', 'right', 'walk']

const W = (en: string, zh: string) => (locale.value === 'zh' ? zh : en)

export class KeysPage {
  /** The key being asked for: which action's which slot. */
  private asking?: { action: Action; slot: number }
  /** What the last change did (a trade, a key refused). */
  private said = ''
  private host?: HTMLElement
  private readonly listen = (e: KeyboardEvent) => this.onKey(e)

  constructor(private back: () => void) {}

  /** Draw the page into its place in the menu. */
  show(host: HTMLElement): void {
    this.host = host
    this.render()
  }

  /** The menu moved on: stop asking for a key. */
  hide(): void {
    this.stopAsking()
    this.host = undefined
  }

  private render(): void {
    const host = this.host
    if (!host) return
    const m = keys.map
    const L = locale.value
    const preset = presetOf(m)
    const classes = hasModule('classes')
    const presetBtn = (p: Preset, label: string) => `<button data-preset="${p}" class="${preset === p ? 'on' : ''}">${esc(label)}</button>`
    const slotBtn = (a: Action, i: number) => {
      const b = m[a][i]
      const asking = this.asking?.action === a && this.asking.slot === i
      const text = asking ? W('press a key…', '按下新键…') : b ? bindingLabel(b, L) : '—'
      return `<button class="kp-key${asking ? ' asking' : ''}${b ? '' : ' empty'}" data-action="${a}" data-slot="${i}">${esc(text)}</button>`
    }
    const groups = GROUPS.map((g) => {
      const rows = g.actions
        .filter((a) => classes || !CLASSES.includes(a))
        .map((a) => `<div class="kp-row"><span>${esc(ACTION_NAME[a][L === 'zh' ? 1 : 0])}</span>${slotBtn(a, 0)}${slotBtn(a, 1)}</div>`)
        .join('')
      return `<h4>${esc(g.name[L === 'zh' ? 1 : 0])}</h4>${rows}`
    }).join('')
    host.innerHTML = `<div class="keys-page">
      <div class="kp-top"><button id="kpBack">${W('← Options', '← 返回选项')}</button>
        ${presetBtn('a', W('Preset A: keys left, mouse right', '方案 A：左手键盘、右手鼠标'))}
        ${presetBtn('b', W('Preset B: both hands on the keys', '方案 B：双手键盘'))}
        <span class="kp-mine">${preset ? '' : W('(your own)', '（自定义）')}</span></div>
      <p class="kp-note">${W('Click a key, then press the new one: Esc gives up, Backspace takes it off. A key another action has trades places with it. The mouse buttons, Esc and ` stay as they are.', '点一个键，再按新键：Esc 取消，Backspace 清除。新键已经被别的动作占用时，两边互换。鼠标左右键、Esc 和 ` 不能改。')}</p>
      <div class="kp-said">${esc(this.said)}</div>
      ${groups}
    </div>`
    host.querySelector<HTMLButtonElement>('#kpBack')!.onclick = () => this.back()
    host.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) => {
      b.onclick = () => {
        this.stopAsking()
        keys.set(PRESETS[b.dataset.preset as Preset]())
        this.said = b.dataset.preset === 'b' ? W('Preset B: J strikes, K acts on what is in front, L dashes.', '方案 B：J 攻击，K 对面前那一格行动，L 冲刺。') : W('Preset A: the default keys.', '方案 A：默认键位。')
        this.render()
      }
    })
    host.querySelectorAll<HTMLButtonElement>('.kp-key').forEach((b) => {
      b.onclick = () => {
        this.asking = { action: b.dataset.action as Action, slot: Number(b.dataset.slot) }
        this.said = ''
        window.addEventListener('keydown', this.listen, true)
        this.render()
      }
    })
  }

  private stopAsking(): void {
    this.asking = undefined
    window.removeEventListener('keydown', this.listen, true)
  }

  /** The key asked for, pressed: it is not the game's (nothing else hears it). */
  private onKey(e: KeyboardEvent): void {
    const asking = this.asking
    if (!asking) return
    e.preventDefault()
    e.stopImmediatePropagation()
    const L = locale.value
    if (e.code === 'Escape') return void (this.stopAsking(), this.render())
    if (e.code === 'Backspace' || e.code === 'Delete') {
      keys.set(unbind(keys.map, asking.action, asking.slot))
      return void (this.stopAsking(), this.render())
    }
    // Shift alone is a key only for the walk; any other modifier alone waits for the key it goes with
    const shiftKey = e.code === 'ShiftLeft' || e.code === 'ShiftRight'
    if (MODIFIERS.has(e.code) && !(shiftKey && asking.action === 'walk')) return
    const b: Binding = { code: e.code, ...(e.shiftKey && !shiftKey && !PLAIN.includes(asking.action) && { shift: true }) }
    if (!bindable(b) || e.ctrlKey || e.altKey || e.metaKey) {
      this.said = W(`${codeLabel(e.code, L)} cannot be used (the browser's or the game's own).`, `${codeLabel(e.code, L)} 不能用（是浏览器或游戏自己的键）。`)
      return void (this.stopAsking(), this.render())
    }
    const other = holder(keys.map, b, asking.action)
    const { map } = bind(keys.map, asking.action, asking.slot, b)
    keys.set(map)
    const name = (a: Action) => ACTION_NAME[a][L === 'zh' ? 1 : 0]
    this.said = other ? W(`${bindingLabel(b, L)} was “${name(other)}”'s: the two traded.`, `${bindingLabel(b, L)} 原来是「${name(other)}」的，两边已经互换。`) : ''
    this.stopAsking()
    this.render()
  }
}
