// npm run agent -- <command>
//   swe --instances <file.json|jsonl> --state <dir> [--out predictions.jsonl] [--env local|docker]
//       [--image <template>] [--cache <dir>] [--work <dir>] [--limit n] [--hints] [--label name]
//         solve SWE-bench-style instances with a self-state (read-only) → predictions.jsonl
//   task --dir <repo> --issue <file> [--tests <cmd>] --state <dir> [--record]
//         work one ad-hoc task in a local repository
//   preset <naive|tuned> --state <dir>
//         reset a self-state's harness to a starting point (a run starts from naive)
// Model: LSW_MODEL_KEY + LSW_MODEL (+ LSW_MODEL_URL, LSW_MODEL_PROVIDERS), read from <repo>/.env.

import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LocalEnv } from './env.ts'
import { runAgent } from './loop.ts'
import { modelFromEnv } from './model.ts'
import { applyPreset, type Preset } from './presets.ts'
import { SelfState } from './state.ts'
import { solve, type SweInstance } from './swe.ts'

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
  const state = SelfState.open(resolve(need('state')))
  if (cmd === 'swe') {
    const out = resolve(flag('out') ?? 'predictions.jsonl')
    const all = readInstances(need('instances'))
    const items = all.slice(0, Number(flag('limit') ?? all.length))
    const tmp = join(REPO, 'var', 'swe')
    let cost = 0
    for (const inst of items) {
      try {
        const p = await solve(inst, {
          model,
          state,
          env: (flag('env') as 'local' | 'docker') ?? 'local',
          image: flag('image'),
          cache: resolve(flag('cache') ?? join(tmp, 'cache')),
          work: resolve(flag('work') ?? join(tmp, 'work')),
          hints: has('hints'),
          label: flag('label'),
          log,
        })
        cost += p.cost
        appendFileSync(out, JSON.stringify({ instance_id: p.instance_id, model_name_or_path: p.model_name_or_path, model_patch: p.model_patch }) + '\n')
        log(`${inst.instance_id}: ${p.outcome}, ${p.model_patch.split('\n').length} diff lines, $${p.cost.toFixed(3)}`)
      } catch (err) {
        log(`${inst.instance_id}: error — ${(err as Error).message}`)
      }
    }
    log(`done: ${items.length} instances → ${out} ($${cost.toFixed(2)})`)
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
