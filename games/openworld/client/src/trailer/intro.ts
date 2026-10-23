// The channel's opening (a voiceover of 30 s, its words in SUBS): the open world's promise — a mountain one can
// climb, a chair one cannot sit on —, the little the developers wrote, the emptiness after; then the same chair with
// the world's logic made anew (it works out a rule and keeps it), the editor where anyone takes part, the paper.
// Every shot is timed to the voice; the chair at the top of Cloudtop (`summit`) is the one the map already has.
// Played by the stage at ?film=intro; taken by site/video/export.mjs (--url …/trailer.html?film=intro), the voice mixed
// by encode.mjs (--voice).
// The editor's footage is taken first by site/video/editor.mjs into public/world/trailer-editor/ (not committed).
import type { Cut, Learning, Shot } from './film.ts'
import { code, corner, drawLearning, head, iconOf, learningHeld } from './film.ts'
import { along, line, now, once, place, pose, puppet, remove, sky, vfx } from './kit.ts'
import { type Overlay, clamp, easeOut, ramp } from './overlay.ts'

const lerp = (a: number, b: number, x: number) => a + (b - a) * x
const P = 'player'

// ------------------------------------------------------------------ the voice, line by line

/** The voiceover's lines and when each is said (seconds into the film). */
const SUBS: [number, number, string][] = [
  [0.0, 2.37, '你看到那座山了吗？你可以爬上去'],
  [2.82, 4.44, '然后你看到了一把椅子'],
  [4.7, 6.36, '你想坐上去，但是你不能'],
  [6.36, 9.18, '你只能玩开发者事先规定好的内容'],
  [9.18, 11.85, '并不能随心所欲地做想做的任何事情'],
  [12.41, 14.28, '所以在巨大的新鲜感之后'],
  [14.28, 16.39, '我更多感受到的是空虚'],
  [16.94, 19.27, '开放世界似乎本身并不开放'],
  [19.73, 23.29, '所以我们斥巨资重新设计了开放世界的底层逻辑'],
  [23.66, 26.02, '并且你也有机会参与到这个过程中来'],
  [26.02, 27.22, '获得论文的署名'],
  [27.83, 29.92, '我是希可死，欢迎来到我的频道'],
]

function subtitle(o: Overlay, t: number): void {
  const s = SUBS.find(([a, b]) => t >= a && t < b + 0.15)
  if (s) o.raw(`<div class="in-sub">${s[2]}</div>`)
}

// ------------------------------------------------------------------ what several shots use

/** A key pressed, as a keycap over someone (screen px). */
function keycap(o: Overlay, x: number, y: number, key: string, alpha: number, press: number): void {
  if (alpha <= 0.001) return
  o.raw(`<div class="in-key" style="left:${x}px;top:${y}px;opacity:${alpha};transform:translate(-50%,-100%) translateY(${4 * press}px)">${key}</div>`)
}

/** The world drained of colour but for the holes (screen px, radius): what may be done shows through. */
function drain(o: Overlay, amount: number, holes: { x: number; y: number; r: number }[]): void {
  if (amount <= 0.001) return
  const circles = holes.map((h) => `<circle cx='${h.x.toFixed(0)}' cy='${h.y.toFixed(0)}' r='${h.r.toFixed(0)}'/>`).join('')
  // a mask is its alpha: the holes are cut out of a white sheet by a luminance mask inside the svg
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080'><defs><filter id='b'><feGaussianBlur stdDeviation='12'/></filter><mask id='m'><rect width='1920' height='1080' fill='white'/><g fill='black' filter='url(#b)'>${circles}</g></mask></defs><rect width='1920' height='1080' fill='white' mask='url(#m)'/></svg>`
  // in a style attribute: quoted with ' (the svg's own quotes are escaped)
  const url = `url('data:image/svg+xml;utf8,${encodeURIComponent(svg).replace(/'/g, '%27')}')`
  const mask = `-webkit-mask-image:${url};mask-image:${url}`
  o.raw(`<div class="in-drain" style="opacity:${amount};${mask}"></div><div class="in-dim" style="opacity:${amount * 0.5};${mask}"></div>`)
}

/** The world's own answer to E on a thing: what the action prompt would say, and whether anything is written for it. */
function handsPlan(c: Cut, id: string): { defined: boolean; label: string } | undefined {
  const e = c.eng.world.get(id)
  const at = e && c.eng.world.posOf(e)
  if (!at) return undefined
  // the controls' own planning (private: the stage looks in, as the dev console does)
  const controls = c.eng.controls as unknown as { make(key: string, at: unknown, verb: string, target: unknown, instrument: unknown): { unknown?: boolean; changes?: boolean; label: { zh?: string; en: string } } }
  const loose = c.eng.world.isLoose(e)
  const plan = controls.make(loose ? 'take' : 'hands', at, loose ? 'take' : 'hands', { e: id }, undefined)
  return { defined: !plan.unknown && !!plan.changes, label: plan.label.zh ?? plan.label.en }
}

/** No companion at one's side (the lonely shots). */
function alone(c: Cut): void {
  for (const e of c.eng.world.entitiesOnMap(c.shot.map)) if (typeof e.props?.companion === 'string') remove(c, e.id)
}

/** Someone bumping into what will not let them by: a lean toward it and back. */
const bumpAt = (t: number, at: number) => Math.sin(Math.PI * clamp((t - at) / 0.22)) * 0.22

const CSS = `
.in-sub { left: 0; right: 0; bottom: 64px; text-align: center; font: 700 54px/1.3 'Microsoft YaHei', 'PingFang SC', sans-serif; color: #fff; letter-spacing: 0.04em;
  text-shadow: 0 0 2px #000, 0 0 2px #000, 0 2px 0 #000, 2px 0 0 #000, -2px 0 0 #000, 0 -2px 0 #000, 0 4px 18px rgba(0,0,0,0.6); }
.in-key { min-width: 46px; padding: 6px 10px 8px; background: #f4efe2; color: #3a2a1a; border-radius: 9px; font: 700 30px/1 'Pixelify Sans', 'Segoe UI', sans-serif; text-align: center; box-shadow: 0 5px 0 #8a7a5c, 0 8px 18px rgba(0,0,0,0.4); }
.in-drain { inset: 0; background: #808080; mix-blend-mode: saturation; }
.in-dim { inset: 0; background: #000; }
.in-tag { transform: translate(-50%, -100%); display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: rgba(255,255,255,0.96); border-radius: 999px; font: 700 26px/1 'Microsoft YaHei', sans-serif; color: #222; box-shadow: 0 6px 20px rgba(0,0,0,0.35); white-space: nowrap; }
.in-tag b { font: 700 22px/1 'Pixelify Sans', sans-serif; background: #f4efe2; color: #3a2a1a; border-radius: 6px; padding: 3px 8px; box-shadow: 0 3px 0 #8a7a5c; }
.in-wall { border-radius: 999px; background: repeating-linear-gradient(0deg, rgba(190,225,255,0.9) 0 3px, rgba(190,225,255,0.25) 3px 14px); box-shadow: 0 0 24px 8px rgba(150,200,255,0.55); -webkit-mask-image: linear-gradient(transparent, #000 25%, #000 75%, transparent); }
.in-screen { inset: 0; background: #0d1015; }
.in-screen img { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
.in-paper { left: 50%; top: 50%; width: 700px; height: 900px; background: #fbfaf7; border-radius: 6px; box-shadow: 0 30px 80px rgba(0,0,0,0.6); padding: 80px 70px; box-sizing: border-box; }
.in-paper .bar { height: 26px; border-radius: 6px; background: #d9d6cf; margin: 0 auto 18px; }
.in-paper .authors { display: flex; justify-content: center; flex-wrap: wrap; gap: 14px; margin: 46px 0 56px; }
.in-paper .authors i { display: block; width: 104px; height: 22px; border-radius: 11px; background: #cfcbc2; }
.in-paper .authors i.you { background: transparent; border: 3px dashed #2563eb; box-shadow: 0 0 0 6px rgba(37,99,235,0.15); }
.in-paper .line { height: 14px; border-radius: 7px; background: #e6e3dc; margin-bottom: 16px; }
.in-card { left: 50%; top: 46%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 44px; }
.in-card .avatar { width: 220px; height: 220px; border-radius: 50%; background: rgba(255,255,255,0.18); border: 4px dashed rgba(255,255,255,0.55); }
.in-card .name { width: 520px; height: 64px; border-radius: 12px; background: rgba(255,255,255,0.22); }
.in-card .sub { width: 360px; height: 30px; border-radius: 8px; background: rgba(255,255,255,0.14); margin-top: 22px; }
`
let styled = false
function style(): void {
  if (styled) return
  styled = true
  const s = document.createElement('style')
  s.textContent = CSS
  document.head.append(s)
}

// ------------------------------------------------------------------ the mountain (0 – 2.82)

const range: Shot = {
  id: 'range', seconds: 1.3, map: 'overworld', at: [7, 5], hour: 9.5,
  edit: (f) => sky(f, 9.5),
  // toward the range in the world map's corner (Cloudtop is its site at 7,3), never past the map's edge
  camera: (c) => { const x = easeOut(ramp(c.t, 0, 1.3)); return { x: lerp(17, 13, x), y: lerp(10, 7.4, x), zoom: lerp(3.6, 4.6, x) } },
  overlay: (o, c) => o.wash('#000', 1 - ramp(c.t, 0, 0.3)),
}
const UP_THE_PATH = line([20, 14], [20, 6])
const climb: Shot = {
  id: 'climb', seconds: 1.52, map: 'foot', at: [20, 14], hour: 9.5, facing: 'up',
  tick: (c) => { const a = along(UP_THE_PATH, 0, 0.17, c.t + 0.1); place(c, P, a.x, a.y, 'up') },
  edit: (f) => sky(f, 9.5),
  camera: (c) => { const x = ramp(c.t, 0, 1.52); return { x: 20.5, y: lerp(11, 7, x), zoom: lerp(4.2, 3.8, x) } },
}

// ------------------------------------------------------------------ the chair, and nothing (2.82 – 6.36)

const CHAIR = { x: 12, y: 4 }
const TO_CHAIR = [...line([10, 11], [10, 4]), [11, 4]] as [number, number][]
const PRESS = 2.0
const chair: Shot = {
  id: 'chair', seconds: 3.54, map: 'summit', at: [10, 11], hour: 10.5,
  tick: (c) => { const a = along(TO_CHAIR, 0, 0.18, c.t); place(c, P, a.x, a.y, c.t > 1.5 ? 'right' : a.facing) },
  edit: (f, c) => { sky(f, 10.5); if (now(c, 0.3)) vfx(f, 'sparkle', CHAIR.x, CHAIR.y) },
  camera: (c) => { const x = easeOut(ramp(c.t, 0, 2.9)); return { x: lerp(11.5, 11.9, x), y: lerp(6.5, 4.6, x), zoom: lerp(4.6, 6.6, x) } },
  overlay: (o, c) => {
    const h = head(c, P)
    if (!h) return
    keycap(o, h.x, h.y - 14, 'E', ramp(c.t, PRESS, PRESS + 0.06) * (1 - ramp(c.t, PRESS + 0.5, PRESS + 0.6)), ramp(c.t, PRESS + 0.05, PRESS + 0.1) * (1 - ramp(c.t, PRESS + 0.15, PRESS + 0.25)))
    o.emote(h.x, h.y - 10, '…', ramp(c.t, 2.85, 2.95), ramp(c.t, 2.85, 3.1))
  },
}

// ------------------------------------------------------------------ what was written for us (6.36 – 9.18)

const VIEW = { x: 21.5, y: 14.2, zoom: 3.2 }
const defined: Shot = {
  id: 'defined', seconds: 2.82, map: 'meadow', at: [21, 17], hour: 10.5, warm: 40,
  setup: (c) => {
    // what E would do to each thing in view, by the world's own rules (no AI)
    const w = c.eng.world
    const marks: { id: string; label: string }[] = []
    for (const e of w.entitiesOnMap('meadow')) {
      const p = w.posOf(e)
      if (!p || Math.abs(p.x + 0.5 - VIEW.x) > 13 || Math.abs(p.y + 0.5 - VIEW.y) > 7.5 || e.id === w.state.player) continue
      const plan = handsPlan(c, e.id)
      if (!plan?.defined) continue
      marks.push({ id: e.id, label: plan.label })
    }
    c.memo.marks = marks
  },
  edit: (f) => sky(f, 10.5),
  camera: (c) => ({ x: VIEW.x, y: lerp(VIEW.y, VIEW.y - 0.4, c.t / 2.82), zoom: lerp(VIEW.zoom, VIEW.zoom + 0.15, c.t / 2.82) }),
  overlay: (o, c) => {
    const marks = c.memo.marks as { id: string; label: string }[]
    const r = 16 * c.scene.zoom * 1.15
    const holes = marks.map((m) => { const s = c.scene.screenOf(m.id); return s && { x: s.x, y: s.y - r * 0.5, r } }).filter((h): h is { x: number; y: number; r: number } => !!h)
    drain(o, ramp(c.t, 0.2, 0.7), holes)
    // the labels, a few at a time, nearest the middle first
    const near = holes.map((h, i) => ({ h, m: marks[i], d: Math.hypot(h.x - 960, h.y - 520) })).sort((a, b) => a.d - b.d)
    const shown: typeof near = []
    for (const n of near) if (shown.length < 7 && n.h.x > 200 && n.h.x < 1720 && n.h.y > 140 && n.h.y < 860 && shown.every((s) => Math.abs(s.h.x - n.h.x) > 300 || Math.abs(s.h.y - n.h.y) > 70)) shown.push(n)
    shown.forEach(({ h, m }, i) => {
      const a = ramp(c.t, 0.6 + i * 0.15, 0.7 + i * 0.15)
      if (a > 0.001) o.raw(`<div class="in-tag" style="left:${h.x}px;top:${h.y - h.r * 0.9 - 14 * easeOut(a)}px;opacity:${a}"><b>E</b>${m.label}</div>`)
    })
  },
}

// ------------------------------------------------------------------ three things no one wrote, and nothing each time (9.18 – 12.41)

function nothing(o: { id: string; map: string; at: [number, number]; target: [number, number]; facing: 'left' | 'right'; hour: number; item: string; held?: { held: string; heldTags: string[] }; setup(c: Cut): string | undefined }): Shot {
  const T = 3.23 / 3
  return {
    id: o.id, seconds: T, map: o.map, at: o.at, hour: o.hour, facing: o.facing,
    setup: (c) => { place(c, P, o.at[0], o.at[1], o.facing); c.memo.who = o.setup(c) },
    edit: (f) => { sky(f, o.hour); if (o.held) pose(f, P, o.held as never) },
    camera: (c) => ({ x: (o.at[0] + o.target[0]) / 2 + 0.5, y: o.at[1] + 0.1, zoom: lerp(5.4, 5.9, c.t / T) }),
    overlay: (ov, c) => {
      const h = head(c, P)
      if (!h) return
      const lift = ramp(c.t, 0.05, 0.18) * (1 - ramp(c.t, 0.45, 0.6))
      ov.icon(h.x, h.y - 6 - 10 * lift, iconOf(c, o.item), c.scene.zoom * 1.1, lift, lift * 0.6)
      const who = c.memo.who as string | undefined
      const t = who ? head(c, who) : undefined
      const s = t ?? (() => { const p = c.scene.screenOfTile(o.target[0], o.target[1]); return { x: p.x, y: p.y - 20 } })()
      ov.emote(s.x, s.y - 8, '…', ramp(c.t, 0.5, 0.57), ramp(c.t, 0.5, 0.7))
    },
  }
}
const tries: Shot[] = [
  nothing({ id: 'no-torch', map: 'forest', at: [20, 13], target: [21, 13], facing: 'right', hour: 16.5, item: 'item:torch', held: { held: 'item:torch', heldTags: ['light'] },
    setup: (c) => puppet(c, 'actor/creature/slime/green_slime', [21, 13], { facing: 'left' }) }),
  nothing({ id: 'no-bread', map: 'pasture', at: [24, 12], target: [25, 12], facing: 'right', hour: 10, item: 'item:bread',
    setup: (c) => puppet(c, 'actor/creature/animal/chicken', [25, 12], { facing: 'left' }) }),
  nothing({ id: 'no-bone', map: 'meadow', at: [25, 25], target: [26, 25], facing: 'right', hour: 8.2, item: 'item:bone', setup: () => undefined }),
]

// ------------------------------------------------------------------ the emptiness after (12.41 – 16.94)

const empty: Shot = {
  id: 'empty', seconds: 4.53, map: 'summit', at: [11, 5], hour: 17.5, facing: 'down',
  setup: (c) => { place(c, P, 11, 5, 'down'); alone(c) },
  edit: (f, c) => sky(f, lerp(17.6, 20.2, c.t / 4.53)),
  camera: (c) => { const x = easeOut(ramp(c.t, 0, 4.53)); return { x: lerp(11.8, 20, x), y: lerp(5, 11.5, x), zoom: Math.exp(lerp(Math.log(5.4), Math.log(3.05), x)) } },
  overlay: (o, c) => { o.hold(0.35 * ramp(c.t, 0.6, 3.9)); o.vignette(ramp(c.t, 0, 3.7)) },
}

// ------------------------------------------------------------------ the edge of it (16.94 – 19.73)

// out on the open snow of the plateau, a wall no one can see
const EDGE: [number, number] = [29, 13]
const BUMPS = [0.9, 1.45, 2.0]
const edge: Shot = {
  id: 'edge', seconds: 2.79, map: 'summit', at: [24, 13], hour: 18.6, facing: 'right',
  setup: alone,
  tick: (c) => { const a = along(line([24, 13], EDGE), 0, 0.15, c.t + 0.1); place(c, P, a.x, a.y, 'right') },
  edit: (f, c) => {
    sky(f, 18.6)
    const lean = BUMPS.reduce((s, b) => s + bumpAt(c.t, b), 0)
    const p = f.entities.find((e) => e.id === P)
    if (p && c.t > 0.85) p.x = EDGE[0] + lean
    for (const b of BUMPS) if (now(c, b + 0.1)) vfx(f, 'dust', EDGE[0], EDGE[1])
  },
  camera: (c) => ({ x: lerp(27.6, 28.6, ramp(c.t, 0, 0.9)), y: 12.7, zoom: lerp(4.6, 5.0, c.t / 2.79) }),
  overlay: (o, c) => {
    o.hold(0.2)
    o.vignette(0.8)
    // the wall: where the next cell would be, seen only as it is struck
    const a = c.scene.screenOfTile(EDGE[0], EDGE[1]), b = c.scene.screenOfTile(EDGE[0] + 1, EDGE[1])
    const x = (a.x + b.x) / 2, tile = b.x - a.x
    const flash = BUMPS.reduce((m, t) => Math.max(m, c.t < t + 0.1 ? 0 : Math.exp(-(c.t - t - 0.1) * 5)), 0)
    o.raw(`<div class="in-wall" style="left:${x - tile * 0.2}px;top:${a.y - tile * 5}px;width:${tile * 0.4}px;height:${tile * 10}px;opacity:${0.2 * ramp(c.t, 0.8, 0.9) + flash}"></div>`)
    const h = head(c, P)
    if (h) o.emote(h.x, h.y - 10, '?', ramp(c.t, 2.3, 2.35), ramp(c.t, 2.3, 2.5))
  },
}

// ------------------------------------------------------------------ the world made anew: the same chair (19.73 – 23.66)

const SIT: Learning = {
  actor: P, at: 0.35, from: 0, to: 1, item: '', mid: true,
  title: 'chair × hands',
  lines: code(['on  ', 'act/hands'], ['IF  ', 'host is ', 'furniture/chair'], ['DO  ', 'emit(', 'impulse/sit', ', actor)']),
}
const SAT = 2.35
const sit: Shot = {
  id: 'sit', seconds: 3.0, map: 'summit', at: [11, 4], hour: 11, facing: 'right',
  setup: (c) => place(c, P, CHAIR.x - 1, CHAIR.y, 'right'),
  still: (c) => learningHeld(SIT, c.t),
  tick: (c) => { if (once(c, 'sit', SAT)) place(c, P, CHAIR.x, CHAIR.y, 'right') },
  edit: (f, c) => {
    sky(f, 11)
    pose(f, P, { frozen: learningHeld(SIT, c.t) })
    if (now(c, SAT)) vfx(f, 'dust', CHAIR.x, CHAIR.y)
  },
  camera: (c) => ({ x: 12.2, y: lerp(4.3, 4.5, c.t / 3.0), zoom: lerp(5.8, 6.4, c.t / 3.0) }),
  // seated: the body drawn shorter on the seat
  before: (c) => {
    const v = (c.scene as unknown as { views: Map<string, { body: { setScale(x: number, y: number): void } }> }).views.get(P)
    v?.body.setScale(1, c.t >= SAT ? 0.82 : 1)
  },
  overlay: (o, c) => {
    const h = head(c, P)
    if (h) keycap(o, h.x, h.y - 14, 'E', ramp(c.t, 0.1, 0.16) * (1 - ramp(c.t, 0.4, 0.48)), ramp(c.t, 0.16, 0.21) * (1 - ramp(c.t, 0.26, 0.36)))
    // no thing is held up: the hand is empty
    drawLearning(o, c, SIT)
    if (h) o.emote(h.x, h.y - 10, '♥', ramp(c.t, SAT + 0.15, SAT + 0.22), ramp(c.t, SAT + 0.15, SAT + 0.4))
  },
}
const learned: Shot[] = [
  { ...corner('forge', 'emberfall', [31, 8], [28, 8], '✓ anvil × use · fish', 1, 318, 18), seconds: 0.465 },
  { ...corner('herd', 'pasture', [17, 13], [18, 14], '✓ cow × use · hat', 318, 12408, 15), seconds: 0.465 },
]

// ------------------------------------------------------------------ the editor: anyone takes part (23.66 – 26.02)

const SCREEN_DIR = `${import.meta.env.BASE_URL}world/trailer-editor/`
let screens: string[] = []
const editor: Shot = {
  id: 'editor', seconds: 2.36, map: 'overworld', at: [7, 7], hour: 12,
  ready: async () => {
    if (screens.length) return
    const list = (await fetch(`${SCREEN_DIR}frames.json`).then((r) => (r.ok ? r.json() : [])).catch(() => [])) as string[]
    screens = list.map((f) => `${SCREEN_DIR}${f}`)
    await Promise.all(screens.map((src) => { const i = new Image(); i.src = src; return i.decode().catch(() => {}) }))
  },
  camera: () => ({ x: 10, y: 9, zoom: 2.4 }),
  overlay: (o, c) => {
    const i = Math.min(screens.length - 1, Math.floor((c.t / 2.36) * screens.length))
    o.raw(`<div class="in-screen">${i >= 0 ? `<img src="${screens[i]}">` : ''}</div>`)
    o.wash('#fff', 0.5 * (1 - ramp(c.t, 0, 0.15)))
  },
}

// ------------------------------------------------------------------ the paper (26.02 – 27.83)

const paper: Shot = {
  id: 'paper', seconds: 1.81, map: 'overworld', at: [7, 7], hour: 12,
  camera: (c) => ({ x: 20, y: 14, zoom: 1.4 + 0.05 * c.t }),
  overlay: (o, c) => {
    o.wash('#0b0d10', 0.82)
    const rise = easeOut(ramp(c.t, 0, 0.5))
    const lines = Array.from({ length: 14 }, (_, i) => `<div class="line" style="width:${[100, 96, 99, 91, 97, 100, 88, 95, 99, 93, 100, 97, 84, 98, 92, 70][i]}%"></div>`).join('')
    o.raw(`<div class="in-paper" style="transform:translate(-50%, ${-50 + 12 * (1 - rise)}%) scale(${0.96 + 0.04 * rise});opacity:${rise}">
      <div class="bar" style="width:86%"></div><div class="bar" style="width:62%"></div>
      <div class="authors"><i></i><i></i><i></i><i></i><i></i><i class="you" style="opacity:${ramp(c.t, 0.6, 0.8)}"></i></div>${lines}</div>`)
  },
}

// ------------------------------------------------------------------ the channel (27.83 – 30.83)

const channel: Shot = {
  id: 'channel', seconds: 3.0, map: 'overworld', at: [7, 7], hour: 12,
  camera: (c) => ({ x: lerp(30, 32, c.t / 3.0), y: 23.6, zoom: lerp(1.0, 1.05, c.t / 3.0) }),
  overlay: (o, c) => {
    o.wash('#0b0d10', 0.62)
    o.vignette(1)
    const a = ramp(c.t, 0.05, 0.35)
    o.raw(`<div class="in-card" style="opacity:${a}"><div class="avatar"></div><div><div class="name"></div><div class="sub"></div></div></div>`)
    o.wash('#000', ramp(c.t, 2.4, 3.0))
  },
}

// ------------------------------------------------------------------ the film

const SHOTS: Shot[] = [range, climb, chair, defined, ...tries, empty, edge, sit, ...learned, editor, paper, channel]

/** Every shot with the voice's line under it (the film's time, not the shot's), and no sound of its own: the voice is
 * all one hears (no music; the corners borrowed from the trailer bring their sounds, left out here). */
export const INTRO_FILM: Shot[] = (() => {
  let start = 0
  return SHOTS.map((s) => {
    const at = start
    start += s.seconds
    return { ...s, sounds: undefined, overlay: (o: Overlay, c: Cut) => { style(); s.overlay?.(o, c); subtitle(o, at + c.t) } }
  })
})()
