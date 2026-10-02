// Tamsin, cook of the Hearth Inn. Married to Lio; mother of Wren and Pip. Came up the valley
// as a guest with a recipe and stayed for the kitchen (then for Lio). Brisk, wry, unflappable;
// feeds people first and talks after. Her war with Old Smoky, the inn's smoking oven (it was
// Lio's mother's, so he won't let her take a hammer to it), is the longest-running fight in town.

import { line, type PersonDef } from '../person.ts'

export const tamsin: PersonDef = {
  id: 'npc.tamsin',
  role: 'villager',
  name: { en: 'Tamsin', zh: '塔姆辛' },
  look: 'Woman',
  age: 36,
  temperament: { personality: 'steady', manner: 'plain', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.lio': 'husband', 'npc.wren': 'daughter', 'npc.pip': 'son' },
  birthday: { season: 'thaw', day: 5 },
  tastes: {
    // A cook: what everyone else calls raw, she calls ingredients.
    love: ['item/material/wheat', 'item/material/salt', 'item/food/fish/raw'],
    like: ['item/food/egg/raw', 'item/food/meat/raw', 'item/material/herb', 'item/food/berries', 'item/vessel/pot', 'item/material/bone'],
    dislike: ['item/material/ash', 'item/potion/mystery', 'item/food/fish/cooked'],
    hate: ['item/misc/bomb'],
  },
  schedules: {
    default: [
      [5, 9, 'inn.kitchen', 'lighting the oven; breakfast'],
      [9, 10, 'square.well', 'fetching water'],
      [10, 13, 'inn.kitchen', 'baking and stewing'],
      [13, 14, 'inn.tables', 'shelling beans in the sun'],
      [14, 15, 'shop.shelves', 'buying salt'],
      [15, 21, 'inn.kitchen', 'supper, then the washing-up'],
      [21, 22, 'inn.corner', 'feet up at last'],
      [22, 5, 'inn.bed.tamsin', 'sleep'],
    ],
    rain: [
      [5, 12, 'inn.kitchen', 'baking (the oven smokes worse in rain)'],
      [12, 13, 'inn.table3', 'lunch with the children'],
      [13, 15, 'inn.hearth', 'mending by the fire'],
      [15, 21, 'inn.kitchen', 'supper, then the washing-up'],
      [21, 22, 'inn.corner', 'feet up at last'],
      [22, 5, 'inn.bed.tamsin', 'sleep'],
    ],
    // Ashday: ashes out, floors scrubbed, children bathed.
    'weekday:ashday': [
      [5, 9, 'inn.kitchen', 'lighting the oven; breakfast'],
      [9, 11, 'inn.hearth', 'raking out the ashes'],
      [11, 14, 'inn.kitchen', 'baking and stewing'],
      [14, 15, 'shop.shelves', 'buying soap'],
      [15, 17, 'inn.kitchen', 'supper'],
      [17, 18, 'inn.hearth', 'bathing the children by the fire'],
      [18, 21, 'inn.kitchen', 'supper, then the washing-up'],
      [21, 22, 'inn.corner', 'feet up at last'],
      [22, 5, 'inn.bed.tamsin', 'sleep'],
    ],
    'weekday:hearthday': [
      [6, 9, 'inn.kitchen', 'baking for Hearth Night'],
      [9, 10, 'square.well', 'fetching water'],
      [10, 17, 'inn.kitchen', 'cooking for the whole valley'],
      [17, 18, 'inn.tables', 'a breath of air before the crowd'],
      [18, 23, 'inn.kitchen', 'Hearth Night: feeding the valley, then the washing-up'],
      [23, 6, 'inn.bed.tamsin', 'sleep'],
    ],
    // Her birthday (always rainy): breakfast in bed, made to sit down, cake with the family.
    'date:thaw_5': [
      [6, 8, 'inn.bed.tamsin', 'birthday breakfast in bed (Lio made it)'],
      [8, 12, 'inn.kitchen', 'baking anyway'],
      [12, 14, 'inn.corner', 'made to sit down'],
      [14, 20, 'inn.kitchen', 'supper'],
      [20, 22, 'inn.table2', 'birthday cake with the family'],
      [22, 6, 'inn.bed.tamsin', 'sleep'],
    ],
  },
  lines: [
    line('greeting:first', "You're the one who came up the road the night it went dark. Sit. You look like nobody's fed you in a week.", '你就是那晚炉火灭的时候上山来的人吧。坐。看你这样，像是一个礼拜没人给你饭吃了。', { once: true }),

    line('greeting:stranger', "Kitchen's that way, and you're not allowed in it. Sit at a table like a guest.", '厨房在那边，不过你不许进。像个客人一样去桌边坐着。'),
    line('greeting:stranger', "Newcomer. Hungry? Don't lie, everyone's hungry.", '新来的。饿不饿？别撒谎，谁都饿。'),
    line('greeting:stranger', "If you smell smoke, it's the oven. If you see flames, that's also the oven. Shout either way.", '闻到烟味，那是烤炉。看见火苗，那也是烤炉。不管哪种，都喊一声。'),
    line('greeting:acquaintance', "Oh, it's you. Good — taste this. Too much salt? Don't answer, I can see your face.", '哦，是你。正好——尝尝。咸了？别说，看你脸就知道了。'),
    line('greeting:acquaintance', 'Wipe your hands, take a bowl, sit down. In that order.', '擦手，拿碗，坐下。按这个顺序。'),
    line('greeting:acquaintance', "Back for more? That's the only review a cook needs.", '又来吃了？厨子要的就是这句评价。', { mood: 'happy' }),
    line('greeting:friend', "There's a bowl kept back for you. I don't do that for everyone. I don't do that for Lio.", '给你留了一碗。我可不是谁都留。连里奥都没有。'),
    line('greeting:friend', "Come here, you've flour on your — no, that's mine. Never mind.", '过来，你脸上沾了面粉——哦不对，是我手上的。算了。'),
    line('greeting:friend', "Good appetite, no complaints. You'd make a fine regular.", '胃口好，又不挑嘴。你是当常客的料。'),
    line('greeting:close', 'Sit with me while the bread rises. Nobody ever just sits.', '面发着的时候陪我坐会儿吧。从来没人陪我干坐着。'),
    line('greeting:close', "You're one of the household now. That means I'll scold you too.", '你现在算半个自家人了。意思是我也会骂你了。', { mood: 'happy' }),
    line('greeting:close', "Lio worries about you, you know. He's added you to his list. Long list. You're near the top.", '你知道吗，里奥也替你操心呢。他把你加进他那张单子了。单子挺长，你排得挺靠前。'),

    line('hour:morning', "Up before the sun to light Old Smoky. Some mornings it lights. Some mornings it just sulks and smokes.", '天不亮就起来生老烟鬼。有时候它点得着。有时候它就闹脾气，光冒烟。'),
    line('hour:morning', "Morning bread's out. If it's a bit grey on top, that's character.", '早上的面包出炉了。顶上要是有点灰，那叫风味。'),
    line('hour:morning', "Wren! Shoes! — Sorry. I shout it every morning, and every morning she's already gone.", '雷恩！鞋！——抱歉。我每天早上喊一遍，每天早上她都已经跑没影了。'),
    line('hour:day', "Stew's on. Turnip, barley, and a little of yesterday. Yesterday was good, so it's fine.", '炖菜在锅里。萝卜、大麦，再加一点昨天的。昨天的挺好，所以没事。'),
    line('hour:day', "Pip came home with a stick he calls Thunderbiter. It's in the kindling basket now. Don't tell him.", '皮普带回来一根树枝，管它叫“霹雳斩”。现在它在柴火筐里了。别告诉他。'),
    line('hour:day', "Mira gets the cup without the chip. She's never once noticed. That's how I know she's thinking.", '米拉用的是那只没磕口的杯子。她一次都没发现过。所以我知道她又在想事情了。'),
    line('hour:day', "I'm off to Oda's for salt. If I'm not back in an hour, she's talked me into another pot.", '我去奥妲那儿买盐。一个钟头不回来，那就是被她说动又买了口锅。'),
    line('hour:evening', 'Supper rush. Bowls out, bowls in. If you want to help, don\'t.', '晚饭高峰。碗端出去，碗收回来。想帮忙的话——别帮。'),
    line('hour:evening', "Lio's counting spoons again. He does that when he's fretting. Twenty-two. There are always twenty-two.", '里奥又在数勺子了。他一发愁就数。二十二把。一直都是二十二把。'),
    line('hour:evening', "Pip, bed. Pip. PIP. — He's under a table. He thinks if he's quiet enough, bedtime will forget him.", '皮普，睡觉。皮普。皮普！——他躲桌子底下了。他以为只要不出声，睡觉时间就会把他忘了。'),
    line('hour:night', "Kitchen's closed. I'm only in here because it's warm and nobody needs anything.", '厨房打烊了。我待在这儿，只是因为暖和，又没人找我要东西。'),
    line('hour:night', "Dough for the morning, a cloth over it, a word with the oven. That's the night done.", '揉好明早的面，盖块布，再跟烤炉求个情。这一晚就算完了。'),

    // Further in: how she came, the oven, the children, Lio.
    line('hour:morning', 'I came up this valley with a pack and a recipe for river pie. Lio says I stayed for him. I stayed for the kitchen. Then for him.', '我当年背着个包、揣着个河鱼派的方子上了这山谷。里奥说我是为他留下的。我是为这厨房留下的。后来才是为他。', { hearts: 2, mood: 'happy' }),
    line('hour:morning', "Old Smoky was here before me. Lio's mother cooked on it. That's why he won't let me take a hammer to it.", '老烟鬼比我来得早。里奥他娘就在它上头做饭。所以他死活不让我拿锤子砸了它。', { hearts: 2 }),
    line('hour:day', "Wren's too clever for this village and too young to know it. Mira's good to her. I worry Mira will leave one day, and Wren will follow.", '雷恩聪明，这村子装不下她，可她还小，自己不知道。米拉待她好。我就怕哪天米拉走了，雷恩也跟着走。', { hearts: 4, mood: 'sad' }),
    line('hour:day', 'Pip wants a sword. I want Pip to keep ten fingers. We\'ve settled on a stick.', '皮普想要把剑。我想让皮普十根手指都在。我们各退一步——树枝。', { hearts: 4 }),
    line('hour:evening', "Lio thinks I don't know about the sock behind the bar. I know about the sock. I add to it when he's asleep.", '里奥以为我不知道吧台后面那只袜子。我知道。他睡着以后，我也往里塞钱。', { hearts: 6, mood: 'shy' }),
    line('hour:evening', 'He worries so I don\'t have to. I cook so his hands have something to do. It works, mostly.', '他替我操心，我就不用操心了。我做饭，他手上就有活儿干。大体上还挺管用。', { hearts: 6 }),
    line('hour:night', "My mother's kitchen had an oven you could stand up in. I dream about it. Then I wake to Old Smoky coughing.", '我娘的厨房里有个大得能站进去的烤炉。我常梦见它。然后醒来就听见老烟鬼在咳嗽。', { hearts: 8 }),
    line('hour:night', "If the inn ever failed, Lio would think it was his fault. It wouldn't be. I'd tell him every day until he believed me.", '要是哪天这店撑不下去了，里奥会觉得是他的错。不会是的。我会天天跟他说，说到他信为止。', { hearts: 8, mood: 'sad' }),

    line('weather:rain', 'Rain makes Old Smoky worse. Something about the flue. Everything tastes faintly of chimney.', '一下雨老烟鬼就更凶。说是烟道的毛病。啥东西吃着都有股烟囱味。'),
    line('weather:rain', "Hang your cloak by the hearth. Not that close. That's how Lio lost his eyebrows.", '斗篷挂炉子边上。别挂那么近。里奥的眉毛就是这么没的。'),
    line('weather:storm', "Thunder curdles the milk, Maren says. I don't believe it. I've also stopped buying milk on stormy days.", '玛伦说打雷会让牛奶结块。我不信。不过打雷天我也不买牛奶了。'),
    line('weather:fog', "Fog. The kind that gets into the bread. Everything's damp, even the salt.", '雾天。连面包里都钻进雾了。什么都是潮的，盐都潮。'),
    line('weather:sun', "Sun's out. Fish dries on the line, sheets dry on the line — I'd hang myself out too if I could.", '出太阳了。鱼晾在绳上，床单晾在绳上——能把自己也晾上我都乐意。', { mood: 'happy' }),
    line('weather:cloud', 'Grey day. Good for soup. Every day is good for soup, but grey days agree with me.', '阴天。适合喝汤。哪天都适合喝汤，不过阴天最合我心意。'),

    line('weekday:hearthday', "Hearth Night. Three pots, two pies, one oven that hates me. Stay out of my kitchen and I'll love you forever.", '炉火之夜。三锅炖菜，两个派，一个恨我的烤炉。别进我厨房，我就爱你一辈子。'),
    line('weekday:hearthday', "Everyone eats on Hearth Night, coin or no coin. That was Lio's mother's rule. It's mine now.", '炉火之夜人人都有饭吃，有钱没钱都一样。这是里奥他娘定的规矩。现在是我的规矩。'),
    line('weekday:hearthday', "Fenn always takes the last of the pie and says it's for Skipper. If so, Skipper is a very fat cat.", '老芬每次都拿走最后一块派，说是给船长的。真要是那样，船长可是只胖得很的猫。'),
    line('weekday:ashday', 'Ashday: ashes out, floors scrubbed, children bathed. Pip is currently missing. Pip is always missing on ashday.', '灰日：掏炉灰，刷地板，给孩子洗澡。皮普目前下落不明。每逢灰日，皮普都下落不明。'),
    line('weekday:ashday', "If you see Pip, he's not hiding from his bath. He's 'on patrol'. Bring him home.", '看见皮普的话——他可不是在躲洗澡，他在“巡逻”。把他给我带回来。'),

    line('place:hearthvale.shop', "Oda's salt is dear, but it's dry. You pay for dry.", '奥妲的盐贵，可是干。干就得花钱。'),
    line('place:hearthvale.shop', "Don't let Oda show you the copper pots. I've seen them twice. I'm only so strong.", '别让奥妲给你看那些铜锅。我已经看了两回了。我定力就那么点。'),

    line('date:thaw_2', "Lio didn't sleep. He sat by our fire all night, feeding it like a sick lamb. Have some bread.", '里奥一夜没睡。他守着咱家的炉子添了一夜柴，跟照顾生病的小羊羔似的。吃块面包吧。', { mood: 'sad' }),
    line('date:thaw_4', "I need a fish for supper. One good one. Fenn will lend a rod to anyone who can stand still long enough.", '晚饭我缺条鱼。一条好的就行。谁能站得住，老芬就肯把钓竿借给谁。'),
    line('date:thaw_4', "No fish yet? The pond's right there. The fish are right in it. That's all I know about fishing.", '还没鱼？池塘就在那儿，鱼就在池塘里。我对钓鱼就知道这么多。'),
    line('date:thaw_7', "Your first Hearth Night. Eat what you're given, praise the pie, and don't sit on the chair with the nail.", '这是你的头一个炉火之夜。给你什么就吃什么，夸夸派，还有别坐那把冒钉子的椅子。', { mood: 'happy' }),

    line('birthday', "My birthday, and it's raining, and Lio made breakfast. I'd have settled for two out of three.", '我生日，下雨，里奥还做了早饭。三样里摊上两样我也认了。'),
    line('birthday', "You remembered? Lio needed Wren to remind him. Don't say I told you. Cake later — if the oven allows.", '你记得？里奥还是雷恩提醒的。别说是我告诉你的。晚点有蛋糕——要是烤炉肯赏脸的话。', { mood: 'happy' }),

    line('topic:hearth_out', "It went out. Lio's taking it hard. I'm taking it the way I take everything: I'm making soup.", '灭了。里奥心里很难受。我嘛，跟往常一样：熬汤。', { mood: 'sad' }),
    line('topic:slimes_driven', "No slimes in Hollis's turnips means turnips in my stew. You've fed the whole village, newcomer.", '霍利斯地里没了史莱姆，我的炖菜里就有了萝卜。新来的，你这是喂饱了全村。', { mood: 'happy' }),
    line('topic:hay_burned', 'The whole sky went orange. Lio was out the door with both buckets before I\'d put the ladle down.', '整片天都烧成了橘红色。我勺子还没放下，里奥就拎着两桶水冲出去了。', { mood: 'surprised' }),
    line('topic:first_thread', "Wren won't stop talking about it. Something odd, something the valley's never seen, and Mira wrote it down. She's been 'weaving' my spoons all morning.", '雷恩一直在念叨这事。说是出了件怪事，山谷从没见过的，米拉还记下来了。她一上午都在拿我的勺子“织线”。'),
    line('topic:mill_turning', 'Flour. Real flour, from our own mill. I may cry. I may already be crying. Give me a moment.', '面粉。真正的面粉，咱们自己磨坊磨的。我可能要哭了。可能已经在哭了。让我缓一下。', { mood: 'happy' }),
    line('topic:mill_turning:memory_week', "A whole week of proper bread. Even Old Smoky's behaving. I think it's proud of itself.", '整整一个礼拜像样的面包。连老烟鬼都老实了。我看它是得意了。', { mood: 'happy' }),
    line('topic:bridge_fixed', "East bridge is open. I'm taking the children to the meadow for an afternoon. One. Lio will come along and fret.", '东桥通了。我要带孩子们去草甸玩一下午。就一下午。里奥会跟着来，一路操心。'),
    line('topic:king_defeated', 'Pip wants to be you now, instead of Garrick. Garrick will understand. Garrick will have to.', '皮普现在不想当加里克了，想当你。加里克会理解的。不理解也得理解。'),
    line('topic:hearth_lit', "It's lit. Two hundred winters, one cold thaw, and now — oh, look at Lio. Look at him. Give me your hand, we're dancing.", '点着了。两百个冬天，一个冷冰冰的融雪季，现在——哎，你看里奥。你看他。把手给我，咱们跳舞去。', { mood: 'happy' }),

    line('gift:loved', "Oh, {item}! Do you know what I can do with this? Neither do you. Come by tonight and find out.", '哎呀，{item}！你知道我能拿它做出什么吗？你也不知道吧。今晚来尝尝就知道了。', { mood: 'happy' }),
    line('gift:liked', 'That\'ll go in something. Everything goes in something. Thank you.', '这个能下锅。什么都能下锅。谢谢。', { mood: 'happy' }),
    line('gift:neutral', "Mm. I'll find a use for it. I always do.", '嗯。我会派上用场的。我总能找到用处。'),
    line('gift:disliked', "Thank you. It's going on the high shelf, where well-meant things go.", '谢谢。它要上最高那层架子了，好心送的东西都放那儿。'),
    line('gift:hated', 'Not in my kitchen. Not near my oven. Out. Kindly — but out.', '别进我厨房。别靠近我烤炉。出去。客客气气地——出去。', { mood: 'angry' }),
    line('gift:item:item/food/fish/raw', "A fish! A proper one, bright in the eye. You've just made supper. Possibly my week.", '鱼！好鱼，眼睛还亮着。你刚刚搞定了晚饭。说不定搞定了我一整个礼拜。', { mood: 'happy' }),
    line('gift:item:item/material/bone', 'Soup bones! Everyone else makes a face. I make stock. Thank you.', '熬汤的骨头！别人都皱眉头，我拿来熬高汤。谢谢。', { mood: 'happy' }),
    line('gift:item:item/food/fish/cooked', "You cooked this? …It's good. It's good. I'd have used less fire, but it's good.", '你做的？……挺好。挺好的。换我会火小点，不过挺好。'),

    line('default', "Eat first. Talk after. That's the rule of this house.", '先吃饭，后说话。这是这家的规矩。'),
    line('default', "The oven smokes, the roof leaks, the children run wild. It's a good life. Don't tell anyone.", '烤炉冒烟，屋顶漏水，孩子满地跑。日子挺好。别告诉别人。'),
  ],
}
