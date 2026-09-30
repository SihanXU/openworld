// Layered 16x16 chibi characters: 3 columns (stand, stepA, stepB) x 4 rows (down, left,
// right, up). Layers: back gear -> body (skin, top, bottom, shoes) -> torso gear -> head
// (skin, eyes, beard, hair, hat) -> front gear, then an automatic tinted 1-px outline.
// Right-facing frames are mirrored from the left-facing ones.

import { OUTLINE, Pix, mix, packGrid, shade, type Sheet } from './core.ts'

type Dir = 'down' | 'left' | 'up'
type Grid = string[]
type PerDir = Record<Dir, Grid>

// ---------------------------------------------------------------------------------------
// Palettes (indices from Appearance wrap around)

export const SKIN_TONES: [string, string][] = [
  ['#ffe0c4', '#eab08e'],
  ['#f8cfa6', '#dc9e76'],
  ['#efbd8c', '#d09264'],
  ['#e0a574', '#bc7b52'],
  ['#c98a58', '#a2663e'],
  ['#ad7248', '#855232'],
  ['#8c5a3a', '#693f28'],
  ['#6a4230', '#4c2c20'],
  ['#f6d6c4', '#d8a898'],
  ['#d8b088', '#b48862'],
]

export const HAIR_COLORS: string[] = [
  '#2e2a36',
  '#4e3226',
  '#8a5230',
  '#e8c25a',
  '#c8622c',
  '#9c3e2a',
  '#f0e2b0',
  '#9a9aa6',
  '#eeeef2',
  '#b08050',
  '#34467a',
  '#3a8a86',
  '#e07aa0',
  '#6e4ea0',
  '#5a8a3a',
  '#6e3a22',
]

export const CLOTH_COLORS: string[] = [
  '#3d6fd0', // 0 hero blue
  '#6e4a32', // 1 brown
  '#c0403a', // 2 red
  '#4f9a44', // 3 green
  '#e0b83e', // 4 yellow
  '#7a4aa8', // 5 purple
  '#2f8a84', // 6 teal
  '#d8742e', // 7 orange
  '#2e3c6e', // 8 navy
  '#8e2a3c', // 9 crimson
  '#2f6a3f', // 10 forest
  '#b89468', // 11 tan
  '#e6d8b4', // 12 cream
  '#8a8c94', // 13 grey
  '#3e3e4a', // 14 charcoal
  '#e07a96', // 15 pink
  '#6aa6e0', // 16 sky
  '#7e7e3c', // 17 olive
  '#8a3a6a', // 18 plum
  '#6e2a2a', // 19 maroon
  '#eceae4', // 20 white
  '#2a2630', // 21 black
  '#c89a38', // 22 mustard
  '#4a3e96', // 23 indigo
  '#7ab84a', // 24 leaf
  '#a8502a', // 25 rust
]

export const HAIR_STYLE_COUNT = 10

/** Wrap any number (negative, huge, NaN) into [0, n). */
const wrapIdx = (i: number, n: number): number => {
  const k = Number.isFinite(i) ? Math.floor(i) : 0
  return ((k % n) + n) % n
}
const at = <T,>(xs: T[], i: number): T => xs[wrapIdx(i, xs.length)]

// ---------------------------------------------------------------------------------------
// Body grids. Rows 9..14 (adult). Chars: T/t/Y top, B/b bottom, F/f/D shoes, S skin.

const BODY_DOWN: Grid[] = [
  [
    '....TTTTTTTT....',
    '...tYTTTTTTTt...',
    '...StTTTTTTtS...',
    '....BBBBBBBB....',
    '....BBb..bBB....',
    '....FFf..fFF....',
  ],
  [
    '....TTTTTTTT....',
    '...tYTTTTTTTt...',
    '...tTTTTTTTtS...',
    '...SBBBBBBBB....',
    '....BBb..FfF....',
    '....FFf.........',
  ],
  [
    '....TTTTTTTT....',
    '...tYTTTTTTTt...',
    '...StTTTTTTTt...',
    '....BBBBBBBBS...',
    '....FfF..bBB....',
    '.........fFF....',
  ],
]

const BODY_LEFT: Grid[] = [
  [
    '.....TTTTTT.....',
    '.....YTTtTT.....',
    '.....TTTStT.....',
    '.....BBBBBB.....',
    '......BBbB......',
    '.....FFFFD......',
  ],
  [
    '.....TTTTTT.....',
    '.....YTtTTT.....',
    '.....TSTTtT.....',
    '.....BBBBBB.....',
    '....BB...bb.....',
    '...FFF...DD.....',
  ],
  [
    '.....TTTTTT.....',
    '.....YTTTtT.....',
    '.....TTTTttS....',
    '.....BBBBBB.....',
    '....bb...BB.....',
    '...DDD...FF.....',
  ],
]

// Child bodies: rows 11..14
const CHILD_DOWN: Grid[] = [
  ['.....TTTTTT.....', '....STTTTTTS....', '.....BB..BB.....', '.....FF..FF.....'],
  ['.....TTTTTT.....', '....STTTTTTS....', '.....BB..FF.....', '.....FF.........'],
  ['.....TTTTTT.....', '....STTTTTTS....', '.....FF..BB.....', '.........FF.....'],
]
const CHILD_LEFT: Grid[] = [
  ['......TTTT......', '......TSTT......', '......BBBB......', '.....FFFF.......'],
  ['......TTTT......', '.....STTTT......', '.....B..bB......', '....FF..DD......'],
  ['......TTTT......', '......TTTTS.....', '.....b..BB......', '....DD..FF......'],
]

// Robe bottoms (priest / mage / scholar) replace rows 12..14.
const ROBE_DOWN: Grid[] = [
  ['....RRRRRRRR....', '...RRRRRRRRRr...', '...rRRRRRRRrr...'],
  ['....RRRRRRRR....', '...RRRRRRRRRr...', '...rRRRRRFFr....'],
  ['....RRRRRRRR....', '...RRRRRRRRRr...', '....rFFRRRRrr...'],
]
const ROBE_LEFT: Grid[] = [
  ['.....RRRRRR.....', '....RRRRRRRr....', '....rRRRRRRr....'],
  ['.....RRRRRR.....', '....RRRRRRRr....', '...FFRRRRRRr....'],
  ['.....RRRRRR.....', '....RRRRRRRr....', '....rRRRRRRrD...'],
]

// ---------------------------------------------------------------------------------------
// Heads (rows 1..8). E eye, S skin, s skin shade, W skin light.

const HEAD: PerDir = {
  down: [
    '.....SSSSSS.....',
    '....SSSSSSSS....',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSs...',
    '...SSSSSSSSSs...',
    '...SSESSSSESs...',
    '...SSESSSSESs...',
    '....sSSSSSSs....',
  ],
  left: [
    '.....SSSSSS.....',
    '....SSSSSSSS....',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSs...',
    '...SSSSSSSSSs...',
    '...SESSSsSSSs...',
    '...SESSSsSSSs...',
    '....SSSSSSSs....',
  ],
  up: [
    '.....SSSSSS.....',
    '....SSSSSSSS....',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSs...',
    '...SSSSSSSSSs...',
    '...sSSSSSSSSs...',
    '...sSSSSSSSSs...',
    '....ssSSSSss....',
  ],
}

// Beard rows start at y=7 (sideburns), cover the chin row and spill onto the collar.
const BEARD: PerDir = {
  down: ['...H........h...', '....HHhHHhHH....', '.....hHHHHh.....'],
  left: ['.......h........', '...HHHHh........', '....hHh.........'],
  up: ['...h........h...'],
}

// Hair styles, rows from y=0. H base, h shade, L light, R ribbon (top colour).
const HAIR: PerDir[] = [
  // 0 short
  {
    down: ['................', '.....HHHHHH.....', '....HHLLHHHH....', '...HLLHHHHHHh...', '...HHHHHHHHHh...', '...HHH.HH.HHh...', '...H........h...'],
    left: [
      '................',
      '.....HHHHHH.....',
      '....HHLLHHHH....',
      '...HLLHHHHHHh...',
      '...HHHHHHHHHh...',
      '...HH.HHHHHHh...',
      '........HHHHh...',
      '.........HHhh...',
      '..........hh....',
    ],
    up: [
      '................',
      '.....HHHHHH.....',
      '....HHHLLHHH....',
      '...HHHLLHHHHh...',
      '...HHHHHHHHHh...',
      '...HHHHHHHHHh...',
      '...hHHHHHHHHh...',
      '...hhHHHHHHhh...',
      '....hhhhhhhh....',
    ],
  },
  // 1 long
  {
    down: [
      '................',
      '.....HHHHHH.....',
      '....HHLLHHHH....',
      '...HLLHHHHHHh...',
      '...HHHHHHHHHh...',
      '...HHHHHHHHHh...',
      '...HH......Hh...',
      '...HH......hh...',
      '...Hh......hh...',
      '...Hh......hh...',
      '...hh......hh...',
    ],
    left: [
      '................',
      '.....HHHHHH.....',
      '....HHLLHHHH....',
      '...HLLHHHHHHh...',
      '...HHHHHHHHHh...',
      '...HHHHHHHHHh...',
      '......HHHHHHh...',
      '......HHHHHHh...',
      '.......HHHHHh...',
      '.......HHHHhh...',
      '.......hhhhh....',
    ],
    up: [
      '................',
      '.....HHHHHH.....',
      '....HHHLLHHH....',
      '...HHHLLHHHHh...',
      '...HHHHHHHHHh...',
      '...HHHHHHHHHh...',
      '...HHHHHHHHHh...',
      '...HHHHHHHHHh...',
      '...hHHHHHHHHh...',
      '...hHHHHHHHHh...',
      '...hhHHHHHHhh...',
      '....hhhhhhhh....',
    ],
  },
  // 2 spiky
  {
    down: [
      '................',
      '....H.HH.HH.....',
      '...HHHLHHHHHH...',
      '..HHLLHHHHHHhh..',
      '...HLHHHHHHHh...',
      '..HHH.HHH.HHhh..',
      '...H........h...',
    ],
    left: [
      '................',
      '.....H.HH.H.....',
      '....HHHHHHHHH...',
      '...HLLHHHHHHhh..',
      '...HHHHHHHHHHhh.',
      '...H.HHHHHHHhh..',
      '........HHHHhhh.',
      '.........HHhh...',
      '..........hh....',
    ],
    up: [
      '................',
      '....H.HH.HH.....',
      '...HHHHLHHHHH...',
      '..HHHLLHHHHHhh..',
      '...HHHHHHHHHh...',
      '..HHHHHHHHHHhh..',
      '...hHHHHHHHHh...',
      '...hhHHHHHHhh...',
      '....hhhhhhhh....',
    ],
  },
  // 3 ponytail
  {
    down: [
      '................',
      '.....HHHHHH.....',
      '....HHLLHHHH....',
      '...HLLHHHHHHh...',
      '...HHHHHHHHHhh..',
      '...HHHHH.HHHhh..',
      '...H.......h.h..',
      '.............h..',
    ],
    left: [
      '................',
      '.....HHHHHH.....',
      '....HHLLHHHH....',
      '...HLLHHHHHHh...',
      '...HHHHHHHHHRh..',
      '...HH.HHHHHHRHh.',
      '........HHHHhHh.',
      '.........HHh.hh.',
      '..........h..hh.',
      '.............h..',
    ],
    up: [
      '................',
      '.....HHHHHH.....',
      '....HHHLLHHH....',
      '...HHHLLHHHHh...',
      '...HHHHHHHHHh...',
      '...HHHHHHHHHh...',
      '...hHHHHHHHHh...',
      '...hhHHRRHHhh...',
      '....hhhHHhhh....',
      '......hHHh......',
      '......hHHh......',
      '.......hh.......',
    ],
  },
  // 4 bald (a scalp highlight only)
  {
    down: ['................', '................', '......WW........', '.....W..........'],
    left: ['................', '................', '.....WW.........', '....W...........'],
    up: ['................', '................', '.......WW.......', '......W.........'],
  },
  // 5 hood (top colour)
  {
    down: [
      '................',
      '.....TTTTTT.....',
      '....TTYYTTTT....',
      '...TYYTTTTTTt...',
      '...TTTTTTTTTt...',
      '...TTHHHHHHTt...',
      '...TT......Tt...',
      '...Tt......tt...',
      '...tt......tt...',
    ],
    left: [
      '................',
      '.....TTTTTT.....',
      '....TTYYTTTT....',
      '...TYYTTTTTTt...',
      '...TTTTTTTTTTt..',
      '...THHTTTTTTTt..',
      '...T...TTTTTTt..',
      '...t...TTTTTt...',
      '....t..TTTTt....',
    ],
    up: [
      '................',
      '.....TTTTTT.....',
      '....TTTYYTTT....',
      '...TTTYYTTTTt...',
      '...TTTTTTTTTt...',
      '...TTTTTTTTTt...',
      '...tTTTTTTTTt...',
      '...tTTTTTTTTt...',
      '...ttTTTTTTtt...',
      '....ttTTTTtt....',
      '......tTTt......',
    ],
  },
  // 6 cap-helmet (metal)
  {
    down: ['................', '.....NNMMMM.....', '....NNMMMMMM....', '...NMMMMMMMMm...', '...MMMMMMMMMm...', '...mmmmmmmmmm...', '...H........h...'],
    left: [
      '................',
      '.....NNMMMM.....',
      '....NNMMMMMM....',
      '...NMMMMMMMMm...',
      '...MMMMMMMMMm...',
      '...mmmmmmmmmmm..',
      '........HHHHh...',
      '.........HHh....',
    ],
    up: [
      '................',
      '.....MMMMMM.....',
      '....MMNNMMMM....',
      '...MMNMMMMMMm...',
      '...MMMMMMMMMm...',
      '...mmmmmmmmmm...',
      '...hHHHHHHHHh...',
      '...hhHHHHHHhh...',
      '....hhhhhhhh....',
    ],
  },
  // 7 bun
  {
    down: ['......hHHh......', '.....HHHHHH.....', '....HHLLHHHH....', '...HLLHHHHHHh...', '...HHHHHHHHHh...', '...HHH....HHh...', '...H........h...'],
    left: [
      '........hHHh....',
      '.....HHHHHHHh...',
      '....HHLLHHHH....',
      '...HLLHHHHHHh...',
      '...HHHHHHHHHh...',
      '...H..HHHHHHh...',
      '........HHHHh...',
      '.........HHhh...',
      '..........hh....',
    ],
    up: [
      '......HLLH......',
      '.....HHRRHH.....',
      '....HHHHHHHH....',
      '...HHHHHHHHHh...',
      '...HHHHHHHHHh...',
      '...hHHHHHHHHh...',
      '...hHHHHHHHHh...',
      '...hhHHHHHHhh...',
      '....hhhhhhhh....',
    ],
  },
  // 8 bowl cut
  {
    down: ['................', '.....HHHHHH.....', '....HHLLLHHH....', '...HHLHHHHHHh...', '...HHHHHHHHHh...', '...hHHHHHHHHh...', '...hh......hh...', '...h........h...'],
    left: [
      '................',
      '.....HHHHHH.....',
      '....HHLLLHHH....',
      '...HHLHHHHHHh...',
      '...HHHHHHHHHh...',
      '...hHHHHHHHHh...',
      '.......HHHHHh...',
      '........HHHhh...',
    ],
    up: [
      '................',
      '.....HHHHHH.....',
      '....HHHLLHHH....',
      '...HHHLHHHHHh...',
      '...HHHHHHHHHh...',
      '...HHHHHHHHHh...',
      '...hHHHHHHHHh...',
      '...hhhhhhhhhh...',
    ],
  },
  // 9 curly
  {
    down: [
      '....HLHHLHH.....',
      '...HLLHHHHHHh...',
      '..HLLHHLHHHHhh..',
      '..HHHHHHHHLHHh..',
      '..HHLHHHHHHHhh..',
      '..hHHHhHHhHHhh..',
      '..hH........hh..',
      '..hh........hh..',
      '...h........h...',
    ],
    left: [
      '....HLHHLHH.....',
      '...HLLHHHHHHh...',
      '..HLLHHLHHHHhh..',
      '..HHHHHHHHLHHh..',
      '..HHLHHHHHHHhh..',
      '..HH.HHhHHhHhh..',
      '........HHHHhh..',
      '........hHHhhh..',
      '.........hhhh...',
    ],
    up: [
      '....HHHHLHH.....',
      '...HHLHHHHHHh...',
      '..HHLLHHHHLHhh..',
      '..HHHHHLHHHHhh..',
      '..HHHHHHHHHHhh..',
      '..hHHLHHHHHHhh..',
      '..hHHHHHHLHHhh..',
      '..hhHHHHHHHHhh..',
      '...hhhHHHHhhh...',
      '....hhhhhhhh....',
    ],
  },
]

// ---------------------------------------------------------------------------------------
// Hats. `clip`: hair rows above this are removed before the hat is drawn.

interface Hat {
  grids: PerDir
  clip: number
}

const HATS: Record<string, Hat> = {
  straw: {
    clip: 4,
    grids: {
      down: ['................', '......XXXX......', '.....XxXXXX.....', '.....RRRRRR.....', '.XXXXXXXXXXXXXX.', '..xxxxxxxxxxxx..'],
      left: ['................', '.....XXXX.......', '....XxXXXX......', '....RRRRRR......', '.XXXXXXXXXXXXX..', '..xxxxxxxxxxx...'],
      up: ['................', '......XXXX......', '.....XXXXxX.....', '.....RRRRRR.....', '.XXXXXXXXXXXXXX.', '..xxxxxxxxxxxx..'],
    },
  },
  wizard: {
    clip: 5,
    grids: {
      down: ['........VV......', '.......VVv......', '......VVVv......', '.....VVVVVv.....', '....GGGGGGGG....', '..VVVVVVVVVVVv..'],
      left: ['..........VV....', '.........VVv....', '......VVVVv.....', '.....VVVVVVv....', '....GGGGGGGG....', '.VVVVVVVVVVVVv..'],
      up: ['......VV........', '......vVV.......', '......vVVV......', '.....vVVVVV.....', '....GGGGGGGG....', '..vVVVVVVVVVVV..'],
    },
  },
  helmet: {
    clip: 6,
    grids: {
      down: ['................', '.....NNMMMM.....', '....NNMMMMMM....', '...NMMMMMMMMm...', '...MMMMMMMMMm...', '...mmmmmmmmmm...', '...m........m...'],
      left: ['................', '.....NNMMMM.....', '....NNMMMMMM....', '...NMMMMMMMMm...', '...MMMMMMMMMm...', '...mmmmmmmmmmm..', '........mmmmm...', '.........mmm....'],
      up: ['................', '.....MMMMMM.....', '....MMNNMMMM....', '...MMNMMMMMMm...', '...MMMMMMMMMm...', '...mmmmmmmmmm...', '...mmmmmmmmmm...', '....mmmmmmmm....'],
    },
  },
  plume: {
    clip: 0,
    grids: {
      down: ['......RRRR......', '.......rr.......'],
      left: ['.......RRRRR....', '........rr......'],
      up: ['......RRRR......', '.......rr.......'],
    },
  },
  minerlamp: {
    clip: 0,
    grids: {
      down: ['................', '................', '.......GG.......', '......GYYG......'],
      left: ['................', '................', '....GG..........', '...GYY..........'],
      up: ['................'],
    },
  },
  beret: {
    clip: 4,
    grids: {
      down: ['................', '...........F....', '....VVVVVVVFv...', '...VVVVVVVVVFv..', '...vvvvvvvvvv...'],
      left: ['................', '............F...', '....VVVVVVVVFv..', '...VVVVVVVVVVFv.', '...vvvvvvvvvvv..'],
      up: ['................', '....F...........', '...vFVVVVVVV....', '..vFVVVVVVVVV...', '...vvvvvvvvvv...'],
    },
  },
  bucket: {
    clip: 4,
    grids: {
      down: ['................', '................', '.....OOOOOO.....', '....OOOOOOOO....', '...oooooooooo...', '..oo........oo..'],
      left: ['................', '................', '.....OOOOOO.....', '....OOOOOOOO....', '..ooooooooooo...', '..o.........oo..'],
      up: ['................', '................', '.....OOOOOO.....', '....OOOOOOOO....', '...oooooooooo...', '..oo........oo..'],
    },
  },
  bandana: {
    clip: 3,
    grids: {
      down: ['................', '.....RRRRRR.....', '....RRRWRRRR....', '...RRRRRRRWRr...', '...rrrrrrrrrr...'],
      left: ['................', '.....RRRRRR.....', '....RRRWRRRR....', '...RRRRRRRWRrr..', '...rrrrrrrrrrRr.', '............rR..'],
      up: ['................', '.....RRRRRR.....', '....RRRRWRRR....', '...RRWRRRRRRr...', '...rrrrrrrrrr...', '.......rRr......', '......rR.Rr.....'],
    },
  },
  circlet: {
    clip: 0,
    grids: {
      down: ['................', '................', '................', '................', '...GGGGYGGGGG...'],
      left: ['................', '................', '................', '................', '...YGGGGGGGGG...'],
      up: ['................', '................', '................', '................', '...GGGGGGGGGG...'],
    },
  },
  cap: {
    clip: 3,
    grids: {
      down: ['................', '.....OOOOOO.....', '....OOOOOOOO....', '...OOOOOOOOOo...', '...oooooooooo...'],
      left: ['................', '.....OOOOOO.....', '....OOOOOOOO....', '...OOOOOOOOOo...', '.ooooooooooo....'],
      up: ['................', '.....OOOOOO.....', '....OOOOOOOO....', '...oOOOOOOOOO...', '...oooooooooo...'],
    },
  },
}

// ---------------------------------------------------------------------------------------
// Gear overlays (rows from y=0, full frame)

const G = {
  breastplate: {
    down: ['', '', '', '', '', '', '', '', '', '.....NMMMMm.....', '....NMMMMMMm....', '....mMMMMMMm....'],
    left: ['', '', '', '', '', '', '', '', '', '......NMMm......', '.....NMMMMm.....', '.....mMMMMm.....'],
    up: ['', '', '', '', '', '', '', '', '', '.....MMMMMm.....', '....NMMMMMMm....', '....mMMMMMMm....'],
  } as PerDir,
  waistApron: {
    down: ['', '', '', '', '', '', '', '', '', '', '', '', '....aAAAAAAa....', '....AAAAAAAA....'],
    left: ['', '', '', '', '', '', '', '', '', '', '', '', '....AAa.........', '....AAa.........'],
    up: ['', '', '', '', '', '', '', '', '', '', '', '', '.......aa.......', '......a..a......'],
  } as PerDir,
  apron: {
    down: ['', '', '', '', '', '', '', '', '', '.....a....a.....', '.....AAAAAA.....', '.....AAAAaA.....', '.....AAAAAA.....', '.....aAAAAa.....'],
    left: ['', '', '', '', '', '', '', '', '', '.....A..........', '.....AA.........', '....AAA.........', '....AAA.........', '....aAa.........'],
    up: ['', '', '', '', '', '', '', '', '', '....a......a....', '................', '.......aa.......', '......a..a......'],
  } as PerDir,
  strap: {
    down: ['', '', '', '', '', '', '', '', '', '....O...........', '.....O..........', '......OO........', '........OOOO....', '..........oo....'],
    left: ['', '', '', '', '', '', '', '', '', '.......O........', '.......O........', '.......OO.......', '......OOOO......'],
    up: ['', '', '', '', '', '', '', '', '', '...........O....', '..........O.....', '.........O......', '...OOO..O.......', '...oo...........'],
  } as PerDir,
  scarf: {
    down: ['', '', '', '', '', '', '', '', '', '....RRRRRRRRr...', '............rR..', '.............r..'],
    left: ['', '', '', '', '', '', '', '', '', '.....RRRRRRRRr..', '...........rRRr.', '.............rr.'],
    up: ['', '', '', '', '', '', '', '', '', '....RRRRRRRRr...', '.......rRr......', '.......rRr......', '........r.......'],
  } as PerDir,
  collar: {
    down: ['', '', '', '', '', '', '', '', '', '....GC....CG....'],
    left: ['', '', '', '', '', '', '', '', '', '.....G..........'],
    up: [''],
  } as PerDir,
  capeBack: {
    down: ['', '', '', '', '', '', '', '', '', '...CC......CC...', '..CC........CC..', '..Cc........cC..', '..cc........cc..', '..cc........cc..', '...c........c...'],
    left: ['', '', '', '', '', '', '', '', '', '.........CCC....', '.........CCCC...', '..........CCC...', '..........CCCc..', '..........cCcc..', '...........ccc..'],
    up: [''],
  } as PerDir,
  capeFront: {
    down: [''],
    left: [''],
    up: ['', '', '', '', '', '', '', '', '', '....CCCCCCCC....', '...CCCCCCCCCC...', '...CCCcCCCCCC...', '..cCCCcCCCcCCc..', '..cCCCcCCCcCCc..', '..cccccccccccc..'],
  } as PerDir,
  backpack: {
    down: ['', '', '', '', '', '', '', '', '', '.....O....O.....', '.....o....o.....'],
    left: ['', '', '', '', '', '', '', '', '', '.........OOO....', '.........OOOO...', '.........OOOO...', '.........oooo...'],
    up: ['', '', '', '', '', '', '', '', '', '.....oOOOOo.....', '.....OOOOOO.....', '.....OYYYYO.....', '.....OOOOOO.....', '.....oooooo.....'],
  } as PerDir,
  spear: {
    down: [
      '.............N..',
      '............NMm.',
      '.............m..',
      '.............O..',
      '.............O..',
      '.............O..',
      '.............O..',
      '.............O..',
      '.............O..',
      '.............O..',
      '.............O..',
      '.............o..',
      '.............o..',
      '.............o..',
    ],
    left: [
      '...........N....',
      '..........NMm...',
      '...........m....',
      '...........O....',
      '...........O....',
      '...........O....',
      '...........O....',
      '...........O....',
      '...........O....',
      '...........O....',
      '...........O....',
      '...........o....',
      '...........o....',
      '...........o....',
    ],
    up: [
      '..N.............',
      '.NMm............',
      '..m.............',
      '..O.............',
      '..O.............',
      '..O.............',
      '..O.............',
      '..O.............',
      '..O.............',
      '..O.............',
      '..O.............',
      '..o.............',
      '..o.............',
      '..o.............',
    ],
  } as PerDir,
  staff: {
    down: ['.............G..', '............GYG.', '.............G..', '.............O..', '.............O..', '.............O..', '.............O..', '.............O..', '.............O..', '.............O..', '.............O..', '.............o..', '.............o..', '.............o..'],
    left: ['...........G....', '..........GYG...', '...........G....', '...........O....', '...........O....', '...........O....', '...........O....', '...........O....', '...........O....', '...........O....', '...........O....', '...........o....', '...........o....', '...........o....'],
    up: ['..G.............', '.GYG............', '..G.............', '..O.............', '..O.............', '..O.............', '..O.............', '..O.............', '..O.............', '..O.............', '..O.............', '..o.............', '..o.............', '..o.............'],
  } as PerDir,
  bow: {
    down: [''],
    left: ['', '', '', '', '', '', '', '', '', '............O...', '...........O.O..', '...........O.O..', '............O...'],
    up: ['', '', '', '', '', '', '', '', '...O............', '....O...........', '....OW..........', '....O.W.........', '....O..W........', '...O....W.......'],
  } as PerDir,
  glasses: {
    down: ['', '', '', '', '', '', '....GGG..GGG....'],
    left: ['', '', '', '', '', '', '...GGG..........'],
    up: [''],
  } as PerDir,
}

// ---------------------------------------------------------------------------------------
// Role configuration

interface RoleCfg {
  hat?: string
  hatColor?: string
  hairStyle?: number
  back?: (keyof typeof G)[]
  front?: (keyof typeof G)[]
  torso?: (keyof typeof G)[]
  face?: (keyof typeof G)[]
  robe?: boolean
  child?: boolean
  top?: string
  bottom?: string
  apron?: string
  cape?: string
  metal?: string
  ragged?: boolean
  bareArms?: boolean
  striped?: string
  belt?: string
}

const pickFrom = (xs: string[], i: number) => at(xs, i)

function roleCfg(role: string, look: Look): RoleCfg {
  switch (role) {
    case 'player':
      return { front: [], torso: ['scarf'], belt: '#5a3a26' }
    case 'guard':
      return {
        hat: 'helmet',
        metal: '#aab2c0',
        top: pickFrom(['#3d5aa8', '#a83a3a', '#3a7a4a'], look.top),
        bottom: '#4a4a58',
        torso: ['breastplate'],
        front: ['spear'],
        belt: '#3a2a22',
      }
    case 'soldier':
      return { hat: 'helmet', metal: '#8a92a0', top: pickFrom(['#6e5a3a', '#5a4a3a', '#3e4a5a'], look.top), bottom: '#3e3a40', torso: ['breastplate'], belt: '#2e2420' }
    case 'mage':
      return {
        hat: 'wizard',
        robe: true,
        top: pickFrom(['#6a3ea8', '#3e4aa8', '#2e3c6e', '#8e2a3c', '#2f7a84'], look.top),
        front: ['staff'],
      }
    case 'priest':
      return { robe: true, top: '#ece4d0', torso: ['collar'], cape: '#d8b04a' }
    case 'scholar':
      return { robe: true, top: pickFrom(['#5a4a8a', '#3e5a7a', '#6e4a32', '#4a5a3a'], look.top), belt: '#c8a040' }
    case 'child':
      return { child: true }
    case 'merchant':
      return { torso: ['apron'], apron: '#7a5a3a', hat: 'cap', hatColor: pickFrom(['#2f8a84', '#c0403a', '#7a4aa8', '#3d6fd0'], look.hair) }
    case 'innkeeper':
      return { torso: ['waistApron'], apron: '#f0ece2' }
    case 'noble':
      return {
        top: pickFrom(['#6a3ea8', '#9c2a3c', '#2e4aa8', '#2f6a3f'], look.top),
        bottom: '#2e2a3a',
        cape: pickFrom(['#b0283a', '#3a2a7a', '#8a1e4a', '#1e3a6e'], look.top + 1),
        back: ['capeBack'],
        front: ['capeFront'],
        torso: ['collar'],
        hat: 'circlet',
        belt: '#d8b04a',
      }
    case 'smith':
      return { torso: ['apron'], apron: '#3e2e28', bareArms: true, belt: '#2a1e1a' }
    case 'farmer':
      return { hat: 'straw', belt: '#5a3a26' }
    case 'beggar':
      return { ragged: true }
    case 'fisher':
      return { hat: 'bucket', hatColor: pickFrom(['#7e7e3c', '#6a7a5a', '#b89468'], look.top) }
    case 'hunter':
      return { hairStyle: 5, top: pickFrom(['#5a8a3a', '#7a6a3a', '#4f7a4a', '#8a6a44'], look.top), torso: ['strap'], back: ['bow'], belt: '#4a3222' }
    case 'miner':
      return { hat: 'helmet', metal: '#c9a040', front: [], face: [], torso: [], belt: '#3a2a22', back: [] }
    case 'bard':
      return { hat: 'beret', hatColor: pickFrom(['#c0403a', '#2f8a84', '#7a4aa8', '#3d6fd0'], look.top + 2), torso: ['strap'] }
    case 'herbalist':
      return { torso: ['strap'], top: pickFrom(['#4f9a44', '#7e7e3c', '#2f6a3f', '#6a8a5a'], look.top) }
    case 'sailor':
      return { hat: 'bandana', hatColor: '#c0403a', striped: '#eceae4', top: pickFrom(['#2e3c6e', '#3d6fd0'], look.top) }
    case 'traveler':
      return { back: ['capeBack', 'backpack'], front: ['capeFront'], cape: pickFrom(['#6e4a32', '#5a5a3a', '#4a4a5a'], look.top), belt: '#4a3222' }
    default:
      return {}
  }
}

// ---------------------------------------------------------------------------------------

export interface Look {
  skin: number
  hair: number
  hairStyle: number
  top: number
  bottom: number
}

function paletteFor(look: Look, cfg: RoleCfg): Record<string, string> {
  const [sk, skd] = at(SKIN_TONES, look.skin)
  const hair = at(HAIR_COLORS, look.hair)
  let top = cfg.top ?? at(CLOTH_COLORS, look.top)
  let bottom = cfg.bottom ?? at(CLOTH_COLORS, look.bottom === look.top && !cfg.top ? look.bottom + 7 : look.bottom)
  if (cfg.ragged) {
    top = mix(top, '#8a7a62', 0.55)
    bottom = mix(bottom, '#6a5a48', 0.55)
  }
  const shoeBases = ['#4a3226', '#3a2a2a', '#2a2630', '#6a4a32']
  const shoe = cfg.ragged ? skd : at(shoeBases, look.top + look.bottom * 3)
  const metal = cfg.metal ?? '#a8b0bc'
  const robe = cfg.robe ? top : bottom
  const cape = cfg.cape ?? '#b0283a'
  const hatC = cfg.hatColor ?? '#8a6a3a'
  return {
    S: sk,
    s: skd,
    W: shade(sk, 0.35),
    E: '#2a1e2e',
    H: hair,
    h: shade(hair, -0.3),
    L: shade(hair, 0.32),
    T: top,
    t: shade(top, -0.28),
    Y: shade(top, 0.3),
    B: bottom,
    b: shade(bottom, -0.3),
    F: shoe,
    f: shade(shoe, 0.25),
    D: shade(shoe, -0.3),
    M: metal,
    m: shade(metal, -0.32),
    N: shade(metal, 0.4),
    R: cfg.robe ? robe : hatC === '#8a6a3a' ? '#c0403a' : hatC,
    r: shade(cfg.robe ? robe : hatC === '#8a6a3a' ? '#c0403a' : hatC, -0.3),
    G: '#e8c050',
    X: '#e8cf7a',
    x: '#b89a4a',
    V: top,
    v: shade(top, -0.3),
    A: cfg.apron ?? '#c8a878',
    a: shade(cfg.apron ?? '#c8a878', -0.25),
    C: cape,
    c: shade(cape, -0.3),
    O: hatC,
    o: shade(hatC, -0.3),
  }
}

const EMPTY = new Pix(16, 16)
void EMPTY

function gridLayer(g: Grid | undefined, pal: Record<string, string>, oy = 0): Pix {
  const p = new Pix(16, 16)
  if (g) p.stamp(g, pal, 0, oy)
  return p
}

function buildFrame(dir: Dir, step: number, look: Look, role: string): Pix {
  const cfg = roleCfg(role, look)
  const pal = paletteFor(look, cfg)
  const child = !!cfg.child
  const p = new Pix(16, 16)
  const hs = wrapIdx(cfg.hairStyle ?? look.hairStyle, HAIR_STYLE_COUNT)
  const dy = child ? 2 : 0

  // gear palettes
  const gearPal: Record<string, string> = { ...pal }
  const strapPal = { ...pal, O: '#5a3a26', o: '#3e2618' }
  const woodPal = { ...pal, O: '#8a5a32', o: '#5e3c22', N: '#dfe6ee', M: '#a8b0bc', m: '#6a7280', G: '#f0c850', Y: '#9ff0ff' }
  const bpPal = { ...pal, O: '#8a5a32', o: '#5e3c22', Y: '#a87a48' }
  const capePal = { ...pal }
  const bowPal = { ...pal, O: '#8a5a32', W: '#e8e0d0' }
  const plateBase = shade(pal.M, -0.18)
  const platePal = { ...pal, M: plateBase, N: shade(plateBase, 0.35), m: shade(plateBase, -0.35) }
  const gearFor = (k: keyof typeof G) =>
    k === 'strap'
      ? strapPal
      : k === 'spear' || k === 'staff'
        ? woodPal
        : k === 'backpack'
          ? bpPal
          : k === 'bow'
            ? bowPal
            : k.startsWith('cape')
              ? capePal
              : k === 'breastplate'
                ? platePal
                : gearPal

  const drawGear = (keys: (keyof typeof G)[] | undefined, shiftY = 0) => {
    for (const k of keys ?? []) {
      if (child && (k === 'spear' || k === 'staff' || k === 'bow' || k === 'breastplate')) continue
      const g = G[k][dir]
      if (!g || !g.length) continue
      p.blit(gridLayer(g, gearFor(k)), 0, shiftY)
    }
  }

  // 1. back gear
  drawGear(cfg.back, dy)
  if (dir === 'left' || dir === 'up') {
    // polearms held on the far side in these views
    if (dir === 'left') drawGear(cfg.front?.filter((k) => k === 'spear' || k === 'staff'))
  }

  // 2. body
  const body = new Pix(16, 16)
  if (child) {
    const set = dir === 'left' ? CHILD_LEFT : CHILD_DOWN
    const s = dir === 'up' ? [0, 2, 1][step] : step
    body.stamp(set[s], pal, 0, 11)
  } else {
    const set = dir === 'left' ? BODY_LEFT : BODY_DOWN
    const s = dir === 'up' ? [0, 2, 1][step] : step
    body.stamp(set[s], pal, 0, 9)
    if (cfg.robe) {
      const rset = dir === 'left' ? ROBE_LEFT : ROBE_DOWN
      // clear legs then draw the robe
      for (let y = 12; y < 16; y++) for (let x = 0; x < 16; x++) body.clear(x, y)
      // hands that dropped to the waist row stay visible
      const hands = set[s][3]
      for (let x = 0; x < 16; x++) if (hands[x] === 'S') body.set(x, 12, pal.S)
      body.stamp(rset[s], { ...pal, R: pal.T, r: pal.t }, 0, 12)
      if (role === 'priest') {
        body.set(7, 13, pal.G)
        body.set(8, 13, pal.G)
        if (dir !== 'left') {
          body.set(7, 12, pal.G)
          body.set(8, 12, pal.G)
        }
      }
    }
  }
  // stripes / belt / bare arms / rags
  if (cfg.striped && !child) {
    for (let y = 10; y <= 11; y += 1) if (y === 10) for (let x = 3; x < 13; x++) body.over(x, y, cfg.striped)
  }
  if (cfg.belt && !child && !cfg.robe) {
    for (let x = 0; x < 16; x++) if (body.alpha(x, 12) && body.get(x, 12) === pal.B) body.set(x, 12, cfg.belt)
    if (dir === 'down') body.set(7, 12, '#d8b04a')
  } else if (cfg.belt && cfg.robe) {
    for (let x = 0; x < 16; x++) if (body.get(x, 12) === pal.T) body.set(x, 12, cfg.belt)
  }
  if (cfg.bareArms && !child) {
    body.map((c, x, y) => (y >= 10 && y <= 11 && (x <= 3 || x >= 12) && (c === pal.t || c === pal.T) ? pal.S : c))
  }
  if (cfg.ragged) {
    // patches and torn hems
    body.over(dir === 'left' ? 6 : 9, 10, '#8a6a4a')
    body.over(dir === 'left' ? 7 : 10, 10, '#a08060')
    body.over(dir === 'left' ? 9 : 5, 13, '#8a6a4a')
    if (dir !== 'left') {
      body.clear(4, 13)
      body.clear(11, 13)
    }
  }
  p.blit(body, 0, 0)

  // 3. torso gear
  if (cfg.torso?.includes('breastplate')) drawGear(['breastplate'], dy)
  drawGear(cfg.torso?.filter((k) => k !== 'breastplate' && k !== 'scarf'), dy)

  // 4. head group
  const head = new Pix(16, 16)
  head.stamp(HEAD[dir], pal, 0, 1)
  const bearded = !child && hs !== 1 && hs !== 3 && hs !== 7 && hs !== 5 && (look.hair * 7 + look.skin * 3 + look.top * 5) % 7 === 0 && role !== 'player' && !cfg.hat?.startsWith('helmet')
  const capC = look.hair % 3 === 0 ? '#9aa2ae' : shade(at(CLOTH_COLORS, look.top + 9), -0.05)
  const hair = gridLayer(HAIR[hs][dir], {
    ...pal,
    R: pal.T === pal.H ? pal.G : shade(pal.T, 0.1),
    M: capC,
    m: shade(capC, -0.32),
    N: shade(capC, 0.35),
  })
  const hat = cfg.hat ? HATS[cfg.hat] : undefined
  if (hat) for (let y = 0; y < hat.clip; y++) for (let x = 0; x < 16; x++) hair.clear(x, y)
  if (hs === 6 && hat) {
    // metal cap under another hat looks odd: drop it
    for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) hair.clear(x, y)
  }
  if (bearded) head.blit(gridLayer(BEARD[dir], pal, 7))
  // children: rosier cheeks
  if (child && dir === 'down') {
    head.set(4, 7, mix(pal.S, '#f08080', 0.35))
    head.set(11, 7, mix(pal.S, '#f08080', 0.35))
  }
  head.blit(hair)
  for (const f of cfg.face ?? []) head.blit(gridLayer(G[f][dir], pal))
  if (hat) {
    const hatPal = { ...pal, R: cfg.hat === 'straw' ? '#c0403a' : cfg.hat === 'plume' ? '#c0403a' : pal.R, r: cfg.hat === 'straw' ? '#8a2a2a' : pal.r, F: '#f4f0e6', W: '#f4f0e6', Y: '#fff4a0' }
    head.blit(gridLayer(hat.grids[dir], hatPal))
    if (role === 'guard') head.blit(gridLayer(HATS.plume.grids[dir], { ...pal, R: '#d8403a', r: '#9a2a2a' }))
    if (role === 'miner') head.blit(gridLayer(HATS.minerlamp.grids[dir], { ...pal, G: '#8a6a2a', Y: '#fff4a0' }))
  }
  p.blit(head, 0, dy)

  // scarf goes over the chin line
  if (cfg.torso?.includes('scarf')) drawGear(['scarf'], dy)

  // 5. front gear
  if (dir === 'down') drawGear(cfg.front)
  if (dir === 'up') drawGear(cfg.front)

  p.outline(OUTLINE, 0.8)
  return p
}

const DIRS: ['down', 'left', 'right', 'up'] = ['down', 'left', 'right', 'up']

export function characterSheet(look: { skin: number; hair: number; hairStyle: number; top: number; bottom: number }, role = ''): Sheet {
  const r = (String(role ?? '').split('/').pop() ?? '').toLowerCase()
  const n = (v: number) => (Number.isFinite(v) ? Math.floor(v) : 0)
  look = { skin: n(look?.skin), hair: n(look?.hair), hairStyle: n(look?.hairStyle), top: n(look?.top), bottom: n(look?.bottom) }
  const items: { name: string; pix: Pix }[] = []
  const leftFrames = [0, 1, 2].map((s) => buildFrame('left', s, look, r))
  for (const d of DIRS) {
    for (let s = 0; s < 3; s++) {
      let pix: Pix
      if (d === 'left') pix = leftFrames[s]
      else if (d === 'right') pix = leftFrames[s].flipped()
      else pix = buildFrame(d, s, look, r)
      items.push({ name: `${d}${s}`, pix })
    }
  }
  return packGrid(items, 3, 16, 16)
}
