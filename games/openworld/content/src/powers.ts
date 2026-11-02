// The powers beyond a piece's numbers (docs/gear.md, docs/sets.md): a Stigmatic piece's relic, a Vowbound piece's vow, and
// what a set worn together grants of its own. The classes module's combat answers each as a talent is; these are the
// words the tooltip, the wiki and a set's bonus lines tell them by.

/**
 * The Stigmatic pieces' powers (engine combat.ts `relicsOf`): one of each in the world, each its own. What the
 * tooltip names and tells.
 */
export const RELICS: Record<string, { en: string; zh: string; text: { en: string; zh: string } }> = {
  crown: { en: 'None Cross That Do Not Kneel', zh: '不跪者不得过', text: { en: 'Your blows have a 20% chance to force the struck to their knees (1 second, unable to move).', zh: '你的攻击有 20% 几率令目标跪地（1 秒内无法移动）。' } },
  nightfang: { en: 'Tooth of the Night', zh: '夜之牙', text: { en: '+25% critical chance at night.', zh: '入夜后暴击率 +25%。' } },
  mirrorshard: { en: 'Stolen Face', zh: '窃面', text: { en: 'A critical hit draws back 3 more health.', zh: '暴击时额外吸取 3 点生命。' } },
  oathbrand: { en: 'Oath Kept', zh: '守誓', text: { en: 'Below 30% health, the health it draws back is tripled.', zh: '生命低于 30% 时，吸取的生命变为三倍。' } },
  galestring: { en: 'Running Wind', zh: '逐风', text: { en: 'Each hit: +30% movement speed for 2 seconds.', zh: '每次命中：2 秒内移动速度 +30%。' } },
  starfall: { en: 'Falling Star', zh: '坠星', text: { en: 'Every fifth hit is a critical.', zh: '每第五次命中必定暴击。' } },
  emberheart: { en: 'Heart of Embers', zh: '余烬之心', text: { en: 'Hits have a 25% chance to set the struck burning.', zh: '命中有 25% 几率点燃目标。' } },
  rimecrown: { en: 'Crown of Rime', zh: '霜冕', text: { en: 'Hits have a 20% chance to freeze the struck for a moment.', zh: '命中有 20% 几率令目标短暂冰冻。' } },
  unfallen: { en: 'Unfallen', zh: '不陷', text: { en: 'Once a minute, a blow that would fell you is turned aside.', zh: '每分钟一次：将致命一击完全挡下。' } },
  dragonsbane: { en: 'Dragonslayer', zh: '屠龙', text: { en: 'Double damage against dragons and their whelps.', zh: '对巨龙与幼龙造成双倍伤害。' } },
  scourge: { en: 'Unbowed', zh: '血尽不倒', text: { en: 'The more you are hurt, the harder you strike: up to +50% damage at the last of your health.', zh: '受伤越重，攻击越狠：生命将尽时伤害最多 +50%。' } },
  scales: { en: 'Lighter Than Sin', zh: '轻于罪', text: { en: 'The hungrier you are, the quicker you move and strike: up to +30% on an empty belly.', zh: '越饿，移动和出手越快：空腹时最多 +30%。' } },
  nails: { en: 'Nailed to the World', zh: '钉于此世', text: { en: 'Below a quarter of your health, you take half harm.', zh: '生命低于四分之一时，受到的伤害减半。' } },
  lance: { en: 'Through the Heart', zh: '贯心', text: { en: 'Your blows pass through armour. You take 10% more harm.', zh: '你的攻击无视护甲。你受到的伤害 +10%。' } },
}

/**
 * What a Vowbound piece keeps of the vow it was made under (the classes module's combat.ts `vowsOf`, answered as
 * a talent is): each a promise with a condition and what it pays, far beyond a number — a rolled piece takes one
 * (`vow`: QualityDef.vows, the craft primitive; makeItem), the story's own name theirs (hollow.ts, quests/side.ts;
 * the Order's seal and the scallop below). What the tooltip names and tells. Two pieces of one vow are one vow.
 */
export const VOWS: Record<string, { en: string; zh: string; text: { en: string; zh: string } }> = {
  vigil: { en: 'Vow of Vigil', zh: '守夜之誓', text: { en: 'At night: +20% critical chance and +15% movement speed.', zh: '入夜后：暴击率 +20%，移动速度 +15%。' } },
  dawn: { en: 'Vow of Dawn', zh: '黎明之誓', text: { en: 'By day: every blow that lands draws back 1 health, and you take 10% less harm.', zh: '白天：每次命中吸取 1 点生命，受到的伤害 −10%。' } },
  holdfast: { en: 'Vow of the Held Ground', zh: '坚守之誓', text: { en: 'Standing your ground (no step this second): your blows deal 25% more, and you take 30% less.', zh: '站定不动满 1 秒：攻击伤害 +25%，受到的伤害 −30%。' } },
  thorn: { en: 'Vow of the Thorn', zh: '荆棘之誓', text: { en: 'Whoever strikes you hand to hand is pricked for 3.', zh: '近身击中你的敌人被荆棘刺伤，损失 3 点生命。' } },
  mercy: { en: 'Vow of Mercy', zh: '怜悯之誓', text: { en: 'A blow on a foe below a third of its health draws back 2 health.', zh: '击中生命不足三成的敌人时，吸取 2 点生命。' } },
  silence: { en: 'Vow of Silence', zh: '缄默之誓', text: { en: 'Sneaking slows you no more, and a blow struck while sneaking has +25% critical chance.', zh: '潜行不再减速；潜行中攻击的暴击率 +25%。' } },
  pilgrim: { en: 'Vow of the Road', zh: '朝圣之誓', text: { en: 'On a road, +30% movement speed; on the move, +10% dodge.', zh: '走在路上移动速度 +30%；移动中闪避 +10%。' } },
  ward: { en: 'Vow of the Shield', zh: '庇护之誓', text: { en: "A fight's first blow against you is turned half aside (ten seconds out of the fray).", zh: '脱战 10 秒后受到的第一击伤害减半。' } },
  hunt: { en: 'Vow of the Hunt', zh: '狩猎之誓', text: { en: 'Your blow on an unhurt foe is always a critical.', zh: '对未受伤的敌人出手必定暴击。' } },
  lone: { en: 'Vow of the Lone Road', zh: '独行之誓', text: { en: 'With no companion at your side: your blows deal 15% more, and +10% dodge.', zh: '身边没有同伴跟随时：攻击伤害 +15%，闪避 +10%。' } },
}
export const VOW_IDS = Object.keys(VOWS)

/**
 * What a set worn together grants of its own (docs/sets.md §5; a bonus's `power`, the classes module's combat
 * `setPowersOf`): each a condition and what it pays. Two sets of one power are one power.
 */
export const SET_POWERS: Record<string, { en: string; zh: string; text: { en: string; zh: string } }> = {
  bloodprice: { en: 'Blood Price', zh: '血偿', text: { en: 'Each blow you take: +6% damage for 6 seconds, up to five times.', zh: '每受到一次攻击：6 秒内伤害 +6%，最多叠加五次。' } },
  measure: { en: 'The Measure', zh: '衡量', text: { en: '+25% damage against a foe less hurt than you are.', zh: '攻击伤势比你轻的敌人时，伤害 +25%。' } },
  chaff: { en: 'Light as Chaff', zh: '轻如糠秕', text: { en: 'While hungry (below half food): dodge +12%, movement speed +10%.', zh: '饥饿时（饱食度不足一半）：闪避 +12%，移动速度 +10%。' } },
  lamplight: { en: 'Lamplight', zh: '引魂灯', text: { en: '+30% damage against the undead.', zh: '对亡灵造成的伤害 +30%。' } },
  undertow: { en: 'Undertow', zh: '暗流', text: { en: 'A critical hit drags the struck to their knees for a second.', zh: '暴击会把目标拖得跪倒在地 1 秒。' } },
  shroudward: { en: 'Shroud-ward', zh: '裹尸布之护', text: { en: 'Below half health: skills rest 25% less, and you take 15% less harm.', zh: '生命低于一半时：技能冷却 −25%，受到的伤害 −15%。' } },
  elect: { en: 'Chosen of the Road', zh: '道路所选', text: { en: '+10% damage for each relic of the Five Sufferings you carry.', zh: '你身上每带着一件五苦圣器，伤害 +10%。' } },
  curia: { en: 'Doctrine', zh: '教义', text: { en: 'Your active skills strike 25% harder.', zh: '主动技能的伤害 +25%。' } },
  lastdoor: { en: 'Those Who Came This Far', zh: '走到这里的人', text: { en: '+30% damage against a boss.', zh: '对首领造成的伤害 +30%。' } },
  second: { en: 'Went Small', zh: '变小了', text: { en: 'With a companion at your side: dodge +10%, skills rest 15% less.', zh: '有同伴跟在身边时：闪避 +10%，技能冷却 −15%。' } },
  nightkept: { en: 'The Night Kept', zh: '守夜之印', text: { en: 'At night: +20% damage, and you take 15% less harm.', zh: '入夜后：伤害 +20%，受到的伤害 −15%。' } },
}
