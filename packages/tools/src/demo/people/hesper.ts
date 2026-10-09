// Hesper, the ferrykeeper. Thirty-one years on this crossing; her husband Aldo built the winch
// and the raft, and drowned the spring after. She stayed. Her hands have stiffened (she cannot
// splice a rope any more and will not say so plainly), she speaks in few words, and she does
// not take credit — which is why the peddler Tobin still owes her last autumn's fare.

import { line, type PersonDef } from '../person.ts'

const FIRE = { uses: 'ford.campfire', need: { status: ['lit'] } }

export const hesper: PersonDef = {
  id: 'npc.hesper',
  role: 'ferrykeeper',
  name: { en: 'Hesper', zh: '赫斯珀' },
  gender: 'female',
  look: { parts: { hair: 'hair.bun', face: 'face.weary', outfit: 'outfit.oilcloth', hat: 'hat.kerchief' }, colors: { hair: 'steelgrey', eyes: 'storm', skin: 'tan', 'outfit.1': 'ochre', 'outfit.2': 'umber', 'hat.1': 'slate' } },
  age: 64,
  temperament: { personality: 'stubborn', manner: 'plain', social: 'reserved', outlook: 'wary' },
  ties: { 'npc.tobin': 'owes her last autumn\'s fare' },
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
    line('greeting:first', "Storm took the ferry rope in the night. Nobody crosses till it's mended. … There's a spare in my chest. My hands won't splice it any more — yours might.", '夜里的风暴把渡绳扯断了。不修好，谁也过不去。……我箱子里有根备用的。我这双手接不动绳子了——你的手也许行。', { mood: 'neutral', once: true }),
    line('default', 'The rope is in my chest. The winch is on the landing. The rest is hands.', '绳子在我箱子里，绞盘在码头上。剩下的就看手了。'),
    line('default', 'Thirty-one years I have kept this crossing. The river has never once asked my leave.', '我守这个渡口三十一年了。河水从来没问过我一声。'),
    line('default', "Aldo built that winch. Built the raft too. The river took him the spring after. I stayed.", '那个绞盘是阿尔多造的，筏子也是。第二年春天河水把他带走了。我留了下来。'),
    line('default', 'Aldo and Joss built the footbridge, twenty years back. A rider in white took it apart in one night, and laid the nails on my pier.', '那座小桥是阿尔多和乔斯二十年前一起造的。一个白衣骑手一夜之间就把它拆了，还把钉子摆在我的码头上。'),
    line('hour:evening', 'The evenings come sooner every week. I light the lamp earlier and earlier.', '天黑得一周比一周早。我点灯也越来越早。'),
    line('fact:ch1.crown', 'The rider is down? ...I will build the bridge again, then. Properly, this time.', '那个骑手倒下了？……那我就再把桥修起来。这回要修得结结实实的。', { once: true }),
    line('default', "That tree at the narrows has been dead ten years. Aldo always said it would fall the wrong way.", '窄处那棵树枯了十年了。阿尔多总说它会往不该倒的方向倒。'),
    line('hour:morning', 'Water is high. It will be high all day.', '水涨着呢。今天一整天都会这么高。'),
    line('hour:evening', 'Keep near the fire after dark. Things come up out of the hollow.', '天黑了就待在火边。会有东西从洞里爬出来。'),
    line('hour:night', '… Go to sleep.', '……去睡吧。'),
    line('weather:storm', 'Get under something. Lightning likes that dead tree.', '找个地方躲着。闪电专挑那棵枯树。'),
    line('weather:rain', 'Rain. Good for the fire risk, bad for my knees.', '下雨了。火是不容易烧起来了，我的膝盖可受罪。'),
    line('fact:ford.winch', 'The line holds. When you are ready, say so, and I will take you over.', '绳子稳住了。你准备好了就说一声，我送你过去。', { once: true }),
    line('fact:ford.tree', 'Well. Aldo was wrong — it fell the right way after all.', '好吧。阿尔多说错了——它到底还是往对的方向倒了。', { once: true }),
    line('fact:ford.charm', 'Tobin gave you something off that cart? Then he was hungrier than he is proud.', '托宾从他车上给了你东西？看来他饿得连面子都不要了。', { once: true }),
    line('topic:theft', 'I saw that. Put it back when you are done with it.', '我看见了。用完了放回去。', { mood: 'angry' }),
    line('topic:winch_mended', 'Good hands. Better than mine now.', '手巧。比我现在强。', { mood: 'happy' }),
    line('given:item/food', 'Eat it yourself. … Fine. Thank you.', '你自己吃吧。……好吧，谢谢。'),
    line('given:item/tool/rope', 'Not to me. To the winch.', '别给我。给绞盘。'),
    line('given', 'What would I do with that?', '我要这个干什么？'),
  ],
}
