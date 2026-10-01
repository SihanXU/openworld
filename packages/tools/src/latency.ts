// Latency bench for the modder: the same curriculum sample, a fresh library and self-state, one
// model and one harness configuration. Reports what the player waits for (the reply), where it
// goes (calls, output and reasoning tokens), how often the first answer is already valid, and cost.
//
//   npm run latency -- [--n 5] [--seed 1] [--model <id>] [--providers together,parasail]
//   (the live profile as the harness defines it; --rounds, --reasoning, --no-brief, --model-tests,
//   --no-hedge override it, to compare configurations)
//
// Review and reflection are off: they are not on the player's critical path (and cost money).

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { modelFromEnv, openModder, type ChatOptions, type WorldEpisode } from '@lsw/modder'
import { sweep } from './coverage.ts'
import { cellRequest, pick } from './curriculum.ts'

function args(argv: string[]) {
  const get = (k: string) => {
    const i = argv.indexOf(`--${k}`)
    return i < 0 ? undefined : argv[i + 1]
  }
  return {
    model: get('model'),
    n: Number(get('n') ?? 5),
    seed: Number(get('seed') ?? 1),
    rounds: get('rounds') === undefined ? undefined : Number(get('rounds')),
    noBrief: argv.includes('--no-brief'),
    modelTests: argv.includes('--model-tests'),
    noHedge: argv.includes('--no-hedge'),
    reasoning: get('reasoning') as ChatOptions['reasoning'],
    sort: get('sort'),
    providers: get('providers'),
  }
}

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? 0

async function main(): Promise<void> {
  const a = args(process.argv.slice(2))
  // load .env (via open.ts), then build the model with this run's overrides
  openModder({ data: mkdtempSync(join(tmpdir(), 'lsw-warm-')), model: null })
  const model = modelFromEnv({ ...process.env, ...(a.model ? { LSW_MODEL: a.model } : {}), ...(a.sort ? { LSW_MODEL_SORT: a.sort } : {}), ...(a.providers ? { LSW_MODEL_PROVIDERS: a.providers } : {}) })
  if (!model) throw new Error('no model: set LSW_MODEL_KEY (in .env) and --model')
  const modder = openModder({ data: mkdtempSync(join(tmpdir(), 'lsw-latency-')), model })
  const { library, state } = modder.opts
  const h = state.harness()
  state.setHarness(
    {
      ...h,
      design: {
        ...h.design,
        ...(a.rounds !== undefined ? { toolRounds: a.rounds } : {}),
        ...(a.reasoning ? { reasoning: a.reasoning } : {}),
        ...(a.noBrief ? { brief: false } : {}),
        ...(a.modelTests ? { tests: 'model' as const } : {}),
        ...(a.noHedge ? { hedgeMs: 0, deadlineMs: 0 } : {}),
      },
      review: { ...h.review, enabled: false },
      reflect: { ...h.reflect, enabled: false },
      escalate: false,
    },
    'latency bench',
  )
  const d = state.harness().design
  const label = `${model.name} rounds=${d.toolRounds}${d.brief ? ' brief' : ''} reasoning=${d.reasoning ?? 'default'} tests=${d.tests}${d.hedgeMs ? ` hedge=${d.hedgeMs}` : ''}${a.sort ? ` sort=${a.sort}` : ''}${a.providers ? ` providers=${a.providers}` : ''}`
  console.log(`# ${label}`)
  const cells = pick(sweep(library.fullOntology(), [...library.lib.rules.values()]).cells.filter((c) => c.outcome === 'undefined'), a.n, a.seed)
  const eps: WorldEpisode[] = []
  for (const cell of cells) {
    const req = cellRequest(cell, library.fullOntology(), library.lib)
    if (!req) continue
    const reply = await modder.resolve({ request: req }, 'live')
    const ep = state.episode(reply.episode!)! as WorldEpisode
    eps.push(ep)
    const calls = ep.calls ?? []
    const rule = ep.patch?.artifacts.find((x) => x.kind === 'rule')
    console.log(
      `${ep.outcome.padEnd(8)}${calls.some((c) => c.hedged) ? ' (hedged)' : ''} ${(ep.ms / 1000).toFixed(1).padStart(6)} s  calls ${calls.length}  attempts ${ep.attempts.length}  out ${calls.map((c) => c.output).join('+')}  reasoning ${calls.map((c) => c.reasoning ?? '?').join('+')}  per-call ${calls.map((c) => (c.ms / 1000).toFixed(1)).join('/')} s  via ${[...new Set(calls.map((c) => c.provider))].join(',')}  — ${req.summary}`,
    )
    if (rule?.kind === 'rule') console.log(`         ${rule.rule.id}: ${rule.rule.doc ?? ''}${rule.rule.do.every((e) => ['log', 'say', 'vfx'].includes(e.op)) ? '  [narrates only]' : ''}`)
    for (const n of ep.attempts.at(-1)?.derived ?? []) console.log(`         · ${n}`)
    if (ep.outcome === 'failed') console.log(`         ${ep.attempts.at(-1)?.errors.slice(0, 2).join(' | ') ?? ep.error}`)
  }
  const ms = eps.map((e) => e.ms / 1000)
  const ok = eps.filter((e) => e.outcome === 'accepted')
  const firstValid = eps.filter((e) => e.attempts[0] && !e.attempts[0].errors.length).length
  const cost = eps.reduce((s, e) => s + (e.usage.cost ?? 0), 0)
  console.log(
    `\nSUMMARY ${label}: accepted ${ok.length}/${eps.length} · first answer valid ${firstValid}/${eps.length} · median ${pct(ms, 0.5).toFixed(1)} s · max ${Math.max(...ms).toFixed(1)} s · calls/ep ${(eps.reduce((s, e) => s + e.usage.calls, 0) / eps.length).toFixed(1)} · $${(cost / eps.length).toFixed(3)}/ep`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
