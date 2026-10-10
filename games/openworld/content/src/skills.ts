// The skill tree: each level brings a skill point (engine/src/progression.ts), and these nodes
// spend them. Combat and life contain eight branches, including a profession-specific tree.
// Existing ids/grants remain save-compatible. Combat talents are automatic: moving, attacking
// and defeating creatures trigger them without introducing another input/hotbar.

import { Rng, type Entity, type SkillDef } from '@openworld/engine'
import { type ProfessionDef } from '@openworld/modules'
import { FORM_BY_ID, makeItem } from './items.ts'

export const SKILL_DIRECTIONS = [
  { id: 'combat', icon: 'sword', name: { en: 'Combat', zh: '战斗' } },
  { id: 'life', icon: 'pack', name: { en: 'Life', zh: '生活' } },
] as const

export type SkillDirection = (typeof SKILL_DIRECTIONS)[number]['id']

export const SKILL_BRANCHES: { id: string; direction: SkillDirection; icon: string; name: { en: string; zh: string } }[] = [
  { id: 'swiftness', direction: 'combat', icon: 'swift', name: { en: 'Swiftness', zh: '迅捷' } },
  { id: 'survival', direction: 'combat', icon: 'shield', name: { en: 'Survival', zh: '生存' } },
  { id: 'damage', direction: 'combat', icon: 'sweep', name: { en: 'Damage', zh: '伤害' } },
  { id: 'profession', direction: 'combat', icon: 'origin', name: { en: 'Profession', zh: '职业' } },
  { id: 'gathering', direction: 'life', icon: 'axe', name: { en: 'Gathering', zh: '采集' } },
  { id: 'agriculture', direction: 'life', icon: 'farming', name: { en: 'Agriculture', zh: '农业' } },
  { id: 'husbandry', direction: 'life', icon: 'ranching', name: { en: 'Animal Husbandry', zh: '牧业' } },
  { id: 'smithing', direction: 'life', icon: 'smithing', name: { en: 'Smithing', zh: '锻造' } },
]

/** A profession's starter weapon and off-hand piece (common, no element), handed over the first time it is taken up. */
const kit = (form: string, material: string) => makeItem(new Rng(0), FORM_BY_ID[form], { material, quality: 'common', element: null })

/**
 * The professions a trainer teaches (docs/skill-tree.md), from level 5 (engine/src/profession.ts).
 * Every profession and skill has its own illustrated pixel-art PNG.
 */
export const SKILL_PROFESSIONS: (ProfessionDef & { icon: string; name: { en: string; zh: string } })[] = [
  { id: 'assassin', icon: 'assassin', name: { en: 'Assassin', zh: '刺客' }, doc: { en: 'Daggers, theirs alone; openers from the quiet and from behind, combos that end in a finisher.', zh: '专精匕首；从暗处、从背后先手，连击收尾。' }, weapon: kit('item/weapon/blade/dagger', 'iron') },
  { id: 'warrior', icon: 'warrior', name: { en: 'Warrior', zh: '战士' }, doc: { en: 'Sword and shield, theirs alone; takes blows, answers them, and grows fiercer with each foe felled.', zh: '专精剑盾，独有副手盾牌；扛得住打，挨打必还手，越战越勇。' }, weapon: kit('item/weapon/blade/sword', 'iron'), offhand: kit('item/armor/shield', 'wood') },
  { id: 'ranger', icon: 'ranger', name: { en: 'Ranger', zh: '游侠' }, doc: { en: 'Bows, theirs alone; a steady aim from afar, quick feet between shots.', zh: '专精弓箭；站稳了打得准、打得远，射完就走。' }, weapon: kit('item/weapon/ranged/bow', 'wood') },
  { id: 'mage', icon: 'mage', name: { en: 'Mage', zh: '法师' }, doc: { en: 'Staves, theirs alone; elemental spells that echo, a shield of mana, strength drawn from the fallen.', zh: '专精法杖；元素法术会回响，法力护盾护身，击倒敌人回复生命。' }, weapon: kit('item/weapon/magic/staff', 'wood') },
]
export const PROFESSION_BY_ID: Record<string, (typeof SKILL_PROFESSIONS)[number]> = Object.fromEntries(SKILL_PROFESSIONS.map((p) => [p.id, p]))

/** Unknown professions keep the profession hub, but never fall back to assassin skills. */
export function branchesForProfession(profession: string) {
  const role = SKILL_PROFESSIONS.find((p) => p.id === profession)
  return SKILL_BRANCHES.map((b) => b.id === 'profession' && role ? { ...b, icon: role.icon, name: role.name } : b)
}

export const SKILLS: SkillDef[] = [
  { id: 'light-footed', branch: 'swiftness', icon: 'swift', grant: { moveHaste: 0.15 }, name: { en: 'Light Footed', zh: '轻盈步伐' }, doc: { en: 'Movement speed +15% on average. Does not cross blocked tiles.', zh: '平均移动速度 +15%，仍受地形和碰撞限制。' } },
  { id: 'quick-hands', branch: 'swiftness', icon: 'quick-hands', requires: ['light-footed'], grant: { attackHaste: 0.15 }, name: { en: 'Quick Hands', zh: '快手' }, doc: { en: 'Attack speed +15% on average.', zh: '平均攻击速度 +15%。' } },
  { id: 'battle-tempo', branch: 'swiftness', icon: 'battle-tempo', requires: ['quick-hands'], ability: true, name: { en: 'Battle Tempo', zh: '战斗节奏' }, doc: { en: 'Attacking within 0.6 seconds of a successful step gains another 10% attack speed.', zh: '成功移动后的 0.6 秒内攻击，额外获得 10% 攻击速度。' } },
  { id: 'evasive-step', branch: 'swiftness', icon: 'evasive-step', requires: ['light-footed'], ability: true, name: { en: 'Evasive Step', zh: '灵巧闪身' }, doc: { en: 'For 0.6 seconds after a successful step, direct combat damage taken is reduced by 25%. Minimum 1 damage; not hunger or environmental damage.', zh: '成功移动后的 0.6 秒内，受到的直接战斗伤害降低 25%，最低仍为 1；不减免饥饿或环境伤害。' } },
  { id: 'pursuit', branch: 'swiftness', icon: 'pursuit', requires: ['evasive-step'], ability: true, name: { en: 'Pursuit', zh: '乘胜追击' }, doc: { en: 'Defeating a creature with an attack grants 25% movement speed for 3 seconds. Refreshes, does not stack.', zh: '攻击击败生物后，移动速度额外 +25%，持续 3 秒；重复触发刷新时间，不叠加。' } },
  { id: 'windrunner', branch: 'swiftness', icon: 'windrunner', requires: ['battle-tempo', 'pursuit'], cost: 2, ability: true, name: { en: 'Windrunner', zh: '疾风连击' }, doc: { en: 'After 3 successful steps, your next primary melee hit deals 50% extra damage and consumes the charge. Sweep targets do not consume or gain it.', zh: '每成功移动 3 格，下一次近战主目标命中伤害 +50%，随后消耗蓄势；横扫的副目标不触发。' } },
  // swiftness, deeper (docs/skill-tree.md): dodge, and a dash (Q) with what it opens
  { id: 'nimble', branch: 'swiftness', icon: 'nimble', requires: ['light-footed'], grant: { dodge: 0.05 }, name: { en: 'Nimble', zh: '灵巧' }, doc: { en: 'Dodge +5%: a direct combat blow misses you entirely.', zh: '闪避 +5%：直接战斗攻击有几率完全落空。' } },
  { id: 'acrobat', branch: 'swiftness', icon: 'acrobat', requires: ['nimble'], grant: { dodge: 0.07 }, name: { en: 'Acrobat', zh: '杂技' }, doc: { en: 'Dodge +7% more (dodge is capped at 50%).', zh: '闪避再 +7%（闪避上限 50%）。' } },
  { id: 'dash', branch: 'swiftness', icon: 'dash', requires: ['light-footed'], ability: true, name: { en: 'Dash', zh: '冲刺' }, doc: { en: 'Q: dash up to 3 tiles the way you face, past nothing solid. 4-second cooldown.', zh: '按 Q：朝面向冲刺最多 3 格，不能穿过实体障碍。冷却 4 秒。' } },
  { id: 'slipstream', branch: 'swiftness', icon: 'slipstream', requires: ['dash'], ability: true, name: { en: 'Slipstream', zh: '疾行' }, doc: { en: 'After a dash, movement speed +30% for 2 seconds.', zh: '冲刺后 2 秒内移动速度 +30%。' } },
  { id: 'tailwind', branch: 'swiftness', icon: 'tailwind', requires: ['slipstream'], ability: true, name: { en: 'Tailwind', zh: '顺风' }, doc: { en: 'Dash goes 1 tile farther, and its cooldown is 1.5 seconds shorter.', zh: '冲刺距离 +1 格，冷却缩短 1.5 秒。' } },
  { id: 'phantom-step', branch: 'swiftness', icon: 'phantom-step', requires: ['dash'], ability: true, name: { en: 'Phantom Step', zh: '幻影步' }, doc: { en: 'Dash passes through creatures, and nothing can hit you for 0.5 seconds after.', zh: '冲刺可以穿过生物，冲刺后 0.5 秒内不会受到攻击。' } },
  { id: 'untouchable', branch: 'swiftness', icon: 'untouchable', requires: ['acrobat', 'phantom-step'], cost: 2, grant: { dodge: 0.03 }, ability: true, name: { en: 'Untouchable', zh: '无影' }, doc: { en: 'Dodge +3%. After you dodge a blow, your next attack within 2 seconds is a guaranteed critical hit.', zh: '闪避再 +3%。闪避一次攻击后，2 秒内的下一次攻击必定暴击。' } },

  { id: 'strength', branch: 'damage', icon: 'sword', grant: { atk: 1 }, name: { en: 'Strength', zh: '力量' }, doc: { en: 'Attack +1.', zh: '攻击 +1。' } },
  { id: 'heavy-blows', branch: 'damage', icon: 'hammer', requires: ['strength'], grant: { atk: 2 }, name: { en: 'Heavy Blows', zh: '重击' }, doc: { en: 'Attack +2.', zh: '攻击 +2。' } },
  { id: 'sweep', branch: 'damage', icon: 'sweep', requires: ['heavy-blows'], ability: true, name: { en: 'Sweep', zh: '横扫' }, doc: { en: 'A melee blow also strikes the creatures on either side of the tile ahead.', zh: '近战攻击同时命中前方格子左右两侧的生物。' } },
  { id: 'keen-eye', branch: 'damage', icon: 'critical', requires: ['strength'], grant: { critChance: 0.1 }, name: { en: 'Keen Eye', zh: '洞察弱点' }, doc: { en: 'Attacks on actors gain 10% critical chance. Critical hits deal 1.5 times damage before defence.', zh: '攻击生物的暴击率 +10%；暴击造成防御计算前 1.5 倍伤害。' } },
  { id: 'executioner', branch: 'damage', icon: 'executioner', requires: ['keen-eye'], ability: true, name: { en: 'Executioner', zh: '斩杀' }, doc: { en: 'Attack damage +25% against actors at or below 30% health.', zh: '攻击生命值不高于 30% 的生物时，伤害 +25%。' } },
  { id: 'deadly-focus', branch: 'damage', icon: 'deadly-focus', requires: ['sweep', 'executioner'], cost: 2, grant: { critChance: 0.05 }, ability: true, name: { en: 'Deadly Focus', zh: '致命专注' }, doc: { en: 'Critical chance +5%; critical damage rises from 1.5 to 2 times damage before defence.', zh: '暴击率再 +5%；暴击伤害由防御计算前 1.5 倍提高至 2 倍。' } },
  // damage, deeper: raw attack, critical rate and critical damage, and how a fight builds
  { id: 'brute', branch: 'damage', icon: 'brute', requires: ['heavy-blows'], grant: { atk: 3 }, name: { en: 'Brute', zh: '蛮力' }, doc: { en: 'Attack +3.', zh: '攻击 +3。' } },
  { id: 'precision', branch: 'damage', icon: 'precision', requires: ['keen-eye'], grant: { critChance: 0.05 }, name: { en: 'Precision', zh: '精准' }, doc: { en: 'Critical chance +5%.', zh: '暴击率 +5%。' } },
  { id: 'hemorrhage', branch: 'damage', icon: 'hemorrhage', requires: ['precision'], ability: true, name: { en: 'Hemorrhage', zh: '撕裂' }, doc: { en: 'A critical hit makes the target bleed: 1 damage a second for 4 seconds (ignores defence).', zh: '暴击会让目标流血：4 秒内每秒受到 1 点伤害（无视防御）。' } },
  { id: 'lethal-edge', branch: 'damage', icon: 'lethal-edge', requires: ['keen-eye'], grant: { critDamage: 0.25 }, name: { en: 'Lethal Edge', zh: '致命锋芒' }, doc: { en: 'Critical damage +25% (×1.5 becomes ×1.75).', zh: '暴击伤害 +25%（1.5 倍变为 1.75 倍）。' } },
  { id: 'brutal', branch: 'damage', icon: 'brutal', requires: ['lethal-edge'], grant: { critDamage: 0.25 }, name: { en: 'Brutal', zh: '残暴' }, doc: { en: 'Critical damage +25% more.', zh: '暴击伤害再 +25%。' } },
  { id: 'first-strike', branch: 'damage', icon: 'first-strike', requires: ['strength'], ability: true, name: { en: 'First Strike', zh: '先发制人' }, doc: { en: 'Hits on an actor at full health deal 30% more damage.', zh: '攻击满血目标时伤害 +30%。' } },
  { id: 'momentum', branch: 'damage', icon: 'momentum', requires: ['first-strike'], ability: true, name: { en: 'Momentum', zh: '连击势头' }, doc: { en: 'Each hit that lands within 1.5 seconds of the last adds 5% damage, up to 25%.', zh: '每次命中若与上一击相隔不到 1.5 秒，伤害叠加 +5%，最多 +25%。' } },
  { id: 'berserker', branch: 'damage', icon: 'berserker', requires: ['brutal', 'momentum'], cost: 2, ability: true, name: { en: 'Berserker', zh: '狂战之魂' }, doc: { en: 'At or below half health: damage +25% and critical chance +10%.', zh: '生命值不高于一半时：伤害 +25%，暴击率 +10%。' } },

  { id: 'vitality', branch: 'survival', icon: 'heart', grant: { maxHp: 4 }, name: { en: 'Vitality', zh: '体魄' }, doc: { en: 'Max health +4.', zh: '生命上限 +4。' } },
  { id: 'toughness', branch: 'survival', icon: 'shield', requires: ['vitality'], grant: { def: 1 }, name: { en: 'Toughness', zh: '坚韧' }, doc: { en: 'Defence +1: every blow you take is one weaker.', zh: '防御 +1：受到的每次伤害减 1。' } },
  { id: 'hardy', branch: 'survival', icon: 'hardy', requires: ['toughness'], grant: { maxHp: 6 }, name: { en: 'Hardy', zh: '强健' }, doc: { en: 'Max health +6.', zh: '生命上限 +6。' } },
  { id: 'defiance', branch: 'survival', icon: 'defiance', requires: ['hardy'], ability: true, name: { en: 'Defiance', zh: '绝境韧性' }, doc: { en: 'At or below 30% health, direct combat damage taken is reduced by 25%. Minimum 1; not hunger or environmental damage.', zh: '生命值不高于 30% 时，直接战斗伤害降低 25%，最低仍为 1；不减免饥饿或环境伤害。' } },
  { id: 'iron-stomach', branch: 'survival', icon: 'drumstick', requires: ['vitality'], grant: { hungerEvery: 240 }, name: { en: 'Iron Stomach', zh: '耐饿' }, doc: { en: 'You grow hungry a third more slowly.', zh: '饥饿速度降低三分之一。' } },
  { id: 'second-wind', branch: 'survival', icon: 'renew', requires: ['iron-stomach'], ability: true, name: { en: 'Second Wind', zh: '自愈' }, doc: { en: 'You heal whenever your food bar is at least half full, not only when nearly full.', zh: '饱食度过半就会自动回血，而不必接近全满。' } },
  { id: 'last-stand', branch: 'survival', icon: 'last-stand', requires: ['defiance', 'second-wind'], cost: 2, ability: true, name: { en: 'Last Stand', zh: '不屈意志' }, doc: { en: 'A lethal direct combat hit leaves you at 1 health, once every 30 seconds. Does not save you from hunger or environmental damage.', zh: '致命的直接战斗伤害会使你保留 1 点生命，冷却 30 秒；不能抵御饥饿或环境造成的死亡。' } },
  // survival, deeper: health, defence, hunger, regeneration, and what saves you at the brink
  { id: 'iron-will', branch: 'survival', icon: 'iron-will', requires: ['hardy'], grant: { maxHp: 8 }, name: { en: 'Iron Will', zh: '钢铁意志' }, doc: { en: 'Max health +8.', zh: '生命上限 +8。' } },
  { id: 'thick-skin', branch: 'survival', icon: 'thick-skin', requires: ['toughness'], grant: { def: 1 }, name: { en: 'Thick Skin', zh: '厚皮' }, doc: { en: 'Defence +1.', zh: '防御 +1。' } },
  { id: 'fortress', branch: 'survival', icon: 'fortress', requires: ['thick-skin'], grant: { def: 2 }, name: { en: 'Fortress', zh: '坚城' }, doc: { en: 'Defence +2.', zh: '防御 +2。' } },
  { id: 'frugal', branch: 'survival', icon: 'frugal', requires: ['iron-stomach'], grant: { hungerEvery: 240 }, name: { en: 'Frugal', zh: '节食' }, doc: { en: 'You grow hungry more slowly still (fed, a point every 96 game minutes instead of 72).', zh: '饥饿速度进一步降低（吃饱时每 96 游戏分钟掉一点，而不是 72 分钟）。' } },
  { id: 'hearty-meals', branch: 'survival', icon: 'hearty-meals', requires: ['iron-stomach'], ability: true, name: { en: 'Hearty Meals', zh: '饱餐' }, doc: { en: 'Food fills you 50% more.', zh: '食物恢复的饱食度 +50%。' } },
  { id: 'regeneration', branch: 'survival', icon: 'regeneration', requires: ['second-wind'], ability: true, name: { en: 'Regeneration', zh: '再生' }, doc: { en: 'You heal whenever your food bar is at least a quarter full.', zh: '饱食度只要不少于四分之一就会自动回血。' } },
  { id: 'adrenaline', branch: 'survival', icon: 'adrenaline', requires: ['defiance'], ability: true, name: { en: 'Adrenaline', zh: '肾上腺素' }, doc: { en: 'When a blow leaves you at or below 30% health: movement speed +30% and 1 health a second for 5 seconds. Once a minute.', zh: '受到攻击后生命值不高于 30% 时：5 秒内移动速度 +30%，每秒恢复 1 点生命。每分钟最多一次。' } },
  { id: 'phoenix', branch: 'survival', icon: 'phoenix', requires: ['fortress', 'regeneration'], cost: 2, ability: true, name: { en: 'Phoenix', zh: '涅槃' }, doc: { en: 'Once a day, any lethal damage — blows, fire, hunger — leaves you at 30% health, untouchable for 3 seconds.', zh: '每天一次：任何致命伤害（攻击、火焰、饥饿）都会让你保留 30% 生命，并在 3 秒内免疫伤害。' } },

  { id: 'assassin-training', branch: 'profession', profession: 'assassin', icon: 'blade-mastery', ability: true, name: { en: 'Short-Blade Training', zh: '短兵精通' }, doc: { en: 'Dagger attacks gain +1 power. Like every assassin talent, it answers daggers only, never common weapons.', zh: '使用匕首攻击时威力 +1。刺客的所有天赋都只对匕首生效，通用武器无效。' } },
  { id: 'ambush', branch: 'profession', profession: 'assassin', icon: 'shadow', requires: ['assassin-training'], ability: true, name: { en: 'Ambush', zh: '暗影先手' }, doc: { en: 'After 4 seconds without attacking or taking combat damage, the next primary melee hit gains 50% damage. This is an opener, not invisibility.', zh: '连续 4 秒未攻击且未受到战斗伤害后，下一次近战主目标命中伤害 +50%；这是先手蓄势，不是隐身。' } },
  { id: 'relentless', branch: 'profession', profession: 'assassin', icon: 'combo', requires: ['ambush'], ability: true, name: { en: 'Relentless', zh: '连环刺击' }, doc: { en: 'Every third primary melee hit on the same actor gains 60% damage. Each hit must land within 2 seconds; changing target, missing or using a ranged attack resets the combo.', zh: '对同一生物的每第 3 次近战主目标命中，伤害 +60%。相邻命中间隔不得超过 2 秒；换目标、挥空或远程攻击会中断连击。' } },
  { id: 'backstab', branch: 'profession', profession: 'assassin', icon: 'dagger', requires: ['assassin-training'], ability: true, name: { en: 'Backstab', zh: '背刺' }, doc: { en: 'Primary melee attacks from behind the target gain 40% damage, judged by the target facing. Side and front attacks do not qualify.', zh: '从目标背后进行近战主目标攻击，伤害 +40%；根据目标朝向判断，侧面和正面不触发。' } },
  { id: 'shadow-recovery', branch: 'profession', profession: 'assassin', icon: 'shadow-recovery', requires: ['backstab'], ability: true, name: { en: 'Shadow Recovery', zh: '影中汲取' }, doc: { en: 'Defeating a creature with a dagger restores 10% of max health, rounded up; never above max health.', zh: '用匕首击败生物时，恢复生命上限的 10%（向上取整），不超过生命上限。' } },
  { id: 'death-dance', branch: 'profession', profession: 'assassin', icon: 'death-dance', requires: ['relentless', 'shadow-recovery'], cost: 2, ability: true, name: { en: 'Death Dance', zh: '死亡之舞' }, doc: { en: 'A qualifying Ambush or Backstab is guaranteed to critically hit. Does not turn Sweep secondary hits into critical openers.', zh: '触发暗影先手或背刺的攻击必定暴击；不会让横扫副目标获得先手或背刺暴击。' } },

  // the warrior (combat.ts): melee arms; one arm holds the line, the other answers and rampages
  { id: 'warrior-arms', branch: 'profession', profession: 'warrior', icon: 'warrior-arms', ability: true, name: { en: 'Arms Training', zh: '武器训练' }, doc: { en: 'Sword attacks gain +1 power. Like every warrior talent that strikes, it answers swords only, never common weapons.', zh: '使用剑攻击时威力 +1。战士的攻击类天赋都只对剑生效，通用武器无效。' } },
  { id: 'bulwark', branch: 'profession', profession: 'warrior', icon: 'bulwark', requires: ['warrior-arms'], ability: true, name: { en: 'Bulwark', zh: '铁壁' }, doc: { en: 'Direct combat damage taken −15%. Minimum 1; not hunger or environmental damage.', zh: '受到的直接战斗伤害 −15%，最低仍为 1；不减免饥饿或环境伤害。' } },
  { id: 'unbreakable', branch: 'profession', profession: 'warrior', icon: 'unbreakable', requires: ['bulwark'], grant: { maxHp: 10 }, name: { en: 'Unbreakable', zh: '不破之身' }, doc: { en: 'Max health +10.', zh: '生命上限 +10。' } },
  { id: 'retaliation', branch: 'profession', profession: 'warrior', icon: 'retaliation', requires: ['warrior-arms'], ability: true, name: { en: 'Retaliation', zh: '以牙还牙' }, doc: { en: 'Within 2 seconds of taking a combat hit, your next primary sword hit gains 40% damage.', zh: '受到战斗伤害后的 2 秒内，下一次用剑的主目标命中伤害 +40%。' } },
  { id: 'rampage', branch: 'profession', profession: 'warrior', icon: 'rampage', requires: ['retaliation'], ability: true, name: { en: 'Rampage', zh: '狂暴' }, doc: { en: 'Felling a creature with a sword: +15% sword damage for 5 seconds, stacking up to three times.', zh: '用剑击倒生物后，5 秒内剑的伤害 +15%，最多叠加 3 层。' } },
  { id: 'warlord', branch: 'profession', profession: 'warrior', icon: 'warlord', requires: ['unbreakable', 'rampage'], cost: 2, ability: true, name: { en: 'Warlord', zh: '战争领主' }, doc: { en: 'Bulwark rises to −30%, and every Retaliation hit that lands restores 2 health.', zh: '铁壁减伤提高到 30%；每次以牙还牙命中恢复 2 点生命。' } },
  // the ranger: bows; one arm stands and aims, the other shoots and moves
  { id: 'ranger-archery', branch: 'profession', profession: 'ranger', icon: 'ranger-archery', ability: true, name: { en: 'Archery', zh: '箭术' }, doc: { en: 'Bows gain +1 power and +1 range. Ranger talents answer bows only.', zh: '弓的威力 +1，射程 +1。游侠天赋只对弓生效。' } },
  { id: 'steady-aim', branch: 'profession', profession: 'ranger', icon: 'steady-aim', requires: ['ranger-archery'], ability: true, name: { en: 'Steady Aim', zh: '稳定瞄准' }, doc: { en: 'Bow hits gain 30% damage when you have not moved for 1 second.', zh: '1 秒内没有移动时，弓箭命中伤害 +30%。' } },
  { id: 'sniper', branch: 'profession', profession: 'ranger', icon: 'sniper', requires: ['steady-aim'], ability: true, name: { en: 'Sniper', zh: '狙击' }, doc: { en: 'Bow hits on targets 3 or more tiles away gain 25% damage.', zh: '弓箭命中 3 格及以外的目标时，伤害 +25%。' } },
  { id: 'fleet-archer', branch: 'profession', profession: 'ranger', icon: 'fleet-archer', requires: ['ranger-archery'], ability: true, name: { en: 'Fleet Archer', zh: '游击' }, doc: { en: 'After a bow hit lands, movement speed +20% for 1.5 seconds.', zh: '弓箭命中后，1.5 秒内移动速度 +20%。' } },
  { id: 'quick-draw', branch: 'profession', profession: 'ranger', icon: 'quick-draw', requires: ['fleet-archer'], ability: true, name: { en: 'Quick Draw', zh: '快速拉弓' }, doc: { en: 'Attack speed +20% while holding a bow.', zh: '手持弓时攻击速度 +20%。' } },
  { id: 'hunters-mark', branch: 'profession', profession: 'ranger', icon: 'hunters-mark', requires: ['sniper', 'quick-draw'], cost: 2, ability: true, name: { en: "Hunter's Mark", zh: '猎手印记' }, doc: { en: 'Every third bow hit in a row on the same target is a guaranteed critical hit.', zh: '对同一目标连续第 3 次弓箭命中必定暴击。' } },
  // the mage: wands and staves; one arm deepens the spells, the other keeps the caster alive
  { id: 'mage-focus', branch: 'profession', profession: 'mage', icon: 'mage-focus', ability: true, name: { en: 'Arcane Focus', zh: '奥术专注' }, doc: { en: 'Staves gain +1 power. Mage talents answer staves only; a wand is a common weapon.', zh: '法杖的威力 +1。法师天赋只对法杖生效；魔杖是通用武器。' } },
  { id: 'elemental-attunement', branch: 'profession', profession: 'mage', icon: 'elemental-attunement', requires: ['mage-focus'], ability: true, name: { en: 'Elemental Attunement', zh: '元素亲和' }, doc: { en: 'Spells from a staff with an element (fire, ice, lightning…) gain 25% damage.', zh: '带元素（火、冰、雷……）的法杖施法伤害 +25%。' } },
  { id: 'spell-echo', branch: 'profession', profession: 'mage', icon: 'spell-echo', requires: ['elemental-attunement'], ability: true, name: { en: 'Spell Echo', zh: '法术回响' }, doc: { en: 'Every fourth spell that lands is a guaranteed critical hit.', zh: '每第 4 次命中的法术必定暴击。' } },
  { id: 'mana-shield', branch: 'profession', profession: 'mage', icon: 'mana-shield', requires: ['mage-focus'], ability: true, name: { en: 'Mana Shield', zh: '法力护盾' }, doc: { en: 'Direct combat damage taken −20% while holding a staff.', zh: '手持法杖时，受到的直接战斗伤害 −20%。' } },
  { id: 'arcane-recovery', branch: 'profession', profession: 'mage', icon: 'arcane-recovery', requires: ['mana-shield'], ability: true, name: { en: 'Arcane Recovery', zh: '奥术汲取' }, doc: { en: 'Felling a creature with a staff restores 3 health.', zh: '用法杖击倒生物时恢复 3 点生命。' } },
  { id: 'archmage', branch: 'profession', profession: 'mage', icon: 'archmage', requires: ['spell-echo', 'arcane-recovery'], cost: 2, ability: true, name: { en: 'Archmage', zh: '大法师' }, doc: { en: 'Staves gain +2 more power and +1 range.', zh: '法杖的威力再 +2，射程 +1。' } },
  { id: 'long-reach', branch: 'gathering', icon: 'magnet', grant: { magnet: 2 }, name: { en: 'Long Reach', zh: '长臂' }, doc: { en: 'Dropped things fly to you from two tiles farther.', zh: '掉落物的吸取范围扩大 2 格。' } },
  { id: 'woodcutter', branch: 'gathering', icon: 'axe', requires: ['long-reach'], ability: true, name: { en: 'Woodcutter', zh: '伐木工' }, doc: { en: 'A tree you fell gives one more log.', zh: '砍倒的树多掉一根木头。' } },
  { id: 'big-pack', branch: 'gathering', icon: 'pack', requires: ['woodcutter'], grant: { bagRows: 1 }, name: { en: 'Big Pack', zh: '大背包' }, doc: { en: 'One more row in the bag.', zh: '背包多一行。' } },
  { id: 'firemaker', branch: 'gathering', icon: 'flame', requires: ['big-pack'], ability: true, name: { en: 'Firemaker', zh: '钻木取火' }, doc: { en: 'Light a campfire, brazier or candles with a plain stick.', zh: '用一根普通树枝就能点燃营火、火盆或蜡烛。' } },
]

// the active skills (engine/src/actives.ts): cast from the skill bar (Shift+1–6), then they rest. Everyone's four — two
// blows, a quickness, a mending — and four for each profession. Cooldowns in ticks (10 a second).
const ACTIVE = (id: string, branch: string, requires: string[], active: SkillDef['active'], en: string, zh: string, docEn: string, docZh: string, profession?: string): SkillDef =>
  ({ id, branch, icon: id, requires, ability: true, active, ...(profession && { profession }), name: { en, zh }, doc: { en: `${docEn} Cooldown ${active!.cooldown / 10} s.`, zh: `${docZh}冷却 ${active!.cooldown / 10} 秒。` } })

export const ACTIVE_SKILLS: SkillDef[] = [
  ACTIVE('whirlwind', 'damage', ['sweep'], { kind: 'whirlwind', cooldown: 80, power: 1.2 }, 'Whirlwind', '旋风斩', 'Spin: strike every foe on the eight cells around you (×1.2).', '原地旋转，攻击周围 8 格的所有敌人（1.2 倍伤害）。'),
  ACTIVE('cleave', 'damage', ['strength'], { kind: 'cleave', cooldown: 60, power: 2.5 }, 'Cleave', '重劈', 'One heavy blow on the cell ahead (×2.5).', '对前方一格重重劈下（2.5 倍伤害）。'),
  ACTIVE('gale-step', 'swiftness', ['light-footed'], { kind: 'haste', cooldown: 200, ticks: 50 }, 'Gale Step', '疾风步', 'Movement speed +50% for 5 seconds.', '5 秒内移动速度 +50%。'),
  ACTIVE('mend', 'survival', ['regeneration'], { kind: 'mend', cooldown: 300, power: 0.3 }, 'Mend', '疗伤', 'Restore 30% of your max health at once.', '立即恢复 30% 生命上限的生命。'),

  ACTIVE('shadow-strike', 'profession', ['assassin-training'], { kind: 'shadow-strike', cooldown: 100, power: 1.5, range: 4 }, 'Shadow Strike', '影袭', 'Step out of the shadows behind the nearest foe within 4 cells and strike (×1.5; Backstab applies).', '闪到 4 格内最近敌人的背后并攻击（1.5 倍伤害，可触发背刺）。', 'assassin'),
  ACTIVE('envenom', 'profession', ['assassin-training'], { kind: 'envenom', cooldown: 200, count: 5 }, 'Envenom', '淬毒', 'Your next 5 blows each open a bleed (1 a second for 4 seconds).', '接下来 5 次攻击都会让目标流血（4 秒内每秒 1 点）。', 'assassin'),
  ACTIVE('smoke-bomb', 'profession', ['shadow-strike'], { kind: 'veil', cooldown: 250, ticks: 30 }, 'Smoke Bomb', '烟雾弹', 'For 3 seconds no creature can see you to attack you.', '3 秒内怪物看不见你，不会攻击你。', 'assassin'),
  ACTIVE('flurry', 'profession', ['envenom'], { kind: 'flurry', cooldown: 80, power: 0.6, count: 4 }, 'Flurry', '千刃', 'Four quick stabs on the cell ahead (×0.6 each).', '对前方一格快速连刺 4 次（每次 0.6 倍伤害）。', 'assassin'),

  ACTIVE('shield-bash', 'profession', ['warrior-arms'], { kind: 'bash', cooldown: 100, power: 1, afflict: 'stunned', ticks: 15 }, 'Shield Bash', '盾击', 'Strike the cell ahead and stun it for 1.5 seconds.', '攻击前方一格并使其眩晕 1.5 秒。', 'warrior'),
  ACTIVE('charge', 'profession', ['warrior-arms'], { kind: 'charge', cooldown: 120, power: 1.5, range: 3, afflict: 'stunned', ticks: 5 }, 'Charge', '冲锋', 'Rush up to 3 cells ahead into the first foe and strike it (×1.5, a moment\'s stun).', '向前冲锋最多 3 格，撞上第一个敌人并攻击（1.5 倍伤害，短暂眩晕）。', 'warrior'),
  ACTIVE('war-cry', 'profession', ['shield-bash'], { kind: 'rally', cooldown: 250, ticks: 50 }, 'War Cry', '战吼', 'For 5 seconds: damage dealt +25%, combat damage taken −30%.', '5 秒内造成的伤害 +25%，受到的战斗伤害 −30%。', 'warrior'),
  ACTIVE('earthsplitter', 'profession', ['charge'], { kind: 'quake', cooldown: 120, power: 1.3, afflict: 'stunned', ticks: 8 }, 'Earthsplitter', '裂地', 'Slam the ground: every foe on the 3×3 two cells ahead is struck (×1.3) and staggered.', '重击地面：前方两格处 3×3 范围内的敌人受到攻击（1.3 倍伤害）并被震晕片刻。', 'warrior'),

  ACTIVE('multishot', 'profession', ['ranger-archery'], { kind: 'multishot', range: 6, cooldown: 80, power: 0.8 }, 'Multishot', '多重箭', 'Three arrows side by side, each striking the first foe in its line (×0.8).', '并排射出 3 支箭，各自命中所在直线上的第一个敌人（0.8 倍伤害）。', 'ranger'),
  ACTIVE('leap-shot', 'profession', ['ranger-archery'], { kind: 'leap-shot', range: 6, cooldown: 100, power: 1.2, count: 2 }, 'Leap Shot', '后跃射击', 'Leap 2 cells back and loose an arrow ahead (×1.2).', '向后跃 2 格，同时向前射出一箭（1.2 倍伤害）。', 'ranger'),
  ACTIVE('piercing-arrow', 'profession', ['multishot'], { kind: 'pierce', range: 6, cooldown: 100, power: 1.3 }, 'Piercing Arrow', '穿透箭', 'An arrow through every foe in its line, up to the first wall (×1.3).', '一箭贯穿直线上的所有敌人，直到墙壁（1.3 倍伤害）。', 'ranger'),
  ACTIVE('arrow-rain', 'profession', ['leap-shot'], { kind: 'rain', range: 6, cooldown: 200, power: 0.6, count: 3 }, 'Arrow Rain', '箭雨', 'Arrows fall on the 3×3 around the first foe ahead, once a second for 3 seconds (×0.6 each).', '在前方第一个敌人周围 3×3 范围落下箭雨，每秒一轮，持续 3 秒（每轮 0.6 倍伤害）。', 'ranger'),

  ACTIVE('fireball', 'profession', ['mage-focus'], { kind: 'fireball', range: 5, cooldown: 60, power: 1.5, element: 'fire' }, 'Fireball', '火球', 'A ball of fire that bursts on the first thing ahead, striking the 3×3 around it (×1.5, fire).', '发射火球，在前方第一个目标处爆炸，波及周围 3×3（1.5 倍火焰伤害）。', 'mage'),
  ACTIVE('frost-nova', 'profession', ['mage-focus'], { kind: 'nova', cooldown: 150, power: 0.5, range: 2, element: 'ice', afflict: 'frozen', ticks: 20 }, 'Frost Nova', '冰霜新星', 'Every foe within 2 cells is struck by ice (×0.5) and frozen for 2 seconds.', '周围 2 格内的敌人受到冰霜伤害（0.5 倍）并被冻结 2 秒。', 'mage'),
  ACTIVE('chain-lightning', 'profession', ['fireball'], { kind: 'chain', range: 5, cooldown: 100, power: 1.2, count: 3, element: 'lightning' }, 'Chain Lightning', '闪电链', 'Lightning strikes the first foe ahead and leaps on to 2 more nearby (×1.2 each).', '闪电击中前方第一个敌人，再跳向附近的另外 2 个（每次 1.2 倍伤害）。', 'mage'),
  ACTIVE('blink', 'profession', ['frost-nova'], { kind: 'blink', cooldown: 120, range: 4 }, 'Blink', '闪现', 'Vanish and reappear up to 4 cells ahead, through creatures but not walls.', '瞬移到前方最多 4 格处，可穿过生物，不能穿墙。', 'mage'),
]

SKILLS.push(...ACTIVE_SKILLS)

/** A skill book that teaches one active skill (read: used on oneself), named for it: for loot, shops and quests to hand out. */
export const skillBook = (id: string): Omit<Entity, 'id' | 'place'> => {
  const def = ACTIVE_SKILLS.find((s) => s.id === id)!
  const n = typeof def.name === 'string' ? { en: def.name, zh: def.name } : def.name
  return { type: 'item/document/skillbook', name: { en: `Skill Book: ${n.en}`, zh: `技能书·${n.zh ?? n.en}` }, props: { teaches: id } }
}

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]))

export const skillsForProfession = (profession: string): SkillDef[] => SKILLS.filter((s) => !s.profession || s.profession === profession)
