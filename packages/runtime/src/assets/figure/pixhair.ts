// The map sprite's hair (docs/looks.md §3.2): the caps every style starts from, and the styles beyond the first
// four (pixparts.ts). Adult heads: rows 4-15; a child's: rows 9-19.

import { at, type Grid, type HeadPart } from './pixgrid.ts'

export const SHORT_UP = at(4, [
  '.....HHHHHH.....',
  '...HHhhhhhHHH...',
  '..HHhhhhhhHHHH..',
  '.HHhhhhhHHHHHHH.',
  '.HHHHHHHHHHHHHH.',
  '.HHHHHHHHHHHHHH.',
  '.HHHHHHHHHHHHHH.',
  '.qHHHHHHHHHHHHq.',
  '.qqHHHHHHHHHHqq.',
  '..qqHHHHHHHHqq..',
])
export const CAP_DOWN = ['.....HHHHHH.....', '...HHhhhhhHHH...', '..HHhhhhhHHHHH..', '.HHhhhhHHHHHHHH.', '.HHHHHHHHHHHHHH.']
export const CAP_SIDE = ['....HHHHHH......', '..HHhhhhhHHH....', '.HHhhhhhhHHHH...', '.HHhhhHHHHHHHH..', '.HHHHHHHHHHHHqH.']
const CAP_UP = ['.....HHHHHH.....', '...HHhhhhhHHH...', '..HHhhhhhhHHHH..', '.HHhhhhhHHHHHHH.']
export const LONG_UP = at(4, [
  ...CAP_UP,
  '.HHHHHHHHHHHHHH.',
  '.HHHHHHHHHHHHHH.',
  '.HHHHHHHHHHHHHH.',
  '.HHHHHHHHHHHHHH.',
  '.HHHHHHHHHHHHHH.',
  '.HHHHHHHHHHHHHH.',
  '.HHHHHHHHHHHHHH.',
  '.HHHHHqHHqHHHHH.',
  '.HHHHqHHHHqHHHH.',
  '..HHHqHHHHqHHH..',
  '..HHHHHHHHHHHH..',
  '..HHqHHHHHHqHH..',
  '..qHHHHHHHHHHq..',
  '...qqHHHHHHqq...',
  '.....qqqqqq.....',
])
const W = '.HHHHHHHHHHHHHH.'
const CHILD_CAP = ['.....HHHHHH.....', '....HhhhhHHH....', '...HhhhhHHHHH...', '..HHhhHHHHHHHH..']
const CHILD_CAP_SIDE = ['....HHHHHH......', '...HhhhhHHHH....', '..HhhhhhHHHHH...']

export const MORE_HAIRS: Record<string, HeadPart> = {
  'hair.messy': {
    front: {
      down: at(3, ['.....q..q.q.....', '....HHqHHqHH....', '...HhhhHhhhHHq..', '..HHhhhhhHHHHH..', '.HHhhhhHHHHHHHH.', W, '.qHHqHHHqHHHqHq.', '.q.qq.qqH.qq.qq.', '.q.......q....q.']),
      up: at(3, ['.....q..q.q.....', '....HHqHHqHH....', '...HhhhHhhhHHq..', '..HHhhhhhHHHHH..', '.HHhhhhHHHHHHHH.', W, W, W, '.qHHHHHHHHHHHHq.', '.qHqHHqHHqHHqHq.', '..q.qq.qq.qq.q..']),
      side: at(3, ['....q..q.q......', '...HHqHHqHH.....', '..HhhhHhhhHHq...', '.HHhhhhhHHHHHq..', '.HHhhhHHHHHHHHq.', '.HHHHHHHHHHHqHq.', '.HHHHHHHHqHq.q..', '.qHHHHHHq.......', '.qHqHHq.........', '..q.qq..........']),
    },
  },
  'hair.swept': {
    front: {
      down: at(4, [...CAP_DOWN, '.qHHhHHHHhHHHHq.', '.q.qqqqqqqqqq.q.', '.q............q.']),
      up: SHORT_UP,
      side: at(4, ['....HHHHHH......', '..HHhhhhhhHH....', '.HHhhhhhhhhHH...', '.HHhhhHHHHHHHq..', '.HHHHHHHHHHqq...', '.HHHHHHHq.......', '.qHHHHHq........', '.qHHHHq.........', '..qqqq..........']),
    },
  },
  'hair.cropped': {
    front: {
      down: at(5, ['.....hhHHHH.....', '...hhhHHHHHHH...', '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..qHHqHHHHqHHq..', '..q..........q..']),
      up: at(5, ['.....hhHHHH.....', '...hhhHHHHHHH...', '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..qHHHHHHHHHHq..', '...qqqqqqqqqq...']),
      side: at(5, ['.....hhHHHH.....', '...hhhHHHHHH....', '..HHHHHHHHHHq...', '..HHHHHHHHHq....', '..HHHHHHq.......', '..qHHHHq........', '..qHHHq.........', '...qqq..........']),
    },
  },
  'hair.thin': {
    front: {
      down: at(8, ['..H..........H..', '..HH........HH..', '..qH........Hq..', '..q..........q..']),
      up: at(8, ['..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..qHHHHHHHHHHq..', '...qqqqqqqqqq...']),
      side: at(8, ['..HHHHH.........', '..HHHHHH........', '..qHHHHq........', '...qHHq.........', '....qq..........']),
    },
  },
  'hair.tied': {
    front: {
      down: at(4, [...CAP_DOWN, '.HHHqHHHHqHHHHH.', '.HHq.qq..qq.qHH.', '.Hq..........qH.', '.q............q.']),
      up: at(4, [...CAP_UP, W, W, W, '.qHHHHHHHHHHHHq.', '.qqHHHqHHqHHHqq.', '..qqHHHHHHHHqq..', '......qHHq......', '......HHHH......', '......HhHH......', '......HHHq......', '......qHHq......', '.......qq.......']),
      side: at(4, [...CAP_SIDE, '.HHHHHHHHHqHq.q.', '.HHHHHHHq.......', 'qHHHHHHq........', 'HhHHHHq.........', 'HHqqqq..........', 'HHq.............', 'qHq.............', '.q..............']),
    },
  },
  'hair.wavy': {
    front: {
      down: at(4, [...CAP_DOWN, W, '.HHqHqHqqHqHqHH.', '.HHq........qHH.', '..HH........HH..', '.HHq........qHH.', '..HH........HH..', '.HHq........qHH.', '..HHq......qHH..', '.HHHH......HHHH.', '.qHHq......qHHq.', '..qq........qq..']),
      up: LONG_UP,
      side: at(4, [...CAP_SIDE, '.HHHHHHHHHHqHqq.', '.HHHHHHHHq......', '..HHHHHHq.......', '.HHHHHHq........', '..HHHHHH........', '.HHHHHq.........']),
    },
    back: {
      down: at(11, [W, '..HHHHHHHHHHHH..', W, '..HHHHHHHHHHHH..', W, '..HHHHHHHHHHHH..', W, '..HHHHHHHHHHHH..', W, '..qHHHHHHHHHHq..', '...qqqqqqqqqq...']),
      side: at(15, ['.HHHHH..........', '..HHHHH.........', '.HHHHHH.........', '..HHHHHH........', '.qHHHHH.........', '..qHHHHH........', '..qHHHq.........', '...qqq..........']),
    },
  },
  'hair.braid': {
    front: {
      down: at(4, [...CAP_DOWN, '.HHHqHHHHqHHHHH.', '.HHq.qq..qq.qHH.', '.HHq.........qH.', '.HqH..........q.', '.qHq............', '.HqH............', '.qHq............', '.HqH............', '.qHq............', '.HqH............', '..q.............', '.qHq............', '..q.............']),
      up: at(4, [...CAP_UP, W, W, W, '.qHHHHHHHHHHHHq.', '.qqHHHHHHHHHHqq.', '..qqHHHHHHHHqHq.', '............qHq.', '............HqH.', '............qHq.', '............HqH.', '............qHq.', '.............q..']),
      side: at(4, [...CAP_SIDE, '.HHHHHHHHHqHq.q.', '.HHHHHHHq.......', '.qHHHHHq........', '.qHHHHq.........', '..qqqq..........']),
    },
  },
  'hair.ponytail': {
    front: {
      down: at(2, ['............qHq.', '...........qHHq.', ...CAP_DOWN, '.HqHHqHHHqHHqHH.', '.qq.q..qq.q..qq.', '.q............q.']),
      up: at(2, ['.......qq.......', '......qHHq......', ...CAP_UP.slice(0), W, W, '.HHHHHHqqHHHHHH.', '.qHHHHqHHqHHHHq.', '.qqHHHqHHqHHHqq.', '..qqHHHhHHHHqq..', '......HHHH......', '......HhHq......', '......qHHq......', '.......HH.......', '.......qq.......']),
      side: at(3, ['qHq.............', 'HHHq............', 'HhH.HHHHHH......', 'HHqHHhhhhHHH....', 'HHHHhhhhhhHHHH..', 'qHHHhhhHHHHHHH..', 'qHHHHHHHHHHHqH..', '.HqHHHHHHHqHq.q.', '.qHHHHHHq.......', '..HHHHHq........', '..qHHHq.........', '...qqq..........']),
    },
  },
  // a child's head: rows 10-19
  'hair.pigtails': {
    front: {
      down: at(9, [...CHILD_CAP, '.qHHHHHHHHHHHHq.', 'qHHHqHHqHHqHHHHq', 'HHq.qq.qq.qq.qHH', 'HHq..........qHH', 'qHH..........HHq', '.qq..........qq.']),
      up: at(9, [...CHILD_CAP, '.qHHHHHHHHHHHHq.', 'qHHHHHHHHHHHHHHq', 'HHHHHHHHHHHHHHHH', 'HHqHHHHHHHHHHqHH', 'qHHqHHHHHHHHqHHq', '.qq.qqqqqqqq.qq.']),
      side: at(9, [...CHILD_CAP_SIDE, '.HHhhHHHHHHHqH..', '.HHHHHHHHHqHq.q.', 'qHHHHHHHq.......', 'HHHHHHHq........', 'HHqqqqq.........', 'qHH.............', '.qq.............']),
    },
  },
  'hair.tuft': {
    front: {
      down: at(7, ['.......qq.......', '........Hq......', ...CHILD_CAP, '..HqHHqHHqHHqH..', '..q.qq.qq.qq.q..']),
      up: at(7, ['.......qq.......', '........Hq......', ...CHILD_CAP, '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..qHHHHHHHHHHq..', '...qqqqqqqqqq...']),
      side: at(7, ['......qq........', '.......Hq.......', ...CHILD_CAP_SIDE, '..HhhHHHHHHqHq..', '..HHHHHHHqHq.q..', '..qHHHHq........', '...qqqq.........']),
    },
  },
  'hair.childbob': {
    front: {
      down: at(9, [...CHILD_CAP, '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..Hq.qq..qq.qH..', '..H..........H..', '..Hq........qH..', '..qH........Hq..', '...q........q...']),
      up: at(9, [...CHILD_CAP, '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..qHHHHHHHHHHq..', '...qqqqqqqqqq...']),
      side: at(9, [...CHILD_CAP_SIDE, '..HhhHHHHHHHHq..', '..HHHHHHHHHHHqq.', '..HHHHHHHq.qq...', '..HHHHHHq.......', '..HHHHHq........', '..qHHHHq........', '...qqqq.........']),
    },
  },
}

export type { Grid }
