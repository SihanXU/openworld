// Small pictures for the map's palettes (docs/engine-split.md §16 E1, RPG Maker's tile palette): a terrain as its
// tile, a kind of thing as the catalogue draws it, a building as its picture — read from the project's catalogue as
// it is now, drawn into `<canvas data-pic>` elements once a panel is in the page.

import type { Ontology } from '@openworld/engine'
import type { Catalog, SpriteDef } from '@openworld/runtime/src/assets/types.ts'
import { image } from './sheet.ts'

/** A rectangle of a picture (in pixels), or a sheet whose first frame is shown (cut into `cols` × `rows`). */
export type Pic = { img: string; x: number; y: number; w: number; h: number } | { img: string; cols: number; rows: number }

const T = 16

/** A type's sprite key: its own, or the nearest kind's above it. */
export function spriteOf(onto: Ontology, type: string): string | undefined {
  for (let t = type; t; t = t.includes('/') ? t.slice(0, t.lastIndexOf('/')) : '') {
    const s = (onto.types[t] as { sprite?: string } | undefined)?.sprite
    if (s) return s
  }
  return undefined
}

const rect = (d: SpriteDef): Pic => ({ img: d.img, x: d.x, y: d.y, w: d.w, h: d.h })

/** How the canvas draws a kind of thing (as scene.ts picks: a creature's sheet, a fixture's picture, an item's icon). */
export function typePic(c: Catalog, onto: Ontology, type: string): Pic | undefined {
  const s = spriteOf(onto, type) ?? ''
  if (type.startsWith('actor/')) {
    const variant = type.split('/').pop()
    const a = c.creatures[`${s}:${variant}`] ?? c.creatures[s]
    return a ? { img: `${a.dir}/${a.sheet}`, cols: a.cols, rows: a.rows } : undefined
  }
  if (!type.startsWith('item/')) {
    const f = c.fixtures[s] ?? c.fixtures[`fixture:${type.split('/')[1]}`]
    if (f) return rect(f.variants?.[0] ?? f.base)
  }
  const i = c.items[s]
  return i ? rect(i) : undefined
}

/** A terrain as one cell of it: the thing drawn on it (a tree, a stump), else an autotile's middle, else a plain tile. */
export function terrainPic(c: Catalog, terrain: string): Pic | undefined {
  const o = c.terrainObjects[terrain]?.[0]
  if (o) return rect(o)
  const b = c.blobs[terrain]
  if (b) return { img: b.img, x: (b.col + 1) * T, y: (b.row + 1) * T, w: T, h: T }
  const p = c.plain[terrain]?.[0]
  return p ? { img: p[0], x: p[1] * T, y: p[2] * T, w: T, h: T } : undefined
}

/** A building as stamped. */
export function prefabPic(c: Catalog, key: string): Pic | undefined {
  const p = c.prefabs[key]
  return p ? { img: p.img, x: p.x, y: p.y, w: p.tw * T, h: p.th * T } : undefined
}

/** A room's walls: its nine-slice block. */
export function roomPic(c: Catalog, style: string): Pic | undefined {
  const r = c.rooms[style]
  return r ? { img: r.img, x: r.col * T, y: r.row * T, w: r.size * T, h: r.size * T } : undefined
}

/** A picture's URL in the project: its own art as written, the pack's under na/ (render/assets.ts). */
export const picUrl = (project: string, img: string) => encodeURI(`/games/${encodeURIComponent(project)}/assets/${/^(lsw|own)\//.test(img) ? img : `na/${img}`}`)

/**
 * Draw every `<canvas data-pic="…">` under an element: `pics` names what each shows. A picture is fitted into its
 * canvas whole, kept sharp, and centred; one that cannot be loaded leaves the canvas empty.
 */
export function paintPics(root: HTMLElement, project: string, pics: Map<string, Pic | undefined>): void {
  whenInView(root, [...root.querySelectorAll<HTMLCanvasElement>('canvas[data-pic]')], (cv) => {
    const p = pics.get(cv.dataset.pic!)
    if (!p) return
    void image(picUrl(project, p.img)).then(
      (img) => {
        const r = 'cols' in p ? { x: 0, y: 0, w: Math.floor(img.width / p.cols), h: Math.floor(img.height / p.rows) } : p
        const g = cv.getContext('2d')!
        const k = Math.min(cv.width / r.w, cv.height / r.h)
        const s = k >= 1 ? Math.floor(k) : k
        g.imageSmoothingEnabled = false
        g.clearRect(0, 0, cv.width, cv.height)
        g.drawImage(img, r.x, r.y, r.w, r.h, Math.round((cv.width - r.w * s) / 2), Math.round((cv.height - r.h * s) / 2), r.w * s, r.h * s)
      },
      () => {},
    )
  })
}

/**
 * Canvases under an element painted as each scrolls into view, not before (a palette of four hundred kinds, a tree
 * of a thousand maps: twenty are in view). Called again over the same canvases, it paints those in view again (what
 * they show may have changed) and goes on watching; over new ones, it watches those instead.
 */
export function whenInView(root: HTMLElement, canvases: HTMLCanvasElement[], paint: (cv: HTMLCanvasElement) => void): void {
  if (typeof IntersectionObserver === 'undefined') return canvases.forEach(paint)
  const had = watching.get(root)
  if (had) {
    const n = canvases.length
    if (had.canvases.length === n && had.canvases[0] === canvases[0] && had.canvases[n - 1] === canvases[n - 1]) return had.inView.forEach(paint)
    had.observer.disconnect()
  }
  // (the first rows at once, so a panel is whole as it appears; the observer tells of the rest as they come)
  canvases.slice(0, 24).forEach(paint)
  const inView = new Set<HTMLCanvasElement>()
  const observer = new IntersectionObserver((es) => {
    for (const e of es) {
      const cv = e.target as HTMLCanvasElement
      if (e.isIntersecting) inView.add(cv), paint(cv)
      else inView.delete(cv)
    }
  })
  for (const cv of canvases) observer.observe(cv)
  watching.set(root, { observer, inView, canvases })
}
const watching = new WeakMap<HTMLElement, { observer: IntersectionObserver; inView: Set<HTMLCanvasElement>; canvases: HTMLCanvasElement[] }>()
