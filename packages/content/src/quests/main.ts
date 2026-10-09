// The main line (docs/quests.md §3, docs/prologue.md, docs/chapter-1.md, docs/main-quest.md): from waking in the
// clearing to the dragon of Cinder Peak, as quests that begin by themselves as the last ends. Each stage waits on
// a state of the world — a step of the story played, a fact the story keeps, a place reached — never on a path:
// the scenes and rules change the facts, and the quests answer.

import type { QuestDef, QuestStage, QuestTrigger, Text } from '@lsw/engine'
import { L, gear } from './kit.ts'
import { TUTORIAL_LESSONS, TUTORIAL_DONE } from '../prologue.ts'
import { ALBERIC_ID, CH1 } from '../chapter1.ts'
import { ASKS, BLADE, DRAGON } from '../quest.ts'

/** The White Knight is down: what comes before him is behind you. */
export const PAST_KNIGHT: QuestTrigger = { fact: { [CH1.knight]: { ne: 0 } } }

// ------------------------------------------------------------------ the clearing (the tutorial)

const TUTORIAL: [string, Text, Text][] = [
  ['eat', L('Find something to eat', '找点吃的'), L('WASD moves you. F picks up what you point at; hold it (1–0) and right click to eat it.', 'WASD 移动。F 捡起鼠标指着的东西；用 1–0 拿在手上，右键吃掉。')],
  ['gather', L('Gather sticks, stones and grass', '收集树枝、石头和草'), L('They lie about the clearing, and more turn up. F picks them up; I opens the bag.', '空地上到处都有，而且会不断长出来。F 捡起来；I 打开背包。')],
  ['axe', L('Make a stone axe', '做一把石斧'), L('C opens crafting: a stick, a stone and a tuft of grass.', 'C 打开制作：一根树枝、一块石头、一把草。')],
  ['planks', L('Fell a tree and split planks', '砍树，劈出木板'), L('Hold the axe and left click a tree: it falls into logs. Left click a log with the axe: planks.', '拿着斧头左键点树，树倒下变成原木；再用斧头左键点原木，劈成木板。')],
  ['fire', L('Build a campfire and light it', '搭一堆营火并点燃'), L('B opens building: a ring of stones and sticks is a campfire. C makes a torch (a stick and grass); left click the fire with it.', 'B 打开建造：石头和树枝围成营火。C 做一支火把（树枝加草），拿着它左键点营火。')],
  ['house', L('Build a house with a bed', '盖一间有床的屋子'), L('C makes walls, a door, a floor and a bed from planks. Take one in hand and left click where it goes (hold and drag for a row; G sets it down too): walls and a door round you, the bed inside. The floor over your head is the ceiling, drawn a tile higher: a floor in hand, R, then left click just above your head (or in the build palette, B, R turns a floor into a ceiling).', 'C 用木板做墙、门、地板和床。拿在手上，左键点哪儿就放在哪儿（按住拖动放一排；G 也能放）：墙和门围住自己，床放在屋里。头顶那块是天花板，画在高一格的地方：手里拿着地板按 R，再左键点头顶上方一格（或在建造模式 B 里按 R 把地板切换成天花板）。')],
  ['night', L('Get through the night', '熬过这一夜'), L('Things walk in the dark. Sleep in your bed (E) — not on an empty stomach, or hunger wakes you in the night. At first light we go.', '天黑以后会有东西出来游荡。在床上睡一觉（E）——别空着肚子睡，不然会半夜饿醒。天一亮我们就出发。')],
  ['path', L('Take the path south', '沿小路往南走'), L('The path out of the clearing runs south, down to the foot of the mountain.', '空地南边的小路通往山脚。')],
]
/** The beats each stage of the clearing waits for (prologue.ts), in order. */
const TUTORIAL_BEATS = ['tut_wake', 'tut_ate', 'tut_gathered', 'tut_axe', 'tut_planks', 'tut_fire', 'tut_house', 'tut_morning']

/** The clearing's stage for an old prologue stage (1 … 8): 10 … 80. */
export const AWAKENING = (n: number) => n * 10

const awakening: QuestDef = {
  id: 'awakening',
  kind: 'main',
  title: L('Waking', '醒来'),
  summary: L('You came round in a clearing in the woods, with a fairy called Pip at your side. Get through a day and a night here, then take the path south off the mountain.', '你在林间的一片空地上醒来，身边有一个叫小啾的精灵。在这里熬过一天一夜，然后沿着小路往南下山。'),
  aliases: { pip: { id: 'pip' } },
  objectives: TUTORIAL.map(([id, text]) => ({ id, text })),
  stages: [
    { n: 5, log: L('I came round in a clearing. I do not remember how I got here.', '我在一片空地上醒来。不记得自己是怎么到这儿的。') },
    ...TUTORIAL.map(([id, , hint], i): QuestStage => ({
      n: AWAKENING(i + 1),
      on: { step: TUTORIAL_BEATS[i] },
      ...(i > 0 && { done: [TUTORIAL[i - 1][0]] }),
      show: [id],
      hint,
      log: [
        L('A fairy, Pip, woke me. First: something to eat.', '一个叫小啾的精灵叫醒了我。先找点吃的。'),
        L('Fed. To make anything I need sticks, stones and grass.', '吃饱了。要做东西，得先有树枝、石头和草。'),
        L("An axe's worth gathered.", '凑齐了做一把斧头的材料。'),
        L('A stone axe. Now wood.', '有了石斧。该去砍木头了。'),
        L('Planks. Night comes early in the woods: a fire first.', '有了木板。林子里天黑得早：先生火。'),
        L('A fire. Now a roof over my head.', '有了火。现在要一个能遮头的屋顶。'),
        L('A house of my own. Now to get through the night.', '有了自己的屋子。现在只要熬过今晚。'),
        L('Morning. The path south is open.', '天亮了。南边的小路通了。'),
      ][i],
      lessons: TUTORIAL_LESSONS[i + 1] ?? [],
    })),
    { n: 100, on: { step: 'tut_out' }, done: ['path'], complete: true, reward: { xp: 10 }, log: L('Down at the foot of the mountain.', '到了山脚。') },
  ],
  start: { auto: { enter: 'tutorial' } },
}
void TUTORIAL_DONE

// ------------------------------------------------------------------ down from the mountain

const descent: QuestDef = {
  id: 'descent',
  kind: 'main',
  title: L('Down from the Mountain', '下山'),
  summary: L('You woke on the mountain with a fairy at your side. Go down: past the old shrine stone at the Mountain Foot, down the cliff stair to the Ford, and west to the village there.', '你在山上醒来，身边多了一个精灵。下山吧：经过山脚的古老路碑，顺着悬崖台阶下到渡口，再往西去那里的村子。'),
  aliases: { stone: { place: 'foot:relic' }, ford: { place: 'ford' }, village: { place: 'meadow' } },
  objectives: [
    { id: 'stone', text: L('The shrine stone at the Mountain Foot', '山脚的路碑'), target: 'stone' },
    { id: 'try', text: L('Try something the world has never seen', '做一件世界从没见过的事') },
    { id: 'ford', text: L('Down the cliff stair to the Ford', '顺着悬崖台阶下到渡口'), target: 'ford' },
    { id: 'village', text: L('West to Firstlight Village', '往西到初原村'), target: 'village' },
  ],
  stages: [
    { n: 10, show: ['stone', 'try'], hint: L('The only way down is the cut in the rocks to the south; below it lies the Mountain Foot, and an old seal stone to try anything on — use what you hold on it, put something on it, strike it. The world learns.', '下山只有南边岩壁上的那道豁口；下面是山脚，那里有一块古老的封印石，对它做点什么都行——用手里的东西、放点东西上去、打它一下。世界会学习。'), log: L('Pip says the way down is south, to the foot of the mountain.', '小啾说下山的路在南边，通往山脚。') },
    { n: 20, on: { step: 'relic' }, done: ['stone'], hint: L('Use what you hold on the old seal stone, put something on it, strike it — anything. The world learns.', '拿着东西对古老的封印石用一用、放点东西上去、打它一下——什么都行。世界会学习。'), log: L('An old stone with five marks, the first one cracked. Pip does not like it.', '一块有五道痕的古老石头，第一道裂开了。小啾不喜欢它。') },
    { n: 30, on: { step: 'tried' }, done: ['try'], show: ['ford'], hint: L('The trail runs south off the mountain. J: the Threadbook keeps what the world has learned.', '小路往南下山。J：织线簿记着世界学会的事。'), log: L('The world answered something it had never seen. It keeps what it learns in the Threadbook.', '世界回应了它从没见过的事。它学会的都记在织线簿里。') },
    { n: 40, on: { step: 'ford' }, done: ['stone', 'try', 'ford'], show: ['village'], hint: L('Firstlight Village is west of the Ford. Rowan, its elder, is looking for anyone who can fight: a yellow "!" over a head means someone has a task for you (E).', '初原村在渡口西边。村里的长老罗万在找能打的人：头顶有黄色"！"的人有任务给你（按 E）。'), log: L('The Ford. The ferry rope is gone and the bridge is broken; the village west of here needs a hand.', '渡口到了。渡绳断了，桥也坏了；西边的村子需要人帮忙。') },
    { n: 100, on: { step: 'village_arrival' }, done: ['stone', 'try', 'ford', 'village'], complete: true, reward: { xp: 15, items: [gear('item/clothing/boots', 'feet', "Traveller's Boots", '旅人的靴子', 'common', { def: 1 })] }, log: L('Firstlight Village, and its flame.', '初原村，和它的圣火。') },
  ],
  start: { auto: { any: [{ done: 'awakening' }, { enter: 'summit' }, { enter: 'foot' }] } },
}

// ------------------------------------------------------------------ Firstlight: the barrow, the vigil

const rescue: QuestDef = {
  id: 'rescue',
  kind: 'main',
  title: L('Lost in the Barrow', '古墓里的失踪者'),
  summary: L('Lina and Oskar sheltered from the storm in the Old Barrow, south past the grassland, the forest and Thornwood Hollow, and the dead shut them in. The barrow goes down three floors. Find them both, put down the warden in the deepest, and come back to Rowan.', '莉娜和奥斯卡为了躲风暴进了古墓（往南过了草原、森林和荆棘谷），被亡灵困在里面。古墓往下有三层。找到他们两个，打倒最深处的守墓者，再回来找罗万。'),
  aliases: {
    giver: { id: 'npc.rowan', essential: true },
    lina: { id: 'npc.lina', essential: true },
    oskar: { id: 'npc.oskar', essential: true },
    warden: { find: { type: 'actor/creature/undead/warden' }, optional: true },
    mouth: { place: 'hollow:mouth' },
  },
  objectives: [
    { id: 'mouth', text: L('Through the grassland and the forest to the barrow mouth in Thornwood Hollow', '穿过草原和森林，到荆棘谷的古墓入口'), target: 'mouth', on: { step: 'barrow_mouth' } },
    { id: 'lina', text: L('Find Lina', '找到莉娜'), target: 'lina', talk: true, on: { talk: 'lina' }, say: L('You came! The way out is clear? Then I am going home — tell Rowan I am all right.', '你来了！出去的路通了？那我回家了——跟罗万说我没事。') },
    { id: 'oskar', text: L('Find Oskar in the ossuary, the second floor', '在第二层骸骨堂找到奥斯卡'), target: 'oskar', talk: true, on: { talk: 'oskar' }, say: L('About time. I will follow the girl home. The warden keeps the bottom of the stair — if it still walks, mind it.', '可算来了。我跟着那丫头回家。守墓者在下面——楼梯最底下。它要是还在，你小心点。') },
    { id: 'warden', text: L('Put down the warden in the sanctum, the deepest floor', '在最深处的圣所打倒守墓者'), target: 'warden', count: { kill: { type: 'actor/creature/undead/warden' } }, need: 1 },
    { id: 'back', text: L('Back to Rowan', '回去找罗万'), target: 'giver', talk: true },
  ],
  stages: [
    { n: 10, show: ['mouth', 'lina', 'oskar', 'warden'], hint: L('South, past the grassland and the forest, through the hollow. The barrow mouth is between two standing stones.', '往南，过了草原和森林，穿过荆棘谷。古墓入口在两块立石中间。'), log: L('Rowan: two of the village, Lina and Oskar, went into the Old Barrow when the storm broke. The dead keep it.', '罗万说：村里的莉娜和奥斯卡在风暴来时进了古墓。那里有亡灵把守。') },
    { n: 20, on: { objectives: ['lina', 'oskar', 'warden'] }, done: ['mouth'], show: ['back'], log: L('Both found, and the warden down. Back to Rowan.', '两个人都找到了，守墓者也倒了。回去找罗万。') },
    { n: 100, on: { talk: 'giver' }, from: [20], done: ['back'], complete: true, say: L('Both home, and the warden down. Firstlight owes you. Tonight, after dark, the whole village gives thanks at the flame — stay for it.', '两个人都回来了，守卫也倒了。初原村欠你一份情。今晚天黑以后，全村会在圣火前感恩——留下来吧。'), reward: { xp: 60, items: [{ type: 'item/food/bread', count: 2 }, gear('item/armor/breastplate', 'body', "Rowan's Old Hauberk", '罗万的旧锁甲', 'fine', { def: 4 })], facts: { 'rescue.lina': 1, 'rescue.oskar': 1, 'village.rescued': 1 } }, log: L('Lina and Oskar are home. The village gives thanks tonight.', '莉娜和奥斯卡回家了。今晚全村要感恩。') },
    { n: 105, on: { all: [PAST_KNIGHT, { objectives: ['lina', 'oskar', 'warden'] }] }, complete: true, reward: { xp: 60, items: [{ type: 'item/food/bread', count: 2 }, gear('item/armor/breastplate', 'body', "Rowan's Old Hauberk", '罗万的旧锁甲', 'fine', { def: 4 })], facts: { 'rescue.lina': 1, 'rescue.oskar': 1, 'village.rescued': 1 } }, log: L('All of it done as the road went on.', '路走下去，这件事也一起办完了。') },
    { n: 110, on: PAST_KNIGHT, complete: true, reward: { facts: { 'rescue.lina': 1, 'rescue.oskar': 1, 'village.rescued': 1 } }, log: L('The road went past it: the foragers found their own way home.', '路已经走过了这里：两个采集者自己找回了家。') },
  ],
  start: { auto: { step: 'village_arrival' } },
  waiting: L('South, past the grassland and the forest, through the hollow. The barrow mouth is between two standing stones.', '往南，过了草原和森林，穿过荆棘谷。古墓入口在两块立石中间。'),
}

const vigil: QuestDef = {
  id: 'vigil',
  kind: 'main',
  title: L('The Vigil', '守夜之备'),
  summary: L('Firstlight keeps a vigil at its flame for those who come home. Sister Ilse needs lamp oil from the cellar at Millbrook, west of the village; dawnbloom from Dawn Hill, north of it; and the old bell rung in the Chapel of the First Dawn on the hill\'s top. Beyond the vigil, the road east and the White Knight wait.', '初原村会为归来的人在圣火前守夜。伊尔丝修女需要：村子西边水车磨坊地窖里的灯油；村子北边晨光丘上的晨光花；还有在丘顶初晓礼拜堂里敲响那口旧钟。守夜之后，东边的大路和白骑士在等着你。'),
  aliases: { giver: { id: 'npc.ilse', essential: true }, mill: { place: 'millcellar' }, hill: { place: 'dawnhill' }, belfry: { place: 'chapel:belfry' } },
  objectives: [
    { id: 'oil', text: L('Vigil oil from the mill cellar (Millbrook, west)', '磨坊地窖里的守夜灯油（往西，水车磨坊）'), target: 'mill', count: { carry: { type: 'item/vessel/flask/oil' } }, need: 2 },
    { id: 'bloom', text: L('Dawnbloom from Dawn Hill (north)', '晨光丘上的晨光花（往北）'), target: 'hill', count: { carry: { type: 'item/material/herb' } }, need: 3 },
    { id: 'bell', text: L('Ring the bell in the Chapel of the First Dawn', '在初晓礼拜堂敲响那口钟'), target: 'belfry', on: { step: 'chapel_bell' } },
    { id: 'back', text: L('Back to Sister Ilse', '回去找伊尔丝修女'), target: 'giver', talk: true },
  ],
  stages: [
    { n: 10, show: ['oil', 'bloom', 'bell'], hint: L('Oil from Millbrook (west), dawnbloom and the chapel bell on Dawn Hill (north); then be in the village after dark.', '西边水车磨坊的油，北边晨光丘的晨光花和礼拜堂的钟；然后入夜时待在村里。'), log: L('Lina and Oskar are home. Sister Ilse asks for the vigil: oil, dawnbloom, and the old bell rung.', '莉娜和奥斯卡回家了。伊尔丝修女要为守夜做准备：灯油、晨光花，还有敲响那口旧钟。') },
    { n: 20, on: { objectives: ['oil', 'bloom', 'bell'] }, show: ['back'], log: L('Oil, dawnbloom, the bell. Back to Sister Ilse.', '灯油、晨光花、钟声都有了。回去找伊尔丝修女。') },
    { n: 100, on: { all: [{ talk: 'giver' }, { objectives: ['oil', 'bloom', 'bell'] }] }, done: ['back'], take: [{ match: { type: 'item/vessel/flask/oil' }, count: 2 }, { match: { type: 'item/material/herb' }, count: 3 }], complete: true, say: L('The lamps are trimmed and the bell has rung. Tonight, after dark, Firstlight gives thanks. Stay for it.', '灯已经备好，钟也敲响了。今晚天黑以后，初原村要感恩。留下来吧。'), reward: { xp: 50, items: [gear('item/clothing/cloak', 'shoulders', 'Cloak of the Dawn Vigil', '晨光守夜斗篷', 'masterwork', { def: 2, 'night:def': 1 })], facts: { 'ch1.vigil': 1 } }, log: L('The vigil is ready. Tonight the village gives thanks at the flame.', '守夜准备好了。今晚全村在圣火前感恩。') },
    { n: 105, on: { all: [PAST_KNIGHT, { objectives: ['oil', 'bloom', 'bell'] }] }, take: [{ match: { type: 'item/vessel/flask/oil' }, count: 2 }, { match: { type: 'item/material/herb' }, count: 3 }], complete: true, reward: { xp: 50, items: [gear('item/clothing/cloak', 'shoulders', 'Cloak of the Dawn Vigil', '晨光守夜斗篷', 'masterwork', { def: 2, 'night:def': 1 })], facts: { 'ch1.vigil': 1 } }, log: L('The road went past the vigil, but all of it was brought: Sister Ilse took the oil and the dawnbloom all the same.', '路已经走过了守夜，但该备的都备齐了：伊尔丝修女还是收下了灯油和晨光花。') },
    { n: 110, on: PAST_KNIGHT, complete: true, reward: { facts: { 'ch1.vigil': 1 } }, log: L('The road went past it.', '路已经走过了这里。') },
  ],
  start: { auto: { done: 'rescue' } },
  waiting: L('Oil from Tam\'s cellar, dawnbloom from the hill, and the bell. The bell was rung the morning the sun came back. It should be rung for this.', '塔姆地窖里的油，丘上的晨光花，还有那口钟。太阳回来的那天早上，有人敲响过它。今晚也该敲响它。'),
}

// ------------------------------------------------------------------ the First Seal

const firstSeal: QuestDef = {
  id: 'first_seal',
  kind: 'main',
  title: L('The First Seal', '第一印'),
  summary: L('The days grow shorter. Beyond the Ford, on the road east, the White Knight Alberic — the First Seal-bearer — holds the land as his kingdom, and nothing crosses that does not kneel. Firstlight gives thanks tonight; then the road, the river, and the knight.', '白昼越来越短。渡口那边的东大路上，第一位持印者——白骑士阿尔贝里克——把那片土地当成了他的王国，不跪者不得过。今晚初原村要感恩；然后是大路、河流，和那位骑士。'),
  aliases: { giver: { id: 'npc.ilse', essential: true }, village: { place: 'meadow' }, bank: { place: 'ford:far_bank' }, knight: { id: ALBERIC_ID, optional: true } },
  objectives: [
    { id: 'thanks', text: L('The night of thanks at the flame (Firstlight, after dark)', '圣火前的感恩之夜（入夜后在初原村）'), target: 'village', on: { fact: { [CH1.flameStolen]: 1 } } },
    { id: 'letter', text: L("The Church's letter (Firstlight, the morning after)", '教会的来信（第二天早上，初原村）'), target: 'village', on: { fact: { [CH1.letter]: 1 } } },
    { id: 'ilse', text: L('Ask Sister Ilse where the pilgrimage begins', '问伊尔丝修女朝圣从哪里开始'), target: 'giver', talk: true, optional: true, on: { any: [{ quest: { pilgrim: { gte: 10 } } }, { fact: { 'ford.crossed': 1 } }] } },
    { id: 'river', text: L('Across the river at the Ford', '在渡口过河'), target: 'bank', on: { fact: { 'ford.crossed': 1 } } },
    { id: 'knight', text: L('Bring down the White Knight Alberic on the East Road', '在东大路打倒白骑士阿尔贝里克'), target: 'knight', on: PAST_KNIGHT },
  ],
  stages: [
    { n: 10, show: ['thanks'], hint: L('Lina and Oskar are home. Be in the village after dark: Firstlight gives thanks at the flame.', '莉娜和奥斯卡回家了。入夜时待在村里：初原村要在圣火前感恩。'), log: L('Tonight Firstlight gives thanks at the flame.', '今晚初原村要在圣火前感恩。') },
    { n: 20, on: { fact: { [CH1.flameStolen]: 1 } }, done: ['thanks'], show: ['letter'], hint: L('The Firstlight is gone. Wait for morning in the village: something is coming up the road.', '初火不见了。在村里等到天亮：有人正沿着大路赶来。'), log: L('A man in grey took the Firstlight in the night and walked east over the river on ice he made as he went.', '夜里一个灰衣人拿走了初火，边走边在河上结冰，往东过了河。') },
    { n: 30, on: { fact: { [CH1.letter]: 1 } }, done: ['letter'], show: ['ilse', 'river'], hint: L('The White Knight tore three planks out of the footbridge by the marsh. An axe fells a tree (two swings) and splits a log into planks; G lays a plank on the water. Any other way across counts too: E handles things, F takes, G puts or hands over, left click uses what you hold, right click uses it on yourself.', '白骑士拆走了沼泽边小桥上的三块木板。斧头能砍倒树（砍两下），也能把木头劈成木板；G 把木板铺到水上。别的过河办法也算：E 空手摆弄，F 拿取，G 放下或交出，左键用手里的东西，右键对自己用。'), log: L('The Holy City has called the pilgrimage, and named me pilgrim. The road begins across the river.', '圣城发布了朝圣令，封我为朝圣者。路从河对岸开始。') },
    { n: 40, on: { fact: { 'ford.crossed': 1 } }, from: [30], done: ['river'], show: ['knight'], hint: L('Follow the road east past the burned farm. The First Seal-bearer, the White Knight Alberic, holds it as his kingdom. Watch where his blows will land, and be elsewhere.', '沿着大路往东走，经过烧毁的农庄。第一位持印者——白骑士阿尔贝里克——把那条路当成了他的王国。看清他的攻击会落在哪里，然后躲开。'), log: L('Across the river. The road east runs past a burned farm into the knight\'s kingdom.', '过了河。往东的大路经过一座烧毁的农庄，通进骑士的王国。') },
    { n: 100, on: PAST_KNIGHT, done: ['thanks', 'letter', 'river', 'knight'], complete: true, reward: { xp: 60 }, log: L('The White Knight knelt and gave up the Crown of Thorns.', '白骑士跪下，交出了荆棘冠。') },
  ],
  start: { auto: { done: 'vigil' } },
}

const crownHome: QuestDef = {
  id: 'crown_home',
  kind: 'main',
  title: L('The Crown of Thorns', '荆棘冠'),
  summary: L('The First Seal has fallen and the Crown of Thorns is yours. Carry it home to Firstlight.', '第一印已经倒下，荆棘冠在你手里。把它带回初原村。'),
  aliases: { village: { place: 'meadow' } },
  objectives: [{ id: 'home', text: L('Bring the Crown home to Firstlight', '把荆棘冠带回初原村'), target: 'village', on: { fact: { [CH1.end]: 1 } } }],
  stages: [
    { n: 10, show: ['home'], hint: L('The First Seal has fallen. Carry the Crown of Thorns back to Firstlight.', '第一印已经倒下。把荆棘冠带回初原村。'), log: L('The Crown is mine to carry. The grey man took the rest of its light east.', '荆棘冠由我带着。灰衣人把它剩下的光带往了东边。') },
    { n: 100, on: { fact: { [CH1.end]: 1 } }, done: ['home'], complete: true, reward: { xp: 30 }, log: L('The Crown is in Firstlight. The sun set four minutes early tonight.', '荆棘冠回到了初原村。今晚太阳早落了四分钟。') },
  ],
  start: { auto: PAST_KNIGHT },
}

// ------------------------------------------------------------------ Emberfall and the dragon (docs/main-quest.md)

const dragonRoad: QuestDef = {
  id: 'dragon_road',
  kind: 'main',
  title: L('The Dragon Road', '屠龙之路'),
  summary: L('The knight\'s kingdom is open. Beyond it the road runs east to Emberfall, where smoke hangs over the hills: something there burns them.', '骑士的王国敞开了。穿过它，大路一直往东通向余烬镇。那里的山上冒着烟：有什么东西在烧山。'),
  aliases: {
    town: { place: 'emberfall' },
    mara: { id: 'npc.mara', essential: true },
    smith: { id: 'npc.garrick', essential: true },
    herbalist: { id: 'npc.wren', essential: true },
    lair: { place: 'lair' },
    dragon: { find: { type: DRAGON }, optional: true },
  },
  objectives: [
    { id: 'road', text: L('East along the road to Emberfall', '沿着大路往东到余烬镇'), target: 'town', on: { step: 'emberfall_arrival' } },
    { id: 'mara', text: L('Find Mara, the elder of Emberfall', '找到余烬镇的长老玛拉'), target: 'mara', talk: true, on: { fact: { 'mq.council': 1 } } },
    { id: 'ore', text: L('Iron ore for Garrick (the old mine, north)', '给加里克的铁矿石（镇北旧矿坑）'), target: 'smith', count: { fact: ASKS.ore.fact }, need: ASKS.ore.need },
    { id: 'coal', text: L('Coal for Garrick', '给加里克的煤'), target: 'smith', count: { fact: ASKS.coal.fact }, need: ASKS.coal.need },
    { id: 'fireweed', text: L('Fireweed for Wren (Firstlight Village)', '给雷恩的火焰草（初原村）'), target: 'herbalist', count: { fact: ASKS.fireweed.fact }, need: ASKS.fireweed.need },
    { id: 'frostcap', text: L('Frostcap for Wren (the forest)', '给雷恩的霜盖菇（森林）'), target: 'herbalist', count: { fact: ASKS.frostcap.fact }, need: ASKS.frostcap.need },
    { id: 'blade', text: L('Dragonsbane, forged by Garrick (E)', '加里克锻造的屠龙剑（E）'), target: 'smith', talk: true, on: { fact: { 'mq.blade': 1 } } },
    { id: 'draught', text: L('The fireproof draught, brewed by Wren (E)', '雷恩熬的防火药剂（E）'), target: 'herbalist', talk: true, on: { fact: { 'mq.draught': 1 } } },
    { id: 'pass', text: L('Up Cinder Pass to the dragon\'s lair', '翻过烬岭山道，去魔龙的巢穴'), target: 'lair', on: { step: 'lair_gate' } },
    { id: 'dragon', text: L('Defeat the dragon of Cinder Peak', '打倒烬峰魔龙'), target: 'dragon', on: { fact: { 'mq.dragon': 1 } } },
  ],
  stages: [
    { n: 10, show: ['road'], hint: L('The knight\'s kingdom is open. Beyond it, the road runs east to Emberfall.', '骑士的王国敞开了。穿过它，大路一直往东通向余烬镇。'), log: L('Chapter 2: the road east to Emberfall.', '第二章：往东通向余烬镇的路。') },
    { n: 20, on: { step: 'emberfall_arrival' }, done: ['road'], show: ['mara'], hint: L('Find Mara, the elder of Emberfall. She will know what burns the hills.', '找到余烬镇的长老玛拉。她会知道是什么在烧山。'), log: L('Emberfall: half its roofs new thatch, the rest still black.', '余烬镇：一半屋顶是新铺的茅草，另一半还是黑的。') },
    { n: 30, on: { fact: { 'mq.council': 1 } }, done: ['mara'], show: ['ore', 'coal', 'fireweed', 'frostcap', 'blade', 'draught'], hint: L('Garrick the smith will forge a blade for 5 iron ore and 3 coal — the old mine north of the village has the veins (a pickaxe breaks them). Wren the herbalist will brew a fireproof draught for 3 fireweed (Firstlight Village) and 3 frostcap (the forest). Hand them what they ask (G), then talk to them (E).', '铁匠加里克要 5 块铁矿石和 3 块煤来锻一把剑——镇北的旧矿坑里有矿脉（用镐敲开）。草药师雷恩要 3 株火焰草（初原村）和 3 朵霜盖菇（森林）来熬防火药剂。把东西交给他们（G），再和他们说话（E）。'), log: L('A dragon nests on Cinder Peak. Garrick can forge a blade to cut its hide, and Wren can brew a draught against its fire.', '烬峰上住着一头魔龙。加里克能锻一把砍得穿龙皮的剑，雷恩能熬一种防火的药。') },
    { n: 40, on: { step: 'ready' }, done: ['ore', 'coal', 'fireweed', 'frostcap', 'blade', 'draught'], show: ['pass'], hint: L('Climb the pass east of Emberfall to the dragon\'s lair. Drink the fireproof draught before you go in.', '翻过余烬镇东边的山道，去魔龙的巢穴。进去之前喝下防火药剂。'), log: L('Dragonsbane at my side, the draughts in my pack. The pass climbs to Cinder Peak.', '屠龙剑在身侧，药剂在行囊里。山道一直通到烬峰。') },
    { n: 50, on: { step: 'lair_gate' }, done: ['pass'], show: ['dragon'], hint: L('Defeat the dragon. Space strikes; keep out of its line of fire, and mind its whelps.', '打倒魔龙。空格键攻击；别站在它喷火的直线上，小心它的幼龙。'), log: L('Heat, and the smell of scorched stone. Something vast breathes in the dark.', '一股热浪，还有烧焦石头的气味。有个庞然大物在黑暗里呼吸。') },
    { n: 100, on: { fact: { 'mq.dragon': 1 } }, done: ['road', 'mara', 'pass', 'dragon'], complete: true, reward: { xp: 100 }, hint: L('The dragon is dead. Emberfall can sleep. What you taught the world is in the Threadbook (J).', '魔龙死了，余烬镇可以安睡了。你教会这个世界的事都记在织线簿里（J）。'), log: L('The dragon is dead, and Emberfall can sleep.', '魔龙死了，余烬镇可以安睡了。') },
  ],
  start: { auto: { done: 'crown_home' } },
}
void BLADE

export const MAIN_QUESTS: QuestDef[] = [awakening, descent, rescue, vigil, firstSeal, crownHome, dragonRoad]
