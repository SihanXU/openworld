import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO } from '@openworld/ai'
import { area, classify, historyDefs, historyTask, isCode, isTest, leaks, rungOf, statuses, workspace } from '../src/ladder.ts'

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
