// The RSI experiments' milestones (docs/rsi-experiments.md §6): at each tag `world-vN` cut on main, one arm's turn —
// the window's new ladder tasks mined, the arm's previous snapshot and the naive start tried on them (H4: tasks from
// the snapshot's future), the curriculum run for the milestone's budget, the snapshot taken, and the benchmark's
// commands written for the team. Arm G works the growing world (the tag's); arm F the same budget on `world-v0`'s
// world and window 0 only (H3) — from a checkout of `world-v0` of its own (`--world`).
//
//   npm run rsi -- plan <tag> [--arm G|F]                   what a milestone would do (no model)
//   npm run rsi -- milestone <tag> --arm G|F [--episodes 200] [--world <checkout>] [--state <dir>] [--no-pin]
//   npm run rsi -- heldout <tag> --arm G|F [--state <dir>]  only step 3 (the window's tasks, snapshot and naive)
//   npm run rsi -- report [--root var/rsi]                  the paper's tables from what the milestones left (rsi-report.ts)
//
// A paper run is frozen (§3): it refuses to start without LSW_MODEL_PIN, unless --no-pin (a smoke test).

import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SelfState, applyPreset, modelFromEnv, pinFromEnv, runAgent } from '@openworld/ai'
import { REPO } from './engine-tasks.ts'
import { historyDefs, historyTask, type HistoryDef } from './ladder.ts'
import { report } from '../../tools/src/rsi-report.ts'

export type Arm = 'G' | 'F'

export interface Milestone {
  tag: string
  commit: string
  /** the tag's commit's date (ISO): the window's end */
  date: string
}

export interface Plan {
  arm: Arm
  milestone: Milestone
  previous?: Milestone
  first: Milestone
  /** the ladder tasks of this milestone's window: from its future for the previous snapshot (H4) */
  window: HistoryDef[]
  /** the ladder tasks the curriculum may give: G every window so far, F window 0's only */
  curriculum: HistoryDef[]
  /** the snapshot H4 tries on the window, if the arm has one from the previous milestone */
  heldoutSnapshot?: string
}

function git(args: string[]): string {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr.trim()}`)
  return r.stdout.trim()
}

/** The milestones: the tags world-v*, by their commits' dates. */
export function milestones(): Milestone[] {
  return git(['tag', '-l', 'world-v*'])
    .split('\n')
    .filter(Boolean)
    .map((tag) => ({ tag, commit: git(['rev-list', '-n', '1', tag]), date: git(['log', '-1', '--format=%cI', tag]) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** What a milestone's turn of one arm covers, from the milestones and the ladder's tasks (pure: tested). */
export function planOf(all: Milestone[], tag: string, arm: Arm, defs: HistoryDef[], snapshots: string[]): Plan {
  const i = all.findIndex((m) => m.tag === tag)
  if (i < 0) throw new Error(`no milestone ${tag} (tags: ${all.map((m) => m.tag).join(', ') || 'none'})`)
  const milestone = all[i]
  const previous = i > 0 ? all[i - 1] : undefined
  const first = all[0]
  const inWindow = (d: HistoryDef, from: string | undefined, to: string) => (!from || d.date > from) && d.date <= to
  const window = defs.filter((d) => inWindow(d, previous?.date, milestone.date))
  const curriculum = arm === 'G' ? defs.filter((d) => d.date <= milestone.date) : defs.filter((d) => d.date <= first.date)
  const heldoutSnapshot = previous && snapshots.includes(previous.tag) ? previous.tag : undefined
  return { arm, milestone, previous, first, window, curriculum, heldoutSnapshot }
}

const stateDir = (arm: Arm, o?: string) => resolve(o ?? join(REPO, 'var', 'rsi', arm))

/** H4: the previous snapshot and the naive start on the window's tasks, each a throwaway fork, nothing recorded. */
async function heldout(plan: Plan, dir: string): Promise<void> {
  const model = modelFromEnv()
  if (!model) throw new Error('no model')
  const state = SelfState.open(join(dir, 'modder-state'))
  const arms: [string, SelfState][] = []
  if (plan.heldoutSnapshot) arms.push([plan.heldoutSnapshot, SelfState.open(join(state.dir, 'snapshots', plan.heldoutSnapshot)).fork()])
  const naive = state.fork()
  applyPreset(naive, 'naive')
  arms.push(['naive', SelfState.open(join(naive.dir), undefined, ['memory', 'skills'])])
  const out = join(dir, 'heldout', `${plan.milestone.tag}.jsonl`)
  mkdirSync(join(dir, 'heldout'), { recursive: true })
  for (const def of plan.window) {
    for (const [label, s] of arms) {
      const t = await historyTask(def)
      if (!t) throw new Error('the ladder’s tasks run only in a container: no Docker here')
      try {
        const r = await runAgent(t.task, { model, state: s, record: false })
        appendFileSync(out, JSON.stringify({ task: def.id, rung: def.rung, date: def.date, arm: label, outcome: r.outcome, steps: r.episode.usage.calls, cost: r.episode.usage.cost ?? 0 }) + '\n')
        console.log(`  ${def.id} ${def.rung} · ${label}: ${r.outcome}`)
      } finally {
        await t.dispose()
      }
    }
  }
}

function describe(plan: Plan): string {
  const rungs = (ds: HistoryDef[]) => Object.entries(ds.reduce<Record<string, number>>((m, d) => ({ ...m, [d.rung]: (m[d.rung] ?? 0) + 1 }), {})).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'
  return [
    `arm ${plan.arm} at ${plan.milestone.tag} (${plan.milestone.commit.slice(0, 10)}, ${plan.milestone.date})`,
    `  window: ${plan.window.length} ladder tasks (${rungs(plan.window)}) since ${plan.previous?.tag ?? 'the start'}`,
    `  held-out: ${plan.heldoutSnapshot ? `snapshot ${plan.heldoutSnapshot} and naive` : 'naive only (no earlier snapshot)'} on the window`,
    `  curriculum: world holes ${plan.arm === 'G' ? `at ${plan.milestone.tag}` : `at ${plan.first.tag}`}, ladder tasks ${plan.curriculum.length} (${rungs(plan.curriculum)})`,
    `  snapshot: ${plan.milestone.tag}`,
  ].join('\n')
}

function handoff(plan: Plan, dir: string, snapshot: string): string {
  const out = join(dir, 'runs', plan.milestone.tag, 'RUN.md')
  mkdirSync(join(dir, 'runs', plan.milestone.tag), { recursive: true })
  const run = join(dir, 'runs', plan.milestone.tag)
  const md = `# ${plan.arm} at ${plan.milestone.tag}: the benchmark

The snapshot: \`${snapshot}\`. The measured pool is the fresh pool and B (docs/rsi-experiments.md §4.1), each graded by its
own harness; every run frozen to one provider (LSW_MODEL_PIN, as in this snapshot's manifest).

\`\`\`bash
python bench/pool.py fetch bench/pools/fresh-v0.json && python bench/pool.py fetch bench/pools/post-k3.json
cat var/bench/fresh-v0.instances.jsonl var/bench/post-k3.instances.jsonl > ${run}/instances.jsonl
LSW_MODEL_PIN=${pinFromEnv()?.providers.join(',') ?? 'moonshotai'} npm run agent -- swe --instances ${run}/instances.jsonl --state ${snapshot} --env docker --workers 4 --out ${run}/preds.jsonl --label lsw-${plan.arm}-${plan.milestone.tag}
python bench/evaluate.py bench/pools/fresh-v0.json ${run}/preds.jsonl --run-id ${plan.arm}-${plan.milestone.tag}-fresh
python bench/evaluate.py bench/pools/post-k3.json ${run}/preds.jsonl --run-id ${plan.arm}-${plan.milestone.tag}-b
\`\`\`

At the last milestone, the same with \`--ablate memory\`, \`--ablate skills\`, \`--ablate harness\`, and three runs of the
plain snapshot (§6.3). The step cap at 40 is a copy of the snapshot with \`agent.maxSteps\` set back to 40.
`
  writeFileSync(out, md)
  return out
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const flag = (k: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : undefined)
  if (existsSync(join(REPO, '.env'))) process.loadEnvFile(join(REPO, '.env'))
  const [cmd, tag] = argv
  if (cmd === 'report') {
    const root = resolve(flag('root') ?? join(REPO, 'var', 'rsi'))
    const md = report(root)
    writeFileSync(join(root, 'report.md'), md)
    console.log(md)
    return
  }
  const arm = (flag('arm') ?? 'G') as Arm
  if (!tag || !['plan', 'milestone', 'heldout'].includes(cmd)) throw new Error('npm run rsi -- plan|milestone|heldout <tag> [--arm G|F]')
  const dir = stateDir(arm, flag('state'))
  const snaps = existsSync(join(dir, 'modder-state', 'snapshots')) ? SelfState.open(join(dir, 'modder-state')).snapshots() : []
  const plan = planOf(milestones(), tag, arm, historyDefs(), snaps)
  console.log(describe(plan))
  if (cmd === 'plan') return
  if (!pinFromEnv() && !argv.includes('--no-pin')) throw new Error('a paper run is frozen to one provider: set LSW_MODEL_PIN (or --no-pin for a smoke test)')
  mkdirSync(dir, { recursive: true })
  if (plan.window.length) await heldout(plan, dir)
  if (cmd === 'heldout') return
  // the curriculum: a world hole each step, a ladder task every other step (≈ 1.5 episodes a step), the outer loop every 10
  const episodes = Number(flag('episodes') ?? 200)
  const world = resolve(flag('world') ?? (arm === 'F' ? join(REPO, 'var', 'rsi', 'world-v0') : REPO))
  // (the driver moved from tools/ to ai/; an older checkout keeps it in tools/)
  if (!['ai', 'tools'].some((d) => existsSync(join(world, 'games', 'openworld', d, 'src', 'curriculum.ts')))) throw new Error(`${world} is no checkout of this repository (arm F: git worktree add ${world} ${plan.first.tag}, then npm ci there)`)
  const until = (arm === 'G' ? plan.milestone : plan.first).date
  const steps = Math.max(1, Math.round(episodes / 1.5))
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'curriculum', '--', '--n', String(steps), '--seed', String(milestones().findIndex((m) => m.tag === tag) + 1), '--ladder', '--until', until, '--improve-every', '10', '--data', dir], { cwd: world, stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) throw new Error(`the curriculum stopped (${r.status})`)
  const state = SelfState.open(join(dir, 'modder-state'))
  const snapshot = state.snapshot(tag, { arm, tag, commit: plan.milestone.commit, date: plan.milestone.date, world: git(['-C', world, 'rev-parse', 'HEAD']), pin: pinFromEnv() ?? null, window: plan.window.map((d) => d.id) })
  console.log(`snapshot ${snapshot}\nthe benchmark: ${handoff(plan, dir, snapshot)}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
