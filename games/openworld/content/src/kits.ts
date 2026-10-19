// The creatures' own skills (docs/creatures.md): each kind's kit — what its behaviour takes up and how it is aimed and
// timed (the kits module) — and its rule, which says what lands. A skill is a creature's act (`use` with the param
// `kit`); its rule answers with `unleash`, so what a wolf's lunge or a spider's web does is data like any other answer.
// The skills come from the setting (docs/lore.md §2): the First Night seeping in — beasts gone strange, the dead that
// do not rest, things of the night that do not belong to the world.

import type { CreatureSkill, Effect, Rule } from '@openworld/engine'
import { CALL, CLING, DO, ELEMENT, HARM, POWER, kitRule, skill, unleash } from './afflictions.ts'

// ------------------------------------------------------------------ the skills

const HOP = skill('hop', 'Hop', '弹跳', { shape: 'circle', aim: 'target', radius: 1, move: 'leap', range: [2, 3], windup: 8, cooldown: 40, chance: 0.6, color: HARM })
const LUNGE = skill('lunge', 'Lunge', '扑咬', { shape: 'line', aim: 'target', radius: 3, move: 'dash', aligned: true, range: [2, 3], windup: 7, cooldown: 50, chance: 0.7, color: HARM })
const HOWL = skill('howl', 'Howl', '狼嚎', { shape: 'circle', aim: 'self', radius: 0, range: [1, 8], windup: 10, cooldown: 600, below: 0.6, color: CALL })
const CHARGE = skill('charge', 'Charge', '冲撞', { shape: 'line', aim: 'target', radius: 5, move: 'dash', aligned: true, range: [2, 5], windup: 12, cooldown: 60, color: HARM })
const SWOOP = skill('swoop', 'Swoop', '俯冲', { shape: 'line', aim: 'target', radius: 3, move: 'dash', back: 2, aligned: true, range: [2, 3], windup: 6, cooldown: 40, chance: 0.7, color: HARM })
const GRAB = skill('grab', 'Grasp', '腐臂紧抓', { shape: 'cross', aim: 'self', radius: 1, range: [1, 1], windup: 10, cooldown: 50, chance: 0.6, color: CLING })
const BONE = skill('bone', 'Bone Toss', '掷骨', { shape: 'line', aim: 'target', radius: 5, aligned: true, range: [2, 5], windup: 8, cooldown: 40, color: HARM })
const WAIL = skill('wail', 'Wail', '哀嚎', { shape: 'circle', aim: 'self', radius: 2, range: [1, 2], windup: 12, cooldown: 70, color: CLING })
const SLAM = skill('slam', 'Ground Slam', '震地', { shape: 'circle', aim: 'self', radius: 2, range: [1, 2], windup: 16, cooldown: 60, color: HARM })
const FIREBALL = skill('fireball', 'Fireball', '火球', { shape: 'circle', aim: 'target', radius: 1, range: [2, 5], windup: 10, cooldown: 50, color: HARM })
const DISCHARGE = skill('discharge', 'Discharge', '放电', { shape: 'cross', aim: 'target', radius: 2, range: [2, 4], windup: 10, cooldown: 50, color: HARM })
const WEB = skill('web', 'Web Spit', '吐丝', { shape: 'circle', aim: 'target', radius: 1, range: [2, 4], windup: 8, cooldown: 60, color: CLING })
const BREATH = skill('breath', 'Ember Breath', '余烬吐息', { shape: 'cone', aim: 'self', radius: 3, aligned: true, range: [1, 3], windup: 10, cooldown: 50, color: HARM })
const SHELL = skill('shell', 'Shell Up', '缩壳', { shape: 'circle', aim: 'self', radius: 0, range: [1, 4], windup: 4, cooldown: 150, below: 0.5, color: CALL })

const C = 'actor/creature'

/** Each kind's kit, by type (a kind's is the nearest its type or an ancestor names). */
export const KITS: Record<string, CreatureSkill[]> = {
  [`${C}/slime`]: [HOP],
  [`${C}/beast/wolf`]: [HOWL, LUNGE],
  [`${C}/beast/frost_wolf`]: [HOWL, LUNGE],
  [`${C}/beast/boar`]: [CHARGE],
  [`${C}/beast/bat`]: [SWOOP],
  [`${C}/undead/zombie`]: [GRAB],
  [`${C}/undead/skeleton`]: [BONE],
  [`${C}/undead/ghost`]: [WAIL],
  [`${C}/golem`]: [SLAM],
  [`${C}/imp`]: [FIREBALL],
  [`${C}/wisp`]: [DISCHARGE],
  [`${C}/spider`]: [WEB],
  [`${C}/whelp`]: [BREATH],
  [`${C}/crab`]: [SHELL],
}

// ------------------------------------------------------------------ the rules

export const KIT_RULES: Rule[] = [
  ...kitRule('kit/slime', `${C}/slime`, 'A slime\'s Hop: it leaps onto the foe\'s cell and splashes the cells around it, in its own element.', [
    ['hop', DO(unleash({ power: POWER(1.5), element: ELEMENT, edge: 'blunt' }), { op: 'vfx', fx: 'splash' })],
  ]),
  ...kitRule('kit/wolf', [`${C}/beast/wolf`, `${C}/beast/frost_wolf`], 'A wolf\'s Lunge: it dashes along the row to the first foe and bites, opening a bleed; its Howl, hurt: every beast near is frenzied, itself too.', [
    ['lunge', DO(unleash({ power: POWER(1.5), element: ELEMENT, edge: 'cut', coat: 'bleeding' }))],
    ['howl', DO({ op: 'addStatus', status: 'frenzied' }, { op: 'emit', impulse: 'coat', to: { around: 6 }, params: { substance: 'frenzied' }, filter: { tags: ['beast'] } }, { op: 'vfx', fx: 'gust' })],
  ]),
  ...kitRule('kit/boar', `${C}/beast/boar`, 'A boar\'s Charge: it runs headlong down the row; the first foe it meets is struck hard, thrown back two cells and stunned; it runs into a wall or a tree and is stunned itself.', [
    ['charge', DO(unleash({ power: POWER(2), edge: 'blunt', coat: 'stunned', push: 2 }))],
  ]),
  ...kitRule('kit/bat', `${C}/beast/bat`, 'A bat\'s Swoop: it darts down the row to the first foe, bites, drinks a little of it and springs back.', [
    ['swoop', DO(unleash({ power: POWER(1.2), edge: 'pierce', heal: 1 }))],
  ]),
  ...kitRule('kit/zombie', `${C}/undead/zombie`, 'A zombie\'s Grasp: it reaches out on every side; what it catches is held, slowed as in a mire.', [
    ['grab', DO(unleash({ power: POWER(1), edge: 'blunt', coat: 'mired' }))],
  ]),
  ...kitRule('kit/skeleton', `${C}/undead/skeleton`, 'A skeleton\'s Bone Toss: a bone thrown down the row at the foe.', [
    ['bone', DO(unleash({ power: POWER(1), edge: 'blunt' }))],
  ]),
  ...kitRule('kit/ghost', `${C}/undead/ghost`, 'A ghost\'s Wail: those around it are struck senseless a moment, and touched by its cold.', [
    ['wail', DO(unleash({ power: POWER(0.8), element: ELEMENT, edge: 'magic', coat: 'stunned' }))],
  ]),
  ...kitRule('kit/golem', `${C}/golem`, 'A golem\'s Ground Slam: slow to rise, it brings both fists down; all around it are struck in its element and thrown back a cell.', [
    ['slam', DO(unleash({ power: POWER(1.6), element: ELEMENT, edge: 'blunt', push: 1 }), { op: 'vfx', fx: 'dust' })],
  ]),
  ...kitRule('kit/imp', `${C}/imp`, 'An imp\'s Fireball: it lobs fire onto the foe\'s cell and the cells around it.', [
    ['fireball', DO(unleash({ power: POWER(1.2), element: 'fire', edge: 'magic' }))],
  ]),
  ...kitRule('kit/wisp', `${C}/wisp`, 'A wisp\'s Discharge: lightning runs out from the foe\'s cell along the row and the column.', [
    ['discharge', DO(unleash({ power: POWER(1), element: 'lightning', edge: 'magic' }))],
  ]),
  // its plain bite poisons, a third of the time (the bite is the bare body's blow, core/use, with a coat beside it)
  ...kitRule('kit/spider', `${C}/spider`, 'A spider\'s Web Spit: what stands on the cells it spits on is webbed, wading at a third of the pace. Its bite is venomous: one bite in four poisons.', [
    ['web', DO(unleash({ coat: 'webbed' }))],
  ], {
    if: { all: [{ none: 'instrument' }, { param: { key: 'attack', cmp: true } }] },
    then: DO(
      { op: 'emit', impulse: 'strike', to: 'target', params: { power: { param: 'power' }, element: ELEMENT, edge: 'pierce' } },
      { op: 'emit', impulse: 'coat', to: 'target', params: { substance: 'poisoned' }, chance: 0.25, filter: { type: 'actor' } },
    ),
    else: 'inherit',
  }),
  ...kitRule('kit/whelp', `${C}/whelp`, 'A whelp\'s Ember Breath: a cone of fire before it.', [
    ['breath', DO(unleash({ power: POWER(1.2), element: 'fire', edge: 'magic' }))],
  ]),
  ...kitRule('kit/crab', `${C}/crab`, 'A crab\'s Shell Up, hurt: it draws into its shell, hard to hurt and slow a while.', [
    ['shell', DO({ op: 'addStatus', status: 'shelled' }, { op: 'vfx', fx: 'dust' })],
  ]),
]

// ------------------------------------------------------------------ the elites (docs/creatures.md §10)
// The gatekeepers of the minor monsters: the barrow warden, the cyclops, the Slime King. They take their skills up as any
// minor monster does (the kit goal: when a skill's conditions hold), never by a boss's director; what makes them a fight of
// their own is a kit of two to four, a chain (`then`) and a guard that waits out a hold (`steady`).

// the barrow warden: Tomas, the Order's sworn brother, who still holds his post before the altar (docs/chapter-1.md §11)
const VIGIL_SWEEP = skill('vigil_sweep', 'Vigil Sweep', '守夜横扫', { shape: 'cone', aim: 'self', radius: 2, range: [1, 2], windup: 10, cooldown: 40, color: HARM })
const SHIELD_CHARGE = skill('shield_charge', 'Shield Charge', '盾冲', { shape: 'line', aim: 'target', radius: 4, move: 'dash', aligned: true, range: [2, 4], windup: 12, cooldown: 70, then: 'vigil_sweep', color: HARM })
const HOLD_POST = skill('hold_post', 'Hold the Post', '坚守岗位', { shape: 'ring', aim: 'self', radius: 3, range: [1, 5], windup: 14, cooldown: 240, below: 0.5, steady: true, color: CLING })

// the cyclops of the old mine, on the ore it has hoarded
const BOULDER = skill('boulder', 'Boulder Toss', '掷石', { shape: 'circle', aim: 'target', radius: 1, range: [3, 6], windup: 14, cooldown: 50, color: HARM })
const STOMP = skill('stomp', 'Stomp', '跺地', { shape: 'circle', aim: 'self', radius: 2, range: [1, 2], windup: 16, cooldown: 50, then: 'aftershock', color: HARM })
// (only ever the stomp's chain: no foe stands on its own cell, so its range [0, 0] never holds for the kit goal)
const AFTERSHOCK = skill('aftershock', 'Aftershock', '余震', { shape: 'ring', aim: 'self', radius: 3, range: [0, 0], windup: 8, cooldown: 0, color: HARM })
const GLARE = skill('glare', 'Baleful Glare', '独眼凝视', { shape: 'line', aim: 'target', radius: 6, aligned: true, range: [2, 6], windup: 12, cooldown: 90, color: CLING })

// the Slime King: a heap of slime with a crown in it
const ROYAL_HOP = skill('royal_hop', 'Royal Bounce', '王之弹跳', { shape: 'circle', aim: 'target', radius: 2, move: 'leap', range: [2, 4], windup: 12, cooldown: 40, color: HARM })
const SPLIT = skill('split', 'Split', '分裂', { shape: 'circle', aim: 'self', radius: 0, range: [1, 8], windup: 10, cooldown: 600, below: 0.5, color: CALL })

/** The elites' kits, by type: two to four skills, a chain, a guard (kit-contract.test.ts, the elite tier). */
export const ELITE_KITS: Record<string, CreatureSkill[]> = {
  [`${C}/undead/warden`]: [HOLD_POST, SHIELD_CHARGE, VIGIL_SWEEP],
  [`${C}/cyclops`]: [GLARE, BOULDER, STOMP, AFTERSHOCK],
  [`${C}/slime/king_slime`]: [SPLIT, ROYAL_HOP],
}

/** Its brood splits off once in a fight's life: the king keeps that it has (its own prop `split`). */
const SPLIT_OFF: Effect[] = [
  { op: 'spawn', type: `${C}/slime/green_slime`, at: 'host', count: 2 },
  { op: 'setProp', key: 'split', value: 1 },
  { op: 'vfx', fx: 'splash' },
]

export const ELITE_RULES: Rule[] = [
  ...kitRule('kit/warden', `${C}/undead/warden`, 'The barrow warden\'s skills: his Vigil Sweep cuts the cone before him and drives back a cell; his Shield Charge runs down the row to the first foe, stuns it and sweeps at once; hurt, he Holds the Post: the ring three cells out is struck and mired, and no hold breaks his wind-up.', [
    ['vigil_sweep', DO(unleash({ power: POWER(1.4), edge: 'cut', push: 1 }))],
    ['shield_charge', DO(unleash({ power: POWER(1.6), edge: 'blunt', coat: 'stunned' }))],
    ['hold_post', DO(unleash({ power: POWER(1), edge: 'cut', coat: 'mired' }))],
  ]),
  ...kitRule('kit/cyclops', `${C}/cyclops`, 'The cyclops\'s skills: it throws a boulder onto the foe\'s cell and those round it; it stomps, striking all round it and driving them back, and the aftershock runs out to the ring beyond; its Baleful Glare down the row stuns whoever meets its eye.', [
    ['boulder', DO(unleash({ power: POWER(1.6), element: 'earth', edge: 'blunt' }), { op: 'vfx', fx: 'dust' })],
    ['stomp', DO(unleash({ power: POWER(1.5), element: 'earth', edge: 'blunt', push: 1 }))],
    ['aftershock', DO(unleash({ power: POWER(1), element: 'earth', edge: 'blunt' }))],
    ['glare', DO(unleash({ power: POWER(0.8), edge: 'magic', coat: 'stunned' }))],
  ]),
  ...kitRule('kit/king_slime', `${C}/slime/king_slime`, 'The Slime King\'s skills: its Royal Bounce lands on the foe and splashes two cells round it; hurt, it Splits: two green slimes come off it, once.', [
    ['royal_hop', DO(unleash({ power: POWER(1.5), element: ELEMENT, edge: 'blunt' }), { op: 'vfx', fx: 'splash' })],
    ['split', { if: { prop: { role: 'host', key: 'split', cmp: 1 } }, then: DO(), else: DO(...SPLIT_OFF) }],
  ]),
]
