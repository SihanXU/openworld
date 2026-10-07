// Chapter 1, the First Seal (docs/chapter-1.md): what the chapter adds to the maps — the village's
// shrine and statue, Pell's chalk drawings, the waypoint statues, the knight's kingdom of thorns on the
// East Road — and its scenes: the night of the flame, the letter, the kingdom, the crown, the return.
// The quests and objectives are content (content/src/chapter1.ts).

import type { Entity, StepDef } from '@lsw/engine'
import { ALBERIC_ID, CH1, createBoss } from '@lsw/content'
import { L } from '../kit.ts'
import { MapBuilder } from '../builder.ts'

const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })

/** Where the chapter puts things (map coordinates). */
export const CH1_AT = {
  village: { shrine: [23, 16] as const, statue: [24, 14] as const, drawing: [20, 16] as const, statueStone: [14, 13] as const, severin: [26, 17] as const, courier: [24, 18] as const },
  ford: { stone: [17, 13] as const, drawing: [27, 21] as const, briars: [[29, 21], [35, 21]] as const },
  foot: { drawing: [22, 13] as const },
  barrow: { drawing: [14, 2] as const, loaf: [7, 20] as const },
  road: {
    knight: [40, 15] as const,
    stone: [30, 12] as const,
    kingdom: [33, 6, 15, 16] as const,
    nail: [38, 9] as const,
    band: [44, 17] as const,
    severin: [36, 13] as const,
    barn: [21, 8] as const,
  },
}

/** The nearest open tile to (x, y): free ground for a thing, walkable ground for an anchor. */
function spot(m: MapBuilder, x: number, y: number, open: 'free' | 'walk' = 'free'): [number, number] {
  for (let r = 0; r <= 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const ok = open === 'free' ? m.free(x + dx, y + dy) : m.walkable(x + dx, y + dy)
        if (ok) return [x + dx, y + dy]
      }
  throw new Error(`no open tile near ${m.id}:${x},${y}`)
}

/** An anchor on the nearest walkable tile. */
const anchor = (m: MapBuilder, name: string, x: number, y: number) => m.anchor(name, ...spot(m, x, y, 'walk'))

/** A chalk drawing (Pell's): readable, with what it shows in both languages. */
function drawing(m: MapBuilder, which: string, x: number, y: number, en: string, zh: string): void {
  ;[x, y] = spot(m, x, y)
  m.fixture(`fixture/chalk/${which}`, x, y, { id: `ch1.drawing.${which}`, props: { text: en, text_zh: zh } })
}

/** A waypoint statue: the map remembers it, and beside it the fairy's power is chosen. */
const statue = (m: MapBuilder, id: string, x: number, y: number, en: string, zh: string) => m.fixture('fixture/sacred/waypoint', ...spot(m, x, y), { id, name: L(en, zh) })

/** Firstlight: the flame beside Astra's altar, a waypoint statue on the square, the people's places. */
export function chapter1Village(m: MapBuilder): void {
  const a = CH1_AT.village
  // Astra's altar beside the flame (a statue would look like a waypoint's: those are the waypoints' alone)
  m.fixture('fixture/sacred/altar', ...spot(m, ...a.statue), { id: 'village.astra', name: L("Astra's altar", '阿斯特拉的祭坛'), props: { text: 'ASTRA, THE FIRST MARTYR. He bore the Five, and the sun rose. — Suffering is not God\'s abandonment.', text_zh: '初殉者·阿斯特拉。他承受五苦，太阳因而升起。——苦难并非神的遗弃。' }, tags: ['readable'] })
  statue(m, 'wp.village', ...a.statueStone, 'Firstlight', '初原村')
  drawing(m, 'man', ...a.drawing, 'A hooded man with a lantern, beside a fire. Underneath, in a child\'s letters: HE WAS HERE FIRST.', '一个提着灯、戴兜帽的人，站在火堆旁。下面是孩子的字迹：他先来的。')
  anchor(m, 'shrine.tend', ...a.shrine)
  anchor(m, 'ilse.home', 10, 14)
  anchor(m, 'joss.bench', 12, 19)
  anchor(m, 'joss.home', 9, 14)
  anchor(m, 'pell.play', 18, 13)
  anchor(m, 'nessa.desk', 27, 16)
  anchor(m, 'nessa.watch', 34, 17)
  anchor(m, 'fennick.bench', 21, 19)
  anchor(m, 'edda.home', 13, 14)
  anchor(m, 'edda.garden', 25, 21)
  anchor(m, 'severin.stand', ...a.severin)
  anchor(m, 'courier.stand', ...a.courier)
}

/** The Ford: a waypoint statue by the camp, Pell's drawing by the footbridge, thorns driven into the bridge's stumps. */
export function chapter1Ford(m: MapBuilder): void {
  const a = CH1_AT.ford
  statue(m, 'wp.ford', ...a.stone, 'The Ford', '渡口')
  drawing(m, 'bridge', ...a.drawing, 'A bridge with its middle gone. A tall figure in white beside it, and a smaller grey one watching from the trees.', '一座中间断掉的桥。桥边站着一个高大的白色身影，树林里有个小一点的灰色身影在看着。')
  for (const [x, y] of a.briars) m.fixture('fixture/nature/briar', ...spot(m, x, y), { name: L('Thorns driven into the stump', '钉进桥桩的荆棘') })
}

/** The Mountain Foot: Pell's drawing beside the shrine stone. */
export function chapter1Foot(m: MapBuilder): void {
  drawing(m, 'stone', ...CH1_AT.foot.drawing, 'The shrine stone, five marks on it, the first scribbled over in black. A grey figure with its hand on it.', '那块路碑，上面五道痕，第一道被涂成了黑色。一个灰色的人把手按在上面。')
}

/** The barrow: Pell's drawing at the door, and the loaf the grey man left the foragers. */
export function chapter1Barrow(m: MapBuilder): void {
  const a = CH1_AT.barrow
  // Lina's side cell: finding her plays the shut door's story
  m.regions.lina_cell = [2, 17, 8, 6]
  drawing(m, 'door', ...a.drawing, 'A door, shut, a hand-mark on it. Behind it, something with a crown of bones. In front, two small people.', '一扇关着的门，门上有个手印。门后是戴着骨冠的东西。门前是两个小人。')
  m.item({ form: 'item/food/bread', name: L('Loaf marked with ash', '印着灰痕的面包') }, ...spot(m, ...a.loaf))
}

/** The East Road: Edda's barn, a waypoint statue before the kingdom, the kingdom of thorns, the knight in it. */
export function chapter1EastRoad(m: MapBuilder): void {
  const a = CH1_AT.road
  anchor(m, 'edda.barn', ...a.barn)
  statue(m, 'wp.eastroad', ...a.stone, 'The East Road', '东大路')
  m.regions.kingdom = [...a.kingdom]
  // the barn where Edda hides; the stretch of road before the thorns, where the grey man waits
  m.regions.barn = [18, 6, 7, 4]
  m.regions.thornroad = [27, 8, 5, 7]
  // a ring of briars round the knight's field, open where the road runs through
  const [cx, cy, r] = [40, 13, 6.5]
  for (let t = 0; t < 64; t++) {
    const x = Math.round(cx + Math.cos((t / 64) * Math.PI * 2) * r * 1.15)
    const y = Math.round(cy + Math.sin((t / 64) * Math.PI * 2) * r)
    if (y >= 9 && y <= 13) continue // the road through
    if (!m.free(x, y)) continue
    m.fixture('fixture/nature/briar', x, y, { name: L("The knight's thorns", '骑士的荆棘') })
  }
  // kneeling stones: those who came before and would not kneel (docs/chapter-1.md §6)
  for (const [x, y] of [[36, 16], [38, 17], [43, 17], [45, 15], [35, 9]] as const)
    m.fixture('fixture/sacred/gravestone', ...spot(m, x, y), { name: L('A kneeling stone', '跪石'), props: { text: 'A stone carved as a pilgrim kneeling. No name. A scallop shell, the pilgrim\'s mark, worn almost away.', text_zh: '一块雕成朝圣者跪姿的石头。没有名字。朝圣者的扇贝徽记几乎被磨平了。' } })
  // what he took: the bridge's ninth nail, a farmer's wedding band
  m.item({ form: 'item/misc/ninth_nail' }, ...spot(m, ...a.nail))
  m.item({ form: 'item/valuable/band', material: 'gold' }, ...spot(m, ...a.band))
  // the First Seal-bearer: softer in his first chapter than in the Boss Challenge (skillScale, his health)
  const knight: Entity = createBoss('alberic', { map: m.id, x: a.knight[0], y: a.knight[1] }, ALBERIC_ID)
  // his plain blow (when one stands close) is the kit's first skill's in the Boss Challenge: here a knight's, not a sin's
  knight.props = { hp: 300, maxHp: 300, def: 1, atk: 5, skillScale: 0.4 }
  m.entities.push(knight)
  // the road to Emberfall opens when he falls
  for (const p of m.portals) if (p.to === 'emberfall') p.opensWhen = CH1.knight
}

/** Where the scenes' own people wait out of sight: a plot linked to nothing (as the tutorial is). */
export function buildOffstage(): MapBuilder {
  const m = new MapBuilder('offstage', L('Elsewhere', '别处'), 'wild', 8, 6, 'grass', 'field', 'outdoor', 'frostfang')
  m.anchor('severin.hide', 2, 2)
  m.anchor('courier.hide', 5, 3)
  m.zone = 'peaceful'
  return m
}

const v = CH1_AT.village
const rd = CH1_AT.road

/** The chapter's story before the knight (docs/chapter-1.md §6): the village, the barrow, the tale, the road. */
export const CHAPTER1_STORY: StepDef[] = [
  {
    // First into Firstlight: the flame, its keeper, a boy who wants to draw the fairy.
    id: 'village_arrival',
    when: { map: 'meadow', facts: { 'village.rescued': 0 } },
    script: [
      say('npc.ilse', 'A traveller off the mountain, and a fairy at their shoulder. Welcome to Firstlight. Warm your hands — the flame was lit from the first dawn after the First Night.', '一位从山上下来的旅人，肩头还停着一个精灵。欢迎来到初原村。暖暖手吧——这团火取自初夜之后的第一道晨光。'),
      say('npc.pell', 'A FAIRY! Can I draw her? Hold still. Does she bite?', '是精灵！我能画她吗？别动。她咬人吗？', 'happy'),
      say('pip', 'I do NOT bite. ...Mostly. Draw my good side.', '我才不咬人。……大部分时候不咬。画我好看的那边。', 'shy'),
      say('npc.rowan', 'Pell, let them breathe. — You came down at a bad time, traveller. Two of ours are missing. When you have warmed up, come and find me.', '佩尔，让人家喘口气。——旅人，你来得不是时候。我们有两个人失踪了。暖和过来以后，来找我。'),
    ],
  },
  {
    // In the barrow, Lina: the grey man shut the inner door, and left them bread.
    id: 'barrow_cells',
    when: { map: 'barrow', region: 'lina_cell' },
    script: [
      say('npc.lina', 'You came! Listen — it wasn\'t the dead that shut us in. A man in grey pulled the inner door to, from outside. Then he pushed bread under it.', '你来了！听我说——把我们关在这里的不是那些死人。是一个灰衣人，从外面把里面那道门拉上了。然后他从门缝下塞进来一块面包。'),
      say('npc.lina', 'It has a mark on it. Ash. Like a thumb pressed in.', '面包上有个印子。是灰。像是用拇指按上去的。'),
      say('pip', 'The dead in here won\'t sleep. They try to lie down and they can\'t. Like a bed that\'s too cold.', '这里的死人睡不着。它们想躺下，可是躺不下去。就像一张太冷的床。', 'sad'),
    ],
  },
  {
    // The warden falls, and says the one thing it remembers.
    id: 'warden_falls',
    when: { map: 'barrow', facts: { 'q.rescue.warden': { gte: 1 } } },
    script: [
      say('player', '(As the warden comes apart, its jaw moves. Something like a voice comes out of it.)', '（守墓者散架的时候，它的下颚动了动。发出了某种像是声音的东西。）'),
      say('player', '("The night... is coming back. I could not... lie down.")', '（"夜……在回来。我……躺不下。"）', 'surprised'),
      say('pip', 'Did it just— the dead don\'t talk. Do they? Do they?', '它刚才是不是——死人不会说话的。对吧？对吧？', 'surprised'),
    ],
  },
  {
    // Dusk after the rescue: Sister Ilse tells the village the tale of the First Night and the Five.
    id: 'tale',
    when: { map: 'meadow', hour: { from: 17, to: 21 }, facts: { 'village.rescued': 1, [CH1.flameStolen]: 0 } },
    script: [
      say('npc.pell', 'Sister Ilse, tell the one about the sun going out. Please. The pilgrim hasn\'t heard it.', '伊尔丝修女，讲那个太阳熄灭的故事吧。求你了。朝圣者还没听过呢。'),
      say('npc.ilse', 'Long ago the days grew short, and shorter, until the sun did not rise at all. Crops died. Beasts went wrong. The dead would not lie down. That was the First Night.', '很久以前，白昼越来越短，再越来越短，直到太阳再也没有升起。庄稼死了。野兽变了样。死人不肯安息。那就是初夜。'),
      say('npc.ilse', 'Then Astra came. He took a crown of thorns. He was scourged at the pillar. He starved upon the scales. He was nailed to the holy wood.', '后来阿斯特拉来了。他戴上了荆棘冠。他在刑柱上受了鞭刑。他在天平上忍受饥饿。他被钉在圣木上。'),
      say('npc.ilse', 'And when the spear went through his heart — the sun rose.', '当圣枪刺穿他的心脏时——太阳升起了。'),
      { emote: 'pip', mood: 'surprised' },
      say('pip', '...', '……', 'sad'),
      say('npc.pell', 'Pip? You\'re shaking.', '小啾？你在发抖。'),
      say('pip', 'I\'m not. It\'s cold. It\'s just cold.', '我没有。是冷。只是冷而已。', 'shy'),
      say('npc.ilse', 'Suffering is not God\'s abandonment, Pell. It is the proof the debt is being paid. Now — tonight we give thanks.', '佩尔，苦难并非神的遗弃。苦难，是灾厄得以被偿还的证明。好了——今晚我们要感恩。'),
      { fact: 'ch1.tale', value: 1 },
    ],
  },
  {
    // The night of the theft, at the Ford: the river's ice already going, a lantern far off east.
    id: 'ford_night',
    when: { map: 'ford', facts: { [CH1.flameStolen]: 1, [CH1.letter]: 0 } },
    script: [
      say('npc.hesper', 'You saw him too? A grey man walked over my river on ice he made as he went. It was gone behind him before I could get my boots on.', '你也看见他了？一个灰衣人从我的河上走了过去，脚下边走边结冰。我还没穿上靴子，他身后的冰就化了。'),
      say('player', '(Far off east, past the far bank, a small light bobs along the road, and goes out.)', '（远远的东边，越过对岸，一点小小的光沿着大路晃动，然后熄灭了。）'),
      say('npc.hesper', 'Thirty-one years on this water. Never seen it carry a man before.', '我在这条河上待了三十一年。从没见过它驮着一个人走。'),
    ],
  },
  {
    // Fennick, after you have asked him about the knight: what Alberic was.
    id: 'fennick_memory',
    when: { map: 'meadow', facts: { 'q.pilgrim.fennick': 1 } },
    script: [
      say('npc.fennick', 'I carried his lance for six years. He used to stop the whole column to kneel down and talk to children. Knights don\'t do that. He did.', '我给他扛了六年长枪。他会让整支队伍停下来，就为了单膝跪下和孩子们说话。骑士是不会那样做的。他会。'),
      say('npc.fennick', 'Then they gave him the crown. A little more of him went every year. One morning he looked at me and asked my name.', '后来他们把那顶冠交给了他。他每年都少一点自己。有天早上，他看着我，问我叫什么名字。'),
      say('npc.fennick', 'I left that night. ...If he asks your name, pilgrim — tell him. Somebody should.', '我当晚就走了。……朝圣者，要是他问起你的名字——告诉他。总该有人告诉他。', 'sad'),
    ],
  },
  {
    // Hesper, after you have asked her what she saw: the stumps, and Aldo's bridge.
    id: 'hesper_stumps',
    when: { map: 'ford', facts: { 'q.pilgrim.hesper': 1 } },
    script: [
      say('npc.hesper', 'Look at the stumps by the bridge. He drove thorns into the wood where the planks were. Like a man marking what is his.', '你看桥边那些桩子。他把荆棘钉进了原来铺木板的地方。像是在给自己的东西做记号。'),
      say('npc.hesper', 'Aldo and Joss built that bridge the year before the river took Aldo. Every board I walk on, he cut.', '那座桥是阿尔多和乔斯在河水带走阿尔多的前一年造的。我踩过的每一块木板，都是他亲手锯的。'),
      say('npc.hesper', 'Mend it. Then go and tell that knight whose bridge it was.', '把它修好。然后去告诉那个骑士，那是谁的桥。'),
    ],
  },
  {
    // First onto the East Road: the light is wrong, and the knight's thorns line the way.
    id: 'road_east',
    when: { map: 'eastroad', facts: { 'ford.crossed': 1 } },
    say: L('Is it me, or is the sun lower than it was this morning? It\'s barely afternoon. — And look: thorns along the road. Someone planted them, all in a line.', '是我的错觉，还是太阳比早上低了？明明才刚过中午。——你看：路边全是荆棘。有人把它们种成了一排。'),
  },
  {
    // The barn of the burned farm: Edda comes out of hiding.
    id: 'edda_barn',
    when: { map: 'eastroad', region: 'barn', after: 'burned_farm' },
    script: [
      say('npc.edda', 'Stay where you are! ...You\'re alive. Sorry. Nothing alive comes up this road any more.', '站住别动！……你是活人。抱歉。这条路上已经没有活的东西来过了。'),
      say('npc.edda', 'The short days killed the wheat. Then the night things came. Then a knight in white rode through and took everything that shone — the hinges, the pans, my husband\'s ring off the gatepost.', '白天太短，麦子都死了。然后夜里的东西来了。再后来，一个白衣骑士骑马经过，把所有会发光的东西都拿走了——门轴、锅、挂在门柱上的我丈夫的戒指。'),
      say('npc.edda', 'The night the barn burned, a man in grey pulled me out of the smoke. Don\'t tell them in the village. They\'d not understand.', '谷仓着火那晚，是一个灰衣人把我从烟里拉了出来。别跟村里人说。他们不会明白的。'),
    ],
  },
  {
    // Before the thorns: the grey man waits on the road, and tries to turn the pilgrim back.
    id: 'severin_warning',
    when: { map: 'eastroad', region: 'thornroad', facts: { [CH1.letter]: 1 } },
    script: [
      { place: 'npc.severin', map: 'eastroad', x: 31, y: 11 },
      say('npc.severin', 'Pilgrim. Turn back.', '朝圣者。回去吧。'),
      say('player', '(Something in his stillness says: not here. Not him. Not now.)', '（他那种静止的姿态在告诉你：不是这里。不是他。不是现在。）'),
      say('npc.severin', 'Do you know what the seals hold? Your Church says they hold up the sky. They hold HIM. Astra. The First Night wears his face.', '你知道那些印锁着的是什么吗？你的教会说它们撑着天。它们锁着的是他。阿斯特拉。初夜长着他的脸。'),
      say('npc.severin', 'Every bearer you put down, he breathes easier. The night you see getting longer — that is him, waking up.', '你每打倒一个持印者，他就喘得更轻松一点。你看到的那越来越长的夜——那就是他，正在醒来。'),
      say('pip', 'That\'s not true! The Church said— ...It isn\'t true. Is it?', '不是真的！教会说过——……不是真的。对吧？', 'angry'),
      say('npc.severin', 'You of all of them should know, little one. ...No. You would not remember.', '小家伙，在他们所有人里，你应该最清楚。……不。你不会记得了。', 'sad'),
      say('npc.severin', 'The knight past those thorns is a good man in a cage he did not choose. If you must go in, go. But when the crown comes off, what it lets go is mine.', '那些荆棘后面的骑士，是一个被关进不由他选的笼子里的好人。你非进去不可，就去吧。但冠冕摘下时，它放出来的东西归我。'),
      { move: 'npc.severin', x: 31, y: 18 },
      { place: 'npc.severin', map: 'offstage', x: 2, y: 2 },
      { fact: 'ch1.warned', value: 1 },
    ],
  },
  {
    // The statue before the thorns: a breath before the knight.
    id: 'statue_rest',
    when: { map: 'eastroad', near: { type: 'fixture/sacred/waypoint', r: 3 }, after: 'severin_warning' },
    say: L('A statue — we can rest here. If I ever have more than one... power, this is where I could change it. It\'s so cold past those thorns. Colder than the shrine stone.', '是雕像——我们可以在这里歇一下。要是我以后有不止一种……力量，就能在这里换。那些荆棘后面好冷。比路碑那里还冷。'),
  },
]

export const CHAPTER1_SCENES: StepDef[] = [
  {
    // The night of the flame: the village gives thanks for the rescue; the grey man takes the Firstlight.
    id: 'night_flame',
    when: { map: 'meadow', hour: { from: 21, to: 24 }, facts: { 'village.rescued': 1 } },
    script: [
      say('npc.rowan', 'Lina and Oskar are home. Firstlight gives thanks — to the flame that kept us, and to the one who walked into the barrow for us.', '莉娜和奥斯卡回家了。初原村在此感恩——感谢守护我们的圣火，也感谢那位为我们走进古墓的人。'),
      say('npc.ilse', 'Suffering is not God\'s abandonment. It is the proof the debt is being paid. ...Go to your beds. The flame keeps the night.', '苦难并非神的遗弃。苦难，是灾厄得以被偿还的证明。……回去睡吧。圣火会守着夜晚。'),
      { fade: 'out' },
      { wait: 10 },
      { place: 'npc.severin', map: 'meadow', x: v.severin[0], y: v.severin[1] },
      { fade: 'in' },
      say('player', '(A man in a grey cloak stands at the flame. Ash on his hands. He lifts the fire into a hooded lantern as if it weighs nothing.)', '（一个披灰斗篷的男人站在圣火前。他手上沾着灰。他把火捧进一盏带罩的提灯里，仿佛它轻得没有重量。）', 'surprised'),
      { status: 'village.campfire', remove: 'lit' },
      say('npc.holt', 'Thief! Stop — THIEF!', '有贼！站住——抓贼！', 'angry'),
      say('npc.severin', '...Not tonight.', '……今晚不行。'),
      { move: 'npc.severin', x: 37, y: 18 },
      say('pip', 'He looked at me. Why did he look at me like that?', '他看了我一眼。他为什么那样看我？', 'shy'),
      { place: 'npc.severin', map: 'offstage', x: 2, y: 2 },
      say('npc.holt', 'Gone east — over the river. Over the river! He froze it under his feet and walked across.', '往东跑了——过了河。过了河！他让河水在脚下结冰，就那么走过去了。'),
      { fact: CH1.flameStolen, value: 1 },
      { topic: 'flame_stolen', days: 30 },
      { prop: 'quest', value: 0.6 },
    ],
  },
  {
    // The letter: at dawn a courier of the Holy City brings the proclamation of the pilgrimage.
    id: 'letter',
    when: { map: 'meadow', morningAfter: 'night_flame' },
    script: [
      { place: 'npc.courier', map: 'meadow', x: v.courier[0], y: v.courier[1] },
      say('npc.courier', 'By order of the Holy City: the Seal-bearers fail. The Long Night returns. Let the pilgrimage be called.', '奉圣城之命：持印者正在衰败。极夜正在回归。朝圣就此发起。'),
      say('npc.courier', 'One has come down from the mountain with a fairy at their side. The Church names them pilgrim.', '有一人带着精灵从山上下来。教会封其为朝圣者。'),
      { emote: 'npc.courier', mood: 'surprised' },
      say('player', '(The courier stares at Pip a long moment, and says nothing.)', '（信使盯着小啾看了很久，什么也没说。）'),
      { give: 'item/document/proclamation' },
      say('npc.ilse', 'The flame is gone and the Church calls you in the same night. I do not believe in coincidence, pilgrim. Come to me when you are ready.', '圣火被夺走的同一夜，教会就召唤了你。我不相信巧合，朝圣者。准备好了就来找我。'),
      { place: 'npc.courier', map: 'offstage', x: 5, y: 3 },
      { fact: CH1.letter, value: 1 },
      { prop: 'quest', value: 0.7 },
    ],
  },
  {
    // The kingdom: stepping inside the ring of thorns, the White Knight speaks once.
    id: 'kingdom',
    when: { map: 'eastroad', region: 'kingdom' },
    script: [
      say('player', '(A field ringed with thorns. Stones carved as kneeling pilgrims. In the middle, a knight in white, a crown of briars grown through his helm.)', '（一片被荆棘围起来的田野。石头被雕成跪着的朝圣者。正中间，一位白衣骑士，荆棘冠长进了他的头盔。）'),
      say(ALBERIC_ID, 'None cross that do not kneel.', '不跪者，不得过。'),
      say(ALBERIC_ID, 'Another pilgrim. They always send another.', '又一个朝圣者。他们总是再派一个来。'),
      say(ALBERIC_ID, 'I hold. I... hold. I do not remember what. Kneel.', '我守着。我……守着。我不记得守的是什么了。跪下。'),
      say('pip', 'He\'s so sad. Why does that make me want to cry? Be careful — when he plants his sword, the thorns come up in a ring!', '他好难过。为什么我看着也想哭？小心——他把剑插进地里的时候，荆棘会长成一圈！', 'sad'),
    ],
  },
  {
    // The crown: the knight falls, gives up the crown; its power breaks loose; Pip catches part of it; the
    // grey man takes the rest into the stolen flame, and goes. The night grows longer.
    id: 'crown',
    when: { map: 'eastroad', facts: { [CH1.knight]: 1 } },
    script: [
      { wait: 22 },
      say('player', '(The knight kneels. For the first time in a long while he lifts the crown from his own head, and holds it out.)', '（骑士跪了下来。很久以来第一次，他亲手把荆棘冠从头上摘下，递了出来。）'),
      say('player', '("Take it. It was never mine to hold.")', '（"拿去吧。它本就不该由我戴着。"）', 'sad'),
      { give: 'item/relic/crown_of_thorns' },
      say('player', '(Something comes loose from the crown — a cold light — and runs to Pip like water finding an old riverbed.)', '（有什么东西从荆棘冠上散开——一道冷光——像水找到了旧河床一样，流向了小啾。）'),
      { tell: 'pip', params: { what: 'boon', unlock: 'xp' } },
      say('pip', 'It came to me! It\'s warm — no, cold — no, it\'s mine? Is that allowed?', '它朝我来了！暖暖的——不对，凉凉的——不对，它是我的？可以这样吗？', 'surprised'),
      { place: 'npc.severin', map: 'eastroad', x: rd.severin[0], y: rd.severin[1] },
      say('npc.severin', '...So it has started.', '……原来已经开始了。'),
      say('player', '(The grey man opens his lantern. The rest of the light goes into the stolen flame. It gutters gold; his hand shakes.)', '（灰衣人打开了提灯。剩下的光流进了被夺走的圣火。火焰一阵金黄，他的手在发抖。）'),
      say('npc.severin', 'Every seal you break makes the night longer. Ask your Church why.', '你每打破一道印，夜就更长一分。去问问你的教会为什么。'),
      say('npc.severin', 'Keep what the little one caught. Go home. Tell Rowan the light is safer with me than with you.', '那只小家伙接住的，你就留着。回去吧。告诉罗万，光在我这里比在你们那里安全。'),
      { move: 'npc.severin', x: 46, y: 11 },
      { place: 'npc.severin', map: 'offstage', x: 2, y: 2 },
      { fact: CH1.crown, value: 1 },
      // the first seal down: the night is an hour longer from now on (calendar.ts nightHours)
      { fact: 'night.shift', value: 1 },
      { topic: 'crown', days: 30 },
      { prop: 'quest', value: 2.5 },
    ],
  },
  {
    // The return: the village rejoices at the Crown; Nessa counts the minutes; the chapter ends.
    id: 'return',
    when: { map: 'meadow', facts: { [CH1.crown]: 1 } },
    script: [
      say('npc.rowan', 'The Crown of Thorns. In Firstlight. ...And the heretic still has our flame.', '荆棘冠。在初原村。……可那个异端还拿着我们的火。', 'angry'),
      say('npc.ilse', 'He always did carry things that were too heavy for him.', '他从小就总是背着对他来说太重的东西。', 'sad'),
      say('npc.nessa', 'Four minutes. The sun set four minutes early tonight. I am sure it means nothing.', '四分钟。今晚太阳早落了四分钟。我相信这什么都不代表。'),
      { fact: CH1.end, value: 1 },
      { prop: 'quest', value: 2.9 },
      {
        card: L(
          'CHAPTER ONE · THE FIRST SEAL\n\nThe White Knight knelt, and gave up the Crown.\nThe grey man took the light east.\nAnd the night came a little sooner.',
          '第一章 · 第一印\n\n白骑士跪下，交出了荆棘冠。\n灰衣人带着光往东去了。\n而夜晚，来得更早了一些。',
        ),
      },
    ],
  },
]
