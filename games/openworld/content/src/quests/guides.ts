// The fairy's guides (docs/quests.md §3, the guides): quests of the kind `guide`, each teaching one of the game's
// systems the clearing did not — the skill tree, the professions, fishing, the garden, an offering laid on a shrine.
// Lumi begins them herself: a beat of the story notices the moment (a skill point unspent, level five without a
// profession, the first steps onto the pond's bank, into the garden, onto the Pilgrim's Road after the oath) and the
// quest answers it, as the main line answers the story's steps;
// she tells the player in her own words (the stages' lines are hers, `by: 'pip'`) and her panel shows them beside
// the main road. Every objective is a state of the world (what is carried, a crop standing, a status, a word with
// the trainer), never a path.

import type { QuestDef, StepDef } from '@openworld/engine'
import { L } from './kit.ts'
import { FIRSTLIGHT } from '../firstlight.ts'
import { PILGRIMAGE, WAYSHRINES, shrineFact } from '../pilgrimage.ts'

/** The companion's id (tools/src/demo/world.ts): the one who speaks the guides' lines. */
export const LUMI_ID = 'pip'
/** The profession trainer's id (tools/src/demo/people/bram.ts). */
export const TRAINER_ID = 'npc.bram'

const G = FIRSTLIGHT.garden
/** The garden's bare row, kept for sowing (tools/src/demo/garden.ts): where the guide's seed goes. */
export const GARDEN_BARE_ROW: [number, number][] = Array.from({ length: G.width }, (_, i) => [G.x + i, G.y + G.height - 1])
/** The regions of Firstlight the guides begin in. */
const POND = `${FIRSTLIGHT.map}:pond`
const GARDEN = `${FIRSTLIGHT.map}:garden`

/** What the first cast asks for and gives. */
const ROD = { type: 'item/tool/fishing_rod' }
const FISH = { type: 'item/food/fish' }

/** Only in a game proper: the clearing's tutorial (quest `awakening`, begun only there) has its own lessons. */
const IN_GAME = { awakening: 0 }

// ------------------------------------------------------------------ the beats: the moments she notices

export const GUIDE_BEATS: StepDef[] = [
  // a skill point unspent: the tree is worth a look (quiet: the quest's first line is hers)
  { id: 'guide_skill', when: { props: { skillPoints: { gte: 1 } }, quest: IN_GAME } },
  { id: 'guide_skill_learned', when: { skill: true, after: 'guide_skill' } },
  // level five and no road chosen: the trainer will take you on
  { id: 'guide_profession', when: { props: { level: { gte: 5 }, profession: 0 }, quest: IN_GAME } },
  { id: 'guide_profession_chosen', when: { props: { profession: { ne: 0 } }, after: 'guide_profession' } },
  // the garden's lesson: a seed sown on the bare row, a crop watered
  { id: 'guide_sowed', when: { map: FIRSTLIGHT.map, on: { type: 'fixture/crop', cells: GARDEN_BARE_ROW, count: 1 }, quest: { guide_farm: { gte: 10 } } } },
  { id: 'guide_watered', when: { map: FIRSTLIGHT.map, near: { type: 'fixture/crop', r: 10, status: 'watered' }, quest: { guide_farm: { gte: 10 } } } },
]

// ------------------------------------------------------------------ the guides

const skill: QuestDef = {
  id: 'guide_skill',
  kind: 'guide',
  title: L('The First Skill Point', '第一个技能点'),
  summary: L('Every level gives a skill point, spent in the skill tree ({key:skills}). Anyone can learn the general skills: gathering, crafting, fighting.', '每升一级得一个技能点，在技能树（{key:skills}）里花。通用技能谁都能学：采集、制作、战斗都有。'),
  aliases: { pip: { id: LUMI_ID } },
  objectives: [{ id: 'learn', text: L('Open the skill tree ({key:skills}) and learn a skill', '打开技能树（{key:skills}），学一个技能'), on: { step: 'guide_skill_learned' } }],
  stages: [
    {
      n: 10,
      show: ['learn'],
      say: L('You went up a level! That means a skill point. Press {key:skills} to open the skill tree and learn something. Anyone can learn the general skills; the profession skills need a profession first.', '你升级了！这就有一个技能点了。按 {key:skills} 打开技能树，学一个吧。通用技能谁都能学，职业技能要先有职业。'),
      by: 'pip',
      hint: L('{key:skills} opens the skill tree. A skill you can learn now is lit; click it to learn it. Hunting, gathering, crafting, fighting: pick what you do most.', '{key:skills} 打开技能树。现在能学的技能会亮着，点一下就学会了。打猎、采集、制作、战斗，挑你最常做的。'),
      log: L('I went up a level and have a skill point to spend. The skill tree is {key:skills}.', '升了一级，有一个技能点可以花。技能树在 {key:skills}。'),
    },
    {
      n: 100,
      on: { step: 'guide_skill_learned' },
      done: ['learn'],
      complete: true,
      say: L('Learned! You get another point every level, so come back to the tree when you have one.', '学会了！每升一级还会有一点，有了就回来看看技能树。'),
      by: 'pip',
      reward: { xp: 10 },
      log: L('I learned my first skill.', '学会了第一个技能。'),
    },
  ],
  start: { auto: { step: 'guide_skill' } },
}

const profession: QuestDef = {
  id: 'guide_profession',
  kind: 'guide',
  title: L('A Road of Your Own', '选一条路'),
  summary: L('At level five, Bram the trainer in the drill yard of Firstlight Village will set you on a profession: assassin, warrior, ranger or mage. Each has its own weapon, skill-tree branch and gear sets; you can change later, but its branch starts over.', '到了五级，初原村操练场的导师布拉姆会让你选一个职业：刺客、战士、游侠或法师。每个职业有自己的武器、技能分支和套装；以后也能换，但那条分支要从头来过。'),
  aliases: { pip: { id: LUMI_ID }, trainer: { id: TRAINER_ID, essential: true } },
  objectives: [
    { id: 'trainer', text: L('Speak to Bram, the trainer, in the drill yard of Firstlight Village', '去初原村操练场找导师布拉姆说话'), target: 'trainer', talk: true, on: { talk: 'trainer' } },
    { id: 'choose', text: L('Choose a profession', '选择一个职业'), target: 'trainer', on: { step: 'guide_profession_chosen' } },
  ],
  stages: [
    {
      n: 10,
      show: ['trainer', 'choose'],
      say: L('Level five! Bram said he takes people on at level five. His drill yard is in Firstlight, by the north-east cottage; look for the crossed blades over his head. Let\'s go and pick a profession!', '五级了！布拉姆说过，到了五级他就收人。他的操练场在初原村东北角那间小屋旁边，认准他头顶的交叉双剑。我们去选个职业吧！'),
      by: 'pip',
      hint: L('Bram is in the drill yard of Firstlight Village day and night, with crossed blades over his head. {key:hands} on him opens his panel: four professions, each with its weapon. The dagger strikes from behind, the sword and shield from the front, the bow from afar, and the staff from wherever you stand.', '布拉姆日夜都在初原村的操练场，头顶有交叉双剑。对他按 {key:hands} 打开面板：四个职业，各用各的武器。匕首从背后下手，剑盾正面迎敌，弓从远处射，法杖站在哪儿都能用。'),
      log: L('Level five. Lumi says Bram will take me on now.', '五级了。露米说，布拉姆现在肯收我了。'),
    },
    {
      n: 20,
      on: { talk: 'trainer' },
      done: ['trainer'],
      hint: L('Choose in his panel. You will fight with the profession\'s weapon, and its branch of the skill tree opens with it. You can change later, but the branch starts over.', '在他的面板里选。选了哪个职业，就用它的武器打，技能树里对应的分支也一起开。以后能换，但分支要从头来过。'),
      log: L('Bram offers four: dagger, sword and shield, bow, or staff.', '布拉姆给了四条路：匕首、剑盾、弓、法杖。'),
    },
    {
      n: 100,
      on: { step: 'guide_profession_chosen' },
      done: ['trainer', 'choose'],
      complete: true,
      say: L('You have a profession now! Its branch is open in the skill tree ({key:skills}). If you don\'t have its weapon yet, Bram sells one.', '你有职业了！技能树（{key:skills}）里它的分支已经开了。要是还没有那种武器，布拉姆那里有卖。'),
      by: 'pip',
      reward: { xp: 20 },
      log: L('I chose a profession. Its branch is open in the skill tree.', '选好了职业。技能树里它的分支开了。'),
    },
  ],
  start: { auto: { step: 'guide_profession' } },
}

const fish: QuestDef = {
  id: 'guide_fish',
  kind: 'guide',
  title: L('The First Cast', '第一竿'),
  summary: L('Any water with fish in it will do; the nearest is the pond south of Firstlight\'s square. Make a rod from two sticks and two tufts of grass ({key:craft}) or buy one at the general store, then stand on the bank, hold it and left click the water.', '有鱼的水都能钓，最近的是初原村广场南边的池塘。用两根树枝、两把草做一根鱼竿（{key:craft}），或者去杂货店买，然后站在岸边，拿着鱼竿左键点水。'),
  aliases: { pip: { id: LUMI_ID }, pond: { place: POND } },
  objectives: [
    { id: 'rod', text: L('Get a fishing rod ({key:craft}: two sticks and two tufts of grass; or the general store)', '弄一根鱼竿（{key:craft} 制作：两根树枝、两把草；或在杂货店买）'), on: { carry: ROD } },
    { id: 'fish', text: L('Catch a fish in the pond (hold the rod, left click the water)', '在池塘里钓起一条鱼（拿着鱼竿，左键点水）'), target: 'pond', on: { carry: FISH } },
  ],
  stages: [
    {
      n: 10,
      show: ['rod', 'fish'],
      say: L('Look, a pond! Something just jumped. Make a rod from two sticks and two tufts of grass; you can do it by hand ({key:craft}). Then stand on the bank, hold it and left click the water.', '看，池塘！刚才有东西跳了一下。用两根树枝、两把草就能徒手做根鱼竿（{key:craft}）。然后站到岸边，拿着它左键点水。'),
      by: 'pip',
      hint: L('A rod is two sticks and two tufts of grass, made by hand ({key:craft}); the general store sells one too. On the bank, hold it and left click the water, and sometimes something bites. A cast stirs the water, so wait a moment before the next.', '鱼竿用两根树枝、两把草徒手做（{key:craft}），杂货店也有卖。站在岸边拿着它左键点水，有时会有鱼咬钩。甩一竿会惊动水面，等一会儿再甩下一竿。'),
      log: L('There is a pond in the village. Lumi wants me to try fishing.', '村里有个池塘。露米让我试试钓鱼。'),
    },
    {
      n: 20,
      on: { carry: ROD },
      done: ['rod'],
      say: L('You have a rod! Now to the water. Hold it and left click the pond; if nothing bites, cast again when the ripples settle. Bait on the hook makes them bite twice as fast: hold the bait and right click the rod.', '有鱼竿了！去水边吧。拿着它左键点池塘；没咬钩的话，等水面平了再甩。钩上挂了鱼饵，咬钩会快一倍：拿着鱼饵，右键点鱼竿。'),
      by: 'pip',
      hint: L('Stand on the bank with the rod in hand and left click the water. A cast stirs it, so wait a moment between casts. At first light, now and then, a Dawnscale bites.', '站在岸边，手拿鱼竿，左键点水。甩一竿水面会被惊动，两竿之间要等一会儿。天刚亮的时候，偶尔能钓到晨鳞鱼。'),
      log: L('I have a fishing rod of my own. Now the pond.', '有了自己的鱼竿。该去池塘了。'),
    },
    {
      n: 100,
      on: { carry: FISH },
      done: ['rod', 'fish'],
      complete: true,
      say: L('You caught one! Cook it on a fire, or eat it as it is. What bites depends on the hour and the weather: eels at night, catfish in the rain. Here, some bait for next time.', '钓到了！可以放在火上烤，也可以直接吃。钓到什么鱼，要看时辰和天气：夜里有鳗鱼，下雨天有鲶鱼。这点鱼饵给你，下次用。'),
      by: 'pip',
      reward: { xp: 15, items: [{ type: 'item/misc/bait', count: 3 }] },
      log: L('My first fish. What bites depends on the hour and the weather.', '钓到了第一条鱼。钓到什么，要看时辰和天气。'),
    },
  ],
  start: { auto: { all: [{ enter: POND }, { quest: IN_GAME }] } },
}

const farm: QuestDef = {
  id: 'guide_farm',
  kind: 'guide',
  title: L('A Lesson in the Garden', '菜圃的一课'),
  summary: L('The supplies crate by the kitchen garden of Firstlight Village holds a hoe, a sickle, a bucket of water and seeds. Harvest a ripe crop with the sickle, sow a seed on the bare row and water it.', '初原村菜圃旁的工具箱里有锄头、镰刀、一桶水和种子。用镰刀收一株熟了的作物，在空着的那一行播一粒种子，再浇上水。'),
  aliases: { pip: { id: LUMI_ID }, garden: { place: GARDEN }, crate: { id: 'ford.garden.supplies' } },
  objectives: [
    { id: 'hoe', text: L('Take the hoe from the garden supplies ({key:hands} on the crate)', '从菜圃工具箱里拿锄头（对箱子按 {key:hands}）'), target: 'crate', on: { carry: { type: 'item/tool/hoe' } } },
    { id: 'sickle', text: L('Take the sickle', '拿镰刀'), target: 'crate', on: { carry: { type: 'item/tool/sickle' } } },
    { id: 'seeds', text: L('Take some seeds', '拿一些种子'), target: 'crate', on: { carry: { type: 'item/seed' } } },
    { id: 'harvest', text: L('Harvest a ripe crop with the sickle (hold it, left click the crop)', '用镰刀收割一株成熟的作物（拿着镰刀，左键点作物）'), target: 'garden', on: { carry: { tags: ['vegetable'] } } },
    { id: 'sow', text: L('Sow a seed on the bare row of the garden (hold the seed, right click the farmland)', '在菜圃空着的那一行播一粒种子（拿着种子，右键点耕地）'), target: 'garden', on: { step: 'guide_sowed' } },
    { id: 'water', text: L('Water a crop (hold the bucket of water, left click the crop)', '给一株作物浇水（拿着水桶，左键点作物）'), target: 'garden', on: { step: 'guide_watered' } },
  ],
  stages: [
    {
      n: 10,
      show: ['hoe', 'sickle', 'seeds'],
      say: L('This is the village garden! The crate at its corner has a hoe, a sickle, a bucket of water and seeds. Open it ({key:hands}) and take the hoe, the sickle and some seeds. We can borrow them.', '这是村里的菜圃！角上的箱子里有锄头、镰刀、一桶水和种子。打开它（{key:hands}），把锄头、镰刀和一些种子拿上。借来用用没关系的。'),
      by: 'pip',
      hint: L('The supplies crate stands at the garden\'s east corner. {key:hands} opens it; take the hoe, the sickle and some seeds (and the bucket of water, for later).', '工具箱在菜圃东边的角上。按 {key:hands} 打开，拿锄头、镰刀和一些种子（水桶也拿上，待会儿用）。'),
      log: L('The village garden, with a crate of tools beside it. Lumi wants to teach me to grow things.', '村里的菜圃，旁边有一箱工具。露米想教我种地。'),
    },
    {
      n: 20,
      on: { objectives: ['hoe', 'sickle', 'seeds'] },
      done: ['hoe', 'sickle', 'seeds'],
      show: ['harvest', 'sow', 'water'],
      say: L('Good! See the rows? Sprouts, young plants, and the top row is ripe. Cut one with the sickle; you get the crop and its seeds back. Then sow a seed on the bare bottom row and water it with the bucket. A crop grows a stage every one to four hours, as its seed says, and needs water at each stage. Once you know Irrigation, one watering lasts two stages.', '好！看见那几排了吗？嫩芽、小苗，最上面一排已经熟了。用镰刀割一株，作物和种子都能拿到。然后在最下面空着的那行播一粒种子，用水桶浇上水。作物每一到四个小时长一个阶段，种子说明上写着；每个阶段都要浇水。学会引水以后，浇一次管两个阶段。'),
      by: 'pip',
      hint: L('Hold the sickle and left click a ripe plant to harvest it. Hold a seed and right click the bare farmland on the bottom row to sow it. Hold the bucket of water and left click a growing plant to water it (the well by the square fills an empty bucket). A hoe on grass makes new farmland.', '拿着镰刀左键点熟了的作物就能收割。拿着种子右键点最下面一行的空耕地就是播种。拿着水桶左键点正在长的作物就是浇水（广场边的井能装满空桶）。拿锄头点草地就能开出新的耕地。'),
      log: L('Hoe, sickle and seeds in hand. The top row is ripe; the bottom row is bare.', '锄头、镰刀和种子都拿了。最上面一排熟了；最下面一行空着。'),
    },
    {
      n: 100,
      on: { objectives: ['harvest', 'sow', 'water'] },
      done: ['harvest', 'sow', 'water'],
      complete: true,
      say: L('You did it! Crops are food, and you can sell them too. With the hoe you can turn any grass into a garden of your own. Here, a few more seeds.', '种成了！收下的作物能吃，也能卖。有了锄头，哪片草地都能开成你自己的菜圃。再给你几粒种子。'),
      by: 'pip',
      reward: { xp: 20, items: [{ type: 'item/seed/turnip', count: 2 }] },
      log: L('Harvested, sowed and watered. With a hoe I can start a garden on any grass.', '收了，种了，也浇了。有了锄头，哪片草地都能开成菜圃。'),
    },
  ],
  start: { auto: { all: [{ enter: GARDEN }, { quest: IN_GAME }] } },
}

/** Each wayside shrine as the demo places it (tools/src/demo/quest/pilgrimage.ts): the guide's markers. */
const shrineAlias = (id: string) => `shrine_${id}`
const LIT = Object.fromEntries(WAYSHRINES.map((s) => [shrineFact(s.id), 1]))

const shrines: QuestDef = {
  id: 'guide_shrines',
  kind: 'guide',
  title: L('Offerings on the Road', '路边的供品'),
  summary: L('Five wayside shrines stand along the Pilgrim\'s Road, one for each of the Five Sufferings, each on its square of flagstones. Hold what a shrine asks, face it and put it down ({key:put}): it takes the offering and lights. The words cut on it ({key:hands}) say what it asks.', '朝圣者之路上立着五座路边圣龛，五苦各一座，每座都立在一小块石板地上。拿着它要的东西，面对它放下（{key:put}），它就收下供品亮起来。石上刻的字（{key:hands}）写着它要什么。'),
  aliases: { pip: { id: LUMI_ID }, ...Object.fromEntries(WAYSHRINES.map((s) => [shrineAlias(s.id), { id: `way.shrine.${s.id}` }])) },
  objectives: WAYSHRINES.map((s) => ({
    id: s.id,
    text: L(`Lay ${s.asks.en} on the ${s.name.en} (hold it, face the shrine, {key:put})`, `给${s.name.zh}献上${s.asks.zh}（拿在手上，面对圣龛按 {key:put}）`),
    target: shrineAlias(s.id),
    on: { fact: { [shrineFact(s.id)]: 1 } },
  })),
  stages: [
    {
      n: 10,
      show: WAYSHRINES.map((s) => s.id),
      say: L('See the dark stone on the flagstones by the road? That\'s one of the shrines the priest talked about! Each one asks for something different; read the carving ({key:hands}) and it tells you. Hold what it asks, face the shrine and put it down ({key:put}). I\'ll mark all five for you.', '看见路边石板地上那块深色的石头了吗？那就是司铎说的圣龛！每座要的东西不一样，读一读上面刻的字（{key:hands}）就知道了。把它要的东西拿在手上，面对圣龛放下（{key:put}）。五座我都给你标出来了。'),
      by: 'pip',
      hint: L('The five shrines, west to east: the Crown asks for something worn on the head (a hat, a hood, a helmet); the Pillar a rope or a cord (cut grass will do); the Scales something to eat; the Nails something made of metal (iron ore will do); the Lance a torch or a candle. The road itself holds one of each: a pilgrim\'s hat, a plaited cord, a loaf in the abandoned cart, a dented helm and a candle ({key:hands} picks them up). Hold the offering, face the shrine and press {key:put}. It will not take a relic, a keepsake, or anything that matters most.', '五座圣龛从西往东：荆棘冠之龛要戴在头上的（帽子、兜帽、头盔）；鞭刑柱之龛要一根绳索（干草也行）；饥刑之秤之龛要一样吃的；钉刑圣木之龛要金属的东西（铁矿石也行）；穿心圣枪之龛要火把或蜡烛。这条路上就各有一样：朝圣者的帽子、苦修者编的草绳、被丢下的推车里的面包、一顶凹陷的头盔、一支蜡烛（按 {key:hands} 捡起来）。拿着供品，面对圣龛按 {key:put}。遗物、纪念品和最要紧的东西，它不收。'),
      log: L('Five shrines along the Pilgrim\'s Road, each asking its own offering. Lumi marked them for me.', '朝圣者之路上有五座圣龛，各要一样供品。露米替我标出来了。'),
    },
    {
      n: 20,
      on: { any: WAYSHRINES.map((s) => ({ fact: { [shrineFact(s.id)]: 1 } })) },
      say: L('It lit! See the little light in the carving? The others work the same way. Pilgrims left things all along this road; what the others ask for is lying about if you look.', '亮了！看见刻痕里那点小光了吗？别的几座也是这样。以前的朝圣者在这条路上丢下了不少东西，别的几座要的，仔细找找都能捡到。'),
      by: 'pip',
      hint: L('Hold the offering, face the shrine and press {key:put}. A shrine that asks for something else says what it wants. The markers show the ones still dark.', '拿着供品，面对圣龛按 {key:put}。献错了，圣龛会说它要什么。标记指着还没亮的那几座。'),
      log: L('The first shrine took my offering and lit.', '第一座圣龛收下供品，亮了。'),
    },
    {
      n: 100,
      on: { fact: LIT },
      done: WAYSHRINES.map((s) => s.id),
      complete: true,
      reward: { xp: 15 },
      log: L('All five shrines took their offerings.', '五座圣龛都收下了供品。'),
    },
  ],
  // after the oath, the first steps onto the road while a shrine is still dark
  start: { auto: { all: [{ enter: 'pilgrimway' }, { quest: { first_seal: { gte: 50 } } }, { fact: { [PILGRIMAGE.shrines]: 0 } }, { quest: IN_GAME }] } },
}

export const GUIDE_QUESTS: QuestDef[] = [skill, profession, fish, farm, shrines]
