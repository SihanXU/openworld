// A plant's growth clock and its water are separate: Irrigation keeps water for the next stage,
// never lengthens the stage. The same watering tree serves a bucket and a sprinkler's neighbours.
import type { Effect, Rule, Tree } from '@openworld/engine'

const growing = { type: 'fixture', tags: ['crop', 'growing'] }

export function waterCrop(spread = false): Tree {
  const watered = (hours: number, retained: boolean): Tree => ({ do: [
    { op: 'addStatus', status: 'watered' },
    { op: 'addStatus', status: 'stage', duration: hours * 600 },
    retained ? { op: 'addStatus', status: 'irrigated' } : { op: 'removeStatus', status: 'irrigated' },
    ...(spread ? [{ op: 'emit', impulse: 'notify', to: { area: { radius: 1 } }, params: { what: 'water' }, filter: { ...growing, notStatus: ['watered'] } } as Effect] : []),
    { op: 'vfx', fx: 'splash' },
    { op: 'log', text: { en: 'You water {host}.', zh: '你给{host}浇了水。' } },
  ] })
  const duration = (retained: boolean): Tree => ({
    if: { prop: { role: 'host', key: 'growHours', cmp: 1 } }, then: watered(1, retained),
    else: { if: { prop: { role: 'host', key: 'growHours', cmp: 4 } }, then: watered(4, retained), else: watered(2, retained) },
  })
  return { if: { has: { role: 'actor', tag: 'skill:irrigation' } }, then: duration(true), else: duration(false) }
}

export const CROP_GROWTH_RULE: Rule = {
  id: 'farm/growth', source: { origin: 'base' }, host: growing, on: 'time/timer',
  doc: 'A watered crop grows on its own stage clock. Retained water carries a sprout through the next stage; the final stage spends all water, including before a perennial grows back.',
  tree: {
    if: { all: [{ param: { key: 'status', cmp: 'stage' } }, { has: { role: 'host', status: 'watered' } }, { outdoors: true }] },
    then: {
      if: { all: [{ has: { role: 'host', status: 'irrigated' } }, { not: { has: { role: 'host', tag: 'ripening' } } }] },
      then: { do: [{ op: 'removeStatus', status: 'irrigated' }, { op: 'grow' }] },
      else: { do: [{ op: 'grow' }, { op: 'removeStatus', status: 'watered' }, { op: 'removeStatus', status: 'irrigated' }] },
    },
    else: 'inherit',
  },
}
