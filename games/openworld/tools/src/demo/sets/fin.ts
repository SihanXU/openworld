// Where the finale's pieces lie (docs/sets.md §4; content gearsets/fin.ts, across.ts): the Porch Wardens' hauberk and
// greaves in the chests by the wardens' posts at the porch; the Curia's in the vestry chests of the nave's transept and
// side chapels, the Second's circlet and earring in its two other chapels' reliquaries; in the Confluence, the Last Door
// on the bones of those who sat down before the Holiest's fog, the Second's shawl in an old coffer, her slippers at the
// stair's foot, and the Pilgrim's habit laid at the door. The stair's landing (20,26), the channels and the fog stay clear.

import { L } from '../kit.ts'
import type { Spot } from './index.ts'

const VESTRY = L('A vestry chest', '法衣柜')
const RELIQUARY = L('A reliquary', '圣物匣')
const DOOR = L("A pilgrim's bones", '朝圣者的遗骨')

export const FIN_SPOTS: Record<string, Spot[]> = {
  // the Porch Wardens' hauberk and greaves, either side of the porch by the wardens' posts
  holyhall: [
    { at: [20, 61], kind: 'chest', name: L("The wardens' chest", '守卫的箱子') },
    { at: [29, 61], kind: 'chest', name: L("The wardens' chest", '守卫的箱子') },
  ],
  // the Curia's cowl, cope, robe, cincture and shoes; then the Second's circlet and earring
  'holyhall.nave': [
    { at: [3, 28], kind: 'chest', name: VESTRY },
    { at: [31, 28], kind: 'chest', name: VESTRY },
    { at: [5, 40], kind: 'chest', name: VESTRY },
    { at: [29, 40], kind: 'chest', name: VESTRY },
    { at: [3, 33], kind: 'chest', name: VESTRY },
    { at: [5, 49], kind: 'chest', name: RELIQUARY },
    { at: [29, 49], kind: 'chest', name: RELIQUARY },
  ],
  // the Last Door's hood, gloves, belt and boots before the fog; the Second's shawl and slippers; the Pilgrim's habit
  confluence: [
    { at: [15, 3], name: DOOR },
    { at: [24, 3], name: DOOR },
    { at: [14, 8], name: DOOR },
    { at: [26, 9], name: DOOR },
    { at: [7, 3], kind: 'chest', name: L('An old coffer', '一只旧匣子') },
    { at: [18, 26], kind: 'chest', name: L('At the foot of the stair', '楼梯脚下') },
    { at: [21, 4], name: L('Left at the door', '留在门前') },
  ],
}
