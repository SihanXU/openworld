// The minor monsters that wore the pack's sheets under a multiplying tint (docs/creatures.md §17) recoloured pixel by
// pixel instead, as alberic-human.swift does the pack's Master: every colour of the pack's sheet mapped to its own, the
// drawing and its dark line kept, and on the slimes and the sporecap what tells them apart drawn on each frame — a
// flame that flickers on the fire slime's crown, shards of ice on the frost slime's, a spark leaping off the spark
// slime, spores drifting off the sporecap's cap. A frame's marks are outlined where they meet the empty air, and lowered
// together where the body leaps too near the frame's top for them.
//
//   npx tsx games/openworld/tools/src/art/recolours.ts

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { readPng, writePng, OUT } from './png.ts'

type Mark = [number, number, string]
type Marks = (top: number, mid: number, step: number) => Mark[]
interface Recolour { from: string; to: string; map: Record<string, string>; marks?: Marks; line?: string; face?: string }

const PACK = resolve(dirname(fileURLToPath(import.meta.url)), '../../../public/assets/na/Actor')

const flame: Marks = (top, mid, step) => {
  const s = [0, 1, 0, -1][step]
  return [
    [mid - 1, top, '#f07a2c'], [mid, top, '#ffd36a'], [mid + 1, top, '#f07a2c'],
    [mid - 1, top - 1, '#f07a2c'], [mid, top - 1, '#fff4c0'], [mid + 1, top - 1, '#ffd36a'],
    [mid + s, top - 2, '#ffd36a'], [mid + s - 1, top - 2, '#f07a2c'],
    [mid + s, top - 3, step % 2 ? '#fff4c0' : '#ffd36a'],
    [mid - s, top - 4, '#f07a2c'],
  ]
}
const shards: Marks = (top, mid) => [
  [mid - 1, top - 1, '#3ad6ff'], [mid, top - 1, '#7fe8ff'], [mid + 1, top - 1, '#3ad6ff'],
  [mid, top - 2, '#3ad6ff'], [mid, top - 3, '#ffffff'], [mid + 1, top - 2, '#ffffff'], [mid - 2, top, '#7fe8ff'],
]
const spark: Marks = (top, mid, step) => {
  const [x, y] = [[-6, 2], [5, 1], [-5, 6], [6, 5]][step]
  return [[mid + x, top + y, '#fff8c0'], [mid + x + (x < 0 ? 1 : -1), top + y + 1, '#4ad6ff']]
}
const spores: Marks = (top, mid, step) => [[mid - 3 + step, top - 1 - (step % 2), '#d8f070'], [mid + 3 - (step >> 1), top - 2 + (step % 2), '#b8e05a']]

export const RECOLOURS: Recolour[] = [
  {
    from: 'Monster/Slime/Slime.png', to: 'Creature/FireSlime', face: 'Monster/Slime/Faceset.png',
    map: { '#141b1b': '#2a120c', '#4e484a': '#6a2414', '#548789': '#c2421e', '#79b8ce': '#f07a2c', '#f2eaf1': '#ffd36a', '#ffffff': '#fff4c0', '#4a5270': '#6a2414', '#9ba7aa': '#f07a2c' },
    marks: flame, line: '#2a120c',
  },
  {
    from: 'Monster/Slime/Slime.png', to: 'Creature/FrostSlime', face: 'Monster/Slime/Faceset.png',
    map: { '#141b1b': '#1d2f44', '#4e484a': '#4a78a8', '#548789': '#7fb6dc', '#79b8ce': '#bfe6f8', '#f2eaf1': '#ffffff', '#ffffff': '#ffffff', '#4a5270': '#4a78a8', '#9ba7aa': '#7fb6dc' },
    marks: shards, line: '#1d2f44',
  },
  {
    from: 'Monster/Slime2/Slime2.png', to: 'Creature/SparkSlime', face: 'Monster/Slime2/Faceset.png',
    map: { '#141b1b': '#2a2210', '#56864c': '#7a5a10', '#74a334': '#c49a18', '#adbc3a': '#f2d230', '#e0394c': '#4ad6ff', '#f2eaf1': '#fff8c0', '#8f3e56': '#1f7fb0', '#fce2ca': '#ffffff' },
    marks: spark,
  },
  {
    from: 'Monster/Mushroom/mushroom.png', to: 'Creature/Sporecap',
    map: { '#8f3e56': '#5e2e86', '#e0394c': '#9a5ac8', '#f2eaf1': '#d8f070', '#9ba7aa': '#c8bca8', '#5f7160': '#8a7e6a' },
    marks: spores,
  },
  {
    from: 'Monster/Beast2/Beast2.png', to: 'Creature/FrostWolf', face: 'Monster/Beast2/Faceset.png',
    map: { '#141b1b': '#1d2f44', '#4e484a': '#4a78a8', '#5f7160': '#8fc4ec', '#fce2ca': '#d6f0ff', '#ffffff': '#ffffff', '#f2ad7d': '#7fe8ff', '#3b3643': '#2a4a6e', '#9ba7aa': '#d6f0ff' },
  },
  {
    from: 'Character/Inspector/SpriteSheet.png', to: 'Creature/HollowClerk', face: 'Character/Inspector/Faceset.png',
    map: { '#ef914f': '#b8b4a0', '#d14b34': '#8a8676', '#a3754e': '#6a6478', '#91522c': '#4a4658', '#f2eaf1': '#d8ceb0', '#abc2bc': '#a89e84', '#5c2d25': '#5a5648' },
  },
  {
    from: 'Character/Monk2/SpriteSheet.png', to: 'Creature/Restless', face: 'Character/Monk2/Faceset.png',
    map: { '#ef914f': '#dcdad0', '#d14b34': '#a8a49a', '#8f3e56': '#5c5866', '#e0394c': '#8a8494', '#2d697b': '#4a5a66' },
  },
]

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

function recolour(src: string, map: Record<string, string>): { w: number; h: number; rgba: Uint8Array } {
  const img = readPng(src)
  for (let i = 0; i < img.rgba.length; i += 4) {
    const to = img.rgba[i + 3] ? map[hex(img.rgba[i], img.rgba[i + 1], img.rgba[i + 2])] : undefined
    if (to) img.rgba.set(rgb(to), i)
  }
  return img
}

function mark(img: { w: number; h: number; rgba: Uint8Array }, marks: Marks, line?: string): void {
  const at = (x: number, y: number) => (y * img.w + x) * 4
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < img.w && y < img.h && img.rgba[at(x, y) + 3] > 0
  for (let fy = 0; fy < img.h; fy += 16)
    for (let fx = 0; fx < img.w; fx += 16) {
      const rows = [...Array(16).keys()].filter((y) => [...Array(16).keys()].some((x) => solid(fx + x, fy + y)))
      if (!rows.length) continue
      const top = rows[0]
      const xs = [...Array(16).keys()].filter((x) => solid(fx + x, fy + top))
      const mid = Math.round((xs[0] + xs[xs.length - 1]) / 2)
      const drawn = marks(top, mid, fy / 16)
      const dy = Math.max(0, -Math.min(...drawn.map(([, y]) => y)))
      const placed = drawn.filter(([x, y]) => x >= 0 && x < 16 && y + dy < 16).map(([x, y, c]) => [fx + x, fy + y + dy, c] as Mark)
      for (const [x, y, c] of placed) img.rgba.set([...rgb(c), 255], at(x, y))
      if (line) for (const [x, y] of placed) for (const [dx, dy] of [[1, 0], [-1, 0]])
        if (x + dx >= fx && x + dx < fx + 16 && y + dy >= fy && !solid(x + dx, y + dy)) img.rgba.set([...rgb(line), 255], at(x + dx, y + dy))
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const r of RECOLOURS) {
    const sheet = recolour(join(PACK, r.from), r.map)
    if (r.marks) mark(sheet, r.marks, r.line)
    writePng(`${r.to}/SpriteSheet.png`, sheet.w, sheet.h, sheet.rgba)
    if (r.face && existsSync(join(PACK, r.face))) {
      const face = recolour(join(PACK, r.face), r.map)
      writePng(`${r.to}/Faceset.png`, face.w, face.h, face.rgba)
    }
  }
  console.log(`recoloured sheets written to ${OUT}/Creature: ${RECOLOURS.length}`)
}
