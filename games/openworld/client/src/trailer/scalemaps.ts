// The scale film's every map, from the shot list site/scale/shots.ts makes of the world (scaleshots.json):
//   ?film=scale-maps    one frame of each map, its telling square with its people in it, for the maps act
//   ?film=scale-scenes  a moment on each map, somewhere else on it at another hour and in its weather, for the scenes
//                       act's deeper levels (a fire lit, a beast met, lightning where the list says)
// ?from=&to= take a part of the list (the stage starts afresh for each part). Taken by site/video/export.mjs and put
// together by site/scale/assets.ts (the maps) and site/scale/clips.mjs (the scenes).
import type { Frame } from '@openworld/engine'
import type { Cut, Shot } from './film.ts'
import { place, puppet, remove, sky, snap, vfx, once, now, pose } from './kit.ts'
import type { Overlay } from './overlay.ts'
import { ramp } from './overlay.ts'
import LIST from './scaleshots.json'

type Weather = 'sun' | 'cloud' | 'rain' | 'fog' | 'storm'
interface Entry {
  map: string
  kind: string
  size: [number, number]
  stand: [number, number]
  also: string[]
  still: { x: number; y: number; hour: number; cells: number; alt?: number }
  scene: { x: number; y: number; hour: number; cells: [number, number]; alt?: number; weather?: Weather; event?: { kind: 'strike' | 'fire' | 'fight'; at?: [number, number]; foe?: string } }
}
const P = 'player'
const W = 1920, H = 1080, CELL = 16
/** The one at the keys is not in these pictures, nor their fairy. */
const unseen = (f: Frame) => { f.entities = f.entities.filter((e) => e.id !== P && !e.type.startsWith('actor/companion')) }
/** Where a take of a home puts its person in the picture: off the middle by the map and the take, so homes of one
 *  kind are not framed alike. */
const offset = (map: string, take: number): [number, number] => { let h = 2166136261; for (const ch of map + take) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); h >>>= 0; return [((h % 5) - 2) * 0.6, (((h >> 8) % 3) - 1) * 0.6] }
/** A home is one of a town's rooms, much like the others of its kind: who lives there tells it apart. */
const HOME = /\.(home|house|tent|cell|farmhouse)(-\d+)?$/
/** Someone of the household where they are now (the first by name, so the still and the scene may differ by the hour),
 *  or where the list said to look. */
function resident(c: Cut, e: Entry, fallback: { x: number; y: number }, nth = 0): { x: number; y: number } {
  const w = c.eng.world
  const here = w.people().filter((p) => w.posOf(p)?.map === e.map).sort((a, b) => (a.id < b.id ? -1 : 1))
  const p = here.length ? w.posOf(here[nth % here.length]) : undefined
  return p ? { x: p.x + 0.5, y: p.y + 0.2 } : fallback
}
function weather(o: Overlay, t: number, w?: Weather): void {
  if (w === 'rain' || w === 'storm') o.rain(t, w === 'storm' ? 1 : 0.8)
  if (w === 'fog') o.wash('#d8e2ea', 0.22)
}

/** The middle of the frame, w x h cells at a zoom: what a shot takes (export.mjs --clip-w). */
const middle = (w: number, h: number, zoom: number): [number, number, number, number] => { const pw = w * CELL * zoom, ph = h * CELL * zoom; return [(W - pw) / 2, (H - ph) / 2, pw, ph] }

/** One frame: the square the list chose, twelve cells of the open country, seven of a hall or a workshop, five round
 *  someone of the household in a home, as close as the renderer goes (zoom 6). */
function still(e: Entry, take = 0): Shot {
  const home = HOME.test(e.map), n = home ? 5 : e.still.cells, zoom = Math.min(6, H / (CELL * n))
  const hour = take ? e.still.alt ?? e.still.hour : e.still.hour, [ox, oy] = offset(e.map, take)
  return {
    id: `m${take ? take + 1 : ''}:${e.map}`, seconds: 1 / 30, map: e.map, at: e.stand, hour, warm: 30, also: e.also,
    edit: (f) => { sky(f, hour, 'sun'); unseen(f) },
    camera: (c: Cut) => { if (!home) return { ...e.still, zoom }; const at = resident(c, e, e.still, take); return { x: at.x + ox, y: at.y + oy, zoom } },
    clip: () => middle(n, n, zoom),
  }
}

/** A moment: 0.8 s, the camera drifting a cell, the list's 16 x 9 cells (of a room 9 x 5) taken. */
function scene(e: Entry, take = 0): Shot {
  const s = { ...e.scene, hour: take ? e.scene.alt ?? e.scene.hour : e.scene.hour }, ev = s.event, SEC = 0.8, [ox, oy] = offset(e.map, take + 2)
  const home = HOME.test(e.map), [cw, ch] = home ? [7, 4] : s.cells, zoom = Math.min(6, W / (CELL * cw))
  const fx = Math.round(s.x), fy = Math.round(s.y)
  return {
    id: `s${take ? take + 1 : ''}:${e.map}`, seconds: SEC, map: e.map, at: ev?.kind === 'fight' ? [fx - 1, fy] : e.stand, hour: s.hour, warm: 30, also: e.also, facing: 'right',
    setup: (c: Cut) => {
      if (ev?.kind === 'fight') { c.memo.foe = puppet(c, ev.foe!, [fx, fy], { facing: 'left' }); place(c, P, fx - 1, fy, 'right') }
      if (ev?.kind === 'fire') { const f = c.eng.world.placedAt(e.map, ev.at![0], ev.at![1]).find((x) => /campfire|bonfire|brazier/.test(x.type)); if (f) (c.memo.fire = f.id), c.eng.author(() => c.eng.removeStatus({ e: f.id }, 'lit')) }
    },
    tick: (c: Cut) => {
      if (ev?.kind === 'fire' && c.memo.fire && once(c, 'lit', 0.2)) c.eng.author(() => c.eng.world.setStatus({ e: c.memo.fire as string }, 'lit', c.eng.world.state.tick + 99999))
      if (ev?.kind === 'fight' && once(c, 'gone', 0.65)) remove(c, c.memo.foe as string)
    },
    edit: (f, c) => {
      sky(f, s.hour, s.weather ?? 'sun')
      if (ev?.kind !== 'fight') unseen(f)
      if (ev?.kind === 'strike' && now(c, 0.2)) f.fx.push({ t: 'strike', map: f.map, x: fx + 2, y: fy - 1 } as never)
      if (ev?.kind === 'fire' && now(c, 0.2)) vfx(f, 'fire_burst', ev.at![0], ev.at![1])
      if (ev?.kind === 'fight') {
        pose(f, P, { held: 'item:sword', heldTags: ['weapon'] } as never)
        const foe = snap(f, c.memo.foe as string)
        if (foe) foe.frozen = false
        for (const t of [0.1, 0.4]) if (now(c, t)) (f.fx.push({ t: 'vfx', fx: 'swing:right', map: f.map, x: fx - 1, y: fy, who: P } as never), vfx(f, 'hit', fx, fy))
        if (now(c, 0.6)) (vfx(f, 'poof', fx, fy), vfx(f, 'sparkle', fx, fy))
      }
    },
    camera: (c: Cut) => {
      // in a home, someone of the household (another than the still's), the camera with them
      if (home) { const at = (c.memo.at ??= resident(c, e, s, take + 1)) as { x: number; y: number }; return { x: at.x + ox - 0.3 + (0.6 * c.t) / SEC, y: at.y + oy, zoom } }
      return { x: s.x - 0.5 + c.t / SEC, y: s.y, zoom }
    },
    clip: () => middle(cw, ch, zoom),
    overlay: (o, c) => {
      weather(o, c.t, s.weather)
      if (ev?.kind === 'strike') o.wash('#e8eeff', 0.55 * ramp(c.t, 0.2, 0.23) * (1 - ramp(c.t, 0.25, 0.45)))
    },
  }
}

const params = new URLSearchParams(location.search)
const part = <T,>(l: T[]) => l.slice(Number(params.get('from') ?? 0), Number(params.get('to') ?? l.length))
const ENTRIES = LIST as unknown as Entry[]
// a home has a second take: another hour, another of its people, framed otherwise
export const SCALE_MAPS_FILM: Shot[] = part(ENTRIES).flatMap((e) => (HOME.test(e.map) ? [still(e), still(e, 1)] : [still(e)]))
export const SCALE_SCENES_FILM: Shot[] = part(ENTRIES).flatMap((e) => (HOME.test(e.map) ? [scene(e), scene(e, 1)] : [scene(e)]))
