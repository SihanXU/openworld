// Where Chapter 4's pieces lie (docs/sets.md §4; content gearsets/ch4.ts, across.ts). The Fens' dead do not lie still,
// so what lies here was held down: the lamplighters by the causeway's lamps and grave-posts, a fenwalker nailed to its
// planks; the fenwalkers' things in the Drowned Graves, one in a coffin the water gave back; the keepers' in the reliquary
// before the Shroud; the riders nailed down on Bone Isle and standing in the Ford of the Dead; a pilgrim in the graves.

import { L } from '../kit.ts'
import type { Spot } from './index.ts'

const RIDER = L("A rider's bones, nailed down", '被钉住的骑手遗骨')
const KEEPER = L("A keeper's bones", '守匣人的遗骨')
const FENWALKER = L("A fenwalker's bones", '沼行者的遗骨')

export const CH4_SPOTS: Record<string, Spot[]> = {
  // the Gravelamp's hood by a fog lamp in the west marsh, its belt by a grave-post; the Fenwalker's grips nailed to the
  // causeway's planks, its rope on the east island
  causeway: [
    { at: [8, 21], name: L("A lamplighter's bones", '点灯人的遗骨') },
    { at: [19, 19], name: L("A lamplighter's bones", '点灯人的遗骨') },
    { at: [21, 29], name: L('Bones nailed to the planks', '钉在木板上的遗骨') },
    { at: [25, 14], name: FENWALKER },
  ],
  // the Ferryman's oar-pin, in a box at the landing beside Klaas's coin box
  nailgate: [{ at: [44, 25], kind: 'chest', name: L('A box of oar-pins', '一箱桨栓') }],
  // the Gravelamp's mantle, in the lamp-keepers' chest at the chapel's east wall
  'nailgate.chapel': [{ at: [14, 12], kind: 'chest', name: L("The lamp-keepers' chest", '点灯人的箱子') }],
  // the Reliquary's cowl in the keepers' chest, its robe on a keeper facing the Shroud, its earring in the far corner
  'boneisle.reliquary': [
    { at: [4, 16], kind: 'chest', name: L("The keepers' chest", '守匣人的箱子') },
    { at: [12, 10], name: KEEPER },
    { at: [16, 16], name: KEEPER },
  ],
  // the Reliquary's gloves by the reliquary's door; the Reinholder's helm, pauldrons, gauntlets and girdle by the island's stones
  boneisle: [
    { at: [13, 11], name: KEEPER },
    { at: [27, 10], name: RIDER },
    { at: [11, 12], name: RIDER },
    { at: [28, 13], name: RIDER },
    { at: [25, 21], name: RIDER },
  ],
  // the Fenwalker's hood among the east stones, its cape in the reeds, its eelskin in a risen coffin by the pond, its boots
  // in the open marsh; then the Pilgrim's gloves by the water
  drowned: [
    { at: [40, 9], name: FENWALKER },
    { at: [14, 3], name: L('Bones in the reeds', '芦苇里的遗骨') },
    { at: [11, 12], kind: 'chest', name: L('A coffin the water gave back', '水里浮上来的棺材') },
    { at: [30, 21], name: FENWALKER },
    { at: [28, 25], name: L("A pilgrim's bones", '朝圣者的遗骨') },
  ],
  // the Reinholder's plate and greaves, riders who stood in the ford
  deadford: [
    { at: [7, 13], name: RIDER },
    { at: [22, 17], name: RIDER },
  ],
}
