// A look at the maps a film may be shot on: each whole in one frame with its cells numbered every five, to stage by
// (`?film=survey`, or export.mjs --url …/trailer.html?film=survey --size 1080). Development only.
import type { Shot } from './film.ts'
import { sky } from './kit.ts'

const MAPS: [string, number, number][] = [
  ['summit', 40, 30], ['foot', 40, 30], ['meadow', 60, 40], ['pasture', 40, 30], ['forest', 40, 30], ['hollow', 40, 30],
  ['barrow', 30, 24], ['sanctum', 24, 18], ['mill', 40, 30], ['dawnhill', 40, 30], ['charcoal', 40, 30], ['reedbend', 40, 30],
  ['ford', 48, 30], ['overworld', 64, 48],
]

export const SURVEY_FILM: Shot[] = MAPS.map(([map, w, h]) => ({
  id: map, seconds: 1, map, at: [Math.floor(w / 2), Math.floor(h / 2)], hour: 12,
  edit: (f) => sky(f, 12),
  camera: () => ({ x: w / 2, y: h / 2, zoom: Math.min(1920 / (16 * w), 1080 / (16 * h)) }),
  overlay: (o, c) => {
    for (let x = 0; x < w; x += 5) for (let y = 0; y < h; y += 5) {
      const s = c.scene.screenOfTile(x, y)
      o.chip(s.x, s.y, `${x},${y}`, 0.8)
    }
  },
}))
