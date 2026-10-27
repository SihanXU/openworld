// Chapter 1, the First Seal (docs/chapter-1.md): what the chapter adds to the maps — the village's
// shrine and statue, Pell's chalk drawings, the waypoint statues, the knight's kingdom of thorns on the
// East Road — and its scenes: the night of the flame, the letter, the kingdom, the crown, the return.
// The quests and objectives are content (content/src/chapter1.ts).

import type { Entity, StepDef } from '@openworld/engine'
import { ALBERIC_CAMPAIGN, ALBERIC_ID, CH1, HAVEN, PART_TWO, createBoss } from '@openworld-game/content'

const HAVEN_MAP = HAVEN.map
import { L } from '../kit.ts'
import { MapBuilder } from '../builder.ts'
import { KINGDOM } from './kingdom.ts'

const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })

/** Where the chapter puts things (map coordinates). */
export const CH1_AT = {
  village: { shrine: [23, 16] as const, statue: [24, 14] as const, drawing: [20, 16] as const, statueStone: [30, 19] as const, severin: [26, 18] as const, courier: [24, 18] as const },
  ford: { stone: [17, 13] as const, drawing: [27, 21] as const, briars: [[29, 21], [35, 21]] as const },
  foot: { drawing: [22, 13] as const },
  summit: { log: [13, 4] as const },
  pasture: { watch: [20, 12] as const },
  forest: { camp: [31, 24] as const },
  hollow: { stones: [[24, 25], [30, 25]] as const },
  barrow: { drawing: [14, 2] as const, loaf: [7, 20] as const },
  road: {
    stone: [30, 12] as const,
    barn: [21, 8] as const,
  },
  // the knight's arena behind his fog (docs/boss-rooms.md; quest/kingdom.ts)
  kingdom: {
    knight: KINGDOM.knight,
    nail: [15, 8] as const,
    band: [24, 17] as const,
    severin: [25, 13] as const,
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
  m.fixture('fixture/sacred/altar', ...spot(m, ...a.statue), { id: 'village.astra', name: L("Astra's altar", '阿斯特拉的祭坛'), props: { text: 'ASTRA, THE FIRST MARTYR. He bore the Five, and the sun rose. Suffering is not God\'s abandonment. It is the proof the debt is being paid.', text_zh: '初殉者·阿斯特拉。他承受五苦，太阳因而重新升起。苦难并非神的遗弃。苦难，是灾厄得以被偿还的证明。' }, tags: ['readable'] })
  statue(m, 'wp.village', ...a.statueStone, 'Firstlight', '初原村')
  drawing(m, 'man', ...a.drawing, 'A hooded man with a lantern, beside a fire. Underneath, in a child\'s letters: HE WAS HERE FIRST.', '一个戴兜帽、提着灯的人，站在火堆旁边。下面是孩子写的字：他先来的。')
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
  drawing(m, 'bridge', ...a.drawing, 'A bridge with its middle gone. A tall figure in white beside it, and a smaller grey one watching from the trees.', '一座中间断了的桥。桥边站着一个高高的白色人影，树林里还有一个小一点的灰色人影，在往这边看。')
  for (const [x, y] of a.briars) m.fixture('fixture/nature/briar', ...spot(m, x, y), { name: L('Thorns driven into the stump', '钉进桥桩的荆棘') })
}

/** The Mountain Foot: Pell's drawing beside the shrine stone. */
export function chapter1Foot(m: MapBuilder): void {
  // the hunter's cabin, long left: his gloves still by the block in its yard, where he took them off to split wood
  m.item({ form: 'item/clothing/gloves', material: 'leather', name: L("Hunter's Gloves", '猎人的手套') }, ...spot(m, 9, 16))
  drawing(m, 'stone', ...CH1_AT.foot.drawing, 'The shrine stone, five marks on it, the first scribbled over in black. A grey figure with its hand on it.', '那块路碑，上面有五道痕，第一道被涂成了黑色。一个灰色的人把手按在碑上。')
}

/** The barrow: Pell's drawing at the door, and the loaf the grey man left the foragers. */
export function chapter1Barrow(m: MapBuilder): void {
  const a = CH1_AT.barrow
  // Lina's side cell: finding her plays the shut door's story
  m.regions.lina_cell = [2, 17, 8, 6]
  drawing(m, 'door', ...a.drawing, 'A door, shut, a hand-mark on it. Behind it, something with a crown of bones. In front, two small people.', '一扇关着的门，门上有个手印。门后面是一个戴着骨头冠的东西，门前面是两个小人。')
  m.item({ form: 'item/food/bread', name: L('Loaf marked with ash', '印着灰痕的面包') }, ...spot(m, ...a.loaf))
}

/** The East Road: Edda's barn, the waypoint statue before the knight's hedge, the stretch of road where the grey man waits. */
export function chapter1EastRoad(m: MapBuilder): void {
  const a = CH1_AT.road
  anchor(m, 'edda.barn', ...a.barn)
  statue(m, 'wp.eastroad', ...a.stone, 'The East Road', '东大路')
  // the barn where Edda hides; the stretch of road before the thorns, where the grey man waits
  m.regions.barn = [18, 6, 7, 4]
  m.regions.thornroad = [27, 8, 5, 7]
  // the road on to Emberfall is Part Two's (release 1 ends with the Crown home: docs/release-1.md)
  for (const p of m.portals) if (p.to === 'emberfall') p.opensWhen = PART_TWO
}

/**
 * The Kingdom, the knight's arena behind his fog (docs/boss-rooms.md §4.1): the kneeling stones of those who came before
 * and would not kneel, what a pilgrim before you wore, the gauntlets of one of his own, what he took, and the knight.
 */
export function chapter1Kingdom(m: MapBuilder): void {
  const a = CH1_AT.kingdom
  // kneeling stones: those who came before and would not kneel (docs/chapter-1.md §6)
  for (const [x, y] of [[13, 16], [16, 18], [21, 18], [24, 15], [12, 8]] as const)
    m.fixture('fixture/sacred/gravestone', ...spot(m, x, y), { name: L('A kneeling stone', '跪石'), props: { text: 'A stone carved as a pilgrim kneeling. No name. A scallop shell, the pilgrim\'s mark, worn almost away.', text_zh: '一块石头，雕成朝圣者跪着的样子。没有名字。上面刻着朝圣者的扇贝徽记，已经快磨平了。' } })
  // by a kneeling stone, what a pilgrim before you wore; in the ring, the gauntlets of one of the knight's own
  m.item({ form: 'item/valuable/earring', material: 'silver', quality: 'fine', name: L("A Kneeling Pilgrim's Earring", '跪石旁的朝圣耳环'), props: {} }, ...spot(m, 14, 16))
  m.item({ form: 'item/clothing/gloves', material: 'leather', quality: 'masterwork', name: L('Gauntlets of the White Host', '白骑士扈从的护手'), props: { atk: 1 } }, ...spot(m, 22, 10))
  // what he took: the bridge's ninth nail, a farmer's wedding band
  m.item({ form: 'item/misc/ninth_nail' }, ...spot(m, ...a.nail))
  m.item({ form: 'item/valuable/band', material: 'gold' }, ...spot(m, ...a.band))
  // the First Seal-bearer: softer in his first chapter than in the Boss Challenge (his health, and his attack, which
  // every one of his skills' blows is a multiple of)
  const knight: Entity = createBoss('alberic', { map: m.id, x: a.knight[0], y: a.knight[1] }, ALBERIC_ID)
  knight.props = { ...ALBERIC_CAMPAIGN }
  m.entities.push(knight)
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
      text: 'BY ORDER OF THE HOLY CITY. The Seal-bearers weaken. Let the pilgrimage be called. Brother Cassian of Firstlight is named pilgrim. — In the 380th year of the Five. (The paper is grey with age. The wording is almost the same as the courier\'s.)',
      text_zh: '奉圣城之命：持印者渐衰，当发朝圣令。初原村卡西安修士被点名为朝圣者。——五苦纪元第380年。（纸已经旧得发灰。上面的措辞，和信使念的那份几乎一字不差。）',
    },
  })
  m.fixture('fixture/sacred/gravestone', ...spot(m, cx + 1, cy + 1), {
    name: L('A cairn of stones', '一堆石冢'),
    props: { text: "Stones piled over something long. A pilgrim's staff leans on it, its tip worn flat by many miles. No name.", text_zh: '石头堆在一个长长的东西上面。一根朝圣杖靠在石堆上，杖尖走了太多路，已经磨平了。没有名字。' },
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
      props: { text: 'Worn carving: a knight with a crown of thorns, and before him a line of small figures, kneeling. Beneath: THE ORDER OF THE THORN HOLDS.', text_zh: '刻纹已经磨损了：一个戴荆棘冠的骑士，面前跪着一排小小的人影。下方刻着：荆棘骑士团守护于此。' },
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
const kd = CH1_AT.kingdom

/** The chapter's story before the knight (docs/chapter-1.md §6): the village, the barrow, the tale, the road. */
export const CHAPTER1_STORY: StepDef[] = [
  {
    // First into Firstlight: the flame, its keeper, a boy who wants to draw the fairy.
    id: 'village_arrival',
    when: { map: 'meadow', facts: { 'village.rescued': 0 } },
    script: [
      say('npc.ilse', 'A traveller down from the mountain, and a fairy with you... We have not had a guest like you in a long while. Welcome to Firstlight. Come and warm your hands at the flame; it was lit on the first morning after the First Night.', '从山上下来的旅人，身边还跟着一位精灵……村里很久没有来过这样的客人了。欢迎来到初原村。过来烤烤手吧，这团火是初夜过后的第一个清晨点起来的。', 'surprised'),
      say('npc.pell', 'A fairy! Can I draw her? Can I? Don\'t move, either of you!', '是精灵！我能画她吗？能吗？你们俩都先别动！', 'happy'),
      say('pip', 'Draw me? ...All right. But be quick. I\'m no good at keeping still.', '画我？……好吧。不过要快一点，我可停不了太久。', 'shy'),
      say('npc.rowan', 'Pell, let them be. — Traveller, I am sorry you have come at a bad time. Two of ours are missing. When you have warmed up, come and find me, and I will tell you the rest.', '佩尔，别缠着人家。——旅人，你来得不巧，村里有两个人不见了。等你暖和过来，来找我，我再跟你细说。'),
    ],
  },
  {
    // In the barrow, Lina: the grey man shut the inner door, and left them bread.
    id: 'barrow_cells',
    when: { map: 'barrow', region: 'lina_cell' },
    script: [
      say('npc.lina', 'So somebody did come. ...Listen. It wasn\'t the dead that shut us in. A man in grey pulled the inner door shut from the outside. Later he pushed a loaf under it.', '还真有人来了。……听着，把我们关在这儿的不是死人。是一个穿灰衣服的男人，从外面把里头那道门拉上的。后来他又从门缝底下塞进来一块面包。'),
      say('npc.lina', 'There\'s a mark on the bread. Ash, pressed in with a thumb.', '面包上有个印子。是灰，用拇指按上去的。'),
      say('npc.lina', 'Oskar took the stair in the east cell to look for another way out. He hasn\'t come back. It goes a long way down, further than any barrow should. ...I\'m not asking you to go after him.', '奥斯卡从东边那间的楼梯下去找别的出路，到现在也没回来。那底下很深，比哪座古墓都深。……我可没求你去找他。', 'sad'),
      say('pip', 'I can hear them moving in the dark. All the time.', '我一直听见它们在黑暗里走动。一刻都没停过。', 'sad'),
    ],
  },
  {
    // The warden falls, and says the one thing it remembers.
    id: 'warden_falls',
    when: { map: 'sanctum', objectives: ['rescue.warden'] },
    script: [
      say('player', '(As the warden falls apart, its jaw moves. A sound comes out of it, something like a voice.)', '（守墓者散架的时候，它的下巴动了动，发出一点像是人声的响动。）'),
      say('player', '("The night... is coming back. I could not... lie down.")', '（"夜……又回来了。我……躺不下去。"）', 'surprised'),
      say('pip', 'It spoke. ...Can the dead speak?', '它说话了……死人也会说话吗？', 'surprised'),
      say('player', '(On the altar behind where it stood, words are cut into the stone: "I WILL HOLD UNTIL I AM RELIEVED. — ALBERIC." Under them, pressed into the soot, is a thumbprint of ash.)', '（它原先站的地方后面是一座祭坛，石头上刻着字："我将坚守，直到有人来接替我。——阿尔贝里克。"字下面的烟灰里，按着一个灰色的拇指印。）'),
    ],
  },
  {
    // Dusk after the rescue: Sister Ilse tells the village the tale of the First Night and the Five.
    id: 'tale',
    when: { map: 'meadow', hour: { from: 17, to: 21 }, facts: { 'village.rescued': 1, 'ch1.vigil': 1, [CH1.flameStolen]: 0, [CH1.knight]: 0 } },
    script: [
      say('npc.pell', 'Sister Ilse, tell the one where the sun goes out. Please? The pilgrim has never heard it.', '伊尔丝修女，讲太阳熄灭的那个故事吧。求你了，朝圣者还没听过呢。'),
      say('npc.ilse', 'Long ago the days grew shorter and shorter, until one morning the sun did not rise at all. The crops died. The beasts changed. The dead found no rest. That was the First Night.', '很久以前，白昼一天比一天短，到后来，太阳再也没有升起。庄稼枯死，野兽变了样子，死去的人不得安息。那就是初夜。'),
      say('npc.ilse', 'Then Astra came. He took the crown of thorns. He was scourged at the pillar. He starved upon the scales. He was nailed to the holy wood.', '后来，阿斯特拉来了。他戴上荆棘冠，在刑柱上受鞭，在天平上忍饥，被钉在圣木之上。'),
      say('npc.ilse', 'And when the spear went through his heart, the sun rose.', '圣枪刺穿他心脏的那一刻，太阳升起来了。'),
      { emote: 'pip', mood: 'surprised' },
      say('pip', '...', '……', 'sad'),
      say('npc.pell', 'Lumi? You\'re shaking.', '露米？你在发抖。'),
      say('pip', 'No, I\'m not. It\'s just cold.', '我没有……是天太冷了。', 'shy'),
      say('npc.ilse', 'Suffering is not God\'s abandonment, Pell. It is the proof the debt is being paid. ...Now, children, tonight we give thanks at the flame. Pell, wash your hands first; your sleeves are covered in chalk.', '佩尔，苦难并非神的遗弃。苦难，是灾厄得以被偿还的证明。……好了，孩子们，今晚我们要在圣火前感恩。佩尔，先去把手洗干净，你的袖子上全是粉笔灰。'),
      { fact: 'ch1.tale', value: 1 },
    ],
  },
  {
    // The night of the theft, at the Ford: the river's ice already going, a lantern far off east.
    id: 'ford_night',
    when: { map: 'ford', facts: { [CH1.flameStolen]: 1, [CH1.letter]: 0 } },
    script: [
      say('npc.hesper', 'You saw him too? A man in grey walked across my river. The water froze under each step he took, and it had melted again behind him before I had my boots on.', '你也看见了？一个灰衣人从我的河上走过去了。他走一步，脚底下就结一层冰。我还没套上靴子，他身后的冰就化没了。'),
      say('player', '(Far off to the east, beyond the far bank, a small light bobs along the road, and goes out.)', '（远远的东边，过了对岸，一点小小的灯光沿着大路晃着，后来灭了。）'),
      say('npc.hesper', 'Thirty-one years I have kept this water. I have never seen it hold a man up.', '我在这条河上守了三十一年，从没见它托住过一个人。'),
    ],
  },
  {
    // Fennick, after you have asked him about the knight: what Alberic was. (He squired for him in the long hold, two
    // hundred and fifty years after the crowning: the crown had worn him long before Fennick was born.)
    id: 'fennick_memory',
    when: { map: 'meadow', objectives: ['pilgrim.fennick'] },
    script: [
      say('npc.fennick', 'I carried his lance for six years, when I was young. He had worn the crown two hundred and fifty years by then, and still he would stop the whole column to kneel down and talk to children by the road. Knights don\'t do that. He did.', '我年轻的时候给他扛过六年长枪。那时候他戴那顶冠已经两百五十年了，可走在路上，他还会让整支队伍停下来，自己单膝跪下，跟路边的孩子说话。骑士是不会这样做的。他会。'),
      say('npc.fennick', 'But the crown kept taking. Every year I was with him, there was a little less of him. One morning he looked at me and asked me my name.', '可那顶冠一直在拿走他的东西。我在他身边的那几年，他一年比一年少一点。有一天早上，他看着我，问我叫什么名字。'),
      say('npc.fennick', 'I left that night. ...If he asks your name, pilgrim, tell him. Somebody should.', '我当天夜里就走了。……朝圣者，要是他问你叫什么，告诉他。总得有人告诉他。', 'sad'),
    ],
  },
  {
    // Hesper, after you have asked her what she saw: the stumps, and Aldo's bridge.
    id: 'hesper_stumps',
    when: { map: 'ford', objectives: ['pilgrim.hesper'] },
    script: [
      say('npc.hesper', 'Look at the stumps by the bridge. Where the planks were, he drove thorns into the wood, like a man marking what is his.', '你去看桥边那几根桩子。原来搭木板的地方，他都钉上了荆棘，像是在自己的东西上做记号。'),
      say('npc.hesper', 'Aldo and Joss built that bridge the year before the river took Aldo. Every board I walked on, he cut.', '那座桥是阿尔多和乔斯一起搭的，搭好的第二年，河就把阿尔多带走了。我脚下踩的每一块板子，都是他锯的。'),
      say('npc.hesper', 'Mend it. Then go and tell that knight whose bridge it was.', '把桥修好。然后去告诉那个骑士，那是谁的桥。'),
    ],
  },
  {
    // First onto the East Road: the light is wrong, and the knight's thorns line the way.
    id: 'road_east',
    when: { map: 'eastroad', facts: { 'ford.crossed': 1 } },
    say: L('Is the sun lower than it was this morning? It\'s only just past noon. — And there are thorns all along the road, planted in a line.', '太阳是不是比早上低了？明明才过中午。——路边全是荆棘，一棵挨着一棵，种成了一排。'),
  },
  {
    // The barn of the burned farm: Edda comes out of hiding.
    id: 'edda_barn',
    when: { map: 'eastroad', region: 'barn', after: 'burned_farm' },
    script: [
      say('npc.edda', 'Stay back! ...You\'re alive. I\'m sorry. Nothing alive has come up this road in a long time.', '站住！……你是活人。对不住。这条路上很久没来过活人了。'),
      say('npc.edda', 'The days were too short, and the wheat died in the field. Then the night things came. Then a knight in white rode through and took everything that shone: the hinges, the pans, my husband\'s ring off the gatepost.', '白天太短，麦子没长成就死在地里了。后来夜里那些东西来了。再后来，一个穿白的骑士骑马过来，把会发亮的东西全拿走了——门上的铰链、锅，还有我丈夫挂在门柱上的戒指。'),
      say('npc.edda', 'The night the barn burned, a man in grey dragged me out of the smoke. Please don\'t tell them in the village. They wouldn\'t understand.', '谷仓烧起来的那天夜里，是一个灰衣人把我从烟里拖出来的。你别跟村里人说。他们不会明白的。'),
    ],
  },
  {
    // Before the thorns: the grey man waits on the road, and tries to turn the pilgrim back (docs/writing.md §5).
    id: 'severin_warning',
    when: { map: 'eastroad', region: 'thornroad', facts: { [CH1.letter]: 1 } },
    script: [
      { place: 'npc.severin', map: 'eastroad', x: 31, y: 11 },
      say('npc.severin', 'Pilgrim, go back. There is nothing at the end of this road that you are looking for.', '朝圣者，回去吧。这条路走到头，也没有你要找的东西。'),
      say('npc.severin', 'The knight beyond the thorns has held this road for three hundred years. He was a good man, and he still is.', '荆棘后面那位骑士，守这条路守了三百年。他是个好人，到现在也还是。'),
      say('npc.severin', 'Your Church wants you to take his crown. Take it, then. I will not stop you.', '教会要你去取他的冠冕。你去取吧，我不拦你。'),
      say('npc.severin', 'Only, when the crown comes off, something will come out of it. That, I will take with me.', '只是冠冕摘下来的时候，会有东西从里面出来。那个东西，我要带走。'),
      say('player', '(He looks at Lumi, for a long time, and says nothing. Then he turns and walks away.)', '（他看了露米一眼，看了很久，什么也没说，转身走了。）'),
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
      say('player', '(A logbook lies open on the table, its pages stiff with cold. Column after column of sunset times, year after year, each a little earlier than the last.)', '（桌上摊着一本日志，纸页冻得发硬。上面一栏一栏记着日落的时刻，一年接一年，每一年都比前一年早一点。）'),
      say('player', '(The last page: "Found a small light asleep in the snow by the cairn, warm as a coal. It woke and asked me how old it was.")', '（最后一页："在石堆旁的雪里发现一点睡着的光，暖得像炭火。它醒了，问我它多大了。"）'),
      say('pip', 'It\'s so cold in here... Let\'s go.', '这里好冷……我们快走吧。', 'sad'),
    ],
  },
  {
    // The grassland, first time: the herd keeps to the north, away from the trees.
    id: 'pasture_first',
    when: { map: 'pasture' },
    say: L('The cows are all crowded at the north end, as far from the trees as they can get. Are they afraid of something?', '牛都挤在北头，离树林能多远就多远。它们在怕什么吗？'),
  },
  {
    // Dusk on the grassland: the whole herd kneels, facing east, toward the knight's kingdom.
    id: 'kneeling_herd',
    when: { map: 'pasture', hour: { from: 17, to: 20 } },
    script: [
      say('player', '(The light turns amber. One by one the cows fold their front legs and go down on their knees, every one of them facing east.)', '（天光变成了琥珀色。牛一头接一头屈下前腿，跪了下去，全都朝着东边。）'),
      say('npc.brin', 'Every dusk, ever since the bridge went down. My gran never saw a cow kneel in her whole life.', '每天黄昏都这样，从桥断了那天起就是。我奶奶活了一辈子，也没见过牛下跪。'),
      say('npc.brin', 'And after dark the dead come up out of the trees. I\'ve lost three cows this month. If you can swing a weapon, come and find me.', '天一黑，死人就从林子里爬出来。这个月我已经丢了三头牛。你要是会使兵器，来找我。'),
    ],
  },
  {
    // The forest, first time: no birds.
    id: 'forest_quiet',
    when: { map: 'forest' },
    say: L('Listen. ...There are no birds. Not one. A forest this big ought to be noisy in the afternoon.', '你听……一声鸟叫都没有。这么大的林子，下午本来该很热闹的。'),
  },
  {
    // Deep in the forest: the cold camp of the pilgrim before you, the same proclamation nailed to a tree.
    id: 'pilgrim_camp',
    when: { map: 'forest', region: 'camp' },
    script: [
      say('player', '(A camp nobody has used in a very long time: a tent gone to rags, a ring of cold stones, and a cairn with a pilgrim\'s staff leaning on it.)', '（一处很久没人用过的营地：帐篷烂成了布条，一圈冷掉的石头，还有一座石冢，上面靠着一根朝圣杖。）'),
      say('pip', 'There\'s a paper nailed to that tree. It says, "The Seal-bearers weaken. Let the pilgrimage be called."', '那棵树上钉着一张纸。上面写着："持印者渐衰，当发朝圣令。"', 'surprised'),
      say('pip', 'It\'s very old. The name on it is Brother Cassian, of Firstlight. Sister Ilse might have known him.', '这张纸好旧了。上面的名字是初原村的卡西安修士。伊尔丝修女说不定认识他。', 'sad'),
      say('player', '(Something glints by the cairn: a scallop shell on a cord, the pilgrim\'s mark.)', '（石冢旁边有东西在闪：一枚穿在绳上的扇贝壳，朝圣者的标记。）'),
    ],
  },
  {
    // The camp after dark: a pale shape kneels at the cold fire, and says one thing.
    id: 'pilgrim_ghost',
    when: { map: 'forest', region: 'camp', hour: { from: 20, to: 4 }, after: 'pilgrim_camp' },
    script: [
      say('player', '(By the cold fire ring a pale shape is kneeling, its head bowed, as if it has knelt there for a very long time.)', '（冷掉的火圈旁跪着一个苍白的影子，低着头，像是已经在那里跪了很久。）'),
      say('player', '("Do not kneel to him," it says, without looking up.)', '（"别向他下跪。"它说，没有抬头。）', 'surprised'),
      { emote: 'pip', mood: 'surprised' },
      say('pip', 'It\'s gone. It was right there... Can we go now? Please?', '它不见了。刚才明明就在那儿……我们走吧，好不好？', 'sad'),
    ],
  },
  {
    // Thornwood Hollow, first time: the dead below sleep badly.
    id: 'hollow_first',
    when: { map: 'hollow' },
    say: L('Down there, past the thorns, the dead are sleeping badly. I can feel it from here, like a draught under a door.', '荆棘那边，地底下的死人睡得很不安稳。我在这儿都感觉得到，像门缝底下钻进来的风。'),
  },
  {
    // The barrow mouth: the carved stones of the Order of the Thorn.
    id: 'barrow_mouth',
    when: { map: 'hollow', region: 'mouth' },
    say: L('There\'s a knight carved on these stones, wearing a crown of thorns. Fennick might know who is buried down there.', '这些石头上刻着一个骑士，戴着荆棘冠。下面埋的是谁，芬尼克也许知道。'),
  },
  {
    // Millbrook, first time: the wheel turning slow.
    id: 'mill_first',
    when: { map: 'mill' },
    say: L('Listen to the wheel. It keeps stopping and starting. Tam says something has got into his cellar, and that\'s where the lamp oil is kept.', '你听那水车，转一阵停一阵的。塔姆说他的地窖里钻进了东西，灯油就放在那下面。'),
  },
  {
    // The cellar: the oil, and what moved in after dark.
    id: 'cellar_first',
    when: { map: 'millcellar' },
    say: L('Slimes, down here in the cellar! The oil flasks are on the shelves at the back.', '地窖里有史莱姆！油瓶在最里面的架子上。'),
  },
  {
    // Dawn Hill, first time: where the sun rose again.
    id: 'hill_first',
    when: { map: 'dawnhill' },
    say: L('They say this is where the sun came back after the First Night. Look, all the flowers up here face east. Those must be the dawnbloom.', '听说初夜过后，太阳就是从这里重新升起来的。你看，这里的花全都朝着东边。那些应该就是晨光花了。'),
  },
  {
    // The Chapel of the First Dawn: the bell rung, as it was the morning the sun came back.
    id: 'chapel_bell',
    when: { map: 'chapel', region: 'belfry' },
    script: [
      say('player', '(You take the old rope in both hands and pull. High above, the bell swings once, twice, and its voice rolls down the hill toward Firstlight.)', '（你双手握住那根旧绳，用力往下拉。高处的钟晃了一下，又一下，钟声顺着山坡一路传向初原村。）'),
      { emote: 'pip', mood: 'surprised' },
      say('pip', 'They\'ll hear that in the village!', '村里一定听得见！', 'happy'),
      say('pip', 'Sister Ilse says the Firstlight was lit on that hearth, from the first sun of that morning.', '伊尔丝修女说，初火就是在那座火坛上，借着那天早上的第一道阳光点起来的。', 'sad'),
    ],
  },
  {
    // The second floor: the Order of the Thorn buried its own here.
    id: 'ossuary_enter',
    when: { map: 'ossuary' },
    say: L('Bones in every wall, and a name over each one. Knights. A whole order of knights, buried down here together. ...They aren\'t resting either.', '每面墙里都是骨头，每一具上面都刻着名字。是骑士，一整个骑士团都埋在这底下。……他们也没有安息。'),
  },
  {
    // The niches: one is carved and empty, and someone keeps it swept.
    id: 'niches',
    when: { map: 'ossuary', region: 'niches' },
    say: L('This niche has a name on it, but nobody inside. "Fennick, squire to the Commander." Fennick? The old man on the bench in the village? And it has been swept clean.', '这个墓龛刻了名字，里面却是空的。"芬尼克，骑士长的侍从。"芬尼克？是村里坐在长凳上的那位老爷爷吗？而且这里扫得干干净净。'),
  },
  {
    // Oskar in the ossuary's cell: the stair, the roll, the warden below.
    id: 'oskar_cell',
    when: { map: 'ossuary', region: 'oskar_cell' },
    script: [
      say('npc.oskar', 'About time. I came down looking for another way out, and the dead herded me in here like a sheep.', '总算来了。我下来找别的出路，结果被那些死人像赶羊一样赶进了这儿。'),
      say('npc.oskar', 'Did you read the roll on the altar back there? Forty-odd knights of some Order of the Thorn. The last name is cut deeper than the rest.', '后面祭坛上那份名册，你看了没有？四十来个骑士，什么荆棘骑士团的。最后那个名字刻得比别的都深。'),
      say('npc.oskar', 'Whatever keeps this place is further down, at the bottom of the stair in the north-east corner. I heard it walking all night, back and forth, like a guard on a wall.', '看守这地方的东西在更底下，东北角那道楼梯下去就是。我听它走了一整夜，来来回回的，跟城墙上站岗的一样。'),
    ],
  },
  {
    // The third floor: the warden's sanctum.
    id: 'sanctum_enter',
    when: { map: 'sanctum' },
    say: L('It\'s standing in front of the altar, and it isn\'t coming for us. Is it keeping watch?', '它站在祭坛前面，没有朝我们过来。它是在站岗吗？'),
  },
  {
    // The statue before the thorns: a breath before the knight.
    id: 'statue_rest',
    when: { map: 'eastroad', near: { type: 'fixture/sacred/waypoint', r: 3 }, after: 'severin_warning' },
    say: L('A statue. We can rest here. If I ever have more than one power, this is where I can change it. ...It\'s cold past those thorns. Colder than at the shrine stone.', '是传送雕像，可以在这儿歇一歇。以后我要是有了不止一种力量，就在这种地方换。……荆棘那边好冷，比路碑那里还冷。'),
  },
]

/** The Held Ground (docs/chapter-1.md §12): the Oath-Thorn after the knight, his welcome there, the ground widening. */
export const HAVEN_STORY: StepDef[] = [
  {
    // After the crown: one thorn of it is still green where he fell, and warm (a save from before has it the next time it plays)
    id: 'oath_thorn',
    when: { facts: { [CH1.knight]: { ne: 0 }, 'haven.token': 0 } },
    script: [
      say('player', '(Among the thorns where the knight fell, one is still green. It is warm to the touch, and it hums, very faintly, like a door left open.)', '（骑士倒下的荆棘丛里，有一根还是绿的。摸上去是温的，还在很轻很轻地嗡嗡响，像一扇没关严的门。）'),
      { give: 'item/relic/oath_thorn' },
      { fact: 'haven.token', value: 1 },
      say('pip', 'I think it wants to be used, on you. Hold it and right-click yourself. I can hear a field on the other side of it. And... someone waiting.', '它好像想让你用一下——对你自己用。拿着它，右键点你自己。我听见它另一边有一片田野。还有……有人在等。', 'surprised'),
    ],
  },
  {
    // The first time in the Held Ground: the knight, unhelmed, keeps it.
    id: 'haven_first',
    when: { map: HAVEN_MAP },
    script: [
      { place: 'npc.alberic', map: HAVEN_MAP, x: HAVEN.heart[0] + 1, y: HAVEN.heart[1] + 1 },
      say('npc.alberic', 'You have come. ...You are the one who took the crown from me. I could not see your face then. Now I can.', '你来了。……替我摘下冠冕的，就是你。那时我看不清你的面容，如今看得清了。'),
      say('npc.alberic', 'I swore to hold until I was relieved. You relieved me. So now I hold for you: this ground, as far as the mist. It is yours. Build on it, sow it, keep beasts on it.', '我曾立誓，坚守到有人来接替为止。你接替了我。所以如今换我替你守着——这片土地，一直到雾的边缘。它归你了。盖屋、播种、养牲畜，都随你。'),
      say('npc.alberic', 'Bring me what a wider ground needs, and I will push the mist back. ...And tell me your name. This time, I would like to keep one.', '把扩地所需的东西带来，我便把雾推远些。……还有，请告诉我你的名字。这一次，我想记住一个名字。', 'sad'),
      say('npc.alberic', 'Take this, the coin of this ground. My stall keeps seeds, feed and bait, and buys back what you grow, raise and catch. There are fish in the pond.', '拿着，这是这片土地的钱币。我的货摊有种子、饲料和鱼饵；你种的、养的、钓的，我也收。池塘里有鱼。'),
      { give: 'item/misc/thornmark', count: 30 },
      { fact: 'haven.met', value: 1 },
    ],
  },
  ...([1, 2, 3] as const).map((n): StepDef => ({
    id: `haven_grow_${n}`,
    when: { map: HAVEN_MAP, facts: { 'haven.size': { gte: n } } },
    say: L(['', 'The mist pulled back! There\'s a grove out there, and stones.', 'Further again: a meadow, and water.', 'All of it now. Boundary stones at the edges... and iron in the rocks.'][n], ['', '雾退开了！那边有一片树林，还有石头。', '又退远了一圈——一片草地，还有水。', '雾全散了。边上立着界石……岩石里还有铁。'][n]),
  })),
]

/** The first chapter's card (`chapter_end`, and release 1's own `part_one`). */
const CHAPTER_END = {
  en: 'CHAPTER ONE · THE FIRST SEAL\n\nThe White Knight knelt, and gave up the Crown.\nThe grey man took the light east.\nAnd the night came a little sooner.',
  zh: '第一章 · 第一印\n\n白骑士跪下，交出了荆棘冠。\n灰衣人带着光往东去了。\n夜晚来得更早了一些。',
}

export const CHAPTER1_SCENES: StepDef[] = [
  {
    // The night of the flame: the village gives thanks for the rescue; the grey man takes the Firstlight.
    id: 'night_flame',
    // (not once the knight has fallen: a player who went straight for him finds the night already past)
    when: { map: 'meadow', hour: { from: 21, to: 24 }, facts: { 'village.rescued': 1, 'ch1.vigil': 1, [CH1.knight]: 0 } },
    script: [
      say('npc.rowan', 'Lina and Oskar are home. Tonight Firstlight gives thanks to the flame that has kept us, and to our guest, who went down into the barrow and brought them back.', '莉娜和奥斯卡回家了。今晚，初原村在这里感谢守护我们的圣火，也感谢这位客人——是你下到古墓里，把他们带了回来。'),
      say('npc.ilse', 'May Astra watch over us tonight. ...Go to your beds now. The flame keeps the night.', '愿阿斯特拉看顾今夜。……都回去睡吧，圣火会守着夜晚。'),
      { fade: 'out' },
      // the grey man's music as the dark falls (docs/music.md)
      { music: 'severin' },
      { wait: 10 },
      { place: 'npc.severin', map: 'meadow', x: v.severin[0], y: v.severin[1] },
      { fade: 'in' },
      say('player', '(A man in a grey cloak stands at the flame, ash on his hands. He lifts the fire into a hooded lantern as if it weighs nothing.)', '（一个披灰斗篷的男人站在圣火前，手上沾着灰。他把火捧起来，放进一盏带罩的提灯里，像是那团火没有一点分量。）', 'surprised'),
      { status: 'village.campfire', remove: 'lit' },
      say('npc.holt', 'Thief! Stop — THIEF!', '有贼！站住——抓贼！', 'angry'),
      say('npc.severin', '...Not tonight.', '……今晚不行。'),
      { move: 'npc.severin', x: 37, y: 18 },
      { place: 'npc.severin', map: 'offstage', x: 2, y: 2 },
      say('npc.holt', 'He went east, over the river! The water froze under his feet, and he walked straight across.', '他往东跑了，过河了！河水在他脚底下结了冰，他就那么走过去了。'),
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
      say('npc.courier', 'By order of the Holy City: the Seal-bearers weaken, and the Long Night returns. Let the pilgrimage be called.', '奉圣城之命：持印者渐衰，极夜将返。当发朝圣令。'),
      say('npc.courier', 'One has come down from the mountain with a fairy at their side. The Church names this one pilgrim.', '有一人携精灵自山上而来。圣教点名此人为朝圣者。'),
      { emote: 'npc.courier', mood: 'surprised' },
      say('player', '(The courier stares at Lumi for a long moment, and says nothing.)', '（信使盯着露米看了很久，什么也没说。）'),
      { give: 'item/document/proclamation' },
      say('npc.ilse', 'The flame taken, and the Church\'s letter come, in the same night. ...When you are ready, pilgrim, come to me.', '圣火被拿走的这一夜，圣教的信也到了。……朝圣者，等你准备好了，就来找我吧。'),
      { place: 'npc.courier', map: 'offstage', x: 5, y: 3 },
      { fact: CH1.letter, value: 1 },
    ],
  },
  {
    // The kingdom: stepping inside the ring of thorns, the White Knight speaks once.
    id: 'kingdom',
    when: { map: 'kingdom', region: 'kingdom' },
    script: [
      { music: '' },
      say('player', '(A field ringed with thorns, and stones carved as kneeling pilgrims. In the middle stands a knight in white, a crown of briars grown through his helm.)', '（一片被荆棘围起来的田野，一块块石头雕成跪着的朝圣者。正中间站着一位白衣骑士，荆棘冠长进了他的头盔里。）'),
      say(ALBERIC_ID, 'None cross that do not kneel.', '不跪者，不得过。'),
      say(ALBERIC_ID, 'Another pilgrim. They always send another.', '又一个朝圣者。他们总会再派一个来。'),
      say(ALBERIC_ID, 'I hold. I... hold. I no longer remember what.', '我守着。我……守着。守的是什么，我已经不记得了。'),
      say('pip', 'Be careful! When he plants his sword in the ground, thorns come up in a ring around him!', '小心！他把剑插进地里的时候，周围会冒出一圈荆棘！', 'surprised'),
    ],
  },
  {
    // The crown: the knight falls, gives up the crown; its power breaks loose; Lumi catches part of it; the
    // grey man takes the rest into the stolen flame, and goes. The night grows longer.
    id: 'crown',
    when: { map: 'kingdom', facts: { [CH1.knight]: 1 } },
    script: [
      { music: 'sorrow' },
      { wait: 22 },
      say('player', '(The knight kneels. For the first time in a long while he lifts the crown from his own head, and holds it out.)', '（骑士跪了下来。很久以来头一回，他亲手把荆棘冠从头上摘下，递了过来。）'),
      say('player', '("Take it. It was never mine to hold.")', '（"拿去吧。它本来就不该由我戴着。"）', 'sad'),
      { give: 'item/relic/crown_of_thorns' },
      say('player', '(Something comes loose from the crown, a cold light, and runs to Lumi like water finding an old riverbed.)', '（荆棘冠上有什么东西散了出来，是一道冷光。它像水寻着旧河床一样，流向了露米。）'),
      // the power leaves the kneeling knight and runs to her (the client's light and her glow); the scene waits for it
      { tell: 'pip', params: { what: 'boon', unlock: 'xp', from: ALBERIC_ID } },
      { wait: 32 },
      say('pip', 'It came to me! ...It\'s cold. Am I allowed to keep it?', '它到我这儿来了！……凉凉的。我可以留着它吗？', 'surprised'),
      { place: 'npc.severin', map: 'kingdom', x: kd.severin[0], y: kd.severin[1] },
      { music: 'severin' },
      say('player', '(The grey man opens his lantern. The rest of the light goes into the stolen flame. It flares gold and gutters, and his hand shakes.)', '（灰衣人打开提灯，剩下的光流进了那团被偷走的圣火。火苗一下子变成金色，摇晃起来；他的手在发抖。）'),
      say('npc.severin', 'Every seal you break makes the night longer. Ask your Church why.', '你每打破一道印，夜就会更长一些。去问你的教会，这是为什么。'),
      say('npc.severin', 'Keep what the little one caught. Go home, and tell Rowan the light is safer with me than with any of you.', '那个小家伙接住的，你留着。回去吧，告诉罗万，光在我手里，比在你们那里安全。'),
      { move: 'npc.severin', x: KINGDOM.east - 2, y: 11 },
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
      say('npc.rowan', 'The Crown of Thorns, here in Firstlight. ...And that heretic still has our flame.', '荆棘冠到了初原村。……可我们的圣火，还在那个异端手里。', 'angry'),
      say('npc.ilse', 'He always did carry things that were too heavy for him.', '他从小就总是背着对他来说太重的东西。', 'sad'),
      say('npc.nessa', 'Four minutes. The sun set four minutes early tonight. I am sure it means nothing.', '四分钟。今晚太阳早落了四分钟。……我想这应该不代表什么。'),
      { fact: CH1.end, value: 1 },
      { music: 'ending' },
    ],
  },
  {
    // The chapter's card, with Part Two open (the dev console's, or a later release's): the road goes on east.
    id: 'chapter_end',
    when: { after: 'return', facts: { [PART_TWO]: 1 } },
    script: [{ card: L(CHAPTER_END.en, CHAPTER_END.zh) }],
  },
  {
    // Release 1 is Part One (docs/release-1.md §1): it ends here, with the Crown home. The road on east to Emberfall
    // waits for Part Two (PART_TWO); Firstlight, its country, the Pilgrim's Road and the Held Ground stay the player's.
    id: 'part_one',
    when: { after: 'return', facts: { [PART_TWO]: 0 } },
    script: [
      {
        card: L(
          `${CHAPTER_END.en}\n\nThe road on east opens in Part Two.\nUntil then, Firstlight, its country and the Held Ground are yours.`,
          `${CHAPTER_END.zh}\n\n继续往东的路，在第二部开放。\n在那之前，初原村、它周围的山野和誓守之地都是你的。`,
        ),
      },
    ],
  },
]
