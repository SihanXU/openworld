// The project page's places (site/): the showcase places (docs/showcase.md), each from where it shows best, at an hour
// that suits it, no traveller drawn.
//   ?film=tour    the hero's loop: the Holy City's six as the title shows them (game.ts cover.scenes), each held a few
//                 seconds and drifting, dipping to dark between them
//   ?film=places  one still of every place, the Holy City's and the regions', for the page's gallery
// Taken by site/video/export.mjs (--url …/trailer.html?film=tour, or ?film=places --every 15 for one frame a place).
import type { Cut, Shot } from './film.ts'
import { place, sky } from './kit.ts'
import { ramp } from './overlay.ts'

const lerp = (a: number, b: number, x: number) => a + (b - a) * x
/** The game's own view at 1920 x 1080 (scene.ts fitZoom): a place's zoom is a share of it, as the title's are. */
const VIEW = 4

interface Place {
  map: string
  /** Where the camera looks, and from how far (a share of the game's own view). */
  x: number
  y: number
  zoom: number
  hour: number
  /** Where the traveller stands, out of sight. */
  stand: [number, number]
}

/** The Holy City's six, as the title shows them. */
const HOLY: Record<string, Place> = {
  'sunwell-abbey': { map: 'holy.sunwell-abbey', x: 35, y: 58, hour: 18.6, stand: [36, 82], zoom: 0.55 },
  'north-gate': { map: 'holy.quarter-1', x: 31, y: 62, hour: 7, stand: [32, 82], zoom: 0.65 },
  'bell-ward': { map: 'holy.quarter-2', x: 30, y: 30, hour: 10.5, stand: [27, 53], zoom: 0.6 },
  market: { map: 'holy.quarter-3', x: 31, y: 36, hour: 9.5, stand: [32, 49], zoom: 0.65 },
  'lamp-ward': { map: 'holy.quarter-4', x: 27, y: 38, hour: 21, stand: [28, 46], zoom: 0.75 },
  'lower-town': { map: 'holy.quarter-5', x: 37, y: 34, hour: 19, stand: [28, 43], zoom: 0.8 },
}

/** The regions' places, each from its focus (chosen on the maps drawn whole, site/tools/survey-places.ts). */
const REGIONS: Record<string, Place> = {
  rimeholm: { map: 'frostfang.rimeholm', x: 38, y: 66, hour: 15.5, stand: [1, 1], zoom: 0.6 },
  warcombe: { map: 'redmarch.warcombe', x: 35, y: 14, hour: 17, stand: [1, 88], zoom: 0.6 },
  weighmarket: { map: 'tithe.weighmarket', x: 42, y: 30, hour: 10, stand: [1, 88], zoom: 0.6 },
  'dusk-moorings': { map: 'palefen.dusk-moorings', x: 36, y: 38, hour: 7.5, stand: [1, 82], zoom: 0.6 },
  'highheath-abbey': { map: 'altar.highheath-abbey', x: 40, y: 17, hour: 15, stand: [1, 90], zoom: 0.6 },
  barleyridge: { map: 'tithe.barleyridge-farm', x: 40, y: 22, hour: 9, stand: [1, 78], zoom: 0.6 },
  'brandby-mine': { map: 'redmarch.brandby-mine', x: 26, y: 18, hour: 12, stand: [59, 62], zoom: 0.6 },
  bellwick: { map: 'altar.bellwick-farm', x: 36, y: 14, hour: 11, stand: [1, 82], zoom: 0.6 },
  ashengate: { map: 'palefen.ashengate-ruins', x: 25, y: 18, hour: 18, stand: [1, 70], zoom: 0.7 },
  'northmoor-cave': { map: 'frostfang.northmoor-cave', x: 32, y: 22, hour: 13, stand: [1, 62], zoom: 0.6 },
  'goldmere-tower': { map: 'tithe.goldmere-tower', x: 28, y: 16, hour: 17, stand: [1, 62], zoom: 0.7 },
  scarwell: { map: 'redmarch.scarwell-camp', x: 34, y: 33, hour: 18, stand: [1, 2], zoom: 0.6 },
  frostbarrow: { map: 'frostfang.frostbarrow-camp', x: 30, y: 22, hour: 10, stand: [62, 74], zoom: 0.5 },
}

/** A place filmed: `seconds` long, the camera drifting `drift` cells left to right as it slowly comes nearer. */
function filmed(id: string, p: Place, seconds: number, drift: number, dip: number): Shot {
  return {
    id, seconds, map: p.map, at: p.stand, hour: p.hour, warm: 40,
    setup: (c: Cut) => place(c, 'player', p.stand[0], p.stand[1], 'down'),
    edit: (f) => sky(f, p.hour),
    camera: (c: Cut) => {
      const u = c.t / seconds
      return { x: p.x + lerp(-drift / 2, drift / 2, u), y: p.y + lerp(0.3, -0.3, u) * (drift ? 1 : 0), zoom: VIEW * p.zoom * lerp(1, drift ? 1.06 : 1, u) }
    },
    // dipping to dark at both ends, so one place gives onto the next
    overlay: dip ? (o, c) => o.wash('#05060a', Math.max(1 - ramp(c.t, 0, dip), ramp(c.t, seconds - dip, seconds))) : undefined,
  }
}

export const TOUR_FILM: Shot[] = Object.entries(HOLY).map(([id, p]) => filmed(id, p, 6, 3, 0.6))
export const PLACES_FILM: Shot[] = Object.entries({ ...HOLY, ...REGIONS }).map(([id, p]) => filmed(id, p, 0.5, 0, 0))
