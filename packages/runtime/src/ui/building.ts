import type { Dir, Frame, PlacementPreview, PlacementRecipe, Recipe, Text } from '@openworld/engine'
import { game, ontology, perGame } from '../game.ts'
import type { Tile, ToWorker } from '../protocol.ts'
import { esc, locale, tx } from './common.ts'
import { artEpoch } from '../render/assets.ts'

/** What the palette offers: a placement recipe (a campfire, a chest, sowing), or setting a built thing down (`put:<type>`). */
interface Entry {
  id: string
  category: PlacementRecipe['category']
  name: Text
  description: Text
  sprite: string
  /** For a recipe: what it takes. For a thing set down: what makes one (when none is carried). */
  needs: { name: Text; count: number; type?: string; match?: PlacementRecipe['needs'][number]['match']; consume?: boolean }[]
  /** The type a `put:` entry sets down. */
  put?: string
  /** The type a recipe builds (a fence). */
  result?: string
}

/** The spaces a type takes in its cell (docs/building.md §3): a floor takes the floor; a wall, a door, stairs the volume. */
const spaces = (type?: string): string[] => {
  for (let t = type; t; t = t.includes('/') ? t.slice(0, t.lastIndexOf('/')) : undefined) if (ontology().types[t]?.occupies) return ontology().types[t].occupies!
  return []
}
/** A floor: laid on one's storey, or (R) in the ceiling over it. */
const lays = (type?: string) => spaces(type).includes('floor')
/** A thing that turns (stairs, a fence): it is set down facing a way (R turns it; by hand, away from one). */
const turns = (type?: string): boolean => {
  for (let t = type; t; t = t.includes('/') ? t.slice(0, t.lastIndexOf('/')) : undefined) if (ontology().types[t]?.tags?.includes('turns')) return true
  return false
}
/** A block drawn a storey high (its front in the cell, its top a tile up): a wall, a door, stairs. */
const block = (type?: string) => !!type?.startsWith('structure/') && spaces(type).includes('volume')

/** A built thing or a fixture, set in a cell as part of a place (the engine's Controls.placeable). */
export const placeable = (type: string) => type.startsWith('structure/') || type.startsWith('fixture/')
const PUT_HELP: Text = { en: 'Set down one you carry (as G does); with none, one is made from what you carry first.', zh: '放下身上带着的一个（和 G 一样）；身上没有时，先用身上的材料现做一个。' }

const fromRecipe = (r: PlacementRecipe): Entry => ({ id: r.id, category: r.category, name: r.name, description: r.description, sprite: r.sprite, result: r.result, needs: r.needs.map((n) => ({ name: n.name, count: n.count, match: n.match, consume: n.consume })) })

/** What the palette holds in a game where nothing is built. */
const NOTHING: Entry = { id: '', category: 'building', name: { en: 'Nothing to build', zh: '没有可建造的东西' }, description: '', sprite: '', needs: [] }

/** Setting down a thing a recipe makes: one carried, or one made first from what the recipe needs. */
const madeEntry = (r: Recipe): Entry => ({
  id: `put:${r.make.type}`,
  category: 'building',
  name: r.name,
  description: PUT_HELP,
  sprite: r.sprite,
  put: r.make.type,
  needs: r.needs.map((n) => ({ name: game().items.forms[n.type] ? { en: game().items.forms[n.type].en, zh: game().items.forms[n.type].zh } : { en: n.type.split('/').pop()!, zh: n.type.split('/').pop()! }, count: n.count, type: n.type, consume: true })),
})
/** The things one makes and sets down (walls, floors, doors, beds, a workbench): from the recipes that make them. */
const made = (): Entry[] => perGame('build:made', () => game().crafting.recipes.filter((r) => placeable(r.make.type)).map(madeEntry))
/** The things the world learned to make and set down (the worker's `recipes`): after the game's. */
let LEARNED: Entry[] = []
export function setLearnedPlaceables(recipes: Recipe[]): void {
  LEARNED = recipes.filter((r) => placeable(r.make.type) && !made().some((m) => m.put === r.make.type)).map(madeEntry)
}

/**
 * The build palette (B): everything one can set in a place — the things one makes and carries
 * (set down as G does, one made first from what is carried when none is), then the placement
 * recipes (a campfire built from stones and sticks, a chest from planks, sowing). A live-world
 * palette: unlike menus it never pauses the simulation. Hold the left button and drag to set a
 * row of them down.
 */
export class BuildingMode {
  open = false
  // (a game with nothing to build: the palette holds nothing, and nothing is set down from it)
  selected: Entry = made()[0] ?? (game().crafting.buildings[0] ? fromRecipe(game().crafting.buildings[0]) : NOTHING)
  category: PlacementRecipe['category'] = 'building'
  frame?: Frame
  preview?: PlacementPreview
  aim?: Tile
  paint?: (sprite: string, across?: boolean) => HTMLCanvasElement | undefined
  /** The left button is down: each new cell the pointer enters gets one too. */
  dragging = false
  /** The way what is set down faces (R turns it; stairs go up it); none: away from the player. */
  facing?: Dir
  /** A floor laid in the ceiling over the cell aimed at, not on one's own storey (R turns it). */
  up = false
  /** The palette opened or shut, or switched to laying ceilings: the view shows one's own storey while it is open, and the ceilings where they are drawn while one lays them. */
  onView?: (open: boolean, ceilings: boolean) => void
  private arrow = document.createElement('div')

  private lastPlaced = ''
  private panel = document.createElement('section')
  private ghost = document.createElement('div')
  private signature = ''
  private detailSignature = ''
  private listSignature = ''
  constructor(private send: (m: ToWorker) => void, private screen: (x: number, y: number) => { x: number; y: number; scale: number }) {
    this.panel.id = 'buildingMode'
    this.panel.className = 'build-panel wood hidden'
    this.panel.setAttribute('aria-label', 'Construction and farming')
    this.ghost.className = 'build-ghost hidden'
    this.arrow.className = 'build-arrow'
    document.body.append(this.panel, this.ghost)
    this.panel.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
      if (!button) return
      if (button.dataset.close) return this.toggle(false)
      if (button.dataset.category) {
        this.category = button.dataset.category as PlacementRecipe['category']
        this.selected = this.entries()[0] ?? NOTHING
        this.render()
      } else if (button.dataset.recipe) {
        this.selected = this.entries().find((r) => r.id === button.dataset.recipe) ?? this.selected
        if (!lays(this.selected.put)) this.up = false
        this.onView?.(this.open, this.ceiling())
        this.preview = undefined
        this.render()
      }
      this.refreshAim(true)
    })
    this.panel.addEventListener('contextmenu', (e) => { e.preventDefault(); this.toggle(false) })
  }

  /** The palette's entries in the open category: what is made and set down first, then the placement recipes. */
  private entries(): Entry[] {
    if (this.category !== 'building') return game().crafting.placements.filter((r) => r.category === this.category).map(fromRecipe)
    // anything else carried that is set in a place (a found chest, a crate) is offered too
    const carried = [...(this.frame?.player.inventory ?? []), ...(this.frame?.player.held ? [this.frame.player.held] : [])]
    const extra = [...new Map(carried.filter((it) => placeable(it.type) && ![...made(), ...LEARNED].some((m) => m.put === it.type)).map((it) => [it.type, it])).values()]
      .map((it): Entry => ({ id: `put:${it.type}`, category: 'building', name: it.name, description: PUT_HELP, sprite: it.sprite, put: it.type, needs: [] }))
    return [...made(), ...LEARNED, ...extra, ...game().crafting.buildings.map(fromRecipe)]
  }

  /** R: a floor between one's storey and the ceiling over it; anything else the next way round (clockwise), from the way it would face now. */
  rotate(): void {
    if (lays(this.selected.put)) {
      this.up = !this.up
      this.onView?.(this.open, this.ceiling())
      this.refreshAim(true)
      return
    }
    const ways: Dir[] = ['up', 'right', 'down', 'left']
    this.facing = ways[(ways.indexOf(this.facing ?? this.away()) + 1) % 4]
    this.tick()
    this.details()
  }
  /** Away from the player toward the cell aimed at (how a thing set down faces unless turned). */
  private away(): Dir {
    const p = this.frame?.player
    const at = this.target()
    if (!p || !at) return 'up'
    const dx = at.x - p.x
    const dy = at.y - p.y
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
  }
  toggle(on = !this.open): void {
    this.open = on
    this.dragging = false
    this.facing = undefined
    this.up = false
    this.panel.classList.toggle('hidden', !on)
    this.ghost.classList.toggle('hidden', !on)
    this.onView?.(on, false)
    document.getElementById('buildBtn')?.classList.toggle('active', on)
    if (on) { this.preview = undefined; this.render(); this.refreshAim(true) }
    else this.send({ t: 'buildAim' })
  }
  onFrame(f: Frame): void {
    this.frame = f
    if (!this.open) return
    if (f.scene || f.question || f.container) return this.toggle(false)
    // what is carried changes what is offered (a found crate)
    const list = `${this.entries().map((e) => e.id).join('|')}|${artEpoch}`
    if (list !== this.listSignature) this.render()
    this.refreshAim()
    this.details()
  }
  setAim(tile?: Tile): void {
    this.aim = tile
    if (!this.open) return
    this.refreshAim()
    // dragging: each new cell gets one too
    const at = this.slot(tile)
    if (this.dragging && tile && at && `${at.x},${at.y}` !== this.lastPlaced) this.place(tile)
  }
  onPreview(p: PlacementPreview): void {
    const a = this.slot()
    if (!this.open || p.id !== this.selected.id || p.at.map !== this.frame?.map || p.at.x !== a?.x || p.at.y !== a?.y) return
    this.preview = p
    this.details()
    this.tick()
  }
  private target(): Tile | undefined {
    if (this.aim) return this.aim
    const p = this.frame?.player
    if (!p) return
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p.facing]
    return { x: p.x + dx, y: p.y + dy }
  }
  /** Laying a floor as the ceiling (R). */
  private ceiling(): boolean {
    return this.up && lays(this.selected.put)
  }
  /**
   * The cell built (docs/building.md §5: where one points, it is built and shown): on one's storey, the
   * cell pointed at; laying the ceiling, the cell whose ceiling is drawn at the pointer (the view's
   * `over`: a storey up is drawn a tile up), or with no pointer the cell in front.
   */
  private slot(t: Tile | undefined = this.aim): Tile | undefined {
    if (!this.ceiling()) return t ?? this.target()
    if (t) return { x: t.over?.x ?? t.x, y: t.over?.y ?? t.y + 1 }
    return this.target()
  }
  private refreshAim(force = false): void {
    const tile = this.slot()
    const sig = `${this.selected.id}|${this.frame?.map}|${tile?.x},${tile?.y}|${this.up}`
    if (force || sig !== this.signature) {
      this.signature = sig
      this.preview = undefined
      this.send({ t: 'buildAim', id: this.selected.id, tile, ...(this.up && { up: true }) })
      this.details()
    }
    this.tick()
  }
  place(tile?: Tile): void {
    if (!this.open || !this.selected.id) return
    const at = this.slot(tile)
    if (!at) return
    this.lastPlaced = `${at.x},${at.y}`
    this.send({ t: 'build', id: this.selected.id, tile: at, ...(this.facing && { facing: this.facing }), ...(this.up && { up: true }) })
  }
  /** The left button: one set down here, and (held) one in each cell it is dragged over. */
  press(tile?: Tile): void {
    this.dragging = true
    this.place(tile)
  }
  release(): void {
    this.dragging = false
    this.lastPlaced = ''
  }
  tick(): void {
    const at = this.slot()
    if (!this.open || !at || !this.frame) return
    const type = this.selected.put ?? this.selected.result
    this.showTurn(turns(type) ? this.facing ?? this.away() : undefined, type, this.selected.sprite)
    this.drawGhost(at, this.selected.put, this.ceiling())
    this.ghost.classList.toggle('valid', !!this.preview?.ok)
    this.ghost.classList.toggle('invalid', !this.preview?.ok)
  }

  /** The thing in hand the left click sets down (it builds, outside the palette): its ghost where it will be drawn. */
  hand(up: boolean): void {
    if (this.open) return
    const k = this.frame?.keys?.use
    const held = this.frame?.player.held
    const on = !!k?.sets && !!held && placeable(held.type)
    this.ghost.classList.toggle('hidden', !on)
    if (!on || !k || !held) return
    // by hand, what turns faces away from one (its front toward one): the way one faces it
    const p = this.frame?.player
    const dx = k.x - (p?.x ?? k.x)
    const dy = k.y - (p?.y ?? k.y)
    this.showTurn(turns(held.type) && (dx || dy) ? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up') : undefined, held.type, held.sprite)
    this.drawGhost({ x: k.x, y: k.y }, held.type, up && lays(held.type))
    this.ghost.classList.add('valid')
    this.ghost.classList.remove('invalid')
  }

  /** The ghost's picture: the thing's, across when it faces east or west (a fence running north-south). */
  private artSig = ''
  private setArt(sprite: string, across = false): void {
    const sig = `${sprite}|${across}|${artEpoch}`
    if (sig === this.artSig) return
    this.artSig = sig
    this.ghost.replaceChildren()
    const art = this.paint?.(sprite, across)
    if (art) this.ghost.append(art)
  }

  /** The way what turns will face: the arrow (stairs go up it), and a fence's picture across when it faces east or west. */
  private showTurn(way: Dir | undefined, type: string | undefined, sprite: string): void {
    this.setArt(sprite, !!way && (way === 'left' || way === 'right') && !block(type))
    if (way) {
      this.arrow.textContent = { up: '↑', right: '→', down: '↓', left: '←' }[way]
      if (this.arrow.parentElement !== this.ghost) this.ghost.append(this.arrow)
    } else this.arrow.remove()
  }

  /**
   * The ghost over the cell built, where it will be drawn (docs/building.md §5): a block a storey high
   * (its top a tile up), a floor on its cell, a ceiling a storey up (a tile up) - as it will be shown.
   */
  private drawGhost(at: Tile, type: string | undefined, up: boolean): void {
    const p = this.screen(at.x, at.y)
    const size = 16 * p.scale
    const tall = block(type)
    this.ghost.style.left = `${p.x}px`
    this.ghost.style.top = `${p.y - (tall ? size / 2 : up ? size : 0)}px`
    this.ghost.style.width = `${size}px`
    this.ghost.style.height = `${tall ? size * 2 : size}px`
    this.ghost.classList.toggle('ceiling', up)
    const canvas = this.ghost.querySelector('canvas')
    if (canvas) {
      canvas.style.width = `${canvas.width * p.scale}px`
      canvas.style.height = `${canvas.height * p.scale}px`
    }
  }
  private render(): void {
    const zh = locale.value === 'zh'
    const entries = this.entries()
    this.listSignature = `${entries.map((e) => e.id).join('|')}|${artEpoch}`
    if (!entries.some((e) => e.id === this.selected.id)) this.selected = entries[0] ?? NOTHING
    this.panel.innerHTML = `<header><strong>${zh ? '建筑模式' : 'BUILD MODE'}</strong><button data-close="1" title="B / Esc">×</button></header>
      <nav><button data-category="building" class="${this.category === 'building' ? 'chosen' : ''}">${zh ? '建筑' : 'Structures'}</button><button data-category="farming" class="${this.category === 'farming' ? 'chosen' : ''}">${zh ? '种植' : 'Farming'}</button></nav>
      <div class="build-recipes">${entries.map((r) => `<button data-recipe="${r.id}" class="${r.id === this.selected.id ? 'chosen' : ''}"><span class="build-art" data-sprite="${r.sprite}"></span><span>${esc(tx(r.name))}</span></button>`).join('')}</div>
      <div class="build-details"></div><footer>${zh ? '左键 / E 放置 · 按住左键拖动连续放置 · B / Esc / 右键退出<br>WASD 移动 · 世界时间继续' : 'Left click / E place · hold and drag to place a row · B / Esc / RMB exit<br>WASD move · Time keeps moving'}</footer>`
    this.panel.querySelectorAll<HTMLElement>('[data-sprite]').forEach((el) => {
      const c = this.paint?.(el.dataset.sprite!)
      if (c) el.append(c)
    })
    this.artSig = ''
    this.setArt(this.selected.sprite)
    this.detailSignature = ''
    this.details()
  }
  private details(): void {
    if (!this.open) return
    const zh = locale.value === 'zh'
    const carried = [...(this.frame?.player.inventory ?? []), ...(this.frame?.player.held ? [this.frame.player.held] : [])]
    const s = this.selected
    const countOf = (n: Entry['needs'][number]) =>
      carried.filter((it) => (n.type ? it.type === n.type : (!n.match?.type || it.type === n.match.type || it.type.startsWith(n.match.type + '/')) && (n.match?.tags ?? []).every((tag) => it.tags.includes(tag)))).length
    // a thing set down: how many are carried; what makes one (when none is)
    const have = s.put ? carried.filter((it) => it.type === s.put).length : 0
    const counts = !s.put && this.preview?.have ? this.preview.have : s.needs.map(countOf)
    const nameOf = (n: Entry['needs'][number]) => (n.type ? (carried.find((it) => it.type === n.type)?.name ?? n.name) : n.name)
    const turn = s.put === 'structure/stairs'
      ? `<p>${zh ? 'R 旋转：楼梯朝箭头方向往上' : 'R turns it: the stairs go up the way the arrow points'}</p>`
      : lays(s.put)
        ? `<p>${zh ? `R 切换：铺在本层 / 铺成天花板（现在：${this.up ? '天花板' : '本层'}）` : `R switches: on this storey / as the ceiling (now: ${this.up ? 'the ceiling' : 'this storey'})`}</p>`
        : ''
    const carriedLine = turn + (s.put ? `<p class="${have ? 'enough' : 'missing'}">${zh ? `身上有 ${have} 个` : `${have} carried`}${!have && s.needs.length ? (zh ? ' · 将用材料现做：' : ' · one will be made from:') : ''}</p>` : '')
    const cost = !s.put || !have ? `<div class="build-cost">${s.needs.map((n, i) => `<span class="${counts[i] < n.count ? 'missing' : 'enough'}">${esc(tx(nameOf(n)))} ${counts[i]}/${n.count}${n.consume === false ? (zh ? '（工具）' : ' (tool)') : ''}</span>`).join('')}</div>` : ''
    const html = `<h3>${esc(tx(s.name))}</h3><p>${esc(tx(s.description))}</p>${carriedLine}${cost}<p class="build-status ${this.preview?.ok ? 'enough' : 'missing'}">${esc(tx(this.preview?.reason) || (zh ? '选择邻近的一格' : 'Choose a nearby tile'))}</p>`
    if (html === this.detailSignature) return
    this.detailSignature = html
    this.panel.querySelector('.build-details')!.innerHTML = html
  }
}
