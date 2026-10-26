// The drivers of the offline work (no model: an agent is never run here): the curriculum's cells, the engine
// tasks and the ladder's commits as tasks, the RSI milestones, and the upstream loop's task.

import { describe, expect, it } from 'vitest'
import { RuleLibrary } from '@openworld/engine'
import { BASE_RULES } from '@openworld-game/content'
import { sweep } from '../../tools/src/coverage.ts'
import { cellRequest, pick } from '../src/curriculum.ts'
import { ScriptedModel, SelfState, runAgent, REPO, candidates } from '@openworld/ai'
import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { engineTask, engineTaskDefs } from '../src/engine-tasks.ts'
import { execSync } from 'node:child_process'
import { area, classify, historyDefs, historyTask, isCode, isTest, leaks, rungOf, statuses, workspace, type HistoryDef } from '../src/ladder.ts'
import { planOf, type Milestone } from '../src/rsi.ts'
import { UPSTREAM, branchFor, checkBounds, compareSweeps, holeSource, leafTypes, promotionTest, upstreamTask, type SweepMap } from '../src/upstream.ts'
import { SEIZE, STONE, onto, slimeLibrary } from './fixtures.ts'

const cov = sweep(onto)
const open = cov.cells.filter((c) => c.outcome === 'undefined')

describe('the curriculum', () => {
  it('samples undefined interactions across many targets', () => {
    const cells = pick(open, 30, 7)
    expect(cells).toHaveLength(30)
    expect(new Set(cells.map((c) => c.target)).size).toBe(30)
    expect(pick(open, 30, 7)).toEqual(cells) // seeded
  })

  it('turns every kind of swept cell into the request a player would raise', () => {
    const lib = new RuleLibrary(BASE_RULES)
    const kinds = ['tile:', 'fixture/', 'person', 'creature', 'self', 'item']
    for (const kind of kinds) {
      const cell = open.find((c) => c.target.startsWith(kind) && c.hand)!
      expect(cell, kind).toBeTruthy()
      const req = cellRequest(cell, onto, lib)!
      expect(req, `${cell.verb} ${cell.hand} → ${cell.target}`).toBeTruthy()
      // the request is for the hole the sweep found: the act itself, or an impulse it sent
      expect(req.hole.rule).toBe(cell.hole)
      if (req.event.kind.startsWith('act/')) expect(req.event.kind).toBe(`act/${cell.verb}`)
      expect([req.event.host?.type, req.event.roles.instrument?.type]).toContain(cell.hand)
      expect(req.context.tiles).toHaveLength(7)
      // open ground around the event, but for the target's own tile
      expect(req.scenario.terrain!.flat().filter((t) => t !== 'grass').length, cell.target).toBeLessThanOrEqual(1)
    }
  })
})

describe('engine tasks', () => {
  it('are real fail-to-pass tasks: the copy\'s tests pass, each hidden test fails on the engine as it is', { timeout: 600_000 }, async () => {
    const defs = engineTaskDefs()
    expect(defs.map((d) => d.id).sort()).toEqual(['prop-eq', 'toggle-status'])
    for (const def of defs) {
      // run as a person would by hand: in a container if there is one, else on this machine
      const t = (await engineTask(def, { localRun: true }))!
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
        await t.dispose()
      }
    }
  })

  it('are not made for unattended work where there is no container', async () => {
    const def = engineTaskDefs()[0]
    expect(await engineTask(def, { isolation: 'none' })).toBeUndefined()
    const local = (await engineTask(def, { isolation: 'none', localRun: true }))!
    try {
      expect(local.task.env.isolated).toBe(false)
      expect(local.task.localRun).toBe(true)
    } finally {
      await local.dispose()
    }
  })
})

describe('the ladder: this repository’s commits as tasks', () => {
  it('tells tests from code and places a commit on its rung', () => {
    expect(isTest('packages/engine/test/rules.test.ts') && isTest('games/openworld/tools/test/demo.test.ts')).toBe(true)
    expect(isTest('games/openworld/tools/test/coverage.baseline.json')).toBe(false)
    expect(isCode('packages/engine/src/engine.ts') && !isCode('docs/rsi.md') && !isCode('package-lock.json') && !isCode('games/openworld/public/world/index.json')).toBe(true)
    expect([area('packages/engine/src/x.ts'), area('games/openworld/content/src/rules.ts'), area('games/openworld/client/src/game.ts')]).toEqual(['engine', 'content', 'runtime'])
    expect(rungOf(30, new Set(['content']))).toBe('R1')
    expect(rungOf(150, new Set(['content', 'tools']))).toBe('R2')
    expect(rungOf(2, new Set(['engine']))).toBe('R2') // a kernel fix of a few lines
    expect(rungOf(300, new Set(['engine', 'content']))).toBe('R3')
    expect(rungOf(900, new Set(['engine']))).toBe('R4')
    expect(rungOf(5000, new Set(['engine']))).toBeUndefined() // a whole phase: not one task
  })

  it('judges the runs as the fresh pool does: all before failing and all after passing, a flake in neither', () => {
    const P = 'passed'
    const F = 'failed'
    const before: Record<string, string>[] = [{ a: P, b: F, flaky: P, lost: P }, { a: P, b: F, flaky: F, lost: P }, { a: P, lost: P }]
    const after = [{ a: P, b: P, flaky: P, lost: P }, { a: P, b: P, flaky: P, lost: F }, { a: P, b: P, flaky: P, lost: P }]
    expect(classify(before, after)).toEqual({ f2p: ['b'], p2p: ['a'], regressions: ['lost'] })
    const ws = join(tmpdir(), 'ws')
    expect(statuses({ testResults: [{ name: join(ws, 'packages', 'x', 'test', 'a.test.ts'), assertionResults: [{ fullName: 'x does y', status: 'passed' }] }] }, ws)).toEqual({ 'packages/x/test/a.test.ts::x does y': 'passed' })
  })

  it('refuses an issue that quotes the change', () => {
    const gold = ['+const a = 1', '+const b = 2', '+const c = 3', '+const d = 4', '+const e = 5', '+const f = 6'].join('\n')
    expect(leaks(gold, 'The values a to f should be set:\nconst a = 1\nconst b = 2\nconst c = 3\nconst d = 4\nconst e = 5\nconst f = 6')).toBe(true)
    expect(leaks(gold, 'Set a, b, c, d, e and f to one through six.')).toBe(false)
  })

  it('makes a workspace of a parent: its code and tests as a repository of their own, without the tasks or the served assets', { timeout: 120_000 }, () => {
    const parent = execSync('git rev-parse HEAD~1', { cwd: REPO, encoding: 'utf8' }).trim()
    const ws = mkdtempSync(join(tmpdir(), 'lsw-ladder-test-'))
    try {
      workspace(parent, ws)
      expect(existsSync(join(ws, 'packages', 'engine', 'src', 'engine.ts'))).toBe(true)
      expect(existsSync(join(ws, 'docs'))).toBe(false)
      expect(existsSync(join(ws, 'games', 'openworld', 'public'))).toBe(false)
      expect(existsSync(join(ws, 'games', 'openworld', 'tools', 'tasks'))).toBe(false) // no task's hidden tests in another's workspace
      expect(readFileSync(join(ws, 'package.json'), 'utf8')).not.toContain('\r\n')
      expect(execSync('git log --format=%s', { cwd: ws, encoding: 'utf8' }).trim()).toBe('base')
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('a history task that cannot be built leaves no workspace behind', async () => {
    const def = historyDefs()[0]
    if (!def) return
    // a temp folder of its own (os.tmpdir() reads TMPDIR when called), so no other test's workspaces count
    const tmp = mkdtempSync(join(tmpdir(), 'lsw-history-test-'))
    const was = process.env.TMPDIR
    process.env.TMPDIR = tmp
    try {
      await expect(historyTask({ ...def, parent: '0'.repeat(40) }, { isolation: 'none', localRun: true })).rejects.toThrow()
      expect(readdirSync(tmp)).toEqual([])
    } finally {
      if (was === undefined) delete process.env.TMPDIR
      else process.env.TMPDIR = was
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

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

// The upstream loop's task (docs/upstream.md §3): the issue quotes the hole and the evidence; the
// generated promotion test fails on the content as it is (the scenes are still holes) and passes
// once a class rule answers them; the regression and the bounds refuse what reaches too far.
// No model: the agent is never run here.

const SLIMES = 'actor/creature/slime'
const RULES = 'games/openworld/content/src/rules.ts'

/** The class rule a proposal would add, as the agent would write it in the GENERAL block. */
const CLASS_RULE = `  rule({
    id: 'slime/offered-stone',
    label: L('Press {instrument} to {target}', '把{instrument}按在{target}上'),
    doc: 'A stone held out to a slime: its jelly seizes up around it (the class rule the three slimes learned one by one).',
    host: { type: '${SLIMES}' },
    on: 'impulse/offered',
    tree: IF(is('item', { type: '${STONE}' }), DO(add('frozen', 30), log('{host} seizes up around the stone.', '{host}裹住石头，僵住了。')), 'inherit'),
  }),
`

describe('the upstream task', () => {
  it('quotes the hole and the class, and its promotion test fails until a base rule answers the scenes; then the whole verdict passes', { timeout: 600_000 }, async () => {
    const library = slimeLibrary(Object.fromEntries(['green_slime', 'fire_slime', 'frost_slime'].map((t) => [`${SLIMES}/${t}`, SEIZE])))
    const [c] = candidates(library, onto)
    expect(c).toMatchObject({ signal: 'S1', ancestor: SLIMES, hole: 'core/offered', kind: 'impulse/offered' })
    expect(await upstreamTask(c, { library, isolation: 'none' })).toBeUndefined() // unattended, no container: no task
    const t = (await upstreamTask(c, { library, isolation: 'none', localRun: true }))!
    try {
      const { task } = t
      expect(task.kind).toBe('upstream')
      expect(task.localRun).toBe(true)
      // the issue: the base rule quoted from its file, the class and its leaf types, each learned rule with its scene
      const src = holeSource('core/offered')!
      expect(src.file).toBe(RULES)
      expect(src.text).toMatch(/^rule\(\{ id: 'core\/offered'.*\}\)$/s)
      expect(task.statement).toContain(src.text)
      expect(task.statement).toContain(`${src.file}:${src.lines[0]}-${src.lines[1]}`)
      for (const leaf of leafTypes(onto, SLIMES)) expect(task.statement).toContain(leaf)
      expect(task.statement).toMatch(/\*\*actor\/creature\/slime\/green_slime\*\*/)
      expect(task.statement).toContain('`patch/fire_slime-stone`')
      expect(task.statement).toMatch(/The scene that asked: impulse\/offered — host: actor\/creature\/slime\/frost_slime, actor: actor\/person\/player, instrument: item\/material\/stone/)
      expect(task.statement).toContain(`At most ${UPSTREAM.L} changed lines`)
      // the promotion test: the three scenes, their expectations without resolvedBy
      expect(t.cases.map((x) => x.type)).toEqual([`${SLIMES}/green_slime`, `${SLIMES}/fire_slime`, `${SLIMES}/frost_slime`])
      for (const x of t.cases) expect(x.expect).toEqual([{ key: 'host', hasStatus: 'frozen' }])
      const test = join(t.workspace, 'games/openworld/content/test/promotion.test.ts')
      writeFileSync(test, promotionTest(t.cases))
      // on the content as it is, the scenes are still holes
      const before = await task.env.exec('npx vitest run games/openworld/content/test/promotion.test.ts', { timeoutMs: 300_000 })
      expect(before.code).not.toBe(0)
      expect(before.stdout + before.stderr).toMatch(/still a hole at core\/offered/)
      // a class rule on the slimes, written into the GENERAL block, answers them
      const rules = join(t.workspace, RULES)
      const text = readFileSync(rules, 'utf8')
      expect(text).toContain('const GENERAL: Rule[] = [\n')
      writeFileSync(rules, text.replace('const GENERAL: Rule[] = [\n', `const GENERAL: Rule[] = [\n${CLASS_RULE}`))
      const after = await task.env.exec('npx vitest run games/openworld/content/test/promotion.test.ts', { timeoutMs: 300_000 })
      expect(after.code, after.stdout.slice(-1500)).toBe(0)
      // and the engine cannot be written
      await expect(async () => writeFileSync(join(t.workspace, 'packages/engine/src/rules.ts'), 'x')).rejects.toThrow()
      // the whole verdict: bounds, promotion, no defined outcome changed, the content suite (the judge writes the promotion test itself: a test file in the tree is the agent's, out of bounds)
      rmSync(test)
      const v = await task.verdict!(task.env)
      expect(v.output).toMatch(/## bounds: pass/)
      expect(v.output).toMatch(/## promotion: pass/)
      expect(v.output).toMatch(/## coverage: pass\n[1-9]\d* cell\(s\) newly answered at core\/offered on actor\/creature\/slime/)
      expect(v.output).toMatch(/## content suite: pass/)
      expect(v.ok, v.output).toBe(true)
      // the judge's own files never enter the diff
      const diff = await task.env.exec('git add -A -N .; git diff --name-only')
      expect(diff.stdout.trim().split('\n')).toEqual([RULES])
    } finally {
      await t.dispose()
    }
  })

  it('names the branch after the hole and the class', () => {
    expect(branchFor({ hole: 'core/use#!{"none":"instrument"}', ancestor: SLIMES })).toBe('upstream/core-use-none-instrument-actor-creature-slime')
  })
})

describe('the bounds', () => {
  const ok = { rulesBefore: 100, rulesAfter: 101, exportsBase: true, engineChanged: false }
  it('take one rule in rules.ts within L lines, and nothing in the engine', () => {
    expect(checkBounds({ numstat: `9\t0\t${RULES}\n`, ...ok })).toEqual([])
    expect(checkBounds({ numstat: `9\t0\t${RULES}\n3\t0\tgames/openworld/content/src/ontology.ts\n`, ...ok })).toEqual([])
    expect(checkBounds({ numstat: `9\t0\t${RULES}\n2\t1\tpackages/engine/src/effects.ts\n`, ...ok, engineChanged: true }).join('\n')).toMatch(/effects\.ts: not a file a proposal may change[\s\S]*packages\/engine changed/)
    expect(checkBounds({ numstat: `70\t20\t${RULES}\n`, ...ok })).toEqual([`90 lines changed, more than ${UPSTREAM.L}`])
    expect(checkBounds({ numstat: `9\t0\t${RULES}\n`, ...ok, rulesAfter: 102 })).toEqual(['2 new rule(s) in rules.ts, not one'])
    expect(checkBounds({ numstat: `4\t0\tgames/openworld/content/src/items.ts\n`, ...ok, rulesAfter: 100 }).join('\n')).toMatch(/rules\.ts: unchanged[\s\S]*0 new rule/)
    expect(checkBounds({ numstat: `9\t0\t${RULES}\n`, ...ok, exportsBase: false })).toEqual(['rules.ts no longer exports BASE_RULES'])
  })
})

describe('the coverage regression', () => {
  const c = { kind: 'impulse/offered', hole: 'core/offered', ancestor: SLIMES }
  const open = `${SLIMES}/green_slime|impulse/offered|core/offered`
  const before: SweepMap = {
    'item/tool/axe|fixture/nature/tree|use': { outcome: 'specific', rule: 'tree/chop' },
    '|tile:grass|hands': { outcome: 'generic', rule: 'tile/handle' },
    'item/material/stone|creature|use': { outcome: 'undefined', rule: 'core/use', open },
    'item/material/grass|creature|use': { outcome: 'undefined', rule: 'core/use', open: `${SLIMES}/green_slime|impulse/offered|core/offered#x` },
    'item/material/stone|fixture/nature/dead_tree|use': { outcome: 'undefined', rule: 'core/use', open: 'item/material/stone|act/use|core/use#y' },
  }
  it('passes when every defined cell resolves as before and the gains are the candidate\'s', () => {
    const after: SweepMap = { ...before, 'item/material/stone|creature|use': { outcome: 'specific', rule: 'slime/offered-stone' } }
    expect(compareSweeps(before, after, c)).toEqual({ regressions: [], strays: [], gained: 1 })
  })
  it('reports a defined cell that changed hands or became a hole, and a gain beyond the proposal', () => {
    const after: SweepMap = {
      ...before,
      'item/tool/axe|fixture/nature/tree|use': { outcome: 'specific', rule: 'slime/offered-stone' },
      '|tile:grass|hands': { outcome: 'undefined', rule: 'core/handle' },
      'item/material/grass|creature|use': { outcome: 'specific', rule: 'slime/offered-stone' },
      'item/material/stone|fixture/nature/dead_tree|use': { outcome: 'specific', rule: 'slime/offered-stone' },
    }
    delete (after as Record<string, unknown>)['item/material/stone|creature|use']
    const d = compareSweeps(before, after, c)
    expect(d.regressions).toEqual(['item/tool/axe|fixture/nature/tree|use: was tree/chop, now slime/offered-stone', '|tile:grass|hands: was tile/handle, now undefined'])
    expect(d.strays).toEqual(['item/material/grass|creature|use: now slime/offered-stone (was open at actor/creature/slime/green_slime|impulse/offered|core/offered#x)', 'item/material/stone|fixture/nature/dead_tree|use: now slime/offered-stone (was open at item/material/stone|act/use|core/use#y)'])
    expect(d.gained).toBe(0)
  })
})
