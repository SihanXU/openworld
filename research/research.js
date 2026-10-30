// Something new: a player's idea, told to a maker, becomes a thing the world did not have; then the thing meets the
// world, and what no rule covers is asked. The explainer's language (site/explain), the game's own footage
// (site/research/clips: the real flow, recorded headless, as the game shows it).
//   0.4–11.6   an idea, told to Garrick: his answer, how a maker decides (made already / another make / nothing
//              like it), the recipe card, its picture drawn after
//   11.8–19.6  checked, then made: the checks it passes, then into the bag
//   19.8–30.5  the new thing meets the world: used on oneself, no rule yet, the world holds, the model is asked
//              once, the rule is set, the world answers
import { playLoop } from '../embed.js'
import { L } from '../lang.js'
const params = new URLSearchParams(location.search)
const VIDEO = params.has('export') || params.has('video')
const W = 1920, H = 1080, FPS = 30, LENGTH = 30.5

const canvas = document.getElementById('c')
const ctx = canvas.getContext('2d')

const C = { bg: '#f7f8fb', ink: '#1f2937', muted: '#6b7280', faint: '#a3adbd', line: '#cfd8e6', blue: '#2563eb', blueSoft: '#e8efff', amber: '#e08a1e', amberSoft: '#fff3e2', green: '#16a34a', card: '#ffffff', parchment: '#fbf1dc', bark: '#7a4b23' }
const MONO = "Consolas, 'Cascadia Code', monospace", SANS = "'Segoe UI', system-ui, sans-serif"

const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(im); im.src = src })
const clipsInfo = await fetch('clips/clips.json').then((r) => r.json())
const CLIP = {}
async function loadClips(ids) {
  await Promise.all(ids.map(async (id) => { CLIP[id] = await Promise.all(Array.from({ length: clipsInfo[id].frames }, (_, n) => load(`clips/${id}/${String(n + 1).padStart(3, '0')}.webp`))) }))
}
// each language its own recording (the game in that language: the maker's words, the thing's name, its picture)
const TALK = L('talk-en', 'talk'), USE = L('use-en', 'use')
const BOWL = await load(L('clips/bowl-en.png', 'clips/bowl.png'))

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x) }
const ease = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
const easeBack = (x) => { x = clamp(x); const c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }
const lerp = (a, b, x) => a + (b - a) * x

// ------------------------------------------------------------------ the pieces (as the explainer draws them)

function box(x, y, w, h, r, fill, stroke, lw = 2, dash) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r)
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  if (stroke) { ctx.setLineDash(dash ?? []); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); ctx.setLineDash([]) }
}
function text(s, x, y, size, color, o = {}) {
  ctx.font = `${o.weight ?? 500} ${size}px ${o.mono ? MONO : SANS}`
  ctx.fillStyle = color; ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'
  ctx.fillText(s, x, y)
  return ctx.measureText(s).width
}
/** Words broken to a width (a Chinese line breaks anywhere, an English one at spaces); the lines. */
function wrap(s, width, size, o = {}) {
  ctx.font = `${o.weight ?? 500} ${size}px ${o.mono ? MONO : SANS}`
  const parts = /[一-鿿]/.test(s) ? [...s] : s.split(/(?<= )/)
  const lines = ['']
  for (const p of parts) {
    if (ctx.measureText(lines[lines.length - 1] + p).width > width && lines[lines.length - 1]) lines.push(p.trimStart())
    else lines[lines.length - 1] += p
  }
  return lines
}
const label = (s, x, y, a = 1, align = 'left') => { ctx.globalAlpha = a; text(s.toUpperCase(), x, y, 18, C.faint, { weight: 600, align }); ctx.globalAlpha = 1 }
const caption = (s, x, y, a) => { if (a <= 0.01) return; ctx.globalAlpha = a; text(s, x, y, 30, C.ink, { weight: 600 }); ctx.globalAlpha = 1 }

/** The game as the player sees it: a clip at a frame, grey while the world holds. */
function world(r, id, frame, a = 1, hold = 0) {
  if (a <= 0.01) return
  ctx.save(); ctx.globalAlpha = a
  ctx.shadowColor = 'rgba(15,23,42,0.18)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10
  box(r.x, r.y, r.w, r.h, 18, '#111', null)
  ctx.shadowColor = 'transparent'
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.clip()
  const frames = CLIP[id]
  const im = frames?.[clamp(Math.floor(frame), 0, frames.length - 1)]
  if (im?.naturalWidth) {
    ctx.imageSmoothingEnabled = false
    ctx.filter = hold > 0.01 ? `grayscale(${hold}) brightness(${1 - 0.15 * hold})` : 'none'
    ctx.drawImage(im, r.x, r.y, r.w, r.h)
    ctx.filter = 'none'; ctx.imageSmoothingEnabled = true
  }
  ctx.restore()
}

/** A tree of conditions: nodes (x, y, words, kind) and links between them. */
function tree(nodes, links, lit, a = 1) {
  if (a <= 0.01) return
  ctx.globalAlpha = a
  for (const [p, q] of links) {
    const A = nodes[p], B = nodes[q], on = lit?.has(`${p}>${q}`)
    ctx.strokeStyle = on ? (B.kind === 'hole' || B.kind === 'learned' ? C.amber : C.blue) : C.line
    ctx.lineWidth = on ? 4 : 2.5
    ctx.beginPath(); ctx.moveTo(A.x, A.y + 26); ctx.bezierCurveTo(A.x, A.y + 70, B.x, B.y - 70, B.x, B.y - 26); ctx.stroke()
  }
  for (const [k, n] of Object.entries(nodes)) {
    const on = lit?.has(k)
    ctx.font = `600 ${n.kind === 'root' ? 28 : 26}px ${MONO}`
    const w = ctx.measureText(n.words).width + 44, h = 58
    const kinds = {
      root: [C.ink, C.ink, '#fff'], cond: [on ? C.blueSoft : C.card, on ? C.blue : C.line, C.ink],
      leaf: [on ? C.blue : C.card, on ? C.blue : C.line, on ? '#fff' : C.ink],
      hole: [C.amberSoft, C.amber, C.amber], learned: [on ? C.amber : C.amberSoft, C.amber, on ? '#fff' : '#8a4b06'],
    }
    const [fill, stroke, ink] = kinds[n.kind]
    box(n.x - w / 2, n.y - h / 2, w, h, n.kind === 'cond' ? 26 : 10, fill, stroke, 2.5, n.kind === 'hole' ? [8, 6] : undefined)
    text(n.words, n.x, n.y + 1, n.kind === 'root' ? 28 : 26, ink, { mono: true, weight: 600, align: 'center' })
  }
  ctx.globalAlpha = 1
}
function along(pts, u) {
  if (pts.length === 1) return pts[0]
  const seg = clamp(u, 0, 0.9999) * (pts.length - 1), i = Math.floor(seg), f = seg - i
  const e = ease(f)
  return [lerp(pts[i][0], pts[i + 1][0], e), lerp(pts[i][1], pts[i + 1][1], e)]
}
function token(x, y, words, color = C.blue, a = 1) {
  if (a <= 0.01) return
  ctx.globalAlpha = a
  const g = ctx.createRadialGradient(x, y, 0, x, y, 70)
  g.addColorStop(0, color + '55'); g.addColorStop(1, color + '00')
  ctx.fillStyle = g; ctx.fillRect(x - 70, y - 70, 140, 140)
  ctx.font = `700 24px ${MONO}`
  const w = ctx.measureText(words).width + 36
  box(x - w / 2, y - 23, w, 46, 23, color, null)
  text(words, x, y + 1, 24, '#fff', { mono: true, weight: 600, align: 'center' })
  ctx.globalAlpha = 1
}
const pathPts = (nodes, ks) => ks.map((k) => [nodes[k].x, nodes[k].y])
const litSet = (ks, upto) => { const s = new Set(); for (let i = 0; i <= upto && i < ks.length; i++) { s.add(ks[i]); if (i > 0) s.add(`${ks[i - 1]}>${ks[i]}`) } return s }
/** The bowl as the game drew it, at a size, without smoothing. */
function bowl(x, y, size, a = 1) {
  if (a <= 0.01 || !BOWL.naturalWidth) return
  ctx.globalAlpha = a; ctx.imageSmoothingEnabled = false
  ctx.drawImage(BOWL, x - size / 2, y - size * 0.45, size, size * BOWL.naturalHeight / BOWL.naturalWidth)
  ctx.imageSmoothingEnabled = true; ctx.globalAlpha = 1
}

// ------------------------------------------------------------------ what was said and made (the recording's own)

const IDEA = L('Hollow a log into a bowl for stew', '用原木挖一个盛炖菜的木碗')
const REPLY = L('Aye, a good log hollowed out by hand makes a sturdy wooden bowl, just right for holding a hot stew.', '好，用一根原木挖出一只结实的木碗，够深，能盛满一碗热炖菜；徒手就能刻成。')
const NAME = L('Hollowed Log Bowl', '原木炖菜碗')
const META = L('Something new · Plate · by hand', '新东西 · 盘子 · 徒手')
const NEEDS = L('Log × 1', '木头 × 1')
const ANSWER = L('The hollowed bowl is empty: only the smell of birch and a few splinters at the rim.', '原木炖菜碗的木碗里空空如也，只有木纹里还留着一点旧炖菜的香味。')

// ------------------------------------------------------------------ the layout

const DY = 80
const GW = { x: 90, y: 280, w: 720, h: 405 }
const GW_C = [GW.x + GW.w / 2, GW.y + GW.h / 2]
const TX = 1340
/** How a maker decides: made already, another make of a prototype, or nothing like it in the world. */
const MAKER = {
  root: { x: TX, y: 350, words: 'craftsperson · idea', kind: 'root' },
  known: { x: TX - 330, y: 490, words: 'made already?', kind: 'cond' },
  variant: { x: TX, y: 490, words: 'another make?', kind: 'cond' },
  fresh: { x: TX + 330, y: 490, words: 'nothing like it?', kind: 'cond' },
  tell: { x: TX - 330, y: 630, words: 'tell_recipe()', kind: 'leaf' },
  adapt: { x: TX, y: 630, words: 'adapt(prototype)', kind: 'leaf' },
  design: { x: TX + 330, y: 630, words: 'design(new kind)', kind: 'leaf' },
}
const MAKER_LINKS = [['root', 'known'], ['root', 'variant'], ['root', 'fresh'], ['known', 'tell'], ['variant', 'adapt'], ['fresh', 'design']]
const MAKER_PATH = ['root', 'fresh', 'design']
/** The new thing's own rules: none yet. */
const USES = {
  root: { x: TX, y: 300, words: 'bowl · use', kind: 'root' },
  self: { x: TX - 220, y: 450, words: 'on oneself?', kind: 'cond' },
  other: { x: TX + 220, y: 450, words: 'on a thing?', kind: 'cond' },
  hole: { x: TX - 220, y: 600, words: '?', kind: 'hole' },
  hole2: { x: TX + 220, y: 600, words: '?', kind: 'hole' },
}
const USES_LINKS = [['root', 'self'], ['root', 'other'], ['self', 'hole'], ['other', 'hole2']]
const USE_PATH = ['root', 'self', 'hole']

const CHAPTERS = [[0.4, 11.6, '1', L('An idea, told to a maker', '和手艺人聊一个想法')], [11.8, 19.6, '2', L('Checked, then made', '先检查，再成形')], [19.8, LENGTH + 1, '3', L('A new thing, new acts', '新东西，新交互')]]
function chapter(t) {
  for (const [a, b, n, name] of CHAPTERS) {
    const k = smooth((t - a) / 0.4) * (1 - smooth((t - b + 0.3) / 0.3))
    if (k <= 0.01) continue
    ctx.globalAlpha = k
    const x = 90 - 30 * (1 - k)
    box(x, 78, 64, 64, 32, C.ink, null)
    text(n, x + 32, 111, 34, '#fff', { weight: 800, align: 'center' })
    text(name, x + 92, 111, 48, C.ink, { weight: 700 })
    ctx.globalAlpha = 1
  }
}

/** The model's calls, top right: Garrick's answer, the picture, the new rule. */
const CALLS = [4.3, 8.8, 25.6]
function calls(t) {
  const a = smooth((t - 0.7) / 0.5)
  if (a <= 0.01) return
  const n = CALLS.filter((c) => t >= c).length
  const bump = CALLS.map((b) => (t > b ? Math.exp(-(t - b) * 5) : 0)).reduce((x, y) => x + y, 0)
  ctx.globalAlpha = a
  box(1560, 60, 300, 110, 18, C.card, C.line, 2)
  label(L('model calls', '模型调用'), 1590, 92)
  ctx.save(); ctx.translate(1590, 140); ctx.scale(1 + 0.3 * bump, 1 + 0.3 * bump)
  text(String(n), 0, 0, 52, n ? C.amber : C.ink, { weight: 800 })
  ctx.restore()
  ctx.globalAlpha = 1
}

function film(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H)
  chapter(t)
  ctx.save(); ctx.translate(0, DY)
  if (t < 19.9) { actWorldOne(t); if (t < 11.9) actOne(t); if (t >= 11.6) actTwo(t) }
  if (t >= 19.6) actThree(t)
  ctx.restore()
  calls(t)
  const black = 1 - smooth(t / 0.5) + smooth((t - (LENGTH - 1.2)) / 1.1)
  if (black > 0.01) { ctx.globalAlpha = clamp(black); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
}

/** The world in the first two parts: walking up to Garrick, then held there. */
function actWorldOne(t) {
  const out = 1 - smooth((t - 19.4) / 0.4)
  const win = smooth((t - 0.2) / 0.5)
  world({ x: GW.x, y: GW.y + 20 * (1 - win), w: GW.w, h: GW.h }, TALK, Math.max(0, t - 0.4) * FPS, win * out)
  label(L('the world', '世界'), GW.x, GW.y - 34, win * out)
}

// ------------------------------------------------------------------ 1: the idea

/** A speech bubble: who, the words (typed up to `typed`), on the right of the world. */
function bubble(x, y, w, who, words, typed, a, mine) {
  if (a <= 0.01) return
  ctx.globalAlpha = a
  const lines = wrap(words.slice(0, Math.floor(words.length * typed)) || ' ', w - 56, 26)
  const h = 66 + lines.length * 38
  ctx.save(); ctx.shadowColor = 'rgba(15,23,42,0.10)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6
  box(x, y, w, h, 18, mine ? C.blue : C.parchment, null)
  ctx.restore(); ctx.globalAlpha = a
  if (!mine) box(x, y, w, h, 18, null, '#e5cfa3', 2)
  text(who, x + 28, y + 30, 20, mine ? '#dbe6ff' : C.bark, { weight: 700 })
  lines.forEach((ln, i) => text(ln, x + 28, y + 70 + i * 38, 26, mine ? '#fff' : C.ink, { weight: 500 }))
  ctx.globalAlpha = 1
  return h
}

function actOne(t) {
  const out = 1 - smooth((t - 11.5) / 0.4)
  // what the player says, typed; what Garrick says back (the model's first call)
  const bx = 900, bw = 880
  bubble(bx, -10, 560, L('you', '你'), IDEA, clamp((t - 1.0) / 1.6), smooth((t - 0.8) / 0.3) * out, true)
  bubble(bx + 120, 110, bw - 120, 'Garrick', REPLY, clamp((t - 4.4) / 1.4), smooth((t - 4.3) / 0.3) * out * (1 - smooth((t - 5.9) / 0.4) * 0.0), false)
  if (t > 2.8 && t < 4.3) { ctx.globalAlpha = out * smooth((t - 2.8) / 0.2); const d = Math.floor((t - 2.8) * 3) % 4; text(L('thinking', '琢磨中') + '.'.repeat(d), bx + 140, 150, 26, C.muted); ctx.globalAlpha = 1 }
  // how a maker decides: down to "nothing like it", a new kind designed
  const ta = smooth((t - 5.6) / 0.5) * out
  label(L('how a maker decides', '手艺人怎么判断'), TX, 292, ta, 'center')
  const from = 6.4, step = 0.35
  tree(MAKER, MAKER_LINKS, t >= from ? litSet(MAKER_PATH, Math.floor((t - from) / step)) : undefined, ta)
  const pts = pathPts(MAKER, MAKER_PATH)
  if (t >= 6.0 && t < from) { const u = ease((t - 6.0) / 0.4); token(lerp(GW_C[0], pts[0][0], u), lerp(GW_C[1], pts[0][1], u), L('bowl', '木碗'), C.blue, out) }
  else if (t >= from && t < from + step * 2) token(...along(pts, (t - from) / (step * 2)), L('bowl', '木碗'), C.blue, out)
  // the recipe card, its picture drawn after (the second call)
  recipe(t, out)
  caption(L('said aloud, answered in seconds, with a recipe', '说出想法，几秒后回话，并给出配方'), GW.x, GW.y + GW.h + 50, smooth((t - 4.6) / 0.3) * out)
}

/** The recipe card under the tree: the name, what it is, what goes in; the picture sketched, then drawn. */
function recipe(t, out, place) {
  const a = smooth((t - 7.2) / 0.4) * out
  if (a <= 0.01) return
  const p = place ?? { x: 1290, y: 712 }
  const k = easeBack((t - 7.2) / 0.5)
  ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x + 280, p.y + 75); ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k); ctx.translate(-(p.x + 280), -(p.y + 75))
  ctx.shadowColor = 'rgba(15,23,42,0.12)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6
  box(p.x, p.y, 560, 150, 16, C.parchment, null)
  ctx.shadowColor = 'transparent'
  box(p.x, p.y, 560, 150, 16, null, '#e5cfa3', 2)
  // the icon: a sketch while it is drawn, then the bowl
  const drawn = smooth((t - 8.8) / 0.3)
  box(p.x + 22, p.y + 22, 106, 106, 12, '#fff8ea', '#e5cfa3', 2, drawn < 1 ? [6, 5] : undefined)
  if (drawn < 1) { ctx.globalAlpha = a * (1 - drawn) * (0.5 + 0.5 * Math.sin(t * 6)); text(L('sketching…', '画图样中……'), p.x + 75, p.y + 75, 18, C.bark, { align: 'center', weight: 600 }); ctx.globalAlpha = a }
  bowl(p.x + 75, p.y + 72, 88 * (0.85 + 0.15 * easeBack((t - 8.8) / 0.4)), a * drawn)
  text(NAME, p.x + 150, p.y + 46, 32, C.ink, { weight: 700 })
  text(META, p.x + 150, p.y + 86, 21, C.muted)
  text(NEEDS, p.x + 150, p.y + 120, 22, C.bark, { weight: 600 })
  ctx.restore()
}

// ------------------------------------------------------------------ 2: checked, then made

const CHECKS = [
  L('no number above the best of its family', '数值不超过同类最好的那一件'),
  L('worth no more than what goes in', '价值不超过用掉的材料'),
  L('nothing from nothing (the simplex)', '不能凭空多出东西（单纯形法）'),
  L('materials, tools, station at hand', '材料、工具、工作台齐全'),
]
function actTwo(t) {
  const a = smooth((t - 11.8) / 0.4) * (1 - smooth((t - 19.4) / 0.4))
  if (a <= 0.01) return
  // the card moves up, the checks come in beneath it
  const m = ease((t - 11.8) / 0.6)
  const place = { x: lerp(1290, 1000, m), y: lerp(712, 200, m) }
  recipe(Math.max(t, 9.6), a, place)
  const x = 1000, y = 400
  ctx.globalAlpha = a
  box(x, y, 560, 300, 16, C.card, C.line, 2)
  label(L('checked before it is made', '做出来之前的检查'), x + 26, y + 34)
  CHECKS.forEach((c, k) => {
    const on = smooth((t - (12.8 + k * 0.6)) / 0.15)
    ctx.globalAlpha = a * (0.35 + 0.65 * on)
    text(on > 0.5 ? '✓' : '·', x + 40, y + 88 + k * 52, 28, on > 0.5 ? C.green : C.faint, { weight: 800, align: 'center' })
    text(c, x + 70, y + 88 + k * 52, 25, C.ink)
  })
  ctx.globalAlpha = 1
  // made: the bowl into the bag
  bag(t, a)
  caption(L('all passed: made, and the recipe kept', '全部通过：做成了，配方也记下了'), GW.x, GW.y + GW.h + 50, smooth((t - 15.6) / 0.3) * a)
}
/** A row of the bag under the world; the bowl flies into its first free slot. */
function bag(t, a) {
  const ba = smooth((t - 15.2) / 0.4) * a
  if (ba <= 0.01) return
  const y = GW.y + GW.h + 100, s = 76
  ctx.globalAlpha = ba
  for (let i = 0; i < 8; i++) box(GW.x + i * (s + 10), y, s, s, 10, '#f3e5c6', '#d9bf8c', 2)
  // the log already there; the bowl beside it
  ctx.globalAlpha = ba; text(L('log', '木头'), GW.x + s / 2, y + s / 2, 18, C.bark, { align: 'center', weight: 700 })
  const u = ease((t - 15.6) / 0.7)
  const fx = 1000 + 75, fy = 200 + 72
  const tx = GW.x + (s + 10) + s / 2, ty = y + s / 2
  if (t >= 15.6) bowl(lerp(fx, tx, u), lerp(fy, ty, u) - Math.sin(u * Math.PI) * 120, lerp(88, 60, u), ba)
  if (t > 16.4) { ctx.globalAlpha = ba * smooth((t - 16.4) / 0.2) * (1 - smooth((t - 18.6) / 0.4)); text('+1 ' + NAME, GW.x + 8 * (s + 10) + 14, ty, 26, C.green, { weight: 700 }); ctx.globalAlpha = 1 }
  ctx.globalAlpha = 1
}

// ------------------------------------------------------------------ 3: the new thing meets the world

function actThree(t) {
  const a = smooth((t - 19.8) / 0.4)
  if (a <= 0.01) return
  // the world: used on oneself (part one), held grey while the model is asked, then the answer (part two)
  const [, second] = clipsInfo[USE].parts
  let frame, hold = 0
  if (t < 23.0) frame = Math.max(0, t - 20.2) * FPS
  else if (t < 26.0) { frame = second - 2; hold = smooth((t - 23.0) / 0.3) }
  else frame = second + (t - 26.0) * FPS
  if (t >= 23.0 && t < 26.3) hold = smooth((t - 23.0) / 0.3) * (1 - smooth((t - 25.9) / 0.3))
  world(GW, USE, frame, a, hold)
  label(L('the world', '世界'), GW.x, GW.y - 34, a)
  // the bowl's rules: none yet
  label(L('the rules of the new thing', '新东西的规则'), TX, 240, a, 'center')
  const learned = t > 25.6
  const nodes = { ...USES, hole: learned ? { ...USES.hole, words: 'look_inside()', kind: 'learned' } : USES.hole }
  const from = 21.4, step = 0.35
  tree(nodes, USES_LINKS, t >= from ? litSet(USE_PATH, Math.floor((t - from) / step)) : undefined, a)
  const pts = pathPts(nodes, USE_PATH)
  if (t >= 20.9 && t < from) { const u = ease((t - 20.9) / 0.5); token(lerp(GW_C[0], pts[0][0], u), lerp(GW_C[1], pts[0][1], u), 'use', C.blue, a) }
  else if (t >= from && t < from + step * 2) token(...along(pts, (t - from) / (step * 2)), 'use', C.blue, a)
  const [hx, hy] = pts[2]
  if (t >= from + step * 2 && t < 25.6) {
    const p = 0.5 + 0.5 * Math.sin((t - 22.1) * 6)
    ctx.globalAlpha = a * 0.25 * p; ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(hx, hy, 60 + 14 * p, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
    ctx.globalAlpha = a * smooth((t - 22.2) / 0.3); text(L('no rule yet', '还没有规则'), hx + 70, hy, 26, C.amber, { weight: 700 }); ctx.globalAlpha = 1
  }
  caption(L('no rule yet: the world holds, and asks the model once', '还没有规则：世界停住，只问一次模型'), GW.x, GW.y + GW.h + 50, smooth((t - 22.4) / 0.3) * (1 - smooth((t - 25.8) / 0.3)))
  // the rule set in the leaf, and down to the world
  if (t >= 25.6 && t < 26.0) { ctx.globalAlpha = a * (1 - (t - 25.6) / 0.4); ctx.strokeStyle = C.amber; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(hx, hy, 40 + 120 * (t - 25.6), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1 }
  if (t >= 25.8 && t < 26.4) { const u = ease((t - 25.8) / 0.6); token(lerp(hx, GW_C[0], u), lerp(hy, GW_C[1], u), 'look_inside()', C.amber, a) }
  // what the world says back (the game's own words)
  const wa = smooth((t - 26.4) / 0.4) * a
  if (wa > 0.01) {
    const x = GW.x, y = GW.y + GW.h + 30, w = GW.w
    const lines = wrap(ANSWER, w - 56, 26)
    ctx.globalAlpha = wa
    box(x, y, w, 70 + lines.length * 38, 16, C.parchment, '#e5cfa3', 2)
    text(L('✦ a new thread is woven', '✦ 织入了一根新线'), x + 28, y + 32, 20, C.bark, { weight: 700 })
    lines.forEach((ln, i) => text(ln, x + 28, y + 72 + i * 38, 26, C.ink))
    ctx.globalAlpha = 1
  }
}

// ------------------------------------------------------------------ the video, the page

if (VIDEO) {
  document.body.classList.add('video'); document.body.classList.remove('loading')
  window.stage = {
    fps: FPS, frames: LENGTH * FPS,
    shots: [{ id: 'idea', start: 0, frames: 11.8 * FPS }, { id: 'checked', start: 11.8 * FPS, frames: 8 * FPS }, { id: 'meets', start: 19.8 * FPS, frames: (LENGTH - 19.8) * FPS }],
    cues: [], music: null,
    ready: loadClips([TALK, USE]),
    render: async (f) => film(f / FPS),
  }
  await window.stage.ready
  film(Number(params.get('t') ?? 8))
}

if (!VIDEO) {
  await loadClips([TALK])
  ;(async () => loadClips([USE]))()
  document.body.classList.remove('loading')
  const buttons = [...document.querySelectorAll('[data-from]')].slice(1)
  const mark = (t) => buttons.forEach((b, i) => b.classList.toggle('on', t >= Number(b.dataset.from) && (i === buttons.length - 1 || t < Number(buttons[i + 1].dataset.from))))
  const player = playLoop((t) => { film(t); mark(t) }, LENGTH)
  document.querySelectorAll('[data-from]').forEach((b) => (b.onclick = () => player.seek(Number(b.dataset.from))))
}
