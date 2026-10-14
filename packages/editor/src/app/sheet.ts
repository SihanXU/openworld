// A picture as the Assets mode shows it: drawn large on a grid, a rectangle dragged out over it (snapped to the
// grid) to cut a sprite, a tile or a frame from it; and a sprite drawn alone, its frames played, its anchor
// marked. Pure DOM and canvas.

import { esc, t } from './ui.ts'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const images = new Map<string, Promise<HTMLImageElement>>()
/** A picture by its URL, loaded once (again when asked: an imported file replaced). */
export function image(url: string, again = false): Promise<HTMLImageElement> {
  if (again || !images.has(url))
    images.set(
      url,
      new Promise((ok, fail) => {
        const i = new Image()
        i.onload = () => ok(i)
        i.onerror = () => fail(new Error(`no picture at ${url}`))
        i.src = url
      }),
    )
  return images.get(url)!
}

export class Sheet {
  url?: string
  /** The catalogue's path of the picture shown (what a cut from it writes). */
  path?: string
  zoom = 3
  /** The author chose the zoom (it then stays as chosen). */
  private zoomed = false
  grid = { w: 16, h: 16 }
  sel?: Rect
  /** A cut made: the rectangle dragged out. */
  onCut?: (r: Rect) => void
  private img?: HTMLImageElement

  /** Show a picture (and, optionally, a rectangle on it: the entry's own). */
  async open(url: string, path: string, sel?: Rect, again = false): Promise<void> {
    this.url = url
    this.path = path
    this.sel = sel
    try {
      this.img = await image(url, again)
      // a small picture is shown large, a big sheet less so (until the author picks a zoom)
      if (!this.zoomed) this.zoom = this.img.width <= 64 ? 8 : this.img.width <= 160 ? 4 : this.img.width <= 480 ? 3 : 2
    } catch {
      this.img = undefined
    }
  }

  /** Draw it into a host element (the mode's panel, drawn anew on every change). */
  mount(host: HTMLElement): void {
    if (!this.url) return void (host.innerHTML = `<p class="muted">${t('No picture open: choose one above, from the project\'s or the pack\'s.')}</p>`)
    const img = this.img
    host.innerHTML = `<div class="sheet-bar">
      <code class="grow" title="${esc(this.path)}">${esc(this.path)}</code>${img ? `<small class="muted">${img.width}×${img.height}</small>` : ''}
      <label class="inline">${t('grid')} <input type="number" min="1" id="shGw" value="${this.grid.w}">×<input type="number" min="1" id="shGh" value="${this.grid.h}"></label>
      <label class="inline">${t('zoom')} <select id="shZoom">${[1, 2, 3, 4, 6, 8].map((z) => `<option ${z === this.zoom ? 'selected' : ''}>${z}</option>`).join('')}</select></label>
      <span id="shSel" class="muted">${this.sel ? `x ${this.sel.x} y ${this.sel.y} · ${this.sel.w}×${this.sel.h}` : t('drag over it to cut')}</span>
    </div><div class="sheet-view"><canvas id="shCanvas"></canvas></div>`
    if (!img) return void (host.querySelector('.sheet-view')!.innerHTML = `<p class="warn">${t('The picture could not be loaded.')}</p>`)
    const c = host.querySelector<HTMLCanvasElement>('#shCanvas')!
    const z = this.zoom
    c.width = img.width * z
    c.height = img.height * z
    const g = c.getContext('2d')!
    const draw = (sel = this.sel) => {
      g.imageSmoothingEnabled = false
      g.clearRect(0, 0, c.width, c.height)
      // a checkerboard under the picture: what is transparent shows
      for (let y = 0; y < img.height; y += 8) for (let x = 0; x < img.width; x += 8) ((g.fillStyle = (x + y) % 16 ? '#1b1f2a' : '#232838'), g.fillRect(x * z, y * z, 8 * z, 8 * z))
      g.drawImage(img, 0, 0, img.width * z, img.height * z)
      g.strokeStyle = '#ffffff22'
      g.lineWidth = 1
      g.beginPath()
      for (let x = 0; x <= img.width; x += this.grid.w) (g.moveTo(x * z + 0.5, 0), g.lineTo(x * z + 0.5, c.height))
      for (let y = 0; y <= img.height; y += this.grid.h) (g.moveTo(0, y * z + 0.5), g.lineTo(c.width, y * z + 0.5))
      g.stroke()
      if (sel) {
        g.strokeStyle = '#f0b85a'
        g.lineWidth = 2
        g.strokeRect(sel.x * z + 1, sel.y * z + 1, sel.w * z - 2, sel.h * z - 2)
      }
    }
    draw()
    const cell = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      const px = Math.max(0, Math.min(img.width - 1, Math.floor((e.clientX - r.left) / z)))
      const py = Math.max(0, Math.min(img.height - 1, Math.floor((e.clientY - r.top) / z)))
      return { x: Math.floor(px / this.grid.w) * this.grid.w, y: Math.floor(py / this.grid.h) * this.grid.h }
    }
    let from: { x: number; y: number } | undefined
    const rect = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => {
      const x = Math.min(a.x, b.x)
      const y = Math.min(a.y, b.y)
      return { x, y, w: Math.min(img.width - x, Math.abs(a.x - b.x) + this.grid.w), h: Math.min(img.height - y, Math.abs(a.y - b.y) + this.grid.h) }
    }
    c.onpointerdown = (e) => ((from = cell(e)), c.setPointerCapture(e.pointerId), draw(rect(from, from)))
    c.onpointermove = (e) => {
      if (!from) return
      const r = rect(from, cell(e))
      draw(r)
      host.querySelector('#shSel')!.textContent = `x ${r.x} y ${r.y} · ${r.w}×${r.h}`
    }
    c.onpointerup = (e) => {
      if (!from) return
      this.sel = rect(from, cell(e))
      from = undefined
      this.onCut?.(this.sel)
    }
    const num = (id: string, set: (n: number) => void) => (host.querySelector<HTMLInputElement>(id)!.onchange = (e) => { const n = Number((e.target as HTMLInputElement).value); if (n > 0) (set(n), this.mount(host)) })
    num('#shGw', (n) => (this.grid.w = n))
    num('#shGh', (n) => (this.grid.h = n))
    host.querySelector<HTMLSelectElement>('#shZoom')!.onchange = (e) => ((this.zoom = Number((e.target as HTMLSelectElement).value)), (this.zoomed = true), this.mount(host))
  }
}

/** A sprite drawn alone, `scale` times, its frames side by side, its anchor (where it stands on its cell) marked. */
export async function drawSprite(c: HTMLCanvasElement, url: string, r: Rect & { ax?: number; ay?: number; frames?: number; step?: number }, scale = 4): Promise<void> {
  let img: HTMLImageElement
  try {
    img = await image(url)
  } catch {
    return void ((c.width = 0), (c.height = 0))
  }
  const n = Math.max(1, r.frames ?? 1)
  c.width = (r.w * n + (n - 1) * 2) * scale
  c.height = r.h * scale
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  for (let i = 0; i < n; i++) g.drawImage(img, r.x + i * (r.step ?? r.w), r.y, r.w, r.h, i * (r.w + 2) * scale, 0, r.w * scale, r.h * scale)
  if (r.ax !== undefined && r.ay !== undefined) {
    g.fillStyle = '#ff4d6d'
    g.fillRect(r.ax * scale - 2, r.ay * scale - 2, 4, 4)
  }
}

/** A sheet of frames in a grid (an actor's: its columns the directions, its rows the frames), drawn whole with its grid. */
export async function drawGrid(c: HTMLCanvasElement, url: string, cols: number, rows: number, scale = 2): Promise<void> {
  let img: HTMLImageElement
  try {
    img = await image(url)
  } catch {
    return void ((c.width = 0), (c.height = 0))
  }
  c.width = img.width * scale
  c.height = img.height * scale
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.drawImage(img, 0, 0, c.width, c.height)
  g.strokeStyle = '#f0b85a88'
  g.beginPath()
  for (let i = 0; i <= cols; i++) (g.moveTo(Math.round((i * c.width) / cols) + 0.5, 0), g.lineTo(Math.round((i * c.width) / cols) + 0.5, c.height))
  for (let j = 0; j <= rows; j++) (g.moveTo(0, Math.round((j * c.height) / rows) + 0.5), g.lineTo(c.width, Math.round((j * c.height) / rows) + 0.5))
  g.stroke()
}
