// Composition (paper §7.2, openness): does an answer join the physics? Each learned rule of a library is played in the
// scene that asked for it, over the base rules and every learned rule, and the chain it starts is read from the
// engine's trace: how many events it runs to, and which rules besides its own answer them. No model.
//
//   npx tsx games/openworld/tools/src/eval/composition.ts <library.jsonl> [--out var/eval/composition.json]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { RuleLibrary, buildSandbox, scenarioEvent, type Rule, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'

const file = process.argv[2]
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'var/eval/composition.json'
const lines = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
const learned: Rule[] = lines.flatMap((l) => (l.patch?.artifacts ?? []).filter((a: any) => a.kind === 'rule').map((a: any) => ({ ...a.rule, source: { origin: 'patch' } })))
const onto = buildOntology()
for (const l of lines) for (const a of l.patch?.artifacts ?? []) if (a.kind === 'type') onto.types[a.type.id] = a.type
const rows: { rules: string[]; events: number; others: string[] }[] = []
for (const l of lines) {
  const own: string[] = l.rules ?? []
  const sc: Scenario | undefined = l.scenario
  if (!own.length || !sc) continue
  try {
    const lib = new RuleLibrary([...BASE_RULES, ...STORY_RULES])
    for (const r of learned) lib.add(r)
    const eng = buildSandbox(sc, onto, lib)
    const before = eng.traced
    eng.dispatch(scenarioEvent(sc, eng))
    for (let t = 0; t < 20; t++) eng.tick()
    const fresh = eng.trace.slice(Math.max(0, eng.trace.length - (eng.traced - before))).filter((e) => !e.ev.kind.startsWith('time/'))
    const others = [...new Set(fresh.map((e) => e.rule).filter((r): r is string => !!r && !own.includes(r)))]
    rows.push({ rules: own, events: fresh.length, others })
  } catch {
    // a scene that no longer builds (an older patch's): left out
  }
}
const composed = rows.filter((r) => r.others.length)
const lengths = rows.map((r) => r.events).sort((a, b) => a - b)
const result = {
  answers: rows.length,
  composed: composed.length,
  share: +(composed.length / rows.length).toFixed(2),
  chain: { median: lengths[Math.floor(lengths.length / 2)], mean: +(lengths.reduce((a, b) => a + b, 0) / lengths.length).toFixed(1), max: lengths.at(-1) },
  reached: Object.entries(composed.flatMap((r) => r.others).reduce<Record<string, number>>((m, r) => ((m[r] = (m[r] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 12),
}
console.log(JSON.stringify(result, null, 1))
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ ...result, rows }, null, 1))
