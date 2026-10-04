// The offline inner loop: undefined outcomes of the player's acts, handed to the modder one by one as if players
// had tried them (offline profile: the SWE-style agent works each as a repository). The shared
// library and the self-state grow exactly as they do online (same files). Optionally:
// checkpoints (learning-curve numbers + a self-state snapshot), the outer loop every N episodes,
// and a spending cap. Do not run it while the service is running on the same data directory.
//
//   npm run curriculum -- [--n 20] [--seed 1] [--scope demo|all] [--checkpoint 10]
//                         [--improve-every 10] [--budget 5] [--engine]
//                         [--profile live|offline] [--by hole] [--data <dir>]
//   --profile live answers as a player would get it (one call; review after shipping; a failure
//   escalates to the offline agent in the background); --by hole spreads the sample over the
//   holes the cells reach. Every step is a row of <data>/runs/<time>.jsonl, with the coverage
//   after it: how many undefined cells the patch answered (its class reaches further than the cell).
//   (model from .env / the environment, as for `npm run modder`)

import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ModPort, Rng, buildSandbox, type ModRequest, type Ontology, type RuleLibrary, type Scenario } from '@lsw/engine'
import { buildOntology } from '@lsw/content'
import { improve, runAgent, type TaskSource } from '@lsw/agent'
import { openModder, type Modder } from '@lsw/modder'
import { FRONT, ORIGIN, sweep, targets, type Cell } from './coverage.ts'
import { engineSource, engineTask, engineTaskDefs } from './engine-tasks.ts'
import { pickByHole, pickWeighted, scopedTotals, worldScope, type Scope } from './scope.ts'

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
  const ref = key.startsWith('tile:') ? { tile: { map: 'sandbox', x: FRONT.x + SHIFT.x, y: FRONT.y + SHIFT.y } } : { e: key }
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
  const flag = (k: string, d?: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d)
  // positional [count] [seed] still work
  const n = Number(flag('n', /^\d+$/.test(argv[0] ?? '') ? argv[0] : '20'))
  const seed = Number(flag('seed', /^\d+$/.test(argv[1] ?? '') ? argv[1] : '1'))
  const scopeName = flag('scope', 'demo')!
  const every = Number(flag('checkpoint', '0'))
  const improveEvery = Number(flag('improve-every', '0'))
  const budget = Number(flag('budget', '0'))
  const withEngine = argv.includes('--engine')
  const profile = flag('profile', 'offline') as 'live' | 'offline'
  const byHole = flag('by') === 'hole'
  const data = flag('data')
  const modder = openModder({ log: (l) => console.log(`  ${l}`), ...(data ? { data } : {}) })
  if (!modder.model) {
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
  const sources: TaskSource[] = [modder.taskSource(), ...(withEngine ? [engineSource()] : [])]
  console.log(`${scope ? `${scopedTotals(before.cells, scope).undefined} undefined in ${scopeName}` : `${open.length} undefined`}; taking ${cells.length} (seed ${seed}) with ${modder.model.name}`)
  let since = state.episodes().length
  if (every) checkpoint(modder, scope, scopeName, since, `ckpt-${state.episodes().length}-start-${Date.now().toString(36)}`)
  const counts: Record<string, number> = {}
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
    // stage 2: an engine task now and then (the world's own code, as an SWE task)
    if (withEngine && (i + 1) % 5 === 0) {
      const defs = engineTaskDefs()
      const t = await engineTask(defs[Math.floor((i + 1) / 5 - 1) % defs.length])
      if (!t) console.log('  engine task skipped: no container here, and an unattended agent does not run its code on this machine')
      else
        try {
          const r = await runAgent(t.task, { model: modder.model, state, log: (l) => console.log(`  ${l}`) })
          console.log(`  engine ${t.task.id}: ${r.outcome}`)
        } finally {
          await t.dispose()
        }
    }
    const done = i + 1
    if (improveEvery && done % improveEvery === 0) {
      await modder.settled()
      const r = await improve({ model: modder.model, state, sources, select: Number(flag('select', '8')), confirm: Number(flag('confirm', '8')), log: (l) => console.log(`  ${l}`) })
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
  console.log('\noutcomes', counts)
  console.log(`undefined interactions${scope ? ` in ${scopeName}` : ''}: ${scope ? scopedTotals(before.cells, scope).undefined : before.totals.undefined} → ${scope ? scopedTotals(after.cells, scope).undefined : after.totals.undefined}`)
  console.log('self-state', state.stats())
  console.log(`steps: ${runFile}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
