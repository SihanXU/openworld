// The creatures' own skills (docs/creatures.md): each kind's kit — what its behaviour takes up and how it is aimed and
// timed (the kits module) — and its rule, which says what lands. A skill is a creature's act (`use` with the param
// `kit`); its rule answers with `unleash`, so what a wolf's lunge or a spider's web does is data like any other answer.
// The skills come from the setting (docs/lore.md §2): the First Night seeping in — beasts gone strange, the dead that
// do not rest, things of the night that do not belong to the world.

import type { CreatureSkill, Rule } from '@openworld/engine'
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
