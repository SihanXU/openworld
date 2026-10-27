// The world map's picture (M; docs/continent.md §7): the overworld drawn as one walks it — the same grounds laid one
// over another, the same woods, ranges and hills, the same places' marks (assets/ground.ts), a cell 16 px — so the map
// one reads is the map one walks, seen from higher up. Drawn once a world (its grounds never move) in a few
// milliseconds from the pictures the game has already loaded.

import type { SpriteDef } from '../assets/types.ts'
import { GroundAtlas, T, groundBeneath, groundTile, objectAt } from '../assets/ground.ts'
import { catalog } from '../game.ts'
import { assetUrl } from '../render/assets.ts'

/** The overworld's cells, and the places on them by the sprite each is drawn with. */
export interface ChartGrid {
  width: number
  height: number
  terrain: string[]
  places: { x: number; y: number; sprite?: string }[]
}

/** A picture by its catalogue path, loaded (the browser has it already: the game drew it). */
function load(path: string): Promise<HTMLImageElement | undefined> {
  return new Promise((done) => {
    const img = new Image()
    img.onload = () => done(img)
    img.onerror = () => done(undefined)
    img.src = assetUrl(path)
  })
}

/** The overworld drawn as the game draws it: one pixel a pixel, 16 a cell. */
export async function drawChart(c: ChartGrid): Promise<HTMLCanvasElement> {
  const cat = catalog()
  const W = c.width
  const H = c.height
  const terrainAt = (x: number, y: number): string => c.terrain[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))]
  const groundAt = groundBeneath(cat, undefined, terrainAt)
  // every picture the grounds, their marks and the places are drawn from
  const paths = new Set<string>()
  for (const t of new Set(c.terrain)) {
    const b = cat.blobs[t]
    if (b) paths.add(b.img)
    if (b?.over) for (const [img] of cat.plain[b.over] ?? []) paths.add(img)
    for (const [img] of cat.plain[t] ?? []) paths.add(img)
    for (const d of [...(cat.terrainObjects[t] ?? []), ...(cat.terrainObjects[`${t}_inner`] ?? [])]) paths.add(d.img)
  }
  // the laid grounds are drawn over one another: all their pictures
  for (const b of Object.values(cat.blobs)) if (b.over) paths.add(b.img)
  const marks = c.places.map((p) => (p.sprite ? cat.fixtures[p.sprite]?.base : undefined))
  for (const d of marks) if (d) paths.add(d.img)
  const images: Record<string, HTMLImageElement> = {}
  await Promise.all([...paths].map(async (p) => void ((img) => img && (images[p] = img))(await load(p))))

  const canvas = document.createElement('canvas')
  canvas.width = W * T
  canvas.height = H * T
  const g = canvas.getContext('2d')!
  g.imageSmoothingEnabled = false
  // the ground: each cell's tile, composed in an atlas of its own
  const atlas = new GroundAtlas(cat, images)
  const cols = atlas.canvas.width / T
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = groundTile(atlas, cat, groundAt, x, y)
      g.drawImage(atlas.canvas, (i % cols) * T, Math.floor(i / cols) * T, T, T, x * T, y * T, T, T)
    }
  const sprite = (d: SpriteDef, x: number, y: number, dx = 0, dy = 0) => {
    const img = images[d.img]
    if (img) g.drawImage(img, d.x, d.y, d.w, d.h, x * T + T / 2 - d.ax + dx, (y + 1) * T - d.ay + dy, d.w, d.h)
  }
  // what stands on the cells and the places' marks, row by row from the back, as the game sorts them
  const placesOn = new Map<number, number[]>()
  c.places.forEach((p, i) => placesOn.set(p.y, [...(placesOn.get(p.y) ?? []), i]))
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = objectAt(cat, terrainAt, groundAt, x, y)
      if (o) sprite(o.def, x, y, o.dx, o.dy)
    }
    for (const i of placesOn.get(y) ?? []) {
      const d = marks[i]
      if (d) sprite(d, c.places[i].x, y)
    }
  }
  return canvas
}
