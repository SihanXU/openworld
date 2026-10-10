// The main quest's scenes (docs/main-quest.md): the burned farm on the road, the arrival in
// Emberfall, the elder's council, the village's send-off, the lair's mouth and the victory.

import type { StepDef } from '@lsw/engine'
import { L } from '../kit.ts'

const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })

export const QUEST_SCENES: StepDef[] = [
  {
    // Chapter 2: the dragon's mark on the road.
    id: 'burned_farm',
    when: { map: 'eastroad', region: 'farmstead' },
    script: [
      say('player', '(Everything here burned — the hay, the orchard, the hen house. The house alone still stands.)', '（这里的一切都烧光了——干草、果园、鸡舍。只剩那座房子还立着。）'),
      say('player', '(Marks in the ash, each longer than my arm. Claws.)', '（灰烬里有印子，每一道都比我的胳膊还长。是爪痕。）', 'surprised'),
      { fact: 'mq.farm', value: 1 },
    ],
  },
  {
    // Chapter 3 begins: the road comes into Emberfall.
    id: 'emberfall_arrival',
    when: { map: 'emberfall', region: 'gate' },
    script: [
      say('player', '(Emberfall. Half its roofs are new thatch; the rest are still black.)', '（余烬镇。一半的屋顶是新铺的茅草，另一半还是黑的。）'),
    ],
  },
  {
    // The elder's council: what burns the hills, and what it will take (played by mq/elder-council).
    id: 'council',
    when: { map: 'emberfall' },
    manual: true,
    script: [
      { face: 'npc.mara', dir: 'down' },
      say('npc.mara', 'You came up the east road. Then you saw the farm.', '你是从东大路上来的。那你看见那座农庄了。'),
      say('npc.mara', 'A dragon nests on Cinder Peak, up the pass east of here. Every spring it comes down. This spring it came down twice.', '烬峰上住着一头魔龙，就在镇东的山道上面。每年春天它都下山一回。今年春天，它下来了两回。'),
      say('npc.mara', 'Garrick the smith has a pattern for a blade that can cut its hide. He needs iron and coal from the old mine.', '铁匠加里克有一把能砍穿龙皮的剑的图样。他缺铁和煤，旧矿坑里有。'),
      say('npc.mara', 'And Wren, our herbalist, knows a draught against fire. Bring them what they ask — and take this bread. Nobody fights hungry.', '我们的草药师雷恩会熬一种防火的药。把他们要的东西带去——再拿上这些面包。饿着肚子可打不了仗。'),
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
    // The end (played by mq/dragon-slain).
    id: 'victory',
    when: { map: 'lair' },
    manual: true,
    script: [
      { wait: 20 },
      say('player', '(It is over. The fire in the lair is going out.)', '（结束了。巢穴里的火正在熄灭。）'),
      { topic: 'dragon_slain', days: 60 },
      {
        card: L(
          'THE DRAGON OF CINDER PEAK\n\nThe dragon is dead.\nEmberfall will sleep tonight, and the road east is open.\n\nEverything the world learned from you is in the Threadbook (J).',
          '烬峰魔龙\n\n魔龙死了。\n今夜余烬镇可以安睡，东边的路也通了。\n\n世界从你身上学到的一切，都记在织线簿里（J）。',
        ),
      },
    ],
  },
]
