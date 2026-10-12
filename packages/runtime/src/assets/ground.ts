// Ground rendering from the asset pack: plain tiles + 47-tile blob autotiles, composited
// into one runtime tileset canvas so Phaser can draw each map as a single tilemap layer.
//
// Blob blocks are decoded from their pixels, not from a hand-written table: for every tile
// in a block we sample 8 border points and classify each as "fill" (the terrain) or
// "outside" (the ground around it). A map cell then asks for the tile whose signature
// matches its neighbourhood.

import type { Catalog } from './types.ts'

// ---------------------------------------------------------------------------------------------
// Blob autotile layout (verified)
// ---------------------------------------------------------------------------------------------
/**
 * The 47-tile blob layout of TilesetFloor.png cols 0-10 rows 7-11, as offsets from the block's
 * top-left. Key = canonical 8-neighbour mask of "same terrain" neighbours:
 *   N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128 (a corner bit only counts when both adjacent
 *   edges are set). Derived by classifying every tile of the reference block pixel-by-pixel
 *   (47 distinct masks, one tile each). NOTE the layout is the 10x4 block + 5 tiles in the 5th
 *   row (cols 4-8) + TWO extra tiles in column 10, rows 2-3 (masks 117 and 213) — so a block
 *   is 11 tiles wide. (0,4)-(3,4) of a block are plain-ground variants, not part of the blob.
 */
export const BLOB47: Record<number, [number, number]> = {
  0: [3, 3], 1: [3, 2], 4: [0, 3], 5: [4, 3], 7: [0, 2], 16: [3, 0], 17: [3, 1], 20: [4, 0], 21: [4, 4],
  23: [4, 1], 28: [0, 0], 29: [4, 2], 31: [0, 1], 64: [2, 3], 65: [7, 3], 68: [1, 3], 69: [8, 3], 71: [6, 3],
  80: [7, 0], 81: [7, 4], 84: [8, 0], 85: [8, 4], 87: [9, 3], 92: [6, 0], 93: [9, 2], 95: [6, 4], 112: [2, 0],
  113: [7, 2], 116: [5, 0], 117: [10, 2], 119: [9, 1], 124: [1, 0], 125: [8, 2], 127: [6, 2], 193: [2, 2],
  197: [5, 3], 199: [1, 2], 209: [7, 1], 213: [10, 3], 215: [8, 1], 221: [9, 0], 223: [6, 1], 241: [2, 1],
  245: [5, 4], 247: [5, 1], 253: [5, 2], 255: [1, 1],
}

export const T = 16

/** Sample points (in-tile px) for the 8 neighbour directions, inset from the edges. */
const SAMPLE: [number, number][] = [[8, 3], [12, 3], [12, 8], [12, 12], [8, 12], [3, 12], [3, 8], [3, 3]]

type Img = HTMLImageElement | HTMLCanvasElement

function pixels(img: Img): { data: Uint8ClampedArray; w: number } {
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0)
  return { data: g.getImageData(0, 0, c.width, c.height).data, w: c.width }
}

function avg(px: { data: Uint8ClampedArray; w: number }, x: number, y: number): [number, number, number, number] {
  let r = 0
  let g = 0
  let b = 0
  let a = 0
  let n = 0
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const i = ((y + dy) * px.w + (x + dx)) * 4
      r += px.data[i]
      g += px.data[i + 1]
      b += px.data[i + 2]
      a += px.data[i + 3]
      n++
    }
  return [r / n, g / n, b / n, a / n]
}

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2], (a[3] - b[3]) * 0.5)

export interface BlobTable {
  /** 8-bit signature -> candidate tiles [col,row] in the source image. */
  bySig: Map<number, [number, number][]>
  all: { sig: number; col: number; row: number }[]
}

/** Decode a blob block (10x4 + 5 on the 5th row) by pixel sampling. */
export function decodeBlob(img: Img, col: number, row: number, w = 10, h = 5): BlobTable {
  const px = pixels(img)
  const tile = (c: number, r: number, x: number, y: number) => avg(px, (col + c) * T + x, (row + r) * T + y)
  const fillRef = tile(1, 1, 8, 8) // centre of the 3x3 patch: all fill
  const outRef = tile(0, 0, 3, 3) // top-left corner of the patch: outside
  const all: BlobTable['all'] = []
  const bySig = new Map<number, [number, number][]>()
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const centre = tile(c, r, 8, 8)
      if (centre[3] < 128) continue // empty slot
      let sig = 0
      SAMPLE.forEach(([x, y], i) => {
        const p = tile(c, r, x, y)
        if (dist(p, fillRef) <= dist(p, outRef)) sig |= 1 << i
      })
      all.push({ sig, col: col + c, row: row + r })
      const list = bySig.get(sig) ?? []
      list.push([col + c, row + r])
      bySig.set(sig, list)
    }
  return { bySig, all }
}

/** Signature a cell wants, from which of its 8 neighbours are the same terrain. */
export function wantSig(same: (dx: number, dy: number) => boolean): number {
  const n = same(0, -1)
  const e = same(1, 0)
  const s = same(0, 1)
  const w = same(-1, 0)
  let sig = 0
  if (n) sig |= 1
  if (n && e && same(1, -1)) sig |= 2
  if (e) sig |= 4
  if (s && e && same(1, 1)) sig |= 8
  if (s) sig |= 16
  if (s && w && same(-1, 1)) sig |= 32
  if (w) sig |= 64
  if (n && w && same(-1, -1)) sig |= 128
  return sig
}

function popcount(x: number) {
  let n = 0
  while (x) (n += x & 1), (x >>= 1)
  return n
}

export function pickBlob(t: BlobTable, sig: number, hash: number): [number, number] {
  const exact = t.bySig.get(sig)
  if (exact?.length) return exact[hash % exact.length]
  // nearest signature (edges weigh more than corners)
  let best = t.all[0]
  let bestD = Infinity
  for (const e of t.all) {
    const d = popcount((e.sig ^ sig) & 0b01010101) * 3 + popcount((e.sig ^ sig) & 0b10101010)
    if (d < bestD) (bestD = d), (best = e)
  }
  return [best.col, best.row]
}

export function hash2(x: number, y: number, salt = 0): number {
  let h = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * The runtime ground atlas: every tile a map may need (plain variants + all blob tiles +
 * tinted variants) copied into one canvas grid. Returns frame indices for lookups.
 */
export class GroundAtlas {
  canvas: HTMLCanvasElement
  private g: CanvasRenderingContext2D
  private next = 0
  private cols = 32
  private index = new Map<string, number>()
  blobs: Record<string, BlobTable> = {}

  constructor(
    catalog: Catalog,
    private images: Record<string, Img>,
  ) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.cols * T
    this.canvas.height = 64 * T
    this.g = this.canvas.getContext('2d')!
    this.g.imageSmoothingEnabled = false
    void catalog
  }

  /** Index of a source tile (copied on first use), optionally tinted. */
  tile(img: string, col: number, row: number, tint?: string, under?: [string, number, number]): number {
    const key = `${img}|${col}|${row}|${tint ?? ''}|${under?.join(',') ?? ''}`
    const hit = this.index.get(key)
    if (hit !== undefined) return hit
    const i = this.next++
    const src = this.images[img]
    const x = (i % this.cols) * T
    const y = Math.floor(i / this.cols) * T
    if (under && this.images[under[0]]) this.g.drawImage(this.images[under[0]], under[1] * T, under[2] * T, T, T, x, y, T, T)
    if (src) this.g.drawImage(src, col * T, row * T, T, T, x, y, T, T)
    if (tint) {
      this.g.save()
      this.g.globalCompositeOperation = 'source-atop'
      this.g.fillStyle = tint
      this.g.fillRect(x, y, T, T)
      this.g.restore()
    }
    this.index.set(key, i)
    return i
  }
}

/**
 * Terrains drawn with another terrain's tiles (ice = frozen-looking water) — the overworld's grounds as the
 * local ones they stand for, unless the catalogue draws them itself (a world map of its own: `ow_*` with tiles of their own).
 */
const ALIAS: Record<string, string> = { ice: 'water', spring: 'grass', dirt: 'path', ow_sea: 'deepwater', ow_river: 'water', ow_road: 'path', ow_plain: 'grass', ow_forest: 'grass', ow_hills: 'drygrass', ow_mountain: 'grass', ow_snow: 'snow' }
/** Tints composited over a terrain's tiles. */
const TINT: Record<string, string> = {
  drygrass: 'rgba(214,190,90,0.30)',
  ash: 'rgba(45,40,38,0.62)',
  charred_tree: 'rgba(40,34,30,0.45)',
  burnt_wall: 'rgba(30,24,20,0.6)',
  ice: 'rgba(225,245,255,0.72)',
}
/** Tiles with transparent parts are drawn over a full tile of this terrain. */
const UNDER: Record<string, string> = {
  bridge: 'water',
  door: 'floor_wood',
  stairs_down: 'cave_floor',
  stairs_up: 'cave_floor',
  snow: 'grass',
}

/** Autotile identity: terrains drawn from the same blob block join seamlessly (water + deep water). */
/** The terrain whose tiles draw `terrain`: its own when the catalogue has them, else its alias's. */
const drawnAs = (catalog: Catalog, terrain: string): string => (terrain.startsWith('ow_') && (catalog.blobs[terrain] || catalog.plain[terrain]) ? terrain : (ALIAS[terrain] ?? terrain))

export function groupOf(catalog: Catalog, terrain: string): string {
  const key = drawnAs(catalog, terrain)
  const b = catalog.blobs[key]
  return b ? `${b.img}|${b.col}|${b.row}` : terrain
}

function fullTile(atlasTiles: (img: string, c: number, r: number) => void, catalog: Catalog, terrain: string): [string, number, number] | undefined {
  void atlasTiles
  const b = catalog.blobs[terrain]
  if (b) {
    const [dc, dr] = BLOB47[255]
    return [b.img, b.col + dc, b.row + dr]
  }
  const p = catalog.plain[terrain]?.[0]
  return p ? [p[0], p[1], p[2]] : undefined
}

/** Resolve the atlas tile index for a cell. `terrainAt` returns the terrain at map coords. */
export function groundTile(atlas: GroundAtlas, catalog: Catalog, terrainAt: (x: number, y: number) => string, x: number, y: number, shoreless = false): number {
  const t = terrainAt(x, y)
  const key = drawnAs(catalog, t)
  const tint = TINT[t]
  // an alias draws as its terrain, over that terrain's underlay (the overworld's snowfield is snow over grass)
  const below = UNDER[t] ?? UNDER[key]
  const under = below ? fullTile(() => {}, catalog, below) : undefined
  const h = hash2(x, y)
  const b = catalog.blobs[key]
  if (b) {
    const g = groupOf(catalog, t)
    // underground pools have no grassy shore: draw water as the full inner tile
    const sig = shoreless && g === groupOf(catalog, 'water') ? 255 : wantSig((dx, dy) => groupOf(catalog, terrainAt(x + dx, y + dy)) === g)
    const [dc, dr] = BLOB47[sig] ?? nearestBlob(sig)
    return atlas.tile(b.img, b.col + dc, b.row + dr, tint, under)
  }
  // Cave walls: only the row facing open floor shows a rock face; deeper rock is dark void.
  if (t === 'cave_wall' && terrainAt(x, y + 1) === 'cave_wall') {
    const v = catalog.plain.void?.[0]
    if (v) return atlas.tile(v[0], v[1], v[2])
  }
  const list = catalog.plain[key] ?? catalog.plain.grass
  if (!list?.length) return 0
  const v = h % 10 < 6 ? list[0] : list[h % list.length]
  return atlas.tile(v[0], v[1], v[2], tint, under)
}

function nearestBlob(sig: number): [number, number] {
  let best: [number, number] = BLOB47[255]
  let bestD = Infinity
  for (const [k, off] of Object.entries(BLOB47)) {
    const d = popcount((Number(k) ^ sig) & 0b01010101) * 3 + popcount((Number(k) ^ sig) & 0b10101010)
    if (d < bestD) (bestD = d), (best = off)
  }
  return best
}
