// The game's panels (each opened by its own button bottom right, or its key: the bag, crafting,
// options), the codex (J: every item, person and creature, the ones met shown, and the Threadbook —
// every thread the world has learned, and whose act taught it) and the chest panel: the chest's
// grid above the bag, a click moving a stack to the other side.

import type { CodexEntry, CodexView, Frame, ItemInfo, Key, Rule } from '@lsw/engine'
import { FORM_BY_ID, RECIPES } from '@lsw/content'
import { CATALOG } from '../assets/catalog.ts'
import { personLook } from '../assets/looks.ts'
import { assetUrl } from '../render/assets.ts'
import type { LibraryView } from '../protocol.ts'
import { SkillTree } from './skilltree.ts'
import { WorldMap } from './worldmap.ts'
import { ProfessionPanel } from './profession.ts'
import { BoonPanel } from './boons.ts'
import { QuestLog } from './questlog.ts'
import { $, SLOT_KEYS, controlsTable, esc, locale, t, tx } from './common.ts'

export type Tab = 'inventory' | 'craft' | 'options'
const ICONS: Record<Tab, string> = { inventory: '🎒', craft: '🔨', options: '⚙' }
const ROW = SLOT_KEYS.length

/** The body's slots as the bag shows them (a paper doll, three across), by the `wear:` key; the off hand last. */
const EQUIP: [key: string, en: string, zh: string, ghost: string][][] = [
  [['ear', 'Earring', '耳环', '◦'], ['head', 'Head', '头', '⛑'], ['neck', 'Necklace', '项链', '◇']],
  [['shoulders', 'Shoulders', '肩', '⌒'], ['body', 'Armour', '护甲', '▣'], ['hands', 'Hands', '手', '✋']],
  [['ring', 'Ring', '戒指', '○'], ['waist', 'Belt', '腰带', '═'], ['ring.2', 'Ring', '戒指', '○']],
  [['', '', '', ''], ['feet', 'Feet', '脚', '▁'], ['arm', 'Off hand', '副手', '🛡']],
]

type CodexTab = 'items' | 'people' | 'creatures' | 'threads'
const CODEX_TABS: CodexTab[] = ['items', 'people', 'creatures', 'threads']
const CODEX_LABEL: Record<CodexTab, string> = { items: 'cxItems', people: 'cxPeople', creatures: 'cxCreatures', threads: 'threads' }
const GROUPS: Record<string, [string, string]> = {
  weapon: ['Weapons', '武器'], armor: ['Armour', '护甲'], clothing: ['Clothing', '衣物'], tool: ['Tools', '工具'], light: ['Lights', '照明'],
  vessel: ['Vessels', '容器'], food: ['Food', '食物'], potion: ['Potions', '药水'], material: ['Materials', '材料'], seed: ['Seeds', '种子'],
  gem: ['Gems', '宝石'], valuable: ['Valuables', '珍宝'], relic: ['Relics', '圣物'], document: ['Documents', '文书'], key: ['Keys', '钥匙'], misc: ['Odds and ends', '杂物'],
}
const groupName = (g: string) => (GROUPS[g] ? GROUPS[g][locale.value === 'zh' ? 1 : 0] : g)
/** A creature's picture: its kind's own art (`creature:slime:fire_slime`), else its family's. */
const actorKey = (e: CodexEntry) => {
  const leaf = e.id.split('/').pop()
  return e.sprite && CATALOG.creatures[`${e.sprite}:${leaf}`] ? `${e.sprite}:${leaf}` : (e.sprite ?? '')
}

const images = new Map<string, Promise<HTMLImageElement>>()
const image = (url: string) => {
  let p = images.get(url)
  if (!p) {
    p = new Promise((ok, no) => {
      const img = new Image()
      img.onload = () => ok(img)
      img.onerror = no
      img.src = url
    })
    images.set(url, p)
  }
  return p
}
/** Draw a cell of a picture into a slot (pixelated, from the image file: no game texture needed). */
function paintCell(el: HTMLElement, path: string, cell: (img: HTMLImageElement) => [number, number, number, number]): void {
  image(assetUrl(path)).then((img) => {
    const [x, y, w, h] = cell(img)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')!
    g.imageSmoothingEnabled = false
    g.drawImage(img, x, y, w, h, 0, 0, w, h)
    el.replaceChildren(c)
  }, () => {})
}
/** The codex's pictures: items from their sprite, people and creatures by their sheet's first frame. */
function paintCodex(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-cx-item]').forEach((el) => {
    const d = CATALOG.items[el.dataset.cxItem!]
    if (d) paintCell(el, d.img, () => [d.x, d.y, d.w, d.h])
  })
  const actor = (el: HTMLElement, a: { dir: string; sheet: string; faceset?: string; cols: number; rows: number } | undefined) => {
    if (!a) return
    // the sheet's first frame (facing down): a portrait's square background would make a poor shadow
    paintCell(el, `${a.dir}/${a.sheet}`, (img) => [0, 0, Math.floor(img.width / a.cols), Math.floor(img.height / a.rows)])
  }
  root.querySelectorAll<HTMLElement>('[data-cx-look]').forEach((el) => actor(el, CATALOG.characters[el.dataset.cxLook!]))
  root.querySelectorAll<HTMLElement>('[data-cx-actor]').forEach((el) => actor(el, CATALOG.creatures[el.dataset.cxActor!]))
}

export interface MenuSend {
  swap(a: number, b: number): void
  /** Shift+click: a stack between the toolbar and the rest of the bag. */
  quickMove(slot: number): void
  drop(slot: number, all: boolean): void
  organize(): void
  /** What is worn: put a carried item on (in its own slot) or take it off; `putOn` from the bag (another of a stack). */
  wear(item?: string, putOn?: boolean): void
  craft(id: string, all?: boolean): void
  /** The skill tree: spend skill points on a skill. */
  learn(id: string): void
  /** The world map asks for the atlas, and travels to a waypoint stone. */
  atlas(): void
  travel(waypoint: string): void
  /** Take up (or change to) a profession at a trainer. */
  profession(id: string): void
  /** The companion carries another of its boons (beside a woken waypoint). */
  boon(id: string): void
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
  /** Set by main.ts: an item the tooltip should know that is not in the frame (the crafting panel's). */
  registerTip?: (key: string, info: ItemInfo) => void
  facesetOf?: (id: string) => HTMLCanvasElement | undefined
  private frame?: Frame
  private codex?: CodexView
  private codexTab: CodexTab = 'items'
  private skills: SkillTree
  /** The world map (M), main.ts hands it the atlas. */
  worldmap: WorldMap
  /** The trainer's choice of profession (opened by talking to a trainer). */
  profession: ProfessionPanel
  boons: BoonPanel
  /** The quest log (L). */
  quests: QuestLog
  /** The inventory slot picked up by a click (placed by the next click). */
  private picked?: number

  constructor(private send: MenuSend) {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="menu" class="overlay hidden"><div class="sheet wood" id="menuSheet"></div></div>
       <div id="journal" class="overlay hidden"><div class="sheet paper" id="journalSheet"></div></div>
       <div id="chest" class="overlay hidden"><div class="sheet wood" id="chestSheet"></div></div>
       <div id="skills" class="sk-page hidden"></div>
       <div id="worldmap" class="sk-page wm-page hidden"></div>
       <div id="profession" class="overlay hidden"></div>
       <div id="boons" class="overlay hidden"></div>
       <div id="questlog" class="overlay hidden"></div>`,
    )
    this.skills = new SkillTree($('#skills'), (id) => this.send.learn(id), () => this.close())
    this.quests = new QuestLog($('#questlog'), () => this.close())
    $('#questlog').addEventListener('mousedown', (e) => e.target === e.currentTarget && this.close())
    this.profession = new ProfessionPanel($('#profession'), (id) => this.send.profession(id), () => this.close())
    $('#profession').addEventListener('mousedown', (e) => e.target === e.currentTarget && this.close())
    this.boons = new BoonPanel($('#boons'), (id) => this.send.boon(id), () => this.close())
    $('#boons').addEventListener('mousedown', (e) => e.target === e.currentTarget && this.close())
    this.worldmap = new WorldMap($('#worldmap'), { atlas: () => this.send.atlas(), travel: (id) => (this.send.travel(id), this.close()), close: () => this.close() })
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
  get skillsOpen(): boolean {
    return !$('#skills').classList.contains('hidden')
  }
  get anyOpen(): boolean {
    return this.menuOpen || this.journalOpen || this.chestOpen || this.skillsOpen || this.worldmap.open || this.profession.open || this.boons.open || this.quests.open
  }

  open(tab?: Tab): void {
    if (tab) this.tab = tab
    $('#journal').classList.add('hidden')
    $('#skills').classList.add('hidden')
    $('#worldmap').classList.add('hidden')
    $('#menu').classList.remove('hidden')
    this.picked = undefined
    this.render()
  }

  toggle(tab?: Tab): void {
    if (this.menuOpen && (!tab || tab === this.tab)) this.close()
    else this.open(tab)
  }

  /** The skill tree (K, or its button bottom right). */
  /** The world map (M, or a click on the minimap). */
  toggleMap(): void {
    if (this.worldmap.open) return this.close()
    this.close()
    this.worldmap.show()
  }

  toggleSkills(): void {
    if (this.skillsOpen) return this.close()
    this.close()
    $('#skills').classList.remove('hidden')
    this.skills.open(this.frame)
  }

  openJournal(): void {
    $('#menu').classList.add('hidden')
    $('#skills').classList.add('hidden')
    $('#journal').classList.toggle('hidden')
    if (this.journalOpen) this.renderJournal()
  }

  close(): void {
    if (this.chestOpen) this.send.closePanel()
    for (const id of ['#menu', '#journal', '#chest', '#skills', '#worldmap', '#profession', '#boons', '#questlog']) $(id).classList.add('hidden')
    this.picked = undefined
  }

  onFrame(f: Frame): void {
    this.frame = f
    // the chest panel follows the open container the worker names
    if (f.container && !this.chestOpen) ($('#chest').classList.remove('hidden'), (this.chestSig = ''))
    if (!f.container && this.chestOpen) $('#chest').classList.add('hidden')
    if (this.chestOpen) this.renderChest(f)
    if (this.menuOpen && (this.tab === 'inventory' || this.tab === 'craft')) this.renderLive()
    if (this.journalOpen && this.library && this.library.version !== this.journalLib) this.renderJournal()
    if (this.skillsOpen) this.skills.render(f)
    if (this.profession.open) this.profession.render(f)
    if (this.boons.open) this.boons.render(f)
    if (this.quests.open) this.quests.render(f)
  }

  /** The quest log (L, or its button). */
  toggleQuests(): void {
    if (this.quests.open) return this.close()
    this.close()
    this.quests.show(this.frame)
  }

  /** A trainer opened the choice of profession. */
  openProfession(): void {
    this.close()
    this.profession.show(this.frame)
  }

  /** The waypoint's panel: the companion's boons (only once it has one). */
  openBoons(): void {
    if (!this.frame?.player.boons?.unlocked.length) return
    this.close()
    this.boons.show(this.frame)
  }

  // ---------------------------------------------------------------- the skill tree


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
    // each panel is its own (its button bottom right, or its key): a title, no tabs to switch between
    const head = `<div class="tabs-row"><b class="sheet-title">${ICONS[this.tab]} ${t(this.tab)}</b><button class="x" id="menuClose">✕</button></div>`
    let body = ''
    if (this.tab === 'inventory') body = this.inventoryHtml(f)
    if (this.tab === 'craft') body = this.craftHtml(f)
    if (this.tab === 'options') body = this.optionsHtml()
    $('#menuSheet').innerHTML = head + `<div class="tab-body">${body}</div>`
    $('#menuClose').onclick = () => this.close()
    if (this.tab === 'inventory') this.wireInventory(f)
    if (this.tab === 'options') this.wireOptions()
    if (this.tab === 'craft') this.wireCraft()
    if (f) {
      this.liveSig = this.sigOf(f)
      if (this.tab === 'inventory') this.paintIcons?.([...f.player.slots.filter(Boolean).map((s) => s!.item), ...Object.values(f.player.worn ?? {})])
      if (this.tab === 'craft') {
        const infos = craftInfos()
        for (const it of infos) this.registerTip?.(it.id, it)
        this.paintIcons?.(infos)
      }
    }
  }

  private sigOf(f: Frame): string {
    return `${this.tab}|${locale.value}|${JSON.stringify(f.player.slots.map((s) => s && [s.item.id, s.count]))}|${f.player.offhand?.id}:${f.player.offhand?.works}|${Object.entries(f.player.worn ?? {}).map(([k, v]) => k + v.id).join()}|${this.picked}`
  }

  // ---------------------------------------------------------------- inventory

  private slotHtml(s: Frame['player']['slots'][number], i: number, extra = ''): string {
    const key = i < ROW ? `<span class="key">${SLOT_KEYS[i]}</span>` : ''
    return `<div class="slot${extra}" data-i="${i}" ${s ? `data-item="${s.item.id}"` : ''}>${key}${s ? `<div class="icon" data-icon="${s.item.id}"></div>${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}${s.worn ? '<span class="worn"></span>' : ''}` : ''}</div>`
  }

  private inventoryHtml(f?: Frame): string {
    if (!f) return ''
    const slots = f.player.slots
    // the toolbar row first (keys 1–0, set apart), then the rest of the bag
    const rows = chunk(slots.map((s, j) => this.slotHtml(s, j, (j === this.picked ? ' picked' : '') + (j === f.player.selected ? ' sel' : ''))), ROW)
      .map((r, k) => `<div class="grid-row${k === 0 ? ' toolbar-row' : ''}">${r.join('')}</div>`)
      .join('')
    const zh = locale.value === 'zh'
    // what is worn beside the bag (world-model.md §6.8): ten slots of the body and the off hand, as a paper doll;
    // the off hand greyed while what is there does not work (another profession's shield)
    const worn = f.player.worn ?? {}
    const off = f.player.offhand
    const doll = EQUIP.map((row) => row.map(([key, en, zh2, ghost]) => {
      if (!key) return '<div class="eq-gap"></div>'
      const it = worn[key]
      const dim = key === 'arm' && off && !off.works ? ' off' : ''
      return `<div class="eq-cell"><div class="slot eq-slot${dim}" data-wear="${key}" title="${zh ? zh2 : en}${it ? ` · ${esc(tx(it.name))}` : ''}" ${it ? `data-item="${it.id}"` : ''}>${it ? `<div class="icon" data-icon="${it.id}"></div>` : `<span class="ghost">${ghost}</span>`}</div><span class="eq-name">${zh ? zh2 : en}</span></div>`
    }).join('')).join('')
    const equip = `<div class="inv-equip"><span class="muted small">${zh ? '装备' : 'Equipment'}</span><div class="eq-grid">${doll}</div></div>`
    return `<div class="inv-wrap"><div class="inv">${rows}</div>${equip}</div>
      <div class="inv-foot">
        <button id="bOrganize">⇅ ${t('organize')}</button>
        <button id="bDrop" ${this.picked === undefined ? 'disabled' : ''}>⤓ ${t('dropHere')}</button>
        <span class="muted small">${zh ? '点击拿起、再点击交换 · Shift+点击：在快捷栏和背包间移动 · Tab：换一行到快捷栏 · “丢下”放到面前 · 拿起装备点右边的装备栏穿上（右键也可以），点装备栏卸下 · 右键：对它用手上的东西、放进去、空手摆弄' : 'Click to pick up, again to swap · Shift+click: between the toolbar and the bag · Tab: the next row to the toolbar · Drop sets it down in front · pick up something wearable and click the equipment beside the bag to put it on (or right click it), click a worn piece to take it off · right click: use or put the held thing on it, or handle it'}</span>
      </div>
`
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
    // the equipment: a picked-up wearable is put on (in its own slot); a click on what is worn takes it off
    $('#menuSheet').querySelectorAll<HTMLElement>('[data-wear]').forEach((el) => {
      el.onclick = () => {
        const s = this.picked !== undefined ? slots[this.picked] : null
        const it = f.player.worn?.[el.dataset.wear!]
        if (s && s.item.props.slot) this.send.wear(s.item.id, true)
        else if (!s && it) this.send.wear(it.id)
        this.picked = undefined
        this.render()
      }
    })
    $('#menuSheet').querySelectorAll<HTMLElement>('.inv [data-i]').forEach((el) => {
      const i = Number(el.dataset.i)
      el.onclick = (e) => {
        if (e.shiftKey && this.picked === undefined) return void (slots[i] && this.send.quickMove(i))
        if (this.picked === undefined) {
          if (slots[i]) this.picked = i
        } else {
          this.send.swap(this.picked, i)
          this.picked = undefined
        }
        this.render()
      }
      // right click: the context menu — this item as the target of the held thing or a bare hand
      el.oncontextmenu = (e) => {
        e.preventDefault()
        const s = slots[i]
        if (!s) return
        const zh = locale.value === 'zh'
        // a worn piece alone in its slot comes off; otherwise one (another of the stack) goes on
        const off = !!s.worn && s.count === 1
        const wear: [string, () => void][] = !s.item.props.slot ? [] : [[off ? (zh ? '卸下' : 'Take off') : s.item.props.slot === 'arm' ? (zh ? '装备到副手' : 'Wear in the off hand') : (zh ? '装备' : 'Wear'), () => this.send.wear(s.item.id, !off)]]
        this.contextMenu(e.clientX, e.clientY, s.item.id, [...wear, [t('dropHere'), () => this.send.drop(i, true)]])
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

  // ---------------------------------------------------------------- crafting

  /** Don't Starve's panel: each recipe, what it needs against what is carried, and a button that makes it. */
  private craftHtml(f?: Frame): string {
    if (!f) return ''
    const have = (type: string) => f.player.slots.reduce((n, s) => n + (s && s.item.type === type ? s.count : 0), 0)
    const tool = (tag: string) => f.player.slots.some((s) => s?.item.tags.includes(tag))
    const rows = RECIPES.map((r) => {
      // how many times what is carried makes it (the tools are not used up)
      // (a station's recipe is made beside one: away from it, nothing is made however much is carried)
      const here = !r.station || r.station === 'hands' || f.player.stations.includes(r.station)
      const times = here && (r.tools ?? []).every(tool) ? Math.min(...r.needs.map((n) => Math.floor(have(n.type) / n.count))) : 0
      const ok = times > 0
      const needs = r.needs
        .map((n) => {
          const h = have(n.type)
          return `<span class="need${h >= n.count ? '' : ' short'}" data-item="need:${n.type}"><span class="icon" data-icon="need:${n.type}"></span>${h}/${n.count}</span>`
        })
        .join('') +
        (r.tools ?? []).map((tag) => {
          const form = toolForm(tag)
          return form ? `<span class="need tool${tool(tag) ? '' : ' short'}" data-item="need:${form}" title="${esc(t('toolKept'))}"><span class="icon" data-icon="need:${form}"></span>${tool(tag) ? '✓' : '✗'}</span>` : ''
        }).join('')
      return `<div class="recipe${ok ? '' : ' off'}">
        <div class="slot" data-item="recipe:${r.id}"><div class="icon" data-icon="recipe:${r.id}"></div></div>
        <div class="rname">${esc(tx(r.name))}${r.station && r.station !== 'hands' ? ` <span class="station${here ? '' : ' short'}">${esc(tx({ en: 'at a ' + r.station, zh: r.station === 'workbench' ? '需在工作台旁' : r.station }))}</span>` : ''}</div>
        <div class="needs">${needs}</div>
        <button data-craft="${r.id}" ${ok ? '' : `disabled title="${esc(here ? t('needMore') : tx({ en: `Stand beside a ${r.station}`, zh: r.station === 'workbench' ? '站到工作台旁边' : r.station! }))}"`}>${t('craftIt')}${r.count && r.count > 1 ? ` ×${r.count}` : ''}</button>
        ${times > 1 ? `<button class="all" data-craft-all="${r.id}" title="${esc(t('craftAllTip'))}">${t('craftAll')} ×${times}</button>` : ''}
      </div>`
    }).join('')
    return `<div class="recipes">${rows}</div>`
  }

  private wireCraft(): void {
    // Shift-click makes as many as one can, as the "all" button does
    $('#menuSheet').querySelectorAll<HTMLButtonElement>('[data-craft]').forEach((b) => (b.onclick = (e) => this.send.craft(b.dataset.craft!, e.shiftKey)))
    $('#menuSheet').querySelectorAll<HTMLButtonElement>('[data-craft-all]').forEach((b) => (b.onclick = () => this.send.craft(b.dataset.craftAll!, true)))
  }

  // ---------------------------------------------------------------- options

  private optionsHtml(): string {
    return `<div class="options">
      <div class="opt"><span>${t('language')}</span><button id="oLang">${locale.value === 'zh' ? '中文 → English' : 'English → 中文'}</button></div>
      <div class="opt"><span>${t('sound')}</span><button id="oSound">${this.muted ? t('off') : t('on')}</button></div>
      <div class="opt"><button id="oSave">${t('save')}</button><button id="oNew">${t('toTitle')}</button>${import.meta.env.DEV ? `<button id="oDev">${t('devConsole')}</button>` : ''}</div>
      <h4>${t('controls')}</h4>${controlsTable(import.meta.env.DEV)}
    </div>`
  }

  private wireOptions(): void {
    $('#oLang').onclick = () => (this.send.toggleLocale(), this.render())
    $('#oSound').onclick = () => (this.send.toggleSound(), (this.muted = !this.muted), this.render())
    $('#oSave').onclick = () => this.send.save()
    // back to the cover (saved first): new games and other slots start there
    $('#oNew').onclick = () => (this.close(), this.send.newGame())
    document.querySelector<HTMLButtonElement>('#oDev')?.addEventListener('click', () => (this.close(), this.send.devConsole?.()))
  }

  // ---------------------------------------------------------------- the journal: the objective and the Threadbook

  private journalLib = -1
  /** The codex (J, or its book bottom right): every item, person and creature, the met ones shown; and the Threadbook. */
  renderJournal(): void {
    this.journalLib = this.library?.version ?? -1
    const v = this.codex
    const count = (l?: CodexEntry[]) => (l ? `${l.filter((e) => e.known).length}/${l.length}` : '')
    const tabs = CODEX_TABS.map((k) => `<button class="cx-tab${k === this.codexTab ? ' on' : ''}" data-cx="${k}">${t(CODEX_LABEL[k])}${k === 'threads' ? '' : ` <small>${count(v?.[k])}</small>`}</button>`).join('')
    const body = this.codexTab === 'threads' ? this.threadsHtml() : v ? this.codexGrid(v[this.codexTab]) : `<div class="muted pad">…</div>`
    $('#journalSheet').innerHTML = `
      <div class="jhead"><b>${t('codex')}</b><button class="x" id="jClose">✕</button></div>
      <div class="cx-tabs">${tabs}</div>
      <div class="cx-body">${body}</div>`
    $('#jClose').onclick = () => this.close()
    $('#journalSheet').querySelectorAll<HTMLButtonElement>('[data-cx]').forEach((b) => (b.onclick = () => ((this.codexTab = b.dataset.cx as CodexTab), this.renderJournal())))
    paintCodex($('#journalSheet'))
  }

  /** The worker's codex arrived (on opening, and whenever something new is met while open). */
  onCodex(view: CodexView): void {
    this.codex = view
    if (this.journalOpen) this.renderJournal()
  }

  /** One kind's entries as cards, items under their kinds; a thing not met yet is a shadow and ???. */
  private codexGrid(list: CodexEntry[]): string {
    const card = (e: CodexEntry) => {
      const person = !e.group && !e.stats && !e.sprite?.startsWith('creature:')
      const pic = person ? `data-cx-look="${esc(personLook(e.id, e.type ?? '', e.look))}"` : e.group ? `data-cx-item="${esc(e.sprite ?? '')}"` : `data-cx-actor="${esc(actorKey(e))}"`
      const name = e.known ? esc(tx(e.name)) : '???'
      const extra = !e.known ? '' : e.stats ? `<div class="cx-sub">❤ ${e.stats.hp} · ⚔ ${e.stats.atk} · 🛡 ${e.stats.def}</div>` : e.where ? `<div class="cx-sub">${esc(tx(e.where))}</div>` : ''
      return `<div class="cx-card${e.known ? '' : ' unknown'}" title="${name}"><div class="cx-pic" ${pic}></div><div class="cx-name">${name}</div>${extra}</div>`
    }
    if (!list.some((e) => e.group)) return `<div class="cx-grid">${list.map(card).join('')}</div>`
    const groups = new Map<string, CodexEntry[]>()
    for (const e of list) groups.set(e.group!, [...(groups.get(e.group!) ?? []), e])
    return [...groups].map(([g, es]) => `<div class="cx-group">${esc(groupName(g))} <small>${es.filter((e) => e.known).length}/${es.length}</small></div><div class="cx-grid">${es.map(card).join('')}</div>`).join('')
  }

  /** Every thread the world has learned, newest first, and whose act taught it (design.md §5.11, legibility). */
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
      return `<div class="slot${i >= cap ? ' off' : ''}" ${s ? `data-c="${s[0].id}" data-item="${s[0].id}"` : ''}>${s ? `<div class="icon" data-icon="${s[0].id}"></div>${s.length > 1 ? `<span class="count">${s.length}</span>` : ''}` : ''}</div>`
    })
    const bag = f.player.slots
    const zh = locale.value === 'zh'
    $('#chestSheet').innerHTML = `
      <div class="jhead"><b>${esc(tx(c.name))}</b><span class="muted small">${c.contents.length} / ${c.capacity ?? '∞'}</span><button class="x" id="cClose">✕</button></div>
      <div class="inv chest-grid">${chunk(chestCells, ROW).map((r) => `<div class="grid-row">${r.join('')}</div>`).join('')}</div>
      <div class="inv-foot"><button id="cFill">⇣ ${t('fillStacks')}</button><button id="cOrg">⇅ ${t('organize')}</button><span class="muted small">${zh ? '点击：整堆移到另一边 · Shift+点击：移一个 · 右键：更多' : 'Click: the stack across · Shift+click: one · right click: more'}</span></div>
      <div class="inv bag-grid">${chunk(
        bag.map((s, j) => (s ? `<div class="slot" data-b="${s.item.id}" data-item="${s.item.id}"><div class="icon" data-icon="${s.item.id}"></div>${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}</div>` : `<div class="slot" data-i="${j}"></div>`)),
        ROW,
      )
        .map((r, k) => `<div class="grid-row${k === 0 ? ' toolbar-row' : ''}">${r.join('')}</div>`)
        .join('')}</div>`
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

/** The crafting panel's items (each recipe's result, each material), keyed `recipe:<id>` / `need:<type>`: for their icons and tooltips. */
function craftInfos(): ItemInfo[] {
  const of = (id: string, type: string, extra: { name?: ItemInfo['name']; tags?: string[]; props?: ItemInfo['props']; sprite?: string } = {}): ItemInfo | undefined => {
    const f = FORM_BY_ID[type]
    // what is not an item form (a wall, a door, a bed) shows the recipe's own picture
    if (!f) return extra.sprite && extra.name ? { id, type, sprite: extra.sprite, name: extra.name, tags: [...(extra.tags ?? [])], statuses: [], props: { ...(extra.props ?? {}) } } : undefined
    return { id, type, sprite: f.sprite, name: extra.name ?? { en: f.en, zh: f.zh }, tags: [...(f.tags ?? []), ...(extra.tags ?? [])], statuses: [], props: { ...(f.props ?? {}), ...(extra.props ?? {}) } }
  }
  const needs = [...new Set([...RECIPES.flatMap((r) => r.needs.map((n) => n.type)), ...RECIPES.flatMap((r) => (r.tools ?? []).map(toolForm)).filter((x): x is string => !!x)])]
  return [...RECIPES.map((r) => of(`recipe:${r.id}`, r.make.type, { name: r.name, tags: r.make.tags, props: r.make.props, sprite: r.sprite })), ...needs.map((n) => of(`need:${n}`, n))].filter((x): x is ItemInfo => !!x)
}

/** The item form that stands for a tool tag in the crafting panel (an axe for `tool:axe`). */
function toolForm(tag: string): string | undefined {
  return Object.values(FORM_BY_ID).find((f) => f.tags?.includes(tag))?.id
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

