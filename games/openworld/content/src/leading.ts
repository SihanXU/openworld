// Lumi leads the way (the engine's companion.ts, GuideParams): when the player has done nothing for five seconds with a
// quest tracked, she flies to where it goes next — over the dawnbloom, to Bram, to the door out toward the hill — and
// calls out. Her words, said in turn; an objective's own `nudge` says it better where it has one (quests/).

import type { GuideParams, Text } from '@openworld/engine'

const L = (en: string, zh: string): Text => ({ en, zh })

export const LEADING: GuideParams = {
  // five seconds of nothing (ten ticks a second), eight over the spot, then twenty before she shows it again
  after: 50,
  show: 80,
  every: 200,
  here: [
    L('Here! {thing}, right here!', '这儿！{thing}就在这里！'),
    L('Look — {thing}! This one!', '看——{thing}！就是这个！'),
    L('Hi! Over here!', '嗨！在这里！'),
  ],
  way: [
    L('This way! {thing} is off to the {dir}.', '这边这边！{thing}在{dir}边。'),
    L('Come on, {dir}! Follow me!', '往{dir}走，跟我来！'),
    L("Over here — it's {dir} of us!", '在{dir}边呢，快过来！'),
  ],
  exit: [
    L('{place} is through here!', '{place}从这儿走！'),
    L('This way to {place}! Come on!', '去{place}走这边！快来！'),
    L('Out through here!', '从这里出去！'),
  ],
  dirs: {
    n: L('north', '北'),
    ne: L('north-east', '东北'),
    e: L('east', '东'),
    se: L('south-east', '东南'),
    s: L('south', '南'),
    sw: L('south-west', '西南'),
    w: L('west', '西'),
    nw: L('north-west', '西北'),
  },
}
