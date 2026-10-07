// Firstlight Village's quests (docs/quests.md, engine/src/quests.ts): one main quest before the
// bridge chapter — bring the storm-lost foragers back from the Old Barrow — and the villagers'
// own errands: three side quests and one that comes round every day.

import type { QuestDef, Text } from '@lsw/engine'

const L = (en: string, zh: string): Text => ({ en, zh })

export const VILLAGE_QUESTS: QuestDef[] = [
  // ------------------------------------------------------------------ main
  {
    id: 'rescue',
    kind: 'main',
    title: L('Lost in the Barrow', '古墓里的失踪者'),
    summary: L('Lina and Oskar sheltered from the storm in the Old Barrow, south past the grassland, the forest and Thornwood Hollow, and the dead shut them in. The barrow goes down three floors. Find them both, put down the warden in the deepest, and come back to Rowan.', '莉娜和奥斯卡为了躲风暴进了古墓（往南过了草原、森林和荆棘谷），被亡灵困在里面。古墓往下有三层。找到他们两个，打倒最深处的守墓者，再回来找罗万。'),
    giver: 'npc.rowan',
    // the main line carries on from the welcome with no word needed; once the knight has fallen it is behind you
    auto: true,
    requires: { facts: { 'seen.village_arrival': { ne: 0 } } },
    skipWhen: { 'sins.defeated.alberic': { ne: 0 } },
    offer: L('You came down the mountain? Then you can fight. Two of ours, Lina and Oskar, went into the old barrow past the hollow when the storm broke. The dead keep it. Bring them home.', '你是从山上下来的？那你能打。我们有两个人——莉娜和奥斯卡——风暴来时躲进了荆棘谷那头的古墓。那里有亡灵把守。把他们带回家吧。'),
    waiting: L('South, past the grassland and the forest, through the hollow. The barrow mouth is between two standing stones.', '往南，过了草原和森林，穿过荆棘谷。古墓入口在两块立石中间。'),
    done: L('Both home, and the warden down. Firstlight owes you. Tonight, after dark, the whole village gives thanks at the flame — stay for it.', '两个人都回来了，守卫也倒了。初原村欠你一份情。今晚天黑以后，全村会在圣火前感恩——留下来吧。'),
    goals: [
      { id: 'mouth', kind: 'fact', fact: 'seen.barrow_mouth', count: 1, label: L('Through the grassland and the forest to the barrow mouth in Thornwood Hollow', '穿过草原和森林，到荆棘谷的古墓入口') },
      { id: 'lina', kind: 'talk', npc: 'npc.lina', line: L('You came! The way out is clear? Then I am going home — tell Rowan I am all right.', '你来了！出去的路通了？那我回家了——跟罗万说我没事。'), label: L('Find Lina', '找到莉娜') },
      { id: 'oskar', kind: 'talk', npc: 'npc.oskar', line: L('About time. I will follow the girl home. The warden is below — the bottom of the stair. Mind it.', '可算来了。我跟着那丫头回家。守墓者在下面——楼梯最底下。小心它。'), label: L('Find Oskar in the ossuary, the second floor', '在第二层骸骨堂找到奥斯卡') },
      { id: 'warden', kind: 'defeat', type: 'actor/creature/undead/warden', count: 1, label: L('Put down the warden in the sanctum, the deepest floor', '在最深处的圣所打倒守墓者') },
    ],
    // the foragers go home once found (their schedules follow these facts); that night, the flame (docs/chapter-1.md)
    reward: { xp: 60, items: [{ type: 'item/food/bread', count: 2 }, { type: 'item/armor/breastplate', count: 1, name: L("Rowan's Old Hauberk", '罗万的旧锁甲'), tags: ['quality:fine'], props: { slot: 'body', def: 4 } }], facts: { 'rescue.lina': 1, 'rescue.oskar': 1, 'village.rescued': 1 }, props: { quest: 0.5 } },
  },
  // ------------------------------------------------------------------ side
  {
    id: 'stew',
    kind: 'side',
    title: L('Something for the Pot', '给锅里添点东西'),
    summary: L('Marta needs 3 raw beef and 2 eggs for the village stew. The cows and hens graze the grassland south of the village.', '玛尔塔需要 3 块生牛肉和 2 个鸡蛋来炖全村的菜。牛和鸡在村子南边的草原上。'),
    giver: 'npc.marta',
    offer: L('Three cuts of beef and two eggs, and the whole village eats tonight. The herd is on the grassland, south.', '三块牛肉、两个鸡蛋，今晚全村就都有饭吃了。牛群在南边的草原上。'),
    waiting: L('Three beef, two eggs. The pot is waiting.', '三块牛肉，两个鸡蛋。锅还等着呢。'),
    done: L('Now that is a stew. Here — the first bowl is yours, and take some bread for the road.', '这才叫炖菜。来——第一碗给你，再带上点面包路上吃。'),
    goals: [
      { id: 'beef', kind: 'carry', type: 'item/food/meat/raw', count: 3, consume: true, label: L('Raw beef', '生牛肉') },
      { id: 'eggs', kind: 'carry', type: 'item/food/egg/raw', count: 2, consume: true, label: L('Eggs', '鸡蛋') },
    ],
    reward: { xp: 25, items: [{ type: 'item/food/bread', count: 3 }, { type: 'item/clothing/belt', count: 1, name: L("Marta's Kitchen Sash", '玛尔塔的围腰'), tags: ['quality:fine'], props: { slot: 'waist', def: 1 } }] },
  },
  {
    id: 'ring',
    kind: 'side',
    title: L("Mia's Ring", '米娅的戒指'),
    summary: L("Mia lost her grandmother's silver ring in the thorns of Thornwood Hollow. Find it and bring it back to her.", '米娅把奶奶的银戒指丢在了荆棘谷的荆棘丛里。找到它，带回来给她。'),
    giver: 'npc.mia',
    offer: L("Promise you won't tell Mum? I went to the hollow — just to look — and Gran's ring fell in the thorns on the east side. Could you find it?", '你保证不告诉妈妈？我去了荆棘谷——就看了一眼——奶奶的戒指掉进东边的荆棘丛里了。你能帮我找回来吗？'),
    waiting: L('East side of the hollow, where the thorns are thickest. It is silver.', '荆棘谷东边，荆棘最密的地方。是银的。'),
    done: L("You found it! Gran's ring! Here, this is my best stone. It's lucky. Mostly.", '你找到了！奶奶的戒指！给，这是我最好的石头，会带来好运的。大概吧。'),
    goals: [{ id: 'ring', kind: 'carry', type: 'item/valuable/ring', count: 1, consume: true, label: L("Mia's ring", '米娅的戒指') }],
    reward: { xp: 30, items: [{ type: 'item/material/stone', count: 1 }, { type: 'item/valuable/earring', count: 1, name: L("Mia's Ribbon Earring", '米娅的缎带耳环'), tags: ['quality:fine'], props: { slot: 'ear', xpRate: 0.1 } }] },
  },
  {
    id: 'thorns',
    kind: 'side',
    title: L('Clear the Hollow', '清剿荆棘谷'),
    summary: L('Holt wants the trail through Thornwood Hollow safe: fell 6 creatures there.', '霍尔特想让穿过荆棘谷的小路安全些：在那里打倒 6 只怪物。'),
    giver: 'npc.holt',
    requires: { level: 2 },
    offer: L('The things in the hollow are getting bold — they come up as far as the grassland now. Thin them out. Six should teach them.', '荆棘谷里的东西越来越大胆了——现在都跑到草原上来了。去清一清。打掉六只，应该能让它们长点记性。'),
    waiting: L('Six. Slimes, spiders, wolves, whatever moves in the hollow.', '六只。史莱姆、蜘蛛、狼，荆棘谷里会动的都算。'),
    done: L('Quieter already. Take this — a guard with a spare arm is a guard who listens.', '已经安静多了。拿着这个——有备用武器的卫兵才听得进话。'),
    goals: [{ id: 'kills', kind: 'defeat', type: 'actor/creature', map: 'hollow', count: 6, label: L('Creatures felled in the hollow', '在荆棘谷打倒的怪物') }],
    reward: { xp: 40, items: [{ type: 'item/weapon/polearm/spear', count: 1 }, { type: 'item/armor/pauldrons', count: 1, name: L("Militia Pauldrons", '民兵护肩'), tags: ['quality:fine'], props: { slot: 'shoulders', def: 2 } }] },
  },
  // ------------------------------------------------------------------ repeat (daily)
  {
    id: 'firewood',
    kind: 'repeat',
    title: L('Wood for the Fire', '给火堆添柴'),
    summary: L('Gus needs 4 logs a day for the village fire. Fell a tree with an axe (two swings). Comes round again each day.', '格斯每天需要 4 根木头给村里的火堆。用斧头砍树（砍两下）。每天都能再接。'),
    giver: 'npc.gus',
    offer: L('Four logs, and my back thanks you. The fire wants them every day, mind.', '四根木头，我的腰会感谢你的。不过这火天天都要喂。'),
    waiting: L('Four logs. Any tree will do.', '四根木头，哪棵树都行。'),
    done: L('That will see us through the night. Same again tomorrow?', '这够撑过今晚了。明天还来吗？'),
    goals: [{ id: 'logs', kind: 'carry', type: 'item/material/log', count: 4, consume: true, label: L('Logs', '木头') }],
    reward: { xp: 15, items: [{ type: 'item/food/bread', count: 1 }] },
  },
]
