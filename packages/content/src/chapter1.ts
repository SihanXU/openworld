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
    title: L('The vigil, and a night of thanks', '守夜与感恩之夜'),
    hint: L('Lina and Oskar are home. Prepare the vigil for Sister Ilse — oil from Millbrook (west), dawnbloom and the chapel bell on Dawn Hill (north) — then be in the village after dark.', '莉娜和奥斯卡回家了。为伊尔丝修女备好守夜——西边水车磨坊的油，北边晨光丘的晨光花和礼拜堂的钟——然后入夜时待在村里。'),
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

/** A named piece of gear a quest pays (docs/chapter-1.md §11, the chapter's gear): its slot, its tier, what it gives. */
export const gear = (type: string, slot: string, en: string, zh: string, quality: string, props: Record<string, number> = {}) =>
  ({ type, count: 1, name: L(en, zh), tags: quality === 'common' ? [] : [`quality:${quality}`], props: { slot, ...props } })

/** Facts that say the story has gone past the White Knight (a quest before him is behind you). */
const PAST_KNIGHT = { [CH1.knight]: { ne: 0 } } as const

/**
 * The chapter's quests. The main line never breaks (docs/chapter-1.md §11): *Down from the Mountain* from the
 * first step, Rowan's *Lost in the Barrow* from the welcome, *The First Seal* (the White Knight) from the
 * rescue, *The Crown* from the knight's fall — each taken on by itself as the last ends; whatever comes
 * before the knight is done once he falls, however he was reached. Then Sister Ilse's road and the
 * villagers' own errands.
 */
export const CH1_QUESTS: QuestDef[] = [
  // ------------------------------------------------------------------ main
  {
    id: 'descent',
    kind: 'main',
    title: L('Down from the Mountain', '下山'),
    summary: L('You woke on Cloudtop with a fairy at your side. Go down: past the old shrine stone at the Mountain Foot, down the cliff stair to the Ford, and west to the village there.', '你在云顶台地醒来，身边多了一个精灵。下山吧：经过山脚的古老路碑，顺着悬崖台阶下到渡口，再往西去那里的村子。'),
    giver: 'npc.rowan',
    auto: true,
    self: true,
    skipWhen: { 'seen.village_arrival': { ne: 0 } },
    offer: L('', ''),
    done: L('', ''),
    goals: [
      { id: 'stone', kind: 'fact', fact: 'seen.relic', count: 1, label: L('The shrine stone at the Mountain Foot', '山脚的路碑') },
      { id: 'ford', kind: 'fact', fact: 'seen.ford', count: 1, label: L('Down the cliff stair to the Ford', '顺着悬崖台阶下到渡口') },
      { id: 'village', kind: 'fact', fact: 'seen.village_arrival', count: 1, label: L('West to Firstlight Village', '往西到初原村') },
    ],
    reward: { xp: 15, items: [gear('item/clothing/boots', 'feet', "Traveller's Boots", '旅人的靴子', 'common', { def: 1 })] },
  },
  {
    id: 'vigil',
    kind: 'main',
    title: L('The Vigil', '守夜之备'),
    summary: L('Firstlight keeps a vigil at its flame for those who come home. Sister Ilse needs lamp oil from the cellar at Millbrook, west of the village; dawnbloom from Dawn Hill, north of it; and the old bell rung in the Chapel of the First Dawn on the hill\'s top. Beyond the vigil, the road east and the White Knight wait.', '初原村会为归来的人在圣火前守夜。伊尔丝修女需要：村子西边水车磨坊地窖里的灯油；村子北边晨光丘上的晨光花；还有在丘顶初晓礼拜堂里敲响那口旧钟。守夜之后，东边的大路和白骑士在等着你。'),
    giver: 'npc.ilse',
    auto: true,
    requires: { quests: ['rescue'] },
    skipWhen: PAST_KNIGHT,
    offer: L('', ''),
    waiting: L('Oil from Tam\'s cellar, dawnbloom from the hill, and the bell. The bell was rung the morning the sun came back. It should be rung for this.', '塔姆地窖里的油，丘上的晨光花，还有那口钟。太阳回来的那天早上，有人敲响过它。今晚也该敲响它。'),
    done: L('The lamps are trimmed and the bell has rung. Tonight, after dark, Firstlight gives thanks. Stay for it.', '灯已经备好，钟也敲响了。今晚天黑以后，初原村要感恩。留下来吧。'),
    goals: [
      { id: 'oil', kind: 'carry', type: 'item/vessel/flask/oil', count: 2, consume: true, label: L('Vigil oil from the mill cellar (Millbrook, west)', '磨坊地窖里的守夜灯油（往西，水车磨坊）') },
      { id: 'bloom', kind: 'carry', type: 'item/material/herb', count: 3, consume: true, label: L('Dawnbloom from Dawn Hill (north)', '晨光丘上的晨光花（往北）') },
      { id: 'bell', kind: 'fact', fact: 'seen.chapel_bell', count: 1, label: L('Ring the bell in the Chapel of the First Dawn', '在初晓礼拜堂敲响那口钟') },
    ],
    reward: { xp: 50, items: [gear('item/clothing/cloak', 'shoulders', 'Cloak of the Dawn Vigil', '晨光守夜斗篷', 'masterwork', { def: 2, 'night:def': 1 })], facts: { 'ch1.vigil': 1 } },
  },
  {
    id: 'first_seal',
    kind: 'main',
    title: L('The First Seal', '第一印'),
    summary: L('The days grow shorter. Beyond the Ford, on the road east, the White Knight Alberic — the First Seal-bearer — holds the land as his kingdom, and nothing crosses that does not kneel. Firstlight gives thanks tonight; then the road, the river, and the knight.', '白昼越来越短。渡口那边的东大路上，第一位持印者——白骑士阿尔贝里克——把那片土地当成了他的王国，不跪者不得过。今晚初原村要感恩；然后是大路、河流，和那位骑士。'),
    giver: 'npc.ilse',
    auto: true,
    self: true,
    requires: { quests: ['vigil'] },
    skipWhen: PAST_KNIGHT,
    offer: L('', ''),
    done: L('', ''),
    goals: [
      { id: 'thanks', kind: 'fact', fact: CH1.flameStolen, count: 1, label: L('The night of thanks at the flame (Firstlight, after dark)', '圣火前的感恩之夜（入夜后在初原村）') },
      { id: 'letter', kind: 'fact', fact: CH1.letter, count: 1, label: L("The Church's letter (Firstlight, the morning after)", '教会的来信（第二天早上，初原村）') },
      { id: 'river', kind: 'fact', fact: 'ford.crossed', count: 1, label: L('Across the river at the Ford', '在渡口过河') },
      { id: 'knight', kind: 'fact', fact: CH1.knight, count: 1, label: L('Bring down the White Knight Alberic on the East Road', '在东大路打倒白骑士阿尔贝里克') },
    ],
    reward: { xp: 60 },
  },
  {
    id: 'crown_home',
    kind: 'main',
    title: L('The Crown of Thorns', '荆棘冠'),
    summary: L('The First Seal has fallen and the Crown of Thorns is yours. Carry it home to Firstlight.', '第一印已经倒下，荆棘冠在你手里。把它带回初原村。'),
    giver: 'npc.ilse',
    auto: true,
    self: true,
    requires: { facts: PAST_KNIGHT },
    offer: L('', ''),
    done: L('', ''),
    goals: [{ id: 'home', kind: 'fact', fact: CH1.end, count: 1, label: L('Bring the Crown home to Firstlight', '把荆棘冠带回初原村') }],
    reward: { xp: 30 },
  },
  {
    id: 'pilgrim',
    kind: 'side',
    skipWhen: PAST_KNIGHT,
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
    reward: { xp: 40, items: [{ type: 'item/food/bread', count: 2 }, gear('item/valuable/amulet', 'neck', 'Amulet of the Five Wounds', '五伤护符', 'masterwork', { def: 2 })], facts: { [CH1.pilgrim]: 1 }, props: { quest: 1 } },
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
    reward: { xp: 30, items: [{ type: 'item/misc/warm_ember', count: 1 }, gear('item/clothing/cloak', 'shoulders', 'Chalk-dusted Cloak', '沾满粉笔灰的斗篷', 'fine', { def: 1 })] },
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
    reward: { xp: 30, items: [{ type: 'item/document/almanac', count: 1 }, gear('item/valuable/ring', 'ring', "Surveyor's Ring", '测天者的戒指', 'fine', { atk: 1 })] },
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
    reward: { xp: 40, items: [gear('item/armor/helmet', 'head', "Fennick's Squire Helm", '芬尼克的侍从头盔', 'vowed', { def: 3, dodge: 0.1 })] },
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
    reward: { xp: 30, items: [{ type: 'item/tool/smith_hammer', count: 1 }, gear('item/clothing/belt', 'waist', "Joss's Tool Belt", '乔斯的工具腰带', 'fine', { def: 1 })] },
  },
  {
    id: 'watch',
    kind: 'side',
    title: L("The Watchman's Log", '守夜人的日志'),
    summary: L('The Church kept a watch on Cloudtop, at the top of the mountain, to time the sunset. Nessa wants to know what its log says. Find the logbook in the ruined shelter there and read it (E).', '教会曾在山顶的云顶台地设过观日哨，专门记录日落时间。奈莎想知道哨所的日志里写了什么。到那里的破旧小屋找到日志，读一读（按 E）。'),
    giver: 'npc.nessa',
    offer: L('There was a Church watch on Cloudtop — one man, timing every sunset for the almanacs. His reports stopped coming years ago. If his log is still up there, I need to know what it says.', '云顶台地以前有个教会的观日哨——就一个人，给历书记下每一次日落。他的报告好几年前就断了。要是他的日志还在山上，我得知道上面写了什么。'),
    waiting: L('Cloudtop, above the Mountain Foot. A shelter on the snow. He kept his log on the table, if I know watchmen.', '云顶台地，在山脚上面。雪地上有间小屋。要是我没猜错，守夜人会把日志放在桌上。'),
    done: L('Eleven years. The sunsets were coming early ELEVEN years ago, and he wrote it down every night, and nobody read it. ...And a sleeping light in the snow? Pip, you do not remember a watchman, do you? No. Of course not.', '十一年。十一年前日落就开始提前了，他每天晚上都记下来，却没有人读过。……还有雪里一点睡着的光？小啾，你不记得什么守夜人吧？不记得。当然不记得。'),
    goals: [{ id: 'log', kind: 'fact', fact: 'seen.watch_log', count: 1, label: L("Read the watchman's log on Cloudtop", '读云顶台地上守夜人的日志') }],
    reward: { xp: 30, items: [{ type: 'item/food/bread', count: 2 }, gear('item/valuable/earring', 'ear', 'Star-glass Earring', '星玻璃耳环', 'masterwork', { xpRate: 0.2 })] },
  },
  {
    id: 'herd',
    kind: 'side',
    title: L('Night on the Grassland', '草原守夜'),
    summary: L('Brin\'s herd will not settle: the night-born come up out of the dark onto the grassland, more every week. Put down 3 of the dead that walk there after nightfall.', '布琳的牛群一直不安：夜里的东西从黑暗里爬上草原，一周比一周多。入夜后在草原上打倒 3 个游荡的亡灵。'),
    giver: 'npc.brin',
    offer: L('Three cows gone this month. Not wolves — wolves leave something. The dead walk the grass after dark now, and the herd knows it. Stand a night out here with me?', '这个月丢了三头牛。不是狼——狼总会留下点什么。现在天一黑，死人就在草地上走，牛群都知道。陪我在这儿守一夜？'),
    waiting: L('They come up after dark, from the south end, by the trees. Three of them down and the herd will sleep.', '它们天黑以后从南边树林那头上来。打倒三个，牛群就能睡了。'),
    done: L('They\'re lying down. Lying down properly, not kneeling. ...Here, cheese from the last of the good milk. Thank you.', '它们躺下了。是好好躺下，不是跪着。……给，用最后一点好奶做的奶酪。谢谢你。'),
    goals: [{ id: 'dead', kind: 'defeat', type: 'actor/creature/undead', map: 'pasture', count: 3, label: L('The dead put down on the grassland', '在草原上打倒的亡灵') }],
    reward: { xp: 40, items: [{ type: 'item/food/cheese', count: 2 }, gear('item/valuable/ring', 'ring', "Brin's Bone Ring", '布琳的骨戒', 'fine', { atk: 1 })] },
  },
  {
    id: 'scallop',
    kind: 'side',
    title: L('The Pilgrim Before', '上一位朝圣者'),
    summary: L('A pilgrim camped deep in the forest long ago and never came back. Bring his scallop shell to Sister Ilse.', '很久以前，有个朝圣者在森林深处扎过营，再也没有回来。把他的扇贝徽记带给伊尔丝修女。'),
    giver: 'npc.ilse',
    requires: { facts: { 'seen.pilgrim_camp': { ne: 0 } } },
    offer: L('A camp in the forest, with the Church\'s proclamation nailed up beside it? ...Bring me what he left. If he wore the scallop, bring that.', '森林里的营地，旁边还钉着教会的朝圣令？……把他留下的东西带给我。要是他戴着扇贝徽记，就把那个带来。'),
    waiting: L('The scallop is the pilgrim\'s mark. Every one of us is given one when we are named.', '扇贝是朝圣者的标记。每一个被点名的人都会得到一枚。'),
    done: L('Brother Cassian. He sat in this chapel when I was a novice and asked me to pray for him. The Church named him pilgrim thirty-one years ago. ...They told us he reached the Holy City. Keep it. He would want it walking.', '卡西安修士。我还是见习修女的时候，他坐在这间礼拜堂里，请我为他祈祷。三十一年前，教会点名他为朝圣者。……他们告诉我们，他到达了圣城。你留着吧。他会希望它继续上路。'),
    goals: [{ id: 'scallop', kind: 'carry', type: 'item/valuable/scallop', count: 1, label: L("The pilgrim's scallop", '朝圣者的扇贝') }],
    reward: { xp: 40, items: [{ type: 'item/potion/healing', count: 2 }, gear('item/valuable/amulet', 'neck', "Cassian's Prayer Cord", '卡西安的祈祷绳', 'vowed', { def: 1, 'night:def': 1 })] },
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
    reward: { xp: 30, items: [{ type: 'item/food/egg', count: 2 }, { type: 'item/food/bread', count: 1 }, gear('item/clothing/gloves', 'hands', "Edda's Work Gloves", '艾达的干活手套', 'fine', { def: 1 })] },
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
