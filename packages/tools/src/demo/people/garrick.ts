// Garrick, the guard at the south gate. Earnest, formal, talks in little reports and corrects
// himself mid-sentence. Wants above all to be needed, in a valley where nothing happens. Brann put
// a stick in his hand when he was Pip's age; now Pip follows him. He is sweet on Sera and has never
// said a word of it to her: he opens the gate before she knocks and walks her home forty paces back
// (people/sera.ts notices both).

import { line, type PersonDef } from '../person.ts'

export const garrick: PersonDef = {
  id: 'npc.garrick',
  role: 'guard',
  name: { en: 'Garrick', zh: '加里克' },
  look: 'Samurai',
  age: 33,
  temperament: { personality: 'steady', manner: 'polite', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.brann': 'teacher', 'npc.sera': 'sweet on her (unspoken)', 'npc.pip': 'his shadow' },
  birthday: { season: 'thaw', day: 21 },
  tastes: {
    love: ['item/weapon/polearm/spear', 'item/food/meat/cooked', 'item/armor/shield'],
    like: ['item/food/bread', 'item/food/ale', 'item/light/lantern', 'item/clothing/boots', 'item/food/apple'],
    dislike: ['item/document', 'item/misc/mirror'],
    hate: ['item/misc/bomb'],
  },
  schedules: {
    default: [
      [22, 6, 'garrick.bed', 'sleep'],
      [6, 7, 'garrick.table', 'breakfast'],
      [7, 12, 'gate.south', 'on watch'],
      [12, 13, 'inn.tables', 'lunch'],
      [13, 17, 'gate.tower', 'watching the road'],
      [17, 18, 'square.hearth', 'evening rounds'],
      [18, 19, 'garrick.table', 'supper'],
      [19, 22, 'gate.south', 'closing up the gate'],
    ],
    rain: [
      [22, 6, 'garrick.bed', 'sleep'],
      [6, 7, 'garrick.table', 'breakfast'],
      [7, 12, 'gate.tower', 'on watch under the roof'],
      [12, 13, 'garrick.table', 'lunch, dripping'],
      [13, 18, 'gate.tower', 'watching the road'],
      [18, 19, 'garrick.table', 'supper'],
      [19, 22, 'gate.south', 'night watch'],
    ],
    'weekday:riverday': [
      [22, 6, 'garrick.bed', 'sleep'],
      [6, 7, 'garrick.table', 'breakfast'],
      [7, 12, 'gate.south', 'on watch'],
      [12, 13, 'inn.tables', 'lunch'],
      [13, 17, 'gate.tower', 'watching the road'],
      [17, 18, 'square.hearth', 'evening rounds'],
      [18, 20, 'smithy.yard', 'sparring with Brann'],
      [20, 22, 'gate.south', 'night watch'],
    ],
    'weekday:windday': [
      [22, 6, 'garrick.bed', 'sleep'],
      [6, 7, 'garrick.table', 'breakfast'],
      [7, 12, 'gate.south', 'on watch'],
      [12, 13, 'inn.tables', 'lunch'],
      [13, 17, 'gate.tower', 'watching the road'],
      [17, 18, 'square.hearth', 'evening rounds'],
      [18, 21, 'inn.bar', 'supper at the bar, facing the room'],
      [21, 22, 'gate.south', 'night watch'],
    ],
    'weekday:hearthday': [
      [22, 6, 'garrick.bed', 'sleep'],
      [6, 7, 'garrick.table', 'breakfast'],
      [7, 12, 'gate.south', 'on watch'],
      [12, 13, 'inn.tables', 'lunch'],
      [13, 17, 'gate.tower', 'watching the road'],
      [17, 18, 'square.hearth', 'evening rounds'],
      [18, 21, 'inn.bar', 'Hearth Night, beside Brann'],
      [21, 22, 'gate.south', 'back on watch, the long way round'],
    ],
  },
  lines: [
    line('greeting:first', "Newcomer! Garrick — I keep the south gate. Anything that comes up that road comes past me first. Including you, I suppose. Welcome to Hearthvale.", '新来的！我是加里克——守南门的。从那条路上来的，都得先过我这一关。你也算一个吧。欢迎来到炉谷。', { mood: 'happy', once: true }),

    line('greeting:stranger', "Road's quiet. Valley's quiet. Is there anything you need? Anything at all?", '路上太平，谷里也太平。你有什么需要吗？什么都行。'),
    line('greeting:stranger', "Keep to the paths after dark. It isn't dangerous. I'd just like to know where everyone is.", '天黑以后走大路。倒不是有危险。我就是想知道每个人都在哪儿。'),
    line('greeting:stranger', "If there's trouble, I'm the one to tell. Please do tell me.", '有麻烦就找我。真的，一定要找我。'),
    line('greeting:acquaintance', 'Report: two crows, one cart, no slimes. Busiest morning in a week.', '报告：两只乌鸦，一辆车，没有史莱姆。一礼拜来最忙的一个上午。', { mood: 'happy' }),
    line('greeting:acquaintance', "You again. Good. I mean — good to see you. Not 'good' as in suspicious.", '又是你。好。我是说——见到你挺好。不是“可疑”的那种“好”。', { mood: 'shy' }),
    line('greeting:acquaintance', "Pip's been at the gate since breakfast. If he asks you for a sword, the answer is 'stick'.", '皮普从早饭后就守在门口了。他要是找你要剑，标准答案是：棍子。'),
    line('greeting:friend', 'There you are. I saved you the good spot on the wall — you can see the whole south road from here.', '你来了。墙上那个好位置给你留着呢——从这儿能看见整条南路。'),
    line('greeting:friend', 'If you ever need a hand, I mean it. Lifting, carrying, standing very still in a doorway. I\'m good at all of it.', '要是哪天需要帮手，我是认真的。抬东西，扛东西，往门口一站一动不动。这些我都在行。'),
    line('greeting:friend', "Brann says I talk too much on watch. I say the road doesn't mind.", '布兰说我站岗时话太多。我说，路又不嫌烦。'),
    line('greeting:close', "Good, you're here. Now the valley feels properly guarded. Don't tell Brann I said that.", '好，你来了。这下才觉得整个谷都守住了。别告诉布兰我这么说。', { mood: 'happy' }),
    line('greeting:close', "I can talk to you. I don't know why that's rare, but it is.", '跟你说话很自在。我也说不上为什么，但这样的人不多。'),
    line('greeting:close', "Walk the wall with me? Nothing ever happens. It's nicer when nothing happens with company.", '陪我在墙上走一圈？反正什么事也不会有。有人陪着，什么事也没有就挺好。'),

    line('hour:morning', "Opened the gate at first light. Sera was through before the dew lifted. She always takes the gate road. Not that I — it's my job to notice.", '天一亮我就开了门。露水还没干，塞拉就过去了。她总走大门这条路。不是我——留意这些本来就是我的活儿。', { mood: 'shy' }),
    line('hour:morning', "Pip's on the wall again, saluting the crows. I've made him deputy crow-watcher. He takes it very seriously.", '皮普又爬上墙了，在给乌鸦敬礼。我封了他当副乌鸦看守。他可当回事了。', { mood: 'happy' }),
    line('hour:morning', "I've opened that gate early for Sera three winters running. She's never once had to knock. ...She's never once noticed, either.", '我连着三个冬天都提早给塞拉开门。她一次门都没敲过。……可她也一次都没发现过。', { mood: 'sad', hearts: 4, once: true }),

    line('hour:day', 'From the tower you can see Whisperwood all the way to the lake. Nothing moves in it I don\'t see. Mostly deer.', '从塔楼上能一直望到低语森林里的湖。林子里有点动静我都看得见。多半是鹿。'),
    line('hour:day', 'Lunch at the inn tables, then back up the tower. Same as yesterday. Same as tomorrow, probably.', '在客栈外头吃个午饭，然后回塔楼。跟昨天一样。明天估计也一样。'),
    line('hour:day', "You've been to Sera's? Did she — did she say anything? About anything. ...Never mind. Forget I asked.", '你去过塞拉那儿？她有没有——有没有说什么？随便什么都行。……算了。当我没问。', { mood: 'shy', hearts: 2, once: true }),
    line('hour:day', "Pip asked for a sword. I told him a guard starts with a stick and a straight back. Brann told me the same, when I was his age.", '皮普找我要剑。我跟他说，当卫兵得先从一根棍子、一副挺直的腰板开始。我像他那么大时，布兰也是这么跟我说的。', { hearts: 2, once: true }),

    line('hour:evening', 'Rounds. Square, well, the cold Hearth, back to the gate. I could walk it asleep. Some nights I nearly do.', '巡夜。广场，水井，熄了的大炉火，再回大门。我闭着眼都能走。有几晚差点真闭上了。'),
    line('hour:evening', "I keep an eye on Lio's campfire by the hay. I'd hate to have to put Hollis out. His temper, I mean. Not his hay.", '我盯着里奥那堆篝火呢，就在干草边上。我可不想去给霍利斯灭火。我是说他的火气，不是他的干草。', { mood: 'happy' }),
    line('hour:evening', "I walk Sera home from Hearth Night. Forty paces behind. Guarding, you understand. The woods' edge is very... edge-ish.", '炉火之夜散了，我送塞拉回家。隔着四十步跟在后面。站岗嘛，你懂的。林子边那一带……挺、挺边上的。', { mood: 'shy', hearts: 4, once: true }),
    line('hour:evening', "Brann says courage is doing the thing before you've finished being afraid. He never says what to do if you never finish.", '布兰说，勇气就是趁还没怕完就先去做。他从来没说过，要是一直怕不完该怎么办。', { mood: 'sad', hearts: 6, once: true }),

    line('hour:night', "Gate's barred. Stars are out. Somewhere a slime is thinking about the turnips, and there's nothing I can do about it.", '门闩上了。星星出来了。某个地方，一只史莱姆正惦记着萝卜，我却一点办法也没有。'),
    line('hour:night', "Who goes — oh, it's you. Sorry. Habit. Nobody ever goes, at this hour.", '谁在那儿——哦，是你。抱歉，习惯了。这个点儿，从来就没人来。'),
    line('hour:night', "I bought a ribbon from Oda two summers ago. Blue. It's still in my pocket. ...Don't tell Pip. He'd have told everyone by noon.", '两年前夏天，我在奥妲那儿买了一根缎带。蓝色的。到现在还在我兜里。……别告诉皮普。不到中午全谷都知道了。', { mood: 'shy', hearts: 8, once: true }),

    line('weather:rain', 'Rain on the tower roof sounds like applause. I try not to take it personally.', '雨打在塔楼顶上，跟鼓掌似的。我尽量不往自己身上想。'),
    line('weather:rain', "Wet mail chafes. That's not a complaint. Guards don't complain. It's a report.", '锁子甲淋湿了磨得慌。这不是抱怨。卫兵不抱怨。这是汇报。'),
    line('weather:storm', "Storm. Everyone indoors, please. I'll be on the wall. Someone has to be, and it's me. It's always me. I don't mind.", '暴风雨。大家都进屋吧。我在墙上守着。总得有人守，那就是我。一向是我。我不介意。'),
    line('weather:fog', "Fog. I can't see the road, so I listen to it. You'd be surprised what a road says.", '起雾了。看不见路，我就听路。路会说的话可多了，你肯定想不到。'),
    line('weather:sun', "Clear skies. You can see the snow on Frostfang from the tower. Makes a man stand up straighter.", '大晴天。从塔楼上能看见霜牙山顶的雪。让人不由得站直了。', { mood: 'happy' }),
    line('weather:cloud', 'Grey day. Good for watching — nothing glints, nothing hides.', '阴天。最适合站岗——没东西反光，也没东西藏得住。'),

    line('weekday:riverday', "Riverday. Brann and I spar in his yard after rounds. He'll knock me down. Come and watch — Pip does.", '河日。巡完夜我和布兰在他院子里过招。他会把我撂倒的。来看吧——皮普每回都来。'),
    line('weekday:riverday', "Twenty years Brann's told me I drop my left shoulder. Tonight I won't. Probably.", '布兰说了二十年，说我左肩会往下沉。今晚不会了。大概吧。'),
    line('weekday:windday', "Windday. I eat at the inn on windday. Lots of people do. It's a perfectly normal thing to do.", '风日。我风日都去客栈吃饭。好多人都去。这再正常不过了。', { mood: 'shy' }),
    line('weekday:hearthday', "Hearth Night. Maren says the gate can mind itself for one night a week. I've never agreed, and I've never won.", '炉火之夜。玛伦说大门一个礼拜自己看一晚没关系。我从来不同意，也从来没争赢过。'),
    line('weekday:hearthday', "I'll sit near the corner tonight. For the view. Of the door. It's strategic.", '今晚我坐角落旁边。为了视野。看门的视野。战术需要。', { mood: 'shy' }),

    line('place:hearthvale.inn', "From here I can see the door, the kitchen and the corner. Not that I'm watching the corner.", '从这儿能看见门、厨房，还有那个角落。不是说我在看那个角落。', { mood: 'shy' }),
    line('place:hearthvale.inn', "Pip's asleep on the bench again. I'll carry him up when Tamsin gives the nod.", '皮普又在长凳上睡着了。等塔姆辛点头，我就把他抱上楼。'),
    line('place:hearthvale.inn', "She laughed at something Fenn said tonight. I don't know what. I'd give a week of watches to have said it.", '她今晚被老芬一句话逗笑了。不知道他说了什么。要是那句话是我说的，我愿意多站一个礼拜的岗。', { mood: 'shy', hearts: 6, once: true }),
    line('place:hearthvale.gatehouse', 'Spear, helm, boots, the one chair. Everything here has its place. Visitors get the chair. I\'ve never had to say that before.', '长矛，头盔，靴子，还有唯一那把椅子。这里每样东西都有它的位置。客人坐椅子。我还是头一回说这话。', { mood: 'happy' }),

    line('date:thaw_1', "Follow the Hearth's light up the road; you can't miss it. Two hundred winters and it's never once gone out.", '顺着大炉火的光往上走，错不了。两百个冬天了，它一次都没灭过。', { once: true }),
    line('date:thaw_2', "Maren's sent word: no fires on the square till she says. So now I guard a cold ring of stones. Somebody has to.", '玛伦传话下来：她没发话之前，广场上不许生火。所以现在我守着一圈凉透的石头。总得有人守。', { mood: 'sad' }),
    line('date:thaw_3', "Slimes in Hollis's turnips? I'd go myself, but the gate... Brann has a practice blade. Tell him I said you'd hold it right.", '霍利斯的萝卜地闹史莱姆了？我真想自己去，可大门这儿……布兰那儿有把练习剑。跟他说，是我说你会拿得像模像样的。'),
    line('date:thaw_5', "Sera's sent you into the woods? In this? ...Stay on the path; slimes go slick in the rain. And if she asks, I said hello. No — don't say that.", '塞拉让你进林子？这种天？……别离开小路，下雨天史莱姆滑溜得很。还有，她要是问起，就说我问她好。不——别这么说。', { mood: 'shy' }),

    line('birthday', "My birthday? Who told you? ...Pip. It was Pip. He's made me a badge out of a pot lid.", '我生日？谁告诉你的？……皮普。肯定是皮普。他还用锅盖给我做了枚徽章。', { mood: 'happy' }),
    line('birthday', "Brann gives me the same thing every year: a whetstone and the word 'hm'. Best present there is.", '布兰每年都送我同样的东西：一块磨刀石，外加一声“嗯”。天底下最好的礼物。', { mood: 'happy', hearts: 6, once: true }),

    line('topic:hearth_out', "Two hundred winters, and it goes out on my watch. I know it's not — I know. But it was my watch.", '两百个冬天，偏偏在我站岗的时候灭了。我知道不怪——我知道。可那是我的班。', { mood: 'sad' }),
    line('topic:slimes_driven', "Hollis's turnips are clear? Well done. Next time, call me. Please. I'd have come. I'd have tried to come.", '霍利斯的萝卜地清干净了？干得好。下回叫上我。拜托。我会来的。我会想办法来的。'),
    line('topic:hay_burned', "Fire in the hay, and I was at the wrong end of town. I'll walk that field every night from now on.", '干草着火了，我偏偏在镇子另一头。从今往后，我每晚都去那片地走一圈。', { mood: 'sad' }),
    line('topic:first_thread', "Mira says the valley did something it's never done before. Should I be guarding against it? Nobody ever tells the guard.", '米拉说谷里出了件从没有过的事。我是不是该防着点？从来没人告诉守门的。', { mood: 'surprised' }),
    line('topic:king_defeated', "You went into the Hollow and beat the thing down there? ...I'd have come. You only had to ask. Next time, ask.", '你进了洞窟，把底下那东西打败了？……我会去的。你开口就行。下回记得开口。', { mood: 'surprised' }),
    line('topic:king_defeated:memory_week', "Pip's been playing 'the King of the Hollow' all week. I'm the King. I lose every time. I'm very good at it.", '皮普这一礼拜都在玩“打洞窟大王”。我演大王。每回都输。我输得可专业了。', { mood: 'happy' }),
    line('topic:bridge_fixed', "East bridge is back. Two roads to watch now. I've never been happier to have more work.", '东边的桥修好了。现在有两条路要看了。多了活儿我还从没这么高兴过。', { mood: 'happy' }),
    line('topic:road_cleared', 'North road\'s open. Travellers! Strangers! People I can ask their business!', '北边的路通了。旅人！生面孔！终于有人可以盘问了！', { mood: 'happy' }),
    line('topic:hearth_lit', "It's burning. I stood at the gate and watched the glow come up over the roofs like dawn in the wrong place. All's well. I've waited so long to mean that.", '烧起来了。我站在门口，看着火光从屋顶上漫起来，像是天亮错了方向。一切太平。我等了好久，才能真心说出这句话。', { mood: 'happy' }),
    line('topic:hearth_lit', "I stood next to Sera at the lighting. Not forty paces. Next to.", '点火的时候，我站在塞拉旁边。不是四十步。是旁边。', { mood: 'shy', hearts: 6 }),

    line('gift:loved', "For me? {item}? I — thank you. I'll take good care of it. On my honour.", '给我的？{item}？我——谢谢你。我一定好好爱惜。以我的名誉担保。', { mood: 'happy' }),
    line('gift:liked', "That's kind. Very kind. Noted — I mean, thank you.", '你真好。太好了。记下了——我是说，谢谢。', { mood: 'happy' }),
    line('gift:neutral', "Thank you. I'll put it with my things. I don't have many things.", '谢谢。我把它跟我的东西放一块儿。我的东西不多。'),
    line('gift:disliked', "Ah. {item}. That's... I'll find someone who'd want it. Pip, maybe.", '啊。{item}。这个……我去找个想要它的人。皮普也许要。', { mood: 'sad' }),
    line('gift:hated', "That doesn't come through my gate. Please take it back out.", '这东西不准过我的门。请你拿出去。', { mood: 'angry' }),
    line('gift:item:item/document/book', "A book. Sera reads these. ...Maybe if I read one, I'd have something to say to her. Is it a long one?", '一本书。塞拉看这个。……要是我也看一本，跟她说话说不定就有话可说了。这本长吗？', { mood: 'shy' }),
    line('gift:item:item/material/stick', "A stick. ...You've been talking to Pip.", '一根棍子。……你跟皮普聊过了吧。', { mood: 'happy' }),
    line('gift:item:item/weapon/polearm/spear', "A spear! Feel that balance. Brann would approve. Brann would say 'hm', which is approval.", '一杆长矛！你掂掂这手感。布兰会认可的。布兰会说“嗯”，那就是认可。', { mood: 'happy' }),

    line('default', 'All quiet. I\'ll tell you if that changes. Please tell me if it changes.', '一切太平。有变化我会告诉你。你那边有变化，也请告诉我。'),
    line('default', "A guard's work is mostly standing. I'm very good at standing.", '卫兵这活儿，大半就是站着。我站得可好了。'),
  ],
}
