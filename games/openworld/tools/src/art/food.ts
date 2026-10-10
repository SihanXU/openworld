// The project's own food icons (16x16, the pack's look: a dark outline, three tones and a
// highlight): raw beef and the cooked steak, the chicken leg raw and roast, the egg raw and
// boiled. Written as PNGs to public/assets/lsw/Items/.
//
//   npx tsx games/openworld/tools/src/art/food.ts

import { writeIcon } from './png.ts'

// ---------------------------------------------------------------- beef: a steak with its fat rim and marbling
const STEAK = [
  '................',
  '................',
  '....kkkkkk......',
  '..kkFFFFFFkkk...',
  '.kFFRRRLLRRFFk..',
  '.kFRRLLLRRRRRFk.',
  'kFRRLLRRFRRRRRFk',
  'kFRRRRRFRRRRDRFk',
  'kFRRRRFRRRRDDRFk',
  'kFRDRRRRRRDDRRFk',
  '.kFRDDRRRRRRRFk.',
  '.kFFRDDDRRRRFFk.',
  '..kkFFFFFFFFkk..',
  '....kkkkkkkk....',
  '................',
  '................',
]
const RAW_BEEF = { F: '#f6e7d8', R: '#d8424a', L: '#f2847c', D: '#9c2430', k: '#3c1418' }
const COOKED_BEEF = { F: '#e2b07a', R: '#9a5630', L: '#c98a52', D: '#5e3018', k: '#2e160c' }

// ---------------------------------------------------------------- chicken: a drumstick, the meat round, the bone's knob below
const LEG = [
  '................',
  '......kkkk......',
  '....kkLLMMkk....',
  '...kLLMMMMMMk...',
  '..kLMMMMMMMMMk..',
  '..kLMMMMMMMMSk..',
  '..kMMMMMMMMMSk..',
  '..kMMMMMMMMSSk..',
  '...kMMMMMSSSk...',
  '....kSMMSSSk....',
  '.....kkSSkk.....',
  '......kBBk......',
  '......kBBk......',
  '.....kBBBBk.....',
  '.....kBkkBk.....',
  '......k..k......',
]
const RAW_LEG = { L: '#fde2d8', M: '#f4b4a4', S: '#d88474', B: '#f6eedc', k: '#5a2a24' }
const ROAST_LEG = { L: '#f6c878', M: '#d88a3c', S: '#a2561e', B: '#f6eedc', k: '#3e1e0c' }

// ---------------------------------------------------------------- the egg, whole; and boiled, cut in half
const EGG = [
  '................',
  '......kkkk......',
  '.....kWWWWk.....',
  '....kWHWWWWk....',
  '....kWHWWWWk....',
  '...kWHWWWWWWk...',
  '...kWWWWWWWSk...',
  '...kWWWWWWWSk...',
  '...kWWWWWWSSk...',
  '...kWWWWWWSSk...',
  '...kSWWWWSSSk...',
  '....kSSSSSSk....',
  '.....kkkkkk.....',
  '................',
  '................',
  '................',
]
const RAW_EGG = { W: '#fbf1dc', H: '#ffffff', S: '#dcc49c', k: '#5e4a32' }
const HALF_EGG = [
  '................',
  '................',
  '................',
  '......kkkk......',
  '....kkWWWWkk....',
  '...kWWWWWWWWk...',
  '..kWWWYYYYWWWk..',
  '..kWWYYHYYYWWk..',
  '..kWWYYYYYOWWk..',
  '..kWWWYYYOOWWk..',
  '..kSWWWWWWWWSk..',
  '...kSSWWWWSSk...',
  '....kkSSSSkk....',
  '......kkkk......',
  '................',
  '................',
]
const BOILED_EGG = { W: '#fffaf0', S: '#e0d4bc', Y: '#f6c232', O: '#d8952a', H: '#ffe68a', k: '#5e4a32' }

writeIcon('Items/RawBeef.png', STEAK, RAW_BEEF)
writeIcon('Items/Steak.png', STEAK, COOKED_BEEF)
writeIcon('Items/RawChicken.png', LEG, RAW_LEG)
writeIcon('Items/RoastChicken.png', LEG, ROAST_LEG)
writeIcon('Items/Egg.png', EGG, RAW_EGG)
writeIcon('Items/BoiledEgg.png', HALF_EGG, BOILED_EGG)
console.log('food icons written')
