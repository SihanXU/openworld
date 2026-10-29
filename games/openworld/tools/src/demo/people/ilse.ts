// Sister Ilse, keeper of Firstlight's flame and its chapel at Astra's altar (docs/chapter-1.md §7, docs/cast/ilse.md): a nun of the
// Five Sufferings, graceful, gentle and a little absent-minded, motherly in every small care and deeply devout; white-haired and
// red-eyed from birth, her eyes weak in bright light, so she knows people by their step. Brother Anselm serves in her chapel. A
// novice of sixteen, she raised a foundling left on the chapel's step, who went to the Ashen Watch at ten and became the grey man;
// she knows his walk, and tells no one. She leaves the chapel door unlatched every night for Lina, who will not ask.

import { line, type PersonDef } from '../person.ts'

export const ilse: PersonDef = {
  id: 'npc.ilse',
  // the main story needs them where they are: not asked to move to a home ground (content social.ts residence)
  tags: ['storybound', 'devout'],
  role: 'priest',
  essential: true,
  name: { en: 'Sister Ilse', zh: '伊尔丝修女' },
  gender: 'female',
  look: { parts: { hair: 'hair.braid', face: 'face.soft', outfit: 'outfit.vestment', hat: 'hat.hood' }, colors: { hair: 'snow', eyes: 'ember', skin: 'fair', 'outfit.1': 'ivory', 'outfit.2': 'madder', 'hat.1': 'ivory' } },
  age: 46,
  temperament: { personality: 'gentle', manner: 'polite', social: 'outgoing', outlook: 'hopeful' },
  ties: { 'npc.rowan': 'old friend', 'npc.severin': 'raised him', 'npc.anselm': 'serves in her chapel', 'npc.lina': 'watches over her' },
  // what they sell (fits who they are; content items.ts prices it)
  trade: { stock: [['item/light/candle', 6], ['item/vessel/flask/holy_water', 1], ['item/food/bread', 2]] },
  purse: 15,
  schedules: {
    default: [
      [22, 6, 'meadow.church:bed.1', 'sleep'],
      [6, 22, 'meadow:shrine.tend', 'tend the Firstlight'],
    ],
    'fact:ch1.flame_stolen': [
      [22, 6, 'meadow.church:bed.1', 'sleep'],
      [6, 22, 'meadow:shrine.tend', 'sweep the cold altar'],
    ],
  },
  lines: [
    // a chat (the talk's `chat` verb, docs/npc-sandbox.md §2.15): small talk in their own voice; what they like best is said beside these
    line('chat', "You've come a long way. There is bread by the altar; please, help yourself. ...Astra would want you fed before the road.", '路上辛苦了。祭坛边上放着面包，请别客气。……阿斯特拉也会希望你吃饱了再上路的。'),
    line('chat', "Brother Anselm reads aloud when he thinks the chapel is empty. I always mean to tell him I'm there... and every time I'm listening too closely, and forget.", '安塞姆修士以为礼拜堂里没人的时候，会把书念出声来。我总想告诉他我也在……可每次都听入了神，又忘了说。'),
    line('chat', 'I came out to fetch something... what was it? No matter. If I stand here a little, it will come back to me.', '我出来是要拿什么东西的……是什么来着？不要紧，在这里站一会儿，总会想起来的。'),
    line('chat', 'Lina says she needs no one. So I never latch the chapel door at night. That way she never has to ask.', '莉娜总说她谁也不需要。所以夜里我从不闩礼拜堂的门，这样她就不必开口求人了。'),
    line('chat', 'Every morning, when the sky grows light, I thank Astra that the night is over. I have done it since I was a novice. In more than thirty years I have not missed a single morning.', '每天早上天一亮，我都先谢过阿斯特拉，谢他让这一夜过去了。我当见习修女的时候就这样，三十多年了，一个早上也没落下。'),
    line('chat', "Ah, it's you. I know your step by now. My eyes have been weak in the light since I was a child; by day, faces are always a blur to me, so I go by my ears. From now on, when you come, you needn't say a word. I'll know it's you.", '啊，是你呀。你的脚步声，我已经记住了。我的眼睛从小就怕光，白天看人总是模模糊糊的，只好靠耳朵。所以往后你来，不用出声，我也认得出是你。'),
    line('chat', 'Nessa comes for candles every week, four at a time. She works out her sunsets by lamplight, and says that when the light is poor she copies the numbers wrong.', '奈莎每个礼拜都来拿蜡烛，一次拿四支。她夜里点着灯算日落的时辰，说光一暗，数字就会抄错。'),
    line('chat', 'Pell draws the road east, over and over. It is the way his father went. I keep every drawing he gives me.', '佩尔总是画往东去的那条路，画了一张又一张。他父亲就是从那条路走的。他送给我的画，我每一张都收着。'),
    line('chat', 'Some mornings there is dawnbloom on the altar before I get there, with the dew still on it. I have never asked who leaves it.', '有几个早上，我还没到，祭坛上就已经放好了晨光花，花瓣上的露水都还没干。是谁放的，我从来没有问过。', { mood: 'happy' }),
    line('favourite', "I'm a little ashamed to say it, but even a nun has a fondness. Mine is {favourite}. ...Please keep it from Brother Anselm.", '说来有些难为情，修女也有偏爱的东西。我喜欢的是{favourite}。……请别让安塞姆修士知道。', { mood: 'shy' }),
    // the news the story spreads (its topics), said once while fresh
    line('topic:crown', 'We laid the crown beneath the altar. Nessa says it hums at night, so I sang it a hymn for sleeping. ...It does seem a little quieter.', '我们把荆棘冠放在祭坛底下了。奈莎说它夜里会嗡嗡地响，我就给它唱了一首安眠的圣歌。……好像是安静了一点。'),
    line('greeting:first', 'Welcome to Firstlight, traveller. Your hands are cold; please, come closer. This flame was lit from the first dawn after the First Night, and it is glad to warm anyone who has come far.', '欢迎来到初原村，旅人。你的手很凉，请靠近些。这团火是从初夜之后的第一道晨光里取来的，远道而来的人，它都乐意温暖。'),
    line('default', "Suffering is not God's abandonment. It is the proof the debt is being paid. That is what the Five teach us.", '苦难并非神的遗弃。苦难，是灾厄得以被偿还的证明。这是五苦圣教的教诲。'),
    line('default', 'The flame is older than any house in Firstlight. The old keeper told me the first houses were built around it, so that someone would always be near to tend it.', '这团火比村里任何一间房子都老。从前的守火人告诉我，最早的几间房子就是围着它盖的，好让身边总有人照看它。'),
    line('hour:morning', 'Good morning. I have just thanked Astra that the night is over, and said one for you as well.', '早安。我刚谢过阿斯特拉，让这一夜过去了，也替你谢了一句。', { mood: 'happy' }),
    line('hour:evening', "The evenings come sooner. Every week I light the lamps a little earlier, and write each one down. ...Only I've forgotten which book I wrote them in.", '黄昏一天比一天早了。我每个礼拜都提早一点点灯，每次都记下来。……只是记在哪一本册子上，我又忘了。'),
    line('hour:night', "It's very late. The flame keeps watch at night; you needn't. ...Sleep well, and come and see me tomorrow.", '已经很晚了。守夜有圣火，你不必陪着。……好好睡一觉，明天再来看我吧。'),
    line('weather:rain', "You're soaked through. Stand by the flame a while, and I'll find you something dry.", '你都淋透了。到火边站一会儿吧，我去给你找件干衣服。'),
    line('weather:storm', "On nights like this I count the doors I hear close. ...Go home early, will you? I'd like to count yours too.", '这样的夜里，我会数着听见了几扇门关上。……早些回家好吗？我也想听见你的那一扇。', { mood: 'sad' }),
    line('fact:village.rescued', "Lina and Oskar are home safe. Thanks be to Astra, and to you. Tonight the whole village gives thanks at the flame. You will come, won't you? I'll keep you a seat near the fire.", '莉娜和奥斯卡平安回来了。感谢阿斯特拉，也谢谢你。今晚全村都要到圣火前谢恩，你也会来吧？我给你留一个靠近火的位子。', { once: true, mood: 'happy' }),
    line('fact:village.rescued', "Lina once asked me, as if it were nothing, whether a prayer counts for someone no one visits. Every prayer counts. I didn't ask her for whom.", '莉娜有一回像是随口问我：一个没人去看的人，替他祈祷，算不算数。每一句祈祷都算数。我没有问她是替谁问的。', { once: true }),
    line('fact:ch1.flame_stolen', 'Some people take a thing to keep it.', '有些人拿走一样东西，是为了守住它。', { mood: 'sad' }),
    line('fact:ch1.flame_stolen', 'I still sweep the altar every morning, the taper still in my hand. ...My hands are slower than my heart to believe the flame is gone.', '我每天早上还是去扫祭坛，手里照旧拿着点火棒。……心里知道火已经不在了，手却还没习惯。', { mood: 'sad' }),
    line('fact:ch1.flame_stolen', "The way you stand reminds me of someone I knew. Shoulders always braced, as if the sky might fall at any moment. ...Do sit a while. I'll make tea.", '你站着的样子，很像我从前认识的一个人。肩膀总是绷得紧紧的，好像天随时会塌下来。……坐一会儿吧，我去沏茶。', { once: true }),
    line('fact:ch1.letter', 'Astra bore five sufferings so the sun would rise. The Seal-bearers carry them still. Go to the first of them, pilgrim. ...And before you set out, please, eat a proper meal.', '阿斯特拉承受了五苦，太阳才重新升起。如今这五苦，由持印者替他担着。去找第一位持印者吧，朝圣者。……还有，出发之前，请一定好好吃顿饭。'),
    line('fact:ch1.letter', 'I remember every pilgrim I have blessed by their footsteps. Please come back, so that I may hear yours again.', '我祝福过的每一位朝圣者，我都记得他们的脚步声。请一定回来，让我再听一听你的。'),
    line('fact:ch1.crown', 'The Crown of Thorns, here in our village. I never thought I would see it with my own eyes. Keep it close to you, please, but not against your heart.', '荆棘冠，竟然来到了我们村里。我从没想过这辈子能亲眼见到它。请把它贴身收好。只是……别让它太靠近你的心。', { once: true }),
    line('fact:ch1.end', 'He always did carry things that were too heavy for him.', '他从小就是这样，总要背些他背不动的东西。', { mood: 'sad' }),
    line('given', "Is this for me? ...Thank you. I'll set it by the altar first, so Astra may see it too, and quietly take it back tonight.", '这是给我的吗？……谢谢你。我先把它供在祭坛边，让阿斯特拉也看一看，晚上再悄悄拿回来。', { mood: 'happy' }),
  ],
}
