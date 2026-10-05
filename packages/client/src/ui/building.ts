import type { Frame, PlacementPreview, PlacementRecipe, Text } from '@lsw/engine'
import { BUILDINGS, FORM_BY_ID, PLACEMENTS, RECIPES } from '@lsw/content'
import type { Tile, ToWorker } from '../protocol.ts'
import { esc, locale, tx } from './common.ts'

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
}

/** A built thing or a fixture, set in a cell as part of a place (the engine's Controls.placeable). */
const placeable = (type: string) => type.startsWith('structure/') || type.startsWith('fixture/')
const PUT_HELP: Text = { en: 'Set down one you carry (as G does); with none, one is made from what you carry first.', zh: '放下身上带着的一个（和 G 一样）；身上没有时，先用身上的材料现做一个。' }

const fromRecipe = (r: PlacementRecipe): Entry => ({ id: r.id, category: r.category, name: r.name, description: r.description, sprite: r.sprite, needs: r.needs.map((n) => ({ name: n.name, count: n.count, match: n.match, consume: n.consume })) })

/** The things one makes and sets down (walls, floors, doors, beds, a workbench): from the recipes that make them. */
const MADE: Entry[] = RECIPES.filter((r) => placeable(r.make.type)).map((r) => ({
  id: `put:${r.make.type}`,
  category: 'building',
  name: r.name,
  description: PUT_HELP,
  sprite: r.sprite,
  put: r.make.type,
  needs: r.needs.map((n) => ({ name: FORM_BY_ID[n.type] ? { en: FORM_BY_ID[n.type].en, zh: FORM_BY_ID[n.type].zh } : { en: n.type.split('/').pop()!, zh: n.type.split('/').pop()! }, count: n.count, type: n.type, consume: true })),
}))

/**
 * The build palette (B): everything one can set in a place — the things one makes and carries
 * (set down as G does, one made first from what is carried when none is), then the placement
 * recipes (a campfire built from stones and sticks, a chest from planks, sowing). A live-world
 * palette: unlike menus it never pauses the simulation. Hold the left button and drag to set a
 * row of them down.
 */
export class BuildingMode {
  open = false
  selected: Entry = MADE[0] ?? fromRecipe(BUILDINGS[0])
  category: PlacementRecipe['category'] = 'building'
  frame?: Frame
  preview?: PlacementPreview
  aim?: Tile
  paint?: (sprite: string) => HTMLCanvasElement | undefined
  /** The left button is down: each new cell the pointer enters gets one too. */
  dragging = false
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
    document.body.append(this.panel, this.ghost)
    this.panel.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
      if (!button) return
      if (button.dataset.close) return this.toggle(false)
      if (button.dataset.category) {
        this.category = button.dataset.category as PlacementRecipe['category']
        this.selected = this.entries()[0]
        this.render()
      } else if (button.dataset.recipe) {
        this.selected = this.entries().find((r) => r.id === button.dataset.recipe) ?? this.selected
        this.preview = undefined
        this.render()
      }
      this.refreshAim(true)
    })
    this.panel.addEventListener('contextmenu', (e) => { e.preventDefault(); this.toggle(false) })
  }

  /** The palette's entries in the open category: what is made and set down first, then the placement recipes. */
  private entries(): Entry[] {
    if (this.category !== 'building') return PLACEMENTS.filter((r) => r.category === this.category).map(fromRecipe)
    // anything else carried that is set in a place (a found chest, a crate) is offered too
    const carried = [...(this.frame?.player.inventory ?? []), ...(this.frame?.player.held ? [this.frame.player.held] : [])]
    const extra = [...new Map(carried.filter((it) => placeable(it.type) && !MADE.some((m) => m.put === it.type)).map((it) => [it.type, it])).values()]
      .map((it): Entry => ({ id: `put:${it.type}`, category: 'building', name: it.name, description: PUT_HELP, sprite: it.sprite, put: it.type, needs: [] }))
    return [...MADE, ...extra, ...BUILDINGS.map(fromRecipe)]
  }

  toggle(on = !this.open): void {
    this.open = on
    this.dragging = false
    this.panel.classList.toggle('hidden', !on)
    this.ghost.classList.toggle('hidden', !on)
    document.getElementById('buildBtn')?.classList.toggle('active', on)
    if (on) { this.preview = undefined; this.render(); this.refreshAim(true) }
    else this.send({ t: 'buildAim' })
  }
  onFrame(f: Frame): void {
    this.frame = f
    if (!this.open) return
    if (f.scene || f.question || f.container) return this.toggle(false)
    // what is carried changes what is offered (a found crate)
    const list = this.entries().map((e) => e.id).join('|')
    if (list !== this.listSignature) this.render()
    this.refreshAim()
    this.details()
  }
  setAim(tile?: Tile): void {
    this.aim = tile
    if (!this.open) return
    this.refreshAim()
    // dragging: each new cell gets one too
    if (this.dragging && tile && `${tile.x},${tile.y}` !== this.lastPlaced) this.place(tile)
  }
  onPreview(p: PlacementPreview): void {
    const a = this.target()
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
  private refreshAim(force = false): void {
    const tile = this.target()
    const sig = `${this.selected.id}|${this.frame?.map}|${tile?.x},${tile?.y}`
    if (force || sig !== this.signature) {
      this.signature = sig
      this.preview = undefined
      this.send({ t: 'buildAim', id: this.selected.id, tile })
      this.details()
    }
    this.tick()
  }
  place(tile?: Tile): void {
    if (!this.open) return
    const at = tile ?? this.target()
    if (!at) return
    this.lastPlaced = `${at.x},${at.y}`
    this.send({ t: 'build', id: this.selected.id, tile: at })
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
    const at = this.target()
    if (!this.open || !at || !this.frame) return
    const p = this.screen(at.x, at.y)
    const size = 16 * p.scale
    this.ghost.style.left = `${p.x}px`
    this.ghost.style.top = `${p.y}px`
    this.ghost.style.width = `${size}px`
    this.ghost.style.height = `${size}px`
    this.ghost.classList.toggle('valid', !!this.preview?.ok)
    this.ghost.classList.toggle('invalid', !this.preview?.ok)
    const canvas = this.ghost.querySelector('canvas')
    if (canvas) {
      canvas.style.width = `${canvas.width * p.scale}px`
      canvas.style.height = `${canvas.height * p.scale}px`
    }
  }
  private render(): void {
    const zh = locale.value === 'zh'
    const entries = this.entries()
    this.listSignature = entries.map((e) => e.id).join('|')
    if (!entries.some((e) => e.id === this.selected.id)) this.selected = entries[0]
    this.panel.innerHTML = `<header><strong>${zh ? '建筑模式' : 'BUILD MODE'}</strong><button data-close="1" title="B / Esc">×</button></header>
      <nav><button data-category="building" class="${this.category === 'building' ? 'chosen' : ''}">${zh ? '建筑' : 'Structures'}</button><button data-category="farming" class="${this.category === 'farming' ? 'chosen' : ''}">${zh ? '种植' : 'Farming'}</button></nav>
      <div class="build-recipes">${entries.map((r) => `<button data-recipe="${r.id}" class="${r.id === this.selected.id ? 'chosen' : ''}"><span class="build-art" data-sprite="${r.sprite}"></span><span>${esc(tx(r.name))}</span></button>`).join('')}</div>
      <div class="build-details"></div><footer>${zh ? '左键 / E 放置 · 按住左键拖动连续放置 · B / Esc / 右键退出<br>WASD 移动 · 世界时间继续' : 'Left click / E place · hold and drag to place a row · B / Esc / RMB exit<br>WASD move · Time keeps moving'}</footer>`
    this.panel.querySelectorAll<HTMLElement>('[data-sprite]').forEach((el) => {
      const c = this.paint?.(el.dataset.sprite!)
      if (c) el.append(c)
    })
    this.ghost.replaceChildren()
    const art = this.paint?.(this.selected.sprite)
    if (art) this.ghost.append(art)
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
    const carriedLine = s.put ? `<p class="${have ? 'enough' : 'missing'}">${zh ? `身上有 ${have} 个` : `${have} carried`}${!have && s.needs.length ? (zh ? ' · 将用材料现做：' : ' · one will be made from:') : ''}</p>` : ''
    const cost = !s.put || !have ? `<div class="build-cost">${s.needs.map((n, i) => `<span class="${counts[i] < n.count ? 'missing' : 'enough'}">${esc(tx(nameOf(n)))} ${counts[i]}/${n.count}${n.consume === false ? (zh ? '（工具）' : ' (tool)') : ''}</span>`).join('')}</div>` : ''
    const html = `<h3>${esc(tx(s.name))}</h3><p>${esc(tx(s.description))}</p>${carriedLine}${cost}<p class="build-status ${this.preview?.ok ? 'enough' : 'missing'}">${esc(tx(this.preview?.reason) || (zh ? '选择邻近的一格' : 'Choose a nearby tile'))}</p>`
    if (html === this.detailSignature) return
    this.detailSignature = html
    this.panel.querySelector('.build-details')!.innerHTML = html
  }
}
