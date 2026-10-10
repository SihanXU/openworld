// The project's own pixel art for what the Ninja Adventure subset lacks: the meadow's cow and
// chicken (sheets in the pack's layout: 16x16 frames, columns down/up/left/right, rows the walk).
// Drawn from character grids, written as PNGs to public/assets/lsw/ (the food icons: food.ts).
//
//   npx tsx packages/tools/src/art/animals.ts

import { OUT, writePng } from './png.ts'

type RGBA = [number, number, number, number]
const PAL: Record<string, RGBA> = {
  '.': [0, 0, 0, 0],
  k: [34, 28, 26, 255], // outline
  w: [244, 240, 228, 255], // white
  g: [200, 194, 182, 255], // shade
  b: [52, 44, 42, 255], // black patch
  p: [236, 160, 160, 255], // pink muzzle / raw meat
  P: [200, 110, 110, 255], // darker pink
  h: [150, 110, 70, 255], // horn / hoof
  r: [214, 52, 44, 255], // comb
  y: [244, 178, 52, 255], // beak / legs
  e: [20, 20, 20, 255], // eye
}

/** 16x16 grids; each sheet is 4 directions x 4 frames. */
function sheet(frames: { down: string[][]; up: string[][]; side: string[][] }): Uint8Array {
  const W = 64
  const px = new Uint8Array(W * W * 4)
  const put = (col: number, row: number, grid: string[], flip: boolean) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const c = grid[y]?.[flip ? 15 - x : x] ?? '.'
        const [r, g, b, a] = PAL[c] ?? PAL['.']
        const i = ((row * 16 + y) * W + col * 16 + x) * 4
        px.set([r, g, b, a], i)
      }
  }
  for (let f = 0; f < 4; f++) {
    put(0, f, frames.down[f % frames.down.length], false)
    put(1, f, frames.up[f % frames.up.length], false)
    put(2, f, frames.side[f % frames.side.length], false)
    put(3, f, frames.side[f % frames.side.length], true)
  }
  return px
}

/** A grid with its body lifted by one pixel (the walk's bob). */
const bob = (g: string[]) => [...g.slice(1), '................']

// ---------------------------------------------------------------- the cow (seen from the left in its side view)
const COW_SIDE = [
  '................',
  '................',
  '................',
  '..hk............',
  '.kwwk...........',
  'kwewwkkkkkkkkk..',
  'kwwwwwwbbwwwwwk.',
  'kppwwwbbbwwbbwwk',
  'kppkwwwbwwwbbwwk',
  '.kk.kwwwwwwwwwgk',
  '....kwwwwwwwwggk',
  '....kgggggggggk.',
  '....kwk.kwk.kwk.',
  '....khk.khk.khk.',
  '................',
  '................',
]
const COW_SIDE2 = [...COW_SIDE.slice(0, 12), '....kwkkwk..kwk.', '...khk..khk.khk.', '................', '................']
const COW_DOWN = [
  '................',
  '................',
  '...hk......kh...',
  '....kkkkkkkk....',
  '...kwwwwwwwwk...',
  '...kwewwwwewk...',
  '...kwwbbwwwwk...',
  '..kkwwbbwwwwkk..',
  '..kwkppppppkwk..',
  '..kwkpPppPpkwk..',
  '..kwwkppppkwwk..',
  '..kgwwkkkkwwgk..',
  '...kggggggggk...',
  '...kwk....kwk...',
  '...khk....khk...',
  '................',
]
const COW_UP = [
  '................',
  '................',
  '...hk......kh...',
  '....kkkkkkkk....',
  '...kwwwwwwwwk...',
  '...kwwbbwwwwk...',
  '..kkwwbbbwwwkk..',
  '..kwwwwbwwwwwk..',
  '..kwwwwwwbbwwk..',
  '..kwwwwwwbbwwk..',
  '..kwwwwwwwwwwk..',
  '..kgwwwwwwwwgk..',
  '...kggggkgggk...',
  '...kwk..k.kwk...',
  '...khk....khk...',
  '................',
]

// ---------------------------------------------------------------- the chicken
const HEN_SIDE = [
  '................',
  '................',
  '................',
  '................',
  '....kr..........',
  '...kwrk.........',
  '..ykewk.........',
  '...kwwk....kk...',
  '...kwwwkkkkwwk..',
  '...kwwwwwwwwwk..',
  '....kwwwgwwwk...',
  '....kgwggggk....',
  '.....kkkkkk.....',
  '......y..y......',
  '.....yy.yy......',
  '................',
]
const HEN_SIDE2 = [...HEN_SIDE.slice(0, 13), '......y.y.......', '.....yy.yy......', '................']
const HEN_DOWN = [
  '................',
  '................',
  '................',
  '................',
  '.......rr.......',
  '......krrk......',
  '.....kwwwwk.....',
  '.....kewwek.....',
  '.....kwyywk.....',
  '....kwwrrwwk....',
  '...kwwwwwwwwk...',
  '...kgwwwwwwgk...',
  '....kggggggk....',
  '.....kkkkkk.....',
  '......y..y......',
  '................',
]
const HEN_UP = [
  '................',
  '................',
  '................',
  '................',
  '.......rr.......',
  '......krrk......',
  '.....kwwwwk.....',
  '.....kwwwwk.....',
  '....kkwwwwkk....',
  '...kwwwwwwwwk...',
  '...kwwwggwwwk...',
  '...kgwwggwwgk...',
  '....kggggggk....',
  '.....kkkkkk.....',
  '......y..y......',
  '................',
]

writePng('Animal/Cow/SpriteSheet.png', 64, 64, sheet({ down: [COW_DOWN, bob(COW_DOWN)], up: [COW_UP, bob(COW_UP)], side: [COW_SIDE, COW_SIDE2] }))
writePng('Animal/Chicken/SpriteSheet.png', 64, 64, sheet({ down: [HEN_DOWN, bob(HEN_DOWN)], up: [HEN_UP, bob(HEN_UP)], side: [HEN_SIDE, HEN_SIDE2] }))
console.log(`animals → ${OUT}`)
