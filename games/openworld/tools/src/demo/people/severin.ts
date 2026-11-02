// Severin, the Greyvowed (docs/chapter-1.md §5): last of the Ashen Watch, the youngest of the brothers the Church named
// heretics ten years ago; a foundling Sister Ilse raised. He believes Astra is the monster and works against the
// pilgrimage; he never harms anyone and never fights the player. He appears only in the story's scenes (placed, then
// gone): he lives nowhere the player can visit yet. His portrait (docs/cast/severin.md): dark hair, gold eyes, the hood up,
// the lantern.

import { line, type PersonDef } from '../person.ts'

export const severin: PersonDef = {
  id: 'npc.severin',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  role: 'stranger',
  essential: true,
  name: { en: 'The Grey Man', zh: '灰衣人' },
  gender: 'male',
  look: { parts: { face: 'face.keen', outfit: 'outfit.cloak', hat: 'hat.hood', beard: 'beard.stubble', hair: 'hair.short' }, colors: { hair: 'black', eyes: '#d4a84a', skin: 'light', 'outfit.1': 'charcoal', 'outfit.2': 'slate', 'hat.1': 'charcoal' } },
  age: 30,
  temperament: { personality: 'grim', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.ilse': 'raised by her' },
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/potion/mystery', 2], ['item/vessel/flask/oil', 2], ['item/misc/bomb', 1], ['item/light/lantern', 1]] },
  purse: 30,
  schedules: {
    // after the end: by the door of the Holiest, keeping it (docs/finale.md §6)
    'fact:fin.end': [[0, 24, 'holiest:severin.door', 'keep the door']],
    // in the Holy City he goes in under, and is placed by the scenes
    'fact:world.fin': [[0, 24, 'offstage:severin.hide', 'keep out of sight']],
    // in the Heights with the pilgrim (docs/chapter-5.md §5): in the abbey's garth
    'fact:world.ch5': [[0, 24, 'whiteveil:severin.garth', 'wait in the garth']],
    // with the pilgrim once the fourth seal is down (docs/chapter-4.md §5): waiting at Nailgate's landing until the road west
    'fact:ch4.wood': [[0, 24, 'nailgate:severin.landing', 'wait by the landing']],
    // off the map until a scene places him (the story's `place`)
    default: [[0, 24, 'offstage:severin.hide', 'keep out of sight']],
  },
  lines: [
    line('fact:ch4.wood', 'Severin. That is my name; you may as well have it now. I was a brother of the Ashen Watch. We kept the flames that were lit at the first dawn.', '塞弗林。这是我的名字，现在告诉你也无妨。我曾是灰烬守望的修士。我们守着第一次黎明时点起的那些火。', { once: true }),
    line('fact:ch4.wood', 'The lantern holds four now. It is heavier than it looks. Do not ask me what I mean to do with it. I will tell you in the Holy City.', '灯里现在有四道了。它比看上去重。别问我打算拿它做什么。到了圣城，我会告诉你。'),
    line('fact:fin.end', 'The Watch kept the flame of the first dawn. I will keep this one. Do not ask me to go up. I have been up.', '灰烬守望守着第一次黎明的火。这一个，我来守。别叫我上去。上面我已经去过了。', { mood: 'sad' }),
    line('fact:fin.end', 'Ilse will see the morning. That is enough. I used to say nothing was ever enough.', '伊尔丝会看见早晨的。这就够了。我以前总说，什么都不够。'),
    line('fact:fin.night', 'He asked you to leave. He meant it, every time. And then he was glad.', '他叫你离开。每一次他都是真心的。然后，他很高兴。'),
    line('fact:ch5.roll', 'A new body. Do you see it now? Every pilgrim of four hundred years, sent to be weighed for it. The ones who fell, they put under the altar to do the fifth seal\'s work.', '一副新的身体。你现在明白了吗？四百年来的每一个朝圣者，都是被送去给它掂量的。倒下的，就被放到祭坛底下，替第五印干活。'),
    line('fact:ch5.lance', 'The flame is white now. It has never been white. ...In the Holy City, I will tell you what I mean to do with it. Not before.', '火现在是白的了。它从来没有白过。……到了圣城，我会告诉你我要拿它做什么。之前不说。'),
    line('fact:ch4.end', 'Sister Ilse raised me. If you go home before the end, tell her I am well. It will be a lie, but she will like it.', '伊尔丝修女把我养大的。你要是在结束之前回去，告诉她我很好。这是谎话，可她会高兴的。', { once: true }),
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'Do not follow me. What I am doing has nothing to do with you.', '别跟着我。我做的事，跟你没有关系。'),
    line('chat', 'The ash on my hands does not wash off. It never did, for any of us who kept the flames.', '我手上的灰洗不掉。以前守火的人，都是这样。'),
    line('default', '...', '……'),
  ],
}
