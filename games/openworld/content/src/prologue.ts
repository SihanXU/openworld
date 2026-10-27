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
    { id: 'move', say: L('Come over here. {key:move} to walk.', '到这边来，用 {key:move} 走路。'), key: 'WASD', focus: { spot: [...FIRST_SPOT] }, allow: ['move'], done: { spot: { x: FIRST_SPOT[0], y: FIRST_SPOT[1], r: 0 } } },
    { id: 'take', say: L('Berries! Walk up to them and press {key:hands}.', '有浆果！走到旁边，按 {key:hands} 捡起来。'), key: 'E', focus: { type: 'item/food/berries' }, allow: ['move', 'take'], done: { carrying: 'item/food/berries' } },
    { id: 'hold', say: L('Now take them in hand: press their number on the toolbar.', '把浆果拿到手上：按快捷栏上那一格的数字。'), key: '1–0', focus: { ui: 'slot:item/food/berries' }, allow: ['move', 'select'], done: { holding: 'item/food/berries' } },
    { id: 'eat', say: L("Left click to eat what you're holding.", '按左键，把手里的东西吃掉。'), key: 'LMB', focus: { self: true }, allow: ['move', 'select', 'self'], done: { facts: { 'prologue.meals': { gte: 1 } } } },
  ],
  2: [
    { id: 'bag', say: L('{key:bag} opens your bag. Everything you carry is in it.', '按 {key:bag} 打开背包，身上带的东西都在里面。'), key: 'I', focus: { ui: 'bag' }, allow: ['move', 'bag'], done: { facts: { 'ui.bag': { gte: 1 } } } },
    { id: 'stick', say: L("There's a stick. Pick it up with {key:hands}.", '那儿有根树枝，按 {key:hands} 捡起来。'), key: 'E', focus: { type: 'item/material/stick' }, done: { carrying: 'item/material/stick' } },
    { id: 'stone', say: L('Now a stone.', '再捡一块石头。'), key: 'E', focus: { type: 'item/material/stone' }, done: { carrying: 'item/material/stone' } },
    { id: 'grass', say: L('And a tuft of grass.', '还有一把草。'), key: 'E', focus: { type: 'item/material/grass' }, done: { carrying: 'item/material/grass' } },
  ],
  3: [
    { id: 'craft', say: L('{key:craft} opens crafting. Make the stone axe.', '按 {key:craft} 打开制作，做一把石斧。'), key: 'C', focus: { ui: 'craft:item/weapon/blade/axe' }, allow: ['move', 'craft'], only: ['item/weapon/blade/axe'], done: { carrying: 'item/weapon/blade/axe' } },
  ],
  4: [
    { id: 'hold-axe', say: L('Take the axe in hand.', '把斧头拿到手上。'), key: '1–0', focus: { ui: 'slot:item/weapon/blade/axe' }, allow: ['move', 'select'], done: { holding: 'item/weapon/blade/axe' } },
    { id: 'chop', say: L('Go to the trees in the grove to the east and left click one, again and again.', '去东边林子里找棵树，按左键一下一下地砍。'), key: 'LMB', focus: { terrain: 'tree', from: [27, 12] }, allow: ['move', 'select', 'use'], done: { carrying: 'item/material/log' } },
    { id: 'split', say: L('Open {key:craft} and make the logs into planks. You only need the axe on you.', '按 {key:craft}，把原木做成木板。身上带着斧头就行。'), key: 'C', focus: { ui: 'craft:item/material/plank' }, allow: ['move', 'select', 'use', 'craft'], only: ['item/material/plank'], done: { carrying: 'item/material/plank' } },
  ],
  5: [
    { id: 'campfire', say: L('{key:build} opens building. Set down a campfire.', '按 {key:build} 打开建造，放一堆营火。'), key: 'B', focus: { ui: 'build:campfire' }, allow: ['move', 'build', 'take'], only: ['campfire'], done: { near: { type: 'fixture/light/campfire', r: 12 } } },
    { id: 'torch', say: L('Now make a torch with {key:craft}: a stick and some grass.', '再按 {key:craft} 做一支火把，要树枝和草。'), key: 'C', focus: { ui: 'craft:item/light/torch' }, done: { carrying: 'item/light/torch' } },
    { id: 'light', say: L('Hold the torch and left click the fire.', '拿着火把，左键点营火。'), key: 'LMB', focus: { type: 'fixture/light/campfire' }, done: { near: { type: 'fixture/light/campfire', r: 12, status: 'lit' } } },
  ],
  6: [
    { id: 'wall', say: L('In {key:build}, choose a wall and put the first one on the outline.', '在 {key:build} 里选墙，第一面放在画好的轮廓上。'), key: 'B', focus: { cells: cells(TUTORIAL_HOUSE.walls), ui: 'build:put:structure/wall' }, allow: ['move', 'build', 'put', 'select', 'craft', 'use', 'take'], only: ['structure/wall'], cells: cells(TUTORIAL_HOUSE.walls), done: { on: { type: 'structure/wall', cells: cells(TUTORIAL_HOUSE.walls) } } },
    { id: 'door', say: L('Wall yourself round, and put in a door.', '把墙围起来，再装一扇门。'), key: 'B', focus: { cells: cells([TUTORIAL_HOUSE.door]), ui: 'build:put:structure/door' }, done: { near: { type: 'structure/door', r: 10 } } },
    { id: 'bed', say: L('A bed inside.', '屋里放一张床。'), key: 'B', focus: { cells: cells([TUTORIAL_HOUSE.bed]), ui: 'build:put:fixture/furniture/bed' }, done: { near: { type: 'fixture/furniture/bed', r: 10 } } },
    { id: 'ceiling', say: L('Last, a ceiling: choose the floor in {key:build} and press {key:rotate} to make it a ceiling.', '最后是天花板：在 {key:build} 里选地板，按 {key:rotate} 换成天花板。'), key: 'R', focus: { ui: 'build:put:structure/floor' }, done: { room: 'bedroom' } },
  ],
  7: [
    { id: 'chooser', say: L('Hold {key:hands} on the bed. Everything in that cell is listed, and you can choose which one you mean.', '对着床按住 {key:hands}，这一格里的东西都会列出来，你可以选要哪一样。'), key: 'hold E', focus: { type: 'fixture/furniture/bed' }, done: { facts: { 'ui.chooser': { gte: 1 } } } },
    { id: 'dummy', say: L("There's a dummy by the house. Left click it until it falls over.", '屋子旁边有个假人，用左键打它，直到把它打倒。'), key: 'LMB', focus: { type: 'fixture/dummy' }, allow: ['move', 'select', 'use'], done: { facts: { 'tutorial.dummy': { gte: 1 } } } },
    { id: 'shut', say: L('Shut the door before dark: {key:hands}.', '天黑前把门关上：按 {key:hands}。'), key: 'E', focus: { type: 'structure/door' }, done: { near: { type: 'structure/door', r: 10, exact: true } } },
    { id: 'sleep', say: L('Then sleep in your bed: {key:hands}.', '然后上床睡觉：按 {key:hands}。'), key: 'E', focus: { type: 'fixture/furniture/bed' }, done: { statuses: { asleep: true } } },
  ],
  [TUTORIAL_DONE]: [
    { id: 'map', say: L("{key:map} opens the world map. Every place you've been is on it.", '按 {key:map} 打开世界地图，去过的地方都在上面。'), key: 'M', focus: { ui: 'map' }, done: { facts: { 'ui.map': { gte: 1 } } } },
  ],
}

/** A beat of the clearing waits for its day's stage of `awakening` (10 … 80): once past it, it never fires. */
const at = (day: number, when: StepCond = {}): StepCond => ({ ...when, quest: { ...when.quest, awakening: day * 10 } })

export const PROLOGUE_BEATS: StepDef[] = [
  // ---- the tutorial: the clearing, a day and a night
  {
    id: 'tut_wake',
    when: { map: 'tutorial', statuses: { out_cold: false }, quest: { awakening: { lt: 10 } } },
    say: L("Hey! You're awake at last! I'm Lumi. I'm a fairy, and from today I go where you go.", '嘿！你总算醒了！我叫露米，是个精灵。从今天起，你去哪儿，我就跟到哪儿。'),
  },
  {
    id: 'tut_ate',
    when: at(1, { facts: { 'prologue.meals': { gte: 1 } } }),
    say: L("Feeling better? If we want to make anything, we'll need sticks, stones and grass.", '好点了吧？要做东西的话，得先有树枝、石头和草。'),
  },
  {
    id: 'tut_gathered',
    when: at(2, { carrying: ['item/material/stick', 'item/material/stone', 'item/material/grass'] }),
    say: L("That's enough for an axe!", '这些够做一把斧头了！'),
  },
  {
    id: 'tut_axe',
    when: at(3, { carrying: 'item/weapon/blade/axe' }),
    say: L('An axe! Now we need wood.', '有斧头了！现在去弄点木头吧。'),
  },
  {
    id: 'tut_planks',
    when: at(4, { carrying: 'item/material/plank' }),
    say: L("Planks! It gets dark early in the woods, and things come out at night. Let's get a fire going first.", '木板！林子里天黑得早，天一黑就会有东西出来。我们先生一堆火吧。'),
  },
  {
    id: 'tut_fire',
    when: at(5, { near: { type: 'fixture/light/campfire', r: 12, status: 'lit' } }),
    say: L("Oh, that's warm! Now you need a roof over your head.", '好暖和！接下来，给自己盖个屋子吧。'),
  },
  {
    id: 'tut_house',
    when: at(6, { room: 'bedroom' }),
    say: L("A house of your own! Now we just have to get through the night. Eat something before you sleep; there are always more berries. We'll leave at first light.", '你有自己的屋子了！现在只要熬过今晚就好。睡前吃点东西吧，浆果摘完了还会再长。天一亮我们就出发。'),
  },
  {
    id: 'tut_morning',
    when: at(7, { morningAfter: 'tut_house' }),
    facts: { [TUTORIAL_OPEN]: 1 },
    say: L("It's morning! You made it. The path to the south is clear now. Let's go down to the foot of the mountain!", '天亮了！你熬过来了。南边的小路现在能走了，我们下山去吧！'),
  },
  {
    // the way out tried too soon: it is not open yet
    id: 'tut_too_soon',
    when: { map: 'tutorial', region: 'exit', quest: { awakening: { lt: TUTORIAL_DONE * 10 } } },
    say: L("Not that way yet. We'd get lost in those woods. Let's settle in here first.", '先别往那边走，在那片林子里会迷路的。我们先在这儿安顿下来吧。'),
  },
  {
    id: 'tut_out',
    when: { map: 'foot', quest: { awakening: TUTORIAL_DONE * 10 } },
    say: L('The foot of the mountain! See the old stone in the flowers down there?', '到山脚了！你看，下面花丛里有块旧石头。'),
  },
  {
    // a new game: one comes round on Cloudtop (the tutorial run has its own line)
    id: 'summit_wake',
    when: { map: 'summit', facts: { [TUTORIAL_OPEN]: 0 }, quest: { descent: { lt: 20 } } },
    say: L("You're awake! I'm Lumi. I'm a fairy, and from today I go where you go. We're on Cloudtop, at the very top of the mountain. The only way down is through the cut in the rocks to the south.", '你醒啦！我叫露米，是个精灵。从今天起，你去哪儿，我就跟到哪儿。这里是云顶台地，在山的最高处。下山的路只有一条，就是南边岩壁上那道豁口。'),
  },
  {
    // the first waypoint statue in view, whenever that is
    id: 'see_waypoint',
    when: { near: { type: 'fixture/sacred/waypoint', r: 6 }, statuses: { out_cold: false } },
    say: L('Look, a waypoint statue! Walk up to it and press {key:hands} to wake it. After that, the map ({key:map}) can bring you back to it from anywhere.', '看，是传送雕像！走过去按 {key:hands} 唤醒它。以后打开地图（{key:map}），从哪儿都能传送回这里。'),
  },
  {
    id: 'relic',
    when: { map: 'foot', region: 'relic', quest: { descent: { lt: 20 } } },
    say: L("It's cold near it. I don't like it. I don't know why I don't like it. ...Try doing something to it, anything. Whatever you do, the world will answer.", '它旁边好冷。我不喜欢它。我也不知道为什么不喜欢。……你对它做点什么试试，做什么都行。不管你做什么，世界都会回应的。'),
  },
  {
    id: 'tried',
    // after the stone was seen: an experiment anywhere before it is not the stone's lesson
    when: { after: 'relic', facts: { 'world.experiments': { gte: 1 } }, quest: { descent: { lt: 30 } } },
    say: L('Did you see that? It answered! Whatever the world learns is kept in the Threadbook: {key:journal}. Come on, down to the Ford!', '你看到了吗？它回应了！世界学会的东西都记在织线簿里，按 {key:journal} 就能看。走吧，下山去渡口！'),
  },
  {
    // however they got here, the Ford ends the prologue
    id: 'ford',
    when: { map: 'ford', quest: { descent: { lt: 40 } } },
    say: L("That's the Ford! Someone down there looks like they need help.", '是渡口！下面那个人好像遇到麻烦了。'),
  },
]
