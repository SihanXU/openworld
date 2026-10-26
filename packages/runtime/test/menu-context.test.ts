import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Frame } from '@openworld/engine'
import { Menu } from '../src/ui/menu.ts'
import { ContextMenu } from '../src/ui/context-menu.ts'

vi.mock('phaser', () => ({ default: { Scene: class {} } }))

type Clickable = { onclick?: ((event: MouseEvent) => void) | null; onmousedown?: ((event: MouseEvent) => void) | null; oncontextmenu?: ((event: MouseEvent) => void) | null }

class FakeElement implements Clickable {
  readonly children: FakeElement[] = []
  readonly dataset: Record<string, string> = {}
  readonly style: Record<string, string> = {}
  private readonly matches = new Map<string, FakeElement[]>()
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
  onmousedown?: ((event: MouseEvent) => void) | null
  oncontextmenu?: ((event: MouseEvent) => void) | null
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
    return this.matches.get(selector) ?? (selector === '[data-k]' ? this.children.filter((child) => child.dataset.k !== undefined) : [])
  }

  setMatches(selector: string, elements: FakeElement[]): void {
    this.matches.set(selector, elements)
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
  wireInventory(frame?: Frame): void
  onMoveSlotResult(request: number, moved: boolean): void
  displaySlots(frame: Frame): Frame['player']['slots']
  slotHtml(slot: Frame['player']['slots'][number], index: number): string
  carried: { style: Record<string, string> }
  picked?: { slot: number; item: string; count: number; sourceCount: number }
  pendingMove?: { request: number }
}

function bareMenu(): Menu {
  const menu = Object.create(Menu.prototype) as Menu
  Object.assign(menu, {
    send: { closePanel: vi.fn(), cancelCraft: vi.fn(), moveSlot: vi.fn(), drop: vi.fn(), quickMove: vi.fn(), wear: vi.fn() },
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
    moveRequest: 0,
    carried: new FakeElement(),
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
  it.each([
    { sourceCount: 5, pickedCount: 3, remainder: '2' },
    { sourceCount: 6, pickedCount: 3, remainder: '3' },
    { sourceCount: 1, pickedCount: 1, remainder: undefined },
  ])('renders only the unpicked source remainder for $sourceCount items', ({ sourceCount, pickedCount, remainder }) => {
    const menu = bareMenu() as unknown as MenuInternals
    const frame = { player: { slots: [
      { item: { id: 'stone-0', type: 'item/material/stone', stackKey: 'stone-key', tags: [], props: {} }, count: sourceCount },
    ] } } as unknown as Frame
    menu.picked = { slot: 0, item: 'stone-0', count: pickedCount, sourceCount }

    const html = menu.slotHtml(menu.displaySlots(frame)[0]!, 10)

    if (remainder) expect(html).toContain(`<span class="count">${remainder}</span>`)
    else expect(html).not.toContain('data-icon=')
    expect(frame.player.slots[0]?.count).toBe(sourceCount)
  })

  it('Shift+right click picks the rounded-up half, while right click keeps the context menu', () => {
    const dom = domHarness()
    vi.stubGlobal('document', dom.document)
    const sheet = dom.document.querySelector('#menuSheet') as FakeElement
    const slot = new FakeElement()
    slot.dataset.i = '0'
    sheet.setMatches('.inv [data-i]', [slot])
    sheet.setMatches('[data-wear]', [])
    const menu = bareMenu()
    const contextMenu = vi.fn()
    const drop = vi.fn()
    Object.assign(menu, {
      send: { closePanel: vi.fn(), cancelCraft: vi.fn(), moveSlot: vi.fn(), drop, quickMove: vi.fn(), wear: vi.fn() },
      frame: { player: { slots: [{ item: { id: 'stone', type: 'item/material/stone', stackKey: 'stone-key', props: {} }, count: 5 }], worn: {} } } as Frame,
      contextMenu,
    })
    ;(menu as unknown as MenuInternals).wireInventory((menu as unknown as { frame: Frame }).frame)

    slot.oncontextmenu?.({ preventDefault: vi.fn(), shiftKey: true, clientX: 10, clientY: 20 } as unknown as MouseEvent)

    expect((menu as unknown as MenuInternals).picked).toEqual({ slot: 0, item: 'stone', count: 3, sourceCount: 5 })
    expect((menu as unknown as MenuInternals).carried.style.transform).toBe('translate(-6px, 4px)')
    expect(contextMenu).not.toHaveBeenCalled()

    slot.oncontextmenu?.({ preventDefault: vi.fn(), shiftKey: false, clientX: 10, clientY: 20 } as unknown as MouseEvent)

    expect(contextMenu).toHaveBeenCalledOnce()
    expect((menu as unknown as MenuInternals).picked).toBeUndefined()
    const extras = contextMenu.mock.calls[0]?.[3] as [string, () => void][]
    extras.at(-1)?.[1]()
    expect(drop).toHaveBeenCalledWith(0, true, { item: 'stone', count: 5, sourceCount: 5 })

    slot.onmousedown?.({ button: 0, preventDefault: vi.fn(), clientX: 100, clientY: 200 } as unknown as MouseEvent)
    expect((menu as unknown as MenuInternals).picked).toEqual({ slot: 0, item: 'stone', count: 5, sourceCount: 5 })
    expect((menu as unknown as MenuInternals).carried.style.transform).toBe('translate(84px, 184px)')
  })

  it('sends the picked count to an empty slot and cancels when the source is clicked', () => {
    const dom = domHarness()
    vi.stubGlobal('document', dom.document)
    const sheet = dom.document.querySelector('#menuSheet') as FakeElement
    const source = new FakeElement()
    const target = new FakeElement()
    source.dataset.i = '0'
    target.dataset.i = '1'
    sheet.setMatches('.inv [data-i]', [source, target])
    sheet.setMatches('[data-wear]', [])
    const menu = bareMenu()
    const moveSlot = vi.fn()
    Object.assign(menu, {
      send: { closePanel: vi.fn(), cancelCraft: vi.fn(), moveSlot, drop: vi.fn(), quickMove: vi.fn(), wear: vi.fn() },
      frame: { player: { slots: [
        { item: { id: 'stone', type: 'item/material/stone', stackKey: 'stone-key', props: {} }, count: 5 },
        null,
      ], worn: {} } } as Frame,
    })
    ;(menu as unknown as MenuInternals).wireInventory((menu as unknown as { frame: Frame }).frame)

    source.oncontextmenu?.({ preventDefault: vi.fn(), shiftKey: true } as unknown as MouseEvent)
    target.onmousedown?.({ button: 0, preventDefault: vi.fn() } as unknown as MouseEvent)

    expect(moveSlot).toHaveBeenCalledWith(1, 0, 1, 'stone', 3, 5)
    expect((menu as unknown as MenuInternals).picked).toMatchObject({ slot: 0, item: 'stone', count: 3, sourceCount: 5 })

    source.onmousedown?.({ button: 0, preventDefault: vi.fn() } as unknown as MouseEvent)
    expect((menu as unknown as MenuInternals).picked).toBeUndefined()
  })

  it('keeps an incompatible partial selection on the cursor and returns it when the bag closes', () => {
    const dom = domHarness()
    vi.stubGlobal('document', dom.document)
    const sheet = dom.document.querySelector('#menuSheet') as FakeElement
    const source = new FakeElement()
    const target = new FakeElement()
    source.dataset.i = '0'
    target.dataset.i = '1'
    sheet.setMatches('.inv [data-i]', [source, target])
    sheet.setMatches('[data-wear]', [])
    const menu = bareMenu()
    const moveSlot = vi.fn()
    Object.assign(menu, {
      send: { closePanel: vi.fn(), cancelCraft: vi.fn(), moveSlot, drop: vi.fn(), quickMove: vi.fn(), wear: vi.fn() },
      frame: { player: { slots: [
        { item: { id: 'stone', type: 'item/material/stone', stackKey: 'stone-key', props: {} }, count: 5 },
        { item: { id: 'bread', type: 'item/food/bread', stackKey: 'bread-key', props: {} }, count: 1 },
      ], worn: {} } } as Frame,
    })
    ;(menu as unknown as MenuInternals).wireInventory((menu as unknown as { frame: Frame }).frame)

    source.oncontextmenu?.({ preventDefault: vi.fn(), shiftKey: true } as unknown as MouseEvent)
    target.onmousedown?.({ button: 0, preventDefault: vi.fn() } as unknown as MouseEvent)

    expect(moveSlot).not.toHaveBeenCalled()
    expect((menu as unknown as MenuInternals).picked).toMatchObject({ item: 'stone', count: 3, sourceCount: 5 })

    menu.close()
    expect((menu as unknown as MenuInternals).picked).toBeUndefined()
    expect(moveSlot).not.toHaveBeenCalled()
  })

  it('waits for the matching acknowledgement, then settles on the first authoritative frame', () => {
    const dom = domHarness()
    vi.stubGlobal('document', dom.document)
    const sheet = dom.document.querySelector('#menuSheet') as FakeElement
    const source = new FakeElement()
    const target = new FakeElement()
    source.dataset.i = '0'
    target.dataset.i = '1'
    sheet.setMatches('.inv [data-i]', [source, target])
    sheet.setMatches('[data-wear]', [])
    const menu = bareMenu()
    const moveSlot = vi.fn()
    const sword = { id: 'sword', type: 'item/weapon/blade/sword', stackKey: 'sword-key', props: { slot: 'weapon' }, tags: [] }
    const initial = { player: { slots: [
      { item: sword, count: 1 },
      null,
    ], worn: {} } } as unknown as Frame
    Object.assign(menu, {
      send: { closePanel: vi.fn(), cancelCraft: vi.fn(), moveSlot, drop: vi.fn(), quickMove: vi.fn(), wear: vi.fn() },
      frame: initial,
    })
    ;(menu as unknown as MenuInternals).wireInventory(initial)

    source.oncontextmenu?.({ preventDefault: vi.fn(), shiftKey: true } as unknown as MouseEvent)
    target.onmousedown?.({ button: 0, preventDefault: vi.fn() } as unknown as MouseEvent)
    expect(moveSlot).toHaveBeenCalledWith(1, 0, 1, 'sword', 1, 1)

    const stale = { player: { slots: [...initial.player.slots], worn: {} } } as Frame
    menu.onFrame(stale)
    expect((menu as unknown as MenuInternals).picked).toMatchObject({ item: 'sword', count: 1 })
    expect((menu as unknown as MenuInternals).pendingMove).toMatchObject({ request: 1 })

    ;(menu as unknown as MenuInternals).onMoveSlotResult(1, true)
    expect((menu as unknown as MenuInternals).picked).toMatchObject({ item: 'sword', count: 1 })
    const laterAction = { player: { slots: [null, null], worn: { weapon: sword } } } as unknown as Frame
    menu.onFrame(laterAction)

    expect((menu as unknown as MenuInternals).picked).toBeUndefined()
    expect((menu as unknown as MenuInternals).pendingMove).toBeUndefined()
  })

  it('keeps a rejected move on the cursor and ignores acknowledgements for older requests', () => {
    const dom = domHarness()
    vi.stubGlobal('document', dom.document)
    const sheet = dom.document.querySelector('#menuSheet') as FakeElement
    const source = new FakeElement()
    const target = new FakeElement()
    source.dataset.i = '0'
    target.dataset.i = '1'
    sheet.setMatches('.inv [data-i]', [source, target])
    sheet.setMatches('[data-wear]', [])
    const menu = bareMenu()
    const moveSlot = vi.fn()
    const initial = { player: { slots: [
      { item: { id: 'stone', type: 'item/material/stone', stackKey: 'stone-key', props: {} }, count: 5 },
      null,
    ], worn: {} } } as Frame
    Object.assign(menu, {
      send: { closePanel: vi.fn(), cancelCraft: vi.fn(), moveSlot, drop: vi.fn(), quickMove: vi.fn(), wear: vi.fn() },
      frame: initial,
    })
    const internals = menu as unknown as MenuInternals
    internals.wireInventory(initial)

    source.oncontextmenu?.({ preventDefault: vi.fn(), shiftKey: true } as unknown as MouseEvent)
    target.onmousedown?.({ button: 0, preventDefault: vi.fn() } as unknown as MouseEvent)
    menu.onFrame({ player: { slots: [...initial.player.slots], worn: {} } } as Frame)
    internals.onMoveSlotResult(99, true)
    expect(internals.pendingMove).toMatchObject({ request: 1 })

    internals.onMoveSlotResult(1, false)
    expect(internals.picked).toMatchObject({ item: 'stone', count: 3, sourceCount: 5 })
    expect(internals.pendingMove).toBeUndefined()
  })

  it('clears a pending cursor selection before organizing slot indices', () => {
    const dom = domHarness()
    vi.stubGlobal('document', dom.document)
    const sheet = dom.document.querySelector('#menuSheet') as FakeElement
    const source = new FakeElement()
    const target = new FakeElement()
    source.dataset.i = '0'
    target.dataset.i = '1'
    sheet.setMatches('.inv [data-i]', [source, target])
    sheet.setMatches('[data-wear]', [])
    const menu = bareMenu()
    const organize = vi.fn()
    Object.assign(menu, {
      send: { closePanel: vi.fn(), cancelCraft: vi.fn(), moveSlot: vi.fn(), drop: vi.fn(), quickMove: vi.fn(), wear: vi.fn(), organize },
      frame: { player: { slots: [
        { item: { id: 'stone', type: 'item/material/stone', stackKey: 'stone-key', props: {} }, count: 5 },
        null,
      ], worn: {} } } as Frame,
    })
    const internals = menu as unknown as MenuInternals
    internals.wireInventory((menu as unknown as { frame: Frame }).frame)

    source.oncontextmenu?.({ preventDefault: vi.fn(), shiftKey: true } as unknown as MouseEvent)
    target.onmousedown?.({ button: 0, preventDefault: vi.fn() } as unknown as MouseEvent)
    dom.document.querySelector('#bOrganize')!.click()

    expect(internals.picked).toBeUndefined()
    expect(internals.pendingMove).toBeUndefined()
    expect(organize).toHaveBeenCalledOnce()
  })

  it.each(['close', 'open', 'openJournal'] as const)('cancels a batch on %s even before its first progress frame', (action) => {
    const dom = domHarness()
    vi.stubGlobal('document', dom.document)
    const menu = bareMenu()
    const cancelCraft = vi.fn()
    Object.assign(menu, { send: { cancelCraft, closePanel: vi.fn() } })
    menu[action]()
    expect(cancelCraft).toHaveBeenCalledOnce()
  })

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
