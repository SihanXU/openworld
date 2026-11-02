// Where Chapter 5's pieces lie (docs/sets.md §4; content gearsets/ch5.ts, across.ts): the Chalk Stair's bearers by the
// graves on the White Stair; Ysolde's hood in her chest, and those who turned back lying on the lower stair facing down;
// the Restless and the White-Robed among the catacombs' galleries and the west tomb, clear of the niches and the fog;
// the White-Robed's robe, girdle and wrappings in the heap beneath the altar; the Elect's gifts in the abbey's chests;
// the Pilgrim's mantle by a grave on the stair.

import { L } from '../kit.ts'
import type { Spot } from './index.ts'

const BROTHER = L("A brother's bones", '修士的遗骨')
const PILGRIM = L("A pilgrim's bones", '朝圣者的遗骨')
const FALLEN = L('Bones fallen from a niche', '从壁龛里掉出来的遗骨')
const BENEATH = L('Bones beneath the altar', '祭坛下的遗骨')

export const CH5_SPOTS: Record<string, Spot[]> = {
  // the Chalk Stair's mantle, gloves and sandals (each by a grave and its robe on the stair); the Turned Back's hood (in
  // Ysolde's chest by her cell), cloak (on the heath) and boots (near the stair's foot); then the Pilgrim's mantle
  whitestair: [
    { at: [22, 9], name: BROTHER },
    { at: [29, 20], name: BROTHER },
    { at: [13, 31], name: BROTHER },
    { at: [11, 16], kind: 'chest', name: L("Ysolde's chest", '伊索尔德的箱子') },
    { at: [4, 20], name: PILGRIM },
    { at: [34, 35], name: PILGRIM },
    { at: [32, 31], name: PILGRIM },
  ],
  // the Restless's locket, earring and ring; the White-Robed's veil, mantle and wrappings (the west tomb's corner)
  catacombs: [
    { at: [25, 9], name: FALLEN },
    { at: [4, 18], name: FALLEN },
    { at: [8, 19], name: FALLEN },
    { at: [5, 9], name: FALLEN },
    { at: [24, 19], name: FALLEN },
    { at: [11, 15], name: FALLEN },
  ],
  // the White-Robed's robe, girdle and foot-wrappings, among the heaped white-robed
  beneathaltar: [{ at: [6, 7], name: BENEATH }, { at: [22, 7], name: BENEATH }, { at: [5, 20], name: BENEATH }],
  // the Elect's stole, in a chest in the nave's corner
  'whiteveil.church': [{ at: [5, 14], kind: 'chest', name: L('A chest in the church', '教堂里的箱子') }],
  // the Elect's gloves (the hall, by Agathe's frame) and cincture (the abbot's room)
  'whiteveil.robing': [
    { at: [18, 17], kind: 'chest', name: L('A chest in the robing house', '白袍房的箱子') },
    { at: [25, 11], kind: 'chest', name: L("The abbot's chest", '院长的箱子') },
  ],
  // the Elect's slippers, by a made bed
  'whiteveil.cells': [{ at: [9, 6], kind: 'chest', name: L('A chest by a made bed', '铺好的床边的箱子') }],
}
