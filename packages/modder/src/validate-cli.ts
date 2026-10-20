// The tests of a world repository (repo.ts): `node validate.mjs` runs this. It collects the rules
// the agent added, runs the engine's validator on them — schema, ontology, conflicts, the replay
// of the triggering event, the rules' own tests, regression — and shows what the
// event does under them. Exit 0 = the patch would be accepted.

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { RuleLibrary, tierOfRequest, validatePatch } from '@openworld/engine'
// the engine's official modules, which a world's ontology may name (docs/engine-split.md S3)
import '@openworld/modules'
import { collectPatch, type WorldRepoState } from './repo.ts'
import { describeOutcome } from './tools.ts'

const dir = resolve(process.argv[2] ?? '.')
const state = JSON.parse(readFileSync(join(dir, '.lsw/state.json'), 'utf8')) as WorldRepoState
const collected = collectPatch(dir)
const { problems } = collected
// the tier the question was asked at (the AI setting, design.md §13) is the harness's to set, as the place is
const tier = tierOfRequest(state.request)
const patch = collected.patch && tier !== 'medium'
  ? { ...collected.patch, artifacts: collected.patch.artifacts.map((a) => (a.kind === 'rule' && a.rule && a.rule.tier === undefined ? { ...a, rule: { ...a.rule, tier } } : a)) }
  : collected.patch
const out: string[] = []
if (!patch) out.push('FAIL: no rule added under rules/patch/ yet')
for (const p of problems) out.push(`FAIL: ${p}`)
if (patch) {
  const lib = RuleLibrary.fromJSON(state.library)
  for (const id of state.replaces) lib.remove(id)
  const ontology = state.ontology
  // a world event's answer is held to the world's boundaries, as the commit and every client hold it
  const res = validatePatch(patch, { ontology, library: lib, scenario: state.request.scenario, world: (state.request.origin ?? patch.trigger) === 'world' })
  for (const e of res.errors) out.push(`FAIL: ${e}`)
  for (const w of res.warnings) out.push(`warning: ${w}`)
  if (!res.errors.length) {
    const onto = { ...ontology, types: { ...ontology.types }, statuses: { ...ontology.statuses } }
    for (const t of lib.types) onto.types[t.id] = t
    for (const s of lib.statuses) onto.statuses[s.id] = s
    out.push('', 'What the triggering event does now:', describeOutcome(state.request.scenario, patch, { library: lib, ontology: onto }))
  }
}
const failed = out.some((l) => l.startsWith('FAIL'))
console.log(`${failed ? 'FAILED' : 'PASSED'}: ${patch?.artifacts.length ?? 0} artifact(s) checked\n${out.join('\n')}`)
process.exit(failed ? 1 : 0)
