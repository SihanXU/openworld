// The AI interface on the Ford with a real model (the live profile; review, reflection and
// escalation off). Each scenario reaches one kind of hole through the game's own path — an
// undefined use, a blow on what cannot break, a hand on what does not say, a rope used on a
// creature, a person stuck, content broken (taking and putting are physics: never asked) — and
// the modder answers in-process, with a fresh library and self-state. The record, the episode
// and what the game did with the patch are printed and written to var/live-smoke/. Costs model
// calls (~$0.05 a scenario with Kimi K3).
//
//   npm run ford-live                 # all six
//   npm run ford-live -- "stump"      # the scenarios whose name contains it ("-stump": all but)

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Game, RuleLibrary, type UndefinedRecord } from '@openworld/engine'
import { BASE_RULES, GAME, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { modelFromEnv, openModder, type WorldEpisode } from '@openworld/modder'
import { buildFord } from './demo/world.ts'
import { SCENARIOS, W, ready, ticks, type Ford } from './fordScenarios.ts'

openModder({ game: GAME, data: mkdtempSync(join(tmpdir(), 'lsw-warm-')), model: null }) // loads .env
const model = modelFromEnv()
if (!model) throw new Error('no model')
const modder = openModder({ game: GAME, data: mkdtempSync(join(tmpdir(), 'lsw-live-')), model })
const { state } = modder.opts
const h = state.harness()
state.setHarness({ ...h, review: { ...h.review, enabled: false }, reflect: { ...h.reflect, enabled: false }, escalate: false, revise: false }, 'live smoke')
const onto = buildOntology()

function fresh(): Ford {
  const { index, chunks } = buildFord()
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES, ...modder.opts.library.lib.patches()]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  game.mods.timeoutTicks = 1e9 // the test waits for the model, not the clock
  game.mods.provider = {
    resolve: async (req) => {
      const r = await modder.resolve({ request: req }, 'live')
      return r.patch
    },
  }
  return ready({ game, eng: game.engine })
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const out: unknown[] = []
const only = process.argv[2]
for (const sc of SCENARIOS) {
  if (only && (only.startsWith('-') ? sc.name.includes(only.slice(1)) : !sc.name.includes(only))) continue
  const f = fresh()
  const t0 = Date.now()
  try {
    sc.act(f)
  } catch (err) {
    out.push({ scenario: sc.name, error: (err as Error).message })
    console.log(`\n## ${sc.name}\n  setup failed: ${(err as Error).message}`)
    continue
  }
  const rec: UndefinedRecord | undefined = f.game.mods.records[0]
  if (!rec) {
    out.push({ scenario: sc.name, error: 'no request raised' })
    console.log(`\n## ${sc.name}\n  no request raised`)
    continue
  }
  const heldWhileWaiting = Object.values(W(f).state.entities).filter((e) => e.frozenBy === rec.id).map((e) => e.id)
  while ((rec.status === 'pending' || rec.awaiting) && Date.now() - t0 < 120_000) await sleep(100)
  const ms = Date.now() - t0
  // what the game does with it now: the replay, and the same act again
  f.eng.trace.length = 0
  ticks(f, 5)
  const replayed = f.eng.trace.filter((t) => t.rule?.startsWith('patch/')).map((t) => `${t.ev.kind}@${'e' in t.ev.host ? t.ev.host.e : 'tile'} → ${t.rule}`)
  const ep = state.episodes().at(-1) ? (state.episode(state.episodes().at(-1)!.id) as WorldEpisode | undefined) : undefined
  const rules = (ep?.patch?.artifacts ?? []).flatMap((a) => (a.kind === 'rule' ? [a.rule] : []))
  const row = {
    scenario: sc.name,
    request: { summary: rec.request.summary, kind: rec.request.event.kind, host: rec.request.event.host?.type, hole: rec.request.hole, origin: rec.origin },
    heldWhileWaiting,
    status: rec.status,
    ms,
    episode: ep && { id: ep.id, outcome: ep.outcome, attempts: ep.attempts.map((a) => ({ phase: a.phase, errors: a.errors, fixes: (a as { fixes?: string[] }).fixes, derived: (a as { derived?: string[] }).derived })), usage: ep.usage, calls: ep.calls?.map((c) => ({ ms: c.ms, out: c.output, reasoning: c.reasoning, provider: c.provider })) },
    rules,
    replayed,
    stillHeld: Object.values(W(f).state.entities).filter((e) => e.frozenBy === rec.id).map((e) => e.id),
    fx: W(f).fx.filter((x) => x.t === 'log' || x.t === 'say').slice(-4).map((x) => ('text' in x ? (typeof x.text === 'string' ? x.text : x.text.en) : '')),
  }
  out.push(row)
  console.log(`\n## ${sc.name}`)
  console.log(`  request: ${row.request.summary} | ${row.request.kind} host ${row.request.host} hole ${row.request.hole.rule}${row.request.hole.path.length ? ' via ' + row.request.hole.path.join(' & ') : ''} (${row.request.origin}); held: ${heldWhileWaiting.join(',') || '—'}`)
  console.log(`  → ${rec.status} in ${(ms / 1000).toFixed(1)} s; episode ${ep?.outcome} after ${ep?.attempts.length} attempt(s), ${ep?.usage.calls} call(s), $${(ep?.usage.cost ?? 0).toFixed(4)}`)
  for (const a of ep?.attempts ?? []) console.log(`    ${a.phase}: ${a.errors.length ? a.errors.slice(0, 3).join(' | ') : 'valid'}`)
  for (const r of rules) console.log(`  rule ${r.id} [${r.on}] host ${JSON.stringify(r.host)}: ${r.doc ?? ''}\n    ${JSON.stringify(r.tree).slice(0, 600)}`)
  console.log(`  replay: ${replayed.join('; ') || '—'}; still held: ${row.stillHeld.join(',') || '—'}; lines: ${row.fx.join(' / ')}`)
}
mkdirSync('var/live-smoke', { recursive: true })
const file = `var/live-smoke/${new Date().toISOString().replace(/[:.]/g, '-')}.json`
writeFileSync(file, JSON.stringify(out, null, 1))
let cost = state.episodes().reduce((s, e) => s + ((state.episode(e.id) as WorldEpisode | undefined)?.usage.cost ?? 0), 0)
// the auditor works after shipping: wait for it, then say what it found (and what it could not show)
await modder.settled()
const journal = join(state.dir, 'journal.jsonl')
const audits = existsSync(journal) ? readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.kind === 'audit') : []
console.log(`\n## the auditor (${audits.length} audit(s))`)
for (const a of audits) {
  console.log(`  ${a.episode} ${a.rules.join(', ')}: ${a.skipped ? `skipped (${a.skipped})` : a.error ? `FAILED (${a.error}): not audited` : a.confirmed.length ? `BROKEN — ${a.confirmed.map((f: { kind: string; title: string }) => `${f.kind}: ${f.title}`).join('; ')} → removed` : 'nothing confirmed'}; ${a.usage.calls} call(s), $${(a.usage.cost ?? 0).toFixed(4)}`)
  for (const u of a.unconfirmed) console.log(`    not shown: ${u}`)
  cost += a.usage.cost ?? 0
}
writeFileSync(file.replace(/\.json$/, '.audits.json'), JSON.stringify(audits, null, 1))
console.log(`\nwritten ${file}; total cost $${cost.toFixed(3)}`)
