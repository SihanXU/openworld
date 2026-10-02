// Old Fenn, the fisher: tall tales, fishing talk, a cat called Skipper who has never been on a
// boat. Fifty years ago he was to marry Maren at the Hearth and went to the coast after the
// herring instead — one season that became three. He has lived within sight of her window ever
// since and never said sorry. The letters he wrote her and never sent are in a box under his
// dock. His lines let it out slowly by heart level; the heart events resolve it.

import { line, type PersonDef } from '../person.ts'

export const fenn: PersonDef = {
  id: 'npc.fenn',
  role: 'fisher',
  name: { en: 'Old Fenn', zh: '老芬' },
  look: 'OldMan',
  age: 76,
  temperament: { personality: 'cheerful', manner: 'plain', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.hollis': 'old friend', 'npc.maren': 'former betrothed' },
  birthday: { season: 'thaw', day: 7 },
  tastes: {
    love: ['item/food/ale', 'item/food/pie', 'item/material/feather'],
    like: ['item/food/bread', 'item/tool/rope', 'item/material/wool', 'item/food/meat/cooked', 'item/tool/knife'],
    dislike: ['item/document/letter', 'item/vessel/bucket/water', 'item/misc/soap'],
    hate: ['item/food/fish'],
  },
  schedules: {
    default: [
      [21, 5, 'fenn.bed', 'sleep'],
      [5, 6, 'fenn.stove', 'tea, and breakfast for the cat'],
      [6, 11, 'pond.dock', 'fishing'],
      [11, 12, 'fenn.porch', 'lunch with the cat'],
      [12, 14, 'pond.shore', 'mending nets'],
      [14, 17, 'pond.dock', 'fishing'],
      [17, 19, 'fenn.porch', 'cleaning the catch'],
      [19, 21, 'fenn.stove', 'supper'],
    ],
    // Fish bite in the rain; his roof leaks; the evening goes to the inn's fire.
    rain: [
      [22, 5, 'fenn.bed', 'sleep'],
      [5, 6, 'fenn.stove', 'tea, and breakfast for the cat'],
      [6, 11, 'pond.dock', 'fishing in the rain'],
      [11, 12, 'fenn.stove', 'drying off'],
      [12, 17, 'fenn.stove', 'mending nets indoors'],
      [17, 18, 'fenn.porch', 'cleaning the catch'],
      [18, 22, 'inn.hearth', 'drying out at the inn'],
    ],
    storm: [
      [22, 6, 'fenn.bed', 'sleep'],
      [6, 8, 'fenn.stove', 'listening to the roof'],
      [8, 9, 'pond.dock', 'checking the boat'],
      [9, 17, 'fenn.stove', 'mending nets indoors'],
      [17, 18, 'fenn.porch', 'watching the lightning'],
      [18, 22, 'inn.hearth', 'waiting out the storm at the inn'],
    ],
    'weekday:hearthday': [
      [22, 5, 'fenn.bed', 'sleep'],
      [5, 6, 'fenn.stove', 'tea, and breakfast for the cat'],
      [6, 11, 'pond.dock', 'fishing'],
      [11, 12, 'fenn.porch', 'lunch with the cat'],
      [12, 14, 'pond.shore', 'mending nets'],
      [14, 17, 'pond.dock', 'fishing'],
      [17, 18, 'fenn.porch', 'combing his whiskers'],
      [18, 22, 'inn.hearth', 'tall tales by the fire'],
    ],
    // Some afternoons he sits by Hollis's fields; riverday evenings he tells stories at the bar.
    'weekday:riverday': [
      [21, 5, 'fenn.bed', 'sleep'],
      [5, 6, 'fenn.stove', 'tea, and breakfast for the cat'],
      [6, 11, 'pond.dock', 'fishing'],
      [11, 12, 'fenn.porch', 'lunch with the cat'],
      [12, 14, 'pond.shore', 'mending nets'],
      [14, 17, 'farm.fields', 'sitting by the fence with Hollis'],
      [17, 19, 'fenn.porch', 'cleaning the catch'],
      [19, 21, 'inn.bar', 'telling tall tales'],
    ],
    'weekday:windday': [
      [21, 5, 'fenn.bed', 'sleep'],
      [5, 6, 'fenn.stove', 'tea, and breakfast for the cat'],
      [6, 11, 'pond.dock', 'fishing'],
      [11, 12, 'fenn.porch', 'lunch with the cat'],
      [12, 14, 'pond.shore', 'mending nets'],
      [14, 17, 'farm.fields', 'sitting by the fence with Hollis'],
      [17, 19, 'fenn.porch', 'cleaning the catch'],
      [19, 21, 'fenn.stove', 'supper'],
    ],
  },
  lines: [
    // ---------------------------------------------------------------- greetings
    line('greeting:first', "Ho there! Mind the third plank, she bites. Name's Fenn. Old Fenn, they say, as if there were a young one about.", '嘿，那边的！小心第三块木板，它咬人。我叫芬。大家都叫老芬，好像还有个小芬似的。', { once: true, mood: 'happy' }),

    line('greeting:stranger', "New face on my dock. Fish'll be talking about it for days.", '我的码头上来了张生面孔。鱼儿们得议论好几天了。'),
    line('greeting:stranger', "Careful there, young'un. Pond's deeper than it looks. So am I.", '当心点，年轻人。这池塘比看上去深。我也是。'),
    line('greeting:stranger', "Don't mind the cat. Skipper's never been on a boat, but he's got the rank.", '别管那只猫。船长这辈子没上过船，可官衔是有的。'),

    line('greeting:acquaintance', "Back again! Either you like my company or you're after my good spot.", '又来啦！不是喜欢跟我待着，就是惦记我这块好位置。'),
    line('greeting:acquaintance', "Sit a bit. Fishing's mostly sitting. The fish are just an excuse.", '坐会儿。钓鱼嘛，大半就是坐着，鱼不过是个借口。'),
    line('greeting:acquaintance', 'Ah, the homestead farmer. Got your hands dirty yet? Good. Clean hands catch nothing.', '哦，西边那块地的主人。手弄脏了没？好。干净的手啥也钓不着。'),

    line('greeting:friend', "There's my favourite landlubber!", '这不是我最喜欢的旱鸭子嘛！', { mood: 'happy' }),
    line('greeting:friend', "Pull up a crate. I've a story, and it's mostly true.", '搬个箱子坐。我有个故事，大部分是真的。'),
    line('greeting:friend', "Skipper's taken to you. He doesn't take to anybody. Took him eight years with me.", '船长喜欢上你了。它谁都不喜欢，跟我混熟花了八年。'),

    line('greeting:close', "Ah. You. Good. The day's better with you in it, and I don't say that to the fish.", '哦，是你。好。有你在，这一天就好过些。这话我可没跟鱼说过。', { mood: 'happy' }),
    line('greeting:close', "Sit with an old fool. I'll keep the tall tales short today.", '陪老糊涂坐坐。今天的牛皮我少吹点。'),
    line('greeting:close', "You're the only one I tell the true versions to. Don't spread it about; it'd ruin me.", '真话版本我只讲给你听。别往外传，传出去我就完了。'),

    // ---------------------------------------------------------------- hours
    line('hour:morning', 'Fish bite best at dawn. So do the midges. You take the one with the other.', '天刚亮鱼最爱咬钩，蠓虫也是。有这样就有那样。'),
    line('hour:morning', 'Mist on the water, line in the water, tea in the belly. Morning, sorted.', '水上有雾，水里有线，肚里有茶。这早晨就齐活了。'),
    line('hour:day', "Mending nets. Every hole's a fish that got away, and every one of them was this big.", '补网呢。每个窟窿都是一条溜掉的鱼，条条都有这么大。'),
    line('hour:day', "Some afternoons I sit by Hollis's fence. We don't talk much. Sixty years, we've said it all.", '有些下午我去霍利斯的篱笆边坐着。我俩话不多，六十年了，该说的早说完了。'),
    line('hour:evening', 'Cleaning the catch. Skipper supervises. He takes his wages in heads.', '收拾今天的鱼呢。船长在旁边监工，工钱要鱼头。'),
    line('hour:evening', "Sun's going down orange. That's a good sign for tomorrow, or a bad one. Depends who you ask.", '太阳落得橘红。明天要么是好兆头，要么是坏兆头，看你问谁。'),
    line('hour:night', "Eh? Oh. Can't sleep. Old bones and an old conscience. Both creak.", '嗯？哦，睡不着。老骨头，老良心，都嘎吱响。'),
    line('hour:night', "Go to bed, young'un. The pond'll still be here. So will I, probably.", '睡觉去，年轻人。池塘跑不了。我嘛，大概也跑不了。'),

    // Heart-gated: Hollis and Sera at first, then Maren, the box under the dock, the letters.
    line('hour:morning', "Elder's lamp's lit early again. She never could sleep past the birds. ... What? I've got eyes, haven't I?", '长老家的灯又早早亮了。她从来就睡不过鸟叫。……干嘛？我又不是瞎子。', { hearts: 2 }),
    line('hour:morning', "Hollis won't say her name, but every week he asks after 'the herb woman'. Sixty years I've known him. Terrible liar.", '霍利斯不肯提她的名字，可每个礼拜都要问一句“那个采药的”怎么样。我认识他六十年了，他撒谎的本事烂透了。', { hearts: 2 }),
    line('hour:day', "There's a box under my dock. Don't go digging for it. ... Not yet, anyway.", '我码头底下埋着个箱子。别去挖。……至少现在别。', { hearts: 4 }),
    line('hour:day', "I was to be married once. Big day, at the Hearth, the whole valley asked. Groom never turned up.", '我差点成过一次亲。大日子，就在大炉火前，全谷的人都请了。新郎没到场。', { hearts: 4, mood: 'sad' }),
    line('hour:morning', "Went down to the coast after the herring. One season, I told her. Then one more, then one more. Pride's a long net, young'un. Hard to haul in.", '那年我去海边跟鲱鱼船，跟她说就一季。后来又一季，又一季。年轻人，面子是张长网，收起来难哪。', { hearts: 6, mood: 'sad' }),
    line('hour:morning', 'Hollis says she walks the pond path on riverdays. While I am up at his fence. Funny, that. Funny.', '霍利斯说，她每到河日就走池塘那条路。正好是我在他篱笆边的时候。真巧啊。真巧。', { hearts: 6 }),
    line('hour:evening', "I leave a fish on her step some mornings, before it's light. Never knock. Coward's fish, that is.", '有些早上天不亮，我在她门口放一条鱼。从来不敲门。这叫胆小鬼的鱼。', { hearts: 6 }),
    line('hour:evening', "Seventy-odd years, and I still practise what I'd say to her. Skipper's heard it a hundred times. He's not impressed.", '七十好几了，我还在练要跟她说的话。船长听了上百遍，一点也不感动。', { hearts: 6 }),
    line('hour:day', "In that box: letters. One for every week I was gone. Never posted a single one. Couldn't make the words sit right.", '那箱子里是信。我走了多少个礼拜，就写了多少封，一封也没寄出去。字怎么都摆不对地方。', { hearts: 8, mood: 'sad' }),
    line('hour:day', "One last big catch, I tell everyone. It's not a fish I mean. Never was.", '我逢人就说，要钓最后一条大鱼。我说的不是鱼。从来都不是。', { hearts: 8 }),

    // ---------------------------------------------------------------- weather
    line('weather:rain', "Rain's the best bait there is. Fish come up to see what all the fuss is about.", '雨是天下最好的饵。鱼都浮上来看热闹。'),
    line('weather:rain', "My roof leaks in three places. I've named them.", '我屋顶漏三个地方。我都给起了名字。'),
    line('weather:storm', "Lightning on the water. Even I stay off the dock in this, and I've done stupider things than you'll ever hear about.", '雷劈在水面上。这种天连我都不上码头。我干过的蠢事，比你听说过的都多。'),
    line('weather:fog', 'Fog like this, I once hooked something long as a boat. Took my line, my hat and most of my nerve.', '就这种雾，我有回钓上来个跟船一样长的东西。扯走了我的线、我的帽子，还有大半的胆子。'),
    line('weather:fog', "Can't see the far shore. Could be anything over there. Could be the sea.", '看不见对岸了。那边是啥都有可能。说不定是大海。'),
    line('weather:sun', 'Bright sun, sly fish. They can see your shadow. Stand behind me.', '大太阳，鱼都精。它们看得见你的影子。站我后头。'),
    line('weather:cloud', 'Grey sky, grey water, grey whiskers. Perfect fishing.', '灰天，灰水，灰胡子。正好钓鱼。'),

    // ---------------------------------------------------------------- weekdays
    line('weekday:hearthday', "Hearth Night! I've a new tale ready. Mostly new. The fish in it is bigger, anyway.", '今晚炉火之夜！我备好了新故事。基本是新的，至少里头的鱼更大了。', { mood: 'happy' }),
    line('weekday:hearthday', "Elder sits in the corner at Hearth Night. I sit by the fire. Fifty years, never the same table. I could still tell you what she drinks.", '炉火之夜长老坐角落，我坐火边。五十年没同过一张桌子，可她喝什么，我闭着眼都说得出。', { hearts: 6 }),
    line('weekday:riverday', "Riverday. Hollis's fence and a pipe. Best seat in the valley, if you don't mind turnips.", '河日。霍利斯的篱笆，一袋烟。整个山谷最好的座儿，只要你不嫌萝卜。'),

    // ---------------------------------------------------------------- places
    line('place:hearthvale.inn', 'Gather round! This one is true. The fish was this big. No. This big.', '都过来！这个故事是真的。那条鱼有这么大。不对，这么大。', { mood: 'happy' }),
    line('place:hearthvale.inn', "Lio says I've told this one before. He's right. But he's never heard it told this well.", '里奥说这个我讲过了。他说得对。不过他没听我讲得这么好过。'),
    line('place:hearthvale.shack', 'Mind your head. And the nets. And the cat. And the other nets.', '当心脑袋。还有渔网。还有猫。还有另一堆渔网。'),

    // ---------------------------------------------------------------- the first week
    line('date:thaw_2', "So the Hearth's out. Seventy-six years I've seen it burning. Feels like the sky's missing a star.", '大炉火灭了。我七十六年都看着它烧，现在就像天上少了颗星。', { mood: 'sad' }),
    line('date:thaw_4', "Tamsin wants a fish for supper and she sent you? Here, take the old rod. She knows more than you do. Listen to her.", '塔姆辛晚饭要条鱼，派你来弄？给，拿这根老竿子。它比你懂，听它的。'),
    line('date:thaw_4', "Cast where the reeds bend. Wait. Then wait some more. That's the whole secret, and I'll deny it later.", '往芦苇弯的地方抛。等着。然后再等等。这就是全部诀窍，回头我可不认。'),

    // His birthday is the first Hearth Night.
    line('birthday', 'Seventy-seven! And on Hearth Night, too. The whole valley throws me a party and pretends it is for something else.', '七十七啦！还正赶上炉火之夜。全谷的人给我办宴会，还假装是为了别的事。', { mood: 'happy' }),
    line('birthday', "Another year older and the big one still hasn't bitten. Patience, Fenn. Patience.", '又老一岁，大鱼还是没咬钩。耐心点，芬。耐心点。'),

    // ---------------------------------------------------------------- topics
    line('topic:hearth_out', 'Saw it go out from my porch. Just gone, like a fish slipping the hook. Skipper hid under the bed all night.', '我在门廊上看着它灭的。一下子就没了，像鱼脱了钩。船长在床底下躲了一整夜。', { mood: 'sad' }),
    line('topic:hearth_out:memory_week', "A week without it, and I still look up from the line to check it. Old habit. A lifetime of glancing.", '灭了一个礼拜了，我还老是从钓线上抬头去瞅它。老毛病了，瞅了一辈子。'),
    line('topic:hay_burned', "Hollis's hay, gone? Poor stubborn goat. I'll take him a bottle tonight. He'll pretend not to want it.", '霍利斯的干草？烧光了？可怜的犟老头。我今晚给他拎瓶酒去，他准装作不想要。'),
    line('topic:slimes_driven', 'Hollis says you ran the slimes off his turnips. He said it twice. From him, that is practically a song.', '霍利斯说你把萝卜地的史莱姆赶跑了。他说了两遍。对他来说，这都快算唱歌了。'),
    line('topic:first_thread', "Something odd out your way, they say. Never seen in the valley before. Well! Neither had the fish, the day I invented the double knot.", '听说你那边出了桩怪事，山谷里从没见过。嘿！我发明双结那天，鱼也没见过。'),
    line('topic:king_defeated', 'The King of Slime Hollow! I fought him once, you know. Or his cousin. Or a big frog. Long story.', '史莱姆洞的王！我跟它打过，你知道吗。也可能是它表哥。也可能是只大青蛙。说来话长。', { mood: 'happy' }),
    line('topic:mill_turning', 'The wheel is turning! Listen to her creak. Sounds like me getting out of bed.', '水车转起来了！听它嘎吱嘎吱的，跟我起床一个声儿。'),
    line('topic:bridge_fixed', "East bridge is back! Water, eh? Of course it was water. It's always water.", '东桥修好啦！靠的是水，嗯？当然是水。从来都是水。'),
    line('topic:hearth_lit', "It's lit. It's lit! ... Have you seen the elder's face? Go and look at her face. I can't. Not yet.", '点着了。点着了！……你看见长老的脸了吗？去看看她的脸。我还不行。还不敢。', { mood: 'happy' }),

    // ---------------------------------------------------------------- gifts
    line('gift:loved', "Well, I'll be! {item}! You've been talking to someone who knows me.", '哎哟！{item}！你准是跟懂我的人打听过了。', { mood: 'happy' }),
    line('gift:liked', "Now that's a kind thing. Skipper, look. No, you can't have it.", '这可真贴心。船长，你瞧。不，不给你。'),
    line('gift:neutral', "{item}, eh? I'll find a use. I'm good at finding uses.", '{item}啊？我会找到用处的。我最会找用处了。'),
    line('gift:disliked', "Hm. {item}. I'll... put it somewhere. Somewhere far.", '嗯。{item}。我会……把它放个地方。很远的地方。'),
    line('gift:hated', 'Take that back to wherever it lived.', '从哪儿来的就送回哪儿去吧。', { mood: 'angry' }),
    line('gift:item:item/food/fish', 'I have fish. I live on fish. I am, at this point, mostly fish.', '我有鱼。我靠鱼活着。到这份上，我基本上就是条鱼了。', { mood: 'surprised' }),
    line('gift:item:item/document/letter', 'A letter? I... never was much good with letters. Reading them. Sending them, worse.', '信？我……从来就不擅长这个。读信不行，寄信更不行。', { mood: 'sad' }),
    line('gift:item:item/material/feather', "A feather! That'll tie a fly the fish will write home about.", '羽毛！能扎个假饵，鱼见了都得写信回家。', { mood: 'happy' }),

    // ---------------------------------------------------------------- default
    line('default', "Life's like fishing. You wait and you wait, and then it all happens at once and you're in the water.", '人生就跟钓鱼一样。等啊等，然后突然一下全来了，你人已经在水里了。'),
    line('default', "Old Brass is still down there. Biggest carp in the valley, scales like a copper kettle. One day.", '老铜鳞还在底下呢。全谷最大的鲤鱼，鳞片跟铜壶似的。总有一天。'),
  ],
  items: ['item/tool/fishing_rod', 'item/food/fish/raw'],
}
