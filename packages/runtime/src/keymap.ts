// The keyboard's map (2026-10-20, design.md §5.2): every key the page answers to is an action's, and the player
// rebinds them (Options → Keys). The left hand is on the keys and the right on the mouse: the two clicks are the
// mouse's alone (the held thing's own use, and its use on what is aimed at), never a key's.
// What the page says of a key is read from here: the tip, the key table, the lessons' glyphs, the corner buttons,
// and any text's `{key:<action>}` (a game's words, the interface's own), filled with the key that does it now.
// Kept in the browser (localStorage), never in a save: the world never knows which keys move it. Esc, the
// developer's ` and the browser's own keys are never bound; the mouse's buttons are not keys here.
// Pure: no DOM at import (the wiki reads the defaults to fill a game's words).

/** What a key may do. */
export const ACTIONS = [
  'up', 'down', 'left', 'right', 'run', 'walk',
  'hands', 'put', 'rotate',
  'attack', 'dash', 'draw', 'sneak',
  'cast1', 'cast2', 'cast3', 'cast4', 'cast5', 'cast6',
  'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9', 'slot10', 'row',
  'bag', 'craft', 'skills', 'skillPanel', 'quests', 'journal', 'map', 'build', 'companion',
] as const
export type Action = (typeof ACTIONS)[number]

/** A key: its physical place (`KeyboardEvent.code`, so WASD stays where it is on any layout), Shift held with it or not. */
export interface Binding {
  code: string
  shift?: boolean
}
export type Keymap = Record<Action, Binding[]>
type Lang = 'en' | 'zh'

/** The most keys one action takes. */
export const PER_ACTION = 2

/** Never bound: Esc closes and opens the menu (and skips a lesson), ` is the developer's, the rest are the browser's or the system's. */
export const RESERVED = new Set(['Escape', 'Backquote', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'ContextMenu', 'F5', 'F11', 'F12', 'OSLeft', 'OSRight'])

const k = (code: string, shift = false): Binding => (shift ? { code, shift } : { code })
const digit = (n: number) => `Digit${n % 10}`

/** The default keys. */
export function defaultKeys(): Keymap {
  const m = {
    up: [k('KeyW'), k('ArrowUp')],
    down: [k('KeyS'), k('ArrowDown')],
    left: [k('KeyA'), k('ArrowLeft')],
    right: [k('KeyD'), k('ArrowRight')],
    run: [k('ShiftLeft')],
    walk: [k('ShiftRight')],
    hands: [k('KeyE')],
    put: [k('KeyG')],
    rotate: [k('KeyR')],
    attack: [k('Space')],
    dash: [k('KeyQ')],
    draw: [k('KeyX')],
    sneak: [k('KeyV')],
    row: [k('Tab', true)],
    bag: [k('Tab'), k('KeyI')],
    craft: [k('KeyC')],
    skills: [k('KeyK')],
    skillPanel: [k('KeyU')],
    quests: [k('KeyL')],
    journal: [k('KeyJ')],
    map: [k('KeyM')],
    build: [k('KeyB')],
    companion: [k('KeyP')],
  } as Partial<Keymap>
  for (let n = 1; n <= 6; n++) m[`cast${n}` as Action] = [k(digit(n), true)]
  for (let n = 1; n <= 10; n++) m[`slot${n}` as Action] = [k(digit(n))]
  return m as Keymap
}

export const same = (a: Binding, b: Binding) => a.code === b.code && !!a.shift === !!b.shift

/**
 * The action a key does: one bound with Shift only while Shift is held (Shift+1 casts), one bound without it whether
 * or not (Shift held to run, W still walks up), the Shift-bound one first.
 */
export function actionOf(map: Keymap, code: string, shift: boolean): Action | undefined {
  let plain: Action | undefined
  for (const a of ACTIONS)
    for (const b of map[a]) {
      if (b.code !== code) continue
      if (b.shift) {
        if (shift) return a
      } else plain ??= a
    }
  return plain
}

/** The action that holds this binding already, if another than `but`. */
export function holder(map: Keymap, b: Binding, but?: Action): Action | undefined {
  return ACTIONS.find((a) => a !== but && map[a].some((x) => same(x, b)))
}

/** Can this key be bound (Shift alone only without Shift; never a reserved key)? */
export function bindable(b: Binding): boolean {
  if (!b.code || RESERVED.has(b.code)) return false
  if (b.shift && (b.code === 'ShiftLeft' || b.code === 'ShiftRight')) return false
  return true
}

/**
 * Bind a key to an action's slot (0 or 1). Held by another action already, the two trade: that one takes what this
 * slot had (or loses the key). Returns the new map and the action it traded with.
 */
export function bind(map: Keymap, action: Action, slot: number, b: Binding): { map: Keymap; swapped?: Action } {
  if (!bindable(b)) return { map }
  const next = clone(map)
  const own = next[action]
  const old: Binding | undefined = own[slot]
  if (old && same(old, b)) return { map: next }
  let swapped: Action | undefined
  const j = own.findIndex((x) => same(x, b))
  if (j >= 0) {
    // this action's other slot had it: the two slots trade
    if (old) own[j] = old
    else own.splice(j, 1)
  } else {
    swapped = holder(next, b, action)
    if (swapped) {
      const list = next[swapped]
      const i = list.findIndex((x) => same(x, b))
      if (old) list[i] = old
      else list.splice(i, 1)
    }
  }
  if (slot < own.length) own[slot] = b
  else own.push(b)
  next[action] = own.slice(0, PER_ACTION)
  return { map: next, swapped }
}

/** Take the key out of an action's slot. */
export function unbind(map: Keymap, action: Action, slot: number): Keymap {
  const next = clone(map)
  next[action] = next[action].filter((_, i) => i !== slot)
  return next
}

export function clone(map: Keymap): Keymap {
  return Object.fromEntries(ACTIONS.map((a) => [a, map[a].map((b) => ({ ...b }))])) as Keymap
}

/** One action's keys alike in two maps, slot for slot. */
const alike = (a: Binding[], b: Binding[]) => a.length === b.length && a.every((x, i) => same(x, b[i]))

/** Two maps alike, key for key. */
export function equal(a: Keymap, b: Keymap): boolean {
  return ACTIONS.every((x) => alike(a[x], b[x]))
}

/** Are an action's keys other than the default's? */
export function changed(map: Keymap, action: Action): boolean {
  return !alike(defaultKeys()[action], map[action])
}

/**
 * An action back to its default keys: one another action holds now is taken from it, and that one gets back its own
 * default where that key is free now (a trade undone from either side). `took`: the actions whose keys changed too.
 */
export function reset(map: Keymap, action: Action): { map: Keymap; took: Action[] } {
  const d = defaultKeys()
  const next = clone(map)
  next[action] = []
  const took: Action[] = []
  for (const b of d[action]) {
    const h = holder(next, b, action)
    if (h) (next[h] = next[h].filter((x) => !same(x, b))), took.push(h)
    next[action].push({ ...b })
  }
  for (const h of took) for (const b of d[h]) if (next[h].length < PER_ACTION && !holder(next, b)) next[h].push({ ...b })
  return { map: next, took }
}

/** A stored map, read back: every action the stored one names well, the rest the default's; never two actions on one key. */
export function parse(raw: unknown): Keymap {
  const base = defaultKeys()
  const keys = raw && typeof raw === 'object' && 'keys' in raw ? (raw as { keys: unknown }).keys : undefined
  if (!keys || typeof keys !== 'object') return base
  const out = clone(base)
  for (const a of ACTIONS) {
    const list = (keys as Record<string, unknown>)[a]
    if (!Array.isArray(list)) continue
    out[a] = list
      .filter((b): b is Binding => !!b && typeof b === 'object' && typeof (b as Binding).code === 'string')
      .map((b) => k(b.code, !!b.shift))
      .filter(bindable)
      .slice(0, PER_ACTION)
  }
  // a key two actions hold: the first action keeps it
  const seen: Binding[] = []
  for (const a of ACTIONS) out[a] = out[a].filter((b) => (seen.some((x) => same(x, b)) ? false : (seen.push(b), true)))
  return out
}

export function serialize(map: Keymap): string {
  return JSON.stringify({ v: 1, keys: map })
}

// ---------------------------------------------------------------- names

const NAMES: Record<string, [string, string]> = {
  Space: ['Space', '空格'],
  Tab: ['Tab', 'Tab'],
  Enter: ['Enter', '回车'],
  Backspace: ['Backspace', '退格'],
  ShiftLeft: ['Shift', 'Shift'],
  ShiftRight: ['Right Shift', '右 Shift'],
  CapsLock: ['Caps Lock', '大写锁定'],
  ArrowUp: ['↑', '↑'],
  ArrowDown: ['↓', '↓'],
  ArrowLeft: ['←', '←'],
  ArrowRight: ['→', '→'],
  Minus: ['-', '-'],
  Equal: ['=', '='],
  BracketLeft: ['[', '['],
  BracketRight: [']', ']'],
  Backslash: ['\\', '\\'],
  Semicolon: [';', ';'],
  Quote: ["'", "'"],
  Comma: [',', ','],
  Period: ['.', '.'],
  Slash: ['/', '/'],
  Insert: ['Insert', 'Insert'],
  Delete: ['Delete', 'Delete'],
  Home: ['Home', 'Home'],
  End: ['End', 'End'],
  PageUp: ['Page Up', 'PgUp'],
  PageDown: ['Page Down', 'PgDn'],
}

/** The characters this keyboard's layout prints on its keys (the browser's layout map, where it tells): an AZERTY's KeyQ is A. */
let layout: Map<string, string> | undefined
export function setLayout(map: Map<string, string> | undefined): void {
  layout = map
}

/** A key as the player reads it. */
export function codeLabel(code: string, lang: Lang): string {
  const named = NAMES[code]
  if (named) return named[lang === 'zh' ? 1 : 0]
  const printed = layout?.get(code)
  if (printed && /^Key|^Digit/.test(code)) return printed.toUpperCase()
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`
  return code
}

export function bindingLabel(b: Binding, lang: Lang): string {
  return (b.shift ? 'Shift+' : '') + codeLabel(b.code, lang)
}

/** What an action is called. */
export const ACTION_NAME: Record<Action, [string, string]> = {
  up: ['Move up', '向上走'],
  down: ['Move down', '向下走'],
  left: ['Move left', '向左走'],
  right: ['Move right', '向右走'],
  run: ['Run (hold)', '跑步（按住）'],
  walk: ['Walk (hold)', '慢走（按住）'],
  hands: ['The hand: pick up what lies loose; talk, open, read', '手：拿起散落的东西；说话、打开、阅读'],
  put: ['Put down, put in, hand over', '放下、放进、交给别人'],
  rotate: ['Turn what you build; with a floor in hand, the ceiling', '旋转要建的东西；手持地板时切换天花板'],
  attack: ['Attack ahead', '朝面前攻击'],
  dash: ['Dash', '冲刺'],
  draw: ['Draw or sheathe your weapon', '拔刀 / 收刀'],
  sneak: ['Sneak', '潜行'],
  cast1: ['Skill 1', '技能 1'],
  cast2: ['Skill 2', '技能 2'],
  cast3: ['Skill 3', '技能 3'],
  cast4: ['Skill 4', '技能 4'],
  cast5: ['Skill 5', '技能 5'],
  cast6: ['Skill 6', '技能 6'],
  slot1: ['Toolbar 1', '快捷栏 1'],
  slot2: ['Toolbar 2', '快捷栏 2'],
  slot3: ['Toolbar 3', '快捷栏 3'],
  slot4: ['Toolbar 4', '快捷栏 4'],
  slot5: ['Toolbar 5', '快捷栏 5'],
  slot6: ['Toolbar 6', '快捷栏 6'],
  slot7: ['Toolbar 7', '快捷栏 7'],
  slot8: ['Toolbar 8', '快捷栏 8'],
  slot9: ['Toolbar 9', '快捷栏 9'],
  slot10: ['Toolbar 10', '快捷栏 10'],
  row: ['Next bag row to the toolbar', '把背包的下一行换到快捷栏'],
  bag: ['Bag (its tabs: the other panels)', '背包（页签切到其他面板）'],
  craft: ['Crafting', '制作'],
  skills: ['Skill tree', '技能树'],
  skillPanel: ['Skills', '技能面板'],
  quests: ['Quests', '任务'],
  journal: ['Codex', '图鉴'],
  map: ['World map', '世界地图'],
  build: ['Build mode', '建造模式'],
  companion: ['Companion (her panel)', '小精灵面板'],
}

/** The actions in their groups, as the keys page lists them. */
export const GROUPS: { name: [string, string]; actions: Action[] }[] = [
  { name: ['Moving', '移动'], actions: ['up', 'down', 'left', 'right', 'run', 'walk'] },
  { name: ['Acting', '交互'], actions: ['hands', 'put', 'rotate'] },
  { name: ['Fighting', '战斗'], actions: ['attack', 'dash', 'draw', 'sneak', 'cast1', 'cast2', 'cast3', 'cast4', 'cast5', 'cast6'] },
  { name: ['Toolbar', '快捷栏'], actions: ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9', 'slot10', 'row'] },
  { name: ['Panels', '面板'], actions: ['bag', 'craft', 'skills', 'skillPanel', 'quests', 'journal', 'map', 'build', 'companion'] },
]

/** An action's key as a text names it: its first, or a word that it has none. */
export function keyOf(map: Keymap, action: Action, lang: Lang): string {
  const b = map[action][0]
  return b ? bindingLabel(b, lang) : lang === 'zh' ? '（未设按键）' : '(unbound)'
}

/** The four steps as one word: WASD where they are W, A, S, D; else each, slashed. */
export function moveKeys(map: Keymap, lang: Lang): string {
  const ks = (['up', 'left', 'down', 'right'] as const).map((a) => keyOf(map, a, lang))
  return ks.every((x) => x.length === 1) ? ks.join('') : ks.join('/')
}

/** The toolbar's keys as one span ("1–0"). */
export function slotKeys(map: Keymap, lang: Lang): string {
  return `${keyOf(map, 'slot1', lang)}–${keyOf(map, 'slot10', lang)}`
}

/**
 * A text's keys filled in: `{key:hands}` is the key of the hand; `{key:move}` the four steps, `{key:slots}` the toolbar's,
 * `{key:casts}` the skill bar's. A name no action has is left as it is; a key in parentheses that has none now goes with them.
 */
export function fillKeys(text: string, map: Keymap, lang: Lang): string {
  if (!text.includes('{key:')) return text
  const unbound = (name: string) => (ACTIONS as readonly string[]).includes(name) && !map[name as Action].length
  // a key named in passing, "(K)", that has none now: the aside goes
  return text.replace(/ ?[（(]\{key:([a-zA-Z0-9]+)\}[)）]/g, (all, name: string) => (unbound(name) ? '' : all)).replace(/\{key:([a-zA-Z0-9]+)\}/g, (all, name: string) => {
    if (name === 'move') return moveKeys(map, lang)
    if (name === 'slots') return slotKeys(map, lang)
    if (name === 'casts') return `${keyOf(map, 'cast1', lang)}–${keyOf(map, 'cast6', lang).replace(/^Shift\+/, '')}`
    return (ACTIONS as readonly string[]).includes(name) ? keyOf(map, name as Action, lang) : all
  })
}

/**
 * The key a lesson draws (its `key`, written as the default keys are): what that key does in the default map, shown
 * as the key that does it now ("E" → whatever is the hand; "WASD" → the steps; "1–0" → the toolbar).
 */
export function lessonKey(key: string, map: Keymap, lang: Lang): string {
  if (key === 'WASD') return moveKeys(map, lang)
  if (key === '1–0') return slotKeys(map, lang)
  const hold = /^hold (.+)$/.exec(key)
  if (hold) return `${lang === 'zh' ? '长按' : 'Hold'} ${lessonKey(hold[1], map, lang)}`
  const d = defaultKeys()
  const code = key.length === 1 ? (/[0-9]/.test(key) ? `Digit${key}` : `Key${key}`) : key
  const a = ACTIONS.find((x) => d[x][0] && !d[x][0].shift && d[x][0].code === code) ?? ACTIONS.find((x) => d[x].some((b) => !b.shift && b.code === code))
  return a ? keyOf(map, a, lang) : key
}

// ---------------------------------------------------------------- the player's own

const STORE = 'openworld.keys'

/** The player's map: what they stored, else the default. Storage may be refused (a private window): the default then. */
export function loadKeys(): Keymap {
  try {
    const raw = globalThis.localStorage?.getItem(STORE)
    return raw ? parse(JSON.parse(raw)) : defaultKeys()
  } catch {
    return defaultKeys()
  }
}

export function saveKeys(map: Keymap): void {
  try {
    globalThis.localStorage?.setItem(STORE, serialize(map))
  } catch {
    // not kept past this page: the keys still work now
  }
}

/** The keys in force, and who wants to know when they change (the labels drawn once). */
export const keys = {
  map: loadKeys(),
  listeners: [] as (() => void)[],
  set(map: Keymap): void {
    this.map = map
    saveKeys(map)
    for (const f of this.listeners) f()
  },
  onChange(f: () => void): void {
    this.listeners.push(f)
  },
}
