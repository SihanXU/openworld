// Chapter 1, the First Seal (docs/chapter-1.md, docs/lore.md): the quests, objectives and story rules of
// the chapter. Its scenes (the night of the flame, the letter, the kingdom, the crown, the return) are in
// tools/src/demo/quest/chapter1.ts, where the maps are.
//
// The stages are the player's `quest` prop: 0 (the barrow), 0.5 (the night of thanks), 0.6 (the morning
// after), 0.7 (the pilgrim's road), 1 (the bridge), 2 (the White Knight's road), 2.5 (home with the Crown),
// 2.9 (the road to Emberfall: Chapter 2). The story's facts are `ch1.*`; `night.shift` is how much longer
// the night has grown (calendar.ts).

import type { QuestDef, Rule, Text } from '@lsw/engine'
import type { Objective } from './ford.ts'

const L = (en: string, zh: string): Text => ({ en, zh })

/** The story's facts of the chapter. */
export const CH1 = {
  flameStolen: 'ch1.flame_stolen',
  letter: 'ch1.letter',
  pilgrim: 'ch1.pilgrim',
  knight: 'sins.defeated.alberic',
  crown: 'ch1.crown',
  end: 'ch1.end',
} as const

/** The White Knight on the East Road (the campaign's body; the Boss Studio stages its own). */
export const ALBERIC_ID = 'eastroad.alberic'

/** Pell's drawings: the chalk fixtures and the facts reading each sets. */
export const DRAWINGS = ['stone', 'door', 'bridge', 'man'] as const

export const CH1_OBJECTIVES: Record<number, Objective> = {
  0.5: {
    title: L('A night of thanks', '感恩之夜'),
    hint: L('Lina and Oskar are home. Firstlight gives thanks at its flame after nightfall: be in the village after dark.', '莉娜和奥斯卡回家了。天黑以后，初原村会在圣火前感恩：入夜时待在村里。'),
  },
  0.6: {
    title: L('The morning after', '第二天早上'),
    hint: L('The Firstlight is gone. Wait for morning in the village: something is coming up the road.', '初火不见了。在村里等到天亮：有人正沿着大路赶来。'),
  },
  0.7: {
    title: L("The pilgrim's road", '朝圣之路'),
    hint: L('The Holy City has called the pilgrimage. Sister Ilse, at the cold altar, will tell you where it begins (E).', '圣城发布了朝圣令。冷掉的祭坛边，伊尔丝修女会告诉你朝圣从哪里开始（E）。'),
  },
  2: {
    title: L("The White Knight's road", '白骑士之路'),
    hint: L('Follow the road east past the burned farm. The First Seal-bearer, the White Knight Alberic, holds it as his kingdom. Watch where his blows will land, and be elsewhere.', '沿着大路往东走，经过烧毁的农庄。第一位持印者——白骑士阿尔贝里克——把那条路当成了他的王国。看清他的攻击会落在哪里，然后躲开。'),
  },
  2.5: {
    title: L('Bring the Crown home', '把荆棘冠带回去'),
    hint: L('The First Seal has fallen. Carry the Crown of Thorns back to Firstlight.', '第一印已经倒下。把荆棘冠带回初原村。'),
  },
  2.9: {
    title: L('Chapter 2: the road to Emberfall', '第二章：通往余烬镇的路'),
    hint: L('The knight\'s kingdom is open. Beyond it, the road runs east to Emberfall.', '骑士的王国敞开了。穿过它，大路一直往东通向余烬镇。'),
  },
}

/** The chapter's quests: the main one Sister Ilse gives after the letter, and the villagers' own errands. */
export const CH1_QUESTS: QuestDef[] = [
  // ------------------------------------------------------------------ main
  {
    id: 'pilgrim',
    kind: 'main',
    title: L("The Pilgrim's Road", '朝圣之路'),
    summary: L('The Seal-bearers fail and the Long Night returns. The first of them, the White Knight Alberic, holds the road east beyond the Ford. Before you go: hear Fennick on the knight, ask Joss about the bridge, and Hesper what she saw.', '持印者正在衰败，极夜正在回来。第一位持印者白骑士阿尔贝里克，守在渡口以东的大路上。出发之前：听芬尼克讲讲那位骑士，问问乔斯桥的事，再问问赫斯珀她看到了什么。'),
    giver: 'npc.ilse',
    requires: { facts: { [CH1.letter]: 1 } },
    offer: L('Astra bore five sufferings so that the sun would rise. Five Seal-bearers carry them still, and they are failing. The first holds the road beyond our ford. Talk to those who know the way — Fennick, Joss, Hesper — then go.', '阿斯特拉承受了五苦，太阳才得以升起。五位持印者至今背负着它们，而他们正在衰败。第一位就守在我们渡口那边的路上。去问问认得路的人——芬尼克、乔斯、赫斯珀——然后出发吧。'),
    waiting: L('Fennick by the bench, Joss at his workbench, Hesper at the Ford. They each know a piece of the road.', '芬尼克在长凳边，乔斯在工作台旁，赫斯珀在渡口。他们每人都知道这条路的一段。'),
    done: L('Then go with the blessing of the Five. Suffering is not God\'s abandonment — remember that, out there.', '那就带着五苦的祝福去吧。苦难并非神的遗弃——到了外面，记住这句话。'),
    goals: [
      { id: 'fennick', kind: 'talk', npc: 'npc.fennick', line: L('Alberic? When he plants his sword, the thorns come up in a ring around him. Inside the ring, or well outside it — never on it. And when he draws his bow, do not stand in front of him.', '阿尔贝里克？他把剑插进地里的时候，荆棘会在他周围长成一圈。站在圈里，或者离得远远的——就是别站在圈上。他拉弓的时候，别站在他正前方。'), label: L('Hear Fennick on the knight', '听芬尼克讲那位骑士') },
      { id: 'joss', kind: 'talk', npc: 'npc.joss', line: L('Three planks fill the gap. An axe fells a tree and splits a log; lay the planks on the water. Or go round some other way — the river does not care how.', '三块木板就能补上缺口。斧头砍树、劈木头；把木板铺到水面上。或者想别的办法过去——河才不在乎你怎么过。'), label: L('Ask Joss about the bridge', '问乔斯桥的事') },
      { id: 'hesper', kind: 'talk', npc: 'npc.hesper', line: L('White, all of him. A crown of thorns grown through his helm. He pulled my bridge out board by board and laid the nails on the pier like a toll paid. He did not look at me once.', '他浑身是白的。荆棘冠长进了他的头盔里。他一块一块把我的桥拆了，把钉子摆在码头上，像是在收过路费。他一眼都没看我。'), label: L('Ask Hesper what she saw', '问赫斯珀她看到了什么') },
    ],
    reward: { xp: 40, items: [{ type: 'item/food/bread', count: 2 }], facts: { [CH1.pilgrim]: 1 }, props: { quest: 1 } },
  },
  // ------------------------------------------------------------------ side
  {
    id: 'drawings',
    kind: 'side',
    title: L("Pell's Drawings", '佩尔的涂鸦'),
    summary: L('Pell draws the grey man wherever he has seen him: by the shrine stone at the Mountain Foot, at the barrow door, by the footbridge, and here by the flame. Find all four drawings (E reads one).', '佩尔在每个见过灰衣人的地方都画了画：山脚的路碑旁、古墓门口、小桥边，还有村里的圣火旁。找到全部四幅画（按 E 查看）。'),
    giver: 'npc.pell',
    offer: L('Nobody believes me. So I drew him everywhere I saw him. Four places! If you find them all, you\'ll see. Then you\'ll believe me.', '没人信我。所以我在每个见过他的地方都画了下来。四个地方！你要是都找到了，就明白了。然后你就会信我了。'),
    waiting: L('The shrine stone up the mountain, the barrow door, the little bridge, and here by the fire. I draw small, look down.', '山上的路碑、古墓的门、小桥，还有这边火堆旁。我画得小，要往地上看。'),
    done: L('You saw? He was there every time — the night before something bad. He wasn\'t doing the bad thing. He was there first. Here, you can have my other warm stone.', '你看到了吧？每次他都在——都是坏事发生的前一天晚上。坏事不是他干的。他只是先到了。给，我另一块暖石头给你。'),
    goals: DRAWINGS.map((d) => ({ id: d, kind: 'fact' as const, fact: `ch1.drawing.${d}`, count: 1, label: { stone: L('The shrine stone', '路碑'), door: L('The barrow door', '古墓的门'), bridge: L('The footbridge', '小桥'), man: L('The flame', '圣火旁') }[d] })),
    reward: { xp: 30, items: [{ type: 'item/misc/warm_ember', count: 1 }] },
  },
  {
    id: 'measure',
    kind: 'side',
    title: L('The Measure of Days', '日之度量'),
    summary: L('Nessa needs readings of the sky from the waypoint statues. Wake three of them (E on each): the Mountain Foot\'s, the village\'s, the Ford\'s, or the one on the East Road.', '奈莎需要在传送雕像上读取天象数据。唤醒其中三座（对每座按 E）：山脚的、村里的、渡口的，或者东大路上的那座。'),
    giver: 'npc.nessa',
    offer: L('The statues are older than the Church. They hum at the hour of sunset — if I can read three of them, I can tell how fast the days are going. Wake three for me?', '那些雕像比教会还古老。日落时分它们会嗡嗡作响——只要能读到三座，我就能算出白天缩短得有多快。帮我唤醒三座？'),
    waiting: L('Three statues. The one at the Mountain Foot, ours by the square, the Ford\'s... they are all humming the same note, lower every week.', '三座雕像。山脚那座、我们广场边这座、渡口那座……它们哼的都是同一个音，一周比一周低。'),
    done: L('Lower every week, and faster than the old almanac says. Take it — I have copied what I need. Read the last pages. I cannot make sense of them.', '一周比一周低，而且比旧历书说的还快。拿去吧——我需要的都抄下来了。读读最后几页。我怎么也看不懂。'),
    goals: [{ id: 'statues', kind: 'fact', fact: 'waypoints.attuned', count: 3, label: L('Waypoint statues woken', '唤醒的传送雕像') }],
    reward: { xp: 30, items: [{ type: 'item/document/almanac', count: 1 }] },
  },
  {
    id: 'templar',
    kind: 'side',
    title: L('The Old Templar', '老骑士'),
    summary: L('Fennick will not send anyone against a Seal-bearer who has not stood a night in the wild. Put down 3 of the dead that walk after dark (outside the village).', '芬尼克不会让没在荒野里熬过一夜的人去挑战持印者。在天黑后打倒 3 个游荡的亡灵（村子外面）。'),
    giver: 'npc.fennick',
    requires: { facts: { [CH1.letter]: 1 } },
    offer: L('You want to face a Seal-bearer? Then face the night first. The dead walk the grassland after dark. Put three of them down and come back with your legs still under you.', '你想去挑战持印者？那就先挑战夜晚。天黑以后草原上有亡灵游荡。打倒三个，然后自己走回来。'),
    waiting: L('Three of the dead. They come out after dark, out past the fence. Keep moving.', '三个亡灵。天黑以后出来，在围栏外面。别停下脚步。'),
    done: L('Still standing. Good. Take my old helm — it stopped worse than claws, once.', '还站着。好。拿上我的旧头盔——它以前挡过比爪子更狠的东西。'),
    goals: [{ id: 'dead', kind: 'defeat', type: 'actor/creature/undead/zombie', count: 3, label: L('The dead put down', '打倒的亡灵') }],
    reward: { xp: 40, items: [{ type: 'item/armor/helmet', count: 1 }] },
  },
  {
    id: 'nail',
    kind: 'side',
    title: L('The Ninth Nail', '第九根钉子'),
    summary: L('Nine nails held the bridge\'s three boards; eight lay on the pier. Joss wants the ninth back. It went with whoever took the bridge — east.', '小桥三块木板一共用了九根钉子；码头上只摆着八根。乔斯想把第九根找回来。它跟着拆桥的人去了——东边。'),
    giver: 'npc.joss',
    requires: { facts: { [CH1.letter]: 1 } },
    offer: L('Eight nails on the pier. Eight. I drove nine. Whoever took my bridge kept one — find it for me, if you go that way.', '码头上八根钉子。八根。我钉了九根。拆我桥的人留了一根——你要是往那边去，帮我找回来。'),
    waiting: L('The ninth nail. Square-headed, pulled straight. You\'ll know it.', '第九根钉子。方头的，拔得笔直。你一看就知道。'),
    done: L('The ninth. ...Twenty years that bridge stood. Here — a proper hammer. You\'ve earned it.', '第九根。……那座桥立了二十年。给——一把像样的锤子。这是你应得的。'),
    goals: [{ id: 'nail', kind: 'carry', type: 'item/misc/ninth_nail', count: 1, consume: true, label: L('The ninth nail', '第九根钉子') }],
    reward: { xp: 30, items: [{ type: 'item/tool/smith_hammer', count: 1 }] },
  },
  {
    id: 'band',
    kind: 'side',
    title: L("Edda's Ring", '艾达的戒指'),
    summary: L('The White Knight took Edda\'s late husband\'s wedding band off her gatepost, with everything else that shone. It is somewhere in his kingdom up the road.', '白骑士把艾达亡夫的婚戒从她家门柱上拿走了，连同所有会发光的东西。它就在大路那头他的王国里。'),
    giver: 'npc.edda',
    offer: L('If you\'re going up the road — my husband\'s ring. The knight took it with everything else. I don\'t care about the rest.', '你要是往那条路上去——我丈夫的戒指。骑士把它和别的东西一起拿走了。别的我都不在乎。'),
    waiting: L('A plain band. It\'s all I have of him.', '一枚普通的戒指。这是他留给我的全部。'),
    done: L('...Thank you. I\'ll wear it now. I was keeping it on the gate so he could find his way home.', '……谢谢你。我现在就戴上。之前我把它挂在门上，是想让他能找到回家的路。'),
    goals: [{ id: 'band', kind: 'carry', type: 'item/valuable/band', count: 1, consume: true, label: L('The wedding band', '婚戒') }],
    reward: { xp: 30, items: [{ type: 'item/food/egg', count: 2 }, { type: 'item/food/bread', count: 1 }] },
  },
]

const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })

/** Reading a chalk drawing tells the story which one (`drawing.<id>`), and the story keeps it. */
export const CH1_RULES: Rule[] = [
  ...DRAWINGS.map((d): Rule => story({
    id: `ch1/drawing-${d}`,
    doc: `Pell's drawing (${d}), read with a hand: what it shows, and the story hears it was found.`,
    host: { type: `fixture/chalk/${d}` },
    on: 'impulse/handle',
    tree: { do: [{ op: 'say', text: '@line' }, { op: 'emit', impulse: 'notify', to: 'story', params: { what: `drawing.${d}` } }] },
  })),
  story({
    id: 'ch1/story',
    doc: 'The story keeps which of Pell\'s drawings have been found.',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: DRAWINGS.reduceRight<Rule['tree']>((rest, d) => ({ if: { param: { key: 'what', cmp: `drawing.${d}` } }, then: { do: [{ op: 'setProp', key: `ch1.drawing.${d}`, value: 1 }] }, else: rest }), 'inherit'),
  }),
]
