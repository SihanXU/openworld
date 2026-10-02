// Mira, Maren's apprentice: keeps the Threadbook, where each new thread of the weave appears.
// Precise, curious, ink on everything; came up the valley at fourteen. Wren trails her. She
// wants to understand why the weave learns — and, under it, fears the day the Hearth is hers.

import { line, type PersonDef } from '../person.ts'

export const mira: PersonDef = {
  id: 'npc.mira',
  role: 'mage',
  name: { en: 'Mira', zh: '米拉' },
  look: 'SorcererOrange',
  age: 22,
  temperament: { personality: 'bookish', manner: 'polite', social: 'reserved', outlook: 'hopeful' },
  ties: { 'npc.maren': 'teacher', 'npc.wren': 'little shadow' },
  birthday: { season: 'thaw', day: 9 },
  tastes: {
    love: ['item/document/book', 'item/misc/ink', 'item/misc/feather_quill'],
    like: ['item/document/scroll', 'item/document/map', 'item/light/candle', 'item/material/frostcap', 'item/potion/mystery'],
    dislike: ['item/food/ale', 'item/misc/firework', 'item/weapon/blade'],
    hate: ['item/vessel/bucket/water', 'item/misc/snowball'],
  },
  schedules: {
    default: [
      [22, 6, 'mira.bed', 'sleep'],
      [6, 7, 'elder.table', 'breakfast with Maren'],
      [7, 10, 'mira.desk', 'copying into the Threadbook'],
      [10, 12, 'square.hearth', 'sketching the cold Hearth'],
      [12, 13, 'elder.table', 'lunch'],
      [13, 15, 'pond.shore', 'taking notes by the water'],
      [15, 17, 'square.board', 'reading the notices'],
      [17, 18, 'elder.garden', 'helping in the garden'],
      [18, 19, 'elder.table', 'supper'],
      [19, 22, 'mira.desk', 'writing by candlelight'],
    ],
    // Indoors with the books; the evening at the inn with Maren (and so Hearth Night holds in rain).
    rain: [
      [22, 6, 'mira.bed', 'sleep'],
      [6, 7, 'elder.table', 'breakfast with Maren'],
      [7, 12, 'mira.desk', 'copying into the Threadbook'],
      [12, 13, 'elder.table', 'lunch'],
      [13, 15, 'elder.shelf', 'sorting old books'],
      [15, 16, 'square.hearth', 'checking the Hearth in the rain'],
      [16, 18, 'mira.desk', 'writing'],
      [18, 22, 'inn.table2', 'an evening at the inn'],
    ],
    'weekday:hearthday': [
      [22, 6, 'mira.bed', 'sleep'],
      [6, 7, 'elder.table', 'breakfast with Maren'],
      [7, 10, 'mira.desk', 'copying into the Threadbook'],
      [10, 12, 'square.hearth', 'sketching the cold Hearth'],
      [12, 13, 'elder.table', 'lunch'],
      [13, 15, 'elder.shelf', 'reading'],
      [15, 17, 'square.board', 'reading the notices'],
      [17, 18, 'elder.garden', 'helping in the garden'],
      [18, 22, 'inn.table2', 'Hearth Night'],
    ],
    'weekday:ashday': [
      [22, 6, 'mira.bed', 'sleep'],
      [6, 7, 'elder.table', 'breakfast with Maren'],
      [7, 9, 'mira.desk', 'copying into the Threadbook'],
      [9, 12, 'rise.shrine', 'reading the shrine stones'],
      [12, 13, 'elder.table', 'lunch'],
      [13, 15, 'pond.shore', 'taking notes by the water'],
      [15, 17, 'square.board', 'reading the notices'],
      [17, 18, 'elder.garden', 'helping in the garden'],
      [18, 19, 'elder.table', 'supper'],
      [19, 22, 'mira.desk', 'writing by candlelight'],
    ],
    // Windday afternoons at the lake in Whisperwood, where Wren may not follow.
    'weekday:windday': [
      [22, 6, 'mira.bed', 'sleep'],
      [6, 7, 'elder.table', 'breakfast with Maren'],
      [7, 10, 'mira.desk', 'copying into the Threadbook'],
      [10, 12, 'square.hearth', 'sketching the cold Hearth'],
      [12, 13, 'elder.table', 'lunch'],
      [13, 16, 'wood.lake', 'notes at the lake'],
      [16, 17, 'square.board', 'reading the notices'],
      [17, 18, 'elder.garden', 'helping in the garden'],
      [18, 19, 'elder.table', 'supper'],
      [19, 22, 'mira.desk', 'writing by candlelight'],
    ],
    // The day she shows the newcomer the Threadbook, she stays at her desk.
    'date:thaw_6': [
      [22, 6, 'mira.bed', 'sleep'],
      [6, 7, 'elder.table', 'breakfast with Maren'],
      [7, 12, 'mira.desk', 'waiting to show the Threadbook'],
      [12, 13, 'elder.table', 'lunch'],
      [13, 17, 'mira.desk', 'the Threadbook'],
      [17, 18, 'elder.garden', 'helping in the garden'],
      [18, 19, 'elder.table', 'supper'],
      [19, 22, 'mira.desk', 'writing by candlelight'],
    ],
  },
  lines: [
    // ---------------------------------------------------------------- greetings
    line('greeting:first', "Oh. You're the one who arrived the night it went out. I'm Mira. I'd like to ask you some questions. Not now. Soon. I'll write them down first.", '啊。你就是大炉火熄灭那晚到的人。我是米拉。我想问你几个问题。不是现在，过几天。我先把问题写下来。', { once: true, mood: 'surprised' }),

    line('greeting:stranger', "Hello. Sorry, I'm in the middle of a sentence. In my head, I mean.", '你好。抱歉，我正想到一半。我是说，脑子里那句。'),
    line('greeting:stranger', 'Maren says I am to be welcoming. Welcome. ... Was that all right?', '玛伦说我得热情点。欢迎。……这样算可以吗？', { mood: 'shy' }),
    line('greeting:stranger', "Mind the ink. It's on everything, including me.", '小心墨水。什么都沾上了，包括我。'),

    line('greeting:acquaintance', "Good timing. I've just had a thought and no one to say it to.", '来得正好。我刚冒出个想法，正愁没人说。'),
    line('greeting:acquaintance', "If you see Wren, I'm not here. She's lovely. I just need one hour to finish a page.", '要是看见雷恩，就说我不在。她很可爱，我只是需要一个钟头写完这一页。'),
    line('greeting:acquaintance', "Hello again. You have mud on your sleeve. Farmer's mud, specifically.", '又见面了。你袖子上有泥。确切地说，是种地的泥。'),

    line('greeting:friend', "There you are. I've saved you the good chair. Well, the less bad one.", '你来了。我给你留了好椅子。好吧，是没那么差的那把。'),
    line('greeting:friend', "I told Maren you'd come by today. I'm right about most things, eventually.", '我跟玛伦说你今天会来。大多数事情，我最后都会说对。'),
    line('greeting:friend', 'Sit. Tell me one thing you noticed today. Anything. I collect them.', '坐。跟我说件你今天留意到的事，什么都行。我在收集。'),

    line('greeting:close', "I'm glad it's you. I don't say that often. I'm saying it now, so it's on record.", '还好是你。这话我不常说。现在说了，记录在案。', { mood: 'happy' }),
    line('greeting:close', "You never ask me to explain. You just ask the next question. I like that.", '你从不让我解释，只是接着问下一个问题。我喜欢这样。'),
    line('greeting:close', 'I wrote your name in the margin of the Threadbook. Only in pencil. Maren says that is allowed.', '我在织线簿的页边写了你的名字。只用了铅笔。玛伦说这样不算违规。', { mood: 'shy' }),

    // ---------------------------------------------------------------- hours
    line('hour:morning', "Morning is for copying. My hand's steadiest before anyone has said anything to me.", '早上用来誊写。在谁都还没跟我说话之前，我的手最稳。'),
    line('hour:morning', "I sketch the cold Hearth every morning. The stones don't change. I keep checking.", '我每天早上都画一遍熄了的大炉火。石头没变。可我还是一直在看。'),
    line('hour:day', "I'm testing the water. Literally. It's colder by the reeds and I don't know why yet. 'Yet' is my favourite word.", '我在测水。字面意思。芦苇边的水更凉，原因我还不知道。“还”是我最喜欢的字。'),
    line('hour:day', "Wren is behind that barrel. She thinks I don't know. Hello, Wren.", '雷恩躲在那个木桶后面。她以为我不知道。你好呀，雷恩。', { mood: 'happy' }),
    line('hour:evening', 'Supper with Maren, then the desk. She reads, I write, and the candle does most of the work.', '跟玛伦吃完晚饭就去书桌。她看书，我写字，蜡烛干了大部分活。'),
    line('hour:evening', "Wren asked me today if the weave can be tickled. I wrote it down. I can't prove it can't.", '雷恩今天问我，经纬能不能被挠痒痒。我记下来了。我也证明不了不能。'),
    line('hour:night', "I should be asleep. The page wouldn't let me. I know that's not how pages work.", '我该睡了。可这一页不放我走。我知道，纸不会这样的。'),
    line('hour:night', "Shh. Maren's asleep. She snores like a kettle and denies it like a queen.", '嘘，玛伦睡了。她打呼像烧开的水壶，不承认的样子像女王。', { mood: 'happy' }),

    // Heart-gated: her teacher, the wooden fish, Fenn's fish on the step, the Hearth that will be hers.
    line('hour:morning', 'Maren pretends she teaches me nothing at breakfast. Then she says one sentence, and I write for an hour.', '玛伦吃早饭时装作什么都没教我。然后她说一句话，我就得写上一个钟头。', { hearts: 2 }),
    line('hour:morning', "Wren copied my handwriting so well I nearly signed something she wrote. I'm proud. I've also locked the drawer.", '雷恩仿我的字仿得太像，我差点在她写的东西上签了名。我很骄傲。我也给抽屉上了锁。', { hearts: 2 }),
    line('hour:day', "Maren dusts one thing on her shelf herself. A little wooden fish. She won't let me near it, and she won't say why.", '玛伦架子上有一样东西只肯自己掸灰——一条小木鱼。不让我碰，也不说为什么。', { hearts: 4 }),
    line('hour:day', 'Everyone thinks the Threadbook is about the weave. It is also about people. Who tried what, and why. Mostly why.', '大家以为织线簿记的是经纬。其实也记人：谁试了什么，为什么。主要是为什么。', { hearts: 4 }),
    line('hour:morning', "Old Fenn leaves a fish on our step some mornings, before light. Maren cooks it and says nothing. I've stopped asking.", '有些早上天没亮，老芬会在我们门口放一条鱼。玛伦把它煎了，一句话也不说。我已经不问了。', { hearts: 6 }),
    line('hour:morning', "Maren is tired. She hides it from the village. She doesn't hide it from the stairs.", '玛伦累了。她在村里人面前藏着，在楼梯面前藏不住。', { hearts: 6, mood: 'sad' }),
    line('hour:evening', 'Why does the weave learn? I have asked it a hundred ways. I think it learns because someone asked. That frightens me a little. The good kind.', '经纬为什么会学？我换了一百种问法。我想，它学，是因为有人问了。这让我有点害怕。是好的那种害怕。', { hearts: 6 }),
    line('hour:evening', 'I came up the valley road at fourteen with one bag and a great many opinions. Maren took the bag. She let me keep the opinions.', '我十四岁那年拎着一个包、带着一肚子主意走进山谷。玛伦接过了包，主意让我留着。', { hearts: 6, mood: 'happy' }),
    line('hour:day', "When she's gone, the Hearth will be mine to keep. I'm not ready. I don't think anyone ever is. Maybe that's the point.", '等她走了，大炉火就归我守了。我还没准备好。我想谁都不会准备好。也许这就是意义所在。', { hearts: 8, mood: 'sad' }),
    line('hour:day', "I'm not afraid of the weave. I'm afraid of being the one who explains it wrong. Maren never explains it at all. Maybe she's the wise one.", '我不怕经纬。我怕的是自己把它讲错。玛伦从来不讲，也许她才是明白人。', { hearts: 8 }),

    // ---------------------------------------------------------------- weather
    line('weather:rain', 'Rain on the window, ink on the page. Ideal conditions.', '雨打窗户，墨落纸面。理想状态。'),
    line('weather:storm', "Every thunderclap, I count. Six seconds. Five. It's coming closer. I'm staying in.", '每声雷我都数着。六秒。五秒。它越来越近了。我不出门了。'),
    line('weather:fog', "In fog the valley loses its edges. There should be a word for that. I'll make one.", '起雾的时候，山谷没了边。该有个词来形容。我自己造一个。'),
    line('weather:sun', 'Sun. Wren will want to go out. Wren will want me to go out. I will go out.', '出太阳了。雷恩会想出去。雷恩会想让我出去。我会出去的。', { mood: 'happy' }),
    line('weather:cloud', 'Cloud. Even light. Good for drawing, bad for moods.', '阴天。光线匀。适合画画，不适合心情。'),

    // ---------------------------------------------------------------- weekdays
    line('weekday:hearthday', 'Hearth Night. I bring the Threadbook and people ask what is new. Mostly they ask Wren, who tells them louder.', '炉火之夜。我会带上织线簿，大家问有什么新鲜的。其实他们多半是问雷恩，她嗓门比我大。'),
    line('weekday:hearthday', "I'm not good at Hearth Night. Too many conversations at once. I sit where I can see Maren and listen sideways.", '我不太会过炉火之夜。一下子太多人说话了。我坐在看得见玛伦的地方，侧着耳朵听。'),
    line('weekday:ashday', 'Ashday. I read the old stones at the shrine. Someone carved threads there long before the book. Badly spelled.', '灰日。我去神龛读那些老石头。早在这本簿子之前，就有人把线刻在上面了。错字不少。'),
    line('weekday:windday', "Windday. The lake in Whisperwood. Wren isn't allowed past the gate, which is the only reason I get any notes done.", '风日。去低语森林的湖边。雷恩不准出大门，这是我还能记点笔记的唯一原因。'),

    // ---------------------------------------------------------------- places
    line('place:hearthvale.inn', "Wren has told everyone I can make fire with my hands. I can't. I can make tea.", '雷恩跟所有人说我能徒手生火。我不能。我能泡茶。'),
    line('place:hearthvale.inn', "Tamsin keeps a cup aside for me. I've never asked. It's always the one without a chip.", '塔姆辛总给我留一只杯子。我从没开口要过，总是那只没缺口的。'),
    line('place:hearthvale.elder', "Please don't touch the desk. Not because it's secret. Because it's in an order.", '请别碰书桌。不是因为有秘密，是因为它有顺序。'),
    line('place:whisperwood', 'The trees here lean toward the lake, not the sun. I have measured. Nobody believes me.', '这里的树朝湖长，不朝太阳长。我量过了。没人信我。'),

    // ---------------------------------------------------------------- the first week
    line('date:thaw_2', 'The Hearth went out at a quarter past the hour. I wrote it down. Then I sat on the stairs for a long time.', '大炉火是在整点过一刻灭的。我记下来了。然后在楼梯上坐了很久。', { mood: 'sad' }),
    line('date:thaw_6', "Come and see. There's a new line in the Threadbook, and I think it's yours. I didn't write it. That's the point.", '来看看。织线簿里多了一行，我想是你的。不是我写的。这才是重点。', { mood: 'surprised' }),
    line('date:thaw_6', "Try something the valley has never seen. Then come and tell me. I'll be here. I'm always here.", '去试一件山谷从没见过的事。然后回来告诉我。我就在这儿。我一直在这儿。'),

    line('birthday', 'You remembered? Maren always does, but she pretends it is an accident. Twenty-three.', '你记得？玛伦每年都记得，可总装作是碰巧。二十三了。', { mood: 'happy' }),
    line('birthday', "Wren made me a crown out of paper. I'm wearing it. Don't.", '雷恩用纸给我做了顶王冠。我戴着呢。别笑。', { mood: 'shy' }),

    // ---------------------------------------------------------------- topics
    line('topic:hearth_out', "I've written down everything I remember about the moment it went out. Four pages. None of them explains it.", '大炉火熄灭那一刻我记得的一切，我都写下来了。四页纸，没一页说得清。', { mood: 'sad' }),
    line('topic:first_thread', 'A new thread! Overnight, in the book, in a hand that is not mine. Tell me exactly what you did. Exactly.', '新的线！一夜之间出现在簿子里，不是我的字迹。告诉我你到底做了什么。一点一点地说。', { mood: 'surprised' }),
    line('topic:first_thread:memory_week', "It's been a week since your first thread. I've read it eleven times. It still surprises me. Isn't that strange?", '你的第一根线出现快一个礼拜了。我读了十一遍，还是会被它惊到。奇怪吧？'),
    line('topic:hay_burned', "Hollis's hay burned. I went to look. I'm sorry. I always go to look. It's a fault.", '霍利斯的干草烧了。我去看了。抱歉。我总忍不住去看。这是个毛病。'),
    line('topic:king_defeated', 'The King of the Hollow is gone. Wren wants every detail. I want every detail. We are sharing a notebook.', '洞里的王没了。雷恩想知道所有细节。我也想。我们俩共用一个本子。', { mood: 'happy' }),
    line('topic:mill_turning', "The wheel turns, and the valley feels tighter, somehow. Like a thread pulled straight. I'm writing that down before it sounds silly.", '水车转了。山谷好像绷紧了一点，像一根被拉直的线。我得趁它听起来还不傻之前记下来。'),
    line('topic:bridge_fixed', 'The bridge. Two kindlings. I counted the days. Maren counted them too and pretended not to.', '桥修好了。两样火种了。我数着日子，玛伦也在数，只是装作没数。'),
    line('topic:hearth_lit', "It's lit. Maren put her hand on my shoulder and said nothing. She didn't need to. I'm going to cry now, in private.", '点着了。玛伦把手搭在我肩上，什么也没说。不用说。我要去哭一会儿了，背着人。', { mood: 'happy' }),

    // ---------------------------------------------------------------- gifts
    line('gift:loved', "{item}! Oh. I'll use it carefully. Too carefully. I'll probably never use it at all.", '{item}！哦……我会小心用的。太小心了，大概会一直舍不得用。', { mood: 'happy' }),
    line('gift:liked', "That's useful. And kind. Those don't often come in the same parcel.", '这东西有用，又是一份心意。这两样很少装在同一个包里。'),
    line('gift:neutral', "Thank you. I'll find out what it's for.", '谢谢。我会弄清楚它是干什么用的。'),
    line('gift:disliked', "Ah. {item}. I'll put it on the other side of the room from the books.", '啊，{item}。我会把它放在离书最远的那头。'),
    line('gift:hated', 'Please, not near the Threadbook. Not anywhere near it.', '拜托，别靠近织线簿。离得越远越好。', { mood: 'surprised' }),
    line('gift:item:item/document/book', "A book! I'm going to read it tonight and be useless tomorrow. Thank you.", '一本书！我今晚就要读，明天就废了。谢谢你。', { mood: 'happy' }),
    line('gift:item:item/material/frostcap', "Frostcap. Cold to the touch even in the sun. Do you know why? Neither do I. Isn't it wonderful?", '霜菇。晒着太阳摸起来也是凉的。你知道为什么吗？我也不知道。是不是很妙？', { mood: 'happy' }),

    // ---------------------------------------------------------------- default
    line('default', "The weave isn't a wall. It's more like a conversation. I just don't know who's on the other end.", '经纬不是一堵墙，更像一场对话。我只是不知道另一头是谁。'),
    line('default', "Maren says I ask too many questions. I asked her how many would be enough. She didn't answer.", '玛伦说我问题太多。我问她多少才算够。她没回答。'),
  ],
}
