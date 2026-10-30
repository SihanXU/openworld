// How much there is: one thing, then two, four, … on the beat (Good Time, 120 bpm: a beat is half a second).
//   0–10 s   one map → 1,024, none like another                                          (1,024 maps)
//   10–20 s  one person walks out → a crowd of 1,654                                    (1,654 people)
//   20–28 s  a chest opens: things pour out faster and faster                           (40,562 items)
//   28–38 s  a moment → 4 → 16 → … → 1,024, none like another, the mosaic past the frame (infinite possibilities)
//   38–44 s  the name, the waitlist
// The counts are the paper's (Figure 2). A frame for any t (?export: site/video/export.mjs takes them); the page
// plays the film round and round.
import { playLoop } from '../embed.js'
import { L } from '../lang.js'
const params = new URLSearchParams(location.search)
const VIDEO = params.has('export') || params.has('video')
const W = 1920, H = 1080, FPS = 30, LENGTH = 44, BEAT = 0.5

const canvas = document.getElementById('c')
let ctx = canvas.getContext('2d')
/** The canvas's pixels for the film's 1920 x 1080: all of them for the video; on the page only as many as it is shown at
 *  (a small frame need not draw full size), never under half. */
let RES = 1
function fitCanvas() {
  if (VIDEO) return
  RES = Math.max(0.5, Math.min(1, (innerWidth * Math.min(devicePixelRatio || 1, 1.5)) / W))
  canvas.width = Math.round(W * RES); canvas.height = Math.round(H * RES)
  layers.clear()
}
/** Layers drawn once and kept while what they show stands still (the maps settled at their last level, the crowd at a
 *  step): thousands of small pictures drawn as one. A few canvases made once and drawn over again (none made and let go
 *  as the film plays, which the browser would stop to clear away). */
const layers = { slots: [], keys: [] }
layers.clear = () => { layers.keys = [] }
/** A slot's canvas, the size the film is drawn at. */
function slotOf(slot) {
  let l = layers.slots[slot]
  if (!l || l.width !== canvas.width || l.height !== canvas.height) { l = layers.slots[slot] = document.createElement('canvas'); l.width = canvas.width; l.height = canvas.height; layers.keys[slot] = undefined }
  return l
}
/** Draws into a slot's canvas (cleared first if asked) as the film draws. */
function into(l, clear, draw) {
  const main = ctx
  ctx = l.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (clear) ctx.clearRect(0, 0, l.width, l.height)
  ctx.imageSmoothingEnabled = false; ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0)
  try { draw() } finally { ctx = main }
}
/** An act's layers let go once it is over (their memory given back before the next act's pictures need it). */
function release(...slots) {
  for (const k of slots) { const l = layers.slots[k]; if (l) { l.width = l.height = 0; layers.slots[k] = undefined; layers.keys[k] = undefined; progress[k] = undefined } }
}
function cached(slot, key, draw) {
  const l = slotOf(slot)
  if (layers.keys[slot] !== key) { into(l, true, draw); layers.keys[slot] = key }
  ctx.drawImage(l, 0, 0, W, H)
}
/** A layer made a part at a time: `part(i0, i1)` draws the things from i0 to i1 of n into it; `budget` of them a call.
 *  Drawn when asked (finished first if it is not yet). */
const progress = []
function built(slot, key, n, part, budget, show) {
  const l = slotOf(slot)
  if (layers.keys[slot] !== key) {
    if (progress[slot]?.key !== key) progress[slot] = { key, i: 0 }
    const pr = progress[slot], to = Math.min(n, pr.i + (show ? Infinity : budget))
    into(l, pr.i === 0, () => part(pr.i, to))
    pr.i = to
    if (to >= n) layers.keys[slot] = key
  }
  if (show) ctx.drawImage(l, 0, 0, W, H)
}
fitCanvas()
addEventListener('resize', fitCanvas)
ctx.imageSmoothingEnabled = false

const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(im); im.src = src })
/** A picture loaded and decoded once, kept decoded (an ImageBitmap: never thrown away and decoded again as it is drawn). */
const bitmap = async (src) => { const im = await load(src); try { return await createImageBitmap(im) } catch { return im } }
const json = (src) => fetch(src).then((r) => r.json())
const [mapsInfo, peopleInfo, facesInfo, itemsInfo, clipsInfo] = await Promise.all(['assets/maps.json', 'assets/people.json', 'assets/faces.json', 'assets/items.json', 'assets/clips/clips.json'].map(json))
const [MAPS, BIG, PEOPLE, FACES, ITEMS, LEAD] = await Promise.all(['assets/maps.webp', 'assets/big.webp', 'assets/people.webp', 'assets/faces.webp', 'assets/items.webp', 'assets/lead.webp'].map(bitmap))
/** The scenes in the order the mosaic takes them up (site/scale/clips.mjs): the first 64 a sheet each, the rest 32 to a
 *  sheet. The sheets load and are decoded in that order, the first levels' before the deep ones', from the start of
 *  the film: all of them are ready long before the scenes come. */
const CLIPS = clipsInfo.map((c) => ({ ...c, img: null }))
const SHEETS = [...new Set(CLIPS.map((c) => c.sheet))]
async function loadClips() {
  for (let i = 0; i < SHEETS.length; i += 8) {
    await Promise.all(SHEETS.slice(i, i + 8).map(async (name) => { const im = await bitmap(`assets/clips/${name}`); for (const c of CLIPS) if (c.sheet === name) c.img = im }))
  }
}

const hash = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return ((h >>> 0) % 100000) / 100000 }
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x) }
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3)
const easeInOut = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
const easeBack = (x) => { x = clamp(x); const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }
const lerp = (a, b, x) => a + (b - a) * x

// ------------------------------------------------------------------ the pictures, by index

/** The maps the film splits into: 2^LEVELS of them, none like another (assets.ts: the showcase and the hand-made country
 *  first, then every sort of place spread through the order). */
const LEVELS = Math.floor(Math.log2(mapsInfo.maps.length))
const COUNT = 1 << LEVELS
/** A map's square in the atlas. */
const mapAt = (k) => [(k % mapsInfo.cols) * mapsInfo.size, Math.floor(k / mapsInfo.cols) * mapsInfo.size, mapsInfo.size, mapsInfo.size]
/** The first maps' larger squares, for the first levels. */
const bigAt = (k) => { const b = mapsInfo.big; return [(k % b.cols) * b.size, Math.floor(k / b.cols) * b.size, b.size, b.size] }
/** Which map tile i of the last level shows: filled by the level each tile first appears at (its lowest set bit), so the
 *  first maps are the first seen. */
const ORDER = (() => {
  const byAppearance = Array.from({ length: COUNT }, (_, i) => i).sort((a, b) => appear(a) - appear(b) || a - b)
  const out = new Array(COUNT)
  byAppearance.forEach((i, k) => (out[i] = k))
  return out
})()
function appear(i) { if (i === 0) return 0; let l = LEVELS; while (i % 2 === 0) (i /= 2), l--; return l }

const personAt = (k, f) => { const n = peopleInfo.count, i = ((k % n) + n) % n, cw = peopleInfo.w * peopleInfo.frames; return [(i % peopleInfo.cols) * cw + f * peopleInfo.w, Math.floor(i / peopleInfo.cols) * peopleInfo.h, peopleInfo.w, peopleInfo.h] }
/** The faces shown up close: the cast's own portraits among the others. */
const FACE_PICK = (() => { const own = facesInfo.own ?? 0, out = []; for (let k = 0, a = 0, b = own; out.length < facesInfo.count; k++) out.push(k % 2 === 0 && a < own ? a++ : b++); return out })()
const faceAt = (k) => { const i = FACE_PICK[k % facesInfo.count]; return [(i % facesInfo.cols) * facesInfo.size, Math.floor(i / facesInfo.cols) * facesInfo.size, facesInfo.size, facesInfo.size] }
const itemAt = (k) => { const n = itemsInfo.keys.length, i = ((k % n) + n) % n; return [(i % itemsInfo.cols) * itemsInfo.size, Math.floor(i / itemsInfo.cols) * itemsInfo.size, itemsInfo.size, itemsInfo.size] }
const CRATE = Math.max(0, itemsInfo.keys.indexOf('item:crate'))
/** Each item's picture turned to SPIN angles, drawn once: a thing in the storm is drawn from the one nearest its turn
 *  (turning each with a transform of its own costs more than the drawing). */
const SPIN = 16, SP = 48
const SPUN = (() => {
  const n = itemsInfo.keys.length, c = document.createElement('canvas')
  c.width = SPIN * SP; c.height = n * SP
  const x = c.getContext('2d')
  x.imageSmoothingEnabled = false
  for (let i = 0; i < n; i++) for (let a = 0; a < SPIN; a++) {
    x.setTransform(1, 0, 0, 1, a * SP + SP / 2, i * SP + SP / 2); x.rotate((a / SPIN) * Math.PI * 2)
    x.drawImage(ITEMS, ...itemAt(i), -16, -16, 32, 32)
  }
  return c
})()

// ------------------------------------------------------------------ splitting: a rectangle halved again and again

const FRAME = { x: 60, y: 60, w: W - 120, h: H - 120 }
/** Tile i of 2^level: the frame halved `level` times along its longer side, taking the halves i's bits name. */
function rectOf(level, i, r = FRAME) {
  let { x, y, w, h } = r
  for (let l = 1; l <= level; l++) {
    const bit = (i >> (level - l)) & 1
    if (w >= h * 0.9) { w /= 2; if (bit) x += w } else { h /= 2; if (bit) y += h }
  }
  return { x, y, w, h }
}
/** Where tile i is at t while things split on the beat from `t0`, one level a beat, up to `max`. */
function splitting(t, t0, max, i, r = FRAME) {
  const level = clamp(Math.floor((t - t0) / BEAT) + 1, 0, max)
  const at = rectOf(level, i >> (max - level), r)
  if (level === 0) return { r: at, level, born: 0 }
  const from = rectOf(level - 1, i >> (max - level + 1), r)
  const u = easeBack((t - (t0 + (level - 1) * BEAT)) / 0.3)
  const x = lerp(from.x + (at.x - from.x) * 0.5, at.x, u), y = lerp(from.y + (at.y - from.y) * 0.5, at.y, u)
  // a tile not yet split off its parent shows its parent: the same picture until it is its own
  return { r: { x, y, w: lerp(from.w, at.w, u), h: lerp(from.h, at.h, u) }, level, born: (t - (t0 + (level - 1) * BEAT)) }
}
// ------------------------------------------------------------------ the big numbers

function slam(t, t0, big, word, sub) {
  const k = t - t0
  if (k < 0) return
  const a = smooth(k / 0.12)
  const s = 1 + 0.45 * (1 - easeBack(k / 0.35))
  ctx.save()
  // a band of dark behind the words
  const gr = ctx.createLinearGradient(0, H / 2 - 220, 0, H / 2 + 220)
  gr.addColorStop(0, 'rgba(8,10,16,0)'); gr.addColorStop(0.35, 'rgba(8,10,16,0.78)'); gr.addColorStop(0.65, 'rgba(8,10,16,0.78)'); gr.addColorStop(1, 'rgba(8,10,16,0)')
  ctx.globalAlpha = a; ctx.fillStyle = gr; ctx.fillRect(0, H / 2 - 220, W, 440)
  ctx.translate(W / 2, H / 2 - 20); ctx.scale(s, s)
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.font = `800 170px 'Segoe UI', system-ui, sans-serif`
  const bw = ctx.measureText(big).width
  ctx.font = `600 64px 'Segoe UI', system-ui, sans-serif`
  // a word after Chinese runs on without a space
  const sp = /^[一-鿿]/.test(big) ? '' : ' '
  const ww = ctx.measureText(sp + word).width
  const x0 = -(bw + ww) / 2
  ctx.textAlign = 'left'
  ctx.font = `800 170px 'Segoe UI', system-ui, sans-serif`; ctx.fillStyle = '#ffffff'; ctx.fillText(big, x0, 40)
  ctx.font = `600 64px 'Segoe UI', system-ui, sans-serif`; ctx.fillStyle = '#cfdcff'; ctx.fillText(sp + word, x0 + bw, 40)
  if (sub) { ctx.textAlign = 'center'; ctx.font = `400 34px 'Segoe UI', system-ui, sans-serif`; ctx.fillStyle = '#9fb0cc'; ctx.globalAlpha = a * smooth((k - 0.25) / 0.3); ctx.fillText(sub, 0, 110) }
  ctx.restore()
  // the hit: a flash
  const flash = Math.exp(-k * 14) * 0.12
  if (flash > 0.01) { ctx.globalAlpha = flash; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
}
const shake = (t, t0) => (t > t0 && t < t0 + 0.35 ? Math.sin((t - t0) * 90) * 14 * (1 - (t - t0) / 0.35) : 0)

// ------------------------------------------------------------------ the film

const T = { mapsSplit: 2, mapsSlam: 8, people: 10, peopleSplit: 11, peopleSlam: 18, items: 20, open: 20.5, itemsSlam: 26, scenes: 28, scenesSplit: 29, scenesSlam: 36, title: 38 }
const PEOPLE_N = 1654

/** The pictures each act draws, each drawn once small a little before the act (under the background, a few a frame),
 *  so the browser readies them for drawing before they are seen, not in the middle of a split; and only then, so what
 *  it holds ready is what is about to be drawn. */
const warmed = new Set()
function warm(t) {
  let n = 0
  const soon = t < 7 ? [MAPS, BIG, LEAD] : t < 17 ? [PEOPLE, FACES] : t < 26 ? [SPUN] : CLIPS.map((c) => c.img)
  for (const im of soon) {
    if (!im || warmed.has(im) || n++ > 2) continue
    ctx.drawImage(im, 0, 0, 2, 2)
    warmed.add(im)
  }
}

function film(t) {
  ctx.setTransform(RES, 0, 0, RES, 0, 0)
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
  warm(t)
  if (t > T.people + 1) release(0, 5)
  if (t > T.items + 1.3) release(1, 2, 3, 4, 6, 7, 8, 9)
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H)
  const sh = shake(t, T.mapsSlam) + shake(t, T.peopleSlam) + shake(t, T.itemsSlam) + shake(t, T.scenesSlam)
  ctx.setTransform(RES, 0, 0, RES, sh * RES, sh * 0.4 * RES)
  if (t < T.people + 0.8) drawMaps(t)
  if (t >= T.people && t < T.items + 1.2) drawPeople(t)
  if (t >= T.items - 0.2 && t < T.scenes + 0.8) drawItems(t)
  if (t >= T.scenes && t < T.title + 0.4) drawScenes(t)
  ctx.setTransform(RES, 0, 0, RES, 0, 0)
  if (t >= T.mapsSlam && t < T.people) slam(t, T.mapsSlam, '1,024', L('maps', '张地图'), L('towns, villages, wilds and the rooms behind every door', '城镇、村庄、荒野和每扇门后的房间'))
  if (t >= T.peopleSlam && t < T.items) slam(t, T.peopleSlam, '1,654', L('people', '个人'), L('in 780 households, each with a look and a day of their own', '分属 780 户人家，各有自己的样子和一天的安排'))
  if (t >= T.itemsSlam && t < T.scenes) slam(t, T.itemsSlam, '40,562', L('items', '件物品'), L('of 1,013 kinds, in materials, qualities, elements', '共 1,013 种，分材质、品质和元素'))
  if (t >= T.scenesSlam && t < T.title + 0.4) { ctx.globalAlpha = 1 - smooth((t - (T.title - 0.4)) / 0.6); slam(t, T.scenesSlam, L('Infinite', '无限'), L('possibilities', '的可能性')); ctx.globalAlpha = 1 }
  if (t >= T.title - 0.2) drawTitle(t)
  // in and out
  const black = 1 - smooth(t / 0.4) + smooth((t - (LENGTH - 0.9)) / 0.8)
  if (black > 0.01) { ctx.globalAlpha = clamp(black); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
}

function tile(src, [sx, sy, sw, sh], r, a = 1, round = 6) {
  if (r.w < 0.5 || r.h < 0.5 || a <= 0.01) return
  // the picture cut to the tile's shape (its middle kept)
  const k = Math.max(r.w / sw, r.h / sh), cw = r.w / k, ch = r.h / k
  ctx.globalAlpha = a
  ctx.drawImage(src, sx + (sw - cw) / 2, sy + (sh - ch) / 2, cw, ch, r.x, r.y, r.w, r.h)
  // its corners rounded: the background laid over each, outside its curve
  const q = Math.min(round, r.w / 4, r.h / 4)
  if (q >= 1.5) {
    const c = cornerOf(q), n = c.width / 2
    ctx.drawImage(c, 0, 0, n, n, r.x, r.y, q, q)
    ctx.drawImage(c, n, 0, n, n, r.x + r.w - q, r.y, q, q)
    ctx.drawImage(c, 0, n, n, n, r.x, r.y + r.h - q, q, q)
    ctx.drawImage(c, n, n, n, n, r.x + r.w - q, r.y + r.h - q, q, q)
  }
  ctx.globalAlpha = 1
}
/** A rounded corner's four quarters: the film's background outside a circle, drawn once for each radius (half cells).
 *  Laid over a tile's corners, never a rounded clip: hundreds of clips of their own a frame overrun the browser's store
 *  of paths and stall it. */
const BG = '#0b0d12'
const corners = new Map()
function cornerOf(q) {
  const key = Math.round(q * 2)
  if (!corners.has(key)) {
    const n = key * 4, c = document.createElement('canvas')
    c.width = c.height = n * 2
    const x = c.getContext('2d')
    x.fillStyle = BG; x.fillRect(0, 0, n * 2, n * 2)
    x.globalCompositeOperation = 'destination-out'
    x.beginPath(); x.arc(n, n, n, 0, Math.PI * 2); x.fill()
    corners.set(key, c)
  }
  return corners.get(key)
}
const inset = (r, g) => ({ x: r.x + g, y: r.y + g, w: Math.max(0, r.w - 2 * g), h: Math.max(0, r.h - 2 * g) })
/** A map's picture in a tile: the first map from its own whole picture once it is drawn large, the first ones from
 *  their larger squares while they are large, the rest from the atlas. */
function mapTile(k, r, a = 1, round = 6) {
  if (k === 0 && LEAD.width && Math.max(r.w, r.h) > mapsInfo.size) {
    // the atlas's square is the village's square of twelve cells: the whole picture, cut to the tile's shape, once larger
    const s = Math.min(LEAD.width, LEAD.height)
    const wide = clamp((Math.max(r.w, r.h) / Math.min(r.w, r.h) - 1) / 0.5)
    const cw = lerp(s, LEAD.width, wide)
    return tile(LEAD, [(LEAD.width - cw) / 2, (LEAD.height - s) / 2, cw, s], r, a, round)
  }
  if (k < mapsInfo.big.count && BIG.width && Math.max(r.w, r.h) > mapsInfo.size * 1.2) return tile(BIG, bigAt(k), r, a, round)
  tile(MAPS, mapAt(k), r, a, round)
}

/** How far the camera has fallen into the first village (0 to 1). */
const fallen = (t) => (t > T.people ? easeInOut((t - T.people) / 0.6) : 0)
/** The camera falling into the first village as the people begin: about its tile, coming to the middle as it grows. */
function fall(r, t) {
  const z = fallen(t)
  if (z <= 0) return r
  const c = rectOf(LEVELS, 0), fx = c.x + c.w / 2, fy = c.y + c.h / 2
  const sc = lerp(1, (W / c.w) * 1.2, z), px = lerp(fx, W / 2, z), py = lerp(fy, H / 2, z)
  return { x: px + (r.x - fx) * sc, y: py + (r.y - fy) * sc, w: r.w * sc, h: r.h * sc }
}

function drawMaps(t) {
  // the last level, before the camera falls: its picture drawn once and faded in over the level before (a thousand
  // tiles each sliding out of its own is too much to draw thirty times a second, and too small to see)
  const last = T.mapsSplit + (LEVELS - 1) * BEAT
  if (t >= last && t <= T.people) {
    const u = smooth((t - last) / 0.3)
    if (u < 1) cached(5, 'maps:before', () => mapTiles(last - 0.18))
    ctx.globalAlpha = u
    cached(0, 'maps', () => mapTiles(last + 0.4))
    ctx.globalAlpha = 1
  } else mapTiles(t)
}
function mapTiles(t) {
  // the first map comes up out of the dark
  const pop = easeBack((t - 0.25) / 0.5)
  for (let i = 0; i < COUNT; i++) {
    if (t < T.mapsSplit && i > 0) break
    const s = splitting(t, T.mapsSplit, LEVELS, i)
    // only the tiles that exist at this level (one in 2^(LEVELS - level))
    if (i % (1 << (LEVELS - s.level)) !== 0) continue
    const k = ORDER[i]
    let r = s.r
    if (s.level === 0) { const z = pop * 0.62; r = { x: W / 2 - (FRAME.w * z) / 2, y: H / 2 - (FRAME.h * z) / 2, w: FRAME.w * z, h: FRAME.h * z } }
    // as the people begin, the camera falls into the first village; the others give way to it
    r = fall(r, t)
    if (r.x > W || r.y > H || r.x + r.w < 0 || r.y + r.h < 0) continue
    const g = Math.min(4, r.w * 0.04)
    mapTile(k, inset(r, g), k === 0 ? 1 : 1 - fallen(t), s.level < 4 ? 14 : s.level < 8 ? 4 : 0)
  }
}

/** The crowd at t: how many, and where each stands (a grid that fills the frame, the newest stepping out of an elder). */
function crowdLevel(t) { return clamp(Math.floor((t - T.peopleSplit) / BEAT) + 1, 0, 11) }
function crowdCell(n, i) {
  const cols = Math.ceil(Math.sqrt((n * (W - 80) * 36) / ((H - 80) * 24))), rows = Math.ceil(n / cols)
  const cw = (W - 80) / cols, ch = (H - 80) / rows
  const s = Math.min(cw / 24, ch / 36) * 0.92
  return { x: 40 + (i % cols) * cw + cw / 2, y: 40 + Math.floor(i / cols) * ch + ch / 2, s }
}
function drawPeople(t) {
  // the village behind, darkening as the crowd grows
  const level = crowdLevel(t)
  const n = Math.min(PEOPLE_N, 1 << level)
  const bg = 1 - smooth((t - T.peopleSplit - 2) / 2.5)
  if (bg > 0.01 && t > T.people + 0.5) { mapTile(ORDER[0], { x: -40, y: -40 - 400, w: W + 80, h: W + 80 }, bg * 0.55, 0) }
  const away = t > T.items ? easeInOut((t - T.items) / 1.0) : 0
  const prev = Math.min(PEOPLE_N, 1 << Math.max(0, level - 1))
  const u = easeBack((t - (T.peopleSplit + (level - 1) * BEAT)) / 0.3)
  const first = easeBack((t - (T.people + 0.5)) / 0.4)
  // the two largest crowds standing still, but for their steps: the same picture for each step of four, kept as a layer
  // (four for each); a new level faded in over the last, and the last level going as one picture
  const step = Math.floor(t * 8)
  const size = (l) => Math.min(PEOPLE_N, 1 << l)
  const slot = (l, st) => (l === 10 ? 1 : 6) + (st % 4)
  const layer = (l, st = step, show = true) => (l < 10 ? crowd(t, l, size(l), 0, 1, 1, 0, st)
    : built(slot(l, st), `crowd:${l}:${st % 4}`, size(l), (i0, i1) => crowd(t, l, size(l), 0, 1, 1, 0, st, i0, i1), 300, show))
  // both made ahead from the 256's level on, a few hundred figures a frame
  if (level >= 8 && level < 11 && away === 0) {
    const want = [10, 11].flatMap((l) => [0, 1, 2, 3].map((k) => [l, k])).find(([l, k]) => l > level && layers.keys[slot(l, k)] !== `crowd:${l}:${k}`)
    if (want) layer(want[0], want[1], false)
  }
  if (level >= 9) {
    const m = ctx.getTransform(), z = 1 + 1.6 * away
    if (away > 0) ctx.transform(z, 0, 0, z, (W / 2) * (1 - z), (H / 2) * (1 - z))
    if (u < 1) layer(level - 1)
    ctx.globalAlpha = (1 - away) * (u < 1 ? smooth(u) : 1)
    layer(level)
    ctx.globalAlpha = 1
    ctx.setTransform(m)
  } else crowd(t, level, n, prev, u, first, away, step)
  drawPeopleFaces(t)
}
/** The crowd's figures: n of them at a level, stepping out of the last level's by u, going as the chest comes by away. */
function crowd(t, level, n, prev, u, first, away, step, i0 = 0, i1 = n) {
  for (let i = i0; i < Math.min(n, i1); i++) {
    const at = level === 0 ? { x: W / 2, y: H / 2 + 60, s: 9 * first } : crowdCell(n, i)
    let p = at
    if (level > 0 && u < 1) { const from = i < prev ? crowdCell(prev, i) : crowdCell(prev, i >> 1); p = { x: lerp(from.x, at.x, u), y: lerp(from.y, at.y, u), s: lerp(level === 1 ? 9 : from.s, at.s, u) } }
    if (level === 1 && u < 1 && i === 0) p = { x: lerp(W / 2, at.x, u), y: lerp(H / 2 + 60, at.y, u), s: lerp(9, at.s, u) }
    // walking in place toward us, each in their own step
    const f = (step + Math.floor(hash(i) * 4)) % 4
    const [sx, sy, sw, shh] = personAt(Math.floor(hash(i * 3 + 1) * PEOPLE_N), f)
    const dx = Math.sin(t * 2 + i) * 0, w = sw * p.s, h = shh * p.s
    // they part and go as the chest comes
    const go = away * (0.6 + 0.8 * hash(i * 11))
    const ox = (p.x - W / 2) * go * 1.6, oy = (p.y - H / 2) * go * 1.6
    ctx.globalAlpha = 1 - away
    ctx.drawImage(PEOPLE, sx, sy, sw, shh, p.x - w / 2 + dx + ox, p.y - h / 2 + oy, w, h)
  }
  ctx.globalAlpha = 1
}
/** Faces: some of them, up close, a moment each. */
function drawPeopleFaces(t) {
  for (let k = 0; k < 14; k++) {
    const t0 = T.peopleSplit + 3.0 + k * 0.25
    const a = smooth((t - t0) / 0.08) * (1 - smooth((t - t0 - 0.45) / 0.15))
    if (a <= 0.01) continue
    const x = 220 + hash(k * 5 + 2) * (W - 440), y = 220 + hash(k * 9 + 4) * (H - 440), s = 1.7 + 0.5 * easeOut((t - t0) / 0.6)
    ctx.save(); ctx.globalAlpha = a
    ctx.beginPath(); ctx.arc(x, y, 64 * s, 0, Math.PI * 2); ctx.fillStyle = '#efe6d2'; ctx.fill(); ctx.clip()
    ctx.imageSmoothingEnabled = true
    const [fx, fy, fs] = faceAt(k)
    ctx.drawImage(FACES, fx, fy, fs, fs, x - 64 * s, y - 64 * s, 128 * s, 128 * s)
    ctx.imageSmoothingEnabled = false
    ctx.restore()
    ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, 64 * s, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1
  }
}

// things out of the chest: when the k-th comes, which, where it flies
const BURST = (() => {
  const out = [], n = 3600
  for (let k = 0; k < n; k++) {
    // faster and faster: the k-th at a time growing like a log
    const t0 = T.open + 5.2 * Math.log(1 + 18 * (k / n)) / Math.log(19)
    const ang = -Math.PI / 2 + (hash(k * 3) - 0.5) * 2.4, sp = 700 + 1100 * hash(k * 5)
    out.push({ k, t0, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, w: (hash(k * 7) - 0.5) * 14, icon: Math.floor(hash(k * 13) * itemsInfo.keys.length), s: 2.2 + 2.6 * hash(k * 17) })
  }
  return out
})()
function drawItems(t) {
  const fade = 1 - smooth((t - T.scenes) / 0.6)
  const cx = W / 2, cy = H / 2 + 230
  // the chest: up, a shake, open
  const up = easeBack((t - T.items) / 0.4)
  const jig = t > T.open - 0.25 && t < T.open ? Math.sin(t * 80) * 6 : 0
  const cs = 12 * up * (t > T.open ? 1 + 0.12 * Math.exp(-(t - T.open) * 6) : 1)
  ctx.globalAlpha = fade * (1 - smooth((t - (T.open + 3.4)) / 0.8))
  ctx.drawImage(ITEMS, ...itemAt(CRATE), cx - 12 * cs + jig, cy - 12 * cs, 24 * cs, 24 * cs)
  ctx.globalAlpha = fade
  // light from inside once it is open
  if (t > T.open) {
    const gr = ctx.createRadialGradient(cx, cy - 60, 0, cx, cy - 60, 520)
    gr.addColorStop(0, 'rgba(255,230,170,0.5)'); gr.addColorStop(1, 'rgba(255,230,170,0)')
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'
  }
  for (const p of BURST) {
    const k = t - p.t0
    if (k < 0) break
    // thrown up and out; the later ones caught in a turning storm that fills the frame
    let x = cx + p.vx * k, y = cy - 80 + p.vy * k + 900 * k * k
    const storm = smooth((t - (T.open + 3.2)) / 1.5)
    if (storm > 0) {
      // each to its own place in a turning disc that fills the frame
      const pi = p.k, rad = 1050 * Math.sqrt(hash(pi * 23 + 1)), ang = hash(pi * 29 + 2) * Math.PI * 2 + 0.9 * (t - (T.open + 3.2))
      x = lerp(x, W / 2 + Math.cos(ang) * rad, storm); y = lerp(y, H / 2 + Math.sin(ang) * rad * 0.6, storm)
    }
    if (y > H + 60 || x < -60 || x > W + 60) continue
    const s = p.s * Math.min(1, k * 6)
    // (its picture is drawn 32 to the 48 of its cell: the cell drawn at 1.5 times the thing)
    const a = (((Math.round(((p.w * k) / (Math.PI * 2)) * SPIN) % SPIN) + SPIN) % SPIN), d = 36 * s
    ctx.drawImage(SPUN, a * SP, p.icon * SP, SP, SP, x - d / 2, y - d / 2, d, d)
  }
  ctx.globalAlpha = 1
}


// ------------------------------------------------------------------ the scenes: one, then four, sixteen, sixty-four

/** The mosaic's last level is a grid of SIDE x SIDE; each split quarters every window, a bar (two beats) apart. */
const SPLITS = Math.round(Math.log2(CLIPS.length) / 2), SIDE = 1 << SPLITS, BAR = 2 * BEAT
/** The level the window at (row, col) of the last level first appears at: the coarsest grid it is a corner of. */
const bornAt = (r, c) => { let l = SPLITS; while (l > 0 && r % (1 << (SPLITS - l + 1)) === 0 && c % (1 << (SPLITS - l + 1)) === 0) l--; return l }
/** Which scene each window shows: the clips in their order (clips.mjs), the first to the window the film opens on, the
 *  next three to the three it splits into, and so on, each level's spread through it. */
const SCENE_OF = (() => {
  const cells = []
  for (let r = 0; r < SIDE; r++) for (let c = 0; c < SIDE; c++) cells.push([r, c])
  cells.sort((a, b) => bornAt(...a) - bornAt(...b) || hash(a[0] * SIDE + a[1] + 7) - hash(b[0] * SIDE + b[1] + 7))
  const out = new Int32Array(SIDE * SIDE)
  cells.forEach(([r, c], k) => (out[r * SIDE + c] = k))
  return out
})()
/** The window (row, col) of the last level at a level: the block of the grid it heads. */
function windowAt(level, r, c) {
  const n = 1 << level, s = SIDE / n
  return { x: FRAME.x + (Math.floor(c / s) * FRAME.w) / n, y: FRAME.y + (Math.floor(r / s) * FRAME.h) / n, w: FRAME.w / n, h: FRAME.h / n }
}
/** A scene's frame at t: each window its own place in its clip, round and round. */
function sceneFrame(c, t, k) {
  const f = Math.floor((t - T.scenes) * c.fps + hash(k * 9 + 2) * c.frames) % c.frames
  return [(f % c.cols) * c.w, c.y + Math.floor(f / c.cols) * c.h, c.w, c.h]
}
/** The mosaic pulled back from close as its last levels come: it runs past the frame's edges, and draws in. */
const pullBack = (t) => lerp(1.45, 1, easeInOut((t - (T.scenesSplit + (SPLITS - 2) * BAR)) / (T.scenesSlam - (T.scenesSplit + (SPLITS - 2) * BAR))))

function drawScenes(t) {
  const level = clamp(Math.floor((t - T.scenesSplit) / BAR) + 1, 0, SPLITS)
  const u = easeBack((t - (T.scenesSplit + (level - 1) * BAR)) / 0.35)
  // the mosaic dims under the last number and goes before the name comes
  const fade = 1 - 0.35 * smooth((t - T.scenesSlam) / 0.3) - 0.65 * smooth((t - (T.title - 0.6)) / 0.7)
  const z = t < T.scenesSplit + (SPLITS - 2) * BAR ? 1 : pullBack(t)
  const step = SIDE >> level
  ctx.imageSmoothingEnabled = true
  // (the many at night and in the rain are lifted a little in their sheets, so the mosaic reads as the bright world it
  // is: clips.mjs)
  for (let r = 0; r < SIDE; r += step) for (let c = 0; c < SIDE; c += step) {
    const k = SCENE_OF[r * SIDE + c], clip = CLIPS[k]
    if (!clip?.img?.width) continue
    let rect = windowAt(level, r, c)
    if (level === 0) { const e = easeBack((t - T.scenes) / 0.4); rect = { x: W / 2 - (FRAME.w * e) / 2, y: H / 2 - (FRAME.h * e) / 2, w: FRAME.w * e, h: FRAME.h * e } }
    else if (u < 1) {
      // out of the window it was part of, to its own (the old one and its new neighbours alike)
      const from = windowAt(level - 1, r, c)
      rect = { x: lerp(from.x, rect.x, u), y: lerp(from.y, rect.y, u), w: lerp(from.w, rect.w, u), h: lerp(from.h, rect.h, u) }
    }
    if (z !== 1) rect = { x: W / 2 + (rect.x - W / 2) * z, y: H / 2 + (rect.y - H / 2) * z, w: rect.w * z, h: rect.h * z }
    if (rect.x > W || rect.y > H || rect.x + rect.w < 0 || rect.y + rect.h < 0) continue
    const g = Math.min(5, rect.w * 0.03)
    tile(clip.img, sceneFrame(clip, t, k), inset(rect, g), clamp(fade) * (bornAt(r, c) === level && level > 0 ? smooth(u * 3) : 1), level < 2 ? 14 : level < 4 ? 6 : 0)
  }
  ctx.imageSmoothingEnabled = false
}

function drawTitle(t) {
  const a = smooth((t - T.title) / 0.6)
  const s = 1 + 0.08 * (1 - easeOut((t - T.title) / 0.8))
  ctx.save()
  // a little light behind the name
  const gr = ctx.createRadialGradient(W / 2, H / 2 - 30, 0, W / 2, H / 2 - 30, 760)
  gr.addColorStop(0, 'rgba(70,58,40,0.55)'); gr.addColorStop(1, 'rgba(70,58,40,0)')
  ctx.globalAlpha = a; ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H)
  ctx.translate(W / 2, H / 2 - 30); ctx.scale(s, s)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `600 30px 'Pixelify Sans', 'Segoe UI', sans-serif`; ctx.fillStyle = '#f6d48d'
  ctx.globalAlpha = a * smooth((t - T.title - 0.4) / 0.5)
  ctx.fillText(L('A PIXEL-ART OPEN-WORLD RPG', '像素风开放世界角色扮演'), 0, -130)
  ctx.globalAlpha = a
  ctx.font = `600 200px 'Pixelify Sans', 'Segoe UI', sans-serif`
  ctx.fillStyle = '#6b3d1f'; ctx.fillText('OpenWorld', 0, 8)
  ctx.fillStyle = '#fff8ea'; ctx.fillText('OpenWorld', 0, 0)
  ctx.globalAlpha = a * smooth((t - T.title - 1.2) / 0.5)
  ctx.font = `600 40px 'Segoe UI', system-ui, sans-serif`; ctx.fillStyle = '#ffffff'
  ctx.fillText(L('Join the waitlist', '加入等候名单'), 0, 170)
  ctx.restore()
}

// ------------------------------------------------------------------ the video

if (VIDEO) {
  document.body.classList.add('video')
  document.body.classList.remove('loading')
  const hits = [T.mapsSlam, T.peopleSlam, T.itemsSlam, T.scenesSlam]
  const pops = [...Array(LEVELS).keys()].map((l) => T.mapsSplit + l * BEAT).concat([...Array(11).keys()].map((l) => T.peopleSplit + l * BEAT)).concat([...Array(SPLITS).keys()].map((l) => T.scenesSplit + l * BAR))
  window.stage = {
    fps: FPS,
    frames: LENGTH * FPS,
    shots: [{ id: 'maps', start: 0, frames: T.people * FPS }, { id: 'people', start: T.people * FPS, frames: (T.items - T.people) * FPS }, { id: 'items', start: T.items * FPS, frames: (T.scenes - T.items) * FPS }, { id: 'scenes', start: T.scenes * FPS, frames: (T.title - T.scenes) * FPS }, { id: 'title', start: T.title * FPS, frames: (LENGTH - T.title) * FPS }],
    cues: [
      ...hits.map((at) => ({ at: at - 0.02, file: 'Sounds/Hit & Impact/Impact5.wav', vol: 0.75 })),
      ...pops.map((at, k) => ({ at, file: 'Sounds/Menu/Move1.wav', vol: 0.08 + 0.006 * (k % 11) })),
      { at: T.open - 0.25, file: 'Sounds/Hit & Impact/Hit2.wav', vol: 0.4 },
      { at: T.open, file: 'Sounds/Bonus/PowerUp1.wav', vol: 0.55 },
      ...[0.3, 0.9, 1.4, 1.8, 2.2, 2.5, 2.8, 3.1].map((d, k) => ({ at: T.open + d, file: `Sounds/Bonus/Coin${k % 3 === 0 ? '' : (k % 3) + 1}.wav`, vol: 0.3 })),
      { at: T.title, file: 'Jingles/Success1.wav', vol: 0.4 },
    ],
    music: { file: 'Musics/20 - Good Time.ogg', at: 0, from: 0, fadeOut: [LENGTH - 1.6, LENGTH] },
    ready: Promise.all([document.fonts.load("600 30px 'Pixelify Sans'"), loadClips()]),
    render: async (f) => film(f / FPS),
  }
  await window.stage.ready
  film(Number(params.get('t') ?? 3))
}

// ------------------------------------------------------------------ the page: the film, round and round

if (!VIDEO) {
  // the scenes come late in the film: their clips load while it plays
  await document.fonts.load("600 30px 'Pixelify Sans'")
  loadClips()
  document.body.classList.remove('loading')
  playLoop(film, LENGTH)
}
