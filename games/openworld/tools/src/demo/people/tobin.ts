// Tobin, the peddler. He brings charms and odd goods from the east twice a year and talks the
// whole way. The storm stopped the ferry, so he moved his cart to Firstlight Village with
// things nobody here will buy and nothing to eat. He owes Hesper last autumn's fare and hopes she has forgotten
// (she has not). He is afraid of the slimes that come up out of the hollow at night.

import { line, type PersonDef } from '../person.ts'

const CART = { uses: 'ford.cart', need: { notStatus: ['burning'] } }
const FIRE = { uses: 'village.campfire', need: { status: ['lit'] } }

export const tobin: PersonDef = {
  id: 'npc.tobin',
  role: 'peddler',
  essential: true,
  name: { en: 'Tobin', zh: '托宾' },
  gender: 'male',
  look: { parts: { hair: 'hair.messy', face: 'face.bright', outfit: 'outfit.travel', hat: 'hat.cap', beard: null }, colors: { hair: 'chestnut', eyes: 'amber', skin: 'warm', 'outfit.1': 'russet', 'hat.1': 'mustard' } },
  age: 34,
  temperament: { personality: 'chatty', manner: 'polite', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.hesper': 'the ferrykeeper he owes a fare' },
  // a peddler sells his oddments, and asks no questions about what he is sold (a fence); he tells the watch nothing
  trade: { stock: [['item/vessel/flask/oil', 2], ['item/clothing/hood', 1], ['item/tool/lockpick', 2], ['item/misc/firework', 1]], fence: true },
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
  },
  lines: [
    // the news the story spreads (its topics), said once while fresh
    line('topic:dragon_slain', "Emberfall is open again, they say, now the dragon is down. Good roads, good trade. I will drink to you, when someone else pays.", "听说龙一倒，余烬镇又通了。路好走，买卖就好做。我敬你一杯——等有人请客的时候。"),
    line('topic:crossed', "You crossed the Ford! Then the road east is yours to try. Bring me back something strange.", "你过了渡口！那东边的路就归你闯了。回来时给我带点稀奇东西。"),
    line('greeting:first', "Welcome to Firstlight Village! Tobin, of the eastern road. Charms, oils, oddments — the ferry is still broken, so I brought the cart here. You wouldn't have anything to eat?", '欢迎来初原村！我叫托宾，跑东边那条路的。护符、灯油、杂货——渡船还没修好，我就把货车搬来了。你身上没带点吃的吧？', { mood: 'surprised', once: true }),
    line('default', "I'd trade the whole cart for a hot meal. Well — not the whole cart. Most of it.", '为了一顿热饭，我愿意拿整车货来换。嗯——也不是整车。大半车吧。'),
    line('default', 'That blue wand? Frost from the tip. Freezes a puddle solid. A river, I would not know — never tried.', '那根蓝魔杖？杖尖冒寒气，能把水洼冻得结结实实。河嘛，我不知道——没试过。'),
    line('default', "Hesper says I owe her a fare. I say the river owes us both. She doesn't laugh.", '赫斯珀说我欠她一趟船钱。我说是河欠我们俩的。她不笑。'),
    line('default', 'Oil, a flask of it. Burns hot and slick. Useful, if you are careful. I am not careful.', '灯油，一瓶。烧得又旺又滑。小心点用很有用。我就不小心。'),
    line('default', 'I sold a frost charm to a man in grey last winter. Paid in old coin — no king on it. Never seen coin like it. Kept one for luck.', '去年冬天我卖了个寒霜护符给一个穿灰衣服的人。他用旧钱币付的——上面没有国王。我从没见过那样的钱。留了一枚图个吉利。'),
    line('fact:ch1.flame_stolen', 'The man in grey? The frost charm! That is how he crossed — oh, Hesper will never forgive me for that one.', '那个灰衣人？寒霜护符！他就是靠那个过的河——哦，赫斯珀永远不会原谅我这件事了。', { mood: 'surprised' }),
    line('hour:evening', "The village fire is warm. Better than sleeping by the hollow at the Ford, with one eye open.", '村里的火暖和。总比睡在渡口洞边、还得睁一只眼强。'),
    line('hour:night', "Shh. Did you hear that? … Probably nothing. Probably.", '嘘。你听见了吗？……大概没什么。大概。', { mood: 'surprised' }),
    line('weather:storm', "Not under the tree! Never under the tree in a storm. My uncle — well. Never mind my uncle.", '别站树底下！打雷的时候千万别站树底下。我叔叔他——算了，别提我叔叔了。', { mood: 'surprised' }),
    line('weather:rain', 'Rain on the charms. They do not like it. Neither do I.', '雨淋到护符了。它们不喜欢，我也不喜欢。'),
    line('fact:ford.charm', 'Go on, take the wand off the cart. A deal is a deal, and that bread was a very good deal.', '去吧，把魔杖从车上拿走。说好的就是说好的，那块面包可太划算了。', { once: true, mood: 'happy' }),
    line('fact:ford.winch', 'The line is mended? Then Hesper will take you — and maybe me, if I promise to pay. Again.', '渡绳接上了？那赫斯珀会送你过去——说不定也送我，只要我再保证一次会付钱。', { once: true }),
    line('fact:ford.tree', "You felled the dead tree! Across the river! I'll be telling that one in every inn from here to the coast.", '你把枯树砍倒了！横在河上！这件事我要从这儿一路讲到海边的每家客栈。', { once: true, mood: 'happy' }),
    line('topic:theft', "I saw that. I'm a peddler — I always see that.", '我看见了。我是货郎——这种事我总能看见。', { mood: 'angry' }),
    line('given:item/food', 'Oh — oh, thank you. Two days. Two whole days.', '哦——哦，谢谢你。两天了。整整两天。', { mood: 'happy' }),
    line('given', "For me? I'll find a buyer for it somewhere. I always do.", '给我的？我总能给它找到买主。一向如此。'),
  ],
}
