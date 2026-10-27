// The scale film's scenes (site/scale, "infinite possibilities"): many short moments, each somewhere else or at another
// hour, in other weather, at other work — the showcase's places and the regions' towns and villages going about their
// day, rooms with people in them, a catch, a harvest, fights by day and by night, a storm, a boss. No two alike: the film
// shows each in one window of its mosaic at a time. Two seconds each, filmed close (the windows are small).
// Played by the stage at ?film=scale; taken by site/video/export.mjs (--every 2), cut by site/scale/clips.mjs.
import type { Dir, Frame } from '@openworld/engine'
import { castNow } from '@openworld/modules'
import { createBoss } from '@openworld-game/content'
import type { Cut, Shot } from './film.ts'
import type { Overlay } from './overlay.ts'
import { head, iconOf } from './film.ts'
import { along, hold, line, now, once, place, pose, puppet, remove, sky, snap, vfx } from './kit.ts'
import { easeOut, ramp } from './overlay.ts'
import { EVENTS_FILM } from './events.ts'
import { EXPLAIN_FILM } from './explainfilm.ts'

const SEC = 2
const lerp = (a: number, b: number, x: number) => a + (b - a) * x
type Weather = 'sun' | 'cloud' | 'rain' | 'storm' | 'fog'
const P = 'player'
/** Those held for the script drawn standing, not working something out. */
const still = (f: Frame, ...ids: string[]) => { for (const id of ids) pose(f, id, { frozen: false }) }

/** The weather as a small window shows it: rain drawn over the renderer's, fog a veil. */
function weather(o: Overlay, t: number, w: Weather): void {
  if (w === 'rain' || w === 'storm') o.rain(t, w === 'storm' ? 1 : 0.8)
  if (w === 'fog') o.wash('#d8e2ea', 0.22)
}

/** A place going about its hour: the camera on what it is (x, y), drifting `drift` cells across, from `zoom`. The one at
 *  the keys stands far off, out of the picture. */
function about(id: string, map: string, x: number, y: number, hour: number, o: { weather?: Weather; zoom?: number; drift?: [number, number]; stand?: [number, number]; warm?: number } = {}): Shot {
  const [dx, dy] = o.drift ?? [1.2, 0], zoom = o.zoom ?? 6
  return {
    id, seconds: SEC, map, at: o.stand ?? [1, 1], hour, warm: o.warm ?? 30,
    edit: (f) => sky(f, hour, o.weather ?? 'sun'),
    camera: (c) => { const u = c.t / SEC; return { x: x + lerp(-dx / 2, dx / 2, u), y: y + lerp(-dy / 2, dy / 2, u), zoom: lerp(zoom, zoom * 1.04, u) } },
    overlay: o.weather ? (ov, c) => weather(ov, c.t, o.weather!) : undefined,
  }
}

// ------------------------------------------------------------------ the showcase's places, each at its own hour

const SHOWCASE: Shot[] = [
  about('north-gate', 'holy.quarter-1', 31, 62, 7, { stand: [32, 98] }),
  about('bell-ward', 'holy.quarter-2', 30, 31, 10.5, { stand: [27, 95] }),
  about('market', 'holy.quarter-3', 31, 37, 9.5, { stand: [32, 95], zoom: 5.4 }),
  about('lamp-ward', 'holy.quarter-4', 27, 38, 21.2, { stand: [28, 80] }),
  about('lower-town', 'holy.quarter-5', 37, 34, 19, { stand: [28, 80] }),
  about('abbey-dusk', 'holy.sunwell-abbey', 35, 58, 18.6, { stand: [36, 98], zoom: 5 }),
  about('rimeholm', 'frostfang.rimeholm', 38, 66, 15.5, { zoom: 5.4 }),
  about('warcombe', 'redmarch.warcombe', 35, 15, 17, { stand: [1, 88], weather: 'cloud' }),
  about('weighmarket', 'tithe.weighmarket', 42, 30, 10, { stand: [1, 88], zoom: 5.4 }),
  about('moorings', 'palefen.dusk-moorings', 36, 38, 7.2, { stand: [1, 82], weather: 'fog' }),
  about('brandby', 'redmarch.brandby-mine', 26, 18, 12, { stand: [59, 62] }),
  about('bellwick', 'altar.bellwick-farm', 36, 15, 11, { stand: [1, 82], weather: 'rain' }),
  about('ashengate', 'palefen.ashengate-ruins', 25, 18, 18.2, { stand: [1, 70] }),
  about('northmoor', 'frostfang.northmoor-cave', 32, 22, 13, { stand: [1, 62] }),
  about('goldmere', 'tithe.goldmere-tower', 28, 16, 17, { stand: [1, 62] }),
  about('scarwell', 'redmarch.scarwell-camp', 34, 33, 18.5, { stand: [1, 2] }),
  about('frostbarrow', 'frostfang.frostbarrow-camp', 30, 22, 10, { stand: [62, 74] }),
]

// ------------------------------------------------------------------ the regions' towns and villages, the rest of the day

const TOWNS: Shot[] = [
  about('quarter-6', 'holy.quarter-6', 27, 17.5, 14),
  about('quarter-8', 'holy.quarter-8', 16, 16.5, 8, { stand: [46, 34], weather: 'cloud' }),
  about('crimsonhold', 'redmarch.crimsonhold', 26, 22.5, 16),
  about('embercrest', 'redmarch.embercrest', 27, 15.5, 20.5, { stand: [1, 34] }),
  about('boneholm', 'palefen.boneholm', 19, 17.5, 17.6, { stand: [46, 1] }),
  about('martyrfen', 'altar.martyrfen', 38, 26.5, 9.5),
  about('rimewell', 'frostfang.rimewell', 29, 14.5, 16.5),
  about('whitefen', 'altar.whitefen', 13, 21.5, 7.5, { stand: [38, 1] }),
  about('emberfall', 'emberfall', 25, 15.5, 10.5),
  about('waystation', 'waystation', 20, 8.5, 17.5, { stand: [1, 24] }),
  about('thornby', 'frostfang.thornby', 16, 17.5, 19.2, { stand: [38, 1] }),
  about('rustmere', 'redmarch.rustmere', 19, 14.5, 13, { stand: [38, 1] }),
  about('sackwood', 'tithe.sackwood', 23, 20.5, 13.5, { stand: [46, 1], weather: 'rain' }),
]

// ------------------------------------------------------------------ rooms, with people in them

const ROOMS: Shot[] = [
  about('library', 'holy.sunwell-abbey.library', 13, 10, 15, { stand: [28, 24], zoom: 6 }),
  about('warhall', 'redmarch.warcombe.warhall', 14, 13, 19, { zoom: 5.6 }),
  about('icelake', 'frostfang.northmoor-cave.icelake', 22, 17, 12, { stand: [48, 38], zoom: 5 }),
  about('hall', 'holy.quarter-1.hall', 13, 12, 18, { stand: [26, 26], zoom: 6 }),
  about('inn', 'holy.quarter-4.inn-0', 12, 12, 20.5, { stand: [24, 1], zoom: 6.2 }),
  about('smithy', 'meadow.smithy', 9, 11, 10, { zoom: 6.4 }),
  about('chapel', 'meadow.church', 12, 12, 11, { stand: [24, 1], zoom: 6.2 }),
]

// ------------------------------------------------------------------ what happens out there

/** Every crop in a box of cells brought to a stage of its own kind (fixture/crop/<kind>/<stage>). */
function grow(c: Cut, x0: number, y0: number, x1: number, y1: number, stage: string): void {
  const w = c.eng.world
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++)
    for (const e of w.placedAt(c.shot.map, x, y)) if (e.type.startsWith('fixture/crop/')) c.eng.author(() => w.transform(e, `fixture/crop/${e.type.split('/')[2]}/${stage}`))
}
const harvest: Shot = {
  id: 'harvest', seconds: SEC, map: 'mill', at: [21, 14], hour: 9,
  setup: (c) => grow(c, 23, 5, 32, 11, 'sprout'),
  tick: (c) => { for (const [stage, at] of [['young', 0.6], ['ripe', 1.3]] as const) if (once(c, stage, at)) grow(c, 23, 5, 32, 11, stage) },
  edit: (f, c) => {
    sky(f, lerp(9, 17.5, c.t / SEC))
    for (const at of [0.6, 1.3]) if (now(c, at)) for (let x = 23; x <= 32; x += 2) for (let y = 5; y <= 11; y += 2) vfx(f, 'leaves', x, y)
  },
  camera: (c) => ({ x: 26.5, y: 8.4, zoom: lerp(5.2, 5.5, c.t / SEC) }),
}

const fish: Shot = {
  id: 'fish', seconds: SEC, map: 'reedbend', at: [30, 13], hour: 16, facing: 'right',
  setup: (c) => { place(c, P, 30, 13, 'right'); hold(c, 'npc.hilde'); place(c, 'npc.hilde', 27, 12, 'right') },
  edit: (f, c) => {
    sky(f, 16)
    still(f, 'npc.hilde')
    if (now(c, 0.1)) vfx(f, 'splash', 32, 13)
    if (now(c, 1.0)) (vfx(f, 'splash', 32, 13), vfx(f, 'sparkle', 32, 13))
  },
  camera: (c) => ({ x: 30, y: 12.6, zoom: lerp(6, 6.3, c.t / SEC) }),
  overlay: (o, c) => {
    const h = head(c, P)
    if (h) o.icon(h.x + 30, h.y + 40, iconOf(c, 'item:rod'), c.scene.zoom * 1.2, 1)
    const s = c.scene.screenOfTile(32, 13)
    o.icon(s.x, s.y - 20 - 70 * easeOut(ramp(c.t, 1.0, 1.4)), iconOf(c, 'item:fish'), c.scene.zoom * 1.3, ramp(c.t, 1.0, 1.1), ramp(c.t, 1.0, 1.1) * 0.7)
  },
}

const SNOW_WALK: [number, number][] = [[12, 11], [13, 11], [13, 12], [14, 12], [14, 13], [15, 13], [16, 13], [16, 14], [17, 14], [18, 14], [18, 15], [19, 15], [20, 15]]
const snow: Shot = {
  id: 'snow', seconds: SEC, map: 'summit', at: [12, 11], hour: 10,
  tick: (c) => { const a = along(SNOW_WALK, 0, 0.15, c.t); place(c, P, a.x, a.y, a.facing) },
  edit: (f) => sky(f, 10, 'cloud'),
  camera: (c) => ({ x: lerp(13.6, 17.6, c.t / SEC), y: lerp(11.8, 13.8, c.t / SEC), zoom: 5.6 }),
}

/** A fight: the one at the keys swinging at what stands before them, struck twice and gone; others about. */
function fight(id: string, map: string, at: [number, number], hour: number, foe: string, others: [string, [number, number]][], o: { held?: string; weather?: Weather; light?: boolean } = {}): Shot {
  const [x, y] = at
  return {
    id, seconds: SEC, map, at, hour, facing: 'right',
    setup: (c) => {
      c.memo.s = puppet(c, foe, [x + 1, y], { facing: 'left' })
      c.memo.o = others.map(([t, p]) => puppet(c, t, p))
      place(c, P, x, y, 'right')
    },
    tick: (c) => { if (once(c, 'gone', 1.35)) remove(c, c.memo.s as string) },
    edit: (f, c) => {
      sky(f, hour, o.weather ?? 'sun')
      still(f, ...(c.memo.o as string[]))
      pose(f, P, { held: o.held ?? 'item:sword', heldTags: o.light ? ['light'] : ['weapon'] } as never)
      for (const t of [0.15, 0.85]) if (now(c, t)) (f.fx.push({ t: 'vfx', fx: 'swing:right', map: f.map, x, y, who: P } as never), vfx(f, 'hit', x + 1, y))
      if (now(c, 1.3)) (vfx(f, 'poof', x + 1, y), vfx(f, 'sparkle', x + 1, y))
      const s = snap(f, c.memo.s as string)
      if (s) { s.frozen = false; if (c.t > 0.15) s.x = c.t > 0.85 ? x + 2 : x + 1 }
    },
    camera: (c) => ({ x: x + 1, y: y - 0.2, zoom: lerp(6.2, 6.6, c.t / SEC) }),
    overlay: (ov, c) => {
      const s = c.scene.screenOfTile(x + 1, y)
      ov.floater(s.x, s.y - 30, String(9 + (id.length * 7) % 11), c.t - 0.2)
      ov.floater(s.x + 50, s.y - 30, String(14 + (id.length * 5) % 9), c.t - 0.9, '#ffd36a')
    },
  }
}
const SLIME = 'actor/creature/slime/'
const fights: Shot[] = [
  fight('slimes', 'forest', [22, 6], 15, `${SLIME}green_slime`, [[`${SLIME}green_slime`, [26, 5]], [`${SLIME}green_slime`, [21, 8]]]),
  fight('wolves', 'pass', [15, 12], 14, 'actor/creature/beast/frost_wolf', [['actor/creature/beast/frost_wolf', [19, 11]]], { weather: 'cloud' }),
  fight('barrow', 'barrow', [13, 15], 12, 'actor/creature/undead/skeleton', [['actor/creature/undead/skeleton', [17, 13]], ['actor/creature/beast/bat', [11, 12]]], { held: 'item:torch', light: true }),
  fight('imps', 'dawnhill', [15, 16], 13, 'actor/creature/imp/fire_imp', [[`${SLIME}fire_slime`, [18, 11]]], { held: 'item:pickaxe' }),
  fight('golem', 'foot', [13, 11], 11, 'actor/creature/golem/stone_golem', [[`${SLIME}spark_slime`, [21, 22]]], { held: 'item:hammer' }),
  fight('boar', 'hollow', [17, 10], 16.5, 'actor/creature/beast/boar', [['actor/creature/beast/wolf', [21, 8]]], { held: 'item:spear' }),
  fight('crabs', 'reedbend', [24, 18], 11, 'actor/creature/crab', [['actor/creature/crab', [27, 19]]], { held: 'item:axe' }),
  fight('graves', 'palefen.mothgate-graves', [25, 22], 23, 'actor/creature/undead/zombie', [['actor/creature/undead/ghost', [28, 20]], ['actor/creature/wisp', [22, 20]]], { held: 'item:torch', light: true }),
]

const storm: Shot = {
  id: 'storm', seconds: SEC, map: 'dawnhill', at: [20, 13], hour: 17.6, facing: 'up',
  edit: (f, c) => {
    sky(f, 17.6, 'storm')
    if (now(c, 0.2)) f.fx.push({ t: 'strike', map: f.map, x: 22, y: 9 })
    if (now(c, 1.2)) f.fx.push({ t: 'strike', map: f.map, x: 17, y: 11 })
  },
  camera: (c) => ({ x: lerp(20.5, 19.5, c.t / SEC), y: 10.4, zoom: 5.4 }),
  overlay: (o, c) => { o.wash('#0a1024', 0.2); o.rain(c.t, 1); for (const s of [0.2, 1.2]) o.wash('#e8eeff', 0.55 * ramp(c.t, s, s + 0.03) * (1 - ramp(c.t, s + 0.05, s + 0.25))) },
}

const NIGHT_WALK = line([18, 18], [25, 18])
const night: Shot = {
  id: 'night', seconds: SEC, map: 'meadow', at: [18, 18], hour: 22.5,
  setup: (c) => { c.memo.z = [puppet(c, 'actor/creature/undead/zombie', [28, 19], { facing: 'left' }), puppet(c, 'actor/creature/beast/bat', [26, 15])] },
  tick: (c) => { const a = along(NIGHT_WALK, 0, 0.22, c.t); place(c, P, a.x, a.y, a.facing) },
  edit: (f, c) => { sky(f, 22.5); still(f, ...(c.memo.z as string[])); pose(f, P, { heldTags: ['light'], held: 'item:torch' } as never) },
  camera: (c) => ({ x: lerp(21.5, 24.5, c.t / SEC), y: 17.6, zoom: 5.4 }),
}

const ARENA = { map: 'sanctum', x: 12, y: 9, id: 'stage.boss' } as const
const boss: Shot = {
  id: 'boss', seconds: SEC, map: 'sanctum', at: [ARENA.x, ARENA.y + 4], hour: 14, facing: 'up',
  chunk: (chunk) => {
    chunk.entities = chunk.entities.filter((e) => !e.type.startsWith('actor/creature'))
    chunk.entities.push(createBoss('alberic', ARENA, ARENA.id))
    chunk.map.appear = []
  },
  setup: (c) => {
    const b = c.eng.world.get(ARENA.id)!
    castNow(c.eng, b, 'thorns')
    for (let i = 0; i < 6; i++) c.eng.tick()
  },
  tick: (c) => {
    if (once(c, 'dodge', 0.9)) place(c, P, ARENA.x + 1, ARENA.y + 5, 'up')
    if (once(c, 'dodge2', 1.2)) place(c, P, ARENA.x + 2, ARENA.y + 6, 'up')
  },
  edit: (f) => sky(f, 14),
  camera: (c) => ({ x: ARENA.x + 0.5, y: lerp(ARENA.y + 1.8, ARENA.y + 1.3, c.t / SEC), zoom: lerp(5, 5.3, c.t / SEC) }),
}

/** A slime at the end of a torch catches and goes off a fire slime. */
const torch: Shot = {
  id: 'torch', seconds: SEC, map: 'forest', at: [20, 13], hour: 16.5, facing: 'right',
  setup: (c) => { c.memo.s = puppet(c, `${SLIME}green_slime`, [21, 13], { facing: 'left' }); place(c, P, 20, 13, 'right') },
  tick: (c) => {
    const s = c.eng.world.get(c.memo.s as string)
    if (s && once(c, 'fire', 0.7)) c.eng.author(() => c.eng.world.transform(s, `${SLIME}fire_slime`))
    if (once(c, 'hop1', 1.2)) place(c, c.memo.s as string, 22, 13, 'right')
    if (once(c, 'hop2', 1.6)) place(c, c.memo.s as string, 23, 12, 'up')
  },
  edit: (f, c) => {
    sky(f, 16.5)
    still(f, c.memo.s as string)
    pose(f, P, { heldTags: ['light'], held: 'item:torch' } as never)
    if (now(c, 0.7)) (vfx(f, 'fire_burst', 21, 13), vfx(f, 'sparks', 21, 13))
  },
  camera: (c) => ({ x: 21.4, y: 12.7, zoom: lerp(6.2, 6.6, c.t / SEC) }),
}

/** Beasts at pasture, the herd moving along. */
const herd: Shot = {
  id: 'herd', seconds: SEC, map: 'pasture', at: [1, 28], hour: 10,
  setup: (c) => {
    c.memo.a = ([['animal/cow', [19, 11]], ['animal/calf', [21, 12]], ['animal/cow', [24, 10]], ['animal/chicken', [22, 14]], ['animal/chick', [23, 14]]] as [string, [number, number]][]).map(([t, p]) => puppet(c, `actor/creature/${t}`, p))
  },
  tick: (c) => {
    const ids = c.memo.a as string[]
    ids.forEach((id, k) => { const a = along(line([19 + (k * 3) % 7, 11 + (k % 3)], [24 + (k * 3) % 7, 11 + (k % 3)]), 0.1 * k, 0.35, c.t); place(c, id, a.x, a.y, a.facing as Dir) })
  },
  edit: (f, c) => { sky(f, 10); still(f, ...(c.memo.a as string[])) },
  camera: (c) => ({ x: lerp(22, 24, c.t / SEC), y: 11.8, zoom: 5.8 }),
}

/** The Held Ground's camp at evening, its fires lit. */
const camp = about('held-ground', 'haven', 30, 16.5, 18.8, { stand: [1, 38], zoom: 5.6 })
/** The ford in the rain, people crossing. */
const fordRain = about('ford-rain', 'ford', 35, 17.5, 13, { weather: 'rain', zoom: 5.6 })
/** The charcoal-burners' clearing. */
const kilns = about('kilns', 'charcoal', 24, 12.5, 15, { stand: [1, 28] })
/** The abbey at the Pilgrim's Road's end. */
const abbey = about('abbey', 'abbey', 14, 14.5, 16, { stand: [38, 1] })

/** The star map's and the explainer's moments, the story's own (lightning on the Ford's dead tree, bread taken, the
 *  rain on Hesper's fire), filmed here whole rather than cut to their middles. */
const STORY: Shot[] = [
  ...EXPLAIN_FILM.filter((s) => ['camp', 'grass', 'tree', 'theft', 'hay', 'slime'].includes(s.id)),
  ...EVENTS_FILM.filter((s) => s.id === 'cells'),
]

const ALL: Shot[] = [...STORY, ...SHOWCASE, ...TOWNS, ...ROOMS, harvest, fish, snow, ...fights, storm, night, boss, torch, herd, camp, fordRain, kilns, abbey]
/** In the order the film's mosaic takes them up: the one it opens on, the three it splits into, the twelve after, and the
 *  forty-eight of the last level, their sorts taking turns so no two alike stand side by side. */
const ORDER = [
  'tree',
  'market', 'boss', 'theft',
  'fish', 'harvest', 'storm', 'rimeholm', 'lamp-ward', 'warhall', 'snow', 'camp', 'north-gate', 'weighmarket', 'night', 'library',
  'waystation', 'bell-ward', 'slimes', 'inn', 'quarter-6', 'grass', 'warcombe', 'wolves', 'hall', 'crimsonhold', 'hay', 'lower-town',
  'barrow', 'smithy', 'embercrest', 'slime', 'abbey-dusk', 'imps', 'chapel', 'boneholm', 'thornby', 'moorings', 'golem', 'icelake',
  'martyrfen', 'rustmere', 'brandby', 'boar', 'rimewell', 'cells', 'bellwick', 'crabs', 'whitefen', 'sackwood', 'ashengate', 'graves',
  'emberfall', 'northmoor', 'torch', 'quarter-8', 'goldmere', 'herd', 'held-ground', 'scarwell', 'ford-rain', 'frostbarrow', 'kilns', 'abbey',
]
export const SCALE_FILM: Shot[] = ORDER.map((id) => { const s = ALL.find((x) => x.id === id); if (!s) throw new Error(`no shot ${id}`); return s })
