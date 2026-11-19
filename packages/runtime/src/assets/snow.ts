// Cloudtop's surface is shaded in world pixels. The same inputs give the same
// pixels when a map is reopened or a changed cell is redrawn.
import { hash2, T } from './ground.ts'

type TerrainAt = (x: number, y: number) => string
const FOOTING = new Set(['pine', 'tree', 'rock', 'stump'])
const WALL = new Set(['wall', 'snowwall', 'woodwall', 'cave_wall'])
const lerp = (a: number, b: number, f: number) => a + (b - a) * f
const ease = (f: number) => f * f * (3 - 2 * f)
const unit = (v: number) => Math.max(0, Math.min(1, v))
const sample = (x: number, y: number, seed: number) => hash2(x, y, seed) / 0xffffffff

function noise(x: number, y: number, seed: number): number {
  const a = Math.floor(x), b = Math.floor(y)
  const u = ease(x - a), v = ease(y - b)
  return lerp(lerp(sample(a, b, seed), sample(a + 1, b, seed), u),
    lerp(sample(a, b + 1, seed), sample(a + 1, b + 1, seed), u), v)
}

interface Neighbour { x: number; y: number; wall?: boolean }

// The pack's snow silhouettes contain cool edging and, on some frames, some of
// the ground seen through them. Shade the neutral snow without recolouring grass.
function snowPixel(r: number, g: number, b: number): boolean {
  return Math.min(r, g, b) >= 125 && Math.abs(r - g) <= 27 && Math.abs(g - b) <= 34
}

/** Copy the ground tile and shade only snow and its edge over straw. */
export function paintSnowTile(
  out: Uint8ClampedArray, base: Uint8Array | Uint8ClampedArray, groundAt: TerrainAt, terrainAt: TerrainAt, x: number, y: number,
): void {
  out.set(base)
  if (groundAt(x, y) !== 'snow') return
  let byStraw = false
  const contacts: Neighbour[] = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy
      if (groundAt(nx, ny) === 'drygrass') byStraw = true
      const terrain = terrainAt(nx, ny)
      if (FOOTING.has(terrain)) contacts.push({ x: dx * T, y: dy * T })
      else if (dy <= 0 && WALL.has(terrain)) contacts.push({ x: dx * T, y: dy * T, wall: true })
    }
  }

  for (let j = 0; j < T; j++) {
    for (let i = 0; i < T; i++) {
      const at = (j * T + i) * 4
      if (base[at + 3] !== 255) continue
      const r = base[at], g = base[at + 1], b = base[at + 2]
      const px = x * T + i + 0.5, py = y * T + j + 0.5
      // Follow the pack's coloured rim pixels around the actual drift, including its diagonal corners.
      // Vary that rim along the world instead of adding a straight border inside the straw tile.
      if (byStraw && b >= 119 && g - r >= 5 && g - b >= 3) {
        const frost = unit((noise(px / 15, py / 12, 33) - 0.23) * 1.7) * 0.53
        out[at] = lerp(r, 201, frost)
        out[at + 1] = lerp(g, 192, frost)
        out[at + 2] = lerp(b, 165, frost)
        continue
      }
      if (!snowPixel(r, g, b)) continue

      const broad = (noise(px / 78, py / 66, 7) - 0.49) * 21
      const temperature = (noise(px / 109, py / 93, 19) - 0.5) * 10
      // Long, sparse wind crests, with a slightly colder lee below the crest.
      const alongWind = (py + px * 0.18) / 11
      const crest = unit((noise(px / 49, alongWind, 56) - 0.69) * 4.5)
      const lee = unit((noise(px / 49, alongWind - 0.22, 56) - 0.69) * 4.5)
      const grains = hash2(Math.floor(px), Math.floor(py), 91) % 601
      let contact = 0
      for (const mark of contacts) {
        const dx = i + 0.5 - mark.x
        const dy = j + 0.5 - mark.y
        const fade = mark.wall
          ? unit(1 - Math.abs(dy - T) / 5) * unit((9 - Math.abs(dx - T / 2)) / 3)
          : unit(1 - Math.hypot((dx - T / 2) / 12, (dy - 14) / 6))
        contact = Math.max(contact, fade)
      }
      const shade = broad + crest * 8 - lee * 5 - contact * 9 + (grains === 0 ? 5 : grains <= 2 ? -4 : 0)
      out[at] = r + shade + temperature - contact * 2
      out[at + 1] = g + shade + temperature * 0.15
      out[at + 2] = b + shade - temperature + crest * 2 + contact * 3
    }
  }
}
