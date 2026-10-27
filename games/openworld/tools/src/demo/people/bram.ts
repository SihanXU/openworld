// Bram, the old drillmaster of Firstlight Village. He trained the road wardens before the
// storms came, and now trains whoever walks down from the mountain and lasts long enough to
// be worth it (level 5). Blade, mace, bow or wand: he sets you on one, and lets you change
// your mind — at the cost of starting that road again. He keeps the yard day and night and
// never leaves his spot, a mark over his head, so he is easy to find.

import { line, type PersonDef } from '../person.ts'

export const bram: PersonDef = {
  id: 'npc.bram',
  role: 'trainer',
  essential: true,
  name: { en: 'Bram', zh: '布拉姆' },
  gender: 'male',
  look: { parts: { hair: 'hair.thin', face: 'face.stern', outfit: 'outfit.gi', beard: 'beard.moustache', hat: null }, colors: { hair: 'steelgrey', eyes: 'storm', skin: 'warm', 'outfit.1': 'undyed', 'outfit.2': 'umber' } },
  age: 61,
  temperament: { personality: 'stern', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.tobin': 'the peddler who talks through his drills' },
  // a trainer struck strikes back
  fights: true,
  purse: 60,
  // he keeps the drill yard day and night, standing where anyone can find him (tag stationary)
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/weapon/blade/dagger', 1], ['item/weapon/blade/sword', 1], ['item/weapon/ranged/bow', 1], ['item/weapon/magic/staff', 1]] },
  schedules: {
    default: [[0, 24, 'meadow:drill.yard', 'keep the drill yard']],
  },
  tags: ['stationary'],
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'Before the storms I trained the road wardens in this yard. The road is cut now. I train whoever comes down the mountain.', '起风暴以前，我在这个院子里练巡路的卫士。现在路断了，从山上下来的人，谁来我就教谁。'),
    line('chat', 'Sleep before a long fight. When the arm tires, the guard drops first. I tell every one of them. Few listen.', '打大仗之前先睡够。人一累，最先垂下来的就是护身的那只胳膊。这话我跟每个人都说过，没几个听的。'),
    line('favourite', 'If you want to see an old man pleased, bring me {favourite}. Tobin knows I like it, and charges me more for it.', '想让我这老头子高兴，就带{favourite}来。托宾知道我喜欢，每回卖给我都要多收几个钱。'),
    // said once, at whatever level one first comes by: the road opens at level five
    line('greeting:first', 'Off the mountain, are you. When you have a few fights behind you — level five — come to me, and I will set you on a road: dagger, sword and shield, bow, or staff. Choose when you are ready.', '从山上下来的吧。等你打过几场仗、到了五级，再来找我，我给你指一条路：匕首，剑和盾，弓，或者法杖。想好了再选。', { once: true }),
    line('default', 'Pick a road and keep to it. You can change if you must, but the new road starts again from the first step.', '选了一条路，就一直走下去。真想换也可以，只是新的那条得从头练起。'),
    line('default', 'The dagger works from behind. Sword and shield from the front. The bow from far off. The staff from wherever you stand. Which will you be?', '匕首是从背后下手的，剑和盾是正面硬碰的，弓是远远地射，法杖站在哪儿都能施法。你想当哪一种？'),
    line('default', 'Tobin stands at the edge of every drill and talks the whole way through. I have given up telling him to go.', '托宾每回都站在边上，一边看操练一边说个没完。我已经懒得赶他走了。'),
    line('hour:evening', 'The light is going. Practise your footwork; you do not need light for that.', '天快黑了。去练步法吧，步法不用看也能练。'),
    line('weather:rain', 'Rain makes the grip slip. Wrap the handle in cloth, and hold it tighter.', '下雨天手握不稳。拿布把握柄缠一圈，再握紧些。'),
    line('given', 'Keep it. You will need it more than I do.', '你留着吧。你比我用得着。'),
  ],
}
