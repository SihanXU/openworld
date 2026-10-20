// The maps as RPG Maker's map tree (docs/engine-split.md §16 E1): grouped by their group (a map's `region`), each
// with a small picture of its ground; and the world overview — every map where the edge links lay it (the
// compiler's `at`), the maps reached only by portals beside them, a line for each portal between two maps.

import type { RawChunk } from '@openworld/engine'
import type { Sourced } from '@openworld/format'
import type { Ctx } from './context.ts'
import { esc, t } from './ui.ts'
import { shown } from './words.ts'
import { whenInView } from './thumbs.ts'

/** The colour a map's character is drawn in: its terrain's. */
function colours(ctx: Ctx): (c: string) => [number, number, number] {
  const onto = ctx.onto()
  const chars = ctx.store.game.terrainChars
  const memo = new Map<string, [number, number, number]>()
  return (c) => {
    if (!memo.has(c)) {
      const hex = onto.terrains[chars[c] ?? '']?.color ?? '#333'
      const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
      memo.set(c, [(n >> 16) & 255, (n >> 8) & 255, n & 255])
    }
    return memo.get(c)!
  }
}

const drawn = new Map<string, { rows: string; data: ImageData }>()
/** A map's ground as one pixel a cell (kept until its rows change). */
function groundOf(ctx: Ctx, ch: RawChunk): ImageData {
  const rows = ch.map.rows.join('')
  const key = `${ctx.store.id}:${ch.map.id}`
  const had = drawn.get(key)
  if (had?.rows === rows && had.data.width === ch.map.width) return had.data
  const col = colours(ctx)
  const data = new ImageData(Math.max(1, ch.map.width), Math.max(1, ch.map.height))
  for (let i = 0; i < rows.length && i < data.width * data.height; i++) {
    const [r, g, b] = col(rows[i])
    data.data.set([r, g, b, 255], i * 4)
  }
  drawn.set(key, { rows, data })
  return data
}

/** A mini's picture drawn into it (as its map's ground is now). */
function paintMini(ctx: Ctx, cv: HTMLCanvasElement, ch: RawChunk): void {
  const img = groundOf(ctx, ch)
  if (cv.width !== img.width) cv.width = img.width
  if (cv.height !== img.height) cv.height = img.height
  cv.getContext('2d')!.putImageData(img, 0, 0)
}

/**
 * Draw every `<canvas data-mini="<map id>">` under an element — each as it scrolls into view, not before: a project
 * of a thousand maps shows twenty of them at a time, and drawing them all took longer than everything else in a
 * panel. One in view is drawn again when this is called again (its map may have changed).
 */
export function paintMinis(ctx: Ctx, root: HTMLElement): void {
  const maps = new Map(ctx.store.maps().map((m) => [m.data.map.id, m.data]))
  whenInView(root, [...root.querySelectorAll<HTMLCanvasElement>('canvas[data-mini]')], (cv) => { const ch = maps.get(cv.dataset.mini!); if (ch) paintMini(ctx, cv, ch) })
}

/** A row of the tree: its name first (as the editor's language has it), its id and size beneath. */
const row = (ctx: Ctx, m: Sourced<RawChunk>) => `<button data-map="${esc(m.data.map.id)}" class="maprow ${m.data.map.id === ctx.map ? 'on' : ''}"><canvas data-mini="${esc(m.data.map.id)}" class="mini"></canvas><span>${esc(shown(m.data.map.name) || m.data.map.id)}<small>${esc(m.data.map.id)} · ${m.data.map.width}×${m.data.map.height}${m.data.map.id === ctx.store.game.start.map ? ` · ${t('start')}` : ''}</small></span></button>`

/** The maps' list as a tree by group. */
export function mapTree(ctx: Ctx): string {
  const groups = new Map<string, Sourced<RawChunk>[]>()
  for (const m of ctx.store.maps()) {
    const g = m.data.map.region ?? ''
    groups.set(g, [...(groups.get(g) ?? []), m])
  }
  const order = [...groups.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
  return order
    .map((g) => {
      const list = groups.get(g)!
      const body = `<div class="palette list maps">${list.map((m) => row(ctx, m)).join('')}</div>`
      return order.length === 1 && g === '' ? body : `<details open class="group"><summary>${esc(g || t('(no group)'))} <small class="muted">${list.length}</small></summary>${body}</details>`
    })
    .join('')
}

/** What the tree shows of the maps: while it is the same, the tree built last time is the tree. */
function treeKey(ctx: Ctx): string {
  const parts = [ctx.store.id, ctx.store.game.start.map]
  for (const m of ctx.store.maps()) parts.push(m.data.map.id, shown(m.data.map.name) ?? '', String(m.data.map.width), String(m.data.map.height), m.data.map.region ?? '')
  return parts.join('\0')
}
let kept: { key: string; el: HTMLElement; open: (id: string) => void } | undefined

/**
 * The tree put into a slot of a panel drawn anew — the one built last time, moved there, while the maps are as they
 * were (a brush stroke draws the panel again at every cell: the tree of a thousand rows is built once), its rows'
 * marks and minis brought up to date; `open` is what a click on a map does.
 */
export function mountTree(ctx: Ctx, slot: HTMLElement, open: (id: string) => void): void {
  const key = treeKey(ctx)
  if (kept?.key !== key) {
    const el = document.createElement('div')
    el.className = 'tree'
    el.innerHTML = mapTree(ctx)
    el.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-map]'); if (b) kept?.open(b.dataset.map!) })
    kept = { key, el, open }
  } else {
    kept.open = open
    for (const b of kept.el.querySelectorAll<HTMLElement>('.maprow.on')) b.classList.toggle('on', b.dataset.map === ctx.map)
    kept.el.querySelector<HTMLElement>(`[data-map="${CSS.escape(ctx.map)}"]`)?.classList.add('on')
  }
  slot.replaceChildren(kept.el)
  paintMinis(ctx, kept.el)
}

/** The world overview: each map where the world lays it, the others in a row below; click one to open it. */
export function overview(ctx: Ctx, el: HTMLElement, open: (id: string) => void): void {
  const c = ctx.store.compiled()
  const at = new Map(c.index.maps.filter((m) => m.at).map((m) => [m.id, m.at!]))
  const chunks = ctx.store.maps().map((m) => m.data)
  const placed = chunks.filter((m) => at.has(m.map.id))
  const loose = chunks.filter((m) => !at.has(m.map.id))
  // the world's box, in cells; the loose maps in a row under it
  let x0 = 0, y0 = 0, x1 = 1, y1 = 1
  for (const m of placed) {
    const p = at.get(m.map.id)!
    ;(x0 = Math.min(x0, p.x)), (y0 = Math.min(y0, p.y)), (x1 = Math.max(x1, p.x + m.map.width)), (y1 = Math.max(y1, p.y + m.map.height))
  }
  if (!placed.length) (x1 = 0), (y1 = 0)
  const pos = new Map<string, { x: number; y: number }>()
  for (const m of placed) pos.set(m.map.id, { x: at.get(m.map.id)!.x - x0, y: at.get(m.map.id)!.y - y0 })
  const gap = 6
  let lx = 0
  const ly = (placed.length ? y1 - y0 : 0) + gap * 3
  let rowH = 0
  const wide = Math.max(x1 - x0, 120)
  let lyy = ly
  for (const m of loose) {
    if (lx && lx + m.map.width > wide) (lx = 0), (lyy += rowH + gap * 2), (rowH = 0)
    pos.set(m.map.id, { x: lx, y: lyy })
    lx += m.map.width + gap
    rowH = Math.max(rowH, m.map.height)
  }
  const W = Math.max(wide, lx)
  const H = Math.max(lyy + rowH, 1)
  const room = Math.max(320, el.clientWidth - 40)
  const k = Math.max(1, Math.min(8, Math.floor(room / W)))
  el.innerHTML = `<div class="overview-head"><h3>${t('The world')}</h3><span class="muted">${t('{placed} laid out by their edges, {loose} reached by portals. Click a map to open it.', { placed: placed.length, loose: loose.length })}</span> <button id="ovBack">${t('Back to the map')}</button></div><canvas id="ovCanvas" width="${W * k}" height="${H * k + 14}"></canvas>`
  const cv = el.querySelector<HTMLCanvasElement>('#ovCanvas')!
  const g = cv.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.fillStyle = '#0f121a'
  g.fillRect(0, 0, cv.width, cv.height)
  if (loose.length) (g.fillStyle = '#8b93a7'), (g.font = '11px system-ui'), g.fillText(t('reached by portals'), 0, (ly - gap) * k)
  const tmp = document.createElement('canvas')
  for (const m of chunks) {
    const p = pos.get(m.map.id)!
    const img = groundOf(ctx, m)
    tmp.width = img.width
    tmp.height = img.height
    tmp.getContext('2d')!.putImageData(img, 0, 0)
    g.drawImage(tmp, p.x * k, p.y * k, m.map.width * k, m.map.height * k)
    g.strokeStyle = m.map.id === ctx.map ? '#f0b85a' : '#2e3548'
    g.lineWidth = m.map.id === ctx.map ? 2 : 1
    g.strokeRect(p.x * k + 0.5, p.y * k + 0.5, m.map.width * k - 1, m.map.height * k - 1)
    g.fillStyle = '#e7e9f0'
    g.font = '11px system-ui'
    g.fillText(m.map.id, p.x * k + 3, p.y * k + 12)
  }
  // a portal's line: from its cell to where it lands, across maps
  g.strokeStyle = '#ff4fd8aa'
  g.lineWidth = 1
  for (const m of chunks)
    for (const pt of m.map.portals) {
      const a = pos.get(m.map.id)
      const b = pos.get(pt.to)
      if (!a || !b || pt.to === m.map.id) continue
      g.beginPath()
      g.moveTo((a.x + pt.x + 0.5) * k, (a.y + pt.y + 0.5) * k)
      g.lineTo((b.x + pt.tx + 0.5) * k, (b.y + pt.ty + 0.5) * k)
      g.stroke()
    }
  cv.onclick = (e) => {
    const r = cv.getBoundingClientRect()
    const x = (e.clientX - r.left) / k
    const y = (e.clientY - r.top) / k
    const hit = chunks.find((m) => { const p = pos.get(m.map.id)!; return x >= p.x && y >= p.y && x < p.x + m.map.width && y < p.y + m.map.height })
    if (hit) open(hit.map.id)
  }
  el.querySelector<HTMLButtonElement>('#ovBack')!.onclick = () => open(ctx.map)
}
