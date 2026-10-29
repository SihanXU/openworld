// What a window of the scale film is a view of, beside how it looks (likeness.mjs): its composition — the place it is
// of (its seasons and its festival day being the same place), or for a hall the plan whose shell its walls are — and
// where on it. Two windows of one composition that share more than half the cells of the smaller are one view, however
// their light, their season or the people in them differ.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PUB = 'games/openworld/public/world/maps'
const shellOf = new Map()
/** A shot's composition: a hall's plan (its shell), a place's family. */
export function compOf(e) {
  if (!e.inside) return e.family
  if (e.src) return `plan:${e.map.split('.')[1]}`
  if (!shellOf.has(e.map)) {
    const c = JSON.parse(readFileSync(join(PUB, `${e.map}.json`), 'utf8'))
    const s = (c.map.stamps ?? []).map((t) => /^([a-z0-9]+)_shell@/.exec(String(t.key))?.[1]).find(Boolean)
    shellOf.set(e.map, s ? `plan:${s}` : e.map)
  }
  return shellOf.get(e.map)
}
/** A shot's window in its map's cells: [x0, y0, w, h]. */
export const rectOf = (e) => [e.x - e.w / 2, e.y - e.h / 2, e.w, e.h]
/** One view: the same composition, more than half the smaller window shared. */
export function sameView(a, b) {
  if (a.comp !== b.comp) return false
  const [ax, ay, aw, ah] = a.rect, [bx, by, bw, bh] = b.rect
  const ox = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx)), oy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by))
  return (ox * oy) / Math.min(aw * ah, bw * bh) > 0.5
}
