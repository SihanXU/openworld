// What is worn over the outfit on the map sprite (docs/looks.md §5): a breastplate (armour), a cloak or pauldrons
// (cloak), each over the figure per facing and walk frame (frames 1 and 3: the body one row lower), painted in the
// worn thing's material (its colour 1: c C x). Drawn after the outfit, before the head's parts.

import { at, type Grid, type OutfitPix } from './pixgrid.ts'

const lower = (g: Grid): Grid => ['................', ...g.slice(0, -1)]
const bob = (g: Grid): Grid[] => [g, lower(g), g, lower(g)]

export const WEARS: Record<string, OutfitPix> = {
  'armour.plate': {
    regions: {},
    over: {
      down: bob(at(17, ['.....xCCCCx.....', '.....CccCCC.....', '.....CcCCCC.....', '.....xCCCCx.....', '......xxxx......'])),
      up: bob(at(17, ['.....xCCCCx.....', '.....CCCCCC.....', '.....CCCCCC.....', '.....xCCCCx.....', '......xxxx......'])),
      side: bob(at(17, ['......xCCCx.....', '......CcCCC.....', '......CCCCx.....', '......xCCx......', '.......xx.......'])),
    },
  },
  'cloak.cloak': {
    regions: {},
    over: {
      down: bob(at(17, ['...xCx....xCx...', '..xCCx....xCCx..', '..xCCx....xCCx..', '..xCCx....xCCx..', '..xCCx....xCCx..', '..xCCx....xCCx..', '..xCCx....xCCx..', '...xx......xx...'])),
      up: bob(at(17, ['...xCCCCCCCCx...', '..xCCCCCCCCCCx..', '..CCCcCCCCCCCC..', '..CCCcCCCCCCCC..', '..CCCCCCCCCCCC..', '..CCCCCCCCCCCC..', '..xCCCCCCCCCCx..', '...xCCCCCCCCx...', '....xxxxxxxx....'])),
      side: bob(at(17, ['....xCCx........', '...xCCCx........', '...CCCCx........', '...CCCCx........', '...CCCCx........', '...CCCCx........', '...xCCCx........', '....xxx.........'])),
    },
  },
  'cloak.pauldrons': {
    regions: {},
    over: {
      down: bob(at(16, ['..xCCx....xCCx..', '..CccCx..xCccC..', '..xCCx....xCCx..'])),
      up: bob(at(16, ['..xCCx....xCCx..', '..CCCCx..xCCCC..', '..xCCx....xCCx..'])),
      side: bob(at(16, ['.....xCCx.......', '.....CccCx......', '.....xCCx.......'])),
    },
  },
}
