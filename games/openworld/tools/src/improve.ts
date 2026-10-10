// One turn of the outer loop on the modder's self-state: it proposes one change to how it works,
// and the change is kept only if replays of recorded world and engine tasks bear it out.
//
//   npm run improve -- [--select 8] [--confirm 8] [--margin 0.1]

import { improve } from '@openworld/agent'
import { openModder } from '@openworld/modder'
import { engineSource } from './engine-tasks.ts'

const argv = process.argv.slice(2)
const flag = (k: string, d: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d)
const modder = openModder({ log: (l) => console.log(`  ${l}`) })
if (!modder.model) throw new Error('no model configured (LSW_MODEL_KEY, LSW_MODEL)')
const r = await improve({
  model: modder.model,
  state: modder.opts.state,
  sources: [modder.taskSource(), engineSource()],
  select: Number(flag('select', '8')),
  confirm: Number(flag('confirm', '8')),
  margin: Number(flag('margin', '0.1')),
  log: (l) => console.log(l),
})
console.log(JSON.stringify({ proposal: r.proposal, accepted: r.accepted, reason: r.reason, selection: r.selection, confirmation: r.confirmation, cost: r.cost }, null, 2))
