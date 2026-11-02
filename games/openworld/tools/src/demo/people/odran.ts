// Odran, an old brother of the Red Order (docs/chapter-2.md §7): he left the Scourging House forty years ago and came
// over the pass to Emberfall, where Mara gave him an empty house on the square. His back is a lattice of scars he feels
// only on cold mornings. Matthias once took his lashes for him. He left because one morning he cut his hand on a scythe
// and felt nothing, and was afraid; he has never told anyone.

import { line, type PersonDef } from '../person.ts'

export const odran: PersonDef = {
  id: 'npc.odran',
  role: 'villager',
  essential: true,
  tags: ['storybound'],
  name: { en: 'Odran', zh: '奥德兰' },
  gender: 'male',
  look: { parts: { hair: 'hair.thin', face: 'face.weary', outfit: 'outfit.cloak', beard: 'beard.stubble', hat: null }, colors: { hair: 'snow', eyes: 'storm', skin: 'tan', 'outfit.1': 'russet' } },
  age: 74,
  favourite: 'item/food/bread',
  temperament: { personality: 'quiet', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.lucan': 'novice with him long ago', 'npc.mara': 'gave him a house' },
  purse: 15,
  trade: { stock: [['item/food/bread', 2], ['item/material/cloth', 2], ['item/light/candle', 2]] },
  schedules: {
    default: [
      [21, 7, 'emberfall.west:bed.0', 'sleep'],
      [7, 12, 'emberfall:odran.square', 'sit on the square'],
      [12, 14, 'emberfall.west:bed.0', 'eat at home'],
      [14, 19, 'emberfall:odran.square', 'mend shutters on the square'],
      [19, 21, 'emberfall.west:bed.0', 'keep the fire in'],
    ],
  },
  lines: [
    line('chat', 'My back itches on cold mornings. It is the scars. It is the only time I feel them.', '天冷的早上，后背就痒。是那些疤。只有这时候，我才觉得到它们。'),
    line('chat', 'Mara let me have this house when the family went south. I keep the fire in it, and the roof over it.', '这户人家往南搬走以后，玛拉让我住了进来。我替他们看着火，也看着屋顶。'),
    line('chat', 'Garrick makes good nails. I mend one shutter on the square a week with them.', '加里克打的钉子好。我每个礼拜用它们修广场上的一扇窗板。'),
    line('greeting:first', 'A pilgrim with a fairy. Then you are going over the pass. I am Odran. Forty years ago I was a novice of the Red Order, in the Scourging House on the other side. I came this way, and stayed.', '带着妖精的朝圣者。那你是要翻山过去的。我叫奥德兰。四十年前，我是红衣修会的见习修士，就在山那边的鞭笞院。后来我往这边走，就留下了。', { once: true }),
    line('default', 'When you are over the pass, watch your blood, not your pain. You will not feel your cuts there. Nobody does.', '过了山口，要盯着自己流的血，别等疼来提醒你。在那边，身上划了口子是不会疼的，谁都不会。'),
    line('default', 'The Rider took twelve strokes for me once, my first evening at the posts. He said he had room.', '我头一个晚上站到柱子前面，骑者替我挨了十二鞭。他说，他还担得下。'),
    line('hour:evening', 'Dusk. Over there the brothers will be standing at the posts now.', '黄昏了。那边的修士，这会儿该站到柱子前面去了。'),
    line('fact:mq.dragon', 'The pass is open, then. The iron carts will go over to the Host again.', '这么说，山口通了。运铁的大车又能翻过去，送到赤军那边了。'),
    line('fact:ch2.dusk', 'One morning I cut my hand on a scythe and watched the blood run, and felt nothing. I packed my bag that night. ...I have never told anyone that.', '有一天早上，我被镰刀割了手。我看着血往下流，一点感觉都没有。当天晚上，我就收拾了包袱。……这件事，我从来没跟人说过。', { once: true, mood: 'sad' }),
    line('topic:quiet_dusk', 'They say the whole March cried out on one evening. I heard nothing from here. But my back hurt all night, the way it did when I was a novice.', '听说整片边境在同一个晚上喊了起来。我在这儿什么也没听见。可我的背疼了一整夜，跟当年做见习修士的时候一样。', { mood: 'sad' }),
    line('given:item/food/bread', 'Bread. Thank you. I eat at the window, where I can see the pass.', '面包。谢谢你。我在窗边吃，那里看得见山口。', { mood: 'happy' }),
  ],
}
