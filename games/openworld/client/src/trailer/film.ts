// The trailer, shot by shot. Each shot is a world (a map, an hour, who stands where), what is done in it tick by
// tick, how its snapshot is dressed (the weather, the hour, someone held still), where the camera looks, and what
// is drawn over it. Times are seconds into the shot. The music (Adventure Begin, 105 bpm) comes in at 12 s on a bar
// line, and from there every shot is a bar or half of one.
import type { Dir, Frame, Game } from '@openworld/engine'
import { castNow } from '@openworld/modules'
import { createBoss, type decodeChunk } from '@openworld-game/content'
import type { WorldScene } from '@openworld/runtime/src/render/scene.ts'
import { CATALOG } from '../catalog.ts'
import { type CodeLine, type Overlay, easeOut, ramp } from './overlay.ts'
import { along, hold, line, now, once, place, pose, puppet, remove, sky, snap, vfx } from './kit.ts'

export interface Cut {
  shot: Shot
  game: Game
  eng: Game['engine']
  scene: WorldScene
  /** Frames and seconds into the shot. */
  k: number
  t: number
  frame: Frame
  /** What a shot keeps between its frames (ids it made, where someone was). */
  memo: Record<string, unknown>
}

/** A sound at a moment of the shot: [seconds, file under the pack's Audio/, volume, how long it may run (it fades out then)]. */
export type Cue = [number, string, number?, number?]

export interface Shot {
  id: string
  seconds: number
  map: string
  /** Where the player stands as the world is made. */
  at: [number, number]
  hour?: number
  facing?: Dir
  /** Ticks the world runs before the shot begins (people under way). */
  warm?: number
  /** The map's file changed before it is loaded (what stands where for this shot). */
  chunk?(chunk: ReturnType<typeof decodeChunk>): void
  setup?(c: Cut): void
  /** Waited for before the shot's first frame (a portrait's layers coming in). */
  ready?(c: Cut): Promise<void>
  /** Before each tick of the world. */
  tick?(c: Cut): void
  /** The world held: no ticks while this says so. */
  still?(c: Cut): boolean
  /** The snapshot dressed before it is drawn. */
  edit?(f: Frame, c: Cut): void
  camera(c: Cut): { x: number; y: number; zoom: number }
  /** Just before the frame is drawn: the scene's own pictures touched (someone rising out of the ground). */
  before?(c: Cut): void
  overlay?(o: Overlay, c: Cut): void
  sounds?: Cue[]
}

const BEAT = 60 / 105
const BAR = BEAT * 4
const lerp = (a: number, b: number, x: number) => a + (b - a) * x
const P = 'player'

// ------------------------------------------------------------------ pieces several shots use

const iconUrls = new Map<string, string>()
/** A thing's picture as the game draws it (its catalogue entry cut from the loaded texture). */
export function iconOf(c: Cut, key: string): string | undefined {
  if (iconUrls.has(key)) return iconUrls.get(key)
  const d = CATALOG.items[key]
  if (!d || !c.scene.textures.exists(d.img)) return undefined
  const canvas = document.createElement('canvas')
  canvas.width = d.w
  canvas.height = d.h
  canvas.getContext('2d')!.drawImage(c.scene.textures.get(d.img).getSourceImage() as HTMLImageElement, d.x, d.y, d.w, d.h, 0, 0, d.w, d.h)
  const url = canvas.toDataURL()
  iconUrls.set(key, url)
  return url
}

const portraits = new Map<string, string>()
/** Someone's portrait (the bust the dialogue shows), once it has been taken (`takePortrait`). */
const portraitOf = (_c: Cut, id: string) => portraits.get(id)
/** Wait for someone's portrait to be drawn (its layers come in one by one), then keep it. */
async function takePortrait(c: Cut, id: string): Promise<void> {
  if (portraits.has(id)) return
  const filled = (cv: HTMLCanvasElement) => {
    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data
    let n = 0
    for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++
    return n
  }
  let last = -1, same = 0
  for (let i = 0; i < 100; i++) {
    const cv = c.scene.portraitOf(id)
    const n = cv ? filled(cv) : 0
    // drawn, and no layer added for half a second
    if (n > 500 && n === last) { if (++same >= 5) { portraits.set(id, cv!.toDataURL()); return } } else same = 0
    last = n
    await new Promise((r) => setTimeout(r, 100))
  }
}

/** Someone coming up out of the ground: their picture grown from the feet, a little past full, then settled. */
export function rise(c: Cut, id: string | undefined, from: number, dur = 0.45, size = 1.35): void {
  const v = id ? (c.scene as unknown as { views: Map<string, { root: { setScale(x: number, y: number): void } }> }).views.get(id) : undefined
  if (!v) return
  const x = ramp(c.t, from, from + dur)
  const over = x < 1 ? 1.12 * easeOut(x / 0.8) : 1
  v.root.setScale(size * (1 + 0.08 * Math.sin(Math.min(1, x) * Math.PI)), size * (Math.min(over, 1.12) - (x >= 0.8 ? 0.12 * ramp(c.t, from + dur * 0.8, from + dur) : 0)))
}

/** Over someone's head, on screen. */
export const head = (c: Cut, id: string, up = 0) => { const p = c.scene.screenOf(id); return p ? { x: p.x, y: p.y - up } : undefined }

/** The one thing the trailer is about: an act no rule covers; the world stops, works out a rule, keeps it, goes on. */
export interface Learning {
  actor: string
  /** When the act is done (seconds into the shot). */
  at: number
  title: string
  lines: CodeLine[]
  /** The count of rules learned before and after. */
  from: number
  to: number
  item: string
  quick?: boolean
  /** Between the two: the whole pause in about two seconds. */
  mid?: boolean
}
const PACE = {
  slow: { lift: [-1.2, 0], hold: [0.2, 0.6], think: [0.4, 1.7], open: [1.2, 1.6], typed: [1.5, 3.6], stamp: 3.9, away: [4.5, 4.9], release: [4.6, 4.95] },
  mid: { lift: [-0.6, 0], hold: [0.06, 0.25], think: [0.15, 0.8], open: [0.55, 0.8], typed: [0.75, 1.45], stamp: 1.55, away: [1.75, 2.0], release: [1.75, 2.0] },
  quick: { lift: [-0.5, 0], hold: [0.04, 0.18], think: [0.1, 0.4], open: [0.16, 0.34], typed: [0.3, 0.9], stamp: 0.95, away: [1.1, 1.26], release: [1.1, 1.26] },
}
const pace = (l: Learning) => (l.mid ? PACE.mid : l.quick ? PACE.quick : PACE.slow)
/** Is the world held still for it now (the actor working it out)? */
export const learningHeld = (l: Learning, t: number) => { const p = pace(l); return t >= l.at + p.hold[0] && t < l.at + p.release[1] }
const learningHold = (l: Learning, t: number) => { const p = pace(l); return ramp(t, l.at + p.hold[0], l.at + p.hold[1]) * (1 - ramp(t, l.at + p.release[0], l.at + p.release[1])) }
export function drawLearning(o: Overlay, c: Cut, l: Learning): void {
  const p = pace(l), t = c.t - l.at
  o.hold(learningHold(l, c.t))
  const h = head(c, l.actor)
  if (!h) return
  // the thing held up as it is used
  const lift = ramp(t, p.lift[0], p.lift[1]) * (1 - ramp(t, 0.15, 0.35))
  o.icon(h.x, h.y - 6 - 10 * lift, iconOf(c, l.item), c.scene.zoom * 1.1, lift, lift * 0.8)
  o.thinking(h.x, h.y - 18, c.t, ramp(t, p.think[0], p.think[0] + 0.15) * (1 - ramp(t, p.think[1] - 0.15, p.think[1])))
  // the card: over the actor, then away to the count
  const away = ramp(t, p.away[0], p.away[1])
  const cx = lerp(h.x, 1780, away), cy = lerp(h.y - 30, 110, away)
  o.card({ x: cx, y: cy, open: ramp(t, p.open[0], p.open[1]), title: l.title, tag: 'new rule', lines: l.lines, typed: ramp(t, p.typed[0], p.typed[1]) ** 0.9, stamp: ramp(t, p.stamp, p.stamp + 0.25), scale: lerp(1, 0.15, away), alpha: 1 - ramp(t, p.away[1] - 0.08, p.away[1]) })
  o.tether(h.x, h.y - 30, h.x, h.y - 12, ramp(t, p.open[0], p.open[1]) * (1 - away))
  o.counter(t < p.away[1] ? l.from : l.to, l.from > 0 || t > p.away[0] ? 1 : 0)
}
export const learningSounds = (l: Learning): Cue[] => {
  const p = pace(l)
  const keys: Cue[] = []
  for (let s = p.typed[0]; s < p.typed[1]; s += l.quick ? 0.12 : 0.16) keys.push([l.at + s, 'Sounds/Menu/Move1.wav', 0.18])
  return [[l.at + p.hold[0], 'Sounds/Magic & Skill/Strange.wav', 0.7], [l.at + p.open[0], 'Sounds/Whoosh & Slash/Whoosh.wav', 0.35], ...keys, [l.at + p.stamp, 'Sounds/Menu/Accept.wav', 0.7], [l.at + p.away[0], 'Sounds/Magic & Skill/Magic1.wav', 0.4]]
}

export const code = (...lines: string[][]): CodeLine[] => lines.map((l) => l.map((s) => {
  // a word's kind by its look: keywords, calls, values, the rest plain
  if (/^(on|IF|DO|AND)\s*$/.test(s.trim()) && s.trim()) return [s, 'k'] as CodeLine[number]
  if (/^[a-z]+\($/.test(s)) return [s, 'f'] as CodeLine[number]
  if (/\//.test(s)) return [s, 'b'] as CodeLine[number]
  return [s, ''] as CodeLine[number]
}))

// ------------------------------------------------------------------ the hook: a bone in the soil

const BONE: Learning = {
  actor: P, at: 2.8, from: 0, to: 1, item: 'item:bone',
  title: 'farmland × use · bone',
  lines: code(['on  ', 'act/use', ' with ', 'item/material/bone'], ['IF  ', 'host is ', 'tile/farmland'], ['DO  ', 'spawn(', 'undead/skeleton', ')'], ['    ', 'vfx(', 'dust', ', ', 'smoke', ')']),
}
const HOOK_WALK = [...line([21, 27], [25, 27]), [25, 26], [25, 25]] as [number, number][]

const hook: Shot = {
  id: 'hook', seconds: 12, map: 'meadow', at: [22, 27], hour: 8.2, warm: 20,
  setup: (c) => {
    hold(c, 'npc.holt')
    place(c, 'npc.holt', 24, 22, 'down')
  },
  still: (c) => learningHeld(BONE, c.t),
  tick: (c) => {
    const a = along(HOOK_WALK, 0.6, 0.27, c.t)
    if (c.t < 8.2) place(c, P, a.x, a.y, c.t > 2.3 ? 'right' : a.facing)
    if (once(c, 'zombie', 7.85)) c.memo.z = puppet(c, 'actor/creature/undead/skeleton', [26, 25], { facing: 'left' })
    if (once(c, 'back', 8.2)) place(c, P, 24, 25, 'right')
    if (once(c, 'lurch', 9.7)) place(c, c.memo.z as string, 25, 25, 'left')
    if (once(c, 'back2', 10.2)) place(c, P, 23, 25, 'right')
  },
  edit: (f, c) => {
    sky(f, 8.2)
    pose(f, P, { frozen: learningHeld(BONE, c.t) })
    if (now(c, BONE.at + 0.2)) vfx(f, 'dust', 26, 25)
    if (now(c, 7.9)) for (const [x, y] of [[26, 25], [27, 25], [26, 24], [27, 24]]) (vfx(f, 'smoke', x, y), vfx(f, 'dust', x, y))
    if (now(c, 7.9)) vfx(f, 'shatter', 26, 25)
    if (now(c, 9.75)) vfx(f, 'dust', 25, 25)
  },
  camera: (c) => {
    const push = easeOut(ramp(c.t, 0, 7.5))
    // the reveal: a punch in on the soil, a shake, then easing back a little
    const punch = easeOut(ramp(c.t, 7.85, 8.05)) * (1 - 0.6 * ramp(c.t, 8.3, 11))
    const shake = c.t > 7.85 && c.t < 8.5 ? Math.sin(c.t * 95) * 0.09 * (8.5 - c.t) * 1.6 : 0
    return { x: lerp(23.6, 25.6, push) + 0.4 * punch + shake, y: lerp(25.6, 24.9, push) + shake * 0.5, zoom: lerp(3.3, 4.8, push) + 1.1 * punch }
  },
  before: (c) => rise(c, c.memo.z as string | undefined, 7.85),
  overlay: (o, c) => {
    drawLearning(o, c, BONE)
    const z = c.memo.z as string | undefined
    const p = head(c, P)
    if (p) o.emote(p.x, p.y - 10, '!', ramp(c.t, 8.05, 8.15) * (1 - ramp(c.t, 9.4, 9.6)), ramp(c.t, 8.05, 8.3))
    const hh = head(c, 'npc.holt')
    if (hh) o.emote(hh.x, hh.y - 10, '!', ramp(c.t, 8.3, 8.4) * (1 - ramp(c.t, 9.7, 9.9)), ramp(c.t, 8.3, 8.55))
    if (z) { const zp = head(c, z); if (zp) o.emote(zp.x, zp.y - 10, '…', ramp(c.t, 10.3, 10.4) * (1 - ramp(c.t, 11.1, 11.2)), ramp(c.t, 10.3, 10.5)) }
    o.letterbox(1)
    o.wash('#000', 1 - ramp(c.t, 0, 1.4) + ramp(c.t, 11.2, 11.95))
  },
  sounds: [[0, 'Sounds/Ambient/Wind.wav', 0.45, 12], [0.3, 'Sounds/Creature/Bird.wav', 0.35], [1.6, 'Sounds/Creature/Bird.wav', 0.25], [BONE.at + 0.2, 'Sounds/Hit & Impact/Impact.wav', 0.5], ...learningSounds(BONE), [7.85, 'Sounds/Hit & Impact/Impact4.wav', 0.9], [7.9, 'Sounds/Elemental/Explosion2.wav', 0.45], [8.1, 'Sounds/Alert/Alert2.wav', 0.5], [9.7, 'Sounds/Hit & Impact/Hit3.wav', 0.5]],
}

// ------------------------------------------------------------------ the title, over the land

const title: Shot = {
  id: 'title', seconds: BAR, map: 'overworld', at: [6, 6], hour: 12,
  camera: (c) => ({ x: lerp(23.5, 25.5, c.t / BAR), y: lerp(13.2, 13.9, c.t / BAR), zoom: lerp(2.6, 2.4, c.t / BAR) }),
  overlay: (o, c) => {
    o.wash('#0b0d10', 0.55)
    o.vignette(1)
    o.title({ alpha: 1 - ramp(c.t, BAR - 0.3, BAR), scale: 1 + 0.12 * (1 - easeOut(ramp(c.t, 0, 0.35))), kicker: 'A world whose rules are code', kickerAlpha: ramp(c.t, 0.5, 0.9) })
    o.wash('#fff', 0.8 * (1 - ramp(c.t, 0, 0.25)))
  },
  sounds: [[0, 'Sounds/Hit & Impact/Impact5.wav', 0.7]],
}

// ------------------------------------------------------------------ the game: a bar of each

const village: Shot = {
  id: 'village', seconds: BAR, map: 'meadow', at: [22, 15], hour: 10, warm: 40,
  edit: (f) => sky(f, 10),
  camera: (c) => { const x = ramp(c.t, 0, BAR); return { x: lerp(18.5, 24, x), y: lerp(11.5, 15.5, x), zoom: lerp(2.7, 3.1, x) } },
  overlay: (o, c) => o.wash('#000', 1 - ramp(c.t, 0, 0.12)),
}

/** Every crop in a box of cells brought to a stage of its own kind (fixture/crop/<kind>/<stage>). */
function grow(c: Cut, x0: number, y0: number, x1: number, y1: number, stage: string): void {
  const w = c.eng.world
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++)
    for (const e of w.placedAt(c.shot.map, x, y)) if (e.type.startsWith('fixture/crop/')) c.eng.author(() => w.transform(e, `fixture/crop/${e.type.split('/')[2]}/${stage}`))
}
const farm: Shot = {
  id: 'farm', seconds: BEAT * 2, map: 'mill', at: [21, 14], hour: 9,
  setup: (c) => grow(c, 23, 5, 32, 11, 'sprout'),
  tick: (c) => { for (const [stage, at] of [['young', 0.36], ['ripe', 0.74]] as const) if (once(c, stage, at)) grow(c, 23, 5, 32, 11, stage) },
  edit: (f, c) => {
    sky(f, lerp(9, 17.5, c.t / (BEAT * 2)))
    for (const at of [0.36, 0.74]) if (now(c, at)) for (let x = 23; x <= 32; x += 2) for (let y = 5; y <= 11; y += 2) vfx(f, 'leaves', x, y)
  },
  camera: (c) => ({ x: 24.2, y: 9.6, zoom: lerp(4.0, 4.3, c.t / (BEAT * 2)) }),
  sounds: [[0.36, 'Sounds/Elemental/Grass.wav', 0.5], [0.74, 'Sounds/Elemental/Grass2.wav', 0.5]],
}

const fish: Shot = {
  id: 'fish', seconds: BEAT * 2, map: 'reedbend', at: [30, 13], hour: 16, facing: 'right',
  setup: (c) => { place(c, P, 30, 13, 'right'); hold(c, 'npc.hilde'); place(c, 'npc.hilde', 27, 12, 'right') },
  edit: (f, c) => {
    sky(f, 16)
    if (now(c, 0.05)) vfx(f, 'splash', 32, 13)
    if (now(c, 0.62)) (vfx(f, 'splash', 32, 13), vfx(f, 'sparkle', 32, 13))
  },
  camera: (c) => ({ x: 26.4, y: 12.4, zoom: lerp(4.6, 4.9, c.t / (BEAT * 2)) }),
  overlay: (o, c) => {
    const h = head(c, P)
    if (h) o.icon(h.x + 30, h.y + 40, iconOf(c, 'item:rod'), c.scene.zoom * 1.2, 1)
    const s = c.scene.screenOfTile(32, 13)
    o.icon(s.x, s.y - 20 - 60 * easeOut(ramp(c.t, 0.62, 0.95)), iconOf(c, 'item:fish'), c.scene.zoom * 1.3, ramp(c.t, 0.62, 0.7), ramp(c.t, 0.62, 0.7) * 0.7)
  },
  sounds: [[0.05, 'Sounds/Elemental/Water2.wav', 0.6], [0.62, 'Sounds/Elemental/Water5.wav', 0.6], [0.66, 'Sounds/Bonus/Coin.wav', 0.35]],
}

const SNOW_WALK: [number, number][] = [[12, 11], [13, 11], [13, 12], [14, 12], [14, 13], [15, 13], [16, 13], [16, 14], [17, 14], [18, 14], [18, 15]]
const snow: Shot = {
  id: 'snow', seconds: BEAT * 2, map: 'summit', at: [12, 11], hour: 10,
  tick: (c) => { const a = along(SNOW_WALK, 0, 0.15, c.t + 0.3); place(c, P, a.x, a.y, a.facing) },
  edit: (f) => sky(f, 10),
  camera: (c) => ({ x: lerp(14.6, 17.4, c.t / (BEAT * 2)), y: lerp(11.8, 13.2, c.t / (BEAT * 2)), zoom: 4.6 }),
}

const fight: Shot = {
  id: 'fight', seconds: BEAT * 2, map: 'forest', at: [22, 6], hour: 15, facing: 'right',
  setup: (c) => {
    c.memo.s = puppet(c, 'actor/creature/slime/green_slime', [23, 6], { facing: 'left' })
    for (const at of [[26, 5], [21, 8]] as [number, number][]) puppet(c, 'actor/creature/slime/green_slime', at)
    place(c, P, 22, 6, 'right')
  },
  tick: (c) => { if (once(c, 'gone', 1.0)) remove(c, c.memo.s as string) },
  edit: (f, c) => {
    sky(f, 15)
    pose(f, P, { held: 'item:sword', heldTags: ['weapon'] } as never)
    for (const at of [0.08, 0.6]) if (now(c, at)) (f.fx.push({ t: 'vfx', fx: 'swing:right', map: f.map, x: 22, y: 6, who: P }), vfx(f, 'hit', 23, 6))
    if (now(c, 0.95)) (vfx(f, 'poof', 23, 6), vfx(f, 'sparkle', 23, 6))
    const s = snap(f, c.memo.s as string)
    if (s && c.t > 0.1) s.x = c.t > 0.6 ? 24 : 23
  },
  camera: (c) => ({ x: 22.8, y: 5.9, zoom: lerp(5.6, 6, c.t / (BEAT * 2)) }),
  overlay: (o, c) => {
    const s = c.scene.screenOfTile(23, 6)
    o.floater(s.x, s.y - 30, '12', c.t - 0.12)
    o.floater(s.x + 50, s.y - 30, '17', c.t - 0.64, '#ffd36a')
  },
  sounds: [[0.08, 'Sounds/Whoosh & Slash/Slash.wav', 0.6], [0.1, 'Sounds/Hit & Impact/Hit1.wav', 0.5], [0.6, 'Sounds/Whoosh & Slash/Slash3.wav', 0.6], [0.62, 'Sounds/Hit & Impact/Hit5.wav', 0.6], [0.95, 'Sounds/Bonus/Coin2.wav', 0.3]],
}

const ILSE_LINE = 'A traveller off the mountain, and a fairy at their shoulder. Welcome to Firstlight. Warm your hands — the flame was lit from the first dawn after the First Night.'
const talk: Shot = {
  id: 'talk', seconds: BAR, map: 'meadow', at: [23, 18], hour: 11, facing: 'up',
  setup: (c) => { hold(c, 'npc.ilse'); place(c, 'npc.ilse', 23, 16, 'down'); place(c, P, 23, 18, 'up') },
  ready: (c) => takePortrait(c, 'npc.ilse'),
  edit: (f) => sky(f, 11),
  camera: (c) => ({ x: 23.5, y: lerp(16.4, 16.7, c.t / BAR), zoom: lerp(4.3, 4.6, c.t / BAR) }),
  overlay: (o, c) => o.dialog({ name: 'Sister Ilse', text: ILSE_LINE, typed: ramp(c.t, 0.15, 2.0), portrait: portraitOf(c, 'npc.ilse'), alpha: ramp(c.t, 0, 0.1) }),
  sounds: [[0.05, 'Sounds/Menu/Menu5.wav', 0.4]],
}

const storm: Shot = {
  id: 'storm', seconds: BEAT * 2, map: 'dawnhill', at: [20, 13], hour: 17.6, facing: 'up',
  edit: (f, c) => {
    sky(f, 17.6, 'storm')
    if (now(c, 0.02)) f.fx.push({ t: 'strike', map: f.map, x: 26, y: 8 })
    if (now(c, 0.6)) f.fx.push({ t: 'strike', map: f.map, x: 14, y: 12 })
  },
  camera: (c) => ({ x: lerp(21, 20, c.t / (BEAT * 2)), y: 9.4, zoom: 4.0 }),
  overlay: (o, c) => {
    o.wash('#0a1024', 0.25)
    o.rain(c.t, 1)
    for (const s of [0.02, 0.6]) o.wash('#e8eeff', 0.6 * ramp(c.t, s, s + 0.03) * (1 - ramp(c.t, s + 0.05, s + 0.25)))
  },
  sounds: [[0, 'Sounds/Ambient/Storm.wav', 0.55, BEAT * 2], [0.02, 'Sounds/Elemental/Explosion5.wav', 0.6], [0.6, 'Sounds/Elemental/Explosion6.wav', 0.5]],
}

const NIGHT_WALK = line([18, 18], [24, 18])
const night: Shot = {
  id: 'night', seconds: BEAT * 2, map: 'meadow', at: [18, 18], hour: 22,
  setup: (c) => { puppet(c, 'actor/creature/undead/zombie', [28, 20], { facing: 'left' }); puppet(c, 'actor/creature/beast/bat', [26, 14]) },
  tick: (c) => { const a = along(NIGHT_WALK, 0, 0.19, c.t + 0.2); place(c, P, a.x, a.y, a.facing) },
  edit: (f) => { sky(f, 22); pose(f, P, { heldTags: ['light'], held: 'item:torch' } as never) },
  camera: (c) => ({ x: lerp(20.5, 23.5, c.t / (BEAT * 2)), y: 17.6, zoom: 3.8 }),
}

const ARENA = { map: 'sanctum', x: 12, y: 9, id: 'stage.boss' } as const
const boss: Shot = {
  id: 'boss', seconds: BAR, map: 'sanctum', at: [ARENA.x, ARENA.y + 4], hour: 14, facing: 'up',
  chunk: (chunk) => {
    chunk.entities = chunk.entities.filter((e) => !e.type.startsWith('actor/creature'))
    chunk.entities.push(createBoss('alberic', ARENA, ARENA.id))
    chunk.map.appear = []
  },
  setup: (c) => {
    const p = c.eng.world.player
    c.eng.author(() => c.eng.world.setProp(p, 'invulnerable', true))
    const b = c.eng.world.get(ARENA.id)!
    castNow(c.eng, b, 'thorns')
    for (let i = 0; i < 6; i++) c.eng.tick()
  },
  tick: (c) => {
    // the one at the keys gets out of the ring as it comes down
    if (once(c, 'dodge', 0.9)) place(c, P, ARENA.x + 1, ARENA.y + 5, 'up')
    if (once(c, 'dodge2', 1.2)) place(c, P, ARENA.x + 2, ARENA.y + 6, 'up')
  },
  edit: (f) => sky(f, 14),
  camera: (c) => ({ x: ARENA.x + 0.5, y: lerp(ARENA.y + 1.5, ARENA.y + 1.1, c.t / BAR), zoom: lerp(4.8, 5.2, c.t / BAR) }),
  overlay: (o, c) => o.wash('#fff', 0.6 * (1 - ramp(c.t, 0, 0.15))),
  sounds: [[0, 'Sounds/Hit & Impact/Impact2.wav', 0.6], [1.5, 'Sounds/Elemental/Explosion3.wav', 0.5]],
}

// ------------------------------------------------------------------ more of what no one wrote, quickly

const TORCH: Learning = {
  actor: P, at: 0.1, from: 1, to: 2, item: 'item:torch', quick: true,
  title: 'green_slime × use · torch',
  lines: code(['on  ', 'act/use', ' with ', 'item/light/torch'], ['DO  ', 'transform(', 'slime/fire_slime', ')'], ['    ', 'vfx(', 'fire_burst', ')']),
}
const torch: Shot = {
  id: 'torch', seconds: BAR, map: 'forest', at: [20, 13], hour: 16.5, facing: 'right',
  setup: (c) => { c.memo.s = puppet(c, 'actor/creature/slime/green_slime', [21, 13], { facing: 'left' }); place(c, P, 20, 13, 'right') },
  still: (c) => learningHeld(TORCH, c.t),
  tick: (c) => {
    const s = c.eng.world.get(c.memo.s as string)
    if (s && once(c, 'fire', TORCH.at + 1.18)) c.eng.author(() => c.eng.world.transform(s, 'actor/creature/slime/fire_slime'))
    if (once(c, 'hop1', 1.75)) place(c, c.memo.s as string, 22, 13, 'right')
    if (once(c, 'hop2', 2.05)) place(c, c.memo.s as string, 22, 12, 'up')
  },
  edit: (f, c) => {
    sky(f, 16.5)
    pose(f, P, { frozen: learningHeld(TORCH, c.t), heldTags: ['light'], held: 'item:torch' } as never)
    if (now(c, TORCH.at + 1.2)) (vfx(f, 'fire_burst', 21, 13), vfx(f, 'sparks', 21, 13))
  },
  camera: (c) => ({ x: 21, y: 12.6, zoom: lerp(4.8, 5.3, c.t / BAR) }),
  overlay: (o, c) => drawLearning(o, c, TORCH),
  sounds: [...learningSounds(TORCH), [TORCH.at + 1.2, 'Sounds/Elemental/Fireball.wav', 0.7]],
}

const BREAD: Learning = {
  actor: P, at: 0.1, from: 2, to: 3, item: 'item:bread', quick: true,
  title: 'chicken × use · bread',
  lines: code(['on  ', 'act/use', ' with ', 'item/food/bread'], ['DO  ', 'follow(', 'actor', ')'], ['    ', 'emote(', 'happy', ')']),
}
const LEAD = [...line([24, 12], [24, 15]), ...line([23, 15], [19, 15])] as [number, number][]
const bread: Shot = {
  id: 'bread', seconds: BAR, map: 'pasture', at: [24, 12], hour: 10, facing: 'right',
  setup: (c) => {
    place(c, P, 24, 12, 'right')
    c.memo.ch = puppet(c, 'actor/creature/animal/chicken', [25, 12], { facing: 'left' })
    c.memo.k1 = puppet(c, 'actor/creature/animal/chick', [26, 13], { facing: 'left' })
    c.memo.k2 = puppet(c, 'actor/creature/animal/chick', [26, 14], { facing: 'left' })
  },
  still: (c) => learningHeld(BREAD, c.t),
  tick: (c) => {
    const t0 = 1.35, per = 0.17
    if (c.t >= t0) {
      const a = along(LEAD, t0, per, c.t); place(c, P, a.x, a.y, a.facing)
      const trail = (id: string, lag: number, from: [number, number]) => {
        const path = [from, ...LEAD]
        const b = along(path, t0 + lag, per, c.t)
        place(c, id, b.x, b.y, b.facing)
      }
      trail(c.memo.ch as string, per * 1.2, [25, 12])
      trail(c.memo.k1 as string, per * 2.6, [26, 13])
      trail(c.memo.k2 as string, per * 3.8, [26, 14])
    }
  },
  edit: (f, c) => { sky(f, 10); pose(f, P, { frozen: learningHeld(BREAD, c.t) }) },
  camera: (c) => ({ x: lerp(24.6, 22.4, ramp(c.t, 1.2, BAR)), y: lerp(12.4, 13.8, ramp(c.t, 1.2, BAR)), zoom: lerp(5, 4.4, ramp(c.t, 1.2, BAR)) }),
  overlay: (o, c) => {
    drawLearning(o, c, BREAD)
    const h = head(c, c.memo.ch as string)
    if (h) o.emote(h.x, h.y - 6, '♥', ramp(c.t, 1.25, 1.35) * (1 - ramp(c.t, 2.0, 2.2)), ramp(c.t, 1.25, 1.5))
  },
  sounds: [...learningSounds(BREAD), [1.28, 'Sounds/Creature/Duck.wav', 0.5], [1.32, 'Sounds/Bonus/Bonus.wav', 0.35]],
}

// ------------------------------------------------------------------ the same act again: no pause now

const REPLAY_WALK = line([24, 26], [28, 26])
const replay: Shot = {
  id: 'replay', seconds: BAR, map: 'meadow', at: [20, 27], hour: 19.6, warm: 10,
  setup: (c) => { hold(c, 'npc.holt'); place(c, 'npc.holt', 24, 26, 'right') },
  tick: (c) => {
    if (c.t < 0.75) { const a = along(REPLAY_WALK, 0, 0.14, c.t); place(c, 'npc.holt', a.x, a.y, c.t > 0.55 ? 'up' : a.facing) }
    if (once(c, 'zombie', 0.8)) c.memo.z = puppet(c, 'actor/creature/undead/skeleton', [28, 25], { facing: 'down' })
    if (c.t > 1.05) { const a = along(line([28, 26], [22, 26]), 1.05, 0.12, c.t); place(c, 'npc.holt', a.x, a.y, 'left') }
    if (once(c, 'lurch', 1.6)) place(c, c.memo.z as string, 28, 26, 'left')
  },
  edit: (f, c) => {
    sky(f, 19.6)
    if (now(c, 0.65)) vfx(f, 'dust', 28, 25)
    if (now(c, 0.8)) (vfx(f, 'smoke', 28, 25), vfx(f, 'shatter', 28, 25))
  },
  camera: (c) => ({ x: lerp(27.4, 26, c.t / BAR), y: 25.1, zoom: lerp(5.6, 5.2, c.t / BAR) }),
  before: (c) => rise(c, c.memo.z as string | undefined, 0.8, 0.35),
  overlay: (o, c) => {
    const h = head(c, 'npc.holt')
    if (h) {
      const lift = ramp(c.t, 0.3, 0.45) * (1 - ramp(c.t, 0.62, 0.7))
      o.icon(h.x, h.y - 16, iconOf(c, 'item:bone'), c.scene.zoom * 1.1, lift)
      o.chip(h.x, h.y - 30, '✓ farmland × use · bone', ramp(c.t, 0.6, 0.7) * (1 - ramp(c.t, 1.5, 1.7)), 20 * easeOut(ramp(c.t, 0.6, 0.9)))
      o.emote(h.x, h.y - 10, '!', ramp(c.t, 0.95, 1.0) * (1 - ramp(c.t, 2.0, 2.2)), ramp(c.t, 0.95, 1.15))
    }
    o.counter(3, 1)
  },
  sounds: [[0.65, 'Sounds/Hit & Impact/Impact.wav', 0.5], [0.66, 'Sounds/Menu/Accept2.wav', 0.5], [0.8, 'Sounds/Hit & Impact/Impact4.wav', 0.8], [0.95, 'Sounds/Voice/Voice3.wav', 0.5]],
}

// ------------------------------------------------------------------ and on: a rule in every corner

export function corner(id: string, map: string, at: [number, number], who: [number, number], chip: string, from: number, to: number, hour = 13, cam?: { x: number; y: number; zoom: number }): Shot {
  return {
    id, seconds: BEAT, map, at, hour,
    edit: (f) => sky(f, hour),
    camera: (c) => ({ ...(cam ?? { x: who[0] + 0.5, y: who[1], zoom: 4.2 }), zoom: (cam?.zoom ?? 4.2) + 0.3 * (c.t / BEAT) }),
    overlay: (o, c) => {
      const s = c.scene.screenOfTile(who[0], who[1])
      o.chip(s.x, s.y - 50, chip, ramp(c.t, 0.04, 0.12), 24 * easeOut(ramp(c.t, 0.04, 0.3)))
      o.counter(Math.round(lerp(from, to, easeOut(ramp(c.t, 0.05, BEAT)))), 1)
    },
    sounds: [[0.05, 'Sounds/Menu/Accept2.wav', 0.4]],
  }
}
const corners: Shot[] = [
  // (Haldor's anvil in his smithy, village.ts: the forge's room at 2,8 of its plan, the anvil four cells in and one down)
  corner('forge', 'meadow.smithy', [6, 10], [6, 9], '✓ anvil × use · fish', 3, 41, 18, { x: 6.5, y: 9, zoom: 4.2 }),
  corner('ferry', 'ford', [25, 17], [28, 16], '✓ raft × put · lantern', 41, 318, 12),
  corner('wheel', 'mill', [18, 16], [12, 13], '✓ waterwheel × use · bell', 318, 2147, 9),
  corner('kiln', 'charcoal', [20, 14], [17, 10], '✓ kiln × use · pumpkin', 2147, 12408, 15),
]

// ------------------------------------------------------------------ the land, and the name

const pullout: Shot = {
  id: 'pullout', seconds: BAR, map: 'overworld', at: [7, 7], hour: 12,
  camera: (c) => { const x = easeOut(ramp(c.t, 0, BAR)); return { x: lerp(15.5, 32, x), y: lerp(9, 24, x), zoom: Math.exp(lerp(Math.log(4), Math.log(0.95), x)) } },
  overlay: (o, c) => o.counter(12408, 1 - ramp(c.t, 0.6, 1.0)),
}

const end: Shot = {
  id: 'end', seconds: BAR * 2 + 1, map: 'overworld', at: [7, 7], hour: 12,
  camera: (c) => ({ x: 32, y: lerp(24, 23.4, c.t / (BAR * 2)), zoom: lerp(0.95, 1.0, c.t / (BAR * 2)) }),
  overlay: (o, c) => {
    o.wash('#0b0d10', 0.62 * ramp(c.t, 0, 0.6))
    o.vignette(1)
    o.title({ alpha: ramp(c.t, 0.1, 0.6), y: 470, kicker: 'A world whose rules are code', kickerAlpha: ramp(c.t, 0.4, 0.9), sub: 'What the world has never seen, it learns — and remembers.', subAlpha: ramp(c.t, 1.0, 1.6) })
    o.cta('Join the waitlist', ramp(c.t, 1.8, 2.3))
    o.wash('#000', ramp(c.t, BAR * 2 + 0.2, BAR * 2 + 1))
  },
}

export const FILM: Shot[] = [hook, title, village, farm, fish, snow, fight, talk, storm, night, boss, torch, bread, replay, ...corners, pullout, end]

/** Where the music comes in (seconds into the film) and from where in the track. */
export const MUSIC = { file: 'Musics/1 - Adventure Begin.ogg', at: 12, from: 0.029 + BAR * 5, fadeOut: [43.4, 45] as [number, number] }
