// The project's own HUD icons where the pack has none (16x16, the pack's look): the skill tree's
// star and the options' gear on the corner buttons. Written as PNGs to public/assets/lsw/Ui/.
//
//   npx tsx games/openworld/tools/src/art/hud.ts

import { writeIcon } from './png.ts'

// ---------------------------------------------------------------- the skill tree: a four-pointed star, lit from the top left
const STAR = [
  '................',
  '.......kk.......',
  '......kHYk......',
  '......kHYk......',
  '.....kHHYOk.....',
  '....kHHHYYOk....',
  '..kkHHHHYYOOkk..',
  'kkHHHHHWWYYYOOkk',
  'kkHHHYYWWOOOOOkk',
  '..kkYYYYOOOOkk..',
  '....kYYYOOOk....',
  '.....kYYOOk.....',
  '......kYOk......',
  '......kYOk......',
  '.......kk.......',
  '................',
]
const GOLD = { H: '#fff1a0', Y: '#f6c232', O: '#c9801f', W: '#ffffff', k: '#4a2a10' }

writeIcon('Ui/Star.png', STAR, GOLD)

// ---------------------------------------------------------------- the options: an iron gear, lit from the top left
const GEAR = [
  '................',
  '......kkkk......',
  '...kk.kHHk.kk...',
  '..kHHkkHHkkHHk..',
  '..kHHHHHHHHHSk..',
  '...kHHHkkHHSk...',
  '.kkkHHk..kSSkkk.',
  '.kHHHk....kSSSk.',
  '.kHHSk....kSSSk.',
  '.kkkSSk..kSSkkk.',
  '...kSSSkkSSSk...',
  '..kSSSSSSSSSSk..',
  '..kSSkkSSkkSSk..',
  '...kk.kSSk.kk...',
  '......kkkk......',
  '................',
]
const IRON = { H: '#d8dde4', S: '#8a93a0', k: '#2e2a33' }

writeIcon('Ui/Gear.png', GEAR, IRON)
console.log('hud icons written')
