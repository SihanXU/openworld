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
    line('chat', "You've come a long way. There is bread by the altar; please, don't be shy. ...Astra would want you fed before the road.", '路上辛苦了。祭坛边备着面包，请不必客气。……阿斯特拉也一定希望你吃饱了再上路。'),
    line('chat', "Brother Anselm reads aloud when he thinks the chapel is empty. I always mean to tell him I'm there... and every time I'm listening too closely, and forget.", '安塞姆修士以为礼拜堂里没人时，会出声念书。我总想告诉他我在……可每次都听得入了神，又忘了。'),
    line('chat', 'I came out to fetch something... what was it? No matter. It will come back to me. The flame will wait with me.', '我出来是要取什么东西的……是什么来着？不要紧，等它自己回到我心里吧。圣火会陪我一起等。'),
    line('chat', 'Lina says she needs no one. So I never latch the chapel door at night; that way, she never has to ask.', '莉娜总说她谁也不需要。所以我每晚都不闩礼拜堂的门——这样，她就不必开口了。'),
    line('chat', 'Every morning I give thanks that the night is over. Even when it was not a hard one. He did not choose which night to suffer.', '每天清晨，我都为黑夜过去而感恩。即便那一夜并不难熬。他承受苦难的时候，并没有挑选哪一夜。'),
    line('chat', "Oskar's knees ache before rain, and he won't say so. I leave a warm stone at his door. He thinks it's Marta.", '奥斯卡的膝盖一到下雨前就疼，可他不肯说。我在他门口放一块焐热的石头。他以为是玛尔塔放的。'),
    line('chat', 'Nessa reads until her candle is gone. I bring her a new one and pretend I was only passing.', '奈莎总是读书读到蜡烛熬尽。我给她送一支新的去，假装只是路过。'),
    line('chat', 'Pell draws the road east, over and over. It is the way his father went. I keep every drawing he gives me.', '佩尔一遍遍地画往东的路。他父亲就是往那边去的。他送我的每一张画，我都好好收着。'),
    line('chat', 'Some mornings there is dawnbloom on the altar before I get there. Astra has a friend who picks flowers very early, and very quietly.', '有些清晨，我还没到，祭坛上就已经放着晨光花了。阿斯特拉有一位朋友，采花采得很早，也很安静。', { mood: 'happy' }),
    line('favourite', "I'm a little ashamed to say it, but even a nun has a fondness. Mine is {favourite}. ...Please keep it from Brother Anselm.", '说来惭愧，修女也有偏爱的东西。我的是{favourite}。……请替我向安塞姆修士保密。', { mood: 'shy' }),
    // the news the story spreads (its topics), said once while fresh
    line('topic:crown', 'We laid the crown beneath the altar. Nessa says it hums at night. So I sang it a hymn for sleeping. ...It does seem a little quieter.', '我们把荆棘冠安放在祭坛下了。奈莎说它夜里会嗡嗡作响。我便为它唱了一支安眠的圣歌。……它似乎真的安静了一些。'),
    line('greeting:first', 'Welcome to Firstlight, traveller. Your hands are cold; please, come closer. This flame was lit from the first dawn after the First Night, and it is glad to warm anyone who has come far.', '欢迎来到初原村，旅人。你的手很凉呢——请靠近些。这团火取自初夜之后的第一道晨光，它很乐意温暖远道而来的人。'),
    line('default', "Suffering is not God's abandonment. It is the proof the debt is being paid. That is what the Five teach us.", '苦难并非神的遗弃。苦难，是灾厄得以被偿还的证明。五苦是这样教导我们的。'),
    line('default', 'The flame is older than the houses. The houses were built to keep it company.', '火比房子还老。房子是为了陪它才盖起来的。'),
    line('hour:morning', 'Good morning. I have just thanked Astra that the night is over, and said one for you as well.', '早安。我刚感谢过阿斯特拉，让黑夜过去了——也为你感谢了一句。', { mood: 'happy' }),
    line('hour:evening', "The evenings come sooner. Every week I light the lamps a little earlier, and write each one down. ...Only I've forgotten which book I wrote them in.", '黄昏来得越来越早了。我每周都提早一些点灯，也都一一记下。……只是记在哪本册子里，我又忘了。'),
    line('hour:night', "It's very late. The flame keeps the night; you needn't. ...Sleep well, and come and see me tomorrow.", '已经很晚了。圣火会守夜，你不必守着。……好好睡吧，明天再来看看我。'),
    line('weather:rain', "You're soaked through. Stand by the flame a while; it doesn't mind sharing. I'll find you something dry.", '你都淋透了。在圣火边站一会儿吧——它不介意分一点暖。我去给你找件干的来。'),
    line('weather:storm', "On nights like this I count the doors I hear close. ...Go home early, will you? I'd like to count yours too.", '这样的夜里，我会数着听见关上的门。……早些回去好吗？我也想数到你的那一扇。', { mood: 'sad' }),
    line('fact:village.rescued', "Lina and Oskar are home safe. Thanks be to Astra, and to you. Tonight the whole village gives thanks at the flame. You will come, won't you? I'll keep you a seat near the fire.", '莉娜和奥斯卡平安回来了——感谢阿斯特拉，也感谢你。今晚全村会在圣火前感恩。你也会来吧？我替你留一个靠近炉火的位子。', { once: true, mood: 'happy' }),
    line('fact:village.rescued', "Lina once asked me, as if it were nothing, whether a prayer counts for someone no one visits. Every prayer counts. I didn't ask her for whom.", '莉娜有一次像是随口问我：没人去看的人，为她祈祷算不算数。每一句祈祷都算数。我没有问是为谁。', { once: true }),
    line('fact:ch1.flame_stolen', 'Some people take a thing to keep it.', '有些人拿走一样东西，是为了守住它。', { mood: 'sad' }),
    line('fact:ch1.flame_stolen', 'I still sweep the altar every morning, the taper still in my hand. ...My hands are slower than my heart to believe the flame is gone.', '我每天清晨还是去打扫祭坛，手里也还拿着点火棒。……手比心更不愿意相信，火已经不在了。', { mood: 'sad' }),
    line('fact:ch1.flame_stolen', "The way you stand reminds me of someone I knew. Shoulders always braced, as if the sky might fall at any moment. ...Do sit a while. I'll make tea.", '你站着的样子，很像我认识的一个人。肩膀总是绷着，好像天随时会塌下来。……请坐一会儿吧，我去沏茶。', { once: true }),
    line('fact:ch1.letter', 'Astra bore five sufferings so the sun would rise. The Seal-bearers carry them still. Go to the first of them, pilgrim. ...And before you set out, please, eat a proper meal.', '阿斯特拉承受了五苦，太阳才重新升起。持印者至今仍背负着它们。去找第一位吧，朝圣者。……出发之前，请务必好好吃一顿饭。'),
    line('fact:ch1.letter', 'I remember every pilgrim I have blessed by their footsteps. Please come back, so that I may hear yours again.', '我祝福过的每一位朝圣者，我都记得他们的脚步声。请一定回来，让我再听见你的。'),
    line('fact:ch1.crown', 'The Crown of Thorns, in our village. I never thought to see it. Keep it close to you, and far from your heart.', '荆棘冠，竟然到了我们村里。我从没想过能亲眼见到它。把它贴身收好——但别让它靠近你的心。', { once: true }),
    line('fact:ch1.end', 'He always did carry things that were too heavy for him.', '他从小就总是背着对他来说太重的东西。', { mood: 'sad' }),
    line('given', "Is this for me? ...Thank you. I'll set it by the altar first, so Astra may see it too, and quietly take it back tonight.", '这是给我的吗？……谢谢你。我先把它供在祭坛边，让阿斯特拉也看一看——晚上再悄悄取回来。', { mood: 'happy' }),
  ],
}
