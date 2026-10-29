// The main line (docs/quests.md §3, docs/prologue.md, docs/chapter-1.md, docs/main-quest.md): from waking in the
// clearing to the dragon of Cinder Peak, as quests that begin by themselves as the last ends. Each stage waits on
// a state of the world — a step of the story played, a fact the story keeps, a place reached — never on a path:
// the scenes and rules change the facts, and the quests answer.

import type { QuestDef, QuestStage, QuestTrigger, Text } from '@openworld/engine'
import { L, gear } from './kit.ts'
import { TUTORIAL_LESSONS, TUTORIAL_DONE } from '../prologue.ts'
import { ALBERIC_ID, CH1 } from '../chapter1.ts'
import { ASKS, BLADE, DRAGON } from '../quest.ts'
import { ABBOT_ID, PILGRIMAGE, SWORN_SCALLOP, WAYSHRINES, shrineFact } from '../pilgrimage.ts'
import { PART_TWO } from '../regions.ts'
import { HAVEN } from '../haven.ts'

/** The White Knight is down: what comes before him is behind you. */
export const PAST_KNIGHT: QuestTrigger = { fact: { [CH1.knight]: { ne: 0 } } }

// ------------------------------------------------------------------ the clearing (the tutorial)

const TUTORIAL: [string, Text, Text][] = [
  ['eat', L('Find something to eat', '找点吃的'), L('{key:move} to walk. {key:hands} picks up the thing your mouse points at. Take it in hand with {key:slots}, then left click to eat it.', '用 {key:move} 走路。{key:hands} 捡起鼠标指着的东西。按 {key:slots} 把它拿在手上，再按左键吃掉。')],
  ['gather', L('Gather sticks, stones and grass', '收集树枝、石头和草'), L('They lie all over the Waking Glade, and more keep turning up. {key:hands} picks them up; {key:bag} opens your bag.', '空地上到处都是，捡完了还会再有。按 {key:hands} 捡起来，按 {key:bag} 打开背包。')],
  ['axe', L('Make a stone axe', '做一把石斧'), L('{key:craft} opens crafting. A stone axe takes a stick, a stone and a tuft of grass.', '按 {key:craft} 打开制作。一把石斧要一根树枝、一块石头和一把草。')],
  ['planks', L('Fell a tree and split planks', '砍树，劈出木板'), L('Hold the axe and left click a tree until it falls; it leaves logs. Left click a log with the axe to split it into planks.', '拿着斧头左键点树，一直砍到它倒下，会留下原木。再拿斧头左键点原木，就劈成了木板。')],
  ['fire', L('Build a campfire and light it', '搭一堆营火并点燃'), L('{key:build} opens building; a campfire is a ring of stones and sticks. Then make a torch with {key:craft} (a stick and grass), hold it and left click the fire.', '按 {key:build} 打开建造，营火用石头和树枝搭。再按 {key:craft} 做一支火把（树枝加草），拿在手上左键点营火。')],
  ['house', L('Build a house with a bed', '盖一间有床的屋子'), L('{key:craft} makes walls, a door, a floor and a bed out of planks. Take one in hand and right click where it should go; hold and drag to lay a row. Put walls and a door round you, and the bed inside. The ceiling is a floor laid over your head, drawn one tile higher: with a floor in hand press {key:rotate}, then right click just above your head. (In building, {key:build}, {key:rotate} also turns a floor into a ceiling.)', '{key:craft} 可以用木板做墙、门、地板和床。拿在手上，右键点哪里就放在哪里，按住拖动能放一排。用墙和门把自己围起来，床放在里面。天花板就是盖在头顶上的地板，画在高一格的位置：手里拿着地板按 {key:rotate}，再右键点头顶上方那一格。（在建造模式 {key:build} 里，按 {key:rotate} 也能把地板换成天花板。）')],
  ['night', L('Get through the night', '熬过这一夜'), L('Things come out after dark. Sleep in your bed ({key:hands}). Eat something first, or hunger will wake you in the night. We leave at first light.', '天黑以后会有东西出来。到床上睡一觉（{key:hands}）。睡前先吃点东西，不然半夜会饿醒。天一亮我们就走。')],
  ['path', L('Take the path south', '沿小路往南走'), L('The path out of the Waking Glade runs south, down to the foot of the mountain.', '空地南边有条小路，一直通到伤石山麓。')],
]
/** The beats each stage of the clearing waits for (prologue.ts), in order. */
const TUTORIAL_BEATS = ['tut_wake', 'tut_ate', 'tut_gathered', 'tut_axe', 'tut_planks', 'tut_fire', 'tut_house', 'tut_morning']

/** The clearing's stage for an old prologue stage (1 … 8): 10 … 80. */
export const AWAKENING = (n: number) => n * 10

const awakening: QuestDef = {
  id: 'awakening',
  kind: 'main',
  title: L('Waking', '醒来'),
  summary: L('You woke in a clearing in the woods, with a fairy called Lumi at your side. Get through a day and a night here, then take the path south down the mountain.', '你在林间的一片空地上醒来，身边有一个叫露米的精灵。在这里过完一天一夜，再沿小路往南下山。'),
  aliases: { pip: { id: 'pip' } },
  objectives: TUTORIAL.map(([id, text]) => ({ id, text })),
  stages: [
    { n: 5, log: L("I woke in a clearing. I don't remember how I got here.", '我在一片空地上醒来，不记得自己是怎么到这儿的。') },
    ...TUTORIAL.map(([id, , hint], i): QuestStage => ({
      n: AWAKENING(i + 1),
      on: { step: TUTORIAL_BEATS[i] },
      ...(i > 0 && { done: [TUTORIAL[i - 1][0]] }),
      show: [id],
      hint,
      log: [
        L('A fairy called Lumi woke me. I need something to eat first.', '一个叫露米的精灵把我叫醒了。我得先找点吃的。'),
        L("I've eaten. To make anything, I need sticks, stones and grass.", '吃过了。要做东西，得先有树枝、石头和草。'),
        L('I have enough for an axe.', '够做一把斧头了。'),
        L('I made a stone axe. Now I need wood.', '做好了一把石斧。接下来要木头。'),
        L('I have planks. Night comes early in the woods; I should light a fire first.', '有木板了。林子里天黑得早，得先生一堆火。'),
        L('The fire is lit. Now I need a roof over my head.', '火生起来了。现在得有个遮风挡雨的地方。'),
        L('I built a house. Now I only have to get through the night.', '屋子盖好了。现在只要熬过今晚。'),
        L("It's morning. Lumi says the path south is open now.", '天亮了。露米说，南边的小路可以走了。'),
      ][i],
      lessons: TUTORIAL_LESSONS[i + 1] ?? [],
    })),
    { n: 100, on: { step: 'tut_out' }, done: ['path'], complete: true, reward: { xp: 10 }, log: L("I've come down to the foot of the mountain.", '下到伤石山麓了。') },
  ],
  start: { auto: { enter: 'tutorial' } },
}
void TUTORIAL_DONE

// ------------------------------------------------------------------ down from the mountain

const descent: QuestDef = {
  id: 'descent',
  kind: 'main',
  title: L('Down from the Mountain', '下山'),
  summary: L('You woke on the mountain with a fairy at your side. Go down past the old stone at Woundstone Foot, take the cliff stair down to Vesper Ford, and go west from there to the village.', '你在山上醒来，身边跟着一个精灵。下山去吧：经过伤石山麓那块古老的路碑，顺着悬崖台阶下到晚祷渡，再往西走到村子。'),
  aliases: { stone: { place: 'foot:relic' }, ford: { place: 'ford' }, village: { place: 'meadow' } },
  objectives: [
    { id: 'stone', text: L('Find the shrine stone at Woundstone Foot', '找到伤石山麓的路碑'), target: 'stone' },
    { id: 'try', text: L('Try something the world has never seen', '做一件世界从没见过的事') },
    { id: 'ford', text: L('Take the cliff stair down to Vesper Ford', '顺着悬崖台阶下到晚祷渡'), target: 'ford' },
    { id: 'village', text: L('Go west to Firstlight Village', '往西到初原村'), target: 'village' },
  ],
  stages: [
    { n: 10, show: ['stone', 'try'], hint: L('The only way down is the cut in the rocks to the south. Below it is Woundstone Foot, where an old stone stands. Do anything you like to it: use what you hold on it, put something on it, or strike it. Whatever you try, the world will answer.', '下山的路只有一条，是南边岩壁上的那道豁口。下面是伤石山麓，那里立着一块古老的路碑。对它做什么都可以：用手里的东西碰它，往上面放点东西，或者打它一下。不管你做什么，世界都会回应。'), log: L('Lumi says the way down is to the south, through a cut in the rocks.', '露米说，下山的路在南边，要从岩壁上的豁口下去。') },
    { n: 20, on: { step: 'relic' }, done: ['stone'], hint: L('Do something to the old stone: use what you hold on it, put something on it, or strike it. Whatever you try, the world will answer.', '对路碑做点什么：用手里的东西碰它，往上面放点东西，或者打它一下。不管你做什么，世界都会回应。'), log: L('An old stone with five marks cut in it; the first one is cracked. Lumi said it was cold near it.', '一块古老的石头，上面刻着五道痕，第一道裂开了。露米说它旁边很冷。') },
    { n: 30, on: { step: 'tried' }, done: ['try'], show: ['ford'], hint: L('The trail goes on south, down off the mountain to Vesper Ford. What the world has learned is written in the Threadbook ({key:journal}).', '小路继续往南，一直下到山下的晚祷渡。世界学会的事都写在织线簿里（{key:journal}）。'), log: L('I did something the world had never seen, and it answered. What it learns is kept in the Threadbook.', '我做了一件世界从没见过的事，它给出了回应。它学会的东西都记在织线簿里。') },
    { n: 40, on: { step: 'ford' }, done: ['stone', 'try', 'ford'], show: ['village'], hint: L('Hesper says two people from the village west of Vesper Ford are lost, and its elder, Rowan, is asking for anyone who can fight. Someone with a yellow "!" over their head has a task for you; talk to them with {key:hands}.', '赫斯珀说，晚祷渡西边的村子里有两个人失踪了，村里的长老罗万在找能打的人。头顶有黄色"！"的人有事要托你，按 {key:hands} 和他们说话。'), log: L('I reached Vesper Ford. The bridge is broken and the ferry rope has snapped. Hesper, the ferrykeeper, sent me west to the village first.', '到了晚祷渡。桥坏了，渡绳也断了。摆渡人赫斯珀让我先往西去村子里看看。') },
    { n: 100, on: { step: 'village_arrival' }, done: ['stone', 'try', 'ford', 'village'], complete: true, reward: { xp: 15, items: [gear('item/clothing/boots', 'feet', "Traveller's Boots", '旅人的靴子', 'common', {}, 1)] }, log: L('I came to Firstlight Village. A flame is kept burning in its chapel.', '到了初原村。村里的礼拜堂供着一团圣火。') },
  ],
  start: { auto: { any: [{ done: 'awakening' }, { enter: 'summit' }, { enter: 'foot' }] } },
}

// ------------------------------------------------------------------ Firstlight: the barrow, the vigil

const rescue: QuestDef = {
  id: 'rescue',
  kind: 'main',
  title: L('Lost in the Barrow', '古墓里的失踪者'),
  summary: L('Lina and Oskar went into Longsleep Barrow to the south for shelter the day the storm broke, and have not come back. Rowan, the village elder, has asked you to find them.', '莉娜和奥斯卡在起风暴那天躲进了南边的长眠冢，一直没有回来。长老罗万托你去找他们。'),
  aliases: {
    giver: { id: 'npc.rowan', essential: true },
    lina: { id: 'npc.lina', essential: true },
    oskar: { id: 'npc.oskar', essential: true },
    warden: { find: { type: 'actor/creature/undead/warden' }, optional: true },
    mouth: { place: 'hollow:mouth' },
  },
  objectives: [
    { id: 'mouth', text: L('Go south through Dusklea and Hushwood to the barrow mouth in Thornwood Hollow', '往南穿过暮牧原和噤声林，到荆棘谷的长眠冢入口'), target: 'mouth', on: { step: 'barrow_mouth' } },
    { id: 'lina', text: L('Find Lina', '找到莉娜'), target: 'lina', talk: true, on: { talk: 'lina' }, say: L("Took you long enough. ...The way's clear? Fine. Tell Rowan I'm alive — and tell him nothing else.", '慢死了。……路通了？行吧。跟罗万说我还活着——别的什么都别说。') },
    { id: 'oskar', text: L('Find Oskar in the ossuary, on the second floor', '到第二层的骸骨堂找到奥斯卡'), target: 'oskar', talk: true, on: { talk: 'oskar' }, say: L("About time. I'll follow the girl home. The warden is down at the bottom of the stairs. If it's still walking, watch yourself.", '可算来了。我跟着那丫头回去。守墓者在楼梯最底下，它要是还在走动，你当心点。') },
    { id: 'warden', text: L('Put down the warden in the sanctum, on the deepest floor', '在最深一层的圣所打倒守墓者'), target: 'warden', count: { kill: { type: 'actor/creature/undead/warden' } }, need: 1 },
    { id: 'back', text: L('Back to Rowan', '回去找罗万'), target: 'giver', talk: true },
  ],
  stages: [
    { n: 10, show: ['mouth', 'lina', 'oskar', 'warden'], hint: L('The barrow is to the south, in Thornwood Hollow, past Dusklea and Hushwood. Its mouth is between two standing stones.', '长眠冢在南边的荆棘谷，要先穿过暮牧原和噤声林。入口在两块立石中间。'), log: L("Rowan says Lina and Oskar went into Longsleep Barrow when the storm broke. He says the dead down there haven't been lying quiet.", '罗万说，起风暴那天莉娜和奥斯卡进了长眠冢。他还说，长眠冢里的死人最近不肯安息。') },
    { n: 20, on: { objectives: ['lina', 'oskar', 'warden'] }, done: ['mouth'], show: ['back'], log: L('I found them both and put the warden down. Now back to Rowan.', '两个人都找到了，守墓者也倒下了。该回去找罗万了。') },
    { n: 100, on: { talk: 'giver' }, from: [20], done: ['back'], complete: true, say: L("You brought them both home, and the thing in the barrow is down. Firstlight owes you. The village will give thanks for them at the flame; I hope you'll stay for it.", '两个人都平安回来了，长眠冢里那个东西也倒下了。初原村欠你一份情。村里要在圣火前为他们感恩，希望你也留下来。'), reward: { xp: 60, items: [{ type: 'item/food/bread', count: 2 }, gear('item/armor/breastplate', 'body', "Rowan's Old Hauberk", '罗万的旧锁甲', 'fine', {}, 2)], facts: { 'rescue.lina': 1, 'rescue.oskar': 1, 'village.rescued': 1 }, regard: { giver: 15, lina: 20, oskar: 20 } }, log: L('Lina and Oskar are home. The village is to give thanks for them at the flame.', '莉娜和奥斯卡回家了。村里要在圣火前为他们感恩。') },
    { n: 105, on: { all: [PAST_KNIGHT, { objectives: ['lina', 'oskar', 'warden'] }] }, complete: true, reward: { xp: 60, items: [{ type: 'item/food/bread', count: 2 }, gear('item/armor/breastplate', 'body', "Rowan's Old Hauberk", '罗万的旧锁甲', 'fine', {}, 2)], facts: { 'rescue.lina': 1, 'rescue.oskar': 1, 'village.rescued': 1 }, regard: { giver: 15, lina: 20, oskar: 20 } }, log: L('I did all of it on my way east.', '这些事，我在往东走的路上都办完了。') },
    { n: 110, on: PAST_KNIGHT, complete: true, reward: { facts: { 'rescue.lina': 1, 'rescue.oskar': 1, 'village.rescued': 1 } }, log: L('I went on east before it was done. Lina and Oskar found their own way home.', '这件事没办完，我就往东去了。莉娜和奥斯卡自己找路回了家。') },
  ],
  start: { auto: { step: 'village_arrival' } },
  waiting: L("The barrow is to the south, in Thornwood Hollow, between two standing stones. Lina and Oskar — I'm counting on you.", '长眠冢在南边的荆棘谷，两块立石中间。莉娜和奥斯卡，拜托你了。'),
}

const vigil: QuestDef = {
  id: 'vigil',
  kind: 'main',
  title: L('The Vigil', '守夜之备'),
  summary: L('When someone comes home safe, Firstlight keeps a vigil at its flame, and Sister Ilse has asked you to help her prepare it. She needs lamp oil from the cellar at Millbrook, west of the village, dawnbloom from Dawn Hill to the north, and the old bell rung in the Chapel of the First Dawn on the hill\'s top.', '初原村有个规矩：有人平安归来，就在圣火前守夜。伊尔丝修女托你帮她准备：村子西边水车磨坊地窖里的灯油，北边晨光丘上的晨光花，还要去丘顶的初晓礼拜堂敲响那口旧钟。'),
  aliases: { giver: { id: 'npc.ilse', essential: true }, mill: { place: 'millcellar' }, hill: { place: 'dawnhill' }, belfry: { place: 'chapel:belfry' } },
  objectives: [
    { id: 'oil', text: L('Fetch the lamp oil from the mill cellar at Millbrook (west)', '去西边水车磨坊的地窖取灯油'), target: 'mill', count: { carry: { type: 'item/vessel/flask/oil' } }, need: 2, nudge: L('The oil! Here, before the shelves at the back. Two flasks!', '灯油！在这儿，后面架子前头。要两瓶哦！') },
    { id: 'bloom', text: L('Pick dawnbloom on Dawn Hill (north)', '去北边的晨光丘采晨光花'), target: 'hill', count: { carry: { type: 'item/material/herb' } }, need: 3, nudge: L('Hi, here! This one is dawnbloom — not the little flowers round it. Pick three!', '嗨，在这里！这朵就是晨光花——不是旁边那些小花哦。要摘三朵！') },
    { id: 'bell', text: L('Ring the bell in the Chapel of the First Dawn, on top of Dawn Hill', '敲响晨光丘顶初晓礼拜堂里的钟'), target: 'belfry', on: { step: 'chapel_bell' }, nudge: L('The bell is up here! Ring it!', '钟就在这上面！敲响它吧！') },
    { id: 'back', text: L('Back to Sister Ilse', '回去找伊尔丝修女'), target: 'giver', talk: true },
  ],
  stages: [
    { n: 10, show: ['oil', 'bloom', 'bell'], hint: L('Millbrook is west of the village; Tam keeps the lamp oil in his cellar. Dawn Hill is to the north: the dawnbloom grows on its east slope, and the chapel with the bell stands on its top.', '水车磨坊在村子西边，塔姆把灯油放在他的地窖里。晨光丘在村子北边：晨光花长在东坡上，那口钟在丘顶的礼拜堂里。'), log: L('Sister Ilse is preparing a vigil for Lina and Oskar. She asked me to fetch lamp oil and dawnbloom, and to ring the old bell on Dawn Hill.', '伊尔丝修女在为莉娜和奥斯卡准备守夜。她托我取灯油、采晨光花，再去晨光丘敲响那口旧钟。') },
    { n: 20, on: { objectives: ['oil', 'bloom', 'bell'] }, show: ['back'], log: L('I have the oil and the dawnbloom, and the bell has been rung. Back to Sister Ilse.', '灯油和晨光花都有了，钟也敲过了。回去找伊尔丝修女。') },
    { n: 100, on: { all: [{ talk: 'giver' }, { objectives: ['oil', 'bloom', 'bell'] }] }, done: ['back'], take: [{ match: { type: 'item/vessel/flask/oil' }, count: 2 }, { match: { type: 'item/material/herb' }, count: 3 }], complete: true, say: L('The lamps are trimmed, and the bell has been rung. Thank you for going so far for us. ...And this time I did not lose a single wick. Tonight after dark Firstlight gives thanks at the flame. Please stay for it.', '灯都备好了，钟也敲过了。辛苦你走了这么远的路。……这一回，我一根灯芯也没有弄丢。今晚天黑以后，初原村要在圣火前感恩，请你也留下来。'), reward: { xp: 50, items: [gear('item/clothing/cloak', 'shoulders', 'Cloak of the Dawn Vigil', '晨光守夜斗篷', 'masterwork', { 'night:def': 1 }, 3)], facts: { 'ch1.vigil': 1 }, regard: { giver: 15 } }, log: L('Everything for the vigil is ready. Tonight the village gives thanks at the flame.', '守夜的东西备齐了。今晚全村要在圣火前感恩。') },
    { n: 105, on: { all: [PAST_KNIGHT, { objectives: ['oil', 'bloom', 'bell'] }] }, take: [{ match: { type: 'item/vessel/flask/oil' }, count: 2 }, { match: { type: 'item/material/herb' }, count: 3 }], complete: true, reward: { xp: 50, items: [gear('item/clothing/cloak', 'shoulders', 'Cloak of the Dawn Vigil', '晨光守夜斗篷', 'masterwork', { 'night:def': 1 }, 3)], facts: { 'ch1.vigil': 1 }, regard: { giver: 15 } }, log: L('I went east before the vigil, but I had brought everything. Sister Ilse took the oil and the dawnbloom all the same.', '守夜没赶上，但东西我都带回来了。伊尔丝修女还是收下了灯油和晨光花。') },
    { n: 110, on: PAST_KNIGHT, complete: true, reward: { facts: { 'ch1.vigil': 1 } }, log: L('I went on east before the vigil.', '还没等到守夜，我已经往东去了。') },
  ],
  start: { auto: { done: 'rescue' } },
  waiting: L('The oil from Tam\'s cellar, the dawnbloom from the hill, and the bell. They say that bell was rung on the morning the sun came back. It ought to be rung for them, too.', '塔姆地窖里的灯油，丘上的晨光花，还有那口钟。听说太阳回来的那天早上，敲响的就是那口钟。这一回，也该为他们敲一敲。'),
}

// ------------------------------------------------------------------ the First Seal

const SHRINES = WAYSHRINES.map((w) => `shrine.${w.id}`)

const firstSeal: QuestDef = {
  id: 'first_seal',
  kind: 'main',
  title: L('The First Seal', '第一印'),
  summary: L('The days are growing shorter, and the Church is calling pilgrims east. Beyond Vesper Ford the Pilgrim\'s Road leads to the Sunrise Road, where the White Knight Alberic lets no one pass who will not kneel.', '白昼一天比一天短，教会在召朝圣者东行。过了晚祷渡，朝圣者之路一直通到朝阳大道；白骑士阿尔贝里克守在那里，不肯下跪的人，他一个也不放过去。'),
  aliases: {
    giver: { id: 'npc.ilse', essential: true },
    village: { place: 'meadow' },
    bank: { place: 'ford:far_bank' },
    rest: { place: 'waystation.chapel' },
    way: { place: 'pilgrimway' },
    hall: { place: 'abbey.hall' },
    keeper: { id: ABBOT_ID, optional: true },
    field: { place: 'kneelfield' },
    knight: { id: ALBERIC_ID, optional: true },
  },
  objectives: [
    { id: 'thanks', text: L('Be at the flame in Firstlight after dark, for the night of thanks', '入夜后到初原村的圣火前，参加感恩之夜'), target: 'village', on: { fact: { [CH1.flameStolen]: 1 } } },
    { id: 'letter', text: L("Wait in Firstlight for the Church's letter the next morning", '第二天早上，在初原村等教会的来信'), target: 'village', on: { fact: { [CH1.letter]: 1 } } },
    { id: 'ilse', text: L('Ask Sister Ilse where the pilgrimage begins', '问伊尔丝修女朝圣从哪里开始'), target: 'giver', talk: true, optional: true, on: { any: [{ quest: { pilgrim: { gte: 10 } } }, { fact: { 'ford.crossed': 1 } }] } },
    { id: 'river', text: L('Cross the river at Vesper Ford', '在晚祷渡过河'), target: 'bank', on: { fact: { 'ford.crossed': 1 } } },
    { id: 'oath', text: L("Take the pilgrim's oath at the Pilgrims' Rest: kneel at the altar of the five wounds", '到朝圣者驿站立朝圣者之誓：在五伤祭坛前跪下'), target: 'rest', on: { fact: { [PILGRIMAGE.oath]: 1 } } },
    ...WAYSHRINES.map((w, i) => ({ id: SHRINES[i], text: L(`Light the ${w.name.en} with ${w.asks.en}`, `点亮${w.name.zh}（献上${w.asks.zh}）`), target: 'way', on: { fact: { [shrineFact(w.id)]: 1 } } })),
    { id: 'writ', text: L('At the Abbey of the Thorn, north of the road, find out what became of the knight', '到大路北边的荆棘修道院，查明骑士后来怎么了'), target: 'hall', on: { fact: { [PILGRIMAGE.writ]: 1 } } },
    { id: 'seal', text: L("Take the Order's seal from its last keeper, in the abbey's crypt", '从修道院墓室里最后一位看守手中取得骑士团的印章'), target: 'keeper', on: { fact: { [PILGRIMAGE.seal]: 1 } } },
    { id: 'field', text: L('Go on east to the Kneeling Field', '继续往东，到跪石原'), target: 'field', on: { fact: { [PILGRIMAGE.field]: 1 } } },
    { id: 'knight', text: L('Bring down the White Knight Alberic on the Sunrise Road', '在朝阳大道打倒白骑士阿尔贝里克'), target: 'knight', on: PAST_KNIGHT },
  ],
  stages: [
    { n: 10, show: ['thanks'], hint: L('Tonight Firstlight gives thanks at the flame. Be in the village after dark.', '今晚初原村要在圣火前感恩。天黑时待在村里。'), log: L('Tonight Firstlight gives thanks at the flame.', '今晚初原村要在圣火前感恩。') },
    { n: 20, on: { fact: { [CH1.flameStolen]: 1 } }, done: ['thanks'], show: ['letter'], hint: L('The Firstlight is gone. Wait in the village until morning.', '初火不见了。在村里等到天亮。'), log: L('In the night a man in grey took the Firstlight from the chapel. He walked east across the river, and the water froze under his feet as he went.', '夜里，一个穿灰衣的人从礼拜堂拿走了初火。他往东过了河，走到哪里，脚下的河水就冻到哪里。') },
    { n: 30, on: { fact: { [CH1.letter]: 1 } }, done: ['letter'], show: ['ilse', 'river'], hint: L('Hesper says the White Knight tore three planks out of the footbridge by the marsh. Mend it, or find another way across. An axe fells a tree and splits the logs into planks; {key:put} lays a plank down on the water.', '赫斯珀说，白骑士拆走了沼泽边小桥上的三块木板。补上它，或者另找办法过河。斧头能砍树，也能把原木劈成木板；按 {key:put} 把木板铺到水上。'), log: L('A letter came from the Holy City. The Church has called the pilgrimage and named me a pilgrim. Sister Ilse says the road begins across the river.', '圣城来了一封信。教会发布了朝圣令，信里点了我的名。伊尔丝修女说，朝圣的路从河对岸开始。') },
    { n: 40, on: { fact: { 'ford.crossed': 1 } }, from: [30], done: ['river'], show: ['oath'], hint: L("East of the river the Church keeps a Rest for pilgrims. Father Caius takes the pilgrim's oath there: kneel at the altar of the five wounds in its chapel.", '河东边，教会为朝圣者设了一处驿站，由凯乌斯司铎主持朝圣者之誓。到驿站礼拜堂的五伤祭坛前跪下。'), log: L('I crossed the river. On the road east the Church keeps a Rest for pilgrims.', '过了河。往东的路上，教会为朝圣者设了一处驿站。') },
    { n: 50, on: { fact: { [PILGRIMAGE.oath]: 1 } }, done: ['oath'], show: SHRINES, hint: L('Five wayside shrines stand along the Pilgrim\'s Road, one for each of the Five Sufferings. Each asks for an offering, and the words cut on it say what; lay it on the shrine with {key:put}.', '朝圣者之路上立着五座路边圣龛，五苦各一座。每座龛都要一样供品，石上刻的字写着要什么；按 {key:put} 把它放上去。'), log: L('I knelt at the altar of the five wounds and swore the pilgrim\'s oath. Father Caius said the knight was due to be relieved once, and would say no more about it.', '我在五伤祭坛前跪下，立了朝圣者之誓。凯乌斯司铎说，那位骑士本来早该有人去接替，之后就不肯再多说了。'), reward: { xp: 20, items: [{ type: SWORN_SCALLOP, count: 1 }] } },
    { n: 60, on: { objectives: SHRINES }, done: SHRINES, show: ['writ', 'seal'], hint: L('Halfway along the road a path climbs north to the Abbey of the Thorn, where the knight was knighted. Read what was left in its chapter hall. The Order\'s last keeper is in the crypt under the shrine.', '大路走到一半，有条小路往北上山，通到荆棘修道院，那位骑士就是在那里受封的。去骑士团大厅看看留下了什么。骑士团最后的看守在神龛下面的墓室里。'), log: L('All five shrines are lit. North of the road stands the abbey where the knight was knighted.', '五座圣龛都亮了。大路北边，就是骑士受封的那座修道院。') },
    { n: 70, on: { objectives: ['writ', 'seal'] }, done: ['writ', 'seal'], show: ['field'], hint: L("Follow the road east to the Kneeling Field. The knight's kingdom lies beyond it, on the Sunrise Road.", '沿大路往东走，就到跪石原。骑士的王国在它后面的朝阳大道上。'), log: L('In the abbey I found a writ that should have relieved the knight after forty years. It was sealed, and never sent.', '我在修道院里找到一份替任文书：骑士守满四十年，就该另派人接替他。文书封得好好的，从来没有寄出去。'), reward: { xp: 40 } },
    { n: 80, on: { fact: { [PILGRIMAGE.field]: 1 } }, from: [70], done: ['field'], show: ['knight'], hint: L('Cross the field to the Sunrise Road and go on past the burned farm to the knight\'s ring of thorns. Watch the ground for where his blows will land, and step out of the way.', '穿过跪石原到朝阳大道，经过烧毁的农庄，就是骑士的荆棘圈。留意地上标出的他要打下来的地方，及时躲开。'), log: L('The Kneeling Field is full of stone figures carved on their knees. Each has a name and a year cut on it.', '跪石原上立满了石像，个个都跪着，每一座上都刻着一个名字和一个年份。') },
    { n: 100, on: PAST_KNIGHT, done: ['thanks', 'letter', 'river', 'oath', ...SHRINES, 'writ', 'seal', 'field', 'knight'], complete: true, reward: { xp: 60, karma: 8 }, log: L('The White Knight fell to his knees, took off the Crown of Thorns and gave it to me.', '白骑士跪倒在地，摘下荆棘冠，交到了我手里。') },
  ],
  start: { auto: { done: 'vigil' } },
}

// ------------------------------------------------------------------ the Held Ground (docs/chapter-1.md §12)

/** The steward of the Held Ground: the knight, freed of the crown (tools/src/demo/people). */
const STEWARD_ID = 'npc.alberic'

/**
 * Into the Held Ground once the knight has fallen: the Oath-Thorn used on oneself, a word with its steward, and
 * the thorn again to come back where one stood. Begun with the thorn (the story's `oath_thorn`); the Crown is carried
 * home after it, and the homecoming waits for it (the step `return`). A save that had been there already finds it
 * done; one past the homecoming, too.
 */
const heldGround: QuestDef = {
  id: 'held_ground',
  kind: 'main',
  title: L('The Held Ground', '誓守之地'),
  summary: L('Where the White Knight fell, one thorn of his crown stayed green. Lumi says there is a field on the other side of it, and someone waiting.', '白骑士倒下的地方，荆棘冠上有一根刺还是绿的。露米说，它的另一边有一片田野，还有人在等。'),
  aliases: { steward: { id: STEWARD_ID } },
  objectives: [
    { id: 'enter', text: L('Hold the Oath-Thorn ({key:slots}) and left click to enter the Held Ground', '把誓约之棘拿在手上（{key:slots}），按左键，进入誓守之地'), on: { fact: { 'haven.met': 1 } } },
    {
      id: 'steward',
      text: L('Speak to Alberic by the planted sword', '到插在地上的那把剑旁边，和阿尔贝里克说话'),
      target: 'steward',
      talk: true,
      on: { talk: 'steward' },
      say: L('The ground is yours, but the mist still holds most of it. Ask me of the Held Ground, and I will show you what each ring of mist asks before it lifts, and what may be built here. When you would leave, use the thorn on yourself again. It returns you to where you stood.', '这片土地归你了，只是大半还在雾里。问我「领地扩建」的事，我便告诉你每一圈雾退开之前要些什么，这里又能盖些什么。要走的时候，再对自己用一次那根刺，它会送你回到原来站的地方。'),
    },
    { id: 'out', text: L('Hold the Oath-Thorn and left click again to go back where you stood', '再拿着誓约之棘按一次左键，回到原来的地方'), on: { not: { enter: HAVEN.map } } },
  ],
  stages: [
    { n: 10, show: ['enter'], hint: L('The Oath-Thorn is in your bag. Take it in hand ({key:slots}) and left click: it is used on you. It does not open in the middle of a fight.', '誓约之棘在你的背包里。把它拿在手上（{key:slots}），按左键，它就用在你自己身上。打斗中它打不开。'), log: L('Where the knight fell, one thorn of his crown was still green, and warm to the touch. I took it. Lumi says it wants to be used on me.', '骑士倒下的地方，荆棘冠上有一根刺还是绿的，摸着是温的。我把它收下了。露米说，它想让我对自己用一下。') },
    // (in the Held Ground: a save that met him there before finds the quest done instead, below)
    { n: 20, on: { all: [{ fact: { 'haven.met': 1 } }, { enter: HAVEN.map }] }, from: [10], done: ['enter'], show: ['steward'], hint: L('Alberic keeps the Held Ground now. He stands by the sword planted at its heart; speak to him with {key:hands}.', '如今阿尔贝里克替你守着誓守之地。他就在正中那把插在地上的剑旁边，按 {key:hands} 和他说话。'), log: L('Beyond the thorn is a field ringed by mist. The White Knight is there, without his helm. He says he holds this ground for me now.', '棘刺的另一边是一片被雾围着的田野。白骑士也在那里，没戴头盔。他说，如今换他替我守着这片土地。') },
    { n: 30, on: { objectives: ['steward'] }, done: ['steward'], show: ['out'], hint: L('To go back, take the Oath-Thorn in hand and left click again. It takes you back to where you were standing.', '要回去的话，把誓约之棘拿在手上，再按一次左键。它会把你送回原来站的地方。'), log: L('Alberic will push the mist back if I bring what the ground asks. He keeps a stall by the sword, too.', '只要把扩地要的东西带来，阿尔贝里克就会把雾推远些。剑旁边还有他的货摊。') },
    { n: 100, on: { objectives: ['out'] }, from: [30], done: ['out'], complete: true, reward: { xp: 30, regard: { steward: 10 } }, log: L('The thorn brought me back to where I had stood. I can go back to the Held Ground whenever I want. The Crown is still to be carried home to Firstlight.', '棘刺把我送回了原来站的地方。以后想回誓守之地，随时都能回去。荆棘冠还得带回初原村。') },
    { n: 105, on: { all: [{ fact: { 'haven.met': 1 } }, { not: { enter: HAVEN.map } }] }, from: [10], done: ['enter', 'steward', 'out'], complete: true, log: L('I had been to the Held Ground already.', '誓守之地，我已经去过了。') },
    { n: 110, on: { fact: { [CH1.end]: 1 } }, from: [10], complete: true, log: L('I carried the Crown home before I went through the thorn.', '我没穿过那根刺，就先把荆棘冠带回了家。') },
  ],
  start: { auto: { step: 'oath_thorn' } },
}

const crownHome: QuestDef = {
  id: 'crown_home',
  kind: 'main',
  title: L('The Crown of Thorns', '荆棘冠'),
  summary: L('You took the Crown of Thorns from the White Knight. Carry it home to Firstlight.', '你从白骑士手里得到了荆棘冠。把它带回初原村。'),
  aliases: { village: { place: 'meadow' } },
  objectives: [{ id: 'home', text: L('Bring the Crown home to Firstlight', '把荆棘冠带回初原村'), target: 'village', on: { fact: { [CH1.end]: 1 } } }],
  stages: [
    { n: 10, show: ['home'], hint: L('Carry the Crown of Thorns back west across the river, to Firstlight.', '往西过河，把荆棘冠带回初原村。'), log: L('I carry the Crown now. The man in grey drew the rest of its light into his lantern and went east.', '荆棘冠现在由我带着。那个灰衣人把剩下的光收进了他的灯里，往东走了。') },
    { n: 100, on: { fact: { [CH1.end]: 1 } }, done: ['home'], complete: true, reward: { xp: 30 }, log: L('I brought the Crown home to Firstlight. Nessa says the sun set four minutes early tonight.', '我把荆棘冠带回了初原村。奈莎说，今晚太阳早落了四分钟。') },
  ],
  // after the Held Ground (an older save had it under way already, and keeps it)
  start: { auto: { done: 'held_ground' } },
}

// ------------------------------------------------------------------ Emberfall and the dragon (docs/main-quest.md)

const dragonRoad: QuestDef = {
  id: 'dragon_road',
  kind: 'main',
  title: L('The Dragon Road', '屠龙之路'),
  summary: L('With the knight gone, the Sunrise Road is open. It runs on east to Emberfall, where smoke hangs over the hills.', '骑士倒下了，朝阳大道通了。顺着它往东是余烬镇，那边的山头上一直冒着烟。'),
  aliases: {
    town: { place: 'emberfall' },
    mara: { id: 'npc.mara', essential: true },
    smith: { id: 'npc.garrick', essential: true },
    herbalist: { id: 'npc.wren', essential: true },
    lair: { place: 'lair' },
    dragon: { find: { type: DRAGON }, optional: true },
  },
  objectives: [
    { id: 'road', text: L('Follow the road east to Emberfall', '沿大路往东到余烬镇'), target: 'town', on: { step: 'emberfall_arrival' } },
    { id: 'mara', text: L('Find Mara, the elder of Emberfall', '找到余烬镇的长老玛拉'), target: 'mara', talk: true, on: { fact: { 'mq.council': 1 } } },
    { id: 'ore', text: L('Iron ore for Garrick, from the Embervein Mine north of town', '给加里克的铁矿石（镇北的烬脉旧矿）'), target: 'smith', count: { fact: ASKS.ore.fact }, need: ASKS.ore.need },
    { id: 'coal', text: L('Coal for Garrick', '给加里克的煤'), target: 'smith', count: { fact: ASKS.coal.fact }, need: ASKS.coal.need },
    { id: 'fireweed', text: L('Fireweed for Wren (Firstlight Village)', '给雷恩的火焰草（初原村）'), target: 'herbalist', count: { fact: ASKS.fireweed.fact }, need: ASKS.fireweed.need },
    { id: 'frostcap', text: L('Frostcap for Wren (Hushwood)', '给雷恩的霜盖菇（噤声林）'), target: 'herbalist', count: { fact: ASKS.frostcap.fact }, need: ASKS.frostcap.need },
    { id: 'blade', text: L('Collect Dragonsbane from Garrick ({key:hands})', '找加里克拿屠龙剑（{key:hands}）'), target: 'smith', talk: true, on: { fact: { 'mq.blade': 1 } } },
    { id: 'draught', text: L('Collect the fireproof draught from Wren ({key:hands})', '找雷恩拿防火药剂（{key:hands}）'), target: 'herbalist', talk: true, on: { fact: { 'mq.draught': 1 } } },
    { id: 'pass', text: L('Climb Cinder Pass to the dragon\'s lair', '翻过烬岭山道，到魔龙的巢穴'), target: 'lair', on: { step: 'lair_gate' } },
    { id: 'dragon', text: L('Defeat the dragon of Cinder Peak', '打倒烬峰魔龙'), target: 'dragon', on: { fact: { 'mq.dragon': 1 } } },
  ],
  stages: [
    { n: 10, show: ['road'], hint: L('The Sunrise Road is open. Follow it east to Emberfall.', '朝阳大道通了。顺着它往东走，就到余烬镇。'), log: L('I took the road east, toward Emberfall.', '我沿着大路往东，朝余烬镇走去。') },
    { n: 20, on: { step: 'emberfall_arrival' }, done: ['road'], show: ['mara'], hint: L('Mara is the elder of Emberfall. Ask her about the smoke on the hills.', '玛拉是余烬镇的长老。去问问她，山上的烟是怎么回事。'), log: L('Half the roofs in Emberfall are new thatch. The rest are still black from the fire.', '余烬镇一半的屋顶是新铺的茅草，另一半还是烧黑的。') },
    { n: 30, on: { fact: { 'mq.council': 1 } }, done: ['mara'], show: ['ore', 'coal', 'fireweed', 'frostcap', 'blade', 'draught'], hint: L('Garrick the smith will forge a blade if you bring him 5 iron ore and 3 coal; there are veins in the Embervein Mine north of town, and a pickaxe breaks them. Wren the herbalist will brew a fireproof draught from 3 fireweed, which grows around Firstlight Village, and 3 frostcap from Hushwood. Give them what they ask for with {key:put}, then talk to them with {key:hands}.', '铁匠加里克说，给他 5 块铁矿石和 3 块煤，他就能锻一把剑。镇北的烬脉旧矿里有矿脉，用镐能敲开。草药师雷恩说，有 3 株火焰草和 3 朵霜盖菇，她就能熬防火的药；火焰草长在初原村一带，霜盖菇长在噤声林里。按 {key:put} 把东西交给他们，再按 {key:hands} 和他们说话。'), log: L('Mara says a dragon nests on Cinder Peak. Garrick can forge a blade that will cut its hide, and Wren can brew a draught against its fire.', '玛拉说，烬峰上住着一头魔龙。加里克能锻一把砍得进龙皮的剑，雷恩能熬一种挡得住龙火的药。') },
    { n: 40, on: { step: 'ready' }, done: ['ore', 'coal', 'fireweed', 'frostcap', 'blade', 'draught'], show: ['pass'], hint: L('Climb the pass east of Emberfall to the dragon\'s lair. Drink the fireproof draught before you go in.', '翻过余烬镇东边的山道，就是魔龙的巢穴。进去之前，先喝下防火药剂。'), log: L('I have Dragonsbane and the draughts. The pass east of town climbs to Cinder Peak.', '屠龙剑和药剂都拿到了。镇子东边的山道一直通到烬峰。') },
    { n: 50, on: { step: 'lair_gate' }, done: ['pass'], show: ['dragon'], hint: L('The dragon breathes fire in a straight line; keep out of it, and watch for its whelps. Left click swings your weapon.', '魔龙会朝一条直线喷火，别站在那条线上，也要留心它的幼龙。左键挥动武器。'), log: L('Heat, and the smell of scorched stone. Something huge is breathing in the dark.', '一股热浪，还有烧焦的石头味。黑暗里有个巨大的东西在呼吸。') },
    { n: 100, on: { fact: { 'mq.dragon': 1 } }, done: ['road', 'mara', 'pass', 'dragon'], complete: true, reward: { xp: 100, regard: { mara: 20, smith: 15, herbalist: 15 }, karma: 10 }, hint: L('The dragon is dead. What you taught the world along the way is written in the Threadbook ({key:journal}).', '魔龙死了。一路上你教会这个世界的事，都写在织线簿里（{key:journal}）。'), log: L('The dragon is dead. Emberfall can sleep at night again.', '魔龙死了。余烬镇的人晚上又能睡安稳觉了。') },
  ],
  // Part Two's (release 1 ends with the Crown home: docs/release-1.md), begun once it opens
  start: { auto: { all: [{ done: 'crown_home' }, { fact: { [PART_TWO]: 1 } }] } },
}
void BLADE

export const MAIN_QUESTS: QuestDef[] = [awakening, descent, rescue, vigil, firstSeal, heldGround, crownHome, dragonRoad]
