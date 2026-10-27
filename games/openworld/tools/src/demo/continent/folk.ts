// The backdrop's people, in words (docs/continent.md §11): their names in both languages, by region; what they say,
// by what they do and where they live. No tale is told in what they say — the regions' sufferings are in the weather,
// the work and the prices, never in a quest or a secret. Written to docs/writing.md §3: a whole sentence or two in the
// voice of their trade, about what is in front of them; the nights, the roads and the shortages show through their work.

import type { LineDef } from '@openworld/engine'
import type { Name } from './names.ts'

type Pair = [string, string]

/** Given names by region and sex: each English with its Chinese (transliterated, as the Ford's people are). */
export const GIVEN: Record<string, { female: Pair[]; male: Pair[] }> = {
  frostfang: {
    female: [['Astrid', '阿斯特丽德'], ['Sigrun', '西格伦'], ['Ingrid', '英格丽'], ['Solveig', '索尔薇格'], ['Thora', '索拉'], ['Ylva', '伊尔娃'], ['Ragna', '拉格娜'], ['Hedda', '海达'], ['Liv', '莉芙'], ['Brynja', '布琳娅'], ['Gudrun', '古德伦'], ['Embla', '恩布拉'], ['Runa', '鲁娜'], ['Kari', '卡莉'], ['Saga', '萨迦'], ['Frida', '弗丽达']],
    male: [['Bjorn', '比约恩'], ['Halvar', '哈尔瓦'], ['Sigurd', '西古尔德'], ['Leif', '雷夫'], ['Torvald', '托尔瓦德'], ['Arne', '阿尔内'], ['Eirik', '埃里克'], ['Gunnar', '贡纳尔'], ['Ivar', '伊瓦尔'], ['Knut', '克努特'], ['Rolf', '罗尔夫'], ['Sten', '斯滕'], ['Ulric', '乌尔里克'], ['Vidar', '维达'], ['Orm', '奥姆'], ['Hakon', '哈康']],
  },
  redmarch: {
    female: [['Brunhild', '布伦希尔德'], ['Katrin', '卡特琳'], ['Mirka', '米尔卡'], ['Radka', '拉德卡'], ['Zora', '佐拉'], ['Vesna', '韦斯娜'], ['Dragana', '德拉加娜'], ['Jelka', '耶尔卡'], ['Branka', '布兰卡'], ['Ilka', '伊尔卡'], ['Marta', '玛尔塔'], ['Oksana', '奥克萨娜'], ['Ludmila', '柳德米拉'], ['Teodora', '特奥多拉'], ['Svetla', '斯韦特拉'], ['Hedwig', '黑德维希']],
    male: [['Radomir', '拉多米尔'], ['Bogdan', '博格丹'], ['Dragan', '德拉甘'], ['Kazimir', '卡济米尔'], ['Milos', '米洛什'], ['Stanko', '斯坦科'], ['Vuk', '武克'], ['Zoran', '佐兰'], ['Borislav', '博里斯拉夫'], ['Gerhard', '格哈德'], ['Ottokar', '奥托卡'], ['Wenzel', '文策尔'], ['Lothar', '洛塔尔'], ['Dietmar', '迪特马尔'], ['Jaromir', '雅罗米尔'], ['Ratko', '拉特科']],
  },
  tithe: {
    female: [['Agnes', '艾格尼丝'], ['Maud', '莫德'], ['Joan', '琼'], ['Alys', '艾丽丝'], ['Edith', '伊迪丝'], ['Beatrix', '比阿特丽克丝'], ['Isolde', '伊索尔德'], ['Rose', '萝丝'], ['Cecily', '塞西莉'], ['Ellen', '艾伦'], ['Margery', '玛杰丽'], ['Nan', '南'], ['Tilda', '蒂尔达'], ['Wenna', '温娜'], ['Hawise', '霍伊丝'], ['Bettris', '贝特丽丝']],
    male: [['Walter', '沃尔特'], ['Hugh', '休'], ['Roger', '罗杰'], ['Simon', '西蒙'], ['Giles', '贾尔斯'], ['Ralph', '拉尔夫'], ['Osbert', '奥斯伯特'], ['Martin', '马丁'], ['Geoffrey', '杰弗里'], ['Hamo', '哈莫'], ['Piers', '皮尔斯'], ['Robin', '罗宾'], ['Thurstan', '瑟斯坦'], ['Wat', '瓦特'], ['Adam', '亚当'], ['Ivo', '伊沃']],
  },
  palefen: {
    female: [['Aine', '艾妮'], ['Brigid', '布丽吉德'], ['Ciara', '基娅拉'], ['Deirdre', '迪尔德丽'], ['Eithne', '埃斯妮'], ['Fiona', '菲奥娜'], ['Grainne', '格兰妮'], ['Isla', '艾拉'], ['Maeve', '梅芙'], ['Niamh', '妮芙'], ['Orla', '奥拉'], ['Roisin', '萝欣'], ['Saoirse', '瑟莎'], ['Una', '乌娜'], ['Moira', '莫伊拉'], ['Sorcha', '索尔卡']],
    male: [['Aidan', '艾丹'], ['Bran', '布兰'], ['Cian', '基安'], ['Declan', '德克兰'], ['Eamon', '埃蒙'], ['Fergus', '弗格斯'], ['Lorcan', '洛肯'], ['Niall', '尼尔'], ['Oisin', '奥辛'], ['Ronan', '罗南'], ['Tadhg', '泰格'], ['Cormac', '科马克'], ['Diarmuid', '迪尔穆德'], ['Fintan', '芬坦'], ['Colm', '科尔姆'], ['Kieran', '基兰']],
  },
  altar: {
    female: [['Clara', '克拉拉'], ['Agatha', '阿加莎'], ['Lucia', '露西娅'], ['Benedicta', '本笃塔'], ['Cecilia', '塞西莉亚'], ['Hilda', '希尔达'], ['Monica', '莫妮卡'], ['Scholastica', '思嘉'], ['Ursula', '乌尔苏拉'], ['Odile', '奥迪尔'], ['Paula', '保拉'], ['Regina', '雷吉娜'], ['Sabina', '萨宾娜'], ['Thecla', '特克拉'], ['Verena', '维蕾娜'], ['Adela', '阿德拉']],
    male: [['Anselm', '安瑟伦'], ['Benedict', '本笃'], ['Clement', '克莱门特'], ['Dominic', '多明我'], ['Gregory', '格里高利'], ['Jerome', '哲罗姆'], ['Lucius', '卢修斯'], ['Paulus', '保卢斯'], ['Silvan', '西尔万'], ['Urban', '乌尔班'], ['Vincent', '文森特'], ['Bernard', '伯纳德'], ['Aldric', '奥尔德里克'], ['Basil', '巴西尔'], ['Cyprian', '居普良'], ['Hilary', '希拉里']],
  },
  holy: {
    female: [['Aurelia', '奥蕾莉娅'], ['Celestine', '塞莱斯廷'], ['Dorothea', '多萝西娅'], ['Helena', '海伦娜'], ['Irene', '艾琳'], ['Junia', '尤尼娅'], ['Livia', '莉薇娅'], ['Marina', '玛丽娜'], ['Octavia', '屋大薇'], ['Phoebe', '菲比'], ['Seraphina', '塞拉菲娜'], ['Theodora', '狄奥多拉'], ['Valeria', '瓦莱丽娅'], ['Zenobia', '芝诺比娅'], ['Lydia', '莉迪娅'], ['Flavia', '弗拉维娅']],
    male: [['Aurelian', '奥勒良'], ['Cassian', '卡西安'], ['Demetrius', '德米特里'], ['Eusebius', '优西比乌'], ['Felix', '费利克斯'], ['Gaius', '盖乌斯'], ['Ignatius', '依纳爵'], ['Julian', '尤利安'], ['Marcus', '马库斯'], ['Nicanor', '尼卡诺尔'], ['Octavian', '屋大维'], ['Quintus', '昆图斯'], ['Severus', '塞维鲁'], ['Tiberius', '提比略'], ['Valens', '瓦伦斯'], ['Lucian', '卢锡安']],
  },
}

/** Family names: a region's first halves (as its places', names.ts) and a root a household is known by. */
const FAMILY_PRE: Record<string, Pair[]> = {
  frostfang: [['Frost', '霜'], ['Pine', '松'], ['Grey', '灰'], ['Wolf', '狼'], ['Thorn', '棘'], ['North', '北'], ['Fir', '杉'], ['Gull', '鸥'], ['Snow', '雪'], ['Elk', '麋'], ['Birch', '桦'], ['Raven', '渡鸦']],
  redmarch: [['Red', '赤'], ['Iron', '铁'], ['Spear', '矛'], ['Rust', '锈'], ['Ember', '烬'], ['Shield', '盾'], ['Hawk', '鹰'], ['Flint', '燧'], ['Ash', '灰'], ['Crag', '崖'], ['Boar', '猪'], ['Steel', '钢']],
  tithe: [['Salt', '盐'], ['Grain', '谷'], ['Dust', '尘'], ['Copper', '铜'], ['Barley', '麦'], ['Millet', '粟'], ['Hay', '草'], ['Straw', '秸'], ['Mill', '磨'], ['Oat', '燕麦'], ['Sheaf', '捆'], ['Flax', '麻']],
  palefen: [['Pale', '苍'], ['Mire', '泥'], ['Reed', '苇'], ['Still', '寂'], ['Fog', '雾'], ['Crow', '鸦'], ['Moth', '蛾'], ['Rush', '灯芯'], ['Sedge', '莎'], ['Heron', '鹭'], ['Willow', '柳'], ['Eel', '鳗']],
  altar: [['White', '白'], ['Chalk', '垩'], ['Bell', '钟'], ['Candle', '烛'], ['High', '高'], ['Lily', '百合'], ['Dove', '鸽'], ['Choir', '咏'], ['Cloister', '院'], ['Vigil', '守'], ['Rose', '玫瑰'], ['Marble', '石'] ],
  holy: [['Sun', '日'], ['Dawn', '曙'], ['Gold', '金'], ['Lamb', '羔'], ['Halo', '环'], ['Grace', '恩'], ['Light', '光'], ['Myrrh', '没药'], ['Laurel', '桂'], ['Olive', '橄榄'], ['Palm', '棕'], ['Amber', '琥珀']],
}
const FAMILY_ROOT: Pair[] = [['wood', '林'], ['brook', '溪'], ['field', '田'], ['stone', '石'], ['ford', '渡'], ['hill', '丘'], ['well', '井'], ['dale', '谷'], ['croft', '园'], ['ward', '守'], ['wright', '匠'], ['man', '人'], ['hold', '堡'], ['mere', '湖'], ['row', '巷']]

/** A family name for a household: the region's, and not one taken in this place already. */
export function familyName(region: string, pick: <T>(xs: T[]) => T, taken: Set<string>): Name {
  const pre = FAMILY_PRE[region] ?? FAMILY_PRE.frostfang
  for (let tries = 0; tries < 200; tries++) {
    const [pe, pz] = pick(pre)
    const [re, rz] = pick(FAMILY_ROOT)
    const en = `${pe}${re}`
    if (taken.has(en) && tries < 150) continue
    taken.add(en)
    return { en, zh: `${pz}${rz}` }
  }
  throw new Error(`no family name left in ${region}`)
}

// ------------------------------------------------------------------ what they say

const L = (key: string, en: string, zh: string): LineDef => ({ key, text: { en, zh } })

/** By what they do. */
const BY_ROLE: Record<string, LineDef[]> = {
  villager: [
    L('default', 'Watch the rut at the end of the lane. The rain dug it deeper, and a cart tipped over in it the day before yesterday.', '巷口那道车辙你留神点。下过一场雨又冲深了，前天还有辆车在那儿翻了。'),
    L('default', 'It gets dark earlier every day. Our lamp oil used to last till spring; this year I doubt it will see midwinter.', '天黑得一天比一天早了。我家的灯油往年能点到开春，今年怕是撑不到冬至。'),
    L('default', "You're not from here, are you? There have been more people on the road than usual lately. They say the Church is calling for pilgrims.", '你是外地来的吧？这阵子路上的人比往年多，听说是教会在召朝圣的人。'),
    L('hour:morning', "Up already? The bakery isn't open yet. I want the first batch; flour is short, and by mid-morning there's nothing left.", '这么早就起了？面包房还没开门呢。我得赶第一炉，这阵子面粉紧，晚了就买不着了。'),
    L('hour:evening', "Done at last. I'll fetch a bucket from the well, and then there's supper to make for the whole house.", '活总算干完了。我去井边打桶水，回来还得给一家子做饭。'),
  ],
  farmer: [
    L('default', 'The wheat came into ear nearly half a month late this year, and the ears are thin. My father farmed forty years and says he never saw the like.', '今年的麦子抽穗晚了快半个月，穗子也瘪。我爹种了四十年地，说从没见过这样的。'),
    L('default', "I've turned the east rows twice this week and the soil is still hard. Other years it would be loose by now.", '东边那几垄我这礼拜翻了两遍，土还是硬邦邦的。往年这时候早就松了。'),
    L('hour:morning', "I want these rows hoed by noon. This afternoon I'm helping next door mend their pigsty. I promised.", '我得趁上午把这几垄锄完。下午要去帮邻居家修猪圈，早就说好了的。'),
    L('weather:rain', "Rain. Good. Walk round, would you, and don't step in the furrows I just opened.", '下雨了，好。你绕着点走，别踩我刚开的沟。'),
  ],
  merchant: [
    L('default', "Have a look, take your time. Don't ask for lamp oil, though. Not a drop has come in this month, and every house is short.", '要什么随便看。灯油就别问了，这个月一滴都没进来，家家都缺。'),
    L('default', "Salt has gone up again; it costs me a third more to buy in than last month. I can't help it. If it's too dear, buy less.", '盐又涨了，进价比上个月高了三成。我也没办法，你要是嫌贵，就少买点。'),
    L('hour:evening', "I'm packing up. Buy now if you want anything; I'm off early tomorrow to restock.", '我要收摊了。要买趁现在，明天我得一早去进货。'),
  ],
  smith: [
    L('default', "Iron has doubled in price these two months, and half the time there's none to be had at any price. I'll take mending, but anything new you'll have to wait for.", '铁料这两个月涨了一倍，还常常有钱也买不到。修补的活我接，要打新的就得等。'),
    L('default', "Everyone wants door bars and shutter bolts lately, and they want them thick. If you've something to mend, leave it there and come back tomorrow.", '最近来打门闩、窗栓的人多，都要厚的。有要修的东西就放那边，明天来拿。'),
  ],
  innkeeper: [
    L('default', "A bed is one coin, soup is two. There's meat in the soup today; have it while it's hot.", '住一晚一枚钱，汤两枚。今天的汤里放了肉，趁热喝。'),
    L('hour:evening', "It fills up in the evening with people who won't travel after dark. The corner table is for the regulars; sit somewhere else.", '晚上人多，都是天黑了不敢赶路的。角落那张桌子是熟客的，你坐别处吧。'),
  ],
  priest: [
    L('default', 'If you are weary, traveller, come in and sit. Many come to light candles of late; the chapel is brighter than it used to be.', '旅人，若是累了，便进来坐坐。近来点烛的人多，堂里倒比往日亮些。'),
    L('default', 'Those who come to pray these days ask for longer days and quiet nights. I tell them what the Church teaches: suffering brings us closer to God.', '近来来祷告的人，求的多是白昼长些、夜里平安。我便照教会的教导告诉他们：苦难使人接近神。'),
    L('hour:morning', 'Morning prayers are just over. If you want holy water, you will have to wait for the deacon; he has the key.', '晨祷刚做完。你若要领圣水，得等执事回来，钥匙在他身上。'),
  ],
  guard: [
    L('default', "Keep your blade sheathed while you're here. If there's trouble, come to us. Don't settle it yourself.", '在这儿把刀收好。有什么麻烦就来找我们，别自己动手。'),
    L('default', "Don't go out after dark. Those things out in the wilds — there weren't this many of them last year.", '天黑以后别往外走。野地里那些东西，去年还没这么多。'),
    L('hour:night', "What are you doing out at this hour? If you've no business here, go and get some sleep. Don't hang about.", '这么晚了，你在这儿做什么？没事就回去睡觉，别在这儿转悠。'),
  ],
  soldier: [
    L('default', 'Drill before dawn, and after drill we dig ditches. The blisters on my hands never get the chance to heal.', '天不亮就操练，练完了还得去挖壕沟。我这手上的泡就没消过。'),
    L('default', 'Half the company was sent off again last month to escort pilgrims, they said. The rest of us stand two posts each.', '上个月又调走了半个队，说是去护送朝圣的人。剩下我们几个，一人守两个岗。'),
  ],
  child: [
    L('default', 'Can you hop to the well and back on one foot? I can. I did twenty hops without switching.', '你能单脚跳到井边再跳回来吗？我能，我跳了二十下都没换脚。'),
    L('default', "My mum says I can't go out after dark because something out there takes children. Have you ever seen one?", '我娘说天黑了不许出门，外面有东西会把小孩叼走。你见过那种东西吗？'),
    L('hour:evening', "I have to go home, Mum's calling me for supper. I'm not tired. I'm really not.", '我得回家了，我娘喊我吃饭。我不困，真的不困。'),
  ],
  elder: [
    L('default', "When I was small, at this time of year it was still light after supper, and we would play outside a good while. Now it's dark before supper is even cooked.", '我小时候，这个时节吃完晚饭天还亮着，我们还能在外面玩好一阵。现在饭还没做好，天就黑了。'),
    L('default', "Sit down, sit down, don't stand there. My legs aren't what they were, and looking up at you hurts my neck.", '坐吧，坐吧，别站着。我这腿不中用了，仰着头跟你说话，脖子疼。'),
  ],
  fisher: [
    L('default', "The fish have all gone down deep lately. Two all morning, that's all. It wasn't like this in my father's day.", '这阵子鱼都沉到深水里去了，一上午就钓上来两条。我爹那时候可不是这样。'),
    L('weather:rain', "Fish come up in the rain, so I'll stay out a while longer. If you don't mind getting wet, you can watch.", '下雨天鱼爱往上浮，我得多待一会儿。你不怕淋的话，就在边上看着吧。'),
  ],
  hunter: [
    L('default', "Half the deer in the woods are gone, and there are tracks I can't put a name to. Big ones. I'm back before dark now.", '林子里的鹿少了一大半，倒多了些我叫不出名字的脚印，个头不小。我现在都赶在天黑前回来。'),
    L('default', 'If you go into the woods, keep clear of the spots marked with red rags. Those are my snares.', '你要进林子的话，绕开那些挂了红布条的地方，那是我下的套子。'),
  ],
  miner: [
    L('default', "They're pushing us hard this month. They say every smith in town is waiting on ore. We go down twice a day now, for the same pay.", '这个月上头催得紧，说是城里的铁匠都在等矿。我们现在一天下去两趟，工钱还是那么多。'),
  ],
  herbalist: [
    L('default', 'Feverfew for headaches, yarrow to stop bleeding. Both are slow to come up this year; I have to go deeper into the woods to gather enough.', '小白菊治头疼，蓍草止血。这两样今年都长得慢，我得往林子深处走才采得够。'),
  ],
  scholar: [
    L('default', "I'm copying the pilgrim rolls for the Church: names sent in from every parish, dozens a day. By noon my hand aches.", '我在替教会誊朝圣者的名册。各地报上来的名字，一天就有好几十个，抄到中午手就酸了。'),
  ],
  noble: [
    L('default', 'Stand aside, if you would. My coachman has gone for someone to mend the wheel, and I can hardly wait in the mud.', '劳驾让一让。我的车夫找人修车轮去了，我总不能站在泥里等着。'),
  ],
  bard: [
    L('default', "Care for a song? One coin each. I've just learned a pilgrims' song from people on the road. It has seventeen verses.", '想听首歌吗？一枚钱一首。我刚跟路上的朝圣者学了一首歌，一共十七段。'),
  ],
  beggar: [
    L('default', 'Spare a coin, please, or a crust of bread. Even the soup tent has been shut these past few days.', '行行好，给一枚钱吧，一块干面包也行。这几天连施粥的棚子都关了。'),
  ],
  traveler: [
    L('default', "Six days on the road to get here, and I've worn through my soles. Is there a cobbler round here?", '我走了六天才到这儿，鞋底都磨穿了。这附近有补鞋的吗？'),
    L('default', 'The Church named me for the pilgrimage. They say it is calling people everywhere; of every ten I meet on the road, three or four are on the same errand.', '教会点了我的名，叫我去朝圣。听说各地都在召人，路上碰见的十个人里，倒有三四个跟我一样。'),
  ],
  peddler: [
    L('default', 'Needles, thread, buttons, torches, bait, I have all of that. Have a look; after this town, the next market is four days off.', '针线、扣子、火把、鱼饵，都有。看看吧，过了这个镇子，下一个集要走四天。'),
  ],
}

/** By where they live: the land, its weather and its work, never its tale. */
const BY_REGION: Record<string, LineDef[]> = {
  frostfang: [
    L('default', "They say there's a knight on the road past the Ford who stops everyone. Nobody gets by him.", '听说过了渡口的那条大路上，有个骑士把路拦住了，谁也过不去。'),
    L('weather:storm', 'Storm off the sea. Stack the wood high and keep the shutters shut.', '海上起风暴了。柴堆高，窗板关好。'),
  ],
  redmarch: [
    L('default', "The fort has been taking men again. Both the neighbours' sons went last month, and there hasn't been a letter since.", '要塞又来征人了。隔壁家两个儿子上个月都走了，到现在一封信也没有。'),
    L('default', "The wolves have been bold this year. They took three of our sheep last month, and we've raised the fence again.", '今年的狼胆子大，上个月叼走了我们三只羊。篱笆我们又加高了一截。'),
  ],
  tithe: [
    L('default', 'Every sack of grain is weighed first, and the granary takes its share before we get ours. This year, after that, we have half a sack left.', '麦子收上来先过秤，交够粮仓的份才轮到自家。今年交完，家里就剩小半袋。'),
    L('default', 'The well has gone too salty to drink. We walk the better part of an hour for water now.', '井水咸得没法喝了，现在挑一趟水得走大半个时辰。'),
  ],
  palefen: [
    L('default', "We haven't seen the sun for days. Noon looks much like evening here, and washing won't dry in a week.", '这里好几天没见着太阳了，晌午跟傍晚差不多。晾的衣服一个礼拜都不干。'),
    L('default', "Keep to the boards and stay out of the mud. And if you hear anything from the graveyard at night, don't go and look.", '走路踩着木板走，别下到泥里。还有，夜里墓地那边要是有动静，别过去看。'),
  ],
  altar: [
    L('default', 'The monastery bell used to ring seven times a day. Now it rings through the night as well, for the vigil, they say.', '修道院的钟以前一天敲七回，现在夜里也敲，说是为了守夜。'),
    L('default', "The snow on the heights is late melting this year. The sheep still can't get up to the high pasture, so they're on hay.", '山上的雪今年化得晚，羊到现在还上不了高处的草场，只能喂干草。'),
  ],
  holy: [
    L('default', 'Pilgrims come into the city every day now. The inns have been full for weeks, and plenty of them sleep out on the squares.', '这阵子天天有朝圣的人进城，客栈早就住满了，好多人只能在广场上过夜。'),
    L('default', 'Mind your purse in the crowd by the gate.', '城门边人多，看好你的钱袋。'),
  ],
}

const GREETING: LineDef[] = [
  L('greeting:first', "Hello. I haven't seen you before. Are you from out of town?", '你好。没见过你，是外地来的吧？'),
  L('greeting:first', 'Hello there. Where are you from? So many people have been passing through lately.', '你好啊，从哪儿来的？这阵子过路的人真多。'),
  L('greeting:first', 'Oh, hello. Can I help you?', '啊，你好。找我有事吗？'),
]

/** What a person of this role in this region says: a greeting, two of their work's lines and one of their land's. */
export function linesFor(role: string, region: string, pick: <T>(xs: T[]) => T): LineDef[] {
  const own = BY_ROLE[role] ?? BY_ROLE.villager
  const land = BY_REGION[region] ?? BY_REGION.frostfang
  const out: LineDef[] = [pick(GREETING)]
  const a = pick(own)
  out.push(a)
  const b = pick(own)
  if (b !== a) out.push(b)
  out.push(pick(land))
  return out
}
