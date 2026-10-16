// The fairy's guides (docs/quests.md §3, the guides): quests of the kind `guide`, each teaching one of the game's
// systems the clearing did not — the skill tree, the professions, fishing, the garden. Lumi begins them herself:
// a beat of the story notices the moment (a skill point unspent, level five without a profession, the first steps
// onto the pond's bank or into the garden) and the quest answers it, as the main line answers the story's steps;
// she tells the player in her own words (the stages' lines are hers, `by: 'pip'`) and her panel shows them beside
// the main road. Every objective is a state of the world (what is carried, a crop standing, a status, a word with
// the trainer), never a path.

import type { QuestDef, StepDef } from '@openworld/engine'
import { L } from './kit.ts'
import { FIRSTLIGHT } from '../firstlight.ts'

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
  summary: L('Every level brings a skill point. The skill tree (K) spends them: the general skills are open to anyone — gathering, crafting, a steadier hand in a fight.', '每升一级都有一个技能点。技能树（K）用来花它们：通用技能谁都能学——采集、制作，还有打起来更稳的手。'),
  aliases: { pip: { id: LUMI_ID } },
  objectives: [{ id: 'learn', text: L('Open the skill tree (K) and learn a skill', '打开技能树（K），学一个技能'), on: { step: 'guide_skill_learned' } }],
  stages: [
    {
      n: 10,
      show: ['learn'],
      say: L('You went up a level! Every level gives you a skill point — press K and spend it on something. The general skills are for everyone; the profession ones wait until you have a profession.', '你升级啦！每升一级都有一个技能点——按 K 打开技能树，先学一个你喜欢的。通用技能谁都能学，职业技能要等有了职业才行。'),
      by: 'pip',
      hint: L('K opens the skill tree. A skill you can learn now is lit; click it to learn it. Hunting, gathering, crafting, fighting — pick what you do most.', 'K 打开技能树。现在能学的技能是亮着的，点一下就学会了。打猎、采集、制作、战斗——挑你最常做的那一类。'),
      log: L('A level up, and a skill point to spend. Lumi says: K.', '升级了，有一个技能点可以花。露米说：按 K。'),
    },
    {
      n: 100,
      on: { step: 'guide_skill_learned' },
      done: ['learn'],
      complete: true,
      say: L('That is yours now. Every level, another point — come back to the tree when you have one.', '这个技能是你的了。每升一级再来一点——有点数了就回来看看技能树。'),
      by: 'pip',
      reward: { xp: 10 },
      log: L('My first skill. The tree grows with every level.', '我的第一个技能。技能树随着等级一起长。'),
    },
  ],
  start: { auto: { step: 'guide_skill' } },
}

const profession: QuestDef = {
  id: 'guide_profession',
  kind: 'guide',
  title: L('A Road of Your Own', '选一条路'),
  summary: L('At level five the trainer Bram sets you on a profession in the drill yard of Firstlight Village: assassin, warrior, ranger or mage. A profession has its own weapon, its own branch of the skill tree, and its own sets of gear; it can be changed later, at the cost of starting its branch again.', '到了五级，初原村操练场的导师布拉姆会给你指一条路：刺客、战士、游侠或法师。职业有自己的武器、自己的技能分支和自己的套装；以后可以换，代价是那条分支重新开始。'),
  aliases: { pip: { id: LUMI_ID }, trainer: { id: TRAINER_ID, essential: true } },
  objectives: [
    { id: 'trainer', text: L('Speak to Bram, the trainer, in the drill yard of Firstlight Village', '去初原村操练场找导师布拉姆说话'), target: 'trainer', talk: true, on: { talk: 'trainer' } },
    { id: 'choose', text: L('Choose a profession', '选择一个职业'), target: 'trainer', on: { step: 'guide_profession_chosen' } },
  ],
  stages: [
    {
      n: 10,
      show: ['trainer', 'choose'],
      say: L('Level five! You know what that means — Bram said he sets people on a road at five. He keeps the drill yard in Firstlight, by the north-east cottage, with crossed blades over his head. Let us go and pick one!', '五级了！你还记得吧——布拉姆说过，到五级他就给人指路。他在初原村的操练场，东北角那间小屋旁边，头顶有交叉双剑的标记。我们去选一条路吧！'),
      by: 'pip',
      hint: L('Bram keeps the drill yard of Firstlight Village day and night (crossed blades over his head). E opens his panel: four roads, each with its weapon. A dagger from behind, a sword and shield from the front, a bow from afar, a staff from wherever you stand.', '布拉姆日夜都在初原村的操练场（头顶有交叉双剑）。对他按 E 打开面板：四条路，各有自己的武器。匕首从背后，剑盾从正面，弓从远处，法杖从你站着的地方。'),
      log: L('Level five. Lumi says Bram will set me on a road now.', '五级了。露米说布拉姆现在会给我指一条路。'),
    },
    {
      n: 20,
      on: { talk: 'trainer' },
      done: ['trainer'],
      hint: L('Pick the road in his panel: the weapon is what you will fight with, and the branch of the skill tree that answers it. You can change later, but that branch starts again.', '在他的面板里选：武器就是你以后用来打的东西，技能树里对应的分支也跟着来。以后能换，但那条分支要从头来。'),
      log: L('Bram: dagger, sword and shield, bow or staff. Which am I?', '布拉姆：匕首、剑盾、弓，还是法杖。我是哪一种？'),
    },
    {
      n: 100,
      on: { step: 'guide_profession_chosen' },
      done: ['trainer', 'choose'],
      complete: true,
      say: L('A road of your own! Your profession\'s branch is open in the skill tree now (K), and its weapon is yours to fight with. Bram sells the first one if you have none.', '你有自己的路了！技能树（K）里职业的分支现在开了，它的武器也归你用了。手上没有的话，布拉姆那里有卖。'),
      by: 'pip',
      reward: { xp: 20 },
      log: L('I chose. The profession\'s branch is open in the tree.', '我选好了。技能树里职业的分支开了。'),
    },
  ],
  start: { auto: { step: 'guide_profession' } },
}

const fish: QuestDef = {
  id: 'guide_fish',
  kind: 'guide',
  title: L('The First Cast', '第一竿'),
  summary: L('Any water with fish in it will do — the pond south of the square in Firstlight is the nearest. A fishing rod is two sticks and two tufts of grass in your hands (C), or a few coins at the general store. Stand on the bank, hold the rod and left click the water; bait on the hook makes them bite twice as often.', '只要是有鱼的水都行——初原村广场南边的池塘最近。鱼竿用两根树枝和两把草徒手就能做（C），杂货店也有卖。站在岸边，拿着鱼竿左键点水；钩上挂了鱼饵，咬钩的机会翻倍。'),
  aliases: { pip: { id: LUMI_ID }, pond: { place: POND } },
  objectives: [
    { id: 'rod', text: L('Get a fishing rod (C: two sticks and two tufts of grass; or the general store)', '弄一根鱼竿（C 制作：两根树枝、两把草；或在杂货店买）'), on: { carry: ROD } },
    { id: 'fish', text: L('Catch a fish in the pond (hold the rod, left click the water)', '在池塘里钓起一条鱼（拿着鱼竿，左键点水）'), target: 'pond', on: { carry: FISH } },
  ],
  stages: [
    {
      n: 10,
      show: ['rod', 'fish'],
      say: L('Look, a pond — and something just jumped! Fish are food that comes back every day. Make a rod: two sticks and two tufts of grass, in your hands (C). Then stand on the bank, hold it and left click the water.', '看，一个池塘——刚才有东西跳起来了！鱼是天天都有的吃的。做根鱼竿吧：两根树枝、两把草，徒手就能做（C）。然后站到岸边，拿着它左键点水。'),
      by: 'pip',
      hint: L('A rod is two sticks and two tufts of grass (C, by hand); the general store sells one too. On the bank, hold it and left click the water: sometimes something bites. A cast stirs the water — wait a moment before the next.', '鱼竿是两根树枝加两把草（C，徒手做）；杂货店也有卖。在岸边拿着它左键点水：有时候会咬钩。甩一竿会把水搅浑——等一会儿再甩下一竿。'),
      log: L('A pond in the village. Lumi wants to see me fish.', '村里有个池塘。露米想看我钓鱼。'),
    },
    {
      n: 20,
      on: { carry: ROD },
      done: ['rod'],
      say: L('A rod! Now to the water. Hold it and left click the pond; if nothing bites, cast again when the ripples settle. Bait on the hook (right click the rod with bait in hand) brings them twice as fast.', '有竿了！到水边去。拿着它左键点池塘；没咬钩就等水面平了再甩。钩上挂鱼饵（拿着鱼饵对鱼竿用）咬钩快一倍。'),
      by: 'pip',
      hint: L('Stand on the bank with the rod in hand and left click the water. A cast stirs it: wait a moment between casts. At first light, rarely, a Dawnscale bites.', '站在岸边，手拿鱼竿，左键点水。甩一竿水会浑：两竿之间等一会儿。清晨偶尔会钓到晨鳞鱼。'),
      log: L('A fishing rod of my own. Now the pond.', '有了自己的鱼竿。该去池塘了。'),
    },
    {
      n: 100,
      on: { carry: FISH },
      done: ['rod', 'fish'],
      complete: true,
      say: L('You caught one! Cook it on a fire, or eat it as it is. What bites changes with the hour and the weather — eels at night, catfish in the rain. Here, some bait for next time.', '钓到啦！在火上烤了吃，或者直接吃也行。钓到什么看时辰和天气——夜里有鳗鱼，下雨有鲶鱼。给你一点鱼饵，下次用。'),
      by: 'pip',
      reward: { xp: 15, items: [{ type: 'item/misc/bait', count: 3 }] },
      log: L('My first fish. The hour and the weather decide what bites.', '我的第一条鱼。钓到什么看时辰和天气。'),
    },
  ],
  start: { auto: { all: [{ enter: POND }, { quest: IN_GAME }] } },
}

const farm: QuestDef = {
  id: 'guide_farm',
  kind: 'guide',
  title: L('A Lesson in the Garden', '菜圃的一课'),
  summary: L('The kitchen garden of Firstlight Village has a supplies crate with a hoe, a sickle, a bucket of water and seeds. Harvest a ripe crop with the sickle, sow a seed on the bare row, water it: each stage takes one to four hours depending on the crop, as its seed says. A hoe turns grass into farmland for a garden of your own.', '初原村的菜圃旁有个工具箱，里面有锄头、镰刀、一桶水和种子。用镰刀收割一株熟了的作物，在空着的那一行播一粒种子，再浇上水：每阶段要一到四游戏小时，看作物种类，种子说明里有。锄头能把草地翻成耕地，开一片自己的菜圃。'),
  aliases: { pip: { id: LUMI_ID }, garden: { place: GARDEN }, crate: { id: 'ford.garden.supplies' } },
  objectives: [
    { id: 'hoe', text: L('Take the hoe from the garden supplies (E on the crate)', '从菜圃工具箱里拿锄头（对箱子按 E）'), target: 'crate', on: { carry: { type: 'item/tool/hoe' } } },
    { id: 'sickle', text: L('Take the sickle', '拿镰刀'), target: 'crate', on: { carry: { type: 'item/tool/sickle' } } },
    { id: 'seeds', text: L('Take some seeds', '拿一些种子'), target: 'crate', on: { carry: { type: 'item/seed' } } },
    { id: 'harvest', text: L('Harvest a ripe crop with the sickle (hold it, left click the crop)', '用镰刀收割一株成熟的作物（拿着镰刀，左键点作物）'), target: 'garden', on: { carry: { tags: ['vegetable'] } } },
    { id: 'sow', text: L('Sow a seed on the bare row of the garden (hold the seed, left click the farmland)', '在菜圃空着的那一行播一粒种子（拿着种子，左键点耕地）'), target: 'garden', on: { step: 'guide_sowed' } },
    { id: 'water', text: L('Water a crop (hold the bucket of water, left click the crop)', '给一株作物浇水（拿着水桶，左键点作物）'), target: 'garden', on: { step: 'guide_watered' } },
  ],
  stages: [
    {
      n: 10,
      show: ['hoe', 'sickle', 'seeds'],
      say: L('This is the village garden! The crate at its corner has everything — a hoe, a sickle, a bucket of water and seeds. Open it (E) and take the hoe, the sickle and some seeds. We can borrow them.', '这是村里的菜圃！角上那个箱子里什么都有——锄头、镰刀、一桶水，还有种子。打开它（E），拿上锄头、镰刀和一些种子。借来用用没关系。'),
      by: 'pip',
      hint: L('The supplies crate stands at the garden\'s east corner. E opens it; take the hoe, the sickle and some seeds (and the bucket of water, for later).', '工具箱在菜圃东边的角上。按 E 打开，拿锄头、镰刀和一些种子（水桶也拿上，待会儿用）。'),
      log: L('The village garden, and a crate of tools beside it. Lumi wants to teach me to grow things.', '村里的菜圃，旁边有一箱工具。露米想教我种东西。'),
    },
    {
      n: 20,
      on: { objectives: ['hoe', 'sickle', 'seeds'] },
      done: ['hoe', 'sickle', 'seeds'],
      show: ['harvest', 'sow', 'water'],
      say: L('Good. See the three rows? Sprouts, young plants, and the top row is ripe. Harvest one with the sickle — it gives the crop and seeds back. Then sow a seed on the bare bottom row, and water it with the bucket. Each stage takes one to four hours: check the seed. Water each stage; Irrigation supplies two.', '好。看见那三排了吗？嫩芽、小苗，最上面一排熟了。用镰刀收一株——能得到作物，种子也会回来。然后在最下面空着的那行播一粒种子，再用水桶浇上水。每阶段要一到四游戏小时，看看种子说明。每阶段需浇水；学会引水后浇一次能长两阶段。'),
      by: 'pip',
      hint: L('Hold the sickle and left click a ripe plant to harvest it. Hold a seed and left click the bare farmland on the bottom row to sow it. Hold the bucket of water and left click a growing plant to water it (the well by the square fills an empty bucket). A hoe on grass makes new farmland.', '拿着镰刀左键点熟了的作物就能收割。拿着种子左键点最下面一行的空耕地就是播种。拿着水桶左键点正在长的作物就是浇水（广场边的井能装满空桶）。拿锄头点草地就能开出新的耕地。'),
      log: L('Hoe, sickle and seeds in hand. The top row is ripe; the bottom row is bare.', '锄头、镰刀和种子都拿了。最上面一排熟了；最下面一行空着。'),
    },
    {
      n: 100,
      on: { objectives: ['harvest', 'sow', 'water'] },
      done: ['harvest', 'sow', 'water'],
      complete: true,
      say: L('You are a gardener now! Harvested crops are food, and the stall on the Held Ground buys them when you have one. With the hoe you can turn any grass into a garden of your own. Here — a few more seeds.', '你会种地啦！收下的作物是吃的，以后有了誓守之地，那里的货摊也收。有了锄头，哪里的草地都能开成你自己的菜圃。给你，再来几粒种子。'),
      by: 'pip',
      reward: { xp: 20, items: [{ type: 'item/seed/turnip', count: 2 }] },
      log: L('Harvested, sown, watered. A garden of my own, wherever I put the hoe to the ground.', '收了、种了、浇了。锄头落到哪儿，哪儿就能是我的菜圃。'),
    },
  ],
  start: { auto: { all: [{ enter: GARDEN }, { quest: IN_GAME }] } },
}

export const GUIDE_QUESTS: QuestDef[] = [skill, profession, fish, farm]
