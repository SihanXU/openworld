// Holt, the village's one guard. He watches the trail south, where the things of the hollow
// come up the way the storm left open. When the Crown is home he goes east after the grey man: to Emberfall, then over
// the pass, where he signs on with the Red Host's Left Company; when Matthias falls his wounds come back to him all at
// once, and the grey man sits by his cot (docs/chapter-2.md §7). After the March he goes home.

import { line, type PersonDef } from '../person.ts'

export const holt: PersonDef = {
  id: 'npc.holt',
  role: 'guard',
  essential: true,
  name: { en: 'Holt', zh: '霍尔特' },
  gender: 'male',
  look: { parts: { hair: 'hair.short', face: 'face.keen', outfit: 'outfit.gambeson', hat: null, beard: null }, colors: { hair: 'umber', eyes: 'storm', skin: 'light', 'outfit.1': 'madder' } },
  age: 38,
  temperament: { personality: 'dutiful', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: {},
  // he keeps the village's watch (docs/npc-sandbox.md §2.7): he stops the wanted, and fights back
  watch: 'firstlight',
  fights: true,
  purse: 25,
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/light/torch', 3], ['item/weapon/polearm/spear', 1], ['item/potion/healing', 1]] },
  schedules: {
    default: [
      [23, 6, 'meadow.guards:bed.0', 'sleep'],
      [6, 23, 'meadow:guard.post', 'watch the south trail'],
    ],
    // (the variants keep their order: the first that holds is his — home after the March, else the camp, else Emberfall)
    'fact:ch2.end': [
      [23, 6, 'meadow.guards:bed.0', 'sleep'],
      [6, 23, 'meadow:guard.post', 'watch the south trail'],
    ],
    // over the pass with the Red Host's Left Company
    'fact:mq.dragon': [
      [22, 6, 'redcamp:holt.bed', 'sleep'],
      [6, 22, 'redcamp:holt.drill', 'drill with the Left Company'],
    ],
    // east after the thief, as far as Emberfall
    'fact:ch1.end': [
      [22, 6, 'emberfall.north:bed.0', 'sleep'],
      [6, 22, 'emberfall:holt.square', 'ask after the grey man'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'A quiet night is a good night. I\'ve had three this week. That\'s more than last week.', '夜里安安静静的就是好夜。这个礼拜有三个，比上个礼拜多。'),
    line('chat', 'Fennick taught me to stand still. It\'s harder than it sounds. Try it for an hour.', '站着一动不动，是芬尼克教我的。听着容易，你站上一个钟头就知道了。'),
    line('default', 'It\'s safe inside the fence. Past Dusklea, keep your blade out. After dark, keep it out everywhere.', '围栏里头太平。出了暮牧原就把刀拿在手上。天黑以后，在哪儿都别收刀。'),
    line('hour:night', 'Hear that shuffling? The dead walk the wild at night. None has got past the fence yet. That\'s what I\'m here for.', '听见那拖着脚走路的声音了吗？夜里荒野上有死人在走。到现在还没有一个过得了围栏。我站在这儿，就是为了这个。'),
    line('fact:ch1.flame_stolen', 'I had him. I had him at the length of my spear, and he looked at me like I was a child, and walked away on the water.', '我差一点就抓住他了。他就在我长矛够得着的地方。他看我的样子，像在看一个小孩。然后他就踩着水走了。', { mood: 'angry' }),
    line('fact:ch1.end', 'When you go on east, I want to come. Someone has to catch that thief.', '你往东走的时候，我想跟你一起去。那个贼，总得有人去抓。'),
    line('fact:mq.dragon', 'The grey man went over the pass before the dragon came down, the miners say. I am going after him.', '矿工们说，魔龙下山以前，那个灰衣人就翻过山口去了。我要去追他。'),
    line('fact:ch2.camp', 'The Left gave me a spear and a place in the line. Nobody here asks where you are from.', '左营给了我一支矛，在队列里给了我一个位置。这儿没人问你是从哪儿来的。'),
    line('topic:quiet_dusk', "The thief burned the cut shut and sat with me till it stopped bleeding. I'm not going after him. Not this time.", '那个贼把伤口烙上了，一直陪我坐到血止住。我不追他了。这回不追了。', { mood: 'sad' }),
    line('fact:ch2.end', 'My side still pulls when I laugh. The grey man\'s burn is holding. Rowan will want his guard back.', '我一笑，腰上就扯着疼。灰衣人烙的那道伤还撑得住。罗万该等着他的卫兵回去了。'),
  ],
}
