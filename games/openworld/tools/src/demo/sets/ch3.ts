// Where Chapter 3's pieces lie (docs/sets.md §4; content gearsets/ch3.ts, across.ts): the Tithe Riders by their carts
// and the wayside scale on the Chaff Road, the last of them by the salt-crusted cart on the White Pans; what the wind left
// of the Lightened among the Standing's rows; Brother Halvard's rope belt alone on the salt; the last almoner's box in the
// Chapel of the Measure's side room; Ele's priests and clerks in the court, the counting room and on the Scale Floor.

import { L } from '../kit.ts'
import type { Spot } from './index.ts'

const RIDER = L("A rider's bones", '骑手的遗骨')
const WIND = L('What the wind left', '风留下的东西')
const PRIEST = L("A priest's bones", '司铎的遗骨')
const CLERK = L("A clerk's bones", '书记的遗骨')

export const CH3_SPOTS: Record<string, Spot[]> = {
  // the Tithe Riders' hood by the western cart, the mantle by the eastern, the bracers at the wayside scale
  chaffroad: [{ at: [15, 11], name: RIDER }, { at: [45, 17], name: RIDER }, { at: [26, 11], name: RIDER }],
  // the last rider's boots by the salt-crusted cart; the Lightened's six among the Standing (north rows, then south);
  // the Pilgrim's rope belt alone, away from the rows
  saltpans: [
    { at: [20, 9], name: RIDER },
    { at: [25, 6], name: WIND }, { at: [29, 9], name: WIND }, { at: [38, 11], name: WIND },
    { at: [22, 21], name: WIND }, { at: [31, 23], name: WIND }, { at: [43, 24], name: WIND },
    { at: [12, 22], name: L("A pilgrim's bones", '朝圣者的遗骨') },
  ],
  // the Almoner's mittens in the box the last almoner kept in the chapel's side room
  'fairweight.chapel': [{ at: [16, 11], kind: 'chest', name: L("The last almoner's box", '上一任施赈人的箱子') }],
  // the Black Balance's stole between the clerks' desks, its cincture by the court's cart
  blackbalance: [{ at: [12, 15], name: PRIEST }, { at: [24, 18], name: PRIEST }],
  // its cowl by the bookcases, its gloves by the chests, away from the ledger
  'blackbalance.counting': [{ at: [4, 13], name: CLERK }, { at: [21, 13], name: CLERK }],
  // its cassock and slippers in the Scale Floor's lower corners
  scalefloor: [{ at: [4, 24], name: PRIEST }, { at: [25, 24], name: PRIEST }],
}
