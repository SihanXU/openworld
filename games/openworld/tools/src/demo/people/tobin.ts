// Tobin, the peddler. He brings charms and odd goods from the east twice a year and talks the
// whole way. The storm stopped the ferry, so he moved his cart to Firstlight Village with
// things nobody here will buy and nothing to eat. He owes Hesper last autumn's fare and hopes she has forgotten
// (she has not). He is afraid of the slimes that come up out of the hollow at night. His portrait (docs/cast/tobin.md): copper hair,
// green eyes, the teal coat, the pack of wares.

import { line, type PersonDef } from '../person.ts'

const CART = { uses: 'ford.cart', need: { notStatus: ['burning'] } }
const FIRE = { uses: 'village.campfire', need: { status: ['lit'] } }

export const tobin: PersonDef = {
  id: 'npc.tobin',
  role: 'peddler',
  essential: true,
  name: { en: 'Tobin', zh: '托宾' },
  gender: 'male',
  look: { parts: { hair: 'hair.messy', face: 'face.bright', outfit: 'outfit.travel', hat: 'hat.cap', beard: null }, colors: { hair: 'copper', eyes: 'leaf', skin: 'warm', 'outfit.1': 'teal', 'hat.1': 'mustard' } },
  age: 34,
  temperament: { personality: 'chatty', manner: 'polite', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.hesper': 'the ferrykeeper he owes a fare' },
  // a peddler sells his oddments, and asks no questions about what he is sold (a fence); he tells the watch nothing
  trade: { stock: [['item/vessel/flask/oil', 2], ['item/clothing/hood', 1], ['item/tool/lockpick', 2], ['item/misc/firework', 2], ['item/misc/mirror', 1], ['item/misc/lute', 1]], fence: true },
  purse: 40,
  honesty: 0.5,
  lawful: false,
  schedules: {
    default: [
      [22, 6, 'meadow:cart.bed', 'sleep'],
      [6, 9, 'meadow:cart', 'mind the cart', CART],
      [9, 11, 'meadow:square.well', 'fetch water'],
      [11, 19, 'meadow:cart', 'mind the cart', CART],
      [19, 22, 'meadow:square.warm', 'warm his hands', FIRE],
    ],
    storm: [
      [22, 6, 'meadow:cart.bed', 'sleep'],
      [6, 22, 'meadow:market.shelter', 'wait out the storm'],
    ],
    // the Firstlight taken: he sits by the cold pit and does not strike a flint in it (chapter-1.md: the altar stays
    // cold unless the pilgrim lights it; a fire he needed lit, he would light again)
    'fact:ch1.flame_stolen': [
      [22, 6, 'meadow:cart.bed', 'sleep'],
      [6, 9, 'meadow:cart', 'mind the cart', CART],
      [9, 11, 'meadow:square.well', 'fetch water'],
      [11, 19, 'meadow:cart', 'mind the cart', CART],
      [19, 22, 'meadow:square.warm', 'sit by the cold fire'],
    ],
    'fact:ch1.flame_stolen+storm': [
      [22, 6, 'meadow:cart.bed', 'sleep'],
      [6, 22, 'meadow:market.shelter', 'wait out the storm'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', "Every charm on this cart, I can tell you where it came from. This bell I had off an old nun on the coast road, and that red cord — no, wait, don't go, I haven't got to the good part yet.", '这车上的护符，每一个我都能给你讲出来历。这个铃铛是在海边那条路上跟一位老修女换的，那根红绳嘛——哎，你别走啊，最好听的还没讲到呢。'),
    line('chat', "Where am I from? I usually give three places, depending on the day. One of them is even right.", '问我是哪儿人？我一般说三个地方，看那天的心情。其中有一个还真是对的。'),
    // the news the story spreads (its topics), said once while fresh
    line('topic:dragon_slain', "They say the dragon's dead and the road to Emberfall is open again! At last there's somewhere to sell what's on this cart. When I've some coin, I'll buy you a drink — I mean it.", '听说龙死了，去余烬镇的路又通了！我车上这些东西总算有地方卖了。等我手头有了钱，一定请你喝一杯——说真的。'),
    line('topic:crossed', "You crossed Vesper Ford! Then the road east is yours to try. Bring me back something strange.", '你过了晚祷渡！那东边的路就归你闯了。回来时给我带点稀奇东西。'),
    line('greeting:first', "Welcome to Firstlight Village! Tobin, of the eastern road. Charms, oils, oddments — the ferry is still broken, so I brought the cart here. You wouldn't have anything to eat?", '欢迎来初原村！我叫托宾，跑东边那条路的。护符、灯油、杂货都有——渡船还没修好，我就把货车拉到这儿来了。你身上没带点吃的吧？', { mood: 'surprised', once: true }),
    line('default', "I'd trade the whole cart for a hot meal. Well — not the whole cart. Most of it.", '为了一顿热饭，我愿意拿整车货来换。嗯——也不是整车。大半车吧。'),
    line('default', 'That blue wand? Frost from the tip. Freezes a puddle solid. A river, I would not know — never tried.', '那根蓝魔杖？杖尖冒寒气，能把水洼冻得结结实实。河嘛，我不知道——没试过。'),
    line('default', "Hesper says I still owe her last autumn's fare. I told her we'd settle up once the ferry's running again. She just glared at me.", '赫斯珀说我还欠她去年秋天的船钱。我跟她说，等渡船修好了再算。她瞪了我一眼，一句话也没说。'),
    line('default', "Lamp oil, one flask. It burns hot and fast, and spilt on the ground it's slick as ice. Be careful with it. Last time I set my own sleeve alight.", '这是灯油，一瓶。烧起来又旺又猛，洒在地上滑得站不住人。用的时候小心点。我上回就把自己的袖子给点着了。'),
    line('default', 'I sold a frost charm to a man in grey last winter. Paid in old coin — no king on it. Never seen coin like it. Kept one for luck.', '去年冬天我卖了个寒霜护符给一个穿灰衣服的人。他用旧钱币付的——上面没有国王的头像。那样的钱我从没见过。留了一枚图个吉利。'),
    line('fact:ch1.flame_stolen', 'The man in grey? The frost charm! That is how he crossed — oh, Hesper will never forgive me for that one.', '那个灰衣人？寒霜护符！他就是靠那个过的河——哎呀，这件事赫斯珀永远不会原谅我了。', { mood: 'surprised' }),
    line('hour:evening', "The village fire is warm. Better than sleeping by the hollow at Vesper Ford with one eye open.", '村里的火真暖和。总比在晚祷渡那个坑边上睡觉强，那边还得睁着一只眼睛。'),
    line('hour:night', "Shh. Did you hear that? … Probably nothing. Probably.", '嘘。你听见了吗？……大概没什么。大概。', { mood: 'surprised' }),
    line('weather:storm', "Not under the tree! Never under the tree in a storm. My uncle — well. Never mind my uncle.", '别站树底下！打雷的时候千万别站树底下。我叔叔他——算了，别提我叔叔了。', { mood: 'surprised' }),
    line('weather:rain', "Rain on the charms. The little bells rust if they get damp — I'd better cover them.", '下雨了，护符都淋湿了。那些小铃铛一受潮就生锈，我得赶紧盖上。'),
    line('fact:ford.charm', 'Go on, take the wand off the cart. A deal is a deal, and that bread was a very good deal.', '去吧，把魔杖从车上拿走。说好的就是说好的，那块面包可太划算了。', { once: true, mood: 'happy' }),
    line('fact:ford.winch', 'The line is mended? Then Hesper will take you — and maybe me, if I promise to pay. Again.', '渡绳接上了？那赫斯珀会送你过去——说不定也肯送我，只要我再保证一次会付钱。', { once: true }),
    line('fact:ford.tree', "You felled the dead tree! Across the river! I'll be telling that one in every inn from here to the coast.", '你把枯树砍倒了！正好横在河上！这件事我要从这儿一路讲到海边，每家客栈都讲一遍。', { once: true, mood: 'happy' }),
    line('topic:theft', "I saw that. I'm a peddler — I always see that.", '我看见了。我是货郎——这种事我总能看见。', { mood: 'angry' }),
    line('given:item/food', 'Oh — oh, thank you. Two days. Two whole days.', '哦——哦，谢谢你。两天了。整整两天了。', { mood: 'happy' }),
    line('given', "For me? I'll find a buyer for it somewhere. I always do.", '给我的？我总能给它找到买主。一向如此。'),
  ],
}
