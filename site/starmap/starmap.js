// The star map: what grows from a few rules. One world, one camera going back from a single moment to everything.
//   Act 1 (0–16 s): events of a stormy day at the Ford, acted on the game's stage (clips/), each opening out of its
//     star and closing back into it; the first full screen and large, the rest faster, smaller, several at once.
//   Act 2 (16–28 s): from those stars, along what really joins things in the world (graph.json), star after star
//     lights from one already lit, faster and faster, while the camera goes back.
//   Act 3 (28–40 s): the whole world, turning slowly; its regions and its counts.
// The same drawing is the page you can explore (?export: the video, a frame for any t; site/video/export.mjs).
import { EVENTS, OPENING } from './story.js'

import { EMBED, playLoop } from '../embed.js'
import { L, LANG } from '../lang.js'
const params = new URLSearchParams(location.search)
const VIDEO = params.has('export') || params.has('video')
const FPS = 30
const LENGTH = 40
const ACT2 = 16.5, ACT3 = 28

// ------------------------------------------------------------------ the world's stars

const g = await fetch('graph.json').then((r) => r.json())
const clipsInfo = await fetch('clips/clips.json').then((r) => r.json())
const N = g.nodes.length
const X = new Float32Array(N), Y = new Float32Array(N), KIND = new Uint8Array(N), REGION = new Int8Array(N)
const ID = [], LABEL = []
const index = new Map()
g.nodes.forEach(([id, k, label, x, y, r], i) => { X[i] = x; Y[i] = y; KIND[i] = k; REGION[i] = r; ID.push(id); LABEL.push(label); index.set(id, i) })
const KINDS = g.kinds
const K = Object.fromEntries(KINDS.map((k, i) => [k, i]))
const adj = Array.from({ length: N }, () => [])
const deg = new Uint16Array(N)
for (const [a, b] of g.edges) (adj[a].push(b), adj[b].push(a), deg[a]++, deg[b]++)
const UNDRAWN = new Set(['likes', 'sells'].map((k) => g.linkKinds.indexOf(k)))
const DRAWN = g.edges.filter(([a, b, k]) => !UNDRAWN.has(k) && KIND[a] !== K.region && KIND[b] !== K.region && KIND[a] !== K.event && KIND[b] !== K.event)

const KIND_COLOR = { region: '#ffffff', place: '#9cc4dc', person: '#f4e3c1', kind: '#8fb2ff', rule: '#5b8cff', status: '#5fd3c0', quest: '#f2c45a', event: '#e6eeff' }
const SIZE = { region: 26, place: 8, person: 3.4, kind: 4.2, rule: 7, status: 5, quest: 7, event: 6 }
const COLOR = Array.from({ length: N }, (_, i) => (KIND[i] === K.place && REGION[i] >= 0 ? g.regions[REGION[i]].color : KIND_COLOR[KINDS[KIND[i]]]))
const RAD = Float32Array.from({ length: N }, (_, i) => SIZE[KINDS[KIND[i]]] * (KIND[i] === K.place ? 0.8 + Math.min(1.2, deg[i] / 40) : 1) * (KIND[i] === K.kind || KIND[i] === K.rule ? 0.8 + Math.min(1.5, deg[i] / 30) : 1))
const AMBER = '#f0a040', ICE = '#cfe0ff'

const glows = new Map()
function glow(color) {
  if (glows.has(color)) return glows.get(color)
  const c = document.createElement('canvas'); c.width = c.height = 64
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.12, color); gr.addColorStop(0.35, color + '55'); gr.addColorStop(1, color + '00')
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64)
  glows.set(color, c)
  return c
}
const hash = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return (h % 10000) / 10000 }
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x) }
const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
const easeIn = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * x }
const easeBack = (x) => { x = Math.max(0, Math.min(1, x)); const c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }

// ------------------------------------------------------------------ the opening: events, their clips, their sparks

const OPEN = Object.fromEntries(OPENING.map((o) => [o.id, { ...o, i: index.get(`event:${o.id}`), model: !!EVENTS[o.id].model }]))
const R_OF = { full: 1200, big: 270, mid: 120, flash: 54 }
const SPARK = 0.5
const clipFrames = {}
const pics = {}
async function loadClips(ids) {
  await Promise.all(ids.map((id) => {
    const info = clipsInfo[id]
    if (!info || clipFrames[id]) return
    clipFrames[id] = Array.from({ length: info.frames }, (_, n) => { const im = new Image(); im.src = `clips/${id}/${String(n + 1).padStart(3, '0')}.jpg`; return im })
    return Promise.all(clipFrames[id].map((im) => im.decode().catch(() => {})))
  }))
}
await Promise.all(Object.values(EVENTS).map((e) => new Promise((res) => { const im = new Image(); im.onload = res; im.onerror = res; im.src = `ev/${e.pic}.png`; pics[e.pic] = im })))

/** How open an event's circle is at t (0: a point; 1: its full size), and whether it has opened yet. */
function iris(o, t) {
  if (t < o.open) return 0
  if (o.size === 'full') return t < o.close - 0.6 ? 1 : 1 - easeIn((t - (o.close - 0.6)) / 0.6)
  const k = easeBack((t - o.open) / 0.35)
  return t < o.close - 0.4 ? k : k * (1 - easeIn((t - (o.close - 0.4)) / 0.4))
}

// ------------------------------------------------------------------ act 2: the world lights from the events, layer by layer

// A star lights when a spark from a lit neighbour reaches it. Sparks cross real distance, and they go faster and
// faster: near stars first, far ones later, a front that spreads outward and speeds up (Dijkstra by arrival time).
const V0 = 110, TAU = 3.4 // world units a second at the start of act 2; how fast that speed grows
const speed = (t) => V0 * Math.exp(Math.max(0, t - ACT2) / TAU)
const LIGHT = new Float32Array(N).fill(1e9), PARENT = new Int32Array(N).fill(-1), TRAVEL = new Float32Array(N)
{
  const heap = [] // [time, node], a binary heap by time
  const push = (t, i) => { heap.push([t, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p } }
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m } } return top }
  for (const o of Object.values(OPEN)) { LIGHT[o.i] = o.close; push(o.close, o.i) }
  const done = new Uint8Array(N)
  while (heap.length) {
    const [t, a] = pop()
    if (done[a]) continue
    done[a] = 1
    const from = Math.max(t, ACT2 - 0.4)
    for (const b of adj[a]) {
      if (done[b]) continue
      const d = Math.hypot(X[b] - X[a], Y[b] - Y[a])
      const travel = d / speed(from) + 0.08 + 0.12 * hash(b)
      if (from + travel < LIGHT[b]) { LIGHT[b] = from + travel; PARENT[b] = a; TRAVEL[b] = travel; push(LIGHT[b], b) }
    }
  }
  for (let i = 0; i < N; i++) if (LIGHT[i] > 1e8) LIGHT[i] = ACT3 - 1 + hash(i) * 1.5
}
/** How far from the story the lit stars reach by t (most of them: the 85th part in a hundred), sampled every tenth
 *  of a second and never shrinking: what the camera keeps in view. */
const LIT_REACH = (() => {
  const cx0 = OPENING.reduce((s, o) => s + X[index.get(`event:${o.id}`)], 0) / OPENING.length
  const cy0 = OPENING.reduce((s, o) => s + Y[index.get(`event:${o.id}`)], 0) / OPENING.length
  const byTime = [...Array(N).keys()].sort((a, b) => LIGHT[a] - LIGHT[b])
  const out = [], dists = []
  let k = 0, best = 0, sx = 0, sy = 0
  for (let t = ACT2; t <= ACT3 + 0.05; t += 0.1) {
    while (k < N && LIGHT[byTime[k]] <= t) { const i = byTime[k++]; dists.push(Math.hypot(X[i] - cx0, Y[i] - cy0)); sx += X[i]; sy += Y[i] }
    const sorted = dists.slice().sort((a, b) => a - b)
    best = Math.max(best, sorted[Math.floor(sorted.length * 0.85)] ?? 0)
    // where the lit stars are, on the whole (their middle)
    out.push([best, k ? sx / k : cx0, k ? sy / k : cy0])
  }
  return out
})()
/** [reach, middle x, middle y] of what is lit at t, eased over the half second around it. */
const litView = (t) => {
  const at = (u) => LIT_REACH[Math.max(0, Math.min(LIT_REACH.length - 1, Math.round((u - ACT2) / 0.1)))]
  let r = 0, x = 0, y = 0, n = 0
  for (let d = -0.5; d <= 0.5; d += 0.1) { const v = at(t + d); r += v[0]; x += v[1]; y += v[2]; n++ }
  return [r / n, x / n, y / n]
}

// ------------------------------------------------------------------ the camera

let W = 1920, H = 1080
const pos = (id) => { const i = OPEN[id].i; return [X[i], Y[i]] }
const storyBox = (() => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const o of Object.values(OPEN)) (x0 = Math.min(x0, X[o.i])), (x1 = Math.max(x1, X[o.i])), (y0 = Math.min(y0, Y[o.i])), (y1 = Math.max(y1, Y[o.i]))
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 }
})()
const WORLD_VIEW = (() => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < N; i++) (x0 = Math.min(x0, X[i])), (x1 = Math.max(x1, X[i])), (y0 = Math.min(y0, Y[i])), (y1 = Math.max(y1, Y[i]))
  const w = Math.max(x1 - x0, (y1 - y0) * (W / H)) * 1.04
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, zoom: W / w }
})()
const STORY_END_ZOOM = Math.min(W / (storyBox.w * 2.4), H / (storyBox.h * 2.4))
// where the camera is at moments of act 1 (centre, zoom), eased between
// each close enough that the spark to the next event stays on screen: the camera goes back a little at each
const dist = (a, b) => Math.hypot(pos(a)[0] - pos(b)[0], pos(a)[1] - pos(b)[1])
const fitting = (...pairs) => (0.42 * W) / Math.max(...pairs.map(([a, b]) => dist(a, b)))
const Z = { tree: fitting(['tree', 'camp']), camp: fitting(['tree', 'camp'], ['camp', 'theft']), theft: fitting(['theft', 'hesper']), hesper: fitting(['camp', 'hesper'], ['theft', 'hesper']) }
const KEYS = [
  [0, ...pos('tree'), Z.tree * 1.15], [3.55, ...pos('tree'), Z.tree],
  [4.1, ...pos('camp'), Z.camp], [6.7, ...pos('camp'), Z.camp * 0.95],
  [7.1, ...pos('theft'), Z.theft], [9.8, ...pos('theft'), Z.theft * 0.95],
  [10.3, ...pos('hesper'), Z.hesper], [11.4, ...pos('hesper'), Z.hesper * 0.9],
  [13.6, storyBox.cx, storyBox.cy, Math.max(STORY_END_ZOOM, Z.hesper * 0.7)], [ACT2, storyBox.cx, storyBox.cy, STORY_END_ZOOM],
]
function camera(t) {
  if (t <= ACT2) {
    let k = 0
    while (k < KEYS.length - 2 && t > KEYS[k + 1][0]) k++
    const [t0, x0, y0, z0] = KEYS[k], [t1, x1, y1, z1] = KEYS[k + 1]
    const u = ease((t - t0) / (t1 - t0))
    return { cx: x0 + (x1 - x0) * u, cy: y0 + (y1 - y0) * u, zoom: Math.exp(Math.log(z0) + (Math.log(z1) - Math.log(z0)) * u), rot: 0 }
  }
  // back as far as the front has spread, what is lit kept in the middle of the frame: the camera only leaves the
  // story for the whole world's middle as the light reaches out to it
  const b = WORLD_VIEW, [f, mx, my] = litView(Math.min(t, ACT3) + 0.3)
  const R0 = (0.42 * H) / STORY_END_ZOOM
  const zoom = Math.max(b.zoom, Math.min(STORY_END_ZOOM, (0.42 * H) / Math.max(R0, f)))
  // from the story's middle to the middle of what is lit, and in the end to the whole's
  const q = smooth((t - ACT2) / 1.5), w = smooth((t - (ACT3 - 2.5)) / 2.5)
  const cx = storyBox.cx + (mx - storyBox.cx) * q, cy = storyBox.cy + (my - storyBox.cy) * q
  const after = Math.max(0, t - ACT3)
  return { cx: cx + (b.cx - cx) * w, cy: cy + (b.cy - cy) * w, zoom: zoom * (1 + 0.01 * after), rot: -0.005 * after }
}

// ------------------------------------------------------------------ the ending: the counts, then the line

const COUNTS_IN = ACT3 + 1.0, COUNTS_OUT = ACT3 + 5.2, LINE_IN = ACT3 + 6.4
/** The last words (the user's 无限的可能性). */
/** The regions' names in Chinese (games/openworld/content regions.ts). */
const REGION_ZH = { frostfang: '霜牙海岸', redmarch: '赤痕边境', tithe: '衡谷平原', palefen: '苍白林沼', altar: '白坛高地', holy: '圣城' }
const LAST_LINE = L('Infinite possibilities', '无限的可能性')
// new stars lighting all round the world as the line comes: more and more often, a few of them amber
const BIRTHS = (() => {
  const out = [], n = 220
  const w = (WORLD_VIEW.zoom ? W / WORLD_VIEW.zoom : 6000) * 1.05, h = w * (H / W)
  for (let k = 0; k < n; k++) {
    const bt = COUNTS_OUT - 0.2 + 6 * Math.pow(k / n, 0.55)
    const bx = WORLD_VIEW.cx + (hash(k * 5 + 11) - 0.5) * w, by = WORLD_VIEW.cy + (hash(k * 9 + 3) - 0.5) * h
    out.push([bt, bx, by, hash(k * 13 + 7) < 0.3])
  }
  return out
})()

// ------------------------------------------------------------------ drawing

const canvas = document.getElementById('c')
const ctx = canvas.getContext('2d')
const DUST = Array.from({ length: 300 }, (_, k) => [hash(k * 13 + 1), hash(k * 31 + 5), 0.1 + 0.3 * hash(k * 17 + 2), 0.5 + hash(k * 7)])

/**
 * One frame. `t`: the film's time; `ex`: the explorer's state (every star lit; hover, ripples, events as small
 * looping circles) instead of the film's.
 */
function draw(t, view, ex) {
  const { cx, cy, zoom, rot = 0 } = view
  const dpr = canvas.width / W
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1
  ctx.fillStyle = '#04060b'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  const cos = Math.cos(rot), sin = Math.sin(rot)
  const sx = (x, y) => (W / 2 + (x - cx) * zoom * cos - (y - cy) * zoom * sin) * dpr
  const sy = (x, y) => (H / 2 + (x - cx) * zoom * sin + (y - cy) * zoom * cos) * dpr
  const film = !ex
  const lit = (i) => (film ? smooth((t - LIGHT[i]) / 0.35) : 1)

  // the sky's dust, drifting a little with the camera
  ctx.globalCompositeOperation = 'lighter'
  for (const [u, v, a, depth] of DUST) {
    const x = (((u * W - cx * zoom * 0.02 * depth) % W) + W) % W, y = (((v * H - cy * zoom * 0.02 * depth) % H) + H) % H
    ctx.globalAlpha = a; ctx.fillStyle = '#aabfff'; ctx.fillRect(x * dpr, y * dpr, 1.3 * dpr, 1.3 * dpr)
  }

  // the world's links: faint where both ends are lit
  if (!film || t > ACT2 - 1) {
    ctx.strokeStyle = '#7d9ae6'; ctx.lineWidth = 0.8 * dpr
    ctx.globalAlpha = 0.07
    ctx.beginPath()
    for (const [a, b] of DRAWN) {
      if (film && (t < LIGHT[a] + 0.5 || t < LIGHT[b] + 0.5)) continue
      ctx.moveTo(sx(X[a], Y[a]), sy(X[a], Y[a])); ctx.lineTo(sx(X[b], Y[b]), sy(X[b], Y[b]))
    }
    ctx.stroke()
    // how each star was lit: a thread from the one that lit it, and while it travels, a spark
    if (film) {
      ctx.lineWidth = 1.1 * dpr
      for (let i = 0; i < N; i++) {
        const p = PARENT[i]
        if (p < 0 || KIND[i] === K.event || KIND[i] === K.region || KIND[p] === K.region) continue
        const t0 = LIGHT[i] - TRAVEL[i]
        if (t < t0) continue
        const u = Math.min(1, (t - t0) / TRAVEL[i])
        const ax = sx(X[p], Y[p]), ay = sy(X[p], Y[p]), bx = sx(X[i], Y[i]), by = sy(X[i], Y[i])
        const hx = ax + (bx - ax) * u, hy = ay + (by - ay) * u
        const fresh = Math.exp(-Math.max(0, t - LIGHT[i]) * 1.5)
        ctx.globalAlpha = 0.06 + 0.4 * fresh
        ctx.strokeStyle = '#a9c2ff'
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, hy); ctx.stroke()
        if (u < 1) { const r = 5 * dpr; ctx.globalAlpha = 0.9; ctx.drawImage(glow(ICE), hx - r, hy - r, r * 2, r * 2) }
      }
    }
  }

  // the world's stars
  const hl = ex?.highlight
  for (let i = 0; i < N; i++) {
    if (KIND[i] === K.event) continue
    const l = lit(i)
    if (l <= 0.01) continue
    const x = sx(X[i], Y[i]), y = sy(X[i], Y[i])
    if (x < -40 || y < -40 || x > canvas.width + 40 || y > canvas.height + 40) continue
    const flash = film && t > LIGHT[i] ? Math.exp(-(t - LIGHT[i]) * 2.5) : 0
    const h = hl?.has(i) ? 1 : 0
    const r = Math.max(1.1 * dpr, Math.min((KIND[i] === K.region ? 9 : 5) * dpr, RAD[i] * zoom * dpr)) * (1 + flash * 1.2 + h * 0.6) * (0.5 + 0.5 * l)
    ctx.globalAlpha = Math.min(1, l * (hl && !h ? 0.35 : 1))
    ctx.drawImage(glow(COLOR[i]), x - r * 2.5, y - r * 2.5, r * 5, r * 5)
  }
  // a clicked star's ripple
  for (const rp of ex?.ripples ?? []) {
    const front = (ex.now - rp.t0) / 380
    for (const [j, d] of rp.reach) {
      const k = front - d
      if (k < 0 || k > 2.2) continue
      const x = sx(X[j], Y[j]), y = sy(X[j], Y[j]), r = (2 + 5 * Math.max(0, 1 - k)) * dpr * (d === 0 ? 2 : 1)
      ctx.globalAlpha = Math.max(0, 1 - k / 2.2) * 0.55
      ctx.drawImage(glow(d === 0 ? '#ffffff' : '#9fd0ff'), x - r * 2, y - r * 2, r * 4, r * 4)
    }
  }

  // ------------------------------------------------ the events
  // the sparks between them, and the threads they leave
  for (const o of Object.values(OPEN)) {
    if (!o.from) continue
    const f = OPEN[o.from], t0 = o.open - SPARK
    if (film && t < t0) continue
    const u = film ? Math.min(1, (t - t0) / SPARK) : 1
    const ax = sx(X[f.i], Y[f.i]), ay = sy(X[f.i], Y[f.i]), bx = sx(X[o.i], Y[o.i]), by = sy(X[o.i], Y[o.i])
    // a slight bend, the same side for each pair
    const mx = (ax + bx) / 2 - (by - ay) * 0.12, my = (ay + by) / 2 + (bx - ax) * 0.12
    const pt = (s) => [(1 - s) * (1 - s) * ax + 2 * (1 - s) * s * mx + s * s * bx, (1 - s) * (1 - s) * ay + 2 * (1 - s) * s * my + s * s * by]
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = film ? 0.55 * (1 - 0.6 * smooth((t - ACT2) / 6)) : 0.35
    ctx.strokeStyle = o.model ? '#f3b664' : '#bcd0ff'; ctx.lineWidth = 1.6 * dpr
    ctx.beginPath()
    for (let s = 0; s <= u + 1e-6; s += 0.04) { const [x, y] = pt(Math.min(s, u)); s ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }
    ctx.stroke()
    if (u < 1) { const [x, y] = pt(u), r = 10 * dpr; ctx.globalAlpha = 1; ctx.drawImage(glow(o.model ? AMBER : ICE), x - r, y - r, r * 2, r * 2) }
  }
  ctx.globalCompositeOperation = 'source-over'
  // each event: a circle with its moment in it, or the point it closed into
  const order = Object.values(OPEN).sort((a, b) => (a.size === 'full') - (b.size === 'full'))
  for (const o of order) {
    const x = sx(X[o.i], Y[o.i]), y = sy(X[o.i], Y[o.i])
    const ring = o.model ? AMBER : ICE
    if (ex) { drawSmall(o, x, y, dpr, ex); continue }
    if (t < o.open) continue
    const k = iris(o, t)
    const R = R_OF[o.size] * k * dpr
    // the point: after it closes (and under it while it opens), with a flash as it lights
    const pointA = smooth((t - (o.close - 0.15)) / 0.2)
    const arrive = Math.exp(-Math.max(0, t - o.open) * 4) + Math.exp(-Math.max(0, t - o.close) * 3) * (t > o.close - 0.1 ? 1 : 0)
    if (pointA > 0.01 || arrive > 0.02) {
      // after the opening the events are stars among the others: smaller, quieter
      const later = film && t > ACT2 ? Math.exp(-(t - ACT2) / 2) : 1
      const r = (6 + 18 * arrive) * dpr * (0.45 + 0.55 * later)
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.max(pointA, arrive) * (0.55 + 0.45 * later)
      ctx.drawImage(glow(ring), x - r * 2, y - r * 2, r * 4, r * 4)
      ctx.globalCompositeOperation = 'source-over'
    }
    if (R < 1) continue
    // the moment itself
    ctx.globalAlpha = 1
    ctx.save()
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip()
    const frames = o.clip && clipFrames[o.clip]
    if (frames) {
      const im = frames[Math.max(0, Math.min(frames.length - 1, Math.floor((t - o.open) * FPS)))]
      if (o.size === 'full') drawCover(im, 0, 0, canvas.width, canvas.height)
      else drawCover(im, x - R, y - R, R * 2, R * 2)
    } else {
      const e = EVENTS[o.id], im = pics[e.pic], [px, py, ps] = e.c
      const z = 1 + 0.15 * smooth((t - o.open) / (o.close - o.open))
      ctx.imageSmoothingEnabled = false
      if (im?.width) ctx.drawImage(im, px - ps / 2 / z, py - ps / 2 / z, ps / z, ps / z, x - R, y - R, R * 2, R * 2)
      ctx.imageSmoothingEnabled = true
    }
    ctx.restore()
    if (o.size !== 'full' || k < 1) {
      ctx.globalAlpha = 1; ctx.strokeStyle = ring; ctx.lineWidth = Math.max(2, R * 0.025)
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke()
    }
    // its words (the figure's), under it
    if (o.words) {
      const a = smooth((t - o.open - 0.5) / 0.4) * (1 - smooth((t - (o.close - 0.7)) / 0.3))
      if (a > 0.01) {
        const text = L(EVENTS[o.id].text, EVENTS[o.id].zh).split('\n').join(LANG === 'zh' ? '' : ' ')
        ctx.globalAlpha = a
        ctx.font = `500 ${34 * dpr}px 'Segoe UI', system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
        const ty = o.size === 'full' ? canvas.height - 120 * dpr : y + R + 26 * dpr
        ctx.fillStyle = 'rgba(0,0,0,0.45)'
        const w = ctx.measureText(text).width
        ctx.beginPath(); ctx.roundRect(x - w / 2 - 18 * dpr, ty - 10 * dpr, w + 36 * dpr, 56 * dpr, 28 * dpr); ctx.fill()
        ctx.fillStyle = '#f2f5fb'; ctx.fillText(text, x, ty)
      }
    }
    // the model's answer, beside the one it was asked about
    if (o.card) drawCard(o, x + R + 40 * dpr, y, t, dpr)
  }

  // ------------------------------------------------ the whole
  // in the explorer, the regions' names when the whole is in view
  if (!film && zoom < 0.6) {
    const nf = Math.max(10, Math.min(24, W / 70))
    ctx.font = `600 ${nf * dpr}px 'Segoe UI', system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (const r of g.regions) {
      const i = index.get(`region:${r.id}`)
      if (i === undefined) continue
      ctx.globalAlpha = 0.85; ctx.fillStyle = r.color
      ctx.fillText(LANG === 'zh' ? REGION_ZH[r.id] ?? r.name : r.name.toUpperCase(), sx(X[i], Y[i]), sy(X[i], Y[i]) - nf * 1.4 * dpr)
    }
  }
  if (film) {
    // stars still coming: new ones lighting all round the world, more and more
    for (let k = 0; k < BIRTHS.length; k++) {
      const [bt, bx, by, amber] = BIRTHS[k]
      if (t < bt) break
      const x = sx(bx, by), y = sy(bx, by), age = t - bt
      const r = (3 + 16 * Math.exp(-age * 2.2)) * dpr
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, age * 4)
      ctx.drawImage(glow(amber ? AMBER : '#e6eeff'), x - r * 2.5, y - r * 2.5, r * 5, r * 5)
      ctx.globalCompositeOperation = 'source-over'
    }
    // the counts, in the middle, counted up; then gone
    const shown = smooth((t - COUNTS_IN) / 0.6) * (1 - smooth((t - COUNTS_OUT) / 0.7))
    const hush = smooth((t - (COUNTS_IN - 0.3)) / 0.8) * (1 - smooth((t - (COUNTS_OUT + 0.4)) / 0.8)) * 0.5
    if (hush > 0.01) { ctx.globalAlpha = hush; ctx.fillStyle = '#04060b'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
    if (shown > 0.01) {
      // the paper's counts (Figure 2), not the graph's own: the same numbers wherever they are shown
      const rows = [['place', L('places', '个地方'), 1024], ['person', L('people', '个人'), 1654], ['kind', L('kinds of things', '种东西'), 1399]]
      const nf = 66 * dpr, wf = 40 * dpr, gap = 92 * dpr
      ctx.textBaseline = 'middle'
      const width = (n, word) => { ctx.font = `700 ${nf}px 'Segoe UI', system-ui, sans-serif`; const a = ctx.measureText(n).width; ctx.font = `400 ${wf}px 'Segoe UI', system-ui, sans-serif`; return a + 22 * dpr + ctx.measureText(word).width }
      const block = Math.max(...rows.map(([, word, n]) => width(n.toLocaleString('en'), word))) + 52 * dpr
      const left = canvas.width / 2 - block / 2
      rows.forEach(([k, word, count], n) => {
        const y = canvas.height / 2 + (n - (rows.length - 1) / 2) * gap
        const t0 = COUNTS_IN + n * 0.3
        const a = shown * smooth((t - t0) / 0.5)
        if (a <= 0.01) return
        const value = Math.round(count * (1 - Math.pow(1 - Math.max(0, Math.min(1, (t - t0) / 1.4)), 3)))
        ctx.globalAlpha = a
        ctx.drawImage(glow(KIND_COLOR[k]), left - 6 * dpr, y - 26 * dpr, 52 * dpr, 52 * dpr)
        ctx.textAlign = 'left'
        ctx.font = `700 ${nf}px 'Segoe UI', system-ui, sans-serif`; ctx.fillStyle = '#ffffff'
        const num = value.toLocaleString('en')
        // the figures stay put as they count (the width of the final number)
        ctx.fillText(num, left + 52 * dpr, y)
        const nw = ctx.measureText(count.toLocaleString('en')).width
        ctx.font = `400 ${wf}px 'Segoe UI', system-ui, sans-serif`; ctx.fillStyle = '#c9d4ea'
        ctx.fillText(word, left + 52 * dpr + nw + 22 * dpr, y + 4 * dpr)
      })
    }
    // and then what it is all for
    const line = smooth((t - LINE_IN) / 1.0)
    if (line > 0.01) {
      // a little dark behind the words, so they read over the bright middle
      const gr = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, 520 * dpr)
      gr.addColorStop(0, 'rgba(4,6,11,0.6)'); gr.addColorStop(1, 'rgba(4,6,11,0)')
      ctx.globalAlpha = line; ctx.fillStyle = gr; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = line
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = `600 ${92 * dpr}px 'Segoe UI', system-ui, sans-serif`
      ctx.shadowColor = 'rgba(160,190,255,0.55)'; ctx.shadowBlur = 30 * dpr
      ctx.fillStyle = '#ffffff'
      ctx.fillText(LAST_LINE, canvas.width / 2, canvas.height / 2)
      ctx.shadowBlur = 0
    }
    const fade = smooth((t - (LENGTH - 1.4)) / 1.3)
    if (fade > 0) { ctx.globalAlpha = fade; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
  }
  ctx.globalAlpha = 1
}

/** A picture filling a box, cut to its shape (the middle kept). */
function drawCover(im, x, y, w, h) {
  if (!im?.naturalWidth) return
  const s = Math.max(w / im.naturalWidth, h / im.naturalHeight), sw = w / s, sh = h / s
  ctx.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, w, h)
}

/** The model's rule, typed beside the event that asked for it, then stamped (the figure's code). */
function drawCard(o, x, y, t, dpr) {
  const code = EVENTS[o.id].model
  const a = smooth((t - o.open - 0.5) / 0.3) * (1 - smooth((t - (o.close - 0.6)) / 0.3))
  if (a <= 0.01) return
  const typed = Math.max(0, Math.min(1, (t - o.open - 0.7) / 1.2))
  const all = code.join('\n'), shown = all.slice(0, Math.floor(all.length * typed)).split('\n')
  const f = 30 * dpr
  ctx.font = `500 ${f}px Consolas, 'Cascadia Code', monospace`
  const w = Math.max(...code.map((l) => ctx.measureText(l).width)) + f * 2.6, h = code.length * f * 1.4 + f * 1.4
  ctx.globalAlpha = a
  ctx.fillStyle = 'rgba(40,24,6,0.94)'; ctx.strokeStyle = AMBER; ctx.lineWidth = 2 * dpr
  ctx.beginPath(); ctx.roundRect(x, y - h / 2, w, h, f * 0.5); ctx.fill(); ctx.stroke()
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  shown.forEach((ln, n) => {
    let lx = x + f * 0.7
    if (n === 0) { ctx.fillStyle = AMBER; ctx.fillText('?', lx, y - h / 2 + f * 0.7); lx += f * 1.3 }
    ctx.fillStyle = '#ffdcab'; ctx.fillText(ln, lx, y - h / 2 + f * 0.7 + n * f * 1.4)
  })
  const st = smooth((t - o.open - 2.1) / 0.25)
  if (st > 0) {
    const r = 30 * dpr * (1.5 - 0.5 * st)
    ctx.globalAlpha = a * st; ctx.fillStyle = AMBER
    ctx.beginPath(); ctx.arc(x + w, y - h / 2, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#2a1804'; ctx.font = `700 ${r * 1.1}px 'Segoe UI', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('✓', x + w, y - h / 2 + r * 0.05)
  }
}

/** In the explorer: an event as a small circle looping its moment, once the camera is close enough to see it. */
function drawSmall(o, x, y, dpr, ex) {
  const ring = o.model ? AMBER : ICE
  const near = smooth((ex.zoom - 3) / 4)
  const r0 = 7 * dpr
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1
  ctx.drawImage(glow(ring), x - r0 * 2, y - r0 * 2, r0 * 4, r0 * 4)
  ctx.globalCompositeOperation = 'source-over'
  if (near <= 0.01) return
  const R = (o.size === 'flash' ? 30 : 42) * dpr * near * (ex.hover === o.i ? 1.6 : 1)
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip()
  const frames = o.clip && clipFrames[o.clip]
  if (frames?.length) drawCover(frames[Math.floor((ex.now / 1000) * FPS + o.i * 7) % frames.length], x - R, y - R, R * 2, R * 2)
  else { const e = EVENTS[o.id], im = pics[e.pic], [px, py, ps] = e.c; ctx.imageSmoothingEnabled = false; if (im?.width) ctx.drawImage(im, px - ps / 2, py - ps / 2, ps, ps, x - R, y - R, R * 2, R * 2); ctx.imageSmoothingEnabled = true }
  ctx.restore()
  ctx.globalAlpha = near; ctx.strokeStyle = ring; ctx.lineWidth = 2 * dpr
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke()
}

// ------------------------------------------------------------------ the video

const filmFrame = (t) => draw(t, camera(t))

if (VIDEO) {
  canvas.width = 1920; canvas.height = 1080
  canvas.style.width = '100vw'
  document.body.classList.add('video')
  document.body.classList.remove('loading')
  const O = OPEN
  const cues = [
    { at: 0, file: 'Sounds/Ambient/Storm.wav', vol: 0.5, dur: 3.6 },
    { at: 0.5, file: 'Sounds/Elemental/Explosion5.wav', vol: 0.55 },
    { at: 0.6, file: 'Sounds/Elemental/Fire.wav', vol: 0.4, dur: 2.8 },
    { at: O.camp.open, file: 'Sounds/Ambient/Rain.wav', vol: 0.35, dur: O.camp.close - O.camp.open },
    { at: O.camp.open + 1.1, file: 'Sounds/Elemental/Water5.wav', vol: 0.45 },
    { at: O.theft.open + 1.6, file: 'Sounds/Alert/Alert2.wav', vol: 0.45 },
    { at: O.hesper.open + 0.4, file: 'Sounds/Magic & Skill/Strange.wav', vol: 0.5 },
    ...Array.from({ length: 9 }, (_, n) => ({ at: O.hesper.open + 0.75 + n * 0.13, file: 'Sounds/Menu/Move1.wav', vol: 0.16 })),
    { at: O.hesper.open + 2.1, file: 'Sounds/Menu/Accept.wav', vol: 0.55 },
    ...OPENING.filter((o) => o.from).map((o) => ({ at: o.open - 0.05, file: o.size === 'flash' ? 'Sounds/Menu/Move2.wav' : 'Sounds/Magic & Skill/Spirit.wav', vol: o.size === 'big' ? 0.4 : o.size === 'mid' ? 0.22 : 0.12 })),
    { at: ACT2, file: 'Sounds/Magic & Skill/Magic3.wav', vol: 0.4 },
    { at: ACT3 - 0.4, file: 'Sounds/Magic & Skill/Heal3.wav', vol: 0.4 },
  ]
  window.stage = {
    fps: FPS,
    frames: LENGTH * FPS,
    shots: [{ id: 'moments', start: 0, frames: ACT2 * FPS }, { id: 'spread', start: ACT2 * FPS, frames: (ACT3 - ACT2) * FPS }, { id: 'whole', start: ACT3 * FPS, frames: (LENGTH - ACT3) * FPS }],
    cues,
    music: { file: 'Musics/13 - Mystical.ogg', at: 0, from: 0, fadeOut: [LENGTH - 1.6, LENGTH] },
    ready: Promise.all([document.fonts.ready, loadClips(Object.keys(clipsInfo))]),
    render: async (f) => filmFrame(f / FPS),
  }
  await window.stage.ready
  filmFrame(Number(params.get('t') ?? 2))
}

// ------------------------------------------------------------------ on the project page: the film round and round

if (EMBED && !VIDEO) {
  // laid out as the film is (1920 x 1080), fitted to the frame it is in
  canvas.width = 1920; canvas.height = 1080
  Object.assign(canvas.style, { width: '100vw', height: '100vh', objectFit: 'contain' })
  const order = [...new Set([...OPENING.filter((o) => o.clip).sort((a, b) => a.open - b.open).map((o) => o.clip), ...Object.keys(clipsInfo)])]
  await loadClips(order.slice(0, 1))
  ;(async () => { for (const id of order.slice(1)) await loadClips([id]) })()
  document.body.classList.remove('loading')
  playLoop(filmFrame, LENGTH)
}

// ------------------------------------------------------------------ the explorer

if (!VIDEO && !EMBED) {
  const dpr = Math.min(2, devicePixelRatio || 1)
  const fit = () => ({ cx: WORLD_VIEW.cx, cy: WORLD_VIEW.cy, zoom: Math.min(W / 6300, H / 4500) * 1.05, rot: 0 })
  let view
  let filmStart = null // the opening playing (ms it began)
  let hover = -1
  const ripples = []
  const tip = document.getElementById('tip')
  const skip = document.getElementById('skip')
  function resize() {
    W = innerWidth; H = innerHeight
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
  }
  addEventListener('resize', resize)
  resize()
  view = fit()
  // the film's camera, made for this window (the film is laid out for 1920 wide)
  const filmView = (t) => { const v = camera(t); return { ...v, zoom: v.zoom * Math.min(W / 1920, H / 1080) } }
  const toWorld = (px, py) => [(px - W / 2) / view.zoom + view.cx, (py - H / 2) / view.zoom + view.cy]
  function pick(px, py) {
    const [wx, wy] = toWorld(px, py)
    let best = -1, bd = (14 / view.zoom) ** 2
    for (let i = 0; i < N; i++) { const d = (X[i] - wx) ** 2 + (Y[i] - wy) ** 2; if (d < bd) (bd = d), (best = i) }
    return best
  }
  const stopFilm = () => { if (filmStart !== null) { view = filmView((performance.now() - filmStart) / 1000); filmStart = null; skip.style.display = 'none' } }
  let drag = null
  canvas.addEventListener('pointerdown', (e) => { stopFilm(); drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId) })
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true
      view.cx -= dx / view.zoom; view.cy -= dy / view.zoom; drag.x = e.clientX; drag.y = e.clientY
      return
    }
    if (filmStart !== null) return
    hover = pick(e.clientX, e.clientY)
    if (hover >= 0) {
      tip.style.display = 'block'; tip.style.left = `${e.clientX + 14}px`; tip.style.top = `${e.clientY + 14}px`
      tip.innerHTML = `<b>${LABEL[hover].replace(/</g, '&lt;')}</b><span>${KINDS[KIND[hover]]} · ${deg[hover]} ${L('links', '条关联')}</span>`
    } else tip.style.display = 'none'
  })
  canvas.addEventListener('pointerleave', () => { hover = -1; tip.style.display = 'none' })
  canvas.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved) {
      const i = pick(e.clientX, e.clientY)
      if (i >= 0) {
        const reach = new Map([[i, 0]]), q = [i]
        for (let h = 0; h < q.length && reach.size < 2500; h++) { const d = reach.get(q[h]); if (d >= 5) continue; for (const j of adj[q[h]]) if (!reach.has(j)) (reach.set(j, d + 1), q.push(j)) }
        ripples.push({ t0: performance.now(), reach: [...reach] })
      }
    }
    drag = null
  })
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); stopFilm()
    const [wx, wy] = toWorld(e.clientX, e.clientY)
    view.zoom = Math.max(0.05, Math.min(40, view.zoom * Math.exp(-e.deltaY / 500)))
    view.cx = wx - (e.clientX - W / 2) / view.zoom; view.cy = wy - (e.clientY - H / 2) / view.zoom
  }, { passive: false })
  let pinch = 0
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) return
    e.preventDefault(); stopFilm()
    const [a, b] = e.touches, d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    if (pinch) view.zoom = Math.max(0.05, Math.min(40, view.zoom * (d / pinch)))
    pinch = d
  }, { passive: false })
  canvas.addEventListener('touchend', () => (pinch = 0))
  const play = () => { filmStart = performance.now(); ripples.length = 0; hover = -1; tip.style.display = 'none'; skip.style.display = '' }
  document.getElementById('story').onclick = play
  skip.onclick = stopFilm
  document.getElementById('home').onclick = () => { stopFilm(); view = fit() }
  document.getElementById('ford').onclick = () => { stopFilm(); view = { cx: storyBox.cx, cy: storyBox.cy, zoom: STORY_END_ZOOM * 2.6 * Math.min(W / 1920, H / 1080), rot: 0 } }
  // the opening plays as soon as its first clip is in; the others come in the order they open
  const order = [...new Set([...OPENING.filter((o) => o.clip).sort((a, b) => a.open - b.open).map((o) => o.clip), ...Object.keys(clipsInfo)])]
  await loadClips(order.slice(0, 1))
  ;(async () => { for (const id of order.slice(1)) await loadClips([id]) })()
  document.body.classList.remove('loading')
  play()
  function loop(now) {
    if (filmStart !== null) {
      const t = (now - filmStart) / 1000
      if (t >= LENGTH - 1.5) stopFilm()
      else { draw(t, filmView(t)); requestAnimationFrame(loop); return }
    }
    while (ripples.length && now - ripples[0].t0 > 3500) ripples.shift()
    const highlight = hover >= 0 ? new Set([hover, ...adj[hover]]) : undefined
    draw(99, view, { highlight, ripples, now, zoom: view.zoom, hover })
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
