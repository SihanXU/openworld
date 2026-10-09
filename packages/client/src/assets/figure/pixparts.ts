// The map sprite's parts (docs/looks.md §3.2): the grids each look part is drawn with on the map, per facing
// (side: facing right; left mirrors it). Head parts are in the adult head's frame (rows 4-24 of the 16x32 frame);
// a child's own parts in the child's. Letters: h H q the hair's light, mid and dark; e the eyes' colour; w white;
// k ink; p the mouth; b a blush; c C x a part's own colour 1 (light, mid, dark), d D y its colour 2, m M z its
// colour 3; '-' clears what is under it. The figure's regions an outfit paints: t u T torso, r R arms, n hands,
// l L legs, f feet.

import { at, type HeadPart } from './pixgrid.ts'
import { CAP_DOWN, CAP_SIDE, LONG_UP, MORE_HAIRS, SHORT_UP } from './pixhair.ts'
export { BEARDS, GLASSES, HATS, MARKS } from './pixhead.ts'
export type { Facing, Grid, HeadPart, OutfitPix } from './pixgrid.ts'

// ---------------------------------------------------------------- faces (eyes, mouth; no moods on the map)

export const FACES: Record<string, HeadPart> = {
  'face.soft': {
    front: {
      down: at(10, ['....kk....kk....', '....ew....ew....', '....ee....ee....', '...b........b...', '.......pp.......']),
      side: at(10, ['..........kk....', '..........ew....', '..........ee....', '.............b..', '.............p..']),
    },
  },
  'face.bright': {
    front: {
      down: at(10, ['...kkk....kkk...', '....we....we....', '....ee....ee....', '................', '.......pp.......']),
      side: at(10, ['..........kkk...', '..........we....', '..........ee....', '................', '.............p..']),
    },
  },
  'face.keen': {
    front: {
      down: at(10, ['................', '...kkk....kkk...', '....ek....ke....', '................', '.......p........']),
      side: at(10, ['................', '..........kkk...', '..........ek....', '................', '.............p..']),
    },
  },
  'face.stern': {
    front: {
      down: at(9, ['...qqq....qqq...', '................', '....kk....kk....', '....ek....ke....', '................', '......pppp......']),
      side: at(9, ['.........qqqq...', '................', '..........kk....', '..........ek....', '................', '............pp..']),
    },
  },
  'face.weary': {
    front: {
      down: at(10, ['................', '....kk....kk....', '....ee....ee....', '................', '.......pp.......']),
      side: at(10, ['................', '..........kk....', '..........ee....', '................', '.............p..']),
    },
  },
  // a child's head sits lower: rows 10-19
  'face.child': {
    front: {
      down: at(14, ['....kk....kk....', '....ew....ew....', '....ee....ee....', '...b........b...', '.......pp.......']),
      side: at(14, ['..........kk....', '..........ew....', '..........ee....', '.............b..', '.............p..']),
    },
  },
}

// ---------------------------------------------------------------- hair

export const HAIRS: Record<string, HeadPart> = {
  'hair.short': {
    front: {
      down: at(4, [...CAP_DOWN, '.HqHHqHHHqHHqHH.', '.qq.q..qq.q..qq.', '.q............q.']),
      up: SHORT_UP,
      side: at(4, [...CAP_SIDE, '.HHHHHHHHHqHq.q.', '.HHHHHHHq.......', '.qHHHHHq........', '.qHHHHq.........', '..qqqq..........']),
    },
  },
  'hair.long': {
    front: {
      down: at(4, [
        ...CAP_DOWN,
        '.HHHHHHHHHHHHHH.',
        '.HHqHqHqqHqHqHH.',
        '.HHq........qHH.',
        '.HH..........HH.',
        '.HH..........HH.',
        '.HHq........qHH.',
        '.HHH........HHH.',
        '.HHH........HHH.',
        '.qHH........HHq.',
        '..qq........qq..',
      ]),
      up: LONG_UP,
      side: at(4, [...CAP_SIDE, '.HHHHHHHHHHqHqq.', '.HHHHHHHHq......', '.HHHHHHHq.......', '.HHHHHHq........', '.HHHHHH.........', '.HHHHHq.........']),
    },
    back: {
      down: at(11, Array(10).fill('.HHHHHHHHHHHHHH.').concat(['..qHHHHHHHHHHq..', '...qqqqqqqqqq...'])),
      side: at(15, ['.HHHHH..........', '.HHHHH..........', '.HHHHHH.........', '.HHHHHH.........', '.qHHHHH.........', '.qHHHHH.........', '..qHHHq.........', '...qqq..........']),
    },
  },
  'hair.bob': {
    front: {
      down: at(4, [
        ...CAP_DOWN,
        '.HHHHHHHHHHHHHH.',
        '.HHHHHHHHHHHHHH.',
        '.HHq.qq..qq.qHH.',
        '.HH..........HH.',
        '.HH..........HH.',
        '.HHq........qHH.',
        '.qHH........HHq.',
        '..qq........qq..',
      ]),
      up: at(4, [
        '.....HHHHHH.....',
        '...HHhhhhhHHH...',
        '..HHhhhhhhHHHH..',
        '.HHhhhhhHHHHHHH.',
        '.HHHHHHHHHHHHHH.',
        '.HHHHHHHHHHHHHH.',
        '.HHHHHHHHHHHHHH.',
        '.HHHHHHHHHHHHHH.',
        '.HHHHHHHHHHHHHH.',
        '.HHHHHHHHHHHHHH.',
        '.qHHHHHHHHHHHHq.',
        '..qqqqqqqqqqqq..',
      ]),
      side: at(4, [...CAP_SIDE, '.HHHHHHHHHHHHqq.', '.HHHHHHHHq.qq...', '.HHHHHHHq.......', '.HHHHHHq........', '.HHHHHHq........', '.qHHHHq.........', '..qqqq..........']),
    },
  },
  ...MORE_HAIRS,
  'hair.bun': {
    front: {
      down: at(1, [
        '......qHHq......',
        '.....HhhhHH.....',
        '.....HHHHHq.....',
        ...CAP_DOWN,
        '.HHHhhHHHHhhHHH.',
        '.qHHq......qHHq.',
        '.q............q.',
      ]),
      up: at(1, [
        '......qHHq......',
        '.....HhhhHH.....',
        '.....HHHHHq.....',
        '.....HHHHHH.....',
        '...HHhhhhhHHH...',
        '..HHhhhhhhHHHH..',
        '.HHhhhhhHHHHHHH.',
        '.HHHHHHHHHHHHHH.',
        '.HHHHHHHHHHHHHH.',
        '.HHHHHHHHHHHHHH.',
        '.HHHHHHHHHHHHHH.',
        '.qHHHHHHHHHHHHq.',
        '..qHHHHHHHHHHq..',
        '...qqqqqqqqqq...',
      ]),
      side: at(2, ['.qHHq...........', 'HhhhHq..........', 'HHHHHHHHHH......', ...CAP_SIDE.slice(1), '.HHHHHHHhhHHHqq.', '.HHHHHHHq.......', '.qHHHHHq........', '..qqqq..........']),
    },
  },
}


export { OUTFITS } from './pixoutfit.ts'
