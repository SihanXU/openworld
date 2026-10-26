import { describe, expect, it } from 'vitest'
import type { HistoryDef } from '../src/ladder.ts'
import { planOf, type Milestone } from '../src/rsi.ts'

const m = (tag: string, date: string): Milestone => ({ tag, commit: `${tag}-commit`, date })
const d = (id: string, date: string, rung: HistoryDef['rung'] = 'R2') => ({ id, date, rung }) as HistoryDef

describe('a milestone of the RSI experiments (docs/rsi-experiments.md §6)', () => {
  const all = [m('world-v0', '2026-10-15T00:00:00Z'), m('world-v1', '2026-10-22T00:00:00Z'), m('world-v2', '2026-10-29T00:00:00Z')]
  const defs = [d('a', '2026-10-01T00:00:00Z'), d('b', '2026-10-14T00:00:00Z', 'R3'), d('c', '2026-10-18T00:00:00Z'), d('e', '2026-10-25T00:00:00Z', 'R4'), d('f', '2026-11-01T00:00:00Z')]

  it('gives arm G every window so far, and its window to the previous snapshot as tasks from its future', () => {
    const p = planOf(all, 'world-v1', 'G', defs, ['world-v0'])
    expect(p.window.map((x) => x.id)).toEqual(['c'])
    expect(p.curriculum.map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(p.heldoutSnapshot).toBe('world-v0')
    expect(planOf(all, 'world-v2', 'G', defs, ['world-v0']).heldoutSnapshot).toBeUndefined() // world-v1's snapshot is not there
  })

  it('gives arm F only what world-v0 held, at every milestone', () => {
    const p = planOf(all, 'world-v2', 'F', defs, ['world-v1'])
    expect(p.curriculum.map((x) => x.id)).toEqual(['a', 'b'])
    expect(p.window.map((x) => x.id)).toEqual(['e'])
    expect(p.first.tag).toBe('world-v0')
  })

  it('at world-v0 the window is the whole history before it', () => {
    expect(planOf(all, 'world-v0', 'G', defs, []).window.map((x) => x.id)).toEqual(['a', 'b'])
    expect(() => planOf(all, 'world-v9', 'G', defs, [])).toThrow(/no milestone world-v9/)
  })
})

describe('the tables from what the milestones left', () => {
  it('compares runs task by task (McNemar) and tallies the held-out ladder and the outer loop', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { mcnemar, report, runs } = await import('../../tools/src/rsi-report.ts')
    const root = mkdtempSync(join(tmpdir(), 'lsw-rsi-report-'))
    const put = (f: string, rows: object[]) => {
      mkdirSync(join(f, '..'), { recursive: true })
      writeFileSync(f, rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
    }
    const ids = Array.from({ length: 20 }, (_, i) => `t${i}`)
    put(join(root, 'naive', 'runs', 'world-v0', 'preds.jsonl.n.resolved.jsonl'), ids.map((id, i) => ({ instance_id: id, resolved: i < 8 })))
    put(join(root, 'G', 'runs', 'world-v1', 'preds.jsonl.g.resolved.jsonl'), ids.map((id, i) => ({ instance_id: id, resolved: i < 14 })))
    put(join(root, 'G', 'runs', 'world-v1', 'preds.jsonl.runs.jsonl'), ids.map(() => ({ outcome: 'failed', steps: 30, cost: 0.2 })))
    put(join(root, 'G', 'heldout', 'world-v1.jsonl'), [{ task: 'a', rung: 'R2', arm: 'world-v0', outcome: 'accepted' }, { task: 'a', rung: 'R2', arm: 'naive', outcome: 'failed' }])
    put(join(root, 'G', 'modder-state', 'journal.jsonl'), [{ kind: 'proposal', proposal: { kind: 'note' }, accepted: true }, { kind: 'proposal', proposal: { kind: 'hook' }, accepted: false }, { kind: 'episode' }])
    const rs = runs(root)
    expect(rs.map((r) => `${r.arm}@${r.tag}`)).toEqual(['G@world-v1', 'naive@world-v0'])
    const m = mcnemar(rs[0].resolved, rs[1].resolved)
    expect(m).toMatchObject({ n: 20, aOnly: 6, bOnly: 0 })
    expect(m.p).toBeCloseTo(2 * 0.5 ** 6, 6) // all six discordant pairs one way
    const md = report(root)
    expect(md).toContain('| G | world-v1 | 20 | 14 | 70.0 | $0.200 | 30.0 | +30.0 (p = 0.031, 6/0) |')
    expect(md).toContain('| G | world-v1 | R2 | 1 | 100.0 | 0.0 |')
    expect(md).toContain('| G | hook | 1 | 0 |')
  })
})
