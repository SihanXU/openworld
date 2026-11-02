// Where Chapter 1's pieces lie (docs/sets.md §4; content gearsets/ch1.ts, across.ts): the Order of the Thorn's dead on
// the Kneeling Field, the Pilgrim's Way and in the abbey's ruins; the vigil-keeper's things on Dawn Hill, in the hill
// mine and the mill's cellar; Aelis of Varrow's hat by her stone, the oldest on the Kneeling Field.

import { L } from '../kit.ts'
import type { Spot } from './index.ts'

const KNIGHT = L("A knight's bones", '骑士的遗骨')

export const CH1_SPOTS: Record<string, Spot[]> = {
  // the Thornward's helm and girdle, then the Pilgrim's hat (by the first stone, Aelis's)
  kneelfield: [{ at: [36, 6], name: KNIGHT }, { at: [6, 15], name: KNIGHT }, { at: [11, 8], name: L('A pilgrim\'s bones', '朝圣者的遗骨') }],
  // the Thornward's pauldrons and greaves, in the two ruined enclosures
  pilgrimway: [{ at: [14, 3], name: KNIGHT }, { at: [51, 18], name: KNIGHT }],
  // the Thornward's plate before the altar, its gauntlets in the west room
  abbey: [{ at: [20, 13], name: KNIGHT }, { at: [8, 13], name: KNIGHT }],
  // the Dawn Vigil's hood by the shrine's graves, its mittens in the mine, its shoes in the cellar
  dawnhill: [{ at: [15, 4], name: L("A sister's bones", '修女的遗骨') }],
  hillmine: [{ at: [24, 9], name: L("A sister's bones", '修女的遗骨') }],
  millcellar: [{ at: [7, 6], name: L("A sister's bones", '修女的遗骨') }],
}
