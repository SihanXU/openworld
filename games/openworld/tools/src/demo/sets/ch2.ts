// Where Chapter 2's pieces lie (docs/sets.md §4; content gearsets/ch2.ts, across.ts): the Pitman's on the dead in the
// mine's four galleries; the Cinder Hoard heaped round the dragon's nest; the Ashen Watch's brothers on the pass, in the
// Lashmarks, at the end of the undercroft's channels and beside the Bastion's fog; the Red Order in a brother's chest,
// on the Bastion's old guard, at the foot of the Scourging Post and in the hall's vestry chest; the Pilgrim's boots low on
// the pass, where he came no farther east.

import { L } from '../kit.ts'
import type { Spot } from './index.ts'

const MINER = L("A miner's bones", '矿工的遗骨')
const HOARD = L("The dragon's hoard", '龙的宝藏')
const GREY = L("A grey brother's bones", '灰衣修士的遗骨')
const RED = L("A red brother's bones", '红衣修士的遗骨')

export const CH2_SPOTS: Record<string, Spot[]> = {
  // the Pitman's cap, mitts, belt and boots: the north chamber, the east chamber, the west alcove, the south-west drift
  mine: [{ at: [20, 3], name: MINER }, { at: [31, 11], name: MINER }, { at: [7, 9], name: MINER }, { at: [11, 21], name: MINER }],
  // the Cinder Hoard's amulet, earring and signet, round the nest
  lair: [{ at: [10, 9], kind: 'chest', name: HOARD }, { at: [20, 6], kind: 'chest', name: HOARD }, { at: [17, 11], kind: 'chest', name: HOARD }],
  // the Ashen Watch's hood and boots on the slopes, then the Pilgrim's boots low by the west way
  pass: [{ at: [6, 18], name: GREY }, { at: [24, 21], name: GREY }, { at: [8, 29], name: L("A pilgrim's bones", '朝圣者的遗骨') }],
  // the Ashen Watch's cloak under the south cliffs, its gloves on the north-east rise
  lashmarks: [{ at: [5, 25], name: GREY }, { at: [50, 4], name: GREY }],
  // the Ashen Watch's jerkin, where the channels go into the wall
  'scourgehouse.undercroft': [{ at: [21, 10], name: GREY }],
  // the Ashen Watch's belt beside the fog into the Pillar Yard (he did not go in); the Red Order's pauldrons and gauntlets on the old guard
  bastion: [{ at: [36, 17], name: GREY }, { at: [10, 8], name: RED }, { at: [35, 22], name: RED }],
  // the Red Order's hood, in a brother's chest
  'scourgehouse.cells': [{ at: [2, 1], kind: 'chest', name: L("A brother's chest", '修士的箱子') }],
  // the Red Order's plate and cincture, at the foot of the post
  pillaryard: [{ at: [11, 6], name: RED }, { at: [14, 4], name: RED }],
  // the Red Order's greaves, in the vestry chest
  'scourgehouse.hall': [{ at: [6, 22], kind: 'chest', name: L('The vestry chest', '法衣柜') }],
}
