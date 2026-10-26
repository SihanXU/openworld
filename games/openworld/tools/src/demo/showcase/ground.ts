// What the regions' showcase places share about their ground (docs/showcase.md §4b): a stair down a shelf's face, a
// pool of light round a lamp or a fire, the snow laid back over what a row of houses made green, a ramp of switchbacks.

import { rng, type MapBuilder } from '../builder.ts'

/**
 * A stair down the face below a shelf from `top` to `bottom` (half levels; a map's heights are a digit a cell, 9 at
 * most): `w` cells wide from row `y`, a row for every half level between the two, each a half lower (walked ground).
 */
export function stair(b: MapBuilder, x: number, y: number, w: number, top: number, bottom: number, t = 'cobble'): void {
  for (let h = top - 1, r = y; h > bottom; h--, r++) {
    b.rect(x, r, w, 1, t)
    b.raise(x, r, w, 1, h)
  }
}

/** The glow a lamp, a brazier or a fire lays on the ground round it. */
export function glowAt(b: MapBuilder, x: number, y: number, when: 'night' | 'always' = 'night', strength = 0.32, color = '#ff9a4a'): void {
  b.lights.push({ x: x + 0.5, y: y + 0.6, w: 3.2, h: 2.2, color, shape: 'glow', when, strength })
}

/**
 * The snow laid back over a northern place: what the rows of houses made garden (grass, beds, hedges) snow again, their
 * trees pines, and drifts over the paving where the wind leaves them (soft patches, never a speckle).
 */
export function snowOver(b: MapBuilder): void {
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const t = b.get(x, y)
      if (t === 'grass' || t === 'flowerbed' || t === 'flowers') b.set(x, y, 'snow')
      else if (t === 'tree') b.set(x, y, 'pine')
    }
  for (let k = 0; k < Math.round((b.w * b.h) / 140); k++) {
    const x = rng.int(0, b.w - 1)
    const y = rng.int(0, b.h - 1)
    b.organic(x, y, rng.int(1, 3), rng.int(1, 2), 'snow', { rough: 0.5, only: (c) => c === 'cobble' || c === 'flagstone' || c === 'gravel' || c === 'dirt' })
  }
}

/** A run of the March's palisade along row `y` from x0 to x1: its pieces as long as fit, a cell left over a stake fence. */
export function palisade(b: MapBuilder, x0: number, x1: number, y: number): void {
  let x = x0
  while (x <= x1) {
    const n = [8, 6, 4, 3].find((k) => x + k - 1 <= x1)
    if (!n) {
      b.fence('fence', [x, y], [x1, y])
      return
    }
    b.building(`march_palisade_x${n}`, x, y, [], true)
    x += n
  }
}

/** Ground of `t` laid over every cell of `from` in the rect (a region's own ground where the rows left grass). */
export function regrass(b: MapBuilder, from: string[], t: string, x0 = 0, y0 = 0, w = b.w, h = b.h): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (b.in(x, y) && from.includes(b.get(x, y))) b.set(x, y, t)
}

/** Every anchor of the map on a cell one can stand on: one that the clutter or a face took is moved to the nearest free. */
export function standAnchors(b: MapBuilder): void {
  const ok = (x: number, y: number) => b.passable(x, y) && !b.face(x, y) && !b.get(x, y).includes('water')
  for (const a of Object.values(b.anchors)) {
    if (ok(a[0], a[1])) continue
    search: for (let r = 1; r < 10; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++)
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(a[0] + dx, a[1] + dy)) {
            a[0] += dx
            a[1] += dy
            break search
          }
  }
}
