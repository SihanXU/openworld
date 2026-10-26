import { bindSlotKeys, button, element, icon, iconButton, type Content } from './primitives.ts'

export type WindowSize = 'sm' | 'md' | 'lg' | 'full'
export type WindowMode = 'modal' | 'confirmation' | 'hud'
export interface WindowOptions {
  id?: string
  title?: string
  size?: WindowSize
  mode?: WindowMode
  view?: string
  onClose?: () => void
  onBackdrop?: () => void
  /** A forced story/death screen may take focus without offering an Escape dismissal. */
  dismissible?: boolean
}
interface Record {
  root: HTMLElement; surface: HTMLElement; options: WindowOptions; observer: MutationObserver
  opened: boolean; previous?: HTMLElement; focusKey?: string; scroll: Map<string, number>
}
const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
const visible = (node: HTMLElement) => node.isConnected && !node.closest('.hidden, [hidden]') && node.getClientRects().length > 0
const closeLabel = () => document.documentElement.lang.startsWith('zh') ? '关闭' : 'Close'
let sequence = 0

/** Adopt an existing close control while retaining its action and stable selector. */
export function mountCloseButton(control: HTMLButtonElement): void {
  control.type = 'button'
  control.classList.add('ui-icon-button')
  control.setAttribute('aria-label', closeLabel())
  control.title = closeLabel()
  control.replaceChildren(icon('close'))
}

/** One focus/keyboard owner for all game windows; gameplay remains in the existing send callbacks. */
export class WindowManager {
  private records = new Map<HTMLElement, Record>()
  private order: Record[] = []
  private queued = false
  private controller = new AbortController()

  constructor() {
    const signal = this.controller.signal
    document.addEventListener('keydown', this.onKey, { capture: true, signal })
    document.addEventListener('focusin', this.onFocus, { signal })
    const updateViewport = () => {
      const v = window.visualViewport
      const style = document.documentElement.style
      // Keep desktop resizing in CSS; cached pixel widths can lag a resize by one frame.
      // Only a zoomed/keyboard viewport needs explicit visible dimensions.
      style.setProperty('--ui-viewport-height', v && Math.abs(v.height - innerHeight) > 1 ? `${v.height}px` : '100dvh')
      style.setProperty('--ui-viewport-width', v && v.scale !== 1 ? `${v.width}px` : '100vw')
      style.setProperty('--ui-viewport-top', `${v?.offsetTop ?? 0}px`)
      style.setProperty('--ui-viewport-left', `${v?.offsetLeft ?? 0}px`)
      document.activeElement instanceof HTMLElement && document.activeElement.closest('input,textarea,select') && document.activeElement.scrollIntoView({ block: 'nearest' })
    }
    window.addEventListener('resize', updateViewport, { signal })
    window.visualViewport?.addEventListener('resize', updateViewport, { signal })
    window.visualViewport?.addEventListener('scroll', updateViewport, { signal })
    updateViewport()
  }

  register(root: HTMLElement, surface: HTMLElement, options: WindowOptions): void {
    const old = this.records.get(root)
    if (old) {
      const sameView = old.options.view === options.view
      old.surface = surface; old.options = options
      if (!sameView) { old.scroll.clear(); old.focusKey = undefined }
      surface.querySelectorAll<HTMLElement>('[data-ui-scroll]').forEach((node) => { node.scrollTop = old.scroll.get(node.dataset.uiScroll!) ?? 0 })
    } else {
      const observer = new MutationObserver(() => this.schedule())
      observer.observe(root, { attributes: true, attributeFilter: ['class', 'hidden'] })
      const record: Record = { root, surface, options, observer, opened: false, scroll: new Map() }
      this.records.set(root, record)
      root.addEventListener('scroll', (event) => {
        const node = event.target as HTMLElement
        if (node.dataset?.uiScroll) record.scroll.set(node.dataset.uiScroll, node.scrollTop)
      }, { capture: true, signal: this.controller.signal })
    }
    this.schedule()
  }

  private schedule(): void {
    if (this.queued) return
    this.queued = true
    queueMicrotask(() => { this.queued = false; this.sync() })
  }

  sync(): void {
    const closed: Record[] = []
    let changed = false
    for (const [key, record] of this.records) {
      const shown = visible(record.surface)
      if (!shown && record.opened) { changed = true; record.opened = false; this.order = this.order.filter((r) => r !== record); closed.push(record) }
      if (!record.root.isConnected || !record.surface.isConnected) { record.observer.disconnect(); this.records.delete(key); continue }
      if (shown && !record.opened) {
        changed = true
        record.opened = true
        record.previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
        this.order.push(record)
      }
    }
    const top = this.top
    document.body.classList.toggle('ui-modal-open', !!top)
    for (const record of this.order) {
      if (record.options.mode === 'hud') continue
      record.surface.setAttribute('aria-modal', String(record === top))
    }
    const inPanelTabs = top?.options.mode !== 'confirmation' && document.activeElement?.closest('.panel-tabs')
    if (top && !top.surface.contains(document.activeElement) && !inPanelTabs) {
      const kept = top.focusKey ? [...top.surface.querySelectorAll<HTMLElement>(FOCUSABLE)].find((n) => this.focusKey(n) === top.focusKey) : undefined
      const target = kept ?? top.surface.querySelector<HTMLElement>('[autofocus]') ?? top.surface.querySelector<HTMLElement>(FOCUSABLE) ?? top.surface
      target.focus({ preventScroll: true })
    } else if (!top && closed.length) {
      const previous = closed[0].previous
      if (previous && visible(previous)) previous.focus({ preventScroll: true })
    }
    if (changed) document.dispatchEvent(new Event('ui:windowchange'))
  }

  private get top(): Record | undefined { return [...this.order].reverse().find((r) => r.options.mode !== 'hud' && visible(r.surface)) }
  private focusKey(node: HTMLElement): string {
    return node.id || [...node.attributes].filter((a) => a.name.startsWith('data-')).map((a) => `${a.name}=${a.value}`).join('|') || `${node.tagName}:${(node as HTMLInputElement).type ?? ''}:${node.textContent?.trim()}`
  }
  private onFocus = (event: FocusEvent) => {
    const node = event.target as HTMLElement
    const top = this.top
    if (top?.surface.contains(node)) top.focusKey = this.focusKey(node)
  }
  private onKey = (event: KeyboardEvent) => {
    const top = this.top
    if (!top || event.isComposing) return
    // The rebind page owns its recording keys, including Escape.
    if (top.surface.querySelector('.kp-key.asking')) return
    if (event.key === 'Escape' && top.options.onClose && top.options.dismissible !== false) {
      event.preventDefault(); event.stopImmediatePropagation(); top.options.onClose(); this.schedule(); return
    }
    if (event.key === 'Tab') {
      const panelTabs = top.options.mode === 'confirmation' ? [] : [...document.querySelectorAll<HTMLElement>('.panel-tabs button')]
      const nodes = [...top.surface.querySelectorAll<HTMLElement>(FOCUSABLE), ...panelTabs].filter((node) => node.tabIndex >= 0 && visible(node))
      if (!nodes.length) { event.preventDefault(); event.stopImmediatePropagation(); return }
      const index = nodes.indexOf(document.activeElement as HTMLElement)
      const next = (index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length
      event.preventDefault(); event.stopImmediatePropagation()
      nodes[next].focus({ preventScroll: true }); nodes[next].scrollIntoView({ block: 'nearest', inline: 'nearest' })
    } else if ((event.key === ' ' || event.key === 'Enter') && (event.target as HTMLElement)?.closest('button,input,select,textarea,a')) {
      // Keep native button activation without letting Space/Enter reach gameplay or the cover menu.
      event.stopImmediatePropagation()
    } else if (top.options.mode === 'confirmation' || (event.target as HTMLElement)?.closest('input,select,textarea')) event.stopPropagation()
  }

  closeMain(except: HTMLElement): void {
    for (const record of this.order) if (record.surface !== except && record.options.mode === 'modal' && record.options.dismissible !== false) record.options.onClose?.()
  }
  destroy(): void {
    this.controller.abort()
    for (const record of this.records.values()) record.observer.disconnect()
    this.records.clear(); this.order = []
  }
}

let manager: WindowManager | undefined
export function windowManager(): WindowManager { return manager ??= new WindowManager() }

/** Adopt a business panel without replacing its data attributes, nodes, listeners or extension interface. */
export function mountWindow(surface: HTMLElement, options: WindowOptions = {}): HTMLElement {
  bindSlotKeys(surface)
  surface.classList.add('ui-window')
  surface.dataset.uiSize = options.size ?? 'md'
  surface.dataset.uiMode = options.mode ?? 'modal'
  surface.tabIndex = -1
  const header = surface.querySelector<HTMLElement>(':scope > .ui-window-head, :scope > .tabs-row, :scope > .jhead, :scope > .pp-head, :scope > .rs-head, :scope > .cv-phead, :scope > header')
  if (header) {
    header.classList.add('ui-window-head')
    const title = header.querySelector<HTMLElement>('.sheet-title,.sk-title,b,strong,h2,span')
    if (title) {
      title.classList.add('ui-window-title')
      title.id ||= `ui-title-${++sequence}`
      surface.setAttribute('aria-labelledby', title.id)
    }
    const close = header.querySelector<HTMLButtonElement>('.x,[data-close]')
    if (close) mountCloseButton(close)
  }
  if (options.title) surface.setAttribute('aria-label', options.title)
  header?.querySelectorAll<HTMLElement>('.hs-pages').forEach((nav) => {
    nav.classList.add('ui-tabs')
    surface.insertBefore(nav, header.nextSibling)
  })
  if (!surface.hasAttribute('aria-labelledby') && !surface.hasAttribute('aria-label')) surface.setAttribute('aria-label', closeLabel() === '关闭' ? '游戏窗口' : 'Game window')
  surface.setAttribute('role', options.mode === 'confirmation' ? 'alertdialog' : options.mode === 'hud' ? 'region' : 'dialog')
  const footer = surface.querySelector<HTMLElement>(':scope > footer,:scope > .rs-foot,:scope > .ui-window-foot') ?? surface.querySelector<HTMLElement>('.inv-foot,.opt-acts')
  footer?.classList.add('ui-window-foot')
  if (footer && footer.parentElement !== surface) surface.append(footer)
  if (!surface.querySelector(':scope > .ui-window-body')) {
    const body = element('div', 'ui-window-body')
    const navs = [...surface.children].filter((n) => n.matches('.cx-tabs,.ql-tabs,.ui-tabs'))
    for (const child of [...surface.childNodes]) if (child !== header && child !== footer && !navs.includes(child as Element)) body.append(child)
    if (footer) surface.insertBefore(body, footer)
    else surface.append(body)
  }
  surface.querySelector<HTMLElement>(':scope > .ui-window-body')!.dataset.uiScroll = 'body'
  surface.querySelectorAll<HTMLElement>('.ql-list,.ql-detail,.cx-body,.lm-body').forEach((node) => { node.dataset.uiScroll = node.className.split(' ')[0] })
  const root = surface.closest<HTMLElement>('.overlay,.death,#intro') ?? surface
  const onClose = options.onClose ?? (() => surface.querySelector<HTMLButtonElement>('.ui-window-head .x,.ui-window-head [data-close]')?.click())
  windowManager().register(root, surface, { ...options, mode: options.mode ?? 'modal', onClose })
  return surface
}

export interface UiWindow { root: HTMLElement; surface: HTMLElement; body: HTMLElement; footer: HTMLElement; show(): void; hide(): void; destroy(): void }
export function createWindow(options: WindowOptions & { title: string }, content: Content[] = []): UiWindow {
  const root = element('div', 'ui-overlay hidden')
  root.classList.add('overlay')
  const surface = element('section', 'ui-window')
  if (options.id) surface.id = options.id
  const hide = () => { root.classList.add('hidden'); windowManager().sync() }
  const close = () => { if (options.dismissible === false) return; if (options.onClose) options.onClose(); else hide() }
  const header = element('header', 'ui-window-head', [element('h2', 'ui-window-title', [options.title])])
  if (options.dismissible !== false) header.append(iconButton('close', closeLabel(), close))
  const body = element('div', 'ui-window-body', content)
  const footer = element('footer', 'ui-window-foot')
  surface.append(header, body, footer); root.append(surface)
  if (options.mode === 'confirmation') root.classList.add('ui-overlay--confirmation')
  root.addEventListener('mousedown', (event) => { if (event.target === root) (options.onBackdrop ?? close)() })
  document.body.append(root)
  mountWindow(surface, { ...options, onClose: close })
  return {
    root, surface, body, footer,
    show() { if ((options.mode ?? 'modal') === 'modal') windowManager().closeMain(surface); root.classList.remove('hidden'); windowManager().sync() },
    hide,
    destroy() { root.remove(); windowManager().sync() },
  }
}

export function confirmDialog(message: string, options: { title?: string; confirm?: string; cancel?: string; danger?: boolean } = {}): Promise<boolean> {
  const zh = document.documentElement.lang.startsWith('zh')
  return new Promise((resolve) => {
    const done = (answer: boolean) => { dialog.destroy(); resolve(answer) }
    const dialog = createWindow({ title: options.title ?? (zh ? '请确认' : 'Confirm'), mode: 'confirmation', size: 'sm', onClose: () => done(false) }, [element('p', 'ui-prose', [message])])
    dialog.footer.append(button({ label: options.cancel ?? (zh ? '取消' : 'Cancel'), onClick: () => done(false) }), button({ label: options.confirm ?? (zh ? '确认' : 'Confirm'), tone: options.danger ? 'danger' : 'primary', onClick: () => done(true) }))
    dialog.show()
  })
}
