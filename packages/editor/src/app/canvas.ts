// The editor's canvas (docs/engine-split.md §6): the runtime's own renderer, WorldScene, drawing the map as the
// game draws it — autotiles, heights, rooms, every thing on it — from an engine made over the project as it is
// now. The camera is free (drag with the right or middle button, or with space held; the wheel zooms); the
// left button is the tool's. What the editor marks (the selection, anchors, areas, portals) is drawn over it.

import Phaser from 'phaser'
import { Game, RuleLibrary, decodeRawChunk, snapshot, type MapData } from '@openworld/engine'
import type { Compiled } from '@openworld/format'
import { WorldScene } from '@openworld/runtime/src/render/scene.ts'

export type CellEvent = 'down' | 'drag' | 'up' | 'hover'
export type Overlay = (g: Phaser.GameObjects.Graphics, tile: number) => void

export class Canvas {
  scene!: WorldScene
  private game?: Phaser.Game
  private last?: { c: Compiled; mapId: string }
  private ready = false
  private pending?: () => void
  private shown?: string
  private overlay?: Overlay
  private panning?: { x: number; y: number }
  private painting = false
  private space = false
  /** The cell under the pointer, and the tool's hand on it. */
  onCell?: (cell: { x: number; y: number }, ev: CellEvent) => void
  /** The map as it was drawn last (its terrain decoded). */
  map?: MapData

  constructor(private parent: HTMLElement) {
    this.boot()
    const local = (e: PointerEvent | WheelEvent) => { const r = parent.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
    parent.addEventListener('contextmenu', (e) => e.preventDefault())
    parent.addEventListener('pointerdown', (e) => {
      parent.setPointerCapture(e.pointerId)
      if (e.button === 1 || e.button === 2 || this.space) return void (this.panning = local(e))
      if (e.button !== 0) return
      const c = this.scene.cellAt(local(e).x, local(e).y)
      if (c) (this.painting = true), this.onCell?.(c, 'down')
    })
    parent.addEventListener('pointermove', (e) => {
      const p = local(e)
      if (this.panning) return void (this.scene.panBy(p.x - this.panning.x, p.y - this.panning.y), (this.panning = p))
      const c = this.scene.cellAt(p.x, p.y)
      if (c) this.onCell?.(c, this.painting ? 'drag' : 'hover')
    })
    parent.addEventListener('pointerup', (e) => {
      if (this.panning) return void (this.panning = undefined)
      const c = this.scene.cellAt(local(e).x, local(e).y)
      if (this.painting && c) this.onCell?.(c, 'up')
      this.painting = false
    })
    parent.addEventListener('wheel', (e) => (e.preventDefault(), this.scene.zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, local(e).x, local(e).y)), { passive: false })
    window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) this.space = true })
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') this.space = false })
  }

  /** The renderer made (anew: the game's pictures changed, which it loads as it starts). */
  private boot(): void {
    const parent = this.parent
    this.scene = new WorldScene()
    this.ready = false
    this.scene.hooks = { onFx: () => {}, onFrame: () => {}, onReady: () => ((this.ready = true), this.scene.setFreeCamera(true), this.pending?.(), (this.pending = undefined)) }
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
  }

  setOverlay(o: Overlay | undefined): void {
    this.overlay = o
    this.redraw()
  }

  redraw(): void {
    const o = this.overlay
    if (this.ready) this.scene.drawOverlay((g, t) => o?.(g, t))
  }

  get size(): { w: number; h: number } {
    return { w: this.parent.clientWidth, h: this.parent.clientHeight }
  }
}
