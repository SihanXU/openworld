// The map sprite's beards, glasses, marks and hats (docs/looks.md §3.2), in the adult head's frame. A hat's own
// colour is its key 1 (c C x), a cap's brim its key 2 (y).

import { at, type HeadPart } from './pixgrid.ts'

export const BEARDS: Record<string, HeadPart> = {
  'beard.full': {
    front: {
      down: at(11, ['..q..........q..', '..q..........q..', '..Hq..qHHq..qH..', '..HHq.HppH.qHH..', '...HHHHHHHHHH...', '....qHHHHHHq....', '......qHHq......']),
      side: at(11, ['..q.............', '..q.............', '..Hq......qHH...', '..HHq.....HHpH..', '...HHHHHHHHHH...', '....qHHHHHHq....', '.......qHHq.....']),
    },
  },
  'beard.moustache': { front: { down: at(13, ['......qHHq......']), side: at(13, ['...........qHH..']) } },
  'beard.stubble': { front: { down: at(13, ['...q.q....q.q...', '....q.q..q.q....']), side: at(13, ['...q.q.....q.q..', '....q.q..q.q....']) } },
}

export const GLASSES: Record<string, HeadPart> = {
  'glasses.round': { front: { down: at(11, ['...C..CCCC..C...', '...CC......CC...']), side: at(11, ['.........C..C...', '.........CC.....']) } },
}

/** Marks on the map: freckles show and a scar is a stroke; age's lines are too small to read at sixteen. */
export const MARKS: Record<string, HeadPart> = {
  'mark.freckles': { front: { down: at(13, ['...a.a....a.a...']), side: at(13, ['...........a.a..']) } },
  'mark.scar': { front: { down: at(11, ['..........S.....', '.........S......']), side: at(11, ['..........S.....', '.........S......']) } },
}

/** Rows that clear what is above a covering hat (a bun under a headscarf). */
const CLEAR = (n: number) => Array(n).fill('----------------')
const cover = (y: number, rows: string[]) => [...CLEAR(y), ...rows]

const BRIM = ['......CCCC......', '.....CcccCC.....', '.....CCCCCC.....', '....xxxxxxxx....', 'xCCCCcccCCCCCCCx', '.xxCCCCCCCCCCxx.', '...xxxxxxxxxx...']
const HOOD_UP = ['.....CCCCCC.....', '...CCCccccCCC...', '..CCccccccCCCC..', '.CCcccCCCCCCCCC.']

export const HATS: Record<string, HeadPart> = {
  'hat.straw': {
    front: {
      down: at(2, BRIM),
      up: at(2, BRIM),
      side: at(2, ['.....CCCC.......', '....CcccCC......', '....CCCCCC......', '...xxxxxxxx.....', 'xCCCCccCCCCCCCx.', '.xxxCCCCCCCCxx..', '....xxxxxxx.....']),
    },
  },
  'hat.kerchief': {
    front: {
      down: cover(3, ['.....CCCCCC.....', '...CCcccccCCC...', '..CCcccCCCCCCC..', '.CCCCCCCCCCCCCC.', '.CCCCCCCCCCCCCC.', '.xCCxxxxxxxxCCx.', '.xC..........Cx.', '..x..........x..']),
      up: cover(3, ['.....CCCCCC.....', '...CCcccccCCC...', '..CCcccCCCCCCC..', '.CCCCCCCCCCCCCC.', '.CCCCCCCCCCCCCC.', '.CCCCCCCCCCCCCC.', '.xCCCCCCCCCCCCx.', '..xxCCCCCCCCxx..', '....xxxCCxxx....', '......CxxC......', '.......xx.......']),
      side: cover(3, ['....CCCCCC......', '..CCcccccCCC....', '.CCcccCCCCCCC...', '.CCCCCCCCCCCCx..', '.CCCCCCCCCxxx...', '.CCCCCCCx.......', 'CxCCCCCx........', 'xCxxxxx.........', '.x..............']),
    },
  },
  'hat.hood': {
    front: {
      down: cover(3, [...HOOD_UP, '.CCCCCCCCCCCCCC.', '.CCCxxxxxxxxCCC.', '.CCx........xCC.', '.CCx........xCC.', '.CCx........xCC.', '.CCx........xCC.', '.CCx........xCC.', '.CCCx......xCCC.', '.xCCCx....xCCCx.', '..xxCCCCCCCCxx..']),
      up: cover(3, [...HOOD_UP, ...Array(8).fill('.CCCCCCCCCCCCCC.'), '.xCCCCCCCCCCCCx.', '..xxCCCCCCCCxx..', '....xxxxxxxx....']),
      side: cover(3, ['....CCCCCC......', '..CCCccccCCC....', '.CCccccccCCCC...', 'CCcccCCCCCCCCC..', 'CCCCCCCCCCCxxC..', 'CCCCCCCCCx......', 'CCCCCCCCx.......', 'CCCCCCCCx.......', 'CCCCCCCx........', 'CCCCCCCx........', 'CCCCCCCx........', 'xCCCCCCx........', '.xCCCCCCx.......', '..xxCCCCCx......']),
    },
  },
  'hat.helm': {
    front: {
      down: cover(3, ['.....xCCCCx.....', '...xCCccccCCx...', '..xCCccccCCCCx..', '.xCCCCCCCCCCCCx.', '.xCCCCCCCCCCCCx.', '.xxxxxxxxxxxxxx.', '.xC..........Cx.', '.xC..........Cx.', '..x..........x..']),
      up: cover(3, ['.....xCCCCx.....', '...xCCccccCCx...', '..xCCccccCCCCx..', '.xCCCCCCCCCCCCx.', '.xCCCCCCCCCCCCx.', '.xCCCCCCCCCCCCx.', '.xCCCCCCCCCCCCx.', '.xCCCCCCCCCCCCx.', '.xxxxxxxxxxxxxx.']),
      side: cover(3, ['....xCCCCx......', '..xCCccccCCx....', '.xCCccccCCCCx...', '.xCCCCCCCCCCCx..', '.xCCCCCCCCCCCCx.', '.xxxxxxxxxxxxxx.', '.xCCCCC.........', '.xCCCCx.........', '..xxxx..........']),
    },
  },
  'hat.cap': {
    front: {
      down: at(3, ['......CCCC......', '....CCccccCC....', '...CCccCCCCCC...', '..CCCCCCCCCCCC..', '..xxxxxxxxxxxx..', '..yyyyyyyyyyyy..']),
      up: at(3, ['......CCCC......', '....CCccccCC....', '...CCccCCCCCC...', '..CCCCCCCCCCCC..', '..CCCCCCCCCCCC..', '..xxxxxxxxxxxx..']),
      side: at(3, ['.....CCCC.......', '...CCccccCC.....', '..CCccCCCCCC....', '..CCCCCCCCCCC...', '..xxxxxxxxxxyyyy']),
    },
  },
}
