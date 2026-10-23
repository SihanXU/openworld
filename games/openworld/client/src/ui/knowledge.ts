// Lumi's practical handbook. Keep this beside the game's panel, not in the shared runtime.
// Controls use the same {key:…} placeholders as quests, so the player's own bindings appear here too.
import type { Text } from '@openworld/engine'

const L = (en: string, zh: string): Text => ({ en, zh })

export const KNOWLEDGE_GROUPS = [
  { id: 'journey', title: L('On the road', '旅途常识') },
  { id: 'living', title: L('Living off the land', '采集与生活') },
  { id: 'craft', title: L('Making things', '制作与建造') },
] as const

export interface KnowledgeEntry {
  id: string
  group: (typeof KNOWLEDGE_GROUPS)[number]['id']
  title: Text
  summary: Text
  sections: { title: Text; body: Text }[]
  tip: Text
}

/** Practical instructions, checked against the authored rules and the wiki; no quest progress is required. */
export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'waypoints', group: 'journey', title: L('Waypoint statues', '传送雕像'),
    summary: L('A light to return to, a place to begin again, and somewhere to change my power.', '点亮一座雕像，就多一个能回去的地方；它也能成为落脚处，让我更换力量。'),
    sections: [
      { title: L('Wake a statue', '唤醒雕像'), body: L('Stand beside an unlit statue and press {key:hands}. It lights up, unlocks a fast-travel destination and becomes your new foothold. On normal difficulty, this is where you return after falling.', '走到未点亮的雕像旁，按 {key:hands} 唤醒它。雕像会发光，解锁传送，并成为新的落脚处；普通难度下倒下后会在这里复活。') },
      { title: L('Travel back', '从地图传送'), body: L('Press {key:map} to open the world map, then click an awakened statue to travel there from anywhere. Unawakened statues cannot be used. Travel is unavailable during a story scene, a question or while the world is learning an action.', '按 {key:map} 打开世界地图，点击已唤醒的雕像，就能从别处传送过去。未唤醒的雕像不能传送；剧情演出、问答或世界正在学习动作时也暂时不能传送。') },
      { title: L('Change a power', '更换露米的力量'), body: L('Press {key:hands} on an awakened statue to open the powers page. Within three tiles of it, you can choose a power I have already gained. I carry one at a time, and must be on your map for it to help you.', '对已唤醒的雕像按 {key:hands}，会打开「印之力量」。在雕像三格以内，可以切换已经获得的力量。我一次只能携带一种，也要与你在同一张地图上才能生效。') },
    ],
    tip: L('Wake a statue when you reach a new place. Listening to one already awake does not change your foothold; sleeping in a bed does.', '到了新地方，记得先唤醒雕像。再次倾听已亮的雕像不会改变落脚处；想把落脚处改回家里，回床上睡一觉就好。'),
  },
  {
    id: 'skills', group: 'journey', title: L('Skills & professions', '技能与职业'),
    summary: L('A little practice becomes a skill; a profession opens a new road.', '升级后别忘了花技能点；选定职业，还会打开一条新的成长道路。'),
    sections: [
      { title: L('Spend skill points', '学习技能'), body: L('Open the skill tree with {key:skills}. Select a skill to see its effects, prerequisites and point cost. Life skills can help with gathering, fishing, farming and smithing.', '按 {key:skills} 打开技能树，点选技能查看效果、前置条件和所需点数。生活技能能帮助采集、钓鱼、种植和锻造。') },
      { title: L('Choose a profession', '选择职业'), body: L('At level 5, visit Bram in the drill yard of Firstlight Village. Look for the crossed-blades marker and press {key:hands} to talk. Choose assassin, warrior, ranger or mage to open that profession’s skill branch.', '达到 5 级后，去初原村操练场找布拉姆。他头顶有交叉双剑标记，按 {key:hands} 与他交谈，可以选择刺客、战士、游侠或法师，解锁对应的技能分支。') },
      { title: L('Use active skills', '使用主动技能'), body: L('Hover a learned active skill in the skill tree and press a skill-slot key ({key:casts}) to assign it. Back in the world, that key casts it. Passive skills take effect once learned.', '在技能树中把鼠标放到已学会的主动技能上，按技能栏按键（{key:casts}）装入对应格子。回到游戏后按同一个键施放；被动技能学会就会生效。') },
    ],
    tip: L('Read a skill’s prerequisites before saving up points for it.', '想学某个技能，先看看它需要哪些前置技能，再安排点数。'),
  },
  {
    id: 'fishing', group: 'living', title: L('Fishing', '钓鱼'),
    summary: L('Bring a rod, find a quiet patch of water, and watch the float.', '带上鱼竿，找一格安静的水，留意浮漂的动静。'),
    sections: [
      { title: L('Rod & bait', '准备鱼竿和鱼饵'), body: L('Open crafting with {key:craft}: two sticks and two tufts of grass make a fishing rod by hand. Bait is sold at the Held Ground’s market stall. Hold the rod and right-click yourself to choose bait; matching bait can be topped up, but use it up before changing kinds.', '按 {key:craft} 打开制作，用 2 根树枝和 2 把干草就能徒手做鱼竿。鱼饵可以在誓守之地的货摊购买。拿着鱼竿右键点自己，选择鱼饵装上；同种鱼饵可以追加，换另一种前要先用完。') },
      { title: L('Cast & reel', '抛竿和收线'), body: L('Hold the rod and left-click shallow or deep water within three tiles. In the Held Ground and its grounds, wait for a bite, then click or press {key:attack} to reel. Hold to raise the control zone and release to lower it; keep the fish inside until the catch bar fills. Other waters resolve the catch immediately.', '拿着鱼竿，左键点三格以内的浅水或深水抛竿。在誓守之地及其扩建区域，等鱼咬钩后点击左键或按 {key:attack} 开始收线；按住抬高控制区，松开下降，让鱼待在控制区里，直到捕获进度满。其他水域会直接结算鱼获。') },
      { title: L('Find different fish', '寻找不同的鱼'), body: L('Bait improves the chance of a bite; an unbaited rod still works. Time, weather and water depth affect the fish: eels at night, catfish in rain, pike in deep water. A cast stirs its tile for ten seconds, so move to another tile while it settles.', '挂饵能提高咬钩几率，没饵也能钓。时辰、天气和水深会影响鱼种：夜里有鳗鱼，下雨有鲶鱼，深水有狗鱼。抛竿后那格水会搅浑十秒，换一格水就能继续试。') },
    ],
    tip: L('Leave room in your pack. Fish can be eaten, cooked or sold; a rare catch may be worth more at the market than on the fire.', '出发前给背包留些空位。鱼可以吃、烤熟或出售，稀有鱼先看看价钱，再决定要不要下锅。'),
  },
  {
    id: 'farming', group: 'living', title: L('Farming', '种植与农耕'),
    summary: L('Till, sow, water and harvest — a small patch can feed you for the road.', '锄地、播种、浇水、收获，一小块菜地也能备好旅途的口粮。'),
    sections: [
      { title: L('Start a garden', '开垦和播种'), body: L('Hold a hoe and left-click grass or dirt to till it. Hold seeds and right-click empty farmland to sow. The garden tool chest in Firstlight Village has starter supplies; the Held Ground’s market sells more seeds.', '拿锄头左键点草地或泥地，开垦成农田。再拿着种子右键点空农田播种。初原村菜圃旁的工具箱有入门物资，更多种子可以去誓守之地货摊买。') },
      { title: L('Water each stage', '浇水与生长'), body: L('Use an empty bucket on water to fill it, then use the full bucket on the crop with a right click. Crops need open sky and water at each growth stage; their item descriptions show the time needed. Rain does not water farmland.', '拿空桶右键点水源装水，再拿满桶右键点作物浇水。作物需要露天生长，每个阶段都要有水，种子说明会写所需时间；下雨不能代替浇水。') },
      { title: L('Harvest & sow again', '收获与再种'), body: L('Use a sickle with a left click to harvest a ripe crop, or press {key:hands} to pick it by hand. A sickle gives more produce and seeds. Some crops, such as tomatoes, bear again after you water them.', '成熟后拿镰刀左键收割，也可以按 {key:hands} 徒手采摘。镰刀能带回更多作物和种子。番茄等多年生作物收获后，再浇水还会继续结果。') },
    ],
    tip: L('The planting page in build mode ({key:build}) also helps you till, sow, water and harvest.', '建造模式（{key:build}）里的「种植」页，也可以帮你开垦、播种、浇水和收割。'),
  },
  {
    id: 'cooking', group: 'living', title: L('Food & cooking', '食物与烹饪'),
    summary: L('A warm meal goes further than raw food. Keep something to eat in your pack.', '烤熟的食物通常更顶饿，背包里常备一点口粮吧。'),
    sections: [
      { title: L('Cook over a fire', '把生食烤熟'), body: L('Hold raw fish, meat or a mushroom and right-click a lit campfire or another cooking fixture. One portion becomes cooked food and stays with you. A cold campfire must be lit first, for example with a torch.', '拿着生鱼、生肉或蘑菇，右键点燃烧中的营火等炊具，就能烤熟一份，熟食还留在自己身上。营火没点着时，先用火把等火源点火。') },
      { title: L('Eat & recover', '吃东西和恢复'), body: L('Select food in your toolbar and left-click to eat it. Food restores hunger; staying well fed lets health recover over time. Cooked fish and meat restore more hunger than their raw forms.', '在快捷栏选中食物，左键就能吃。食物回复饱食度；保持吃饱，生命会逐渐恢复。熟鱼、熟肉通常比生食回复更多饱食度。') },
      { title: L('Choose the right fire', '认准炊具'), body: L('A lit campfire, brazier or forge can cook food. A glowing lamp is not a stove. Keep wood, grass and other flammable supplies out of the fire unless you intend to burn them.', '点着的营火、火盆、熔炉等可以烤东西，发亮的路灯不算炊具。木头、干草等易燃物放进火里会烧掉，别和食物弄混了。') },
    ],
    tip: L('Eat before a long trip or a night’s sleep. Hunger can wake you before morning.', '远行或睡觉前先吃点东西，肚子饿可是会半夜醒来的。'),
  },
  {
    id: 'smithing', group: 'craft', title: L('Smelting & smithing', '冶炼与锻造'),
    summary: L('Ore becomes a bar at the forge; a bar becomes equipment at the anvil.', '矿石在熔炉里变成锭，金属锭在铁砧上变成装备。'),
    sections: [
      { title: L('Find a smithy', '找到铁匠铺'), body: L('Firstlight Village, the Held Ground and Emberfall have forges and anvils. Haldor in Firstlight sells smithing hammers, coal, iron ore and iron bars. You can use the workstations even when the smith is away.', '初原村、誓守之地和余烬镇都有熔炉、铁砧。初原村的哈尔多出售锻锤、煤炭、铁矿石和铁锭；铁匠不在时，旁边的工作设施照样能用。') },
      { title: L('Smelt metal', '先把矿石炼成锭'), body: L('Press {key:hands} on a forge to open it. The iron recipe turns two iron ore and one coal into two iron bars. Gold and steel recipes require their smithing skills. You can also use iron ore directly on a lit forge with a right click.', '对熔炉按 {key:hands} 打开熔炉面板。基础配方用 2 块铁矿石和 1 块煤炭炼出 2 块铁锭；金锭、钢条需要对应的锻造技能。也可以拿铁矿石右键点已点燃的熔炉，直接熔炼。') },
      { title: L('Forge equipment', '再到铁砧打造'), body: L('Bring bars and a smithing hammer and press {key:hands} on an anvil to open it. Choose a weapon, armour piece or tool and check its materials and requirements. Your level and smithing skills affect the result; advanced recipes need skills shown in the recipe.', '带上金属锭和锻锤，对铁砧按 {key:hands} 打开铁砧面板，选择武器、护甲或工具，查看材料和条件。角色等级与锻造技能会影响成品；高级配方需要先学会配方中列出的技能。') },
    ],
    tip: L('Need ore? Dawn Hill Mine north of Firstlight has iron and coal. Take a pickaxe, and make room for what you bring back.', '缺矿石可以去初原村北面的晨光丘矿洞，那里有铁矿和煤。记得带镐，也给带回来的材料留些空位。'),
  },
  {
    id: 'crafting', group: 'craft', title: L('Crafting & the workshop', '制作与工坊'),
    summary: L('Everything is made from the bag; the Held Ground\'s buildings open more recipes.', '东西都在背包里直接做；领地的建筑会解锁更多配方。'),
    sections: [
      { title: L('Make it from the bag', '在背包里做'), body: L('Press {key:craft} to open crafting. Nothing is made beside a bench: what the panel lists is made wherever you stand, from what you carry. Tools a recipe asks for are carried, not used up.', '按 {key:craft} 打开制作面板。做东西不用站在什么旁边：面板里列的配方，站在哪里都能用身上的材料做。配方要的工具只需带着，不会消耗。') },
      { title: L('Buildings unlock recipes', '建筑解锁配方'), body: L('Simple tools are made by hand from the first. The rest wait for a building on the Held Ground: the Workshop opens the club, the shield and the bow, and raised to Workshop II, candles, lanterns and a smith\'s own forge; the Weaving Shed opens cloth and, for a Leatherworker, leather gear. A greyed recipe names the building it waits for.', '简单的工具一开始就能徒手做。其余的要等领地里建好对应的建筑：工坊解锁棍棒、盾牌和弓，升到工坊 II 后还有蜡烛、提灯和铁匠炉；织坊解锁织布，皮匠还能做皮甲。灰掉的配方上会标着它在等哪座建筑。') },
      { title: L('Forges, anvils and the smithy', '熔炉、铁砧与铁匠铺'), body: L('Smelting and smithing are done at the thing itself: press {key:hands} on a forge or an anvil and its own panel opens. The Held Ground\'s smithy can be bettered twice: a bellows lets a skilled smith forge heavy arms, plate, metal tools and jewellery; a hardened anvil, the professions\' sets.', '冶炼和锻造在设施本身进行：对熔炉或铁砧按 {key:hands} 打开它的面板。领地的铁匠铺能升级两次：装上风箱后，学了技能的铁匠能打重兵器、板甲、金属工具和首饰；淬硬铁砧后能锻造职业套装。') },
      { title: L('The arcane workshop', '魔法工坊'), body: L('Built on the Held Ground, its workbench makes wands, staves (a mage\'s alone), healing and fireproof draughts, and spell books: read one to learn a mage\'s spell. Raised to Arcane Workshop II, it makes staves of fire and frost and the deeper spell books.', '在领地建好魔法工坊后，对魔法工作台按 {key:hands}：能做魔杖、法杖（只有法师能用）、治疗药水、防火药剂和法术书，读一本就学会一个法师法术。升到魔法工坊 II 后还能做火焰、冰霜法杖和更深的法术书。') },
    ],
    tip: L('Ask Alberic about the Held Ground to see what each building unlocks before you gather for it.', '收集材料之前，先找阿尔贝里克打开领地扩建面板，看看每座建筑会解锁什么。'),
  },
  {
    id: 'building', group: 'craft', title: L('Building & moving', '建造与搬放'),
    summary: L('Build a place to call home, and move it a piece at a time when you need to.', '从一面墙、一张床开始安家，想换地方时，也可以把它们搬走。'),
    sections: [
      { title: L('Build nearby', '放置建筑'), body: L('Press {key:build}, choose something on the building page, then left-click or press {key:hands} to place it within reach. The panel shows the materials needed. Hold and drag to build a row; use {key:rotate} when a piece supports rotation.', '按 {key:build} 打开建造模式，选好建筑，左键或按 {key:hands} 放在身边够得着的位置。面板会显示所需材料；按住拖动可以建一排，有方向的建筑用 {key:rotate} 旋转。') },
      { title: L('Build from your hand', '拿在手上也能建'), body: L('Hold a crafted wall, floor or bed and right-click a suitable tile to set it up. Pressing {key:put} only drops it loose on the ground; it does not build it. Press {key:hands} to pick up a loose piece again.', '做好墙、地板或床后，拿在手上右键点合适的位置，也能直接建起来。按 {key:put} 只是把它散放在地上，并不会完成建造；散落的东西可以按 {key:hands} 捡回。') },
      { title: L('Move your furniture', '搬走和重新摆放'), body: L('For built walls, floors, doors, stairs, beds and workbenches, use an axe, pickaxe or hammer with a left click to knock the piece loose. Pick it up with {key:hands}, then set it up elsewhere with a right click.', '已经建好的墙、地板、门、楼梯、床和工作台，可以用斧头、镐或锤子左键敲松，再按 {key:hands} 捡起，带到新位置右键重新摆放。') },
    ],
    tip: L('Time keeps moving in build mode. Choose a safe spot before spending a long time arranging your home.', '建造模式里时间仍会流逝。想慢慢布置家里，先确认周围安全。'),
  },
]
