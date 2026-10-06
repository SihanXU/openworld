// The authored boss kits (docs/bosses.md): the White Knight Alberic (the First Seal-bearer, Chapter 1's
// boss), and three kept for later — the Crown Without a King, the Velvet Lure and the Face Thief. All
// but the Face Thief span tiles. None has a campaign place yet.
import type { BossDef, BossSkill, Effect, Entity, Pos, Rule, StatusDef, Tree, TypeDef } from '@lsw/engine'
import { LEGENDARY_ARMS } from './items.ts'

const L = (en: string, zh: string) => ({ en, zh })
const skill = (sin: string, id: string, en: string, zh: string, shape: BossSkill['shape'], aim: BossSkill['aim'], radius: number, damage: number, windup: number, recovery: number, extra: Partial<BossSkill> = {}): BossSkill => ({
  id, name: L(en, zh), shape, aim, radius, damage, windup, recovery,
  fx: `sin:${sin}:${id}`, action: aim === 'self' ? 'attack' : 'cast', ...extra,
})

export const BOSSES: BossDef[] = [
  // the First Seal-bearer (docs/chapter-1.md §4, docs/lore.md §6): the crown has worn his self away; he holds
  // the far bank as his kingdom. The bow (his volleys and the arrow of conquest) and the sword plunged (thorns
  // that make the struck kneel). Overhead sprite rework: docs/alberic-art-v3-prompts.json.
  { id: 'alberic', name: L('The White Knight Alberic · First Seal', '白骑士·阿尔贝里克 · 第一印'), footprint: [3, 2], hp: 1200, defense: 2, sight: 12, leash: 12, color: 0xf2ead2, enrageAt: 0.5, skills: [
    skill('alberic', 'arrow', 'Arrow of Conquest', '征服之矢', 'line', 'self', 8, 30, 18, 14, { action: 'cast', fxPlacement: 'beam' }),
    skill('alberic', 'volley', 'White-Feather Volley', '白羽箭雨', 'spots', 'target', 4, 24, 20, 14),
    skill('alberic', 'thorns', 'Thorns Bend the Knee', '荆冠·屈膝', 'ring', 'self', 4, 34, 22, 14, { status: 'entranced', fxPlacement: 'pattern' }),
  ] },
  { id: 'lust', name: L('The Velvet Lure · Lust', '绯愿兰后 · 色欲'), footprint: [5, 3], hp: 1600, defense: 2, sight: 12, leash: 12, color: 0xe578a7, enrageAt: 0.5, skills: [
    skill('lust', 'petal', 'Velvet Crescent', '绯瓣弧斩', 'cone', 'self', 7, 30, 16, 10),
    skill('lust', 'lure', 'False Promise', '虚愿花印', 'spots', 'target', 4, 24, 18, 10, { shift: 'pull', status: 'entranced' }),
    skill('lust', 'thorns', 'Thorn Covenant', '荆棘誓约', 'cross', 'target', 6, 32, 20, 12, { status: 'mired' }),
  ] },
  { id: 'envy', name: L('The Face Thief · Envy', '窃面者 · 嫉妒'), footprint: [1, 1], hp: 1000, defense: 1, sight: 12, leash: 12, color: 0x56d7a0, enrageAt: 0.5, skills: [
    skill('envy', 'daggers', 'Borrowed Blades', '借影双刃', 'cone', 'self', 3, 24, 10, 8),
    skill('envy', 'mirror', 'Shattered Faces', '碎面镜雨', 'spots', 'target', 3, 20, 14, 10),
    skill('envy', 'blink', 'Stolen Footstep', '窃步瞬身', 'circle', 'target', 2, 24, 12, 8, { blink: true }),
  ] },
  { id: 'pride', name: L('The Crown Without a King · Pride', '无王之冠 · 傲慢'), footprint: [5, 4], hp: 2600, defense: 3, sight: 12, leash: 12, color: 0x9aafff, enrageAt: 0.5, skills: [
    skill('pride', 'wing', 'Royal Rebuff', '王翼斥退', 'cone', 'self', 7, 42, 18, 12, { shift: 'push' }),
    skill('pride', 'mirror', 'Perfect Reflection', '完美镜裁', 'cross', 'target', 7, 36, 22, 14),
    skill('pride', 'crown', 'Kneel Before the Crown', '万象俯首', 'ring', 'target', 5, 44, 24, 16),
  ] },
]
export const BOSS_BY_ID = Object.fromEntries(BOSSES.map((b) => [b.id, b]))
export const BOSS_TYPES: TypeDef[] = [
  { id: 'actor/creature/sin', name: L('Sin sovereign', '原罪领主'), tags: ['boss'], props: { range: 1 } },
  ...BOSSES.map((b): TypeDef => ({ id: `actor/creature/sin/${b.id}`, name: b.name, sprite: `boss:sin:${b.id}`, footprint: b.footprint,
    tags: b.id === 'envy' ? ['small'] : ['large'], props: { hp: b.hp, maxHp: b.hp, def: b.defense, atk: b.skills[0].damage, speed: 8 } })),
]
export const BOSS_STATUSES: StatusDef[] = [
  { id: 'mired', name: L('Mired', '迟滞'), duration: 25, moveDelay: 1.7 },
  { id: 'entranced', name: L('Entranced', '迷眩'), duration: 8, immobilize: true },
]

/** The fact a legendary's handing over sets: each exists once in a world. */
const legendFact = (type: string) => `legend.${type.split('/').pop()}`

/**
 * What a fallen sin leaves: its reward, and for whoever felled it the first of their profession's
 * legendary arms (LEGENDARY_ARMS) the world has not yet seen. No profession, or both seen: none.
 */
function sinReward(b: BossDef): Tree {
  const base: Effect[] = [
    { op: 'setProp', key: 'hp', value: 0 },
    { op: 'addStatus', status: 'down', duration: 20 },
    { op: 'emit', impulse: 'notify', to: 'story', params: { what: `sin.${b.id}` } },
    { op: 'emit', impulse: 'notify', to: 'actor', params: { what: 'defeat', xp: { prop: 'maxHp', of: 'host' } } },
    { op: 'dropContents', still: true },
    { op: 'spawn', type: 'item/material/iron_ore', at: 'host', count: 4 },
    { op: 'log', text: L('Defeated {host}.', '击败了{host}。') },
  ]
  const legend = (type: string): Effect[] => [
    ...base,
    { op: 'spawn', type, at: 'host' },
    { op: 'emit', impulse: 'notify', to: 'story', params: { what: legendFact(type) } },
    { op: 'log', text: L('A legendary weapon falls from {host}!', '{host}掉落了一件传说武器！') },
  ]
  return Object.entries(LEGENDARY_ARMS).reduceRight<Tree>((rest, [profession, arms]) => ({
    if: { is: { role: 'actor', sel: { props: { profession } } } },
    then: arms.reduceRight<Tree>((next, type) => ({ if: { prop: { role: 'story', key: legendFact(type), cmp: 0, default: 0 } }, then: { do: legend(type) }, else: next }), { do: base }),
    else: rest,
  }), { do: base })
}

/** Rewards happen once, then the death animation has two seconds before removal. */
export const BOSS_RULES: Rule[] = [
  // a sin at no health goes down for two seconds (its death), leaves its reward, and tells the story
  ...BOSSES.map((b): Rule => ({
    id: `sins/${b.id}-defeated`,
    source: { origin: 'base', note: 'story' },
    host: { type: `actor/creature/sin/${b.id}`, notStatus: ['down'] },
    on: 'threshold/cross',
    tree: { if: { param: { key: 'name', cmp: 'broken' } }, then: sinReward(b), else: 'inherit' },
  })),
  { id: 'sins/death-fades', source: { origin: 'base' }, host: { type: 'actor/creature/sin' }, on: 'time/timer', tree: { if: { param: { key: 'status', cmp: 'down' } }, then: { do: [{ op: 'destroy' }] }, else: 'inherit' } },
  {
    id: 'sins/release',
    source: { origin: 'base' },
    doc: 'A sin\'s telegraphed skill, released (its act with its own body): it lands on the cells it marked.',
    host: { type: 'actor/creature/sin' },
    on: 'act/use',
    tree: { if: { param: { key: 'skill', cmp: { gte: 0 } } }, then: { do: [{ op: 'release' }] }, else: 'inherit' },
  },
  {
    id: 'sins/afflict',
    source: { origin: 'base' },
    doc: 'What a sin\'s skill leaves clinging to a body: a mire that slows it, a trance that holds it.',
    host: { type: 'actor' },
    on: 'impulse/coat',
    tree: {
      if: { param: { key: 'substance', cmp: 'mired' } },
      then: { do: [{ op: 'addStatus', status: 'mired' }] },
      else: { if: { param: { key: 'substance', cmp: 'entranced' } }, then: { do: [{ op: 'addStatus', status: 'entranced' }] }, else: 'inherit' },
    },
  },
  {
    id: 'sins/story',
    source: { origin: 'base', note: 'story' },
    doc: 'The story keeps which sins have fallen, and which legendary arms they have left.',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: [
      ...BOSSES.map((b) => [`sin.${b.id}`, `sins.defeated.${b.id}`]),
      ...Object.values(LEGENDARY_ARMS).flat().map((type) => [legendFact(type), legendFact(type)]),
    ].reduceRight<Rule['tree']>((rest, [what, key]) => ({ if: { param: { key: 'what', cmp: what } }, then: { do: [{ op: 'setProp', key, value: 1 }] }, else: rest }), 'inherit'),
  },
]

/** Where the Boss Studio and the challenge stage a fight: the East Road's clearing (no campaign boss stands there). */
export const BOSS_ARENA = { map: 'eastroad', x: 23, y: 15, id: 'arena.boss' } as const
/** Saves marked with it no longer hold the removed kits' bodies (migrateBosses.ts). */
export const BOSS_LAYOUT = 'content.bosses-v3'
/** The kits that were removed (2026-10-04); an older save's bodies of these are cleared on loading. */
export const REMOVED_BOSSES = ['greed', 'gluttony', 'sloth', 'wrath']
export function createBoss(id: string, at: Pos, entityId = `sin.${id}`): Entity {
  const b = BOSS_BY_ID[id]
  if (!b) throw new Error(`Unknown boss kit: ${id}`)
  return { id: entityId, type: `actor/creature/sin/${id}`, name: b.name, place: { on: 'tile', ...at }, facing: 'down', boss: { kit: id, phase: 1, action: 'idle' },
    ai: { behaviour: 'melee', temper: 'aggressive', home: { ...at }, sight: b.sight, leash: b.leash } }
}
