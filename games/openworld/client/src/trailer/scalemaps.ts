// The scale film's maps and moments, from the list site/scale/gen/main.ts makes (scaleshots.json): the places built the
// showcase's way and their halls, those places in other seasons and on festival days, the hall plans furnished anew —
// each made map read from the folder ?promo= names.
//   ?film=scale-maps    one frame of each still: its window of the map (twelve cells square outside, eight inside)
//   ?film=scale-hero    the 64 the scenes act opens on, drawn large: each map's best window, the places, their seasons
//                       and festivals and the halls taking turns, 2 s each
//   ?film=scale-scenes  0.8 s of each other moment: its 16 x 9 window (12 x 7 inside), at its hour and in its weather; a fire
//                       lit at dusk where one stands in sight, a beast met in the wilds, lightning in a storm
// ?from=&to= take a part of the list; ?only=<url of a list of ids> those alone (what is not filmed yet). Taken by site/video/export.mjs --clip-w (the window alone), put together by
// site/scale/assets.ts (the maps) and site/scale/clips.mjs (the scenes).
import type { Frame } from '@openworld/engine'
import type { Cut, Shot } from './film.ts'
import { now, once, place, pose, puppet, remove, sky, snap, vfx } from './kit.ts'
import type { Overlay } from './overlay.ts'
import { ramp } from './overlay.ts'
import LIST from './scaleshots.json'

type Weather = 'sun' | 'cloud' | 'rain' | 'fog' | 'storm'
interface Entry {
  id: string
  map: string
  src?: string
  family: string
  variant?: string
  inside: boolean
  region?: string
  x: number
  y: number
  w: number
  h: number
  hour: number
  weather: Weather
  stand: [number, number]
  also: string[]
}
const P = 'player'
const W = 1920, H = 1080, CELL = 16
/** The one at the keys is not in these pictures, nor their fairy. */
const unseen = (f: Frame) => { f.entities = f.entities.filter((e) => e.id !== P && !e.type.startsWith('actor/companion')) }
function weather(o: Overlay, t: number, w?: Weather): void {
  if (w === 'rain' || w === 'storm') o.rain(t, w === 'storm' ? 1 : 0.8)
  if (w === 'fog') o.wash('#d8e2ea', 0.22)
}
/** The middle of the frame, w x h cells at a zoom: what a shot takes (export.mjs --clip-w). */
const middle = (w: number, h: number, zoom: number): [number, number, number, number] => { const pw = w * CELL * zoom, ph = h * CELL * zoom; return [(W - pw) / 2, (H - ph) / 2, pw, ph] }
const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296 }

/** One frame of a still's window, as close as the renderer goes (zoom 6) or as fits. */
function still(e: Entry): Shot {
  const zoom = Math.min(6, H / (CELL * e.h), W / (CELL * e.w))
  return {
    id: e.id, seconds: 1 / 30, map: e.map, src: e.src, at: e.stand, hour: e.hour, warm: 30, also: e.also,
    edit: (f) => { sky(f, e.hour, e.weather); unseen(f) },
    camera: () => ({ x: e.x, y: e.y, zoom }),
    clip: () => middle(e.w, e.h, zoom),
    overlay: (o, c) => weather(o, c.t, e.weather),
  }
}

/** The beasts met in each region's wilds. */
const FOES: Record<string, string[]> = {
  frostfang: ['beast/frost_wolf', 'golem/ice_golem', 'slime/frost_slime'], redmarch: ['beast/boar', 'imp/fire_imp', 'slime/fire_slime'],
  tithe: ['beast/wolf', 'slime/green_slime', 'beast/boar'], palefen: ['undead/ghost', 'spider', 'slime/water_slime'],
  altar: ['undead/skeleton', 'wisp', 'slime/spark_slime'], holy: ['beast/wolf', 'slime/green_slime', 'undead/zombie'],
}
/** The places where a beast may be met: the ruin, the camps, the cave's mouth, the mine, the tower's grounds, the hills. */
const WILD = /ashengate|scarwell|northmoor|brandby|goldmere|frostbarrow|foot|summit/

/** A moment: SEC seconds of its window, the camera drifting a cell; what happens there. */
function scene(e: Entry, SEC = 0.8): Shot {
  const zoom = Math.min(6, W / (CELL * e.w), H / (CELL * e.h))
  const fx = Math.round(e.x), fy = Math.round(e.y)
  const storm = !e.inside && e.weather === 'storm'
  const fight = !e.inside && !e.variant && WILD.test(e.family) && hash(e.id + 'f') < 0.45
  const foes = FOES[e.region ?? 'holy'] ?? FOES.holy
  const foe = `actor/creature/${foes[Math.floor(hash(e.id + 'k') * foes.length)]}`
  return {
    id: e.id, seconds: SEC, map: e.map, src: e.src, at: fight ? [fx - 1, fy] : e.stand, hour: e.hour, warm: 30, also: e.also, facing: 'right',
    setup: (c: Cut) => {
      if (fight) { c.memo.foe = puppet(c, foe, [fx, fy], { facing: 'left' }); place(c, P, fx - 1, fy, 'right') }
      // a fire in sight at dusk or after: put out, to be lit
      if (e.hour >= 17.5) {
        const w = c.eng.world
        for (let y = fy - 4; y <= fy + 4 && !c.memo.fire; y++) for (let x = fx - 7; x <= fx + 7 && !c.memo.fire; x++) {
          const f = w.placedAt(e.map, x, y).find((t) => /campfire|bonfire|brazier/.test(t.type))
          if (f) { c.memo.fire = f.id; c.memo.fat = [x, y]; c.eng.author(() => c.eng.removeStatus({ e: f.id }, 'lit')) }
        }
      }
    },
    tick: (c: Cut) => {
      if (c.memo.fire && once(c, 'lit', 0.2)) c.eng.author(() => c.eng.world.setStatus({ e: c.memo.fire as string }, 'lit', c.eng.world.state.tick + 99999))
      if (fight && once(c, 'gone', 0.65)) remove(c, c.memo.foe as string)
    },
    edit: (f, c) => {
      sky(f, e.hour, e.weather)
      if (!fight) unseen(f)
      if (storm && now(c, 0.2)) f.fx.push({ t: 'strike', map: f.map, x: fx + 2, y: fy - 1 } as never)
      if (c.memo.fire && now(c, 0.2)) vfx(f, 'fire_burst', ...(c.memo.fat as [number, number]))
      if (fight) {
        pose(f, P, { held: 'item:sword', heldTags: ['weapon'] } as never)
        const s = snap(f, c.memo.foe as string)
        if (s) s.frozen = false
        for (const t of [0.1, 0.4]) if (now(c, t)) (f.fx.push({ t: 'vfx', fx: 'swing:right', map: f.map, x: fx - 1, y: fy, who: P } as never), vfx(f, 'hit', fx, fy))
        if (now(c, 0.6)) (vfx(f, 'poof', fx, fy), vfx(f, 'sparkle', fx, fy))
      }
    },
    camera: (c: Cut) => ({ x: e.x - 0.5 + c.t / SEC, y: e.y, zoom }),
    clip: () => middle(e.w, e.h, zoom),
    overlay: (o, c) => {
      weather(o, c.t, e.weather)
      if (storm) o.wash('#e8eeff', 0.55 * ramp(c.t, 0.2, 0.23) * (1 - ramp(c.t, 0.25, 0.45)))
    },
  }
}

const params = new URLSearchParams(location.search)
const ONLY = params.get('only') ? new Set<string>(await fetch(params.get('only')!).then((r) => r.json())) : undefined
const part = <T extends { id: string },>(l: T[]) => l.filter((e) => !ONLY || ONLY.has(e.id)).slice(Number(params.get('from') ?? 0), Number(params.get('to') ?? l.length))
const ALL = LIST as unknown as { stills: Entry[]; scenes: Entry[] }
/** The 64 large ones: each map's best window (its first), by turns a place, a hall, a place, a season or a festival, a
 *  hall made anew. */
const HERO = (() => {
  const best = ALL.scenes.filter((e) => e.id.endsWith('@0'))
  const sorts: Entry[][] = [
    best.filter((e) => !e.inside && !e.variant), best.filter((e) => e.inside && !e.src), best.filter((e) => !e.inside && !e.variant).reverse(),
    best.filter((e) => !!e.variant), best.filter((e) => e.inside && !!e.src),
  ]
  const out: Entry[] = [], seen = new Set<string>()
  for (let k = 0; out.length < 64 && k < 200; k++) for (const l of sorts) { const e = l.find((x) => !seen.has(x.id) && !seen.has(x.family)); if (e && out.length < 64) (out.push(e), seen.add(e.id), seen.add(e.family)) }
  return out
})()
const heroIds = new Set(HERO.map((e) => e.id))
export const SCALE_MAPS_FILM: Shot[] = part(ALL.stills).map(still)
export const SCALE_HERO_FILM: Shot[] = HERO.map((e) => scene(e, 2))
// (what is filmed by ?only= is filmed whole: the 64 were filmed with the list they came from)
export const SCALE_SCENES_FILM: Shot[] = part(ALL.scenes.filter((e) => ONLY || !heroIds.has(e.id))).map((e) => scene(e))
