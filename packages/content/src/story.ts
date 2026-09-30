// The Hearthvale opening: a short guided arc that walks a new player through the verbs and
// the elemental rules, then hands them the open world. Story state is a player prop
// (`quest`), advanced only by ordinary rules — the story is data like everything else.

import type { Rule, Text } from '@lsw/engine'

const L = (en: string, zh: string): Text => ({ en, zh })

/** Objective shown in the HUD for each value of the player's `quest` prop. */
export const OBJECTIVES: Record<number, { title: Text; hint: Text }> = {
  0: {
    title: L('Talk to Elder Maren in the village square', '去村中广场和玛伦村长谈谈'),
    hint: L('Walk up to her and press E.', '走到她面前按 E。'),
  },
  1: {
    title: L('Drive the slimes out of the fields (0/3)', '把田里的史莱姆赶走（0/3）'),
    hint: L('Hold a weapon or wand and press Space. Wet slimes freeze; fire makes wet ones steam.', '拿着武器或魔杖按空格。湿史莱姆会被冻住，火打在湿的身上会化成蒸汽。'),
  },
  2: {
    title: L('Ask Brann the smith about the noise from the woods', '问问铁匠布兰森林里的怪声'),
    hint: L('The smithy is east of the square. Put away what you hold (Q) to talk.', '铁匠铺在广场东边。先按 Q 收起手中物品再对话。'),
  },
  3: {
    title: L('Find the Slime King in Slime Hollow', '到史莱姆洞窟找到史莱姆王'),
    hint: L('Whisperwood lies south of the village; the cave is past the meadow.', '低语森林在村子南边，洞窟在草甸那头。'),
  },
  4: {
    title: L('Return to Elder Maren', '回去找玛伦村长'),
    hint: L('She will want to hear about the Slime King.', '她一定想听听史莱姆王的事。'),
  },
  5: {
    title: L('The world is yours', '世界交给你了'),
    hint: L('Try anything — use things on people, creatures, objects. What the world does not know yet, it learns (` Mod Console).', '随便试——把东西用在人、怪物、物件上。世界还不懂的事，它会学（` 模组控制台）。'),
  },
}

const quest = (n: number) => ({ quest: n })
const talk = (id: string, stage: number): Rule['when'] => ({
  verb: ['interact'],
  actor: { player: true, props: quest(stage) },
  target: { id },
  instrument: { none: true },
})

const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })

export const STORY_RULES: Rule[] = [
  story({
    id: 'story/maren-1',
    doc: 'Opening: the elder asks you to deal with the slimes.',
    on: 'interaction',
    when: talk('npc.maren', 0),
    do: [
      { op: 'say', who: 'target', text: L('You must be the one who arrived last night. The slimes are in the fields again — would you drive off three of them? Take one of the wands lying by the well.', '你就是昨晚到的那位吧。史莱姆又钻进田里了——能帮忙赶走三只吗？井边地上有魔杖，拿去用。') },
      { op: 'setProp', of: 'actor', key: 'quest', value: 1 },
      { op: 'vfx', at: 'target', fx: 'sparkle' },
    ],
  }),
  story({
    id: 'story/slime-count',
    doc: 'Count slimes the player defeats.',
    on: 'defeat',
    compose: true,
    when: { target: { type: 'actor/creature/slime' }, actor: { player: true } },
    do: [{ op: 'addProp', of: 'actor', key: 'slimes', delta: 1 }],
  }),
  story({
    id: 'story/slimes-done',
    doc: 'Third slime while on the slime errand: move on.',
    on: 'defeat',
    compose: true,
    when: { target: { type: 'actor/creature/slime' }, actor: { player: true, props: quest(1) } },
    guard: { prop: { role: 'actor', key: 'slimes', cmp: { gte: 2 } } },
    do: [
      { op: 'setProp', of: 'actor', key: 'quest', value: 2 },
      { op: 'log', text: L('The fields are quiet — but something rumbles in the woods.', '田里安静了——可森林里传来一阵隆隆声。') },
    ],
  }),
  story({
    id: 'story/brann',
    doc: 'The smith points you to the cave and hands you a key.',
    on: 'interaction',
    when: talk('npc.brann', 2),
    do: [
      { op: 'say', who: 'target', text: L('That rumble? Slime Hollow, south past the meadow. Something big nests there. Take this key — the old supply chest down there is locked. And bring water: slimes hate being wet when lightning is about.', '那隆隆声？是史莱姆洞窟，在草甸南边。里面窝着个大家伙。拿着这把钥匙——洞里那个旧补给箱是锁着的。再带点水：史莱姆最怕身上湿着的时候挨雷劈。') },
      { op: 'spawn', type: 'item/key', at: 'actor', into: 'contents' },
      { op: 'setProp', of: 'actor', key: 'quest', value: 3 },
    ],
  }),
  story({
    id: 'story/king-down',
    doc: 'Defeating the Slime King.',
    on: 'defeat',
    compose: true,
    when: { target: { type: 'actor/creature/slime/king_slime' } },
    do: [
      { op: 'vfx', at: 'tileOf:target', fx: 'explosion' },
      { op: 'log', text: L('The Slime King bursts into a shower of goo!', '史莱姆王炸成了一滩黏液！') },
      { op: 'spawn', type: 'item/gem', at: 'tileOf:target' },
    ],
  }),
  story({
    id: 'story/king-quest',
    on: 'defeat',
    compose: true,
    when: { target: { type: 'actor/creature/slime/king_slime' }, actor: { player: true, props: quest(3) } },
    do: [{ op: 'setProp', of: 'actor', key: 'quest', value: 4 }],
  }),
  story({
    id: 'story/maren-2',
    doc: 'Report back; the elder explains how the world works.',
    on: 'interaction',
    when: talk('npc.maren', 4),
    do: [
      { op: 'say', who: 'target', text: L('The Slime King, gone! Hearthvale owes you. Here — potions for the road. And a secret: this world answers whatever you try. If it has never seen a thing before, it will learn it.', '史莱姆王没了！炉谷欠你一份情。拿着，路上用的药水。再告诉你个秘密：这个世界会回应你尝试的一切。它从没见过的事，它会学会。') },
      { op: 'spawn', type: 'item/potion/healing', at: 'actor', into: 'contents', count: 2 },
      { op: 'setProp', of: 'actor', key: 'quest', value: 5 },
      { op: 'vfx', at: 'actor', fx: 'sparkle' },
    ],
  }),
]
