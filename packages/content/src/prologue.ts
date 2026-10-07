// The prologue (docs/prologue.md): the tutorial (stages 1 … TUTORIAL_DONE), then the foot of the mountain and
// down to the Ford. Its stage is the player's `prologue` prop (PROLOGUE_AT_FOOT at the foot, the
// stage a game that skips the tutorial begins at; PROLOGUE_DONE once on the Ford); the beats move
// it on and let Pip, the fairy, say one line each; the objectives are what the HUD shows meanwhile.
// Every beat waits for a state, never for a path: whatever gets the player there counts.

import type { Lesson, StepCond, StepDef, Text } from '@lsw/engine'
import type { Objective } from './ford.ts'

const L = (en: string, zh: string): Text => ({ en, zh })

/** The stage at which the prologue is over (the player has reached the Ford). */
export const PROLOGUE_DONE = 11

/** The stage a game that skips the tutorial begins at: at the foot of the mountain, before the seal stone. */
export const PROLOGUE_AT_FOOT = 9

/** The story's fact that opens the tutorial's way out (on the first morning after the house). */
export const TUTORIAL_OPEN = 'tutorial.open'

/** The tutorial's last stage: the way out is open, down to the foot. */
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
 * stay for E on Pip.
 */
export const TUTORIAL_LESSONS: Record<number, Lesson[]> = {
  1: [
    { id: 'move', say: L('Over here — WASD walks.', '到这儿来——WASD 走路。'), key: 'WASD', focus: { spot: [...FIRST_SPOT] }, allow: ['move'], done: { spot: { x: FIRST_SPOT[0], y: FIRST_SPOT[1], r: 0 } } },
    { id: 'take', say: L('Berries! Stand by them and press F.', '浆果！站到旁边按 F 捡起来。'), key: 'F', focus: { type: 'item/food/berries' }, allow: ['move', 'take'], done: { carrying: 'item/food/berries' } },
    { id: 'hold', say: L('Take them in hand: their number on the toolbar.', '拿到手上：按快捷栏上它们那一格的数字。'), key: '1–0', focus: { ui: 'slot:item/food/berries' }, allow: ['move', 'select'], done: { holding: 'item/food/berries' } },
    { id: 'eat', say: L('A right click eats what you hold.', '右键吃掉手里的东西。'), key: 'RMB', focus: { self: true }, allow: ['move', 'select', 'self'], done: { facts: { 'prologue.meals': { gte: 1 } } } },
  ],
  2: [
    { id: 'bag', say: L('I opens your bag: everything you carry.', '按 I 打开背包：身上的东西都在里面。'), key: 'I', focus: { ui: 'bag' }, allow: ['move', 'bag'], done: { facts: { 'ui.bag': { gte: 1 } } } },
    { id: 'stick', say: L('A stick — F.', '一根树枝——按 F。'), key: 'F', focus: { type: 'item/material/stick' }, done: { carrying: 'item/material/stick' } },
    { id: 'stone', say: L('A stone.', '一块石头。'), key: 'F', focus: { type: 'item/material/stone' }, done: { carrying: 'item/material/stone' } },
    { id: 'grass', say: L('And a tuft of grass.', '再来一把草。'), key: 'F', focus: { type: 'item/material/grass' }, done: { carrying: 'item/material/grass' } },
  ],
  3: [
    { id: 'craft', say: L('C opens crafting. Make the stone axe.', '按 C 打开制作，做一把石斧。'), key: 'C', focus: { ui: 'craft:item/weapon/blade/axe' }, allow: ['move', 'craft'], only: ['item/weapon/blade/axe'], done: { carrying: 'item/weapon/blade/axe' } },
  ],
  4: [
    { id: 'hold-axe', say: L('The axe in hand.', '把斧头拿到手上。'), key: '1–0', focus: { ui: 'slot:item/weapon/blade/axe' }, allow: ['move', 'select'], done: { holding: 'item/weapon/blade/axe' } },
    { id: 'chop', say: L('A tree in the grove: left click, again and again.', '东边林子里的树：左键，一下一下砍。'), key: 'LMB', focus: { terrain: 'tree', from: [27, 12] }, allow: ['move', 'select', 'use'], done: { carrying: 'item/material/log' } },
    { id: 'split', say: L('C: the logs into planks — the axe at hand does it.', '按 C：把原木做成木板——身上有斧头就行。'), key: 'C', focus: { ui: 'craft:item/material/plank' }, allow: ['move', 'select', 'use', 'craft'], only: ['item/material/plank'], done: { carrying: 'item/material/plank' } },
  ],
  5: [
    { id: 'campfire', say: L('B opens building: set a campfire down.', '按 B 打开建造：放一堆营火。'), key: 'B', focus: { ui: 'build:campfire' }, allow: ['move', 'build', 'take'], only: ['campfire'], done: { near: { type: 'fixture/light/campfire', r: 12 } } },
    { id: 'torch', say: L('C: a torch — a stick and grass.', '按 C 做一支火把：树枝加草。'), key: 'C', focus: { ui: 'craft:item/light/torch' }, done: { carrying: 'item/light/torch' } },
    { id: 'light', say: L('Torch in hand, left click the fire.', '拿着火把，左键点营火。'), key: 'LMB', focus: { type: 'fixture/light/campfire' }, done: { near: { type: 'fixture/light/campfire', r: 12, status: 'lit' } } },
  ],
  6: [
    { id: 'wall', say: L('B: a wall — the first one on the outline.', '按 B 选墙——第一面放在画好的轮廓上。'), key: 'B', focus: { cells: cells(TUTORIAL_HOUSE.walls), ui: 'build:put:structure/wall' }, allow: ['move', 'build', 'put', 'select', 'craft', 'use', 'take'], only: ['structure/wall'], cells: cells(TUTORIAL_HOUSE.walls), done: { on: { type: 'structure/wall', cells: cells(TUTORIAL_HOUSE.walls) } } },
    { id: 'door', say: L('Walls round, and a door.', '把墙围起来，再装一扇门。'), key: 'B', focus: { cells: cells([TUTORIAL_HOUSE.door]), ui: 'build:put:structure/door' }, done: { near: { type: 'structure/door', r: 10 } } },
    { id: 'bed', say: L('A bed inside.', '屋里放一张床。'), key: 'B', focus: { cells: cells([TUTORIAL_HOUSE.bed]), ui: 'build:put:fixture/furniture/bed' }, done: { near: { type: 'fixture/furniture/bed', r: 10 } } },
    { id: 'ceiling', say: L('Now a ceiling: in B choose the floor, and R makes it the ceiling.', '最后是天花板：在 B 里选地板，按 R 切成天花板。'), key: 'R', focus: { ui: 'build:put:structure/floor' }, done: { room: 'bedroom' } },
  ],
  7: [
    { id: 'chooser', say: L('Hold E on the bed: every layer of a cell, to choose from.', '对着床长按 E：一格里的每一层都列出来，任你选。'), key: 'hold E', focus: { type: 'fixture/furniture/bed' }, done: { facts: { 'ui.chooser': { gte: 1 } } } },
    { id: 'dummy', say: L('A dummy by the house: left click until it topples.', '屋旁有个假人：左键打，直到把它打倒。'), key: 'LMB', focus: { type: 'fixture/dummy' }, allow: ['move', 'select', 'use'], done: { facts: { 'tutorial.dummy': { gte: 1 } } } },
    { id: 'shut', say: L('Before dark, shut the door: E.', '天黑前关上门：按 E。'), key: 'E', focus: { type: 'structure/door' }, done: { near: { type: 'structure/door', r: 10, exact: true } } },
    { id: 'sleep', say: L('Then sleep in your bed: E.', '然后上床睡觉：按 E。'), key: 'E', focus: { type: 'fixture/furniture/bed' }, done: { statuses: { asleep: true } } },
  ],
  [TUTORIAL_DONE]: [
    { id: 'map', say: L('M: the world map — every place you have been.', '按 M 打开世界地图：去过的地方都在上面。'), key: 'M', focus: { ui: 'map' }, done: { facts: { 'ui.map': { gte: 1 } } } },
  ],
}

export const PROLOGUE_OBJECTIVES: Record<number, Objective> = {
  1: { title: L('Find something to eat', '找点吃的'), hint: L('WASD moves you. F picks up what you point at; hold it (1–0) and right click to eat it.', 'WASD 移动。F 捡起鼠标指着的东西；用 1–0 拿在手上，右键吃掉。') },
  2: { title: L('Gather sticks, stones and grass', '收集树枝、石头和草'), hint: L('They lie about the clearing, and more turn up. F picks them up; Tab shows the bag.', '空地上到处都有，而且会不断长出来。F 捡起来；Tab 打开背包。') },
  3: { title: L('Make a stone axe', '做一把石斧'), hint: L('C opens crafting: a stick, a stone and a tuft of grass.', 'C 打开制作：一根树枝、一块石头、一把草。') },
  4: { title: L('Fell a tree and split planks', '砍树，劈出木板'), hint: L('Hold the axe and left click a tree: it falls into logs. Left click a log with the axe: planks.', '拿着斧头左键点树，树倒下变成原木；再用斧头左键点原木，劈成木板。') },
  5: { title: L('Build a campfire and light it', '搭一堆营火并点燃'), hint: L('B opens building: a ring of stones and sticks is a campfire. C makes a torch (a stick and grass); left click the fire with it.', 'B 打开建造：石头和树枝围成营火。C 做一支火把（树枝加草），拿着它左键点营火。') },
  6: { title: L('Build a house with a bed', '盖一间有床的屋子'), hint: L('C makes walls, a door, a floor and a bed from planks. G sets them down: walls and a door round you, the bed at your feet. The floor over your head is the ceiling: hold G and choose The ceiling (or in the build palette, B, R turns a floor into a ceiling).', 'C 用木板做墙、门、地板和床。G 放下：墙和门围住自己，床放在脚下。头顶那块是天花板：长按 G 选“天花板”（或在建造模式 B 里按 R 把地板切换成天花板）。') },
  7: { title: L('Get through the night', '熬过这一夜'), hint: L('Things walk in the dark. Sleep in your bed (E) — not on an empty stomach, or hunger wakes you in the night. At first light we go.', '天黑以后会有东西出来游荡。在床上睡一觉（E）——别空着肚子睡，不然会半夜饿醒。天一亮我们就出发。') },
  [TUTORIAL_DONE]: { title: L('Take the path south', '沿小路往南走'), hint: L('The path out of the clearing runs south, down to the foot of the mountain.', '空地南边的小路通往山脚。') },
}
for (const [stage, lessons] of Object.entries(TUTORIAL_LESSONS)) PROLOGUE_OBJECTIVES[Number(stage)] = { ...PROLOGUE_OBJECTIVES[Number(stage)], lessons }
const PROLOGUE_REST: Record<number, Objective> = {
  [PROLOGUE_AT_FOOT]: { title: L('Try something the world has never seen', '做一件世界从没见过的事'), hint: L('Use what you hold on the old seal stone, put something on it, strike it — anything. The world learns.', '拿着东西对古老的封印石用一用、放点东西上去、打它一下——什么都行。世界会学习。') },
  [PROLOGUE_AT_FOOT + 1]: { title: L('Down to the Ford', '下山去渡口'), hint: L('The trail runs south off the mountain. J: the Threadbook keeps what the world has learned.', '小路往南下山。J：织线簿记着世界学会的事。') },
}
Object.assign(PROLOGUE_OBJECTIVES, PROLOGUE_REST)

/** Every prologue beat waits for its stage too: once past it, it never fires (nor pulls the stage back). */
const at = (stage: number, when: StepCond = {}): StepCond => ({ ...when, props: { ...when.props, prologue: stage } })

export const PROLOGUE_BEATS: StepDef[] = [
  // ---- the tutorial: the clearing, a day and a night
  {
    id: 'tut_wake',
    when: { map: 'tutorial', statuses: { out_cold: false }, props: { prologue: { lt: 1 } } },
    props: { prologue: 1 },
    say: L('Hey! You are awake at last! I am Pip — a fairy, and from today I go where you go.', '嘿！你终于醒啦！我是小啾，是个精灵，从今天起你去哪儿我就去哪儿。'),
  },
  {
    id: 'tut_ate',
    when: at(1, { facts: { 'prologue.meals': { gte: 1 } } }),
    props: { prologue: 2 },
    say: L('Better! To make anything we need sticks, stones and grass.', '好多了吧！要做东西，得先有树枝、石头和草。'),
  },
  {
    id: 'tut_gathered',
    when: at(2, { carrying: ['item/material/stick', 'item/material/stone', 'item/material/grass'] }),
    props: { prologue: 3 },
    say: L('That is an axe\'s worth!', '这些够做一把斧头了！'),
  },
  {
    id: 'tut_axe',
    when: at(3, { carrying: 'item/weapon/blade/axe' }),
    props: { prologue: 4 },
    say: L('An axe! Now wood.', '斧头！该去砍木头了。'),
  },
  {
    id: 'tut_planks',
    when: at(4, { carrying: 'item/material/plank' }),
    props: { prologue: 5 },
    say: L('Planks! Night comes early in the woods, and things walk in the dark. A fire first.', '木板！林子里天黑得早，天黑以后会有东西出来游荡。先生火。'),
  },
  {
    id: 'tut_fire',
    when: at(5, { near: { type: 'fixture/light/campfire', r: 12, status: 'lit' } }),
    props: { prologue: 6 },
    say: L('Warm! Now a roof over your head.', '暖和了！现在给自己盖个屋子。'),
  },
  {
    id: 'tut_house',
    when: at(6, { room: 'bedroom' }),
    props: { prologue: 7 },
    say: L('A home of your own! Now we only have to get through the night. Have a bite before you sleep — the berries keep coming. At first light, we go.', '有家了！现在只要熬过今晚。睡前吃点东西——浆果会一直长出来。天一亮，我们就出发。'),
  },
  {
    id: 'tut_morning',
    when: at(7, { morningAfter: 'tut_house' }),
    props: { prologue: TUTORIAL_DONE },
    facts: { [TUTORIAL_OPEN]: 1 },
    say: L('Morning! You made it through. The path south is clear now — down to the foot of the mountain!', '天亮了！你熬过来了。南边的小路通了——下山去吧！'),
  },
  {
    // the way out tried too soon: it is not open yet
    id: 'tut_too_soon',
    when: { map: 'tutorial', region: 'exit', props: { prologue: { lt: TUTORIAL_DONE } } },
    say: L('Not that way yet — the woods are no place to be lost in. Let us get settled here first.', '先别往那边走——在林子里迷路可不是闹着玩的。先在这儿安顿下来吧。'),
  },
  {
    id: 'tut_out',
    when: { map: 'foot', props: { prologue: TUTORIAL_DONE } },
    props: { prologue: PROLOGUE_AT_FOOT },
    say: L('The foot of the mountain! See the old stone in the flowers down there?', '到山脚了！看见下面花丛里那块古老的石头了吗？'),
  },
  {
    // the first waypoint statue in view, whenever that is
    id: 'see_waypoint',
    when: { near: { type: 'fixture/sacred/waypoint', r: 6 }, props: { prologue: { gte: 1 } } },
    say: L('Look — a waypoint statue! Walk up and press E to wake it; then the map (M) can take you back to it from anywhere.', '看——是传送雕像！走过去按 E 唤醒它，以后在地图（M）上就能从任何地方传送回来。'),
  },
  {
    id: 'relic',
    when: at(PROLOGUE_AT_FOOT, { map: 'foot', region: 'relic' }),
    say: L('Try anything on it: use what you hold, put something on it, strike it. Whatever you do, the world learns.', '对它做点什么吧：用手里的东西、放点东西上去、打它一下。不管你做什么，世界都会学着回应。'),
  },
  {
    id: 'tried',
    when: at(PROLOGUE_AT_FOOT, { facts: { 'world.experiments': { gte: 1 } } }),
    props: { prologue: PROLOGUE_AT_FOOT + 1 },
    say: L('Did you see? The world answers what it has never seen. What it learns is kept in the Threadbook — J. Now, down to the Ford!', '看到了吗？世界会回应它从没见过的事。它学会的都记在织线簿里——按 J。走吧，下山去渡口！'),
  },
  {
    // however they got here, the Ford ends the prologue
    id: 'ford',
    when: { map: 'ford', props: { prologue: { lt: PROLOGUE_DONE } } },
    props: { prologue: PROLOGUE_DONE },
    say: L('The Ford! Someone down there looks like they need a hand.', '渡口到了！那边的人好像需要帮忙。'),
  },
]
