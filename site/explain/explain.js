// How it works: an event as a token through the rules of the thing it happens to.
//   0–8.8 s    a rule answers: rain on Hesper's campfire, down the campfire's tree to its leaf, back into the world;
//              then three more, faster (no model)
//   8.8–23 s   no rule yet: Hesper can't tend her fire; her tree ends in an open leaf, the world holds, the modder
//              works it out (the paper's stages), the rule is checked and set in the leaf, the world goes on
//   23–30.5 s  learned once, for everyone: the next who meet it run the rule; more players, more acts, hardly a call
// A frame for any t (?export, site/video/export.mjs); the page plays it round and round, its chapters a click away.
import { playLoop } from '../embed.js'
import { L } from '../lang.js'
const params = new URLSearchParams(location.search)
const VIDEO = params.has('export') || params.has('video')
const W = 1920, H = 1080, FPS = 30, LENGTH = 30.5

const canvas = document.getElementById('c')
const ctx = canvas.getContext('2d')

const C = { bg: '#f7f8fb', ink: '#1f2937', muted: '#6b7280', faint: '#a3adbd', line: '#cfd8e6', blue: '#2563eb', blueSoft: '#e8efff', amber: '#e08a1e', amberSoft: '#fff3e2', green: '#16a34a', card: '#ffffff' }
const MONO = "Consolas, 'Cascadia Code', monospace", SANS = "'Segoe UI', system-ui, sans-serif"

const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(im); im.src = src })
// the explainer's own clips (site/explain/clips.mjs, from the stage's ?film=explain)
const clipsInfo = await fetch('clips/clips.json').then((r) => r.json())
const CLIP = {}
async function loadClips(ids) {
  await Promise.all(ids.map(async (id) => { CLIP[id] = await Promise.all(Array.from({ length: clipsInfo[id].frames }, (_, n) => load(`clips/${id}/${String(n + 1).padStart(3, '0')}.webp`))) }))
}
// in the order the film first needs them: the first chapter's four, Hesper, then the players' windows
const USED = ['camp', 'lit', 'grass', 'out', 'hesper', 'tree', 'theft', 'hay', 'slime', 'street', 'north', 'market', 'bell', 'gate', 'canal', 'haven', 'road']

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x) }
const ease = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
const easeBack = (x) => { x = clamp(x); const c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }
const lerp = (a, b, x) => a + (b - a) * x
const hash = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return ((h >>> 0) % 100000) / 100000 }

// ------------------------------------------------------------------ the pieces

/** A rounded box, filled and outlined. */
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
const label = (s, x, y, a = 1, align = 'left') => { ctx.globalAlpha = a; text(s.toUpperCase(), x, y, 18, C.faint, { weight: 600, align }); ctx.globalAlpha = 1 }

/** The game, as one player sees it: a clip at a time (`frame` its frame), grey while the world holds. */
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
    const s = Math.max(r.w / im.naturalWidth, r.h / im.naturalHeight), sw = r.w / s, sh = r.h / s
    ctx.filter = hold > 0.01 ? `grayscale(${hold}) brightness(${1 - 0.15 * hold})` : 'none'
    ctx.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, r.x, r.y, r.w, r.h)
    ctx.filter = 'none'
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
    if (n.hidden) continue
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

/** Where a token is along a path of points (node centres), t in [0, 1]. */
function along(pts, u) {
  if (pts.length === 1) return pts[0]
  const seg = clamp(u, 0, 0.9999) * (pts.length - 1), i = Math.floor(seg), f = seg - i
  const e = ease(f)
  return [lerp(pts[i][0], pts[i + 1][0], e), lerp(pts[i][1], pts[i + 1][1], e)]
}
/** The event as a small card with a glow. */
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

// ------------------------------------------------------------------ the trees

// the trees' middle: the middle of the room right of the world's window
const TX = 1320
const CAMPFIRE = {
  root: { x: TX, y: 250, words: 'campfire · element', kind: 'root' },
  fire: { x: TX - 280, y: 410, words: 'fire?', kind: 'cond' },
  water: { x: TX, y: 410, words: 'water?', kind: 'cond' },
  ice: { x: TX + 280, y: 410, words: 'ice?', kind: 'cond' },
  litF: { x: TX - 280, y: 570, words: 'lit?', kind: 'cond' },
  litW: { x: TX, y: 570, words: 'lit?', kind: 'cond' },
  frozen: { x: TX + 280, y: 570, words: 'wet?', kind: 'cond' },
  light: { x: TX - 280, y: 730, words: 'add(lit)', kind: 'leaf' },
  douse: { x: TX, y: 730, words: 'remove(lit) · steam', kind: 'leaf' },
  freeze: { x: TX + 280, y: 730, words: 'add(frozen)', kind: 'leaf' },
}
const CAMPFIRE_LINKS = [['root', 'fire'], ['root', 'water'], ['root', 'ice'], ['fire', 'litF'], ['water', 'litW'], ['ice', 'frozen'], ['litF', 'light'], ['litW', 'douse'], ['frozen', 'freeze']]
const STUCK = {
  root: { x: TX, y: 250, words: 'ferrykeeper · stuck', kind: 'root' },
  fire: { x: TX, y: 410, words: 'a fire nearby?', kind: 'cond' },
  wet: { x: TX - 150, y: 570, words: 'is it wet?', kind: 'cond' },
  walk: { x: TX + 190, y: 570, words: 'walk_on()', kind: 'leaf' },
  tend: { x: TX - 300, y: 730, words: 'tend(fire)', kind: 'leaf' },
  hole: { x: TX + 20, y: 730, words: '?', kind: 'hole' },
}
const STUCK_LINKS = [['root', 'fire'], ['fire', 'wet'], ['fire', 'walk'], ['wet', 'tend'], ['wet', 'hole']]
const pathPts = (nodes, ks) => ks.map((k) => [nodes[k].x, nodes[k].y])
const litSet = (ks, upto) => { const s = new Set(); for (let i = 0; i <= upto && i < ks.length; i++) { s.add(ks[i]); if (i > 0) s.add(`${ks[i - 1]}>${ks[i]}`) } return s }

// ------------------------------------------------------------------ the film

const GW = { x: 90, y: 280, w: 720, h: 405 }
const GW_C = [GW.x + GW.w / 2, GW.y + GW.h / 2]
/** The quick ones after the first: which clip, which way down the tree, what comes back. */
const QUICK = [
  { clip: 'lit', root: 'campfire · element', path: ['root', 'fire', 'litF', 'light'], word: 'fire', back: 'add(lit)' },
  { clip: 'grass', root: 'tuft · element', path: ['root', 'fire', 'litF', 'light'], word: 'fire', back: 'add(burning)' },
  { clip: 'out', root: 'dead tree · element', path: ['root', 'water', 'litW', 'douse'], word: 'rain', back: 'remove(burning)' },
]

/** Everything of the first three parts sits this much lower than drawn (the chapter's title above it). */
const DY = 80
const CHAPTERS = [[0.4, 8.6, '1', L('A rule answers', '规则作答')], [8.8, 22.8, '2', L('No rule yet: the model is asked, once', '还没有规则：只问一次模型')], [23, LENGTH + 1, '3', L('Learned once, for everyone', '学会一次，所有人共用')]]
/** The part's number and name, top left. */
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

function film(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H)
  chapter(t)
  ctx.save(); ctx.translate(0, DY)
  if (t < 23.2) actOne(t)
  if (t >= 22.8) actThree(t)
  ctx.restore()
  calls(t)
  const black = 1 - smooth(t / 0.5) + smooth((t - (LENGTH - 1.2)) / 1.1)
  if (black > 0.01) { ctx.globalAlpha = clamp(black); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
}

/** The count of the model's calls, top right: 0, then 1 when the rule is learned, then rarely more. */
function callCount(t) { if (t < 16.8) return 0; if (t < 26.2) return 1; if (t < 27.6) return 2; return 3 }
function calls(t) {
  const a = smooth((t - 0.7) / 0.5)
  if (a <= 0.01) return
  const n = callCount(t)
  const bump = [16.8, 26.2, 27.6].map((b) => (t > b ? Math.exp(-(t - b) * 5) : 0)).reduce((x, y) => x + y, 0)
  ctx.globalAlpha = a
  box(1560, 60, 300, 110, 18, C.card, C.line, 2)
  label(L('model calls', '模型调用'), 1590, 92)
  ctx.save(); ctx.translate(1590, 140); ctx.scale(1 + 0.3 * bump, 1 + 0.3 * bump)
  text(String(n), 0, 0, 52, n ? C.amber : C.ink, { weight: 800 })
  ctx.restore()
  ctx.globalAlpha = 1
}

function actOne(t) {
  const out = 1 - smooth((t - 22.8) / 0.4)
  // ---- the world: which clip, at which of its frames (slowed while a token is in the rules)
  let clip = 'camp', frame = 0, hold = 0
  if (t < 4.4) frame = t < 1.0 ? (t - 0.4) * FPS : t < 3.0 ? 0.6 * FPS + (t - 1.0) * FPS * 0.12 : 0.84 * FPS + (t - 3.0) * FPS
  else if (t < 8.6) { const q = Math.min(2, Math.floor((t - 4.4) / 1.4)), k = t - 4.4 - q * 1.4; clip = QUICK[q].clip; frame = Math.max(0, k - 0.1) * FPS }
  else { clip = 'hesper'; const k = t - 8.8; frame = k < 1.6 ? k * FPS * 0.6 : k < 10.8 ? 1.6 * FPS * 0.6 : 0.96 * FPS + (k - 10.8) * FPS; hold = smooth((t - 10.6) / 0.3) * (1 - smooth((t - 19.6) / 0.4)) }
  const win = smooth((t - 0.2) / 0.5)
  world({ x: GW.x, y: GW.y + 20 * (1 - win), w: GW.w, h: GW.h }, clip, frame, win * out, hold)
  label(L('the world', '世界'), GW.x, GW.y - 34, win * out)
  // ---- the rules
  const which = t < 8.7 ? 'camp' : 'stuck'
  const swap = which === 'camp' ? 1 - smooth((t - 8.5) / 0.3) : smooth((t - 8.7) / 0.3)
  const ta = smooth((t - 0.4) / 0.6) * out * swap
  // while the modder's panel is in, Hesper's tree steps left to make room for it
  const dx = which === 'stuck' ? -170 * smooth((t - 10.7) / 0.5) * (1 - smooth((t - 17.3) / 0.5)) : 0
  label(L('the rules of what it happens to', '它所发生在的东西的规则'), TX + dx, 180, ta, 'center')
  if (which === 'camp') {
    // the first: rain on the campfire
    let path = ['root', 'water', 'litW', 'douse'], from = 1.5, step = 0.3, words = 'rain', back = 'remove(lit) · steam', t0 = 1.0, tBack = 2.5
    let rootWords = 'campfire · element'
    if (t >= 4.4) { const q = Math.min(2, Math.floor((t - 4.4) / 1.4)); const Q = QUICK[q]; path = Q.path; words = Q.word; back = Q.back; rootWords = Q.root; t0 = 4.4 + q * 1.4 + 0.15; from = t0 + 0.3; step = 0.12; tBack = from + step * 3 + 0.05 }
    const nodes = { ...CAMPFIRE, root: { ...CAMPFIRE.root, words: rootWords } }
    const depth = Math.floor((t - from) / step)
    tree(nodes, CAMPFIRE_LINKS, t >= from ? litSet(path, depth) : undefined, ta)
    const pts = pathPts(nodes, path)
    // to the tree
    if (t >= t0 && t < from) { const u = ease((t - t0) / (from - t0)); token(lerp(GW_C[0], pts[0][0], u), lerp(GW_C[1], pts[0][1], u), words, C.blue, out) }
    else if (t >= from && t < tBack) token(...along(pts, (t - from) / (step * 3)), words, C.blue, out)
    // the leaf answers: back into the world
    if (t >= tBack && t < tBack + 0.5) { const u = ease((t - tBack) / 0.5), [lx, ly] = pts[pts.length - 1]; token(lerp(lx, GW_C[0], u), lerp(ly, GW_C[1], u), back, C.blue, out * smooth((t - tBack) / 0.12) * (1 - smooth((t - tBack - 0.4) / 0.1))) }
    if (t >= tBack && t < tBack + 0.6) { const [lx, ly] = pts[pts.length - 1]; ctx.globalAlpha = out * (1 - (t - tBack) / 0.6); ctx.strokeStyle = C.blue; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(lx, ly, 40 + 90 * (t - tBack), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1 }
    if (t > 3.2 && t < 4.4) { ctx.globalAlpha = smooth((t - 3.2) / 0.3) * (1 - smooth((t - 4.2) / 0.2)); text(L('a rule answers: no model', '规则作答：不用模型'), GW.x, GW.y + GW.h + 50, 30, C.ink, { weight: 600 }); ctx.globalAlpha = 1 }
  } else {
    // Hesper, stuck
    const path = ['root', 'fire', 'wet', 'hole'], from = 9.9, step = 0.3
    const learned = t > 17.4
    const nodes = Object.fromEntries(Object.entries({ ...STUCK, hole: learned ? { ...STUCK.hole, words: 'wait_by(fire)', kind: 'learned' } : STUCK.hole }).map(([k, n]) => [k, { ...n, x: n.x + dx }]))
    const depth = Math.floor((t - from) / step)
    tree(nodes, STUCK_LINKS, t >= from ? litSet(path, depth) : undefined, ta)
    const pts = pathPts(nodes, path)
    if (t >= 9.4 && t < from) { const u = ease((t - 9.4) / 0.5); token(lerp(GW_C[0], pts[0][0], u), lerp(GW_C[1], pts[0][1], u), 'stuck', C.blue, out) }
    else if (t >= from && t < 10.8) token(...along(pts, (t - from) / (step * 3)), 'stuck', C.blue, out)
    else if (t >= 10.8 && t < 11.0) token(...pts[3], 'stuck', C.amber, out)
    // the open leaf: the world holds
    const [hx, hy] = pts[3]
    if (t >= 10.8 && t < 17.4) {
      const p = 0.5 + 0.5 * Math.sin((t - 10.8) * 6)
      ctx.globalAlpha = out * 0.25 * p; ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(hx, hy, 60 + 14 * p, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
      ctx.globalAlpha = out * smooth((t - 10.9) / 0.3); text(L('no rule yet', '还没有规则'), hx + 70, hy, 26, C.amber, { weight: 700 }); ctx.globalAlpha = 1
      ctx.globalAlpha = smooth((t - 10.9) / 0.3) * (1 - smooth((t - 19.4) / 0.3)); text(L('the world holds this one actor, and asks', '世界只停住这一个角色，然后去问'), GW.x, GW.y + GW.h + 50, 30, C.ink, { weight: 600 }); ctx.globalAlpha = 1
    }
    modder(t, hx, hy)
    // the rule set in the leaf, checked
    if (t >= 17.4 && t < 22.8) checks(t, hx, hy)
    // and on: down to the world
    if (t >= 19.6 && t < 20.2) { const u = ease((t - 19.6) / 0.6); token(lerp(hx, GW_C[0], u), lerp(hy, GW_C[1], u), 'wait_by(fire)', C.amber, out) }
    if (t > 20.4 && t < 22.8) { ctx.globalAlpha = smooth((t - 20.4) / 0.3) * out; text(L('kept in the rule library for every case like it', '存入规则库，以后同类的情况都照它处理'), GW.x, GW.y + GW.h + 50, 30, C.ink, { weight: 600 }); ctx.globalAlpha = 1 }
  }
}

const STAGES = [[L('comprehend', '理解'), L('what happened, and why no rule fits', '发生了什么，为什么没有规则适用')], [L('recall', '回忆'), L('rules and lessons kept before', '以前留下的规则和经验')], [L('design', '设计'), L('a rule for this type, this leaf', '为这个类型、这片叶子写一条规则')], [L('verify', '验证'), L('repaired until it runs', '修到能运行为止')], [L('audit', '审查'), L('an adversary tries it in a sandbox', '对抗者在沙盒里试它')]]
const CODE = ['person.on(stuck) {', '  wait_by(fire) }']
/** The modder at work on the right: its stages one by one (the paper's), the rule written, then sent back. */
function modder(t, hx, hy) {
  const inA = smooth((t - 10.9) / 0.5) * (1 - smooth((t - 17.6) / 0.5))
  if (inA <= 0.01) return
  const px = 1500 + 420 * (1 - easeBack((t - 10.9) / 0.5)), py = 230
  ctx.globalAlpha = inA
  ctx.save(); ctx.shadowColor = 'rgba(15,23,42,0.12)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8
  box(px, py, 380, 640, 22, C.card, null)
  ctx.restore(); ctx.globalAlpha = inA
  box(px, py, 380, 640, 22, null, C.amber, 2.5)
  text(L('the modder', 'modder'), px + 26, py + 40, 26, C.ink, { weight: 700 })
  text(L('≈ 10 s · $0.05', '约 10 秒 · $0.05'), px + 354, py + 40, 20, C.muted, { align: 'right' })
  STAGES.forEach(([s, what], k) => {
    const t0 = 11.7 + k * 1.0, on = smooth((t - t0) / 0.2), done = t > t0 + 0.95
    const y = py + 100 + k * 72
    box(px + 22, y - 26, 336, 58, 12, done ? C.amberSoft : on > 0 ? '#fffaf2' : '#f8fafc', done || on > 0 ? C.amber : C.line, 2)
    text(s, px + 40, y - 6, 22, done || on > 0 ? '#8a4b06' : C.faint, { weight: 700 })
    ctx.globalAlpha = inA * (0.4 + 0.6 * on); text(what, px + 40, y + 16, 17, C.muted); ctx.globalAlpha = inA
    if (on > 0 && !done) { const u = clamp((t - t0) / 0.95); box(px + 22, y + 28, 336 * u, 4, 2, C.amber, null) }
    if (done) text('✓', px + 336, y - 2, 24, C.amber, { weight: 800, align: 'center' })
  })
  // the rule, typed as it is designed
  const typed = clamp((t - 13.8) / 1.0)
  const all = CODE.join('\n'), shown = all.slice(0, Math.floor(all.length * typed)).split('\n')
  box(px + 22, py + 470, 336, 120, 12, '#2a1804', null)
  shown.forEach((ln, n) => text(ln, px + 40, py + 505 + n * 36, 22, '#ffdcab', { mono: true }))
  ctx.globalAlpha = 1
  // the request in, the rule out
  if (t >= 11.0 && t < 11.7) { const u = ease((t - 11.0) / 0.7); token(lerp(hx, px + 190, u), lerp(hy, py + 100, u), L('request', '请求'), C.amber) }
  if (t >= 16.8 && t < 17.4) { const u = ease((t - 16.8) / 0.6); token(lerp(px + 190, hx, u), lerp(py + 530, hy, u), 'wait_by(fire)', C.amber) }
}

const CHECKS = [L('schema', '格式'), L('ontology', '本体'), L('locality', '只写自己'), L('sandbox replay', '沙盒重放'), L('auditor', '对抗审查')]
/** The checks a rule passes before it is set (the paper's), ticked one by one beside the leaf. */
function checks(t, hx, hy) {
  const a = smooth((t - 17.4) / 0.3) * (1 - smooth((t - 22.6) / 0.3))
  const x = hx + 160, y = hy - 110
  ctx.globalAlpha = a
  box(x, y, 300, 250, 16, C.card, C.line, 2)
  label(L('checked before it is kept', '保留之前的检查'), x + 22, y + 30)
  CHECKS.forEach((c, k) => {
    const on = smooth((t - (17.6 + k * 0.32)) / 0.15)
    ctx.globalAlpha = a * (0.35 + 0.65 * on)
    text(on > 0.5 ? '✓' : '·', x + 34, y + 72 + k * 36, 24, on > 0.5 ? C.green : C.faint, { weight: 800, align: 'center' })
    text(c, x + 60, y + 72 + k * 36, 22, C.ink)
  })
  ctx.globalAlpha = 1
}

/** The first players' windows, drawn large before the grid fills: clips shot large. */
const FIRST = ['theft', 'market', 'tree', 'gate']
/** Learned once, for everyone: more players meet it and run it; acts by thousands, hardly a call. */
function actThree(t) {
  const a = smooth((t - 22.8) / 0.4)
  if (a <= 0.01) return
  // the windows of more and more players, on the left
  const doublings = clamp(Math.floor((t - 23.1) / 0.5) + 1, 0, 6), n = 1 << doublings
  const cols = Math.ceil(Math.sqrt(n * 1.6)), rows = Math.ceil(n / cols)
  const area = { x: 90, y: 230, w: 720, h: 520 }
  const cw = area.w / cols, ch = area.h / rows
  for (let i = 0; i < n; i++) {
    const r = { x: area.x + (i % cols) * cw + 4, y: area.y + Math.floor(i / cols) * ch + 4, w: cw - 8, h: ch - 8 }
    const id = FIRST[i] ?? USED[Math.floor(hash(i * 7 + 1) * USED.length)]
    world(r, id, (t * FPS + hash(i) * 60) % clipsInfo[id].frames, a * smooth((t - (23.1 + (Math.log2(Math.max(1, i)) | 0) * 0.5)) / 0.3))
  }
  label(L('players', '玩家'), area.x, area.y - 34, a)
  // the rules: the tree, its learned leaf lit; new situations grow leaves of their own now and then
  const nodes = { ...STUCK, hole: { ...STUCK.hole, words: 'wait_by(fire)', kind: 'learned' } }
  const pts = pathPts(nodes, ['root', 'fire', 'wet', 'hole'])
  // tokens streaming from the players into the rules, down a rule already there
  for (let k = 0; k < 160; k++) {
    const t0 = 23.4 + 6.4 * Math.pow(k / 160, 0.6)
    const u = (t - t0) / 0.7
    if (u < 0 || u > 1) continue
    const i = Math.floor(hash(k * 3) * n), sx = area.x + (i % cols) * cw + cw / 2, sy = area.y + Math.floor(i / cols) * ch + ch / 2
    const [x, y] = u < 0.35 ? [lerp(sx, pts[0][0], ease(u / 0.35)), lerp(sy, pts[0][1], ease(u / 0.35))] : along(pts, (u - 0.35) / 0.65)
    ctx.globalAlpha = a * 0.85 * smooth(u / 0.08)
    const g = ctx.createRadialGradient(x, y, 0, x, y, 12); g.addColorStop(0, C.blue); g.addColorStop(1, C.blue + '00')
    ctx.fillStyle = g; ctx.fillRect(x - 12, y - 12, 24, 24)
  }
  ctx.globalAlpha = 1
  const extra = [[26.2, 'walk', TX + 340, 730, 'wade_in()'], [27.6, 'root', TX + 420, 410, 'shelter()']]
  for (const [t0, from, x, y, w] of extra) if (t > t0) {
    const k = smooth((t - t0) / 0.4), A = nodes[from]
    ctx.globalAlpha = a; ctx.strokeStyle = C.amber; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(A.x, A.y + 26)
    const ex = lerp(A.x, x, k), ey = lerp(A.y + 26, y - 29, k)
    ctx.bezierCurveTo(A.x, A.y + 70, ex, ey - 44 * k, ex, ey); ctx.stroke()
  }
  tree(nodes, STUCK_LINKS, litSet(['root', 'fire', 'wet', 'hole'], 3), a)
  for (const [t0, , x, y, w] of extra) if (t > t0) {
    ctx.globalAlpha = a * smooth((t - t0 - 0.25) / 0.3)
    ctx.font = `600 26px ${MONO}`; const ww = ctx.measureText(w).width + 44
    box(x - ww / 2, y - 29, ww, 58, 10, C.amber, C.amber, 2.5)
    text(w, x, y + 1, 26, '#fff', { mono: true, weight: 600, align: 'center' })
  }
  ctx.globalAlpha = 1
  // acts counted
  const acts = Math.round(Math.pow(clamp((t - 23.2) / 6.4), 2.2) * 48000)
  ctx.globalAlpha = a
  box(1560, 190 - DY, 300, 110, 18, C.card, C.line, 2)
  label(L('acts', '行动'), 1590, 222 - DY)
  text(acts.toLocaleString('en'), 1590, 270 - DY, 52, C.blue, { weight: 800 })
  ctx.globalAlpha = smooth((t - 23.4) / 0.3) * a
  text(L('the next to meet it runs the rule: no call', '下一个遇到的人直接运行规则：不再调用模型'), 90, 820, 30, C.ink, { weight: 600 })
  ctx.globalAlpha = 1
}

// ------------------------------------------------------------------ the video, the page

if (VIDEO) {
  document.body.classList.add('video'); document.body.classList.remove('loading')
  window.stage = {
    fps: FPS, frames: LENGTH * FPS,
    shots: [{ id: 'answers', start: 0, frames: 8.8 * FPS }, { id: 'asks', start: 8.8 * FPS, frames: (23 - 8.8) * FPS }, { id: 'shared', start: 23 * FPS, frames: (LENGTH - 23) * FPS }],
    cues: [
      { at: 1.0, file: 'Sounds/Menu/Move1.wav', vol: 0.3 }, { at: 2.5, file: 'Sounds/Menu/Accept2.wav', vol: 0.4 }, { at: 3.0, file: 'Sounds/Elemental/Water5.wav', vol: 0.35 },
      ...[0, 1, 2].map((q) => ({ at: 4.4 + q * 1.4 + 0.15 + 0.3 + 0.41, file: 'Sounds/Menu/Accept2.wav', vol: 0.25 })),
      { at: 10.8, file: 'Sounds/Magic & Skill/Strange.wav', vol: 0.5 },
      ...[0, 1, 2, 3, 4].map((k) => ({ at: 11.7 + k + 0.95, file: 'Sounds/Menu/Accept.wav', vol: 0.3 })),
      ...Array.from({ length: 8 }, (_, n) => ({ at: 13.8 + n * 0.12, file: 'Sounds/Menu/Move1.wav', vol: 0.12 })),
      ...[0, 1, 2, 3, 4].map((k) => ({ at: 17.6 + k * 0.32 + 0.1, file: 'Sounds/Menu/Move2.wav', vol: 0.25 })),
      { at: 16.8, file: 'Sounds/Bonus/Bonus.wav', vol: 0.35 },
    ],
    music: { file: 'Musics/27 - Chill.ogg', at: 0, from: 0, fadeOut: [LENGTH - 1.6, LENGTH] },
    ready: loadClips(USED),
    render: async (f) => film(f / FPS),
  }
  await window.stage.ready
  film(Number(params.get('t') ?? 12))
}

if (!VIDEO) {
  // the film starts on its first clip; the others come in the order it needs them
  await loadClips(USED.slice(0, 1))
  ;(async () => { for (const id of USED.slice(1)) await loadClips([id]) })()
  document.body.classList.remove('loading')
  const buttons = [...document.querySelectorAll('[data-from]')].slice(1)
  // the chapter playing, marked
  const mark = (t) => buttons.forEach((b, i) => b.classList.toggle('on', t >= Number(b.dataset.from) && (i === buttons.length - 1 || t < Number(buttons[i + 1].dataset.from))))
  const player = playLoop((t) => { film(t); mark(t) }, LENGTH)
  document.querySelectorAll('[data-from]').forEach((b) => (b.onclick = () => player.seek(Number(b.dataset.from))))
}
