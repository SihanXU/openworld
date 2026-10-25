// Chapter 1, the First Seal (docs/chapter-1.md): what the chapter adds to the maps — the village's
// shrine and statue, Pell's chalk drawings, the waypoint statues, the knight's kingdom of thorns on the
// East Road — and its scenes: the night of the flame, the letter, the kingdom, the crown, the return.
// The quests and objectives are content (content/src/chapter1.ts).

import type { Entity, StepDef } from '@openworld/engine'
import { ALBERIC_CAMPAIGN, ALBERIC_ID, CH1, HAVEN, createBoss } from '@openworld-game/content'

const HAVEN_MAP = HAVEN.map
import { L } from '../kit.ts'
import { MapBuilder } from '../builder.ts'

const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })

/** Where the chapter puts things (map coordinates). */
export const CH1_AT = {
  village: { shrine: [23, 16] as const, statue: [24, 14] as const, drawing: [20, 16] as const, statueStone: [30, 19] as const, severin: [26, 17] as const, courier: [24, 18] as const },
  ford: { stone: [17, 13] as const, drawing: [27, 21] as const, briars: [[29, 21], [35, 21]] as const },
  foot: { drawing: [22, 13] as const },
  summit: { log: [13, 4] as const },
  pasture: { watch: [20, 12] as const },
  forest: { camp: [31, 24] as const },
  hollow: { stones: [[24, 25], [30, 25]] as const },
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
/** A waypoint statue, named as one (the Mountain Foot's is): "the Ford statue", not "the Ford", in what the keys say. */
const statue = (m: MapBuilder, id: string, x: number, y: number, en: string, zh: string) => m.fixture('fixture/sacred/waypoint', ...spot(m, x, y), { id, name: L(`${en} statue`, `${zh}传送雕像`) })

/** Firstlight: the flame beside Astra's altar, a waypoint statue on the square, the people's places. */
export function chapter1Village(m: MapBuilder): void {
  const a = CH1_AT.village
  // Astra's altar beside the flame (a statue would look like a waypoint's: those are the waypoints' alone)
  m.fixture('fixture/sacred/altar', ...spot(m, ...a.statue), { id: 'village.astra', name: L("Astra's altar", '阿斯特拉的祭坛'), props: { text: 'ASTRA, THE FIRST MARTYR. He bore the Five, and the sun rose. — Suffering is not God\'s abandonment.', text_zh: '初殉者·阿斯特拉。他承受五苦，太阳因而升起。——苦难并非神的遗弃。' }, tags: ['readable'] })
  statue(m, 'wp.village', ...a.statueStone, 'Firstlight', '初原村')
  drawing(m, 'man', ...a.drawing, 'A hooded man with a lantern, beside a fire. Underneath, in a child\'s letters: HE WAS HERE FIRST.', '一个提着灯、戴兜帽的人，站在火堆旁。下面是孩子的字迹：他先来的。')
  anchor(m, 'shrine.tend', ...a.shrine)
  // (Ilse, Joss and Edda sleep in their own beds: the chapel, the house in the lane, the little cabin — village.ts)
  anchor(m, 'joss.bench', 12, 19)
  anchor(m, 'pell.play', 18, 13)
  anchor(m, 'nessa.desk', 27, 16)
  anchor(m, 'nessa.watch', 34, 17)
  anchor(m, 'fennick.bench', 21, 19)
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
  // the hunter's cabin, long left: his gloves still by the block in its yard, where he took them off to split wood
  m.item({ form: 'item/clothing/gloves', material: 'leather', name: L("Hunter's Gloves", '猎人的手套') }, ...spot(m, 9, 16))
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
  // by a kneeling stone, what a pilgrim before you wore; in the ring, the gauntlets of one of the knight's own
  m.item({ form: 'item/valuable/earring', material: 'silver', quality: 'fine', name: L("A Kneeling Pilgrim's Earring", '跪石旁的朝圣耳环'), props: {} }, ...spot(m, 37, 16))
  m.item({ form: 'item/clothing/gloves', material: 'leather', quality: 'masterwork', name: L('Gauntlets of the White Host', '白骑士扈从的护手'), props: { atk: 1 } }, ...spot(m, 43, 11))
  // what he took: the bridge's ninth nail, a farmer's wedding band
  m.item({ form: 'item/misc/ninth_nail' }, ...spot(m, ...a.nail))
  m.item({ form: 'item/valuable/band', material: 'gold' }, ...spot(m, ...a.band))
  // the First Seal-bearer: softer in his first chapter than in the Boss Challenge (his health, and his attack, which
  // every one of his skills' blows is a multiple of)
  const knight: Entity = createBoss('alberic', { map: m.id, x: a.knight[0], y: a.knight[1] }, ALBERIC_ID)
  knight.props = { ...ALBERIC_CAMPAIGN }
  m.entities.push(knight)
  // the road to Emberfall opens when he falls
  for (const p of m.portals) if (p.to === 'emberfall') p.opensWhen = CH1.knight
}

/** Cloudtop: the Church's sunset watch, its logbook on the table (E reads it). */
export function chapter1Summit(m: MapBuilder): void {
  const [x, y] = CH1_AT.summit.log
  m.fixture('fixture/furniture/table', x, y, {
    id: 'summit.log',
    name: L("The watchman's log", '守夜人的日志'),
    tags: ['readable'],
    props: {
      text: 'SUNSET, CLOUDTOP WATCH. Year 401: 19:42 at midsummer. Year 405: 19:31. Year 409: 19:12 — I have checked the glass twice. Year 411: the reports go down the mountain and nothing comes back. Last page: Found a small light asleep in the snow by the cairn, warm as a coal. It woke and asked me how old it was. I did not know what to tell it.',
      text_zh: '云顶观日哨·日落记录。第401年：仲夏19:42。第405年：19:31。第409年：19:12——我把沙漏查了两遍。第411年：报告送下山，再没有回音。最后一页：在石堆旁的雪里发现一点睡着的光，暖得像炭火。它醒了，问我它多大了。我不知道该怎么回答。',
    },
  })
  // the watchman's cloak, left on its peg: he went down the mountain without it
  m.item({ form: 'item/clothing/cloak', material: 'cloth', quality: 'fine', name: L("Watchman's Cloak", '守夜人的斗篷'), props: {} }, ...spot(m, 8, 5))
}

/** The grassland: Brin's place by the herd (at her post by the fold's gate), and the ground where the herd kneels at dusk. */
export function chapter1Pasture(m: MapBuilder): void {
  const a = CH1_AT.pasture
  m.fixture('fixture/furniture/bench/log', ...spot(m, a.watch[0] - 1, a.watch[1] + 1), { name: L("Brin's bench", '布琳的长凳') })
  anchor(m, 'herd.watch', ...a.watch)
  m.regions.herd = [6, 6, 28, 18]
}

/**
 * The forest: the cold camp of the pilgrim before you, deep in the south-east clearing by the brook, the old footpath to
 * it half grown over: his rotted tent, the ring of his fire, his crate split open, the proclamation nailed to a tree at
 * the clearing's edge, and the cairn over him with his scallop beside it.
 */
export function chapter1Forest(m: MapBuilder): void {
  const [cx, cy] = CH1_AT.forest.camp
  m.regions.camp = [cx - 4, cy - 3, 8, 6]
  m.fixture('fixture/tent/torn', ...spot(m, cx + 1, cy - 1), { name: L('A rotted tent', '朽烂的帐篷') })
  m.fixture('fixture/light/campfire', ...spot(m, cx - 1, cy), { name: L('A cold fire ring', '冷掉的火圈') })
  m.fixture('fixture/container/crate', ...spot(m, cx - 3, cy - 1), { name: L('A split crate', '裂开的木箱') })
  m.fixture('fixture/sign/noticeboard', ...spot(m, cx - 4, cy - 3), {
    name: L('A proclamation nailed to a tree', '钉在树上的朝圣令'),
    props: {
      text: 'BY ORDER OF THE HOLY CITY. The Seal-bearers weaken. Let the pilgrimage be called. Brother Cassian of Firstlight is named pilgrim. — In the 380th year of the Five. (The paper is grey with age. The words are the ones the courier read to you.)',
      text_zh: '奉圣城之命：持印者渐衰，当发朝圣令。初原村卡西安修士被点名为朝圣者。——五苦纪元第380年。（纸已经旧得发灰。上面的话，和信使给你念的一模一样。）',
    },
  })
  m.fixture('fixture/sacred/gravestone', ...spot(m, cx + 1, cy + 1), {
    name: L('A cairn of stones', '一堆石冢'),
    props: { text: "Stones piled over something long. A pilgrim's staff leans on it, its tip worn flat by many miles. No name.", text_zh: '石头堆在一个长长的东西上。一根朝圣杖靠在上面，杖尖被许多里路磨平了。没有名字。' },
  })
  m.item({ form: 'item/valuable/scallop' }, ...spot(m, cx, cy + 1))
}

/** Thornwood Hollow: the carved stones at the barrow mouth (the Order of the Thorn buried its own below). */
export function chapter1Hollow(m: MapBuilder): void {
  m.regions.mouth = [22, 22, 11, 6]
  // a waypoint statue by the barrow mouth: the far end of the rescue's road, and of the barrow's three floors
  statue(m, 'wp.hollow', 23, 21, 'Thornwood Hollow', '荆棘谷')
  // under the west thicket's thorns, boots someone gave up on
  m.item({ form: 'item/clothing/boots', material: 'leather', quality: 'fine', name: L('Thornproof Boots', '防刺长靴'), props: {} }, ...spot(m, 8, 14))
  for (const [x, y] of CH1_AT.hollow.stones)
    m.fixture('fixture/sacred/gravestone', ...spot(m, x, y), {
      name: L('A carved standing stone', '刻纹立石'),
      props: { text: 'Worn carving: a knight with a crown of thorns, and before him a line of small figures, kneeling. Beneath: THE ORDER OF THE THORN HOLDS.', text_zh: '磨损的刻纹：一个戴荆棘冠的骑士，面前跪着一排小小的人影。下方刻着：荆棘骑士团守护于此。' },
    })
}

/** Where the scenes' own people wait out of sight: a plot linked to nothing (as the tutorial is). */
export function buildOffstage(): MapBuilder {
  const m = new MapBuilder('offstage', L('Elsewhere', '别处'), 'wild', 8, 6, 'grass', 'field', 'outdoor', 'frostfang')
  m.anchor('severin.hide', 2, 2)
  m.anchor('courier.hide', 5, 3)
  m.anchor('alberic.hide', 6, 1)
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
      say('npc.lina', 'Oskar went down the stair in the east cell to find another way out. He didn\'t come back. It goes deeper than the barrow — much deeper.', '奥斯卡顺着东边那间牢房里的楼梯下去找别的出路，再也没回来。下面比古墓深得多——深得多。', 'sad'),
      say('pip', 'The dead in here won\'t sleep. They try to lie down and they can\'t. Like a bed that\'s too cold.', '这里的死人睡不着。它们想躺下，可是躺不下去。就像一张太冷的床。', 'sad'),
    ],
  },
  {
    // The warden falls, and says the one thing it remembers.
    id: 'warden_falls',
    when: { map: 'sanctum', objectives: ['rescue.warden'] },
    script: [
      say('player', '(As the warden comes apart, its jaw moves. Something like a voice comes out of it.)', '（守墓者散架的时候，它的下颚动了动。发出了某种像是声音的东西。）'),
      say('player', '("The night... is coming back. I could not... lie down.")', '（"夜……在回来。我……躺不下。"）', 'surprised'),
      say('pip', 'Did it just— the dead don\'t talk. Do they? Do they?', '它刚才是不是——死人不会说话的。对吧？对吧？', 'surprised'),
      say('player', '(Behind where it stood, words cut into the altar: "I WILL HOLD UNTIL I AM RELIEVED. — ALBERIC." Under them, pressed into the soot, a thumbprint of ash.)', '（在它原先站着的地方后面，祭坛上刻着字："我将坚守，直到有人来接替我。——阿尔贝里克。"字下面的烟灰里，按着一个灰色的拇指印。）'),
      say('pip', 'Alberic. That\'s the White Knight Hesper talks about. He swore to hold... and nobody ever came to relieve him.', '阿尔贝里克。就是赫斯珀说的那个白骑士。他发誓要坚守……却再也没有人来接替他。', 'sad'),
    ],
  },
  {
    // Dusk after the rescue: Sister Ilse tells the village the tale of the First Night and the Five.
    id: 'tale',
    when: { map: 'meadow', hour: { from: 17, to: 21 }, facts: { 'village.rescued': 1, 'ch1.vigil': 1, [CH1.flameStolen]: 0, [CH1.knight]: 0 } },
    script: [
      say('npc.pell', 'Sister Ilse, tell the one about the sun going out. Please. The pilgrim hasn\'t heard it.', '伊尔丝修女，讲那个太阳熄灭的故事吧。求你了。朝圣者还没听过呢。'),
      say('npc.ilse', 'Long ago the days grew short, and shorter, until the sun did not rise at all. Crops died. Beasts went wrong. The dead would not lie down. That was the First Night.', '很久以前，白昼越来越短，再越来越短，直到太阳再也没有升起。庄稼死了。野兽变了样。死人不肯安息。那就是初夜。'),
      say('npc.ilse', 'Then Astra came. He took a crown of thorns. He was scourged at the pillar. He starved upon the scales. He was nailed to the holy wood.', '后来阿斯特拉来了。他戴上了荆棘冠。他在刑柱上受了鞭刑。他在天平上忍受饥饿。他被钉在圣木上。'),
      say('npc.ilse', 'And when the spear went through his heart — the sun rose.', '当圣枪刺穿他的心脏时——太阳升起了。'),
      { emote: 'pip', mood: 'surprised' },
      say('pip', '...', '……', 'sad'),
      say('npc.pell', 'Lumi? You\'re shaking.', '露米？你在发抖。'),
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
    // Fennick, after you have asked him about the knight: what Alberic was. (He squired for him in the long hold, two
    // hundred and fifty years after the crowning: the crown had worn him long before Fennick was born.)
    id: 'fennick_memory',
    when: { map: 'meadow', objectives: ['pilgrim.fennick'] },
    script: [
      say('npc.fennick', 'I carried his lance for six years, when I was young. He had worn the crown two hundred and fifty years by then, and still he would stop the whole column to kneel down and talk to children. Knights don\'t do that. He did.', '我年轻时给他扛了六年长枪。那时他已经戴了那顶冠两百五十年，可他还是会让整支队伍停下来，就为了单膝跪下和孩子们说话。骑士是不会那样做的。他会。'),
      say('npc.fennick', 'But the crown kept taking. A little more of him went every year I was there. One morning he looked at me and asked my name.', '可那顶冠一直在拿。我在他身边的每一年，他都又少了一点自己。有天早上，他看着我，问我叫什么名字。'),
      say('npc.fennick', 'I left that night. ...If he asks your name, pilgrim — tell him. Somebody should.', '我当晚就走了。……朝圣者，要是他问起你的名字——告诉他。总该有人告诉他。', 'sad'),
    ],
  },
  {
    // Hesper, after you have asked her what she saw: the stumps, and Aldo's bridge.
    id: 'hesper_stumps',
    when: { map: 'ford', objectives: ['pilgrim.hesper'] },
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
    // Cloudtop: the watchman's log on the table — the sunsets coming early for years, and a light in the snow.
    id: 'watch_log',
    when: { map: 'summit', near: { type: 'fixture/furniture/table', r: 1 } },
    script: [
      say('player', '(A logbook lies open on the table, its pages stiff with cold. Columns of sunset times, year after year — each a little earlier than the last.)', '（桌上摊着一本日志，纸页冻得发硬。一栏栏日落时间，一年接一年——每一个都比上一个早一点。）'),
      say('player', '(The last page: "Found a small light asleep in the snow by the cairn, warm as a coal. It woke and asked me how old it was.")', '（最后一页："在石堆旁的雪里发现一点睡着的光，暖得像炭火。它醒了，问我它多大了。"）'),
      { emote: 'pip', mood: 'surprised' },
      say('pip', 'A light in the snow? Huh. ...I don\'t remember any snow. I remember waking up and you being there. That\'s all.', '雪里的光？嗯……我不记得什么雪。我只记得醒过来，然后你就在那儿了。就这些。', 'shy'),
      say('pip', 'Somebody sat up here counting sunsets for years and nobody came to read it. That\'s the saddest book I ever saw.', '有人在这儿坐了好多年，一天天数日落，却没有一个人来读。这是我见过最伤心的一本书。', 'sad'),
    ],
  },
  {
    // The grassland, first time: the herd keeps to the north, away from the trees.
    id: 'pasture_first',
    when: { map: 'pasture' },
    say: L('The cows are all bunched up at the north end, away from the trees. Animals know things. What do they know?', '牛都挤在北边，离树林远远的。动物是知道些什么的。它们知道什么呢？'),
  },
  {
    // Dusk on the grassland: the whole herd kneels, facing east, toward the knight's kingdom.
    id: 'kneeling_herd',
    when: { map: 'pasture', hour: { from: 17, to: 20 } },
    script: [
      say('player', '(The light goes amber. One by one the cows fold their front legs and go down on their knees — every one of them facing east.)', '（天光转成琥珀色。牛一头接一头屈下前腿，跪了下去——全都朝着东边。）'),
      say('npc.brin', 'Every dusk. Since the bridge went. My gran never saw a cow kneel in her life.', '每天黄昏都这样。从桥断了以后就开始了。我奶奶活了一辈子都没见过牛下跪。'),
      say('pip', 'East is the Ford... and past the Ford, the road. Whatever is down that road, they\'re kneeling to it.', '东边是渡口……过了渡口，就是那条大路。不管那条路上有什么，它们都在向它下跪。', 'surprised'),
      say('npc.brin', 'And after dark, the dead come up out of the trees. Three cows this month. If you have a strong arm, come and find me.', '天黑以后，死人就从树林里爬上来。这个月已经丢了三头牛。你要是有把子力气，来找我。'),
    ],
  },
  {
    // The forest, first time: no birds.
    id: 'forest_quiet',
    when: { map: 'forest' },
    say: L('Listen. ...No birds. Not one. A forest this big should be loud in the afternoon.', '你听。……没有鸟叫。一只都没有。这么大的森林，下午本该热热闹闹的。'),
  },
  {
    // Deep in the forest: the cold camp of the pilgrim before you, the same proclamation nailed to a tree.
    id: 'pilgrim_camp',
    when: { map: 'forest', region: 'camp' },
    script: [
      say('player', '(A camp nobody has used in a very long time: a tent gone to rags, a ring of cold stones, a cairn with a pilgrim\'s staff leaning on it.)', '（一处很久很久没人用过的营地：帐篷烂成了布条，一圈冷掉的石头，一座石冢，上面靠着一根朝圣杖。）'),
      say('pip', 'There\'s a paper on that tree. It says... "the Seal-bearers weaken. Let the pilgrimage be called." That\'s YOUR letter. Word for word.', '那棵树上钉着一张纸。上面写着……"持印者渐衰，当发朝圣令。"这是你的那封信。一字不差。', 'surprised'),
      say('pip', 'Except it\'s old. Really old. And the name on it isn\'t yours.', '只不过它很旧了。真的很旧。而且上面的名字不是你。', 'sad'),
      say('player', '(Something glints by the cairn: a scallop shell on a cord. The pilgrim\'s mark. Sister Ilse would know whose it was.)', '（石冢旁有东西在闪：一枚穿着绳子的扇贝壳。朝圣者的标记。伊尔丝修女会知道它是谁的。）'),
    ],
  },
  {
    // The camp after dark: a pale shape kneels at the cold fire, and says one thing.
    id: 'pilgrim_ghost',
    when: { map: 'forest', region: 'camp', hour: { from: 20, to: 4 }, after: 'pilgrim_camp' },
    script: [
      say('player', '(By the cold fire ring a pale shape is kneeling, head bowed, as if it has been kneeling for a long time.)', '（冷掉的火圈旁跪着一个苍白的影子，低着头，像是已经跪了很久很久。）'),
      say('player', '("I knelt," it says, without looking up. "I knelt to him. Do not kneel.")', '（"我跪下了，"它说，没有抬头。"我向他跪下了。别跪。"）', 'surprised'),
      { emote: 'pip', mood: 'surprised' },
      say('pip', 'It\'s gone. It was right THERE. ...Can we go now? Please?', '它不见了。刚才明明就在那儿。……我们能走了吗？求你了？', 'sad'),
    ],
  },
  {
    // Thornwood Hollow, first time: the dead below sleep badly.
    id: 'hollow_first',
    when: { map: 'hollow' },
    say: L('Down there, past the thorns — the dead are sleeping badly. I can feel it from here, like a draught under a door.', '下面，荆棘那边——那里的死人睡得很不安稳。我在这儿都能感觉到，像门缝底下灌进来的冷风。'),
  },
  {
    // The barrow mouth: the carved stones of the Order of the Thorn.
    id: 'barrow_mouth',
    when: { map: 'hollow', region: 'mouth' },
    say: L('Look at the carving on those stones: a knight with a crown of thorns, and people kneeling in front of him. Somebody important is buried down there. Fennick might know who.', '你看那些石头上的刻纹：一个戴荆棘冠的骑士，前面跪着一排人。下面埋着很重要的人。芬尼克也许知道是谁。'),
  },
  {
    // Millbrook, first time: the wheel turning slow.
    id: 'mill_first',
    when: { map: 'mill' },
    say: L('Listen to that wheel — it keeps stopping, like it\'s tired. Tam says something got into his cellar. That\'s where the lamp oil is.', '听那水车——转一会儿就停，像是累了。塔姆说有东西钻进了他的地窖。灯油就在那下面。'),
  },
  {
    // The cellar: the oil, and what moved in after dark.
    id: 'cellar_first',
    when: { map: 'millcellar' },
    say: L('Slimes in the cellar — the night things come further in every week. The oil flasks are on the shelves at the back.', '地窖里有史莱姆——夜里的东西一周比一周往里钻。油瓶在最里面的架子上。'),
  },
  {
    // Dawn Hill, first time: where the sun rose again.
    id: 'hill_first',
    when: { map: 'dawnhill' },
    say: L('This is where they say the sun came back, after the First Night. The flowers up here still face east, every one of them. Those must be the dawnbloom.', '据说初夜之后，太阳就是在这里重新升起的。这里的花全都朝着东边，一朵不落。那些一定就是晨光花了。'),
  },
  {
    // The Chapel of the First Dawn: the bell rung, as it was the morning the sun came back.
    id: 'chapel_bell',
    when: { map: 'chapel', region: 'belfry' },
    script: [
      say('player', '(You take the old rope in both hands and pull. Far above, the bell swings once, twice — and its voice rolls down the hill toward Firstlight.)', '（你双手握住那根旧绳，用力一拉。高处的钟摆了一下，两下——钟声顺着山坡一路滚向初原村。）'),
      { emote: 'pip', mood: 'surprised' },
      say('pip', 'They\'ll hear that in the village. ...It sounds like morning. Even though it isn\'t.', '村里一定听得见。……听起来像早晨。虽然现在并不是。', 'happy'),
      say('pip', 'The hearth here is where the Firstlight was lit. From the sun itself, Ilse says. It\'s so cold now. Like it\'s been waiting.', '伊尔丝说，初火就是在这座火坛里点燃的，用的是太阳本身的光。现在它好冷。像是一直在等着什么。', 'sad'),
    ],
  },
  {
    // The second floor: the Order of the Thorn buried its own here.
    id: 'ossuary_enter',
    when: { map: 'ossuary' },
    say: L('Bones in every wall, and every one of them has a name over it. Knights. A whole order of knights, all down here together. ...They\'re not sleeping either.', '每面墙里都是骨头，每一具上面都刻着名字。是骑士。一整个骑士团，全都埋在这下面。……他们也没在睡。'),
  },
  {
    // The niches: one is carved and empty, and someone keeps it swept.
    id: 'niches',
    when: { map: 'ossuary', region: 'niches' },
    say: L('This niche has a name but nobody in it. "Fennick, squire to the Commander." Fennick — the old man on the bench in the village? And it\'s swept clean. Who comes down here to sweep a grave?', '这个墓龛刻着名字，里面却是空的。"芬尼克，骑士长的侍从。"芬尼克——就是村里长凳上那个老人？而且扫得干干净净。谁会到这下面来扫一座墓？'),
  },
  {
    // Oskar in the ossuary's cell: the stair, the roll, the warden below.
    id: 'oskar_cell',
    when: { map: 'ossuary', region: 'oskar_cell' },
    script: [
      say('npc.oskar', 'Took your time. I came down looking for another way out and the dead herded me in here like a sheep.', '你可真够慢的。我下来找别的出路，结果被那些死人像赶羊一样赶进了这里。'),
      say('npc.oskar', 'Read the roll on the altar, back there? Forty knights of some Order of the Thorn. The last name is cut deeper than the rest.', '后面祭坛上那份名册你看了吗？四十来个什么荆棘骑士团的骑士。最后一个名字比别的刻得都深。'),
      say('npc.oskar', 'The thing that keeps this place is further down — the bottom of that stair in the north-east. I heard it walking all night. Back and forth. Like a guard on a wall.', '看守这地方的东西在更下面——东北角那道楼梯的最底下。我听了一整夜它走路的声音。来来回回。就像城墙上的守卫。'),
    ],
  },
  {
    // The third floor: the warden's sanctum.
    id: 'sanctum_enter',
    when: { map: 'sanctum' },
    say: L('It\'s standing guard in front of an altar. Not attacking — guarding. Whatever it was, it still thinks it has a post to keep.', '它守在一座祭坛前面。不是在攻击——是在站岗。不管它生前是什么，它还以为自己有一个岗要守。'),
  },
  {
    // The statue before the thorns: a breath before the knight.
    id: 'statue_rest',
    when: { map: 'eastroad', near: { type: 'fixture/sacred/waypoint', r: 3 }, after: 'severin_warning' },
    say: L('A statue — we can rest here. If I ever have more than one... power, this is where I could change it. It\'s so cold past those thorns. Colder than the shrine stone.', '是雕像——我们可以在这里歇一下。要是我以后有不止一种……力量，就能在这里换。那些荆棘后面好冷。比路碑那里还冷。'),
  },
]

/** The Held Ground (docs/chapter-1.md §12): the Oath-Thorn after the knight, his welcome there, the ground widening. */
export const HAVEN_STORY: StepDef[] = [
  {
    // After the crown: one thorn of it is still green where he fell, and warm (a save from before has it the next time it plays)
    id: 'oath_thorn',
    when: { facts: { [CH1.knight]: { ne: 0 }, 'haven.token': 0 } },
    script: [
      say('player', '(Among the thorns where the knight fell, one is still green. It is warm, and it hums, very faintly, like a door left open.)', '（骑士倒下的荆棘丛里，有一根还是绿的。它是温热的，还在很轻很轻地嗡鸣，像一扇没关严的门。）'),
      { give: 'item/relic/oath_thorn' },
      { fact: 'haven.token', value: 1 },
      say('pip', 'It wants to be used. On you, I think — hold it and right click yourself. I can hear a field on the other side of it. And... somebody waiting.', '它想被用一下。对你用，我觉得——拿着它右键点你自己。我能听见它另一边有一片田野。还有……有人在等。', 'surprised'),
    ],
  },
  {
    // The first time in the Held Ground: the knight, unhelmed, keeps it.
    id: 'haven_first',
    when: { map: HAVEN_MAP },
    script: [
      { place: 'npc.alberic', map: HAVEN_MAP, x: HAVEN.heart[0] + 1, y: HAVEN.heart[1] + 1 },
      say('npc.alberic', 'You came. ...You are the one who took the crown off me. I could not see your face then. I can now.', '你来了。……你就是替我摘下冠冕的人。那时候我看不清你的脸。现在能看清了。'),
      say('npc.alberic', 'I swore I would hold until I was relieved. You relieved me. So I hold for you now — this ground, as far as the mist. It is yours: build, sow, keep beasts.', '我发过誓，要坚守到有人来接替我。你接替了我。所以现在换我为你坚守——这片土地，一直到迷雾那里。它是你的了：盖房、播种、养牲口都行。'),
      say('npc.alberic', 'Bring me what a wider ground needs, and I will push the mist back. ...And tell me your name. I would like to keep one, this time.', '把扩建所需的东西带给我，我就把迷雾推远。……还有，告诉我你的名字。这一次，我想记住一个名字。', 'sad'),
      say('pip', 'He looks so different without the helmet. Kind. ...Tired, but kind.', '他不戴头盔，看起来完全不一样了。很和善。……很累，但很和善。', 'shy'),
      say('npc.alberic', 'Here — the coin of this ground. My stall keeps seeds, feed and bait; it buys back what you grow, raise and catch. The pond is full of fish.', '给——这是这片土地的钱币。我的货摊卖种子、饲料和鱼饵，也收你种的、养的、钓的东西。池塘里鱼可多了。'),
      { give: 'item/misc/thornmark', count: 30 },
      { fact: 'haven.met', value: 1 },
    ],
  },
  ...([1, 2, 3] as const).map((n): StepDef => ({
    id: `haven_grow_${n}`,
    when: { map: HAVEN_MAP, facts: { 'haven.size': { gte: n } } },
    say: L(['', 'The mist pulled back! There\'s a grove out there, and stones.', 'Further again — a meadow, and water. It\'s getting to be a real place.', 'All of it now. Boundary stones at the edges... and iron in the rocks.'][n], ['', '迷雾退开了！那边有一片树林，还有石头。', '又远了一圈——一片草地，还有水。这里越来越像个真正的家了。', '全都打开了。边上有界石……岩石里还有铁。'][n]),
  })),
]

export const CHAPTER1_SCENES: StepDef[] = [
  {
    // The night of the flame: the village gives thanks for the rescue; the grey man takes the Firstlight.
    id: 'night_flame',
    // (not once the knight has fallen: a player who went straight for him finds the night already past)
    when: { map: 'meadow', hour: { from: 21, to: 24 }, facts: { 'village.rescued': 1, 'ch1.vigil': 1, [CH1.knight]: 0 } },
    script: [
      say('npc.rowan', 'Lina and Oskar are home. Firstlight gives thanks — to the flame that kept us, and to the one who walked into the barrow for us.', '莉娜和奥斯卡回家了。初原村在此感恩——感谢守护我们的圣火，也感谢那位为我们走进古墓的人。'),
      say('npc.ilse', 'Suffering is not God\'s abandonment. It is the proof the debt is being paid. ...Go to your beds. The flame keeps the night.', '苦难并非神的遗弃。苦难，是灾厄得以被偿还的证明。……回去睡吧。圣火会守着夜晚。'),
      { fade: 'out' },
      // the grey man's music as the dark falls (docs/music.md)
      { music: 'severin' },
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
    ],
  },
  {
    // The letter: at dawn a courier of the Holy City brings the proclamation of the pilgrimage.
    id: 'letter',
    when: { map: 'meadow', morningAfter: 'night_flame', facts: { [CH1.knight]: 0 } },
    script: [
      { music: 'revelation' },
      { place: 'npc.courier', map: 'meadow', x: v.courier[0], y: v.courier[1] },
      say('npc.courier', 'By order of the Holy City: the Seal-bearers fail. The Long Night returns. Let the pilgrimage be called.', '奉圣城之命：持印者正在衰败。极夜正在回归。朝圣就此发起。'),
      say('npc.courier', 'One has come down from the mountain with a fairy at their side. The Church names them pilgrim.', '有一人带着精灵从山上下来。教会封其为朝圣者。'),
      { emote: 'npc.courier', mood: 'surprised' },
      say('player', '(The courier stares at Lumi a long moment, and says nothing.)', '（信使盯着露米看了很久，什么也没说。）'),
      { give: 'item/document/proclamation' },
      say('npc.ilse', 'The flame is gone and the Church calls you in the same night. I do not believe in coincidence, pilgrim. Come to me when you are ready.', '圣火被夺走的同一夜，教会就召唤了你。我不相信巧合，朝圣者。准备好了就来找我。'),
      { place: 'npc.courier', map: 'offstage', x: 5, y: 3 },
      { fact: CH1.letter, value: 1 },
    ],
  },
  {
    // The kingdom: stepping inside the ring of thorns, the White Knight speaks once.
    id: 'kingdom',
    when: { map: 'eastroad', region: 'kingdom' },
    script: [
      { music: '' },
      say('player', '(A field ringed with thorns. Stones carved as kneeling pilgrims. In the middle, a knight in white, a crown of briars grown through his helm.)', '（一片被荆棘围起来的田野。石头被雕成跪着的朝圣者。正中间，一位白衣骑士，荆棘冠长进了他的头盔。）'),
      say(ALBERIC_ID, 'None cross that do not kneel.', '不跪者，不得过。'),
      say(ALBERIC_ID, 'Another pilgrim. They always send another.', '又一个朝圣者。他们总是再派一个来。'),
      say(ALBERIC_ID, 'I hold. I... hold. I do not remember what. Kneel.', '我守着。我……守着。我不记得守的是什么了。跪下。'),
      say('pip', 'He\'s so sad. Why does that make me want to cry? Be careful — when he plants his sword, the thorns come up in a ring!', '他好难过。为什么我看着也想哭？小心——他把剑插进地里的时候，荆棘会长成一圈！', 'sad'),
    ],
  },
  {
    // The crown: the knight falls, gives up the crown; its power breaks loose; Lumi catches part of it; the
    // grey man takes the rest into the stolen flame, and goes. The night grows longer.
    id: 'crown',
    when: { map: 'eastroad', facts: { [CH1.knight]: 1 } },
    script: [
      { music: 'sorrow' },
      { wait: 22 },
      say('player', '(The knight kneels. For the first time in a long while he lifts the crown from his own head, and holds it out.)', '（骑士跪了下来。很久以来第一次，他亲手把荆棘冠从头上摘下，递了出来。）'),
      say('player', '("Take it. It was never mine to hold.")', '（"拿去吧。它本就不该由我戴着。"）', 'sad'),
      { give: 'item/relic/crown_of_thorns' },
      say('player', '(Something comes loose from the crown — a cold light — and runs to Lumi like water finding an old riverbed.)', '（有什么东西从荆棘冠上散开——一道冷光——像水找到了旧河床一样，流向了露米。）'),
      // the power leaves the kneeling knight and runs to her (the client's light and her glow); the scene waits for it
      { tell: 'pip', params: { what: 'boon', unlock: 'xp', from: ALBERIC_ID } },
      { wait: 32 },
      say('pip', 'It came to me! It\'s warm — no, cold — no, it\'s mine? Is that allowed?', '它朝我来了！暖暖的——不对，凉凉的——不对，它是我的？可以这样吗？', 'surprised'),
      { place: 'npc.severin', map: 'eastroad', x: rd.severin[0], y: rd.severin[1] },
      { music: 'severin' },
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
      { music: 'ending' },
      {
        card: L(
          'CHAPTER ONE · THE FIRST SEAL\n\nThe White Knight knelt, and gave up the Crown.\nThe grey man took the light east.\nAnd the night came a little sooner.',
          '第一章 · 第一印\n\n白骑士跪下，交出了荆棘冠。\n灰衣人带着光往东去了。\n而夜晚，来得更早了一些。',
        ),
      },
    ],
  },
]
