// The star map's event clips (site/starmap): what grows from a few rules on a stormy day at the Ford (the paper's
// Figure 5), each event acted on the real stage, one shot each. The star map opens a star into its clip and closes it
// back to a point; the first clips are long (they are watched), the later ones short (they flash past).
// Played by the stage at ?film=events; taken by site/video/export.mjs, cut into clips by site/starmap/clips.mjs.
import type { Frame } from '@openworld/engine'
import type { Cut, Cue, Shot } from './film.ts'
import { head, iconOf, rise } from './film.ts'
import { hold, line, now, once, place, pose, puppet, sky, vfx, along } from './kit.ts'
import { ramp } from './overlay.ts'

const lerp = (a: number, b: number, x: number) => a + (b - a) * x
/** The thing standing at a cell (the first of a kind there). */
const at = (c: Cut, map: string, x: number, y: number, kind: string) => c.eng.world.placedAt(map, x, y).find((e) => e.type.includes(kind))
const burn = (c: Cut, id: string | undefined, status = 'burning') => { if (id) c.eng.author(() => c.eng.world.setStatus({ e: id }, status, c.eng.world.state.tick + 99999)) }
const quench = (c: Cut, id: string | undefined, status = 'burning') => { if (id) c.eng.author(() => c.eng.removeStatus({ e: id }, status)) }
/** People held for the script are drawn standing, not working something out. */
const still = (f: Frame, ...ids: string[]) => { for (const id of ids) pose(f, id, { frozen: false }) }
/** The one at the keys out of the way. */
const away = (c: Cut) => place(c, 'player', 2, 28, 'down')

function shot(s: Shot & { sounds?: Cue[] }): Shot {
  return { ...s, setup: (c) => { away(c); s.setup?.(c) } }
}

// ------------------------------------------------------------------ the four that are watched

const tree = shot({
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
})

const camp = shot({
  id: 'camp', seconds: 2.6, map: 'ford', at: [2, 28], hour: 19.0,
  setup: (c) => { hold(c, 'npc.hesper'); place(c, 'npc.hesper', 15, 16, 'left'); c.memo.fire = at(c, 'ford', 14, 16, 'campfire')?.id },
  tick: (c) => { if (once(c, 'out', 1.1)) quench(c, c.memo.fire as string, 'lit') },
  edit: (f, c) => { sky(f, 19.0, 'rain'); still(f, 'npc.hesper'); if (now(c, 1.1)) (vfx(f, 'steam', 14, 16), vfx(f, 'smoke', 14, 16)) },
  camera: (c) => ({ x: 14.4, y: 16.3, zoom: lerp(5.6, 6.1, c.t / 2.6) }),
  overlay: (o, c) => {
    o.rain(c.t, 1)
    const h = head(c, 'npc.hesper')
    if (h) o.emote(h.x, h.y - 8, '…', ramp(c.t, 1.5, 1.6), ramp(c.t, 1.5, 1.75))
  },
})

const STEAL = line([27, 18], [24, 18])
const theft = shot({
  id: 'theft', seconds: 2.8, map: 'meadow', at: [2, 28], hour: 17.2, warm: 10,
  setup: (c) => {
    for (const id of ['npc.vigo', 'npc.marta', 'npc.holt']) hold(c, id)
    place(c, 'npc.marta', 21, 18, 'right'); place(c, 'npc.holt', 25, 21, 'up'); place(c, 'npc.vigo', 27, 18, 'left')
    c.memo.bread = puppet(c, 'item/food/bread', [23, 18])
  },
  tick: (c) => {
    const a = along(STEAL, 0.1, 0.28, c.t); place(c, 'npc.vigo', a.x, a.y, 'left')
    if (once(c, 'take', 1.1)) c.eng.author(() => { const b = c.eng.world.get(c.memo.bread as string); if (b) c.eng.world.destroy(b) })
    if (once(c, 'flee', 1.7)) place(c, 'npc.vigo', 25, 18, 'right')
  },
  edit: (f, c) => { sky(f, 17.2); still(f, 'npc.vigo', 'npc.marta', 'npc.holt') },
  camera: (c) => ({ x: 23.6, y: lerp(18.9, 18.6, c.t / 2.8), zoom: lerp(5, 5.4, c.t / 2.8) }),
  overlay: (o, c) => {
    const v = head(c, 'npc.vigo')
    if (v) o.icon(v.x, v.y - 6, iconOf(c, 'item:bread'), c.scene.zoom * 1.2, ramp(c.t, 1.1, 1.2), 0)
    const h = head(c, 'npc.holt'), m = head(c, 'npc.marta')
    if (h) o.emote(h.x, h.y - 8, '!', ramp(c.t, 1.6, 1.65), ramp(c.t, 1.6, 1.85))
    if (m) o.emote(m.x, m.y - 8, '!', ramp(c.t, 1.9, 1.95), ramp(c.t, 1.9, 2.15))
  },
})

const hesper = shot({
  id: 'hesper', seconds: 3.4, map: 'ford', at: [2, 28], hour: 19.4,
  setup: (c) => { hold(c, 'npc.hesper'); place(c, 'npc.hesper', 15, 16, 'left'); quench(c, at(c, 'ford', 14, 16, 'campfire')?.id, 'lit') },
  // working it out (the world asks), then waiting by the fire
  edit: (f, c) => { sky(f, 19.4, 'rain'); pose(f, 'npc.hesper', { frozen: c.t > 0.3 && c.t < 2.4 }) },
  camera: (c) => ({ x: 14.5, y: 16.4, zoom: lerp(6, 6.4, c.t / 3.4) }),
  overlay: (o, c) => { o.rain(c.t, 0.6); const h = head(c, 'npc.hesper'); if (h) o.thinking(h.x, h.y - 14, c.t, ramp(c.t, 0.35, 0.5) * (1 - ramp(c.t, 2.2, 2.4))) },
})

// ------------------------------------------------------------------ the ones that flash past

const SHORT = 1.4
/** The dry grass the burning tree's sparks fall on: on the bank south-west of it, out of the water. */
const TUFTS: [number, number][] = [[27, 12], [26, 11], [25, 12], [24, 11]]
const grass = shot({
  id: 'grass', seconds: SHORT, map: 'ford', at: [2, 28], hour: 19.3,
  setup: (c) => { c.memo.t = TUFTS.map(([x, y]) => puppet(c, 'fixture/nature/tuft', [x, y])) },
  tick: (c) => { const ts = c.memo.t as string[]; ts.forEach((id, k) => { if (once(c, `b${k}`, 0.1 + k * 0.25)) burn(c, id) }) },
  edit: (f, c) => { sky(f, 19.3, 'storm'); TUFTS.forEach(([x, y], k) => { if (now(c, 0.1 + k * 0.25)) vfx(f, 'fire_burst', x, y) }) },
  camera: () => ({ x: 26.6, y: 11.2, zoom: 5.6 }),
})
const hay = shot({
  id: 'hay', seconds: SHORT, map: 'ford', at: [2, 28], hour: 19.3,
  setup: (c) => { c.memo.h = at(c, 'ford', 9, 10, 'haystack')?.id },
  tick: (c) => { if (once(c, 'b', 0.25)) burn(c, c.memo.h as string) },
  edit: (f, c) => { sky(f, 19.3); if (now(c, 0.25)) (vfx(f, 'fire_burst', 9, 10), vfx(f, 'explosion', 9, 10)) },
  camera: (c) => ({ x: 9.3, y: 9.8, zoom: lerp(5.8, 6.2, c.t / SHORT) }),
})
const out = shot({
  id: 'out', seconds: SHORT, map: 'ford', at: [2, 28], hour: 19.2,
  setup: (c) => { c.memo.tree = at(c, 'ford', 28, 10, 'dead_tree')?.id; burn(c, c.memo.tree as string) },
  tick: (c) => { if (once(c, 'q', 0.55)) quench(c, c.memo.tree as string) },
  edit: (f, c) => { sky(f, 19.2, 'rain'); if (now(c, 0.5)) (vfx(f, 'steam', 28, 10), vfx(f, 'smoke', 28, 9)) },
  camera: () => ({ x: 28.4, y: 9.6, zoom: 5.8 }),
  overlay: (o, c) => o.rain(c.t, 1),
})
const lit = shot({
  id: 'lit', seconds: SHORT, map: 'ford', at: [2, 28], hour: 19.6,
  setup: (c) => { hold(c, 'npc.hesper'); place(c, 'npc.hesper', 15, 16, 'left'); c.memo.f = at(c, 'ford', 14, 16, 'campfire')?.id; quench(c, c.memo.f as string, 'lit') },
  tick: (c) => { if (once(c, 'l', 0.45)) burn(c, c.memo.f as string, 'lit') },
  edit: (f, c) => { sky(f, 19.6); still(f, 'npc.hesper'); if (now(c, 0.45)) vfx(f, 'fire_burst', 14, 16) },
  camera: () => ({ x: 14.4, y: 16.3, zoom: 6 }),
})
const slime = shot({
  id: 'slime', seconds: SHORT, map: 'ford', at: [2, 28], hour: 19.3,
  setup: (c) => { c.memo.s = c.eng.world.placedAt('ford', 5, 6).find((e) => e.type.includes('fire_slime'))?.id ?? puppet(c, 'actor/creature/slime/fire_slime', [5, 6]); hold(c, c.memo.s as string) },
  tick: (c) => { if (once(c, 'b', 0.2)) burn(c, c.memo.s as string) },
  edit: (f, c) => { sky(f, 19.3); still(f, c.memo.s as string); if (now(c, 0.2)) vfx(f, 'fire_burst', 5, 6) },
  before: (c) => rise(c, c.memo.s as string, 0.25, 0.6, 1.7),
  camera: () => ({ x: 5.4, y: 5.6, zoom: 6 }),
})
const bounty = shot({
  id: 'bounty', seconds: SHORT, map: 'meadow', at: [2, 28], hour: 17.6,
  setup: (c) => { hold(c, 'npc.holt'); hold(c, 'npc.vigo'); place(c, 'npc.holt', 24, 18, 'right'); place(c, 'npc.vigo', 25, 18, 'left') },
  edit: (f, c) => { sky(f, 17.6); still(f, 'npc.holt', 'npc.vigo') },
  camera: () => ({ x: 24.9, y: 17.9, zoom: 6 }),
  overlay: (o, c) => {
    const h = head(c, 'npc.holt'), v = head(c, 'npc.vigo')
    if (h) o.emote(h.x, h.y - 8, '!', ramp(c.t, 0.15, 0.2), ramp(c.t, 0.15, 0.4))
    if (v) o.icon(v.x, v.y - 6, iconOf(c, 'item:coins'), c.scene.zoom * 1.2, ramp(c.t, 0.6, 0.7), 0.6)
  },
})
const marta = shot({
  id: 'marta', seconds: SHORT, map: 'meadow', at: [2, 28], hour: 17.4,
  setup: (c) => { hold(c, 'npc.marta'); place(c, 'npc.marta', 21, 18, 'right') },
  edit: (f, c) => { sky(f, 17.4); still(f, 'npc.marta') },
  camera: () => ({ x: 21.4, y: 17.8, zoom: 6.2 }),
  overlay: (o, c) => { const m = head(c, 'npc.marta'); if (m) o.emote(m.x, m.y - 8, '!', ramp(c.t, 0.2, 0.25), ramp(c.t, 0.2, 0.45)) },
})
const cells = shot({
  id: 'cells', seconds: SHORT, map: 'meadow', at: [2, 28], hour: 18.2,
  setup: (c) => { hold(c, 'npc.holt'); hold(c, 'npc.vigo') },
  tick: (c) => {
    // up the path to the watch house's door
    const a = along(line([34, 14], [34, 10]), 0, 0.3, c.t), b = along(line([34, 15], [34, 11]), 0, 0.3, c.t)
    place(c, 'npc.holt', a.x, a.y, 'up'); place(c, 'npc.vigo', b.x, b.y, 'up')
  },
  edit: (f, c) => { sky(f, 18.2); still(f, 'npc.holt', 'npc.vigo') },
  camera: (c) => ({ x: 34.5, y: lerp(13.2, 11.4, c.t / SHORT), zoom: 5.4 }),
})
const pell = shot({
  id: 'pell', seconds: SHORT, map: 'meadow', at: [2, 28], hour: 18,
  setup: (c) => { hold(c, 'npc.marta'); hold(c, 'npc.pell'); place(c, 'npc.marta', 19, 15, 'right'); place(c, 'npc.pell', 20, 15, 'left') },
  edit: (f, c) => { sky(f, 18); still(f, 'npc.marta', 'npc.pell') },
  camera: () => ({ x: 19.9, y: 14.6, zoom: 6.2 }),
  overlay: (o, c) => {
    const m = head(c, 'npc.marta'), p = head(c, 'npc.pell')
    if (m) o.emote(m.x, m.y - 8, '…', ramp(c.t, 0.1, 0.15) * (1 - ramp(c.t, 0.7, 0.8)), ramp(c.t, 0.1, 0.3))
    if (p) o.emote(p.x, p.y - 8, '!', ramp(c.t, 0.8, 0.85), ramp(c.t, 0.8, 1.0))
  },
})

export const EVENTS_FILM: Shot[] = [tree, camp, theft, hesper, grass, hay, out, lit, slime, bounty, marta, cells, pell]
