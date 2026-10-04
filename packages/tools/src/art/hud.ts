// The project's own HUD icons where the pack has none (16x16, the pack's look): the skill tree's
// star on the corner button. Written as PNGs to public/assets/lsw/Ui/.
//
//   npx tsx packages/tools/src/art/hud.ts

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
console.log('hud icons written')
