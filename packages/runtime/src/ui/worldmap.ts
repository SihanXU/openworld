// The map system (docs/prologue.md): the world map (M) — the continent with its regions and places
// (docs/continent.md), or nearby, every visited map where it lies, painted from its terrain; the player's
// position, the waypoint stones (an attuned one takes you there with a click), dragged and zoomed like the
// skill tree — and the minimap, the current map always on screen under the clock.

import { canvasWindow } from './components/index.ts'
import type { EntitySnap, Frame, MapData } from '@openworld/engine'
import { ontology } from '../game.ts'
import type { Atlas, AtlasContinent } from '../protocol.ts'
import { $, esc, kbd, prefs, t, tx } from './common.ts'
import { paintContinent } from './terrainmap.ts'

const colorOf = (id: string) => ontology().terrains[id]?.color ?? '#000'
/** World map pixels per tile at zoom 1. */
const PX = 6
/** The continent's pixels per cell at zoom 1. */
const CPX = 14
/** The continent's painted pixels per cell (docs/continent.md; terrainmap.ts), sharp when zoomed right in. */
const CRES = 40
/** The continent's painting, kept: its grounds never move, and painting it takes a moment. */
let painted: { key: string; canvas: HTMLCanvasElement } | undefined
const ZOOM: [number, number] = [0.25, 3]

/** A map's terrain as a canvas, one pixel per tile (scaled up by CSS, pixelated). */
function terrainCanvas(width: number, height: number, terrain: string[]): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const g = c.getContext('2d')!
  const img = g.createImageData(width, height)
  const rgb = new Map<string, [number, number, number]>()
  for (let i = 0; i < width * height; i++) {
    const id = terrain[i] ?? 'void'
    let v = rgb.get(id)
    if (!v) {
      const hex = colorOf(id).replace('#', '')
      v = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
      rgb.set(id, v)
    }
    img.data.set([...v, 255], i * 4)
  }
  g.putImageData(img, 0, 0)
  return c
}

/** The waypoint stone's mark: a crystal, lit when attuned. */
const STONE_SVG = `<svg viewBox="0 0 24 32" aria-hidden="true"><path class="wm-crystal" d="M12 1 L21 11 L12 31 L3 11 Z"/><path class="wm-facet" d="M12 1 L12 31 L3 11 Z"/><path class="wm-rim" d="M12 1 L21 11 L12 31 L3 11 Z"/></svg>`
/** The traveller's mark: a small figure on a round badge. */
const YOU_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="wm-badge" cx="12" cy="12" r="10"/><circle class="wm-figure" cx="12" cy="8.5" r="3.2"/><path class="wm-figure" d="M5.5 19.5c0-4 2.9-6.3 6.5-6.3s6.5 2.3 6.5 6.3z"/></svg>`

export class WorldMap {
  private pan = { x: 0, y: 0 }
  private zoom = 1
  private drag?: { id: number; x: number; y: number; px: number; py: number; moved: boolean }
  private suppressClick = false
  private atlas?: Atlas
  /** The zoom at which the whole continent is in view: as far out as it goes. */
  private fit = ZOOM[0]
  /** The continent's size at zoom 1, for keeping it in view. */
  private extent?: { w: number; h: number }
  /** The continent (its regions and places) or what lies nearby (the visited maps, as they join). */
  private mode: 'continent' | 'nearby' = 'continent'

  constructor(
    private host: HTMLElement,
    private send: { atlas(): void; travel(id: string): void; close(): void },
  ) {
    host.innerHTML = `
      <div class="wm-view" id="wmView"><div class="wm-world" id="wmWorld"></div></div>
      <div class="sk-bar wood wm-bar"><span class="sk-title" id="wmTitle"></span><span class="sk-hint" id="wmHint"></span>
        <button class="sk-btn" id="wmMode"></button><button class="sk-btn" id="wmHere"></button><button class="x" id="wmClose">✕</button></div>`
    const view = $('#wmView')
    view.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, px: this.pan.x, py: this.pan.y, moved: false }
    })
    view.addEventListener('pointermove', (e) => {
      const d = this.drag
      if (!d || d.id !== e.pointerId) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!d.moved && Math.hypot(dx, dy) < 5) return
      if (!d.moved) (d.moved = true), view.setPointerCapture(e.pointerId), view.classList.add('dragging')
      this.pan = { x: d.px + dx, y: d.py + dy }
      this.apply()
    })
    const end = (e: PointerEvent) => {
      if (this.drag?.id !== e.pointerId) return
      this.suppressClick = this.drag.moved
      this.drag = undefined
      view.classList.remove('dragging')
    }
    view.addEventListener('pointerup', end)
    view.addEventListener('pointercancel', end)
    view.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const r = view.getBoundingClientRect()
        const cx = e.clientX - r.left
        const cy = e.clientY - r.top
        const z = Math.min(ZOOM[1], Math.max(this.fit, this.zoom * Math.exp(-e.deltaY * 0.0015)))
        this.pan = { x: cx - ((cx - this.pan.x) * z) / this.zoom, y: cy - ((cy - this.pan.y) * z) / this.zoom }
        this.zoom = z
        this.apply()
      },
      { passive: false },
    )
    $('#wmHere').onclick = () => this.centerOnPlayer()
    $('#wmMode').onclick = () => {
      this.mode = this.mode === 'continent' ? 'nearby' : 'continent'
      if (this.atlas) this.onAtlas(this.atlas)
    }
    $('#wmClose').onclick = () => this.send.close()
    canvasWindow(host, view, t('worldMap'), () => this.send.close(), (dx, dy) => {
      this.pan.x += dx; this.pan.y += dy
      if (this.extent) {
        const r = view.getBoundingClientRect()
        this.fit = Math.min(ZOOM[1], Math.max(ZOOM[0], Math.min(r.width / this.extent.w, (r.height - 60) / this.extent.h) * 0.96))
      }
      this.apply()
    })
  }

  get open(): boolean {
    return !this.host.classList.contains('hidden')
  }

  show(): void {
    this.host.classList.remove('hidden')
    $('#wmTitle').textContent = t('worldMap')
    $('#wmHint').textContent = t('worldMapHint')
    $('#wmHere').textContent = `◎ ${t('wmHere')}`
    $('#wmMode').classList.add('hidden')
    $('#wmWorld').innerHTML = `<div class="wm-loading">…</div>`
    this.atlas = undefined
    this.send.atlas()
  }

  hide(): void {
    this.host.classList.add('hidden')
  }

  private apply(): void {
    const world = $('#wmWorld')
    // the continent stays in view: it fills the window where it can, and sits in the middle where it cannot
    if (this.extent && this.continental()) {
      const r = $('#wmView').getBoundingClientRect()
      const w = this.extent.w * this.zoom
      const h = this.extent.h * this.zoom
      this.pan.x = w <= r.width ? (r.width - w) / 2 : Math.min(0, Math.max(r.width - w, this.pan.x))
      this.pan.y = h <= r.height - 40 ? (r.height - 40 - h) / 2 + 40 : Math.min(40, Math.max(r.height - h, this.pan.y))
    }
    world.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`
    // the marks and names keep their size on the screen whatever the zoom
    world.style.setProperty('--inv', String(1 / this.zoom))
    // the places' names come out as one comes closer: the visited ones first, then every one
    world.classList.toggle('far', this.zoom < 1.1)
    world.classList.toggle('mid', this.zoom >= 1.6)
    world.classList.toggle('near', this.zoom >= 2.8)
  }

  private centerOnPlayer(): void {
    const a = this.atlas
    const r = $('#wmView').getBoundingClientRect()
    if (!a) return
    const c = a.continent
    if (this.continental() && c) {
      const at = c.cell ?? { x: c.width / 2, y: c.height / 2 }
      this.zoom = 2.2
      this.pan = { x: r.width / 2 - (at.x + 0.5) * CPX * this.zoom, y: r.height / 2 - (at.y + 0.5) * CPX * this.zoom }
      return this.apply()
    }
    const m = a.maps.find((x) => x.id === a.here.map)
    if (!m) return
    this.zoom = 1
    this.pan = { x: r.width / 2 - (m.at.x + a.here.x + 0.5) * PX, y: r.height / 2 - (m.at.y + a.here.y + 0.5) * PX }
    this.apply()
  }

  /** Is the continent shown (there is one, and it is chosen)? */
  private continental(): boolean {
    return this.mode === 'continent' && !!this.atlas?.continent
  }

  onAtlas(a: Atlas): void {
    this.atlas = a
    const world = $('#wmWorld')
    world.innerHTML = ''
    const mode = $('#wmMode')
    mode.classList.toggle('hidden', !a.continent)
    mode.textContent = this.continental() ? t('wmNearby') : t('wmContinent')
    this.extent = undefined
    this.fit = ZOOM[0]
    if (this.continental()) return this.drawContinent(a, a.continent!)
    const at = new Map(a.maps.map((m) => [m.id, m]))
    for (const m of a.maps) {
      const tile = document.createElement('div')
      tile.className = `wm-map${m.id === a.here.map ? ' here' : ''}`
      tile.style.left = `${m.at.x * PX}px`
      tile.style.top = `${m.at.y * PX}px`
      tile.style.width = `${m.width * PX}px`
      tile.style.height = `${m.height * PX}px`
      tile.appendChild(terrainCanvas(m.width, m.height, m.terrain))
      tile.insertAdjacentHTML('beforeend', `<span class="wm-name">${esc(tx(m.name))}</span>`)
      world.appendChild(tile)
    }
    for (const s of a.waypoints) {
      const m = at.get(s.map)
      if (!m) continue
      const b = document.createElement('button')
      b.className = `wm-stone${s.attuned ? ' attuned' : ''}`
      b.style.left = `${(m.at.x + s.x + 0.5) * PX}px`
      b.style.top = `${(m.at.y + s.y + 0.5) * PX}px`
      b.title = `${tx(s.name)} — ${s.attuned ? t('wmTravel') : t('wmAsleep')}`
      b.innerHTML = `${STONE_SVG}<span>${esc(tx(s.name))}</span>`
      b.onclick = () => {
        if (this.suppressClick) return void (this.suppressClick = false)
        if (s.attuned) this.send.travel(s.id)
      }
      world.appendChild(b)
    }
    // the tracked quest's markers (docs/quests.md §2.5), where its open objectives point
    if (prefs.get('markers'))
      for (const q of a.targets ?? []) {
        const m = at.get(q.map)
        if (m) world.insertAdjacentHTML('beforeend', `<span class="wm-quest" title="${esc(tx(q.text))}" style="left:${(m.at.x + q.x + 0.5) * PX}px;top:${(m.at.y + q.y + 0.5) * PX}px">★</span>`)
      }
    const here = at.get(a.here.map)
    if (here) world.insertAdjacentHTML('beforeend', `<span class="wm-you" style="left:${(here.at.x + a.here.x + 0.5) * PX}px;top:${(here.at.y + a.here.y + 0.5) * PX}px">${YOU_SVG}</span>`)
    this.centerOnPlayer()
  }

  /**
   * The continent: its grounds, each region tinted and bordered in its colour and named over its middle (one with no
   * tale yet says so), its places (the larger always named, the rest as one comes closer; sealed ones shut), the
   * stones and the quest's marks at the cells of their maps, and where one is.
   */
  private drawContinent(a: Atlas, c: AtlasContinent): void {
    const world = $('#wmWorld')
    const key = `${c.width}x${c.height}:${c.terrain.join('')}`
    if (painted?.key !== key) painted = { key, canvas: paintContinent(c, CRES) }
    const canvas = painted.canvas
    canvas.className = 'wm-continent'
    canvas.style.width = `${c.width * CPX}px`
    canvas.style.height = `${c.height * CPX}px`
    world.appendChild(canvas)
    // each region's tint, soft-edged, and the borders between regions as dashed lines
    const R = 8
    const tint = document.createElement('canvas')
    tint.width = c.width * R
    tint.height = c.height * R
    tint.className = 'wm-tint'
    tint.style.width = canvas.style.width
    tint.style.height = canvas.style.height
    const tg = tint.getContext('2d')!
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const r = c.regions[c.regionOf[y * c.width + x]]
        if (!r?.color) continue
        tg.globalAlpha = r.backdrop ? 0.26 : 0.16
        tg.fillStyle = r.backdrop ? '#2a2630' : r.color
        tg.fillRect(x * R, y * R, R, R)
      }
    world.appendChild(tint)
    const lines = document.createElement('canvas')
    lines.width = c.width * CRES
    lines.height = c.height * CRES
    lines.className = 'wm-borders'
    lines.style.width = canvas.style.width
    lines.style.height = canvas.style.height
    const g = lines.getContext('2d')!
    g.lineWidth = CRES * 0.1
    g.lineCap = 'round'
    g.setLineDash([CRES * 0.45, CRES * 0.3])
    g.globalAlpha = 0.75
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const r = c.regionOf[y * c.width + x]
        if (r < 0) continue
        g.strokeStyle = c.regions[r].color ?? '#000'
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const o = x + dx < c.width && y + dy < c.height ? c.regionOf[(y + dy) * c.width + x + dx] : -1
          if (o < 0 || o === r) continue
          g.beginPath()
          if (dx) (g.moveTo((x + 1) * CRES, y * CRES), g.lineTo((x + 1) * CRES, (y + 1) * CRES))
          else (g.moveTo(x * CRES, (y + 1) * CRES), g.lineTo((x + 1) * CRES, (y + 1) * CRES))
          g.stroke()
        }
      }
    world.appendChild(lines)
    // each region's name over its middle
    c.regions.forEach((r, i) => {
      let sx = 0
      let sy = 0
      let n = 0
      for (let k = 0; k < c.regionOf.length; k++) if (c.regionOf[k] === i) (sx += k % c.width), (sy += Math.floor(k / c.width)), n++
      if (!n) return
      world.insertAdjacentHTML('beforeend', `<div class="wm-region${r.backdrop ? ' untold' : ''}" style="left:${(sx / n + 0.5) * CPX}px;top:${(sy / n + 0.5) * CPX}px;--rc:${esc(r.color ?? '#fff')}">${esc(tx(r.name))}${r.backdrop ? `<small>${esc(t('wmUntold'))}</small>` : ''}</div>`)
    })
    for (const p of c.places) {
      const cls = ['wm-place', p.capital ? 'major' : '', p.sealed ? 'sealed' : '', p.visited ? 'visited' : '', p.backdrop ? 'backdrop' : ''].filter(Boolean).join(' ')
      world.insertAdjacentHTML('beforeend', `<div class="${cls}" title="${esc(tx(p.name))}" style="left:${(p.x + 0.5) * CPX}px;top:${(p.y + 0.5) * CPX}px"><i></i><span>${esc(tx(p.name))}</span></div>`)
    }
    const cellOf = (map: string) => a.cells?.[map]
    for (const s of a.waypoints) {
      const at = cellOf(s.map)
      if (!at) continue
      const b = document.createElement('button')
      b.className = `wm-stone small${s.attuned ? ' attuned' : ''}`
      b.style.left = `${(at.x + 0.5) * CPX}px`
      b.style.top = `${(at.y + 0.2) * CPX}px`
      b.title = `${tx(s.name)} — ${s.attuned ? t('wmTravel') : t('wmAsleep')}`
      b.innerHTML = STONE_SVG
      b.onclick = () => {
        if (this.suppressClick) return void (this.suppressClick = false)
        if (s.attuned) this.send.travel(s.id)
      }
      world.appendChild(b)
    }
    if (prefs.get('markers'))
      for (const q of a.targets ?? []) {
        const at = cellOf(q.map)
        if (at) world.insertAdjacentHTML('beforeend', `<span class="wm-quest" title="${esc(tx(q.text))}" style="left:${(at.x + 0.5) * CPX}px;top:${(at.y - 0.4) * CPX}px">★</span>`)
      }
    if (c.cell) world.insertAdjacentHTML('beforeend', `<span class="wm-you" style="left:${(c.cell.x + 0.5) * CPX}px;top:${(c.cell.y + 0.5) * CPX}px">${YOU_SVG}</span>`)
    // as far out as the whole continent in view; opened close in on where one is
    const r = $('#wmView').getBoundingClientRect()
    this.extent = { w: c.width * CPX, h: c.height * CPX }
    this.fit = Math.min(ZOOM[1], Math.max(ZOOM[0], Math.min(r.width / this.extent.w, (r.height - 60) / this.extent.h) * 0.96))
    if (c.cell) return this.centerOnPlayer()
    this.zoom = this.fit
    this.apply()
  }
}

/** The current map under the clock: terrain, and dots for who and what is about. */
export class Minimap {
  private map?: MapData
  private base?: HTMLCanvasElement
  private n = 0

  constructor(onClick: () => void) {
    $('#hud').insertAdjacentHTML('beforeend', `<div class="minimap wood" id="minimap" data-kbd-title="map" title="${kbd('map')}"><canvas id="mmCanvas"></canvas><kbd data-kbd="map">${kbd('map')}</kbd><span class="mm-zone" id="mmZone"></span></div>`)
    $('#minimap').onclick = onClick
  }

  setMap(m: MapData): void {
    this.map = m
    this.base = terrainCanvas(m.width, m.height, m.terrain)
    // peaceful or combat (monsters come out at night there)
    const zone = m.zone ?? 'combat'
    $('#mmZone').className = `mm-zone ${zone}`
    this.relabel()
  }

  /** The zone's words in the language now chosen (they are set again when it changes). */
  relabel(): void {
    $('#mmZone').textContent = t((this.map?.zone ?? 'combat') === 'peaceful' ? 'zonePeaceful' : 'zoneCombat')
  }

  onFrame(f: Frame): void {
    // a few times a second is enough
    if (++this.n % 3 || !this.map || !this.base || f.map !== this.map.id) return
    const m = this.map
    const c = $<HTMLCanvasElement>('#mmCanvas')
    const scale = Math.max(1, Math.floor(Math.min(168 / m.width, 120 / m.height)))
    if (c.width !== m.width * scale) (c.width = m.width * scale), (c.height = m.height * scale)
    const g = c.getContext('2d')!
    g.imageSmoothingEnabled = false
    g.drawImage(this.base, 0, 0, c.width, c.height)
    // what has changed on the ground since (a felled tree, a laid plank)
    for (const tl of f.tiles) {
      if (!tl.terrain) continue
      g.fillStyle = colorOf(tl.terrain)
      g.fillRect(tl.x * scale, tl.y * scale, scale, scale)
    }
    const dot = (e: { x: number; y: number }, color: string, r = scale) => {
      g.fillStyle = color
      g.fillRect(e.x * scale - (r - scale) / 2, e.y * scale - (r - scale) / 2, r, r)
    }
    for (const e of f.entities) {
      const c = dotColor(e)
      if (c) dot(e, c, scale + 1)
    }
    // the tracked quest's markers on this map (docs/quests.md §2.5)
    if (prefs.get('markers'))
      for (const q of f.quests?.targets ?? []) {
        if (q.map !== m.id) continue
        g.fillStyle = '#ffd23f'
        g.strokeStyle = '#3a2414'
        const r = scale + 3
        g.beginPath()
        g.moveTo(q.x * scale + scale / 2, q.y * scale + scale / 2 - r)
        g.lineTo(q.x * scale + scale / 2 + r, q.y * scale + scale / 2)
        g.lineTo(q.x * scale + scale / 2, q.y * scale + scale / 2 + r)
        g.lineTo(q.x * scale + scale / 2 - r, q.y * scale + scale / 2)
        g.closePath()
        g.fill()
        g.stroke()
      }
    dot(f.player, '#ffffff', scale + 2)
    g.strokeStyle = '#000'
    g.lineWidth = 1
    g.strokeRect(f.player.x * scale - 1.5, f.player.y * scale - 1.5, scale + 3, scale + 3)
  }
}

/** The world's waypoint stones (the waypoints module's: params.waypoint, else its own). */
const waypointType = (): string => (ontology().params as { waypoint?: string } | undefined)?.waypoint ?? 'fixture/sacred/waypoint'

function dotColor(e: EntitySnap): string | undefined {
  if (e.type === waypointType()) return e.statuses.includes('attuned') ? '#5ff0ff' : '#3a7f8a'
  if (!e.tags.includes('agent')) return undefined
  if (e.tags.includes('companion')) return '#ffd23f'
  if (e.tags.includes('person')) return '#5aa0ff'
  if (e.tags.includes('animal')) return '#e8d2a0'
  return '#ff4b3a'
}
