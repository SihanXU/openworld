// The explainer's clips (site/explain, "how it works"): one shot each, on the maps as they are drawn now. The first
// five are watched one by one — rain on Hesper's campfire, three rules answering quickly, Hesper by her drowned fire —
// and the rest fill the third chapter's grid of players' windows. Their times follow what site/explain/explain.js
// reads: an event lands about where its token comes back to the world.
// Played by the stage at ?film=explain; taken by site/video/export.mjs, cut into clips by site/explain/clips.mjs.
import type { Frame } from '@openworld/engine'
import type { Cut, Shot } from './film.ts'
import { head, iconOf } from './film.ts'
import { along, hold, line, now, once, place, pose, puppet, sky, vfx } from './kit.ts'
import { ramp } from './overlay.ts'

const lerp = (a: number, b: number, x: number) => a + (b - a) * x
/** The thing standing at a cell (the first of a kind there). */
const at = (c: Cut, map: string, x: number, y: number, kind: string) => c.eng.world.placedAt(map, x, y).find((e) => e.type.includes(kind))
const burn = (c: Cut, id: string | undefined, status = 'burning') => { if (id) c.eng.author(() => c.eng.world.setStatus({ e: id }, status, c.eng.world.state.tick + 99999)) }
const quench = (c: Cut, id: string | undefined, status = 'burning') => { if (id) c.eng.author(() => c.eng.removeStatus({ e: id }, status)) }
/** People held for the script are drawn standing, not working something out. */
const still = (f: Frame, ...ids: string[]) => { for (const id of ids) pose(f, id, { frozen: false }) }

// ------------------------------------------------------------------ the chapters' own

/** Chapter 1: rain on Hesper's campfire at the Ford; the fire goes out. */
const camp: Shot = {
  id: 'camp', seconds: 2.6, map: 'ford', at: [2, 28], hour: 19.0,
  setup: (c) => { hold(c, 'npc.hesper'); place(c, 'npc.hesper', 15, 16, 'left'); c.memo.fire = at(c, 'ford', 14, 16, 'campfire')?.id },
  tick: (c) => { if (once(c, 'out', 1.1)) quench(c, c.memo.fire as string, 'lit') },
  edit: (f, c) => { sky(f, 19.0, 'rain'); still(f, 'npc.hesper'); if (now(c, 1.1)) (vfx(f, 'steam', 14, 16), vfx(f, 'smoke', 14, 16)) },
  camera: (c) => ({ x: 14.5, y: 16.2, zoom: lerp(5.6, 6.1, c.t / 2.6) }),
  overlay: (o, c) => {
    o.rain(c.t, 1)
    const h = head(c, 'npc.hesper')
    if (h) o.emote(h.x, h.y - 8, '…', ramp(c.t, 1.5, 1.6), ramp(c.t, 1.5, 1.75))
  },
}

const SQUARE_FIRE: [number, number] = [22, 17]
/** Chapter 1, quick: Firstlight's fire on its square lit at dusk, the village round it. */
const lit: Shot = {
  id: 'lit', seconds: 1.4, map: 'meadow', at: [58, 38], hour: 19.4,
  setup: (c) => {
    for (const id of ['npc.marta', 'npc.pell', 'npc.holt']) hold(c, id)
    place(c, 'npc.marta', 21, 18, 'up'); place(c, 'npc.pell', 23, 18, 'up'); place(c, 'npc.holt', 24, 16, 'left')
    c.memo.f = at(c, 'meadow', ...SQUARE_FIRE, 'campfire')?.id; quench(c, c.memo.f as string, 'lit')
  },
  tick: (c) => { if (once(c, 'l', 1.0)) burn(c, c.memo.f as string, 'lit') },
  edit: (f, c) => { sky(f, 19.4); still(f, 'npc.marta', 'npc.pell', 'npc.holt'); if (now(c, 1.0)) (vfx(f, 'fire_burst', ...SQUARE_FIRE), vfx(f, 'sparks', ...SQUARE_FIRE)) },
  camera: () => ({ x: 22.5, y: 17.1, zoom: 5.4 }),
}

const TUFTS: [number, number][] = [[33, 6], [34, 7], [32, 7], [35, 6]]
/** Chapter 1, quick: tufts by the Pilgrim's Road catch, one from the next, in a storm. */
const grass: Shot = {
  id: 'grass', seconds: 1.4, map: 'pilgrimway', at: [1, 22], hour: 19.3,
  setup: (c) => { c.memo.t = TUFTS.map((p) => puppet(c, 'fixture/nature/tuft', p)) },
  tick: (c) => { (c.memo.t as string[]).forEach((id, k) => { if (once(c, `b${k}`, 0.9 + k * 0.12)) burn(c, id) }) },
  edit: (f, c) => { sky(f, 19.3, 'storm'); TUFTS.forEach(([x, y], k) => { if (now(c, 0.9 + k * 0.12)) vfx(f, 'fire_burst', x, y) }) },
  camera: () => ({ x: 33.6, y: 6.8, zoom: 5.4 }),
  overlay: (o, c) => o.rain(c.t, 0.5),
}

/** Chapter 1, quick: a dead tree burning on the Pilgrim's Road, and the rain puts it out. */
const out: Shot = {
  id: 'out', seconds: 1.4, map: 'pilgrimway', at: [1, 22], hour: 19.2,
  setup: (c) => { c.memo.tree = puppet(c, 'fixture/nature/dead_tree', [21, 7]); burn(c, c.memo.tree as string) },
  tick: (c) => { if (once(c, 'q', 1.0)) quench(c, c.memo.tree as string) },
  edit: (f, c) => { sky(f, 19.2, 'rain'); if (now(c, 1.0)) (vfx(f, 'steam', 21, 7), vfx(f, 'smoke', 21, 6)) },
  camera: () => ({ x: 21.4, y: 6.9, zoom: 5.6 }),
  overlay: (o, c) => o.rain(c.t, 1),
}

/** Chapter 2: Hesper by her drowned fire works it out (the world asks), then sits down by it to wait. */
const hesper: Shot = {
  id: 'hesper', seconds: 3.4, map: 'ford', at: [2, 28], hour: 19.4,
  setup: (c) => { hold(c, 'npc.hesper'); place(c, 'npc.hesper', 15, 16, 'left'); quench(c, at(c, 'ford', 14, 16, 'campfire')?.id, 'lit') },
  tick: (c) => { if (once(c, 'sit', 1.5)) c.eng.author(() => c.eng.world.setStatus({ e: 'npc.hesper' }, 'seated', c.eng.world.state.tick + 99999)) },
  edit: (f, c) => { sky(f, 19.4, 'rain'); pose(f, 'npc.hesper', { frozen: c.t > 0.3 && c.t < 1.4, facing: 'left' }) },
  camera: (c) => ({ x: 14.6, y: 16.3, zoom: lerp(6, 6.4, c.t / 3.4) }),
  overlay: (o, c) => { o.rain(c.t, 0.6); const h = head(c, 'npc.hesper'); if (h) o.thinking(h.x, h.y - 14, c.t, ramp(c.t, 0.35, 0.5) * (1 - ramp(c.t, 1.25, 1.4))) },
}

// ------------------------------------------------------------------ the players' windows (chapter 3)

/** Lightning on the Ford's dead tree. */
const tree: Shot = {
  id: 'tree', seconds: 3.6, map: 'ford', at: [2, 28], hour: 19.2,
  setup: (c) => { c.memo.tree = at(c, 'ford', 28, 10, 'dead_tree')?.id },
  tick: (c) => { if (once(c, 'burn', 0.55)) burn(c, c.memo.tree as string) },
  edit: (f, c) => {
    sky(f, 19.2, 'storm')
    if (now(c, 0.5)) f.fx.push({ t: 'strike', map: f.map, x: 28, y: 10 })
    if (now(c, 0.6)) (vfx(f, 'fire_burst', 28, 10), vfx(f, 'sparks', 28, 10))
    if (now(c, 1.6)) vfx(f, 'smoke', 28, 9)
  },
  camera: (c) => ({ x: 28.4, y: lerp(9.7, 9.4, c.t / 3.6), zoom: lerp(5.2, 6, c.t / 3.6) }),
  overlay: (o, c) => { o.wash('#0a1024', 0.06); o.rain(c.t, 0.9); o.wash('#eef2ff', 0.75 * ramp(c.t, 0.48, 0.5) * (1 - ramp(c.t, 0.55, 0.85))) },
}

const STEAL = line([28, 19], [25, 19])
/** Bread taken from Firstlight's square, and seen. */
const theft: Shot = {
  id: 'theft', seconds: 2.8, map: 'meadow', at: [58, 38], hour: 17.2, warm: 10,
  setup: (c) => {
    for (const id of ['npc.vigo', 'npc.marta', 'npc.holt']) hold(c, id)
    place(c, 'npc.marta', 22, 19, 'right'); place(c, 'npc.holt', 26, 21, 'up'); place(c, 'npc.vigo', 28, 19, 'left')
    c.memo.bread = puppet(c, 'item/food/bread', [24, 19])
  },
  tick: (c) => {
    const a = along(STEAL, 0.1, 0.28, c.t); place(c, 'npc.vigo', a.x, a.y, 'left')
    if (once(c, 'take', 1.1)) c.eng.author(() => { const b = c.eng.world.get(c.memo.bread as string); if (b) c.eng.world.destroy(b) })
    if (once(c, 'flee', 1.7)) place(c, 'npc.vigo', 26, 19, 'right')
  },
  edit: (f, c) => { sky(f, 17.2); still(f, 'npc.vigo', 'npc.marta', 'npc.holt') },
  camera: (c) => ({ x: 24.8, y: lerp(19.6, 19.3, c.t / 2.8), zoom: lerp(5, 5.4, c.t / 2.8) }),
  overlay: (o, c) => {
    const v = head(c, 'npc.vigo')
    if (v) o.icon(v.x, v.y - 6, iconOf(c, 'item:bread'), c.scene.zoom * 1.2, ramp(c.t, 1.1, 1.2), 0)
    const h = head(c, 'npc.holt'), m = head(c, 'npc.marta')
    if (h) o.emote(h.x, h.y - 8, '!', ramp(c.t, 1.6, 1.65), ramp(c.t, 1.6, 1.85))
    if (m) o.emote(m.x, m.y - 8, '!', ramp(c.t, 1.9, 1.95), ramp(c.t, 1.9, 2.15))
  },
}

const SHORT = 1.4
/** A haystack in the North Gate's ward goes up. */
const hay: Shot = {
  id: 'hay', seconds: SHORT, map: 'holy.quarter-1', at: [1, 106], hour: 18.6,
  setup: (c) => { c.memo.h = at(c, 'holy.quarter-1', 50, 50, 'haystack')?.id },
  tick: (c) => { if (once(c, 'b', 0.25)) burn(c, c.memo.h as string) },
  edit: (f, c) => { sky(f, 18.6); if (now(c, 0.25)) (vfx(f, 'fire_burst', 50, 50), vfx(f, 'explosion', 50, 50)) },
  camera: (c) => ({ x: 50.5, y: 50.4, zoom: lerp(4.6, 5, c.t / SHORT) }),
}
/** The Ford's fire slime catches. */
const slime: Shot = {
  id: 'slime', seconds: SHORT, map: 'ford', at: [2, 28], hour: 19.3,
  setup: (c) => { c.memo.s = at(c, 'ford', 5, 6, 'fire_slime')?.id ?? puppet(c, 'actor/creature/slime/fire_slime', [5, 6]); hold(c, c.memo.s as string) },
  tick: (c) => { if (once(c, 'b', 0.2)) burn(c, c.memo.s as string) },
  edit: (f, c) => { sky(f, 19.3); still(f, c.memo.s as string); if (now(c, 0.2)) vfx(f, 'fire_burst', 5, 6) },
  camera: () => ({ x: 5.4, y: 5.6, zoom: 6 }),
}
/** Somewhere people simply go about: a place at an hour, the camera drifting. */
function about(id: string, map: string, player: [number, number], hour: number, from: [number, number], to: [number, number], zoom: number, weather?: 'rain'): Shot {
  return {
    id, seconds: SHORT, map, at: player, hour, warm: 30,
    edit: (f) => sky(f, hour, weather),
    camera: (c) => ({ x: lerp(from[0], to[0], c.t / SHORT), y: lerp(from[1], to[1], c.t / SHORT), zoom }),
    ...(weather && { overlay: (o, c) => o.rain(c.t, 0.7) }),
  }
}
const street = about('street', 'meadow', [58, 38], 12.5, [28, 12], [30, 12], 3.8)
const north = about('north', 'holy.quarter-1', [1, 106], 13, [31, 63], [31, 61.5], 3)
const market = about('market', 'holy.quarter-3', [1, 98], 16.5, [26, 37], [29, 37], 3.6)
const bell = about('bell', 'holy.quarter-2', [1, 98], 17.4, [29, 54], [32, 54], 3.2)
const gate = about('gate', 'holy.sunwell-abbey', [1, 100], 11, [31, 47], [33, 47], 3.2)
const canal = about('canal', 'holy.quarter-5', [1, 67], 15, [24, 34], [27, 34], 3.6)
const haven = about('haven', 'haven', [1, 38], 10.5, [22, 18], [24, 18], 4)
const road = about('road', 'pilgrimway', [1, 22], 20.2, [32, 16], [34, 16], 4.6, 'rain')

export const EXPLAIN_FILM: Shot[] = [camp, lit, grass, out, hesper, tree, theft, hay, slime, street, north, market, bell, gate, canal, haven, road]
