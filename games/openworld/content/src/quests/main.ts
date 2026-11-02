// The main line (docs/quests.md §3, docs/prologue.md, docs/chapter-1.md, docs/chapter-2.md): from waking in the
// clearing to the Second Seal, as quests that begin by themselves as the last ends. Each stage waits on
// a state of the world — a step of the story played, a fact the story keeps, a place reached — never on a path:
// the scenes and rules change the facts, and the quests answer.

import type { QuestDef, QuestStage, QuestTrigger, Text } from '@openworld/engine'
import { L, gear, setPiece } from './kit.ts'
import { TUTORIAL_LESSONS, TUTORIAL_DONE } from '../prologue.ts'
import { ALBERIC_ID, CH1 } from '../chapter1.ts'
import { ASKS, BLADE, DRAGON } from '../quest.ts'
import { ABBOT_ID, PILGRIMAGE, SWORN_SCALLOP, WAYSHRINES, shrineFact } from '../pilgrimage.ts'
import { CHAPTER_FIVE, CHAPTER_FOUR, CHAPTER_THREE, CHAPTER_TWO, FINALE } from '../regions.ts'
import { CH2, MATTHIAS_ID } from '../chapter2.ts'
import { CH3, ELE_ID } from '../chapter3.ts'
import { CH4, NACHT_ID } from '../chapter4.ts'
import { CH5, WITNESSES_ID } from '../chapter5.ts'
import { ASTRA_ID, FIN } from '../finale.ts'
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
    { n: 100, on: { talk: 'giver' }, from: [20], done: ['back'], complete: true, say: L("You brought them both home, and the thing in the barrow is down. Firstlight owes you. The village will give thanks for them at the flame; I hope you'll stay for it.", '两个人都平安回来了，长眠冢里那个东西也倒下了。初原村欠你一份情。村里要在圣火前为他们感恩，希望你也留下来。'), reward: { xp: 60, items: [{ type: 'item/food/bread', count: 2 }, setPiece('item/armor/breastplate/watch', 'rescue')], facts: { 'rescue.lina': 1, 'rescue.oskar': 1, 'village.rescued': 1 }, regard: { giver: 15, lina: 20, oskar: 20 } }, log: L('Lina and Oskar are home. The village is to give thanks for them at the flame.', '莉娜和奥斯卡回家了。村里要在圣火前为他们感恩。') },
    { n: 105, on: { all: [PAST_KNIGHT, { objectives: ['lina', 'oskar', 'warden'] }] }, complete: true, reward: { xp: 60, items: [{ type: 'item/food/bread', count: 2 }, setPiece('item/armor/breastplate/watch', 'rescue')], facts: { 'rescue.lina': 1, 'rescue.oskar': 1, 'village.rescued': 1 }, regard: { giver: 15, lina: 20, oskar: 20 } }, log: L('I did all of it on my way east.', '这些事，我在往东走的路上都办完了。') },
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
    { n: 100, on: { all: [{ talk: 'giver' }, { objectives: ['oil', 'bloom', 'bell'] }] }, done: ['back'], take: [{ match: { type: 'item/vessel/flask/oil' }, count: 2 }, { match: { type: 'item/material/herb' }, count: 3 }], complete: true, say: L('The lamps are trimmed, and the bell has been rung. Thank you for going so far for us. ...And this time I did not lose a single wick. Tonight after dark Firstlight gives thanks at the flame. Please stay for it.', '灯都备好了，钟也敲过了。辛苦你走了这么远的路。……这一回，我一根灯芯也没有弄丢。今晚天黑以后，初原村要在圣火前感恩，请你也留下来。'), reward: { xp: 50, items: [setPiece('item/clothing/cloak/vigil', 'vigil')], facts: { 'ch1.vigil': 1 }, regard: { giver: 15 } }, log: L('Everything for the vigil is ready. Tonight the village gives thanks at the flame.', '守夜的东西备齐了。今晚全村要在圣火前感恩。') },
    { n: 105, on: { all: [PAST_KNIGHT, { objectives: ['oil', 'bloom', 'bell'] }] }, take: [{ match: { type: 'item/vessel/flask/oil' }, count: 2 }, { match: { type: 'item/material/herb' }, count: 3 }], complete: true, reward: { xp: 50, items: [setPiece('item/clothing/cloak/vigil', 'vigil')], facts: { 'ch1.vigil': 1 }, regard: { giver: 15 } }, log: L('I went east before the vigil, but I had brought everything. Sister Ilse took the oil and the dawnbloom all the same.', '守夜没赶上，但东西我都带回来了。伊尔丝修女还是收下了灯油和晨光花。') },
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
    // each wayside shrine (the demo's): optional, as its map is seldom loaded when the quest begins; named, it is itself
    ...Object.fromEntries(WAYSHRINES.map((w) => [`shrine_${w.id}`, { id: `way.shrine.${w.id}`, optional: true }])),
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
    ...WAYSHRINES.map((w, i) => ({ id: SHRINES[i], text: L(`Light the ${w.name.en} with ${w.asks.en}`, `点亮${w.name.zh}（献上${w.asks.zh}）`), target: [`shrine_${w.id}`, 'way'], on: { fact: { [shrineFact(w.id)]: 1 } } })),
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

// ------------------------------------------------------------------ Chapter 2: Emberfall and the dragon (docs/chapter-2.md, docs/main-quest.md)

const dragonRoad: QuestDef = {
  id: 'dragon_road',
  kind: 'main',
  title: L('The Dragon Road', '屠龙之路'),
  summary: L('The Crown is home, and the road east is open. The Second Seal-bearer is said to be in the Scarred March, over Cinder Pass beyond Emberfall.', '荆棘冠送回去了，往东的路也通了。听说第二位持印者在赤痕边境，要翻过余烬镇后面的烬岭山道才到得了。'),
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
    { n: 10, show: ['road'], hint: L("The road on east is open. Follow the Sunrise Road past the knight's field to Emberfall.", '往东的路通了。沿着朝阳大道走过骑士的田野，就到余烬镇。'), log: L('I took the road east, toward Emberfall. The Second Seal-bearer is somewhere beyond it, in the Scarred March.', '我沿着大路往东，朝余烬镇走去。第二位持印者在它更东边的赤痕边境。') },
    { n: 20, on: { step: 'emberfall_arrival' }, done: ['road'], show: ['mara'], hint: L('Mara is the elder of Emberfall. Ask her about the smoke on the hills, and the way over the pass.', '玛拉是余烬镇的长老。去问问她，山上的烟是怎么回事，还有翻山的路。'), log: L('Half the roofs in Emberfall are new thatch. The rest are still black from the fire.', '余烬镇一半的屋顶是新铺的茅草，另一半还是烧黑的。') },
    { n: 30, on: { fact: { 'mq.council': 1 } }, done: ['mara'], show: ['ore', 'coal', 'fireweed', 'frostcap', 'blade', 'draught'], hint: L('Garrick the smith will forge a blade if you bring him 5 iron ore and 3 coal; there are veins in the Embervein Mine north of town, and a pickaxe breaks them. Wren the herbalist will brew a fireproof draught from 3 fireweed, which grows around Firstlight Village, and 3 frostcap from Hushwood. Give them what they ask for with {key:put}, then talk to them with {key:hands}.', '铁匠加里克说，给他 5 块铁矿石和 3 块煤，他就能锻一把剑。镇北的烬脉旧矿里有矿脉，用镐能敲开。草药师雷恩说，有 3 株火焰草和 3 朵霜盖菇，她就能熬防火的药；火焰草长在初原村一带，霜盖菇长在噤声林里。按 {key:put} 把东西交给他们，再按 {key:hands} 和他们说话。'), log: L('Mara says a dragon came down onto Cinder Peak when the nights grew long, and nobody has crossed the pass since. Garrick can forge a blade that will cut its hide, and Wren can brew a draught against its fire.', '玛拉说，夜晚变长以后，有一头魔龙落到了烬峰上，从那以后再没人翻过山道。加里克能锻一把砍得进龙皮的剑，雷恩能熬一种挡得住龙火的药。') },
    { n: 40, on: { step: 'ready' }, done: ['ore', 'coal', 'fireweed', 'frostcap', 'blade', 'draught'], show: ['pass'], hint: L('Climb the pass east of Emberfall to the dragon\'s lair. Drink the fireproof draught before you go in.', '翻过余烬镇东边的山道，就是魔龙的巢穴。进去之前，先喝下防火药剂。'), log: L('I have Dragonsbane and the draughts. The pass east of town climbs to Cinder Peak.', '屠龙剑和药剂都拿到了。镇子东边的山道一直通到烬峰。') },
    { n: 50, on: { step: 'lair_gate' }, done: ['pass'], show: ['dragon'], hint: L('The dragon breathes fire in a straight line; keep out of it, and watch for its whelps. Left click swings your weapon.', '魔龙会朝一条直线喷火，别站在那条线上，也要留心它的幼龙。左键挥动武器。'), log: L('Heat, and the smell of scorched stone. Something huge is breathing in the dark.', '一股热浪，还有烧焦的石头味。黑暗里有个巨大的东西在呼吸。') },
    { n: 100, on: { fact: { 'mq.dragon': 1 } }, done: ['road', 'mara', 'pass', 'dragon'], complete: true, reward: { xp: 100, regard: { mara: 20, smith: 15, herbalist: 15 }, karma: 10 }, hint: L('The dragon is dead. The way down off the south side of Cinder Pass, into the Scarred March, is open.', '魔龙死了。烬岭山道南边下到赤痕边境的路通了。'), log: L('The dragon is dead. Emberfall can sleep at night again, and the way over the pass into the Scarred March is open.', '魔龙死了。余烬镇的人晚上又能睡安稳觉了，翻过山道去赤痕边境的路也通了。') },
  ],
  // Chapter 2's first half (docs/chapter-2.md), begun once the Crown is home and the road east is open
  start: { auto: { all: [{ done: 'crown_home' }, { fact: { [CHAPTER_TWO]: 1 } }] } },
}
void BLADE

// ------------------------------------------------------------------ Chapter 2: the Scarred March (docs/chapter-2.md)

/** Matthias is down: what comes before him in the March is behind you. */
const PAST_MATTHIAS: QuestTrigger = { fact: { [CH2.matthias]: { ne: 0 } } }

/**
 * Over the pass into the March, once the dragon is dead: the camp of the Red Host and its captain, the dusk on the
 * Lashmarks, the Scourging House and what runs under it, the War-Giver's Bastion, and Matthias in the Pillar Yard.
 * Nothing waits on the step before it: whatever the pilgrim skips is done once he falls.
 */
const secondSeal: QuestDef = {
  id: 'second_seal',
  kind: 'main',
  title: L('The Second Seal', '第二印'),
  summary: L('The Second Seal-bearer is in the Scarred March, south of Cinder Pass. With the dragon dead, the way down is open.', '第二位持印者在烬岭山道南边的赤痕边境。魔龙死了，下山的路通了。'),
  aliases: {
    march: { place: 'lashmarks' },
    camp: { place: 'redcamp' },
    brannoc: { id: 'npc.brannoc', essential: true },
    prior: { id: 'npc.lucan', essential: true },
    undercroft: { place: 'scourgehouse.undercroft' },
    bastion: { place: 'bastion' },
    matthias: { id: MATTHIAS_ID, optional: true },
  },
  objectives: [
    { id: 'down', text: L('Go down off the south side of Cinder Pass into the Scarred March', '从烬岭山道南边下到赤痕边境'), target: 'march', on: { fact: { [CH2.march]: 1 } } },
    { id: 'camp', text: L('Find the camp of the Red Host, east of the Lashmarks', '找到鞭痕原东边的赤旗营'), target: 'camp', on: { enter: 'redcamp' } },
    {
      id: 'brannoc',
      text: L('Speak with Captain Brannoc of the Left Company', '和左营的布兰诺克队长谈谈'),
      target: 'brannoc',
      talk: true,
      on: { talk: 'brannoc' },
      say: L("The Church sent you to the Rider? He is in the Bastion, past the Scourging House, east of here. He sees those who have fought at his dusk. The Left and the Right meet on the Lashmarks every evening, from six until eight. Come and see what we are. Then go to him.", '教会派你来见骑者？他在堡垒里，从这儿往东，过了鞭笞院就是。打过他那场黄昏的人，他才肯见。左营和右营每天傍晚六点到八点在鞭痕原上碰头。先来看看我们是什么样子，再去找他。'),
    },
    { id: 'dusk', text: L('Be on the Lashmarks at dusk, between six and eight in the evening', '傍晚六点到八点之间，到鞭痕原上去'), target: 'march', on: { fact: { [CH2.dusk]: 1 } } },
    {
      id: 'prior',
      text: L('Speak with Prior Lucan in the Scourging House, east of the camp', '到营地东边的鞭笞院，和卢坎院长谈谈'),
      target: 'prior',
      talk: true,
      on: { talk: 'prior' },
      say: L('A pilgrim of the Five. Be welcome. You have come to the Rider, so you have come to the happiest country on earth: under him no one suffers. The brothers here take strokes for him at dusk, so that he carries a little less. If you would see where our offering goes, the stair is behind the altar.', '五苦的朝圣者，欢迎你。你是来见骑者的，那你就是来到了世上最有福的地方：在他治下，没有人受苦。这里的修士每到黄昏替他受鞭，好让他少担一点。你要是想看看我们的献祭流到哪里去，楼梯就在祭坛后面。'),
    },
    { id: 'undercroft', text: L("Go down the stair behind the altar of the Scourging House's hall", '从鞭笞院大厅祭坛后面的楼梯下去'), target: 'undercroft', on: { fact: { [CH2.channels]: 1 } } },
    { id: 'bastion', text: L("Go to the War-Giver's Bastion, east of the Scourging House", '去鞭笞院东边的赐战者堡垒'), target: 'bastion', on: { fact: { [CH2.bastion]: 1 } } },
    { id: 'matthias', text: L('Bring down Matthias the War-Giver in the Pillar Yard', '在刑柱庭打倒赐战者·马提亚'), target: 'matthias', on: PAST_MATTHIAS },
  ],
  stages: [
    { n: 10, show: ['down'], hint: L("The way down into the Scarred March leaves Cinder Pass from its south side, below the lair's trail.", '下到赤痕边境的路，在烬岭山道南边，龙巢那条山路的下方。'), log: L('With the dragon dead, the way down off the pass is open. Odran in Emberfall says that over there I will not feel my cuts.', '魔龙死了，下山的路通了。余烬镇的奥德兰说，到了那边，身上划了口子也不会觉得疼。') },
    { n: 20, on: { fact: { [CH2.march]: 1 } }, done: ['down'], show: ['camp'], hint: L('The road runs east across the Lashmarks to the camp of the Red Host.', '大路往东穿过鞭痕原，通到赤旗营。'), log: L('The ground on this side of the pass is red, and cut by long ravines. A briar caught my arm on the way down. It bled, and I felt nothing.', '山这边的地是红的，被一道道长沟割开。下山的时候，我的胳膊被荆棘划了一下。流了血，可一点也不疼。') },
    { n: 30, on: { enter: 'redcamp' }, from: [20], done: ['camp'], show: ['brannoc'], hint: L('Captain Brannoc commands the Left Company. He is by the war hall; speak to him with {key:hands}.', '布兰诺克队长统领左营，他在军议厅附近。按 {key:hands} 和他说话。'), log: L('A man walked into the camp ahead of me with an arrow through his shoulder, and asked what was for supper.', '一个人走在我前面进了营地，肩膀上穿着一支箭，开口问今晚吃什么。') },
    { n: 40, on: { objectives: ['brannoc'] }, done: ['brannoc'], show: ['dusk', 'prior'], reward: { facts: { [CH2.camp]: 1 } }, hint: L('The companies meet on the Lashmarks between six and eight in the evening. The Scourging House of the Red Order is east of the camp.', '两营每天傍晚六点到八点在鞭痕原上交战。红衣修会的鞭笞院在营地东边。'), log: L('Brannoc says the Rider is in the Bastion beyond the Scourging House. The Left and the Right Companies fight each other every dusk, and have for sixty-one years.', '布兰诺克说，骑者在鞭笞院再过去的堡垒里。左营和右营每天黄昏都要互相厮杀，已经打了六十一年。') },
    { n: 50, on: { objectives: ['dusk', 'prior'] }, from: [40], done: ['dusk', 'prior'], show: ['undercroft', 'bastion'], reward: { facts: { [CH2.house]: 1 }, xp: 40 }, hint: L("The stair down is behind the altar in the Scourging House's hall. The War-Giver's Bastion is east of the Scourging House.", '下去的楼梯在鞭笞院大厅的祭坛后面。赐战者堡垒在鞭笞院东边。'), log: L('At dusk the two companies charged each other under the same banner. A man was killed on his feet, and nobody noticed but the surgeon.', '黄昏时，两个营扛着同样的军旗冲向对方。有个人站着就死了，除了军医，谁也没发觉。') },
    { n: 60, on: { objectives: ['undercroft', 'bastion'] }, from: [50], done: ['undercroft', 'bastion'], show: ['matthias'], hint: L("The Pillar Yard is through the fog at the Bastion's inner gate. Watch the ground for where his blows will land, and step out of the way.", '刑柱庭就在堡垒内门的雾门后面。留意地上标出的他要打下来的地方，及时躲开。'), log: L('Under the Scourging House, red channels run west under the wall. The grey man was down there. He said that if I followed them to the end I would be in the Holy City.', '鞭笞院底下，一道道红色的沟槽从墙根下往西流。灰衣人也在下面。他说，顺着它们一直走到头，就是圣城。') },
    { n: 100, on: PAST_MATTHIAS, done: ['down', 'camp', 'brannoc', 'dusk', 'prior', 'undercroft', 'bastion', 'matthias'], complete: true, reward: { xp: 120, karma: 8, regard: { brannoc: 15 } }, log: L('Matthias let go of the threads. He gave me the Chain of the Scourging Post, and died against the post.', '马提亚松开了那些线。他把鞭刑柱之链交给我，靠着刑柱死去了。') },
  ],
  start: { auto: { done: 'dragon_road' } },
}

/** Back to the camp of the Red Host after Matthias: the quiet dusk, and the chapter's card. */
const marchQuiet: QuestDef = {
  id: 'march_quiet',
  kind: 'main',
  title: L('The Quiet Dusk', '安静的黄昏'),
  summary: L('When Matthias fell, the cries started all across the March. Go back to the camp of the Red Host.', '马提亚倒下的时候，整片边境都喊了起来。回赤旗营去看看。'),
  aliases: { camp: { place: 'redcamp' } },
  objectives: [{ id: 'camp', text: L('Go back to the camp of the Red Host after the sun goes down', '太阳落山以后，回到赤旗营'), target: 'camp', on: { fact: { [CH2.end]: 1 } } }],
  stages: [
    { n: 10, show: ['camp'], hint: L('The camp of the Red Host is west of the Scourging House. The sun goes down earlier now.', '赤旗营在鞭笞院西边。如今太阳落得更早了。'), log: L('I carry the Chain now. The grey man drew the rest of the seal\'s light into his lantern and went east, through the fog.', '鞭刑柱之链现在由我带着。灰衣人把剩下的光收进他的灯里，穿过雾门往东去了。') },
    { n: 100, on: { fact: { [CH2.end]: 1 } }, done: ['camp'], complete: true, reward: { xp: 40 }, log: L('The camp lies in rows, feeling sixty-one years of wounds. The surgeon has work at last. The sun went down at seven.', '营地里的人一排排躺着，六十一年的伤一下子全回来了。军医终于有活干了。太阳七点就落了山。') },
  ],
  start: { auto: { done: 'second_seal' } },
}

// ------------------------------------------------------------------ Chapter 3: the Vale of Scales (docs/chapter-3.md)

/** Down the grain road into the Vale, once the March is quiet: Fairweight and its weighing day. */
const grainRoad: QuestDef = {
  id: 'grain_road',
  kind: 'main',
  title: L('The Grain Road', '运粮路'),
  summary: L('The Vale of Scales has sent the Red Host no grain for three seasons. The Third Seal-bearer is there, south and east along the grain road from the camp.', '衡谷平原已经三季没给赤军送粮了。第三位持印者就在那边，从营地顺着运粮路往东南走。'),
  aliases: { road: { place: 'chaffroad' }, town: { place: 'fairweight' } },
  objectives: [
    { id: 'road', text: L("Take the grain road from the camp's south gate into the Vale of Scales", '从赤旗营南门出发，走运粮路去衡谷平原'), target: 'road', on: { fact: { [CH3.road]: 1 } } },
    { id: 'town', text: L('Go on to Fairweight, the market town of the Vale', '继续走到衡谷的集镇公秤镇'), target: 'town', on: { enter: 'fairweight' } },
    { id: 'weighing', text: L("See the weighing on Fairweight's square", '去看公秤镇广场上的过秤'), target: 'town', on: { fact: { [CH3.weighing]: 1 } } },
  ],
  stages: [
    { n: 10, show: ['road'], hint: L("The grain road leaves the camp of the Red Host by its south gate.", '运粮路从赤旗营的南门出去。'), log: L('Brannoc says the Vale of Scales stopped sending grain three seasons ago. The Third Seal-bearer is there.', '布兰诺克说，衡谷平原三季以前就不再送粮了。第三位持印者在那里。') },
    { n: 20, on: { fact: { [CH3.road]: 1 } }, done: ['road'], show: ['town'], hint: L('The road runs east to Fairweight.', '大路往东通到公秤镇。'), log: L('Eight days on the grain road. The fields along it are dead, and a man was working one at noon by lantern light.', '在运粮路上走了八天。路两边的田都死了，有个人大中午提着灯在地里干活。') },
    { n: 30, on: { enter: 'fairweight' }, from: [20], done: ['town'], show: ['weighing'], hint: L('Something is happening on the square, by the great scale before the weigh-house.', '广场上，称量所门前的大秤那里，有事情正在发生。'), log: L('Fairweight. Everything here is weighed, they say, even the people.', '公秤镇。听说这里什么都要过秤，连人也一样。') },
    { n: 100, on: { fact: { [CH3.weighing]: 1 } }, done: ['road', 'town', 'weighing'], complete: true, reward: { xp: 60 }, log: L('A widow stood in the great pan, and the Weighmaster set the Church\'s black weight in the other. Her pan rose. They called her light, and she smiled.', '一个寡妇站进大秤盘里，称量官在另一只盘里放上教会的黑秤砣。她那边升了起来。大家说她轻了，她笑了。') },
  ],
  start: { auto: { fact: { [CHAPTER_THREE]: 1 } } },
}

/** Ele is down: what comes before them in the Vale is behind you. */
const PAST_ELE: QuestTrigger = { fact: { [CH3.ele]: { ne: 0 } } }

/** The Vale and its seal: the poorhouse, the White Pans, the Black Balance and its ledger, Ele on the Scale Floor. */
const thirdSeal: QuestDef = {
  id: 'third_seal',
  kind: 'main',
  title: L('The Third Seal', '第三印'),
  summary: L('The Third Seal-bearer is Ele, the Priest of the Black Scales, in the Black Balance beyond the White Pans. Those the scale finds light no longer hunger.', '第三位持印者是黑衡司铎·厄勒，在白盐滩那边的黑衡殿里。被大秤称出来轻了的人，从此不再挨饿。'),
  aliases: {
    maud: { id: 'npc.berthe', essential: true },
    pans: { place: 'saltpans' },
    balance: { place: 'blackbalance' },
    counting: { place: 'blackbalance.counting' },
    ele: { id: ELE_ID, optional: true },
  },
  objectives: [
    {
      id: 'maud',
      text: L('Speak with Sister Berthe at the poorhouse', '去济贫院和贝尔特修女谈谈'),
      target: 'maud',
      talk: true,
      on: { talk: 'maud' },
      say: L('You saw the weighing. They will tell you it is mercy, and the ones it takes will tell you so too, smiling. Hunger is how the body asks to live. Take it away and the body stops asking. Go out onto the White Pans, east, and look at them standing there. Then tell me it is mercy.', '你看见过秤了。他们会跟你说那是慈悲，被它带走的人也会笑着这么说。饿，是身子在求着活下去。把饿拿走，身子就不求了。你往东走，到白盐滩上去，看看站在那儿的那些人。然后再来跟我说，那是不是慈悲。'),
    },
    { id: 'pans', text: L('Go out onto the White Pans, east of Fairweight', '到公秤镇东边的白盐滩去'), target: 'pans', on: { fact: { [CH3.pans]: 1 } } },
    { id: 'balance', text: L('Go on to the Black Balance, beyond the White Pans', '继续往前，到白盐滩那边的黑衡殿去'), target: 'balance', on: { fact: { [CH3.balance]: 1 } } },
    { id: 'ledger', text: L("Find the Black Balance's counting room", '找到黑衡殿的账房'), target: 'counting', on: { fact: { [CH3.ledger]: 1 } } },
    { id: 'ele', text: L('Bring down Ele, the Priest of the Black Scales, on the Scale Floor', '在衡台打倒黑衡司铎·厄勒'), target: 'ele', on: PAST_ELE },
  ],
  stages: [
    { n: 10, show: ['maud'], hint: L('The poorhouse is on the south side of the square. Sister Berthe keeps it.', '济贫院在广场南边，是贝尔特修女管着的。'), log: L('The Lightened feel no hunger and need no sleep. They work the dead fields day and night. Sister Berthe at the poorhouse will not let her children near the scale.', '被称轻了的人不觉得饿，也不用睡觉，没日没夜地在死田里干活。济贫院的贝尔特修女不让她的孩子靠近那杆秤。') },
    { n: 20, on: { objectives: ['maud'] }, done: ['maud'], show: ['pans'], reward: { facts: { [CH3.maud]: 1 } }, hint: L('The White Pans are east of Fairweight, out along the road.', '白盐滩在公秤镇东边，顺着大路走就到。'), log: L('Berthe says hunger is how the body asks to live. She told me to go out onto the White Pans and look.', '贝尔特说，饿是身子在求着活下去。她让我到白盐滩上去看看。') },
    { n: 30, on: { fact: { [CH3.pans]: 1 } }, from: [20], done: ['pans'], show: ['balance'], hint: L('The Black Balance stands beyond the White Pans, east.', '黑衡殿在白盐滩再往东的地方。'), log: L('The Lightened stand on the salt in rows, facing the Black Balance, until the wind takes them. One of them went to dust while I watched.', '被称轻的人一排排站在盐滩上，脸朝着黑衡殿，一直站到被风吹走。有一个就在我眼前化成了灰。') },
    { n: 40, on: { fact: { [CH3.balance]: 1 } }, from: [30], done: ['balance'], show: ['ledger'], hint: L('The counting room is in the Black Balance\'s west range, through the door on the court.', '账房在黑衡殿的西厢，从院子里那扇门进去。'), log: L('The Black Balance. Its clerks are still at their desks. They are not alive.', '黑衡殿。里面的书记官还坐在桌前。他们已经不是活人了。') },
    { n: 50, on: { fact: { [CH3.ledger]: 1 } }, from: [40], done: ['ledger'], show: ['ele'], hint: L("The Scale Floor is through the fog at the end of the Black Balance's court. Watch where the great pan will come down, and step out from under it.", '衡台就在黑衡殿院子尽头的雾门后面。看清大秤盘要落下的地方，从底下躲开。'), log: L('Ele\'s ledger has five columns, one for each seal, and every total is carried to one account: the Hall\'s. The grey man was there before me. "Something there is eating," he said.', '厄勒的账簿有五栏，一印一栏，每一栏的总数都转进同一个账户：大殿的。灰衣人比我先到。“那里有什么东西在吃。”他说。') },
    { n: 100, on: PAST_ELE, done: ['maud', 'pans', 'balance', 'ledger', 'ele'], complete: true, reward: { xp: 150, karma: 8 }, log: L('Ele was hungry for the first time in three hundred years, and did not know the feeling. They gave me the Scale of Hunger.', '厄勒三百年来头一回饿了，却认不出这是什么感觉。他把饥刑之秤交给了我。') },
  ],
  start: { auto: { done: 'grain_road' } },
}

/** Back to Fairweight after Ele: the Lightened hungry again, the granary sealed for the Church; the supper, and the chapter's card. */
const granary: QuestDef = {
  id: 'granary',
  kind: 'main',
  title: L('The Granary', '粮仓'),
  summary: L('When Ele fell, the scale tipped. Go back to Fairweight.', '厄勒倒下的时候，大秤翻了。回公秤镇去看看。'),
  aliases: { town: { place: 'fairweight' }, ottilie: { id: 'npc.ottilie', essential: true } },
  objectives: [
    { id: 'town', text: L('Go back to Fairweight', '回公秤镇去'), target: 'town', on: { fact: { [CH3.hunger]: 1 } } },
    {
      id: 'ottilie',
      text: L('Ask Guildmistress Ottilie for the granary\'s key', '向奥蒂莉会长要粮仓的钥匙'),
      target: 'ottilie',
      talk: true,
      optional: true,
      on: { talk: 'ottilie' },
      say: L('The grain is weighed and owed to the Holy City. It is not mine to give. ...But the scale is broken, and the Church\'s carts have not come in three seasons. Take the key. I will say you took it from me.', '这些粮食过了秤，是欠圣城的，不是我能送人的。……可是大秤已经坏了，教会的车也三季没来了。钥匙你拿去吧。我就说，是你从我手里抢走的。'),
    },
    { id: 'open', text: L('Open the Grain Guild\'s granary, by its key or by breaking its doors', '打开谷物行会的粮仓：用钥匙，或者把门砸开'), target: 'town', on: { fact: { [CH3.granary]: 1 } } },
    { id: 'supper', text: L('Be in Fairweight when the sun goes down', '太阳落山时待在公秤镇'), target: 'town', on: { fact: { [CH3.end]: 1 } } },
  ],
  stages: [
    { n: 10, show: ['town'], hint: L('Fairweight is west of the White Pans.', '公秤镇在白盐滩西边。'), log: L('I carry the Scale of Hunger now. The grey man took the rest of the seal\'s light. "Three," he said, and coughed ash.', '饥刑之秤现在由我带着。灰衣人收走了剩下的光。“第三道。”他说完，咳出了灰。') },
    { n: 20, on: { fact: { [CH3.hunger]: 1 } }, done: ['town'], show: ['ottilie', 'open'], hint: L('The granary is on the north side of the square. Guildmistress Ottilie keeps its key at the guild hall; or the doors can be broken down.', '粮仓在广场北边。钥匙在行会会馆的奥蒂莉会长手里；不然，门也砸得开。'), log: L('The Lightened are hungry again, all of them at once. The Grain Guild\'s granary is full, and sealed for the Church\'s carts.', '被称轻的人又饿了，所有人一下子全饿了。谷物行会的粮仓是满的，封着等教会的车来拉。') },
    { n: 30, on: { objectives: ['ottilie'] }, from: [20], done: ['ottilie'], reward: { items: [{ type: 'item/key/granary', count: 1 }] }, log: L('Ottilie gave me the granary\'s key. She will say I took it from her.', '奥蒂莉把粮仓的钥匙给了我。她会说是我抢的。') },
    { n: 40, on: { fact: { [CH3.granary]: 1 } }, from: [20, 30], done: ['open'], show: ['supper'], hint: L('The sun goes down early now. Wait in Fairweight for the evening.', '如今太阳落得早。在公秤镇等到傍晚吧。'), log: L('The granary is open. Sister Berthe has her kettles out on the square.', '粮仓打开了。贝尔特修女把她的锅都搬到了广场上。') },
    { n: 100, on: { fact: { [CH3.end]: 1 } }, done: ['town', 'open', 'supper'], complete: true, reward: { xp: 60, regard: { ottilie: 10 } }, log: L('The whole town ate on the square. Corwin tasted bread and said his wife\'s name. The sun went down at six.', '全镇的人在广场上吃了饭。科温尝到了面包，说出了他妻子的名字。太阳六点就落了山。') },
  ],
  start: { auto: { done: 'third_seal' } },
}

// ------------------------------------------------------------------ Chapter 4: the Pale Fens (docs/chapter-4.md)

/** Down the fen road from Fairweight: the Long Causeway, Nailgate and its kept dead, Nessa's two columns. */
const fenRoad: QuestDef = {
  id: 'fen_road',
  kind: 'main',
  title: L('The Fen Road', '林沼之路'),
  summary: L('The Fourth Seal-bearer is in the Pale Fens, south of the Vale, where the dusk hardly lifts. Nessa Quill went ahead.', '第四位持印者在衡谷以南的苍白林沼，那里的黄昏几乎从不散去。奈莎·奎尔先去了。'),
  aliases: { road: { place: 'causeway' }, village: { place: 'nailgate' }, chapel: { place: 'nailgate.chapel' } },
  objectives: [
    { id: 'road', text: L("Take the fen road south from Fairweight's fields", '从公秤镇的田地往南，走林沼之路'), target: 'road', on: { fact: { [CH4.road]: 1 } } },
    { id: 'village', text: L('Follow the Long Causeway to Nailgate', '沿着长堤走到钉门村'), target: 'village', on: { fact: { [CH4.kept]: 1 } } },
    { id: 'nessa', text: L("Find Nessa Quill in Nailgate's chapel", '在钉门村的礼拜堂找到奈莎·奎尔'), target: 'chapel', on: { fact: { [CH4.nessa]: 1 } } },
  ],
  stages: [
    { n: 10, show: ['road'], hint: L("The fen road leaves Fairweight by the track south through its fields.", '林沼之路从公秤镇南边的田间小道出去。'), log: L('The Scale is mine now. The grey man said to come to the Fens when I had the Nails. Nessa went ahead of me.', '饥刑之秤现在归我了。灰衣人说，等我拿到圣钉就去林沼。奈莎已经先去了。') },
    { n: 20, on: { fact: { [CH4.road]: 1 } }, done: ['road'], show: ['village'], hint: L('The causeway runs south across the black water to Nailgate.', '长堤往南穿过黑水，通到钉门村。'), log: L('Five days into the fens. On the last two the sun did not come up. The graves along the causeway are nailed.', '进林沼走了五天。最后两天太阳没有升起来。长堤边的坟都钉着钉子。') },
    { n: 30, on: { fact: { [CH4.kept]: 1 } }, from: [20], done: ['village'], show: ['nessa'], hint: L("Nessa is in the chapel, on the walk south of the landing.", '奈莎在礼拜堂里，就在渡口南边的栈道上。'), log: L('In Nailgate the dead come home and are kept. A nail in the doorpost for each one. Piet\'s wife has been dead eleven years, and set the table for me.', '在钉门村，死去的人会回家，家里人就把他们留下。留一个，门柱上钉一颗钉子。皮特的妻子死了十一年，还给我摆了餐具。') },
    { n: 100, on: { fact: { [CH4.nessa]: 1 } }, done: ['road', 'village', 'nessa'], complete: true, reward: { xp: 80 }, log: L('Nessa laid her sunset table beside the Church\'s own chronicle of the Holy Body. Every night the sun set early, the Body grew warmer. The same days. They have been writing it down.', '奈莎把她的日落表和教会自己记的圣尸纪事并排放在一起。太阳每早落一次，圣尸就暖和一分。日子一天不差。他们一直在记。') },
  ],
  start: { auto: { fact: { [CHAPTER_FOUR]: 1 } } },
}

/** Nacht is down: what comes before him in the Fens is behind you. */
const PAST_NACHT: QuestTrigger = { fact: { [CH4.nacht]: { ne: 0 } } }

/** The Fens and their seal: the Rider at dusk, the Ossuary and the Shroud, Severin's word; Nacht at the Ford of the Dead. */
const fourthSeal: QuestDef = {
  id: 'fourth_seal',
  kind: 'main',
  title: L('The Fourth Seal', '第四印'),
  summary: L('The Fourth Seal-bearer is Nacht, Reinholder of Death, at the Ford of the Dead beyond the Ossuary of the Holy Wood. He rides the causeways at dusk.', '第四位持印者是死之执辔者·纳赫特，在圣木骨堂那边的亡者渡。每到黄昏，他就骑马巡游各条长堤。'),
  aliases: { graves: { place: 'drowned' }, isle: { place: 'boneisle' }, reliquary: { place: 'boneisle.reliquary' }, nacht: { id: NACHT_ID, optional: true } },
  objectives: [
    { id: 'rider', text: L('Be in the Drowned Graves at dusk, between five and eight in the evening', '傍晚五点到八点之间，到沉墓地去'), target: 'graves', on: { fact: { [CH4.rider]: 1 } } },
    { id: 'isle', text: L('Cross to the Ossuary of the Holy Wood, east of the Drowned Graves', '过到沉墓地东边的圣木骨堂'), target: 'isle', on: { enter: 'boneisle' } },
    { id: 'shroud', text: L("Go into the Ossuary's reliquary", '走进骨堂的圣髑室'), target: 'reliquary', on: { fact: { [CH4.shroud]: 1 } } },
    { id: 'nacht', text: L('Bring down Nacht, Reinholder of Death, at the Ford of the Dead', '在亡者渡打倒死之执辔者·纳赫特'), target: 'nacht', on: PAST_NACHT },
  ],
  stages: [
    { n: 10, show: ['rider', 'isle'], hint: L('The Drowned Graves are south of Nailgate. The Ossuary of the Holy Wood stands on its island east of them.', '沉墓地在钉门村南边。圣木骨堂在它东边的岛上。'), log: L('Nessa says the Rider gathers the wandering dead along the causeways every dusk, and nails them back to their houses.', '奈莎说，骑者每到黄昏就沿着长堤收拢游荡的死人，把他们钉回各自的家里。') },
    { n: 20, on: { enter: 'boneisle' }, from: [10], done: ['isle'], show: ['shroud'], hint: L("The reliquary is the chapel in the middle of the island.", '圣髑室就是岛中央的那座礼拜堂。'), log: L('The Ossuary of the Holy Wood. Bones in the walls, and the dead who keep them.', '圣木骨堂。墙里砌着骨头，守着它们的也是死人。') },
    { n: 30, on: { fact: { [CH4.shroud]: 1 } }, from: [20], done: ['shroud'], show: ['nacht'], hint: L('The Ford of the Dead is through the fog under the arch at the island\'s east end. Watch for where the nails will fall, and keep out of the dead\'s hands.', '亡者渡就在岛东头拱门下的雾门后面。看清钉子要落下的地方，别踩进亡者的手里。'), log: L('The Shroud that carried the First Martyr to the Holy City was white. It is black, and the black moves. The grey man says he is waking, and that I am carrying him his limbs. I believe him.', '把初殉者送往圣城的那块裹尸布，原本是白的。如今它是黑的，那片黑还在动。灰衣人说，他正在醒来，而我是在给他送去他的四肢。我信他。') },
    { n: 100, on: PAST_NACHT, done: ['rider', 'isle', 'shroud', 'nacht'], complete: true, reward: { xp: 180, karma: 8 }, log: L('Nacht let go of the reins. "Then go. All of you." He gave me the Holy Wood of the Nails, and his horse walked into the river.', '纳赫特松开了缰绳。“那就走吧。你们所有人。”他把钉刑圣木交给我，他的马走进了河里。') },
  ],
  start: { auto: { done: 'fen_road' } },
}

/** Back to Nailgate after Nacht: the dead lie down, the ferry goes out, and the chapter's card. */
const ferry: QuestDef = {
  id: 'ferry',
  kind: 'main',
  title: L('The Ferry', '渡船'),
  summary: L('When Nacht let go of the reins, the bells stopped all across the Fens. Go back to Nailgate.', '纳赫特松开缰绳的时候，整片林沼的铃声都停了。回钉门村去。'),
  aliases: { village: { place: 'nailgate' } },
  objectives: [{ id: 'village', text: L('Go back to Nailgate after the sun goes down', '太阳落山以后，回到钉门村'), target: 'village', on: { fact: { [CH4.end]: 1 } } }],
  stages: [
    { n: 10, show: ['village'], hint: L('Nailgate is north of the Drowned Graves. The sun goes down at five now.', '钉门村在沉墓地北边。如今太阳五点就落了。'), log: L('I carry the Holy Wood now. The grey man could not take the rest alone; I put my hand on the lantern with his. We go on together.', '钉刑圣木现在由我带着。灰衣人一个人收不下剩下的光，我把手和他一起放在了灯上。我们一起往前走。') },
    { n: 100, on: { fact: { [CH4.end]: 1 } }, done: ['village'], complete: true, reward: { xp: 60 }, log: L('The dead lay down where they stood, all across the Fens. Klaas\'s boat went out full. Old Hedda died in her bed, and was glad. The sun went down at five.', '整片林沼的死人都在原地躺下了。克拉斯的船满载着出去了。老海达死在自己床上，走得很欢喜。太阳五点就落了山。') },
  ],
  start: { auto: { done: 'fourth_seal' } },
}

// ------------------------------------------------------------------ Chapter 5: the White Altar Heights (docs/chapter-5.md)

/** West with Severin out of the Fens: the White Stair, Whiteveil Abbey and its abbot. */
const whiteStair: QuestDef = {
  id: 'white_stair',
  kind: 'main',
  title: L('The White Stair', '白阶'),
  summary: L('The Fifth Seal-bearer is under an altar in the White Altar Heights, west of the Holy City. Severin goes with you now.', '第五位持印者在圣城以西的白坛高地，在一座祭坛底下。塞弗林如今和你同行。'),
  aliases: { stair: { place: 'whitestair' }, abbey: { place: 'whiteveil' }, abbot: { id: 'npc.benedek', essential: true } },
  objectives: [
    { id: 'road', text: L("Take the road west from Nailgate's west walk into the Heights", '从钉门村西边的栈道出发，往西进入高地'), target: 'stair', on: { fact: { [CH5.road]: 1 } } },
    { id: 'abbey', text: L('Climb the White Stair to Whiteveil Abbey', '登上白阶，到白纱修道院去'), target: 'abbey', on: { enter: 'whiteveil' } },
    {
      id: 'abbot',
      text: L('Speak with Abbot Benedek', '和本尼德克院长谈谈'),
      target: 'abbot',
      talk: true,
      on: { talk: 'abbot' },
      say: L('A pilgrim with four instruments. Then the road has brought you to us, as it brings them all. Be welcome. We keep the ones who did not finish it: every pilgrim of four hundred years who fell on the way. If you would know what you have been walking, the roll is in the robing house. Sister Agathe will show you.', '一个带着四件圣器的朝圣者。那么，是这条路把你带到了我们这里，就像它把所有人带来一样。欢迎你。我们守着那些没有走完的人：四百年来倒在路上的每一个朝圣者。你要是想知道自己一直走的是什么路，名册在白袍房里。阿加特修女会给你看。'),
    },
  ],
  stages: [
    { n: 10, show: ['road'], hint: L("The road west leaves Nailgate by a walk off the west end of the north walk.", '往西的路，从钉门村北栈道西头分出去的一条栈道走。'), log: L('Four seals down. The grey man — Severin — says the fifth is under an altar in the Heights. We go together.', '四道印倒下了。灰衣人——塞弗林——说第五件在高地的一座祭坛底下。我们一起去。') },
    { n: 20, on: { fact: { [CH5.road]: 1 } }, done: ['road'], show: ['abbey'], hint: L('The stair climbs the chalk in switchbacks to the abbey on the summit.', '石阶沿着白垩崖一折一折往上，通到山顶的修道院。'), log: L('White robes hang on poles beside the stair, each over a grave. The pilgrims who died climbing it.', '石阶边的杆子上挂着白袍，每件下面都是一座坟。是爬这道石阶时死去的朝圣者。') },
    { n: 30, on: { enter: 'whiteveil' }, from: [20], done: ['abbey'], show: ['abbot'], hint: L('Abbot Benedek keeps the abbey. He is in the garth or the church.', '本尼德克院长管着这座修道院。他在中庭或教堂里。'), log: L('Whiteveil Abbey, on the summit. The brothers here wear white.', '山顶上的白纱修道院。这里的修士都穿白衣。') },
    { n: 100, on: { objectives: ['abbot'] }, done: ['road', 'abbey', 'abbot'], complete: true, reward: { xp: 80, items: [setPiece('item/valuable/crown/elect', 'white_stair')], facts: { [CH5.abbot]: 1 }, regard: { abbot: 10 } }, log: L('The abbot keeps every pilgrim of four hundred years who fell on the road. The roll is in the robing house.', '院长守着四百年来倒在路上的每一个朝圣者。名册在白袍房里。') },
  ],
  start: { auto: { fact: { [CHAPTER_FIVE]: 1 } } },
}

/** The Witnesses are down: what comes before them in the Heights is behind you. */
const PAST_WITNESSES: QuestTrigger = { fact: { [CH5.witnesses]: { ne: 0 } } }

/** The Heights and their seal: the roll, the catacombs and their niches, the Witnesses beneath the altar. */
const fifthSeal: QuestDef = {
  id: 'fifth_seal',
  kind: 'main',
  title: L('The Fifth Seal', '第五印'),
  summary: L('The Fifth Seal-bearer is the White-Robed Witnesses, under the altar of Whiteveil Abbey: the pilgrims who fell on the road.', '第五位持印者是祭坛之下的白衣万证，在白纱修道院的祭坛底下：倒在路上的朝圣者们。'),
  aliases: { robing: { place: 'whiteveil.robing' }, catacombs: { place: 'catacombs' }, witnesses: { id: WITNESSES_ID, optional: true } },
  objectives: [
    { id: 'roll', text: L('Read the roll in the robing house', '去白袍房读名册'), target: 'robing', on: { fact: { [CH5.roll]: 1 } } },
    { id: 'niches', text: L("Go down into the catacombs, by the stair behind the church's altar", '从教堂祭坛后面的楼梯下到地下墓窟'), target: 'catacombs', on: { fact: { [CH5.niches]: 1 } } },
    { id: 'witnesses', text: L('Bring down the White-Robed Witnesses beneath the altar', '在祭坛之下打倒白衣万证'), target: 'witnesses', on: PAST_WITNESSES },
  ],
  stages: [
    { n: 10, show: ['roll'], hint: L('The robing house is the hall east of the church.', '白袍房就是教堂东边的那座厅堂。'), log: L('The abbot welcomed me as one of the Church\'s own. The roll of the white-robed is in the robing house.', '院长把我当作教会自己人来欢迎。白袍者的名册在白袍房里。') },
    { n: 20, on: { fact: { [CH5.roll]: 1 } }, done: ['roll'], show: ['niches'], hint: L("The stair down to the catacombs is behind the altar of the abbey's church.", '下到地下墓窟的楼梯，在修道院教堂的祭坛后面。'), log: L('The roll: every pilgrim of four hundred years who fell. The pilgrimage chooses whoever can bear the five; the Rite needs "a bearer new". Severin says they are making him a new body, and that it is me. Agathe is sewing a robe to my measure.', '名册上是四百年来倒下的每一个朝圣者。朝圣挑选的是能承受五印的人；大礼需要“一位新的承担者”。塞弗林说，他们在给他造一副新的身体，而那就是我。阿加特正在照我的身量缝一件白袍。') },
    { n: 30, on: { fact: { [CH5.niches]: 1 } }, from: [20], done: ['niches'], show: ['witnesses'], hint: L('Beneath the Altar is through the fog at the catacombs\' north end. Keep out of the line the lance\'s shadow strikes along.', '祭坛之下就在墓窟北头的雾门后面。别站在圣枪之影打过来的那条线上。'), log: L('Cassian of Firstlight has a niche, empty: NOT YET BROUGHT. The oldest niche is empty too. Lumi read its plate aloud and said it was a nice name.', '初原村的卡西安有一个壁龛，空的：尚未带来。最老的那个壁龛也是空的。露米把铭牌念了出来，说这是个好听的名字。') },
    { n: 100, on: PAST_WITNESSES, done: ['roll', 'niches', 'witnesses'], complete: true, reward: { xp: 200, karma: 8 }, log: L('"Is it fulfilled?" "It is enough." The white-robed lay down, and the Lance came free of the altar into my hands.', '“应验了吗？”“够了。”白袍者们躺了下去，圣枪离开祭坛，落进了我手里。') },
  ],
  start: { auto: { done: 'white_stair' } },
}

/** Back up into the abbey after the Witnesses: the bells at four, and the chapter's card. */
const bells: QuestDef = {
  id: 'bells',
  kind: 'main',
  title: L('Bells at Four', '四点的钟'),
  summary: L('The Lance is yours. Go back up into the abbey.', '圣枪归你了。回修道院上面去。'),
  aliases: { abbey: { place: 'whiteveil' } },
  objectives: [{ id: 'abbey', text: L('Go back up into Whiteveil Abbey in the afternoon', '下午回到白纱修道院'), target: 'abbey', on: { fact: { [CH5.end]: 1 } } }],
  stages: [
    { n: 10, show: ['abbey'], hint: L('The abbey is up the stair from the catacombs. The sun goes down at four now.', '修道院就在墓窟楼梯上面。如今太阳四点就落了。'), log: L('Five. Severin\'s flame burns white. "Now we end it."', '五道了。塞弗林的火焰烧成了白色。“现在，我们去了结它。”') },
    { n: 100, on: { fact: { [CH5.end]: 1 } }, done: ['abbey'], complete: true, reward: { xp: 60 }, log: L('The bells rang by themselves at four. The abbot knelt to me. Tomorrow, the Holy City.', '四点，钟自己响了起来。院长朝我跪下了。明天，去圣城。') },
  ],
  start: { auto: { done: 'fifth_seal' } },
}

// ------------------------------------------------------------------ the finale: the Holy City (docs/finale.md)

/** Astra is down. */
const PAST_ASTRA: QuestTrigger = { fact: { [FIN.astra]: { ne: 0 } } }

/** Down into the Holy City with five: the Hall, the Primate, the Confluence, the Holiest; Astra; the Five taken up. The main line's end. */
const greatRite: QuestDef = {
  id: 'great_rite',
  kind: 'main',
  title: L('The Great Rite', '五苦大礼'),
  summary: L('Five seals have fallen, and the five instruments are yours. The Church waits for you in the Most Holy Hall, in the Holy City, for the Great Rite of the Five. Severin means to end it there.', '五道印都倒下了，五件圣器都在你手里。教会在圣城的至圣大殿等你，去行五苦大礼。塞弗林打算在那里了结一切。'),
  aliases: { hall: { place: 'holyhall' }, nave: { place: 'holyhall.nave' }, below: { place: 'confluence' }, astra: { id: ASTRA_ID, optional: true }, holiest: { place: 'holiest' } },
  objectives: [
    { id: 'city', text: L('Take the road down from Whiteveil to the Holy City', '从白纱修道院走下山的路，去圣城'), target: 'hall', on: { fact: { [FIN.road]: 1 } } },
    { id: 'primate', text: L('Go into the Most Holy Hall', '走进至圣大殿'), target: 'nave', on: { fact: { [FIN.primate]: 1 } } },
    { id: 'below', text: L('Go down the stair behind the altar', '从祭坛后面的楼梯下去'), target: 'below', on: { fact: { [FIN.confluence]: 1 } } },
    { id: 'astra', text: L('Astra, the First Martyr', '初殉者·阿斯特拉'), target: 'astra', on: PAST_ASTRA },
    { id: 'five', text: L('Take up the Five, at the bier', '在灵柩台前，继承五苦'), target: 'holiest', on: { fact: { [FIN.five]: 1 } } },
  ],
  stages: [
    { n: 10, show: ['city'], hint: L("The road down to the Holy City leaves Whiteveil's close by its east side.", '下山去圣城的路，从白纱修道院院子的东边出去。'), log: L('Five. Severin\'s flame burns white. The abbot knelt to me and called me bearer. Tomorrow, the Holy City.', '五道了。塞弗林的火焰烧成了白色。院长朝我跪下，叫我承担者。明天，去圣城。') },
    { n: 20, on: { fact: { [FIN.road]: 1 } }, done: ['city'], show: ['primate'], hint: L('The Most Holy Hall is at the head of the close.', '至圣大殿就在院子的尽头。'), log: L('The bells of the Holy City rang for me. Severin went another way: under.', '圣城的钟为我而鸣。塞弗林走了另一条路：从底下走。') },
    { n: 30, on: { fact: { [FIN.primate]: 1 } }, from: [20], done: ['primate'], show: ['below'], hint: L('The stair down is behind the high altar, where the Primate lifted the stone.', '下去的楼梯就在高祭坛后面，首席司祭掀开石板的地方。'), log: L('The Primate says they are not waking him; they have been holding him shut. He opened the floor behind the altar and sent me down alone.', '首席司祭说，他们不是在唤醒他，而是一直在把他关住。他掀开祭坛后面的地面，让我一个人下去。') },
    { n: 40, on: { fact: { [FIN.confluence]: 1 } }, from: [30], done: ['below'], show: ['astra'], hint: L('The Holiest is through the fog at the end of the Confluence. Every suffering is his: watch the ground, and keep out of the dark he leaves.', '至圣所就在五渠汇尽头的雾门后面。五苦都是他的：留意地面，别踩进他留下的黑暗。'), log: L('Under the Hall the channels of the five lands run into one. Severin was waiting there. "Now we end it."', '大殿底下，五片土地的沟槽汇成了一道。塞弗林在那里等着。“现在，我们去了结它。”') },
    { n: 50, on: PAST_ASTRA, from: [40], done: ['astra'], show: ['five'], hint: L('Lay your hands on the bier.', '把手放在灵柩台上。'), log: L('"Good." "At least this time..." "I can die." The dark came out of him. He was holding it. All this time, he was holding it.', '“很好。”“至少这一次……”“我可以死了。”黑暗从他身体里涌了出来。他一直在关着它。这么久以来，他一直在关着它。') },
    { n: 100, on: { fact: { [FIN.five]: 1 } }, done: ['city', 'primate', 'below', 'astra', 'five'], complete: true, log: L('I took up the Five.', '我继承了五苦。') },
  ],
  start: { auto: { fact: { [FINALE]: 1 } } },
}

export const MAIN_QUESTS: QuestDef[] = [awakening, descent, rescue, vigil, firstSeal, heldGround, crownHome, dragonRoad, secondSeal, marchQuiet, grainRoad, thirdSeal, granary, fenRoad, fourthSeal, ferry, whiteStair, fifthSeal, bells, greatRite]
