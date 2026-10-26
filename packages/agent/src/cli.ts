// npm run agent -- <command>
//   swe --instances <file.json|jsonl> --state <dir> [--out predictions.jsonl] [--env local|docker]
//       [--image <template>] [--cache <dir>] [--work <dir>] [--limit n] [--hints] [--label name]
//       [--workers n] [--ablate memory,skills,harness] [--resume]
//         solve SWE-bench-style instances with a self-state (read-only) → predictions.jsonl, a record
//         per instance (<out>.runs.jsonl: steps, tokens, cost, time, providers) and the run's manifest
//         (<out>.manifest.json: model, provider pin, state, harness, ablations, instances, the agent's code)
//   task --dir <repo> --issue <file> [--tests <cmd>] --state <dir> [--record]
//         work one ad-hoc task in a local repository
//   preset <naive|tuned> --state <dir>
//         reset a self-state's harness to a starting point (a run starts from naive)
// Model: LSW_MODEL_KEY + LSW_MODEL (+ LSW_MODEL_URL, LSW_MODEL_PROVIDERS), read from <repo>/.env.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LocalEnv } from './env.ts'
import { runAgent } from './loop.ts'
import { modelFromEnv, pinFromEnv } from './model-node.ts'
import { applyPreset, type Preset } from './presets.ts'
import { SelfState, type Ablation } from './state.ts'
import { IMAGE_TEMPLATE, runInstances, sha256, type SweInstance } from './swe.ts'

const REPO = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
if (existsSync(join(REPO, '.env'))) process.loadEnvFile(join(REPO, '.env'))

const argv = process.argv.slice(2)
const flag = (k: string) => {
  const i = argv.indexOf(`--${k}`)
  return i < 0 ? undefined : argv[i + 1]
}
const has = (k: string) => argv.includes(`--${k}`)
const cmd = argv[0]
const log = (l: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${l}`)

function need(k: string): string {
  const v = flag(k)
  if (!v) throw new Error(`--${k} is required`)
  return v
}

/** The agent's own code as one hash: a run resumed after it changed would mix two agents. */
function agentCodeHash(): string {
  const dir = join(REPO, 'packages', 'agent', 'src')
  return sha256(readdirSync(dir).filter((f) => f.endsWith('.ts')).sort().map((f) => `${f}\n${readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n')}`).join('\n'))
}

function readInstances(file: string): SweInstance[] {
  const text = readFileSync(file, 'utf8').trim()
  return text.startsWith('[') ? JSON.parse(text) : text.split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

async function main(): Promise<void> {
  if (cmd === 'preset') {
    const state = SelfState.open(resolve(need('state')))
    applyPreset(state, argv[1] as Preset)
    console.log(`${argv[1]} → ${state.dir} (harness v${state.harness().version})`)
    return
  }
  const model = modelFromEnv()
  if (!model) throw new Error('no model: set LSW_MODEL_KEY and LSW_MODEL (e.g. in .env)')
  const ablate = (flag('ablate') ?? '').split(',').map((s) => s.trim()).filter(Boolean) as Ablation[]
  for (const a of ablate) if (!['memory', 'skills', 'harness'].includes(a)) throw new Error(`--ablate: unknown part "${a}" (memory, skills, harness)`)
  const state = SelfState.open(resolve(need('state')), undefined, ablate)
  if (cmd === 'swe') {
    const out = resolve(flag('out') ?? 'predictions.jsonl')
    const file = resolve(need('instances'))
    const all = readInstances(file)
    const items = all.slice(0, Number(flag('limit') ?? all.length))
    const tmp = join(REPO, 'var', 'swe')
    const env = (flag('env') as 'local' | 'docker') ?? 'local'
    // what ties the predictions to one model and one self-state: a resumed run must match it
    const manifest = {
      started: new Date().toISOString(),
      model: model.name,
      backend: process.env.LSW_MODEL_BACKEND || 'openrouter',
      pin: pinFromEnv() ?? null,
      state: state.dir,
      harness: state.harness().version,
      ablated: ablate,
      instances: file,
      instancesSha256: sha256(readFileSync(file, 'utf8')),
      count: items.length,
      env,
      image: flag('image') ?? IMAGE_TEMPLATE,
      hints: has('hints'),
      label: flag('label') ?? null,
      agentCode: agentCodeHash(),
    }
    const r = await runInstances(items, {
      model,
      state,
      env,
      image: flag('image'),
      cache: resolve(flag('cache') ?? join(tmp, 'cache')),
      work: resolve(flag('work') ?? join(tmp, 'work')),
      hints: has('hints'),
      label: flag('label'),
      log,
      out,
      workers: Number(flag('workers') ?? 1),
      resume: has('resume'),
      manifest,
    })
    log(`done: ${r.done} instances, ${r.failed} failed, ${r.skipped} done before → ${out} ($${r.cost.toFixed(2)})`)
    return
  }
  if (cmd === 'task') {
    const dir = resolve(need('dir'))
    const r = await runAgent(
      { id: flag('id') ?? 'task', kind: flag('kind') ?? 'adhoc', statement: readFileSync(need('issue'), 'utf8'), env: new LocalEnv(dir), localRun: true, tests: flag('tests') ? { command: flag('tests')! } : undefined },
      { model, state, record: has('record'), log },
    )
    console.log(r.diff ?? '')
    log(`${r.outcome} ($${(r.episode.usage.cost ?? 0).toFixed(3)})`)
    return
  }
  throw new Error(`unknown command "${cmd}" (swe | task | preset)`)
}

await main()
