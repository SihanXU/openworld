// The project's own icons for what only monsters leave (content drops.ts; 16x16, the pack's look: a dark outline, three
// tones and a highlight): a slime's gel, a spider's venom sac, a spectre's ectoplasm. Written as PNGs to
// public/assets/lsw/Items/.
//
//   npx tsx games/openworld/tools/src/art/drops.ts

import { writeIcon } from './png.ts'

// ---------------------------------------------------------------- slime gel: a quivering green dollop, a bead rolling off it
const GEL = [
  '................',
  '................',
  '.......kk.......',
  '......kHLk......',
  '.....kHLLMk.....',
  '....kHLLMMMk....',
  '...kLLMMMMMMk...',
  '..kLMMMMMMMMDk..',
  '..kLMMMMMMMDDk..',
  '.kLMMMMMMMMDDDk.',
  '.kMMMMMMMMDDDDk.',
  '.kDMMMMMMDDDDDk.',
  '..kDDDDDDDDDDk.k',
  '...kkkkkkkkkk.kL',
  '...............k',
  '................',
]
const GEL_PAL = { H: '#f2ffd8', L: '#b6ec6a', M: '#7ccf3c', D: '#4c9a24', k: '#1f3c12' }

// ---------------------------------------------------------------- venom sac: a swollen sac, its sickly green, the drop it weeps
const SAC = [
  '................',
  '.......kk.......',
  '......kSSk......',
  '.....kkSSkk.....',
  '....kLHLLLLk....',
  '...kLHLLMMMMk...',
  '..kLHLMMMMMMMk..',
  '..kLLMMMMVVMMk..',
  '..kLMMMMVVVMDk..',
  '..kMMMMMVVMMDk..',
  '...kMMMMMMMDk...',
  '....kDMMMMDk....',
  '.....kkDDkk.....',
  '.......kGk......',
  '.......kGk......',
  '........k.......',
]
const SAC_PAL = { S: '#7a5a8a', H: '#f0d8f6', L: '#c08ad0', M: '#8e4aa8', D: '#5a2670', V: '#a8e05a', G: '#9adc3c', k: '#2a1036' }

// ---------------------------------------------------------------- ectoplasm: a pale curl of the stuff of the dead, lit from within
const ECTO = [
  '................',
  '........kk......',
  '.......kHLk.....',
  '......kHLk......',
  '.....kLLk...kk..',
  '....kLLMk..kLLk.',
  '...kLMMMk.kLMMk.',
  '..kLMMMMMkLMMk..',
  '..kLMMWWMMMMk...',
  '..kMMWWWMMMDk...',
  '...kMMWMMMDDk...',
  '....kMMMMDDk....',
  '.....kDDDDk.....',
  '......kkkk......',
  '................',
  '................',
]
const ECTO_PAL = { H: '#ffffff', W: '#f4ffff', L: '#d4f6f6', M: '#9ee0e6', D: '#5aa6b8', k: '#1e3e4a' }

writeIcon('Items/SlimeGel.png', GEL, GEL_PAL)
writeIcon('Items/VenomSac.png', SAC, SAC_PAL)
writeIcon('Items/Ectoplasm.png', ECTO, ECTO_PAL)
console.log('drop icons written')
