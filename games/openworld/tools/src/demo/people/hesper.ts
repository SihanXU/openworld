// Hesper, the ferrykeeper. Thirty-one years on this crossing; her husband Aldo built the winch
// and the raft, and drowned the spring after. She stayed. Her hands have stiffened (she cannot
// splice a rope any more and will not say so plainly), she speaks in few words, and she does
// not take credit — which is why the peddler Tobin still owes her last autumn's fare.

import { line, type PersonDef } from '../person.ts'

const FIRE = { uses: 'ford.campfire', need: { status: ['lit'] } }

export const hesper: PersonDef = {
  id: 'npc.hesper',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound'],
  role: 'ferrykeeper',
  essential: true,
  name: { en: 'Hesper', zh: '赫斯珀' },
  gender: 'female',
  look: { parts: { hair: 'hair.bun', face: 'face.weary', outfit: 'outfit.oilcloth', hat: 'hat.kerchief' }, colors: { hair: 'steelgrey', eyes: 'storm', skin: 'tan', 'outfit.1': 'ochre', 'outfit.2': 'umber', 'hat.1': 'slate' } },
  age: 64,
  temperament: { personality: 'stubborn', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.tobin': 'owes her last autumn\'s fare' },
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/food/fish/raw', 3], ['item/food/fish/cooked', 2], ['item/tool/fishing_rod', 1], ['item/misc/bait', 6]] },
  purse: 25,
  schedules: {
    default: [
      [21, 5, 'camp.bed', 'sleep'],
      [5, 7, 'camp.fire', 'tend the fire', FIRE],
      [7, 12, 'landing.winch', 'watch the water'],
      [12, 13, 'camp.fire', 'tend the fire', FIRE],
      [13, 18, 'landing.nets', 'mend nets'],
      [18, 21, 'camp.fire', 'tend the fire', FIRE],
    ],
    // in a storm the river is no place to stand: she keeps to the tent's mouth
    storm: [
      [21, 5, 'camp.bed', 'sleep'],
      [5, 7, 'camp.fire', 'tend the fire', FIRE],
      [7, 21, 'tent.mouth', 'wait out the storm'],
    ],
    'fact:ford.crossed': [
      [21, 5, 'camp.bed', 'sleep'],
      [5, 21, 'landing.winch', 'watch the water'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', 'The river is loud in spring, with the snowmelt. By autumn you can hear the fish jump.', '开春化雪，河水响得很。到了秋天，静得能听见鱼跳。'),
    line('chat', 'Rope wants oiling before the cold, or it stiffens. I do mine every autumn. Aldo showed me how.', '天冷以前，绳子得上一遍油，不然会发硬。我每年秋天都上。是阿尔多教我的。'),
    line('favourite', 'Aldo used to bring me {favourite} from the far bank. I haven\'t had it since. If you have some, I won\'t say no.', '阿尔多以前常从对岸给我带{favourite}。他走了以后，我就再没有过。你要是有，我不推辞。'),
    line('given:favourite', '…{item}. Aldo used to— Thank you.', '……{item}。阿尔多以前也——谢谢你。', { mood: 'happy' }),
    line('greeting:first', "The storm took the ferry rope in the night. Nobody crosses till it's mended. … There's a spare in my chest. My hands won't splice it any more. Yours might.", '夜里起风暴，把渡绳扯断了。绳子不接上，谁也过不了河。……我箱子里有一根备用的。我这双手接不了绳了，你的手也许行。', { mood: 'neutral', once: true }),
    line('default', 'The rope is in my chest. The winch is on the landing. The rest is hands.', '绳子在我箱子里，绞盘在码头上。剩下的就看你的手了。'),
    line('default', 'Thirty-one years I\'ve kept this crossing. I know every snag between here and the narrows.', '这个渡口我守了三十一年。从这儿到窄口，水底下哪里有暗桩，我都知道。'),
    line('default', "Aldo built that winch. Built the raft too. The river took him the spring after. I stayed.", '那个绞盘是阿尔多造的，筏子也是他造的。第二年开春，河把他带走了。我留了下来。'),
    line('default', 'Aldo and Joss built the footbridge, twenty years back. A rider in white took it apart in one night, and laid the nails on my pier.', '那座小桥是阿尔多和乔斯二十年前一起搭的。有个白衣骑手，一夜之间就把它拆了，还把钉子一根根摆在我的码头上。'),
    line('hour:evening', 'The evenings come sooner every week. I light the lamp earlier and earlier.', '天黑得一个礼拜比一个礼拜早。我点灯也一回比一回早。'),
    line('fact:ch1.crown', 'The rider is down? ...Then I\'ll build the bridge again. Properly, this time.', '那个骑手倒了？……那我就把桥再修起来。这回要修结实些。', { once: true }),
    line('default', "That tree at the narrows has been dead ten years. Aldo always said it would fall the wrong way.", '窄口那棵树枯了十年了。阿尔多一直说，它倒的时候会往不该倒的那边倒。'),
    line('hour:morning', 'Water is high. It will be high all day.', '水涨了。今天一整天都会这么高。'),
    line('hour:evening', 'Keep near the fire after dark. Things come up out of the hollow.', '天黑以后待在火边。会有东西从洞里爬出来。'),
    line('hour:night', '… Go to sleep.', '……去睡吧。'),
    line('weather:storm', 'Get under something. Lightning likes that dead tree.', '找个地方躲一躲。闪电专劈那棵枯树。'),
    line('weather:rain', 'Rain. Nothing will catch fire today, at least. My knees don\'t like it.', '下雨了。今天起码烧不起火来。就是膝盖受罪。'),
    line('fact:ford.winch', 'The line holds. When you are ready, say so, and I will take you over.', '绳子吃住劲了。你准备好了就说一声，我送你过河。', { once: true }),
    line('fact:ford.tree', 'Well. Aldo was wrong. It fell the right way after all.', '哼。阿尔多说错了，它到底还是往对的那边倒了。', { once: true }),
    line('fact:ford.charm', 'Tobin gave you something off that cart? He must have been very hungry. He doesn\'t give things away.', '托宾从车上拿东西给你了？那他是真饿坏了。他那个人，平常什么都舍不得给。', { once: true }),
    line('topic:theft', 'I saw that. Put it back when you are done with it.', '我看见了。用完了放回去。', { mood: 'angry' }),
    line('topic:winch_mended', 'Good hands. Better than mine now.', '手巧。比我现在强。', { mood: 'happy' }),
    line('given:item/food', 'Eat it yourself. … Fine. Thank you.', '你自己吃吧。……好吧，谢谢。'),
    line('given:item/tool/rope', 'Not to me. To the winch.', '别给我。给绞盘。'),
    line('given', 'What would I do with that?', '我要这个干什么？'),
  ],
}
