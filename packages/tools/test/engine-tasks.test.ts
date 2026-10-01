import { describe, expect, it } from 'vitest'
import { ScriptedModel, SelfState, runAgent } from '@lsw/agent'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { engineTask, engineTaskDefs } from '../src/engine-tasks.ts'

describe('engine tasks', () => {
  it('are real fail-to-pass tasks: the copy\'s tests pass, each hidden test fails on the engine as it is', { timeout: 600_000 }, async () => {
    const defs = engineTaskDefs()
    expect(defs.map((d) => d.id).sort()).toEqual(['prop-eq', 'toggle-status'])
    for (const def of defs) {
      const t = engineTask(def)
      try {
        const own = await t.task.env.exec(t.task.tests!.command, { timeoutMs: 300_000 })
        expect(own.code, own.stdout.slice(-2000)).toBe(0)
        // an agent that changes nothing: submitted, and the hidden test decides against it
        const idle = new ScriptedModel(() => ({ content: '', toolCalls: [{ id: 's', name: 'submit', args: { summary: 'nothing' } }] }))
        const r = await runAgent(t.task, { model: idle, state: SelfState.open(mkdtempSync(join(tmpdir(), 'lsw-et-'))), record: false })
        expect(r.submitted).toBe(true)
        expect(r.outcome, def.id).toBe('failed')
        expect(r.verdict!.output).toMatch(/hidden/)
        expect(r.diff).toBe('')
      } finally {
        t.dispose()
      }
    }
  })
})
