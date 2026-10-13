// Faith and good and evil (2026-10-12): two numbers the one at the keys carries, −100..100. Karma falls with every deed
// one does, seen or not (the society module's conscience), and rises with kindness (a favour done, what was taken given
// back, an apology taken); the good warm sooner to the good, the wicked to the wicked (social.ts kinship). Faith is how
// one stands with the Church: prayer at an altar or a wayside shrine raises it (once a day at each), words against the
// gods lower it (the talk's unbelief), and the Church's people answer it in the story (tools quest/pilgrimage.ts).

import { TICKS_PER_DAY, type Effect, type Rule, type StatusDef, type Text, type Tree } from '@openworld/engine'

const L = (en: string, zh: string): Text => ({ en, zh })
const rule = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base' } })

/** What the story reads of faith: the Church's people bless one who keeps it, and turn cold to one who does not. */
export const FAITH = {
  /** At or above: devout, in the Church's eyes. */
  devout: 30,
  /** At or below: an unbeliever. */
  doubter: -30,
} as const

/** The story's facts of it: blessed at the Rest, turned away there, sought out by the Grey Man (later chapters read them). */
export const CHURCH = {
  blessed: 'ch1.church.blessed',
  shunned: 'ch1.church.shunned',
  greyman: 'ch1.church.greyman',
} as const

export const FAITH_STATUSES: StatusDef[] = [
  // a place prayed at today (by anyone: its quiet is spent until tomorrow)
  { id: 'prayed', name: L('prayed at today', '今日已祈祷'), duration: TICKS_PER_DAY },
]

const tell = (what: 'faith' | 'karma', delta: number): Effect => ({ op: 'emit', impulse: 'notify', to: 'actor', params: { what, delta } })

/** A prayer at a holy place: faith, once a day there (after what is done first: a shrine's words read). */
const prayed = (gain: number, first: Effect[]): Tree => ({
  if: { has: { role: 'host', status: 'prayed' } },
  then: { do: [...first, { op: 'log', text: L('You have already prayed here today.', '你今天已经在这里祈祷过了。') }] },
  else: {
    do: [
      ...first,
      { op: 'addStatus', status: 'prayed' },
      { op: 'vfx', fx: 'sparkle' },
      { op: 'log', text: L('You bow your head at {host} and pray.', '你在{host}前低下头，默默祈祷。') },
      tell('faith', gain),
    ],
  },
})

export const FAITH_RULES: Rule[] = [
  rule({
    id: 'faith/altar',
    label: L('Pray at {target}', '在{target}前祈祷'),
    doc: 'A hand on an altar: one prays there — faith +4, once a day at each altar (prayed); prayed at today, it says so.',
    host: { type: 'fixture/sacred/altar' },
    on: 'impulse/handle',
    tree: prayed(4, []),
  }),
  rule({
    id: 'faith/wayshrine',
    label: L('Read and pray at {target}', '阅读并在{target}前祈祷'),
    doc: 'A hand on a wayside shrine of the Five Sufferings: its carving is read, and one prays there — faith +2, once a day at each.',
    host: { type: 'fixture/sacred/wayshrine' },
    on: 'impulse/handle',
    tree: prayed(2, [{ op: 'say', text: '@line' }]),
  }),
]
