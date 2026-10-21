// The prologue (docs/prologue.md): the tutorial — a day and a night in the clearing — then the foot of the mountain
// and down to the Ford. Its stages are the main line's first two quests (quests/main.ts, docs/quests.md): `awakening`
// (the clearing: stage 10 for each of the drills' days, 10 … 80) and `descent` (the stone, the Ford, the village). The
// beats here let Lumi say one line each, and each quest stage waits on its beat; the lessons are the clearing's
// stages' drills. Every beat waits for a state, never for a path: whatever gets the player there counts.

import type { Lesson, StepCond, StepDef, Text } from '@openworld/engine'

const L = (en: string, zh: string): Text => ({ en, zh })

/** The story's fact that opens the tutorial's way out (on the first morning after the house). */
export const TUTORIAL_OPEN = 'tutorial.open'

/** The tutorial's last day: the way out is open, down to the foot (the clearing's stage 80). */
export const TUTORIAL_DONE = 8

/** Where the tutorial teaches the house (docs/prologue.md): the bed at its heart, walls north, west and east, the door south — the first wall goes on this outline. */
export const TUTORIAL_HOUSE = { bed: [20, 12], walls: [[20, 11], [19, 12], [21, 12]], door: [20, 13] } as const
/** Where the training dummy stands, beside the house. */
export const TUTORIAL_DUMMY = [23, 13] as const
/** Where one walks to first (the move lesson), a few steps from where one comes round. */
const FIRST_SPOT = [15, 12] as const

const cells = (xs: readonly (readonly [number, number])[]): [number, number][] => xs.map(([x, y]) => [x, y])

/**
 * The tutorial's lessons, by stage (docs/prologue.md, the drills): each teaches one thing by the deed —
 * a thing spotlit, the key drawn over it, the keys it does not teach locked (the first ones only), done
 * when the state holds. A lock never keeps one from what the lesson itself needs (gathering for the
 * campfire, wood for the walls), so it cannot leave one stuck. One short line each; the stages' hints
 * stay for E on Lumi.
 */
export const TUTORIAL_LESSONS: Record<number, Lesson[]> = {
  1: [
    { id: 'move', say: L('Over here — {key:move} walks.', '到这儿来——{key:move} 走路。'), key: 'WASD', focus: { spot: [...FIRST_SPOT] }, allow: ['move'], done: { spot: { x: FIRST_SPOT[0], y: FIRST_SPOT[1], r: 0 } } },
    { id: 'take', say: L('Berries! Stand by them and press {key:hands}.', '浆果！站到旁边按 {key:hands} 捡起来。'), key: 'E', focus: { type: 'item/food/berries' }, allow: ['move', 'take'], done: { carrying: 'item/food/berries' } },
    { id: 'hold', say: L('Take them in hand: their number on the toolbar.', '拿到手上：按快捷栏上它们那一格的数字。'), key: '1–0', focus: { ui: 'slot:item/food/berries' }, allow: ['move', 'select'], done: { holding: 'item/food/berries' } },
    { id: 'eat', say: L('A left click eats what you hold.', '左键吃掉手里的东西。'), key: 'LMB', focus: { self: true }, allow: ['move', 'select', 'self'], done: { facts: { 'prologue.meals': { gte: 1 } } } },
  ],
  2: [
    { id: 'bag', say: L('{key:bag} opens your bag: everything you carry.', '按 {key:bag} 打开背包：身上的东西都在里面。'), key: 'I', focus: { ui: 'bag' }, allow: ['move', 'bag'], done: { facts: { 'ui.bag': { gte: 1 } } } },
    { id: 'stick', say: L('A stick — {key:hands}.', '一根树枝——按 {key:hands}。'), key: 'E', focus: { type: 'item/material/stick' }, done: { carrying: 'item/material/stick' } },
    { id: 'stone', say: L('A stone.', '一块石头。'), key: 'E', focus: { type: 'item/material/stone' }, done: { carrying: 'item/material/stone' } },
    { id: 'grass', say: L('And a tuft of grass.', '再来一把草。'), key: 'E', focus: { type: 'item/material/grass' }, done: { carrying: 'item/material/grass' } },
  ],
  3: [
    { id: 'craft', say: L('{key:craft} opens crafting. Make the stone axe.', '按 {key:craft} 打开制作，做一把石斧。'), key: 'C', focus: { ui: 'craft:item/weapon/blade/axe' }, allow: ['move', 'craft'], only: ['item/weapon/blade/axe'], done: { carrying: 'item/weapon/blade/axe' } },
  ],
  4: [
    { id: 'hold-axe', say: L('The axe in hand.', '把斧头拿到手上。'), key: '1–0', focus: { ui: 'slot:item/weapon/blade/axe' }, allow: ['move', 'select'], done: { holding: 'item/weapon/blade/axe' } },
    { id: 'chop', say: L('A tree in the grove: left click, again and again.', '东边林子里的树：左键，一下一下砍。'), key: 'LMB', focus: { terrain: 'tree', from: [27, 12] }, allow: ['move', 'select', 'use'], done: { carrying: 'item/material/log' } },
    { id: 'split', say: L('{key:craft}: the logs into planks — the axe at hand does it.', '按 {key:craft}：把原木做成木板——身上有斧头就行。'), key: 'C', focus: { ui: 'craft:item/material/plank' }, allow: ['move', 'select', 'use', 'craft'], only: ['item/material/plank'], done: { carrying: 'item/material/plank' } },
  ],
  5: [
    { id: 'campfire', say: L('{key:build} opens building: set a campfire down.', '按 {key:build} 打开建造：放一堆营火。'), key: 'B', focus: { ui: 'build:campfire' }, allow: ['move', 'build', 'take'], only: ['campfire'], done: { near: { type: 'fixture/light/campfire', r: 12 } } },
    { id: 'torch', say: L('{key:craft}: a torch — a stick and grass.', '按 {key:craft} 做一支火把：树枝加草。'), key: 'C', focus: { ui: 'craft:item/light/torch' }, done: { carrying: 'item/light/torch' } },
    { id: 'light', say: L('Torch in hand, left click the fire.', '拿着火把，左键点营火。'), key: 'LMB', focus: { type: 'fixture/light/campfire' }, done: { near: { type: 'fixture/light/campfire', r: 12, status: 'lit' } } },
  ],
  6: [
    { id: 'wall', say: L('{key:build}: a wall — the first one on the outline.', '按 {key:build} 选墙——第一面放在画好的轮廓上。'), key: 'B', focus: { cells: cells(TUTORIAL_HOUSE.walls), ui: 'build:put:structure/wall' }, allow: ['move', 'build', 'put', 'select', 'craft', 'use', 'take'], only: ['structure/wall'], cells: cells(TUTORIAL_HOUSE.walls), done: { on: { type: 'structure/wall', cells: cells(TUTORIAL_HOUSE.walls) } } },
    { id: 'door', say: L('Walls round, and a door.', '把墙围起来，再装一扇门。'), key: 'B', focus: { cells: cells([TUTORIAL_HOUSE.door]), ui: 'build:put:structure/door' }, done: { near: { type: 'structure/door', r: 10 } } },
    { id: 'bed', say: L('A bed inside.', '屋里放一张床。'), key: 'B', focus: { cells: cells([TUTORIAL_HOUSE.bed]), ui: 'build:put:fixture/furniture/bed' }, done: { near: { type: 'fixture/furniture/bed', r: 10 } } },
    { id: 'ceiling', say: L('Now a ceiling: in {key:build} choose the floor, and {key:rotate} makes it the ceiling.', '最后是天花板：在 {key:build} 里选地板，按 {key:rotate} 切成天花板。'), key: 'R', focus: { ui: 'build:put:structure/floor' }, done: { room: 'bedroom' } },
  ],
  7: [
    { id: 'chooser', say: L('Hold {key:hands} on the bed: every layer of a cell, to choose from.', '对着床长按 {key:hands}：一格里的每一层都列出来，任你选。'), key: 'hold E', focus: { type: 'fixture/furniture/bed' }, done: { facts: { 'ui.chooser': { gte: 1 } } } },
    { id: 'dummy', say: L('A dummy by the house: left click until it topples.', '屋旁有个假人：左键打，直到把它打倒。'), key: 'LMB', focus: { type: 'fixture/dummy' }, allow: ['move', 'select', 'use'], done: { facts: { 'tutorial.dummy': { gte: 1 } } } },
    { id: 'shut', say: L('Before dark, shut the door: {key:hands}.', '天黑前关上门：按 {key:hands}。'), key: 'E', focus: { type: 'structure/door' }, done: { near: { type: 'structure/door', r: 10, exact: true } } },
    { id: 'sleep', say: L('Then sleep in your bed: {key:hands}.', '然后上床睡觉：按 {key:hands}。'), key: 'E', focus: { type: 'fixture/furniture/bed' }, done: { statuses: { asleep: true } } },
  ],
  [TUTORIAL_DONE]: [
    { id: 'map', say: L('{key:map}: the world map — every place you have been.', '按 {key:map} 打开世界地图：去过的地方都在上面。'), key: 'M', focus: { ui: 'map' }, done: { facts: { 'ui.map': { gte: 1 } } } },
  ],
}

/** A beat of the clearing waits for its day's stage of `awakening` (10 … 80): once past it, it never fires. */
const at = (day: number, when: StepCond = {}): StepCond => ({ ...when, quest: { ...when.quest, awakening: day * 10 } })

export const PROLOGUE_BEATS: StepDef[] = [
  // ---- the tutorial: the clearing, a day and a night
  {
    id: 'tut_wake',
    when: { map: 'tutorial', statuses: { out_cold: false }, quest: { awakening: { lt: 10 } } },
    say: L('Hey! You are awake at last! I am Lumi — a fairy, and from today I go where you go.', '嘿！你终于醒啦！我是露米，是个精灵，从今天起你去哪儿我就去哪儿。'),
  },
  {
    id: 'tut_ate',
    when: at(1, { facts: { 'prologue.meals': { gte: 1 } } }),
    say: L('Better! To make anything we need sticks, stones and grass.', '好多了吧！要做东西，得先有树枝、石头和草。'),
  },
  {
    id: 'tut_gathered',
    when: at(2, { carrying: ['item/material/stick', 'item/material/stone', 'item/material/grass'] }),
    say: L('That is an axe\'s worth!', '这些够做一把斧头了！'),
  },
  {
    id: 'tut_axe',
    when: at(3, { carrying: 'item/weapon/blade/axe' }),
    say: L('An axe! Now wood.', '斧头！该去砍木头了。'),
  },
  {
    id: 'tut_planks',
    when: at(4, { carrying: 'item/material/plank' }),
    say: L('Planks! Night comes early in the woods, and things walk in the dark. A fire first.', '木板！林子里天黑得早，天黑以后会有东西出来游荡。先生火。'),
  },
  {
    id: 'tut_fire',
    when: at(5, { near: { type: 'fixture/light/campfire', r: 12, status: 'lit' } }),
    say: L('Warm! Now a roof over your head.', '暖和了！现在给自己盖个屋子。'),
  },
  {
    id: 'tut_house',
    when: at(6, { room: 'bedroom' }),
    say: L('A home of your own! Now we only have to get through the night. Have a bite before you sleep — the berries keep coming. At first light, we go.', '有家了！现在只要熬过今晚。睡前吃点东西——浆果会一直长出来。天一亮，我们就出发。'),
  },
  {
    id: 'tut_morning',
    when: at(7, { morningAfter: 'tut_house' }),
    facts: { [TUTORIAL_OPEN]: 1 },
    say: L('Morning! You made it through. The path south is clear now — down to the foot of the mountain!', '天亮了！你熬过来了。南边的小路通了——下山去吧！'),
  },
  {
    // the way out tried too soon: it is not open yet
    id: 'tut_too_soon',
    when: { map: 'tutorial', region: 'exit', quest: { awakening: { lt: TUTORIAL_DONE * 10 } } },
    say: L('Not that way yet — the woods are no place to be lost in. Let us get settled here first.', '先别往那边走——在林子里迷路可不是闹着玩的。先在这儿安顿下来吧。'),
  },
  {
    id: 'tut_out',
    when: { map: 'foot', quest: { awakening: TUTORIAL_DONE * 10 } },
    say: L('The foot of the mountain! See the old stone in the flowers down there?', '到山脚了！看见下面花丛里那块古老的石头了吗？'),
  },
  {
    // a new game: one comes round on Cloudtop (the tutorial run has its own line)
    id: 'summit_wake',
    when: { map: 'summit', facts: { [TUTORIAL_OPEN]: 0 }, quest: { descent: { lt: 20 } } },
    say: L("You're awake! I'm Lumi, a fairy — from today I go where you go. This is Cloudtop, the plateau at the top of the mountain. The only way down is the cut in the rocks to the south; below it lies the Mountain Foot, and further down, the Ford.", '你醒啦！我是露米，是个精灵，从今天起你去哪儿我就去哪儿。这里是云顶台地，山顶上的高台。下山只有南边岩壁上的那道豁口；下面是山脚，再往下就是渡口。'),
  },
  {
    // the first waypoint statue in view, whenever that is
    id: 'see_waypoint',
    when: { near: { type: 'fixture/sacred/waypoint', r: 6 }, statuses: { out_cold: false } },
    say: L('Look — a waypoint statue! Walk up and press {key:hands} to wake it; then the map ({key:map}) can take you back to it from anywhere.', '看——是传送雕像！走过去按 {key:hands} 唤醒它，以后在地图（{key:map}）上就能从任何地方传送回来。'),
  },
  {
    id: 'relic',
    when: { map: 'foot', region: 'relic', quest: { descent: { lt: 20 } } },
    say: L("It's colder near it. Five marks, and the first one is cracked... I don't like it. I don't know why I don't like it. — Try anything on it: use what you hold, put something on it, strike it. Whatever you do, the world learns.", '它旁边好冷。五道痕，第一道裂开了……我不喜欢它。我也不知道为什么不喜欢。——对它做点什么吧：用手里的东西、放点东西上去、打它一下。不管你做什么，世界都会学着回应。'),
  },
  {
    id: 'tried',
    // after the stone was seen: an experiment anywhere before it is not the stone's lesson
    when: { after: 'relic', facts: { 'world.experiments': { gte: 1 } }, quest: { descent: { lt: 30 } } },
    say: L('Did you see? The world answers what it has never seen. What it learns is kept in the Threadbook — {key:journal}. Now, down to the Ford!', '看到了吗？世界会回应它从没见过的事。它学会的都记在织线簿里——按 {key:journal}。走吧，下山去渡口！'),
  },
  {
    // however they got here, the Ford ends the prologue
    id: 'ford',
    when: { map: 'ford', quest: { descent: { lt: 40 } } },
    say: L('The Ford! Someone down there looks like they need a hand.', '渡口到了！那边的人好像需要帮忙。'),
  },
]
