// The ground's height as the author reads it (the map's Height layer): in half levels, 0 the horizon — the ground
// every map stands on, what a map without heights is everywhere — and 2 a whole level up. One walks up or down a
// half level; a step of a whole level or more is a cliff. Each height its words, its colour on the map, and the
// edges between cells that cannot be walked. Pure: mapMode.ts draws them.

import { t } from './lang.ts'

export const MAX_HEIGHT = 9

/** A height in words: the horizon, half a level up, a level up, 1 and a half levels up, 2 levels up … */
export function heightWords(h: number): string {
  if (h <= 0) return t('the horizon (the ground)')
  if (h === 1) return t('half a level up')
  if (h === 2) return t('a level up')
  return h % 2 ? t('{n} and a half levels up', { n: (h - 1) / 2 }) : t('{n} levels up', { n: h / 2 })
}

/** A height's colour, low to high from green through yellow to red (the horizon has none): [r, g, b]. */
export function heightRgb(h: number): [number, number, number] | undefined {
  if (h <= 0) return undefined
  const hue = 120 - ((Math.min(h, MAX_HEIGHT) - 1) / (MAX_HEIGHT - 1)) * 120
  const f = (n: number) => {
    const k = (n + hue / 30) % 12
    return Math.round(255 * (0.55 - 0.45 * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return [f(0), f(8), f(4)]
}
export const heightCss = (h: number): string => { const c = heightRgb(h); return c ? `rgb(${c.join(',')})` : 'transparent' }
export const heightHex = (h: number): number | undefined => { const c = heightRgb(h); return c && (c[0] << 16) | (c[1] << 8) | c[2] }

/** Where two neighbouring cells differ by a whole level or more (a cliff): each edge once, as the cell left of or above it. */
export function cliffs(heights: string[] | undefined): { x: number; y: number; side: 'right' | 'down' }[] {
  const out: { x: number; y: number; side: 'right' | 'down' }[] = []
  if (!heights) return out
  const at = (x: number, y: number) => Number(heights[y]?.[x] ?? 0) || 0
  for (let y = 0; y < heights.length; y++)
    for (let x = 0; x < heights[y].length; x++) {
      if (x + 1 < heights[y].length && Math.abs(at(x, y) - at(x + 1, y)) >= 2) out.push({ x, y, side: 'right' })
      if (y + 1 < heights.length && Math.abs(at(x, y) - at(x, y + 1)) >= 2) out.push({ x, y, side: 'down' })
    }
  return out
}

/** How the height brush paints: a half level up, a half level down, or every cell to one height. */
export type HeightMode = 'raise' | 'lower' | 'set'

/**
 * Raise or lower cells by a half level (within 0 and the highest), each once a stroke: `done` keeps the cells the
 * stroke has touched, so a brush dragged back over them does not raise them again. A map left all at the horizon
 * writes no heights.
 */
export function sculpt(ch: { map: { rows: string[]; heights?: string[]; width: number; height: number } }, cells: { x: number; y: number }[], mode: 'raise' | 'lower', done: Set<string> = new Set()): void {
  const m = ch.map
  m.heights ??= m.rows.map((r) => '0'.repeat(r.length))
  const rows = m.heights
  for (const c of cells) {
    const key = `${c.x},${c.y}`
    if (c.x < 0 || c.y < 0 || c.x >= m.width || c.y >= m.height || done.has(key)) continue
    done.add(key)
    const h = Number(rows[c.y][c.x] ?? 0) || 0
    const next = Math.max(0, Math.min(MAX_HEIGHT, h + (mode === 'raise' ? 1 : -1)))
    rows[c.y] = rows[c.y].slice(0, c.x) + String(next) + rows[c.y].slice(c.x + 1)
  }
  if (rows.every((r) => /^0*$/.test(r))) delete m.heights
}
