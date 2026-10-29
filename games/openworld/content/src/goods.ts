// The continent's goods (docs/continent.md §9 D, §10): what each region makes in its own way, in both languages —
// about a thousand kinds of thing with the base forms, and the stock every backdrop settlement keeps of them.
//
// A regional form is a variant of a base form (items.ts): its type lies under the base's (`<base>/<region>_<slug>`),
// so it is what its base is to every rule — a Fenland sword strikes as a sword, a Smoked Herring is eaten as grilled
// fish — and differs in its name, its picture, its worth, the materials it is worked in and where it is found. Three
// sorts, as the reference games keep them (Skyrim's cultures each make a full line of the same arms — Nordic,
// Imperial, Elven — that fight alike; Elin's things name an origin they take their trait from):
//
// - a region's **line**: its smiths', tailors' and jewellers' own make of every piece of gear and tool
//   ("Fenland Sword", 苍沼剑), worked in the metals and cloths the region has;
// - its **local kinds**: what is made or found only there (a Whaling Harpoon, Chaff Bread, a Mourning Veil);
// - its **named pieces** (`*`): the famous makes a region is known for, rarer and dearer, gear of them always fine.
//
// They are never laid on the played maps (`where` is empty, so the Ford's rolls do not change): the backdrop's
// shops, houses and chests keep them (`stockFor`, tools/src/demo/continent/stock.ts).

import { FORMS, type Context, type Form } from './items.ts'

/** The base forms a region's goods vary, by a short name. */
const BASE: Record<string, string> = {
  sword: 'item/weapon/blade/sword', dagger: 'item/weapon/blade/dagger', axe: 'item/weapon/blade/axe', scimitar: 'item/weapon/blade/scimitar',
  club: 'item/weapon/blunt/club', mace: 'item/weapon/blunt/mace', warhammer: 'item/weapon/blunt/warhammer', spear: 'item/weapon/polearm/spear',
  halberd: 'item/weapon/polearm/halberd', bow: 'item/weapon/ranged/bow', wand: 'item/weapon/magic/wand', staff: 'item/weapon/magic/staff',
  helmet: 'item/armor/helmet', shield: 'item/armor/shield', breastplate: 'item/armor/breastplate', pauldrons: 'item/armor/pauldrons',
  jerkin: 'item/armor/jerkin', quiver: 'item/armor/quiver', tome: 'item/armor/tome', parry: 'item/armor/parrying_dagger',
  cloak: 'item/clothing/cloak', belt: 'item/clothing/belt', hat: 'item/clothing/hat', hood: 'item/clothing/hood', boots: 'item/clothing/boots',
  robe: 'item/clothing/robe', gloves: 'item/clothing/gloves',
  pickaxe: 'item/tool/pickaxe', shovel: 'item/tool/shovel', hoe: 'item/tool/hoe', sickle: 'item/tool/sickle', hammer: 'item/tool/smith_hammer',
  knife: 'item/tool/knife', rope: 'item/tool/rope', broom: 'item/tool/broom', rod: 'item/tool/fishing_rod',
  torch: 'item/light/torch', candle: 'item/light/candle', lantern: 'item/light/lantern',
  cup: 'item/vessel/cup', plate: 'item/vessel/plate', pot: 'item/vessel/pot',
  bread: 'item/food/bread', cheese: 'item/food/cheese', pie: 'item/food/pie', honey: 'item/food/honey', wine: 'item/food/wine', ale: 'item/food/ale',
  apple: 'item/food/apple', berries: 'item/food/berries', fish: 'item/food/fish/raw', fishc: 'item/food/fish/cooked', meatc: 'item/food/meat/cooked',
  chickenc: 'item/food/chicken/cooked', mushroom: 'item/food/mushroom/raw',
  healing: 'item/potion/healing', antidote: 'item/potion/antidote', fireproof: 'item/potion/fire_resist',
  cloth: 'item/material/cloth', leather: 'item/material/leather', wool: 'item/material/wool', salt: 'item/material/salt', herb: 'item/material/herb',
  wax: 'item/material/wax', feather: 'item/material/feather', log: 'item/material/log',
  ring: 'item/valuable/ring', amulet: 'item/valuable/amulet', earring: 'item/valuable/earring', goblet: 'item/valuable/goblet', pouch: 'item/valuable/coin_pouch',
  gem: 'item/gem',
  book: 'item/document/book', scroll: 'item/document/scroll', letter: 'item/document/letter', map: 'item/document/map',
  bell: 'item/misc/bell', flute: 'item/misc/flute', lute: 'item/misc/lute', dice: 'item/misc/dice', doll: 'item/misc/doll', mirror: 'item/misc/mirror',
  quill: 'item/misc/feather_quill', ink: 'item/misc/ink', soap: 'item/misc/soap', key: 'item/key',
}

/** What a region's line is made of every piece of gear and tool. */
const LINE = ['sword', 'dagger', 'axe', 'scimitar', 'club', 'mace', 'warhammer', 'spear', 'halberd', 'bow', 'wand', 'staff', 'helmet', 'shield', 'breastplate', 'pauldrons', 'jerkin', 'cloak', 'belt', 'hat', 'hood', 'boots', 'robe', 'gloves', 'pickaxe', 'shovel', 'hoe', 'sickle', 'hammer', 'knife', 'ring', 'amulet', 'earring']

export interface RegionGoods {
  /** The word its line goes by. */
  line: { en: string; zh: string }
  /** The materials its makers work, in the order they prefer (a form takes those of them it can be made of). */
  materials: string[]
  /**
   * Its local kinds and named pieces: a line per base, `base: En|Zh mods; En|Zh mods`. Mods: `*` a named piece,
   * `[a,b]` the materials it comes in, `=a` the one it is of, which its name already says (a Pine Longbow is never
   * "Wooden": material `a`, named for it no more), `@item:key` its picture (else its base's).
   */
  kinds: string
}

export const REGION_GOODS: Record<string, RegionGoods> = {
  frostfang: {
    line: { en: 'Frostfang', zh: '霜牙' },
    materials: ['iron', 'bone', 'wood', 'leather', 'cloth', 'silver', 'bronze'],
    kinds: `
      sword: Fjord Broadsword|峡湾阔剑; Ford-Warden's Sword|渡守之剑; Thornguard Blade|棘卫剑 *
      dagger: Briar Dirk|荆棘短剑; Rime Stiletto|凇刺匕首
      axe: Pinecutter Axe|伐松斧; Bearded Axe|胡须斧
      club: Driftwood Cudgel|浮木短棍 =wood
      mace: Thorn-Knot Mace|棘结钉锤
      warhammer: Icebreaker|破冰战锤 *
      spear: Whaling Harpoon|捕鲸鱼叉 [bone,iron,steel]; Elk Spear|猎麋长矛
      halberd: Ford Bill|渡口钩镰戟
      bow: Pine Longbow|松木长弓 =wood; Elkhorn Bow|麋角弓 =bone
      wand: Rimewood Wand|凇木魔杖 =wood
      staff: Shepherd's Thornstaff|牧人棘杖 =wood; Driftwood Staff|浮木法杖 =wood
      helmet: Fur-Lined Helm|毛衬头盔; Thorn Knight's Helm|荆棘骑士盔 * [iron,steel]
      shield: Pine Roundshield|松木圆盾 =wood; Ford Kite Shield|渡口鸢盾
      breastplate: Coastwatch Cuirass|海哨胸甲; Thorn Knight's Cuirass|荆棘骑士胸甲 * [steel]
      pauldrons: Wolfskin Spaulders|狼皮护肩 =leather
      jerkin: Sealskin Jerkin|海豹皮甲 =leather; Elkhide Jerkin|麋皮甲 =leather
      quiver: Birchbark Quiver|桦皮箭袋
      tome: Book of Rime|凇之书
      cloak: Wolf-Fur Cloak|狼皮斗篷 =leather; Fisher's Oilcloak|渔夫油布斗篷 =cloth; Thornweave Cloak|荆纹斗篷
      belt: Netmender's Belt|补网人腰带
      hat: Fur Cap|毛皮帽 =leather
      hood: Snow Hood|雪地兜帽
      boots: Sealskin Boots|海豹皮靴 =leather; Ford-Wader Boots|涉水长靴
      robe: Wool Habit|羊毛修袍 =cloth
      gloves: Northern Mittens|北地连指手套
      pickaxe: Frost Pick|冻土镐
      shovel: Snow Shovel|雪铲
      sickle: Rye Sickle|黑麦镰
      hammer: Shipwright's Mallet|船匠木槌
      knife: Flensing Knife|剥皮刀; Gutting Knife|剖鱼刀
      rope: Mooring Line|系船麻绳; Tarred Rope|焦油绳
      broom: Birch Besom|桦枝扫帚
      rod: Ice-Fishing Rod|冰钓竿
      torch: Pitch-Pine Torch|松脂火把
      candle: Tallow Candle|兽脂蜡烛
      lantern: Storm Lantern|渔家风灯
      cup: Drinking Horn|饮角 =bone
      plate: Birch Trencher|桦木餐板 =wood
      pot: Fish Kettle|炖鱼锅
      bread: Rye Bannock|黑麦烤饼; Seed Crispbread|籽脆饼
      cheese: Smoked Goat Cheese|烟熏山羊奶酪
      pie: Fish Pie|鱼肉馅饼; Lingonberry Tart|越橘挞
      honey: Heather Honey|石楠蜜
      wine: Crowberry Wine|岩高兰果酒
      ale: Juniper Ale|杜松麦酒
      apple: Crab Apple|野苹果
      berries: Cloudberries|云莓; Lingonberries|越橘
      fish: Herring|鲱鱼; Cod|鳕鱼; Arctic Char|红点鲑
      fishc: Smoked Herring|烟熏鲱鱼; Stockfish|鳕鱼干
      meatc: Roast Elk|烤麋肉
      mushroom: Chanterelle|鸡油菌
      healing: Spruce Tonic|云杉滋补剂
      antidote: Birch-Sap Draught|桦汁解药
      cloth: Homespun|手纺毛呢
      leather: Seal Hide|海豹皮
      wool: Island Fleece|海岛羊毛
      salt: Sea Salt|海盐
      herb: Angelica|当归
      feather: Gull Feather|鸥羽
      log: Pine Log|松木原木
      ring: Amber Ring|琥珀戒指; Thorn Signet|棘印戒 * [silver,gold]
      amulet: Wolf-Tooth Necklace|狼牙项链 =bone; Ford Saint's Medal|渡口圣徽 [silver]
      earring: Gull-Bone Earring|鸥骨耳坠 =bone
      pouch: Sealskin Purse|海豹皮钱袋
      gem: Sea Amber|海珀
      book: Tide Almanac|潮汐历; Book of Sea Shanties|船歌集
      scroll: Scroll of Rime|凇之卷
      letter: Fisherman's Letter|渔夫的家书
      map: Chart of the Fjords|峡湾海图; Pine-Road Map|松路图
      bell: Ship's Bell|船钟
      flute: Bone Whistle|骨哨
      lute: Coast Fiddle|海岸提琴
      dice: Knucklebones|羊拐骨
      doll: Pinecone Doll|松果娃娃
      quill: Gull Quill|鸥羽笔
      ink: Squid Ink|乌贼墨
      soap: Pine-Tar Soap|松焦皂
      key: Boathouse Key|船屋钥匙
      fireproof: Seal-Oil Draught|海豹油药剂
      wax: Bayberry Wax|杨梅蜡
      dice: Walrus-Ivory Dice|海象牙骰子
      mirror: Ice-Clear Mirror|冰明镜
      goblet: Ford-Feast Goblet|渡口宴杯
      chickenc: Roast Grouse|烤松鸡
      amulet: Briar Rosary|荆棘念珠
      book: Saga of the Fords|渡口萨迦 *
      herb: Sea Wormwood|海苦艾
      cheese: Ewe's Whey Cheese|母羊乳清奶酪
    `,
  },
  redmarch: {
    line: { en: 'Redmarch', zh: '赤痕' },
    materials: ['iron', 'steel', 'obsidian', 'bronze', 'leather', 'bone', 'cloth'],
    kinds: `
      sword: Marcher Longsword|边境长剑; Scarblade|痕刃; Banner-Captain's Sword|旗队长之剑 * [steel]
      dagger: Rust Dirk|锈短剑 =iron; Black-Glass Dagger|黑琉璃匕首 =obsidian
      axe: Steppe Hatchet|草原手斧
      scimitar: Steppe Sabre|草原马刀; Red Talwar|赤色弯刀; Hawkwing|鹰翼弯刀 * [steel,obsidian]
      club: Knotted Cudgel|结节棍
      mace: Flanged Mace|翼缘钉锤; Iron Morningstar|铁晨星锤 =iron
      warhammer: Siege Maul|攻城大锤; Fortbreaker|破堡锤 * [steel]
      spear: Lancer's Spear|枪骑长矛; Ochre-Shafted Spear|赭杆长矛
      halberd: Pike of the March|边境长戟; Glaive|长柄刀
      bow: Horn Recurve|角弓 =bone; Horse-Archer's Bow|骑射弓 * [bone]
      wand: Brand Wand|烙印魔杖
      staff: War-Chaplain's Staff|随军牧师杖
      helmet: Banded Helm|箍铁头盔; Horsehair-Crested Helm|马鬃盔 * [steel]
      shield: Tower Shield|塔盾; Hide Buckler|皮小圆盾 =wood
      breastplate: Scale Hauberk|鳞甲; Lamellar Cuirass|札甲胸甲
      pauldrons: Riveted Spaulders|铆钉护肩
      jerkin: Saddle-Leather Jerkin|鞍皮甲 =leather
      quiver: Horse-Archer's Quiver|骑射箭袋
      tome: Field Manual of the March|边境兵书
      parry: Main-Gauche|左手剑
      cloak: Red Campaign Cloak|赤色征袍 =cloth; Felt Saddle-Cloak|毡鞍斗篷 =cloth
      belt: Sword Belt|佩剑腰带 =leather; Lash-Cord Girdle|鞭绳束带
      hat: Felt Steppe Cap|毡帽 =cloth
      hood: Scout's Hood|斥候兜帽
      boots: Riding Boots|马靴 =leather; Hobnailed Boots|平头钉靴 =leather
      robe: Penitent's Sackrobe|苦修者麻袍 =cloth
      gloves: Rider's Gauntlets|骑手护手 =leather; Archer's Glove|射手手套 =leather
      pickaxe: Sapper's Pick|工兵镐
      shovel: Trench Spade|战壕铲
      hammer: Farrier's Hammer|蹄铁匠锤
      knife: Camp Knife|营刀
      rope: Horsehair Rope|马鬃绳; Picket Rope|拴马绳
      broom: Barrack Broom|营房扫帚
      torch: Signal Torch|烽火火把
      candle: Hour Candle|计时蜡烛
      lantern: Picket Lantern|哨灯
      cup: Campaign Cup|行军杯 [wood,clay]
      plate: Mess Bowl|行军饭碗 =wood
      pot: Soldier's Kettle|兵锅
      bread: Hardtack|硬饼干; Ash-Baked Flatbread|炭烤薄饼
      cheese: Mare's Curd|马奶酪
      pie: Mutton Pie|羊肉馅饼
      wine: Bloodwine|血红酒
      ale: Kumis|马奶酒
      berries: Rosehips|蔷薇果
      meatc: Saddle Jerky|鞍下肉干; Spit-Roast Mutton|烤羊肉串
      chickenc: Bustard Roast|烤鸨肉
      healing: Field Surgeon's Draught|军医药剂
      antidote: Steppe Wormwood Tonic|草原苦艾药
      fireproof: Ember-Ward Draught|御烬药剂
      cloth: Red Felt|红毡
      leather: Horsehide|马皮
      wool: Fat-Tail Fleece|肥尾羊毛
      herb: Steppe Sage|草原鼠尾草
      feather: Hawk Feather|鹰羽
      ring: Bloodstone Ring|血石戒指; Veteran's Signet|老兵印戒 * [iron,silver]
      amulet: Scar-Ward Charm|痕护符; Arrowhead Pendant|箭镞吊坠 [iron,bone]
      earring: Iron Hoop Earring|铁环耳环 =iron
      goblet: Victor's Goblet|凯旋高脚杯 * [gold]
      pouch: Pay Pouch|军饷袋
      gem: Bloodstone|血石
      book: Roll of the Fallen|阵亡名册; Chronicle of the Long War|长战纪
      scroll: Muster Scroll|征召卷轴
      letter: Dispatch|军报; Letter from the Front|前线来信
      map: Campaign Map|战地图
      bell: Alarm Bell|警钟
      flute: Signal Horn|号角
      lute: Steppe Fiddle|草原胡琴
      dice: Barrack Dice|营房骨骰
      doll: Tin Soldier|锡兵人偶
      mirror: Polished Shield-Boss|磨亮的盾心
      soap: Lye Soap|碱皂
      key: Fort Gate Key|堡门钥匙
      salt: Red Salt|赤盐
      wax: Sealing Wax|封蜡
      quill: Hawk Quill|鹰羽笔
      ink: Ochre Ink|赭墨
      apple: Sun-Dried Apricot|杏干
      honey: Thistle Honey|蓟蜜
      book: Drill-Book|操典
      gem: Fire Agate|火玛瑙
      shield: Banner Shield|旗纹盾
    `,
  },
  tithe: {
    line: { en: 'Vale', zh: '衡谷' },
    materials: ['bronze', 'iron', 'gold', 'wood', 'cloth', 'leather', 'clay', 'glass'],
    kinds: `
      sword: Toll-Warden's Sword|税卫之剑; Copper-Hilt Sword|铜柄剑 =bronze
      dagger: Moneylender's Stiletto|放贷人细刃; Saltpan Dirk|盐田短剑
      axe: Vale Hatchet|谷地手斧
      scimitar: Caravan Scimitar|商队弯刀
      club: Threshing Flail|打谷连枷 =wood
      mace: Weigher's Mace|司秤钉锤 * [bronze,gold]
      warhammer: Millstone Maul|磨盘大锤
      spear: Granary Guard's Spear|粮仓卫矛
      halberd: Tollgate Halberd|关卡长戟
      bow: Caravan Bow|商队弓
      wand: Assayer's Rod|验金杖
      staff: Tithe-Reeve's Staff|收税官手杖 =wood; Balance Staff|天平杖 * [crystal]
      helmet: Kettle Hat|铁边帽盔
      shield: Market Buckler|市集小盾
      breastplate: Brigandine|镶钉甲
      pauldrons: Copper Spaulders|铜护肩 =bronze
      jerkin: Dust-Rider's Jerkin|尘骑皮甲 =leather
      tome: Ledger of Weights|衡量账簿 *
      cloak: Dust Veil|蔽尘斗篷 [cloth]; Sackcloth Mantle|麻布披风 =cloth
      belt: Moneybelt|钱腰带 =leather
      hat: Straw Sunhat|草编遮阳帽 =cloth; Merchant's Cap|商人帽
      hood: Gleaner's Hood|拾穗者兜帽
      boots: Salt-Crusted Boots|结盐靴
      robe: Tithe-Collector's Gown|收税官长袍
      gloves: Reaper's Gloves|收割手套 =leather
      pickaxe: Salt Pick|盐镐
      shovel: Winnowing Shovel|扬谷铲
      hoe: Dry-Field Hoe|旱田锄
      sickle: Gleaner's Sickle|拾穗镰; Barley Sickle|大麦镰
      hammer: Cooper's Hammer|箍桶锤
      knife: Sack Knife|割袋刀
      rope: Sack Twine|扎袋麻线
      broom: Threshing-Floor Broom|晒谷场扫帚
      candle: Tithe Candle|什一蜡烛
      lantern: Weighhouse Lantern|秤房灯
      cup: Copper Cup|铜杯 =bronze; Measure Cup|量杯 [wood,clay]
      plate: Alms Bowl|施舍碗 [wood,clay]
      pot: Gruel Pot|稀粥锅
      bread: Barley Loaf|大麦面包; Chaff Bread|糠饼; Millet Cake|粟米糕
      cheese: Salted Curd|盐渍凝乳
      pie: Turnip Pasty|芜菁馅饼
      wine: Raisin Wine|葡萄干酒
      ale: Small Beer|淡啤
      apple: Dried Apple Rings|苹果干
      chickenc: Market Fowl|集市烤禽
      healing: Gleaner's Cordial|拾穗者甜露
      antidote: Salt Purge|盐泻剂
      cloth: Sackcloth|麻袋布; Market Linen|集市染亚麻
      leather: Mule Hide|骡皮
      salt: Flat Salt|盐滩盐; Rock Salt|岩盐; Salt Bloom|盐花
      herb: Saltwort|盐角草
      ring: Copper Ring|铜戒指 =bronze; Weight-Seal Ring|秤印戒指 * [gold]
      amulet: Scale Charm|天平护符
      earring: Coin Earring|钱币耳坠 [gold,silver]
      goblet: Guildmaster's Goblet|行会长高脚杯 * [gold]
      pouch: Tithe Purse|什一钱袋; Moneylender's Purse|放贷人钱袋
      gem: Salt Crystal|盐晶
      book: Ledger|账本; Book of Tolls|关税册; Almanac of Harvests|收成历书
      scroll: Writ of Tithe|什一令状
      letter: Bill of Sale|卖契; Promissory Note|欠条
      map: Caravan Route Map|商路图
      bell: Market Bell|集市铃
      flute: Shepherd's Pipe|牧笛
      lute: Hurdy-Gurdy|手摇琴
      dice: Loaded Dice|灌铅骰子
      doll: Corn Dolly|麦秆娃娃
      mirror: Peddler's Mirror|货郎镜
      quill: Clerk's Quill|书记羽笔
      ink: Iron-Gall Ink|铁胆墨水
      soap: Ash Soap|草灰皂
      key: Granary Key|粮仓钥匙; Strongbox Key|钱箱钥匙
      honey: Clover Honey|三叶草蜜
      wool: Dust-Grey Fleece|尘灰羊毛
      berries: Dried Currants|醋栗干
      fish: Salt-Lake Mullet|盐湖鲻鱼
      fishc: Salted Mullet|咸鲻鱼
      quiver: Toll-Guard's Quiver|税卫箭袋
      torch: Chaff Torch|糠秸火把
      rod: Canal Rod|渠钓竿
      wax: Tally Wax|记账蜡
      gem: Fool's Gold|愚人金
    `,
  },
  palefen: {
    line: { en: 'Fenland', zh: '苍沼' },
    materials: ['iron', 'bone', 'wood', 'leather', 'cloth', 'glass', 'silver'],
    kinds: `
      sword: Bog-Iron Sword|沼铁剑 =iron; Gravewarden's Blade|守墓人之剑 * [silver,steel]
      dagger: Coffin-Nail Dagger|棺钉匕首 =iron; Misericorde|慈悲短剑
      axe: Peat-Cutter's Axe|泥炭斧
      club: Bog-Oak Cudgel|沼橡短棍 =wood
      mace: Nail-Studded Mace|钉刺钉锤
      warhammer: Sexton's Maul|教堂司事大锤
      spear: Eel Gig|鳗叉; Reed-Shafted Spear|苇杆长矛
      halberd: Mire Glaive|沼泽长柄刀
      bow: Yew Bow|紫杉弓 =wood
      wand: Wisp-Light Wand|鬼火魔杖
      staff: Ossuary Staff|骨堂法杖 =bone; Fen-Witch's Staff|沼巫杖 * [bone,crystal]
      helmet: Rusted Barbute|锈蚀面盔 =iron
      shield: Coffin-Lid Shield|棺盖盾 =wood
      breastplate: Bog-Iron Cuirass|沼铁胸甲 =iron
      pauldrons: Crow-Feather Mantle|鸦羽护肩 =leather
      jerkin: Eelskin Jerkin|鳗皮甲 =leather
      quiver: Reed Quiver|苇编箭袋
      tome: Book of the Unquiet|不宁者之书 *
      parry: Nail Parrier|钉格挡刺
      cloak: Mourning Shroud|哀悼裹布 =cloth; Fogweave Cloak|雾织斗篷
      belt: Rosary Belt|念珠腰带
      hat: Mourning Veil|哀悼面纱 [silk,cloth]; Reed Hat|苇帽 =cloth
      hood: Sexton's Hood|司事兜帽
      boots: Bog Waders|沼泽涉靴 =leather
      robe: Ossuary Keeper's Robe|骨堂守者长袍
      gloves: Gravedigger's Gloves|掘墓手套 =leather
      shovel: Grave Spade|掘墓铲; Peat Spade|泥炭铲
      sickle: Reed Sickle|割苇镰
      hammer: Coffin-Maker's Hammer|棺匠锤
      knife: Eel Knife|剖鳗刀
      rope: Reed Rope|苇绳; Bell Rope|钟绳
      broom: Crypt Broom|墓穴扫帚
      rod: Eel Line|鳗钓竿
      torch: Rushlight|灯芯草火把
      candle: Mourning Candle|哀悼蜡烛; Corpse-Light Candle|尸灯烛
      lantern: Fen Lantern|沼泽提灯; Ferryman's Lantern|摆渡人提灯
      cup: Wake Cup|守灵杯
      pot: Peat Kettle|泥炭壶
      bread: Funeral Bread|丧饼; Soul Cake|魂灵饼
      pie: Eel Pie|鳗鱼馅饼
      wine: Elderberry Wine|接骨木果酒
      ale: Peat Ale|泥炭麦酒
      berries: Cranberries|蔓越莓; Sloes|黑刺李
      fish: Tench|丁鱥; Bream|鳊鱼
      fishc: Jellied Eel|鳗鱼冻; Smoked Eel|烟熏鳗鱼
      mushroom: Pale Bonnet|苍白小伞菇; Gravemoss Morel|墓苔羊肚菌
      healing: Gravemoss Tincture|墓苔酊
      antidote: Bog-Myrtle Draught|沼桃金娘解药
      cloth: Shroud Linen|裹尸亚麻
      leather: Eelskin|鳗皮
      herb: Bog Myrtle|沼桃金娘; Grave Nettle|墓荨麻
      feather: Crow Feather|鸦羽
      log: Bog Oak|沼橡木
      ring: Mourning Ring|悼念戒指; Nailhead Ring|钉首戒指 [iron,silver]
      amulet: Coffin-Nail Charm|棺钉护符; Moth Locket|蛾纹小盒坠 *
      earring: Crow-Bone Earring|鸦骨耳坠 =bone
      pouch: Ferryman's Purse|船资钱袋
      gem: Mourning Jet|哀悼煤玉
      book: Register of the Dead|亡者名册; Book of Hours|时辰祈祷书
      scroll: Litany of Rest|安息祷文
      letter: Unsent Letter|未寄出的信; Death Notice|讣告
      map: Chart of the Mires|沼泽图
      bell: Grave Bell|墓铃; Ferry Bell|渡铃
      flute: Reed Pipe|苇笛
      doll: Reed Poppet|苇编小人
      mirror: Veiled Mirror|蒙纱镜
      quill: Crow Quill|鸦羽笔
      ink: Soot Ink|烟墨
      key: Crypt Key|墓穴钥匙; Ossuary Key|骨堂钥匙
      wax: Moth Wax|蛾蜡
      salt: Grave Salt|墓盐
      dice: Finger-Bone Dice|指骨骰
      apple: Medlar|欧楂
      honey: Fen Honey|沼蜜
      lute: Mourner's Viol|哀悼者提琴
      soap: Mortician's Lye|殓房碱皂
      gem: Bog Pearl|沼珠
      plate: Funeral Platter|丧宴盘
      pouch: Grave-Coin Purse|冥钱袋
    `,
  },
  altar: {
    line: { en: 'Highland', zh: '白坛' },
    materials: ['steel', 'silver', 'stone', 'crystal', 'mithril', 'cloth', 'silk', 'leather'],
    kinds: `
      sword: Altar-Guard Sword|坛卫剑; Martyr's Blade|殉道者之剑 * [silver,mithril]
      dagger: Cliff-Hunter's Dirk|崖猎短剑
      axe: Quarryman's Axe|采石斧
      mace: Abbey Mace|修院钉锤; Vigil Mace|守夜钉锤
      warhammer: Stonemason's Maul|石匠大锤
      spear: Pilgrim Lance|朝圣骑枪; Eyrie Spear|鹰巢长矛
      halberd: Abbey Halberd|修院长戟
      bow: Cliff Bow|崖弓
      wand: Alabaster Wand|雪花石魔杖 =crystal
      staff: Abbot's Crozier|院长权杖 * [silver,mithril]; Goatherd's Crook|牧羊曲杖 =wood
      helmet: White Helm|白盔
      shield: Altar Heater Shield|白坛三角盾
      breastplate: White Plate|白甲 =steel; Reliquary Cuirass|圣髑胸甲 * [steel,mithril]
      pauldrons: Snow-Goat Spaulders|雪羊护肩 =leather
      jerkin: Goatskin Jerkin|山羊皮甲 =leather
      tome: Psalter|诗篇集; Antiphoner|轮唱圣咏集
      cloak: Alb Mantle|素白披风; Storm Cloak|风暴斗篷
      belt: Cincture|束腰绳 =cloth
      hat: Highland Bonnet|高地软帽; Abbot's Mitre|院长冠 * =silk
      hood: Cowl|僧帽兜
      boots: Climbing Boots|攀崖靴 =leather
      robe: Alb|白麻圣衣 =cloth; Novice's Robe|见习修士袍 =cloth
      gloves: Vestment Gloves|祭衣手套 [silk,cloth]
      pickaxe: Quarry Pick|采石镐
      hammer: Mason's Hammer|石匠锤
      knife: Vellum Knife|裁皮纸刀
      rope: Climbing Rope|攀崖绳
      broom: Cloister Broom|回廊扫帚
      candle: Vigil Candle|守夜长烛; Beeswax Taper|蜂蜡细烛
      lantern: Cloister Lantern|回廊灯
      cup: Novice's Cup|见习杯
      plate: Paten|圣餐盘 =silver
      pot: Abbey Cauldron|修院大锅
      bread: Monastery Loaf|修院面包; Wafer|圣饼
      cheese: Highland Goat Cheese|高地山羊奶酪
      honey: Abbey Honey|修院蜂蜜
      wine: Altar Wine|祭坛酒
      ale: Monk's Ale|修士麦酒
      healing: Abbey Elixir|修院灵药
      antidote: Hyssop Draught|牛膝草解药
      cloth: White Linen|白亚麻
      leather: Goatskin|山羊皮; Vellum|犊皮纸
      wool: Highland Wool|高地羊毛
      herb: Hyssop|牛膝草; Snow Lily|雪百合
      wax: Abbey Beeswax|修院蜂蜡
      feather: Eyrie Feather|巢崖鹫羽
      ring: Vigil Ring|守夜戒指; Abbot's Ring|院长戒指 * [gold,silver]
      amulet: Reliquary Pendant|圣髑吊坠; Lily Medal|百合圣徽 =silver
      earring: Chalk-Pearl Earring|白垩珠耳坠
      goblet: Altar Chalice|祭坛圣杯 * [silver,gold]
      pouch: Alms Purse|施舍袋
      gem: White Opal|白蛋白石
      book: Martyrology|殉道者名录; Rule of the Abbey|修院规章; Lives of the Saints|圣徒传
      scroll: Illuminated Scroll|泥金卷轴
      letter: Indulgence|赎罪券
      map: Map of the Catacombs|墓窟图
      bell: Choir Bell|唱诗钟
      lute: Psaltery|索尔特里琴
      doll: Saint's Figurine|圣像小雕
      quill: Scriptorium Quill|缮写室羽笔
      ink: Illuminator's Gold Ink|泥金墨
      key: Reliquary Key|圣髑匣钥匙; Catacomb Key|墓窟钥匙
      sword: Choir-Knight's Sword|唱诗骑士剑
      pie: Lenten Pie|斋期馅饼
      apple: Highland Pear|高地梨
      berries: Juniper Berries|杜松子
      fish: Mountain Trout|山溪鳟
      fishc: Smoked Trout|烟熏鳟鱼
      mushroom: Snow Puffball|雪马勃
      torch: Catacomb Torch|墓窟火把
      mirror: Reliquary Glass|圣髑镜
      staff: Hermit's Staff|隐修者手杖 =wood
      shield: Martyr's Pavise|殉道者大盾 * [steel]
      salt: Chalk Salt|垩盐
    `,
  },
  holy: {
    line: { en: 'Hallowed', zh: '圣城' },
    materials: ['silver', 'gold', 'steel', 'silk', 'cloth', 'glass', 'crystal', 'leather'],
    kinds: `
      sword: Blessed Sword|祝圣之剑; Hall-Guard Sword|殿卫剑; Sword of the Five|五苦之剑 * [silver,steel]
      dagger: Cutpurse's Blade|扒手刀 [iron,steel]; Pilgrim's Dirk|朝圣短剑
      mace: Censer Mace|香炉钉锤; Bishop's Mace|主教钉锤 * [silver,gold]
      spear: Gilded Partisan|镀金阔头枪
      halberd: Cathedral Halberd|大殿长戟
      bow: Gilded Bow|镀金弓
      wand: Dawn Wand|曙光魔杖
      staff: Pilgrim's Staff|朝圣手杖 =wood; Archdeacon's Staff|副主教杖 * [silver,crystal]
      helmet: Gilded Sallet|镀金轻盔
      shield: Sunburst Shield|日纹盾; Five-Wound Shield|五伤盾 * [steel]
      breastplate: Gilt Cuirass|镀金胸甲
      pauldrons: Halo Spaulders|光环护肩
      jerkin: Pilgrim's Jerkin|朝圣皮甲
      tome: Breviary|日课经
      cloak: Pilgrim's Cloak|朝圣斗篷; Cope|祭披 =silk
      belt: Scrip Belt|朝圣行囊腰带
      hat: Pilgrim's Hat|朝圣宽檐帽; Cardinal's Biretta|枢机方帽 * =silk
      hood: Penitent's Hood|忏悔者兜帽
      boots: Pilgrim Sandals|朝圣凉鞋 =leather
      robe: Chasuble|祭袍 =silk; Dalmatic|执事祭衣
      gloves: Hall Silk Gloves|大殿丝手套 =silk
      hammer: Goldsmith's Hammer|金匠锤
      knife: Bread Knife|面包刀
      broom: Nave Broom|中殿扫帚
      torch: Procession Torch|游行火把
      candle: Votive Candle|许愿蜡烛; Dawn Candle|曙烛
      lantern: Gilt Lantern|镀金提灯
      cup: Pilgrim's Cup|朝圣杯
      plate: Gilt Plate|镀金盘 =gold
      bread: Pilgrim's Loaf|朝圣面包; Saffron Bun|藏红花面包
      pie: Feast-Day Pie|节日馅饼
      honey: Honeycomb|蜂巢蜜
      wine: Spiced Wine|香料酒
      apple: Candied Apple|糖苹果
      healing: Pilgrim's Draught|朝圣药剂; Myrrh Elixir|没药灵药
      antidote: Theriac|万应解毒剂
      cloth: Cloth of Gold|金线布; Vestment Silk|祭衣丝绸
      herb: Myrrh Resin|没药树脂; Frankincense|乳香
      wax: Votive Wax|还愿蜡
      ring: Pilgrim's Ring|朝圣戒指; Bishop's Ring|主教戒指 * =gold
      amulet: Five-Wound Medal|五伤圣徽; Dawn Icon Pendant|曙光圣像吊坠
      earring: Gilt Drop Earring|镀金坠耳环 =gold
      goblet: Gilded Chalice|镀金圣杯 =gold
      pouch: Pilgrim's Scrip|朝圣行囊
      gem: Sunstone|日长石
      book: Book of the Five Sufferings|五苦圣典; Pilgrim's Guide to the City|圣城朝圣指南; Hymnal|赞美诗集
      scroll: Bull of the Holy See|圣座诏书
      letter: Letter of Safe Conduct|安全通行证
      map: Map of the Holy City|圣城地图
      bell: Sanctus Bell|圣铃
      lute: Cittern|西特琴
      doll: Saint Doll|圣徒布偶
      mirror: Pilgrim's Mirror|朝圣镜
      quill: Gilded Quill|镀金羽笔
      ink: Vermilion Ink|朱砂墨
      soap: Rose Soap|玫瑰皂
      key: Vestry Key|圣器室钥匙
      axe: Headsman's Axe|刽子手斧
      warhammer: Bell-Founder's Maul|铸钟大锤
      club: Beadle's Rod|教堂差役棍 =wood
      quiver: Hall Archer's Quiver|殿弓手箭袋
      cheese: Pilgrim's Cheese|朝圣奶酪
      ale: Pilgrim's Ale|朝圣麦酒
      berries: Candied Cherries|蜜饯樱桃
      chickenc: Roast Capon|烤阉鸡
      dice: Gilt Dice|镀金骰子
      flute: Processional Shawm|游行肖姆管
      book: Psalms of the Dawn|晨祷诗篇
      letter: Pilgrim's Testimonial|朝圣证明
      rope: Bell-Ringer's Rope|敲钟绳
    `,
  },
}

/** What a named piece is worth against its base, and how often it is stocked. */
export const NAMED_VALUE = 3
const NAMED_STOCK = 0.25

/** Where a regional form is kept when its base is kept nowhere (the sets' pieces, the off hands). */
function familyStock(base: string): Partial<Record<Context, number>> {
  if (base.startsWith('item/weapon') || base.startsWith('item/armor')) return { smithy: 2, dungeon: 1, shop: 0.3 }
  if (base.startsWith('item/clothing')) return { home: 1.5, shop: 1 }
  if (base.startsWith('item/tool')) return { home: 1, farm: 1, shop: 1, smithy: 0.5 }
  return { shop: 1, home: 1 }
}

const slug = (en: string) => en.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const GEAR = ['item/weapon', 'item/armor', 'item/clothing', 'item/tool', 'item/valuable']

/** Parse a region's kinds (REGION_GOODS.kinds). */
function kindsOf(region: string, text: string): { base: string; en: string; zh: string; line: boolean; named: boolean; materials?: string[]; own?: string; sprite?: string }[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).flatMap((line) => {
    const [key, rest] = line.split(/:\s+/, 2)
    const base = BASE[key]
    if (!base || rest === undefined) throw new Error(`goods ${region}: no base "${key}"`)
    return rest.split(';').map((entry) => {
      const [en, tail] = entry.split('|').map((s) => s.trim())
      const [zh, ...mods] = tail.split(/\s+/)
      const mats = mods.find((m) => m.startsWith('['))
      const own = mods.find((m) => m.startsWith('='))?.slice(1)
      return { base, en, zh, line: false, named: mods.includes('*'), materials: own ? [own] : mats ? mats.slice(1, -1).split(',') : undefined, own, sprite: mods.find((m) => m.startsWith('@'))?.slice(1) }
    })
  })
}

/**
 * Every region's goods as item forms, made from the base forms they vary: a region's line first, then its local
 * kinds and named pieces. A form's tags and props are its base's and its own (its origin, a named piece's tier), its
 * worth its base's (a named piece's three times), its materials what its makers work of what the base is made of.
 */
export function regionalForms(bases: Form[], baseValue: (type: string) => number): Form[] {
  const byId = new Map(bases.map((f) => [f.id, f]))
  const taken = new Set(bases.flatMap((f) => [f.en.toLowerCase(), f.zh]))
  const out: Form[] = []
  for (const [region, g] of Object.entries(REGION_GOODS)) {
    const entries = [
      ...LINE.map((key) => {
        const b = byId.get(BASE[key])!
        return { base: b.id, en: `${g.line.en} ${b.en}`, zh: `${g.line.zh}${b.zh}`, line: true, named: false, materials: undefined as string[] | undefined, own: undefined as string | undefined, sprite: undefined as string | undefined }
      }),
      ...kindsOf(region, g.kinds),
    ]
    for (const e of entries) {
      // (a name a base form already has — the frost wolf's Frostfang Hood — is that piece's: the region's line has none of it)
      if (taken.has(e.en.toLowerCase()) || taken.has(e.zh)) continue
      const b = byId.get(e.base)
      if (!b) throw new Error(`goods ${region}: no base form ${e.base}`)
      const gear = GEAR.some((p) => b.id.startsWith(p))
      const worked = b.materials?.filter((m) => g.materials.includes(m))
      const materials = e.materials ?? (b.materials && (worked?.length ? worked : b.materials))
      const stock = Object.keys(b.where ?? {}).length ? b.where! : familyStock(b.id)
      out.push({
        id: `${b.id}/${region}_${slug(e.en)}`,
        en: e.en,
        zh: e.zh,
        sprite: e.sprite ?? b.sprite,
        tags: [...new Set([...(b.tags ?? []), `origin:${region}`, ...(e.named && gear ? ['quality:fine'] : [])])],
        props: { ...(b.props ?? {}), ...(e.own && { material: e.own }), value: Math.round(baseValue(b.id) * (e.named ? NAMED_VALUE : 1)) },
        ...(materials && { materials }),
        ...(b.elemental && { elemental: true }),
        where: {},
        base: b.id,
        origin: region,
        ...(e.line && { line: true }),
        ...(e.named && { named: true }),
        stock: Object.fromEntries(Object.entries(stock).map(([k, w]) => [k, (w ?? 0) * (e.named ? NAMED_STOCK : 1)])),
      })
    }
  }
  return out
}

const stocks = new Map<string, [Form, number][]>()

/**
 * What a place of `region` keeps where it keeps `ctx` things (a house, a shop, a smithy, a chest in a ruin): the
 * region's own goods twice as often as the base forms that are kept there everywhere; the Holy City, where the
 * pilgrims come from every road, keeps the other regions' goods too, less often.
 */
export function stockFor(region: string, ctx: Context): [Form, number][] {
  const key = `${region}|${ctx}`
  let out = stocks.get(key)
  if (!out) {
    out = FORMS.flatMap((f): [Form, number][] => {
      const w = f.origin ? (f.stock?.[ctx] ?? 0) * (f.origin === region ? 2 : region === 'holy' ? 0.3 : 0) : (f.where?.[ctx] ?? 0)
      return w > 0 ? [[f, w]] : []
    })
    stocks.set(key, out)
  }
  return out
}
