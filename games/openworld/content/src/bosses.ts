// The boss fights (docs/bosses.md, docs/skills.md): the White Knight Alberic (the First Seal-bearer, Chapter 1's boss),
// the dragon of Cinder Peak (the main quest's end), and three kept for later — the Crown Without a King, the Velvet Lure
// and the Face Thief. Each is a kit (its skills, the kits module's one definition) and an encounter (the phases that
// take them up in turn); what each skill does where it lands is the boss's own rule (`boss/<id>`). The minor monsters'
// kits are kits.ts; what both share (the helpers, the colours, what clings) is afflictions.ts.
import type { Effect, EncounterDef, Entity, KitSkill, Pos, Rule, Text, Tree, TypeDef } from '@openworld/engine'
import { CALL, CLING, DO, HARM, POWER, kitRule, skill, unleash } from './afflictions.ts'
import { LEGENDARY_ARMS } from './items.ts'

const L = (en: string, zh: string) => ({ en, zh })
const rule = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base' } })

/** A boss as the Boss Studio and the challenge pick it: its type, its body there, its kit and its fight. */
export interface BossDef {
  id: string
  /** Its type (a sin's is `actor/creature/sin/<id>`): its kit and its encounter are the type's. */
  type: string
  name: Text
  footprint: [number, number]
  /** Its body in the Boss Studio and the challenge (a campaign's may be softer: the White Knight in Chapter 1). */
  hp: number
  defense: number
  atk: number
  skills: KitSkill[]
  encounter: EncounterDef
}

/** The briars the White Knight grows: a sprout withers in a while; the hedge he closes round his field lasts longer. */
export const SPROUT = 'fixture/nature/briar/sprout'
export const HEDGE = 'fixture/nature/briar/sprout/hedge'
/** What the dragon's fire leaves on the ground: embers that burn what steps on them, and die down. */
export const EMBERS = 'fixture/hazard/embers'

// ------------------------------------------------------------------ the White Knight

// The First Seal-bearer (docs/chapter-1.md §4, docs/lore.md §4, §6): the crown has worn his self away until all he
// remembers is to hold. His bow (the arrow of conquest, the volley), his sword plunged (thorns that make the struck
// kneel), and the briars of his kingdom: none cross that do not kneel. At half health he plants the sword and holds.
const ALBERIC = 'actor/creature/sin/alberic'
const IVORY = 0xf2ead2
const fxA = (id: string) => `sin:alberic:${id}`
const ARROW = { shape: 'line', aim: 'target', radius: 8, width: 3, action: 'cast', clip: 'arrow', fx: fxA('arrow'), fxPlacement: 'beam', color: IVORY } as const
const THORNS = { shape: 'ring', aim: 'self', action: 'attack', clip: 'thorns', fx: fxA('thorns'), fxPlacement: 'pattern', color: CLING } as const
const ALBERIC_SKILLS: KitSkill[] = [
  skill('arrow', 'Arrow of Conquest', '征服之矢', { ...ARROW, windup: 16, recovery: 12 }),
  skill('arrow_twice', 'Arrow of Conquest', '征服之矢', { ...ARROW, windup: 16, recovery: 0, then: 'arrow_again' }),
  skill('arrow_again', 'Arrow of Conquest, Again', '征服之矢·再', { ...ARROW, windup: 8, recovery: 12 }),
  skill('volley', 'White-Feather Volley', '白羽箭雨', { shape: 'spots', aim: 'target', radius: 4, windup: 18, recovery: 12, action: 'cast', clip: 'volley', fx: fxA('volley'), color: IVORY }),
  skill('thorns', 'Thorns Bend the Knee', '荆冠·屈膝', { ...THORNS, radius: 4, windup: 20, recovery: 14 }),
  skill('thorns_in', 'Thorns Bend the Knee', '荆冠·屈膝', { ...THORNS, radius: 2, windup: 16, recovery: 0, then: 'thorns_out' }),
  skill('thorns_out', 'The Second Ring', '荆冠·外环', { ...THORNS, radius: 5, windup: 8, recovery: 14 }),
  skill('toll', 'None Cross Unkneeling', '过者皆跪', { shape: 'line', aim: 'target', radius: 12, windup: 14, recovery: 10, action: 'attack', clip: 'thorns', fx: fxA('thorns'), fxPlacement: 'pattern', color: CLING }),
  skill('hilt', 'Hilt Rebuff', '剑柄斥退', { shape: 'cone', aim: 'self', radius: 3, range: [1, 2], cooldown: 60, windup: 8, recovery: 8, action: 'attack', clip: 'thorns', fx: 'dust', fxPlacement: 'pattern', color: HARM }),
  skill('hold', 'Hold.', '守住。', { ...THORNS, radius: 6, windup: 24, recovery: 10, steady: true, color: CALL }),
]
const ALBERIC_FIGHT: EncounterDef = {
  sight: 12, leash: 12, plate: { color: IVORY, seal: 1 }, reactive: ['hilt'],
  phases: [
    { at: 1, rotation: ['arrow', 'volley', 'thorns', 'arrow', 'toll'] },
    { at: 0.5, enter: 'hold', rotation: ['arrow_twice', 'volley', 'toll', 'thorns_in'], windupMul: 0.85, recoveryMul: 0.7, powerMul: 1.25 },
  ],
}
const PIERCE = (mul: number) => DO(unleash({ power: POWER(mul), edge: 'pierce' }))
const KNEEL = DO(unleash({ power: POWER(1.3), edge: 'cut', coat: 'knelt' }))
const ALBERIC_RULES = kitRule('boss/alberic', ALBERIC, 'The White Knight\'s skills: his arrows and his volley pierce; his thorns cut and make the struck kneel; the line of briars he grows makes those on it kneel and stays a while, and so does the hedge he closes round himself when he holds; his hilt drives back one who stands too close.', [
  ['arrow', PIERCE(1.2)],
  ['arrow_twice', PIERCE(1.2)],
  ['arrow_again', PIERCE(1)],
  ['volley', PIERCE(1)],
  ['thorns', KNEEL],
  ['thorns_in', KNEEL],
  ['thorns_out', KNEEL],
  ['toll', DO(unleash({ power: POWER(0.6), edge: 'cut', coat: 'knelt', leave: SPROUT }))],
  ['hilt', DO(unleash({ power: POWER(0.8), edge: 'blunt', push: 2 }))],
  ['hold', DO(unleash({ leave: HEDGE }), { op: 'say', text: L('Hold.', '守住。') })],
])

// ------------------------------------------------------------------ the dragon of Cinder Peak

// The main quest's end (docs/main-quest.md): fire that stays on the ground, a serpent's body, a dive, a brood. The lair's
// four rock pillars shelter from its breath and stop its dive (a dash into a wall stuns the dasher, as a boar's does).
const DRAGON = 'actor/creature/dragon'
const BREATH = { shape: 'cone', aim: 'self', radius: 5, occlude: true, action: 'cast', fx: 'fire_burst', fxPlacement: 'pattern', color: HARM } as const
const BOLT = { shape: 'circle', aim: 'target', radius: 1, action: 'cast', fx: 'explosion', fxPlacement: 'pattern', color: HARM } as const
const ASH = { shape: 'spots', aim: 'target', radius: 4, spot: 1, steady: true, action: 'cast', fx: 'explosion', fxPlacement: 'pattern', color: HARM } as const
const DRAGON_SKILLS: KitSkill[] = [
  skill('breath', 'Cinder Breath', '烬息', { ...BREATH, windup: 14, recovery: 12 }),
  skill('breath_twice', 'Cinder Breath', '烬息', { ...BREATH, windup: 14, recovery: 0, then: 'breath_again' }),
  skill('breath_again', 'Cinder Breath, Again', '烬息·回扫', { ...BREATH, windup: 8, recovery: 12 }),
  skill('bolts', 'Threefold Fire', '火弹三连', { ...BOLT, windup: 10, recovery: 0, then: 'bolt_two' }),
  skill('bolt_two', 'Threefold Fire', '火弹三连', { ...BOLT, windup: 6, recovery: 0, then: 'bolt_three' }),
  skill('bolt_three', 'Threefold Fire', '火弹三连', { ...BOLT, windup: 6, recovery: 10 }),
  skill('tail', 'Tail Sweep', '甩尾', { shape: 'circle', aim: 'self', radius: 2, range: [1, 2], cooldown: 60, windup: 9, recovery: 8, action: 'attack', fx: 'dust', fxPlacement: 'pattern', color: HARM }),
  skill('bite', 'Bite', '撕咬', { shape: 'cone', aim: 'self', radius: 1, range: [1, 1], aligned: true, cooldown: 40, windup: 7, recovery: 8, action: 'attack', fx: 'hit', color: HARM }),
  skill('brood', 'Call the Brood', '唤雏', { shape: 'circle', aim: 'self', radius: 0, windup: 15, recovery: 10, steady: true, action: 'cast', color: CALL }),
  skill('dive', 'Searing Dive', '焚翼俯冲', { shape: 'line', aim: 'target', radius: 10, width: 3, move: 'dash', windup: 18, recovery: 16, action: 'attack', fx: 'fire_burst', fxPlacement: 'pattern', color: HARM }),
  skill('ashfall', 'Ashfall', '烬落', { ...ASH, windup: 16, recovery: 0, then: 'ashfall_again' }),
  skill('ashfall_again', 'Ashfall', '烬落', { ...ASH, windup: 10, recovery: 12 }),
]
const DRAGON_FIGHT: EncounterDef = {
  sight: 10, leash: 12, plate: { color: 0xff7a2a }, reactive: ['tail', 'bite'],
  phases: [
    { at: 1, rotation: ['breath', 'bolts', 'breath', 'bolts'] },
    { at: 0.5, enter: 'brood', rotation: ['dive', 'breath', 'bolts', 'dive'], windupMul: 0.9 },
    { at: 0.25, enter: 'ashfall', rotation: ['dive', 'breath_twice', 'bolts'], windupMul: 0.8, powerMul: 1.2 },
  ],
}
/** Its brood comes once in a world (the main quest's fact `mq.whelps`): a save whose whelps came before keeps them gone. */
const BROOD: Tree = {
  if: { prop: { role: 'story', key: 'mq.whelps', cmp: 0, default: 0 } },
  then: DO(
    { op: 'spawn', type: 'actor/creature/whelp', at: 'host', count: 3 },
    { op: 'emit', impulse: 'notify', to: 'story', params: { what: 'whelps' } },
    { op: 'vfx', fx: 'fire_burst' },
    { op: 'log', text: L('The dragon shrieks. Its whelps pour out of the dark!', '魔龙一声尖啸，幼龙从黑暗里涌了出来！') },
  ),
  else: DO({ op: 'vfx', fx: 'fire_burst' }),
}
const FIRE = (mul: number, extra: Partial<Extract<Effect, { op: 'unleash' }>> = {}) => DO(unleash({ power: POWER(mul), element: 'fire', edge: 'magic', ...extra }))
const BURNS = { leave: EMBERS, leaveStatus: 'burning' }
const DRAGON_RULES = kitRule('boss/dragon', DRAGON, 'The dragon\'s skills: its breath burns the cone it sees and leaves embers; three bolts of fire, each where its foe stands then; a dive down the row that leaves embers behind; its tail drives back those beside it, its bite tears those before it; at half health it calls its brood (once), at a quarter the ash falls in two waves.', [
  ['breath', FIRE(1.4, BURNS)],
  ['breath_twice', FIRE(1.4, BURNS)],
  ['breath_again', FIRE(1.4, BURNS)],
  ['bolts', FIRE(0.9)],
  ['bolt_two', FIRE(0.9)],
  ['bolt_three', FIRE(0.9)],
  ['tail', DO(unleash({ power: POWER(1), edge: 'blunt', push: 2 }))],
  ['bite', DO(unleash({ power: POWER(1.5), edge: 'pierce' }))],
  ['brood', BROOD],
  ['dive', DO(unleash({ power: POWER(1.6), element: 'fire', edge: 'blunt', push: 1, ...BURNS }))],
  ['ashfall', FIRE(1)],
  ['ashfall_again', FIRE(1)],
])

// ------------------------------------------------------------------ the three kept for later (unchanged)

// The Velvet Lure, the Face Thief and the Crown Without a King: no campaign place yet; in the Boss Studio and the
// challenge only. Their numbers are as they were: each blow its `damage` (a multiple of an attack of 24), phase II at half
// health.
const SIN_ATK = 24
type Landing = Partial<Extract<Effect, { op: 'unleash' }>>
const sinSkill = (sin: string, id: string, en: string, zh: string, shape: KitSkill['shape'], aim: KitSkill['aim'], radius: number, windup: number, recovery: number, extra: Partial<KitSkill> = {}): KitSkill =>
  skill(id, en, zh, { shape, aim, radius, windup, recovery, fx: `sin:${sin}:${id}`, action: aim === 'self' ? 'attack' : 'cast', ...extra })
/** A sin's kit as it was: its skills in turn, each landing `damage` (and a pull, a push, what clings, a blink). */
function sin(id: string, name: { en: string; zh: string }, footprint: [number, number], hp: number, defense: number, color: number, kit: [KitSkill, number, Landing?][]): { def: BossDef; rules: Rule[] } {
  const rotation = kit.map(([s]) => s.id)
  const type = `actor/creature/sin/${id}`
  return {
    def: { id, type, name, footprint, hp, defense, atk: SIN_ATK, skills: kit.map(([s]) => s),
      encounter: { sight: 12, leash: 12, plate: { color }, phases: [{ at: 1, rotation }, { at: 0.5, rotation, windupMul: 0.8, recoveryMul: 0.65, powerMul: 1.35 }] } },
    rules: kitRule(`boss/${id}`, type, `${name.en}'s skills, as they were: each blow in turn, with what it pulls, pushes or leaves clinging.`,
      kit.map(([s, damage, extra]): [string, Tree] => [s.id, DO(unleash({ power: POWER(damage / SIN_ATK), edge: 'blunt', ...extra }))])),
  }
}
const SINS = [
  sin('lust', L('The Velvet Lure · Lust', '绯愿兰后 · 色欲'), [5, 3], 1600, 2, 0xe578a7, [
    [sinSkill('lust', 'petal', 'Velvet Crescent', '绯瓣弧斩', 'cone', 'self', 7, 16, 10), 30],
    [sinSkill('lust', 'lure', 'False Promise', '虚愿花印', 'spots', 'target', 4, 18, 10), 24, { pull: 1, coat: 'entranced' }],
    [sinSkill('lust', 'thorns', 'Thorn Covenant', '荆棘誓约', 'cross', 'target', 6, 20, 12), 32, { coat: 'mired' }],
  ]),
  sin('envy', L('The Face Thief · Envy', '窃面者 · 嫉妒'), [1, 1], 1000, 1, 0x56d7a0, [
    [sinSkill('envy', 'daggers', 'Borrowed Blades', '借影双刃', 'cone', 'self', 3, 10, 8), 24],
    [sinSkill('envy', 'mirror', 'Shattered Faces', '碎面镜雨', 'spots', 'target', 3, 14, 10), 20],
    [sinSkill('envy', 'blink', 'Stolen Footstep', '窃步瞬身', 'circle', 'target', 1, 12, 8, { move: 'blink' }), 24],
  ]),
  sin('pride', L('The Crown Without a King · Pride', '无王之冠 · 傲慢'), [5, 4], 2600, 3, 0x9aafff, [
    [sinSkill('pride', 'wing', 'Royal Rebuff', '王翼斥退', 'cone', 'self', 7, 18, 12), 42, { push: 1 }],
    [sinSkill('pride', 'mirror', 'Perfect Reflection', '完美镜裁', 'cross', 'target', 7, 22, 14), 36],
    [sinSkill('pride', 'crown', 'Kneel Before the Crown', '万象俯首', 'ring', 'target', 5, 24, 16), 44],
  ]),
]

// ------------------------------------------------------------------ the roster

export const BOSSES: BossDef[] = [
  { id: 'alberic', type: ALBERIC, name: L('The White Knight Alberic · First Seal', '白骑士·阿尔贝里克 · 第一印'), footprint: [3, 2], hp: 1200, defense: 2, atk: 24, skills: ALBERIC_SKILLS, encounter: ALBERIC_FIGHT },
  { id: 'dragon', type: DRAGON, name: L('The Dragon of Cinder Peak', '烬峰魔龙'), footprint: [2, 2], hp: 1600, defense: 3, atk: 22, skills: DRAGON_SKILLS, encounter: DRAGON_FIGHT },
  ...SINS.map((s) => s.def),
]
export const BOSS_BY_ID: Record<string, BossDef> = Object.fromEntries(BOSSES.map((b) => [b.id, b]))
/** The bosses' skills and fights, by type (the ontology's `kits` and `encounters`). */
export const BOSS_KITS: Record<string, KitSkill[]> = Object.fromEntries(BOSSES.map((b) => [b.type, b.skills]))
export const BOSS_ENCOUNTERS: Record<string, EncounterDef> = Object.fromEntries(BOSSES.map((b) => [b.type, b.encounter]))
const SIN_BOSSES = BOSSES.filter((b) => b.type.startsWith('actor/creature/sin/'))

export const BOSS_TYPES: TypeDef[] = [
  { id: 'actor/creature/sin', name: L('Sin sovereign', '原罪领主'), tags: ['boss'], props: { range: 1 } },
  ...SIN_BOSSES.map((b): TypeDef => ({ id: b.type, name: b.name, sprite: `boss:sin:${b.id}`, footprint: b.footprint,
    tags: b.footprint[0] * b.footprint[1] === 1 ? ['small'] : ['large'], props: { hp: b.hp, maxHp: b.hp, def: b.defense, atk: b.atk, speed: 8 } })),
  // the White Knight's briars, grown where he says (no wall: one wades through, and kneels); they wither in a while
  { id: SPROUT, name: L('briar sprout', '荆棘苗'), sprite: 'fixture:briar', solid: false, props: { maxHp: 2, hp: 2 }, makeup: [], stage: { lasts: 120 } },
  { id: HEDGE, name: L("the knight's hedge", '骑士的荆篱'), stage: { lasts: 600 } },
  // what the dragon's fire leaves on the ground: it burns what steps on it, and dies down
  { id: 'fixture/hazard', name: L('hazard', '险地'), tags: ['hazard'], solid: false },
  { id: EMBERS, name: L('embers', '余烬'), tags: ['hot'], sprite: 'fixture:embers', stage: { lasts: 45 } },
]

/** What the bosses' skills leave on the ground acts by its own rules: briars make those who wade in kneel; both briars and embers go in a while. */
const LEFT_RULES: Rule[] = [
  rule({
    id: 'boss/sprout-kneel',
    doc: 'None cross that do not kneel: one who steps into the White Knight\'s briars is cut and made to kneel (a flyer never touches them; a boss wades through its own).',
    host: { type: SPROUT },
    on: 'contact/begin',
    tree: {
      if: { all: [{ param: { key: 'how', cmp: 'under' } }, { is: { role: 'other', sel: { type: 'actor', notTags: ['boss'] } } }] },
      then: DO(
        { op: 'emit', impulse: 'strike', to: 'other', params: { power: 1, edge: 'cut' } },
        { op: 'emit', impulse: 'coat', to: 'other', params: { substance: 'knelt' } },
      ),
      else: 'inherit',
    },
  }),
  rule({
    id: 'boss/sprout-cut',
    doc: 'The White Knight\'s briars, cut or burnt through, are gone: nothing of them is left to gather.',
    host: { type: SPROUT },
    on: 'threshold/cross',
    tree: { if: { param: { key: 'name', cmp: 'broken' } }, then: DO({ op: 'vfx', fx: 'leaves', at: 'tileOf:host' }, { op: 'destroy' }), else: 'inherit' },
  }),
  rule({
    id: 'boss/sprout-withers',
    doc: 'The White Knight\'s briars wither when their while is out.',
    host: { type: SPROUT },
    on: 'time/timer',
    tree: { if: { param: { key: 'status', cmp: 'stage' } }, then: DO({ op: 'vfx', fx: 'leaves', at: 'tileOf:host' }, { op: 'destroy' }), else: 'inherit' },
  }),
  rule({
    id: 'boss/embers-die',
    doc: 'The dragon\'s embers die down when their while is out.',
    host: { type: EMBERS },
    on: 'time/timer',
    tree: { if: { param: { key: 'status', cmp: 'stage' } }, then: DO({ op: 'vfx', fx: 'smoke', at: 'tileOf:host' }, { op: 'destroy' }), else: 'inherit' },
  }),
]

/** The bosses' skills, answered (base rules: what lands is the boss's own outcome), and what they leave. */
export const BOSS_KIT_RULES: Rule[] = [...ALBERIC_RULES, ...DRAGON_RULES, ...SINS.flatMap((s) => s.rules), ...LEFT_RULES]

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
  ...SIN_BOSSES.map((b): Rule => ({
    id: `sins/${b.id}-defeated`,
    source: { origin: 'base', note: 'story' },
    host: { type: b.type, notStatus: ['down'] },
    on: 'threshold/cross',
    tree: { if: { param: { key: 'name', cmp: 'broken' } }, then: sinReward(b), else: 'inherit' },
  })),
  { id: 'sins/death-fades', source: { origin: 'base' }, host: { type: 'actor/creature/sin' }, on: 'time/timer', tree: { if: { param: { key: 'status', cmp: 'down' } }, then: { do: [{ op: 'destroy' }] }, else: 'inherit' } },
  {
    id: 'sins/story',
    source: { origin: 'base', note: 'story' },
    doc: 'The story keeps which sins have fallen, and which legendary arms they have left.',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: [
      ...SIN_BOSSES.map((b) => [`sin.${b.id}`, `sins.defeated.${b.id}`]),
      ...Object.values(LEGENDARY_ARMS).flat().map((type) => [legendFact(type), legendFact(type)]),
    ].reduceRight<Rule['tree']>((rest, [what, key]) => ({ if: { param: { key: 'what', cmp: what } }, then: { do: [{ op: 'setProp', key, value: 1 }] }, else: rest }), 'inherit'),
  },
]

/** Where the Boss Studio and the challenge stage a fight: the East Road's clearing (no campaign boss stands there). */
export const BOSS_ARENA = { map: 'eastroad', x: 23, y: 15, id: 'arena.boss' } as const
/** Saves marked with it no longer hold the removed kits' bodies, and their White Knight's blows are his attack's (migrateBosses.ts). */
export const BOSS_LAYOUT = 'content.bosses-v4'
/** The kits that were removed (2026-10-04); an older save's bodies of these are cleared on loading. */
export const REMOVED_BOSSES = ['greed', 'gluttony', 'sloth', 'wrath']
/** A boss's body as the Boss Studio, the challenge and the dev console place it (its numbers there: BossDef). */
export function createBoss(id: string, at: Pos, entityId = `sin.${id}`): Entity {
  const b = BOSS_BY_ID[id]
  if (!b) throw new Error(`Unknown boss: ${id}`)
  return { id: entityId, type: b.type, name: b.name, place: { on: 'tile', ...at }, facing: 'down', boss: { phase: 1, action: 'idle' },
    props: { hp: b.hp, maxHp: b.hp, def: b.defense, atk: b.atk },
    ai: { behaviour: 'melee', temper: 'aggressive', home: { ...at }, sight: b.encounter.sight ?? 12, leash: b.encounter.leash ?? 12 } }
}
