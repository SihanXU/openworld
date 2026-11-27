// Where the finale's pieces lie (docs/sets.md §4; content gearsets/fin.ts, across.ts): the Porch Wardens' hauberk and
// greaves in the chests by the wardens' posts at the porch; the Curia's in the vestry chests of the nave's transept arms
// beside the choir, the Second's circlet and earring in the reliquaries of its lower chapels; in the Confluence, the Last Door
// on the bones of those who sat down before the Holiest's fog, the Second's shawl in an old coffer, her slippers at the
// stair's foot, and the Pilgrim's habit laid at the door. The stair's landing (20,26), the channels and the fog stay clear.

import { L } from '../kit.ts'
import type { Spot } from './index.ts'

const RELIQUARY = L('A reliquary', '圣物匣')
const DOOR = L("A pilgrim's bones", '朝圣者的遗骨')

export const FIN_SPOTS: Record<string, Spot[]> = {
  // the Porch Wardens' hauberk and greaves, either side of the porch by the wardens' posts
  holyhall: [
    { at: [20, 61], kind: 'chest', name: L("The wardens' chest", '守卫的箱子') },
    { at: [29, 61], kind: 'chest', name: L("The wardens' chest", '守卫的箱子') },
  ],
  // the Curia's cowl, cope, robe, cincture and shoes in the vestry's box, stand, wardrobe, rack and chest (in the west arm,
  // each drawn as itself, catalog.ts); then the Second's circlet and earring in the lower chapels' reliquaries
  'holyhall.nave': [
    { at: [3, 28], kind: 'chest', id: 'holyhall.nave.vestry.box', name: L('A small box', '小匣子') },
    { at: [2, 27], kind: 'chest', id: 'holyhall.nave.vestry.stand', name: L('A vestment stand', '法衣架子') },
    { at: [3, 25], kind: 'chest', id: 'holyhall.nave.vestry.wardrobe', name: L('The vestry wardrobe', '法衣柜') },
    { at: [6, 25], kind: 'chest', id: 'holyhall.nave.vestry.rack', name: L('A rack of vestments', '挂法衣的架子') },
    { at: [6, 28], kind: 'chest', id: 'holyhall.nave.vestry.chest', name: L('A vestry chest', '法衣箱') },
    { at: [4, 47], kind: 'chest', id: 'holyhall.nave.reliquary.w', name: RELIQUARY },
    { at: [30, 47], kind: 'chest', id: 'holyhall.nave.reliquary.e', name: RELIQUARY },
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
