import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Frame } from '@openworld/engine'
import { Menu } from '../src/ui/menu.ts'
import { ContextMenu } from '../src/ui/context-menu.ts'

vi.mock('phaser', () => ({ default: { Scene: class {} } }))

type Clickable = { onclick?: ((event: MouseEvent) => void) | null }

class FakeElement implements Clickable {
  readonly children: FakeElement[] = []
  readonly dataset: Record<string, string> = {}
  readonly style: Record<string, string> = {}
  readonly classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
    contains: (name: string) => this.classes.has(name),
    toggle: (name: string, force?: boolean) => {
      const add = force ?? !this.classes.has(name)
      if (add) this.classes.add(name)
      else this.classes.delete(name)
      return add
    },
  }
  onclick?: ((event: MouseEvent) => void) | null
  textContent: string | null = null
  parent?: { children: FakeElement[] }
  private readonly classes = new Set<string>()
  private html = ''

  get className(): string {
    return [...this.classes].join(' ')
  }

  set className(value: string) {
    this.classes.clear()
    for (const name of value.split(/\s+/).filter(Boolean)) this.classes.add(name)
  }

  set innerHTML(value: string) {
    this.html = value
    this.children.length = 0
    for (const match of value.matchAll(/data-k="(\d+)"/g)) {
      const row = new FakeElement()
      row.dataset.k = match[1]
      row.parent = this
      this.children.push(row)
    }
  }

  get innerHTML(): string {
    return this.html
  }

  appendChild(child: FakeElement): FakeElement {
    child.parent = this
    this.children.push(child)
    return child
  }

  querySelectorAll(selector: string): FakeElement[] {
    return selector === '[data-k]' ? this.children.filter((child) => child.dataset.k !== undefined) : []
  }

  contains(target: unknown): boolean {
    return target === this || this.children.some((child) => child.contains(target))
  }

  remove(): void {
    if (!this.parent) return
    const index = this.parent.children.indexOf(this)
    if (index >= 0) this.parent.children.splice(index, 1)
    this.parent = undefined
  }

  click(): void {
    this.onclick?.({} as MouseEvent)
  }
}

function domHarness() {
  const body = new FakeElement()
  const ids = new Map<string, FakeElement>()
  const document = {
    body,
    createElement: () => new FakeElement(),
    querySelector(selector: string): FakeElement | null {
      if (selector.startsWith('#')) {
        const id = selector.slice(1)
        let element = ids.get(id)
        if (!element) {
          element = new FakeElement()
          element.classList.add('hidden')
          ids.set(id, element)
        }
        return element
      }
      if (selector === '.ctx') return body.children.find((child) => child.classList.contains('ctx')) ?? null
      return null
    },
  }
  const listeners = new Set<(event: MouseEvent) => void>()
  const window = {
    addEventListener: (_type: string, listener: (event: MouseEvent) => void, options?: { once?: boolean }) => {
      if (options?.once) {
        const once = (event: MouseEvent) => {
          listeners.delete(once)
          listener(event)
        }
        listeners.add(once)
      } else listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: (event: MouseEvent) => void) => listeners.delete(listener),
    dispatchMouseDown(target: unknown) {
      for (const listener of [...listeners]) listener({ target } as MouseEvent)
    },
    get listenerCount() {
      return listeners.size
    },
  }
  return { document, window }
}

type MenuInternals = {
  contextMenu(x: number, y: number, item: string, extra?: [string, () => void][]): void
  keysPage: { hide: ReturnType<typeof vi.fn> }
}

function bareMenu(): Menu {
  const menu = Object.create(Menu.prototype) as Menu
  Object.assign(menu, {
    send: { closePanel: vi.fn() },
    panels: { close: vi.fn(), onFrame: vi.fn() },
    ai: { stop: vi.fn() },
    contextPopup: new ContextMenu(),
    keysPage: { hide: vi.fn() },
    quests: { open: false },
    skillPanel: { open: false },
    profession: { open: false },
    showCarried: vi.fn(),
    render: vi.fn(),
    renderJournal: vi.fn(),
    picked: undefined,
    drag: undefined,
  })
  return menu
}

async function settleContextMenuTimer(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

afterEach(() => vi.unstubAllGlobals())

describe('inventory context menu lifecycle', () => {
  it('removes the popup and disables its old action when the owning panel closes', async () => {
    const dom = domHarness()
    vi.stubGlobal('document', dom.document)
    vi.stubGlobal('window', dom.window)
    const menu = bareMenu()
    const action = vi.fn()
    ;(menu as unknown as MenuInternals).contextMenu(30, 40, 'item/old', [['Drop', action]])
    await settleContextMenuTimer()
    const staleRow = dom.document.querySelector('.ctx')!.children[1]!

    menu.close()
    expect(dom.document.querySelector('.ctx')).toBeNull()
    expect(dom.window.listenerCount).toBe(0)
    expect((menu as unknown as MenuInternals).keysPage.hide).toHaveBeenCalledOnce()

    staleRow.click()
    expect(action).not.toHaveBeenCalled()
  })

  it('keeps outside dismissal available after a press inside the popup', async () => {
    const dom = domHarness()
    vi.stubGlobal('document', dom.document)
    vi.stubGlobal('window', dom.window)
    const menu = bareMenu()
    ;(menu as unknown as MenuInternals).contextMenu(30, 40, 'item/old')
    await settleContextMenuTimer()
    const popup = dom.document.querySelector('.ctx')!
    const row = popup.children[0]!

    dom.window.dispatchMouseDown(row)
    expect(dom.window.listenerCount).toBe(1)
    expect(dom.document.querySelector('.ctx')).toBe(popup)
    dom.window.dispatchMouseDown({})

    expect(dom.document.querySelector('.ctx')).toBeNull()
    expect(dom.window.listenerCount).toBe(0)
  })

  it('closes after choosing a row and runs its action only once', async () => {
    const dom = domHarness()
    vi.stubGlobal('document', dom.document)
    vi.stubGlobal('window', dom.window)
    const menu = bareMenu()
    const action = vi.fn()
    ;(menu as unknown as MenuInternals).contextMenu(30, 40, 'item/old', [['Drop', action]])
    await settleContextMenuTimer()
    const row = dom.document.querySelector('.ctx')!.children[1]!

    row.click()
    row.click()

    expect(action).toHaveBeenCalledOnce()
    expect(dom.document.querySelector('.ctx')).toBeNull()
    expect(dom.window.listenerCount).toBe(0)
  })

  it('does not retain window listeners across repeated panel closes and reopens', async () => {
    const dom = domHarness()
    vi.stubGlobal('document', dom.document)
    vi.stubGlobal('window', dom.window)
    const menu = bareMenu()
    const open = () => (menu as unknown as MenuInternals).contextMenu(30, 40, 'item/old')

    open()
    await settleContextMenuTimer()
    menu.close()
    open()
    await settleContextMenuTimer()

    expect(dom.window.listenerCount).toBe(1)
    menu.close()
    expect(dom.window.listenerCount).toBe(0)
  })

  it('closes the popup when switching to another menu tab', async () => {
    const dom = domHarness()
    vi.stubGlobal('document', dom.document)
    vi.stubGlobal('window', dom.window)
    const menu = bareMenu()
    ;(menu as unknown as MenuInternals).contextMenu(30, 40, 'item/old')
    await settleContextMenuTimer()

    menu.open('craft')

    expect(dom.document.querySelector('.ctx')).toBeNull()
    expect(dom.window.listenerCount).toBe(0)
  })

  it('closes the popup when opening the journal hides the bag', async () => {
    const dom = domHarness()
    vi.stubGlobal('document', dom.document)
    vi.stubGlobal('window', dom.window)
    const menu = bareMenu()
    ;(menu as unknown as MenuInternals).contextMenu(30, 40, 'item/old')
    await settleContextMenuTimer()

    menu.openJournal()

    expect(dom.document.querySelector('.ctx')).toBeNull()
    expect(dom.window.listenerCount).toBe(0)
    expect(dom.document.querySelector('#menu')!.classList.contains('hidden')).toBe(true)
    expect(dom.document.querySelector('#journal')!.classList.contains('hidden')).toBe(false)
  })

  it('closes the popup when the open chest disappears from the frame', async () => {
    const dom = domHarness()
    vi.stubGlobal('document', dom.document)
    vi.stubGlobal('window', dom.window)
    const menu = bareMenu()
    dom.document.querySelector('#chest')!.classList.remove('hidden')
    ;(menu as unknown as MenuInternals).contextMenu(30, 40, 'item/old')
    await settleContextMenuTimer()

    menu.onFrame({ container: undefined } as Frame)

    expect(dom.document.querySelector('.ctx')).toBeNull()
    expect(dom.window.listenerCount).toBe(0)
    expect(dom.document.querySelector('#chest')!.classList.contains('hidden')).toBe(true)
  })
})
