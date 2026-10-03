import type { Frame, PlacementPreview, PlacementRecipe } from '@lsw/engine'
import { BUILDINGS, PLACEMENTS } from '@lsw/content'
import type { Tile, ToWorker } from '../protocol.ts'
import { esc, locale, tx } from './common.ts'

/** A live-world palette: unlike menus it never pauses the simulation. */
export class BuildingMode {
  open = false
  selected = BUILDINGS[0]
  category: PlacementRecipe['category'] = 'building'
  frame?: Frame
  preview?: PlacementPreview
  aim?: Tile
  paint?: (sprite: string) => HTMLCanvasElement | undefined
  private panel = document.createElement('section')
  private ghost = document.createElement('div')
  private signature = ''
  private detailSignature = ''
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
        this.selected = PLACEMENTS.find((r) => r.category === this.category)!
        this.render()
      } else if (button.dataset.recipe) {
        this.selected = PLACEMENTS.find((r) => r.id === button.dataset.recipe)!
        this.preview = undefined
        this.render()
      }
      this.refreshAim(true)
    })
    this.panel.addEventListener('contextmenu', (e) => { e.preventDefault(); this.toggle(false) })
  }
  toggle(on = !this.open): void {
    this.open = on
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
    this.refreshAim()
    this.details()
  }
  setAim(tile?: Tile): void { this.aim = tile; if (this.open) this.refreshAim() }
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
    if (at) this.send({ t: 'build', id: this.selected.id, tile: at })
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
    this.panel.innerHTML = `<header><strong>${zh ? '营地 · 建筑模式' : 'CAMP · BUILD MODE'}</strong><button data-close="1" title="B / Esc">×</button></header>
      <nav><button data-category="building" class="${this.category === 'building' ? 'chosen' : ''}">${zh ? '建筑' : 'Structures'}</button><button data-category="farming" class="${this.category === 'farming' ? 'chosen' : ''}">${zh ? '种植' : 'Farming'}</button></nav>
      <div class="build-recipes">${PLACEMENTS.filter((r) => r.category === this.category).map((r) => `<button data-recipe="${r.id}" class="${r.id === this.selected.id ? 'chosen' : ''}"><span class="build-art" data-sprite="${r.sprite}"></span><span>${esc(tx(r.name))}</span></button>`).join('')}</div>
      <div class="build-details"></div><footer>${zh ? '左键 / E 放置 · B / Esc / 右键退出<br>WASD 移动 · 世界时间继续' : 'Left click / E place · B / Esc / RMB exit<br>WASD move · Time keeps moving'}</footer>`
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
    const counts = this.preview?.have ?? this.selected.needs.map((n) => carried.filter((it) =>
      (!n.match.type || it.type === n.match.type || it.type.startsWith(n.match.type + '/')) && (n.match.tags ?? []).every((tag) => it.tags.includes(tag))).length)
    const html = `<h3>${esc(tx(this.selected.name))}</h3><p>${esc(tx(this.selected.description))}</p><div class="build-cost">${this.selected.needs.map((n, i) => `<span class="${counts[i] < n.count ? 'missing' : 'enough'}">${esc(tx(n.name))} ${counts[i]}/${n.count}${!n.consume ? (zh ? '（工具）' : ' (tool)') : ''}</span>`).join('')}</div><p class="build-status ${this.preview?.ok ? 'enough' : 'missing'}">${esc(tx(this.preview?.reason) || (zh ? '选择邻近的一格' : 'Choose a nearby tile'))}</p>`
    if (html === this.detailSignature) return
    this.detailSignature = html
    this.panel.querySelector('.build-details')!.innerHTML = html
  }
}
