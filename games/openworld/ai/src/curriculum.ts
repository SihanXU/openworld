// The offline inner loop: undefined outcomes of the player's acts, handed to the modder one by one as if players
// had tried them (offline profile: the SWE-style agent works each as a repository). The shared
// library and the self-state grow exactly as they do online (same files). Optionally:
// checkpoints (learning-curve numbers + a self-state snapshot), the outer loop every N episodes,
// and a spending cap. Do not run it while the service is running on the same data directory.
//
//   npm run curriculum -- [--n 20] [--seed 1] [--scope demo|all] [--checkpoint 10]
//                         [--improve-every 10] [--budget 5] [--engine]
//                         [--profile live|offline] [--by hole] [--data <dir>] [--ladder [--until YYYY-MM-DD]]
//   --profile live answers as a player would get it (one call; review after shipping; a failure
//   escalates to the offline agent in the background); --by hole spreads the sample over the
//   holes the cells reach. Every step is a row of <data>/runs/<time>.jsonl, with the coverage
//   after it: how many undefined cells the patch answered (its class reaches further than the cell).
//   --ladder works a ladder task (this repository's own commits, npm run ladder) every other step, from the windows
//   before --until (a milestone's day: docs/rsi-experiments.md §6.2).
//   (model from .env / the environment, as for `npm run modder`)
//
//   npm run improve -- [--select 8] [--confirm 8] [--margin 0.1]
//   one turn of the outer loop on the modder's self-state: it proposes one change to how it works, and the change is
//   kept only if replays of recorded world and engine tasks bear it out.
//
//   npm run curriculum:report -- [<data dir>]
//   a run summarised: each step (hole, act, host, outcome, first answer valid, time, cost, the undefined cells its
//   patch answered, the rule), the late reviews, the revisions and escalations, the drafts that failed first, and the spend.

import { appendFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ModPort, Rng, buildSandbox, type ModRequest, type Ontology, type RuleLibrary, type Scenario } from '@openworld/engine'
import { GAME, buildOntology } from '@openworld-game/content'
import { improve, openModder, runAgent, flags, type Modder, type TaskSource } from '@openworld/ai'
import { FRONT, ORIGIN, sweep, targets, type Cell } from '../../tools/src/coverage.ts'
import { engineSource, engineTask, engineTaskDefs, type WorkspaceTask } from './engine-tasks.ts'
import { historyDefs, historySource, historyTask } from './ladder.ts'
import { pickByHole, pickWeighted, scopedTotals, worldScope, type Scope } from '../../tools/src/scope.ts'

const SIZE = 9 // the request window is 7×7 around the target (or around the actor, using a thing on itself)
const SHIFT = { x: 4 - FRONT.x, y: 4 - FRONT.y }

/** The ModRequest a player would raise for one swept cell, built through the real engine path. */
export function cellRequest(cell: Cell, onto: Ontology, lib: RuleLibrary): ModRequest | undefined {
  const target = targets(onto).find((t) => t.id === cell.target)
  if (!target) return undefined
  const small: Scenario = {
    terrain: Array.from({ length: 3 }, () => Array(3).fill('grass')),
    entities: [{ key: 'actor', type: 'actor/person/player', ...ORIGIN }],
    event: {},
  }
  if (cell.hand) small.entities.push({ key: 'held', type: cell.hand, ...ORIGIN, heldBy: 'actor' })
  const key = target.scenario(small)
  // re-centre the 3×3 sweep field in a larger one, so the window around the target is open ground
  const terrain = Array.from({ length: SIZE }, () => Array(SIZE).fill('grass'))
  small.terrain!.forEach((row, y) => row.forEach((t, x) => (terrain[y + SHIFT.y][x + SHIFT.x] = t)))
  const sc: Scenario = { terrain, entities: small.entities.map((e) => ({ ...e, x: e.x + SHIFT.x, y: e.y + SHIFT.y })), event: {} }
  const eng = buildSandbox(sc, onto, lib.clone())
  const port = new ModPort(eng)
  const ref = key.startsWith('tile:') ? eng.world.cellRef('sandbox', FRONT.x + SHIFT.x, FRONT.y + SHIFT.y) : { e: key }
  eng.act(cell.verb, 'actor', ref, { instrument: cell.hand ? { e: 'held' } : null })
  return port.records[0]?.request
}

/** A spread-out sample: shuffled, then taken round-robin across targets so no single target dominates. */
export function pick(cells: Cell[], n: number, seed: number): Cell[] {
  const rng = new Rng(seed)
  const byTarget = new Map<string, Cell[]>()
  for (const c of rng.shuffle([...cells])) (byTarget.get(c.target) ?? byTarget.set(c.target, []).get(c.target)!).push(c)
  const queues = rng.shuffle([...byTarget.values()])
  const out: Cell[] = []
  while (out.length < n && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < n) out.push(q.shift()!)
  return out
}

export interface Checkpoint {
  at: string
  episodes: number
  label: string
  library: { patches: number; seq: number }
  coverage: { scope: string; undefined: number; total: number; allUndefined: number }
  window: { n: number; accepted: number; steps: number; ms: number; cost: number; failingTestRuns: number }
  spend: number
  harness: number
  lessons: number
  skills: number
}

/** The learning-curve numbers at this point, and a snapshot of the self-state to evaluate. */
export function checkpoint(modder: Modder, scope: Scope | undefined, scopeName: string, since: number, label: string): Checkpoint {
  const { library, state } = modder.opts
  const cov = sweep(library.fullOntology(), [...library.lib.rules.values()])
  const t = scope ? scopedTotals(cov.cells, scope) : { undefined: cov.totals.undefined, total: cov.cells.length }
  const recent = state.episodes().slice(since).filter((e) => e.outcome !== 'covered')
  const full = recent.map((e) => state.episode(e.id)!).filter(Boolean)
  const stats = state.stats()
  const cp: Checkpoint = {
    at: new Date().toISOString(),
    episodes: state.episodes().length,
    label,
    library: { patches: library.patchRules().length, seq: library.seq },
    coverage: { scope: scopeName, undefined: t.undefined, total: t.total, allUndefined: cov.totals.undefined },
    window: {
      n: full.length,
      accepted: full.filter((e) => e.outcome === 'accepted').length,
      steps: full.reduce((a, e) => a + e.usage.calls, 0) / Math.max(1, full.length),
      ms: full.reduce((a, e) => a + e.ms, 0) / Math.max(1, full.length),
      cost: full.reduce((a, e) => a + (e.usage.cost ?? 0), 0) / Math.max(1, full.length),
      failingTestRuns: full.reduce((a, e) => a + e.attempts.filter((x) => x.errors.length).length, 0) / Math.max(1, full.length),
    },
    spend: stats.spend,
    harness: stats.harness,
    lessons: stats.lessons,
    skills: stats.skills,
  }
  appendFileSync(join(state.dir, '..', 'curves.jsonl'), JSON.stringify(cp) + '\n')
  state.snapshot(label, { checkpoint: cp })
  return cp
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const flag = flags(argv)
  // positional [count] [seed] still work
  const n = Number(flag('n', /^\d+$/.test(argv[0] ?? '') ? argv[0] : '20'))
  const seed = Number(flag('seed', /^\d+$/.test(argv[1] ?? '') ? argv[1] : '1'))
  const scopeName = flag('scope', 'demo')!
  const every = Number(flag('checkpoint', '0'))
  const improveEvery = Number(flag('improve-every', '0'))
  const budget = Number(flag('budget', '0'))
  const withEngine = argv.includes('--engine')
  // the ladder (docs/rsi-experiments.md §5): this repository's commits as tasks, those of the windows up to --until
  const withLadder = argv.includes('--ladder')
  const ladderUntil = flag('until')
  const ladder = withLadder ? historyDefs().filter((d) => !ladderUntil || d.date < ladderUntil) : []
  const profile = flag('profile', 'offline') as 'live' | 'offline'
  const byHole = flag('by') === 'hole'
  const data = flag('data')
  const modder = openModder({ game: GAME, log: (l) => console.log(`  ${l}`), ...(data ? { data } : {}) })
  const model = modder.model
  if (!model) {
    console.error('no model configured: set LSW_MODEL_KEY + LSW_MODEL (e.g. in .env), or LSW_MODEL_SCRIPT')
    process.exit(1)
  }
  const { library, state } = modder.opts
  const onto: Ontology = library.fullOntology()
  const scope = scopeName === 'all' ? undefined : worldScope(buildOntology())
  const before = sweep(onto, [...library.lib.rules.values()])
  const open = before.cells.filter((c) => c.outcome === 'undefined')
  const cells = scope ? (byHole ? pickByHole(open, n, seed, scope) : pickWeighted(open, n, seed, scope)) : pick(open, n, seed)
  const runs = join(state.dir, '..', 'runs')
  mkdirSync(runs, { recursive: true })
  const runFile = join(runs, `${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`)
  let undefinedNow = before.totals.undefined
  const sources: TaskSource[] = [modder.taskSource(), ...(withEngine ? [engineSource()] : []), ...(withLadder ? [historySource()] : [])]
  const openNow = scope ? `${scopedTotals(before.cells, scope).undefined} undefined in ${scopeName}` : `${open.length} undefined`
  console.log(`${openNow}; taking ${cells.length} (seed ${seed}) with ${model.name}`)
  let since = state.episodes().length
  if (every) checkpoint(modder, scope, scopeName, since, `ckpt-${state.episodes().length}-start-${Date.now().toString(36)}`)
  const counts: Record<string, number> = {}
  // an engine or ladder task, where a container can run it
  const work = async (kind: string, t: WorkspaceTask | undefined, more = '') => {
    if (!t) return console.log(`  ${kind} task skipped: no container here, and an unattended agent does not run its code on this machine`)
    try {
      const r = await runAgent(t.task, { model, state, log: (l) => console.log(`  ${l}`) })
      console.log(`  ${kind} ${t.task.id}${more}: ${r.outcome}`)
    } finally {
      await t.dispose()
    }
  }
  for (const [i, cell] of cells.entries()) {
    if (budget && state.stats().spend >= budget) {
      console.log(`budget of $${budget} reached ($${state.stats().spend.toFixed(2)}): stopping`)
      break
    }
    const req = cellRequest(cell, library.fullOntology(), library.lib)
    const label = `[${i + 1}/${cells.length}] ${cell.verb} ${cell.hand || '(empty hand)'} → ${cell.target}`
    if (!req) {
      console.log(`${label}: already answered`)
      counts.answered = (counts.answered ?? 0) + 1
      continue
    }
    const t0 = Date.now()
    const reply = await modder.resolve({ request: req }, profile) // offline: nobody waits, the agent, quality first
    counts[reply.outcome] = (counts[reply.outcome] ?? 0) + 1
    const ep = reply.episode ? state.episode(reply.episode) : undefined
    // how far the answer reaches: the undefined cells it answered, this one and the rest of its class
    const cov = sweep(library.fullOntology(), [...library.lib.rules.values()])
    const answered = undefinedNow - cov.totals.undefined
    undefinedNow = cov.totals.undefined
    const row = {
      step: i + 1,
      cell,
      summary: req.summary,
      kind: req.event.kind,
      host: req.event.host?.type,
      hole: req.hole.rule,
      outcome: reply.outcome,
      episode: reply.episode,
      rules: ep?.rules ?? [],
      attempts: ep?.attempts.length,
      firstValid: !!ep?.attempts[0] && !ep.attempts[0].errors.length,
      calls: ep?.usage.calls,
      cost: ep?.usage.cost,
      ms: Date.now() - t0,
      answered,
      undefined: undefinedNow,
    }
    appendFileSync(runFile, JSON.stringify(row) + '\n')
    console.log(`${label}: ${reply.outcome}${reply.diagnostics?.length ? ` (${reply.diagnostics[0].slice(0, 200)})` : ''} · ${(row.ms / 1000).toFixed(1)} s · answers ${answered} cell(s) · ${undefinedNow} undefined`)
    const done = i + 1
    // stage 2: an engine task now and then (the world's own code, as an SWE task)
    if (withEngine && done % 5 === 0) {
      const defs = engineTaskDefs()
      if (!defs.length) console.log('  engine task skipped: there are none (games/openworld/ai/tasks/engine)')
      else await work('engine', await engineTask(defs[Math.floor(done / 5 - 1) % defs.length]))
    }
    // and a ladder task every other step, one rung after another
    if (ladder.length && done % 2 === 0) {
      const def = ladder[Math.floor(done / 2 - 1) % ladder.length]
      await work('ladder', await historyTask(def), ` (${def.rung})`)
    }
    if (improveEvery && done % improveEvery === 0) {
      await modder.settled()
      const select = Number(flag('select', '8'))
      const r = await improve({ model, state, sources, select, confirm: Number(flag('confirm', '8')), log: (l) => console.log(`  ${l}`) })
      console.log(`  outer loop: ${r.proposal.kind} ${r.accepted ? 'KEPT' : 'rejected'} — ${r.reason}`)
    }
    if (every && done % every === 0) {
      await modder.settled()
      const cp = checkpoint(modder, scope, scopeName, since, `ckpt-${state.episodes().length}`)
      since = state.episodes().length
      console.log(`  checkpoint ${cp.label}: ${cp.coverage.undefined}/${cp.coverage.total} undefined, window ${cp.window.accepted}/${cp.window.n} accepted, $${cp.spend.toFixed(2)} spent`)
    }
  }
  await modder.settled()
  const after = sweep(library.fullOntology(), [...library.lib.rules.values()])
  const undefinedIn = (cov: typeof after) => (scope ? scopedTotals(cov.cells, scope).undefined : cov.totals.undefined)
  console.log('\noutcomes', counts)
  console.log(`undefined interactions${scope ? ` in ${scopeName}` : ''}: ${undefinedIn(before)} → ${undefinedIn(after)}`)
  console.log('self-state', state.stats())
  console.log(`steps: ${runFile}`)
}

// ---------------------------------------------------------------- one outer-loop turn
async function improveTurn(argv: string[]): Promise<void> {
  const flag = flags(argv)
  const modder = openModder({ game: GAME, log: (l) => console.log(`  ${l}`) })
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
}

// ---------------------------------------------------------------- a run, summarised
function report(dir = 'var/curriculum-em'): void {
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
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [sub, ...rest] = process.argv.slice(2)
  if (sub === 'improve') await improveTurn(rest)
  else if (sub === 'report') report(rest[0])
  else await main()
}
