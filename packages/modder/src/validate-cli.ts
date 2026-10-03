// The tests of a world repository (repo.ts): `node validate.mjs` runs this. It collects the rules
// the agent added, runs the engine's validator on them — schema, ontology, conflicts, the replay
// of the triggering event, the rules' own tests, regression — and shows what the
// event does under them. Exit 0 = the patch would be accepted.

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { RuleLibrary, validatePatch } from '@lsw/engine'
import { buildOntology } from '@lsw/content'
import { collectPatch, type WorldRepoState } from './repo.ts'
import { describeOutcome } from './tools.ts'

const dir = resolve(process.argv[2] ?? '.')
const state = JSON.parse(readFileSync(join(dir, '.lsw/state.json'), 'utf8')) as WorldRepoState
const { patch, problems } = collectPatch(dir)
const out: string[] = []
if (!patch) out.push('FAIL: no rule added under rules/patch/ yet')
for (const p of problems) out.push(`FAIL: ${p}`)
if (patch) {
  const lib = RuleLibrary.fromJSON(state.library)
  for (const id of state.replaces) lib.remove(id)
  const ontology = buildOntology()
  const res = validatePatch(patch, { ontology, library: lib, scenario: state.request.scenario, regression: state.regression.filter((r) => !state.replaces.includes(r.rule)) })
  for (const e of res.errors) out.push(`FAIL: ${e}`)
  for (const w of res.warnings) out.push(`warning: ${w}`)
  for (const o of res.overrides) out.push(`overrides: ${o}`)
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
