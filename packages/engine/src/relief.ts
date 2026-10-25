// The relief's faces (world-model.md §5.5). A map is seen from the south and above, so where the ground drops toward
// the south its face of rock stands on the lower ground below the edge, a cell a level: one cell for a ledge a level
// high (a drop of two or three half levels), as many as its levels for a higher one. The renderers draw it there
// (runtime ground.ts terracePieces); the engine holds the same cells as rock (World.blocked), so no one walks into or
// along a face, and one only leaps a ledge's face from its top (World.stepOver).

/** The levels a drop of `d` half levels is (a ramp's odd half rounds down: 2 and 3 are a level). */
export const dropLevels = (d: number): number => Math.floor(d / 2)

const cache = new WeakMap<readonly number[], Uint8Array>()

/**
 * Each cell of a map with heights (row-major, half levels): 0 where it is ground, else the levels of the face that
 * covers it — the face below a cell whose neighbour to the south lies a level or more lower, as many cells down as it
 * is levels high. Where two faces cover a cell, the taller one.
 */
export function faceCells(width: number, height: number, heights: readonly number[]): Uint8Array {
  const hit = cache.get(heights)
  if (hit && hit.length === width * height) return hit
  const out = new Uint8Array(width * height)
  for (let y = 0; y + 1 < height; y++)
    for (let x = 0; x < width; x++) {
      const levels = dropLevels((heights[y * width + x] ?? 0) - (heights[(y + 1) * width + x] ?? 0))
      for (let k = 1; k <= levels && y + k < height; k++) {
        const i = (y + k) * width + x
        out[i] = Math.max(out[i], levels)
      }
    }
  cache.set(heights, out)
  return out
}
