// The prologue (docs/prologue.md): down from the plateau to the Ford. Its stage is the player's
// `prologue` prop (1 … 9 on the mountain, 10 once on the Ford); the beats move it on and let
// Pip, the bird, say one line each; the objectives are what the HUD shows meanwhile. Every beat
// waits for a state, never for a path: whatever gets the player there counts.

import type { StepCond, StepDef, Text } from '@lsw/engine'
import type { Objective } from './ford.ts'

const L = (en: string, zh: string): Text => ({ en, zh })

/** The stage at which the prologue is over (the player has reached the Ford). */
export const PROLOGUE_DONE = 10

/** The stage a game that skips the tutorial begins at: at the foot of the mountain, before the seal stone. */
export const PROLOGUE_AT_FOOT = 8

export const PROLOGUE_OBJECTIVES: Record<number, Objective> = {
  1: { title: L('Follow Pip', '跟着小啾'), hint: L('WASD or the arrows move you (Shift walks). Out of the shelter.', 'WASD 或方向键移动（按住 Shift 慢走）。先走出小屋。') },
  2: { title: L('Find something to eat', '找点吃的'), hint: L('F picks up what lies in front of you. Hold it (1–0) and left click yourself to eat.', 'F 捡起面前的东西。用 1–0 拿在手上，左键点自己就能吃。') },
  3: { title: L('Wake the waypoint statue', '唤醒传送雕像'), hint: L('E with empty hands touches what you point at. A woken statue is a place the map (M) can take you back to.', '空手按 E 摆弄鼠标指着的东西。唤醒过的雕像，以后能从地图（M）传送回来。') },
  4: { title: L('Make a stone axe', '做一把石斧'), hint: L('C opens crafting: a stick, a stone and a tuft of grass. The ground keeps yielding them.', 'C 打开制作：一根树枝、一块石头、一把草。地上会不断长出这些材料。') },
  5: { title: L('Clear the way down', '打通下山的路'), hint: L('Hold the axe and left click the pine in the cut: two swings fell it. (Any other way through counts too.)', '拿着斧头，左键点缺口里的松树：砍两下就倒。（别的办法过去也算。）') },
  6: { title: L('Fight your way down the slope', '一路打下山坡'), hint: L('Space strikes ahead; left click strikes what you point at. A felled foe gives experience.', '空格向前攻击，左键攻击鼠标指着的目标。打倒敌人能获得经验。') },
  7: { title: L('Learn a skill', '学一个技能'), hint: L('Each level brings a skill point. K opens the skill tree.', '每升一级获得 1 技能点。按 K 打开技能树。') },
  8: { title: L('Try something the world has never seen', '做一件世界从没见过的事'), hint: L('Use what you hold on the old seal stone, put something on it, strike it — anything. The world learns.', '拿着东西对古老的封印石用一用、放点东西上去、打它一下——什么都行。世界会学习。') },
  9: { title: L('Down to the Ford', '下山去渡口'), hint: L('The trail runs south off the mountain. J: the Threadbook keeps what the world has learned.', '小路往南下山。J：织线簿记着世界学会的事。') },
}

/** Every prologue beat waits for its stage too: once past it, it never fires (nor pulls the stage back). */
const at = (stage: number, when: StepCond = {}): StepCond => ({ ...when, props: { ...when.props, prologue: stage } })

export const PROLOGUE_BEATS: StepDef[] = [
  {
    // the first waypoint statue in view, whenever that is
    id: 'see_waypoint',
    when: { near: { type: 'fixture/sacred/waypoint', r: 6 }, props: { prologue: { gte: 1 } } },
    say: L('Look — a waypoint statue! Walk up and press E to wake it; then the map (M) can take you back to it from anywhere.', '看——是传送雕像！走过去按 E 唤醒它，以后在地图（M）上就能从任何地方传送回来。'),
  },
  {
    id: 'wake',
    when: { map: 'summit', props: { prologue: { lt: 1 } } },
    props: { prologue: 1 },
    say: L('Chirp! You are awake at last! I am Pip. Come on — out of here, there is food outside!', '啾！你终于醒啦！我是小啾。来——先出去，外面有吃的！'),
  },
  {
    id: 'outside',
    when: at(1, { region: 'yard' }),
    props: { prologue: 2 },
    say: L('Hungry? Berries on the ground! F picks them up; then left click yourself to eat.', '饿了吧？地上有浆果！按 F 捡起来，再左键点自己就能吃。'),
  },
  {
    id: 'ate',
    when: at(2, { facts: { 'prologue.meals': { gte: 1 } } }),
    props: { prologue: 3 },
    say: L('Better! Now look around — there is an old statue up here that hums.', '好多了吧！四处看看——这山顶上有座会嗡嗡响的老雕像。'),
  },
  {
    id: 'attuned',
    when: at(3, { facts: { 'waypoints.attuned': { gte: 1 } } }),
    props: { prologue: 4 },
    say: L('It remembers you now — M shows the map, and the statue can bring you back. A pine has grown across the way down. Make an axe: C!', '它记住你了——按 M 看地图，以后能传送回来。下山的路被一棵松树挡住了。做把斧头吧：按 C！'),
  },
  {
    id: 'axe',
    when: at(4, { carrying: 'item/weapon/blade/axe' }),
    props: { prologue: 5 },
    say: L('An axe! Hold it (its number key), then left click the pine. Two swings.', '斧头！按它的数字键拿在手上，然后左键点那棵松树。砍两下。'),
  },
  {
    id: 'cut',
    when: at(5, { region: 'below_cut' }),
    props: { prologue: 6 },
    say: L('The way is open! Slimes on the slope — Space strikes, or left click them.', '路通了！山坡上有史莱姆——按空格攻击，或者左键点它们。'),
  },
  {
    id: 'level',
    when: at(6, { props: { level: { gte: 2 } } }),
    props: { prologue: 7 },
    say: L('You grew stronger! A skill point — K opens the skill tree.', '你变强了！有技能点了——按 K 打开技能树。'),
  },
  {
    id: 'skill',
    when: at(7, { skill: true }),
    props: { prologue: 8 },
    say: L('Good! Down at the foot of the mountain lies an old seal stone, cut with runes nobody can read. Nobody knows what it does — not even the world.', '很好！山脚下有块刻着符文的古老封印石，谁也看不懂。谁也不知道它能做什么——连这个世界都不知道。'),
  },
  {
    id: 'relic',
    when: at(PROLOGUE_AT_FOOT, { map: 'foot', region: 'relic' }),
    say: L('Try anything on it: use what you hold, put something on it, strike it. Whatever you do, the world learns.', '对它做点什么吧：用手里的东西、放点东西上去、打它一下。不管你做什么，世界都会学着回应。'),
  },
  {
    id: 'tried',
    when: at(PROLOGUE_AT_FOOT, { facts: { 'world.experiments': { gte: 1 } } }),
    props: { prologue: 9 },
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
