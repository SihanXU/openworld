// The Held Ground (誓守之地, docs/chapter-1.md §12): the White Knight's kingdom, kept in a single thorn. Felled, freed of
// the crown, Alberic keeps his vow another way — "I will hold until I am relieved": he gives the one who relieved him the
// Oath-Thorn, and holds for them a place they carry. Used on oneself it takes one there and back. It is the player's camp:
// build a home, farm, keep animals. Alberic, its steward, grows it three ways (his talk's "The Held Ground…", the haven
// panel): the LAND (rings of mist lifted: the story's `haven.size`), new GROUNDS (places of their own beyond a way he
// opens: a quarry, a timberland, a lake, hot springs — `haven.zone.<id>`), and BUILDINGS (a plot staked out at the
// heart that becomes a workshop, a storehouse… — `haven.build.<id>`; a building's `recipes` are made anywhere once it
// stands, the crafting panel's `unlockedBy`). What each asks is handed to him into the ground's stock
// (`haven.stock.<type>`, kept on him, copied to the story for the panel); built, it is taken from there.

import type { Cond, Effect, Rule, Text, Tree } from '@openworld/engine'

const L = (en: string, zh: string): Text => ({ en, zh })
/** Words in both languages, kept as such (to be quoted into others). */
const W = (en: string, zh: string) => ({ en, zh })

/** The Held Ground's map and its places. */
export const HAVEN = {
  map: 'haven',
  w: 48,
  h: 40,
  /** the planted sword at its heart, and where one arrives (just below it) */
  heart: [24, 19] as const,
  arrive: [24, 22] as const,
  /** the rings of mist round the heart (cells from it): the first widening lifts the first, and so on */
  rings: [8.5, 12.5, 16.5] as const,
} as const

/** One way the Held Ground grows. */
export interface HavenUpgrade {
  id: string
  track: 'land' | 'zone' | 'building'
  name: Text
  /** What it opens or gives. */
  unlocks: Text[]
  needs: { type: string; count: number; text: Text }[]
  /** The land it needs first (haven.size at least). */
  land: number
  /** The fact it sets, and to what. */
  fact: string
  value: number
  coins: number
  /** What Alberic says as it is done. */
  done: { en: string; zh: string }
  /** A ground: its map, and where one comes into it. */
  map?: string
  at?: [number, number]
  /** A building: the plot staked out for it at the heart, and what it becomes. */
  plot?: [number, number]
  becomes?: string
  /**
   * The recipes it unlocks (their ids; recipes.ts sets their `unlockedBy` to its fact at its value): a hands recipe is made
   * anywhere from then on, a station's at its station. A building's later levels are upgrades of the same fact (value 2,
   * 3…), each after the one before.
   */
  recipes?: string[]
  /** A status it is built with (the hearth lit, the storehouse open). */
  status?: string
}

const n = (type: string, count: number, en: string, zh: string) => ({ type, count, text: L(en, zh) })
const LOG = 'item/material/log'
const STONE = 'item/material/stone'
const PLANK = 'item/material/plank'
const CLOTH = 'item/material/cloth'

export const HAVEN_UPGRADES: HavenUpgrade[] = [
  // the land: the rings of mist, one after another
  { id: 'land1', track: 'land', name: L('The Grove', '林地'), land: 0, fact: 'haven.size', value: 1, coins: 20,
    unlocks: [L('The first ring of mist lifts', '第一圈迷雾散去'), L('A grove of young trees, loose stone', '一片小树林和散落的石块'), L('Room to build round the sword', '长剑周围更多空地')],
    needs: [n(LOG, 10, 'Logs', '木头'), n(STONE, 10, 'Stones', '石块')],
    done: W('There. Do you see how far it goes now? A knight is only as wide as what he holds.', '好了。看见它现在延伸到多远了吗？一个骑士的分量，就是他守住的那片土地。') },
  { id: 'land2', track: 'land', name: L('The Meadow', '草甸'), land: 1, fact: 'haven.size', value: 2, coins: 40,
    unlocks: [L('The second ring of mist lifts', '第二圈迷雾散去'), L('A flowering meadow and water', '开花的草甸和水边'), L('Ground enough for a hall', '足够盖厅堂的土地')],
    needs: [n(PLANK, 20, 'Planks', '木板'), n('item/material/iron_ore', 5, 'Iron ore', '铁矿石')],
    done: W('More ground. I remember fields like this, once. Whose they were, I do not.', '又多了一片地。我记得从前也有过这样的田野。是谁的，我想不起来了。') },
  { id: 'land3', track: 'land', name: L('The Old Bounds', '古老界石'), land: 2, fact: 'haven.size', value: 3, coins: 60,
    unlocks: [L('The last ring of mist lifts', '最后一圈迷雾散去'), L('The old boundary stones, iron in the rock', '古老界石，岩石里的铁矿脉'), L('The whole of the ground', '整片土地')],
    needs: [n(PLANK, 30, 'Planks', '木板'), n(STONE, 30, 'Stones', '石块'), n('item/material/gold_ore', 3, 'Gold ore', '金矿石')],
    done: W('That is all the ground there is. ...It is more than I held before. And nobody kneels here.', '这就是全部的土地了。……比我从前守的还要多。而且在这里，没有人下跪。') },
  // new grounds: places of their own, each with what its ground is good for
  { id: 'quarry', track: 'zone', name: L('The Quarry', '采石场'), land: 1, fact: 'haven.zone.quarry', value: 1, coins: 0, map: 'haven.quarry', at: [16, 18],
    unlocks: [L('Boulders to break for stone', '可以凿开的巨石'), L('Iron and coal veins, and one of gold', '铁矿脉、煤矿脉和一处金矿脉'), L('Stone underfoot that comes back', '地上会重新冒出石块')],
    needs: [n(PLANK, 15, 'Planks', '木板'), n(STONE, 10, 'Stones', '石块')],
    done: W('There was a quarry under the mist. Every kingdom has one; it is where its walls come from.', '迷雾底下原来有个采石场。每个王国都有一个；城墙就是从那里来的。') },
  { id: 'timber', track: 'zone', name: L('The Timberland', '林场'), land: 1, fact: 'haven.zone.timber', value: 1, coins: 0, map: 'haven.timber', at: [16, 18],
    unlocks: [L('Dense woods to fell, that grow back', '能砍、也会长回来的密林'), L('Mushrooms and berries under the trees', '树下的蘑菇和浆果'), L('Sticks and grass on the ground', '地上的树枝和干草')],
    needs: [n(LOG, 15, 'Logs', '木头'), n(STONE, 5, 'Stones', '石块')],
    done: W('Trees. Old ones. They were here before the crown, and they will be here after me.', '树。老树。荆棘冠出现之前它们就在这儿，我走了以后它们也还在。') },
  { id: 'lake', track: 'zone', name: L('The Lakeside', '湖畔'), land: 2, fact: 'haven.zone.lake', value: 1, coins: 0, map: 'haven.lake', at: [16, 18],
    unlocks: [L('A deep lake with pike, eels and carp', '一片深湖，有狗鱼、鳗鱼和鲤鱼'), L('Reeds and sand along the shore', '岸边的芦苇和沙滩'), L('Water for the fields', '浇地的水')],
    needs: [n(STONE, 20, 'Stones', '石块'), n(PLANK, 10, 'Planks', '木板')],
    done: W('Listen. Water. I had forgotten the sound of it with nobody kneeling beside it.', '听。是水声。没有人跪在它旁边时的水声，我都忘了。') },
  { id: 'springs', track: 'zone', name: L('The Hot Springs', '温泉谷'), land: 3, fact: 'haven.zone.springs', value: 1, coins: 0, map: 'haven.springs', at: [16, 18],
    unlocks: [L('Warm springs that mend whoever soaks in them', '泡进去就能疗伤的温泉'), L('Herbs and frostcap on the slopes', '山坡上的草药和霜盖菇'), L('A quiet place at the edge of the ground', '领地边缘一处安静的地方')],
    needs: [n(STONE, 25, 'Stones', '石块'), n('item/material/iron_ingot', 2, 'Iron ingots', '铁锭')],
    done: W('Warm water out of cold rock. Sit in it a while. I will keep watch.', '冷石头里流出来的暖水。去泡一会儿吧。我来守着。') },
  // buildings: a plot staked out at the heart, built into what the ground needs
  { id: 'workshop', track: 'building', name: L('Workshop', '工坊'), land: 0, fact: 'haven.build.workshop', value: 1, coins: 0, plot: [18, 18], becomes: 'fixture/craft/workbench',
    recipes: ['item/weapon/blunt/club', 'item/armor/shield', 'item/weapon/ranged/bow'],
    unlocks: [L('Recipes: a club, a shield and a bow, made anywhere from the bag', '解锁配方：棍棒、盾牌、弓，随时随地在背包里做'), L('Can be raised to Workshop II', '可以升级为工坊 II')],
    needs: [n(LOG, 8, 'Logs', '木头'), n(STONE, 4, 'Stones', '石块')],
    done: W('A bench, and room to work at it. Make what you need; I will not ask what it is for.', '一张工作台，还有干活的地方。需要什么就做什么；我不会问做来干什么。') },
  { id: 'workshop2', track: 'building', name: L('Workshop II', '工坊 II'), land: 1, fact: 'haven.build.workshop', value: 2, coins: 0,
    recipes: ['craft/candle', 'craft/lantern', 'smith/forge', 'ranch/bee-box'],
    unlocks: [L('The workshop, better tooled: candles and lanterns', '工坊添置了工具：能做蜡烛和提灯'), L('A smith\'s own forge, for a Forge Builder; a bee box, for an Apiarist', '筑炉者可以做铁匠炉；蜂农可以做蜂箱')],
    needs: [n(PLANK, 16, 'Planks', '木板'), n('item/material/iron_ingot', 4, 'Iron ingots', '铁锭')],
    done: W('Iron on the bench now, and a better light to work by. A craftsman\'s room, nearly.', '台子上有了铁件，干活也有了更亮的灯。差不多算个匠人的屋子了。') },
  // the smithy: the knight's forge and anvil, bettered — what a smith with the skill may forge there grows with it
  { id: 'smithy1', track: 'building', name: L('Smithy: Bellows', '铁匠铺·风箱'), land: 1, fact: 'haven.build.smithy', value: 1, coins: 0,
    unlocks: [L('The forge blows hotter: a smith who knows them forges heavy arms, plate, metal tools and jewellery at any anvil', '炉火更旺：学了对应技能的铁匠能在铁砧上打战锤、戟、板甲、金属工具和首饰')],
    needs: [n('item/material/leather', 4, 'Leather', '皮革'), n(PLANK, 8, 'Planks', '木板'), n('item/material/iron_ingot', 3, 'Iron ingots', '铁锭')],
    done: W('A bellows. My father had one like it. The fire answers it as it answered him.', '一架风箱。我父亲也有一架。炉火听它的，就像从前听我父亲的。') },
  { id: 'smithy2', track: 'building', name: L('Smithy: Hardened Anvil', '铁匠铺·淬硬铁砧'), land: 2, fact: 'haven.build.smithy', value: 2, coins: 0,
    unlocks: [L('An anvil that takes the finest work: the professions\' sets are forged at any anvil', '能承受最精细的活计：职业套装可以在铁砧上锻造了')],
    needs: [n('item/material/steel_bar', 2, 'Steel bars', '钢条'), n(STONE, 12, 'Stones', '石块'), n('item/material/coal', 6, 'Coal', '煤炭')],
    done: W('Steel over iron. Now it will take a blow without giving. Make something worth the anvil.', '铁上包了钢。现在它受得住重锤而不塌陷了。打点配得上这座砧的东西吧。') },
  // the arcane workshop: a table of its own at the heart, for wands, staves, draughts and the spell books a mage reads
  { id: 'arcane', track: 'building', name: L('Arcane Workshop', '魔法工坊'), land: 1, fact: 'haven.build.arcane', value: 1, coins: 0, plot: [29, 23], becomes: 'fixture/craft/arcane',
    unlocks: [L('An arcane workbench: wands and staves (a mage\'s), healing and fireproof draughts', '一张魔法工作台：做魔杖、法杖（法师专用）、治疗药水和防火药剂'), L('Spell books that teach a mage\'s first spells', '写法术书，教法师的入门法术'), L('Can be raised to Arcane Workshop II', '可以升级为魔法工坊 II')],
    needs: [n(PLANK, 12, 'Planks', '木板'), n(CLOTH, 4, 'Cloth', '布'), n('item/gem', 2, 'Gems', '宝石')],
    done: W('I never trusted the arcane. But the order kept a mage, and we were glad of her more than once. Use it well.', '我从来不信奥术。可骑士团养着一位法师，我们不止一次庆幸有她在。好好用吧。') },
  { id: 'arcane2', track: 'building', name: L('Arcane Workshop II', '魔法工坊 II'), land: 2, fact: 'haven.build.arcane', value: 2, coins: 0,
    unlocks: [L('Staves that carry fire or frost', '能做带火焰、冰霜元素的法杖'), L('Spell books of the deeper spells: frost bolt, thunderstorm, meteor', '写更深的法术书：寒冰箭、雷暴、陨星')],
    needs: [n('item/gem', 4, 'Gems', '宝石'), n('item/material/frostcap', 4, 'Frostcap', '霜盖菇'), n('item/material/fireweed', 4, 'Fireweed', '火绒草'), n('item/material/gold_ingot', 2, 'Gold ingots', '金锭')],
    done: W('Frost and fire on one table, and neither has burnt it down. Whatever you learn here, keep it pointed away from the tents.', '冰与火摆在同一张桌上，居然没把它烧掉。不管你在这儿学到什么，别冲着帐篷放。') },
  { id: 'kitchen', track: 'building', name: L('Kitchen Hearth', '厨房灶台'), land: 0, fact: 'haven.build.kitchen', value: 1, coins: 0, plot: [22, 25], becomes: 'fixture/light/campfire', status: 'lit',
    unlocks: [L('A hearth that is always lit: cook what you catch and grow', '一直燃着的灶台：做你钓到、种出的东西')],
    needs: [n(STONE, 10, 'Stones', '石块'), n(LOG, 4, 'Logs', '木头')],
    done: W('A fire that stays lit. Eat. A steward who lets his lord starve is no steward.', '一堆不会灭的火。吃点东西吧。让主人挨饿的管家，算不上管家。') },
  { id: 'storehouse', track: 'building', name: L('Storehouse', '储物棚'), land: 1, fact: 'haven.build.storehouse', value: 1, coins: 0, plot: [24, 25], becomes: 'fixture/container/storehouse', status: 'open',
    unlocks: [L('A storehouse of forty places for what you keep', '一个四十格的储物棚，放你攒下的东西')],
    needs: [n(PLANK, 12, 'Planks', '木板'), n(LOG, 6, 'Logs', '木头')],
    done: W('Walls and a roof for what you keep. Nothing in it will be taken; I sleep lightly.', '给你的东西搭了墙和顶。里面的东西不会丢；我睡得很浅。') },
  { id: 'loom', track: 'building', name: L('Weaving Shed', '织坊'), land: 1, fact: 'haven.build.loom', value: 1, coins: 0, plot: [26, 25], becomes: 'fixture/craft/loom',
    recipes: ['weave/cloth', 'leather/gloves', 'leather/boots', 'leather/helmet', 'leather/pauldrons', 'leather/breastplate'],
    unlocks: [L('Recipes: cloth from grass, made anywhere from the bag', '解锁配方：干草织布，随时随地在背包里做'), L('Leather gloves, boots, a helmet, pauldrons and a breastplate, for a Leatherworker', '皮匠可以做皮手套、皮靴、皮头盔、皮护肩和皮胸甲')],
    needs: [n(PLANK, 8, 'Planks', '木板'), n('item/material/stick', 6, 'Sticks', '树枝')],
    done: W('A loom. Someone used to weave the order\'s banners. I do not remember who. It does not matter now.', '一架织布机。从前有人给骑士团织旗帜。我记不得是谁了。现在也不要紧了。') },
  // residents' tents (content social.ts residence): two beds each, for people asked to come and live here
  { id: 'lodge1', track: 'building', name: L("Residents' Tent", '居民营帐'), land: 1, fact: 'haven.build.lodge1', value: 1, coins: 30, plot: [31, 14], becomes: 'fixture/tent',
    unlocks: [L('Two more beds: two more people may come and live here', '多两个床位：可以再请两个人搬来住')],
    needs: [n(CLOTH, 6, 'Cloth', '布'), n(PLANK, 10, 'Planks', '木板')],
    done: W('A tent with two cots in it. A knight once had a hundred men under canvas. Two will do, to begin with.', '一顶营帐，两张行军床。从前一个骑士的帐篷下能睡一百个人。先从两个开始吧。') },
  { id: 'lodge2', track: 'building', name: L("Second Residents' Tent", '第二座居民营帐'), land: 1, fact: 'haven.build.lodge2', value: 1, coins: 50, plot: [34, 21], becomes: 'fixture/tent',
    unlocks: [L('Two more beds', '再多两个床位')],
    needs: [n(CLOTH, 8, 'Cloth', '布'), n(PLANK, 14, 'Planks', '木板'), n(LOG, 6, 'Logs', '木头')],
    done: W('Voices at the fire of an evening. I had forgotten that, too.', '傍晚火堆边有人说话。这个我也差点忘了。') },
  { id: 'lodge3', track: 'building', name: L("Third Residents' Tent", '第三座居民营帐'), land: 2, fact: 'haven.build.lodge3', value: 1, coins: 80, plot: [16, 12], becomes: 'fixture/tent',
    unlocks: [L('Two more beds: seven in all', '再多两个床位：一共七个')],
    needs: [n(CLOTH, 10, 'Cloth', '布'), n(PLANK, 18, 'Planks', '木板'), n('item/material/iron_ingot', 2, 'Iron ingots', '铁锭')],
    done: W('A village, nearly. Nobody kneels in it.', '都快成一个村子了。在这里，没人下跪。') },
  { id: 'apothecary', track: 'building', name: L('Apothecary', '药房'), land: 2, fact: 'haven.build.apothecary', value: 1, coins: 0, plot: [18, 16], becomes: 'fixture/craft/cauldron',
    unlocks: [L('A cauldron for brewing', '一口熬药的坩埚')],
    needs: [n(STONE, 8, 'Stones', '石块'), n('item/material/herb', 6, 'Herbs', '草药')],
    done: W('A pot for remedies. I have been wounded enough times to know which ones work.', '一口熬药的锅。我受过的伤够多，知道哪些药管用。') },
]

/** What a building's recipes wait for (a type's or a recipe's `unlockedBy`): the fact that stands for it, at its level, and its name. */
export const unlockedBy = (id: string): { fact: string; name: Text; level?: number } => {
  const u = HAVEN_UPGRADES.find((x) => x.id === id)
  if (!u) throw new Error(`no upgrade of the Held Ground is "${id}"`)
  return { fact: u.fact, name: u.name, ...(u.value > 1 && { level: u.value }) }
}

/** Every kind of thing an upgrade asks for: what the steward takes into the ground's stock. */
export const HAVEN_MATERIALS = [...new Set(HAVEN_UPGRADES.flatMap((u) => u.needs.map((x) => x.type)))]
/** The ground's stock of one thing (on the steward; the story keeps a copy under `haven.` for the panel). */
export const stockKey = (type: string) => `haven.stock.${type}`
/** The steward of the Held Ground (his talk's "The Held Ground…"). */
export const HAVEN_STEWARD = { type: 'actor/person/steward', tag: 'haven-steward' } as const

const STEWARD = { type: HAVEN_STEWARD.type, tags: [HAVEN_STEWARD.tag] }
const param = (key: string, value: string): Cond => ({ param: { key, cmp: value } })
const storyAtLeast = (key: string, v: number): Cond => ({ prop: { role: 'story', key, cmp: { gte: v }, default: 0 } })
const hostAtLeast = (key: string, v: number): Cond => ({ prop: { role: 'host', key, cmp: { gte: v }, default: 0 } })
const logLine = (en: string, zh: string): Effect => ({ op: 'log', text: L(en, zh) })
/** The story keeps a copy of a count the steward keeps (for the panel). */
const copy = (key: string): Effect => ({ op: 'emit', impulse: 'notify', to: 'story', params: { what: 'facts', [`fact.${key}`]: { prop: key, of: 'host' } } })

/** Something handed to the steward: what an upgrade asks for goes into the ground's stock (the thing itself is used up). */
const HANDED: Tree = HAVEN_MATERIALS.reduceRight<Tree>(
  (rest, type) => ({
    if: { is: { role: 'item', sel: { type } } },
    then: {
      do: [
        { op: 'addProp', key: stockKey(type), delta: 1 },
        copy(stockKey(type)),
        { op: 'emit', impulse: 'notify', to: 'item', params: { what: 'consumed' } },
      ],
      label: L('Hand {instrument} to the ground\'s stock', '把{instrument}放进领地库存'),
    },
    else: rest,
  }),
  'inherit',
)

/** An upgrade asked for: built if its land is reached, it is not built yet, and the stock holds all it asks. */
const BUILD: Tree = HAVEN_UPGRADES.reduceRight<Tree>((rest, u) => {
  const ready: Cond = {
    all: [
      storyAtLeast('haven.size', u.land),
      { not: storyAtLeast(u.fact, u.value) },
      // the land's rings one after another, and a building's levels (Workshop II after the Workshop)
      ...(u.value > 1 ? [{ prop: { role: 'story', key: u.fact, cmp: u.value - 1, default: 0 } } as Cond] : []),
      ...u.needs.map((x) => hostAtLeast(stockKey(x.type), x.count)),
    ],
  }
  const build: Effect[] = [
    ...u.needs.flatMap((x): Effect[] => [{ op: 'addProp', key: stockKey(x.type), delta: -x.count }, copy(stockKey(x.type))]),
    { op: 'emit', impulse: 'notify', to: 'story', params: { what: 'facts', [`fact.${u.fact}`]: u.value } },
    ...(u.coins ? [{ op: 'spawn', type: 'item/misc/thornmark', at: 'actor', into: 'contents', count: u.coins } as Effect] : []),
    { op: 'say', text: L(u.done.en, u.done.zh) },
  ]
  return {
    if: param('choice', `build:${u.id}`),
    then: { if: ready, then: { do: build }, else: { do: [logLine('Not yet: the stock does not hold all of it, or the ground is not ready for it.', '还不行：库存的材料不够，或者领地还没到这一步。')] } },
    else: rest,
  }
}, 'inherit')

/** A ground opened, gone to: the steward sends one there (and a way at its edge leads back). */
const GO: Tree = HAVEN_UPGRADES.filter((u) => u.map).reduceRight<Tree>(
  (rest, u) => ({
    if: param('choice', `go:${u.id}`),
    then: { if: storyAtLeast(u.fact, u.value), then: { do: [{ op: 'emit', impulse: 'push', to: 'actor', params: { map: u.map!, x: u.at![0], y: u.at![1] } }] }, else: { do: [logLine('That ground is still under the mist.', '那片地方还在迷雾里。')] } },
    else: rest,
  }),
  'inherit',
)

const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })

/** A bare hand at a bank of mist points to its data-defined land upgrade. */
const mistText = (text: Text, language: 'en' | 'zh') => typeof text === 'string' ? text : text[language] ?? text.en
const MIST_GUIDANCE: Tree = HAVEN_UPGRADES.filter((u) => u.track === 'land').reduceRight<Tree>((rest, u) => {
  const materialsEn = u.needs.map((x) => `${x.count} ${mistText(x.text, 'en')}`).join(', ')
  const materialsZh = u.needs.map((x) => `${x.count}${mistText(x.text, 'zh')}`).join('、')
  const prerequisiteEn = u.land ? `Land level ≥ ${u.land}` : 'none'
  const prerequisiteZh = u.land ? `先完成第${u.land}圈扩建` : '无'
  return {
    if: { prop: { role: 'host', key: 'ring', cmp: u.value } },
    then: { do: [logLine(
      `Ring ${u.value} of mist. Find Alberic → The Held Ground… → Land → ${mistText(u.name, 'en')}. Prerequisite: ${prerequisiteEn}; materials: ${materialsEn}; completion reward: ${u.coins} Dawnmarks.`,
      `第${u.value}圈迷雾。找阿尔贝里克 → 领地扩建…… → 土地 → ${mistText(u.name, 'zh')}。前置：${prerequisiteZh}；材料：${materialsZh}；建成奖励：${u.coins}晨辉币。`,
    )] },
    else: rest,
  }
}, 'inherit')

const MIST_HANDS_ONLY: Cond[] = [
  { none: 'instrument' },
  ...['boon', 'say', 'choice', 'item', 'quest', 'topic'].map((key): Cond => ({ not: { param: { key, cmp: { ne: '' } } } })),
]

export const HAVEN_RULES: Rule[] = [
  story({
    id: 'haven/oath-thorn',
    label: L('Enter the Held Ground', '进入誓守之地'),
    doc: 'The Oath-Thorn used on oneself: one steps into the Held Ground (or, in it, back out where one stood) — told so, one goes oneself. Not in the middle of a fight: the thorn does not open while something is after one, nor take the fight in with one.',
    host: { type: 'item/relic/oath_thorn' },
    on: 'act/use',
    tree: {
      if: { same: ['actor', 'target'] },
      then: {
        if: { fighting: 'actor' },
        then: { do: [{ op: 'say', text: L('Not now — not with a fight on me.', '现在不行——还在战斗中。'), who: 'actor' }], label: L('Enter / leave the Held Ground', '进入 / 离开誓守之地') },
        else: { do: [{ op: 'emit', impulse: 'notify', to: 'actor', params: { what: 'pocket', map: HAVEN.map, x: HAVEN.arrive[0], y: HAVEN.arrive[1] } }], label: L('Enter / leave the Held Ground', '进入 / 离开誓守之地') },
      },
      else: 'inherit',
    },
  }),
  story({
    id: 'haven/steward',
    label: L('The Held Ground…', '领地扩建……'),
    doc: 'The steward spoken to about the ground (his talk\'s "The Held Ground…"): its panel (the land, its grounds, its buildings, the stock); asked to build one (choice build:<id>), he builds it from the stock if the land is ready for it and the stock holds all it asks; asked to go to a ground (choice go:<id>), he sends one there once it is opened.',
    host: STEWARD,
    on: 'impulse/handle',
    tree: { if: param('say', 'haven'), then: { if: { param: { key: 'choice', cmp: { ne: '' } } }, then: { if: { any: [...HAVEN_UPGRADES.map((u) => param('choice', `build:${u.id}`))] }, then: BUILD, else: GO }, else: { do: [{ op: 'panel', panel: 'haven' }] } }, else: 'inherit' },
  }),
  story({
    id: 'haven/stock',
    doc: 'Something handed to the steward that an upgrade of the ground asks for: it goes into the ground\'s stock (his count, the story\'s copy); anything else is a gift as to anyone.',
    host: STEWARD,
    on: 'impulse/offered',
    tree: { if: { none: 'item' }, then: 'inherit', else: HANDED },
  }),
  story({
    id: 'haven/consumed',
    doc: 'A thing told it is used up (handed into the Held Ground\'s stock): it is gone.',
    host: { type: 'item' },
    on: 'impulse/notify',
    tree: { if: param('what', 'consumed'), then: { do: [{ op: 'destroy' }] }, else: 'inherit' },
  }),
  story({
    id: 'haven/mist-guidance',
    doc: 'A bare hand on a ring of the Held Ground\'s mist points to its land upgrade in the steward\'s panel. Other handles, including uses of tools, remain unanswered.',
    host: { type: 'fixture/nature/mist' },
    on: 'impulse/handle',
    tree: { if: { all: MIST_HANDS_ONLY }, then: MIST_GUIDANCE, else: 'inherit' },
  }),
  // a building's plot at the heart: once built, it is what it was staked out for
  ...HAVEN_UPGRADES.filter((u) => u.plot).map((u) =>
    story({
      id: `haven/plot-${u.id}`,
      doc: `The plot staked out for the ${u.id}: once the steward has built it (${u.fact}), it becomes ${u.becomes}${u.status ? ` (${u.status})` : ''}.`,
      host: { type: `fixture/build/plot/${u.id}` },
      on: 'time/period',
      tree: { if: storyAtLeast(u.fact, u.value), then: { do: [{ op: 'transform', into: u.becomes! }, ...(u.status ? [{ op: 'addStatus', status: u.status } as Effect] : []), { op: 'vfx', fx: 'sparkle' }] }, else: { do: [] } },
    }),
  ),
  story({
    id: 'haven/mist-lifts',
    doc: 'A bank of mist at the Held Ground\'s edge looks now and then (its period) whether the ground has grown past it: when the story\'s haven.size reaches its ring, it lifts.',
    host: { type: 'fixture/nature/mist' },
    on: 'time/period',
    tree: { if: { prop: { role: 'story', key: 'haven.size', bounds: { gte: { prop: 'ring', of: 'host' } }, default: 0 } }, then: { do: [{ op: 'vfx', fx: 'poof' }, { op: 'destroy' }] }, else: { do: [] } },
  }),
]
