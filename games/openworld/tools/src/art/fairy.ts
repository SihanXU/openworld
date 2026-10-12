// The project's own pixel art for the companion: Lumi, a fairy (2026-10-12; she was Pip) — what is left of the second
// vessel (docs/lore.md), small and light: a big round head of moon-pale lavender hair with a star pinned in it (it
// glows: the seals' power finds her), large violet eyes, a white dress with a star at the collar, glassy wings
// touched with pink. The pack has no fairy, so she is drawn here from character grids, in the pack's style (dark
// outlines, flat tones), chibi-proportioned so she reads at sixteen pixels:
// - SpriteSheet.png: one row of four 16x16 frames, the wings' beat (up, middle, down, middle); she faces the
//   viewer (the renderer mirrors her);
// - Faceset.png: a 38x38 portrait for her lines (a 19x19 grid, doubled).
//
//   npx tsx games/openworld/tools/src/art/fairy.ts [preview-dir]   (a preview dir: the same, eight times larger)

import { png, OUT, writePng } from './png.ts'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

type RGBA = [number, number, number, number]
const PAL: Record<string, RGBA> = {
  '.': [0, 0, 0, 0],
  k: [62, 42, 78, 255], // outline
  h: [236, 229, 255, 255], // hair
  H: [190, 172, 236, 255], // hair shade
  j: [150, 128, 208, 255], // hair deep shade
  g: [255, 214, 102, 255], // the star
  G: [255, 250, 214, 255], // its heart
  s: [255, 233, 218, 255], // skin
  S: [242, 200, 184, 255], // skin shade
  b: [255, 168, 192, 255], // blush
  m: [208, 96, 128, 255], // mouth
  e: [96, 70, 184, 255], // eye
  E: [150, 160, 240, 255], // eye's lower light
  i: [255, 255, 255, 255], // eye light
  d: [246, 248, 255, 255], // dress
  D: [178, 196, 238, 255], // dress shade
  w: [214, 242, 255, 210], // wing (glassy)
  p: [255, 202, 240, 220], // wing's pink
  W: [112, 178, 236, 255], // wing edge
  y: [255, 244, 170, 255], // sparkle
}

/** Her body, the same in every frame. */
const BODY = [
  '................',
  '.....kkkkkk.....',
  '...kkhhhhhhkk...',
  '..khhhhhhhhhhk..',
  '.khhhhhhhhhhhhk.',
  '.khhhHhhhhHhhhk.',
  '.khhHhhhhhhHhHk.',
  '.kHhjhssshjhHHk.',
  '.kHjsiessiesjHk.',
  '.kHjsEEssEEsjHk.',
  '.kHjbssmmssbjHk.',
  '..kHkSssssSkHk..',
  '.....kddddk.....',
  '....ksdddDsk....',
  '...kdddddDDdk...',
  '....kkkkkkkk....',
]

/** The star in her hair, about a centre: its points and its heart. */
const star = (cx: number, cy: number): [number, number, string][] => [[cx, cy - 1, 'g'], [cx - 1, cy, 'g'], [cx, cy, 'G'], [cx + 1, cy, 'g'], [cx, cy + 1, 'g']]

/**
 * Her wings, a butterfly's two pairs, in three beats: the upper pair raised (up), both half (middle), the lower pair
 * spread (down). The left ones as rows from the top (five columns); the right ones their mirror; only where she is not.
 */
const WINGS: Record<number, string>[] = [
  { 0: 'WW...', 1: 'WwW..', 2: 'WpwW.', 3: '.Ww..', 4: '..W..', 12: '.W...', 13: 'Wp...', 14: '.W...' }, // up
  { 1: '.W...', 2: 'WwW..', 3: 'Wpw..', 4: '.W...', 11: '.W...', 12: 'WwW..', 13: 'Wpw..', 14: '.W...' }, // middle
  { 2: '.W...', 3: 'Ww...', 4: '.W...', 11: 'WW...', 12: 'WwW..', 13: 'WpwW.', 14: 'Wpw..', 15: '.WW..' }, // down
]
/** A sparkle she sheds, one per frame. */
const SPARKLES: [number, number][] = [[1, 3], [15, 7], [0, 9], [14, 1]]

function frame(beat: number, sparkle: [number, number]): string[] {
  const g = BODY.map((r) => r.split(''))
  for (const [x, y, c] of star(13, 2)) g[y][x] = c
  for (const [row, r] of Object.entries(WINGS[beat])) {
    const y = Number(row)
    for (let x = 0; x < r.length; x++) {
      const c = r[x]
      if (c === '.') continue
      if (g[y][x] === '.') g[y][x] = c
      if (g[y][15 - x] === '.') g[y][15 - x] = c
    }
  }
  const [sx, sy] = sparkle
  if (g[sy][sx] === '.') g[sy][sx] = 'y'
  return g.map((r) => r.join(''))
}

function paint(grids: string[][], size: number, scale = 1): Uint8Array {
  const W = grids.length * size * scale
  const H = size * scale
  const px = new Uint8Array(W * H * 4)
  grids.forEach((grid, n) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const rgba = PAL[grid[y]?.[x] ?? '.'] ?? PAL['.']
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) px.set(rgba, ((y * scale + dy) * W + (n * size + x) * scale + dx) * 4)
      }
  })
  return px
}

/** Her portrait: head and shoulders, the star in her hair, her wings behind (19x19, doubled to the pack's 38x38). */
const FACE_BASE = [
  '.......kkkkk.......',
  '.....kkhhhhhkk.....',
  '....khhhhhhhhhk....',
  '...khhhhhhhhhhhk...',
  '..khhhHhhhhhhHhhk..',
  '..khhHhhhhhhhhHhk..',
  '.khhHhhhhhhhhhhHhk.',
  '.khHhjhhhhhhhjhHhk.',
  '.kHhjsshhjhhssjhHk.',
  '.kHjsssssssssssjHk.',
  '.kHjseeessseeesjHk.',
  '.kHjsieesssieesjHk.',
  '.kHjseEessseEesjHk.',
  '.kHjbbsssmsssbbjHk.',
  '..kHkSsssssssSkHk..',
  '...kHkkSsssSkkHk...',
  '...kdddddGdddddk...',
  '..kddddDdddDddddk..',
  '.kdddddDdddDdddddk.',
]

function face(): string[] {
  const g = FACE_BASE.map((r) => r.slice(0, 19).padEnd(19, '.').split(''))
  for (const [x, y, c] of star(14, 3)) g[y][x] = c
  // the wings behind her shoulders, both sides
  const wing = ['W...', 'Ww..', 'WpW.', 'Wpw.', 'WwwW', '.WwW', '..WW']
  wing.forEach((r, dy) => {
    for (let x = 0; x < r.length; x++) {
      const y = 10 + dy
      if (r[x] === '.' || y > 18) continue
      if (g[y][x] === '.') g[y][x] = r[x]
      if (g[y][18 - x] === '.') g[y][18 - x] = r[x]
    }
  })
  return g.map((r) => r.join(''))
}

const sheet = [frame(0, SPARKLES[0]), frame(1, SPARKLES[1]), frame(2, SPARKLES[2]), frame(1, SPARKLES[3])]
const preview = process.argv[2]
if (preview) {
  writeFileSync(join(preview, 'lumi-sheet.png'), png(64 * 8, 16 * 8, paint(sheet, 16, 8)))
  writeFileSync(join(preview, 'lumi-face.png'), png(38 * 8, 38 * 8, paint([face()], 19, 16)))
  console.log(`preview → ${preview}`)
} else {
  writePng('Companion/Fairy/SpriteSheet.png', 64, 16, paint(sheet, 16))
  writePng('Companion/Fairy/Faceset.png', 38, 38, paint([face()], 19, 2))
  console.log(`fairy → ${OUT}/Companion/Fairy`)
}
