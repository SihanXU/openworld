// The gear icons without their backdrop (2026-10-12): the pack's six item-and-weapon skill icons (helmet, shield, armour,
// boots, ring, amulet) are drawn on a coloured square strewn with sparkles; the bag frames gear by its quality (the
// runtime's slot borders, after Dungeon Fighter), so the icon keeps only the thing. Everything reachable from the
// icon's edge without crossing its dark outline is the backdrop, and goes.
//
//   npx tsx games/openworld/tools/src/art/gear-icons.ts

import { resolve } from 'node:path'
import { OUT, readPng, writePng } from './png.ts'
import { Raster, writeAtlas } from './raster.ts'

const PACK = resolve(OUT, '../na/Ui/Skill Icon/Items & Weapon')
// (the pack's Guard is crossed swords on a starburst, touching the edge: the shield is drawn here instead, below)
const ICONS = ['Helmet', 'Armor', 'Boot', 'Ring', 'Amulet']

/** Dark enough to be the outline the backdrop stops at. */
const outline = (r: number, g: number, b: number, a: number) => a > 0 && r + g + b < 200

for (const name of ICONS) {
  const { w, h, rgba } = readPng(`${PACK}/${name}.png`)
  const gone = new Uint8Array(w * h)
  const queue: number[] = []
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = y * w + x
    if (gone[i]) return
    const o = i * 4
    if (outline(rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3])) return
    gone[i] = 1
    queue.push(i)
  }
  for (let x = 0; x < w; x++) push(x, 0), push(x, h - 1)
  for (let y = 0; y < h; y++) push(0, y), push(w - 1, y)
  while (queue.length) {
    const i = queue.pop()!
    const x = i % w
    const y = (i - x) / w
    push(x + 1, y), push(x - 1, y), push(x, y + 1), push(x, y - 1)
  }
  // the backdrop's colour (the commonest at the edge), and what it shows through: a closed loop of the thing (the amulet's
  // chain) that holds mostly backdrop is backdrop too
  const counts = new Map<number, number>()
  for (let i = 0; i < w * h; i++) if (gone[i]) { const o = i * 4; const k = (rgba[o] << 16) | (rgba[o + 1] << 8) | rgba[o + 2]; counts.set(k, (counts.get(k) ?? 0) + 1) }
  const bg = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
  const near = (o: number) => Math.abs(rgba[o] - (bg >> 16)) + Math.abs(rgba[o + 1] - ((bg >> 8) & 255)) + Math.abs(rgba[o + 2] - (bg & 255)) < 60
  const seen = new Uint8Array(w * h)
  for (let start = 0; start < w * h; start++) {
    const so = start * 4
    if (gone[start] || seen[start] || outline(rgba[so], rgba[so + 1], rgba[so + 2], rgba[so + 3])) continue
    const part: number[] = []
    const stack = [start]
    seen[start] = 1
    while (stack.length) {
      const i = stack.pop()!
      part.push(i)
      const x = i % w
      const y = (i - x) / w
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = ny * w + nx
        const o = j * 4
        if (seen[j] || gone[j] || outline(rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3])) continue
        seen[j] = 1
        stack.push(j)
      }
    }
    if (part.filter((i) => near(i * 4)).length >= part.length * 0.6) for (const i of part) gone[i] = 1
  }
  const out = new Uint8Array(rgba)
  for (let i = 0; i < w * h; i++) if (gone[i]) out[i * 4 + 3] = 0
  writePng(`Items/Gear/${name}.png`, w, h, out)
}
// the shield: a heater shield, a steel rim round a blue field, a gold cross on it
const shield = new Raster(16, 16)
const rows: [number, number][] = [[3, 12], [3, 12], [3, 12], [3, 12], [3, 12], [3, 12], [4, 11], [4, 11], [5, 10], [6, 9], [7, 8]]
rows.forEach(([a, b], i) => { for (let x = a; x <= b; x++) shield.set(x, 2 + i, x === a || x === b || i === 0 ? 'D' : 'B') })
for (let y = 3; y <= 11; y++) shield.set(7, y, 'Y'), shield.set(8, y, 'Y')
for (let x = 4; x <= 11; x++) shield.set(x, 5, 'Y')
shield.set(5, 3, 'W')
shield.set(4, 4, 'b')
shield.outline('k')
writeAtlas('Items/Gear/Shield.png', [[shield]], { k: [31, 26, 36, 255], D: [150, 158, 172, 255], B: [64, 104, 176, 255], b: [110, 150, 214, 255], Y: [240, 190, 60, 255], W: [246, 246, 240, 255] })
console.log(`gear icons → ${OUT}/Items/Gear`)
