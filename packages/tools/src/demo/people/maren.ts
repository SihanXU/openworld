// Maren, the elder: keeps the Great Hearth, teaches Mira. Short, dry sentences; more warmth
// than she lets on. Fifty years ago she was to marry Fenn at the Hearth; he went to the coast
// for one season and came back after three. She forgave him long ago and never said so — the
// heart events resolve it; her lines only let it show, a little more at each heart level.

import { line, type PersonDef } from '../person.ts'

export const maren: PersonDef = {
  id: 'npc.maren',
  role: 'elder',
  name: { en: 'Maren', zh: '玛伦' },
  look: 'OldWoman',
  age: 74,
  temperament: { personality: 'steady', manner: 'plain', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.mira': 'apprentice', 'npc.fenn': 'former betrothed' },
  birthday: { season: 'thaw', day: 24 },
  tastes: {
    love: ['item/material/fireweed', 'item/light/candle', 'item/food/fish/cooked'],
    like: ['item/food/bread', 'item/material/wool', 'item/food/apple', 'item/material/herb', 'item/vessel/cup'],
    dislike: ['item/misc/firework', 'item/food/ale', 'item/misc/dice'],
    hate: ['item/misc/bomb', 'item/misc/mirror'],
  },
  schedules: {
    default: [
      [21, 6, 'maren.bed', 'sleep'],
      [6, 7, 'elder.hearth', 'raking the ashes'],
      [7, 8, 'elder.table', 'breakfast'],
      [8, 11, 'square.hearth', 'sitting with the cold Hearth'],
      [11, 12, 'elder.garden', 'weeding'],
      [12, 13, 'elder.table', 'lunch'],
      [13, 14, 'maren.chair', 'a nap she denies'],
      [14, 16, 'square.board', 'village business'],
      [16, 18, 'square.bench', 'watching the square'],
      [18, 19, 'elder.table', 'supper'],
      [19, 21, 'maren.chair', 'mending by the fire'],
    ],
    // Rain keeps her in, but the evening goes to the inn: an old house and a wet night (and a
    // rainy hearthday must still be Hearth Night).
    rain: [
      [22, 6, 'maren.bed', 'sleep'],
      [6, 7, 'elder.hearth', 'raking the ashes'],
      [7, 8, 'elder.table', 'breakfast'],
      [8, 11, 'elder.shelf', 'reading the old records'],
      [11, 12, 'square.hearth', 'checking the Hearth in the rain'],
      [12, 13, 'elder.table', 'lunch'],
      [13, 14, 'maren.chair', 'a nap she denies'],
      [14, 17, 'maren.chair', 'mending'],
      [17, 18, 'elder.table', 'tea with Mira'],
      [18, 22, 'inn.corner', 'sitting out the rain at the inn'],
    ],
    'weekday:hearthday': [
      [22, 6, 'maren.bed', 'sleep'],
      [6, 7, 'elder.hearth', 'raking the ashes'],
      [7, 8, 'elder.table', 'breakfast'],
      [8, 12, 'square.hearth', 'sitting with the cold Hearth'],
      [12, 13, 'elder.table', 'lunch'],
      [13, 15, 'maren.chair', 'a nap she denies'],
      [15, 17, 'elder.garden', 'weeding'],
      [17, 18, 'elder.table', 'tea'],
      [18, 22, 'inn.corner', 'Hearth Night'],
    ],
    // Riverdays she walks the pond path — while Fenn sits at Hollis's fence.
    'weekday:riverday': [
      [21, 6, 'maren.bed', 'sleep'],
      [6, 7, 'elder.hearth', 'raking the ashes'],
      [7, 8, 'elder.table', 'breakfast'],
      [8, 11, 'square.hearth', 'sitting with the cold Hearth'],
      [11, 12, 'elder.garden', 'weeding'],
      [12, 13, 'elder.table', 'lunch'],
      [13, 14, 'maren.chair', 'a nap she denies'],
      [14, 15, 'square.board', 'village business'],
      [15, 16, 'pond.shore', 'a walk for her knees'],
      [16, 18, 'square.bench', 'watching the square'],
      [18, 19, 'elder.table', 'supper'],
      [19, 21, 'maren.chair', 'mending by the fire'],
    ],
    'weekday:stoneday': [
      [21, 6, 'maren.bed', 'sleep'],
      [6, 7, 'elder.hearth', 'raking the ashes'],
      [7, 8, 'elder.table', 'breakfast'],
      [8, 11, 'square.hearth', 'sitting with the cold Hearth'],
      [11, 12, 'elder.garden', 'weeding'],
      [12, 13, 'elder.table', 'lunch'],
      [13, 14, 'maren.chair', 'a nap she denies'],
      [14, 16, 'rise.shrine', 'tending the shrine'],
      [16, 17, 'rise.graveyard', 'visiting the old keepers'],
      [17, 18, 'square.bench', 'watching the square'],
      [18, 19, 'elder.table', 'supper'],
      [19, 21, 'maren.chair', 'mending by the fire'],
    ],
    // The morning after the arrival she shows the newcomer the homestead.
    'date:thaw_2': [
      [21, 6, 'maren.bed', 'sleep'],
      [6, 7, 'elder.hearth', 'raking the ashes'],
      [7, 8, 'elder.table', 'breakfast'],
      [8, 10, 'homestead.gate', 'showing the newcomer the homestead'],
      [10, 12, 'square.hearth', 'sitting with the cold Hearth'],
      [12, 13, 'elder.table', 'lunch'],
      [13, 14, 'maren.chair', 'a nap she denies'],
      [14, 16, 'square.board', 'village business'],
      [16, 18, 'square.bench', 'watching the square'],
      [18, 19, 'elder.table', 'supper'],
      [19, 21, 'maren.chair', 'mending by the fire'],
    ],
  },
  lines: [
    // ---------------------------------------------------------------- greetings
    line('greeting:first', "So. You're the one who took the west homestead. The roof leaks on the left. Sleep on the right.", '就是你接了西边那块地。屋顶左边漏雨，睡右边。', { once: true }),

    line('greeting:stranger', "Newcomer. Walk with your eyes open. That's all the advice I give for free.", '新来的。走路把眼睛睁开。免费的忠告就这一句。'),
    line('greeting:stranger', 'Mm. Still here. Good.', '嗯。还没走。好。'),
    line('greeting:stranger', "The valley's quiet without the Hearth. Don't mistake it for peace.", '大炉火一灭，谷里就静了。别把这当成太平。'),

    line('greeting:acquaintance', 'Ah. The homestead one. Eating properly?', '哦，西边那家的。饭有好好吃吗？'),
    line('greeting:acquaintance', "You've been talking to people. I can tell. They talk back, about you.", '你在跟大家来往，我看得出来。大家也在聊你。'),
    line('greeting:acquaintance', "Sit, if you like. The bench doesn't charge. Unlike Oda.", '想坐就坐。长凳不收钱。奥妲可不一样。'),

    line('greeting:friend', 'There you are. I was about to send Mira looking.', '你来了。我正要叫米拉去找你。'),
    line('greeting:friend', "You've a way of turning up when the kettle's on. I've stopped minding.", '你总是赶在烧水的时候来。我已经不介意了。'),
    line('greeting:friend', 'Good. Someone with sense. Sit.', '好。来了个明白人。坐。'),

    line('greeting:close', "Neighbour. I'm glad it was you who came up that road.", '邻居。那天走上那条路的是你，我很庆幸。', { mood: 'happy' }),
    line('greeting:close', 'You look tired. So do I. Sit with an old woman a minute.', '你看着累了。我也是。陪老太婆坐一会儿。'),
    line('greeting:close', "I've told you more this month than I've told anyone in ten years. Don't let it go to your head.", '这一个月我跟你说的话，比十年里跟谁说的都多。别因此得意。'),

    // ---------------------------------------------------------------- hours
    line('hour:morning', "Up with the light. The Hearth was always roaring by now. Habit doesn't know it's out.", '天一亮就起。往常这个时辰，大炉火早就旺了。习惯可不知道它已经灭了。'),
    line('hour:morning', "Mira's been at the Threadbook since before the birds. I keep telling her: ink keeps.", '米拉天没亮就伏在织线簿上了。我一直跟她说：墨水又跑不了。'),
    line('hour:day', "Village business. Someone's goat, someone's fence, someone's feelings.", '村里的事。谁家的羊，谁家的篱笆，谁家的心思。'),
    line('hour:day', "I don't nap at one. Mira says I do. Mira is mistaken.", '我一点钟才不打盹。米拉说我打。米拉看错了。'),
    line('hour:evening', "Supper, then the mending. An elder's life is mostly socks.", '吃过晚饭就补东西。当长老，大半辈子在补袜子。'),
    line('hour:evening', 'Go home before dark. The west road has no lamps yet.', '天黑前回家。往西那条路还没点灯。'),
    line('hour:night', "It's late. Old women are allowed to be awake. You aren't.", '这么晚了。老太婆睡不着是常理，你可不是。'),
    line('hour:night', "Can't sleep either? I listen for the Hearth. Silly. It never made a sound.", '你也睡不着？我总在听大炉火的动静。傻吧，它从来就没出过声。'),

    // Heart-gated: Mira, the Hearth, and Fenn — a little more at each level, never the whole of it.
    line('hour:morning', "Fenn's line was in the water before my kettle boiled. Some things don't change.", '我的水还没烧开，芬的钓线就下水了。有些事一辈子也不变。', { hearts: 2 }),
    line('hour:morning', "Mira thinks I don't see her copying my old notes. I left them out for her.", '米拉以为我没看见她在抄我的旧笔记。是我故意摆在那儿的。', { hearts: 2 }),
    line('hour:day', "We were to be married at the Hearth, Fenn and I. A long time ago. Don't make that face.", '我和芬，本来是要在大炉火前成亲的。很久以前的事了。别做那副表情。', { hearts: 4 }),
    line('hour:day', 'Hollis asks me after Sera. Sera asks me after Hollis. Neither of them asks the other.', '霍利斯来问我塞拉好不好，塞拉来问我霍利斯好不好。两个人就是不问对方。', { hearts: 4 }),
    line('hour:morning', 'He went down to the coast for one season, after the herring. He came back after three. By then I had learned to keep a fire alone.', '他说去海边跟一季鲱鱼船，就一季。三年后才回来。那时候，我已经学会一个人守火了。', { hearts: 6, mood: 'sad' }),
    line('hour:morning', "I'd like to see it lit once more. That's all I ask. After that I'll be very good about dying.", '我只想再看它燃一次。就这一个心愿。之后要走，我绝不磨蹭。', { hearts: 6 }),
    line('hour:evening', 'There is a wooden fish on my shelf. He carved it the winter we were promised. I dust it myself.', '我架子上有条木头鱼。我们定亲那年冬天他刻的。我自己掸灰，不让别人碰。', { hearts: 6 }),
    line('hour:evening', "At Hearth Night he sits by the fire and I sit in the corner. Fifty years, the same seats. You'd think one of us would move.", '炉火之夜里，他坐火边，我坐角落。五十年了，位子都没换过。你说，总该有一个人挪一挪吧。', { hearts: 6 }),
    line('hour:day', 'I stopped being angry with him forty years ago. I never told him. He never asked. That is two stubborn people for you.', '四十年前我就不生他的气了。我没告诉他，他也没问。两个犟脾气，就是这样。', { hearts: 8, mood: 'sad' }),
    line('hour:day', "Mira will keep the Hearth after me. She'll keep it better. Don't you dare tell her I said so.", '我走以后，大炉火归米拉守。她会守得比我好。你敢跟她说是我说的试试。', { hearts: 8 }),

    // ---------------------------------------------------------------- weather
    line('weather:rain', "My knees knew about this rain two days ago. Nobody asks my knees.", '这场雨我膝盖两天前就知道了。可没人问我的膝盖。'),
    line('weather:storm', "A night like this, we'd all crowd round the Hearth and tell lies till morning. Now we listen to the roof.", '以前遇上这种雷雨，全村都挤在大炉火边上，胡吹到天亮。如今只能听屋顶响了。', { mood: 'sad' }),
    line('weather:fog', 'In fog the Hearth used to be the one thing you could find. Now it is just more grey.', '以前起雾，整个谷里只找得着大炉火的光。现在它也灰成一片了。'),
    line('weather:sun', "Sun. Open the windows, air the bedding. The valley's been holding its breath.", '出太阳了。开窗，晒被子。这山谷憋了好些天了。'),
    line('weather:cloud', 'Grey and undecided. Like Hollis on market day.', '灰蒙蒙的，拿不定主意。跟霍利斯赶集一个样。'),

    // ---------------------------------------------------------------- weekdays
    line('weekday:hearthday', "Hearth Night. We gather at the inn now. Lio's fire is not the Hearth, but it's warm and it's ours.", '今晚是炉火之夜。如今大家都去旅店聚。里奥的炉子不是大炉火，可它是暖的，也是咱们自己的。'),
    line('weekday:hearthday', 'Wash your face before tonight. Everyone will be looking at the newcomer. I would.', '晚上之前把脸洗干净。大家都会盯着新来的看。换我也会。'),
    line('weekday:riverday', "Riverday. I take the long way round the pond. It's for my knees.", '河日。我绕池塘那条远路走。为了膝盖。'),
    line('weekday:riverday', "Yes, I walk the pond path on riverdays. Yes, I know who sits at Hollis's fence then. Leave it.", '对，河日我走池塘那条路。对，我知道那个时候谁在霍利斯的篱笆边坐着。别问了。', { hearts: 6 }),
    line('weekday:stoneday', 'Stoneday. I tend the shrine on the rise. The old keepers are buried up there. They like the company.', '石日。我上坡去打理神龛。老守火人都葬在那儿。他们喜欢有人来。'),

    // ---------------------------------------------------------------- places
    line('place:hearthvale.inn', 'Every soul in the valley under one roof. The Hearth would be pleased.', '整个山谷的人都在一个屋檐下。大炉火要是看见了，也会高兴。', { mood: 'happy' }),
    line('place:hearthvale.inn', "Tamsin's stew, Lio's ale, Fenn's lies. Hearth Night as it should be.", '塔姆辛的炖菜，里奥的麦酒，芬的牛皮。炉火之夜就该是这样。'),
    line('place:hearthvale.elder', "Wipe your feet. Mira's papers are everywhere, and she knows where each one is.", '擦擦脚。米拉的纸到处都是，她每张都知道放在哪。'),

    // ---------------------------------------------------------------- the first week
    line('date:thaw_1', "Not the welcome I'd planned. Come. Your cottage is this way, and the dark won't wait for us.", '这可不是我准备好的接风。来吧，你的屋子在这边，天黑可不等人。', { mood: 'sad' }),
    line('date:thaw_2', "The Hearth went out the night you came. Folk will talk. Let them; it isn't your doing.", '你来的当晚大炉火就灭了。大家会嚼舌头。随他们说，这不怪你。'),
    line('date:thaw_2', "The weeds have had that homestead six years. They won't give it up politely.", '杂草占了那块地六年，可不会客客气气地让出来。'),
    line('date:thaw_7', 'Sit. I have something to tell you about the Hearth, and the four things it needs.', '坐。关于大炉火，我有话要跟你说——它需要四样东西。'),

    line('birthday', "Seventy-five. I'd tell you not to make a fuss, but Mira's already made one.", '七十五了。本想叫你们别张罗，可米拉已经张罗上了。', { mood: 'happy' }),

    // ---------------------------------------------------------------- topics
    line('topic:hearth_out', "Two hundred winters, and it goes out on an ordinary night with no wind. I've kept it fifty years. I don't know why.", '两百个冬天，偏偏在一个没风的平常夜里灭了。我守了它五十年，却不知道为什么。', { mood: 'sad' }),
    line('topic:hearth_out:memory_week', 'A week without the Hearth. I still hold my hands out to it when I pass.', '大炉火灭了一个礼拜了。路过的时候，我还是会伸手去烤。', { mood: 'sad' }),
    line('topic:hay_burned', "Hollis's hay. All of it? ... Is he hurt? Then it's only hay. Tell him I said so. Gently.", '霍利斯的干草？全烧了？……人没事吧？没事就只是干草。替我这么跟他说。说软一点。'),
    line('topic:slimes_driven', "Hollis came by himself to say the slimes are gone. He has never come by to say anything good. Well done.", '霍利斯亲自跑来说史莱姆赶走了。他从没上门报过喜。干得好。'),
    line('topic:first_thread', "Mira came down the stairs at a run this morning. She hasn't run since she was fourteen. Whatever you did, it's in her book now.", '今早米拉是跑着下楼的。她十四岁以后就没跑过。不管你做了什么，现在都写进她的簿子里了。'),
    line('topic:mill_turning', "Hear that? The wheel. One of four. Don't stop now.", '听见没？水车。四样有了一样。别停。'),
    line('topic:bridge_fixed', 'I used to watch the road from that bridge, once. A long time ago. ... Good work.', '很久以前，我常站在那座桥上望着路。……干得好。'),
    line('topic:hearth_lit', "Look at it. Look at it. ... I'm not crying. It's the smoke. Two hundred winters, and one more.", '你看。你看它……我没哭，是烟熏的。两百个冬天，又多一个。', { mood: 'happy' }),

    // ---------------------------------------------------------------- gifts
    line('gift:loved', "{item}. ... You've been asking about me. Who told you? Never mind. Thank you.", '{item}……你打听过我了。谁告诉你的？算了。谢谢你。', { mood: 'happy' }),
    line('gift:liked', "That's thoughtful. I'll use it, which is the best I can say of anything.", '有心了。我会用上它——这是我对一样东西最高的夸奖。'),
    line('gift:neutral', '{item}. Well. Thank you.', '{item}。嗯，谢谢。'),
    line('gift:disliked', 'At my age, what would I do with {item}?', '我这把年纪，要{item}做什么？'),
    line('gift:hated', "Take it back, before I say something an elder shouldn't.", '拿回去，趁我还没说出长老不该说的话。', { mood: 'angry' }),
    line('gift:item:item/food/fish/cooked', 'Cooked through, skin crisp. Someone taught me to like it this way. A long time ago.', '熟透了，皮也焦脆。很久以前，有人教会我这样吃鱼。', { mood: 'shy' }),
    line('gift:item:item/material/fireweed', "Fireweed. We laid it in the Hearth on the first night of thaw. You couldn't have known that. Could you?", '火草。以前融雪季头一夜，我们会把它放进大炉火。你不可能知道这个吧？还是你知道？', { mood: 'happy' }),

    // ---------------------------------------------------------------- default
    line('default', 'My teacher said the Hearth keeps the valley. I begin to think the valley keeps the Hearth.', '我师父说，大炉火守着山谷。我现在倒觉得，是山谷守着大炉火。'),
    line('default', "Say what you came to say. I'm old, not slow.", '有话直说。我是老了，又不是慢了。'),
  ],
}
