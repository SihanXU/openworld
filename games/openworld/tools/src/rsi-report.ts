// The RSI experiments' tables for the paper (docs/rsi-experiments.md §9), from what the milestones left:
//   var/rsi/<arm>/runs/<tag>/preds.jsonl.<run>.resolved.jsonl   the benchmark's verdicts (bench/evaluate.py)
//   var/rsi/<arm>/runs/<tag>/preds.jsonl.runs.jsonl             each instance's steps and cost (npm run agent -- swe)
//   var/rsi/<arm>/heldout/<tag>.jsonl                           the window's ladder tasks, snapshot and naive (npm run rsi)
//   var/rsi/<arm>/modder-state/journal.jsonl                    the outer loop's proposals
// An arm is any directory under var/rsi with runs: G, F, and the reference arms (naive, tuned) and ablations
// (G-memory, …) as the team names them. Comparisons are paired, task by task (McNemar's exact test).

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const readJsonl = <T>(f: string): T[] => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as T) : [])
const dirs = (d: string) => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [])

export interface Run {
  arm: string
  tag: string
  /** task → resolved, over every pool graded for this run */
  resolved: Map<string, boolean>
  steps: number[]
  cost: number[]
}

/** The runs under a root: one per arm and milestone that has verdicts. */
export function runs(root: string): Run[] {
  const out: Run[] = []
  for (const arm of dirs(root)) {
    for (const tag of dirs(join(root, arm, 'runs'))) {
      const d = join(root, arm, 'runs', tag)
      const resolved = new Map<string, boolean>()
      for (const f of readdirSync(d).filter((f) => f.endsWith('.resolved.jsonl'))) for (const r of readJsonl<{ instance_id: string; resolved: boolean }>(join(d, f))) resolved.set(r.instance_id, r.resolved)
      if (!resolved.size) continue
      const recs = readJsonl<{ steps?: number; cost?: number; outcome: string }>(join(d, 'preds.jsonl.runs.jsonl')).filter((r) => r.outcome !== 'error')
      out.push({ arm, tag, resolved, steps: recs.map((r) => r.steps ?? 0), cost: recs.map((r) => r.cost ?? 0) })
    }
  }
  return out.sort((a, b) => a.arm.localeCompare(b.arm) || a.tag.localeCompare(b.tag))
}

/** McNemar's exact test on the tasks two runs share: who solved what the other did not, and the two-sided p. */
export function mcnemar(a: Map<string, boolean>, b: Map<string, boolean>): { n: number; aOnly: number; bOnly: number; diff: number; p: number } {
  const shared = [...a.keys()].filter((k) => b.has(k))
  const aOnly = shared.filter((k) => a.get(k) && !b.get(k)).length
  const bOnly = shared.filter((k) => !a.get(k) && b.get(k)).length
  const m = aOnly + bOnly
  let tail = 0
  let c = 1 // C(m, 0)
  for (let k = 0; k <= Math.min(aOnly, bOnly); k++) {
    tail += c
    c = (c * (m - k)) / (k + 1)
  }
  const p = m ? Math.min(1, 2 * tail * 0.5 ** m) : 1
  return { n: shared.length, aOnly, bOnly, diff: shared.length ? (aOnly - bOnly) / shared.length : 0, p }
}

const pct = (x: number) => `${(100 * x).toFixed(1)}`
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

/** T-R1: each run's resolve rate, cost and steps, and how it compares, task by task, with the baseline run. */
export function tableR1(rs: Run[], baseline = { arm: 'naive', tag: 'world-v0' }): string {
  const base = rs.find((r) => r.arm === baseline.arm && r.tag === baseline.tag)
  const rows = ['| Arm | Milestone | Tasks | Resolved | % | Cost / task | Steps / task | vs ' + `${baseline.arm} @ ${baseline.tag}` + ' (pp, p) |', '|---|---|---|---|---|---|---|---|']
  for (const r of rs) {
    const solved = [...r.resolved.values()].filter(Boolean).length
    const cmp = base && base !== r ? mcnemar(r.resolved, base.resolved) : undefined
    rows.push(`| ${r.arm} | ${r.tag} | ${r.resolved.size} | ${solved} | ${pct(solved / r.resolved.size)} | $${mean(r.cost).toFixed(3)} | ${mean(r.steps).toFixed(1)} | ${cmp ? `${cmp.diff >= 0 ? '+' : ''}${pct(cmp.diff)} (p = ${cmp.p.toFixed(3)}, ${cmp.aOnly}/${cmp.bOnly})` : '—'} |`)
  }
  return rows.join('\n')
}

/** T-R3: the window's ladder tasks, per rung: the snapshot from before the window against the naive start. */
export function tableR3(root: string): string {
  const rows = ['| Arm | Milestone | Rung | Tasks | Snapshot % | Naive % |', '|---|---|---|---|---|---|']
  for (const arm of dirs(root)) {
    const hd = join(root, arm, 'heldout')
    if (!existsSync(hd)) continue
    for (const f of readdirSync(hd).filter((f) => f.endsWith('.jsonl')).sort()) {
      const rs = readJsonl<{ task: string; rung: string; arm: string; outcome: string }>(join(hd, f))
      for (const rung of [...new Set(rs.map((r) => r.rung))].sort()) {
        const of = (who: (a: string) => boolean) => rs.filter((r) => r.rung === rung && who(r.arm))
        const snap = of((a) => a !== 'naive')
        const naive = of((a) => a === 'naive')
        const rate = (xs: typeof rs) => (xs.length ? pct(xs.filter((x) => x.outcome === 'accepted').length / xs.length) : '—')
        rows.push(`| ${arm} | ${f.replace(/\.jsonl$/, '')} | ${rung} | ${naive.length} | ${rate(snap)} | ${rate(naive)} |`)
      }
    }
  }
  return rows.join('\n')
}

/** T-R4: the outer loop's proposals by kind, kept and rejected. */
export function tableR4(root: string): string {
  const rows = ['| Arm | Kind | Proposed | Kept |', '|---|---|---|---|']
  for (const arm of dirs(root)) {
    const ps = readJsonl<{ kind: string; proposal?: { kind: string }; accepted?: boolean }>(join(root, arm, 'modder-state', 'journal.jsonl')).filter((e) => e.kind === 'proposal')
    for (const kind of [...new Set(ps.map((p) => p.proposal?.kind ?? '?'))].sort()) {
      const of = ps.filter((p) => (p.proposal?.kind ?? '?') === kind)
      rows.push(`| ${arm} | ${kind} | ${of.length} | ${of.filter((p) => p.accepted).length} |`)
    }
  }
  return rows.join('\n')
}

export function report(root: string): string {
  return ['# The RSI experiments: tables', '', '## T-R1 · the benchmark', '', tableR1(runs(root)), '', '## T-R3 · the ladder, tasks from the future', '', tableR3(root), '', '## T-R4 · the outer loop', '', tableR4(root), ''].join('\n')
}
