// The game menu (Esc), the journal (J) and the chest panel — design.md §5.3: a menu with two
// tabs (Inventory, Options); the journal holds the objective and the Threadbook (every thread
// the world has learned, and whose act taught it); the chest's grid above the bag, a click
// moving a stack to the other side.

import type { Frame, ItemInfo, Key, Rule } from '@lsw/engine'
import { OBJECTIVES } from '@lsw/content'
import type { LibraryView } from '../protocol.ts'
import { $, SLOT_KEYS, controlsTable, esc, locale, t, tx } from './common.ts'

export type Tab = 'inventory' | 'options'
const TABS: Tab[] = ['inventory', 'options']
const ICONS: Record<Tab, string> = { inventory: '🎒', options: '⚙' }
const ROW = SLOT_KEYS.length

export interface MenuSend {
  swap(a: number, b: number): void
  drop(slot: number, all: boolean): void
  organize(): void
  transfer(from: 'chest' | 'bag', item: string, all: boolean): void
  closePanel(): void
  save(): void
  newGame(): void
  toggleLocale(): void
  toggleSound(): void
  devConsole?(): void
  /** One of the inputs on an item in the bag or the open chest (the context menu). */
  keyOnItem(key: Key, item: string): void
}

export class Menu {
  tab: Tab = 'inventory'
  library?: LibraryView
  muted = false
  paintIcons?: (items: ItemInfo[]) => void
  facesetOf?: (id: string) => HTMLCanvasElement | undefined
  private frame?: Frame
  /** The inventory slot picked up by a click (placed by the next click). */
  private picked?: number

  constructor(private send: MenuSend) {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="menu" class="overlay hidden"><div class="sheet wood" id="menuSheet"></div></div>
       <div id="journal" class="overlay hidden"><div class="sheet paper" id="journalSheet"></div></div>
       <div id="chest" class="overlay hidden"><div class="sheet wood" id="chestSheet"></div></div>`,
    )
    // a click on the backdrop closes (or, holding a stack, drops it)
    for (const id of ['menu', 'journal', 'chest'])
      $(`#${id}`).addEventListener('mousedown', (e) => {
        if (e.target !== e.currentTarget) return
        if (id === 'menu' && this.picked !== undefined) return void (this.send.drop(this.picked, true), (this.picked = undefined), this.render())
        this.close()
      })
  }

  get menuOpen(): boolean {
    return !$('#menu').classList.contains('hidden')
  }
  get journalOpen(): boolean {
    return !$('#journal').classList.contains('hidden')
  }
  get chestOpen(): boolean {
    return !$('#chest').classList.contains('hidden')
  }
  get anyOpen(): boolean {
    return this.menuOpen || this.journalOpen || this.chestOpen
  }

  open(tab?: Tab): void {
    if (tab) this.tab = tab
    $('#journal').classList.add('hidden')
    $('#menu').classList.remove('hidden')
    this.picked = undefined
    this.render()
  }

  toggle(tab?: Tab): void {
    if (this.menuOpen && (!tab || tab === this.tab)) this.close()
    else this.open(tab)
  }

  openJournal(): void {
    $('#menu').classList.add('hidden')
    $('#journal').classList.toggle('hidden')
    if (this.journalOpen) this.renderJournal()
  }

  close(): void {
    if (this.chestOpen) this.send.closePanel()
    for (const id of ['#menu', '#journal', '#chest']) $(id).classList.add('hidden')
    this.picked = undefined
  }

  onFrame(f: Frame): void {
    this.frame = f
    // the chest panel follows the open container the worker names
    if (f.container && !this.chestOpen) ($('#chest').classList.remove('hidden'), (this.chestSig = ''))
    if (!f.container && this.chestOpen) $('#chest').classList.add('hidden')
    if (this.chestOpen) this.renderChest(f)
    if (this.menuOpen && this.tab === 'inventory') this.renderLive()
    if (this.journalOpen && this.library && this.library.version !== this.journalLib) this.renderJournal()
  }

  // ---------------------------------------------------------------- the menu

  private liveSig = ''
  private renderLive(): void {
    const f = this.frame
    if (!f) return
    const sig = this.sigOf(f)
    if (sig === this.liveSig) return
    this.render()
  }

  render(): void {
    const f = this.frame
    this.liveSig = ''
    const head = `<div class="tabs-row">${TABS.map((k) => `<button class="tab${k === this.tab ? ' on' : ''}" data-tab="${k}" title="${t(k)}">${ICONS[k]} <span>${t(k)}</span></button>`).join('')}<button class="x" id="menuClose">✕</button></div>`
    let body = ''
    if (this.tab === 'inventory') body = this.inventoryHtml(f)
    if (this.tab === 'options') body = this.optionsHtml()
    $('#menuSheet').innerHTML = head + `<div class="tab-body">${body}</div>`
    $('#menuSheet').querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => (b.onclick = () => this.open(b.dataset.tab as Tab)))
    $('#menuClose').onclick = () => this.close()
    if (this.tab === 'inventory') this.wireInventory(f)
    if (this.tab === 'options') this.wireOptions()
    if (f) {
      this.liveSig = this.sigOf(f)
      if (this.tab === 'inventory') this.paintIcons?.(f.player.slots.filter(Boolean).map((s) => s!.item))
    }
  }

  private sigOf(f: Frame): string {
    return `${this.tab}|${locale.value}|${JSON.stringify(f.player.slots.map((s) => s && [s.item.id, s.count]))}|${this.picked}`
  }

  // ---------------------------------------------------------------- inventory

  private slotHtml(s: Frame['player']['slots'][number], i: number, extra = ''): string {
    const key = i < ROW ? `<span class="key">${SLOT_KEYS[i]}</span>` : ''
    return `<div class="slot${extra}" data-i="${i}" ${s ? `data-tip="${esc(tipOf(s.item))}"` : ''}>${key}${s ? `<div class="icon" data-icon="${s.item.id}"></div>${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}` : ''}</div>`
  }

  private inventoryHtml(f?: Frame): string {
    if (!f) return ''
    const slots = f.player.slots
    const rows = `<div class="grid-row toolbar-row">${slots.slice(0, ROW).map((s, j) => this.slotHtml(s, j, (j === this.picked ? ' picked' : '') + (j === f.player.selected ? ' sel' : ''))).join('')}</div>`
    const zh = locale.value === 'zh'
    return `<div class="inv">${rows}</div>
      <div class="inv-foot">
        <button id="bOrganize">⇅ ${t('organize')}</button>
        <button id="bDrop" ${this.picked === undefined ? 'disabled' : ''}>⤓ ${t('dropHere')}</button>
        <span class="muted small">${zh ? '点击拿起、再点击交换 · “丢下”放到面前 · 右键：对它用手上的东西、放进去、空手摆弄' : 'Click to pick up, again to swap · Drop sets it down in front · right click: use or put the held thing on it, or handle it'}</span>
      </div>
      <div class="tip hidden" id="tip"></div>`
  }

  private wireInventory(f?: Frame): void {
    if (!f) return
    const slots = f.player.slots
    $('#bOrganize').onclick = () => this.send.organize()
    $('#bDrop').onclick = () => {
      if (this.picked === undefined) return
      this.send.drop(this.picked, true)
      this.picked = undefined
      this.render()
    }
    $('#menuSheet').querySelectorAll<HTMLElement>('.inv [data-i]').forEach((el) => {
      const i = Number(el.dataset.i)
      el.onclick = () => {
        if (this.picked === undefined) {
          if (slots[i]) this.picked = i
        } else {
          this.send.swap(this.picked, i)
          this.picked = undefined
        }
        this.render()
      }
      el.onmouseenter = () => {
        const tip = $('#tip')
        if (!el.dataset.tip) return tip.classList.add('hidden')
        tip.textContent = el.dataset.tip
        tip.classList.remove('hidden')
        const r = el.getBoundingClientRect()
        tip.style.left = `${r.left + r.width / 2}px`
        tip.style.top = `${r.top - 6}px`
      }
      el.onmouseleave = () => $('#tip').classList.add('hidden')
      // right click: the context menu — this item as the target of the held thing or a bare hand
      el.oncontextmenu = (e) => {
        e.preventDefault()
        const s = slots[i]
        if (!s) return
        this.contextMenu(e.clientX, e.clientY, s.item.id, [[t('dropHere'), () => this.send.drop(i, true)]])
      }
    })
  }

  /** The context menu on an item: use the held thing on it, put the held thing into it, handle it bare-handed — and extras. */
  private contextMenu(x: number, y: number, item: string, extra: [string, () => void][] = []): void {
    document.querySelector('.ctx')?.remove()
    const held = this.frame?.player.held
    const heldName = held ? tx(held.name) : ''
    const rows: [string, () => void][] = []
    if (held && held.id !== item) {
      rows.push([t('useOn').replace('{held}', heldName), () => this.send.keyOnItem('use', item)])
      rows.push([t('putIn').replace('{held}', heldName), () => this.send.keyOnItem('put', item)])
    }
    rows.push([t('handsOn'), () => this.send.keyOnItem('hands', item)], ...extra)
    const el = document.createElement('div')
    el.className = 'ctx'
    el.innerHTML = rows.map(([l], k) => `<div class="ctx-row" data-k="${k}">${esc(l)}</div>`).join('')
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    document.body.appendChild(el)
    el.querySelectorAll<HTMLElement>('[data-k]').forEach((r) => (r.onclick = () => (el.remove(), rows[Number(r.dataset.k)][1]())))
    setTimeout(() => window.addEventListener('mousedown', (ev) => !el.contains(ev.target as Node) && el.remove(), { once: true }), 0)
  }

  // ---------------------------------------------------------------- options

  private optionsHtml(): string {
    return `<div class="options">
      <div class="opt"><span>${t('language')}</span><button id="oLang">${locale.value === 'zh' ? '中文 → English' : 'English → 中文'}</button></div>
      <div class="opt"><span>${t('sound')}</span><button id="oSound">${this.muted ? t('off') : t('on')}</button></div>
      <div class="opt"><button id="oSave">${t('save')}</button><button id="oNew">${t('newGame')}</button>${import.meta.env.DEV ? `<button id="oDev">${t('devConsole')}</button>` : ''}</div>
      <h4>${t('controls')}</h4>${controlsTable(import.meta.env.DEV)}
    </div>`
  }

  private wireOptions(): void {
    $('#oLang').onclick = () => (this.send.toggleLocale(), this.render())
    $('#oSound').onclick = () => (this.send.toggleSound(), (this.muted = !this.muted), this.render())
    $('#oSave').onclick = () => this.send.save()
    $('#oNew').onclick = () => confirm(t('confirmNew')) && (this.close(), this.send.newGame())
    document.querySelector<HTMLButtonElement>('#oDev')?.addEventListener('click', () => (this.close(), this.send.devConsole?.()))
  }

  // ---------------------------------------------------------------- the journal: the objective and the Threadbook

  private journalLib = -1
  renderJournal(): void {
    const f = this.frame
    const stage = Number(f?.player.props.quest ?? -1)
    const now = OBJECTIVES[stage]
    const past = Object.entries(OBJECTIVES)
      .filter(([k]) => Number(k) > 0 && Number(k) < stage)
      .map(([, o]) => tx(o.title))
    this.journalLib = this.library?.version ?? -1
    $('#journalSheet').innerHTML = `
      <div class="jhead"><b>${t('journal')}</b><button class="x" id="jClose">✕</button></div>
      ${now && tx(now.title) ? `<div class="jnow"><div class="small muted">${t('objective')}</div><div class="jtitle">${esc(tx(now.title))}</div><div class="jhint">${esc(tx(now.hint))}</div></div>` : ''}
      ${past.length ? `<div class="small muted">${t('done')}</div><ul class="jpast">${past.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      <div class="small muted">${t('threads')}</div>${this.threadsHtml()}`
    $('#jClose').onclick = () => this.close()
  }

  /** Every thread the world has learned, newest first, and whose act taught it (design.md §5.9). */
  private threadsHtml(): string {
    const threads = [...(this.library?.patches ?? [])].reverse()
    if (!threads.length) return `<div class="muted pad">${t('noThreads')}</div>`
    return `<div class="threads">${threads
      .map((r: Rule) => {
        const by = r.source?.trigger === 'world' ? t('world') : t('you')
        return `<div class="thread"><div>${esc(r.doc ?? r.id.replace(/^patch\//, '').replace(/-/g, ' '))}</div><div class="muted small">${t('wovenBy')}: ${by}${r.source?.at ? ` · ${esc(r.source.at.slice(0, 10))}` : ''}</div></div>`
      })
      .join('')}</div>`
  }

  // ---------------------------------------------------------------- the chest panel

  private chestSig = ''
  private renderChest(f: Frame): void {
    const c = f.container
    if (!c) return
    const sig = `${locale.value}|${c.id}|${c.contents.map((i) => i.id + i.type + i.statuses.join()).join(',')}|${JSON.stringify(f.player.slots.map((s) => s && [s.item.id, s.count]))}`
    if (sig === this.chestSig) return
    this.chestSig = sig
    const stacks = stackItems(c.contents)
    const cap = Math.max(c.capacity ?? 12, stacks.length)
    const chestCells = Array.from({ length: Math.ceil(cap / ROW) * ROW }, (_, i) => {
      const s = stacks[i]
      return `<div class="slot${i >= cap ? ' off' : ''}" ${s ? `data-c="${s[0].id}" data-tip="${esc(tipOf(s[0]))}"` : ''}>${s ? `<div class="icon" data-icon="${s[0].id}"></div>${s.length > 1 ? `<span class="count">${s.length}</span>` : ''}` : ''}</div>`
    })
    const bag = f.player.slots.slice(0, ROW)
    const zh = locale.value === 'zh'
    $('#chestSheet').innerHTML = `
      <div class="jhead"><b>${esc(tx(c.name))}</b><span class="muted small">${c.contents.length} / ${c.capacity ?? '∞'}</span><button class="x" id="cClose">✕</button></div>
      <div class="inv chest-grid">${chunk(chestCells, ROW).map((r) => `<div class="grid-row">${r.join('')}</div>`).join('')}</div>
      <div class="inv-foot"><button id="cFill">⇣ ${t('fillStacks')}</button><button id="cOrg">⇅ ${t('organize')}</button><span class="muted small">${zh ? '点击：整堆移到另一边 · Shift+点击：移一个 · 右键：更多' : 'Click: the stack across · Shift+click: one · right click: more'}</span></div>
      <div class="inv bag-grid"><div class="grid-row toolbar-row">${bag.map((s, j) => (s ? `<div class="slot" data-b="${s.item.id}" data-tip="${esc(tipOf(s.item))}"><div class="icon" data-icon="${s.item.id}"></div>${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}</div>` : `<div class="slot" data-i="${j}"></div>`)).join('')}</div></div>`
    const sheet = $('#chestSheet')
    $('#cClose').onclick = () => this.close()
    const move = (from: 'chest' | 'bag', id: string, all: boolean) => this.send.transfer(from, id, all)
    // click: the stack across; Shift+click: one; right click: the context menu
    sheet.querySelectorAll<HTMLElement>('[data-c]').forEach((el) => {
      el.onclick = (e) => move('chest', el.dataset.c!, !e.shiftKey)
      el.oncontextmenu = (e) => (e.preventDefault(), this.contextMenu(e.clientX, e.clientY, el.dataset.c!, [[t('moveOne'), () => move('chest', el.dataset.c!, false)]]))
    })
    sheet.querySelectorAll<HTMLElement>('[data-b]').forEach((el) => {
      el.onclick = (e) => move('bag', el.dataset.b!, !e.shiftKey)
      el.oncontextmenu = (e) => (e.preventDefault(), this.contextMenu(e.clientX, e.clientY, el.dataset.b!, [[t('moveOne'), () => move('bag', el.dataset.b!, false)]]))
    })
    $('#cOrg').onclick = () => this.send.organize()
    $('#cFill').onclick = () => {
      // every bag stack whose kind the chest already holds goes in
      const inChest = new Set(stacks.map((s) => keyOf(s[0])))
      for (const s of bag) if (s && inChest.has(keyOf(s.item))) move('bag', s.item.id, true)
    }
    this.paintIcons?.([...stacks.map((s) => s[0]), ...bag.filter(Boolean).map((s) => s!.item)])
  }
}

function keyOf(it: ItemInfo): string {
  return JSON.stringify([it.type, it.name, [...it.tags].sort(), [...it.statuses].sort()])
}

function stackItems(items: ItemInfo[]): ItemInfo[][] {
  const by = new Map<string, ItemInfo[]>()
  for (const it of items) by.set(keyOf(it), [...(by.get(keyOf(it)) ?? []), it])
  return [...by.values()]
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n))
  return out
}

/** A tooltip: the name and what it is in plain words (its kind and a few telling tags). */
function tipOf(it: ItemInfo): string {
  const plain = it.tags.filter((g) => !g.includes(':') && !['item', 'portable'].includes(g)).slice(0, 4)
  return `${tx(it.name)}${plain.length ? ` · ${plain.join(', ')}` : ''}${it.statuses.length ? ` · ${it.statuses.join(', ')}` : ''}`
}
