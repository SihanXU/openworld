// How much there is: one thing, then two, four, … on the beat (Good Time, 120 bpm: a beat is half a second).
//   0–10 s   one map → 1,024, which fly together into the continent         (1,024 maps)
//   10–20 s  one person walks out → a crowd of 1,654                          (1,654 people)
//   20–28 s  a chest opens: things pour out faster and faster                 (40,562 items)
//   28–38 s  scenes, splitting into more and more at once, into the continent (infinite possibilities)
//   38–44 s  the name, the waitlist
// The counts are the paper's (Figure 2). A frame for any t (?export: site/video/export.mjs takes them); the page
// plays the film round and round.
import { playLoop } from '../embed.js'
import { L } from '../lang.js'
const params = new URLSearchParams(location.search)
const VIDEO = params.has('export') || params.has('video')
const W = 1920, H = 1080, FPS = 30, LENGTH = 44, BEAT = 0.5

const canvas = document.getElementById('c')
const ctx = canvas.getContext('2d')
ctx.imageSmoothingEnabled = false

const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(im); im.src = src })
const json = (src) => fetch(src).then((r) => r.json())
const [mapsInfo, peopleInfo, facesInfo, itemsInfo, continent, clipsInfo] = await Promise.all(['assets/maps.json', 'assets/people.json', 'assets/faces.json', 'assets/items.json', 'assets/continent.json', '../starmap/clips/clips.json'].map(json))
const [MAPS, PEOPLE, FACES, ITEMS, LEAD, BIG] = await Promise.all(['assets/maps.png', 'assets/people.png', 'assets/faces.png', 'assets/items.png', 'assets/lead.png', 'assets/big.jpg'].map(load))
const CLIPS = Object.entries(clipsInfo).map(([id, c]) => ({ id, ...c, frames: [] }))
async function loadClips() {
  await Promise.all(CLIPS.map(async (c) => {
    c.frames = await Promise.all(Array.from({ length: c.frames.length || clipsInfo[c.id].frames }, (_, n) => load(`../starmap/clips/${c.id}/${String(n + 1).padStart(3, '0')}.jpg`)))
  }))
}

const hash = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return ((h >>> 0) % 100000) / 100000 }
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x) }
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3)
const easeInOut = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
const easeBack = (x) => { x = clamp(x); const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }
const lerp = (a, b, x) => a + (b - a) * x

// ------------------------------------------------------------------ the pictures, by index

/** A map's square in the atlas. */
const mapAt = (k) => { const n = mapsInfo.maps.length, i = ((k % n) + n) % n; return [(i % mapsInfo.cols) * mapsInfo.size, Math.floor(i / mapsInfo.cols) * mapsInfo.size, mapsInfo.size, mapsInfo.size] }
/** The maps in the order they appear as the first one splits: the showcase places and the hand-made country first, then
 *  the open country, the rooms later. */
const ORDER = (() => {
  const shown = [], open = [], rooms = []
  // a village to begin with
  const first = Math.max(0, mapsInfo.maps.findIndex((m) => m.id === (mapsInfo.lead ?? 'meadow')))
  mapsInfo.maps.forEach((m, i) => { if (i !== first) (m.show !== undefined ? shown : m.kind === 'interior' ? rooms : open).push(i) })
  shown.sort((a, b) => mapsInfo.maps[a].show - mapsInfo.maps[b].show)
  const shuffle = (a, s) => a.map((v, k) => [hash(k * 7 + s), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1])
  // the open country twice for each room: the rooms are many, the open places are what one sees
  const o = shuffle(open, 3), r = shuffle(rooms, 5), pool = [first, ...shown]
  for (let k = 0, a = 0, b = 0; pool.length < 1024; k++) pool.push(k % 3 === 2 ? r[b++ % r.length] : o[a++ % o.length])
  // the index a tile has at the last level, by the level it first appears at (its lowest set bit): fill by appearance
  const byAppearance = Array.from({ length: 1024 }, (_, i) => i).sort((a, b) => appear(a) - appear(b) || a - b)
  const out = new Array(1024)
  byAppearance.forEach((i, k) => (out[i] = pool[k % pool.length]))
  return out
})()
function appear(i) { if (i === 0) return 0; let l = 10; while (i % 2 === 0) (i /= 2), l--; return l }

const personAt = (k, f) => { const n = peopleInfo.count, i = ((k % n) + n) % n, cw = peopleInfo.w * peopleInfo.frames; return [(i % peopleInfo.cols) * cw + f * peopleInfo.w, Math.floor(i / peopleInfo.cols) * peopleInfo.h, peopleInfo.w, peopleInfo.h] }
/** The faces shown up close: the cast's own portraits among the others. */
const FACE_PICK = (() => { const own = facesInfo.own ?? 0, out = []; for (let k = 0, a = 0, b = own; out.length < facesInfo.count; k++) out.push(k % 2 === 0 && a < own ? a++ : b++); return out })()
const faceAt = (k) => { const i = FACE_PICK[k % facesInfo.count]; return [(i % facesInfo.cols) * facesInfo.size, Math.floor(i / facesInfo.cols) * facesInfo.size, facesInfo.size, facesInfo.size] }
const itemAt = (k) => { const n = itemsInfo.keys.length, i = ((k % n) + n) % n; return [(i % itemsInfo.cols) * itemsInfo.size, Math.floor(i / itemsInfo.cols) * itemsInfo.size, itemsInfo.size, itemsInfo.size] }
const CRATE = Math.max(0, itemsInfo.keys.indexOf('item:crate'))

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
/** The continent's cells for n tiles (the most inland first), in the frame. */
const CELL = Math.min((W - 220) / continent.w, (H - 200) / continent.h)
const CX0 = (W - continent.w * CELL) / 2, CY0 = (H - continent.h * CELL) / 2 - 20
// 1,024 cells spread evenly over all the land (in reading order), the rest filled in after them
const ALL_LAND = continent.cells.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0])
const PICKED = new Set(Array.from({ length: 1024 }, (_, j) => Math.floor((j * ALL_LAND.length) / 1024)))
const LAND = ALL_LAND.filter((_, k) => PICKED.has(k))
/** The rest of the land: filled in once the 1,024 are in, so the continent is whole. */
const COAST = ALL_LAND.filter((_, k) => !PICKED.has(k))
/** Tile i of a grid of 1024 going to its cell: the grid's reading order to the continent's. */
const GRID_ORDER = (() => { const idx = Array.from({ length: 1024 }, (_, i) => i); const r = idx.map((i) => rectOf(10, i)); return idx.sort((a, b) => Math.round(r[a].y) - Math.round(r[b].y) || r[a].x - r[b].x) })()
const CELL_OF = new Array(1024)
GRID_ORDER.forEach((i, k) => (CELL_OF[i] = LAND[k]))

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

const T = { mapsSplit: 2, morph: 6.6, mapsSlam: 8, people: 10, peopleSplit: 11, peopleSlam: 18, items: 20, open: 20.5, itemsSlam: 26, scenes: 28, scenesSplit: 28.5, gather: 34.6, scenesSlam: 36, title: 38 }
const PEOPLE_N = 1654

function film(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, W, H)
  const sh = shake(t, T.mapsSlam) + shake(t, T.peopleSlam) + shake(t, T.itemsSlam) + shake(t, T.scenesSlam)
  ctx.setTransform(1, 0, 0, 1, sh, sh * 0.4)
  if (t < T.people + 0.8) drawMaps(t)
  if (t >= T.people && t < T.items + 1.2) drawPeople(t)
  if (t >= T.items - 0.2 && t < T.scenes + 0.8) drawItems(t)
  if (t >= T.scenes && t < T.title + 1.5) drawScenes(t)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (t >= T.mapsSlam && t < T.people) slam(t, T.mapsSlam, '1,024', L('maps', '张地图'), L('59 hand-made, 965 across six regions', '59 张手工制作，965 张分布在六个地区'))
  if (t >= T.peopleSlam && t < T.items) slam(t, T.peopleSlam, '1,654', L('people', '个人'), L('in 780 households, each with a look and a day of their own', '分属 780 户人家，各有自己的样子和一天的安排'))
  if (t >= T.itemsSlam && t < T.scenes) slam(t, T.itemsSlam, '40,562', L('items', '件物品'), L('of 1,013 kinds, in materials, qualities, elements', '共 1,013 种，分材质、品质和元素'))
  if (t >= T.scenesSlam && t < T.title) slam(t, T.scenesSlam, L('Infinite', '无限'), L('possibilities', '的可能性'))
  if (t >= T.title - 0.2) drawTitle(t)
  // in and out
  const black = 1 - smooth(t / 0.4) + smooth((t - (LENGTH - 0.9)) / 0.8)
  if (black > 0.01) { ctx.globalAlpha = clamp(black); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
}

function tile(src, [sx, sy, sw, sh], r, a = 1, round = 6) {
  if (r.w < 0.5 || r.h < 0.5 || a <= 0.01) return
  // the picture cut to the tile's shape (its middle kept)
  const k = Math.max(r.w / sw, r.h / sh), cw = r.w / k, ch = r.h / k
  ctx.save(); ctx.globalAlpha = a
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, Math.min(round, r.w / 4, r.h / 4)); ctx.clip()
  ctx.drawImage(src, sx + (sw - cw) / 2, sy + (sh - ch) / 2, cw, ch, r.x, r.y, r.w, r.h)
  ctx.restore()
}
const inset = (r, g) => ({ x: r.x + g, y: r.y + g, w: Math.max(0, r.w - 2 * g), h: Math.max(0, r.h - 2 * g) })
/** A map's picture in a tile: drawn large, the first map from its own whole picture and the first places it splits into
 *  from their larger squares; the rest from the atlas. */
function mapTile(id, r, a = 1, round = 6) {
  const big = mapsInfo.maps[id].show, large = Math.max(r.w, r.h) > mapsInfo.size * 1.5
  if (large && big < (mapsInfo.big?.count ?? 0) && BIG.naturalWidth) {
    const B = mapsInfo.big.size
    return tile(BIG, [(big % mapsInfo.big.cols) * B, Math.floor(big / mapsInfo.big.cols) * B, B, B], r, a, round)
  }
  if (id === ORDER[0] && LEAD.naturalWidth && large) {
    // the atlas's square is the middle of the map: the lead's picture is cut the same way once the tile is square
    const s = Math.min(LEAD.naturalWidth, LEAD.naturalHeight)
    const k = clamp((Math.max(r.w, r.h) / Math.min(r.w, r.h) - 1) / 0.5)
    const cw = lerp(s, LEAD.naturalWidth, k)
    return tile(LEAD, [(LEAD.naturalWidth - cw) / 2, (LEAD.naturalHeight - s) / 2, cw, s], r, a, round)
  }
  tile(MAPS, mapAt(id), r, a, round)
}

/** How far the camera has fallen into the first village (0 to 1). */
const fallen = (t) => (t > T.people ? easeInOut((t - T.people) / 0.6) : 0)
/** The camera falling into the first village as the people begin: about it, it coming to the middle as it grows. */
function fall(r, t) {
  const z = fallen(t)
  if (z <= 0) return r
  const fx = CX0 + CELL_OF[0][0] * CELL + CELL / 2, fy = CY0 + CELL_OF[0][1] * CELL + CELL / 2
  const sc = lerp(1, (W / CELL) * 1.2, z), px = lerp(fx, W / 2, z), py = lerp(fy, H / 2, z)
  return { x: px + (r.x - fx) * sc, y: py + (r.y - fy) * sc, w: r.w * sc, h: r.h * sc }
}

function drawMaps(t) {
  // the first map comes up out of the dark
  const pop = easeBack((t - 0.25) / 0.5)
  for (let i = 0; i < 1024; i++) {
    if (t < T.mapsSplit && i > 0) break
    const s = splitting(t, T.mapsSplit, 10, i)
    // only the tiles that exist at this level (one in 2^(10-level))
    if (i % (1 << (10 - s.level)) !== 0) continue
    const id = ORDER[i]
    let r = s.r
    if (s.level === 0) { const k = pop * 0.62; r = { x: W / 2 - (FRAME.w * k) / 2, y: H / 2 - (FRAME.h * k) / 2, w: FRAME.w * k, h: FRAME.h * k } }
    // into the continent
    const fly = t > T.morph ? easeInOut((t - T.morph - 0.7 * hash(i) * 0.7) / 0.9) : 0
    if (fly > 0) { const [cx, cy] = CELL_OF[i]; const to = { x: CX0 + cx * CELL, y: CY0 + cy * CELL, w: CELL, h: CELL }; r = { x: lerp(r.x, to.x, fly), y: lerp(r.y, to.y, fly), w: lerp(r.w, to.w, fly), h: lerp(r.h, to.h, fly) } }
    // as the people begin, the camera falls into the first village
    if (t > T.people) r = fall(r, t)
    const g = Math.min(4, r.w * 0.04)
    // the others, blown up round it as the camera falls, give way to the first village
    mapTile(id, inset(r, g), i === 0 ? 1 : 1 - fallen(t), s.level < 4 ? 14 : 4)
  }
  // the coasts come in round them, and the continent has its shape
  if (t > T.morph + 1.0 && t < T.people + 0.8) {
    COAST.forEach(([cx, cy], k) => {
      const a = smooth((t - (T.morph + 1.0) - hash(k * 3) * 0.6) / 0.3)
      if (a <= 0.01) return
      const r = fall({ x: CX0 + cx * CELL, y: CY0 + cy * CELL, w: CELL, h: CELL }, t)
      tile(MAPS, mapAt(ORDER[(k * 7) % 1024]), inset(r, Math.min(4, r.w * 0.04)), a * (1 - fallen(t)), 4)
    })
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
  for (let i = 0; i < n; i++) {
    const at = level === 0 ? { x: W / 2, y: H / 2 + 60, s: 9 * first } : crowdCell(n, i)
    let p = at
    if (level > 0 && u < 1) { const from = i < prev ? crowdCell(prev, i) : crowdCell(prev, i >> 1); p = { x: lerp(from.x, at.x, u), y: lerp(from.y, at.y, u), s: lerp(level === 1 ? 9 : from.s, at.s, u) } }
    if (level === 1 && u < 1 && i === 0) p = { x: lerp(W / 2, at.x, u), y: lerp(H / 2 + 60, at.y, u), s: lerp(9, at.s, u) }
    // walking in place toward us, each in their own step
    const f = Math.floor(t * 8 + hash(i) * 4) % 4
    const [sx, sy, sw, shh] = personAt(Math.floor(hash(i * 3 + 1) * PEOPLE_N), f)
    const dx = Math.sin(t * 2 + i) * 0, w = sw * p.s, h = shh * p.s
    // they part and go as the chest comes
    const go = away * (0.6 + 0.8 * hash(i * 11))
    const ox = (p.x - W / 2) * go * 1.6, oy = (p.y - H / 2) * go * 1.6
    ctx.globalAlpha = 1 - away
    ctx.drawImage(PEOPLE, sx, sy, sw, shh, p.x - w / 2 + dx + ox, p.y - h / 2 + oy, w, h)
  }
  ctx.globalAlpha = 1
  // faces: some of them, up close, a moment each
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
    ctx.save(); ctx.translate(x, y); ctx.rotate(p.w * k)
    ctx.drawImage(ITEMS, ...itemAt(p.icon), -12 * s, -12 * s, 24 * s, 24 * s)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

function drawScenes(t) {
  const level = clamp(Math.floor((t - T.scenesSplit) / BEAT) + 1, 0, 9)
  const intoTitle = smooth((t - T.title) / 1.2)
  for (let i = 0; i < 512; i++) {
    const s = splitting(t, T.scenesSplit, 9, i)
    if (i % (1 << (9 - s.level)) !== 0) continue
    let r = s.r
    if (level === 0) { const k = easeBack((t - T.scenes) / 0.4); r = { x: W / 2 - (FRAME.w * k) / 2, y: H / 2 - (FRAME.h * k) / 2, w: FRAME.w * k, h: FRAME.h * k } }
    // into the continent
    const gather = t > T.gather ? easeInOut((t - T.gather - hash(i) * 0.5) / 1.0) : 0
    if (gather > 0) { const [cx, cy] = LAND[Math.floor(hash(i * 7 + 3) * 1024)]; const to = { x: CX0 + cx * CELL, y: CY0 + cy * CELL, w: CELL * 1.6, h: CELL * 1.6 }; r = { x: lerp(r.x, to.x, gather), y: lerp(r.y, to.y, gather), w: lerp(r.w, to.w, gather), h: lerp(r.h, to.h, gather) } }
    const c = CLIPS[Math.floor(hash(i * 5 + 1) * CLIPS.length)]
    const frames = c.frames
    if (!frames?.length) continue
    const f = frames[Math.floor((t - T.scenes) * FPS + hash(i * 9) * frames.length) % frames.length]
    // each its own part of its scene
    const z = 1 + 0.6 * hash(i * 13), fw = f.naturalWidth / z, fh = f.naturalHeight / z
    const fx = (f.naturalWidth - fw) * hash(i * 17), fy = (f.naturalHeight - fh) * hash(i * 19)
    const g = Math.min(4, r.w * 0.03)
    tile(f, [fx, fy, fw, fh], inset(r, g), 1 - intoTitle * 0.7, level < 4 ? 14 : 4)
  }
  // when it is all in: the continent, every place in it lit
  if (t > T.gather + 1.2) {
    const a = smooth((t - (T.gather + 1.2)) / 0.8) * (1 - intoTitle * 0.75)
    for (let k = 0; k < continent.cells.length; k++) {
      const [cx, cy] = continent.cells[k], tw = 0.5 + 0.5 * Math.sin(t * 5 + k)
      ctx.globalAlpha = a * (0.35 + 0.4 * tw); ctx.drawImage(MAPS, ...mapAt(ORDER[k]), CX0 + cx * CELL, CY0 + cy * CELL, CELL - 1, CELL - 1)
    }
    ctx.globalAlpha = 1
  }
}

function drawTitle(t) {
  const a = smooth((t - T.title) / 0.6)
  const s = 1 + 0.08 * (1 - easeOut((t - T.title) / 0.8))
  ctx.save()
  ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = a
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
  const pops = [...Array(10).keys()].map((l) => T.mapsSplit + l * BEAT).concat([...Array(11).keys()].map((l) => T.peopleSplit + l * BEAT)).concat([...Array(9).keys()].map((l) => T.scenesSplit + l * BEAT))
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
