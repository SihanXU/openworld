// The game's panels (each opened by its own button bottom right, or its key: the bag, crafting,
// options), the codex (J: every item, person and creature, the ones met shown, and the Threadbook —
// every thread the world has learned, and whose act taught it) and the chest panel: the chest's
// grid above the bag, a click moving a stack to the other side.

import type { AiQuality, CodexEntry, CodexView, Frame, ItemInfo, Look, Plan, Recipe, Rule, Text, Tree } from '@openworld/engine'
import { splitStacks, stackKey } from '@openworld/engine'
import { catalog, game, hasModule, itemIconSignature, ontology, professionById, type ShopDef } from '../game.ts'
import { personLook } from '../assets/looks.ts'
import { FH, FW, IDLE_ROW, composeSprite } from '../assets/figure/sprite.ts'
import { artEpoch, assetUrl } from '../render/assets.ts'
import { EQUIP_SLOT_FRAMES } from '../assets/types.ts'
import type { LibraryView } from '../protocol.ts'
import type { TransferProgress } from '../transferQueue.ts'
import { SkillTree } from './skilltree.ts'
import { WorldMap } from './worldmap.ts'
import { ProfessionPanel } from './profession.ts'
import { PanelRegistry, type PanelFactory } from './panels.ts'
import { boonPanel } from './boons.ts'
import { QuestLog } from './questlog.ts'
import { SkillPanel } from './skillpanel.ts'
import { AiOptions } from './quality.ts'
import { ContextMenu } from './context-menu.ts'
import { $, SLOT_KEYS, controlsTable, esc, locale, prefs, t, tx, gearFrame } from './common.ts'

export type Tab = 'inventory' | 'craft' | 'options' | 'shop'
const ICONS: Record<Tab, string> = { inventory: '🎒', craft: '🔨', options: '⚙', shop: '🏪' }
/** The game's shops (a station each, its shelves); none, no shop panel. */
const shops = (): ShopDef[] => game().crafting.shops ?? []
const shopStations = () => new Set(shops().map((s) => s.station))
/** The runtime's own panels for a module a game uses, where the game has none of its own (ClientGame.panels). */
const builtInPanels = (): Record<string, PanelFactory> => (hasModule('boons') ? { boons: boonPanel } : {})
const ROW = SLOT_KEYS.length

/** The body's slots as the bag shows them (a paper doll), by the `wear:` key, each with the glyph an empty one shows; the two hands last (the main hand: the weapon kept ready). Their names: STRINGS `slot:<key>`. */
const EQUIP: [key: string, ghost: string][] = [
  ['ear', '◦'], ['head', '⛑'], ['neck', '◇'], ['shoulders', '⌒'], ['body', '▣'], ['hands', '✋'],
  ['ring', '○'], ['waist', '═'], ['ring.2', '○'], ['weapon', '⚔'], ['feet', '▁'], ['arm', '🛡'],
]
/** A slot's name (a second ring is a ring). */
const slotName = (key: string) => t(`slot:${key.split('.')[0]}`)

/**
 * An empty body slot: what goes there — its frame of the catalogue's `ui.equipSlots` strip (assets/types.ts
 * EQUIP_SLOT_FRAMES, painted by paintSilhouettes), else its glyph.
 */
function silhouette(key: string, ghost: string): string {
  const i = EQUIP_SLOT_FRAMES.indexOf(key.split('.')[0])
  return catalog().ui.equipSlots && i >= 0 ? `<span class="eq-sil" data-sil="${i}"></span>` : `<span class="ghost">${ghost}</span>`
}

type CodexTab = 'items' | 'people' | 'creatures' | 'threads'

/** What a thread does, in the player's language: its label (on the rule or on its first answer), its roles named plainly. */
function threadLabel(r: Rule): string | undefined {
  const find = (n: Tree | undefined): Text | undefined =>
    !n || n === 'inherit' ? undefined : 'do' in n ? n.label : 'if' in n ? find(n.then) ?? find(n.else) : undefined
  const l = r.label ?? find(r.tree)
  if (!l) return undefined
  return tx(l).replace(/{instrument}/g, t('roleInstrument')).replace(/{target}/g, t('roleTarget')).replace(/{[a-z]+}/g, '…')
}
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
  return e.sprite && catalog().creatures[`${e.sprite}:${leaf}`] ? `${e.sprite}:${leaf}` : (e.sprite ?? '')
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
    const d = catalog().items[el.dataset.cxItem!]
    if (d) paintCell(el, d.img, () => [d.x, d.y, d.w, d.h])
  })
  const actor = (el: HTMLElement, a: { dir: string; sheet: string; faceset?: string; cols: number; rows: number } | undefined) => {
    if (!a) return
    // the sheet's first frame (facing down): a portrait's square background would make a poor shadow
    paintCell(el, `${a.dir}/${a.sheet}`, (img) => [0, 0, Math.floor(img.width / a.cols), Math.floor(img.height / a.rows)])
  }
  root.querySelectorAll<HTMLElement>('[data-cx-look]').forEach((el) => actor(el, catalog().characters[el.dataset.cxLook!]))
  // a look made of parts (docs/looks.md): its sprite standing, facing down
  root.querySelectorAll<HTMLElement>('[data-cx-fig]').forEach((el) => {
    const px = composeSprite(JSON.parse(el.dataset.cxFig!) as Look)
    const c = document.createElement('canvas')
    c.width = FW
    c.height = FH
    const img = new ImageData(FW, FH)
    for (let y = 0; y < FH; y++) {
      const from = (IDLE_ROW * FH + y) * FW * 4 * 4
      img.data.set(px.subarray(from, from + FW * 4), y * FW * 4)
    }
    c.getContext('2d')!.putImageData(img, 0, 0)
    c.classList.add('fig')
    el.replaceChildren(c)
  })
  root.querySelectorAll<HTMLElement>('[data-cx-actor]').forEach((el) => actor(el, catalog().creatures[el.dataset.cxActor!]))
}

/** The empty body slots' silhouettes: each its frame of the catalogue's `ui.equipSlots` strip, from the image file. */
function paintSilhouettes(root: HTMLElement): void {
  const d = catalog().ui.equipSlots
  if (!d) return
  root.querySelectorAll<HTMLElement>('[data-sil]').forEach((el) => {
    const i = Number(el.dataset.sil)
    paintCell(el, d.img, () => [d.x + i * (d.step ?? d.w), d.y, d.w, d.h])
  })
}

/** The game's coin (`items.coin`) and its name — its item form's, else its type's —; none when the world has no such thing. */
function coinOf(): { type: string; name: Text } | undefined {
  const type = game().items.coin
  const form = game().items.forms[type]
  if (form) return { type, name: { en: form.en, zh: form.zh } }
  const def = ontology().types[type]
  return def ? { type, name: def.name ?? type.split('/').pop()! } : undefined
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
  /** The skill bar: set an active skill in a slot (null: empty it). */
  setSkill(slot: number, id: string | null): void
  /** The world map asks for the atlas, and travels to a waypoint stone. */
  atlas(): void
  travel(waypoint: string): void
  /** Take up (or change to) a profession at a trainer. */
  profession(id: string): void
  /** A word said to someone without the talk panel (the haven panel's widenings). */
  speak(who: string, verb: string, choice?: string): void
  /** Up to so many of a carried kind put into a thing (the haven panel). */
  offer(target: string, item: string, count: number): void
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
  keyOnItem(key: Plan['key'], item: string): void
  /** A game's explicit chooser uses one carried item on another after confirmation. */
  useItemOnHeldItem(instrument: string, target: string): void
  /** The journal: the quest followed (none: the latest main quest). */
  track(id: string | undefined): void
  /** The commission board: a favour on it taken on. */
  board(who: string, ref: string): void
  /** The AI setting changed (the options' AI section): to the engine. */
  setQuality(q: AiQuality): void
}

export class Menu {
  tab: Tab = 'inventory'
  /** The options' AI section: the AI setting, and what the connected model carries. */
  readonly ai: AiOptions
  library?: LibraryView
  containerTransfer?: TransferProgress
  muted = false
  paintIcons?: (items: ItemInfo[]) => void
  /** Set by main.ts: an item the tooltip should know that is not in the frame (the crafting panel's). */
  registerTip?: (key: string, info: ItemInfo) => void
  facesetOf?: (id: string) => HTMLCanvasElement | undefined
  private frame?: Frame
  /** The shelf shown of the shop open (its group). */
  private shelf = ''
  /** The shop open (its station): a stall, a store's counter, a bookstand. */
  private shopStation = ''
  private codex?: CodexView
  private codexTab: CodexTab = 'items'
  private skills: SkillTree
  /** The world map (M), main.ts hands it the atlas. */
  worldmap: WorldMap
  /** The trainer's choice of profession (opened by talking to a trainer). */
  profession: ProfessionPanel
  /** The game's own panels, and the runtime's for a module it uses (ui/panels.ts): opened by a rule's `panel` effect. */
  panels: PanelRegistry
  /** The quest log (L). */
  quests: QuestLog
  skillPanel: SkillPanel
  /** The inventory slot picked up by a click (placed by the next click). */
  private picked?: number
  /** A thing pressed in the bag and being dragged: where the press was, and whether the pointer has moved off it. */
  private drag?: { x: number; y: number; moved: boolean }
  /** The item popup belongs to the currently open panel and closes with it. */
  private readonly contextPopup = new ContextMenu()
  /** What is picked up rides on the pointer, as in Stardew's bag. */
  private carried = document.createElement('div')

  constructor(private send: MenuSend) {
    this.ai = new AiOptions((q) => send.setQuality(q), () => this.menuOpen && this.tab === 'options' && this.render())
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="menu" class="overlay hidden"><div class="sheet wood" id="menuSheet"></div></div>
       <div id="journal" class="overlay hidden"><div class="sheet paper" id="journalSheet"></div></div>
       <div id="chest" class="overlay hidden"><div class="sheet wood" id="chestSheet"></div></div>
       <div id="skills" class="sk-page hidden"></div>
       <div id="worldmap" class="sk-page wm-page hidden"></div>
       <div id="profession" class="overlay hidden"></div>
       <div id="questlog" class="overlay hidden"></div>
       <div id="skillpanel" class="overlay hidden"></div>`,
    )
    this.skills = new SkillTree($('#skills'), (id) => this.send.learn(id), () => this.close())
    this.quests = new QuestLog($('#questlog'), () => this.close(), { track: (id) => this.send.track(id), board: (who, ref) => this.send.board(who, ref) })
    $('#questlog').addEventListener('mousedown', (e) => e.target === e.currentTarget && this.close())
    this.skillPanel = new SkillPanel($('#skillpanel'), (slot, id) => this.send.setSkill(slot, id), () => this.close())
    $('#skillpanel').addEventListener('mousedown', (e) => e.target === e.currentTarget && this.close())
    this.profession = new ProfessionPanel($('#profession'), (id) => this.send.profession(id), () => this.close())
    $('#profession').addEventListener('mousedown', (e) => e.target === e.currentTarget && this.close())
    this.panels = new PanelRegistry(
      () => ({ ...builtInPanels(), ...game().panels }),
      (host) => ({ host, send: this.send, close: () => this.close(), paint: (items) => this.paintIcons?.([...craftInfos(), ...items]), openQuests: () => this.toggleQuests() }),
      (key) => {
        const host = document.createElement('div')
        host.className = 'overlay hidden'
        host.dataset.panel = key
        document.body.appendChild(host)
        host.addEventListener('mousedown', (e) => e.target === e.currentTarget && this.close())
        return host
      },
    )
    this.worldmap = new WorldMap($('#worldmap'), { atlas: () => this.send.atlas(), travel: (id) => (this.send.travel(id), this.close()), close: () => this.close() })
    // a click on the backdrop closes (or, holding a stack, drops it)
    for (const id of ['menu', 'journal', 'chest'])
      $(`#${id}`).addEventListener('mousedown', (e) => {
        if (e.target !== e.currentTarget) return
        if (id === 'menu' && this.picked !== undefined) return void (this.send.drop(this.picked, true), (this.picked = undefined), this.render())
        this.close()
      })
    this.carried.className = 'carried hidden'
    document.body.appendChild(this.carried)
    document.addEventListener('mousemove', (e) => this.carry(e))
    document.addEventListener('mouseup', (e) => this.letGo(e))
  }

  /** What is picked up follows the pointer; a press dragged a little way off its slot becomes a drag. */
  private carry(e: MouseEvent): void {
    if (this.picked === undefined) return
    // the bag went away under it (the journal opened, another panel): put back
    if (!this.bagShown) return this.showCarried()
    this.carried.style.transform = `translate(${e.clientX - 16}px, ${e.clientY - 16}px)`
    if (this.drag && Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 4) this.drag.moved = true
  }

  /**
   * A drag let go: on another slot it swaps there, on the body it is put on, out of the bag it is dropped
   * before the player (Stardew's way); anywhere else in the bag it goes back. A press let go where it was
   * keeps the thing on the pointer, for the next click to set down.
   */
  private letGo(e: MouseEvent): void {
    const d = this.drag
    this.drag = undefined
    if (!d?.moved || this.picked === undefined) return
    // let go once the bag has gone (the journal opened mid-drag): it goes back, never into the world
    if (!this.bagShown) return this.showCarried()
    const from = this.picked
    this.picked = undefined
    const at = document.elementFromPoint(e.clientX, e.clientY)
    const slot = at?.closest<HTMLElement>('.inv [data-i]')
    const wear = at?.closest<HTMLElement>('[data-wear]')
    const item = this.frame?.player.slots[from]?.item
    if (slot) Number(slot.dataset.i) !== from && this.send.swap(from, Number(slot.dataset.i))
    else if (wear) item?.props.slot && this.send.wear(item.id, true)
    else if (!$('#menuSheet').contains(at)) this.send.drop(from, true)
    this.render()
  }

  /** The bag is what is shown (a thing picked up from it rides the pointer only then). */
  private get bagShown(): boolean {
    return this.menuOpen && this.tab === 'inventory'
  }

  /** The thing picked up, drawn on the pointer while the bag is open; with the bag gone, it is put back. */
  private showCarried(): void {
    if (!this.bagShown) (this.picked = undefined), (this.drag = undefined)
    const s = this.picked !== undefined ? this.frame?.player.slots[this.picked] : undefined
    this.carried.classList.toggle('hidden', !s)
    if (!s) return void delete this.carried.dataset.item
    const sig = `${s.item.id}|${s.count}|${itemIconSignature([s.item])}`
    if (this.carried.dataset.item === sig) return
    this.carried.dataset.item = sig
    this.carried.innerHTML = `<div class="icon" data-icon="${s.item.id}"></div>${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}`
    this.paintIcons?.([s.item])
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
  /** The skill tree's node under the pointer (Shift+1–6 sets an active one in the skill bar). */
  hoveredSkill(): string | undefined {
    return this.skills.hovered
  }

  get skillsOpen(): boolean {
    return !$('#skills').classList.contains('hidden')
  }
  get anyOpen(): boolean {
    return this.menuOpen || this.journalOpen || this.chestOpen || this.skillsOpen || this.worldmap.open || this.profession.open || this.panels.anyOpen || this.quests.open || this.skillPanel.open
  }

  /** Open the shop panel on a station's shelves (none named: the game's first shop; the first shelf, when it is another shop than the last). */
  openShop(station?: string): void {
    const shop = shops().find((s) => s.station === station) ?? shops()[0]
    if (!shop?.shelves.length) return
    if (shop.station !== this.shopStation || !shop.shelves.some((s) => s.group === this.shelf)) this.shelf = shop.shelves[0].group
    this.shopStation = shop.station
    this.open('shop')
  }

  /** The shop open, if the game has it. */
  private get shop(): ShopDef | undefined {
    return shops().find((s) => s.station === this.shopStation)
  }

  open(tab?: Tab): void {
    this.contextPopup.close()
    if (tab) this.tab = tab
    $('#journal').classList.add('hidden')
    $('#skills').classList.add('hidden')
    $('#worldmap').classList.add('hidden')
    $('#menu').classList.remove('hidden')
    this.picked = undefined
    this.render()
    if (this.tab === 'options') void this.ai.refresh()
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
    this.contextPopup.close()
    $('#menu').classList.add('hidden')
    $('#skills').classList.add('hidden')
    this.showCarried()
    $('#journal').classList.toggle('hidden')
    if (this.journalOpen) this.renderJournal()
  }

  close(): void {
    this.contextPopup.close()
    if (this.chestOpen) this.send.closePanel()
    for (const id of ['#menu', '#journal', '#chest', '#skills', '#worldmap', '#profession', '#questlog', '#skillpanel']) $(id).classList.add('hidden')
    this.panels.close()
    this.picked = undefined
    this.drag = undefined
    this.showCarried()
    this.ai.stop()
  }

  onFrame(f: Frame): void {
    this.frame = f
    // the chest panel follows the open container the worker names
    if (f.container && !this.chestOpen) ($('#chest').classList.remove('hidden'), (this.chestSig = ''))
    if (!f.container && this.chestOpen) {
      this.contextPopup.close()
      $('#chest').classList.add('hidden')
    }
    if (this.chestOpen) this.renderChest(f)
    if (this.menuOpen && (this.tab === 'inventory' || this.tab === 'craft' || this.tab === 'shop')) this.renderLive()
    if (this.journalOpen && this.library && this.library.version !== this.journalLib) this.renderJournal()
    if (this.skillsOpen) this.skills.render(f)
    if (this.profession.open) this.profession.render(f)
    this.panels.onFrame(f)
    if (this.quests.open) this.quests.render(f)
    if (this.skillPanel.open) this.skillPanel.render(f)
  }

  /** The skill panel (U, or its button): every active skill one has, and the skill bar's slots. */
  toggleSkillPanel(): void {
    if (this.skillPanel.open) return this.close()
    this.close()
    this.skillPanel.show(this.frame)
  }

  /** The quest log (L, or its button). */
  toggleQuests(): void {
    if (this.quests.open) return this.close()
    this.close()
    this.quests.show(this.frame)
  }

  /** The commission board was read (docs/quests.md §3): the favours on offer, in the journal's sheet. */
  openBoard(who: string): void {
    this.close()
    this.quests.show(this.frame, who)
  }

  /** A trainer opened the choice of profession. */
  openProfession(): void {
    this.close()
    this.profession.show(this.frame)
  }

  /** A rule opened a panel of the game's own (or the runtime's for a module it uses), for the host that did: false when none answers the key. */
  openPanel(key: string, by?: string): boolean {
    if (!this.panels.has(key)) return false
    this.close()
    return this.panels.open(key, this.frame, by)
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
    // (a shop's panel is headed by the shop's own name)
    const title = this.tab === 'shop' && this.shop?.name ? esc(tx(this.shop.name)) : t(this.tab)
    const head = `<div class="tabs-row"><b class="sheet-title">${ICONS[this.tab]} ${title}</b><button class="x" id="menuClose">✕</button></div>`
    let body = ''
    if (this.tab === 'inventory') body = this.inventoryHtml(f)
    if (this.tab === 'craft') body = this.craftHtml(f)
    if (this.tab === 'shop') body = this.shopHtml(f)
    if (this.tab === 'options') body = this.optionsHtml()
    $('#menuSheet').innerHTML = head + `<div class="tab-body">${body}</div>`
    $('#menuClose').onclick = () => this.close()
    if (this.tab === 'inventory') this.wireInventory(f)
    if (this.tab === 'options') this.wireOptions()
    if (this.tab === 'craft' || this.tab === 'shop') this.wireCraft()
    if (this.tab === 'shop') $('#menuSheet').querySelectorAll<HTMLButtonElement>('[data-shelf]').forEach((b) => (b.onclick = () => ((this.shelf = b.dataset.shelf!), this.render())))
    if (f) {
      this.liveSig = this.sigOf(f)
      // (the purse's coin: its icon as the crafting panel paints a material's)
      if (this.tab === 'inventory') (this.paintPortrait(f), paintSilhouettes($('#menuSheet')))
      if (this.tab === 'inventory') this.paintIcons?.([...f.player.slots.filter(Boolean).map((s) => s!.item), ...Object.values(f.player.worn ?? {}), ...craftInfos().filter((i) => i.id === `need:${game().items.coin}`)])
      if (this.tab === 'craft' || this.tab === 'shop') {
        const infos = craftInfos()
        for (const it of infos) this.registerTip?.(it.id, it)
        this.paintIcons?.(infos)
      }
    }
    this.showCarried()
  }

  /** The player's portrait in the character sheet (the anime bust; the sprite's head while its layers come). */
  private paintPortrait(f: Frame, tries = 12): void {
    const host = $('#menuSheet').querySelector<HTMLElement>('.cs-portrait')
    const c = host && this.facesetOf?.(f.player.id)
    if (!host || !c) return
    host.classList.toggle('bust', c.dataset.bust === '1')
    host.replaceChildren(c)
    // the bust's layers may still be coming: look again shortly
    if (c.dataset.bust !== '1' && tries > 0) setTimeout(() => this.menuOpen && this.tab === 'inventory' && this.paintPortrait(f, tries - 1), 400)
  }

  private sigOf(f: Frame): string {
    const icons = [...f.player.slots.filter(Boolean).map((s) => s!.item), ...Object.values(f.player.worn ?? {}), ...(f.player.offhand ? [f.player.offhand] : [])]
    return `${this.tab}|${locale.value}|${f.player.hp}/${f.player.maxHp}|${f.player.hunger}|${f.player.purse}|${JSON.stringify(f.player.stats)}|${String(f.player.props.level)}|${JSON.stringify(f.player.slots.map((s) => s && [s.item.id, s.count]))}|${f.player.offhand?.id}:${f.player.offhand?.works}|${Object.entries(f.player.worn ?? {}).map(([k, v]) => k + v.id).join()}|${itemIconSignature(icons)}|${f.player.stations.join()}|${this.picked}|${artEpoch}`
  }

  // ---------------------------------------------------------------- inventory

  private slotHtml(s: Frame['player']['slots'][number], i: number, extra = ''): string {
    const key = i < ROW ? `<span class="key">${SLOT_KEYS[i]}</span>` : ''
    return `<div class="slot${extra}${gearFrame(s?.item)}" data-i="${i}" ${s ? `data-item="${s.item.id}"` : ''}>${key}${s ? `<div class="icon" data-icon="${s.item.id}"></div>${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}${s.worn ? '<span class="worn"></span>' : ''}` : ''}</div>`
  }

  private inventoryHtml(f?: Frame): string {
    if (!f) return ''
    const slots = f.player.slots
    // the toolbar row first (keys 1–0, set apart), then the rest of the bag
    const rows = chunk(slots.map((s, j) => this.slotHtml(s, j, (j === this.picked ? ' picked' : '') + (j === f.player.selected ? ' sel' : ''))), ROW)
      .map((r, k) => `<div class="grid-row${k === 0 ? ' toolbar-row' : ''}">${r.join('')}</div>`)
      .join('')
    // what is worn beside the bag (world-model.md §6.8): ten slots of the body and the off hand, as a paper doll;
    // the off hand greyed while what is there does not work (another profession's shield)
    const worn = f.player.worn ?? {}
    const off = f.player.offhand
    // the character sheet (world-model.md §6.8): the portrait in its frame, the body's slots down either side of it, the
    // main and the off hand beneath; the off hand greyed while what is there does not work (another profession's shield)
    const cell = ([key, ghost]: (typeof EQUIP)[number]) => {
      const it = worn[key]
      const dim = key === 'arm' && off && !off.works ? ' off' : ''
      return `<div class="eq-cell"><div class="slot eq-slot${dim}${it ? ' has' : ''}${gearFrame(it)}" data-wear="${key}" title="${esc(slotName(key))}${it ? ` · ${esc(tx(it.name))}` : ''}" ${it ? `data-item="${it.id}"` : ''}>${it ? `<div class="icon" data-icon="${it.id}"></div>` : silhouette(key, ghost)}</div><span class="eq-name">${esc(slotName(key))}</span></div>`
    }
    const byKey = Object.fromEntries(EQUIP.map((e) => [e[0], e]))
    const col = (keys: string[]) => `<div class="cs-col">${keys.map((k) => cell(byKey[k])).join('')}</div>`
    const p = f.player
    const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
    const level = Math.max(1, num(p.props.level) || 1)
    // the profession: the classes module's (none without it)
    const classes = hasModule('classes')
    const prof = classes && typeof p.props.profession === 'string' ? professionById()[p.props.profession] : undefined
    const stat = (label: string, value: string, cls = '', tip = '') => `<div class="cs-stat${cls}"${tip ? ` title="${esc(tip)}"` : ''}><span>${esc(label)}</span><b>${value}</b></div>`
    const pct = (v: number) => `${Math.round(v * 100)}%`
    const n = (v: number) => String(Math.round(v * 10) / 10)
    const plus = (v: number) => (v > 0 ? `+${pct(v)}` : v < 0 ? `−${pct(-v)}` : '—')
    // the numbers the engine fights with (snapshot.ts `stats`: World.stat), never summed here; food only for one who hungers;
    // the talents' numbers with the classes module; good and evil and faith with the society module (its conscience, moral)
    const s = p.stats as Record<string, number>
    const st = (k: string) => num(s?.[k])
    const society = hasModule('society')
    const karma = st('karma')
    const faith = st('faith')
    const stats = [
      stat(t('csHealth'), `${p.hp} / ${p.maxHp}`, ' cs-hp'),
      ...(p.maxHunger > 0 ? [stat(t('csFood'), `${p.hunger} / ${p.maxHunger}`, ' cs-food')] : []),
      stat(t('csAttack'), n(st('atk')), '', t('csAttackTip')),
      stat(t('csWeapon'), st('power') ? n(st('power')) : '—', '', t('csWeaponTip')),
      stat(t('csDefence'), n(st('def'))),
      ...(classes || st('critChance') ? [stat(t('csCritical'), pct(Math.min(1, st('critChance'))))] : []),
      ...(classes
        ? [
            stat(t('csCritDamage'), pct(1.5 + st('critDamage')), '', t('csCritDamageTip')),
            stat(t('csDodge'), pct(Math.min(0.5, st('dodge')))),
            stat(t('csLifesteal'), st('lifesteal') ? `+${st('lifesteal')}` : '—', '', t('csLifestealTip')),
            stat(t('csCooldowns'), plus(st('cdr'))),
          ]
        : []),
      stat(t('csExperience'), plus(st('xpRate'))),
      stat(t('csLuck'), plus(st('luck')), '', t('csLuckTip')),
      stat(t('csMoveSpeed'), plus(st('moveHaste'))),
      stat(t('csAttackSpeed'), plus(st('attackHaste'))),
      ...(society
        ? [
            stat(t('csKarma'), karma > 0 ? `${t('csGood')} +${karma}` : karma < 0 ? `${t('csEvil')} +${-karma}` : t('csNeutral'), karma > 0 ? ' cs-good' : karma < 0 ? ' cs-evil' : '', t('csKarmaTip')),
            stat(t('csFaith'), faith > 0 ? `+${faith}` : faith < 0 ? `−${-faith}` : '0', faith < 0 ? ' cs-doubt' : faith > 0 ? ' cs-faith' : '', t('csFaithTip')),
          ]
        : []),
    ].join('')
    const coin = coinOf()
    const purse = coin
      ? `<span class="purse" title="${esc(t('csPurse'))}"><span class="icon" data-icon="need:${esc(coin.type)}"></span><b>${p.purse || this.coinsOf(f)}</b><small>${esc(tx(coin.name))}</small></span>`
      : ''
    const sheet = `<div class="cs">
        <div class="cs-head"><span class="cs-lv">${esc(t('csLevel'))} ${level}</span>${classes ? `<span class="cs-prof">${esc(prof ? tx(prof.name) : t('csNoProfession'))}</span>` : ''}</div>
        <div class="cs-doll">
          ${col(['head', 'ear', 'neck', 'shoulders', 'body'])}
          <div class="cs-figure"><div class="cs-portrait" data-portrait="${p.id}"></div><div class="cs-hands">${cell(byKey.weapon)}${cell(byKey.arm)}</div></div>
          ${col(['hands', 'ring', 'ring.2', 'waist', 'feet'])}
        </div>
        <div class="cs-stats">${stats}</div>
      </div>`
    return `<div class="inv-wrap">${sheet}<div class="inv-side"><div class="inv-title"><span>${esc(t('csPack'))}</span>${purse}</div><div class="inv">${rows}</div>
      <div class="inv-foot">
        <button id="bOrganize">⇅ ${t('organize')}</button>
        <button id="bDrop" ${this.picked === undefined ? 'disabled' : ''}>⤓ ${t('dropHere')}</button>
      </div>
      <div class="inv-help muted small">${esc(t('invHelp'))}</div>
    </div></div>
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
      // as in Stardew's bag: a press picks a thing up onto the pointer — dragged, it goes where it is let go
      // (letGo); let go where it was, it rides the pointer until a click sets it down (or out of the bag drops it)
      el.onmousedown = (e) => {
        if (e.button !== 0) return
        e.preventDefault()
        if (e.shiftKey && this.picked === undefined) return void (slots[i] && this.send.quickMove(i))
        if (this.picked === undefined) {
          if (!slots[i]) return
          this.picked = i
          this.drag = { x: e.clientX, y: e.clientY, moved: false }
          this.carried.style.transform = `translate(${e.clientX - 16}px, ${e.clientY - 16}px)`
        } else {
          if (this.picked !== i) this.send.swap(this.picked, i)
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
        const wear: [string, () => void][] = !s.item.props.slot ? [] : [[off ? (zh ? '卸下' : 'Take off') : s.item.props.slot === 'arm' ? (zh ? '装备到副手' : 'Wear in the off hand') : s.item.props.slot === 'weapon' ? (zh ? '装备到主手' : 'Ready in the main hand') : (zh ? '装备' : 'Wear'), () => this.send.wear(s.item.id, !off)]]
        this.contextMenu(e.clientX, e.clientY, s.item.id, [...wear, [t('dropHere'), () => this.send.drop(i, true)]])
      }
    })
  }

  /** The context menu on an item: use the held thing on it, put the held thing into it, handle it bare-handed — and extras. */
  private contextMenu(x: number, y: number, item: string, extra: [string, () => void][] = []): void {
    const held = this.frame?.player.held
    const target = this.frame && [this.frame.player.held, ...this.frame.player.slots.map((s) => s?.item), ...Object.values(this.frame.player.worn ?? {}), ...(this.frame.container?.contents ?? [])].find((it) => it?.id === item)
    const heldName = held ? tx(held.name) : ''
    const rows: [string, () => void][] = []
    if (held && held.id !== item) {
      const use = target && game().itemContextAction?.('use', held, target)
      if (use !== false) rows.push([use ? tx(use) : t('useOn').replace('{held}', heldName), () => this.send.keyOnItem('use', item)])
      const put = target && game().itemContextAction?.('put', held, target)
      if (put !== false) rows.push([put ? tx(put) : t('putIn').replace('{held}', heldName), () => this.send.keyOnItem('put', item)])
    }
    rows.push([t('handsOn'), () => this.send.keyOnItem('hands', item)], ...extra)
    this.contextPopup.show(x, y, rows)
  }

  // ---------------------------------------------------------------- crafting

  /** Don't Starve's panel: each recipe, what it needs against what is carried, and a button that makes it. */
  /** A shop (the game's `crafting.shops`): its shelves as tabs, one's coin, and the shelf's offers made as recipes are. */
  /** The coin one carries: every stack of the game's coin in the bag (and in hand). */
  private coinsOf(f: Frame): number {
    return f.player.slots.reduce((n, s) => n + (s && s.item.type === game().items.coin ? s.count : 0), 0)
  }

  private shopHtml(f?: Frame): string {
    const shop = this.shop
    if (!f || !shop) return ''
    const coins = this.coinsOf(f)
    const tabs = shop.shelves.map((s) => `<button class="cx-tab${s.group === this.shelf ? ' on' : ''}" data-shelf="${esc(s.group)}">${esc(tx(s.name))}</button>`).join('')
    const away = !f.player.stations.includes(shop.station) ? `<div class="muted small">${esc(t('shopAway').replace('{station}', tx(game().crafting.stationName(shop.station))))}</div>` : ''
    return `<div class="shop-head"><div class="cx-tabs">${tabs}</div><span class="coins"><span class="icon" data-icon="need:${game().items.coin}"></span>${coins}</span></div>${away}${this.craftHtml(f, shop.shelves.find((s) => s.group === this.shelf))}`
  }

  private craftHtml(f?: Frame, shelf?: ShopDef['shelves'][number]): string {
    if (!f) return ''
    const have = (type: string) => f.player.slots.reduce((n, s) => n + (s && s.item.type === type ? s.count : 0), 0)
    const tool = (tag: string) => f.player.slots.some((s) => s?.item.tags.includes(tag))
    // the crafting panel shows what is made; the stall's offers are the stall's (its own tab)
    const list = shelf ? game().crafting.recipes.filter((r) => r.station === this.shopStation && r.group === shelf.group) : allRecipes().filter((r) => !shopStations().has(r.station ?? ''))
    const verb = shelf?.sell ? t('shopSell') : shelf ? t('shopBuy') : t('craftIt')
    const rows = list.map((r) => {
      // how many times what is carried makes it (the tools are not used up)
      // (a station's recipe is made beside one: away from it, nothing is made however much is carried)
      const here = !r.station || r.station === 'hands' || f.player.stations.includes(r.station)
      // (a recipe a skill teaches: known only once it is learned)
      const knows = !r.skill || f.player.skills.includes(r.skill)
      const times = knows && here && (r.tools ?? []).every(tool) ? Math.min(...r.needs.map((n) => Math.floor(have(n.type) / n.count))) : 0
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
        <div class="rname">${esc(tx(r.name))}${r.station && r.station !== 'hands' && !shelf ? ` <span class="station${here ? '' : ' short'}">${esc(tx({ en: `at a ${game().crafting.stationName(r.station).en}`, zh: `需在${game().crafting.stationName(r.station).zh}旁` }))}</span>` : ''}${r.skill ? ` <span class="station${knows ? '' : ' short'}">${esc(tx({ en: `skill: ${tx(game().skills.all.find((d) => d.id === r.skill)?.name)}`, zh: `需学会${tx(game().skills.all.find((d) => d.id === r.skill)?.name)}` }))}</span>` : ''}</div>
        <div class="needs">${needs}</div>
        <button data-craft="${r.id}" ${ok ? '' : `disabled title="${esc(here ? t('needMore') : tx({ en: `Stand beside a ${game().crafting.stationName(r.station!).en}`, zh: `站到${game().crafting.stationName(r.station!).zh}旁边` }))}"`}>${verb}${shelf?.sell ? ` → ${r.count}` : r.count && r.count > 1 ? ` ×${r.count}` : ''}</button>
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
      <div class="opt"><span>${t('optTracker')}</span><button id="oTracker">${prefs.get('tracker') ? t('on') : t('off')}</button></div>
      <div class="opt"><span>${t('optMarkers')}</span><button id="oMarkers">${prefs.get('markers') ? t('on') : t('off')}</button></div>
      ${game().worldFilter ? `<div class="opt"><span>${t('optFilter')}</span><button id="oFilter">${t({ off: 'filterOff', light: 'filterLight', full: 'filterFull' }[prefs.filter()])}</button></div>` : ''}
      <div class="opt"><button id="oSave">${t('save')}</button><button id="oNew">${t('toTitle')}</button>${import.meta.env.DEV ? `<button id="oDev">${t('devConsole')}</button>` : ''}</div>
      ${this.ai.html()}
      <h4>${t('controls')}</h4>${controlsTable(import.meta.env.DEV)}
    </div>`
  }

  private wireOptions(): void {
    $('#oLang').onclick = () => (this.send.toggleLocale(), this.render())
    $('#oSound').onclick = () => (this.send.toggleSound(), (this.muted = !this.muted), this.render())
    $('#oTracker').onclick = () => (prefs.set('tracker', !prefs.get('tracker')), this.render())
    $('#oMarkers').onclick = () => (prefs.set('markers', !prefs.get('markers')), this.render())
    document.querySelector<HTMLButtonElement>('#oFilter')?.addEventListener('click', () => {
      const next = { off: 'light', light: 'full', full: 'off' } as const
      prefs.setFilter(next[prefs.filter()])
      this.render()
    })
    $('#oSave').onclick = () => this.send.save()
    // back to the cover (saved first): new games and other slots start there
    $('#oNew').onclick = () => (this.close(), this.send.newGame())
    document.querySelector<HTMLButtonElement>('#oDev')?.addEventListener('click', () => (this.close(), this.send.devConsole?.()))
    this.ai.wire($('#menuSheet'))
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
      const pic = person && typeof e.look === 'object' ? `data-cx-fig="${esc(JSON.stringify(e.look))}"` : person ? `data-cx-look="${esc(personLook(e.id, e.type ?? '', typeof e.look === 'string' ? e.look : undefined))}"` : e.group ? `data-cx-item="${esc(e.sprite ?? '')}"` : `data-cx-actor="${esc(actorKey(e))}"`
      const name = e.known ? esc(tx(e.name)) : '???'
      const extra = !e.known ? '' : e.stats ? `<div class="cx-sub">❤ ${e.stats.hp} · ⚔ ${e.stats.atk} · 🛡 ${e.stats.def}</div>` : e.where ? `<div class="cx-sub">${esc(tx(e.where))}</div>` : ''
      return `<div class="cx-card${e.known ? '' : ' unknown'}" title="${name}"><div class="cx-pic" ${pic}></div><div class="cx-name">${name}</div>${extra}</div>`
    }
    if (!list.some((e) => e.group)) return `<div class="cx-grid">${list.map(card).join('')}</div>`
    const groups = new Map<string, CodexEntry[]>()
    for (const e of list) groups.set(e.group!, [...(groups.get(e.group!) ?? []), e])
    return [...groups].map(([g, es]) => `<div class="cx-group">${esc(groupName(g))} <small>${es.filter((e) => e.known).length}/${es.length}</small></div><div class="cx-grid">${es.map(card).join('')}</div>`).join('')
  }

  /**
   * Every thread the world has learned, newest first, and whose act taught it (design.md §5.11,
   * legibility): one's own request, the world's, or a thread synced from the shared library (no
   * request of this game's). The doc is the model's English; in Chinese the thread's label says
   * what it does (its roles named plainly), the doc beneath it.
   */
  private threadsHtml(): string {
    const threads = [...(this.library?.patches ?? [])].reverse()
    if (!threads.length) return `<div class="muted pad">${t('noThreads')}</div>`
    const zh = locale.value === 'zh'
    return `<div class="threads">${threads
      .map((r: Rule) => {
        const by = r.source?.trigger === 'world' ? t('world') : r.source?.request ? t('you') : t('shared')
        const doc = r.doc ?? r.id.replace(/^patch\//, '').replace(/-/g, ' ')
        const label = zh ? threadLabel(r) : undefined
        const what = label ? `<div>${esc(label)}</div><div class="muted small">${esc(doc)}</div>` : `<div>${esc(doc)}</div>`
        return `<div class="thread">${what}<div class="muted small">${t('wovenBy')}: ${by}${r.source?.at ? ` · ${esc(r.source.at.slice(0, 10))}` : ''}</div></div>`
      })
      .join('')}</div>`
  }

  // ---------------------------------------------------------------- the chest panel

  private chestSig = ''
  private renderChest(f: Frame): void {
    const c = f.container
    if (!c) return
    const moving = this.containerTransfer
    const sig = `${locale.value}|${c.id}|${c.capacity}|${c.contents.map((i) => i.id + keyOf(i)).join(',')}|${JSON.stringify(f.player.slots.map((s) => s && [s.item.id, s.count]))}|${JSON.stringify(moving)}`
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
    const action = moving?.from === 'bag' ? (zh ? '正在存放' : 'Storing') : (zh ? '正在取出' : 'Taking')
    const hint = moving
      ? `${action}… ${moving.done} / ${moving.total} · ${zh ? '关闭箱子可停止' : 'Close to stop'}`
      : (zh ? '点击：整堆移到另一边 · Shift+点击：移一个 · 右键：更多' : 'Click: the stack across · Shift+click: one · right click: more')
    $('#chestSheet').innerHTML = `
      <div class="jhead"><b>${esc(tx(c.name))}</b><span class="muted small">${stacks.length} / ${c.capacity ?? '∞'}</span><button class="x" id="cClose">✕</button></div>
      <div class="inv chest-grid">${chunk(chestCells, ROW).map((r) => `<div class="grid-row">${r.join('')}</div>`).join('')}</div>
      <div class="inv-foot"><button id="cFill" ${moving ? 'disabled' : ''}>⇣ ${t('fillStacks')}</button><button id="cOrg" ${moving ? 'disabled' : ''}>⇅ ${t('organize')}</button><span class="muted small" ${moving ? 'role="status"' : ''}>${hint}</span></div>
      <div class="inv bag-grid">${chunk(
        bag.map((s, j) => (s ? `<div class="slot" data-b="${s.item.id}" data-item="${s.item.id}"><div class="icon" data-icon="${s.item.id}"></div>${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}</div>` : `<div class="slot" data-i="${j}"></div>`)),
        ROW,
      )
        .map((r, k) => `<div class="grid-row${k === 0 ? ' toolbar-row' : ''}">${r.join('')}</div>`)
        .join('')}</div>`
    const sheet = $('#chestSheet')
    sheet.setAttribute('aria-busy', String(!!moving))
    $('#cClose').onclick = () => this.close()
    const move = (from: 'chest' | 'bag', id: string, all: boolean) => {
      if (!this.containerTransfer) this.send.transfer(from, id, all)
    }
    // click: the stack across; Shift+click: one; right click: the context menu
    sheet.querySelectorAll<HTMLElement>('[data-c]').forEach((el) => {
      el.onclick = (e) => move('chest', el.dataset.c!, !e.shiftKey)
      el.oncontextmenu = (e) => (e.preventDefault(), !this.containerTransfer && this.contextMenu(e.clientX, e.clientY, el.dataset.c!, [[t('moveOne'), () => move('chest', el.dataset.c!, false)]]))
    })
    sheet.querySelectorAll<HTMLElement>('[data-b]').forEach((el) => {
      el.onclick = (e) => move('bag', el.dataset.b!, !e.shiftKey)
      el.oncontextmenu = (e) => (e.preventDefault(), !this.containerTransfer && this.contextMenu(e.clientX, e.clientY, el.dataset.b!, [[t('moveOne'), () => move('bag', el.dataset.b!, false)]]))
    })
    $('#cOrg').onclick = () => { if (!this.containerTransfer) this.send.organize() }
    $('#cFill').onclick = () => {
      // every bag stack whose kind the chest already holds goes in
      const inChest = new Set(stacks.map((s) => keyOf(s[0])))
      for (const s of bag) if (s && inChest.has(keyOf(s.item))) move('bag', s.item.id, true)
    }
    this.paintIcons?.([...stacks.map((s) => s[0]), ...bag.filter(Boolean).map((s) => s!.item)])
  }
}

/** The recipes of things the world learned (the worker's `recipes`): made like the content's, listed after them. */
let LEARNED: Recipe[] = []
export function setLearnedRecipes(recipes: Recipe[]): void {
  LEARNED = recipes
}
/** The game's recipes, and the learned things' after them. */
const allRecipes = (): Recipe[] => [...game().crafting.recipes, ...LEARNED.filter((l) => !game().crafting.recipes.some((r) => r.id === l.id))]

/** The crafting panel's items (each recipe's result, each material), keyed `recipe:<id>` / `need:<type>`: for their icons and tooltips. */
export function craftInfos(): ItemInfo[] {
  const of = (id: string, type: string, extra: { name?: ItemInfo['name']; tags?: string[]; props?: ItemInfo['props']; sprite?: string } = {}): ItemInfo | undefined => {
    const f = game().items.forms[type]
    // what is not an item form (a wall, a door, a bed) shows the recipe's own picture
    if (!f) return extra.sprite && extra.name ? { id, type, sprite: extra.sprite, name: extra.name, tags: [...(extra.tags ?? [])], statuses: [], props: { ...(extra.props ?? {}) } } : undefined
    return { id, type, sprite: f.sprite, name: extra.name ?? { en: f.en, zh: f.zh }, tags: [...(f.tags ?? []), ...(extra.tags ?? [])], statuses: [], props: { ...(f.props ?? {}), ...(extra.props ?? {}) } }
  }
  const recipes = allRecipes()
  const needs = [...new Set([...recipes.flatMap((r) => r.needs.map((n) => n.type)), ...recipes.flatMap((r) => (r.tools ?? []).map(toolForm)).filter((x): x is string => !!x)])]
  // a learned thing a recipe needs shows the picture and name of the recipe that makes it
  const made = (n: string) => recipes.find((r) => r.make.type === n)
  return [...recipes.map((r) => of(`recipe:${r.id}`, r.make.type, { name: r.name, tags: r.make.tags, props: r.make.props, sprite: r.sprite })), ...needs.map((n) => of(`need:${n}`, n, made(n) ? { name: made(n)!.name, sprite: made(n)!.sprite } : {}))].filter((x): x is ItemInfo => !!x)
}

/** The item form that stands for a tool tag in the crafting panel (an axe for `tool:axe`). */
function toolForm(tag: string): string | undefined {
  return Object.values(game().items.forms).find((f) => f.tags?.includes(tag))?.id
}

function keyOf(it: ItemInfo): string {
  return stackKey(it)
}

/** What one slot holds: a stack of one kind, up to STACK_MAX (a kind beyond that takes the next slot). */
function stackItems(items: ItemInfo[]): ItemInfo[][] {
  return splitStacks(items)
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n))
  return out
}

