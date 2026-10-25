// The project's own pixel art for a wall that is breaking (docs/building.md §10): laid over a piece of a building's
// picture, a room's frame or a built wall as it loses durability, and the shade a hole leaves under what still
// stands over it. Drawn as dark lines with a pale chip beside them, so it reads on plaster, stone, wood and canvas
// alike; on the 16x16 grid.
//
//   npx tsx games/openworld/tools/src/art/damage.ts
//
// Structures/damage.png  4 tiles: the cracks with a third of the wall gone, two thirds, nearly all (a chunk out),
//                        then the shade on the ground under an eave whose wall below is broken.

import { writePng } from './png.ts'

type RGBA = [number, number, number, number]
const PAL: Record<string, RGBA> = {
  '#': [27, 19, 16, 230], // the crack
  '+': [58, 42, 34, 170], // where it fades out
  "'": [244, 230, 200, 150], // a chip's pale edge
  '@': [18, 12, 12, 245], // a chunk gone
}

const CRACKS: string[][] = [
  [
    '................',
    '................',
    '.......#........',
    '.......#........',
    '........#.......',
    "........#'......",
    '.......#........',
    '.......#........',
    '......+.........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    "......'.........",
    '.......#........',
    '.......#........',
    '........#.......',
    "........#'......",
    '.......##.......',
    '.......#.##.....',
    "......#....#'...",
    '......#.........',
    '.....+..........',
    '.....+......+...',
    '..........#.....',
    "...........'....",
    '................',
    '................',
  ],
  [
    "..'.............",
    "...#...'........",
    '...#...#........',
    "....#..#.....'..",
    '....#...#...#...',
    '.....#..#..#....',
    ".....#.@@#'#....",
    '......@@@@#.....',
    '......#@@#.##...',
    ".....#.##....#'.",
    '....#..#......#.',
    '...+...#........',
    '...+....#.......',
    "'.......+.......",
    '................',
    "...........''...",
  ],
]

const px = new Uint8Array(16 * 4 * 16 * 4)
const set = (x: number, y: number, c: RGBA) => px.set(c, (y * 64 + x) * 4)
CRACKS.forEach((grid, f) => grid.forEach((row, y) => [...row].forEach((ch, x) => PAL[ch] && set(16 * f + x, y, PAL[ch]))))
// the shade: darkest at the eave, gone halfway down the cell
const FALL = [225, 200, 170, 135, 100, 70, 42, 20]
FALL.forEach((a, y) => {
  for (let x = 0; x < 16; x++) set(48 + x, y, [13, 11, 18, a])
})
writePng('Structures/damage.png', 64, 16, px)
