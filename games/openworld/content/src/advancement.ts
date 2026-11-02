// The advancements (docs/advancement.md, 2026-11-01): each profession's three paths (the second advancement, at level
// 10), its mastery (the third, at 16: not a path, the profession's own; a path may give it a name of its own), and four
// more skills of its first tree. The classes module keeps who has advanced how far (`advancement`, `path`) and learns a
// path's skill only on that path (`SkillDef.path`), a mastery's only at the third tier (`tier: 3`). Most passives are
// data (`SkillDef.passive`, read by the module's combat: a condition and what it pays); the few that answer an event
// are talents there by id. What the new actives lay — the miasma, the snare, the spikes, the blast trap, briars, a wall
// of flame, holy ground, caltrops, a binding sigil — and the creatures they call are this file's too, each with its rule.

import type { ActiveDef, Effect, Rule, SkillDef, SkillPassive, Text, TypeDef } from '@openworld/engine'
import type { PathDef } from '@openworld/modules'
import { DO } from './afflictions.ts'

const L = (en: string, zh: string): Text => ({ en, zh })
const rule = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'advancement' } })

// ------------------------------------------------------------------ what the actives lay and call

export const HAZARDS = {
  miasma: 'fixture/hazard/miasma',
  snare: 'fixture/hazard/snare',
  spikes: 'fixture/hazard/spikes',
  blast: 'fixture/hazard/blast_trap',
  briars: 'fixture/hazard/briar_line',
  flame: 'fixture/hazard/flame_wall',
  holy: 'fixture/hazard/holy_ground',
  caltrops: 'fixture/hazard/caltrops',
  sigil: 'fixture/hazard/binding_sigil',
} as const
export const SUMMONS = { hound: 'actor/summon/hound', wolf: 'actor/summon/wolf', skeleton: 'actor/summon/skeleton', hellguard: 'actor/summon/hell_guard' } as const

const hazard = (id: string, en: string, zh: string, lasts: number, tags: string[] = []): TypeDef => ({ id, name: L(en, zh), tags: ['hazard', ...tags], sprite: `fixture:${id.split('/').pop()}`, stage: { lasts } })

export const ADVANCEMENT_TYPES: TypeDef[] = [
  hazard(HAZARDS.miasma, 'miasma', '瘴气', 50, ['poison']),
  hazard(HAZARDS.snare, 'snare', '绊索', 600, ['trap']),
  hazard(HAZARDS.spikes, 'spikes', '尖刺', 200, ['trap', 'sharp']),
  hazard(HAZARDS.blast, 'blast trap', '爆炸陷阱', 600, ['trap']),
  { ...hazard(HAZARDS.briars, 'briars', '荆棘', 60, ['thorny']), sprite: 'fixture:briar' },
  hazard(HAZARDS.flame, 'wall of flame', '火墙', 50, ['hot']),
  hazard(HAZARDS.holy, 'holy ground', '圣域', 60, ['holy']),
  hazard(HAZARDS.caltrops, 'caltrops', '铁蒺藜', 60, ['sharp']),
  hazard(HAZARDS.sigil, 'binding sigil', '封魔阵', 80, ['holy']),
  // what a Beastmaster or a Necromancer calls: of the caster's side (faction ally), following them, fighting their foes,
  // gone in a while
  { id: 'actor/summon', name: L('called beast', '召唤兽'), tags: ['creature', 'living', 'faction:ally', 'summoned'], props: { hp: 20, maxHp: 20, atk: 3, def: 0, speed: 4, sight: 7, temper: 'aggressive', behaviour: 'melee' } },
  { id: SUMMONS.hound, name: L('hound', '猎犬'), sprite: 'creature:wolf', stage: { lasts: 400 }, props: { hp: 30, maxHp: 30, atk: 4 } },
  { id: SUMMONS.wolf, name: L('wolf of the pack', '狼群之狼'), sprite: 'creature:wolf', stage: { lasts: 200 }, props: { hp: 24, maxHp: 24, atk: 4 } },
  { id: SUMMONS.skeleton, name: L('raised skeleton', '亡者骷髅'), sprite: 'creature:skeleton', tags: ['bone'], stage: { lasts: 300 }, props: { hp: 22, maxHp: 22, atk: 4 } },
  { id: SUMMONS.hellguard, name: L('guard of hell', '冥狱守卫'), sprite: 'creature:skeleton_demon', tags: ['bone'], stage: { lasts: 400 }, props: { hp: 60, maxHp: 60, atk: 8, def: 2 } },
]

/** Who steps onto a hazard and is not its owner (the caster: a trap is never one's own undoing) nor of the caster's side. */
const trodBy = { all: [{ param: { key: 'how', cmp: 'under' } }, { is: { role: 'other', sel: { type: 'actor', notTags: ['faction:ally', 'faction:folk', 'airborne'] } } }, { not: { owns: ['other', 'host'] } }] } as const
const strikeOther = (params: Record<string, string | number | boolean>): Effect => ({ op: 'emit', impulse: 'strike', to: 'other', params })
const goes = (id: string, host: string, fx: string): Rule =>
  rule({ id, doc: 'What a skill laid goes when its while is out.', host: { type: host }, on: 'time/timer', tree: { if: { param: { key: 'status', cmp: 'stage' } }, then: DO({ op: 'vfx', fx, at: 'tileOf:host' }, { op: 'destroy' }), else: 'inherit' } })

export const ADVANCEMENT_RULES: Rule[] = [
  rule({ id: 'adv/miasma', doc: 'A Necromancer\'s miasma poisons the foe that walks into it.', host: { type: HAZARDS.miasma }, on: 'contact/begin', tree: { if: trodBy as never, then: DO(strikeOther({ power: 1, edge: 'magic', afflict: 'poisoned', afflictFor: 50 })), else: 'inherit' } }),
  rule({ id: 'adv/snare', doc: 'A snare holds the first foe on it (webbed, 3 s), and is spent.', host: { type: HAZARDS.snare }, on: 'contact/begin', tree: { if: trodBy as never, then: DO(strikeOther({ power: 1, afflict: 'webbed', afflictFor: 30 }), { op: 'vfx', fx: 'hit', at: 'tileOf:host' }, { op: 'destroy' }), else: 'inherit' } }),
  rule({ id: 'adv/spikes', doc: 'Spikes cut the foe that crosses them (it bleeds) and mire it.', host: { type: HAZARDS.spikes }, on: 'contact/begin', tree: { if: trodBy as never, then: DO(strikeOther({ power: 2, edge: 'cut', bleed: 30, afflict: 'mired', afflictFor: 20 })), else: 'inherit' } }),
  rule({ id: 'adv/blast', doc: 'A blast trap bursts under the foe that steps on it (fire), and is spent.', host: { type: HAZARDS.blast }, on: 'contact/begin', tree: { if: trodBy as never, then: DO(strikeOther({ power: 8, element: 'fire', afflict: 'burning', afflictFor: 30 }), { op: 'vfx', fx: 'explosion', at: 'tileOf:host' }, { op: 'destroy' }), else: 'inherit' } }),
  rule({ id: 'adv/briars', doc: 'The Thornknight\'s briars make the foe that walks into them kneel.', host: { type: HAZARDS.briars }, on: 'contact/begin', tree: { if: trodBy as never, then: DO(strikeOther({ power: 1, edge: 'cut', afflict: 'knelt', afflictFor: 10 })), else: 'inherit' } }),
  rule({ id: 'adv/flame', doc: 'A wall of flame burns the foe that walks into it.', host: { type: HAZARDS.flame }, on: 'contact/begin', tree: { if: trodBy as never, then: DO(strikeOther({ power: 3, element: 'fire', afflict: 'burning', afflictFor: 30 })), else: 'inherit' } }),
  rule({ id: 'adv/caltrops', doc: 'Caltrops prick and mire the foe that steps on them.', host: { type: HAZARDS.caltrops }, on: 'contact/begin', tree: { if: trodBy as never, then: DO(strikeOther({ power: 1, edge: 'cut', afflict: 'mired', afflictFor: 30 })), else: 'inherit' } }),
  rule({ id: 'adv/sigil', doc: 'A Demon Hunter\'s binding sigil hexes the foe that walks into it (weaker, softer, slower).', host: { type: HAZARDS.sigil }, on: 'contact/begin', tree: { if: trodBy as never, then: DO(strikeOther({ power: 1, edge: 'magic', afflict: 'hexed', afflictFor: 40 })), else: 'inherit' } }),
  goes('adv/miasma-thins', HAZARDS.miasma, 'smoke'),
  goes('adv/snare-rots', HAZARDS.snare, 'leaves'),
  goes('adv/spikes-sink', HAZARDS.spikes, 'dust'),
  goes('adv/blast-rusts', HAZARDS.blast, 'dust'),
  goes('adv/briars-wither', HAZARDS.briars, 'leaves'),
  goes('adv/flame-dies', HAZARDS.flame, 'smoke'),
  goes('adv/holy-fades', HAZARDS.holy, 'sparkle'),
  goes('adv/caltrops-sink', HAZARDS.caltrops, 'dust'),
  goes('adv/sigil-fades', HAZARDS.sigil, 'sparkle'),
  rule({ id: 'adv/summon-goes', doc: 'A called beast, or the raised dead, goes back where it came from when its while is out.', host: { type: 'actor/summon' }, on: 'time/timer', tree: { if: { param: { key: 'status', cmp: 'stage' } }, then: DO({ op: 'vfx', fx: 'poof', at: 'tileOf:host' }, { op: 'destroy' }), else: 'inherit' } }),
]

// ------------------------------------------------------------------ the skills

const cd = (a: ActiveDef) => `${a.cooldown / 10}`
/** Where a skill stands: on a path, the mastery (`tier: 3`, on a path when the path's third is its own), the first tree. */
type Where = { path?: string | string[]; tier?: number }
/** An active skill of a path (or the mastery, `tier: 3`; or the first tree, neither). */
const A = (id: string, profession: string, where: Where, requires: string[], active: ActiveDef, en: string, zh: string, docEn: string, docZh: string, cost = 1): SkillDef => ({
  id, branch: where.tier ? 'mastery' : where.path ? 'path' : 'profession', profession, ...(where.path && { path: where.path }), ...(where.tier && { tier: where.tier }),
  icon: id, requires, ability: true, active, ...(cost > 1 && { cost }), name: L(en, zh),
  doc: L(`${cost > 1 ? 'Ultimate: ' : ''}${docEn} Cooldown ${cd(active)} s.`, `${cost > 1 ? '终极：' : ''}${docZh}冷却 ${cd(active)} 秒。`),
})
/** A passive: in data (`passive`), a number granted (`grant`), or a talent the module answers by its id (neither). */
const T = (id: string, profession: string, where: Where, requires: string[], en: string, zh: string, docEn: string, docZh: string, extra: { passive?: SkillPassive; grant?: Record<string, number>; modifies?: SkillDef['modifies']; cost?: number } = {}): SkillDef => ({
  id, branch: where.tier ? 'mastery' : where.path ? 'path' : 'profession', profession, ...(where.path && { path: where.path }), ...(where.tier && { tier: where.tier }),
  icon: id, requires, ...(extra.grant || extra.modifies ? {} : { ability: true }), ...extra, name: L(en, zh), doc: L(`${(extra.cost ?? 1) > 1 ? 'Capstone: ' : ''}${docEn}`, `${(extra.cost ?? 1) > 1 ? '终极天赋：' : ''}${docZh}`),
})

const OWN = { weapon: 'own' } as const

// --- the assassin
const NE = { path: 'necromancer' }
const SD = { path: 'shadowdancer' }
const DH = { path: 'demonhunter' }
/** The Necromancer's third (Hell Sovereign) is its own; the other two paths share the assassin's mastery. */
const HS = { path: 'necromancer', tier: 3 }
const AM = { path: ['shadowdancer', 'demonhunter'], tier: 3 }
/** A mastery every path of the profession shares. */
const MS = { tier: 3 }
/** What the Demon Hunter's lore reads as a foe afflicted. */
const AFFLICTED = ['hexed', 'poisoned', 'bleeding', 'burning', 'frozen', 'stunned', 'mired', 'webbed', 'knelt']
const ASSASSIN: SkillDef[] = [
  // (the Necromancer stands back: the dead it raises and the poison do the killing — an arm of each, an army at the end)
  T('grave-pact', 'assassin', NE, [], 'Grave Pact', '亡者契约', 'The dead you raise have half again their health and strike 30% harder.', '你唤起的亡者生命 +50%，伤害 +30%。'),
  A('raise-dead', 'assassin', NE, ['grave-pact'], { kind: 'summon', creature: SUMMONS.skeleton, cooldown: 400, count: 2 }, 'Raise Dead', '亡者复苏', 'Two skeletons climb out of the ground and fight at your side for 30 s.', '两具骷髅从地下爬出，在你身边战斗 30 秒。'),
  A('miasma', 'assassin', NE, ['grave-pact'], { kind: 'field', leaves: HAZARDS.miasma, pattern: 'square', cooldown: 160 }, 'Miasma', '瘴气', 'A poison cloud on the 3×3 two cells ahead for 5 s: the foes in it are poisoned.', '在前方两格处的 3×3 范围放出毒雾，持续 5 秒：进入的敌人中毒。'),
  A('drive-the-dead', 'assassin', NE, ['raise-dead'], { kind: 'command', cooldown: 120, power: 1.5, range: 6, count: 4, afflict: 'poisoned', ticks: 30 }, 'Drive the Dead', '驱使亡者', 'Up to four of the dead you raised leap on the first foe ahead within 6 cells, each striking it (×1.5 of its own), and poison it.', '离你最近的至多四个亡者扑向前方 6 格内的第一个敌人，各按自身攻击打 1.5 倍，并让它中毒。'),
  T('grave-toxin', 'assassin', NE, ['raise-dead'], 'Grave Toxin', '尸毒', 'Every blow of the dead you raise poisons the struck for 3 s.', '你唤起的亡者每次攻击都会让目标中毒 3 秒。'),
  T('corpse-burst', 'assassin', NE, ['miasma'], 'Corpse Burst', '尸爆', 'A poisoned foe felled by you or the dead you raise bursts: every foe within 2 cells is struck (×0.6) and poisoned.', '你或你唤起的亡者击倒中毒的敌人时，尸体会爆开：2 格内的敌人受到攻击（0.6 倍伤害）并中毒。'),
  A('toxic-burst', 'assassin', NE, ['miasma'], { kind: 'detonate', status: 'poisoned', cooldown: 140, power: 2, range: 5 }, 'Toxic Burst', '毒爆', 'The poison in every foe within 5 cells bursts (×2.0): the poison in it is spent.', '5 格内所有中毒的敌人体内的毒爆开（2.0 倍伤害），毒随之耗尽。'),
  T('bone-ward', 'assassin', NE, ['drive-the-dead'], 'Bone Ward', '骨盾', 'With a companion near: combat damage taken −15%.', '有同伴在身边时，受到的战斗伤害 −15%。', { passive: { when: { companion: true }, taken: -0.15 } }),
  T('raise-dead-plus', 'assassin', NE, ['grave-toxin'], 'Raise Dead: Mastery', '亡者复苏·精通', 'Raise Dead: one more skeleton, cooldown −5 s.', '亡者复苏：多唤起一具骷髅，冷却 −5 秒。', { modifies: { skill: 'raise-dead', count: 1, cooldown: -50 } }),
  T('rot', 'assassin', NE, ['corpse-burst'], 'Rot', '腐毒', 'You and the companions within 6 cells: damage +20% against the poisoned.', '你和身边 6 格内的同伴对中毒的敌人伤害 +20%。', { passive: { party: true, when: { target: { status: ['poisoned'] } }, damage: 0.2 } }),
  T('toxic-burst-plus', 'assassin', NE, ['toxic-burst'], 'Toxic Burst: Mastery', '毒爆·精通', 'Toxic Burst: reach +2 cells, damage +0.5×.', '毒爆：范围 +2 格，伤害 +0.5 倍。', { modifies: { skill: 'toxic-burst', range: 2, power: 0.5 } }),
  A('army-of-the-dead', 'assassin', NE, ['raise-dead-plus', 'rot'], { kind: 'summon', creature: SUMMONS.skeleton, cooldown: 500, count: 4, power: 0.6, radius: 2, afflict: 'poisoned', ticks: 50 }, 'Army of the Dead', '亡者大军', 'The ground opens round you: every foe within 2 cells is struck (×0.6) and poisoned, and four skeletons climb out to fight at your side for 30 s.', '你周围的地面裂开：2 格内的敌人受到攻击（0.6 倍伤害）并中毒，四具骷髅爬出来，在你身边战斗 30 秒。', 2),

  T('shadow-poise', 'assassin', SD, [], 'Shadow Poise', '影舞', 'With a dagger: dodge +8%, critical chance +5%; a Backstab deals 30% more.', '持匕首时闪避 +8%，暴击率 +5%；背刺伤害再 +30%。', { passive: { when: OWN, dodge: 0.08, crit: 0.05 } }),
  A('umbral-step', 'assassin', SD, ['shadow-poise'], { kind: 'veil', cooldown: 140, ticks: 20, sure: true }, 'Umbral Step', '影遁', 'Vanish for 2 s: no creature sees you, and your next blow is a sure critical.', '隐去身形 2 秒：怪物看不见你，下一击必定暴击。'),
  A('blur', 'assassin', SD, ['shadow-poise'], { kind: 'buff', cooldown: 240, ticks: 40, buff: { dodge: 0.35, moveHaste: 0.2 } }, 'Blur', '残影', 'For 4 s: dodge +35%, movement speed +20%.', '4 秒内闪避 +35%，移动速度 +20%。'),
  T('unseen', 'assassin', SD, ['umbral-step'], 'Unseen', '无形', 'The first blow you strike from a veil (Umbral Step, Smoke Bomb) deals 50% more.', '从隐匿中（影遁、烟雾弹）打出的第一击伤害 +50%。'),
  T('riposte', 'assassin', SD, ['blur'], 'Riposte', '还击', 'A dodged blow readies your next: +80% damage within 2 s.', '闪避一次攻击后，2 秒内的下一击伤害 +80%。'),
  A('thousand-shadows', 'assassin', SD, ['unseen', 'riposte'], { kind: 'shadow-strike', cooldown: 300, power: 1.4, range: 4, count: 5 }, 'Thousand Shadows', '千影', 'Step behind up to five foes within 4 cells, one after another, striking each (×1.4).', '依次闪到 4 格内至多五个敌人背后，各攻击一次（1.4 倍伤害）。', 2),

  T('hunters-lore', 'assassin', DH, [], "Hunter's Lore", '猎魔学识', 'Damage +15% against a foe under an affliction (hexed, poisoned, bleeding, burning, frozen, stunned, mired, webbed, kneeling).', '对处于负面状态（咒印、中毒、流血、着火、冰冻、眩晕、迟滞、缠丝、跪地）的敌人伤害 +15%。', { passive: { when: { target: { status: AFFLICTED } }, damage: 0.15 } }),
  A('binding-sigil', 'assassin', DH, ['hunters-lore'], { kind: 'field', leaves: HAZARDS.sigil, pattern: 'square', cooldown: 180 }, 'Binding Sigil', '封魔阵', 'Draw a binding sigil on the 3×3 two cells ahead for 8 s: a foe who walks in is hexed for 4 s (attack −2, defence −3, slower).', '在前方两格处的 3×3 范围画下封魔阵，持续 8 秒：走进去的敌人被打上咒印 4 秒（攻击 −2，防御 −3，移动变慢）。'),
  A('hunt-call', 'assassin', DH, ['hunters-lore'], { kind: 'buff', cooldown: 300, ticks: 60, buff: { party: true, damage: 0.2, attackHaste: 0.15 } }, 'Call of the Hunt', '狩魔号令', 'For 6 s, you and the companions within 6 cells: damage +20%, attack speed +15%.', '6 秒内，你和身边 6 格内的同伴伤害 +20%，攻击速度 +15%。'),
  T('hex-edge', 'assassin', DH, ['binding-sigil'], 'Hexing Edge', '咒刃', 'With a dagger: one blow in five hexes the struck for 4 s.', '持匕首攻击时，有五分之一的几率给目标打上咒印 4 秒。'),
  T('hunters-vigil', 'assassin', DH, ['hunt-call'], "Hunter's Vigil", '猎魔守望', 'You and the companions within 6 cells take 10% less combat damage.', '你和身边 6 格内的同伴受到的战斗伤害 −10%。', { passive: { party: true, taken: -0.1 } }),
  A('demon-prison', 'assassin', DH, ['hex-edge', 'hunters-vigil'], { kind: 'field', leaves: HAZARDS.sigil, pattern: 'ring', cooldown: 380, power: 1, radius: 2, afflict: 'stunned', ticks: 15 }, 'Demon Prison', '镇魔结界', 'Every foe within 2 cells is struck (×1.0) and stunned for 1.5 s, and a ring of binding sigils is drawn round you.', '周围 2 格内的敌人受到攻击（1.0 倍伤害）并眩晕 1.5 秒，同时在你周围画下一圈封魔阵。', 2),

  // Hell Sovereign (the Necromancer's third): the dead stronger, a guard of hell, a plague round one, the gate of the Styx
  T('hell-pact', 'assassin', HS, [], 'Hell Pact', '地狱契约', 'The dead you raise have 30% more health and strike 30% harder again; you and your companions within 6 cells draw back 1 health with each blow.', '你唤起的亡者生命、伤害再 +30%；你和身边 6 格内的同伴每次命中吸取 1 点生命。', { passive: { party: true, drain: 1 } }),
  A('hell-guard', 'assassin', HS, ['hell-pact'], { kind: 'summon', creature: SUMMONS.hellguard, cooldown: 600, count: 1 }, 'Guard of Hell', '冥狱守卫', 'A guard of hell steps out of the ground, far stronger than a skeleton, and fights at your side for 40 s.', '一名冥狱守卫从地下走出，比骷髅强得多，在你身边战斗 40 秒。'),
  A('pestilence', 'assassin', HS, ['hell-pact'], { kind: 'rain', pattern: 'around', cooldown: 360, power: 0.4, count: 5, radius: 2, afflict: 'poisoned', ticks: 30 }, 'Pestilence', '瘟疫降临', 'A plague falls on the 5×5 round you, once a second for 5 s (×0.4 each), poisoning.', '在你周围 5×5 范围降下瘟疫，每秒一轮，持续 5 秒（每轮 0.4 倍伤害），并让敌人中毒。'),
  T('soul-harvest', 'assassin', HS, ['hell-guard'], 'Soul Harvest', '灵魂收割', 'Whenever the dead you raise fell a foe: you mend 3 health, and every skill is a second nearer.', '你唤起的亡者每击倒一个敌人，你恢复 3 点生命，所有技能冷却缩短 1 秒。'),
  T('plague-lord', 'assassin', HS, ['pestilence'], 'Plague Lord', '瘟疫领主', 'You and the companions within 6 cells: critical chance +15% against the poisoned.', '你和身边 6 格内的同伴攻击中毒的敌人时暴击率 +15%。', { passive: { party: true, when: { target: { status: ['poisoned'] } }, crit: 0.15 } }),
  A('gate-of-the-styx', 'assassin', HS, ['soul-harvest', 'plague-lord'], { kind: 'summon', creature: SUMMONS.hellguard, cooldown: 600, count: 2, power: 1, radius: 3, afflict: 'poisoned', ticks: 50 }, 'Gate of the Styx', '冥河之门', 'The gate of the Styx opens beside you: every foe within 3 cells is struck (×1.0) and poisoned, and two guards of hell step out to fight at your side for 40 s.', '冥河之门在你身边打开：3 格内的敌人受到攻击（1.0 倍伤害）并中毒，两名冥狱守卫走出来，在你身边战斗 40 秒。', 2),
  T('dominion-of-hell', 'assassin', HS, ['gate-of-the-styx'], 'Dominion of Hell', '地狱支配', 'You and the companions within 6 cells: damage +25%, attack speed +15%.', '你和身边 6 格内的同伴伤害 +25%，攻击速度 +15%。', { passive: { party: true, damage: 0.25, attackHaste: 0.15 }, cost: 2 }),

  T('lethality', 'assassin', AM, [], 'Lethality', '致命', 'With a dagger: critical damage +30%.', '持匕首时暴击伤害 +30%。', { passive: { when: OWN, critDamage: 0.3 } }),
  A('death-mark', 'assassin', AM, ['lethality'], { kind: 'mark', cooldown: 200, range: 6, ticks: 80, buff: { damage: 0.3 } }, 'Death Mark', '死亡印记', 'Mark the nearest foe within 6 cells: it takes 30% more from you for 8 s; if it falls marked, every skill is ready again.', '标记 6 格内最近的敌人：8 秒内它受到你的伤害 +30%；它在标记中倒下时，你的所有技能立即冷却完毕。'),
  T('ghost', 'assassin', AM, ['lethality'], 'Ghost', '幽灵', 'Dodge +8%.', '闪避 +8%。', { passive: { dodge: 0.08 } }),
  A('assassinate', 'assassin', AM, ['death-mark', 'ghost'], { kind: 'shadow-strike', cooldown: 360, power: 5, range: 6, count: 1, sure: true }, 'Assassinate', '刺杀', 'Step behind the nearest foe within 6 cells and strike once (×5), a sure critical.', '闪到 6 格内最近敌人的背后刺出一击（5 倍伤害），必定暴击。', 2),
  T('shadow-lord', 'assassin', AM, ['assassinate'], 'Shadow Lord', '影之主', 'Every fifth blow you strike is a critical.', '每第五次攻击必定暴击。', { cost: 2 }),

  A('garrote', 'assassin', {}, ['backstab'], { kind: 'bash', cooldown: 120, power: 2, afflict: 'stunned', ticks: 10 }, 'Garrote', '锁喉', 'Seize the foe ahead (×2; Backstab applies) and stun it for 1 s.', '扼住前方的敌人（2 倍伤害，可触发背刺）并使其眩晕 1 秒。'),
  A('caltrops', 'assassin', {}, ['ambush'], { kind: 'field', leaves: HAZARDS.caltrops, pattern: 'square', cooldown: 160 }, 'Caltrops', '铁蒺藜', 'Scatter caltrops on the 3×3 two cells ahead for 6 s: foes who step on them are pricked and mired.', '在前方两格处的 3×3 范围撒下铁蒺藜，持续 6 秒：踩上去的敌人被刺伤并陷足。'),
  T('light-step', 'assassin', {}, ['assassin-training'], 'Light Step', '轻步', 'With a dagger: movement speed +8%.', '持匕首时移动速度 +8%。', { passive: { when: OWN, moveHaste: 0.08 } }),
  T('cut-deep', 'assassin', {}, ['envenom'], 'Cut Deep', '深切', 'Damage +10% against the bleeding.', '对流血中的敌人伤害 +10%。', { passive: { when: { target: { status: ['bleeding'] } }, damage: 0.1 } }),
]

// --- the warrior
const SE = { path: 'sentinel' }
const BE = { path: 'berserker' }
const TK = { path: 'thornknight' }
const WARRIOR: SkillDef[] = [
  T('shieldbearer', 'warrior', SE, [], 'Shieldbearer', '持盾者', 'With a shield in the off hand: combat damage taken −10%.', '副手持盾时，受到的战斗伤害 −10%。', { passive: { when: { weapon: 'shield' }, taken: -0.1 } }),
  A('bastion', 'warrior', SE, ['shieldbearer'], { kind: 'buff', cooldown: 220, ticks: 40, buff: { front: 1 } }, 'Bastion', '堡垒', 'For 4 s every blow from the way you face is blocked.', '4 秒内来自正面的所有攻击都会被格挡。'),
  A('challenge', 'warrior', SE, ['shieldbearer'], { kind: 'taunt', cooldown: 180, range: 3, power: 0.3, afflict: 'stunned', ticks: 40, buff: { taken: -0.2 } }, 'Challenge', '挑衅', 'Strike every foe within 3 cells lightly (×0.3): they turn on you, dazed a moment; you take 20% less for 4 s.', '轻击周围 3 格内的所有敌人（0.3 倍伤害）：它们转而攻击你并短暂发懵；你 4 秒内受到的伤害 −20%。'),
  T('retort', 'warrior', SE, ['bastion'], 'Retort', '盾反', 'A blow you block strikes back at the one who struck, for half its weight.', '格挡下的攻击会以一半的力道回敬给攻击者。'),
  T('unyielding', 'warrior', SE, ['challenge'], 'Unyielding', '不屈', 'At a third of your health or less: combat damage taken −25%.', '生命不高于三分之一时，受到的战斗伤害 −25%。', { passive: { when: { wounded: 0.34 }, taken: -0.25 } }),
  A('aegis', 'warrior', SE, ['retort', 'unyielding'], { kind: 'buff', cooldown: 400, ticks: 60, buff: { cap: 1 } }, 'Aegis', '神盾', 'For 6 s no blow takes more than 1 health from you.', '6 秒内每次攻击至多让你损失 1 点生命。', 2),

  T('blood-fury', 'warrior', BE, [], 'Blood Fury', '血怒', 'With your sword: the more you are hurt, the harder you strike, up to +30% at the last of your health.', '持剑时，受伤越重攻击越狠：生命将尽时伤害最多 +30%。'),
  A('blood-rage', 'warrior', BE, ['blood-fury'], { kind: 'buff', cooldown: 300, ticks: 60, cost: 0.15, buff: { damage: 0.4, attackHaste: 0.2, drain: 2 } }, 'Blood Rage', '血之狂暴', 'Pay 15% of your health: for 6 s damage +40%, attack speed +20%, and each blow draws back 2.', '付出 15% 生命：6 秒内伤害 +40%，攻击速度 +20%，每次命中吸取 2 点生命。'),
  A('reaving-spin', 'warrior', BE, ['blood-fury'], { kind: 'whirlwind', cooldown: 100, power: 1.4 }, 'Reaving Spin', '掠夺回旋', 'Spin: strike every foe round you (×1.4).', '原地回旋，攻击周围所有敌人（1.4 倍伤害）。'),
  T('carnage', 'warrior', BE, ['blood-rage'], 'Carnage', '杀戮', 'Whenever you fell a creature: mend 4% of your max health.', '每击倒一个生物，恢复 4% 生命上限的生命。'),
  T('pain-eater', 'warrior', BE, ['reaving-spin'], 'Pain Eater', '噬痛', 'Below half health: each blow draws back 1 more.', '生命低于一半时，每次命中额外吸取 1 点生命。', { passive: { when: { wounded: 0.5 }, drain: 1 } }),
  A('leap-of-ruin', 'warrior', BE, ['carnage', 'pain-eater'], { kind: 'leap', cooldown: 300, power: 2.2, range: 5, afflict: 'stunned', ticks: 10 }, 'Leap of Ruin', '毁灭跃击', 'Leap up to 5 cells at the foe ahead and slam the 3×3 where you land (×2.2), stunning them 1 s.', '向前方的敌人跃出最多 5 格，重击落点周围 3×3（2.2 倍伤害）并眩晕 1 秒。', 2),

  T('thorned-mail', 'warrior', TK, [], 'Thorned Mail', '荆甲', 'Whoever strikes you hand to hand is pricked for 2.', '近身击中你的敌人会被荆棘刺伤 2 点。'),
  A('kneel', 'warrior', TK, ['thorned-mail'], { kind: 'nova', cooldown: 160, power: 0.6, range: 2, afflict: 'knelt', ticks: 15 }, 'Kneel', '屈膝令', 'Every foe within 2 cells is struck (×0.6) and kneels for 1.5 s.', '周围 2 格内的敌人受到攻击（0.6 倍伤害）并跪地 1.5 秒。'),
  A('briar-line', 'warrior', TK, ['thorned-mail'], { kind: 'field', leaves: HAZARDS.briars, pattern: 'line', range: 4, cooldown: 180 }, 'Briar Line', '荆棘线', 'Grow briars down the 4 cells ahead for 6 s: a foe who walks into them kneels.', '在前方 4 格长出荆棘，持续 6 秒：走进去的敌人会跪地。'),
  T('crowns-due', 'warrior', TK, ['kneel'], "Crown's Due", '冠之偿', 'Damage +30% against the kneeling and the stunned.', '对跪地或眩晕中的敌人伤害 +30%。', { passive: { when: { target: { status: ['knelt', 'stunned'] } }, damage: 0.3 } }),
  T('hold-the-line', 'warrior', TK, ['briar-line'], 'Hold the Line', '坚守阵线', 'Standing your ground (no step this second): combat damage taken −20%.', '站定不动满 1 秒时，受到的战斗伤害 −20%。', { passive: { when: { standing: true }, taken: -0.2 } }),
  A('crown-of-thorns', 'warrior', TK, ['crowns-due', 'hold-the-line'], { kind: 'field', leaves: HAZARDS.briars, pattern: 'ring', cooldown: 360, ticks: 60, buff: { taken: -0.3 } }, 'Crown of Thorns', '荆冠', 'Briars spring up in a ring round you; for 6 s you take 30% less.', '你周围长出一圈荆棘；6 秒内你受到的伤害 −30%。', 2),

  T('iron-body', 'warrior', MS, [], 'Iron Body', '铁躯', 'Max health +20.', '生命上限 +20。', { grant: { maxHp: 20 } }),
  A('unbreakable-will', 'warrior', MS, ['iron-body'], { kind: 'buff', cooldown: 300, ticks: 50, buff: { taken: -0.4 } }, 'Unbreakable Will', '不灭意志', 'For 5 s nothing holds you still (no stun, freeze or kneeling) and you take 40% less.', '5 秒内不受眩晕、冰冻、跪地等控制，受到的伤害 −40%。'),
  T('weapon-master', 'warrior', MS, ['iron-body'], 'Weapon Master', '兵器大师', 'Attack +3.', '攻击 +3。', { grant: { atk: 3 } }),
  A('godslayer', 'warrior', MS, ['unbreakable-will', 'weapon-master'], { kind: 'arc', cooldown: 360, power: 5 }, 'Godslayer', '弑神斩', 'One blow across the three cells ahead (×5).', '一刀横扫前方三格（5 倍伤害）。', 2),
  T('living-legend', 'warrior', MS, ['godslayer'], 'Living Legend', '传奇不朽', 'Once a minute, a blow that would fell you leaves you three tenths of your health.', '每分钟一次：本会让你倒下的一击，会让你保留三成生命。', { cost: 2 }),

  A('hamstring', 'warrior', {}, ['warrior-arms'], { kind: 'bash', cooldown: 100, power: 1.2, afflict: 'mired', ticks: 30 }, 'Hamstring', '断筋', 'Cut the foe ahead low (×1.2): it is mired for 3 s.', '砍向前方敌人的腿（1.2 倍伤害）：使其陷足 3 秒。'),
  A('sunder', 'warrior', {}, ['retaliation'], { kind: 'mark', cooldown: 140, power: 1.5, range: 1, ticks: 50, buff: { damage: 0.2 } }, 'Sunder', '破甲', 'Strike the foe ahead (×1.5): for 5 s it takes 20% more from you.', '攻击前方的敌人（1.5 倍伤害）：5 秒内它受到你的伤害 +20%。'),
  T('battle-hardened', 'warrior', {}, ['bulwark'], 'Battle Hardened', '百战', 'Combat damage taken −8%.', '受到的战斗伤害 −8%。', { passive: { taken: -0.08 } }),
  T('sword-mastery', 'warrior', {}, ['warrior-arms'], 'Sword Mastery', '剑术精通', 'With your sword: critical chance +5%.', '持剑时暴击率 +5%。', { passive: { when: OWN, crit: 0.05 } }),
]

// --- the ranger
const SH = { path: 'sharpshooter' }
const TR = { path: 'trapper' }
const BM = { path: 'beastmaster' }
const RANGER: SkillDef[] = [
  T('eagle-eye', 'ranger', SH, [], 'Eagle Eye', '鹰目', 'With a bow: critical chance +5%, damage +10%.', '持弓时暴击率 +5%，伤害 +10%。', { passive: { when: OWN, crit: 0.05, damage: 0.1 } }),
  A('deadeye', 'ranger', SH, ['eagle-eye'], { kind: 'shot', missile: 'arrow', cooldown: 160, power: 3.5, range: 7 }, 'Deadeye', '致命一击', 'One arrow, drawn to the ear, at the first foe ahead within 7 cells (×3.5).', '满弓一箭，射向 7 格内的第一个敌人（3.5 倍伤害）。'),
  A('ricochet', 'ranger', SH, ['eagle-eye'], { kind: 'chain', cooldown: 100, power: 1.1, range: 6, count: 3 }, 'Ricochet', '跳弹', 'An arrow that strikes the first foe ahead and leaps on to 2 more nearby (×1.1 each).', '一箭射中前方第一个敌人，再弹向附近的另外 2 个（每次 1.1 倍伤害）。'),
  T('weak-point', 'ranger', SH, ['deadeye'], 'Weak Point', '弱点', 'With a bow, against a foe below half health: critical chance +15%.', '持弓攻击生命低于一半的敌人时，暴击率 +15%。', { passive: { when: { ...OWN, target: { wounded: 0.5 } }, crit: 0.15 } }),
  T('patience', 'ranger', SH, ['ricochet'], 'Patience', '耐心', 'With a bow: each second you stand still, +10% damage, up to +40%.', '持弓时，每站定 1 秒伤害 +10%，最多 +40%。'),
  A('heartseeker', 'ranger', SH, ['weak-point', 'patience'], { kind: 'pierce', cooldown: 320, power: 3, range: 8, sure: true }, 'Heartseeker', '穿心箭', 'An arrow through every foe in its line, up to 8 cells (×3), each a sure critical.', '一箭贯穿 8 格内直线上的所有敌人（3 倍伤害），必定暴击。', 2),

  T('lay-of-the-land', 'ranger', TR, [], 'Lay of the Land', '熟知地形', 'Movement speed +8%, dodge +4%.', '移动速度 +8%，闪避 +4%。', { passive: { moveHaste: 0.08, dodge: 0.04 } }),
  A('snare-trap', 'ranger', TR, ['lay-of-the-land'], { kind: 'field', leaves: HAZARDS.snare, pattern: 'cell', cooldown: 120 }, 'Snare Trap', '绊索', 'Lay a snare on the cell ahead: the first foe to step on it is held for 3 s.', '在前方一格布下绊索：第一个踩上去的敌人被缠住 3 秒。'),
  A('spike-trap', 'ranger', TR, ['lay-of-the-land'], { kind: 'field', leaves: HAZARDS.spikes, pattern: 'line', range: 3, cooldown: 160 }, 'Spike Trap', '尖刺陷阱', 'Lay spikes down the 3 cells ahead for 20 s: foes crossing them bleed and are mired.', '在前方 3 格布下尖刺，持续 20 秒：经过的敌人流血并陷足。'),
  T('ambusher', 'ranger', TR, ['snare-trap'], 'Ambusher', '伏击者', 'Damage +40% against the held, the mired and the stunned.', '对被缠住、陷足或眩晕的敌人伤害 +40%。', { passive: { when: { target: { status: ['webbed', 'mired', 'stunned'] } }, damage: 0.4 } }),
  T('tripwire', 'ranger', TR, ['spike-trap'], 'Tripwire', '绊线', 'Against the held: critical chance +25%.', '攻击被缠住的敌人时，暴击率 +25%。', { passive: { when: { target: { status: ['webbed'] } }, crit: 0.25 } }),
  A('killing-field', 'ranger', TR, ['ambusher', 'tripwire'], { kind: 'field', leaves: HAZARDS.blast, pattern: 'ring', cooldown: 340 }, 'Killing Field', '杀戮场', 'Lay blast traps in a ring round you: each bursts under the foe that steps on it (fire).', '在你周围布下一圈爆炸陷阱：敌人踩上去就会爆炸（火焰）。', 2),

  T('pack-bond', 'ranger', BM, [], 'Pack Bond', '兽群羁绊', 'A beast you call has half again its health and strikes 30% harder.', '你召唤的野兽生命 +50%，伤害 +30%。'),
  A('call-the-hound', 'ranger', BM, ['pack-bond'], { kind: 'summon', creature: SUMMONS.hound, cooldown: 450, count: 1 }, 'Call the Hound', '唤犬', 'A hound comes to your whistle and fights at your side for 40 s.', '一只猎犬应哨而来，在你身边战斗 40 秒。'),
  A('sic', 'ranger', BM, ['pack-bond'], { kind: 'command', cooldown: 80, power: 2, range: 6, bleed: 40 }, 'Sic', '撕咬', 'Your beast leaps on the first foe ahead and bites (×2 of its own), and the foe bleeds.', '你的野兽扑向前方第一个敌人撕咬（其自身 2 倍伤害），并使敌人流血。'),
  T('feral-instinct', 'ranger', BM, ['call-the-hound'], 'Feral Instinct', '野性本能', 'With a companion near: dodge +8%, attack speed +8%.', '有同伴在身边时：闪避 +8%，攻击速度 +8%。', { passive: { when: { companion: true }, dodge: 0.08, attackHaste: 0.08 } }),
  T('pack-hunter', 'ranger', BM, ['sic'], 'Pack Hunter', '群猎者', 'With a companion near: damage +15%.', '有同伴在身边时，伤害 +15%。', { passive: { when: { companion: true }, damage: 0.15 } }),
  A('the-pack', 'ranger', BM, ['feral-instinct', 'pack-hunter'], { kind: 'summon', creature: SUMMONS.wolf, cooldown: 500, count: 3 }, 'The Pack', '狼群', 'Three wolves answer your howl and fight at your side for 20 s.', '三只狼应你的长嚎而来，在你身边战斗 20 秒。', 2),

  T('hawks-patience', 'ranger', MS, [], "Hawk's Patience", '鹰之耐心', 'With a bow: critical chance +10%.', '持弓时暴击率 +10%。', { passive: { when: OWN, crit: 0.1 } }),
  A('wind-arrow', 'ranger', MS, ['hawks-patience'], { kind: 'pierce', cooldown: 120, power: 1.5, range: 7, afflict: 'stunned', ticks: 5 }, 'Wind Arrow', '风之矢', 'An arrow through every foe in its line (×1.5) that staggers them.', '一箭贯穿直线上的所有敌人（1.5 倍伤害），使其踉跄。'),
  T('fletcher', 'ranger', MS, ['hawks-patience'], 'Fletcher', '制箭师', 'Multishot: 1 more arrow.', '多重箭：箭数 +1。', { modifies: { skill: 'multishot', count: 1 } }),
  A('thousand-arrows', 'ranger', MS, ['wind-arrow', 'fletcher'], { kind: 'rain', missile: 'arrow', cooldown: 360, power: 0.8, range: 6, count: 5, radius: 3 }, 'Thousand Arrows', '千矢之雨', 'Arrows fall on the 7×7 round the first foe ahead, once a second for 5 s (×0.8 each).', '在前方第一个敌人周围 7×7 范围落下箭雨，每秒一轮，持续 5 秒（每轮 0.8 倍伤害）。', 2),
  T('eagles-grace', 'ranger', MS, ['thousand-arrows'], "Eagle's Grace", '鹰之优雅', 'Dodge +10%, attack speed +10%.', '闪避 +10%，攻击速度 +10%。', { passive: { dodge: 0.1, attackHaste: 0.1 }, cost: 2 }),

  A('volley', 'ranger', {}, ['ranger-archery'], { kind: 'rain', missile: 'arrow', cooldown: 90, power: 1, range: 6, count: 1 }, 'Volley', '齐射', 'One volley on the 3×3 round the first foe ahead (×1.0).', '向前方第一个敌人周围 3×3 范围齐射一轮（1.0 倍伤害）。'),
  A('disengage', 'ranger', {}, ['fleet-archer'], { kind: 'leap-shot', cooldown: 140, power: 0.8, range: 6, count: 3, afflict: 'mired', ticks: 30 }, 'Disengage', '脱身', 'Leap 3 cells back and loose an arrow ahead (×0.8) that mires the foe it strikes.', '向后跃 3 格，同时向前射出一箭（0.8 倍伤害），使命中的敌人陷足。'),
  T('keen-arrows', 'ranger', {}, ['steady-aim'], 'Keen Arrows', '锐箭', 'With a bow: critical damage +15%.', '持弓时暴击伤害 +15%。', { passive: { when: OWN, critDamage: 0.15 } }),
  T('fleet-foot', 'ranger', {}, ['fleet-archer'], 'Fleet Foot', '疾足', 'Movement speed +5%, dodge +5%.', '移动速度 +5%，闪避 +5%。', { passive: { moveHaste: 0.05, dodge: 0.05 } }),
]

// --- the mage
const PY = { path: 'pyromancer' }
const CR = { path: 'cryomancer' }
const DB = { path: 'dawnbringer' }
const MAGE: SkillDef[] = [
  T('kindling', 'mage', PY, [], 'Kindling', '引燃', 'Your fire sets the struck burning one time in three.', '你的火焰有三分之一的几率点燃目标。'),
  A('flame-wall', 'mage', PY, ['kindling'], { kind: 'field', leaves: HAZARDS.flame, pattern: 'line', range: 5, cooldown: 180 }, 'Flame Wall', '火墙', 'Flames down the 5 cells ahead for 5 s: a foe who walks into them burns.', '在前方 5 格燃起火墙，持续 5 秒：走进去的敌人会着火。'),
  A('combustion', 'mage', PY, ['kindling'], { kind: 'detonate', status: 'burning', cooldown: 180, power: 2.5, range: 5 }, 'Combustion', '自燃', 'Every burning foe within 5 cells bursts (×2.5): the fire in it is spent.', '5 格内所有着火的敌人爆燃（2.5 倍伤害），身上的火就此烧尽。'),
  T('conflagration', 'mage', PY, ['flame-wall'], 'Conflagration', '燎原', 'Damage +25% against the burning.', '对着火的敌人伤害 +25%。', { passive: { when: { target: { status: ['burning'] } }, damage: 0.25 } }),
  T('ember-heart', 'mage', PY, ['combustion'], 'Ember Heart', '余烬之心', 'Fire skills rest 20% less.', '火焰技能冷却 −20%。'),
  A('inferno', 'mage', PY, ['conflagration', 'ember-heart'], { kind: 'rain', element: 'fire', cooldown: 360, power: 0.9, range: 5, count: 4, radius: 2 }, 'Inferno', '炼狱', 'Fire falls on the 5×5 round the first foe ahead, once a second for 4 s (×0.9 each).', '在前方第一个敌人周围 5×5 范围降下烈火，每秒一轮，持续 4 秒（每轮 0.9 倍伤害）。', 2),

  T('rime', 'mage', CR, [], 'Rime', '霜寒', 'Damage +30% against the frozen.', '对冰冻中的敌人伤害 +30%。', { passive: { when: { target: { status: ['frozen'] } }, damage: 0.3 } }),
  A('ice-lance', 'mage', CR, ['rime'], { kind: 'pierce', element: 'ice', cooldown: 110, power: 1.6, range: 6, afflict: 'frozen', ticks: 10, missile: 'ice' }, 'Ice Lance', '冰枪', 'A lance of ice through every foe in its line (×1.6), freezing each for 1 s.', '一道冰枪贯穿直线上的所有敌人（1.6 倍伤害），并各冻结 1 秒。'),
  A('glacial-prison', 'mage', CR, ['rime'], { kind: 'shot', element: 'ice', cooldown: 220, power: 0.5, range: 6, afflict: 'frozen', ticks: 40 }, 'Glacial Prison', '冰牢', 'Freeze the first foe ahead solid for 4 s (×0.5).', '将前方第一个敌人冻成冰块 4 秒（0.5 倍伤害）。'),
  T('shatter', 'mage', CR, ['ice-lance'], 'Shatter', '碎冰', 'A blow on the frozen breaks the ice and deals double.', '攻击冰冻中的敌人会打碎冰块，造成双倍伤害。'),
  T('frost-armour', 'mage', CR, ['glacial-prison'], 'Frost Armour', '霜甲', 'Whoever strikes you hand to hand is frozen a moment, one time in five.', '近身击中你的敌人有五分之一的几率被短暂冻结。'),
  A('blizzard', 'mage', CR, ['shatter', 'frost-armour'], { kind: 'rain', element: 'ice', pattern: 'around', cooldown: 380, power: 0.6, count: 5, radius: 2, afflict: 'frozen', ticks: 10 }, 'Blizzard', '暴风雪', 'Ice falls on the 5×5 round you, once a second for 5 s (×0.6 each), freezing.', '在你周围 5×5 范围降下冰雹，每秒一轮，持续 5 秒（每轮 0.6 倍伤害），并冻结敌人。', 2),

  T('dawnlight', 'mage', DB, [], 'Dawnlight', '晨辉', 'Damage +30% against the undead and the night\'s creatures.', '对亡灵和夜行生物伤害 +30%。', { passive: { when: { target: { tag: ['undead', 'nightborn'] } }, damage: 0.3 } }),
  A('sunburst', 'mage', DB, ['dawnlight'], { kind: 'nova', cooldown: 160, power: 1.4, range: 2, afflict: 'stunned', ticks: 10 }, 'Sunburst', '日耀', 'A burst of light round you: every foe within 2 cells is struck (×1.4) and dazzled for 1 s.', '以你为中心爆发光芒：周围 2 格内的敌人受到攻击（1.4 倍伤害）并目眩 1 秒。'),
  A('sanctuary', 'mage', DB, ['dawnlight'], { kind: 'field', leaves: HAZARDS.holy, pattern: 'around', cooldown: 300, ticks: 60, buff: { regen: 2, taken: -0.2 } }, 'Sanctuary', '圣域', 'Hallow the 3×3 round you for 6 s: you mend 2 a second and take 20% less.', '将你周围 3×3 化为圣域，持续 6 秒：你每秒恢复 2 点生命，受到的伤害 −20%。'),
  T('lantern-soul', 'mage', DB, ['sunburst'], 'Lantern Soul', '灯魂', 'At night: damage +10%, skills rest 15% less.', '入夜后：伤害 +10%，技能冷却 −15%。', { passive: { when: { night: true }, damage: 0.1, cdr: 0.15 } }),
  T('mercy-of-dawn', 'mage', DB, ['sanctuary'], 'Mercy of Dawn', '晨之怜悯', 'Mend heals 15% more of your max health.', '疗伤额外恢复 15% 生命上限的生命。', { modifies: { skill: 'mend', power: 0.15 } }),
  A('daybreak', 'mage', DB, ['lantern-soul', 'mercy-of-dawn'], { kind: 'shot', cooldown: 340, power: 4, range: 6 }, 'Daybreak', '破晓', 'A pillar of light on the first foe ahead (×4).', '一道光柱落在前方第一个敌人身上（4 倍伤害）。', 2),

  T('arcane-mastery', 'mage', MS, [], 'Arcane Mastery', '奥术精通', 'What carries an element strikes 20% harder (a staff with one, an element\'s spell).', '带元素的攻击伤害 +20%（带元素的法杖、元素法术）。'),
  A('time-warp', 'mage', MS, ['arcane-mastery'], { kind: 'rest', cooldown: 400, power: 0.5 }, 'Time Warp', '时间扭曲', 'Every other skill\'s rest is halved at once.', '其他所有技能的剩余冷却立即减半。'),
  T('mana-flow', 'mage', MS, ['arcane-mastery'], 'Mana Flow', '法力流转', 'Every skill\'s cooldown −10%.', '所有技能冷却 −10%。', { grant: { cdr: 0.1 } }),
  A('convergence', 'mage', MS, ['time-warp', 'mana-flow'], { kind: 'shot', cooldown: 360, power: 2, range: 6, count: 3, element: 'all' }, 'Convergence', '元素汇流', 'Fire, ice and lightning on the first foe ahead, one after another (×2 each).', '火、冰、雷依次落在前方第一个敌人身上（每次 2 倍伤害）。', 2),
  T('ascendance', 'mage', MS, ['convergence'], 'Ascendance', '飞升', 'Each skill you cast: +10% damage for 4 s, up to three times.', '每施放一个技能：4 秒内伤害 +10%，最多叠加三次。', { cost: 2 }),

  A('arcane-missiles', 'mage', {}, ['mage-focus'], { kind: 'shot', cooldown: 60, power: 0.6, range: 5, count: 3 }, 'Arcane Missiles', '奥术飞弹', 'Three bolts at the first foe ahead (×0.6 each).', '向前方第一个敌人连射三发飞弹（每发 0.6 倍伤害）。'),
  A('mana-ward', 'mage', {}, ['mana-shield'], { kind: 'ward', cooldown: 300, power: 0.3, ticks: 60 }, 'Mana Ward', '法力结界', 'A ward that takes the next 30% of your max health in harm before you do, for 6 s.', '一道结界，6 秒内替你承受至多 30% 生命上限的伤害。'),
  T('focus', 'mage', {}, ['mage-focus'], 'Focus', '凝神', 'Every skill\'s cooldown −5%.', '所有技能冷却 −5%。', { grant: { cdr: 0.05 } }),
  T('spell-power', 'mage', {}, ['elemental-attunement'], 'Spell Power', '法术强化', 'Active skills strike 10% harder.', '主动技能伤害 +10%。', { passive: { skillDamage: 0.1 } }),
]

// ------------------------------------------------------------------ the colours their effects are drawn in

/** Each path's colours (ActiveDef.look: the renderer's skill effects); the Necromancer's third its own hellfire. */
const PATH_LOOK: Record<string, string> = {
  necromancer: 'necro', shadowdancer: 'shadow', demonhunter: 'hex',
  sentinel: 'steel', berserker: 'blood', thornknight: 'thorn',
  sharpshooter: 'wind', trapper: 'earth', beastmaster: 'beast',
  pyromancer: 'fire', cryomancer: 'frost', dawnbringer: 'holy',
}
const MASTERY_LOOK: Record<string, string> = { assassin: 'shadow', warrior: 'war', ranger: 'wind', mage: 'arcane' }
/** A skill's own colours over its path's: the poison of a Necromancer, a mark's blood, an Aegis's light. */
const OWN_LOOK: Record<string, string> = {
  miasma: 'poison', 'toxic-burst': 'poison', pestilence: 'poison',
  'death-mark': 'blood', garrote: 'blood', caltrops: 'steel',
  aegis: 'holy', hamstring: 'blood', sunder: 'steel',
  'snare-trap': 'earth', 'spike-trap': 'earth', 'killing-field': 'fire',
  'mana-ward': 'arcane', 'arcane-missiles': 'arcane',
}
const looked = (s: SkillDef): SkillDef => {
  if (!s.active) return s
  const path = [s.path ?? []].flat()[0]
  const look = OWN_LOOK[s.id] ?? (s.tier === 3 ? (path === 'necromancer' ? 'hell' : MASTERY_LOOK[s.profession ?? '']) : path ? PATH_LOOK[path] : undefined)
  return look ? { ...s, active: { ...s.active, look } } : s
}

/** Every skill the advancements add (and the first trees' four more each). */
export const ADVANCEMENT_SKILLS: SkillDef[] = [...ASSASSIN, ...WARRIOR, ...RANGER, ...MAGE].map(looked)

// ------------------------------------------------------------------ the paths and masteries, as the trainer offers them

const path = (id: string, en: string, zh: string, docEn: string, docZh: string, third?: [string, string, string?, string?]): PathDef => ({
  id, name: L(en, zh), doc: L(docEn, docZh), icon: `path-${id}`,
  ...(third && { third: { name: L(third[0], third[1]), icon: `mastery-${id}`, ...(third[2] && { doc: L(third[2], third[3]!) }) } }),
})

export const PATHS: Record<string, PathDef[]> = {
  assassin: [
    path('necromancer', 'Necromancer', '死灵术士', 'The dead and the poison: you stand back while the dead you raise fight for you, every blow of theirs poisoned, the poisoned fallen made to burst.', '召唤与毒：自己站在后面，唤起亡者替你厮杀，亡者的每一击都带着尸毒，中毒的敌人倒下时尸体爆开。', ['Hell Sovereign', '地狱支配者', 'The Necromancer\'s own third: the dead stronger again, a guard of hell, a plague round you, the gate of the Styx.', '死灵术士自己的第三转：亡者更强，唤出冥狱守卫，降下瘟疫，打开冥河之门。']),
    path('shadowdancer', 'Shadowdancer', '影舞者', 'The veil and the back: gone into shadow, the blow from behind, criticals, and hard to strike.', '隐匿与背刺：遁入阴影，从背后出手，刀刀暴击，很难被打中。', ['Phantom', '幻影']),
    path('demonhunter', 'Demon Hunter', '猎魔人', 'The sigil and the hex: binding circles drawn on the ground, foes hexed and held, companions roused.', '法阵与咒印：在地上画下封魔阵，给敌人打上咒印、把它定在原地，鼓舞身边的同伴。', ['Ghostwail', '鬼泣']),
  ],
  warrior: [
    path('sentinel', 'Sentinel', '哨卫', 'The shield: blows turned aside and turned back, a wall that does not fall.', '盾：格开的攻击、回敬的攻击，一堵不倒的墙。'),
    path('berserker', 'Berserker', '狂战士', 'Fury and blood: the more hurt, the harder; health paid for strength.', '狂怒与鲜血：伤得越重，打得越狠；以生命换力量。'),
    path('thornknight', 'Thornknight', '荆棘骑士', 'The way of the Order of the Thorn: thorns that answer blows, foes brought to their knees.', '荆棘骑士团之道：以荆棘回敬攻击，令敌人屈膝。'),
  ],
  ranger: [
    path('sharpshooter', 'Sharpshooter', '神射手', 'The single shot: patience, the weak point, the arrow through the heart.', '致命一箭：耐心、弱点、穿心之矢。'),
    path('trapper', 'Trapper', '陷阱师', 'The snare and the spike: ground made deadly before the foe arrives.', '绊索与尖刺：在敌人来到之前，把地面变成杀场。'),
    path('beastmaster', 'Beastmaster', '驯兽师', 'The hound and the pack: beasts that come to the whistle and fight at your side.', '猎犬与狼群：闻哨而来、并肩作战的野兽。'),
  ],
  mage: [
    path('pyromancer', 'Pyromancer', '炎术师', 'Fire: walls of flame, the burning made to burst.', '火：火墙，让燃烧的敌人爆燃。'),
    path('cryomancer', 'Cryomancer', '霜术师', 'Ice: foes frozen, then shattered.', '冰：冻住敌人，再将其粉碎。'),
    path('dawnbringer', 'Dawnbringer', '晨光术士', 'The light against the Night: the undead burned, holy ground underfoot.', '对抗极夜的光：灼烧亡灵，脚下即是圣域。'),
  ],
}

export const MASTERIES: Record<string, { name: Text; doc: Text; icon: string }> = {
  // (its name is the path's: Hell Sovereign — the Necromancer's own skills —, Phantom, Ghostwail)
  assassin: { name: L('Third Advancement', '三转'), doc: L('The assassin\'s own third, the Shadowdancer\'s and the Demon Hunter\'s: the mark, the assassination, every fifth blow true.', '刺客的第三转，影舞者和猎魔人共用：印记、刺杀，每第五击必中。'), icon: 'mastery-assassin' },
  warrior: { name: L('Paragon', '典范'), doc: L('The warrior\'s own third: an iron body, an unbreakable will, the blow that slays gods.', '战士的第三转：铁躯、不灭意志、弑神一击。'), icon: 'mastery-warrior' },
  ranger: { name: L('Master Archer', '箭圣'), doc: L('The ranger\'s own third: the hawk\'s patience, the wind\'s arrow, a thousand arrows falling.', '游侠的第三转：鹰之耐心、风之矢、千矢之雨。'), icon: 'mastery-ranger' },
  mage: { name: L('Archmage', '大魔导'), doc: L('The mage\'s own third: time bent, the elements converging, power that climbs with every cast.', '法师的第三转：扭曲时间、元素汇流、随施法攀升的力量。'), icon: 'mastery-mage' },
}
