// The life branches of the skill tree, deeper (docs/skill-tree.md): gathering, agriculture, husbandry and smithing, twenty
// nodes each, and the content they work on that the world lacked — the smith's craft (ore smelted to ingots at a forge,
// ingots worked into weapons, armour, tools and jewellery on an anvil, after Stardew's furnace and Minecraft's smithing),
// a mushroom ring and reeds to forage, a beehive to take honey from, cheese from milk over a fire, feed from wheat,
// compost, leather gear, and what the stall buys of all of it.
//
// A life skill works the way the existing ones do: a number it grants (`grant`, read by a rule as an Amount — "this many
// more logs", `{ prop: 'fellLogs', of: 'actor' }`), or its tag a rule branches on (`skill:<id>`), or a recipe it teaches
// (`Recipe.skill`); a maker's craft and a seller's trade are stats a recipe reads (`craft:<station>`, `<station>:power`,
// `Recipe.bonus`). The rules that read them are in rules.ts and homestead.ts (felling, mining, fishing, tilling, watering,
// harvesting, feeding, milking, breeding) and here (what is new).

import type { Cond, Effect, Recipe, Rule, SkillDef, Text, Tree } from '@openworld/engine'
import { FORM_BY_ID, MATERIALS } from './items.ts'
import { waterCrop } from './farming.ts'

const L = (en: string, zh: string): Text => ({ en, zh })
const rule = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base' } })
const DO = (...effects: Effect[]): Tree => ({ do: effects })
const IF = (cond: Cond, then: Tree, otherwise?: Tree): Tree => ({ if: cond, then, ...(otherwise !== undefined && { else: otherwise }) })
const tag = (role: 'actor' | 'host' | 'instrument' | 'target', t: string): Cond => ({ has: { role, tag: t } })
const has = (role: 'host' | 'target', status: string): Cond => ({ has: { role, status } })
const param = (key: string, value: string): Cond => ({ param: { key, cmp: value } })
const log = (en: string, zh: string): Effect => ({ op: 'log', text: L(en, zh) })
const vfx = (fx: string, at?: 'tileOf:host' | 'actor'): Effect => ({ op: 'vfx', fx, ...(at && { at }) })
/** So many more of something, by what the actor's skills grant (a missing grant reads none). */
const more = (key: string, add = 0) => ({ prop: key, of: 'actor' as const, ...(add && { add }) })

/** A day: how long a ring or a hive rests once its yield is taken. */
const DAY = 14400

// ---------------------------------------------------------------- recipes: the smith's, the ranch's, the farm's

/** The bar of each metal a forge gives (items.ts; its `material` prop is the metal, what is made of it takes that metal). */
export const INGOTS: Record<string, string> = { iron: 'item/material/iron_ingot', steel: 'item/material/steel_bar', gold: 'item/material/gold_ingot' }
const INGOT = 'ingot'
const formName = (type: string): Text => {
  const f = FORM_BY_ID[type]
  return f ? L(f.en, f.zh) : L(type, type)
}
const sprite = (type: string) => FORM_BY_ID[type]?.sprite ?? 'item:bag'
const needs = (...n: [string, number][]) => n.map(([type, count]) => ({ type, count }))

const M = {
  ironOre: 'item/material/iron_ore', goldOre: 'item/material/gold_ore', coal: 'item/material/coal', plank: 'item/material/plank',
  log: 'item/material/log', stick: 'item/material/stick', stone: 'item/material/stone', leather: 'item/material/leather',
  wheat: 'item/material/wheat', feed: 'item/material/feed', grass: 'item/material/grass', ash: 'item/material/ash',
  fertilizer: 'item/material/fertilizer', honey: 'item/food/honey',
}

/** Smelting a batch at a forge: ore and coal to two bars (a smelter's `smelt` gives more); one ore used on a lit forge gives one bar (rules.ts smelt/ore). */
const smelt = (metal: string, n: [string, number][], extra: Partial<Recipe> = {}): Recipe => ({
  id: `smith/smelt-${metal}`, name: formName(INGOTS[metal]), sprite: sprite(INGOTS[metal]), needs: needs(...n), make: { type: INGOTS[metal] }, station: 'forge', count: 2, bonus: 'smelt', ...extra,
})
/**
 * Working bars on an anvil (a smith's hammer carried), one recipe per metal: what is made takes the bar's metal (the first need's
 * material), and a quality from the smith's craft. `INGOT` in the needs stands for the metal's bar.
 */
const forge = (type: string, n: [string, number][], level: number, skill?: string, metals = ['iron', 'steel']): Recipe[] =>
  metals.map((metal) => ({
    id: `smith/${type.split('/').pop()}-${metal}`, name: L(`${MATERIALS[metal].en} ${FORM_BY_ID[type]?.en ?? type}`, `${MATERIALS[metal].zh}${FORM_BY_ID[type]?.zh ?? type}`), sprite: sprite(type),
    needs: needs(...n.map(([t, c]): [string, number] => [t === INGOT ? INGOTS[metal] : t, c])), make: { type }, station: 'anvil', tools: ['tool:hammer'], level, ...(skill && { skill }),
  }))
/** Leather worked at a workbench (Leatherworker). */
const leather = (type: string, count: number): Recipe => ({
  id: `leather/${type.split('/').pop()}`, name: formName(type), sprite: sprite(type), needs: needs([M.leather, count]), make: { type }, station: 'workbench', skill: 'leatherworker', level: 1,
})

export const LIFE_RECIPES: Recipe[] = [
  // the forge: iron for anyone; gold and steel for those who have learned them
  smelt('iron', [[M.ironOre, 2], [M.coal, 1]]),
  smelt('gold', [[M.goldOre, 2], [M.coal, 1]], { skill: 'goldsmith' }),
  smelt('steel', [[M.ironOre, 3], [M.coal, 3]], { skill: 'steelworking', level: 3 }),
  // the anvil: weapons and armour, the heavy and the plate for those who know them
  ...forge('item/weapon/blade/dagger', [[INGOT, 1], [M.plank, 1]], 1),
  ...forge('item/weapon/polearm/spear', [[INGOT, 1], [M.stick, 2]], 1),
  ...forge('item/weapon/blade/sword', [[INGOT, 2], [M.plank, 1]], 2),
  ...forge('item/weapon/blunt/mace', [[INGOT, 3], [M.log, 1]], 2),
  ...forge('item/armor/helmet', [[INGOT, 2]], 2),
  ...forge('item/armor/shield', [[INGOT, 2], [M.plank, 2]], 2),
  ...forge('item/weapon/blunt/warhammer', [[INGOT, 4], [M.log, 1]], 4, 'heavy-arms'),
  ...forge('item/weapon/polearm/halberd', [[INGOT, 3], [M.stick, 2]], 4, 'heavy-arms'),
  ...forge('item/armor/pauldrons', [[INGOT, 3]], 3, 'plate-work'),
  ...forge('item/armor/breastplate', [[INGOT, 5]], 4, 'plate-work'),
  // metal tools (Tool Smith): an iron pickaxe bites deeper than a stone one
  ...forge('item/weapon/blade/axe', [[INGOT, 2], [M.stick, 1]], 1, 'tool-smith'),
  ...forge('item/tool/pickaxe', [[INGOT, 2], [M.stick, 1]], 1, 'tool-smith'),
  ...forge('item/tool/hoe', [[INGOT, 1], [M.stick, 2]], 1, 'tool-smith'),
  ...forge('item/tool/sickle', [[INGOT, 1], [M.stick, 1]], 1, 'tool-smith'),
  ...forge('item/tool/shovel', [[INGOT, 1], [M.stick, 2]], 1, 'tool-smith'),
  // jewellery (Jeweler): a ring, an amulet, of the ingot's metal (gold is the dear one)
  ...forge('item/valuable/ring', [[INGOT, 1]], 2, 'jeweler', ['iron', 'gold']),
  ...forge('item/valuable/amulet', [[INGOT, 2]], 3, 'jeweler', ['iron', 'gold']),
  // the smith's own stations, raised at home (Forge Builder)
  { id: 'smith/forge', name: L("Smith's Forge", '铁匠炉'), sprite: 'fixture:forge', needs: needs([M.stone, 8], [M.coal, 2]), make: { type: 'fixture/craft/forge/smith', name: L("Smith's Forge", '铁匠炉') }, station: 'hands', skill: 'forge-builder' },
  { id: 'smith/anvil', name: L("Smith's Anvil", '铁匠砧'), sprite: 'fixture:anvil', needs: needs([INGOTS.iron, 3]), make: { type: 'fixture/craft/anvil/smith', name: L("Smith's Anvil", '铁匠砧') }, station: 'forge', skill: 'forge-builder' },
  // cloth woven at a loom from grass fibre (the village weaver's, the Held Ground's weaving shed)
  { id: 'weave/cloth', name: formName('item/material/cloth'), sprite: sprite('item/material/cloth'), needs: needs(['item/material/grass', 4]), make: { type: 'item/material/cloth' }, station: 'loom' },
  // leather gear (Leatherworker)
  leather('item/clothing/gloves', 1),
  leather('item/clothing/boots', 2),
  leather('item/armor/helmet', 2),
  leather('item/armor/pauldrons', 2),
  leather('item/armor/breastplate', 4),
  // the ranch: feed from wheat (a feed-maker's hands make more of it), a bee box (Apiarist)
  { id: 'ranch/feed', name: formName(M.feed), sprite: sprite(M.feed), needs: needs([M.wheat, 2]), make: { type: M.feed, name: formName(M.feed) }, station: 'hands', count: 3, bonus: 'feedMaking' },
  { id: 'ranch/bee-box', name: L('Bee Box', '蜂箱'), sprite: 'fixture:beehive', needs: needs([M.plank, 4], [M.honey, 1]), make: { type: 'fixture/nature/beehive/box', name: L('Bee Box', '蜂箱') }, station: 'workbench', skill: 'apiarist' },
  // the farm: compost from grass and ash (Composter)
  { id: 'farm/compost', name: formName(M.fertilizer), sprite: sprite(M.fertilizer), needs: needs([M.grass, 3], [M.ash, 1]), make: { type: M.fertilizer, name: formName(M.fertilizer) }, station: 'hands', skill: 'composter' },
]

/** What the stall buys that it did not: ore and coal (an ore merchant gets more), and the ranch's goods (a rancher gets more). */
const sell = (type: string, price: number, bonus: string): Recipe => ({
  id: `shop/sell/${type.split('/').slice(1).join('-')}`, group: 'sell', name: formName(type), sprite: sprite(type), needs: needs([type, 1]), make: { type: 'item/misc/thornmark' }, station: 'stall', count: price, bonus,
})
export const LIFE_SELLS: Recipe[] = [
  sell(M.ironOre, 4, 'sell:smith'),
  sell(M.goldOre, 12, 'sell:smith'),
  sell(M.coal, 2, 'sell:smith'),
  sell(M.leather, 8, 'sell:ranch'),
  sell('item/material/feather', 1, 'sell:ranch'),
  sell(M.honey, 10, 'sell:ranch'),
  sell('item/food/cheese', 14, 'sell:ranch'),
]

// ---------------------------------------------------------------- rules: what the new content does

const broken = param('name', 'broken')

/** A vein mined: half its ore (two, and a prospector's more), dust, and its spent face standing whole where it was. */
const MINED_OUT: Effect[] = [
  { op: 'spawn', type: '@prop:host.ore', at: 'tileOf:host', count: more('mineOre', 2) },
  vfx('dust', 'tileOf:host'),
  { op: 'heal', amount: { prop: 'maxHp', of: 'host' } },
  { op: 'transform', into: '@prop:spent' },
]

export const LIFE_RULES: Rule[] = [
  rule({
    id: 'mine/vein',
    doc: 'An ore vein broken spills half the ore it holds (as anything broken does); a prospector gets more of its ore (mineOre), a gem-finder now and then a gem. What is left is its spent face (`spent`: bedrock, that no tool breaks), whole again, which grows back into the vein in a day (ontology.ts VEIN_REGROWS).',
    host: { type: 'fixture/nature/vein' },
    on: 'threshold/cross',
    tree: IF(
      broken,
      IF(
        { all: [tag('actor', 'skill:gem-finder'), { chance: 0.12 }] },
        DO(vfx('sparkle', 'tileOf:host'), { op: 'spawn', type: 'item/gem', at: 'tileOf:host' }, log('Something glitters in the rubble — a gem!', '碎石里有东西在闪——是宝石！'), ...MINED_OUT),
        DO(...MINED_OUT, log('{host} breaks; the face is bare. It will show ore again in a day.', '{host}碎了，只剩光秃秃的岩面。一天后又会露出矿来。')),
      ),
      'inherit',
    ),
  }),
  rule({
    id: 'mine/spent',
    doc: 'A blow on a vein\'s spent face: bare rock, harder than any tool; nothing comes of it but dust, and a word that the vein shows again in a day.',
    host: { type: 'fixture/nature/spentvein' },
    on: 'impulse/strike',
    tree: DO(vfx('dust', 'tileOf:host'), log('Bare rock. The vein will show again in a day.', '光秃秃的岩面。矿脉要一天后才会再露出来。')),
  }),
  rule({
    id: 'mine/stone',
    doc: 'Rock or a boulder broken breaks down into stone; a stonecutter gets more (mineStone).',
    host: { tags: ['rock', 'mineable'] },
    on: 'threshold/cross',
    tree: IF(broken, DO({ op: 'spawn', type: 'item/material/stone', at: 'tileOf:host', count: more('mineStone') }, vfx('dust', 'tileOf:host'), { op: 'breakdown' }), 'inherit'),
  }),
  ...(
    [
      ['cow', 'tanner'],
      ['chicken', 'plucker'],
    ] as const
  ).map(([kind, hides]) =>
    rule({
      id: `ranch/fell-${kind}`,
      doc: `A ${kind} felled is defeated as any creature is (combat/defeat: the striker learns from it, the story hears, it breaks down into its meat, lying still); a butcher gets more meat, a ${hides} its ${kind === 'cow' ? 'hide' : 'feathers'}.`,
      host: { type: `actor/creature/animal/${kind}` },
      on: 'threshold/cross',
      tree: IF(
        broken,
        DO(
          { op: 'emit', impulse: 'notify', to: 'actor', params: { what: 'defeat', xp: { prop: 'maxHp', of: 'host' } } },
          { op: 'emit', impulse: 'notify', to: 'story', params: { what: 'defeat', type: { typeOf: 'host' } } },
          { op: 'spawn', type: '@prop:host.meat', at: 'tileOf:host', count: more('butcher'), still: true },
          { op: 'spawn', type: '@prop:host.hide', at: 'tileOf:host', count: more(hides), still: true },
          vfx('poof', 'tileOf:host'),
          log('{host} is defeated.', '{host}被打倒了。'),
          { op: 'breakdown', still: true },
        ),
        'inherit',
      ),
    }),
  ),
  rule({
    id: 'forage/mushrooms',
    label: L('Pick mushrooms', '采蘑菇'),
    doc: 'A hand on a mushroom ring picks its mushrooms (a forager more); it grows them again in a day.',
    host: { type: 'fixture/nature/mushroom_ring' },
    on: 'impulse/handle',
    tree: IF(
      has('host', 'picked'),
      DO(log('Nothing left to pick — they grow back in a day.', '已经采光了——一天后会再长出来。')),
      DO({ op: 'spawn', type: 'item/food/mushroom/raw', at: 'actor', into: 'contents', count: more('forage', 1) }, { op: 'addStatus', status: 'picked', duration: DAY }, vfx('leaves'), log('You pick the mushrooms.', '你采下了蘑菇。')),
    ),
  }),
  rule({
    id: 'forage/reeds',
    label: L('Cut reeds', '割芦苇'),
    doc: 'A sickle cuts reeds for grass (a forager more); they grow again in a day.',
    host: { type: 'fixture/nature/reeds' },
    on: 'impulse/strike',
    tree: IF(
      tag('instrument', 'tool:sickle'),
      IF(has('host', 'picked'), DO(log('The reeds are cut short. Give them a day.', '芦苇已经割短了，过一天再来。')), DO({ op: 'spawn', type: 'item/material/grass', at: 'tileOf:host', count: more('forage', 2) }, { op: 'addStatus', status: 'picked', duration: DAY }, vfx('leaves'), log('You cut an armful of reeds.', '你割了一捆芦苇。'))),
      'inherit',
    ),
  }),
  rule({
    id: 'ranch/honey',
    label: L('Take honey', '取蜂蜜'),
    doc: 'A hand on a beehive (or a bee box) takes its honey once a day — and the bees sting, unless one keeps bees (Beekeeper); a beekeeper takes more (honey).',
    host: { type: 'fixture/nature/beehive' },
    on: 'impulse/handle',
    tree: IF(
      has('host', 'picked'),
      DO(log('The bees have not filled it again yet.', '蜜蜂还没把它重新酿满。')),
      IF(
        tag('actor', 'skill:beekeeper'),
        DO({ op: 'spawn', type: M.honey, at: 'actor', into: 'contents', count: more('honey', 1) }, { op: 'addStatus', status: 'picked', duration: DAY }, vfx('sparkle'), log('You calm the bees and take the honey.', '你安抚好蜜蜂，取出了蜂蜜。')),
        DO({ op: 'spawn', type: M.honey, at: 'actor', into: 'contents' }, { op: 'addStatus', status: 'picked', duration: DAY }, { op: 'emit', impulse: 'strike', to: 'actor', params: { power: 2, edge: 'pierce' } }, log('You take the honey — and the bees sting!', '你取到了蜂蜜——但被蜜蜂蜇了！')),
      ),
    ),
  }),
  rule({
    id: 'ranch/cheese',
    label: L('Make cheese', '做奶酪'),
    doc: 'A bucket of milk heated over a lit fire (any cookware) makes cheese — two, more for a cheesemaker (cheese) — and the bucket is empty again.',
    host: { type: 'item/vessel/bucket/milk' },
    on: 'act/use',
    tree: IF(
      { is: { role: 'target', sel: { tags: ['cookware'], status: ['lit'] } } },
      DO({ op: 'spawn', type: 'item/food/cheese', at: 'actor', into: 'contents', count: more('cheese', 2) }, { op: 'transform', into: 'item/vessel/bucket/empty' }, vfx('steam'), log('The milk curdles over the fire — cheese.', '牛奶在火上凝结——做成了奶酪。')),
      'inherit',
    ),
  }),
  rule({
    id: 'farm/tilled',
    doc: 'Diggable ground told it is tilled (a wide hoe\'s swing beside it) turns to farmland.',
    host: { type: 'tile', tags: ['diggable'] },
    on: 'impulse/notify',
    tree: IF(param('what', 'till'), DO({ op: 'transform', into: 'tile/farmland' }, vfx('dust')), 'inherit'),
  }),
  rule({
    id: 'farm/watered',
    doc: 'A growing crop told it is watered (a sprinkler\'s watering beside it) is watered.',
    host: { type: 'fixture', tags: ['crop', 'growing'] },
    on: 'impulse/notify',
    tree: IF({ all: [param('what', 'water'), { not: has('host', 'watered') }] }, waterCrop(), 'inherit'),
  }),
]

// ---------------------------------------------------------------- the skills

/** A life skill: an ability (its tag a rule reads) or a number granted; `cost` 2 for a capstone. */
const S = (id: string, branch: string, requires: string[], en: string, zh: string, docEn: string, docZh: string, extra: Partial<SkillDef> = {}): SkillDef =>
  ({ id, branch, icon: id, ...(requires.length && { requires }), ...(extra.grant ? {} : { ability: true }), ...extra, name: L(en, zh), doc: L(docEn, docZh) })
const CAP = { cost: 2 }

export const LIFE_SKILLS: SkillDef[] = [
  // ---- gathering: the axe, the pick, the basket, the line (four already: long-reach, woodcutter, big-pack, firemaker)
  S('sharp-axe', 'gathering', ['woodcutter'], 'Sharp Axe', '利斧', 'Your axe bites half again as deep into a tree.', '斧头砍树的伤害 +50%。'),
  S('carpenter', 'gathering', ['sharp-axe'], 'Carpenter', '木匠', 'Splitting a log gives one more plank.', '劈开木头多得 1 块木板。', { grant: { splitPlanks: 1 } }),
  S('forester', 'gathering', ['woodcutter'], 'Forester', '护林人', 'Every tree you fell drops an acorn.', '每砍倒一棵树都会掉一颗橡子。', { grant: { fellAcorns: 1 } }),
  S('timber-master', 'gathering', ['carpenter', 'forester'], 'Timber Master', '木材大师', 'Capstone: every tree you fell gives one more log and one more stick.', '终极：每砍倒一棵树多得 1 根原木和 1 根树枝。', { ...CAP, grant: { fellLogs: 1, fellSticks: 1 } }),
  S('prospector', 'gathering', ['long-reach'], 'Prospector', '探矿者', 'An ore vein you break gives one more ore.', '敲碎的矿脉多掉 1 块矿石。', { grant: { mineOre: 1 } }),
  S('heavy-pick', 'gathering', ['prospector'], 'Heavy Pick', '重镐', 'Your pickaxe strikes half again as hard.', '镐的力量 +50%。'),
  S('stonecutter', 'gathering', ['prospector'], 'Stonecutter', '碎石工', 'Rock and boulders you break give one more stone.', '敲碎的岩石和巨石多掉 1 块石头。', { grant: { mineStone: 1 } }),
  S('gem-finder', 'gathering', ['heavy-pick'], 'Gem Finder', '寻宝者', 'An ore vein you break sometimes holds a gem (12%).', '敲碎矿脉时有 12% 几率找到宝石。'),
  S('deep-vein', 'gathering', ['gem-finder', 'stonecutter'], 'Deep Vein', '矿脉专家', 'Capstone: an ore vein you break gives one more ore again.', '终极：敲碎的矿脉再多掉 1 块矿石。', { ...CAP, grant: { mineOre: 1 } }),
  S('forager', 'gathering', ['long-reach'], 'Forager', '采集好手', 'Mushroom rings and reeds give one more; wild beehives aside.', '采蘑菇圈、割芦苇多得 1 份。', { grant: { forage: 1 } }),
  S('herbalist', 'gathering', ['forager'], 'Herbalist', '草药学', 'A healing herb you eat heals twice as much.', '吃下的草药恢复的生命翻倍。'),
  S('angler', 'gathering', ['long-reach'], 'Angler', '垂钓者', 'Fish bite more often: 85% on a baited hook, 50% without.', '鱼更容易咬钩：挂饵时 85%，不挂饵时 50%。'),
  S('bait-saver', 'gathering', ['angler'], 'Bait Saver', '省饵', 'Half the time a fish takes your bait clean, the bait is still on the hook.', '鱼吃掉鱼饵却没上钩时，有一半几率鱼饵还在。'),
  S('lucky-catch', 'gathering', ['angler'], 'Lucky Catch', '幸运鱼获', 'Golden carp and Dawnscales bite twice as often.', '金鳞鲤和晨鳞鱼上钩的几率翻倍。'),
  S('deep-fisher', 'gathering', ['bait-saver'], 'Deep Fisher', '深水垂钓', 'Pike bite in any water, not only the deep.', '在任何水域都能钓到狗鱼，不只是深水。'),
  S('master-angler', 'gathering', ['lucky-catch', 'deep-fisher'], 'Master Angler', '钓鱼大师', 'Capstone: every catch brings up one more fish.', '终极：每次钓到东西都额外多得 1 条鱼。', { ...CAP, grant: { fishExtra: 1 }, ability: true }),

  // ---- agriculture: the hoe and the can, the harvest, the market, the crops one knows best
  S('farmer', 'agriculture', [], 'Farmer', '农夫', 'A crop you harvest gives one more seed.', '收割作物多得 1 颗种子。', { grant: { seeds: 1 } }),
  S('green-fingers', 'agriculture', ['farmer'], 'Green Fingers', '巧手采摘', 'Picking a ripe crop by hand gives two.', '用手采摘成熟作物得 2 份。', { grant: { pick: 1 } }),
  S('wide-hoe', 'agriculture', ['farmer'], 'Wide Hoe', '宽锄', 'Tilling also tills the diggable ground around it (3×3).', '翻土时连同周围 3×3 的地一起翻好。'),
  S('bountiful', 'agriculture', ['farmer'], 'Bountiful', '丰收', 'A crop you harvest with a sickle gives one more.', '用镰刀收割多得 1 份作物。', { grant: { harvest: 1 } }),
  S('seed-merchant', 'agriculture', ['farmer'], 'Seed Merchant', '种子商人', 'Seeds and saplings bought at the stall come half again as many.', '在货摊买种子多得 50%。', { grant: { 'buy:farm': 0.5 } }),
  S('perennial-keeper', 'agriculture', ['green-fingers'], 'Perennial Keeper', '多年生', 'A perennial you harvest keeps its fertilizer and its yield as it grows back.', '多年生作物收获后保留施肥效果和产量。'),
  S('fruit-farmer', 'agriculture', ['perennial-keeper'], 'Fruit Farmer', '果蔬农', 'Tomatoes, corn, peppers and eggplants give two more at harvest.', '番茄、玉米、辣椒、茄子收获时多得 2 份。', { grant: { 'harvest:fruit': 2 } }),
  S('berry-farmer', 'agriculture', ['perennial-keeper'], 'Berry Farmer', '浆果农', 'Berries, blueberries and strawberries give two more at harvest.', '浆果、蓝莓、草莓收获时多得 2 份。', { grant: { 'harvest:berry': 2 } }),
  S('irrigation', 'agriculture', ['wide-hoe'], 'Irrigation', '引水', 'One watering supplies two growth stages, at the crop\'s normal pace.', '浇一次水可供作物连续生长两个阶段，生长速度不变。'),
  S('sprinkler', 'agriculture', ['irrigation'], 'Sprinkler', '广域浇灌', 'Watering a crop waters the growing crops around it too.', '浇一株作物时，周围生长中的作物也一起浇上水。'),
  S('composter', 'agriculture', ['wide-hoe'], 'Composter', '堆肥', 'Make fertilizer from three grass and an ash, by hand.', '学会堆肥：用 3 把草和 1 份灰烬手工做出肥料。'),
  S('rich-soil', 'agriculture', ['composter'], 'Rich Soil', '沃土', 'Fertilizer or ash you work in gives one more at harvest again.', '施肥（或灰烬）让收成再多 1 份。', { grant: { fertilize: 1 } }),
  S('grain-farmer', 'agriculture', ['bountiful'], 'Grain Farmer', '谷物农', 'Wheat gives two more at harvest.', '小麦收获时多得 2 份。', { grant: { 'harvest:grain': 2 } }),
  S('root-farmer', 'agriculture', ['bountiful'], 'Root Farmer', '根茎农', 'Carrots, turnips, parsnips, potatoes and radishes give two more at harvest.', '胡萝卜、芜菁、防风草、土豆、小萝卜收获时多得 2 份。', { grant: { 'harvest:root': 2 } }),
  S('gourd-farmer', 'agriculture', ['bountiful'], 'Gourd Farmer', '瓜农', 'Pumpkins, melons and cauliflower give one more at harvest.', '南瓜、甜瓜、花椰菜收获时多得 1 份。', { grant: { 'harvest:gourd': 1 } }),
  S('herb-gardener', 'agriculture', ['bountiful'], 'Herb Gardener', '药圃', 'Herbs give two more at harvest.', '草药收获时多得 2 份。', { grant: { 'harvest:herb': 2 } }),
  S('seed-saver', 'agriculture', ['seed-merchant'], 'Seed Saver', '留种', 'A plant you dig up gives two more seeds.', '用铲子挖出作物时多得 2 颗种子。', { grant: { digSeeds: 2 } }),
  S('market-gardener', 'agriculture', ['seed-merchant'], 'Market Gardener', '菜贩', 'Crops sell for 25% more at the stall.', '在货摊卖作物多得 25% 的钱。', { grant: { 'sell:farm': 0.25 } }),
  S('golden-harvest', 'agriculture', ['rich-soil', 'sprinkler'], 'Golden Harvest', '金色丰收', 'Capstone: a harvest sometimes (15%) yields twice over.', '终极：收割时有 15% 几率收成翻倍。', CAP),
  S('master-farmer', 'agriculture', ['golden-harvest', 'market-gardener'], 'Master Farmer', '农场大师', 'Capstone: every harvest gives one more crop and one more seed again.', '终极：每次收割再多 1 份作物和 1 颗种子。', { ...CAP, grant: { harvest: 1, seeds: 1 }, ability: true }),

  // ---- husbandry: the herd, the dairy, the coop, the hive, the hide
  S('herdsman', 'husbandry', [], 'Herdsman', '牧人', 'An animal you feed stays fed for two days.', '你喂的动物饱腹状态持续两天。'),
  S('milker', 'husbandry', ['herdsman'], 'Milker', '挤奶好手', 'A cow you milk can be milked again after half a day.', '挤过奶的牛半天后就能再挤。'),
  S('egg-collector', 'husbandry', ['herdsman'], 'Egg Collector', '拾蛋', 'A hen you feed lays an egg at once.', '喂母鸡时它立刻下一个蛋。', { grant: { feedEggs: 1 } }),
  S('breeder', 'husbandry', ['herdsman'], 'Breeder', '育种家', 'Animals you feed sometimes (30%) bear twins.', '你喂的动物繁殖时有 30% 几率生双胞胎。'),
  S('butcher', 'husbandry', ['herdsman'], 'Butcher', '屠夫', 'A cow or hen you fell gives one more meat.', '宰杀牛或鸡多得 1 份肉。', { grant: { butcher: 1 } }),
  S('beekeeper', 'husbandry', ['herdsman'], 'Beekeeper', '养蜂人', 'Bees do not sting you, and a hive gives you one more honey.', '取蜂蜜时不会被蜇，并多得 1 罐蜂蜜。', { grant: { honey: 1 } }),
  S('cheesemaker', 'husbandry', ['milker'], 'Cheesemaker', '奶酪师', 'Milk over a fire gives one more cheese.', '用牛奶做奶酪多得 1 块。', { grant: { cheese: 1 } }),
  S('dairy-master', 'husbandry', ['cheesemaker'], 'Dairy Master', '乳品大师', 'Milk over a fire gives one more cheese again.', '用牛奶做奶酪再多得 1 块。', { grant: { cheese: 1 } }),
  S('coop-keeper', 'husbandry', ['egg-collector'], 'Coop Keeper', '鸡舍', 'A hen you feed lays one more egg at once.', '喂母鸡时它再多下一个蛋。', { grant: { feedEggs: 1 } }),
  S('hen-whisperer', 'husbandry', ['coop-keeper'], 'Hen Whisperer', '母鸡知音', 'A hen you feed sometimes (15%) hatches a chick of its own.', '喂母鸡时有 15% 几率孵出一只小鸡。'),
  S('quick-breeder', 'husbandry', ['breeder'], 'Quick Breeder', '繁育', 'Animals that bred from your feeding rest half a day, not a day.', '你喂的动物繁殖后只需休息半天。'),
  S('stockman', 'husbandry', ['breeder'], 'Stockman', '畜群', 'Feeding one animal feeds the hungry ones around it too.', '喂一只动物时，周围没吃饱的动物也一起喂饱。'),
  S('feed-maker', 'husbandry', ['stockman'], 'Feed Maker', '饲料师', 'Two wheat make five feed, not three.', '用 2 份小麦做饲料得 5 份（原来 3 份）。', { grant: { feedMaking: 0.67 } }),
  S('tanner', 'husbandry', ['butcher'], 'Tanner', '制革', 'A cow you fell leaves its hide (leather).', '宰杀牛时得到 1 张皮革。', { grant: { tanner: 1 } }),
  S('leatherworker', 'husbandry', ['tanner'], 'Leatherworker', '皮匠', 'Make leather gloves, boots, helmets, pauldrons and breastplates at a workbench.', '学会在工作台用皮革做手套、靴子、头盔、护肩和胸甲。'),
  S('plucker', 'husbandry', ['butcher'], 'Plucker', '拔毛', 'A hen you fell leaves two feathers.', '宰杀鸡时得到 2 根羽毛。', { grant: { plucker: 2 } }),
  S('apiarist', 'husbandry', ['beekeeper'], 'Apiarist', '蜂农', 'Build a bee box (four planks and a honey) at a workbench.', '学会在工作台用 4 块木板和 1 罐蜂蜜做蜂箱。'),
  S('royal-jelly', 'husbandry', ['beekeeper'], 'Royal Jelly', '蜂王浆', 'A hive gives you one more honey again.', '取蜂蜜再多得 1 罐。', { grant: { honey: 1 } }),
  S('rancher', 'husbandry', ['dairy-master', 'feed-maker'], 'Rancher', '牧场主', 'Milk, eggs, cheese, honey, leather and feathers sell for 25% more.', '牛奶、鸡蛋、奶酪、蜂蜜、皮革、羽毛在货摊多卖 25%。', { grant: { 'sell:ranch': 0.25 } }),
  S('master-rancher', 'husbandry', ['rancher', 'leatherworker'], 'Master Rancher', '牧场大师', 'Capstone: one more of everything the ranch gives you — eggs, cheese, honey, meat.', '终极：牧场的每样产出都再多 1 份——鸡蛋、奶酪、蜂蜜、肉。', { ...CAP, grant: { feedEggs: 1, cheese: 1, honey: 1, butcher: 1 }, ability: true }),

  // ---- smithing: the forge, the weapon, the armour, the craft itself
  S('apprentice-smith', 'smithing', [], 'Apprentice Smith', '学徒铁匠', 'What you forge on an anvil is made as by a smith one level higher (its quality).', '在铁砧上锻造时，按高 1 级的水平决定品质。', { grant: { 'craft:anvil': 1 } }),
  S('forge-builder', 'smithing', ['apprentice-smith'], 'Forge Builder', '筑炉', 'Build your own forge (eight stone, two coal) and anvil (three ingots, at a forge).', '学会自己搭熔炉（8 块石头、2 块煤）和铁砧（3 块锭，在熔炉旁做）。'),
  S('efficient-smelting', 'smithing', ['apprentice-smith'], 'Efficient Smelting', '高效冶炼', 'Every smelting gives one more ingot.', '每次冶炼多得 1 块锭。', { grant: { smelt: 1 } }),
  S('weaponsmith', 'smithing', ['apprentice-smith'], 'Weaponsmith', '武器锻造', 'Weapons you forge strike 1 harder.', '你锻造的武器威力 +1。', { grant: { 'anvil:power': 1 } }),
  S('armorsmith', 'smithing', ['apprentice-smith'], 'Armorsmith', '护甲锻造', 'Armour you forge guards 1 better.', '你锻造的护甲防御 +1。', { grant: { 'anvil:def': 1 } }),
  S('fine-craft', 'smithing', ['apprentice-smith'], 'Fine Craft', '精工', 'What you forge is made as by a smith two levels higher again.', '锻造时再按高 2 级的水平决定品质。', { grant: { 'craft:anvil': 2 } }),
  S('steelworking', 'smithing', ['efficient-smelting'], 'Steelworking', '炼钢术', 'Smelt steel (three iron ore, three coal): the strongest common metal.', '学会炼钢（3 块铁矿、3 块煤），钢是最好的普通金属。'),
  S('goldsmith', 'smithing', ['efficient-smelting'], 'Goldsmith', '金匠', 'Smelt gold (two gold ore, one coal).', '学会炼金（2 块金矿、1 块煤）。'),
  S('jeweler', 'smithing', ['goldsmith'], 'Jeweler', '珠宝匠', 'Forge rings and amulets from ingots.', '学会用锭锻造戒指和护符。'),
  S('ore-merchant', 'smithing', ['efficient-smelting'], 'Ore Merchant', '矿石商', 'Ore and coal sell for half again as much.', '矿石和煤在货摊多卖 50%。', { grant: { 'sell:smith': 0.5 } }),
  S('tool-smith', 'smithing', ['forge-builder'], 'Tool Smith', '工具匠', 'Forge metal axes, pickaxes, hoes, sickles and shovels.', '学会锻造金属的斧头、镐、锄头、镰刀和铲子。'),
  S('keen-edge', 'smithing', ['weaponsmith'], 'Keen Edge', '锋刃', 'Weapons you forge have +5% critical chance.', '你锻造的武器暴击率 +5%。', { grant: { 'anvil:critChance': 0.05 } }),
  S('heavy-arms', 'smithing', ['weaponsmith'], 'Heavy Arms', '重兵器', 'Forge warhammers and halberds.', '学会锻造战锤和戟。'),
  S('master-weaponsmith', 'smithing', ['keen-edge', 'heavy-arms'], 'Master Weaponsmith', '武器大师', 'Weapons you forge strike 2 harder again.', '你锻造的武器威力再 +2。', { grant: { 'anvil:power': 2 } }),
  S('plate-work', 'smithing', ['armorsmith'], 'Plate Work', '板甲', 'Forge pauldrons and breastplates.', '学会锻造护肩和胸甲。'),
  S('reinforced', 'smithing', ['armorsmith'], 'Reinforced', '加固', 'Armour you forge guards 1 better again.', '你锻造的护甲防御再 +1。', { grant: { 'anvil:def': 1 } }),
  S('master-armorsmith', 'smithing', ['plate-work', 'reinforced'], 'Master Armorsmith', '护甲大师', 'Armour you forge guards 2 better again.', '你锻造的护甲防御再 +2。', { grant: { 'anvil:def': 2 } }),
  S('masterwork', 'smithing', ['fine-craft'], 'Masterwork', '杰作', 'What you forge is now and then (15%) one quality better.', '锻造时有 15% 几率品质提升一级。', { grant: { 'anvil:lift': 0.15 } }),
  S('legendary-smith', 'smithing', ['masterwork', 'steelworking'], 'Legendary Smith', '传奇锻造', 'Capstone: what you forge is sometimes (4%) Vowbound.', '终极：锻造时有 4% 几率打出「遗誓」品质。', { ...CAP, grant: { 'anvil:vowed': 0.04 } }),
  S('grandmaster-smith', 'smithing', ['master-weaponsmith', 'master-armorsmith'], 'Grandmaster Smith', '宗师铁匠', 'Capstone: what you forge is made as by a smith three levels higher again.', '终极：锻造时再按高 3 级的水平决定品质。', { ...CAP, grant: { 'craft:anvil': 3 }, ability: true }),
]
