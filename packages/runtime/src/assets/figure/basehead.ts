// The head's parts on the bases (docs/looks.md §3.1), written by games/openworld/tools/src/art/looks/sprite/heads.py:
// the face's variants, a scar, freckles and age's lines drawn by hand on the standing head; beards and hats cut from
// ComfyUI drafts of the bald heads wearing them. One grid per facing fits every body (they share the head; a child's
// is the same, lower) and follows the head as it bobs. Letters: the base's own (K the line, O H J F Q the skin, M P N
// the eyes), the hair's a-e (a beard), a hat's f g h i (hat.1) and j k l m (hat.2), the glasses' n o (glasses.1) and
// p (their glint).

import type { BaseFacing } from './bases.ts'
import type { BasePart } from './baseoutfit.ts'

export interface BaseHead {
  /** The part on the standing head, in the facings it shows in. */
  grids: Partial<Record<BaseFacing, BasePart>>
  /** A hat's: per facing, the hair above this row is under it. */
  hides?: Partial<Record<BaseFacing, number>>
}

/** The head parts' own letters: their key and tone (light to dark). */
export const HEAD_LETTERS: Record<string, [string, number]> = {
  f: ['hat.1', 0],
  g: ['hat.1', 1],
  h: ['hat.1', 2],
  i: ['hat.1', 3],
  j: ['hat.2', 0],
  k: ['hat.2', 1],
  l: ['hat.2', 2],
  m: ['hat.2', 3],
  n: ['glasses.1', 1],
  o: ['glasses.1', 2],
}

/** Letters in a colour of their own: the glasses' glint. */
export const HEAD_FIXED: Record<string, string> = { p: '#f0f0e8' }

const FACE_SOFT_DOWN: BasePart = { top: 8, rows: [
  '.........QQ..QQ.........',
] }
const FACE_SOFT_LEFT: BasePart = { top: 8, rows: [
  '........Q..QQ...........',
] }
const FACE_KEEN_DOWN: BasePart = { top: 10, rows: [
  '.........JM..MJ.........',
] }
const FACE_KEEN_LEFT: BasePart = { top: 10, rows: [
  '........M..MJ...........',
] }
const FACE_STERN_DOWN: BasePart = { top: 7, rows: [
  '........KKK..KKK........',
] }
const FACE_STERN_LEFT: BasePart = { top: 7, rows: [
  '........K..KKK..........',
] }
const FACE_WEARY_DOWN: BasePart = { top: 9, rows: [
  '.........FK..KF.........',
] }
const FACE_WEARY_LEFT: BasePart = { top: 9, rows: [
  '........K..KF...........',
] }
const FACE_CHILD_DOWN: BasePart = { top: 9, rows: [
  '.........MM..MM.........',
  '.........OP..PO.........',
  '.........PP..PP.........',
] }
const FACE_CHILD_LEFT: BasePart = { top: 9, rows: [
  '........M..MM...........',
  '........P..PO...........',
  '........P..PP...........',
] }
const AGE_LINED_DOWN: BasePart = { top: 11, rows: [
  '........F......F........',
  '..........F..F..........',
] }
const AGE_LINED_LEFT: BasePart = { top: 11, rows: [
  '........F...F...........',
  '..........F.............',
] }
const MARK_SCAR_DOWN: BasePart = { top: 9, rows: [
  '..............Q.........',
  '...............Q........',
  '..............Q.........',
] }
const MARK_SCAR_LEFT: BasePart = { top: 9, rows: [
  '..............Q.........',
  '.............Q..........',
  '..............Q.........',
] }
const MARK_FRECKLES_DOWN: BasePart = { top: 11, rows: [
  '.........F.FF.F.........',
] }
const MARK_FRECKLES_LEFT: BasePart = { top: 11, rows: [
  '.........FF.F...........',
] }
const GLASSES_ROUND_DOWN: BasePart = { top: 9, rows: [
  '........o..pp..o........',
  '........o..nn..o........',
  '.........oo..oo.........',
] }
const GLASSES_ROUND_LEFT: BasePart = { top: 9, rows: [
  '..........p..onn........',
  '.............o..........',
  '........o..oo...........',
] }
const HAT_STRAW_DOWN: BasePart = { top: 3, rows: [
  '.........iiiiiii........',
  '........iffffffgi.......',
  '.......iffggggghi.......',
  '....iiihiihhhhhihiii....',
  '...ihhhhggggggggihhhi...',
  '...ihii..........iihi...',
  '....ig............gii...',
  '.....i............i.....',
] }
const HAT_STRAW_UP: BasePart = { top: 3, rows: [
  '.........iiiiii.........',
  '........iffffgfi........',
  '........ghfffgii........',
  '.....iighhhhhhhhgii.....',
  '....ihhhhgggggghhhii....',
  '....iii..........iii....',
  '....iii..........iii....',
] }
const HAT_STRAW_LEFT: BasePart = { top: 3, rows: [
  '.........iiiiii.........',
  '........igffffhi........',
  '.....iiiggggghii........',
  '....ighhhhhhhihhi.......',
  '....igiigggggg.hiii.....',
  '.....ii..........hhi....',
  '................iiii....',
  '................ii......',
] }
const HAT_KERCHIEF_DOWN: BasePart = { top: 3, rows: [
  '..........iiii..........',
  '........iiffggii........',
  '.......iffgghgggi.......',
  '.......iffhggffgi.......',
  '......ihg......fhi......',
  '......ih........hi......',
  '.......h........h.......',
  '.......h........h.......',
  '.......i........i.......',
  '..............hi........',
  '...........ih.ii........',
  '...........hh..i........',
  '..........iiii.h........',
  '..........ihgi..........',
  '..........i..i..........',
] }
const HAT_KERCHIEF_UP: BasePart = { top: 3, rows: [
  '..........iiii..........',
  '........iifgghii........',
  '........ffhhhhgg........',
  '.......igghhhgggi.......',
  '.......ihghhggggi.......',
  '.......igghhhgggi.......',
  '.......ffghghghi........',
  '........ihfhhhii........',
  '.........iiiiii.........',
  '..........iiii..........',
  '...........ii...........',
  '..........iih...........',
  '..........fih...........',
  '..........fhh...........',
  '..........ifg...........',
  '...........hh...........',
] }
const HAT_KERCHIEF_LEFT: BasePart = { top: 3, rows: [
  '..........iiii..........',
  '........iiggggi.........',
  '........fggfghhi........',
  '.......iffffhhghi.......',
  '............fihii.......',
  '.............fhii.......',
  '..............iii.......',
  '..............hh........',
  '..............ii........',
  '.............iii........',
  '..............ii........',
  '..............hg........',
  '...............g........',
  '...............g........',
  '...............i........',
  '...............i........',
] }
const HAT_HOOD_DOWN: BasePart = { top: 3, rows: [
  '.........iiiii..........',
  '........igggghii........',
  '.......ihgggggghi.......',
  '......ighggfffgggi......',
  '......ihhf....fggi......',
  '......ihf.......gi......',
  '......ig........ii......',
  '......if........ii......',
  '......if........gi......',
  '......if........hi......',
  '.......ifi....ihi.......',
  '........ifh.ihhii.......',
  '........hiffhhii........',
  '.......ifhihhihii.......',
  '.......ighhhhhii........',
  '........fhghhhhf........',
  '..........hhhf..........',
  '...........ii...........',
] }
const HAT_HOOD_UP: BasePart = { top: 3, rows: [
  '..........iiii..........',
  '........iiggggii........',
  '........ggggfhghi.......',
  '.......igggffhgfi.......',
  '.......iggfgggffi.......',
  '......iggggggggffi......',
  '.......ghggggggih.......',
  '......ihiggggggghi......',
  '.......igggggggii.......',
  '.......ifigggggfi.......',
  '........ifiggihi........',
  '........iihiihii........',
  '........hhhhhhii........',
  '........ighiihhi........',
  '.........fgghhi.........',
  '..........ifgi..........',
  '...........ih...........',
] }
const HAT_HOOD_LEFT: BasePart = { top: 3, rows: [
  '..........iiii..........',
  '........iifgggii........',
  '.......igffggfgi........',
  '.......if..ffhggi.......',
  '.......i....fhggi.......',
  '.............fggi.......',
  '.............fghi.......',
  '.......i.....fghi.......',
  '.......i.....ighi.......',
  '.......ii....gii........',
  '........ihi.hiii........',
  '.........ihhiihi........',
  '........ihhhhiii........',
  '.........fhghgi.........',
  '.........ifghif.........',
  '..........ghh...........',
  '...........f............',
] }
const HAT_HELM_DOWN: BasePart = { top: 3, rows: [
  '.........iiiiii.........',
  '.......iifgggggii.......',
  '.......igggfffghi.......',
  '......iggfghhgghhi......',
  '......ihhhihhihhii......',
  '......ihh......fii......',
  '.....ii..........ii.....',
] }
const HAT_HELM_UP: BasePart = { top: 3, rows: [
  '..........iiii..........',
  '........iiggggii........',
  '.......igggggfghi.......',
  '.......igfgggfgii.......',
  '.......ihghhiiiii.......',
  '......ihhhhhhiiiii......',
  '...........hh...........',
] }
const HAT_HELM_LEFT: BasePart = { top: 3, rows: [
  '.........iiiiii.........',
  '........ifggfghi........',
  '.......igggfffgi........',
  '.......igggghhhii.......',
  '.......ihghhhhhii.......',
  '......ii.....g.ii.......',
  '................ii......',
] }
const HAT_CAP_DOWN: BasePart = { top: 3, rows: [
  '.........iiiiii.........',
  '.......miggggghim.......',
  '.......igfhillfhi.......',
  '......mggflkkmhiim......',
  '.......iiiiihhhh........',
] }
const HAT_CAP_UP: BasePart = { top: 3, rows: [
  '..........iiii..........',
  '........iighghii........',
  '........hhgggfhi........',
  '.......ihfhmmhiii.......',
  '.......ihgiikliii.......',
] }
const HAT_CAP_LEFT: BasePart = { top: 3, rows: [
  '........iiiiiii.........',
  '........igggggfi........',
  '.......ihhhghghii.......',
  '......mjiiilkiiii.......',
  '......mmffklkf..........',
] }
const HAT_CIRCLET_DOWN: BasePart = { top: 6, rows: [
  '.......igffgggghi.......',
] }
const HAT_CIRCLET_UP: BasePart = { top: 6, rows: [
  '.......ihhhhhhhhi.......',
] }
const HAT_CIRCLET_LEFT: BasePart = { top: 6, rows: [
  '.......iffggghhhi.......',
] }
const HAT_THORNS_DOWN: BasePart = { top: 3, rows: [
  '................i.......',
  '......ii.ii....ihi......',
  '.....ihggfffgfffghi.....',
  '......ihgggfghghgi......',
  '..........i..i..ii......',
] }
const HAT_THORNS_UP: BasePart = { top: 4, rows: [
  '.......i........i.......',
  '.....iig.....i..fii.....',
  '......ihfii.hi.ghi......',
  '.......igggffghf.i......',
  '........i.i...h.........',
] }
const HAT_THORNS_LEFT: BasePart = { top: 4, rows: [
  '.......ii.i.i...i.......',
  '......igfgggfgfghi......',
  '......iigghffhhhhi......',
  '......if.....i...i......',
] }
const BEARD_FULL_DOWN: BasePart = { top: 10, rows: [
  '.......e................',
  '.......ed.dddc.de.......',
  '.......edcdbbbcde.......',
  '.......eccccbccde.......',
  '........dcccbcde........',
  '........edbbcbee........',
  '.........eedded.........',
  '...........ee...........',
] }
const BEARD_FULL_LEFT: BasePart = { top: 10, rows: [
  '........dccc..e.........',
  '.......edcedbbe.........',
  '.......ebccccde.........',
  '.......ebcccde..........',
  '........dbcddeb.........',
  '........eddeeb..........',
  '.........eedb...........',
] }
const BEARD_MOUSTACHE_DOWN: BasePart = { top: 10, rows: [
  '..........c.bc..........',
  '........ecdddbce........',
  '.........de..de.........',
] }
const BEARD_MOUSTACHE_LEFT: BasePart = { top: 10, rows: [
  '........bdcce...........',
  '.......ee.dce...........',
] }
const BEARD_STUBBLE_DOWN: BasePart = { top: 11, rows: [
  '..........bc............',
  '..........eede..........',
  '...........dc...........',
] }
const BEARD_STUBBLE_LEFT: BasePart = { top: 12, rows: [
  '.........bbb............',
] }

export const BASE_HEADS: Record<string, BaseHead> = {
  'face.bright': { grids: {  } },
  'face.soft': { grids: { down: FACE_SOFT_DOWN, left: FACE_SOFT_LEFT } },
  'face.keen': { grids: { down: FACE_KEEN_DOWN, left: FACE_KEEN_LEFT } },
  'face.stern': { grids: { down: FACE_STERN_DOWN, left: FACE_STERN_LEFT } },
  'face.weary': { grids: { down: FACE_WEARY_DOWN, left: FACE_WEARY_LEFT } },
  'face.child': { grids: { down: FACE_CHILD_DOWN, left: FACE_CHILD_LEFT } },
  'age.lined': { grids: { down: AGE_LINED_DOWN, left: AGE_LINED_LEFT } },
  'mark.scar': { grids: { down: MARK_SCAR_DOWN, left: MARK_SCAR_LEFT } },
  'mark.freckles': { grids: { down: MARK_FRECKLES_DOWN, left: MARK_FRECKLES_LEFT } },
  'glasses.round': { grids: { down: GLASSES_ROUND_DOWN, left: GLASSES_ROUND_LEFT } },
  'hat.straw': { grids: { down: HAT_STRAW_DOWN, up: HAT_STRAW_UP, left: HAT_STRAW_LEFT }, hides: { down: 7, left: 7, up: 7 } },
  'hat.kerchief': { grids: { down: HAT_KERCHIEF_DOWN, up: HAT_KERCHIEF_UP, left: HAT_KERCHIEF_LEFT }, hides: { down: 99, left: 99, up: 99 } },
  'hat.hood': { grids: { down: HAT_HOOD_DOWN, up: HAT_HOOD_UP, left: HAT_HOOD_LEFT }, hides: { down: 99, left: 99, up: 99 } },
  'hat.helm': { grids: { down: HAT_HELM_DOWN, up: HAT_HELM_UP, left: HAT_HELM_LEFT }, hides: { down: 8, left: 8, up: 9 } },
  'hat.cap': { grids: { down: HAT_CAP_DOWN, up: HAT_CAP_UP, left: HAT_CAP_LEFT }, hides: { down: 7, left: 7, up: 8 } },
  'hat.circlet': { grids: { down: HAT_CIRCLET_DOWN, up: HAT_CIRCLET_UP, left: HAT_CIRCLET_LEFT } },
  'hat.thorns': { grids: { down: HAT_THORNS_DOWN, up: HAT_THORNS_UP, left: HAT_THORNS_LEFT } },
  'beard.full': { grids: { down: BEARD_FULL_DOWN, left: BEARD_FULL_LEFT } },
  'beard.moustache': { grids: { down: BEARD_MOUSTACHE_DOWN, left: BEARD_MOUSTACHE_LEFT } },
  'beard.stubble': { grids: { down: BEARD_STUBBLE_DOWN, left: BEARD_STUBBLE_LEFT } },
}
