// The affordance set with a real model (design.md §5.17; the live profile; review, reflection and escalation off):
// a bare hand on each thing of the set, on a fresh library, followed as the game follows it (an answer that sends an
// impulse on may raise its receiver's hole next). The verdict is on the world afterwards, not on the words: a thing
// with a use passes when the answer judged it a use and the scene changed (the one who used it seated, a status,
// a thing made); a thing with none passes when the answer judged it words or nothing and the scene did not change.
// Written to var/eval/affordance/<time>.json. Costs model calls (one or two a case).
//
//   npm run eval:affordance               # the whole set
//   npm run eval:affordance -- chair      # the cases whose name contains it

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGAIN_AFTER, textOf, type Engine } from '@openworld/engine'
import { REPO, modelFromEnv, sleep } from '@openworld/ai'
import { AFFORDANCE_CASES, askCase } from './eval/affordanceSet.ts'
import { answering, episodesOf, follow, liveModder, rulesOf } from './live.ts'

const model = modelFromEnv()
if (!model) throw new Error('no model: set LSW_MODEL_BACKEND (claude-code, anthropic) or the OpenRouter key')
const filter = process.argv[2]
const cases = AFFORDANCE_CASES.filter((c) => !filter || c.name.includes(filter))

/** What the scene's things are: their type, statuses, numbers and cell, and how many things there are. */
function stateOf(eng: Engine): string {
  const w = eng.world
  return JSON.stringify(Object.values(w.state.entities).filter((e) => !w.isPlaceless(e)).map((e) => [e.id, e.type, Object.keys(e.statuses ?? {}).sort(), e.props, e.place]))
}

interface Result {
  case: string
  expect: 'use' | 'words'
  affords?: string
  changed: boolean
  pass: boolean
  said: string[]
  rules: { id: string; doc?: string; affords?: string }[]
  holes: string
  /** asked again after two more tries, when the first answer gave words (the final answer) */
  again?: { asked: boolean; affords?: string; changed: boolean; pass: boolean; rule?: { id: string; doc?: string } }
  calls: number
  cost: number
  s: number
}
const results: Result[] = []
for (const c of cases) {
  const modder = liveModder(model, 'lsw-afford-', 'eval: affordance')
  const t0 = Date.now()
  // the act raises its question as the game raises it
  const { eng, port } = askCase(c)
  const before = stateOf(eng)
  const { patches, episodes } = answering(port, modder)
  for (const r of port.records) port['ask'](r)
  console.log(`\n=== ${c.name} (${c.expect}${c.use ? `: ${c.use}` : ''})`)
  await follow(eng, port, t0, 3, 10)
  const rules = rulesOf(patches)
  const own = rules.find((r) => r.host?.type === c.target && r.on === 'impulse/handle')
  const changed = stateOf(eng) !== before
  const affords = own?.affords
  const pass = !!own && (c.expect === 'use' ? affords === 'use' && changed : affords !== 'use' && !changed)
  // words are provisional: the player tries twice more, as one who expected more would, and the answer then is final
  let again: Result['again']
  if (affords === 'words') {
    const was = stateOf(eng)
    const seen = patches.length
    for (let i = 1; i < AGAIN_AFTER; i++) {
      eng.act('hands', 'actor', { e: 'it' }, { instrument: null })
      eng.tick()
    }
    const t1 = Date.now()
    while (Date.now() - t1 < 300_000 && port.records.some((r) => r.status === 'pending' || r.awaiting)) {
      eng.tick()
      await sleep(200)
    }
    for (let i = 0; i < 10; i++) eng.tick()
    const next = rulesOf(patches.slice(seen)).find((r) => r.host?.type === c.target && r.on === 'impulse/handle')
    const moved = stateOf(eng) !== was
    again = { asked: !!next, affords: next?.affords, changed: moved, pass: !!next && (c.expect === 'use' ? next.affords === 'use' && moved : next.affords !== 'use' && !moved), rule: next && { id: next.id, doc: next.doc } }
  }
  // the episodes so far, the asking again's too
  const spent = episodesOf(modder, episodes)
  const said = [...eng.world.recent, ...eng.world.fx.flatMap((f) => (f.t === 'log' || f.t === 'say' ? [f.text] : []))].map((t) => textOf(t, 'en')).filter((t) => !/^You reach out|patch rejected/.test(t))
  const r: Result = {
    case: c.name,
    expect: c.expect,
    affords,
    changed,
    pass,
    said: [...new Set(said)].slice(-4),
    rules: rules.map((x) => ({ id: x.id, doc: x.doc, affords: x.affords })),
    again,
    holes: port.records.map((x) => `${x.request.event.host?.type.split('/').pop()} ${x.request.event.kind}: ${x.status}`).join('; '),
    calls: spent.reduce((a, e) => a + e.usage.calls, 0),
    cost: spent.reduce((a, e) => a + (e.usage.cost ?? 0), 0),
    s: (Date.now() - t0) / 1000,
  }
  results.push(r)
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — judged ${affords ?? '(no answer)'}, the scene ${changed ? 'changed' : 'unchanged'} · ${r.calls} calls · ${r.s.toFixed(1)} s`)
  console.log(`  holes: ${r.holes}`)
  for (const x of r.rules) console.log(`  rule ${x.id} [${x.affords ?? '-'}]: ${x.doc ?? ''}`)
  for (const l of r.said) console.log(`  » ${l}`)
  if (again) console.log(`  again: ${again.asked ? `judged ${again.affords}, the scene ${again.changed ? 'changed' : 'unchanged'}: ${again.pass ? 'PASS' : 'FAIL'} — ${again.rule?.doc ?? ''}` : 'not asked'}`)
}
const of = (k: 'use' | 'words') => results.filter((r) => r.expect === k)
const passed = (rs: Result[]) => rs.filter((r) => r.pass).length
const cost = results.reduce((a, r) => a + r.cost, 0)
/** The final verdict: the answer asked again where there was one, else the first. */
const final = (r: Result) => (r.again?.asked ? r.again.pass : r.pass)
const summary = { model: model.name, final: `${results.filter(final).length}/${results.length}`, finalInvented: of('words').filter((r) => (r.again?.asked ? r.again.affords === 'use' || r.again.changed : r.affords === 'use' || r.changed)).length, reasked: results.filter((r) => r.again?.asked).length, uses: `${passed(of('use'))}/${of('use').length}`, words: `${passed(of('words'))}/${of('words').length}`, accuracy: results.length ? passed(results) / results.length : 0, invented: of('words').filter((r) => r.affords === 'use' || r.changed).length, shrugged: of('use').filter((r) => r.affords !== 'use').length, calls: results.reduce((a, r) => a + r.calls, 0), cost }
console.log(`\nSUMMARY ${JSON.stringify(summary)}`)
const out = join(REPO, 'var/eval/affordance')
mkdirSync(out, { recursive: true })
const file = join(out, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
writeFileSync(file, JSON.stringify({ summary, results }, null, 2))
console.log(`written ${file}`)
