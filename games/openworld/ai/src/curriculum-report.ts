// A curriculum run, summarised: each step (hole, act, host, outcome, first answer valid, time, cost, the undefined cells its patch answered, the rule), the late reviews, the revisions and escalations, the drafts that failed first, and the spend.  npm run curriculum:report -- [<data dir>]
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'var/curriculum-em'
const runs = readdirSync(join(dir, 'runs')).sort()
const steps = readFileSync(join(dir, 'runs', runs.at(-1)!), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
const journal = readFileSync(join(dir, 'modder-state', 'journal.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
const epDir = join(dir, 'modder-state', 'memory', 'episodes')
const eps = readdirSync(epDir).map((f) => JSON.parse(readFileSync(join(epDir, f), 'utf8')))
const byId = new Map(eps.map((e) => [e.id, e]))
const rule = (id: string) => {
  for (const e of eps) for (const a of e.patch?.artifacts ?? []) if (a.kind === 'rule' && a.rule.id === id) return a.rule
  return undefined
}
console.log('| # | hole | act | host | outcome | 1st valid | s | $ | cells answered | rule |')
console.log('|---|---|---|---|---|---|---|---|---|---|')
for (const s of steps) {
  const r = s.rules?.[0] ? rule(s.rules[0]) : undefined
  console.log(`| ${s.step} | ${s.hole} | ${s.cell.verb} ${s.cell.hand ? s.cell.hand.split('/').pop() : 'hand'} → ${s.cell.target.replace('fixture/', '')} | ${s.host} | ${s.outcome} | ${s.firstValid ? 'yes' : 'no'} | ${(s.ms / 1000).toFixed(1)} | ${(s.cost ?? 0).toFixed(3)} | ${s.answered} | ${r ? `${r.id} [${r.on}] ${JSON.stringify(r.host)}` : '—'} |`)
}
console.log('\nREVIEWS')
for (const j of journal.filter((x) => x.kind === 'review')) console.log(`- ${j.episode} ${j.rules.join(',')}: ${j.verdict}${j.flags?.length ? ` (flags ${j.flags.join('; ')})` : ''}${j.notes?.length ? ` — ${j.notes.join(' / ')}` : ''}`)
console.log('\nREVISIONS / ESCALATIONS')
for (const e of eps.filter((x) => x.revises || x.escalatedFrom)) console.log(`- ${e.id} ${e.revises ? `revises ${e.revises}` : `escalated from ${e.escalatedFrom}`} [${e.kind ?? 'world'} ${e.profile}]: ${e.outcome} after ${e.attempts.length} attempts, ${e.usage.calls} calls, $${(e.usage.cost ?? 0).toFixed(3)}${e.error ? ` (${e.error})` : ''} → ${e.rules.join(', ')}`)
console.log('\nFAILED DRAFTS (first attempt errors)')
for (const s of steps) {
  const e = byId.get(s.episode)
  if (e && e.attempts[0]?.errors.length) console.log(`- step ${s.step} ${s.summary}: ${e.attempts[0].errors.slice(0, 3).join(' | ')}${e.attempts[0].fixes?.length ? ` [fixes: ${e.attempts[0].fixes.join('; ')}]` : ''}`)
}
const lessons = journal.filter((x) => x.kind !== 'review').map((x) => x.kind)
console.log('\nJOURNAL KINDS', [...new Set(lessons)].map((k) => `${k} ${lessons.filter((x) => x === k).length}`).join(', '))
const episodeSpend = eps.reduce((a, e) => a + (e.usage.cost ?? 0), 0)
const background = journal.reduce((a, j) => a + (j.usage?.cost ?? 0), 0)
console.log(`\nspend: episodes $${episodeSpend.toFixed(3)} + background $${background.toFixed(3)} = $${(episodeSpend + background).toFixed(3)}`)
console.log(`undefined (all): ${steps[0].undefined + steps[0].answered} → ${steps.at(-1).undefined}`)
