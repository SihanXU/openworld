// Two starting points for the agent's harness. NAIVE is where a self-improvement run begins: the
// bare loop, no notes, no hooks, no skills. TUNED is the human reference arm: what an engineer
// (we) would add by hand — the same kinds of things the outer loop may add, so a run can be
// compared with it.

import { NAIVE_AGENT, type SelfState } from './state.ts'

/** Start hook: the files that mention the issue's identifiers, so the agent looks there first. */
export const RELATED_CODE_HOOK = `import { readFileSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
// files containing a fixed string: ripgrep, else git grep, else a plain walk
const SKIP = new Set(['.git', 'node_modules', '.agent', 'dist', '.venv', '__pycache__'])
function filesWith(w) {
  for (const [cmd, args] of [['rg', ['-l', '-F', '--max-count', '1', '-g', '!.agent', w, '.']], ['git', ['grep', '-l', '-F', w]]]) {
    try { return execFileSync(cmd, args, { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'] }).split('\\n').filter(Boolean) } catch (e) { if (e.code !== 'ENOENT' && e.status === 1) return [] }
  }
  const out = []
  const walk = (d) => { for (const n of readdirSync(d)) { if (SKIP.has(n) || out.length > 30) continue; const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p); else if (s.size < 500000 && readFileSync(p, 'utf8').includes(w)) out.push(p) } }
  walk('.')
  return out
}
const issue = readFileSync(process.env.TASK_ISSUE || '.agent/ISSUE.md', 'utf8')
const words = new Map()
const add = (w) => { w = w.trim(); if (w.length >= 3 && !/^(https?|the|and|for|not)$/i.test(w)) words.set(w, (words.get(w) || 0) + 1) }
// code spans, calls like name(…), camelCase / snake_case / kebab-case identifiers
for (const m of issue.matchAll(/\`([^\`\\n]{3,60})\`/g)) { add(m[1]); for (const c of m[1].matchAll(/([A-Za-z_][A-Za-z0-9_.]*)\\(/g)) add(c[1]) }
for (const m of issue.matchAll(/\\b([A-Za-z_][A-Za-z0-9_]*)\\(/g)) add(m[1])
for (const m of issue.matchAll(/\\b([A-Za-z_][A-Za-z0-9_]*[A-Z_][A-Za-z0-9_]*|[a-z]+(?:-[a-z0-9]+)+)\\b/g)) add(m[1])
const hits = new Map()
for (const w of [...words.keys()].slice(0, 12)) {
  for (const f of filesWith(w).slice(0, 30).map((p) => p.replace(/\\\\/g, '/').replace(/^\\.\\//, ''))) hits.set(f, [...(hits.get(f) || []), w])
}
const ranked = [...hits.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 15)
console.log(ranked.length ? 'Files that mention the issue\\'s identifiers (most first):\\n' + ranked.map(([f, ws]) => '- ' + f + ': ' + ws.join(', ')).join('\\n') : 'No file mentions the issue\\'s identifiers.')
`

/** Presubmit hook: no submission while the task's tests fail. */
export const TESTS_PASS_HOOK = `import { execSync } from 'node:child_process'
const cmd = process.env.TASK_TESTS
if (!cmd) process.exit(0)
try {
  execSync(cmd, { stdio: 'pipe', timeout: 110000 })
  console.log('tests pass')
} catch (err) {
  const out = String(err.stdout || '') + String(err.stderr || '')
  console.log('BLOCK: the tests fail. Fix them before submitting.\\n' + out.slice(-2500))
  process.exit(1)
}
`

export const TUNED_NOTES = [
  'Before editing, find where similar behaviour is already implemented and follow its pattern.',
  'Run the tests after each change; read the first failure in full before changing anything else.',
  'Make the smallest change that solves the task, in the style of the surrounding code.',
]

export type Preset = 'naive' | 'tuned'

export function applyPreset(state: SelfState, preset: Preset): void {
  const h = state.harness()
  if (preset === 'naive') {
    state.setHarness({ ...h, agent: structuredClone(NAIVE_AGENT), addenda: [] }, 'preset: naive (the starting point of a run)', 'preset')
    return
  }
  state.writeHook('start', 'related-code', RELATED_CODE_HOOK, 'preset')
  state.writeHook('presubmit', 'tests-pass', TESTS_PASS_HOOK, 'preset')
  state.setHarness(
    { ...h, agent: { ...NAIVE_AGENT, planFirst: true, hooks: { start: ['related-code'], presubmit: ['tests-pass'] } }, addenda: TUNED_NOTES },
    'preset: tuned (the human reference)',
    'preset',
  )
}
