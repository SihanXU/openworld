// The prologue (docs/prologue.md): the tutorial (stages 1 … 8), then the foot of the mountain and
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

export const PROLOGUE_OBJECTIVES: Record<number, Objective> = {
  [PROLOGUE_AT_FOOT]: { title: L('Try something the world has never seen', '做一件世界从没见过的事'), hint: L('Use what you hold on the old seal stone, put something on it, strike it — anything. The world learns.', '拿着东西对古老的封印石用一用、放点东西上去、打它一下——什么都行。世界会学习。') },
  [PROLOGUE_AT_FOOT + 1]: { title: L('Down to the Ford', '下山去渡口'), hint: L('The trail runs south off the mountain. J: the Threadbook keeps what the world has learned.', '小路往南下山。J：织线簿记着世界学会的事。') },
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
