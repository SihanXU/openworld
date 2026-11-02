// Chapter 2's first half (docs/chapter-2.md §6; docs/main-quest.md): the burned farm on the road, the arrival in
// Emberfall, the elder's council, the village's send-off, the lair's mouth and the dragon's fall, which opens the way
// down off the pass into the Scarred March (quest/chapter2.ts).

import type { StepDef } from '@openworld/engine'
import { L } from '../kit.ts'

const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })

export const QUEST_SCENES: StepDef[] = [
  {
    // Chapter 2: the dragon's mark on the road.
    id: 'burned_farm',
    when: { map: 'eastroad', region: 'farmstead' },
    script: [
      say('player', '(Everything here has burned: the hay, the orchard, the hen house. Only the house is still standing.)', '（这里的东西全烧光了：干草、果园、鸡舍。只有那座房子还立着。）'),
      say('player', '(There are marks in the ash, each one longer than an arm. Something with claws made them.)', '（灰烬里有几道印子，每一道都比胳膊还长，是爪子抓出来的。）', 'surprised'),
      { fact: 'mq.farm', value: 1 },
    ],
  },
  {
    // Chapter 2 begins: the road comes into Emberfall.
    id: 'emberfall_arrival',
    when: { map: 'emberfall', region: 'gate' },
    script: [
      say('player', '(Emberfall. Half its roofs are new thatch; the rest are still black.)', '（余烬镇。一半的屋顶铺着新茅草，另一半还是焦黑的。）'),
      say('player', '(Iron is stacked in the yard by the smithy, more than the town could use. A cart stands by the well with nothing in its shafts.)', '（铁匠铺旁的院子里堆着铁，多得镇上根本用不完。井边停着一辆大车，车辕空着。）'),
    ],
  },
  {
    // The elder's council: what burns the hills, and what it will take (played by mq/elder-council).
    id: 'council',
    when: { map: 'emberfall' },
    manual: true,
    script: [
      { face: 'npc.mara', dir: 'down' },
      say('npc.mara', 'You came up the Sunrise Road. Then you saw the farm.', '你是从朝阳大道上来的。那你看见那座农庄了。'),
      say('npc.mara', 'A dragon came down onto Cinder Peak two winters ago, when the nights began to lengthen. It burns what it likes, and it sits over the pass east of here.', '两年前的冬天，夜晚开始变长的时候，一头魔龙落到了烬峰上。它想烧什么就烧什么，就盘在镇东那条山道的上头。'),
      say('npc.mara', 'That pass goes over to the Scarred March. We sold our iron to the Red Host over there. No cart has gone over since the dragon came.', '那条山道翻过去，就是赤痕边境。我们的铁一向卖给那边的赤军。魔龙来了以后，一辆车也没过去过。'),
      say('npc.mara', 'If you are going over, the dragon goes first. Garrick the smith has a pattern for a blade that can cut its hide. He needs iron and coal from the Embervein Mine.', '你要是想翻过去，就得先除掉魔龙。铁匠加里克手上有一张剑的图样，打出来能砍穿龙皮。他缺铁和煤，烬脉旧矿里有。'),
      say('npc.mara', 'And Wren, our herbalist, knows a draught against fire. Bring them what they ask for. And take this bread with you.', '我们的草药师雷恩会熬一种防火的药。他们要什么，你就给他们带去。这些面包你也拿上。'),
      { give: 'item/food/bread' },
      { give: 'item/food/bread' },
      { fact: 'mq.council', value: 1 },
    ],
  },
  {
    // Chapter 5: armed and fireproof, the village sends you up the pass.
    id: 'ready',
    when: { map: 'emberfall', facts: { 'mq.blade': 1, 'mq.draught': 1 } },
    script: [
      say('player', '(Dragonsbane at my side, the draughts in my pack. The pass east of the village climbs to Cinder Peak.)', '（屠龙剑在身侧，药剂在行囊里。镇东的山道一直通到烬峰。）'),
    ],
  },
  {
    // Chapter 6: the lair's mouth; the dragon wakes.
    id: 'lair_gate',
    when: { map: 'lair', region: 'mouth' },
    script: [
      say('player', '(Heat, and the smell of scorched stone. Something vast breathes in the dark.)', '（一股热浪，还有烧焦石头的气味。有个庞然大物在黑暗里呼吸。）', 'surprised'),
    ],
  },
  {
    // The dragon falls (played by mq/dragon-slain): the way down off the pass into the March is open (docs/chapter-2.md §6).
    id: 'victory',
    when: { map: 'lair' },
    manual: true,
    script: [
      { wait: 20 },
      say('player', '(It is over. The fire in the lair is going out.)', '（结束了。巢穴里的火正在熄灭。）'),
      say('pip', "It's over! ...The way down the far side of the pass is open now. That's where the Scarred March is.", '结束了！……山道那一边下去的路，现在通了。赤痕边境就在那儿。', 'happy'),
      { topic: 'dragon_slain', days: 60 },
    ],
  },
]
