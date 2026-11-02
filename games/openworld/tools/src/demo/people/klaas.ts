// Klaas, the ferryman of the dead (docs/chapter-4.md §7): seventy-one. He has kept his boat tarred for forty years without
// a passenger, and keeps the coins the dead used to bring in a box at the landing.

import { line, type PersonDef } from '../person.ts'

export const klaas: PersonDef = {
  id: 'npc.klaas',
  role: 'ferrykeeper',
  essential: true,
  tags: ['storybound'],
  name: { en: 'Klaas the Ferryman', zh: '渡人克拉斯' },
  gender: 'male',
  look: { parts: { hair: 'hair.thin', face: 'face.weary', outfit: 'outfit.oilcloth', beard: 'beard.full', hat: 'hat.hood' }, colors: { hair: 'snow', eyes: 'storm', skin: 'tan', 'outfit.1': 'charcoal', 'hat.1': 'slate' } },
  age: 71,
  favourite: 'item/vessel/flask/oil',
  temperament: { personality: 'quiet', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.hedda': 'owes her a crossing' },
  purse: 8,
  trade: { stock: [['item/vessel/flask/oil', 2], ['item/food/fish/eel', 1]] },
  schedules: {
    default: [
      [21, 6, 'nailgate.klaas:bed.0', 'sleep'],
      [6, 21, 'nailgate:klaas.landing', 'keep the landing'],
    ],
  },
  lines: [
    line('chat', 'I tar her every spring. Some years I take her out to the middle and sit. She knows the way. So do I.', '每年开春我都给它上焦油。有些年头，我把它划到河中间，坐一会儿。它认得路。我也认得。'),
    line('chat', 'The dead used to bring a coin. I kept them all, the ones I did not need to give back. A boxful, and no one to carry.', '从前死人都要带一枚钱来。我全都收着，除了那些后来又退回去的。满满一箱，却没有人要渡了。'),
    line('greeting:first', 'You want across? There is no across, not for the living. I am Klaas. I row the dead. I have not rowed anyone in forty years.', '你要过河？没有河可过，对活人来说没有。我叫克拉斯，渡死人的。四十年了，我没渡过一个人。', { once: true }),
    line('default', 'Forty years ago the dusk stopped lifting, and the next morning my first passenger walked home instead. Since then the Keeper sends them all home.', '四十年前，黄昏就不再散去。第二天早上，我的第一个客人没上船，自己走回家了。从那以后，守护者把他们都送回了家。'),
    line('hour:evening', 'There he goes, on the causeway. The bells. He is gathering them.', '他来了，在长堤上。听那铃铛。他在收拢他们。'),
    line('fact:ch4.nessa', 'The almanac woman asked me what is on the other side, these days. I said I do not know. I have not been since it changed.', '那个编历书的女人问我，如今河对岸是什么。我说不知道。自从变了以后，我就再没去过。'),
    line('topic:reins_let_go', 'The bells stopped. Did you hear? All of them at once. ...Help me with the ropes.', '铃铛停了。你听见了吗？一下子全停了。……帮我解一下缆绳。'),
    line('fact:ch4.end', 'I took them across. It was dark on the other side, and quiet. I do not know what it is now. But they went.', '我把他们渡过去了。对岸很黑，很安静。我不知道那边如今是什么。可他们去了。', { mood: 'sad' }),
    line('given:item/vessel/flask/oil', 'Oil. For the oarlocks. Thank you.', '油。抹桨架用的。谢谢。', { mood: 'happy' }),
  ],
}
