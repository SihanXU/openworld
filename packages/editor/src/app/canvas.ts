// The editor's canvas (docs/engine-split.md §6, §16 E1): the runtime's own renderer, WorldScene, drawing the map as
// the game draws it — autotiles, heights, rooms, every thing on it — from an engine made over the project as it is
// now. As RPG Maker's map is used: the left button is the tool's, the right button picks what is under it (dragged:
// a block), the middle button or space held pans, the wheel scrolls (Shift: across) and Ctrl+wheel zooms. What the
// editor marks (the selection, anchors, areas, portals, a grid) is drawn over it; a layer not being edited is dimmed.

import Phaser from 'phaser'
import { Game, RuleLibrary, decodeRawChunk, snapshot, type MapData } from '@openworld/engine'
import type { Compiled } from '@openworld/format'
import { WorldScene } from '@openworld/runtime/src/render/scene.ts'

/** The left button's down, drag and up; the right's; a double click; the pointer over a cell, or gone off the map. */
export type CellEvent = 'down' | 'drag' | 'up' | 'rdown' | 'rdrag' | 'rup' | 'double' | 'hover' | 'leave'
export type Overlay = (g: Phaser.GameObjects.Graphics, tile: number) => void
export interface Keys {
  shift: boolean
  alt: boolean
  ctrl: boolean
}

/** The zoom levels the status bar offers (1: a cell is 16 screen pixels). */
export const ZOOMS = [0.5, 1, 2, 3, 4, 6]

export class Canvas {
  scene!: WorldScene
  private game?: Phaser.Game
  private last?: { c: Compiled; mapId: string }
  private ready = false
  private pending?: () => void
  private shown?: string
  private overlay?: Overlay
  private panning?: { x: number; y: number }
  /** Which button is held over the map: the tool's (left) or the picker's (right). */
  private held?: 'left' | 'right'
  private space = false
  private at?: { x: number; y: number }
  private dimmed: { ground?: number; things?: number } = {}
  /** The cell under the pointer, and the tool's hand on it. */
  onCell?: (cell: { x: number; y: number }, ev: CellEvent, keys: Keys) => void
  /** The view moved or zoomed (the status bar's zoom). */
  onView?: () => void
  /** The map as it was drawn last (its terrain decoded). */
  map?: MapData
  /** Grid lines over the cells. */
  grid = false

  constructor(private parent: HTMLElement) {
    this.boot()
    const local = (e: PointerEvent | WheelEvent | MouseEvent) => { const r = parent.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
    const keys = (e: PointerEvent | MouseEvent): Keys => ({ shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey })
    const cell = (e: PointerEvent | MouseEvent) => this.scene.cellAt(local(e).x, local(e).y)
    parent.addEventListener('contextmenu', (e) => e.preventDefault())
    parent.addEventListener('pointerdown', (e) => {
      parent.setPointerCapture(e.pointerId)
      if (e.button === 1 || (e.button === 0 && this.space)) return void ((this.panning = local(e)), (parent.style.cursor = 'grabbing'))
      const c = cell(e)
      if (!c || (e.button !== 0 && e.button !== 2)) return
      this.held = e.button === 0 ? 'left' : 'right'
      this.at = c
      this.onCell?.(c, this.held === 'left' ? 'down' : 'rdown', keys(e))
    })
    parent.addEventListener('pointermove', (e) => {
      const p = local(e)
      if (this.panning) return void (this.scene.panBy(p.x - this.panning.x, p.y - this.panning.y), (this.panning = p), this.onView?.())
      const c = this.scene.cellAt(p.x, p.y)
      if (!c) return
      const moved = !this.at || c.x !== this.at.x || c.y !== this.at.y
      this.at = c
      if (this.held) moved && this.onCell?.(c, this.held === 'left' ? 'drag' : 'rdrag', keys(e))
      else if (moved) this.onCell?.(c, 'hover', keys(e))
    })
    parent.addEventListener('pointerup', (e) => {
      if (this.panning) return void ((this.panning = undefined), (parent.style.cursor = this.space ? 'grab' : ''))
      const held = this.held
      this.held = undefined
      const c = cell(e) ?? this.at
      if (held && c) this.onCell?.(c, held === 'left' ? 'up' : 'rup', keys(e))
    })
    parent.addEventListener('pointerleave', () => {
      if (this.held || this.panning) return
      this.at = undefined
      this.onCell?.({ x: -1, y: -1 }, 'leave', { shift: false, alt: false, ctrl: false })
    })
    parent.addEventListener('dblclick', (e) => { const c = cell(e); if (c) this.onCell?.(c, 'double', keys(e)) })
    parent.addEventListener('wheel', (e) => {
      e.preventDefault()
      const p = local(e)
      if (e.ctrlKey || e.metaKey) this.scene.zoomBy(Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) / 300), p.x, p.y)
      else if (e.shiftKey && !e.deltaX) this.scene.panBy(-e.deltaY, 0)
      else this.scene.panBy(-e.deltaX, -e.deltaY)
      this.onView?.()
    }, { passive: false })
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement
    window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !typing(e)) { e.preventDefault(); this.space = true; if (!this.panning) parent.style.cursor = 'grab' } })
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') (this.space = false), !this.panning && (parent.style.cursor = '') })
  }

  /** The renderer made (anew: the game's pictures changed, which it loads as it starts). */
  private boot(): void {
    const parent = this.parent
    this.scene = new WorldScene()
    this.ready = false
    this.scene.hooks = { onFx: () => {}, onFrame: () => {}, onReady: () => ((this.ready = true), this.scene.setFreeCamera(true), this.scene.setEditorDim(this.dimmed), this.pending?.(), (this.pending = undefined)) }
    this.game = new Phaser.Game({ type: Phaser.WEBGL, parent, pixelArt: true, backgroundColor: '#0b0d12', scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight }, scene: [this.scene], input: { keyboard: false }, audio: { noAudio: true } })
  }

  /** Start the renderer again over the game as it is now (its catalogue changed: new pictures to load), at the map it showed. */
  reset(): void {
    const last = this.last
    this.game?.destroy(true)
    this.parent.querySelectorAll('canvas').forEach((c) => c.remove())
    this.shown = undefined
    this.boot()
    if (last) this.show(last.c, last.mapId)
  }

  /**
   * Draw a map of the compiled project: an engine made over it (the world as a new game begins it, its people
   * where they stand), with the one at the keys at `at` — where a playtest from here would begin.
   */
  show(c: Compiled, mapId: string, at?: { x: number; y: number }): void {
    this.last = { c, mapId }
    if (!this.ready) return void (this.pending = () => this.show(c, mapId, at))
    const raw = c.chunks.find((x) => x.map.id === mapId)
    if (!raw) return
    const chunk = decodeRawChunk(structuredClone(raw), c.bundle.terrainChars)
    const where = at ?? { x: Math.floor(chunk.map.width / 2), y: Math.floor(chunk.map.height / 2) }
    let frame
    try {
      const game = Game.create(c.index, structuredClone(c.bundle.ontology), new RuleLibrary(c.bundle.rules), { at: { map: mapId, ...where } })
      game.loadChunk(chunk)
      frame = snapshot(game.engine)
    } catch (e) {
      console.warn('the map could not be made into a world:', e)
    }
    const first = this.shown !== mapId
    this.shown = mapId
    this.map = chunk.map
    this.scene.setMap(chunk.map)
    if (frame) this.scene.applyFrame(frame)
    if (first) this.scene.lookAt(where.x, where.y)
    this.redraw()
    if (first) this.onView?.()
  }

  setOverlay(o: Overlay | undefined): void {
    this.overlay = o
    this.redraw()
  }

  redraw(): void {
    const o = this.overlay
    const m = this.map
    if (this.ready)
      this.scene.drawOverlay((g, t) => {
        if (this.grid && m && this.scene.zoom >= 1) {
          g.lineStyle(1, 0xffffff, 0.14)
          for (let x = 0; x <= m.width; x++) g.lineBetween(x * t, 0, x * t, m.height * t)
          for (let y = 0; y <= m.height; y++) g.lineBetween(0, y * t, m.width * t, y * t)
        }
        o?.(g, t)
      })
  }

  /** The layers not being edited dimmed (1 or none: as drawn). */
  dim(d: { ground?: number; things?: number }): void {
    if (d.ground === this.dimmed.ground && d.things === this.dimmed.things) return
    this.dimmed = d
    if (this.ready) this.scene.setEditorDim(d)
  }

  get zoom(): number {
    return this.ready ? this.scene.zoom : 1
  }
  zoomTo(z: number): void {
    if (!this.ready) return
    this.scene.zoomTo(z)
    this.onView?.()
  }
  /** The whole map in view. */
  fit(): void {
    const m = this.map
    if (!this.ready || !m) return
    const { w, h } = this.size
    this.scene.zoomTo(Math.max(0.5, Math.min(6, Math.min(w / (m.width * 16), h / (m.height * 16)) * 0.95)))
    this.scene.lookAtPoint(m.width / 2, m.height / 2)
    this.onView?.()
  }

  get size(): { w: number; h: number } {
    return { w: this.parent.clientWidth, h: this.parent.clientHeight }
  }
}
