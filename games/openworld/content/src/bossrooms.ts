// Boss rooms (docs/boss-rooms.md): a boss's arena is a map of its own behind a wall of fog, after the Souls. A hand on the
// fog before an arena takes one through and makes the fog one's home (where one rises after a fall: its stake); the fogs
// inside stand sealed while the boss stands; once the story knows its fall, every fog of its room lifts. A boss told the
// one it fought has fallen (body/rise) is whole again (the kits module's `rally`).

import type { Cond, Effect, Rule, Text, Tree } from '@openworld/engine'
import { CH1 } from './chapter1.ts'

const L = (en: string, zh: string): Text => ({ en, zh })
const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })

/** Each boss with a room: the boss (a fog's `boss` prop), the fact that tells the story of its fall, its arena. */
export const BOSS_ROOMS = [{ boss: 'alberic', fact: CH1.knight, arena: 'kingdom' }] as const

/** The fog's type, and its period: how often it looks whether its boss has fallen. */
export const FOG = 'fixture/fog'
export const FOG_EVERY = 10

const fallen = (r: (typeof BOSS_ROOMS)[number]): Cond => ({ all: [{ prop: { role: 'host', key: 'boss', cmp: r.boss } }, { prop: { role: 'story', key: r.fact, cmp: { gte: 1 }, default: 0 } }] })
/** Its boss fallen: the fog lifts; else `rest`. */
const unlessFallen = (lift: Tree, rest: Tree): Tree => BOSS_ROOMS.reduceRight<Tree>((t, r) => ({ if: fallen(r), then: lift, else: t }), rest)
const LIFT: Tree = { do: [{ op: 'vfx', fx: 'poof' }, { op: 'destroy' }] }
const toActor = (impulse: 'push' | 'notify', params: Record<string, unknown>): Effect => ({ op: 'emit', impulse, to: 'actor', params }) as Effect

export const BOSS_ROOM_RULES: Rule[] = [
  story({
    id: 'fog/enter',
    label: L('Pass through {target}', '穿过{target}'),
    doc: 'A hand on the fog before a boss\'s arena (its interior props): one passes through into the arena, and the fog is one\'s home from now on (where one rises after a fall, its stake). A fog inside an arena, sealed while its boss stands: it does not part, and says so. Its boss fallen: it lifts.',
    host: { type: FOG },
    on: 'impulse/handle',
    tree: unlessFallen(LIFT, {
      if: { prop: { role: 'host', key: 'interior', cmp: { ne: '' } } },
      then: { do: [toActor('push', { map: { prop: 'interior', of: 'host' }, x: { prop: 'interiorX', of: 'host' }, y: { prop: 'interiorY', of: 'host' } }), toActor('notify', { what: 'home', value: { idOf: 'host' } })] },
      else: { label: L('Sealed: {target}', '封住了：{target}'), do: [{ op: 'log', text: L('The fog will not part while it stands.', '它还站着，雾不会散开。') }] },
    }),
  }),
  story({
    id: 'fog/holds',
    label: L('The fog will not give', '雾不为所动'),
    doc: "Anything else done to a boss's fog — a blow, a fire, something put to it or used on it — passes through mist: defined, nothing changes, so nothing breaks into a boss's room but by its door (docs/boss-rooms.md). Its boss fallen, it lifts.",
    host: { type: FOG },
    on: 'impulse',
    tree: unlessFallen(LIFT, { do: [{ op: 'log', text: L('It passes through the fog as through smoke. The fog closes again.', '像穿过一缕烟一样穿过了雾。雾又合拢了。') }] }),
  }),
  story({
    id: 'fog/lifts',
    doc: 'A boss\'s fog looks now and then (its period) whether the story knows its boss fallen: if so it lifts, and the way under it is open.',
    host: { type: FOG },
    on: 'time/period',
    tree: unlessFallen(LIFT, { do: [] }),
  }),
  story({
    id: 'boss/rally',
    doc: 'A boss told the one it fought has fallen and gone (body/rise, rising at home): it is whole again — its health, its fight from the first phase, its post.',
    host: { type: 'actor', tags: ['boss'] },
    on: 'impulse/notify',
    tree: { if: { param: { key: 'what', cmp: 'foe-fell' } }, then: { do: [{ op: 'rally' }] }, else: 'inherit' },
  }),
]
