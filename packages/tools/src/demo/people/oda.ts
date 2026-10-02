// Oda, the merchant of Oda's Goods: prices in every sentence, a haggle with Hollis that is
// really how they say good morning, ore for Brann on stonedays. Nobody knows her past; her
// lines hint (far cities, a road, dice she gave up, a name she no longer uses) and never tell.
// She wants profit — and, quietly, company.

import { line, type PersonDef } from '../person.ts'

export const oda: PersonDef = {
  id: 'npc.oda',
  role: 'merchant',
  name: { en: 'Oda', zh: '奥妲' },
  look: 'Noble',
  age: 55,
  temperament: { personality: 'sly', manner: 'polite', social: 'outgoing', outlook: 'wary' },
  ties: { 'npc.hollis': 'haggling rival', 'npc.brann': 'ore customer' },
  birthday: { season: 'thaw', day: 3 },
  tastes: {
    love: ['item/food/wine', 'item/document/map', 'item/valuable/goblet'],
    like: ['item/material/gold_ore', 'item/material/salt', 'item/material/cloth', 'item/misc/soap', 'item/light/lantern'],
    dislike: ['item/material/wheat', 'item/food/apple', 'item/food/berries'],
    hate: ['item/misc/dice'],
  },
  schedules: {
    default: [
      [22, 7, 'oda.bed', 'sleep'],
      [7, 8, 'oda.table', 'breakfast and the ledger'],
      [8, 9, 'shop.shelves', 'stocking the shelves'],
      [9, 12, 'shop.counter', 'minding the shop'],
      [12, 13, 'oda.stall', 'lunch at the stall'],
      [13, 18, 'shop.counter', 'minding the shop'],
      [18, 19, 'square.bench', 'evening air'],
      [19, 21, 'oda.table', 'supper and the ledger'],
      [21, 22, 'shop.shelves', 'counting stock'],
    ],
    // Rainy evenings at the inn: an empty shop is a poor place to listen to rain.
    rain: [
      [22, 7, 'oda.bed', 'sleep'],
      [7, 8, 'oda.table', 'breakfast and the ledger'],
      [8, 9, 'shop.shelves', 'stocking the shelves'],
      [9, 12, 'shop.counter', 'minding the shop'],
      [12, 13, 'oda.table', 'lunch'],
      [13, 18, 'shop.counter', 'minding the shop'],
      [18, 22, 'inn.table3', 'sitting out the rain at the inn'],
    ],
    // Closed until one; a walk up to the lookout; Hearth Night.
    'weekday:hearthday': [
      [22, 8, 'oda.bed', 'sleeping in'],
      [8, 10, 'oda.table', 'a slow breakfast'],
      [10, 12, 'rise.lookout', 'looking down the north road'],
      [12, 13, 'oda.table', 'lunch'],
      [13, 18, 'shop.counter', 'minding the shop'],
      [18, 22, 'inn.table3', 'Hearth Night'],
    ],
    // Market day: the stall all day.
    'weekday:seedday': [
      [22, 6, 'oda.bed', 'sleep'],
      [6, 7, 'oda.table', 'breakfast and the ledger'],
      [7, 9, 'oda.stall', 'setting up the stall'],
      [9, 12, 'oda.stall', 'market day'],
      [12, 13, 'shop.counter', 'counting the morning'],
      [13, 17, 'oda.stall', 'market day'],
      [17, 18, 'shop.shelves', 'packing up'],
      [18, 19, 'square.bench', 'evening air'],
      [19, 22, 'oda.table', 'counting the takings'],
    ],
    // Ore to Brann's yard before opening.
    'weekday:stoneday': [
      [22, 7, 'oda.bed', 'sleep'],
      [7, 8, 'oda.table', 'breakfast and the ledger'],
      [8, 9, 'smithy.yard', 'delivering ore to Brann'],
      [9, 12, 'shop.counter', 'minding the shop'],
      [12, 13, 'oda.stall', 'lunch at the stall'],
      [13, 18, 'shop.counter', 'minding the shop'],
      [18, 19, 'square.bench', 'evening air'],
      [19, 21, 'oda.table', 'supper and the ledger'],
      [21, 22, 'shop.shelves', 'counting stock'],
    ],
    // Windday evenings at the inn, for the company (she says: for the wine).
    'weekday:windday': [
      [22, 7, 'oda.bed', 'sleep'],
      [7, 8, 'oda.table', 'breakfast and the ledger'],
      [8, 9, 'shop.shelves', 'stocking the shelves'],
      [9, 12, 'shop.counter', 'minding the shop'],
      [12, 13, 'oda.stall', 'lunch at the stall'],
      [13, 18, 'shop.counter', 'minding the shop'],
      [18, 19, 'oda.table', 'supper'],
      [19, 22, 'inn.table3', 'a glass of wine at the inn'],
    ],
  },
  lines: [
    // ---------------------------------------------------------------- greetings
    line('greeting:first', 'A new customer! Welcome, welcome. Everything here has a price, and today, for you, the price is a little lower. Tomorrow it goes back up.', '新客人！欢迎欢迎。我这儿样样都有价，今天给你算便宜些。明天就涨回去。', { once: true, mood: 'happy' }),

    line('greeting:stranger', "Looking or buying? Looking's free. For now.", '看看还是买？看是免费的。暂时。'),
    line('greeting:stranger', "You've a farmer's hands and a traveller's boots. Interesting combination.", '你长着一双农夫的手，脚上却是旅人的靴子。有意思的搭配。'),
    line('greeting:stranger', "Welcome to Oda's Goods. If I don't have it, you don't need it.", '欢迎光临奥妲杂货。我这儿没有的，你也用不着。'),

    line('greeting:acquaintance', "Ah, my favourite new customer. You're my only new customer, but still.", '啊，我最喜欢的新客人。虽说你也是唯一的新客人。'),
    line('greeting:acquaintance', 'Back again? Either my prices are good or your memory is bad.', '又来了？要么是我价格公道，要么是你记性不好。'),
    line('greeting:acquaintance', 'A secret, since you keep coming back: Hollis always pays. He just likes to suffer first.', '看你常来，告诉你个秘密：霍利斯最后总会掏钱。他只是喜欢先受点罪。'),

    line('greeting:friend', "There you are. I set something aside for you. No, you can't see it yet. Anticipation is half the price.", '你来了。我给你留了样东西。不，现在还不能看。期待也是价钱的一半。'),
    line('greeting:friend', "Come in, come in. The kettle's on, and tea is free for friends. Don't tell the others.", '进来进来。水开了，朋友喝茶不要钱。别跟别人说。'),
    line('greeting:friend', "I've stopped adding the newcomer's surcharge, you know. Don't ask me when.", '说起来，我已经不收你的“新人附加费”了。别问是从什么时候开始的。'),

    line('greeting:close', 'You. Good. The shop is quieter than it looks, some days.', '是你啊。好。有些日子，店里比看上去冷清。'),
    line('greeting:close', "Sit with me a while. I'll pretend I'm doing the ledger.", '陪我坐会儿。我假装在对账。'),
    line('greeting:close', "I'd give you a discount, but you'd think less of me. So: full price, and my company free.", '我是想给你打折，可那样你会看轻我。所以照原价，陪聊免费。'),

    // ---------------------------------------------------------------- hours
    line('hour:morning', "Stock first, then shutters. Lamp oil to the front. It's all anyone wants since the Hearth went dark.", '先上货，后开窗板。灯油摆前头。大炉火一灭，人人都只要这个。'),
    line('hour:morning', 'Morning ledger. Brann owes me for ore, Hollis owes me an argument. Both will pay.', '早上对账。布兰欠我矿石钱，霍利斯欠我一场嘴仗。两个都跑不了。'),
    line('hour:day', 'Thread, two coppers. Candles, three. Advice, free, and worth exactly that.', '线，两个铜板。蜡烛，三个。忠告免费，也就值这个价。'),
    line('hour:day', 'Business is slow with the Hearth out. People hold their coin tighter in the dark.', '大炉火灭了，生意就慢。天一黑，大家攥钱攥得更紧。'),
    line('hour:evening', 'Shop is shut. I sit out on the bench of an evening. For the air. Only the air.', '店关了。傍晚我去长凳上坐坐。透透气。只是透气。'),
    line('hour:evening', "Forty candles. Thirty-nine. Either someone's stealing candles or I can't count. I can count.", '四十根蜡烛。三十九根。要么有人偷蜡烛，要么我不会数数。我会数数。'),
    line('hour:night', "We're closed. Unless it's an emergency. Is it a profitable emergency?", '打烊了。除非有急事。是能赚钱的急事吗？'),
    line('hour:night', "Can't sleep. I never could, somewhere this quiet. Too many years of... well. Goodnight.", '睡不着。在这么安静的地方，我一直睡不着。那么多年都是……算了。晚安。'),

    // Heart-gated: Hollis and Brann, then the road behind her, then what she wants.
    line('hour:morning', "Hollis brings turnips on seedday and I tell him they're small. They're not small. It's simply how we say good morning.", '霍利斯每到种日就挑萝卜来，我说太小。其实不小。这是我们俩说早安的方式。', { hearts: 2 }),
    line('hour:morning', "Brann pays for ore in coin and silence. The silence I don't charge for. He's had a hard few years.", '布兰买矿石，付的是钱和沉默。沉默我不收费。他这几年不好过。', { hearts: 2 }),
    line('hour:day', "I've sold silk in cities you've never heard of. Now I sell nails in a valley that's never heard of me. I prefer the nails.", '我在你没听过的城里卖过丝绸。如今在一个没人听过我的山谷里卖钉子。我更喜欢钉子。', { hearts: 4 }),
    line('hour:day', "People ask where I'm from. I tell them: the road. It's true. Mostly.", '大家问我打哪儿来。我说：路上。这是实话。大体上。', { hearts: 4 }),
    line('hour:morning', "I used to win at dice. Every night, for years. Then one night I didn't. That's the whole story, and you're not getting more.", '以前我掷骰子总赢。每晚都赢，赢了好多年。后来有一晚输了。故事就这么多，别想再听。', { hearts: 6, mood: 'sad' }),
    line('hour:morning', 'I came here because it was the end of the road. I stayed because Hollis argued with me on my first day. Nobody had bothered to argue with me in years.', '我来这儿，是因为这儿是路的尽头。留下来，是因为第一天霍利斯就跟我吵了一架。好多年没人费心跟我吵了。', { hearts: 6 }),
    line('hour:evening', 'I go to Hearth Night for the gossip. So I tell myself. The gossip is dreadful. I go anyway.', '我去炉火之夜是为了听八卦。我是这么跟自己说的。八卦烂透了，我还是去。', { hearts: 6 }),
    line('hour:evening', 'From the bench you can see every lit window on the square. I count them. Like stock.', '从长凳上看得见广场上每一扇亮着的窗。我一扇扇数着，跟盘货似的。', { hearts: 6, mood: 'sad' }),
    line('hour:day', "There's a name I don't use any more. If anyone ever comes up the road asking for it, you've never met me. Yes?", '我有个名字，已经不用了。要是哪天有人上山来打听这个名字，你就说没见过我。好吗？', { hearts: 8 }),
    line('hour:day', "Profit is a fine thing. But I've counted coin alone in a great many rooms. This one has you in it, sometimes. That's worth more. Don't repeat it.", '赚钱是好事。可我在很多屋子里独自数过钱。这间屋子，有时候有你在。这比钱值。别往外说。', { hearts: 8 }),

    // ---------------------------------------------------------------- weather
    line('weather:rain', "Rain! Umbrellas, four coppers. I don't sell umbrellas. But I'm thinking about it.", '下雨了！雨伞，四个铜板。我不卖雨伞。不过我在考虑。'),
    line('weather:storm', 'Storm. Shutters down, candles up. Prices too. Supply and demand, dear.', '暴风雨。窗板放下，蜡烛点上。价钱也上。供需嘛，亲爱的。'),
    line('weather:fog', "Fog. On the road, fog meant bandits or bargains. Here it just means fog. I'm still getting used to that.", '起雾了。在路上，雾不是意味着劫匪，就是意味着好买卖。在这儿，雾就只是雾。我还在适应。'),
    line('weather:sun', 'Sunshine brings browsers. Browsers become buyers, with a little help.', '大太阳引来闲逛的人。稍加帮忙，闲逛的就成了买主。'),
    line('weather:cloud', 'Grey. Good for selling lamps, bad for selling hats.', '阴天。好卖灯，不好卖帽子。'),

    // ---------------------------------------------------------------- weekdays
    line('weekday:seedday', "Market day! Everything's on the stall, and everything's negotiable. Except the things that aren't.", '赶集日！样样摆上摊，样样都好商量。不好商量的除外。', { mood: 'happy' }),
    line('weekday:seedday', "Hollis will be along soon to tell me his turnips are worth twice what they are. I'll say half. We'll both be wrong at a fair price.", '霍利斯一会儿就来，说他的萝卜值双倍价。我说只值一半。最后我们俩会在一个公道价上一起错。'),
    line('weekday:stoneday', 'Stoneday. Ore for Brann. He weighs it twice and thanks me once. A good customer.', '石日。给布兰送矿石。他称两遍，谢一遍。好主顾。'),
    line('weekday:hearthday', 'Hearthday. Closed till one. Even I rest. Briefly, and at a loss.', '炉日。下午一点才开门。连我都歇。歇一会儿，还是亏本歇。'),

    // ---------------------------------------------------------------- places
    line('place:hearthvale.inn', "Lio's ale is fair value. Don't tell him I said so; he'll raise the price.", '里奥的麦酒物有所值。别告诉他是我说的，他会涨价。'),
    line('place:hearthvale.inn', "Look at them all. I could sell every one of them a lantern tonight. I won't. It's Hearth Night.", '瞧瞧这一屋子人。今晚我能给每个人卖一盏灯。我不卖。今天是炉火之夜。'),
    line('place:hearthvale.shop', 'Mind the shelves. They are arranged by profit, not by sense.', '当心货架。是按利润摆的，不是按道理摆的。'),

    // ---------------------------------------------------------------- the first week
    line('date:thaw_2', "The Hearth's out and the candles are already selling. I'm not proud of that. I'm not giving them away, either.", '大炉火一灭，蜡烛就开始好卖了。这不光彩。可我也不会白送。'),
    line('date:thaw_7', "Your first Hearth Night. Sit near the door: it's warmer by the fire, but the gossip is better in the draught.", '你头一回过炉火之夜。坐门边吧：火边暖和，可门缝边的八卦更好听。'),

    // Her birthday is thaw 3, the day of Hollis's slimes.
    line('birthday', "My birthday? Who told you? ... Never mind. I'll put it on your account, as a kindness.", '我生日？谁告诉你的？……算了。这份心意我记在你账上。', { mood: 'surprised' }),
    line('birthday', "Another year. In my trade one never says how many. I suppose I'm not only in trade any more.", '又一岁。干我这行的，从来不说是几岁。看来我现在不只是个做买卖的了。', { mood: 'shy' }),

    // ---------------------------------------------------------------- topics
    line('topic:hearth_out', "The Hearth's out. Everyone's frightened, and frightened people buy candles. I've ordered more candles. I'm also frightened.", '大炉火灭了。人人都怕，怕了就买蜡烛。我多订了蜡烛。我也怕。'),
    line('topic:hay_burned', "Hollis's hay, burned? Hm. Tell him I'll hold his seed prices. Don't tell him it was me.", '霍利斯的干草烧了？嗯。告诉他，种子我不涨价。别说是我说的。'),
    line('topic:slimes_driven', 'Hollis came in smiling. Smiling! I nearly charged him for it.', '霍利斯笑着进门了。笑着！我差点为这个收他钱。', { mood: 'surprised' }),
    line('topic:king_defeated', "The Hollow's King, gone! Slime jelly will be cheap for weeks. Terrible for business. Well done.", '洞里的王死了！史莱姆胶要便宜好几个礼拜。对生意糟透了。干得漂亮。'),
    line('topic:bridge_fixed', "The east bridge, rebuilt. Carts again. I could kiss whoever did it. I won't. But I could.", '东桥重修好了。车又能走了。我真想亲修桥的人一口。我不会。但我想。', { mood: 'happy' }),
    line('topic:road_cleared', 'The north road is open. Traders at last. Competition. Lovely.', '北路通了。商队终于要来了。竞争对手。好极了。'),
    line('topic:road_cleared:memory_week', 'A week of travellers. I look at every face that comes up the north road. Habit. Only habit.', '来往的旅人一个礼拜了。北路上来的每张脸我都要看一看。习惯而已。只是习惯。'),
    line('topic:hearth_lit', "It's lit. I've shut the shop. Free cider at the stall. No, really. Don't make me say it twice.", '点着了。我关店了。摊上苹果酒免费。真的。别让我说第二遍。', { mood: 'happy' }),

    // ---------------------------------------------------------------- gifts
    line('gift:loved', "Oh, now that is quality. {item}. You've an eye. Don't let anyone tell you otherwise.", '哎呀，这才叫好货。{item}。你有眼光。别让人跟你说没有。', { mood: 'happy' }),
    line('gift:liked', "Fair value. Better than fair, actually. I'm touched. Briefly.", '物有所值。说实话，还超值。我很感动。暂时的。'),
    line('gift:neutral', "{item}. Resale value... modest. The thought, however, I'll keep.", '{item}。转手价嘛……一般。心意我收下了。'),
    line('gift:disliked', "{item}? I'd have to pay someone to take this.", '{item}？这东西我得倒贴钱才送得出去。'),
    line('gift:hated', "Take it away. I'm not superstitious. I'm careful.", '拿走。我不迷信，只是小心。', { mood: 'angry' }),
    line('gift:item:item/misc/dice', 'Dice. No. No, thank you. I gave those up, along with a few other things.', '骰子。不。不了，谢谢。我把这个戒了，连同别的几样东西。', { mood: 'sad' }),
    line('gift:item:item/document/map', 'A map! Let me see. ... Oh. I know this road. I know it too well.', '地图！让我瞧瞧。……哦。这条路我认得。认得太清楚了。', { mood: 'surprised' }),
    line('gift:item:item/material/wheat', 'Wheat. Did Hollis put you up to this? Tell him the answer is still no.', '麦子。是霍利斯让你来的吧？告诉他，答案还是不。'),

    // ---------------------------------------------------------------- default
    line('default', 'Everything has a price. The trick is knowing yours before somebody else does.', '样样都有价。诀窍是赶在别人之前，弄清楚你自己的价。'),
    line('default', "I'm not cheap. I'm precise.", '我不是抠门，我是精确。'),
  ],
}
