import { describe, expect, it } from 'vitest'
import { RuleLibrary } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '@openworld-game/content'
import { sweep } from '../../tools/src/coverage.ts'
import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalEnv, ScriptedModel, SelfState, type ChatMessage } from '@openworld/ai'
import { cellRequest, codeTask, pick } from '../src/curriculum.ts'

const onto = buildOntology()
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

describe('a code task of the curriculum', () => {
  it('is reflected on as a world task is: an engine task leaves a lesson, a general one shown to an SWE task', { timeout: 30_000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-engine-'))
    mkdirSync(join(dir, 'src'))
    writeFileSync(join(dir, 'src', 'add.mjs'), 'export const add = (a, b) => a - b\n')
    writeFileSync(join(dir, 'test.mjs'), "import { add } from './src/add.mjs'\nif (add(2, 3) !== 5) process.exit(1)\n")
    execSync('git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm init', { cwd: dir })
    const call = (name: string, args: Record<string, unknown>) => ({ content: '', toolCalls: [{ id: name, name, args }] })
    const model = new ScriptedModel((messages: ChatMessage[], opts) => {
      if (opts.purpose === 'reflect') return { lessons: { add: [{ text: 'Find where a function is defined before changing its callers.', general: true }] }, skill: null }
      const done = messages.filter((m) => m.role === 'tool').map((m) => (m as { name: string }).name)
      if (!done.includes('edit_file')) return call('edit_file', { path: 'src/add.mjs', old_string: 'a - b', new_string: 'a + b' })
      if (!done.includes('run_tests')) return call('run_tests', {})
      return call('submit', { summary: 'fix add' })
    })
    const state = SelfState.open(mkdtempSync(join(tmpdir(), 'lsw-curriculum-state-')))
    const r = await codeTask({ id: 'add', kind: 'engine', statement: 'add() subtracts', env: new LocalEnv(dir), tests: { command: 'node test.mjs' } }, { model, state })
    expect(r.outcome).toBe('accepted')
    expect(state.episodes()).toHaveLength(1)
    expect(state.relevantLessons(['kind:swe', 'w:pandas'], 8).map((l) => l.text)).toEqual(['Find where a function is defined before changing its callers.'])
  })
})
