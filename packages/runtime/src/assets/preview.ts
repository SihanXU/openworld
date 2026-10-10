// Standalone visual check of everything in CATALOG (served by Vite at /src/assets/preview.html,
// images from /assets/na/… — run `npx tsx games/openworld/tools/src/copyAssets.ts` first).
// Everything is drawn with plain 2D canvases at 3x so the catalogue can be verified without
// the game renderer.

import { BLOB47, CATALOG } from './catalog.ts'
import type { ActorDef, FxDef, PrefabDef, SpriteDef } from './types.ts'

const S = Number(new URLSearchParams(location.search).get('s')) || 3 // display scale (?s=2 to shrink)
const T = 16
const BASE = '/assets/na/'
const GRASS: [string, number, number] = ['Backgrounds/Tilesets/TilesetFloor.png', 0, 12]
const FLOOR: [string, number, number] = ['Backgrounds/Tilesets/Interior/TilesetInteriorFloor.png', 12, 1]

// ------------------------------------------------------------------------------------------
// image loading
// ------------------------------------------------------------------------------------------
const images = new Map<string, HTMLImageElement>()
let pending = 0
const failed: string[] = []
function img(path: string): HTMLImageElement {
  let im = images.get(path)
  if (!im) {
    im = new Image()
    pending++
    im.onload = () => {
      pending--
      redrawAll()
    }
    im.onerror = () => {
      pending--
      failed.push(path)
      status()
    }
    im.src = encodeURI(BASE + path)
    images.set(path, im)
  }
  return im
}
const ready = (im: HTMLImageElement) => im.complete && im.naturalWidth > 0

function status(): void {
  const el = document.getElementById('status')!
  el.textContent = `${images.size} images, ${pending} loading` + (failed.length ? `, FAILED: ${failed.join(', ')}` : '')
  el.className = failed.length ? 'err' : 'note'
}

// ------------------------------------------------------------------------------------------
// DOM helpers
// ------------------------------------------------------------------------------------------
const main = document.getElementById('main')!
const nav = document.getElementById('nav')!
const drawers: (() => void)[] = []
const animators: ((t: number) => void)[] = []

function section(id: string, title: string): HTMLElement {
  const s = document.createElement('section')
  s.id = id
  const h = document.createElement('h2')
  h.textContent = title
  s.appendChild(h)
  const g = document.createElement('div')
  g.className = 'grid'
  s.appendChild(g)
  // ?only=objects,prefabs shows just those sections (the others are built but not attached).
  const only = new URLSearchParams(location.search).get('only')
  if (!only || only.split(',').includes(id)) main.appendChild(s)
  const a = document.createElement('a')
  a.href = only ? `?s=${S}&only=${id}` : '#' + id
  a.textContent = title.split(' ')[0]
  nav.appendChild(a)
  return g
}

function card(parent: HTMLElement, key: string, w: number, h: number, note?: string): CanvasRenderingContext2D {
  const c = document.createElement('div')
  c.className = 'card'
  const cv = document.createElement('canvas')
  cv.width = w * S
  cv.height = h * S
  c.appendChild(cv)
  const k = document.createElement('div')
  k.className = 'key'
  k.textContent = key
  c.appendChild(k)
  if (note) {
    const n = document.createElement('div')
    n.className = 'note'
    n.textContent = note
    c.appendChild(n)
  }
  parent.appendChild(c)
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  return ctx
}

// ------------------------------------------------------------------------------------------
// drawing primitives (all coordinates in source pixels; the context is scaled by S)
// ------------------------------------------------------------------------------------------
function blit(ctx: CanvasRenderingContext2D, path: string, sx: number, sy: number, w: number, h: number, dx: number, dy: number): void {
  const im = img(path)
  if (!ready(im)) return
  ctx.drawImage(im, sx, sy, w, h, dx * S, dy * S, w * S, h * S)
}
function tile(ctx: CanvasRenderingContext2D, [path, c, r]: [string, number, number], dx: number, dy: number): void {
  blit(ctx, path, c * T, r * T, T, T, dx, dy)
}
function fillTiles(ctx: CanvasRenderingContext2D, t: [string, number, number], cols: number, rows: number): void {
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) tile(ctx, t, x * T, y * T)
}
/** Draw a sprite so its anchor sits on the bottom-centre of the tile whose top-left is (x, y) px. */
function sprite(ctx: CanvasRenderingContext2D, s: SpriteDef, x: number, y: number): void {
  blit(ctx, s.img, s.x, s.y, s.w, s.h, x + 8 - s.ax, y + T - s.ay)
}
function outline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, lw = 1): void {
  ctx.strokeStyle = color
  ctx.lineWidth = lw
  ctx.strokeRect(x * S + 0.5, y * S + 0.5, w * S - 1, h * S - 1)
}
function clear(ctx: CanvasRenderingContext2D, color = '#2d323b'): void {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

// Tinted copies (multiplicative, like Phaser's default tint) for creature variants.
const tintCache = new Map<string, HTMLCanvasElement>()
function tinted(path: string, tint: number): HTMLCanvasElement | null {
  const key = path + '|' + tint
  const hit = tintCache.get(key)
  if (hit) return hit
  const im = img(path)
  if (!ready(im)) return null
  const cv = document.createElement('canvas')
  cv.width = im.naturalWidth
  cv.height = im.naturalHeight
  const c = cv.getContext('2d')!
  c.drawImage(im, 0, 0)
  c.globalCompositeOperation = 'multiply'
  c.fillStyle = '#' + tint.toString(16).padStart(6, '0')
  c.fillRect(0, 0, cv.width, cv.height)
  c.globalCompositeOperation = 'destination-in'
  c.drawImage(im, 0, 0)
  tintCache.set(key, cv)
  return cv
}

// Static cards are redrawn at most every 300ms while images are still arriving.
let redrawQueued = false
function redrawAll(): void {
  if (redrawQueued) return
  redrawQueued = true
  setTimeout(() => {
    redrawQueued = false
    status()
    for (const d of drawers) d()
  }, 300)
}

// ------------------------------------------------------------------------------------------
// Blobs: full block + an island rendered through BLOB47
// ------------------------------------------------------------------------------------------
const ISLAND = [
  '..............',
  '.#####..####..',
  '.##.###.####..',
  '.#####..###...',
  '.##.###.#.....',
  '......#.......',
  '..###.######..',
  '..###.###.##..',
  '..###.##.###..',
  '#.......##....',
]
function islandMask(x: number, y: number): number {
  const at = (xx: number, yy: number) => (ISLAND[yy]?.[xx] === '#' ? 1 : 0)
  const N = at(x, y - 1), E = at(x + 1, y), Sx = at(x, y + 1), W = at(x - 1, y)
  let m = N | (E << 2) | (Sx << 4) | (W << 6)
  if (N && E && at(x + 1, y - 1)) m |= 2
  if (Sx && E && at(x + 1, y + 1)) m |= 8
  if (Sx && W && at(x - 1, y + 1)) m |= 32
  if (N && W && at(x - 1, y - 1)) m |= 128
  return m
}
const BLOB_UNDER: Record<string, [string, number, number]> = {
  farmland: ['Backgrounds/Tilesets/TilesetFloor.png', 11, 12],
  bridge: ['Backgrounds/Tilesets/TilesetWater.png', 1, 7],
}
{
  const g = section('blobs', 'Blobs (block 11x5 + island via BLOB47)')
  for (const [key, b] of Object.entries(CATALOG.blobs)) {
    const ctx = card(g, `blobs.${key}  ${b.img.split('/').pop()} (${b.col},${b.row})`, 11 * T + 8 + 14 * T, 10 * T)
    const under = BLOB_UNDER[key] ?? GRASS
    drawers.push(() => {
      clear(ctx)
      for (let r = 0; r < 5; r++) for (let c = 0; c < 11; c++) tile(ctx, [b.img, b.col + c, b.row + r], c * T, r * T)
      for (let r = 0; r <= 5; r++) for (let c = 0; c <= 11; c++) {
        ctx.fillStyle = 'rgba(0,255,255,.5)'
        ctx.fillRect(c * T * S, r * T * S, 1, 1)
      }
      outline(ctx, 0, 0, 11 * T, 5 * T, 'rgba(255,255,0,.6)')
      const ox = 11 * T + 8
      for (let y = 0; y < ISLAND.length; y++)
        for (let x = 0; x < 14; x++) {
          tile(ctx, under, ox + x * T, y * T)
          if (ISLAND[y][x] !== '#') continue
          const [c, r] = BLOB47[islandMask(x, y)]
          tile(ctx, [b.img, b.col + c, b.row + r], ox + x * T, y * T)
        }
    })
  }
}

// ------------------------------------------------------------------------------------------
// Plain tiles & decals
// ------------------------------------------------------------------------------------------
{
  const g = section('plain', 'Plain tiles')
  for (const [key, tiles] of Object.entries(CATALOG.plain)) {
    const ctx = card(g, `plain.${key}`, tiles.length * (T + 2), T)
    drawers.push(() => {
      clear(ctx)
      tiles.forEach((t, i) => tile(ctx, t, i * (T + 2), 0))
    })
  }
}
{
  const g = section('decals', 'Decals (on grass / floor)')
  for (const [key, list] of Object.entries(CATALOG.decals)) {
    const ctx = card(g, `decals.${key}`, list.length * (T + 2), T)
    drawers.push(() => {
      clear(ctx)
      list.forEach((s, i) => {
        tile(ctx, key === 'floor' ? FLOOR : GRASS, i * (T + 2), 0)
        sprite(ctx, s, i * (T + 2), 0)
      })
    })
  }
}

// ------------------------------------------------------------------------------------------
// Terrain objects: each on a 3x4 grass patch, anchor tile outlined
// ------------------------------------------------------------------------------------------
{
  const g = section('objects', 'Terrain objects (anchor tile outlined red)')
  for (const [key, list] of Object.entries(CATALOG.terrainObjects)) {
    list.forEach((s, i) => {
      const ctx = card(g, `terrainObjects.${key}[${i}]`, 4 * T, 4 * T, `${s.w}x${s.h} a(${s.ax},${s.ay})`)
      drawers.push(() => {
        clear(ctx)
        fillTiles(ctx, GRASS, 4, 4)
        outline(ctx, 1.5 * T, 2 * T, T, T, '#ff4040', 2)
        sprite(ctx, s, 1.5 * T, 2 * T)
      })
    })
  }
}

// ------------------------------------------------------------------------------------------
// Prefabs with their grid
// ------------------------------------------------------------------------------------------
function drawPrefab(ctx: CanvasRenderingContext2D, p: PrefabDef, ox: number, oy: number): void {
  blit(ctx, p.img, p.x, p.y, p.tw * T, p.th * T, ox, oy)
  p.grid.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const colors: Record<string, string> = { '#': 'rgba(255,40,40,.33)', D: 'rgba(40,255,80,.55)', '.': 'rgba(80,160,255,.25)' }
      if (!colors[ch]) return
      ctx.fillStyle = colors[ch]
      ctx.fillRect((ox + x * T) * S, (oy + y * T) * S, T * S, T * S)
      outline(ctx, ox + x * T, oy + y * T, T, T, 'rgba(255,255,255,.35)')
    }),
  )
}
{
  const g = section('prefabs', 'Prefabs (red solid, green door, blue walkable)')
  for (const [key, p] of Object.entries(CATALOG.prefabs)) {
    const w = p.tw + 2, h = p.th + 2
    const ctx = card(g, `prefabs.${key}`, w * T * 2 + 8, h * T, `${p.tw}x${p.th}  ${p.grid.map((r) => `[${r}]`).join('')}`)
    drawers.push(() => {
      clear(ctx)
      fillTiles(ctx, GRASS, 2 * w + 1, h)
      blit(ctx, p.img, p.x, p.y, p.tw * T, p.th * T, T, T)
      drawPrefab(ctx, p, w * T + 8 + T, T)
    })
  }
}

// ------------------------------------------------------------------------------------------
// Rooms: nine-slice into a 7x5 room
// ------------------------------------------------------------------------------------------
{
  const g = section('rooms', 'Rooms (nine-sliced into a 7x5 room, floor_wood inside)')
  for (const [key, r] of Object.entries(CATALOG.rooms)) {
    const W = 7, H = 5
    const ctx = card(g, `rooms.${key} (${r.col},${r.row}) size ${r.size}`, W * T, H * T)
    drawers.push(() => {
      clear(ctx, '#141b1b')
      const fb = CATALOG.blobs.floor_wood
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) tile(ctx, [fb.img, fb.col + 1, fb.row + 1], x * T, y * T)
      const last = r.size - 1
      const pick = (i: number, n: number) => (i === 0 ? 0 : i === n - 1 ? last : 1 + ((i - 1) % (r.size - 2)))
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (x > 0 && x < W - 1 && y > 0 && y < H - 1) continue
          tile(ctx, [r.img, r.col + pick(x, W), r.row + pick(y, H)], x * T, y * T)
        }
    })
  }
}

// ------------------------------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------------------------------
{
  const g = section('fixtures', 'Fixtures (base / open / lit; anchor tile outlined)')
  for (const [key, f] of Object.entries(CATALOG.fixtures)) {
    const states = (['base', 'open', 'lit'] as const).filter((s) => f[s])
    const ctx = card(g, key, states.length * 4 * T, 4 * T, states.join(' / '))
    drawers.push(() => {
      clear(ctx)
      states.forEach((st, i) => {
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) tile(ctx, GRASS, i * 4 * T + x * T, y * T)
        outline(ctx, i * 4 * T + 1.5 * T, 2 * T, T, T, '#ff4040', 2)
        const s = f[st]!
        sprite(ctx, s, i * 4 * T + 1.5 * T, 2 * T)
      })
    })
  }
}

// ------------------------------------------------------------------------------------------
// Items
// ------------------------------------------------------------------------------------------
{
  const g = section('items', 'Items')
  for (const [key, s] of Object.entries(CATALOG.items)) {
    const w = Math.max(24, s.w + 4), h = Math.max(24, s.h + 4)
    const ctx = card(g, key, w, h)
    drawers.push(() => {
      clear(ctx, '#3b4150')
      blit(ctx, s.img, s.x, s.y, s.w, s.h, Math.floor((w - s.w) / 2), Math.floor((h - s.h) / 2))
    })
  }
}

// ------------------------------------------------------------------------------------------
// Characters & creatures: animated walk cycle in 4 directions
// ------------------------------------------------------------------------------------------
function actorCard(parent: HTMLElement, key: string, a: ActorDef, note?: string): void {
  const im = img(`${a.dir}/${a.sheet}`)
  if (a.faceset) img(`${a.dir}/${a.faceset}`)
  const dirs = a.rows === 1 ? 1 : a.cols
  const cellW = a.rows === 1 ? 64 : 20
  const ctx = card(parent, key, dirs * cellW + (a.faceset ? 42 : 0), a.rows === 1 ? 56 : 40, note ?? `${a.dir.split('/').slice(1).join('/')} ${a.cols}x${a.rows}${a.tint !== undefined ? ' tint #' + a.tint.toString(16) : ''}`)
  animators.push((t) => {
    if (!ready(im)) return
    clear(ctx, '#5a7a4a')
    const fw = im.naturalWidth / a.cols
    const fh = im.naturalHeight / a.rows
    const src: CanvasImageSource = a.tint !== undefined ? (tinted(`${a.dir}/${a.sheet}`, a.tint) ?? im) : im
    if (a.rows === 1) {
      // boss strip: cols are frames
      const f = Math.floor(t / 150) % a.cols
      const sc = Math.min(1, 50 / fh)
      ctx.drawImage(src, f * fw, 0, fw, fh, 2 * S, 2 * S, fw * S * sc, fh * S * sc)
    } else {
      const walkRows = Math.min(4, a.rows)
      const f = Math.floor(t / 180) % walkRows
      for (let d = 0; d < a.cols; d++) {
        ctx.drawImage(src, d * fw, f * fh, fw, fh, (d * cellW + 2) * S, 12 * S, fw * S, fh * S)
      }
      ctx.fillStyle = '#fff'
      ctx.font = `${3 * S}px monospace`
      ;['D', 'U', 'L', 'R'].forEach((l, d) => ctx.fillText(l, (d * cellW + 8) * S, 9 * S))
    }
    if (a.faceset) {
      const fi = img(`${a.dir}/${a.faceset}`)
      if (ready(fi)) ctx.drawImage(fi, 0, 0, fi.naturalWidth, fi.naturalHeight, (dirs * cellW + 2) * S, 1 * S, 38 * S, 38 * S)
    }
  })
}
{
  const g = section('roles', 'Roles')
  for (const [role, keys] of Object.entries(CATALOG.roles)) {
    const ctx = card(g, `roles.${role}`, keys.length * 18, 18, keys.join(', '))
    animators.push((t) => {
      clear(ctx, '#5a7a4a')
      keys.forEach((k, i) => {
        const a = CATALOG.characters[k]
        if (!a) {
          ctx.fillStyle = '#f00'
          ctx.fillRect(i * 18 * S, 0, 16 * S, 16 * S)
          return
        }
        const im = img(`${a.dir}/${a.sheet}`)
        if (!ready(im)) return
        const f = Math.floor(t / 180) % Math.min(4, a.rows)
        ctx.drawImage(im, 0, f * 16, 16, 16, (i * 18 + 1) * S, 1 * S, 16 * S, 16 * S)
      })
    })
  }
}
{
  const g = section('characters', 'Characters (walk cycle: down, up, left, right)')
  for (const [key, a] of Object.entries(CATALOG.characters)) actorCard(g, key, a)
}
{
  const g = section('creatures', 'Creatures')
  for (const [key, a] of Object.entries(CATALOG.creatures)) actorCard(g, key, a)
}

// ------------------------------------------------------------------------------------------
// FX
// ------------------------------------------------------------------------------------------
function fxCard(parent: HTMLElement, key: string, f: FxDef): void {
  const im = img(f.img)
  const sc = f.scale ?? 1
  const w = Math.max(f.fw * sc, 24) + 8, h = Math.max(f.fh * sc, 24) + 8
  const ctx = card(parent, key, w, h, `${f.img.replace('FX/', '')} ${f.fw}x${f.fh} x${f.frames} @${f.fps}${f.add ? ' add' : ''}`)
  // Static strip of every frame (cyan separators) under the animation, to check frame slicing.
  const strip = card(parent, key + ' frames', f.frames * (f.fw + 2), f.fh)
  drawers.push(() => {
    clear(strip, '#20242b')
    for (let i = 0; i < f.frames; i++) {
      blit(strip, f.img, f.vertical ? 0 : i * f.fw, f.vertical ? i * f.fh : 0, f.fw, f.fh, i * (f.fw + 2), 0)
      strip.fillStyle = '#0ff'
      strip.fillRect((i * (f.fw + 2) + f.fw) * S, 0, 2 * S, f.fh * S)
    }
  })
  animators.push((t) => {
    if (!ready(im)) return
    clear(ctx, key.startsWith('ovl:') ? '#5a7a4a' : '#20242b')
    if (key.startsWith('ovl:')) {
      // show the overlay on a villager
      const v = CATALOG.characters.Villager
      const vi = img(`${v.dir}/${v.sheet}`)
      if (ready(vi)) ctx.drawImage(vi, 0, 0, 16, 16, ((w - 16) / 2) * S, (h - 18) * S, 16 * S, 16 * S)
    }
    const fr = Math.floor((t / 1000) * f.fps) % f.frames
    const sx = f.vertical ? 0 : fr * f.fw
    const sy = f.vertical ? fr * f.fh : 0
    ctx.globalCompositeOperation = f.add ? 'lighter' : 'source-over'
    ctx.drawImage(im, sx, sy, f.fw, f.fh, ((w - f.fw * sc) / 2) * S, ((h - f.fh * sc) / 2) * S, f.fw * sc * S, f.fh * sc * S)
    ctx.globalCompositeOperation = 'source-over'
  })
}
{
  const g = section('fx', 'FX')
  for (const [key, f] of Object.entries(CATALOG.fx)) fxCard(g, key, f)
}

// ------------------------------------------------------------------------------------------
// UI
// ------------------------------------------------------------------------------------------
{
  const g = section('ui', 'UI')
  for (const [key, s] of Object.entries(CATALOG.ui)) {
    const frames = s.frames ?? 1
    const ctx = card(g, `ui.${key}`, s.w * frames + (frames - 1) * 2, s.h, `${s.w}x${s.h}${frames > 1 ? ' x' + frames : ''}`)
    drawers.push(() => {
      clear(ctx, '#3b4150')
      for (let i = 0; i < frames; i++) blit(ctx, s.img, s.x + i * (s.step ?? s.w), s.y, s.w, s.h, i * (s.w + 2), 0)
    })
  }
}

// ------------------------------------------------------------------------------------------
// Audio
// ------------------------------------------------------------------------------------------
{
  let playing: HTMLAudioElement | null = null
  const g = section('audio', 'Audio (music / sfx)')
  for (const [group, table] of [['music', CATALOG.music], ['sfx', CATALOG.sfx]] as const) {
    const box = document.createElement('div')
    box.className = 'card'
    const k = document.createElement('div')
    k.className = 'key'
    k.textContent = group
    box.appendChild(k)
    const row = document.createElement('div')
    row.className = 'row'
    for (const [key, path] of Object.entries(table)) {
      const b = document.createElement('button')
      b.textContent = key
      b.title = path
      b.onclick = () => {
        if (group === 'music' && playing) playing.pause()
        const a = new Audio(encodeURI(BASE + path))
        a.onerror = () => b.classList.add('err')
        void a.play().catch(() => b.classList.add('err'))
        if (group === 'music') playing = a
      }
      row.appendChild(b)
    }
    if (group === 'music') {
      const stop = document.createElement('button')
      stop.textContent = '■ stop'
      stop.onclick = () => playing?.pause()
      row.appendChild(stop)
    }
    box.appendChild(row)
    g.appendChild(box)
  }
}

redrawAll()
const loop = (t: number) => {
  for (const a of animators) a(t)
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
