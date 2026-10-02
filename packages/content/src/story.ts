// The first week in Hearthvale (docs/game-design.md §7): one thing opens each day — rest,
// the people, the slimes in Hollis's turnips, a fish for Tamsin, fireweed for Sera, the
// Threadbook, the Great Hearth, Hearth Night — and then the long project. Story state is a
// player prop (`quest`) and world facts, advanced only by ordinary rules: the story is data
// like everything else. Lines never teach mechanics; the HUD's hints do.

import type { Rule, Text } from '@lsw/engine'

const L = (en: string, zh: string): Text => ({ en, zh })

/** Objective shown in the HUD for each value of the player's `quest` prop. */
export const OBJECTIVES: Record<number, { title: Text; hint: Text }> = {
  0: {
    title: L('Rest in your cottage', '回小屋休息'),
    hint: L('The cottage is on the homestead, west of town. Walk up to the bed and press E.', '小屋在镇子西边的老宅里。走到床边按 E。'),
  },
  1: {
    title: L('Meet the people of Hearthvale', '认识炉谷的人们'),
    hint: L('Say hello around town (E) — the square, the inn, the farm, the pond. Clear a little of your land, too.', '在镇上打个招呼（E）——广场、旅店、农场、池塘。也清一清你的地。'),
  },
  2: {
    title: L("Drive the slimes out of Hollis's turnips (0/3)", '把霍利斯萝卜地里的史莱姆赶走（0/3）'),
    hint: L('Brann keeps a practice blade at the smithy. Hold it (1–9) and strike with Space.', '布兰的铁匠铺里有把练习剑。拿在手上（1–9），按空格出击。'),
  },
  3: {
    title: L('Tamsin wanted a word', '塔姆辛有话想说'),
    hint: L('Tamsin cooks at the Hearth Inn, north-east of the square.', '塔姆辛在广场东北边的炉火旅店做饭。'),
  },
  4: {
    title: L('Catch a fish for Tamsin', '给塔姆辛钓条鱼'),
    hint: L('Old Fenn fishes at the pond in the south-east. He may lend you a rod.', '老芬在东南边的池塘钓鱼，他也许会借你一根鱼竿。'),
  },
  5: {
    title: L('Catch a fish for Tamsin', '给塔姆辛钓条鱼'),
    hint: L('Hold the rod, face the water and press E. Give the fish to Tamsin with G.', '拿着鱼竿面朝水面按 E。用 G 把鱼交给塔姆辛。'),
  },
  6: {
    title: L('Sera could use a hand', '塞拉需要帮忙'),
    hint: L("Sera's cottage is at the woods' edge, south of the square.", '塞拉的小屋在广场南边的林子边上。'),
  },
  7: {
    title: L('Bring Sera fireweed from Whisperwood', '从低语森林给塞拉带火草'),
    hint: L('Fireweed grows in the burnt clearing, south of the gate. Give it to Sera with G.', '火草长在南门外林中被烧过的空地上。用 G 交给塞拉。'),
  },
  8: {
    title: L('Mira asked to see you', '米拉想见你'),
    hint: L("Mira works at her desk in the elder's house, north of the square.", '米拉在广场北边的村长家，在她的书桌前。'),
  },
  9: {
    title: L('Ask Maren about the Great Hearth', '问问玛伦大炉火的事'),
    hint: L('Maren keeps the Hearth. She is often on the square by day.', '玛伦守着大炉火，白天常在广场上。'),
  },
  10: {
    title: L('Hearth Night at the inn', '去旅店过炉火之夜'),
    hint: L('Every Hearthday, from six in the evening, the village gathers at the Hearth Inn.', '每逢炉日傍晚六点起，全村人都聚在炉火旅店。'),
  },
  11: {
    title: L('Rekindle the Great Hearth', '重燃大炉火'),
    hint: L('Four kindlings: of the field, the water, the wood and the stone. Try anything — what the valley has never seen, Mira writes in the Threadbook (B).', '四份引火之物：田、水、林、石。什么都可以试——山谷从没见过的事，米拉会记进织线簿（B）。'),
  },
}

const quest = (n: number) => ({ quest: n })
const talk = (id: string, stage: number): Rule['when'] => ({
  verb: ['interact'],
  actor: { player: true, props: quest(stage) },
  target: { id },
  instrument: { none: true },
})
/** The player gives a person something of a kind (G), at a stage of the story. */
const give = (id: string, stage: number, type: string): Rule['when'] => ({
  verb: ['put'],
  actor: { player: true, props: quest(stage) },
  target: { id },
  instrument: { type },
})

const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })
const say = (en: string, zh: string) => ({ op: 'say' as const, who: 'target' as const, text: L(en, zh) })
const stage = (n: number) => ({ op: 'setProp' as const, of: 'actor' as const, key: 'quest', value: n })

export const STORY_RULES: Rule[] = [
  // ---- the first night
  story({
    id: 'story/first-sleep',
    doc: 'The first night in the cottage: the week begins.',
    on: 'interaction',
    compose: true,
    when: { verb: ['interact'], actor: { player: true, props: quest(0) }, target: { type: 'fixture/furniture/bed' }, instrument: { none: true } },
    do: [stage(1)],
  }),

  // ---- the slimes in Hollis's turnips (from the third day)
  story({
    id: 'story/hollis-slimes',
    doc: "Hollis asks for help with the slimes in his turnips.",
    on: 'interaction',
    when: talk('npc.hollis', 1),
    guard: { calendar: { day: { gte: 3 } } },
    do: [
      say("You. The new one. Slimes in my turnips again — three of the beggars. I'd do it myself but my knees say no. Brann's got a practice blade; tell him I sent you.", '你，新来的。萝卜地里又进史莱姆了——三只。我自己来，可膝盖不答应。布兰那儿有把练习剑，就说是我让你去的。'),
      stage(2),
      { op: 'befriend', who: 'target', amount: 20 },
    ],
  }),
  story({
    id: 'story/slime-count',
    doc: 'Count slimes the player defeats.',
    on: 'defeat',
    compose: true,
    when: { target: { type: 'actor/creature/slime' }, actor: { player: true } },
    do: [{ op: 'addProp', of: 'actor', key: 'slimes', delta: 1 }],
  }),
  story({
    id: 'story/slimes-done',
    doc: 'The third slime on the turnip errand: the field is quiet; Hollis will write.',
    on: 'defeat',
    compose: true,
    when: { target: { type: 'actor/creature/slime' }, actor: { player: true, props: quest(2) } },
    guard: { prop: { role: 'actor', key: 'slimes', cmp: { gte: 2 } } },
    do: [
      stage(3),
      { op: 'setFact', key: 'slimes.driven', value: 1 },
      { op: 'topic', id: 'slimes_driven' },
      { op: 'addProp', of: 'actor', key: 'friend.npc.hollis', delta: 60 },
      { op: 'log', text: L("The turnip rows are quiet. Somewhere, Hollis grunts approvingly.", '萝卜地安静了。不知哪儿传来霍利斯满意的一声哼。') },
    ],
  }),

  // ---- a fish for Tamsin
  story({
    id: 'story/tamsin-fish',
    doc: 'Tamsin needs a fish for supper.',
    on: 'interaction',
    when: talk('npc.tamsin', 3),
    do: [
      say("There you are! I've a pot of stew and no fish to put in it, and Lio's useless with a line. Fenn at the pond has rods enough for a navy — ask him nicely.", '你来啦！我这儿一锅炖菜，就差条鱼，里奥钓鱼又不在行。池塘边的老芬鱼竿多得能装备一支船队——客气点问他借。'),
      stage(4),
    ],
  }),
  story({
    id: 'story/fenn-rod',
    doc: 'Fenn lends the player a rod.',
    on: 'interaction',
    when: talk('npc.fenn', 4),
    do: [
      say("A rod for Tamsin's pot? Ha. Take this one — it's caught bigger fish than you. Face the water, be patient, and don't talk to the fish. They hate that.", '给塔姆辛的锅借鱼竿？哈。拿这根去——它钓过比你还大的鱼。面朝水，有点耐心，别跟鱼说话，它们最烦这个。'),
      { op: 'spawn', type: 'item/tool/fishing_rod', at: 'actor', into: 'contents' },
      stage(5),
    ],
  }),
  ...[4, 5].flatMap((n) =>
    ['item/food/fish/raw', 'item/food/fish/cooked'].map((type) =>
      story({
        id: `story/tamsin-fish-given-${n}-${type.endsWith('raw') ? 'raw' : 'cooked'}`,
        doc: 'The fish reaches the stew.',
        on: 'interaction',
        when: give('npc.tamsin', n, type),
        do: [
          { op: 'destroy', of: 'instrument' },
          say("Oh, that's a beauty! Into the pot with you. Here — a slice of pie, and don't tell Lio there was any left.", '哇，好漂亮的鱼！进锅吧你。来——一块馅饼，别告诉里奥还剩了。'),
          { op: 'spawn', type: 'item/food/pie', at: 'actor', into: 'contents' },
          { op: 'befriend', who: 'target', amount: 80 },
          stage(6),
        ],
      }),
    ),
  ),

  // ---- fireweed for Sera
  story({
    id: 'story/sera-fireweed',
    doc: 'Sera needs fireweed from the burnt clearing.',
    on: 'interaction',
    when: talk('npc.sera', 6),
    do: [
      say("I need fireweed for a salve, and it only grows where the woods have burned — the clearing off the south road. It's wet out; the woods won't catch today, if that's what worries you.", '我做药膏需要火草，它只长在林子烧过的地方——南边路旁那片空地。外面湿，今天林子烧不起来，要是你担心这个的话。'),
      stage(7),
    ],
  }),
  story({
    id: 'story/sera-fireweed-given',
    doc: 'Fireweed for the salve.',
    on: 'interaction',
    when: give('npc.sera', 7, 'item/material/fireweed'),
    do: [
      { op: 'destroy', of: 'instrument' },
      say('That\'s the one. Thank you. Take this — for cuts. You\'ll get some, out there.', '就是这个。谢谢。拿着——治伤口的。你在外面总会挂彩。'),
      { op: 'spawn', type: 'item/potion/healing', at: 'actor', into: 'contents', count: 2 },
      { op: 'befriend', who: 'target', amount: 80 },
      stage(8),
    ],
  }),

  // ---- the Threadbook
  story({
    id: 'story/mira-threadbook',
    doc: 'Mira shows the player the Threadbook.',
    on: 'interaction',
    when: talk('npc.mira', 8),
    do: [
      say('This is the Threadbook. Whenever the valley does something it has never done before, a new line appears in it — in no hand I know. Some of these are yours. Keep trying odd things. I want to see what it writes next.', '这是织线簿。每当山谷做了一件从没做过的事，书里就会多出一行字——不是我认得的任何人的笔迹。有几行是你的。继续去试些古怪的事吧，我想看看它下一句写什么。'),
      { op: 'befriend', who: 'target', amount: 40 },
      stage(9),
    ],
  }),

  // ---- the Great Hearth and the four kindlings
  story({
    id: 'story/maren-kindlings',
    doc: 'Maren tells of the four kindlings.',
    on: 'interaction',
    when: talk('npc.maren', 9),
    do: [
      say("The Hearth won't take a spark from flint. It never did. It was lit with four kindlings — one from the field, one from the water, one from the wood, one from the stone. The valley gave them; the valley can give them again. I'm too old to gather them. You aren't.", '大炉火不认燧石的火星，从来不认。它是用四份引火之物点着的——田里一份，水里一份，林里一份，石里一份。是山谷给的，山谷还能再给。我老了，收不齐了。你还年轻。'),
      { op: 'setFact', key: 'kindlings.told', value: 1 },
      { op: 'setFact', key: 'hearth.stage', value: 0 },
      { op: 'befriend', who: 'target', amount: 40 },
      stage(10),
    ],
  }),

  // ---- the Slime King of the Hollow (for the bold)
  story({
    id: 'story/king-down',
    doc: 'Defeating the Slime King.',
    on: 'defeat',
    compose: true,
    when: { target: { type: 'actor/creature/slime/king_slime' } },
    do: [
      { op: 'vfx', at: 'tileOf:target', fx: 'explosion' },
      { op: 'log', text: L('The Slime King bursts into a shower of goo!', '史莱姆王炸成了一滩黏液！') },
      { op: 'spawn', type: 'item/gem', at: 'tileOf:target' },
      { op: 'topic', id: 'king_defeated', days: 6 },
      { op: 'setFact', key: 'king.defeated', value: 1 },
    ],
  }),
]
