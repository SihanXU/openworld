// The Mod Console's starting-point patch, kept apart from the DOM so it can be checked headlessly.

import type { Patch } from '@lsw/engine'
import type { RecordView } from '../protocol.ts'

/** A starting-point patch for a record: a rule for the host's class, a visible outcome, and the triggering case as a test. */
export function template(r: RecordView): Patch {
  const req = r.request
  const ev = req.event
  const host = ev.host
  const leaf = (t?: { type: string }) => (t ? t.type.split('/').pop()! : 'thing')
  // a learned rule is one type's (design.md §5.16)
  const hostType = host?.type
  // the host as the scenario names it (its role's key); a tile or a resident has no entity to expect
  const sc = req.scenario.event
  const hostKey = sc.host ?? sc.instrument ?? sc.actor ?? sc.target
  const expect = hostKey && req.scenario.entities.some((e) => e.key === hostKey) ? [{ key: hostKey, exists: true as const }] : []
  return {
    author: 'human',
    note: `for ${req.summary}`,
    artifacts: [
      {
        kind: 'rule',
        rule: {
          id: `patch/${leaf(host)}-${ev.kind.replace('/', '-')}`,
          host: { type: hostType ?? 'fixture' },
          on: ev.kind,
          doc: 'TODO: one-line description',
          label: { en: 'TODO: what the input does to {target}', zh: 'TODO：对{target}做什么' },
          tree: { do: [{ op: 'vfx', fx: 'sparkle' }, { op: 'log', text: { en: 'TODO: what happens', zh: 'TODO：发生了什么' } }] },
          tests: [{ name: 'the triggering event', given: req.scenario, expect }],
        },
      },
    ],
  }
}
