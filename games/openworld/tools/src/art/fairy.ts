// The project's own pixel art for the companion: Pip, a fairy — a small girl with pale gold hair, a
// pink flower in it, a leaf-green dress and glassy wings. The pack has no fairy, so she is drawn
// here from character grids, in the pack's style (dark outlines, flat tones):
// - SpriteSheet.png: one row of four 16x16 frames, the wings' beat (up, middle, down, middle);
//   she is small, about eleven pixels of the sixteen, and faces the viewer (the renderer mirrors her);
// - Faceset.png: a 38x38 portrait for her lines (a 19x19 grid, doubled).
//
//   npx tsx games/openworld/tools/src/art/fairy.ts

import { OUT, writePng } from './png.ts'

type RGBA = [number, number, number, number]
const PAL: Record<string, RGBA> = {
  '.': [0, 0, 0, 0],
  k: [43, 34, 48, 255], // outline
  h: [244, 210, 122, 255], // hair
  H: [201, 154, 69, 255], // hair shade
  f: [244, 143, 177, 255], // flower
  s: [251, 215, 183, 255], // skin
  S: [226, 176, 144, 255], // skin shade
  b: [242, 162, 162, 255], // blush
  e: [59, 47, 107, 255], // eye
  i: [255, 255, 255, 255], // eye light
  d: [124, 207, 138, 255], // dress
  D: [79, 158, 99, 255], // dress shade
  w: [205, 239, 252, 170], // wing (glassy)
  W: [143, 208, 236, 225], // wing edge
  y: [255, 244, 160, 255], // sparkle
}

/** Her body, the same in every frame (rows 3–13 of the 16). */
const BODY = [
  '................',
  '................',
  '................',
  '......kkkk......',
  '.....khhfhk.....',
  '....khhhhhHk....',
  '....khesseHk....',
  '...khkbssbkHk...',
  '...khhkddkHHk...',
  '...khsdddDsHk...',
  '....kkddDdkk....',
  '....kdddddDk....',
  '....kdDdDdDk....',
  '.....kkkkkk.....',
  '......k..k......',
  '................',
]

/** The left wing in three beats (four columns, rows from `top`); the right one is its mirror. */
const WINGS: { top: number; rows: string[] }[] = [
  { top: 3, rows: ['WW..', 'Www.', 'Wwww', '.Www', '..Ww'] }, // up
  { top: 6, rows: ['.WW.', 'Wwww', 'Wwww', '.Www', '..Ww', '..W.'] }, // middle
  { top: 8, rows: ['..Ww', '.Www', 'Wwww', 'Www.', 'WW..'] }, // down
]
/** A sparkle she sheds, one per frame. */
const SPARKLES: [number, number][] = [[7, 14], [9, 15], [6, 15], [8, 14]]

function frame(beat: number, sparkle: [number, number]): string[] {
  const g = BODY.map((r) => r.split(''))
  const wing = WINGS[beat]
  wing.rows.forEach((r, dy) => {
    for (let x = 0; x < 4; x++) {
      const c = r[x]
      if (c === '.') continue
      const y = wing.top + dy
      // behind her: only where she is not drawn
      if (g[y][x + 1] === '.') g[y][x + 1] = c
      if (g[y][14 - x] === '.') g[y][14 - x] = c
    }
  })
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

/** Her portrait: head and shoulders, a wing's edge behind (19x19, doubled to the pack's 38x38). */
const FACE = [
  '...................',
  '......kkkkkkk......',
  '....kkhhhhhhhkk....',
  '...khhhhhhhhffhk...',
  '..khhhhhhhhhhfhHk..',
  '..khhhhhhhhhhhhHk..',
  '.Wkhhhhhhhhhhhhhkw.',
  'WwkhhsshhhhhsshhkwW',
  'WwkhsskkssskkssHkwW',
  'WwkhssiesssiessHkwW',
  '.WkhsseessseessHkW.',
  '..khsbbsssssbbsHk..',
  '..khsssssbsssssHk..',
  '...khsssssssssHk...',
  '....kkssssssskk....',
  '.....kkdddddkk.....',
  '....kddddDddddk....',
  '...kdddddDdddddk...',
  '...kdddddDdddddk...',
]

writePng('Companion/Fairy/SpriteSheet.png', 64, 16, paint([frame(0, SPARKLES[0]), frame(1, SPARKLES[1]), frame(2, SPARKLES[2]), frame(1, SPARKLES[3])], 16))
writePng('Companion/Fairy/Faceset.png', 38, 38, paint([FACE], 19, 2))
console.log(`fairy → ${OUT}/Companion/Fairy`)
