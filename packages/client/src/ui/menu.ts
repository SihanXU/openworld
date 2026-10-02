// The game menu (Esc / E), the journal (F) and the chest panel — design.md §5.3, after
// Stardew Valley: one menu with tabs (Inventory, Social, Map, Threadbook, Letters, Options);
// the chest's grid above the bag's grid, a click moving a stack to the other side.

import type { Frame, ItemInfo, MapData, Rule } from '@lsw/engine'
import { FORM_BY_ID, OBJECTIVES, TERRAINS } from '@lsw/content'
import type { LibraryView } from '../protocol.ts'
import { $, SEASON_ZH, SLOT_KEYS, TASTE_ZH, cap, controlsTable, esc, locale, t, tx } from './common.ts'

export type Tab = 'inventory' | 'social' | 'map' | 'threads' | 'letters' | 'options'
const TABS: Tab[] = ['inventory', 'social', 'map', 'threads', 'letters', 'options']
const ICONS: Record<Tab, string> = { inventory: '🎒', social: '♥', map: '🗺', threads: '❦', letters: '✉', options: '⚙' }

export interface MenuSend {
  swap(a: number, b: number): void
  drop(slot: number, all: boolean): void
  organize(): void
  transfer(from: 'chest' | 'bag', item: string, all: boolean): void
  closePanel(): void
  readMail(id: string): void
  save(): void
  newGame(): void
  toggleLocale(): void
  toggleSound(): void
  devConsole?(): void
}

const COLOR: Record<string, string> = Object.fromEntries(TERRAINS.map((x) => [x.id, (x as { color?: string }).color ?? '#000']))

export class Menu {
  tab: Tab = 'inventory'
  library?: LibraryView
  muted = false
  paintIcons?: (items: ItemInfo[]) => void
  facesetOf?: (id: string) => HTMLCanvasElement | undefined
  currentMap?: () => MapData | undefined
  private frame?: Frame
  /** The inventory slot picked up by a click (placed by the next click). */
  private picked?: number
  private openLetter?: string

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
    if (this.menuOpen && (this.tab === 'inventory' || this.tab === 'social' || this.tab === 'letters')) this.renderLive()
  }

  // ---------------------------------------------------------------- the menu

  private liveSig = ''
  private renderLive(): void {
    const f = this.frame
    if (!f) return
    const sig = `${this.tab}|${locale.value}|${JSON.stringify(f.player.slots.map((s) => s && [s.item.id, s.count]))}|${JSON.stringify(f.social)}|${JSON.stringify(f.mailbox)}|${this.picked}|${this.openLetter}`
    if (sig === this.liveSig) return
    this.render()
  }

  render(): void {
    const f = this.frame
    this.liveSig = ''
    const head = `<div class="tabs-row">${TABS.map((k) => `<button class="tab${k === this.tab ? ' on' : ''}" data-tab="${k}" title="${t(k)}">${ICONS[k]} <span>${t(k)}</span></button>`).join('')}<button class="x" id="menuClose">✕</button></div>`
    let body = ''
    if (this.tab === 'inventory') body = this.inventoryHtml(f)
    if (this.tab === 'social') body = this.socialHtml(f)
    if (this.tab === 'map') body = `<div class="mapwrap"><canvas id="minimap"></canvas><div class="muted small" id="mapLegend"></div></div>`
    if (this.tab === 'threads') body = this.threadsHtml()
    if (this.tab === 'letters') body = this.lettersHtml(f)
    if (this.tab === 'options') body = this.optionsHtml()
    $('#menuSheet').innerHTML = head + `<div class="tab-body">${body}</div>`
    $('#menuSheet').querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => (b.onclick = () => this.open(b.dataset.tab as Tab)))
    $('#menuClose').onclick = () => this.close()
    if (this.tab === 'inventory') this.wireInventory(f)
    if (this.tab === 'map') this.drawMap(f)
    if (this.tab === 'letters') this.wireLetters(f)
    if (this.tab === 'options') this.wireOptions()
    if (this.tab === 'social') this.paintIcons?.([])
    if (f) {
      this.liveSig = `${this.tab}|${locale.value}|${JSON.stringify(f.player.slots.map((s) => s && [s.item.id, s.count]))}|${JSON.stringify(f.social)}|${JSON.stringify(f.mailbox)}|${this.picked}|${this.openLetter}`
      if (this.tab === 'inventory') this.paintIcons?.(f.player.slots.filter(Boolean).map((s) => s!.item))
    }
  }

  // ---------------------------------------------------------------- inventory

  private slotHtml(s: Frame['player']['slots'][number], i: number, extra = ''): string {
    const key = i < 12 ? `<span class="key">${SLOT_KEYS[i]}</span>` : ''
    return `<div class="slot${extra}" data-i="${i}" ${s ? `data-tip="${esc(tipOf(s.item))}"` : ''}>${key}${s ? `<div class="icon" data-icon="${s.item.id}"></div>${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}` : ''}</div>`
  }

  private inventoryHtml(f?: Frame): string {
    if (!f) return ''
    const slots = f.player.slots
    const rows = [0, 1, 2].map((r) => `<div class="grid-row${r === 0 ? ' toolbar-row' : ''}">${slots.slice(r * 12, r * 12 + 12).map((s, j) => this.slotHtml(s, r * 12 + j, (r * 12 + j === this.picked ? ' picked' : '') + (r * 12 + j === f.player.selected ? ' sel' : ''))).join('')}</div>`).join('')
    const zh = locale.value === 'zh'
    return `<div class="inv">${rows}</div>
      <div class="inv-foot">
        <button id="bOrganize">⇅ ${t('organize')}</button>
        <span class="muted small">${zh ? '点击拿起、再点击放下或交换 · Shift+点击在快捷栏与背包间移动 · 拿着东西点空白处丢下' : 'Click to pick up, click again to place or swap · Shift+click moves between the toolbar and the bag · click outside to drop'}</span>
      </div>
      <div class="tip hidden" id="tip"></div>`
  }

  private wireInventory(f?: Frame): void {
    if (!f) return
    const slots = f.player.slots
    $('#bOrganize').onclick = () => this.send.organize()
    $('#menuSheet').querySelectorAll<HTMLElement>('.inv [data-i]').forEach((el) => {
      const i = Number(el.dataset.i)
      el.onclick = (e) => {
        if (e.shiftKey && slots[i]) {
          // Shift: the toolbar row ↔ the rest of the bag, into the first empty slot
          const range = i < 12 ? [12, 36] : [0, 12]
          const to = slots.findIndex((s, j) => !s && j >= range[0] && j < range[1])
          if (to >= 0) this.send.swap(i, to)
          return
        }
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
    })
  }

  // ---------------------------------------------------------------- social

  private socialHtml(f?: Frame): string {
    if (!f) return ''
    const zh = locale.value === 'zh'
    const people = [...f.social].sort((a, b) => Number(b.met) - Number(a.met) || b.points - a.points)
    return `<div class="social">${people
      .map((p) => {
        const h = Math.floor(p.points / 250)
        const hearts = Array.from({ length: 10 }, (_, i) => `<span class="${i < h ? 'h on' : 'h'}">♥</span>`).join('')
        const gifts = [0, 1].map((i) => `<span class="gbox${i < p.giftsWeek ? ' on' : ''}"></span>`).join('')
        const log = Object.entries(p.tasted)
          .map(([type, taste]) => `<span class="taste t-${taste}" title="${esc(zh ? TASTE_ZH[taste] ?? taste : taste)}">${esc(itemName(type))}</span>`)
          .join('')
        const bd = p.birthday ? `${zh ? SEASON_ZH[p.birthday.season] : cap(p.birthday.season)} ${p.birthday.day}` : ''
        return `<div class="person${p.met ? '' : ' unmet'}">
          <div class="face" data-look="${esc(p.look ?? '')}"></div>
          <div class="pinfo"><div class="pname">${esc(tx(p.name))}${p.talkedToday ? ` <span class="talked" title="${t('talkedToday')}">💬</span>` : ''}</div>
            ${p.met ? `<div class="hearts">${hearts}</div>` : `<div class="muted small">${t('notMet')}</div>`}
            ${log ? `<div class="glog"><span class="muted small">${t('giftLog')}:</span> ${log}</div>` : ''}</div>
          <div class="pside"><div class="small muted">${t('giftsWeek')}</div><div>${gifts}</div>${bd ? `<div class="small muted">${t('birthday')}: ${esc(bd)}</div>` : ''}</div>
        </div>`
      })
      .join('')}</div>`
  }

  // ---------------------------------------------------------------- map

  private drawMap(f?: Frame): void {
    const map = this.currentMap?.()
    const cv = document.querySelector<HTMLCanvasElement>('#minimap')
    if (!map || !cv || !f) return
    const s = Math.max(2, Math.floor(Math.min(560 / map.width, 380 / map.height)))
    cv.width = map.width * s
    cv.height = map.height * s
    const g = cv.getContext('2d')!
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        g.fillStyle = COLOR[map.terrain[y * map.width + x]] ?? '#222'
        g.fillRect(x * s, y * s, s, s)
      }
    // people and the player
    for (const e of f.entities)
      if (e.kind === 'actor' && (e.look || e.appearance) && e.id !== f.player.id) {
        g.fillStyle = '#f5e6b8'
        g.fillRect(e.x * s, e.y * s, s, s)
      }
    g.fillStyle = '#e04848'
    g.beginPath()
    g.arc(f.player.x * s + s / 2, f.player.y * s + s / 2, s * 1.2, 0, Math.PI * 2)
    g.fill()
    $('#mapLegend').textContent = `${tx(map.name)} · ● ${t('youAreHere')}`
  }

  // ---------------------------------------------------------------- threads & letters

  private threadsHtml(): string {
    const threads = [...(this.library?.patches ?? [])].reverse()
    if (!threads.length) return `<div class="muted pad">${t('noThreads')}</div>`
    return `<div class="threads">${threads
      .map((r: Rule) => {
        const by = r.source?.request ? t('you') : t('valley')
        return `<div class="thread"><div>${esc(r.doc ?? r.id.replace(/^patch\//, '').replace(/-/g, ' '))}</div><div class="muted small">${t('wovenBy')}: ${by}${r.source?.at ? ` · ${esc(r.source.at.slice(0, 10))}` : ''}</div></div>`
      })
      .join('')}</div>`
  }

  private lettersHtml(f?: Frame): string {
    const box = f?.mailbox ?? []
    const open = box.find((l) => l.id === this.openLetter)
    const list = [...box].reverse()
    return `<div class="book-body">
      <div class="book-list">${list.map((l) => `<div class="entry ${l.read ? '' : 'new'} ${l.id === this.openLetter ? 'sel' : ''}" data-l="${esc(l.id)}">${l.from ? esc(tx(l.from)) : '—'}<span class="muted"> · ${t('day')} ${l.day}</span></div>`).join('') || `<div class="muted pad">${t('noMail')}</div>`}</div>
      ${open ? `<div class="letter">${esc(tx(open.text)).replace(/\n/g, '<br>')}${open.from ? `<div class="sign">— ${esc(tx(open.from))}</div>` : ''}</div>` : ''}
    </div>`
  }

  private wireLetters(f?: Frame): void {
    $('#menuSheet')
      .querySelectorAll<HTMLElement>('[data-l]')
      .forEach(
        (el) =>
          (el.onclick = () => {
            this.openLetter = el.dataset.l
            if (!f?.mailbox.find((l) => l.id === el.dataset.l)?.read) this.send.readMail(el.dataset.l!)
            this.render()
          }),
      )
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

  // ---------------------------------------------------------------- journal

  renderJournal(): void {
    const f = this.frame
    const stage = Number(f?.player.props.quest ?? -1)
    const slimes = Number(f?.player.props.slimes ?? 0)
    const now = OBJECTIVES[stage]
    const past = Object.entries(OBJECTIVES)
      .filter(([k]) => Number(k) < stage)
      .map(([, o]) => tx(o.title).replace(' (0/3)', '').replace('（0/3）', ''))
      .filter((x, i, a) => a.indexOf(x) === i)
    $('#journalSheet').innerHTML = `
      <div class="jhead"><b>${t('journal')}</b><button class="x" id="jClose">✕</button></div>
      ${now ? `<div class="jnow"><div class="small muted">${t('objective')}</div><div class="jtitle">${esc(tx(now.title).replace('0/3', `${Math.min(3, slimes)}/3`))}</div><div class="jhint">${esc(tx(now.hint))}</div></div>` : ''}
      ${past.length ? `<div class="small muted">${t('done')}</div><ul class="jpast">${past.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}`
    $('#jClose').onclick = () => this.close()
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
    const chestCells = Array.from({ length: Math.ceil(cap / 12) * 12 }, (_, i) => {
      const s = stacks[i]
      return `<div class="slot${i >= cap ? ' off' : ''}" ${s ? `data-c="${s[0].id}" data-tip="${esc(tipOf(s[0]))}"` : ''}>${s ? `<div class="icon" data-icon="${s[0].id}"></div>${s.length > 1 ? `<span class="count">${s.length}</span>` : ''}` : ''}</div>`
    })
    const bag = f.player.slots
    const zh = locale.value === 'zh'
    $('#chestSheet').innerHTML = `
      <div class="jhead"><b>${esc(tx(c.name))}</b><span class="muted small">${c.contents.length} / ${c.capacity ?? '∞'}</span><button class="x" id="cClose">✕</button></div>
      <div class="inv chest-grid">${chunk(chestCells, 12).map((r) => `<div class="grid-row">${r.join('')}</div>`).join('')}</div>
      <div class="inv-foot"><button id="cFill">⇣ ${t('fillStacks')}</button><button id="cOrg">⇅ ${t('organize')}</button><span class="muted small">${zh ? '点击：整堆移到另一边 · 右键：移一个' : 'Click: move the stack across · right click: move one'}</span></div>
      <div class="inv bag-grid">${[0, 1, 2].map((r) => `<div class="grid-row${r === 0 ? ' toolbar-row' : ''}">${bag.slice(r * 12, r * 12 + 12).map((s, j) => (s ? `<div class="slot" data-b="${s.item.id}" data-tip="${esc(tipOf(s.item))}"><div class="icon" data-icon="${s.item.id}"></div>${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}</div>` : `<div class="slot" data-i="${r * 12 + j}"></div>`)).join('')}</div>`).join('')}</div>`
    const sheet = $('#chestSheet')
    $('#cClose').onclick = () => this.close()
    const move = (from: 'chest' | 'bag', id: string, all: boolean) => this.send.transfer(from, id, all)
    sheet.querySelectorAll<HTMLElement>('[data-c]').forEach((el) => {
      el.onclick = () => move('chest', el.dataset.c!, true)
      el.oncontextmenu = (e) => (e.preventDefault(), move('chest', el.dataset.c!, false))
    })
    sheet.querySelectorAll<HTMLElement>('[data-b]').forEach((el) => {
      el.onclick = () => move('bag', el.dataset.b!, true)
      el.oncontextmenu = (e) => (e.preventDefault(), move('bag', el.dataset.b!, false))
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

function itemName(type: string): string {
  const f = FORM_BY_ID[type]
  return f ? (locale.value === 'zh' ? f.zh : f.en) : type.split('/').pop()!.replace(/_/g, ' ')
}

/** A tooltip: the name and what it is in plain words (its kind and a few telling tags). */
function tipOf(it: ItemInfo): string {
  const plain = it.tags.filter((g) => !g.includes(':') && !['item', 'portable'].includes(g)).slice(0, 4)
  return `${tx(it.name)}${plain.length ? ` · ${plain.join(', ')}` : ''}${it.statuses.length ? ` · ${it.statuses.join(', ')}` : ''}`
}
