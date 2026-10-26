/** Small DOM components. Data and actions come from their caller; no game/worker imports here. */
import { pixelIcon, type IconName } from './icons.ts'
import { pixelArtwork } from './artwork.ts'
export type { IconName } from './icons.ts'

export type Tone = 'default' | 'primary' | 'danger' | 'quiet'
export type Content = Node | string

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', children: Content[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  node.append(...children)
  return node
}

export interface ButtonOptions { label: string; tone?: Tone; disabled?: boolean; onClick?: (event: MouseEvent) => void }
export function button({ label, tone = 'default', disabled = false, onClick }: ButtonOptions): HTMLButtonElement {
  const node = element('button', `ui-button ui-button--${tone}`, [label])
  node.type = 'button'
  node.disabled = disabled
  if (onClick) node.addEventListener('click', onClick)
  return node
}

export function icon(name: IconName): HTMLElement {
  const node = element('span', `ui-icon ui-icon--${name}`, [pixelIcon(name)])
  node.setAttribute('aria-hidden', 'true')
  return node
}
export function iconButton(name: IconName, label: string, onClick: () => void): HTMLButtonElement {
  const node = button({ label: '', onClick })
  node.classList.add('ui-icon-button')
  node.setAttribute('aria-label', label)
  node.title = label
  node.append(icon(name))
  return node
}

/** A named pixel item: art and text have separate tracks so wrapping never moves the picture. */
export function choiceTile(options: { label: string; artwork?: HTMLCanvasElement; selected?: boolean; onClick?: () => void }): HTMLButtonElement {
  const node = button({ label: '', onClick: options.onClick })
  node.classList.add('ui-choice-tile')
  node.classList.toggle('chosen', !!options.selected)
  node.setAttribute('aria-pressed', String(!!options.selected))
  node.title = options.label
  const art = options.artwork ? pixelArtwork(options.artwork) : element('span', 'ui-artwork')
  art.setAttribute('aria-hidden', 'true')
  const mark = icon('check')
  mark.classList.add('ui-choice-mark')
  node.append(art, element('span', 'ui-choice-name', [options.label]), mark)
  return node
}

export interface UiTab { id: string; label: string; key?: string; disabled?: boolean }
export function tabs(items: UiTab[], selected: string, onChange: (id: string) => void): HTMLElement {
  const root = element('div', 'ui-tabs')
  root.setAttribute('role', 'tablist')
  for (const item of items) {
    const node = button({ label: item.label, disabled: item.disabled, onClick: () => select(item.id) })
    node.dataset.uiTab = item.id
    node.setAttribute('role', 'tab')
    if (item.key) node.append(shortcut(item.key))
    root.append(node)
  }
  function mark(id: string): void {
    root.querySelectorAll<HTMLButtonElement>('[data-ui-tab]').forEach((node) => {
      const active = node.dataset.uiTab === id
      node.setAttribute('aria-selected', String(active))
      node.tabIndex = active ? 0 : -1
      node.classList.toggle('on', active)
    })
  }
  function select(id: string): void { mark(id); onChange(id) }
  root.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const nodes = [...root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    const i = nodes.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? nodes.length - 1 : (i + (event.key === 'ArrowLeft' ? -1 : 1) + nodes.length) % nodes.length
    if (!nodes[next]) return
    event.preventDefault()
    event.stopPropagation()
    nodes[next].click()
    nodes[next].focus({ preventScroll: true })
    nodes[next].scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
  mark(selected)
  return root
}

export function field(label: string, control: HTMLElement, help?: string): HTMLElement {
  const root = element('label', 'ui-field', [element('span', 'ui-field-label', [label]), control])
  if (help) root.append(element('small', 'ui-muted', [help]))
  return root
}
export function input(value: string, onChange: (value: string) => void, type = 'text'): HTMLInputElement {
  const node = element('input', 'ui-input')
  node.type = type
  node.value = value
  node.addEventListener('input', () => onChange(node.value))
  return node
}
export function select(options: { value: string; label: string }[], value: string, onChange: (value: string) => void): HTMLSelectElement {
  const node = element('select', 'ui-select')
  options.forEach((o) => { const option = element('option', '', [o.label]); option.value = o.value; node.append(option) })
  node.value = value
  node.addEventListener('change', () => onChange(node.value))
  return node
}
export function checkbox(label: string, checked: boolean, onChange: (value: boolean) => void): HTMLElement {
  const node = input('', () => {}, 'checkbox')
  node.checked = checked
  node.addEventListener('change', () => onChange(node.checked))
  return element('label', 'ui-check', [node, label])
}
export function slider(value: number, onChange: (value: number) => void, label: string): HTMLInputElement {
  const node = input(String(value), (v) => { syncSlider(node); onChange(Number(v)) }, 'range')
  node.className = 'ui-slider'
  node.min = '0'; node.max = '100'
  node.setAttribute('aria-label', label)
  syncSlider(node)
  return node
}
/** Keep the painted track in step with a native range; call after assigning its value programmatically. */
export function syncSlider(node: HTMLInputElement): void {
  const min = node.min === '' ? 0 : Number(node.min)
  const max = node.max === '' ? 100 : Number(node.max)
  const progress = max > min ? (node.valueAsNumber - min) / (max - min) : 0
  node.style.setProperty('--ui-slider-fill', `${Math.max(0, Math.min(1, progress || 0)) * 100}%`)
}
export function shortcut(key: string): HTMLElement { return element('kbd', 'ui-shortcut', [key]) }
export function badge(label: string, tone: 'default' | 'good' | 'danger' = 'default'): HTMLElement { return element('span', `ui-badge ui-badge--${tone}`, [label]) }
export function progress(value: number, max: number, label: string): HTMLElement {
  const node = element('progress', 'ui-progress')
  node.max = Math.max(1, max); node.value = Math.min(max, Math.max(0, value))
  node.setAttribute('aria-label', label)
  return node
}
export function emptyState(title: string, description: string, action?: HTMLElement): HTMLElement {
  const node = element('div', 'ui-empty', [element('b', '', [title]), element('p', 'ui-muted', [description])])
  if (action) node.append(action)
  return node
}
export function attributeRow(label: string, value: string): HTMLElement { return element('div', 'ui-attribute', [element('span', 'ui-muted', [label]), element('span', '', [value])]) }
export function currency(value: number, label: string): HTMLElement { return element('span', 'ui-currency', [icon('coin'), String(value), element('span', 'ui-muted', [label])]) }
export function materialRow(label: string, have: number, need: number): HTMLElement {
  const row = attributeRow(label, `${have} / ${need}`)
  row.classList.add(have >= need ? 'ui-good' : 'ui-danger')
  return row
}
export interface ItemSlotOptions { label: string; index?: number; count?: number; selected?: boolean; disabled?: boolean; content?: Node; onClick?: () => void }
const escapeAttribute = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
/** Template adapter for frame-rendered grids. `content` is trusted, caller-rendered markup, never user input. */
export function itemSlotHtml(options: { label: string; className?: string; attributes?: Record<string, string | number | undefined>; content: string }): string {
  const attributes = Object.entries(options.attributes ?? {}).filter(([,value]) => value !== undefined).map(([key,value]) => `${key}="${escapeAttribute(String(value))}"`).join(' ')
  return `<div class="slot${escapeAttribute(options.className ?? '')}" role="button" tabindex="0" aria-label="${escapeAttribute(options.label)}" title="${escapeAttribute(options.label)}" ${attributes}>${options.content}</div>`
}
const boundSlots = new WeakSet<HTMLElement>()
export function bindSlotKeys(root: HTMLElement): void {
  if (boundSlots.has(root)) return
  boundSlots.add(root)
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const target = (event.target as HTMLElement).closest<HTMLElement>('[role="button"]:not(button)')
    if (!target || !root.contains(target)) return
    event.preventDefault(); event.stopPropagation(); target.click()
  })
}
export function itemSlot(options: ItemSlotOptions): HTMLButtonElement {
  const node = button({ label: '', disabled: options.disabled, onClick: options.onClick })
  node.className = `ui-slot${options.selected ? ' sel' : ''}`
  node.title = options.label
  node.setAttribute('aria-label', options.label)
  node.setAttribute('aria-pressed', String(!!options.selected))
  if (options.index !== undefined) node.dataset.index = String(options.index)
  if (options.content) node.append(options.content)
  if ((options.count ?? 0) > 1) node.append(element('span', 'count', [String(options.count)]))
  return node
}
export function itemGrid(slots: HTMLElement[]): HTMLElement { return element('div', 'ui-item-grid', slots) }
export function portrait(content: Node, label: string): HTMLElement { const node = element('div', 'ui-portrait', [content]); node.setAttribute('aria-label', label); return node }
export function listDetail(list: HTMLElement, detail: HTMLElement): HTMLElement { list.classList.add('ui-list'); detail.classList.add('ui-detail'); return element('div', 'ui-list-detail', [list, detail]) }
export function notification(message: string, tone: 'default' | 'good' | 'danger' = 'default'): HTMLElement {
  const node = element('div', `ui-notification ui-notification--${tone}`, [message])
  node.setAttribute('role', tone === 'danger' ? 'alert' : 'status')
  return node
}
