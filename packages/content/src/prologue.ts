// The prologue (docs/prologue.md): the tutorial (stages 1 … TUTORIAL_DONE), then the foot of the mountain and
// down to the Ford. Its stage is the player's `prologue` prop (PROLOGUE_AT_FOOT at the foot, the
// stage a game that skips the tutorial begins at; PROLOGUE_DONE once on the Ford); the beats move
// it on and let Pip, the bird, say one line each; the objectives are what the HUD shows meanwhile.
// Every beat waits for a state, never for a path: whatever gets the player there counts.

import type { StepCond, StepDef, Text } from '@lsw/engine'
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

export const PROLOGUE_OBJECTIVES: Record<number, Objective> = {
  1: { title: L('Find something to eat', '找点吃的'), hint: L('WASD moves you. F picks up what you point at; hold it (1–0) and right click to eat it.', 'WASD 移动。F 捡起鼠标指着的东西；用 1–0 拿在手上，右键吃掉。') },
  2: { title: L('Gather sticks, stones and grass', '收集树枝、石头和草'), hint: L('They lie about the clearing, and more turn up. F picks them up; Tab shows the bag.', '空地上到处都有，而且会不断长出来。F 捡起来；Tab 打开背包。') },
  3: { title: L('Make a stone axe', '做一把石斧'), hint: L('C opens crafting: a stick, a stone and a tuft of grass.', 'C 打开制作：一根树枝、一块石头、一把草。') },
  4: { title: L('Fell a tree and split planks', '砍树，劈出木板'), hint: L('Hold the axe and left click a tree: it falls into logs. Left click a log with the axe: planks.', '拿着斧头左键点树，树倒下变成原木；再用斧头左键点原木，劈成木板。') },
  5: { title: L('Build a campfire and light it', '搭一堆营火并点燃'), hint: L('B opens building: a ring of stones and sticks is a campfire. C makes a torch (a stick and grass); left click the fire with it.', 'B 打开建造：石头和树枝围成营火。C 做一支火把（树枝加草），拿着它左键点营火。') },
  6: { title: L('Build a house with a bed', '盖一间有床的屋子'), hint: L('C makes walls, a door, a floor and a bed from planks. G sets them down: walls and a door round you, the bed at your feet. The floor over your head is the ceiling: hold G and choose The ceiling (or in the build palette, B, R turns a floor into a ceiling).', 'C 用木板做墙、门、地板和床。G 放下：墙和门围住自己，床放在脚下。头顶那块是天花板：长按 G 选“天花板”（或在建造模式 B 里按 R 把地板切换成天花板）。') },
  7: { title: L('Get through the night', '熬过这一夜'), hint: L('Things walk in the dark. Sleep in your bed (E) — not on an empty stomach, or hunger wakes you in the night. At first light we go.', '天黑以后会有东西出来游荡。在床上睡一觉（E）——别空着肚子睡，不然会半夜饿醒。天一亮我们就出发。') },
  [TUTORIAL_DONE]: { title: L('Take the path south', '沿小路往南走'), hint: L('The path out of the clearing runs south, down to the foot of the mountain.', '空地南边的小路通往山脚。') },
  [PROLOGUE_AT_FOOT]: { title: L('Try something the world has never seen', '做一件世界从没见过的事'), hint: L('Use what you hold on the old seal stone, put something on it, strike it — anything. The world learns.', '拿着东西对古老的封印石用一用、放点东西上去、打它一下——什么都行。世界会学习。') },
  [PROLOGUE_AT_FOOT + 1]: { title: L('Down to the Ford', '下山去渡口'), hint: L('The trail runs south off the mountain. J: the Threadbook keeps what the world has learned.', '小路往南下山。J：织线簿记着世界学会的事。') },
}

/** Every prologue beat waits for its stage too: once past it, it never fires (nor pulls the stage back). */
const at = (stage: number, when: StepCond = {}): StepCond => ({ ...when, props: { ...when.props, prologue: stage } })

export const PROLOGUE_BEATS: StepDef[] = [
  // ---- the tutorial: the clearing, a day and a night
  {
    id: 'tut_wake',
    when: { map: 'tutorial', statuses: { out_cold: false }, props: { prologue: { lt: 1 } } },
    props: { prologue: 1 },
    say: L('Chirp! You are awake at last! I am Pip. You must be starving — there are berries on the ground. F picks them up, a right click eats.', '啾！你终于醒啦！我是小啾。你一定饿坏了吧——地上有浆果。按 F 捡起来，右键就能吃。'),
  },
  {
    id: 'tut_ate',
    when: at(1, { facts: { 'prologue.meals': { gte: 1 } } }),
    props: { prologue: 2 },
    say: L('Better! To make anything we need sticks, stones and grass. They lie all about — F picks them up.', '好多了吧！要做东西，得先有树枝、石头和草。到处都有——按 F 捡起来。'),
  },
  {
    id: 'tut_gathered',
    when: at(2, { carrying: ['item/material/stick', 'item/material/stone', 'item/material/grass'] }),
    props: { prologue: 3 },
    say: L('That is an axe\'s worth! C opens crafting — make a stone axe.', '这些够做一把斧头了！按 C 打开制作，做一把石斧。'),
  },
  {
    id: 'tut_axe',
    when: at(3, { carrying: 'item/weapon/blade/axe' }),
    props: { prologue: 4 },
    say: L('An axe! Hold it and left click a tree in the grove. Then the axe on a log splits it into planks.', '斧头！拿在手上，左键点东边林子里的树。再用斧头点原木，就能劈成木板。'),
  },
  {
    id: 'tut_planks',
    when: at(4, { carrying: 'item/material/plank' }),
    props: { prologue: 5 },
    say: L('Planks! Night comes early in the woods, and things walk in the dark. A fire first: B, a ring of stones and sticks — and a torch to light it (C).', '木板！林子里天黑得早，天黑以后会有东西出来游荡。先生火：按 B 用石头和树枝围一堆营火，再做支火把（C）点着它。'),
  },
  {
    id: 'tut_fire',
    when: at(5, { near: { type: 'fixture/light/campfire', r: 12, status: 'lit' } }),
    props: { prologue: 6 },
    say: L('Warm! Now a roof over your head: walls and a door round you, a bed at your feet and a ceiling over it all. C makes them from planks; G sets them down (hold G for the ceiling).', '暖和了！现在给自己盖个顶：墙和门围住自己，床放在脚下，再在头顶铺上天花板。C 用木板做，G 放下（长按 G 选天花板）。'),
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
